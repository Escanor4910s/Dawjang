import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Download, RotateCw, RefreshCw, FileDown, Search, BookOpen, ChevronDown, CheckSquare, Sparkles, Brain, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportFlashcardsToPDF } from "@/utils/pdfExport";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Flashcard { id: string; course_id: string; question: string; answer: string; created_at: string; courses: { title: string; }; }
interface Course { id: string; title: string; content?: string; }

// ─── COMPOSANTS GRAPHIQUES (Scribbles fait main) ───
const DrawnArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M10 90 Q 40 10 90 10 M 70 10 L 90 10 L 90 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
    />
  </svg>
);

const HighlightCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M 50 10 C 80 10 90 40 90 50 C 90 80 40 90 30 80 C 10 60 20 10 50 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut", delay: 0.2 }}
    />
  </svg>
);

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
    } catch (error) { toast.error("Erreur lors du chargement des flashcards"); } 
    finally { setLoading(false); setRefreshing(false); }
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

  const flashcardCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of flashcards) { if (f.courses?.title && !map.has(f.course_id)) map.set(f.course_id, f.courses.title); }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [flashcards]);

  const filteredFlashcards = useMemo(() => {
    if (selectedFilter === "all") return flashcards;
    return flashcards.filter(f => f.course_id === selectedFilter);
  }, [flashcards, selectedFilter]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    return courses.filter(c => c.title.toLowerCase().includes(courseSearch.toLowerCase()));
  }, [courses, courseSearch]);

  useRealtimeSubscription({ table: 'flashcards', event: '*', onUpdate: fetchFlashcards });
  useEffect(() => { checkAuth(); fetchFlashcards(); fetchCourses(); }, [fetchFlashcards, fetchCourses]);

  const handleRefresh = async () => { setRefreshing(true); await Promise.all([fetchFlashcards(), fetchCourses()]); toast.success("Bibliothèque actualisée !"); };

  // ─── NOUVELLE LOGIQUE : GÉNÉRATION IA DEPUIS TOUT LE COURS ───
  const generateFlashcardsFromCourse = async (courseId: string, courseTitle: string) => {
    try {
      setGeneratingCourseId(courseId);
      toast.loading(`L'IA analyse le cours "${courseTitle}" pour en extraire les concepts clés...`, { id: "gen-flash" });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. On récupère le contenu complet de la leçon
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("content")
        .eq("id", courseId)
        .single();

      if (courseError || !courseData?.content) {
        throw new Error("Contenu du cours introuvable ou vide.");
      }

      // 2. Appel à l'IA (Via Edge Function Supabase connectée à Gemini/OpenAI)
      // Note: Assure-toi d'avoir déployé une Edge Function 'generate-flashcards-ai'
      // Si tu utilises directement Puter ici, tu peux adapter l'appel.
      const { data: generatedCards, error: aiError } = await supabase.functions.invoke('generate-flashcards-ai', {
        body: { courseId, content: courseData.content, userId: user.id }
      });

      if (aiError) {
        throw new Error("Le moteur IA n'a pas pu traiter la demande. Vérifiez votre configuration Edge Function.");
      }

      toast.success("Fiches de mémorisation générées avec succès !", { id: "gen-flash" });
      setCoursePopoverOpen(false);
      fetchFlashcards();
    } catch (error: any) { 
      console.error("Generation error:", error);
      toast.error(error.message, { id: "gen-flash" }); 
    } finally { 
      setGeneratingCourseId(null); 
    }
  };

  const deleteFlashcard = async (id: string) => {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) return toast.error("Erreur de suppression");
    setFlashcards(prev => prev.filter(f => f.id !== id));
    if (currentIndex >= filteredFlashcards.length - 1) setCurrentIndex(Math.max(0, filteredFlashcards.length - 2));
    toast.success("Flashcard éradiquée");
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("flashcards").delete().in("id", ids);
    if (error) return toast.error("Erreur lors de la suppression de masse");
    setFlashcards(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set()); setSelectMode(false); setCurrentIndex(0);
    toast.success(`${ids.length} flashcard(s) supprimée(s)`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const selectAll = () => { setSelectedIds(selectedIds.size === filteredFlashcards.length ? new Set() : new Set(filteredFlashcards.map(f => f.id))); };
  
  const exportToCSV = () => {
    const csv = [["Question", "Réponse", "Cours"], ...filteredFlashcards.map(f => [f.question, f.answer, f.courses?.title || ""])].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flashcards.csv"; a.click();
    toast.success("Base de données exportée !");
  };

  const exportToPDF = () => {
    exportFlashcardsToPDF(filteredFlashcards.map(f => ({ question: f.question, answer: f.answer, courseName: f.courses?.title || "" })));
    toast.success("Polycopié de fiches téléchargé !");
  };

  if (loading) return <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center"><Layers className="h-10 w-10 text-[#5B21B6] animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#111111] font-sans pb-32 relative overflow-hidden transition-colors duration-500">
      
      {/* ─── INJECTION MOTEUR D'ANIMATION 70/70 ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes banner-wave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-banner-animated {
          background: linear-gradient(-45deg, #020617, #1e3a8a, #5b21b6, #020617);
          background-size: 300% 300%;
          animation: banner-wave 15s ease infinite;
        }
        @keyframes border-spin {
          100% { transform: rotate(360deg); }
        }
        .animate-border-spin {
          background: conic-gradient(from 0deg at 50% 50%, #3b82f6 0%, #ec4899 33%, #5b21b6 66%, #3b82f6 100%);
          animation: border-spin 4s linear infinite;
        }
        .perspective-2000 { perspective: 2000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}} />

      {/* ─── STUDENT CANVAS (Scribbles & Filigranes sur le fond principal) ─── */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-[#5B21B6]/5 blur-[120px] rounded-full pointer-events-none z-0" />
      
      <motion.div initial={{ opacity: 0, rotate: 10 }} animate={{ opacity: 0.15, rotate: 5 }} className="absolute top-[40%] left-[5%] text-4xl font-serif italic font-bold text-[#5B21B6] select-none pointer-events-none z-0">
        Spaced Repetition.
        <HighlightCircle className="absolute -inset-6 text-[#5B21B6]/30 w-[150%] h-[150%]" />
      </motion.div>
      <DrawnArrow className="absolute bottom-[20%] right-[10%] w-32 h-32 text-[#5B21B6]/10 -rotate-12 pointer-events-none z-0" />

      {/* ─── LA BANDEROLE ANIMÉE (L'Ordre Respecté) ─── */}
      <div className="bg-banner-animated w-full pt-12 pb-16 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-10 rounded-b-[3rem]">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-6 relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">Mémorisation Active</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight text-white drop-shadow-md">
              Flashcards IA
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleRefresh} variant="outline" className="h-12 rounded-full border-white/20 text-white bg-white/5 hover:bg-white/20 backdrop-blur-md shadow-sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin text-blue-300' : ''}`} /> Actualiser
            </Button>
            {flashcards.length > 0 && (
              <>
                <Button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }} variant={selectMode ? "default" : "outline"} className={`h-12 rounded-full px-6 font-bold uppercase tracking-widest text-xs transition-colors backdrop-blur-md ${selectMode ? "bg-white text-[#111111] shadow-lg" : "border-white/20 text-white bg-white/5 hover:bg-white/20 shadow-sm"}`}>
                  <CheckSquare className="h-4 w-4 mr-2" /> {selectMode ? "Terminer" : "Gérer"}
                </Button>
                <div className="bg-black/20 p-1.5 rounded-full flex gap-1 border border-white/10 backdrop-blur-md shadow-inner">
                  <Button onClick={exportToCSV} variant="ghost" className="h-9 w-9 rounded-full p-0 text-white hover:bg-white hover:text-black"><Download className="h-4 w-4" /></Button>
                  <Button onClick={exportToPDF} variant="ghost" className="h-9 w-9 rounded-full p-0 text-white hover:bg-white hover:text-black"><FileDown className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pt-10 relative z-10 space-y-10">
        
        {/* ─── BARRE D'OUTILS IA (Verre dépoli) ─── */}
        <div className="bg-white/70 backdrop-blur-2xl border border-black/5 p-4 rounded-[2.5rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col md:flex-row gap-4 justify-between items-center relative z-20">
          
          {/* Nouveau Bouton d'Extraction d'Élite */}
          {courses.length > 0 && (
            <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
              <PopoverTrigger asChild>
                <Button className="w-full md:w-auto h-14 rounded-2xl bg-[#111111] text-white shadow-lg hover:shadow-xl transition-all px-8 justify-between gap-4 font-black text-xs uppercase tracking-widest hover:-translate-y-0.5">
                  <span className="flex items-center gap-3"><Brain className="h-5 w-5 text-violet-400" /> Générer depuis un cours</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-3 rounded-[2rem] border-black/10 shadow-2xl bg-white/95 backdrop-blur-3xl" align="start">
                <div className="relative mb-3">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888]" />
                  <Input placeholder="Rechercher une leçon..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} className="pl-11 h-12 rounded-xl bg-black/5 border-none font-medium" />
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-1 editorial-scrollbar">
                  {filteredCourses.length === 0 ? <p className="text-xs text-center py-6 text-[#888888] font-bold uppercase tracking-widest">Leçon introuvable</p> : (
                    filteredCourses.map((course) => (
                      <button key={course.id} onClick={() => generateFlashcardsFromCourse(course.id, course.title)} disabled={generatingCourseId === course.id} className="w-full text-left px-5 py-4 text-sm font-bold rounded-xl hover:bg-[#5B21B6]/10 hover:text-[#5B21B6] transition-all disabled:opacity-50 flex items-center justify-between group">
                        <span className="truncate pr-4 leading-tight">{course.title}</span>
                        {generatingCourseId === course.id ? <RefreshCw className="h-4 w-4 animate-spin text-[#5B21B6] shrink-0" /> : <Sparkles className="h-4 w-4 text-[#888888] group-hover:text-[#5B21B6] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Filtres par Cours */}
          {flashcardCourses.length > 1 && (
            <Tabs value={selectedFilter} onValueChange={(v) => { setSelectedFilter(v); setCurrentIndex(0); setIsFlipped(false); }} className="w-full md:w-auto">
              <TabsList className="h-14 bg-black/5 p-1.5 rounded-2xl w-full flex overflow-x-auto editorial-scrollbar shadow-inner">
                <TabsTrigger value="all" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#111111] data-[state=active]:shadow-sm transition-all">Toutes ({flashcards.length})</TabsTrigger>
                {flashcardCourses.map(c => (
                  <TabsTrigger key={c.id} value={c.id} className="rounded-xl px-5 text-xs font-bold truncate max-w-[180px] data-[state=active]:bg-white data-[state=active]:text-[#111111] data-[state=active]:shadow-sm transition-all">
                    {c.title}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* ─── MODE SUPPRESSION DE MASSE ─── */}
        <AnimatePresence>
          {selectMode && selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-5 shadow-inner">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-rose-600 font-black hover:bg-rose-500/20 rounded-xl text-[10px] uppercase tracking-widest h-10 px-5">
                  {selectedIds.size === filteredFlashcards.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
                <span className="text-sm font-black text-rose-600 bg-rose-500/10 px-4 py-2 rounded-xl">{selectedIds.size} sélectionnées</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" className="rounded-xl h-10 px-6 shadow-lg shadow-rose-500/20 text-[10px] font-black uppercase tracking-widest"><Trash2 className="h-4 w-4 mr-2" />Éradiquer</Button></AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] p-8 border-black/5 shadow-2xl">
                  <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Destruction confirmée ?</AlertDialogTitle><AlertDialogDescription className="font-medium text-[#666666]">Ces fiches seront définitivement effacées de la base de données. Irréversible.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold border-black/10">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleMassDelete} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">Confirmer l'éradication</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── ZONE DE CONTENU PRINCIPALE ─── */}
        {filteredFlashcards.length === 0 ? (
          <div className="text-center py-32 bg-white/60 backdrop-blur-2xl rounded-[3rem] border border-black/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
            <div className="w-24 h-24 bg-[#5B21B6]/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#5B21B6]/20 shadow-inner"><Layers className="h-10 w-10 text-[#5B21B6]" /></div>
            <h3 className="text-4xl font-serif font-black text-[#111111] mb-4 tracking-tight">Canevas Vierge</h3>
            <p className="text-[#888888] font-medium max-w-md mx-auto text-lg leading-relaxed">
              Sélectionnez un cours pour que l'IA y extrait les concepts fondamentaux sous forme de flashcards actives.
            </p>
          </div>
        ) : selectMode ? (
          
          /* Vue Liste (Sélection) */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFlashcards.map((f) => (
              <div key={f.id} onClick={() => toggleSelect(f.id)} className={`flex items-start gap-4 p-6 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:-translate-y-1 ${selectedIds.has(f.id) ? "bg-rose-500/5 border-rose-500/30 shadow-[0_10px_20px_rgba(244,63,94,0.1)]" : "bg-white border-black/5 hover:border-[#5B21B6]/30 shadow-sm hover:shadow-md"}`}>
                <Checkbox checked={selectedIds.has(f.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#111111] mb-2 leading-relaxed line-clamp-3">{f.question}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#888888] truncate bg-black/5 px-2.5 py-1 rounded-md inline-block">{f.courses?.title}</p>
                </div>
              </div>
            ))}
          </div>
          
        ) : (
          
          /* ─── LE MONOLITHE 3D (La Flashcard 70/70) ─── */
          <div className="space-y-10 pb-20">
            <div className="flex items-center justify-between px-4 max-w-4xl mx-auto">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#888888] bg-white border border-black/5 px-4 py-2 rounded-full shadow-sm">
                Fiche {currentIndex + 1} <span className="opacity-40">/ {filteredFlashcards.length}</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] truncate max-w-[250px] bg-[#5B21B6]/10 px-4 py-2 rounded-full border border-[#5B21B6]/20">
                {filteredFlashcards[currentIndex]?.courses?.title}
              </span>
            </div>

            <div className="perspective-2000 w-full max-w-4xl mx-auto relative group">
              
              {/* LA BORDURE LUMINEUSE ANIMÉE */}
              <div className="absolute -inset-[2px] rounded-[3.5rem] animate-border-spin opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              {/* Ombre Abyssale */}
              <div className="absolute inset-0 bg-black/20 blur-[50px] rounded-[3rem] pointer-events-none -z-10 translate-y-10" />

              <motion.div
                className="min-h-[450px] sm:min-h-[550px] w-full cursor-pointer relative transform-style-3d z-10"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 22 }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* ─── FACE RECTO (Blanche - La Question) ─── */}
                <div className="absolute inset-0 w-full h-full bg-[#FCFBF8] rounded-[calc(3.5rem-2px)] shadow-inner overflow-hidden backface-hidden flex flex-col justify-between p-10 sm:p-16 border border-white">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><Brain className="w-64 h-64 text-[#111111]" /></div>
                  
                  <div className="flex justify-between items-center pb-6 border-b border-black/5 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#5B21B6] flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#5B21B6]" /> Concept Clinique</span>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center relative z-10 py-8">
                    <h3 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#111111] leading-[1.3] text-center tracking-tight">
                      {filteredFlashcards[currentIndex]?.question}
                    </h3>
                  </div>
                  
                  <div className="text-center pt-6 border-t border-black/5 text-[#888888] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
                    <RotateCw className="h-4 w-4" /> Pivoter la carte
                  </div>
                </div>

                {/* ─── FACE VERSO (Noire - La Réponse) ─── */}
                <div className="absolute inset-0 w-full h-full bg-[#050505] rounded-[calc(3.5rem-2px)] shadow-inner overflow-hidden backface-hidden rotate-y-180 flex flex-col justify-between p-10 sm:p-16 border border-[#222]">
                  <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />
                  
                  <div className="flex justify-between items-center pb-6 border-b border-white/10 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" /> Solution Académique</span>
                  </div>
                  
                  <div className="flex-1 flex items-center overflow-y-auto editorial-scrollbar py-8 relative z-10 pr-2">
                    <div className="whitespace-pre-line font-serif text-2xl sm:text-3xl md:text-4xl text-justify leading-relaxed text-white/90">
                      {filteredFlashcards[currentIndex]?.answer}
                    </div>
                  </div>
                  
                  <div className="text-center pt-6 border-t border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest relative z-10">
                    Cliquez pour revenir
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ─── CONTRÔLES DE NAVIGATION TACTILES ─── */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 pt-8 max-w-xl mx-auto relative z-20">
              <Button onClick={() => { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + filteredFlashcards.length) % filteredFlashcards.length); }} variant="outline" className="h-16 w-16 rounded-full border-black/10 shadow-sm hover:scale-105 transition-transform p-0 bg-white"><DrawnArrow className="h-6 w-6 rotate-180 text-[#111111]" /></Button>
              
              <div className="flex gap-4">
                <Button onClick={() => setIsFlipped(!isFlipped)} className="h-16 px-8 rounded-full bg-[#111111] text-white hover:bg-[#5B21B6] font-black uppercase tracking-widest text-[11px] shadow-[0_10px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_10px_30px_rgba(91,33,182,0.4)] transition-all hover:-translate-y-1"><RotateCw className="h-4 w-4 mr-2" /> Retourner</Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" className="h-16 w-16 rounded-full border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white bg-white p-0 shadow-sm transition-all"><Trash2 className="h-5 w-5" /></Button></AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem] p-8">
                    <AlertDialogHeader><AlertDialogTitle className="font-serif text-2xl">Supprimer cette fiche ?</AlertDialogTitle><AlertDialogDescription className="font-medium text-[#666666]">Elle disparaîtra à jamais de vos révisions.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl font-bold">Conserver</AlertDialogCancel><AlertDialogAction onClick={() => deleteFlashcard(filteredFlashcards[currentIndex].id)} className="rounded-xl bg-rose-500 hover:bg-rose-600 font-bold text-white">Éradiquer</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <Button onClick={() => { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % filteredFlashcards.length); }} className="h-16 w-16 rounded-full bg-white text-[#111111] border border-black/10 shadow-sm hover:scale-105 transition-transform p-0"><DrawnArrow className="h-6 w-6 text-[#111111]" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
