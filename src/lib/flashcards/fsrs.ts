// src/lib/flashcards/fsrs.ts
// ─────────────────────────────────────────────────────────────────────────────
// Planificateur FSRS-4.5 (Free Spaced Repetition Scheduler), l'algorithme
// utilisé par Anki depuis la version 23.10. Il modélise chaque carte par :
//   • Stabilité (S)   : nombre de jours pour que le rappel tombe à 90 %
//   • Difficulté (D)  : 1 (facile) → 10 (très difficile)
//   • Récupérabilité (R) : probabilité de rappel à l'instant t
// Notes : 1 = À revoir, 2 = Difficile, 3 = Correct, 4 = Facile
// ─────────────────────────────────────────────────────────────────────────────

export type SrsRating = 1 | 2 | 3 | 4;
export type SrsPhase = "new" | "learning" | "review" | "relearning";

export interface SrsState {
  phase: SrsPhase;
  stability: number;
  difficulty: number;
  /** Échéance (timestamp ms) */
  due: number;
  /** Dernière révision (timestamp ms) */
  lastReview: number | null;
  reps: number;
  lapses: number;
}

// Poids par défaut FSRS-4.5 (optimisés sur des millions de révisions Anki)
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_INTERVAL_DAYS = 3650;

/** Pas d'apprentissage intra-session (comme Anki) */
const LEARNING_STEP_AGAIN_MIN = 1;
const LEARNING_STEP_HARD_MIN = 6;
const RELEARNING_STEP_MIN = 10;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function createNewSrsState(now = Date.now()): SrsState {
  return {
    phase: "new",
    stability: 0,
    difficulty: 0,
    due: now,
    lastReview: null,
    reps: 0,
    lapses: 0,
  };
}

/** Probabilité de rappel après `elapsedDays` pour une stabilité S */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Intervalle (jours) pour atteindre la rétention cible */
export function intervalForStability(stability: number, retention: number): number {
  const r = clamp(retention, 0.7, 0.97);
  const days = (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

const initStability = (g: SrsRating) => Math.max(W[g - 1], 0.1);
const initDifficulty = (g: SrsRating) => clamp(W[4] - (g - 3) * W[5], 1, 10);

function nextDifficulty(d: number, g: SrsRating): number {
  const updated = d - W[6] * (g - 3);
  // Réversion vers la moyenne : évite « l'enfer de la facilité » d'Anki SM-2
  return clamp(W[7] * initDifficulty(3) + (1 - W[7]) * updated, 1, 10);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: SrsRating): number {
  const hardPenalty = g === 2 ? W[15] : 1;
  const easyBonus = g === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function stabilityAfterLapse(d: number, s: number, r: number): number {
  const next =
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(next, s);
}

/**
 * Calcule le nouvel état d'une carte après une note.
 * @param retention rétention cible (0.70 → 0.97), reliée au réglage « Taux de rétention » des Paramètres
 */
export function scheduleReview(
  current: SrsState | undefined,
  rating: SrsRating,
  now = Date.now(),
  retention = 0.9
): SrsState {
  const state = current ?? createNewSrsState(now);
  const reps = state.reps + 1;

  // 1. Première rencontre de la carte
  if (state.phase === "new") {
    const stability = initStability(rating);
    const difficulty = initDifficulty(rating);
    if (rating === 1 || rating === 2) {
      return {
        phase: "learning",
        stability,
        difficulty,
        due: now + (rating === 1 ? LEARNING_STEP_AGAIN_MIN : LEARNING_STEP_HARD_MIN) * MINUTE,
        lastReview: now,
        reps,
        lapses: state.lapses,
      };
    }
    return {
      phase: "review",
      stability,
      difficulty,
      due: now + intervalForStability(stability, retention) * DAY,
      lastReview: now,
      reps,
      lapses: state.lapses,
    };
  }

  // 2. Phase d'apprentissage / réapprentissage (pas courts en minutes)
  if (state.phase === "learning" || state.phase === "relearning") {
    const difficulty = nextDifficulty(state.difficulty, rating);
    if (rating === 1 || rating === 2) {
      return {
        ...state,
        difficulty,
        due: now + (rating === 1 ? LEARNING_STEP_AGAIN_MIN : LEARNING_STEP_HARD_MIN) * MINUTE,
        lastReview: now,
        reps,
      };
    }
    const stability = rating === 4 ? Math.max(state.stability, initStability(4)) : state.stability;
    return {
      phase: "review",
      stability,
      difficulty,
      due: now + intervalForStability(stability, retention) * DAY,
      lastReview: now,
      reps,
      lapses: state.lapses,
    };
  }

  // 3. Révision espacée classique
  const elapsedDays = state.lastReview ? (now - state.lastReview) / DAY : 0;
  const r = retrievability(elapsedDays, state.stability);
  const difficulty = nextDifficulty(state.difficulty, rating);

  if (rating === 1) {
    return {
      phase: "relearning",
      stability: Math.max(0.1, stabilityAfterLapse(state.difficulty, state.stability, r)),
      difficulty,
      due: now + RELEARNING_STEP_MIN * MINUTE,
      lastReview: now,
      reps,
      lapses: state.lapses + 1,
    };
  }

  const stability = stabilityAfterRecall(state.difficulty, state.stability, r, rating);
  return {
    phase: "review",
    stability,
    difficulty,
    due: now + intervalForStability(stability, retention) * DAY,
    lastReview: now,
    reps,
    lapses: state.lapses,
  };
}

/** Libellé lisible d'un délai (ex. « 1 min », « 4 j », « 2 mois ») */
export function formatDelay(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(ms / DAY);
  if (days < 31) return `${days} j`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mois`;
  return `${(days / 365).toFixed(1).replace(".0", "")} an(s)`;
}

/** Aperçu des 4 délais affichés sous les boutons (comme Anki) */
export function previewRatings(
  current: SrsState | undefined,
  now = Date.now(),
  retention = 0.9
): Record<SrsRating, string> {
  const out = {} as Record<SrsRating, string>;
  ([1, 2, 3, 4] as SrsRating[]).forEach((g) => {
    out[g] = formatDelay(scheduleReview(current, g, now, retention).due - now);
  });
  return out;
}

/** Récupérabilité actuelle (utile pour prioriser les révisions en retard) */
export function currentRetrievability(state: SrsState | undefined, now = Date.now()): number {
  if (!state || state.phase === "new" || !state.lastReview) return 0;
  return retrievability((now - state.lastReview) / DAY, state.stability);
}
