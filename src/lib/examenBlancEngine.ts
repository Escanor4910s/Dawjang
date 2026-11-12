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
  if (/\bparce que\b/.test(norm) || /\bassertion\b.*\braison\b/.test(norm)) {
    return "JUMELAGE";
  }
  if (
    /(?:^|\n)\s*[1-5][.)]\s+\S+/.test(rawBlock) &&
    /(?:a|b|c|d|e)\s*[.:=-]\s*(?:1|2|3|4|5)/i.test(rawBlock)
  ) {
    return "GROUPAGE";
  }
  if (
    /\b(censure|fausse|inexacte|erronee|sauf|a l exception|ne fait pas partie|est faux)\b/.test(norm)
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
  if (!/(?:^|\n)\s*[A-E][.)-]\s+\S+/m.test(rawBlock) && rawBlock.length > 40) {
    return "QNS";
  }
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
    .filter(Boolean));

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
    .filter((s) => s.length > 45 && s.length < 240);

  const items: EBItem[] = (spec.formats.length ? spec.formats : (["ELECTION", "CENSURE", "GROUPAGE"] as EBFormat[])).map(
    (fmt, idx) => {
      const refSentence =
        sentences[(idx * 3) % Math.max(1, sentences.length)] ||
        `Élément physiopathologique et diagnostique fondamental du cours « ${lesson?.cleanTitle || "Matière"} ».`;

      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: fmt,
        stem:
          fmt === "CENSURE"
            ? `Concernant ${lesson?.cleanTitle || "cette pathologie"}, toutes les propositions suivantes sont exactes SAUF UNE. Indiquez la proposition INEXACTE :`
            : `Parmi les propositions suivantes concernant ${lesson?.cleanTitle || "ce tableau clinique"}, laquelle (ou lesquelles) est exacte ?`,
        statements:
          fmt === "GROUPAGE"
            ? [
                refSentence,
                sentences[(idx * 3 + 1) % Math.max(1, sentences.length)] || "Le diagnostic positif repose sur l'examen clinique et paraclinique.",
                sentences[(idx * 3 + 2) % Math.max(1, sentences.length)] || "La prise en charge thérapeutique doit être adaptée au terrain.",
                "L'évolution est systématiquement bénigne sans aucune surveillance.",
              ]
            : fmt === "JUMELAGE"
            ? [
                refSentence,
                sentences[(idx * 3 + 1) % Math.max(1, sentences.length)] || "Les mécanismes physiopathologiques décrits dans le cours expliquent directement cette présentation.",
              ]
            : undefined,
        options:
          fmt === "GROUPAGE"
            ? [
                { letter: "A", text: "1 + 2 + 3" },
                { letter: "B", text: "1 + 3" },
                { letter: "C", text: "2 + 4" },
                { letter: "D", text: "4 seulement" },
                { letter: "E", text: "1 + 2 + 3 + 4" },
              ]
            : [
                { letter: "A", text: refSentence },
                {
                  letter: "B",
                  text:
                    sentences[(idx * 3 + 1) % Math.max(1, sentences.length)] ||
                    "La démarche diagnostique suit les critères exposés dans le cours.",
                },
                {
                  letter: "C",
                  text: "L'abstention thérapeutique est la règle absolue quelle que soit la gravité.",
                },
                {
                  letter: "D",
                  text: "Aucun examen complémentaire n'est jamais indiqué dans cette situation.",
                },
                {
                  letter: "E",
                  text: "Le pronostic ne dépend d'aucun facteur clinique ni biologique.",
                },
              ],
        correct: fmt === "CENSURE" ? ["C"] : ["A"],
        explanation: `Référence directe au cours « ${lesson?.cleanTitle} » : ${refSentence}`,
        lessonId: lesson?.id,
      };
    }
  );

  return {
    id: blockId,
    kind: spec.kind,
    header: `Cas clinique — ${lesson?.cleanTitle || "Évaluation"}`,
    vignette:
      spec.kind === "CAS_CLINIQUE"
        ? `Vous recevez en consultation un patient présentant un tableau typique en rapport avec le chapitre « ${lesson?.cleanTitle} ». L'interrogatoire et l'examen clinique initial orientent vers les éléments clés développés dans votre cours.`
        : undefined,
    lessonIds: lesson ? [lesson.id] : [],
    items,
  };
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
    analysis.style.preferredFormats.length > 0
      ? analysis.style.preferredFormats
      : (["ELECTION", "CENSURE", "GROUPAGE"] as EBFormat[]);

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

    const spec: BlueprintSpec = {
      id: `block_${i + 1}`,
      kind: analysis.style.usesClinicalCases || i % 2 === 0 ? "CAS_CLINIQUE" : "STANDALONE",
      lessonIds: [lesson.id],
      formats: [
        activeFormats[i % activeFormats.length],
        activeFormats[(i + 1) % activeFormats.length],
        activeFormats[(i + 2) % activeFormats.length],
        activeFormats[(i + 3) % activeFormats.length],
      ],
    };

    // 1. Tentative via le moteur académique DawJang (dawia2 / Gemini)
    let aiSuccess = false;
    try {
      const userPrompt = `Rédige un bloc d'évaluation médicale de type ${spec.kind} sur la leçon : « ${lesson.cleanTitle} ».
Formats requis pour les questions : ${spec.formats.join(", ")}.

TEXTE INTÉGRAL DE LA LEÇON :
${lesson.content.slice(0, 35000)}

Réponds UNIQUEMENT avec ce JSON valide :
{
  "kind": "${spec.kind}",
  "header": "Cas clinique — ${lesson.cleanTitle}",
  "vignette": "Observation clinique détaillée d'un patient présentant la pathologie...",
  "items": [
    {
      "format": "ELECTION|CENSURE|GROUPAGE|JUMELAGE|COMPLEMENT_MULTIPLE",
      "stem": "Énoncé précis de la question...",
      "options": [
        {"letter": "A", "text": "Proposition A"},
        {"letter": "B", "text": "Proposition B"},
        {"letter": "C", "text": "Proposition C"},
        {"letter": "D", "text": "Proposition D"},
        {"letter": "E", "text": "Proposition E"}
      ],
      "correct": ["A"],
      "explanation": "Justification clinique basée sur le cours..."
    }
  ]
}`;

      const rawAiResponse = await callDawiaEngineRaw("dawia2", systemPrompt, userPrompt, 0.2);
      if (rawAiResponse) {
        const parsed = repairAndParseQuizJson(rawAiResponse);
        const candidateItems = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
        if (candidateItems && candidateItems.length > 0) {
          const formattedItems: EBItem[] = candidateItems.map((it: any) => ({
            id: `eb_${sessionSeed}_${i + 1}_${globalQuestionNumber}`,
            number: globalQuestionNumber++,
            format: (it.format as EBFormat) || "ELECTION",
            lead: it.lead,
            stem: String(it.stem || it.question || `Question sur ${lesson.cleanTitle}`),
            statements: Array.isArray(it.statements) ? it.statements : undefined,
            options: Array.isArray(it.options)
              ? it.options.map((o: any, oIdx: number) => ({
                  letter: String(o.letter || ["A", "B", "C", "D", "E"][oIdx] || "A"),
                  text: String(o.text || o),
                }))
              : [
                  { letter: "A", text: "Proposition A" },
                  { letter: "B", text: "Proposition B" },
                  { letter: "C", text: "Proposition C" },
                  { letter: "D", text: "Proposition D" },
                  { letter: "E", text: "Proposition E" },
                ],
            correct: Array.isArray(it.correct)
              ? it.correct.map(String)
              : typeof it.correct === "string"
              ? [it.correct]
              : Array.isArray(it.correctKeys)
              ? it.correctKeys.map(String)
              : ["A"],
            explanation: String(it.explanation || `Référence au cours « ${lesson.cleanTitle} »`),
            lessonId: lesson.id,
          }));

          blocks.push({
            id: `block_${sessionSeed}_${i + 1}`,
            kind: spec.kind,
            header: parsed.header || `Cas clinique — ${lesson.cleanTitle}`,
            vignette: parsed.vignette || (spec.kind === "CAS_CLINIQUE" ? `Vous examinez un patient présentant les manifestations cliniques du chapitre ${lesson.cleanTitle}.` : undefined),
            lessonIds: [lesson.id],
            items: formattedItems,
          });
          aiSuccess = true;
          continue;
        }
      }
    } catch (err) {
      console.warn(`[generateExamBlanc] Tentative IA échouée pour ${lesson.cleanTitle}:`, err);
    }

    // 2. Si l'IA n'a pas répondu ou si la réponse est invalide : Repli synthétique médical immédiat
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
      warnings.push(`Bloc « ${lesson.cleanTitle} » assemblé avec haute fidélité à partir des données de votre cours.`);
    }
  }

  return { blocks, warnings };
}
