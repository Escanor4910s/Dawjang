import { exportQuizToPDF } from "@/utils/pdfExport";
import type { QuizData } from "@/utils/QuizPDF";
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  QuestionArchetype,
  CognitiveTier,
  OptionLetter,
  QuizQuestion,
  QuizSeriesSession,
  CourseSourceItem,
  UserQuestionAnswerState,
} from "@/types/quiz";
import { supabase } from "@/integrations/supabase/client";
import {
  sanitizeAndValidateQuestions,
  buildUniversalDocimologicalBatchPrompt,
  DocimologicalFormat,
} from "@/lib/annalesMimicryEngine";
import { callDawiaEngine } from "@/lib/dawiaQcmEngine";
import { repairAndParseQuizJson } from "@/lib/jsonRepair";
import { getSavedCourses } from "@/pages/Library";
import { filterOutTombstoned } from "@/lib/syncEngine";
import {
  Search,
  LayoutGrid,
  List,
  Check,
  BookOpen,
  Clock,
  X,
  Layers,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";

const LETTERS: OptionLetter[] = ["A", "B", "C", "D", "E"];
const STORAGE_SERIES_KEY = "dawjang_qcm_series_v2";

type ConstructeurStage = "studio" | "library" | "reading";

const QCM_FORMAT_CATALOG: {
  id: QuestionArchetype;
  name: string;
  rule: string;
}[] = [
  { id: "complement_multiple", name: "Élection", rule: "1 seule proposition exacte (A–E)" },
  { id: "censure", name: "Censure", rule: "Identifier la proposition fausse" },
  { id: "election_censure", name: "Élection-Censure", rule: "Combinaison codée A, B, C, D, E" },
  { id: "groupage", name: "Groupage", rule: "Regroupement I, II, III, IV" },
  { id: "jumelage", name: "Jumelage", rule: "Lien de causalité entre 2 énoncés" },
  { id: "association", name: "Association (ACM)", rule: "Appariement entités cliniques" },
];

const INITIAL_DEMO_QUESTIONS: QuizQuestion[] = [
  {
    id: "q_init_1",
    index: 1,
    archetype: "complement_multiple",
    cognitiveTier: "mecanismes",
    stem: "Concernant la définition biologique de l'anémie et les fausses anémies par hémodilution, quelle est la proposition exacte ?",
    conceptTag: "Seuils OMS & Hémodilution",
    options: [
      { letter: "A", text: "Chez la femme adulte non enceinte, le diagnostic d'anémie est posé dès que le taux d'hémoglobine est inférieur à 13 g/dl." },
      { letter: "B", text: "Chez la femme enceinte et chez l'enfant, on parle d'anémie lorsque le taux d'hémoglobine est inférieur à 11 g/dl à volume plasmatique normal." },
      { letter: "C", text: "Chez le nouveau-né, la limite inférieure normale du taux d'hémoglobine est fixée à 10 g/dl." },
      { letter: "D", text: "Une splénomégalie volumineuse ou une hyperhydratation entraîne une fausse polyglobulie par hémoconcentration." },
      { letter: "E", text: "L'interprétation du taux d'hémoglobine est totalement indépendante des variations du volume plasmatique." },
    ],
    correctLetter: "B",
    globalExplanation:
      "Les seuils d'Hb définissant l'anémie (à volume plasmatique normal) sont : Homme adulte < 13 g/dl, Femme adulte < 12 g/dl, Femme enceinte et enfant < 11 g/dl, et Nouveau-né < 14 g/dl. L'hyperhydratation et la splénomégalie provoquent de fausses anémies par hémodilution.",
  },
  {
    id: "q_init_2",
    index: 2,
    archetype: "complement_multiple",
    cognitiveTier: "mecanismes",
    stem: "Un patient présente à l'hémogramme : Globules rouges = 4,0 millions/mm³, Hémoglobine = 10 g/dl, Hématocrite = 30 %. Quelle est la proposition exacte concernant ses constantes érythrocytaires ?",
    conceptTag: "Constantes érythrocytaires",
    options: [
      { letter: "A", text: "Le volume globulaire moyen (VGM) se calcule par la formule Hémoglobine × 10 / Globules rouges et vaut ici 25 fl." },
      { letter: "B", text: "La concentration corpusculaire moyenne en hémoglobine (CCMH) normale est comprise entre 27 et 31 %." },
      { letter: "C", text: "La teneur corpusculaire moyenne en hémoglobine (TCMH) se calcule par la formule Hb × 100 / Hématocrite." },
      { letter: "D", text: "Son volume globulaire moyen (VGM = Ht × 10 / GR) est égal à 75 fl et sa TCMH (Hb × 10 / GR) est égale à 25 pg, caractérisant une anémie microcytaire hypochrome." },
      { letter: "E", text: "Son indice de distribution cellulaire (IDR) normal est compris entre 32 et 36 %." },
    ],
    correctLetter: "D",
    globalExplanation:
      "VGM = Ht (%) × 10 / GR (en millions) = (30 × 10) / 4 = 75 fl (normale 80–90 fl → microcytose) ; TCMH = Hb (g/dl) × 10 / GR (en millions) = 100 / 4 = 25 pg (normale 27–31 pg → hypochromie) ; CCMH = Hb × 100 / Ht = 33,3 % (normale 32–36 %).",
  },
  {
    id: "q_init_3",
    index: 3,
    archetype: "complement_multiple",
    cognitiveTier: "discernement",
    stem: "À propos des tests d'exploration du métabolisme du fer devant une anémie hypochrome microcytaire, quelle est la proposition exacte ?",
    conceptTag: "Bilan martial & sTfR",
    options: [
      { letter: "A", text: "Le récepteur soluble de la transferrine (sTfR) n'augmente pas avec l'inflammation, mais s'élève franchement en cas de déficit en fer." },
      { letter: "B", text: "La ferritinémie est systématiquement effondrée au cours d'une anémie inflammatoire pure." },
      { letter: "C", text: "Le coefficient de saturation de la transferrine normal est compris entre 80 et 90 %." },
      { letter: "D", text: "Le dosage du fer sérique isolé est le test le plus sensible et le plus spécifique du stock martial." },
      { letter: "E", text: "Dans la thalassémie, le fer sérique et la ferritinémie sont toujours effondrés." },
    ],
    correctLetter: "A",
    globalExplanation:
      "Le récepteur soluble de la transferrine (sTfR) ne s'élève pas lors des états inflammatoires : il demeure normal dans l'anémie inflammatoire pure mais augmente dans le déficit en fer (ou l'association déficit + inflammation).",
  },
  {
    id: "q_init_4",
    index: 4,
    archetype: "complement_multiple",
    cognitiveTier: "discernement",
    stem: "Concernant l'étude des réticulocytes et la teneur en hémoglobine des réticulocytes (RET-He), quelle est la proposition exacte ?",
    conceptTag: "Réticulocytes & RET-He",
    options: [
      { letter: "A", text: "Le réticulocyte séjourne normalement 10 jours dans le sang périphérique après sa sortie de la moelle osseuse." },
      { letter: "B", text: "La coloration supravitale des réticulocytes se fait exclusivement par le May-Grünwald Giemsa standard." },
      { letter: "C", text: "Une valeur de RET-He inférieure à 28 pg traduit une carence en fer ou une indisponibilité actuelle du fer pour l'érythropoïèse au cours des 1 à 2 derniers jours." },
      { letter: "D", text: "Une anémie normochrome normocytaire est dite régénérative lorsque le taux de réticulocytes est inférieur à 20 000/mm³." },
      { letter: "E", text: "La fraction LFR correspond aux réticulocytes les plus immatures à très haute fluorescence." },
    ],
    correctLetter: "C",
    globalExplanation:
      "Le réticulocyte (coloré au bleu de crésyl brillant ou bleu de méthylène) reste 3 jours dans la moelle et 1 jour dans le sang périphérique. Le paramètre RET-He reflète l'hémoglobinisation des érythrocytes produits au cours des 1 à 2 derniers jours : une valeur < 28 pg signe l'indisponibilité actuelle du fer pour l'érythropoïèse.",
  },
  {
    id: "q_init_5",
    index: 5,
    archetype: "complement_multiple",
    cognitiveTier: "discernement",
    stem: "Concernant le traitement des anémies par carence martiale, inflammatoires ou mégaloblastiques, quelle est la proposition exacte ?",
    conceptTag: "Traitement & Contre-indications",
    options: [
      { letter: "A", text: "Dans l'anémie inflammatoire pure, l'administration parentérale ou orale de sels ferreux constitue le traitement de première intention." },
      { letter: "B", text: "Le déficit en vitamine B12 se traite exclusivement par acide folique à la dose de 5 mg/jour per os." },
      { letter: "C", text: "Le traitement curatif de la carence en fer chez l'adulte ne doit jamais dépasser 7 jours de sels ferreux." },
      { letter: "D", text: "Dans la carence en fer de l'enfant, la posologie des sels ferreux est de 100 mg/kg/jour pendant 1 an." },
      { letter: "E", text: "Dans la carence en fer, on prescrit des sels ferreux à raison de 100 à 200 mg/jour chez l'adulte (10 mg/kg chez l'enfant) pendant 2 à 3 mois jusqu'à correction de l'anémie puis à demi-dose, tandis que le fer est contre-indiqué dans l'anémie inflammatoire." },
    ],
    correctLetter: "E",
    globalExplanation:
      "La carence en fer se traite par sels ferreux (100–200 mg/j chez l'adulte, 10 mg/kg chez l'enfant) pendant 2 à 3 mois puis demi-dose pour recharger les réserves, associé au traitement de la cause. Dans l'anémie inflammatoire, l'administration de fer est contre-indiquée.",
  },
];

function formatMinuteTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatSeriesDate(rawDate?: string): string {
  if (!rawDate) return "Aujourd'hui";
  const str = String(rawDate).trim();
  // Si déjà formaté court en français
  if (str.includes(" à ") && str.length <= 25) return str;
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const day = pad(d.getDate());
      const month = d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      return `${day} ${month} à ${hours}h${mins}`;
    }
  } catch {
    // fallback
  }
  // Si format JJ/MM/AAAA ou JJ-MM-AAAA
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s*à\s*(\d{1,2})[h:](\d{1,2}))?/);
  if (match) {
    const [, d, m, , h, min] = match;
    const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
    const mName = months[parseInt(m, 10) - 1] || m;
    const timeStr = h && min ? ` à ${h}h${min}` : "";
    return `${d.padStart(2, "0")} ${mName}${timeStr}`;
  }
  return str.length > 20 ? str.slice(0, 16) : str;
}

function extractCleanRootName(rawTitle: string): string {
  if (!rawTitle) return "Cours";
  const withoutExt = rawTitle.replace(/\.[^/.]+$/, "");
  const withoutParen = withoutExt.replace(/\([^)]*\)/g, "");
  const withoutLeadingNums = withoutParen.replace(/^[0-9]+[\s._-]+/, "");
  const withoutYears = withoutLeadingNums.replace(/\b(202[0-9]|19[0-9]{2})\b/g, "");
  const cleaned = withoutYears.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").slice(0, 4).join(" ");
  return words || "Cours";
}

function detectSpecialtyFromText(title: string, content: string): string {
  const combined = `${title} ${content}`.toLowerCase();
  if (/cardio|coronaire|ecg|infarctus|péricardite|insuffisance cardiaque|hta|troponine|valvulopath/i.test(combined)) {
    return "Cardiologie";
  }
  if (/anémie|hémato|drépanocytose|thalassémie|leucémie|lymphome|plaquette|ferriprive|hémolyse|hemostase|coagulation/i.test(combined)) {
    return "Hématologie";
  }
  if (/pneumo|bpco|asthme|poumon|respiratoire|dyspnée|pleurésie|tuberculose|pneumonie/i.test(combined)) {
    return "Pneumologie";
  }
  if (/infectio|bactérie|paludisme|méningite|sepsis|antibiotique|vih|fièvre|parasit/i.test(combined)) {
    return "Maladies Infectieuses";
  }
  if (/néphro|rein|glomérul|créatinine|insuffisance rénale|protéinurie|dialyse|lithiase/i.test(combined)) {
    return "Néphrologie";
  }
  if (/neuro|avc|céphalée|épilepsie|coma|méningé|paralysie|neuropathie|parkinson|alzh/i.test(combined)) {
    return "Neurologie";
  }
  if (/gastro|hépato|foie|ulcère|cirrhose|ictère|diarrhée|pancréas|digestif/i.test(combined)) {
    return "Gastro-Entérologie";
  }
  if (/pédiatr|enfant|nourrisson|néonat|vaccination/i.test(combined)) {
    return "Pédiatrie";
  }
  if (/gynéco|obstétri|grossesse|accouchement|hémorragie de la délivrance/i.test(combined)) {
    return "Gynécologie-Obstétrique";
  }
  if (/endocrino|diabète|thyroïde|surrénale|hypophyse/i.test(combined)) {
    return "Endocrinologie";
  }
  return "Médecine Générale";
}

function getSpecialtyBadgeStyle(subject?: string): {
  badgeClass: string;
  dotColor: string;
} {
  const s = (subject || "").toLowerCase();
  if (s.includes("cardio")) {
    return {
      badgeClass:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
      dotColor: "bg-rose-500",
    };
  }
  if (s.includes("hèm") || s.includes("hem")) {
    return {
      badgeClass:
        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
      dotColor: "bg-amber-600",
    };
  }
  if (s.includes("pneumo")) {
    return {
      badgeClass:
        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50",
      dotColor: "bg-sky-500",
    };
  }
  if (s.includes("infect")) {
    return {
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
      dotColor: "bg-emerald-500",
    };
  }
  if (s.includes("néphro") || s.includes("nephro") || s.includes("uro")) {
    return {
      badgeClass:
        "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50",
      dotColor: "bg-violet-500",
    };
  }
  if (s.includes("neuro")) {
    return {
      badgeClass:
        "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50",
      dotColor: "bg-indigo-500",
    };
  }
  if (s.includes("gastro") || s.includes("hépato")) {
    return {
      badgeClass:
        "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50",
      dotColor: "bg-orange-500",
    };
  }
  return {
    badgeClass: "bg-secondary text-secondary-foreground border-border",
    dotColor: "bg-foreground/60",
  };
}

function getClinicalExcerpt(content: string, maxChars = 135): string {
  const cleaned = (content || "")
    .replace(/---.*?---/g, "")
    .replace(/^#+.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars).trim() + "...";
}

async function extractTextFromUploadedFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    return await file.text();
  }
  if (name.endsWith(".pdf")) {
    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((it: any) => it.str).join(" ");
          fullText += `\n--- Page ${i} ---\n` + pageText;
        }
        if (fullText.trim().length > 50) return fullText.trim();
      }
    } catch {
      // Fallback binaire
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const rawLatin = new TextDecoder("latin1").decode(bytes);
    const textChunks: string[] = [];
    const regex = /\(([^()\\]{3,})\)/g;
    let match;
    while ((match = regex.exec(rawLatin)) !== null) {
      const cleaned = match[1].replace(/[^\x20-\x7E\xC0-\xFF]/g, " ").trim();
      if (cleaned.length > 3 && !/^[0-9\s.]+$/.test(cleaned)) {
        textChunks.push(cleaned);
      }
    }
    const joined = textChunks.join(" ").replace(/\s+/g, " ").trim();
    if (joined.length > 100) return joined;
  }
  return await file.text();
}

/**
 * Loi d'Équisme : garantit l'absence de suites monotones (jamais 3 fois la même lettre consécutive)
 */
function enforceEquismeOnQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const copy: QuizQuestion[] = JSON.parse(JSON.stringify(questions));
  for (let i = 2; i < copy.length; i++) {
    const prev2 = copy[i - 2].correctLetter;
    const prev1 = copy[i - 1].correctLetter;
    const curr = copy[i].correctLetter;
    if (curr === prev1 && curr === prev2) {
      const q = copy[i];
      const currentIdx = LETTERS.indexOf(curr);
      const targetIdx = (currentIdx + 2) % q.options.length;
      const tempText = q.options[currentIdx].text;
      const tempRat = q.options[currentIdx].rationale;
      q.options[currentIdx].text = q.options[targetIdx].text;
      q.options[currentIdx].rationale = q.options[targetIdx].rationale;
      q.options[targetIdx].text = tempText;
      q.options[targetIdx].rationale = tempRat;
      q.correctLetter = LETTERS[targetIdx];
    }
  }
  return copy;
}

const CONSTRUCTEUR_SCOPED_CSS = `
  .font-mono-metric {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
    font-variant-numeric: tabular-nums;
  }
  .craft-surface {
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    box-shadow: 0 1px 2px rgba(24, 22, 19, 0.035),
                0 6px 20px -4px rgba(24, 22, 19, 0.045),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.85);
    transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1),
                border-color 0.2s ease,
                background-color 0.2s ease;
  }
  .craft-card-interactive:hover {
    transform: translateY(-2px);
    box-shadow: 0 3px 8px rgba(24, 22, 19, 0.05),
                0 16px 34px -6px rgba(24, 22, 19, 0.085),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.95);
    border-color: hsl(var(--foreground) / 0.18);
  }
  .craft-card-interactive:active {
    transform: translateY(0px) scale(0.996);
  }
  @keyframes popoverSpring {
    0% { opacity: 0; transform: scale(0.94) translateY(-6px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .craft-popover {
    background-color: hsl(var(--popover, var(--card)) / 0.97);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    box-shadow: 0 18px 42px -8px rgba(18, 16, 14, 0.18),
                0 4px 12px -2px rgba(18, 16, 14, 0.08),
                0 0 0 1px rgba(18, 16, 14, 0.07);
    border: 1px solid hsl(var(--border));
    transform-origin: top right;
    animation: popoverSpring 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .qcm-option-card {
    transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
                background-color 0.16s ease,
                border-color 0.16s ease,
                box-shadow 0.16s ease;
  }
  .qcm-option-card:hover:not(.qcm-option-locked) {
    background-color: hsl(var(--secondary) / 0.65);
    border-color: hsl(var(--foreground) / 0.22);
    transform: translateX(2px);
  }
  .qcm-option-picked {
    background-color: hsl(var(--primary) / 0.075) !important;
    border-color: hsl(var(--primary)) !important;
    box-shadow: 0 0 0 1px hsl(var(--primary) / 0.22);
  }
  .qcm-option-correct {
    background-color: rgba(16, 185, 129, 0.08) !important;
    border-color: rgba(16, 185, 129, 0.55) !important;
  }
  .qcm-option-wrong {
    background-color: rgba(244, 63, 94, 0.08) !important;
    border-color: rgba(244, 63, 94, 0.55) !important;
  }
  .glass-arrow-tab {
    background: hsl(var(--card) / 0.9);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid hsl(var(--border));
    border-right: none;
    box-shadow: -6px 10px 28px -4px rgba(20, 18, 15, 0.1);
    transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .glass-arrow-tab:hover {
    padding-right: 12px;
    background: hsl(var(--card) / 0.98);
  }
  @keyframes drawerSlideLeft {
    from { opacity: 0; transform: translateX(18px) scale(0.98); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }
  .glass-expanded-drawer {
    background: hsl(var(--card) / 0.86);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid hsl(var(--border));
    border-right: none;
    box-shadow: -16px 24px 56px -12px rgba(18, 16, 14, 0.22),
                0 0 0 1px rgba(255, 255, 255, 0.25) inset;
    animation: drawerSlideLeft 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
`;

export const ConstructeurQCM: React.FC = () => {
  // Navigation interne du Constructeur de QCM (Studio | Librairie | Lecture — SANS "Voir le cours")
  const [activeStage, setActiveStage] = useState<ConstructeurStage>("library");
  const [sourceTab, setSourceTab] = useState<"import" | "biblio">("import");
  const [libraryCourses, setLibraryCourses] = useState<CourseSourceItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("anemies_2026_ucad");
  const [biblioSearch, setBiblioSearch] = useState<string>("");
  const [biblioLayout, setBiblioLayout] = useState<"mosaic" | "list">("mosaic");
  const [selectedBiblioSubject, setSelectedBiblioSubject] = useState<string>("Tous");

  // Paramètres de génération
  const [selectedStyle, setSelectedStyle] = useState<"professeurs" | "ia_progressif">("professeurs");
  const [selectedFormats, setSelectedFormats] = useState<QuestionArchetype[]>(["complement_multiple"]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [infiniteMode, setInfiniteMode] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Librairie (Mosaïque / Alignement + Menu •••)
  const [libraryViewMode, setLibraryViewMode] = useState<"mosaic" | "alignment">("mosaic");
  const [librarySearch, setLibrarySearch] = useState<string>("");
  const [openDropdownSeriesId, setOpenDropdownSeriesId] = useState<string | null>(null);

  // Séries & Lecture en défilement
  const [seriesList, setSeriesList] = useState<QuizSeriesSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: "serie_1_initiale",
        courseRootTitle: "Anémies : Diagnostic et prise en charge",
        seriesNumber: 1,
        displayTitle: "Série 1",
        createdAt: "09/11/2026 à 14:50",
        archetypes: ["complement_multiple"],
        cognitiveTier: "mecanismes",
        questions: INITIAL_DEMO_QUESTIONS,
        userAnswers: {
          q_init_1: { picked: "B", validated: true, isCorrect: true },
          q_init_2: { picked: "A", validated: true, isCorrect: false },
          q_init_3: { picked: "A", validated: true, isCorrect: true },
        },
      },
    ];
  });

  const [activeSeriesId, setActiveSeriesId] = useState<string>(() => seriesList[0]?.id || "serie_1_initiale");
  const [examMode, setExamMode] = useState<boolean>(false);
  const [widgetExpanded, setWidgetExpanded] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  // Synchronisation localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SERIES_KEY, JSON.stringify(seriesList));
    } catch {
      // ignore
    }
  }, [seriesList]);

  // Chargement exhaustif des cours depuis la Bibliothèque (LocalStorage + Supabase) sans collision
  useEffect(() => {
    async function loadCourses() {
      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      const list: CourseSourceItem[] = [];

      const addCourse = (item: CourseSourceItem) => {
        const normTitle = (item.cleanRootName || item.title).toLowerCase().trim();
        if (seenIds.has(item.id) || seenTitles.has(normTitle)) return;
        seenIds.add(item.id);
        seenTitles.add(normTitle);
        list.push(item);
      };

      // 1. Cours enregistrés dans la bibliothèque de l'étudiant (LocalStorage)
      try {
        const saved = getSavedCourses();
        if (Array.isArray(saved)) {
          for (const c of saved) {
            if (c && c.title && c.content) {
              addCourse({
                id: c.id,
                title: c.title,
                cleanRootName: extractCleanRootName(c.title),
                content: c.content,
                sourceType: "library",
                wordCount: c.wordCount || c.content.split(/\s+/).filter(Boolean).length,
                subject: c.subject || detectSpecialtyFromText(c.title, c.content),
                updatedAt: c.updatedAt || "Enregistré",
                code: c.code,
              });
            }
          }
        }
      } catch (err) {
        console.warn("[ConstructeurQCM] Erreur lecture getSavedCourses:", err);
      }

      // 2. Cours de référence officiels (Gold Standard UCAD)
      const demoCourses: CourseSourceItem[] = [
        {
          id: "anemies_2026_ucad",
          title: "Anémies : Diagnostic et prise en charge",
          cleanRootName: "Anémies : Diagnostic et prise en charge",
          sourceType: "library",
          wordCount: 1850,
          subject: "Hématologie",
          updatedAt: "Aujourd'hui",
          content:
            "Anémies : Diagnostic et prise en charge (Prof. Saliou Diop, Service d'Hématologie UCAD). Seuils Hb : Homme < 13 g/dl, Femme < 12 g/dl, Femme enceinte et enfant < 11 g/dl, Nouveau-né < 14 g/dl. VGM = Ht x 10 / GR (80-90 fl), TCMH = Hb x 10 / GR (27-31 pg), CCMH = Hb x 100 / Ht (32-36 %). Réticulocytes < 80 000/mm3 = arégénérative (centrale) ; > 80 000/mm3 = régénérative (périphérique). RET-He < 28 pg = carence martiale / fer indisponible. Sels ferreux 100-200 mg/j adulte et 10 mg/kg enfant pendant 2 à 3 mois puis demi-dose.",
        },
        {
          id: "hemoglobinopathies_m1_ucad",
          title: "Hémoglobinopathies : Drépanocytose & Thalassémies (M1)",
          cleanRootName: "Hémoglobinopathies : Drépanocytose & Thalassémies",
          sourceType: "library",
          wordCount: 2640,
          subject: "Hématologie",
          updatedAt: "Aujourd'hui",
          content:
            "Hémoglobinopathies (Prof. Saliou Diop, Master 1 Hématologie Clinique). Drépanocytose : mutation GAG -> GTG du codon 6 du gène bêta (Glu -> Val). Sénégal : 8-10 % de porteurs AS, 0,2-0,5 % de formes majeures. Électrophorèse SS : HbS > 80 %, HbA2 2-3 %, HbF < 15 %. Hydroxyurée : dose initiale 15 mg/kg/j (-50 % si clairance < 60 ml/min), max 35 mg/kg/j, arrêt provisoire si PNN < 1 G/L ou Plaquettes < 100 G/L. Oracilline : 100 000 UI/kg/j si <= 10 kg, 50 000 UI/kg/j si > 10 kg jusqu'à 10 ans.",
        },
      ];
      demoCourses.forEach(addCourse);

      // 3. Récupération distante sécurisée depuis Supabase
      try {
        const { data } = await supabase
          .from("courses")
          .select("id, title, content, created_at")
          .order("created_at", { ascending: false })
          .limit(40);

        if (Array.isArray(data)) {
          for (const row of data) {
            if (row && row.title && row.content) {
              addCourse({
                id: String(row.id),
                title: String(row.title),
                cleanRootName: extractCleanRootName(String(row.title)),
                content: String(row.content),
                sourceType: "library",
                wordCount: String(row.content).split(/\s+/).filter(Boolean).length,
                subject: detectSpecialtyFromText(String(row.title), String(row.content)),
                updatedAt: row.created_at
                  ? new Date(row.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Récemment",
              });
            }
          }
        }
      } catch {
        // Mode hors-ligne
      }

      const filteredList = filterOutTombstoned("course", list);
      setLibraryCourses(filteredList);

      // Conserver ou initialiser le cours sélectionné
      setSelectedCourseId((prev) => {
        if (prev && filteredList.some((c) => c.id === prev)) return prev;
        return filteredList[0]?.id || "anemies_2026_ucad";
      });
    }
    loadCourses();
  }, []);

  // Fermeture automatique du widget flèche (‹) et du menu ••• au clic extérieur
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (widgetExpanded && widgetRootRef.current && !widgetRootRef.current.contains(target)) {
        setWidgetExpanded(false);
      }
      if (openDropdownSeriesId !== null && !target.closest("[data-dropdown-container]")) {
        setOpenDropdownSeriesId(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [widgetExpanded, openDropdownSeriesId]);

  const selectedCourse = useMemo(
    () => libraryCourses.find((c) => c.id === selectedCourseId) || libraryCourses[0],
    [libraryCourses, selectedCourseId]
  );

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    set.add("Tous");
    libraryCourses.forEach((c) => {
      const s = c.subject?.trim();
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [libraryCourses]);

  const filteredLibraryCourses = useMemo(() => {
    return libraryCourses.filter((c) => {
      const query = biblioSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.cleanRootName.toLowerCase().includes(query) ||
        (c.subject && c.subject.toLowerCase().includes(query)) ||
        c.content.toLowerCase().includes(query);

      const matchesSubject =
        selectedBiblioSubject === "Tous" ||
        (c.subject && c.subject.toLowerCase() === selectedBiblioSubject.toLowerCase());

      return matchesSearch && matchesSubject;
    });
  }, [libraryCourses, biblioSearch, selectedBiblioSubject]);

  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || seriesList[0],
    [seriesList, activeSeriesId]
  );

  const computeSeriesStats = (series?: QuizSeriesSession) => {
    if (!series) return { total: 0, found: 0, missed: 0, answered: 0, pct: 0 };
    const total = series.questions.length;
    let found = 0;
    let missed = 0;
    const ansMap = series.userAnswers || {};
    for (const q of series.questions) {
      const a = ansMap[q.id];
      if (a && a.validated) {
        if (a.isCorrect) found++;
        else missed++;
      }
    }
    const answered = found + missed;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, found, missed, answered, pct };
  };

  // Upload d'un fichier local dans le Studio (Sélection directe comme source du QCM, sans "Voir le cours")
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await extractTextFromUploadedFile(file);
      const newCourse: CourseSourceItem = {
        id: `upload_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        cleanRootName: extractCleanRootName(file.name),
        content: text,
        sourceType: "upload",
        wordCount: Math.max(1, text.split(/\s+/).filter(Boolean).length),
        subject: detectSpecialtyFromText(file.name, text),
        updatedAt: "Aujourd'hui",
      };
      setLibraryCourses((prev) => [newCourse, ...prev]);
      setSelectedCourseId(newCourse.id);
      triggerToast(`Fichier importé et sélectionné : ${newCourse.title}`);
    } catch {
      triggerToast(`Impossible de lire le fichier ${file.name}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleToggleFormat = (fmtId: QuestionArchetype) => {
    setSelectedFormats((prev) => {
      if (prev.includes(fmtId)) {
        return prev.length > 1 ? prev.filter((x) => x !== fmtId) : prev;
      }
      return [...prev, fmtId];
    });
  };

  // Génération d'une nouvelle série de QCM
  const handleGenerateSeries = async () => {
    if (!selectedCourse || isGenerating) return;
    setIsGenerating(true);

    const nextNum = seriesList.length + 1;
    const newSeriesId = `serie_${Date.now()}`;
    const tier: CognitiveTier = selectedStyle === "professeurs" ? "discernement" : "mecanismes";

    try {
      const formatMap: Record<QuestionArchetype, DocimologicalFormat> = {
        complement_multiple: "election",
        censure: "censure",
        election_censure: "choix_multiple",
        groupage: "groupage",
        jumelage: "jumelage",
        association: "association",
      };
      const scheduledFormats = selectedFormats.map((f) => formatMap[f] || "election");

      let collectedRaw: any[] = [];
      try {
        const systemPrompt = `Tu es un Professeur Agrégé de Médecine. Génère ${questionCount} QCM docimologiques rigoureux sur le cours "${selectedCourse.title}" en respectant la Loi d'Équisme.`;
        const batchPrompt = buildUniversalDocimologicalBatchPrompt({
          courseTitle: selectedCourse.cleanRootName,
          courseChunk: selectedCourse.content.slice(0, 24000),
          batchFormats: scheduledFormats,
          batchStartIndex: 0,
          difficulty: tier,
          sessionNumber: nextNum,
          pastStems: [],
        });
        const dawiaRaw = await callDawiaEngine("dawia2", systemPrompt, batchPrompt, 0.3);
        if (dawiaRaw) {
          const parsed = repairAndParseQuizJson(dawiaRaw);
          const arr = Array.isArray(parsed) ? parsed : parsed?.questions || [];
          if (Array.isArray(arr) && arr.length > 0) collectedRaw = arr;
        }
      } catch {
        // Fallback déterministe local via sanitizeAndValidateQuestions
      }

      const validated = sanitizeAndValidateQuestions(
        collectedRaw,
        selectedCourse.cleanRootName,
        {
          expectedCount: questionCount,
          selectedFormats: scheduledFormats,
          courseText: selectedCourse.content,
          difficulty: tier,
          sessionNumber: nextNum,
        }
      );

      const builtQuestions: QuizQuestion[] = validated.map((vq, idx) => {
        const opts = vq.options.map((o, oi) => ({
          letter: (o.letter || LETTERS[oi]) as OptionLetter,
          text: o.text,
          rationale: o.rationale,
        }));
        const correctOpt = vq.options.find((o) => o.isCorrect) || vq.options[0];
        return {
          id: `${newSeriesId}_q_${idx + 1}`,
          index: idx + 1,
          archetype: selectedFormats[idx % selectedFormats.length] || "complement_multiple",
          cognitiveTier: tier,
          stem: vq.stem,
          conceptTag: vq.subject || selectedCourse.cleanRootName,
          options: opts,
          correctLetter: (correctOpt?.letter || "B") as OptionLetter,
          globalExplanation:
            vq.globalSynthesis ||
            vq.options.map((o) => `${o.letter} : ${o.rationale || ""}`).join(" "),
        };
      });

      const finalQuestions = enforceEquismeOnQuestions(
        builtQuestions.length > 0 ? builtQuestions : INITIAL_DEMO_QUESTIONS
      );

      const newSeries: QuizSeriesSession = {
        id: newSeriesId,
        courseRootTitle: selectedCourse.title,
        seriesNumber: nextNum,
        displayTitle: `Série ${nextNum}`,
        createdAt: formatMinuteTimestamp(),
        archetypes: selectedFormats,
        cognitiveTier: tier,
        questions: finalQuestions,
        userAnswers: {},
      };

      setSeriesList((prev) => [newSeries, ...prev]);
      setActiveSeriesId(newSeries.id);
      setExamMode(false);
      setActiveStage("reading");
      triggerToast(`${newSeries.displayTitle} générée (${newSeries.createdAt})`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Téléchargement vectoriel HD au format PDF
  const handleDownloadSeriesPDF = async (series: QuizSeriesSession) => {
    try {
      const quizData: QuizData = {
        title: `${series.displayTitle} — ${series.courseRootTitle}`,
        subject: series.courseRootTitle,
        difficultyLabel: series.cognitiveTier === "discernement" ? "Haute Docimologie (Sélectif)" : "Standard Faculté",
        formatLabel: "Série Docimologique Multiformats",
        includeAnswerGrid: true,
        includeAnswerKey: true,
        questions: series.questions.map((q) => ({
          question: q.stem,
          qcmType: q.archetype,
          options: q.options.map((o) => ({
            label: o.letter,
            text: o.text,
            isCorrect: o.letter === q.correctLetter,
          })),
          choices: q.options.map((o) => `${o.letter}. ${o.text}`),
          correct: [q.correctLetter],
          explanation: q.globalExplanation,
        })),
      };
      await exportQuizToPDF(quizData);
      triggerToast(`PDF vectoriel généré pour ${series.displayTitle}`);
    } catch (err) {
      console.error("PDF export fallback to TXT:", err);
      handleDownloadSeries(series);
    }
  };

  // Téléchargement d'une série depuis le menu •••
  const handleDownloadSeries = (series: QuizSeriesSession) => {
    const lines: string[] = [];
    lines.push("====================================================================");
    lines.push(`DAWJANG — ${series.displayTitle.toUpperCase()} (${series.courseRootTitle})`);
    lines.push(`Date : ${series.createdAt} • ${series.questions.length} questions`);
    lines.push("====================================================================\n");

    series.questions.forEach((q, idx) => {
      lines.push(`Question ${idx + 1} — ${q.stem}`);
      q.options.forEach((opt) => {
        lines.push(`   ${opt.letter}. ${opt.text}`);
      });
      lines.push(`   Réponse exacte : ${q.correctLetter}`);
      lines.push(`   Justification : ${q.globalExplanation}\n`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${series.displayTitle}_${series.courseRootTitle}`
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .concat(".txt");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    triggerToast(`Questionnaire téléchargé (${series.displayTitle})`);
  };

  // Sélection et validation des propositions A–E
  const handlePickOption = (questionId: string, letter: OptionLetter) => {
    if (!activeSeries) return;
    const currentAns = activeSeries.userAnswers?.[questionId];
    if (currentAns?.validated) return;

    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === activeSeries.id
          ? {
              ...s,
              userAnswers: {
                ...(s.userAnswers || {}),
                [questionId]: { picked: letter, validated: false, isCorrect: false },
              },
            }
          : s
      )
    );
  };

  const handleValidateQuestion = (question: QuizQuestion) => {
    if (!activeSeries) return;
    const currentAns = activeSeries.userAnswers?.[question.id];
    if (!currentAns?.picked) return;

    const isCorrect = currentAns.picked === question.correctLetter;
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === activeSeries.id
          ? {
              ...s,
              userAnswers: {
                ...(s.userAnswers || {}),
                [question.id]: {
                  picked: currentAns.picked,
                  validated: true,
                  isCorrect,
                },
              },
            }
          : s
      )
    );
  };

  const handleRetryQuestion = (questionId: string) => {
    if (!activeSeries) return;
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === activeSeries.id
          ? {
              ...s,
              userAnswers: {
                ...(s.userAnswers || {}),
                [questionId]: { picked: null, validated: false, isCorrect: false },
              },
            }
          : s
      )
    );
  };

  const handleFinishSeries = () => {
    if (!activeSeries) return;
    const updatedAnswers: Record<string, UserQuestionAnswerState> = {
      ...(activeSeries.userAnswers || {}),
    };
    activeSeries.questions.forEach((q) => {
      const curr = updatedAnswers[q.id];
      if (curr && curr.picked && !curr.validated) {
        updatedAnswers[q.id] = {
          picked: curr.picked,
          validated: true,
          isCorrect: curr.picked === q.correctLetter,
        };
      }
    });

    setSeriesList((prev) =>
      prev.map((s) => (s.id === activeSeries.id ? { ...s, userAnswers: updatedAnswers } : s))
    );
    setExamMode(false);
    setWidgetExpanded(true);
    triggerToast("Série complétée — consultez votre avancement dans le panneau latéral.");
  };

  const handleAppendInfiniteQuestions = () => {
    if (!activeSeries) return;
    const startIdx = activeSeries.questions.length;
    const added: QuizQuestion[] = INITIAL_DEMO_QUESTIONS.map((baseQ, i) => ({
      ...JSON.parse(JSON.stringify(baseQ)),
      id: `${activeSeries.id}_inf_${Date.now()}_${i}`,
      index: startIdx + i + 1,
    }));
    const merged = enforceEquismeOnQuestions([...activeSeries.questions, ...added]);
    setSeriesList((prev) =>
      prev.map((s) => (s.id === activeSeries.id ? { ...s, questions: merged } : s))
    );
    triggerToast("+ 5 nouvelles questions ajoutées en Mode Infini.");
  };

  const activeStats = computeSeriesStats(activeSeries);

  const filteredSeries = useMemo(() => {
    const q = librarySearch.toLowerCase().trim();
    if (!q) return seriesList;
    return seriesList.filter(
      (s) =>
        s.courseRootTitle.toLowerCase().includes(q) ||
        s.displayTitle.toLowerCase().includes(q) ||
        s.createdAt.toLowerCase().includes(q)
    );
  }, [seriesList, librarySearch]);

  // Rendu du menu Popover ••• (Lecture, Mode examen, Télécharger, Supprimer)
  const renderThreeDotsMenu = (series: QuizSeriesSession) => {
    const isOpen = openDropdownSeriesId === series.id;
    return (
      <div className="relative shrink-0 flex items-center" data-dropdown-container={series.id}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdownSeriesId(isOpen ? null : series.id);
          }}
          title="Options de la série"
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl border border-transparent hover:border-border/80 hover:bg-secondary/90 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="craft-popover absolute right-0 top-9 w-48 sm:w-52 rounded-2xl p-1.5 z-50 select-none shadow-xl border border-border/80 bg-card/95 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => {
                setActiveSeriesId(series.id);
                setExamMode(false);
                setOpenDropdownSeriesId(null);
                setActiveStage("reading");
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-secondary/90 flex items-center gap-2.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Lecture</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSeriesId(series.id);
                setExamMode(true);
                setOpenDropdownSeriesId(null);
                setActiveStage("reading");
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/90 flex items-center gap-2.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Mode examen</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenDropdownSeriesId(null);
                handleDownloadSeriesPDF(series);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/90 flex items-center gap-2.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Télécharger en PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenDropdownSeriesId(null);
                handleDownloadSeries(series);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/90 flex items-center gap-2.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Télécharger (.txt)</span>
            </button>

            <div className="my-1 border-t border-border/80" />

            <button
              type="button"
              onClick={() => {
                setOpenDropdownSeriesId(null);
                if (seriesList.length <= 1) {
                  triggerToast("Conservez au moins une série dans la librairie.");
                  return;
                }
                const remaining = seriesList.filter((x) => x.id !== series.id);
                setSeriesList(remaining);
                if (activeSeriesId === series.id && remaining[0]) {
                  setActiveSeriesId(remaining[0].id);
                }
                triggerToast(`${series.displayTitle} supprimée.`);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Supprimer</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <style>{CONSTRUCTEUR_SCOPED_CSS}</style>

      {/* EN-TÊTE DU CONSTRUCTEUR DE QCM (SANS "VOIR LE COURS" NI SIDEBAR FACTICE) */}
      <header className="sticky top-0 z-20 bg-background/88 backdrop-blur-xl border-b border-border/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-semibold tracking-[-0.022em] text-foreground truncate">
              Constructeur de QCM
            </h1>
            <span className="text-muted-foreground/40 text-sm">/</span>
            <span className="text-xs font-medium text-muted-foreground truncate">
              {activeStage === "studio"
                ? "Studio"
                : activeStage === "library"
                ? "Librairie"
                : "Session de QCM"}
            </span>
          </div>

          {/* Commutateur 3 volets : Studio | Librairie | Série active */}
          <nav aria-label="Navigation Constructeur de QCM" className="inline-flex items-center p-1 rounded-xl bg-secondary/90 border border-border/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveStage("studio")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeStage === "studio"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStage("library")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeStage === "library"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Librairie</span>
              <span className="font-mono-metric text-[10px] px-1.5 py-0.2 rounded-md bg-background/90 text-foreground font-semibold">
                {seriesList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStage("reading")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeStage === "reading"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>{activeSeries?.displayTitle || "Lecture"}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* CORPS PRINCIPAL */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8">
        {/* ================================================================= */}
        {/* VOLET 1 : STUDIO DE CONFIGURATION (Zéro bouton "Voir le cours")   */}
        {/* ================================================================= */}
        {activeStage === "studio" && (
          <section className="max-w-3xl mx-auto">
            <div className="craft-surface rounded-2xl divide-y divide-border/80">
              {/* 1. Source : Importer ou Bibliothèque */}
              <div className="p-6 sm:p-7 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-semibold text-foreground">Support de cours</h2>
                    <p className="text-xs text-muted-foreground">
                      Importez un document local ou sélectionnez un cours de votre bibliothèque
                    </p>
                  </div>

                  <div className="inline-flex p-1 rounded-xl bg-secondary border border-border/80">
                    <button
                      type="button"
                      onClick={() => setSourceTab("import")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        sourceTab === "import"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Importer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTab("biblio")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        sourceTab === "biblio"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Bibliothèque
                    </button>
                  </div>
                </div>

                {sourceTab === "import" ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="group rounded-xl border border-dashed border-border hover:border-primary/50 bg-background/50 hover:bg-secondary/40 px-6 py-7 text-center cursor-pointer transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-2.5 text-foreground/80 group-hover:text-primary group-hover:scale-105 transition-all shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        Cliquez pour importer votre fichier de cours (PDF, DOCX, TXT)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Sélection immédiate du document pour la génération de vos QCM
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Ligne de recherche & commutateur de vue */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={biblioSearch}
                          onChange={(e) => setBiblioSearch(e.target.value)}
                          placeholder="Rechercher par titre, spécialité, mot-clé clinique..."
                          className="w-full h-10 pl-9 pr-9 rounded-xl bg-background/90 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 transition-colors shadow-2xs"
                        />
                        {biblioSearch && (
                          <button
                            type="button"
                            onClick={() => setBiblioSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Effacer la recherche"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <span className="font-mono-metric text-[11px] text-muted-foreground px-1">
                          {filteredLibraryCourses.length} cours
                        </span>

                        {/* Boutons Bascule Mosaïque / Liste */}
                        <div className="inline-flex rounded-xl border border-border bg-secondary/60 p-0.5">
                          <button
                            type="button"
                            onClick={() => setBiblioLayout("mosaic")}
                            className={`p-1.5 rounded-lg text-xs transition-all ${
                              biblioLayout === "mosaic"
                                ? "bg-card text-foreground shadow-2xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Vue Mosaïque (Cartes)"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBiblioLayout("list")}
                            className={`p-1.5 rounded-lg text-xs transition-all ${
                              biblioLayout === "list"
                                ? "bg-card text-foreground shadow-2xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Vue Liste (Haute densité)"
                          >
                            <List className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Filtres horizontaux par spécialité */}
                    {availableSubjects.length > 2 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                        {availableSubjects.map((subj) => {
                          const isSelected = selectedBiblioSubject === subj;
                          return (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setSelectedBiblioSubject(subj)}
                              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer border ${
                                isSelected
                                  ? "bg-foreground text-background border-foreground shadow-2xs font-semibold"
                                  : "bg-card/70 hover:bg-secondary border-border/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {subj}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Contenu : Mosaïque ou Liste */}
                    {filteredLibraryCourses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/40 space-y-2">
                        <BookOpen className="h-7 w-7 text-muted-foreground mx-auto stroke-1" />
                        <p className="text-xs font-semibold text-foreground">
                          Aucun cours ne correspond à « {biblioSearch} »
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Modifiez votre recherche ou importez un nouveau document via l'onglet « Importer »
                        </p>
                      </div>
                    ) : biblioLayout === "mosaic" ? (
                      /* Grille Mosaïque Haute Définition */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {filteredLibraryCourses.map((c) => {
                          const active = c.id === selectedCourse?.id;
                          const style = getSpecialtyBadgeStyle(c.subject);
                          const excerpt = getClinicalExcerpt(c.content);
                          const readingMin = Math.max(1, Math.round(c.wordCount / 200));

                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCourseId(c.id)}
                              className={`group relative rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left ${
                                active
                                  ? "bg-card border-foreground/60 shadow-md ring-2 ring-foreground/15"
                                  : "bg-card/80 border-border/90 hover:border-foreground/30 hover:shadow-xs hover:bg-card"
                              }`}
                            >
                              <div className="space-y-2">
                                {/* Ligne En-tête : Spécialité + Date */}
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${style.badgeClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor}`} />
                                    {c.subject || "Médecine"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono-metric">
                                    {c.updatedAt}
                                  </span>
                                </div>

                                {/* Titre du cours */}
                                <h3 className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
                                  {c.title}
                                </h3>

                                {/* Extrait clinique */}
                                <p className="text-[11px] text-muted-foreground/90 leading-relaxed line-clamp-2">
                                  {excerpt}
                                </p>
                              </div>

                              {/* Pied de carte : Volume de texte + Indicateur de sélection */}
                              <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground font-mono-metric">
                                  <span>{c.wordCount.toLocaleString("fr-FR")} mots</span>
                                  <span>•</span>
                                  <span>~{readingMin} min</span>
                                </div>

                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all ${
                                    active
                                      ? "bg-foreground text-background shadow-xs"
                                      : "bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-secondary/90"
                                  }`}
                                >
                                  {active ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Sélectionné
                                    </>
                                  ) : (
                                    "Choisir"
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Vue Liste Alignée Linear Style */
                      <div className="rounded-2xl border border-border/90 bg-card divide-y divide-border/70 max-h-[380px] overflow-y-auto">
                        {filteredLibraryCourses.map((c) => {
                          const active = c.id === selectedCourse?.id;
                          const style = getSpecialtyBadgeStyle(c.subject);
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCourseId(c.id)}
                              className={`p-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                active ? "bg-secondary/90" : "hover:bg-secondary/40"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                    active
                                      ? "border-foreground bg-foreground text-background"
                                      : "border-border text-transparent"
                                  }`}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-foreground truncate max-w-sm">
                                      {c.title}
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${style.badgeClass}`}
                                    >
                                      {c.subject || "Médecine"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {getClinicalExcerpt(c.content, 90)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-[10px] font-mono-metric text-muted-foreground hidden sm:inline">
                                  {c.wordCount} mots
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                    active
                                      ? "bg-foreground text-background border-foreground"
                                      : "border-border text-muted-foreground"
                                  }`}
                                >
                                  {active ? "Actif" : "Choisir"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Barre d'état exécutive du cours actif */}
                    {selectedCourse && (
                      <div className="mt-2.5 p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                              {selectedCourse.title}
                            </div>
                            <div className="text-[10.5px] text-muted-foreground flex items-center gap-2">
                              <span>{selectedCourse.subject || "Médecine"}</span>
                              <span>•</span>
                              <span className="font-mono-metric">
                                {selectedCourse.wordCount.toLocaleString("fr-FR")} mots
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="font-mono-metric text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                          ✓ Prêt pour l'épreuve QCM
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Approche docimologique */}
              <div className="p-6 sm:p-7 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Approche docimologique</h2>
                  <span className="text-[11px] text-muted-foreground">
                    Couverture intégrale de la leçon • Loi d'Équisme
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStyle("professeurs")}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedStyle === "professeurs"
                        ? "border-foreground bg-secondary/45"
                        : "border-border bg-background/40 hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        Style des Professeurs (Expert)
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedStyle === "professeurs" ? "bg-primary" : "bg-border"
                        }`}
                      />
                    </div>
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Calqué sur les exigences des annales de la faculté : seuils biologiques précis, pièges cliniques et restrictions.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStyle("ia_progressif")}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedStyle === "ia_progressif"
                        ? "border-foreground bg-secondary/45"
                        : "border-border bg-background/40 hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        Progression graduelle
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedStyle === "ia_progressif" ? "bg-primary" : "bg-border"
                        }`}
                      />
                    </div>
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Balaye méthodiquement chaque chapitre du cours avec une montée progressive de la sélectivité clinique.
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Formats de QCM */}
              <div className="p-6 sm:p-7 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Format des questions</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedFormats(QCM_FORMAT_CATALOG.map((f) => f.id))}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Activer les 6 formats
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {QCM_FORMAT_CATALOG.map((f) => {
                    const checked = selectedFormats.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleToggleFormat(f.id)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          checked
                            ? "border-foreground bg-secondary/45"
                            : "border-border bg-background/40 hover:bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-foreground">{f.name}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              checked ? "bg-primary" : "bg-border"
                            }`}
                          />
                        </div>
                        <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                          {f.rule}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Quantité & Lancement */}
              <div className="px-6 sm:px-7 py-4 bg-secondary/35 rounded-b-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-foreground">Nombre de QCM :</span>
                    <div className="inline-flex items-center h-8 rounded-lg bg-card border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQuestionCount((c) => Math.max(5, c - 5))}
                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary text-xs font-mono-metric"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={questionCount}
                        onChange={(e) =>
                          setQuestionCount(Math.max(5, Math.min(50, Number(e.target.value) || 10)))
                        }
                        className="w-10 h-full text-center bg-transparent font-mono-metric text-xs font-semibold text-foreground focus:outline-none border-x border-border/60"
                      />
                      <button
                        type="button"
                        onClick={() => setQuestionCount((c) => Math.min(50, c + 5))}
                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary text-xs font-mono-metric"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={infiniteMode}
                      onChange={(e) => setInfiniteMode(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-0"
                    />
                    <span>Mode infini</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateSeries}
                  className="h-9 px-4 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
                >
                  <span>{isGenerating ? "Génération en cours..." : "Générer la série"}</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* VOLET 2 : LIBRAIRIE DE QCM (Mosaïque / Alignement + Menu •••)     */}
        {/* ================================================================= */}
        {activeStage === "library" && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Filtrer vos séries par cours ou date..."
                  className="w-full h-9 px-3.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center p-1 rounded-xl bg-secondary border border-border/80">
                  <button
                    type="button"
                    onClick={() => setLibraryViewMode("mosaic")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      libraryViewMode === "mosaic"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Mosaïque
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryViewMode("alignment")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      libraryViewMode === "alignment"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Alignement
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStage("studio")}
                  className="h-9 px-3.5 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  + Nouvelle série
                </button>
              </div>
            </div>

            {libraryViewMode === "mosaic" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSeries.map((s) => {
                  const st = computeSeriesStats(s);
                  const menuOpen = openDropdownSeriesId === s.id;
                  return (
                    <article
                      key={s.id}
                      onClick={() => {
                        setActiveSeriesId(s.id);
                        setExamMode(false);
                        setActiveStage("reading");
                      }}
                      className={`group craft-surface craft-card-interactive rounded-2xl p-5 flex flex-col justify-between gap-5 cursor-pointer relative ${
                        menuOpen ? "z-30" : "z-10"
                      }`}
                    >
                      <div className="space-y-3 min-w-0 w-full">
                        <div className="flex items-center justify-between gap-2 w-full min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span
                              className="inline-flex items-center font-mono-metric text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-secondary text-foreground border border-border/80 whitespace-nowrap truncate max-w-[140px] sm:max-w-[170px] shrink-0"
                              title={s.displayTitle}
                            >
                              {s.displayTitle}
                            </span>
                            <span
                              className="inline-flex items-center font-mono-metric text-[10.5px] text-muted-foreground whitespace-nowrap shrink-0"
                              title={s.createdAt}
                            >
                              {formatSeriesDate(s.createdAt)}
                            </span>
                          </div>
                          <div className="shrink-0 flex items-center -mr-1">
                            {renderThreeDotsMenu(s)}
                          </div>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <h3 className="text-[14.5px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                            {s.courseRootTitle}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {s.questions.length} questions docimologiques
                          </p>
                        </div>
                      </div>

                      {/* Piste segmentée question par question (Zéro symbole V/X rudimentaire) */}
                      <div className="space-y-2.5 pt-3.5 border-t border-border/60">
                        <div className="grid grid-flow-col auto-cols-fr gap-1 w-full h-1.5">
                          {s.questions.map((q, qIdx) => {
                            const a = s.userAnswers?.[q.id];
                            let cls = "bg-secondary border border-border/60";
                            if (a?.validated) {
                              cls = a.isCorrect ? "bg-emerald-500" : "bg-rose-500";
                            } else if (a?.picked) {
                              cls = "bg-primary/60";
                            }
                            return (
                              <span
                                key={q.id || qIdx}
                                className={`rounded-full transition-all duration-300 ${cls}`}
                              />
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="font-medium text-foreground">{st.found}</span>
                              <span>trouvée{st.found > 1 ? "s" : ""}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span className="font-medium text-foreground">{st.missed}</span>
                              <span>faussée{st.missed > 1 ? "s" : ""}</span>
                            </span>
                          </div>
                          <span className="font-mono-metric text-[10.5px] text-muted-foreground group-hover:text-primary transition-colors">
                            {st.answered}/{st.total} →
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="craft-surface rounded-2xl divide-y divide-border/80">
                {filteredSeries.map((s) => {
                  const st = computeSeriesStats(s);
                  const menuOpen = openDropdownSeriesId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSeriesId(s.id);
                        setExamMode(false);
                        setActiveStage("reading");
                      }}
                      className={`group px-5 py-4 flex items-center justify-between gap-4 hover:bg-secondary/35 transition-colors cursor-pointer relative ${
                        menuOpen ? "z-30" : "z-10"
                      } first:rounded-t-2xl last:rounded-b-2xl`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-secondary border border-border/80 font-mono-metric text-xs font-semibold text-foreground flex items-center justify-center shrink-0">
                          S{s.seriesNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[200px] sm:max-w-md">
                              {s.courseRootTitle}
                            </span>
                            <span className="inline-flex items-center font-mono-metric text-[11px] px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border/70 whitespace-nowrap truncate max-w-[140px] shrink-0" title={s.displayTitle}>
                              {s.displayTitle}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 font-mono-metric">
                            <span className="inline-flex items-center whitespace-nowrap">{formatSeriesDate(s.createdAt)}</span>
                            <span>•</span>
                            <span className="font-sans whitespace-nowrap">{s.questions.length} questions</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 shrink-0">
                        <div className="hidden sm:flex flex-col items-end gap-1.5 w-36">
                          <div className="flex items-center justify-between w-full text-[10.5px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <strong className="text-foreground font-mono-metric">{st.found}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <strong className="text-foreground font-mono-metric">{st.missed}</strong>
                            </span>
                            <span className="font-mono-metric">
                              {st.answered}/{st.total}
                            </span>
                          </div>
                          <div className="grid grid-flow-col auto-cols-fr gap-1 w-full h-1.5">
                            {s.questions.map((q, qIdx) => {
                              const a = s.userAnswers?.[q.id];
                              let cls = "bg-secondary border border-border/60";
                              if (a?.validated) {
                                cls = a.isCorrect ? "bg-emerald-500" : "bg-rose-500";
                              } else if (a?.picked) {
                                cls = "bg-primary/60";
                              }
                              return <span key={q.id || qIdx} className={`rounded-full ${cls}`} />;
                            })}
                          </div>
                        </div>

                        {renderThreeDotsMenu(s)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* VOLET 3 : LECTURE EN DÉFILEMENT (Zéro bouton "Voir le cours")     */}
        {/* ================================================================= */}
        {activeStage === "reading" && activeSeries && (
          <section className="space-y-5 max-w-3xl mx-auto relative">
            <div className="craft-surface rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center font-mono-metric text-xs font-semibold text-foreground shrink-0">
                  S{activeSeries.seriesNumber}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[15px] sm:text-base font-semibold text-foreground truncate">
                      {activeSeries.courseRootTitle}
                    </h2>
                    <span
                      className={`font-mono-metric text-[10px] px-2 py-0.5 rounded-md font-medium ${
                        examMode
                          ? "bg-primary/15 text-primary font-semibold"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {examMode ? "Mode examen" : "Lecture"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono-metric">
                    <span>{activeSeries.displayTitle}</span>
                    <span>•</span>
                    <span>{formatSeriesDate(activeSeries.createdAt)}</span>
                    <span>•</span>
                    <span>{activeSeries.questions.length} questions</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExamMode((m) => !m)}
                className="h-8 px-3.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors"
              >
                {examMode ? "Passer en mode Lecture" : "Activer le Mode examen"}
              </button>
            </div>

            <div className="space-y-4">
              {activeSeries.questions.map((q, idx) => {
                const nextQ = activeSeries.questions[idx + 1];
                const ans = activeSeries.userAnswers?.[q.id] || {
                  picked: null,
                  validated: false,
                  isCorrect: false,
                };

                return (
                  <article
                    key={q.id}
                    id={`card-${q.id}`}
                    className="craft-surface rounded-2xl p-6 sm:p-7 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-4 border-b border-border/70">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-metric text-xs font-semibold text-foreground">
                          Question {idx + 1}{" "}
                          <span className="text-muted-foreground font-normal">
                            / {activeSeries.questions.length}
                          </span>
                        </span>
                        {q.conceptTag && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="text-xs text-muted-foreground">{q.conceptTag}</span>
                          </>
                        )}
                      </div>

                      {ans.validated ? (
                        ans.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Réponse trouvée</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Réponse faussée</span>
                          </span>
                        )
                      ) : ans.picked ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>Proposition {ans.picked} retenue</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-border" />
                          <span>En attente</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-[15px] sm:text-[16px] font-medium text-foreground leading-relaxed mb-4">
                      {q.stem}
                    </h3>

                    <div className="space-y-2.5">
                      {q.options.map((opt) => {
                        const isPicked = ans.picked === opt.letter;
                        let rowClass = "qcm-option-card border-border/85 bg-background/45";
                        let badgeClass = "border-border bg-card text-foreground";

                        if (!ans.validated && isPicked) {
                          rowClass = "qcm-option-card qcm-option-picked";
                          badgeClass = "border-primary bg-primary text-primary-foreground";
                        } else if (ans.validated) {
                          if (opt.letter === q.correctLetter) {
                            rowClass = "qcm-option-card qcm-option-locked qcm-option-correct";
                            badgeClass = "border-emerald-600 bg-emerald-600 text-white";
                          } else if (isPicked && !ans.isCorrect) {
                            rowClass = "qcm-option-card qcm-option-locked qcm-option-wrong";
                            badgeClass = "border-rose-600 bg-rose-600 text-white";
                          } else {
                            rowClass =
                              "qcm-option-card qcm-option-locked border-border/50 bg-background/20 opacity-70";
                          }
                        }

                        return (
                          <button
                            key={opt.letter}
                            type="button"
                            onClick={() => handlePickOption(q.id, opt.letter)}
                            className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3.5 ${rowClass}`}
                          >
                            <span
                              className={`w-7 h-7 rounded-lg border font-mono-metric text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5 transition-colors ${badgeClass}`}
                            >
                              {opt.letter}
                            </span>
                            <span className="text-[13.5px] text-foreground leading-relaxed">
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {ans.validated && (
                      <div
                        className={`mt-4 p-4 rounded-xl border space-y-1.5 ${
                          ans.isCorrect
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-rose-500/30 bg-rose-500/5"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between text-xs font-semibold ${
                            ans.isCorrect
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          <span>
                            {ans.isCorrect
                              ? `Proposition exacte (${q.correctLetter})`
                              : `Correction — La proposition exacte est ${q.correctLetter}`}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          {q.globalExplanation}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {!examMode ? (
                          <>
                            <button
                              type="button"
                              disabled={!ans.picked || ans.validated}
                              onClick={() => handleValidateQuestion(q)}
                              className={`h-8 px-4 rounded-xl text-xs font-medium transition-all ${
                                ans.validated
                                  ? "bg-secondary text-foreground cursor-default"
                                  : ans.picked
                                  ? "bg-primary text-primary-foreground hover:opacity-95 shadow-sm"
                                  : "bg-secondary text-muted-foreground opacity-60 cursor-not-allowed"
                              }`}
                            >
                              {ans.validated ? "Réponse validée" : "Valider ma réponse"}
                            </button>
                            {ans.validated && !ans.isCorrect && (
                              <button
                                type="button"
                                onClick={() => handleRetryQuestion(q.id)}
                                className="h-8 px-3 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Corriger ma réponse
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Mode examen : validation en fin de série
                          </span>
                        )}
                      </div>

                      <div>
                        {nextQ ? (
                          <button
                            type="button"
                            onClick={() => {
                              document
                                .getElementById(`card-${nextQ.id}`)
                                ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            className="h-8 px-3.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors"
                          >
                            Suivant ↓
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleFinishSeries}
                            className="h-8 px-4 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90"
                          >
                            Terminer →
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="craft-surface rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">
                  Poursuivre en Mode Infini
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  Génère de nouvelles questions sur l'ensemble du cours sans suite monotone.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleAppendInfiniteQuestions}
                  className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors"
                >
                  + 5 questions
                </button>
                <button
                  type="button"
                  onClick={handleFinishSeries}
                  className="h-9 px-4 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Terminer la série
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* =================================================================== */}
      {/* WIDGET FLÈCHE RÉTRACTABLE TEMPS RÉEL (‹) & MATRICE D'AVANCEMENT     */}
      {/* =================================================================== */}
      {activeStage === "reading" && activeSeries && (
        <div
          ref={widgetRootRef}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 select-none"
        >
          {!widgetExpanded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWidgetExpanded(true);
              }}
              title="Ouvrir la jauge d'avancement et la matrice des QCM"
              className="glass-arrow-tab rounded-l-2xl py-3.5 pl-2.5 pr-2 flex flex-col items-center gap-2.5 cursor-pointer group"
            >
              <span className="w-6 h-6 rounded-full bg-secondary group-hover:bg-primary group-hover:text-primary-foreground text-foreground flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </span>

              <div className="w-1.5 h-16 flex flex-col gap-[2px] justify-between">
                {activeSeries.questions.map((q, i) => {
                  const a = activeSeries.userAnswers?.[q.id];
                  let c = "bg-border";
                  if (a?.validated) c = a.isCorrect ? "bg-emerald-500" : "bg-rose-500";
                  else if (a?.picked) c = "bg-primary";
                  return <span key={q.id || i} className={`w-full flex-1 rounded-full ${c}`} />;
                })}
              </div>

              <div className="flex flex-col items-center font-mono-metric text-[10px] leading-tight gap-1 pt-0.5">
                <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{activeStats.found}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{activeStats.missed}</span>
                </span>
              </div>
            </button>
          ) : (
            <aside
              onClick={(e) => e.stopPropagation()}
              className="glass-expanded-drawer w-80 rounded-l-2xl p-4 sm:p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Progression de la session
                  </div>
                  <div className="text-[11px] font-mono-metric text-muted-foreground">
                    {activeSeries.displayTitle} • {activeStats.total} questions
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWidgetExpanded(false)}
                  title="Replier"
                  className="w-7 h-7 rounded-lg bg-secondary/80 hover:bg-secondary text-foreground flex items-center justify-center transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-foreground">Jauge d'avancement</span>
                  <span className="font-mono-metric font-semibold text-foreground">
                    {activeStats.answered} sur {activeStats.total} ({activeStats.pct}%)
                  </span>
                </div>

                <div className="grid grid-flow-col auto-cols-fr gap-1 h-2">
                  {activeSeries.questions.map((q, i) => {
                    const a = activeSeries.userAnswers?.[q.id];
                    let c = "bg-secondary border border-border/60";
                    if (a?.validated) c = a.isCorrect ? "bg-emerald-500" : "bg-rose-500";
                    else if (a?.picked) c = "bg-primary/60";
                    return <span key={q.id || i} className={`h-full rounded-full ${c}`} />;
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 flex flex-col">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Trouvées</span>
                    </span>
                    <strong className="font-mono-metric text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {activeStats.found}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/8 border border-rose-500/20 flex flex-col">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Faussées</span>
                    </span>
                    <strong className="font-mono-metric text-sm font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                      {activeStats.missed}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-secondary/70 border border-border/80 flex flex-col">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      <span>Restantes</span>
                    </span>
                    <strong className="font-mono-metric text-sm font-semibold text-foreground mt-0.5">
                      {Math.max(0, activeStats.total - activeStats.answered)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10.5px] font-medium text-muted-foreground flex items-center justify-between">
                  <span>Accès direct aux questions</span>
                  <span className="font-mono-metric text-[10px]">1 → N</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {activeSeries.questions.map((q, idx) => {
                    const a = activeSeries.userAnswers?.[q.id];
                    let tileCls =
                      "bg-secondary/80 text-foreground hover:bg-secondary border-border/80";
                    if (a?.validated) {
                      tileCls = a.isCorrect
                        ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                        : "bg-rose-600 text-white border-rose-600 font-semibold";
                    } else if (a?.picked) {
                      tileCls = "bg-primary/15 text-primary border-primary/40 font-semibold";
                    }
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setWidgetExpanded(false);
                          document
                            .getElementById(`card-${q.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`h-8 rounded-lg border font-mono-metric text-xs flex items-center justify-center transition-all ${tileCls}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-foreground text-background text-xs font-medium shadow-xl border border-border/20">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ConstructeurQCM;

export { ConstructeurQCM as QuizWorkspace, ConstructeurQCM as QuizBuilder, ConstructeurQCM as QuizConstructor };
