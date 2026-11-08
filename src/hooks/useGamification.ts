import { useState, useEffect, useMemo, useCallback } from "react";

export type BadgeRarity = "bronze" | "argent" | "or" | "platine" | "obsidienne";

export type BadgeCategory =
  | "cadence"
  | "qcm"
  | "precision"
  | "synthese"
  | "memorisation"
  | "infini"
  | "duels"
  | "polyvalence"
  | "vitesse"
  | "pantheon";

export interface AcademicBadge {
  id: string;
  number: number; // 1 à 100
  name: string;
  category: BadgeCategory;
  categoryLabel: string;
  tier: number; // 1 à 10 dans sa collection
  rarity: BadgeRarity;
  description: string;
  requirementText: string;
  xpBonus: number;
  unlocked: boolean;
  progress: number; // 0 à 100%
  currentValue: number;
  targetValue: number;
  unlockedAt?: string;
}

export interface AcademicRank {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
}

/**
 * Courbe d'XP rehaussée et exigeante (30 Niveaux de prestige allant jusqu'à 1 250 000 XP)
 * Au niveau 9, le palier demande désormais 18 500 XP pour éviter une progression trop facile.
 */
export const PRESTIGE_RANKS: AcademicRank[] = [
  { level: 1, title: "Auditeur Libre", minXp: 0, maxXp: 800 },
  { level: 2, title: "Étudiant Assidu", minXp: 800, maxXp: 1900 },
  { level: 3, title: "Bachelier des Amphithéâtres", minXp: 1900, maxXp: 3400 },
  { level: 4, title: "Analyste Junior", minXp: 3400, maxXp: 5300 },
  { level: 5, title: "Praticien Méthodique", minXp: 5300, maxXp: 7700 },
  { level: 6, title: "Sémiologiste Confirmé", minXp: 7700, maxXp: 10700 },
  { level: 7, title: "Externe des Hôpitaux", minXp: 10700, maxXp: 14300 },
  { level: 8, title: "Major de Conférence", minXp: 14300, maxXp: 18500 },
  { level: 9, title: "Master 1 • Commandant", minXp: 18500, maxXp: 26500 },
  { level: 10, title: "Interne Titulaire", minXp: 26500, maxXp: 36000 },
  { level: 11, title: "Interne Médaille d'Argent", minXp: 36000, maxXp: 47500 },
  { level: 12, title: "Interne Médaille d'Or", minXp: 47500, maxXp: 61000 },
  { level: 13, title: "Chef de Clinique Adjoint", minXp: 61000, maxXp: 77000 },
  { level: 14, title: "Chef de Clinique des Universités", minXp: 77000, maxXp: 96000 },
  { level: 15, title: "Praticien Hospitalier", minXp: 96000, maxXp: 118000 },
  { level: 16, title: "Maître de Conférences", minXp: 118000, maxXp: 144000 },
  { level: 17, title: "Agrégé de Faculté", minXp: 144000, maxXp: 175000 },
  { level: 18, title: "Professeur Titulaire", minXp: 175000, maxXp: 212000 },
  { level: 19, title: "Chef de Pôle Académique", minXp: 212000, maxXp: 256000 },
  { level: 20, title: "Doyen du Collège", minXp: 256000, maxXp: 308000 },
  { level: 21, title: "Membre de l'Académie", minXp: 308000, maxXp: 370000 },
  { level: 22, title: "Commandeur des Sciences", minXp: 370000, maxXp: 445000 },
  { level: 23, title: "Régent Épistémique", minXp: 445000, maxXp: 535000 },
  { level: 24, title: "Archonte du Savoir", minXp: 535000, maxXp: 640000 },
  { level: 25, title: "Grand Maître de Chaire", minXp: 640000, maxXp: 760000 },
  { level: 26, title: "Chancelier Universitaire", minXp: 760000, maxXp: 890000 },
  { level: 27, title: "Souverain des Concours", minXp: 890000, maxXp: 1020000 },
  { level: 28, title: "Oracle Clinique", minXp: 1020000, maxXp: 1130000 },
  { level: 29, title: "Primat d'Excellence", minXp: 1130000, maxXp: 1250000 },
  { level: 30, title: "Panthéon DawJang", minXp: 1250000, maxXp: 1500000 },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const RARITY_BY_TIER: BadgeRarity[] = [
  "bronze",
  "bronze",
  "argent",
  "argent",
  "or",
  "or",
  "platine",
  "platine",
  "obsidienne",
  "obsidienne",
];

interface CollectionBlueprint {
  category: BadgeCategory;
  categoryLabel: string;
  baseNames: string[];
  unit: string;
  targets: number[];
  currentMetric: number;
  xpMultipliers: number[];
}

/**
 * Génère le catalogue intégral des 100 Badges (10 collections x 10 paliers)
 */
export function buildHundredBadgesCatalog(userMetrics = {
  streakDays: 7,
  qcmSolved: 84,
  perfectSeries: 6,
  summariesCreated: 5,
  flashcardsMastered: 145,
  infiniteStreak: 28,
  duelsWon: 4,
  subjectsExplored: 4,
  fastAnswers: 35,
  totalXp: 20269,
}): AcademicBadge[] {
  const blueprints: CollectionBlueprint[] = [
    {
      category: "cadence",
      categoryLabel: "Cadence & Régularité",
      baseNames: [
        "Première Garde",
        "Rythme d'Acier",
        "Semaine Intégrale",
        "Quinzaine de Fer",
        "Mois Académique",
        "Constance Clinique",
        "Trimestre d'Or",
        "Semestre Sans Faille",
        "Veilleur Annuel",
        "Inaltérable Absolue",
      ],
      unit: "jours consécutifs d'étude",
      targets: [1, 3, 7, 14, 30, 60, 90, 180, 270, 365],
      currentMetric: userMetrics.streakDays,
      xpMultipliers: [150, 300, 600, 1200, 2500, 4500, 7500, 12000, 18000, 30000],
    },
    {
      category: "qcm",
      categoryLabel: "Résolution QCM",
      baseNames: [
        "Initiation Sémiologique",
        "Lecteur de Cas",
        "Praticien des Annales",
        "Analyste Différentiel",
        "Maître des Dossiers",
        "Chirurgien du QCM",
        "Stratège des Concours",
        "Érudit des Banques",
        "Autorité Diagnostique",
        "Souverain des QCM",
      ],
      unit: "questions QCM validées",
      targets: [10, 25, 50, 100, 250, 500, 1000, 2000, 3500, 5000],
      currentMetric: userMetrics.qcmSolved,
      xpMultipliers: [200, 400, 750, 1500, 3000, 5500, 9000, 14000, 22000, 35000],
    },
    {
      category: "precision",
      categoryLabel: "Précision Chirurgicale",
      baseNames: [
        "Coup d'Œil Juste",
        "Main Ferme",
        "Sans Hésitation",
        "Diagnostic Pur",
        "Rigueur Absolue",
        "Infaillibilité Clinique",
        "Scalpel d'Argent",
        "Scalpel d'Or",
        "Œil du Major",
        "Perfection Impériale",
      ],
      unit: "sessions conclues à ≥ 90% de réussite",
      targets: [1, 3, 5, 10, 20, 35, 50, 75, 100, 150],
      currentMetric: userMetrics.perfectSeries,
      xpMultipliers: [250, 500, 900, 1800, 3200, 6000, 9500, 15000, 24000, 40000],
    },
    {
      category: "synthese",
      categoryLabel: "Synthèses & Tableaux",
      baseNames: [
        "Première Fiche",
        "Greffier des Objectifs",
        "Architecte Tabulaire",
        "Rédacteur de Garde",
        "Codificateur de Cours",
        "Maître des Classifications",
        "Directeur de Polycopiés",
        "Conservateur des Savoirs",
        "Auteur de Référence",
        "Grand Encyclopédiste",
      ],
      unit: "synthèses structurées par objectifs",
      targets: [1, 3, 5, 10, 20, 35, 50, 75, 100, 150],
      currentMetric: userMetrics.summariesCreated,
      xpMultipliers: [200, 450, 800, 1600, 3000, 5000, 8500, 13000, 20000, 32000],
    },
    {
      category: "memorisation",
      categoryLabel: "Ancrage & Smart Flashcards",
      baseNames: [
        "Empreinte Corticale",
        "Synapse Active",
        "Rappel Immédiat",
        "Consolidation FSRS",
        "Maître des 8 Modes",
        "Mémoire Structurée",
        "Rétention Profonde",
        "Cortex Infaillible",
        "Mémoire Photographique",
        "Omniscience Eidétique",
      ],
      unit: "cartes Smart maîtrisées au 1er coup",
      targets: [15, 50, 100, 250, 500, 1000, 2000, 3500, 5000, 10000],
      currentMetric: userMetrics.flashcardsMastered,
      xpMultipliers: [180, 380, 700, 1400, 2800, 5200, 8800, 14500, 23000, 38000],
    },
    {
      category: "infini",
      categoryLabel: "Endurance Mode Infini",
      baseNames: [
        "Entrée en Flux",
        "Cadence Soutenue",
        "Cap des Vingt",
        "Garde de Nuit",
        "Demi-Centurie",
        "Centurion du Flux",
        "Résistance Nerveuse",
        "Ultra-Marathonien",
        "Titan de l'Endurance",
        "Infinité Maîtrisée",
      ],
      unit: "bonnes réponses enchaînées en Mode Infini",
      targets: [5, 15, 25, 40, 60, 100, 150, 250, 400, 600],
      currentMetric: userMetrics.infiniteStreak,
      xpMultipliers: [200, 420, 850, 1700, 3100, 5800, 9200, 15500, 25000, 42000],
    },
    {
      category: "duels",
      categoryLabel: "Arène & Confrontations",
      baseNames: [
        "Premier Gant",
        "Duelliste d'Amphithéâtre",
        "Tacticien Rapide",
        "Vainqueur de Conférence",
        "Champion de Faculté",
        "Maître d'Armes Clinique",
        "Invaincu des Séminaires",
        "Stratège Suprême",
        "Légende de l'Arène",
        "Empereur des Duels",
      ],
      unit: "duels académiques remportés",
      targets: [1, 3, 5, 10, 25, 50, 100, 200, 350, 500],
      currentMetric: userMetrics.duelsWon,
      xpMultipliers: [250, 500, 1000, 2000, 4000, 7000, 11000, 18000, 28000, 45000],
    },
    {
      category: "polyvalence",
      categoryLabel: "Polyvalence Transversale",
      baseNames: [
        "Double Compétence",
        "Esprit Curieux",
        "Trivium Médical",
        "Quadrivium des Sciences",
        "Spécialiste Croisé",
        "Clinicien Transversal",
        "Polymathe Universitaire",
        "Savoir Panoramique",
        "Maître des Chaires",
        "Universaliste DawJang",
      ],
      unit: "disciplines et cours distincts étudiés",
      targets: [2, 3, 5, 8, 12, 18, 25, 35, 50, 75],
      currentMetric: userMetrics.subjectsExplored,
      xpMultipliers: [200, 400, 800, 1500, 2900, 5000, 8200, 13500, 21000, 34000],
    },
    {
      category: "vitesse",
      categoryLabel: "Réflexe & Urgence",
      baseNames: [
        "Réponse Éclair",
        "Pouls Rapide",
        "Urgentiste de Garde",
        "Décision en 5 Secondes",
        "Réflexe Synaptique",
        "Vitesse d'Intervention",
        "Éclair Diagnostique",
        "Maître du Temps Critique",
        "Foudre Clinique",
        "Instantanéité Absolue",
      ],
      unit: "réponses exactes validées en moins de 8 secondes",
      targets: [10, 25, 50, 100, 200, 400, 750, 1200, 2000, 3500],
      currentMetric: userMetrics.fastAnswers,
      xpMultipliers: [150, 350, 700, 1300, 2600, 4800, 8000, 13000, 20000, 33000],
    },
    {
      category: "pantheon",
      categoryLabel: "Panthéon & Prestige XP",
      baseNames: [
        "Éveil Académique",
        "Ascension Studieuse",
        "Pilier de Faculté",
        "Cercle des Dix Mille",
        "Commandeur d'Expérience",
        "Haut Dignitaire",
        "Cercle des Cent Mille",
        "Demi-Millionnaire XP",
        "Millionnaire du Savoir",
        "Couronne Immortelle DawJang",
      ],
      unit: "XP totaux accumulés",
      targets: [1000, 5000, 10000, 20000, 40000, 80000, 150000, 350000, 750000, 1250000],
      currentMetric: userMetrics.totalXp,
      xpMultipliers: [500, 1000, 2000, 4000, 8000, 15000, 25000, 50000, 100000, 200000],
    },
  ];

  const allBadges: AcademicBadge[] = [];
  let counter = 1;

  for (const bp of blueprints) {
    for (let i = 0; i < 10; i++) {
      const target = bp.targets[i];
      const current = bp.currentMetric;
      const unlocked = current >= target;
      const progress = Math.min(100, Math.round((current / target) * 100));

      allBadges.push({
        id: `${bp.category}-tier-${i + 1}`,
        number: counter++,
        name: `${bp.baseNames[i]} (${ROMAN[i]})`,
        category: bp.category,
        categoryLabel: bp.categoryLabel,
        tier: i + 1,
        rarity: RARITY_BY_TIER[i],
        description: `Palier ${ROMAN[i]} de la collection ${bp.categoryLabel}.`,
        requirementText: `Atteindre ${target.toLocaleString("fr-FR")} ${bp.unit}`,
        xpBonus: bp.xpMultipliers[i],
        unlocked,
        progress,
        currentValue: current,
        targetValue: target,
        unlockedAt: unlocked ? "Débloqué ce semestre" : undefined,
      });
    }
  }

  return allBadges;
}

export const useGamification = () => {
  // Avec le seuil rehaussé : Niveau 9 démarre à 18 500 XP et se termine à 26 500 XP (soit 8 000 XP à parcourir dans le niveau 9)
  const [totalXp, setTotalXp] = useState<number>(21540);
  const [streakDays, setStreakDays] = useState<number>(7);

  const currentRank = useMemo(() => {
    return (
      PRESTIGE_RANKS.find((r) => totalXp >= r.minXp && totalXp < r.maxXp) ||
      PRESTIGE_RANKS[8]
    );
  }, [totalXp]);

  const xpInCurrentLevel = totalXp - currentRank.minXp;
  const xpRequiredForNextLevel = currentRank.maxXp - currentRank.minXp;
  const xpRemainingToLevelUp = currentRank.maxXp - totalXp;
  const levelProgressPercent = Math.min(
    100,
    Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100)
  );

  const badges = useMemo(
    () =>
      buildHundredBadgesCatalog({
        streakDays,
        qcmSolved: 84,
        perfectSeries: 6,
        summariesCreated: 5,
        flashcardsMastered: 145,
        infiniteStreak: 28,
        duelsWon: 4,
        subjectsExplored: 4,
        fastAnswers: 35,
        totalXp,
      }),
    [streakDays, totalXp]
  );

  const unlockedBadges = useMemo(
    () => badges.filter((b) => b.unlocked),
    [badges]
  );

  const nextClosestBadges = useMemo(
    () =>
      badges
        .filter((b) => !b.unlocked)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 6),
    [badges]
  );

  const addXp = useCallback((amount: number) => {
    setTotalXp((prev) => prev + amount);
    return Promise.resolve([] as any[]);
  }, []);

  return {
    level: currentRank.level,
    rankTitle: currentRank.title,
    totalXp,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    xpRemainingToLevelUp,
    levelProgressPercent,
    streakDays,
    badges, // Les 100 badges complets
    unlockedBadges,
    nextClosestBadges,
    totalBadgesCount: 100,
    addXp,
    addXP: addXp,
    recordQuizCompletion: async (_score?: any, _total?: any) => [] as any[],
    stats: {
      level: currentRank.level,
      rankTitle: currentRank.title,
      totalXp,
      xp: totalXp,
      nextLevelXp: currentRank.maxXp,
      currentStreak: streakDays,
      streak: streakDays,
      longestStreak: 14,
      totalQuizzesCompleted: 84,
      quizzesCompleted: 84,
      flashcardsReviewed: 145,
      perfectQuizzes: 6,
      isPremium: true,
      planTier: "ELITE",
      daysRemaining: 180,
    },
    progress: levelProgressPercent,
    lastXpGain: null as { reason: string; amount: number } | null,
    data: {
      level: currentRank.level,
      rankTitle: currentRank.title,
      totalXp,
      xp: totalXp,
      nextLevelXp: currentRank.maxXp,
      currentStreak: streakDays,
      streak: streakDays,
      longestStreak: 14,
      totalQuizzesCompleted: 84,
      quizzesCompleted: 84,
      flashcardsReviewed: 145,
      perfectQuizzes: 6,
    },
    loading: false,
    events: [] as any[],
    clearEvents: () => {},
    refetch: () => {},
  };
};

export const USER_GAMIFICATION_KEY = "hippocampus_gamification_v2";

export interface UserStatsState {
  level: number;
  xp: number;
  nextLevelXp: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalQuizzesCompleted: number;
  quizzesCompleted: number;
  flashcardsReviewed: number;
  perfectQuizzes: number;
  isPremium?: boolean;
  planTier?: string;
  daysRemaining?: number;
  rankTitle?: string;
  [key: string]: any;
}

export const getStoredUserStats = (): UserStatsState => {
  if (typeof window === "undefined") {
    return {
      level: 9,
      xp: 21540,
      nextLevelXp: 26500,
      totalXp: 21540,
      currentStreak: 7,
      longestStreak: 14,
      totalQuizzesCompleted: 84,
      quizzesCompleted: 84,
      flashcardsReviewed: 145,
      perfectQuizzes: 6,
      isPremium: true,
      planTier: "ELITE",
      daysRemaining: 180,
      rankTitle: "Master 1 • Commandant",
    };
  }
  try {
    const raw = localStorage.getItem(USER_GAMIFICATION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    level: 9,
    xp: 21540,
    nextLevelXp: 26500,
    totalXp: 21540,
    currentStreak: 7,
    longestStreak: 14,
    totalQuizzesCompleted: 84,
    quizzesCompleted: 84,
    flashcardsReviewed: 145,
    perfectQuizzes: 6,
    isPremium: true,
    planTier: "ELITE",
    daysRemaining: 180,
    rankTitle: "Master 1 • Commandant",
  };
};

export interface XpGainEventDetail {
  amount: number;
  reason?: string;
  source?: string;
  timestamp?: number;
  leveledUp?: boolean;
  newStats?: any;
  [key: string]: any;
}

export const DAWJANG_XP_REWARDS = {
  SUMMARY_SAVED: 150,
  COURSE_UPLOADED: 100,
  QCM_CREATED: 120,
  FLASHCARD_REVIEWED: 15,
  DUEL_VICTORY: 250,
  SUMMARY_GENERATED: 200,
  QCM_QUESTION_ANSWERED: 25,
  QCM_SESSION_COMPLETED: 200,
  EXAM_COMPLETED: 500,
  DUEL_ROUND_HIT: 50,
};

export const grantDawJangXP = (
  amount: number,
  reason = "Action académique",
  source = "general"
) => {
  if (typeof window === "undefined" || !amount || amount <= 0) return;
  try {
    const raw = localStorage.getItem(USER_GAMIFICATION_KEY);
    const stats: UserStatsState = raw ? JSON.parse(raw) : getStoredUserStats();
    stats.xp = (stats.xp || 0) + amount;
    stats.totalXp = (stats.totalXp || 0) + amount;
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(stats));
  } catch {}
  window.dispatchEvent(
    new CustomEvent("dawjang:xp-gain", {
      detail: { amount, reason, source, timestamp: Date.now() },
    })
  );
  window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
};

export default useGamification;
