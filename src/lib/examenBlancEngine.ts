// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR DOCIMOLOGIQUE UNIVERSEL — Auto-Hydratation des Cours, Analyse Profonde
// Épreuve par Épreuve & QCM par QCM, Probabilités & Génération Calibrée UCAD
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
  "patient", "patiente", "ans", "consulte", "clinique", "bilan", "suivantes", "suivant",
  "propositions", "proposition", "laquelle", "lequel", "parmi", "cochez", "cocher",
  "reponse", "reponses", "exacte", "fausse", "juste", "incorrecte", "question", "qcm",
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
    .replace(/^(cours|lecon|chapitre|item|ue|module)[\s_-]*\d*[\s_:-]*/i, "")
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

// ----------------------------------------------------------------------------
// 1. DICTIONNAIRE DOCIMOLOGIQUE MÉDICAL PROFOND (CLUSTERS SÉMANTIQUES)
//    Permet de relier un cas clinique aux cours même si le nom de la maladie
//    n'est pas écrit dans l'énoncé (ex: "dacryocytes + splénomégalie" -> Myélofibrose/SMP)
// ----------------------------------------------------------------------------
interface MedicalTopicCluster {
  id: string;
  diagnosticMarkers: string[];
  courseKeywords: string[];
}

const MEDICAL_TOPIC_CLUSTERS: MedicalTopicCluster[] = [
  {
    id: "myelome_gammapathies",
    diagnosticMarkers: [
      "myelome", "mgus", "plasmocyte", "plasmocytose", "crab", "bence jones",
      "durie", "salmon", "immunofixation", "pic etroit", "pic monoclonal",
      "composant monoclonal", "biphosphonate", "bisphosphonate", "melphalan",
      "velcade", "bortezomib", "thalidomide", "autogreffe", "waldenstrom",
      "beta 2 microglobuline", "hyperprotidemie", "geodes", "imwg",
    ],
    courseKeywords: [
      "myelome", "multiple", "gammapathie", "gammapathies", "monoclonale",
      "monoclonales", "dysglobulinemie", "plasmocytaire", "waldenstrom", "mgus",
    ],
  },
  {
    id: "llc_lymphoproliferatif",
    diagnosticMarkers: [
      "leucemie lymphoide chronique", "llc", "gumprecht", "ombres de gumprecht",
      "matutes", "score de matutes", "binet", "classification de binet",
      "syndrome de richter", "richter", "hyperlymphocytose", "lymphocytes matures",
      "syndrome d evans", "immunophenotypage lymphocytaire",
    ],
    courseKeywords: [
      "leucemie", "lymphoide", "chronique", "llc", "lymphoproliferatif",
      "lymphoproliferatifs", "hyperlymphocytose", "richter", "binet",
    ],
  },
  {
    id: "lymphomes_hodgkin_lnh",
    diagnosticMarkers: [
      "lymphome", "hodgkin", "non hodgkinien", "reed sternberg", "sternberg",
      "cellule lacunaire", "ann arbor", "abvd", "r chop", "chop", "rituximab",
      "cd20", "cd30", "cd15", "score ipi", "index pronostique international",
      "grandes cellules", "biopsie ganglionnaire", "polyadenopathie",
    ],
    courseKeywords: [
      "lymphome", "lymphomes", "hodgkin", "hodgkinien", "lnh", "adenopathie",
      "adenopathies", "ganglionnaire", "sternberg", "ann arbor",
    ],
  },
  {
    id: "smp_vaquez_lmc_myelofibrose",
    diagnosticMarkers: [
      "polyglobulie", "vaquez", "myelofibrose", "splenomegalie myeloide",
      "thrombocytemie essentielle", "jak2", "v617f", "bcr abl", "philadelphie",
      "lmc", "leucemie myeloide chronique", "dacryocytes", "calreticuline",
      "mpl", "erythrose faciale", "imatinib", "myelemie", "panmyelose",
    ],
    courseKeywords: [
      "myeloproliferatif", "myeloproliferatifs", "smp", "polyglobulie", "vaquez",
      "lmc", "myelofibrose", "thrombocytemie", "myeloide chronique", "jak2",
    ],
  },
  {
    id: "leucemies_aigues_lam_lal",
    diagnosticMarkers: [
      "leucemie aigue", "promyelocytaire", "lam3", "myeloblastes", "lymphoblastes",
      "translocation t 15 17", "t 15 17", "pml rara", "aracytine", "corps d auer",
      "blastose", "blastes", "acutisation", "leucostase",
    ],
    courseKeywords: [
      "leucemie aigue", "leucemies aigues", "lam", "lal", "myeloblastique",
      "lymphoblastique", "promyelocytaire", "blastes",
    ],
  },
  {
    id: "drepanocytose_thalassemies",
    diagnosticMarkers: [
      "drepanocytose", "hbs", "hbf", "hba2", "syndrome thoracique aigu",
      "hydroxyuree", "falciformation", "test d emmel", "emmel", "crise vaso occlusive",
      "thalassemie", "electrophorese de l hemoglobine", "hackett", "echange transfusionnel",
    ],
    courseKeywords: [
      "drepanocytose", "drepanocytaires", "hemoglobinopathie", "hemoglobinopathies",
      "thalassemie", "thalassemies", "hbs", "falciformation", "hemolytique",
    ],
  },
  {
    id: "anemies_hemolytiques_membrane_enzymes",
    diagnosticMarkers: [
      "spherocytose", "microspherocytose", "minkowski chauffard", "elliptocytose",
      "ektacytometrie", "g6pd", "corps de heinz", "pyruvate kinase",
      "hemoglobinurie", "haptoglobine effondree", "quinine", "anemie hemolytique",
      "reticulocytes", "bilirubine non conjuguee", "bilirubine indirecte",
    ],
    courseKeywords: [
      "hemolytique", "hemolytiques", "hemolyse", "spherocytose", "elliptocytose",
      "g6pd", "enzymopathie", "membrane", "erythrocytaire", "anemie",
    ],
  },
  {
    id: "anemies_carentielles_biermer_martiale",
    diagnosticMarkers: [
      "biermer", "anemie macrocytaire", "vitamine b12", "cyanocobalamine",
      "facteur intrinseque", "cellules parietales", "glossite de hunter",
      "paraparesie", "neuroanemique", "carence martiale", "ferriprive",
      "plummer vinson", "perleches", "ferritinemie", "microcytaire hypochrome",
      "myelodysplasique", "acide folique",
    ],
    courseKeywords: [
      "biermer", "macrocytaire", "megaloblastique", "carentielle", "carentielles",
      "martiale", "ferriprive", "fer", "vitamine b12", "folates", "anemie", "hemogramme",
    ],
  },
  {
    id: "hemostase_hemophilie_willebrand_civd",
    diagnosticMarkers: [
      "hemophilie", "hemophile", "conductrice", "willebrand", "von willebrand",
      "hemarthrose", "facteur viii", "fviii", "temps de saignement", "ivy",
      "civd", "coagulation intravasculaire disseminee", "d dimeres", "fibrinemie",
      "fibrinogene", "tca allonge", "post partum", "defibrination", "purpura",
    ],
    courseKeywords: [
      "hemostase", "coagulation", "hemophilie", "willebrand", "civd",
      "hémorragique", "hemorragique", "thrombopenie", "purpura", "plaquettes",
    ],
  },
  {
    id: "transfusion_immunohematologie",
    diagnosticMarkers: [
      "transfusion", "transfusionnelle", "transfusionnels", "cross matching",
      "controle ultime", "lit du malade", "culot globulaire", "concentres de globules rouges",
      "cgr", "plasma frais congele", "concentres plaquettaires", "incompatibilite abo",
      "trali", "reaction febrile non hemolytique", "allo immunisation anti d", "rhesus",
    ],
    courseKeywords: [
      "transfusion", "transfusionnelle", "securite transfusionnelle", "produits sanguins",
      "immunohematologie", "groupes sanguins", "abo", "rhesus", "accident transfusionnel",
    ],
  },
  {
    id: "lupus_systemique_discoide",
    diagnosticMarkers: [
      "lupus systemique", "lupus erythemateux", "lupus aigu", "lupus discoide",
      "vespertilio", "sillons naso geniens", "anti sm", "anti dna natif",
      "slicc", "acr 1997", "nephropathie lupique", "glomerulonephrite lupique",
      "hydroxychloroquine", "pericardite lupique", "libman sacks",
    ],
    courseKeywords: ["lupus", "erythemateux", "systemique", "discoide", "les"],
  },
  {
    id: "sapl_antiphospholipides",
    diagnosticMarkers: [
      "sapl", "antiphospholipides", "anti phospholipides", "anticardiolipine",
      "anti cardiolipine", "lupus anticoagulant", "anti beta2gp1", "anti b2 gp1",
      "pertes foetales", "avortements a repetition", "livedo", "vdrl positif",
      "syndrome catastrophique",
    ],
    courseKeywords: ["sapl", "antiphospholipides", "phospholipides", "thrombose"],
  },
  {
    id: "sclerodermie_raynaud_crest",
    diagnosticMarkers: [
      "sclerodermie", "phenomene de raynaud", "raynaud", "crest", "rodnan",
      "anti scl70", "scl70", "anti topoisomerase", "anti centromeres",
      "sclerodactylie", "cicatrices stellaires", "achromie mouchetee",
      "syndrome d erasmus", "silice", "calcinose", "htap", "fibrose pulmonaire",
    ],
    courseKeywords: ["sclerodermie", "raynaud", "crest", "acrosyndrome", "sclerose"],
  },
  {
    id: "dermatomyosite_myopathies",
    diagnosticMarkers: [
      "dermatomyosite", "papules de gottron", "gottron", "erythro oedeme",
      "liliace", "anti synthetases", "anti jo1", "jo 1", "anti pl7", "anti pl12",
      "testing musculaire", "daniels", "cpk", "electromyogramme", "emg", "polymyosite",
    ],
    courseKeywords: ["dermatomyosite", "polymyosite", "myosite", "myopathies", "inflammatoires"],
  },
  {
    id: "sarcoidose",
    diagnosticMarkers: [
      "sarcoidose", "sarcoides", "vitropression", "lupoide", "brocq pautrier",
      "lupus pernio", "scar sarcoidosis", "darier roussy", "heerfordt",
      "mikulicz", "adenopathies hilaires", "enzyme de conversion", "granulome sans necrose",
    ],
    courseKeywords: ["sarcoidose", "granulomatose", "sarcoide", "bbs"],
  },
  {
    id: "maladie_de_behcet",
    diagnosticMarkers: [
      "behcet", "aphte", "aphtes", "aphtose bipolaire", "ulcerations scrotales",
      "ulcerations genitales", "uveite", "hypopion", "pseudo folliculite",
      "test pathergique", "colchicine", "periphlebite",
    ],
    courseKeywords: ["behcet", "aphtose", "vascularite", "uveite"],
  },
  {
    id: "pr_sjogren_sharp",
    diagnosticMarkers: [
      "polyarthrite rhumatoide", "squeeze test", "anti ccp", "facteurs rhumatoides",
      "methotrexate", "synovites", "coup de vent cubital", "col de cygne",
      "boutonniere", "nodules rhumatoides", "sjogren", "gougerot", "xerostomie",
      "secheresse oculaire", "anti ssa", "anti ssb", "syndrome de sharp", "u1rnp",
    ],
    courseKeywords: ["polyarthrite", "rhumatoide", "sjogren", "gougerot", "sharp", "connectivite"],
  },
  {
    id: "corticotherapie_autoimmunite",
    diagnosticMarkers: [
      "corticotherapie", "prednisone", "prednisolone", "betamethasone",
      "methylprednisolone", "triamcinolone", "bolus", "bioequivalence",
      "axe hypothalamo", "auto immunite", "tolerance immunitaire",
      "anticorps antinucleaires", "fluorescence", "ifi", "fievre mediterraneenne familiale",
    ],
    courseKeywords: [
      "corticotherapie", "corticoides", "auto immunite", "auto anticorps",
      "maladies systemiques", "fmf", "generalites",
    ],
  },
];

// ----------------------------------------------------------------------------
// 2. CONSTRUCTION & AUTO-RÉHYDRATATION INFAILLIBLE DES COURS (EBLesson)
//    Empêche définitivement "lesson.headings is not iterable" sur le localStorage
// ----------------------------------------------------------------------------
export const buildLesson = (
  id: string,
  fileName: string,
  content: string,
  byteSize: number,
  subjectInput: string
): EBLesson => {
  const safeContent = String(content || "");
  const safeTitle = String(fileName || "Cours");
  const cleanTitle = cleanLessonTitle(safeTitle);
  const words = safeContent.split(/\s+/).filter(Boolean);

  const headings = safeContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length >= 5 &&
        l.length <= 120 &&
        (/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+[A-ZÉÈÊÀ]/i.test(l) ||
          (l === l.toUpperCase() && /[A-ZÉÈÊÀ]{4,}/.test(l)))
    )
    .slice(0, 60);

  const freq = new Map<string, number>();
  const normTokens = normalizeText(`${cleanTitle} ${cleanTitle} ${headings.join(" ")} ${safeContent}`).split(" ");
  for (const tok of normTokens) {
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

  const keywords = Array.from(new Set([...titleTokens, ...topKeywords]));

  const subjTokens = normalizeText(subjectInput)
    .split(" ")
    .filter((t) => t.length >= 4);
  const normFull = normalizeText(`${cleanTitle} ${safeContent.slice(0, 25000)}`);
  const relevance =
    subjTokens.length === 0
      ? 1
      : subjTokens.some((st) => normFull.includes(st)) || safeContent.length > 150
      ? 1
      : 0;

  return {
    id: String(id || `lesson-${Date.now()}`),
    title: safeTitle,
    cleanTitle,
    content: safeContent,
    wordCount: words.length,
    sizeLabel: sizeLabelOf(byteSize || safeContent.length),
    keywords,
    headings,
    relevance,
  };
};

// Réhydrate tout objet EBLesson issu d'un ancien localStorage pour garantir que headings et keywords sont toujours des Array valides
export function ensureHydratedLesson(rawLesson: Partial<EBLesson>, subjectInput = ""): EBLesson {
  const hasValidHeadings = Array.isArray(rawLesson.headings) && rawLesson.headings.length > 0;
  const hasValidKeywords = Array.isArray(rawLesson.keywords) && rawLesson.keywords.length > 0;

  if (hasValidHeadings && hasValidKeywords && rawLesson.cleanTitle && typeof rawLesson.content === "string") {
    return {
      id: String(rawLesson.id || `l-${Date.now()}`),
      title: String(rawLesson.title || rawLesson.cleanTitle || "Cours"),
      cleanTitle: String(rawLesson.cleanTitle || cleanLessonTitle(rawLesson.title || "Cours")),
      content: rawLesson.content,
      wordCount: Number(rawLesson.wordCount) || rawLesson.content.split(/\s+/).filter(Boolean).length,
      sizeLabel: String(rawLesson.sizeLabel || sizeLabelOf(rawLesson.content.length)),
      headings: rawLesson.headings,
      keywords: rawLesson.keywords,
      relevance: typeof rawLesson.relevance === "number" ? rawLesson.relevance : 1,
      duplicateOf: rawLesson.duplicateOf,
    };
  }

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

// ----------------------------------------------------------------------------
// 3. INDEX SÉMANTIQUE PROFOND SUR 100 % DU CONTENU DE CHAQUE COURS
// ----------------------------------------------------------------------------
interface IndexedLessonProfile {
  lesson: EBLesson;
  normTitle: string;
  titleTokens: string[];
  normHeadings: string[];
  normContent: string;
  keywordSet: Set<string>;
  clusterScores: Map<string, number>;
}

function buildIndexedLessonProfiles(lessons: EBLesson[], subjectName: string): IndexedLessonProfile[] {
  return lessons
    .map((l) => ensureHydratedLesson(l, subjectName))
    .filter((l) => !l.duplicateOf)
    .map((lesson) => {
      const normTitle = normalizeText(lesson.cleanTitle);
      const titleTokens = normTitle.split(" ").filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));
      const normHeadings = (lesson.headings || []).map((h) => normalizeText(h)).filter((h) => h.length >= 4);
      const normContent = normalizeText(lesson.content);
      const keywordSet = new Set<string>(lesson.keywords || []);

      const clusterScores = new Map<string, number>();
      for (const cluster of MEDICAL_TOPIC_CLUSTERS) {
        let cScore = 0;
        for (const ck of cluster.courseKeywords) {
          const nck = normalizeText(ck);
          if (normTitle.includes(nck)) cScore += 25;
          if (normHeadings.some((h) => h.includes(nck))) cScore += 10;
          if (normContent.includes(nck)) cScore += 3;
        }
        for (const dm of cluster.diagnosticMarkers) {
          const ndm = normalizeText(dm);
          if (normTitle.includes(ndm)) cScore += 20;
          else if (normContent.includes(ndm)) cScore += 2;
        }
        if (cScore > 0) clusterScores.set(cluster.id, cScore);
      }

      return {
        lesson,
        normTitle,
        titleTokens,
        normHeadings,
        normContent,
        keywordSet,
        clusterScores,
      };
    });
}

// ----------------------------------------------------------------------------
// 4. DÉCOUPAGE CHIRURGICAL DES ÉPREUVES : MATIÈRE -> CAS CLINIQUES -> QCM
// ----------------------------------------------------------------------------
export function isolateSubjectSectionFromExamText(rawText: string, subjectName: string): string {
  const safeRaw = String(rawText || "");
  const normSubj = normalizeText(subjectName);
  const isHematoTarget = /hemato|sang|hemopathie|transfusion|hemostase/.test(normSubj);
  const isSystemicTarget = /system|interne|auto\s*immun|connectivite|lupus|rhumato/.test(normSubj);

  // 1. Si l'épreuve possède des balises explicites de section (EC1 Hématologie / EC2 Maladies de Système)
  if (safeRaw.includes("=== SECTION EC")) {
    const sections = safeRaw.split(/(?==== SECTION EC)/g);
    const matching = sections.filter((sec) => {
      const header = normalizeText(sec.slice(0, 240));
      if (isHematoTarget) return header.includes("hemato");
      if (isSystemicTarget) return header.includes("system") || header.includes("maladies");
      return true;
    });
    return matching.join("\n\n").trim();
  }

  // 2. Sinon, filtrage page par page + déduplication des pages scannées deux fois
  const rawPages = safeRaw.split(/--- PAGE \d+ ---/g).map((p) => p.trim()).filter(Boolean);
  const uniquePages: string[] = [];
  const seenPageSigs = new Set<string>();

  for (const page of rawPages.length > 0 ? rawPages : [safeRaw]) {
    const sig = normalizeText(page).slice(0, 180);
    if (sig.length > 40 && seenPageSigs.has(sig)) continue;
    if (sig.length > 40) seenPageSigs.add(sig);

    if (isHematoTarget || isSystemicTarget) {
      const normPage = normalizeText(page);
      const hematoScore =
        (normPage.match(
          /\b(hemogramme|myelogramme|medullogramme|leucemie|lymphome|myelome|drepanocytose|hemophilie|willebrand|plaquettes|reticulocytes|transfusion|bcr\s*abl|jak2|hackett|binet|salmon|biermer|g6pd|spherocytose)\b/g
        ) || []).length;
      const systemicScore =
        (normPage.match(
          /\b(lupus|sclerodermie|sarcoidose|behcet|dermatomyosite|sjogren|sharp|raynaud|polyarthrite|anticorps\s*anti|corticotherapie|aphte|gottron|uveite|antiphospholipides|sapl|rodnan)\b/g
        ) || []).length;

      if (isHematoTarget && systemicScore >= 2 && hematoScore === 0) continue;
      if (isSystemicTarget && hematoScore >= 2 && systemicScore === 0) continue;
    }

    uniquePages.push(page);
  }

  return uniquePages.join("\n\n").trim();
}

export interface ParsedQuestionUnit {
  number: number;
  caseIndex: number; // 0 = QCM isolé, 1 = Cas clinique 1, 2 = Cas clinique 2...
  caseVignette: string;
  stemOnly: string;
  stemAndCase: string;
  fullRawBlock: string;
  format: EBFormat;
  isCasePart: boolean;
}

function detectQuestionFormat(rawBlock: string, inheritedSectionFormat: EBFormat | null): EBFormat {
  const head = rawBlock.slice(0, 180).toUpperCase();
  if (/\bGROUPAGE\b/.test(head)) return "GROUPAGE";
  if (/\bCENSURE\b/.test(head)) return "CENSURE";
  if (/\bJUMELAGE\b/.test(head)) return "JUMELAGE";
  if (/\bCOMPLEMENT_MULTIPLE\b|\bCOMPLEMENTS?\s+MULTIPLES?\b/.test(head)) return "COMPLEMENT_MULTIPLE";
  if (/\bQNS\b/.test(head)) return "QNS";
  if (/\bELECTION\b|\bÉLECTION\b/.test(head)) return "ELECTION";

  const norm = normalizeText(rawBlock);
  if (/\bparce que\b/.test(norm)) return "JUMELAGE";
  if (/(?:^|\n)\s*[1-5][.)]\s+\S+/.test(rawBlock)) return "GROUPAGE";
  if (
    /\b(censure|fausse|inexacte|incorrecte|erronee|sauf|n est pas|ne permet pas|ne fait pas|moins probable)\b/.test(
      norm
    )
  ) {
    return "CENSURE";
  }
  if (
    /\b(complement multiple|lesquelles|les propositions exactes|cochez les|cocher la ou les|deux des|deux parmi|choisir 3|citer les 2)\b/.test(
      norm
    )
  ) {
    return "COMPLEMENT_MULTIPLE";
  }

  if (inheritedSectionFormat) return inheritedSectionFormat;
  return "ELECTION";
}

function detectSectionFormatBanner(textBetweenQuestions: string): EBFormat | null {
  const norm = normalizeText(textBetweenQuestions);
  if (/\bgroupage\b|\ba\s*1\s*2\s*3\b|\breponses\s*groupees\b/.test(norm)) return "GROUPAGE";
  if (/\bcensure\b|\bchoisir la proposition incorrecte\b/.test(norm)) return "CENSURE";
  if (/\bjumelage\b|\bvrai\s*vrai avec relation\b/.test(norm)) return "JUMELAGE";
  if (/\bcomplements multiples\b|\bchoisir la les propositions correctes\b/.test(norm)) {
    return "COMPLEMENT_MULTIPLE";
  }
  if (/\bcochez la reponse juste\b|\belection\b/.test(norm)) return "ELECTION";
  return null;
}

export function parseExamQuestionsDetailed(
  rawText: string,
  subjectName = ""
): { questions: ParsedQuestionUnit[]; caseCount: number } {
  const sectionText = isolateSubjectSectionFromExamText(rawText, subjectName);
  if (!sectionText || sectionText.length < 30) {
    return { questions: [], caseCount: 0 };
  }

  const cleaned = sectionText
    .replace(/\[CORRECTION_MANUSCRITE_DETECTEE:[^\]]*\]/gi, "")
    .replace(/\[NOTE_DE_COURS_AJOUTEE_IGNOREE\][\s\S]*?(\n\n|$)/gi, "\n")
    .replace(/--- PAGE \d+ ---/g, "\n");

  const regex = /(?:^|\n)\s*(?:QCM\s*(\d{1,3})|Q(?:uestion)?\s*(\d{1,3})|(\d{1,3})\s*[.)-])\s+/gim;
  const matches: Array<{ index: number; num: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(cleaned)) !== null) {
    const num = parseInt(m[1] || m[2] || m[3], 10);
    // Vérifie qu'il s'agit bien d'un début de QCM et non d'une proposition numérotée 1. 2. 3. 4. 5. d'un Groupage
    const lineSnippet = cleaned.slice(m.index, m.index + 90).trim();
    const isExplicitQcm = /^QCM|^Question/i.test(lineSnippet);
    if (!isExplicitQcm && num >= 1 && num <= 5 && matches.length > 0) {
      const prevNum = matches[matches.length - 1].num;
      // Si la question précédente était QCM 6 et qu'on voit "1. Un hématome", c'est un item de groupage, pas QCM 1 !
      if (prevNum > num && !(prevNum >= 19 && num === 1)) {
        continue;
      }
    }
    if (num >= 1 && num <= 100) {
      matches.push({ index: m.index, num });
    }
  }

  const questions: ParsedQuestionUnit[] = [];
  let activeCaseIndex = 0;
  let activeCaseVignette = "";
  let inheritedSectionFormat: EBFormat | null = null;
  const distinctCases = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;
    const interText = i === 0 ? cleaned.slice(0, start) : cleaned.slice(matches[i - 1].index, start);

    // Mise à jour de la bannière de format de section éventuelle (Groupage, Censure, Jumelage...)
    const bannerFmt = detectSectionFormatBanner(interText);
    if (bannerFmt) inheritedSectionFormat = bannerFmt;

    // Détection d'un nouveau Cas Clinique avant la question
    const caseMatch = interText.match(/(?:cas\s+clinique|ca\s+clinique|dossier\s+clinique)\s*(\d*)/i);
    if (caseMatch && i === 0) {
      const caseStart = interText.search(/(?:cas\s+clinique|ca\s+clinique|dossier\s+clinique)/i);
      activeCaseIndex++;
      distinctCases.add(activeCaseIndex);
      activeCaseVignette = interText.slice(caseStart).trim();
    }

    const rawBlock = cleaned.slice(start, end).trim();

    // Vérifie si un nouveau Cas Clinique ou une nouvelle section de QCM isolés démarre à la fin de ce bloc
    const nextCasePos = rawBlock.search(
      /\n\s*(?:cas\s+clinique|ca\s+clinique|dossier\s+clinique|questions?\s+a\s+reponses?\s+groupees|questions?\s+a\s+choix\s+multiples)/i
    );
    const currentQuestionBlock = nextCasePos !== -1 ? rawBlock.slice(0, nextCasePos).trim() : rawBlock;
    const trailingContext = nextCasePos !== -1 ? rawBlock.slice(nextCasePos).trim() : "";

    // Séparation stricte de l'énoncé (stem) et des propositions (A-E / 1-5)
    const firstOptPos = currentQuestionBlock.search(/(?:^|\n)\s*(?:[A-Ea-e][.)-]|\(?[1-5][.)])\s+/m);
    const stemOnly =
      firstOptPos > 10 ? currentQuestionBlock.slice(0, firstOptPos).trim() : currentQuestionBlock;

    const format = detectQuestionFormat(currentQuestionBlock, inheritedSectionFormat);

    questions.push({
      number: matches[i].num,
      caseIndex: activeCaseIndex,
      caseVignette: activeCaseVignette,
      stemOnly,
      stemAndCase: activeCaseVignette ? `${activeCaseVignette}\n${stemOnly}` : stemOnly,
      fullRawBlock: currentQuestionBlock,
      format,
      isCasePart: activeCaseIndex > 0,
    });

    // Préparation du contexte pour la question suivante (i + 1)
    if (trailingContext) {
      const trailingBanner = detectSectionFormatBanner(trailingContext);
      if (trailingBanner) inheritedSectionFormat = trailingBanner;

      if (/questions?\s+a\s+reponses?\s+groupees|questions?\s+a\s+choix\s+multiples/i.test(trailingContext)) {
        // Fin des cas cliniques -> passage aux QCM indépendants
        activeCaseIndex = 0;
        activeCaseVignette = "";
      } else if (/(?:cas\s+clinique|ca\s+clinique|dossier\s+clinique)/i.test(trailingContext)) {
        activeCaseIndex++;
        distinctCases.add(activeCaseIndex);
        activeCaseVignette = trailingContext;
      }
    }
  }

  // Enrichissement mutuel des QCM appartenant au même Cas Clinique :
  // Si le QCM 1 d'un cas clinique nomme la pathologie dans sa question diagnostique et que le QCM 3 demande "Quel examen confirme ce diagnostic ?",
  // on consolide le contexte du Cas Clinique pour que QCM 3 hérite du sujet médical du Cas Clinique.
  const caseCombinedContext = new Map<number, string>();
  for (const q of questions) {
    if (q.caseIndex > 0) {
      const prev = caseCombinedContext.get(q.caseIndex) || q.caseVignette;
      // On ajoute l'énoncé de toutes les questions du même cas clinique
      caseCombinedContext.set(q.caseIndex, `${prev}\n${q.stemOnly}`);
    }
  }

  for (const q of questions) {
    if (q.caseIndex > 0 && caseCombinedContext.has(q.caseIndex)) {
      // Si la question courante introduit une complication transfusionnelle spécifique au sein d'un cas clinique (ex: cross-matching, incompatibilité ABO),
      // on met l'accent sur l'énoncé spécifique de cette question ; sinon on utilise le dossier complet du cas clinique.
      const normStemOnly = normalizeText(q.stemOnly);
      const isSpecificSwitch =
        /\b(cross matching|controle ultime|lit du malade|transfusion a debute|poche de sang|culot globulaire ab)\b/.test(
          normStemOnly
        );
      q.stemAndCase = isSpecificSwitch
        ? `${q.stemOnly}\n${q.caseVignette}`
        : `${q.stemOnly}\n${caseCombinedContext.get(q.caseIndex)}`;
    }
  }

  return { questions, caseCount: distinctCases.size };
}

// ----------------------------------------------------------------------------
// 5. ATTRIBUTION SÉMANTIQUE QCM PAR QCM AUX LEÇONS DE L'UTILISATEUR
// ----------------------------------------------------------------------------
function matchQuestionUnitToLesson(
  q: ParsedQuestionUnit,
  profiles: IndexedLessonProfile[]
): { lessonId: string | null; weak: boolean } {
  if (profiles.length === 0) return { lessonId: null, weak: false };

  const normPrimary = normalizeText(q.stemAndCase);
  const normStemOnly = normalizeText(q.stemOnly);
  const normFull = normalizeText(q.fullRawBlock);

  // Détection des clusters médicaux activés par l'énoncé / cas clinique
  const activatedClusters = new Map<string, number>();
  for (const cluster of MEDICAL_TOPIC_CLUSTERS) {
    let hits = 0;
    for (const marker of cluster.diagnosticMarkers) {
      const nm = normalizeText(marker);
      if (normStemOnly.includes(nm)) hits += 4;
      else if (normPrimary.includes(nm)) hits += 2.5;
      else if (
        // Si l'énoncé demande "Quel est le diagnostic ?" ou "Quelle est la maladie ?", on inspecte aussi les marqueurs
        /\b(diagnostic|maladie|affection|pathologie|etiologie|anomalie)\b/.test(normStemOnly) &&
        normFull.includes(nm)
      ) {
        hits += 1;
      }
    }
    if (hits > 0) {
      activatedClusters.set(cluster.id, hits);
    }
  }

  let bestId: string | null = null;
  let bestScore = 0;

  for (const prof of profiles) {
    let score = 0;

    // 1. Score par cluster médical (relie les signes cliniques/biologiques de l'énoncé au cours correspondant)
    for (const [clusterId, clusterHits] of activatedClusters.entries()) {
      const lessonClusterStrength = prof.clusterScores.get(clusterId) || 0;
      if (lessonClusterStrength > 0) {
        score += clusterHits * Math.min(12, lessonClusterStrength * 0.5);
      }
    }

    // 2. Correspondance directe des mots du titre de la leçon dans l'énoncé (stem + cas clinique)
    for (const tt of prof.titleTokens) {
      if (normStemOnly.includes(tt)) score += 14;
      else if (normPrimary.includes(tt)) score += 9;
    }

    // 3. Correspondance avec les sous-titres internes du cours
    for (const h of prof.normHeadings) {
      if (h.length >= 6 && normPrimary.includes(h)) score += 10;
    }

    // 4. Correspondance avec le vocabulaire spécifique du contenu intégral du cours
    const stemTokens = normPrimary.split(" ").filter((t) => t.length >= 5 && !STOPWORDS_FR.has(t));
    const uniqueStemTokens = Array.from(new Set(stemTokens));
    for (const st of uniqueStemTokens) {
      if (prof.keywordSet.has(st)) score += 2.5;
      else if (prof.normContent.includes(st)) score += 0.8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = prof.lesson.id;
    }
  }

  if (!bestId || bestScore < 2) {
    return { lessonId: profiles[0]?.lesson.id || null, weak: true };
  }
  return { lessonId: bestId, weak: bestScore < 8 };
}

// ----------------------------------------------------------------------------
// 6. SYNTHÈSE DOCIMOLOGIQUE & ANALYSE PROFONDE (runDeepAnalysis)
// ----------------------------------------------------------------------------
export function computeCorpusAnalysis(
  subjectName: string,
  rawLessons: EBLesson[],
  annales: EBAnnale[]
): CorpusAnalysis {
  const hydratedLessons = flagDuplicateLessons(rawLessons);
  const profiles = buildIndexedLessonProfiles(hydratedLessons, subjectName);
  const usableLessons = profiles.map((p) => p.lesson);

  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];

  for (const annale of annales) {
    const { questions, caseCount } = parseExamQuestionsDetailed(annale.rawText, subjectName);

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
        `« ${annale.title} » ne contient aucune question de « ${subjectName} » (épreuve d'une autre matière de l'UE non comptabilisée).`
      );
      continue;
    }

    const formatCounts: Partial<Record<EBFormat, number>> = {};
    const lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }> = {};
    let lastLessonId: string | null = null;

    for (const q of questions) {
      formatCounts[q.format] = (formatCounts[q.format] || 0) + 1;
      formatDistribution[q.format] = (formatDistribution[q.format] || 0) + 1;

      const { lessonId, weak } = matchQuestionUnitToLesson(q, profiles);
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

// Analyse profonde séquentielle : Indexation des 16 cours -> Lecture Épreuve par Épreuve -> Inspection QCM par QCM
export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI?: boolean;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, lessons, annales, onProgress, isCancelled } = params;

  // Étape A : Réhydratation et indexation sémantique à 100 % de tous les cours
  const hydratedLessons = flagDuplicateLessons(lessons);
  const profiles = buildIndexedLessonProfiles(hydratedLessons, subjectName);
  const usableLessons = profiles.map((p) => p.lesson);

  onProgress?.({
    phase: "lecture",
    message: `Indexation sémantique de ${usableLessons.length} cours de « ${subjectName} »…`,
    current: 0,
    total: Math.max(1, annales.length),
  });
  await new Promise((r) => setTimeout(r, 180));

  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];

  // Étape B : Inspection approfondie Épreuve par Épreuve, Cas Clinique par Cas Clinique, QCM par QCM
  for (let i = 0; i < annales.length; i++) {
    if (isCancelled?.()) break;
    const annale = annales[i];

    onProgress?.({
      phase: "audit",
      message: `Épreuve ${i + 1}/${annales.length} — Isolation de la matière « ${subjectName} » dans « ${annale.title} »…`,
      current: i,
      total: annales.length,
    });
    await new Promise((r) => setTimeout(r, 120));

    const { questions, caseCount } = parseExamQuestionsDetailed(annale.rawText, subjectName);

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
        `« ${annale.title} » ne contient aucune question relevant de « ${subjectName} » (épreuve d'une autre matière ignorée).`
      );
      continue;
    }

    const formatCounts: Partial<Record<EBFormat, number>> = {};
    const lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }> = {};
    let lastLessonId: string | null = null;

    // Inspection QCM par QCM à l'intérieur de l'épreuve
    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      if (isCancelled?.()) break;
      const q = questions[qIdx];

      formatCounts[q.format] = (formatCounts[q.format] || 0) + 1;
      formatDistribution[q.format] = (formatDistribution[q.format] || 0) + 1;

      const { lessonId, weak } = matchQuestionUnitToLesson(q, profiles);
      let matchedTitle = "Cours associé";

      if (lessonId) {
        const foundLesson = usableLessons.find((l) => l.id === lessonId);
        if (foundLesson) matchedTitle = foundLesson.cleanTitle;

        const prev = lessonQcmCounts[lessonId] || { blocks: 0, qcm: 0, weak: true };
        const isNewBlock = lessonId !== lastLessonId;
        lessonQcmCounts[lessonId] = {
          blocks: prev.blocks + (isNewBlock ? 1 : 0),
          qcm: prev.qcm + 1,
          weak: prev.weak && weak,
        };
        lastLessonId = lessonId;
      }

      // Mise à jour visuelle toutes les 4 questions pour afficher la progression granulaire QCM par QCM
      if (qIdx % 4 === 0 || qIdx === questions.length - 1) {
        onProgress?.({
          phase: "audit",
          message: `Épreuve ${i + 1}/${annales.length} (${annale.title}) · QCM ${qIdx + 1}/${questions.length} [${EB_FORMAT_LABELS[q.format]}] → ${matchedTitle}`,
          current: i,
          total: annales.length,
        });
        await new Promise((r) => setTimeout(r, 65));
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

  // Étape C : Calcul des probabilités de sortie et du quota moyen de leçons par examen
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

// ----------------------------------------------------------------------------
// 7. PERSISTANCE, SCORING & GÉNÉRATION D'EXAMEN BLANC
// ----------------------------------------------------------------------------
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

export function createSyntheticFallbackBlock(
  spec: BlueprintSpec,
  selectedLessons: EBLesson[],
  blockId: string,
  _style: ProfessorStyleProfile
): EBBlock {
  const rawLesson =
    selectedLessons.find((l) => spec.lessonIds.includes(l.id)) ||
    selectedLessons[0];
  const lesson = rawLesson ? ensureHydratedLesson(rawLesson) : null;

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

  const hydratedSelected = selected.map((l) => ensureHydratedLesson(l, subjectName));
  const systemPrompt = fillSystemPrompt(ueName, subjectName, analysis.quota);
  const activeFormats =
    analysis.style.preferredFormats.length > 0
      ? analysis.style.preferredFormats
      : (["ELECTION", "GROUPAGE", "CENSURE"] as EBFormat[]);

  let globalQuestionNumber = 1;
  const itemsPerLesson = Math.max(
    4,
    Math.round((analysis.maxQcm || 20) / Math.max(1, hydratedSelected.length))
  );

  for (let i = 0; i < hydratedSelected.length; i++) {
    if (isCancelled?.()) break;
    const lesson = hydratedSelected[i];

    onProgress?.({
      phase: "redaction",
      message: `Rédaction calibrée UCAD : « ${lesson.cleanTitle} » (${i + 1}/${hydratedSelected.length})…`,
      current: i,
      total: hydratedSelected.length,
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

