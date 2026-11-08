// src/lib/flashcards/text.ts
// Nettoyage du texte des cours et contrôle qualité des cartes.
// Objectif : ne plus jamais produire de phrases coupées, mélangées ou tronquées.

const STOPWORDS = new Set(
  (
    "le la les un une des du de d l au aux et ou en dans par pour sur sous avec sans " +
    "ce cet cette ces son sa ses leur leurs est sont être a ont avoir qui que quoi dont " +
    "ne pas plus moins très tout tous toute toutes il elle ils elles on nous vous se sa " +
    "lors entre chez comme mais donc car si aussi ainsi peut peuvent doit doivent faire " +
    "selon après avant cours chapitre partie objectif objectifs"
  ).split(/\s+/)
);

export function stripMarkdown(raw: string): string {
  return (raw || "")
    .replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/gi, "$1")
    .replace(/\{\{|\}\}/g, "")
    .replace(/\bc\d+::/gi, "")
    .replace(/\bg\/dl\b/gi, "g/dL")
    .replace(/\bmg\/dl\b/gi, "mg/dL")
    .replace(/\bmmol\/l\b/gi, "mmol/L")
    .replace(/\bui\/l\b/gi, "UI/L")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Si une carte (ancienne en cache ou renvoyée par l'IA) contient de la syntaxe Anki {{c1::...}}
 * ou si son recto est une phrase déclarative à trous, la convertit en :
 * - Recto : une vraie question médicale claire et bien posée, sans aucun crochet/accolade/c1::
 * - Verso : la phrase complète et propre avec ses vraies valeurs (ex. 13 g/dL et 12 g/dL)
 */
export function repairClozeAndFormatCard(
  rawQuestion: string,
  rawAnswer: string,
  rawCloze?: string
): { question: string; answer: string } {
  const hasClozeSyntax =
    /\{\{c\d+::|\bc\d+::|\[\.\.\.\]|\[…\]/i.test(rawQuestion || "") ||
    /\{\{c\d+::|\bc\d+::/i.test(rawCloze || "") ||
    /\{\{c\d+::|\bc\d+::/i.test(rawAnswer || "");

  const cleanQ = stripMarkdown(rawQuestion || "");
  const cleanA = stripMarkdown(rawAnswer || "");
  const cleanCloze = stripMarkdown(rawCloze || "");

  if (!hasClozeSyntax && /\?$/.test(cleanQ)) {
    return { question: cleanQ, answer: cleanA || cleanCloze };
  }

  if (hasClozeSyntax) {
    // La phrase complète restituée devient la réponse claire au Verso
    const fullSentence =
      cleanCloze.length >= cleanQ.length ? cleanCloze : cleanQ.length >= 25 ? cleanQ : cleanA;

    // On construit une vraie question médicale claire au Recto à partir du sujet de la phrase
    const defMatch = fullSentence.match(
      /^(?:(Les|Le|La|L'|Une|Un)(?:\s+|(?<=')))?([A-ZÀ-ÖØ-Þa-zà-ÿ][^,.:;()]{2,55}?)\s+(se définit|se définissent|est défini|est définie|correspond|désigne|est|sont|se caractérise|repose|nécessite|associe|entraîne)/i
    );

    let formulatedQuestion = "";
    if (defMatch) {
      const art = (defMatch[1] || "").trim();
      const subj = defMatch[2].trim();
      const rawSubj = art ? (art.endsWith("'") ? `${art}${subj}` : `${art} ${subj}`) : subj;
      const subjectLabel = String(rawSubj || "").toLowerCase();
      if (/\d+\s*(?:g\/dL|mg\/dL|mmol\/L|%|mmHg|UI\/L|ans|jours|heures)/i.test(fullSentence)) {
        formulatedQuestion = `Comment se définit ${subjectLabel} et quelles sont les valeurs seuils de référence selon le cours ?`;
      } else {
        formulatedQuestion = `Quelle est la définition précise ou la règle clinique concernant ${subjectLabel} selon le cours ?`;
      }
    } else {
      const firstWords = fullSentence.split(/[,:;—]/)[0].trim().slice(0, 75);
      formulatedQuestion = `Quelle est la règle clinique et les valeurs exactes à retenir concernant : « ${firstWords} » ?`;
    }

    return {
      question: capitalize(formulatedQuestion),
      answer: ensureEndPunctuation(capitalize(fullSentence)),
    };
  }

  return {
    question: cleanQ,
    answer: cleanA,
  };
}

/**
 * Normalise un texte extrait d'un PDF / Word / diaporama :
 * ligatures, césures, retours à la ligne au milieu des phrases, puces.
 */
export function cleanCourseText(raw: string): string {
  if (!raw) return "";
  let t = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[“”]/g, '"')
    // Césure en fin de ligne : « infec-\ntion » → « infection »
    .replace(/([a-zà-ÿ])-\n([a-zà-ÿ])/g, "$1$2")
    // Puces → nouvelle ligne explicite
    .replace(/\s*[•▪➢►◦●■□✓✔]\s*/g, "\n• ")
    .replace(/[ \t]+/g, " ");

  // Recolle les lignes coupées au milieu d'une phrase
  const lines = t.split("\n").map((l) => l.trim());
  const merged: string[] = [];
  for (const line of lines) {
    if (!line) {
      merged.push("");
      continue;
    }
    // Lignes parasites : numéros de page, pieds de diapo, en-têtes administratifs d'université
    if (/^(page\s*)?\d{1,3}(\s*\/\s*\d{1,3})?$/i.test(line)) continue;
    if (
      /^(université|faculté|fmpos|ucad|département|service\s+de|année\s+académique|année\s+universitaire|cours\s+préparé\s+par|présenté\s+par|enseignant|professeur\s+|pr\.?\s+|dr\.?\s+|diapo(?:sitive)?\s*\d*)/i.test(
        line
      ) &&
      line.length < 130
    ) {
      continue;
    }
    const prev = merged[merged.length - 1];
    const prevOpen =
      prev && prev.length > 0 && !/[.!?:;]$/.test(prev) && !prev.startsWith("• ");
    const startsLower = /^[a-zà-ÿ(]/.test(line);
    if (prevOpen && startsLower) {
      merged[merged.length - 1] = `${prev} ${line}`;
    } else {
      merged.push(line);
    }
  }
  t = merged.join("\n").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/** Découpe en phrases complètes, sans jamais couper sur une lettre accentuée */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  text.split(/\n+/).forEach((block) => {
    const b = block.replace(/^•\s*/, "").trim();
    if (!b) return;
    b.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"(])/).forEach((s) => {
      const clean = s.trim();
      if (clean) out.push(clean);
    });
  });
  return out;
}

export function normalizeForKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentWords(s: string): string[] {
  return normalizeForKey(s)
    .split(" ")
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/** Similarité de Jaccard entre deux textes (0 → 1) */
export function similarity(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}

export function makeContentKey(question: string, answer: string): string {
  const q = contentWords(question).slice(0, 8).sort().join("-");
  const a = contentWords(answer).slice(0, 8).sort().join("-");
  return `${q}|${a}`;
}

/** Une phrase est-elle complète et lisible (pas un fragment de diapo) ? */
export function isReadableSentence(s: string): boolean {
  const t = (s || "").trim();
  if (t.length < 25 || t.length > 420) return false;
  if (!/^[A-ZÀ-ÖØ-Þ0-9«"(]/.test(t)) return false; // commence au milieu d'un mot
  const letters = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters / t.length < 0.6) return false;
  if (contentWords(t).length < 3) return false;
  if (/\[COURS #|lorem ipsum|présenté par|plan du cours/i.test(t)) return false;
  return true;
}

/**
 * Détecte une carte abîmée ou mal formulée pour la purger automatiquement :
 *  - Fragments coupés en plein vol (« privilégier soit une. »)
 *  - Formulations mécaniques non pédagogiques (« 2. Indications — citez les 2 éléments »)
 *  - Titres de section orphelins ou étiquettes (« Point clé #1 », « 5 éléments à connaître : »)
 *  - Fragments OCR/ligature corrompus (« érer », « émiologiques »)
 */
export function isGarbledCard(card: {
  question?: string;
  answerSummary?: string;
  answerDetails?: string[];
  qcmPropositions?: unknown[];
}): boolean {
  const q = (card.question || "").trim();
  if (q.length < 8) return true;
  if (q.includes("[COURS #")) return true;
  if (q.includes("[…]")) return true;
  if (/point(?:s)?\s+cl[ée](?:s)?\s*#\d+/i.test(q)) return true;
  if (/université|faculté|fmpos|ann[ée]e académique|dr\.?\s+[a-z]+|pr\.?\s+[a-z]+/i.test(q)) return true;
  if (/—\s*citez\s+les\s+\d+\s+éléments/i.test(q) || /-\s*citez\s+les\s+\d+\s+éléments/i.test(q)) return true;
  if (/^\d{1,2}\s*[.)-]\s+[^\n—]{1,40}—\s*citez/i.test(q)) return true;
  if (/concernant\s*:\s*generalites\s*mi\.?/i.test(q)) return true;
  if (/^[a-zà-ÿ]{2,6}\s/.test(q) && !/^(qu|quel|quels|quelle|quelles|que|est|en|on|il|la|le|les|un|une|définir|définissez|citer|citez|décrire|décrivez|expliquer|expliquez|énoncer|indiquer)\b/i.test(q))
    return true;

  const hasQcm = Array.isArray(card.qcmPropositions) && card.qcmPropositions.length > 0;
  const a = (card.answerSummary || "").trim();
  if (!hasQcm && a.length < 2) return true;
  if (/point(?:s)?\s+cl[ée](?:s)?\s*#\d+/i.test(a)) return true;
  if (/^\d+\s+éléments?\s+à\s+connaître\s*:/i.test(a)) return true;

  const all = [a, ...(card.answerDetails || [])].join(" ");
  if (/(^|\s)(érer|émiologiques|érents|ément)\s/i.test(all)) return true;
  if (/\s\d\.$/.test(a)) return true;

  // Phrases tronquées qui se terminent sur un mot de liaison, préposition ou article pendant
  const danglingEnd = /(?:\b(?:soit|une|un|le|la|les|des|du|de|dans|par|pour|avec|sur|ou|et|à|en|d'|l'|qu'))\s*[.!?…]?$/i;
  if (danglingEnd.test(a)) return true;
  if (Array.isArray(card.answerDetails) && card.answerDetails.some((d) => danglingEnd.test((d || "").trim()))) {
    return true;
  }

  return false;
}

export function capitalize(s: string): string {
  const t = (s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function ensureEndPunctuation(s: string, mark = "."): string {
  const t = (s || "").trim();
  if (!t) return t;
  return /[.!?…:]$/.test(t) ? t : `${t}${mark}`;
}

export type CourseContentStatus = "ok" | "empty" | "placeholder" | "garbled";

/**
 * Diagnostique le texte stocké pour un cours AVANT toute génération :
 *  - « placeholder » : seul le titre a été enregistré (« Cours importé : … »)
 *  - « garbled »     : fichier binaire (PDF/DOCX/PPTX) lu comme du texte → charabia
 *  - « empty »       : quasiment aucun texte
 */
export function assessCourseContent(content: string): CourseContentStatus {
  const t = (content || "").trim();
  if (t.length < 40) return "empty";
  if (/^Cours import[ée]\s*:/i.test(t) && t.length < 200) return "placeholder";
  // eslint-disable-next-line no-control-regex
  if (/^%PDF-|^PK\u0003\u0004/.test(t)) return "garbled";

  const sample = t.slice(0, 4000);
  const readable = (sample.match(/[A-Za-zÀ-ÿ0-9\s.,;:!?'"()\-–—%°/+<>=«»…]/g) || []).length;
  const replacement = (sample.match(/\uFFFD/g) || []).length;
  // eslint-disable-next-line no-control-regex
  const control = (sample.match(/[\u0000-\u0008\u000E-\u001F]/g) || []).length;
  if (replacement / sample.length > 0.02 || control / sample.length > 0.01) return "garbled";
  if (readable / sample.length < 0.85) return "garbled";

  const words = contentWords(t);
  if (words.length < 25) return "empty";
  return "ok";
}
