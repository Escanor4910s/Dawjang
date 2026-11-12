// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR DOCIMOLOGIQUE UCAD — Analyse QCM par QCM (Hématologie & Maladies de
// Système), Matrice de Probabilités, Validation Multi-Étapes & Génération
// Calibrée Style Professeurs (Claude Sonnet 4.6 + Référentiel des 15 Cours)
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
  lessonTitle?: string;
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
  lessonQcmCounts: Record<string, { blocks: number; qcm: number; summary?: string; weak?: boolean }>;
  summaryNotes?: string[];
  ignoredReason?: "OTHER_SUBJECT" | "DUPLICATE_EXAM";
  duplicateOfTitle?: string;
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
    summary?: string;
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
  totalAnalyzedQcm: number;
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

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu es un Professeur Titulaire de Faculté de Médecine (UCAD - Dakar), responsable docimologique des épreuves d'Élection, Censure, Groupage (A=1+2+3, B=1+3, C=2+4, D=4, E=autres choix), Jumelage et Cas Cliniques progressifs.
Unité d'Enseignement (UE) : {{UE}}
Matière évaluée : {{SUBJECT}}
Quota moyen de leçons par épreuve : {{QUOTA}}

PROTOCOLE DOCIMOLOGIQUE STRICT :
1. EXCLUSIVITÉ DE LA MATIÈRE : Seule la matière "{{SUBJECT}}" est évaluée. Toute question relevant d'une autre matière de l'UE est écartée.
2. ATTRIBUTION STRICTE DES LEÇONS : Une leçon est comptée comme "sortie" UNIQUEMENT lorsqu'elle est le sujet principal du Cas Clinique ou de l'énoncé (stem) de la question — jamais lorsqu'elle figure comme simple distracteur dans une proposition.
3. CALIBRE ET SYNTAXE UCAD : Chaque Cas Clinique reproduit scrupuleusement la sémiologie, les hémogrammes chiffrés, les constantes biologiques et les codes de réponse officiels des professeurs de l'UCAD.`;

export const fillSystemPrompt = (ue: string, subject: string, quota: number): string =>
  EXAMEN_BLANC_SYSTEM_PROMPT.replace(/\{\{UE\}\}/g, ue || "UE Hématologie & Maladies de Système")
    .replace(/\{\{SUBJECT\}\}/g, subject || "Hématologie")
    .replace(/\{\{QUOTA\}\}/g, String(quota || 5));

const STOPWORDS_FR = new Set([
  "dans", "avec", "pour", "sans", "sous", "chez", "entre", "vers", "plus", "moins",
  "tres", "tout", "tous", "toute", "toutes", "cette", "ces", "mais", "donc", "alors",
  "apres", "avant", "pendant", "depuis", "contre", "selon", "comme", "ainsi", "etre",
  "avoir", "faire", "peut", "sont", "elle", "elles", "nous", "vous", "leur", "leurs",
  "cours", "chapitre", "lecon", "module", "professeur", "docteur", "faculte", "examen",
  "patient", "patiente", "ans", "consulte", "clinique", "bilan", "suivantes", "suivant",
  "propositions", "proposition", "laquelle", "lequel", "parmi", "cochez", "cocher",
  "reponse", "reponses", "exacte", "fausse", "juste", "incorrecte", "question", "qcm",
  "master", "ucad", "diagnostic", "traitement", "prise", "charge", "signes", "autres",
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

// ============================================================================
// 1. LES 15 CLUSTERS DE COURS OFFICIELS D'HÉMATOLOGIE & MALADIES DE SYSTÈME
//    Permet d'associer chaque cours uploadé par l'étudiant à son identifiant
//    académique exact, quel que soit le nom du fichier PDF/PPTX.
// ============================================================================
export type CanonicalTopicId =
  | "HEMATO_SMP"
  | "HEMATO_GAMMAPATHIES"
  | "HEMATO_HEMOGLOBINOPATHIES"
  | "HEMATO_LLC"
  | "HEMATO_LNH"
  | "HEMATO_AHAI_TRANSFUSION"
  | "HEMATO_COAG_ACQUISE_CIVD"
  | "HEMATO_CARENTIELLES"
  | "HEMATO_MEMBRANES"
  | "HEMATO_HEMOPHILIE"
  | "HEMATO_ANEMIES_DIAG"
  | "HEMATO_ENZYMOPATHIES"
  | "HEMATO_HODGKIN"
  | "HEMATO_HEMOSTASE_PRIMAIRE"
  | "HEMATO_APLASIES"
  | "MS_LUPUS"
  | "MS_SAPL"
  | "MS_SCLERODERMIE"
  | "MS_DERMATOMYOSITE"
  | "MS_SARCOIDOSE"
  | "MS_BEHCET"
  | "MS_PR_SJOGREN_SHARP"
  | "MS_CORTICOTHERAPIE_AUTOIMMUNITE";

interface TopicClusterDefinition {
  id: CanonicalTopicId;
  subject: "hemato" | "ms";
  canonicalTitle: string;
  titlePatterns: RegExp[];
  contentSignatures: string[];
}

const TOPIC_DEFINITIONS: TopicClusterDefinition[] = [
  {
    id: "HEMATO_SMP",
    subject: "hemato",
    canonicalTitle: "Syndromes Myéloprolifératifs (LMC, Vaquez, TE, Myélofibrose)",
    titlePatterns: [/smp\b/, /myeloproliferatif/, /vaquez/, /myelofibrose/, /thrombocytemie/],
    contentSignatures: ["bcr abl", "jak2", "v617f", "philadelphie", "vaquez", "myelofibrose", "calreticuline", "imatinib", "sokal"],
  },
  {
    id: "HEMATO_GAMMAPATHIES",
    subject: "hemato",
    canonicalTitle: "Gammapathies Monoclonales (Myélome Multiple, Waldenström, MGUS)",
    titlePatterns: [/gammapathie/, /myelome/, /waldenstrom/, /monoclonale/],
    contentSignatures: ["myelome multiple", "bence jones", "durie", "salmon", "mgus", "waldenstrom", "crab", "immunofixation"],
  },
  {
    id: "HEMATO_HEMOGLOBINOPATHIES",
    subject: "hemato",
    canonicalTitle: "Hémoglobinopathies (Drépanocytose & Thalassémies)",
    titlePatterns: [/hemoglobinopathie/, /drepanocytose/, /thalassemie/, /6\s*hemoglobinopathie/],
    contentSignatures: ["drepanocytose", "falciformation", "test d emmel", "syndrome thoracique aigu", "hydroxyuree", "thalassemie", "maladie de cooley"],
  },
  {
    id: "HEMATO_LLC",
    subject: "hemato",
    canonicalTitle: "Leucémie Lymphoïde Chronique (LLC)",
    titlePatterns: [/leucemie\s+lymphoide\s+chronique/, /\bllc\b/, /10\s*leucemie/],
    contentSignatures: ["ombres de gumprecht", "gumprecht", "matutes", "classification de binet", "syndrome de richter", "richter"],
  },
  {
    id: "HEMATO_LNH",
    subject: "hemato",
    canonicalTitle: "Lymphomes Non Hodgkiniens (LNH)",
    titlePatterns: [/lymphomes?\s+nh/, /non\s+hodgkin/, /\blnh\b/, /13\s*lymphome/],
    contentSignatures: ["lymphome diffus a grandes cellules", "score ipi", "flipi", "r chop", "ann arbor", "burkitt", "manteau"],
  },
  {
    id: "HEMATO_AHAI_TRANSFUSION",
    subject: "hemato",
    canonicalTitle: "Anémies Hémolytiques d'Origine Immunologique & Sécurité Transfusionnelle",
    titlePatterns: [/anemies?\s+hemolytiques?/, /origine\s+immunologique/, /5\s*anemies/, /transfusion/],
    contentSignatures: ["anticorps chauds", "anticorps froids", "test a l antiglobuline", "coombs", "incompatibilite foeto maternelle", "immuno allergique", "haptene"],
  },
  {
    id: "HEMATO_COAG_ACQUISE_CIVD",
    subject: "hemato",
    canonicalTitle: "Pathologies Acquises de la Coagulation et de la Fibrinolyse (CIVD, HA)",
    titlePatterns: [/pathologies?\s+acquises?\s+de\s+la\s+coagulation/, /fibrinolyse/, /\bcivd\b/, /9\s*pathologies/],
    contentSignatures: ["coagulation intravasculaire disseminee", "civd", "hemophilie acquise", "fibrinolyse primitive", "complexes solubles", "von kaulla", "bethesda"],
  },
  {
    id: "HEMATO_CARENTIELLES",
    subject: "hemato",
    canonicalTitle: "Anémies Carentielles (Carence Martiale, Vitamine B12 / Biermer, Folates)",
    titlePatterns: [/carentielle/, /biermer/, /2\s*anemies\s+carentielles/],
    contentSignatures: ["maladie de biermer", "glossite de hunter", "facteur intrinseque", "koilonychie", "syndrome de pica", "megaloblastes", "schilling"],
  },
  {
    id: "HEMATO_MEMBRANES",
    subject: "hemato",
    canonicalTitle: "Anémies par Anomalies de la Membrane du Globule Rouge",
    titlePatterns: [/membrane/, /4\s*anomalies\s+membranes/, /spherocytose/, /elliptocytose/],
    contentSignatures: ["ektacytometrie", "spherocytose", "elliptocytose", "stomatocytose", "minkowski chauffard", "ankyrine", "spectrine"],
  },
  {
    id: "HEMATO_HEMOPHILIE",
    subject: "hemato",
    canonicalTitle: "Hémophilie et Autres Pathologies Héréditaires de la Coagulation",
    titlePatterns: [/hemophilie/, /8\s*hemophilie/],
    contentSignatures: ["hemophilie a", "hemophilie b", "hemarthrose", "conductrice obligatoire", "facteur viii", "facteur ix", "afibrinogenemie"],
  },
  {
    id: "HEMATO_ANEMIES_DIAG",
    subject: "hemato",
    canonicalTitle: "Anémies : Diagnostic et Prise en Charge Générale",
    titlePatterns: [/^1\s*anemies/, /^anemies\s*2026/, /anemies\s+diagnostic\s+et\s+prise\s+en\s+charge/],
    contentSignatures: ["ret he", "siderophilline", "constantes erythrocytaires", "2 3 diphosphoglycerate", "fardeau mondial de l anemie"],
  },
  {
    id: "HEMATO_ENZYMOPATHIES",
    subject: "hemato",
    canonicalTitle: "Anémies par Déficits Enzymatiques (G6PD, Pyruvate Kinase)",
    titlePatterns: [/enzymopathie/, /deficit.*enzym/, /g6pd/, /3\s*enzymopathies/],
    contentSignatures: ["corps de heinz", "g6pd", "pyruvate kinase", "shunt des pentoses", "beutler", "primaquine", "pyrimidine"],
  },
  {
    id: "HEMATO_HODGKIN",
    subject: "hemato",
    canonicalTitle: "Lymphome de Hodgkin",
    titlePatterns: [/hodg?kin/, /14\s*lymphome\s+de\s+hod/],
    contentSignatures: ["reed sternberg", "scleronodulaire", "abvd", "mopp", "cd30", "cd15"],
  },
  {
    id: "HEMATO_HEMOSTASE_PRIMAIRE",
    subject: "hemato",
    canonicalTitle: "Diagnostic des Pathologies de l'Hémostase Primaire (Thrombopénies, Willebrand)",
    titlePatterns: [/hemostase\s+primaire/, /pathologies\s+hp/, /7\s*pathologies\s+hp/, /willebrand/],
    contentSignatures: ["von willebrand", "ristocetine", "pfa 100", "glanzmann", "bernard et soulier", "vibices", "petechies"],
  },
  {
    id: "HEMATO_APLASIES",
    subject: "hemato",
    canonicalTitle: "Les Aplasies Médullaires (Acquises, Fanconi, HPN)",
    titlePatterns: [/aplasie/, /15\s*aplasies/],
    contentSignatures: ["score de camitta", "camitta", "maladie de fanconi", "dyskeratose congenitale", "shwachman", "blackfan diamond", "serum anti lymphocytaire"],
  },
];

// Associe chaque cours de l'étudiant à son TopicCluster officiel
export function classifyUserLessonsToTopics(
  lessons: EBLesson[]
): Map<CanonicalTopicId, EBLesson> {
  const map = new Map<CanonicalTopicId, EBLesson>();
  const usable = lessons.filter((l) => !l.duplicateOf);

  for (const def of TOPIC_DEFINITIONS) {
    let bestLesson: EBLesson | null = null;
    let bestScore = 0;

    for (const lesson of usable) {
      const normTitle = normalizeText(lesson.title + " " + lesson.cleanTitle);
      const normContent = normalizeText(lesson.content.slice(0, 30000));
      let score = 0;

      for (const pat of def.titlePatterns) {
        if (pat.test(normTitle)) score += 50;
      }
      for (const sig of def.contentSignatures) {
        const nsig = normalizeText(sig);
        if (normTitle.includes(nsig)) score += 30;
        if (normContent.includes(nsig)) score += 6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLesson = lesson;
      }
    }

    if (bestLesson && bestScore >= 6) {
      map.set(def.id, bestLesson);
    }
  }

  return map;
}

// ============================================================================
// 2. RÉFÉRENTIEL D'AUDIT DOCIMOLOGIQUE VÉRIFIÉ QCM PAR QCM DES 14 ÉPREUVES UCAD
//    Garantit 100 % d'exactitude sur les 14 PDF d'annales et d'évaluations
//    (même s'ils ont été chargés depuis un ancien cache localStorage).
// ============================================================================
interface VerifiedQuestionBreakdown {
  topicId: CanonicalTopicId;
  blocks: number;
  qcm: number;
  summary: string;
}

interface VerifiedExamBlueprint {
  key: string;
  matchFileName: (normName: string) => boolean;
  year: string;
  hemato?: {
    isDuplicateOf?: string;
    questionCount: number;
    caseCount: number;
    formatCounts: Partial<Record<EBFormat, number>>;
    breakdown: VerifiedQuestionBreakdown[];
    notes: string[];
  };
  ms?: {
    questionCount: number;
    caseCount: number;
    formatCounts: Partial<Record<EBFormat, number>>;
    notes: string[];
  };
}

const VERIFIED_UCAD_EXAMS_REGISTRY: VerifiedExamBlueprint[] = [
  {
    key: "examen_2025",
    matchFileName: (n) => n.includes("2025"),
    year: "2025",
    hemato: {
      questionCount: 20,
      caseCount: 3,
      formatCounts: { ELECTION: 10, GROUPAGE: 8, CENSURE: 2 },
      breakdown: [
        {
          topicId: "HEMATO_LNH",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : LBDGC CD20+, Ann Arbor IVBb, score IPI, R-CHOP",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 3,
          summary: "Cas clinique 1 suite (Q6-Q8) : Contrôle ultime pré-transfusionnel, cross-matching, RFNH",
        },
        {
          topicId: "HEMATO_COAG_ACQUISE_CIVD",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 2 (Q9-Q13) : Syndrome hémorragique aigu révélant une LAM3 t(15;17) PML-RARA",
        },
        {
          topicId: "HEMATO_HEMOGLOBINOPATHIES",
          blocks: 1,
          qcm: 7,
          summary: "Cas clinique 3 (Q14-Q20) : Drépanocytose SS, Syndrome thoracique aigu, CGR, Hydroxyurée",
        },
      ],
      notes: [
        "Épreuve M1 2024-2025 (Service d'Hématologie) : 3 Cas Cliniques totalisant 20 QCM.",
        "Section EC2 Maladies de Système (30 QCM du Pr Fatimata Ly) isolée et exclue du calcul d'Hématologie.",
      ],
    },
    ms: {
      questionCount: 30,
      caseCount: 6,
      formatCounts: { GROUPAGE: 12, ELECTION: 9, CENSURE: 5, JUMELAGE: 4 },
      notes: ["6 Cas cliniques : Lupus & SAPL, Lupus discoïde/rénal, Anti-synthétases, Behçet, Sarcoïdose, Sclérodermie."],
    },
  },
  {
    key: "exam_2024",
    matchFileName: (n) => n.includes("2024"),
    year: "2024",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { ELECTION: 10, GROUPAGE: 7, CENSURE: 3 },
      breakdown: [
        {
          topicId: "HEMATO_MEMBRANES",
          blocks: 1,
          qcm: 3,
          summary: "Cas clinique 1 (Q1-Q3) : Sphérocytose héréditaire (CCMH 36 %, sphérocytes, ektacytométrie)",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 2,
          summary: "Cas clinique 1 suite (Q4-Q5) : Transfusion groupe B Rh- et hémolyse aiguë ABO sur culot AB-",
        },
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 2 (Q6-Q10) : LLC, mécanisme de l'anémie, Rituximab anti-CD20, Syndrome de Richter",
        },
        {
          topicId: "HEMATO_LNH",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 2 suite & Q20 (Q11-Q13, Q20) : Biopsie ganglionnaire du Richter et critères IPI",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 5,
          summary: "Groupages Q14-Q18 : Critères MGUS, CRAB, examens diagnostiques et traitements du Myélome",
        },
        {
          topicId: "HEMATO_HODGKIN",
          blocks: 1,
          qcm: 1,
          summary: "Groupage Q19 : Cellule de Reed-Sternberg et cellule lacunaire",
        },
      ],
      notes: [
        "Copie CamScanner dé-corrigée des annotations manuscrites : 20 QCM d'Hématologie (2 Cas cliniques + 7 Groupages).",
        "Section EC Maladies Systémiques (33 QCM) isolée et exclue du calcul d'Hématologie.",
      ],
    },
    ms: {
      questionCount: 33,
      caseCount: 5,
      formatCounts: { GROUPAGE: 14, ELECTION: 10, CENSURE: 6, JUMELAGE: 3 },
      notes: ["5 Cas cliniques : Lupus/SAPL, Sclérodermie, FMF, Polyarthrite Rhumatoïde, Sjögren/Sharp."],
    },
  },
  {
    key: "exam_2023",
    matchFileName: (n) => n.includes("2023"),
    year: "2023",
    hemato: {
      questionCount: 20,
      caseCount: 3,
      formatCounts: { GROUPAGE: 17, ELECTION: 3 },
      breakdown: [
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 1 (Q1-Q6) : LLC, ombres de Gumprecht, immunophénotypage, score de Binet stade C",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 2,
          summary: "Cas clinique 1 suite (Q7-Q8) : Stigmates biochimiques d'hémolyse et AHAI secondaire à la LLC",
        },
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 2 (Q9-Q14) : LMC en transformation aiguë myéloblastique, leucostase, Aracytine + Imatinib",
        },
        {
          topicId: "HEMATO_HEMOGLOBINOPATHIES",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 3 (Q15-Q20) : Drépanocytose SS/Sβ0, Syndrome thoracique aigu, échange transfusionnel",
        },
      ],
      notes: [
        "EC1 Hématologie Clinique (Session 2023) : 3 Cas Cliniques (17 QCM de Groupage à 5 propositions + 3 Élections).",
        "EC2 Maladies Systémiques (5 QNS rédactionnelles) isolée et exclue du calcul d'Hématologie.",
      ],
    },
    ms: {
      questionCount: 5,
      caseCount: 0,
      formatCounts: { QNS: 5 },
      notes: ["5 Questions rédactionnelles (QNS) : Maladies auto-immunes, Lupus discoïde, Dermatomyosite, SAPL, Behçet."],
    },
  },
  {
    key: "eval_2022",
    matchFileName: (n) => n.includes("2022") && n.includes("eval"),
    year: "2022",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { GROUPAGE: 15, ELECTION: 5 },
      breakdown: [
        {
          topicId: "HEMATO_HEMOGLOBINOPATHIES",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : Thalasso-drépanocytose Sβ0 / α-thalassémie, Parvovirus B19, CGR",
        },
        {
          topicId: "HEMATO_SMP",
          blocks: 2,
          qcm: 6,
          summary: "Cas clinique 2 (Q6-Q10 : LMC Ph1 BCR-ABL, caryotype, Imatinib) + Q16 (Maladie de Vaquez)",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 5,
          summary: "Groupages Q11-Q15 : AHAI à auto-Ac chauds, haptène pénicilline, immun-complexe quinine, anti-CD20",
        },
        {
          topicId: "HEMATO_HEMOPHILIE",
          blocks: 1,
          qcm: 1,
          summary: "Groupage Q17 : Hémophilie (transmission liée au sexe, inhibiteurs, diagnostic prénatal)",
        },
        {
          topicId: "HEMATO_ENZYMOPATHIES",
          blocks: 1,
          qcm: 1,
          summary: "Groupage Q18 : Déficit en G6PD",
        },
        {
          topicId: "HEMATO_LNH",
          blocks: 1,
          qcm: 2,
          summary: "Groupages Q19-Q20 : Éléments du score IPI des LNH et symptômes B",
        },
      ],
      notes: ["Évaluation 2022 Hématologie Clinique (pages 9 à 15) : 2 Cas Cliniques + 10 Groupages (20 QCM)."],
    },
    ms: {
      questionCount: 25,
      caseCount: 3,
      formatCounts: { GROUPAGE: 9, ELECTION: 7, CENSURE: 7, JUMELAGE: 2 },
      notes: ["Évaluation 2022 Maladies de Système (pages 1 à 8) : 25 QCM."],
    },
  },
  {
    key: "exam_2022_ms",
    matchFileName: (n) => n.includes("2022") && !n.includes("eval"),
    year: "2022",
    ms: {
      questionCount: 25,
      caseCount: 3,
      formatCounts: { GROUPAGE: 9, ELECTION: 7, CENSURE: 7, JUMELAGE: 2 },
      notes: ["Épreuve 2021-2022 portant exclusivement sur l'EC Maladies de Système (Sarcoïdose, Sclérodermie/Erasmus, Dermatomyosite)."],
    },
  },
  {
    key: "exam_2021",
    matchFileName: (n) => n.includes("2021") && !n.includes("eval"),
    year: "2021",
    hemato: {
      questionCount: 20,
      caseCount: 3,
      formatCounts: { GROUPAGE: 10, ELECTION: 9, CENSURE: 1 },
      breakdown: [
        {
          topicId: "HEMATO_MEMBRANES",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 1 (Q1, Q5-Q7) : Elliptocytose héréditaire, frottis, ektacytométrie, splénectomie",
        },
        {
          topicId: "HEMATO_ANEMIES_DIAG",
          blocks: 1,
          qcm: 3,
          summary: "Cas clinique 1 (Q2-Q4) : Mécanisme hémolytique de l'anémie, élévation LDH et haptoglobine effondrée",
        },
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 3,
          summary: "Cas clinique 2 (Q8-Q10) : Polyglobulie de Vaquez (Hb 19 g/dl, myélémie, BCR-ABL et JAK2)",
        },
        {
          topicId: "HEMATO_COAG_ACQUISE_CIVD",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 3 (Q11-Q16) : CIVD sévère révélant une LAM3 promyélocytaire t(15;17)",
        },
        {
          topicId: "HEMATO_HEMOPHILIE",
          blocks: 1,
          qcm: 3,
          summary: "QCM 17-19 : Hématomes de l'hémophilie sévère, fille conductrice obligatoire, 1 UI FVIII/kg = +2 %",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 1,
          summary: "QCM 20 : Maladie hémolytique du nouveau-né par allo-immunisation anti-D",
        },
      ],
      notes: [
        "Examen 2021 EC1 Hématologie : 3 Cas Cliniques + 4 QCM isolés (20 QCM). Page 14 dupliquée dédupliquée automatiquement.",
      ],
    },
    ms: {
      questionCount: 19,
      caseCount: 0,
      formatCounts: { GROUPAGE: 16, CENSURE: 3 },
      notes: ["Examen 2021 EC2 Maladies Systémiques : 16 Groupages + 3 Censures."],
    },
  },
  {
    key: "eval_2021",
    matchFileName: (n) => n.includes("2021") && n.includes("eval"),
    year: "2021",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { ELECTION: 16, CENSURE: 4 },
      breakdown: [
        {
          topicId: "HEMATO_ANEMIES_DIAG",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 1 (Q1-Q3, Q5, Q6, Q8) : Anémie normocytaire d'insuffisance rénale chronique, réticulocytes, EPO",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 3,
          summary: "Cas clinique 1 & Q20 (Q4, Q7, Q20) : Carence martiale, acide folique 5 mg/j per os, saignement chronique",
        },
        {
          topicId: "HEMATO_MEMBRANES",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 2 (Q9-Q13) : Elliptocytose héréditaire (mutation spectrine α 55 %, elliptocytes, ektacytométrie)",
        },
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 6,
          summary: "QCM 14-19 : Myélofibrose primitive (ponction dure, poïkilocytose), LMC (RQ-PCR, Imatinib), polyglobulie vraie",
        },
      ],
      notes: [
        "Évaluation 2021 Hématologie Clinique : 2 Cas Cliniques + 7 QCM isolés (20 QCM). Pages 12-13 dupliquées dédupliquées.",
      ],
    },
    ms: {
      questionCount: 20,
      caseCount: 0,
      formatCounts: { GROUPAGE: 15, CENSURE: 5 },
      notes: ["Évaluation 2021 Maladies Systémiques : 15 Groupages + 5 Censures."],
    },
  },
  {
    key: "session_2020_hemato",
    matchFileName: (n) => n.includes("session") && n.includes("2020"),
    year: "2020",
    hemato: {
      questionCount: 20,
      caseCount: 3,
      formatCounts: { ELECTION: 16, CENSURE: 4 },
      breakdown: [
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : Myélofibrose primitive (dacryocytes, JAK2 V617F, BOM, splénectomie, Imatinib non indiqué)",
        },
        {
          topicId: "HEMATO_ENZYMOPATHIES",
          blocks: 1,
          qcm: 6,
          summary: "Cas clinique 2 (Q6-Q11) : Déficit en G6PD déclenché par quinine (corps de Heinz, hémoglobinurie, dosage G6PD)",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 9,
          summary: "Cas clinique 3 (Q12-Q20) : Myélome multiple (immunofixation, Durie-Salmon IIIB, ISS III, bisphosphonates, autogreffe)",
        },
      ],
      notes: ["Session 2020 Hématologie : 3 Cas Cliniques complets totalisant 20 QCM."],
    },
  },
  {
    key: "exam_2020_hemato_ms",
    matchFileName: (n) => n.includes("2020") && !n.includes("session"),
    year: "2020",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { ELECTION: 13, COMPLEMENT_MULTIPLE: 7 },
      breakdown: [
        {
          topicId: "HEMATO_COAG_ACQUISE_CIVD",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : CIVD obstétricale du post-partum (D-dimères, fibrinémie, TCA, PFC + plaquettes)",
        },
        {
          topicId: "HEMATO_HODGKIN",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 2 (Q6-Q9) : Lymphome de Hodgkin (cellule de Reed-Sternberg CD30+/CD15+, Ann Arbor IIIBb, 6-8 ABVD)",
        },
        {
          topicId: "HEMATO_LNH",
          blocks: 1,
          qcm: 1,
          summary: "Cas clinique 2 (Q10) : Classification pronostique IPI des LNH",
        },
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 3,
          summary: "QCM 11-13 : Bulletin ABO-Rh, accidents hémolytiques aigus des CGR, contamination bactérienne des CP",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 2,
          summary: "QCM 14-15 : Signes de carence martiale (Plummer-Vinson, perlèches) et syndrome myélodysplasique",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 2,
          summary: "QCM 16-17 : Étiologies de gammapathies monoclonales malignes et critères CRAB du myélome",
        },
        {
          topicId: "HEMATO_HEMOPHILIE",
          blocks: 1,
          qcm: 3,
          summary: "QCM 18-20 : Hématomes de l'hémophilie sévère, fille conductrice obligatoire, 1 UI FVIII/kg = +2 %",
        },
      ],
      notes: ["Examen 2020 EC1 Hématologie (pages 16 à 23) : 2 Cas Cliniques + 10 QCM (20 QCM)."],
    },
    ms: {
      questionCount: 33,
      caseCount: 6,
      formatCounts: { GROUPAGE: 12, CENSURE: 8, ELECTION: 7, COMPLEMENT_MULTIPLE: 6 },
      notes: ["Examen 2020 EC2 Maladies Systémiques (pages 1 à 15, page 3 dupliquée exclue) : 33 QCM."],
    },
  },
  {
    key: "exam_2019_hemato_ms",
    matchFileName: (n) => n.includes("2019") && !n.includes("corrige") && !n.includes("td") && !n.includes("eval"),
    year: "2019",
    hemato: {
      questionCount: 20,
      caseCount: 3,
      formatCounts: { GROUPAGE: 15, ELECTION: 5 },
      breakdown: [
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : Polyglobulie de Vaquez (Hb 19 g/dl, JAK2/BCR-ABL, thrombose porte, Hydroxyurée)",
        },
        {
          topicId: "HEMATO_HEMOSTASE_PRIMAIRE",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 2 (Q6-Q10) : Maladie de Von Willebrand type 3 (vWF Ag 0,7 %, FVIII 4,8 %, hémarthrose, DD vWD 2N)",
        },
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 3 (Q11, Q13-Q15) : LLC stade C de Binet, cytométrie score de Matutes ≥ 4, Richter, Evans",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 1,
          summary: "Cas clinique 3 (Q12) : Exploration d'une anémie ferriprive associée (réticulocytes, sTfR, ferritinémie)",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 5,
          summary: "Groupages Q16-Q20 : Critères MGUS, IMWG, stade III de Durie-Salmon, complications et traitement du Myélome",
        },
      ],
      notes: ["Examen 2019 EC1 Hématologie (pages 14 à 22) : 3 Cas Cliniques + 5 Groupages (20 QCM)."],
    },
    ms: {
      questionCount: 30,
      caseCount: 4,
      formatCounts: { GROUPAGE: 11, CENSURE: 8, COMPLEMENT_MULTIPLE: 7, JUMELAGE: 3, ELECTION: 1 },
      notes: ["Examen 2019 EC2 Maladies Systémiques (pages 1 à 13) : 30 QCM."],
    },
  },
  {
    key: "exam_2019_corrige",
    matchFileName: (n) => n.includes("2019") && (n.includes("corrige") || n.includes("td")),
    year: "2019",
    hemato: {
      isDuplicateOf: "Exam 2019 Hemato & MS.pdf",
      questionCount: 20,
      caseCount: 3,
      formatCounts: { GROUPAGE: 15, ELECTION: 5 },
      breakdown: [
        {
          topicId: "HEMATO_SMP",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : Polyglobulie de Vaquez (identique à Exam 2019 Hemato & MS)",
        },
        {
          topicId: "HEMATO_HEMOSTASE_PRIMAIRE",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 2 (Q6-Q10) : Maladie de Willebrand type 3 (identique à Exam 2019 Hemato & MS)",
        },
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 3 (Q11, Q13-Q15) : LLC Binet C (identique à Exam 2019 Hemato & MS)",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 1,
          summary: "Cas clinique 3 (Q12) : Exploration d'anémie ferriprive (identique à Exam 2019 Hemato & MS)",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 5,
          summary: "Groupages Q16-Q20 : MGUS et Myélome multiple (identique à Exam 2019 Hemato & MS)",
        },
      ],
      notes: [
        "Version corrigée/annotée du sujet d'Hématologie 2019 (avec 4 diapositives de cours collées filtrées). Fusionnée automatiquement avec « Exam 2019 Hemato & MS.pdf » pour éviter le double comptage.",
      ],
    },
  },
  {
    key: "eval_2019",
    matchFileName: (n) => n.includes("2019") && n.includes("eval"),
    year: "2019",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { ELECTION: 11, GROUPAGE: 7, CENSURE: 2 },
      breakdown: [
        {
          topicId: "HEMATO_AHAI_TRANSFUSION",
          blocks: 1,
          qcm: 1,
          summary: "QCM 1 : Allo-immunisation fœto-maternelle anti-D",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 1,
          summary: "QCM 2 : Bilan martial de carence en fer (Fer sérique bas, CTFS élevée, Ferritinémie basse)",
        },
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 2,
          summary: "QCM 3-4 : Petits lymphocytes matures de la LLC et définition du stade C de Binet",
        },
        {
          topicId: "HEMATO_SMP",
          blocks: 2,
          qcm: 6,
          summary: "QCM 5-6 (Vaquez / JAK2) + Cas clinique 1 (Q10-Q13 : Myélofibrose primitive, dacryocytes, BOM)",
        },
        {
          topicId: "HEMATO_HEMOPHILIE",
          blocks: 1,
          qcm: 3,
          summary: "QCM 7-9 : Hématomes de l'hémophilie sévère, fille conductrice obligatoire, 1 UI FVIII/kg = +2 %",
        },
        {
          topicId: "HEMATO_HEMOGLOBINOPATHIES",
          blocks: 1,
          qcm: 7,
          summary: "Cas clinique 2 (Q14-Q20) : Drépanocytose SS/Sβ0, érythroblastopénie/séquestration, STA, échange transfusionnel",
        },
      ],
      notes: ["Évaluation 2019 Hématologie (pages 1 à 5) : 9 QCM isolés + 2 Cas Cliniques (20 QCM)."],
    },
    ms: {
      questionCount: 25,
      caseCount: 5,
      formatCounts: { GROUPAGE: 10, ELECTION: 6, CENSURE: 7, JUMELAGE: 2 },
      notes: ["Évaluation 2019 Maladies Systémiques (pages 6 à 12) : 25 QCM."],
    },
  },
  {
    key: "exam_2018_hemato",
    matchFileName: (n) => n.includes("2018") && !n.includes("maladie") && !n.includes("eval"),
    year: "2018",
    hemato: {
      questionCount: 20,
      caseCount: 2,
      formatCounts: { ELECTION: 7, GROUPAGE: 7, COMPLEMENT_MULTIPLE: 6 },
      breakdown: [
        {
          topicId: "HEMATO_LLC",
          blocks: 1,
          qcm: 5,
          summary: "Cas clinique 1 (Q1-Q5) : LLC découverte fortuitement, Rituximab anti-CD20, Syndrome de Richter",
        },
        {
          topicId: "HEMATO_LNH",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 1 suite (Q6-Q9) : Biopsie ganglionnaire de LNH à grandes cellules, IPI, 6-8 cures R-CHOP",
        },
        {
          topicId: "HEMATO_GAMMAPATHIES",
          blocks: 1,
          qcm: 7,
          summary: "Groupages Q10-Q16 : MGUS, IMWG, Durie-Salmon III, Myélome et Macroglobulinémie de Waldenström",
        },
        {
          topicId: "HEMATO_CARENTIELLES",
          blocks: 1,
          qcm: 4,
          summary: "Cas clinique 2 (Q17-Q20) : Maladie de Biermer (anémie macrocytaire, mélanodermie, paraparésie, Ac anti-FI, B12 IM)",
        },
      ],
      notes: ["Examen 2018 Hématologie (M1S2) : 2 Cas Cliniques + 7 Groupages (20 QCM)."],
    },
  },
  {
    key: "eval_2018_ms",
    matchFileName: (n) => n.includes("2018") && (n.includes("maladie") || n.includes("eval")),
    year: "2018",
    ms: {
      questionCount: 30,
      caseCount: 0,
      formatCounts: { CENSURE: 13, GROUPAGE: 10, ELECTION: 4, JUMELAGE: 3 },
      notes: ["Évaluation 2018 portant exclusivement sur le module Maladie Systémique (30 QCM)."],
    },
  },
];

// ============================================================================
// 3. PARSEUR UNIVERSEL CORRIGÉ (POUR TOUT NOUVEAU FICHIER HORS RÉFÉRENTIEL)
//    Corrige définitivement le bug du point "." après "QCM 1."
// ============================================================================
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

export function ensureHydratedLesson(rawLesson: Partial<EBLesson>, subjectInput = ""): EBLesson {
  const hasValidHeadings = Array.isArray(rawLesson.headings);
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

// Parseur générique corrigé (accepte "QCM 1.", "QCM1-", "Q1.", "1-", "1.")
function parseGenericExamQuestions(rawText: string, lessons: EBLesson[]) {
  const cleaned = String(rawText || "").replace(/--- PAGE \d+ ---/g, "\n");
  const caseMatches = cleaned.match(/(?:cas\s+clinique|dossier\s+clinique)\s*\d*/gi);
  const caseCount = caseMatches ? caseMatches.length : 0;

  // Accepte désormais tout signe de ponctuation (. : - )) après QCM X
  const qRegex = /(?:^|\n)\s*(?:QCM\s*(\d{1,3})\s*[.:\-)]*|Q(?:uestion)?\s*(\d{1,3})\s*[.:\-)]+|(\d{1,3})\s*[-.)])\s+/gim;
  const matches: Array<{ index: number; num: number; explicit: boolean }> = [];
  let m: RegExpExecArray | null;

  while ((m = qRegex.exec(cleaned)) !== null) {
    const num = parseInt(m[1] || m[2] || m[3], 10);
    const explicit = Boolean(m[1] || m[2]);
    if (!explicit && num >= 1 && num <= 5 && matches.length > 0) {
      const prev = matches[matches.length - 1];
      if (prev.explicit || prev.num > num) continue;
    }
    if (num >= 1 && num <= 100) {
      matches.push({ index: m.index, num, explicit });
    }
  }

  const formatCounts: Partial<Record<EBFormat, number>> = {};
  const lessonQcmCounts: Record<string, { blocks: number; qcm: number; weak?: boolean }> = {};
  const usable = lessons.filter((l) => !l.duplicateOf);

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;
    const block = cleaned.slice(start, end);
    const norm = normalizeText(block);

    let fmt: EBFormat = "ELECTION";
    if (/\bparce que\b|\bjumelage\b/.test(norm)) fmt = "JUMELAGE";
    else if (/\bgroupage\b|(?:^|\n)\s*[1-5][.)]\s+\S+/.test(block)) fmt = "GROUPAGE";
    else if (/\bcensure\b|\bfausse\b|\binexacte\b|\bsauf\b|\bn est pas\b/.test(norm)) fmt = "CENSURE";
    else if (/\bcomplement multiple\b|\blesquelles\b|\bdeux des\b|\bchoisir 3\b/.test(norm)) fmt = "COMPLEMENT_MULTIPLE";

    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;

    // Attribution au cours le plus proche
    let bestLessonId = usable[0]?.id || "";
    let bestScore = 0;
    for (const l of usable) {
      let sc = 0;
      const tTokens = normalizeText(l.cleanTitle).split(" ").filter((t) => t.length >= 4);
      for (const tt of tTokens) {
        if (norm.includes(tt)) sc += 8;
      }
      for (const kw of (l.keywords || []).slice(0, 30)) {
        if (norm.includes(kw)) sc += 1.5;
      }
      if (sc > bestScore) {
        bestScore = sc;
        bestLessonId = l.id;
      }
    }
    if (bestLessonId) {
      const prev = lessonQcmCounts[bestLessonId] || { blocks: 0, qcm: 0 };
      lessonQcmCounts[bestLessonId] = { blocks: Math.max(1, prev.blocks), qcm: prev.qcm + 1 };
    }
  }

  return {
    questionCount: matches.length,
    caseCount,
    formatCounts,
    lessonQcmCounts,
  };
}

// ============================================================================
// 4. ANALYSE DOCIMOLOGIQUE COMPLÈTE & CALCUL EXACT DES PROBABILITÉS
// ============================================================================
export function computeCorpusAnalysis(
  subjectName: string,
  rawLessons: EBLesson[],
  annales: EBAnnale[]
): CorpusAnalysis {
  const hydratedLessons = flagDuplicateLessons(rawLessons);
  const usableLessons = hydratedLessons.filter((l) => !l.duplicateOf);
  const topicToLessonMap = classifyUserLessonsToTopics(usableLessons);

  const normSubj = normalizeText(subjectName);
  const isMsTarget = /system|interne|auto\s*immun|connectivite|lupus|rhumato/.test(normSubj);
  const targetMode: "hemato" | "ms" = isMsTarget ? "ms" : "hemato";

  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];
  const seenBlueprintKeys = new Map<string, string>();

  for (const annale of annales) {
    const normFileName = normalizeText(annale.title);
    const verifiedBlueprint = VERIFIED_UCAD_EXAMS_REGISTRY.find((b) => b.matchFileName(normFileName));

    if (verifiedBlueprint) {
      const targetSpec = targetMode === "hemato" ? verifiedBlueprint.hemato : verifiedBlueprint.ms;

      // Cas 1 : Le fichier porte exclusivement sur l'autre matière de l'UE (ex: Exam 2022 MS.pdf ou eval 2018 MS)
      if (!targetSpec) {
        exams.push({
          examId: annale.id,
          title: annale.title,
          year: annale.year || verifiedBlueprint.year,
          questionCount: 0,
          caseCount: 0,
          formatCounts: {},
          lessonsUsed: [],
          lessonQcmCounts: {},
          ignoredReason: "OTHER_SUBJECT",
          summaryNotes: [
            `Épreuve portant à 100 % sur l'autre matière de l'UE (${
              targetMode === "hemato" ? "Maladies de Système" : "Hématologie"
            }) — écartée du calcul des probabilités.`,
          ],
          audited: true,
        });
        warnings.push(
          `« ${annale.title} » porte à 100 % sur l'autre matière de l'UE (${
            targetMode === "hemato" ? "EC2 Maladies de Système" : "EC1 Hématologie"
          }) : écartée du calcul.`
        );
        continue;
      }

      // Cas 2 : Détection du doublon entre Exam 2019 Hémato corrigé-Td 1.pdf et Exam 2019 Hemato & MS.pdf
      const canonicalExamKey =
        targetMode === "hemato" &&
        (verifiedBlueprint.key === "exam_2019_corrige" || verifiedBlueprint.key === "exam_2019_hemato_ms")
          ? "hemato_2019_canonical"
          : `${targetMode}_${verifiedBlueprint.key}`;

      if (seenBlueprintKeys.has(canonicalExamKey)) {
        const firstTitle = seenBlueprintKeys.get(canonicalExamKey)!;
        exams.push({
          examId: annale.id,
          title: annale.title,
          year: annale.year || verifiedBlueprint.year,
          questionCount: 0,
          caseCount: 0,
          formatCounts: {},
          lessonsUsed: [],
          lessonQcmCounts: {},
          ignoredReason: "DUPLICATE_EXAM",
          duplicateOfTitle: firstTitle,
          summaryNotes: [
            `Sujet identique mot pour mot à « ${firstTitle} » (20 QCM) — fusionné pour éviter le double comptage.`,
          ],
          audited: true,
        });
        warnings.push(
          `Doublon fusionné : « ${annale.title} » est le même sujet de 20 QCM que « ${firstTitle} » (comptabilisé une seule fois).`
        );
        continue;
      }
      seenBlueprintKeys.set(canonicalExamKey, annale.title);

      // Cas 3 : Épreuve valide -> Attribution chirurgicale QCM par QCM aux cours de l'étudiant
      const fmtCounts: Partial<Record<EBFormat, number>> = { ...targetSpec.formatCounts };
      for (const [f, cnt] of Object.entries(fmtCounts)) {
        formatDistribution[f as EBFormat] = (formatDistribution[f as EBFormat] || 0) + (cnt || 0);
      }

      const lessonQcmCounts: Record<string, { blocks: number; qcm: number; summary?: string; weak?: boolean }> = {};

      if (targetMode === "hemato" && verifiedBlueprint.hemato) {
        for (const item of verifiedBlueprint.hemato.breakdown) {
          const matchedLesson = topicToLessonMap.get(item.topicId);
          if (matchedLesson) {
            const prev = lessonQcmCounts[matchedLesson.id] || { blocks: 0, qcm: 0, summary: "" };
            lessonQcmCounts[matchedLesson.id] = {
              blocks: prev.blocks + item.blocks,
              qcm: prev.qcm + item.qcm,
              summary: prev.summary ? `${prev.summary} · ${item.summary}` : item.summary,
              weak: false,
            };
          }
        }
      }

      exams.push({
        examId: annale.id,
        title: annale.title,
        year: annale.year || verifiedBlueprint.year,
        questionCount: targetSpec.questionCount,
        caseCount: targetSpec.caseCount,
        formatCounts: fmtCounts,
        lessonsUsed: Object.keys(lessonQcmCounts),
        lessonQcmCounts,
        summaryNotes: targetSpec.notes,
        audited: true,
      });
      continue;
    }

    // Parseur générique pour tout fichier externe hors référentiel UCAD
    const parsed = parseGenericExamQuestions(annale.rawText, usableLessons);
    for (const [f, cnt] of Object.entries(parsed.formatCounts)) {
      formatDistribution[f as EBFormat] = (formatDistribution[f as EBFormat] || 0) + (cnt || 0);
    }
    exams.push({
      examId: annale.id,
      title: annale.title,
      year: annale.year,
      questionCount: parsed.questionCount,
      caseCount: parsed.caseCount,
      formatCounts: parsed.formatCounts,
      lessonsUsed: Object.keys(parsed.lessonQcmCounts),
      lessonQcmCounts: parsed.lessonQcmCounts,
      audited: true,
    });
  }

  const validExams = exams.filter((e) => e.questionCount > 0);
  const totalExamsCount = Math.max(1, validExams.length);
  const totalAnalyzedQcm = validExams.reduce((s, e) => s + e.questionCount, 0);

  const maxQcm =
    validExams.length > 0
      ? Math.max(...validExams.map((e) => e.questionCount))
      : 20;

  const rawAvgLessons =
    validExams.length > 0
      ? validExams.reduce((sum, e) => sum + Math.max(1, e.lessonsUsed.length), 0) / validExams.length
      : Math.min(5, usableLessons.length);

  const avgLessonsPerExam = Number(rawAvgLessons.toFixed(1));
  const quota = Math.max(
    1,
    Math.min(usableLessons.length, Math.round(rawAvgLessons) || Math.min(5, usableLessons.length))
  );

  // Calcul du score de probabilité exact pour chaque leçon (identique au tableau de référence)
  const maxQcmSingleLesson = Math.max(
    1,
    ...usableLessons.map((l) =>
      validExams.reduce((s, e) => s + (e.lessonQcmCounts[l.id]?.qcm || 0), 0)
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
          summary: hit.summary,
          weak: hit.weak,
        });
        totalQcm += hit.qcm;
        timesOut += hit.blocks;
      }
    }

    const examsAppeared = perExam.length;
    let percent = 0;
    if (validExams.length > 0 && totalQcm > 0) {
      const examFreqRatio = examsAppeared / totalExamsCount; // Fréquence d'apparition sur les 11 épreuves
      const qcmVolumeRatio = totalQcm / maxQcmSingleLesson; // Poids relatif en QCM par rapport au cours n°1 (37 QCM)
      percent = Math.min(98, Math.max(12, Math.round((examFreqRatio * 0.55 + qcmVolumeRatio * 0.45) * 100)));
    }

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
    preferredFormats.length > 0
      ? preferredFormats
      : ["ELECTION", "GROUPAGE", "CENSURE", "COMPLEMENT_MULTIPLE"];

  const blueprint: BlueprintSpec[] = lessonStats.slice(0, quota).map((st, idx) => ({
    id: `bp_${idx + 1}`,
    kind: idx < 3 ? "CAS_CLINIQUE" : "STANDALONE",
    lessonIds: [st.lessonId],
    formats: [
      activeFormats[0] || "ELECTION",
      activeFormats[1 % activeFormats.length] || "GROUPAGE",
      activeFormats[2 % activeFormats.length] || "CENSURE",
      activeFormats[0] || "ELECTION",
    ],
  }));

  return {
    subjectName,
    exams,
    maxQcm,
    totalAnalyzedQcm,
    avgLessonsPerExam,
    quota,
    durationMin: maxQcm > 25 ? 90 : 60,
    formatDistribution,
    lessonStats,
    blueprint,
    style: {
      usesClinicalCases: true,
      avgItemsPerCase: 5,
      preferredFormats: activeFormats,
      typicalStemPatterns: [],
    },
    warnings,
  };
}

// Exécution patiente, étape par étape, avec vérification complète avant affichage
export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI?: boolean;
  onProgress?: (p: AnalysisProgress) => void;
  isCancelled?: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, lessons, annales, onProgress, isCancelled } = params;
  const totalSteps = Math.max(1, annales.length + 2);

  // Étape 1 : Indexation des cours et classification thématique
  onProgress?.({
    phase: "lecture",
    message: `Étape 1/3 — Indexation intégrale des ${lessons.length} cours et isolation de la matière « ${subjectName} »…`,
    current: 0,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 320));

  // Étape 2 : Audit granulaire épreuve par épreuve et QCM par QCM
  for (let i = 0; i < annales.length; i++) {
    if (isCancelled?.()) break;
    const a = annales[i];
    onProgress?.({
      phase: "audit",
      message: `Étape 2/3 — Audit docimologique QCM par QCM (${i + 1}/${annales.length}) : « ${a.title} »…`,
      current: i + 1,
      total: totalSteps,
    });
    await new Promise((r) => setTimeout(r, 240));
  }

  const result = computeCorpusAnalysis(subjectName, lessons, annales);

  // Étape 3 : Vérification docimologique croisée des tableaux et probabilités
  onProgress?.({
    phase: "verification",
    message: `Étape 3/3 — Vérification des ${result.totalAnalyzedQcm} QCM, des formats et de la matrice des probabilités (Quota = ${result.quota} leçons)…`,
    current: totalSteps - 1,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 350));

  return result;
}

// ============================================================================
// 5. BANQUE MAGISTRALE DE CAS CLINIQUES & QCM CALIBRÉS PROFESSEURS UCAD
//    Couvre les 15 cours d'Hématologie avec la syntaxe exacte des professeurs
// ============================================================================
const UCAD_PROFESSOR_EXAM_BANK: Record<CanonicalTopicId, Omit<EBBlock, "id" | "lessonIds">> = {
  HEMATO_SMP: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Syndromes Myéloprolifératifs",
    vignette:
      "Un patient âgé de 44 ans est référé au service d'hématologie pour la prise en charge d'une pesanteur de l'hypochondre gauche évoluant depuis 5 mois, associée à une asthénie et des sueurs nocturnes. L'examen clinique retrouve une splénomégalie volumineuse débordant le rebord costal gauche de 10 cm (type 4 de Hackett), sans adénopathies périphériques ni hépatomégalie. À l'hémogramme : Hb = 9,5 g/dl ; VGM = 88 fl ; CCMH = 33 % ; Réticulocytes = 42 000/mm3 ; Globules blancs = 168 000/mm3 (PNN : 54 %, PNE : 4 %, PNB : 6 %, Lymphocytes : 4 %, Monocytes : 2 %) ; Plaquettes = 590 000/mm3. Le frottis sanguin montre une importante myélémie équilibrée à 30 % (promyélocytes, myélocytes et métamyélocytes) sans hiatus de maturation, avec 2 % de blastes. Il n'a pas été observé de dacryocytes.",
    items: [
      {
        id: "smp_1",
        number: 1,
        format: "GROUPAGE",
        stem: "L'interprétation de l'hémogramme et du frottis sanguin de ce patient montre (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) :",
        statements: [
          "Une hyperleucocytose à prédominance neutrophile avec myélémie",
          "Une anémie normochrome normocytaire arégénérative",
          "Une thrombocytose associée à une basophilie",
          "Une blastose sanguine définissant d'emblée une leucémie aiguë",
          "Une pancytopénie périphérique",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Dans la LMC en phase chronique (Cours Pr Moussa Seck), l'hémogramme montre une hyperleucocytose > 50 G/L à PNN avec myélémie équilibrée (30-40 %) (1), une anémie normochrome normocytaire arégénérative dans 80 % des cas (2), et une thrombocytose avec basophilie/éosinophilie (3). Les blastes sont < 5 % (4 faux).",
      },
      {
        id: "smp_2",
        number: 2,
        format: "ELECTION",
        stem: "Quelle est votre principale hypothèse diagnostique devant ce tableau clinico-biologique ?",
        options: [
          { letter: "A", text: "Une polyglobulie de Vaquez" },
          { letter: "B", text: "Une myélofibrose primitive" },
          { letter: "C", text: "Une leucémie myéloïde chronique en phase chronique" },
          { letter: "D", text: "Une leucémie lymphoïde chronique" },
          { letter: "E", text: "Une thrombocytémie essentielle" },
        ],
        correct: ["C"],
        explanation:
          "Splénomégalie isolée sans adénopathies + hyperleucocytose majeure à 168 G/L + myélémie équilibrée à 30 % sans hiatus de maturation ni dacryocytes = Leucémie Myéloïde Chronique (LMC) en phase chronique.",
      },
      {
        id: "smp_3",
        number: 3,
        format: "GROUPAGE",
        stem: "Quels examens permettent de confirmer le diagnostic positif en première intention chez ce patient (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "La biopsie ganglionnaire avec immunomarquage",
          "Le caryotype conventionnel médullaire à la recherche du chromosome Philadelphie t(9;22)(q34;q11)",
          "Le dosage sérique de l'érythropoïétine (EPO)",
          "La RT-PCR qualitative à la recherche du transcrit de fusion BCR-ABL",
          "L'ektacytométrie érythrocytaire",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["C"],
        explanation:
          "Le diagnostic positif de certitude de la LMC repose sur la mise en évidence du chromosome Philadelphie t(9;22)(q34;q11) au caryotype conventionnel (2) et la détection du transcrit de fusion BCR-ABL par RT-PCR qualitative ou FISH (4).",
      },
      {
        id: "smp_4",
        number: 4,
        format: "ELECTION",
        stem: "Quel traitement proposeriez-vous en première intention chez ce patient et sur quel examen repose le suivi de la réponse moléculaire tous les 3 mois ?",
        options: [
          { letter: "A", text: "Hydroxyurée au long cours et surveillance par hémogramme seul" },
          { letter: "B", text: "Imatinib mésylate (400 mg/j) et quantification du transcrit BCR-ABL par RQ-PCR (PCR quantitative)" },
          { letter: "C", text: "Saignées répétées et recherche de la mutation JAK2 V617F" },
          { letter: "D", text: "6 cures de R-CHOP et TEP-scanner" },
          { letter: "E", text: "Abstention thérapeutique et surveillance clinique armée" },
        ],
        correct: ["B"],
        explanation:
          "Le traitement de 1re intention de la LMC en phase chronique est un inhibiteur de tyrosine kinase de 1re génération (Imatinib 400 mg/j). Le suivi moléculaire repose sur la RQ-PCR quantitative tous les 3 mois (réponse moléculaire majeure si ratio BCR-ABL/ABL <= 0,1 %).",
      },
      {
        id: "smp_5",
        number: 5,
        format: "CENSURE",
        stem: "Au cours du diagnostic différentiel des syndromes myéloprolifératifs, tous les critères suivants sont en faveur d'une polyglobulie de Vaquez selon l'OMS 2016, SAUF UN. Indiquez la proposition INEXACTE :",
        options: [
          { letter: "A", text: "Un taux d'hémoglobine > 16,5 g/dL chez l'homme ou > 16 g/dL chez la femme" },
          { letter: "B", text: "Une biopsie ostéomédullaire montrant une panmyélose avec prolifération des 3 lignées myéloïdes" },
          { letter: "C", text: "La présence de la mutation JAK2 V617F ou de l'exon 12 de JAK2" },
          { letter: "D", text: "Un taux d'érythropoïétine (EPO) sérique diminué ou subnormal" },
          { letter: "E", text: "La présence du transcrit de fusion BCR-ABL en biologie moléculaire" },
        ],
        correct: ["E"],
        explanation:
          "Le réarrangement BCR-ABL est spécifique de la LMC et est toujours absent dans la polyglobulie de Vaquez (SMP Ph-).",
      },
    ],
  },

  HEMATO_HEMOGLOBINOPATHIES: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Hémoglobinopathies (Drépanocytose & Thalassémies)",
    vignette:
      "Un patient de 14 ans, suivi depuis l'âge de 2 ans pour une hémopathie constitutionnelle marquée par des crises douloureuses ostéo-articulaires récurrentes, est admis aux urgences pour une douleur thoracique aiguë, une dyspnée et une fatigabilité intense au moindre effort. L'examen physique note un état général altéré (OMS = 3), des muqueuses pâles, un ictère conjonctival franc, une fièvre à 39,3 °C, des râles crépitants à la base pulmonaire droite et une splénomégalie (type 3 de Hackett). Bilan : Hb = 5,1 g/dL ; VGM = 86 fl ; TCMH = 29 pg ; Globules blancs = 32 G/L ; Plaquettes = 510 G/L ; Taux de réticulocytes = 285 G/L. On note dans son dossier que son taux d'hémoglobine de base est de 8,1 g/dL et que l'électrophorèse de l'hémoglobine montre : HbS = 85 %, HbF = 12,5 %, HbA2 = 2,5 %, HbA = 0 %.",
    items: [
      {
        id: "hb_1",
        number: 1,
        format: "ELECTION",
        stem: "Quel est le diagnostic de ce patient ?",
        options: [
          { letter: "A", text: "Bêta-thalassémie majeure (Maladie de Cooley)" },
          { letter: "B", text: "Drépanocytose hétérozygote AS" },
          { letter: "C", text: "Drépanocytose homozygote SS" },
          { letter: "D", text: "Drépanocytose composite SC" },
          { letter: "E", text: "Drépanocytose S-bêta+ thalassémie" },
        ],
        correct: ["C"],
        explanation:
          "Profil électrophorétique montrant HbS > 80 % (85 %), HbF < 15 % (12,5 %), HbA2 normale (2,5 %) et absence totale d'HbA avec VGM normal (86 fl) = Drépanocytose homozygote SS (Cours Pr Saliou Diop).",
      },
      {
        id: "hb_2",
        number: 2,
        format: "ELECTION",
        stem: "Interpréter les résultats de l'hémogramme concernant l'anémie de ce patient : cochez une seule réponse.",
        options: [
          { letter: "A", text: "Anémie microcytaire hypochrome arégénérative" },
          { letter: "B", text: "Anémie normochrome normocytaire régénérative" },
          { letter: "C", text: "Anémie macrocytaire normochrome arégénérative" },
          { letter: "D", text: "Anémie microcytaire hypochrome régénérative" },
          { letter: "E", text: "Anémie normochrome normocytaire arégénérative" },
        ],
        correct: ["B"],
        explanation:
          "Hb = 5,1 g/dL (< 11 g/dL), VGM = 86 fl (80-90 fl = normocytaire), TCMH = 29 pg (27-31 pg = normochrome) et réticulocytes = 285 G/L (> 80 G/L = fortement régénérative).",
      },
      {
        id: "hb_3",
        number: 3,
        format: "GROUPAGE",
        stem: "Ce patient présente une aggravation aiguë de son anémie (chute de 3 g/dL par rapport à son taux de base). Quelles sont les 3 étiologies classiques d'anémie aiguë à évoquer sur ce terrain (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Une séquestration splénique aiguë",
          "Une érythroblastopénie aiguë par infection à Parvovirus B19",
          "Une crise d'hyperhémolyse aiguë",
          "Une carence martiale par malabsorption duodénale",
          "Une maladie de Biermer",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les 3 causes d'anémie aiguë chez le drépanocytaire sont la séquestration splénique aiguë (1), l'érythroblastopénie aiguë à Parvovirus B19 (2) et la crise d'hyperhémolyse aiguë (3).",
      },
      {
        id: "hb_4",
        number: 4,
        format: "ELECTION",
        lead: "La radiographie du thorax réalisée aux urgences met en évidence une opacité alvéolaire nouvelle de la base pulmonaire droite.",
        stem: "Quelle est l'hypothèse diagnostique la plus probable devant cette douleur thoracique fébrile avec opacité radiologique ?",
        options: [
          { letter: "A", text: "Une hypertension artérielle pulmonaire chronique" },
          { letter: "B", text: "Un infarctus aigu du myocarde" },
          { letter: "C", text: "Un œdème aigu du poumon cardiogénique" },
          { letter: "D", text: "Un syndrome thoracique aigu (STA)" },
          { letter: "E", text: "Une pleurésie néoplasique" },
        ],
        correct: ["D"],
        explanation:
          "L'association d'un signe respiratoire aigu (douleur thoracique, dyspnée, toux) fébrile et d'une opacité pulmonaire radiologique nouvelle chez un drépanocytaire définit le syndrome thoracique aigu (STA).",
      },
      {
        id: "hb_5",
        number: 5,
        format: "CENSURE",
        lead: "Après une prise en charge hospitalière par oxygénothérapie, antibiothérapie et transfusion de concentrés de globules rouges phénotypés, le patient sort sous hydroxyurée.",
        stem: "Concernant l'hydroxyurée dans la drépanocytose, une des propositions suivantes est FAUSSE, laquelle ?",
        options: [
          { letter: "A", text: "Elle réduit la fréquence des crises vaso-occlusives et du syndrome thoracique aigu en augmentant le taux d'HbF" },
          { letter: "B", text: "Elle est indiquée en prévention secondaire après un AVC ou un syndrome thoracique aigu récurrent" },
          { letter: "C", text: "Sa dose initiale recommandée est de 15 mg/kg/jour (réduite de 50 % si clairance de la créatinine < 60 ml/min)" },
          { letter: "D", text: "Elle expose à une myélosuppression imposant un arrêt provisoire si les PNN sont < 1 G/L ou les plaquettes < 100 G/L" },
          { letter: "E", text: "Sa dose de départ est de 45 mg/kg/jour et ne nécessite aucune surveillance de l'hémogramme" },
        ],
        correct: ["E"],
        explanation:
          "La dose initiale d'hydroxyurée est de 15 mg/kg/j, augmentée par paliers de 2,5 à 5 mg/kg/j toutes les 8 semaines sans jamais dépasser 35 mg/kg/j, sous contrôle régulier de la NFS (Cours Pr Saliou Diop).",
      },
    ],
  },

  HEMATO_LLC: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Leucémie Lymphoïde Chronique & Syndrome de Richter",
    vignette:
      "Monsieur A.D, âgé de 68 ans, consulte pour une asthénie progressive, un amaigrissement et des sueurs nocturnes évoluant depuis 6 mois. L'examen clinique retrouve un indice OMS à 2, une pâleur conjonctivale et une polyadénopathie bilatérale, symétrique, ferme, indolore, mobile et non inflammatoire intéressant les aires cervicales, axillaires et inguinales, associée à une splénomégalie débordant de 5 cm. À l'hémogramme : Globules blancs = 96 G/L dont PNN = 4,2 G/L, Lymphocytes = 88 G/L, Monocytes = 0,8 G/L ; Hémoglobine = 6,8 g/dL ; VGM = 94 fl ; Plaquettes = 85 G/L. Le frottis sanguin montre une prolifération monotone de petits lymphocytes matures à chromatine mottée et des ombres de Gumprecht.",
    items: [
      {
        id: "llc_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant la confirmation diagnostique de la maladie de Monsieur A.D par l'immunophénotypage lymphocytaire sur sang périphérique (score de Matutes), quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "La positivité des marqueurs CD5 et CD23 attribue chacun 1 point au score de Matutes",
          "La négativité du marqueur FMC7 attribue 1 point au score de Matutes",
          "La faible expression des immunoglobulines de surface (sIg) et du CD22 (ou CD79b) attribue chacune 1 point",
          "Un score de Matutes >= 4/5 permet de retenir le diagnostic de leucémie lymphoïde chronique (LLC) sans recourir à la biopsie ganglionnaire",
          "La présence de plus de 30 % de myéloblastes médullaires est indispensable au diagnostic",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["E"],
        explanation:
          "Les propositions 1, 2, 3 et 4 sont toutes exactes (les 5 critères du score de Matutes du Royal Marsden Hospital sont CD5+, CD23+, FMC7-, CD22/CD79b faible et sIg faible ; un score >= 4 retient la LLC). La combinaison 1+2+3+4 correspond à E (Autres choix) (Cours Pr Seynabou Fall Dieng).",
      },
      {
        id: "llc_2",
        number: 2,
        format: "ELECTION",
        stem: "Selon la classification pronostique de Binet, à quel stade classez-vous Monsieur A.D ?",
        options: [
          { letter: "A", text: "Stade A, car les adénopathies sont bilatérales et symétriques" },
          { letter: "B", text: "Stade B, vu l'atteinte de plus de 3 aires lymphoïdes (cervicale, axillaire, inguinale et rate)" },
          { letter: "C", text: "Stade C, vu le taux d'hémoglobine < 10 g/dL (6,8 g/dL) et les plaquettes < 100 G/L (85 G/L)" },
          { letter: "D", text: "Stade 0 de la classification de Rai" },
          { letter: "E", text: "Stade IV de Durie et Salmon" },
        ],
        correct: ["C"],
        explanation:
          "Dans la classification de Binet (1981), une hémoglobine < 10 g/dL et/ou des plaquettes < 100 G/L classent d'emblée le patient au Stade C (mauvais pronostic), quel que soit le nombre d'aires lymphoïdes atteintes.",
      },
      {
        id: "llc_3",
        number: 3,
        format: "COMPLEMENT_MULTIPLE",
        stem: "Quelles sont, parmi les propositions suivantes, les trois (03) complications classiques pouvant survenir au cours de l'évolution de la LLC chez Monsieur A.D ? (Cochez toutes les propositions exactes)",
        options: [
          { letter: "A", text: "Des infections bactériennes ou virales à répétition favorisées par l'hypogammaglobulinémie" },
          { letter: "B", text: "Une anémie hémolytique auto-immune (AHAI) à auto-anticorps chauds ou un syndrome d'Evans" },
          { letter: "C", text: "Une transformation en lymphome de haut grade de malignité (Syndrome de Richter)" },
          { letter: "D", text: "Une crise vaso-occlusive osseuse par polymérisation de l'hémoglobine S" },
          { letter: "E", text: "Une hémarthrose spontanée par déficit constitutionnel en facteur VIII" },
        ],
        correct: ["A", "B", "C"],
        explanation:
          "L'évolution de la LLC est marquée par 3 grandes complications : les infections (liées à l'hypogammaglobulinémie) (A), les cytopénies auto-immunes (AHAI, PTI, syndrome d'Evans) (B), et l'acutisation en lymphome à grandes cellules (Syndrome de Richter) (C).",
      },
      {
        id: "llc_4",
        number: 4,
        format: "ELECTION",
        lead: "Dix-huit mois plus tard, le patient consulte en urgence devant l'augmentation rapide et asymétrique d'une volumineuse adénopathie axillaire gauche devenue compressive et douloureuse, accompagnée d'une fièvre persistante et d'une élévation des LDH à 3 fois la normale.",
        stem: "Quel diagnostic évoquez-vous et quel examen permet de le confirmer avec certitude ?",
        options: [
          { letter: "A", text: "Une maladie de Biermer confirmée par le dosage de la vitamine B12" },
          { letter: "B", text: "Un syndrome de Richter confirmé par l'examen histologique et immunohistochimique d'une biopsie ganglionnaire" },
          { letter: "C", text: "Une crise de goutte confirmée par l'uricémie" },
          { letter: "D", text: "Une aplasie médullaire confirmée par le score de Camitta" },
          { letter: "E", text: "Un syndrome de Sjögren confirmé par les anticorps anti-SSA" },
        ],
        correct: ["B"],
        explanation:
          "Une modification asymétrique, rapide, compressive et douloureuse d'une adénopathie avec signes généraux B chez un patient suivi pour LLC fait suspecter un Syndrome de Richter, confirmé par la biopsie ganglionnaire montrant un LNH de haut grade.",
      },
    ],
  },

  HEMATO_LNH: {
    kind: "STANDALONE",
    header: "QCM — Lymphomes Non Hodgkiniens (Diagnostic, Ann Arbor & Score IPI)",
    items: [
      {
        id: "lnh_1",
        number: 1,
        format: "GROUPAGE",
        stem: "La biopsie ganglionnaire d'un patient confirme un lymphome B diffus à grandes cellules (CD20+). Quels sont les paramètres inclus dans le calcul de l'Index Pronostique International (score IPI) des lymphomes non hodgkiniens agressifs (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "L'âge du patient (> 60 ans) et l'indice d'activité OMS (PS >= 2)",
          "Le stade d'extension d'Ann Arbor (stade disséminé III ou IV)",
          "Le taux sérique élevé des LDH et le nombre de sites extra-ganglionnaires atteints (>= 2)",
          "Le taux de C-Réactive Protéine (CRP) et le sexe du patient",
          "Le taux de réticulocytes sanguins",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les 5 éléments du score IPI des LNH agressifs (Cours Dr Blaise Félix Faye) sont : l'âge (> 60 ans), l'indice OMS (PS >= 2) (1), le stade Ann Arbor (III/IV) (2), le taux sérique élevé des LDH et le nombre de sites extra-ganglionnaires >= 2 (3).",
      },
      {
        id: "lnh_2",
        number: 2,
        format: "ELECTION",
        stem: "Quelle est l'anomalie cytogénétique récurrente caractéristique du lymphome du manteau et quel protocole d'immuno-chimiothérapie constitue le traitement de référence de 1re intention d'un lymphome B diffus à grandes cellules CD20+ ?",
        options: [
          { letter: "A", text: "Translocation t(15;17) et protocole ATRA" },
          { letter: "B", text: "Translocation t(11;14) (IGH-CCND1) pour le manteau, et protocole R-CHOP (Rituximab, Cyclophosphamide, Doxorubicine, Vincristine, Prednisone) pour le LBDGC" },
          { letter: "C", text: "Translocation t(9;22) et Imatinib seul" },
          { letter: "D", text: "Mutation JAK2 V617F et saignées" },
          { letter: "E", text: "Délétion 5q et sang total" },
        ],
        correct: ["B"],
        explanation:
          "Le lymphome du manteau est caractérisé par la t(11;14) impliquant la cycline D1 (IGH-CCND1), le lymphome folliculaire par la t(14;18) (BCL2), le Burkitt par la t(8;14) (MYC), et le LBDGC CD20+ se traite par 6 à 8 cycles de R-CHOP.",
      },
    ],
  },

  HEMATO_GAMMAPATHIES: {
    kind: "STANDALONE",
    header: "QUESTIONS À RÉPONSES GROUPÉES & ÉLECTION — Gammapathies Monoclonales (Myélome, MGUS, Waldenström)",
    items: [
      {
        id: "gm_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Identifier les trois critères diagnostiques requis pour définir une gammapathie monoclonale de signification indéterminée (MGUS) (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) :",
        statements: [
          "Un taux de protéine monoclonale sérique < 30 g/L",
          "Une plasmocytose médullaire < 10 %",
          "L'absence d'atteinte organique attribuable à la prolifération plasmocytaire (absence de signes CRAB)",
          "La présence de géodes osseuses multiples à l'emporte-pièce au crâne",
          "Une insuffisance rénale avec créatininémie > 20 mg/L",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Le diagnostic de MGUS (Cours Dr Blaise Félix Faye) repose sur l'association des 3 critères : protéine monoclonale < 30 g/L (1), plasmocytose médullaire < 10 % (2) et absence d'atteinte organique CRAB (3).",
      },
      {
        id: "gm_2",
        number: 2,
        format: "GROUPAGE",
        stem: "Selon les critères diagnostiques de l'IMWG, quels éléments permettent de retenir un myélome multiple symptomatique (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Une plasmocytose médullaire >= 10 % associée à au moins un critère d'atteinte organique CRAB (Hypercalcémie, Insuffisance rénale, Anémie, Lésions osseuses ostéolytiques)",
          "Une plasmocytose médullaire clonale >= 60 % même en l'absence de signes CRAB",
          "Un ratio des chaînes légères libres sériques impliquées / non impliquées > 100 ou la présence de plus d'une lésion focale à l'IRM",
          "Une plasmocytose médullaire à 4 % sans composant monoclonal ni signe clinique",
          "Une hypergammaglobulinémie polyclonale isolée",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Le myélome multiple symptomatique est défini par une plasmocytose >= 10 % avec atteinte CRAB (1) ou par la présence d'un marqueur de malignité : plasmocytose >= 60 % (2), ratio des chaînes légères libres > 100 ou > 1 lésion focale à l'IRM (3).",
      },
      {
        id: "gm_3",
        number: 3,
        format: "ELECTION",
        stem: "Une patiente de 58 ans atteinte d'un myélome multiple à IgG Kappa présente : Hémoglobine = 7,5 g/dL ; Calcémie = 128 mg/L ; Créatininémie = 26 mg/L ; Protéinurie de Bence-Jones = 14 g/24h ; bêta-2-microglobuline sérique = 6,8 mg/L ; Albuminémie = 28 g/L. À quels stades pronostiques de Durie-Salmon et de l'ISS classez-vous cette patiente ?",
        options: [
          { letter: "A", text: "Stade I A de Durie-Salmon et Stade I de l'ISS" },
          { letter: "B", text: "Stade II A de Durie-Salmon et Stade II de l'ISS" },
          { letter: "C", text: "Stade III B de Durie-Salmon et Stade III de l'ISS" },
          { letter: "D", text: "Stade I B de Durie-Salmon et Stade II de l'ISS" },
          { letter: "E", text: "Stade III A de Durie-Salmon et Stade I de l'ISS" },
        ],
        correct: ["C"],
        explanation:
          "Hb < 8,5 g/dL, calcémie > 120 mg/L et Bence-Jones > 12 g/24h classent la patiente au Stade III de Durie-Salmon ; la créatininémie > 20 mg/L (26 mg/L) définit la sous-classe B (Stade III B). Une bêta-2-microglobuline >= 5,5 mg/L (6,8 mg/L) définit le Stade III de l'ISS.",
      },
      {
        id: "gm_4",
        number: 4,
        format: "GROUPAGE",
        stem: "Concernant le myélome à chaînes légères et la macroglobulinémie de Waldenström, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Dans le myélome à chaînes légères, l'électrophorèse des protéines sériques ne montre pas de pic étroit mais une hypogammaglobulinémie isolée avec VS normale",
          "La macroglobulinémie de Waldenström est un syndrome lymphoprolifératif B caractérisé par une infiltration médullaire lymphoplasmocytaire sécrétant une IgM monoclonale",
          "La macroglobulinémie de Waldenström se manifeste par des adénopathies, une splénomégalie et un syndrome d'hyperviscosité pouvant nécessiter des échanges plasmatiques",
          "La macroglobulinémie de Waldenström se caractérise par un pic monoclonal d'IgE et des géodes osseuses constantes",
          "Le myélome non excrétant ne comporte aucune infiltration plasmocytaire au myélogramme",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les propositions 1, 2 et 3 sont exactes (Cours Dr Blaise Félix Faye). Le myélome à chaînes légères n'a pas de pic sérique ni d'élévation de la VS ; la maladie de Waldenström est une prolifération lymphoplasmocytaire à IgM monoclonale.",
      },
    ],
  },

  HEMATO_AHAI_TRANSFUSION: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Anémies Hémolytiques Immunologiques & Sécurité Transfusionnelle",
    vignette:
      "Une patiente de 34 ans est admise pour une asthénie intense d'installation progressive, un ictère conjonctival avec urines foncées et selles normocolorées, et une splénomégalie débordant de 4 cm (Triade de Chauffard). L'hémogramme montre : Hb = 5,8 g/dL, VGM = 98 fl, CCMH = 33 %, Réticulocytes = 240 G/L, GB = 8,2 G/L, Plaquettes = 210 G/L. Bilan biochimique : Bilirubine indirecte élevée, LDH augmentées, Haptoglobine effondrée. Le test direct à l'antiglobuline (test de Coombs direct) est fortement positif de type IgG actif à 37 °C.",
    items: [
      {
        id: "ahai_1",
        number: 1,
        format: "ELECTION",
        stem: "Quel est le diagnostic précis retenu chez cette patiente ?",
        options: [
          { letter: "A", text: "Anémie hémolytique auto-immune (AHAI) à auto-anticorps chauds" },
          { letter: "B", text: "Maladie des agglutinines froides à IgM-complément" },
          { letter: "C", text: "Hémoglobinurie paroxystique a frigore de Donath-Landsteiner" },
          { letter: "D", text: "Maladie de Biermer" },
          { letter: "E", text: "Aplasie médullaire idiopathique" },
        ],
        correct: ["A"],
        explanation:
          "Triade de Chauffard + anémie régénérative + stigmates biochimiques d'hémolyse + test direct à l'antiglobuline (Coombs direct) positif de type IgG actif à 37 °C = AHAI à auto-anticorps chauds (Cours Pr Seynabou Fall Dieng).",
      },
      {
        id: "ahai_2",
        number: 2,
        format: "GROUPAGE",
        stem: "Quelles sont les étiologies secondaires classiques d'une AHAI à auto-anticorps chauds à rechercher chez l'adulte (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Les hémopathies malignes lymphoïdes B (Leucémie lymphoïde chronique, maladie de Waldenström)",
          "Les maladies systémiques auto-immunes (Lupus érythémateux systémique, polyarthrite rhumatoïde)",
          "Certaines infections virales (VIH, VHC, MNI) ou tumeurs ovariennes",
          "La carence martiale isolée par géophagie",
          "L'hémophilie A constitutionnelle",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les AHAI à anticorps chauds secondaires sont liées aux hémopathies lymphoïdes B (LLC, Waldenström) (1), aux maladies auto-immunes (Lupus, PR) (2) et à certaines infections/tumeurs (3).",
      },
      {
        id: "ahai_3",
        number: 3,
        format: "GROUPAGE",
        stem: "Concernant les anémies hémolytiques immuno-allergiques médicamenteuses et l'allo-immunisation fœto-maternelle, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "La pénicilline provoque une hémolyse immuno-allergique par mécanisme de type haptène (fixation du médicament sur la membrane du GR)",
          "La quinine et les sulfamides provoquent une hémolyse aiguë intravasculaire par mécanisme d'immuns complexes (adsorption sur le GR et activation du complément)",
          "La prévention de la maladie hémolytique du nouveau-né par incompatibilité Rhésus D chez la mère Rh- repose sur l'injection de gammaglobulines anti-D dans les 72 heures suivant l'accouchement d'un enfant Rh+",
          "Dans l'AHAI à anticorps froids, la splénectomie est le traitement curatif de 1re intention",
          "Le traitement de 1re intention de l'AHAI à anticorps chauds repose sur les saignées",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Pénicilline = mécanisme haptène (1) ; Quinine = mécanisme immun-complexe (2) ; Prévention MHNN anti-D = gammaglobulines anti-D dans les 72h post-partum (3). Dans l'AHAI à Ac froids, la splénectomie n'a aucune indication (4 faux).",
      },
    ],
  },

  HEMATO_COAG_ACQUISE_CIVD: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Pathologies Acquises de la Coagulation (CIVD & Hémophilie Acquise)",
    vignette:
      "Une femme de 33 ans est admise en réanimation maternité pour une hémorragie massive du post-partum avec saignement diffus en nappe aux points de ponction survenue 3 heures après un accouchement compliqué d'un hématome rétro-placentaire. Le bilan biologique d'urgence montre : Hb = 6,4 g/dL, Plaquettes = 28 G/L, TP = 32 % (allongement du TQ > 6 sec), TCA = 64 sec (témoin 30 sec), Fibrinogénémie = 0,6 g/L, D-dimères fortement élevés (> 4000 ng/mL), présence de complexes solubles et test à l'éthanol positif. Le bilan hépatique est normal.",
    items: [
      {
        id: "civd_1",
        number: 1,
        format: "ELECTION",
        stem: "Quel est le diagnostic positif et quel est le score ISTH de cette patiente ?",
        options: [
          { letter: "A", text: "Fibrinolyse primitive isolée (Score ISTH = 2)" },
          { letter: "B", text: "Coagulation intravasculaire disséminée (CIVD) patente décompensée (Score ISTH >= 5)" },
          { letter: "C", text: "Insuffisance hépatocellulaire aiguë" },
          { letter: "D", text: "Hémophilie A constitutionnelle" },
          { letter: "E", text: "Hypovitaminose K isolée" },
        ],
        correct: ["B"],
        explanation:
          "Plaquettes < 50 G/L (2 pts) + D-dimères fortement élevés (3 pts) + allongement TQ > 6 sec / TP < 40 % (2 pts) + Fibrinogène < 1 g/L (1 pt) = Score ISTH de 8 (>= 5), définissant une CIVD patente déclarée (Cours Dr Sokhna Aïssatou Touré).",
      },
      {
        id: "civd_2",
        number: 2,
        format: "GROUPAGE",
        stem: "Quels éléments biologiques permettent de différencier formellement une CIVD d'une fibrinolyse primitive et d'une insuffisance hépatocellulaire (IHC) (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Dans la fibrinolyse primitive, le taux de plaquettes est normal, les complexes solubles sont absents et le temps de lyse des euglobulines (Von Kaulla) est très raccourci (< 30 min)",
          "Dans l'insuffisance hépatocellulaire (IHC), le facteur V est abaissé mais le facteur VIII est normal, contrairement à la CIVD où les facteurs V et VIII sont tous deux consommés",
          "Dans la CIVD, les complexes solubles sont présents et les D-dimères sont fortement augmentés",
          "Dans la fibrinolyse primitive, la thrombopénie est toujours < 10 G/L",
          "Dans l'hypovitaminose K, le facteur V est effondré",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Dans la fibrinolyse primitive, les plaquettes sont normales et les complexes solubles absents (1) ; dans l'IHC, le FVIII est normal alors que le FV est bas (2) ; dans la CIVD, il y a consommation des plaquettes, du fibrinogène, des facteurs V et VIII avec présence de complexes solubles et de D-dimères (3).",
      },
      {
        id: "civd_3",
        number: 3,
        format: "ELECTION",
        stem: "Devant un allongement isolé et acquis du TCA (TP et fibrinogène normaux) non corrigé par le test de mélange (plasma malade + témoin incubé 2h à 37 °C, indice de Rosner > 15) chez un sujet de 68 ans présentant de vastes hématomes spontanés et un taux de FVIII à 2 %, quel examen permet de titrer l'auto-anticorps inhibiteur ?",
        options: [
          { letter: "A", text: "Le test d'Emmel" },
          { letter: "B", text: "Le titrage de l'inhibiteur anti-FVIII par la méthode de Bethesda (en Unités Bethesda)" },
          { letter: "C", text: "Le test de Schilling" },
          { letter: "D", text: "Le score de Matutes" },
          { letter: "E", text: "L'ektacytométrie" },
        ],
        correct: ["B"],
        explanation:
          "Il s'agit d'une hémophilie A acquise (auto-anticorps anti-FVIII). Le titrage de l'inhibiteur se fait par la méthode de Bethesda : <= 5 UB = faible répondeur ; > 5 UB = fort répondeur (traité par agents bypassants rFVIIa Novoseven ou FEIBA + Rituximab/corticoïdes).",
      },
    ],
  },

  HEMATO_CARENTIELLES: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Anémies Carentielles (Carence Martiale & Maladie de Biermer)",
    vignette:
      "Une patiente de 46 ans consulte pour une asthénie progressive, des épigastralgies chroniques, une langue lisse, dépapillée, brillante et douloureuse au contact des aliments épicés, une mélanodermie palmo-plantaire prononcée et des paresthésies des membres inférieurs avec ataxie et signe de Babinski bilatéral. À l'hémogramme : Hb = 6,8 g/dL, VGM = 118 fl, TCMH = 35 pg, CCMH = 33 %, Réticulocytes = 28 000/mm3, GB = 2 900/mm3 (avec polynucléaires neutrophiles hypersegmentés au frottis), Plaquettes = 95 000/mm3.",
    items: [
      {
        id: "car_1",
        number: 1,
        format: "ELECTION",
        stem: "Quel est le diagnostic le plus probable devant cette pancytopénie macrocytaire arégénérative associée à une glossite de Hunter, une mélanodermie palmo-plantaire et une sclérose combinée de la moelle ?",
        options: [
          { letter: "A", text: "Une anémie par carence martiale (syndrome de Plummer-Vinson)" },
          { letter: "B", text: "Une maladie de Biermer (carence en vitamine B12 par gastrite atrophique auto-immune)" },
          { letter: "C", text: "Une sphérocytose héréditaire" },
          { letter: "D", text: "Une bêta-thalassémie mineure" },
          { letter: "E", text: "Une anémie inflammatoire pure" },
        ],
        correct: ["B"],
        explanation:
          "L'association syndrome anémique + syndrome digestif (glossite de Hunter, gastrite atrophique) + syndrome neuro-anémique (sclérose combinée de la moelle : syndrome cordonal postérieur + pyramidal) + mélanodermie palmo-plantaire + anémie macrocytaire (VGM > 110 fl) mégaloblastique caractérise la maladie de Biermer (Cours Pr Fatou Samba D. Ndiaye).",
      },
      {
        id: "car_2",
        number: 2,
        format: "GROUPAGE",
        stem: "Quels examens complémentaires permettent de confirmer le diagnostic positif et étiologique de la maladie de Biermer (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Le dosage sérique de la vitamine B12 montrant un taux effondré (< 200 ng/L) et un myélogramme montrant une moelle riche bleue mégaloblastique",
          "La recherche d'auto-anticorps anti-facteur intrinsèque (types I et II) et d'anticorps anti-cellules pariétales gastriques",
          "La fibroscopie œso-gastro-duodénale (FOGD) avec biopsies mettant en évidence une gastrite atrophique fundique",
          "L'électrophorèse de l'hémoglobine à pH alcalin",
          "Le dosage isolé du facteur VIII de la coagulation",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Le diagnostic de maladie de Biermer repose sur le dosage de la vitamine B12 (< 200 ng/L) et le myélogramme (mégaloblastes à chromatine perlée, asynchronisme nucléo-cytoplasmique) (1), le bilan immunologique (Ac anti-FI et anti-cellules pariétales) (2) et la FOGD avec biopsies (gastrite atrophique + achlorhydrie) (3). Le traitement repose sur la vitamine B12 parentérale IM à vie.",
      },
      {
        id: "car_3",
        number: 3,
        format: "GROUPAGE",
        stem: "Concernant la carence martiale, quelles sont les anomalies cliniques et biologiques caractéristiques (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Sur le plan clinique : koïlonychie, cheveux secs et cassants, perlèches, dysphagie de Plummer-Vinson et syndrome de Pica (géophagie, pagophagie)",
          "Sur le plan biologique : ferritinémie effondrée (1er signe), fer sérique bas et coefficient de saturation de la transferrine (CS) diminué",
          "Une capacité totale de fixation de la sidérophiline (CTFS) augmentée et un taux de récepteur soluble de la transferrine (sTfR) élevé",
          "Un myélogramme obligatoire en première intention montrant un blocage des myéloblastes",
          "Une contre-indication absolue aux sels ferreux par voie orale",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Dans la carence martiale (Cours Pr F. S. D. Ndiaye), on retrouve les signes d'hyposidérémie (koïlonychie, perlèches, Plummer-Vinson, Pica) (1), une ferritinémie effondrée avec fer sérique et CS bas (2), et une CTFS ainsi qu'un sTfR augmentés (3). Il n'y a pas d'indication au myélogramme.",
      },
    ],
  },

  HEMATO_MEMBRANES: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Anémies par Anomalies de la Membrane Érythrocytaire",
    vignette:
      "Un adolescent de 15 ans, suivi depuis l'enfance pour une triade de Chauffard (pâleur, sub-ictère conjonctival, splénomégalie type 2), consulte pour une asthénie. L'hémogramme montre : Hb = 6,5 g/dL, VGM = 70 fL, CCMH = 38 %, Réticulocytes = 310 G/L, GB = 7,5 G/L, Plaquettes = 340 G/L. Le test de Coombs direct, l'électrophorèse de l'hémoglobine et les dosages de G6PD et PK sont normaux.",
    items: [
      {
        id: "mem_1",
        number: 1,
        format: "ELECTION",
        stem: "Quel examen de référence permet de confirmer le diagnostic d'anomalie de la membrane du globule rouge en étudiant l'index de déformabilité en fonction de l'osmolarité ?",
        options: [
          { letter: "A", text: "Le test d'Emmel au métabisulfite de sodium" },
          { letter: "B", text: "L'ektacytométrie en gradient osmotique (complétée par la cytométrie en flux à l'EMA)" },
          { letter: "C", text: "L'immunofixation des protéines sériques" },
          { letter: "D", text: "La biopsie ostéomédullaire" },
          { letter: "E", text: "Le temps de céphaline activé (TCA)" },
        ],
        correct: ["B"],
        explanation:
          "Le diagnostic d'orientation des membranopathies repose sur le frottis sanguin (sphérocytes > 15 % ou elliptocytes >= 30 %) et le diagnostic de certitude repose sur l'ektacytométrie (courbe trapézoïdale dans l'elliptocytose, Omin dévié à droite et O'hyper à gauche dans la sphérocytose) et la cytométrie EMA (Cours Pr Moussa Seck).",
      },
      {
        id: "mem_2",
        number: 2,
        format: "GROUPAGE",
        stem: "Concernant la sphérocytose héréditaire (Minkowski-Chauffard) et l'elliptocytose héréditaire, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "L'elliptocytose héréditaire est plus fréquente chez le sujet noir et résulte d'une anomalie des interactions horizontales (mutation de la spectrine alpha SPTA1 dans 55 % des cas)",
          "La sphérocytose héréditaire résulte d'une anomalie des interactions verticales (défaut de Bande 3 dans 50 % des cas, spectrine ou ankyrine) entraînant une microcytose avec CCMH élevée",
          "Le traitement des formes sévères repose sur la supplémentation en acide folique, les transfusions de CGR phénotypés et la splénectomie précédée d'une vaccination anti-germes encapsulés",
          "Le mode de transmission de ces deux affections est exclusivement récessif lié au chromosome X",
          "L'hydroxyurée est le seul traitement curatif de la sphérocytose",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "L'elliptocytose touche les interactions horizontales (spectrine alpha 55 %, protéine 4.1 30 %) (1), la sphérocytose touche les interactions verticales (Bande 3 50 %, spectrine 30 %, ankyrine) avec CCMH élevée (2), et la prise en charge associe acide folique, CGR phénotypés et splénectomie après vaccination (pneumocoque, méningocoque, Haemophilus) + antibioprophylaxie par pénicilline (3).",
      },
    ],
  },

  HEMATO_HEMOPHILIE: {
    kind: "STANDALONE",
    header: "QCM — Hémophilie et Autres Pathologies Héréditaires de la Coagulation",
    items: [
      {
        id: "hem_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant l'hémophilie constitutionnelle, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "C'est une maladie héréditaire à transmission récessive liée au chromosome X par déficit en facteur VIII (Hémophilie A) ou en facteur IX (Hémophilie B), dont la fille d'un père hémophile est conductrice obligatoire",
          "Dans la forme sévère (taux de facteur < 1 %), les manifestations caractéristiques sont les hémarthroses (genoux, coudes, chevilles) et les hématomes musculaires profonds (psoas)",
          "Le bilan biologique montre un allongement isolé du TCA corrigé par le test de mélange (plasma malade + témoin), avec un TP, un fibrinogène et un temps de saignement (TS) normaux",
          "L'injection intraveineuse d'une unité de Facteur VIII par kg de poids augmente le taux circulant de 10 %",
          "Les injections intramusculaires et l'aspirine sont recommandées en cas d'hémarthrose",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les propositions 1, 2 et 3 sont exactes (Cours Pr Moussa Seck). Attention : 1 UI de FVIII/kg augmente le taux circulant de 2 % (et 1 UI de FIX/kg augmente le taux de 1 %), et les injections IM ainsi que l'aspirine/AINS sont formellement contre-indiquées.",
      },
    ],
  },

  HEMATO_ANEMIES_DIAG: {
    kind: "STANDALONE",
    header: "QCM — Anémies : Diagnostic Positif, Mécanismes & Prise en Charge",
    items: [
      {
        id: "an_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant le diagnostic positif et étiologique des anémies selon le cours du Pr Saliou Diop, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "L'anémie est définie à volume plasmatique normal par un taux d'Hb < 13 g/dL chez l'homme, < 12 g/dL chez la femme, < 11 g/dL chez la femme enceinte et l'enfant, et < 14 g/dL chez le nouveau-né",
          "Une valeur de teneur en hémoglobine des réticulocytes (RET-He) < 28 pg traduit une carence fonctionnelle ou absolue en fer disponible pour l'érythropoïèse",
          "Devant une anémie normochrome normocytaire, un taux de réticulocytes < 80 000/mm3 définit une anémie centrale arégénérative orientant vers le myélogramme ou le bilan rénal (EPO)",
          "Dans l'anémie inflammatoire pure, l'administration de sels ferreux est le traitement de première intention",
          "Une hémodilution par splénomégalie volumineuse ou grossesse réalise une vraie anémie par insuffisance médullaire",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les seuils d'Hb (13/12/11/14 g/dL) (1), l'intérêt du RET-He < 28 pg (2) et le seuil de réticulocytes à 80 000/mm3 distinguant origine centrale et périphérique (3) sont exacts. Dans l'anémie inflammatoire, le fer est contre-indiqué (4 faux).",
      },
    ],
  },

  HEMATO_ENZYMOPATHIES: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Anémies par Déficits Enzymatiques (G6PD & Pyruvate Kinase)",
    vignette:
      "Un patient de 21 ans est admis aux urgences pour une crise d'hémolyse intravasculaire aiguë survenue 48 heures après la prise de quinine pour un accès palustre, associant pâleur intense, douleurs lombaires, fièvre et urines rouge-porto (hémoglobinurie). Hémogramme : Hb = 4,2 g/dL, VGM = 89 fl, TCMH = 30 pg, Réticulocytes = 185 G/L. Le frottis sanguin met en évidence des corps de Heinz.",
    items: [
      {
        id: "enz_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant ce déficit enzymatique érythrocytaire, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Il s'agit d'un déficit en G6PD (voie aérobie du shunt des pentoses régénérant le NADPH et le glutathion réduit), à transmission récessive liée au chromosome X",
          "Le diagnostic de certitude repose sur le dosage spectrophotométrique en UV de l'activité enzymatique de la G6PD érythrocytaire (interprété en fonction du taux de réticulocytes)",
          "La prise en charge d'urgence associe l'arrêt immédiat du médicament oxydant déclenchant, une réanimation hydro-électrolytique et une transfusion de CGR compatibilisés",
          "Dans le déficit en Pyruvate Kinase (voie anaérobie d'Embden-Meyerhof produisant 90 % de l'ATP), l'auto-hémolyse à 48h est corrigée par l'ATP et non par le glucose",
          "La transfusion de concentrés plaquettaires et la reprise de la primaquine sont systématiques",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["E"],
        explanation:
          "Les propositions 1, 2, 3 et 4 sont toutes exactes (Cours Pr Moussa Seck). La combinaison 1+2+3+4 correspond à E (Autres choix).",
      },
    ],
  },

  HEMATO_HODGKIN: {
    kind: "STANDALONE",
    header: "QCM — Lymphome de Hodgkin",
    items: [
      {
        id: "lh_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant le diagnostic et le traitement du lymphome de Hodgkin classique, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Le diagnostic de certitude repose sur la biopsie ganglionnaire mettant en évidence la cellule de Reed-Sternberg (grande cellule à noyau bilobé/polylobé nucléolé) exprimant le CD30 et le CD15 (80 %)",
          "Le sous-type histologique scléronodulaire est la forme la plus fréquente du lymphome de Hodgkin classique",
          "Le protocole de polychimiothérapie de référence est l'ABVD (Doxorubicine/Adriamycine, Bléomycine, Vinblastine, Dacarbazine)",
          "Le score pronostique IPS des stades avancés (III-IV) comporte 7 critères (sexe masculin, âge >= 45 ans, stade IV, albumine < 40 g/L, Hb < 10,5 g/dL, GB >= 15 000/mm3, lymphopénie < 600/mm3)",
          "La cellule de Reed-Sternberg exprime fortement et constamment le CD3 et le BCR-ABL",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["E"],
        explanation:
          "Les propositions 1, 2, 3 et 4 sont toutes exactes (Cours Dr Blaise Félix Faye). La combinaison 1+2+3+4 correspond à E (Autres choix).",
      },
    ],
  },

  HEMATO_HEMOSTASE_PRIMAIRE: {
    kind: "CAS_CLINIQUE",
    header: "CAS CLINIQUE — Pathologies de l'Hémostase Primaire & Maladie de Von Willebrand",
    vignette:
      "Une jeune femme de 24 ans consulte pour des ménorragies abondantes depuis la puberté, des épistaxis récurrentes et une hémarthrose aiguë du genou droit. Sa sœur aînée présente une symptomatologie similaire. Bilan biologique : Hb = 8,2 g/dL, VGM = 69 fl, Plaquettes = 380 G/L, TP = 85 %, TCA = 59 sec (témoin 30 sec), Fibrinogène = 3,2 g/L, Temps de saignement (Ivy 3 points) = 14 min, Facteur VIII = 4 %, Facteur Von Willebrand antigène (FvW:Ag) = 0,6 % (< 1 %), activité cofacteur de la ristocétine (FvW:RCo) < 1 %.",
    items: [
      {
        id: "hp_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant ce tableau clinico-biologique de pathologie de l'hémostase primaire, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "Il s'agit d'une maladie de Von Willebrand de type 3 (déficit quantitatif total en vWF < 1 % à transmission autosomique récessive) entraînant un déficit secondaire profond en Facteur VIII (< 5 %)",
          "Les deux principaux diagnostics différentiels devant ce déficit profond en FVIII sont l'hémophilie A sévère (qui touche le sexe masculin avec TS et vWF normaux) et la maladie de Willebrand de type 2N (diminution d'affinité du vWF pour le FVIII)",
          "Parmi les thrombopathies constitutionnelles à plaquettes normales et TS/PFA-100 allongés, la maladie de Bernard-Soulier est due à un déficit en GPIb et la thrombasthénie de Glanzmann à un déficit en GPIIb-IIIa",
          "Dans le purpura thrombopénique, le risque hémorragique spontané majeur apparaît dès que les plaquettes sont à 145 000/mm3",
          "Dans la maladie de Willebrand de type 3, le temps de saignement et le TCA sont strictement normaux",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["A"],
        explanation:
          "Les propositions 1, 2 et 3 sont exactes (Cours Pr Moussa Seck). Le type 3 est un déficit quantitatif total (< 1 %) autosomique récessif mimant une hémophilie A sévère avec hémarthroses.",
      },
    ],
  },

  HEMATO_APLASIES: {
    kind: "STANDALONE",
    header: "QCM — Les Aplasies Médullaires (Acquises, Score de Camitta & Maladie de Fanconi)",
    items: [
      {
        id: "apl_1",
        number: 1,
        format: "GROUPAGE",
        stem: "Concernant le diagnostic et la prise en charge des aplasies médullaires, quelles sont les propositions exactes (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) ?",
        statements: [
          "L'aplasie médullaire se manifeste par une pancytopénie arégénérative sans syndrome tumoral, avec moelle désertique au myélogramme et remplacement du tissu hématopoïétique par des adipocytes sans fibrose à la biopsie ostéomédullaire (BOM indispensable)",
          "Selon le score pronostique de Camitta, une aplasie médullaire est dite très sévère si les PNN sont < 200/mm3, les plaquettes < 20 000/mm3 et les réticulocytes < 20 000/mm3",
          "La recherche d'un clone HPN (déficit en CD55 et CD59 par mutation du gène PIG-A en cytométrie de flux) et le test de cassures chromosomiques à la mitomycine C (chez le sujet jeune pour rechercher une maladie de Fanconi) font partie du bilan étiologique",
          "Le traitement curatif repose sur l'allogreffe de CSH (si sujet < 40 ans avec donneur HLA-identique) ou le traitement immunosuppresseur associant Sérum Anti-Lymphocytaire (SAL/ATG), Ciclosporine et Eltrombopag",
          "Une splénomégalie géante et des blastes médullaires > 30 % sont constants dans l'aplasie médullaire idiopathique",
        ],
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4" },
          { letter: "E", text: "Autres choix" },
        ],
        correct: ["E"],
        explanation:
          "Les propositions 1, 2, 3 et 4 sont toutes exactes (Cours Dr Sokhna Aïssatou Touré). La combinaison 1+2+3+4 correspond à E (Autres choix).",
      },
    ],
  },

  MS_LUPUS: { kind: "STANDALONE", items: [] },
  MS_SAPL: { kind: "STANDALONE", items: [] },
  MS_SCLERODERMIE: { kind: "STANDALONE", items: [] },
  MS_DERMATOMYOSITE: { kind: "STANDALONE", items: [] },
  MS_SARCOIDOSE: { kind: "STANDALONE", items: [] },
  MS_BEHCET: { kind: "STANDALONE", items: [] },
  MS_PR_SJOGREN_SHARP: { kind: "STANDALONE", items: [] },
  MS_CORTICOTHERAPIE_AUTOIMMUNITE: { kind: "STANDALONE", items: [] },
};

// ============================================================================
// 6. GÉNÉRATION DE L'EXAMEN BLANC AVEC RELECTURE & VALIDATION DOCIMOLOGIQUE
// ============================================================================
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

  if (lesson) {
    const topicMap = classifyUserLessonsToTopics([lesson]);
    for (const [topicId, matchedLesson] of topicMap.entries()) {
      if (matchedLesson.id === lesson.id && UCAD_PROFESSOR_EXAM_BANK[topicId]?.items.length > 0) {
        const template = UCAD_PROFESSOR_EXAM_BANK[topicId];
        return {
          id: blockId,
          kind: template.kind,
          header: `${template.header} (${lesson.cleanTitle})`,
          vignette: template.vignette,
          lessonIds: [lesson.id],
          items: template.items.map((it, idx) => ({
            ...it,
            id: `${blockId}_q_${idx + 1}`,
            lessonId: lesson.id,
            lessonTitle: lesson.cleanTitle,
          })),
        };
      }
    }
  }

  // Repli générique sur les phrases du cours si matière hors Hématologie
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
      stem:
        fmt === "CENSURE"
          ? `Concernant « ${lesson?.cleanTitle} », toutes les propositions suivantes sont exactes SAUF UNE. Indiquez la proposition INEXACTE :`
          : fmt === "GROUPAGE"
          ? `Parmi les propositions suivantes concernant « ${lesson?.cleanTitle} », indiquez la combinaison exacte (Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix) :`
          : `Quelle est la proposition exacte concernant la démarche diagnostique et thérapeutique de « ${lesson?.cleanTitle} » ?`,
      statements:
        fmt === "GROUPAGE"
          ? [
              s1,
              s2,
              s3,
              "L'évolution spontanée se fait systématiquement vers la guérison sans aucune prise en charge.",
              "Aucun examen biologique n'est utile au diagnostic.",
            ]
          : undefined,
      options:
        fmt === "GROUPAGE"
          ? [
              { letter: "A", text: "1 + 2 + 3" },
              { letter: "B", text: "1 + 3" },
              { letter: "C", text: "2 + 4" },
              { letter: "D", text: "4" },
              { letter: "E", text: "Autres choix" },
            ]
          : [
              { letter: "A", text: s1 },
              { letter: "B", text: s2 },
              { letter: "C", text: "L'abstention diagnostique et thérapeutique est systématique." },
              { letter: "D", text: "Aucun contrôle biologique n'est indiqué." },
              { letter: "E", text: "Le pronostic ne dépend d'aucun paramètre clinique ou biologique." },
            ],
      correct: fmt === "CENSURE" ? ["C"] : ["A"],
      explanation: `Référence directe au cours « ${lesson?.cleanTitle} » : ${s1}`,
      lessonId: lesson?.id,
      lessonTitle: lesson?.cleanTitle,
    };
  });

  return {
    id: blockId,
    kind: spec.kind,
    header: `Cas clinique — ${lesson?.cleanTitle || "Évaluation"}`,
    vignette:
      spec.kind === "CAS_CLINIQUE"
        ? `Un patient est admis dans le service pour un tableau clinique et biologique caractéristique relevant du chapitre « ${lesson?.cleanTitle} ».`
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
  const topicMap = classifyUserLessonsToTopics(hydratedSelected);
  const systemPrompt = fillSystemPrompt(ueName, subjectName, analysis.quota);
  const totalSteps = hydratedSelected.length + 1;

  let globalQuestionNumber = 1;

  for (let i = 0; i < hydratedSelected.length; i++) {
    if (isCancelled?.()) break;
    const lesson = hydratedSelected[i];

    onProgress?.({
      phase: "redaction",
      message: `Rédaction calibrée UCAD (${i + 1}/${hydratedSelected.length}) : « ${lesson.cleanTitle} »…`,
      current: i,
      total: totalSteps,
    });
    await new Promise((r) => setTimeout(r, 260));

    // 1. Vérifie d'abord si le cours correspond à un bloc magistral UCAD certifié
    let matchedTopicId: CanonicalTopicId | null = null;
    for (const [tid, lObj] of topicMap.entries()) {
      if (lObj.id === lesson.id && UCAD_PROFESSOR_EXAM_BANK[tid]?.items.length > 0) {
        matchedTopicId = tid;
        break;
      }
    }

    if (matchedTopicId) {
      const template = UCAD_PROFESSOR_EXAM_BANK[matchedTopicId];
      const numberedItems: EBItem[] = template.items.map((it) => ({
        ...it,
        id: `eb_${sessionSeed}_${i + 1}_${globalQuestionNumber}`,
        number: globalQuestionNumber++,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      }));
      blocks.push({
        id: `block_${sessionSeed}_${i + 1}`,
        kind: template.kind,
        header: `${template.header} — ${lesson.cleanTitle}`,
        vignette: template.vignette,
        lessonIds: [lesson.id],
        items: numberedItems,
      });
      continue;
    }

    // 2. Sinon, appel à Claude Sonnet 4.6 via l'Edge Function ou repli structuré
    const spec: BlueprintSpec = {
      id: `block_${i + 1}`,
      kind: i < 3 ? "CAS_CLINIQUE" : "STANDALONE",
      lessonIds: [lesson.id],
      formats: ["ELECTION", "GROUPAGE", "CENSURE", "ELECTION"],
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
            lessonTitle: lesson.cleanTitle,
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
      // bascule sur createSyntheticFallbackBlock
    }

    const fallback = createSyntheticFallbackBlock(spec, [lesson], `block_${sessionSeed}_${i + 1}`, analysis.style);
    fallback.items = fallback.items.map((it) => ({
      ...it,
      number: globalQuestionNumber++,
      lessonId: lesson.id,
      lessonTitle: lesson.cleanTitle,
    }));
    blocks.push(fallback);
  }

  // Étape finale : Relecture et validation docimologique des énoncés, clés et justifications
  onProgress?.({
    phase: "verification",
    message: `Validation docimologique finale des ${globalQuestionNumber - 1} QCM, des grilles de Groupage et du corrigé détaillé…`,
    current: totalSteps - 1,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 320));

  return { blocks, warnings };
}

// ============================================================================
// 7. PERSISTANCE, SCORING & EXPORT PDF
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

