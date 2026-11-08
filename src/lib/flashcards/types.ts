// src/lib/flashcards/types.ts
import type { SrsState } from "./fsrs";

export type FlashcardOriginMode = "objectives" | "relevance" | "qcm_error" | "manual";

/** Format pédagogique de la carte (inspiré d'Anki / RemNote) */
export type FlashcardFormat = "qa" | "definition" | "cloze" | "list" | "qcm";

export interface QcmPropositionItem {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface CalibratedFlashcard {
  id: string;
  courseId: string;
  lessonTitle: string;
  subject: string;
  customNode: string;
  originMode: FlashcardOriginMode;
  relevanceRank?: number;
  question: string;
  answerSummary: string;
  answerDetails: string[];
  qcmType?: "multiple" | "jumelage";
  qcmPropositions?: QcmPropositionItem[];
  qcmExplanation?: string;

  // Champs historiques conservés (lus par Paramètres, MOR, statistiques)
  intervalDays: number;
  repetitionCount: number;
  status: "new" | "learning" | "mastered";

  // ── Noyau v7 ──
  format?: FlashcardFormat;
  /** Phrase à trous pour les cartes « cloze » : « Le récepteur est {{c1::GM1}} » */
  clozeText?: string;
  /** Extrait du cours qui justifie la réponse (ancrage, anti-hallucination) */
  sourceExcerpt?: string;
  /** Importance 1 → 5 (5 = notion à connaître absolument, « +++ ») */
  importance?: number;
  /** Clé de contenu normalisée pour la déduplication */
  contentKey?: string;
  createdAt?: number;
  generator?: "ai" | "local" | "manual" | "qcm" | "mor";
  srs?: SrsState;
}

export type CourseFlashcard = CalibratedFlashcard;

export interface RawGeneratedCard {
  format: FlashcardFormat;
  question: string;
  answer: string;
  details: string[];
  clozeText?: string;
  importance: number;
  sourceExcerpt?: string;
  objective?: string;
}
