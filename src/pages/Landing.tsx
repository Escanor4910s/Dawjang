// src/pages/Landing.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  CheckSquare,
  Layers,
  Target,
  Swords,
  FileText,
  Check,
  RotateCcw,
  ShieldCheck,
  Play,
  Pause,
  Film,
  Compass,
  FileUp,
  Mail,
  Phone,
  Award,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar, PlanTierIconBadge } from "@/components/UserAvatar";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";
import { HeroKineticBackdrop } from "@/components/landing/HeroKineticBackdrop";
import { cn } from "@/lib/utils";

type HeroSandboxTab = "qcm" | "probabilities" | "flashcard" | "redacteur";
type DocimologyDemoMode = "censure" | "groupage" | "jumelage";

interface DemoQcmPayload {
  tag: string;
  title: string;
  stemBlocks?: string[];
  options: Array<{ id: string; label: string; text: string; isCorrect: boolean }>;
  explanation: string;
}

const HERO_QCM_DEMOS: Record<DocimologyDemoMode, DemoQcmPayload> = {
  censure: {
    tag: "QCM DE CENSURE • TROUVER L'INTRUS",
    title:
      "Toutes les propositions suivantes concernant le Rétrécissement Mitral (RM) sont exactes, SAUF UNE. Indiquez laquelle :",
    options: [
      {
        id: "c-a",
        label: "A",
        text: "Le roulement diastolique disparaît lors du passage en fibrillation atriale.",
        isCorrect: false,
      },
      {
        id: "c-b",
        label: "B",
        text: "Un RM est considéré comme serré lorsque la surface mitrale est supérieure à 2,5 cm².",
        isCorrect: true,
      },
      {
        id: "c-c",
        label: "C",
        text: "L'œdème aigu du poumon d'effort traduit le retentissement pulmonaire en amont.",
        isCorrect: false,
      },
      {
        id: "c-d",
        label: "D",
        text: "La commissurotomie mitrale percutanée est le traitement de choix sur valves souples.",
        isCorrect: false,
      },
    ],
    explanation:
      "Exact (Réponse B) : un RM est serré lorsque la surface mitrale descend en dessous de 1,5 cm².",
  },
  groupage: {
    tag: "QCM PAR GROUPAGE • COMBINAISONS 1, 2, 3, 4",
    title:
      "Parmi les propositions suivantes sur l'Anémie par carence en fer, cochez la combinaison juste :",
    stemBlocks: [
      "1. C'est une anémie microcytaire (VGM < 80 fL) et arégénérative.",
      "2. La ferritinémie basse est le signe biologique le plus précoce.",
      "3. La capacité totale de fixation de la transferrine est diminuée.",
      "4. La recherche d'un saignement digestif ou gynécologique est systématique.",
    ],
    options: [
      {
        id: "g-a",
        label: "A",
        text: "Propositions 1 + 2 + 3",
        isCorrect: false,
      },
      {
        id: "g-b",
        label: "B",
        text: "Propositions 1 + 2 + 4",
        isCorrect: true,
      },
      {
        id: "g-c",
        label: "C",
        text: "Propositions 2 + 3 seulement",
        isCorrect: false,
      },
      {
        id: "g-d",
        label: "D",
        text: "Toutes les propositions (1 + 2 + 3 + 4)",
        isCorrect: false,
      },
    ],
    explanation:
      "Combinaison B (1 + 2 + 4) : la proposition 3 est fausse car la capacité totale de fixation est augmentée.",
  },
  jumelage: {
    tag: "QCM DE JUMELAGE • CAUSE À EFFET",
    title:
      "Analysez le lien entre ces deux phrases concernant l'Embolie Pulmonaire :",
    stemBlocks: [
      "I : Des D-dimères négatifs (< 500 µg/L) permettent d'écarter une embolie pulmonaire de probabilité faible",
      "PARCE QUE",
      "II : Les D-dimères ont une valeur prédictive négative très élevée (> 99%).",
    ],
    options: [
      {
        id: "j-a",
        label: "A",
        text: "I et II sont vraies avec une relation directe de cause à effet.",
        isCorrect: true,
      },
      {
        id: "j-b",
        label: "B",
        text: "I et II sont vraies mais sans relation de cause à effet.",
        isCorrect: false,
      },
      {
        id: "j-c",
        label: "C",
        text: "I est vraie, mais II est fausse.",
        isCorrect: false,
      },
      {
        id: "j-d",
        label: "D",
        text: "I est fausse, mais II est vraie.",
        isCorrect: false,
      },
    ],
    explanation:
      "Réponse A : la très forte valeur prédictive négative (II) explique directement pourquoi un test négatif élimine le diagnostic (I).",
  },
};

const TICKER_TRACK_TOP = [
  { code: "UCAD • FMPOS", detail: "Médecine, Pharmacie & Odontologie — Dakar" },
  { code: "UGB • UFR 2S", detail: "Sciences de la Santé — Saint-Louis" },
  { code: "UIDT • UFR SANTÉ", detail: "Université Iba Der Thiam — Thiès" },
  { code: "UASZ • SANTÉ", detail: "Université Assane Seck — Ziguinchor" },
  { code: "UADB • SANTÉ", detail: "Université Alioune Diop — Bambey" },
  { code: "EMS • DAKAR", detail: "École Militaire de Santé" },
];

const TICKER_TRACK_BOTTOM = [
  { code: "LICENCE 1 → MASTER 2", detail: "Socle Fondamental & Sémiologie" },
  { code: "DOCTORAT 1 → 3", detail: "Clinique, Thèse & Gardes Hospitalières" },
  { code: "INTERNAT DES HÔPITAUX", detail: "CHU Fann • Le Dantec • Dalal Jamm" },
  { code: "BANQUES D'ANNALES", detail: "1re Session, 2e Session & Partiels" },
  {
    code: "DOCIMOLOGIE OFFICIELLE",
    detail: "Censure • Groupage • Jumelage • Association",
  },
];

interface EcosystemCarouselItem {
  id: string;
  num: string;
  shortTitle: string;
  badge: string;
  metricValue: string;
  metricLabel: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  route: string;
  ctaLabel: string;
  icon: React.ElementType;
  fanAngle: number;
  fanX: number;
  fanY: number;
}

const ECOSYSTEM_CAROUSEL_ITEMS: EcosystemCarouselItem[] = [
  {
    id: "eco-qcm",
    num: "01",
    shortTitle: "Constructeur QCM",
    badge: "4 MODES • 6 FORMATS DOCIMOLOGIQUES",
    metricValue: "A → E",
    metricLabel: "Distribution aléatoire",
    title: "Constructeur QCM & Clonage d'Annales",
    subtitle:
      "Importez votre leçon et vos anciens sujets : DawJang imite la façon exacte dont vos enseignants posent leurs pièges.",
    description:
      "Choisissez entre un cours enregistré, un fichier importé, un texte libre ou un upload de masse d'anciens examens. Révisez sur les 6 formats officiels : Classique, Censure, Groupage, Jumelage et Association.",
    highlights: [
      "Répartition aléatoire A–E garantie",
      "3 niveaux cliniques progressifs",
      "Mode Examen chronométré intégré",
    ],
    route: "/quiz",
    ctaLabel: "Ouvrir le Constructeur QCM",
    icon: CheckSquare,
    fanAngle: -38,
    fanX: -260,
    fanY: 65,
  },
  {
    id: "eco-prob",
    num: "02",
    shortTitle: "Probabilités & Cibles",
    badge: "CIBLAGE DE FIN DE SEMESTRE",
    metricValue: "80 %",
    metricLabel: "Sur le Noyau Vital",
    title: "Probabilités de Sortie & Ciblage",
    subtitle:
      "Il vous reste 10 jours et 60 leçons à apprendre ? Découvrez immédiatement les 12 leçons qui tombent presque chaque année.",
    description:
      "Importez d'un coup toutes les leçons de votre module et vos sujets d'examens passés. Le moteur calcule combien de fois chaque chapitre est tombé et isole le Noyau Vital.",
    highlights: [
      "Historique des sorties 2018–2026",
      "Filtre du Noyau Vital (> 75%)",
      "QCM ou résumé ciblé en 1 clic",
    ],
    route: "/predictions",
    ctaLabel: "Calculer mes Probabilités",
    icon: Target,
    fanAngle: -23,
    fanX: -155,
    fanY: 28,
  },
  {
    id: "eco-redac",
    num: "03",
    shortTitle: "Le Rédacteur IA",
    badge: "SYNTHÈSE PAR OBJECTIFS",
    metricValue: "3 Paliers",
    metricLabel: "Objectifs ou Synthèse",
    title: "Le Rédacteur & Fiches par Objectifs",
    subtitle:
      "Transformez des diapos interminables en une fiche structurée, éditable comme sur Word et téléchargeable.",
    description:
      "Sélectionnez le mode « À partir des objectifs du cours » pour que chaque objectif soit intégralement développé. Redimensionnez votre feuille, surlignez l'essentiel et téléchargez votre fiche.",
    highlights: [
      "Développement de chaque objectif",
      "Feuille redimensionnable & outils Word",
      "Copie et téléchargement direct",
    ],
    route: "/summaries",
    ctaLabel: "Ouvrir Le Rédacteur",
    icon: FileText,
    fanAngle: -8,
    fanX: -52,
    fanY: 6,
  },
  {
    id: "eco-flash",
    num: "04",
    shortTitle: "Flashcards",
    badge: "MÉMORISATION DURABLE",
    metricValue: "94,2 %",
    metricLabel: "Rétention aux partiels",
    title: "Flashcards Calibrées sur vos Erreurs",
    subtitle:
      "Ne révisez plus ce que vous savez déjà : concentrez-vous sur les points qui vous font perdre des points.",
    description:
      "Créez vos propres catégories (Nœuds), ou laissez DawJang transformer automatiquement vos erreurs de QCM et les objectifs de vos cours en cartes recto-verso.",
    highlights: [
      "Création libre de vos Nœuds",
      "Génération depuis vos erreurs QCM",
      "Ancrage mémoriel longue durée",
    ],
    route: "/flashcards",
    ctaLabel: "Explorer mes Flashcards",
    icon: Layers,
    fanAngle: 8,
    fanX: 52,
    fanY: 6,
  },
  {
    id: "eco-duels",
    num: "05",
    shortTitle: "Arène des Duels",
    badge: "TEMPS RÉEL ENTRE PAIRS",
    metricValue: "15s → 60s",
    metricLabel: "Cadence Blitz à Maître",
    title: "Duels en Ligne & Salons Privés",
    subtitle:
      "Affrontez vos camarades de promotion sur vos propres QCM avec un chronomètre de 15 à 60 secondes.",
    description:
      "Choisissez votre banque de QCM, réglez la cadence du compte à rebours (Blitz 15s, Turbo 30s, Tactique 45s ou Maître 60s), puis créez un salon privé par code.",
    highlights: [
      "Salons privés par code instantané",
      "Radar d'attente & lancement direct",
      "Podium final & classement ELO",
    ],
    route: "/duels",
    ctaLabel: "Rejoindre l'Arène",
    icon: Swords,
    fanAngle: 23,
    fanX: 155,
    fanY: 28,
  },
  {
    id: "eco-membre",
    num: "06",
    shortTitle: "Carte Membre",
    badge: "CARTE MEMBRE • 30 MÉDAILLES",
    metricValue: "30 Sceaux",
    metricLabel: "Décorations & Mentor MOR",
    title: "Carte Membre Officielle & Professeur MOR",
    subtitle:
      "Votre Carte Membre évolue à chaque session accomplie et porte votre sceau (Initié, Taoïste ou Napoléon).",
    description:
      "Gravissez les paliers d'expérience de 500 XP à 1 000 000 XP, épinglez vos décorations militaires sur votre Carte Membre et interrogez le Professeur MOR connecté au Web.",
    highlights: [
      "Carte Membre à médailles épinglées",
      "XP crédités en direct à chaque action",
      "Professeur MOR Web & Voix 24h/24",
    ],
    route: "/settings",
    ctaLabel: "Consulter ma Carte Membre",
    icon: Award,
    fanAngle: 38,
    fanX: 260,
    fanY: 65,
  },
];

function getCircularOffset(
  itemIndex: number,
  activeIndex: number,
  total: number
): number {
  let diff = (itemIndex - activeIndex) % total;
  if (diff > total / 2) diff -= total;
  if (diff <= -total / 2) diff += total;
  return diff;
}

/**
 * COMPOSANT DE TITRE EN ÉCHELLE AVEC VIREMENT 3D DU DÉBUT JUSQU'À LA FIN
 * Chaque mot descend comme un barreau d'échelle et effectue un virement 3D
 * séquencé de gauche à droite dès que la section entre dans le champ visuel.
 */
function LadderFlipHeading({
  words,
  active,
  className,
}: {
  words: Array<{ text: string; highlight?: boolean }>;
  active: boolean;
  className?: string;
}) {
  return (
    <h2
      style={{ perspective: "1100px" }}
      className={cn(
        "dawjang-editorial-serif flex flex-wrap items-center justify-center gap-x-[0.28em] gap-y-1",
        className
      )}
    >
      {words.map((w, idx) => (
        <span
          key={`${w.text}-${idx}`}
          style={{
            display: "inline-block",
            transformOrigin: "50% 100%",
            transition: `transform 0.78s cubic-bezier(0.16, 1, 0.3, 1) ${
              idx * 85
            }ms, opacity 0.6s ease ${idx * 85}ms, filter 0.6s ease ${
              idx * 85
            }ms`,
            transform: active
              ? "translate3d(0, 0px, 0px) rotateX(0deg) rotateZ(0deg) scale(1)"
              : `translate3d(0, ${28 + idx * 6}px, -65px) rotateX(-88deg) rotateZ(-7deg) scale(0.92)`,
            opacity: active ? 1 : 0,
            filter: active ? "blur(0px)" : "blur(4px)",
          }}
          className={cn(
            w.highlight
              ? "text-[#C96442] italic"
              : "text-[#141413] dark:text-white"
          )}
        >
          {w.text}
        </span>
      ))}
    </h2>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [heroExitRatio, setHeroExitRatio] = useState(0);

  // États Démonstrateur Hero
  const [sandboxTab, setSandboxTab] = useState<HeroSandboxTab>("qcm");
  const [docimologyMode, setDocimologyMode] =
    useState<DocimologyDemoMode>("censure");
  const [selectedOptId, setSelectedOptId] = useState<string>("c-b");
  const [qcmValidated, setQcmValidated] = useState<boolean>(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [xpPop, setXpPop] = useState<number | null>(null);
  const [daysRemainingSlider, setDaysRemainingSlider] = useState(10);

  // États Chorégraphie Section Vidéo (Phase 0: attente, Phase 1: bouton Play géant, Phase 2: tracé des lignes, Phase 3: complet)
  const videoSectionRef = useRef<HTMLElement | null>(null);
  const [videoStage, setVideoStage] = useState<0 | 1 | 2 | 3>(0);
  const [isVideoPreviewPlaying, setIsVideoPreviewPlaying] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // États Chorégraphie Section Écosystème (Phase 0: hors-champ, Phase 1: Éventail déployé, Phase 2: Encastré en Carrousel Konami)
  const carouselSectionRef = useRef<HTMLElement | null>(null);
  const [ecoStage, setEcoStage] = useState<"hidden" | "fan" | "locked">(
    "hidden"
  );
  const [carouselIdx, setCarouselIdx] = useState<number>(0);
  const [carouselPaused, setCarouselPaused] = useState<boolean>(false);
  const [isCarouselInViewport, setIsCarouselInViewport] =
    useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);

  // État Chorégraphie Footer
  const footerRef = useRef<HTMLElement | null>(null);
  const [footerVisible, setFooterVisible] = useState(false);

  // Modal pour "Nous contacter / Support"
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const totalItems = ECOSYSTEM_CAROUSEL_ITEMS.length;

  const handlePrevCarousel = useCallback(() => {
    setCarouselIdx((prev) => (prev - 1 + totalItems) % totalItems);
  }, [totalItems]);

  const handleNextCarousel = useCallback(() => {
    setCarouselIdx((prev) => (prev + 1) % totalItems);
  }, [totalItems]);

  // Suivi continu du défilement pour le rétrécissement 3D de la Hero Section
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 16);
      const ratio = Math.min(1, Math.max(0, y / 680));
      setHeroExitRatio(ratio);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Séquenceur de la Transition 2 : SECTION VIDÉO (Bouton Play -> Agrandissement -> Lignes -> Complet)
  useEffect(() => {
    const el = videoSectionRef.current;
    if (!el) return;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideoStage(1); // 1. Le bouton Play/Pause apparaît et le cadre s'agrandit
          t1 = setTimeout(() => setVideoStage(2), 340); // 2. Les lignes architecturales se tracent
          t2 = setTimeout(() => setVideoStage(3), 860); // 3. L'interface complète se verrouille
        } else {
          setVideoStage(0);
        }
      },
      { threshold: 0.22 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Séquenceur de la Transition 3 : SECTION ÉCOSYSTÈME (Éventail -> Encastrement Konami)
  useEffect(() => {
    const el = carouselSectionRef.current;
    if (!el) return;
    let fanTimer: ReturnType<typeof setTimeout>;

    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsCarouselInViewport(entry.isIntersecting);
        if (entry.isIntersecting) {
          // Déploie d'abord les 6 piliers en Éventail, puis les encastre dans le Carrousel Konami !
          setEcoStage("fan");
          fanTimer = setTimeout(() => {
            setEcoStage("locked");
          }, 920);
        } else {
          setEcoStage("hidden");
        }
      },
      { threshold: 0.18 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(fanTimer);
    };
  }, []);

  // Séquenceur de la Transition 4 : PIED DE PAGE
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setFooterVisible(entry.isIntersecting);
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Rotation automatique du carrousel uniquement une fois l'éventail encastré
  useEffect(() => {
    if (carouselPaused || !isCarouselInViewport || ecoStage !== "locked")
      return;
    const timer = setInterval(() => {
      handleNextCarousel();
    }, 6000);
    return () => clearInterval(timer);
  }, [carouselPaused, isCarouselInViewport, ecoStage, handleNextCarousel]);

  // Navigation clavier Gauche / Droite
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isCarouselInViewport) return;
      if (e.key === "ArrowLeft") handlePrevCarousel();
      if (e.key === "ArrowRight") handleNextCarousel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCarouselInViewport, handlePrevCarousel, handleNextCarousel]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) handlePrevCarousel();
      else handleNextCarousel();
    }
    touchStartXRef.current = null;
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomVideoUrl(url);
  };

  const activeQcm = HERO_QCM_DEMOS[docimologyMode];

  const handleSwitchDocimology = (nextMode: DocimologyDemoMode) => {
    setDocimologyMode(nextMode);
    setQcmValidated(false);
    setSelectedOptId(HERO_QCM_DEMOS[nextMode].options[0]?.id || "");
  };

  const triggerDemoXp = (amount: number) => {
    setXpPop(amount);
    setTimeout(() => setXpPop(null), 1800);
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF9F5] dark:bg-[#111110] text-[#141413] dark:text-[#F5F3EE] selection:bg-[#C96442]/20 selection:text-[#C96442] overflow-x-hidden relative">
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .dawjang-landing-font {
          font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .dawjang-editorial-serif {
          font-family: 'Fraunces', Georgia, serif;
        }

        @keyframes dawjangTickerLTR {
          0% { transform: translate3d(-50%, 0, 0); }
          100% { transform: translate3d(0%, 0, 0); }
        }
        @keyframes dawjangTickerRTL {
          0% { transform: translate3d(0%, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-ticker-ltr {
          display: flex;
          width: max-content;
          animation: dawjangTickerLTR 38s linear infinite;
        }
        .animate-ticker-rtl {
          display: flex;
          width: max-content;
          animation: dawjangTickerRTL 42s linear infinite;
        }
        .animate-ticker-ltr:hover,
        .animate-ticker-rtl:hover {
          animation-play-state: paused;
        }

        @keyframes dawjangWingFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .dawjang-wing-float {
          animation: dawjangWingFloat 4.2s ease-in-out infinite;
        }

        .dawjang-konami-stage {
          --konami-near-x: 24%;
          --konami-far-x: 42%;
          --konami-near-z: -150px;
          --konami-far-z: -290px;
          --konami-near-rot: -18deg;
          --konami-far-rot: -28deg;
          --pill-step-1: 152px;
          --pill-step-2: 295px;
        }
        @media (min-width: 640px) {
          .dawjang-konami-stage {
            --konami-near-x: 42%;
            --konami-far-x: 72%;
            --konami-near-z: -135px;
            --konami-far-z: -265px;
            --konami-near-rot: -22deg;
            --konami-far-rot: -34deg;
            --pill-step-1: 195px;
            --pill-step-2: 380px;
          }
        }
        @media (min-width: 1024px) {
          .dawjang-konami-stage {
            --konami-near-x: 55%;
            --konami-far-x: 92%;
            --konami-near-z: -125px;
            --konami-far-z: -250px;
            --konami-near-rot: -24deg;
            --konami-far-rot: -36deg;
            --pill-step-1: 215px;
            --pill-step-2: 420px;
          }
        }

        @keyframes dawjangDrawUnderline {
          from { stroke-dashoffset: 320; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw-path {
          stroke-dasharray: 320;
          stroke-dashoffset: 320;
          animation: dawjangDrawUnderline 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
        }
      `}</style>

      {/* =====================================================================
          1. HEADER 100% RESPONSIVE
         ===================================================================== */}
      <header
        className={cn(
          "dawjang-landing-font sticky top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "border-b border-[#E5E2DC]/90 dark:border-white/10 bg-[#FAF9F5]/92 dark:bg-[#111110]/92 backdrop-blur-xl py-2.5 sm:py-3 shadow-[0_8px_30px_rgba(20,20,19,0.05)]"
            : "bg-transparent py-3.5 sm:py-5"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-2 sm:gap-4">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 sm:gap-2.5 focus:outline-none shrink-0"
          >
            <DawJangDragonIcon className="h-8 w-8 sm:h-9 sm:w-9 text-foreground transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <DawJangWordmark size="sm" className="sm:hidden" />
              <DawJangWordmark size="md" className="hidden sm:block" />
              <span className="text-[9.5px] sm:text-[10.5px] font-medium text-muted-foreground leading-none mt-0.5">
                Studio Académique
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 rounded-full border border-[#E5E2DC] dark:border-white/12 bg-white/85 dark:bg-[#1A1917]/85 backdrop-blur-md px-2 py-1 shadow-2xs">
            <a
              href="#hero-sandbox"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#5E5D59] dark:text-white/75 hover:text-[#141413] dark:hover:text-white hover:bg-[#F3F0E8] dark:hover:bg-white/10 transition-colors"
            >
              Démonstrateur
            </a>
            <a
              href="#video-demo"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#5E5D59] dark:text-white/75 hover:text-[#141413] dark:hover:text-white hover:bg-[#F3F0E8] dark:hover:bg-white/10 transition-colors"
            >
              Film de présentation
            </a>
            <a
              href="#ecosystem-carousel"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#5E5D59] dark:text-white/75 hover:text-[#141413] dark:hover:text-white hover:bg-[#F3F0E8] dark:hover:bg-white/10 transition-colors"
            >
              Écosystème (6 Piliers)
            </a>
            <Link
              to="/tarifs"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[#C96442] hover:bg-[#C96442]/10 transition-colors"
            >
              Plans & Emblèmes
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/tarifs"
              className="lg:hidden rounded-xl border border-[#C96442]/35 bg-[#C96442]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#C96442]"
            >
              Plans
            </Link>
            <UserAvatar inHeader={true} />
            <ThemeToggle />

            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#141413] dark:bg-[#C96442] text-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-[#C96442] dark:hover:bg-[#b55535] transition-all"
            >
              <span>Mon Studio</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. HERO SECTION AVEC RECUL PERSPECTIF 3D AU DÉFILEMENT (TRANSITION 1)
         ===================================================================== */}
      <section
        style={{
          transform: `perspective(1400px) scale(${
            1 - heroExitRatio * 0.055
          }) translateY(${heroExitRatio * 24}px) rotateX(${
            heroExitRatio * 4.5
          }deg)`,
          opacity: 1 - heroExitRatio * 0.28,
          transformOrigin: "50% 85%",
          transition: "transform 0.12s ease-out, opacity 0.12s ease-out",
        }}
        className="dawjang-landing-font relative pt-4 pb-14 sm:pt-8 sm:pb-20 lg:pt-12 lg:pb-26 overflow-hidden"
      >
        <HeroKineticBackdrop />

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-start">
            <div className="lg:col-span-5 space-y-5 sm:space-y-6 pt-1 sm:pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#C96442]/35 bg-white/90 dark:bg-[#1B1A18]/90 backdrop-blur-md px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#C96442] shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#C96442] animate-pulse shrink-0" />
                <span className="truncate">
                  De la Licence 1 au Doctorat — Tout votre semestre unifié
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="dawjang-editorial-serif text-[34px] sm:text-[48px] lg:text-[52px] font-normal tracking-[-0.025em] leading-[1.06] text-[#141413] dark:text-[#FAF9F5]">
                  Révisez exactement{" "}
                  <span className="relative inline-block text-[#C96442] italic">
                    ce qui tombe
                    <svg
                      viewBox="0 0 320 18"
                      fill="none"
                      className="pointer-events-none absolute -bottom-1.5 left-0 w-full h-3 text-[#C96442]"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 13.5C78 4.5 215 2.5 316 11.5"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        className="animate-draw-path"
                      />
                    </svg>
                  </span>{" "}
                  le jour de l'examen.
                </h1>

                <p className="text-[14.5px] sm:text-[16px] text-[#5E5D59] dark:text-white/75 leading-[1.62] pt-1">
                  Déposez vos cours et vos anciens sujets d'examens.{" "}
                  <strong className="font-semibold text-[#141413] dark:text-white">
                    DawJang
                  </strong>{" "}
                  rédige vos fiches de révision, repère les leçons les plus
                  fréquentes et crée des QCM identiques à ceux de vos
                  professeurs.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#C96442] hover:bg-[#b55535] text-white px-5 py-3.5 sm:px-6 sm:py-4 text-[14.5px] font-semibold shadow-[0_14px_34px_-8px_rgba(201,100,66,0.45)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span>Entrer dans mon Studio</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>

                <Link
                  to="/tarifs"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D8D4CC] dark:border-white/15 bg-white/90 dark:bg-[#1A1917]/90 backdrop-blur-md hover:border-[#141413] dark:hover:border-white/40 px-5 py-3.5 sm:py-4 text-[14px] font-semibold text-[#141413] dark:text-white transition-all"
                >
                  <span>Découvrir les Plans</span>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-[#E5E2DC]/90 dark:border-white/10">
                <div className="rounded-xl border border-[#E5E2DC]/90 dark:border-white/10 bg-white/85 dark:bg-[#181715]/85 backdrop-blur-md p-2.5 sm:p-3 shadow-2xs">
                  <span className="font-serif text-[15px] sm:text-lg font-semibold text-[#141413] dark:text-white block">
                    Fiches Claires
                  </span>
                  <span className="text-[10.5px] sm:text-[11.5px] text-[#6E6D68] dark:text-white/60 leading-snug block mt-0.5">
                    Résumés propres de vos cours
                  </span>
                </div>
                <div className="rounded-xl border border-[#C96442]/35 bg-white/90 dark:bg-[#181715]/90 backdrop-blur-md p-2.5 sm:p-3 shadow-2xs">
                  <span className="font-serif text-[15px] sm:text-lg font-semibold text-[#C96442] block">
                    Vrais QCM
                  </span>
                  <span className="text-[10.5px] sm:text-[11.5px] text-[#6E6D68] dark:text-white/60 leading-snug block mt-0.5">
                    Inspirés de vos examens
                  </span>
                </div>
                <div className="rounded-xl border border-[#E5E2DC]/90 dark:border-white/10 bg-white/85 dark:bg-[#181715]/85 backdrop-blur-md p-2.5 sm:p-3 shadow-2xs">
                  <span className="font-serif text-[15px] sm:text-lg font-semibold text-[#141413] dark:text-white block">
                    Gain de Temps
                  </span>
                  <span className="text-[10.5px] sm:text-[11.5px] text-[#6E6D68] dark:text-white/60 leading-snug block mt-0.5">
                    Cible les sujets fréquents
                  </span>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : STUDIO INTERACTIF EN DIRECT */}
            <div id="hero-sandbox" className="lg:col-span-7 relative w-full">
              {xpPop && (
                <div className="pointer-events-none absolute -top-3 right-3 sm:right-6 z-30 flex items-center gap-2 rounded-2xl border border-[#C96442] bg-[#141413] text-white px-3.5 py-1.5 shadow-xl animate-bounce">
                  <Sparkles className="h-3.5 w-3.5 text-[#C96442]" />
                  <span className="font-mono text-xs font-bold text-[#C96442]">
                    +{xpPop} XP
                  </span>
                </div>
              )}

              <div className="rounded-[22px] sm:rounded-[28px] border border-[#DEDAD0] dark:border-white/15 bg-white/95 dark:bg-[#181715]/95 backdrop-blur-xl shadow-[0_28px_70px_-20px_rgba(20,20,19,0.16)] overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#EAE6DF] dark:border-white/10 bg-[#F6F4EE] dark:bg-[#141312] px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C96442]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-[#5E5D59] dark:text-white/70 pl-1 truncate">
                      STUDIO INTERACTIF — TESTEZ EN DIRECT
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-1 rounded-xl border border-[#E2DFD7] dark:border-white/10 bg-white dark:bg-[#1E1D1B] p-1">
                    {[
                      { id: "qcm" as const, label: "QCM", icon: CheckSquare },
                      {
                        id: "probabilities" as const,
                        label: "Probabilités",
                        icon: Target,
                      },
                      {
                        id: "flashcard" as const,
                        label: "Flashcards",
                        icon: Layers,
                      },
                      {
                        id: "redacteur" as const,
                        label: "Résumés",
                        icon: FileText,
                      },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = sandboxTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSandboxTab(tab.id)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] sm:text-[12px] font-semibold transition-all",
                            active
                              ? "bg-[#141413] dark:bg-[#C96442] text-white shadow-2xs"
                              : "text-[#6E6D68] dark:text-white/60 hover:text-[#141413] dark:hover:text-white"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sandboxTab === "qcm" && (
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE6DF] dark:border-white/10 pb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(
                          [
                            { id: "censure", label: "Censure" },
                            { id: "groupage", label: "Groupage" },
                            { id: "jumelage", label: "Jumelage" },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSwitchDocimology(m.id)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-[11px] sm:text-[11.5px] font-semibold transition-all",
                              docimologyMode === m.id
                                ? "border-[#C96442] bg-[#C96442]/12 text-[#C96442]"
                                : "border-[#E5E2DC] dark:border-white/15 bg-[#FAF9F5] dark:bg-white/5 text-[#5E5D59] dark:text-white/70"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-[#C96442]">
                        {activeQcm.tag}
                      </span>
                    </div>

                    <h3 className="dawjang-editorial-serif text-[16px] sm:text-[19px] text-[#141413] dark:text-white leading-snug">
                      {activeQcm.title}
                    </h3>

                    {activeQcm.stemBlocks && (
                      <div className="rounded-xl border border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-white/[0.03] p-3.5 space-y-1.5">
                        {activeQcm.stemBlocks.map((b, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "text-[12.5px] leading-relaxed",
                              b === "PARCE QUE"
                                ? "font-mono text-[10.5px] font-bold uppercase tracking-widest text-[#C96442] text-center py-0.5"
                                : "text-[#141413] dark:text-white/90 font-medium"
                            )}
                          >
                            {b}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {activeQcm.options.map((opt) => {
                        const isSelected = selectedOptId === opt.id;
                        const showRight = qcmValidated && opt.isCorrect;
                        const showWrong =
                          qcmValidated && isSelected && !opt.isCorrect;

                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              if (!qcmValidated) setSelectedOptId(opt.id);
                            }}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150",
                              showRight
                                ? "border-emerald-600 bg-emerald-500/10"
                                : showWrong
                                ? "border-rose-600 bg-rose-500/10"
                                : isSelected
                                ? "border-[#C96442] bg-[#C96442]/[0.07]"
                                : "border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5]/60 dark:bg-white/[0.02]"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-bold mt-0.5",
                                showRight
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : showWrong
                                  ? "border-rose-600 bg-rose-600 text-white"
                                  : isSelected
                                  ? "border-[#C96442] bg-[#C96442] text-white"
                                  : "border-[#D8D4CC] dark:border-white/20 bg-white dark:bg-[#1E1D1B]"
                              )}
                            >
                              {opt.label}
                            </span>
                            <span className="text-[12.5px] sm:text-[13.5px] text-[#141413] dark:text-white/90 leading-relaxed">
                              {opt.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {qcmValidated && (
                      <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] p-3.5 text-[12.5px] leading-relaxed">
                        <strong className="font-semibold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                          Explication :
                        </strong>
                        {activeQcm.explanation}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EAE6DF] dark:border-white/10">
                      <span className="text-[11.5px] text-[#6E6D68] dark:text-white/60">
                        Sélectionnez une réponse puis validez
                      </span>
                      {qcmValidated ? (
                        <button
                          type="button"
                          onClick={() => setQcmValidated(false)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D4CC] dark:border-white/15 px-3 py-1.5 text-[12px] font-semibold"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Réessayer</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setQcmValidated(true);
                            triggerDemoXp(20);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C96442] text-white px-3.5 py-2 text-[12px] font-semibold shadow-sm hover:bg-[#b55535]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Valider (+20 XP)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {sandboxTab === "probabilities" && (
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#C96442]/30 bg-[#C96442]/[0.06] p-3.5">
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase text-[#C96442] block">
                          CIBLAGE DE FIN DE SEMESTRE
                        </span>
                        <h4 className="dawjang-editorial-serif text-base sm:text-lg">
                          À{" "}
                          <strong className="text-[#C96442]">
                            {daysRemainingSlider} jours
                          </strong>{" "}
                          de l'examen : révisez les{" "}
                          <strong className="underline">
                            {Math.max(
                              6,
                              Math.round(daysRemainingSlider * 1.2)
                            )}{" "}
                            leçons vitales
                          </strong>
                          .
                        </h4>
                      </div>
                      <div className="w-full sm:w-36 shrink-0">
                        <input
                          type="range"
                          min={3}
                          max={25}
                          value={daysRemainingSlider}
                          onChange={(e) =>
                            setDaysRemainingSlider(Number(e.target.value))
                          }
                          className="w-full accent-[#C96442] cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[
                        {
                          rank: 1,
                          title: "1-Anémies : Diagnostic et prise en charge",
                          freq: "Tombé 7 fois aux examens",
                          prob: "96%",
                        },
                        {
                          rank: 2,
                          title: "Thrombophlébite & Embolie pulmonaire",
                          freq: "Fréquent en 1re et 2e session",
                          prob: "93%",
                        },
                        {
                          rank: 3,
                          title: "Rétrécissement mitral & Valvulopathies",
                          freq: "Classique de Cardiologie",
                          prob: "89%",
                        },
                      ].map((item) => (
                        <div
                          key={item.rank}
                          className="rounded-xl border border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-white/[0.02] p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] font-bold text-[#C96442] block">
                              Priorité #{item.rank} • {item.freq}
                            </span>
                            <h5 className="text-[13.5px] font-semibold truncate mt-0.5">
                              {item.title}
                            </h5>
                          </div>
                          <span className="font-mono text-xl font-bold text-[#C96442] shrink-0">
                            {item.prob}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sandboxTab === "flashcard" && (
                  <div className="p-4 sm:p-6">
                    <div
                      onClick={() => {
                        setCardFlipped(!cardFlipped);
                        triggerDemoXp(15);
                      }}
                      className="cursor-pointer rounded-2xl border-2 border-[#E5E2DC] dark:border-white/15 bg-[#FAF9F5] dark:bg-[#1E1D1B] p-5 sm:p-6 min-h-[210px] flex flex-col justify-between transition-all hover:border-[#C96442]"
                    >
                      <div className="flex items-center justify-between border-b border-[#E5E2DC] dark:border-white/10 pb-2.5">
                        <span className="rounded-lg bg-[#C96442]/12 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#C96442]">
                          Carte Mémoire • Urgences
                        </span>
                        <span className="font-mono text-[10.5px] font-bold uppercase text-[#C96442]">
                          {cardFlipped ? "VERSO" : "RECTO • CLIQUEZ"}
                        </span>
                      </div>

                      {!cardFlipped ? (
                        <h4 className="dawjang-editorial-serif text-lg sm:text-xl my-auto py-4">
                          Quels sont les 3 signes cliniques rapides (qSOFA) qui
                          doivent faire suspecter un sepsis grave ?
                        </h4>
                      ) : (
                        <ul className="my-auto py-3 space-y-1.5 text-[13px] sm:text-[14px]">
                          <li>
                            • <strong>1. Pression artérielle systolique</strong>{" "}
                            ≤ 100 mmHg
                          </li>
                          <li>
                            • <strong>2. Fréquence respiratoire</strong> ≥ 22
                            cycles/min
                          </li>
                          <li>
                            • <strong>3. Confusion aiguë</strong> (Glasgow &lt;
                            15)
                          </li>
                        </ul>
                      )}

                      <span className="text-[11.5px] text-[#6E6D68] dark:text-white/60">
                        Cliquez sur la carte pour basculer Recto / Verso (+15
                        XP)
                      </span>
                    </div>
                  </div>
                )}

                {sandboxTab === "redacteur" && (
                  <div className="p-4 sm:p-6">
                    <div className="rounded-xl border border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-[#141312] p-4 sm:p-5 space-y-2.5 text-[13px] leading-relaxed">
                      <span className="rounded-md bg-[#C96442]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#C96442] inline-block">
                        FICHE GÉNÉRÉE À PARTIR DES OBJECTIFS DU COURS
                      </span>
                      <h4 className="dawjang-editorial-serif text-lg sm:text-xl">
                        Objectif 1 : Seuils d'hémoglobine définissant une anémie
                      </h4>
                      <p className="text-[#5E5D59] dark:text-white/80">
                        Baisse de l'hémoglobine sous les seuils physiologiques :{" "}
                        <mark className="rounded bg-[#C96442]/20 px-1.5 py-0.5 font-semibold text-[#141413] dark:text-white">
                          &lt; 13 g/dL chez l'homme
                        </mark>{" "}
                        et{" "}
                        <mark className="rounded bg-[#C96442]/20 px-1.5 py-0.5 font-semibold text-[#141413] dark:text-white">
                          &lt; 12 g/dL chez la femme
                        </mark>
                        .
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. BANDEROLE SLIM SUR FOND NOIR PROFOND & BLEU NUIT (#0B0F19)
         ===================================================================== */}
      <section className="dawjang-landing-font relative bg-[#0B0F17] text-[#FAF9F5] border-y border-white/10 py-3.5 overflow-hidden select-none shadow-[0_14px_40px_rgba(11,15,23,0.22)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-[#0B0F17] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-[#0B0F17] to-transparent z-10" />

        <div className="space-y-1.5">
          <div className="overflow-hidden">
            <div className="animate-ticker-ltr items-center gap-5 py-0.5">
              {[
                ...TICKER_TRACK_TOP,
                ...TICKER_TRACK_TOP,
                ...TICKER_TRACK_TOP,
              ].map((item, idx) => (
                <div
                  key={`top-${idx}`}
                  className="inline-flex items-center gap-2.5 shrink-0"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C96442]" />
                  <span className="font-mono text-[11.5px] font-bold tracking-wider text-white">
                    {item.code}
                  </span>
                  <span className="text-[11.5px] text-white/60">
                    {item.detail}
                  </span>
                  <span className="text-white/15 pl-2">/</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-white/[0.07]" />

          <div className="overflow-hidden">
            <div className="animate-ticker-rtl items-center gap-5 py-0.5">
              {[
                ...TICKER_TRACK_BOTTOM,
                ...TICKER_TRACK_BOTTOM,
                ...TICKER_TRACK_BOTTOM,
              ].map((item, idx) => (
                <div
                  key={`bot-${idx}`}
                  className="inline-flex items-center gap-2.5 shrink-0"
                >
                  <span className="h-1.5 w-1.5 rotate-45 bg-amber-400/80" />
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-[#FF7A52]">
                    {item.code}
                  </span>
                  <span className="text-[11.5px] text-white/65">
                    {item.detail}
                  </span>
                  <span className="text-white/15 pl-2">—</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. TRANSITION 2 : SECTION VIDÉO CHORÉGRAPHIÉE EN 3 TEMPS
             - Temps 1 : Le bouton Lecture/Pause surgit et agrandit l'ouverture
             - Temps 2 : Les 4 lignes architecturales se tracent autour du cadre
             - Temps 3 : La vidéo complète et les textes en échelle s'encastrent
         ===================================================================== */}
      <section
        id="video-demo"
        ref={videoSectionRef}
        className="dawjang-landing-font py-20 sm:py-28 max-w-6xl mx-auto px-4 sm:px-8 space-y-10 relative"
      >
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div
            style={{
              opacity: videoStage >= 1 ? 1 : 0,
              transform:
                videoStage >= 1 ? "translateY(0)" : "translateY(18px)",
              transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#C96442]/30 bg-white/80 dark:bg-white/5 px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#C96442]"
          >
            <Film className="h-3.5 w-3.5" />
            <span>PRÉSENTATION VIDÉO COMPLÈTE DU STUDIO</span>
          </div>

          <LadderFlipHeading
            active={videoStage >= 1}
            className="text-2xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.08]"
            words={[
              { text: "Immersion" },
              { text: "intégrale", highlight: true },
              { text: "au" },
              { text: "cœur" },
              { text: "de" },
              { text: "DawJang." },
            ]}
          />

          <p
            style={{
              opacity: videoStage >= 2 ? 1 : 0,
              transform:
                videoStage >= 2 ? "translateY(0)" : "translateY(14px)",
              transition: "all 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
            }}
            className="text-[14px] sm:text-[15.5px] text-[#5E5D59] dark:text-white/70"
          >
            Découvrez en conditions réelles l'ensemble des fonctionnalités de la
            plateforme à travers notre film de démonstration complet.
          </p>
        </div>

        {/* Châssis Vidéo à Expansion depuis le Bouton Play + Lignes Auto-tracées */}
        <div className="relative min-h-[360px] sm:min-h-[470px] flex items-center justify-center">
          {/* CALQUE SVG DES LIGNES ARCHITECTURALES QUI SE TRACENT AUTOUR DE LA VIDÉO */}
          <svg
            viewBox="0 0 1100 470"
            fill="none"
            preserveAspectRatio="none"
            className="pointer-events-none absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)] z-30"
            aria-hidden="true"
          >
            <rect
              x="6"
              y="6"
              width="1088"
              height="458"
              rx="34"
              stroke="#C96442"
              strokeWidth="2.4"
              strokeDasharray="3200"
              strokeDashoffset={videoStage >= 2 ? "0" : "3200"}
              style={{
                transition:
                  "stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </svg>

          {/* LE LECTEUR QUI S'AGRANDIT DEPUIS LE BOUTON PLAY CENTRAL */}
          <div
            style={{
              clipPath:
                videoStage === 0
                  ? "inset(38% 42% 38% 42% round 999px)"
                  : videoStage === 1
                  ? "inset(8% 10% 8% 10% round 40px)"
                  : "inset(0% 0% 0% 0% round 30px)",
              transform:
                videoStage === 0
                  ? "scale(0.84)"
                  : videoStage === 1
                  ? "scale(0.96)"
                  : "scale(1)",
              transition:
                "clip-path 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="relative w-full min-h-[360px] sm:min-h-[470px] rounded-[30px] border border-white/15 bg-gradient-to-br from-[#0B1120] via-[#13151C] to-[#1E1917] text-white overflow-hidden shadow-[0_34px_85px_-20px_rgba(11,17,32,0.55)] flex flex-col justify-between"
          >
            {customVideoUrl ? (
              <video
                src={customVideoUrl}
                controls
                autoPlay
                className="w-full h-[360px] sm:h-[470px] object-contain bg-black"
              />
            ) : (
              <>
                <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#C96442]/30 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />

                {/* Barre supérieure qui s'encastre au Temps 3 */}
                <div
                  style={{
                    opacity: videoStage >= 3 ? 1 : 0,
                    transform:
                      videoStage >= 3 ? "translateY(0)" : "translateY(-16px)",
                    transition: "all 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-white/[0.04] backdrop-blur-md"
                >
                  <div className="flex items-center gap-2">
                    <DawJangDragonIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    <span className="font-mono text-[10.5px] sm:text-xs font-semibold text-white/90 truncate">
                      FILM DE DÉMONSTRATION OFFICIEL • DAWJANG STUDIO
                    </span>
                  </div>
                  <span className="rounded-full border border-[#C96442]/50 bg-[#C96442]/20 px-2.5 py-0.5 font-mono text-[9.5px] sm:text-[10.5px] font-bold text-[#FF7A52]">
                    MISE EN LIGNE PROCHAINE
                  </span>
                </div>

                {/* Cœur du lecteur : Le Bouton Lecture/Pause qui amorce toute la transition */}
                <div className="relative z-10 my-auto p-6 sm:p-12 text-center space-y-5 max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setIsVideoPreviewPlaying(!isVideoPreviewPlaying)
                    }
                    style={{
                      transform:
                        videoStage === 1
                          ? "scale(1.32)"
                          : videoStage >= 2
                          ? "scale(1)"
                          : "scale(0.6)",
                      transition:
                        "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="mx-auto relative flex h-18 w-18 sm:h-22 sm:w-22 items-center justify-center rounded-full border-2 border-[#FF7A52] bg-[#C96442] text-white shadow-[0_0_65px_rgba(201,100,66,0.75)] hover:scale-105"
                    aria-label="Lecture / Pause"
                  >
                    <span className="pointer-events-none absolute -inset-3 rounded-full border border-[#FF7A52]/40 animate-ping" />
                    {isVideoPreviewPlaying ? (
                      <Pause className="h-8 w-8 fill-current" />
                    ) : (
                      <Play className="h-8 w-8 fill-current ml-1" />
                    )}
                  </button>

                  <div
                    style={{
                      opacity: videoStage >= 2 ? 1 : 0,
                      transform:
                        videoStage >= 2 ? "translateY(0)" : "translateY(20px)",
                      transition: "all 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="space-y-2"
                  >
                    <h3 className="dawjang-editorial-serif text-xl sm:text-3xl lg:text-4xl text-white">
                      Démonstration vidéo intégrale de l'écosystème
                    </h3>
                    <p className="text-[13.5px] sm:text-[15px] text-white/75 leading-relaxed">
                      Ce lecteur accueillera la vidéo complète présentant chaque
                      recoin de l'application (Bibliothèque, Rédacteur, QCM IA,
                      Mimétisme d'Annales, Probabilités, Duels et Professeur
                      MOR).
                    </p>
                  </div>

                  <div
                    style={{
                      opacity: videoStage >= 3 ? 1 : 0,
                      transform:
                        videoStage >= 3 ? "translateY(0)" : "translateY(14px)",
                      transition: "all 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="pt-1 flex justify-center"
                  >
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2.5 sm:px-5 sm:py-3 text-[12.5px] sm:text-[13px] font-semibold text-white transition-all"
                    >
                      <FileUp className="h-4 w-4 text-[#FF7A52]" />
                      <span>Charger un fichier vidéo</span>
                    </button>
                    <input
                      ref={videoFileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Pied du lecteur qui s'encastre au Temps 3 */}
                <div
                  style={{
                    opacity: videoStage >= 3 ? 1 : 0,
                    transform:
                      videoStage >= 3 ? "translateY(0)" : "translateY(16px)",
                    transition: "all 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  className="relative z-10 px-4 py-3 sm:px-6 border-t border-white/10 bg-black/35 flex items-center justify-between font-mono text-[10.5px] sm:text-[11px] text-white/60"
                >
                  <span>Lecteur Haute Définition</span>
                  <span>Visite complète</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. TRANSITION 3 : ÉCOSYSTÈME COMPLET L1 → DOCTORAT
             - Titre en Échelle avec Virement 3D du début jusqu'à la fin
             - Ouverture initiale en ÉVENTAIL RADIAL ("fan")
             - Puis ENCASTREMENT ("locked") dans le Carrousel 3D Konami
         ===================================================================== */}
      <section
        id="ecosystem-carousel"
        ref={carouselSectionRef}
        style={{ overflowAnchor: "none" }}
        onMouseEnter={() => setCarouselPaused(true)}
        onMouseLeave={() => setCarouselPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="dawjang-konami-stage dawjang-landing-font py-16 sm:py-24 bg-[#F3EFE6]/85 dark:bg-[#10131A] border-t border-[#E5E2DC] dark:border-white/10 relative overflow-hidden"
      >
        {/* Halo profond bleu nuit & terracotta */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[460px] w-[720px] rounded-full opacity-40 dark:opacity-30 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(201,100,66,0.38) 0%, rgba(15,23,42,0.28) 55%, transparent 78%)",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 space-y-8 sm:space-y-10">
          {/* 1. EN-TÊTE PRODUIT AVEC TEXTE EN ÉCHELLE & VIREMENT 3D */}
          <div className="text-center max-w-4xl mx-auto space-y-3">
            <div
              style={{
                opacity: ecoStage !== "hidden" ? 1 : 0,
                transform:
                  ecoStage !== "hidden" ? "translateY(0)" : "translateY(16px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#C96442]/30 bg-white/85 dark:bg-white/5 px-3.5 py-1 font-mono text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-[#C96442]"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>ÉCOSYSTÈME COMPLET L1 → DOCTORAT</span>
            </div>

            <LadderFlipHeading
              active={ecoStage !== "hidden"}
              className="text-2xl sm:text-4xl lg:text-[44px] tracking-tight leading-[1.08] lg:whitespace-nowrap"
              words={[
                { text: "Six" },
                { text: "instruments", highlight: true },
                { text: "conçus" },
                { text: "pour" },
                { text: "dominer" },
                { text: "vos" },
                { text: "examens." },
              ]}
            />

            <p
              style={{
                opacity: ecoStage !== "hidden" ? 1 : 0,
                transform:
                  ecoStage !== "hidden" ? "translateY(0)" : "translateY(16px)",
                transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.35s",
              }}
              className="text-[14px] sm:text-[15.5px] text-[#5E5D59] dark:text-white/70 max-w-2xl mx-auto leading-relaxed"
            >
              De la synthèse de vos polycopiés jusqu'au ciblage des sujets les
              plus probables, chaque module travaille en synergie pour maximiser
              vos résultats.
            </p>
          </div>

          {/* 2. BARRE DE PILULES EN CARROUSEL KONAMI CENTRÉ */}
          <div
            className="relative h-14 w-full max-w-4xl mx-auto flex items-center justify-center overflow-hidden select-none"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            }}
          >
            {ECOSYSTEM_CAROUSEL_ITEMS.map((item, idx) => {
              const diff = getCircularOffset(idx, carouselIdx, totalItems);
              const isCenter = diff === 0;
              const isNear = Math.abs(diff) === 1;
              const isFar = Math.abs(diff) === 2;
              const isBack = Math.abs(diff) >= 3;

              // En phase "fan" (éventail), les pilules s'écartent en arc avant de s'encastrer
              const pillTranslateX =
                ecoStage === "fan"
                  ? `${(idx - 2.5) * 145}px`
                  : isCenter
                  ? "0px"
                  : isNear
                  ? `calc(${diff} * var(--pill-step-1))`
                  : isFar
                  ? `calc(${diff} * var(--pill-step-2))`
                  : "0px";

              const pillTranslateY =
                ecoStage === "fan" ? `${Math.abs(idx - 2.5) * 8}px` : "0px";

              const pillScale = isCenter
                ? 1.04
                : isNear
                ? 0.94
                : isFar
                ? 0.85
                : 0.7;

              const pillOpacity =
                ecoStage === "hidden"
                  ? 0
                  : isCenter
                  ? 1
                  : isNear
                  ? 0.88
                  : isFar
                  ? 0.45
                  : 0;

              return (
                <button
                  key={`pill-${item.id}`}
                  type="button"
                  onClick={() => {
                    setEcoStage("locked");
                    setCarouselIdx(idx);
                  }}
                  style={{
                    transform: `translate3d(${pillTranslateX}, ${pillTranslateY}, 0) scale(${pillScale})`,
                    opacity: pillOpacity,
                    zIndex: isCenter ? 30 : isNear ? 20 : isFar ? 10 : 0,
                    pointerEvents: isBack ? "none" : "auto",
                    transition: isBack
                      ? "opacity 0.25s ease"
                      : "transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
                  }}
                  className={cn(
                    "absolute inline-flex items-center gap-2.5 rounded-full px-4 sm:px-5 py-2.5 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap",
                    isCenter
                      ? "bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shadow-[0_10px_28px_-6px_rgba(201,100,66,0.45)] ring-1 ring-[#C96442]/50"
                      : "bg-white/95 dark:bg-[#1E1D1B]/95 text-[#6E6D68] dark:text-white/70 border border-[#DEDAD0] dark:border-white/10 hover:border-[#C96442]"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0 transition-colors",
                      isCenter
                        ? "bg-[#C96442]"
                        : "bg-[#C8C4BC] dark:bg-white/30"
                    )}
                  />
                  <span>
                    {item.num}. {item.shortTitle}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. SCÈNE 3D : OUVERTURE EN ÉVENTAIL ("fan") PUIS ENCASTREMENT KONAMI ("locked") */}
          <div
            className="relative h-[495px] sm:h-[465px] w-full flex items-center justify-center select-none"
            style={{ perspective: "1500px" }}
          >
            <button
              type="button"
              onClick={() => {
                setEcoStage("locked");
                handlePrevCarousel();
              }}
              aria-label="Pilier précédent"
              className="absolute left-0 sm:left-2 z-40 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[#DEDAD0] dark:border-white/15 bg-white/95 dark:bg-[#1E1D1B]/95 text-[#141413] dark:text-white shadow-xl hover:bg-[#C96442] hover:text-white hover:border-[#C96442] hover:scale-105 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setEcoStage("locked");
                handleNextCarousel();
              }}
              aria-label="Pilier suivant"
              className="absolute right-0 sm:right-2 z-40 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[#DEDAD0] dark:border-white/15 bg-white/95 dark:bg-[#1E1D1B]/95 text-[#141413] dark:text-white shadow-xl hover:bg-[#C96442] hover:text-white hover:border-[#C96442] hover:scale-105 active:scale-95 transition-all"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {ECOSYSTEM_CAROUSEL_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const diff = getCircularOffset(idx, carouselIdx, totalItems);

              const isCenter = diff === 0;
              const isNearWing = Math.abs(diff) === 1;
              const isFarWing = Math.abs(diff) === 2;
              const isHiddenBack = Math.abs(diff) >= 3;

              // Positionnement selon l'étape de la transition :
              // - "hidden" : cartes rassemblées en paquet fermé en bas
              // - "fan"    : les 6 cartes s'ouvrent en grand ÉVENTAIL radial
              // - "locked" : les 6 cartes s'encastrent dans le Carrousel 3D Konami
              let cardTransform = "";
              let cardOpacity = 0;
              let cardZIndex = 1;

              if (ecoStage === "hidden") {
                cardTransform =
                  "translate3d(0px, 120px, -320px) scale(0.55) rotateZ(0deg)";
                cardOpacity = 0;
                cardZIndex = 1;
              } else if (ecoStage === "fan") {
                cardTransform = `translate3d(${item.fanX * 0.72}px, ${
                  item.fanY * 0.65
                }px, ${-Math.abs(idx - 2.5) * 45}px) scale(0.76) rotateZ(${
                  item.fanAngle
                }deg) rotateY(${(idx - 2.5) * 8}deg)`;
                cardOpacity = 0.92;
                cardZIndex = 20 - Math.round(Math.abs(idx - 2.5));
              } else {
                const translateXExpr = isCenter
                  ? "0%"
                  : isNearWing
                  ? `calc(${diff} * var(--konami-near-x))`
                  : isFarWing
                  ? `calc(${diff} * var(--konami-far-x))`
                  : "0%";

                const translateZExpr = isCenter
                  ? "0px"
                  : isNearWing
                  ? "var(--konami-near-z)"
                  : isFarWing
                  ? "var(--konami-far-z)"
                  : "-380px";

                const rotateYExpr = isCenter
                  ? "0deg"
                  : isNearWing
                  ? `calc(${diff} * var(--konami-near-rot))`
                  : isFarWing
                  ? `calc(${diff} * var(--konami-far-rot))`
                  : "0deg";

                const scale = isCenter
                  ? 1
                  : isNearWing
                  ? 0.84
                  : isFarWing
                  ? 0.68
                  : 0.52;

                cardTransform = `translate3d(${translateXExpr}, 0px, ${translateZExpr}) scale(${scale}) rotateY(${rotateYExpr}) rotateZ(0deg)`;
                cardOpacity = isCenter
                  ? 1
                  : isNearWing
                  ? 0.78
                  : isFarWing
                  ? 0.38
                  : 0;
                cardZIndex = isCenter
                  ? 30
                  : isNearWing
                  ? 20
                  : isFarWing
                  ? 10
                  : 1;
              }

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setEcoStage("locked");
                    if (!isCenter) setCarouselIdx(idx);
                  }}
                  style={{
                    transform: cardTransform,
                    transformOrigin:
                      ecoStage === "fan" ? "50% 135%" : "50% 50%",
                    zIndex: cardZIndex,
                    opacity: cardOpacity,
                    pointerEvents:
                      ecoStage === "locked" && isHiddenBack ? "none" : "auto",
                    transition:
                      ecoStage === "locked" && isHiddenBack
                        ? "opacity 0.25s ease"
                        : "transform 0.82s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  className={cn(
                    "absolute w-[calc(100%-3.25rem)] sm:w-full max-w-[520px]",
                    !isCenter && "cursor-pointer"
                  )}
                >
                  <div
                    style={{ animationDelay: `${idx * 0.45}s` }}
                    className={cn(
                      "rounded-[24px] sm:rounded-[28px] border p-5 sm:p-7 text-center transition-colors duration-300",
                      ecoStage === "locked" &&
                        !isCenter &&
                        "dawjang-wing-float",
                      isCenter && ecoStage === "locked"
                        ? "border-[#C96442]/55 bg-white dark:bg-[#1A1D26] text-[#141413] dark:text-white shadow-[0_32px_80px_-18px_rgba(15,23,42,0.28),0_0_0_1px_rgba(201,100,66,0.22)]"
                        : "border-[#DEDAD0] dark:border-white/15 bg-[#FAF8F5]/95 dark:bg-[#161922]/95 text-[#141413]/85 dark:text-white/80 shadow-xl hover:border-[#C96442]"
                    )}
                  >
                    <div className="flex flex-col items-center gap-2 border-b border-[#EAE6DF] dark:border-white/10 pb-3.5 mb-4">
                      <div className="flex items-center justify-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
                            isCenter
                              ? "bg-[#C96442] text-white shadow-sm"
                              : "bg-[#C96442]/12 text-[#C96442]"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full border border-[#C96442]/30 bg-[#C96442]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#C96442]">
                          {item.badge}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 max-w-md mx-auto">
                      <h3 className="dawjang-editorial-serif text-xl sm:text-2xl text-[#141413] dark:text-white leading-tight">
                        {item.title}
                      </h3>
                      <p className="text-[13px] sm:text-[13.5px] font-semibold text-[#C96442] leading-snug">
                        {item.subtitle}
                      </p>
                      <p className="text-[12.5px] sm:text-[13px] text-[#5E5D59] dark:text-white/80 leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>

                    {item.id === "eco-membre" ? (
                      <div className="mt-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-[#0F172A] via-[#1E1B18] to-[#141312] text-white p-3.5 flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2.5">
                          <DawJangDragonIcon className="h-7 w-7 text-white" />
                          <div>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400 block">
                              CARTE MEMBRE OFFICIELLE
                            </span>
                            <span className="font-serif text-sm text-white">
                              Sceau Napoléon • 30 Décorations
                            </span>
                          </div>
                        </div>
                        <PlanTierIconBadge tier="MAJOR" size="md" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-left">
                        {item.highlights.map((h) => (
                          <div
                            key={h}
                            className="rounded-xl border border-[#EAE6DF] dark:border-white/10 bg-[#FAF9F5] dark:bg-white/[0.03] p-2.5 text-[11.5px] font-medium text-[#141413] dark:text-white/90 flex items-start gap-1.5"
                          >
                            <Check className="h-3.5 w-3.5 text-[#C96442] shrink-0 mt-0.5" />
                            <span className="leading-snug">{h}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 pt-3.5 border-t border-[#EAE6DF] dark:border-white/10 flex items-center justify-center">
                      {isCenter ? (
                        <button
                          type="button"
                          onClick={() => navigate(item.route)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#C96442] hover:bg-[#b55535] text-white px-5 py-2.5 text-[13px] font-semibold shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          <span>{item.ctaLabel}</span>
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-[#C96442]">
                          {item.metricValue} • {item.metricLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. TRANSITION 4 : PIED DE PAGE ARCHITECTURAL À DÉPLOIEMENT D'HORIZON
         ===================================================================== */}
      <footer
        ref={footerRef}
        className="dawjang-landing-font border-t border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-[#0B0F17] text-[#141413] dark:text-[#FAF9F5] pt-14 pb-10 relative overflow-hidden"
      >
        {/* Arche d'horizon lumineuse qui s'étire de 15% à 100% à l'entrée du pied de page */}
        <div
          style={{
            transform: footerVisible ? "scaleX(1)" : "scaleX(0.15)",
            opacity: footerVisible ? 1 : 0,
            transition:
              "transform 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease",
          }}
          className="pointer-events-none absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[#C96442] to-transparent"
        />

        <div
          style={{
            transform: footerVisible ? "translateY(0)" : "translateY(28px)",
            opacity: footerVisible ? 1 : 0,
            transition: "all 0.85s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 pb-10 border-b border-[#DEDAD0] dark:border-white/10">
            <div className="sm:col-span-2 lg:col-span-4 space-y-4">
              <Link
                to="/"
                className="group inline-flex items-center gap-3 focus:outline-none"
              >
                <DawJangDragonIcon className="h-9 w-9 text-foreground transition-transform duration-300 group-hover:scale-105" />
                <div className="flex flex-col">
                  <DawJangWordmark size="md" />
                  <span className="text-[10.5px] font-medium text-muted-foreground leading-none mt-1">
                    Studio Académique
                  </span>
                </div>
              </Link>

              <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-sm">
                L'environnement d'étude conçu pour transformer vos polycopiés et
                vos annales d'examen en maîtrise durable, de la Licence 1 au
                Doctorat.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href="https://whatsapp.com"
                  target="_blank"
                  rel="noreferrer"
                  title="Rejoindre le Canal WhatsApp DawJang"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DEDAD0] dark:border-white/15 bg-white dark:bg-[#161B26] hover:border-emerald-600 hover:text-emerald-600 px-3 py-2 text-[12px] font-semibold transition-all shadow-2xs"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <span>Canal WhatsApp</span>
                </a>

                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook DawJang"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DEDAD0] dark:border-white/15 bg-white dark:bg-[#161B26] hover:border-[#C96442] hover:text-[#C96442] transition-all"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V22h3.4z" />
                  </svg>
                </a>

                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram DawJang"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DEDAD0] dark:border-white/15 bg-white dark:bg-[#161B26] hover:border-[#C96442] hover:text-[#C96442] transition-all"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                  </svg>
                </a>

                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn DawJang"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DEDAD0] dark:border-white/15 bg-white dark:bg-[#161B26] hover:border-[#C96442] hover:text-[#C96442] transition-all"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M6.9 8.5H3.8V20h3.1V8.5zM5.3 3.6c-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8 1.8-.8 1.8-1.8-.8-1.8-1.8-1.8zM20.2 13.4c0-3.1-1.7-4.6-3.9-4.6-1.8 0-2.6 1-3.1 1.7V8.5h-3.1V20h3.1v-6.1c0-1.6.3-3.1 2.3-3.1 1.9 0 2 1.8 2 3.2V20h3.1v-6.6z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground block">
                Instruments du Studio
              </span>
              <ul className="space-y-2 text-[13.5px] text-muted-foreground">
                <li>
                  <Link
                    to="/quiz"
                    className="hover:text-primary transition-colors"
                  >
                    Constructeur QCM & Annales
                  </Link>
                </li>
                <li>
                  <Link
                    to="/predictions"
                    className="hover:text-primary transition-colors"
                  >
                    Probabilités & Ciblage
                  </Link>
                </li>
                <li>
                  <Link
                    to="/summaries"
                    className="hover:text-primary transition-colors"
                  >
                    Le Rédacteur & Fiches
                  </Link>
                </li>
                <li>
                  <Link
                    to="/flashcards"
                    className="hover:text-primary transition-colors"
                  >
                    Flashcards & Nœuds
                  </Link>
                </li>
                <li>
                  <Link
                    to="/duels"
                    className="hover:text-primary transition-colors"
                  >
                    Arène des Duels en ligne
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground block">
                Plans & Carte Membre
              </span>
              <ul className="space-y-2 text-[13.5px] text-muted-foreground">
                <li>
                  <Link
                    to="/tarifs"
                    className="hover:text-primary transition-colors font-medium text-foreground"
                  >
                    Plan Napoléon / Taoïste
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="hover:text-primary transition-colors"
                  >
                    Ma Carte Membre
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams"
                    className="hover:text-primary transition-colors"
                  >
                    Simulateur d'Examen
                  </Link>
                </li>
                <li>
                  <Link
                    to="/stats"
                    className="hover:text-primary transition-colors"
                  >
                    Rapport des Lacunes
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground block">
                Légal & Support
              </span>
              <ul className="space-y-2 text-[13.5px] text-muted-foreground">
                <li>
                  <Link
                    to="/confidentialite"
                    className="hover:text-primary transition-colors block"
                  >
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link
                    to="/conditions"
                    className="hover:text-primary transition-colors block"
                  >
                    Conditions d'utilisation (CGU)
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(true)}
                    className="hover:text-primary transition-colors text-left flex items-center gap-1.5 font-medium text-foreground"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>Nous contacter / Support</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-muted-foreground text-center sm:text-left">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>
                Chiffrement de bout en bout • Sauvegarde Cloud & Locale
              </span>
            </span>
            <span className="font-mono text-[11px]">
              © 2026 DawJang — Studio Académique. Tous droits réservés.
            </span>
          </div>
        </div>
      </footer>

      {/* MODAL UNIQUE POUR "NOUS CONTACTER / SUPPORT" AVEC +221 76 821 91 39 ET tallathiam232@gmail.com */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl sm:text-2xl font-normal flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <span>Nous contacter / Support</span>
            </DialogTitle>
            <DialogDescription>
              Assistance directe pour votre compte étudiant, vos souscriptions
              ou vos suggestions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-[13.5px]">
            <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span>Numéro à contacter :</span>
                </span>
                <a
                  href="tel:+221768219139"
                  className="font-mono font-bold text-foreground hover:text-primary transition-colors"
                >
                  +221 76 821 91 39
                </a>
              </div>

              <div className="h-px w-full bg-border/70" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <span>E-mail :</span>
                </span>
                <a
                  href="mailto:tallathiam232@gmail.com"
                  className="font-mono font-bold text-primary hover:underline break-all"
                >
                  tallathiam232@gmail.com
                </a>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setContactModalOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
