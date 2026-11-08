// Normalize duel/QCM questions into a consistent shape for the DuelGame UI.
// Stored questions can come from qcm_sessions in the format:
//   { question, choices: string[], correct: number[] | number, explanation? }
// or already in the duel-friendly format:
//   { question, options: string[], correct_answer: string, explanation? }

export interface NormalizedDuelQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDuelQuestion(raw: any): NormalizedDuelQuestion | null {
  if (!raw || typeof raw !== "object") return null;

  const question = String(raw.question ?? raw.prompt ?? "").trim();
  const options: string[] = Array.isArray(raw.options)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? raw.options.map((o: any) => String(o))
    : Array.isArray(raw.choices)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? raw.choices.map((o: any) => String(o))
    : [];

  if (!question || options.length === 0) return null;

  let correct_answer = "";
  if (typeof raw.correct_answer === "string") {
    correct_answer = raw.correct_answer;
  } else if (Array.isArray(raw.correct) && raw.correct.length > 0) {
    const idx = Number(raw.correct[0]);
    correct_answer = options[idx] ?? options[0];
  } else if (typeof raw.correct === "number") {
    correct_answer = options[raw.correct] ?? options[0];
  } else if (typeof raw.answer === "string") {
    correct_answer = raw.answer;
  } else {
    correct_answer = options[0];
  }

  return {
    question,
    options,
    correct_answer,
    explanation: raw.explanation,
  };
}

export function normalizeDuelQuestions(arr: unknown): NormalizedDuelQuestion[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeDuelQuestion).filter((q): q is NormalizedDuelQuestion => !!q);
}
