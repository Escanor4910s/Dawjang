export type QuestionArchetype =
  | 'complement_multiple'
  | 'censure'
  | 'groupage'
  | 'jumelage'
  | 'association';

export type CognitiveTier = 'ancrage' | 'mecanismes' | 'discernement';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface MatchingColumnItem {
  id: string; // "1".."5" (Colonne 1) ou "A".."E" (Colonne 2)
  text: string;
}

export interface MatchingColumnsPayload {
  leftColumnTitle: string;
  rightColumnTitle: string;
  leftItems: MatchingColumnItem[];  // Exactement 5 éléments (1 à 5)
  rightItems: MatchingColumnItem[]; // Exactement 5 éléments (A à E)
}

export interface GroupageStatement {
  numeral: 'I' | 'II' | 'III' | 'IV' | 'V';
  text: string;
  isTrue?: boolean;
}

export interface JumelagePayload {
  statementOne: string;
  connector: 'PARCE QUE' | 'D’OÙ' | 'ALORS QUE';
  statementTwo: string;
}

export interface QuizOption {
  letter: OptionLetter;
  text: string;
  rationale?: string;
}

export interface QuizQuestion {
  id: string;
  index: number;
  archetype: QuestionArchetype;
  cognitiveTier: CognitiveTier;
  stem: string;
  conceptTag: string;
  matchingColumns?: MatchingColumnsPayload | null;
  groupageStatements?: GroupageStatement[] | null;
  jumelageData?: JumelagePayload | null;
  options: QuizOption[];
  correctLetter: OptionLetter;
  globalExplanation: string;
  courseExcerpt?: string;
}

export interface CourseSourceItem {
  id: string;
  title: string;
  cleanRootName: string; // ex: "Anémie"
  content: string;
  sourceType: 'library' | 'upload' | 'text' | 'annales';
  wordCount: number;
}

export interface QuizSeriesSession {
  id: string;
  courseRootTitle: string; // ex: "Anémie"
  seriesNumber: number;    // ex: 1, 2, 3...
  displayTitle: string;    // ex: "Anémie #1"
  createdAt: string;
  archetypes: QuestionArchetype[];
  cognitiveTier: CognitiveTier;
  questions: QuizQuestion[];
}
