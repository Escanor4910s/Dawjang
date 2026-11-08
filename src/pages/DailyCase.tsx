import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, Activity, Target, ShieldAlert, Award, Brain, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { uiAudio } from "@/utils/audio";

interface DailyCase {
  id: string;
  date_for: string;
  title: string;
  content: string;
  questions: any[];
}

interface LeaderboardEntry {
  id: string;
  score: number;
  time_taken_seconds: number;
  profiles: {
    first_name: string;
    avatar_url: string;
  };
}

const DailyCase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dailyCase, setDailyCase] = useState<DailyCase | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState<{ score: number, time_taken: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Game states: 'intro' | 'reading' | 'questions' | 'results'
  const [gameState, setGameState] = useState<'intro' | 'reading' | 'questions' | 'results'>('intro');
  
  // Reading phase state
  const [timeLeft, setTimeLeft] = useState(5 * 60);
  
  // Questions phase state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0);

  useEffect(() => {
    fetchDailyCase();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (gameState === 'reading' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (gameState === 'reading' && timeLeft === 0) {
      handleStartQuestions();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const fetchDailyCase = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // 1. Get today's case
      const today = new Date().toISOString().split('T')[0];
      const { data: cases, error: caseError } = await supabase
        .from('daily_cases')
        .select('*')
        .eq('date_for', today)
        .limit(1);

      if (caseError) throw caseError;

      if (!cases || cases.length === 0) {
        setLoading(false);
        return;
      }

      const caseData = cases[0] as DailyCase;
      setDailyCase(caseData);

      // 2. Check if user already completed it
      const { data: results, error: resultsError } = await supabase
        .from('daily_case_results')
        .select('*')
        .eq('user_id', user.id)
        .eq('case_id', caseData.id);
        
      if (resultsError) throw resultsError;

      if (results && results.length > 0) {
        setAlreadyCompleted({
          score: results[0].score,
          time_taken: results[0].time_taken_seconds
        });
        await fetchLeaderboard(caseData.id);
        setGameState('results');
      }

    } catch (error) {
      console.error("Error fetching daily case:", error);
      toast.error("Impossible de charger le cas clinique du jour.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (caseId: string) => {
    const { data, error } = await supabase
      .from('daily_case_results')
      .select('id, score, time_taken_seconds, profiles(first_name, avatar_url)')
      .eq('case_id', caseId)
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .limit(10);
      
    if (error) {
      console.error("Leaderboard error:", error);
    } else {
      setLeaderboard((data as unknown) as LeaderboardEntry[]);
    }
  };

  const handleStartReading = () => {
    setGameState('reading');
    uiAudio.playClick();
  };

  const handleStartQuestions = () => {
    setGameState('questions');
    setStartTime(Date.now());
    uiAudio.playClick();
  };

  const handleAnswer = (answer: string) => {
    if (showExplanation) return;
    
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setShowExplanation(true);
    
    const currentQ = dailyCase!.questions[currentQuestionIndex];
    if (answer === currentQ.correctAnswer) {
      setScore(prev => prev + 1);
      uiAudio.playSuccess();
    } else {
      uiAudio.playError();
    }
  };

  const handleNextQuestion = async () => {
    setShowExplanation(false);
    
    if (currentQuestionIndex < dailyCase!.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Finished
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      setTotalTimeTaken(timeTaken);
      await saveResults(timeTaken);
    }
  };

  const saveResults = async (timeTaken: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const finalScore = score + (answers[answers.length-1] === dailyCase!.questions[dailyCase!.questions.length-1].correctAnswer && !showExplanation ? 1 : 0);

      await supabase
        .from('daily_case_results')
        .insert({
          user_id: user.id,
          case_id: dailyCase!.id,
          score: finalScore,
          time_taken_seconds: timeTaken
        });

      setAlreadyCompleted({ score: finalScore, time_taken: timeTaken });
      await fetchLeaderboard(dailyCase!.id);
      setGameState('results');
      uiAudio.playSuccess();
      toast.success("Résultats sauvegardés !");
    } catch (error) {
      console.error("Error saving results:", error);
      toast.error("Erreur lors de la sauvegarde de vos résultats.");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F4F2] dark:bg-[#111111] flex items-center justify-center">
        <Activity className="w-8 h-8 text-[#5B21B6] animate-spin" />
      </div>
    );
  }

  if (!dailyCase) {
    return (
      <div className="min-h-screen bg-[#F4F4F2] dark:bg-[#111111] text-[#111111] dark:text-[#F4F4F2] p-8 flex flex-col items-center justify-center">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="absolute top-8 left-8">
          <ChevronLeft className="w-5 h-5 mr-2" /> Retour au QG
        </Button>
        <ShieldAlert className="w-16 h-16 text-[#888] mb-6 opacity-20" />
        <h1 className="text-3xl font-serif font-black mb-4">Aucun Cas Aujourd'hui</h1>
        <p className="text-[#888]">Revenez demain pour un nouveau défi clinique.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F2] dark:bg-[#111111] text-[#111111] dark:text-[#F4F4F2] font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#5B21B6]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#10B981]/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto p-4 sm:p-8 pt-20 relative z-10 min-h-screen flex flex-col">
        
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="absolute top-8 left-4 sm:left-8 z-50">
          <ChevronLeft className="w-5 h-5 mr-2" /> Quitter
        </Button>

        <AnimatePresence mode="wait">
          
          {/* INTRO SCREEN */}
          {gameState === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col justify-center items-center text-center">
              <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-[#5B21B6]/10 text-[#5B21B6] border border-[#5B21B6]/20 text-xs font-black uppercase tracking-widest mb-8">
                <Target className="w-4 h-4" /> Défi Quotidien
              </div>
              <h1 className="text-5xl md:text-6xl font-serif font-black mb-6 tracking-tight leading-tight">
                {dailyCase.title}
              </h1>
              <p className="text-lg text-[#888888] max-w-xl mx-auto mb-12">
                Vous avez 5 minutes pour analyser ce dossier médical. Ensuite, vous devrez répondre à {dailyCase.questions.length} questions sans pouvoir revenir en arrière.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 mb-16 w-full max-w-md">
                <div className="flex-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-xl flex flex-col items-center">
                  <Clock className="w-8 h-8 text-[#5B21B6] mb-3" />
                  <span className="text-xl font-bold">5 Min</span>
                  <span className="text-xs text-[#888] uppercase tracking-widest font-black mt-1">Analyse</span>
                </div>
                <div className="flex-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-xl flex flex-col items-center">
                  <Brain className="w-8 h-8 text-[#10B981] mb-3" />
                  <span className="text-xl font-bold">{dailyCase.questions.length} QCM</span>
                  <span className="text-xs text-[#888] uppercase tracking-widest font-black mt-1">Évaluation</span>
                </div>
              </div>

              <Button onClick={handleStartReading} className="bg-[#111] dark:bg-white text-white dark:text-[#111] hover:bg-[#333] dark:hover:bg-[#E5E5E5] text-lg py-6 px-12 rounded-full font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95">
                Accepter le Cas
              </Button>
            </motion.div>
          )}

          {/* READING SCREEN */}
          {gameState === 'reading' && (
            <motion.div key="reading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-8 bg-white/50 dark:bg-[#1A1A1A]/50 backdrop-blur-xl p-4 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-lg">
                <div className="flex items-center gap-4 pl-4">
                  <Activity className="w-6 h-6 text-[#5B21B6]" />
                  <span className="font-serif font-bold text-xl">{dailyCase.title}</span>
                </div>
                <div className={`px-6 py-2 rounded-full font-black text-lg border shadow-inner ${timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-[#111] text-white border-[#333] dark:bg-white dark:text-[#111]'}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>

              <Card className="flex-1 bg-white dark:bg-[#1A1A1A] p-8 md:p-12 rounded-[2.5rem] shadow-2xl border-black/5 dark:border-white/5 overflow-y-auto leading-relaxed text-lg whitespace-pre-wrap">
                {dailyCase.content}
              </Card>

              <div className="mt-8 flex justify-end">
                <Button onClick={handleStartQuestions} className="bg-[#5B21B6] hover:bg-[#4C1D95] text-white py-6 px-10 rounded-full font-bold shadow-xl transition-transform hover:scale-105">
                  J'ai terminé l'analyse, passer aux questions
                </Button>
              </div>
            </motion.div>
          )}

          {/* QUESTIONS SCREEN */}
          {gameState === 'questions' && (
            <motion.div key="questions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col">
              <div className="mb-8">
                <div className="flex justify-between text-sm font-black uppercase tracking-widest text-[#888] mb-3">
                  <span>Question {currentQuestionIndex + 1} sur {dailyCase.questions.length}</span>
                  <span>{formatTime(Math.floor((Date.now() - startTime) / 1000))}</span>
                </div>
                <Progress value={((currentQuestionIndex) / dailyCase.questions.length) * 100} className="h-2" />
              </div>

              <Card className="bg-white dark:bg-[#1A1A1A] p-8 md:p-10 rounded-[2.5rem] shadow-2xl border-black/5 dark:border-white/5 mb-8">
                <h2 className="text-2xl md:text-3xl font-serif font-black mb-8 leading-tight">
                  {dailyCase.questions[currentQuestionIndex].question}
                </h2>

                <div className="space-y-4">
                  {dailyCase.questions[currentQuestionIndex].options.map((option: string, idx: number) => {
                    const isSelected = answers[currentQuestionIndex] === option;
                    const isCorrect = option === dailyCase.questions[currentQuestionIndex].correctAnswer;
                    
                    let btnClass = "w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 font-medium text-lg ";
                    
                    if (!showExplanation) {
                      btnClass += "bg-[#FAFAF8] dark:bg-[#111] border-black/5 dark:border-white/5 hover:border-[#5B21B6]/50 hover:bg-[#5B21B6]/5";
                    } else {
                      if (isCorrect) {
                        btnClass += "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400";
                      } else if (isSelected && !isCorrect) {
                        btnClass += "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400";
                      } else {
                        btnClass += "bg-[#FAFAF8] dark:bg-[#111] border-black/5 dark:border-white/5 opacity-50";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={showExplanation}
                        onClick={() => handleAnswer(option)}
                        className={btnClass}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {showExplanation && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl mb-8">
                  <h4 className="font-black uppercase tracking-widest text-xs text-blue-600 dark:text-blue-400 mb-2">Explication</h4>
                  <p className="text-blue-900 dark:text-blue-200">{dailyCase.questions[currentQuestionIndex].explanation}</p>
                </motion.div>
              )}

              <div className="flex justify-end mt-auto">
                <Button 
                  disabled={!showExplanation} 
                  onClick={handleNextQuestion}
                  className="bg-[#111] dark:bg-white text-white dark:text-[#111] py-6 px-10 rounded-full font-bold shadow-xl disabled:opacity-30"
                >
                  {currentQuestionIndex < dailyCase.questions.length - 1 ? 'Question Suivante' : 'Terminer & Voir le Classement'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* RESULTS & LEADERBOARD SCREEN */}
          {gameState === 'results' && alreadyCompleted && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center pt-10">
              <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.4)] mb-8">
                <Award className="w-12 h-12 text-white" />
              </div>
              
              <h2 className="text-4xl font-serif font-black mb-2">Cas Terminé</h2>
              <p className="text-[#888] mb-12 uppercase tracking-widest font-black text-sm">Vos Résultats</p>

              <div className="flex gap-6 mb-16 w-full max-w-lg">
                <Card className="flex-1 p-6 text-center rounded-[2rem] bg-white/50 dark:bg-[#1A1A1A]/50 border-black/5 dark:border-white/5 shadow-xl">
                  <div className="text-5xl font-light mb-2">{Math.round((alreadyCompleted.score / dailyCase.questions.length) * 100)}%</div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#888]">Précision</div>
                </Card>
                <Card className="flex-1 p-6 text-center rounded-[2rem] bg-white/50 dark:bg-[#1A1A1A]/50 border-black/5 dark:border-white/5 shadow-xl">
                  <div className="text-5xl font-light mb-2">{formatTime(alreadyCompleted.time_taken)}</div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#888]">Temps</div>
                </Card>
              </div>

              {/* LEADERBOARD */}
              <div className="w-full max-w-2xl bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <Users className="w-6 h-6 text-[#5B21B6]" />
                  <h3 className="text-xl font-serif font-black">Classement Journalier</h3>
                </div>

                <div className="space-y-3">
                  {leaderboard.length === 0 ? (
                    <p className="text-center text-[#888] py-4">Chargement du classement...</p>
                  ) : (
                    leaderboard.map((entry, index) => (
                      <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#FAFAF8] dark:bg-[#111] border border-black/5 dark:border-white/5 hover:border-[#5B21B6]/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-black/5 dark:bg-white/5 text-[#888]'}`}>
                            #{index + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-white dark:border-[#222]" style={{ backgroundImage: `url(${entry.profiles?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'})` }} />
                            <span className="font-bold">{entry.profiles?.first_name || 'Médecin'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <div className="font-black text-lg">{entry.score}/{dailyCase.questions.length}</div>
                            <div className="text-[10px] uppercase tracking-widest text-[#888]">Score</div>
                          </div>
                          <div className="w-16">
                            <div className="font-bold">{formatTime(entry.time_taken_seconds)}</div>
                            <div className="text-[10px] uppercase tracking-widest text-[#888]">Temps</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DailyCase;
