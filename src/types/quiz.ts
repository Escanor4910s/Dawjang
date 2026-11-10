export type QuestionArchetype =
  | 'complement_multiple'
  | 'censure'
  | 'election_censure'
  | 'groupage'
  | 'jumelage'
  | 'association';

export type CognitiveTier = 'ancrage' | 'mecanismes' | 'discernement';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface MatchingColumnItem {
  id: string;
  text: string;
}

export interface MatchingColumnsPayload {
  leftColumnTitle: string;
  rightColumnTitle: string;
  leftItems: MatchingColumnItem[];
  rightItems: MatchingColumnItem[];
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
  cleanRootName: string;
  content: string;
  sourceType: 'library' | 'upload' | 'text' | 'annales';
  wordCount: number;
  subject?: string;
  updatedAt?: string;
  code?: string;
}

export interface UserQuestionAnswerState {
  picked: OptionLetter | null;
  validated: boolean;
  isCorrect: boolean;
}

export interface QuizSeriesSession {
  id: string;
  courseRootTitle: string;
  seriesNumber: number;
  displayTitle: string;
  createdAt: string;
  archetypes: QuestionArchetype[];
  cognitiveTier: CognitiveTier;
  questions: QuizQuestion[];
  userAnswers?: Record<string, UserQuestionAnswerState>;
}
