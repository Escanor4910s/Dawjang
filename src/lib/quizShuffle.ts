/**
 * Fisher-Yates (Knuth) shuffle algorithm - O(n) time, unbiased
 * Shuffles an array in place and returns it.
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface RawQuestion {
  id?: string;
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
}

interface ShuffledQuestion {
  id: string;
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
  originalChoiceMap: number[]; // maps new index -> original index
}

/**
 * Shuffles both the order of questions AND the order of choices within each question.
 * Updates the `correct` indices to match the new choice positions.
 * Ensures no bias and O(n*m) performance where n=questions, m=choices.
 */
export function shuffleQuiz(questions: RawQuestion[]): ShuffledQuestion[] {
  // 1. Shuffle question order
  const shuffledQuestions = fisherYatesShuffle(questions);

  // 2. For each question, shuffle choices and remap correct indices
  return shuffledQuestions.map((q, idx) => {
    const choices = q.choices || [];
    const correctSet = new Set(q.correct || []);

    // Create index array [0, 1, 2, 3, 4] then shuffle it
    const choiceIndices = choices.map((_, i) => i);
    const shuffledIndices = fisherYatesShuffle(choiceIndices);

    // Build new choices array and remap correct indices
    const newChoices = shuffledIndices.map(origIdx => choices[origIdx]);
    const newCorrect = shuffledIndices
      .map((origIdx, newIdx) => (correctSet.has(origIdx) ? newIdx : -1))
      .filter(idx => idx !== -1);

    return {
      id: q.id || String(idx),
      question: q.question,
      choices: newChoices,
      correct: newCorrect,
      explanation: q.explanation,
      originalChoiceMap: shuffledIndices,
    };
  });
}

/**
 * Generates a unique session seed based on user ID and session ID.
 * Can be used for deterministic shuffling if needed in the future.
 */
export function generateSessionSeed(userId: string, sessionId: string): number {
  let hash = 0;
  const str = `${userId}-${sessionId}-${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
