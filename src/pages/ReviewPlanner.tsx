import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Brain, Calendar, ChevronLeft, RotateCw,
  CheckCircle2, XCircle, ThumbsUp, ThumbsDown, Zap,
  BookOpen, TrendingUp, Target, Bell, BellRing, Timer, Activity
} from "lucide-react";
import { useSpacedRepetition, type ReviewCard } from "@/hooks/useSpacedRepetition";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { uiAudio } from "@/utils/audio";

// ─── INGÉNIERIE GRAPHIQUE (Composants Cinétiques) ───

const MagneticWrapper = ({ children, strength = 0.15 }: { children: React.ReactNode, strength?: number }) => {
  const x = useMotionValue(0); const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (left + width / 2)) * strength);
    y.set((e.clientY - (top + height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };

  return <motion.div onMouseMove={handleMouse} onMouseLeave={reset} style={{ x: springX, y: springY }} className="inline-block relative z-50">{children}</motion.div>;
};

// Compteur dynamique pour les statistiques
const CountUp = ({ end, duration = 1500 }: { end: number, duration?: number }) => {
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
  return <>{count}</>;
};

const QUALITY_BUTTONS = [
  { quality: 1, label: "Blackout", icon: XCircle, color: "text-rose-500 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500 hover:text-white", shadow: "hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]", desc: "Oubli total" },
  { quality: 3, label: "Difficile", icon: ThumbsDown, color: "text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500 hover:text-white", shadow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]", desc: "Rappel laborieux" },
  { quality: 4, label: "Correct", icon: ThumbsUp, color: "text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500 hover:text-white", shadow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]", desc: "Bonne réflexion" },
  { quality: 5, label: "Parfait", icon: Zap, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500 hover:text-white", shadow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]", desc: "Réponse réflexe" },
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

  // Chronomètre de session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReviewing) interval = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isReviewing]);

  useEffect(() => { if ("Notification" in window) setNotificationsEnabled(Notification.permission === "granted"); }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return toast.error("Navigateur incompatible.");
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Rappels cognitifs activés.");
      new Notification("Hippocampus", { body: "L'algorithme SM-2 optimisera votre rétention.", icon: "/vite.svg" });
    } else toast.error("Permission refusée.");
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const currentCard: ReviewCard | undefined = dueCards[currentIndex];

  const handleRate = useCallback(async (quality: number) => {
    if (!currentCard) return;
    if (quality >= 4) uiAudio.playSuccess(); else uiAudio.playSoftClick();

    const success = await reviewCard(currentCard.id, quality);
    if (success) {
      setSessionCompleted(prev => prev + 1);
      setIsFlipped(false);
      if (currentIndex >= dueCards.length - 1) {
        setIsReviewing(false);
        toast.success("Session terminée ! 🎉");
        uiAudio.playSuccess();
      } else {
        setCurrentIndex(prev => Math.min(prev, dueCards.length - 2));
      }
    }
  }, [currentCard, currentIndex, dueCards.length, reviewCard]);

  const startSession = () => { setIsReviewing(true); setCurrentIndex(0); setIsFlipped(false); setSessionCompleted(0); setSessionTime(0); uiAudio.playSoftClick(); };

  // Parallaxe de la carte de révision
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0); const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-400, 400], [8, -8]), { damping: 40, stiffness: 150 });
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-8, 8]), { damping: 40, stiffness: 150 });

  const handleCardMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2); mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleCardMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Brain className="w-8 h-8 text-primary animate-pulse" /></div>;

  // ============================================================================
  // ÉTAT 1 : LE MONOLITHE (SESSION DE RÉVISION ACTIVE)
  // ============================================================================
  if (isReviewing && currentCard) {
    const progress = dueCards.length > 0 ? (sessionCompleted / (sessionCompleted + dueCards.length)) * 100 : 100;
    return (
      <div className="min-h-screen bg-background font-sans py-6 relative overflow-hidden flex flex-col">
        
        {/* Scroll Mask Injection */}
        <style dangerouslySetInnerHTML={{__html: `
          .fade-y-scroll {
            mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
          }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />

        <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-[#5B21B6]/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-[1000px] w-full mx-auto px-4 sm:px-6 relative z-10 flex flex-col flex-1">
          
          {/* Header Focus Minimaliste */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <button onClick={() => setIsReviewing(false)} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Interrompre
            </button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full shadow-sm">
                <Timer className="w-3.5 h-3.5 text-primary" />
                <span className="font-mono text-[13px] font-bold tracking-widest text-foreground">{formatTime(sessionTime)}</span>
              </div>
              <div className="px-4 py-2 bg-card border border-border rounded-full text-[11px] font-black uppercase tracking-widest text-muted-foreground shadow-sm">
                <span className="text-foreground">{sessionCompleted}</span> / {dueCards.length}
              </div>
            </div>
          </div>

          {/* Barre de Progression Vectorielle */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-8">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} className="h-full bg-primary rounded-full" />
          </div>

          {/* Moteur 3D de la Flashcard */}
          <div className="perspective-[2500px] w-full flex-1 flex flex-col justify-center pb-24">
            <div className="flex items-center justify-between w-full px-4 mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-card border border-border px-4 py-2 rounded-full">
                Fiche {currentIndex + 1}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary truncate max-w-[200px] md:max-w-[300px] bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                {currentCard.courseName}
              </span>
            </div>

            <motion.div
              ref={cardRef} onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="min-h-[450px] sm:min-h-[550px] w-full cursor-pointer relative group"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              onClick={() => { if (!isFlipped) { uiAudio.playSoftClick(); setIsFlipped(true); } }}
            >
              {/* FACE RECTO */}
              <div className="absolute inset-0 w-full h-full bg-card rounded-[3rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] [backface-visibility:hidden] flex flex-col border border-border">
                <div className="flex justify-between items-center p-8 pb-4 border-b border-border shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Concept Clinique</span>
                </div>
                <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex flex-col justify-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-foreground leading-[1.4] text-center tracking-tight whitespace-pre-wrap">
                    {currentCard.question}
                  </div>
                </div>
                <div className="text-center p-6 border-t border-border text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0">
                  <RotateCw className="h-4 w-4" /> Cliquer pour révéler la vérité
                </div>
              </div>

              {/* FACE VERSO */}
              <div className="absolute inset-0 w-full h-full bg-[#050505] rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col border border-[#222]">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
                <div className="flex justify-between items-center p-8 pb-4 border-b border-white/10 shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" /> Solution Académique</span>
                </div>
                <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex items-center">
                  <div className="whitespace-pre-line font-serif text-xl sm:text-2xl md:text-3xl text-left leading-[1.6] text-white/95">
                    {currentCard.answer}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Matrice d'Évaluation Magnétique */}
            <div className="h-[120px] mt-8 flex items-center justify-center w-full">
              <AnimatePresence mode="wait">
                {isFlipped ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="flex flex-wrap justify-center gap-3 sm:gap-4 relative z-40">
                    {QUALITY_BUTTONS.map(({ quality, label, color, shadow, desc }) => (
                      <MagneticWrapper key={quality} strength={0.15}>
                        <button onClick={() => handleRate(quality)} className={`w-[90px] sm:w-[110px] h-[70px] sm:h-[80px] rounded-[1.25rem] border transition-all duration-300 flex flex-col items-center justify-center gap-1 backdrop-blur-xl ${color} ${shadow}`}>
                          <span className="text-xl sm:text-2xl font-light leading-none">{quality}</span>
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-80">{label}</span>
                        </button>
                      </MagneticWrapper>
                    ))}
                  </motion.div>
                ) : <motion.div key="placeholder" className="h-full opacity-0 pointer-events-none" />}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉTAT 2 : LE DASHBOARD ANALYTIQUE (La Page de Statistiques Principale)
  // ============================================================================
  
  // Animation d'entrée échelonnée pour les cartes Bento
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  return (
    <div className="min-h-screen bg-transparent text-foreground font-sans px-4 pt-8 pb-16 sm:px-8 relative transition-colors duration-500">
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vw] bg-violet-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-[1400px] mx-auto space-y-8 relative z-10">
        
        {/* ─── LA BANDEROLE ANIMÉE (Sanctuarisée et Unifiée) ─── */}
        <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-b-[3rem] animate-fade-in">
          <AnimatedBanner 
            title={<>Statistiques <span className="font-serif italic text-white/90">& Plan</span></>}
            subtitle="Orchestration algorithmique de vos révisions (Moteur SM-2)."
            rightWidgets={
              <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                <div className="flex gap-3 w-full md:w-auto">
                  <Button onClick={() => refreshCards()} className="w-11 h-11 rounded-[14px] bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 p-0 transition-all shrink-0 backdrop-blur-xl shadow-sm">
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button onClick={enableNotifications} className={`h-11 px-5 rounded-[14px] font-bold uppercase tracking-widest text-[10px] transition-all flex-1 md:flex-none backdrop-blur-xl shadow-sm ${notificationsEnabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/10 text-white border border-white/20 hover:bg-white/20"}`}>
                    {notificationsEnabled ? <BellRing className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
                    {notificationsEnabled ? "Rappels Actifs" : "Activer Rappels"}
                  </Button>
                </div>
              </div>
            }
          />
        </div>

        {/* ─── GRILLE BENTO ARCHITECTURALE ─── */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 pt-4">
          {[
            { value: stats.dueToday, label: "Urgence", desc: "À réviser aujourd'hui", icon: Target, color: "rose", isAlert: stats.dueToday > 0 },
            { value: stats.dueTomorrow, label: "Demain", desc: "Prévues à J+1", icon: Calendar, color: "amber", isAlert: false },
            { value: stats.masteredCards, label: "Acquis", desc: "Maîtrisées (21j+)", icon: CheckCircle2, color: "emerald", isAlert: false },
            { value: stats.totalCards, label: "Volume", desc: "Total des fiches", icon: BookOpen, color: "violet", isAlert: false }
          ].map((stat, idx) => {
            // Configuration des couleurs dynamiques pour l'effet de survol
            const colorMap: Record<string, string> = {
              rose: "hover:border-rose-500/50 hover:shadow-[0_10px_30px_rgba(244,63,94,0.15)] group-hover:text-rose-500",
              amber: "hover:border-amber-500/50 hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] group-hover:text-amber-500",
              emerald: "hover:border-emerald-500/50 hover:shadow-[0_10px_30px_rgba(16,185,129,0.15)] group-hover:text-emerald-500",
              violet: "hover:border-violet-500/50 hover:shadow-[0_10px_30px_rgba(139,92,246,0.15)] group-hover:text-violet-500"
            };
            const borderTopMap: Record<string, string> = {
              rose: "border-t-rose-500", amber: "border-t-amber-500", emerald: "border-t-emerald-500", violet: "border-t-violet-500"
            };

            return (
              <motion.div key={idx} variants={itemVariants} className={`group bg-card/60 backdrop-blur-xl border border-border border-t-[3px] ${borderTopMap[stat.color]} rounded-[1.5rem] p-6 flex flex-col justify-between shadow-sm hover:-translate-y-1 transition-all duration-300 ${colorMap[stat.color]}`}>
                <div className="flex justify-between items-start mb-6">
                  <stat.icon className={`w-5 h-5 text-muted-foreground transition-colors duration-300 ${colorMap[stat.color]}`} />
                  {stat.isAlert && <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                </div>
                <div>
                  <p className="text-4xl font-light tracking-tighter text-foreground mb-1"><CountUp end={stat.value} /></p>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">{stat.label}</h3>
                  <p className="text-[10px] font-medium text-muted-foreground">{stat.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid lg:grid-cols-12 gap-6 items-stretch">
          
          {/* ─── ACTION PRINCIPALE : LE DÉMARREUR (Centre de commandement) ─── */}
          <motion.div variants={itemVariants} className="lg:col-span-8 bg-[#111111] dark:bg-[#050505] rounded-[2rem] p-10 md:p-14 border border-[#222222] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] flex flex-col justify-center items-center text-center relative overflow-hidden group">
            {/* Lueur interne dynamique */}
            {stats.dueToday > 0 && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] pointer-events-none transition-transform duration-1000 group-hover:scale-125" />}
            
            {stats.dueToday > 0 ? (
              <>
                <Brain className="w-12 h-12 text-white mb-6 opacity-80 group-hover:scale-110 transition-transform duration-500" />
                <h2 className="text-3xl md:text-5xl font-serif text-white mb-4 tracking-tight">Phase Critique.</h2>
                <p className="text-[#888888] text-[13px] font-medium max-w-md mx-auto mb-10 leading-relaxed">
                  <strong className="text-white">{stats.dueToday} concepts</strong> s'effacent de votre mémoire à court terme. Réactivez les circuits neuronaux maintenant.
                </p>
                <button onClick={startSession} className="h-14 px-8 rounded-full bg-white text-[#111111] hover:bg-primary hover:text-primary-foreground font-black uppercase tracking-widest text-[11px] transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(91,33,182,0.5)] hover:-translate-y-1">
                  Initier la Perfusion (Démarrer)
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-6 opacity-80" />
                <h2 className="text-3xl md:text-5xl font-serif text-white mb-4 tracking-tight">Rétention Optimale.</h2>
                <p className="text-[#888888] text-[13px] font-medium max-w-md mx-auto mb-10 leading-relaxed">
                  L'algorithme confirme la consolidation de vos acquis. Revenez lors de la prochaine fenêtre d'oubli calculée par SM-2.
                </p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => navigate("/flashcards")} className="h-12 px-6 rounded-full bg-transparent border border-white/20 text-white hover:bg-white/10 font-bold uppercase tracking-widest text-[10px] transition-colors">
                    Aller à la Bibliothèque
                  </button>
                </div>
              </>
            )}
          </motion.div>

          {/* ─── PRÉVISIONS SUR 7 JOURS (Graphique Vectoriel Haute Précision) ─── */}
          <motion.div variants={itemVariants} className="lg:col-span-4 bg-card/60 backdrop-blur-xl rounded-[2rem] p-8 border border-border flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-8">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Onde de Révision (J+7)</h3>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-2">
              {forecast.map((day, idx) => {
                const maxCount = Math.max(...forecast.map(d => d.count), 1);
                const height = Math.max((day.count / maxCount) * 100, 4); // Minimum 4% height
                const isToday = idx === 0;

                return (
                  <div key={day.date} className="flex flex-col items-center gap-3 flex-1 group">
                    <span className="text-[10px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">{day.count}</span>
                    <div className="w-full h-[140px] bg-muted/30 rounded-t-lg relative flex items-end overflow-hidden border-b border-border">
                      <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: `${height}%` }} 
                        transition={{ type: "spring", stiffness: 80, damping: 15, delay: idx * 0.05 }}
                        className={`w-full rounded-t-lg transition-colors ${isToday ? 'bg-primary' : 'bg-foreground dark:bg-white'} ${day.count === 0 ? 'opacity-20' : 'opacity-100'} group-hover:bg-primary`}
                      />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReviewPlanner;
