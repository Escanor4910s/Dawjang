import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, Brain, Sparkles, Target,
  Settings2, Zap, Layers, AlertCircle, ChevronDown, CheckCircle2, FileUp, BookOpen, Flame
} from "lucide-react";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { uiAudio } from "@/utils/audio";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { useToast } from "@/hooks/use-toast";
import { generateQuizWithLovable } from "@/lib/lovableAiService";

interface ExistingCourse { id: string; title: string; content: string; file_name: string | null; created_at: string; }

export const AddCourse = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast: uiToast } = useToast();
  const { readFile, isReading } = useFileReader();
  const adaptiveState = useAdaptiveDifficulty();

  // --- États du Formulaire ---
  const [sourceType, setSourceType] = useState<"new" | "existing">("new");
  const [courseTitle, setCourseTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [difficulty, setDifficulty] = useState<"facile" | "intermediaire" | "difficile">("facile");
  const [quizType, setQuizType] = useState("classique");
  const [questionCount, setQuestionCount] = useState("20");
  const [aiModel, setAiModel] = useState("med2");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // --- Logique d'initialisation ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { uiToast({ title: "Connexion requise", variant: "destructive" }); navigate("/auth"); return; }
      setUser(user);
    };
    checkUser();
  }, [navigate, uiToast]);

  const fetchExistingCourses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("courses").select("id, title, content, file_name, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    
    const uniqueCourses: ExistingCourse[] = [];
    const seenTitles = new Set<string>();
    
    (data || []).forEach(course => {
      const baseTitle = course.title.replace(/\s*\(Session\s*\d+\)\s*$/i, '').trim();
      const baseTitleLower = baseTitle.toLowerCase();
      if (!seenTitles.has(baseTitleLower)) {
        seenTitles.add(baseTitleLower);
        uniqueCourses.push({ ...course, title: baseTitle });
      }
    });
    setExistingCourses(uniqueCourses);
  }, [user]);

  useEffect(() => { if (user) fetchExistingCourses(); }, [user, fetchExistingCourses]);

  // --- Logique d'Upload ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
      uiAudio.playSoftClick();
      if (!courseTitle) setCourseTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else {
      toast.error("Format de fichier non supporté. Veuillez uploader un PDF, DOCX ou TXT.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const normalizeTitle = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\(session\s*\d+\)\s*$/i, '');
  const getUniqueSessionTitle = async (baseTitle: string, userId: string): Promise<string> => {
    const normalizedBase = normalizeTitle(baseTitle);
    const { data: existing } = await supabase.from("courses").select("title").eq("user_id", userId);
    if (!existing || existing.length === 0) return baseTitle;
    const matchingCourses = existing.filter(course => { const n = normalizeTitle(course.title); return n === normalizedBase || n.startsWith(normalizedBase); });
    if (matchingCourses.length === 0) return baseTitle;
    const sessionNumbers = matchingCourses.map(course => { const match = course.title.match(/\(Session\s*(\d+)\)\s*$/i); return match ? parseInt(match[1]) : 1; });
    return `${baseTitle} (Session ${Math.max(...sessionNumbers) + 1})`;
  };

  const handleGenerate = async () => {
    if (sourceType === "new" && (!courseTitle.trim() || !selectedFile)) {
      toast.error("Veuillez remplir le titre et sélectionner un fichier.");
      return;
    }
    if (sourceType === "existing" && !selectedCourseId) {
      toast.error("Veuillez sélectionner un cours existant.");
      return;
    }
    if (!user) return;

    setIsGenerating(true);
    uiAudio.playSuccessChime();
    const toastId = toast.loading("L'Agent MOR prépare la session...");

    try {
      let courseContent: string;
      let finalCourseTitle: string;
      let finalCourseId: string;

      if (sourceType === "existing" && selectedCourseId) {
        const selectedCourse = existingCourses.find(c => c.id === selectedCourseId);
        if (!selectedCourse) throw new Error("Cours introuvable");
        courseContent = selectedCourse.content;
        finalCourseTitle = selectedCourse.title;
        finalCourseId = selectedCourse.id;
      } else {
        toast.loading("Analyse du fichier...", { id: toastId });
        const fileResult = await readFile(selectedFile!);
        if (!fileResult.success || !fileResult.content) throw new Error(fileResult.error || "Impossible de lire le fichier");

        courseContent = fileResult.content;
        toast.loading("Vérification des doublons...", { id: toastId });
        finalCourseTitle = await getUniqueSessionTitle(courseTitle, user.id);

        toast.loading("Sauvegarde du cours...", { id: toastId });
        const { data: courseData, error: courseError } = await supabase.from("courses").insert({ user_id: user.id, title: finalCourseTitle, content: courseContent, file_name: selectedFile!.name }).select().single();
        if (courseError) throw courseError;
        finalCourseId = courseData.id;
      }

      if (questionCount === "infini") {
        toast.success("Lancement de la session interactive ♾️", { id: toastId });
        navigate(`/quiz-infini/${finalCourseId}?type=${quizType}&difficulty=${difficulty}`);
        return;
      }

      toast.loading("Génération des QCM avec l'IA (Lovable)...", { id: toastId });
      const generatedQuestions = await generateQuizWithLovable(courseContent, parseInt(questionCount), quizType, difficulty);

      const validQuestions = generatedQuestions.filter((q: any) => q.question && Array.isArray(q.choices) && q.choices.length >= 2 && Array.isArray(q.correct) && q.correct.length > 0);
      if (validQuestions.length === 0) throw new Error("Aucune question valide générée");

      toast.loading("Sauvegarde de la session...", { id: toastId });
      const { data: sessionData, error: sessionError } = await supabase.from("qcm_sessions").insert({
        user_id: user.id, course_id: finalCourseId, title: finalCourseTitle, questions: validQuestions, status: "completed",
        question_count: validQuestions.length, question_type: quizType, ai_model: "MED 2 (Gemini Flash)",
        metadata: { originalQuestionCount: parseInt(questionCount), generatedAt: new Date().toISOString(), difficulty: difficulty },
      }).select().single();

      if (sessionError) throw sessionError;

      toast.success(`Épreuve générée avec succès ! (${validQuestions.length} QCM)`, { id: toastId });
      navigate(`/quiz/${sessionData.id}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur inconnue", { id: toastId });
    } finally { 
      setIsGenerating(false); 
    }
  };

  // --- Dictionnaires de l'UI ---
  const difficultyConfig = {
    facile: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500", shadow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
    intermediaire: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500", shadow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
    difficile: { color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500", shadow: "shadow-[0_0_20px_rgba(225,29,72,0.15)]" },
  };

  const infoMessage = quizType === "classique" 
    ? "Classique : 5 propositions (A-E), 1 à 5 bonnes réponses possibles."
    : quizType === "groupage"
    ? "Groupage : Barème spécifique (A=123, B=13, C=24, D=4, E=Autre)."
    : "Élection : Une seule proposition est strictement exacte.";

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans pt-8 pb-32 relative overflow-hidden transition-colors duration-500">
      
      {/* Halo d'ambiance en arrière-plan */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#5B21B6]/10 dark:bg-[#5B21B6]/20 blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="max-w-[1400px] mx-auto px-6 space-y-10 relative z-10">
        
        <AnimatedBanner 
          title="Configuration du QCM."
          subtitle="Paramétrez l'intelligence artificielle pour concevoir votre épreuve clinique."
        />

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* ==========================================
              COLONNE 1 : SOURCE
              ========================================== */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="lg:col-span-6 bg-white/80 dark:bg-[#111111]/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col h-full relative overflow-hidden group"
          >
            <div className="absolute -top-10 -right-10 opacity-[0.03] dark:opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <FileText className="w-64 h-64 text-[#111111] dark:text-white" />
            </div>

            <div className="relative z-10 flex flex-col h-full space-y-10">
              
              <div className="flex bg-[#FAFAF8] dark:bg-[#1A1A18] p-1.5 rounded-[1.5rem] border border-black/5 dark:border-white/5 relative">
                <button onClick={() => setSourceType("new")} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-colors relative z-10 flex items-center justify-center gap-2 ${sourceType === "new" ? "text-[#111111] dark:text-black" : "text-[#888888] hover:text-[#111111] dark:hover:text-white"}`}>
                  <UploadCloud className="h-4 w-4" /> Nouveau Fichier
                </button>
                <button onClick={() => setSourceType("existing")} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-colors relative z-10 flex items-center justify-center gap-2 ${sourceType === "existing" ? "text-[#111111] dark:text-black" : "text-[#888888] hover:text-[#111111] dark:hover:text-white"}`}>
                  <Layers className="h-4 w-4" /> Cours Existant
                </button>
                <motion.div layoutId="source-tab-qcm" className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-white rounded-xl shadow-sm border border-black/5 dark:border-transparent z-0" animate={{ left: sourceType === "new" ? "6px" : "calc(50% + 0px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2">Titre du cours</label>
                <input type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="Ex: Anatomie cardiovasculaire..." className="w-full bg-transparent border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/40 rounded-[1.5rem] px-6 py-5 text-sm font-bold text-[#111111] dark:text-white placeholder:text-[#888888]/50 shadow-inner outline-none transition-all focus:ring-4 ring-[#5B21B6]/5" />
              </div>

              <AnimatePresence mode="wait">
                {sourceType === "new" ? (
                  <motion.div key="file" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-grow flex flex-col space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Document de cours</label>
                    <div 
                      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                      className={`flex-grow min-h-[220px] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${isDragging ? "border-[#5B21B6] bg-[#5B21B6]/5" : selectedFile ? "border-emerald-500/50 bg-emerald-500/5 shadow-inner" : "border-black/10 dark:border-white/10 hover:border-[#5B21B6]/40 bg-[#FAFAF8] dark:bg-[#1A1A18]/50"}`}
                    >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.txt" />
                      {selectedFile ? (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center px-6">
                          <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 shadow-inner"><CheckCircle2 className="h-8 w-8" /></div>
                          <p className="text-sm font-bold text-[#111111] dark:text-white max-w-[280px] truncate">{selectedFile.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">Prêt pour l'analyse</p>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center text-center px-6">
                          <div className="h-14 w-14 rounded-full bg-white dark:bg-[#111111] shadow-sm border border-black/5 dark:border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300"><FileUp className="h-6 w-6 text-[#888888] group-hover:text-[#5B21B6] transition-colors" /></div>
                          <p className="text-sm font-bold text-[#111111] dark:text-white">Appuyez pour sélectionner</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">PDF, DOCX ou TXT</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="existing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-grow flex flex-col space-y-3">
                     <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Sélectionner un cours</label>
                     <div className="relative">
                        <select 
                          value={selectedCourseId || ""} 
                          onChange={(e) => setSelectedCourseId(e.target.value)} 
                          className="w-full appearance-none bg-transparent border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/40 rounded-[1.5rem] px-6 py-5 text-sm font-bold text-[#111111] dark:text-white shadow-inner outline-none transition-all focus:ring-4 ring-[#5B21B6]/5 cursor-pointer"
                        >
                          <option value="">Choisissez dans votre bibliothèque...</option>
                          {existingCourses.map(course => (
                            <option key={course.id} value={course.id}>{course.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-[#888888] pointer-events-none" />
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ==========================================
              COLONNE 2 : LE MOTEUR IA
              ========================================== */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-6 bg-white/80 dark:bg-[#111111]/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col h-full"
          >
            <div className="space-y-10 flex-grow">
              
              {/* RESTAURATION DES TEXTES DE DIFFICULTÉ ET DES COULEURS */}
              <div className="space-y-4">
                <div className="flex justify-between items-end ml-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white block">Niveau de difficulté</label>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1 rounded-full flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> IA recommande : Facile</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: "facile", title: "Niveau 1 - Facile", desc: "Questions directes basées sur le cours.", color: "emerald" },
                    { id: "intermediaire", title: "Niveau 2 - Intermédiaire", desc: "Reformulation intelligente. 1-5 bonnes réponses.", color: "amber" },
                    { id: "difficile", title: "Niveau 3 - Difficile", desc: "Raisonnement clinique + connaissances externes.", color: "rose" }
                  ].map((lvl) => {
                    const isActive = difficulty === lvl.id;
                    const borderColor = isActive ? lvl.color === "emerald" ? "border-emerald-500" : lvl.color === "amber" ? "border-amber-500" : "border-rose-500" : "border-black/5 dark:border-white/5";
                    const bgColor = isActive ? lvl.color === "emerald" ? "bg-emerald-500/5" : lvl.color === "amber" ? "bg-amber-500/5" : "bg-rose-500/5" : "bg-[#FAFAF8] dark:bg-[#1A1A18]";
                    const iconColor = isActive ? lvl.color === "emerald" ? "text-emerald-500" : lvl.color === "amber" ? "text-amber-500" : "text-rose-500" : "text-[#888888]";

                    return (
                      <motion.button key={lvl.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setDifficulty(lvl.id as any)} className={`text-left p-5 rounded-2xl border-2 transition-all duration-300 outline-none flex items-start gap-4 ${borderColor} ${bgColor}`}>
                        <div className={`mt-0.5 p-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-black/5 dark:border-white/5 shadow-sm`}><BookOpen className={`h-4 w-4 ${iconColor}`} /></div>
                        <div>
                          <h4 className="text-sm font-bold text-[#111111] dark:text-white mb-1">{lvl.title}</h4>
                          <p className="text-[11px] text-[#666666] dark:text-[#8E8E8A] leading-relaxed">{lvl.desc}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* SÉLECTEURS TECHNIQUES (Type, Volume, Modèle) */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Type</label>
                  <div className="relative">
                    <select value={quizType} onChange={(e) => setQuizType(e.target.value)} className="w-full appearance-none bg-[#FAFAF8] dark:bg-[#1A1A18] border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/50 rounded-2xl pl-4 pr-10 py-4 text-xs font-bold text-[#111111] dark:text-white shadow-inner transition-all outline-none cursor-pointer">
                      <option value="classique">Classique (A-E)</option>
                      <option value="groupage">Groupage</option>
                      <option value="election">Élection</option>
                      <option value="censure">Censure</option>
                      <option value="cas-cliniques">Cas Cliniques</option>
                      <option value="vrai-faux">Vrai/Faux</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888] pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Questions</label>
                  <div className="relative">
                    <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="w-full appearance-none bg-[#FAFAF8] dark:bg-[#1A1A18] border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/50 rounded-2xl pl-4 pr-10 py-4 text-xs font-bold text-[#111111] dark:text-white shadow-inner transition-all outline-none cursor-pointer">
                      <option value="5">5 questions</option>
                      <option value="10">10 questions</option>
                      <option value="15">15 questions</option>
                      <option value="20">20 questions</option>
                      <option value="30">30 questions</option>
                      <option value="50">50 questions</option>
                      <option value="infini">♾️ Infini</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888] pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Modèle IA</label>
                  <div className="relative">
                    <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="w-full appearance-none bg-[#FAFAF8] dark:bg-[#1A1A18] border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/50 rounded-2xl pl-4 pr-10 py-4 text-xs font-bold text-[#111111] dark:text-white shadow-inner transition-all outline-none cursor-pointer">
                      <option value="med2">MED-2</option>
                      <option value="gpt4">GPT-4</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Boîte d'info (Ton texte existant conservé) */}
              <div className="p-4 bg-[#FAFAF8] dark:bg-[#1A1A18] border border-black/5 dark:border-white/5 rounded-2xl">
                <p className="text-[11px] font-medium text-[#666666] dark:text-[#8E8E8A] leading-relaxed">
                  <strong className="font-bold text-[#111111] dark:text-white">Info :</strong> {infoMessage}
                </p>
              </div>
            </div>

            {/* ACTION FINALE */}
            <div className="pt-8 mt-4 border-t border-black/5 dark:border-white/5">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full bg-[#111111] dark:bg-white p-6 rounded-[2rem] shadow-xl text-white dark:text-[#111111] relative overflow-hidden">
                    <div className="absolute top-0 bottom-0 w-full bg-gradient-to-b from-transparent via-[#5B21B6]/50 to-transparent opacity-50 animate-[scan_2s_ease-in-out_infinite]" />
                    <style dangerouslySetInnerHTML={{__html: `@keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }`}} />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                      <Brain className="h-8 w-8 text-[#5B21B6] animate-pulse" />
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest">Création de l'Épreuve...</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleGenerate}
                    className="w-full h-16 rounded-[2rem] bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.2)] transition-all relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 dark:via-black/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                    <Sparkles className="h-4 w-4 text-[#5B21B6]" />
                    <span className="relative z-10">Créer le QCM ({questionCount} Q)</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AddCourse;
