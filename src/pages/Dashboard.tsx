import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  FileText,
  Infinity as InfinityIcon,
  Layers,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Flame,
  Target,
  BookOpen,
  Clock,
  ChevronRight,
  ChevronLeft,
  Play,
  Award,
  Check,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DawJangLogo } from "@/components/DawJangLogo";
import { useGamification } from "@/hooks/useGamification";
import {
  BadgeDisplayModal,
  AcademicBadgeCrest,
} from "@/components/gamification/BadgeDisplay";
import { getSavedStudentProfile, StudentProfileSN } from "@/pages/Settings";
import {
  getActivePlanBadge,
  PlanTierIconBadge,
} from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

interface ReadyQcmItem {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  lastScore?: number;
  updatedAt: string;
}

interface SummaryItem {
  id: string;
  title: string;
  objectivesCount: number;
  tablesCount: number;
  updatedAt: string;
}

interface ActivityDay {
  dayLetter: string;
  dateLabel: string;
  count: number;
  intensity: 0 | 1 | 2 | 3;
  isToday?: boolean;
}

interface CarouselModuleItem {
  id: string;
  title: string;
  badgeText: string;
  description: string;
  footerLeft: string;
  footerRight: string;
  route: string;
  secondaryRoute?: string;
  secondaryLabel?: string;
  accentTag: string;
  icon: "qcm" | "summaries" | "infini" | "smart" | "flashcards" | "library" | "predictions";
}

const INITIAL_QCMS: ReadyQcmItem[] = [
  {
    id: "qcm-1",
    title: "Anémies par déficits enzymatiques (G6PD & PK)",
    category: "Hématologie",
    questionCount: 15,
    lastScore: 94,
    updatedAt: "Aujourd'hui",
  },
  {
    id: "qcm-2",
    title: "Médecine Interne — Sémiologie & Constantes Érythrocytaires",
    category: "Médecine Interne",
    questionCount: 10,
    lastScore: 90,
    updatedAt: "Hier",
  },
  {
    id: "qcm-3",
    title: "Physiopathologie des Hémolyses Corpusculaires",
    category: "Hématologie",
    questionCount: 10,
    lastScore: 86,
    updatedAt: "Il y a 2 j",
  },
];

const INITIAL_SUMMARIES: SummaryItem[] = [
  {
    id: "sum-1",
    title: "Anémies par déficits enzymatiques — Pr Moussa Seck",
    objectivesCount: 5,
    tablesCount: 2,
    updatedAt: "Aujourd'hui",
  },
  {
    id: "sum-2",
    title: "Médecine Interne — Généralités & Sémiologie",
    objectivesCount: 6,
    tablesCount: 3,
    updatedAt: "Hier",
  },
  {
    id: "sum-3",
    title: "Physiopathologie des Hémolyses Corpusculaires",
    objectivesCount: 4,
    tablesCount: 1,
    updatedAt: "Il y a 3 j",
  },
];

const generate28DaysMatrix = (): ActivityDay[] => {
  const letters = ["L", "M", "M", "J", "V", "S", "D"];
  const pattern: (0 | 1 | 2 | 3)[] = [
    2, 3, 2, 1, 3, 2, 1,
    3, 2, 3, 2, 2, 1, 0,
    2, 3, 3, 2, 3, 2, 2,
    3, 3, 2, 3, 3, 2, 3,
  ];
  const counts = [
    18, 32, 24, 12, 35, 20, 10,
    29, 22, 38, 25, 19, 14, 0,
    21, 34, 31, 26, 40, 22, 16,
    33, 42, 28, 36, 45, 27, 30,
  ];

  return pattern.map((intensity, index) => ({
    dayLetter: letters[index % 7],
    dateLabel: `Jour ${index + 1}/28`,
    count: counts[index],
    intensity,
    isToday: index === 27,
  }));
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    level,
    rankTitle,
    totalXp,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    xpRemainingToLevelUp,
    levelProgressPercent,
    streakDays,
    badges,
    unlockedBadges,
    nextClosestBadges,
  } = useGamification();

  const [profile, setProfile] = useState<StudentProfileSN>(getSavedStudentProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const saved = getSavedStudentProfile();
    return (
      saved.avatarUrl ||
      localStorage.getItem("hippocampus_user_avatar_url") ||
      null
    );
  });
  const [planBadge, setPlanBadge] = useState(getActivePlanBadge);

  const [qcmList, setQcmList] = useState<ReadyQcmItem[]>(INITIAL_QCMS);
  const [summaryList, setSummaryList] = useState<SummaryItem[]>(INITIAL_SUMMARIES);
  const [activeFeedTab, setActiveFeedTab] = useState<"qcm" | "summaries" | "memorization">("qcm");
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  // Carrousel Konami / PlayStation des 7 Modules (affiche 2 cartes actives au centre + 2 cartes semi-occultées aux bords)
  const [moduleCarouselIndex, setModuleCarouselIndex] = useState<number>(0);

  // Carrousel de Badges directement intégré dans la carte de droite + Modale des 100 Badges
  const [badgeSlideIndex, setBadgeSlideIndex] = useState<number>(0);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);

  const [dailyGoals, setDailyGoals] = useState([
    { id: "g1", label: "Valider 1 cycle de mémorisation active (FSRS)", done: true, route: "/smart-flashcards" },
    { id: "g2", label: "Résoudre 10 questions en Mode Infini", done: true, route: "/infini" },
    { id: "g3", label: "Réviser les tableaux d'un résumé par objectifs", done: false, route: "/summaries" },
  ]);

  const activityMatrix = useMemo(() => generate28DaysMatrix(), []);

  // Liste mixte pour le mini-carrousel de badges (derniers débloqués + prochains à débloquer)
  const spotlightBadges = useMemo(() => {
    const recentUnlocked = unlockedBadges.slice(-4).reverse();
    const upcoming = nextClosestBadges.slice(0, 4);
    return [...recentUnlocked, ...upcoming];
  }, [unlockedBadges, nextClosestBadges]);

  // Synchronisation du profil, de la photo d'avatar, des QCM locaux et des Synthèses
  useEffect(() => {
    const syncProfileAndData = () => {
      const nextProf = getSavedStudentProfile();
      setProfile(nextProf);
      setAvatarUrl(
        nextProf.avatarUrl ||
          localStorage.getItem("hippocampus_user_avatar_url") ||
          null
      );
      setPlanBadge(getActivePlanBadge());

      // Lecture des banques QCM locales
      try {
        const rawDecks = localStorage.getItem("hippocampus_quiz_decks_v2");
        if (rawDecks) {
          const parsedDecks = JSON.parse(rawDecks);
          if (Array.isArray(parsedDecks) && parsedDecks.length > 0) {
            const mappedDecks: ReadyQcmItem[] = parsedDecks.slice(0, 6).map((d: any) => ({
              id: d.id || `qcm-${Math.random()}`,
              title: d.title || "Banque QCM",
              category: d.category || d.subject || "Médecine",
              questionCount: Array.isArray(d.questions) ? d.questions.length : d.questionCount || 10,
              lastScore: d.bestScore ?? d.lastScore,
              updatedAt: d.updatedAt || "Récent",
            }));
            setQcmList(mappedDecks);
          }
        }
      } catch {}

      // Lecture des synthèses locales
      try {
        const rawSums = localStorage.getItem("hippocampus_local_summaries_v2");
        if (rawSums) {
          const parsedSums = JSON.parse(rawSums);
          if (Array.isArray(parsedSums) && parsedSums.length > 0) {
            const mappedSums: SummaryItem[] = parsedSums.slice(0, 6).map((s: any) => ({
              id: s.id,
              title: s.title || "Synthèse de cours",
              objectivesCount:
                (Array.isArray(s.objectives) && s.objectives.length) ||
                (s.content?.match(/^##\s+/gm) || []).length ||
                5,
              tablesCount: (s.content?.match(/\|.*\|.*\n\|[\s\-:|]+\|/g) || []).length || 2,
              updatedAt: "Récent",
            }));
            setSummaryList(mappedSums);
          }
        }
      } catch {}
    };

    syncProfileAndData();

    const fetchDashboardData = async () => {
      try {
        const { data: summariesData } = await supabase
          .from("summaries")
          .select("id, title, content, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (summariesData && summariesData.length > 0) {
          setSummaryList((prev) => {
            const remoteItems: SummaryItem[] = summariesData.map((s: any) => ({
              id: s.id,
              title: s.title || "Synthèse de cours",
              objectivesCount: (s.content?.match(/^##\s+/gm) || []).length || 4,
              tablesCount: (s.content?.match(/\|.*\|.*\n\|[\s\-:|]+\|/g) || []).length || 1,
              updatedAt: "Récent",
            }));
            const merged = [...prev];
            for (const r of remoteItems) {
              if (!merged.some((m) => m.id === r.id)) merged.push(r);
            }
            return merged.slice(0, 6);
          });
        }
      } catch {
        // Mode local
      }
    };
    fetchDashboardData();

    window.addEventListener("hippocampus-profile-updated", syncProfileAndData);
    window.addEventListener("hippocampus-stats-updated", syncProfileAndData);
    return () => {
      window.removeEventListener("hippocampus-profile-updated", syncProfileAndData);
      window.removeEventListener("hippocampus-stats-updated", syncProfileAndData);
    };
  }, []);

  // Les 7 Modules du Studio réunis dans le Carrousel Konami / PlayStation
  const studioModules: CarouselModuleItem[] = useMemo(
    () => [
      {
        id: "mod-qcm",
        title: "Constructeur de QCM",
        badgeText: `${qcmList.length} banque(s)`,
        description:
          "Générez des QCM de niveau professoral (Élection, Censure, Groupage, Jumelage, Association) avec mimétisme d'annales.",
        footerLeft: "Précision moyenne",
        footerRight: "88% • 6 formats",
        route: "/qcm",
        accentTag: "DOCIMOLOGIE",
        icon: "qcm",
      },
      {
        id: "mod-summaries",
        title: "Rédacteur de Résumés",
        badgeText: `${summaryList.length} fiche(s)`,
        description:
          "Synthétisez vos cours objectif par objectif (du 1er au dernier) ou en Synthèse Unifiée avec Audit d'Annales (Protocole Argon).",
        footerLeft: "2 modes purs",
        footerRight: "Zéro troncature",
        route: "/summaries",
        secondaryRoute: "/summaries/new",
        secondaryLabel: "+ Nouvelle synthèse",
        accentTag: "SYNTHÈSE PURE",
        icon: "summaries",
      },
      {
        id: "mod-smart",
        title: "Studio Smart Flashcards",
        badgeText: "8 modalités",
        description:
          "Entraînement adaptatif anti-monotonie : Choix multiple/Censure, Classer A/B mélangé, Correspondance dérangée et Cloze.",
        footerLeft: "Mémoire adaptative",
        footerRight: "Couverture 100%",
        route: "/smart-flashcards",
        accentTag: "8 FORMES ACTIVES",
        icon: "smart",
      },
      {
        id: "mod-infini",
        title: "Mode Infini",
        badgeText: "Flux continu",
        description:
          "Enchaînez sans limite QCM, Vrai/Faux, Phrases à trous et Questions ouvertes sur tous vos cours ou sujets libres.",
        footerLeft: "Cadence actuelle",
        footerRight: "Correction directe",
        route: "/infini",
        accentTag: "MULTI-DOMAINE",
        icon: "infini",
      },
      {
        id: "mod-flashcards",
        title: "Flashcards & Duels",
        badgeText: "FSRS v4.5",
        description:
          "Ancrage mnémonique à répétition espacée et défis académiques chronométrés en temps réel.",
        footerLeft: "Rétention cible 90%",
        footerRight: "Arène Duels →",
        route: "/flashcards",
        secondaryRoute: "/duels",
        secondaryLabel: "Arène Duels",
        accentTag: "MÉMORISATION",
        icon: "flashcards",
      },
      {
        id: "mod-library",
        title: "Bibliothèque & Cours",
        badgeText: "Synchronisée",
        description:
          "Importez vos polycopiés PDF/DOCX, extrayez les tableaux et alimentez directement le QCM et les Résumés.",
        footerLeft: "Sources unifiées",
        footerRight: "Accès direct →",
        route: "/library",
        accentTag: "ARCHIVES",
        icon: "library",
      },
      {
        id: "mod-predictions",
        title: "Probabilités & Ciblage",
        badgeText: "Analytique",
        description:
          "Détectez les chapitres à haut rendement docimologique, les pièges récurrents et les cibles d'examen.",
        footerLeft: "Ciblage annales",
        footerRight: "Statistiques →",
        route: "/predictions",
        secondaryRoute: "/stats",
        secondaryLabel: "Statistiques",
        accentTag: "HAUT RENDEMENT",
        icon: "predictions",
      },
    ],
    [qcmList.length, summaryList.length]
  );

  const renderModuleIcon = (iconType: CarouselModuleItem["icon"]) => {
    switch (iconType) {
      case "qcm":
        return <CheckSquare className="w-5 h-5" />;
      case "summaries":
        return <FileText className="w-5 h-5" />;
      case "smart":
        return <DawJangLogo className="w-5 h-5" />;
      case "infini":
        return <InfinityIcon className="w-5 h-5" />;
      case "flashcards":
        return <Layers className="w-5 h-5" />;
      case "library":
        return <BookOpen className="w-5 h-5" />;
      case "predictions":
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  const totalModules = studioModules.length;
  const getModAt = (offset: number) =>
    studioModules[(moduleCarouselIndex + offset + totalModules) % totalModules];

  const prevMod = getModAt(-1);
  const activeMod = getModAt(0);
  const nextMod = getModAt(1);

  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [isSliding, setIsSliding] = useState<boolean>(false);

  const stepCarouselPrev = () => {
    if (isSliding) return;
    setSlideDirection("left");
    setIsSliding(true);
    setModuleCarouselIndex((prev) => (prev - 1 + totalModules) % totalModules);
    setTimeout(() => {
      setIsSliding(false);
      setSlideDirection(null);
    }, 350);
  };

  const stepCarouselNext = () => {
    if (isSliding) return;
    setSlideDirection("right");
    setIsSliding(true);
    setModuleCarouselIndex((prev) => (prev + 1) % totalModules);
    setTimeout(() => {
      setIsSliding(false);
      setSlideDirection(null);
    }, 350);
  };

  const jumpToModule = (idx: number) => {
    if (idx === moduleCarouselIndex || isSliding) return;
    const dir = idx > moduleCarouselIndex ? "right" : "left";
    setSlideDirection(dir);
    setIsSliding(true);
    setModuleCarouselIndex(idx);
    setTimeout(() => {
      setIsSliding(false);
      setSlideDirection(null);
    }, 350);
  };

  const toggleGoal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDailyGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g))
    );
  };

  const userInitials =
    profile.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "DJ";

  return (
    <div className="min-h-screen w-full bg-[#FAF8F5] dark:bg-[#11100F] text-[#18181B] dark:text-stone-100 pb-14 selection:bg-[#D96B43]/20 selection:text-[#D96B43]">
      <div className="w-full max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 space-y-6">
        {/* ====================================================================
            1. EN-TÊTE ÉDITORIAL & BOUTONS STRICTEMENT ALIGNÉS SUR UNE SEULE LIGNE
        ==================================================================== */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#EAE4DC] dark:border-stone-800/80">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
              Semestre d'Automne • Studio Académique DawJang
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#18181B] dark:text-white mt-0.5 truncate">
              Tableau de bord
            </h1>
          </div>

          {/* Barre des 3 boutons verrouillés sur UNE SEULE LIGNE (flex-nowrap whitespace-nowrap) */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap overflow-x-auto no-scrollbar shrink-0 py-1">
            <button
              type="button"
              onClick={() => navigate("/smart-flashcards")}
              className="inline-flex items-center gap-2 h-9 sm:h-10 px-3.5 rounded-xl bg-[#F4EFE6] dark:bg-stone-900 hover:bg-[#EAE1D3] border border-[#E2D9C8] dark:border-stone-800 text-xs font-semibold text-[#18181B] dark:text-stone-200 whitespace-nowrap shrink-0 transition-all duration-200 active:scale-[0.99]"
            >
              <Play className="w-3.5 h-3.5 text-[#D96B43] fill-[#D96B43] shrink-0" />
              <span>Reprendre l'entraînement</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/summaries/new")}
              className="inline-flex items-center gap-2 h-9 sm:h-10 px-3.5 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 border border-[#E2DDD5] dark:border-stone-700 text-xs font-semibold text-[#18181B] dark:text-stone-100 whitespace-nowrap shrink-0 shadow-2xs transition-all duration-200 hover:border-stone-400 active:scale-[0.99]"
            >
              <FileText className="w-3.5 h-3.5 text-[#D96B43] shrink-0" />
              <span>Nouvelle synthèse</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/qcm")}
              className="group inline-flex items-center gap-2 h-9 sm:h-10 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] dark:bg-stone-100 dark:text-[#18181B] text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-xs transition-all duration-200 active:scale-[0.99]"
            >
              <Plus className="w-3.5 h-3.5 text-[#D96B43] shrink-0 group-hover:rotate-90 transition-transform duration-300" />
              <span>Construire un QCM</span>
            </button>
          </div>
        </header>

        {/* ====================================================================
            2. CARROUSEL KONAMI / PLAYSTATION DES 7 MODULES DU STUDIO
               (PLEINE LARGEUR, ZÉRO DÉLIMITATION PARASITE, MOTION FLUIDE HAUTE DENSITÉ)
        ==================================================================== */}
        <section
          aria-label="Carrousel des modules principaux"
          className="space-y-4 w-full"
        >
          {/* Barre de contrôle supérieure du Carrousel Konami */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#D96B43]">
                <span className="w-2 h-2 rounded-full bg-[#D96B43] animate-pulse" />
                SÉLECTEUR DE PÔLES • MODULE {String(moduleCarouselIndex + 1).padStart(2, "0")}/0{totalModules}
              </span>
              <div className="hidden sm:flex items-center gap-1.5">
                {studioModules.map((m, idx) => {
                  const isActive = idx === moduleCarouselIndex;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => jumpToModule(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? "w-8 bg-[#D96B43] shadow-[0_0_10px_rgba(217,107,67,0.45)]"
                          : "w-2 bg-[#DED6C8] dark:bg-stone-800 hover:bg-stone-400"
                      }`}
                      title={m.title}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stepCarouselPrev}
                className="group inline-flex items-center gap-2 h-8.5 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-[#E2D9C8] dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:border-[#D96B43] hover:text-[#D96B43] transition-all shadow-2xs active:scale-95"
                title={`Basculer vers ${prevMod.title}`}
              >
                <ChevronLeft className="w-4 h-4 text-[#D96B43] group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline font-mono text-[11px] text-stone-500">Précédent :</span>
                <span className="hidden sm:inline max-w-[130px] truncate">{prevMod.title}</span>
              </button>
              <button
                type="button"
                onClick={stepCarouselNext}
                className="group inline-flex items-center gap-2 h-8.5 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-[#E2D9C8] dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:border-[#D96B43] hover:text-[#D96B43] transition-all shadow-2xs active:scale-95"
                title={`Basculer vers ${nextMod.title}`}
              >
                <span className="hidden sm:inline font-mono text-[11px] text-stone-500">Suivant :</span>
                <span className="hidden sm:inline max-w-[130px] truncate">{nextMod.title}</span>
                <ChevronRight className="w-4 h-4 text-[#D96B43] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Scène Panoramique Konami : Déploiement Pleine Largeur sans boîte fermée ni masque découpant */}
          <div className="w-full relative py-1">
            <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:gap-5 w-full">
              {/* AILE GAUCHE EN FLOTAISON NATURELLE (PRÉCÉDENT — CLIQUABLE POUR BASCULER) */}
              <div
                role="button"
                tabIndex={0}
                onClick={stepCarouselPrev}
                onKeyDown={(e) => e.key === "Enter" && stepCarouselPrev()}
                title={`Basculer vers ${prevMod.title}`}
                className="hidden lg:flex flex-1 min-w-[240px] max-w-[340px] group relative rounded-2xl bg-white/75 dark:bg-[#181615]/75 backdrop-blur-md border border-[#E5DEC9] dark:border-stone-800 hover:border-[#D96B43]/70 p-5 flex-col justify-between opacity-60 hover:opacity-100 scale-[0.93] hover:scale-[0.96] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer select-none shadow-[0_12px_32px_-12px_rgba(24,24,27,0.06)] hover:shadow-[0_16px_36px_-10px_rgba(217,107,67,0.12)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F4EFE6] dark:bg-stone-900 border border-[#E5DEC9] dark:border-stone-800 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 group-hover:text-[#D96B43] group-hover:border-[#D96B43]/40 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                      Précédent
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-[#F7F4EF] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:border-[#D96B43]/40 group-hover:text-[#D96B43] transition-colors">
                      {renderModuleIcon(prevMod.icon)}
                    </div>
                  </div>

                  <span className="inline-block text-[9.5px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#F5E6DE]/60 dark:bg-stone-800 text-[#C85A32] dark:text-[#E8845C]">
                    {prevMod.accentTag}
                  </span>

                  <h3 className="font-serif text-lg font-bold text-[#18181B] dark:text-white mt-2 group-hover:text-[#D96B43] transition-colors leading-snug">
                    {prevMod.title}
                  </h3>

                  <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-3 mt-1.5 leading-relaxed">
                    {prevMod.description}
                  </p>
                </div>

                <div className="pt-3 mt-4 border-t border-[#EAE4DC]/80 dark:border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-500">
                  <span>{prevMod.badgeText}</span>
                  <span className="text-[#D96B43] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <span>Basculer</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* SECTION CENTRALE HÉROÏQUE ÉLARGIE (MODULE ACTIF PLEINE PUISSANCE) */}
              <div
                key={activeMod.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(activeMod.route)}
                onKeyDown={(e) => e.key === "Enter" && navigate(activeMod.route)}
                className={cn(
                  "flex-[2] w-full min-w-[320px] max-w-[840px] group relative rounded-3xl bg-white dark:bg-[#181615] border-2 border-[#18181B] dark:border-stone-600 hover:border-[#D96B43] p-6 sm:p-8 flex flex-col justify-between shadow-[0_24px_55px_-14px_rgba(24,24,27,0.14)] hover:shadow-[0_30px_70px_-12px_rgba(217,107,67,0.20)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer z-10",
                  slideDirection === "left" && "animate-in slide-in-from-left-4 fade-in duration-300",
                  slideDirection === "right" && "animate-in slide-in-from-right-4 fade-in duration-300"
                )}
              >
                {/* Halo subtil supérieur */}
                <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(217,107,67,0.11)_0%,transparent_70%)]" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#18181B] dark:bg-stone-100 text-white dark:text-[#18181B] flex items-center justify-center shadow-md group-hover:bg-[#D96B43] dark:group-hover:bg-[#D96B43] dark:group-hover:text-white transition-colors duration-300">
                        {renderModuleIcon(activeMod.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[#F5E6DE] dark:bg-[#D96B43]/20 text-[#C85A32] dark:text-[#E8845C]">
                            {activeMod.accentTag}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-[#F7F4EF] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 text-stone-700 dark:text-stone-300 tabular-nums">
                            {activeMod.badgeText}
                          </span>
                        </div>
                        <p className="text-[11.5px] font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                          Pôle actif • Cliquer pour ouvrir
                        </p>
                      </div>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 flex items-center justify-center text-stone-500 group-hover:bg-[#D96B43] group-hover:text-white group-hover:border-[#D96B43] transition-all duration-300 shrink-0">
                      <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <h2 className="font-serif text-2xl sm:text-[32px] font-normal text-[#18181B] dark:text-white tracking-tight leading-snug">
                    {activeMod.title}
                  </h2>

                  <p className="text-sm sm:text-[15px] text-stone-600 dark:text-stone-300 mt-2.5 leading-relaxed max-w-2xl">
                    {activeMod.description}
                  </p>
                </div>

                {/* Pied de la carte centrale héroïque avec micro-actions directes */}
                <div className="relative mt-7 pt-4 border-t border-[#F0EAE0] dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-stone-500">{activeMod.footerLeft} :</span>
                    <span className="font-bold text-[#18181B] dark:text-stone-200 bg-[#F7F4EF] dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-[#EAE4DC] dark:border-stone-800">
                      {activeMod.footerRight}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {activeMod.secondaryRoute && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(activeMod.secondaryRoute!);
                        }}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 hover:bg-[#F5E6DE]/60 border border-[#E2D9C8] dark:border-stone-700 hover:border-[#D96B43] text-xs font-bold text-[#C85A32] dark:text-[#E8845C] transition-all"
                      >
                        <span>{activeMod.secondaryLabel}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(activeMod.route);
                      }}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#18181B] hover:bg-[#D96B43] dark:bg-white dark:text-[#18181B] dark:hover:bg-[#D96B43] dark:hover:text-white text-white text-xs font-semibold shadow-xs transition-all duration-200"
                    >
                      <span>Ouvrir le pôle</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* AILE DROITE EN FLOTAISON NATURELLE (SUIVANT — CLIQUABLE POUR BASCULER) */}
              <div
                role="button"
                tabIndex={0}
                onClick={stepCarouselNext}
                onKeyDown={(e) => e.key === "Enter" && stepCarouselNext()}
                title={`Basculer vers ${nextMod.title}`}
                className="hidden lg:flex flex-1 min-w-[240px] max-w-[340px] group relative rounded-2xl bg-white/75 dark:bg-[#181615]/75 backdrop-blur-md border border-[#E5DEC9] dark:border-stone-800 hover:border-[#D96B43]/70 p-5 flex-col justify-between opacity-60 hover:opacity-100 scale-[0.93] hover:scale-[0.96] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer select-none shadow-[0_12px_32px_-12px_rgba(24,24,27,0.06)] hover:shadow-[0_16px_36px_-10px_rgba(217,107,67,0.12)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[#F7F4EF] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:border-[#D96B43]/40 group-hover:text-[#D96B43] transition-colors">
                      {renderModuleIcon(nextMod.icon)}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F4EFE6] dark:bg-stone-900 border border-[#E5DEC9] dark:border-stone-800 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 group-hover:text-[#D96B43] group-hover:border-[#D96B43]/40 transition-colors">
                      Suivant
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>

                  <span className="inline-block text-[9.5px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#F5E6DE]/60 dark:bg-stone-800 text-[#C85A32] dark:text-[#E8845C]">
                    {nextMod.accentTag}
                  </span>

                  <h3 className="font-serif text-lg font-bold text-[#18181B] dark:text-white mt-2 group-hover:text-[#D96B43] transition-colors leading-snug">
                    {nextMod.title}
                  </h3>

                  <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-3 mt-1.5 leading-relaxed">
                    {nextMod.description}
                  </p>
                </div>

                <div className="pt-3 mt-4 border-t border-[#EAE4DC]/80 dark:border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-500">
                  <span>{nextMod.badgeText}</span>
                  <span className="text-[#D96B43] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <span>Basculer</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Aperçu tactile compact sur écrans mobiles/tablettes (< lg) */}
            <div className="grid grid-cols-2 gap-2.5 mt-3 lg:hidden">
              <button
                type="button"
                onClick={stepCarouselPrev}
                className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-stone-900 border border-[#E5DEC9] dark:border-stone-800 text-left hover:border-[#D96B43] transition-all shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4 text-[#D96B43] shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[9px] font-mono uppercase text-stone-400">Précédent</span>
                  <span className="block text-xs font-bold text-[#18181B] dark:text-white truncate">{prevMod.title}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={stepCarouselNext}
                className="flex items-center justify-end gap-2 p-3 rounded-xl bg-white dark:bg-stone-900 border border-[#E5DEC9] dark:border-stone-800 text-right hover:border-[#D96B43] transition-all shadow-2xs"
              >
                <div className="min-w-0">
                  <span className="block text-[9px] font-mono uppercase text-stone-400">Suivant</span>
                  <span className="block text-xs font-bold text-[#18181B] dark:text-white truncate">{nextMod.title}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#D96B43] shrink-0" />
              </button>
            </div>

            {/* Barre d'accès rapide par pastilles aux 7 modules sous le carrousel (Directement sur le canvas, sans bordure double) */}
            <div className="mt-4 pt-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5">
                {studioModules.map((m, idx) => {
                  const isSelected = idx === moduleCarouselIndex;
                  const isAdjacent =
                    idx === (moduleCarouselIndex - 1 + totalModules) % totalModules ||
                    idx === (moduleCarouselIndex + 1) % totalModules;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => jumpToModule(idx)}
                      onDoubleClick={() => navigate(m.route)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? "bg-[#18181B] text-white dark:bg-white dark:text-[#18181B] shadow-xs scale-[1.02]"
                          : isAdjacent
                          ? "bg-white dark:bg-stone-900 text-[#18181B] dark:text-stone-200 border border-[#D96B43]/40 hover:border-[#D96B43]"
                          : "bg-white/80 dark:bg-stone-900/80 text-stone-500 dark:text-stone-400 border border-[#E5DEC9] dark:border-stone-800 hover:border-[#D96B43] hover:text-[#18181B]"
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#D96B43]" />}
                      <span>{m.title}</span>
                    </button>
                  );
                })}
              </div>
              <span className="hidden xl:inline-block text-[10px] font-mono text-stone-400 shrink-0">
                Navigation fluide 7 pôles
              </span>
            </div>
          </div>
        </section>

        {/* ====================================================================
            3. CORPS PRINCIPAL ASYMÉTRIQUE (8 COLONNES GAUCHE / 4 COLONNES DROITE)
        ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLONNE GAUCHE (8 COLS) */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl bg-white dark:bg-[#181615] border border-[#EAE4DC] dark:border-stone-800 p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F2EDE6] dark:border-stone-800">
                <div>
                  <h2 className="text-lg font-bold text-[#18181B] dark:text-white tracking-tight">
                    {activeFeedTab === "qcm" && "Vos QCM prêts à être lancés"}
                    {activeFeedTab === "summaries" && "Vos Fiches de Synthèse & Tableaux"}
                    {activeFeedTab === "memorization" && "Cycles de Mémorisation Active"}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {activeFeedTab === "qcm" &&
                      "Cliquez sur un QCM pour démarrer immédiatement la session."}
                    {activeFeedTab === "summaries" &&
                      "Consultez vos synthèses fidèles aux objectifs ou vos Synthèses Unifiées (Protocole Argon)."}
                    {activeFeedTab === "memorization" &&
                      "Reprenez vos paquets avec rotation automatique des 8 formes de questions."}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <div className="inline-flex p-1 rounded-xl bg-[#F7F4EF] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800">
                    {[
                      { id: "qcm", label: "QCM", count: qcmList.length },
                      { id: "summaries", label: "Synthèses", count: summaryList.length },
                      { id: "memorization", label: "Flashcards", count: 2 },
                    ].map((tab) => {
                      const active = activeFeedTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveFeedTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            active
                              ? "bg-white dark:bg-stone-800 text-[#18181B] dark:text-white shadow-2xs"
                              : "text-stone-500 hover:text-[#18181B]"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="ml-1.5 font-mono text-[10px] text-[#D96B43]">
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        activeFeedTab === "qcm"
                          ? "/qcm"
                          : activeFeedTab === "summaries"
                          ? "/summaries"
                          : "/smart-flashcards"
                      )
                    }
                    className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-[#D96B43] transition-colors"
                  >
                    <span>Ouvrir le constructeur</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {activeFeedTab === "qcm" && (
                <div className="mt-4 space-y-3">
                  {qcmList.map((qcm) => (
                    <div
                      key={qcm.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/qcm")}
                      onKeyDown={(e) => e.key === "Enter" && navigate("/qcm")}
                      className="group relative rounded-xl bg-[#FAF8F5]/70 dark:bg-stone-900/50 hover:bg-white dark:hover:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 hover:border-[#D96B43]/50 p-4 sm:px-5 flex items-center justify-between gap-4 transition-all duration-200 cursor-pointer"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#F5E6DE] dark:bg-[#D96B43]/15 text-[#C85A32] dark:text-[#E8845C] font-mono text-[11px] font-semibold">
                            {qcm.category}
                          </span>
                          <span className="text-xs font-mono text-stone-500 tabular-nums">
                            {qcm.questionCount} questions
                          </span>
                          <span className="text-stone-300 dark:text-stone-700">•</span>
                          <span className="text-[11px] font-mono text-stone-400">
                            {qcm.updatedAt}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-white truncate group-hover:text-[#D96B43] transition-colors">
                          {qcm.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {qcm.lastScore !== undefined && (
                          <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[10px] font-mono uppercase text-stone-400">
                              Dernier score
                            </span>
                            <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300 tabular-nums">
                              {qcm.lastScore}%
                            </span>
                          </div>
                        )}

                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-[#E5DEC9] dark:border-stone-700 flex items-center justify-center text-stone-600 group-hover:bg-[#18181B] group-hover:text-white group-hover:border-[#18181B] transition-all">
                          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeFeedTab === "summaries" && (
                <div className="mt-4 space-y-3">
                  {summaryList.map((sum) => (
                    <div
                      key={sum.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/summary/${sum.id}`)}
                      className="group rounded-xl bg-[#FAF8F5]/70 dark:bg-stone-900/50 hover:bg-white dark:hover:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 hover:border-[#D96B43]/50 p-4 sm:px-5 flex items-center justify-between gap-4 transition-all duration-200 cursor-pointer"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#F2ECE1] dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[11px] font-semibold">
                            {sum.objectivesCount} objectifs
                          </span>
                          <span className="text-xs font-mono text-[#D96B43] tabular-nums">
                            {sum.tablesCount} tableau(x) préservé(s)
                          </span>
                          <span className="text-[11px] font-mono text-stone-400">
                            • {sum.updatedAt}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-white truncate">
                          {sum.title}
                        </h3>
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-[#E5DEC9] flex items-center justify-center text-stone-600 group-hover:bg-[#18181B] group-hover:text-white transition-all shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeFeedTab === "memorization" && (
                <div className="mt-4 space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("/smart-flashcards")}
                    className="group rounded-xl bg-[#FAF8F5]/70 dark:bg-stone-900/50 hover:bg-white border border-[#EAE4DC] hover:border-[#D96B43]/50 p-4 sm:px-5 flex items-center justify-between gap-4 transition-all cursor-pointer"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#F5E6DE] text-[#C85A32] font-mono text-[11px] font-semibold">
                          8 modalités actives
                        </span>
                        <span className="text-xs font-mono text-stone-500">
                          Couverture intégrale (Chapitres I à V)
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-white truncate">
                        Anémies par déficits enzymatiques (G6PD, PK, P5'N, GPI)
                      </h3>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E5DEC9] flex items-center justify-center text-stone-600 group-hover:bg-[#18181B] group-hover:text-white transition-all shrink-0">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PROTOCOLE DE RÉVISION DU JOUR */}
            <div className="rounded-2xl bg-white dark:bg-[#181615] border border-[#EAE4DC] dark:border-stone-800 p-5 sm:px-6">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D96B43]" />
                  <h3 className="text-sm font-bold text-[#18181B] dark:text-white">
                    Protocole de révision du jour
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                  {dailyGoals.filter((g) => g.done).length} / {dailyGoals.length} complétés
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {dailyGoals.map((goal) => (
                  <div
                    key={goal.id}
                    onClick={() => navigate(goal.route)}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                      goal.done
                        ? "bg-[#FAF8F5] dark:bg-stone-900/40 border-[#EAE4DC] text-stone-400"
                        : "bg-white dark:bg-stone-900 border-[#E2DDD5] hover:border-[#D96B43]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => toggleGoal(goal.id, e)}
                        className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          goal.done
                            ? "bg-[#D96B43] text-white"
                            : "border border-stone-300 hover:border-[#D96B43]"
                        }`}
                      >
                        {goal.done && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <span
                        className={`font-medium leading-snug ${
                          goal.done ? "line-through" : "text-[#18181B] dark:text-stone-200"
                        }`}
                      >
                        {goal.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------
              COLONNE DROITE (4 COLS) : AVATAR PROFIL + LV, SEUIL XP BOOSTÉ, CARROUSEL DES 100 BADGES & RÉGULARITÉ
          ------------------------------------------------------------------ */}
          <aside className="lg:col-span-4 space-y-5">
            {/* CARTE 1 : PROFIL UTILISATEUR (AVEC PHOTO + BADGE LV.), SEUIL XP REHAUSSÉ & VITRINE DES 100 BADGES */}
            <div className="rounded-2xl bg-white dark:bg-[#181615] border border-[#EAE4DC] dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("/settings")}
                    title="Modifier la photo de profil et le cursus"
                    className="relative shrink-0 cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#18181B] text-white border-2 border-[#E2D9C8] dark:border-stone-700 group-hover:border-[#D96B43] flex items-center justify-center font-bold text-base shadow-xs overflow-hidden transition-all">
                      {profile.avatarUrl || avatarUrl ? (
                        <img
                          src={(profile.avatarUrl || avatarUrl) as string}
                          alt={profile.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userInitials}</span>
                      )}
                    </div>
                    <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full bg-[#18181B] border border-white/20 text-white font-mono text-[10px] font-bold shadow-2xs">
                      LV.{level}
                    </span>
                    <PlanTierIconBadge
                      tier={planBadge.tier}
                      size="xs"
                      className="absolute -bottom-1 -right-1.5 ring-2 ring-white dark:ring-[#181615]"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D96B43] truncate">
                        {profile.fullName}
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">
                        • {profile.studyLevel}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-white leading-tight truncate mt-0.5">
                      {rankTitle}
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                      Prochain palier dans{" "}
                      <strong className="font-mono text-stone-700 dark:text-stone-300 tabular-nums">
                        {xpRemainingToLevelUp.toLocaleString("fr-FR")} XP
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF8F5] dark:bg-stone-900 border border-[#EAE4DC] dark:border-stone-800 text-xs font-mono font-bold text-[#18181B] dark:text-stone-200 shrink-0 tabular-nums">
                  <Flame className="w-3.5 h-3.5 text-[#D96B43]" />
                  <span>{streakDays} j</span>
                </div>
              </div>

              {/* Jauge d'expérience sur le nouveau seuil rehaussé */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-500">Expérience LV. {level}</span>
                  <span className="font-bold text-[#18181B] dark:text-white tabular-nums">
                    {xpInCurrentLevel.toLocaleString("fr-FR")} /{" "}
                    {xpRequiredForNextLevel.toLocaleString("fr-FR")} XP (
                    {levelProgressPercent}%)
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-[#F0ECE3] dark:bg-stone-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C85A32] to-[#E07A5F] transition-all duration-700"
                    style={{ width: `${levelProgressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono pt-0.5 text-stone-500">
                  <span>XP totaux cumulés</span>
                  <span className="font-bold text-[#18181B] dark:text-stone-200 tabular-nums">
                    {totalXp.toLocaleString("fr-FR")} XP
                  </span>
                </div>
              </div>

              {/* MINI-CARROUSEL DES 100 BADGES HÉRALDIQUES INTÉGRÉ À LA CARTE GAMIFICATION */}
              <div className="pt-4 border-t border-[#F2EDE6] dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#D96B43]" />
                    <span className="text-xs font-bold text-[#18181B] dark:text-white">
                      Distinctions ({unlockedBadges.length} / 100)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setBadgeSlideIndex((prev) =>
                          prev === 0 ? spotlightBadges.length - 1 : prev - 1
                        )
                      }
                      className="w-6 h-6 rounded-lg border border-[#EAE4DC] dark:border-stone-800 flex items-center justify-center text-stone-500 hover:text-black"
                      title="Badge précédent"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBadgeSlideIndex(
                          (prev) => (prev + 1) % spotlightBadges.length
                        )
                      }
                      className="w-6 h-6 rounded-lg border border-[#EAE4DC] dark:border-stone-800 flex items-center justify-center text-stone-500 hover:text-black"
                      title="Badge suivant"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Carte du badge actif dans le carrousel avec son Blason Héraldique SVG unique */}
                {spotlightBadges[badgeSlideIndex] && (
                  <div
                    onClick={() => setIsBadgeModalOpen(true)}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 hover:border-[#D96B43] transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <AcademicBadgeCrest
                        badge={spotlightBadges[badgeSlideIndex]}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#18181B] dark:text-white truncate">
                            {spotlightBadges[badgeSlideIndex].name}
                          </p>
                          <span className="text-[10px] font-mono font-bold text-[#D96B43] shrink-0">
                            +{spotlightBadges[badgeSlideIndex].xpBonus} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5">
                          {spotlightBadges[badgeSlideIndex].requirementText}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[#E8E2D9] dark:bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          spotlightBadges[badgeSlideIndex].unlocked
                            ? "bg-emerald-600"
                            : "bg-[#D96B43]"
                        }`}
                        style={{
                          width: `${spotlightBadges[badgeSlideIndex].progress}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsBadgeModalOpen(true)}
                  className="w-full py-2 rounded-xl bg-[#F4EFE6] dark:bg-stone-900 hover:bg-[#EAE1D3] text-xs font-bold text-[#18181B] dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-[#D96B43]" />
                  <span>Explorer le Panthéon des 100 Badges</span>
                </button>
              </div>
            </div>

            {/* CARTE 2 : CANVAS DE RÉGULARITÉ (28J) */}
            <div className="rounded-2xl bg-white dark:bg-[#181615] border border-[#EAE4DC] dark:border-stone-800 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#18181B] dark:text-white">
                    Canvas de régularité (28j)
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {hoveredDay
                      ? `${hoveredDay.dateLabel} : ${hoveredDay.count} actions validées`
                      : "Survolez un jour pour inspecter votre volume d'étude"}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#D96B43] tabular-nums">
                  96% actif
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono font-semibold text-stone-400"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {activityMatrix.map((day, idx) => {
                  const cellStyle = {
                    0: "bg-[#F4F1EA] dark:bg-stone-900 border-[#EAE4DC] dark:border-stone-800",
                    1: "bg-[#F2D6C9] dark:bg-[#D96B43]/30 border-[#E5BFA8]",
                    2: "bg-[#E29578] dark:bg-[#D96B43]/60 border-[#D96B43]/50",
                    3: "bg-[#D96B43] border-[#B8532E] text-white",
                  }[day.intensity];

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`h-8 rounded-lg border transition-all duration-150 flex items-center justify-center text-[10px] font-mono cursor-pointer hover:scale-110 ${cellStyle} ${
                        day.isToday ? "ring-2 ring-[#18181B] dark:ring-white" : ""
                      }`}
                    >
                      {day.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modale complète des 100 Badges */}
      <BadgeDisplayModal
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        badges={badges}
        totalXp={totalXp}
        level={level}
        rankTitle={rankTitle}
      />
    </div>
  );
};

export default Dashboard;
