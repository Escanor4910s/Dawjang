// src/lib/examenBlancEngine.ts
// ============================================================================
// MOTEUR EXAMEN BLANC UNIVERSEL (FMPOS / UCAD) — AUCUN BIAIS DE MATIÈRE
// ----------------------------------------------------------------------------
//  1. Lecture & isolation de la matière dans des annales multi-EC
//  2. Segmentation ligne par ligne : cas cliniques (avec transitions) vs QCM isolés
//  3. Détection du format réel de chaque question (élection, censure, groupage,
//     jumelage, association, complément multiple, QNS) — un cas clinique reste un
//     cas clinique quelle que soit la forme de ses questions internes
//  4. Correspondance leçon <-> examen basée UNIQUEMENT sur l'énoncé (vignette,
//     transitions, intitulés de questions) : une leçon présente seulement dans
//     une proposition (distracteur) n'est PAS "sortie"
//  5. Statistiques : % de sortie, nombre de sorties, examens, QCM, quota moyen
//  6. Génération (rédacteur) + relecture croisée (relecteur) + adjudication
// ============================================================================

import { callDawiaEngineRaw } from "@/lib/dawiaQcmEngine";
import { repairAndParseQuizJson } from "@/lib/jsonRepair";

// ----------------------------------------------------------------------------
// 1. TYPES
// ----------------------------------------------------------------------------

export type EBLetter = "A" | "B" | "C" | "D" | "E";
export const EB_LETTERS: EBLetter[] = ["A", "B", "C", "D", "E"];

export type EBFormat =
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "COMPLEMENT_MULTIPLE"
  | "ASSOCIATION"
  | "JUMELAGE"
  | "QNS";

export type EBBlockKind = "CAS_CLINIQUE" | "ISOLE";

export const EB_FORMAT_LABELS: Record<EBFormat | "CAS_CLINIQUE", string> = {
  CAS_CLINIQUE: "Cas clinique",
  ELECTION: "Élection",
  CENSURE: "Censure",
  GROUPAGE: "Groupage",
  COMPLEMENT_MULTIPLE: "Complément multiple",
  ASSOCIATION: "Association",
  JUMELAGE: "Jumelage",
  QNS: "QNS",
};

export interface EBOption {
  letter: EBLetter;
  text: string;
}

export interface EBItem {
  id: string;
  number: number;
  format: EBFormat;
  /** Phrase de transition clinique placée avant la question (cas cliniques à rebondissements). */
  lead?: string;
  stem: string;
  /** Assertions numérotées (groupage : 1..n) ou [assertion 1, assertion 2] (jumelage). */
  statements?: string[];
  options: EBOption[];
  correct: EBLetter[];
  explanation?: string;
}

export interface EBBlock {
  id: string;
  kind: EBBlockKind;
  header?: string;
  vignette?: string;
  lessonIds: string[];
  /** Attribution déduite uniquement des propositions (moins fiable). */
  weakAttribution?: boolean;
  items: EBItem[];
}

export interface EBLesson {
  id: string;
  title: string;
  cleanTitle: string;
  content: string;
  wordCount: number;
  sizeLabel: string;
  /** Présence du nom de la matière dans le cours (0..1) — indicatif. */
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

export interface ExamAnalysis {
  examId: string;
  title: string;
  year: string;
  /** La matière cible a pu être isolée par titre/section. */
  isolated: boolean;
  /** Vérifié/corrigé par l'audit IA approfondi. */
  audited: boolean;
  questionCount: number;
  blockCount: number;
  caseCount: number;
  durationMin?: number;
  formatCounts: Partial<Record<EBFormat | "CAS_CLINIQUE", number>>;
  lessonsUsed: string[];
  blocks: EBBlock[];
}

export interface LessonStat {
  lessonId: string;
  title: string;
  examsAppeared: number;
  totalExams: number;
  percent: number;
  timesOut: number;
  totalQcm: number;
  perExam: { examId: string; examTitle: string; year: string; blocks: number; qcm: number; weak: boolean }[];
}

export interface BlueprintBlock {
  kind: EBBlockKind;
  formats: EBFormat[];
}

export interface StyleDna {
  samples: { label: string; text: string }[];
  avgOptionWords: number;
  avgVignetteChars: number;
  avgItemsPerCase: number;
  optionsEndWithPeriod: boolean;
  optionsCapitalized: boolean;
  groupageTemplate?: string[];
  jumelageTemplate?: string[];
  stemExamples: string[];
}

export interface CorpusAnalysis {
  createdAt: string;
  subjectName: string;
  exams: ExamAnalysis[];
  lessonStats: LessonStat[];
  maxQcm: number;
  avgQcm: number;
  quota: number;
  avgLessonsPerExam: number;
  formatDistribution: Partial<Record<EBFormat | "CAS_CLINIQUE", number>>;
  blueprint: BlueprintBlock[];
  referenceExamId?: string;
  durationMin?: number;
  style: StyleDna;
  warnings: string[];
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
  score?: { found: number; wrong: number; total: number };
}

// ----------------------------------------------------------------------------
// 2. OUTILS TEXTE
// ----------------------------------------------------------------------------

const STOP = new Set(
  (
    "le la les un une des du de d l et ou au aux en dans par pour sur sous avec sans que qui quoi dont est sont etre ete " +
    "a ont avoir pas plus moins tres tout tous toute toutes ce cet cette ces se sa son ses leur leurs il elle ils elles on " +
    "nous vous je tu ne ni mais donc car si comme entre chez vers lors apres avant depuis pendant selon cas peut peuvent " +
    "doit doivent fait faire etc patient patiente parmi propositions proposition suivantes suivant suivants suivante exacte " +
    "exactes fausse fausses faux vrai vraies lequel laquelle lesquels lesquelles quelle quel quels quelles ainsi aussi alors " +
    "encore bien tant ceux celle celui age ans type taux jour jours mois fois deux trois quatre cinq plusieurs seul seule " +
    "ainsi cela ceci peut etre notamment souvent toujours jamais aucun aucune autre autres meme memes donne donnee donnees " +
    "cours chapitre diapositive page figure tableau"
  ).split(" ")
);

const GENERIC_TITLE = new Set(
  "diagnostic prise charge generalites generalite introduction cours chapitre notions notion principes principe " +
    "pratique clinique medecine pdf pptx docx".split(" ")
);

export function normalizeText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stemToken(w: string): string {
  let t = w;
  if (t.length > 4 && /[sx]$/.test(t)) t = t.slice(0, -1);
  if (t.length > 9) t = t.slice(0, 9);
  return t;
}

function significantTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of normalizeText(text).split(" ")) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.push(stemToken(w));
  }
  return out;
}

/** Ensemble de unigrammes + bigrammes (jetons adjacents significatifs). */
function buildTermSet(text: string): Set<string> {
  const toks = significantTokens(text);
  const set = new Set<string>(toks);
  for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]} ${toks[i + 1]}`);
  return set;
}

function splitSentences(t: string): string[] {
  return t
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([.!?])\s+(?=[A-ZÀ-Ý«"(])/g, "$1\u0001")
    .split("\u0001")
    .filter(Boolean);
}

export function cleanLessonTitle(rawTitle: string): string {
  let t = String(rawTitle || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[\s\d_.\-–]+/, "")
    .replace(/\b(20[12]\d|19\d\d)\b/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!t) t = String(rawTitle || "Leçon");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

export function sizeLabelOf(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

// ----------------------------------------------------------------------------
// 3. PRÉPARATION DES COURS (doublons, pertinence, profils de leçons)
// ----------------------------------------------------------------------------

export function subjectTokens(subjectName: string): string[] {
  const generic = new Set(["clinique", "generale", "general", "sciences", "medecine", "unite", "enseignement"]);
  return normalizeText(subjectName)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP.has(w) && !generic.has(w))
    .map(stemToken);
}

export function buildLesson(id: string, title: string, content: string, bytes: number, subjectName: string): EBLesson {
  const clean = cleanLessonTitle(title);
  const words = content.split(/\s+/).filter(Boolean).length;
  const st = subjectTokens(subjectName);
  let relevance = 0;
  if (st.length > 0) {
    const set = new Set(significantTokens(`${title} ${content.slice(0, 6000)}`));
    relevance = st.filter((t) => set.has(t)).length / st.length;
  }
  return { id, title, cleanTitle: clean, content, wordCount: words, sizeLabel: sizeLabelOf(bytes), relevance };
}

export function flagDuplicateLessons(lessons: EBLesson[]): EBLesson[] {
  const seenTitle = new Map<string, string>();
  const seenHead = new Map<string, string>();
  return lessons.map((l) => {
    const keyT = normalizeText(l.cleanTitle);
    const keyH = normalizeText(l.content.slice(0, 400)) + "|" + Math.round(l.content.length / 50);
    const dupT = seenTitle.get(keyT);
    const dupH = seenHead.get(keyH);
    if (dupT || dupH) return { ...l, duplicateOf: dupT || dupH };
    seenTitle.set(keyT, l.id);
    seenHead.set(keyH, l.id);
    const { duplicateOf, ...rest } = l;
    return rest as EBLesson;
  });
}

interface LessonProfile {
  id: string;
  title: string;
  titleStems: string[];
  terms: Map<string, number>;
  norm: number;
}

function buildProfiles(lessons: EBLesson[]): LessonProfile[] {
  const N = Math.max(1, lessons.length);
  const counts: Map<string, number>[] = lessons.map((l) => {
    const toks = significantTokens(l.content);
    const m = new Map<string, number>();
    for (let i = 0; i < toks.length; i++) {
      m.set(toks[i], (m.get(toks[i]) || 0) + 1);
      if (i < toks.length - 1) {
        const bg = `${toks[i]} ${toks[i + 1]}`;
        m.set(bg, (m.get(bg) || 0) + 1);
      }
    }
    return m;
  });
  const df = new Map<string, number>();
  counts.forEach((m) => m.forEach((_v, k) => df.set(k, (df.get(k) || 0) + 1)));

  return lessons.map((l, idx) => {
    const titleStems = Array.from(
      new Set(
        normalizeText(l.cleanTitle)
          .split(" ")
          .filter((w) => w.length >= 3 && !STOP.has(w) && !GENERIC_TITLE.has(w))
          .map(stemToken)
      )
    );
    const scored: [string, number][] = [];
    counts[idx].forEach((tf, term) => {
      if (tf < 2 && !titleStems.includes(term)) return;
      const idf = Math.log(1 + N / (df.get(term) || 1));
      let w = (1 + Math.log(tf)) * idf;
      if (titleStems.includes(term)) w *= 2;
      scored.push([term, w]);
    });
    scored.sort((a, b) => b[1] - a[1]);
    const top = scored.slice(0, 70);
    const terms = new Map<string, number>(top);
    titleStems.forEach((t) => {
      if (!terms.has(t)) terms.set(t, 1);
    });
    const norm = Math.max(
      1,
      top
        .slice(0, 15)
        .reduce((s, [, w]) => s + w, 0)
    );
    return { id: l.id, title: l.cleanTitle, titleStems, terms, norm };
  });
}

// ----------------------------------------------------------------------------
// 4. ISOLATION DE LA MATIÈRE DANS UNE ANNALE MULTI-EC
// ----------------------------------------------------------------------------

export function isolateSubjectSection(text: string, subjectName: string): { text: string; isolated: boolean } {
  const st = subjectTokens(subjectName);
  const lines = text.replace(/\r/g, "").split("\n");
  if (st.length === 0) return { text, isolated: false };

  const isHeading = (l: string): boolean => {
    const t = l.trim();
    if (!t || t.length > 110) return false;
    if (/cas clinique|dossier|observation|question|qcm|^[A-Ea-e]\s*[-.):]/i.test(t)) return false;
    if (/^\s*(EC|E\.C\.|UE|U\.E\.|Mati[eè]re|[ÉE]preuve|Module|Partie|Sujet|Discipline)\b\s*[:.\-n°]*\s*\d*/i.test(t)) return true;
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
    return letters.length >= 6 && letters === letters.toUpperCase();
  };
  const mentions = (l: string): boolean => {
    const set = new Set(significantTokens(l));
    return st.some((t) => set.has(t));
  };

  const kept: string[] = [];
  let active = false;
  let foundHeading = false;
  for (const l of lines) {
    if (isHeading(l)) {
      if (mentions(l)) {
        active = true;
        foundHeading = true;
      } else if (active) {
        active = false;
      }
    }
    if (active) kept.push(l);
  }
  if (foundHeading && kept.join("\n").length > 300) return { text: kept.join("\n"), isolated: true };
  return { text, isolated: false };
}

// ----------------------------------------------------------------------------
// 5. SEGMENTATION DES ÉPREUVES (cas cliniques / QCM isolés)
// ----------------------------------------------------------------------------

const OPT_RE = /^\s*\(?([A-Ea-e])\s*[-–—.):]\s*(\S.*)$/;
const Q_RE = /^\s*(?:(?:QCM|Question|Q|N°|No)\s*)?(\d{1,3})\s*[-–—.):]\s*(\S.*)?$/i;
const STATEMENT_RE = /^\s*\(?([1-6])\s*[-–—.):]\s*(\S.*)$/;

const NEW_CASE_START =
  /^(?:cas clinique|dossier|observation|un patient|une patiente|un enfant|une enfant|une femme|un homme|un nourrisson|un adolescent|une adolescente|une jeune|un jeune|un sujet|mme|mlle|madame|monsieur|m\.|mr|patient(?:e)? de|nouveau cas)/i;
const CONT_STEM =
  /\b(ce patient|cette patiente|ce malade|cette malade|ce cas|chez (?:ce|cette|le|la) (?:patient|patiente|malade|enfant)|ce tableau|cette situation|cet enfant|cette observation|ces r[ée]sultats|ces donn[ée]es|devant ce|chez lui|chez elle|notre patient|notre malade|ce bilan)\b/i;
const TRANSITION_START =
  /^(?:à|a|après|apres|au cours|l['’]évolution|évolution|evolution|quelques|deux|trois|\d+\s*(?:jours?|heures?|semaines?|mois|ans|h)\b|le lendemain|le surlendemain|par la suite|finalement|le bilan|les résultats|l['’]examen|devant|malgré|sous traitement|suite à|suite a|un (?:mois|an)|plusieurs|transition|rebondissement)/i;

interface RawQuestion {
  seq: number;
  origNumber: number;
  stemLines: string[];
  options: { letter: EBLetter; text: string }[];
  trailing: string[];
}

function detectFormat(stem: string, statements: string[] | undefined, options: EBOption[]): EBFormat {
  const s = stem.toLowerCase();
  const optTexts = options.map((o) => o.text.toLowerCase());
  if (options.length < 2) return "QNS";

  // GROUPAGE : codes de combinaison (1,2,3 / 1 et 3 / ... / autre combinaison)
  const comboOpts = optTexts.filter((t) => /(?:^|\D)[1-6](?:\s*(?:,|et|-|&)\s*[1-6])*\D*(?:sont|est)?\s*(?:exacte|exactes|vraie|vraies|juste|justes|correcte|correctes)?/.test(t) && /[1-6]/.test(t));
  const hasAutre = optTexts.some((t) => /autre\s+combinaison|toute\s+autre|aucune\s+de\s+ces\s+combinaisons/.test(t));
  const numericHeavy = optTexts.filter((t) => t.replace(/[^a-zà-ÿ]/g, "").length < 45 && /[1-6]/.test(t)).length;
  if (hasAutre || (statements && statements.length >= 3 && numericHeavy >= 3 && comboOpts.length >= 3)) return "GROUPAGE";

  // JUMELAGE : "parce que" + codes de cause à effet
  if (/parce\s+que/.test(s) || optTexts.some((t) => /relation\s+(?:de\s+)?caus|cause\s+(?:à|a)\s+effet|lien\s+causal/.test(t)))
    return "JUMELAGE";

  // ASSOCIATION : appariement 1-A, 2-C ...
  if (optTexts.filter((t) => (t.match(/[1-5]\s*[-–=→:]\s*[a-e]\b/g) || []).length >= 3).length >= 2) return "ASSOCIATION";
  if (/\b(associez|apparier|appariez|relier|reliez|faire correspondre|correspondance)\b/.test(s) && statements && statements.length >= 3)
    return "ASSOCIATION";

  const negation =
    /\b(sauf|inexacte|inexactes|incorrecte|incorrectes|fausse|fausses|faux|ne\s+(?:doit|doivent|peut|peuvent|fait|font|correspond|correspondent|constitue|constituent|figure)\s+pas|n['’]est\s+pas|n['’]est\s+pas|ne\s+(?:fait|font)\s+pas\s+partie|sauf\s+une)\b/.test(
      s
    );
  const plural =
    /\b(lesquel(?:le)?s|quelles?\s+(?:sont|peuvent|doivent)|cochez|une\s+ou\s+plusieurs|plusieurs\s+r[ée]ponses|r[ée]ponses?\s+exactes|propositions\s+exactes\s+sont|choix\s+multiples?|combien)\b/.test(
      s
    );
  const single = /\b(lequel|laquelle|une\s+seule|un\s+seul|quel\s+est|quelle\s+est|quel\s+examen|quelle\s+attitude)\b/.test(s);

  if (negation && plural && !single) return "COMPLEMENT_MULTIPLE";
  if (negation) return "CENSURE";
  if (plural && !single) return "COMPLEMENT_MULTIPLE";
  return "ELECTION";
}

function parseQuestions(text: string): { questions: RawQuestion[]; preamble: string[] } {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, ""));
  const optionLineCount = lines.filter((l) => OPT_RE.test(l)).length;
  const qnsMode = optionLineCount < 3;

  const questions: RawQuestion[] = [];
  const preamble: string[] = [];
  let cur: RawQuestion | null = null;
  let prevBlank = false;

  const nextLetter = (c: RawQuestion): EBLetter | null => {
    const idx = c.options.length;
    return idx < 5 ? EB_LETTERS[idx] : null;
  };

  for (const line of lines) {
    const isBlank = line.trim() === "";
    if (isBlank) {
      prevBlank = true;
      continue;
    }

    // Option suivante attendue ?
    if (cur) {
      const om = OPT_RE.exec(line);
      if (om) {
        const letter = om[1].toUpperCase() as EBLetter;
        if (letter === nextLetter(cur)) {
          cur.options.push({ letter, text: om[2].trim() });
          prevBlank = false;
          continue;
        }
      }
    }

    // Nouvelle question ?
    const qm = Q_RE.exec(line);
    if (qm) {
      const num = parseInt(qm[1], 10);
      const okSequence = !cur || num === cur.origNumber + 1 || num === 1;
      const curDone = !cur || cur.options.length >= 2 || (qnsMode && cur.stemLines.length > 0);
      if (okSequence && curDone) {
        cur = {
          seq: questions.length + 1,
          origNumber: num,
          stemLines: qm[2] ? [qm[2].trim()] : [],
          options: [],
          trailing: [],
        };
        questions.push(cur);
        prevBlank = false;
        continue;
      }
    }

    if (!cur) {
      preamble.push(line.trim());
      prevBlank = false;
      continue;
    }

    if (cur.options.length === 0) {
      cur.stemLines.push(line.trim());
    } else {
      const last = cur.options[cur.options.length - 1];
      const complete = cur.options.length >= 5 || (cur.options.length >= 2 && last.letter === "E");
      const prevEndsSentence = /[.;?!:]$/.test(last.text);
      const t = line.trim();
      const newParagraph =
        /^[A-ZÀ-Ý«"(]/.test(t) && (TRANSITION_START.test(t) || NEW_CASE_START.test(t) || t.length > 100);
      if (cur.trailing.length > 0 || (complete && (prevBlank || (prevEndsSentence && /^[A-ZÀ-Ý«"(]/.test(t)) || newParagraph))) {
        cur.trailing.push(line.trim());
      } else {
        last.text = `${last.text} ${line.trim()}`;
      }
    }
    prevBlank = false;
  }
  return { questions, preamble };
}

function extractPreambleCase(preamble: string[]): string {
  if (preamble.length === 0) return "";
  let startIdx = -1;
  preamble.forEach((l, i) => {
    if (/cas clinique|observation|dossier/i.test(l)) startIdx = i;
  });
  if (startIdx >= 0) return preamble.slice(startIdx).join(" ").trim();
  const paragraph = preamble.slice(-8).join(" ").trim();
  return paragraph.length >= 200 && NEW_CASE_START.test(paragraph) ? paragraph : "";
}

export function parseExamBlocks(text: string, examId: string): EBBlock[] {
  const { questions, preamble } = parseQuestions(text);
  if (questions.length === 0) return [];

  const blocks: EBBlock[] = [];
  let currentCase: EBBlock | null = null;
  let caseCounter = 0;
  let carry = extractPreambleCase(preamble);

  questions.forEach((q, idx) => {
    // 1. Assertions numérotées dans l'énoncé (groupage / jumelage / association)
    const statements: string[] = [];
    const stemLinesClean: string[] = [];
    q.stemLines.forEach((l) => {
      const m = STATEMENT_RE.exec(l);
      if (m && q.stemLines.length > 1) statements.push(m[2].trim());
      else stemLinesClean.push(l);
    });
    const useStatements = statements.length >= 2 ? statements : undefined;
    const stemText = (useStatements ? stemLinesClean : q.stemLines).join(" ").replace(/\s+/g, " ").trim();

    // 2. Séparation vignette / question dans l'énoncé
    let ownVignette = "";
    let stem = stemText;
    const sentences = splitSentences(stemText);
    if (stemText.length > 320 && sentences.length >= 2) {
      const lastN = sentences[sentences.length - 1].length < 45 && sentences.length >= 3 ? 2 : 1;
      stem = sentences.slice(-lastN).join(" ");
      ownVignette = sentences.slice(0, -lastN).join(" ");
    }
    const ctx = `${carry} ${ownVignette}`.replace(/\s+/g, " ").trim();
    carry = q.trailing.join(" ").replace(/\s+/g, " ").trim();

    const options: EBOption[] = q.options.map((o) => ({ letter: o.letter, text: o.text }));
    const format = detectFormat(stem || stemText, useStatements, options);
    const item: EBItem = {
      id: `${examId}_q${idx + 1}`,
      number: idx + 1,
      format,
      stem: stem || stemText,
      statements: useStatements,
      options,
      correct: [],
    };

    const prevInCase = !!currentCase;
    let attach: "new" | "continue" | "isolated" = "isolated";
    let leadText = "";
    let vignetteText = "";

    if (ctx.length >= 120 || /cas clinique/i.test(ctx)) {
      const looksNew = NEW_CASE_START.test(ctx) || /cas clinique|nouveau cas|dossier/i.test(ctx.slice(0, 80));
      if (prevInCase && !looksNew) {
        attach = "continue";
        leadText = ctx;
      } else {
        attach = "new";
        vignetteText = ctx;
      }
    } else if (prevInCase && (CONT_STEM.test(item.stem) || (ctx.length > 0 && TRANSITION_START.test(ctx)))) {
      attach = "continue";
      leadText = ctx;
    }

    if (attach === "new") {
      caseCounter++;
      let header = `Cas clinique ${caseCounter}`;
      const hm = /^(cas clinique[^.:\n]{0,80}?)(?:[:.\-–—]\s+)(.*)$/i.exec(vignetteText);
      if (hm) {
        header = hm[1].trim();
        vignetteText = hm[2].trim();
      }
      currentCase = {
        id: `${examId}_b${blocks.length}`,
        kind: "CAS_CLINIQUE",
        header,
        vignette: vignetteText,
        lessonIds: [],
        items: [item],
      };
      blocks.push(currentCase);
    } else if (attach === "continue" && currentCase) {
      if (leadText) item.lead = leadText;
      currentCase.items.push(item);
    } else {
      currentCase = null;
      blocks.push({ id: `${examId}_b${blocks.length}`, kind: "ISOLE", lessonIds: [], items: [item] });
    }
  });
  return blocks;
}

// ----------------------------------------------------------------------------
// 6. CORRESPONDANCE LEÇON <-> ÉNONCÉ (jamais via les propositions seules)
// ----------------------------------------------------------------------------

function enonceText(block: EBBlock): { all: string; stems: string; options: string } {
  const all: string[] = [];
  const stems: string[] = [];
  const options: string[] = [];
  if (block.header) all.push(block.header);
  if (block.vignette) all.push(block.vignette);
  block.items.forEach((it) => {
    if (it.lead) all.push(it.lead);
    all.push(it.stem);
    stems.push(it.stem);
    (it.statements || []).forEach((s) => options.push(s));
    it.options.forEach((o) => options.push(o.text));
  });
  return { all: all.join(" "), stems: stems.join(" "), options: options.join(" ") };
}

function scoreProfile(p: LessonProfile, set: Set<string>): { score: number; distinct: number } {
  let sum = 0;
  let distinct = 0;
  p.terms.forEach((w, t) => {
    if (set.has(t)) {
      sum += w;
      distinct++;
    }
  });
  return { score: sum / p.norm, distinct };
}

function attributeLessons(block: EBBlock, profiles: LessonProfile[]): { ids: string[]; weak: boolean } {
  if (profiles.length === 0) return { ids: [], weak: false };
  const { all, stems, options } = enonceText(block);
  const setAll = buildTermSet(all);
  const setStems = buildTermSet(stems);

  const rows = profiles.map((p) => {
    const s = scoreProfile(p, setAll);
    const hitStems = p.titleStems.filter((t) => setStems.has(t));
    const titleInStem = hitStems.length >= 1;
    // Terme de titre très distinctif (ex. « drépanocytose ») cité dans l'énoncé : suffit à désigner la leçon.
    const titleDistinctive = hitStems.some((t) => t.length >= 8);
    return { id: p.id, ...s, titleInStem, titleDistinctive };
  });

  const strong = rows.filter(
    (r) =>
      (r.distinct >= 3 && r.score >= 0.2) ||
      (r.titleInStem && (r.distinct >= 2 || r.titleDistinctive))
  );
  if (strong.length > 0) {
    const best = Math.max(...strong.map((r) => r.score));
    const kept = strong.filter((r) => r.score >= best * (r.titleInStem ? 0.3 : 0.5));
    return { ids: kept.map((r) => r.id), weak: false };
  }

  // Repli prudent : QCM isolé dont l'énoncé est générique, mais dont TOUTES les
  // propositions convergent nettement vers une seule leçon (dominance 2x).
  if (block.kind === "ISOLE") {
    const setFull = buildTermSet(`${all} ${options}`);
    const rows2 = profiles
      .map((p) => ({ id: p.id, ...scoreProfile(p, setFull) }))
      .sort((a, b) => b.score - a.score);
    const [first, second] = rows2;
    if (first && first.score >= 0.35 && first.distinct >= 4 && first.score >= 2 * (second ? second.score : 0)) {
      return { ids: [first.id], weak: true };
    }
  }
  return { ids: [], weak: false };
}

// ----------------------------------------------------------------------------
// 7. ANALYSE D'UN EXAMEN & DU CORPUS COMPLET
// ----------------------------------------------------------------------------

function detectYear(title: string, text: string): string {
  const m = /\b(20[12]\d)\b/.exec(title) || /\b(20[12]\d)\b/.exec(text.slice(0, 800));
  return m ? m[1] : "";
}

function detectDuration(text: string): number | undefined {
  const head = text.slice(0, 1500);
  const m1 = /dur[ée]e\s*(?:de\s+l['’][ée]preuve)?\s*:?\s*(\d+)\s*h(?:eures?)?\s*(\d{1,2})?/i.exec(head);
  if (m1) return parseInt(m1[1], 10) * 60 + (m1[2] ? parseInt(m1[2], 10) : 0);
  const m2 = /dur[ée]e\s*:?\s*(\d{2,3})\s*(?:min|minutes)/i.exec(head);
  if (m2) return parseInt(m2[1], 10);
  const m3 = /(\d+)\s*heures?/i.exec(head);
  if (m3) return parseInt(m3[1], 10) * 60;
  return undefined;
}

function formatCountsOf(blocks: EBBlock[]): Partial<Record<EBFormat | "CAS_CLINIQUE", number>> {
  const counts: Partial<Record<EBFormat | "CAS_CLINIQUE", number>> = {};
  blocks.forEach((b) => {
    if (b.kind === "CAS_CLINIQUE") counts.CAS_CLINIQUE = (counts.CAS_CLINIQUE || 0) + 1;
    else b.items.forEach((it) => (counts[it.format] = (counts[it.format] || 0) + 1));
  });
  return counts;
}

export function analyzeExamLocal(annale: EBAnnale, subjectName: string, profiles: LessonProfile[]): ExamAnalysis {
  const iso = isolateSubjectSection(annale.rawText, subjectName);
  const blocks = parseExamBlocks(iso.text, annale.id);
  blocks.forEach((b) => {
    const a = attributeLessons(b, profiles);
    b.lessonIds = a.ids;
    b.weakAttribution = a.weak;
  });
  return finalizeExam(annale, iso.isolated, false, blocks);
}

function finalizeExam(annale: EBAnnale, isolated: boolean, audited: boolean, blocks: EBBlock[]): ExamAnalysis {
  const used = new Set<string>();
  blocks.forEach((b) => b.lessonIds.forEach((id) => used.add(id)));
  return {
    examId: annale.id,
    title: annale.title,
    year: annale.year,
    isolated,
    audited,
    questionCount: blocks.reduce((s, b) => s + b.items.length, 0),
    blockCount: blocks.length,
    caseCount: blocks.filter((b) => b.kind === "CAS_CLINIQUE").length,
    durationMin: detectDuration(annale.rawText),
    formatCounts: formatCountsOf(blocks),
    lessonsUsed: Array.from(used),
    blocks,
  };
}

export function renderBlockAsText(block: EBBlock, maxChars = 3000): string {
  const out: string[] = [];
  if (block.kind === "CAS_CLINIQUE") {
    out.push(`${block.header || "Cas clinique"}`);
    if (block.vignette) out.push(block.vignette);
  }
  block.items.forEach((it) => {
    if (it.lead) out.push(it.lead);
    out.push(`${it.number}. ${it.stem}`);
    (it.statements || []).forEach((s, i) => out.push(`   ${i + 1}. ${s}`));
    it.options.forEach((o) => out.push(`   ${o.letter}. ${o.text}`));
  });
  const t = out.join("\n");
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
}

const DEFAULT_GROUPAGE = [
  "Les propositions 1, 2 et 3 sont exactes",
  "Les propositions 1 et 3 sont exactes",
  "Les propositions 2 et 4 sont exactes",
  "Seule la proposition 4 est exacte",
  "Toute autre combinaison est exacte",
];
const DEFAULT_JUMELAGE = [
  "Les deux propositions sont vraies et il existe une relation de cause à effet",
  "Les deux propositions sont vraies mais il n'existe pas de relation de cause à effet",
  "La première proposition est vraie, la seconde est fausse",
  "La première proposition est fausse, la seconde est vraie",
  "Les deux propositions sont fausses",
];

function computeStyleDna(exams: ExamAnalysis[]): StyleDna {
  const allBlocks = exams.flatMap((e) => e.blocks);
  const items = allBlocks.flatMap((b) => b.items);
  const withOpts = items.filter((i) => i.options.length > 0 && i.format !== "GROUPAGE" && i.format !== "JUMELAGE");
  const optWords: number[] = [];
  let endPeriod = 0;
  let capital = 0;
  let optCount = 0;
  withOpts.forEach((i) =>
    i.options.forEach((o) => {
      optWords.push(o.text.split(/\s+/).length);
      if (/[.]$/.test(o.text.trim())) endPeriod++;
      if (/^[A-ZÀ-Ý]/.test(o.text.trim())) capital++;
      optCount++;
    })
  );
  const cases = allBlocks.filter((b) => b.kind === "CAS_CLINIQUE");
  const samples: { label: string; text: string }[] = [];
  const pushSample = (label: string, b: EBBlock | undefined) => {
    if (b && samples.length < 7) samples.push({ label, text: renderBlockAsText(b, 2600) });
  };
  pushSample("Cas clinique complet (vignette, transitions, questions)", cases.sort((a, b) => b.items.length - a.items.length)[0]);
  pushSample("Cas clinique (second exemple)", cases[1]);
  (["ELECTION", "CENSURE", "GROUPAGE", "COMPLEMENT_MULTIPLE", "JUMELAGE", "ASSOCIATION", "QNS"] as EBFormat[]).forEach((f) => {
    pushSample(`QCM isolé — ${EB_FORMAT_LABELS[f]}`, allBlocks.find((b) => b.kind === "ISOLE" && b.items[0].format === f));
  });

  const grp = items.find((i) => i.format === "GROUPAGE" && i.options.length === 5);
  const jum = items.find((i) => i.format === "JUMELAGE" && i.options.length === 5);
  return {
    samples,
    avgOptionWords: optWords.length ? Math.round(optWords.reduce((a, b) => a + b, 0) / optWords.length) : 12,
    avgVignetteChars: cases.length
      ? Math.round(cases.reduce((s, b) => s + (b.vignette || "").length, 0) / cases.length)
      : 0,
    avgItemsPerCase: cases.length ? Math.round((cases.reduce((s, b) => s + b.items.length, 0) / cases.length) * 10) / 10 : 0,
    optionsEndWithPeriod: optCount > 0 && endPeriod / optCount > 0.5,
    optionsCapitalized: optCount === 0 || capital / optCount > 0.5,
    groupageTemplate: grp ? grp.options.map((o) => o.text) : undefined,
    jumelageTemplate: jum ? jum.options.map((o) => o.text) : undefined,
    stemExamples: items.slice(0, 400).filter((_, i) => i % 7 === 0).slice(0, 12).map((i) => i.stem.slice(0, 220)),
  };
}

export function computeCorpusAnalysis(
  subjectName: string,
  lessons: EBLesson[],
  exams: ExamAnalysis[],
  warnings: string[] = []
): CorpusAnalysis {
  const valid = exams.filter((e) => e.questionCount > 0);
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.cleanTitle]));
  const stats: LessonStat[] = lessons
    .filter((l) => !l.duplicateOf)
    .map((l) => {
      const perExam: LessonStat["perExam"] = [];
      let timesOut = 0;
      let totalQcm = 0;
      valid.forEach((e) => {
        const hit = e.blocks.filter((b) => b.lessonIds.includes(l.id));
        if (hit.length > 0) {
          const qcm = hit.reduce((s, b) => s + b.items.length, 0);
          timesOut += hit.length;
          totalQcm += qcm;
          perExam.push({
            examId: e.examId,
            examTitle: e.title,
            year: e.year,
            blocks: hit.length,
            qcm,
            weak: hit.every((b) => b.weakAttribution),
          });
        }
      });
      return {
        lessonId: l.id,
        title: lessonTitle.get(l.id) || l.title,
        examsAppeared: perExam.length,
        totalExams: valid.length,
        percent: valid.length ? Math.round((perExam.length / valid.length) * 100) : 0,
        timesOut,
        totalQcm,
        perExam,
      };
    })
    .sort((a, b) => b.percent - a.percent || b.totalQcm - a.totalQcm || b.timesOut - a.timesOut);

  const counts = valid.map((e) => e.questionCount);
  const maxQcm = counts.length ? Math.max(...counts) : 0;
  const avgQcm = counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0;
  const withLessons = valid.filter((e) => e.lessonsUsed.length > 0);
  const avgLessons = withLessons.length ? withLessons.reduce((s, e) => s + e.lessonsUsed.length, 0) / withLessons.length : 0;
  const available = lessons.filter((l) => !l.duplicateOf).length;
  const quota = Math.max(1, Math.min(available || 1, avgLessons > 0 ? Math.round(avgLessons) : Math.min(5, available || 1)));

  const reference = [...valid].sort(
    (a, b) =>
      b.questionCount - a.questionCount ||
      (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0) ||
      b.lessonsUsed.length - a.lessonsUsed.length
  )[0];

  const blueprint: BlueprintBlock[] = reference
    ? reference.blocks.map((b) => ({ kind: b.kind, formats: b.items.map((i) => i.format) }))
    : [];

  const dist: Partial<Record<EBFormat | "CAS_CLINIQUE", number>> = {};
  valid.forEach((e) =>
    (Object.keys(e.formatCounts) as (EBFormat | "CAS_CLINIQUE")[]).forEach((k) => {
      dist[k] = (dist[k] || 0) + (e.formatCounts[k] || 0);
    })
  );

  const durations = valid.map((e) => e.durationMin).filter((d): d is number => !!d);
  return {
    createdAt: new Date().toISOString(),
    subjectName,
    exams,
    lessonStats: stats,
    maxQcm,
    avgQcm,
    quota,
    avgLessonsPerExam: Math.round(avgLessons * 10) / 10,
    formatDistribution: dist,
    blueprint,
    referenceExamId: reference?.examId,
    durationMin: durations.length ? Math.max(...durations) : undefined,
    style: computeStyleDna(valid),
    warnings,
  };
}

// ----------------------------------------------------------------------------
// 8. AUDIT IA APPROFONDI (examen par examen, bloc par bloc)
// ----------------------------------------------------------------------------

export interface AnalysisProgress {
  phase: string;
  message: string;
  current: number;
  total: number;
}

function compactExamForAudit(blocks: EBBlock[]): string {
  return blocks
    .map((b, i) => {
      const head = `#${i} [${b.kind}]${b.header ? " " + b.header : ""}${b.vignette ? " | VIGNETTE: " + b.vignette.slice(0, 260) : ""}`;
      const items = b.items
        .map(
          (it) =>
            `   Q${it.number} (détecté ${it.format})${it.lead ? " | TRANSITION: " + it.lead.slice(0, 120) : ""} | ÉNONCÉ: ${it.stem.slice(0, 240)} | PROPOSITIONS: ${[
              ...(it.statements || []).map((s, k) => `${k + 1}) ${s.slice(0, 50)}`),
              ...it.options.map((o) => `${o.letter}) ${o.text.slice(0, 55)}`),
            ].join(" ; ")}`
        )
        .join("\n");
      return `${head}\n${items}`;
    })
    .join("\n\n");
}

const AUDIT_SYSTEM = `Tu es un docimologue expert de la Faculté de Médecine (UCAD). Tu audites une épreuve déjà segmentée automatiquement.
Ta mission, rigoureuse et patiente, pour CHAQUE bloc :
1. Confirmer si le bloc relève de la matière cible (inSubject). Les questions d'une autre matière (autre EC) doivent être exclues.
2. Confirmer la nature du bloc : "CAS_CLINIQUE" (contexte clinique suivi de questions, même si une question interne ressemble à une élection, une censure, un groupage ou un complément multiple) ou "ISOLE" (QCM autonome).
3. Corriger le format de chaque question si besoin : ELECTION, CENSURE, GROUPAGE, COMPLEMENT_MULTIPLE, ASSOCIATION, JUMELAGE, QNS.
4. Identifier quelles leçons ont réellement servi à CONSTRUIRE le bloc. RÈGLE CAPITALE : une leçon est "sortie" seulement si elle est l'objet du cas clinique ou de l'énoncé de la question. Un terme qui apparaît seulement dans une proposition / un distracteur / un diagnostic différentiel NE compte PAS.
Réponds UNIQUEMENT par un JSON valide, sans commentaire.`;

export async function auditExamWithAI(
  exam: ExamAnalysis,
  subjectName: string,
  lessons: EBLesson[],
  profiles: LessonProfile[]
): Promise<ExamAnalysis> {
  if (exam.blocks.length === 0) return exam;
  const lessonList = lessons
    .filter((l) => !l.duplicateOf)
    .map((l) => {
      const p = profiles.find((x) => x.id === l.id);
      const kw = p ? Array.from(p.terms.keys()).filter((t) => !t.includes(" ")).slice(0, 8).join(", ") : "";
      return `- ${l.id} : ${l.cleanTitle} (mots-clés : ${kw})`;
    })
    .join("\n");

  const chunkSize = 14;
  const merged = exam.blocks.map((b) => ({ ...b, items: b.items.map((i) => ({ ...i })) }));
  let usedAi = false;
  const excluded = new Set<number>();

  for (let start = 0; start < merged.length; start += chunkSize) {
    const slice = merged.slice(start, start + chunkSize);
    const prompt = `MATIÈRE CIBLE : ${subjectName}

LEÇONS DISPONIBLES :
${lessonList}

BLOCS À AUDITER (index global #n) :
${compactExamForAudit(slice.map((b, k) => ({ ...b, header: `${b.header || ""}` })) ).replace(/^#(\d+)/gm, (_m, n) => `#${start + parseInt(n, 10)}`)}

Réponds avec ce JSON exact :
{"blocks":[{"idx":<index global>,"inSubject":true|false,"kind":"CAS_CLINIQUE"|"ISOLE","lessons":["id_leçon", ...],"formats":{"<numéro de question>":"ELECTION|CENSURE|GROUPAGE|COMPLEMENT_MULTIPLE|ASSOCIATION|JUMELAGE|QNS"}}]}`;
    try {
      const raw = await callDawiaEngineRaw("dawia2", AUDIT_SYSTEM, prompt, 0.1);
      if (!raw) continue;
      const parsed = repairAndParseQuizJson(raw);
      const rows: any[] = Array.isArray(parsed?.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
      rows.forEach((r) => {
        const idx = Number(r?.idx);
        const target = merged[idx];
        if (!target || idx < start || idx >= start + chunkSize) return;
        usedAi = true;
        if (r.inSubject === false) excluded.add(idx);
        if (r.kind === "CAS_CLINIQUE" || r.kind === "ISOLE") {
          if (!(r.kind === "ISOLE" && target.kind === "CAS_CLINIQUE" && target.items.length > 1)) target.kind = r.kind;
        }
        if (Array.isArray(r.lessons)) {
          const ids = r.lessons.filter((id: string) => lessons.some((l) => l.id === id));
          target.lessonIds = ids;
          target.weakAttribution = false;
        }
        if (r.formats && typeof r.formats === "object") {
          target.items.forEach((it) => {
            const f = r.formats[String(it.number)];
            if (
              ["ELECTION", "CENSURE", "GROUPAGE", "COMPLEMENT_MULTIPLE", "ASSOCIATION", "JUMELAGE", "QNS"].includes(f)
            )
              it.format = f;
          });
        }
      });
    } catch (err) {
      console.warn("[examenBlancEngine] Audit IA ignoré pour un lot :", err);
    }
  }

  if (!usedAi) return exam;
  const finalBlocks = merged.filter((_, i) => !excluded.has(i));
  const base: EBAnnale = { id: exam.examId, title: exam.title, rawText: "", year: exam.year, wordCount: 0, sizeLabel: "" };
  const result = finalizeExam(base, exam.isolated || excluded.size > 0, true, finalBlocks);
  result.durationMin = exam.durationMin;
  return result;
}

export async function runDeepAnalysis(params: {
  subjectName: string;
  lessons: EBLesson[];
  annales: EBAnnale[];
  useAI: boolean;
  onProgress: (p: AnalysisProgress) => void;
  isCancelled: () => boolean;
}): Promise<CorpusAnalysis> {
  const { subjectName, annales, useAI, onProgress, isCancelled } = params;
  const lessons = flagDuplicateLessons(params.lessons);
  const active = lessons.filter((l) => !l.duplicateOf);
  const warnings: string[] = [];
  const profiles = buildProfiles(active);

  const exams: ExamAnalysis[] = [];
  const total = annales.length;
  for (let i = 0; i < annales.length; i++) {
    if (isCancelled()) break;
    const a = annales[i];
    onProgress({ phase: "lecture", message: `Lecture ligne par ligne — ${a.title}`, current: i, total });
    await new Promise((r) => setTimeout(r, 30));
    let exam = analyzeExamLocal(a, subjectName, profiles);
    if (exam.questionCount === 0) {
      warnings.push(`« ${a.title} » : aucune question numérotée n'a pu être repérée (vérifiez le fichier).`);
    } else if (!exam.isolated) {
      warnings.push(
        `« ${a.title} » : la matière « ${subjectName} » n'a pas été repérée par un intitulé de section ; l'épreuve est analysée en entier${useAI ? " puis filtrée par l'audit IA" : ""}.`
      );
    }
    if (useAI && exam.questionCount > 0 && !isCancelled()) {
      onProgress({ phase: "audit", message: `Audit approfondi bloc par bloc — ${a.title}`, current: i, total });
      try {
        exam = await auditExamWithAI(exam, subjectName, active, profiles);
      } catch (err) {
        console.warn("[examenBlancEngine] Audit IA indisponible :", err);
      }
    }
    exams.push(exam);
  }
  onProgress({ phase: "synthese", message: "Synthèse probabiliste & plan de l'épreuve", current: total, total });
  return computeCorpusAnalysis(subjectName, lessons, exams, warnings);
}

// ----------------------------------------------------------------------------
// 9. PROMPT SYSTÈME UNIVERSEL & GÉNÉRATION
// ----------------------------------------------------------------------------

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu es le Moteur Docimologique Universel de DawJang (Faculté de Médecine, de Pharmacie et d'Odonto-Stomatologie — UCAD).
Tu rédiges des épreuves d'examen blanc pour l'Unité d'Enseignement « {{UE_NAME}} », matière « {{SUBJECT_NAME}} », sur {{QUOTA_COUNT}} leçon(s) choisie(s).

PRINCIPE D'UNIVERSALITÉ (AUCUN BIAIS DE MATIÈRE) :
- Tu n'as AUCUNE connaissance préférentielle : tout le contenu médical, chaque valeur, chaque seuil, chaque nom propre provient EXCLUSIVEMENT des extraits de cours fournis.
- Tu écrases tout réflexe venant d'une autre matière. Si l'information n'est pas dans l'extrait, tu ne l'inventes pas.

NATURE DES QUESTIONS (à ne jamais confondre) :
- CAS CLINIQUE = une structure (contexte clinique puis questions successives, avec phrases de transition/rebondissement). Les questions INTERNES d'un cas clinique peuvent avoir la forme d'une élection ("Quel est le diagnostic le plus probable ?"), d'une censure ("laquelle est fausse ?"), d'un groupage ou d'un complément multiple : elles restent des questions DU CAS CLINIQUE.
- ELECTION : une seule proposition exacte parmi A–E.
- CENSURE : une seule proposition FAUSSE ("SAUF", "inexacte") — la réponse attendue est la fausse.
- GROUPAGE : 4 assertions numérotées ; les options A–E sont des codes de combinaison (ex. A = 1,2,3 ; B = 1,3 ; C = 2,4 ; D = 4 seule ; E = toute autre combinaison). Tu fournis la vérité de chaque assertion ; la lettre correcte est calculée par le système.
- JUMELAGE : deux assertions reliées par PARCE QUE ; codes A–E standard (vrai/vrai avec cause, vrai/vrai sans cause, vrai/faux, faux/vrai, faux/faux). Tu fournis la vérité des deux assertions et l'existence du lien causal ; la lettre est calculée par le système.
- ASSOCIATION : appariement de 4 éléments avec 4 correspondances ; options A–E = combinaisons.
- COMPLEMENT_MULTIPLE : plusieurs propositions exactes (2 à 4) parmi A–E (toutes les bonnes réponses doivent être cochées).
- QNS : question à réponse courte rédigée, sans propositions.

CLONAGE DE STYLE (CAPITAL) :
- Tu reproduis à l'identique la manière des professeurs telle qu'elle apparaît dans les EXEMPLES D'ANNALES : formulation des énoncés, longueur et densité des vignettes, ordre des données biologiques, ponctuation, majuscules, longueur et syntaxe des propositions, façon d'écrire les transitions.
- Aucune formule méta, aucun suffixe explicatif dans les propositions, aucune phrase tronquée.

QUALITÉ DOCIMOLOGIQUE :
- Distracteurs plausibles (inversion de seuil, confusion de mécanisme, contre-indication oubliée) mais clairement faux au regard du cours.
- Une seule lecture possible : pas d'ambiguïté, pas de double bonne réponse en ÉLECTION/CENSURE.
- Loi d'équisme : répartition équilibrée des lettres correctes ; pas de pattern évident.
- Chaque "explanation" justifie la clé en citant l'élément exact du cours.

ANTI-RÉPÉTITION : les énoncés, cas, assertions et propositions doivent être TOTALEMENT différents de ceux listés dans « DÉJÀ UTILISÉS ».

SORTIE : uniquement un JSON valide conforme au schéma demandé, sans texte avant/après, sans balises markdown.`;

export function fillSystemPrompt(ueName: string, subjectName: string, quota: number): string {
  return EXAMEN_BLANC_SYSTEM_PROMPT.replace("{{UE_NAME}}", ueName || "—")
    .replace("{{SUBJECT_NAME}}", subjectName || "—")
    .replace("{{QUOTA_COUNT}}", String(quota));
}

const MEMORY_KEY = "dawjang_eb_stem_memory_v2";

function loadMemory(subjectKey: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}");
    return Array.isArray(all[subjectKey]) ? all[subjectKey] : [];
  } catch {
    return [];
  }
}

function saveMemory(subjectKey: string, stems: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}");
    all[subjectKey] = [...(all[subjectKey] || []), ...stems].slice(-400);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(all));
  } catch {
    // quota ou stockage indisponible : mémoire de session uniquement
  }
}

export function subjectMemoryKey(subjectName: string): string {
  return normalizeText(subjectName) || "matiere";
}

export function defaultBlueprint(lessonCount: number): BlueprintBlock[] {
  const bp: BlueprintBlock[] = [];
  for (let i = 0; i < Math.max(2, lessonCount); i++) {
    bp.push({ kind: "CAS_CLINIQUE", formats: ["ELECTION", "COMPLEMENT_MULTIPLE", "CENSURE"] });
    bp.push({ kind: "ISOLE", formats: [i % 2 === 0 ? "ELECTION" : "GROUPAGE"] });
  }
  return bp.slice(0, Math.max(4, lessonCount * 2));
}

export function assignLessonsToBlueprint(
  blueprint: BlueprintBlock[],
  selected: EBLesson[],
  stats: LessonStat[]
): { spec: BlueprintBlock; lessons: EBLesson[] }[] {
  const ordered = [...selected].sort(
    (a, b) =>
      (stats.find((s) => s.lessonId === b.id)?.percent || 0) - (stats.find((s) => s.lessonId === a.id)?.percent || 0)
  );
  const B = blueprint.length;
  const L = ordered.length;
  const plan = blueprint.map((spec) => ({ spec, lessons: [] as EBLesson[] }));
  if (L === 0 || B === 0) return plan;
  for (let i = 0; i < Math.max(B, L); i++) {
    const lesson = ordered[i % L];
    const slot = plan[i % B];
    if (!slot.lessons.includes(lesson)) slot.lessons.push(lesson);
  }
  return plan;
}

function pickExcerpt(lesson: EBLesson, usage: Map<string, number>, seed: number, budget: number): string {
  const text = lesson.content;
  if (text.length <= budget) return text;
  const chunkSize = 1800;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) chunks.push(text.slice(i, i + chunkSize));
  const used = usage.get(lesson.id) || 0;
  let start = (seed * 3 + used) % chunks.length;
  let out = "";
  let taken = 0;
  while (out.length < budget && taken < chunks.length) {
    out += chunks[start] + "\n";
    start = (start + 1) % chunks.length;
    taken++;
  }
  usage.set(lesson.id, used + taken);
  return out;
}

// ---------------------------- validation ------------------------------------

function comboSetOfText(t: string): Set<number> | null {
  if (/autre|toute|aucune/i.test(t)) return null;
  const nums = (t.match(/[1-6]/g) || []).map((n) => parseInt(n, 10));
  return new Set(nums);
}

function groupageLetter(truth: boolean[], template: string[]): EBLetter {
  const truthSet = new Set<number>();
  truth.forEach((v, i) => v && truthSet.add(i + 1));
  let otherLetter: EBLetter = "E";
  for (let i = 0; i < template.length; i++) {
    const s = comboSetOfText(template[i]);
    if (s === null) {
      otherLetter = EB_LETTERS[i];
      continue;
    }
    if (s.size === truthSet.size && Array.from(s).every((n) => truthSet.has(n))) return EB_LETTERS[i];
  }
  return otherLetter;
}

function jumelageLetter(t1: boolean, t2: boolean, causal: boolean): EBLetter {
  if (t1 && t2) return causal ? "A" : "B";
  if (t1 && !t2) return "C";
  if (!t1 && t2) return "D";
  return "E";
}

const cleanOpt = (s: any): string =>
  String(s ?? "")
    .replace(/^\s*\(?[A-Ea-e][\s]*[-–—.):]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

function validateBlock(
  raw: any,
  spec: BlueprintBlock,
  lessonIds: string[],
  style: StyleDna,
  memory: Set<string>[],
  blockId: string
): { block?: EBBlock; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
    return { errors: ["Le JSON ne contient pas de tableau « items »."] };
  }
  const isCase = spec.kind === "CAS_CLINIQUE";
  if (raw.items.length !== spec.formats.length) {
    errors.push(`Nombre de questions incorrect : ${raw.items.length} reçu(es), ${spec.formats.length} attendue(s).`);
  }
  if (isCase && String(raw.vignette || "").trim().length < 150) {
    errors.push("La vignette du cas clinique est absente ou trop courte (≥ 150 caractères attendus).");
  }

  const grpTemplate = style.groupageTemplate && style.groupageTemplate.length === 5 ? style.groupageTemplate : DEFAULT_GROUPAGE;
  const jumTemplate = style.jumelageTemplate && style.jumelageTemplate.length === 5 ? style.jumelageTemplate : DEFAULT_JUMELAGE;

  const items: EBItem[] = [];
  raw.items.forEach((r: any, idx: number) => {
    const expected = spec.formats[idx] || r?.format;
    const format: EBFormat = expected;
    const stem = String(r?.stem || "").replace(/\s+/g, " ").trim();
    const label = `Question ${idx + 1}`;
    if (stem.length < 15) errors.push(`${label} : énoncé absent ou trop court.`);
    if (/\.\.\.$|…$/.test(stem)) errors.push(`${label} : énoncé tronqué.`);

    const item: EBItem = {
      id: `${blockId}_i${idx + 1}`,
      number: 0,
      format,
      stem,
      options: [],
      correct: [],
      explanation: String(r?.explanation || "").trim(),
    };
    if (isCase && idx > 0 && String(r?.lead || "").trim().length > 20) item.lead = String(r.lead).trim();
    if (!isCase && r?.lead) item.lead = undefined;
    if (isCase && idx > 0 && !item.lead && spec.formats.length > 1) {
      // transition recommandée mais non bloquante
    }
    if (!item.explanation || item.explanation.length < 20) errors.push(`${label} : justification manquante.`);

    if (format === "GROUPAGE") {
      const st = (Array.isArray(r?.statements) ? r.statements : []).map(cleanOpt).filter(Boolean);
      const truth = Array.isArray(r?.truth) ? r.truth.map((v: any) => v === true || v === "true") : [];
      if (st.length < 4) errors.push(`${label} (groupage) : 4 assertions numérotées requises.`);
      else if (truth.length < st.length) errors.push(`${label} (groupage) : « truth » doit donner la vérité de chaque assertion.`);
      else {
        item.statements = st.slice(0, 4);
        item.options = grpTemplate.map((t, i) => ({ letter: EB_LETTERS[i], text: t }));
        item.correct = [groupageLetter(truth.slice(0, 4), grpTemplate)];
      }
    } else if (format === "JUMELAGE") {
      const st = (Array.isArray(r?.statements) ? r.statements : []).map(cleanOpt).filter(Boolean);
      if (st.length < 2 || typeof r?.truth?.[0] === "undefined" || typeof r?.truth?.[1] === "undefined")
        errors.push(`${label} (jumelage) : deux assertions et leur vérité sont requises.`);
      else {
        const t1 = r.truth[0] === true || r.truth[0] === "true";
        const t2 = r.truth[1] === true || r.truth[1] === "true";
        item.statements = st.slice(0, 2);
        item.options = jumTemplate.map((t, i) => ({ letter: EB_LETTERS[i], text: t }));
        item.correct = [jumelageLetter(t1, t2, r?.causal === true || r?.causal === "true")];
      }
    } else if (format === "QNS") {
      item.options = [];
      item.correct = [];
    } else {
      const opts: EBOption[] = (Array.isArray(r?.options) ? r.options : [])
        .slice(0, 5)
        .map((o: any, i: number) => ({ letter: EB_LETTERS[i], text: cleanOpt(typeof o === "string" ? o : o?.text) }));
      if (opts.length !== 5 || opts.some((o) => o.text.length < 3)) {
        errors.push(`${label} : 5 propositions A–E complètes requises.`);
      } else {
        const texts = new Set(opts.map((o) => normalizeText(o.text)));
        if (texts.size < 5) errors.push(`${label} : propositions dupliquées.`);
        item.options = opts;
        const correct: EBLetter[] = (Array.isArray(r?.correct) ? r.correct : [r?.correct])
          .map((c: any) => String(c || "").trim().toUpperCase().charAt(0))
          .filter((c: string) => EB_LETTERS.includes(c as EBLetter));
        const uniq = Array.from(new Set(correct)) as EBLetter[];
        if (format === "COMPLEMENT_MULTIPLE" || format === "ASSOCIATION") {
          if (format === "COMPLEMENT_MULTIPLE" && (uniq.length < 2 || uniq.length > 4))
            errors.push(`${label} : un complément multiple exige 2 à 4 bonnes réponses.`);
          if (format === "ASSOCIATION" && uniq.length !== 1) errors.push(`${label} : une association exige une seule combinaison correcte.`);
        } else if (uniq.length !== 1) {
          errors.push(`${label} : ${format === "CENSURE" ? "une seule proposition fausse" : "une seule bonne réponse"} attendue.`);
        }
        item.correct = uniq.sort();
      }
    }

    // Anti-répétition vis-à-vis des sessions précédentes
    const stemSet = new Set(significantTokens(stem));
    if (memory.some((m) => jaccard(stemSet, m) > 0.6)) errors.push(`${label} : énoncé trop proche d'un énoncé déjà utilisé.`);
    items.push(item);
  });

  if (errors.length > 0) return { errors };
  const block: EBBlock = {
    id: blockId,
    kind: spec.kind,
    header: isCase ? String(raw.header || "").trim() || undefined : undefined,
    vignette: isCase ? String(raw.vignette || "").trim() : undefined,
    lessonIds,
    items,
  };
  return { block, errors: [] };
}

function blockToJsonForReview(block: EBBlock): any {
  return {
    header: block.header,
    vignette: block.vignette,
    items: block.items.map((it, i) => ({
      numero: i + 1,
      format: it.format,
      lead: it.lead,
      stem: it.stem,
      statements: it.statements,
      options: it.options.map((o) => `${o.letter}. ${o.text}`),
      reponse_attendue: it.correct,
      explanation: it.explanation,
    })),
  };
}

function schemaFor(spec: BlueprintBlock): string {
  const isCase = spec.kind === "CAS_CLINIQUE";
  const itemSchemas = spec.formats.map((f, i) => {
    switch (f) {
      case "GROUPAGE":
        return `{"format":"GROUPAGE",${isCase && i > 0 ? '"lead":"phrase de transition clinique",' : ""}"stem":"énoncé","statements":["assertion 1","assertion 2","assertion 3","assertion 4"],"truth":[true|false,true|false,true|false,true|false],"explanation":"..."}`;
      case "JUMELAGE":
        return `{"format":"JUMELAGE",${isCase && i > 0 ? '"lead":"...",' : ""}"stem":"énoncé court","statements":["assertion 1","assertion 2"],"truth":[true|false,true|false],"causal":true|false,"explanation":"..."}`;
      case "QNS":
        return `{"format":"QNS",${isCase && i > 0 ? '"lead":"...",' : ""}"stem":"question","explanation":"réponse attendue détaillée"}`;
      case "COMPLEMENT_MULTIPLE":
        return `{"format":"COMPLEMENT_MULTIPLE",${isCase && i > 0 ? '"lead":"...",' : ""}"stem":"énoncé","options":["A","B","C","D","E"],"correct":["lettre","lettre"],"explanation":"..."}`;
      default:
        return `{"format":"${f}",${isCase && i > 0 ? '"lead":"...",' : ""}"stem":"énoncé","options":["A","B","C","D","E"],"correct":["lettre"],"explanation":"..."}`;
    }
  });
  return isCase
    ? `{"header":"Cas clinique n — titre court","vignette":"contexte clinique et biologique dense","items":[${itemSchemas.join(",")}]}`
    : `{"items":[${itemSchemas.join(",")}]}`;
}

export interface GenerateParams {
  ueName: string;
  subjectName: string;
  selected: EBLesson[];
  analysis: CorpusAnalysis;
  sessionSeed: number;
  onProgress: (p: AnalysisProgress) => void;
  isCancelled: () => boolean;
}

export async function generateExamBlanc(params: GenerateParams): Promise<{ blocks: EBBlock[]; warnings: string[] }> {
  const { ueName, subjectName, selected, analysis, sessionSeed, onProgress, isCancelled } = params;
  const warnings: string[] = [];
  const blueprint = analysis.blueprint.length > 0 ? analysis.blueprint : defaultBlueprint(selected.length);
  const plan = assignLessonsToBlueprint(blueprint, selected, analysis.lessonStats);
  const system = fillSystemPrompt(ueName, subjectName, selected.length);
  const memKey = subjectMemoryKey(subjectName);
  const pastStems = loadMemory(memKey);
  const memorySets: Set<string>[] = pastStems.map((s) => new Set(significantTokens(s)));
  const usage = new Map<string, number>();
  const blocks: EBBlock[] = [];
  const newStems: string[] = [];
  const total = plan.length;
  const style = analysis.style;

  const styleBlock = style.samples.length
    ? style.samples.map((s) => `--- ${s.label} ---\n${s.text}`).join("\n\n")
    : "(aucun exemple d'annale fourni : adopte un style académique sobre, formulation classique de faculté de médecine)";
  const styleStats = `Longueur moyenne d'une proposition : ~${style.avgOptionWords} mots ; ${
    style.optionsEndWithPeriod ? "propositions terminées par un point" : "propositions sans point final"
  } ; ${style.optionsCapitalized ? "majuscule initiale" : "minuscule initiale"} ; vignette moyenne ≈ ${style.avgVignetteChars} caractères ; ${style.avgItemsPerCase || "n"} question(s) par cas clinique.`;

  for (let i = 0; i < plan.length; i++) {
    if (isCancelled()) break;
    const { spec, lessons } = plan[i];
    const blockId = `eb_${Date.now()}_b${i}`;
    const label = spec.kind === "CAS_CLINIQUE" ? `Cas clinique (${spec.formats.length} question${spec.formats.length > 1 ? "s" : ""})` : `QCM isolé ${EB_FORMAT_LABELS[spec.formats[0]]}`;
    const budget = Math.max(2500, Math.floor(9000 / Math.max(1, lessons.length)));
    const courseText = lessons
      .map((l) => `### LEÇON « ${l.cleanTitle} »\n${pickExcerpt(l, usage, sessionSeed + i, budget)}`)
      .join("\n\n");
    const avoid = [...pastStems.slice(-30), ...newStems.slice(-30)].map((s) => `- ${s.slice(0, 160)}`).join("\n") || "(aucun)";

    let accepted: EBBlock | null = null;
    let feedback = "";
    for (let attempt = 1; attempt <= 3 && !accepted; attempt++) {
      if (isCancelled()) break;
      onProgress({ phase: "redaction", message: `Bloc ${i + 1}/${total} — rédaction : ${label}${attempt > 1 ? ` (essai ${attempt})` : ""}`, current: i, total });
      const userPrompt = `STRUCTURE DU BLOC À RÉDIGER : ${label}
Formats imposés, dans l'ordre : ${spec.formats.map((f) => EB_FORMAT_LABELS[f]).join(" → ")}
Leçons sources : ${lessons.map((l) => l.cleanTitle).join(" + ")}

COURS (seule source de vérité) :
${courseText}

STYLE DES PROFESSEURS À CLONER :
${styleStats}

EXEMPLES D'ANNALES (imite fidèlement formulation, densité, ponctuation) :
${styleBlock}

DÉJÀ UTILISÉS — INTERDITS (ne reprends ni les énoncés, ni les cas, ni les assertions) :
${avoid}

${feedback ? `CORRECTIONS OBLIGATOIRES SUITE À LA VALIDATION PRÉCÉDENTE :\n${feedback}\n` : ""}SCHÉMA JSON EXACT À RESPECTER :
${schemaFor(spec)}`;
      const raw = await callDawiaEngineRaw("dawia2", system, userPrompt, 0.55 + (attempt - 1) * 0.1);
      if (!raw) {
        feedback = "Aucune réponse du moteur : recommence en respectant le schéma.";
        continue;
      }
      let parsed: any;
      try {
        parsed = repairAndParseQuizJson(raw);
      } catch (err: any) {
        feedback = `Le JSON était invalide (${err?.message || "erreur"}). Renvoie UNIQUEMENT un JSON valide.`;
        continue;
      }
      const v = validateBlock(parsed, spec, lessons.map((l) => l.id), style, memorySets, blockId);
      if (!v.block) {
        feedback = v.errors.map((e) => `- ${e}`).join("\n");
        continue;
      }
      accepted = v.block;
    }

    if (!accepted) {
      warnings.push(`Le bloc ${i + 1} (${label}) n'a pas pu être validé après 3 essais et a été ignoré.`);
      continue;
    }

    // ----- Relecture croisée (relecteur) puis adjudication (rédacteur) -----
    for (let round = 1; round <= 2 && !isCancelled(); round++) {
      onProgress({ phase: "relecture", message: `Bloc ${i + 1}/${total} — relecture croisée${round > 1 ? ` (tour ${round})` : ""}`, current: i, total });
      const reviewPrompt = `EXTRAITS DU COURS (référence unique) :
${courseText.slice(0, 14000)}

BLOC À RELIRE :
${JSON.stringify(blockToJsonForReview(accepted))}

Contrôle chaque question : (1) la clé est-elle exacte d'après le cours ? (2) y a-t-il une ambiguïté ou une seconde réponse défendable ? (3) une valeur/information est-elle absente du cours ? (4) la formulation est-elle correcte et sans fragment ?
Réponds uniquement par : {"verdict":"ok"|"fix","issues":[{"item":<numéro>,"type":"cle|ambiguite|hors_cours|formulation","detail":"explication précise","citation":"extrait du cours qui le prouve"}]}`;
      let issues: any[] = [];
      try {
        const rawRev = await callDawiaEngineRaw(
          "dawia1",
          "Tu es relecteur-docimologue rigoureux. Tu ne signales un problème que s'il est démontrable à partir du cours fourni.",
          reviewPrompt,
          0.1
        );
        if (rawRev) {
          const rv = repairAndParseQuizJson(rawRev);
          if (rv?.verdict === "fix" && Array.isArray(rv.issues)) issues = rv.issues.slice(0, 8);
        }
      } catch {
        issues = [];
      }
      if (issues.length === 0) break;

      onProgress({ phase: "adjudication", message: `Bloc ${i + 1}/${total} — vérification des remarques du relecteur`, current: i, total });
      const adjPrompt = `COURS (référence unique) :
${courseText.slice(0, 14000)}

BLOC ACTUEL :
${JSON.stringify(blockToJsonForReview(accepted))}

REMARQUES DU RELECTEUR :
${JSON.stringify(issues)}

Pour chaque remarque : revérifie dans le cours. Si elle est fondée, corrige la question (énoncé, propositions, clé, justification). Si elle n'est pas fondée, maintiens la question telle quelle.
Renvoie le bloc COMPLET corrigé, au même schéma que la rédaction initiale :
${schemaFor(spec)}`;
      const rawAdj = await callDawiaEngineRaw("dawia2", system, adjPrompt, 0.25);
      if (!rawAdj) break;
      try {
        const adjParsed = repairAndParseQuizJson(rawAdj);
        const v2 = validateBlock(adjParsed, spec, lessons.map((l) => l.id), style, memorySets, blockId);
        if (v2.block) accepted = v2.block;
        else break;
      } catch {
        break;
      }
    }

    blocks.push(accepted);
    accepted.items.forEach((it) => {
      newStems.push(it.stem);
      memorySets.push(new Set(significantTokens(it.stem)));
    });
    if (accepted.vignette) {
      newStems.push(accepted.vignette.slice(0, 200));
      memorySets.push(new Set(significantTokens(accepted.vignette.slice(0, 240))));
    }
  }

  // Numérotation continue finale
  let n = 0;
  blocks.forEach((b) =>
    b.items.forEach((it) => {
      n++;
      it.number = n;
      it.id = `i${n}`;
    })
  );
  if (blocks.length > 0) saveMemory(memKey, newStems.map((s) => s.slice(0, 220)));
  onProgress({ phase: "termine", message: "Épreuve assemblée", current: total, total });
  return { blocks, warnings };
}

// ----------------------------------------------------------------------------
// 10. NOTATION
// ----------------------------------------------------------------------------

export function isItemCorrect(item: EBItem, answer: string[] | undefined): boolean {
  if (!answer || answer.length === 0 || item.correct.length === 0) return false;
  const a = [...answer].sort().join("");
  const c = [...item.correct].sort().join("");
  return a === c;
}

export function computeScore(blocks: EBBlock[], answers: Record<string, string[]>) {
  let found = 0;
  let wrong = 0;
  let total = 0;
  let answered = 0;
  blocks.forEach((b) =>
    b.items.forEach((it) => {
      if (it.format === "QNS") return;
      total++;
      const a = answers[it.id];
      if (a && a.length > 0) {
        answered++;
        if (isItemCorrect(it, a)) found++;
        else wrong++;
      }
    })
  );
  return { found, wrong, total, answered, remaining: total - answered };
}

export function sessionToPdfQuestions(session: ExamSession) {
  const out: {
    question: string;
    qcmType: string;
    options: { label: string; text: string; isCorrect: boolean }[];
    explanation?: string;
  }[] = [];
  session.blocks.forEach((b) =>
    b.items.forEach((it, idx) => {
      const parts: string[] = [];
      if (b.kind === "CAS_CLINIQUE" && idx === 0) parts.push(`${b.header || "Cas clinique"} — ${b.vignette || ""}`);
      if (it.lead) parts.push(it.lead);
      parts.push(it.stem);
      if (it.format === "JUMELAGE" && it.statements)
        parts.push(`1) ${it.statements[0]}  PARCE QUE  2) ${it.statements[1]}`);
      else if (it.statements) parts.push(it.statements.map((s, i) => `${i + 1}. ${s}`).join("\n"));
      out.push({
        question: parts.join("\n\n"),
        qcmType: it.format === "COMPLEMENT_MULTIPLE" ? "classique" : it.format.toLowerCase(),
        options: it.options.map((o) => ({ label: o.letter, text: o.text, isCorrect: it.correct.includes(o.letter) })),
        explanation: it.explanation,
      });
    })
  );
  return out;
}

// ----------------------------------------------------------------------------
// 11. PERSISTANCE
// ----------------------------------------------------------------------------

export const SESSIONS_KEY = "dawjang_examens_blancs_v2";
const LEGACY_KEYS = ["dawjang_examens_blancs_v1"];

export function loadSessions(): ExamSession[] {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ExamSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn("[examenBlancEngine] Sauvegarde des sessions impossible :", err);
  }
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return `${pad(d.getDate())} ${month} à ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}
