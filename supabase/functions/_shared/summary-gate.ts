// supabase/functions/_shared/summary-gate.ts
// Nettoyage du texte source + CONTRÔLE QUALITÉ d'une fiche générée.
// Fonctions pures (aucune dépendance) : testables en local.

export type Verb = "definir" | "citer" | "decrire" | "interpreter" | "traiter" | "autre";

export interface ObjectiveBlock {
  n: number;
  verb: Verb;
  statement: string;
  lead: string;
  points: { label?: string | null; text: string }[];
  table?: { caption?: string | null; headers: string[]; rows: string[][] } | null;
  numbers?: { label: string; value: string }[] | null;
  exam_tip?: string | null;
  slides: number[];
  coverage: "full" | "partial" | "absent_from_course";
}

export interface SummaryDoc {
  schema_version: 2;
  mode: "objectives" | "harvard" | "flash";
  title: string;
  objectives: ObjectiveBlock[];
  qa_matrix?: { q: string; a: string; slide?: number | null }[] | null;
  comparison?: { caption?: string | null; headers: string[]; rows: string[][] } | null;
  vignette?: { presentation: string; workup: string; management: string } | null;
  flash?: { definition: string; key_points: string[]; thresholds: string[]; pitfalls: string[] } | null;
}

/** Mots (accents, chiffres, tirets, apostrophes compris). */
export const wc = (s: string): number =>
  (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) ?? []).length;

/** Répare les glyphes que les PDF de PowerPoint/Word corrompent à l'extraction. */
export function cleanSourceText(raw: string): string {
  return raw
    .replace(/[\uE000-\uF8FF]/g, "• ") // puces Wingdings (❑ ❖ ➢) lues comme « q », « v », « Ø »
    .replace(/˃/g, ">")
    .replace(/˂/g, "<")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texte découpé en diapositives : « --- Diapositive N --- » (pages séparées par \f ou déjà balisées). */
export function withSlideMarkers(pagesOrText: string[] | string): string {
  const pages = Array.isArray(pagesOrText) ? pagesOrText : pagesOrText.split("\f");
  return pages
    .map((p, i) => ({ p: cleanSourceText(p), i: i + 1 }))
    .filter((x) => x.p.length > 0 || true) // on garde les pages vides : elles sont souvent des images à lire
    .map((x) => `--- Diapositive ${x.i} ---\n${x.p || "[page sans texte : contenu image/tableau — à lire sur le PDF]"}`)
    .join("\n\n");
}

/** Texte de la diapositive « Objectifs » (méta-diapositive : jamais une source de réponse). */
export function objectivesSegment(text: string): string {
  const start = text.search(/objectifs?\b/i);
  if (start < 0) return "";
  let seg = text.slice(start, start + 1800);
  const stop = seg.slice(9).search(/\bPlan\b|--- Diapositive \d+ ---/);
  if (stop >= 0) seg = seg.slice(0, stop + 9);
  return seg;
}

export interface SourceStats { slides: number; words: number; wordsPerSlide: number; emptySlides: number; poor: boolean }
/** Détecte un cours « creux » : PDF fait d'images dont il ne reste que quelques titres. */
export function sourceStats(markedText: string): SourceStats {
  const parts = markedText.split(/--- Diapositive \d+ ---/).slice(1);
  const slides = parts.length || 1;
  const words = wc(markedText.replace(/--- Diapositive \d+ ---/g, " ").replace(/\[page sans texte[^\]]*\]/g, " "));
  const emptySlides = parts.filter((p) => wc(p.replace(/\[page sans texte[^\]]*\]/g, "")) < 4).length;
  const wordsPerSlide = words / slides;
  return { slides, words, wordsPerSlide, emptySlides, poor: words < 120 || wordsPerSlide < 14 || emptySlides / slides > 0.5 };
}

/** Nombre d'objectifs numérotés dans le cours, tolérant : « 1- », « 2) », « 3 Citer » (sans tiret !). */
export function expectedObjectiveCount(text: string): number {
  const start = text.search(/objectifs?\b/i);
  if (start < 0) return 0;
  let seg = text.slice(start + 9, start + 1800);
  const stop = seg.search(/\bPlan\b|--- Diapositive \d+ ---/);
  if (stop >= 0) seg = seg.slice(0, stop);
  const re = /(?:^|[\s:;.])(\d{1,2})\s*[-–.):]?\s+(?=[A-ZÉÈÀ][a-zéèêàçùôî])/g;
  const seen: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) seen.push(Number(m[1]));
  let n = 0;
  while (seen.includes(n + 1)) n++;
  return n;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function shingles(text: string, k: number): Set<string> {
  const w = norm(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
}

/** Part des séquences de 7 mots de la fiche qui existent telle quelle dans le cours (1 = copie pure). */
export function verbatimRatio(summaryText: string, courseText: string): number {
  const s = shingles(summaryText, 7);
  if (s.size === 0) return 0;
  const c = shingles(courseText, 7);
  let hit = 0;
  s.forEach((x) => c.has(x) && hit++);
  return hit / s.size;
}

export function objectiveText(o: ObjectiveBlock): string {
  const t = o.table ? [o.table.headers.join(" "), ...o.table.rows.map((r) => r.join(" "))].join(" ") : "";
  return [o.lead, ...o.points.map((p) => `${p.label ?? ""} ${p.text}`), t].join(" ");
}

export function docText(d: SummaryDoc): string {
  const parts: string[] = [];
  d.objectives?.forEach((o) => parts.push(objectiveText(o)));
  d.qa_matrix?.forEach((q) => parts.push(q.q, q.a));
  if (d.comparison) parts.push(d.comparison.headers.join(" "), ...d.comparison.rows.map((r) => r.join(" ")));
  if (d.vignette) parts.push(d.vignette.presentation, d.vignette.workup, d.vignette.management);
  if (d.flash) parts.push(d.flash.definition, ...d.flash.key_points, ...d.flash.thresholds, ...d.flash.pitfalls);
  return parts.join(" ");
}

const jaccard = (a: string, b: string) => {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let i = 0;
  A.forEach((x) => B.has(x) && i++);
  return i / (A.size + B.size - i);
};

export interface GateResult {
  ok: boolean;
  errors: string[];
  metrics: { courseWords: number; summaryWords: number; ratio: number; verbatim: number; expectedObjectives: number; foundObjectives: number };
}

/** budgetRatio : part maximale des mots du cours (0.25 essentielle · 0.35 équilibrée · 0.5 détaillée). */
export function validateSummary(doc: SummaryDoc, courseText: string, budgetRatio = 0.35): GateResult {
  const errors: string[] = [];
  const courseWords = wc(courseText);
  const summaryText = docText(doc);
  const summaryWords = wc(summaryText);
  const expected = expectedObjectiveCount(courseText);
  const found = doc.objectives?.length ?? 0;
  const isObj = doc.mode === "objectives";

  if (isObj) {
    if (expected > 0 && found !== expected)
      errors.push(`Le cours liste ${expected} objectifs numérotés (attention à « 3 Citer… » sans tiret) mais la fiche en contient ${found}.`);
    doc.objectives.forEach((o, i) => {
      if (o.n !== i + 1) errors.push(`Numérotation incohérente à la position ${i + 1} (n=${o.n}).`);
      if (!o.statement?.trim()) errors.push(`Objectif ${o.n} : énoncé vide.`);
      if (wc(o.statement ?? "") > 45 || (o.statement?.match(/\b\d\s*[-–.)]\s+[A-ZÉ]/g) ?? []).length > 1)
        errors.push(`Objectif ${o.n} : l'énoncé contient plusieurs objectifs ou du texte parasite.`);
      if (o.coverage !== "absent_from_course" && !o.lead?.trim() && o.points.length === 0 && !o.table)
        errors.push(`Objectif ${o.n} : aucune réponse alors qu'il est marqué traité.`);
      if (o.verb === "definir" && (wc(o.lead) > 60 || o.points.length > 3))
        errors.push(`Objectif ${o.n} (Définir) : une seule définition courte attendue (≤ 60 mots, ≤ 3 précisions chiffrées).`);
      if (o.verb === "citer" && o.points.length < 2 && o.coverage !== "absent_from_course")
        errors.push(`Objectif ${o.n} (Citer/Énumérer) : la liste exacte des éléments est attendue (≥ 2 puces).`);
    });
    const meta = objectivesSegment(courseText);
    if (meta) {
      const bad: number[] = [];
      doc.objectives.forEach((o) => {
        if (o.coverage === "absent_from_course") return;
        const ans = [o.lead, ...o.points.map((p) => p.text)].join(" ");
        if (jaccard(ans, meta) > 0.4 || (wc(ans) > 12 && verbatimRatio(ans, meta) > 0.5)) bad.push(o.n);
      });
      if (bad.length) errors.push(`Objectif(s) ${bad.join(", ")} : la réponse recopie la diapositive « Objectifs » au lieu du contenu du cours (cours de fond à chercher dans Généralités, Clinique, Diagnostic, Traitement…).`);
    }
    for (let i = 0; i < found; i++)
      for (let j = i + 1; j < found; j++) {
        const a = doc.objectives[i], b = doc.objectives[j];
        if (a.coverage === "absent_from_course" || b.coverage === "absent_from_course") continue;
        if (jaccard(objectiveText(a), objectiveText(b)) > 0.55)
          errors.push(`Objectifs ${a.n} et ${b.n} : contenu quasi identique — chaque objectif doit avoir sa propre réponse.`);
      }
  }

  if (doc.mode === "harvard") {
    if ((doc.qa_matrix?.length ?? 0) < Math.max(expected, 3)) errors.push("Matrice Active-Recall trop courte : au moins une question-cible par objectif.");
    if (!doc.comparison || doc.comparison.rows.length < 2) errors.push("Tableau différentiel manquant (≥ 2 entités comparées).");
    if (!doc.vignette?.presentation) errors.push("Vignette clinique manquante.");
  }
  if (doc.mode === "flash") {
    const k = doc.flash?.key_points?.length ?? 0;
    if (k < 8 || k > 30) errors.push(`Fiche flash : ${k} points clés (attendu 8 à 30).`);
  }

  const allText = summaryText + " " + (doc.objectives ?? []).map((o) => o.statement).join(" ");
  if (/[\uE000-\uF8FF]/.test(allText)) errors.push("Glyphes parasites (puces Wingdings) dans la fiche.");
  if (/(^|\s)q(?=[A-ZÉ][a-zéèê])/.test(allText)) errors.push("Puce parasite « q » collée à un mot (artefact d'extraction PDF).");
  const dup = allText.match(/\b([A-Za-zÀ-ÿ0-9]{3,})\s+\1\b/);
  if (dup) errors.push(`Mot répété « ${dup[0]} » (artefact de concaténation).`);

  const cap = Math.max(180, Math.round(courseWords * budgetRatio));
  if (summaryWords > cap)
    errors.push(`Fiche trop longue : ${summaryWords} mots pour un budget de ${cap} (cours : ${courseWords} mots). Condense : reformule, regroupe, supprime le remplissage.`);

  const verbatim = verbatimRatio(summaryText, courseText);
  if (verbatim > 0.8 && summaryWords > courseWords * 0.2)
    errors.push(`Copie du cours détectée (${Math.round(verbatim * 100)} % de séquences identiques). Reformule au lieu de recopier.`);

  return {
    ok: errors.length === 0,
    errors,
    metrics: { courseWords, summaryWords, ratio: courseWords ? summaryWords / courseWords : 0, verbatim, expectedObjectives: expected, foundObjectives: found },
  };
}
