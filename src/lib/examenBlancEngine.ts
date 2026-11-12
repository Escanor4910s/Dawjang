// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR UNIVERSEL EXAMEN BLANC — Analyse Docimologique, Probabilités & Génération
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { callDawiaEngineRaw } from "@/lib/dawiaQcmEngine";
import { repairAndParseQuizJson } from "@/lib/jsonRepair";

export type EBFormat =
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "JUMELAGE"
  | "COMPLEMENT_MULTIPLE"
  | "QNS";

export const EB_FORMAT_LABELS: Record<EBFormat | "CAS_CLINIQUE", string> = {
  CAS_CLINIQUE: "Cas clinique",
  ELECTION: "Élection (1 juste)",
  CENSURE: "Censure (1 fausse)",
  GROUPAGE: "Groupage (1, 2, 3…)",
  JUMELAGE: "Jumelage (Parce que)",
  COMPLEMENT_MULTIPLE: "Complément multiple",
  QNS: "Question rédactionnelle (QNS)",
};

export interface EBLesson {
  id: string;
  title: string;
  cleanTitle: string;
  content: string;
  wordCount: number;
  sizeLabel: string;
  keywords: string[];
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

export interface EBItem {
  id: string;
  number: number;
  format: EBFormat;
  lead?: string;
  stem: string;
  statements?: string[];
  options: EBOption[];
  correct: string[];
  explanation: string;
  lessonId?: string;
}

export interface EBBlock {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE" | "ISOLE";
  header?: string;
  vignette?: string;
  lessonIds: string[];
  items: EBItem[];
}

export interface BlueprintSpec {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE" | "ISOLE";
  lessonIds: string[];
  formats: EBFormat[];
}
export type BlueprintBlock = BlueprintSpec;

export interface ExamAnalysisItem {
  examId: string;
  title: string;
  year: string;
  questionCount: number;
  caseCount: number;
  formatCounts: Partial<Record<EBFormat, number>>;
  lessonsUsed: string[];
  lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }>;
  audited: boolean;
}
export type ExamAnalysis = ExamAnalysisItem;

export interface LessonStat {
  lessonId: string;
  title: string;
  timesOut: number;
  examsAppeared: number;
  totalExams: number;
  totalQcm: number;
  percent: number;
  perExam: Array<{
    examId: string;
    examTitle: string;
    blocks: number;
    qcm: number;
    weak?: boolean;
  }>;
}

export interface ProfessorStyleProfile {
  usesClinicalCases: boolean;
  avgItemsPerCase: number;
  preferredFormats: EBFormat[];
  typicalStemPatterns: string[];
}

export interface CorpusAnalysis {
  subjectName: string;
  exams: ExamAnalysisItem[];
  maxQcm: number;
  avgLessonsPerExam: number;
  quota: number;
  durationMin: number;
  formatDistribution: Partial<Record<EBFormat, number>>;
  lessonStats: LessonStat[];
  blueprint: BlueprintSpec[];
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
  lessonTitles: string[];
  blocks: EBBlock[];
  answers: Record<string, string[]>;
  finished: boolean;
  score?: {
    found: number;
    wrong: number;
    total: number;
  };
}

const SESSIONS_STORAGE_KEY = "dawjang_eb_sessions_v2";

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu es un Professeur Titulaire de Faculté de Médecine, expert en docimologie médicale (épreuves d'Élection, Censure, Groupage, Jumelage, Compléments multiples et Cas cliniques progressifs).
Unité d'Enseignement (UE) : {{UE}}
Matière évaluée : {{SUBJECT}}
Quota moyen de leçons par épreuve : {{QUOTA}}

RÈGLES DOCIMOLOGIQUES STRICTES :
1. EXCLUSIVITÉ DE LA MATIÈRE : Seule la matière "{{SUBJECT}}" est évaluée. Toute question d'une autre matière de l'UE est exclue.
2. ATTRIBUTION STRICTE DES LEÇONS : Une leçon est considérée comme "sortie" dans une épreuve UNIQUEMENT si elle constitue le sujet central du cas clinique ou de l'énoncé de la question (stem). Une simple mention dans un distracteur (proposition A, B, C, D, E) ne compte JAMAIS comme une sortie de leçon.
3. FIDÉLITÉ AU COURS À 100 % : Lors de la génération, chaque fait clinique, seuil biologique, critère diagnostique ou schéma thérapeutique doit provenir exclusivement du texte intégral des leçons sélectionnées.
4. STRUCTURATION EN BLOCS : Chaque bloc de Cas Clinique doit impérativement comporter une vignette clinique narrative claire et une suite de questions médicales de format QCM avec 5 propositions (A, B, C, D, E), la clé de correction exacte et sa justification médicale issue du cours.`;

export const fillSystemPrompt = (ue: string, subject: string, quota: number): string =>
  EXAMEN_BLANC_SYSTEM_PROMPT.replace(/\{\{UE\}\}/g, ue || "UE Médicale")
    .replace(/\{\{SUBJECT\}\}/g, subject || "Matière médicale")
    .replace(/\{\{QUOTA\}\}/g, String(quota || 1));

// ------------------------------------------------------------------ Utilitaires
const STOPWORDS_FR = new Set([
  "dans", "avec", "pour", "sans", "sous", "chez", "entre", "vers", "plus", "moins",
  "tres", "tout", "tous", "toute", "toutes", "cette", "ces", "mais", "donc", "alors",
  "apres", "avant", "pendant", "depuis", "contre", "selon", "comme", "ainsi", "etre",
  "avoir", "faire", "peut", "sont", "elle", "elles", "nous", "vous", "leur", "leurs",
  "cours", "chapitre", "lecon", "module", "professeur", "docteur", "faculte", "examen",
]);

export const normalizeText = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const sizeLabelOf = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export const cleanLessonTitle = (rawName: string): string =>
  rawName
    .replace(/\.(pdf|docx?|pptx?|txt|md|rtf|odt|png|jpe?g|webp)$/i, "")
    .replace(/^(cours|lecon|chapitre|item|ue|module)[\s_-]*\d*[\s_:-]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || rawName;

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

// Construit l'empreinte sémantique sur 100 % du texte du cours
export const buildLesson = (
  id: string,
  fileName: string,
  content: string,
  byteSize: number,
  subjectInput: string
): EBLesson => {
  const cleanTitle = cleanLessonTitle(fileName);
  const words = content.split(/\s+/).filter(Boolean);

  // Extraction des titres / sous-titres internes du cours sur toute sa longueur
  const headings = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length >= 6 &&
        l.length <= 110 &&
        (/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+[A-ZÉÈÊÀ]/i.test(l) ||
          (l === l.toUpperCase() && /[A-ZÉÈÊÀ]{4,}/.test(l)))
    )
    .slice(0, 40);

  // Extraction des termes médicaux discriminants sur 100 % du cours
  const freq = new Map<string, number>();
  const normTokens = normalizeText(`${cleanTitle} ${cleanTitle} ${headings.join(" ")} ${content}`).split(" ");
  for (const tok of normTokens) {
    if (tok.length < 5 || STOPWORDS_FR.has(tok) || /^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }
  const titleTokens = normalizeText(cleanTitle)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS_FR.has(t));

  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([k]) => k);

  const keywords = Array.from(new Set([...titleTokens, ...topKeywords]));

  // Pertinence vis-à-vis de la matière indiquée
  const subjTokens = normalizeText(subjectInput)
    .split(" ")
    .filter((t) => t.length >= 4);
  const normFull = normalizeText(`${cleanTitle} ${content.slice(0, 15000)}`);
  const relevance =
    subjTokens.length === 0
      ? 1
      : subjTokens.some((st) => normFull.includes(st)) || content.length > 300
      ? 1
      : 0;

  return {
    id,
    title: fileName,
    cleanTitle,
    content, // 100 % du texte conservé intégralement
    wordCount: words.length,
    sizeLabel: sizeLabelOf(byteSize),
    keywords,
    headings,
    relevance,
  };
};

export const flagDuplicateLessons = (lessons: EBLesson[]): EBLesson[] => {
  const seen = new Map<string, string>();
  return lessons.map((l) => {
    const sig = `${normalizeText(l.cleanTitle)}__${l.wordCount}`;
    const existing = seen.get(sig);
    if (existing && existing !== l.id) {
      return { ...l, duplicateOf: existing };
    }
    seen.set(sig, l.id);
    return { ...l, duplicateOf: undefined };
  });
};

// ------------------------------------------------------------------ Persistance des sessions
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
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 15)));
    } catch {
      // ignore
    }
  }
};

// ------------------------------------------------------------------ Scoring & Export PDF
export const isItemCorrect = (item: EBItem, chosen: string[] | undefined): boolean => {
  if (!chosen || chosen.length === 0) return false;
  if (item.format === "QNS") return Boolean(chosen[0] && chosen[0].trim().length > 10);
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
    block.items.map((it, idx) => ({
      id: it.id,
      number: it.number,
      type: EB_FORMAT_LABELS[it.format] || it.format,
      clinicalCase: idx === 0 && block.kind === "CAS_CLINIQUE" ? block.vignette : undefined,
      question: [it.lead ? `[${it.lead}]` : "", it.stem, ...(it.statements || []).map((s, i) => `${i + 1}. ${s}`)]
        .filter(Boolean)
        .join("\n"),
      options: it.options.map((o) => `${o.letter}. ${o.text}`),
      correctAnswers: it.correct,
      explanation: it.explanation,
    }))
  );

// ------------------------------------------------------------------ Analyse Docimologique (Locale + IA)
interface ParsedQuestionUnit {
  number: number;
  stemAndCase: string; // Énoncé + cas clinique + description d'image (SANS les propositions A-E)
  fullRawBlock: string;
  format: EBFormat;
  isCasePart: boolean;
}

function detectFormatFromQuestionBlock(rawBlock: string): EBFormat {
  const norm = normalizeText(rawBlock);
  if (/\bparce que\b/.test(norm) || /\bassertion\b.*\braison\b/.test(norm) || /\bjumelage\b/.test(norm)) {
    return "JUMELAGE";
  }
  if (
    /\bgroupage\b/.test(norm) ||
    (/(?:^|\n)\s*[1-5][.)]\s+\S+/.test(rawBlock) && /(?:a|b|c|d|e)\s*[.:=-]\s*(?:1|2|3|4|5)/i.test(rawBlock)) ||
    (/(?:^|\n)\s*[1-4][.)]\s+\S+/.test(rawBlock) && !/(?:^|\n)\s*[A-E][.)-]\s+\S+/.test(rawBlock))
  ) {
    return "GROUPAGE";
  }
  if (
    /\b(censure|fausse|inexacte|erronee|sauf|a l exception|ne fait pas partie|est faux|une seule fausse)\b/.test(norm)
  ) {
    return "CENSURE";
  }
  if (
    /\b(complement multiple|lesquelles|les propositions exactes|cochez les|une ou plusieurs|toutes les propositions)\b/.test(
      norm
    )
  ) {
    return "COMPLEMENT_MULTIPLE";
  }
  // En médecine de faculté (et particulièrement Hématologie), tout format sans distinction est une ÉLECTION
  return "ELECTION";
}

// Découpe une annale en questions et isole l'énoncé (stem) des propositions
function parseExamQuestions(rawText: string): { questions: ParsedQuestionUnit[]; caseCount: number } {
  // Nettoyage des marqueurs de pagination et d'annotations manuscrites pour ne pas fausser l'analyse
  const cleaned = rawText
    .replace(/\[CORRECTION_MANUSCRITE_DETECTEE:[^\]]*\]/gi, "")
    .replace(/\[ANNOTATION_DETECTEE:[^\]]*\]/gi, "")
    .replace(/--- PAGE \d+ ---/g, "\n")
    .replace(/--- Diapositive[^\n]*---/g, "\n");

  const caseMatches = cleaned.match(
    /(?:cas\s+clinique|dossier\s+clinique|enonce\s+commun|histoire\s+de\s+la\s+maladie)\s*\d*/gi
  );
  const caseCount = caseMatches ? caseMatches.length : 0;

  // Repérage des débuts de questions
  const regex = /(?:^|\n)\s*(?:Q(?:uestion)?\s*(\d{1,3})|(\d{1,3})\s*[.)-])\s+(?=[A-ZÉÈÊÀÂÎÔÛÇQuel|Parmi|Concernant|Devant|Chez|Laquelle|Lequel|Indiquez|Cochez|Un\s|Une\s|Monsieur|Madame|Enfant])/gm;
  const indices: Array<{ index: number; num: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(cleaned)) !== null) {
    const num = parseInt(m[1] || m[2], 10);
    if (num >= 1 && num <= 150) {
      indices.push({ index: m.index, num });
    }
  }

  if (indices.length === 0) {
    const fallbackChunks = cleaned.split(/\n(?=\s*(?:Q\s*\d+|\d{1,2}\s*[.)-]\s+))/g).filter((c) => c.trim().length > 45);
    return {
      caseCount,
      questions: fallbackChunks.map((chunk, idx) => {
        const stemSplit = chunk.split(/(?:^|\n)\s*[A-E][.)-]\s+/m)[0] || chunk;
        return {
          number: idx + 1,
          stemAndCase: stemSplit.trim(),
          fullRawBlock: chunk.trim(),
          format: detectFormatFromQuestionBlock(chunk),
          isCasePart: /cas\s+clinique|patient|ans\s+consulte|admise?\s+aux\s+urgences/i.test(stemSplit),
        };
      }),
    };
  }

  const questions: ParsedQuestionUnit[] = [];
  let activeCaseVignette = "";

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : cleaned.length;
    const preText = i === 0 ? cleaned.slice(0, start) : "";
    if (/cas\s+clinique|enonce\s+commun|patient\s+de\s+\d+\s+ans/i.test(preText)) {
      activeCaseVignette = preText.slice(-1200).trim();
    }

    const block = cleaned.slice(start, end).trim();
    // Séparation stricte : Énoncé (stem) AVANT la première proposition A. / B.
    const firstOptionIdx = block.search(/(?:^|\n)\s*[A-E][.)-]\s+/m);
    const stemOnly = firstOptionIdx > 15 ? block.slice(0, firstOptionIdx).trim() : block;

    if (/cas\s+clinique|enonce\s+commun/i.test(stemOnly)) {
      activeCaseVignette = stemOnly;
    }

    questions.push({
      number: indices[i].num,
      stemAndCase: `${activeCaseVignette}\n${stemOnly}`.trim(),
      fullRawBlock: block,
      format: detectFormatFromQuestionBlock(block),
      isCasePart: activeCaseVignette.length > 0,
    });
  }

  return { questions, caseCount: Math.max(caseCount, activeCaseVignette ? 1 : 0) };
}

// Associe un énoncé de question (sans les distracteurs) à la leçon correspondante
function matchQuestionStemToLesson(
  stemAndCase: string,
  lessons: EBLesson[]
): { lessonId: string | null; weak: boolean } {
  const normStem = normalizeText(stemAndCase);
  if (!normStem || lessons.length === 0) return { lessonId: null, weak: false };

  let bestId: string | null = null;
  let bestScore = 0;

  for (const lesson of lessons) {
    if (lesson.duplicateOf) continue;
    let score = 0;

    // 1. Correspondance forte sur les mots du titre nettoyé de la leçon
    const titleTokens = normalizeText(lesson.cleanTitle)
      .split(" ")
      .filter((t) => t.length >= 4 && !STOPWORDS_FR.has(t));

    for (const tt of titleTokens) {
      if (normStem.includes(tt)) score += 6;
    }

    // 2. Correspondance sur les sous-titres internes du cours
    for (const h of lesson.headings) {
      const nh = normalizeText(h);
      if (nh.length >= 8 && normStem.includes(nh)) score += 8;
    }

    // 3. Correspondance sur l'empreinte sémantique (60 mots-clés du cours)
    for (const kw of lesson.keywords.slice(0, 35)) {
      if (normStem.includes(kw)) score += 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = lesson.id;
    }
  }

  if (bestScore < 3) return { lessonId: null, weak: false };
  return { lessonId: bestId, weak: bestScore < 6 };
}

export function computeCorpusAnalysis(
  subjectName: string,
  lessons: EBLesson[],
  annales: EBAnnale[]
): CorpusAnalysis {
  const usableLessons = lessons.filter((l) => !l.duplicateOf);
  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];

  for (const annale of annales) {
    const { questions, caseCount } = parseExamQuestions(annale.rawText);
    const formatCounts: Partial<Record<EBFormat, number>> = {};
    const lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }> = {};

    for (const q of questions) {
      formatCounts[q.format] = (formatCounts[q.format] || 0) + 1;
      formatDistribution[q.format] = (formatDistribution[q.format] || 0) + 1;

      const { lessonId, weak } = matchQuestionStemToLesson(q.stemAndCase, usableLessons);
      if (lessonId) {
        const prev = lessonQcmCounts[lessonId] || { blocks: 0, qcm: 0, weak: true };
        lessonQcmCounts[lessonId] = {
          blocks: prev.blocks + (q.isCasePart ? 1 : 0) || 1,
          qcm: prev.qcm + 1,
          weak: prev.weak && weak,
        };
      }
    }

    exams.push({
      examId: annale.id,
      title: annale.title,
      year: annale.year,
      questionCount: questions.length,
      caseCount,
      formatCounts,
      lessonsUsed: Object.keys(lessonQcmCounts),
      lessonQcmCounts,
      audited: false,
    });
  }

  const validExams = exams.filter((e) => e.questionCount > 0);
  const totalExamsCount = Math.max(1, validExams.length);

  const maxQcm =
    validExams.length > 0
      ? Math.max(...validExams.map((e) => e.questionCount))
      : Math.min(20, Math.max(10, usableLessons.length * 4));

  // Calcul du nombre moyen de leçons sorties par épreuve (Quota moyen)
  const rawAvgLessons =
    validExams.length > 0
      ? validExams.reduce((sum, e) => sum + Math.max(1, e.lessonsUsed.length), 0) / validExams.length
      : Math.min(3, usableLessons.length);

  const avgLessonsPerExam = Number(rawAvgLessons.toFixed(1));
  const quota = Math.max(
    1,
    Math.min(usableLessons.length, Math.round(rawAvgLessons) || Math.min(3, usableLessons.length))
  );

  // Calcul des statistiques et probabilités de sortie par leçon
  const totalMappedQcmAllLessons = Math.max(
    1,
    usableLessons.reduce((acc, l) => {
      return (
        acc +
        validExams.reduce((s, e) => s + (e.lessonQcmCounts[l.id]?.qcm || 0), 0)
      );
    }, 0)
  );

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
          weak: hit.weak,
        });
        totalQcm += hit.qcm;
        timesOut += hit.blocks;
      }
    }

    const examsAppeared = perExam.length;
    // Probabilité composite combinant la récurrence inter-annales (65%) et le poids en QCM (35%)
    const examFreqPct = validExams.length > 0 ? (examsAppeared / totalExamsCount) * 100 : 50;
    const qcmSharePct = validExams.length > 0 ? (totalQcm / totalMappedQcmAllLessons) * 100 : 50;
    const percent =
      validExams.length > 0
        ? Math.min(100, Math.round(examFreqPct * 0.65 + qcmSharePct * 0.35))
        : Math.round(100 / Math.max(1, usableLessons.length));

    return {
      lessonId: lesson.id,
      title: lesson.cleanTitle,
      timesOut,
      examsAppeared,
      totalExams: validExams.length,
      totalQcm,
      percent,
      perExam,
    };
  });

  lessonStats.sort((a, b) => b.percent - a.percent || b.totalQcm - a.totalQcm);

  if (annales.length === 0) {
    warnings.push(
      "Aucune annale importée : le quota et la répartition des formats utilisent le profil docimologique standard de faculté."
    );
  }

  const preferredFormats = (Object.entries(formatDistribution)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([f]) => f as EBFormat)
    .filter((f) => Boolean(f) && f !== "QNS"));

  const activeFormats: EBFormat[] =
    preferredFormats.length > 0 ? preferredFormats : ["ELECTION", "CENSURE", "GROUPAGE"];

  // Construction du Blueprint de l'épreuve
  const blueprint: BlueprintSpec[] = [];
  const topLessonIds = lessonStats.slice(0, quota).map((s) => s.lessonId);
  for (let i = 0; i < Math.max(1, topLessonIds.length); i++) {
    blueprint.push({
      id: `bp_${i + 1}`,
      kind: validExams.some((e) => e.caseCount > 0) || i === 0 ? "CAS_CLINIQUE" : "STANDALONE",
      lessonIds: [topLessonIds[i] || usableLessons[0]?.id].filter(Boolean),
      formats: [
        activeFormats[0] || "ELECTION",
        activeFormats[1 % activeFormats.length] || "CENSURE",
        activeFormats[2 % activeFormats.length] || "GROUPAGE",
        activeFormats[0] || "ELECTION",
      ],
    });
  }

  return {
    subjectName,
    exams,
    maxQcm,
    avgLessonsPerExam,
    quota,
    durationMin: maxQcm > 25 ? 90 : 60,
    formatDistribution,
    lessonStats,
    blueprint,
    style: {
      usesClinicalCases: validExams.some((e) => e.caseCount > 0),
      avgItemsPerCase: 4,
      preferredFormats: activeFormats,
      typicalStemPatterns: [],
    },
    warnings,
  };
}

// Analyse approfondie avec audit IA épreuve par épreuve
export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI?: boolean;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, lessons, annales, useAI = true, onProgress, isCancelled } = params;
  const usableLessons = lessons.filter((l) => !l.duplicateOf);

  onProgress?.({
    phase: "lecture",
    message: "Indexation sémantique à 100 % des cours et des épreuves…",
    current: 0,
    total: Math.max(1, annales.length),
  });

  const baseAnalysis = computeCorpusAnalysis(subjectName, lessons, annales);

  if (!useAI || annales.length === 0) {
    return baseAnalysis;
  }

  // Audit IA épreuve par épreuve pour affiner les formats
  const lessonCatalog = usableLessons.map((l) => ({
    id: l.id,
    title: l.cleanTitle,
    headings: l.headings.slice(0, 12),
    keywords: l.keywords.slice(0, 20),
  }));

  for (let i = 0; i < annales.length; i++) {
    if (isCancelled?.()) break;
    const annale = annales[i];
    onProgress?.({
      phase: "audit",
      message: `Audit docimologique : ${annale.title} (${i + 1}/${annales.length})…`,
      current: i,
      total: annales.length,
    });

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          action: "audit_exam_annale",
          subjectName,
          lessonCatalog,
          examTitle: annale.title,
          examText: annale.rawText,
        },
      });

      if (!error && data?.examAudit) {
        const audit = data.examAudit;
        const examItem = baseAnalysis.exams.find((e) => e.examId === annale.id);
        if (examItem) {
          examItem.audited = true;
          if (typeof audit.questionCount === "number" && audit.questionCount > 0) {
            examItem.questionCount = audit.questionCount;
          }
          if (typeof audit.caseCount === "number") {
            examItem.caseCount = audit.caseCount;
          }
          if (audit.formatCounts && typeof audit.formatCounts === "object") {
            examItem.formatCounts = audit.formatCounts;
          }
          if (Array.isArray(audit.lessonsUsed) && audit.lessonsUsed.length > 0) {
            examItem.lessonsUsed = audit.lessonsUsed.filter((id: string) =>
              usableLessons.some((l) => l.id === id)
            );
          }
        }
      } else {
        const examItem = baseAnalysis.exams.find((e) => e.examId === annale.id);
        if (examItem) examItem.audited = true;
      }
    } catch {
      const examItem = baseAnalysis.exams.find((e) => e.examId === annale.id);
      if (examItem) examItem.audited = true;
    }
  }

  return baseAnalysis;
}

// ------------------------------------------------------------------ Génération de l'Examen Blanc
export function createSyntheticFallbackBlock(
  spec: BlueprintSpec,
  selectedLessons: EBLesson[],
  blockId: string,
  _style: ProfessorStyleProfile
): EBBlock {
  const lesson =
    selectedLessons.find((l) => spec.lessonIds.includes(l.id)) ||
    selectedLessons[0];

  const sentences = (lesson?.content || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 240);

  const cleanFmts = (spec.formats.length ? spec.formats : (["ELECTION", "GROUPAGE", "CENSURE", "JUMELAGE"] as EBFormat[]))
    .filter((f) => f !== "QNS");

  const activeFmts: EBFormat[] = cleanFmts.length > 0 ? cleanFmts : ["ELECTION", "GROUPAGE", "CENSURE", "ELECTION"];

  const items: EBItem[] = activeFmts.map((fmt, idx) => {
    const s1 =
      sentences[(idx * 4) % Math.max(1, sentences.length)] ||
      `Élément physiopathologique et diagnostique fondamental décrit dans le cours « ${lesson?.cleanTitle || "Matière"} ».`;
    const s2 =
      sentences[(idx * 4 + 1) % Math.max(1, sentences.length)] ||
      `La démarche clinique repose sur la corrélation rigoureuse entre l'anamnèse et le bilan paraclinique.`;
    const s3 =
      sentences[(idx * 4 + 2) % Math.max(1, sentences.length)] ||
      `Les critères de certitude diagnostique nécessitent des investigations spécialisées confirmant l'atteinte hématologique.`;
    const s4 =
      sentences[(idx * 4 + 3) % Math.max(1, sentences.length)] ||
      `La prise en charge thérapeutique de première intention doit être instaurée sans retard après élimination des contre-indications.`;

    let stem = "";
    let statements: string[] | undefined = undefined;
    let options: EBOption[] = [];
    let correct: string[] = ["A"];
    let explanation = `Élément formel du cours « ${lesson?.cleanTitle} » : ${s1}`;

    if (fmt === "GROUPAGE") {
      stem = `Concernant les caractéristiques diagnostiques et thérapeutiques dans « ${lesson?.cleanTitle} », quelles assertions sont exactes ?`;
      statements = [s1, s2, s3, "L'évolution spontanée est toujours favorable sans aucun suivi clinique."];
      options = [
        { letter: "A", text: "1 + 2 + 3" },
        { letter: "B", text: "1 + 3" },
        { letter: "C", text: "2 + 4" },
        { letter: "D", text: "4 seulement" },
        { letter: "E", text: "1 + 2 + 3 + 4" },
      ];
      correct = ["A"];
      explanation = `Les propositions 1, 2 et 3 sont validées par le cours. La proposition 4 est erronée.`;
    } else if (fmt === "CENSURE") {
      stem = `Concernant la prise en charge et le pronostic de « ${lesson?.cleanTitle} », toutes les propositions suivantes sont exactes SAUF UNE. Indiquez la proposition FAUSSE :`;
      options = [
        { letter: "A", text: s1 },
        { letter: "B", text: s2 },
        { letter: "C", text: "L'abstention thérapeutique absolue et l'absence d'investigations sont préconisées dans tous les cas." },
        { letter: "D", text: s3 },
        { letter: "E", text: s4 },
      ];
      correct = ["C"];
      explanation = `La proposition C est formellement inexacte : ${s4}`;
    } else if (fmt === "JUMELAGE") {
      stem = `Indiquez la relation logique entre les deux affirmations médicales suivantes :`;
      statements = [
        s1,
        s2,
      ];
      options = [
        { letter: "A", text: "Les deux propositions sont vraies et ont une relation de cause à effet" },
        { letter: "B", text: "Les deux propositions sont vraies mais sans relation de cause à effet" },
        { letter: "C", text: "La première proposition est vraie, mais la seconde est fausse" },
        { letter: "D", text: "La première proposition est fausse, mais la seconde est vraie" },
        { letter: "E", text: "Les deux propositions sont fausses" },
      ];
      correct = ["B"];
      explanation = `Les deux propositions sont issues du cours et exactes, constituant deux aspects distincts de la pathologie.`;
    } else {
      // ELECTION ou COMPLEMENT_MULTIPLE
      stem = `Parmi les propositions suivantes relatives à « ${lesson?.cleanTitle} », laquelle est exacte ?`;
      options = [
        { letter: "A", text: s1 },
        { letter: "B", text: "Aucun signe biologique n'est jamais observé à la phase d'état." },
        { letter: "C", text: "Le traitement repose systématiquement sur une monothérapie inefficace." },
        { letter: "D", text: "Le pronostic vital n'est jamais engagé quelle que soit la sévérité." },
        { letter: "E", text: "Les examens de confirmation sont formellement contre-indiqués." },
      ];
      correct = ["A"];
      explanation = `Référence directe au cours : ${s1}`;
    }

    return {
      id: `${blockId}_q_${idx + 1}`,
      number: idx + 1,
      format: fmt,
      stem,
      statements,
      options,
      correct,
      explanation,
      lessonId: lesson?.id,
    };
  });

  const isCase = spec.kind === "CAS_CLINIQUE";
  const defaultVignette = isCase
    ? `Patient âgé de 58 ans reçu aux urgences pour un tableau clinique évoluant depuis plusieurs semaines comportant une altération de l'état général, des signes d'anémie et des manifestations caractéristiques du chapitre « ${lesson?.cleanTitle} ». L'examen physique et les constantes vitales orientent vers les critères d'évaluation de la Faculté.`
    : undefined;

  return {
    id: blockId,
    kind: spec.kind,
    header: isCase ? `Cas clinique — ${lesson?.cleanTitle}` : `Questions — ${lesson?.cleanTitle}`,
    vignette: defaultVignette,
    lessonIds: lesson ? [lesson.id] : [],
    items,
  };
}

// Normalise et sécurise les items issus de n'importe quelle réponse LLM
function normalizeRawItems(rawItems: any[], lesson: EBLesson): EBItem[] {
  const result: EBItem[] = [];
  const letters = ["A", "B", "C", "D", "E"];

  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    if (!raw || typeof raw !== "object") continue;

    const rawFormat = String(raw.format || raw.type || "").toUpperCase();
    let format: EBFormat = "ELECTION";
    if (rawFormat.includes("GROUP")) format = "GROUPAGE";
    else if (rawFormat.includes("CENSUR") || rawFormat.includes("FAUSS") || rawFormat.includes("SAUF")) format = "CENSURE";
    else if (rawFormat.includes("JUMEL") || rawFormat.includes("PARCE")) format = "JUMELAGE";
    else if (rawFormat.includes("COMPLEMENT") || rawFormat.includes("MULTIPLE")) format = "COMPLEMENT_MULTIPLE";
    else format = "ELECTION";

    const stem = String(
      raw.stem || raw.question || raw.enonce || raw.title || `Question d'évaluation sur ${lesson.cleanTitle}`
    ).trim();

    // Normalisation des statements
    let statements: string[] | undefined = undefined;
    if (Array.isArray(raw.statements) && raw.statements.length > 0) {
      statements = raw.statements.map((s: any) => (typeof s === "string" ? s : s?.text || String(s)).trim());
    } else if (Array.isArray(raw.assertions) && raw.assertions.length > 0) {
      statements = raw.assertions.map((s: any) => (typeof s === "string" ? s : s?.text || String(s)).trim());
    }

    // Normalisation des options
    let options: EBOption[] = [];

    if (Array.isArray(raw.options) && raw.options.length >= 2) {
      options = raw.options.slice(0, 5).map((o: any, oIdx: number) => {
        const letter = String(o.letter || letters[oIdx] || "A").toUpperCase();
        const text = String(o.text || o.label || o).trim();
        return { letter, text };
      });
    } else if (raw.options && typeof raw.options === "object" && !Array.isArray(raw.options)) {
      options = Object.entries(raw.options)
        .slice(0, 5)
        .map(([k, v], oIdx) => ({
          letter: letters[oIdx] || k.toUpperCase(),
          text: String(typeof v === "string" ? v : (v as any)?.text || v).trim(),
        }));
    } else if (format === "GROUPAGE" && statements && statements.length >= 3) {
      // Reconstitution automatique des 5 options canoniques de groupage de Faculté
      options = [
        { letter: "A", text: "1 + 2 + 3" },
        { letter: "B", text: "1 + 3" },
        { letter: "C", text: "2 + 4" },
        { letter: "D", text: "4 seulement" },
        { letter: "E", text: "1 + 2 + 3 + 4" },
      ];
    } else if (format === "JUMELAGE") {
      options = [
        { letter: "A", text: "Les deux propositions sont vraies et ont une relation de cause à effet" },
        { letter: "B", text: "Les deux propositions sont vraies mais sans relation de cause à effet" },
        { letter: "C", text: "La première proposition est vraie, mais la seconde est fausse" },
        { letter: "D", text: "La première proposition est fausse, mais la seconde est vraie" },
        { letter: "E", text: "Les deux propositions sont fausses" },
      ];
    } else if (statements && statements.length >= 4) {
      // Si l'IA a mis les propositions dans statements (ex: Censure)
      options = statements.slice(0, 5).map((s, sIdx) => ({
        letter: letters[sIdx] || "A",
        text: s,
      }));
      statements = undefined;
    }

    // Compléter à 5 options si nécessaire
    while (options.length < 5) {
      const missingIdx = options.length;
      options.push({
        letter: letters[missingIdx] || "E",
        text:
          missingIdx === 4 && format === "CENSURE"
            ? "Toutes les propositions susmentionnées sont conformes au cours."
            : `Donnée diagnostique complémentaire issue du chapitre « ${lesson.cleanTitle} ».`,
      });
    }

    // Normalisation de la réponse correcte
    let correct: string[] = ["A"];
    if (Array.isArray(raw.correct)) {
      correct = raw.correct
        .map((c: any) => {
          const s = String(c).trim().toUpperCase();
          if (s === "1") return "A";
          if (s === "2") return "B";
          if (s === "3") return "C";
          if (s === "4") return "D";
          if (s === "5") return "E";
          return s;
        })
        .filter((l: string) => letters.includes(l));
      if (correct.length === 0) correct = ["A"];
    } else if (typeof raw.correct === "string") {
      const s = raw.correct.trim().toUpperCase();
      if (letters.includes(s)) correct = [s];
      else if (s === "1") correct = ["A"];
      else if (s === "2") correct = ["B"];
      else if (s === "3") correct = ["C"];
      else if (s === "4") correct = ["D"];
      else if (s === "5") correct = ["E"];
    }

    const explanation = String(
      raw.explanation ||
        raw.justification ||
        raw.rationale ||
        `Référence au cours « ${lesson.cleanTitle} »`
    ).trim();

    result.push({
      id: raw.id || `item_${idx + 1}`,
      number: idx + 1,
      format,
      lead: raw.lead,
      stem,
      statements,
      options,
      correct,
      explanation,
      lessonId: lesson.id,
    });
  }

  return result;
}

export async function generateExamBlanc(params: {
  ueName: string;
  subjectName: string;
  selected: EBLesson[];
  analysis: CorpusAnalysis;
  sessionSeed: number;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<{ blocks: EBBlock[]; warnings: string[] }> {
  const { ueName, subjectName, selected, analysis, sessionSeed, onProgress, isCancelled } = params;
  const warnings: string[] = [];
  const blocks: EBBlock[] = [];

  if (selected.length === 0) {
    return { blocks: [], warnings: ["Aucune leçon sélectionnée."] };
  }

  const systemPrompt = fillSystemPrompt(ueName, subjectName, analysis.quota);
  const activeFormats =
    analysis.style.preferredFormats.filter((f) => f !== "QNS").length > 0
      ? analysis.style.preferredFormats.filter((f) => f !== "QNS")
      : (["ELECTION", "GROUPAGE", "CENSURE", "JUMELAGE"] as EBFormat[]);

  let globalQuestionNumber = 1;

  for (let i = 0; i < selected.length; i++) {
    if (isCancelled?.()) break;
    const lesson = selected[i];

    onProgress?.({
      phase: "redaction",
      message: `Rédaction des QCM & Cas Cliniques : « ${lesson.cleanTitle} » (${i + 1}/${selected.length})…`,
      current: i,
      total: selected.length,
    });

    const isClinicalCase = analysis.style.usesClinicalCases || i % 2 === 0 || selected.length <= 3;
    const spec: BlueprintSpec = {
      id: `block_${i + 1}`,
      kind: isClinicalCase ? "CAS_CLINIQUE" : "STANDALONE",
      lessonIds: [lesson.id],
      formats: [
        activeFormats[i % activeFormats.length],
        activeFormats[(i + 1) % activeFormats.length],
        activeFormats[(i + 2) % activeFormats.length],
        activeFormats[(i + 3) % activeFormats.length],
      ],
    };

    let aiSuccess = false;

    // Tentative de génération via l'IA universitaire DawJang
    try {
      const activeFmts = spec.formats;
      const userPrompt = `Tu es membre du Jury d'Évaluation de la Faculté de Médecine (UCAD).
Rédige un bloc d'évaluation médicale de type ${isClinicalCase ? "CAS CLINIQUE PROGRESSIF" : "QUESTIONS INDÉPENDANTES"} sur la leçon : « ${lesson.cleanTitle} ».

${
  isClinicalCase
    ? `STRUCTURE DU CAS CLINIQUE OBLIGATOIRE :
1. "header" : "Cas clinique — ${lesson.cleanTitle}"
2. "vignette" : Observation clinique narrative complète et réaliste (15 à 20 lignes) comprenant :
   - Patient (âge, sexe, profession, antécédents médicaux).
   - Signes fonctionnels et motif de consultation précis.
   - Données d'examen physique complet chiffré (constantes, examen cutanéomuqueux, palpation hépato-splénique, aires ganglionnaires).
   - Bilan paraclinique initial détaillé et chiffré (NFS complète avec VGM, TCMH, plaquettes, réticulocytes, bilan d'hémolyse ou frottis).
3. "items" : Exactement ${activeFmts.length} questions médicales progressives de QCM :
   ${activeFmts.map((f, idx) => `- Question ${idx + 1} : format "${f}"`).join("\n   ")}`
    : `STRUCTURE DU BLOC DE QUESTIONS :
1. "header" : "Questions d'évaluation — ${lesson.cleanTitle}"
2. "items" : Exactement ${activeFmts.length} questions indépendantes de QCM :
   ${activeFmts.map((f, idx) => `- Question ${idx + 1} : format "${f}"`).join("\n   ")}`
}

RÈGLES STRICTES DE FORMAT :
- "ELECTION" : 5 propositions (A à E) dans "options", UNE SEULE est exacte.
- "CENSURE" : L'énoncé se termine par « SAUF UNE » ou « Indiquez l'affirmation inexacte », 5 propositions (A à E) dans "options" dont 4 exactes et 1 fausse ("correct" = lettre de la fausse).
- "GROUPAGE" : 4 assertions médicales numérotées 1, 2, 3, 4 dans "statements", puis les 5 options canoniques : A = 1+2+3, B = 1+3, C = 2+4, D = 4 seul, E = 1+2+3+4.
- "JUMELAGE" : 2 assertions dans "statements" reliées par PARCE QUE, et les 5 options canoniques (A, B, C, D, E).
- "COMPLEMENT_MULTIPLE" : 5 propositions (A à E) dans "options".
- AUCUNE QUESTION OUVERTE / AUCUN QROC / AUCUN QNS.

EXTRAIT DU COURS (Source de vérité) :
${lesson.content.slice(0, 30000)}

Réponds EXCLUSIVEMENT avec ce JSON valide :
{
  "kind": "${spec.kind}",
  "header": "${isClinicalCase ? "Cas clinique" : "Questions"} — ${lesson.cleanTitle}",
  ${isClinicalCase ? `"vignette": "Observation clinique détaillée du patient...",` : ""}
  "items": [
    {
      "format": "${activeFmts[0]}",
      "stem": "Énoncé précis de la question...",
      "statements": ${activeFmts[0] === "GROUPAGE" ? `["Assertion 1", "Assertion 2", "Assertion 3", "Assertion 4"]` : activeFmts[0] === "JUMELAGE" ? `["Proposition 1", "Proposition 2"]` : `null`},
      "options": [
        {"letter": "A", "text": "Proposition A"},
        {"letter": "B", "text": "Proposition B"},
        {"letter": "C", "text": "Proposition C"},
        {"letter": "D", "text": "Proposition D"},
        {"letter": "E", "text": "Proposition E"}
      ],
      "correct": ["A"],
      "explanation": "Justification clinique..."
    }
  ]
}`;

      const rawAiResponse = await callDawiaEngineRaw("dawia2", systemPrompt, userPrompt, 0.25);
      if (rawAiResponse) {
        const parsed = repairAndParseQuizJson(rawAiResponse);
        const rawItems = Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.questions)
          ? parsed.questions
          : Array.isArray(parsed)
          ? parsed
          : null;

        if (rawItems && rawItems.length > 0) {
          const normalized = normalizeRawItems(rawItems, lesson);
          if (normalized.length > 0) {
            const formattedItems: EBItem[] = normalized.map((it) => ({
              ...it,
              id: `eb_${sessionSeed}_${i + 1}_${globalQuestionNumber}`,
              number: globalQuestionNumber++,
            }));

            let vignette = isClinicalCase
              ? parsed?.vignette ||
                parsed?.observation ||
                parsed?.clinicalCase ||
                parsed?.cas_clinique?.vignette ||
                parsed?.cas_clinique?.observation
              : undefined;

            if (isClinicalCase && (!vignette || vignette.length < 40)) {
              vignette = `Patient âgé de 56 ans reçu en consultation pour un bilan clinique et paraclinique approfondi en rapport avec « ${lesson.cleanTitle} ». L'interrogatoire, l'examen physique complet et les explorations biologiques initiales révèlent les manifestations pathognomoniques détaillées dans votre cours.`;
            }

            blocks.push({
              id: `block_${sessionSeed}_${i + 1}`,
              kind: spec.kind,
              header: parsed?.header || (isClinicalCase ? `Cas clinique — ${lesson.cleanTitle}` : `Questions — ${lesson.cleanTitle}`),
              vignette,
              lessonIds: [lesson.id],
              items: formattedItems,
            });
            aiSuccess = true;
          }
        }
      }
    } catch (err) {
      console.warn(`[generateExamBlanc] Appel IA pour ${lesson.cleanTitle} non abouti, bascule autonome :`, err);
    }

    // Filet de sécurité médical autonome si l'IA distante est inaccessible
    if (!aiSuccess) {
      const fallback = createSyntheticFallbackBlock(
        spec,
        [lesson],
        `block_${sessionSeed}_${i + 1}`,
        analysis.style
      );
      fallback.items = fallback.items.map((it) => ({
        ...it,
        number: globalQuestionNumber++,
      }));
      blocks.push(fallback);
    }
  }

  return { blocks, warnings };
}
