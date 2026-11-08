// src/lib/flashcards/localGenerator.ts
// Moteur central de génération de Flashcards médicales :
//   • Recto : Questions cliniques bien posées ou affirmations médicales ciblées issues du cours / résumé
//   • Verso : Réponses claires, précises, structurées, sans débordement ni hors-sujet, 100 % conformes au cours
import { createNewSrsState } from "./fsrs";
import type {
  CalibratedFlashcard,
  FlashcardOriginMode,
  RawGeneratedCard,
} from "./types";
import {
  capitalize,
  cleanCourseText,
  contentWords,
  ensureEndPunctuation,
  isGarbledCard,
  isReadableSentence,
  makeContentKey,
  normalizeForKey,
  similarity,
  splitSentences,
  stripMarkdown,
} from "./text";

export interface FlashcardSourceCourse {
  id: string;
  title: string;
  subject?: string;
  content: string;
}

/** Intitulé de leçon propre (utilisé comme filtre « leçon ») */
export function formatLessonTitle(rawTitle: string): string {
  const clean = (rawTitle || "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  if (lower === "generalites mi" || lower === "généralités mi") return "Généralités — Infections";
  if (lower === "irc") return "Pneumologie — IRC";
  return capitalize(clean) || "Leçon";
}

const OBJECTIVE_VERBS: Record<string, string> = {
  définir: "Comment définit-on",
  enumerer: "Quels sont",
  énumérer: "Quels sont",
  décrire: "Décrivez avec précision",
  citer: "Citez",
  expliquer: "Comment s'explique",
  classer: "Quelle est la classification de",
  diagnostiquer: "Sur quels critères repose le diagnostic de",
  préciser: "Précisez",
  reconnaître: "Quels signes permettent de reconnaître",
  identifier: "Comment identifie-t-on",
  distinguer: "Comment distingue-t-on",
  énoncer: "Énoncez",
  analyser: "Analysez les éléments clés de",
  connaître: "Quels sont les éléments essentiels concernant",
  justifier: "Comment justifie-t-on",
  argumenter: "Quels arguments cliniques étayent",
  interpréter: "Comment interprète-t-on",
  planifier: "Quelle est la conduite à planifier pour",
  prescrire: "Quelle est la prescription recommandée pour",
  différencier: "Comment différencie-t-on",
  comparer: "Quelle est la différence clinique entre",
  lister: "Quels sont",
  donner: "Quels sont",
  indiquer: "Indiquez",
};

const OBJECTIVE_RE = new RegExp(
  `^(?:objectif\\s*\\d*\\s*[:.-]?\\s*)?(${Object.keys(OBJECTIVE_VERBS).join("|")})\\b\\s*(.*)$`,
  "i"
);

const IMPORTANT_RE =
  /\+\+\+|urgence|urgent|vital|gravité|grave|1re intention|première intention|référence|obligatoire|contre-indiqu|toujours|jamais|systématique|indispensable|critère|seuil|triade|pathognomonique/i;
const NUMERIC_RE =
  /(?:[<>≤≥]\s*)?\d+(?:[.,]\d+)?\s*(?:%|mmHg|kPa|mg\/kg|mg|µg|g\/L|g\/l|mmol\/L|mmol\/l|mL\/kg|mL|ml|kg|g|L|UI|°C|cm|mm|heures|heure|h|jours|jour|j|semaines|semaine|mois|ans|an)\b/;

function stripNumbering(line: string): string {
  return line.replace(/^\s*(?:•|[-–*]|\d{1,2}\s*[.)°-]|[a-z]\s*\))\s*/i, "").trim();
}

function scoreImportance(text: string, base = 3): number {
  let s = base;
  if (/\+\+\+/.test(text)) s += 2;
  else if (IMPORTANT_RE.test(text)) s += 1;
  if (NUMERIC_RE.test(text)) s += 0.5;
  return Math.max(1, Math.min(5, Math.round(s)));
}

/**
 * Formate une phrase de verso pour qu'elle soit claire, précise et sans débordement
 */
function formatConciseVerso(text: string, maxLen = 220): string {
  let clean = stripMarkdown(text)
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:•|[-–*]|\d+[.)])\s*/, "")
    .trim();
  if (!clean) return "";
  if (clean.length > maxLen) {
    const sub = clean.slice(0, maxLen);
    const clauseBreak = Math.max(
      sub.lastIndexOf("; "),
      sub.lastIndexOf(", "),
      sub.lastIndexOf(" — ")
    );
    if (clauseBreak > maxLen * 0.55) {
      clean = sub.slice(0, clauseBreak).trim();
    } else {
      const spaceBreak = sub.lastIndexOf(" ");
      clean = (spaceBreak > 60 ? sub.slice(0, spaceBreak) : sub).trim();
    }
  }
  return ensureEndPunctuation(capitalize(clean));
}

/**
 * Transforme un objectif pédagogique du cours en question claire et bien posée au Recto
 */
function objectiveToQuestion(line: string): string | null {
  const cleanedLine = stripNumbering(line);
  const m = cleanedLine.match(OBJECTIVE_RE);
  if (!m) return null;
  const rawVerb = String(m[1] || "").toLowerCase();
  const starter = OBJECTIVE_VERBS[rawVerb] || capitalize(rawVerb);
  const rest = m[2].replace(/\s+\d+\.?$/, "").replace(/[.;:?]+$/, "").trim();
  if (rest.length < 6) return null;

  if (/\bet\s+(?:l'|les?\s+|la\s+)?[a-zà-ÿ]+(?:er|ir|re)\b/i.test(rest)) {
    return `Question d'objectif : ${capitalize(rawVerb)} ${rest} — quels sont les éléments précis à retenir selon le cours ?`;
  }

  const isInterrogative = /^(Comment|Quels|Quelle|Sur quels)/i.test(starter);
  return isInterrogative ? `${starter} ${rest} ?` : `${starter} ${rest}.`;
}

interface ListBlock {
  heading: string;
  items: string[];
}

function extractListBlocks(cleaned: string): ListBlock[] {
  const lines = cleaned.split("\n").map((l) => l.trim());
  const blocks: ListBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i];
    if (!head || head.startsWith("• ")) continue;
    const isHeading = /:$/.test(head) || (head.length <= 85 && !/[.!?]$/.test(head));
    if (!isHeading) continue;
    const items: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^(•|\d{1,2}\s*[.)-])\s*/.test(lines[j])) {
      const item = stripNumbering(lines[j]).replace(/[;,.]+$/, "");
      if (item.length >= 4 && item.length <= 170) items.push(item);
      j++;
    }
    if (items.length >= 2 && items.length <= 7) {
      const isMeta =
        /objectif|plan du cours|sommaire|table des mati|bibliographie/i.test(head) ||
        items.filter((it) => OBJECTIVE_RE.test(it)).length >= items.length / 2;
      if (!isMeta) {
        blocks.push({ heading: head.replace(/:$/, "").trim(), items });
      }
    }
  }
  return blocks;
}

/**
 * Construit une carte de définition médicale (Recto : Question précise, Verso : Définition conforme au cours)
 */
function buildDefinitionCard(sentence: string): RawGeneratedCard | null {
  const m = sentence.match(
    /^(?:(Les|Le|La|L'|Une|Un)(?:\s+|(?<=')))?([A-ZÀ-ÖØ-Þa-zà-ÿ][^,.:;()]{2,60}?)\s+(est|sont|se définit|se définissent|correspond|correspondent|désigne|désignent|représente|se caractérise par)\s+(.{15,240})$/i
  );
  if (!m) return null;
  const article = (m[1] || "").toLowerCase();
  const term = m[2].trim();
  if (term.split(/\s+/).length > 8 || contentWords(term).length === 0) return null;
  if (/^(il|elle|ils|elles|ce|cela|cette|ces|on|nous)\b/i.test(term)) return null;

  const plural =
    article === "les" || /sont|définissent|correspondent|désignent/i.test(m[3]);
  let question: string;
  if (/se caractérise par/i.test(m[3])) {
    question = `Par quels éléments cliniques ou biologiques se caractérise ${article ? `${article} ` : ""}${term} selon le cours ?`;
  } else if (plural) {
    question = `Comment définit-on ${article ? `${article} ` : ""}${term} dans le cours ?`;
  } else if (article === "l'") {
    question = `Quelle est la définition précise de l'${term} selon le cours ?`;
  } else if (article === "un" || article === "une") {
    question = `Qu'est-ce qu'${article} ${term} sur le plan médical ?`;
  } else {
    question = `Quelle est la définition exacte de ${article ? `${article} ` : ""}${term} ?`;
  }

  return {
    format: "definition",
    question: capitalize(question),
    answer: formatConciseVerso(sentence, 210),
    details: [],
    importance: scoreImportance(sentence, 4),
    sourceExcerpt: sentence,
  };
}

/**
 * Construit une carte Question Clinique ou Affirmation Médicale ciblée à partir d'un énoncé du cours
 * (Remplace définitivement les anciens textes à trous aléatoires `[…]`)
 */
function buildClinicalQuestionOrAffirmationCard(
  sentence: string,
  relatedDetails: string[]
): RawGeneratedCard | null {
  const clean = stripMarkdown(sentence).trim();
  if (clean.length < 35 || clean.length > 260) return null;

  // Extraction du sujet clinique principal en tête de phrase
  const subjMatch = clean.match(
    /^(?:Dans|En cas de|Au cours de|Concernant|Pour|Lors de)?\s*(?:(les|le|la|l'|un|une)\s+)?([A-ZÀ-ÖØ-Þa-zà-ÿ][^,.:;()]{3,65}?)\s*(?:,|\s+(?:repose|nécessite|impose|entraîne|provoque|associe|comprend|inclut|se manifeste|se traduit|est indiqué|est contre-indiqué|doit|peut))/i
  );

  let question = "";
  const lower = clean.toLowerCase();

  if (
    /diagnostic|examen de référence|confirmation|bilan|imagerie|biologie/i.test(lower) &&
    subjMatch
  ) {
    const subj = `${subjMatch[1] ? `${subjMatch[1]} ` : ""}${subjMatch[2]}`.trim();
    question = `Sur quels éléments repose l'évaluation ou le diagnostic concernant ${subj} ?`;
  } else if (
    /traitement|prise en charge|thérapeutique|première intention|antibiothérapie|urgence|contre-indiqu/i.test(
      lower
    ) &&
    subjMatch
  ) {
    const subj = `${subjMatch[1] ? `${subjMatch[1]} ` : ""}${subjMatch[2]}`.trim();
    question = `Quelle est la règle de prise en charge ou de traitement concernant ${subj} selon le cours ?`;
  } else if (
    /signe|symptôme|manifestation|clinique|douleur|fièvre|syndrome|triade/i.test(lower) &&
    subjMatch
  ) {
    const subj = `${subjMatch[1] ? `${subjMatch[1]} ` : ""}${subjMatch[2]}`.trim();
    question = `Quelles sont les manifestations cliniques ou sémiologiques associées à ${subj} ?`;
  } else if (
    /facteur|cause|étiologie|transmission|mécanisme|physiopathologie|risque/i.test(lower) &&
    subjMatch
  ) {
    const subj = `${subjMatch[1] ? `${subjMatch[1]} ` : ""}${subjMatch[2]}`.trim();
    question = `Quels sont les mécanismes, modes de transmission ou facteurs impliqués dans ${subj} ?`;
  } else {
    // Affirmation clinique issue du cours dont l'étudiant doit restituer le mécanisme, le critère ou la précision exacte
    const words = contentWords(clean).slice(0, 4);
    if (words.length < 2) return null;
    const clauseParts = clean.split(/\s*(?:car|parce que|en raison de|grâce à|notamment|à savoir|:|—)\s*/i);
    if (clauseParts.length >= 2 && clauseParts[0].length >= 20 && clauseParts[1].length >= 12) {
      question = `Affirmation du cours : « ${clauseParts[0].trim()} » — Précisez et justifiez cet énoncé à partir du cours.`;
    } else if (NUMERIC_RE.test(clean)) {
      const masked = clean.replace(NUMERIC_RE, "[valeur / seuil du cours]");
      question = `Affirmation clinique : « ${masked} » — Quelle est la valeur exacte et la règle correspondante dans le cours ?`;
    } else {
      return null;
    }
  }

  return {
    format: "qa",
    question: capitalize(question),
    answer: formatConciseVerso(clean, 210),
    details: relatedDetails
      .slice(0, 3)
      .map((d) => formatConciseVerso(d, 150))
      .filter(Boolean),
    importance: scoreImportance(clean, 3),
    sourceExcerpt: clean,
  };
}

/** Extrait toutes les cartes candidates d'un cours avec contrôle strict Recto/Verso */
export function extractCandidateCards(content: string): RawGeneratedCard[] {
  const cleaned = cleanCourseText(content);
  if (!cleaned) return [];

  const rawLines = cleaned
    .split("\n")
    .map((l) => stripNumbering(l))
    .filter(Boolean);
  const objectiveLines = rawLines.filter((l) => OBJECTIVE_RE.test(l));
  const sentences = splitSentences(cleaned)
    .map((s) => stripMarkdown(s))
    .filter((s) => isReadableSentence(s) && !OBJECTIVE_RE.test(stripNumbering(s)));
  const listBlocks = extractListBlocks(cleaned);

  const out: RawGeneratedCard[] = [];

  // 1. Objectifs pédagogiques → Question explicite au Recto, réponse concise et fidèle au Verso
  objectiveLines.forEach((obj) => {
    const prompt = objectiveToQuestion(obj);
    if (!prompt) return;
    const objBody = stripNumbering(obj).replace(OBJECTIVE_RE, "$2");
    const objWords = new Set(contentWords(objBody));
    if (objWords.size === 0) return;

    const list = listBlocks.find((b) => similarity(b.heading, objBody) >= 0.28);
    if (list) {
      out.push({
        format: "list",
        question: prompt,
        answer: formatConciseVerso(list.heading, 160),
        details: list.items
          .slice(0, 4)
          .map((i) => formatConciseVerso(i, 150))
          .filter(Boolean),
        importance: 5,
        sourceExcerpt: `${list.heading} : ${list.items.slice(0, 4).join(" ; ")}`,
        objective: obj,
      });
      return;
    }

    const scored = sentences
      .map((s, i) => {
        const w = contentWords(s);
        const overlap = w.filter((x) => objWords.has(x)).length;
        return { s, i, score: overlap / objWords.size };
      })
      .filter((x) => x.score >= 0.28)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .sort((a, b) => a.i - b.i);

    if (scored.length === 0) return;
    out.push({
      format: "qa",
      question: prompt,
      answer: formatConciseVerso(scored[0].s, 210),
      details: scored
        .slice(1, 4)
        .map((x) => formatConciseVerso(x.s, 150))
        .filter(Boolean),
      importance: 5,
      sourceExcerpt: scored[0].s,
      objective: obj,
    });
  });

  // 2. Blocs structurés du cours (tableaux cliniques, critères, classifications)
  listBlocks.forEach((block) => {
    const headingClean = stripMarkdown(block.heading).trim();
    if (headingClean.length < 5 || headingClean.length > 85) return;
    const question = /\?$/.test(headingClean)
      ? capitalize(headingClean)
      : `Quels sont les éléments constitutifs de : « ${capitalize(headingClean)} » selon le cours ?`;

    out.push({
      format: "list",
      question,
      answer: formatConciseVerso(block.items[0], 180),
      details: block.items
        .slice(1, 4)
        .map((i) => formatConciseVerso(i, 150))
        .filter(Boolean),
      importance: scoreImportance(block.items.join(" "), 4),
      sourceExcerpt: `${headingClean} : ${block.items.slice(0, 4).join(" ; ")}`,
    });
  });

  // 3. Définitions médicales et questions/affirmations cliniques ciblées (sans aucun trou aléatoire `[…]`)
  sentences.forEach((s, idx) => {
    const def = buildDefinitionCard(s);
    if (def) {
      // Cherche 1 ou 2 phrases adjacentes strictement sur le même concept pour préciser le verso sans hors-sujet
      const related = sentences
        .slice(idx + 1, idx + 3)
        .filter((next) => similarity(s, next) >= 0.25 && next.length <= 180);
      def.details = related.slice(0, 2).map((r) => formatConciseVerso(r, 150));
      out.push(def);
      return;
    }

    const related = sentences
      .slice(idx + 1, idx + 3)
      .filter((next) => similarity(s, next) >= 0.28 && next.length <= 180);
    const clinicalCard = buildClinicalQuestionOrAffirmationCard(s, related);
    if (clinicalCard) {
      out.push(clinicalCard);
    }
  });

  // Déduplication interne et purge stricte de tout format bancal ou hors-sujet
  const seen = new Set<string>();
  return out.filter((c) => {
    if (
      isGarbledCard({
        question: c.question,
        answerSummary: c.answer,
        answerDetails: c.details,
      })
    ) {
      return false;
    }
    const key = makeContentKey(c.question, c.answer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let idCounter = 0;
function uid(prefix: string) {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** Convertit une carte brute (locale ou IA) en carte DawJang complète, concise et calibrée */
export function rawToFlashcard(
  raw: RawGeneratedCard,
  meta: {
    course: FlashcardSourceCourse;
    mode: FlashcardOriginMode;
    customNode: string;
    rank: number;
    generator: "ai" | "local";
  }
): CalibratedFlashcard {
  const now = Date.now();
  const question = stripMarkdown(raw.question);
  const answer = formatConciseVerso(raw.answer, 220);
  const cleanDetails = (raw.details || [])
    .map((d) => formatConciseVerso(d, 155))
    .filter((d) => d.length > 3 && normalizeForKey(d) !== normalizeForKey(answer))
    .slice(0, 4);

  return {
    id: uid(meta.generator === "ai" ? "fc-ai" : "fc-loc"),
    courseId: meta.course.id,
    lessonTitle: formatLessonTitle(meta.course.title),
    subject: meta.course.subject || "Cours",
    customNode: meta.customNode,
    originMode: meta.mode,
    relevanceRank: meta.rank,
    question,
    answerSummary: answer,
    answerDetails: cleanDetails,
    format: raw.format === "cloze" ? "qa" : raw.format,
    clozeText: undefined,
    sourceExcerpt: raw.sourceExcerpt
      ? stripMarkdown(raw.sourceExcerpt).slice(0, 260)
      : undefined,
    importance: raw.importance,
    contentKey: makeContentKey(question, answer),
    createdAt: now,
    generator: meta.generator,
    intervalDays: 0,
    repetitionCount: 0,
    status: "new",
    srs: createNewSrsState(now),
  };
}

/** Une carte est-elle un doublon (exact ou quasi) d'une carte existante du même cours ? */
export function isDuplicateOf(
  candidate: { question: string; answer: string },
  existing: CalibratedFlashcard[]
): boolean {
  const key = makeContentKey(candidate.question, candidate.answer);
  const qNorm = normalizeForKey(candidate.question);
  return existing.some(
    (c) =>
      c.contentKey === key ||
      normalizeForKey(c.question) === qNorm ||
      similarity(
        `${c.question} ${c.answerSummary}`,
        `${candidate.question} ${candidate.answer}`
      ) >= 0.72
  );
}

/**
 * Génère un NOUVEAU lot de cartes pour un cours, sans jamais reproduire
 * les cartes déjà présentes dans la banque (anti-répétition à la source).
 */
export function generateLocalFlashcards(
  course: FlashcardSourceCourse,
  mode: "objectives" | "relevance",
  customNode: string,
  existingForCourse: CalibratedFlashcard[],
  count = 12
): CalibratedFlashcard[] {
  const candidates = extractCandidateCards(course.content).filter(
    (c) => !isDuplicateOf(c, existingForCourse)
  );

  const jitter = () => Math.random() * 0.6;
  const ordered =
    mode === "objectives"
      ? [...candidates].sort((a, b) => {
          const ao = a.objective ? 1 : 0;
          const bo = b.objective ? 1 : 0;
          if (ao !== bo) return bo - ao;
          return b.importance + jitter() - (a.importance + jitter());
        })
      : [...candidates].sort(
          (a, b) => b.importance + jitter() - (a.importance + jitter())
        );

  const picked: RawGeneratedCard[] = [];
  const pool = [...ordered];
  while (picked.length < count && pool.length > 0) {
    const lastTwo = picked.slice(-2).map((p) => p.format);
    const idx = pool.findIndex(
      (c) => !(lastTwo.length === 2 && lastTwo.every((f) => f === c.format))
    );
    picked.push(pool.splice(idx >= 0 ? idx : 0, 1)[0]);
  }

  return picked.map((raw, i) =>
    rawToFlashcard(raw, {
      course,
      mode,
      customNode,
      rank: existingForCourse.length + i + 1,
      generator: "local",
    })
  );
}

/** Nombre de notions encore non couvertes dans un cours (pour l'interface) */
export function countRemainingNotions(
  course: FlashcardSourceCourse,
  existingForCourse: CalibratedFlashcard[]
): number {
  return extractCandidateCards(course.content).filter(
    (c) => !isDuplicateOf(c, existingForCourse)
  ).length;
}
