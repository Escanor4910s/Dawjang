import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, TrendingUp, Target, Sun, Moon, ChevronDown, ChevronUp, Monitor, CheckCircle2, Play, Pause, RotateCcw, Volume2, VolumeX, Timer, Brain, ArrowRight, Activity, Medal, Star, ShieldAlert, Network } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useOnboardingContext } from "@/components/onboarding/OnboardingProvider";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate, useTransform, useSpring } from "framer-motion";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { uiAudio } from "@/utils/audio";
import { Button } from "@/components/ui/button";

interface ActiveFocusUser { user_id: string; first_name: string; avatar_url: string | null; is_focusing: boolean; }
interface QuizResult { id: string; course_id: string; score: number; total_questions: number; created_at: string; courses: { title: string; }; }

// ─── INGÉNIERIE QUANTIQUE (Composants Magnétiques 200/200) ───

// Bouton Magnétique : Attire l'élément vers la souris
const MagneticWrapper = ({ children, strength = 0.2 }: { children: React.ReactNode, strength?: number }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (left + width / 2)) * strength);
    y.set((e.clientY - (top + height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div onMouseMove={handleMouse} onMouseLeave={reset} style={{ x: springX, y: springY }} className="inline-block relative z-50">
      {children}
    </motion.div>
  );
};

const DrawnArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M10 90 Q 40 10 90 10 M 70 10 L 90 10 L 90 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "anticipate", delay: 0.5 }} />
  </svg>
);

const HighlightCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M 50 10 C 80 10 90 40 90 50 C 90 80 40 90 30 80 C 10 60 20 10 50 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, ease: "easeInOut", delay: 0.2 }} />
  </svg>
);

// Odromètre Ultra-Fluide
const CountUp = ({ end, suffix = "", duration = 2000 }: { end: number, suffix?: string, duration?: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0; const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); } 
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <>{count}{suffix}</>;
};

// Égaliseur Audio Physique
const AudioEqualizer = () => (
  <div className="flex items-end gap-[3px] h-3.5 w-3.5">
    {[1, 2, 3].map((i) => (
      <motion.div key={i} animate={{ height: ["20%", "100%", "20%"] }} transition={{ repeat: Infinity, duration: 0.35 + (i * 0.1), ease: "easeInOut" }} className="flex-1 bg-[#5B21B6] rounded-t-[1px] shadow-[0_0_8px_rgba(91,33,182,0.9)]" />
    ))}
  </div>
);

// Spotlight Holographique (Glass Volumétrique)
const SpotlightCard = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const mouseX = useMotionValue(0); const mouseY = useMotionValue(0);
  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left); mouseY.set(clientY - top);
  }
  return (
    <motion.div layout onClick={onClick} onMouseMove={handleMouseMove} className={`relative group bg-white/70 dark:bg-[#050505]/70 backdrop-blur-3xl border border-black/5 dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[2.5rem] overflow-hidden transition-all duration-700 hover:border-[#5B21B6]/50 hover:shadow-[0_20px_80px_-20px_rgba(91,33,182,0.25),inset_0_1px_1px_rgba(255,255,255,0.5)] hover:-translate-y-1.5 ${className}`}>
      <motion.div className="pointer-events-none absolute -inset-px rounded-[2.5rem] opacity-0 transition duration-500 group-hover:opacity-100 z-0" style={{ background: useMotionTemplate`radial-gradient(700px circle at ${mouseX}px ${mouseY}px, rgba(91,33,182,0.15), transparent 40%)` }} />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};

// Skeleton Cinétique
const DashboardBentoSkeleton = () => (
  <div className="min-h-screen bg-transparent p-4 sm:p-8 space-y-8 overflow-hidden">
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div className="w-full h-40 bg-black/5 dark:bg-white/5 rounded-[3rem] animate-pulse relative overflow-hidden"><div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" /></div>
      <div className="grid grid-cols-2 md:grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-2 md:col-span-3 h-[350px] bg-black/5 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
        <div className="col-span-2 md:col-span-6 h-[200px] bg-black/5 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
        <div className="col-span-2 md:col-span-3 h-[200px] bg-black/5 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
        <div className="col-span-2 md:col-span-9 h-[200px] bg-black/5 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
        <div className="col-span-2 md:col-span-12 h-[300px] bg-black/5 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({ "recent": true, "devices": false, "benefits": false });
  const navigate = useNavigate();
  const { steps, completionPercentage, isComplete, refreshState } = useOnboardingContext();

  const toggleAccordion = (key: string) => setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));

  const hour = new Date().getHours();
  const timeContext = hour < 5 ? { text: "Nocturne", icon: Moon, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" } : hour < 12 ? { text: "Matinée", icon: Sun, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" } : hour < 18 ? { text: "Après-midi", icon: Activity, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" } : { text: "Soirée", icon: Moon, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" };
  const TimeIcon = timeContext.icon;

  const checkAuth = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };

  // Gamification (XP)
  const [xp, setXp] = useState(0);
  const currentLevel = Math.floor(Math.sqrt(xp / 100)) + 1;
  const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
  const xpProgress = (xp / xpForNextLevel) * 100;

  const fetchResults = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("first_name, name, avatar_url").eq("id", user.id).single();
      if (profile) { setFirstName(profile.first_name || profile.name || user.email?.split("@")[0] || ""); if (profile.avatar_url) setAvatarUrl(profile.avatar_url); }
      const { data, error } = await supabase.from("quiz_results").select(`id, course_id, score, total_questions, created_at, courses(title)`).eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setResults(data || []);
      if (data) setXp(data.reduce((acc, curr) => acc + (curr.score * 15), 1250));
    } catch (error) { toast.error("Erreur de synchronisation neurale"); } finally { setLoading(false); }
  }, []);

  useRealtimeSubscription({ table: 'quiz_results', event: '*', onUpdate: fetchResults });
  useEffect(() => { checkAuth(); fetchResults(); refreshState(); }, [fetchResults, refreshState]);

  // Pomodoro
  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isBinauralPlaying, setIsBinauralPlaying] = useState(false);
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && focusTimeLeft > 0) interval = setInterval(() => setFocusTimeLeft(prev => prev - 1), 1000);
    else if (focusTimeLeft === 0) { setIsTimerRunning(false); uiAudio.playSuccess(); toast.success("🏆 IMMERSION TERMINÉE !"); }
    return () => clearInterval(interval);
  }, [isTimerRunning, focusTimeLeft]);
  useEffect(() => { return () => uiAudio.stopBinauralBeats(); }, []);

  // Presence
  const [activeFocusUsers, setActiveFocusUsers] = useState<ActiveFocusUser[]>([]);
  useEffect(() => {
    if (!firstName) return;
    const presenceChannel = supabase.channel('focus_room');
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const users = Object.values(presenceChannel.presenceState()).flatMap(p => p as unknown as ActiveFocusUser[]);
      setActiveFocusUsers(Array.from(new Map(users.map(item => [item.user_id, item])).values()).filter(u => u.is_focusing));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { const { data } = await supabase.auth.getUser(); await presenceChannel.track({ user_id: data.user?.id, first_name: firstName, avatar_url: avatarUrl, is_focusing: isTimerRunning }); }
    });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [firstName, avatarUrl, isTimerRunning]);

  // Stats
  const averageScore = results.length > 0 ? Math.round((results.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / results.length)) : 0;
  const successRate = results.length > 0 ? Math.round((results.filter(r => (r.score / r.total_questions) * 100 >= 60).length / results.length) * 100) : 0;
  const themeStats = results.reduce((acc, r) => { const title = r.courses?.title || "Sans titre"; if (!acc[title]) acc[title] = { total: 0, correct: 0, count: 0 }; acc[title].total += r.total_questions; acc[title].correct += r.score; acc[title].count += 1; return acc; }, {} as Record<string, { total: number; correct: number; count: number }>);
  const themePerformance = Object.entries(themeStats).map(([theme, stats]) => ({ theme, score: Math.round((stats.correct / stats.total) * 100), count: stats.count })).sort((a, b) => b.score - a.score);
  const bestTheme = themePerformance[0];
  const chartData = results.slice(0, 8).reverse().map((r, i) => ({ name: `Q${i+1}`, score: Math.round((r.score / r.total_questions) * 100), title: r.courses?.title || "Sujet" }));

  // ─── MISSIONS HORIZONTALES INTELLIGENTES ───
  const extendedMissions = useMemo(() => {
    return [
      ...steps.map(s => ({ ...s, icon: Target })),
      { id: 'adv-1', title: "Générer une Carte Mentale", completed: Object.keys(themeStats).length > 2, route: "/summaries", icon: Network },
      { id: 'adv-2', title: "Tester le Mode ECOS", completed: results.length >= 5, route: "/ecos", icon: ShieldAlert },
      { id: 'adv-3', title: "Atteindre 70% de Rétention", completed: successRate >= 70, route: "/review", icon: Brain }
    ];
  }, [steps, themeStats, results.length, successRate]);

  const completedExtendedCount = extendedMissions.filter(m => m.completed).length;
  const extendedCompletionPercentage = (completedExtendedCount / extendedMissions.length) * 100;

  // ─── LIQUID LAYOUT ENGINE (Auto-Destruction) ───
  const [showMissions, setShowMissions] = useState(true);
  const [hasTriggeredCompletion, setHasTriggeredCompletion] = useState(false);

  useEffect(() => {
    if (extendedCompletionPercentage === 100 && showMissions && !hasTriggeredCompletion) {
      setHasTriggeredCompletion(true);
      uiAudio.playSuccess();
      toast.success("🏆 Maîtrise Architecturale Déverrouillée !", { description: "Toutes les missions sont terminées. Restructuration spatiale en cours...", duration: 4000 });
      setTimeout(() => setShowMissions(false), 3000);
    } else if (extendedCompletionPercentage === 100 && !hasTriggeredCompletion) {
      setShowMissions(false); setHasTriggeredCompletion(true);
    }
  }, [extendedCompletionPercentage, showMissions, hasTriggeredCompletion]);

  // ─── PARALLAXE GLOBAL DE LA PAGE (Inertie 3D de toute la grille Bento) ───
  const pageRef = useRef<HTMLDivElement>(null);
  const pageX = useMotionValue(0); const pageY = useMotionValue(0);
  const pageRotateX = useSpring(useTransform(pageY, [-1000, 1000], [2, -2]), { damping: 50, stiffness: 100 });
  const pageRotateY = useSpring(useTransform(pageX, [-1000, 1000], [-2, 2]), { damping: 50, stiffness: 100 });

  const handlePageMouseMove = (e: React.MouseEvent) => {
    if (window.innerWidth < 1024) return; // Désactiver sur mobile pour la performance
    const { innerWidth, innerHeight } = window;
    pageX.set(e.clientX - innerWidth / 2);
    pageY.set(e.clientY - innerHeight / 2);
  };

  // Parallaxe intense spécifique au Focus Pod Noir
  const podRef = useRef<HTMLDivElement>(null);
  const podX = useMotionValue(0); const podY = useMotionValue(0);
  const podRotateX = useSpring(useTransform(podY, [-400, 400], [12, -12]), { damping: 30, stiffness: 200 });
  const podRotateY = useSpring(useTransform(podX, [-400, 400], [-12, 12]), { damping: 30, stiffness: 200 });

  const handlePodMouseMove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher la propagation à la page
    if (!podRef.current) return;
    const rect = podRef.current.getBoundingClientRect();
    podX.set(e.clientX - rect.left - rect.width / 2); podY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handlePodMouseLeave = () => { podX.set(0); podY.set(0); };

  // Injection CSS pour le scroll mask et les scrollbars fantômes
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      .mask-edges-x { mask-image: linear-gradient(to right, transparent, black 2%, black 98%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 2%, black 98%, transparent); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const bentoVariants = { hidden: { opacity: 0, y: 30, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } } };

  if (loading) return <DashboardBentoSkeleton />;

  return (
    <div onMouseMove={handlePageMouseMove} className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans overflow-x-hidden pb-32 relative transition-colors duration-700 perspective-[2000px]">

      <motion.div style={{ rotateX: pageRotateX, rotateY: pageRotateY, transformStyle: "preserve-3d" }} variants={containerVariants} initial="hidden" animate="visible" className="max-w-[1500px] mx-auto px-4 sm:px-8 pt-8 space-y-6 md:space-y-8 relative z-10">
        
        {/* =========================================================================
            LA BANDEROLE ANIMÉE (Sanctuarisée - Z=50)
            ========================================================================= */}
        <motion.div style={{ translateZ: 50 }} variants={bentoVariants} className="w-full relative shadow-[0_30px_80px_-15px_rgba(0,0,0,0.15)] rounded-b-[3rem]">
          <AnimatedBanner 
            title={<>Bienvenue, <span className="font-serif italic text-white/90">{firstName || "Dr."}</span></>}
            subtitle="Cartographie neuronale de votre évolution clinique."
            rightWidgets={
              <>
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] px-6 py-4 flex flex-col items-start min-w-[140px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2"><Target className="w-3.5 h-3.5"/> Précision</span>
                  <span className="text-4xl font-light text-white tracking-tighter"><CountUp end={successRate} suffix="%" /></span>
                </div>
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] px-6 py-4 flex flex-col items-start min-w-[140px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5"/> Épreuves</span>
                  <span className="text-4xl font-light text-white tracking-tighter"><CountUp end={results.length} /></span>
                </div>
              </>
            }
          />
        </motion.div>

        {/* =========================================================================
            LA GRILLE LIQUIDE 200/200 (Morphing Spatial & Spotlight)
            ========================================================================= */}
        <motion.div layout className="grid grid-cols-2 md:grid-cols-12 auto-rows-[minmax(180px,auto)] gap-6 lg:gap-8 transform-style-3d">
          
          {/* ─── BENTO 1: CARTE D'IDENTITÉ GAMIFIÉE ─── */}
          <motion.div variants={bentoVariants} className="col-span-2 md:col-span-3 md:row-span-2" style={{ translateZ: 20 }}>
            <SpotlightCard className="h-full flex flex-col">
              <div className="p-8 sm:p-10 flex-1 flex flex-col justify-between relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Activity className="w-40 h-40 text-[#5B21B6]" /></div>
                
                <div>
                  <div className="flex flex-col items-center text-center gap-4 mb-8">
                    <MagneticWrapper strength={0.4}>
                      <div className="relative w-28 h-28 group-hover:scale-105 transition-transform duration-1000 shrink-0 cursor-pointer">
                        <div className="absolute inset-[-6px] rounded-full border-2 border-dashed border-[#5B21B6]/30 animate-[spin_15s_linear_infinite]" />
                        <div className="w-full h-full rounded-full bg-cover bg-center border-4 border-white dark:border-[#222] shadow-2xl z-10 relative" style={{ backgroundImage: `url('${avatarUrl || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80"}')` }} />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#111111] text-white text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-white shadow-xl z-20 whitespace-nowrap">
                          NIVEAU {currentLevel}
                        </div>
                      </div>
                    </MagneticWrapper>
                    <div>
                      <h2 className="text-3xl md:text-4xl font-serif font-black text-[#111111] dark:text-white tracking-tight leading-none mb-2 group-hover:text-[#5B21B6] transition-colors">{firstName}</h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888888] flex items-center justify-center gap-1.5">
                        <Medal className="w-3.5 h-3.5 text-amber-500" /> Élite Médicale
                      </p>
                    </div>
                  </div>

                  <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-[1.5rem] p-6 border border-black/5 dark:border-white/5 shadow-inner relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#5B21B6]">Neuro-Expérience</span>
                      <span className="text-xs font-black text-[#111111] dark:text-white"><CountUp end={xp} /> <span className="text-[#888888] font-bold">/ {xpForNextLevel}</span></span>
                    </div>
                    <div className="h-2.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ type: "spring", stiffness: 60, damping: 12, delay: 0.5 }} className="h-full bg-gradient-to-r from-[#5B21B6] to-indigo-500 rounded-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888]">Chronobiologie</span>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${timeContext.bg} ${timeContext.border} border text-[9px] font-black uppercase tracking-widest ${timeContext.color} shadow-sm`}>
                      <TimeIcon className="w-3 h-3" /> {timeContext.text}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 border border-black/5 dark:border-white/5 rounded-2xl px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] text-xs font-bold text-[#111111] dark:text-white w-full">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> 
                    <span className="truncate">{bestTheme?.theme || "Acquisition en cours..."}</span>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* ─── BENTO 2: GRAPHIQUE INTELLIGENT (Ressort & Flottaison) ─── */}
          <motion.div variants={bentoVariants} className="col-span-2 md:col-span-6 md:row-span-1" style={{ translateZ: 10 }}>
            <SpotlightCard className="h-full">
              <div className="p-8 md:p-10 h-full flex flex-col justify-between relative">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888] group-hover:text-[#5B21B6] transition-colors">Performance Globale</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-6xl font-light tracking-tighter text-[#111111] dark:text-white"><CountUp end={averageScore} /></span>
                      <span className="text-2xl text-[#888888] font-bold">%</span>
                    </div>
                  </div>
                  <div className="h-12 w-12 rounded-[1.25rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>

                {results.length > 0 ? (
                  <div className="flex-1 w-full flex items-end justify-between gap-3 relative mt-6 border-b border-black/5 dark:border-white/5 pb-2">
                    <div className="absolute top-[30%] left-0 w-full border-t-[1.5px] border-dashed border-[#5B21B6]/40 z-0 flex justify-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#5B21B6] bg-[#FAFAF8] dark:bg-[#111111] px-3 py-1 rounded-full border border-[#5B21B6]/30 -translate-y-3 shadow-md">Cible 70%</span>
                    </div>
                    {chartData.map((data, index) => (
                      <div key={index} className="relative flex-1 flex flex-col justify-end h-full group/bar z-10 cursor-crosshair">
                         <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-[#111111] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-2xl scale-95 group-hover/bar:scale-100 border border-white/10">
                           {data.title} • {data.score}%
                         </div>
                         <motion.div 
                           initial={{ height: 0 }} animate={{ height: `${Math.max(data.score, 5)}%` }} 
                           transition={{ type: "spring", stiffness: 80, damping: 12, delay: index * 0.08 }} // Ressort lourd
                           className={`w-full rounded-t-xl opacity-80 group-hover/bar:opacity-100 transition-opacity shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] ${data.score >= 70 ? 'bg-gradient-to-t from-emerald-600 to-[#10B981]' : 'bg-gradient-to-t from-indigo-700 to-[#5B21B6]'}`}
                         />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 w-full bg-black/[0.02] rounded-[2rem] border-2 border-dashed border-black/5 flex items-center justify-center text-xs font-bold text-[#888888] uppercase tracking-widest">
                    Base de données vierge
                  </div>
                )}
              </div>
            </SpotlightCard>
          </motion.div>

          {/* ─── BENTO 3: RÉTENTION NEUROLOGIQUE ─── */}
          <motion.div variants={bentoVariants} className="col-span-1 md:col-span-3 md:row-span-1" style={{ translateZ: 30 }}>
            <SpotlightCard className="h-full">
              <div className="p-8 md:p-10 h-full flex flex-col items-center justify-center text-center relative">
                <Brain className="w-8 h-8 text-[#5B21B6] absolute top-8 right-8 opacity-20 group-hover:opacity-100 group-hover:animate-pulse transition-opacity" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888] w-full text-left absolute top-8 left-8">Rétention</h3>
                
                <div className="relative w-36 h-36 flex items-center justify-center mt-8 group-hover:scale-110 transition-transform duration-700">
                  <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" className="stroke-black/5 dark:stroke-white/5" strokeWidth="8" />
                    <motion.circle 
                      cx="50" cy="50" r="42" fill="none" className="stroke-[#5B21B6]" strokeWidth="8" strokeLinecap="round" 
                      initial={{ strokeDasharray: "0 264" }} animate={{ strokeDasharray: `${Math.max(successRate, 5) * 2.64} 264` }} transition={{ duration: 2.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-light tracking-tighter text-[#111111] dark:text-white"><CountUp end={Math.max(successRate, 62)} /><span className="text-base">%</span></span>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-black tracking-[0.2em] text-[#888888] mt-6">Indice Ebbinghaus</span>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* ─── BENTO 4: MISSIONS D'INTÉGRATION HORIZONTALES (Auto-Destructeur) ─── */}
          <AnimatePresence mode="popLayout">
            {showMissions && (
              <motion.div 
                layout 
                initial={{ opacity: 0, scale: 0.9, filter: "blur(15px)" }} 
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} 
                exit={{ opacity: 0, scale: 0.8, rotateX: -30, filter: "blur(20px)" }} 
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="col-span-2 md:col-span-9 md:row-span-1"
                style={{ translateZ: 15 }}
              >
                <SpotlightCard className="h-full bg-gradient-to-r from-[#111111] to-[#1a1a1a] !border-[#333] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)]">
                  <div className="p-8 md:p-10 flex flex-col lg:flex-row gap-10 items-center h-full relative z-10">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-[#5B21B6]/30 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="w-full lg:w-1/4 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 pb-8 lg:pb-0 lg:pr-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-[#5B21B6] animate-pulse" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888]">Académie</h3>
                      </div>
                      <h2 className="text-3xl font-serif font-black text-white leading-none mb-6 tracking-tight">Objectifs<br/>Cliniques</h2>
                      <div className="flex items-end gap-2 mb-3">
                        <span className="text-5xl font-light text-white leading-none"><CountUp end={Math.round(extendedCompletionPercentage)} />%</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${extendedCompletionPercentage}%` }} transition={{ type: "spring", stiffness: 50, damping: 10 }} className="h-full bg-gradient-to-r from-indigo-500 to-[#5B21B6] shadow-[0_0_15px_rgba(91,33,182,0.9)]" />
                      </div>
                    </div>

                    <div className="w-full lg:w-3/4 flex gap-5 overflow-x-auto hide-scrollbar mask-edges-x pb-4 pt-2 px-4">
                      {extendedMissions.map((mission, idx) => {
                        const Icon = mission.icon || Target;
                        return (
                          <MagneticWrapper key={mission.id} strength={0.1}>
                            <div onClick={() => !mission.completed && mission.route && navigate(mission.route)}
                              className={`min-w-[240px] flex-shrink-0 flex flex-col justify-between p-6 rounded-[1.5rem] transition-all duration-500 cursor-pointer border shadow-2xl hover:-translate-y-2 ${mission.completed ? 'bg-black/50 border-white/5 opacity-40 grayscale' : 'bg-white/5 border-white/10 hover:border-[#5B21B6]/50 hover:bg-[#5B21B6]/10'}`}
                            >
                              <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-inner ${mission.completed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[#5B21B6] text-white shadow-[0_0_15px_rgba(91,33,182,0.5)]'}`}>
                                  {mission.completed ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-2.5 py-1.5 rounded-md">M.{idx + 1}</span>
                              </div>
                              <p className={`text-sm font-bold leading-relaxed ${mission.completed ? 'text-white/40 line-through' : 'text-white'}`}>{mission.title}</p>
                            </div>
                          </MagneticWrapper>
                        );
                      })}
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── BENTO 5: TIMELINE CLINIQUE (Le Vectoriel Dynamique) ─── */}
          <motion.div layout className={`col-span-2 ${showMissions ? 'md:col-span-12' : 'md:col-span-9'} md:row-span-1`} style={{ translateZ: 10 }}>
            <SpotlightCard className="h-full">
              <div className="p-8 md:p-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#888888] group-hover:text-[#5B21B6] transition-colors">Frise Chronologique Vectorielle</h3>
                  <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-[#111111] dark:text-white hover:text-[#5B21B6] hover:bg-black/5 dark:hover:bg-white/5 h-auto py-2.5 px-5 rounded-full border border-black/5 dark:border-white/5">Archiver <ArrowRight className="w-3.5 h-3.5 ml-2" /></Button>
                </div>

                <div className="flex-1 flex items-center relative z-10 w-full">
                  {results.length === 0 ? (
                    <div className="w-full flex items-center justify-center text-xs font-bold text-[#888888] uppercase tracking-widest bg-black/[0.02] rounded-[2rem] border-2 border-dashed border-black/5 h-32">Aucune activité enregistrée</div>
                  ) : (
                    <div className="w-full relative h-full flex items-center">
                      
                      {/* Ligne SVG Animée (La vraie connexion neuronale) */}
                      <svg className="absolute top-1/2 left-0 w-full h-[4px] -translate-y-1/2 overflow-visible z-0 pointer-events-none">
                        <defs>
                          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(91,33,182,0)" />
                            <stop offset="20%" stopColor="rgba(91,33,182,0.4)" />
                            <stop offset="80%" stopColor="rgba(91,33,182,0.4)" />
                            <stop offset="100%" stopColor="rgba(91,33,182,0)" />
                          </linearGradient>
                        </defs>
                        <motion.line x1="0" y1="2" x2="100%" y2="2" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, ease: "easeInOut" }} />
                      </svg>
                      
                      <div className="flex gap-6 md:gap-12 overflow-x-auto hide-scrollbar mask-edges-x pb-8 pt-8 px-10 w-full relative z-10">
                        {results.slice(0, showMissions ? 6 : 5).map((r, i) => (
                          <motion.div key={i} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i*0.15, type: "spring", stiffness: 100, damping: 15 }} className="min-w-[180px] md:min-w-[260px] flex flex-col items-center group/node cursor-pointer">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#888888] mb-5">{new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                            
                            <div className={`w-12 h-12 rounded-full border-4 border-white dark:border-[#111111] flex items-center justify-center shadow-xl z-10 mb-5 transition-all duration-500 group-hover/node:scale-125 group-hover/node:shadow-[0_0_30px_rgba(91,33,182,0.6)] ${i === 0 ? 'bg-[#5B21B6]' : 'bg-[#D1D5DB] dark:bg-[#333]'}`}>
                              {i === 0 && <div className="w-3 h-3 bg-white rounded-full animate-ping" />}
                            </div>
                            
                            <div className="bg-[#FAFAF8] dark:bg-[#161614] border border-black/5 dark:border-white/5 p-5 rounded-[1.5rem] w-full text-center group-hover/node:border-[#5B21B6]/40 group-hover/node:shadow-2xl group-hover/node:-translate-y-2 transition-all duration-500">
                              <div className={`text-3xl font-light mb-2 ${i===0 ? 'text-[#5B21B6] font-medium' : 'text-[#111111] dark:text-white'}`}>{Math.round((r.score / r.total_questions)*100)}%</div>
                              <p className="text-[10px] font-bold truncate text-[#888888]">{r.courses?.title || "Sujet non défini"}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* ─── BENTO 6: LE VAISSEAU OLED (Trou Noir Absolu) ─── */}
          <motion.div layout className="col-span-2 md:col-span-12 md:row-span-2 perspective-[2000px] relative z-50">
            <motion.div 
              ref={podRef} onMouseMove={handlePodMouseMove} onMouseLeave={handlePodMouseLeave} style={{ rotateX: podRotateX, rotateY: podRotateY, transformStyle: "preserve-3d" }}
              className="relative w-full bg-[#000000] rounded-[3rem] md:rounded-[4rem] p-8 md:p-16 shadow-[0_60px_120px_-20px_rgba(0,0,0,1),inset_0_2px_4px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col md:flex-row gap-12 items-center justify-between group/focus transition-all duration-1000 border border-[#222]"
            >
              {/* Le Trou Noir Absolu (Lumière interne) */}
              <motion.div style={{ translateZ: -80 }} className="absolute top-[-30%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-[#5B21B6]/30 to-[#ec4899]/10 rounded-full blur-[150px] pointer-events-none group-hover/focus:from-[#5B21B6]/40 transition-colors duration-1000" />
              <motion.div style={{ translateZ: -50 }} className="absolute bottom-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.25] mix-blend-overlay pointer-events-none" />

              {/* Console de Lancement */}
              <motion.div style={{ translateZ: 50 }} className="relative z-10 w-full md:w-1/2 flex flex-col">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 mb-10 self-start backdrop-blur-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                  <Activity className="w-4 h-4 text-[#5B21B6] animate-pulse shadow-glow" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Zone de Pression Pure</span>
                </div>
                
                <h2 className="text-5xl md:text-8xl font-serif text-white tracking-tight mb-6 leading-[1.05] drop-shadow-2xl">
                  Isoler <span className="italic text-[#5B21B6] drop-shadow-[0_0_40px_rgba(91,33,182,1)]">l'Esprit.</span>
                </h2>
                <p className="text-sm md:text-base font-medium text-white/50 mb-14 max-w-md leading-relaxed hidden sm:block">
                  Fermez les portes du monde. Activez le minuteur chirurgical et les ondes binaurales à 10Hz pour forcer la neuro-plasticité de votre cerveau.
                </p>

                {/* Boutons d'Armement (Magnétiques) */}
                <div className="flex flex-wrap gap-5">
                  <MagneticWrapper strength={0.3}>
                    <button onClick={() => { uiAudio.playSoftClick(); setIsTimerRunning(!isTimerRunning); }}
                      className={`h-16 md:h-20 px-10 md:px-14 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all duration-300 text-xs md:text-sm font-black uppercase tracking-widest shadow-2xl ${
                        isTimerRunning ? "bg-amber-500 text-[#111111] shadow-[0_0_50px_rgba(245,158,11,0.5)]" : "bg-white text-[#111111] hover:bg-[#5B21B6] hover:text-white hover:shadow-[0_0_60px_rgba(91,33,182,0.8)]"
                      }`}
                    >
                      {isTimerRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                      {isTimerRunning ? "Suspendre" : "Initier Focus"}
                    </button>
                  </MagneticWrapper>

                  <MagneticWrapper strength={0.2}>
                    <button onClick={() => {
                        uiAudio.playSoftClick();
                        if (isBinauralPlaying) { uiAudio.stopBinauralBeats(); setIsBinauralPlaying(false); toast.info("🔇 Ondes désactivées."); } 
                        else { uiAudio.startBinauralBeats(); setIsBinauralPlaying(true); toast.success("🎧 Ondes Alpha 10Hz actives."); }
                      }}
                      className={`h-16 md:h-20 px-8 md:px-12 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all duration-300 text-xs md:text-sm font-black uppercase tracking-widest border-2 ${
                        isBinauralPlaying ? "bg-[#5B21B6]/30 border-[#5B21B6]/60 text-white shadow-[0_0_50px_rgba(91,33,182,0.6)]" : "bg-transparent border-white/20 text-white hover:bg-white/10"
                      }`}
                    >
                      {isBinauralPlaying ? <AudioEqualizer /> : <Volume2 className="h-6 w-6 md:h-7 md:w-7" />}
                      <span className="hidden sm:inline">{isBinauralPlaying ? "Binaural Actif" : "Binaural"}</span>
                    </button>
                  </MagneticWrapper>
                  
                  <MagneticWrapper strength={0.15}>
                    <button onClick={() => { uiAudio.playSoftClick(); setFocusTimeLeft(25 * 60); setIsTimerRunning(false); }} className="h-16 w-16 md:h-20 md:w-20 rounded-[2.5rem] bg-white/5 border-2 border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all shrink-0">
                      <RotateCcw className="h-6 w-6 md:h-7 md:w-7" />
                    </button>
                  </MagneticWrapper>
                </div>
              </motion.div>

              {/* DROITE : Hologramme Minuteur (Ultra-Lévitation) */}
              <motion.div style={{ translateZ: 100 }} className="relative z-10 flex justify-center w-full md:w-1/2 mt-16 md:mt-0">
                <div className="relative w-80 h-80 md:w-[450px] md:h-[450px] flex items-center justify-center drop-shadow-[0_40px_100px_rgba(91,33,182,0.8)] pointer-events-none">
                  {isBinauralPlaying && (
                    <>
                      <div className="absolute inset-2 rounded-full border-2 border-[#5B21B6]/50 animate-[ping_3s_infinite]" />
                      <div className="absolute inset-[-25px] rounded-full border border-[#5B21B6]/30 animate-[ping_4s_infinite_1s]" />
                    </>
                  )}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" className="stroke-white/10" strokeWidth="1" />
                    <motion.circle 
                      cx="50" cy="50" r="46" fill="none" className="stroke-[#5B21B6]" strokeWidth="3" strokeLinecap="round" 
                      initial={{ strokeDasharray: "0 289" }} animate={{ strokeDasharray: `${(focusTimeLeft / (25 * 60)) * 289} 289` }} transition={{ duration: 0.5, ease: "linear" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full backdrop-blur-xl border border-white/10 shadow-[inset_0_0_50px_rgba(91,33,182,0.3)]">
                    <span className="text-7xl md:text-9xl font-light tracking-tighter text-white font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                      {Math.floor(focusTimeLeft / 60)}:{(focusTimeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[10px] md:text-xs uppercase font-black text-[#5B21B6] tracking-[0.6em] mt-4 drop-shadow-xl">
                      {isTimerRunning ? "Immersion" : "En Attente"}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
