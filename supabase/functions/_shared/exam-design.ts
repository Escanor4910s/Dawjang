import { EXAM_ITEM_FORMATS, type ExamItemFormat } from "./exam-validation.ts";
import type { ExamStyleSource } from "./exam-style.ts";

export interface ObservedExamQuestion {
  number: number;
  format: ExamItemFormat | "QNS";
  optionCount: number;
  inCase: boolean;
  caseKey?: string;
  stem: string;
  sourceTitle: string;
  lessonId?: string;
  optionTexts?: string[];
  vignetteWords?: number;
  source?: ExamStyleSource;
  aiRecovered?: boolean;
}

export interface PlannedExamBlock {
  id: string;
  kind: "CAS_CLINIQUE" | "STANDALONE";
  lessonIds: string[];
  formats: ExamItemFormat[];
  optionCounts: number[];
  targetItemCount: number;
}

export interface ExamDesign {
  mode: "observed" | "training";
  totalQuestions: number;
  observedQuestions: number;
  caseQuestions: number;
  dossierSize: number | null;
  formatCounts: Partial<Record<ExamItemFormat, number>>;
  optionCounts: Record<number, number>;
  meanStemWords: number | null;
  blocks: PlannedExamBlock[];
  warnings: string[];
}

export const MAX_EXAM_QUESTIONS = 45;
const MAX_BLOCK_QUESTIONS = 8;

export const EXAM_FORMAT_NAMES: Record<ExamItemFormat, string> = {
  ELECTION: "élection",
  CENSURE: "censure",
  GROUPAGE: "groupage",
  JUMELAGE: "jumelage",
  ASSOCIATION: "association",
  COMPLEMENT_MULTIPLE: "complément multiple",
};

interface Shape {
  format: ExamItemFormat;
  optionCount: number;
  inCase: boolean;
  count: number;
}

export function apportionExamCounts(weights: number[], total: number): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((weight) => total * (sum > 0 ? weight / sum : 1 / weights.length));
  const counts = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = total - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) counts[order[i].index]++;
  return counts;
}

export function plannedOptionCount(question: Pick<ObservedExamQuestion, "format" | "optionCount">): number | null {
  if (!EXAM_ITEM_FORMATS.includes(question.format as ExamItemFormat)) return null;
  if (question.format === "JUMELAGE") return 5;
  const minimum = question.format === "COMPLEMENT_MULTIPLE" ? 3 : 2;
  return Number.isInteger(question.optionCount) && question.optionCount >= minimum && question.optionCount <= 10 ? question.optionCount : null;
}

// Positions fractionnaires : un format rare est réparti dans la séquence au lieu d'être regroupé à la fin.
function interleave(entries: Array<{ shape: Shape; count: number }>): Shape[] {
  return entries
    .flatMap(({ shape, count }, index) => Array.from({ length: count }, (_, k) => ({ shape, index, position: (k + 0.5) / count })))
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((entry) => entry.shape);
}

function balancedChunks<T>(values: T[], maxSize: number): T[][] {
  if (!values.length) return [];
  const sizes = apportionExamCounts(Array(Math.ceil(values.length / maxSize)).fill(1), values.length);
  let cursor = 0;
  return sizes.map((size) => values.slice(cursor, (cursor += size)));
}

function casesComeFirst(questions: ObservedExamQuestion[]): boolean {
  const bySource = new Map<string, ObservedExamQuestion[]>();
  for (const question of questions) bySource.set(question.sourceTitle, [...(bySource.get(question.sourceTitle) || []), question]);
  const sums = { case: 0, caseCount: 0, standalone: 0, standaloneCount: 0 };
  for (const group of bySource.values()) {
    group.forEach((question, index) => {
      const position = group.length > 1 ? index / (group.length - 1) : 0;
      if (question.inCase) { sums.case += position; sums.caseCount++; } else { sums.standalone += position; sums.standaloneCount++; }
    });
  }
  return !sums.caseCount || !sums.standaloneCount || sums.case / sums.caseCount <= sums.standalone / sums.standaloneCount;
}

const describeQuestion = (question: ObservedExamQuestion) => `n° ${question.number}${question.sourceTitle ? ` de « ${question.sourceTitle} »` : ""}`;

export function createExamDesign(params: {
  lessonIds: string[];
  questions: ObservedExamQuestion[];
  referenceQuestionCount: number;
  hasAnnales: boolean;
  preserveRareFormats?: boolean;
  rareFormatMinQuotas?: Partial<Record<ExamItemFormat, number>>;
}): ExamDesign {
  const { lessonIds, questions, referenceQuestionCount, hasAnnales, preserveRareFormats = false, rareFormatMinQuotas } = params;
  if (!lessonIds.length) throw new Error("Sélectionnez au moins un chapitre.");
  if (lessonIds.length > MAX_EXAM_QUESTIONS) throw new Error("Une session couvre au maximum 45 chapitres et 45 questions.");
  const warnings: string[] = [];
  const openQuestions = questions.filter((q) => q.format === "QNS");
  const unreadable = questions.filter((q) => q.format !== "QNS" && plannedOptionCount(q) === null);
  const usable = questions.filter((q) => plannedOptionCount(q) !== null);
  if (openQuestions.length) warnings.push(`${openQuestions.length} question(s) rédactionnelle(s) observée(s) ne sont pas simulées : seule la partie à choix multiples est reproduite, sans conversion en QCM.`);
  if (unreadable.length) warnings.push(`Choix illisibles dans la transcription pour ${unreadable.length} question(s) (${unreadable.slice(0, 5).map(describeQuestion).join(", ")}${unreadable.length > 5 ? "…" : ""}) : leur structure n’est pas reproduite.`);
  if (hasAnnales && (!usable.length || !Number.isInteger(referenceQuestionCount) || referenceQuestionCount < 1)) {
    throw new Error("Aucune structure de QCM exploitable dans les annales de cette matière : corrigez la transcription ou retirez ces annales pour un entraînement de base.");
  }

  const reference = hasAnnales ? referenceQuestionCount : 12;
  const totalQuestions = Math.max(lessonIds.length, Math.min(MAX_EXAM_QUESTIONS, reference));
  if (reference > MAX_EXAM_QUESTIONS) warnings.push(`Le sujet de référence contient ${reference} questions ; cette session est limitée explicitement à ${MAX_EXAM_QUESTIONS} questions.`);
  if (lessonIds.length > reference) warnings.push(`Le nombre de questions passe de ${reference} à ${totalQuestions} pour couvrir chaque chapitre sélectionné.`);
  if (!hasAnnales) warnings.push("Sans annale : profil d’entraînement de base (questions à réponse unique, 5 choix), non présenté comme le style d’un enseignant.");

  const shapeMap = new Map<string, Shape>();
  for (const question of usable) {
    const optionCount = plannedOptionCount(question)!;
    const key = `${question.format}:${optionCount}:${question.inCase}`;
    const shape = shapeMap.get(key);
    if (shape) shape.count++;
    else shapeMap.set(key, { format: question.format as ExamItemFormat, optionCount, inCase: question.inCase, count: 1 });
  }
  if (!shapeMap.size) shapeMap.set("default", { format: "ELECTION", optionCount: 5, inCase: false, count: 1 });
  const shapes = [...shapeMap.values()].sort((a, b) => b.count - a.count);
  const counts = apportionExamCounts(shapes.map((shape) => shape.count), totalQuestions);
  if (preserveRareFormats && totalQuestions >= 4) {
    const protectedFormats = new Set<ExamItemFormat>();
    const rescuedLabels: string[] = [];
    const uniqueFormats: ExamItemFormat[] = [];
    for (const shape of shapes) {
      if (!uniqueFormats.includes(shape.format)) uniqueFormats.push(shape.format);
    }
    for (const fmt of uniqueFormats) {
      const explicitQuota = rareFormatMinQuotas?.[fmt];
      const currentTotal = shapes.reduce((sum, sh, i) => (sh.format === fmt ? sum + counts[i] : sum), 0);
      const targetMin = explicitQuota && explicitQuota > 0
        ? Math.min(explicitQuota, Math.max(1, Math.floor(totalQuestions * 0.35)))
        : currentTotal === 0
        ? 1
        : 0;
      if (targetMin <= currentTotal) continue;
      protectedFormats.add(fmt);
      const targetShapeIdx = shapes.findIndex((sh) => sh.format === fmt);
      if (targetShapeIdx < 0) continue;
      let added = 0;
      while (
        shapes.reduce((sum, sh, i) => (sh.format === fmt ? sum + counts[i] : sum), 0) < targetMin
      ) {
        const donorIdx = counts.reduce((best, c, i) => {
          if (protectedFormats.has(shapes[i].format) || shapes[i].format === fmt) return best;
          return c > (best >= 0 ? counts[best] : 2) ? i : best;
        }, -1);
        if (donorIdx < 0 || counts[donorIdx] <= 2) break;
        counts[donorIdx]--;
        counts[targetShapeIdx]++;
        added++;
      }
      if (added > 0) {
        const finalFmtTotal = shapes.reduce((sum, sh, i) => (sh.format === fmt ? sum + counts[i] : sum), 0);
        const obsFmtTotal = shapes.reduce((sum, sh) => (sh.format === fmt ? sum + sh.count : sum), 0);
        rescuedLabels.push(`${EXAM_FORMAT_NAMES[fmt]} (×${obsFmtTotal} observé, quota ${finalFmtTotal} inclus)`);
      }
    }
    if (rescuedLabels.length) {
      warnings.push(
        `Cas rare(s) intégré(s) dans l’examen blanc selon leur quota observé : ${rescuedLabels.join(", ")}.`
      );
    }
  }
  const dropped = shapes.filter((_, index) => counts[index] === 0);
  if (dropped.length) {
    warnings.push(`Structures trop rares pour ${totalQuestions} questions, non reproduites : ${dropped.map((shape) => `${EXAM_FORMAT_NAMES[shape.format]} à ${shape.optionCount} choix${shape.inCase ? " en dossier" : ""} (×${shape.count})`).join(", ")}.`);
  }
  const weighted = shapes.map((shape, index) => ({ shape, count: counts[index] })).filter((entry) => entry.count > 0);
  const caseSequence = interleave(weighted.filter((entry) => entry.shape.inCase));
  const standaloneSequence = interleave(weighted.filter((entry) => !entry.shape.inCase));

  const observedCases = usable.filter((q) => q.inCase);
  const caseKeys = new Set(observedCases.map((q) => q.caseKey || `${q.sourceTitle}#dossier`));
  const dossierSize = observedCases.length ? Math.min(MAX_BLOCK_QUESTIONS, Math.max(1, Math.round(observedCases.length / caseKeys.size))) : null;

  const remaining = apportionExamCounts(lessonIds.map(() => 1), totalQuestions);
  const lessonDossiers: Shape[][][] = lessonIds.map(() => []);
  let cursor = 0;
  let splitDossiers = false;
  for (const dossier of balancedChunks(caseSequence, dossierSize || 1)) {
    let left = dossier.length;
    while (left > 0) {
      const target = remaining.reduce((best, value, index) => (value > remaining[best] ? index : best), 0);
      const take = Math.min(left, remaining[target]);
      if (take < left) splitDossiers = true;
      lessonDossiers[target].push(caseSequence.slice(cursor, cursor + take));
      cursor += take;
      left -= take;
      remaining[target] -= take;
    }
  }
  if (splitDossiers) warnings.push(`Trop de chapitres pour des dossiers de ${dossierSize} questions : certains dossiers sont scindés pour rester dans un seul chapitre.`);

  cursor = 0;
  const lessonStandalone = remaining.map((count) => standaloneSequence.slice(cursor, (cursor += count)));
  const caseBlocks: Array<Omit<PlannedExamBlock, "id">> = [];
  const standaloneBlocks: Array<Omit<PlannedExamBlock, "id">> = [];
  const toBlock = (kind: PlannedExamBlock["kind"], lessonId: string, items: Shape[]) => ({
    kind,
    lessonIds: [lessonId],
    formats: items.map((item) => item.format),
    optionCounts: items.map((item) => item.optionCount),
    targetItemCount: items.length,
  });
  lessonIds.forEach((lessonId, index) => {
    for (const dossier of lessonDossiers[index]) caseBlocks.push(toBlock("CAS_CLINIQUE", lessonId, dossier));
    for (const chunk of balancedChunks(lessonStandalone[index], MAX_BLOCK_QUESTIONS)) standaloneBlocks.push(toBlock("STANDALONE", lessonId, chunk));
  });
  const ordered = casesComeFirst(questions) ? [...caseBlocks, ...standaloneBlocks] : [...standaloneBlocks, ...caseBlocks];
  const blocks = ordered.map((block, index) => ({ id: `plan_${index + 1}`, ...block }));

  const formatCounts: ExamDesign["formatCounts"] = {};
  const optionCounts: ExamDesign["optionCounts"] = {};
  for (const block of blocks) {
    block.formats.forEach((format, index) => {
      formatCounts[format] = (formatCounts[format] || 0) + 1;
      optionCounts[block.optionCounts[index]] = (optionCounts[block.optionCounts[index]] || 0) + 1;
    });
  }
  const stems = usable.map((q) => q.stem.trim()).filter(Boolean);
  return {
    mode: hasAnnales ? "observed" : "training",
    totalQuestions,
    observedQuestions: questions.length,
    caseQuestions: caseSequence.length,
    dossierSize,
    formatCounts,
    optionCounts,
    meanStemWords: stems.length ? Math.round(stems.reduce((sum, stem) => sum + stem.split(/\s+/).length, 0) / stems.length) : null,
    blocks,
    warnings,
  };
}

export function examDisciplineDirectives(subject: string): string {
  const normalized = subject.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const common = `Discipline évaluée : ${subject}. Le cours définit les notions et le vocabulaire ; n’importe aucun contexte d’une autre matière. Un dossier peut être un exercice, un document, une situation pratique ou un cas clinique selon les sources.`;
  if (/mathem|physique|chimie|statistique|informatique|ingenier|econometr/.test(normalized)) {
    return `${common}\nPréserve les formules, symboles, unités, domaines de définition et hypothèses. Recalcule les résultats ; les distracteurs peuvent être des valeurs ou expressions courtes. Ne crée pas de patient ni de diagnostic sans source explicite.`;
  }
  if (/droit|jurid|jurisprud/.test(normalized)) {
    return `${common}\nPrécise le cadre juridique, les conditions, les exceptions et la date lorsque le cours les donne. N’invente aucun article, arrêt ou règle et ne transpose pas une règle entre juridictions. Un cas pratique porte sur les faits et leur qualification juridique.`;
  }
  if (/histoire|geograph|philosoph|lettre|langue|litter|sociolog|linguist/.test(normalized)) {
    return `${common}\nDistingue les faits, les interprétations et les thèses attribuées. Préserve les auteurs, dates et nuances du document. N’impose pas une réponse unique lorsqu’il existe plusieurs lectures défendables ; refuse l’item ambigu.`;
  }
  if (/medec|sante|clinique|cardiolog|hematolog|pneumolog|neurolog|nephrolog|traumatolog|rhumatolog|infectiolog|dermatolog|endocrinolog|immunolog|orthoped|pediatr|chirurg|anatom|pharm|urgence|obstet/.test(normalized)) {
    return `${common}\nPour les questions de santé, respecte les critères, seuils, mécanismes et indications du cours ; ne transforme pas une donnée absente en diagnostic certain. Les cas cliniques ne sont utilisés que si le plan en prévoit.`;
  }
  return `${common}\nConserve les notations, conventions et hypothèses propres à cette matière. Appuie chaque réponse sur le cours et signale toute interprétation non tranchée par les sources.`;
}
