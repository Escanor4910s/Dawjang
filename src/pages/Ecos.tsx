import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, Activity, FileText, CheckCircle, XCircle, ArrowRight, RotateCcw, 
  UserCheck, Award, AlertCircle, Heart, Zap, Sparkles, Search, Dices, BookOpen, Loader2, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EcgMonitor } from "@/components/ecos/EcgMonitor";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uiAudio } from "@/utils/audio";
import { cn } from "@/lib/utils";

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
  dangerous: number;
  explanation: string;
  morFeedback: string;
  effect: {
    bpm: number;
    spo2: number;
    bp: string;
    status: "stable" | "unstable" | "critical";
  };
}

interface Case {
  id: number;
  title: string;
  specialty: string;
  level: string;
  scenario: string;
  initialState: {
    bpm: number;
    spo2: number;
    bloodPressure: string;
    temperature: number;
    isStable: boolean;
    status: "stable" | "unstable" | "critical";
  };
  questions: Question[];
}

const CLINICAL_CASES: Case[] = [
  {
    id: 1,
    title: "Syndrome Coronarien Aigu (SCA)",
    specialty: "Cardiologie / Urgences",
    level: "D3 / ECNi",
    scenario: "Un patient de 56 ans, diabétique et tabagique, se présente aux urgences pour une douleur rétro-sternale constrictive irradiant vers la mâchoire et le bras gauche, survenue au repos il y a 2 heures.",
    initialState: {
      bpm: 94,
      spo2: 95,
      bloodPressure: "142/88",
      temperature: 36.8,
      isStable: false,
      status: "unstable",
    },
    questions: [
      {
        id: 1,
        text: "Quelle est votre première hypothèse diagnostique face à ce tableau clinique typique ?",
        options: [
          "Infarctus du Myocarde / Syndrome Coronarien Aigu (SCA)",
          "Péricardite aiguë non compliquée",
          "Spasme œsophagien diffus",
          "Dissection aortique aiguë"
        ],
        correct: 0,
        dangerous: 2,
        explanation: "La douleur constrictive rétro-sternale irradiante chez un patient présentant des facteurs de risque cardiovasculaires majeurs (tabac, diabète) doit faire suspecter en priorité absolue un SCA.",
        morFeedback: "⚠️ Attention : bien que d'autres pathologies causent des douleurs thoraciques, éliminer en priorité absolue le Syndrome Coronarien Aigu est la règle d'or aux urgences pour éviter une nécrose myocardique fatale.",
        effect: {
          bpm: 88,
          spo2: 95,
          bp: "138/82",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "Quel examen d'imagerie ou d'enregistrement électrique devez-vous réaliser en priorité absolue dans les 10 premières minutes de sa prise en charge ?",
        options: [
          "Un Électrocardiogramme (ECG) à 12 dérivations",
          "Une Radiographie pulmonaire de face",
          "Un Angio-scanner thoracique en urgence",
          "Un dosage de la Troponine sanguine"
        ],
        correct: 0,
        dangerous: 3,
        explanation: "La réalisation d'un ECG à 12 dérivations en moins de 10 minutes est indispensable pour diagnostiquer un sus-décalage du segment ST (SCA ST+) et initier la revascularisation immédiate.",
        morFeedback: "❌ ERREUR CLINIQUE ! Attendre le résultat de la troponine biologique avant de poser le diagnostic électrique d'un SCA ST+ fait perdre des minutes précieuses de survie myocardique. Le temps, c'est du muscle cardiaque !",
        effect: {
          bpm: 96,
          spo2: 94,
          bp: "145/90",
          status: "unstable"
        }
      },
      {
        id: 3,
        text: "L'ECG confirme un sus-décalage du segment ST en antérieur (SCA ST+). Quel traitement immédiat est contre-indiqué sans exclure formellement un syndrome hémorragique ou une dissection aortique ?",
        options: [
          "Double anti-agrégation plaquettaire + Anticoagulant à forte dose ou Fibrinolyse immédiate",
          "Administration d'Oxygène par lunettes nasales",
          "Pose d'une voie veineuse périphérique",
          "Prise de Paracétamol pour la douleur"
        ],
        correct: 0,
        dangerous: 0,
        explanation: "L'administration inappropriée d'anticoagulants ou de fibrinolytiques en présence d'une douleur thoracique atypique simulant un SCA (comme une dissection aortique) peut provoquer une hémorragie aortique ou péricardique foudroyante.",
        morFeedback: "🚨 DANGER DE MORT ! Administrer un traitement fibrinolytique ou anticoagulant massif en cas de suspicion concomitante de dissection aortique (par exemple si les pouls sont asymétriques) provoquera une rupture aortique fatale en quelques minutes !",
        effect: {
          bpm: 65,
          spo2: 97,
          bp: "120/75",
          status: "stable"
        }
      }
    ]
  },
  {
    id: 2,
    title: "Accident Vasculaire Cérébral (AVC) Ischémique",
    specialty: "Neurologie / Urgences",
    level: "D4 / ECOS national",
    scenario: "Une femme de 68 ans est amenée par les pompiers pour l'apparition soudaine, il y a 1h30, d'un déficit moteur complet du bras et de la jambe droite associé à une aphasie (perte de la parole).",
    initialState: {
      bpm: 78,
      spo2: 97,
      bloodPressure: "185/105",
      temperature: 36.6,
      isStable: false,
      status: "unstable",
    },
    questions: [
      {
        id: 1,
        text: "Quelle est votre première étape de prise en charge à l'arrivée aux urgences pour orienter le traitement de revascularisation ?",
        options: [
          "Prescrire une IRM ou un Scanner cérébral sans injection en extrême urgence",
          "Administrer immédiatement de l'Aspirine 300mg IV",
          "Faire baisser rapidement la pression artérielle par des antihypertenseurs IV",
          "Attendre l'avis écrit du neurologue de garde"
        ],
        correct: 0,
        dangerous: 1,
        explanation: "L'imagerie cérébrale immédiate (Scanner ou IRM) est indispensable pour différencier un AVC ischémique (accessible à la thrombolyse) d'un AVC hémorragique.",
        morFeedback: "🚨 GESTE DANGEREUX ! Injecter de l'aspirine ou des antiagrégants avant d'avoir éliminé un AVC hémorragique par scanner provoquera une extension catastrophique du saignement intracrânien.",
        effect: {
          bpm: 82,
          spo2: 97,
          bp: "188/108",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "L'imagerie élimine une hémorragie et confirme une occlusion de l'artère cérébrale moyenne gauche. Le début des symptômes remonte à 2 heures. Quelle thérapeutique de revascularisation est indiquée ?",
        options: [
          "Thrombolyse intraveineuse par rtPA (Altéplase) associée éventuellement à une thrombectomie mécanique",
          "Héparinothérapie curative immédiate",
          "Surveillance simple en unité classique de médecine",
          "Thrombectomie isolée sans thrombolyse"
        ],
        correct: 0,
        dangerous: 2,
        explanation: "La thrombolyse IV par rtPA est indiquée dans les 4h30 suivant le début des symptômes d'un AVC ischémique, et la thrombectomie mécanique dans les 6 heures en cas d'occlusion d'une grosse artère.",
        morFeedback: "⚠️ Attention : le nihilisme thérapeutique ou la simple surveillance sans revascularisation chez un patient éligible dans la fenêtre temporelle constitue une perte de chance majeure de récupération fonctionnelle.",
        effect: {
          bpm: 72,
          spo2: 98,
          bp: "140/85",
          status: "stable"
        }
      }
    ]
  },
  {
    id: 3,
    title: "Choc Anaphylactique aux Urgences",
    specialty: "Allergologie / Réanimation",
    level: "D3 / ECNi",
    scenario: "Un jeune homme de 24 ans est admis aux urgences suite à l'ingestion accidentelle de cacahuètes. Il présente une détresse respiratoire majeure (sifflements), un œdème du visage (Quincke) et des marbrures généralisées.",
    initialState: {
      bpm: 132,
      spo2: 86,
      bloodPressure: "78/42",
      temperature: 37.2,
      isStable: false,
      status: "critical",
    },
    questions: [
      {
        id: 1,
        text: "Devant cet état de choc anaphylactique avec collapsus cardiovasculaire et hypoxie sévère, quelle est la thérapeutique salvatrice immédiate ?",
        options: [
          "Injection intramusculaire d'Adrénaline en urgence",
          "Nébulisation de corticoïdes inhalés",
          "Remplissage vasculaire massif par 2L de cristalloïdes seuls",
          "Administration d'un antihistaminique par voie orale"
        ],
        correct: 0,
        dangerous: 3,
        explanation: "L'adrénaline par voie intramusculaire (IM) est le traitement de première ligne incontournable et salvateur du choc anaphylactique.",
        morFeedback: "🚨 URGENCE VITALE ÉVITÉE DE JUSTESSE ! Donner un antihistaminique par voie orale chez un patient en état de choc circulatoire avec hypoxie sévère est inutile et criminel : le patient va faire un arrêt cardiaque dans les minutes qui suivent !",
        effect: {
          bpm: 110,
          spo2: 92,
          bp: "105/65",
          status: "unstable"
        }
      },
      {
        id: 2,
        text: "Quelle est la dose et la voie d'administration recommandée pour l'Adrénaline chez l'adulte en choc anaphylactique ?",
        options: [
          "Adrénaline 0.5 mg par voie Intra-Musculaire (IM) dans la cuisse",
          "Adrénaline 1 mg par voie Intra-Veineuse (IV) directe rapide",
          "Adrénaline 5 mg en aérosol/inhalation",
          "Adrénaline 0.1 mg par voie Sous-Cutanée (SC)"
        ],
        correct: 0,
        dangerous: 1,
        explanation: "La recommandation officielle est l'injection IM de 0.5 mg d'adrénaline dans la face antéro-latérale de la cuisse chez l'adulte, répétable après 5-10 minutes.",
        morFeedback: "🚨 TOXICITÉ CARDIAQUE MAJEURE ! Injecter 1 mg d'adrénaline IV directe rapide chez un patient qui n'est pas en arrêt cardio-respiratoire peut déclencher une fibrillation ventriculaire fatale ou une hémorragie cérébrale par pic hypertensif !",
        effect: {
          bpm: 88,
          spo2: 97,
          bp: "122/74",
          status: "stable"
        }
      }
    ]
  }
];

const EcosPage = () => {
  const navigate = useNavigate();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [patientState, setPatientState] = useState<Case["initialState"] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [morComment, setMorComment] = useState<string>("");
  const [morStatus, setMorStatus] = useState<"normal" | "warning" | "success">("normal");
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Immersive Urgency Mode 60s
  const [isUrgencyMode, setIsUrgencyMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isShaking, setIsShaking] = useState(false);

  // Dynamic ECOS simulation builder parameters
  const [uploadedCourses, setUploadedCourses] = useState<{ id: string; title: string; content: string }[]>([]);
  const [difficulty, setDifficulty] = useState<"facile" | "moyen" | "difficile">("moyen");
  const [customTheme, setCustomTheme] = useState("");
  const [generationMode, setGenerationMode] = useState<"uploaded" | "search" | "random">("random");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // Fetch uploaded lessons on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("courses")
          .select("id, title, content")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          setUploadedCourses(data);
          if (data.length > 0) {
            setSelectedCourseId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading uploaded lessons:", err);
      }
    })();
  }, []);

  const generateEcosCase = () => {
    if (generationMode === "uploaded" && !selectedCourseId) {
      toast.error("Veuillez sélectionner une leçon parmi vos documents uploadés.");
      return;
    }
    if (generationMode === "search" && !searchText.trim()) {
      toast.error("Veuillez saisir un sujet ou mot-clé pour la recherche.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep(1);

    const playTone = (freq: number, dur: number) => {
      try {
        const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) setAudioContext(ctx);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {}
    };

    playTone(523.25, 0.08);

    setTimeout(() => {
      setGenerationStep(2);
      playTone(587.33, 0.08);
    }, 1200);

    setTimeout(() => {
      setGenerationStep(3);
      playTone(659.25, 0.08);
    }, 2400);

    setTimeout(() => {
      let finalTitle = "";
      let finalSpecialty = customTheme.trim() || "Urgences Cliniques";
      let finalScenario = "";
      let levelLabel = difficulty === "facile" ? "D1 / D2 (Facile)" : difficulty === "moyen" ? "D3 / D4 (Moyen)" : "ECOS national (Difficile)";
      
      let baseBpm = 82;
      let baseSpo2 = 96;
      let baseBp = "120/80";
      let baseTemp = 37.0;

      if (generationMode === "uploaded") {
        const selectedCourse = uploadedCourses.find(c => c.id === selectedCourseId);
        finalTitle = selectedCourse ? `ECOS : ${selectedCourse.title}` : "Cas ECOS sur Mesure";
        finalScenario = `Un patient se présente dans votre service clinique en rapport direct avec votre document d'étude médicale : "${selectedCourse?.title || "Cours d'études"}". L'analyse des données de votre cours a mis en évidence des signes prodromiques typiques devant être explorés d'urgence.`;
      } else if (generationMode === "search") {
        finalTitle = `Simulation : ${searchText}`;
        finalScenario = `Un patient de 42 ans est admis en consultation pour des symptômes évocateurs de : "${searchText}". L'interrogatoire retrouve un début insidieux des signes depuis plusieurs jours.`;
      } else {
        const randomSpecialties = ["Pneumologie", "Pédiatrie", "Gastro-entérologie", "Gynécologie", "Urgences"];
        const randomTopics = ["Asthme aigu grave", "Meningite à méningocoque", "Occlusion intestinale aiguë", "Pré-éclampsie sévère", "Choc cardiogénique"];
        const selectedIdx = Math.floor(Math.random() * randomTopics.length);
        finalTitle = `Cas Aléatoire : ${randomTopics[selectedIdx]}`;
        finalSpecialty = randomSpecialties[selectedIdx];
        finalScenario = `Le SAMU vous contacte pour réguler un appel concernant un patient présentant un tableau clinique bruyant évocateur de ${randomTopics[selectedIdx]}. Le patient est en cours de transfert vers votre unité de déchocage.`;
      }

      if (difficulty === "difficile") {
        baseBpm = 135;
        baseSpo2 = 88;
        baseBp = "85/45";
        baseTemp = 39.2;
      } else if (difficulty === "moyen") {
        baseBpm = 108;
        baseSpo2 = 93;
        baseBp = "145/95";
        baseTemp = 38.1;
      }

      const generatedCase: Case = {
        id: Date.now(),
        title: finalTitle,
        specialty: finalSpecialty,
        level: levelLabel,
        scenario: finalScenario,
        initialState: {
          bpm: baseBpm,
          spo2: baseSpo2,
          bloodPressure: baseBp,
          temperature: baseTemp,
          isStable: difficulty === "facile",
          status: difficulty === "facile" ? "stable" : difficulty === "moyen" ? "unstable" : "critical"
        },
        questions: [
          {
            id: 1,
            text: "Face à ce tableau clinique d'admission, quel est votre premier geste réflexe ou examen complémentaire de première intention à réaliser en urgence ?",
            options: [
              "Vérifier les constantes vitales immédiates (Scope ECG, SpO2, Pression artérielle) et libérer les voies aériennes",
              "Prescrire un bilan biologique complet avec hémocultures et gaz du sang",
              "Demander une consultation spécialisée et attendre l'avis du senior de garde",
              "Administrer directement un sédatif pour calmer l'anxiété du patient"
            ],
            correct: 0,
            dangerous: 3,
            explanation: "La règle de base en médecine d'urgence (ABCDE) impose de sécuriser d'abord les fonctions vitales (Voies aériennes, Respiration, Circulation) avant tout examen invasif.",
            morFeedback: "🚨 ERREUR CRITIQUE ! Administrer un sédatif ou retarder la prise en charge sans évaluer les fonctions vitales peut entraîner un arrêt respiratoire immédiat ou masquer un état de choc débutant.",
            effect: {
              bpm: Math.max(70, baseBpm - 15),
              spo2: Math.min(99, baseSpo2 + 4),
              bp: "120/80",
              status: "stable"
            }
          },
          {
            id: 2,
            text: "Les premiers examens orientent vers une complication aiguë. Quelle est votre stratégie thérapeutique immédiate conformes aux recommandations actuelles ?",
            options: [
              "Mettre en place une surveillance rapprochée et débuter le traitement spécifique ciblé immédiatement",
              "Attendre l'imagerie de contrôle du lendemain avant d'initier toute thérapeutique active",
              "Remplir le patient massivement par 4 litres de sérum physiologique en moins de 30 minutes",
              "Transférer immédiatement le patient dans un autre établissement sans le stabiliser au préalable"
            ],
            correct: 0,
            dangerous: 2,
            explanation: "L'initiation rapide du traitement adapté (ex: antibiothérapie, bronchodilatateurs, ou revascularisation) est le facteur pronostic majeur dans les urgences vitales.",
            morFeedback: "⚠️ DANGER : Un remplissage vasculaire trop massif et trop rapide hors état de choc hypovolémique strict expose le patient à un œdème aigu du poumon (OAP) cardiogénique iatrogène foudroyant !",
            effect: {
              bpm: Math.max(65, baseBpm - 20),
              spo2: Math.min(100, baseSpo2 + 6),
              bp: "118/75",
              status: "stable"
            }
          }
        ]
      };

      setIsGenerating(false);
      setGenerationStep(0);
      startCase(generatedCase);
      playTone(880, 0.25);
      confetti({ particleCount: 100, spread: 80 });
    }, 3600);
  };

  // Sound generator
  const triggerTone = (freq: number, dur: number, type: "sine" | "triangle" | "sawtooth" = "sine", gainVal = 0.1) => {
    try {
      const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) setAudioContext(ctx);
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // Manage heartbeat audio loops and timer countdown
  useEffect(() => {
    if (selectedCase && !isFinished && isUrgencyMode) {
      const bpm = patientState?.bpm || 80;
      uiAudio.startHeartbeatLoop(bpm);
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            const currentQuestion = selectedCase.questions[currentStep];
            handleAnswerSubmit(currentQuestion.dangerous);
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 800);
            toast.error("⌛ TEMPS ÉCOULÉ ! Une erreur critique de retard de soin a été enregistrée.");
            return 60;
          }
          if (prev <= 16) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 200);
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        uiAudio.stopHeartbeatLoop();
      };
    } else {
      uiAudio.stopHeartbeatLoop();
    }
  }, [selectedCase, isFinished, isUrgencyMode, currentStep, patientState?.bpm]);

  useEffect(() => {
    if (!selectedCase || isFinished) {
      uiAudio.stopHeartbeatLoop();
    }
  }, [selectedCase, isFinished]);

  const startCase = (c: Case) => {
    setSelectedCase(c);
    setPatientState({ ...c.initialState });
    setCurrentStep(0);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setScore(0);
    setIsFinished(false);
    setMorStatus("normal");
    setMorComment(`Bonjour confrère. Je suis l'Agent MOR, chef de clinique de garde. Nous accueillons ce patient présentant un tableau clinique délicat de ${c.title}. Installez le patient et examinez les constantes.`);
    triggerTone(523.25, 0.25, "sine", 0.08); // Sweet C note
    setTimeLeft(60); // Reset countdown
  };

  const handleAnswerSubmit = (optionIndex: number) => {
    if (hasAnswered || !selectedCase || !patientState) return;

    setSelectedAnswer(optionIndex);
    setHasAnswered(true);

    const question = selectedCase.questions[currentStep];
    const isCorrect = optionIndex === question.correct;
    const isDangerous = optionIndex === question.dangerous;

    if (isCorrect) {
      triggerTone(880, 0.3, "sine", 0.1); // Correct beep
      setScore(prev => prev + 100);
      setMorStatus("success");
      setMorComment(`✨ Excellent diagnostic ! ${question.morFeedback || "Choix clinique tout à fait adapté et validé par les recommandations de l'HAS."}`);
      
      // Update constants positively
      setPatientState(prev => prev ? {
        ...prev,
        bpm: question.effect.bpm,
        spo2: question.effect.spo2,
        bloodPressure: question.effect.bp,
        status: question.effect.status
      } : null);
    } else {
      triggerTone(180, 0.45, "triangle", 0.15); // Alarm buzzer
      setMorStatus("warning");
      
      if (isDangerous) {
        setScore(prev => Math.max(0, prev - 80)); // Heavy penalty
        setMorComment(question.morFeedback);
        
        // Push constants to dangerous zone
        setPatientState(prev => prev ? {
          ...prev,
          bpm: Math.min(150, prev.bpm + 15),
          spo2: Math.max(80, prev.spo2 - 6),
          status: "critical"
        } : null);
      } else {
        setScore(prev => Math.max(0, prev - 40));
        setMorComment(`❌ Mauvais choix. ${question.morFeedback || "Cette action retarde la prise en charge ou n'est pas recommandée."}`);
      }
    }
  };

  const handleNextStep = () => {
    if (!selectedCase) return;

    if (currentStep < selectedCase.questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setMorStatus("normal");
      setMorComment("Le patient évolue. Analysons la situation clinique suivante pour orienter la suite de la prise en charge.");
      triggerTone(587.33, 0.15, "sine", 0.06); // Sweet D note
      setTimeLeft(60); // Reset countdown
    } else {
      // Completed!
      setIsFinished(true);
      if (score >= selectedCase.questions.length * 75) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        triggerTone(523.25, 0.15);
        setTimeout(() => triggerTone(659.25, 0.15), 150);
        setTimeout(() => triggerTone(783.99, 0.35), 300); // Triumph chord
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-dashboard bg-doodle-watermark relative overflow-hidden space-y-6">
      {/* Background glow filters */}
      <div className="absolute top-[-10%] right-[-10%] w-[380px] h-[380px] bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[380px] h-[380px] bg-violet-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
        <div className="space-y-1">
          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 uppercase font-black tracking-widest text-[10px] px-3 py-1">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> Simulateur ECOS Clinique
          </Badge>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
            Arène d'Immersion ECOS
          </h1>
          <p className="text-xs text-muted-foreground/80 font-medium">
            Entraînez-vous aux urgences en temps réel, gérez les constantes vitales et évitez les erreurs critiques sous le contrôle de l'Agent MOR.
          </p>
        </div>

        {selectedCase && (
          <Button 
            onClick={() => setSelectedCase(null)} 
            variant="outline" 
            className="rounded-full font-bold gap-2 text-xs h-10 hover:bg-muted/40 transition-all border-border"
          >
            <RotateCcw className="h-4 w-4" /> Changer de Cas
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedCase ? (
          /* CASE CHOOSE & BUILDER MENU */
          <motion.div
            key="case-select-and-builder"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-12 pt-4"
          >
            {/* Embedded Custom Styles for Shimmer and Telemetry Animations */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes shimmerSweep {
                0% { left: -100%; }
                100% { left: 100%; }
              }
              .shimmer-sweep::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
                transition: all 0.6s ease;
              }
              .shimmer-sweep:hover::after {
                animation: shimmerSweep 1.6s infinite;
              }
              .telemetry-glow {
                box-shadow: 0 0 25px rgba(var(--primary-rgb), 0.15);
              }
            `}} />

            {/* IA CLINICAL BUILDER COMPONENT */}
            <Card className="bg-gradient-to-br from-card/80 via-card/45 to-background/50 backdrop-blur-3xl border border-white/10 dark:border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.35)] rounded-[3rem] overflow-hidden p-6 md:p-10 relative group/builder">
              {/* Pulsing Backlit Radial Glows */}
              <div className="absolute top-[-25%] left-[-15%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[110px] pointer-events-none animate-[pulse_6s_infinite_alternate]" />
              <div className="absolute bottom-[-25%] right-[-15%] w-[400px] h-[400px] bg-violet-500/15 rounded-full blur-[110px] pointer-events-none animate-[pulse_8s_infinite_alternate_2s]" />
              
              <div className="space-y-8 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-primary/20 to-violet-500/20 border border-primary/30 text-primary shadow-inner">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-foreground uppercase bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text">
                        Concepteur ECOS Clinique MOR-IA
                      </h2>
                      <p className="text-xs text-muted-foreground font-medium">
                        Calibrez les paramètres cliniques d'urgence et instanciez une station d'immersion clinique sur mesure.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Mode Urgence 60s Toggle */}
                    <div className="flex items-center gap-3.5 bg-background/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Timer className={`h-4 w-4 ${isUrgencyMode ? "text-rose-500 animate-pulse" : "text-muted-foreground"}`} />
                        <div className="text-left">
                          <p className="text-[9px] font-black uppercase tracking-wider text-foreground">MODE URGENCE 60s</p>
                          <p className="text-[7px] font-extrabold text-muted-foreground uppercase tracking-widest leading-none">Pulsation Cardiaque 3D</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          uiAudio.playSoftClick();
                          setIsUrgencyMode(!isUrgencyMode);
                        }}
                        className={`w-10 h-5.5 rounded-full transition-all duration-300 relative focus:outline-none ${
                          isUrgencyMode ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-muted"
                        }`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white h-4.5 w-4.5 rounded-full transition-all duration-300 shadow-sm ${
                          isUrgencyMode ? "translate-x-4.5" : "translate-x-0"
                        }`} />
                      </button>
                    </div>

                    <Badge className="bg-primary/15 text-primary border border-primary/30 rounded-xl font-bold uppercase tracking-widest text-[9px] px-3.5 py-1.5 animate-[pulse_3s_infinite]">
                      🔥 MOTEUR V2 ACTIF
                    </Badge>
                  </div>
                </div>

                {isGenerating ? (
                  /* HIGH END MEDICAL GENERATION LOADER */
                  <div className="py-16 flex flex-col items-center justify-center space-y-8">
                    <div className="relative">
                      {/* Pulse waves */}
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-[ping_1.8s_infinite]" />
                      <div className="absolute inset-[-10px] rounded-full bg-violet-500/5 animate-[ping_2.4s_infinite]" />
                      <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary border-r-primary/45 animate-spin relative z-10 flex items-center justify-center bg-card">
                        <Activity className="h-10 w-10 text-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center space-y-3 max-w-md mx-auto">
                      <motion.p 
                        key={generationStep}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-base font-black text-foreground uppercase tracking-widest"
                      >
                        {generationStep === 1 && "🩺 Extraction des concepts cliniques..."}
                        {generationStep === 2 && "⚡ Calibrage du scope de réanimation..."}
                        {generationStep === 3 && "🧠 Synthèse de la station ECOS par l'Agent MOR..."}
                      </motion.p>
                      <Progress value={generationStep * 33.3} className="h-1.5 w-48 mx-auto bg-muted" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        L'intelligence clinique MOR modélise les diagnostics différentiels, la courbe ECG dynamique et les paliers d'urgence pour cette station.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* BUILDER FORM CONTAINER */
                  <div className="grid md:grid-cols-12 gap-10">
                    {/* LEFT BUILDER PARAMETERS (5 cols) */}
                    <div className="md:col-span-5 space-y-8">
                      {/* Difficulty parameter */}
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-primary" /> 1. Niveau Clinique Souhaité
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {(["facile", "moyen", "difficile"] as const).map((level) => {
                            const isActive = difficulty === level;
                            return (
                              <motion.button
                                key={level}
                                type="button"
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDifficulty(level)}
                                className={`py-3 px-3.5 rounded-2xl border-2 text-xs font-bold capitalize transition-all duration-300 flex flex-col items-center justify-center gap-1.5 shadow-md ${
                                  isActive
                                    ? level === "facile"
                                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/5"
                                      : level === "moyen"
                                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-amber-500/5"
                                      : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-rose-500/5"
                                    : "border-white/5 dark:border-white/10 hover:border-white/10 hover:dark:border-white/20 text-foreground/80 hover:bg-muted/30 bg-muted/10"
                                }`}
                              >
                                <span className="text-base">
                                  {level === "facile" && "🟢"}
                                  {level === "moyen" && "🟡"}
                                  {level === "difficile" && "🔴"}
                                </span>
                                <span className="text-[10px] uppercase font-black tracking-wider">{level}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Specialty theme parameter */}
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-rose-500" /> 2. Spécialité ou Thème
                        </label>
                        <div className="relative group/input">
                          <Activity className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/75 transition-colors group-focus-within/input:text-primary" />
                          <input
                            type="text"
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                            placeholder="Ex: Cardiologie, Pédiatrie, Gynécologie..."
                            className="w-full bg-muted/20 border-2 border-white/5 dark:border-white/10 focus:border-primary hover:border-white/10 transition-all duration-300 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 shadow-inner"
                          />
                        </div>
                        {/* Quick tags suggestions with micro-animations */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {["Urgences", "Pédiatrie", "Cardiologie", "Neurologie", "Traumatologie"].map((tag, idx) => (
                            <motion.button
                              key={tag}
                              type="button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              whileHover={{ scale: 1.08, y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCustomTheme(tag)}
                              className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all ${
                                customTheme === tag
                                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                                  : "bg-muted/40 hover:bg-muted border-white/5 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {tag}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT GENERATION SOURCE MODE (7 cols) */}
                    <div className="md:col-span-7 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 block flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" /> 3. Source du Support Médical
                        </label>

                        {/* 3 Premium interactive Cards for choices */}
                        <div className="grid sm:grid-cols-3 gap-4">
                          {/* Option A: Uploaded lessons */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("uploaded")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "uploaded"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "uploaded" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Mes Documents</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">ECOS issu de vos PDF ou résumés uploadés.</p>
                            </div>
                          </motion.button>

                          {/* Option B: Search / custom topic */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("search")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "search"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "search" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <Search className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Sujet Libre</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">Saisissez un thème de cours ou pathologie.</p>
                            </div>
                          </motion.button>

                          {/* Option C: Random generation */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setGenerationMode("random")}
                            className={`p-5 rounded-[2rem] border-2 text-left flex flex-col justify-between h-40 transition-all duration-300 relative overflow-hidden group/opt ${
                              generationMode === "random"
                                ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5 telemetry-glow"
                                : "border-white/5 dark:border-white/10 hover:border-white/10 hover:bg-muted/30 text-foreground bg-muted/10"
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl self-start ${generationMode === "random" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} transition-colors`}>
                              <Dices className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-wider">Surprise IA</p>
                              <p className="text-[9px] leading-relaxed text-muted-foreground/80">Laisser MOR IA inventer une urgence typique.</p>
                            </div>
                          </motion.button>
                        </div>

                        {/* Conditional content input container with fluid heights */}
                        <AnimatePresence mode="wait">
                          <motion.div 
                            key={generationMode}
                            initial={{ opacity: 0, height: 0, y: -8 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -8 }}
                            className="p-5 rounded-2xl bg-muted/10 border border-white/5 dark:border-white/10 mt-4 overflow-hidden"
                          >
                            {generationMode === "uploaded" && (
                              <div className="w-full space-y-3">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Sélectionnez le document de cours :</span>
                                {uploadedCourses.length > 0 ? (
                                  <select
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                    className="w-full bg-background border-2 border-white/10 focus:border-primary transition-all rounded-xl px-4 py-3 text-xs font-semibold text-foreground"
                                  >
                                    {uploadedCourses.map((course) => (
                                      <option key={course.id} value={course.id}>
                                        📚 {course.title}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="text-[10px] text-amber-500 font-black flex items-center gap-1.5">
                                    ⚠️ Aucun document disponible. Veuillez télécharger un fichier PDF dans l'Espace Création pour l'utiliser ici.
                                  </p>
                                )}
                              </div>
                            )}

                            {generationMode === "search" && (
                              <div className="w-full space-y-3">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Sujet de la leçon à simuler :</span>
                                <div className="relative">
                                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Entrez le thème (ex: Diabète de type 1 complété d'acidocétose)"
                                    className="w-full bg-background border-2 border-white/10 focus:border-primary transition-all rounded-xl pl-10 pr-3 py-2.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 shadow-inner"
                                  />
                                </div>
                              </div>
                            )}

                            {generationMode === "random" && (
                              <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-semibold">
                                🎲 **Mode Surprise Clinique** : L'IA va modéliser un cas typique à haute prévalence clinique. Les questions adapteront automatiquement leur pertinence selon votre niveau choisi.
                              </p>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Main action submit button with Shimmer Sweep Animation */}
                      <motion.button
                        whileHover={{ scale: 1.025, y: -2, boxShadow: "0 20px 40px rgba(99,102,241,0.25)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={generateEcosCase}
                        className="w-full h-14 rounded-[2rem] font-black uppercase text-[11px] tracking-widest bg-gradient-to-r from-primary via-indigo-500 to-violet-600 text-primary-foreground shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2.5 mt-6 relative overflow-hidden group/btn shimmer-sweep"
                      >
                        <Sparkles className="h-4.5 w-4.5 text-primary-foreground animate-[pulse_1.5s_infinite]" />
                        <span>Générer ma Simulation Clinique MOR-IA</span>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* PRE-DEFINED ORIGINAL ECOS CASES */}
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 pb-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Ou Choisissez un Cas ECOS Clinique Prédéfini
                </h3>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {CLINICAL_CASES.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, type: "spring", stiffness: 100 }}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer group h-full"
                    onClick={() => startCase(c)}
                  >
                    <Card className="h-full bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-xl rounded-[2.5rem] overflow-hidden flex flex-col justify-between transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-primary/5">
                      <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="font-extrabold uppercase text-[9px] tracking-wider rounded-xl">
                              {c.specialty}
                            </Badge>
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase">
                              {c.level}
                            </Badge>
                          </div>

                          <h3 className="text-base font-bold group-hover:text-primary transition-colors leading-tight">
                            {c.title}
                          </h3>
                          
                          <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium line-clamp-3">
                            {c.scenario}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Heart className="h-3.5 w-3.5 text-rose-500 animate-pulse" /> {c.questions.length} Étapes Cliniques
                          </span>
                          <Button size="sm" className="rounded-full font-bold text-[10px] h-8.5 bg-primary text-primary-foreground group-hover:bg-primary/90 transition-all shadow-md px-4">
                            Diagnostiquer <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : isFinished ? (
          /* CLINICAL RESULTS CARD */
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto pt-6"
          >
            <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-2xl rounded-[3rem] overflow-hidden text-center p-8 space-y-6 relative">
              <div className="absolute top-[-10%] right-[-10%] w-[180px] h-[180px] bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
              
              <div className="relative flex items-center justify-center h-24 my-2">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 120, delay: 0.15 }}
                  className="p-5 rounded-full bg-primary/15 border border-primary/20 text-primary shadow-lg"
                >
                  <Award className="h-10 w-10 animate-bounce" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Prise en charge terminée !</h2>
                <p className="text-xs text-muted-foreground">Voici le bilan clinique officiel validé par l'Agent MOR :</p>
              </div>

              {/* Score and stats breakdown */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-3xl border border-border">
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80">Diagnostic Score</span>
                  <p className="text-3xl font-black text-primary font-mono">{score} <span className="text-xs text-muted-foreground/60">/ {selectedCase.questions.length * 100}</span></p>
                </div>
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80">Statut Patient</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${patientState?.status === "stable" ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                    <span className={`text-xs font-black uppercase tracking-wider ${patientState?.status === "stable" ? "text-emerald-500" : "text-rose-500"}`}>
                      {patientState?.status === "stable" ? "STABILISÉ ✅" : "CRITIQUE 🚨"}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/90 leading-relaxed font-medium px-4">
                {score >= selectedCase.questions.length * 75
                  ? " Félicitations Docteur ! Votre esprit d'analyse clinique et votre réactivité ont permis de stabiliser et sauver le patient dans le respect total des recommandations médicales."
                  : " Attention Confrère : des choix thérapeutiques non conformes ou dangereux ont ralenti la prise en charge. Prenez le temps de bien relire les fiches explicatives pour éviter ces écueils au lit du patient."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => startCase(selectedCase)} 
                  variant="outline" 
                  className="w-full h-12 rounded-full font-bold gap-2 text-xs border-border"
                >
                  <RotateCcw className="h-4 w-4" /> Recommencer le Cas
                </Button>
                <Button 
                  onClick={() => setSelectedCase(null)} 
                  className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg shadow-primary/10"
                >
                  Retour aux Cas ECOS
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* CLINICAL INTERACTIVE SIMULATOR */
          <motion.div
            key="simulation-room"
            initial={{ opacity: 0, y: 15 }}
            animate={isShaking ? {
              x: [-6, 6, -6, 6, -3, 3, 0],
              y: [-3, 3, -3, 3, -1, 1, 0],
              boxShadow: "0 0 45px rgba(239, 68, 68, 0.25)"
            } : { opacity: 1, y: 0 }}
            transition={isShaking ? { duration: 0.22, repeat: 1 } : { duration: 0.3 }}
            exit={{ opacity: 0, y: -15 }}
            className={cn(
              "grid lg:grid-cols-12 gap-6 pt-2 transition-all duration-300",
              isUrgencyMode && timeLeft <= 15 && !hasAnswered && "border-2 border-rose-500/40 rounded-[3rem] p-3 bg-rose-950/10 shadow-[0_0_55px_rgba(239,68,68,0.25)] animate-pulse"
            )}
          >
            {/* LEFT COLUMN: ECG and patient constants (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <EcgMonitor 
                bpm={patientState?.bpm || 0}
                spo2={patientState?.spo2 || 95}
                bloodPressure={patientState?.bloodPressure || "120/80"}
                temperature={patientState?.temperature || 36.8}
                isStable={patientState?.isStable || true}
                status={patientState?.status || "stable"}
              />

              {/* History brief */}
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Anamnèse Initiale
                </h4>
                <p className="text-xs text-muted-foreground/90 leading-relaxed font-medium">
                  {selectedCase.scenario}
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                  <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-wider">{selectedCase.specialty}</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase">Étape {currentStep + 1} / {selectedCase.questions.length}</Badge>
                </div>
              </Card>
            </div>

            {/* MIDDLE COLUMN: Case decisions and Question Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 shadow-xl rounded-[2.5rem] overflow-hidden flex flex-col h-full">
                <div className="h-1.5 w-full bg-muted/20">
                  <motion.div 
                    className="h-full bg-primary" 
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / selectedCase.questions.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                <CardContent className="p-6 md:p-8 space-y-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-muted-foreground/75 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-primary" /> Décision Thérapeutique
                      </span>
                      {isUrgencyMode && !hasAnswered && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[10px] font-black transition-all duration-300",
                          timeLeft <= 15
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                            : "bg-primary/5 border-primary/20 text-primary"
                        )}>
                          <Timer className="h-3.5 w-3.5 animate-[spin_4s_linear_infinite]" />
                          <span>CHRONO : {timeLeft}s</span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-foreground leading-relaxed text-base md:text-lg">
                      {selectedCase.questions[currentStep].text}
                    </h3>

                    {/* Choices Stagger List */}
                    <div className="grid gap-3 pt-2">
                      {selectedCase.questions[currentStep].options.map((option, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = idx === selectedCase.questions[currentStep].correct;
                        const isDangerous = idx === selectedCase.questions[currentStep].dangerous;

                        return (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, type: "spring", stiffness: 120 }}
                            disabled={hasAnswered}
                            onClick={() => handleAnswerSubmit(idx)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all text-xs font-semibold flex items-center justify-between ${
                              hasAnswered && isCorrect
                                ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                                : hasAnswered && isSelected && !isCorrect
                                ? isDangerous 
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                                : isSelected
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-border-hover hover:bg-muted/30 text-foreground/90"
                            }`}
                          >
                            <div className="flex items-start gap-3.5 pr-2">
                              <span className={`flex-shrink-0 h-6.5 w-6.5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                hasAnswered && isCorrect
                                  ? "bg-green-500 text-white"
                                  : hasAnswered && isSelected && !isCorrect
                                  ? "bg-rose-500 text-white"
                                  : isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {hasAnswered && isCorrect ? <CheckCircle className="h-3.5 w-3.5" /> :
                                 hasAnswered && isSelected && !isCorrect ? <XCircle className="h-3.5 w-3.5" /> : letter}
                              </span>
                              <span className="pt-0.5 leading-relaxed">{option}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action step buttons */}
                  {hasAnswered && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-4 border-t border-border/50 flex flex-col space-y-3"
                    >
                      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-[11px] leading-relaxed text-muted-foreground/90 font-medium shadow-inner">
                        <span className="font-bold text-primary block mb-0.5">💡 Justification Médicale :</span>
                        {selectedCase.questions[currentStep].explanation}
                      </div>

                      <Button 
                        onClick={handleNextStep}
                        className="w-full h-11 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg shadow-primary/10 gap-1.5 transition-all self-end"
                      >
                        {currentStep < selectedCase.questions.length - 1 ? "Étape Suivante" : "Terminer la prise en charge"} 
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: AI Agent MOR Tutor Panel (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
              <Card className={`bg-card/45 backdrop-blur-2xl border rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-500 ${
                morStatus === "warning"
                  ? "border-rose-500/30 shadow-rose-500/5 animate-[pulse_2s_infinite]"
                  : morStatus === "success"
                  ? "border-green-500/20 shadow-green-500/5"
                  : "border-white/5"
              }`}>
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-xl ${
                      morStatus === "warning" ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                    }`}>
                      <Zap className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-foreground">Chef de Clinique IA</span>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider">
                    Agent MOR
                  </Badge>
                </div>

                <CardContent className="p-5 space-y-5">
                  {/* Mor Character Visual representation */}
                  <div className="flex items-center gap-3 bg-[#0c111d] p-3 rounded-2xl border border-white/5 shadow-inner">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                        MOR
                      </div>
                      <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c111d] ${
                        morStatus === "warning" ? "bg-rose-500 animate-ping" : "bg-green-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-foreground truncate">Agent MOR</p>
                      <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-widest">Tuteur Académique</p>
                    </div>
                  </div>

                  {/* Speech bubble */}
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed font-medium border relative ${
                    morStatus === "warning"
                      ? "bg-rose-500/5 border-rose-500/15 text-rose-600 dark:text-rose-400"
                      : morStatus === "success"
                      ? "bg-green-500/5 border-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-muted/40 border-border/50 text-muted-foreground/90"
                  }`}>
                    <p>{morComment}</p>
                  </div>

                  {/* Live clinic statistics feedback */}
                  <div className="space-y-3 pt-1 border-t border-border/40 text-[10px]">
                    <div className="flex justify-between items-center text-muted-foreground/80 font-bold uppercase tracking-wider">
                      <span>Précision de garde</span>
                      <span className="font-mono text-foreground font-black">{score} pts</span>
                    </div>
                    <Progress value={score ? (score / (selectedCase.questions.length * 100)) * 100 : 0} className="h-1 bg-muted" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EcosPage;
