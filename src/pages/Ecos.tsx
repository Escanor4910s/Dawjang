import { useState, useEffect, useRef } from "react";
import { getErrorMessage } from "@/lib/errorUtils";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { 
  Activity, FileText, CheckCircle, ArrowRight, RotateCcw, 
  Award, Heart, Sparkles, Search, Dices, BookOpen, Timer, 
  FileUp, Loader2, History, Target 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedDb";
import { toast } from "sonner";
import { uiAudio } from "@/utils/audio";
import { cn } from "@/lib/utils";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EcgMonitor } from "@/components/ecos/EcgMonitor"; 
import { ShareResults } from "@/components/ShareResults";
import { useFileReader } from "@/hooks/useFileReader";
import { generateEcosCaseWithLovable } from "@/lib/lovableAiService";

export interface EcosSessionRecord {
  id: string;
  case_id?: string;
  case_title?: string;
  score: number;
  status?: string;
  created_at: string;
  history?: {
    max_score?: number;
    specialty?: string;
    steps_count?: number;
    completed_at?: string;
    feedback?: string;
  };
}

// --- Interfaces Cliniques ---
export interface EcosQuestion {
  id: number;
  text: string;
  type: "qcm" | "prescription";
  options?: string[];
  correct: number | string;
  dangerous: number | null;
  timeCost: number; // Temps virtuel pris par l'action (en minutes)
  explanation: string;
  morFeedback: string;
  effect: { bpm: number; spo2: number; bp: string; status: "stable" | "unstable" | "critical"; };
  nextStepId?: number; // Pour l'arborescence (si undefined, passe à l'index suivant)
}

export interface EcosCase {
  id: number | string;
  title: string;
  specialty: string;
  level: string;
  scenario: string;
  initialState: { bpm: number; spo2: number; bloodPressure: string; temperature: number; isStable: boolean; status: "stable" | "unstable" | "critical"; };
  questions: EcosQuestion[];
}

// Générateur clinique intelligent pour les cours déposés ou leçons sélectionnées
function generateEcosCaseFromCourse(
  title: string,
  content: string,
  difficulty: "facile" | "moyen" | "difficile"
): EcosCase {
  const cleanTitle = title.trim() || "Urgence Médicale Aiguë";
  const lines = content
    .split(/[.\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && !s.startsWith("http"));

  const leadStatement =
    lines[0] || "Prise en charge d'un patient instable en unité d'accueil des urgences.";
  const keyAction =
    lines[1] || "Mise en condition hémodynamique et monitorage cardiorespiratoire continu.";
  const therapy =
    lines[2] || "Administration du traitement étiologique de première ligne selon les recommandations R2C.";

  return {
    id: `ecos-${Date.now()}`,
    title: cleanTitle,
    specialty: "Urgences & Réanimation",
    level:
      difficulty === "difficile"
        ? "Interne EDN"
        : difficulty === "moyen"
        ? "DFASM3 / ECNi"
        : "DFASM1-2",
    scenario: `Patient admis au déchocage pour un tableau clinique aigu en lien avec : ${cleanTitle}. Constat initial : ${leadStatement}. La situation nécessite une prise en charge protocolisée immédiate.`,
    initialState: {
      bpm: 112,
      spo2: 92,
      bloodPressure: "135/88",
      temperature: 37.8,
      isStable: false,
      status: "unstable",
    },
    questions: [
      {
        id: 1,
        text: `Face à ce tableau clinique (${cleanTitle}), quelle est votre hypothèse diagnostique principale de rang A ?`,
        type: "qcm",
        options: [
          cleanTitle,
          "Décompensation fonctionnelle sans critère de gravité immédiate",
          "Origine psychogène avec syndrome d'hyperventilation isolé",
          "Tableau atypique justifiant une abstention sous simple surveillance",
        ],
        correct: 0,
        dangerous: 3,
        timeCost: 2,
        explanation: `La présentation clinique oriente en priorité vers : ${cleanTitle}. Priorité de rang A pour éviter tout retard diagnostique.`,
        morFeedback: "Diagnostic exact posé sans délai. Vous orientez la démarche dans la bonne voie.",
        effect: { bpm: 104, spo2: 94, bp: "130/84", status: "unstable" },
      },
      {
        id: 2,
        text: "Quel examen complémentaire de première intention réalisez-vous immédiatement au lit du patient ?",
        type: "qcm",
        options: [
          "Électrocardiogramme (ECG 18D) et monitorage continu",
          "Scanner corps entier injecté d'emblée",
          "Ponction lombaire exploratrice immédiate",
          "Biologie spécialisée différée à 24 heures",
        ],
        correct: 0,
        dangerous: 3,
        timeCost: 4,
        explanation:
          "L'évaluation paraclinique immédiate au lit du malade (ECG, scopage, glycémie capillaire) prime avant toute imagerie lourde.",
        morFeedback:
          "Réflexe clinique parfait : la sécurité et le scopage du patient avant tout transfert.",
        effect: { bpm: 98, spo2: 96, bp: "128/80", status: "stable" },
      },
      {
        id: 3,
        text: "Rédigez ou confirmez la mesure thérapeutique prioritaire à engager immédiatement :",
        type: "prescription",
        correct: "oxygene",
        dangerous: null,
        timeCost: 3,
        explanation: `Mesure thérapeutique clé : ${therapy}. Abord veineux, oxygénothérapie ciblée et traitement spécifique selon la R2C.`,
        morFeedback:
          "Excellente prescription d'urgence. Le patient se stabilise sous votre surveillance.",
        effect: { bpm: 82, spo2: 98, bp: "120/78", status: "stable" },
      },
    ],
  };
}

export const EcosPage = () => {
  const { readFile, isReading } = useFileReader();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- États ---
  const [userCases, setUserCases] = useState<EcosCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<EcosCase | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [patientState, setPatientState] = useState<EcosCase["initialState"] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [morComment, setMorComment] = useState<string>("");
  const [morStatus, setMorStatus] = useState<"normal" | "warning" | "success">("normal");
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [prescriptionText, setPrescriptionText] = useState("");
  
  // --- Options & Modes ---
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [isUrgencyMode, setIsUrgencyMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // --- Constructeur IA & Déposer un cours ---
  const [difficulty, setDifficulty] = useState<"facile" | "moyen" | "difficile">("moyen");
  const [generationMode, setGenerationMode] = useState<"file" | "uploaded" | "search" | "random">("file");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedText, setUploadedText] = useState("");
  const [uploadedTitle, setUploadedTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [userLessons, setUserLessons] = useState<{ id: string; title: string; content?: string }[]>([]);
  const [activeTab, setActiveTab] = useState("new");
  const [pastSessions, setPastSessions] = useState<EcosSessionRecord[]>([]);

  // Chargement des cas et de l'historique utilisateur depuis Supabase
  useEffect(() => {
    fetchHistory();
    fetchLessons();
    fetchUserSavedCases();
  }, []);

  const fetchUserSavedCases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const saved = localStorage.getItem(`hippocampus_ecos_cases_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setUserCases(parsed.filter((c: EcosCase) => c && c.id !== 1 && c.id !== "mock-1"));
        }
      }
    } catch (err) {
      console.warn("Erreur chargement cas ECOS sauvegardés:", err);
    }
  };

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await untypedTable("ecos_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setPastSessions(data as EcosSessionRecord[]);
    }
  };

  const fetchLessons = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
      const [coursesRes, summariesRes] = await Promise.all([
        supabase.from("courses").select("id, title, content").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("summaries").select("id, title, content").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      const lessons: { id: string; title: string; content?: string }[] = [];
      if (coursesRes.data) {
        coursesRes.data.forEach((c) =>
          lessons.push({ id: c.id, title: `[Cours] ${c.title}`, content: c.content || "" })
        );
      }
      if (summariesRes.data) {
        summariesRes.data.forEach((s) =>
          lessons.push({ id: s.id, title: `[Fiche] ${s.title}`, content: s.content || "" })
        );
      }
      setUserLessons(lessons);
    } catch (err) {
      console.warn("Erreur chargement leçons ECOS:", err);
    }
  };

  // Traitement d'un document déposé (Word, PDF, PPTX, TXT...)
  const handleFileDropSelected = async (file: File) => {
    setUploadedFile(file);
    uiAudio.playSoftClick();
    const result = await readFile(file);
    if (!result.success || !result.content) {
      toast.error(result.error || "Impossible d'extraire le document");
      return;
    }
    setUploadedText(result.content);
    setUploadedTitle(file.name.replace(/\.[^/.]+$/, ""));
    toast.success(`« ${file.name} » extrait avec succès (${result.content.split(/\s+/).filter(Boolean).length} mots)`);
  };

  // --- Logique du Timer d'Urgence ---
  useEffect(() => {
    if (selectedCase && !isFinished && isUrgencyMode && !hasAnswered) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAnswerSubmit(selectedCase.questions[currentStep].dangerous || 0); // Pénalité automatique
            toast.error("Temps écoulé ! Retard de soin critique.");
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCase, isFinished, isUrgencyMode, currentStep, hasAnswered]);

  // --- Actions ---
  const startCase = (c: EcosCase) => {
    setSelectedCase(c); 
    setPatientState({ ...c.initialState }); 
    setCurrentStep(0);
    setSelectedAnswer(null); 
    setHasAnswered(false); 
    setScore(0); 
    setIsFinished(false);
    setMorStatus("normal");
    setMorComment(`Dossier ouvert. Patient présentant un tableau de ${c.title}. Examinez les constantes initiales.`);
    setTimeLeft(60);
    setPrescriptionText("");
  };

  const generateEcosCase = async () => {
    let sourceTitle = "";
    let sourceContent = "";

    if (generationMode === "file") {
      if (!uploadedText.trim()) {
        toast.error("Veuillez déposer un document de cours avant de lancer la garde.");
        return;
      }
      sourceTitle = uploadedTitle || uploadedFile?.name.replace(/\.[^/.]+$/, "") || "Cas clinique";
      sourceContent = uploadedText;
    } else if (generationMode === "uploaded") {
      if (!selectedLesson) {
        toast.error("Veuillez sélectionner un cours ou une fiche dans votre bibliothèque.");
        return;
      }
      const lesson = userLessons.find((l) => l.id === selectedLesson);
      sourceTitle = lesson?.title.replace(/^\[(Cours|Fiche)\]\s*/, "") || "Cas clinique";
      sourceContent = lesson?.content || sourceTitle;
    } else if (generationMode === "search") {
      if (!searchQuery.trim()) {
        toast.error("Veuillez saisir un thème ou une situation d'urgence.");
        return;
      }
      sourceTitle = searchQuery.trim();
      sourceContent = searchQuery.trim();
    } else {
      const randomThemes = [
        "Choc anaphylactique per-anesthésique",
        "Insuffisance cardiaque aiguë décompensée",
        "Embolie pulmonaire grave avec défaillance droite",
        "Acidocétose diabétique inaugurale",
        "État de mal épileptique convulsif",
        "Sepsis sévère à point de départ urinaire",
      ];
      sourceTitle = randomThemes[Math.floor(Math.random() * randomThemes.length)];
      sourceContent = sourceTitle;
    }

    setIsGenerating(true); 
    setGenerationStep(1);

    try {
      setTimeout(() => setGenerationStep(2), 700);
      setTimeout(() => setGenerationStep(3), 1400);

      let newCase: EcosCase | null = null;
      if (generationMode === "uploaded" && selectedLesson) {
        try {
          const aiRes = await generateEcosCaseWithLovable(selectedLesson, difficulty, "uploaded");
          if (aiRes && aiRes.questions && aiRes.questions.length > 0) {
            newCase = aiRes;
          }
        } catch (e) {
          console.warn("Fallback local ECOS:", e);
        }
      }

      if (!newCase) {
        newCase = generateEcosCaseFromCourse(sourceTitle, sourceContent, difficulty);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user && newCase) {
        const updated = [newCase, ...userCases.filter((c) => c.id !== newCase!.id)];
        setUserCases(updated);
        localStorage.setItem(`hippocampus_ecos_cases_${user.id}`, JSON.stringify(updated));
      }

      setTimeout(() => {
        setIsGenerating(false); 
        setGenerationStep(0);
        if (newCase) {
          startCase(newCase);
          toast.success("Dossier clinique patient ouvert avec succès !");
        }
      }, 2000);
    } catch (err: unknown) {
      console.error(err);
      setIsGenerating(false);
      setGenerationStep(0);
      toast.error(getErrorMessage(err, "") || "Erreur de conception de la garde");
    }
  };

  const handleTextSubmit = (text: string) => {
    if (hasAnswered || !selectedCase || !patientState) return;
    
    setSelectedAnswer(text);
    setHasAnswered(true);

    const question = selectedCase?.questions?.[currentStep];
    const isCorrect = typeof question?.correct === 'string' && text && question.correct.toLowerCase().includes(String(text).toLowerCase());

    if (isCorrect) {
      setScore(prev => prev + 100); 
      setMorStatus("success");
      setMorComment(`Excellent raisonnement. ${question.morFeedback}`);
      setPatientState(prev => prev ? { ...prev, ...question.effect } : null);
    } else {
      setMorStatus("warning"); 
      setScore(prev => Math.max(0, prev - 40));
      setMorComment(`Erreur de prise en charge. ${question.morFeedback}`);
      setPatientState(prev => prev ? { ...prev, status: "critical", bpm: 135, spo2: 88 } : null);
    }
  };

  const handleAnswerSubmit = (optionIndex: number) => {
    if (hasAnswered || !selectedCase || !patientState) return;
    
    setSelectedAnswer(optionIndex); 
    setHasAnswered(true);
    
    const question = selectedCase.questions[currentStep];
    const isCorrect = optionIndex === question.correct;
    
    if (isCorrect) {
      setScore(prev => prev + 100); 
      setMorStatus("success");
      setMorComment(`Excellent raisonnement. ${question.morFeedback}`);
      setPatientState(prev => prev ? { ...prev, ...question.effect } : null);
    } else {
      setMorStatus("warning"); 
      setScore(prev => Math.max(0, prev - 40));
      setMorComment(`Erreur de prise en charge. ${question.morFeedback}`);
      setPatientState(prev => prev ? { ...prev, status: "critical", bpm: 135, spo2: 88 } : null);
    }
  };

  const handleNextStep = () => {
    if (!selectedCase) return;
    if (currentStep < selectedCase.questions.length - 1) {
      setCurrentStep(prev => prev + 1); 
      setSelectedAnswer(null); 
      setHasAnswered(false);
      setPrescriptionText("");
      setMorStatus("normal"); 
      setMorComment("La situation évolue. Adaptez votre stratégie.");
      setTimeLeft(60);
    } else {
      setIsFinished(true);
      const maxPossible = selectedCase.questions.length * 100;
      if (score >= selectedCase.questions.length * 75) confetti({ particleCount: 150, spread: 80, colors: ['#5B21B6', '#111111', '#ffffff'] });
      
      // Save session to Supabase
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          untypedTable("ecos_sessions").insert({
            user_id: user.id,
            case_id: selectedCase.id.toString(),
            case_title: selectedCase.title,
            score: score,
            status: "termine",
            history: {
              max_score: maxPossible,
              specialty: selectedCase.specialty,
              steps_count: selectedCase.questions.length,
              completed_at: new Date().toISOString(),
              feedback: "Évaluation clinique complétée avec succès.",
            },
          }).then(() => fetchHistory());
        }
      });
    }
  };

  // --- Animations ---
  const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans pt-4 pb-20 w-full transition-colors duration-300">
      
      {/* Scrollbar Éditoriale Invisible */}
      <style dangerouslySetInnerHTML={{__html: `
        .editorial-scrollbar::-webkit-scrollbar { width: 4px; }
        .editorial-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .editorial-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .editorial-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); }
      `}} />

      <div className="max-w-[1500px] mx-auto px-6 space-y-10">
        
        {/* L'En-tête Animé (S'adapte parfaitement au flex-row) */}
        <AnimatedBanner 
          title="Simulateur ECOS."
          subtitle="Entraînez-vous à la prise de décision clinique en temps réel, sous pression."
          rightWidgets={
            <div className="flex items-center gap-3">
              {/* Contrôle Urgence */}
              <button 
                onClick={() => setIsUrgencyMode(!isUrgencyMode)}
                className={`h-12 px-6 rounded-full backdrop-blur-md border transition-all duration-300 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2
                  ${isUrgencyMode 
                    ? "bg-red-500/20 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" 
                    : "bg-black/20 border-white/10 text-white hover:bg-white hover:text-black"
                  }
                `}
              >
                <Timer className="h-4 w-4" />
                <span className="hidden sm:inline">Mode 60s</span>
              </button>

              {/* Contrôle Quitter (Si cas en cours) */}
              {selectedCase && (
                <button 
                  onClick={() => setSelectedCase(null)}
                  className="h-12 w-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors border border-transparent"
                  title="Abandonner le cas"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          }
        />

        <AnimatePresence mode="wait">
          {!selectedCase ? (
            /* =========================================
               VUE 1 : LE CONCEPTEUR & LA BIBLIOTHÈQUE
               ========================================= */
            <motion.div key="menu" variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-12">
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-center mb-8">
                  <TabsList className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full p-1 h-auto">
                    <TabsTrigger value="new" className="rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-[#111111] data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black transition-all">
                      Nouvelle Garde
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-full px-6 py-3 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-[#111111] data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black transition-all">
                      Mes Gardes Passées
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="new" className="space-y-12 mt-0">
              {/* Concepteur IA (Bento Box) */}
              <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 md:p-14 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                  <Activity className="w-64 h-64" />
                </div>
                
                <div className="flex items-center gap-4 mb-12 pb-6 border-b border-black/5 dark:border-white/5 relative z-10">
                  <div className="h-14 w-14 rounded-2xl bg-transparent border border-black/5 dark:border-white/5 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-[#5B21B6]" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-light tracking-tight text-[#111111] dark:text-white">Concepteur IA</h2>
                    <p className="text-sm font-medium text-[#888888]">Paramétrez votre garde clinique.</p>
                  </div>
                </div>

                {isGenerating ? (
                  <div className="py-24 flex flex-col items-center justify-center space-y-8 relative z-10">
                    <Activity className="h-16 w-16 text-[#5B21B6] animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white">Création du dossier patient...</p>
                    <Progress value={generationStep * 33} className="w-72 h-1 bg-black/5 [&>div]:bg-[#5B21B6]" />
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-16 relative z-10">
                    {/* Colonne 1 : Paramètres statiques */}
                    <div className="space-y-10">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                           Niveau d'Exigence
                        </label>
                        <div className="flex gap-3">
                          {["Facile", "Moyen", "Difficile"].map((level) => (
                            <button key={level} onClick={() => setDifficulty(level.toLowerCase() as "facile" | "moyen" | "difficile")}
                              className={`flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${
                                difficulty === level.toLowerCase() ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111] border-[#111111] dark:border-white shadow-md" : "bg-transparent text-[#888888] border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/30 hover:text-[#111111] dark:hover:text-white"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                           Source des données
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { id: "file", icon: FileUp, label: "Déposer" },
                            { id: "uploaded", icon: BookOpen, label: "Mes Cours" },
                            { id: "search", icon: Search, label: "Recherche" },
                            { id: "random", icon: Dices, label: "Aléatoire" }
                          ].map((mode) => (
                            <button key={mode.id} onClick={() => setGenerationMode(mode.id as typeof generationMode)}
                              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                                generationMode === mode.id ? "bg-[#5B21B6] border-[#5B21B6] text-white shadow-md" : "bg-transparent border-black/5 dark:border-white/5 text-[#888888] hover:border-black/20 dark:hover:border-white/30 hover:text-[#111111] dark:hover:text-white"
                              }`}
                            >
                              <mode.icon className="h-5 w-5" />
                              <span className="text-[9px] font-bold uppercase tracking-widest">{mode.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Colonne 2 : Options dynamiques & Action */}
                    <div className="space-y-10 flex flex-col justify-between">
                      <div className="h-full flex flex-col">
                        <AnimatePresence mode="wait">
                          {generationMode === "file" && (
                            <motion.div
                              key="file"
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden space-y-3"
                            >
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] flex items-center gap-2">
                                Déposer un cours polycopié (Word, PDF, PPTX, TXT)
                              </label>
                              <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setIsDragging(false);
                                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    handleFileDropSelected(e.dataTransfer.files[0]);
                                  }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`min-h-[140px] rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                                  isDragging
                                    ? "border-[#5B21B6] bg-[#5B21B6]/5"
                                    : uploadedFile
                                    ? "border-emerald-500/50 bg-emerald-500/5"
                                    : "border-black/10 dark:border-white/10 hover:border-[#5B21B6]/40 bg-black/[0.02] dark:bg-white/[0.02]"
                                }`}
                              >
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf,.docx,.doc,.txt,.md,.markdown,.pptx,.ppt,.odt,.rtf"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleFileDropSelected(e.target.files[0]);
                                    }
                                  }}
                                  className="hidden"
                                />
                                {isReading ? (
                                  <div className="flex flex-col items-center text-center">
                                    <Loader2 className="h-7 w-7 text-[#5B21B6] animate-spin mb-2" />
                                    <p className="text-sm font-semibold text-[#111111] dark:text-white">Extraction du document…</p>
                                    <p className="text-[10px] text-[#888888]">Parsing Word / PDF / PPTX haute fidélité</p>
                                  </div>
                                ) : uploadedFile ? (
                                  <div className="flex flex-col items-center text-center">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mb-2">
                                      <CheckCircle className="h-5 w-5" />
                                    </div>
                                    <p className="text-sm font-bold text-[#111111] dark:text-white max-w-sm truncate">{uploadedFile.name}</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                      {uploadedText.split(/\s+/).filter(Boolean).length} mots extraits — Prêt pour la simulation
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center text-center">
                                    <div className="h-10 w-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-2 text-[#888888]">
                                      <FileUp className="h-5 w-5" />
                                    </div>
                                    <p className="text-sm font-semibold text-[#111111] dark:text-white">Glissez votre cours ou cliquez pour parcourir</p>
                                    <p className="text-[10px] text-[#888888] mt-1">Word (.docx, .doc), PDF, PPTX, ODT ou Texte supportés</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}

                          {generationMode === "uploaded" && (
                            <motion.div
                              key="uploaded"
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden"
                            >
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                                Choisir une leçon de votre bibliothèque
                              </label>
                              <select 
                                value={selectedLesson} 
                                onChange={(e) => setSelectedLesson(e.target.value)}
                                className="w-full bg-transparent dark:text-white border border-black/10 dark:border-white/10 focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] rounded-xl px-5 py-4 text-sm font-medium transition-all outline-none appearance-none"
                              >
                                <option value="" disabled>Sélectionnez un cours ou une fiche...</option>
                                {userLessons.length === 0 ? (
                                  <option value="" disabled>Aucune leçon dans votre bibliothèque</option>
                                ) : (
                                  userLessons.map(lesson => (
                                    <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                                  ))
                                )}
                              </select>
                            </motion.div>
                          )}
                          
                          {generationMode === "search" && (
                            <motion.div
                              key="search"
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden"
                            >
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                                Thème ou Pathologie d'urgence
                              </label>
                              <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888]" />
                                <input 
                                  type="text" 
                                  value={searchQuery} 
                                  onChange={(e) => setSearchQuery(e.target.value)} 
                                  placeholder="Ex: Choc anaphylactique, Défaillance aiguë..."
                                  className="w-full bg-transparent dark:text-white border border-black/10 dark:border-white/10 focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] rounded-xl pl-11 pr-5 py-4 text-sm font-medium transition-all outline-none"
                                />
                              </div>
                            </motion.div>
                          )}

                          {generationMode === "random" && (
                            <motion.div
                              key="random"
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden flex items-center justify-center h-full pt-4"
                            >
                              <div className="text-center">
                                <Dices className="h-8 w-8 text-[#5B21B6] mx-auto mb-3 opacity-50" />
                                <p className="text-sm font-medium text-[#888888]">
                                  L'Agent MOR va générer une situation d'urgence inédite pour tester vos réflexes.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <button onClick={generateEcosCase} className="w-full py-5 rounded-xl bg-[#111111] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3 shrink-0">
                        Ouvrir les portes des urgences <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Bibliothèque de Cas Personnels */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-6 flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Mes Stations Cliniques ECOS
                </h3>
                {userCases.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center space-y-3 bg-black/[0.01] dark:bg-white/[0.01]">
                    <div className="h-12 w-12 rounded-2xl bg-[#5B21B6]/10 text-[#5B21B6] flex items-center justify-center mx-auto">
                      <Heart className="h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold text-[#111111] dark:text-white">
                      Aucun cas clinique d'ECOS enregistré sur votre compte
                    </h4>
                    <p className="text-xs text-[#888888] max-w-md mx-auto">
                      Déposez un polycopié de cours (Word, PDF, PPTX) ci-dessus ou sélectionnez une de vos leçons pour que l'IA conçoive votre première simulation de garde clinique.
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCases.map((c) => (
                      <motion.div key={c.id} variants={itemVariants} onClick={() => startCase(c)}
                        className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 hover:border-[#5B21B6] hover:shadow-xl hover:-translate-y-1 rounded-[2rem] p-8 cursor-pointer transition-all duration-300 flex flex-col justify-between group h-full"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-6">
                             <span className="text-[9px] font-bold uppercase tracking-widest text-[#111111] dark:text-white bg-transparent border border-black/5 dark:border-white/5 px-3 py-1.5 rounded-md">
                              {c.specialty}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1.5 rounded-md">
                              {c.level}
                            </span>
                          </div>
                           <h4 className="text-xl font-medium text-[#111111] dark:text-white mb-4 group-hover:text-[#5B21B6] transition-colors leading-tight">
                            {c.title}
                          </h4>
                           <p className="text-sm text-[#666666] dark:text-[#8E8E8A] line-clamp-3 leading-relaxed">
                            {c.scenario}
                          </p>
                        </div>
                         <div className="mt-8 pt-6 border-t border-dashed border-black/10 dark:border-white/10 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] flex items-center gap-2">
                            <Heart className="h-3 w-3 text-red-500" /> {c.questions.length} Étapes
                          </span>
                           <div className="h-10 w-10 rounded-full bg-transparent flex items-center justify-center group-hover:bg-[#111111] transition-colors">
                             <ArrowRight className="h-4 w-4 text-[#111111] dark:text-white group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 md:p-14 shadow-sm min-h-[400px]">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-black/5 dark:border-white/5">
                      <div className="h-14 w-14 rounded-2xl bg-transparent border border-black/5 dark:border-white/5 flex items-center justify-center">
                        <History className="h-6 w-6 text-[#111111] dark:text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-light tracking-tight text-[#111111] dark:text-white">Historique Clinique</h2>
                        <p className="text-sm font-medium text-[#888888]">Révisez vos performances et erreurs de parcours.</p>
                      </div>
                    </div>

                    {pastSessions.length === 0 ? (
                      <div className="text-center py-20">
                        <Target className="h-12 w-12 text-[#888888] mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-medium text-[#111111] dark:text-white mb-2">Aucune garde à votre actif</h3>
                        <p className="text-[#888888]">Prenez votre premier poste aux urgences pour commencer votre suivi.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pastSessions.map((session: EcosSessionRecord) => {
                          const maxScore = session.history?.max_score || 300;
                          const isPassed = session.score >= maxScore * 0.7;
                          return (
                            <div key={session.id} className="p-6 rounded-2xl border border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 bg-transparent flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                                    {new Date(session.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isPassed ? (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-sm">Validé</span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-sm">À retravailler</span>
                                  )}
                                </div>
                                <h4 className="text-lg font-medium text-[#111111] dark:text-white">
                                  {session.case_title || "Station ECOS"}
                                </h4>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-light tracking-tighter text-[#111111] dark:text-white">
                                  {session.score} <span className="text-sm font-medium text-[#888888] tracking-normal">/ {maxScore}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>

          ) : isFinished ? (
            /* =========================================
               VUE 2 : LE BILAN CLINIQUE (Résultats)
               ========================================= */
            <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto pt-10">
              <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-14 text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[#5B21B6]" />
                
                <div className="h-24 w-24 rounded-full bg-[#5B21B6]/10 flex items-center justify-center mx-auto mb-8">
                  <Award className="h-12 w-12 text-[#5B21B6]" />
                </div>
                
                <h2 className="text-5xl font-light tracking-tighter mb-4 text-[#111111] dark:text-white">Bilan de Garde.</h2>
                <p className="text-[#666666] dark:text-[#8E8E8A] mb-10 font-medium">Débriefing officiel par votre superviseur clinique.</p>
                
                <div className="bg-transparent rounded-[2rem] p-10 mb-8 border border-black/5 dark:border-white/5 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-4">Score de Précision</span>
                  <span className="text-7xl font-light tracking-tighter text-[#111111] dark:text-white">
                    {score} <span className="text-2xl text-[#666666] font-medium tracking-normal">pts</span>
                  </span>
                </div>

                <div className="mb-10 flex justify-center text-left">
                  <ShareResults 
                    score={score} 
                    total={selectedCase.questions.length * 100} 
                    title={`Cas Clinique : ${selectedCase.title}`} 
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => startCase(selectedCase)} className="flex-1 py-5 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#161614] text-[#111111] dark:text-white font-bold uppercase tracking-widest text-xs hover:border-[#111111] dark:hover:border-white transition-colors">
                    Rejouer le cas
                  </button>
                  <button onClick={() => setSelectedCase(null)} className="flex-1 py-5 rounded-full bg-[#111111] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] transition-colors shadow-md">
                    Retour aux urgences
                  </button>
                </div>
              </div>
            </motion.div>

          ) : (
            /* =========================================
               VUE 3 : LA SALLE DE SIMULATION (Active)
               ========================================= */
            <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* COLONNE GAUCHE (4/12) : Patient & Constantes */}
              <div className="lg:col-span-4 flex flex-col gap-6 sticky top-8">
                {/* Moniteur ECG - Design Industriel Médical */}
                <div className="bg-[#111111] rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/50">Live</span>
                  </div>
                  <EcgMonitor 
                    bpm={patientState?.bpm || 0} spo2={patientState?.spo2 || 95}
                    bloodPressure={patientState?.bloodPressure || "120/80"} temperature={patientState?.temperature || 36.8}
                    isStable={patientState?.status === "stable"} status={patientState?.status || "stable"}
                  />
                </div>
                
                {/* Dossier Patient Scrollable */}
                <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm flex flex-col h-[400px]">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-6 flex items-center gap-2 pb-4 border-b border-black/5 dark:border-white/5">
                    <FileText className="h-4 w-4 text-[#111111]" /> Anamnèse
                  </h4>
                  <div className="flex-grow overflow-y-auto editorial-scrollbar pr-4">
                    <p className="text-sm text-[#111111] dark:text-[#F4F4F2] leading-relaxed font-medium">
                      {selectedCase.scenario}
                    </p>
                  </div>
                </div>
              </div>

              {/* COLONNE CENTRALE (5/12) : L'Action (Questions & Choix) */}
              <div className="lg:col-span-5 h-[calc(100vh-150px)] min-h-[600px]">
                <div className={cn(
                  "bg-white dark:bg-[#161614] border rounded-[2rem] p-10 shadow-sm flex flex-col h-full transition-all duration-300",
                  isUrgencyMode && timeLeft <= 15 && !hasAnswered ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]" : "border-black/10 dark:border-white/10"
                )}>
                  
                  {/* Header de la carte */}
                  <div className="flex justify-between items-start mb-8 pb-6 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#888888] block mb-2">Étape Clinique</span>
                      <span className="text-sm font-bold text-[#5B21B6] bg-[#5B21B6]/10 px-3 py-1 rounded-md">
                        {currentStep + 1} / {selectedCase.questions.length}
                      </span>
                    </div>
                    {isUrgencyMode && !hasAnswered && (
                      <div className={`px-4 py-2 rounded-full border ${timeLeft <= 15 ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-500 animate-pulse" : "bg-transparent border-black/10 dark:border-white/10 text-[#111111] dark:text-white"}`}>
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                          <Timer className="h-3 w-3" /> {timeLeft}s
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* La Question */}
                  <div className="shrink-0 mb-8">
                    <h3 className="text-2xl font-serif text-[#111111] dark:text-white leading-relaxed">
                      {selectedCase.questions[currentStep].text}
                    </h3>
                  </div>

                  {/* Les Choix ou Saisie Libre */}
                  <div className="space-y-3 flex-grow overflow-y-auto editorial-scrollbar pr-2 pb-4">
                    {selectedCase.questions[currentStep].type === "prescription" ? (
                      <div className="flex flex-col gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Rédiger l'ordonnance / l'acte</label>
                        <input 
                          type="text" 
                          value={prescriptionText}
                          onChange={(e) => setPrescriptionText(e.target.value)}
                          disabled={hasAnswered}
                          placeholder="Ex: Adrénaline 0.5mg IM..."
                          className="w-full bg-white dark:bg-[#0E0E0C] border border-black/10 dark:border-white/10 rounded-2xl p-6 text-sm font-medium focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] outline-none transition-all"
                        />
                        {!hasAnswered && (
                          <button onClick={() => handleTextSubmit(prescriptionText)} className="mt-2 py-4 rounded-xl bg-[#5B21B6] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#4C1D95] transition-colors">
                            Administrer le traitement
                          </button>
                        )}
                        {hasAnswered && (
                           <div className={`p-4 rounded-xl border mt-2 ${String(selectedCase?.questions?.[currentStep]?.correct || "").toLowerCase().includes(String(prescriptionText || "").toLowerCase()) ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400" : "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400"}`}>
                             <span className="font-bold text-xs uppercase block mb-1">Analyse du Tuteur</span>
                             Réponse attendue : {selectedCase.questions[currentStep].correct}
                           </div>
                        )}
                      </div>
                    ) : (
                      selectedCase.questions[currentStep].options?.map((opt, idx) => {
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = idx === selectedCase.questions[currentStep].correct;
                        const isDangerous = idx === selectedCase.questions[currentStep].dangerous;

                        // Design des boutons hyper strict
                        let btnClass = "border-black/10 dark:border-white/10 bg-white dark:bg-[#0E0E0C] text-[#111111] dark:text-white hover:border-[#5B21B6] hover:bg-[#5B21B6] hover:text-white";
                        if (hasAnswered) {
                          if (isCorrect) btnClass = "border-green-500 bg-green-500 text-white";
                          else if (isSelected) btnClass = isDangerous ? "border-red-500 bg-red-500 text-white" : "border-orange-500 bg-orange-500 text-white";
                          else btnClass = "border-black/5 dark:border-white/5 bg-[#FAFAF8] dark:bg-[#161614] text-[#888888] opacity-40 cursor-not-allowed";
                        }

                        return (
                          <button key={idx} disabled={hasAnswered} onClick={() => handleAnswerSubmit(idx)}
                            className={`w-full text-left p-6 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${btnClass}`}
                          >
                            <span className="font-bold text-sm w-6 mt-0.5 opacity-70">{String.fromCharCode(65 + idx)}.</span>
                            <span className="text-sm font-medium leading-relaxed">{opt}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Bouton d'action suivant */}
                  {hasAnswered && (
                    <div className="shrink-0 pt-6 border-t border-dashed border-black/10 dark:border-white/10 mt-auto">
                      <button onClick={handleNextStep} className="w-full py-5 rounded-xl bg-[#111111] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] transition-colors shadow-md flex justify-center items-center gap-3">
                        {currentStep < selectedCase.questions.length - 1 ? "Poursuivre la prise en charge" : "Clôturer le dossier"} 
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* COLONNE DROITE (3/12) : Le Tuteur IA (MOR) */}
              <div className="lg:col-span-3 h-[calc(100vh-150px)] min-h-[600px]">
                <div className={`bg-white dark:bg-[#161614] border rounded-[2rem] p-8 shadow-sm transition-colors duration-300 h-full flex flex-col ${
                  morStatus === "warning" ? "border-red-500" : morStatus === "success" ? "border-green-500" : "border-black/10 dark:border-white/10"
                }`}>
                  
                  {/* Header Tuteur */}
                  <div className="flex items-center gap-4 mb-8 pb-6 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${
                      morStatus === "warning" ? "bg-red-500" : morStatus === "success" ? "bg-green-500" : "bg-[#111111]"
                    }`}>
                      MOR
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#111111] dark:text-white">Agent MOR</h4>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#888888]">Superviseur IA</p>
                    </div>
                  </div>
                  
                  {/* Feedback Chat */}
                  <div className="flex-grow overflow-y-auto editorial-scrollbar pr-2 mb-6">
                    <div className="bg-transparent rounded-[1.5rem] p-6 border border-black/5 dark:border-white/5 relative">
                      {/* Petite flèche de chat */}
                      <div className="absolute -top-2 left-6 w-4 h-4 bg-transparent border-l border-t border-black/5 dark:border-white/5 rotate-45" />
                      <p className="text-sm text-[#111111] dark:text-[#F4F4F2] leading-relaxed font-medium relative z-10">
                        {morComment}
                      </p>
                    </div>

                    {/* Explication détaillée si répondu */}
                    {hasAnswered && (
                      <div className="mt-6 p-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-3">
                          Justification Scientifique
                        </span>
                        <p className="text-xs text-[#666666] dark:text-[#8E8E8A] leading-relaxed">
                          {selectedCase.questions[currentStep].explanation}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Score en direct */}
                  <div className="shrink-0 pt-6 border-t border-black/5 dark:border-white/5 mt-auto">
                     <div className="flex justify-between items-center bg-transparent p-4 rounded-xl border border-black/5 dark:border-white/5">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Score en direct</span>
                       <span className="text-lg font-bold text-[#111111] dark:text-white">{score} pts</span>
                     </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EcosPage;
