// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR DOCIMOLOGIQUE UNIVERSEL v2 — 100 % ADAPTATIF, ZÉRO CODAGE EN DUR
// - Analyse IA-first (Gemini 2.5 Flash via `dawjang-exam-ai`) : isolation
//   sémantique de la matière cible, vrais formats observés, corrélation aux
//   cours et analyse qualitative réelle du style de l'enseignant.
// - Génération double modèle (Claude Sonnet 4.6 + superviseur Gemini 2.5 Flash
//   via `dawjang-exam-ai`) : zéro détournement `mor-chat`, zéro QCM synthétique.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { getEdgeAccessToken } from "@/lib/edgeAuth";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  EXAM_ITEM_FORMATS,
  validateReviewedExamBlock,
  type ExamItemFormat,
  type ExamValidation,
  type ReviewedExamBlock,
} from "../../supabase/functions/_shared/exam-validation";
import {
  apportionExamCounts,
  createExamDesign,
  plannedOptionCount,
  type ExamDesign,
  type ObservedExamQuestion,
} from "../../supabase/functions/_shared/exam-design";
import {
  compareExamStyle,
  copiedExamStyleQuestions,
  examStyleQuestionsFromBlock,
  locateExamStyleSource,
  measureExamStyle,
  selectExamStyleReferences,
  styleExamples,
  type ExamStyleProfile,
  type ExamStyleQuestion,
  type ExamStyleReport,
} from "../../supabase/functions/_shared/exam-style";

export type { ExamDesign };

// Stubs neutres conservés uniquement pour rétrocompatibilité d'imports éventuels (aucune donnée figée active)
export const VERIFIED_SCANNED_EXAMS_CORPUS: ReadonlyArray<never> = [] as unknown as readonly never[];
export const looksLikeUcadExamFileName = (_fileName: string): boolean => false;
export const lookupPreExtractedExamCorpus = (_fileName: string): string | null => null;
export const findPreExtractedUcadExam = (_fileName: string): null => null;

export const EXAMEN_BLANC_EDGE_FUNCTION = "dawjang-exam-ai";
export const EXAMEN_BLANC_EDGE_ENDPOINTS = ["dawjang-exam-ai"] as const;

export type EBFormat =
  | "CAS_CLINIQUE"
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "JUMELAGE"
  | "ASSOCIATION"
  | "COMPLEMENT_MULTIPLE"
  | "QNS";

export const EB_FORMAT_LABELS: Record<EBFormat, string> = {
  CAS_CLINIQUE: "Dossier (énoncé commun à plusieurs questions)",
  ELECTION: "Élection (1 proposition exacte)",
  CENSURE: "Censure (1 proposition fausse / inexacte)",
  GROUPAGE: "Groupage (assertions numérotées et code de combinaisons)",
  JUMELAGE: "Jumelage (Cause à effet)",
  ASSOCIATION: "Association (Double colonne)",
  COMPLEMENT_MULTIPLE: "Complément multiple (Plusieurs réponses justes)",
  QNS: "Question rédactionnelle (QNS)",
};

export const EB_FORMAT_SHORT_LABELS: Record<EBFormat, string> = {
  CAS_CLINIQUE: "Dossier",
  ELECTION: "Élection",
  CENSURE: "Censure",
  GROUPAGE: "Groupage",
  JUMELAGE: "Jumelage",
  ASSOCIATION: "Association",
  COMPLEMENT_MULTIPLE: "Compl. Multiple",
  QNS: "QNS Rédactionnelle",
};

export interface EBLesson {
  id: string;
  title: string;
  cleanTitle: string;
  content: string;
  wordCount: number;
  sizeLabel: string;
  keywords: string[];
  discriminativePhrases: string[];
  headings: string[];
  relevance: number;
  duplicateOf?: string;
}

export interface EBAnnale {
  id: string;
  title: string;
  rawText: string;
  year: string;
  wordCount: number;
  sizeLabel: string;
}

export interface EBOption {
  letter: string;
  text: string;
}

export interface EBAssociationColumns {
  leftTitle: string;
  rightTitle: string;
  leftItems: Array<{ id: string; text: string }>;
  rightItems: Array<{ id: string; text: string }>;
}

export interface EBItem {
  id: string;
  number: number;
  format: EBFormat;
  lead?: string;
  stem: string;
  statements?: string[];
  groupageCodeHint?: string;
  associationColumns?: EBAssociationColumns;
  options: EBOption[];
  correct: string[];
  explanation: string;
  trapHighlight?: string;
  professorSyntaxNote?: string;
  sourceQuotes?: string[];
  lessonId?: string;
  lessonTitle?: string;
}

export interface EBBlock {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE";
  header?: string;
  vignette?: string;
  lessonIds: string[];
  reviewedBySecondModel?: boolean;
  validation?: ExamValidation;
  items: EBItem[];
}

export interface BlueprintSpec {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE";
  lessonIds: string[];
  formats: EBFormat[];
  targetItemCount?: number;
  optionCounts?: number[];
  groupageCode?: string;
}

export interface ExamAnalysisItem {
  examId: string;
  title: string;
  year: string;
  questionCount: number;
  caseCount: number;
  formatCounts: Partial<Record<EBFormat, number>>;
  lessonsUsed: string[];
  lessonQcmCounts: Record<
    string,
    {
      blocks: number;
      qcm: number;
      summary?: string;
      weak?: boolean;
      verbatimSamples?: string[];
    }
  >;
  summaryNotes?: string[];
  qualitativeStyleInsights?: string[];
  ignoredReason?: "OTHER_SUBJECT" | "DUPLICATE_EXAM";
  duplicateOfTitle?: string;
  audited: boolean;
  observedQuestions?: ObservedExamQuestion[];
  structureComplete?: boolean;
  aiRecovered?: boolean;
}

export interface LessonStat {
  lessonId: string;
  title: string;
  timesOut: number;
  examsAppeared: number;
  totalExams: number;
  totalQcm: number;
  percent: number | null;
  dominantFormats: EBFormat[];
  tracedAnnaleQuestions: number;
  professorVerbatimSamples?: string[];
  perExam: Array<{
    examId: string;
    examTitle: string;
    blocks: number;
    qcm: number;
    summary?: string;
    weak?: boolean;
  }>;
}

export function getObservedLessonFrequency(
  stat: Pick<LessonStat, "examsAppeared" | "totalExams">
): number | null {
  return stat.totalExams > 0 ? Math.round((100 * stat.examsAppeared) / stat.totalExams) : null;
}

export interface ProfessorStyleProfile {
  usesClinicalCases: boolean;
  clinicalCaseRatio: number;
  avgItemsPerCase: number;
  preferredFormats: EBFormat[];
  detectedGroupageCode: string;
  detectedJumelageConnector: string;
  typicalStemPatterns?: string[];
  globalVerbatimSamples?: string[];
  professorSignatureSummary: string;
  qualitativeStyleInsights?: string[];
  measuredQuestions?: number;
  measuredProfile?: ExamStyleProfile;
}

export interface FormatPerExamStat {
  format: EBFormat;
  totalCount: number;
  avgPerExam: number;
  avgPerExamRounded: number;
  avgWhenPresent: number;
  maxInSingleExam: number;
  maxExamTitle?: string;
  plannedInExamBlanc: number;
  isDominant: boolean;
  examsPresentCount: number;
  totalMeasuredExams: number;
  isRare: boolean;
  examOccurrences: Array<{ examTitle: string; year: string; count: number }>;
}

export interface CorpusAnalysis {
  subjectName: string;
  exams: ExamAnalysisItem[];
  minQcm: number;
  maxQcm: number;
  maxQcmExamTitle?: string;
  avgQcmPerExam: number;
  totalAnalyzedQcm: number;
  avgLessonsPerExam: number;
  quota: number;
  durationMin: number;
  formatDistribution: Partial<Record<EBFormat, number>>;
  formatPercentages?: Partial<Record<EBFormat, number>>;
  formatStatsPerExam?: FormatPerExamStat[];
  plannedExamFormatCounts?: Partial<Record<EBFormat, number>>;
  plannedExamTotalQcm?: number;
  lessonStats: LessonStat[];
  style: ProfessorStyleProfile;
  warnings: string[];
}

export interface AnalysisProgress {
  phase: "lecture" | "audit" | "redaction" | "verification";
  message: string;
  current: number;
  total: number;
}

export interface ExamSession {
  id: string;
  title: string;
  subtitle: string;
  subjectName: string;
  ueName: string;
  createdAt: string;
  durationMin: number;
  timerRemainingSec?: number;
  lessonTitles: string[];
  blocks: EBBlock[];
  answers: Record<string, string[]>;
  finished: boolean;
  score?: {
    found: number;
    wrong: number;
    total: number;
  };
  styleReport?: ExamStyleReport;
}

export interface AIAuditEntry {
  questionCount?: number;
  caseCount?: number;
  formatCounts?: Record<string, number>;
  ignoredReason?: "OTHER_SUBJECT" | "DUPLICATE_EXAM" | null;
  summaryNotes?: string[] | string;
  qualitativeStyleInsights?: string[];
  detectedGroupageCode?: string | null;
  observedQuestions?: ObservedExamQuestion[];
  lessonQcmCounts?: Record<
    string,
    number | { blocks?: number; qcm?: number; summary?: string; weak?: boolean }
  >;
  lessonBreakdown?:
    | Array<{
        lessonId?: string;
        lessonTitle: string;
        blocks: number;
        qcm: number;
        summary?: string;
      }>
    | Record<string, Record<string, number>>;
}

const SESSIONS_STORAGE_KEY = "dawjang_eb_sessions_v4_universal";
const INFINITE_LEDGER_STORAGE_KEY = "dawjang_eb_infinite_ghost_ledger_v1";

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu rédiges un examen blanc pour l'unité d'enseignement « {{UE}} », matière évaluée : « {{SUBJECT}} ». Chapitres couverts par la session : {{QUOTA}}.

RÈGLES :
1. Adapte-toi uniquement à la discipline « {{SUBJECT}} », au contenu des cours fournis et à la structure réellement mesurée dans ses annales. N'importe aucune notion, aucun contexte ni vocabulaire d'une autre matière ou d'un autre chapitre.
2. La structure de chaque bloc (dossier ou questions indépendantes, format et nombre de choix de chaque question) est imposée par le plan d'épreuve joint à la demande : ne la modifie jamais.
3. Reprends les tournures d'énoncé observées dans les annales en les appliquant exclusivement au chapitre demandé ; ne recopie jamais une question d'annale.
4. Avant de répondre, relis chaque question : la ou les lettres de \`correct\` doivent correspondre exactement aux lettres de \`options\` et à l'explication.`;

export const fillSystemPrompt = (
  ue: string,
  subject: string,
  quota: number,
  style?: ProfessorStyleProfile
): string => {
  const base = EXAMEN_BLANC_SYSTEM_PROMPT.replace(
    /\{\{UE\}\}/g,
    ue.trim() || `UE ${subject.trim() || "Universitaire"}`
  )
    .replace(/\{\{SUBJECT\}\}/g, subject.trim() || "Discipline évaluée")
    .replace(/\{\{QUOTA\}\}/g, String(quota || 4));

  if (!style) return base;

  const extraDna = [
    `\n=== PROFIL DE STYLE MESURÉ POUR « ${subject || "LA MATIÈRE"} » ===`,
    style.professorSignatureSummary ? `- ${style.professorSignatureSummary}` : "",
    style.detectedGroupageCode ? `- Code de groupage observé : ${style.detectedGroupageCode}` : "",
    ...(style.qualitativeStyleInsights || []).slice(0, 4).map((ins) => `- ${ins}`),
  ]
    .filter(Boolean)
    .join("\n");

  return `${base}\n${extraDna}`;
};

const STOPWORDS_FR = new Set([
  "dans", "avec", "pour", "sans", "sous", "chez", "entre", "vers", "plus", "moins",
  "tres", "tout", "tous", "toute", "toutes", "cette", "ces", "mais", "donc", "alors",
  "apres", "avant", "pendant", "depuis", "contre", "selon", "comme", "ainsi", "etre",
  "avoir", "faire", "peut", "sont", "elle", "elles", "nous", "vous", "leur", "leurs",
  "cours", "chapitre", "lecon", "module", "professeur", "docteur", "faculte", "examen",
  "patient", "patiente", "ans", "consulte", "clinique", "bilan", "suivantes", "suivant",
  "propositions", "proposition", "laquelle", "lequel", "parmi", "cochez", "cocher",
  "reponse", "reponses", "exacte", "fausse", "juste", "incorrecte", "question", "qcm",
  "master", "licence", "diagnostic", "traitement", "prise", "charge", "signes", "autres",
  "choix", "vraie", "vrai", "faux", "concernant", "indiquez", "quel", "quelle", "quels",
  "quelles", "lesquelles", "lesquels", "une", "des", "les", "aux", "par", "sur", "est",
]);

const VALID_OBSERVED_FORMATS = new Set<ObservedExamQuestion["format"]>([
  ...EXAM_ITEM_FORMATS,
  "QNS",
]);

export const normalizeText = (s: string): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const sizeLabelOf = (bytes: number): string => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
};

export const cleanLessonTitle = (rawName: string): string =>
  String(rawName || "")
    .replace(/\.(pdf|docx?|pptx?|txt|md|rtf|odt|png|jpe?g|webp)$/i, "")
    .replace(/\[[^\]]*(?:enregistr|auto\s*save|r[eé]cup[eé]r|copie|lecture\s*seule|compatibilit)[^\]]*\]/gi, " ")
    .replace(/\([^)]*(?:enregistr|auto\s*save|r[eé]cup[eé]r|copie|lecture\s*seule|compatibilit)[^)]*\)/gi, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/^(cours|lecon|chapitre|item|ue|module|td|tp)[\s_-]*\d*[\s_:-]*/i, "")
    .replace(/^\d{1,2}[\s_.-]+/, "")
    .replace(/\b20\d{2}\b[\s_-]*\d*/g, " ")
    .replace(/\(\s*\d+\s*\)\s*$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || String(rawName || "Cours");

export const formatSessionDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

/**
 * Purge de sécurité pour d'anciens caches navigateur pollués avant la v2.
 */
export function isCachedAnnaleCrossContaminated(title: string, rawText: string): boolean {
  if (!rawText || !title) return false;
  const normTitle = normalizeText(title);
  if (normTitle.includes("hemato") || normTitle.includes("systeme") || normTitle.includes("systemique")) {
    return false;
  }
  const head = rawText.slice(0, 600);
  return (
    head.includes("=== SECTION EC2 : MALADIES DE SYSTEME") ||
    head.includes("=== SECTION EC1 : HEMATOLOGIE") ||
    head.includes("UE Hématologie Maladies de système")
  );
}

// ============================================================================
// 1. INDEXATION LÉGÈRE DES COURS (100 % DYNAMIQUE, ZÉRO DICTIONNAIRE CODÉ EN DUR)
// ============================================================================
function extractBigrams(normText: string, maxCount = 50): string[] {
  const tokens = normText
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS_FR.has(t) && !/^\d+$/.test(t));
  const counts = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    counts.set(bg, (counts.get(bg) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([bg]) => bg);
}

export function buildLesson(
  id: string,
  fileName: string,
  content: string,
  byteSize: number,
  subjectInput: string
): EBLesson {
  const safeContent = String(content || "");
  const safeTitle = String(fileName || "Cours");
  const cleanTitle = cleanLessonTitle(safeTitle);
  const words = safeContent.split(/\s+/).filter(Boolean);

  const headings = safeContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length >= 4 &&
        l.length <= 130 &&
        (/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+[A-ZÉÈÊÀÂÎÔÛÇ]/i.test(l) ||
          /^#{1,4}\s+\S/.test(l) ||
          (l === l.toUpperCase() && /[A-ZÉÈÊÀÂÎÔÛÇ]{4,}/.test(l)))
    )
    .map((l) => l.replace(/^#{1,4}\s+/, "").trim())
    .slice(0, 60);

  const normFullText = normalizeText(`${cleanTitle} ${headings.join(" ")} ${safeContent.slice(0, 60000)}`);
  const freq = new Map<string, number>();
  for (const tok of normFullText.split(" ")) {
    if (tok.length < 4 || STOPWORDS_FR.has(tok) || /^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }

  const titleTokens = normalizeText(cleanTitle)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));
  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([k]) => k);

  const subjTokens = normalizeText(subjectInput)
    .split(" ")
    .filter((t) => t.length >= 4);

  return {
    id: String(id || `lesson-${Date.now()}`),
    title: safeTitle,
    cleanTitle,
    content: safeContent,
    wordCount: words.length,
    sizeLabel: sizeLabelOf(byteSize || safeContent.length),
    keywords: Array.from(new Set([...titleTokens, ...topKeywords])),
    discriminativePhrases: extractBigrams(normFullText, 50),
    headings,
    relevance: subjTokens.length === 0 || safeContent.length > 80 ? 1 : 0,
  };
}

export function ensureHydratedLesson(rawLesson: Partial<EBLesson>, subjectInput = ""): EBLesson {
  const rebuilt = buildLesson(
    String(rawLesson.id || `l-${Date.now()}`),
    String(rawLesson.title || rawLesson.cleanTitle || "Cours"),
    String(rawLesson.content || ""),
    rawLesson.content ? rawLesson.content.length : 1024,
    subjectInput
  );
  return {
    ...rebuilt,
    sizeLabel: rawLesson.sizeLabel || rebuilt.sizeLabel,
    duplicateOf: rawLesson.duplicateOf,
  };
}

export const flagDuplicateLessons = (lessons: EBLesson[]): EBLesson[] => {
  if (!Array.isArray(lessons)) return [];
  const seen = new Map<string, string>();
  return lessons.map((raw) => {
    const l = ensureHydratedLesson(raw);
    const sig = `${normalizeText(l.cleanTitle)}__${l.wordCount}`;
    const existing = seen.get(sig);
    if (existing && existing !== l.id) {
      return { ...l, duplicateOf: existing };
    }
    seen.set(sig, l.id);
    return { ...l, duplicateOf: undefined };
  });
};

// ============================================================================
// 2. APPEL DIRECT VERS `dawjang-exam-ai` (SANS DÉTOURNEMENT NI FAUX SECOURS)
// ============================================================================
const getEbSupabaseUrl = (): string =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.location?.origin?.startsWith("http")
    ? "/supabase-proxy"
    : import.meta.env.VITE_SUPABASE_URL || "https://vhzdbhdyytvaipkbcsvs.supabase.co";
const getEbSupabaseAnonKey = (): string =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

function isNetworkOrGatewayTimeoutError(err: unknown): boolean {
  const errObj = err as { status?: number; context?: { status?: number }; message?: string; name?: string } | null;
  const status = Number(errObj?.status || errObj?.context?.status || 0);
  const name = String(errObj?.name || "").toLowerCase();
  const msg = String(errObj?.message || err || "").toLowerCase();
  if ([502, 503, 504, 522, 524, 546].includes(status)) return true;
  if (status === 500 && /service indisponible|connexion internet/i.test(msg)) return true;
  return (
    name === "aborterror" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed") ||
    msg.includes("délai de génération dépassé") ||
    msg.includes("gateway timeout")
  );
}

async function invokeExamenBlancEdge(
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ data: any; error: any }> {
  let accessToken = await getEdgeAccessToken();
  if (!accessToken) {
    return {
      data: null,
      error: { status: 401, message: "Veuillez vous connecter pour utiliser l'Examen Blanc IA." },
    };
  }

  const ebUrl = getEbSupabaseUrl();
  const ebAnonKey = getEbSupabaseAnonKey();

  const executeFetch = async (token: string): Promise<{ data: any; error: any; status?: number }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${ebUrl}/functions/v1/${EXAMEN_BLANC_EDGE_FUNCTION}`, {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: ebAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const payload = await resp.json().catch(() => null);
      if (resp.ok) {
        return { data: payload, error: null, status: resp.status };
      }
      const issuesDetail =
        Array.isArray(payload?.issues) && payload.issues.length > 0
          ? ` (${payload.issues.slice(0, 2).join(" · ")})`
          : "";
      const errMsg =
        typeof payload?.error === "string"
          ? `${payload.error}${issuesDetail}`
          : typeof payload?.message === "string"
          ? `${payload.message}${issuesDetail}`
          : `Service indisponible (HTTP ${resp.status}).`;
      return { data: null, error: { status: resp.status, message: errMsg, issues: payload?.issues }, status: resp.status };
    } catch (err: any) {
      clearTimeout(timer);
      return { data: null, error: err };
    }
  };

  if (ebUrl && ebAnonKey) {
    const firstTry = await executeFetch(accessToken);
    if (firstTry.status === 401) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        const freshToken = refreshed.data?.session?.access_token;
        if (!refreshed.error && freshToken && freshToken !== accessToken) {
          return executeFetch(freshToken);
        }
      } catch {
        // garde le 401 initial
      }
    }
    return { data: firstTry.data, error: firstTry.error };
  }

  try {
    return await supabase.functions.invoke(EXAMEN_BLANC_EDGE_FUNCTION, {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err: any) {
    return { data: null, error: err };
  }
}

// ============================================================================
// 3. ANALYSE DOCIMOLOGIQUE 100 % IA-FIRST & CONSOLIDATION DU CORPUS
// ============================================================================
function matchLessonByTitleOrId(lessonIdOrTitle: string, usableLessons: EBLesson[]): EBLesson | null {
  if (!lessonIdOrTitle) return null;
  const direct = usableLessons.find((l) => l.id === lessonIdOrTitle);
  if (direct) return direct;

  const normTarget = normalizeText(lessonIdOrTitle);
  if (!normTarget) return null;
  let best: EBLesson | null = null;
  let bestScore = 0;
  const targetTokens = normTarget.split(" ").filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));

  for (const l of usableLessons) {
    const normL = normalizeText(`${l.cleanTitle} ${l.title}`);
    if (normL === normTarget || normL.includes(normTarget) || normTarget.includes(normL)) {
      return l;
    }
    let sc = 0;
    for (const tok of targetTokens) {
      if (normL.includes(tok)) sc += 2;
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = l;
    }
  }
  return bestScore >= 2 ? best : null;
}

function normalizeSummaryNotes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim().length > 0) return [raw.trim()];
  return [];
}

function normalizeFormatKey(raw: unknown): ObservedExamQuestion["format"] | null {
  const upper = String(raw || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^COMPLEMENTS?_MULTIPLES?$/, "COMPLEMENT_MULTIPLE");
  return VALID_OBSERVED_FORMATS.has(upper as ObservedExamQuestion["format"])
    ? (upper as ObservedExamQuestion["format"])
    : null;
}

function buildObservedQuestionsFromAiAudit(
  aiAudit: AIAuditEntry,
  annale: EBAnnale,
  usableLessons: EBLesson[]
): ObservedExamQuestion[] {
  const rawList = Array.isArray(aiAudit.observedQuestions) ? aiAudit.observedQuestions : [];
  const out: ObservedExamQuestion[] = [];
  const seenNums = new Set<number>();

  rawList.forEach((q, idx) => {
    const fmt = normalizeFormatKey(q?.format);
    if (!fmt) return;
    let num = Number(q?.number);
    if (!Number.isInteger(num) || num < 1 || seenNums.has(num)) num = idx + 1;
    seenNums.add(num);

    const stem = String(q?.stem || "").trim() || `Question ${num}`;
    const rawOptCount = Number(q?.optionCount);
    const validOpt =
      fmt === "QNS"
        ? 0
        : fmt === "JUMELAGE"
        ? 5
        : Number.isInteger(rawOptCount) && rawOptCount >= (fmt === "COMPLEMENT_MULTIPLE" ? 3 : 2) && rawOptCount <= 10
        ? rawOptCount
        : 5;
    const inCase = Boolean(q?.inCase);
    const matchedLesson = q?.lessonId ? matchLessonByTitleOrId(String(q.lessonId), usableLessons) : null;
    const tracedSource = locateExamStyleSource(annale.rawText || "", stem, annale.title, num);

    out.push({
      number: num,
      format: fmt,
      optionCount: validOpt,
      inCase,
      caseKey: inCase ? `${annale.title}#${q?.caseKey ? String(q.caseKey) : "dossier_1"}` : undefined,
      stem,
      sourceTitle: annale.title,
      lessonId: matchedLesson?.id,
      ...(tracedSource ? { source: { ...tracedSource, examId: annale.id } } : {}),
      aiRecovered: false,
    });
  });

  // Si l'audit a bien compté les formats mais omis observedQuestions, reconstruit la structure exacte des formats
  if (out.length === 0 && aiAudit.formatCounts && typeof aiAudit.formatCounts === "object") {
    let qNum = 1;
    const totalCaseCount = Number(aiAudit.caseCount) || 0;
    for (const [rawFmt, rawCnt] of Object.entries(aiAudit.formatCounts)) {
      const fmt = normalizeFormatKey(rawFmt);
      const cnt = Math.max(0, Math.round(Number(rawCnt) || 0));
      if (!fmt || cnt === 0) continue;
      for (let k = 0; k < cnt; k++) {
        out.push({
          number: qNum,
          format: fmt,
          optionCount: fmt === "QNS" ? 0 : 5,
          inCase: totalCaseCount > 0 && qNum <= totalCaseCount * 4,
          caseKey: totalCaseCount > 0 && qNum <= totalCaseCount * 4 ? `${annale.title}#dossier_${Math.ceil(qNum / 4)}` : undefined,
          stem: `Question ${qNum} (${EB_FORMAT_SHORT_LABELS[fmt]})`,
          sourceTitle: annale.title,
          aiRecovered: true,
        });
        qNum++;
      }
    }
  }

  return out;
}

function isMeasuredExam(exam: ExamAnalysisItem): boolean {
  return (
    !exam.ignoredReason &&
    exam.questionCount > 0 &&
    exam.structureComplete !== false &&
    Array.isArray(exam.observedQuestions) &&
    exam.observedQuestions.length > 0
  );
}

export function computeCorpusAnalysis(
  subjectName: string,
  rawLessons: EBLesson[],
  annales: EBAnnale[],
  aiAudits?: Record<string, AIAuditEntry>
): CorpusAnalysis {
  const hydratedLessons = flagDuplicateLessons(rawLessons);
  const usableLessons = hydratedLessons.filter((l) => !l.duplicateOf);

  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];
  const seenExamFingerprints = new Map<string, string>();
  const allQualitativeInsights: string[] = [];
  const allStemPatterns: string[] = [];
  let detectedGroupageCode = "";

  for (const annale of annales) {
    const rawText = String(annale.rawText || "");

    if (isCachedAnnaleCrossContaminated(annale.title, rawText)) {
      warnings.push(
        `« ${annale.title} » provenait d'un ancien cache erroné et a été écarté. Supprimez-le et ré-importez le fichier d'origine.`
      );
      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year,
        questionCount: 0,
        caseCount: 0,
        formatCounts: {},
        lessonsUsed: [],
        lessonQcmCounts: {},
        ignoredReason: "OTHER_SUBJECT",
        summaryNotes: ["Ancien cache écarté automatiquement : ré-importez ce fichier."],
        audited: true,
      });
      continue;
    }

    const aiAudit = aiAudits?.[annale.id];
    const aiSummaryNotes = normalizeSummaryNotes(aiAudit?.summaryNotes);
    const aiInsights = Array.isArray(aiAudit?.qualitativeStyleInsights)
      ? aiAudit!.qualitativeStyleInsights!.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    if (aiAudit?.ignoredReason === "OTHER_SUBJECT") {
      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year,
        questionCount: 0,
        caseCount: 0,
        formatCounts: {},
        lessonsUsed: [],
        lessonQcmCounts: {},
        ignoredReason: "OTHER_SUBJECT",
        summaryNotes: aiSummaryNotes.length
          ? aiSummaryNotes
          : [`Épreuve écartée : porte sur une autre matière que « ${subjectName} ».`],
        audited: true,
      });
      warnings.push(`« ${annale.title} » porte sur une autre matière que « ${subjectName} » : écartée du calcul.`);
      continue;
    }

    if (!aiAudit) {
      warnings.push(`« ${annale.title} » n'a pas pu être auditée par l'IA et a été exclue du calcul.`);
      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year,
        questionCount: 0,
        caseCount: 0,
        formatCounts: {},
        lessonsUsed: [],
        lessonQcmCounts: {},
        summaryNotes: ["Audit IA non abouti pour ce fichier — relancez l'analyse."],
        audited: false,
      });
      continue;
    }
    const observedQuestions = buildObservedQuestionsFromAiAudit(aiAudit, annale, usableLessons);

    const normFp = `${observedQuestions.length}__${normalizeText(
      observedQuestions.slice(0, 4).map((q) => q.stem).join(" ") || rawText.slice(0, 260)
    ).slice(0, 220)}`;
    if (observedQuestions.length > 0 && seenExamFingerprints.has(normFp)) {
      const origTitle = seenExamFingerprints.get(normFp)!;
      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year,
        questionCount: 0,
        caseCount: 0,
        formatCounts: {},
        lessonsUsed: [],
        lessonQcmCounts: {},
        ignoredReason: "DUPLICATE_EXAM",
        duplicateOfTitle: origTitle,
        summaryNotes: [`Doublon détecté de « ${origTitle} » — fusionné pour éviter le double comptage.`],
        audited: true,
      });
      warnings.push(`Doublon fusionné : « ${annale.title} » correspond déjà à « ${origTitle} ».`);
      continue;
    }

    if (aiAudit?.detectedGroupageCode && typeof aiAudit.detectedGroupageCode === "string") {
      const trimmedCode = aiAudit.detectedGroupageCode.trim();
      if (trimmedCode.length >= 6 && trimmedCode.toLowerCase() !== "null") {
        detectedGroupageCode = trimmedCode;
      }
    }

    const effectiveFormatCounts: Partial<Record<EBFormat, number>> = {};
    for (const q of observedQuestions) {
      effectiveFormatCounts[q.format] = (effectiveFormatCounts[q.format] || 0) + 1;
      formatDistribution[q.format] = (formatDistribution[q.format] || 0) + 1;
      if (q.stem && q.stem.length >= 16 && q.stem.length <= 185 && allStemPatterns.length < 20) {
        if (!allStemPatterns.includes(q.stem)) allStemPatterns.push(q.stem);
      }
    }

    const mergedLessonCounts: ExamAnalysisItem["lessonQcmCounts"] = {};
    if (aiAudit?.lessonQcmCounts && typeof aiAudit.lessonQcmCounts === "object") {
      for (const [key, val] of Object.entries(aiAudit.lessonQcmCounts)) {
        const matched = matchLessonByTitleOrId(key, usableLessons);
        if (!matched || val === null || val === undefined) continue;
        const isNum = typeof val === "number" || typeof val === "string";
        const qcmNum = isNum ? Number(val) : Number(val.qcm);
        if (qcmNum > 0) {
          const objVal = !isNum ? val : undefined;
          mergedLessonCounts[matched.id] = {
            blocks: Math.max(1, Number(objVal?.blocks) || 1),
            qcm: qcmNum,
            summary: objVal?.summary || `${qcmNum} QCM identifiés pour « ${matched.cleanTitle} »`,
            weak: false,
          };
        }
      }
    }

    if (Array.isArray(aiAudit?.lessonBreakdown)) {
      for (const item of aiAudit!.lessonBreakdown) {
        const matched = matchLessonByTitleOrId(item.lessonId || item.lessonTitle || "", usableLessons);
        if (matched && Number(item.qcm) > 0 && !mergedLessonCounts[matched.id]) {
          mergedLessonCounts[matched.id] = {
            blocks: Math.max(1, Number(item.blocks) || 1),
            qcm: Number(item.qcm),
            summary: item.summary || `${item.qcm} QCM identifiés`,
            weak: false,
          };
        }
      }
    }

    // Complète la corrélation depuis `observedQuestions.lessonId` si besoin
    for (const q of observedQuestions) {
      if (!q.lessonId) continue;
      if (!mergedLessonCounts[q.lessonId]) {
        mergedLessonCounts[q.lessonId] = {
          blocks: 1,
          qcm: 1,
          summary: `1 QCM (${EB_FORMAT_SHORT_LABELS[q.format]})`,
        };
      }
    }

    const finalQCount = observedQuestions.length;
    const finalCaseCount =
      Number(aiAudit?.caseCount) ||
      new Set(observedQuestions.filter((q) => q.inCase).map((q) => q.caseKey || "dossier")).size;

    if (finalQCount > 0) {
      seenExamFingerprints.set(normFp, annale.title);
      for (const ins of aiInsights) {
        if (!allQualitativeInsights.includes(ins) && allQualitativeInsights.length < 6) {
          allQualitativeInsights.push(ins);
        }
      }
    } else {
      warnings.push(`Aucune question détectée dans « ${annale.title} » pour « ${subjectName} ».`);
    }

    const fmtSummary = Object.entries(effectiveFormatCounts)
      .filter(([, c]) => (c || 0) > 0)
      .map(([f, c]) => `${c} ${EB_FORMAT_SHORT_LABELS[f as EBFormat] || f}`)
      .join(", ");

    exams.push({
      examId: annale.id,
      title: annale.title,
      year: annale.year,
      questionCount: finalQCount,
      caseCount: finalCaseCount,
      formatCounts: effectiveFormatCounts,
      lessonsUsed: Object.keys(mergedLessonCounts),
      lessonQcmCounts: mergedLessonCounts,
      observedQuestions,
      structureComplete: finalQCount > 0,
      aiRecovered: false,
      qualitativeStyleInsights: aiInsights,
      summaryNotes: aiSummaryNotes.length
        ? aiSummaryNotes
        : [
            `${finalQCount} question(s) de « ${subjectName} » analysée(s) dans « ${annale.title} » (${
              finalCaseCount > 0 ? `${finalCaseCount} dossier(s)` : "QCM indépendants"
            }) · ${Object.keys(mergedLessonCounts).length} chapitre(s) corrélé(s) · ${fmtSummary || "aucun format"}.`,
          ],
      audited: Boolean(aiAudit) || finalQCount > 0,
    });
  }

  const validExams = exams.filter((e) => !e.ignoredReason && e.questionCount > 0);
  const totalAnalyzedQcm = validExams.reduce((s, e) => s + e.questionCount, 0);

  const totalFmtSum = Object.values(formatDistribution).reduce((s, c) => s + (c || 0), 0);
  const formatPercentages: Partial<Record<EBFormat, number>> = {};
  if (totalFmtSum > 0) {
    const sortedFmts = Object.entries(formatDistribution)
      .filter(([, c]) => (c || 0) > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0));
    const percentages = apportionExamCounts(
      sortedFmts.map(([, count]) => count || 0),
      100
    );
    sortedFmts.forEach(([format], index) => {
      formatPercentages[format as EBFormat] = percentages[index];
    });
  }

  if ((formatDistribution.GROUPAGE || 0) === 0) detectedGroupageCode = "";

  const minQcm = validExams.length > 0 ? Math.min(...validExams.map((e) => e.questionCount)) : 0;
  const maxQcm = validExams.length > 0 ? Math.max(...validExams.map((e) => e.questionCount)) : 0;
  const maxExamItem = validExams.reduce<ExamAnalysisItem | null>(
    (best, e) => (!best || e.questionCount > best.questionCount ? e : best),
    null
  );
  const maxQcmExamTitle = maxExamItem
    ? `${cleanLessonTitle(maxExamItem.title)}${maxExamItem.year ? ` (${maxExamItem.year})` : ""}`
    : undefined;
  const avgQcmPerExam = validExams.length > 0 ? Math.round(totalAnalyzedQcm / validExams.length) : 0;

  const correlatedValidExams = validExams.filter((e) => e.lessonsUsed.length > 0);
  const rawAvgLessons =
    correlatedValidExams.length > 0
      ? correlatedValidExams.reduce((sum, e) => sum + e.lessonsUsed.length, 0) / correlatedValidExams.length
      : 0;
  const avgLessonsPerExam = Number(rawAvgLessons.toFixed(1));
  const quota = Math.max(
    1,
    Math.min(usableLessons.length, Math.round(rawAvgLessons) || Math.min(4, Math.max(1, usableLessons.length)))
  );

  const preferredFormats = Object.entries(formatDistribution)
    .filter(([, cnt]) => (cnt || 0) > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([f]) => f as EBFormat);
  const activeFormats: EBFormat[] = preferredFormats.length > 0 ? preferredFormats : ["ELECTION"];

  const lessonStats: LessonStat[] = usableLessons.map((lesson) => {
    const perExam: LessonStat["perExam"] = [];
    let totalQcm = 0;
    let timesOut = 0;

    for (const e of validExams) {
      const hit = e.lessonQcmCounts[lesson.id];
      if (hit && hit.qcm > 0) {
        perExam.push({
          examId: e.examId,
          examTitle: e.title,
          blocks: hit.blocks,
          qcm: hit.qcm,
          summary: hit.summary,
          weak: hit.weak,
        });
        totalQcm += hit.qcm;
        timesOut += hit.blocks;
      }
    }

    const examsAppeared = perExam.length;
    const lessonObserved = validExams
      .flatMap((exam) => exam.observedQuestions || [])
      .filter((q) => q.lessonId === lesson.id);

    return {
      lessonId: lesson.id,
      title: lesson.cleanTitle,
      timesOut,
      examsAppeared,
      totalExams: validExams.length,
      totalQcm,
      percent: getObservedLessonFrequency({ examsAppeared, totalExams: validExams.length }),
      dominantFormats: [...new Set(lessonObserved.map((q) => q.format))],
      tracedAnnaleQuestions: lessonObserved.filter((q) => Boolean(q.source)).length,
      perExam,
    };
  });

  lessonStats.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || b.totalQcm - a.totalQcm);

  const measuredExams = validExams.filter(isMeasuredExam);
  const measuredQuestions = measuredExams.flatMap((exam) => exam.observedQuestions!);
  const caseQuestions = measuredQuestions.filter((q) => q.inCase);
  const totalCases = new Set(caseQuestions.map((q) => q.caseKey || `${q.sourceTitle}#${q.number}`)).size;
  const usesClinicalCases = caseQuestions.length > 0;
  const clinicalCaseRatio = measuredQuestions.length > 0 ? caseQuestions.length / measuredQuestions.length : 0;
  const avgItemsPerCase = totalCases > 0 ? Number((caseQuestions.length / totalCases).toFixed(1)) : 0;

  const denomExams = Math.max(1, measuredExams.length);
  const prelimStats = preferredFormats.map((fmt, idx) => {
    const totalCount = formatDistribution[fmt] || 0;
    const examOccurrences = measuredExams
      .map((ex) => ({
        examTitle: ex.title,
        year: ex.year || "",
        count: Number(ex.formatCounts?.[fmt] || 0),
      }))
      .filter((occ) => occ.count > 0);
    const examsPresentCount = examOccurrences.length;
    const avgPerExam = Number((totalCount / denomExams).toFixed(1));
    const avgPerExamRounded = Math.max(1, Math.round(totalCount / denomExams));
    const avgWhenPresent = examsPresentCount > 0 ? Number((totalCount / examsPresentCount).toFixed(1)) : avgPerExam;
    const peakOcc = examOccurrences.reduce<{ examTitle: string; year: string; count: number } | null>(
      (best, occ) => (!best || occ.count > best.count ? occ : best),
      null
    );
    const maxInSingleExam = peakOcc ? peakOcc.count : 0;
    const maxExamTitle = peakOcc
      ? `${cleanLessonTitle(peakOcc.examTitle)}${peakOcc.year ? ` (${peakOcc.year})` : ""}`
      : undefined;
    const isRare =
      idx > 0 &&
      ((measuredExams.length >= 2 && examsPresentCount === 1) ||
        (measuredExams.length >= 4 && examsPresentCount <= Math.floor(measuredExams.length * 0.34)) ||
        (totalCount <= 2 && avgPerExam < 1.5 && preferredFormats.length > 1));
    return {
      format: fmt,
      totalCount,
      avgPerExam,
      avgPerExamRounded,
      avgWhenPresent,
      maxInSingleExam,
      maxExamTitle,
      isDominant: idx === 0,
      examsPresentCount,
      totalMeasuredExams: measuredExams.length,
      isRare,
      examOccurrences,
    };
  });

  const perExamNonQnsCounts = measuredExams
    .map((exam) => exam.observedQuestions!.filter((q) => q.format !== "QNS").length)
    .filter((cnt) => cnt > 0);
  const maxReferenceQuestionCount = perExamNonQnsCounts.length > 0 ? Math.max(...perExamNonQnsCounts) : 0;

  const rareFormatMinQuotas: Partial<Record<ExamItemFormat, number>> = {};
  for (const st of prelimStats) {
    if (st.isRare && st.format !== "QNS" && st.format !== "CAS_CLINIQUE") {
      rareFormatMinQuotas[st.format] = Math.max(1, st.maxInSingleExam || Math.round(st.avgWhenPresent) || 1);
    }
  }

  let plannedExamFormatCounts: Partial<Record<EBFormat, number>> = {};
  let plannedExamTotalQcm = maxReferenceQuestionCount || maxQcm || 12;
  if (maxReferenceQuestionCount > 0) {
    try {
      const previewDesign = createExamDesign({
        lessonIds: ["preview_calibre"],
        questions: measuredQuestions,
        referenceQuestionCount: maxReferenceQuestionCount,
        hasAnnales: true,
        preserveRareFormats:
          measuredExams.length >= 2 || (measuredExams.length === 1 && maxReferenceQuestionCount <= 35),
        rareFormatMinQuotas,
      });
      plannedExamFormatCounts = previewDesign.formatCounts;
      plannedExamTotalQcm = previewDesign.totalQuestions;
    } catch {
      // ignore preview error
    }
  }

  const formatStatsPerExam: FormatPerExamStat[] = prelimStats.map((st) => ({
    ...st,
    plannedInExamBlanc: Number(plannedExamFormatCounts[st.format] || 0),
  }));

  const measuredProfile = measureExamStyle(measuredQuestions.filter((q) => q.format !== "QNS"));

  const plannedFormatsSummary = formatStatsPerExam
    .filter((st) => st.plannedInExamBlanc > 0)
    .map(
      (st) =>
        `${st.plannedInExamBlanc} ${EB_FORMAT_SHORT_LABELS[st.format]}${
          st.isDominant ? " (dominant)" : st.isRare ? " (format rare)" : ""
        }`
    )
    .join(" · ");

  const subjectLabel = subjectName || "la matière";
  const professorSignatureSummary =
    measuredExams.length > 0
      ? `Analyse IA de ${measuredExams.length} épreuve(s) de « ${subjectLabel} » (${measuredQuestions.length} QCM) — Calibre retenu : ${plannedExamTotalQcm} QCM · ${
          usesClinicalCases ? "Dossiers + QCM indépendants" : "QCM directs indépendants (sans dossier)"
        }${plannedFormatsSummary ? ` · Quotas programmés : ${plannedFormatsSummary}` : ""}.`
      : annales.length > 0
      ? `Aucune question de « ${subjectLabel} » identifiée dans les annales importées : vérifiez la matière saisie ou la lisibilité des fichiers.`
      : `Mode entraînement sur ${usableLessons.length} chapitre(s) de « ${subjectLabel} » (calibre par défaut : 12 QCM à 5 propositions).`;

  return {
    subjectName,
    exams,
    minQcm,
    maxQcm,
    maxQcmExamTitle,
    avgQcmPerExam,
    totalAnalyzedQcm,
    avgLessonsPerExam,
    quota,
    durationMin: (maxQcm || avgQcmPerExam) > 25 ? 90 : 60,
    formatDistribution,
    formatPercentages,
    formatStatsPerExam,
    plannedExamFormatCounts,
    plannedExamTotalQcm,
    lessonStats,
    style: {
      usesClinicalCases,
      clinicalCaseRatio,
      avgItemsPerCase,
      preferredFormats: activeFormats,
      detectedGroupageCode,
      detectedJumelageConnector: "PARCE QUE",
      typicalStemPatterns: allStemPatterns.slice(0, 12),
      professorSignatureSummary,
      qualitativeStyleInsights: allQualitativeInsights,
      measuredQuestions: measuredQuestions.length,
      measuredProfile,
    },
    warnings,
  };
}

export function buildExamDesign(analysis: CorpusAnalysis, lessonIds: string[]): ExamDesign {
  const retained = analysis.exams.filter((exam) => !exam.ignoredReason && exam.questionCount > 0);
  if (retained.some((exam) => !Array.isArray(exam.observedQuestions))) {
    throw new Error("Analyse enregistrée avec une version antérieure : relancez l’analyse des annales.");
  }
  const measured = retained.filter(isMeasuredExam);
  const perExamNonQnsCounts = measured
    .map((exam) => exam.observedQuestions!.filter((q) => q.format !== "QNS").length)
    .filter((cnt) => cnt > 0);
  const maxReferenceQuestionCount = perExamNonQnsCounts.length > 0 ? Math.max(...perExamNonQnsCounts) : 0;

  const rareFormatMinQuotas: Partial<Record<ExamItemFormat, number>> = {};
  for (const st of analysis.formatStatsPerExam || []) {
    if (st.isRare && st.format !== "QNS" && st.format !== "CAS_CLINIQUE") {
      rareFormatMinQuotas[st.format] = Math.max(1, st.maxInSingleExam || Math.round(st.avgWhenPresent) || 1);
    }
  }

  return createExamDesign({
    lessonIds,
    questions: measured.flatMap((exam) => exam.observedQuestions!),
    referenceQuestionCount: maxReferenceQuestionCount,
    hasAnnales: analysis.exams.length > 0,
    preserveRareFormats:
      measured.length >= 2 || (measured.length === 1 && maxReferenceQuestionCount <= 35),
    rareFormatMinQuotas,
  });
}

export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI?: boolean;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, lessons, annales, useAI = true, onProgress, isCancelled } = params;
  const totalSteps = Math.max(1, annales.length + 2);
  const usableLessons = flagDuplicateLessons(lessons).filter((l) => !l.duplicateOf);
  const aiAudits: Record<string, AIAuditEntry> = {};

  onProgress?.({
    phase: "lecture",
    message: `Étape 1/3 — Préparation de ${usableLessons.length} cours pour « ${subjectName} »…`,
    current: 1,
    total: totalSteps,
  });

  // Audit IA-first par lots de 2 annales en parallèle sur `dawjang-exam-ai` (Gemini 2.5 Flash)
  const BATCH_SIZE = 2;
  const auditErrors: string[] = [];

  for (let startIdx = 0; startIdx < annales.length; startIdx += BATCH_SIZE) {
    if (isCancelled?.()) break;
    const slice = annales.slice(startIdx, startIdx + BATCH_SIZE);

    onProgress?.({
      phase: "audit",
      message: `Étape 2/3 — Analyse IA de « ${subjectName} » (${startIdx + 1}–${
        startIdx + slice.length
      }/${annales.length}) : ${slice.map((a) => `« ${a.title} »`).join(" & ")}…`,
      current: startIdx + 1,
      total: totalSteps,
    });

    await Promise.all(
      slice.map(async (annale) => {
        if (!useAI) return;
        const rawText = String(annale.rawText || "").trim();
        if (rawText.length < 40 || isCachedAnnaleCrossContaminated(annale.title, rawText)) return;

        const bodyPayload = {
          action: "audit_exam_annale",
          subjectName,
          examTitle: annale.title,
          examText: rawText.slice(0, 45000),
          requestObservedQuestions: true,
          lessons: usableLessons.map((l) => ({
            id: l.id,
            title: l.cleanTitle,
            keywords: (l.keywords || []).slice(0, 15),
          })),
        };

        let res = await invokeExamenBlancEdge(bodyPayload, 55000);
        if (res.error && isNetworkOrGatewayTimeoutError(res.error)) {
          await new Promise((r) => setTimeout(r, 800));
          res = await invokeExamenBlancEdge(bodyPayload, 55000);
        }

        if (!res.error && res.data) {
          const auditPayload = res.data?.audit || res.data;
          if (auditPayload && typeof auditPayload.questionCount === "number") {
            aiAudits[annale.id] = auditPayload as AIAuditEntry;
            return;
          }
        }

        const msg = String(res.error?.message || res.error || "Réponse IA vide");
        auditErrors.push(`« ${annale.title} » : ${msg}`);
      })
    );
  }

  if (useAI && annales.length > 0 && Object.keys(aiAudits).length === 0) {
    throw new Error(
      `L'audit IA n'a pu joindre le serveur sur aucune annale (${auditErrors[0] || "erreur réseau"}). Vérifiez votre connexion et relancez.`
    );
  }

  const result = computeCorpusAnalysis(subjectName, lessons, annales, aiAudits);

  onProgress?.({
    phase: "verification",
    message: `Étape 3/3 — Consolidation (${result.totalAnalyzedQcm} QCM de « ${subjectName} », calibre = ${result.plannedExamTotalQcm || result.maxQcm} QCM, quota = ${result.quota} chapitre(s))…`,
    current: totalSteps,
    total: totalSteps,
  });

  return result;
}

// ============================================================================
// 4. REGISTRE ANTI-RÉPÉTITION (MODE INFINI) & FENÊTRE TOURNANTE DU COURS
// ============================================================================
export interface LessonInfiniteMemory {
  lessonKey: string;
  generationCount: number;
  usedFactFingerprints: string[];
  usedStemFingerprints: string[];
  usedStemTexts: string[];
  usedVignetteSeeds: number[];
}

export interface InfiniteExamMemoryLedger {
  globalGenerationCounter: number;
  perLesson: Record<string, LessonInfiniteMemory>;
}

const createEmptyLedger = (): InfiniteExamMemoryLedger => ({
  globalGenerationCounter: 0,
  perLesson: {},
});

let inMemoryInfiniteLedger: InfiniteExamMemoryLedger | null = null;

export const loadInfiniteMemoryLedgerSync = (): InfiniteExamMemoryLedger => {
  if (inMemoryInfiniteLedger) return inMemoryInfiniteLedger;
  try {
    if (typeof localStorage === "undefined") return createEmptyLedger();
    const raw = localStorage.getItem(INFINITE_LEDGER_STORAGE_KEY);
    if (!raw) return createEmptyLedger();
    const parsed = JSON.parse(raw);
    return {
      globalGenerationCounter: Number(parsed?.globalGenerationCounter) || 0,
      perLesson: parsed?.perLesson && typeof parsed.perLesson === "object" ? parsed.perLesson : {},
    };
  } catch {
    return createEmptyLedger();
  }
};

export const loadInfiniteMemoryLedger = async (): Promise<InfiniteExamMemoryLedger> => {
  try {
    const idbData = await idbGet<InfiniteExamMemoryLedger>(INFINITE_LEDGER_STORAGE_KEY);
    if (idbData && typeof idbData.globalGenerationCounter === "number") {
      inMemoryInfiniteLedger = idbData;
      return idbData;
    }
    return loadInfiniteMemoryLedgerSync();
  } catch {
    return loadInfiniteMemoryLedgerSync();
  }
};

export const saveInfiniteMemoryLedger = async (ledger: InfiniteExamMemoryLedger): Promise<void> => {
  inMemoryInfiniteLedger = ledger;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(INFINITE_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    }
  } catch {
    // ignore quota
  }
  try {
    await idbSet(INFINITE_LEDGER_STORAGE_KEY, ledger);
  } catch {
    // ignore idb
  }
};

export const resetInfiniteMemoryLedger = async (): Promise<void> => {
  await saveInfiniteMemoryLedger(createEmptyLedger());
};

export const getInfiniteMemoryStats = (
  ledger?: InfiniteExamMemoryLedger
): { totalGenerations: number; totalUniqueQuestionsTracked: number } => {
  const active = ledger || loadInfiniteMemoryLedgerSync();
  const totalUniqueQuestionsTracked = Object.values(active.perLesson || {}).reduce(
    (sum, item) => sum + (item.usedStemFingerprints?.length || 0),
    0
  );
  return {
    totalGenerations: active.globalGenerationCounter || 0,
    totalUniqueQuestionsTracked,
  };
};

export function fingerprintText(text: string): string {
  const norm = normalizeText(text)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w))
    .slice(0, 14)
    .join("_");
  return norm || normalizeText(text).slice(0, 48);
}

function selectRotatedCourseWindow(
  lesson: EBLesson,
  generationCount: number
): { courseWindow: string; focusHeadings: string[] } {
  const raw = String(lesson.content || "");
  if (raw.length <= 22000) {
    return { courseWindow: raw, focusHeadings: (lesson.headings || []).slice(0, 6) };
  }
  const chunkCount = Math.min(6, Math.max(2, Math.ceil(raw.length / 5500)));
  const chunkSize = Math.ceil(raw.length / chunkCount);
  const chunks: string[] = [];
  for (let c = 0; c < chunkCount; c++) {
    chunks.push(raw.slice(c * chunkSize, (c + 1) * chunkSize));
  }
  const shift = generationCount % chunks.length;
  const rotated = [...chunks.slice(shift), ...chunks.slice(0, shift)];
  const headings = lesson.headings || [];
  const headingShift = headings.length > 0 ? (generationCount * 2) % headings.length : 0;
  const focusHeadings = [...headings.slice(headingShift), ...headings.slice(0, headingShift)].slice(0, 6);
  return {
    courseWindow: rotated.join("\n\n").slice(0, 22000),
    focusHeadings,
  };
}

// ============================================================================
// 5. GÉNÉRATION EXAMEN BLANC (SONNET 4.6 + SUPERVISEUR GEMINI 2.5 FLASH)
// ============================================================================
export async function generateExamBlanc(params: {
  ueName: string;
  subjectName: string;
  selected: EBLesson[];
  analysis: CorpusAnalysis;
  sessionSeed: number;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<{ blocks: EBBlock[]; warnings: string[]; styleReport?: ExamStyleReport }> {
  const { ueName, subjectName, selected, analysis, sessionSeed, onProgress, isCancelled } = params;
  const warnings: string[] = [];
  const allBlocks: EBBlock[] = [];

  if (selected.length === 0) {
    return { blocks: [], warnings: ["Aucune leçon sélectionnée."] };
  }

  const infiniteLedger = structuredClone(await loadInfiniteMemoryLedger());
  infiniteLedger.globalGenerationCounter = (infiniteLedger.globalGenerationCounter || 0) + 1;
  const globalGenNum = infiniteLedger.globalGenerationCounter;

  const hydratedSelected = selected.map((l) => ensureHydratedLesson(l, subjectName));
  const systemPrompt = fillSystemPrompt(ueName, subjectName, analysis.quota, analysis.style);
  const design = buildExamDesign(
    analysis,
    hydratedSelected.map((lesson) => lesson.id)
  );
  warnings.push(...design.warnings);

  const styleCorpus: ExamStyleQuestion[] = analysis.exams
    .filter(isMeasuredExam)
    .flatMap((exam) => exam.observedQuestions!)
    .filter((q) => q.format !== "QNS");
  const injectedExamples: ExamStyleQuestion[] = [];
  const totalSteps = design.blocks.length + 1;
  const generatedLessons = new Set<string>();

  for (let i = 0; i < design.blocks.length; i++) {
    if (isCancelled?.()) break;
    const plannedBlock = design.blocks[i];
    const lesson = hydratedSelected.find((candidate) => candidate.id === plannedBlock.lessonIds[0])!;
    const lessonQuota = plannedBlock.targetItemCount;

    const lessonKey = normalizeText(lesson.cleanTitle) || lesson.id;
    if (!infiniteLedger.perLesson[lessonKey]) {
      infiniteLedger.perLesson[lessonKey] = {
        lessonKey,
        generationCount: 0,
        usedFactFingerprints: [],
        usedStemFingerprints: [],
        usedStemTexts: [],
        usedVignetteSeeds: [],
      };
    }
    const lessonMem = infiniteLedger.perLesson[lessonKey];
    if (!generatedLessons.has(lesson.id)) {
      lessonMem.generationCount = (lessonMem.generationCount || 0) + 1;
      generatedLessons.add(lesson.id);
    }
    const currentLessonGen = lessonMem.generationCount;

    onProgress?.({
      phase: "redaction",
      message: `Rédaction Sonnet 4.6 & supervision Gemini 2.5 (${i + 1}/${
        design.blocks.length
      }) : « ${cleanLessonTitle(lesson.cleanTitle)} » (${lessonQuota} QCM)…`,
      current: i + 1,
      total: totalSteps,
    });

    const isCaseBlock = plannedBlock.kind === "CAS_CLINIQUE";
    const spec: BlueprintSpec = {
      ...plannedBlock,
      id: `block_${globalGenNum}_${i + 1}`,
      groupageCode: analysis.style?.detectedGroupageCode || "",
    };

    const { courseWindow, focusHeadings } = selectRotatedCourseWindow(lesson, currentLessonGen);
    const styleReferences = selectExamStyleReferences(styleCorpus, plannedBlock.formats, lesson.id);
    for (const example of styleExamples(styleReferences, lesson.id)) {
      if (
        !injectedExamples.some(
          (entry) =>
            entry.source?.title === example.source?.title &&
            entry.source?.lineStart === example.source?.lineStart &&
            entry.stem === example.stem
        )
      ) {
        injectedExamples.push(example);
      }
    }

    const effectiveSeed = globalGenNum * 37 + currentLessonGen * 23 + sessionSeed + i * 19;
    const maxChunkSize = isCaseBlock ? Math.min(4, spec.formats.length) : 3;
    const optionCountsList = spec.optionCounts || spec.formats.map(() => 5);
    const subSpecs: Array<{ subSpec: BlueprintSpec; startIdx: number }> = [];

    if (!isCaseBlock && spec.formats.length > maxChunkSize) {
      for (let startIdx = 0; startIdx < spec.formats.length; startIdx += maxChunkSize) {
        const subFormats = spec.formats.slice(startIdx, startIdx + maxChunkSize);
        const subOptionCounts = optionCountsList.slice(startIdx, startIdx + maxChunkSize);
        subSpecs.push({
          startIdx,
          subSpec: {
            ...spec,
            id: `${spec.id}_part_${subSpecs.length + 1}`,
            formats: subFormats,
            optionCounts: subOptionCounts,
            targetItemCount: subFormats.length,
          },
        });
      }
    } else {
      subSpecs.push({ startIdx: 0, subSpec: spec });
    }

    const accumulatedBlockStems: string[] = [];
    const verifiedSubBlocks: ReviewedExamBlock[] = [];
    const summarizeItemForMemory = (
      it: { stem: string; options?: EBOption[]; correct?: string[]; statements?: string[] },
      vignetteHint?: string
    ) => {
      const correctTexts = (it.options || [])
        .filter((o) => (it.correct || []).includes(o.letter))
        .map((o) => o.text)
        .join(" / ");
      const stmts = Array.isArray(it.statements) ? ` [${it.statements.slice(0, 4).join(" ; ")}]` : "";
      const vig = vignetteHint && vignetteHint.trim().length > 10 ? `[CAS: ${vignetteHint.trim().slice(0, 120)}] ` : "";
      return `${vig}${it.stem}${stmts} => CLÉ: ${correctTexts || it.options?.[0]?.text || ""}`;
    };

    const invokeSingleSubSpec = async (
      targetSubSpec: BlueprintSpec,
      seedOffset: number
    ): Promise<{ data: any; error: any }> => {
      const subRefs = selectExamStyleReferences(styleCorpus, targetSubSpec.formats, lesson.id);
      return invokeExamenBlancEdge(
        {
          action: "generate_examen_blanc_block",
          systemPrompt,
          ueName,
          subjectName,
          sessionSeed: effectiveSeed + seedOffset * 13,
          generationNumber: currentLessonGen,
          previouslyAskedStems: [...(lessonMem.usedStemTexts || []), ...accumulatedBlockStems].slice(-40),
          focusHeadings,
          lessonTitle: cleanLessonTitle(lesson.cleanTitle),
          lessonContent: courseWindow,
          blueprintSpec: targetSubSpec,
          professorStyle: {
            detectedGroupageCode: analysis.style?.detectedGroupageCode || "",
            typicalStemPatterns: analysis.style?.typicalStemPatterns || [],
            usesClinicalCases: isCaseBlock,
            avgItemsPerCase: analysis.style?.avgItemsPerCase,
          },
          styleReferences: subRefs.length > 0 ? subRefs : styleReferences,
          enableSonnetSelfCorrection: true,
          enableGeminiRepair: true,
        },
        65000
      );
    };

    for (let sIdx = 0; sIdx < subSpecs.length; sIdx++) {
      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
      const { subSpec, startIdx } = subSpecs[sIdx];
      if (subSpecs.length > 1) {
        onProgress?.({
          phase: "redaction",
          message: `Sonnet 4.6 + Gemini 2.5 (${i + 1}/${design.blocks.length}) : « ${cleanLessonTitle(
            lesson.cleanTitle
          )} » (QCM ${startIdx + 1}–${startIdx + subSpec.formats.length}/${lessonQuota})…`,
          current: i + 1,
          total: totalSteps,
        });
      }

      let { data, error } = await invokeSingleSubSpec(subSpec, sIdx);
      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };

      // Repli automatique en lots unitaires si un lot de 2-3 QCM dépasse le délai réseau ou renvoie 422
      if (
        error &&
        !isCaseBlock &&
        subSpec.formats.length > 1 &&
        (isNetworkOrGatewayTimeoutError(error) || Number(error?.status) === 422)
      ) {
        const unitOptionCounts = subSpec.optionCounts || subSpec.formats.map(() => 5);
        let splitFailedError: any = null;
        for (let u = 0; u < subSpec.formats.length; u++) {
          if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
          const unitSpec: BlueprintSpec = {
            ...subSpec,
            id: `${subSpec.id}_u${u + 1}`,
            formats: [subSpec.formats[u]],
            optionCounts: [unitOptionCounts[u]],
            targetItemCount: 1,
          };
          let unitRes = await invokeSingleSubSpec(unitSpec, sIdx * 10 + u + 1);
          if (unitRes.error && (isNetworkOrGatewayTimeoutError(unitRes.error) || Number(unitRes.error?.status) === 422)) {
            await new Promise((r) => setTimeout(r, 700));
            unitRes = await invokeSingleSubSpec(unitSpec, sIdx * 10 + u + 7);
          }
          if (unitRes.error || !unitRes.data?.block) {
            splitFailedError = unitRes.error || { message: "Le serveur de génération n’a pas répondu." };
            break;
          }
          const unitBlock = unitRes.data.block as ReviewedExamBlock;
          for (const it of unitBlock.items || []) {
            accumulatedBlockStems.push(summarizeItemForMemory(it, unitBlock.vignette));
          }
          verifiedSubBlocks.push(unitBlock);
        }
        if (!splitFailedError) continue;
        error = splitFailedError;
        data = null;
      } else if (error && (isNetworkOrGatewayTimeoutError(error) || Number(error?.status) === 422)) {
        await new Promise((r) => setTimeout(r, 800));
        const retryRes = await invokeSingleSubSpec(subSpec, sIdx + 17);
        data = retryRes.data;
        error = retryRes.error;
      }

      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
      if (error || !data?.block) {
        const errMsg = String(error?.message || error || "Réponse incomplète du serveur IA.");
        throw new Error(`« ${lesson.cleanTitle} » : ${errMsg}`);
      }

      const subBlock = data.block as ReviewedExamBlock;
      for (const it of subBlock.items || []) {
        accumulatedBlockStems.push(summarizeItemForMemory(it, subBlock.vignette));
      }
      verifiedSubBlocks.push(subBlock);
    }

    const verified: ReviewedExamBlock =
      verifiedSubBlocks.length === 1
        ? verifiedSubBlocks[0]
        : {
            kind: verifiedSubBlocks[0].kind,
            header: verifiedSubBlocks[0].header,
            ...(verifiedSubBlocks[0].vignette ? { vignette: verifiedSubBlocks[0].vignette } : {}),
            items: verifiedSubBlocks.flatMap((b) => b.items || []),
            validation: {
              version: 1,
              status: "passed",
              differentModel: verifiedSubBlocks.every((b) => Boolean(b.validation?.differentModel)),
              items: verifiedSubBlocks
                .flatMap((b) => b.validation?.items || [])
                .map((vItem, idx) => ({ ...vItem, index: idx })),
            },
          };

    const validationErrors = validateReviewedExamBlock(verified, spec, lesson.content);
    if (validationErrors.length) {
      throw new Error(`« ${lesson.cleanTitle} » : ${validationErrors.slice(0, 3).join(" ")}`);
    }

    const copiedIndexes = copiedExamStyleQuestions(
      styleReferences,
      examStyleQuestionsFromBlock(verified, lesson.id)
    );
    if (copiedIndexes.length) {
      warnings.push(
        `« ${lesson.cleanTitle} » : question(s) ${copiedIndexes.join(", ")} proche(s) d'un énoncé d'annale.`
      );
    }

    const items: EBItem[] = verified.items.map((item, index) => {
      const signature = `${item.stem} ${item.options.map((o) => o.text).join(" ")}`;
      const fingerprint = fingerprintText(signature);
      if (!lessonMem.usedStemFingerprints.includes(fingerprint)) {
        lessonMem.usedStemFingerprints.push(fingerprint);
        lessonMem.usedStemTexts.push(summarizeItemForMemory(item, verified.vignette));
      }
      return {
        ...item,
        id: `eb_${globalGenNum}_${i + 1}_${index + 1}`,
        number: index + 1,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
        sourceQuotes: [
          ...new Set(verified.validation.items[index].optionVerdicts.map((v) => v.sourceQuote)),
        ],
      };
    });

    if (lessonMem.usedStemTexts.length > 100) lessonMem.usedStemTexts = lessonMem.usedStemTexts.slice(-100);
    if (lessonMem.usedStemFingerprints.length > 200) {
      lessonMem.usedStemFingerprints = lessonMem.usedStemFingerprints.slice(-200);
    }

    allBlocks.push({
      ...verified,
      id: spec.id,
      lessonIds: [lesson.id],
      reviewedBySecondModel: verified.validation.differentModel,
      items,
    });
  }

  if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
  if (allBlocks.length === 0) throw new Error("Aucun bloc généré.");
  await saveInfiniteMemoryLedger(infiniteLedger);

  let globalNumber = 1;
  for (const b of allBlocks) {
    b.items = b.items.map((it) => ({ ...it, number: globalNumber++ }));
  }

  onProgress?.({
    phase: "verification",
    message: `Examen blanc vérifié prêt : ${globalNumber - 1} QCM (session #${globalGenNum}).`,
    current: totalSteps,
    total: totalSteps,
  });

  const styleReport = compareExamStyle(
    styleCorpus,
    allBlocks.flatMap((block) => examStyleQuestionsFromBlock(block, block.lessonIds[0])),
    injectedExamples
  );

  return { blocks: allBlocks, warnings, styleReport };
}

// ============================================================================
// 6. PERSISTANCE, SCORING, EXPORT PDF & SECOURS DE LECTURE LOCAL
// ============================================================================
export const loadSessions = (): ExamSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveSessions = (sessions: ExamSession[]): void => {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 12)));
  } catch {
    // ignore quota
  }
};

export const loadSessionsAsync = async (): Promise<ExamSession[]> => {
  try {
    const idbData = await idbGet<ExamSession[]>(SESSIONS_STORAGE_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) return idbData;
    const legacy = loadSessions();
    if (legacy.length > 0) await idbSet(SESSIONS_STORAGE_KEY, legacy);
    return legacy;
  } catch {
    return loadSessions();
  }
};

export const saveSessionsAsync = async (sessions: ExamSession[]): Promise<void> => {
  try {
    await idbSet(SESSIONS_STORAGE_KEY, sessions);
  } catch {
    saveSessions(sessions);
  }
};

export const isItemCorrect = (item: EBItem, chosen: string[]): boolean => {
  if (!chosen || chosen.length === 0) return false;
  if (item.format === "QNS") {
    const answerText = (chosen[0] || "").trim();
    if (answerText.length < 8) return false;
    const answerNorm = normalizeText(answerText);
    const expectedTerms = Array.from(
      new Set(
        normalizeText(`${item.explanation || ""} ${item.correct?.[0] || ""}`)
          .split(" ")
          .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w))
      )
    );
    if (expectedTerms.length === 0) return answerText.length >= 12;
    const hits = expectedTerms.filter((t) => answerNorm.includes(t)).length;
    return hits >= Math.min(3, Math.max(1, Math.ceil(expectedTerms.length * 0.2)));
  }
  const a = [...chosen].map((x) => x.toUpperCase()).sort().join(",");
  const b = [...item.correct].map((x) => x.toUpperCase()).sort().join(",");
  return a === b;
};

export const computeScore = (blocks: EBBlock[], answers: Record<string, string[]>) => {
  const allItems = blocks.flatMap((b) => b.items);
  let found = 0;
  let wrong = 0;
  let answered = 0;
  for (const it of allItems) {
    const ch = answers[it.id] || [];
    if (ch.length > 0 && ch[0] !== "") {
      answered++;
      if (isItemCorrect(it, ch)) found++;
      else wrong++;
    }
  }
  return {
    found,
    wrong,
    total: allItems.length,
    answered,
    remaining: Math.max(0, allItems.length - answered),
  };
};

export const sessionToPdfQuestions = (session: ExamSession): any[] =>
  session.blocks.flatMap((block) =>
    block.items.map((it, idx) => {
      const stemParts: string[] = [];
      if (it.lead && block.kind === "CAS_CLINIQUE") {
        stemParts.push(it.lead.trim());
      }
      stemParts.push(it.stem.trim());

      if (it.format === "JUMELAGE" && Array.isArray(it.statements) && it.statements.length >= 2) {
        stemParts.push(
          `Première proposition : ${it.statements[0]}\nPARCE QUE\nSeconde proposition : ${it.statements[1]}`
        );
      } else if (
        it.format === "ASSOCIATION" &&
        it.associationColumns &&
        it.associationColumns.leftItems.length >= 2 &&
        it.associationColumns.rightItems.length >= 2
      ) {
        const leftLines = it.associationColumns.leftItems.map((l) => `${l.id}) ${l.text}`).join("\n");
        const rightLines = it.associationColumns.rightItems.map((r) => `${r.id}. ${r.text}`).join("\n");
        stemParts.push(
          `${it.associationColumns.leftTitle} :\n${leftLines}\n${it.associationColumns.rightTitle} :\n${rightLines}`
        );
      } else if (it.format === "GROUPAGE" && Array.isArray(it.statements) && it.statements.length > 0) {
        stemParts.push(...it.statements.map((s, i) => `${i + 1}. ${s.replace(/^\s*\d+\s*[.)-]\s*/, "").trim()}`));
      }

      return {
        id: it.id,
        number: it.number,
        type: block.kind === "CAS_CLINIQUE" ? `Dossier · ${EB_FORMAT_SHORT_LABELS[it.format]}` : EB_FORMAT_LABELS[it.format] || "QCM",
        qcmType: block.kind === "CAS_CLINIQUE" ? "cas_clinique" : it.format.toLowerCase(),
        groupageCodeHint: it.format === "GROUPAGE" ? it.groupageCodeHint : undefined,
        clinicalCase: idx === 0 && block.kind === "CAS_CLINIQUE" ? block.vignette : undefined,
        clinicalCaseHeader: idx === 0 && block.kind === "CAS_CLINIQUE" ? block.header : undefined,
        question: stemParts.filter(Boolean).join("\n"),
        options: it.options.map((o) => `${o.letter}. ${o.text}`),
        correct: it.correct,
        correctAnswers: it.correct,
        explanation: it.explanation,
      };
    })
  );

export async function rescueFileReadLocally(
  file: File,
  _mode: "courses" | "annales" = "annales"
): Promise<{ success: boolean; content: string; usedVision: boolean }> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (ext === "pdf" || file.type === "application/pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const version = pdfjsLib.version || "5.4.149";
      if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        try {
          const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          if (workerModule?.default) pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        }
      }
      const arrayBuffer = await file.arrayBuffer();
      const cdnBase = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}`;
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        wasmUrl: `${cdnBase}/wasm/`,
        iccUrl: `${cdnBase}/iccs/`,
        standardFontDataUrl: `${cdnBase}/standard_fonts/`,
        cMapUrl: `${cdnBase}/cmaps/`,
        cMapPacked: true,
        isEvalSupported: true,
        verbosity: 0,
      } as any).promise;

      const pageTexts: Array<string | null> = new Array(pdf.numPages).fill(null);
      for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
        const page = await pdf.getPage(pNum);
        const tc = await page.getTextContent();
        const text = tc.items
          .map((item: any) => ("str" in item ? String(item.str || "") : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text.length > 0) pageTexts[pNum - 1] = `--- PAGE ${pNum} ---\n${text}`;
      }
      const joined = pageTexts.filter(Boolean).join("\n\n").trim();
      if (joined.length >= 25) return { success: true, content: joined, usedVision: false };

      const { ocrPdfDocument } = await import("@/lib/ocrEngine");
      const ocrRes = await ocrPdfDocument(file);
      if (ocrRes.text && ocrRes.text.trim().length >= 20) {
        return { success: true, content: ocrRes.text.trim(), usedVision: true };
      }
    } catch {
      // Fallback texte brut ci-dessous
    }
  }

  try {
    const rawText = await file.text();
    if (rawText && rawText.trim().length >= 20 && !rawText.startsWith("%PDF")) {
      return { success: true, content: rawText.trim(), usedVision: false };
    }
  } catch {
    // ignore
  }

  return { success: false, content: "", usedVision: false };
}
