import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, RotateCw, RefreshCw, BookOpen, CheckSquare, Sparkles, X, Target, Brain, Dices, Layers, ArrowLeft, Play, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { uiAudio } from "@/utils/audio";
import { AnimatedBanner } from "@/components/AnimatedBanner";

// ─── TYPES ───
interface Flashcard { id: string; course_id: string; question: string; answer: string; created_at: string; courses: { title: string; }; }
interface Course { id: string; title: string; }
interface BuilderConfig { courseId: string; type: "socratic" | "binary" | "concept"; scope: "global" | "random"; count: 5 | 10 | 15 | 20; }

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // States d'Architecture de la Page
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // State du Deck Builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [builderConfig, setBuilderConfig] = useState<BuilderConfig>({ courseId: "", type: "socratic", scope: "global", count: 10 });

  const navigate = useNavigate();

  // ─── CHARGEMENT DES DONNÉES ───
  const fetchFlashcards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from("flashcards").select(`id, course_id, question, answer, created_at, courses(title)`).eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setFlashcards(data || []);
    } catch (error) { toast.error("Erreur de synchronisation neurale."); } 
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate]);

  const fetchCourses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("courses").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setCourses(data || []);
      if (data && data.length > 0) setBuilderConfig(prev => ({ ...prev, courseId: data[0].id }));
    } catch (error) { console.error("Error fetching courses:", error); }
  }, []);

  useRealtimeSubscription({ table: 'flashcards', event: '*', onUpdate: fetchFlashcards });
  useEffect(() => { fetchFlashcards(); fetchCourses(); }, [fetchFlashcards, fetchCourses]);

  // ─── AGRÉGATION EN "DECKS" (La Bibliothèque) ───
  const decks = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    flashcards.forEach(f => {
      if (!map.has(f.course_id)) map.set(f.course_id, { id: f.course_id, title: f.courses?.title || "Sujet non défini", count: 0 });
      map.get(f.course_id)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [flashcards]);

  const deckCards = useMemo(() => {
    if (!activeDeckId) return [];
    return flashcards.filter(f => f.course_id === activeDeckId);
  }, [flashcards, activeDeckId]);

  // ─── ACTIONS & LOGIQUE ───
  const handleGenerateDeck = async () => {
    if (!builderConfig.courseId) return toast.error("Sélectionnez une source d'apprentissage.");
    
    setIsGenerating(true);
    const toastId = toast.loading("Forge cognitive en cours...", { description: `Analyse du cours et génération de ${builderConfig.count} cartes mode ${builderConfig.type}.` });
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-flashcards-openai', {
        body: builderConfig
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Deck généré avec succès !", { id: toastId, description: `${data?.count || builderConfig.count} nouvelles cartes sont prêtes pour la révision.` });
      uiAudio.playSuccessChime();
      setShowBuilder(false);
      fetchFlashcards();
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de la Forge", { id: toastId, description: err.message || "Impossible de générer le deck." });
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteFlashcard = async (id: string) => {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) { toast.error("Échec de la suppression"); return; }
    setFlashcards(prev => prev.filter(f => f.id !== id));
    if (currentIndex >= deckCards.length - 1) setCurrentIndex(Math.max(0, deckCards.length - 2));
    toast.success("Concept effacé.");
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) { toast.error("Erreur de suppression"); return; }
    setFlashcards(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set()); setSelectMode(false);
    toast.success(`${ids.length} cartes éradiquées.`);
  };

  const handleSelectAll = () => {
    const targetList = activeDeckId ? deckCards : flashcards;
    if (selectedIds.size === targetList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(targetList.map(f => f.id)));
    uiAudio.playSoftClick();
  };

  const openDeck = (courseId: string) => { setActiveDeckId(courseId); setCurrentIndex(0); setIsFlipped(false); uiAudio.playSoftClick(); };
  const closeDeck = () => { setActiveDeckId(null); setIsFlipped(false); uiAudio.playSoftClick(); };

  const handleNext = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % deckCards.length); uiAudio.playSoftClick(); };
  const handlePrevious = () => { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + deckCards.length) % deckCards.length); uiAudio.playSoftClick(); };

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

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans overflow-x-hidden pb-32 relative transition-colors duration-500">
      
      {/* Moteur CSS Injecté : Scroll Fade & Hide Scrollbar */}
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
            LA BANDEROLE ANIMÉE (Boutons intégrés et Design parfait)
            ========================================================================= */}
        <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-b-[3rem]">
          <AnimatedBanner 
            title={<>Bibliothèque <span className="font-serif italic text-white/90">Flash</span></>}
            subtitle="Forgez, classez et mémorisez vos cartes avec l'algorithme d'espacement."
            rightWidgets={
              <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                
                {/* LES BOUTONS INTÉGRÉS À LA BANDEROLE */}
                {activeDeckId ? (
                  <Button onClick={closeDeck} className="h-11 px-6 rounded-[14px] bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all font-bold uppercase tracking-widest text-[11px] shadow-sm backdrop-blur-xl">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux Decks
                  </Button>
                ) : (
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button onClick={() => { setRefreshing(true); fetchFlashcards(); }} className="w-11 h-11 rounded-[14px] bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 p-0 transition-all shrink-0 backdrop-blur-xl">
                      <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                    
                    {flashcards.length > 0 && !showBuilder && (
                      <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} className={`h-11 px-5 rounded-[14px] font-bold uppercase tracking-widest text-[11px] transition-all flex-1 md:flex-none backdrop-blur-xl ${selectMode ? "bg-white text-[#111111] shadow-lg" : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30"}`}>
                        {selectMode ? <X className="w-4 h-4 mr-2" /> : <LayoutGrid className="w-4 h-4 mr-2" />}
                        {selectMode ? "Terminer Édition" : "Gérer la Pile"}
                      </Button>
                    )}
                    
                    {!selectMode && (
                      /* BOUTON PRÉSERVÉ EXACTEMENT TEL QUEL (Sauf ajout de md:flex-none pour le layout flex) */
                      <Button onClick={() => setShowBuilder(!showBuilder)} className={`h-11 px-6 rounded-[14px] font-bold uppercase tracking-widest text-[11px] shadow-md transition-all flex-1 md:flex-none ${showBuilder ? "bg-[#111111] text-white dark:bg-white dark:text-[#111111]" : "bg-[#5B21B6] hover:bg-[#4C1D95] text-white shadow-[#5B21B6]/20"}`}>
                        {showBuilder ? <X className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {showBuilder ? "Fermer Forgeur" : "Nouveau Deck"}
                      </Button>
                    )}
                  </div>
                )}

                {/* STATS WIDGET */}
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] px-6 py-4 flex flex-col items-start min-w-[140px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Total Cartes</span>
                  <span className="text-4xl font-light text-white tracking-tighter">{flashcards.length}</span>
                </div>
              </div>
            }
          />
        </div>

        <AnimatePresence mode="wait">
          
          {/* =========================================================================
              ÉTAT 1 : LE FORGEUR (Deck Builder IA)
              ========================================================================= */}
          {showBuilder && !activeDeckId && !selectMode ? (
            <motion.div 
              key="builder"
              initial={{ opacity: 0, y: -20, filter: "blur(10px)" }} 
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} 
              exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              className="bg-white dark:bg-[#111111] rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden"
            >
              <div className="p-8 md:p-12 space-y-12">
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#888888] flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#5B21B6]" /> 1. Source d'apprentissage</label>
                  {courses.length > 0 ? (
                    <select value={builderConfig.courseId} onChange={(e) => setBuilderConfig(prev => ({ ...prev, courseId: e.target.value }))} className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 hover:border-[#5B21B6]/50 focus:border-[#5B21B6] transition-all rounded-[1.25rem] px-5 py-4 text-[13px] font-semibold text-[#111111] dark:text-white outline-none cursor-pointer">
                      {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20">Aucun cours. Veuillez numériser un document dans l'archive.</div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-widest text-[#888888] flex items-center gap-2"><Target className="w-4 h-4 text-[#5B21B6]" /> 2. Topologie Pédagogique</label>
                    <div className="flex flex-col gap-3">
                      {[
                        { id: "socratic", label: "Mode Socratique", desc: "Question directe ➔ Réponse détaillée.", icon: Brain },
                        { id: "binary", label: "Vérité Clinique", desc: "Assertion ➔ Vrai / Faux + Justification.", icon: CheckSquare },
                        { id: "concept", label: "Concept Clé", desc: "Mot-clé ➔ Définition & implication.", icon: Sparkles }
                      ].map((type) => (
                        <div key={type.id} onClick={() => setBuilderConfig(prev => ({ ...prev, type: type.id as any }))} className={`flex items-start gap-4 p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all ${builderConfig.type === type.id ? "border-[#5B21B6] bg-[#5B21B6]/5 shadow-sm" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10"}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${builderConfig.type === type.id ? "bg-[#5B21B6] text-white" : "bg-black/5 dark:bg-white/5 text-[#888888]"}`}><type.icon className="w-5 h-5" /></div>
                          <div><h4 className={`text-[13px] font-bold ${builderConfig.type === type.id ? "text-[#5B21B6]" : "text-[#111111] dark:text-white"}`}>{type.label}</h4><p className="text-[11px] text-[#666666] dark:text-[#888888] mt-1">{type.desc}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-12">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-widest text-[#888888] flex items-center gap-2"><Dices className="w-4 h-4 text-[#5B21B6]" /> 3. Balayage</label>
                      <div className="flex bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-[1.25rem] p-1.5">
                        <button onClick={() => setBuilderConfig(prev => ({ ...prev, scope: "global" }))} className={`flex-1 h-12 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${builderConfig.scope === "global" ? "bg-white dark:bg-[#222] text-[#111111] dark:text-white shadow-sm" : "text-[#888888]"}`}>Global</button>
                        <button onClick={() => setBuilderConfig(prev => ({ ...prev, scope: "random" }))} className={`flex-1 h-12 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${builderConfig.scope === "random" ? "bg-white dark:bg-[#222] text-[#111111] dark:text-white shadow-sm" : "text-[#888888]"}`}>Aléatoire</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-widest text-[#888888] flex items-center gap-2"><Layers className="w-4 h-4 text-[#5B21B6]" /> 4. Volume Maximal</label>
                      <div className="flex gap-2">
                        {[5, 10, 15, 20].map((num) => (
                          <button key={num} onClick={() => setBuilderConfig(prev => ({ ...prev, count: num as any }))} className={`flex-1 h-14 rounded-[1.25rem] border-2 text-[14px] font-black transition-all ${builderConfig.count === num ? "border-[#5B21B6] bg-[#5B21B6] text-white shadow-md shadow-[#5B21B6]/20" : "border-black/5 dark:border-white/5 text-[#666666] hover:border-black/10"}`}>{num}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-8 border-t border-black/5 dark:border-white/5">
                  <Button onClick={handleGenerateDeck} disabled={isGenerating || !builderConfig.courseId} className="w-full h-16 rounded-[1.5rem] bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-black uppercase tracking-widest text-[12px] shadow-xl hover:scale-[1.01] transition-all relative overflow-hidden group">
                    {isGenerating ? <span className="flex items-center gap-3"><RefreshCw className="w-5 h-5 animate-spin" /> Synthèse en cours...</span> : <span className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#5B21B6]" /> Forger le Deck ({builderConfig.count} Cartes)</span>}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : 

          /* =========================================================================
             ÉTAT 2 : LA BIBLIOTHÈQUE (Grille de Decks avec l'Empilement DOM parfait)
             ========================================================================= */
          !activeDeckId && !selectMode ? (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {decks.length === 0 ? (
                <div className="pt-10 flex flex-col items-center justify-center text-center p-16 bg-white/40 dark:bg-[#111111]/40 rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm">
                  <Layers className="w-16 h-16 text-[#888888] mb-6 opacity-50" />
                  <h2 className="text-3xl font-serif font-black text-[#111111] dark:text-white mb-2">Votre librairie est vide.</h2>
                  <p className="text-[#888888] font-medium">Utilisez le Forgeur pour générer votre premier deck de révision.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pt-6 pb-12">
                  {decks.map(deck => (
                    <div key={deck.id} onClick={() => openDeck(deck.id)} className="group cursor-pointer relative w-full h-[180px] mb-4">
                      
                      {/* Carte Couche 2 (Arrière, plus petite) */}
                      <div className="absolute left-6 right-6 top-4 bottom-[-16px] bg-black/5 dark:bg-white/5 rounded-[2rem] transition-all duration-300 group-hover:bottom-[-20px] group-hover:bg-black/10 dark:group-hover:bg-white/10" />
                      
                      {/* Carte Couche 1 (Milieu) */}
                      <div className="absolute left-3 right-3 top-2 bottom-[-8px] bg-black/10 dark:bg-white/10 rounded-[2rem] transition-all duration-300 group-hover:bottom-[-10px] group-hover:bg-black/15 dark:group-hover:bg-white/15" />
                      
                      {/* Carte Principale (Devant) avec l'Architecture Premium */}
                      <div className="absolute inset-0 z-10 rounded-[2rem] transition-transform duration-500 group-hover:-translate-y-2 overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.05)] group-hover:shadow-[0_20px_50px_-15px_rgba(91,33,182,0.3)]">
                        
                        {/* Faisceaux Lumineux Rotatifs (Bordure Multicolore) */}
                        <div className="absolute inset-[-50%] z-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,#5B21B6_360deg)] opacity-0 group-hover:opacity-100 animate-[spin_3s_linear_infinite] transition-opacity duration-500" />
                        <div className="absolute inset-[-50%] z-0 bg-[conic-gradient(from_120deg,transparent_0_340deg,#10B981_360deg)] opacity-0 group-hover:opacity-100 animate-[spin_3s_linear_infinite] transition-opacity duration-500" />
                        <div className="absolute inset-[-50%] z-0 bg-[conic-gradient(from_240deg,transparent_0_340deg,#ec4899_360deg)] opacity-0 group-hover:opacity-100 animate-[spin_3s_linear_infinite] transition-opacity duration-500" />
                        
                        {/* Fond interne et isolation */}
                        <div className="absolute inset-[1.5px] bg-white dark:bg-[#111111] rounded-[2rem] z-10 transition-colors duration-500" />

                        {/* Contenu de la Carte */}
                        <div className="relative z-20 p-6 h-full flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1.5 rounded-md group-hover:bg-[#5B21B6] group-hover:text-white transition-colors duration-500 shadow-sm flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity absolute -ml-4" /> 
                              Deck
                            </span>
                            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#111111] dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-[#111111] transition-all duration-300 shadow-lg">
                              <Play className="w-3.5 h-3.5 ml-0.5" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-serif font-bold text-[#111111] dark:text-white line-clamp-2 leading-tight mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#5B21B6] group-hover:to-[#ec4899] transition-all duration-500">
                              {deck.title}
                            </h3>
                            <p className="font-mono text-xs font-bold text-[#888888] tracking-widest flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-[#5B21B6] opacity-0 group-hover:opacity-100 transition-opacity -ml-5 group-hover:ml-0 duration-300" />
                              {deck.count} CARTES
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) :

          /* =========================================================================
             ÉTAT 3 : SÉLECTION DE MASSE (Avec "Tout Sélectionner")
             ========================================================================= */
          selectMode ? (
            <motion.div key="selectMode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-5 shadow-inner mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black text-rose-600 bg-rose-500/10 px-4 py-2 rounded-xl">{selectedIds.size} sélectionnées</span>
                  
                  {/* BOUTON DE SÉLECTION GLOBALE MASSIVE */}
                  <Button onClick={handleSelectAll} variant="ghost" className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-500/20 transition-colors">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {selectedIds.size === flashcards.length && flashcards.length > 0 ? "Désélectionner Tout" : "Tout Sélectionner"}
                  </Button>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedIds.size === 0} variant="destructive" className="w-full sm:w-auto rounded-xl h-10 px-6 shadow-lg shadow-rose-500/20 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                      <Trash2 className="w-4 h-4 mr-2" />Éradiquer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem] p-8 border-black/5 shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Destruction confirmée ?</AlertDialogTitle><AlertDialogDescription className="font-medium text-[#666666]">Ces concepts seront définitivement effacés.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold border-black/10">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">Confirmer l'éradication</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                {flashcards.map((c) => (
                  <div key={c.id} onClick={() => { const next = new Set(selectedIds); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); setSelectedIds(next); }} className={`flex items-start gap-4 p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer ${selectedIds.has(c.id) ? "bg-rose-500/5 border-rose-500/30 shadow-sm" : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 hover:border-black/10 shadow-sm"}`}>
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
             ÉTAT 4 : L'ESPACE D'ÉTUDE (Le Monolithe 3D du Deck Actif)
             ========================================================================= */
          activeDeckId && deckCards.length > 0 ? (
            <motion.div key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4 pb-20 flex flex-col items-center">
              <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888] bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 px-4 py-2 rounded-full">
                  Fiche {currentIndex + 1} <span className="opacity-40">/ {deckCards.length}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] truncate max-w-[200px] md:max-w-[300px] bg-[#5B21B6]/10 px-4 py-2 rounded-full border border-[#5B21B6]/20">
                  {deckCards[currentIndex]?.courses?.title}
                </span>
              </div>

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
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    onClick={() => { setIsFlipped(!isFlipped); uiAudio.playSoftClick(); }}
                  >
                    {/* RECTO */}
                    <div className="absolute inset-0 w-full h-full bg-[#FFFFFF] dark:bg-[#111111] rounded-[3rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] [backface-visibility:hidden] flex flex-col border border-black/5 dark:border-[#222]">
                      <div className="flex justify-between items-center p-8 pb-4 border-b border-black/5 dark:border-white/10 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#5B21B6]">Énoncé Clinique</span>
                      </div>
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex flex-col justify-center">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#111111] dark:text-white leading-[1.4] text-center tracking-tight whitespace-pre-wrap">
                          {deckCards[currentIndex]?.question}
                        </div>
                      </div>
                      <div className="text-center p-6 border-t border-black/5 dark:border-white/10 text-[#888888] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0">
                        <RotateCw className="h-4 w-4" /> Cliquer pour révéler
                      </div>
                    </div>

                    {/* VERSO */}
                    <div className="absolute inset-0 w-full h-full bg-[#050505] rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col border border-[#222]">
                      <div className="flex justify-between items-center p-8 pb-4 border-b border-white/10 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Solution</span>
                      </div>
                      <div className="flex-1 overflow-y-auto fade-y-scroll hide-scrollbar p-8 sm:p-12 flex items-center">
                        <div className="whitespace-pre-line font-serif text-xl sm:text-2xl md:text-3xl text-left leading-[1.6] text-white/95">
                          {deckCards[currentIndex]?.answer}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Contrôles Navigation */}
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center w-full max-w-4xl mt-8 px-4">
                <Button onClick={handlePrevious} disabled={deckCards.length <= 1} className="w-full sm:w-32 h-14 rounded-full bg-white dark:bg-[#111111] text-[#111111] dark:text-white border border-black/10 dark:border-white/10 hover:bg-black/5 font-bold uppercase tracking-widest text-[10px] shadow-sm">Précédent</Button>
                <div className="flex justify-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] p-8 border-black/5 shadow-2xl">
                      <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Effacer cette carte ?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold border-black/10">Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteFlashcard(deckCards[currentIndex].id)} className="rounded-xl font-bold bg-rose-500 text-white">Supprimer</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Button onClick={handleNext} className="w-full sm:w-32 h-14 rounded-full bg-[#111111] text-white dark:bg-white dark:text-[#111111] hover:scale-105 font-black uppercase tracking-widest text-[10px] shadow-xl transition-all">Suivant</Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default Flashcards;
