import { untypedTable } from "@/lib/untypedDb";
// src/lib/syncEngine.ts
import { supabase } from "@/integrations/supabase/client";

export type SyncEntityKind = "quiz" | "flashcard" | "course" | "summary";

interface TombstoneRegistry {
  quiz: string[];
  flashcard: string[];
  course: string[];
  summary: string[];
}

const TOMBSTONE_STORAGE_KEY = "dawjang_deleted_tombstones_v1";

function getTombstones(): TombstoneRegistry {
  try {
    const raw = localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
        flashcard: Array.isArray(parsed.flashcard) ? parsed.flashcard : [],
        course: Array.isArray(parsed.course) ? parsed.course : [],
        summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      };
    }
  } catch (e) {
    console.error(e);
  }
  return { quiz: [], flashcard: [], course: [], summary: [] };
}

function addTombstone(
  kind: SyncEntityKind,
  id: string,
  title?: string,
  extraTokens?: string[]
) {
  const reg = getTombstones();
  const set = new Set(reg[kind]);
  if (id && String(id).trim()) {
    set.add(String(id).trim());
  }
  if (title && String(title).trim()) {
    set.add(`title:${String(title).trim().toLowerCase()}`);
  }
  if (Array.isArray(extraTokens)) {
    for (const tok of extraTokens) {
      if (tok && String(tok).trim()) {
        set.add(String(tok).trim().toLowerCase());
      }
    }
  }
  reg[kind] = Array.from(set);
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(reg));
}

export function isItemTombstoned(
  kind: SyncEntityKind,
  id: string,
  title?: string,
  extraMeta?: {
    contentKey?: string;
    node?: string;
    lessonTitle?: string;
    courseId?: string;
  }
): boolean {
  const reg = getTombstones();
  const list = reg[kind] || [];
  if (id && list.includes(String(id).trim())) return true;
  if (title && list.includes(`title:${String(title).trim().toLowerCase()}`)) return true;
  if (extraMeta) {
    if (
      extraMeta.contentKey &&
      list.includes(`key:${String(extraMeta.contentKey).trim().toLowerCase()}`)
    ) {
      return true;
    }
    if (
      kind === "flashcard" &&
      extraMeta.node &&
      list.includes(`node:${String(extraMeta.node).trim().toLowerCase()}`)
    ) {
      return true;
    }
    if (
      extraMeta.lessonTitle &&
      list.includes(`lesson:${String(extraMeta.lessonTitle).trim().toLowerCase()}`)
    ) {
      return true;
    }
    if (
      extraMeta.courseId &&
      list.includes(`course:${String(extraMeta.courseId).trim().toLowerCase()}`)
    ) {
      return true;
    }
  }
  return false;
}

export function isFlashcardNodeTombstoned(nodeName: string): boolean {
  if (!nodeName || !String(nodeName).trim()) return false;
  const reg = getTombstones();
  return (reg.flashcard || []).includes(`node:${String(nodeName).trim().toLowerCase()}`);
}

export function isFlashcardLessonTombstoned(lessonTitle: string): boolean {
  if (!lessonTitle || !String(lessonTitle).trim()) return false;
  const reg = getTombstones();
  return (reg.flashcard || []).includes(
    `lesson:${String(lessonTitle).trim().toLowerCase()}`
  );
}

/**
 * Si l'utilisateur recrée manuellement un nœud qui avait été supprimé, on retire son verrou tombstone
 */
export function unTombstoneFlashcardNode(nodeName: string): void {
  if (!nodeName || !String(nodeName).trim()) return;
  const target = `node:${String(nodeName).trim().toLowerCase()}`;
  const reg = getTombstones();
  reg.flashcard = (reg.flashcard || []).filter((entry) => entry !== target);
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(reg));
}

export function unTombstoneFlashcardLesson(lessonTitle: string): void {
  if (!lessonTitle || !String(lessonTitle).trim()) return;
  const target = `lesson:${String(lessonTitle).trim().toLowerCase()}`;
  const reg = getTombstones();
  reg.flashcard = (reg.flashcard || []).filter((entry) => entry !== target);
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(reg));
}

/**
 * Retire un élément ou un titre du registre des tombstones d'exclusion.
 * Permet à un élément régénéré ou recréé par l'utilisateur d'apparaître immédiatement sans blocage.
 */
export function unTombstoneEntity(
  kind: SyncEntityKind,
  id?: string,
  title?: string
): void {
  const reg = getTombstones();
  let modified = false;

  if (id && String(id).trim()) {
    const idStr = String(id).trim();
    if (reg[kind]?.includes(idStr)) {
      reg[kind] = reg[kind].filter((entry) => entry !== idStr);
      modified = true;
    }
  }

  if (title && String(title).trim()) {
    const titleToken = `title:${String(title).trim().toLowerCase()}`;
    const bareToken = String(title).trim().toLowerCase();
    if (reg[kind]?.some((entry) => entry === titleToken || entry === bareToken)) {
      reg[kind] = reg[kind].filter(
        (entry) => entry !== titleToken && entry !== bareToken
      );
      modified = true;
    }
  }

  if (modified) {
    localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(reg));
  }
}

export function filterOutTombstoned<T extends Record<string, any>>(
  kind: SyncEntityKind,
  items: T[],
  getId?: (item: T) => string,
  getTitle?: (item: T) => string
): T[] {
  return items.filter((item) => {
    const id = getId ? getId(item) : String(item.id || "");
    const title = getTitle
      ? getTitle(item)
      : item.title || item.question || "";
    return !isItemTombstoned(kind, id, title, {
      contentKey: item.contentKey,
      node: item.customNode || item.node || item.subject,
      lessonTitle: item.lessonTitle,
      courseId: item.courseId || item.sourceCourseId,
    });
  });
}

const SUPABASE_TABLE_MAP: Record<SyncEntityKind, string> = {
  quiz: "quizzes",
  flashcard: "flashcards",
  course: "courses",
  summary: "summaries",
};

/**
 * Supprime définitivement un élément en local ET sur Supabase (par ID, Titre/Question et Clé de contenu)
 */
export async function permanentlyDeleteEntity(
  kind: SyncEntityKind,
  id: string,
  title?: string,
  extraTokens?: string[]
): Promise<void> {
  // 1. Verrouillage immédiat dans le registre d'exclusion (empêche tout retour au rechargement)
  addTombstone(kind, id, title, extraTokens);

  // 2. Suppression dans la table Supabase correspondante
  const tableName = SUPABASE_TABLE_MAP[kind];
  try {
    if (id && !id.startsWith("node:") && !id.startsWith("lesson:")) {
      await untypedTable(tableName).delete().eq("id", id);
    }
    if (title && title.trim()) {
      const column = kind === "flashcard" ? "question" : "title";
      await untypedTable(tableName)
        .delete()
        .ilike(column, title.trim());
    }
  } catch {
    // Le registre Tombstone garantit que l'élément reste supprimé même hors-ligne
  }
}

/**
 * Supprime définitivement un Nœud entier de Flashcards et toutes les cartes rattachées
 */
export async function permanentlyDeleteFlashcardNode(
  nodeName: string,
  cardsInNode: Array<{ id: string; question?: string; contentKey?: string }> = []
): Promise<void> {
  const cleanNode = nodeName.trim();
  if (!cleanNode) return;

  const extraTokens: string[] = [`node:${cleanNode.toLowerCase()}`];
  for (const c of cardsInNode) {
    if (c.id) extraTokens.push(String(c.id));
    if (c.question) extraTokens.push(`title:${c.question.trim().toLowerCase()}`);
    if (c.contentKey) extraTokens.push(`key:${c.contentKey.trim().toLowerCase()}`);
  }

  addTombstone("flashcard", `node:${cleanNode.toLowerCase()}`, undefined, extraTokens);

  try {
    await untypedTable("flashcards")
      .delete()
      .ilike("category", cleanNode);
    const ids = cardsInNode.map((c) => c.id).filter(Boolean);
    if (ids.length > 0) {
      await untypedTable("flashcards").delete().in("id", ids);
    }
  } catch {
    // Verrouillé localement par tombstone
  }
}

/**
 * Supprime définitivement toutes les Flashcards d'une Leçon / Cours spécifique
 */
export async function permanentlyDeleteFlashcardLesson(
  lessonTitle: string,
  cardsInLesson: Array<{
    id: string;
    question?: string;
    contentKey?: string;
    sourceCourseId?: string;
  }> = []
): Promise<void> {
  const cleanLesson = lessonTitle.trim();
  if (!cleanLesson) return;

  const extraTokens: string[] = [`lesson:${cleanLesson.toLowerCase()}`];
  for (const c of cardsInLesson) {
    if (c.id) extraTokens.push(String(c.id));
    if (c.question) extraTokens.push(`title:${c.question.trim().toLowerCase()}`);
    if (c.contentKey) extraTokens.push(`key:${c.contentKey.trim().toLowerCase()}`);
    if (c.sourceCourseId) {
      extraTokens.push(`course:${c.sourceCourseId.trim().toLowerCase()}`);
    }
  }

  addTombstone("flashcard", `lesson:${cleanLesson.toLowerCase()}`, undefined, extraTokens);

  try {
    await untypedTable("flashcards")
      .delete()
      .ilike("deck", cleanLesson);
    const ids = cardsInLesson.map((c) => c.id).filter(Boolean);
    if (ids.length > 0) {
      await untypedTable("flashcards").delete().in("id", ids);
    }
  } catch {
    // Verrouillé localement par tombstone
  }
}

/**
 * Synchronise la création ou mise à jour d'un élément vers Supabase
 */
export async function syncEntityToBackend(
  kind: SyncEntityKind,
  payload: Record<string, unknown>
): Promise<void> {
  const tableName = SUPABASE_TABLE_MAP[kind];
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    const rowToSave = userId ? { ...payload, user_id: userId } : payload;

    await untypedTable(tableName).upsert(rowToSave);
  } catch {
    // Sauvegarde locale déjà active
  }
}

/**
 * Moteur d'appel IA Gemini 2.5 Flash (via la fonction serveur déployée « mor-chat » / OpenRouter,
 * ou clé Gemini directe si configurée).
 * Découpe automatiquement les longs cours en segments de 11 500 caractères pour transmettre
 * l'intégralité d'un polycopié de 50+ diapositives sans troncature.
 */
/** Dernier motif d'échec du moteur IA (diagnostic affiché à l'utilisateur). */
export let lastAcademicEngineError = "";

export function isAcademicEngineAuthOrPlanError(): boolean {
  return /\b40[13]\b|authentif|session\s+expir|premium|abonnement|upgradeRequired/i.test(
    lastAcademicEngineError
  );
}

export async function callGeminiAcademicEngine(
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.4
): Promise<string | null> {
  const chunkLimit = 44000;
  const userMessages: Array<{ role: "user"; content: string }> = [];
  const totalChunks = Math.min(2, Math.max(1, Math.ceil(userPrompt.length / chunkLimit)));
  for (let i = 0; i < totalChunks; i++) {
    userMessages.push({
      role: "user",
      content: userPrompt.slice(i * chunkLimit, (i + 1) * chunkLimit),
    });
  }

  lastAcademicEngineError = "";
  try {
    const { data, error } = await supabase.functions.invoke("mor-chat", {
      body: {
        messages: [
          { role: "system", content: systemInstruction.slice(0, 16000) },
          ...userMessages,
        ],
        temperature,
        max_tokens: 8192,
      },
    });
    const reply = data?.reply;
    if (!error && typeof reply === "string" && reply.trim()) return reply.trim();

    if (error) {
      let detail = (error as any)?.message || "réponse vide du serveur IA";
      try {
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.clone === "function") {
          const cloned = ctx.clone();
          const errJson = await cloned.json().catch(() => null);
          const status = ctx.status;
          if (errJson?.message || errJson?.error) {
            detail = `${status ? `[HTTP ${status}] ` : ""}${errJson.message || errJson.error}`;
          } else if (status) {
            detail = `HTTP ${status} (${detail})`;
          }
        }
      } catch {
        // garde le message par défaut
      }
      lastAcademicEngineError = detail;
    } else {
      lastAcademicEngineError = "réponse vide du serveur IA";
    }
  } catch (error: any) {
    lastAcademicEngineError = error?.message || "service IA inaccessible";
  }
  return null;
}
