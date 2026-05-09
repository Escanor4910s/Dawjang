import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, Brain, RefreshCw, RotateCcw, Trash2, CheckSquare } from "lucide-react";
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

          <Card className="min-h-[350px] bg-card/70 backdrop-blur-xl border border-border rounded-[2rem] shadow-sm relative overflow-hidden">
            <CardHeader className="p-6 sm:p-10 border-b border-border">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-primary flex-shrink-0" />
                <CardTitle className="text-2xl sm:text-3xl font-light leading-relaxed">{current.question}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-10">
              {showAnswer ? (
                <>
                  <div className="p-6 bg-green-50/80 backdrop-blur-md rounded-2xl border border-green-200">
                    <p className="text-xs font-bold uppercase tracking-widest text-green-800 mb-3">Réponse :</p>
                    <p className="text-xl sm:text-2xl text-green-900 font-medium leading-relaxed">{current.answer}</p>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-center text-muted-foreground uppercase tracking-widest">Comment avez-vous trouvé cette carte ?</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[0, 1, 2, 3, 4, 5].map((q) => (
                        <Button key={q} variant={q >= 3 ? "default" : "outline"} size="sm" disabled={updating} onClick={() => handleRate(q)} className={`flex flex-col h-16 rounded-xl border-border transition-transform hover:scale-105 shadow-sm ${getQualityColor(q)} ${q >= 3 ? 'text-background' : ''}`}>
                          <span className="text-2xl font-light">{q}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">{getQualityLabel(q)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="pt-12 pb-6">
                  <Button onClick={() => setShowAnswer(true)} variant="outline" className="w-full h-14 rounded-full border-border hover:bg-muted text-foreground font-medium shadow-sm text-lg">
                    <RotateCcw className="h-5 w-5 mr-3" />Voir la réponse
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
      </div>
    </div>
  );
};

export default Review;
