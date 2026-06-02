import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, FileText, CheckCircle, ArrowRight, RotateCcw, 
  Award, Heart, Sparkles, Search, Dices, BookOpen, Timer, Mic, Volume2, VolumeX, ShieldAlert
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uiAudio } from "@/utils/audio";
import { cn } from "@/lib/utils";
import { AnimatedBanner } from "@/components/AnimatedBanner";
// Assure-toi d'avoir ce composant ou remplace-le par un affichage simple des constantes
import { EcgMonitor } from "@/components/ecos/EcgMonitor"; 

// --- Interfaces Cliniques ---
interface Question {
  id: number; text: string; options: string[]; correct: number; dangerous: number;
  explanation: string; morFeedback: string;
  effect: { bpm: number; spo2: number; bp: string; status: "stable" | "unstable" | "critical"; };
}

interface Case {
  id: number; title: string; specialty: string; level: string; scenario: string;
  initialState: { bpm: number; spo2: number; bloodPressure: string; temperature: number; isStable: boolean; status: "stable" | "unstable" | "critical"; };
  questions: Question[];
}

// --- Cas Prédéfinis (Exemples de haute volée) ---
const CLINICAL_CASES: Case[] = [
  {
    id: 1,
    title: "Syndrome Coronarien Aigu (SCA)",
    specialty: "Cardiologie / Urgences",
    level: "D3 / ECNi",
    scenario: "Un patient de 56 ans, diabétique et tabagique, se présente aux urgences pour une douleur rétro-sternale constrictive irradiant vers la mâchoire et le bras gauche, survenue au repos il y a 2 heures.",
    initialState: { bpm: 94, spo2: 95, bloodPressure: "142/88", temperature: 36.8, isStable: false, status: "unstable" },
    questions: [
      {
        id: 1,
        text: "Quelle est votre première hypothèse diagnostique face à ce tableau clinique typique ?",
        options: ["Infarctus du Myocarde (SCA)", "Péricardite aiguë", "Spasme œsophagien", "Dissection aortique"],
        correct: 0, dangerous: 2,
        explanation: "La douleur constrictive chez un patient à risque (tabac, diabète) doit faire suspecter en priorité absolue un SCA.",
        morFeedback: "Attention : éliminer en priorité absolue le SCA est la règle d'or pour éviter une nécrose myocardique.",
        effect: { bpm: 88, spo2: 95, bp: "138/82", status: "unstable" }
      },
      {
        id: 2,
        text: "Quel examen devez-vous réaliser en priorité absolue dans les 10 premières minutes ?",
        options: ["ECG à 12 dérivations", "Radiographie pulmonaire", "Angio-scanner thoracique", "Dosage de la Troponine"],
        correct: 0, dangerous: 3,
        explanation: "La réalisation d'un ECG en moins de 10 minutes est indispensable pour diagnostiquer un SCA ST+.",
        morFeedback: "ERREUR CLINIQUE ! Attendre la troponine fait perdre des minutes précieuses. Le temps, c'est du muscle !",
        effect: { bpm: 96, spo2: 94, bp: "145/90", status: "unstable" }
      }
    ]
  }
];

export const EcosPage = () => {
  // --- États ---
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [patientState, setPatientState] = useState<Case["initialState"] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [morComment, setMorComment] = useState<string>("");
  const [morStatus, setMorStatus] = useState<"normal" | "warning" | "success">("normal");
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // --- Options & Modes ---
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [isUrgencyMode, setIsUrgencyMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // --- Constructeur IA ---
  const [difficulty, setDifficulty] = useState<"facile" | "moyen" | "difficile">("moyen");
  const [generationMode, setGenerationMode] = useState<"uploaded" | "search" | "random">("random");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [userLessons, setUserLessons] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const fetchLessons = async () => {
      const { data, error } = await supabase
        .from('summaries')
        .select('id, title')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setUserLessons(data);
      }
    };
    fetchLessons();
  }, []);

  // --- Logique du Timer d'Urgence ---
  useEffect(() => {
    if (selectedCase && !isFinished && isUrgencyMode && !hasAnswered) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAnswerSubmit(selectedCase.questions[currentStep].dangerous); // Pénalité automatique
            toast.error("Temps écoulé ! Retard de soin critique.");
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [selectedCase, isFinished, isUrgencyMode, currentStep, hasAnswered]);

  // --- Actions ---
  const startCase = (c: Case) => {
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
  };

  const generateEcosCase = () => {
    setIsGenerating(true); 
    setGenerationStep(1);
    setTimeout(() => setGenerationStep(2), 1000);
    setTimeout(() => setGenerationStep(3), 2000);
    setTimeout(() => {
      setIsGenerating(false); 
      setGenerationStep(0);
      startCase(CLINICAL_CASES[0]); // Simulation du retour IA
    }, 3000);
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
      setMorStatus("normal"); 
      setMorComment("La situation évolue. Adaptez votre stratégie.");
      setTimeLeft(60);
    } else {
      setIsFinished(true);
      if (score >= selectedCase.questions.length * 75) confetti({ particleCount: 150, spread: 80, colors: ['#5B21B6', '#111111', '#ffffff'] });
    }
  };

  // --- Animations ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

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
                            <button key={level} onClick={() => setDifficulty(level.toLowerCase() as any)}
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
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "uploaded", icon: BookOpen, label: "Mes Cours" },
                            { id: "search", icon: Search, label: "Recherche" },
                            { id: "random", icon: Dices, label: "Aléatoire" }
                          ].map((mode) => (
                            <button key={mode.id} onClick={() => setGenerationMode(mode.id as any)}
                              className={`p-5 rounded-xl border flex flex-col items-center gap-3 transition-all duration-200 ${
                                generationMode === mode.id ? "bg-[#5B21B6] border-[#5B21B6] text-white shadow-md" : "bg-transparent border-black/5 dark:border-white/5 text-[#888888] hover:border-black/20 dark:hover:border-white/30 hover:text-[#111111] dark:hover:text-white"
                              }`}
                            >
                              <mode.icon className="h-6 w-6" />
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
                          {generationMode === "uploaded" && (
                            <motion.div
                              key="uploaded"
                              initial={{ opacity: 0, height: 0, y: -10 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -10 }}
                              className="overflow-hidden"
                            >
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-4 flex items-center gap-2">
                                Choisir une leçon étudiée
                              </label>
                              <select 
                                value={selectedLesson} 
                                onChange={(e) => setSelectedLesson(e.target.value)}
                                className="w-full bg-transparent dark:text-white border border-black/10 dark:border-white/10 focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] rounded-xl px-5 py-4 text-sm font-medium transition-all outline-none appearance-none"
                              >
                                <option value="" disabled>Sélectionnez une leçon...</option>
                                {userLessons.length === 0 ? (
                                  <option value="" disabled>Aucune leçon disponible</option>
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
                                Thème ou Leçon spécifique
                              </label>
                              <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888]" />
                                <input 
                                  type="text" 
                                  value={searchQuery} 
                                  onChange={(e) => setSearchQuery(e.target.value)} 
                                  placeholder="Ex: Choc anaphylactique..."
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
                                  Alia va générer une situation d'urgence inédite pour tester vos réflexes.
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

              {/* Bibliothèque de Cas Classiques */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-6 flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Cas Cliniques de Référence
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {CLINICAL_CASES.map((c) => (
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
              </div>
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
                
                <div className="bg-transparent rounded-[2rem] p-10 mb-10 border border-black/5 dark:border-white/5 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-4">Score de Précision</span>
                  <span className="text-7xl font-light tracking-tighter text-[#111111] dark:text-white">
                    {score} <span className="text-2xl text-[#666666] font-medium tracking-normal">pts</span>
                  </span>
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

                  {/* Les Choix (Fluides et Scrollables si besoin) */}
                  <div className="space-y-3 flex-grow overflow-y-auto editorial-scrollbar pr-2 pb-4">
                    {selectedCase.questions[currentStep].options.map((opt, idx) => {
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
                    })}
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
