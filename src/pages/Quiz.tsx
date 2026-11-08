import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, 
  BookOpen, BarChart3, GraduationCap, MessageCircle, Info, X, ChevronRight, Check,
  Swords, Trophy, Users, Zap, Star, HeartPulse, Shield, CornerDownLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AskMor from "./AskMor";
import { safeText, safeTextArray } from "@/lib/textUtils";
import { useGamificationContext } from "@/components/gamification/GamificationProvider";
import { ShareResults } from "@/components/ShareResults";
import { shuffleQuiz } from "@/lib/quizShuffle";
import { motion, AnimatePresence } from "framer-motion";
import { uiAudio } from "@/utils/audio";
import { cn } from "@/lib/utils";

interface MorPopup { message: string; type: "encouragement" | "celebration" | "tip"; visible: boolean; }
interface Question { id?: string; question: string; choices: string[]; correct: number[]; explanation?: string; }
interface Course { id: string; courseId: string; title: string; questions: Question[]; fileName?: string; questionCount?: number; questionType?: string; aiModel?: string; metadata?: any; createdAt: string; }

export interface QuizOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  explanation?: string;
  subject?: string;
  qcmType?: string;
  stemBlocks?: any[];
  [key: string]: any;
}

export interface QuizDeck {
  id: string;
  title: string;
  subject: string;
  questions: QuizQuestion[];
  createdAt?: string;
  qcmFormat?: string;
  difficulty?: string;
  [key: string]: any;
}

export function getSavedQuizDecks(): QuizDeck[] {
  try {
    const raw = localStorage.getItem("hippocampus_saved_quizzes") || localStorage.getItem("dawjang_user_quizzes_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      const qList = item.questions || item.quiz?.questions || [];
      return {
        id: String(item.id || `deck-${Date.now()}`),
        title: String(item.title || "QCM Sauvegardé"),
        subject: String(item.subject || "Médecine"),
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        questions: qList.map((q: any, qIdx: number) => {
          const rawChoices = q.choices || q.options || [];
          const correctAnswers = Array.isArray(q.correct) ? q.correct : [0];
          return {
            id: String(q.id || `q-${qIdx}`),
            question: String(q.question || `Question ${qIdx + 1}`),
            explanation: q.explanation || "",
            subject: q.subject || item.subject || "Médecine",
            options: rawChoices.map((c: any, cIdx: number) => {
              const label = String.fromCharCode(65 + cIdx);
              if (typeof c === "object" && c !== null) {
                return {
                  id: String(c.id || label),
                  label: String(c.label || label),
                  text: String(c.text || c.label || ""),
                  isCorrect: Boolean(c.isCorrect ?? correctAnswers.includes(cIdx)),
                };
              }
              return {
                id: label,
                label,
                text: String(c),
                isCorrect: correctAnswers.includes(cIdx),
              };
            }),
          };
        }),
      };
    });
  } catch (e) {
    console.error("Erreur lecture saved quiz decks:", e);
    return [];
  }
}

const GROUPAGE_BAREME = `Barème de réponses (Groupage) :\nA = 1 + 2 + 3 sont vraies\nB = 1 et 3 seulement sont vraies\nC = 2 et 4 sont les seules justes\nD = 4 uniquement est juste\nE = Autre combinaison`;
const GROUPAGE_ANSWERS = ["A", "B", "C", "D", "E"];

const Quiz = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number[] }>({});
  const [showResults, setShowResults] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [morOpen, setMorOpen] = useState(false);
  const [morContext, setMorContext] = useState<string>("");
  const [morPopup, setMorPopup] = useState<MorPopup>({ message: "", type: "encouragement", visible: false });
  const [expandedAnswers, setExpandedAnswers] = useState<{ [key: number]: boolean }>({});
  const { recordQuizCompletion } = useGamificationContext();

  // Gamification & Carousel States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [scoreELO, setScoreELO] = useState(2150);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const loadQuizSession = async () => {
      // 1. Si un QCM ciblé (ex: issu de la stratégie Drive anti-pièges) a été transmis
      const state = location.state as any;
      if (state?.targetedQcm && Array.isArray(state.targetedQcm) && state.targetedQcm.length > 0) {
        const letters = ["A", "B", "C", "D", "E"];
        const targetedQuestions: Question[] = state.targetedQcm.map((tq: any, idx: number) => {
          const rawChoices = Array.isArray(tq.options) ? tq.options : [];
          const correctIndices: number[] = [];
          if (Array.isArray(tq.reponses_exactes)) {
            tq.reponses_exactes.forEach((l: string) => {
              const pos = letters.indexOf(String(l).trim().toUpperCase());
              if (pos >= 0) correctIndices.push(pos);
            });
          }
          return {
            id: `tq-${idx}`,
            question: safeText(tq.question, `Question ciblée #${idx + 1}`),
            choices: rawChoices.map((c: string) =>
              safeText(String(c).replace(/^[A-E][\.\)\-\s]+/i, "").trim(), "")
            ),
            correct: correctIndices.length > 0 ? correctIndices : [0],
            explanation: safeText(
              tq.explication_anti_piege,
              "Correction basée sur les annales et pièges du cours."
            ),
          };
        });
        setCourse({
          id: `targeted-${Date.now()}`,
          courseId: `targeted-${Date.now()}`,
          title: `QCM Anti-Pièges · ${state.subject || "Médecine"}`,
          questions: targetedQuestions,
          createdAt: new Date().toISOString(),
        });
        setQuestions(targetedQuestions);
        return;
      }

      if (!courseId) {
        navigate("/qcm", { replace: true });
        return;
      }
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
            lockOrder: q.lockOrder,
            lockChoices: q.lockChoices,
          }));
          const isExamCloning = sessionData.question_type === "clonage_examen" || sessionData.metadata?.mode === "exam_clone";
          const shuffled = shuffleQuiz(rawQuestions, isExamCloning);
          setQuestions(shuffled);
        } else { toast({ title: "Aucune question disponible", variant: "destructive" }); navigate("/quiz-library"); }
      } catch { toast({ title: "Erreur de chargement", variant: "destructive" }); navigate("/quiz-library"); }
    };
    loadQuizSession();
  }, [courseId, navigate, toast]);

  useEffect(() => {
    if (!showResults) { const timer = setInterval(() => setTimeElapsed(prev => prev + 1), 1000); return () => clearInterval(timer); }
  }, [showResults]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (showExplanation) return;
    uiAudio.playSoftClick();
    const qType = course?.questionType;
    if (qType === "election" || qType === "censure" || qType === "groupage") {
      setSelectedAnswers(prev => ({ ...prev, [currentIndex]: [answerIndex] }));
    } else {
      setSelectedAnswers(prev => {
        const current = prev[currentIndex] || [];
        const newAnswers = current.includes(answerIndex) ? current.filter(i => i !== answerIndex) : [...current, answerIndex];
        return { ...prev, [currentIndex]: newAnswers };
      });
    }
  };

  const submitAnswer = () => {
    const currentSel = selectedAnswers[currentIndex] || [];
    if (currentSel.length === 0) return;
    
    setShowExplanation(true);
    const question = questions[currentIndex];
    const isCorrect = currentSel.length === question.correct.length && currentSel.every(a => question.correct.includes(a));
    
    if (isCorrect) {
      uiAudio.playSuccessChime();
      setStreak(prev => prev + 1);
      setScoreELO(prev => prev + 25);
      sonnerToast.success("Justesse Clinique !", {
        description: "+25 ELO. Votre raisonnement est solide.",
        icon: <Trophy className="h-5 w-5 text-amber-500" />
      });
    } else {
      uiAudio.playError();
      setStreak(0);
      setScoreELO(prev => prev - 15);
      sonnerToast.error("Erreur de Diagnostic.", {
        description: "-15 ELO. L'analyse de l'Agent MOR est recommandée."
      });
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      const sel = selectedAnswers[index] || [];
      if (sel.length === question.correct.length && sel.every(a => question.correct.includes(a))) correct++;
    });
    return { correct, total: questions.length };
  };

  const submitQuiz = async () => {
    uiAudio.playSuccessChime();
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
          sonnerToast.success("Résultats sauvegardés avec succès.");
        }
      }
    } catch (error) { console.error("Error saving:", error); }

    const percentage = (correct / total) * 100;
    const popupMessage = percentage >= 80 ? "Diagnostic parfait, excellent raisonnement clinique !" : percentage >= 60 ? "Solide, mais des détails vous échappent." : percentage >= 40 ? "Des révisions approfondies sont nécessaires." : "Alerte Rouge. Reprenez le cours d'urgence.";
    const popupType = percentage >= 80 ? "celebration" : percentage >= 40 ? "encouragement" : "tip";
    setMorPopup({ message: popupMessage, type: popupType as any, visible: true });
    setTimeout(() => setMorPopup(prev => ({ ...prev, visible: false })), 6000);
    setShowResults(true);
  };

  const goToNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
    } else {
      submitQuiz();
    }
  };

  const openMorExplanation = (question: Question) => {
    const context = `Question: ${question.question}\n\nChoix:\n${question.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nRéponse(s): ${question.correct.map(i => question.choices[i]).join(', ')}\n\nExplication: ${question.explanation}`;
    setMorContext(context);
    setMorOpen(true);
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const parseGroupageAssertions = (questionText: string): { mainQuestion: string; assertions: string[] } => {
    const lines = questionText.split('\n');
    const assertions: string[] = [];
    const mainLines: string[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\.\s*(.+)/);
      if (match) assertions.push(match[2]);
      else if (line.trim()) mainLines.push(line.trim());
    }
    return { mainQuestion: mainLines.join(' '), assertions };
  };

  if (!course || questions.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-[#5B21B6]/20 rounded-full animate-ping" />
          <Brain className="h-12 w-12 text-[#5B21B6] relative z-10 animate-pulse" />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-[#888888]">Génération de l'Épreuve...</p>
      </div>
    );
  }

  const isGroupage = course?.questionType === "groupage";
  const isElection = course?.questionType === "election";
  const isCensure = course?.questionType === "censure";
  
  if (showResults) {
    const { correct, total } = calculateScore();
    const percentage = Math.round((correct / total) * 100);
    const isSuccess = percentage >= 60;

    return (
      <div className="min-h-screen bg-transparent text-[#111111] dark:text-white font-sans py-12 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl w-full mx-auto px-6">
          <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 shadow-2xl rounded-[3rem] p-10 md:p-16 relative overflow-hidden text-center">
            <div className={`absolute top-0 left-0 right-0 h-3 ${isSuccess ? "bg-emerald-500" : "bg-rose-500"}`} />
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-8 ${isSuccess ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
              {isSuccess ? <CheckCircle2 className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-tighter mb-4">Bilan de l'Épreuve</h1>
            <p className="text-[#888888] font-medium text-lg mb-12">{course.title}</p>
            <div className="grid grid-cols-3 gap-4 md:gap-8 mb-12">
              <div className="bg-transparent border border-black/5 dark:border-white/5 rounded-2xl p-6">
                <p className="text-4xl font-light text-emerald-500">{correct}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">Correctes</p>
              </div>
              <div className="bg-transparent border border-black/5 dark:border-white/5 rounded-2xl p-6">
                <p className="text-4xl font-light text-rose-500">{total - correct}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">Erreurs</p>
              </div>
              <div className="bg-transparent border border-black/5 dark:border-white/5 rounded-2xl p-6">
                <p className="text-4xl font-light text-[#111111] dark:text-white">{formatTime(timeElapsed)}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">Chrono</p>
              </div>
            </div>
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <span className="text-sm font-bold uppercase tracking-widest text-[#111111] dark:text-white">Score Global</span>
                <span className={`text-4xl font-black ${isSuccess ? "text-emerald-500" : "text-rose-500"}`}>{percentage}%</span>
              </div>
              <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full ${isSuccess ? "bg-emerald-500" : "bg-rose-500"}`} />
              </div>
            </div>
            <ShareResults score={correct} total={total} title={course.title} />
            <div className="grid sm:grid-cols-2 gap-4 mt-12">
              <Button onClick={() => window.location.reload()} className="h-14 rounded-full bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 text-[#111111] dark:text-white font-bold uppercase tracking-widest text-xs hover:bg-[#FAFAF8] dark:hover:bg-[#0E0E0C] transition-all">
                Refaire l'Épreuve
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="h-14 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] transition-all shadow-xl">
                Quitter l'arène
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const groupageData = isGroupage ? parseGroupageAssertions(currentQuestion.question) : null;
  const isMulti = currentQuestion.correct?.length > 1 && !isGroupage && !isElection && !isCensure;
  
  // Calculate active progress metrics
  let currentCorrect = 0;
  let currentIncorrect = 0;
  for (let i = 0; i < currentIndex; i++) {
    const sel = selectedAnswers[i] || [];
    const q = questions[i];
    const isC = sel.length === q.correct.length && sel.every(a => q.correct.includes(a));
    if (isC) currentCorrect++;
    else currentIncorrect++;
  }
  if (showExplanation) {
    const sel = selectedAnswers[currentIndex] || [];
    const q = questions[currentIndex];
    const isC = sel.length === q.correct.length && sel.every(a => q.correct.includes(a));
    if (isC) currentCorrect++;
    else currentIncorrect++;
  }

  const cardVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
  const morVariants = { hidden: { x: "100%" }, visible: { x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } } };

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans selection:bg-[#5B21B6]/30 transition-colors duration-500">
      
      {/* ─── INJECTION CSS POUR LA VAGUE ANIMÉE (Niveau 40/40) ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes nebula-wave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-nebula-header {
          /* Dégradé mouvant : Noir profond, Violet Hippocampus, Rose Magenta, Noir */
          background: linear-gradient(-45deg, #050505, #5B21B6, #EC4899, #050505);
          background-size: 300% 300%;
          animation: nebula-wave 12s ease infinite;
        }
      `}} />

      {/* ─── HEADER FIXE (La Nébuleuse Animée) ─── */}
      <div className="sticky top-0 z-50 bg-nebula-header shadow-[0_10px_30px_-10px_rgba(91,33,182,0.4)] border-b border-white/10">
        <div className="max-w-[1500px] mx-auto px-6 h-24 flex items-center justify-between">
          
          {/* Section Gauche : Logo & Titre (En blanc pour le contraste) */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-inner">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">QCM Arena.</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70 max-w-[200px] md:max-w-[400px] truncate">{course.title}</p>
            </div>
          </div>

          {/* Section Droite : Statistiques & Action */}
          <div className="flex items-center gap-6">
            
            {/* Le bloc Stats en Verre Sablé (Contraste parfait avec la vague) */}
            <div className="hidden md:flex items-center gap-8 px-8 py-3 bg-white/15 backdrop-blur-2xl rounded-full border border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <div className="text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/70 drop-shadow-sm">Score ELO</span>
                <p className="text-xl font-medium tracking-tight text-white drop-shadow-md">{scoreELO}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/70 drop-shadow-sm">Série</span>
                <p className="text-xl font-medium tracking-tight text-emerald-400 drop-shadow-md flex items-center justify-center gap-1">
                  {streak}<Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                </p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/70 drop-shadow-sm">Chrono</span>
                <p className="text-xl font-mono font-medium tracking-tight text-white drop-shadow-md">{formatTime(timeElapsed)}</p>
              </div>
            </div>
            
            {/* Le Bouton Soumettre : Blanc pur massif (Luxe et Lisibilité) */}
            {showExplanation ? (
              <button 
                onClick={goToNextQuestion}
                className="h-14 px-10 rounded-full bg-white text-[#111111] font-black uppercase tracking-widest text-xs hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                {currentIndex < questions.length - 1 ? "Question Suivante" : "Terminer"}
              </button>
            ) : (
              <button 
                onClick={submitAnswer} 
                disabled={!(selectedAnswers[currentIndex]?.length > 0)}
                className="h-14 px-10 rounded-full bg-white text-[#111111] font-black uppercase tracking-widest text-xs hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100"
              >
                Soumettre
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── LE COEUR DE LA PAGE (Structure Volumétrique) ─── */}
      <div className="max-w-[1500px] mx-auto px-6 pt-36 pb-40 grid lg:grid-cols-12 gap-10 items-start relative z-10">
        
        {/* =========================================================
            COLONNE GAUCHE (8/12) : LA CARTE QCM (Cadrage Bleu-Violet)
            ========================================================= */}
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-8 bg-white dark:bg-[#161614] border-[1.5px] border-indigo-500/30 dark:border-indigo-500/40 rounded-[3rem] p-10 md:p-14 shadow-[0_20px_80px_-15px_rgba(99,102,241,0.08)] dark:shadow-[0_20px_80px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Filigrane de spécialité en arrière-plan */}
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] dark:opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <HeartPulse className="w-64 h-64 text-[#111111] dark:text-white" />
          </div>

          <div className="relative z-10">
            
            {/* Barre supérieure de navigation rapide & progression (Vert = Trouvée, Rouge = Fausse, Terracotta = En cours) */}
            <div className="flex items-center gap-2 flex-wrap mb-6 pb-4 border-b border-black/5 dark:border-white/5">
              {questions.map((_, qIdx) => {
                const isCurr = qIdx === currentIndex;
                const isAnswered = Boolean(selectedAnswers[qIdx] && selectedAnswers[qIdx].length > 0);
                const correctList = questions[qIdx]?.correct || [];
                const userList = selectedAnswers[qIdx] || [];
                const isExact =
                  correctList.length > 0 &&
                  correctList.length === userList.length &&
                  correctList.every((c) => userList.includes(c));

                let pillClass = "bg-muted/70 text-foreground/80 border-border hover:border-primary/40";
                if (isAnswered) {
                  if (isExact) {
                    pillClass = isCurr
                      ? "bg-emerald-600 text-white border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/30 scale-110 font-black"
                      : "bg-emerald-500 text-white border border-emerald-600 shadow-sm hover:bg-emerald-600 font-extrabold";
                  } else {
                    pillClass = isCurr
                      ? "bg-rose-600 text-white border-2 border-rose-500 shadow-md ring-4 ring-rose-500/30 scale-110 font-black"
                      : "bg-rose-500 text-white border border-rose-600 shadow-sm hover:bg-rose-600 font-extrabold";
                  }
                } else if (isCurr) {
                  pillClass =
                    "bg-indigo-600 text-white border-2 border-indigo-700 shadow-md ring-4 ring-indigo-500/25 scale-110 font-black";
                }

                return (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(qIdx);
                      setShowExplanation(Boolean(selectedAnswers[qIdx] && selectedAnswers[qIdx].length > 0));
                    }}
                    className={`w-9 h-9 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center relative border ${pillClass}`}
                    title={
                      isAnswered
                        ? isExact
                          ? `Question ${qIdx + 1} : Réponse exacte (Trouvée)`
                          : `Question ${qIdx + 1} : Réponse fausse (Ratée)`
                        : `Question ${qIdx + 1}`
                    }
                  >
                    {qIdx + 1}
                  </button>
                );
              })}
            </div>

            {/* L'En-tête de la Question */}
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-black/5 dark:border-white/5">
              {/* Le Badge Bleu-Violet Massif */}
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white bg-indigo-600 px-5 py-2.5 rounded-xl shadow-md">
                Question {currentIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                {isMulti && <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] border border-[#5B21B6]/20 bg-[#5B21B6]/5 px-3 py-1.5 rounded-xl">Multiples</span>}
                {isGroupage && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 rounded-xl">Groupage</span>}
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Niveau : {course.metadata?.difficulty || "Intermédiaire"}
                  </span>
                </div>
              </div>
            </div>

            {/* Texte de la Question - Grandiose et Imposant */}
            <h2 className="text-3xl md:text-4xl font-serif text-[#111111] dark:text-white leading-[1.6] mb-14">
              {isGroupage && groupageData ? safeText(groupageData.mainQuestion) : safeText(currentQuestion.question)}
            </h2>

            {/* Groupage Assertions */}
            {isGroupage && groupageData && groupageData.assertions.length > 0 && (
                <div className="space-y-4 mb-10">
                  {groupageData.assertions.map((assertion, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-5 rounded-2xl bg-transparent border border-black/5 dark:border-white/5">
                      <div className="h-7 w-7 shrink-0 rounded-full border border-black/20 dark:border-white/20 flex items-center justify-center text-[10px] font-bold text-[#888888]">
                        {idx + 1}
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-[#111111] dark:text-white">{assertion}</p>
                    </div>
                  ))}
                </div>
            )}

            {/* Corps des Choix (Mécaniques et Tactiles) */}
            {isGroupage && groupageData && groupageData.assertions.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {GROUPAGE_ANSWERS.map((letter, index) => {
                    const isSelected = selectedAnswers[currentIndex]?.includes(index);
                    const isCorrect = currentQuestion.correct.includes(index);
                    
                    let choiceStyle = "border-black/10 dark:border-white/10 bg-transparent hover:border-[#111111] dark:hover:border-white/40 text-[#111111] dark:text-[#F4F4F2]";
                    if (isSelected) choiceStyle = "border-indigo-600 bg-indigo-600 text-white shadow-lg";
                    
                    if (showExplanation) {
                      if (isCorrect) choiceStyle = "border-emerald-500 bg-emerald-500 text-white";
                      else if (isSelected) choiceStyle = "border-rose-500 bg-rose-500/90 text-white opacity-70";
                      else choiceStyle = "border-black/5 dark:border-white/5 bg-transparent opacity-40";
                    }

                    return (
                      <motion.button 
                        key={index}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAnswerSelect(index)}
                        className={`h-16 flex-1 min-w-[60px] rounded-2xl border-[1.5px] font-bold text-xl transition-all duration-300 outline-none ${choiceStyle}`}
                      >
                        {letter}
                      </motion.button>
                    );
                  })}
                </div>
            ) : (
                <div className="space-y-5">
                {currentQuestion.choices.map((choice, index) => {
                    const isSelected = selectedAnswers[currentIndex]?.includes(index);
                    const isCorrect = currentQuestion.correct.includes(index);
                    
                    let choiceStyle = "border-black/10 dark:border-white/10 bg-transparent hover:border-[#111111] dark:hover:border-white/40 text-[#111111] dark:text-[#F4F4F2]";
                    let letterStyle = "border-black/20 dark:border-white/20 text-[#888888]";

                    if (isSelected) {
                        choiceStyle = "border-indigo-600 bg-indigo-600/5 dark:bg-indigo-600/10";
                        letterStyle = "border-indigo-600 bg-indigo-600 text-white";
                    }
                    
                    if (showExplanation) {
                        if (isCorrect) {
                            choiceStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                            letterStyle = "border-emerald-500 bg-emerald-500 text-white";
                        } else if (isSelected) {
                            choiceStyle = "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 opacity-70";
                            letterStyle = "border-rose-500 bg-rose-500 text-white";
                        } else {
                            choiceStyle = "border-black/5 dark:border-white/5 bg-transparent opacity-40";
                        }
                    }

                    return (
                    <motion.button
                        key={index}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAnswerSelect(index)}
                        className={`w-full text-left p-6 rounded-2xl border-[1.5px] transition-all duration-300 flex items-start gap-6 outline-none shadow-sm hover:shadow-md ${choiceStyle}`}
                    >
                        <div className={`h-10 w-10 shrink-0 rounded-xl border-[1.5px] flex items-center justify-center text-xl font-bold transition-all duration-300 mt-0.5 ${letterStyle}`}>
                        {String.fromCharCode(65 + index)}
                        </div>
                        <span className="text-lg font-medium leading-relaxed pt-1 flex-1">
                        {safeText(choice)}
                        </span>
                        {showExplanation && isCorrect && <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-3" />}
                        {showExplanation && isSelected && !isCorrect && <X className="h-6 w-6 text-rose-500 mt-3" />}
                    </motion.button>
                    );
                })}
                </div>
            )}

            <AnimatePresence>
              {showExplanation && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-12 pt-10 border-t border-black/5 dark:border-white/5"
                >
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-transparent border border-black/5 dark:border-white/5 rounded-full p-2 pl-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Justification Clinique</span>
                        <div className="flex gap-1.5">
                            <span className="px-3 py-1 bg-white dark:bg-[#161614] shadow-sm rounded-md text-[9px] font-black uppercase tracking-widest text-[#111111] dark:text-white">Confiance: 5/5 ⭐</span>
                        </div>
                    </div>
                    
                    <div className="font-serif text-lg leading-relaxed text-[#111111] dark:text-[#F4F4F2]">
                      {currentQuestion.explanation ? safeText(currentQuestion.explanation) : "L'IA n'a pas fourni d'explication détaillée pour cette question."}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>

        {/* =========================================================
            COLONNE DROITE (4/12) : L'AGENT MOR ET LE BILAN
            ========================================================= */}
        <div className="lg:col-span-4 space-y-8 sticky top-36">
          
          {/* L'AGENT MOR (Design Purifié) */}
          <div className="bg-white dark:bg-[#161614] border-[1.5px] border-black/5 dark:border-white/5 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group hover:border-[#5B21B6]/30 transition-colors duration-500">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Brain className="h-14 w-14 text-[#5B21B6] mb-6 drop-shadow-sm" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#111111] dark:text-white mb-2">Agent MOR (AI)</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#888888] mb-8">Supervision Clinique Active</p>
              
              <AnimatePresence mode="wait">
                {showExplanation ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                        <button 
                            onClick={() => openMorExplanation(currentQuestion)}
                            className="w-full flex justify-between items-center p-5 bg-transparent rounded-2xl border-[1.5px] border-black/5 dark:border-white/5 hover:border-[#5B21B6] hover:bg-[#5B21B6]/5 group transition-colors shadow-sm"
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" /> Décortiquer la réponse
                            </span>
                            <ChevronRight className="h-4 w-4 text-[#888888] group-hover:text-[#5B21B6] transition-colors" />
                        </button>
                    </motion.div>
                ) : (
                    <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col gap-4">
                        <div className="w-full h-2 bg-transparent rounded-full overflow-hidden shadow-inner border border-black/5 dark:border-white/5">
                            <motion.div className="h-full bg-[#5B21B6]" initial={{ width: 0 }} animate={{ width: (selectedAnswers[currentIndex]?.length > 0) ? "100%" : "30%" }} transition={{ duration: 1.5 }}/>
                        </div>
                        <p className="text-xs font-medium text-[#666666] dark:text-[#8E8E8A]">L'Agent MOR analyse votre raisonnement thérapeutique...</p>
                    </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* BILAN DE SESSION */}
          <div className="bg-white dark:bg-[#161614] border-[1.5px] border-black/5 dark:border-white/5 rounded-[2.5rem] p-10 shadow-sm">
             <h3 className="text-sm font-bold text-[#111111] dark:text-white flex items-center gap-3 mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                 <GraduationCap className="h-5 w-5 text-[#888888]" /> Bilan de Session
             </h3>
             
             <div className="space-y-8">
                 <div>
                     <div className="flex justify-between items-end mb-4">
                         <span className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Progression</span>
                         <p className="text-2xl font-light tracking-tighter">{currentIndex + (showExplanation ? 1 : 0)} <span className="text-[11px] font-bold uppercase text-[#888888]">/ {questions.length}</span></p>
                     </div>
                     <Progress value={((currentIndex + (showExplanation ? 1 : 0)) / questions.length) * 100} className="h-1.5 w-full bg-transparent [&>div]:bg-[#111111] dark:[&>div]:bg-white" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-transparent border border-black/5 dark:border-white/5 rounded-2xl flex flex-col justify-center">
                         <span className="text-4xl font-light tracking-tighter text-emerald-500 mb-1">{currentCorrect}</span>
                         <span className="text-[9px] font-black uppercase tracking-widest text-[#888888]">Réponses Justes</span>
                     </div>
                     <div className="p-4 bg-transparent border border-black/5 dark:border-white/5 rounded-2xl flex flex-col justify-center">
                         <span className="text-4xl font-light tracking-tighter text-rose-500 mb-1">{currentIncorrect}</span>
                         <span className="text-[9px] font-black uppercase tracking-widest text-[#888888]">Erreurs</span>
                     </div>
                 </div>
             </div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {morOpen && (
          <motion.div 
            variants={morVariants} initial="hidden" animate="visible" exit="hidden"
            className="fixed top-0 bottom-0 right-0 z-[200] w-full sm:max-w-lg bg-transparent border-l-[1.5px] border-black/10 dark:border-white/10 shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b-[1.5px] border-black/5 dark:border-white/5 bg-white dark:bg-[#161614] shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-[#111111] dark:text-white flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-[#5B21B6]" /> Analyse Morphologique
                    </h2>
                    <button onClick={() => setMorOpen(false)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#888888] transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Discussion avec l'Agent MOR - Justification du QCM ID {currentIndex + 1}</p>
            </div>
            
            <div className="flex-1 overflow-hidden p-6 editorial-scrollbar bg-transparent">
                <AskMor initialMessage={`Analyse cliniquement l'explication suivante du QCM :\n\n${morContext}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Quiz;