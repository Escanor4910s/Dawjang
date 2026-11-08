export type QuestionArchetype =
  | 'complement_multiple'
  | 'censure'
  | 'groupage'
  | 'jumelage'
  | 'association'
  | 'mixte';

export type CognitiveTier = 'ancrage' | 'mecanismes' | 'discernement';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface MatchingColumnItem {
  id: string; // "1".."5" pour colonne gauche, "A".."E" (ou "a".."e") pour colonne droite
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
  isTrue: boolean;
}

export interface JumelagePayload {
  statementOne: string;
  connector: 'PARCE QUE' | 'D’OÙ' | 'ALORS QUE';
  statementTwo: string;
}

export interface QuizOption {
  letter: OptionLetter;
  text: string;
  rationale?: string; // Justification précise tirée du cours pour cette option
}

export interface QuizQuestion {
  id: string;
  index: number;
  archetype: Exclude<QuestionArchetype, 'mixte'>;
  cognitiveTier: CognitiveTier;
  stem: string; // L'énoncé principal reformulé avec créativité
  conceptTag: string; // Notion clé testée (sert à l'exclusion inter-séries #1, #2...)
  
  // Structures spécialisées obligatoires selon l'archétype
  matchingColumns?: MatchingColumnsPayload;
  groupageStatements?: GroupageStatement[];
  jumelageData?: JumelagePayload;

  options: QuizOption[]; // Toujours 5 choix (A, B, C, D, E) mélangés côté serveur
  correctLetter: OptionLetter;
  globalExplanation: string;
  courseExcerpt: string; // Citation ou référence exacte du cours prouvant la réponse
}

export interface UploadedCourseDocument {
  id: string;
  fileName: string;
  cleanTitle: string;
  content: string;
}

export interface QuizSeries {
  id: string;
  courseRootTitle: string; // ex: "Anémie"
  seriesNumber: number;    // ex: 1 -> affiché "Anémie #1"
  displayTitle: string;    // "Anémie #1"
  createdAt: string;
  archetype: QuestionArchetype;
  cognitiveTier: CognitiveTier;
  questions: QuizQuestion[];
}
