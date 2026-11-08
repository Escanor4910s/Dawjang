/**
 * Fisher-Yates (Knuth) shuffle algorithm - O(n) time, unbiased
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface RawQuestion {
  id?: string;
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
  lockOrder?: boolean;
  lockChoices?: boolean;
}

export interface ShuffledQuestion {
  id: string;
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
  originalChoiceMap: number[];
}

/**
 * Détecte si une question a des choix codés fixes (Groupage A=1+2+3, Jumelage Vrai-Vrai, Association, ou lockChoices)
 * qui ne doivent JAMAIS être mélangés aléatoirement.
 */
function shouldLockChoices(q: RawQuestion): boolean {
  if (q.lockChoices) return true;
  const qText = (q.question || "").toUpperCase();
  if (
    qText.includes("[GROUPAGE") ||
    qText.includes("[JUMELAGE") ||
    qText.includes("[CAUSE") ||
    qText.includes("[ASSOCIATION") ||
    qText.includes("[CAS CLINIQUE") ||
    qText.includes("[ÉLECTION") ||
    qText.includes("[CENSURE") ||
    qText.includes("[COMPLÉMENTS")
  ) {
    return true;
  }
  const choices = q.choices || [];
  if (
    choices.length === 5 &&
    choices[0].trim().startsWith("A") &&
    choices[1].trim().startsWith("B") &&
    choices[2].trim().startsWith("C")
  ) {
    return true;
  }
  return false;
}

/**
 * Mélange les questions et les choix UNIQUEMENT pour les QCM classiques.
 * Pour le mode "Clonage d'Examen Officiel" (lockOrder: true), préserve à 100%
 * le défilement séquentiel de l'épreuve (Blocs Élection -> Censure -> Groupage -> Jumelage -> Association ou Cas Cliniques).
 */
export function shuffleQuiz(questions: RawQuestion[], preserveExamOrder = false): ShuffledQuestion[] {
  const isLockedExam =
    preserveExamOrder || questions.some((q) => q.lockOrder === true || shouldLockChoices(q));

  const orderedQuestions = isLockedExam ? [...questions] : fisherYatesShuffle(questions);

  return orderedQuestions.map((q, idx) => {
    const choices = q.choices || [];
    const correctSet = new Set(q.correct || []);

    if (isLockedExam || shouldLockChoices(q)) {
      const identityIndices = choices.map((_, i) => i);
      return {
        id: q.id || String(idx),
        question: q.question,
        choices: [...choices],
        correct: [...(q.correct || [0])],
        explanation: q.explanation,
        originalChoiceMap: identityIndices,
      };
    }

    const choiceIndices = choices.map((_, i) => i);
    const shuffledIndices = fisherYatesShuffle(choiceIndices);
    const newChoices = shuffledIndices.map((origIdx) => choices[origIdx]);
    const newCorrect = shuffledIndices
      .map((origIdx, newIdx) => (correctSet.has(origIdx) ? newIdx : -1))
      .filter((i) => i !== -1);

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

export function generateSessionSeed(userId: string, sessionId: string): number {
  let hash = 0;
  const str = `${userId}-${sessionId}-${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
