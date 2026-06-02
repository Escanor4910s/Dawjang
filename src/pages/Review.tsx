import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, RefreshCw, RotateCcw, Trash2, Layers, X, Target, Brain, CheckSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculateSM2, getQualityLabel } from "@/lib/sm2Algorithm";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { uiAudio } from "@/utils/audio";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── TYPES ───
interface ReviewFlashcard {
  id: string; question: string; answer: string; course_id: string;
  ease_factor: number; interval: number; repetitions: number; next_review: string;
  courses: { title: string };
}

// ─── INGÉNIERIE GRAPHIQUE MAGNÉTIQUE ───
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

// ─── MOTEUR DE RÉVISION ───
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

  // ─── CHARGEMENT DES CARTES ÉCHUES ───
  const fetchDueCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.from("flashcards")
        .select("id, question, answer, course_id, ease_factor, interval, repetitions, next_review, courses(title)")
        .eq("user_id", user.id).lte("next_review", today).order("next_review", { ascending: true });
      if (error) throw error;
      setCards((data as any) || []);
    } catch (error) { toast.error("Erreur de synchronisation neurale."); } 
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate]);

  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { fetchDueCards(); }, [fetchDueCards]);

  const cardCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cards) { if (c.courses?.title && !map.has(c.course_id)) map.set(c.course_id, c.courses.title); }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (selectedFilter === "all") return cards;
    return cards.filter(c => c.course_id === selectedFilter);
  }, [cards, selectedFilter]);

  // ─── ACTIONS & LOGIQUE SM-2 ───
  const handleRate = async (quality: number) => {
    if (updating || !filteredCards[currentIndex]) return;
    setUpdating(true);
    const card = filteredCards[currentIndex];
    if (quality >= 4) uiAudio.playSuccessChime(); else uiAudio.playSoftClick();

    const newParams = calculateSM2(quality, { ease_factor: card.ease_factor, interval: card.interval, repetitions: card.repetitions, next_review: card.next_review });

    try {
      const { error } = await supabase.from("flashcards").update(newParams).eq("id", card.id);
      if (error) throw error;
      
      const newCards = cards.filter((c) => c.id !== card.id);
      setCards(newCards);
      if (newCards.length > 0) {
        setCurrentIndex((prev) => (prev >= filteredCards.length - 1 ? 0 : prev));
        setShowAnswer(false);
      } else {
        uiAudio.playSuccessChime(); // Fanfare de complétion
      }
    } catch { toast.error("Échec de la consolidation en base."); } 
    finally { setUpdating(false); }
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) { toast.error("Échec de l'éradication."); return; }
    setCards(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set()); setSelectMode(false); setCurrentIndex(0);
    toast.success(`${ids.length} concept(s) éradiqué(s).`);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCards.map(f => f.id)));
    uiAudio.playSoftClick();
  };

  // ─── PARALLAXE DE LA CARTE 3D ───
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

  if (loading) return <div className="min-h-screen bg-transparent p-8 flex justify-center pt-40"><div className="w-[600px] h-[400px] bg-black/5 dark:bg-white/5 rounded-[3rem] animate-pulse" /></div>;

  const current = filteredCards[currentIndex];

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans overflow-x-hidden pb-32 relative transition-colors duration-700">
      
      {/* Scroll Mask Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        .fade-y-scroll {
          mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />



      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-8 space-y-8 relative z-10">
        
        {/* =========================================================================
            LA BANDEROLE ANIMÉE (Boutons d'action incrustés - Glassmorphism)
            ========================================================================= */}
        <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-b-[3rem]">
          <AnimatedBanner 
            title={<>Focus <span className="font-serif italic text-white/90">Cognitif</span></>}
            subtitle="Consolidation neuronale via l'algorithme d'espacement SM-2."
            rightWidgets={
              <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                
                {/* LES BOUTONS INTÉGRÉS À LA BANDEROLE (Visibilité Parfaite) */}
                <div className="flex gap-3 w-full md:w-auto">
                  <Button onClick={() => { setRefreshing(true); fetchDueCards(); }} className="w-11 h-11 rounded-[14px] bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 p-0 transition-all shrink-0 backdrop-blur-xl shadow-sm">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                  
                  {cards.length > 0 && (
                    <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} className={`h-11 px-6 rounded-[14px] font-bold uppercase tracking-widest text-[11px] transition-all flex-1 md:flex-none backdrop-blur-xl shadow-sm ${selectMode ? "bg-white text-[#111111] hover:bg-slate-100" : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30"}`}>
                      {selectMode ? <X className="w-4 h-4 mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
                      {selectMode ? "Terminer Édition" : "Gérer la Pile"}
                    </Button>
                  )}
                </div>

                {/* STATS WIDGET */}
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] px-6 py-4 flex flex-col items-start min-w-[140px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2"><Target className="w-3.5 h-3.5"/> À Réviser</span>
                  <span className="text-4xl font-light text-white tracking-tighter">{cards.length}</span>
                </div>
              </div>
            }
          />
        </div>

        {/* ─── BARRE DE FILTRES (Si plusieurs cours) ─── */}
        {cardCourses.length > 1 && !selectMode && (
          <div className="flex justify-center md:justify-start">
            <Tabs value={selectedFilter} onValueChange={(v) => { setSelectedFilter(v); setCurrentIndex(0); setShowAnswer(false); }} className="w-full lg:w-auto">
              <TabsList className="h-12 bg-white/60 dark:bg-[#111111]/60 border border-black/5 dark:border-white/5 shadow-sm backdrop-blur-xl p-1.5 rounded-[1.25rem] w-full flex overflow-x-auto hide-scrollbar">
                <TabsTrigger value="all" className="rounded-xl px-5 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-[#222] data-[state=active]:text-[#111111] dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">Toutes</TabsTrigger>
                {cardCourses.map(c => (
                  <TabsTrigger key={c.id} value={c.id} className="rounded-xl px-5 text-[11px] font-bold uppercase tracking-widest truncate max-w-[180px] data-[state=active]:bg-white dark:data-[state=active]:bg-[#222] data-[state=active]:text-[#111111] dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all">{c.title}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* =========================================================================
              ÉTAT 1 : SÉLECTION DE MASSE
              ========================================================================= */}
          {selectMode ? (
            <motion.div key="selectMode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-5 shadow-inner mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black text-rose-600 bg-rose-500/10 px-4 py-2 rounded-xl">{selectedIds.size} sélectionnées</span>
                  
                  {/* BOUTON DE SÉLECTION GLOBALE MASSIVE */}
                  <Button onClick={handleSelectAll} variant="ghost" className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-500/20 transition-colors">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? "Désélectionner Tout" : "Tout Sélectionner"}
                  </Button>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedIds.size === 0} variant="destructive" className="w-full sm:w-auto rounded-xl h-10 px-6 shadow-lg shadow-rose-500/20 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                      <Trash2 className="w-4 h-4 mr-2" />Éradiquer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem] p-8 border-black/5 shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Destruction confirmée ?</AlertDialogTitle><AlertDialogDescription className="font-medium text-[#666666]">Ces concepts seront définitivement effacés du cycle de révision.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold border-black/10">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">Confirmer l'éradication</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                {filteredCards.map((c) => (
                  <div key={c.id} onClick={() => { const next = new Set(selectedIds); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setSelectedIds(next); }} className={`flex items-start gap-4 p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer ${selectedIds.has(c.id) ? "bg-rose-500/5 border-rose-500/30 shadow-[0_10px_20px_rgba(244,63,94,0.1)]" : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 hover:border-black/10 shadow-sm"}`}>
                    <Checkbox checked={selectedIds.has(c.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#111111] dark:text-white mb-2 line-clamp-3">{c.question}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#888888] truncate bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md inline-block">{c.courses?.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) :

          /* =========================================================================
             ÉTAT 2 : ZERO INBOX (Rétention Optimale)
             ========================================================================= */
          cards.length === 0 ? (
            <motion.div key="zero" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pt-10">
              <div className="max-w-3xl mx-auto flex flex-col items-center justify-center text-center p-16 md:p-24 bg-white/40 dark:bg-[#111111]/40 border-0 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] rounded-[3rem] border border-black/5 dark:border-white/5">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[40px] animate-pulse" />
                  <div className="w-24 h-24 rounded-full bg-white dark:bg-[#1A1A1A] border border-black/5 dark:border-white/5 shadow-2xl flex items-center justify-center relative z-10">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-black text-[#111111] dark:text-white mb-4 tracking-tight leading-tight">
                  Rétention <span className="text-emerald-500 italic">Maximale.</span>
                </h2>
                <p className="text-[#888888] font-medium max-w-md mx-auto mb-12 text-sm leading-relaxed">
                  L'algorithme SM-2 confirme que tous vos concepts sont solidement ancrés. Aucun risque d'oubli détecté pour aujourd'hui.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button onClick={() => navigate("/flashcards")} className="h-14 px-8 rounded-full bg-[#111111] text-white dark:bg-white dark:text-[#111111] hover:scale-105 font-black uppercase tracking-widest text-[10px] transition-all shadow-xl">
                    Créer de nouvelles fiches
                  </Button>
                </div>
              </div>
            </motion.div>
          ) :

          /* =========================================================================
             ÉTAT 3 : LE MONOLITHE 3D SM-2 (Session de Révision Active)
             ========================================================================= */
          current ? (
            <motion.div key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4 pb-20 flex flex-col items-center">
              
              {/* Infos Header Carte */}
              <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888] bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 px-4 py-2 rounded-full shadow-sm">
                  Fiche {currentIndex + 1} <span className="opacity-40">/ {filteredCards.length}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] truncate max-w-[200px] md:max-w-[300px] bg-[#5B21B6]/10 px-4 py-2 rounded-full border border-[#5B21B6]/20">
                  {current.courses?.title}
                </span>
              </div>

              {/* Le Monolithe 3D */}
              <div className="perspective-[2500px] w-full max-w-4xl h-[550px] relative z-30">
                {/* 1. Couche Parallaxe (Souris) */}
                <motion.div
                  ref={cardRef} onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}
                  style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                  className="w-full h-full"
                >
                  {/* 2. Couche Retournement (Clic) */}
                  <motion.div
                    className="w-full h-full relative group cursor-pointer"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: showAnswer ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    onClick={() => { if (!showAnswer) { uiAudio.playSoftClick(); setShowAnswer(true); } }}
                  >
                    {/* RECTO */}
                    <div className="absolute inset-0 w-full h-full bg-[#FFFFFF] dark:bg-[#111111] rounded-[3rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] [backface-visibility:hidden] flex flex-col border border-black/5 dark:border-[#222]">
                      <div className="flex justify-between items-center p-8 pb-4 border-b border-black/5 dark:border-white/10 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#5B21B6] flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#5B21B6] animate-pulse" /> Concept Clinique</span>
                      </div>
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex flex-col justify-center">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#111111] dark:text-white leading-[1.4] text-center tracking-tight whitespace-pre-wrap">
                          {current.question}
                        </div>
                      </div>
                      <div className="text-center p-6 border-t border-black/5 dark:border-white/10 text-[#888888] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0">
                        <RotateCcw className="h-4 w-4" /> Cliquer pour révéler la vérité
                      </div>
                    </div>

                    {/* VERSO */}
                    <div className="absolute inset-0 w-full h-full bg-[#050505] rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col border border-[#222]">
                      <div className="flex justify-between items-center p-8 pb-4 border-b border-white/10 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" /> Solution Académique</span>
                      </div>
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex items-center">
                        <div className="whitespace-pre-line font-serif text-xl sm:text-2xl md:text-3xl text-left leading-[1.6] text-white/95">
                          {current.answer}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Le Clavier Cognitif SM-2 */}
              <div className="h-[120px] mt-8 flex items-center justify-center w-full">
                <AnimatePresence mode="wait">
                  {showAnswer ? (
                    <motion.div key="ratings" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="flex flex-wrap justify-center gap-3 sm:gap-4 relative z-40">
                      {[
                        { q: 0, label: "Blackout", color: "bg-white dark:bg-[#111111] text-[#111111] dark:text-white border-black/10 dark:border-white/10 hover:border-[#111111] dark:hover:border-white" },
                        { q: 1, label: "Faux", color: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-500/20 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]" },
                        { q: 3, label: "Difficile", color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/20 hover:bg-amber-500 hover:text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]" },
                        { q: 4, label: "Correct", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-500/20 hover:bg-blue-500 hover:text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]" },
                        { q: 5, label: "Parfait", color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]" }
                      ].map(({ q, label, color }) => (
                        <MagneticWrapper key={q} strength={0.15}>
                          <button disabled={updating} onClick={() => handleRate(q)} className={`w-[90px] sm:w-[110px] h-[70px] sm:h-[80px] rounded-[1.25rem] border transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-sm hover:shadow-lg hover:-translate-y-1 ${color}`}>
                            <span className="text-xl sm:text-2xl font-light leading-none">{q}</span>
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-80">{label}</span>
                          </button>
                        </MagneticWrapper>
                      ))}
                    </motion.div>
                  ) : <motion.div key="placeholder" className="h-full opacity-0 pointer-events-none" />}
                </AnimatePresence>
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default Review;
