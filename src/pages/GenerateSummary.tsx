import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  UploadCloud, FileText, Brain, Sparkles, BookOpen, 
  Zap, Layers, ChevronDown, CheckCircle2, FileUp, Shield, Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { useUserRole } from "@/hooks/useUserRole";
import { invokeWithRetry } from "@/lib/edgeRetry";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { motion, AnimatePresence } from "framer-motion";
import { uiAudio } from "@/utils/audio";
import { toast as sonnerToast } from "sonner";
import { UpgradePrompt } from "@/components/UpgradePrompt";

type SummaryType = "concise" | "structured" | "complete";

interface ExistingCourse { id: string; title: string; content: string; file_name: string | null; created_at: string; }

const SUMMARY_PLAN_REQUIREMENTS: Record<SummaryType, "gratuit" | "premium"> = {
  concise: "gratuit", structured: "premium", complete: "premium",
};

const GenerateSummary = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();
  const { isAdmin, hasAccess } = useUserRole();

  // --- États du Formulaire ---
  const [sourceType, setSourceType] = useState<"new" | "existing">("new");
  const [courseTitle, setCourseTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>("concise");
  const [summaryTemplate, setSummaryTemplate] = useState<"standard" | "objectives">("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // --- Logique d'initialisation ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Connexion requise", variant: "destructive" }); navigate("/auth"); return; }
      setUser(user);
    };
    checkUser();
  }, [navigate, toast]);

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

  const canAccessType = (type: SummaryType): boolean => {
    if (isAdmin) return true;
    if (SUMMARY_PLAN_REQUIREMENTS[type] === "gratuit") return true;
    return hasAccess("premium");
  };

  const handleTypeChange = (type: SummaryType) => {
    if (!canAccessType(type)) { setShowUpgradePrompt(true); return; }
    setSummaryType(type);
    uiAudio.playSoftClick();
  };

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
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
      uiAudio.playSoftClick();
      if (!courseTitle) setCourseTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else {
      sonnerToast.error("Format de fichier non supporté. Veuillez uploader un PDF, DOCX, PPT ou TXT.");
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
      sonnerToast.error("Veuillez remplir le titre et sélectionner un fichier.");
      return;
    }
    if (sourceType === "existing" && !selectedCourseId) {
      sonnerToast.error("Veuillez sélectionner un cours existant.");
      return;
    }
    if (!user) return;

    setIsGenerating(true);
    uiAudio.playSuccessChime();
    const toastId = sonnerToast.loading("L'Agent MOR prépare la génération...");

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
        sonnerToast.loading("Analyse du fichier...", { id: toastId });
        const fileResult = await readFile(selectedFile!);
        if (!fileResult.success || !fileResult.content) throw new Error(fileResult.error || "Impossible de lire le fichier");

        courseContent = fileResult.content;
        sonnerToast.loading("Sauvegarde du cours...", { id: toastId });
        finalCourseTitle = await getUniqueSessionTitle(courseTitle, user.id);

        const { data: courseData, error: courseError } = await supabase.from("courses").insert({ user_id: user.id, title: finalCourseTitle, content: courseContent, file_name: selectedFile!.name }).select().single();
        if (courseError) throw courseError;
        finalCourseId = courseData.id;
      }

      sonnerToast.loading("Génération du résumé avec l'IA...", { id: toastId });
      
      let contentToSend = courseContent;
      if (summaryTemplate === "objectives") {
        contentToSend = `[CONSIGNE IMPÉRATIVE POUR L'IA - FORMAT PAR OBJECTIFS] :
RÉDIGE CE RÉSUMÉ EN SUIVANT STRICTEMENT LES OBJECTIFS PÉDAGOGIQUES DU COURS.
Interdiction formelle de suivre la structure clinique classique (Définition, Physiopathologie, Tableau clinique, Diagnostic, Traitement).
À la place, structure l'ensemble de ton résumé en sections majeures basées exclusivement sur les objectifs d'apprentissage réels du cours (ou à défaut, sur 3 à 5 objectifs majeurs de compétences d'examen que tu auras déduits si aucun n'est écrit).

Chaque section d'objectif doit être formatée de la manière suivante pour notre parseur visuel :
=== Objectif [Numéro] : [Titre ou thème de l'objectif] ===
• Point clé ou notion principale à retenir pour cet objectif
- Détail secondaire ou sous-point important
✓ Conduite à tenir ou règle clinique cruciale associée
→ Conséquence ou lien clinique

Ne mets aucun titre avec des dièses (#). Utilise strictement la structure des objectifs '=== Objectif ... ===' pour chaque section.

Voici le contenu du cours à résumer en suivant cette structure :
${courseContent}`;
      }

      const { data, error } = await invokeWithRetry<{ summary: string }>("generate-summary", {
        body: { content: contentToSend, type: summaryType, title: finalCourseTitle, template: summaryTemplate },
        retries: 2,
        onRetry: (attempt, status) => {
          sonnerToast.loading(`Service IA temporairement indisponible (${status ?? "?"}) — tentative ${attempt}/2...`, { id: toastId });
        },
      });
      
      if (error) throw new Error(error.message);
      if (!data?.summary) throw new Error("Aucune réponse de l'IA. Réessayez.");

      sonnerToast.loading("Sauvegarde du résumé...", { id: toastId });
      const { data: summaryData, error: summaryError } = await supabase
        .from("summaries" as any)
        .insert({ 
          user_id: user.id, course_id: finalCourseId, title: finalCourseTitle, content: data.summary, summary_type: summaryType,
          metadata: { generatedAt: new Date().toISOString(), contentLength: courseContent.length, template: summaryTemplate },
        }).select().single();
      
      if (summaryError) throw summaryError;

      sonnerToast.success(`Résumé généré avec succès !`, { id: toastId });
      navigate(`/summary/${(summaryData as any).id}`);
    } catch (error) {
      console.error("Error:", error);
      sonnerToast.error(error instanceof Error ? error.message : "Erreur inconnue", { id: toastId });
    } finally { 
      setIsGenerating(false); 
    }
  };

  // --- Dictionnaires de l'UI ---
  const summaryTypeConfig = [
    { id: "concise", title: "Résumé Court", desc: "Fiche rapide — résumé ultra concis pour retenir l'essentiel.", color: "emerald", icon: Zap, details: ["Points clés", "Listes à puces"] },
    { id: "structured", title: "Résumé Structuré", desc: "Version équilibrée — clair, organisé, essentiel.", color: "amber", icon: FileText, details: ["Titres", "Points essentiels"] },
    { id: "complete", title: "Résumé Complet", desc: "Version détaillée — idéal pour revoir le cours en profondeur.", color: "rose", icon: BookOpen, details: ["Détaillé", "Physiopathologie"] }
  ];

  const infoMessage = summaryType === "concise" 
    ? "Résumé Court : Idéal pour des révisions de dernière minute, va droit à l'essentiel."
    : summaryType === "structured"
    ? "Résumé Structuré : L'équilibre parfait entre profondeur et lisibilité. Recommandé."
    : "Résumé Complet : Restitue la quasi-totalité du cours sous une forme plus digeste.";

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans pt-8 pb-32 relative overflow-hidden transition-colors duration-500">
      
      <UpgradePrompt isOpen={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} requiredPlan="premium" featureName="Résumés complets et structurés" />
      
      {/* Halo d'ambiance en arrière-plan */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#5B21B6]/10 dark:bg-[#5B21B6]/20 blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="max-w-[1400px] mx-auto px-6 space-y-10 relative z-10">
        
        <AnimatedBanner 
          title="Génération de Résumé."
          subtitle="Transformez vos cours en fiches intelligentes avec l'Agent MOR."
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
                <motion.div layoutId="source-tab-summary" className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-white rounded-xl shadow-sm border border-black/5 dark:border-transparent z-0" animate={{ left: sourceType === "new" ? "6px" : "calc(50% + 0px)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2">Titre du résumé</label>
                <input type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="Ex: Cardiologie - Insuffisance cardiaque" className="w-full bg-transparent border border-black/5 dark:border-white/5 focus:border-[#5B21B6]/40 rounded-[1.5rem] px-6 py-5 text-sm font-bold text-[#111111] dark:text-white placeholder:text-[#888888]/50 shadow-inner outline-none transition-all focus:ring-4 ring-[#5B21B6]/5" />
              </div>

              <AnimatePresence mode="wait">
                {sourceType === "new" ? (
                  <motion.div key="file" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-grow flex flex-col space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Document de cours</label>
                    <div 
                      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                      className={`flex-grow min-h-[220px] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${isDragging ? "border-[#5B21B6] bg-[#5B21B6]/5" : selectedFile ? "border-emerald-500/50 bg-emerald-500/5 shadow-inner" : "border-black/10 dark:border-white/10 hover:border-[#5B21B6]/40 bg-[#FAFAF8] dark:bg-[#1A1A18]/50"}`}
                    >
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx" />
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">PDF, DOCX, PPT ou TXT</p>
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
                          onChange={(e) => {
                            setSelectedCourseId(e.target.value);
                            const selectedCourse = existingCourses.find(c => c.id === e.target.value);
                            if (selectedCourse && !courseTitle.trim()) setCourseTitle(selectedCourse.title);
                          }} 
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
              
              {/* Type de Résumé (Mapping sur les couleurs AddCourse) */}
              <div className="space-y-4">
                <div className="flex justify-between items-end ml-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white block">Type de résumé</label>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1 rounded-full flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Recommandé : Structuré</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {summaryTypeConfig.map((lvl) => {
                    const isActive = summaryType === lvl.id;
                    const isLocked = !canAccessType(lvl.id as SummaryType);
                    const borderColor = isActive ? lvl.color === "emerald" ? "border-emerald-500" : lvl.color === "amber" ? "border-amber-500" : "border-rose-500" : "border-black/5 dark:border-white/5";
                    const bgColor = isActive ? lvl.color === "emerald" ? "bg-emerald-500/5" : lvl.color === "amber" ? "bg-amber-500/5" : "bg-rose-500/5" : "bg-[#FAFAF8] dark:bg-[#1A1A18]";
                    const iconColor = isActive ? lvl.color === "emerald" ? "text-emerald-500" : lvl.color === "amber" ? "text-amber-500" : "text-rose-500" : "text-[#888888]";
                    const Icon = lvl.icon;

                    return (
                      <motion.button 
                        key={lvl.id} 
                        whileHover={!isLocked ? { scale: 1.01 } : {}} 
                        whileTap={!isLocked ? { scale: 0.98 } : {}} 
                        onClick={() => handleTypeChange(lvl.id as SummaryType)} 
                        className={`text-left p-5 rounded-2xl border-2 transition-all duration-300 outline-none flex items-start gap-4 ${borderColor} ${bgColor} ${isLocked ? "opacity-80" : ""}`}
                      >
                        <div className={`mt-0.5 p-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-black/5 dark:border-white/5 shadow-sm`}><Icon className={`h-4 w-4 ${iconColor}`} /></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-[#111111] dark:text-white">{lvl.title}</h4>
                            {isLocked && <Shield className="h-3 w-3 text-amber-500" />}
                          </div>
                          <p className="text-[11px] text-[#666666] dark:text-[#8E8E8A] leading-relaxed">{lvl.desc}</p>
                          <div className="flex gap-2 mt-2">
                            {lvl.details.map((detail, i) => (
                              <span key={i} className="text-[9px] font-black uppercase tracking-widest text-[#888888] border border-black/5 dark:border-white/10 px-2 py-0.5 rounded-md">{detail}</span>
                            ))}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* SÉLECTEURS TECHNIQUES (Modèle) */}
              <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white ml-2 block">Schéma de génération</label>
                  <div className="grid sm:grid-cols-2 gap-4">
                      {/* Standard template */}
                      <button
                        type="button"
                        onClick={() => { setSummaryTemplate("standard"); uiAudio.playSoftClick(); }}
                        className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between h-32 transition-all duration-300 relative ${
                          summaryTemplate === "standard"
                            ? "border-[#5B21B6] bg-[#5B21B6]/5 text-[#5B21B6]"
                            : "border-black/5 dark:border-white/5 bg-[#FAFAF8] dark:bg-[#1A1A18] text-[#111111] dark:text-[#F4F4F2]"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className={`p-2 rounded-xl ${summaryTemplate === "standard" ? "bg-[#5B21B6]/15 text-[#5B21B6]" : "bg-white dark:bg-[#0A0A0A] text-[#888888] shadow-sm border border-black/5 dark:border-white/5"}`}>
                            <Sparkles className="h-4 w-4" />
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider mb-1">Standard</p>
                          <p className="text-[10px] text-[#666666] dark:text-[#8E8E8A]">Structure clinique classique (Déf, Clinique, TTT...)</p>
                        </div>
                      </button>

                      {/* Objectives template */}
                      <button
                        type="button"
                        onClick={() => { setSummaryTemplate("objectives"); uiAudio.playSoftClick(); }}
                        className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between h-32 transition-all duration-300 relative ${
                          summaryTemplate === "objectives"
                            ? "border-[#5B21B6] bg-[#5B21B6]/5 text-[#5B21B6]"
                            : "border-black/5 dark:border-white/5 bg-[#FAFAF8] dark:bg-[#1A1A18] text-[#111111] dark:text-[#F4F4F2]"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className={`p-2 rounded-xl ${summaryTemplate === "objectives" ? "bg-[#5B21B6]/15 text-[#5B21B6]" : "bg-white dark:bg-[#0A0A0A] text-[#888888] shadow-sm border border-black/5 dark:border-white/5"}`}>
                            <Award className="h-4 w-4" />
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider mb-1">Par Objectifs</p>
                          <p className="text-[10px] text-[#666666] dark:text-[#8E8E8A]">Répond strictement aux objectifs pédagogiques</p>
                        </div>
                      </button>
                  </div>
              </div>

              {/* Boîte d'info */}
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
                        <p className="text-xs font-black uppercase tracking-widest">Création du résumé...</p>
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
                    <span className="relative z-10">Générer le Résumé</span>
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

export default GenerateSummary;
