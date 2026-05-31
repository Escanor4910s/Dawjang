import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Brain, RefreshCw, Trash2, CheckSquare, Sparkles, Eye, CheckCircle2, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculateSM2, getQualityLabel } from "@/lib/sm2Algorithm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AnimatedBanner } from "@/components/AnimatedBanner";

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
    } catch (error) { toast.error("Erreur de chargement"); } finally { setLoading(false); }
  }, [navigate]);

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
    } catch { toast.error("Erreur de sauvegarde"); } finally { setUpdating(false); }
  };

  const handleMassDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setCards(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set()); setSelectMode(false); setCurrentIndex(0);
    toast.success(`${ids.length} carte(s) supprimée(s)`);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredCards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCards.map(f => f.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0E0E0C] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#0F3B2E]/20 border-t-[#0F3B2E] rounded-full animate-spin" /></div>;
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0E0E0C] text-[#1A1A1A] dark:text-[#F4F4F2] bg-doodle-watermark font-sans px-4 pt-12 pb-12 sm:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#0F3B2E]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-[1200px] mx-auto text-center py-20 relative z-10">
          <div className="w-24 h-24 bg-white dark:bg-[#161614] border border-black/5 dark:border-white/5 rounded-[2rem] mx-auto flex items-center justify-center mb-8 shadow-sm">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif text-[#0F3B2E] tracking-tight mb-4">
            Révisions terminées
          </h1>
          <p className="text-[#1A1A1A]/50 font-medium max-w-md mx-auto mb-10">
            Excellente constance. Votre algorithme d'espacement n'a aucune carte prévue pour l'instant. Profitez-en pour avancer sur de nouveaux cours.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild variant="outline" className="h-14 px-8 rounded-full border-black/10 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 font-bold text-[#1A1A1A] dark:text-[#F4F4F2]">
              <button onClick={() => navigate("/flashcards")}>Gérer mes flashcards</button>
            </Button>
            <Button asChild className="h-14 px-8 rounded-full bg-[#0F3B2E] hover:bg-[#1A1A1A] text-white font-bold shadow-md active:scale-[0.98] transition-transform">
              <button onClick={() => navigate("/dashboard")}>Retour au Dashboard</button>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const current = filteredCards[currentIndex];

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0E0E0C] text-[#1A1A1A] dark:text-[#F4F4F2] bg-doodle-watermark font-sans px-4 pt-8 pb-12 sm:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#0F3B2E]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1000px] mx-auto space-y-8 relative z-10">
        
        {/* HEADER */}
        <AnimatedBanner 
          title="Révision."
          rightWidgets={
            <>
              {/* Bouton Actualiser */}
              <button 
                onClick={fetchDueCards}
                className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
                title="Actualiser"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {/* Bouton Sélection (Correction du bug UX) */}
              <button 
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                className={`h-12 px-6 rounded-full backdrop-blur-md border transition-all duration-300 font-bold uppercase tracking-widest text-xs flex items-center gap-2
                  ${selectMode 
                    ? "bg-orange-500 border-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]" // État Actif
                    : "bg-white/10 border-white/20 text-white hover:bg-white hover:text-black hover:border-white" // État Inactif + Hover parfait
                  }
                `}
              >
                <CheckSquare className="h-4 w-4" />
                Sélection
              </button>
            </>
          }
        />

        {/* FILTERS */}
        {cardCourses.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setSelectedFilter("all"); setCurrentIndex(0); setShowAnswer(false); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${selectedFilter === "all" ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white dark:bg-[#161614] text-[#1A1A1A]/60 dark:text-[#F4F4F2]/60 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"}`}>
              Toutes ({cards.length})
            </button>
            {cardCourses.map(c => (
              <button key={c.id} onClick={() => { setSelectedFilter(c.id); setCurrentIndex(0); setShowAnswer(false); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all border max-w-[200px] truncate ${selectedFilter === c.id ? "bg-[#0F3B2E] text-white border-[#0F3B2E]" : "bg-white dark:bg-[#161614] text-[#1A1A1A]/60 dark:text-[#F4F4F2]/60 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"}`}>
                {c.title} ({cards.filter(card => card.course_id === c.id).length})
              </button>
            ))}
          </div>
        )}

        {/* MASS DELETE BAR */}
        <AnimatePresence>
          {selectMode && selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-rose-700 hover:bg-rose-100 font-semibold text-xs rounded-full">
                  {selectedIds.size === filteredCards.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
                <span className="text-sm font-bold text-rose-900">{selectedIds.size} carte(s) sélectionnée(s)</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="rounded-full shadow-sm"><Trash2 className="h-4 w-4 mr-2" /> Supprimer</Button></AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-black/5 shadow-2xl">
                  <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl text-[#1A1A1A]">Suppression définitive</AlertDialogTitle><AlertDialogDescription className="text-base text-[#1A1A1A]/60">Vous allez effacer ces cartes de votre cycle de révision.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete} className="rounded-full bg-rose-600 hover:bg-rose-700 text-white">Confirmer</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REVIEW AREA */}
        {selectMode ? (
          <div className="grid gap-3">
            {filteredCards.map((card) => (
              <div key={card.id} onClick={() => toggleSelect(card.id)} className={`flex items-start gap-4 p-5 rounded-2xl border transition-colors cursor-pointer ${selectedIds.has(card.id) ? "bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700" : "bg-white dark:bg-[#161614] border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"}`}>
                <Checkbox checked={selectedIds.has(card.id)} className={`mt-1 rounded-sm ${selectedIds.has(card.id) ? "data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-serif text-[#1A1A1A] mb-1">{card.question}</p>
                  <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider truncate">{card.courses?.title}</p>
                </div>
              </div>
            ))}
          </div>
        ) : current ? (
          <div className="flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between mb-8 px-2">
              <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
                Carte {currentIndex + 1} sur {filteredCards.length}
              </span>
              <span className="text-[10px] font-bold text-[#0F3B2E] bg-[#0F3B2E]/5 px-3 py-1.5 rounded-md truncate max-w-[250px]">
                {current.courses?.title}
              </span>
            </div>

            {/* Scrollbar luxueuse invisible - moved to index.css */}

            <Card className="min-h-[450px] bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow duration-300 relative flex flex-col group">
              <CardHeader className="p-8 md:p-12 border-b border-black/5 dark:border-white/5 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <Brain className="h-6 w-6 text-[#5B21B6] flex-shrink-0 mt-1" />
                  <CardTitle className="text-2xl md:text-3xl font-serif leading-relaxed text-[#111111] dark:text-white">
                    {current.question}
                  </CardTitle>
                </div>
              </CardHeader>
              
              <CardContent className="flex flex-col flex-grow p-8 md:p-12 min-h-0">
                <AnimatePresence mode="wait">
                {showAnswer ? (
                  <motion.div 
                    key="answer" 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col h-full"
                  >
                    {/* Conteneur de réponse scrollable */}
                    <div className="flex-grow overflow-y-auto editorial-scrollbar pr-4 mb-8">
                      <div className="p-6 bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/5 dark:border-white/5 rounded-2xl">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#5B21B6] mb-4 flex items-center gap-2">
                           Réponse :
                        </p>
                        <p className="text-xl text-[#111111] dark:text-white font-medium leading-relaxed whitespace-pre-wrap">
                          {current.answer}
                        </p>
                      </div>
                    </div>

                    {/* Boutons d'évaluation (fixes en bas) */}
                    <div className="pt-6 border-t border-black/10 dark:border-white/10 flex-shrink-0">
                      <p className="text-[10px] font-bold text-center text-[#888888] uppercase tracking-widest mb-4">
                        Évaluez votre rappel
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[0, 1, 3, 5].map((q) => (
                          <button 
                            key={q} 
                            disabled={updating} 
                            onClick={() => handleRate(q)} 
                            className={`flex items-center justify-center h-14 rounded-xl border transition-all duration-200 font-bold text-sm uppercase tracking-wider ${
                              q >= 3 
                                ? "bg-white dark:bg-[#161614] border-black/10 dark:border-white/10 text-[#111111] dark:text-white hover:bg-[#5B21B6] hover:text-white hover:border-[#5B21B6]" 
                                : "bg-white dark:bg-[#161614] border-black/10 dark:border-white/10 text-[#111111] dark:text-white hover:bg-[#111111] hover:text-white"
                            }`}
                          >
                            {q === 0 ? "Oubli" : q === 1 ? "Difficile" : q === 3 ? "Correct" : "Évident"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="reveal" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="flex flex-col items-center justify-center flex-grow"
                  >
                    <button 
                      onClick={() => setShowAnswer(true)} 
                      className="px-10 py-5 rounded-full bg-[#111111] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] transition-colors duration-200 shadow-md flex items-center gap-3 group"
                    >
                      Dévoiler la réponse
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </CardContent>
            </Card>

          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Review;
