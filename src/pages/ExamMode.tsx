import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Brain, Clock, CheckCircle, XCircle, AlertCircle, Timer,
  Maximize, ChevronLeft, ChevronRight, Ban, Eye, EyeOff,
  ShieldAlert, CheckCircle2, HeartPulse, LayoutGrid
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

  const changeQuestion = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < questions.length) {
      recordQuestionTime();
      setCurrentIndex(newIndex);
    }
  };

  const question = questions[currentIndex];
  if (!question) return null;
  const isMultiple = question.correct && question.correct.length > 1;
  const answeredCount = Object.keys(selectedAnswers).filter(k => selectedAnswers[parseInt(k, 10)]?.length > 0).length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const timeElapsed = totalTime - Math.max(0, timeLeft);

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0A0A0A] text-[#111111] dark:text-[#F4F4F2] font-sans selection:bg-[#5B21B6]/30 transition-colors duration-500">
      
      {/* ─── INJECTION CSS : VAGUE NÉBULEUSE (Identique au mode Pratique) ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes nebula-wave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-nebula-header {
          background: linear-gradient(-45deg, #050505, #5B21B6, #EC4899, #050505);
          background-size: 300% 300%;
          animation: nebula-wave 12s ease infinite;
        }
      `}} />

      {/* ─── HEADER FIXE (L'Arène d'Examen) ─── */}
      <div className="sticky top-0 z-50 bg-nebula-header shadow-[0_10px_30px_-10px_rgba(91,33,182,0.4)] border-b border-white/10">
        <div className="max-w-[1500px] mx-auto px-6 h-24 flex items-center justify-between">
          
          {/* Section Gauche : Logo & Titre */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-inner">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Mode Examen.</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">
                {sessionTitle || "Évaluation Clinique"}
              </p> 
            </div>
          </div>

          {/* Section Droite : Chrono, Quitter & Soumettre */}
          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Le Chronomètre Officiel */}
            <div className="flex items-center gap-4 px-6 py-3 bg-white/15 backdrop-blur-2xl rounded-full border border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] hidden sm:flex">
              <Clock className="h-4 w-4 text-white/80" />
              <div className="text-center flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/70 drop-shadow-sm">Temps Écoulé</span>
                <p className="text-xl font-mono font-bold tracking-tight text-white drop-shadow-md">
                  {formatTime(timeElapsed)}
                </p> 
              </div>
            </div>
            
            {/* BOUTON QUITTER LE MODE EXAMEN */}
            <button 
              onClick={() => navigate('/quiz-library')}
              className="h-12 px-6 rounded-full bg-transparent text-white/80 font-bold uppercase tracking-widest text-[10px] border border-white/20 hover:bg-rose-500/20 hover:text-white hover:border-rose-500/50 transition-all duration-300"
            >
              Quitter
            </button>

            {/* Bouton Soumettre l'Examen Entier */}
            <button 
              onClick={handleSubmit}
              className="h-14 px-10 rounded-full bg-white text-[#111111] font-black uppercase tracking-widest text-xs hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Terminer
            </button>
          </div>
        </div>
        
        {/* Barre de progression globale de l'examen */}
        <div className="h-1 w-full bg-white/10">
          <motion.div 
            className="h-full bg-emerald-400" 
            initial={{ width: 0 }} 
            animate={{ width: `${progressPercent}%` }}
            transition={{ ease: "easeOut" }} 
          />
        </div>
      </div>

      {/* ─── LE COEUR DE LA PAGE (Structure Volumétrique) ─── */}
      <div className="max-w-[1500px] mx-auto px-6 pt-36 pb-40 grid lg:grid-cols-12 gap-10 items-start relative z-10">
        
        {/* =========================================================
            COLONNE GAUCHE (8/12) : LA CARTE QCM (Cadrage Bleu-Violet)
            ========================================================= */}
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-8 bg-white dark:bg-[#161614] border-[1.5px] border-indigo-500/30 dark:border-indigo-500/40 rounded-[3rem] p-10 md:p-14 shadow-[0_20px_80px_-15px_rgba(99,102,241,0.08)] dark:shadow-[0_20px_80px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Filigrane de spécialité en arrière-plan */}
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] dark:opacity-[0.02] pointer-events-none">
            <HeartPulse className="w-64 h-64 text-[#111111] dark:text-white" />
          </div>

          <div className="relative z-10">
            {/* L'En-tête de la Question */}
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-black/5 dark:border-white/5">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white bg-indigo-600 px-5 py-2.5 rounded-xl shadow-md">
                Question {currentIndex + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                {isMultiple && (
                   <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1.5 rounded-lg border border-[#5B21B6]/20">
                     Choix Multiples
                   </span>
                )}
              </div>
            </div>

            {/* Texte de la Question - Grandiose et Imposant */}
            <h2 className="text-3xl md:text-4xl font-serif text-[#111111] dark:text-white leading-[1.6] mb-14">
              {question.question}
            </h2>

            {/* Corps des Choix (Mécaniques et Tactiles - Sans révéler la réponse) */}
            <div className="space-y-5">
              {question.choices.map((choice, index) => {
                const isSelected = selectedAnswers[currentIndex]?.includes(index);
                
                return (
                  <motion.button
                    key={index}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full text-left p-6 rounded-2xl border-[1.5px] transition-all duration-300 flex items-start gap-6 outline-none shadow-sm hover:shadow-md ${
                      isSelected 
                        ? "border-indigo-600 bg-indigo-600/5 dark:bg-indigo-600/10" 
                        : "border-black/10 dark:border-white/10 bg-[#FAFAF8] dark:bg-[#0A0A0A] hover:border-[#111111] dark:hover:border-white/40"
                    }`}
                  >
                    <div className={`h-10 w-10 shrink-0 rounded-xl border-[1.5px] flex items-center justify-center text-xl font-bold transition-all duration-300 mt-0.5 ${
                      isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-black/20 dark:border-white/20 text-[#888888]"
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className={`text-lg font-medium leading-relaxed pt-1 flex-1 ${isSelected ? "text-indigo-900 dark:text-indigo-200" : "text-[#111111] dark:text-[#F4F4F2]"}`}>
                      {choice}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            
            {/* Boutons de Navigation (Précédent / Suivant) spécifiques au mode Examen */}
            <div className="flex justify-between items-center mt-12 pt-8 border-t border-black/5 dark:border-white/5">
                <button 
                  onClick={() => changeQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Précédent
                </button>
                <button 
                  onClick={() => changeQuestion(currentIndex + 1)}
                  disabled={currentIndex === questions.length - 1}
                  className="px-6 py-3 rounded-xl border border-[#111111] dark:border-white bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-bold uppercase tracking-widest disabled:opacity-30 hover:bg-transparent hover:text-[#111111] dark:hover:text-white transition-all"
                >
                  Suivant
                </button>
            </div>

          </div>
        </motion.div>

        {/* =========================================================
            COLONNE DROITE (4/12) : LE NAVIGATEUR D'EXAMEN
            ========================================================= */}
        <div className="lg:col-span-4 space-y-8 sticky top-36">
          
          {/* GRILLE DE NAVIGATION */}
          <div className="bg-white dark:bg-[#161614] border-[1.5px] border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
             <h3 className="text-sm font-bold text-[#111111] dark:text-white flex items-center gap-3 mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                 <LayoutGrid className="h-5 w-5 text-[#888888]" /> Navigateur d'Épreuve
             </h3>
             
             <div className="grid grid-cols-5 gap-3">
                 {questions.map((_, idx) => {
                     const isCurrent = currentIndex === idx;
                     const isAnswered = selectedAnswers[idx]?.length > 0;
                     
                     let btnClass = "border-black/10 dark:border-white/10 bg-[#FAFAF8] dark:bg-[#0A0A0A] text-[#888888] hover:border-[#111111] dark:hover:border-white";
                     if (isAnswered) btnClass = "border-indigo-600 bg-indigo-600 text-white shadow-md";
                     if (isCurrent && !isAnswered) btnClass = "border-[#111111] dark:border-white bg-transparent text-[#111111] dark:text-white";
                     if (isCurrent && isAnswered) btnClass = "border-[#111111] dark:border-white bg-indigo-600 text-white shadow-md ring-4 ring-indigo-500/20";

                     return (
                         <button 
                             key={idx}
                             onClick={() => changeQuestion(idx)}
                             className={`h-12 w-full rounded-xl border-[1.5px] text-sm font-bold transition-all duration-300 flex items-center justify-center ${btnClass}`}
                         >
                             {idx + 1}
                         </button>
                     );
                 })}
             </div>
             
             {/* Légende */}
             <div className="mt-8 flex flex-col gap-3 pt-6 border-t border-black/5 dark:border-white/5">
                 <div className="flex items-center gap-3">
                     <div className="h-3 w-3 rounded-full bg-indigo-600" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Répondue</span>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="h-3 w-3 rounded-full border-2 border-[#111111] dark:border-white" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">En cours</span>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="h-3 w-3 rounded-full bg-[#FAFAF8] dark:bg-[#0A0A0A] border border-black/10 dark:border-white/10" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">À faire</span>
                 </div>
             </div>
          </div>

          {/* SURVEILLANCE CLINIQUE (Agent MOR en mode silencieux) */}
          <div className="bg-white dark:bg-[#161614] border-[1.5px] border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Brain className="h-6 w-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111111] dark:text-white">Agent MOR désactivé</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#888888] mt-1">Conditions réelles</p>
              </div>
            </div>
            <p className="text-xs text-[#666666] dark:text-[#8E8E8A] leading-relaxed mt-4">
              En mode Examen, l'assistance de l'intelligence artificielle et les justifications cliniques sont désactivées. Vos résultats seront disponibles à la soumission.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExamMode;
