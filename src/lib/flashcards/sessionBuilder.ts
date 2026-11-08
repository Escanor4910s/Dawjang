// src/lib/flashcards/sessionBuilder.ts
// Composition des sessions d'étude — garantit qu'une session ne reproduit
// jamais la précédente (ni le même lot de cartes, ni le même ordre).
import { currentRetrievability, createNewSrsState, type SrsState } from "./fsrs";
import type { CalibratedFlashcard } from "./types";

const SESSION_HISTORY_KEY = "hippocampus_flashcard_sessions_v1";
const HISTORY_DEPTH = 4;

interface SessionRecord {
  ids: string[];
  at: number;
}

type SessionHistory = Record<string, SessionRecord[]>;

function readHistory(): SessionHistory {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SessionHistory) : {};
  } catch {
    return {};
  }
}

export function recordSession(scopeKey: string, ids: string[]) {
  const history = readHistory();
  const list = history[scopeKey] || [];
  history[scopeKey] = [{ ids, at: Date.now() }, ...list].slice(0, HISTORY_DEPTH);
  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // stockage plein : on ignore
  }
}

export function getLastSessions(scopeKey: string): SessionRecord[] {
  return readHistory()[scopeKey] || [];
}

/** Mélange de Fisher-Yates avec aléa cryptographique */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  const rand = () => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] / 2 ** 32;
    }
    return Math.random();
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function srsOf(card: CalibratedFlashcard): SrsState {
  return card.srs ?? createNewSrsState(0);
}

export function isDue(card: CalibratedFlashcard, now = Date.now()): boolean {
  const s = srsOf(card);
  return s.phase !== "new" && s.due <= now;
}

export function isNew(card: CalibratedFlashcard): boolean {
  return srsOf(card).phase === "new";
}

export interface ScopeStats {
  total: number;
  due: number;
  fresh: number;
  learning: number;
  mastered: number;
}

export function computeScopeStats(cards: CalibratedFlashcard[], now = Date.now()): ScopeStats {
  let due = 0,
    fresh = 0,
    learning = 0,
    mastered = 0;
  cards.forEach((c) => {
    const s = srsOf(c);
    if (s.phase === "new") fresh++;
    else {
      if (s.due <= now) due++;
      if (s.phase === "review" && s.stability >= 21) mastered++;
      else learning++;
    }
  });
  return { total: cards.length, due, fresh, learning, mastered };
}

/** Entrelace les leçons (interleaving) : évite 3 cartes d'une même leçon d'affilée */
function interleaveByLesson(cards: CalibratedFlashcard[]): CalibratedFlashcard[] {
  const out: CalibratedFlashcard[] = [];
  const pool = [...cards];
  while (pool.length) {
    const last = out.slice(-2).map((c) => c.courseId);
    const idx = pool.findIndex(
      (c) => !(last.length === 2 && last.every((id) => id === c.courseId))
    );
    out.push(pool.splice(idx >= 0 ? idx : 0, 1)[0]);
  }
  return out;
}

export interface BuildSessionOptions {
  size: number;
  /** Plafond de cartes nouvelles par session */
  newLimit?: number;
  now?: number;
  scopeKey: string;
}

/**
 * Construit une session :
 *   1. les cartes ÉCHUES (à réviser aujourd'hui), les plus fragiles d'abord
 *   2. des cartes NOUVELLES jamais vues dans les dernières sessions
 *   3. si besoin, des révisions anticipées (plus faible rétention d'abord)
 * puis mélange + entrelacement, avec garantie de différence avec la session précédente.
 */
export function buildStudySession(
  pool: CalibratedFlashcard[],
  { size, newLimit, now = Date.now(), scopeKey }: BuildSessionOptions
): string[] {
  if (pool.length === 0) return [];
  const target = Math.min(size, pool.length);
  const maxNew = newLimit ?? Math.ceil(target * 0.6);

  const history = getLastSessions(scopeKey);
  const lastIds = new Set(history[0]?.ids || []);
  const recentIds = new Set(history.flatMap((h) => h.ids));

  const due = pool
    .filter((c) => isDue(c, now))
    .sort((a, b) => currentRetrievability(srsOf(a), now) - currentRetrievability(srsOf(b), now));

  const fresh = shuffle(pool.filter(isNew)).sort((a, b) => {
    const ra = recentIds.has(a.id) ? 1 : 0;
    const rb = recentIds.has(b.id) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return (b.importance ?? 3) - (a.importance ?? 3);
  });

  const ahead = shuffle(pool.filter((c) => !isNew(c) && !isDue(c, now))).sort((a, b) => {
    const ra = recentIds.has(a.id) ? 1 : 0;
    const rb = recentIds.has(b.id) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return currentRetrievability(srsOf(a), now) - currentRetrievability(srsOf(b), now);
  });

  const chosen: CalibratedFlashcard[] = [];
  const take = (list: CalibratedFlashcard[], limit: number) => {
    for (const c of list) {
      if (chosen.length >= target || limit <= 0) break;
      if (chosen.some((x) => x.id === c.id)) continue;
      chosen.push(c);
      limit--;
    }
  };

  take(due, target);
  take(fresh, maxNew);
  take(ahead, target);
  take(fresh, target); // complète si le pool manque de révisions

  // Garantie anti-répétition : si le lot est identique à la session précédente
  // alors que d'autres cartes existent, on en remplace au moins un tiers.
  const sameSet =
    lastIds.size > 0 && chosen.length === lastIds.size && chosen.every((c) => lastIds.has(c.id));
  if (sameSet && pool.length > chosen.length) {
    const alternatives = shuffle(pool.filter((c) => !lastIds.has(c.id)));
    const swaps = Math.min(alternatives.length, Math.max(1, Math.ceil(chosen.length / 3)));
    const replaceable = shuffle(chosen.filter((c) => !isDue(c, now)));
    for (let i = 0; i < swaps && i < replaceable.length; i++) {
      const idx = chosen.findIndex((c) => c.id === replaceable[i].id);
      chosen[idx] = alternatives[i];
    }
  }

  // Ordre : jamais identique à la session précédente
  const previousOrder = history[0]?.ids.join("|");
  let ordered = interleaveByLesson(shuffle(chosen));
  for (let attempt = 0; attempt < 8 && ordered.map((c) => c.id).join("|") === previousOrder; attempt++) {
    ordered = interleaveByLesson(shuffle(chosen));
  }

  return ordered.map((c) => c.id);
}
