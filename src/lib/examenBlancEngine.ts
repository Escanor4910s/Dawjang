// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR DOCIMOLOGIQUE UNIVERSEL — Passe Unique Linéaire, Isolation d'EC/Matière,
// Attribution Sémantique Profonde des Leçons & Génération Calibrée UCAD
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export type EBFormat =
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "JUMELAGE"
  | "COMPLEMENT_MULTIPLE"
  | "QNS";

export const EB_FORMAT_LABELS: Record<EBFormat, string> = {
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
  kind: "CAS_CLINIQUE" | "STANDALONE";
  header?: string;
  vignette?: string;
  lessonIds: string[];
  items: EBItem[];
}

export interface BlueprintSpec {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE";
  lessonIds: string[];
  formats: EBFormat[];
}

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

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu es un Professeur Titulaire de Faculté de Médecine (UCAD), expert en docimologie médicale (Élection, Censure, Groupage, Jumelage, Compléments multiples et Cas cliniques progressifs).
Unité d'Enseignement (UE) : {{UE}}
Matière évaluée : {{SUBJECT}}
Quota moyen de leçons par épreuve : {{QUOTA}}

RÈGLES DOCIMOLOGIQUES STRICTES :
1. EXCLUSIVITÉ DE LA MATIÈRE : Seule la matière "{{SUBJECT}}" est évaluée. Toute question d'une autre matière de l'UE est exclue.
2. ATTRIBUTION STRICTE DES LEÇONS : Une leçon est considérée comme "sortie" UNIQUEMENT si elle constitue le sujet central du cas clinique ou de l'énoncé de la question (stem). Une simple mention dans un distracteur (proposition A-E) ne compte JAMAIS.
3. FIDÉLITÉ AU COURS À 100 % : Chaque fait clinique, seuil biologique, critère diagnostique ou traitement doit provenir exclusivement des leçons sélectionnées.`;

export const fillSystemPrompt = (ue: string, subject: string, quota: number): string =>
  EXAMEN_BLANC_SYSTEM_PROMPT.replace(/\{\{UE\}\}/g, ue || "UE Médicale")
    .replace(/\{\{SUBJECT\}\}/g, subject || "Matière médicale")
    .replace(/\{\{QUOTA\}\}/g, String(quota || 1));

const STOPWORDS_FR = new Set([
  "dans", "avec", "pour", "sans", "sous", "chez", "entre", "vers", "plus", "moins",
  "tres", "tout", "tous", "toute", "toutes", "cette", "ces", "mais", "donc", "alors",
  "apres", "avant", "pendant", "depuis", "contre", "selon", "comme", "ainsi", "etre",
  "avoir", "faire", "peut", "sont", "elle", "elles", "nous", "vous", "leur", "leurs",
  "cours", "chapitre", "lecon", "module", "professeur", "docteur", "faculte", "examen",
  "patient", "patiente", "ans", "consulte", "examen", "clinique", "bilan", "suivantes",
  "propositions", "laquelle", "lequel", "parmi", "cochez", "reponse", "exacte", "fausse",
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

// Synonymes médicaux pour relier les cas cliniques aux intitulés de cours (Hémato, Médecine Interne, etc.)
const MEDICAL_TOPIC_CLUSTERS: Array<{ terms: string[]; boostTokens: string[] }> = [
  {
    terms: ["myelome", "mgus", "plasmocyte", "crab", "bence jones", "durie", "salmon", "immunofixation", "pic monoclonal", "waldenstrom", "gammapathie"],
    boostTokens: ["myelome", "multiple", "gammapathie", "monoclonale", "dysglobulinemie", "plasmocytaire", "waldenstrom"],
  },
  {
    terms: ["leucemie lymphoide chronique", "llc", "gumprecht", "matutes", "binet", "richter", "hyperlymphocytose"],
    boostTokens: ["leucemie", "lymphoide", "chronique", "llc", "syndromes", "lymphoproliferatifs"],
  },
  {
    terms: ["lymphome", "hodgkin", "reed sternberg", "ann arbor", "abvd", "r chop", "cd20", "cd30", "ipi", "adenopathie"],
    boostTokens: ["lymphome", "hodgkin", "non", "hodgkinien", "lnh", "adenopathie", "splenomegalie"],
  },
  {
    terms: ["polyglobulie", "vaquez", "myelofibrose", "splenomegalie myeloide", "thrombocytemie", "jak2", "bcr abl", "philadelphie", "lmc", "leucemie myeloide chronique", "dacryocytes"],
    boostTokens: ["myeloproliferatif", "syndromes", "myeloproliferatifs", "polyglobulie", "vaquez", "lmc", "myelofibrose", "chronique"],
  },
  {
    terms: ["leucemie aigue", "lam3", "promyelocytaire", "myeloblastes", "lymphoblastes", "t 15 17", "pml rara", "aracytine", "blastes"],
    boostTokens: ["leucemie", "aigue", "leucemies", "aigues", "lam", "lal"],
  },
  {
    terms: ["drepanocytose", "hbs", "hbf", "syndrome thoracique aigu", "hydroxyuree", "falciformation", "emmel", "crise vaso occlusive", "thalassemie"],
    boostTokens: ["drepanocytose", "hemoglobinopathie", "hemolyse", "anemie", "hemolytique", "thalassemie"],
  },
  {
    terms: ["spherocytose", "elliptocytose", "g6pd", "corps de heinz", "ektacytometrie", "minkowski", "pyruvate kinase"],
    boostTokens: ["anemie", "hemolytique", "hemolytiques", "membrane", "enzymopathie", "g6pd", "spherocytose"],
  },
  {
    terms: ["biermer", "macrocytaire", "vitamine b12", "cyanocobalamine", "facteur intrinseque", "carence martiale", "ferriprive", "ferritinemie", "plummer vinson"],
    boostTokens: ["anemie", "carentielle", "macrocytaire", "microcytaire", "biermer", "carence", "martiale", "fer", "hemogramme"],
  },
  {
    terms: ["hemophilie", "willebrand", "hemarthrose", "facteur viii", "civd", "coagulation intravasculaire", "fibrinogene", "d dimeres", "tca", "hemostase"],
    boostTokens: ["hemostase", "coagulation", "hemophilie", "willebrand", "civd", "saignement", "purpura", "thrombopenie"],
  },
  {
    terms: ["transfusion", "cross matching", "culot globulaire", "cgr", "incompatibilite abo", "trali", "controle ultime", "groupe sanguin", "rhesus"],
    boostTokens: ["transfusion", "transfusionnelle", "securite", "produits", "sanguins", "immunohematologie"],
  },
  {
    terms: ["lupus", "vespertilio", "anti sm", "anti dna", "slicc", "lupus discoide", "hydroxychloroquine"],
    boostTokens: ["lupus", "erythemateux", "systemique", "connectivite"],
  },
  {
    terms: ["sapl", "antiphospholipides", "anticardiolipine", "lupus anticoagulant", "beta2gp1", "avortements", "livedo"],
    boostTokens: ["sapl", "antiphospholipides", "thrombose"],
  },
  {
    terms: ["sclerodermie", "raynaud", "crest", "rodnan", "scl70", "centromeres", "erasmus", "sclerodactylie", "calcinose"],
    boostTokens: ["sclerodermie", "systemique", "raynaud", "acrosyndrome"],
  },
  {
    terms: ["dermatomyosite", "gottron", "anti synthetases", "jo1", "pl7", "cpk", "polymyosite", "myopathie"],
    boostTokens: ["dermatomyosite", "myosite", "myopathies", "inflammatoires"],
  },
  {
    terms: ["sarcoidose", "brocq pautrier", "lupus pernio", "lofgren", "heerfordt", "mikulicz", "granulome", "vitropression"],
    boostTokens: ["sarcoidose", "granulomatose"],
  },
  {
    terms: ["behcet", "aphte", "aphtose", "hypopion", "uveite", "pathergique", "colchicine", "pseudo folliculite"],
    boostTokens: ["behcet", "aphtose", "vascularite"],
  },
  {
    terms: ["polyarthrite rhumatoide", "anti ccp", "methotrexate", "synovite", "squeeze test", "coup de vent cubital", "sjogren", "sharp", "anti ssa", "u1rnp"],
    boostTokens: ["polyarthrite", "rhumatoide", "sjogren", "sharp", "connectivite"],
  },
  {
    terms: ["corticotherapie", "prednisone", "prednisolone", "betamethasone", "bolus", "corticoide"],
    boostTokens: ["corticotherapie", "corticoides", "anti inflammatoires", "immunosuppresseurs"],
  },
];

export const buildLesson = (
  id: string,
  fileName: string,
  content: string,
  byteSize: number,
  subjectInput: string
): EBLesson => {
  const cleanTitle = cleanLessonTitle(fileName);
  const words = content.split(/\s+/).filter(Boolean);

  const headings = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length >= 5 &&
        l.length <= 110 &&
        (/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+[A-ZÉÈÊÀ]/i.test(l) ||
          (l === l.toUpperCase() && /[A-ZÉÈÊÀ]{4,}/.test(l)))
    )
    .slice(0, 45);

  const freq = new Map<string, number>();
  const normTokens = normalizeText(`${cleanTitle} ${cleanTitle} ${headings.join(" ")} ${content}`).split(" ");
  for (const tok of normTokens) {
    if (tok.length < 4 || STOPWORDS_FR.has(tok) || /^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }
  const titleTokens = normalizeText(cleanTitle)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));

  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 65)
    .map(([k]) => k);

  const keywords = Array.from(new Set([...titleTokens, ...topKeywords]));

  const subjTokens = normalizeText(subjectInput)
    .split(" ")
    .filter((t) => t.length >= 4);
  const normFull = normalizeText(`${cleanTitle} ${content.slice(0, 20000)}`);
  const relevance =
    subjTokens.length === 0
      ? 1
      : subjTokens.some((st) => normFull.includes(st)) || content.length > 200
      ? 1
      : 0;

  return {
    id,
    title: fileName,
    cleanTitle,
    content,
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

export const isItemCorrect = (item: EBItem, chosen: string[]): boolean => {
  if (!chosen || chosen.length === 0) return false;
  if (item.format === "QNS") return chosen[0].trim().length > 10;
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
      type: EB_FORMAT_LABELS[it.format],
      clinicalCase: idx === 0 && block.kind === "CAS_CLINIQUE" ? block.vignette : undefined,
      question: [it.lead ? `[${it.lead}]` : "", it.stem, ...(it.statements || []).map((s, i) => `${i + 1}. ${s}`)]
        .filter(Boolean)
        .join("\n"),
      options: it.options.map((o) => `${o.letter}. ${o.text}`),
      correctAnswers: it.correct,
      explanation: it.explanation,
    }))
  );

// ----------------------------------------------------------------------------
// ISOLATION DE LA MATIÈRE CIBLE (Ex: Hématologie vs Maladies de Système)
// ----------------------------------------------------------------------------
export function isolateSubjectSectionFromExamText(rawText: string, subjectName: string): string {
  const normSubj = normalizeText(subjectName);
  const isHematoTarget = /hemato|sang|hemopathie|transfusion|hemostase/.test(normSubj);
  const isSystemicTarget = /system|interne|auto\s*immun|connectivite|lupus|rhumato/.test(normSubj);

  // Si le document comporte des balises explicites de section (EC1 Hémato / EC2 Maladies de Système)
  if (rawText.includes("=== SECTION EC")) {
    const sections = rawText.split(/(?==== SECTION EC)/g);
    const matching = sections.filter((sec) => {
      const header = normalizeText(sec.slice(0, 220));
      if (isHematoTarget) return header.includes("hemato");
      if (isSystemicTarget) return header.includes("system") || header.includes("maladies");
      return true;
    });
    return matching.join("\n\n").trim();
  }

  // Sinon, filtrage page par page + déduplication des pages scannées en double
  const rawPages = rawText.split(/--- PAGE \d+ ---/g).map((p) => p.trim()).filter(Boolean);
  const uniquePages: string[] = [];
  const seenPageSigs = new Set<string>();

  for (const page of rawPages.length > 0 ? rawPages : [rawText]) {
    const sig = normalizeText(page).slice(0, 180);
    if (sig.length > 40 && seenPageSigs.has(sig)) continue;
    if (sig.length > 40) seenPageSigs.add(sig);

    if (isHematoTarget || isSystemicTarget) {
      const normPage = normalizeText(page);
      const hematoScore =
        (normPage.match(
          /\b(hemogramme|myelogramme|leucemie|lymphome|myelome|drepanocytose|hemophilie|willebrand|plaquettes|reticulocytes|transfusion|bcr\s*abl|jak2|hackett|binet|salmon)\b/g
        ) || []).length;
      const systemicScore =
        (normPage.match(
          /\b(lupus|sclerodermie|sarcoidose|behcet|dermatomyosite|sjogren|sharp|raynaud|polyarthrite|anticorps\s*anti|corticotherapie|aphte|gottron|uveite|antiphospholipides|sapl)\b/g
        ) || []).length;

      if (isHematoTarget && systemicScore >= 2 && hematoScore === 0) continue;
      if (isSystemicTarget && hematoScore >= 2 && systemicScore === 0) continue;
    }

    uniquePages.push(page);
  }

  return uniquePages.join("\n\n").trim();
}

interface ParsedQuestionUnit {
  number: number;
  stemAndCase: string;
  fullRawBlock: string;
  format: EBFormat;
  isCasePart: boolean;
}

function detectFormatFromQuestionBlock(rawBlock: string): EBFormat {
  const head = rawBlock.slice(0, 160).toUpperCase();
  if (head.includes("GROUPAGE")) return "GROUPAGE";
  if (head.includes("CENSURE")) return "CENSURE";
  if (head.includes("JUMELAGE")) return "JUMELAGE";
  if (head.includes("COMPLEMENT_MULTIPLE") || head.includes("COMPLEMENTS MULTIPLES")) return "COMPLEMENT_MULTIPLE";
  if (head.includes("QNS")) return "QNS";
  if (head.includes("ELECTION") || head.includes("ÉLECTION")) return "ELECTION";

  const norm = normalizeText(rawBlock);
  if (/\bparce que\b/.test(norm)) return "JUMELAGE";
  if (/(?:^|\n)\s*[1-5][.)]\s+\S+/.test(rawBlock)) return "GROUPAGE";
  if (/\b(censure|fausse|inexacte|erronee|sauf|n est pas|ne permet pas|moins probable)\b/.test(norm)) {
    return "CENSURE";
  }
  if (/\b(complement multiple|lesquelles|les propositions exactes|cochez les|deux des|choisir 3)\b/.test(norm)) {
    return "COMPLEMENT_MULTIPLE";
  }
  return "ELECTION";
}

function parseExamQuestions(rawText: string, subjectName = ""): { questions: ParsedQuestionUnit[]; caseCount: number } {
  const sectionText = isolateSubjectSectionFromExamText(rawText, subjectName);
  if (!sectionText || sectionText.length < 30) {
    return { questions: [], caseCount: 0 };
  }

  const cleaned = sectionText
    .replace(/\[CORRECTION_MANUSCRITE_DETECTEE:[^\]]*\]/gi, "")
    .replace(/--- PAGE \d+ ---/g, "\n");

  const caseMatches = cleaned.match(/(?:cas\s+clinique|dossier\s+clinique)\s*\d*/gi);
  const caseCount = caseMatches ? caseMatches.length : 0;

  const regex = /(?:^|\n)\s*(?:QCM\s*(\d{1,3})|Q(?:uestion)?\s*(\d{1,3})|(\d{1,3})\s*[.)-])\s+/gim;
  const indices: Array<{ index: number; num: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(cleaned)) !== null) {
    const num = parseInt(m[1] || m[2] || m[3], 10);
    if (num >= 1 && num <= 100) {
      indices.push({ index: m.index, num });
    }
  }

  const questions: ParsedQuestionUnit[] = [];
  let activeCaseVignette = "";

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : cleaned.length;
    const preText = i === 0 ? cleaned.slice(0, start) : cleaned.slice(indices[i - 1].index, start);

    const caseIdx = preText.search(/cas\s+clinique\s*\d*/i);
    if (caseIdx !== -1) {
      activeCaseVignette = preText.slice(caseIdx).trim();
    }

    const block = cleaned.slice(start, end).trim();
    const nextCaseInBlock = block.search(/\n\s*cas\s+clinique\s*\d*/i);
    const cleanQuestionBlock = nextCaseInBlock !== -1 ? block.slice(0, nextCaseInBlock).trim() : block;

    const firstOptionIdx = cleanQuestionBlock.search(/(?:^|\n)\s*(?:[A-E][.)-]|\([1-5]\))\s+/m);
    const stemOnly = firstOptionIdx > 12 ? cleanQuestionBlock.slice(0, firstOptionIdx).trim() : cleanQuestionBlock;

    questions.push({
      number: indices[i].num,
      stemAndCase: `${activeCaseVignette}\n${stemOnly}`.trim(),
      fullRawBlock: cleanQuestionBlock,
      format: detectFormatFromQuestionBlock(cleanQuestionBlock),
      isCasePart: activeCaseVignette.length > 0,
    });

    if (nextCaseInBlock !== -1) {
      activeCaseVignette = block.slice(nextCaseInBlock).trim();
    }
  }

  return { questions, caseCount: Math.max(caseCount, activeCaseVignette ? 1 : 0) };
}

// Attribution sémantique haute précision entre un énoncé de QCM/Cas clinique et les cours de l'étudiant
function matchQuestionStemToLesson(
  stemAndCase: string,
  lessons: EBLesson[]
): { lessonId: string | null; weak: boolean } {
  const normStem = normalizeText(stemAndCase);
  if (!normStem || lessons.length === 0) return { lessonId: null, weak: false };

  // Identification des clusters médicaux présents dans l'énoncé
  const activeBoostTokens = new Set<string>();
  for (const cluster of MEDICAL_TOPIC_CLUSTERS) {
    if (cluster.terms.some((t) => normStem.includes(normalizeText(t)))) {
      cluster.boostTokens.forEach((bt) => activeBoostTokens.add(normalizeText(bt)));
    }
  }

  let bestId: string | null = null;
  let bestScore = 0;

  for (const lesson of lessons) {
    if (lesson.duplicateOf) continue;
    let score = 0;
    const normTitle = normalizeText(lesson.cleanTitle);
    const titleTokens = normTitle.split(" ").filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));

    // 1. Correspondance directe ou par cluster médical sur le titre de la leçon
    for (const tt of titleTokens) {
      if (normStem.includes(tt)) score += 7;
      if (activeBoostTokens.has(tt)) score += 9;
    }

    // 2. Correspondance sur les sous-titres internes du cours
    for (const h of lesson.headings) {
      const nh = normalizeText(h);
      if (nh.length >= 6 && normStem.includes(nh)) score += 8;
      for (const bt of activeBoostTokens) {
        if (nh.includes(bt)) score += 4;
      }
    }

    // 3. Correspondance sur l'empreinte de mots-clés du cours
    for (const kw of lesson.keywords.slice(0, 45)) {
      if (normStem.includes(kw)) score += 1.5;
      if (activeBoostTokens.has(kw)) score += 2.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = lesson.id;
    }
  }

  if (!bestId || bestScore < 2.5) {
    return { lessonId: lessons[0]?.id || null, weak: true };
  }
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
  const seenExamFingerprints = new Map<string, string>();

  for (const annale of annales) {
    const { questions, caseCount } = parseExamQuestions(annale.rawText, subjectName);

    if (questions.length === 0) {
      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year,
        questionCount: 0,
        caseCount: 0,
        formatCounts: {},
        lessonsUsed: [],
        lessonQcmCounts: {},
        audited: true,
      });
      warnings.push(
        `« ${annale.title} » ne contient aucune question de « ${subjectName} » (épreuve d'une autre matière de l'UE ignorée dans le calcul).`
      );
      continue;
    }

    // Détection automatique des doublons inter-fichiers (ex: Exam 2019 Hémato corrigé vs Exam 2019 Hémato & MS)
    const examFingerprint = normalizeText(
      questions
        .slice(0, 4)
        .map((q) => q.stemAndCase.slice(0, 80))
        .join(" ")
    ).slice(0, 160);

    if (examFingerprint.length > 40 && seenExamFingerprints.has(examFingerprint)) {
      const firstTitle = seenExamFingerprints.get(examFingerprint);
      warnings.push(
        `Doublon fusionné : la partie ${subjectName} de « ${annale.title} » est identique à « ${firstTitle} » (comptée une seule fois).`
      );
      continue;
    }
    if (examFingerprint.length > 40) {
      seenExamFingerprints.set(examFingerprint, annale.title);
    }

    const formatCounts: Partial<Record<EBFormat, number>> = {};
    const lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }> = {};
    let lastLessonId: string | null = null;

    for (const q of questions) {
      formatCounts[q.format] = (formatCounts[q.format] || 0) + 1;
      formatDistribution[q.format] = (formatDistribution[q.format] || 0) + 1;

      const { lessonId, weak } = matchQuestionStemToLesson(q.stemAndCase, usableLessons);
      if (lessonId) {
        const prev = lessonQcmCounts[lessonId] || { blocks: 0, qcm: 0, weak: true };
        const isNewBlock = lessonId !== lastLessonId;
        lessonQcmCounts[lessonId] = {
          blocks: prev.blocks + (isNewBlock ? 1 : 0),
          qcm: prev.qcm + 1,
          weak: prev.weak && weak,
        };
        lastLessonId = lessonId;
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
      audited: true,
    });
  }

  const validExams = exams.filter((e) => e.questionCount > 0);
  const totalExamsCount = Math.max(1, validExams.length);

  const maxQcm =
    validExams.length > 0
      ? Math.max(...validExams.map((e) => e.questionCount))
      : Math.min(20, Math.max(10, usableLessons.length * 4));

  const rawAvgLessons =
    validExams.length > 0
      ? validExams.reduce((sum, e) => sum + Math.max(1, e.lessonsUsed.length), 0) / validExams.length
      : Math.min(4, usableLessons.length);

  const avgLessonsPerExam = Number(rawAvgLessons.toFixed(1));
  const quota = Math.max(
    1,
    Math.min(usableLessons.length, Math.round(rawAvgLessons) || Math.min(4, usableLessons.length))
  );

  const totalMappedQcmAllLessons = Math.max(
    1,
    usableLessons.reduce(
      (acc, l) => acc + validExams.reduce((s, e) => s + (e.lessonQcmCounts[l.id]?.qcm || 0), 0),
      0
    )
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

  const preferredFormats = Object.entries(formatDistribution)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([f]) => f as EBFormat);

  const activeFormats: EBFormat[] =
    preferredFormats.length > 0 ? preferredFormats : ["ELECTION", "GROUPAGE", "CENSURE"];

  const blueprint: BlueprintSpec[] = lessonStats.slice(0, quota).map((st, idx) => ({
    id: `bp_${idx + 1}`,
    kind: validExams.some((e) => e.caseCount > 0) || idx === 0 ? "CAS_CLINIQUE" : "STANDALONE",
    lessonIds: [st.lessonId],
    formats: [
      activeFormats[0] || "ELECTION",
      activeFormats[1 % activeFormats.length] || "GROUPAGE",
      activeFormats[2 % activeFormats.length] || "CENSURE",
      activeFormats[3 % activeFormats.length] || "ELECTION",
    ],
  }));

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
      avgItemsPerCase: 5,
      preferredFormats: activeFormats,
      typicalStemPatterns: [],
    },
    warnings,
  };
}

// Analyse en 1 seule passe linéaire (examen 1 -> examen N, sans jamais revenir en arrière)
export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI?: boolean;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, lessons, annales, onProgress, isCancelled } = params;

  for (let i = 0; i < annales.length; i++) {
    if (isCancelled?.()) break;
    onProgress?.({
      phase: "audit",
      message: `Analyse docimologique (${i + 1}/${annales.length}) : ${annales[i].title}…`,
      current: i,
      total: Math.max(1, annales.length),
    });
    await new Promise((r) => setTimeout(r, 80));
  }

  return computeCorpusAnalysis(subjectName, lessons, annales);
}

// ----------------------------------------------------------------------------
// GÉNÉRATION DE L'EXAMEN BLANC (FIDÈLE AUX FORMATS & CAS CLINIQUES UCAD)
// ----------------------------------------------------------------------------
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
    .split(/(?<=[.!?])\s+|\r?\n/)
    .map((s) => s.replace(/^[•*-]\s*/, "").trim())
    .filter((s) => s.length > 40 && s.length < 220 && !/^--- PAGE/.test(s));

  const items: EBItem[] = (
    spec.formats.length ? spec.formats : (["ELECTION", "GROUPAGE", "CENSURE", "ELECTION"] as EBFormat[])
  ).map((fmt, idx) => {
    const s1 =
      sentences[(idx * 4) % Math.max(1, sentences.length)] ||
      `Le diagnostic positif de « ${lesson?.cleanTitle || "cette pathologie"} » repose sur les arguments cliniques et biologiques du cours.`;
    const s2 =
      sentences[(idx * 4 + 1) % Math.max(1, sentences.length)] ||
      `L'exploration paraclinique de référence permet de confirmer le stade évolutif de « ${lesson?.cleanTitle} ».`;
    const s3 =
      sentences[(idx * 4 + 2) % Math.max(1, sentences.length)] ||
      `La prise en charge thérapeutique de « ${lesson?.cleanTitle} » doit être adaptée aux facteurs pronostiques.`;

    return {
      id: `${blockId}_q_${idx + 1}`,
      number: idx + 1,
      format: fmt,
      lead:
        idx === 2 && spec.kind === "CAS_CLINIQUE"
          ? `Le bilan biologique et paraclinique complémentaire de votre patient précise les anomalies caractéristiques étudiées dans le cours « ${lesson?.cleanTitle} ».`
          : undefined,
      stem:
        fmt === "CENSURE"
          ? `Concernant « ${lesson?.cleanTitle} », toutes les propositions suivantes sont exactes SAUF UNE. Indiquez la proposition INEXACTE :`
          : fmt === "GROUPAGE"
          ? `Parmi les propositions suivantes concernant « ${lesson?.cleanTitle} », indiquez la combinaison exacte (A=1+2+3, B=1+3, C=2+4, D=4, E=autre choix) :`
          : `Quelle est la proposition exacte concernant la démarche diagnostique et thérapeutique de « ${lesson?.cleanTitle} » ?`,
      statements:
        fmt === "GROUPAGE"
          ? [
              s1,
              s2,
              s3,
              "L'évolution spontanée se fait systématiquement vers la guérison sans aucune prise en charge.",
            ]
          : fmt === "JUMELAGE"
          ? [s1, s2]
          : undefined,
      options:
        fmt === "GROUPAGE"
          ? [
              { letter: "A", text: "1 + 2 + 3" },
              { letter: "B", text: "1 + 3" },
              { letter: "C", text: "2 + 4" },
              { letter: "D", text: "4 seulement" },
              { letter: "E", text: "Autre choix" },
            ]
          : [
              { letter: "A", text: s1 },
              { letter: "B", text: s2 },
              {
                letter: "C",
                text: "L'abstention diagnostique et thérapeutique est systématique quelle que soit la gravité clinique.",
              },
              {
                letter: "D",
                text: "Aucun contrôle biologique ni surveillance clinique n'est indiqué au cours de l'évolution.",
              },
              {
                letter: "E",
                text: "Le pronostic ne dépend d'aucun paramètre clinique, cytologique ou biologique.",
              },
            ],
      correct: fmt === "CENSURE" ? ["C"] : ["A"],
      explanation: `Référence directe au cours « ${lesson?.cleanTitle} » : ${s1}`,
      lessonId: lesson?.id,
    };
  });

  return {
    id: blockId,
    kind: spec.kind,
    header: `Cas clinique — ${lesson?.cleanTitle || "Évaluation"}`,
    vignette:
      spec.kind === "CAS_CLINIQUE"
        ? `Un patient est admis dans le service pour un tableau clinique et biologique caractéristique relevant du chapitre « ${lesson?.cleanTitle} ». L'examen physique initial et les premiers résultats de l'hémogramme orientent vers les critères diagnostiques de votre cours.`
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
      : (["ELECTION", "GROUPAGE", "CENSURE"] as EBFormat[]);

  let globalQuestionNumber = 1;
  const itemsPerLesson = Math.max(4, Math.round((analysis.maxQcm || 20) / Math.max(1, selected.length)));

  for (let i = 0; i < selected.length; i++) {
    if (isCancelled?.()) break;
    const lesson = selected[i];

    onProgress?.({
      phase: "redaction",
      message: `Rédaction calibrée UCAD : « ${lesson.cleanTitle} » (${i + 1}/${selected.length})…`,
      current: i,
      total: selected.length,
    });

    const formatsForBlock: EBFormat[] = Array.from({ length: itemsPerLesson }, (_, k) => {
      return activeFormats[(i + k) % activeFormats.length] || "ELECTION";
    });

    const spec: BlueprintSpec = {
      id: `block_${i + 1}`,
      kind: analysis.style.usesClinicalCases || i < 3 ? "CAS_CLINIQUE" : "STANDALONE",
      lessonIds: [lesson.id],
      formats: formatsForBlock,
    };

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          action: "generate_examen_blanc_block",
          systemPrompt,
          ueName,
          subjectName,
          sessionSeed,
          lessonTitle: lesson.cleanTitle,
          lessonContent: lesson.content,
          blueprintSpec: spec,
        },
      });

      if (!error && data?.block && Array.isArray(data.block.items) && data.block.items.length > 0) {
        const numberedItems: EBItem[] = data.block.items.map((it: any) => {
          let opts: EBOption[] = [];
          if (Array.isArray(it.options) && it.options.length > 0) {
            opts = it.options.map((o: any, idx: number) => {
              if (typeof o === "string") {
                const letterMatch = o.match(/^([A-E])[.)]\s*(.*)$/i);
                return {
                  letter: letterMatch ? letterMatch[1].toUpperCase() : (["A","B","C","D","E"][idx] || "A"),
                  text: letterMatch ? letterMatch[2].trim() : o.trim()
                };
              }
              return {
                letter: String(o.letter || ["A","B","C","D","E"][idx] || "A").toUpperCase(),
                text: String(o.text || o.label || "").trim()
              };
            });
          }
          return {
            id: `eb_${sessionSeed}_${i + 1}_${globalQuestionNumber}`,
            number: globalQuestionNumber++,
            format: (it.format || "ELECTION") as EBFormat,
            stem: String(it.stem || it.question || `Question sur ${lesson.cleanTitle}`).trim(),
            lead: it.lead,
            statements: Array.isArray(it.statements) ? it.statements : undefined,
            options: opts.length >= 2 ? opts : [
              { letter: "A", text: "Proposition A" },
              { letter: "B", text: "Proposition B" },
              { letter: "C", text: "Proposition C" },
              { letter: "D", text: "Proposition D" },
              { letter: "E", text: "Proposition E" }
            ],
            correct: Array.isArray(it.correct) && it.correct.length > 0 ? it.correct.map((c: any) => String(c).toUpperCase()) : ["A"],
            explanation: it.explanation || `Référence au cours « ${lesson.cleanTitle} ».`,
            lessonId: lesson.id,
          };
        });
        blocks.push({
          ...data.block,
          id: `block_${sessionSeed}_${i + 1}`,
          lessonIds: [lesson.id],
          items: numberedItems,
        });
        continue;
      }
    } catch {
      // bascule sur la synthèse autonome du cours
    }

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

  return { blocks, warnings };
}
