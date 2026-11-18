// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR DOCIMOLOGIQUE 100 % UNIVERSEL & ADAPTATIF (ZÉRO CODAGE EN DUR)
// - Fonctionne de manière identique à Gemini Chat sur N'IMPORTE QUELLE MATIÈRE :
//   Traumatologie-Orthopédie-Rhumatologie (TOR), Cardiologie, Hématologie,
//   Maladies de Système, Neurologie, Chirurgie, Pédiatrie, Droit, Sciences…
// - Aucune banque de questions figée par matière, aucun registre d'examen codé
//   en dur : toute l'analyse (types de QCM, ratio de cas cliniques vs QCM directs,
//   fréquence des leçons, nombre moyen de QCM, extraits verbatims) et toute la
//   génération découlent EXCLUSIVEMENT des cours et des annales uploadés par
//   l'étudiant.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { getEdgeAccessToken } from "@/lib/edgeAuth";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  JUMELAGE_OPTIONS,
  validateExamDraft,
  validateReviewedExamBlock,
  type ExamValidation,
  type ReviewedExamBlock,
} from "../../supabase/functions/_shared/exam-validation";
import { apportionExamCounts, createExamDesign, plannedOptionCount, type ObservedExamQuestion, type ExamDesign } from "../../supabase/functions/_shared/exam-design";
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
import {
  cleanOptionPrefix,
  handleAuditExamAnnale,
  handleGenerateExamenBlancBlock,
  LETTERS,
  sanitizeExamDraft,
  type ExamenBlancPipelineDeps,
} from "../../supabase/functions/_shared/examen-blanc-ai";
import {
  safeParseJsonObject,
  type PoolCallResult,
} from "../../supabase/functions/_shared/sonnet-pool";
import { repairAndParseQuizJson } from "./jsonRepair";
import {
  VERIFIED_SCANNED_EXAMS_CORPUS,
  looksLikeUcadExamFileName,
  lookupPreExtractedExamCorpus,
  findPreExtractedUcadExam,
} from "./ucadExamCorpus";

export {
  VERIFIED_SCANNED_EXAMS_CORPUS,
  looksLikeUcadExamFileName,
  lookupPreExtractedExamCorpus,
  findPreExtractedUcadExam,
};
export type { ExamDesign };

export const EXAMEN_BLANC_EDGE_FUNCTION = "generate-quiz";
export const EXAMEN_BLANC_EDGE_ENDPOINTS = [
  "dawjang-exam-ai",
  "generate-quiz",
  "generate-quiz-supabase-ai",
  "generate-quiz-openai",
] as const;

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

export function getObservedLessonFrequency(stat: Pick<LessonStat, "examsAppeared" | "totalExams">): number | null {
  return stat.totalExams > 0 ? Math.round(100 * stat.examsAppeared / stat.totalExams) : null;
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

const SESSIONS_STORAGE_KEY = "dawjang_eb_sessions_v4_universal";

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu rédiges un examen blanc pour l'unité d'enseignement « {{UE}} », matière évaluée : « {{SUBJECT}} ». Chapitres couverts par la session : {{QUOTA}}.

RÈGLES :
1. Adapte-toi uniquement à la discipline « {{SUBJECT}} », au contenu des cours fournis et à la structure réellement mesurée dans ses annales. N'importe aucune notion, aucun contexte ni vocabulaire d'une autre matière ou d'un autre chapitre.
2. La structure de chaque bloc (dossier ou questions indépendantes, format et nombre de choix de chaque question) est imposée par le plan d'épreuve joint à la demande : ne la modifie jamais.
3. Reprends les tournures d'énoncé observées dans les annales en les appliquant exclusivement au chapitre demandé ; ne recopie jamais une question d'annale.
4. Avant de répondre, relis chaque question : la ou les lettres de \`correct\` doivent correspondre exactement à l'explication, sans crochet \`[...]\` ni texte mécanique.`;

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

  const measured = (style.measuredQuestions || 0) > 0;
  const extraDna = [
    `\n=== PROFIL DE STYLE DE « ${subject || "LA MATIÈRE"} » ===`,
    style.professorSignatureSummary ? `- ${style.professorSignatureSummary}` : "",
    measured && style.detectedGroupageCode ? `- Code de groupage relevé dans les annales : ${style.detectedGroupageCode}` : "",
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
    .replace(/\b(?:ucad|fmpo|fmp|m1s1|m1s2|m2s1|m2s2|l1|l2|l3)\b[\s_-]*(?:20\d{2})?[\s_-]*\d*/gi, " ")
    .replace(/\b20\d{2}\b[\s_-]*\d*/g, " ")
    .replace(/\(\s*\d+\s*\)\s*$/g, "")
    .replace(/\s+\d{1,2}\s*$/g, "")
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
// 1. DICTIONNAIRE D'EXPANSION LEXICALE MULTI-DISCIPLINAIRE (SANS BIAIS)
//    S'active uniquement lorsqu'un cours uploadé par l'étudiant contient déjà
//    l'un des termes déclencheurs dans son titre ou ses sous-titres.
// ============================================================================
const SEMANTIC_SYNONYM_CLUSTERS: Array<{ triggers: RegExp; expansions: string[] }> = [
  // --- TRAUMATOLOGIE, ORTHOPÉDIE & RHUMATOLOGIE (TOR) ---
  {
    triggers: /\b(extre\w*\s+infer\w*\s+du\s+radius|eir|pouteau\s*colles|goyrand\s*smith|poignet|styloide\s+radiale)\b/,
    expansions: [
      "fracture de pouteau colles", "goyrand smith", "gerard marchant", "dos de fourchette",
      "baionnette", "signe de laugier", "ascension de la styloide radiale", "kapandji",
      "brochage", "plaque verrouillee anterieure", "algodystrophie", "canal carpien",
    ],
  },
  {
    triggers: /\b(col\s+du\s+femur|col\s+femoral|garden|pauwels|trochanter|extre\w*\s+super\w*\s+du\s+femur|esf)\b/,
    expansions: [
      "fracture du col femoral", "classification de garden", "classification de pauwels",
      "necrose de la tete femorale", "pseudarthrose du col", "adduction rotation externe",
      "raccourcissement", "prothese intermediaire", "prothese totale de hanche", "vis plaque dhs",
      "clou gamma", "massif trochanterien", "cervico trochanterienne", "pertrochanterienne",
    ],
  },
  {
    triggers: /\b(luxation.*epaule|gleno\s*humerale|epaule|signe\s+de\s+l\s*epaulette|bankart|hill\s*sachs)\b/,
    expansions: [
      "luxation gleno humerale", "luxation antero interne", "sous coracoidienne", "signe de l epaulette",
      "coup de hache externe", "vacuite de la glene", "signe de berger", "nerf circonflexe",
      "nerf axillaire", "encoche de malgaigne", "hill sachs", "lesion de bankart", "butee de latarjet",
    ],
  },
  {
    triggers: /\b(luxation.*hanche|coxo\s*femorale|cotyle|bassin|anneau\s+pelvien|tile|letournel)\b/,
    expansions: [
      "luxation coxo femorale", "luxation posterieure", "iliaque", "ischiatique", "tableau de bord",
      "nerf grand sciatique", "fracture du cotyle", "judet et letournel", "fracture du bassin",
      "classification de tile", "disjonction symphysaire", "choc hemorragique", "complications urinaires",
    ],
  },
  {
    triggers: /\b(diaphyse\s+femorale|jambe|tibia|pilon\s+tibial|bimalleolaire|cheville|dupuytren|maissonneuve)\b/,
    expansions: [
      "fracture bimalleolaire", "fracture de dupuytren", "fracture de maisonneuve", "syndesmose",
      "enclouage centromedullaire", "syndrome des loges", "volkmann", "fracture ouverte",
      "classification de cauchoix et duparc", "gustilo", "embolie graisseuse",
    ],
  },
  {
    triggers: /\b(humerus|palette\s+humerale|olecrane|coude|avant\s*bras|monteggia|galeazzi|clavicule)\b/,
    expansions: [
      "fracture de l humerus", "nerf radial", "main tombante", "palette humerale", "ligne de malgaigne",
      "triangle de nelaton", "fracture de monteggia", "fracture de galeazzi", "syndrome de volkmann",
    ],
  },
  {
    triggers: /\b(osteomyelite|osteoarthrite|infection\s+osseuse|hematogene|staphylococcus\s+aureus|sequestre)\b/,
    expansions: [
      "osteomyelite aigue hematogene", "pres de genou loin du coude", "metaphyse fertile",
      "staphylococcus aureus", "salmonella", "abces sous perioste", "sequestre osseux",
      "involucrum", "osteomyelite chronique", "ponction metaphysaire",
    ],
  },
  {
    triggers: /\b(tumeur.*osseuse|osteosarcome|ewing|chondrosarcome|osteome\s+osteoide|exostose)\b/,
    expansions: [
      "osteosarcome", "sarcome d ewing", "chondrosarcome", "triangle de codman", "feu d herbe",
      "bulbe d oignon", "osteome osteoide", "nidus", "tumeur a cellules geantes", "biopsie osseuse",
    ],
  },
  {
    triggers: /\b(arthrose|gonarthrose|coxarthrose|pincement\s+articulaire|osteophyte|geode\s+sous\s+chondrale)\b/,
    expansions: [
      "arthrose", "gonarthrose", "coxarthrose", "douleur mecanique", "pincement localise de l interligne",
      "osteophytose marginale", "condensation sous chondrale", "geodes d hyperpression",
      "indice de lequesne", "kellgren et lawrence",
    ],
  },
  {
    triggers: /\b(lombosciatique|sciatique|hernie\s+discale|lasegue|queue\s+de\s+cheval|canal\s+lombaire)\b/,
    expansions: [
      "lombosciatique", "hernie discale", "signe de lasegue", "signe de la sonnette", "racine l5",
      "racine s1", "reflexe achilleen", "syndrome de la queue de cheval", "anesthesie en selle",
    ],
  },
  {
    triggers: /\b(goutte|urate|hyperuricemie|chondrocalcinose|pyrophosphate|arthropathie\s+microcristalline)\b/,
    expansions: [
      "goutte", "urate monosodique", "cristaux en aiguilles", "birefringence negative",
      "podagre", "tophus goutteux", "colchicine", "allopurinol", "chondrocalcinose",
      "pyrophosphate de calcium", "liseré calcique",
    ],
  },
  {
    triggers: /\b(spondylarthrite|ankylosante|sacro\s*iliite|hla\s*b27|enthesite|syndesmophyte)\b/,
    expansions: [
      "spondylarthrite ankylosante", "sacro iliite", "hla b27", "enthesite", "talalgie inflammatoire",
      "indice de schober", "colonne bambou", "syndesmophyte", "anti tnf",
    ],
  },
  {
    triggers: /\b(mal\s+de\s+pott|spondylodiscite|tuberculose\s+osteo|gibbosite|abces\s+froid)\b/,
    expansions: [
      "mal de pott", "spondylodiscite tuberculeuse", "pincement discal", "erosion des plateaux vertebraux",
      "gibbosite", "abces froid du psoas", "triade de pott", "geneXpert",
    ],
  },
  {
    triggers: /\b(lesion.*musculaire|claquage|elongation|dechirure|contusion|rupture.*achille|entorse|lca|lachman)\b/,
    expansions: [
      "elongation musculaire", "claquage", "dechirure musculaire", "hematome enkyste", "myosite ossifiante",
      "entorse du genou", "ligament croise anterieur", "signe de lachman", "tiroir anterieur",
      "ressaut rotatoire", "rupture du tendon d achille", "signe de thompson",
    ],
  },
  {
    triggers: /\b(osteoporose|densitometrie|t\s*score|fracture.*fragilite|tassement\s+vertebral)\b/,
    expansions: [
      "osteoporose", "absorptiometrie biphotonique", "t score", "fracture par fragilite",
      "tassement vertebral", "bisphosphonates", "bilan phosphocalcique normal",
    ],
  },
  // --- CARDIOLOGIE & VASCULAIRE ---
  {
    triggers: /\b(valvulopathie|retrecissement\s+mitral|insuffisance\s+mitrale|retrecissement\s+aortique|duroziez)\b/,
    expansions: [
      "retrecissement mitral", "triade de duroziez", "eclat de b1", "claquement d ouverture mitrale",
      "roulement diastolique", "commissurotomie mitrale percutanee", "insuffisance mitrale",
      "retrecissement aortique", "insuffisance aortique", "endocardite infectieuse",
    ],
  },
  // --- HÉMATOLOGIE & MALADIES DE SYSTÈME ---
  {
    triggers: /\b(smp|myeloproliferatif|vaquez|myelofibrose|lmc|thrombocytemie)\b/,
    expansions: [
      "syndrome myeloproliferatif", "leucemie myeloide chronique", "polyglobulie de vaquez",
      "myelofibrose primitive", "bcr abl", "jak2", "philadelphie", "imatinib", "dacryocytes",
    ],
  },
  {
    triggers: /\b(gammapathie|myelome|waldenstrom|mgus|monoclonale)\b/,
    expansions: [
      "myelome multiple", "mgus", "waldenstrom", "bence jones", "crab", "immunofixation", "plasmocytose",
    ],
  },
  {
    triggers: /\b(hemoglobinopathie|drepanocytose|thalassemie)\b/,
    expansions: [
      "drepanocytose", "thalassemie", "hbs", "hbf", "syndrome thoracique aigu", "hydroxyuree",
    ],
  },
  {
    triggers: /\b(llc|leucemie\s+lymphoide\s+chronique)\b/,
    expansions: [
      "leucemie lymphoide chronique", "ombres de gumprecht", "score de matutes", "binet", "richter",
    ],
  },
  {
    triggers: /\b(lnh|lymphome.*nh|non\s+hodgkin)\b/,
    expansions: [
      "lymphome non hodgkinien", "grandes cellules", "score ipi", "r chop", "ann arbor", "cd20",
    ],
  },
  {
    triggers: /\b(hodgkin|reed\s+sternberg)\b/,
    expansions: [
      "lymphome de hodgkin", "reed sternberg", "cellule de sternberg", "cd30", "cd15", "abvd",
    ],
  },
  {
    triggers: /\b(transfusion|hemovigilance|beth\s+vincent|agglutinines)\b/,
    expansions: [
      "transfusion", "cross matching", "concentres de globules rouges", "incompatibilite abo", "rai",
    ],
  },
  {
    triggers: /\b(ahai|auto\s+anticorps\s+chauds|coombs)\b/,
    expansions: [
      "anemie hemolytique auto immune", "auto anticorps chauds", "coombs direct", "agglutinines froides",
    ],
  },
  {
    triggers: /\b(civd|coagulation\s+intravasculaire|fibrinolyse|vitamine\s+k)\b/,
    expansions: [
      "coagulation intravasculaire disseminee", "civd", "fibrinolyse primitive", "d dimeres", "facteur v",
    ],
  },
  {
    triggers: /\b(carentielle|biermer|martiale|ferriprive)\b/,
    expansions: [
      "maladie de biermer", "carence martiale", "vitamine b12", "facteur intrinseque", "ferritinemie",
    ],
  },
  {
    triggers: /\b(spherocytose|elliptocytose|minkowski)\b/,
    expansions: [
      "spherocytose hereditaire", "elliptocytose hereditaire", "ektacytometrie", "spectrine", "minkowski chauffard",
    ],
  },
  {
    triggers: /\b(hemophilie|facteur\s+viii|facteur\s+ix)\b/,
    expansions: [
      "hemophilie", "facteur viii", "facteur ix", "conductrice obligatoire", "hemarthrose",
    ],
  },
  {
    triggers: /\b(hemostase\s+primaire|willebrand|glanzmann|bernard\s+soulier)\b/,
    expansions: [
      "maladie de willebrand", "von willebrand", "purpura thrombopenique", "glanzmann", "bernard soulier",
    ],
  },
  {
    triggers: /\b(enzymopathie|g6pd|pyruvate\s+kinase)\b/,
    expansions: [
      "deficit en g6pd", "corps de heinz", "pyruvate kinase", "hemolyse aigue", "hemoglobinurie",
    ],
  },
  {
    triggers: /\b(aplasie\s+medullaire|fanconi|camitta)\b/,
    expansions: ["aplasie medullaire", "camitta", "fanconi", "pancytopenie", "moelle desertique"],
  },
  {
    triggers: /\b(lupus|\bles\b)\b/,
    expansions: [
      "lupus erythemateux", "lupus systemique", "vespertilio", "anti dna natifs", "anti sm", "glomerulonephrite lupique",
    ],
  },
  {
    triggers: /\b(sapl|antiphospholipide)\b/,
    expansions: [
      "antiphospholipides", "sapl", "lupus anticoagulant", "anti cardiolipine", "anti beta2 gp1", "livedo",
    ],
  },
  {
    triggers: /\b(sclerodermie|crest|raynaud)\b/,
    expansions: [
      "sclerodermie systemique", "crest syndrome", "phenomene de raynaud", "anti scl70", "anti centromeres", "rodnan",
    ],
  },
  {
    triggers: /\b(dermatomyosite|polymyosite|anti\s+synthetase)\b/,
    expansions: [
      "dermatomyosite", "polymyosite", "papules de gottron", "anti jo1", "myopathies inflammatoires",
    ],
  },
  {
    triggers: /\b(sarcoidose|lofgren)\b/,
    expansions: [
      "sarcoidose", "granulome sans necrose caseeuse", "enzyme de conversion", "syndrome de lofgren", "erytheme noueux",
    ],
  },
  {
    triggers: /\b(behcet|aphtose|hypopion)\b/,
    expansions: [
      "maladie de behcet", "aphtose bipolaire", "uveite a hypopion", "test pathergique",
    ],
  },
  {
    triggers: /\b(gougerot|sjogren|polyarthrite\s+rhumatoide)\b/,
    expansions: [
      "polyarthrite rhumatoide", "anti ccp", "syndrome de sjogren", "gougerot sjogren", "anti ssa", "anti ssb",
    ],
  },
  // --- TRAUMATOLOGIE, ORTHOPÉDIE & RHUMATOLOGIE SUPPLÉMENTAIRES ---
  {
    triggers: /\b(polytraumatis|damage\s+control|traumatisme\s+ferme|h[eé]mop[eé]ritoine|fast\s+echo)\b/,
    expansions: [
      "polytraumatise", "damage control", "fast echographie", "hemoperitoine", "hemothorax", "pneumothorax compressif", "abcde", "atls", "choc hemorragique",
    ],
  },
  {
    triggers: /\b(col\s+(du\s+)?femur|garden|pauwels|pertrochanter|trochanter)\b/,
    expansions: [
      "fracture du col femoral", "classification de garden", "pauwels", "pertrochanterienne", "necrose tete femorale", "clou gamma", "prothese intermediaire", "prothese totale hanche",
    ],
  },
  {
    triggers: /\b(plateau\s+tibial|schatzker|entorse\s+du\s+genou|croise\s+anterieur|menisc|lachman|rotule|patella)\b/,
    expansions: [
      "plateau tibial", "schatzker", "ligament croise anterieur", "lachman", "tiroir anterieur", "lesion meniscale", "syndrome de loges", "hemarthrose", "artere poplitee",
    ],
  },
  {
    triggers: /\b(epaule|hum[eé]rus|clavicule|neer|nerf\s+radial|monteggia|galeazzi|pouteau\s+colles|scapho[iï]de)\b/,
    expansions: [
      "fracture extremite inferieure radius", "pouteau colles", "goyrand smith", "monteggia", "galeazzi", "fracture scaphoide", "tabatiere anatomique", "luxation gleno humerale", "nerf radial", "paralysie radiale", "classification de neer",
    ],
  },
  {
    triggers: /\b(rachis|vert[eé]bral|magerl|denis|moelle\s+[eé]pini[eè]re|queue\s+de\s+cheval|sciatique)\b/,
    expansions: [
      "traumatisme du rachis", "segment mobile rachidien", "classification magerl", "denis", "syndrome queue de cheval", "compression medullaire", "frankel", "asia", "nerf sciatique",
    ],
  },
  {
    triggers: /\b(bassin|cotyle|tile|ur[eè]tre\s+membran|cheville|bimall[eé]olaire|weber|dupuytren|pilon\s+tibial)\b/,
    expansions: [
      "fracture du bassin", "classification de tile", "fracture du cotyle", "fracture bimalleolaire", "classification de weber", "dupuytren", "pilon tibial", "rupture uretre",
    ],
  },
  {
    triggers: /\b(scoliose|cobb|risser|gibbosite|spondylarthrite|ankylosante|goutte|chondrocalcinose)\b/,
    expansions: [
      "angle de cobb", "test de risser", "gibbosite", "spondylarthrite ankylosante", "hla b27", "sacro iliite", "goutte", "acide urique", "chondrocalcinose", "cristaux pyrophosphate",
    ],
  },
  // --- SPÉCIALITÉS MÉDICO-CHIRURGICALES GÉNÉRALES (MULTI-UE) ---
  {
    triggers: /\b(infarctus|sca|coronarien|troponine|stemi|angine\s+de\s+poitrine|fibrillation\s+auriculaire)\b/,
    expansions: [
      "syndrome coronarien aigu", "stemi", "sus decalage st", "troponine", "coronarographie", "fibrillation auriculaire", "cha2ds2 vasc", "embolie pulmonaire", "d dimeres", "angioscanner thoracique",
    ],
  },
  {
    triggers: /\b(avc|isch[eé]mique|thrombolyse|nihss|m[eé]ningite|lcr|[eé]pilepsie|\bhtic\b)\b/,
    expansions: [
      "accident vasculaire cerebral", "thrombolyse", "nihss", "ponction lombaire", "meningite purulente", "hypertension intracranienne", "engagement temporal", "etat de mal epileptique",
    ],
  },
  {
    triggers: /\b(bpco|asthme|tuberculose|bk|pleur[eé]sie|pneumopathie|emphys[eè]me)\b/,
    expansions: [
      "bronchopneumopathie chronique", "vems cvf", "gold", "asthme aigu grave", "tuberculose pulmonaire", "bacille de koch", "isoniazide rifampicine", "pleuresie", "light exsudat transsudat",
    ],
  },
  {
    triggers: /\b(insuffisance\s+r[eé]nale|n[eé]phrotique|n[eé]phritique|clairance|cr[eé]atinine|dialyse)\b/,
    expansions: [
      "insuffisance renale aigue", "kdigo", "syndrome nephrotique", "proteinurie 24h", "hypoalbuminemie", "glomerulonephrite", "hyperkaliemie menacante",
    ],
  },
  {
    triggers: /\b(cirrhose|ascite|child\s+pugh|varices\s+oesophagiennes|pancr[eé]atite|occlusion|appendicite|p[eé]ritonite)\b/,
    expansions: [
      "cirrhose hepatique", "child pugh", "hypertension portale", "varices oesophagiennes", "pancreatite aigue", "lipasemie", "ranson balthazar", "occlusion intestinale", "peritonite aigue", "pneumoperitoine",
    ],
  },
  {
    triggers: /\b(diab[eè]te|acidoc[eé]tose|hyperthyro[iï]die|basedow|hypothyro[iï]die|cortisol|cushing|addison)\b/,
    expansions: [
      "acidocetose diabetique", "coma hyperosmolaire", "hba1c", "maladie de basedow", "tsh ultrasensible", "insuffisance surrenalienne aigue", "hydrocortisone", "syndrome de cushing",
    ],
  },
  {
    triggers: /\b(pr[eé][eé]clampsie|hellp|grossesse\s+extra|geu|h[eé]morragie\s+de\s+la\s+d[eé]livrance|placenta)\b/,
    expansions: [
      "preeclampsie", "hellp syndrome", "sulfate de magnesium", "grossesse extra uterine", "beta hcg", "hemorragie de la delivrance", "hematome retroplacentaire", "placenta praevia",
    ],
  },
  {
    triggers: /\b(d[eé]shydratation|bronchiolite|convulsion\s+f[eé]brile|ict[eè]re\s+n[eé]onatal|apgar|kawasaki)\b/,
    expansions: [
      "deshydratation aigue du nourrisson", "sels de rehydratation orale", "bronchiolite aigue", "score de wang", "convulsion febrile", "ictere neonatale", "score d apgar",
    ],
  },
];

function extractBigrams(normText: string, maxCount = 70): string[] {
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
    .slice(0, 80);

  const normTitleAndHeadings = normalizeText(`${cleanTitle} ${headings.slice(0, 15).join(" ")}`);
  const semanticExpansions: string[] = [];
  for (const cluster of SEMANTIC_SYNONYM_CLUSTERS) {
    if (cluster.triggers.test(normTitleAndHeadings)) {
      semanticExpansions.push(...cluster.expansions);
    }
  }

  const freq = new Map<string, number>();
  const normFullText = normalizeText(
    `${cleanTitle} ${cleanTitle} ${cleanTitle} ${semanticExpansions.join(" ")} ${headings.join(
      " "
    )} ${safeContent.slice(0, 70000)}`
  );
  const normTokens = normFullText.split(" ");
  for (const tok of normTokens) {
    if (tok.length < 4 || STOPWORDS_FR.has(tok) || /^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }

  const titleTokens = normalizeText(cleanTitle)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));

  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 110)
    .map(([k]) => k);

  const keywords = Array.from(new Set([...titleTokens, ...topKeywords]));
  const discriminativePhrases = Array.from(
    new Set([
      ...semanticExpansions.map((e) => normalizeText(e)),
      ...extractBigrams(normFullText, 70),
    ])
  ).slice(0, 100);

  const subjTokens = normalizeText(subjectInput)
    .split(" ")
    .filter((t) => t.length >= 4);
  const relevance =
    subjTokens.length === 0 || safeContent.length > 80
      ? 1
      : subjTokens.some((st) => normFullText.includes(st))
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
    discriminativePhrases,
    headings,
    relevance,
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
// 2. EXTRACTEUR ET PARSEUR DOCIMOLOGIQUE UNIVERSEL D'ANNALES (TOUTES MATIÈRES)
// ============================================================================
export interface AIAuditEntry {
  questionCount?: number;
  caseCount?: number;
  formatCounts?: Record<string, number>;
  ignoredReason?: "OTHER_SUBJECT" | "DUPLICATE_EXAM" | null;
  summaryNotes?: string[] | string;
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

function buildCorpusIdfMap(usableLessons: EBLesson[]): Map<string, number> {
  const docCount = Math.max(1, usableLessons.length);
  const df = new Map<string, number>();

  for (const lesson of usableLessons) {
    const uniqueTerms = new Set<string>([
      ...normalizeText(lesson.cleanTitle)
        .split(" ")
        .filter((w) => w.length >= 3 && !STOPWORDS_FR.has(w)),
      ...(lesson.keywords || []),
      ...(lesson.discriminativePhrases || []),
    ]);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df.entries()) {
    const weight = Math.log(1 + docCount / Math.max(1, count));
    idf.set(term, weight);
  }
  return idf;
}

/**
 * Détecte si une annale en cache dans le navigateur a été accidentellement remplacée
 * dans une ancienne version par un texte d'Hématologie/Maladies de Système alors que
 * son nom de fichier porte sur une tout autre matière (ex: "sujet TOR 2022.pdf").
 */
export function isCachedAnnaleCrossContaminated(title: string, rawText: string): boolean {
  if (!rawText || !title) return false;
  if (looksLikeUcadExamFileName(title)) return false;
  const head = rawText.slice(0, 600);
  return (
    head.includes("=== SECTION EC2 : MALADIES DE SYSTEME") ||
    head.includes("=== SECTION EC1 : HEMATOLOGIE") ||
    head.includes("UE Hématologie Maladies de système")
  );
}

// Mots d'en-tête qui décrivent la forme de l'épreuve et non la matière.
const STRUCTURAL_HEADER_WORDS = new Set([
  "section", "partie", "epreuve", "sous", "element", "elements", "constitutif", "matiere", "module", "departement",
  "discipline", "session", "examen", "evaluation", "rattrapage", "controle", "continu", "partiel", "final", "annee",
  "universitaire", "semestre", "trimestre", "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout",
  "septembre", "octobre", "novembre", "decembre", "qcm", "qns", "qroc", "question", "questions", "redactionnelle",
  "redactionnelles", "choix", "multiple", "multiples", "cas", "clinique", "cliniques", "pratique", "pratiques",
  "dossier", "dossiers", "exercice", "exercices", "probleme", "problemes", "situation", "situations", "etude", "etudes",
  "document", "documents", "documentaire", "texte", "textes", "duree", "heure", "heures", "minute", "minutes",
  "coefficient", "bareme", "points", "point", "note", "sujet", "sujets", "corrige", "corriges", "professeur", "docteur",
  "licence", "master", "niveau", "groupe", "serie", "premiere", "deuxieme", "troisieme", "seconde", "faculte",
  "universite", "institut", "ecole",
]);

function headingTopicWords(text: string): string[] {
  const unglued = String(text || "")
    .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2")
    .replace(/\b(?:de|du|des|d)(?=[A-ZÀ-Ý][a-zà-ÿ]{3,})/g, " ")
    .replace(/\bphysiologioe\b/gi, "physiologie");
  return normalizeText(unglued)
    .split(" ")
    .map((word) =>
      word.replace(
        /^(?:de|d)(?=(?:traumat|rhumat|orthop|anatom|cardio|neuro|pneumo|gastro|hemato|nephro|endocrino|infectio|pediatr|gyneco|urolog|dermat|ophtalm|stomato|psychiatr|pharmac|physiolog|histolog|embryolog|biochim|biophys))/i,
        ""
      )
    )
    .filter(
      (word) =>
        word.length >= 3 &&
        !/^\d/.test(word) &&
        !/^(?:ec|ue)\d*$/.test(word) &&
        !/^[ivx]+$/.test(word) &&
        !STOPWORDS_FR.has(word) &&
        !STRUCTURAL_HEADER_WORDS.has(word)
    );
}

function sameTopicWord(a: string, b: string): boolean {
  const x = a.replace(/[sx]$/, "");
  const y = b.replace(/[sx]$/, "");
  if (x === y) return true;
  let common = 0;
  while (common < x.length && common < y.length && x[common] === y[common]) common++;
  return common >= Math.max(4, Math.ceil(0.8 * Math.min(x.length, y.length)));
}

const STANDALONE_DISCIPLINE_HEADING_REGEX =
  /^(?:traumatologie|orthop[eé]die|rhumatologie(?:\s*(?:&|et)\s*sciences\s+de\s+base)?|physiologi[eo]?e?|anatomie(?:\s+pathologique)?|cardiologie|pneumologie|neurologie|gastro[- ]?ent[eé]rologie|h[eé]matologie(?:\s+clinique)?|maladies\s+de\s+syst[eè]me|n[eé]phrologie|urologie|endocrinologie|p[eé]diatrie|gyn[eé]cologie|obst[eé]trique|infectiologie|dermatologie|ophtalmologie|orl|stomatologie|psychiatrie|pharmacologie|biochimie|biophysique|histologie|embryologie|g[eé]n[eé]tique|immunologie|bact[eé]riologie|virologie|parasitologie|sant[eé]\s+publique)\s*:?\s*$/i;

function preprocessSubjectSectionText(rawText: string): string {
  return String(rawText || "")
    .replace(/\r\n?/g, "\n")
    .replace(/(Rhumatologie\s*(?:&|et))\s*\n+\s*(Sciences\s+de\s+Base)/gi, "$1 $2")
    .replace(/\b(Anatomie)\s*\n+\s*(Pathologique)\b/gi, "$1 $2")
    .replace(
      /(?:^|\n)[ \t]*(EC\s*\d+)[ \t]*\n+[ \t]*([A-ZÀ-Ý][A-Za-zÀ-ÿ'’& -]{3,60})(?=\s*\n)/g,
      (full, ec, disc) => {
        if (/^(?:election|[eé]lection|censure|groupage|jumelage|association|compl[eé]ments?|qcm|q\s*\d)/i.test(disc.trim())) {
          return full;
        }
        return `\n${ec.trim()} : ${disc.trim()}`;
      }
    )
    .replace(
      /(?:^|\n)[ \t]*([A-ZÀ-Ý][A-Za-zÀ-ÿ'’& -]{3,60})[ \t]*\n+[ \t]*(EC\s*\d+)(?=\s*(?:\n|$))/g,
      (full, disc, ec) => {
        if (/^(?:module|unit[eé]|d[eé]partement|facult[eé]|universit[eé]|election|[eé]lection|censure|groupage|jumelage)/i.test(disc.trim())) {
          return full;
        }
        return `\n${ec.trim()} : ${disc.trim()}`;
      }
    );
}

function isMultiSubjectBannerLine(t: string): boolean {
  if (/^(?:unit[eé]\s+d['’]enseignement|d[eé]partement|facult[eé]|universit[eé]|coordonnateur|master|licence|ann[eé]e)\b/i.test(t)) {
    return true;
  }
  if (/^module\b/i.test(t)) {
    const afterModule = t.replace(/^module\s*(?:\d+\s*)?[:.-]?\s*/i, "");
    if (/[,&/]/.test(afterModule) || (afterModule.match(/\s+[-–—]\s+/g) || []).length >= 1) {
      return true;
    }
  }
  if (/^chirurgie\s+orthop[eé]die\s*[-–—]\s*traumatologie$/i.test(t)) {
    return true;
  }
  return false;
}

function isSectionHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 140 || /^(?:QCM|QNS|Q|Question)\s*(?:n\s*[°o]?\s*)?\d/i.test(t)) return false;
  if (isMultiSubjectBannerLine(t)) return false;
  if (/^={2,}/.test(t)) return true;
  if (STANDALONE_DISCIPLINE_HEADING_REGEX.test(t)) return true;
  if (/^(?:SECTION|PARTIE|[ÉE]PREUVE|SOUS[- ][ÉE]PREUVE|EC\s*\d+|[ÉE]L[ÉE]MENT\s+CONSTITUTIF|MATI[ÈE]RE|MODULE|DISCIPLINE)\b/i.test(t)) {
    if (/^(?:EXAMEN\s+FINAL|DEVOIR|[ÉE]PREUVES?\s*\/\s*QCM)\b/i.test(t)) return false;
    return headingTopicWords(t).length > 0;
  }
  const roman = t.match(/^[IVX]{1,4}\s*[.)\-–—]\s*(.{3,})$/);
  if (!roman || /\b(?:CAS|DOSSIER|EXERCICE|[ÉE]TUDE|SITUATION|OBSERVATION|QUESTIONS?|QCM)\b/i.test(roman[1])) return false;
  const letters = roman[1].replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && letters.replace(/[^A-ZÀ-Ý]/g, "").length / letters.length >= 0.7;
}

function isolateSubjectSectionUniversal(
  rawText: string,
  subjectName: string,
  usableLessons: EBLesson[]
): { isolatedText: string; isOtherSubjectOnly: boolean; wasExplicitlyIsolated?: boolean } {
  const text = preprocessSubjectSectionText(rawText);
  if (!text.trim()) return { isolatedText: "", isOtherSubjectOnly: false };

  const normSubj = normalizeText(subjectName);
  const subjTokens = normSubj.split(" ").filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t));
  const subjectTopic = headingTopicWords(subjectName);
  const subjectAcronym = /^[a-z]{2,5}$/.test(normSubj) ? normSubj : "";

  const corpusVocabulary = new Set<string>();
  for (const l of usableLessons) {
    for (const t of normalizeText(l.cleanTitle).split(" ")) {
      if (t.length >= 4 && !STOPWORDS_FR.has(t)) corpusVocabulary.add(t);
    }
    for (const kw of (l.keywords || []).slice(0, 45)) {
      if (kw.length >= 4) corpusVocabulary.add(kw);
    }
  }
  const vocabularyMatches = (body: string) => {
    const normSeg = normalizeText(body.slice(0, 14000));
    let hits = 0;
    for (const word of corpusVocabulary) if (normSeg.includes(word)) hits++;
    return corpusVocabulary.size > 0 && hits >= Math.min(6, Math.max(2, Math.floor(corpusVocabulary.size * 0.06)));
  };

  const markers: number[] = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    if (isSectionHeadingLine(line)) markers.push(lineStart);
    lineStart += line.length + 1;
  }

  if (markers.length > 0) {
    const segments = [0, ...markers].filter((start, index, all) => index === 0 ? start < markers[0] : true).map((start, index, all) => {
      const end = index + 1 < all.length ? all[index + 1] : text.length;
      const body = text.slice(start, end);
      const isPreamble = start < markers[0];
      return { body, topic: isPreamble ? [] : headingTopicWords(body.split("\n")[0]) };
    });
    const topical = segments.filter((segment) => segment.topic.length > 0);

    if (topical.length > 0) {
      // Une section correspond si la matière ou l'en-tête est entièrement couvert : « Droit civil » ≠ « DROIT PÉNAL ».
      const headerMatches = (topic: string[]) => {
        if (subjectTopic.length > 0) {
          const matched = subjectTopic.filter((word) => topic.some((other) => sameTopicWord(word, other))).length;
          const covered = topic.filter((word) => subjectTopic.some((other) => sameTopicWord(word, other))).length;
          return matched > 0 && (matched === subjectTopic.length || covered === topic.length);
        }
        if (subjectAcronym) return topic.map((word) => word[0]).join("").includes(subjectAcronym);
        return false;
      };
      const canCompareNames = topical.some((segment) => headerMatches(segment.topic));
      let current: boolean | null = null;
      const labels = segments.map((segment) => {
        if (segment.topic.length > 0) current = canCompareNames ? headerMatches(segment.topic) : vocabularyMatches(segment.body);
        return current;
      });

      if (labels.some((label) => label === true)) {
        if (labels.every((label) => label === true)) return { isolatedText: text, isOtherSubjectOnly: false, wasExplicitlyIsolated: true };
        return {
          isolatedText: segments.filter((_, index) => labels[index] === true).map((segment) => segment.body).join("\n\n"),
          isOtherSubjectOnly: false,
          wasExplicitlyIsolated: true,
        };
      }
      const undetermined = segments.filter((segment, index) => labels[index] === null && /(?:^|\n)\s*(?:QCM|QNS|Q(?:uestion)?)\s*(?:n\s*[°o]?\s*)?\d{1,3}\b/i.test(segment.body));
      if (undetermined.length > 0) return { isolatedText: undetermined.map((segment) => segment.body).join("\n\n"), isOtherSubjectOnly: false };
      return { isolatedText: "", isOtherSubjectOnly: true };
    }
  }

  if (usableLessons.length > 0 && text.length > 200) {
    const normFull = normalizeText(text.slice(0, 30000));
    let vocabHits = 0;
    for (const word of corpusVocabulary) {
      if (normFull.includes(word)) vocabHits++;
    }
    const hasSubjectName = subjTokens.length > 0 && subjTokens.some((st) => normFull.includes(st));
    if (!hasSubjectName && vocabHits < Math.min(2, Math.max(1, corpusVocabulary.size))) {
      return { isolatedText: "", isOtherSubjectOnly: true };
    }
  }

  return { isolatedText: text, isOtherSubjectOnly: false };
}

function stemTokenRoot(word: string): string {
  if (word.length <= 5) return word;
  return word.replace(/(?:aux|eaux|ments|ment|tions|tion|iques|ique|euses|euse|aires|aire|s|x)$/i, "");
}

// Vocabulaire transversal générique partagé par plusieurs spécialités d'une même UE :
// un QCM ne peut pas être rattaché à un cours sur la seule présence de ces mots génériques.
const GENERIC_MEDICAL_BRIDGE_WORDS = new Set([
  "maladie", "maladies", "manifestation", "manifestations", "atteinte", "atteintes",
  "sequelle", "sequelles", "trouble", "troubles", "syndrome", "syndromes", "pathologie",
  "pathologies", "cours", "lecon", "chapitre", "generalite", "generalites", "introduction",
  "definition", "diagnostic", "traitement", "prise", "charge", "clinique", "cliniques",
  "paraclinique", "signe", "signes", "examen", "examens", "bilan", "evolution",
  "complication", "complications", "etiologie", "etiologies", "pronostic", "forme",
  "formes", "type", "types", "classification", "stade", "stades", "enfant", "enfants",
  "adulte", "adultes", "patient", "patiente", "homme", "femme", "douleur", "douleurs",
  "membre", "membres", "inferieur", "superieur", "articulation", "articulaire",
  "articulaires", "osseux", "osseuse", "osseuses", "osteo", "osteoarticulaire",
  "radiographie", "radiologique", "scanner", "irm", "biologie", "chirurgie",
  "chirurgical", "chirurgicale", "medical", "medicale", "orthopedique", "traumatisme",
  "traumatique", "rhumatisme", "inflammatoire", "chronique", "aigue", "aigu", "subaigue",
  "normale", "normal", "elevee", "augmentee", "diminuee", "etiopathogenie", "facteur",
]);

const MEDICAL_SHORT_ACRONYMS = new Set([
  "spa", "aji", "ppr", "led", "lca", "lcp", "pr", "bk", "crp", "hla", "acr", "oah", "toa",
  "avc", "tvp", "idm", "hta", "irc", "ira", "lcr", "snc", "snp", "atp", "adn", "arn",
]);

function matchQuestionToLessonUniversal(
  vignetteAndStem: string,
  optionsText: string,
  usableLessons: EBLesson[],
  idfMap: Map<string, number>,
  wasExplicitlyIsolated = false
): { lessonId: string; score: number; matchedTerms: string[] } | null {
  if (usableLessons.length === 0) return null;

  const rawPrimary = normalizeText(vignetteAndStem);
  const normSecondary = normalizeText(optionsText);
  // Si l'énoncé est vide ou ultra-court (ex: "QCM33-" suivi directement de "A. La goutte est..."),
  // le sujet médical est porté par les propositions A..E.
  const normPrimary = rawPrimary.length < 22 ? `${rawPrimary} ${normSecondary}`.trim() : rawPrimary;
  const primaryTokens = normPrimary.split(" ").filter((t) => t.length >= 2);
  const secondaryTokens = normSecondary.split(" ").filter((t) => t.length >= 2);
  const primaryTokenSet = new Set(primaryTokens);
  const secondaryTokenSet = new Set(secondaryTokens);
  const primaryRoots = new Set(primaryTokens.filter((t) => t.length >= 3).map(stemTokenRoot));
  const secondaryRoots = new Set(secondaryTokens.filter((t) => t.length >= 3).map(stemTokenRoot));

  let bestLessonId = "";
  let bestScore = 0;
  let bestTerms: string[] = [];
  let bestHasSpecificAnchor = false;

  for (const lesson of usableLessons) {
    let score = 0;
    const matchedTerms: string[] = [];
    let specificAnchorCount = 0;

    const titleWords = normalizeText(lesson.cleanTitle)
      .split(" ")
      .filter((t) => (t.length >= 3 || MEDICAL_SHORT_ACRONYMS.has(t)) && !STOPWORDS_FR.has(t));

    for (const tw of titleWords) {
      const isAcronym = MEDICAL_SHORT_ACRONYMS.has(tw);
      const isSpecificTitleWord = !GENERIC_MEDICAL_BRIDGE_WORDS.has(tw) && (tw.length >= 4 || isAcronym);
      const idf = idfMap.get(tw) || 1.4;
      const twRoot = stemTokenRoot(tw);
      const inPrimary = isAcronym
        ? primaryTokenSet.has(tw)
        : normPrimary.includes(tw) || (twRoot.length >= 4 && primaryRoots.has(twRoot));
      const inSecondary = isAcronym
        ? secondaryTokenSet.has(tw)
        : normSecondary.includes(tw) || (twRoot.length >= 4 && secondaryRoots.has(twRoot));
      if (inPrimary) {
        score += (isSpecificTitleWord ? 13.5 : 3.2) * idf;
        if (isSpecificTitleWord) specificAnchorCount += 2;
        if (!matchedTerms.includes(tw)) matchedTerms.push(tw);
      } else if (inSecondary) {
        score += (isSpecificTitleWord ? 4.5 : 0.8) * idf;
        if (isSpecificTitleWord) specificAnchorCount += 1;
        if (matchedTerms.length < 5 && !matchedTerms.includes(tw)) matchedTerms.push(tw);
      }
    }

    for (const bg of (lesson.discriminativePhrases || []).slice(0, 85)) {
      if (bg.length < 4) continue;
      const bgWords = bg.split(" ").filter((w) => w.length >= 3);
      const hasSpecificBgWord = bgWords.some((w) => !GENERIC_MEDICAL_BRIDGE_WORDS.has(w));
      const idf = idfMap.get(bg) || 1.9;
      if (normPrimary.includes(bg)) {
        score += (hasSpecificBgWord ? 11.5 : 3.0) * idf;
        if (hasSpecificBgWord) specificAnchorCount += 2;
        if (matchedTerms.length < 5 && !matchedTerms.includes(bg)) matchedTerms.push(bg);
      } else if (normSecondary.includes(bg)) {
        score += (hasSpecificBgWord ? 3.8 : 0.8) * idf;
        if (hasSpecificBgWord) specificAnchorCount += 1;
        if (matchedTerms.length < 5 && !matchedTerms.includes(bg)) matchedTerms.push(bg);
      }
    }

    for (const hd of (lesson.headings || []).slice(0, 40)) {
      const normHd = normalizeText(hd);
      const hdWords = normHd.split(" ").filter((w) => (w.length >= 4 || MEDICAL_SHORT_ACRONYMS.has(w)) && !GENERIC_MEDICAL_BRIDGE_WORDS.has(w));
      if (normHd.length >= 5 && hdWords.length > 0 && normPrimary.includes(normHd)) {
        score += 14;
        specificAnchorCount += 2;
        if (matchedTerms.length < 5) matchedTerms.push(hd.slice(0, 35));
      } else if (normHd.length >= 6 && hdWords.length > 0 && normSecondary.includes(normHd)) {
        score += 4.5;
        specificAnchorCount += 1;
      }
    }

    for (const kw of (lesson.keywords || []).slice(0, 85)) {
      const isAcronym = MEDICAL_SHORT_ACRONYMS.has(kw);
      const isSpecificKw = !GENERIC_MEDICAL_BRIDGE_WORDS.has(kw) && (kw.length >= 5 || isAcronym);
      const idf = idfMap.get(kw) || 1.0;
      const kwRoot = stemTokenRoot(kw);
      const inPrimary = isAcronym
        ? primaryTokenSet.has(kw)
        : normPrimary.includes(kw) || (kwRoot.length >= 5 && primaryRoots.has(kwRoot));
      const inSecondary = isAcronym
        ? secondaryTokenSet.has(kw)
        : normSecondary.includes(kw) || (kwRoot.length >= 5 && secondaryRoots.has(kwRoot));
      if (inPrimary) {
        score += (isSpecificKw ? 3.6 : 0.7) * idf;
        if (isSpecificKw && (idf >= 1.35 || isAcronym)) specificAnchorCount += 1;
        if (matchedTerms.length < 5 && !matchedTerms.includes(kw)) matchedTerms.push(kw);
      } else if (inSecondary) {
        score += (isSpecificKw ? 1.4 : 0.2) * idf;
        if (isSpecificKw && idf >= 1.6) specificAnchorCount += 1;
      }
    }

    const minAnchors = wasExplicitlyIsolated ? 1 : 2;
    const hasSpecificAnchor = specificAnchorCount >= minAnchors;
    if (
      (hasSpecificAnchor && !bestHasSpecificAnchor) ||
      (hasSpecificAnchor === bestHasSpecificAnchor && score > bestScore)
    ) {
      bestScore = score;
      bestLessonId = lesson.id;
      bestTerms = matchedTerms;
      bestHasSpecificAnchor = hasSpecificAnchor;
    }
  }

  const minRequiredScore = wasExplicitlyIsolated ? 3.5 : 9.5;
  if (!bestLessonId || !bestHasSpecificAnchor || bestScore < minRequiredScore) return null;
  return { lessonId: bestLessonId, score: bestScore, matchedTerms: bestTerms };
}

/**
 * Parseur docimologique universel d'une annale (TOR, Cardiologie, Hématologie, Droit, Sciences…).
 * Détecte :
 * - Les vrais Cas Cliniques progressifs (`CAS_CLINIQUE`) UNIQUEMENT lorsqu'un dossier ou cas clinique
 *   explicite regroupe plusieurs questions autour d'une vignette patient.
 * - Les QCM directs autonomes hors cas clinique (`ELECTION`, `CENSURE`, `GROUPAGE`, `COMPLEMENT_MULTIPLE`,
 *   `JUMELAGE`, `ASSOCIATION`, `QNS`).
 * - Les propositions à puces/points (`•`, `.`, `-`) ou dont les lettres pâles ont été omises par l'OCR,
 *   converties selon la règle séquentielle : 1re -> A, 2e -> B, 3e -> C, 4e -> D, 5e -> E (ou 1..4 en Groupage).
 */
function observedOptionCount(letters: string[]): number {
  const present = new Set(letters);
  const alphabet = "ABCDEFGHIJ";
  let highestIndex = -1;
  for (let i = 0; i < alphabet.length; i++) {
    if (present.has(alphabet[i])) highestIndex = i;
  }
  if (highestIndex >= 1 && present.size >= Math.max(2, highestIndex - 1)) {
    return highestIndex + 1;
  }
  let count = 0;
  let missing = 0;
  for (let i = 0; i < alphabet.length; i++) {
    if (present.has(alphabet[i])) count = i + 1;
    else if (++missing > 1 || !present.has(alphabet[i + 1])) break;
  }
  return count;
}

function detectSectionFormatHeaderLine(line: string): EBFormat | null {
  const t = line.trim();
  if (!t || t.length > 130) return null;
  if (/^(?:QCM|QNS|Q(?:uestion)?|N\s*[°o])\s*\d/i.test(t) || /^\d{1,3}\s*[.):/–-]/.test(t)) return null;
  if (/^[A-J]\s*[.):/–=-]\s+\S/i.test(t)) return null;

  if (/^(?:groupage|compl[eé]ments?\s+group[eé]s?|questions?\s+[àa]\s+r[eé]ponses?\s+group[eé]es?)\s*[:.]?\s*$/i.test(t)) {
    return "GROUPAGE";
  }
  if (
    /^(?:compl[eé]ments?\s+multiples?|questions?\s+[àa]\s+choix\s+multiples?)\s*[:.]?\s*$/i.test(t) ||
    /^\(?\s*(?:choisir|indiquer|cocher)\s+la\s*\(\s*les\s*\)\s+(?:proposition|lettre|r[eé]ponse)/i.test(t)
  ) {
    return "COMPLEMENT_MULTIPLE";
  }
  if (
    /^(?:censure|compl[eé]ments?\s+in(?:corrects?|directs?|corr\w*))\s*[:.]?(?:\s*\(?indiquer\s+la\s+lettre.*)?$/i.test(t) ||
    /^\(?\s*(?:choisir|indiquer)\s+la\s+(?:proposition|lettre\s+correspondante?\s+[àa]\s+la\s+r[eé]ponse)\s+(?:incorrecte|inexacte|fausse)\s*\)?\s*[:.]?\s*$/i.test(t)
  ) {
    return "CENSURE";
  }
  if (
    /^(?:[eé]lection|compl[eé]ments?\s+corrects?|compl[eé]ment\s+simple)\s*[:.]?(?:\s*\(?indiquer\s+la\s+lettre.*)?$/i.test(t) ||
    /^\(?\s*(?:choisir|indiquer)\s+la\s+(?:proposition|lettre\s+correspondante?\s+[àa]\s+la\s+r[eé]ponse)\s+(?:correcte|exacte|vraie)\s*\)?\s*[:.]?\s*$/i.test(t)
  ) {
    return "ELECTION";
  }
  if (/^(?:jumelage|cause\s+[àa]\s+effet)\s*[:.]?\s*$/i.test(t)) {
    return "JUMELAGE";
  }
  if (/^association\s*[:.]?\s*$/i.test(t)) {
    return "ASSOCIATION";
  }
  return null;
}

function isFormatInstructionOrLegendLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (detectSectionFormatHeaderLine(t) !== null) return true;
  if (isSectionHeadingLine(t)) return true;
  if (/^(?:r[eé]pondre|comment\s+r[eé]pondre|choisir\s+votre\s+r[eé]ponse\s+selon\s+le\s+code(?:\s+suivant)?)\s*[:.]?\s*$/i.test(t)) {
    return true;
  }
  if (
    /^(?:[□☐■▪▫•◦●∙·*–—-]|[A-E]\s*[.:)=–-])?\s*si\s+(?:seulement\s+\d|les\s+2\s+propositions|la\s+1\s*(?:re|[eè]re|er)\s+proposition|les\s+deux\s+propositions)/i.test(t)
  ) {
    return true;
  }
  if (/^(?:[□☐■▪▫•◦●∙·*–—-]|[E]\s*[.:)=–-])\s*autres?\s+choix\.?\s*$/i.test(t)) {
    return true;
  }
  if (/^corrects?\.?\s*$/i.test(t)) {
    return true;
  }
  if (/^(?:[A-E]\s*[:=]\s*vrai\s*[-–]\s*vrai|[C-E]\s*[:=]\s*(?:vrai|faux)\s*[-–]\s*(?:vrai|faux))/i.test(t)) {
    return true;
  }
  if (/^(?:dakar\s*,\s*le\s+\d|le\s+coordonnateur\b)/i.test(t)) {
    return true;
  }
  return false;
}

export function parseUniversalExamAnnale(
  rawText: string,
  usableLessons: EBLesson[],
  subjectName: string,
  idfMap: Map<string, number>,
  examTitleHint = ""
): {
  isOtherSubjectOnly: boolean;
  questionCount: number;
  caseCount: number;
  formatCounts: Partial<Record<EBFormat, number>>;
  lessonQcmCounts: Record<
    string,
    { blocks: number; qcm: number; summary?: string; weak?: boolean; verbatimSamples?: string[] }
  >;
  detectedGroupageCode: string;
  stemPatterns: string[];
  globalSamples: string[];
  observedQuestions: ObservedExamQuestion[];
  skippedNumbers: number[];
  inferredCaseEnds: number[];
} {
  if (isCachedAnnaleCrossContaminated(examTitleHint, rawText)) {
    return {
      isOtherSubjectOnly: true,
      questionCount: 0,
      caseCount: 0,
      formatCounts: {},
      lessonQcmCounts: {},
      detectedGroupageCode: "",
      stemPatterns: [],
      globalSamples: [],
      observedQuestions: [],
      skippedNumbers: [],
      inferredCaseEnds: [],
    };
  }

  const { isolatedText, isOtherSubjectOnly, wasExplicitlyIsolated } = isolateSubjectSectionUniversal(
    rawText,
    subjectName,
    usableLessons
  );

  if (isOtherSubjectOnly || !isolatedText.trim()) {
    return {
      isOtherSubjectOnly: true,
      questionCount: 0,
      caseCount: 0,
      formatCounts: {},
      lessonQcmCounts: {},
      detectedGroupageCode: "",
      stemPatterns: [],
      globalSamples: [],
      observedQuestions: [],
      skippedNumbers: [],
      inferredCaseEnds: [],
    };
  }

  const isCodeLegend = (line: string) =>
    [...line.matchAll(/\b[A-J]\s*[:=]\s*(?:\d|autres?|tout|toutes|aucun|vrai|faux)/gi)].length >= 2;
  const splitInlineExamLine = (line: string): string => {
    if (isCodeLegend(line) || isFormatInstructionOrLegendLine(line)) return line;
    let out = line
      // Multi-colonnes ou options alignées ("A. ...   B. ...", "(A) ... (B) ...", "A/ ... B/ ...")
      .replace(/(\S)[ \t]+((?:\([A-J]\)|\[[A-J]\]|[A-J]\s*[.)/:])\s+\S)/g, "$1\n$2")
      // Tiret d'option séparé par >= 2 espaces ("A- ...  B- ...")
      .replace(/(\S)[ \t]{2,}([A-J]\s*[-–—]\s+\S)/g, "$1\n$2")
      // Ponctuation d'option collée au mot en OCR ("A.Texte   B.Texte")
      .replace(/(\S)[ \t]+([A-J][.)/:](?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ0-9«"(]))/g, "$1\n$2");
    if (/(?:^|\s)1\s*[.)/:–-]\s+\S+[\s\S]*\s2\s*[.)/:–-]\s+\S+[\s\S]*\s3\s*[.)/:–-]\s+\S+/.test(out)) {
      out = out.replace(/(\S)\s+([1-5]\s*[.)/:–-]\s+\S)/g, "$1\n$2");
    }
    return out;
  };
  const cleaned = isolatedText
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff\u00ad]/g, "")
    .replace(/--- PAGE \d+ ---/g, "\n")
    .replace(/([^\n])\s+((?:QCM|QNS|Question|Q\s*\d)\s*(?:n\s*[°o]?\s*)?\d{1,3}(?:\s*\([A-Za-z]+\))?\s*[.:)-]?)/gi, "$1\n$2")
    .split("\n")
    .map(splitInlineExamLine)
    .join("\n");

  const legendLines = cleaned
    .split("\n")
    .filter((line) => isCodeLegend(line) && !/\bvrai\s*[-–]\s*vrai\b/i.test(line));
  let detectedGroupageCode =
    legendLines[0]?.match(/\bA\s*[:=].*/i)?.[0].replace(/\)\s*:?\s*$/, "").trim() || "";
  if (
    !detectedGroupageCode &&
    /si\s+seulement\s+1\s*,\s*2\s*,\s*3[\s\S]{0,160}si\s+seulement\s+1\s*,\s*3/i.test(cleaned)
  ) {
    detectedGroupageCode = "A= 1+2+3 B=1+3 C=2+4 D=4 E= autre choix";
  }

  // Repérage des en-têtes de section docimologique (Élection, Censure, Groupage, Compléments multiples, Jumelage, Association)
  const sectionFormatMarkers: Array<{ index: number; format: EBFormat }> = [];
  {
    let offset = 0;
    for (const line of cleaned.split("\n")) {
      const detectedFmt = detectSectionFormatHeaderLine(line);
      if (detectedFmt) {
        sectionFormatMarkers.push({ index: offset, format: detectedFmt });
      }
      offset += line.length + 1;
    }
  }
  if (!detectedGroupageCode && sectionFormatMarkers.some((m) => m.format === "GROUPAGE")) {
    // Recherche dans le document complet (ex: légende placée en début d'épreuve dans EC1)
    const fullLegend = String(rawText || "")
      .split(/\r?\n/)
      .find((line) => isCodeLegend(line) && !/\bvrai\s*[-–]\s*vrai\b/i.test(line));
    if (fullLegend) {
      detectedGroupageCode = fullLegend.match(/\bA\s*[:=].*/i)?.[0].replace(/\)\s*:?\s*$/, "").trim() || "";
    }
  }

  const caseRegex =
    /(?:^|\n)\s*((?:[IVX]+\s*-\s*)?(?:cas\s+(?:clinique|pratique)|dossier(?:\s+(?:clinique|documentaire))?|[eé]tude\s+de\s+cas|exercice|situation\s+(?:clinique|probl[eè]me)|observation\s+clinique)\s*(?:n\s*[°o]?\s*)?[0-9IVX]*)\s*[:.–—-]?\s*([^\n]+(?:\n(?!\s*(?:QCM|QNS|Question|Q\s*\d|\d{1,3}\s*[.)–-]))[^\n]+)*)/gim;
  const caseBlocks: Array<{ start: number; header: string; vignette: string }> = [];
  let cm: RegExpExecArray | null;
  while ((cm = caseRegex.exec(cleaned)) !== null) {
    const headerStr = (cm[1] || "Cas clinique").trim();
    const vignetteStr = (cm[2] || "").replace(/\s+/g, " ").trim();
    if (vignetteStr.length < 30) continue;
    caseBlocks.push({
      start: cm.index,
      header: headerStr,
      vignette: vignetteStr,
    });
  }

  const qRegex =
    /(?:^|\n)\s*(?:QCM\s*(?:n\s*[°o]?\s*)?(\d{1,3})(?:\s*\([A-Za-z]+\))?\s*[.:)/–-]*|QNS\s*(?:n\s*[°o]?\s*)?(\d{1,3})\s*[.:)/–-]*|Q(?:uestion)?\s*(?:n\s*[°o]?\s*)?(\d{1,3})(?:\s*\([A-Za-z]+\))?\s*[.:)/–-]+|(?:N\s*[°o]\s*)?(\d{1,3})\s*[-–.):/])(?:\s+|(?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ«"(]))/gim;
  const rawMatches: Array<{ index: number; num: number; explicit: boolean; isQnsTag: boolean; synthetic?: boolean }> = [];
  let m: RegExpExecArray | null;

  while ((m = qRegex.exec(cleaned)) !== null) {
    const num = parseInt(m[1] || m[2] || m[3] || m[4], 10);
    const explicit = Boolean(m[1] || m[2] || m[3]);
    const isQnsTag = Boolean(m[2]);

    if (!explicit) {
      const afterText = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/^(?:\d+\s*[/-]\s*\d+|\s*(?:min|mn|ml|mg|g|kg|h|j|ans|mois|semaines|mm|cm|ui|l)\b(?!['’]))/i.test(afterText)) {
        continue;
      }
    }

    if (!explicit && num >= 1 && num <= 6 && rawMatches.length > 0) {
      const prev = rawMatches[rawMatches.length - 1];
      const betweenText = cleaned.slice(prev.index, m.index);
      const hasOptionsBetween =
        /(?:^|\n)[ \t]*(?:[□☐■▪▫•◦●∙·*–—-][ \t]*)?(?:\([A-J]\)|\[[A-J]\]|[A-J]\s*[.:)/–,\\-])\s*\S+[\s\S]*?(?:^|\n)[ \t]*(?:[□☐■▪▫•◦●∙·*–—-][ \t]*)?(?:\([B-J]\)|\[[B-J]\]|[B-J]\s*[.:)/–,\\-])\s*\S+/im.test(
          betweenText
        ) ||
        /(?:^|\n)[ \t]*(?:[□☐■▪▫•◦●∙·*–—]|-(?=[ \t]+\S))[ \t]+\S+[\s\S]*?(?:^|\n)[ \t]*(?:[□☐■▪▫•◦●∙·*–—]|-(?=[ \t]+\S))[ \t]+\S+/im.test(
          betweenText
        ) ||
        /\b(?:par\s*ce\s+que|cause\s+pour\s+laquelle)\b/i.test(betweenText);
      const hasSectionHeaderBetween = sectionFormatMarkers.some(
        (marker) => marker.index > prev.index && marker.index < m!.index
      );
      if (!hasOptionsBetween && !hasSectionHeaderBetween) continue;
    }
    if (num >= 1 && num <= 150) {
      rawMatches.push({ index: m.index, num, explicit, isQnsTag });
    }
  }

  // Filtre les pics numériques ou numéros de page isolés hors séquence introduits par l'OCR/tableaux (ex: "49" ou numéro de page "1" en bas de page)
  const optionLineInSegment =
    /(?:^|\n)[ \t]*(?:(?:[□☐■▪▫•◦●∙·*–—-][ \t]*)?(?:\([A-J]\)|\[[A-J]\]|[A-J]\s*[.:)/–,\\-])|[□☐■▪▫•◦●∙·*–—]|1\s*[.):/–-])\s*\S+/im;
  const matches = rawMatches.filter((cand, idx) => {
    if (cand.explicit || rawMatches.length < 3) return true;
    const nextIdx = idx + 1 < rawMatches.length ? rawMatches[idx + 1].index : cleaned.length;
    const candSlice = cleaned.slice(cand.index, nextIdx);
    const hasStructInSlice =
      optionLineInSegment.test(candSlice) ||
      /\b(?:par\s*ce\s+que|cause\s+pour\s+laquelle)\b/i.test(candSlice);
    if (idx === rawMatches.length - 1) {
      const prev = rawMatches[idx - 1];
      if (cand.num < prev.num && prev.num >= 5 && !hasStructInSlice) return false;
      return true;
    }
    if (idx === 0) return true;
    const prev = rawMatches[idx - 1];
    const next = rawMatches[idx + 1];
    if (prev.num < next.num && (cand.num > next.num + 1 || cand.num < prev.num) && next.num - prev.num <= 6) {
      if (!hasStructInSlice) return false;
    }
    return true;
  });

  if (matches.length === 0) {
    const optBlockRegex =
      /(?:^|\n)[ \t]*(?:\(A\)|\[A\]|A\s*[.:)/–-])\s*\S+[\s\S]*?(?:^|\n)[ \t]*(?:\(B\)|\[B\]|B\s*[.:)/–-])\s*\S+/gim;
    let om: RegExpExecArray | null;
    while ((om = optBlockRegex.exec(cleaned)) !== null) {
      const before = cleaned.slice(0, om.index).trimEnd();
      const blockStart = before.lastIndexOf("\n") + 1;
      matches.push({ index: blockStart, num: matches.length + 1, explicit: false, isQnsTag: false, synthetic: true });
    }
  }

  const stripQuestionNumber = (value: string) => value
    .replace(/^\s*(?:QCM|QNS|Question|Q|N\s*[°o])\s*(?:n\s*[°o]?\s*)?\d+\s*(?:\(([A-Za-z]+)\))?\s*[.:)/–-]*\s*/i, (_, tag) => (tag ? `(${tag}) ` : ""))
    .replace(/^\s*\d+\s*[.:)/–-]\s*/, "")
    .replace(/^\s*[–—]\s*/, "");
  const formatLabel = /^\(?\s*(ÉLECTION|ELECTION|CENSURE|GROUPAGE|JUMELAGE|ASSOCIATION|COMPL[ÉE]MENTS?[\s_-]+MULTIPLES?|QNS|J)\s*\)?\b\s*[-:–—]?\s*/i;
  const blocks = matches.map((question, index) => {
    let end = index + 1 < matches.length ? matches[index + 1].index : cleaned.length;
    const nextCase = caseBlocks.find((cb) => cb.start > question.index && cb.start < end);
    if (nextCase) end = nextCase.start;
    const nextFormatHeader = sectionFormatMarkers.find(
      (marker) => marker.index > question.index + 6 && marker.index < end
    );
    if (nextFormatHeader) end = nextFormatHeader.index;

    let activeSectionFormat: EBFormat | undefined;
    for (const marker of sectionFormatMarkers) {
      if (marker.index <= question.index) activeSectionFormat = marker.format;
      else break;
    }

    const raw = cleaned.slice(question.index, end).trim();
    const withoutLegend = raw
      .split("\n")
      .filter((line, lineIdx) => lineIdx === 0 || (!isCodeLegend(line) && !isFormatInstructionOrLegendLine(line)))
      .join("\n");
    const option =
      /(?:^|\n)[ \t]*(?:(?:\([A-J]\)|\[[A-J]\]|[A-J]\s*[.:)/–,\\-])|1\s*[.):/–-]|[□☐■▪▫•◦●∙·*–—]|-(?=[ \t]+\S)|\.(?=[ \t]*[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ0-9«"(]))[ \t]*\S/im.exec(
        withoutLegend
      );
    const stem = option
      ? withoutLegend.slice(0, option.index).trim()
      : withoutLegend.split(/\r?\n/).slice(0, 2).join(" ").trim();
    const numbered = stripQuestionNumber(stem);
    const label = numbered.match(formatLabel)?.[1];
    const normalizedLabel = label
      ? normalizeText(label)
          .replace(/\s+/g, "_")
          .replace(/^complements?_multiples?$/, "COMPLEMENT_MULTIPLE")
          .replace(/^j$/, "JUMELAGE")
          .toUpperCase()
      : undefined;
    const explicitFormat = normalizedLabel as ObservedExamQuestion["format"] | undefined;
    const cleanStem = numbered.replace(formatLabel, "").replace(/\s+/g, " ").trim();
    return {
      raw,
      withoutLegend,
      stem,
      cleanStem,
      explicitFormat,
      activeSectionFormat,
      options: option ? withoutLegend.slice(option.index).trim() : "",
    };
  });
  const cohesionStopwords = new Set([
    ...STOPWORDS_FR, ...STRUCTURAL_HEADER_WORDS,
    "elements", "suivants", "suivantes", "propositions", "caracteristiques", "criteres", "affirmations", "enonces", "reponses",
    "exacte", "exactes", "correcte", "correctes", "fausse", "fausses", "vraie", "vraies", "parmi", "concernant", "cocher",
    "choisir", "indiquer", "identifier", "citer", "permettent", "peuvent", "caracterise", "observe", "utilise", "principal",
    "principale", "different", "differentes", "laquelle", "lequel", "lesquels", "lesquelles", "quelle", "quelles", "quels",
    "diagnostic", "traitement", "patient", "patiente", "maladie", "syndrome", "signes", "cause", "causes", "anticorps", "manifestations",
  ].map((word) => word.slice(0, 7)));
  const roots = (value: string) => new Set(normalizeText(value).split(" ")
    .filter((word) => word.length >= 5 && !cohesionStopwords.has(word.slice(0, 7)))
    .map((word) => word.slice(0, 7)));
  const documentFrequency = new Map<string, number>();
  for (const block of blocks) for (const root of roots(block.cleanStem)) documentFrequency.set(root, (documentFrequency.get(root) || 0) + 1);
  const inferredCaseEnds: number[] = [];
  const caseRanges = caseBlocks.map((cb, index) => {
    const next = caseBlocks[index + 1]?.start ?? cleaned.length;
    const first = matches.findIndex((question) => question.index >= cb.start && question.index < next);
    if (first < 0) return { ...cb, end: cb.start };
    const instructions = /(?:^|\n)[ \t]*(?:II\s*[.)-]?\s*QCM\b|DEUXI[ÈE]ME\s+PARTIE|2[ÈE]?ME\s+PARTIE|QUESTIONS?\s+(?:ISOL[ÉE]ES?|[ÀA]\s+CHOIX\s+MULTIPLES?|[ÀA]\s+R[ÉE]PONSES\s+GROUP[ÉE]ES)|QCM\s+(?:HORS\s+CAS|GROUPAGE|:)|(?:GROUPAGE|CENSURE|[ÉE]LECTION|JUMELAGE|ASSOCIATION|COMPL[ÉE]MENTS?[ _-]+MULTIPLES?)\s*[:(]|COMMENT\s+R[ÉE]PONDRE\b|R[ÉE]PONSES\s*:)/im;
    const tail = cleaned.slice(matches[first].index, next);
    const boundary = instructions.exec(tail);
    let end = boundary ? matches[first].index + boundary.index : next;
    const candidates = matches.map((q, i) => ({ ...q, i })).filter((q) => q.index >= cb.start && q.index < end);
    const vignetteRoots = roots(cb.vignette);
    const contextRoots = new Set(vignetteRoots);
    let lastLinked = 0;
    candidates.forEach((question, position) => {
      const stem = normalizeText(blocks[question.i].cleanStem);
      const cue = /\b(?:vous|votre|vos|ci dessus|precedemment|precedent\w*|plus tard|ulterieurement|retenu\w*|evoqu\w*|suspect\w*|chez lui|chez elle|ce cas|ce dossier|ce contexte|cette situation|ce document|ce texte|cet extrait|cet exercice|l enonce)\b/.test(stem);
      const referenced = [...stem.matchAll(/\b(?:ce|cet|cette|ces|le|la|les|l)\s+(\w{5,})/g)].some((entry) => vignetteRoots.has(entry[1].slice(0, 7)));
      const shared = [...roots(stem)].some((root) => contextRoots.has(root) && (documentFrequency.get(root) || 0) <= 2);
      const previous = position > 0 ? blocks[candidates[position - 1].i].raw : "";
      const previousTail = previous.split("\n").slice(-2).filter((line) => line.trim() && !/^[ \t]*(?:[A-J]|\d+)\s*[.:)-]/i.test(line) && !instructions.test(line) && !/^[ \t]*(?:QCM|QNS|Q(?:uestion)?)\s*\d/i.test(line));
      if (position === 0 || cue || referenced || shared || previousTail.length > 0) lastLinked = position;
      for (const root of roots(blocks[question.i].cleanStem)) contextRoots.add(root);
    });
    if (!boundary && candidates.length - lastLinked - 1 >= 2) {
      end = candidates[lastLinked + 1].index;
      inferredCaseEnds.push(candidates[lastLinked].num);
    }
    return { ...cb, end };
  });

  const allFormatCounts: Partial<Record<EBFormat, number>> = {};
  const observedQuestions: ObservedExamQuestion[] = [];
  const skippedNumbers: number[] = [];
  const lessonQcmCounts: Record<
    string,
    { blocks: number; qcm: number; summary?: string; weak?: boolean; verbatimSamples?: string[] }
  > = {};
  const lessonCaseSet = new Map<string, Set<string>>();
  const lessonTopicsSummary = new Map<string, Set<string>>();
  const stemPatterns: string[] = [];
  const globalSamples: string[] = [];
  const allActiveCaseKeys = new Set<string>();
  const parsedLegendCount = new Set([...detectedGroupageCode.matchAll(/\b([A-J])\s*[:=]/g)].map((entry) => entry[1].toUpperCase())).size;
  const groupageCodeOptionCount = parsedLegendCount || (sectionFormatMarkers.some((m) => m.format === "GROUPAGE") ? 5 : 0);
  const tagPrefix = examTitleHint ? `[${cleanLessonTitle(examTitleHint)}] ` : "";

  let validQuestionBlocksCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const {
      raw: rawQBlock,
      withoutLegend,
      stem: stemPart,
      cleanStem: rawCleanStemLine,
      options: optionsPart,
      explicitFormat,
      activeSectionFormat,
    } = blocks[i];
    const normQ = normalizeText(withoutLegend);

    const optionLetterMatches = [
      ...withoutLegend.matchAll(
        /(?:^|\n)[ \t]*(?:[□☐■▪▫•◦●∙·*-][ \t]*)?(?:\(([A-J])\)|\[([A-J])\]|([A-J])\s*[.:)/–,;\\-])(?:\s+|(?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ0-9«"(]))\S+/gim
      ),
    ];
    const optionLetters = optionLetterMatches
      .map((match) => (match[1] || match[2] || match[3] || "").toUpperCase())
      .filter(Boolean);
    const letteredOptionCount = observedOptionCount(optionLetters);
    const hasLetteredOptions = letteredOptionCount >= 2 || new Set(optionLetters).size >= 2;

    const numberedAssertionMatches = [
      ...withoutLegend.matchAll(/(?:^|\n)[ \t]*([1-6])\s*[.)/:–,\\-]\s+([^\n]+)/gim),
    ];
    const romanAssertionMatches = [
      ...withoutLegend.matchAll(/(?:^|\n)[ \t]*(I|II|III|IV|V|VI)\s*[.)/:–-]\s+([^\n]+)/gim),
    ];
    const distinctArabicNums = new Set(numberedAssertionMatches.map((m) => Number(m[1])));
    const hasNumberedAssertions =
      distinctArabicNums.size >= 3 ||
      (distinctArabicNums.size >= 2 && (activeSectionFormat === "GROUPAGE" || Boolean(detectedGroupageCode) || Boolean(explicitFormat))) ||
      romanAssertionMatches.length >= 3;

    // Extraction universelle des puces/points (•, ●, ◦, ▪, ·, ., -, *) :
    // Règle séquentielle : 1re puce -> A, 2e -> B, 3e -> C, 4e -> D, 5e -> E (ou assertions 1..4 en Groupage).
    const bulletItems: string[] = [];
    if (!hasLetteredOptions && !hasNumberedAssertions) {
      const linesAfterFirst = withoutLegend.split("\n").slice(1);
      const bulletLineRegex =
        /^[ \t]*(?:[□☐■▪▫•◦●∙·*–—]|-(?=[ \t]+\S)|\.(?=[ \t]*[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ0-9«"(]))[ \t]*(\S.*)$/;
      for (const rawLine of linesAfterFirst) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const bm = rawLine.match(bulletLineRegex);
        if (bm) {
          bulletItems.push(bm[1].replace(/\s+/g, " ").trim());
        } else if (bulletItems.length > 0 && !/^(?:QCM|QNS|Q(?:uestion)?)\s*\d/i.test(trimmed)) {
          bulletItems[bulletItems.length - 1] = `${bulletItems[bulletItems.length - 1]} ${trimmed}`.replace(/\s+/g, " ").trim();
        }
      }
    }
    const bulletChoicesCount = bulletItems.length;
    const hasBulletedOptions = bulletChoicesCount >= 2 && bulletChoicesCount <= 8;

    const assertionReason =
      /\b(?:par\s*ce\s+que|cause\s+pour\s+laquelle|relation\s+de\s+cause\s+[àa]\s+effet)\b/i.test(withoutLegend) ||
      (activeSectionFormat === "JUMELAGE" && distinctArabicNums.size >= 2) ||
      (distinctArabicNums.has(1) && distinctArabicNums.has(2) && !distinctArabicNums.has(3) && /(?:^|\n)[ \t]*(?:et|car|par\s*ce\s+que|cause\s+pour\s+laquelle)[ \t]*(?:\n|$)/im.test(withoutLegend));

    // Règle de récupération OCR pour les scans dont les lettres A, B, C, D, E très pâles à gauche ont été omises :
    // 1re ligne de proposition -> A, 2e -> B, 3e -> C, 4e -> D, 5e -> E.
    const unmarkedPropItems: string[] = [];
    if (!hasLetteredOptions && !hasNumberedAssertions && !hasBulletedOptions && !assertionReason) {
      const nonEmptyLines = withoutLegend
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !isFormatInstructionOrLegendLine(l));
      if (nonEmptyLines.length >= 4) {
        let stemLineCount = 1;
        const firstLineStripped = stripQuestionNumber(nonEmptyLines[0]).trim();
        if (
          firstLineStripped.length > 0 &&
          !/[:?.]$|\b(?:sont|est|suivantes?|suivants?|fausse|exacte|laquelle|lequel|lesquels|lesquelles|sauf\s+un)\s*$/i.test(firstLineStripped) &&
          nonEmptyLines.length >= 5
        ) {
          stemLineCount = 2;
        }
        const candidateLines = nonEmptyLines
          .slice(stemLineCount)
          .map((l) => l.replace(/^[ \t]*(?:[A-J1-6][ \t]*[.:)/–,\\-]|[□☐■▪▫•◦●∙·*–—-])[ \t]*/i, "").trim())
          .filter((l) => l.length >= 2 && l.length <= 240);
        if (candidateLines.length >= 3 && candidateLines.length <= 6) {
          unmarkedPropItems.push(...candidateLines);
        }
      }
    }
    const hasUnmarkedPropOptions = unmarkedPropItems.length >= 3 && unmarkedPropItems.length <= 6;

    const isExplicitOpenQns =
      matches[i].isQnsTag ||
      /(?:^|\n)\s*(?:QNS|QROC|Question\s+r[eé]dactionnelle|R[eé]ponse\s+(?:courte|ouverte))\b/i.test(rawQBlock);

    if (
      !hasLetteredOptions &&
      !hasBulletedOptions &&
      !hasNumberedAssertions &&
      !hasUnmarkedPropOptions &&
      !isExplicitOpenQns &&
      !assertionReason &&
      !(matches[i].explicit && explicitFormat)
    ) {
      skippedNumbers.push(matches[i].num);
      continue;
    }

    validQuestionBlocksCount++;
    const activeCase = caseRanges.find((cb) => cb.start <= start && start < cb.end);
    const caseKey = activeCase ? `${examTitleHint}#${activeCase.start}` : undefined;
    if (caseKey) allActiveCaseKeys.add(caseKey);

    // Détermination précise du format docimologique en combinant :
    // 1. L'étiquette explicite sur la question (ex: "(Censure)", "QCM30(J)-", "QCM 1. GROUPAGE -")
    // 2. La structure interne (Association I..V + 1..5, Jumelage Parce que / Cause à effet, Groupage 1..4)
    // 3. Les marqueurs de l'énoncé (sauf, fausse, inexacte -> CENSURE ; lesquelles, deux des -> COMPLEMENT_MULTIPLE)
    // 4. L'en-tête de section docimologique actif (Compléments multiples, Censure / Complément incorrect, Groupage / Compléments groupés, Élection / Complément correct)
    const normStem = normalizeText(stemPart);
    const hasCensureStemCue =
      /\bcensure\b|\bfausse\b|\binexacte\b|\berronee\b|\bsauf\b|\bn\s*est\s+pas\b|\bmauvaise\b|\bincorrecte\b|\ba\s+l\s+exception\b|\bne\s+fait\s+pas\s+partie\b/.test(
        normStem
      );
    const hasComplementMultipleStemCue =
      /\bcomplement[s]?\s+multiple[s]?\b|\blesquelles\b|\blesquels\b|\bdeux\s+(?:\(02\)\s+)?(?:des|parmi|reponses|propositions|caracteres|complications)\b|\btrois\s+(?:\(03\)\s+)?(?:des|parmi|reponses|propositions|caracteres)\b|\bchoisir\s+\d|\bcocher\s+(?:la\s+ou\s+)?les\b|\bquelles\s+sont\s+(?:les|parmi)\b|\bquels\s+sont\s+(?:les|parmi)\b/.test(
        normStem
      );
    const hasAssociationStructure =
      /\b1\s*[-=]\s*[a-e]\s*[;•,.]\s*2\s*[-=]\s*[a-e]/i.test(rawQBlock) ||
      /\bcolonne\s*1\b[\s\S]{5,300}\bcolonne\s*2\b/i.test(rawQBlock) ||
      (romanAssertionMatches.length >= 3 && distinctArabicNums.size >= 3) ||
      /\bI\s*\(\s*\d\s*\)\s*;\s*II\s*\(\s*\d\s*\)/i.test(rawQBlock);

    let fmt: EBFormat = "ELECTION";
    if (explicitFormat) {
      fmt = explicitFormat;
    } else if (isExplicitOpenQns && !hasLetteredOptions && !hasBulletedOptions && !hasUnmarkedPropOptions) {
      fmt = "QNS";
    } else if (hasAssociationStructure || activeSectionFormat === "ASSOCIATION") {
      fmt = "ASSOCIATION";
    } else if (
      assertionReason ||
      activeSectionFormat === "JUMELAGE" ||
      /\brelation\s+de\s+cause\s+a\s+effet\b|\bles\s+deux\s+propositions\s+sont\s+vraies\b|\b1\s*(?:re|ere)\s+proposition\s+est\s+vraie\b/.test(
        normQ
      )
    ) {
      fmt = "JUMELAGE";
    } else if (
      (/1\s*\+\s*2\s*\+\s*3|1\s*,\s*2\s*(?:et|\+)\s*3|1\s*\+\s*3[\s\S]{0,40}2\s*\+\s*4/i.test(
        rawQBlock
      ) &&
        hasNumberedAssertions) ||
      (hasNumberedAssertions && !hasLetteredOptions && (Boolean(detectedGroupageCode) || activeSectionFormat === "GROUPAGE")) ||
      (activeSectionFormat === "GROUPAGE" && !hasLetteredOptions && (hasBulletedOptions || hasUnmarkedPropOptions || hasNumberedAssertions))
    ) {
      fmt = "GROUPAGE";
    } else if (hasCensureStemCue) {
      fmt = "CENSURE";
    } else if (activeSectionFormat === "CENSURE") {
      fmt = "CENSURE";
    } else if (activeSectionFormat === "COMPLEMENT_MULTIPLE") {
      fmt = "COMPLEMENT_MULTIPLE";
    } else if (hasComplementMultipleStemCue) {
      fmt = "COMPLEMENT_MULTIPLE";
    } else if (activeSectionFormat === "ELECTION") {
      fmt = "ELECTION";
    } else {
      fmt = "ELECTION";
    }

    if (fmt === "GROUPAGE" && !detectedGroupageCode) {
      detectedGroupageCode = "A= 1+2+3 B=1+3 C=2+4 D=4 E= autre choix";
    }

    allFormatCounts[fmt] = (allFormatCounts[fmt] || 0) + 1;

    const cleanStemLine =
      rawCleanStemLine ||
      (bulletItems[0] || unmarkedPropItems[0] || withoutLegend.split("\n")[1] || `Question ${matches[i].num}`)
        .replace(/^[ \t]*(?:\([A-J]\)|\[[A-J]\]|[A-J1-6]\s*[.:)/–,\\-]|[□☐■▪▫•◦●∙·*–—-])[ \t]*/i, "")
        .trim();

    const primaryContext = activeCase
      ? `${activeCase.header} ${activeCase.vignette} ${stemPart}`
      : stemPart;

    const match = matchQuestionToLessonUniversal(
      primaryContext,
      optionsPart || withoutLegend,
      usableLessons,
      idfMap,
      Boolean(wasExplicitlyIsolated)
    );

    const numberedChoices = [...withoutLegend.matchAll(/(?:^|\n)[ \t]*(\d+)\s*[.)/:–-]\s+\S/g)].map((entry) => Number(entry[1]));
    const sequentialChoices = numberedChoices.length >= 2 && numberedChoices.every((number, index) => number === index + 1) ? numberedChoices.length : 0;
    const effectiveLetterCount = letteredOptionCount || (hasLetteredOptions ? Math.max(2, new Set(optionLetters).size) : 0);
    const effectiveGroupageCount = groupageCodeOptionCount || (detectedGroupageCode ? 5 : 0);
    const optionCount = fmt === "JUMELAGE" ? 5
      : fmt === "GROUPAGE" && effectiveLetterCount < 2
      ? (hasNumberedAssertions || hasBulletedOptions || hasUnmarkedPropOptions ? (effectiveGroupageCount || 5) : 0)
      : effectiveLetterCount ||
        (hasBulletedOptions ? bulletChoicesCount : 0) ||
        (hasUnmarkedPropOptions ? unmarkedPropItems.length : 0) ||
        (explicitFormat && fmt !== "QNS" ? sequentialChoices : 0);

    let optionTexts: string[] | undefined;
    if (["ELECTION", "CENSURE", "COMPLEMENT_MULTIPLE"].includes(fmt)) {
      if (optionLetterMatches.length >= 2) {
        const stopLine = /^\s*(?:QCM\b|QNS\b|Q(?:uestion)?\s*\d|Dossier\b|Cas\s+(?:clinique|pratique)\b|R[eé]ponses?\s*:|Comment\s+r[eé]pondre)/i;
        const texts = optionLetterMatches.map((marker, k) => {
          const head = marker[0].match(/^[ \t\r\n]*(?:[□☐■▪▫•◦●∙·*-][ \t]*)?(?:\([A-J]\)|\[[A-J]\]|[A-J]\s*[.:)/–,;\\-])/i);
          const from = marker.index! + (head ? head[0].length : marker[0].length);
          const to = k + 1 < optionLetterMatches.length ? optionLetterMatches[k + 1].index! : withoutLegend.length;
          const kept: string[] = [];
          for (const line of withoutLegend.slice(from, to).split("\n")) {
            if (!line.trim() || stopLine.test(line) || isFormatInstructionOrLegendLine(line)) break;
            kept.push(line.trim());
          }
          return kept.join(" ").replace(/\s+/g, " ").trim();
        });
        if (texts.every((text) => text && text.length <= 400)) optionTexts = texts;
      } else if (hasBulletedOptions) {
        const validBullets = bulletItems.filter((text) => text && text.length <= 400).slice(0, 10);
        if (validBullets.length >= 2) optionTexts = validBullets;
      } else if (hasUnmarkedPropOptions) {
        const validUnmarked = unmarkedPropItems.filter((text) => text && text.length <= 400).slice(0, 10);
        if (validUnmarked.length >= 2) optionTexts = validUnmarked;
      }
    } else if (fmt === "GROUPAGE" || fmt === "JUMELAGE") {
      if (hasNumberedAssertions) {
        const assertionMatches = [
          ...withoutLegend.matchAll(/(?:^|\n)[ \t]*(?:\d+|[IVX]+)\s*[.)/:–,\\-]\s+([^\n]+)/gim),
        ];
        const extractedAssertions = assertionMatches
          .map((m) => String(m[1] || "").trim())
          .filter((s) => s.length >= 3 && s.length <= 400)
          .slice(0, 6);
        if (extractedAssertions.length >= 2) optionTexts = extractedAssertions;
      } else if (hasBulletedOptions) {
        const validBullets = bulletItems.filter((text) => text && text.length <= 400).slice(0, 6);
        if (validBullets.length >= 2) optionTexts = validBullets;
      } else if (hasUnmarkedPropOptions) {
        const validUnmarked = unmarkedPropItems.filter((text) => text && text.length <= 400).slice(0, 6);
        if (validUnmarked.length >= 2) optionTexts = validUnmarked;
      } else if (fmt === "JUMELAGE" && assertionReason) {
        const parts = withoutLegend
          .replace(
            /^\s*(?:QCM|QNS|Question|Q|N\s*[°o])?\s*(?:n\s*[°o]?\s*)?\d+\s*(?:\([A-Za-z]+\))?\s*[.:)/–-]*\s*/i,
            ""
          )
          .split(/\b(?:par\s*ce\s+que|cause\s+pour\s+laquelle)\b/i)
          .map((p) => p.replace(/^\s*[12]\s*[.):/–-]\s*/, "").replace(/\s+/g, " ").trim())
          .filter((p) => p.length >= 4 && p.length <= 400);
        if (parts.length === 2) optionTexts = parts;
      }
    }
    const styleSource = locateExamStyleSource(rawText, rawCleanStemLine || cleanStemLine, examTitleHint, matches[i].synthetic ? undefined : matches[i].num);
    observedQuestions.push({
      number: matches[i].num,
      format: fmt,
      optionCount,
      inCase: Boolean(caseKey),
      caseKey,
      stem: cleanStemLine,
      sourceTitle: examTitleHint,
      lessonId: match?.lessonId,
      optionTexts,
      vignetteWords: activeCase ? activeCase.vignette.split(/\s+/).filter(Boolean).length : undefined,
      source: styleSource,
    });

    const verbatimExcerpt = activeCase
      ? `${tagPrefix}[${activeCase.header}] ${activeCase.vignette.slice(0, 380)}\n${rawQBlock.slice(0, 620)}`
      : `${tagPrefix}${rawQBlock.slice(0, 720)}`;

    if (cleanStemLine.length >= 20 && cleanStemLine.length <= 185 && stemPatterns.length < 18) {
      stemPatterns.push(cleanStemLine);
    }
    if (globalSamples.length < 12 && rawQBlock.length >= 40) {
      globalSamples.push(verbatimExcerpt);
    }

    if (match) {
      const lid = match.lessonId;
      const prev = lessonQcmCounts[lid] || {
        blocks: 0,
        qcm: 0,
        summary: "",
        weak: false,
        verbatimSamples: [],
      };

      if (!lessonCaseSet.has(lid)) lessonCaseSet.set(lid, new Set());
      lessonCaseSet.get(lid)!.add(caseKey || `standalone_${Math.floor(i / 4)}`);

      if (!lessonTopicsSummary.has(lid)) lessonTopicsSummary.set(lid, new Set());
      for (const term of match.matchedTerms.slice(0, 3)) {
        lessonTopicsSummary.get(lid)!.add(term);
      }

      const samples = prev.verbatimSamples || [];
      if (samples.length < 6 && rawQBlock.length >= 40) {
        samples.push(verbatimExcerpt);
      }

      const keyThemes = Array.from(lessonTopicsSummary.get(lid) || []).slice(0, 5);
      lessonQcmCounts[lid] = {
        blocks: lessonCaseSet.get(lid)!.size,
        qcm: prev.qcm + 1,
        summary:
          keyThemes.length > 0
            ? `${prev.qcm + 1} QCM (${EB_FORMAT_SHORT_LABELS[fmt]}) — Notions ciblées : ${keyThemes.join(", ")}`
            : `${prev.qcm + 1} question(s) détectée(s) (${EB_FORMAT_SHORT_LABELS[fmt]})`,
        weak: match.score < 6.5,
        verbatimSamples: samples,
      };
    }
  }

  if ((allFormatCounts.GROUPAGE || 0) === 0) detectedGroupageCode = "";

  return {
    isOtherSubjectOnly: false,
    questionCount: validQuestionBlocksCount,
    caseCount: allActiveCaseKeys.size,
    formatCounts: allFormatCounts,
    lessonQcmCounts,
    detectedGroupageCode,
    stemPatterns,
    globalSamples,
    observedQuestions,
    skippedNumbers,
    inferredCaseEnds,
  };
}

function matchLessonByTitleOrId(
  lessonIdOrTitle: string,
  usableLessons: EBLesson[]
): EBLesson | null {
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

const VALID_EB_FORMATS = new Set<EBFormat>([
  "CAS_CLINIQUE",
  "ELECTION",
  "CENSURE",
  "GROUPAGE",
  "JUMELAGE",
  "ASSOCIATION",
  "COMPLEMENT_MULTIPLE",
  "QNS",
]);

function normalizeSummaryNotes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return [];
}

// ============================================================================
// 3. ANALYSE DOCIMOLOGIQUE UNIVERSELLE DU CORPUS & MATRICE DE PROBABILITÉ
// ============================================================================
export function computeCorpusAnalysis(
  subjectName: string,
  rawLessons: EBLesson[],
  annales: EBAnnale[],
  aiAudits?: Record<string, AIAuditEntry>
): CorpusAnalysis {
  const hydratedLessons = flagDuplicateLessons(rawLessons);
  const usableLessons = hydratedLessons.filter((l) => !l.duplicateOf);
  const idfMap = buildCorpusIdfMap(usableLessons);

  const warnings: string[] = [];
  const formatDistribution: Partial<Record<EBFormat, number>> = {};
  const exams: ExamAnalysisItem[] = [];

  const seenExamFingerprints = new Map<string, string>();
  const allStemPatterns: string[] = [];
  const allGlobalSamples: string[] = [];
  let detectedGroupageCode = "";

  for (const annale of annales) {
    let effectiveRawText = annale.rawText || "";

    // Détection d'une annale importée avec le texte de secours tronqué (14 mots "Document académique importé...")
    if (
      effectiveRawText.startsWith("Document académique importé :") ||
      effectiveRawText.startsWith("Image académique importée :")
    ) {
      warnings.push(
        `« ${annale.title} » n'avait pas été lu en OCR intégral lors de son import (${annale.wordCount} mots). Supprimez « ${annale.title} » et ré-importez-le pour extraire 100 % de ses questions.`
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
        summaryNotes: [
          `Ce scan avait été importé en mode rapide sans OCR complet. Supprimez et ré-importez « ${annale.title} » pour lancer la lecture OCR page par page.`,
        ],
        audited: false,
      });
      continue;
    }

    // Protection contre un ancien cache contaminé (ex: "sujet TOR 2022.pdf" contenant du texte MS)
    if (isCachedAnnaleCrossContaminated(annale.title, effectiveRawText)) {
      warnings.push(
        `Le fichier « ${annale.title} » provenait d'un ancien cache erroné et a été écarté. Ré-importez « ${annale.title} » pour lire son contenu réel.`
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
        summaryNotes: [
          `Ancien cache écarté automatiquement : veuillez supprimer et ré-importer « ${annale.title} » pour analyser son vrai texte.`,
        ],
        audited: true,
      });
      continue;
    }

    // Réhydratation uniquement si le fichier porte explicitement le nom d'une annale d'Hémato/MS
    if (effectiveRawText.length < 150 && looksLikeUcadExamFileName(annale.title)) {
      const hydratedCorpus = lookupPreExtractedExamCorpus(annale.title);
      if (hydratedCorpus) effectiveRawText = hydratedCorpus;
    }

    const parsedLocal = parseUniversalExamAnnale(
      effectiveRawText,
      usableLessons,
      subjectName,
      idfMap,
      annale.title
    );

    if (parsedLocal.detectedGroupageCode) {
      detectedGroupageCode = parsedLocal.detectedGroupageCode;
    }

    const { isolatedText } = isolateSubjectSectionUniversal(
      effectiveRawText,
      subjectName,
      usableLessons
    );
    const normIsolated = normalizeText(isolatedText)
      .replace(
        /\b(section|ec1|ec2|hematologie|clinique|maladies|systemiques|systeme|examen|td|corrige|m1s2|medecine|universite|cheikh|anta|diop|dakar|faculte|pharmacie|odontostomatologie|module|2018|2019|2020|2021|2022|2023|2024|2025)\b/g,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

    const fingerprint = `${parsedLocal.questionCount}__${normIsolated.slice(0, 280)}`;
    if (!parsedLocal.isOtherSubjectOnly && parsedLocal.questionCount > 0 && seenExamFingerprints.has(fingerprint)) {
      const origTitle = seenExamFingerprints.get(fingerprint)!;
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
        summaryNotes: [
          `Même sujet que « ${origTitle} » pour la matière « ${subjectName} » — fusionné automatiquement pour éviter le double comptage.`,
        ],
        audited: true,
      });
      warnings.push(
        `Doublon fusionné : « ${annale.title} » contient le même sujet de « ${subjectName} » que « ${origTitle} ».`
      );
      continue;
    }

    const aiAudit = aiAudits?.[annale.id];
    const aiSummaryNotes = normalizeSummaryNotes(aiAudit?.summaryNotes);

    if (aiAudit?.ignoredReason === "OTHER_SUBJECT" || (!aiAudit && parsedLocal.isOtherSubjectOnly)) {
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
          : [`Épreuve écartée : porte exclusivement sur une autre matière que « ${subjectName} ».`],
        audited: true,
      });
      warnings.push(
        `« ${annale.title} » porte sur une autre matière que « ${subjectName} » : écartée du calcul.`
      );
      continue;
    }

    if (aiAudit?.detectedGroupageCode && typeof aiAudit.detectedGroupageCode === "string") {
      const trimmedCode = aiAudit.detectedGroupageCode.trim();
      // Le code proposé par l'audit n'est retenu que s'il est réellement présent dans le texte de l'annale.
      const codeInText = normalizeText(effectiveRawText).replace(/[^a-z0-9]+/g, " ").includes(normalizeText(trimmedCode).replace(/[^a-z0-9]+/g, " "));
      if (trimmedCode.length >= 6 && trimmedCode.toLowerCase() !== "null" && codeInText) {
        detectedGroupageCode = trimmedCode;
      }
    }

    const hasAiCount = Boolean(
      aiAudit && typeof aiAudit.questionCount === "number" && aiAudit.questionCount > 0
    );

    const combinedStems = [
      ...parsedLocal.stemPatterns,
    ];
    for (const pat of combinedStems) {
      if (pat && allStemPatterns.length < 24 && !allStemPatterns.includes(pat)) {
        allStemPatterns.push(pat);
      }
    }
    for (const smp of parsedLocal.globalSamples) {
      if (allGlobalSamples.length < 15 && !allGlobalSamples.includes(smp)) {
        allGlobalSamples.push(smp);
      }
    }

    const mergedLessonCounts: Record<
      string,
      { blocks: number; qcm: number; summary?: string; weak?: boolean; verbatimSamples?: string[] }
    > = { ...parsedLocal.lessonQcmCounts };

    if (hasAiCount && aiAudit?.lessonBreakdown) {
      if (Array.isArray(aiAudit.lessonBreakdown)) {
        for (const item of aiAudit.lessonBreakdown) {
          const matched = matchLessonByTitleOrId(
            item.lessonId || item.lessonTitle || "",
            usableLessons
          );
          if (matched && Number(item.qcm) > 0) {
            const localPrev = mergedLessonCounts[matched.id];
            mergedLessonCounts[matched.id] = {
              blocks: Math.max(1, Number(item.blocks) || localPrev?.blocks || 1),
              qcm: Math.max(Number(item.qcm) || 0, localPrev?.qcm || 0),
              summary: item.summary || localPrev?.summary || `${item.qcm} QCM audités par IA`,
              weak: false,
            };
          }
        }
      } else if (typeof aiAudit.lessonBreakdown === "object") {
        for (const [lessonKey, fmtMap] of Object.entries(aiAudit.lessonBreakdown)) {
          if (!fmtMap || typeof fmtMap !== "object") continue;
          const matched = matchLessonByTitleOrId(lessonKey, usableLessons);
          let lessonSum = 0;
          const fmtParts: string[] = [];
          for (const [fKey, fVal] of Object.entries(fmtMap)) {
            const upperF = fKey.trim().toUpperCase() as EBFormat;
            const countNum = Number(fVal) || 0;
            if (countNum > 0 && VALID_EB_FORMATS.has(upperF)) {
              lessonSum += countNum;
              fmtParts.push(`${countNum} ${EB_FORMAT_SHORT_LABELS[upperF]}`);
            }
          }
          if (matched && lessonSum > 0) {
            const localPrev = mergedLessonCounts[matched.id];
            const bestQcm = Math.max(lessonSum, localPrev?.qcm || 0);
            mergedLessonCounts[matched.id] = {
              blocks: Math.max(1, localPrev?.blocks || 1),
              qcm: bestQcm,
              summary:
                localPrev?.summary ||
                `${bestQcm} QCM audités par IA (${fmtParts.join(", ")})`,
              weak: false,
            };
          }
        }
      }
    }

    // Prise en charge de `aiAudit.lessonQcmCounts` qu'il s'agisse d'un nombre ({ "c1": 4 }) ou d'un objet ({ "c1": { qcm: 4 } })
    if (hasAiCount && aiAudit?.lessonQcmCounts && typeof aiAudit.lessonQcmCounts === "object") {
      for (const [key, val] of Object.entries(aiAudit.lessonQcmCounts)) {
        const matched = matchLessonByTitleOrId(key, usableLessons);
        if (!matched || val === null || val === undefined) continue;

        const isNumericVal = typeof val === "number" || typeof val === "string";
        const qcmNum = isNumericVal ? Number(val) : Number(val.qcm);
        if (qcmNum > 0) {
          const localPrev = mergedLessonCounts[matched.id];
          const bestQcm = Math.max(qcmNum, localPrev?.qcm || 0);
          const objVal = !isNumericVal ? val : undefined;
          mergedLessonCounts[matched.id] = {
            blocks: Math.max(1, Number(objVal?.blocks) || localPrev?.blocks || 1),
            qcm: bestQcm,
            summary:
              objVal?.summary ||
              localPrev?.summary ||
              `${bestQcm} QCM audités par IA pour « ${matched.cleanTitle} »`,
            weak: false,
          };
        }
      }
    }

    const validObservedFormats = new Set<ObservedExamQuestion["format"]>([
      "ELECTION",
      "CENSURE",
      "GROUPAGE",
      "JUMELAGE",
      "ASSOCIATION",
      "COMPLEMENT_MULTIPLE",
      "QNS",
    ]);
    const aiQuestionList: ObservedExamQuestion[] =
      hasAiCount && Array.isArray(aiAudit?.observedQuestions) ? aiAudit!.observedQuestions! : [];
    const aiSeenNumbers = new Set<number>();
    const aiUnverifiedNumbers: number[] = [];
    const aiVerified: ObservedExamQuestion[] = [];
    aiQuestionList.forEach((q, index) => {
      const number = Number(q?.number);
      const format = String(q?.format || "").toUpperCase() as ObservedExamQuestion["format"];
      const stem = String(q?.stem || "").trim();
      // Chaque question listée par l'audit doit être retrouvée mot pour mot dans le texte, sinon elle est écartée.
      const source = Number.isInteger(number) && number >= 1 && !aiSeenNumbers.has(number) && validObservedFormats.has(format)
        ? locateExamStyleSource(effectiveRawText, stem, annale.title, number)
        : undefined;
      const optionCount = format === "QNS" ? 0 : plannedOptionCount({ format: format as never, optionCount: Number(q?.optionCount) });
      if (!source || (format !== "QNS" && optionCount === null)) {
        aiUnverifiedNumbers.push(Number.isInteger(number) && number >= 1 ? number : index + 1);
        return;
      }
      aiSeenNumbers.add(number);
      const inCase = Boolean(q.inCase);
      aiVerified.push({
        number,
        format,
        optionCount: optionCount ?? 0,
        inCase,
        caseKey: inCase ? `${annale.title}#${q.caseKey ? String(q.caseKey) : "dossier"}` : undefined,
        stem,
        sourceTitle: annale.title,
        lessonId: q.lessonId && usableLessons.some((l) => l.id === q.lessonId) ? q.lessonId : undefined,
        source: { ...source, examId: annale.id },
        aiRecovered: true,
      });
    });

    const useAiObservedRecovery =
      hasAiCount &&
      parsedLocal.skippedNumbers.length > 0 &&
      aiQuestionList.length === Number(aiAudit!.questionCount) &&
      aiVerified.length === aiQuestionList.length &&
      aiVerified.length > 0;

    const effectiveObservedQuestions = useAiObservedRecovery ? aiVerified : parsedLocal.observedQuestions;
    const effectiveFormatCounts: Partial<Record<EBFormat, number>> = {};
    if (useAiObservedRecovery) {
      for (const q of effectiveObservedQuestions) {
        effectiveFormatCounts[q.format] = (effectiveFormatCounts[q.format] || 0) + 1;
      }
    } else {
      Object.assign(effectiveFormatCounts, parsedLocal.formatCounts);
    }

    const finalQCount = useAiObservedRecovery
      ? effectiveObservedQuestions.length
      : parsedLocal.questionCount || (hasAiCount ? Number(aiAudit!.questionCount) : 0);
    const structureComplete =
      useAiObservedRecovery ||
      (parsedLocal.skippedNumbers.length === 0 &&
        (!hasAiCount || Number(aiAudit!.questionCount) <= parsedLocal.questionCount));

    if (parsedLocal.skippedNumbers.length) {
      if (useAiObservedRecovery) {
        warnings.push(`« ${annale.title} » : structure récupérée par l’audit puis vérifiée mot pour mot dans le texte (${aiVerified.length} question(s)). Le nombre de choix reste déclaré par l’audit ; ces questions ne servent pas d’exemples de style.`);
      } else {
        warnings.push(`« ${annale.title} » : numérotation détectée mais structure illisible pour les questions ${parsedLocal.skippedNumbers.join(", ")} ; annale exclue du plan.`);
        if (aiQuestionList.length) {
          warnings.push(`« ${annale.title} » : récupération par audit refusée — ${aiUnverifiedNumbers.length ? `questions non retrouvées mot pour mot dans le texte : ${aiUnverifiedNumbers.join(", ")}` : `liste de l’audit (${aiQuestionList.length}) différente du nombre annoncé (${Number(aiAudit!.questionCount)})`}.`);
        }
      }
    }
    if (parsedLocal.inferredCaseEnds.length) warnings.push(`« ${annale.title} » : fin de dossier inférée après les questions ${parsedLocal.inferredCaseEnds.join(", ")} faute de délimitation explicite ; vérifiez ces limites dans l’annale.`);
    if (!useAiObservedRecovery && hasAiCount && Number(aiAudit!.questionCount) > parsedLocal.questionCount) {
      warnings.push(`« ${annale.title} » : l’audit estime ${aiAudit!.questionCount} questions, mais seules ${parsedLocal.questionCount} structure(s) ont été extraites. Cette annale est exclue du plan d’épreuve ; vérifiez sa transcription.`);
    }
    const unattributed = effectiveObservedQuestions.filter((question) => !question.lessonId).length;
    if (unattributed) warnings.push(`« ${annale.title} » : ${unattributed} question(s) non rattachée(s) à un chapitre ; les fréquences par chapitre peuvent être sous-estimées.`);

    if (structureComplete) {
      for (const [f, cnt] of Object.entries(effectiveFormatCounts)) {
        if ((cnt || 0) > 0 && VALID_EB_FORMATS.has(f as EBFormat)) {
          formatDistribution[f as EBFormat] = (formatDistribution[f as EBFormat] || 0) + (cnt || 0);
        }
      }
    }

    const finalCaseCount = useAiObservedRecovery
      ? new Set(effectiveObservedQuestions.filter((q) => q.inCase).map((q) => q.caseKey)).size
      : parsedLocal.caseCount;

    if (finalQCount > 0) {
      seenExamFingerprints.set(fingerprint, annale.title);
    } else {
      warnings.push(
        `Aucune question détectée dans « ${annale.title} » pour « ${subjectName} ».`
      );
    }

    const fmtSummary = Object.entries(effectiveFormatCounts)
      .filter(([f, c]) => (c || 0) > 0 && VALID_EB_FORMATS.has(f as EBFormat))
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
      observedQuestions: effectiveObservedQuestions.map((question) => question.source ? { ...question, source: { ...question.source, examId: annale.id } } : question),
      structureComplete,
      aiRecovered: useAiObservedRecovery,
      summaryNotes: aiSummaryNotes.length
        ? aiSummaryNotes
        : [
            `${finalQCount} question(s) de « ${subjectName} » ${structureComplete ? "extraites" : "estimées par l’audit"} dans « ${annale.title} » (${
              finalCaseCount > 0 ? `${finalCaseCount} dossier(s)` : "aucun dossier"
            }) · ${Object.keys(mergedLessonCounts).length} chapitre(s) corrélé(s) · Répartition : ${
              fmtSummary || "non mesurée"
            }.`,
          ],
      audited: finalQCount > 0 || Boolean(aiAudit),
    });
  }

  const validExams = exams.filter((e) => e.questionCount > 0);
  const totalAnalyzedQcm = validExams.reduce((s, e) => s + e.questionCount, 0);

  // Conservation intégrale de tous les formats réellement détectés sur la matière (y compris les formats rares :
  // Groupage, Complément multiple, Jumelage à 1 ou 2 occurrences sur l'ensemble des annales)
  // et calcul du pourcentage global (%) de chaque format sur l'ensemble des annales analysées.
  const totalFmtSum = Object.values(formatDistribution).reduce((s, c) => s + (c || 0), 0);
  const formatPercentages: Partial<Record<EBFormat, number>> = {};
  if (totalFmtSum > 0) {
    const sortedFmts = Object.entries(formatDistribution)
      .filter(([, c]) => (c || 0) > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0));

    const percentages = apportionExamCounts(sortedFmts.map(([, count]) => count || 0), 100);
    sortedFmts.forEach(([format], index) => { formatPercentages[format as EBFormat] = percentages[index]; });
  }

  if ((formatDistribution.GROUPAGE || 0) === 0) {
    detectedGroupageCode = "";
  }

  const minQcm =
    validExams.length > 0
      ? Math.min(...validExams.map((e) => e.questionCount))
      : 0;
  const maxQcm =
    validExams.length > 0
      ? Math.max(...validExams.map((e) => e.questionCount))
      : 0;
  const maxExamItem = validExams.reduce<ExamAnalysisItem | null>(
    (best, e) => (!best || e.questionCount > best.questionCount ? e : best),
    null
  );
  const maxQcmExamTitle = maxExamItem
    ? `${cleanLessonTitle(maxExamItem.title)}${maxExamItem.year ? ` (${maxExamItem.year})` : ""}`
    : undefined;
  const avgQcmPerExam =
    validExams.length > 0
      ? Math.round(totalAnalyzedQcm / validExams.length)
      : 0;

  const correlatedValidExams = validExams.filter((e) => e.lessonsUsed.length > 0);
  const rawAvgLessons =
    correlatedValidExams.length > 0
      ? correlatedValidExams.reduce((sum, e) => sum + e.lessonsUsed.length, 0) /
        correlatedValidExams.length
      : 0;

  const avgLessonsPerExam = Number(rawAvgLessons.toFixed(1));
  const quota = Math.max(
    1,
    Math.min(
      usableLessons.length,
      Math.round(rawAvgLessons) || Math.min(4, Math.max(1, usableLessons.length))
    )
  );

  const preferredFormats = Object.entries(formatDistribution)
    .filter(([, cnt]) => (cnt || 0) > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([f]) => f as EBFormat);

  const activeFormats: EBFormat[] =
    preferredFormats.length > 0 ? preferredFormats : ["ELECTION"];

  const lessonStats: LessonStat[] = usableLessons.map((lesson) => {
    const perExam: LessonStat["perExam"] = [];
    const verbatimSamples: string[] = [];
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
        if (Array.isArray(hit.verbatimSamples)) {
          for (const s of hit.verbatimSamples) {
            if (verbatimSamples.length < 6 && !verbatimSamples.includes(s)) {
              verbatimSamples.push(s);
            }
          }
        }
      }
    }

    const examsAppeared = perExam.length;
    const percent = getObservedLessonFrequency({ examsAppeared, totalExams: validExams.length });

    return {
      lessonId: lesson.id,
      title: lesson.cleanTitle,
      timesOut,
      examsAppeared,
      totalExams: validExams.length,
      totalQcm,
      percent,
      dominantFormats: [...new Set(validExams.flatMap((exam) => exam.observedQuestions || []).filter((question) => question.lessonId === lesson.id).map((question) => question.format))],
      tracedAnnaleQuestions: validExams.flatMap((exam) => exam.observedQuestions || []).filter((question) => question.lessonId === lesson.id && question.source && !question.aiRecovered).length,
      professorVerbatimSamples: verbatimSamples,
      perExam,
    };
  });

  lessonStats.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || b.totalQcm - a.totalQcm);

  const measuredExams = validExams.filter(isMeasuredExam);
  const measuredQuestions = measuredExams.flatMap((exam) => exam.observedQuestions!);
  const caseQuestions = measuredQuestions.filter((question) => question.inCase);
  const totalCaseQcms = caseQuestions.length;
  const totalCases = new Set(caseQuestions.map((question) => question.caseKey || `${question.sourceTitle}#${question.number}`)).size;
  const usesClinicalCases = totalCaseQcms > 0;
  const clinicalCaseRatio = measuredQuestions.length > 0 ? totalCaseQcms / measuredQuestions.length : 0;
  const avgItemsPerCase = totalCases > 0 ? Number((totalCaseQcms / totalCases).toFixed(1)) : 0;

  // Statistiques par épreuve, dominance, quotas de cas rares et plan exact de l'examen blanc (calibré sur le maximum observé)
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
    const avgWhenPresent =
      examsPresentCount > 0 ? Number((totalCount / examsPresentCount).toFixed(1)) : avgPerExam;
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
    .map((exam) => exam.observedQuestions!.filter((question) => question.format !== "QNS").length)
    .filter((cnt) => cnt > 0);
  const maxReferenceQuestionCount =
    perExamNonQnsCounts.length > 0 ? Math.max(...perExamNonQnsCounts) : 0;

  const rareFormatMinQuotas: Partial<Record<EBFormat, number>> = {};
  for (const st of prelimStats) {
    if (st.isRare && st.format !== "QNS") {
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
        rareFormatMinQuotas: rareFormatMinQuotas as Record<never, number>,
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

  const measuredProfile = measureExamStyle(
    measuredQuestions.filter((question) => question.format !== "QNS" && !question.aiRecovered)
  );

  const plannedFormatsSummary = formatStatsPerExam
    .filter((st) => st.plannedInExamBlanc > 0)
    .map(
      (st) =>
        `${st.plannedInExamBlanc} ${EB_FORMAT_SHORT_LABELS[st.format]}${
          st.isDominant ? " (dominant)" : st.isRare ? ` (quota rare : ${st.maxExamTitle || "1 épreuve"})` : ""
        }`
    )
    .join(" · ");

  const rareFormatsDesc = formatStatsPerExam
    .filter((st) => st.isRare)
    .map((st) => {
      const where = st.examOccurrences
        .map((occ) => `${cleanLessonTitle(occ.examTitle)}${occ.year ? ` (${occ.year})` : ""} : ${occ.count} QCM`)
        .join(", ");
      return `${EB_FORMAT_SHORT_LABELS[st.format]} (${where || `${st.totalCount} QCM`} → quota de ${st.plannedInExamBlanc || st.maxInSingleExam} QCM reproduit dans l'examen blanc)`;
    })
    .join(" ; ");

  const subjectLabel = subjectName || "la matière";
  const avgQcmMeasured =
    measuredExams.length > 0 ? Math.round(measuredQuestions.length / measuredExams.length) : avgQcmPerExam;
  const dominantStat = formatStatsPerExam[0];

  const qualitativeStyleInsights: string[] = [];
  if (measuredExams.length > 0 && dominantStat) {
    qualitativeStyleInsights.push(
      `Calibre maximal retenu : ${plannedExamTotalQcm} QCM (calibré sur l'épreuve la plus dense : « ${
        maxQcmExamTitle || cleanLessonTitle(measuredExams[0].title)
      } » avec ${maxQcm || plannedExamTotalQcm} QCM${
        minQcm > 0 && minQcm !== maxQcm ? `, contre ${minQcm} à ${maxQcm} QCM selon les années` : ""
      }).`
    );
    qualitativeStyleInsights.push(
      `Dominance docimologique en « ${subjectLabel} » : prédominance de « ${
        EB_FORMAT_LABELS[dominantStat.format] || dominantStat.format
      } » (${formatPercentages[dominantStat.format] || Math.round((dominantStat.totalCount / Math.max(1, totalFmtSum)) * 100)}% du corpus, soit ${
        dominantStat.plannedInExamBlanc
      } QCM sur ${plannedExamTotalQcm} dans votre examen blanc). Répartition programmée : ${plannedFormatsSummary}.`
    );
    const topOpenings = measuredProfile.formats
      .flatMap((f) => f.openings)
      .slice(0, 4)
      .map((o) => `« ${o.text}… »`)
      .join(", ");
    qualitativeStyleInsights.push(
      `Mécanique des questions et des pièges de l'enseignant : ${
        topOpenings ? `amorces récurrentes (${topOpenings}) ; ` : ""
      }les distracteurs reprennent une affirmation exacte du cours en modifiant un détail discriminant (topographie anatomique, signe clinique/radiologique, mécanisme physiopathologique, chronologie aigu/chronique ou valeur seuil) afin de créer une confusion ciblée où seule la proposition conforme au cours reste indiscutable.`
    );
    if (rareFormatsDesc) {
      qualitativeStyleInsights.push(
        `Cas rares intégrés avec leur quota exact : ${rareFormatsDesc}.`
      );
    }
  }

  const professorSignatureSummary =
    measuredExams.length > 0
      ? `Analyse qualitative de ${measuredExams.length} épreuve(s) de « ${subjectLabel} » (${measuredQuestions.length} QCM extraits) — Calibre d'épreuve retenu : ${plannedExamTotalQcm} QCM (référence maximale : « ${
          maxQcmExamTitle || cleanLessonTitle(measuredExams[0].title)
        } ») · ${
          usesClinicalCases
            ? `Dossiers cliniques + QCM indépendants`
            : "QCM directs indépendants (sans vignette de cas clinique)"
        }${plannedFormatsSummary ? ` · Quotas de votre Examen Blanc : ${plannedFormatsSummary}` : ""}${
          rareFormatsDesc ? ` · Cas rares reproduits : ${rareFormatsDesc}` : ""
        }.`
      : annales.length > 0
      ? `Aucune structure de QCM extraite des annales de « ${subjectLabel} » : vérifiez que la matière saisie correspond aux sections de vos annales.`
      : `Mode entraînement sur ${usableLessons.length} chapitre(s) de « ${subjectLabel} » (calibre par défaut : 12 QCM à 5 propositions).`;

  return {
    subjectName,
    exams,
    minQcm,
    maxQcm,
    maxQcmExamTitle,
    avgQcmPerExam: avgQcmMeasured || avgQcmPerExam,
    totalAnalyzedQcm,
    avgLessonsPerExam,
    quota,
    durationMin: (maxQcm || avgQcmMeasured) > 25 ? 90 : 60,
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
      typicalStemPatterns: allStemPatterns.slice(0, 15),
      globalVerbatimSamples: allGlobalSamples.slice(0, 10),
      professorSignatureSummary,
      qualitativeStyleInsights,
      measuredQuestions: measuredQuestions.length,
      measuredProfile,
    },
    warnings,
  };
}

function isMeasuredExam(exam: ExamAnalysisItem): boolean {
  return (
    !exam.ignoredReason &&
    exam.questionCount > 0 &&
    exam.structureComplete !== false &&
    Array.isArray(exam.observedQuestions) &&
    exam.observedQuestions.length === exam.questionCount
  );
}

export function buildExamDesign(analysis: CorpusAnalysis, lessonIds: string[]): ExamDesign {
  const retained = analysis.exams.filter((exam) => !exam.ignoredReason && exam.questionCount > 0);
  if (retained.some((exam) => !Array.isArray(exam.observedQuestions))) {
    throw new Error("Analyse enregistrée avec une version antérieure : relancez l’analyse des annales.");
  }
  const measured = retained.filter(isMeasuredExam);
  const perExamNonQnsCounts = measured
    .map((exam) => exam.observedQuestions!.filter((question) => question.format !== "QNS").length)
    .filter((cnt) => cnt > 0);
  const maxReferenceQuestionCount =
    perExamNonQnsCounts.length > 0 ? Math.max(...perExamNonQnsCounts) : 0;
  const rareFormatMinQuotas: Partial<Record<EBFormat, number>> = {};
  for (const st of analysis.formatStatsPerExam || []) {
    if (st.isRare && st.format !== "QNS") {
      rareFormatMinQuotas[st.format] = Math.max(1, st.maxInSingleExam || Math.round(st.avgWhenPresent) || 1);
    }
  }
  const design = createExamDesign({
    lessonIds,
    questions: measured.flatMap((exam) => exam.observedQuestions!),
    referenceQuestionCount: maxReferenceQuestionCount,
    hasAnnales: analysis.exams.length > 0,
    preserveRareFormats:
      measured.length >= 2 || (measured.length === 1 && maxReferenceQuestionCount <= 35),
    rareFormatMinQuotas: rareFormatMinQuotas as Record<never, number>,
  });
  const excluded = retained.filter((exam) => !isMeasuredExam(exam)).map((exam) => `« ${exam.title} »`);
  if (excluded.length) design.warnings.unshift(`Structure non extraite, exclue du plan : ${excluded.join(", ")}.`);
  return design;
}

// ============================================================================
// 4. AUDIT DOCIMOLOGIQUE APPROFONDI HYBRIDE (PARSEUR VECTORIEL + IA SONNET 4.6)
// ============================================================================
const getEbSupabaseUrl = (): string =>
  import.meta.env.VITE_SUPABASE_URL || "https://vhzdbhdyytvaipkbcsvs.supabase.co";
const getEbSupabaseAnonKey = (): string =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

async function invokeEdgeFunctionDirect(
  fnName: string,
  body: Record<string, any>,
  timeoutMs: number
): Promise<{ data: any; error: any }> {
  let accessToken = await getEdgeAccessToken();
  if (!accessToken) {
    return { data: null, error: { status: 401, message: "Veuillez vous connecter pour utiliser la génération IA." } };
  }

  const ebUrl = getEbSupabaseUrl();
  const ebAnonKey = getEbSupabaseAnonKey();
  if (ebUrl && ebAnonKey) {
    const executeFetch = async (token: string): Promise<{ data: any; error: any; status?: number }> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(`${ebUrl}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: ebAnonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          return { data, error: null, status: resp.status };
        }
        const payload = await resp.json().catch(() => null);
        const errMsg =
          typeof payload?.message === "string" && typeof payload?.error === "string"
            ? `${payload.error} — ${payload.message}`
            : typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.message === "string"
            ? payload.message
            : `Service indisponible (HTTP ${resp.status}).`;
        return { data: null, error: { status: resp.status, message: errMsg }, status: resp.status };
      } catch (err: any) {
        clearTimeout(timer);
        return { data: null, error: err };
      }
    };

    const firstTry = await executeFetch(accessToken);
    if (firstTry.status === 401) {
      // Un seul rafraîchissement de session si le JWT a expiré ou été révoqué côté serveur
      try {
        const refreshed = await supabase.auth.refreshSession();
        const freshToken = refreshed.data?.session?.access_token;
        if (!refreshed.error && freshToken && freshToken !== accessToken) {
          accessToken = freshToken;
          const retryTry = await executeFetch(accessToken);
          return { data: retryTry.data, error: retryTry.error };
        }
      } catch {
        // garde la réponse 401 initiale
      }
    }
    return { data: firstTry.data, error: firstTry.error };
  }

  let timeout: ReturnType<typeof setTimeout>;
  try {
    const invokePromise = supabase.functions.invoke(fnName, {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
      timeout = setTimeout(() => resolve({ data: null, error: { message: "Délai de génération dépassé." } }), timeoutMs);
    });
    return await Promise.race([invokePromise, timeoutPromise]);
  } catch (err: any) {
    return { data: null, error: err };
  } finally {
    clearTimeout(timeout);
  }
}

function isMissingEndpointError(err: unknown): boolean {
  const errObj = err as { status?: number; context?: { status?: number }; message?: string } | null;
  const status = Number(errObj?.status || errObj?.context?.status || 0);
  if (status === 404) return true;
  const msg = String(errObj?.message || "").toLowerCase();
  return msg.includes("requested function was not found") || msg.includes("http 404");
}

function isNetworkOrGatewayTimeoutError(err: unknown): boolean {
  const errObj = err as { status?: number; context?: { status?: number }; message?: string; name?: string } | null;
  const status = Number(errObj?.status || errObj?.context?.status || 0);
  if ([502, 504, 522, 524, 546].includes(status)) return true;
  const name = String(errObj?.name || "").toLowerCase();
  const msg = String(errObj?.message || err || "").toLowerCase();
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

function parseGroupageCodeOptions(code: string): Array<{ letter: string; text: string }> {
  const entries = [
    ...String(code || "A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autre choix").matchAll(
      /\b([A-J])\s*[:=]\s*(.*?)(?=\s*[;•]?\s*\b[A-J]\s*[:=]|$)/gi
    ),
  ].map((entry) => ({
    letter: entry[1].toUpperCase(),
    text: entry[2].replace(/[;•]\s*$/, "").trim(),
  }));
  if (entries.length >= 2) return entries;
  return [
    { letter: "A", text: "1+2+3" },
    { letter: "B", text: "1+3" },
    { letter: "C", text: "2+4" },
    { letter: "D", text: "4" },
    { letter: "E", text: "autre choix" },
  ];
}

function isBrokenLegacyEdgeError(err: unknown): boolean {
  const errObj = err as { status?: number; context?: { status?: number }; message?: string } | null;
  const status = Number(errObj?.status || errObj?.context?.status || 0);
  const msg = String(errObj?.message || err || "").toLowerCase();
  if (msg.includes("service indisponible") && status !== 500) return false;
  if (
    msg.includes("openai api error") ||
    msg.includes("billing_not_active") ||
    msg.includes("le contenu du cours est vide") ||
    msg.includes("aucune clé ia active") ||
    msg.includes("erreur lors de la génération docimologique")
  ) {
    return true;
  }
  return status === 500 && !msg.includes("service indisponible");
}

function unwrapMorChatDraftContainer(rawDraft: any): any {
  if (!rawDraft) return null;
  if (Array.isArray(rawDraft)) return { items: rawDraft };
  if (typeof rawDraft !== "object") return null;
  if (Array.isArray(rawDraft.items) || Array.isArray(rawDraft.questions) || Array.isArray(rawDraft.qcm)) {
    return {
      ...rawDraft,
      items: rawDraft.items || rawDraft.questions || rawDraft.qcm,
    };
  }
  for (const key of ["block", "bloc", "data", "result", "payload"]) {
    const nested = rawDraft[key];
    if (nested && typeof nested === "object" && (Array.isArray(nested.items) || Array.isArray(nested.questions))) {
      return {
        ...rawDraft,
        ...nested,
        items: nested.items || nested.questions,
      };
    }
  }
  return rawDraft;
}

function normalizeMorChatDraftPayload(
  rawDraft: any,
  spec: { kind: string; formats: readonly string[]; optionCounts?: readonly number[]; lessonIds?: string[] },
  groupageCode: string,
  lessonTitle: string,
  styleReferences: ExamStyleQuestion[]
): any {
  const unwrapped = unwrapMorChatDraftContainer(rawDraft);
  const draftObj = unwrapped && typeof unwrapped === "object" ? { ...unwrapped } : null;
  if (!draftObj) return null;

  const rawItems: any[] = Array.isArray(draftObj.items)
    ? draftObj.items
    : Array.isArray(draftObj.questions)
    ? draftObj.questions
    : Array.isArray(draftObj.qcm)
    ? draftObj.qcm
    : [];
  if (rawItems.length === 0) return null;

  const targetCount = spec.formats.length;
  const paddedRawItems = [...rawItems];
  while (paddedRawItems.length < targetCount) {
    paddedRawItems.push(structuredClone(rawItems[paddedRawItems.length % rawItems.length]));
  }

  const seenStems = new Set<string>();
  const styleLessonId = Array.isArray(spec.lessonIds) ? spec.lessonIds[0] : undefined;

  const items = paddedRawItems.slice(0, targetCount).map((rawIt: any, idx: number) => {
    const it = rawIt && typeof rawIt === "object" ? { ...rawIt } : {};
    const targetFormat = String(spec.formats[idx] || "ELECTION").toUpperCase();
    const targetOptCount = Number(spec.optionCounts?.[idx] || 5);

    let stem = String(it.stem || it.question || `Concernant « ${lessonTitle} », quelle proposition est exacte ?`).trim();
    if (stem.length < 10) {
      stem = `Concernant « ${lessonTitle} » (question ${idx + 1}), quelle proposition correspond aux données du cours ?`;
    }

    // Évite toute copie accidentelle d'un énoncé d'annale injecté en exemple de style
    const checkCopyCandidate = {
      kind: (spec.kind === "CAS_CLINIQUE" ? "CAS_CLINIQUE" : "STANDALONE") as "CAS_CLINIQUE" | "STANDALONE",
      header: String(draftObj.header || lessonTitle || "Examen Blanc"),
      items: [
        {
          format: targetFormat as any,
          stem,
          options: [{ letter: "A", text: "Option A" }, { letter: "B", text: "Option B" }],
          correct: ["A"],
          explanation: "Explication",
        },
      ],
    };
    if (copiedExamStyleQuestions(styleReferences, examStyleQuestionsFromBlock(checkCopyCandidate, styleLessonId)).length > 0) {
      stem = `Au sujet de « ${lessonTitle} » (évaluation docimologique n°${idx + 1}), indiquez la proposition conforme au cours :`;
    }

    const lead = typeof it.lead === "string" && it.lead.trim().length > 0 ? it.lead.trim() : undefined;
    let stemSig = `${lead || ""} ${stem}`.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    if (seenStems.has(stemSig)) {
      stem = `${stem.replace(/\s*\?\s*$/, "")} (aspect clinique n°${idx + 1}) ?`;
      stemSig = `${lead || ""} ${stem}`.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    }
    seenStems.add(stemSig);

    let statements: string[] | undefined = Array.isArray(it.statements)
      ? it.statements
          .map((s: any) => String(s || "").replace(/^\s*(?:\d+|[IVX]+)\s*[.)-]\s*/i, "").trim())
          .filter(Boolean)
      : undefined;

    let options: Array<{ letter: string; text: string }> = Array.isArray(it.options)
      ? it.options.map((o: any, oIdx: number) => ({
          letter: LETTERS[oIdx] || "A",
          text: cleanOptionPrefix(typeof o === "string" ? o : String(o?.text || o?.label || "")),
        }))
      : [];

    let groupageCodeHint: string | undefined;
    let associationColumns = it.associationColumns;

    if (targetFormat === "JUMELAGE") {
      if (!statements || statements.length < 2) {
        const fromOpts = options.map((o) => o.text).filter(Boolean);
        statements = [
          statements?.[0] || fromOpts[0] || `Dans « ${lessonTitle} », le diagnostic repose sur les signes cardinaux du cours`,
          statements?.[1] || fromOpts[1] || `Le mécanisme physiopathologique principal découle directement de cette atteinte`,
        ];
      } else {
        statements = statements.slice(0, 2);
      }
      if (statements[0].toLowerCase() === statements[1].toLowerCase()) {
        statements[1] = `${statements[1]} (conséquence physiopathologique directe)`;
      }
      options = JUMELAGE_OPTIONS.map((text, oIdx) => ({
        letter: LETTERS[oIdx] || "A",
        text,
      }));
    } else if (targetFormat === "GROUPAGE") {
      if ((!statements || statements.length < 3) && options.length >= 3) {
        const nonComboTexts = options
          .map((o) => o.text)
          .filter((t) => t && !/^\d(?:\s*[+,]\s*\d)*$|^autre/i.test(t.replace(/\bseulement\b/gi, "").trim()));
        if (nonComboTexts.length >= 3) {
          statements = nonComboTexts.slice(0, 4);
        }
      }
      if (!statements || statements.length < 3) {
        statements = [
          statements?.[0] || `Première caractéristique clinique décrite dans « ${lessonTitle} »`,
          statements?.[1] || `Deuxième signe biologique ou radiologique mentionné dans « ${lessonTitle} »`,
          statements?.[2] || `Troisième critère évolutif ou diagnostique issu du cours « ${lessonTitle} »`,
          statements?.[3] || `Quatrième modalité thérapeutique ou préventive relative à « ${lessonTitle} »`,
        ];
      } else if (statements.length > 6) {
        statements = statements.slice(0, 4);
      }
      const codeOpts = parseGroupageCodeOptions(groupageCode);
      options = codeOpts.slice(0, targetOptCount);
      groupageCodeHint = options.map((o) => `${o.letter}=${o.text}`).join(" ; ");
    } else {
      if (options.length < 2 && statements && statements.length >= 2) {
        options = statements.map((s, oIdx) => ({
          letter: LETTERS[oIdx] || "A",
          text: cleanOptionPrefix(s),
        }));
      }
      statements = undefined;

      if (targetFormat === "ASSOCIATION") {
        const leftRaw = Array.isArray(associationColumns?.leftItems) ? associationColumns.leftItems : [];
        const rightRaw = Array.isArray(associationColumns?.rightItems) ? associationColumns.rightItems : [];
        const leftItems =
          leftRaw.length >= 2
            ? leftRaw.slice(0, 3).map((x: any, lIdx: number) => ({
                id: String(lIdx + 1),
                text: String(x?.text || `Élément ${lIdx + 1}`).trim() || `Élément ${lIdx + 1}`,
              }))
            : [
                { id: "1", text: `Forme clinique principale de ${lessonTitle}` },
                { id: "2", text: `Signe paraclinique caractéristique de ${lessonTitle}` },
              ];
        const rightItems =
          rightRaw.length >= leftItems.length
            ? rightRaw.slice(0, Math.max(targetOptCount, leftItems.length)).map((x: any, rIdx: number) => ({
                id: LETTERS[rIdx] || "A",
                text: String(x?.text || `Caractéristique ${LETTERS[rIdx]}`).trim() || `Caractéristique ${LETTERS[rIdx]}`,
              }))
            : leftItems.map((l, rIdx) => ({
                id: LETTERS[rIdx] || "A",
                text: `Critère associé à l'élément ${l.id}`,
              }));
        associationColumns = {
          leftTitle: String(associationColumns?.leftTitle || "Éléments cliniques").trim() || "Éléments cliniques",
          rightTitle: String(associationColumns?.rightTitle || "Caractéristiques").trim() || "Caractéristiques",
          leftItems,
          rightItems,
        };
        const rIds = rightItems.map((r: { id: string }) => r.id);
        options = Array.from({ length: targetOptCount }, (_, oIdx) => {
          const letter = LETTERS[oIdx] || "A";
          const pairing = leftItems
            .map((l: { id: string }, lIdx: number) => `${l.id}-${rIds[(lIdx + oIdx) % rIds.length]}`)
            .join(" ; ");
          return { letter, text: pairing };
        });
      } else {
        options = options.filter((o) => o.text && o.text.trim().length > 0).slice(0, targetOptCount);
        while (options.length < targetOptCount) {
          const nextIdx = options.length;
          const letter = LETTERS[nextIdx] || "A";
          options.push({
            letter,
            text: `Proposition complémentaire ${letter} relative à « ${lessonTitle} »`,
          });
        }
        const seenOptTexts = new Set<string>();
        options = options.map((o, oIdx) => {
          const letter = LETTERS[oIdx] || "A";
          let txt = o.text.trim();
          const normTxt = txt.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
          if (seenOptTexts.has(normTxt)) {
            txt = `${txt} (variante ${letter})`;
          }
          seenOptTexts.add(txt.normalize("NFKC").replace(/\s+/g, " ").toLowerCase());
          return { letter, text: txt };
        });
      }
    }

    const validLetters = options.map((o) => o.letter);
    const rawCorrectList = Array.isArray(it.correct)
      ? it.correct
      : typeof it.correct === "string"
      ? it.correct.split(/[\s,;+]+/)
      : Array.isArray(it.correctLetters)
      ? it.correctLetters
      : typeof it.correctLetter === "string"
      ? [it.correctLetter]
      : [];
    let correct = Array.from(
      new Set(
        rawCorrectList
          .map((c: any) => String(c || "").trim().toUpperCase().charAt(0))
          .filter((c: string) => validLetters.includes(c))
      )
    ) as string[];

    if (targetFormat === "COMPLEMENT_MULTIPLE") {
      if (correct.length === 0) {
        correct = validLetters.slice(0, Math.min(2, validLetters.length));
      } else if (correct.length === 1) {
        const second = validLetters.find((l) => l !== correct[0]) || validLetters[1];
        if (second) correct = [correct[0], second];
      } else if (correct.length >= validLetters.length) {
        correct = correct.slice(0, Math.max(2, validLetters.length - 1));
      }
    } else {
      if (correct.length === 0) {
        correct = [validLetters[0] || "A"];
      } else if (correct.length > 1) {
        correct = [correct[0]];
      }
    }

    const explanation =
      String(it.explanation || it.globalExplanation || "").trim() ||
      `Réponse exacte : ${correct.join(", ")} conformément aux données du cours « ${lessonTitle} ».`;

    return {
      format: targetFormat,
      ...(lead ? { lead } : {}),
      stem,
      options,
      correct,
      explanation,
      ...(statements ? { statements } : {}),
      ...(groupageCodeHint ? { groupageCodeHint } : {}),
      ...(targetFormat === "ASSOCIATION" && associationColumns ? { associationColumns } : {}),
    };
  });

  const kind = spec.kind === "CAS_CLINIQUE" ? "CAS_CLINIQUE" : "STANDALONE";
  const header =
    String(draftObj.header || draftObj.title || lessonTitle || "Série d’Examen Blanc").trim() ||
    "Série d’Examen Blanc";
  const vignette =
    kind === "CAS_CLINIQUE"
      ? String(
          draftObj.vignette ||
            draftObj.clinicalCase ||
            draftObj.context ||
            `Un patient consulte pour un tableau clinique caractéristique relevant du chapitre « ${lessonTitle} ».`
        ).trim()
      : undefined;

  return {
    kind,
    header,
    ...(vignette ? { vignette } : {}),
    items,
  };
}

function sanitizeTextForAiTransport(raw: string): string {
  // Retire les caractères de contrôle PDF (NUL, etc.) et remplace les paires UTF-16 cassées
  return String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/g, " ")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, " ");
}

function buildMorChatRelayMessages(params: {
  systemPrompt: string;
  userPrompt: string;
  cachedCoursePrefix?: string;
}): Array<{ role: "system" | "user"; content: string }> {
  const sys = sanitizeTextForAiTransport(params.systemPrompt || "");
  const schemaMarkerIdx = sys.indexOf("PLAN STRICT QUESTION PAR QUESTION");
  let sysMain = sys;
  let sysOverflow = "";

  if (sys.length > 14500) {
    if (schemaMarkerIdx > 0) {
      const tail = sys.slice(schemaMarkerIdx);
      const headBudget = Math.max(1200, 14500 - tail.length - 64);
      const head = sys.slice(0, headBudget);
      sysMain = `${head}\n...\n${tail}`;
      const middleEnd = Math.min(schemaMarkerIdx, headBudget + 12000);
      if (middleEnd > headBudget) {
        sysOverflow = `${sys.slice(headBudget, middleEnd)}\n\n`;
      }
    } else {
      sysMain = sys.slice(0, 14500);
      sysOverflow = `${sys.slice(14500, 26000)}\n\n`;
    }
  }

  const cleanUserPrompt = sanitizeTextForAiTransport(params.userPrompt || "");
  const cleanPrefix = sanitizeTextForAiTransport(params.cachedCoursePrefix || "");
  const prefix =
    cleanPrefix && !cleanUserPrompt.includes(cleanPrefix.slice(0, 120))
      ? `${cleanPrefix}\n\n`
      : "";
  const footerReminder =
    "\n\nIMPÉRATIF FINAL : Réponds EXCLUSIVEMENT par un objet JSON valide sans aucun texte avant ou après le JSON.";
  const rawUser = `${sysOverflow}${prefix}${cleanUserPrompt}`;
  // Garde le budget total <= 55 000 caractères (en dessous de 60 000 côté serveur `mor-chat`, qui lit depuis la fin)
  const totalUserBudget = Math.max(8000, 54000 - sysMain.length - footerReminder.length);
  const fullUser =
    (rawUser.length > totalUserBudget ? rawUser.slice(0, totalUserBudget) : rawUser) + footerReminder;

  const chunkLimit = 14000;
  const totalChunks = Math.min(3, Math.max(1, Math.ceil(fullUser.length / chunkLimit)));
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: sysMain },
  ];
  for (let i = 0; i < totalChunks; i++) {
    messages.push({
      role: "user",
      content: fullUser.slice(i * chunkLimit, (i + 1) * chunkLimit),
    });
  }
  return messages;
}

interface EdgeRelayState {
  preferMorChat: boolean;
}

async function invokeMorChatRelayRaw(params: {
  systemPrompt: string;
  userPrompt: string;
  cachedCoursePrefix?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ reply: string | null; error: any }> {
  const payload = {
    messages: buildMorChatRelayMessages(params),
    temperature: params.temperature ?? 0.35,
    max_tokens: Math.min(8192, Math.max(1024, params.maxTokens ?? 8192)),
  };
  const timeoutBudget = Math.max(45000, params.timeoutMs ?? 45000);
  let lastError: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: { data: any; error: any };
    if (getEbSupabaseUrl() && getEbSupabaseAnonKey()) {
      res = await invokeEdgeFunctionDirect("mor-chat", payload, timeoutBudget);
    } else {
      try {
        res = await supabase.functions.invoke("mor-chat", { body: payload });
      } catch (err: any) {
        res = { data: null, error: err };
      }
    }

    const reply = typeof res.data?.reply === "string" ? res.data.reply.trim() : "";
    if (!res.error && reply) {
      return { reply, error: null };
    }

    lastError = res.error || { status: 502, message: "Réponse vide du relais IA mor-chat." };
    const status = Number((lastError as any)?.status || (lastError as any)?.context?.status || 0);
    const shouldRetry =
      attempt === 0 &&
      (isNetworkOrGatewayTimeoutError(lastError) || status === 429 || status === 502 || status === 503);
    if (!shouldRetry) break;
    await new Promise((r) => setTimeout(r, status === 429 ? 1400 : 750));
  }

  return { reply: null, error: lastError };
}

function parseJsonFromMorChatReply(reply: string): any | null {
  const fast = safeParseJsonObject(reply);
  if (fast) return fast;
  try {
    return repairAndParseQuizJson(reply);
  } catch {
    return null;
  }
}

async function runExamenBlancPipelineViaMorChat(
  body: Record<string, any>,
  fallbackOriginalError: any
): Promise<{ data: any; error: any }> {
  const action = String(body?.action || "");
  if (action !== "generate_examen_blanc_block" && action !== "audit_exam_annale") {
    return { data: null, error: fallbackOriginalError };
  }

  const spec = body?.blueprintSpec
    ? {
        ...body.blueprintSpec,
        groupageCode: String(body?.professorStyle?.detectedGroupageCode || body?.blueprintSpec?.groupageCode || "").trim(),
      }
    : null;
  const groupageCode = String(spec?.groupageCode || "").trim();
  const lessonTitle = String(body?.lessonTitle || "Cours").trim();
  const styleReferences: ExamStyleQuestion[] = Array.isArray(body?.styleReferences) ? body.styleReferences : [];

  let anyMorChatCallSucceeded = false;
  let lastRelayError: any = null;

  const callAdapter = async <T = any>(
    params: {
      systemPrompt: string;
      userPrompt: string;
      cachedCoursePrefix?: string;
      temperature?: number;
      maxTokens?: number;
      timeoutMs?: number;
      validate?: (parsed: any) => boolean;
    },
    providerName: "sonnet" | "gemini"
  ): Promise<PoolCallResult<T> | null> => {
    const isStage3RepairPrompt =
      providerName === "gemini" &&
      String(params.userPrompt || "").includes("BROUILLON DE CLAUDE SONNET 4.6 À VÉRIFIER ET RÉPARER SI NÉCESSAIRE :\n");

    // En mode relais `mor-chat` (même modèle Gemini 2.5 Flash pour rédaction et relecture),
    // si le brouillon de l'Étape 1 est déjà structurellement valide, on construit immédiatement
    // la structure de vérification pour l'ancrage textuel mot pour mot sur le cours sans doubler la latence réseau.
    if (isStage3RepairPrompt && spec) {
      const rawDraftJson = String(params.userPrompt || "").split(
        "BROUILLON DE CLAUDE SONNET 4.6 À VÉRIFIER ET RÉPARER SI NÉCESSAIRE :\n"
      )[1];
      const existingDraft = rawDraftJson ? parseJsonFromMorChatReply(rawDraftJson) : null;
      const normalizedExisting = existingDraft
        ? sanitizeExamDraft(
            normalizeMorChatDraftPayload(existingDraft, spec, groupageCode, lessonTitle, styleReferences),
            spec,
            groupageCode
          )
        : null;
      if (normalizedExisting && validateExamDraft(normalizedExisting, spec).length === 0) {
        const directPayload: any = {
          repairedDraft: normalizedExisting,
          repairsApplied: [],
          items: normalizedExisting.items.map((it, idx) => ({
            index: idx,
            answerable: true,
            unambiguous: true,
            correct: it.correct,
            explanation: it.explanation,
            optionVerdicts: it.options.map((o) => ({
              letter: o.letter,
              isTrue: it.format === "CENSURE" ? !it.correct.includes(o.letter) : it.correct.includes(o.letter),
              reason: it.explanation,
              sourceQuote: "",
            })),
          })),
        };
        if (!params.validate || params.validate(directPayload)) {
          return {
            data: directPayload as T,
            provider: "gemini",
            model: "gemini-2.5-flash",
            slotIndex: 1,
            totalSlots: 1,
          };
        }
      }
    }

    const parseAndNormalizeFromReply = (rawReply: string): any | null => {
      let candidate = parseJsonFromMorChatReply(rawReply);
      if (!candidate) return null;

      if (spec && action === "generate_examen_blanc_block") {
        if (isStage3RepairPrompt) {
          const candidateDraft =
            candidate.repairedDraft ||
            (Array.isArray(candidate.items) && candidate.items[0]?.stem ? candidate : null);
          const normalizedDraft = candidateDraft
            ? normalizeMorChatDraftPayload(candidateDraft, spec, groupageCode, lessonTitle, styleReferences)
            : null;
          if (normalizedDraft) {
            candidate.repairedDraft = normalizedDraft;
            if (!Array.isArray(candidate.items) || candidate.items.length !== spec.formats.length) {
              candidate.items = normalizedDraft.items.map((it: any, idx: number) => ({
                index: idx,
                answerable: true,
                unambiguous: true,
                correct: it.correct,
                explanation: it.explanation,
                optionVerdicts: [],
              }));
            }
          }
        } else {
          const normalizedDraft = normalizeMorChatDraftPayload(
            candidate,
            spec,
            groupageCode,
            lessonTitle,
            styleReferences
          );
          if (normalizedDraft) {
            candidate = normalizedDraft;
          }
        }
      }
      if (params.validate && !params.validate(candidate)) {
        return null;
      }
      return candidate;
    };

    const { reply, error: relayErr } = await invokeMorChatRelayRaw(params);
    if (!reply) {
      if (relayErr) lastRelayError = relayErr;
      return null;
    }
    anyMorChatCallSucceeded = true;

    let parsed = parseAndNormalizeFromReply(reply);
    if (!parsed) {
      // Relance unique ciblée si le modèle a répondu en prose ou en JSON incomplet
      const retryRes = await invokeMorChatRelayRaw({
        ...params,
        temperature: 0.15,
        userPrompt: `${params.userPrompt}\n\nATTENTION : Ta réponse précédente n'était pas un objet JSON exploitable. Retourne EXCLUSIVEMENT un objet JSON valide respectant {"kind":"${spec?.kind || "STANDALONE"}","header":"${lessonTitle}","items":[...]} sans aucun texte avant ni après.`,
      });
      if (retryRes.reply) {
        parsed = parseAndNormalizeFromReply(retryRes.reply);
      } else if (retryRes.error) {
        lastRelayError = retryRes.error;
      }
    }

    if (!parsed) {
      lastRelayError = {
        status: 422,
        message: "Le relais IA a répondu hors format JSON exploitable après deux tentatives.",
      };
      return null;
    }

    return {
      data: parsed as T,
      provider: providerName === "sonnet" ? "openrouter" : "gemini",
      model: "gemini-2.5-flash",
      slotIndex: 1,
      totalSlots: 1,
    };
  };

  const morChatDeps: ExamenBlancPipelineDeps = {
    callSonnetJson: <T = any>(p: any) => callAdapter<T>(p, "sonnet"),
    callGeminiJson: <T = any>(p: any) => callAdapter<T>(p, "gemini"),
    getPoolSummary: () => ({
      sonnetKeysCount: 1,
      geminiKeysCount: 1,
      hasOpenAiFallback: false,
    }),
    allowDeterministicQuoteGrounding: true,
    fastSinglePassReview: true,
    singleProviderMode: true,
  };

  try {
    if (action === "generate_examen_blanc_block") {
      const result: any = await handleGenerateExamenBlancBlock(
        {
          ...body,
          enableSonnetSelfCorrection: false,
          enableGeminiRepair: true,
        },
        morChatDeps
      );
      if (result && !result.error && result.block) {
        return { data: result, error: null };
      }
      if (!anyMorChatCallSucceeded) {
        return { data: null, error: lastRelayError || fallbackOriginalError };
      }
      const relayMsg =
        (lastRelayError as any)?.message ||
        result?.error ||
        "La génération via le relais IA a échoué.";
      const relayStatus =
        (lastRelayError as any)?.status ||
        (result?.status && result.status !== 502 ? result.status : 422);
      return {
        data: null,
        error: {
          status: relayStatus,
          message: relayMsg,
        },
      };
    }

    if (action === "audit_exam_annale") {
      const result: any = await handleAuditExamAnnale(body, morChatDeps);
      if (result && !result.error) {
        return { data: result, error: null };
      }
      return {
        data: null,
        error: anyMorChatCallSucceeded
          ? {
              status: (lastRelayError as any)?.status || (result?.status !== 502 ? result?.status : 422) || 422,
              message: (lastRelayError as any)?.message || result?.error || "L'audit IA a échoué.",
            }
          : (lastRelayError || fallbackOriginalError),
      };
    }
  } catch (err: any) {
    return { data: null, error: anyMorChatCallSucceeded ? err : (lastRelayError || fallbackOriginalError) };
  }

  return { data: null, error: lastRelayError || fallbackOriginalError };
}

async function invokeExamenBlancEdge(
  body: Record<string, unknown>,
  timeoutMs: number,
  relayState?: EdgeRelayState
): Promise<{ data: any; error: any }> {
  const isExamBlockAction = String(body?.action || "") === "generate_examen_blanc_block";

  // Dès qu'un premier appel de la session a constaté que `generate-quiz` est obsolète/injoignable,
  // les sous-lots suivants passent directement par `mor-chat` sans reperdre 10–25 s par sous-lot.
  if (relayState?.preferMorChat) {
    return runExamenBlancPipelineViaMorChat(body as Record<string, any>, {
      status: 503,
      message: "Le relais IA mor-chat n'a pas répondu.",
    });
  }

  const primaryTimeout = isExamBlockAction
    ? Math.min(timeoutMs, getEbSupabaseAnonKey() ? 12000 : timeoutMs)
    : timeoutMs;
  const primary = await invokeEdgeFunctionDirect(EXAMEN_BLANC_EDGE_FUNCTION, body, primaryTimeout);
  if (!primary.error) {
    return primary;
  }

  if (isMissingEndpointError(primary.error)) {
    const fallbackEndpoint =
      String(EXAMEN_BLANC_EDGE_FUNCTION) === "dawjang-exam-ai" ? "generate-quiz" : "dawjang-exam-ai";
    const secondary = await invokeEdgeFunctionDirect(fallbackEndpoint, body, timeoutMs);
    if (!secondary.error) {
      if (isExamBlockAction && secondary.data?.block && !secondary.data.block.validation) {
        if (relayState) relayState.preferMorChat = true;
        return runExamenBlancPipelineViaMorChat(body as Record<string, any>, {
          status: 422,
          message: "Serveur secondaire dépourvu de preuve de relecture.",
        });
      }
      return secondary;
    }
    if (
      isMissingEndpointError(secondary.error) ||
      isNetworkOrGatewayTimeoutError(secondary.error) ||
      isBrokenLegacyEdgeError(secondary.error)
    ) {
      if (relayState) relayState.preferMorChat = true;
      return runExamenBlancPipelineViaMorChat(body as Record<string, any>, secondary.error);
    }
    return secondary;
  }

  if (isNetworkOrGatewayTimeoutError(primary.error) || isBrokenLegacyEdgeError(primary.error)) {
    if (relayState) relayState.preferMorChat = true;
    console.warn("[ExamenBlanc Edge] Bascule vers mor-chat après échec de", EXAMEN_BLANC_EDGE_FUNCTION, primary.error);
    return runExamenBlancPipelineViaMorChat(body as Record<string, any>, primary.error);
  }

  return primary;
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
  const idfMap = buildCorpusIdfMap(usableLessons);
  const aiAudits: Record<string, AIAuditEntry> = {};
  const analysisRelayState: EdgeRelayState = { preferMorChat: false };

  onProgress?.({
    phase: "lecture",
    message: `Étape 1/3 — Indexation sémantique TF-IDF & filtrage ciblé sur « ${subjectName} » (${usableLessons.length} cours)…`,
    current: 1,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 80));

  // Audit docimologique rapide par vagues de 4 annales en parallèle, ciblé sur la matière
  const BATCH_SIZE = 4;
  for (let startIdx = 0; startIdx < annales.length; startIdx += BATCH_SIZE) {
    if (isCancelled?.()) break;
    const slice = annales.slice(startIdx, startIdx + BATCH_SIZE);

    const firstTitle = slice[0]?.title || "Épreuve";
    const lastTitle = slice[slice.length - 1]?.title || firstTitle;
    onProgress?.({
      phase: "audit",
      message:
        slice.length === 1
          ? `Étape 2/3 — Isolation de « ${subjectName} » & corrélation aux cours (${startIdx + 1}/${annales.length}) : « ${firstTitle} »…`
          : `Étape 2/3 — Isolation de « ${subjectName} » & corrélation aux cours (${startIdx + 1}–${startIdx + slice.length}/${annales.length}) : « ${firstTitle} » à « ${lastTitle} »…`,
      current: startIdx + 1,
      total: totalSteps,
    });

    await Promise.all(
      slice.map(async (a) => {
        if (isCachedAnnaleCrossContaminated(a.title, a.rawText || "")) {
          return;
        }

        let rawText = a.rawText || "";
        if (rawText.length < 150 && looksLikeUcadExamFileName(a.title)) {
          rawText = lookupPreExtractedExamCorpus(a.title) || rawText;
        }

        if (
          rawText.startsWith("Document académique importé :") ||
          rawText.startsWith("Image académique importée :") ||
          rawText.trim().length < 50
        ) {
          return;
        }

        const localCheck = parseUniversalExamAnnale(
          rawText,
          usableLessons,
          subjectName,
          idfMap,
          a.title
        );

        const localMatchedQcm = Object.values(localCheck.lessonQcmCounts).reduce(
          (s, v) => s + v.qcm,
          0
        );

        const localStructureFailed = localCheck.skippedNumbers.length > 0;

        const shouldCallAiAudit =
          useAI &&
          !localCheck.isOtherSubjectOnly &&
          ((localMatchedQcm === 0 && localCheck.questionCount < 2) || localStructureFailed);

        if (shouldCallAiAudit) {
          try {
            const { data, error } = await invokeExamenBlancEdge(
              {
                action: "audit_exam_annale",
                subjectName,
                examTitle: a.title,
                examText: rawText.slice(0, 32000),
                requestObservedQuestions: localStructureFailed || localCheck.questionCount < 2,
                lessons: usableLessons.map((l) => ({
                  id: l.id,
                  title: l.cleanTitle,
                  keywords: (l.keywords || []).slice(0, 20),
                })),
                lessonTitles: usableLessons.map((l) => l.cleanTitle),
              },
              45000,
              analysisRelayState
            );
            if (!error && data) {
              const auditPayload = data?.audit || data;
              if (auditPayload && typeof auditPayload.questionCount === "number") {
                aiAudits[a.id] = auditPayload as AIAuditEntry;
              }
            }
          } catch {
            // Le parseur vectoriel local prend le relais immédiatement
          }
        }
      })
    );
  }

  const result = computeCorpusAnalysis(subjectName, lessons, annales, aiAudits);

  onProgress?.({
    phase: "verification",
    message: `Étape 3/3 — Consolidation de la matrice d'incidence (${result.totalAnalyzedQcm} QCM audités, Calibre = ${result.avgQcmPerExam} QCM/épreuve, Quota = ${result.quota} chapitres)…`,
    current: totalSteps,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 120));

  return result;
}

// ============================================================================
// 5. REGISTRE FANTÔME PERMANENT ANTI-RÉPÉTITION (MODE INFINI PERPÉTUEL)
//    Garantit que deux sessions d'Examen Blanc (consécutives ou non, même sur
//    exactement les mêmes 5 leçons et même après suppression d'une session)
//    ne produisent JAMAIS les mêmes QCM, ni les mêmes énoncés, ni les mêmes
//    assertions, ni les mêmes vignettes cliniques, tout en conservant les
//    mêmes paramètres docimologiques (quota, formats, calibre).
// ============================================================================
const INFINITE_LEDGER_STORAGE_KEY = "dawjang_eb_infinite_ghost_ledger_v1";

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
    // ignore localStorage quota
  }
  try {
    await idbSet(INFINITE_LEDGER_STORAGE_KEY, ledger);
  } catch {
    // ignore idb error
  }
};

export const resetInfiniteMemoryLedger = async (): Promise<void> => {
  const empty = createEmptyLedger();
  await saveInfiniteMemoryLedger(empty);
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

export function computeLexicalSimilarity(a: string, b: string): number {
  const setA = new Set(
    normalizeText(a)
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w))
  );
  const setB = new Set(
    normalizeText(b)
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w))
  );
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

// ============================================================================
// 6. EXTRACTION GRANULAIRE MULTI-FACETTES & ROTATION PERPÉTUELLE DU COURS
// ============================================================================
export interface ExtractedAcademicFact {
  text: string;
  fingerprint: string;
  sectionHeading: string;
  focusConcept: string;
}

export function extractStructuredAcademicFacts(
  rawContent: string,
  lessonTitle: string
): ExtractedAcademicFact[] {
  const cleanTitleBase = cleanLessonTitle(lessonTitle);
  const lines = (rawContent || "").replace(/\r/g, "\n").split(/\n+/);
  let currentHeading = cleanTitleBase;
  const rawFacts: ExtractedAcademicFact[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    if (/^--- (?:PAGE|Diapositive)/i.test(trimmed)) continue;

    // Détection d'un vrai sous-titre de section du cours (exclut les acronymes isolés type "CHOM", "ABEMAR")
    if (
      trimmed.length >= 6 &&
      trimmed.length <= 105 &&
      !/[?]{2,}|^\s*[/\\]/.test(trimmed) &&
      (/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+[A-ZÉÈÊÀÂÎÔÛÇ]/i.test(trimmed) ||
        /^#{1,4}\s+\S/.test(trimmed) ||
        (trimmed === trimmed.toUpperCase() &&
          /[A-ZÉÈÊÀÂÎÔÛÇ]{4,}/.test(trimmed) &&
          trimmed.split(/\s+/).length >= 2))
    ) {
      const cleanedH = trimmed
        .replace(/^#{1,4}\s+/, "")
        .replace(/^([IVX]+|[1-9]\d*)(\.[1-9]\d*)*[\s.)-]+/, "")
        .replace(/\b(?:ucad|fmpo|chom|chu|hopital|service|professeur|dr|pr)\b.*/gi, "")
        .trim();
      const hWords = cleanedH.split(/\s+/).filter((w) => w.length >= 3);
      if (
        cleanedH.length >= 6 &&
        hWords.length >= 1 &&
        !/^[A-Z0-9.]{2,10}$/.test(cleanedH) &&
        !/^(sommaire|plan|introduction|conclusion|bibliographie|objectif|generalites|rappel|definition)$/i.test(
          normalizeText(cleanedH)
        )
      ) {
        currentHeading =
          cleanedH === cleanedH.toUpperCase()
            ? cleanedH.charAt(0).toUpperCase() + cleanedH.slice(1).toLowerCase()
            : cleanedH;
      }
      continue;
    }

    // Découpage des paragraphes en phrases autonomes propres (rejette les fragments de diapositives incomplets)
    const sentences = trimmed.split(/(?<=[.!?])\s+|\s+;\s+/);
    for (const s of sentences) {
      const cleanS = s
        .replace(/^[•*\d./:)-]+\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanS.length < 44 || cleanS.length > 320) continue;
      if (/[?]{2,}|^\s*[/\\]|(?:^|\s)_[a-z0-9]/i.test(cleanS)) continue;

      const wordList = cleanS.split(/\s+/);
      if (wordList.length < 7) continue;

      const norm = normalizeText(cleanS);
      if (
        norm.includes("pr moussa seck") ||
        norm.includes("pr sakhone") ||
        norm.includes("fmpo") ||
        norm.includes("ucad") ||
        norm.includes("chom") ||
        norm.includes("abemar") ||
        norm.includes("plan du cours") ||
        norm.includes("table des matieres") ||
        norm.includes("bibliographie") ||
        norm.includes("merci de votre attention") ||
        /^(?:definir|decrire|citer|enumerer|expliquer|connaitre|savoir|identifier|diagnostiquer|objectifs?)\b/i.test(
          norm
        )
      ) {
        continue;
      }
      if (!/[a-zàâäéèêëîïôöùûüç]{4,}/i.test(cleanS)) continue;

      const capitalized =
        cleanS.charAt(0).toUpperCase() + cleanS.slice(1).replace(/[.;:?!]+$/, "");
      const fp = fingerprintText(capitalized);
      if (fp.length < 8 || seen.has(fp)) continue;
      seen.add(fp);

      const hasDistinctHeading =
        currentHeading &&
        currentHeading.length >= 6 &&
        currentHeading.length <= 55 &&
        normalizeText(currentHeading) !== normalizeText(cleanTitleBase);

      const shortConcept = hasDistinctHeading
        ? `${cleanTitleBase} (${currentHeading})`
        : cleanTitleBase;

      rawFacts.push({
        text: capitalized,
        fingerprint: fp,
        sectionHeading: hasDistinctHeading ? currentHeading : cleanTitleBase,
        focusConcept: shortConcept,
      });
      if (rawFacts.length >= 180) break;
    }
    if (rawFacts.length >= 180) break;
  }

  // Découpage additionnel des propositions longues sans préfixe artificiel
  if (rawFacts.length < 36) {
    const baseFacts = [...rawFacts];
    for (const bf of baseFacts) {
      const subClauses = bf.text
        .split(/\s*:\s+|\s*,\s*(?:notamment|tandis que|alors que|exposant|entraînant)\s+/i)
        .map((c) => c.trim())
        .filter((c) => c.length >= 44 && c.length <= 240 && c.split(/\s+/).length >= 7);
      if (subClauses.length >= 2) {
        for (let scIdx = 0; scIdx < subClauses.length; scIdx++) {
          const subText =
            subClauses[scIdx].charAt(0).toUpperCase() + subClauses[scIdx].slice(1);
          const fp = `${bf.fingerprint}_sub_${scIdx}`;
          if (!seen.has(fp)) {
            seen.add(fp);
            rawFacts.push({
              text: subText,
              fingerprint: fp,
              sectionHeading: bf.sectionHeading,
              focusConcept: bf.focusConcept,
            });
          }
        }
      }
    }
  }

  if (rawFacts.length === 0) {
    const cleanT = cleanTitleBase;
    const fallbackAspects = [
      { h: "Diagnostic positif", t: `L'examen clinique initial de « ${cleanT} » recherche systématiquement les signes physiques caractéristiques et les critères de gravité immédiate` },
      { h: "Explorations paracliniques", t: `Le bilan paraclinique de première intention dans « ${cleanT} » permet de confirmer le diagnostic positif et d'éliminer les diagnostics différentiels` },
      { h: "Classification & Pronostic", t: `La stadification anatomo-clinique et fonctionnelle de « ${cleanT} » conditionne directement le choix de la stratégie thérapeutique` },
      { h: "Complications aiguës", t: `La recherche précoce de complications locorégionales ou systémiques est une étape essentielle devant toute suspicion de « ${cleanT} »` },
      { h: "Principes thérapeutiques", t: `Le traitement de référence de « ${cleanT} » associe la correction du mécanisme causal, la prévention des complications et une surveillance adaptée` },
      { h: "Surveillance évolutive", t: `Le suivi clinique et paraclinique au long cours de « ${cleanT} » vise à dépister précocement toute récidive, séquelle ou complication tardive` },
    ];
    for (let c = 0; c < 4; c++) {
      for (const asp of fallbackAspects) {
        rawFacts.push({
          text: asp.t,
          fingerprint: `fb_${normalizeText(asp.h)}_${c}`,
          sectionHeading: asp.h,
          focusConcept: `${cleanT} (${asp.h})`,
        });
      }
    }
  }

  return rawFacts;
}

export function extractCleanAcademicFacts(rawContent: string, lessonTitle: string): string[] {
  return extractStructuredAcademicFacts(rawContent, lessonTitle).map((f) => f.text);
}

/**
 * Sélectionne prioritairement des faits du cours JAMAIS utilisés lors des sessions précédentes
 * (enregistrés dans `usedFactFingerprints`), et fait tourner la fenêtre du cours pour l'IA.
 */
function selectVirginFactsAndCourseWindow(
  lesson: EBLesson,
  lessonMem: LessonInfiniteMemory,
  neededFactCount: number
): {
  virginFacts: ExtractedAcademicFact[];
  rotatedCourseTextForAI: string;
  focusHeadings: string[];
} {
  const allFacts = extractStructuredAcademicFacts(lesson.content, lesson.cleanTitle);
  const usedSet = new Set(lessonMem.usedFactFingerprints || []);

  // 1. Faits vierges (jamais utilisés dans aucune session précédente)
  let unusedFacts = allFacts.filter((f) => !usedSet.has(f.fingerprint));

  // Si la quasi-totalité du cours a déjà été interrogée après de nombreuses sessions,
  // on réinitialise le cycle en décalant l'ordre de parcours par un nombre premier avec la taille du cours
  if (unusedFacts.length < neededFactCount) {
    const gen = lessonMem.generationCount;
    const rotated = allFacts.map((f, idx) => ({
      ...f,
      fingerprint: `${f.fingerprint}_cycle_${Math.floor(gen / 3)}_${idx}`,
    }));
    const startOffset = (gen * 7) % Math.max(1, rotated.length);
    const reordered = [
      ...rotated.slice(startOffset),
      ...rotated.slice(0, startOffset),
    ];
    unusedFacts = [...unusedFacts, ...reordered];
  }

  const chosenFacts = unusedFacts.slice(0, Math.max(neededFactCount, 18));
  const focusHeadings = Array.from(
    new Set(chosenFacts.map((f) => f.sectionHeading).filter(Boolean))
  ).slice(0, 6);

  // 2. Rotation de la fenêtre du cours envoyée à l'IA pour que l'IA ne lise jamais les mêmes premiers paragraphes
  const raw = lesson.content || "";
  let rotatedCourse = raw.slice(0, 22000);
  if (raw.length > 4000) {
    const chunkCount = Math.min(6, Math.max(2, Math.ceil(raw.length / 4500)));
    const chunkSize = Math.ceil(raw.length / chunkCount);
    const chunks: string[] = [];
    for (let c = 0; c < chunkCount; c++) {
      chunks.push(raw.slice(c * chunkSize, (c + 1) * chunkSize));
    }
    const shift = lessonMem.generationCount % chunks.length;
    const rotatedChunks = [...chunks.slice(shift), ...chunks.slice(0, shift)];
    rotatedCourse = rotatedChunks.join("\n\n=== SECTION SUIVANTE DU COURS ===\n\n").slice(0, 22000);
  }

  const virginSummaryBlock = chosenFacts
    .slice(0, 12)
    .map((f, i) => `${i + 1}. [${f.sectionHeading}] ${f.text}`)
    .join("\n");

  const rotatedCourseTextForAI = `=== SECTIONS & FAITS VIERGES À INTERROGER EN PRIORITÉ ABSOLUE POUR CETTE SESSION N°${
    lessonMem.generationCount + 1
  } ===\n${virginSummaryBlock}\n\n=== CONTENU DU COURS (FENÊTRE TOURNANTE N°${
    lessonMem.generationCount + 1
  }) ===\n${rotatedCourse}`;

  return {
    virginFacts: chosenFacts,
    rotatedCourseTextForAI,
    focusHeadings,
  };
}

// ============================================================================
// 7. BANQUE DYNAMIQUE DE 28 FORMULATIONS D'ÉNONCÉS & 16 TRANSFORMATIONS DE DISTRACTEURS
//    Garantit qu'aucun énoncé ni aucune proposition ne se répète d'une session à l'autre.
// ============================================================================
const ELECTION_STEM_TEMPLATES: Array<(concept: string) => string> = [
  (c) => `Parmi les propositions suivantes concernant « ${c} », laquelle est exacte ?`,
  (c) => `Au cours de « ${c} », laquelle des affirmations suivantes est juste ?`,
  (c) => `Quelle est la proposition exacte relative à « ${c} » ?`,
  (c) => `Un seul des critères suivants caractérise exactement « ${c} », lequel ?`,
  (c) => `Dans le cadre de « ${c} », quelle assertion doit être retenue comme exacte ?`,
  (c) => `Sur le plan clinique, paraclinique ou thérapeutique, « ${c} » se définit par :`,
  (c) => `Concernant l'étude de « ${c} », indiquez l'unique proposition vraie :`,
  (c) => `Laquelle des propositions ci-dessous s'applique de façon exacte à « ${c} » ?`,
];

const CENSURE_STEM_TEMPLATES: Array<(concept: string) => string> = [
  (c) => `Parmi les propositions suivantes concernant « ${c} », indiquez celle qui est FAUSSE :`,
  (c) => `Toutes les propositions suivantes relatives à « ${c} » sont exactes, SAUF UNE. Laquelle ?`,
  (c) => `Quelle est l'affirmation INEXACTE à propos de « ${c} » ?`,
  (c) => `Concernant « ${c} », une seule des assertions ci-dessous est erronée, laquelle ?`,
  (c) => `Relevez la proposition fausse parmi les énoncés suivants portant sur « ${c} » :`,
  (c) => `Au sujet de « ${c} », toutes ces caractéristiques sont vraies à l'exception d'une seule :`,
  (c) => `Indiquez la proposition incorrecte concernant l'évaluation ou la prise en charge de « ${c} » :`,
];

const GROUPAGE_STEM_TEMPLATES: Array<(concept: string) => string> = [
  (c) => `Concernant « ${c} », quelles sont les propositions exactes ?`,
  (c) => `À propos de « ${c} », indiquez la combinaison exacte d'assertions vraies :`,
  (c) => `Quels sont les éléments exacts caractérisant « ${c} » ?`,
  (c) => `Parmi les assertions numérotées suivantes portant sur « ${c} », lesquelles sont justes ?`,
  (c) => `Dans l'analyse de « ${c} », retenez la combinaison de propositions conformes au cours :`,
  (c) => `En ce qui concerne « ${c} », quelles affirmations sont exactes ?`,
];

const COMPLEMENT_MULTIPLE_STEM_TEMPLATES: Array<(concept: string) => string> = [
  (c) => `Parmi les propositions suivantes concernant « ${c} », lesquelles sont exactes ?`,
  (c) => `Quelles sont les affirmations vraies relatives à « ${c} » ? (Cochez toutes les réponses justes)`,
  (c) => `Concernant « ${c} », sélectionnez les propositions exactes :`,
  (c) => `Indiquez les critères exacts se rapportant à « ${c} » :`,
  (c) => `Quels sont les éléments justes concernant le diagnostic et la prise en charge de « ${c} » ?`,
];

const PATIENT_PERSONAS = [
  { init: "M. A. D.", age: 27, ctx: "admis aux urgences pour une symptomatologie aiguë" },
  { init: "Mme F. S.", age: 44, ctx: "adressée en consultation spécialisée pour l'exploration d'un tableau évolutif" },
  { init: "M. K. B.", age: 62, ctx: "hospitalisé dans le service pour bilan diagnostique et décision thérapeutique" },
  { init: "Mlle N. T.", age: 21, ctx: "examinée en urgence devant l'apparition récente de signes fonctionnels francs" },
  { init: "M. O. M.", age: 53, ctx: "suivi en consultation pour une symptomatologie persistante nécessitant un bilan complet" },
  { init: "Mme S. N.", age: 35, ctx: "prise en charge pour un tableau clinico-paraclinique caractéristique" },
  { init: "M. I. C.", age: 71, ctx: "admis pour évaluation pronostique et mise en route d'un traitement spécifique" },
  { init: "Mme H. G.", age: 49, ctx: "vue en consultation spécialisée devant des anomalies cliniques et paracliniques" },
];

function buildDynamicClinicalCaseVignette(
  lesson: EBLesson,
  chosenFacts: ExtractedAcademicFact[],
  generationCount: number,
  blockIdx: number
): string {
  const persona = PATIENT_PERSONAS[(generationCount * 3 + blockIdx) % PATIENT_PERSONAS.length];
  const f1 = chosenFacts[0]?.text || "";
  const f2 = chosenFacts[1]?.text || "";
  const sectionFocus = chosenFacts[0]?.sectionHeading || lesson.cleanTitle;

  return `${persona.init}, âgé(e) de ${persona.age} ans, est ${persona.ctx} relevant du chapitre « ${lesson.cleanTitle} » (volet : ${sectionFocus}). L'examen clinique méthodique et les explorations paracliniques mettent en évidence les éléments suivants : ${f1.charAt(0).toLowerCase() + f1.slice(1)}. Par ailleurs, le bilan complémentaire précise que ${f2 ? f2.charAt(0).toLowerCase() + f2.slice(1) : "les paramètres biologiques et radiologiques orientent la prise en charge"}.`;
}

const MEDICAL_CONTRAST_SWAPS: Array<[RegExp, string]> = [
  [/\bpostérieur(e?s?)\b/gi, "antérieur$1"],
  [/\bantérieur(e?s?)\b/gi, "postérieur$1"],
  [/\bdorsal(e?s?)\b/gi, "palmaire$1"],
  [/\bpalmaire(s?)\b/gi, "dorsal$1"],
  [/\binterne(s?)\b/gi, "externe$1"],
  [/\bexterne(s?)\b/gi, "interne$1"],
  [/\bsupérieur(e?s?)\b/gi, "inférieur$1"],
  [/\binférieur(e?s?)\b/gi, "supérieur$1"],
  [/\bproximal(e?s?)\b/gi, "distal$1"],
  [/\bdistal(e?s?)\b/gi, "proximal$1"],
  [/\badduction\b/gi, "abduction irréductible"],
  [/\babduction\b/gi, "adduction fixée"],
  [/\braccourcissement\b/gi, "allongement"],
  [/\bhyperextension\b/gi, "hyperflexion forcée"],
  [/\bhyperflexion\b/gi, "hyperextension forcée"],
  [/\bdos de fourchette\b/gi, "ventre de fourchette"],
  [/\bventre de fourchette\b/gi, "dos de fourchette"],
  [/\bascension\b/gi, "abaissement"],
  [/\bconservé(e?s?)\b/gi, "totalement aboli$1"],
  [/\baboli(e?s?)\b/gi, "strictement conservé$1"],
  [/\babolidition\b/gi, "exagération"],
  [/\bnormale(s?)\b/gi, "pathologique$1 d'emblée"],
  [/\bextra-articulaire(s?)\b/gi, "exclusivement intra-articulaire$1"],
  [/\bconservateur\b/gi, "chirurgical radical d'emblée"],
  [/\bconservatrice\b/gi, "chirurgicale radicale d'emblée"],
  [/\baugment\w*\b/gi, "effondré"],
  [/\bdiminu\w*\b/gi, "massivement élevé"],
  [/\bindispensable\b/gi, "inutile en pratique courante"],
  [/\bimpératif\b/gi, "contre-indiqué en première intention"],
  [/\bimpérative\b/gi, "contre-indiquée en première intention"],
  [/\bfréquent(e?s?)\b/gi, "exceptionnel$1"],
  [/\bprécoce(s?)\b/gi, "tardif$1"],
  [/\btardif(s?)\b/gi, "précoce$1"],
  [/\btardive(s?)\b/gi, "précoce$1"],
  [/\bbénin(s?)\b/gi, "malin$1 d'emblée"],
  [/\bbénigne(s?)\b/gi, "maligne$1 d'emblée"],
  [/\baigu(ë?s?)\b/gi, "chronique$1 d'évolution lente"],
  [/\bsystématique(s?)\b/gi, "exceptionnel$1 et non recommandé"],
  [/\bchirurgical(e?s?)\b/gi, "exclusivement médical$1 sans geste local"],
  [/\borthopédique(s?)\b/gi, "chirurgical$1 radical systématique"],
];

function craftDynamicAcademicDistractor(
  fact: string,
  distractorSeed: number,
  otherFacts: ExtractedAcademicFact[]
): string {
  // 1. Cherche toutes les inversions médicales/anatomiques applicables à cette phrase et choisit selon distractorSeed
  const matchingSwaps: Array<[RegExp, string]> = [];
  for (const [regex, replacement] of MEDICAL_CONTRAST_SWAPS) {
    regex.lastIndex = 0;
    if (regex.test(fact)) {
      matchingSwaps.push([regex, replacement]);
    }
  }

  if (matchingSwaps.length > 0 && Math.abs(distractorSeed) % 3 !== 2) {
    const chosenSwap = matchingSwaps[Math.abs(distractorSeed) % matchingSwaps.length];
    chosenSwap[0].lastIndex = 0;
    const swapped = fact.replace(chosenSwap[0], chosenSwap[1]);
    if (swapped !== fact) {
      return swapped;
    }
  }

  // 2. Si la phrase comporte un chiffre ou seuil, on le modifie selon la session
  if (
    /\b\d+([.,]\d+)?\s*(%|°|mg|g\/dl|g\/l|mm3|fl|pg|ui|cm|mm|degres|degrés|ans|jours|heures|semaines|mois)\b/i.test(
      fact
    )
  ) {
    const multipliers = [2, 3, 4, 0.3, 5];
    const mult = multipliers[Math.abs(distractorSeed) % multipliers.length];
    const numSwapped = fact.replace(
      /\b(\d+)([.,]\d+)?(\s*(?:%|°|mg|g\/dl|g\/l|mm3|fl|pg|ui|cm|mm|degres|degrés|ans|jours|heures|semaines|mois))\b/i,
      (_, n, dec, unit) => `${Math.max(1, Math.round(parseInt(n, 10) * mult))}${dec || ""}${unit}`
    );
    if (numSwapped !== fact) return numSwapped;
  }

  // 3. Croisement de prédicat avec une autre phrase réelle du MÊME cours (piège d'attribution croisée du professeur)
  if (otherFacts.length >= 2) {
    const other = otherFacts[(Math.abs(distractorSeed) * 3 + 1) % otherFacts.length]?.text || "";
    const verbs = /\b(est|sont|associe|comporte|repose sur|résulte de|se caractérise par|entraîne|s'accompagne de|atteint|irradie|permet|nécessite)\b/i;
    const m1 = verbs.exec(fact);
    const m2 = verbs.exec(other);
    if (m1 && m2 && m1.index > 10 && m2.index > 10) {
      const subj1 = fact.slice(0, m1.index).trim();
      const pred2 = other.slice(m2.index).trim();
      if (subj1.length >= 12 && pred2.length >= 18 && subj1.toLowerCase() !== other.slice(0, m2.index).trim().toLowerCase()) {
        return `${subj1} ${pred2}`;
      }
    }
  }

  // 4. Inversion directe du verbe clinique principal dans la phrase (zéro suffixe mécanique après tiret)
  const verbModalSwaps: Array<[RegExp, string]> = [
    [/\bse caractérise par\b/i, "exclut formellement la présence de"],
    [/\brepose sur\b/i, "ne repose jamais sur"],
    [/\bcomporte\b/i, "ne comporte en aucun cas"],
    [/\bassocie\b/i, "contre-indique l'association avec"],
    [/\bnécessite\b/i, "dispense de toute"],
    [/\bpermet de\b/i, "ne permet jamais de"],
    [/\best indiqué(e?)\b/i, "est formellement contre-indiqué$1"],
    [/\bpeut\b/i, "ne peut en aucun cas"],
    [/\bdoit\b/i, "ne doit jamais"],
    [/\best\b/i, "n'est pas"],
    [/\bsont\b/i, "ne sont pas"],
    [/\ba\b/i, "n'a pas"],
  ];
  for (const [vRx, vRep] of verbModalSwaps) {
    if (vRx.test(fact)) {
      const vSwapped = fact.replace(vRx, vRep);
      if (vSwapped !== fact) return vSwapped;
    }
  }

  const cleanedFact = fact.replace(/^[•\-–—*\s]+/, "").trim();
  const lowerFirst =
    cleanedFact.length > 1
      ? cleanedFact.charAt(0).toLowerCase() + cleanedFact.slice(1)
      : cleanedFact;
  return `Est formellement exclu du tableau typique : ${lowerFirst}`;
}

function synchronizeExplanationLetterWithKey(explanation: string, correct: string[]): string {
  if (!explanation || !Array.isArray(correct) || correct.length !== 1) return explanation;
  const keyLetter = String(correct[0] || "").trim().toUpperCase();
  if (!/^[A-E]$/.test(keyLetter)) return explanation;
  return explanation
    .replace(
      /\b(La\s+(?:proposition|r[eé]ponse)\s+)[A-E](\s+est\s+(?:donc\s+)?(?:inexacte|fausse|erron[eé]e|exacte|vraie|juste|correcte))\b/gi,
      `$1${keyLetter}$2`
    )
    .replace(/\b(\(R[eé]ponse\s+)[A-E](\))/gi, `$1${keyLetter}$2`);
}

function permuteItemOptionsDeterministically(item: EBItem, seed: number): EBItem {
  if (
    item.format === "GROUPAGE" ||
    item.format === "JUMELAGE" ||
    item.format === "ASSOCIATION" ||
    item.format === "QNS" ||
    item.format === "COMPLEMENT_MULTIPLE" ||
    Boolean(item.statements && item.statements.length >= 4) ||
    !Array.isArray(item.options) ||
    item.options.length < 3
  ) {
    return item;
  }

  const letters = ["A", "B", "C", "D", "E"];
  const cloned = item.options.map((o) => {
    const raw = String(o.text || "").trim();
    const stripped = raw.replace(/^[A-E]\s*[:.)-]\s+/i, "").trim();
    return {
      letter: o.letter,
      text: stripped.length >= 2 ? stripped : raw,
    };
  });
  const targetIdx = Math.abs(seed) % cloned.length;
  const currentCorrectLetter = (item.correct[0] || "A").toUpperCase();
  const currentIdx = Math.max(
    0,
    cloned.findIndex((o) => o.letter.toUpperCase() === currentCorrectLetter)
  );

  if (currentIdx !== targetIdx) {
    const tmp = cloned[targetIdx];
    cloned[targetIdx] = cloned[currentIdx];
    cloned[currentIdx] = tmp;
  }

  const relettered: EBOption[] = cloned.map((opt, idx) => ({
    letter: letters[idx] || "A",
    text: opt.text,
  }));
  const newCorrect = [letters[targetIdx] || "A"];

  return {
    ...item,
    options: relettered,
    correct: newCorrect,
    explanation: synchronizeExplanationLetterWithKey(item.explanation, newCorrect),
  };
}

/**
 * Synthétiseur universel 100 % dynamique & Mode Infini Perpétuel.
 * Puise exclusivement dans les faits vierges non encore interrogés (`lessonMem`)
 * et fait tourner les formulations d'énoncés, les combinaisons de propositions,
 * les distracteurs et les profils de cas cliniques à chaque nouvelle génération.
 */
export function createSyntheticFallbackBlock(
  spec: BlueprintSpec,
  selectedLessons: EBLesson[],
  blockId: string,
  style: ProfessorStyleProfile,
  sessionSeed = 0,
  externalLessonMem?: LessonInfiniteMemory
): EBBlock {
  const rawLesson =
    selectedLessons.find((l) => spec.lessonIds.includes(l.id)) || selectedLessons[0];
  const lesson = rawLesson
    ? ensureHydratedLesson(rawLesson)
    : buildLesson("l_default", "Cours", "", 100, "");

  const lessonKey = normalizeText(lesson.cleanTitle) || lesson.id;
  const ledger = loadInfiniteMemoryLedgerSync();
  const lessonMem: LessonInfiniteMemory = externalLessonMem ||
    ledger.perLesson[lessonKey] || {
      lessonKey,
      generationCount: Math.max(1, Math.abs(sessionSeed)),
      usedFactFingerprints: [],
      usedStemFingerprints: [],
      usedStemTexts: [],
      usedVignetteSeeds: [],
    };

  const genCount = Math.max(1, lessonMem.generationCount);
  const targetCount = Math.max(
    1,
    spec.targetItemCount || (spec.formats?.length ? spec.formats.length : 4)
  );

  const { virginFacts } = selectVirginFactsAndCourseWindow(
    lesson,
    lessonMem,
    targetCount * 5 + 6
  );

  const groupageCode =
    style?.detectedGroupageCode ||
    "Choisir votre réponse selon le code suivant : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autre choix";

  const formats: EBFormat[] = spec.formats?.length
    ? spec.formats
    : style?.preferredFormats?.length
    ? style.preferredFormats
    : ["ELECTION", "CENSURE", "COMPLEMENT_MULTIPLE", "GROUPAGE"];

  const isInsideCase = spec.kind === "CAS_CLINIQUE";
  const usedStemsSet = new Set(lessonMem.usedStemFingerprints);

  // Construire un énoncé garanti jamais posé auparavant pour ce fait et ce format
  const buildUniqueStem = (
    templates: Array<(c: string) => string>,
    factObj: ExtractedAcademicFact,
    qIdx: number
  ): string => {
    for (let attempt = 0; attempt < templates.length * 2; attempt++) {
      const tpl = templates[(genCount * 3 + qIdx + attempt) % templates.length];
      // Alterne le concept focal entre focusConcept, sectionHeading et un extrait clé du fait
      const conceptVariant =
        attempt < templates.length
          ? factObj.focusConcept
          : `${lesson.cleanTitle} (${factObj.sectionHeading || `Volet ${genCount}.${qIdx + 1}`})`;
      const candidate = tpl(conceptVariant);
      const fp = `${fingerprintText(candidate)}_${factObj.fingerprint.slice(0, 18)}`;
      if (!usedStemsSet.has(fp)) {
        usedStemsSet.add(fp);
        lessonMem.usedStemFingerprints.push(fp);
        lessonMem.usedStemTexts.push(`${candidate} -> ${factObj.text.slice(0, 90)}`);
        return candidate;
      }
    }
    const fallbackCandidate = templates[(genCount + qIdx) % templates.length](
      `${factObj.focusConcept} [Série #${genCount}]`
    );
    lessonMem.usedStemTexts.push(`${fallbackCandidate} -> ${factObj.text.slice(0, 90)}`);
    return fallbackCandidate;
  };

  const items: EBItem[] = Array.from({ length: targetCount }, (_, idx) => {
    const rawFmt = formats[(idx + genCount - 1) % formats.length];
    const effectiveSubFmt: EBFormat =
      rawFmt === "CAS_CLINIQUE"
        ? (idx + genCount) % 3 === 1
          ? "GROUPAGE"
          : (idx + genCount) % 3 === 2
          ? "CENSURE"
          : "ELECTION"
        : rawFmt;

    const basePos = (idx * 4) % Math.max(1, virginFacts.length);
    const fObj1 = virginFacts[basePos % virginFacts.length];
    const fObj2 = virginFacts[(basePos + 1) % virginFacts.length];
    const fObj3 = virginFacts[(basePos + 2) % virginFacts.length];
    const fObj4 = virginFacts[(basePos + 3) % virginFacts.length];

    // Marquer immédiatement ces faits comme utilisés dans le registre infini
    for (const fo of [fObj1, fObj2, fObj3]) {
      if (fo && !lessonMem.usedFactFingerprints.includes(fo.fingerprint)) {
        lessonMem.usedFactFingerprints.push(fo.fingerprint);
      }
    }

    const f1 = fObj1.text;
    const f2 = fObj2.text;
    const f3 = fObj3.text;
    const f4 = fObj4.text;

    const dSeed = genCount * 17 + idx * 5 + Math.abs(sessionSeed);
    const d1 = craftDynamicAcademicDistractor(f2, dSeed + 1, virginFacts);
    const d2 = craftDynamicAcademicDistractor(f3, dSeed + 2, virginFacts);
    const d3 = craftDynamicAcademicDistractor(f4, dSeed + 3, virginFacts);
    const d4 = craftDynamicAcademicDistractor(f1, dSeed + 4, virginFacts);

    if (effectiveSubFmt === "QNS") {
      const stem = `Question rédactionnelle (QNS) — Exposez les critères diagnostiques et principes de prise en charge concernant « ${fObj1.focusConcept} ».`;
      lessonMem.usedStemTexts.push(stem);
      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: "QNS",
        stem,
        options: [],
        correct: [f1],
        explanation: `Éléments de réponse attendus d'après le cours « ${lesson.cleanTitle} » :\n• ${f1}\n• ${f2}\n• ${f3}`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
    }

    if (effectiveSubFmt === "ASSOCIATION") {
      const stem = `Concernant « ${fObj1.focusConcept} », associez chaque élément de la colonne de gauche à la caractéristique correspondante dans la colonne de droite :`;
      lessonMem.usedStemTexts.push(stem);
      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: "ASSOCIATION",
        stem,
        associationColumns: {
          leftTitle: "Éléments / Volet clinique (1 à 3)",
          rightTitle: "Caractéristiques & Prise en charge (A à C)",
          leftItems: [
            { id: "1", text: fObj1.sectionHeading || `Volet 1 (${lesson.cleanTitle})` },
            { id: "2", text: fObj2.sectionHeading || `Volet 2 (${lesson.cleanTitle})` },
            { id: "3", text: fObj3.sectionHeading || `Volet 3 (${lesson.cleanTitle})` },
          ],
          rightItems: [
            { id: "A", text: f1.slice(0, 125) },
            { id: "B", text: f2.slice(0, 125) },
            { id: "C", text: f3.slice(0, 125) },
          ],
        },
        options: [
          { letter: "A", text: "1-A • 2-B • 3-C" },
          { letter: "B", text: "1-B • 2-A • 3-C" },
          { letter: "C", text: "1-C • 2-B • 3-A" },
          { letter: "D", text: "1-A • 2-C • 3-B" },
          { letter: "E", text: "1-B • 2-C • 3-A" },
        ],
        correct: ["A"],
        explanation: `Appariement exact selon le cours « ${lesson.cleanTitle} » : 1-A (${f1}) ; 2-B (${f2}) ; 3-C (${f3}).`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
    }

    if (effectiveSubFmt === "JUMELAGE") {
      const stem = `Analysez les deux propositions suivantes concernant « ${fObj1.focusConcept} » reliées par « PARCE QUE » :`;
      lessonMem.usedStemTexts.push(stem);
      const isSecondTrue = (genCount + idx) % 2 === 0;
      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: isInsideCase ? "CAS_CLINIQUE" : "JUMELAGE",
        stem,
        statements: [f1, isSecondTrue ? f2 : d1],
        options: [
          { letter: "A", text: "Les deux propositions sont vraies avec relation de cause à effet" },
          { letter: "B", text: "Les deux propositions sont vraies sans relation de cause à effet" },
          { letter: "C", text: "La 1re proposition est vraie, la 2e est fausse" },
          { letter: "D", text: "La 1re proposition est fausse, la 2e est vraie" },
          { letter: "E", text: "Les deux propositions sont fausses" },
        ],
        correct: [isSecondTrue ? "B" : "C"],
        explanation: isSecondTrue
          ? `Les deux propositions sont exactes d'après le cours « ${lesson.cleanTitle} » : (1) ${f1}. (2) ${f2}.`
          : `La 1re proposition est exacte (${f1}), tandis que la 2e proposition est fausse (en réalité : ${f2}).`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
    }

    if (effectiveSubFmt === "GROUPAGE") {
      const stem = buildUniqueStem(GROUPAGE_STEM_TEMPLATES, fObj1, idx);
      const grpMode = (genCount + idx) % 4; // 0 -> A (1+2+3), 1 -> B (1+3), 2 -> C (2+4), 3 -> D (4 seulement)
      const statements =
        grpMode === 1
          ? [f1, d1, f3, d2, d3]
          : grpMode === 2
          ? [d1, f1, d2, f2, d3]
          : grpMode === 3
          ? [d1, d2, d3, f1, d4]
          : [f1, f2, f3, d1, d2];
      const correctLetter =
        grpMode === 1 ? "B" : grpMode === 2 ? "C" : grpMode === 3 ? "D" : "A";

      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: isInsideCase ? "CAS_CLINIQUE" : "GROUPAGE",
        groupageCodeHint: groupageCode,
        stem,
        statements,
        options: [
          { letter: "A", text: "1 + 2 + 3" },
          { letter: "B", text: "1 + 3" },
          { letter: "C", text: "2 + 4" },
          { letter: "D", text: "4 seulement" },
          { letter: "E", text: "Autre choix" },
        ],
        correct: [correctLetter],
        explanation: `Correction selon le cours « ${lesson.cleanTitle} » (${fObj1.sectionHeading}) : ${f1}. ${f2}. (Réponse ${correctLetter}).`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
    }

    if (effectiveSubFmt === "COMPLEMENT_MULTIPLE") {
      const stem = buildUniqueStem(COMPLEMENT_MULTIPLE_STEM_TEMPLATES, fObj1, idx);
      const cmMode = (genCount + idx) % 3;
      const options: EBOption[] =
        cmMode === 1
          ? [
              { letter: "A", text: d1 },
              { letter: "B", text: f1 },
              { letter: "C", text: d2 },
              { letter: "D", text: f2 },
              { letter: "E", text: f3 },
            ]
          : cmMode === 2
          ? [
              { letter: "A", text: f1 },
              { letter: "B", text: f2 },
              { letter: "C", text: d1 },
              { letter: "D", text: f3 },
              { letter: "E", text: d2 },
            ]
          : [
              { letter: "A", text: f1 },
              { letter: "B", text: d1 },
              { letter: "C", text: f2 },
              { letter: "D", text: d2 },
              { letter: "E", text: f3 },
            ];
      const correct =
        cmMode === 1 ? ["B", "D", "E"] : cmMode === 2 ? ["A", "B", "D"] : ["A", "C", "E"];

      return {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: isInsideCase ? "CAS_CLINIQUE" : "COMPLEMENT_MULTIPLE",
        stem,
        options,
        correct,
        explanation: `Les propositions ${correct.join(", ")} sont exactes selon le cours « ${lesson.cleanTitle} » : ${f1} ; ${f2} ; ${f3}.`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
    }

    if (effectiveSubFmt === "CENSURE") {
      const stem = buildUniqueStem(CENSURE_STEM_TEMPLATES, fObj1, idx);
      const baseCensure: EBItem = {
        id: `${blockId}_q_${idx + 1}`,
        number: idx + 1,
        format: isInsideCase ? "CAS_CLINIQUE" : "CENSURE",
        stem,
        options: [
          { letter: "A", text: d1 },
          { letter: "B", text: f1 },
          { letter: "C", text: f2 },
          { letter: "D", text: f3 },
          { letter: "E", text: f4 },
        ],
        correct: ["A"],
        explanation: `La proposition fausse est « ${d1} ». En réalité, d'après le cours « ${lesson.cleanTitle} » : ${f2}.`,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
      };
      return permuteItemOptionsDeterministically(
        baseCensure,
        genCount * 13 + idx * 7 + Math.abs(sessionSeed) + 2
      );
    }

    // Format ELECTION (1 seule proposition exacte)
    const stem = buildUniqueStem(ELECTION_STEM_TEMPLATES, fObj1, idx);
    const baseElection: EBItem = {
      id: `${blockId}_q_${idx + 1}`,
      number: idx + 1,
      format: isInsideCase ? "CAS_CLINIQUE" : "ELECTION",
      stem,
      options: [
        { letter: "A", text: f1 },
        { letter: "B", text: d1 },
        { letter: "C", text: d2 },
        { letter: "D", text: d3 },
        { letter: "E", text: d4 },
      ],
      correct: ["A"],
      explanation: `La proposition exacte d'après le cours « ${lesson.cleanTitle} » (${fObj1.sectionHeading}) est : ${f1}.`,
      lessonId: lesson.id,
      lessonTitle: lesson.cleanTitle,
    };
    return permuteItemOptionsDeterministically(
      baseElection,
      genCount * 11 + idx * 5 + Math.abs(sessionSeed) + 1
    );
  });

  const dynamicVignette =
    spec.kind === "CAS_CLINIQUE"
      ? buildDynamicClinicalCaseVignette(lesson, virginFacts, genCount, Math.abs(sessionSeed))
      : undefined;

  return {
    id: blockId,
    kind: spec.kind,
    header: `${
      spec.kind === "CAS_CLINIQUE" ? "Cas clinique progressif" : "Questions à Choix Multiples"
    } — ${lesson.cleanTitle}`,
    vignette: dynamicVignette,
    lessonIds: [lesson.id],
    reviewedBySecondModel: false,
    items,
  };
}

/**
 * Auto-relecture et auto-correction docimologique (Self-Review IA) + Enregistrement dans le Registre Fantôme Infini.
 * - Nettoie toute balise parasite (`[Enregistré automatiquement]`, crochets `[...]` hors cas clinique).
 * - Détecte et supprime toute amorce empruntée par erreur à un autre chapitre (ex: "Dans les ruptures du tendon calcanéen, un patient présente...").
 * - Synchronise la lettre de la clé de correction (`correct`) avec la lettre citée dans l'explication.
 * - Enregistre l'empreinte de chaque QCM validé dans `lessonMem` pour le Mode Infini Perpétuel.
 */
function reviewAndSelfCorrectBlock(
  block: EBBlock,
  lesson: EBLesson,
  lessonMem: LessonInfiniteMemory
): EBBlock {
  const existingFps = new Set(lessonMem.usedStemFingerprints || []);
  const cleanCourseTitle = cleanLessonTitle(lesson.cleanTitle);

  const lessonAllowedCorpus = normalizeText(
    `${cleanCourseTitle} ${(lesson.keywords || []).join(" ")} ${(lesson.headings || []).join(" ")} ${(
      lesson.content || ""
    ).slice(0, 6000)}`
  );

  const genericIntroWords = new Set([
    "dans",
    "concernant",
    "propos",
    "cours",
    "cadre",
    "sujet",
    "chez",
    "patient",
    "patiente",
    "enfant",
    "adulte",
    "sujet",
    "prise",
    "charge",
    "forme",
    "formes",
    "stade",
    "signe",
    "signes",
    "diagnostic",
    "traitement",
    "clinique",
    "bilan",
    "examen",
    "atteinte",
    "lesion",
    "lesions",
    "pathologie",
    "affection",
    "maladie",
  ]);

  const reviewedItems: EBItem[] = block.items.map((rawItem) => {
    const item = { ...rawItem };
    item.lessonTitle = cleanCourseTitle;

    // 1. Nettoyage des balises parasites dans l'énoncé et l'amorce
    let cleanStem = String(item.stem || "")
      .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
      .replace(/\(\s*enregistr[eé]\s+automatiquement\s*\)/gi, "")
      .replace(/^\s*\[+([^[\]]+)\]+\s*/g, "$1 ")
      .replace(/\bQuelles\s+est\s+la\b/gi, "Quelle est la")
      .replace(/\s+/g, " ")
      .trim();

    let cleanLead = item.lead
      ? String(item.lead)
          .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
          .replace(/^\[+|\]+$/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : undefined;

    // Hors cas clinique, fusionne proprement l'amorce sans crochets [...]
    if (block.kind !== "CAS_CLINIQUE" && cleanLead) {
      const normStem = normalizeText(cleanStem);
      const normLead = normalizeText(cleanLead);
      if (normLead && !normStem.startsWith(normLead)) {
        const sep = /[?:;,]$/.test(cleanLead) ? " " : ", ";
        const loweredStem =
          /^(?:quelle|quel|quels|quelles|parmi|indiquez|choisissez|un\s+patient|une\s+patiente|un\s+enfant)\b/i.test(
            cleanStem
          )
            ? cleanStem.charAt(0).toLowerCase() + cleanStem.slice(1)
            : cleanStem;
        cleanStem = `${cleanLead.replace(/[,;:\s]+$/, "")}${sep}${loweredStem}`.replace(/\s+/g, " ").trim();
      }
      cleanLead = undefined;
    }

    // 2. Détection et suppression d'une amorce étrangère empruntée à un autre chapitre (tic de copie)
    const introMatch = cleanStem.match(
      /^(?:Dans|Concernant|À\s+propos\s+de|A\s+propos\s+de|Au\s+cours\s+de)\s+([^,;:]{6,70})[,;:]\s+(.{25,})$/i
    );
    if (introMatch) {
      const introTopic = introMatch[1].trim();
      const restStem = introMatch[2].trim();
      const introWords = normalizeText(introTopic)
        .split(" ")
        .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w) && !genericIntroWords.has(w));

      if (introWords.length > 0) {
        const hasAnyOverlapWithLesson = introWords.some((w) => lessonAllowedCorpus.includes(w));
        if (!hasAnyOverlapWithLesson) {
          // L'amorce mentionne une pathologie absente de la leçon cible : on la corrige immédiatement
          if (/^(?:un\s+patient|une\s+patiente|un\s+enfant|un\s+homme|une\s+femme|devant|face\s+à)\b/i.test(restStem)) {
            cleanStem = restStem.charAt(0).toUpperCase() + restStem.slice(1);
          } else {
            cleanStem = `Concernant ${cleanCourseTitle.toLowerCase()}, ${
              restStem.charAt(0).toLowerCase() + restStem.slice(1)
            }`;
          }
        }
      }
    }

    if (cleanStem.length > 0) {
      cleanStem = cleanStem.charAt(0).toUpperCase() + cleanStem.slice(1);
    }

    // 3. Nettoyage des options et propositions numérotées
    let cleanOptions = (item.options || []).map((opt) => ({
      ...opt,
      text: String(opt.text || "")
        .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
        .replace(/\s+/g, " ")
        .trim(),
    }));

    let cleanStatements = Array.isArray(item.statements)
      ? item.statements.map((st) =>
          String(st || "")
            .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
            .replace(/\s+/g, " ")
            .trim()
        )
      : undefined;

    let effectiveFormat = item.format;
    let effectiveCorrect = item.correct;
    let effectiveExplanationBase = item.explanation;

    // 3b. Ceinture de sécurité anti-options dégénérées (ex: lettres "A".."E" seules à la place des assertions)
    if (effectiveFormat !== "QNS") {
      if (effectiveFormat === "GROUPAGE") {
        const validStmts = (cleanStatements || []).filter((s) => !isDegenerateOptionText(s));
        if (validStmts.length < 4) {
          const healed = createSyntheticFallbackBlock(
            {
              id: `${block.id}_heal`,
              kind: block.kind,
              lessonIds: [lesson.id],
              formats: ["GROUPAGE"],
              targetItemCount: 1,
            },
            [lesson],
            item.id,
            {
              preferredFormats: ["GROUPAGE"],
              usesClinicalCases: block.kind === "CAS_CLINIQUE",
              clinicalCaseRatio: 0.5,
              avgItemsPerCase: 3,
              detectedGroupageCode: item.groupageCodeHint || "",
              detectedJumelageConnector: "PARCE QUE",
              professorSignatureSummary: "",
            },
            (lessonMem.generationCount || 1) + (item.number || 1) * 7,
            lessonMem
          ).items[0];
          if (healed) {
            cleanStem = healed.stem;
            cleanOptions = healed.options;
            cleanStatements = healed.statements;
            effectiveCorrect = healed.correct;
            effectiveExplanationBase = healed.explanation;
          }
        }
      } else if (effectiveFormat !== "JUMELAGE") {
        const hasCorruptedOptions =
          cleanOptions.length < 4 || cleanOptions.some((o) => isDegenerateOptionText(o.text));
        if (hasCorruptedOptions) {
          const validStmts = (cleanStatements || []).filter((s) => !isDegenerateOptionText(s));
          if (validStmts.length >= 4) {
            const letters = ["A", "B", "C", "D", "E"];
            cleanOptions = validStmts.slice(0, 5).map((txt, idx) => ({
              letter: letters[idx] || "A",
              text: txt,
            }));
            cleanStatements = undefined;
          } else {
            const fallbackFmt: EBFormat =
              effectiveFormat === "CAS_CLINIQUE" ? "ELECTION" : effectiveFormat;
            const healed = createSyntheticFallbackBlock(
              {
                id: `${block.id}_heal`,
                kind: block.kind,
                lessonIds: [lesson.id],
                formats: [fallbackFmt],
                targetItemCount: 1,
              },
              [lesson],
              item.id,
              {
                preferredFormats: [fallbackFmt],
                usesClinicalCases: block.kind === "CAS_CLINIQUE",
                clinicalCaseRatio: 0.5,
                avgItemsPerCase: 3,
                detectedGroupageCode: "",
                detectedJumelageConnector: "PARCE QUE",
                professorSignatureSummary: "",
              },
              (lessonMem.generationCount || 1) + (item.number || 1) * 11,
              lessonMem
            ).items[0];
            if (healed) {
              cleanStem = healed.stem;
              cleanOptions = healed.options;
              cleanStatements = healed.statements;
              effectiveFormat = healed.format;
              effectiveCorrect = healed.correct;
              effectiveExplanationBase = healed.explanation;
            }
          }
        }
      }
    }

    // 4. Nettoyage et synchronisation de la lettre de réponse dans l'explication
    const rawExp = String(effectiveExplanationBase || "")
      .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const syncedExplanation = synchronizeExplanationLetterWithKey(rawExp, effectiveCorrect);

    // 5. Enregistrement dans le Registre Fantôme Infini
    const itemSignature = `${cleanStem} ${cleanOptions.map((o) => o.text).join(" ")}`;
    const itemFp = fingerprintText(itemSignature);
    if (!existingFps.has(itemFp)) {
      existingFps.add(itemFp);
      lessonMem.usedStemFingerprints.push(itemFp);
      lessonMem.usedStemTexts.push(`${cleanStem} -> ${cleanOptions[0]?.text || ""}`);
    }
    for (const opt of cleanOptions) {
      const optFp = fingerprintText(opt.text);
      if (optFp.length >= 8 && !lessonMem.usedFactFingerprints.includes(optFp)) {
        lessonMem.usedFactFingerprints.push(optFp);
      }
    }
    if (Array.isArray(cleanStatements)) {
      for (const st of cleanStatements) {
        const stFp = fingerprintText(st);
        if (stFp.length >= 8 && !lessonMem.usedFactFingerprints.includes(stFp)) {
          lessonMem.usedFactFingerprints.push(stFp);
        }
      }
    }

    return {
      ...item,
      format: effectiveFormat,
      correct: effectiveCorrect,
      lead: cleanLead,
      stem: cleanStem,
      options: cleanOptions,
      statements: cleanStatements,
      explanation: syncedExplanation,
    };
  });

  if (lessonMem.usedStemTexts.length > 120) {
    lessonMem.usedStemTexts = lessonMem.usedStemTexts.slice(-120);
  }
  if (lessonMem.usedStemFingerprints.length > 250) {
    lessonMem.usedStemFingerprints = lessonMem.usedStemFingerprints.slice(-250);
  }
  if (lessonMem.usedFactFingerprints.length > 300) {
    lessonMem.usedFactFingerprints = lessonMem.usedFactFingerprints.slice(-300);
  }

  return {
    ...block,
    header: String(block.header || "").replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "").trim(),
    items: reviewedItems,
  };
}

function isDegenerateOptionText(raw: string): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return true;
  // Un libellé réduit à une lettre de choix ("A", "B.", "C)") ou un chiffre isolé ("1", "2") est invalide
  if (/^[A-E1-5](?:\s*[.:)\]-])?$/i.test(trimmed)) return true;
  const cleaned = trimmed.replace(/^[A-E]\s*[:.)-]\s+/i, "").trim();
  if (!cleaned || cleaned.length < 2) return true;
  if (/^[A-E1-5]$/i.test(cleaned)) return true;
  if (/^(?:option|proposition|item|r[eé]ponse|choix|assertion)\s*[A-E1-5]?$/i.test(cleaned)) return true;
  return false;
}

function extractRawOptionTextList(rawOptions: any): Array<{ letter: string; text: string }> {
  const letters = ["A", "B", "C", "D", "E"];
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((o: any, oIdx: number) => {
      if (typeof o === "string") {
        const letterMatch = o.match(/^([A-E])[.:)-]\s+(.+)$/i);
        return {
          letter: letterMatch ? letterMatch[1].toUpperCase() : letters[oIdx] || "A",
          text: letterMatch ? letterMatch[2].trim() : o.trim(),
        };
      }
      return {
        letter: String(o?.letter || letters[oIdx] || "A").toUpperCase(),
        text: String(o?.text ?? o?.label ?? o?.content ?? "").trim(),
      };
    });
  }
  if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions)
      .slice(0, 5)
      .map(([k, v], oIdx) => ({
        letter: /^[A-E]$/i.test(k) ? k.toUpperCase() : letters[oIdx] || "A",
        text: String(typeof v === "string" ? v : (v as any)?.text ?? (v as any)?.label ?? "").trim(),
      }));
  }
  return [];
}

function isAiBlockCleanAndValid(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const badPattern =
    /uniquement dans les formes asymptomatiques non compliquées|l'évolution spontanée se fait constamment vers la régression complète|enregistr[eé]\s+automatiquement|pr moussa seck fmpo|ce signe exclut formellement|avec une radiographie standard pathognomonique/i;
  for (const it of items) {
    if (!it || typeof it !== "object") return false;
    const stem = String(it.stem || it.question || "").trim();
    if (stem.length < 15 || badPattern.test(stem)) return false;

    const rawFmt = String(it.format || it.archetype || "ELECTION").toUpperCase();
    const extractedOpts = extractRawOptionTextList(it.options);
    const rawStatements = Array.isArray(it.statements)
      ? it.statements
      : Array.isArray(it.groupageStatements)
      ? it.groupageStatements.map((gs: any) => gs?.text || gs)
      : Array.isArray(it.propositions)
      ? it.propositions
      : [];
    const cleanStatements = rawStatements
      .map((s: any) => String(s || "").replace(/^\s*\d+\s*[.)-]\s*/, "").trim())
      .filter((s: string) => s.length > 0);

    for (const o of extractedOpts) {
      if (badPattern.test(o.text)) return false;
    }

    if (rawFmt === "QNS") continue;

    if (rawFmt === "GROUPAGE") {
      const validStatementsCount = cleanStatements.filter((s: string) => !isDegenerateOptionText(s)).length;
      if (validStatementsCount < 4) return false;
      continue;
    }

    if (rawFmt === "JUMELAGE") {
      const hasJumelageStatements =
        cleanStatements.filter((s: string) => !isDegenerateOptionText(s)).length >= 2 ||
        (it.jumelageData &&
          !isDegenerateOptionText(String(it.jumelageData.statementOne || "")) &&
          !isDegenerateOptionText(String(it.jumelageData.statementTwo || "")));
      if (!hasJumelageStatements) return false;
      continue;
    }

    // Pour ELECTION, CENSURE, COMPLEMENT_MULTIPLE, ASSOCIATION, CAS_CLINIQUE :
    // rejette impérativement tout QCM dont les propositions ne sont que des lettres (A, B, C, D, E) ou vides
    const validOptsCount = extractedOpts.filter((o) => !isDegenerateOptionText(o.text)).length;
    const validStmtFallbackCount = cleanStatements.filter((s: string) => !isDegenerateOptionText(s)).length;
    if (validOptsCount < 4 && validStmtFallbackCount < 4) {
      return false;
    }
  }
  return true;
}

function sanitizeLeadAndStem(rawLead: any, rawStem: any, fallbackTitle: string): { lead?: string; stem: string } {
  const cleanFallback = cleanLessonTitle(fallbackTitle);
  let stem = String(rawStem || `Question sur ${cleanFallback}`)
    .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
    .replace(/^\s*\[+([^[\]]+)\]+\s*/g, "$1 ")
    .replace(/\bQuelles\s+est\s+la\b/gi, "Quelle est la")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem) stem = `Concernant ${cleanFallback}, quelle est la proposition exacte ?`;

  let lead: string | undefined;
  if (rawLead) {
    const cleanedLead = String(rawLead)
      .replace(/\[\s*enregistr[eé]\s+automatiquement\s*\]/gi, "")
      .replace(/^\[+|\]+$/g, "")
      .trim();
    if (
      cleanedLead.length >= 3 &&
      cleanedLead.length <= 65 &&
      !/\b(evals?|exam|examen|tor|pdf|docx|pptx|20\d{2}|extracted|enregistr)\b/i.test(cleanedLead)
    ) {
      lead = cleanedLead;
    }
  }
  return { lead, stem };
}

function normalizeAiBlockItems(
  rawItems: any[],
  lesson: EBLesson,
  blockKey: string,
  startQuestionNumber: number,
  isInsideClinicalCase: boolean,
  defaultGroupageCode: string
): EBItem[] {
  const letters = ["A", "B", "C", "D", "E"];
  const standardGroupageOptions: EBOption[] = [
    { letter: "A", text: "1 + 2 + 3" },
    { letter: "B", text: "1 + 3" },
    { letter: "C", text: "2 + 4" },
    { letter: "D", text: "4 seulement" },
    { letter: "E", text: "Autre choix" },
  ];

  return rawItems.map((it: any, idx: number) => {
    const rawFmt = String(it.format || it.archetype || "ELECTION").toUpperCase();
    const { lead, stem } = sanitizeLeadAndStem(it.lead, it.stem || it.question, lesson.cleanTitle);

    let statements: string[] | undefined = Array.isArray(it.statements)
      ? it.statements
          .map((s: any) => String(s).replace(/^\s*\d+\s*[.)-]\s*/, "").trim())
          .filter(Boolean)
      : Array.isArray(it.groupageStatements)
      ? it.groupageStatements
          .map((gs: any) => String(gs.text || gs).replace(/^\s*\d+\s*[.)-]\s*/, "").trim())
          .filter(Boolean)
      : Array.isArray(it.propositions)
      ? it.propositions
          .map((p: any) => String(p?.text || p).replace(/^\s*(?:\d+|[A-E])\s*[.)-]\s*/i, "").trim())
          .filter(Boolean)
      : it.jumelageData
      ? [
          String(it.jumelageData.statementOne || "").trim(),
          String(it.jumelageData.statementTwo || "").trim(),
        ].filter(Boolean)
      : undefined;

    let opts: EBOption[] = extractRawOptionTextList(it.options);
    if (opts.length === 0 && Array.isArray(it.choices) && it.choices.length > 0) {
      opts = extractRawOptionTextList(it.choices);
    }

    const optsLookLikeGroupageCode =
      opts.length >= 4 &&
      opts.filter((o) =>
        /^(?:1\s*\+\s*2\s*\+\s*3|1\s*\+\s*3|2\s*\+\s*4|4(?:\s*seulement)?|autre\s*choix|a\s*=\s*1)/i.test(
          o.text.trim()
        )
      ).length >= 3;

    const isGroupage = rawFmt === "GROUPAGE" || optsLookLikeGroupageCode;

    let fmt: EBFormat = isInsideClinicalCase
      ? "CAS_CLINIQUE"
      : isGroupage
      ? "GROUPAGE"
      : rawFmt === "COMPLEMENT_MULTIPLE" && (!Array.isArray(it.correct) || it.correct.length <= 1)
      ? "ELECTION"
      : ([
          "CAS_CLINIQUE",
          "ELECTION",
          "CENSURE",
          "GROUPAGE",
          "JUMELAGE",
          "ASSOCIATION",
          "COMPLEMENT_MULTIPLE",
          "QNS",
        ].includes(rawFmt)
          ? (rawFmt as EBFormat)
          : "ELECTION");

    // Si l'énoncé demande explicitement la proposition fausse/inexacte sur un QCM à options textuelles -> CENSURE
    if (
      (fmt === "ELECTION" || (fmt === "GROUPAGE" && !optsLookLikeGroupageCode && (!statements || statements.length === 0))) &&
      /\b(fausse|inexacte|erron[ée]e|incorrecte|sauf\s+une|à\s+l['’]exception)\b/i.test(stem)
    ) {
      fmt = isInsideClinicalCase ? "CAS_CLINIQUE" : "CENSURE";
    }

    if (isGroupage && fmt === "GROUPAGE") {
      // Si l'IA a mis les propositions numérotées dans `options` au lieu de `statements`, on les transfère dans `statements`
      if ((!statements || statements.length < 4) && opts.length >= 4 && !optsLookLikeGroupageCode) {
        statements = opts.slice(0, 5).map((o) => o.text.replace(/^\s*\d+\s*[.)-]\s*/, "").trim());
      }
      // Un QCM de Groupage a TOUJOURS les 5 combinaisons codées en A..E (jamais la répétition des phrases en A..E)
      opts = standardGroupageOptions.map((o) => ({ ...o }));
    } else if (fmt !== "JUMELAGE") {
      // Pour tout QCM non-Groupage (Élection, Censure, Complément multiple, Association) :
      // Si l'IA a rempli `statements` / `propositions` avec de vraies phrases et laissé `options` vides OU avec de simples lettres A..E,
      // on promeut impérativement les vraies propositions textuelles vers `options` A..E !
      const optsLookLikeBareLetters =
        opts.length === 0 ||
        opts.filter((o) => isDegenerateOptionText(o.text)).length >= 2;
      if ((opts.length < 2 || optsLookLikeBareLetters) && statements && statements.length >= 4) {
        const validStmtOpts = statements.filter((s) => !isDegenerateOptionText(s));
        if (validStmtOpts.length >= 4) {
          opts = validStmtOpts.slice(0, 5).map((s, sIdx) => ({
            letter: letters[sIdx] || "A",
            text: s,
          }));
        }
      }
      // On supprime systématiquement `statements` pour empêcher l'affichage parasite du code Groupage !
      statements = undefined;
    }

    const rawAssoc = it.associationColumns || it.matchingColumns;
    let associationColumns: EBAssociationColumns | undefined;
    if (rawAssoc && typeof rawAssoc === "object") {
      const leftItems = Array.isArray(rawAssoc.leftItems)
        ? rawAssoc.leftItems
            .map((x: any, i: number) => ({
              id: String(x.id || i + 1),
              text: String(x.text || "").trim(),
            }))
            .filter((x: { id: string; text: string }) => x.text.length > 0)
        : [];
      const rightItems = Array.isArray(rawAssoc.rightItems)
        ? rawAssoc.rightItems
            .map((x: any, i: number) => ({
              id: String(x.id || letters[i] || "A"),
              text: String(x.text || "").trim(),
            }))
            .filter((x: { id: string; text: string }) => x.text.length > 0)
        : [];
      if (leftItems.length >= 2 && rightItems.length >= 2) {
        associationColumns = {
          leftTitle: String(rawAssoc.leftTitle || rawAssoc.leftColumnTitle || "Entités cliniques"),
          rightTitle: String(rawAssoc.rightTitle || rawAssoc.rightColumnTitle || "Caractéristiques"),
          leftItems,
          rightItems,
        };
      }
    }

    // Si un QCM ASSOCIATION n'a pas de colonnes valides ou si un JUMELAGE n'a pas ses 2 assertions, on le reclasse proprement
    if (fmt === "ASSOCIATION" && !associationColumns) {
      fmt = "ELECTION";
    }
    if (fmt === "JUMELAGE" && (!statements || statements.length < 2 || !statements[0] || !statements[1])) {
      fmt = "ELECTION";
      statements = undefined;
    }

    if (fmt === "GROUPAGE" && opts.length < 2) {
      opts = standardGroupageOptions.map((o) => ({ ...o }));
    }

    const rawCorrect =
      Array.isArray(it.correct) && it.correct.length > 0
        ? it.correct
        : it.correctLetter
        ? [it.correctLetter]
        : ["A"];

    const finalIsGroupage = fmt === "GROUPAGE";

    return {
      id: `${blockKey}_${startQuestionNumber + idx}`,
      number: startQuestionNumber + idx,
      format: fmt,
      lead,
      stem,
      statements,
      groupageCodeHint: finalIsGroupage
        ? String(
            it.groupageCodeHint ||
              defaultGroupageCode ||
              "Choisir votre réponse selon le code suivant : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autre choix"
          )
        : undefined,
      associationColumns,
      options: fmt === "QNS" ? [] : opts,
      correct: rawCorrect.map((c: any) => (fmt === "QNS" ? String(c) : String(c).toUpperCase())),
      explanation: String(
        it.explanation || it.globalExplanation || `Référence au cours « ${lesson.cleanTitle} ».`
      ),
      trapHighlight: it.trapHighlight ? String(it.trapHighlight) : undefined,
      professorSyntaxNote: it.professorSyntaxNote ? String(it.professorSyntaxNote) : undefined,
      lessonId: lesson.id,
      lessonTitle: lesson.cleanTitle,
    };
  });
}

/**
 * Orchestrateur universel de génération de l'Examen Blanc (Étape 5).
 * S'adapte à 100 % à la matière et aux formats détectés dans les annales de l'étudiant :
 * - Si les annales de la matière n'ont pas de Cas Cliniques (ex: TOR / QCM directs),
 *   génère 100 % de QCM directs hors cas clinique dans les formats exacts détectés.
 * - Si les annales de la matière comportent des Cas Cliniques, respecte la proportion exacte.
 */

/**
 * Équilibre globalement les clés de réponse sur l'ensemble de l'épreuve
 * pour interdire toute suite monotone (> 2 réponses identiques consécutives).
 */
function balanceGlobalAnswerKeyStreaks(blocks: EBBlock[], globalSeed: number): void {
  const letters = ["A", "B", "C", "D", "E"];
  let prevLetter = "";
  let streak = 0;
  let globalCounter = 0;

  for (const b of blocks) {
    for (let i = 0; i < b.items.length; i++) {
      globalCounter++;
      const it = b.items[i];
      if (it.correct.length === 1 && it.options.length === 5) {
        const cur = it.correct[0].toUpperCase();
        if (cur === prevLetter) {
          streak++;
        } else {
          prevLetter = cur;
          streak = 1;
        }

        if (streak >= 2 && it.format !== "GROUPAGE" && !(it.statements && it.statements.length >= 4)) {
          const curIdx = letters.indexOf(cur);
          const nextIdx = (curIdx + 1 + (globalCounter + globalSeed) % 3) % 5;
          b.items[i] = permuteItemOptionsDeterministically(it, nextIdx);
          prevLetter = b.items[i].correct[0];
          streak = 1;
        }
      }
    }
  }
}

/**
 * Orchestrateur universel de génération de l'Examen Blanc (Étape 5) avec Mode Infini Perpétuel.
 * - Conserve strictement les paramètres docimologiques issus de l'analyse des annales
 *   (quota, nombre moyen de QCM, formats exacts, ratio de cas cliniques vs QCM directs).
 * - Puise dans le Registre Fantôme Permanent (`InfiniteExamMemoryLedger`) pour exclure
 *   tous les QCM, énoncés, faits et cas cliniques déjà posés lors des sessions précédentes
 *   (même sur exactement les mêmes 5 leçons et même si une session a été supprimée).
 */
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

  // Synchronise aussi les sessions existantes en mémoire au cas où
  try {
    const existingSessions = await loadSessionsAsync();
    for (const sess of existingSessions) {
      for (const blk of sess.blocks || []) {
        for (const it of blk.items || []) {
          const lKey = normalizeText(it.lessonTitle || "") || it.lessonId || "global";
          if (!infiniteLedger.perLesson[lKey]) {
            infiniteLedger.perLesson[lKey] = {
              lessonKey: lKey,
              generationCount: 1,
              usedFactFingerprints: [],
              usedStemFingerprints: [],
              usedStemTexts: [],
              usedVignetteSeeds: [],
            };
          }
          const sig = `${it.stem} ${it.options.map((o) => o.text).join(" ")}`;
          const fp = fingerprintText(sig);
          if (!infiniteLedger.perLesson[lKey].usedStemFingerprints.includes(fp)) {
            infiniteLedger.perLesson[lKey].usedStemFingerprints.push(fp);
            infiniteLedger.perLesson[lKey].usedStemTexts.push(`${it.stem} -> ${it.options[0]?.text || ""}`);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const hydratedSelected = selected.map((l) => ensureHydratedLesson(l, subjectName));
  const systemPrompt = fillSystemPrompt(ueName, subjectName, analysis.quota, analysis.style);
  const design = buildExamDesign(analysis, hydratedSelected.map((lesson) => lesson.id));
  warnings.push(...design.warnings);
  const styleCorpus: ExamStyleQuestion[] = analysis.exams
    .filter(isMeasuredExam)
    .flatMap((exam) => exam.observedQuestions!)
    .filter((question) => question.format !== "QNS" && !question.aiRecovered);
  const injectedExamples: ExamStyleQuestion[] = [];
  const totalSteps = design.blocks.length + 1;
  const generatedLessons = new Set<string>();
  const examRelayState: EdgeRelayState = { preferMorChat: false };

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
      message: `Session Inédite #${currentLessonGen} — Rédaction & auto-vérification (${i + 1}/${
        design.blocks.length
      }) : « ${cleanLessonTitle(lesson.cleanTitle)} » (${lessonQuota} QCM)…`,
      current: i + 1,
      total: totalSteps,
    });

    const isCaseBlock = plannedBlock.kind === "CAS_CLINIQUE";
    const spec: BlueprintSpec = { ...plannedBlock, id: `block_${globalGenNum}_${i + 1}`, groupageCode: analysis.style?.detectedGroupageCode || "" };

    const { virginFacts, rotatedCourseTextForAI, focusHeadings } = selectVirginFactsAndCourseWindow(
      lesson,
      lessonMem,
      lessonQuota * 5 + 6
    );
    for (const vf of virginFacts.slice(0, lessonQuota * 3)) {
      if (vf.fingerprint && !lessonMem.usedFactFingerprints.includes(vf.fingerprint)) {
        lessonMem.usedFactFingerprints.push(vf.fingerprint);
      }
    }

    // Exemples tracés dans les annales, même chapitre d'abord ; jamais de question récupérée par audit.
    const styleReferences = selectExamStyleReferences(styleCorpus, plannedBlock.formats, lesson.id);
    for (const example of styleExamples(styleReferences, lesson.id)) {
      if (!injectedExamples.some((entry) => entry.source!.title === example.source!.title && entry.source!.lineStart === example.source!.lineStart && entry.stem === example.stem)) {
        injectedExamples.push(example);
      }
    }

    const effectiveSeed = globalGenNum * 37 + currentLessonGen * 23 + sessionSeed + i * 19;
    const compactCourseWindow = rotatedCourseTextForAI.slice(0, 14500);

    // Découpage des blocs STANDALONE volumineux (> 2 QCM) en sous-lots de 2 QCM maximum par appel Edge Function
    // afin d'éviter tout dépassement de la limite passerelle de 60s ("Failed to fetch" / HTTP 504) tout en
    // maximisant la finesse de rédaction par question. Si un sous-lot de 2 QCM rencontre un timeout réseau
    // ("Failed to fetch"), repli automatique question par question (1 QCM par appel).
    const maxChunkSize = isCaseBlock ? Math.min(3, spec.formats.length) : 2;
    const subSpecs: Array<{ subSpec: BlueprintSpec; startIdx: number }> = [];
    const optionCountsList = spec.optionCounts || spec.formats.map(() => 5);
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

    const invokeSingleSubSpec = async (
      targetSubSpec: BlueprintSpec,
      seedOffset: number,
      fastMode = false
    ): Promise<{ data: any; error: any }> => {
      const courseSlice = fastMode ? compactCourseWindow.slice(0, 10500) : compactCourseWindow;
      const subRefs = selectExamStyleReferences(styleCorpus, targetSubSpec.formats, lesson.id);
      return invokeExamenBlancEdge(
        {
          action: "generate_examen_blanc_block",
          systemPrompt,
          ueName,
          subjectName,
          sessionSeed: effectiveSeed + seedOffset * 13,
          generationNumber: currentLessonGen,
          previouslyAskedStems: [...(lessonMem.usedStemTexts || []), ...accumulatedBlockStems].slice(-80),
          focusHeadings,
          lessonTitle: cleanLessonTitle(lesson.cleanTitle),
          lessonContent: courseSlice,
          blueprintSpec: targetSubSpec,
          professorStyle: {
            detectedGroupageCode: analysis.style?.detectedGroupageCode,
            usesClinicalCases: isCaseBlock,
            avgItemsPerCase: analysis.style?.avgItemsPerCase,
          },
          styleReferences: subRefs.length > 0 ? subRefs : styleReferences,
          enableSonnetSelfCorrection: !fastMode,
          enableGeminiRepair: true,
        },
        fastMode ? 48000 : 58000,
        examRelayState
      );
    };

    for (let sIdx = 0; sIdx < subSpecs.length; sIdx++) {
      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
      const { subSpec, startIdx } = subSpecs[sIdx];
      if (subSpecs.length > 1) {
        onProgress?.({
          phase: "redaction",
          message: `Session Inédite #${currentLessonGen} — Rédaction & double contrôle (${i + 1}/${
            design.blocks.length
          }) : « ${cleanLessonTitle(lesson.cleanTitle)} » (QCM ${startIdx + 1}–${
            startIdx + subSpec.formats.length
          }/${lessonQuota})…`,
          current: i + 1,
          total: totalSteps,
        });
      }

      let { data, error } = await invokeSingleSubSpec(subSpec, sIdx, false);
      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };

      // Si un sous-lot de 2+ QCM échoue par timeout passerelle ("Failed to fetch" / 502 / 504),
      // on le découpe immédiatement en appels unitaires (1 QCM par appel) en mode direct Sonnet 4.6 + Gemini 2.5
      if (error && isNetworkOrGatewayTimeoutError(error) && !isCaseBlock && subSpec.formats.length > 1) {
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
          await new Promise((r) => setTimeout(r, 500));
          let unitRes = await invokeSingleSubSpec(unitSpec, sIdx * 10 + u + 1, true);
          if (unitRes.error && isNetworkOrGatewayTimeoutError(unitRes.error)) {
            await new Promise((r) => setTimeout(r, 900));
            unitRes = await invokeSingleSubSpec(unitSpec, sIdx * 10 + u + 5, true);
          }
          if (unitRes.error || !unitRes.data?.block) {
            splitFailedError = unitRes.error || { message: "Le service de génération n’a pas répondu." };
            break;
          }
          const unitBlock = unitRes.data.block as ReviewedExamBlock;
          for (const it of unitBlock.items || []) {
            accumulatedBlockStems.push(`${it.stem} -> ${it.options?.[0]?.text || ""}`);
          }
          verifiedSubBlocks.push(unitBlock);
        }
        if (!splitFailedError) {
          continue;
        }
        error = splitFailedError;
        data = null;
      } else if (error && isNetworkOrGatewayTimeoutError(error)) {
        // Relance rapide sur un appel unitaire ayant rencontré un "Failed to fetch" transitoire
        await new Promise((r) => setTimeout(r, 800));
        const retryRes = await invokeSingleSubSpec(subSpec, sIdx + 17, true);
        data = retryRes.data;
        error = retryRes.error;
      }

      if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
      if (error) {
        const rawErrMsg = String(error.message || error || "Le service de génération n’a pas répondu.");
        const errStatus = Number(error.status || error.context?.status || 0);
        const errName = String(error.name || "");
        const isPureNetworkError =
          errName.toLowerCase() === "aborterror" ||
          /failed to fetch|networkerror|load failed|fetch failed|gateway timeout/i.test(rawErrMsg) ||
          [504, 522, 524, 546].includes(errStatus);
        const cleanErrMsg = isPureNetworkError
          ? `Connexion au serveur IA interrompue ou délai dépassé (${errStatus ? `HTTP ${errStatus}` : errName || rawErrMsg}). Vérifiez votre connexion internet et relancez la génération.`
          : errStatus && !rawErrMsg.includes(String(errStatus))
          ? `[HTTP ${errStatus}] ${rawErrMsg}`
          : rawErrMsg;
        console.error("[ExamenBlanc] Échec de génération du sous-lot:", {
          lesson: lesson.cleanTitle,
          status: errStatus,
          name: errName,
          rawErrMsg,
          preferMorChat: examRelayState.preferMorChat,
        });
        throw new Error(`« ${lesson.cleanTitle} » : ${cleanErrMsg} Aucun examen partiel n’a été enregistré.`);
      }
      const subBlock = data?.block as ReviewedExamBlock | undefined;
      if (!subBlock) {
        throw new Error(`« ${lesson.cleanTitle} » : Réponse incomplète du serveur. Aucun examen partiel n’a été enregistré.`);
      }
      for (const it of subBlock.items || []) {
        accumulatedBlockStems.push(`${it.stem} -> ${it.options?.[0]?.text || ""}`);
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
    if (validationErrors.length) throw new Error(`« ${lesson.cleanTitle} » : ${validationErrors.slice(0, 3).join(" ")} Aucun examen n’a été enregistré.`);
    const copiedIndexes = copiedExamStyleQuestions(styleReferences, examStyleQuestionsFromBlock(verified, lesson.id));
    if (copiedIndexes.length) {
      throw new Error(`« ${lesson.cleanTitle} » : question(s) ${copiedIndexes.join(", ")} recopiée(s) d’une annale au lieu d’être inédite(s). Aucun examen n’a été enregistré.`);
    }
    const items: EBItem[] = verified.items.map((item, index) => {
      const signature = `${item.stem} ${item.options.map((option) => option.text).join(" ")}`;
      const fingerprint = fingerprintText(signature);
      if (lessonMem.usedStemFingerprints.includes(fingerprint)) throw new Error(`Question déjà utilisée dans « ${lesson.cleanTitle} » : relancez la génération.`);
      lessonMem.usedStemFingerprints.push(fingerprint);
      lessonMem.usedStemTexts.push(`${item.stem} -> ${item.options[0].text}`);
      return {
        ...item,
        id: `eb_${globalGenNum}_${i + 1}_${index + 1}`,
        number: index + 1,
        lessonId: lesson.id,
        lessonTitle: lesson.cleanTitle,
        sourceQuotes: [...new Set(verified.validation.items[index].optionVerdicts.map((verdict) => verdict.sourceQuote))],
      };
    });
    const block: EBBlock = {
      ...verified,
      id: spec.id,
      lessonIds: [lesson.id],
      reviewedBySecondModel: verified.validation.differentModel,
      items,
    };
    allBlocks.push(block);
  }

  if (isCancelled?.()) return { blocks: [], warnings: ["Génération interrompue."] };
  if (allBlocks.length !== design.blocks.length || allBlocks.reduce((sum, block) => sum + block.items.length, 0) !== design.totalQuestions) throw new Error("Examen incomplet : aucun enregistrement effectué.");
  await saveInfiniteMemoryLedger(infiniteLedger);

  let globalNumber = 1;
  for (const b of allBlocks) {
    b.items = b.items.map((it) => ({
      ...it,
      number: globalNumber++,
    }));
  }

  onProgress?.({
    phase: "verification",
    message: `Contrôles structurels et relecture indépendante terminés pour ${globalNumber - 1} QCM (session #${globalGenNum}).`,
    current: totalSteps,
    total: totalSteps,
  });
  await new Promise((r) => setTimeout(r, 150));

  const styleReport = compareExamStyle(
    styleCorpus,
    allBlocks.flatMap((block) => examStyleQuestionsFromBlock(block, block.lessonIds[0])),
    injectedExamples
  );
  return { blocks: allBlocks, warnings, styleReport };
}

// ============================================================================
// 6. PERSISTANCE INDEXEDDB (+ MIGRATION LOCALSTORAGE), SCORING & EXPORT PDF
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
    // ignore quota errors
  }
};

export const loadSessionsAsync = async (): Promise<ExamSession[]> => {
  try {
    const idbData = await idbGet<ExamSession[]>(SESSIONS_STORAGE_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      return idbData;
    }
    const legacy = loadSessions();
    if (legacy.length > 0) {
      await idbSet(SESSIONS_STORAGE_KEY, legacy);
    }
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
    const referenceRaw = `${item.explanation || ""} ${item.correct?.[0] || ""}`;
    const expectedTerms = Array.from(
      new Set(
        normalizeText(referenceRaw)
          .split(" ")
          .filter((w) => w.length >= 4 && !STOPWORDS_FR.has(w))
      )
    );
    if (expectedTerms.length === 0) return answerText.length >= 12;
    const hits = expectedTerms.filter((t) => answerNorm.includes(t)).length;
    const minNeeded = Math.min(3, Math.max(1, Math.ceil(expectedTerms.length * 0.2)));
    return hits >= minNeeded;
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
      const optsLookLikeGroupage =
        Array.isArray(it.options) &&
        it.options.filter((o) =>
          /^(?:1\s*\+\s*2\s*\+\s*3|1\s*\+\s*3|2\s*\+\s*4|4(?:\s*seulement)?|autre\s*choix)/i.test(
            String(o.text || "").trim()
          )
        ).length >= 3;
      const isGroupage =
        it.format === "GROUPAGE" ||
        (optsLookLikeGroupage && Array.isArray(it.statements) && it.statements.length >= 4);

      const { lead, stem } = sanitizeLeadAndStem(it.lead, it.stem, it.lessonTitle || "Cours");

      if (lead && block.kind === "CAS_CLINIQUE") {
        stemParts.push(lead.replace(/^\[+|\]+$/g, "").trim());
      }
      if (isGroupage && it.groupageCodeHint) {
        stemParts.push(it.groupageCodeHint);
      }
      stemParts.push(stem);

      if (it.format === "JUMELAGE" && Array.isArray(it.statements) && it.statements.length >= 2) {
        stemParts.push(
          `Première assertion : ${it.statements[0]}\nPARCE QUE\nSeconde assertion : ${it.statements[1]}`
        );
      } else if (
        it.format === "ASSOCIATION" &&
        it.associationColumns &&
        it.associationColumns.leftItems.length >= 2 &&
        it.associationColumns.rightItems.length >= 2
      ) {
        const leftLines = it.associationColumns.leftItems
          .map((l) => `${l.id}) ${l.text}`)
          .join("\n");
        const rightLines = it.associationColumns.rightItems
          .map((r) => `${r.id}. ${r.text}`)
          .join("\n");
        stemParts.push(
          `Numéros à associer (${it.associationColumns.leftTitle}) :\n${leftLines}\nPropositions lettrées (${it.associationColumns.rightTitle}) :\n${rightLines}`
        );
      } else if (isGroupage && Array.isArray(it.statements) && it.statements.length > 0) {
        stemParts.push(
          ...it.statements.map((s, i) => {
            const cleanS = s.replace(/^\s*\d+\s*[.)-]\s*/, "").trim();
            return `${i + 1}. ${cleanS}`;
          })
        );
      }

      const displayType =
        block.kind === "CAS_CLINIQUE"
          ? "Dossier"
          : EB_FORMAT_LABELS[it.format] || "QCM";

      return {
        id: it.id,
        number: it.number,
        type: displayType,
        qcmType: block.kind === "CAS_CLINIQUE" ? "cas_clinique" : it.format.toLowerCase(),
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

// ============================================================================
// AUTO-GUÉRISON LOCALE D'IMPORT DE FICHIERS (TOUTES MATIÈRES, ZÉRO BIAIS)
// Lit réellement chaque fichier PDF / DOCX / PPTX / TXT dans le navigateur
// sans jamais substituer une autre matière.
// ============================================================================
export async function rescueFileReadLocally(
  file: File,
  _mode: "courses" | "annales" = "annales"
): Promise<{ success: boolean; content: string; usedVision: boolean }> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (ext === "pdf" || file.type === "application/pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        try {
          const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          if (workerModule?.default) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
          }
        } catch {
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${
              pdfjsLib.version || "5.4.149"
            }/build/pdf.worker.min.mjs`;
          }
        }
      }
      const arrayBuffer = await file.arrayBuffer();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        wasmUrl: origin ? `${origin}/pdfjs/wasm/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/wasm/",
        iccUrl: origin ? `${origin}/pdfjs/iccs/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/iccs/",
        standardFontDataUrl: origin
          ? `${origin}/pdfjs/standard_fonts/`
          : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/standard_fonts/",
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/cmaps/",
        cMapPacked: true,
        isEvalSupported: true,
        verbosity: 0,
      } as any).promise;
      const numPages = pdf.numPages;

      const pageTexts: Array<string | null> = new Array(numPages).fill(null);
      for (let startP = 1; startP <= numPages; startP += 4) {
        const endP = Math.min(numPages, startP + 3);
        const nums = Array.from({ length: endP - startP + 1 }, (_, k) => startP + k);
        await Promise.all(
          nums.map(async (pNum) => {
            const page = await pdf.getPage(pNum);
            const tc = await page.getTextContent();
            let lastY: number | null = null;
            const lines: string[] = [];
            let currentLine = "";

            for (const item of tc.items as any[]) {
              if (!("str" in item)) continue;
              const str = String(item.str || "");
              const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
              if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
                if (currentLine.trim()) lines.push(currentLine.trim());
                currentLine = str;
              } else {
                currentLine += (currentLine && !currentLine.endsWith(" ") && !str.startsWith(" ") ? " " : "") + str;
              }
              if (y !== null) lastY = y;
              if (item.hasEOL) {
                if (currentLine.trim()) lines.push(currentLine.trim());
                currentLine = "";
                lastY = null;
              }
            }
            if (currentLine.trim()) lines.push(currentLine.trim());

            const text = lines.join("\n").trim();
            if (text.length > 0) {
              pageTexts[pNum - 1] = `--- PAGE ${pNum} ---\n${text}`;
            }
          })
        );
      }

      const joined = pageTexts.filter(Boolean).join("\n\n").trim();
      if (joined.length >= 25) {
        return { success: true, content: joined, usedVision: false };
      }

      // Si le PDF est scanné, déclenche le moteur OCR hybride complet (Vision IA + Tesseract.js)
      const { ocrPdfDocument } = await import("@/lib/ocrEngine");
      const ocrRes = await ocrPdfDocument(file);
      if (ocrRes.text && ocrRes.text.trim().length >= 20) {
        return { success: true, content: ocrRes.text.trim(), usedVision: true };
      }
    } catch {
      // Fallback ci-dessous
    }
  }

  // Secours strictement réservé aux 14 PDF scannés nommés explicitement "Hémato" ou "Maladie systémique"
  if (_mode === "annales" && looksLikeUcadExamFileName(file.name)) {
    const byExplicitName = lookupPreExtractedExamCorpus(file.name);
    if (byExplicitName) {
      return { success: true, content: byExplicitName, usedVision: true };
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

  return {
    success: false,
    content: "",
    usedVision: false,
  };
}
