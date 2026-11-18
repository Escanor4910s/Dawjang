export const EXAM_ITEM_FORMATS = [
  "ELECTION", "CENSURE", "GROUPAGE", "JUMELAGE", "ASSOCIATION", "COMPLEMENT_MULTIPLE",
] as const;

export type ExamItemFormat = typeof EXAM_ITEM_FORMATS[number];

export const JUMELAGE_OPTIONS = [
  "Les deux propositions sont vraies avec relation de cause à effet",
  "Les deux propositions sont vraies sans relation de cause à effet",
  "La première proposition est vraie, la seconde est fausse",
  "La première proposition est fausse, la seconde est vraie",
  "Les deux propositions sont fausses",
];

export interface ExamDraftItem {
  format: ExamItemFormat;
  stem: string;
  lead?: string;
  options: Array<{ letter: string; text: string }>;
  correct: string[];
  explanation: string;
  statements?: string[];
  groupageCodeHint?: string;
  associationColumns?: {
    leftTitle: string;
    rightTitle: string;
    leftItems: Array<{ id: string; text: string }>;
    rightItems: Array<{ id: string; text: string }>;
  };
}

export interface ExamDraftBlock {
  kind: "CAS_CLINIQUE" | "STANDALONE";
  header: string;
  vignette?: string;
  items: ExamDraftItem[];
}

export interface ExamVerdict {
  letter: string;
  isTrue: boolean;
  reason: string;
  sourceQuote: string;
}

export interface ExamItemReview {
  index: number;
  answerable: boolean;
  unambiguous: boolean;
  correct: string[];
  explanation: string;
  optionVerdicts: ExamVerdict[];
  statementTruth?: boolean[];
  causalLink?: boolean;
}

export interface ExamValidation {
  version: 1;
  status: "passed";
  differentModel: boolean;
  items: ExamItemReview[];
}

export interface ReviewedExamBlock extends ExamDraftBlock {
  validation: ExamValidation;
}

export interface ExamBlockSpec {
  kind: string;
  formats: readonly string[];
  optionCounts?: readonly number[];
  groupageCode?: string;
}

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && a.every((v) => b.includes(v));

function groupageCombination(value: string): string | null {
  if (/^(?:autre(?:s)?(?: choix| combinaison(?:s)?)?|other)$/i.test(value.trim())) return "OTHER";
  const clean = value.replace(/\bseulement\b/gi, "").trim();
  if (!/^\d(?:\s*[+,]\s*\d)*$/.test(clean)) return null;
  const numbers = clean.match(/\d/g)!;
  return new Set(numbers).size === numbers.length ? numbers.sort().join(",") : null;
}

function groupageCodeEntries(code: string): Array<[string, string | null]> {
  return [...code.matchAll(/\b([A-J])\s*[:=]\s*(.*?)(?=\s*[;•]?\s*\b[A-J]\s*[:=]|$)/gi)]
    .map((entry) => [entry[1].toUpperCase(), groupageCombination(entry[2].replace(/[;•]\s*$/, "").trim())]);
}

export function validateExamDraft(value: unknown, spec: ExamBlockSpec): string[] {
  if (!record(value) || !Array.isArray(value.items)) return ["Bloc JSON absent ou invalide."];
  const errors: string[] = [];
  if (!spec.formats.length || spec.formats.length > 45 || value.items.length !== spec.formats.length) errors.push("Nombre de questions différent du plan d’épreuve.");
  if (value.kind !== spec.kind || !["CAS_CLINIQUE", "STANDALONE"].includes(String(value.kind))) errors.push("Type de bloc différent du plan d’épreuve.");
  if (spec.optionCounts && (spec.optionCounts.length !== spec.formats.length || spec.optionCounts.some((count) => !Number.isInteger(count) || count < 2 || count > 10))) errors.push("Nombre de choix invalide dans le plan d’épreuve.");
  if (!text(value.header)) errors.push("Titre du bloc absent.");
  if (value.kind === "CAS_CLINIQUE" && !text(value.vignette)) errors.push("Énoncé du dossier absent.");
  const seenStems = new Set<string>();

  value.items.forEach((item, index) => {
    const prefix = `Question ${index + 1} : `;
    const fail = (message: string) => errors.push(prefix + message);
    if (!record(item)) { fail("objet invalide."); return; }
    if (!EXAM_ITEM_FORMATS.includes(item.format as ExamItemFormat) || item.format !== spec.formats[index]) fail("format non conforme au plan.");
    if (!text(item.stem) || !text(item.explanation)) fail("énoncé ou correction absent.");
    if (item.lead !== undefined && !text(item.lead)) fail("amorce invalide.");
    if (text(item.stem)) {
      const signature = normalized(`${item.lead || ""} ${item.stem}`).toLowerCase();
      if (seenStems.has(signature)) fail("énoncé dupliqué.");
      seenStems.add(signature);
    }
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 10 ||
      !item.options.every((o) => record(o) && text(o.letter) && /^[A-J]$/.test(o.letter) && text(o.text))) {
      fail("propositions invalides."); return;
    }
    const options = item.options as ExamDraftItem["options"];
    if (spec.optionCounts && options.length !== spec.optionCounts[index]) fail("nombre de choix différent du plan.");
    const letters = options.map((o) => o.letter);
    if (new Set(letters).size !== letters.length || new Set(options.map((o) => normalized(o.text).toLowerCase())).size !== options.length) fail("lettres ou propositions dupliquées.");
    if (!strings(item.correct) || !item.correct.length || new Set(item.correct).size !== item.correct.length || !item.correct.every((c) => letters.includes(c))) {
      fail("clé de réponse absente ou invalide."); return;
    }
    if (item.format === "COMPLEMENT_MULTIPLE" ? item.correct.length < 2 || item.correct.length >= options.length : item.correct.length !== 1) fail("nombre de réponses exactes non conforme au format.");
    if (["GROUPAGE", "JUMELAGE"].includes(String(item.format))) {
      const count = item.format === "GROUPAGE" ? [3, 4, 5, 6] : [2];
      if (!strings(item.statements) || !count.includes(item.statements.length)) fail("assertions manquantes ou nombre incorrect.");
    }
    if (item.format === "JUMELAGE" && (options.length !== 5 || options.some((option, i) => option.letter !== "ABCDE"[i] || normalized(option.text).toLowerCase() !== normalized(JUMELAGE_OPTIONS[i]).toLowerCase()))) fail("code canonique du jumelage non respecté.");
    if (item.format === "GROUPAGE") {
      const codes = options.map((o) => groupageCombination(o.text));
      if (codes.some((c) => c === null) || new Set(codes).size !== codes.length) fail("combinaisons de groupage invalides.");
      const statementCount = Array.isArray(item.statements) ? item.statements.length : 0;
      if (codes.some((c) => c !== null && c !== "OTHER" && c.split(",").some((n) => Number(n) < 1 || Number(n) > statementCount))) fail("combinaison référençant une assertion inexistante.");
      const hint = text(item.groupageCodeHint) ? item.groupageCodeHint : "";
      const entries = groupageCodeEntries(hint);
      if (entries.length !== options.length || new Set(entries.map((e) => e[0])).size !== entries.length ||
        options.some((o) => entries.find((e) => e[0] === o.letter)?.[1] !== groupageCombination(o.text))) fail("code de groupage différent des options.");
      if (spec.groupageCode) {
        const expected = groupageCodeEntries(spec.groupageCode);
        if (expected.length !== options.length || options.some((o) => expected.find((entry) => entry[0] === o.letter)?.[1] !== groupageCombination(o.text))) fail("code de groupage différent de celui des annales.");
      }
    }
    if (item.format === "ASSOCIATION") {
      const columns = item.associationColumns;
      if (!record(columns) || !text(columns.leftTitle) || !text(columns.rightTitle) ||
        ![columns.leftItems, columns.rightItems].every((list) => Array.isArray(list) && list.length >= 2 && list.every((v) => record(v) && text(v.id) && text(v.text)))) {
        fail("colonnes d’association invalides."); return;
      }
      const left = (columns.leftItems as Array<{ id: string }>).map((v) => v.id);
      const right = (columns.rightItems as Array<{ id: string }>).map((v) => v.id);
      if (new Set(left).size !== left.length || new Set(right).size !== right.length) fail("identifiants de colonnes dupliqués.");
      for (const option of options) {
        const pairs = [...option.text.matchAll(/(\d+)\s*[-–→]\s*([A-Z])/g)];
        if (!sameSet(pairs.map((p) => p[1]), left) || pairs.some((p) => !right.includes(p[2]))) fail(`appariement incomplet dans l’option ${option.letter}.`);
      }
    }
  });
  return errors;
}

export function validateExamReview(block: ExamDraftBlock, value: unknown, courseText: string): string[] {
  if (!record(value) || !Array.isArray(value.items) || value.items.length !== block.items.length) return ["Relecture absente ou incomplète."];
  const errors: string[] = [];
  const source = normalized(courseText);
  block.items.forEach((item, index) => {
    const review = value.items[index];
    const fail = (message: string) => errors.push(`Question ${index + 1} : ${message}`);
    if (!record(review) || review.index !== index || review.answerable !== true || review.unambiguous !== true || !text(review.explanation)) {
      fail("relecture non concluante ou question ambiguë."); return;
    }
    if (!strings(review.correct) || !sameSet(review.correct, item.correct)) fail("désaccord entre la génération et la résolution indépendante.");
    const verdicts = review.optionVerdicts;
    if (!Array.isArray(verdicts) || !verdicts.every((v) => record(v) && text(v.letter) && typeof v.isTrue === "boolean" && text(v.reason) && text(v.sourceQuote)) ||
      !sameSet(verdicts.map((v) => v.letter), item.options.map((o) => o.letter))) {
      fail("justification manquante pour une proposition."); return;
    }
    for (const verdict of verdicts) {
      const quote = normalized(verdict.sourceQuote as string);
      if (quote.length < 8 || !source.includes(quote)) fail(`citation introuvable dans le cours pour ${verdict.letter}.`);
    }
    const inferredKey = verdicts.filter((v) => item.format === "CENSURE" ? !v.isTrue : v.isTrue).map((v) => v.letter as string);
    if (!sameSet(inferredKey, item.correct)) fail("clé incompatible avec la vérité des propositions.");
    if (item.format === "GROUPAGE" || item.format === "JUMELAGE") {
      const truth = review.statementTruth;
      if (!Array.isArray(truth) || truth.length !== item.statements?.length || !truth.every((v) => typeof v === "boolean")) {
        fail("vérité des assertions non vérifiée."); return;
      }
      if (item.format === "GROUPAGE") {
        const combination = truth.flatMap((v, i) => v ? [String(i + 1)] : []).join(",");
        const match = item.options.find((o) => groupageCombination(o.text) === combination) || item.options.find((o) => groupageCombination(o.text) === "OTHER");
        if (!match || item.correct[0] !== match.letter) fail("clé incompatible avec les assertions du groupage.");
      } else {
        if (typeof review.causalLink !== "boolean") fail("lien de causalité non vérifié.");
        const expected = truth[0] ? truth[1] ? review.causalLink ? "A" : "B" : "C" : truth[1] ? "D" : "E";
        if (item.correct[0] !== expected) fail("clé incompatible avec les assertions du jumelage.");
      }
    }
  });
  return errors;
}

export function validateReviewedExamBlock(value: unknown, spec: ExamBlockSpec, courseText: string): string[] {
  const errors = validateExamDraft(value, spec);
  if (errors.length) return errors;
  const block = value as ReviewedExamBlock;
  if (!record(block.validation) || block.validation.version !== 1 || block.validation.status !== "passed" || typeof block.validation.differentModel !== "boolean") return ["Preuve de relecture absente : le serveur de génération doit être mis à jour."];
  return validateExamReview(block, block.validation, courseText);
}
