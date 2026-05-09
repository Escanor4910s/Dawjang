import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Brain, Clock, CheckCircle, XCircle, AlertCircle, Timer,
  Maximize, ChevronLeft, ChevronRight, Ban, Eye, EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { safeText, safeTextArray } from "@/lib/textUtils";
import { useGamificationContext } from "@/components/gamification/GamificationProvider";
import { shuffleQuiz } from "@/lib/quizShuffle";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  id?: string;
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
}

const ExamMode = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { recordQuizCompletion } = useGamificationContext();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [actualCourseId, setActualCourseId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number[] }>({});
  const [locked, setLocked] = useState<{ [key: number]: boolean }>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState<number[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Load session
  useEffect(() => {
    const load = async () => {
      if (!courseId) { navigate("/quiz-library"); return; }
      const { data, error } = await supabase
        .from("qcm_sessions")
        .select("*, courses(id, title)")
        .eq("id", courseId)
        .single();

      if (error || !data) {
        toast({ title: "Session introuvable", variant: "destructive" });
        navigate("/quiz-library");
        return;
      }

      const raw = (data.questions as any[]).map((q: any, i: number) => ({
        id: q.id || String(i),
        question: safeText(q.question, `Question ${i + 1}`),
        choices: safeTextArray(q.choices || [], ""),
        correct: Array.isArray(q.correct) ? q.correct.map((c: any) => typeof c === 'number' ? c : parseInt(String(c), 10) || 0) : [0],
        explanation: safeText(q.explanation, ""),
      }));

      // Fisher-Yates shuffle questions AND choices
      const qs = shuffleQuiz(raw);
      setQuestions(qs);
      setSessionTitle(data.title);
      setActualCourseId(data.course_id);
      // 2 minutes per question
      const total = qs.length * 120;
      setTimeLeft(total);
      setTotalTime(total);
      setTimePerQuestion(new Array(qs.length).fill(0));
      setLoading(false);
    };
    load();
  }, [courseId]);

  // Timer
  useEffect(() => {
    if (loading || showResults || isPaused) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, showResults, isPaused]);

  // Track time per question
  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [currentIndex]);

  const recordQuestionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setTimePerQuestion(prev => {
      const copy = [...prev];
      copy[currentIndex] = (copy[currentIndex] || 0) + elapsed;
      return copy;
    });
  }, [currentIndex, questionStartTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (locked[currentIndex]) return;
    setSelectedAnswers(prev => {
      const current = prev[currentIndex] || [];
      const updated = current.includes(answerIndex)
        ? current.filter(i => i !== answerIndex)
        : [...current, answerIndex];
      return { ...prev, [currentIndex]: updated };
    });
  };

  const lockAnswer = () => {
    setLocked(prev => ({ ...prev, [currentIndex]: true }));
    recordQuestionTime();
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      if (!locked[currentIndex]) recordQuestionTime();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    recordQuestionTime();
    setShowResults(true);
    if (document.fullscreenElement) document.exitFullscreen();

    const { correct, total } = calcScore();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && courseId) {
        const answersData = questions.map((q, i) => ({
          question: q.question,
          userAnswer: (selectedAnswers[i] || []).map(j => q.choices[j]).join(", "),
          correctAnswer: q.correct.map(j => q.choices[j]).join(", "),
          correct: (selectedAnswers[i] || []).length === q.correct.length &&
                   (selectedAnswers[i] || []).every(a => q.correct.includes(a)),
          timeSpent: timePerQuestion[i] || 0,
        }));

        await supabase.from("qcm_sessions").update({
          status: "completed", score: correct, total_questions: total,
          answers: answersData, time_elapsed: totalTime - timeLeft,
          completed_at: new Date().toISOString(),
          metadata: { exam_mode: true, time_per_question: timePerQuestion },
        }).eq("id", courseId);

        await supabase.from("quiz_results").insert({
          user_id: user.id, course_id: actualCourseId,
          score: correct, total_questions: total, answers: answersData,
        });

        try { await recordQuizCompletion(correct, total); } catch {}
      }
    } catch (e) { console.error(e); }
  };

  const calcScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      const sel = selectedAnswers[i] || [];
      if (sel.length === q.correct.length && sel.every(a => q.correct.includes(a))) correct++;
    });
    return { correct, total: questions.length };
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Brain className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (showResults) {
    const { correct, total } = calcScore();
    const pct = Math.round((correct / total) * 100);
    const avgTime = timePerQuestion.reduce((a, b) => a + b, 0) / questions.length;

    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="text-center">
                <div className={`mx-auto p-4 rounded-full w-20 h-20 mb-4 ${pct >= 70 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-destructive'}`}>
                  {pct >= 70 ? <CheckCircle className="h-12 w-12 text-success-foreground" /> : <XCircle className="h-12 w-12 text-destructive-foreground" />}
                </div>
                <CardTitle className="text-2xl">Mode Examen terminé</CardTitle>
                <p className="text-muted-foreground">{sessionTitle}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold text-primary">{pct}%</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold text-success">{correct}/{total}</p>
                    <p className="text-xs text-muted-foreground">Correctes</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{formatTime(totalTime - timeLeft)}</p>
                    <p className="text-xs text-muted-foreground">Temps total</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{Math.round(avgTime)}s</p>
                    <p className="text-xs text-muted-foreground">Moy./question</p>
                  </div>
                </div>

                {/* Time per question breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Temps par question</h3>
                  <div className="space-y-2">
                    {questions.map((q, i) => {
                      const sel = selectedAnswers[i] || [];
                      const isCorrect = sel.length === q.correct.length && sel.every(a => q.correct.includes(a));
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-6 text-muted-foreground">Q{i + 1}</span>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${isCorrect ? 'bg-success' : 'bg-destructive'}`}
                              style={{ width: `${Math.min(100, ((timePerQuestion[i] || 0) / 120) * 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-muted-foreground">{timePerQuestion[i] || 0}s</span>
                          {isCorrect ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => navigate("/quiz-library")} className="flex-1">
                    Retour aux QCM
                  </Button>
                  <Button onClick={() => navigate("/dashboard")} className="flex-1">
                    Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const isMultiple = question.correct.length > 1;
  const isLocked = locked[currentIndex];
  const answeredCount = Object.keys(locked).length;
  const timerPct = (timeLeft / totalTime) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Exam Header - Mobile optimized */}
      <div className="sticky top-0 z-50 bg-card border-b border-border px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">
              <Timer className="h-3 w-3 mr-1" /> EXAMEN
            </Badge>
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline truncate">{sessionTitle}</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <div className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-mono font-bold ${
              timeLeft < 60 ? 'bg-destructive/10 text-destructive animate-pulse' :
              timeLeft < 300 ? 'bg-warning/10 text-warning' : 'bg-muted text-foreground'
            }`}>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsPaused(!isPaused)} className="h-8 w-8 p-0">
              {isPaused ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="h-8 w-8 p-0 hidden sm:flex">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={timerPct} className="h-1 mt-2" />
      </div>

      {/* Pause overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/95 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-2xl font-bold mb-4">Examen en pause</p>
              <Button onClick={() => setIsPaused(false)} size="lg">Reprendre</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question */}
      <div className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        {/* Question navigator - scrollable on mobile */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-4 sm:mb-6 max-h-24 overflow-y-auto">
          {questions.map((_, i) => (
            <button
              key={i}
              disabled={i > currentIndex && !locked[currentIndex]}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-[10px] sm:text-xs font-medium transition-colors ${
                i === currentIndex ? 'bg-primary text-primary-foreground' :
                locked[i] ? 'bg-success/20 text-success' :
                'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Question {currentIndex + 1} / {questions.length}</Badge>
                  {isMultiple && (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" /> Choix multiples
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-3 leading-relaxed">{question.question}</CardTitle>
              </CardHeader>
               <CardContent className="space-y-2 sm:space-y-3">
                {question.choices.map((choice, idx) => {
                  const isSelected = selectedAnswers[currentIndex]?.includes(idx);
                  return (
                    <button
                      key={idx}
                      disabled={isLocked}
                      onClick={() => handleAnswerSelect(idx)}
                      className={`w-full text-left flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 transition-all text-sm sm:text-base ${
                        isLocked
                          ? question.correct.includes(idx)
                            ? 'border-success bg-success/10'
                            : isSelected
                              ? 'border-destructive bg-destructive/10'
                              : 'border-muted'
                          : isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 ${isMultiple ? 'rounded-sm' : 'rounded-full'} border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
                      }`}>
                        {isSelected && <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isMultiple ? 'rounded-sm' : 'rounded-full'} bg-primary-foreground`} />}
                      </div>
                      <Label className="cursor-pointer flex-1 leading-relaxed">{choice}</Label>
                      {isLocked && question.correct.includes(idx) && <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />}
                      {isLocked && isSelected && !question.correct.includes(idx) && <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />}
                    </button>
                  );
                })}

                {isLocked && question.explanation && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-4 bg-muted/50 rounded-lg mt-4">
                    <p className="text-sm font-medium mb-1">Explication :</p>
                    <p className="text-sm text-muted-foreground">{question.explanation}</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation - Mobile optimized */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-4 sm:mt-6 gap-3">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            {answeredCount} / {questions.length} verrouillées
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {!isLocked && (selectedAnswers[currentIndex]?.length || 0) > 0 && (
              <Button onClick={lockAnswer} variant="secondary" className="flex-1 sm:flex-none">
                <Ban className="h-4 w-4 mr-2" /> Verrouiller
              </Button>
            )}
            {currentIndex < questions.length - 1 ? (
              <Button onClick={goNext} className="flex-1 sm:flex-none">
                Suivante <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-success hover:bg-success/90 text-success-foreground flex-1 sm:flex-none">
                Terminer l'examen
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamMode;
