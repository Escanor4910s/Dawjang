// src/lib/quizShuffle.ts
/**
 * Algorithme de mélange intelligent Hippocampus / DawJang :
 * - Mélange l'ordre des questions (sauf si elles font partie d'un Cas Clinique progressif lié ou lockOrder).
 * - Pour les questions d'Élection, Censure et Compléments Multiples : mélange les propositions A-E avec une distribution anti-séries (interdit A, A, A, A, B, B, B).
 * - Pour les questions à Grille Optique Fixe (Groupage A=1+2+3, Jumelage A=VV lié, Association Appariement 1-A•2-B...) :
 *   NE MÉLANGE JAMAIS les choix A-E entre eux pour que A reste toujours A, B reste B, etc. !
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
  type?: string;
  polarity?: "CHERCHER_VRAIES" | "CHERCHER_FAUSSES";
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
  sectionTitle?: string;
  exactQuote?: string;
  lockOrder?: boolean;
  lockChoices?: boolean;
  clinicalCase?: {
    caseNumber: number;
    caseTitle: string;
    initialPresentation?: string;
    narrativeUpdate?: string;
    stepLabel?: string;
  };
  assertions?: string[];
  jumelagePair?: {
    statement1: string;
    connector: string;
    statement2: string;
  };
  associationMatrix?: {
    leftTitle?: string;
    rightTitle?: string;
    leftItems: { num: number; text: string }[];
    rightItems: { code: string; text: string }[];
  };
}

export interface ShuffledQuestion extends RawQuestion {
  id: string;
  originalChoiceMap: number[];
}

/**
 * Détecte si une question utilise un code de grille optique fixe (Groupage, Jumelage, Association)
 * où l'ordre des lettres A, B, C, D, E ne doit jamais être permuté.
 */
function hasFixedOpticalGridChoices(q: RawQuestion): boolean {
  if (q.lockChoices) return true;
  const t = (q.type || "").toLowerCase();
  if (
    t === "groupage" ||
    t === "jumelage" ||
    t === "association" ||
    t === "vrai-faux" ||
    Boolean(q.associationMatrix) ||
    Boolean(q.jumelagePair) ||
    (Array.isArray(q.assertions) && q.assertions.length > 0)
  ) {
    return true;
  }

  // Détection par le contenu des choix
  const joined = (q.choices || []).join(" ").toLowerCase();
  if (
    joined.includes("1+2+3") ||
    joined.includes("1 + 2 + 3") ||
    joined.includes("vrai-vrai") ||
    joined.includes("vrai - vrai") ||
    joined.includes("appariement") ||
    joined.includes("1-a") ||
    (q.choices?.length === 5 && q.choices[0].trim() === "A" && q.choices[1].trim() === "B")
  ) {
    return true;
  }

  return false;
}

/**
 * Nettoie toute annotation interne parasite générée par erreur par un LLM
 */
export function cleanChoiceText(txt: string): string {
  if (!txt) return "";
  return txt
    .replace(/\(Déplacement officiel\)/gi, "")
    .replace(/\(Bonne réponse\)/gi, "")
    .replace(/\(Cible imposée\)/gi, "")
    .replace(/\(Proposition exacte\)/gi, "")
    .replace(/\(Proposition fausse\)/gi, "")
    .trim();
}

export function shuffleQuiz(questions: RawQuestion[], preserveExamOrder = false): ShuffledQuestion[] {
  // Si le quiz contient des cas cliniques numérotés ou verrouillé pour l'examen, on garde l'ordre chronologique
  const hasClinicalCases = preserveExamOrder || questions.some((q) => Boolean(q.clinicalCase) || q.lockOrder === true);
  const orderedQuestions = hasClinicalCases ? [...questions] : fisherYatesShuffle(questions);

  // Séquence anti-séries pour les QCU (Élection / Censure) afin d'éviter A, A, A, A
  let lastSingleTargetIndex = -1;
  let streakCount = 0;

  return orderedQuestions.map((q, idx) => {
    const cleanedChoices = (q.choices || []).map(cleanChoiceText);
    const correctSet = new Set(q.correct || [0]);

    // Si grille fixe (Groupage, Jumelage, Association), on garde l'ordre strict A, B, C, D, E
    if (hasFixedOpticalGridChoices(q)) {
      return {
        ...q,
        id: q.id || String(idx),
        choices: cleanedChoices,
        correct: Array.from(correctSet),
        originalChoiceMap: cleanedChoices.map((_, i) => i),
      };
    }

    // Pour Élection / Censure / Choix multiples : on mélange les choix avec contrôle anti-séries
    const choiceIndices = cleanedChoices.map((_, i) => i);
    let shuffledIndices = fisherYatesShuffle(choiceIndices);
    let newCorrect = shuffledIndices
      .map((origIdx, newIdx) => (correctSet.has(origIdx) ? newIdx : -1))
      .filter((i) => i !== -1);

    // Anti-série : si c'est une question à choix unique et que la lettre tombe > 2 fois de suite au même endroit, on re-mélange
    if (newCorrect.length === 1 && cleanedChoices.length > 2) {
      if (newCorrect[0] === lastSingleTargetIndex) {
        streakCount++;
        if (streakCount >= 2) {
          for (let attempt = 0; attempt < 5; attempt++) {
            shuffledIndices = fisherYatesShuffle(choiceIndices);
            newCorrect = shuffledIndices
              .map((origIdx, newIdx) => (correctSet.has(origIdx) ? newIdx : -1))
              .filter((i) => i !== -1);
            if (newCorrect[0] !== lastSingleTargetIndex) {
              streakCount = 1;
              break;
            }
          }
        }
      } else {
        streakCount = 1;
      }
      lastSingleTargetIndex = newCorrect[0];
    }

    const newChoices = shuffledIndices.map((origIdx) => cleanedChoices[origIdx]);

    return {
      ...q,
      id: q.id || String(idx),
      choices: newChoices,
      correct: newCorrect,
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

/**
 * Calcule l'empreinte SHA-256 d'un cours pour le Registre Fantôme (anti-répétition même après suppression)
 */
export async function computeCourseContentHash(rawText: string): Promise<string> {
  const normalized = (rawText || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
