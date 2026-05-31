

# File: src/pages/Dashboard.tsx
```tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";
import { BookOpen, TrendingUp, Award, Target, Sun, Moon, Sparkles, ChevronDown, ChevronUp, Clock, Monitor, CheckCircle2, Play, Pause, RotateCcw, Volume2, VolumeX, Timer, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useOnboardingContext } from "@/components/onboarding/OnboardingProvider";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { uiAudio } from "@/utils/audio";

interface ActiveFocusUser {
  user_id: string;
  first_name: string;
  avatar_url: string | null;
  is_focusing: boolean;
}

interface QuizResult {
  id: string;
  course_id: string;
  score: number;
  total_questions: number;
  created_at: string;
  courses: { title: string; };
}

const Dashboard = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    "recent": true,
    "devices": false,
    "benefits": false
  });

  // Pomodoro Focus Timer & Binaural Beats State
  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isBinauralPlaying, setIsBinauralPlaying] = useState(false);
  const [activeFocusUsers, setActiveFocusUsers] = useState<ActiveFocusUser[]>([]);
  
  const navigate = useNavigate();
  const { steps, completionPercentage, isComplete, refreshState } = useOnboardingContext();

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hour = new Date().getHours();
  const GreetingIcon = hour < 18 ? Sun : Moon;

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchResults = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("first_name, name, avatar_url, university").eq("id", user.id).single();
      if (profile) {
        setFirstName(profile.first_name || profile.name || user.email?.split("@")[0] || "");
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }

      const { data, error } = await supabase.from("quiz_results").select(`id, course_id, score, total_questions, created_at, courses(title)`).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Erreur lors du chargement");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useRealtimeSubscription({ table: 'quiz_results', event: '*', onUpdate: fetchResults });
  
  useEffect(() => { 
    checkAuth(); 
    fetchResults(); 
    refreshState();
  }, [fetchResults, refreshState]);

  // Pomodoro Focus Countdown Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && focusTimeLeft > 0) {
      interval = setInterval(() => {
        setFocusTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (focusTimeLeft === 0) {
      setIsTimerRunning(false);
      uiAudio.playSuccess();
      toast.success("🏆 FOCUS TERMINÉ ! Félicitations pour votre session d'étude productive.");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, focusTimeLeft]);

  // Cleanup Binaural Audio on component unmount
  useEffect(() => {
    return () => {
      uiAudio.stopBinauralBeats();
    };
  }, []);

  // Supabase Presence for Social Focus
  useEffect(() => {
    if (!firstName) return;

    const presenceChannel = supabase.channel('focus_room');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flatMap(p => p as unknown as ActiveFocusUser[]);
        // Deduplicate
        const uniqueUsers = Array.from(new Map(users.map(item => [item.user_id, item])).values());
        // Only show users who are focusing AND not the current user (if we want, or keep current user to test)
        setActiveFocusUsers(uniqueUsers.filter(u => u.is_focusing));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data } = await supabase.auth.getUser();
          await presenceChannel.track({
            user_id: data.user?.id,
            first_name: firstName,
            avatar_url: avatarUrl,
            is_focusing: isTimerRunning
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [firstName, avatarUrl, isTimerRunning]);

  const averageScore = results.length > 0 ? Math.round((results.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / results.length)) : 0;
  const successRate = results.length > 0 ? Math.round((results.filter(r => (r.score / r.total_questions) * 100 >= 60).length / results.length) * 100) : 0;

  const themeStats = results.reduce((acc, r) => {
    const title = r.courses?.title || "Sans titre";
    if (!acc[title]) acc[title] = { total: 0, correct: 0, count: 0 };
    acc[title].total += r.total_questions;
    acc[title].correct += r.score;
    acc[title].count += 1;
    return acc;
  }, {} as Record<string, { total: number; correct: number; count: number }>);

  const themePerformance = Object.entries(themeStats).map(([theme, stats]) => ({
    theme, score: Math.round((stats.correct / stats.total) * 100), count: stats.count,
  })).sort((a, b) => b.score - a.score);

  const bestTheme = themePerformance[0];
  const chartData = results.slice(0, 5).reverse().map((r, i) => ({ name: `Quiz ${results.length - 4 + i}`, score: Math.round((r.score / r.total_questions) * 100) }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const cardHover = {
    y: -5,
    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
    transition: { duration: 0.3, ease: "sharp" },
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen text-foreground font-sans overflow-x-hidden px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto space-y-8 relative"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-warning/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 relative z-10">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground">
              Bienvenue, {firstName || "Dr."}
            </h1>
            <div className="flex gap-4 mt-6 text-sm text-muted-foreground items-center">
               <div className="flex flex-col gap-1 w-24">
                 <span className="font-medium text-foreground">Score</span>
                 <div className="h-8 rounded-full bg-foreground relative overflow-hidden flex items-center px-2 text-background text-xs">
                   {averageScore}%
                 </div>
               </div>
               <div className="flex flex-col gap-1 w-24">
                 <span className="font-medium">Réussite</span>
                 <div className="h-8 rounded-full bg-warning relative overflow-hidden flex items-center px-2 text-warning-foreground font-medium text-xs">
                   {successRate}%
                 </div>
               </div>
            </div>
          </div>
          
          <div className="flex gap-8 sm:gap-12 lg:pb-2">
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3"/> QCM</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{results.length}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Séries</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{Math.floor(results.length / 10)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><Monitor className="w-3 h-3"/> Cours</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{Object.keys(themeStats).length}</span>
            </div>
          </div>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* LEFT COLUMN */}
          <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
            <motion.div whileHover={cardHover} className="bg-card/40 backdrop-blur-xl border border-border rounded-[2rem] p-6 shadow-sm overflow-hidden relative group">
              <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url('${avatarUrl || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80"}')` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
              
              <div className="relative pt-32 pb-4">
                <h2 className="text-2xl font-medium text-foreground mb-1">{firstName || "Utilisateur"}</h2>
                <p className="text-muted-foreground text-sm font-medium">Étudiant(e) en médecine</p>
                <div className="mt-4 inline-flex items-center gap-2 border border-border rounded-full px-4 py-1.5 backdrop-blur-md bg-muted/50 text-foreground text-sm font-medium">
                  Meilleur thème : {bestTheme?.theme || "-"}
                </div>
              </div>
            </motion.div>

            <div className="space-y-2">
              {['recent', 'devices', 'benefits'].map((key) => (
                <div key={key} className="bg-card/50 backdrop-blur-md rounded-3xl border border-border shadow-sm overflow-hidden transition-all">
                  <button onClick={() => toggleAccordion(key)} className="w-full flex items-center justify-between p-5 text-left focus:outline-none hover:bg-muted/30 transition-colors">
                    <span className="font-medium text-[15px] text-foreground">
                      {key === 'recent' ? 'Thèmes récents' : key === 'devices' ? 'Appareils actifs' : 'Abonnement'}
                    </span>
                    {openAccordions[key] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {openAccordions[key] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-muted-foreground space-y-3 pt-2 border-t border-border border-dashed">
                          {key === 'recent' ? (
                            themePerformance.slice(0,3).map((t, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="truncate pr-4">{t.theme}</span>
                                <span className="font-medium text-foreground">{t.score}%</span>
                              </div>
                            ))
                          ) : key === 'devices' ? (
                            <div className="flex items-center gap-3">
                              <Monitor className="w-8 h-8 text-foreground/70 p-1.5 bg-muted rounded-lg" />
                              <div>
                                <p className="text-sm font-medium text-foreground">Cet Appareil</p>
                                <p className="text-xs text-muted-foreground">Connecté</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">Plan Premium Actif</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>

          {/* MIDDLE COLUMN */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-foreground">Progression</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-4xl font-light text-foreground">{averageScore}</span>
                        <span className="text-lg text-muted-foreground font-medium">%</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium block mt-1">Score moyen global</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                      <TrendingUp className="w-4 h-4 text-foreground/70" />
                    </div>
                  </div>
                  {results.length > 0 ? (
                    <div className="h-32 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={8}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} className={index === chartData.length - 1 ? "fill-warning" : "fill-foreground"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-32 w-full mt-4 bg-muted/50 rounded-xl flex items-center justify-center text-sm text-muted-foreground">Pas de données</div>
                  )}
                </Card>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="bg-gradient-to-br from-card/80 to-background/50 backdrop-blur-2xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
                  {/* Floating Glowing Particle Styles */}
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes floatParticle {
                      0% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.2; }
                      50% { transform: translateY(-30px) translateX(15px) scale(1.3); opacity: 0.6; }
                      100% { transform: translateY(-60px) translateX(-10px) scale(0.8); opacity: 0; }
                    }
                    .particle-1 { animation: floatParticle 8s infinite ease-in-out; }
                    .particle-2 { animation: floatParticle 6s infinite ease-in-out 2s; }
                    .particle-3 { animation: floatParticle 10s infinite ease-in-out 4s; }
                  `}} />
                  
                  {/* Glowing Backlit Rings */}
                  <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                  
                  {/* Floating particles */}
                  <div className="absolute bottom-4 left-6 w-2 h-2 bg-primary/30 rounded-full blur-[1px] particle-1 pointer-events-none" />
                  <div className="absolute bottom-8 right-12 w-3 h-3 bg-violet-500/20 rounded-full blur-[1px] particle-2 pointer-events-none" />
                  <div className="absolute bottom-2 right-4 w-1.5 h-1.5 bg-indigo-500/40 rounded-full blur-[1px] particle-3 pointer-events-none" />

                  <div className="flex justify-between items-start z-10 relative">
                    <div>
                      <h3 className="text-lg font-medium text-foreground">Stabilité (FSRS)</h3>
                      <span className="text-[9px] font-black tracking-widest text-primary uppercase block mt-0.5">Index d'Oubli d'Ebbinghaus</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                      <Brain className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-4">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" className="stroke-muted/30" strokeWidth="6" />
                        <motion.circle 
                          cx="50" cy="50" r="44" fill="none" className="stroke-primary" strokeWidth="6" strokeLinecap="round" 
                          initial={{ strokeDasharray: "0 280" }}
                          animate={{ strokeDasharray: `${Math.max(successRate, 5) * 2.76} 280` }}
                          transition={{ duration: 1.6, ease: "easeInOut" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-light tracking-tighter text-foreground">
                          {Math.max(successRate, 62)}%
                        </span>
                        <span className="text-[8px] uppercase font-black text-muted-foreground tracking-widest mt-0.5">RÉTENTION</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            <motion.div variants={itemVariants} whileHover={cardHover} className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-foreground">Historique Récent</h3>
              </div>
              <div className="space-y-4 relative">
                <div className="absolute left-[39px] top-4 bottom-4 w-px bg-border border-dashed" />
                {results.slice(0,3).map((r, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-6 relative z-10">
                    <div className="w-20 text-right shrink-0">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className={`w-[20px] h-[20px] rounded-full border-4 border-background flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-foreground'} shadow-sm`} />
                    <div className={`flex-1 p-4 rounded-2xl flex justify-between items-center ${i === 0 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-background border border-border'}`}>
                       <div className="flex flex-col">
                         <span className={`font-medium text-sm truncate max-w-[150px] sm:max-w-[200px] ${i === 0 ? 'text-primary-foreground' : 'text-foreground'}`}>{r.courses?.title || "Sujet non défini"}</span>
                       </div>
                       <div className={`h-8 px-3 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-background/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                         {Math.round((r.score / r.total_questions)*100)}%
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <motion.div variants={itemVariants} className="lg:col-span-3 h-full">
            <div className="bg-slate-950 text-white rounded-[2rem] p-6 sm:p-8 shadow-2xl h-full border border-white/5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <h3 className="text-xl font-medium text-white mb-1">Objectifs</h3>
                  <span className="text-xs text-white/80 uppercase tracking-widest font-bold">À compléter</span>
                </div>
                <div className="text-3xl font-light text-white tracking-tighter">
                  {Math.round(completionPercentage)}<span className="text-lg text-white/80">%</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-3xl p-5 relative z-10 flex-1 flex flex-col gap-4">
                <div className="space-y-1 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {steps.map((step, idx) => (
                    <motion.div 
                      key={step.id} 
                      whileHover={{ x: 5 }}
                      onClick={() => !step.completed && step.route && navigate(step.route)}
                      className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer ${step.completed ? 'bg-white/5 opacity-90' : 'hover:bg-white/10'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.completed ? 'bg-success text-success-foreground' : 'bg-white/20 text-white'}`}>
                        {step.completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{idx+1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${step.completed ? 'text-white/90 line-through' : 'text-white'}`}>{step.title}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* FOCUS POMODORO & BINAURAL AUDIO FLOATING WIDGET */}
            <div className="bg-slate-950 text-white rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-white/5 flex flex-col relative overflow-hidden mt-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6 z-10 relative">
                <div>
                  <h3 className="text-lg font-medium text-white mb-0.5">Focus Flow</h3>
                  <span className="text-[9px] text-primary/80 uppercase tracking-widest font-black flex items-center gap-1">
                    <Timer className="h-3 w-3 animate-pulse" /> Ondes Alpha 10Hz
                  </span>
                </div>
                
                {isBinauralPlaying && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[8px] font-black uppercase tracking-wider animate-[pulse_1.5s_infinite]">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>AUDIO ACTIF</span>
                  </div>
                )}
              </div>

              {/* Glowing circular timer interface */}
              <div className="flex flex-col items-center justify-center py-6 relative z-10">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {isBinauralPlaying && (
                    <>
                      <div className="absolute inset-0 rounded-full border border-primary/20 animate-[ping_2s_infinite]" />
                      <div className="absolute inset-[-8px] rounded-full border border-violet-500/10 animate-[ping_3s_infinite_1s]" />
                    </>
                  )}
                  
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="43" fill="none" className="stroke-white/5" strokeWidth="5" />
                    <motion.circle 
                      cx="50" cy="50" r="43" fill="none" className="stroke-primary" strokeWidth="5" strokeLinecap="round" 
                      initial={{ strokeDasharray: "0 280" }}
                      animate={{ strokeDasharray: `${(focusTimeLeft / (25 * 60)) * 270} 270` }}
                      transition={{ duration: 0.5, ease: "linear" }}
                    />
                  </svg>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-light tracking-tighter text-white font-mono">
                      {Math.floor(focusTimeLeft / 60)}:{(focusTimeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[8px] uppercase font-black text-white/50 tracking-widest mt-0.5">
                      {isTimerRunning ? "DURÉE FOCUS" : "PAUSE"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Futuristic Controller Buttons */}
              <div className="grid grid-cols-3 gap-2.5 z-10 relative pt-2">
                <button
                  onClick={() => {
                    uiAudio.playSoftClick();
                    setIsTimerRunning(!isTimerRunning);
                  }}
                  className={`py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider ${
                    isTimerRunning 
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-500" 
                      : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{isTimerRunning ? "Pause" : "Start"}</span>
                </button>

                <button
                  onClick={() => {
                    uiAudio.playSoftClick();
                    setFocusTimeLeft(25 * 60);
                    setIsTimerRunning(false);
                  }}
                  className="bg-white/5 border border-white/10 text-white hover:bg-white/10 py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={() => {
                    uiAudio.playSoftClick();
                    if (isBinauralPlaying) {
                      uiAudio.stopBinauralBeats();
                      setIsBinauralPlaying(false);
                      toast.info("🔇 Ondes Alpha désactivées.");
                    } else {
                      uiAudio.startBinauralBeats();
                      setIsBinauralPlaying(true);
                      toast.success("🎧 Ondes Alpha 10Hz activées. Casque stéréo recommandé !");
                    }
                  }}
                  className={`py-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider ${
                    isBinauralPlaying 
                      ? "bg-primary/20 border border-primary/30 text-primary shadow-[0_0_12px_rgba(99,102,241,0.25)]" 
                      : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  {isBinauralPlaying ? <VolumeX className="h-4 w-4 animate-[pulse_1.5s_infinite]" /> : <Volume2 className="h-4 w-4" />}
                  <span>Binaural</span>
                </button>
              </div>

              {/* Social Focus Area */}
              {activeFocusUsers.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/10 z-10 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/70">
                      Salles de Focus
                    </h4>
                    <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {activeFocusUsers.length} en ligne
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeFocusUsers.map(user => (
                      <div key={user.user_id} className="relative group cursor-help">
                        <div className="w-8 h-8 rounded-full bg-muted border-2 border-primary/50 overflow-hidden shadow-lg hover:scale-110 transition-transform">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.first_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-xs font-bold uppercase">
                              {user.first_name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded border border-white/10 text-[9px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {user.first_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;

```


# File: src/pages/Flashcards.tsx
```tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Download, RotateCw, RefreshCw, FileDown, Search, BookOpen, ChevronDown, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportFlashcardsToPDF } from "@/utils/pdfExport";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Flashcard { id: string; course_id: string; question: string; answer: string; created_at: string; courses: { title: string; }; }
interface Course { id: string; title: string; }

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);
  const [generatingCourseId, setGeneratingCourseId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const navigate = useNavigate();

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchFlashcards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("flashcards").select(`id, course_id, question, answer, created_at, courses(title)`).eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setFlashcards(data || []);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      toast.error("Erreur lors du chargement des flashcards");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("courses").select("id, title").eq("user_id", user.id);
      if (error) throw error;
      setCourses(data || []);
    } catch (error) { console.error("Error fetching courses:", error); }
  }, []);

  // Get unique course titles from flashcards for filtering
  const flashcardCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of flashcards) {
      if (f.courses?.title && !map.has(f.course_id)) {
        map.set(f.course_id, f.courses.title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [flashcards]);

  // Filtered flashcards
  const filteredFlashcards = useMemo(() => {
    if (selectedFilter === "all") return flashcards;
    return flashcards.filter(f => f.course_id === selectedFilter);
  }, [flashcards, selectedFilter]);

  const uniqueCourses = useMemo(() => {
    const titleMap = new Map<string, Course[]>();
    for (const course of courses) {
      const key = course.title.trim().toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(course);
    }
    return Array.from(titleMap.entries()).map(([, group]) => ({ displayTitle: group[0].title, courseIds: group.map(c => c.id) }));
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return uniqueCourses;
    const q = courseSearch.toLowerCase();
    return uniqueCourses.filter(c => c.displayTitle.toLowerCase().includes(q));
  }, [uniqueCourses, courseSearch]);

  useRealtimeSubscription({ table: 'flashcards', event: '*', onUpdate: fetchFlashcards });
  useEffect(() => { checkAuth(); fetchFlashcards(); fetchCourses(); }, [fetchFlashcards, fetchCourses]);

  const handleRefresh = async () => { setRefreshing(true); await Promise.all([fetchFlashcards(), fetchCourses()]); toast.success("Flashcards actualisées !"); };

  const generateFlashcardsFromQuiz = async (courseIds: string[]) => {
    try {
      setGeneratingCourseId(courseIds[0]);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: allResults, error: resultsError } = await supabase.from("quiz_results").select("answers").eq("user_id", user.id).in("course_id", courseIds).order("created_at", { ascending: false });
      if (resultsError) throw resultsError;
      if (!allResults || allResults.length === 0) { toast.info("Aucun quiz complété pour ce cours !"); return; }

      const allWrongAnswers: { question: string; correctAnswer: string }[] = [];
      const seenQuestions = new Set<string>();
      for (const result of allResults) {
        const answers = result.answers as any[];
        for (const answer of answers) {
          if (!answer.correct) {
            const normalizedQ = answer.question?.trim().toLowerCase();
            if (normalizedQ && !seenQuestions.has(normalizedQ)) { seenQuestions.add(normalizedQ); allWrongAnswers.push({ question: answer.question, correctAnswer: answer.correctAnswer }); }
          }
        }
      }
      if (allWrongAnswers.length === 0) { toast.info("Aucune erreur à réviser !"); return; }

      const { data: existingCards } = await supabase.from("flashcards").select("question").eq("user_id", user.id).in("course_id", courseIds);
      const existingQuestions = new Set((existingCards || []).map(c => c.question.trim().toLowerCase()));
      const newFlashcards = allWrongAnswers.filter(a => !existingQuestions.has(a.question.trim().toLowerCase()));
      if (newFlashcards.length === 0) { toast.info("Toutes les erreurs ont déjà des flashcards !"); return; }

      const { error: insertError } = await supabase.from("flashcards").insert(newFlashcards.map((a) => ({ user_id: user.id, course_id: courseIds[0], question: a.question, answer: a.correctAnswer })));
      if (insertError) throw insertError;
      toast.success(`${newFlashcards.length} flashcard(s) créée(s) !`);
      setCoursePopoverOpen(false);
      fetchFlashcards();
    } catch (error) { console.error("Error:", error); toast.error("Erreur"); } finally { setGeneratingCourseId(null); }
  };

  const deleteFlashcard = async (id: string) => {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setFlashcards(prev => prev.filter(f => f.id !== id));
    if (currentIndex >= filteredFlashcards.length - 1) setCurrentIndex(Math.max(0, filteredFlashcards.length - 2));
    toast.success("Flashcard supprimée");
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setFlashcards(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setCurrentIndex(0);
    toast.success(`${ids.length} flashcard(s) supprimée(s)`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredFlashcards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredFlashcards.map(f => f.id)));
  };

  const exportToCSV = () => {
    const csv = [["Question", "Réponse", "Cours"], ...filteredFlashcards.map(f => [f.question, f.answer, f.courses?.title || ""])].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flashcards.csv"; a.click();
    toast.success("Export réussi !");
  };

  const exportToPDF = () => {
    exportFlashcardsToPDF(filteredFlashcards.map(f => ({ question: f.question, answer: f.answer, courseName: f.courses?.title || "" })));
    toast.success("PDF téléchargé !");
  };

  const handleNext = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % filteredFlashcards.length); };
  const handlePrevious = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + filteredFlashcards.length) % filteredFlashcards.length); };

  if (loading) return <div className="container mx-auto p-6"><div className="animate-pulse space-y-4"><div className="h-96 bg-muted rounded-lg"></div></div></div>;

  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 text-center sm:text-left">
        <div className="min-w-0">
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">Flashcards</h1>
          <p className="text-sm font-medium text-muted-foreground mt-2">Mémorisez efficacement avec la répétition espacée</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing} size="sm" className="border-foreground/30"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button>
          {flashcards.length > 0 && (
            <>
              <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} variant={selectMode ? "default" : "outline"} size="sm" className={selectMode ? "bg-foreground text-background" : "border-foreground/30"}>
                <CheckSquare className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sélection</span>
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm" className="border-foreground/30"><Download className="h-4 w-4" /></Button>
              <Button onClick={exportToPDF} variant="outline" size="sm" className="border-foreground/30"><FileDown className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Course selector */}
      {courses.length > 0 && (
        <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-11 border-foreground/30 text-foreground">
              <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Générer des flashcards depuis un cours</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="p-2 border-b"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} className="pl-8 h-9" /></div></div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filteredCourses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Aucun cours trouvé</p> : (
                filteredCourses.map((course) => (
                  <button key={course.displayTitle} onClick={() => generateFlashcardsFromQuiz(course.courseIds)} disabled={generatingCourseId === course.courseIds[0]}
                    className="w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 flex items-center justify-between gap-2">
                    <span className="truncate">{course.displayTitle}</span>
                    {course.courseIds.length > 1 && <Badge variant="secondary" className="text-[10px] flex-shrink-0">{course.courseIds.length} sessions</Badge>}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Filter by lesson */}
      {flashcardCourses.length > 1 && (
        <Tabs value={selectedFilter} onValueChange={(v) => { setSelectedFilter(v); setCurrentIndex(0); setIsFlipped(false); }}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="all" className="text-xs">Toutes ({flashcards.length})</TabsTrigger>
            {flashcardCourses.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs truncate max-w-[150px]">
                {c.title} ({flashcards.filter(f => f.course_id === c.id).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Mass delete bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-foreground">{selectedIds.size === filteredFlashcards.length ? "Tout désélectionner" : "Tout sélectionner"}</Button>
            <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Supprimer {selectedIds.size} flashcard(s) ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete}>Supprimer</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {filteredFlashcards.length === 0 ? (
        <Card className="text-center py-16 bg-card/40 backdrop-blur-md rounded-[2rem] border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Aucune flashcard</CardTitle>
            <CardDescription>Créez vos premières flashcards à partir d'un quiz</CardDescription>
          </CardHeader>
        </Card>
      ) : selectMode ? (
        /* Selection mode - list view */
        <div className="space-y-2">
          {filteredFlashcards.map((f) => (
            <div key={f.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(f.id) ? "bg-destructive/5 border-destructive/30" : "bg-card border-border/50 hover:bg-muted/30"}`} onClick={() => toggleSelect(f.id)}>
              <Checkbox checked={selectedIds.has(f.id)} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.question}</p>
                <p className="text-xs text-muted-foreground truncate">{f.courses?.title}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Card view */
        <>
          <div className="flex items-center justify-between">
            <Badge variant="outline">{currentIndex + 1} / {filteredFlashcards.length}</Badge>
            <Badge variant="secondary" className="max-w-[200px] truncate">{filteredFlashcards[currentIndex]?.courses?.title}</Badge>
          </div>

            <div className="relative [perspective:2000px] w-full max-w-4xl mx-auto">
              <motion.div
                className="min-h-[400px] sm:min-h-[500px] w-full cursor-pointer relative preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
              whileHover={{ scale: 1.02 }}
            >
              {/* FRONT */}
                <Card className="absolute inset-0 w-full h-full bg-card/95 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden [backface-visibility:hidden]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-80" />
                <CardContent className="flex flex-col items-center justify-center h-full p-6 sm:p-12 relative z-10">
                  <div className="text-center w-full">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-6">Question</p>
                    <p className="text-2xl sm:text-4xl font-light leading-relaxed text-foreground">{filteredFlashcards[currentIndex]?.question}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-12 flex items-center justify-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                      <RotateCw className="w-3 h-3" /> Cliquez pour retourner
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* BACK */}
                <Card className="absolute inset-0 w-full h-full bg-primary text-primary-foreground backdrop-blur-2xl border border-primary/30 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="absolute inset-0 bg-gradient-to-tl from-black/20 to-transparent opacity-60" />
                <CardContent className="flex flex-col items-center justify-center h-full p-6 sm:p-12 relative z-10">
                  <div className="text-center w-full">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Réponse</p>
                    <p className="text-2xl sm:text-4xl font-medium leading-relaxed text-primary-foreground drop-shadow-md">{filteredFlashcards[currentIndex]?.answer}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
            <Button onClick={handlePrevious} variant="outline" disabled={filteredFlashcards.length <= 1} className="w-full sm:w-32 rounded-full h-12 border-border hover:bg-muted text-foreground font-medium shadow-sm">Précédent</Button>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setIsFlipped(!isFlipped)} variant="ghost" size="icon"><RotateCw className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette flashcard ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteFlashcard(filteredFlashcards[currentIndex].id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>
            <Button onClick={handleNext} className="w-full sm:w-32 h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">Suivant</Button>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default Flashcards;

```


# File: src/pages/Summaries.tsx
```tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSearch, Plus, Trash2, Eye, BookOpen, FileText, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Summary { id: string; title: string; summary_type: string; content: string; created_at: string; }

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  complete: { icon: BookOpen, label: "Complet" },
  structured: { icon: FileText, label: "Structuré" },
  concise: { icon: Zap, label: "Concis" },
};

const Summaries = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchSummaries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from("summaries" as any).select("id, title, summary_type, content, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setSummaries((data as unknown as Summary[]) || []);
    } catch { toast.error("Erreur lors du chargement"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("summaries" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Résumé supprimé");
      fetchSummaries();
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const handleRefresh = async () => { setRefreshing(true); await fetchSummaries(); toast.success("Actualisé !"); };

  if (loading) {
    return (
      <div className="min-h-screen text-foreground font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
        <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="space-y-3">
              <div className="h-10 w-48 bg-muted rounded-xl animate-pulse"></div>
              <div className="h-4 w-32 bg-muted/60 rounded-md animate-pulse"></div>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <div className="h-12 w-40 bg-muted rounded-full animate-pulse"></div>
              <div className="h-12 w-12 bg-muted rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card/40 border border-border shadow-sm rounded-[2rem] p-6 animate-pulse">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-10 w-10 bg-muted rounded-xl"></div>
                  <div className="h-6 w-20 bg-muted rounded-full"></div>
                </div>
                <div className="h-6 w-3/4 bg-muted rounded-md mb-2"></div>
                <div className="h-4 w-1/3 bg-muted/60 rounded-md mb-6"></div>
                <div className="h-12 w-full bg-muted/50 rounded-lg mb-6"></div>
                <div className="flex gap-3">
                  <div className="h-10 w-10 bg-muted rounded-xl"></div>
                  <div className="h-10 w-full bg-muted rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">Mes Résumés</h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">Vos résumés générés par l'IA</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto justify-center sm:justify-end mt-4 sm:mt-0">
            <Button onClick={() => navigate("/generate-summary")} className="h-12 px-6 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nouveau résumé</span><span className="sm:hidden">Nouveau</span>
            </Button>
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing} className="h-12 w-12 rounded-full border-border hover:bg-muted text-foreground flex-shrink-0">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

      {summaries.length === 0 ? (
        <Card className="bg-card/40 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] p-8 mt-12">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-card/60 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center border border-border">
              <FileSearch className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-light text-foreground mb-2">Aucun résumé</h3>
            <p className="text-sm font-medium text-muted-foreground mb-8 text-center max-w-md">Créez votre premier résumé intelligent</p>
            <Button onClick={() => navigate("/generate-summary")} className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">
              <Plus className="h-5 w-5 mr-2" />Créer un résumé
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaries.map((summary, index) => {
            const config = typeConfig[summary.summary_type] || typeConfig.structured;
            const Icon = config.icon;
            return (
              <Card key={summary.id} className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] hover:shadow-md transition-all duration-300 animate-fade-in overflow-hidden" style={{ animationDelay: `${index * 80}ms` }}>
                <CardHeader className="p-6 border-b border-border">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-muted flex-shrink-0"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-muted text-muted-foreground">{config.label}</span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-medium leading-tight line-clamp-2">{summary.title}</CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground/80 mt-1">{new Date(summary.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-6 bg-card/30">
                  <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-6">{summary.content.substring(0, 100)}...</p>
                  <div className="flex gap-3">
                    <Button className="flex-1 h-11 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md" onClick={() => navigate(`/summary/${summary.id}`)}>
                      <Eye className="h-4 w-4 mr-2" />Voir
                    </Button>
                    <Button variant="outline" onClick={() => handleDelete(summary.id)} className="h-11 w-11 rounded-full border-destructive/20 text-destructive hover:bg-destructive/10 p-0 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default Summaries;

```


# File: src/pages/SummaryView.tsx
```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, BookOpen, FileText, Zap, Copy, Check, Eye, Code, Network, Info, Lightbulb, Move, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import MedicalSummaryCard from "@/components/MedicalSummaryCard";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CourseMindMap from "@/components/CourseMindMap";
import { motion, AnimatePresence } from "framer-motion";

interface Summary {
  id: string;
  title: string;
  summary_type: string;
  content: string;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string; bgColor: string }> = {
  complete: { icon: BookOpen, color: "text-blue-600", label: "Résumé Complet", bgColor: "bg-blue-500/10" },
  structured: { icon: FileText, color: "text-emerald-600", label: "Résumé Structuré", bgColor: "bg-emerald-500/10" },
  concise: { icon: Zap, color: "text-amber-500", label: "Fiche Concise", bgColor: "bg-amber-500/10" },
};

const SummaryView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "text" | "mindmap">("card");
  const [showMindmapGuide, setShowMindmapGuide] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("summaries")
          .select("id, title, summary_type, content, created_at")
          .eq("id", id)
          .single();
        if (error) throw error;
        setSummary(data as unknown as Summary);
      } catch (error) {
        console.error("Error fetching summary:", error);
        toast.error("Résumé introuvable");
        navigate("/summaries");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [id, navigate]);

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.content);
    setCopied(true);
    toast.success("Copié dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!summary) return;

    toast.loading("Génération du PDF en cours...", { id: "pdf-toast" });

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 25;
      const contentW = pageW - margin * 2;
      const footerY = pageH - 12;
      let pageNum = 1;
      let cursorY = margin;

      // ── Helpers ──────────────────────────────────────────────────
      const addPageHeaderFooter = (isFirst: boolean) => {
        // Header line
        pdf.setDrawColor(44, 62, 80);
        pdf.setLineWidth(0.3);
        pdf.line(margin, margin - 5, pageW - margin, margin - 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(127, 140, 141);
        if (!isFirst) {
          pdf.text("HIPPOCAMPUS", margin, margin - 7);
          pdf.text(summary.title.substring(0, 60), pageW - margin, margin - 7, { align: "right" });
        }
        // Footer
        pdf.setDrawColor(44, 62, 80);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY, pageW - margin, footerY);
        pdf.setFontSize(7);
        pdf.setTextColor(149, 165, 166);
        pdf.text("HIPPOCAMPUS — Faculté de Médecine", margin, footerY + 4);
        pdf.text(`Page ${pageNum}`, pageW - margin, footerY + 4, { align: "right" });
      };

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > footerY - 4) {
          pdf.addPage();
          pageNum++;
          cursorY = margin;
          addPageHeaderFooter(false);
        }
      };

      const wrapAndRender = (
        text: string,
        fontSize: number,
        fontFamily: string,
        fontStyle: string,
        textColor: [number, number, number],
        xOffset: number,
        lineSpacing: number,
        bulletPrefix?: string,
      ) => {
        pdf.setFont(fontFamily, fontStyle);
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...textColor);
        const effectiveW = contentW - xOffset;
        const normalizedText = text.replace(/[\u00A0\u200B\u202F\uFEFF]/g, " ").replace(/\s+/g, " ");
        const lines: string[] = pdf.splitTextToSize(normalizedText, effectiveW);
        for (let li = 0; li < lines.length; li++) {
          ensureSpace(lineSpacing);
          if (li === 0 && bulletPrefix) {
            pdf.setFont("helvetica", "normal");
            pdf.text(bulletPrefix, margin + xOffset - 5, cursorY);
            pdf.setFont(fontFamily, fontStyle);
          }
          pdf.text(lines[li], margin + xOffset, cursorY);
          cursorY += lineSpacing;
        }
      };

      /** Render a line that may contain **bold** segments mixed with normal text. */
      const renderMixedBoldLine = (
        rawText: string,
        fontSize: number,
        fontFamily: string,
        textColor: [number, number, number],
        xOffset: number,
        lineSpacing: number,
        bulletPrefix?: string,
      ) => {
        // Safe robust rendering: avoid character mapping bugs with jsPDF splitTextToSize
        const isFullyBold = rawText.trim().startsWith("**") && rawText.trim().endsWith("**");
        const cleanText = rawText.replace(/\*\*/g, "");
        wrapAndRender(cleanText, fontSize, fontFamily, isFullyBold ? "bold" : "normal", isFullyBold ? [26, 37, 47] : textColor, xOffset, lineSpacing, bulletPrefix);
      };

      // ── First-page Header & Footer ──────────────────────────────
      addPageHeaderFooter(true);

      // ── Elegant Title Block (first page) ────────────────────────
      cursorY = margin + 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(127, 140, 141);
      pdf.text("FACULTÉ DE MÉDECINE — NOTE DE SYNTHÈSE", pageW / 2, cursorY, { align: "center" });
      cursorY += 12;

      // Title
      pdf.setFont("times", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(26, 37, 47);
      const titleLines: string[] = pdf.splitTextToSize(summary.title, contentW - 10);
      for (const tl of titleLines) {
        pdf.text(tl, pageW / 2, cursorY, { align: "center" });
        cursorY += 9;
      }
      cursorY += 2;

      // Meta line
      const typeLabel = typeConfig[summary.summary_type]?.label || "Résumé";
      const dateStr = new Date(summary.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(52, 73, 94);
      pdf.text(`${typeLabel}  •  ${dateStr}  •  Rév. 1.0`, pageW / 2, cursorY, { align: "center" });
      cursorY += 6;

      // Decorative separator
      pdf.setDrawColor(44, 62, 80);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 30, cursorY, pageW - margin - 30, cursorY);
      cursorY += 12;

      // ── Content Rendering ───────────────────────────────────────
      const lines = summary.content.split("\n");
      const bodyColor: [number, number, number] = [52, 73, 94];
      const headingColor: [number, number, number] = [26, 37, 47];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Empty line → small vertical gap
        if (!trimmed) {
          cursorY += 3;
          continue;
        }

        // ── Main Heading (=== TITLE === or # TITLE) ──
        if (/^===\s*(.+?)\s*===$/.test(trimmed) || /^#\s+(.+)$/.test(trimmed)) {
          const text = trimmed.replace(/^===\s*/, "").replace(/\s*===$/, "").replace(/^#\s+/, "");
          cursorY += 6;
          ensureSpace(14);
          wrapAndRender(text, 20, "times", "bold", headingColor, 0, 8);
          // Underline
          pdf.setDrawColor(52, 73, 94);
          pdf.setLineWidth(0.3);
          pdf.line(margin, cursorY - 2, margin + Math.min(pdf.getTextWidth(text) * 0.6 + 10, contentW), cursorY - 2);
          cursorY += 3;
          continue;
        }

        // ── Subheading (-- TITLE -- or ## TITLE) ──
        if (/^--\s*(.+?)\s*--$/.test(trimmed) || /^##\s+(.+)$/.test(trimmed)) {
          const text = trimmed.replace(/^--\s*/, "").replace(/\s*--$/, "").replace(/^##\s+/, "");
          cursorY += 4;
          ensureSpace(12);
          wrapAndRender(text, 16, "times", "bolditalic", [44, 62, 80], 0, 7);
          cursorY += 2;
          continue;
        }

        // ── Bullet Point (- or *) ──
        if (/^[-*]\s/.test(trimmed)) {
          const text = trimmed.replace(/^[-*]\s/, "");
          ensureSpace(6);
          renderMixedBoldLine(text, 11, "helvetica", bodyColor, 10, 5.5, "•");
          cursorY += 1;
          continue;
        }

        // ── Regular Paragraph ──
        ensureSpace(6);
        renderMixedBoldLine(trimmed, 11, "helvetica", bodyColor, 0, 5.5);
        cursorY += 1.5;
      }

      // ── Save ────────────────────────────────────────────────────
      const cleanFileName = summary.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 30);
      pdf.save(`Polycopie_${cleanFileName}.pdf`);
      toast.success("PDF téléchargé avec succès !", { id: "pdf-toast" });
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la génération du PDF.", { id: "pdf-toast" });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="animate-pulse space-y-6 mt-4">
          <div className="flex gap-4">
            <div className="h-10 w-10 bg-muted rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-muted rounded-lg w-1/2" />
              <div className="h-4 bg-muted rounded-lg w-1/4" />
            </div>
          </div>
          <div className="h-[600px] bg-muted/50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const config = typeConfig[summary.summary_type] || typeConfig.structured;
  const Icon = config.icon;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-6xl min-h-screen">
      
      {/* ─── HEADER COMMAND BAR ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] shadow-sm border border-border/50">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/summaries")} className="flex-shrink-0 h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 pt-1">
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-tight mb-2">
              {summary.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${config.bgColor} ${config.color}`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground font-medium text-sm">
                Rédigé le {new Date(summary.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto bg-black/5 dark:bg-white/5 p-1.5 rounded-[1.5rem]">
          <Button 
            variant={viewMode === "card" ? "default" : "ghost"} 
            onClick={() => setViewMode("card")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "card" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Eye className="h-4 w-4 mr-2" /> Fiche
          </Button>
          <Button 
            variant={viewMode === "text" ? "default" : "ghost"} 
            onClick={() => setViewMode("text")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "text" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-4 w-4 mr-2" /> Texte
          </Button>
          <Button 
            variant={viewMode === "mindmap" ? "default" : "ghost"} 
            onClick={() => setViewMode("mindmap")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "mindmap" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Network className="h-4 w-4 mr-2" /> Carte
          </Button>
          
          <div className="w-px h-8 bg-border mx-1 hidden lg:block" />
          
          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button onClick={handleDownloadPDF} size="icon" className="h-11 w-11 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div id="pdf-content-area" className="w-full">
        {viewMode === "card" ? (
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <MedicalSummaryCard
              content={summary.content}
              title={summary.title}
              summaryType={summary.summary_type as "complete" | "structured" | "concise"}
            />
          </motion.div>
          
        ) : viewMode === "mindmap" ? (
          
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="space-y-4">
            
            {/* Mindmap Guide Banner */}
            <AnimatePresence>
              {showMindmapGuide && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 md:p-5 relative overflow-hidden"
                >
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => setShowMindmapGuide(false)}
                    className="absolute top-2 right-2 h-8 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                  >
                    Masquer le guide
                  </Button>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Lightbulb className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">Mode d'emploi de la Carte Mentale</h3>
                      <p className="text-indigo-800/70 dark:text-indigo-300/70 text-sm mb-4">Gérez vos idées visuellement avec des interactions simples :</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Move className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Glissez pour déplacer l'espace</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <MousePointerClick className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Double-clic pour modifier</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Plus className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Bouton + pour ajouter un nœud</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span>Touche Suppr pour effacer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-[2rem] overflow-hidden border border-border/50 shadow-2xl bg-white dark:bg-slate-950">
              <CourseMindMap content={summary.content} title={summary.title} />
            </div>
          </motion.div>

        ) : (
          
          /* ─── HIGH-END TEXT VIEW (Academic/Professorial Style) ─── */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="bg-[#FCFBF8] dark:bg-[#0D1117] text-[#2c3e50] dark:text-[#C9D1D9] max-w-[850px] mx-auto p-10 sm:p-16 lg:p-24 shadow-2xl rounded-[2rem] border border-[#EBE8DF] dark:border-white/10 print:shadow-none print:border-none relative overflow-hidden">
              
              {/* Paper texture overlay */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay pointer-events-none" />
              
              {/* Elegant header */}
              <div className="border-b-[1.5px] border-[#2c3e50]/20 dark:border-white/20 pb-10 mb-12 text-center relative z-10">
                <div className="w-16 h-16 mx-auto mb-6 opacity-20 dark:opacity-30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                
                <h4 className="text-[11px] font-bold tracking-[0.3em] text-[#7f8c8d] dark:text-[#8b949e] uppercase mb-5">
                  Faculté de Médecine — Note de Synthèse
                </h4>
                
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif leading-[1.15] text-[#1a252f] dark:text-white mb-6">
                  {summary.title}
                </h1>
                
                <div className="flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-[0.15em] text-[#34495e]/80 dark:text-[#8b949e]">
                  <span>{typeConfig[summary.summary_type]?.label || "Résumé"}</span>
                  <span>•</span>
                  <span>{new Date(summary.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</span>
                  <span>•</span>
                  <span>Rév. 1.0</span>
                </div>
              </div>
              
              {/* Refined Academic Content Typography */}
              <div className="font-serif text-[16px] sm:text-[17px] leading-[1.85] text-[#34495e] dark:text-[#C9D1D9] space-y-5 relative z-10">
                {summary.content.split("\n").map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={i} className="h-3" />;
                  
                  // Main Title (=== TITRE === or # TITRE)
                  if (/^===\s*(.+?)\s*===$/.test(trimmed) || /^#\s+(.+)$/.test(trimmed)) {
                    const text = trimmed.replace(/^===\s*/, "").replace(/\s*===$/, "").replace(/^#\s+/, "");
                    return (
                      <h2 key={i} className="text-2xl font-bold text-[#1a252f] dark:text-white mt-14 mb-6 pb-3 border-b border-[#EBE8DF] dark:border-white/10 font-serif tracking-tight">
                        {text}
                      </h2>
                    );
                  }
                  
                  // Subtitle (-- TITRE -- or ## TITRE)
                  if (/^--\s*(.+?)\s*--$/.test(trimmed) || /^##\s+(.+)$/.test(trimmed)) {
                    const text = trimmed.replace(/^--\s*/, "").replace(/\s*--$/, "").replace(/^##\s+/, "");
                    return (
                      <h3 key={i} className="text-xl font-semibold text-[#2c3e50] dark:text-gray-200 mt-10 mb-4 font-serif italic">
                        {text}
                      </h3>
                    );
                  }
                  
                  // Bullet Points
                  if (/^[\-\*]\s/.test(trimmed)) {
                    const text = trimmed.replace(/^[\-\*]\s/, "");
                    const formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#1a252f] dark:text-white'>$1</strong>").replace(/__(.*?)__/g, "<strong>$1</strong>");
                    return (
                      <div key={i} className="flex gap-4 my-2.5 pl-6 relative">
                        <span className="absolute left-1 top-[0.6em] w-1.5 h-1.5 rounded-full bg-[#3498db]/70 dark:bg-[#58a6ff]/70" />
                        <span dangerouslySetInnerHTML={{ __html: formattedText }} className="text-justify" />
                      </div>
                    );
                  }
                  
                  // Paragraph formatting (handling **bold**)
                  const formattedText = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#1a252f] dark:text-white'>$1</strong>").replace(/__(.*?)__/g, "<strong>$1</strong>");
                  
                  return (
                    <p key={i} className="my-4 text-justify font-serif" dangerouslySetInnerHTML={{ __html: formattedText }} />
                  );
                })}
              </div>
            </div>
          </motion.div>

        )}
      </div>
    </div>
  );
};

export default SummaryView;

```


# File: src/pages/QuizLibrary.tsx
```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, Calendar, Plus, Trash2, Download, FileDown, CheckCircle, Clock, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportQuizToPDF, exportQuizListToPDF } from "@/utils/pdfExport";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface QCMSession {
  id: string;
  title: string;
  questions: any;
  question_count: number;
  question_type?: string;
  ai_model?: string;
  status: string;
  created_at: string;
  courses?: {
    id: string;
    title: string;
    content?: string;
    file_name?: string;
  };
}

const QuizLibrary = () => {
  const [sessions, setSessions] = useState<QCMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchSessions();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("qcm_sessions")
        .select(`
          *,
          courses (
            id,
            title,
            content,
            file_name
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les QCM",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("qcm_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      setSessions(sessions.filter(session => session.id !== sessionId));
      toast({
        title: "QCM supprimé",
        description: "Le QCM a été supprimé avec succès",
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le QCM",
        variant: "destructive",
      });
    }
  };

  // Real-time subscription for QCM updates
  useRealtimeSubscription({
    table: "qcm_sessions",
    event: "*",
    onUpdate: fetchSessions,
  });

  const handleExportPDF = (session: QCMSession) => {
    try {
      const questions = Array.isArray(session.questions) ? session.questions : [];
      exportQuizToPDF({
        title: session.title,
        questions: questions.map((q: any) => ({
          question: q.question || "",
          choices: q.choices || [],
          correct: q.correct || [],
          explanation: q.explanation,
        })),
      });
      toast({
        title: "PDF généré",
        description: "Le QCM a été exporté avec succès",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportAllPDF = () => {
    try {
      const quizData = sessions.map(session => ({
        title: session.title,
        questions: Array.isArray(session.questions) ? session.questions.map((q: any) => ({
          question: q.question || "",
          choices: q.choices || [],
          correct: q.correct || [],
          explanation: q.explanation,
        })) : [],
      }));
      exportQuizListToPDF(quizData);
      toast({
        title: "PDF généré",
        description: "Le récapitulatif a été exporté avec succès",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getWordCount = (content?: string) => {
    if (!content || typeof content !== 'string') return 0;
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(word => word.length > 0).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen text-foreground font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="w-full">
            {/* Skeleton Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="space-y-3">
                <div className="h-10 w-48 bg-muted rounded-xl animate-pulse"></div>
                <div className="h-4 w-32 bg-muted/60 rounded-md animate-pulse"></div>
              </div>
              <div className="flex gap-3 mt-4 sm:mt-0">
                <div className="h-12 w-32 bg-muted rounded-full animate-pulse"></div>
                <div className="h-12 w-32 bg-muted rounded-full animate-pulse"></div>
              </div>
            </div>
            {/* Skeleton Cards */}
            <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card/40 border border-border shadow-sm rounded-[2rem] p-6 animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-6 w-2/3 bg-muted rounded-md"></div>
                    <div className="h-8 w-8 bg-muted rounded-md"></div>
                  </div>
                  <div className="flex gap-2 mb-6">
                    <div className="h-5 w-24 bg-muted rounded-md"></div>
                    <div className="h-5 w-16 bg-muted rounded-md"></div>
                  </div>
                  <div className="h-16 w-full bg-muted/50 rounded-lg mb-6"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-20 bg-muted rounded-md"></div>
                    <div className="flex gap-2">
                      <div className="h-10 w-24 bg-muted rounded-full"></div>
                      <div className="h-10 w-32 bg-muted rounded-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans py-8 relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-12">
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground mb-4 flex items-center justify-center gap-3">
                <FileText className="h-10 w-10 text-primary" />
                <span>Mes QCM</span>
              </h1>
              <p className="text-sm font-medium text-muted-foreground">
                Retrouvez tous vos questionnaires générés
              </p>
            </div>

            <Card className="bg-card/40 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] p-8 mt-12">
              <CardContent className="text-center p-0">
                <div className="bg-card/60 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center border border-border">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-light text-foreground mb-4">
                  Aucun QCM créé pour l'instant
                </h3>
                <p className="text-sm font-medium text-muted-foreground mb-8">
                  Ajoutez votre premier cours pour commencer à générer des questionnaires
                </p>
                <Button size="lg" asChild className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">
                  <Link to="/add-course" className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    <span>Créer mon premier QCM</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
            <div>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground flex items-center gap-3">
                <FileText className="h-10 w-10 text-primary flex-shrink-0" />
                <span>Mes QCM</span>
              </h1>
              <p className="text-sm font-medium text-muted-foreground mt-2">
                {sessions.length} questionnaire{sessions.length > 1 ? 's' : ''} disponible{sessions.length > 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Buttons - Stack on mobile, row on desktop */}
            <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
              <Button 
                variant="outline" 
                onClick={handleExportAllPDF} 
                className="flex-1 sm:flex-none h-12 rounded-full border-border hover:bg-muted text-foreground font-medium shadow-sm px-6"
              >
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exporter tout</span>
              </Button>
              <Button asChild className="flex-1 sm:flex-none h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md px-6">
                <Link to="/add-course" className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Nouveau</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Quiz Cards */}
          <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
            {sessions.map((session, index) => (
              <Card 
                key={session.id} 
                className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden hover:shadow-md transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="p-6 border-b border-border">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-xl sm:text-2xl font-medium leading-tight flex-1">
                      {session.title}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSession(session.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <CardDescription className="text-xs sm:text-sm mt-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(session.created_at)}</span>
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border-0">
                        {session.question_count} Q
                      </Badge>
                      {session.courses?.file_name && (
                        <Badge variant="outline" className="text-xs max-w-[120px] truncate hidden sm:inline-flex">
                          {session.courses.file_name}
                        </Badge>
                      )}
                    </div>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-6 pt-6 bg-card/30">
                  <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-6 hidden sm:block">
                    {session.courses?.content ? session.courses.content.substring(0, 150) : "Contenu non disponible"}...
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-success/20 text-success-foreground border-0 shadow-none text-xs font-bold uppercase tracking-wider px-3 py-1">
                        <CheckCircle className="h-3 w-3 mr-1.5" />
                        {session.status === "completed" ? "Complété" : "En cours"}
                      </Badge>
                      {session.ai_model && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 hidden sm:inline-flex">
                          {session.ai_model}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => handleExportPDF(session)}
                        className="flex-1 sm:flex-none h-11 rounded-full border-border hover:bg-muted text-foreground font-medium"
                      >
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="sm:inline hidden">PDF</span>
                      </Button>
                      <Button asChild className="flex-1 sm:flex-none h-11 rounded-full bg-primary/20 text-primary hover:bg-primary/30 font-medium border-0 shadow-none">
                        <Link to={`/exam/${session.id}`} className="flex items-center justify-center gap-2">
                          <Timer className="h-4 w-4" />
                          <span>Examen</span>
                        </Link>
                      </Button>
                      <Button asChild className="flex-1 sm:flex-none h-11 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">
                        <Link to={`/quiz/${session.id}`} className="flex items-center justify-center gap-2">
                          <Play className="h-4 w-4" />
                          <span>Commencer</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizLibrary;
```


# File: src/pages/Quiz.tsx
```tsx
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
```


# File: src/pages/Ecos.tsx
```tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, Activity, FileText, CheckCircle, XCircle, ArrowRight, RotateCcw, 
  UserCheck, Award, AlertCircle, Heart, Zap, Sparkles, Search, Dices, BookOpen, Loader2, Timer, Mic, Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EcgMonitor } from "@/components/ecos/EcgMonitor";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uiAudio } from "@/utils/audio";
import { cn } from "@/lib/utils";

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
  dangerous: number;
  explanation: string;
  morFeedback: string;
  effect: {
    bpm: number;
    spo2: number;
    bp: string;
    status: "stable" | "unstable" | "critical";
  };
}

interface Case {
  id: number;
  title: string;
  specialty: string;
  level: string;
  scenario: string;
  initialState: {
    bpm: number;
    spo2: number;
    bloodPressure: string;
    temperature: number;
    isStable: boolean;
    status: "stable" | "unstable" | "critical";
  };
  questions: Question[];
}

const CLINICAL_CASES: Case[] = [
  {
    id: 1,
    title: "Syndrome Coronarien Aigu (SCA)",
    specialty: "Cardiologie / Urgences",
    level: "D3 / ECNi",
    scenario: "Un patient de 56 ans, diabétique et tabagique, se présente aux urgences pour une douleur rétro-sternale constrictive irradiant vers la mâchoire et le bras gauche, survenue au repos il y a 2 heures.",
    initialState: {
      bpm: 94,
      spo2: 95,
      bloodPressure: "142/88",
      temperature: 36.8,
      isStable: false,
      status: "unstable",
    },
    questions: [
      {
        id: 1,
        text: "Quelle est votre première hypothèse diagnostique face à ce tableau clinique typique ?",
        options: [
          "Infarctus du Myocarde / Syndrome Coronarien Aigu (SCA)",
          "Péricardite aiguë non compliquée",
          "Spasme œsophagien diffus",
          "Dissection aortique aiguë"
        ],
        correct: 0,
        dangerous: 2,
        explanation: "La douleur constrictive rétro-sternale irradiante chez un patient présentant des facteurs de risque cardiovasculaires majeurs (tabac, diabète) doit faire suspecter en priorité absolue un SCA.",
        morFeedback: "⚠️ Attention : bien que d'autres pathologies causent des douleurs thoraciques, éliminer en priorité absolue le Syndrome Coronarien Aigu est la règle d'or aux urgences pour éviter une nécrose myocardique fatale.",
        effect: {
          bpm: 88,
          spo2: 95,
          bp: "138/82",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "Quel examen d'imagerie ou d'enregistrement électrique devez-vous réaliser en priorité absolue dans les 10 premières minutes de sa prise en charge ?",
        options: [
          "Un Électrocardiogramme (ECG) à 12 dérivations",
          "Une Radiographie pulmonaire de face",
          "Un Angio-scanner thoracique en urgence",
          "Un dosage de la Troponine sanguine"
        ],
        correct: 0,
        dangerous: 3,
        explanation: "La réalisation d'un ECG à 12 dérivations en moins de 10 minutes est indispensable pour diagnostiquer un sus-décalage du segment ST (SCA ST+) et initier la revascularisation immédiate.",
        morFeedback: "❌ ERREUR CLINIQUE ! Attendre le résultat de la troponine biologique avant de poser le diagnostic électrique d'un SCA ST+ fait perdre des minutes précieuses de survie myocardique. Le temps, c'est du muscle cardiaque !",
        effect: {
          bpm: 96,
          spo2: 94,
          bp: "145/90",
          status: "unstable"
        }
      },
      {
        id: 3,
        text: "L'ECG confirme un sus-décalage du segment ST en antérieur (SCA ST+). Quel traitement immédiat est contre-indiqué sans exclure formellement un syndrome hémorragique ou une dissection aortique ?",
        options: [
          "Double anti-agrégation plaquettaire + Anticoagulant à forte dose ou Fibrinolyse immédiate",
          "Administration d'Oxygène par lunettes nasales",
          "Pose d'une voie veineuse périphérique",
          "Prise de Paracétamol pour la douleur"
        ],
        correct: 0,
        dangerous: 0,
        explanation: "L'administration inappropriée d'anticoagulants ou de fibrinolytiques en présence d'une douleur thoracique atypique simulant un SCA (comme une dissection aortique) peut provoquer une hémorragie aortique ou péricardique foudroyante.",
        morFeedback: "🚨 DANGER DE MORT ! Administrer un traitement fibrinolytique ou anticoagulant massif en cas de suspicion concomitante de dissection aortique (par exemple si les pouls sont asymétriques) provoquera une rupture aortique fatale en quelques minutes !",
        effect: {
          bpm: 65,
          spo2: 97,
          bp: "120/75",
          status: "stable"
        }
      }
    ]
  },
  {
    id: 2,
    title: "Accident Vasculaire Cérébral (AVC) Ischémique",
    specialty: "Neurologie / Urgences",
    level: "D4 / ECOS national",
    scenario: "Une femme de 68 ans est amenée par les pompiers pour l'apparition soudaine, il y a 1h30, d'un déficit moteur complet du bras et de la jambe droite associé à une aphasie (perte de la parole).",
    initialState: {
      bpm: 78,
      spo2: 97,
      bloodPressure: "185/105",
      temperature: 36.6,
      isStable: false,
      status: "unstable",
    },
    questions: [
      {
        id: 1,
        text: "Quelle est votre première étape de prise en charge à l'arrivée aux urgences pour orienter le traitement de revascularisation ?",
        options: [
          "Prescrire une IRM ou un Scanner cérébral sans injection en extrême urgence",
          "Administrer immédiatement de l'Aspirine 300mg IV",
          "Faire baisser rapidement la pression artérielle par des antihypertenseurs IV",
          "Attendre l'avis écrit du neurologue de garde"
        ],
        correct: 0,
        dangerous: 1,
        explanation: "L'imagerie cérébrale immédiate (Scanner ou IRM) est indispensable pour différencier un AVC ischémique (accessible à la thrombolyse) d'un AVC hémorragique.",
        morFeedback: "🚨 GESTE DANGEREUX ! Injecter de l'aspirine ou des antiagrégants avant d'avoir éliminé un AVC hémorragique par scanner provoquera une extension catastrophique du saignement intracrânien.",
        effect: {
          bpm: 82,
          spo2: 97,
          bp: "188/108",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "L'imagerie élimine une hémorragie et confirme une occlusion de l'artère cérébrale moyenne gauche. Le début des symptômes remonte à 2 heures. Quelle thérapeutique de revascularisation est indiquée ?",
        options: [
          "Thrombolyse intraveineuse par rtPA (Altéplase) associée éventuellement à une thrombectomie mécanique",
          "Héparinothérapie curative immédiate",
          "Surveillance simple en unité classique de médecine",
          "Thrombectomie isolée sans thrombolyse"
        ],
        correct: 0,
        dangerous: 2,
        explanation: "La thrombolyse IV par rtPA est indiquée dans les 4h30 suivant le début des symptômes d'un AVC ischémique, et la thrombectomie mécanique dans les 6 heures en cas d'occlusion d'une grosse artère.",
        morFeedback: "⚠️ Attention : le nihilisme thérapeutique ou la simple surveillance sans revascularisation chez un patient éligible dans la fenêtre temporelle constitue une perte de chance majeure de récupération fonctionnelle.",
        effect: {
          bpm: 72,
          spo2: 98,
          bp: "140/85",
          status: "stable"
        }
      }
    ]
  },
  {
    id: 3,
    title: "Choc Anaphylactique aux Urgences",
    specialty: "Allergologie / Réanimation",
    level: "D3 / ECNi",
    scenario: "Un jeune homme de 24 ans est admis aux urgences suite à l'ingestion accidentelle de cacahuètes. Il présente une détresse respiratoire majeure (sifflements), un œdème du visage (Quincke) et des marbrures généralisées.",
    initialState: {
      bpm: 132,
      spo2: 86,
      bloodPressure: "78/42",
      temperature: 37.2,
      isStable: false,
      status: "critical",
    },
    questions: [
      {
        id: 1,
        text: "Devant cet état de choc anaphylactique avec collapsus cardiovasculaire et hypoxie sévère, quelle est la thérapeutique salvatrice immédiate ?",
        options: [
          "Injection intramusculaire d'Adrénaline en urgence",
          "Nébulisation de corticoïdes inhalés",
          "Remplissage vasculaire massif par 2L de cristalloïdes seuls",
          "Administration d'un antihistaminique par voie orale"
        ],
        correct: 0,
        dangerous: 3,
        explanation: "L'adrénaline par voie intramusculaire (IM) est le traitement de première ligne incontournable et salvateur du choc anaphylactique.",
        morFeedback: "🚨 URGENCE VITALE ÉVITÉE DE JUSTESSE ! Donner un antihistaminique par voie orale chez un patient en état de choc circulatoire avec hypoxie sévère est inutile et criminel : le patient va faire un arrêt cardiaque dans les minutes qui suivent !",
        effect: {
          bpm: 110,
          spo2: 92,
          bp: "105/65",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "Quelle est la dose et la voie d'administration recommandée pour l'Adrénaline chez l'adulte en choc anaphylactique ?",
        options: [
          "Adrénaline 0.5 mg par voie Intra-Musculaire (IM) dans la cuisse",
          "Adrénaline 1 mg par voie Intra-Veineuse (IV) directe rapide",
          "Adrénaline 5 mg en aérosol/inhalation",
          "Adrénaline 0.1 mg par voie Sous-Cutanée (SC)"
        ],
        correct: 0,
        dangerous: 1,
        explanation: "La recommandation officielle est l'injection IM de 0.5 mg d'adrénaline dans la face antéro-latérale de la cuisse chez l'adulte, répétable après 5-10 minutes.",
        morFeedback: "🚨 TOXICITÉ CARDIAQUE MAJEURE ! Injecter 1 mg d'adrénaline IV directe rapide chez un patient qui n'est pas en arrêt cardio-respiratoire peut déclencher une fibrillation ventriculaire fatale ou une hémorragie cérébrale par pic hypertensif !",
        effect: {
          bpm: 88,
          spo2: 97,
          bp: "122/74",
          status: "stable"
        }
      }
    ]
  }
];

const EcosPage = () => {
  const navigate = useNavigate();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [patientState, setPatientState] = useState<Case["initialState"] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [morComment, setMorComment] = useState<string>("");
  const [morStatus, setMorStatus] = useState<"normal" | "warning" | "success">("normal");
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Vocal Feature States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);

  // Text-to-Speech (Agent MOR)
  useEffect(() => {
    if (morComment && voiceModeEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(morComment);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      utterance.pitch = 1.1; // Slightly robotic/AI pitch
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }
  }, [morComment, voiceModeEnabled]);

  // Speech-to-Text (Microphone)
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Votre navigateur ne supporte pas la reconnaissance vocale.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("À l'écoute... Dites A, B, C, D ou le numéro de la réponse.", { duration: 2000 });
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech reco error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      toast.success(`Entendu : "${transcript}"`);
      
      if (selectedCase && !hasAnswered) {
        // Simple heuristic matching
        if (transcript.match(/\b(a|1|un|premier)\b/i)) handleAnswerSubmit(0);
        else if (transcript.match(/\b(b|2|deux|deuxième)\b/i)) handleAnswerSubmit(1);
        else if (transcript.match(/\b(c|3|trois|troisième)\b/i)) handleAnswerSubmit(2);
        else if (transcript.match(/\b(d|4|quatre|quatrième)\b/i)) handleAnswerSubmit(3);
        else {
           toast.warning("Réponse non reconnue. Veuillez cliquer ou répéter (A, B, C, D).");
        }
      }
    };

    recognition.start();
  };

  // Immersive Urgency Mode 60s
  const [isUrgencyMode, setIsUrgencyMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isShaking, setIsShaking] = useState(false);

  // Dynamic ECOS simulation builder parameters
  const [uploadedCourses, setUploadedCourses] = useState<{ id: string; title: string; content: string }[]>([]);
  const [difficulty, setDifficulty] = useState<"facile" | "moyen" | "difficile">("moyen");
  const [customTheme, setCustomTheme] = useState("");
  const [generationMode, setGenerationMode] = useState<"uploaded" | "search" | "random">("random");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // Fetch uploaded lessons on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("courses")
          .select("id, title, content")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          setUploadedCourses(data);
          if (data.length > 0) {
            setSelectedCourseId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading uploaded lessons:", err);
      }
    })();
  }, []);

  const generateEcosCase = () => {
    if (generationMode === "uploaded" && !selectedCourseId) {
      toast.error("Veuillez sélectionner une leçon parmi vos documents uploadés.");
      return;
    }
    if (generationMode === "search" && !searchText.trim()) {
      toast.error("Veuillez saisir un sujet ou mot-clé pour la recherche.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep(1);

    const playTone = (freq: number, dur: number) => {
      try {
        const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) setAudioContext(ctx);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {}
    };

    playTone(523.25, 0.08);

    setTimeout(() => {
      setGenerationStep(2);
      playTone(587.33, 0.08);
    }, 1200);

    setTimeout(() => {
      setGenerationStep(3);
      playTone(659.25, 0.08);
    }, 2400);

    setTimeout(() => {
      let finalTitle = "";
      let finalSpecialty = customTheme.trim() || "Urgences Cliniques";
      let finalScenario = "";
      let levelLabel = difficulty === "facile" ? "D1 / D2 (Facile)" : difficulty === "moyen" ? "D3 / D4 (Moyen)" : "ECOS national (Difficile)";
      
      let baseBpm = 82;
      let baseSpo2 = 96;
      let baseBp = "120/80";
      let baseTemp = 37.0;

      if (generationMode === "uploaded") {
        const selectedCourse = uploadedCourses.find(c => c.id === selectedCourseId);
        finalTitle = selectedCourse ? `ECOS : ${selectedCourse.title}` : "Cas ECOS sur Mesure";
        finalScenario = `Un patient se présente dans votre service clinique en rapport direct avec votre document d'étude médicale : "${selectedCourse?.title || "Cours d'études"}". L'analyse des données de votre cours a mis en évidence des signes prodromiques typiques devant être explorés d'urgence.`;
      } else if (generationMode === "search") {
        finalTitle = `Simulation : ${searchText}`;
        finalScenario = `Un patient de 42 ans est admis en consultation pour des symptômes évocateurs de : "${searchText}". L'interrogatoire retrouve un début insidieux des signes depuis plusieurs jours.`;
      } else {
        const randomSpecialties = ["Pneumologie", "Pédiatrie", "Gastro-entérologie", "Gynécologie", "Urgences"];
        const randomTopics = ["Asthme aigu grave", "Meningite à méningocoque", "Occlusion intestinale aiguë", "Pré-éclampsie sévère", "Choc cardiogénique"];
        const selectedIdx = Math.floor(Math.random() * randomTopics.length);
        finalTitle = `Cas Aléatoire : ${randomTopics[selectedIdx]}`;
        finalSpecialty = randomSpecialties[selectedIdx];
        finalScenario = `Le SAMU vous contacte pour réguler un appel concernant un patient présentant un tableau clinique bruyant évocateur de ${randomTopics[selectedIdx]}. Le patient est en cours de transfert vers votre unité de déchocage.`;
      }

      if (difficulty === "difficile") {
        baseBpm = 135;
        baseSpo2 = 88;
        baseBp = "85/45";
        baseTemp = 39.2;
      } else if (difficulty === "moyen") {
        baseBpm = 108;
        baseSpo2 = 93;
        baseBp = "145/95";
        baseTemp = 38.1;
      }

      const generatedCase: Case = {
        id: Date.now(),
        title: finalTitle,
        specialty: finalSpecialty,
        level: levelLabel,
        scenario: finalScenario,
        initialState: {
          bpm: baseBpm,
          spo2: baseSpo2,
          bloodPressure: baseBp,
          temperature: baseTemp,
          isStable: difficulty === "facile",
          status: difficulty === "facile" ? "stable" : difficulty === "moyen" ? "unstable" : "critical"
        },
        questions: [
          {
            id: 1,
            text: "Face à ce tableau clinique d'admission, quel est votre premier geste réflexe ou examen complémentaire de première intention à réaliser en urgence ?",
            options: [
              "Vérifier les constantes vitales immédiates (Scope ECG, SpO2, Pression artérielle) et libérer les voies aériennes",
              "Prescrire un bilan biologique complet avec hémocultures et gaz du sang",
              "Demander une consultation spécialisée et attendre l'avis du senior de garde",
              "Administrer directement un sédatif pour calmer l'anxiété du patient"
            ],
            correct: 0,
            dangerous: 3,
            explanation: "La règle de base en médecine d'urgence (ABCDE) impose de sécuriser d'abord les fonctions vitales (Voies aériennes, Respiration, Circulation) avant tout examen invasif.",
            morFeedback: "🚨 ERREUR CRITIQUE ! Administrer un sédatif ou retarder la prise en charge sans évaluer les fonctions vitales peut entraîner un arrêt respiratoire immédiat ou masquer un état de choc débutant.",
            effect: {
              bpm: Math.max(70, baseBpm - 15),
              spo2: Math.min(99, baseSpo2 + 4),
              bp: "120/80",
              status: "stable"
            }
          },
          {
            id: 2,
            text: "Les premiers examens orientent vers une complication aiguë. Quelle est votre stratégie thérapeutique immédiate conformes aux recommandations actuelles ?",
            options: [
              "Mettre en place une surveillance rapprochée et débuter le traitement spécifique ciblé immédiatement",
              "Attendre l'imagerie de contrôle du lendemain avant d'initier toute thérapeutique active",
              "Remplir le patient massivement par 4 litres de sérum physiologique en moins de 30 minutes",
              "Transférer immédiatement le patient dans un autre établissement sans le stabiliser au préalable"
            ],
            correct: 0,
            dangerous: 2,
            explanation: "L'initiation rapide du traitement adapté (ex: antibiothérapie, bronchodilatateurs, ou revascularisation) est le facteur pronostic majeur dans les urgences vitales.",
            morFeedback: "⚠️ DANGER : Un remplissage vasculaire trop massif et trop rapide hors état de choc hypovolémique strict expose le patient à un œdème aigu du poumon (OAP) cardiogénique iatrogène foudroyant !",
            effect: {
              bpm: Math.max(65, baseBpm - 20),
              spo2: Math.min(100, baseSpo2 + 6),
              bp: "118/75",
              status: "stable"
            }
          }
        ]
      };

      setIsGenerating(false);
      setGenerationStep(0);
      startCase(generatedCase);
      playTone(880, 0.25);
      confetti({ particleCount: 100, spread: 80 });
    }, 3600);
  };

  // Sound generator
  const triggerTone = (freq: number, dur: number, type: "sine" | "triangle" | "sawtooth" = "sine", gainVal = 0.1) => {
    try {
      const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) setAudioContext(ctx);
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // Manage heartbeat audio loops and timer countdown
  useEffect(() => {
    if (selectedCase && !isFinished && isUrgencyMode) {
      const bpm = patientState?.bpm || 80;
      uiAudio.startHeartbeatLoop(bpm);
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            const currentQuestion = selectedCase.questions[currentStep];
            handleAnswerSubmit(currentQuestion.dangerous);
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 800);
            toast.error("⌛ TEMPS ÉCOULÉ ! Une erreur critique de retard de soin a été enregistrée.");
            return 60;
          }
          if (prev <= 16) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 200);
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        uiAudio.stopHeartbeatLoop();
      };
    } else {
      uiAudio.stopHeartbeatLoop();
    }
  }, [selectedCase, isFinished, isUrgencyMode, currentStep, patientState?.bpm]);

  useEffect(() => {
    if (!selectedCase || isFinished) {
      uiAudio.stopHeartbeatLoop();
    }
  }, [selectedCase, isFinished]);

  const startCase = (c: Case) => {
    setSelectedCase(c);
    setPatientState({ ...c.initialState });
    setCurrentStep(0);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setScore(0);
    setIsFinished(false);
    setMorStatus("normal");
    setMorComment(`Bonjour confrère. Je suis l'Agent MOR, chef de clinique de garde. Nous accueillons ce patient présentant un tableau clinique délicat de ${c.title}. Installez le patient et examinez les constantes.`);
    triggerTone(523.25, 0.25, "sine", 0.08); // Sweet C note
    setTimeLeft(60); // Reset countdown
  };

  const handleAnswerSubmit = (optionIndex: number) => {
    if (hasAnswered || !selectedCase || !patientState) return;

    setSelectedAnswer(optionIndex);
    setHasAnswered(true);

    const question = selectedCase.questions[currentStep];
    const isCorrect = optionIndex === question.correct;
    const isDangerous = optionIndex === question.dangerous;

    if (isCorrect) {
      triggerTone(880, 0.3, "sine", 0.1); // Correct beep
      setScore(prev => prev + 100);
      setMorStatus("success");
      setMorComment(`✨ Excellent diagnostic ! ${question.morFeedback || "Choix clinique tout à fait adapté et validé par les recommandations de l'HAS."}`);
      
      // Update constants positively
      setPatientState(prev => prev ? {
        ...prev,
        bpm: question.effect.bpm,
        spo2: question.effect.spo2,
        bloodPressure: question.effect.bp,
        status: question.effect.status
      } : null);
    } else {
      triggerTone(180, 0.45, "triangle", 0.15); // Alarm buzzer
      setMorStatus("warning");
      
      if (isDangerous) {
        setScore(prev => Math.max(0, prev - 80)); // Heavy penalty
        setMorComment(question.morFeedback);
        
        // Push constants to dangerous zone
        setPatientState(prev => prev ? {
          ...prev,
          bpm: Math.min(150, prev.bpm + 15),
          spo2: Math.max(80, prev.spo2 - 6),
          status: "critical"
        } : null);
      } else {
        setScore(prev => Math.max(0, prev - 40));
        setMorComment(`❌ Mauvais choix. ${question.morFeedback || "Cette action retarde la prise en charge ou n'est pas recommandée."}`);
      }
    }
  };

  const handleNextStep = () => {
    if (!selectedCase) return;

    if (currentStep < selectedCase.questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setMorStatus("normal");
      setMorComment("Le patient évolue. Analysons la situation clinique suivante pour orienter la suite de la prise en charge.");
      triggerTone(587.33, 0.15, "sine", 0.06); // Sweet D note
      setTimeLeft(60); // Reset countdown
    } else {
      // Completed!
      setIsFinished(true);
      if (score >= selectedCase.questions.length * 75) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        triggerTone(523.25, 0.15);
        setTimeout(() => triggerTone(659.25, 0.15), 150);
        setTimeout(() => triggerTone(783.99, 0.35), 300); // Triumph chord
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-dashboard bg-doodle-watermark relative overflow-hidden space-y-6">
      {/* Background glow filters */}
      <div className="absolute top-[-10%] right-[-10%] w-[380px] h-[380px] bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[380px] h-[380px] bg-violet-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
        <div className="space-y-1">
          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 uppercase font-black tracking-widest text-[10px] px-3 py-1">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> Simulateur ECOS Clinique
          </Badge>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
            Arène d'Immersion ECOS
          </h1>
          <p className="text-xs text-muted-foreground/80 font-medium">
            Entraînez-vous aux urgences en temps réel, gérez les constantes vitales et évitez les erreurs critiques sous le contrôle de l'Agent MOR.
          </p>
        </div>

        {selectedCase && (
          <Button 
            onClick={() => setSelectedCase(null)} 
            variant="outline" 
            className="rounded-full font-bold gap-2 text-xs h-10 hover:bg-muted/40 transition-all border-border"
          >
            <RotateCcw className="h-4 w-4" /> Changer de Cas
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedCase ? (
          /* CASE CHOOSE & BUILDER MENU */
          <motion.div
            key="case-select-and-builder"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-12 pt-4"
          >
            {/* Embedded Custom Styles for Shimmer and Telemetry Animations */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes shimmerSweep {
                0% { left: -100%; }
                100% { left: 100%; }
              }
              .shimmer-sweep::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
                transition: all 0.6s ease;
              }
              .shimmer-sweep:hover::after {
                animation: shimmerSweep 1.6s infinite;
              }
              .telemetry-glow {
                box-shadow: 0 0 25px rgba(var(--primary-rgb), 0.15);
              }
            `}} />

            {/* IA CLINICAL BUILDER COMPONENT */}
            <Card className="bg-gradient-to-br from-card/80 via-card/45 to-background/50 backdrop-blur-3xl border border-white/10 dark:border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.35)] rounded-[3rem] overflow-hidden p-6 md:p-10 relative group/builder">
              {/* Pulsing Backlit Radial Glows */}
              <div className="absolute top-[-25%] left-[-15%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[110px] pointer-events-none animate-[pulse_6s_infinite_alternate]" />
              <div className="absolute bottom-[-25%] right-[-15%] w-[400px] h-[400px] bg-violet-500/15 rounded-full blur-[110px] pointer-events-none animate-[pulse_8s_infinite_alternate_2s]" />
              
              <div className="space-y-8 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-primary/20 to-violet-500/20 border border-primary/30 text-primary shadow-inner">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-foreground uppercase bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text">
                        Concepteur ECOS Clinique MOR-IA
                      </h2>
                      <p className="text-xs text-muted-foreground font-medium">
                        Calibrez les paramètres cliniques d'urgence et instanciez une station d'immersion clinique sur mesure.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Mode Urgence 60s Toggle */}
                    <div className="flex items-center gap-3.5 bg-background/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Timer className={`h-4 w-4 ${isUrgencyMode ? "text-rose-500 animate-pulse" : "text-muted-foreground"}`} />
                        <div className="text-left">
                          <p className="text-[9px] font-black uppercase tracking-wider text-foreground">MODE URGENCE 60s</p>
                          <p className="text-[7px] font-extrabold text-muted-foreground uppercase tracking-widest leading-none">Pulsation Cardiaque 3D</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          uiAudio.playSoftClick();
                          setIsUrgencyMode(!isUrgencyMode);
                        }}
                        className={`w-10 h-5.5 rounded-full transition-all duration-300 relative focus:outline-none ${
                          isUrgencyMode ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-muted"
                        }`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white h-4.5 w-4.5 rounded-full transition-all duration-300 shadow-sm ${
                          isUrgencyMode ? "translate-x-4.5" : "translate-x-0"
                        }`} />
                      </button>
                    </div>

                    <Badge className="bg-primary/15 text-primary border border-primary/30 rounded-xl font-bold uppercase tracking-widest text-[9px] px-3.5 py-1.5 animate-[pulse_3s_infinite]">
                      🔥 MOTEUR V2 ACTIF
                    </Badge>
                  </div>
                </div>

                {isGenerating ? (
                  /* HIGH END MEDICAL GENERATION LOADER */
                  <div className="py-16 flex flex-col items-center justify-center space-y-8">
                    <div className="relative">
                      {/* Pulse waves */}
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-[ping_1.8s_infinite]" />
                      <div className="absolute inset-[-10px] rounded-full bg-violet-500/5 animate-[ping_2.4s_infinite]" />
                      <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary border-r-primary/45 animate-spin relative z-10 flex items-center justify-center bg-card">
                        <Activity className="h-10 w-10 text-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center space-y-3 max-w-md mx-auto">
                      <motion.p 
                        key={generationStep}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-base font-black text-foreground uppercase tracking-widest"
                      >
                        {generationStep === 1 && "🩺 Extraction des concepts cliniques..."}
                        {generationStep === 2 && "⚡ Calibrage du scope de réanimation..."}
                        {generationStep === 3 && "🧠 Synthèse de la station ECOS par l'Agent MOR..."}
                      </motion.p>
                      <Progress value={generationStep * 33.3} className="h-1.5 w-48 mx-auto bg-muted" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        L'intelligence clinique MOR modélise les diagnostics différentiels, la courbe ECG dynamique et les paliers d'urgence pour cette station.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* BUILDER FORM CONTAINER */
                  <div className="grid md:grid-cols-12 gap-10">
                    {/* LEFT BUILDER PARAMETERS (5 cols) */}
                    <div className="md:col-span-5 space-y-8">
                      {/* Difficulty parameter */}
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-primary" /> 1. Niveau Clinique Souhaité
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {(["facile", "moyen", "difficile"] as const).map((level) => {
                            const isActive = difficulty === level;
                            return (
                              <motion.button
                                key={level}
                                type="button"
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDifficulty(level)}
                                className={`py-3 px-3.5 rounded-2xl border-2 text-xs font-bold capitalize transition-all duration-300 flex flex-col items-center justify-center gap-1.5 shadow-md ${
                                  isActive
                                    ? level === "facile"
                                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/5"
                                      : level === "moyen"
                                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-amber-500/5"
                                      : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-rose-500/5"
                                    : "border-white/5 dark:border-white/10 hover:border-white/10 hover:dark:border-white/20 text-foreground/80 hover:bg-muted/30 bg-muted/10"
                                }`}
                              >
                                <span className="text-base">
                                  {level === "facile" && "🟢"}
                                  {level === "moyen" && "🟡"}
                                  {level === "difficile" && "🔴"}
                                </span>
                                <span className="text-[10px] uppercase font-black tracking-wider">{level}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Specialty theme parameter */}
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-rose-500" /> 2. Spécialité ou Thème
                        </label>
                        <div className="relative group/input">
                          <Activity className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/75 transition-colors group-focus-within/input:text-primary" />
                          <input
                            type="text"
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                            placeholder="Ex: Cardiologie, Pédiatrie, Gynécologie..."
                            className="w-full bg-muted/20 border-2 border-white/5 dark:border-white/10 focus:border-primary hover:border-white/10 transition-all duration-300 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 shadow-inner"
                          />
                        </div>
                        {/* Quick tags suggestions with micro-animations */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {["Urgences", "Pédiatrie", "Cardiologie", "Neurologie", "Traumatologie"].map((tag, idx) => (
                            <motion.button
                              key={tag}
                              type="button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              whileHover={{ scale: 1.08, y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCustomTheme(tag)}
                              className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all ${
                                customTheme === tag
                                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                                  : "bg-muted/40 hover:bg-muted border-white/5 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {tag}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT GENERATION SOURCE MODE (7 cols) */}
                    <div className="md:col-span-7 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" /> 3. Source du Support Médical
                        </label>

                        {/* 3 Premium interactive Cards for choices */}
                        <div className="grid sm:grid-cols-3 gap-4">
                          {/* Option A: Uploaded lessons */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("uploaded")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "uploaded"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "uploaded" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Mes Documents</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">ECOS issu de vos PDF ou résumés uploadés.</p>
                            </div>
                          </motion.button>

                          {/* Option B: Search / custom topic */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("search")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "search"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "search" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <Search className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Sujet Libre</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">Saisissez un thème de cours ou pathologie.</p>
                            </div>
                          </motion.button>

                          {/* Option C: Random generation */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("random")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "random"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "random" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <Dices className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Surprise IA</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">Laisser MOR IA inventer une urgence typique.</p>
                            </div>
                          </motion.button>
                        </div>

                        {/* Conditional content input container with fluid heights */}
                        <AnimatePresence mode="wait">
                          <motion.div 
                            key={generationMode}
                            initial={{ opacity: 0, height: 0, y: -8 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -8 }}
                            className="p-5 rounded-2xl bg-muted/10 border border-white/5 dark:border-white/10 mt-4 overflow-hidden"
                          >
                            {generationMode === "uploaded" && (
                              <div className="w-full space-y-3">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Sélectionnez le document de cours :</span>
                                {uploadedCourses.length > 0 ? (
                                  <select
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                    className="w-full bg-background border-2 border-white/10 focus:border-primary transition-all rounded-xl px-4 py-3 text-xs font-semibold text-foreground"
                                  >
                                    {uploadedCourses.map((course) => (
                                      <option key={course.id} value={course.id}>
                                        📚 {course.title}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="text-[10px] text-amber-500 font-black flex items-center gap-1.5">
                                    ⚠️ Aucun document disponible. Veuillez télécharger un fichier PDF dans l'Espace Création pour l'utiliser ici.
                                  </p>
                                )}
                              </div>
                            )}

                            {generationMode === "search" && (
                              <div className="w-full space-y-3">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Sujet de la leçon à simuler :</span>
                                <div className="relative">
                                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Entrez le thème (ex: Diabète de type 1 complété d'acidocétose)"
                                    className="w-full bg-background border-2 border-white/10 focus:border-primary transition-all rounded-xl pl-10 pr-3 py-2.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 shadow-inner"
                                  />
                                </div>
                              </div>
                            )}

                            {generationMode === "random" && (
                              <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-semibold">
                                🎲 **Mode Surprise Clinique** : L'IA va modéliser un cas typique à haute prévalence clinique. Les questions adapteront automatiquement leur pertinence selon votre niveau choisi.
                              </p>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Main action submit button with Shimmer Sweep Animation */}
                      <motion.button
                        whileHover={{ scale: 1.025, y: -2, boxShadow: "0 20px 40px rgba(99,102,241,0.25)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={generateEcosCase}
                        className="w-full h-14 rounded-[2rem] font-black uppercase text-[11px] tracking-widest bg-gradient-to-r from-primary via-indigo-500 to-violet-600 text-primary-foreground shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2.5 mt-6 relative overflow-hidden group/btn shimmer-sweep"
                      >
                        <Sparkles className="h-4.5 w-4.5 text-primary-foreground animate-[pulse_1.5s_infinite]" />
                        <span>Générer ma Simulation Clinique MOR-IA</span>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* PRE-DEFINED ORIGINAL ECOS CASES */}
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 pb-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Ou Choisissez un Cas ECOS Clinique Prédéfini
                </h3>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {CLINICAL_CASES.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, type: "spring", stiffness: 100 }}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer group h-full"
                    onClick={() => startCase(c)}
                  >
                    <Card className="h-full bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-xl rounded-[2.5rem] overflow-hidden flex flex-col justify-between transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-primary/5">
                      <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="font-extrabold uppercase text-[9px] tracking-wider rounded-xl">
                              {c.specialty}
                            </Badge>
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase">
                              {c.level}
                            </Badge>
                          </div>

                          <h3 className="text-base font-bold group-hover:text-primary transition-colors leading-tight">
                            {c.title}
                          </h3>
                          
                          <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium line-clamp-3">
                            {c.scenario}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Heart className="h-3.5 w-3.5 text-rose-500 animate-pulse" /> {c.questions.length} Étapes Cliniques
                          </span>
                          <Button size="sm" className="rounded-full font-bold text-[10px] h-8.5 bg-primary text-primary-foreground group-hover:bg-primary/90 transition-all shadow-md px-4">
                            Diagnostiquer <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : isFinished ? (
          /* CLINICAL RESULTS CARD */
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto pt-6"
          >
            <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-2xl rounded-[3rem] overflow-hidden text-center p-8 space-y-6 relative">
              <div className="absolute top-[-10%] right-[-10%] w-[180px] h-[180px] bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
              
              <div className="relative flex items-center justify-center h-24 my-2">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 120, delay: 0.15 }}
                  className="p-5 rounded-full bg-primary/15 border border-primary/20 text-primary shadow-lg"
                >
                  <Award className="h-10 w-10 animate-bounce" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Prise en charge terminée !</h2>
                <p className="text-xs text-muted-foreground">Voici le bilan clinique officiel validé par l'Agent MOR :</p>
              </div>

              {/* Score and stats breakdown */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-3xl border border-border">
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80">Diagnostic Score</span>
                  <p className="text-3xl font-black text-primary font-mono">{score} <span className="text-xs text-muted-foreground/60">/ {selectedCase.questions.length * 100}</span></p>
                </div>
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80">Statut Patient</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${patientState?.status === "stable" ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                    <span className={`text-xs font-black uppercase tracking-wider ${patientState?.status === "stable" ? "text-emerald-500" : "text-rose-500"}`}>
                      {patientState?.status === "stable" ? "STABILISÉ ✅" : "CRITIQUE 🚨"}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/90 leading-relaxed font-medium px-4">
                {score >= selectedCase.questions.length * 75
                  ? " Félicitations Docteur ! Votre esprit d'analyse clinique et votre réactivité ont permis de stabiliser et sauver le patient dans le respect total des recommandations médicales."
                  : " Attention Confrère : des choix thérapeutiques non conformes ou dangereux ont ralenti la prise en charge. Prenez le temps de bien relire les fiches explicatives pour éviter ces écueils au lit du patient."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => startCase(selectedCase)} 
                  variant="outline" 
                  className="w-full h-12 rounded-full font-bold gap-2 text-xs border-border"
                >
                  <RotateCcw className="h-4 w-4" /> Recommencer le Cas
                </Button>
                <Button 
                  onClick={() => setSelectedCase(null)} 
                  className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg shadow-primary/10"
                >
                  Retour aux Cas ECOS
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* CLINICAL INTERACTIVE SIMULATOR */
          <motion.div
            key="simulation-room"
            initial={{ opacity: 0, y: 15 }}
            animate={isShaking ? {
              x: [-6, 6, -6, 6, -3, 3, 0],
              y: [-3, 3, -3, 3, -1, 1, 0],
              boxShadow: "0 0 45px rgba(239, 68, 68, 0.25)"
            } : { opacity: 1, y: 0 }}
            transition={isShaking ? { duration: 0.22, repeat: 1 } : { duration: 0.3 }}
            exit={{ opacity: 0, y: -15 }}
            className={cn(
              "grid lg:grid-cols-12 gap-6 pt-2 transition-all duration-300",
              isUrgencyMode && timeLeft <= 15 && !hasAnswered && "border-2 border-rose-500/40 rounded-[3rem] p-3 bg-rose-950/10 shadow-[0_0_55px_rgba(239,68,68,0.25)] animate-pulse"
            )}
          >
            {/* LEFT COLUMN: ECG and patient constants (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <EcgMonitor 
                bpm={patientState?.bpm || 0}
                spo2={patientState?.spo2 || 95}
                bloodPressure={patientState?.bloodPressure || "120/80"}
                temperature={patientState?.temperature || 36.8}
                isStable={patientState?.isStable || true}
                status={patientState?.status || "stable"}
              />

              {/* History brief */}
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Anamnèse Initiale
                </h4>
                <p className="text-xs text-muted-foreground/90 leading-relaxed font-medium">
                  {selectedCase.scenario}
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                  <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-wider">{selectedCase.specialty}</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase">Étape {currentStep + 1} / {selectedCase.questions.length}</Badge>
                </div>
              </Card>
            </div>

            {/* MIDDLE COLUMN: Case decisions and Question Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 shadow-xl rounded-[2.5rem] overflow-hidden flex flex-col h-full">
                <div className="h-1.5 w-full bg-muted/20">
                  <motion.div 
                    className="h-full bg-primary" 
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / selectedCase.questions.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                <CardContent className="p-6 md:p-8 space-y-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-muted-foreground/75 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-primary" /> Décision Thérapeutique
                      </span>
                      {isUrgencyMode && !hasAnswered && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[10px] font-black transition-all duration-300",
                          timeLeft <= 15
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                            : "bg-primary/5 border-primary/20 text-primary"
                        )}>
                          <Timer className="h-3.5 w-3.5 animate-[spin_4s_linear_infinite]" />
                          <span>CHRONO : {timeLeft}s</span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-foreground leading-relaxed text-base md:text-lg">
                      {selectedCase.questions[currentStep].text}
                    </h3>

                    {/* Microphone Action Button */}
                    {!hasAnswered && (
                      <div className="flex justify-center pt-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleListening}
                          className={cn(
                            "flex items-center gap-3 px-6 py-3 rounded-full border shadow-sm transition-all duration-300 relative overflow-hidden",
                            isListening 
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-500" 
                              : "bg-background border-border hover:bg-muted text-foreground"
                          )}
                        >
                          {isListening && (
                            <div className="absolute inset-0 bg-rose-500/20 animate-[pulse_1s_infinite]" />
                          )}
                          <div className={cn(
                            "p-2 rounded-full",
                            isListening ? "bg-rose-500 text-white animate-pulse" : "bg-primary/10 text-primary"
                          )}>
                            <Mic className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest relative z-10">
                            {isListening ? "Écoute en cours..." : "Dicter la réponse"}
                          </span>
                        </motion.button>
                      </div>
                    )}

                    {/* Choices Stagger List */}
                    <div className="grid gap-3 pt-2">
                      {selectedCase.questions[currentStep].options.map((option, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = idx === selectedCase.questions[currentStep].correct;
                        const isDangerous = idx === selectedCase.questions[currentStep].dangerous;

                        return (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, type: "spring", stiffness: 120 }}
                            disabled={hasAnswered}
                            onClick={() => handleAnswerSubmit(idx)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all text-xs font-semibold flex items-center justify-between ${
                              hasAnswered && isCorrect
                                ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                                : hasAnswered && isSelected && !isCorrect
                                ? isDangerous 
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                                : isSelected
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-border-hover hover:bg-muted/30 text-foreground/90"
                            }`}
                          >
                            <div className="flex items-start gap-3.5 pr-2">
                              <span className={`flex-shrink-0 h-6.5 w-6.5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                hasAnswered && isCorrect
                                  ? "bg-green-500 text-white"
                                  : hasAnswered && isSelected && !isCorrect
                                  ? "bg-rose-500 text-white"
                                  : isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {hasAnswered && isCorrect ? <CheckCircle className="h-3.5 w-3.5" /> :
                                 hasAnswered && isSelected && !isCorrect ? <XCircle className="h-3.5 w-3.5" /> : letter}
                              </span>
                              <span className="pt-0.5 leading-relaxed">{option}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action step buttons */}
                  {hasAnswered && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-4 border-t border-border/50 flex flex-col space-y-3"
                    >
                      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-[11px] leading-relaxed text-muted-foreground/90 font-medium shadow-inner">
                        <span className="font-bold text-primary block mb-0.5">💡 Justification Médicale :</span>
                        {selectedCase.questions[currentStep].explanation}
                      </div>

                      <Button 
                        onClick={handleNextStep}
                        className="w-full h-11 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg shadow-primary/10 gap-1.5 transition-all self-end"
                      >
                        {currentStep < selectedCase.questions.length - 1 ? "Étape Suivante" : "Terminer la prise en charge"} 
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: AI Agent MOR Tutor Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
              <Card className={`bg-card/45 backdrop-blur-2xl border rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-500 ${
                morStatus === "warning"
                  ? "border-rose-500/30 shadow-rose-500/5 animate-[pulse_2s_infinite]"
                  : morStatus === "success"
                  ? "border-green-500/20 shadow-green-500/5"
                  : "border-white/5"
              }`}>
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-xl ${
                      morStatus === "warning" ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                    }`}>
                      <Zap className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-foreground">Chef de Clinique IA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setVoiceModeEnabled(!voiceModeEnabled)} className={cn("p-1.5 rounded-full transition-colors", voiceModeEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider">
                      Agent MOR
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-5">
                  {/* Mor Character Visual representation */}
                  <div className="flex items-center gap-3 bg-[#0c111d] p-3 rounded-2xl border border-white/5 shadow-inner">
                    <div className="relative">
                      <div className={cn(
                        "h-10 w-10 rounded-full bg-gradient-to-tr flex items-center justify-center text-white font-black text-xs shadow-md transition-all duration-300",
                        morStatus === "warning" ? "from-rose-500 to-red-500" : morStatus === "success" ? "from-emerald-500 to-green-500" : "from-violet-500 to-indigo-500",
                        isSpeaking && "animate-pulse ring-4 ring-primary/20"
                      )}>
                        MOR
                      </div>
                      <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c111d] ${
                        morStatus === "warning" ? "bg-rose-500 animate-ping" : "bg-green-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-foreground truncate">Agent MOR</p>
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest">Tuteur Académique</p>
                    </div>
                  </div>

                  {/* Speech bubble */}
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed font-medium border relative ${
                    morStatus === "warning"
                      ? "bg-rose-500/5 border-rose-500/15 text-rose-600 dark:text-rose-400"
                      : morStatus === "success"
                      ? "bg-green-500/5 border-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-muted/40 border-border/50 text-muted-foreground/90"
                  }`}>
                    <p>{morComment}</p>
                  </div>

                  {/* Live clinic statistics feedback */}
                  <div className="space-y-3 pt-1 border-t border-border/40 text-[10px]">
                    <div className="flex justify-between items-center text-muted-foreground/80 font-bold uppercase tracking-wider">
                      <span>Précision de garde</span>
                      <span className="font-mono text-foreground font-black">{score} pts</span>
                    </div>
                    <Progress value={score ? (score / (selectedCase.questions.length * 100)) * 100 : 0} className="h-1 bg-muted" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EcosPage;

```


# File: src/pages/Review.tsx
```tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, Brain, RefreshCw, RotateCcw, Trash2, CheckSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculateSM2, getQualityLabel, getQualityColor } from "@/lib/sm2Algorithm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReviewFlashcard {
  id: string; question: string; answer: string; course_id: string;
  ease_factor: number; interval: number; repetitions: number; next_review: string;
  courses: { title: string };
}

const Review = () => {
  const [cards, setCards] = useState<ReviewFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const fetchDueCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.from("flashcards").select("id, question, answer, course_id, ease_factor, interval, repetitions, next_review, courses(title)").eq("user_id", user.id).lte("next_review", today).order("next_review", { ascending: true });
      if (error) throw error;
      setCards((data as any) || []);
    } catch (error) { console.error("Error:", error); toast.error("Erreur de chargement"); } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { fetchDueCards(); }, [fetchDueCards]);

  // Get unique courses from due cards
  const cardCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cards) { if (c.courses?.title && !map.has(c.course_id)) map.set(c.course_id, c.courses.title); }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (selectedFilter === "all") return cards;
    return cards.filter(c => c.course_id === selectedFilter);
  }, [cards, selectedFilter]);

  const handleRate = async (quality: number) => {
    if (updating || !filteredCards[currentIndex]) return;
    setUpdating(true);
    const card = filteredCards[currentIndex];
    const newParams = calculateSM2(quality, { ease_factor: card.ease_factor, interval: card.interval, repetitions: card.repetitions, next_review: card.next_review });
    try {
      const { error } = await supabase.from("flashcards").update({ ease_factor: newParams.ease_factor, interval: newParams.interval, repetitions: newParams.repetitions, next_review: newParams.next_review }).eq("id", card.id);
      if (error) throw error;
      const newCards = cards.filter((c) => c.id !== card.id);
      setCards(newCards);
      setCurrentIndex((prev) => (prev >= filteredCards.length - 1 ? 0 : prev));
      setShowAnswer(false);
      toast(quality >= 3 ? "Bien joué !" : "Cette carte reviendra bientôt.", { icon: quality >= 3 ? "✅" : "🔄" });
    } catch { toast.error("Erreur"); } finally { setUpdating(false); }
  };

  const handleMassDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) { toast.error("Erreur"); return; }
    setCards(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set()); setSelectMode(false); setCurrentIndex(0);
    toast.success(`${ids.length} carte(s) supprimée(s)`);
  };

  if (loading) return <div className="container mx-auto p-3 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-96 bg-muted rounded-lg"></div></div></div>;

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-[1400px] mx-auto relative z-10">
          <Card className="text-center py-16 bg-card/40 backdrop-blur-md rounded-[2rem] border border-border shadow-sm mt-12">
            <CardHeader>
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-6" />
              <CardTitle className="text-2xl sm:text-3xl font-light">Toutes vos révisions sont à jour !</CardTitle>
              <CardDescription className="text-base mt-2">Aucune flashcard à réviser. Revenez demain !</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button onClick={() => navigate("/flashcards")} variant="outline" className="h-12 px-8 rounded-full border-border hover:bg-muted text-foreground font-medium shadow-sm">Voir mes flashcards</Button>
              <Button onClick={() => navigate("/quiz-library")} className="h-12 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">Faire un quiz</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const current = filteredCards[currentIndex];

  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 text-center sm:text-left">
        <div>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground flex items-center justify-center sm:justify-start gap-3">
            <Brain className="h-10 w-10 text-primary" />Révision
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-2">Algorithme SM-2 — Mémorisez durablement</p>
        </div>
        <div className="flex gap-2 justify-center sm:justify-end">
          {cards.length > 0 && (
            <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} variant={selectMode ? "default" : "outline"} size="sm" className={selectMode ? "bg-foreground text-background" : "border-foreground/30"}>
              <CheckSquare className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sélection</span>
            </Button>
          )}
          <Button onClick={fetchDueCards} variant="outline" size="sm" className="border-foreground/30"><RefreshCw className="h-4 w-4 mr-2" />Actualiser</Button>
        </div>
      </div>

      {/* Filter by lesson */}
      {cardCourses.length > 1 && (
        <Tabs value={selectedFilter} onValueChange={(v) => { setSelectedFilter(v); setCurrentIndex(0); setShowAnswer(false); }}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="all" className="text-xs">Toutes ({cards.length})</TabsTrigger>
            {cardCourses.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs truncate max-w-[150px]">
                {c.title} ({cards.filter(card => card.course_id === c.id).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Mass delete */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer {selectedIds.size} carte(s) ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {selectMode ? (
        <div className="space-y-2">
          {filteredCards.map((card) => (
            <div key={card.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(card.id) ? "bg-destructive/5 border-destructive/30" : "bg-card border-border/50 hover:bg-muted/30"}`}
              onClick={() => { const next = new Set(selectedIds); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); setSelectedIds(next); }}>
              <Checkbox checked={selectedIds.has(card.id)} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{card.question}</p>
                <p className="text-xs text-muted-foreground truncate">{card.courses?.title}</p>
              </div>
            </div>
          ))}
        </div>
      ) : current ? (
        <>
          <div className="flex items-center justify-between">
            <Badge variant="outline">{currentIndex + 1} / {filteredCards.length} à réviser</Badge>
            <Badge variant="secondary" className="max-w-[200px] truncate">{current.courses?.title}</Badge>
          </div>

          <Card className="min-h-[350px] bg-card/80 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none" />
            <CardHeader className="p-6 sm:p-10 border-b border-border/50 relative z-10">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 animate-pulse" />
                <CardTitle className="text-2xl sm:text-3xl font-light leading-relaxed text-foreground">{current.question}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-10 relative z-10">
              <AnimatePresence mode="wait">
              {showAnswer ? (
                <motion.div key="answer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <div className="p-6 bg-gradient-to-br from-green-50/90 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 backdrop-blur-md rounded-2xl border border-green-200/50 dark:border-green-800/30 shadow-inner">
                    <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-400 mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Réponse :</p>
                    <p className="text-xl sm:text-2xl text-green-900 dark:text-green-100 font-medium leading-relaxed">{current.answer}</p>
                  </div>
                  <div className="space-y-4 pt-6 mt-6 border-t border-border/50">
                    <p className="text-sm font-bold text-center text-muted-foreground uppercase tracking-widest">Comment avez-vous trouvé cette carte ?</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[0, 1, 2, 3, 4, 5].map((q, idx) => (
                        <motion.div key={q} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                          <Button variant={q >= 3 ? "default" : "outline"} size="sm" disabled={updating} onClick={() => handleRate(q)} className={`w-full flex flex-col h-16 rounded-xl border-border/50 transition-all hover:scale-105 shadow-sm hover:shadow-md ${getQualityColor(q)} ${q >= 3 ? 'text-white' : 'hover:bg-muted/50'}`}>
                            <span className="text-2xl font-light">{q}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">{getQualityLabel(q)}</span>
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-12 pb-6">
                  <Button onClick={() => setShowAnswer(true)} variant="outline" className="w-full h-14 rounded-full border-border/50 bg-background/50 hover:bg-muted text-foreground font-medium shadow-sm hover:shadow-md text-lg transition-all group">
                    <RotateCcw className="h-5 w-5 mr-3 group-hover:-rotate-90 transition-transform duration-500" />Voir la réponse
                  </Button>
                </motion.div>
              )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </>
      ) : null}
      </div>
    </div>
  );
};

export default Review;

```


# File: src/pages/ReviewPlanner.tsx
```tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Calendar, ChevronLeft, ChevronRight, RotateCw,
  CheckCircle, XCircle, ThumbsUp, ThumbsDown, Zap,
  BookOpen, TrendingUp, Target, Sparkles, Bell, BellRing, Timer
} from "lucide-react";
import { useSpacedRepetition, type ReviewCard } from "@/hooks/useSpacedRepetition";
import { toast } from "sonner";

const QUALITY_BUTTONS = [
  { quality: 1, label: "Pas su", icon: XCircle, color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground", desc: "Réponse oubliée" },
  { quality: 3, label: "Difficile", icon: ThumbsDown, color: "bg-orange-500 hover:bg-orange-600 text-white", desc: "Rappel laborieux" },
  { quality: 4, label: "Correct", icon: ThumbsUp, color: "bg-primary hover:bg-primary/90 text-primary-foreground", desc: "Après hésitation" },
  { quality: 5, label: "Facile", icon: Zap, color: "bg-emerald-500 hover:bg-emerald-600 text-white", desc: "Réponse immédiate" },
];

const ReviewPlanner = () => {
  const navigate = useNavigate();
  const { dueCards, stats, forecast, loading, reviewCard, refreshCards } = useSpacedRepetition();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReviewing) {
      interval = setInterval(() => setSessionTime((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isReviewing]);

  // Check notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Votre navigateur ne supporte pas les notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Notifications activées !");
      new Notification("Hippocampus", {
        body: "Les rappels de révision sont maintenant actifs.",
        icon: "/vite.svg"
      });
    } else {
      toast.error("Permission refusée pour les notifications.");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const currentCard: ReviewCard | undefined = dueCards[currentIndex];

  const handleRate = useCallback(async (quality: number) => {
    if (!currentCard) return;

    const success = await reviewCard(currentCard.id, quality);
    if (success) {
      setSessionCompleted(prev => prev + 1);
      setIsFlipped(false);

      if (currentIndex >= dueCards.length - 1) {
        setIsReviewing(false);
        toast.success("Session terminée ! 🎉");
      } else {
        setCurrentIndex(prev => Math.min(prev, dueCards.length - 2));
      }
    }
  }, [currentCard, currentIndex, dueCards.length, reviewCard]);

  const startSession = () => {
    setIsReviewing(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement du planificateur...</p>
        </div>
      </div>
    );
  }

  // ─── Active review session ─────────────────────────────────
  if (isReviewing && currentCard) {
    const progress = dueCards.length > 0 ? ((sessionCompleted) / (sessionCompleted + dueCards.length)) * 100 : 100;
    return (
      <div className="min-h-screen bg-background bg-doodle-watermark py-4 sm:py-8 relative">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setIsReviewing(false)}>
                <ChevronLeft className="h-4 w-4 mr-1" />Quitter
              </Button>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 bg-background/50 backdrop-blur-md">
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono">{formatTime(sessionTime)}</span>
                </Badge>
                <Badge variant="outline" className="text-sm bg-background/50 backdrop-blur-md">
                  {sessionCompleted} révisée{sessionCompleted > 1 ? "s" : ""} · {dueCards.length} restante{dueCards.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            <Progress value={progress} className="h-2" />

            {/* Flashcard */}
            <Card
              className="min-h-[350px] sm:min-h-[420px] cursor-pointer bg-card/70 backdrop-blur-xl border border-border rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity duration-500 ${isFlipped ? "opacity-100" : "opacity-0"}`} />
              <CardContent className="flex flex-col items-center justify-center min-h-[350px] sm:min-h-[420px] p-6 sm:p-12 relative z-10">
                <Badge variant="secondary" className="mb-6 text-xs">{currentCard.courseName}</Badge>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-4">
                  {isFlipped ? "Réponse" : "Question"}
                </p>
                <p className="text-xl sm:text-3xl font-light leading-relaxed text-foreground text-center">
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-8 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 group-hover:animate-spin" /> Cliquez pour retourner
                </p>
              </CardContent>
            </Card>

            {/* Rating buttons — shown only when flipped */}
            {isFlipped && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-center text-sm text-muted-foreground font-medium">Comment avez-vous répondu ?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {QUALITY_BUTTONS.map(({ quality, label, icon: Icon, color, desc }) => (
                    <button
                      key={quality}
                      onClick={() => handleRate(quality)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl transition-all ${color} shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="font-semibold text-sm">{label}</span>
                      <span className="text-[10px] opacity-80">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Session complete or Dashboard view ────────────────────
  return (
    <div className="min-h-screen bg-background bg-doodle-watermark text-foreground px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto space-y-6 relative z-10">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground flex items-center gap-3">
              <Calendar className="h-10 w-10 text-primary" />
              Planificateur
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              Répétition espacée intelligente · Algorithme SM-2
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant={notificationsEnabled ? "default" : "outline"} 
              size="sm" 
              onClick={enableNotifications} 
              className={`border-foreground/30 shadow-sm ${notificationsEnabled ? "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent" : ""}`}
            >
              {notificationsEnabled ? <BellRing className="h-4 w-4 mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
              {notificationsEnabled ? "Rappels activés" : "Activer les rappels"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refreshCards()} className="border-foreground/30 shadow-sm">
              <RotateCw className="h-4 w-4 mr-1" /> Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.dueToday}</p>
              <p className="text-xs text-muted-foreground mt-1">À réviser aujourd'hui</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.dueTomorrow}</p>
              <p className="text-xs text-muted-foreground mt-1">Prévues demain</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.masteredCards}</p>
              <p className="text-xs text-muted-foreground mt-1">Maîtrisées (21j+)</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.totalCards}</p>
              <p className="text-xs text-muted-foreground mt-1">Total flashcards</p>
            </CardContent>
          </Card>
        </div>

        {/* Session completed message */}
        {sessionCompleted > 0 && !isReviewing && (
          <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10 border-emerald-500/30 rounded-2xl">
            <CardContent className="p-6 text-center">
              <Sparkles className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-xl font-semibold mb-1">Session terminée ! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                Vous avez révisé <strong>{sessionCompleted}</strong> carte{sessionCompleted > 1 ? "s" : ""} aujourd'hui.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Start Session CTA */}
        {stats.dueToday > 0 ? (
          <Card className="bg-card/70 backdrop-blur-md border border-border rounded-2xl overflow-hidden">
            <CardContent className="p-8 text-center">
              <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">
                {stats.dueToday} carte{stats.dueToday > 1 ? "s" : ""} à réviser
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                L'algorithme SM-2 a calculé le moment optimal pour réviser ces cartes.
                Ne ratez pas votre créneau !
              </p>
              <Button size="lg" onClick={startSession} className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-12 text-base shadow-md">
                <Zap className="h-5 w-5 mr-2" />
                Commencer la révision
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Tout est à jour ! ✨</h2>
              <p className="text-muted-foreground mb-6">
                Aucune carte à réviser pour le moment. Revenez {stats.dueTomorrow > 0 ? "demain" : "plus tard"} !
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/flashcards")} className="border-foreground/30">
                  <BookOpen className="h-4 w-4 mr-2" />Mes Flashcards
                </Button>
                <Button variant="outline" onClick={() => navigate("/add-course")} className="border-foreground/30">
                  <Brain className="h-4 w-4 mr-2" />Générer un QCM
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7-day Forecast */}
        <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Prévisions sur 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className={`flex flex-col items-center p-3 rounded-xl transition-colors ${
                    day.count > 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{day.label}</span>
                  <span className={`text-xl font-bold mt-1 ${day.count > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                    {day.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground">carte{day.count !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewPlanner;

```


# File: src/pages/MyPlan.tsx
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Sparkles, Zap, Shield, Coins, ArrowUpRight, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface ProfileLite { plan: string | null; credits: number | null; first_name: string | null; name: string | null; }

const planMeta: Record<string, { label: string; color: string; icon: JSX.Element; perks: string[] }> = {
  gratuit: { label: "Gratuit", color: "bg-muted text-foreground", icon: <Sparkles className="h-5 w-5" />, perks: ["QCM limités", "1 résumé court / jour", "Pas de mode duel"] },
  premium: { label: "Premium", color: "bg-primary/10 text-primary", icon: <Zap className="h-5 w-5" />, perks: ["QCM illimités", "Résumés intermédiaire & complet", "Mode examen & flashcards", "Mor IA"] },
  pro: { label: "Pro", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: <Crown className="h-5 w-5" />, perks: ["Tout Premium", "Mode duel multijoueur", "Crédits IA prioritaires", "Support prioritaire"] },
  admin: { label: "Admin", color: "bg-destructive/15 text-destructive", icon: <Shield className="h-5 w-5" />, perks: ["Accès complet à toutes les fonctionnalités"] },
};

const MyPlan = () => {
  const { plan: rolePlan, isAdmin, loading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Attempt to update the plan to "gratuit"
      const { error } = await supabase
        .from("profiles")
        .update({ plan: "gratuit" })
        .eq("id", user.id);

      if (error) throw error;

      // Verify the update actually persisted (RLS may silently block it)
      const { data: verifyProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (verifyProfile?.plan && verifyProfile.plan !== "gratuit") {
        // RLS blocked the update — the plan is still premium/pro
        toast.error(
          "La résiliation n'a pas pu être effectuée (restriction serveur). Contactez le support pour résilier votre abonnement.",
          { duration: 6000 }
        );
        setIsCancelling(false);
        setIsConfirmingCancel(false);
        return;
      }

      toast.success("Votre abonnement a été résilié avec succès. Rechargement en cours...");
      
      // Force a full page reload to sync all components (sidebar, subscription page, etc.)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la résiliation de l'abonnement.");
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (active) setLoading(false); return; }
        const { data, error } = await supabase
          .from("profiles")
          .select("plan, credits, first_name, name")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        if (active) setProfile(data as ProfileLite);
      } catch (e: any) {
        toast.error("Impossible de charger votre plan");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const effectivePlan = isAdmin ? "admin" : (profile?.plan || rolePlan || "gratuit");
  const meta = planMeta[effectivePlan] || planMeta.gratuit;
  const isPremium = effectivePlan === "premium" || effectivePlan === "pro" || effectivePlan === "admin";

  return (
    <div className="min-h-screen bg-background bg-doodle-watermark p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Mon plan</h1>
          <p className="text-sm text-muted-foreground">Visualisez votre abonnement et vos crédits.</p>
        </header>

        {loading || roleLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${meta.color}`}>{meta.icon}</div>
                <div>
                  <CardTitle className="text-xl">{meta.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">Statut: {isPremium ? "Actif ✓" : "Aucun abonnement"}</p>
                </div>
              </div>
              <Badge className={meta.color} variant="outline">{effectivePlan.toUpperCase()}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 text-sm font-medium"><Coins className="h-4 w-4" /> Crédits IA</div>
                <span className="text-lg font-bold">{isAdmin ? "∞" : (profile?.credits ?? 0)}</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Avantages inclus</p>
                <ul className="text-sm text-foreground/80 space-y-1 list-disc pl-5">
                  {meta.perks.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {!isPremium && (
                  <Button asChild className="flex-1"><Link to="/subscription">Passer Premium <ArrowUpRight className="h-4 w-4 ml-1" /></Link></Button>
                )}
                <Button asChild variant="outline" className="flex-1"><Link to="/pricing">Voir les tarifs</Link></Button>
                <Button asChild variant="ghost" className="flex-1"><Link to="/refund"><ReceiptText className="h-4 w-4 mr-1" /> Remboursement</Link></Button>
              </div>

              {isPremium && effectivePlan !== "admin" && (
                <div className="pt-4 border-t border-border mt-4">
                  {isConfirmingCancel ? (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
                      <p className="text-xs font-semibold text-destructive-foreground text-center">
                        ⚠️ Êtes-vous sûr de vouloir résilier votre abonnement Premium ? Vous perdrez instantanément vos avantages cliniques illimités.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={handleCancelSubscription} 
                          disabled={isCancelling}
                          variant="destructive" 
                          size="sm"
                          className="font-bold text-xs"
                        >
                          {isCancelling ? "Résiliation..." : "Oui, résilier"}
                        </Button>
                        <Button 
                          onClick={() => setIsConfirmingCancel(false)} 
                          variant="outline" 
                          size="sm"
                          className="font-bold text-xs"
                        >
                          Conserver mon plan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => setIsConfirmingCancel(true)}
                      variant="destructive" 
                      className="w-full rounded-xl font-bold text-xs hover:bg-destructive/90 gap-1.5"
                    >
                      Résilier mon abonnement Premium
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Les changements de plan ne peuvent être effectués que par un administrateur (protégé côté serveur via RLS et trigger).
        </p>
      </div>
    </div>
  );
};

export default MyPlan;

```
