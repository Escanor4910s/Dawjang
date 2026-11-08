// src/lib/flashcards/qcmErrorMatcher.ts
// Relie chaque cours à ses QCM (même lorsque le QCM porte un nom différent,
// grâce à l'analyse lexicale du cours et des questions) et suit les erreurs
// réellement commises par l'étudiant.
import type { QuizDeck, QuizQuestion } from "@/pages/Quiz";
import type { CalibratedFlashcard } from "./types";
import { createNewSrsState } from "./fsrs";
import { formatLessonTitle, type FlashcardSourceCourse } from "./localGenerator";
import { contentWords, makeContentKey, normalizeForKey } from "./text";

export const QCM_ERRORS_STORAGE_KEY = "hippocampus_qcm_errors_v1";

export interface QcmErrorRecord {
  id: string;
  deckId: string;
  deckTitle: string;
  courseId?: string;
  sourceCourseTitle?: string;
  sourceFingerprint?: string;
  questionId: string;
  question: string;
  options: Array<{ id: string; label: string; text: string; isCorrect: boolean }>;
  selectedOptionIds: string[];
  explanation: string;
  timestamp: number;
}

/** Empreinte lexicale d'un texte de cours (mots significatifs ≥ 5 lettres) */
export function computeCourseFingerprint(content: string): string {
  const words = contentWords(content).filter((w) => w.length >= 5);
  const unique = Array.from(new Set(words)).slice(0, 120);
  return unique.join(" ");
}

export function loadQcmErrorRecords(): QcmErrorRecord[] {
  try {
    const raw = localStorage.getItem(QCM_ERRORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQcmErrorRecords(records: QcmErrorRecord[]): void {
  try {
    localStorage.setItem(QCM_ERRORS_STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
  } catch {
    // ignore storage errors
  }
}

/**
 * Enregistre le résultat d'une question QCM validée par l'étudiant :
 * - Si l'étudiant s'est trompé (!isCorrect), l'erreur est mémorisée pour ce cours/QCM.
 * - Si l'étudiant corrige son tir ou réussit, l'historique des erreurs commises reste rattaché au QCM.
 */
export function recordQcmQuestionAttempt(params: {
  deck: QuizDeck & {
    courseId?: string;
    sourceCourseTitle?: string;
    sourceFingerprint?: string;
  };
  question: QuizQuestion;
  isCorrect: boolean;
  selectedOptionIds: string[];
}): void {
  if (params.isCorrect) return;

  const existing = loadQcmErrorRecords();
  const qNorm = normalizeForKey(params.question.question);
  const filtered = existing.filter(
    (r) => !(r.deckId === params.deck.id && normalizeForKey(r.question) === qNorm)
  );

  const record: QcmErrorRecord = {
    id: `qerr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deckId: params.deck.id,
    deckTitle: params.deck.title,
    courseId: params.deck.courseId,
    sourceCourseTitle: params.deck.sourceCourseTitle,
    sourceFingerprint: params.deck.sourceFingerprint,
    questionId: params.question.id,
    question: params.question.question,
    options: params.question.options.map((o) => ({
      id: o.id,
      label: o.label,
      text: o.text,
      isCorrect: o.isCorrect,
    })),
    selectedOptionIds: params.selectedOptionIds,
    explanation: params.question.explanation || "",
    timestamp: Date.now(),
  };

  saveQcmErrorRecords([record, ...filtered]);
}

/**
 * Détermine si un QCM a été construit à partir d'un cours donné,
 * MÊME si l'utilisateur a donné un nom différent au QCM :
 *  1. Correspondance directe d'identifiant (deck.courseId === course.id)
 *  2. Correspondance d'intitulé (titre du QCM ou sourceCourseTitle vs titre du cours)
 *  3. Correspondance d'empreinte du cours (sourceFingerprint)
 *  4. Analyse lexicale croisée entre le texte du cours et le contenu des questions/explications du QCM
 */
export function isQuizBuiltFromCourse(
  deck: QuizDeck & {
    courseId?: string;
    sourceCourseTitle?: string;
    sourceFingerprint?: string;
  },
  course: FlashcardSourceCourse
): boolean {
  if (!deck || !course) return false;

  // 1. ID direct
  if (deck.courseId && deck.courseId === course.id) return true;

  // 2. Titre identique ou fortement apparenté
  const courseTitleNorm = normalizeForKey(formatLessonTitle(course.title));
  const rawCourseTitleNorm = normalizeForKey(course.title);
  const deckTitleNorm = normalizeForKey(deck.title || "");
  const sourceTitleNorm = normalizeForKey(deck.sourceCourseTitle || "");

  if (
    courseTitleNorm.length >= 4 &&
    (deckTitleNorm === courseTitleNorm ||
      deckTitleNorm === rawCourseTitleNorm ||
      (sourceTitleNorm && (sourceTitleNorm === courseTitleNorm || sourceTitleNorm === rawCourseTitleNorm)) ||
      deckTitleNorm.includes(courseTitleNorm) ||
      courseTitleNorm.includes(deckTitleNorm))
  ) {
    return true;
  }

  // Mots significatifs du cours (≥ 5 lettres)
  const courseWords = new Set(contentWords(course.content || "").filter((w) => w.length >= 5));
  if (courseWords.size < 10) return false;

  // 3. Empreinte enregistrée lors de la création du QCM
  if (deck.sourceFingerprint) {
    const fpWords = deck.sourceFingerprint.split(/\s+/).filter(Boolean);
    if (fpWords.length >= 8) {
      const hits = fpWords.filter((w) => courseWords.has(w)).length;
      if (hits / fpWords.length >= 0.55) return true;
    }
  }

  // 4. Analyse du contenu des questions/options/explications du QCM face au texte du cours
  const qcmText = (deck.questions || [])
    .map(
      (q) =>
        `${q.question || ""} ${(q.options || []).map((o) => o.text).join(" ")} ${q.explanation || ""}`
    )
    .join(" ");
  const qcmWords = Array.from(new Set(contentWords(qcmText).filter((w) => w.length >= 5)));
  if (qcmWords.length < 6) return false;

  const matchingWords = qcmWords.filter((w) => courseWords.has(w));
  const overlapRatio = matchingWords.length / qcmWords.length;

  return matchingWords.length >= 6 && overlapRatio >= 0.45;
}

export interface CourseQcmErrorStatus {
  /** QCMs reconnus comme issus de ce cours */
  matchedDecks: QuizDeck[];
  /** Questions ratées par l'étudiant sur ce cours */
  failedQuestions: Array<{
    deckId: string;
    deckTitle: string;
    subject: string;
    question: QuizQuestion;
  }>;
  /** La fonctionnalité « Depuis mes Erreurs QCM » est-elle accessible pour ce cours ? */
  isAccessible: boolean;
  /** Raison affichée à l'utilisateur */
  statusMessage: string;
}

/**
 * Analyse si l'utilisateur dispose d'un QCM fait avec ce cours ET d'erreurs commises sur ce QCM.
 * Si l'utilisateur n'a pas fait de QCM avec ce cours (ou n'y a commis aucune erreur),
 * `isAccessible` vaut `false` et la fonctionnalité devient inaccessible.
 */
export function getCourseQcmErrorStatus(
  course: FlashcardSourceCourse | null | undefined,
  allDecks: QuizDeck[]
): CourseQcmErrorStatus {
  if (!course) {
    return {
      matchedDecks: [],
      failedQuestions: [],
      isAccessible: false,
      statusMessage: "Sélectionnez d'abord un cours pour vérifier vos QCM associés.",
    };
  }

  const matchedDecks = allDecks.filter((d) => isQuizBuiltFromCourse(d, course));
  const errorRecords = loadQcmErrorRecords();

  // Erreurs rattachées soit à l'un des QCMs du cours, soit directement au cours par contenu
  const courseWords = new Set(contentWords(course.content || "").filter((w) => w.length >= 5));
  const matchedDeckIds = new Set(matchedDecks.map((d) => d.id));

  const failedQuestions: Array<{
    deckId: string;
    deckTitle: string;
    subject: string;
    question: QuizQuestion;
  }> = [];
  const seenQuestions = new Set<string>();

  // 1. Depuis le journal précis des erreurs QCM (hippocampus_qcm_errors_v1)
  for (const err of errorRecords) {
    let belongsToCourse =
      (err.courseId && err.courseId === course.id) || matchedDeckIds.has(err.deckId);

    if (!belongsToCourse && courseWords.size >= 10) {
      const errWords = Array.from(
        new Set(
          contentWords(
            `${err.question} ${err.options.map((o) => o.text).join(" ")} ${err.explanation}`
          ).filter((w) => w.length >= 5)
        )
      );
      const hits = errWords.filter((w) => courseWords.has(w)).length;
      if (errWords.length >= 4 && hits / errWords.length >= 0.45) {
        belongsToCourse = true;
      }
    }

    if (!belongsToCourse) continue;
    const key = normalizeForKey(err.question);
    if (seenQuestions.has(key)) continue;
    seenQuestions.add(key);

    failedQuestions.push({
      deckId: err.deckId,
      deckTitle: err.deckTitle,
      subject: course.subject || "QCM",
      question: {
        id: err.questionId,
        question: err.question,
        options: err.options,
        explanation: err.explanation,
      },
    });
  }

  // 2. Depuis failedQuestionIds éventuellement stockés directement sur le deck
  for (const deck of matchedDecks) {
    const failedIds = new Set<string>((deck as QuizDeck & { failedQuestionIds?: string[] }).failedQuestionIds || []);
    if (failedIds.size === 0) continue;
    for (const q of deck.questions || []) {
      if (!failedIds.has(q.id)) continue;
      const key = normalizeForKey(q.question);
      if (seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      failedQuestions.push({
        deckId: deck.id,
        deckTitle: deck.title,
        subject: deck.subject || course.subject || "QCM",
        question: q,
      });
    }
  }

  if (matchedDecks.length === 0 && failedQuestions.length === 0) {
    return {
      matchedDecks: [],
      failedQuestions: [],
      isAccessible: false,
      statusMessage: "Inaccessible : aucun QCM n'a encore été réalisé à partir de cette leçon.",
    };
  }

  if (failedQuestions.length === 0) {
    return {
      matchedDecks,
      failedQuestions: [],
      isAccessible: false,
      statusMessage:
        "Inaccessible : vous avez un QCM pour cette leçon, mais aucune erreur QCM n'y a été enregistrée. Entraînez-vous d'abord sur le QCM de ce cours.",
    };
  }

  return {
    matchedDecks,
    failedQuestions,
    isAccessible: true,
    statusMessage: `${failedQuestions.length} erreur(s) QCM détectée(s) sur cette leçon (${matchedDecks.map((d) => d.title).join(", ") || course.title}).`,
  };
}

/**
 * Construit les flashcards correspondant aux erreurs QCM commises par l'utilisateur sur ce cours.
 */
export function buildCourseFailedQcmFlashcards(
  course: FlashcardSourceCourse,
  failedItems: CourseQcmErrorStatus["failedQuestions"],
  customNode: string
): CalibratedFlashcard[] {
  const now = Date.now();
  const lesson = formatLessonTitle(course.title);

  return failedItems.map((item, idx) => {
    const q = item.question;
    const isJumelage = q.options.length === 2;
    const correctProps = q.options.filter((o) => o.isCorrect);
    const summary =
      q.explanation?.trim() ||
      (correctProps.length > 0
        ? `Réponse exacte : ${correctProps.map((o) => `${o.label}. ${o.text}`).join(" ; ")}`
        : "Consultez la correction détaillée ci-dessous.");

    return {
      id: `fc-qcm-err-${course.id}-${idx}-${now}`,
      courseId: course.id,
      lessonTitle: lesson,
      subject: course.subject || item.subject || "QCM",
      customNode: customNode || "Erreurs QCM",
      originMode: "qcm_error",
      qcmType: isJumelage ? "jumelage" : "multiple",
      question: q.question,
      answerSummary: summary,
      answerDetails: correctProps.map((o) => `${o.label}. ${o.text}`),
      qcmPropositions: q.options.map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      qcmExplanation: q.explanation,
      format: "qcm",
      generator: "qcm",
      importance: 5,
      contentKey: makeContentKey(q.question, summary),
      createdAt: now,
      intervalDays: 0,
      repetitionCount: 0,
      status: "new",
      srs: createNewSrsState(now),
    };
  });
}
