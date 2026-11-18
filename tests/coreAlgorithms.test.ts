import { afterEach, describe, expect, test, vi } from "vitest";
import { calculateSM2, type SM2Params } from "../src/lib/sm2Algorithm";
import { cleanChoiceText, shuffleQuiz, type RawQuestion } from "../src/lib/quizShuffle";

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateSM2", () => {
  const baseParams: SM2Params = {
    ease_factor: 2.5,
    interval: 6,
    repetitions: 2,
    next_review: "2026-01-01",
  };

  test("une réponse parfaite augmente le facteur et l’intervalle", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const result = calculateSM2(5, baseParams);

    expect(result.repetitions).toBe(3);
    expect(result.ease_factor).toBe(2.6);
    expect(result.interval).toBe(16);
    expect(result.next_review).toBe("2026-01-17");
  });

  test("un échec réinitialise la répétition", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const result = calculateSM2(2, baseParams);

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.next_review).toBe("2026-01-02");
  });

  test("le facteur de facilité ne descend jamais sous 1.3", () => {
    const result = calculateSM2(0, { ...baseParams, ease_factor: 1.3 });

    expect(result.ease_factor).toBe(1.3);
  });
});

describe("shuffleQuiz", () => {
  function createQuestion(overrides: Partial<RawQuestion> = {}): RawQuestion {
    return {
      question: "Quelle proposition est exacte ?",
      choices: ["A", "B", "C", "D", "E"],
      correct: [2],
      ...overrides,
    };
  }

  test("nettoie les annotations internes des propositions", () => {
    expect(cleanChoiceText("Ferritine élevée (Bonne réponse)")).toBe("Ferritine élevée");
  });

  test("conserve l’ordre des cas cliniques verrouillés", () => {
    const questions = [
      createQuestion({ id: "q1", lockOrder: true }),
      createQuestion({ id: "q2", lockOrder: true }),
    ];

    expect(shuffleQuiz(questions).map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(shuffleQuiz(questions, true).map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  test("ne permute jamais une grille optique fixe", () => {
    const question = createQuestion({ id: "fixed", type: "groupage" });
    const [result] = shuffleQuiz([question], true);

    expect(result.choices).toEqual(question.choices);
    expect(result.correct).toEqual([2]);
    expect(result.originalChoiceMap).toEqual([0, 1, 2, 3, 4]);
  });

  test("conserve la bonne réponse après permutation des choix", () => {
    const question = createQuestion({ id: "standard", type: "qcu" });
    const [result] = shuffleQuiz([question], true);
    const expectedAnswer = question.choices[question.correct[0]];

    expect(result.correct).toHaveLength(1);
    expect(result.choices[result.correct[0]]).toBe(expectedAnswer);
    expect(result.originalChoiceMap[result.correct[0]]).toBe(question.correct[0]);
  });
});
