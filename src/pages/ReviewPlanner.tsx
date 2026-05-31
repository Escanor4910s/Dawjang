import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Calendar as CalendarIcon, RotateCw,
  CheckCircle2, Target, Sparkles, Bell, BellRing, 
  Timer, ArrowRight, Activity, X, ChevronRight, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { useSpacedRepetition, type ReviewCard } from "@/hooks/useSpacedRepetition";

const QUALITY_BUTTONS = [
  { quality: 1, label: "Oubli Total", desc: "Revoir < 1 min", color: "hover:bg-red-500 hover:text-white hover:border-red-500 text-[#111111] dark:text-white" },
  { quality: 3, label: "Difficile", desc: "Revoir dans 6 min", color: "hover:bg-orange-500 hover:text-white hover:border-orange-500 text-[#111111] dark:text-white" },
  { quality: 4, label: "Correct", desc: "Revoir dans 1 jour", color: "hover:bg-[#5B21B6] hover:text-white hover:border-[#5B21B6] text-[#111111] dark:text-white" },
  { quality: 5, label: "Évident", desc: "Revoir dans 4 jours", color: "hover:bg-emerald-500 hover:text-white hover:border-emerald-500 text-[#111111] dark:text-white" },
];

export const ReviewPlanner = () => {
  const { dueCards, forecast, loading, reviewCard } = useSpacedRepetition();
  
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReviewing) {
      interval = setInterval(() => setSessionTime((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isReviewing]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Navigateur incompatible avec les notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Rappels neuronaux activés.");
    } else {
      toast.error("Permission refusée.");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const currentCard: ReviewCard | undefined = dueCards[0]; // Always index 0 because reviewed cards are removed

  const handleRate = useCallback(async (quality: number) => {
    if (!currentCard) return;

    const success = await reviewCard(currentCard.id, quality);
    if (success) {
      setSessionCompleted(prev => prev + 1);
      setIsFlipped(false);

      if (dueCards.length <= 1) { // It will be 0 after this card is removed
        setIsReviewing(false);
        toast.success("Focus terminé. Les connexions synaptiques sont renforcées.");
      }
    }
  }, [currentCard, dueCards.length, reviewCard]);

  const startSession = () => {
    if (dueCards.length === 0) {
      toast.info("Vous avez déjà terminé toutes vos révisions pour aujourd'hui.");
      return;
    }
    setIsReviewing(true);
    setIsFlipped(false);
    setSessionCompleted(0);
    setSessionTime(0);
  };

  // --- Dynamic Data Mapping ---
  const forecastLayoutData = forecast.length > 0 ? forecast.map((f, idx) => {
    const d = new Date(f.date);
    return {
      date: f.label,
      day: d.getDate().toString(),
      count: f.count,
      isToday: idx === 0
    };
  }) : [
    { date: "Aujourd'hui", day: new Date().getDate().toString(), count: 0, isToday: true }
  ];

  const todayQueue = Object.entries(
    dueCards.reduce((acc, card) => {
      acc[card.courseName || "Général"] = (acc[card.courseName || "Général"] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([subject, count]) => ({
    subject,
    count,
    status: "pending"
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] flex items-center justify-center relative z-10 transition-colors duration-300">
         <div className="flex flex-col items-center gap-4">
          <Activity className="h-6 w-6 animate-pulse text-[#111111] dark:text-white" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Calcul des intervalles SM-2...</span>
        </div>
      </div>
    );
  }

  // --- VUE 1 : LA SESSION IMMERSIVE (Focus total) ---
  if (isReviewing && currentCard) {
    const totalCardsAtStart = sessionCompleted + dueCards.length;
    const progress = totalCardsAtStart > 0 ? (sessionCompleted / totalCardsAtStart) * 100 : 0;

    return (
      <div className="fixed inset-0 z-[100] bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] flex flex-col transition-colors duration-300">
        
        {/* Header Immersif */}
        <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#161614]/50 backdrop-blur-md">
          <button onClick={() => setIsReviewing(false)} className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-widest text-[#888888]">
            <X className="h-4 w-4" /> Suspendre
          </button>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#5B21B6] dark:text-violet-400">
              <Timer className="h-4 w-4" />
              <span className="font-mono text-sm font-bold tracking-wider">{formatTime(sessionTime)}</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest">
              <span>{sessionCompleted + 1}</span> <span className="text-[#888888]">/ {totalCardsAtStart}</span>
            </div>
          </div>
        </div>
        
        {/* Barre de progression ultra-fine */}
        <div className="h-1 w-full bg-black/5 dark:bg-white/5">
          <motion.div className="h-full bg-[#5B21B6]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* L'Arène de la Carte */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto overflow-hidden">
          <div className="relative [perspective:2000px] w-full max-h-[600px] flex-grow">
            <motion.div
              className="w-full h-full cursor-pointer relative preserve-3d"
              animate={{ rotateX: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 90, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* RECTO */}
              <div className="absolute inset-0 w-full h-full bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 shadow-xl overflow-hidden [backface-visibility:hidden] flex flex-col p-10 rounded-[2.5rem] group">
                <div className="flex justify-between items-start shrink-0 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Question</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1.5 rounded-lg border border-[#5B21B6]/20">
                    {currentCard.courseName || "Général"}
                  </span>
                </div>
                <div className="flex-grow overflow-y-auto editorial-scrollbar pr-4 flex items-center justify-center text-center">
                  <p className="text-3xl md:text-4xl font-serif leading-relaxed text-[#111111] dark:text-white">
                    {currentCard.question}
                  </p>
                </div>
                <div className="shrink-0 mt-6 text-center opacity-40 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <RotateCw className="h-3 w-3" /> Cliquez pour retourner
                  </span>
                </div>
              </div>

              {/* VERSO (Réponse - Fond Violet Sombre) */}
              <div className="absolute inset-0 w-full h-full bg-[#111111] dark:bg-[#0A0A0A] text-white border border-[#111111] dark:border-white/10 shadow-2xl overflow-hidden [backface-visibility:hidden] [transform:rotateX(180deg)] flex flex-col p-10 rounded-[2.5rem]">
                <div className="shrink-0 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Réponse</span>
                </div>
                <div className="flex-grow overflow-y-auto editorial-scrollbar pr-4 flex items-center justify-center text-center">
                  <p className="text-2xl md:text-3xl font-medium leading-relaxed drop-shadow-sm whitespace-pre-wrap">
                    {currentCard.answer}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Boutons d'Évaluation (Apparaissent au verso) */}
          <div className="mt-8 w-full h-24 shrink-0">
            <AnimatePresence>
              {isFlipped && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  {QUALITY_BUTTONS.map((btn) => (
                    <button
                      key={btn.quality}
                      onClick={(e) => { e.stopPropagation(); handleRate(btn.quality); }}
                      className={`h-20 flex flex-col items-center justify-center bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-2xl transition-all duration-300 shadow-sm ${btn.color} group`}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest mb-1">{btn.label}</span>
                      <span className="text-[10px] font-medium text-[#888888] group-hover:text-white/80 transition-colors">{btn.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // --- VUE 2 : LE PLANIFICATEUR (Dashboard Temporel) ---
  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans pt-8 pb-24 w-full transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto px-6 space-y-12">
        
        <AnimatedBanner 
          title="Planificateur Clinique."
          subtitle="Votre agenda de consolidation mémorielle. L'algorithme SM-2 calcule vos pics d'oubli."
          rightWidgets={
            <div className="flex items-center gap-3">
              <button 
                onClick={notificationsEnabled ? undefined : enableNotifications} 
                className={`px-5 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border flex items-center gap-2 ${notificationsEnabled ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111] border-[#111111] dark:border-white shadow-md" : "bg-white dark:bg-[#161614] text-[#111111] dark:text-white border-black/10 dark:border-white/10 hover:border-[#111111] dark:hover:border-white/30"}`}
              >
                {notificationsEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <span className="hidden sm:inline">Rappels</span>
              </button>
            </div>
          }
        />

        {/* --- SECTION 1 : LA LIGNE D'HORIZON (Timeline) --- */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-[#5B21B6]" /> Horizon SM-2
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">7 Prochains Jours</span>
          </div>
          
          <div className="grid grid-cols-7 gap-3 md:gap-4 overflow-x-auto pb-4 md:pb-0 editorial-scrollbar">
            {forecastLayoutData.map((day, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col min-w-[100px] p-4 md:p-6 rounded-[2rem] border transition-all duration-300 ${
                  day.isToday 
                    ? "bg-[#5B21B6] border-[#5B21B6] text-white shadow-[0_15px_30px_-10px_rgba(91,33,182,0.4)] scale-105 z-10" 
                    : "bg-white dark:bg-[#161614] border-black/5 dark:border-white/5 text-[#111111] dark:text-white hover:border-[#5B21B6]/50 hover:-translate-y-1"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${day.isToday ? "text-white/70" : "text-[#888888]"}`}>
                  {day.date}
                </span>
                <span className="text-3xl md:text-4xl font-light tracking-tighter mb-4">
                  {day.day}
                </span>
                <div className="mt-auto">
                  <span className={`text-xl font-bold flex items-center gap-2 ${day.isToday ? "text-white" : "text-[#5B21B6] dark:text-violet-400"}`}>
                    {day.count} <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Cartes</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- SECTION 2 : LE PROTOCOLE DU JOUR --- */}
        <div className="grid lg:grid-cols-12 gap-8 mt-12">
          
          {/* Action Focus (5/12) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <Brain className="w-48 h-48" />
            </div>
            
            <div className="relative z-10 mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#5B21B6]/10 rounded-lg border border-[#5B21B6]/20 text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] dark:text-violet-400 mb-6">
                Priorité du jour
              </div>
              <h2 className="text-5xl font-light tracking-tighter mb-4">
                {dueCards.length} cartes
              </h2>
              <p className="text-sm text-[#666666] dark:text-[#8E8E8A] leading-relaxed">
                Le timing est optimal pour ancrer ces informations dans votre mémoire à long terme. Ne repoussez pas cette session.
              </p>
            </div>

            <div className="relative z-10 mt-auto pt-6 border-t border-black/5 dark:border-white/5">
              <button 
                onClick={startSession}
                disabled={dueCards.length === 0}
                className="w-full py-5 rounded-2xl bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-all duration-300 shadow-md disabled:opacity-50 disabled:hover:bg-[#111111]"
              >
                {dueCards.length === 0 ? (
                  <><CheckCircle2 className="h-4 w-4" /> Révisions Terminées</>
                ) : (
                  <>Démarrer le Focus <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>

          {/* Agenda Thématique (7/12) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-8 pb-6 border-b border-black/5 dark:border-white/5">
              <h3 className="text-xl font-medium tracking-tight flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-[#888888]" /> Programme Détaillé
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">{todayQueue.length} Thématiques</span>
            </div>

            <div className="flex-1 space-y-4">
              {todayQueue.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-3" />
                    <p className="text-sm font-medium text-[#111111] dark:text-white">Tout est accompli pour aujourd'hui.</p>
                 </div>
              ) : (
                todayQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 rounded-2xl border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-[#FAFAF8] dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                        item.status === "done" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-[#FAFAF8] dark:bg-[#0E0E0C] border-black/10 dark:border-white/10 text-[#111111] dark:text-white"
                      }`}>
                        {item.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-4 w-4 opacity-50" />}
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${item.status === "done" ? "text-emerald-500 line-through opacity-70" : "text-[#111111] dark:text-white"}`}>
                          {item.subject}
                        </h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-1">
                          {item.count} cartes
                        </p>
                      </div>
                    </div>
                    {item.status !== "done" && (
                      <ChevronRight className="h-5 w-5 text-[#888888] opacity-50" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReviewPlanner;
