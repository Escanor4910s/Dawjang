import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Brain, Clock, CheckCircle, XCircle, AlertCircle, Sparkles, BookOpen, BarChart3, GraduationCap, MessageCircle, Lightbulb, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AskMor from "./AskMor";
import { safeText, safeTextArray } from "@/lib/textUtils";
import { useGamificationContext } from "@/components/gamification/GamificationProvider";
import { ShareResults } from "@/components/ShareResults";
import { shuffleQuiz } from "@/lib/quizShuffle";

interface MorPopup { message: string; type: "encouragement" | "celebration" | "tip"; visible: boolean; }
interface Question { id?: string; question: string; choices: string[]; correct: number[]; explanation?: string; }
interface Course { id: string; courseId: string; title: string; questions: Question[]; fileName?: string; questionCount?: number; questionType?: string; aiModel?: string; metadata?: any; createdAt: string; }

const GROUPAGE_BAREME = `Barème de réponses (Groupage) :
A = 1 + 2 + 3 sont vraies
B = 1 et 3 seulement sont vraies
C = 2 et 4 sont les seules justes
D = 4 uniquement est juste
E = Autre combinaison`;

const GROUPAGE_ANSWERS = ["A", "B", "C", "D", "E"];

const Quiz = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number[] }>({});
  const [showResults, setShowResults] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [morOpen, setMorOpen] = useState(false);
  const [morContext, setMorContext] = useState<string>("");
  const [morPopup, setMorPopup] = useState<MorPopup>({ message: "", type: "encouragement", visible: false });
  const { recordQuizCompletion } = useGamificationContext();

  useEffect(() => {
    const loadQuizSession = async () => {
      if (!courseId) { toast({ title: "Session invalide", variant: "destructive" }); navigate("/quiz-library"); return; }
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("qcm_sessions").select(`*, courses (id, title, content, file_name)`).eq("id", courseId).single();
        if (sessionError || !sessionData) { toast({ title: "Session introuvable", variant: "destructive" }); navigate("/quiz-library"); return; }

        const questionsData = Array.isArray(sessionData.questions) ? sessionData.questions : [];
        setCourse({
          id: sessionData.id, courseId: sessionData.course_id, title: sessionData.title,
          questions: questionsData as unknown as Question[], fileName: sessionData.courses?.file_name,
          questionCount: sessionData.question_count, questionType: sessionData.question_type,
          aiModel: sessionData.ai_model, metadata: sessionData.metadata, createdAt: sessionData.created_at,
        });

        if (questionsData.length > 0) {
          const rawQuestions = questionsData.map((q: any, index: number) => ({
            id: q.id || index.toString(), question: safeText(q.question, `Question ${index + 1}`),
            choices: safeTextArray(q.choices || [], ""),
            correct: Array.isArray(q.correct) ? q.correct.map((c: any) => typeof c === 'number' ? c : parseInt(String(c), 10) || 0) : [0],
            explanation: safeText(q.explanation, "Explication non disponible"),
          }));
          const shuffled = shuffleQuiz(rawQuestions);
          setQuestions(shuffled);
        } else { toast({ title: "Aucune question disponible", variant: "destructive" }); navigate("/quiz-library"); }
      } catch { toast({ title: "Erreur de chargement", variant: "destructive" }); navigate("/quiz-library"); }
    };
    loadQuizSession();
  }, [courseId, navigate, toast]);

  useEffect(() => {
    if (!showResults) { const timer = setInterval(() => setTimeElapsed(prev => prev + 1), 1000); return () => clearInterval(timer); }
  }, [showResults]);

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    const qType = course?.questionType;
    if (qType === "election" || qType === "censure" || qType === "groupage") {
      setSelectedAnswers(prev => ({ ...prev, [questionIndex]: [answerIndex] }));
    } else {
      setSelectedAnswers(prev => {
        const current = prev[questionIndex] || [];
        const newAnswers = current.includes(answerIndex) ? current.filter(i => i !== answerIndex) : [...current, answerIndex];
        return { ...prev, [questionIndex]: newAnswers };
      });
    }
  };

  const openMorExplanation = (question: Question) => {
    const context = `Question: ${question.question}\n\nChoix:\n${question.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nRéponse(s): ${question.correct.map(i => question.choices[i]).join(', ')}`;
    setMorContext(context);
    setMorOpen(true);
  };

  const submitQuiz = async () => {
    const { correct, total } = calculateScore();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && courseId && course) {
        const answersData = questions.map((question, index) => ({
          question: question.question,
          userAnswer: (selectedAnswers[index] || []).map(i => question.choices[i]).join(", "),
          correctAnswer: question.correct.map(i => question.choices[i]).join(", "),
          correct: (selectedAnswers[index] || []).length === question.correct.length && (selectedAnswers[index] || []).every(answer => question.correct.includes(answer))
        }));

        await supabase.from("qcm_sessions").update({
          status: "completed", score: correct, total_questions: total, answers: answersData, time_elapsed: timeElapsed, completed_at: new Date().toISOString(),
        }).eq("id", courseId);

        const { error: resultsError } = await supabase.from("quiz_results").insert({
          user_id: user.id, course_id: course.courseId, score: correct, total_questions: total, answers: answersData
        });

        if (!resultsError) {
          try { await recordQuizCompletion(correct, total); } catch {}
          const incorrectAnswers = questions.filter((q, i) => {
            const sel = selectedAnswers[i] || [];
            return !(sel.length === q.correct.length && sel.every(a => q.correct.includes(a)));
          });
          if (incorrectAnswers.length > 0) {
            await supabase.from("flashcards").insert(incorrectAnswers.map(q => ({
              user_id: user.id, course_id: course.courseId, question: q.question,
              answer: q.correct.map(i => q.choices[i]).join(", ") + (q.explanation ? `\n\nExplication: ${q.explanation}` : ""),
            })));
          }
          sonnerToast.success("Résultats sauvegardés !");
        }
      }
    } catch (error) { console.error("Error saving:", error); }

    const percentage = (correct / total) * 100;
    const popupMessage = percentage >= 80 ? "🎉 Bravo ! Excellent travail !" : percentage >= 60 ? "👏 Bien joué ! Continue !" : percentage >= 40 ? "💡 Pas mal ! Consulte la révision !" : "🩺 Ne t'inquiète pas ! Clique sur 'Explication' !";
    const popupType = percentage >= 80 ? "celebration" : percentage >= 40 ? "encouragement" : "tip";
    setMorPopup({ message: popupMessage, type: popupType as any, visible: true });
    setTimeout(() => setMorPopup(prev => ({ ...prev, visible: false })), 6000);
    setShowResults(true);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      const sel = selectedAnswers[index] || [];
      if (sel.length === question.correct.length && sel.every(a => question.correct.includes(a))) correct++;
    });
    return { correct, total: questions.length };
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const isGroupage = course?.questionType === "groupage";
  const isElection = course?.questionType === "election";
  const isCensure = course?.questionType === "censure";

  if (!course || questions.length === 0) {
    return (<div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Brain className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" /><p className="text-muted-foreground">Chargement du quiz...</p></div></div>);
  }

  if (showResults) {
    const { correct, total } = calculateScore();
    const percentage = Math.round((correct / total) * 100);
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-card shadow-card border-0 animate-fade-in">
              <CardHeader className="text-center pb-6">
                <div className={`p-4 rounded-full w-20 h-20 mx-auto mb-6 animate-scale-in ${percentage >= 70 ? 'bg-success' : percentage >= 50 ? 'bg-primary' : 'bg-destructive'}`}>
                  {percentage >= 70 ? <CheckCircle className="h-12 w-12 text-success-foreground" /> : <XCircle className="h-12 w-12 text-destructive-foreground" />}
                </div>
                <CardTitle className="text-3xl mb-2">Quiz terminé !</CardTitle>
                <CardDescription className="text-lg">{course.title}</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-8">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-6 rounded-xl animate-fade-in" style={{ animationDelay: '0.1s' }}><p className="text-3xl font-bold text-success">{correct}</p><p className="text-sm text-muted-foreground mt-1">Correctes</p></div>
                  <div className="bg-muted/50 p-6 rounded-xl animate-fade-in" style={{ animationDelay: '0.2s' }}><p className="text-3xl font-bold text-destructive">{total - correct}</p><p className="text-sm text-muted-foreground mt-1">Incorrectes</p></div>
                  <div className="bg-muted/50 p-6 rounded-xl animate-fade-in" style={{ animationDelay: '0.3s' }}><p className="text-3xl font-bold text-foreground">{formatTime(timeElapsed)}</p><p className="text-sm text-muted-foreground mt-1">Temps</p></div>
                </div>
                <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  <div className="flex justify-between text-lg"><span className="font-medium">Score final</span><span className="font-bold text-primary">{percentage}%</span></div>
                  <Progress value={percentage} className="h-4" />
                </div>
                <div className="pt-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                  <p className="text-sm text-muted-foreground mb-4">Accès rapide</p>
                  <div className="grid grid-cols-3 gap-4">
                    <button onClick={() => navigate("/dashboard")} className="group flex flex-col items-center p-4 rounded-xl bg-muted/50 hover:bg-foreground/10 transition-smooth">
                      <BarChart3 className="h-8 w-8 text-foreground mb-2 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => navigate("/review")} className="group flex flex-col items-center p-4 rounded-xl bg-muted/50 hover:bg-foreground/10 transition-smooth">
                      <BookOpen className="h-8 w-8 text-foreground mb-2 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Révision</span>
                    </button>
                    <button onClick={() => navigate("/flashcards")} className="group flex flex-col items-center p-4 rounded-xl bg-muted/50 hover:bg-foreground/10 transition-smooth">
                      <GraduationCap className="h-8 w-8 text-foreground mb-2 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Flashcards</span>
                    </button>
                  </div>
                </div>
                <ShareResults score={correct} total={total} title={course.title} />
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 border-foreground/30">Recommencer</Button>
                  <Button onClick={() => navigate("/quiz-library")} className="flex-1 bg-foreground text-background hover:bg-foreground/90">Retour aux QCM</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).filter(key => selectedAnswers[parseInt(key)]?.length > 0).length;
  const progress = (answeredCount / questions.length) * 100;

  // For groupage: extract assertions from question text (they are embedded as "1. ...\n2. ...\n...")
  const parseGroupageAssertions = (questionText: string): { mainQuestion: string; assertions: string[] } => {
    const lines = questionText.split('\n');
    const assertions: string[] = [];
    const mainLines: string[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\.\s*(.+)/);
      if (match) {
        assertions.push(match[2]);
      } else if (line.trim()) {
        mainLines.push(line.trim());
      }
    }
    return { mainQuestion: mainLines.join(' '), assertions };
  };

  return (
    <div className="min-h-screen bg-background bg-doodle-watermark py-4 sm:py-8 relative">
      {morPopup.visible && (
        <div className="fixed top-20 right-3 left-3 sm:left-auto sm:right-6 z-50 sm:max-w-sm animate-in slide-in-from-right-5 fade-in">
          <Card className={`shadow-xl border-2 ${morPopup.type === "celebration" ? "border-success bg-success/5" : morPopup.type === "tip" ? "border-primary bg-primary/5" : "border-warning bg-warning/5"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between"><div className="flex items-center gap-2"><Brain className="h-5 w-5" /><CardTitle className="text-lg">Mor</CardTitle></div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setMorPopup(prev => ({ ...prev, visible: false }))}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent><p className="text-sm">{morPopup.message}</p></CardContent>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="min-w-0 pt-8 sm:pt-0">
                <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-1 truncate">{course.title}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">{answeredCount} / {questions.length} répondues</p>
                  {isGroupage && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs border-foreground/30"><Info className="h-3 w-3 mr-1" />Barème</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Barème Groupage</DialogTitle></DialogHeader>
                        <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">{GROUPAGE_BAREME}</pre>
                      </DialogContent>
                    </Dialog>
                  )}
                  {isElection && <Badge variant="outline" className="text-xs border-success/50 text-success">Élection : 1 bonne réponse</Badge>}
                  {isCensure && <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">Censure : 1 mauvaise réponse</Badge>}
                </div>
              </div>
              <div className="flex items-center space-x-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full self-start sm:self-auto flex-shrink-0">
                <Clock className="h-4 w-4" /><span className="font-medium text-sm">{formatTime(timeElapsed)}</span>
              </div>
            </div>
            <Progress value={progress} className="h-2 sm:h-3" />
          </div>

          {/* Questions */}
          <div className="space-y-6 mb-8">
            {questions.map((question, questionIndex) => {
              const isAnswered = selectedAnswers[questionIndex]?.length > 0;
              const isMulti = question.correct?.length > 1 && !isGroupage && !isElection && !isCensure;

              // For groupage: parse assertions from the question text
              const groupageData = isGroupage ? parseGroupageAssertions(question.question) : null;

              return (
                <Card key={question.id} className={`bg-card shadow-card border-2 transition-smooth animate-fade-in hover:shadow-medical ${isAnswered ? 'border-success/50' : 'border-border'}`}
                  style={{ animationDelay: `${Math.min(questionIndex * 0.05, 0.5)}s` }}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Badge variant={isAnswered ? "default" : "outline"} className="mb-2 text-xs">Question {questionIndex + 1}</Badge>
                        {isGroupage && groupageData ? (
                          <CardTitle className="text-base sm:text-lg leading-relaxed">{safeText(groupageData.mainQuestion)}</CardTitle>
                        ) : (
                          <CardTitle className="text-base sm:text-lg leading-relaxed">{safeText(question.question)}</CardTitle>
                        )}
                      </div>
                      {isAnswered && <CheckCircle className="h-5 w-5 text-success ml-2 flex-shrink-0 mt-1" />}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    {isGroupage && groupageData && groupageData.assertions.length > 0 ? (
                      <>
                        {/* Show numbered assertions */}
                        <div className="space-y-2 mb-4">
                          {groupageData.assertions.map((assertion, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                              <div className="w-7 h-7 rounded-lg border-2 border-foreground/30 flex items-center justify-center flex-shrink-0 font-bold text-sm text-foreground">
                                {idx + 1}
                              </div>
                              <p className="text-sm sm:text-base text-foreground leading-relaxed flex-1">{assertion}</p>
                            </div>
                          ))}
                        </div>
                        {/* Show A-E answer buttons */}
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {GROUPAGE_ANSWERS.map((letter, index) => {
                            const isSelected = selectedAnswers[questionIndex]?.includes(index) || false;
                            return (
                              <button key={index}
                                className={`p-3 sm:p-4 rounded-lg cursor-pointer transition-smooth border-2 flex items-center justify-center font-bold text-lg ${
                                  isSelected ? 'border-foreground bg-foreground text-background shadow-sm' : 'border-muted hover:border-foreground/30 hover:bg-muted/50 text-foreground'
                                }`}
                                onClick={() => handleAnswerSelect(questionIndex, index)}>
                                {letter}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      /* Standard choices for classique, election, censure, etc. */
                      <div className="space-y-2 sm:space-y-3 mb-4">
                        {question.choices?.map((choice, index) => {
                          const isSelected = selectedAnswers[questionIndex]?.includes(index) || false;
                          const letter = String.fromCharCode(65 + index);
                          return (
                            <div key={index}
                              className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg cursor-pointer transition-smooth border-2 ${
                                isSelected ? 'border-foreground bg-foreground/10 shadow-sm' : 'border-muted hover:border-foreground/30 hover:bg-muted/50'
                              }`}
                              onClick={() => handleAnswerSelect(questionIndex, index)}>
                              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                                isSelected ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/50 text-muted-foreground'
                              }`}>{letter}</div>
                              <Label className="flex-1 cursor-pointer text-foreground leading-relaxed text-sm sm:text-base">{safeText(choice)}</Label>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isMulti && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4 flex-shrink-0" /><span>Sélectionnez toutes les bonnes réponses</span></div>
                      </div>
                    )}

                    {/* Answer accordion */}
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="answer">
                        <AccordionTrigger className="text-sm hover:no-underline">
                          <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-foreground" /><span>Voir la réponse</span></div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-2 space-y-3">
                            <div className="p-4 bg-success/10 border-l-4 border-success rounded">
                              <p className="text-sm font-medium text-success mb-2">✓ Réponse correcte :</p>
                              {isGroupage ? (
                                <p className="text-2xl font-bold text-success">{GROUPAGE_ANSWERS[question.correct[0]]}</p>
                              ) : (
                                <p className="text-sm">{question.correct.map(i => `${String.fromCharCode(65 + i)}. ${safeText(question.choices[i])}`).join('\n')}</p>
                              )}
                            </div>
                            {question.explanation && (
                              <div className="p-4 bg-muted/50 rounded">
                                <p className="text-sm font-medium mb-2">Explication :</p>
                                <p className="text-sm text-muted-foreground">{safeText(question.explanation)}</p>
                              </div>
                            )}
                            <Button variant="outline" size="sm" onClick={() => openMorExplanation(question)} className="w-full border-foreground/30">
                              <MessageCircle className="h-4 w-4 mr-2" />Demander à Mor
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Submit */}
          <Card className="bg-card shadow-medical border-0 sticky bottom-4 sm:bottom-6 animate-fade-in">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-medium text-sm sm:text-base">Prêt à soumettre ?</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{answeredCount} / {questions.length} répondues</p>
                </div>
                <Button onClick={submitQuiz} disabled={answeredCount === 0} size="lg" className="bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto">
                  Soumettre <CheckCircle className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={morOpen} onOpenChange={setMorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-3">
              <div className="bg-foreground p-2 rounded-lg"><MessageCircle className="h-5 w-5 text-background" /></div>
              <div><h2 className="text-xl font-bold">Mor - Explication</h2><p className="text-sm text-muted-foreground font-normal">Je vais t'aider</p></div>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden"><AskMor embedded initialMessage={`Explique cette question:\n\n${morContext}`} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Quiz;