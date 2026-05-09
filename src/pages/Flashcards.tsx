import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

          <Card className="min-h-[320px] sm:min-h-[400px] cursor-pointer bg-card/70 backdrop-blur-xl border border-border rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity duration-500 ${isFlipped ? 'opacity-100' : 'opacity-0'}`} />
            <CardContent className="flex flex-col items-center justify-center min-h-[320px] sm:min-h-[400px] p-6 sm:p-12 relative z-10">
              <div className="text-center w-full">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-6">{isFlipped ? "Réponse" : "Question"}</p>
                <p className="text-2xl sm:text-4xl font-light leading-relaxed text-foreground">{isFlipped ? filteredFlashcards[currentIndex]?.answer : filteredFlashcards[currentIndex]?.question}</p>
                <p className="text-xs font-medium text-muted-foreground mt-12 flex items-center justify-center gap-1">
                  <RotateCw className="w-3 h-3 group-hover:animate-spin" /> Cliquez pour retourner
                </p>
              </div>
            </CardContent>
          </Card>

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
