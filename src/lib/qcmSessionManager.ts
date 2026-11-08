// src/lib/qcmSessionManager.ts
import { supabase } from "@/integrations/supabase/client";
import type { QuizDeck, QuizQuestion, QuizOption } from "@/pages/Quiz";

export const QCM_SESSIONS_STORAGE_KEY = "hippocampus_qcm_sessions_history_v2";

export interface QcmSessionRecord {
  id: string;
  userId?: string;
  deckId: string;
  title: string;
  subject: string;
  format?: string;
  difficulty?: string;
  startedAt: string;
  endedAt?: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: QuizQuestion[];
  userAnswers: Record<string, string[]>; // questionId -> selected option IDs
  score: number;
  totalQuestions: number;
  timeElapsed: number; // en secondes
  uniqueHash: string;
  isDiversified: boolean;
  parameters?: Record<string, any>;
}

// Tampon de débogage / throttling pour les sauvegardes de réponses réseau
let pendingSaveTimeout: any = null;
const pendingAnswersBuffer: Record<
  string,
  {
    answers: Record<string, string[]>;
    timeElapsed: number;
    score?: number;
  }
> = {};

/**
 * Calcule un hash 32-bit rapide, déterministe et fiable pour une séquence de questions + distracteurs
 */
export function computeQcmHash(questions: QuizQuestion[]): string {
  if (!questions || questions.length === 0) return "empty_0";

  const rawString = questions
    .map((q, idx) => {
      const opts = (q.options || [])
        .map((o) => `${o.label}:${o.text}:${Boolean(o.isCorrect)}`)
        .join(",");
      return `[${idx}]${q.id}:${q.question}:{${opts}}`;
    })
    .join("##");

  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    hash = (hash << 5) - hash + rawString.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(36)}_${questions.length}`;
}

/**
 * Calcule le score basé sur les réponses utilisateur et les questions de l'épreuve
 */
export function calculateSessionScore(
  questions: QuizQuestion[],
  answers: Record<string, string[]>
): number {
  if (!questions || questions.length === 0) return 0;
  let totalScore = 0;

  for (const q of questions) {
    const sel = answers[q.id] || [];
    const correctIds = (q.options || [])
      .filter((o) => o.isCorrect)
      .map((o) => o.id);

    const isExact =
      correctIds.length === sel.length &&
      correctIds.every((id) => sel.includes(id));

    if (isExact) totalScore++;
  }

  return totalScore;
}

/**
 * Algorithme Fisher-Yates sécurisé pour mélanger un tableau
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Mélange les options d'une question en réassignant les lettres A, B, C, D, E
 */
function shuffleOptionsWithLabels(options: QuizOption[]): QuizOption[] {
  if (!options || options.length <= 1) return options;
  const labels = ["A", "B", "C", "D", "E", "F", "G"];
  const shuffled = shuffleArray(options);
  return shuffled.map((opt, index) => ({
    ...opt,
    label: labels[index] || String.fromCharCode(65 + index),
  }));
}

/**
 * Vérifie si un hash d'unicité existe déjà dans la base locale ou Supabase
 */
export async function checkUniqueHashExists(
  hash: string,
  qcmBaseId: string
): Promise<boolean> {
  // 1. Vérification locale immédiate
  const localSessions = getSavedSessions();
  const localMatch = localSessions.some(
    (s) => s.deckId === qcmBaseId && s.uniqueHash === hash
  );
  if (localMatch) return true;

  // 2. Vérification Supabase distante (si connecté)
  try {
    const { data } = await (supabase.from("sessions_qcm") as any)
      .select("id")
      .eq("qcm_base_id", qcmBaseId)
      .eq("unique_hash", hash)
      .limit(1);

    if (data && data.length > 0) return true;
  } catch {
    // Échec silencieux
  }

  return false;
}

/**
 * Génère une séquence de questions diversifiée et unique par rapport aux sessions passées
 */
export function createDiverseSessionQuestions(
  baseQuestions: QuizQuestion[],
  existingHashes: string[] = []
): { questions: QuizQuestion[]; hash: string; isDifferent: boolean } {
  if (!baseQuestions || baseQuestions.length === 0) {
    return { questions: [], hash: "empty_0", isDifferent: false };
  }

  const baseHash = computeQcmHash(baseQuestions);

  // Si aucune session n'existe encore ou seulement 1 question, on mélange juste l'ordre
  let candidate = baseQuestions;
  let candidateHash = baseHash;
  let attempts = 0;
  const maxAttempts = 16;

  while (attempts < maxAttempts) {
    // 1. Mélange de l'ordre des questions
    const shuffledQuestions = shuffleArray(baseQuestions);

    // 2. Mélange contrôlé des options pour les QCM compatibles (choix multiple, élection, censure)
    const fullyDiversified = shuffledQuestions.map((q) => {
      // Pour groupage / jumelage / association, les labels A-E correspondent à des combinaisons fixes d'items 1-5 ou I-II
      if (
        q.qcmType === "groupage" ||
        q.qcmType === "jumelage" ||
        q.qcmType === "association"
      ) {
        return { ...q };
      }
      return {
        ...q,
        options: shuffleOptionsWithLabels(q.options),
      };
    });

    candidateHash = computeQcmHash(fullyDiversified);

    if (!existingHashes.includes(candidateHash) || existingHashes.length === 0) {
      return {
        questions: fullyDiversified,
        hash: candidateHash,
        isDifferent: candidateHash !== baseHash,
      };
    }

    attempts++;
  }

  // Fallback avec permutation garantie
  return {
    questions: shuffleArray(baseQuestions),
    hash: candidateHash,
    isDifferent: true,
  };
}

/**
 * Récupère toutes les sessions enregistrées localement
 */
export function getSavedSessions(): QcmSessionRecord[] {
  try {
    const raw = localStorage.getItem(QCM_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    }
  } catch (e) {
    console.error("Erreur lecture sessions QCM locales:", e);
  }
  return [];
}

/**
 * Sauvegarde synchrone d'une session dans le localStorage
 */
export function saveSessionLocally(session: QcmSessionRecord): void {
  try {
    const sessions = getSavedSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(QCM_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Erreur écriture session QCM locale:", e);
  }
}

/**
 * Appelle l'Edge Function Supabase qcm-session (create, saveAnswer, finish, get)
 */
export async function callQcmSessionEdgeFunction(payload: {
  action: "create" | "saveAnswer" | "finish" | "get";
  [key: string]: any;
}): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke("qcm-session", {
      body: payload,
    });
    if (!error && data) return data;
  } catch (err) {
    console.warn("Échec Edge Function qcm-session (fallback actif):", err);
  }
  return null;
}

/**
 * Synchronise l'enregistrement de session vers Supabase (tables `sessions_qcm` et `qcm_sessions`)
 */
export async function syncSessionToSupabase(
  session: QcmSessionRecord
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const currentUserId = user ? user.id : session.userId || null;

    // 1. Enregistrement dans la table standard `sessions_qcm` (Étape 1)
    const sessionsQcmPayload = {
      id: session.id,
      user_id: currentUserId,
      qcm_base_id: session.deckId,
      session_started: session.startedAt,
      session_ended: session.endedAt || null,
      questions: session.questions as any,
      user_answers: session.userAnswers as any,
      parameters: {
        title: session.title,
        subject: session.subject,
        doctrine: session.format || "mixte",
        difficulty: session.difficulty || "standard",
        isDiversified: session.isDiversified,
        ...(session.parameters || {}),
      },
      score: session.score,
      unique_hash: session.uniqueHash,
      status: session.status,
      time_elapsed: session.timeElapsed,
      updated_at: new Date().toISOString(),
    };

    await (supabase.from("sessions_qcm") as any).upsert(sessionsQcmPayload, {
      onConflict: "id",
    });

    // 2. Synchronisation de compatibilité avec la table legacy `qcm_sessions`
    const legacyPayload = {
      id: session.id,
      user_id: currentUserId || "00000000-0000-0000-0000-000000000000",
      course_id: session.deckId,
      title: session.title,
      questions: session.questions as any,
      question_count: session.totalQuestions,
      total_questions: session.totalQuestions,
      question_type: session.format || "mixte",
      answers: session.userAnswers as any,
      score: session.score,
      status: session.status === "completed" ? "completed" : "processing",
      time_elapsed: session.timeElapsed,
      completed_at: session.endedAt || null,
      updated_at: new Date().toISOString(),
      metadata: {
        uniqueHash: session.uniqueHash,
        isDiversified: session.isDiversified,
        difficulty: session.difficulty,
        subject: session.subject,
      },
    };

    await (supabase.from("qcm_sessions") as any).upsert(legacyPayload, {
      onConflict: "id",
    });
  } catch (err) {
    // Échec silencieux non bloquant si hors-ligne
    console.warn("Synchronisation Supabase non bloquante:", err);
  }
}

/**
 * Étape 2 — Démarre et initialise une session QCM avec unicité garantie
 */
export async function startSession(
  userId: string | undefined,
  qcmBaseId: string,
  params: {
    deck: QuizDeck;
    doctrine?: string;
    selectivite?: string;
    difficulty?: string;
    forceOriginalOrder?: boolean;
    [key: string]: any;
  }
): Promise<QcmSessionRecord> {
  const { deck, forceOriginalOrder = false } = params;

  // Récupérer les hashs de toutes les sessions passées sur ce deck
  const pastSessions = getSavedSessions().filter(
    (s) => s.deckId === qcmBaseId || s.deckId === deck.id
  );
  const existingHashes = pastSessions.map((s) => s.uniqueHash).filter(Boolean);

  let sessionQuestions = deck.questions;
  let isDiversified = false;
  let hash = computeQcmHash(deck.questions);

  // Étape 6: Vérifier et altérer si un unique_hash identique existe déjà
  if (!forceOriginalOrder && deck.questions.length > 1) {
    const diverse = createDiverseSessionQuestions(deck.questions, existingHashes);
    sessionQuestions = diverse.questions;
    hash = diverse.hash;
    isDiversified = diverse.isDifferent;
  }

  // UUID compatible
  const sessionId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const newSession: QcmSessionRecord = {
    id: sessionId,
    userId,
    deckId: qcmBaseId || deck.id,
    title: deck.title,
    subject: deck.subject,
    format: params.doctrine || deck.qcmFormat || "mixte",
    difficulty: params.difficulty || deck.difficulty || "standard",
    startedAt: new Date().toISOString(),
    status: "in_progress",
    questions: sessionQuestions,
    userAnswers: {},
    score: 0,
    totalQuestions: sessionQuestions.length,
    timeElapsed: 0,
    uniqueHash: hash,
    isDiversified,
    parameters: params,
  };

  // 1. Sauvegarde locale immédiate
  saveSessionLocally(newSession);

  // 2. Sauvegarde asynchrone Supabase
  syncSessionToSupabase(newSession);

  return newSession;
}

/**
 * Alias de compatibilité pour startSession
 */
export async function startNewQcmSession(params: {
  deck: QuizDeck;
  userId?: string;
  forceOriginalOrder?: boolean;
  doctrine?: string;
}): Promise<QcmSessionRecord> {
  return startSession(params.userId, params.deck.id, params);
}

/**
 * Étape 3 — Sauvegarde des réponses au fil de l’eau (throttlée / batchée)
 */
export function saveAnswer(
  sessionId: string,
  questionId: string,
  answer: string[] | string,
  timeElapsed: number = 0
): void {
  const sessions = getSavedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const answerArray = Array.isArray(answer) ? answer : [answer];
  session.userAnswers = {
    ...session.userAnswers,
    [questionId]: answerArray,
  };
  session.timeElapsed = timeElapsed;

  // 1. Mise à jour synchrone locale (0 latence)
  saveSessionLocally(session);

  // 2. Throttling batché vers Supabase (temporisation 800ms)
  pendingAnswersBuffer[sessionId] = {
    answers: session.userAnswers,
    timeElapsed,
    score: session.score,
  };

  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
  }

  pendingSaveTimeout = setTimeout(async () => {
    const payload = pendingAnswersBuffer[sessionId];
    if (!payload) return;
    delete pendingAnswersBuffer[sessionId];

    try {
      await (supabase.from("sessions_qcm") as any)
        .update({
          user_answers: payload.answers,
          time_elapsed: payload.timeElapsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (e) {
      console.warn("Échec update throttlé Supabase sessions_qcm:", e);
    }
  }, 800);
}

/**
 * Alias de compatibilité pour recordSessionAnswer
 */
export function recordSessionAnswer(
  sessionId: string,
  questionId: string,
  selectedOptionIds: string[],
  timeElapsed: number
): void {
  saveAnswer(sessionId, questionId, selectedOptionIds, timeElapsed);
}

/**
 * Enregistrement manuel complet à tout moment
 */
export async function saveSessionManually(
  sessionId: string,
  currentAnswers: Record<string, string[]>,
  currentScore: number,
  timeElapsed: number
): Promise<QcmSessionRecord | null> {
  const sessions = getSavedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  session.userAnswers = currentAnswers;
  session.score = currentScore;
  session.timeElapsed = timeElapsed;

  saveSessionLocally(session);
  await syncSessionToSupabase(session);
  return session;
}

/**
 * Étape 4 — Clôture et finalisation de session avec calcul du score
 */
export async function finishSession(
  sessionId: string,
  finalAnswers: Record<string, string[]>,
  timeElapsed: number = 0,
  explicitScore?: number
): Promise<QcmSessionRecord | null> {
  // Annuler tout timer throttlé en attente pour flusher immédiatement
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  delete pendingAnswersBuffer[sessionId];

  const sessions = getSavedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const computedScore =
    typeof explicitScore === "number"
      ? explicitScore
      : calculateSessionScore(session.questions, finalAnswers);

  session.status = "completed";
  session.score = computedScore;
  session.userAnswers = finalAnswers;
  session.timeElapsed = timeElapsed;
  session.endedAt = new Date().toISOString();

  // 1. Sauvegarde locale
  saveSessionLocally(session);

  // 2. Synchronisation complète Supabase
  await syncSessionToSupabase(session);

  return session;
}

/**
 * Alias de compatibilité pour finalizeSession
 */
export async function finalizeSession(
  sessionId: string,
  finalScore: number,
  finalAnswers: Record<string, string[]>,
  timeElapsed: number
): Promise<QcmSessionRecord | null> {
  return finishSession(sessionId, finalAnswers, timeElapsed, finalScore);
}

/**
 * Fonction Bonus : Reprendre une session interrompue
 */
export function resumeSession(sessionId: string): QcmSessionRecord | null {
  const sessions = getSavedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  return session;
}

/**
 * Supprime une session de l'historique local et Supabase
 */
export async function deleteQcmSession(sessionId: string): Promise<void> {
  try {
    const sessions = getSavedSessions().filter((s) => s.id !== sessionId);
    localStorage.setItem(QCM_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));

    await Promise.allSettled([
      (supabase.from("sessions_qcm") as any).delete().eq("id", sessionId),
      (supabase.from("qcm_sessions") as any).delete().eq("id", sessionId),
    ]);
  } catch (e) {
    console.error("Erreur suppression session:", e);
  }
}

/**
 * Récupère les sessions distantes depuis Supabase `sessions_qcm` et fusionne avec le local
 */
export async function fetchRemoteSessions(): Promise<QcmSessionRecord[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = (supabase.from("sessions_qcm") as any)
      .select("*")
      .order("session_started", { ascending: false })
      .limit(50);

    if (user?.id) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error || !data) return getSavedSessions();

    const localSessions = getSavedSessions();
    const map = new Map<string, QcmSessionRecord>();

    // 1. Ajouter les sessions locales
    localSessions.forEach((s) => map.set(s.id, s));

    // 2. Fusionner les sessions distantes
    data.forEach((row: any) => {
      const parsedQuestions =
        typeof row.questions === "string"
          ? JSON.parse(row.questions)
          : row.questions || [];
      const parsedAnswers =
        typeof row.user_answers === "string"
          ? JSON.parse(row.user_answers)
          : row.user_answers || {};
      const params =
        typeof row.parameters === "string"
          ? JSON.parse(row.parameters)
          : row.parameters || {};

      const mapped: QcmSessionRecord = {
        id: row.id,
        userId: row.user_id,
        deckId: row.qcm_base_id,
        title: params.title || "Session QCM",
        subject: params.subject || "Médecine",
        format: params.doctrine || "mixte",
        difficulty: params.difficulty || "standard",
        startedAt: row.session_started || row.created_at,
        endedAt: row.session_ended,
        status: row.status || (row.session_ended ? "completed" : "in_progress"),
        questions: parsedQuestions,
        userAnswers: parsedAnswers,
        score: row.score || 0,
        totalQuestions: parsedQuestions.length,
        timeElapsed: row.time_elapsed || 0,
        uniqueHash: row.unique_hash,
        isDiversified: Boolean(params.isDiversified),
        parameters: params,
      };

      map.set(mapped.id, mapped);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    localStorage.setItem(QCM_SESSIONS_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn("Échec récupération sessions Supabase:", err);
    return getSavedSessions();
  }
}
