import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, RefreshCw, RotateCcw, Trash2, Layers, X, Target, Brain, CheckSquare, Sparkles, ThumbsUp, ThumbsDown, AlertTriangle, Zap, Activity, XCircle } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculateSM2 } from "@/lib/sm2Algorithm";
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
  
  // ─── CORRECTION DU BUG DE RETOURNEMENT ───
  const [isFlipped, setIsFlipped] = useState(false); // Contrôle uniquement la physique 3D
  const [hasRevealed, setHasRevealed] = useState(false); // Mémorise si on a vu la réponse
  
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

  // ─── INTERACTION CARTE (Le fix ergonomique) ───
  const handleCardClick = () => {
    if (!isFlipped) {
      // On retourne pour voir la réponse
      setIsFlipped(true);
      setHasRevealed(true);
    } else {
      // On revient sur la question (mais on garde le clavier visible)
      setIsFlipped(false);
    }
    uiAudio.playSoftClick();
  };

  // ─── ACTIONS & LOGIQUE SM-2 ───
  const handleRate = async (quality: number) => {
    if (updating || !filteredCards[currentIndex]) return;
    setUpdating(true);
    const card = filteredCards[currentIndex];
    if (quality >= 4) uiAudio.playSuccess(); else uiAudio.playSoftClick();

    const newParams = calculateSM2(quality, { ease_factor: card.ease_factor, interval: card.interval, repetitions: card.repetitions, next_review: card.next_review });

    try {
      const { error } = await supabase.from("flashcards").update(newParams).eq("id", card.id);
      if (error) throw error;
      
      const newCards = cards.filter((c) => c.id !== card.id);
      setCards(newCards);
      
      if (newCards.length > 0) {
        setCurrentIndex((prev) => (prev >= newCards.length ? 0 : prev));
        // Reset absolu pour la prochaine carte
        setIsFlipped(false);
        setHasRevealed(false);
      } else {
        uiAudio.playSuccess();
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
  const rotateX = useSpring(useTransform(mouseY, [-400, 400], [6, -6]), { damping: 40, stiffness: 150 });
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-6, 6]), { damping: 40, stiffness: 150 });

  const handleCardMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2); mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleCardMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  if (loading) return <div className="min-h-screen bg-background p-8 flex justify-center pt-40"><div className="w-[600px] h-[400px] bg-muted rounded-[3rem] animate-pulse" /></div>;

  const current = filteredCards[currentIndex];

  return (
    <div className="min-h-screen bg-transparent text-foreground font-sans overflow-x-hidden pb-32 relative transition-colors duration-700">
      
      {/* Scroll Mask Injection (Maintient l'élégance du scroll interne) */}
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
            LA BANDEROLE ANIMÉE (Intouchée, avec boutons Glassmorphism)
            ========================================================================= */}
        <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-b-[3rem]">
          <AnimatedBanner 
            title={<>Focus <span className="font-serif italic text-white/90">Cognitif</span></>}
            subtitle="Consolidation neuronale via l'algorithme d'espacement SM-2."
            rightWidgets={
              <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                
                {/* Boutons intégrés à la banderole */}
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

                {/* Télémétrie Widget */}
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
            <Tabs value={selectedFilter} onValueChange={(v) => { setSelectedFilter(v); setCurrentIndex(0); setIsFlipped(false); setHasRevealed(false); }} className="w-full lg:w-auto">
              <TabsList className="h-12 bg-card/60 border border-border shadow-sm backdrop-blur-xl p-1.5 rounded-[1.25rem] w-full flex overflow-x-auto hide-scrollbar">
                <TabsTrigger value="all" className="rounded-xl px-5 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm transition-all">Toutes</TabsTrigger>
                {cardCourses.map(c => (
                  <TabsTrigger key={c.id} value={c.id} className="rounded-xl px-5 text-[11px] font-bold uppercase tracking-widest truncate max-w-[180px] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm transition-all">{c.title}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* =========================================================================
              ÉTAT 1 : SÉLECTION DE MASSE (Désencombrement)
              ========================================================================= */}
          {selectMode ? (
            <motion.div key="selectMode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-5 shadow-inner mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black text-rose-600 bg-rose-500/10 px-4 py-2 rounded-xl">{selectedIds.size} sélectionnées</span>
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
                  <AlertDialogContent className="rounded-[2.5rem] p-8 border-border shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Destruction confirmée ?</AlertDialogTitle><AlertDialogDescription className="font-medium text-muted-foreground">Ces concepts seront définitivement effacés du cycle de révision.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold border-border">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">Confirmer l'éradication</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                {filteredCards.map((c) => (
                  <div key={c.id} onClick={() => { const next = new Set(selectedIds); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setSelectedIds(next); }} className={`flex items-start gap-4 p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer ${selectedIds.has(c.id) ? "bg-rose-500/5 border-rose-500/30 shadow-[0_10px_20px_rgba(244,63,94,0.1)]" : "bg-card border-border hover:border-foreground/30 shadow-sm"}`}>
                    <Checkbox checked={selectedIds.has(c.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground mb-2 line-clamp-3">{c.question}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate bg-muted px-2.5 py-1 rounded-md inline-block">{c.courses?.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) :

          /* =========================================================================
             ÉTAT 2 : ZERO INBOX (Le Cerveau au Repos)
             ========================================================================= */
          cards.length === 0 ? (
            <motion.div key="zero" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pt-10">
              <div className="max-w-3xl mx-auto flex flex-col items-center justify-center text-center p-16 md:p-24 bg-card/40 border-0 shadow-2xl rounded-[3rem] border border-border">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[40px] animate-pulse" />
                  <div className="w-24 h-24 rounded-full bg-background border border-border shadow-2xl flex items-center justify-center relative z-10">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-black text-foreground mb-4 tracking-tight leading-tight">
                  Rétention <span className="text-emerald-500 italic">Maximale.</span>
                </h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto mb-12 text-sm leading-relaxed">
                  L'algorithme SM-2 confirme que tous vos concepts sont solidement ancrés. Aucun risque d'oubli détecté pour aujourd'hui.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button onClick={() => navigate("/flashcards")} className="h-14 px-8 rounded-full bg-foreground text-background hover:scale-105 font-black uppercase tracking-widest text-[10px] transition-all shadow-xl">
                    Créer de nouvelles fiches
                  </Button>
                </div>
              </div>
            </motion.div>
          ) :

          /* =========================================================================
             ÉTAT 3 : LE MONOLITHE 3D SM-2 (Le HUD de Révision)
             ========================================================================= */
          current ? (
            <motion.div key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4 pb-20 flex flex-col items-center">
              
              {/* LE CAISSON HUD (Head-Up Display) DE LA CARTE */}
              <div className="relative p-1 rounded-[3.5rem] bg-gradient-to-b from-primary/10 to-transparent shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] w-full max-w-4xl group">
                <div className="absolute inset-0 rounded-[3.5rem] border border-border pointer-events-none" />
                
                {/* Télémétrie Interne du Caisson */}
                <div className="absolute top-8 left-8 right-8 flex items-center justify-between z-40 pointer-events-none">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border">
                    <Activity className="w-3 h-3 text-primary" /> Fiche {currentIndex + 1} / {filteredCards.length}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary truncate max-w-[200px] bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 backdrop-blur-md">
                    {current.courses?.title}
                  </span>
                </div>

                <div className="perspective-[2500px] w-full h-[550px] relative z-30 pt-16">
                  <motion.div
                    ref={cardRef} onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}
                    style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                    className="w-full h-full relative cursor-pointer"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    onClick={handleCardClick}
                  >
                    {/* ─── FACE RECTO (Concept) ─── */}
                    <div className="absolute inset-0 w-full h-full bg-card rounded-[3rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] [backface-visibility:hidden] flex flex-col border border-border border-t-primary/50 overflow-hidden">
                      {/* Bruit de fond subtil */}
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />
                      
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 mt-6 flex flex-col justify-center relative z-10">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-foreground leading-[1.4] text-center tracking-tight whitespace-pre-wrap">
                          {current.question}
                        </div>
                      </div>
                      <div className="text-center p-6 text-muted-foreground text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0 border-t border-border/50 bg-muted/10">
                        <RotateCcw className="h-4 w-4 text-primary" /> Cliquez pour explorer
                      </div>
                    </div>

                    {/* ─── FACE VERSO (Solution) ─── */}
                    <div className="absolute inset-0 w-full h-full bg-[#050505] rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col border border-[#222] border-t-emerald-500/50 overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
                      <div className="absolute bottom-[-20%] right-[-20%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                      
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 mt-6 flex items-center relative z-10">
                        <div className="whitespace-pre-line font-serif text-xl sm:text-2xl md:text-3xl text-left leading-[1.6] text-white/95">
                          {current.answer}
                        </div>
                      </div>
                      <div className="text-center p-6 text-emerald-500/50 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0 border-t border-white/5 bg-white/[0.02]">
                        <RotateCcw className="h-4 w-4" /> Revenir au Concept
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* ─── LE CLAVIER COGNITIF MAGNÉTIQUE (Apparaît et reste) ─── */}
              <div className="h-[140px] mt-10 flex items-center justify-center w-full">
                <AnimatePresence mode="wait">
                  {hasRevealed ? (
                    <motion.div 
                      key="ratings" 
                      initial={{ opacity: 0, y: 30, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="flex flex-wrap justify-center gap-3 sm:gap-4 relative z-40"
                    >
                      {[
                        { q: 0, label: "Blackout", icon: XCircle, color: "text-rose-500", border: "border-t-rose-500", bgHover: "hover:bg-rose-500 hover:text-white", shadow: "hover:shadow-[0_15px_30px_rgba(244,63,94,0.3)]" },
                        { q: 1, label: "Faux", icon: AlertTriangle, color: "text-orange-500", border: "border-t-orange-500", bgHover: "hover:bg-orange-500 hover:text-white", shadow: "hover:shadow-[0_15px_30px_rgba(249,115,22,0.3)]" },
                        { q: 3, label: "Difficile", icon: ThumbsDown, color: "text-amber-500", border: "border-t-amber-500", bgHover: "hover:bg-amber-500 hover:text-white", shadow: "hover:shadow-[0_15px_30px_rgba(245,158,11,0.3)]" },
                        { q: 4, label: "Correct", icon: ThumbsUp, color: "text-blue-500", border: "border-t-blue-500", bgHover: "hover:bg-blue-500 hover:text-white", shadow: "hover:shadow-[0_15px_30px_rgba(59,130,246,0.3)]" },
                        { q: 5, label: "Parfait", icon: Zap, color: "text-emerald-500", border: "border-t-emerald-500", bgHover: "hover:bg-emerald-500 hover:text-white", shadow: "hover:shadow-[0_15px_30px_rgba(16,185,129,0.3)]" }
                      ].map(({ q, label, icon: Icon, color, border, bgHover, shadow }) => (
                        <MagneticWrapper key={q} strength={0.2}>
                          <button 
                            disabled={updating} 
                            onClick={(e) => { e.stopPropagation(); handleRate(q); }} 
                            className={`group relative w-[90px] sm:w-[110px] h-[80px] sm:h-[90px] rounded-2xl bg-card border border-border border-t-[3px] ${border} transition-all duration-300 flex flex-col items-center justify-center gap-1.5 hover:-translate-y-3 ${bgHover} ${shadow} overflow-hidden`}
                          >
                            {/* Lueur interne au survol */}
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            
                            <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-125 group-hover:mb-1 ${color} group-hover:text-white`} />
                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${color} group-hover:text-white`}>{label}</span>
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
