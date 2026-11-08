// src/lib/flashcards/store.ts
// Persistance et migration de la banque de flashcards.
// La clé v6 est conservée : Paramètres (sauvegarde/restauration) et le
// Professeur MOR écrivent déjà dedans. Les anciennes cartes sont migrées
// vers le noyau v7 (FSRS) sans perte de progression.
import { createNewSrsState, type SrsState } from "./fsrs";
import type { CalibratedFlashcard, FlashcardFormat } from "./types";
import { isGarbledCard, makeContentKey, repairClozeAndFormatCard, stripMarkdown } from "./text";
import { filterOutTombstoned } from "@/lib/syncEngine";

export const FLASHCARDS_STORAGE_KEY = "hippocampus_core_flashcards_v6";
const DAY = 86_400_000;

function inferFormat(card: CalibratedFlashcard): FlashcardFormat {
  if (card.qcmPropositions && card.qcmPropositions.length > 0) return "qcm";
  if (card.format === "cloze") return "qa";
  if (card.format) return card.format;
  return "qa";
}

function inferGenerator(card: CalibratedFlashcard): CalibratedFlashcard["generator"] {
  if (card.generator) return card.generator;
  if (card.id.startsWith("fc-mor")) return "mor";
  if (card.id.startsWith("fc-man")) return "manual";
  if (card.originMode === "qcm_error") return "qcm";
  return "local";
}

function migrateSrs(card: CalibratedFlashcard, now: number): SrsState {
  if (card.srs) return card.srs;
  if (!card.repetitionCount) return createNewSrsState(now);
  const interval = Math.max(1, card.intervalDays || 1);
  return {
    phase: "review",
    stability: interval,
    difficulty: card.status === "mastered" ? 4 : 6,
    lastReview: now - interval * DAY,
    due: now,
    reps: card.repetitionCount,
    lapses: 0,
  };
}

/** Cartes générées automatiquement par les anciennes versions ou mal formées à purger */
function isLegacyJunk(card: CalibratedFlashcard): boolean {
  if (card.id.startsWith("core-default-")) return true;
  return isGarbledCard(card);
}

export function migrateCards(raw: unknown): CalibratedFlashcard[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const seenIds = new Set<string>();
  return (raw as CalibratedFlashcard[])
    .filter((c) => c && typeof c === "object" && typeof c.question === "string")
    .map((c) => {
      const repaired = repairClozeAndFormatCard(
        c.question,
        c.answerSummary || "",
        c.clozeText
      );
      const cleanDetails = Array.isArray(c.answerDetails)
        ? c.answerDetails.map((d) => stripMarkdown(String(d))).filter(Boolean)
        : [];
      let id = c.id || `fc-${now}-${Math.random().toString(36).slice(2, 8)}`;
      if (seenIds.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
      seenIds.add(id);
      return {
        ...c,
        id,
        question: repaired.question,
        answerSummary: repaired.answer,
        answerDetails: cleanDetails,
        clozeText: undefined,
        customNode: c.customNode || "Points essentiels",
        format: inferFormat(c),
        generator: inferGenerator(c),
        contentKey: makeContentKey(repaired.question, repaired.answer),
        importance: c.importance ?? 3,
        srs: migrateSrs(c, now),
      };
    })
    .filter((c) => !isLegacyJunk(c));
}

export function loadFlashcards(): CalibratedFlashcard[] {
  try {
    const rawCards = migrateCards(JSON.parse(localStorage.getItem(FLASHCARDS_STORAGE_KEY) || "[]"));
    return filterOutTombstoned("flashcard", rawCards);
  } catch {
    return [];
  }
}

/** Synchronise les champs historiques (status, intervalDays…) à partir de l'état FSRS */
export function withLegacyFields(card: CalibratedFlashcard): CalibratedFlashcard {
  const s = card.srs;
  if (!s) return card;
  const interval = s.lastReview ? Math.max(0, Math.round((s.due - s.lastReview) / DAY)) : 0;
  return {
    ...card,
    intervalDays: interval,
    repetitionCount: s.reps,
    status: s.phase === "new" ? "new" : s.phase === "review" && s.stability >= 21 ? "mastered" : "learning",
  };
}

export function saveFlashcards(cards: CalibratedFlashcard[]) {
  try {
    localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(cards.map(withLegacyFields)));
  } catch (e) {
    console.error("Sauvegarde des flashcards impossible :", e);
  }
}
