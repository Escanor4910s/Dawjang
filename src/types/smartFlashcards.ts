export type SmartQuestionModality =
  | "read_understand"
  | "multiple_choice"
  | "open_question"
  | "true_false"
  | "matching"
  | "categorize"
  | "fill_blank"
  | "word_bank";

export type SmartLearningEngineMode = "fluid" | "spaced_repetition";
export type SmartSortStrategy = "chronological_course" | "random" | "weakest_first" | "by_objective";
export type SmartEvalState = "idle" | "correct" | "partial" | "incorrect";

export interface SmartFlashcardConfig {
  cardsPerCycle: number;
  maxMovesPerCard: 1 | 2 | 3;
  engineMode: SmartLearningEngineMode;
  sortBy: SmartSortStrategy;
  enabledModalities: SmartQuestionModality[];
  swapQuestionAnswer: boolean;
  soundEffects: boolean;
  difficultyEscalation: boolean; // Augmente automatiquement la difficulté à chaque session
}

export interface SmartFlashcard {
  id: string;
  subjectTag: string;
  courseSection: string; // Section précise du cours pour garantir la couverture de A à Z
  objectiveTitle: string;
  customTags: string[];
  createdAt: number;
  difficulty: 1 | 2 | 3;
  prompt: string;
  variants?: {
    level1Prompt: string;
    level2Prompt: string;
    level3Prompt: string;
  };
  answer: string;
  keywords: string[];
  mcq: {
    question: string;
    options: { id: "A" | "B" | "C" | "D"; text: string; isCorrect: boolean }[];
  };
  trueFalse: {
    statement: string;
    isTrue: boolean;
  };
  cloze: {
    sentenceBefore: string;
    missingTerm: string;
    sentenceAfter: string;
    distractors: string[];
  };
  categorize: {
    instruction: string;
    categoryA: string;
    categoryB: string;
    items: { id: string; label: string; target: "A" | "B" }[];
  };
  matching: {
    instruction: string;
    pairs: { id: string; left: string; right: string }[];
  };
  deepDive: {
    expectedSummary: string;
    coreExplanation: string;
    distinctionOrCounterExample: string;
    commonPitfall: string;
    causalChainProTip: string;
  };
}

// Mémoire d'apprentissage par carte (pour ne jamais reposer la même forme)
export interface CardMemoryRecord {
  cardId: string;
  usedModalities: SmartQuestionModality[];
  currentDifficultyTier: 1 | 2 | 3;
  timesCorrect: number;
  timesFailed: number;
  lastAnsweredAt: number;
}

// Paquet enregistré dans la Bibliothèque Smart Flashcards
export interface SmartDeckLibraryEntry {
  id: string;
  title: string;
  subjectTag: string;
  createdAt: number;
  lastStudiedAt: number;
  sessionsCompleted: number;
  averageMastery: number;
  cards: SmartFlashcard[];
  memory: Record<string, CardMemoryRecord>;
}

export const DEFAULT_SMART_CONFIG: SmartFlashcardConfig = {
  cardsPerCycle: 8,
  maxMovesPerCard: 2,
  engineMode: "fluid",
  sortBy: "chronological_course", // Parcourt tout le cours dans l'ordre par défaut
  enabledModalities: [
    "categorize",
    "multiple_choice",
    "word_bank",
    "true_false",
    "matching",
    "fill_blank",
    "open_question",
    "read_understand",
  ],
  swapQuestionAnswer: false,
  soundEffects: true,
  difficultyEscalation: true,
};

export const MODALITY_METADATA: {
  id: SmartQuestionModality;
  label: string;
  badge: string;
  description: string;
}[] = [
  {
    id: "categorize",
    label: "Classer",
    badge: "Glisser-Déposer A/B",
    description: "Trier 4 éléments cliniques ou biologiques dans 2 catégories",
  },
  {
    id: "multiple_choice",
    label: "Choix multiple",
    badge: "Cas Clinique & QCM",
    description: "Sélectionner la réponse exacte parmi 4 propositions de niveau examen",
  },
  {
    id: "word_bank",
    label: "Choix en blanc",
    badge: "Cases à remplir",
    description: "Insérer le terme médical ou académique exact dans l'énoncé",
  },
  {
    id: "true_false",
    label: "Vrai ou faux",
    badge: "Piège d'examen",
    description: "Identifier les pièges subtils dans une affirmation complexe",
  },
  {
    id: "matching",
    label: "Correspondance",
    badge: "Association",
    description: "Relier chaque entité ou classe à sa définition exacte",
  },
  {
    id: "fill_blank",
    label: "Remplir le vide",
    badge: "Saisie active",
    description: "Taper au clavier le concept clé sans aide visuelle",
  },
  {
    id: "open_question",
    label: "Question ouverte",
    badge: "Raisonnement",
    description: "Synthétiser les mécanismes clés évalués par détection sémantique",
  },
  {
    id: "read_understand",
    label: "Lire et comprendre",
    badge: "Ancrage FSRS",
    description: "Auto-évaluation active avec répétition espacée",
  },
];

// ============================================================================
// DECK EXPERT COUVRANT 100 % DU COURS "3_ENZYMOPATHIES.pdf" (PAGES 1 À 31)
// ============================================================================
export const ENZYMOPATHIES_SMART_DECK: SmartFlashcard[] = [
  // SECTION 1 : Généralités, Épidémiologie & Métabolisme Érythrocytaire (Pages 4 à 7)
  {
    id: "enz-sec-1",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "I. Généralités & Métabolisme Érythrocytaire",
    objectiveTitle: "Objectif 1 : Définir les enzymopathies et comparer les 2 voies métaboliques du GR",
    customTags: ["Embden-Meyerhof", "Shunt des pentoses", "Épidémiologie"],
    createdAt: 1001,
    difficulty: 2,
    prompt: "Pourquoi le globule rouge dépend-il simultanément de la voie d'Embden-Meyerhof (PK) et du shunt des pentoses (G6PD), et quelle est la part énergétique exacte de chacune ?",
    variants: {
      level1Prompt: "Définissez une anémie par déficit enzymatique érythrocytaire et précisez ses deux grandes formes historiques.",
      level2Prompt: "Comparez la voie d'Embden-Meyerhof et le shunt des pentoses en termes de rendement en ATP, de cofacteurs produits et d'enzymes clés.",
      level3Prompt: "Expliquez le paradoxe épidémiologique liant la répartition mondiale des enzymopathies érythrocytaires à l'endémie palustre et leurs risques pronostiques à court et long terme.",
    },
    answer:
      "La voie anaérobie d'Embden-Meyerhof (catalysée par la Pyruvate Kinase) fournit 90% de l'ATP (maintien de la déformabilité membranaire), du NADH et du 2,3-DPG. La voie aérobie du shunt des pentoses (catalysée par la G6PD) fournit 10% de l'ATP et surtout le NADPH indispensable à la détoxification des peroxydes.",
    keywords: ["Embden-Meyerhof", "90%", "ATP", "pentoses", "NADPH", "peroxydes"],
    mcq: {
      question: "Concernant le métabolisme énergétique du globule rouge normal et l'épidémiologie des enzymopathies, quelle proposition est exacte ?",
      options: [
        {
          id: "A",
          text: "Le shunt aérobie des pentoses fournit 90% de l'ATP érythrocytaire grâce à la pyruvate kinase.",
          isCorrect: false,
        },
        {
          id: "B",
          text: "La voie anaérobie d'Embden-Meyerhof assure 90% de la production d'ATP, tandis que le shunt des pentoses (G6PD) produit le NADPH et 10% de l'ATP.",
          isCorrect: true,
        },
        {
          id: "C",
          text: "Le déficit en Pyruvate Kinase a été décrit en 1956 chez le sujet noir et protège contre l'ictère nucléaire.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Dans la voie d'Embden-Meyerhof, la G6PD convertit directement le phosphoénolpyruvate (PEP) en lactate.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Le shunt aérobie des pentoses dirigé par la G6PD assure 90% de la synthèse d'ATP du globule rouge, tandis que la voie d'Embden-Meyerhof n'en assure que 10%.",
      isTrue: false,
    },
    cloze: {
      sentenceBefore:
        "Dans la glycolyse anaérobie (voie d'Embden-Meyerhof), la Pyruvate Kinase catalyse la conversion du phosphoénolpyruvate (PEP) en pyruvate, assurant ainsi",
      missingTerm: "90% de l'ATP",
      sentenceAfter: " nécessaire à la survie et à la souplesse membranaire du globule rouge.",
      distractors: ["10% de l'ATP", "la synthèse du NADPH", "la réduction du glutathion"],
    },
    categorize: {
      instruction: "Classe ces caractéristiques métaboliques selon la voie érythrocytaire correspondante",
      categoryA: "Voie d'Embden-Meyerhof (Glycolyse anaérobie)",
      categoryB: "Shunt des Pentoses (Voie aérobie)",
      items: [
        { id: "1", label: "Produit 90% de l'ATP, du NADH et du 2,3-DPG via la Pyruvate Kinase", target: "A" },
        { id: "2", label: "Génère le NADPH (cofacteur antioxydant) et 10% de l'ATP via la G6PD", target: "B" },
        { id: "3", label: "Convertit le PEP en pyruvate puis en lactate", target: "A" },
        { id: "4", label: "Transforme le G6P en GP6 puis R5P pour régénérer le glutathion réduit", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque repère historique ou pronostique du cours à sa caractéristique exacte",
      pairs: [
        { id: "m1", left: "Déficit en G6PD (1956)", right: "Décrit chez le sujet noir, confère une résistance en zone d'endémie palustre" },
        { id: "m2", left: "Déficit en Pyruvate Kinase (1962)", right: "Décrit par Tanaka et coll., responsable d'une anémie hémolytique chronique" },
        { id: "m3", left: "Pronostic à court terme vs long terme", right: "Mise en jeu du pronostic vital par hémolyse aiguë vs suivi médical à vie" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Voie Embden-Meyerhof (PK) = 90% ATP + 2,3-DPG + NADH. Shunt des pentoses (G6PD) = 10% ATP + NADPH.",
      coreExplanation:
        "Le globule rouge mature n'a pas de mitochondries : il tire **90% de son ATP** de la glycolyse anaérobie (**Embden-Meyerhof**, enzyme clé : **PK**) et sa défense antioxydante (**NADPH**) du **shunt des pentoses** (enzyme clé : **G6PD**).",
      distinctionOrCounterExample:
        "Ne pas confondre le **NADH** (produit dans la voie d'Embden-Meyerhof) avec le **NADPH** (produit exclusivement dans le shunt des pentoses pour la glutathion réductase).",
      commonPitfall:
        "Croire que la G6PD sert à produire l'énergie mécanique de la membrane alors que son rôle vital est la détoxification des peroxydes via le glutathion réduit.",
      causalChainProTip:
        "G6PD → NADPH → Glutathion réductase → Glutathion réduit (GSH) → Détoxification des peroxydes.",
    },
  },

  // SECTION 2 : Génétique moléculaire G6PD & Classification OMS (Pages 10, 11, 17, 20)
  {
    id: "enz-sec-2",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "II. Pathogénie G6PD & Classification OMS",
    objectiveTitle: "Objectif 2 : Maîtriser les mutations génétiques G6PD et la Classification OMS (Classes I à V)",
    customTags: ["VAL202MET", "Classification OMS", "Variants G6PD"],
    createdAt: 1002,
    difficulty: 3,
    prompt: "Quelle cascade mutationnelle précise conduit de l'enzyme de référence G6PD (B+) au variant déficitaire G6PD (A-), et comment l'OMS classe-t-elle les variants de Classe I, II et III ?",
    variants: {
      level1Prompt: "Quelle est la différence d'activité enzymatique entre les variants G6PD (B+), G6PD (A+), G6PD (A-) et G6PD (B-) ?",
      level2Prompt: "Décrivez les mutations ponctuelles en acides aminés permettant le passage de G6PD (B+) à G6PD (A+) puis à G6PD (A-).",
      level3Prompt: "Distinguez avec précision les Classes I, II et III de la classification OMS en termes de pourcentage d'activité résiduelle, d'expression clinique et de variants représentatifs.",
    },
    answer:
      "G6PD (B+) [référence] subit la mutation ASP376AA pour donner G6PD (A+) [activité normale chez le sujet noir], qui subit ensuite la mutation ponctuelle VAL202MET (remplacement de la Valine en position 202 par la Méthionine) donnant G6PD (A-) [activité 10-20%, Classe III OMS]. Classe I OMS : <10% avec hémolyse chronique (rare). Classe II OMS : <10% avec hémolyse intermittente sévère (G6PD B- méditerranéen, Mahidol, Canton). Classe III OMS : 10 à 60% avec hémolyse après stress oxydatif (G6PD A-).",
    keywords: ["ASP376AA", "VAL202MET", "Valine", "Méthionine", "Classe II", "Classe III"],
    mcq: {
      question: "En biologie moléculaire et selon la classification OMS du déficit en G6PD, quelle affirmation est strictement exacte ?",
      options: [
        {
          id: "A",
          text: "Le variant G6PD (A-) résulte d'une mutation ponctuelle sur G6PD (A+) remplaçant la valine en position 202 par la méthionine (VAL202MET).",
          isCorrect: true,
        },
        {
          id: "B",
          text: "Le variant G6PD (A+) du sujet noir est classé en Classe II de l'OMS avec une activité inférieure à 10%.",
          isCorrect: false,
        },
        {
          id: "C",
          text: "La Classe I de l'OMS correspond à une activité enzymatique accrue (> 150%) totalement asymptomatique.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Le variant méditerranéen G6PD (B-) appartient à la Classe III de l'OMS avec une activité résiduelle de 10 à 60%.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Dans la classification OMS, la Classe II (variants G6PD B- méditerranéen, Mahidol, Canton) présente une activité inférieure à 10% avec hémolyse intermittente, tandis que la Classe I (< 10%) s'exprime par une hémolyse chronique.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "En biologie moléculaire, le variant déficitaire G6PD (A-) apparaît par mutation ponctuelle sur G6PD (A+) via le remplacement de la valine en position 202 par la",
      missingTerm: "méthionine",
      sentenceAfter: " (mutation VAL202MET).",
      distractors: ["phénylalanine", "cystéine", "glutamine"],
    },
    categorize: {
      instruction: "Classe ces variants et profils selon la Classification OMS du déficit en G6PD",
      categoryA: "Classe II OMS (Déficit sévère < 10% — Hémolyse intermittente)",
      categoryB: "Classe III OMS (Déficit modéré 10 à 60% — Stress oxydatif)",
      items: [
        { id: "1", label: "Variant G6PD (B-) Méditerranéen (activité 0 à 10%)", target: "A" },
        { id: "2", label: "Variant G6PD (A-) du sujet noir porteur de VAL202MET", target: "B" },
        { id: "3", label: "Variants asiatiques Mahidol et Canton (< 10% d'activité)", target: "A" },
        { id: "4", label: "Activité enzymatique résiduelle comprise entre 10 et 60%", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque classe OMS ou mutation à sa définition exacte dans le tableau du cours",
      pairs: [
        { id: "c1", left: "Classe I OMS", right: "Déficit sévère (< 10%) responsable d'une anémie hémolytique chronique (Rare)" },
        { id: "c2", left: "Mutation ASP376AA → VAL202MET", right: "Passage de G6PD (B+) à G6PD (A+) normal, puis à G6PD (A-) déficitaire (10-20%)" },
        { id: "c3", left: "Classes IV et V OMS", right: "Classe IV : 60 à 150% (G6PD B et A normaux) • Classe V : activité accrue > 150%" },
      ],
    },
    deepDive: {
      expectedSummary:
        "G6PD B+ --(ASP376AA)--> G6PD A+ (normal) --(VAL202MET)--> G6PD A- (10-20%, Classe III OMS). G6PD B- (0-10%, Classe II OMS).",
      coreExplanation:
        "Il est crucial de ne pas confondre **G6PD (A+)**, qui est un polymorphisme à **activité normale** chez le sujet noir (Classe IV), avec **G6PD (A-)** qui porte la seconde mutation **VAL202MET** abaissant l'activité à **10-20%**.",
      distinctionOrCounterExample:
        "Bien que les Classes I et II aient toutes deux une activité **< 10%**, la **Classe I** donne une **hémolyse chronique** permanente, alors que la **Classe II** (B-, Mahidol, Canton) donne une **hémolyse intermittente**.",
      commonPitfall:
        "Classer le variant méditerranéen G6PD (B-) en Classe I au lieu de la Classe II OMS.",
      causalChainProTip:
        "G6PD (B+) → ASP376AA → G6PD (A+) normal → VAL202MET (Val202→Met) → G6PD (A-) déficitaire (Classe III).",
    },
  },

  // SECTION 3 : Physiopathologie & Clinique de la Crise Aiguë de G6PD (Pages 12, 13, 14)
  {
    id: "enz-sec-3",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "II.1 Déficit en G6PD — Forme Aiguë & Physiopathologie",
    objectiveTitle: "Objectif 2 : Décrire la double physiopathologie (IV/EV) et la phase d'état de la crise aiguë",
    customTags: ["Crise aiguë", "Corps de Heinz", "CIVD", "IRA"],
    createdAt: 1003,
    difficulty: 2,
    prompt: "Par quels mécanismes respectifs le déficit en G6PD provoque-t-il à la fois une hémolyse intravasculaire (IV) et extravasculaire (EV), et quels sont les signes de gravité à la phase d'état ?",
    variants: {
      level1Prompt: "Quels sont les signes fonctionnels et généraux d'une crise hémolytique aiguë de déficit en G6PD à la phase d'état ?",
      level2Prompt: "Expliquez comment les Corps de Heinz et l'activation du complément conduisent respectivement à l'hémolyse EV et IV dans le déficit en G6PD.",
      level3Prompt: "Devant une crise aiguë survenant 48h après prise de Primaquine, quels paramètres hémodynamiques, urinaires et neurologiques annoncent une complication rénale ou une CIVD ?",
    },
    answer:
      "L'accumulation de toxiques précipite en Corps de Heinz qui s'insèrent dans la membrane et rendent le GR rigide : 1) L'activation du complément lyse les GR dans les vaisseaux → Hémolyse IV → Hémolyse aiguë (urines rouge porto). 2) Les GR rigides sont séquestrés dans la rate → Hémolyse EV. À la phase d'état : fièvre > 38,5°C, tachycardie > 100/min (bruit de galop), polypnée > 20 cycles/min, douleurs lombaires/abdominales, oligo-anurie (urines rouge porto), confusion/obnubilation, risque de choc, CIVD et IRA.",
    keywords: ["complément", "Corps de Heinz", "rate", "porto", "CIVD", "oligo-anurie"],
    mcq: {
      question: "Un patient déficient en G6PD consulte 48h après la prise de primaquine. Parmi les signes suivants de la phase d'état, lequel résulte directement de l'hémolyse intravasculaire par activation du complément ?",
      options: [
        {
          id: "A",
          text: "Une coloration rouge porto des urines accompagnée d'un risque d'oligo-anurie, d'IRA et de CIVD.",
          isCorrect: true,
        },
        {
          id: "B",
          text: "Des déformations osseuses chroniques avec ulcères malléolaires bilatéraux.",
          isCorrect: false,
        },
        {
          id: "C",
          text: "Une bradycardie sinusale < 50 bat/min avec hypothermie à 35°C.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Une hémosidérose tardive isolée sans aucun syndrome anémique aigu.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Dans la physiopathologie du déficit en G6PD, l'activation du complément sur les globules rouges altérés entraîne une hémolyse intravasculaire aiguë, tandis que la séquestration splénique des hématies rigides entraîne une hémolyse extravasculaire.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "À la phase d'état de la crise aiguë de déficit en G6PD, l'hémolyse intravasculaire massive se traduit par des urines de coloration",
      missingTerm: "rouge porto",
      sentenceAfter: " avec un risque majeur d'oligo-anurie, d'insuffisance rénale aiguë et de CIVD.",
      distractors: ["jaune citrin", "brun acajou", "blanc laiteux"],
    },
    categorize: {
      instruction: "Classe les mécanismes et signes cliniques de la crise de G6PD selon leur compartiment",
      categoryA: "Composante d'Hémolyse Intravasculaire (Aiguë / Urgence vitale)",
      categoryB: "Composante d'Hémolyse Extravasculaire (Tissulaire / Splénique)",
      items: [
        { id: "1", label: "Activation du complément et hémoglobinurie (urines rouge porto)", target: "A" },
        { id: "2", label: "Séquestration des globules rouges rigides dans la rate", target: "B" },
        { id: "3", label: "Risque immédiat d'oligo-anurie, d'IRA, de CIVD et d'état de choc", target: "A" },
        { id: "4", label: "Splénomégalie dès l'enfance dans les formes chroniques méditerranéennes", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque paramètre clinique de la phase d'état (G6PD aigu) à sa valeur sémiologique",
      pairs: [
        { id: "p1", left: "Paramètres vitaux (FC, FR, T°)", right: "Fièvre > 38,5°C, Tachycardie > 100 bat/min (bruit de galop), Polypnée > 20 cycles/min" },
        { id: "p2", left: "Signes urinaires & rénaux", right: "Coloration rouge porto des urines, oligo-anurie et risque d'insuffisance rénale aiguë" },
        { id: "p3", left: "Signes neurologiques & hémodynamiques", right: "Sueurs profuses, hypotension/choc, confusion mentale et obnubilation" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Début brutal (1-3j après antipaludéen) : fièvre > 38,5°C, FC > 100/min, FR > 20/min, douleurs abdo/lombaires, urines rouge porto, risque d'IRA, CIVD et choc.",
      coreExplanation:
        "Le schéma physiopathologique du cours montre que l'insertion des **Corps de Heinz** dans la membrane rigidifie le GR : l'**activation du complément** déclenche l'**hémolyse IV** (aiguë), tandis que la **séquestration dans la rate** déclenche l'**hémolyse EV**.",
      distinctionOrCounterExample:
        "À distance des crises dans la forme classique, l'hémogramme est normal et les corps de Heinz n'apparaissent in vitro qu'en cas d'adjonction d'agents oxydants.",
      commonPitfall:
        "Prendre les douleurs abdominales et lombaires fébriles avec urines foncées pour une colique néphrétique ou une pyélonéphrite sans vérifier l'hémoglobine.",
      causalChainProTip:
        "Corps de Heinz → rigidité membranaire + activation du complément → Hémolyse IV brutale → hémoglobinurie (urines porto) → nécrose tubulaire (IRA) & CIVD.",
    },
  },

  // SECTION 4 : Diagnostic Paraclinique G6PD & Formes Chroniques/Néonatales (Pages 15, 16, 17, 19)
  {
    id: "enz-sec-4",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "II.2 Examens Paracliniques G6PD & Formes Néonatales",
    objectiveTitle: "Objectif 2 : Interpréter le bilan paraclinique de certitude et l'ictère néonatal",
    customTags: ["Spectrophotométrie UV", "Spot test Beutler", "Ictère nucléaire"],
    createdAt: 1004,
    difficulty: 3,
    prompt: "Comment différencie-t-on le dosage spectrophotométrique en UV du Spot test de Beutler, et quelle précaution indispensable faut-il prendre lors de l'interprétation pendant une crise ?",
    variants: {
      level1Prompt: "Quels sont les signes hématologiques et biochimiques d'hémolyse lors d'une crise aiguë de déficit en G6PD ?",
      level2Prompt: "Comparez le dosage spectrophotométrique en UV et le Spot test de Beutler pour le diagnostic du déficit en G6PD.",
      level3Prompt: "Pourquoi l'hyper-réticulocytose (> 120 G/l) et l'ictère hémolytique néonatal sans incompatibilité ABO/Rh constituent-ils deux pièges majeurs dans le déficit en G6PD ?",
    },
    answer:
      "Le dosage spectrophotométrique en UV est la méthode quantitative de certitude (10-20% dans la forme sévère, 75-85% dans le déficit partiel), qui DOIT être interprétée en fonction du taux de réticulocytes. Le Spot test de Beutler est un test qualitatif (non quantitatif) basé sur la fluorescence UV du NADPH. Chez le nouveau-né, le déficit en G6PD provoque un ictère hémolytique aigu SANS incompatibilité materno-fœtale ABO ou Rh, avec risque majeur d'ictère nucléaire.",
    keywords: ["spectrophotométrique", "réticulocytes", "Beutler", "fluorescence", "ictère nucléaire"],
    mcq: {
      question: "À propos du diagnostic paraclinique et des formes cliniques du déficit en G6PD, quelle proposition est exacte ?",
      options: [
        {
          id: "A",
          text: "Le Spot test de Beutler est la méthode quantitative de certitude mesurant l'absorbance de l'ATP.",
          isCorrect: false,
        },
        {
          id: "B",
          text: "L'hémogramme de crise montre une anémie profonde (< 6 g/dl) normochrome normocytaire régénérative (> 120 G/l) parfois associée à une hyperleucocytose avec myélémie discrète.",
          isCorrect: true,
        },
        {
          id: "C",
          text: "L'ictère hémolytique néonatal par déficit en G6PD nécessite toujours une incompatibilité materno-fœtale Rhésus associée pour s'exprimer.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Les stigmates biochimiques d'hémolyse associent une haptoglobine élevée et une baisse de la LDH.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Le Spot test de Beutler est un test non quantitatif basé sur la fluorescence UV du NADPH, tandis que le dosage spectrophotométrique en UV est la méthode diagnostique de certitude à interpréter selon le taux de réticulocytes.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "Chez le nouveau-né déficient en G6PD, la survenue fréquente d'une anémie hémolytique aiguë sans incompatibilité ABO ou Rh expose au risque neurologique grave d'",
      missingTerm: "ictère nucléaire",
      sentenceAfter: ".",
      distractors: ["hématome sous-dural", "hydrocéphalie", "méningite purulente"],
    },
    categorize: {
      instruction: "Classe ces éléments paracliniques et cliniques selon leur catégorie diagnostique",
      categoryA: "Dosage Spectrophotométrique UV (Certitude)",
      categoryB: "Spot Test de Beutler & Biochimie d'hémolyse",
      items: [
        { id: "1", label: "Méthode quantitative de certitude interprétée selon les réticulocytes", target: "A" },
        { id: "2", label: "Mesure précise : 10-20% (forme sévère) vs 75-85% (déficit partiel)", target: "A" },
        { id: "3", label: "Test non quantitatif basé sur la fluorescence UV du NADPH", target: "B" },
        { id: "4", label: "Haptoglobine abaissée, Bilirubine libre et LDH augmentées", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque présentation clinique du déficit en G6PD à ses caractéristiques",
      pairs: [
        { id: "f1", left: "Forme latente (fréquente)", right: "Découverte fortuite ou enquête familiale, aucun signe clinique ni hématologique" },
        { id: "f2", left: "Anémie hémolytique chronique (G6PD B-)", right: "Manifestation rare avec Triade de Chauffard et poussées lors de fièvre ou prise médicamenteuse" },
        { id: "f3", left: "Ictère hémolytique néonatal", right: "Fréquent dans tous les types de déficit, sans incompatibilité ABO/Rh, risque d'ictère nucléaire" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Hb < 6 g/dl normocytaire régénérative (> 120 G/l), Corps de Heinz, Haptoglobine basse, Spectrophotométrie UV (certitude, selon réticulocytes) vs Beutler (qualitatif).",
      coreExplanation:
        "Lors de la crise, la moelle libère massivement des **réticulocytes (> 120 G/l)** et parfois une **hyperleucocytose avec myélémie discrète**. Comme les réticulocytes jeunes ont une activité G6PD plus haute que les GR âgés détruits, le dosage **spectrophotométrique** doit impérativement être interprété en fonction du taux de réticulocytes.",
      distinctionOrCounterExample:
        "Contrairement à la maladie hémolytique du nouveau-né classique, l'ictère néonatal du G6PD survient **sans incompatibilité materno-fœtale Rh ou ABO**.",
      commonPitfall:
        "Éliminer à tort un déficit en G6PD devant un dosage subnormal réalisé juste après une crise réticulocytaire intense.",
      causalChainProTip:
        "Hémolyse aiguë néonatale → montée rapide de la bilirubine libre non conjuguée → passage de la barrière hémato-encéphalique → risque d'ictère nucléaire.",
    },
  },

  // SECTION 5 : Déficit en Pyruvate Kinase (PK) (Pages 21 à 24)
  {
    id: "enz-sec-5",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "III. Déficit en Pyruvate Kinase (PK)",
    objectiveTitle: "Objectif 4 : Décrire la physiopathologie, la clinique et le test d'auto-hémolyse du déficit en PK",
    customTags: ["Pyruvate Kinase", "Auto-hémolyse 48h", "ATP", "Triade de Chauffard"],
    createdAt: 1005,
    difficulty: 3,
    prompt: "Pourquoi le test d'auto-hémolyse après 48h d'incubation à 37°C est-il corrigé par l'ATP mais PAS par le glucose dans le déficit en Pyruvate Kinase ?",
    variants: {
      level1Prompt: "Quels sont les signes cliniques et les complications chroniques du déficit en Pyruvate Kinase ?",
      level2Prompt: "Décrivez la cascade physiopathologique reliant la baisse de Pyruvate Kinase à la séquestration splénique.",
      level3Prompt: "Interprétez les résultats du frottis sanguin, du dosage enzymatique et du test d'auto-hémolyse à 48h à 37°C (avec glucose vs avec ATP) dans le déficit en PK.",
    },
    answer:
      "Le déficit en PK bloque la dernière étape de la glycolyse : l'ajout de glucose ne permet donc pas de produire de l'ATP. En revanche, l'ajout direct d'ATP in vitro corrige l'auto-hémolyse à 48h à 37°C. La chute d'ATP altère la membrane (modifications des échanges ioniques, perte des lipides, baisse de déformabilité du GR) → séquestration splénique → hémolyse chronique (Triade de Chauffard, lithiase biliaire, ulcère de jambe, déformations osseuses, crises de déglobulisation infectieuses). Activité PK ≤ 30%.",
    keywords: ["ATP", "glucose", "48h", "lipides", "Chauffard", "30%"],
    mcq: {
      question: "Quel profil paraclinique permet d'affirmer le diagnostic de déficit en Pyruvate Kinase devant une anémie hémolytique chronique ?",
      options: [
        {
          id: "A",
          text: "Une auto-hémolyse des GR à 48h à 37°C augmentée, corrigée par l'ajout de glucose mais non par l'ATP.",
          isCorrect: false,
        },
        {
          id: "B",
          text: "Une auto-hémolyse des GR après 48h à 37°C augmentée, corrigée par l'ATP et non par le glucose, avec une activité PK effondrée (≤ 30%).",
          isCorrect: true,
        },
        {
          id: "C",
          text: "Une anémie microcytaire arégénérative avec présence constante de Corps de Heinz.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Une activité enzymatique supérieure à 85% associée à une haptoglobine augmentée.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Dans le déficit en Pyruvate Kinase, l'auto-hémolyse des globules rouges après 48h à 37°C est corrigée par l'adjonction de glucose car la voie d'Embden-Meyerhof reste fonctionnelle en aval.",
      isTrue: false,
    },
    cloze: {
      sentenceBefore:
        "Dans le déficit en Pyruvate Kinase, l'auto-hémolyse des GR après 48h à 37°C est augmentée et spécifiquement corrigée par l'",
      missingTerm: "ATP",
      sentenceAfter: " et non par le glucose, avec une activité enzymatique résiduelle ≤ 30%.",
      distractors: ["addition de glucose", "adjonction de NADPH", "injection de primaquine"],
    },
    categorize: {
      instruction: "Classe les éléments physiopathologiques et paracliniques du déficit en Pyruvate Kinase",
      categoryA: "Conséquences membranaires & paracliniques de la chute d'ATP",
      categoryB: "Manifestations cliniques & Complications évolutives (PK)",
      items: [
        { id: "1", label: "Perte des lipides membranaires, trouble des échanges ioniques et rigidité du GR", target: "A" },
        { id: "2", label: "Auto-hémolyse à 48h à 37°C corrigée par l'ATP (et non par le glucose) & activité ≤ 30%", target: "A" },
        { id: "3", label: "Triade de Chauffard et crises aiguës de déglobulisation déclenchées par les infections", target: "B" },
        { id: "4", label: "Complications chroniques : lithiase biliaire, ulcère de jambe et déformations osseuses", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque circonstance ou examen du déficit en PK à sa réalité clinique",
      pairs: [
        { id: "pk1", left: "Circonstances de découverte fortuites", right: "Hémogramme systématique, bilan d'une splénomégalie ou enquête familiale" },
        { id: "pk2", left: "Hémogramme & Frottis sanguin", right: "Anémie variable normocytaire ou macrocytaire régénérative avec anisopoïkilocytose" },
        { id: "pk3", left: "Complications aiguës vs chroniques", right: "Crise de déglobulisation sur infection vs lithiase biliaire, ulcère de jambe, déformations osseuses" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Déficit en PK (activité ≤ 30%) → chute ATP → perte lipides + fuite ionique + baisse déformabilité → séquestration splénique → Triade de Chauffard. Auto-hémolyse à 48h corrigée par l'ATP et non par le glucose.",
      coreExplanation:
        "Comme la **Pyruvate Kinase** agit tout en bas de la glycolyse (passage du PEP au pyruvate), apporter du **glucose** en amont est inutile pour restaurer la synthèse d'ATP. Seul l'apport direct d'**ATP** corrige l'auto-hémolyse à l'étuve à 37°C.",
      distinctionOrCounterExample:
        "À l'inverse, dans le déficit en **Pyrimidine 5'-nucléotidase**, l'auto-hémolyse à l'étuve est **corrigée par le glucose**.",
      commonPitfall:
        "Confondre la correction par l'ATP (déficit en PK) et la correction par le glucose (déficit en Pyrimidine 5'-nucléotidase).",
      causalChainProTip:
        "Déficit PK (≤ 30%) → chute ATP → altération membranaire (perte lipides + échanges ioniques) → séquestration splénique → hémolyse chronique + lithiase biliaire.",
    },
  },

  // SECTION 6 : Autres Déficits Enzymatiques : Pyrimidine 5'-nucléotidase & GPI (Pages 25 et 26)
  {
    id: "enz-sec-6",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "IV. Autres Déficits Enzymatiques (P5'N & GPI)",
    objectiveTitle: "Objectif 4 : Distinguer le déficit en Pyrimidine 5'-nucléotidase et le déficit en GPI",
    customTags: ["Pyrimidine 5'-nucléotidase", "Ponctuations basophiles", "GPI"],
    createdAt: 1006,
    difficulty: 3,
    prompt: "Quels signes cytologiques au frottis sanguin et quels seuils d'activité enzymatique permettent de distinguer un déficit en Pyrimidine 5'-nucléotidase d'un déficit en Phosphohexose isomérase (GPI) ?",
    variants: {
      level1Prompt: "Quelles sont les caractéristiques cliniques et biologiques du déficit en Pyrimidine 5'-nucléotidase ?",
      level2Prompt: "Comparez le frottis sanguin et le test d'auto-hémolyse du déficit en Pyrimidine 5'-nucléotidase avec ceux du déficit en PK.",
      level3Prompt: "Distinguez avec précision le déficit en Pyrimidine 5'-nucléotidase et le déficit en Glucose Phosphate Isomérase (GPI) sur le plan morphologique, évolutif et enzymatique.",
    },
    answer:
      "1) Déficit en Pyrimidine 5'-nucléotidase (enfant/adolescent) : anémie modérée (8 à 10 g/dl), Triade de Chauffard, lithiase vésiculaire, hémosidérose tardive, crises érythroblastopéniques ; frottis typique avec hématies à ponctuations basophiles, auto-hémolyse à l'étuve augmentée et corrigée par le glucose, activité ≤ 10%. 2) Déficit en Phosphohexose isomérase (GPI) : hémolyse chronique avec splénomégalie constante, anémie macrocytaire, frottis montrant des microsphérocytes et des hématies à spicules, activité enzymatique entre 10 et 30%.",
    keywords: ["ponctuations basophiles", "glucose", "microsphérocytes", "spicules", "érythroblastopéniques"],
    mcq: {
      question: "Chez un adolescent présentant une triade de Chauffard et une anémie modérée à 9 g/dl, la découverte sur le frottis sanguin d'hématies à ponctuations basophiles avec une auto-hémolyse corrigée par le glucose oriente vers :",
      options: [
        {
          id: "A",
          text: "Un déficit en Pyrimidine 5'-nucléotidase (avec activité enzymatique ≤ 10%).",
          isCorrect: true,
        },
        {
          id: "B",
          text: "Un déficit en Phosphohexose isomérase (GPI) caractérisé par des microsphérocytes.",
          isCorrect: false,
        },
        {
          id: "C",
          text: "Un déficit en G6PD de Classe V OMS à activité accrue.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Un déficit en Pyruvate Kinase non corrigé par le glucose.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Le déficit en Phosphohexose isomérase (GPI) se caractérise par une splénomégalie constante, une anémie macrocytaire, une activité enzymatique de 10 à 30% et la présence de microsphérocytes et d'hématies à spicules au frottis.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "Dans le déficit en Pyrimidine 5'-nucléotidase, le frottis sanguin met en évidence des hématies à",
      missingTerm: "ponctuations basophiles",
      sentenceAfter: " et l'auto-hémolyse à l'étuve est corrigée par le glucose.",
      distractors: ["corps de Heinz", "anneaux de Cabot", "cristaux falciformes"],
    },
    categorize: {
      instruction: "Classe ces signes cliniques et biologiques selon l'enzymopathie rare correspondante",
      categoryA: "Déficit en Pyrimidine 5'-nucléotidase",
      categoryB: "Déficit en Phosphohexose Isomérase (GPI)",
      items: [
        { id: "1", label: "Frottis : Hématies à ponctuations basophiles & activité ≤ 10%", target: "A" },
        { id: "2", label: "Auto-hémolyse à l'étuve corrigée par le glucose & anémie modérée (8-10 g/dl)", target: "A" },
        { id: "3", label: "Frottis : Microsphérocytes et hématies à spicules (activité 10-30%)", target: "B" },
        { id: "4", label: "Splénomégalie constante avec anémie variable macrocytaire", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque déficit enzymatique du cours à son anomalie cytologique clé au frottis",
      pairs: [
        { id: "cy1", left: "Déficit en G6PD (crise aiguë)", right: "Corps de Heinz (bosse au niveau de la membrane érythrocytaire)" },
        { id: "cy2", left: "Déficit en Pyrimidine 5'-nucléotidase", right: "Hématies à ponctuations basophiles (anémie 8-10 g/dl)" },
        { id: "cy3", left: "Déficit en GPI (Glucose Phosphate Isomérase)", right: "Microsphérocytes et hématies à spicules (anémie macrocytaire)" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Pyrimidine 5'-nucléotidase : ponctuations basophiles, auto-hémolyse corrigée par le glucose, activité ≤ 10%, hémosidérose tardive et crises érythroblastopéniques. GPI : microsphérocytes + hématies à spicules, activité 10-30%.",
      coreExplanation:
        "La **Pyrimidine 5'-nucléotidase** dégrade les ARN ribosomaux résiduels du réticulocyte : son déficit(≤ 10%) entraîne l'accumulation d'agrégats ribosomaux visibles sous forme de **ponctuations basophiles**.",
      distinctionOrCounterExample:
        "Le déficit en **GPI** (10-30% d'activité) donne quant à lui une **anémie macrocytaire** avec **microsphérocytes et hématies à spicules**.",
      commonPitfall:
        "Oublier que le déficit en Pyrimidine 5'-nucléotidase se complique de **lithiase vésiculaire**, d'**hémosidérose tardive** et de **crises érythroblastopéniques**.",
      causalChainProTip:
        "Déficit en Pyrimidine 5'-nucléotidase (≤ 10%) → non-dégradation des nucléotides pyrimidiques → ponctuations basophiles au frottis + hémolyse chronique.",
    },
  },

  // SECTION 7 : Pharmacovigilance & Tableau Officiel des Médicaments dans le G6PD (Pages 27 et 28)
  {
    id: "enz-sec-7",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "V.1 Traitement — Liste Officielle des Médicaments (G6PD)",
    objectiveTitle: "Objectif 3 & 5 : Maîtriser le tableau des médicaments contre-indiqués vs utilisables sous réserve",
    customTags: ["Pharmacovigilance", "Contre-indications", "Tableau du cours"],
    createdAt: 1007,
    difficulty: 3,
    prompt: "Dans le tableau officiel des médicaments du cours, quelles sont les molécules formellement contre-indiquées (Colonne 1) par opposition à celles utilisables sous réserve du respect strict de la posologie (Colonne 3) ?",
    variants: {
      level1Prompt: "Citez 5 médicaments formellement contre-indiqués chez un sujet atteint de déficit en G6PD.",
      level2Prompt: "Parmi les antalgiques, antipaludéens et antibiotiques du tableau du cours, lesquels sont interdits et lesquels sont autorisés à posologie strictement respectée ?",
      level3Prompt: "Un patient déficient en G6PD présente une fièvre palustre et une infection urinaire : distinguez avec exactitude les quinolones/sulfamides/antipaludéens contre-indiqués de ceux autorisés sous réserve de posologie.",
    },
    answer:
      "1) Formellement contre-indiqués : Acide nalidixique, Acide pipémidique, Bleu de méthylène injectable, Dapsone, Dimercaprol, Fluméquine, Ciprofloxacine, Lévofloxacine, Ofloxacine, Norfloxacine, Moxifloxacine, Péfloxacine, Énoxacine, Loméfloxacine, Métamizole sodique (Noramidopyrine), Nitrofurantoïne, Phénazone (Antipyrine), Primaquine, Rasburicase, Streptokinase, Sulfamides (Sulfaméthoxazole, Sulfadiazine, Sulfadoxine, Sulfasalazine, Sulfafurazole, Sulfaguanidine, Sulfaméthizol). 2) Utilisables sous réserve que la posologie soit strictement respectée : Acide acétylsalicylique (Aspirine), Acide ascorbique (Vitamine C), Paracétamol, Chloroquine, Hydroxychloroquine, Quinine, Carbutamide, Glibenclamide, Gliclazide, Glimépiride, Glipizide, Phytoménadione (Vitamine K1), Prilocaïne, Spiramycine, Triméthoprime.",
    keywords: ["Primaquine", "Dapsone", "Sulfamides", "Fluoroquinolones", "Paracétamol", "Chloroquine"],
    mcq: {
      question: "D'après le tableau officiel du cours sur le déficit en G6PD, quelle association regroupe UNIQUEMENT des médicaments pouvant être utilisés sous réserve du respect strict de la posologie ?",
      options: [
        {
          id: "A",
          text: "Paracétamol, Chloroquine, Quinine, Spiramycine, Acide acétylsalicylique (Aspirine) et Vitamine K1.",
          isCorrect: true,
        },
        {
          id: "B",
          text: "Primaquine, Ciprofloxacine, Nitrofurantoïne et Bleu de méthylène injectable.",
          isCorrect: false,
        },
        {
          id: "C",
          text: "Dapsone, Sulfaméthoxazole, Rasburicase et Métamizole sodique (Noramidopyrine).",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Acide nalidixique, Ofloxacine, Lévofloxacine et Sulfasalazine.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Selon le tableau officiel du cours, les fluoroquinolones (Ciprofloxacine, Lévofloxacine, Ofloxacine, Moxifloxacine) et la Rasburicase sont contre-indiquées ou déconseillées, tandis que la Spiramycine, la Quinine et le Triméthoprime sont utilisables sous réserve du respect strict de la posologie.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "Parmi les médicaments antipaludéens et antalgiques, la Primaquine et la Noramidopyrine (Métamizole) sont interdites, tandis que la Chloroquine, la Quinine et le",
      missingTerm: "Paracétamol",
      sentenceAfter: " peuvent être utilisés sous réserve que la posologie soit strictement respectée.",
      distractors: ["Bleu de méthylène", "Dimercaprol", "Sulfadoxine"],
    },
    categorize: {
      instruction: "Classe ces molécules du tableau du cours selon leur colonne de sécurité dans le déficit en G6PD",
      categoryA: "Contre-indiqués / Déconseillés (Risque hémolytique)",
      categoryB: "Utilisables sous réserve du respect strict de la posologie",
      items: [
        { id: "1", label: "Primaquine, Dapsone, Rasburicase et Bleu de méthylène injectable", target: "A" },
        { id: "2", label: "Paracétamol, Aspirine, Vitamine C et Vitamine K1 (Phytoménadione)", target: "B" },
        { id: "3", label: "Acide nalidixique, Fluoroquinolones (Ciprofloxacine, Ofloxacine) et Sulfamides", target: "A" },
        { id: "4", label: "Chloroquine, Quinine, Spiramycine et Sulfamides hypoglycémiants (Gliclazide)", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque classe thérapeutique du tableau à sa règle de prescription chez le G6PD",
      pairs: [
        { id: "med1", left: "Antibiotiques interdits / déconseillés", right: "Sulfamides (Sulfaméthoxazole, Sulfadiazine), Quinolones (Ciprofloxacine, Ofloxacine), Nitrofurantoïne, Dapsone" },
        { id: "med2", left: "Anti-infectieux autorisés à dose stricte", right: "Chloroquine, Quinine, Spiramycine, Triméthoprime" },
        { id: "med3", left: "Antalgiques / Antipyrétiques", right: "Métamizole (Noramidopyrine) et Phénazone interdits • Paracétamol et Aspirine autorisés à posologie stricte" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Interdits/Déconseillés : Primaquine, Dapsone, Sulfamides, Quinolones, Nitrofurantoïne, Bleu de méthylène, Rasburicase, Métamizole. Autorisés à posologie stricte : Paracétamol, Aspirine, Vit C, Vit K1, Chloroquine, Quinine, Spiramycine, Glibenclamide/Gliclazide.",
      coreExplanation:
        "Le tableau de la page 28 du cours répartit les molécules en 3 colonnes : les **contre-indiqués absolus** (ex: Primaquine, Dapsone, Sulfamides, Acide nalidixique, Nitrofurantoïne, Métamizole), les **déconseillés** (Fluoroquinolones, Chloroquine/Quinine à forte dose) et ceux **autorisés sous réserve du respect strict de la posologie**.",
      distinctionOrCounterExample:
        "Bien que les **sulfamides antibactériens** (Sulfaméthoxazole, Sulfadoxine) soient contre-indiqués, certains **sulfamides hypoglycémiants** (Glibenclamide, Gliclazide, Glimépiride, Glipizide) figurent dans la colonne 3 sous réserve du respect strict de la posologie.",
      commonPitfall:
        "Dépasser la posologie maximale du Paracétamol, de l'Aspirine ou de la Vitamine C chez un déficient en G6PD (ce qui fait basculer ces molécules en agents hémolysants).",
      causalChainProTip:
        "Remise de la liste écrite des médicaments au patient → vérification systématique avant toute ordonnance → évitement des quinolones/sulfamides/primaquine.",
    },
  },

  // SECTION 8 : Moyens, Posologies, Indications Thérapeutiques & Conclusion (Pages 27, 29, 30, 31)
  {
    id: "enz-sec-8",
    subjectTag: "HÉMATOLOGIE",
    courseSection: "V.2 Moyens, Indications Thérapeutiques & Conclusion",
    objectiveTitle: "Objectif 5 : Énumérer les moyens médicaux/chirurgicaux et les indications selon la forme clinique",
    customTags: ["Acide folique", "Splénectomie", "Exsanguinotransfusion", "Conclusion"],
    createdAt: 1008,
    difficulty: 2,
    prompt: "Quels sont les moyens médicaux et chirurgicaux (avec la posologie exacte de l'acide folique) et comment se répartissent les indications thérapeutiques entre l'hémolyse aiguë, l'hémolyse chronique et la forme néonatale ?",
    variants: {
      level1Prompt: "Quels sont les trois buts du traitement des anémies par déficits enzymatiques ?",
      level2Prompt: "Précisez la posologie de l'acide folique et détaillez les 4 mesures thérapeutiques d'une crise d'hémolyse aiguë sur G6PD (A-) ou (B-).",
      level3Prompt: "Comparez les indications thérapeutiques d'une crise aiguë de G6PD, d'une anémie hémolytique chronique par déficit en PK et d'une anémie hémolytique néonatale.",
    },
    answer:
      "Buts : éviter les facteurs déclenchants, prévenir les complications, améliorer la qualité de vie. Moyens médicaux : Hospitalisation, Acide folique 5 mg à la posologie de 5 à 10 mg/j, Transfusion de Concentrés de Globules Rouges (CGR) compatibilisés, Exsanguinotransfusion. Moyen chirurgical : Splénectomie. Indications : 1) Hémolyse aiguë (G6PD A-, B-) : Hospitalisation + Arrêt du facteur déclenchant + Transfusion de CGR + Réanimation hydro-électrolytique. 2) Hémolyse chronique (PK et autres) : Acide folique (5-10 mg/j) + Splénectomie. 3) Anémie hémolytique néonatale : Exsanguinotransfusion.",
    keywords: ["5 à 10 mg/j", "CGR", "réanimation", "splénectomie", "exsanguinotransfusion"],
    mcq: {
      question: "Quelle est la conduite à tenir complète et exacte devant une crise d'hémolyse aiguë sévère chez un patient porteur d'un déficit en G6PD (A-) ou (B-) ?",
      options: [
        {
          id: "A",
          text: "Hospitalisation, arrêt immédiat du facteur déclenchant, transfusion de CGR compatibilisés et réanimation hydro-électrolytique.",
          isCorrect: true,
        },
        {
          id: "B",
          text: "Splénectomie en urgence immédiate associée à une saignée évacuatrice.",
          isCorrect: false,
        },
        {
          id: "C",
          text: "Traitement ambulatoire par acide folique seul à 1 mg par semaine sans hospitalisation.",
          isCorrect: false,
        },
        {
          id: "D",
          text: "Perfusion intraveineuse de bleu de méthylène et maintien de l'antipaludéen en cours.",
          isCorrect: false,
        },
      ],
    },
    trueFalse: {
      statement:
        "Dans le traitement de fond des hémolyses chroniques (déficit en Pyruvate Kinase et autres déficits), l'acide folique (comprimés à 5 mg) est prescrit à la posologie de 5 à 10 mg/jour en association éventuelle avec la splénectomie.",
      isTrue: true,
    },
    cloze: {
      sentenceBefore:
        "Parmi les moyens médicaux du traitement des hémolyses chroniques, l'acide folique (comprimé à 5 mg) est administré à la posologie quotidienne de",
      missingTerm: "5 à 10 mg/j",
      sentenceAfter: " en complément éventuel de la splénectomie.",
      distractors: ["50 à 100 mg/j", "0,4 mg/semaine", "1 g/j en IV"],
    },
    categorize: {
      instruction: "Classe chaque mesure thérapeutique selon l'indication clinique correspondante du cours",
      categoryA: "Indication : Hémolyse aiguë (G6PD A- / G6PD B-)",
      categoryB: "Indication : Hémolyse chronique (PK, autres) & Néonatale",
      items: [
        { id: "1", label: "Hospitalisation d'urgence & Arrêt immédiat du facteur déclenchant", target: "A" },
        { id: "2", label: "Transfusion de CGR compatibilisés & Réanimation hydro-électrolytique", target: "A" },
        { id: "3", label: "Supplémentation en Acide folique (5 à 10 mg/j) & Splénectomie", target: "B" },
        { id: "4", label: "Exsanguinotransfusion (en cas d'anémie hémolytique néonatale)", target: "B" },
      ],
    },
    matching: {
      instruction: "Associe chaque volet de la prise en charge (Chapitre V & Conclusion) à son contenu exact",
      pairs: [
        { id: "v1", left: "Mesures générales préventives", right: "Éducation du patient et de son entourage + Remise d'une liste des médicaments à éviter" },
        { id: "v2", left: "Moyens médicaux & chirurgicaux", right: "Hospitalisation, Acide folique 5-10 mg/j, CGR compatibilisés, Exsanguinotransfusion, Splénectomie" },
        { id: "v3", left: "Conclusion du cours", right: "Affections rares, 2 tableaux (chronique vs aigu vital), suivi régulier et connaissance des facteurs déclenchants" },
      ],
    },
    deepDive: {
      expectedSummary:
        "Aiguë (G6PD) : Hospitalisation + Arrêt facteur déclenchant + CGR compatibilisés + Réanimation hydro-électrolytique. Chronique (PK) : Acide folique (5-10 mg/j) + Splénectomie. Néonatale : Exsanguinotransfusion.",
      coreExplanation:
        "La prise en charge répond à **3 buts** : éviter les facteurs déclenchants, prévenir les complications et améliorer la qualité de vie. En crise aiguë, le pronostic vital est engagé par l'anémie profonde et le choc/IRA, imposant **CGR compatibilisés + réanimation hydro-électrolytique**.",
      distinctionOrCounterExample:
        "L'**exsanguinotransfusion** est l'indication spécifique de l'**anémie hémolytique néonatale** pour épurer rapidement la bilirubine libre et prévenir l'ictère nucléaire.",
      commonPitfall:
        "Oublier la supplémentation en **acide folique (5 à 10 mg/j)** dans les hémolyses chroniques (PK), ce qui expose au risque de crise mégaloblastique par épuisement des réserves en folates.",
      causalChainProTip:
        "Suivi régulier au long cours + Éducation thérapeutique + Liste des médicaments interdits → prévention des crises aiguës → sauvegarde du pronostic vital.",
    },
  },
];

// ============================================================================
// GESTIONNAIRE DE LA BIBLIOTHÈQUE SMART & ROTATION POLYMORPHE ANTI-RÉPÉTITION
// ============================================================================
const SMART_LIBRARY_STORAGE_KEY = "dawjang_smart_flashcards_library_v3";

export class SmartLibraryManager {
  static getAllDecks(): SmartDeckLibraryEntry[] {
    if (typeof window === "undefined") return [this.getDefaultEnzymopathiesEntry()];
    try {
      // Purge automatique de tout cache obsolète contenant des placeholders interdits
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("smart_flashcards_") || key.includes("smart_flashcards_library"))) {
          const val = localStorage.getItem(key);
          if (val && (val.includes("Catégorie A") || val.includes("Élément 1") || val.includes("Categorie A") || val.includes("Element 1"))) {
            localStorage.removeItem(key);
          }
        }
      }

      const raw =
        localStorage.getItem(SMART_LIBRARY_STORAGE_KEY) ||
        localStorage.getItem("dawjang_smart_flashcards_library_v2");
      if (!raw) {
        const initial = [this.getDefaultEnzymopathiesEntry()];
        localStorage.setItem(SMART_LIBRARY_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed: SmartDeckLibraryEntry[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = [this.getDefaultEnzymopathiesEntry()];
        localStorage.setItem(SMART_LIBRARY_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      // Assainit tous les paquets pour éliminer tout placeholder résiduel
      const sanitized = parsed.map((d) => {
        const hasPlaceholder = d.cards?.some((c: any) =>
          isGenericPlaceholder(c.categorize?.categoryA) ||
          isGenericPlaceholder(c.categorize?.categoryB) ||
          c.categorize?.items?.some((it: any) => isGenericPlaceholder(it.label || it.text))
        );
        if (d.id === "deck-enzymopathies-ucad" || hasPlaceholder) {
          return {
            ...d,
            cards: ENZYMOPATHIES_SMART_DECK,
          };
        }
        return {
          ...d,
          cards: normalizeSmartDeck(d.cards, d.subjectTag),
        };
      });
      localStorage.setItem(SMART_LIBRARY_STORAGE_KEY, JSON.stringify(sanitized));
      return sanitized;
    } catch {
      return [this.getDefaultEnzymopathiesEntry()];
    }
  }

  static getDefaultEnzymopathiesEntry(): SmartDeckLibraryEntry {
    return {
      id: "deck-enzymopathies-ucad",
      title: "Anémies par déficits enzymatiques (Pr Moussa Seck)",
      subjectTag: "HÉMATOLOGIE",
      createdAt: Date.now() - 3600 * 1000,
      lastStudiedAt: Date.now(),
      sessionsCompleted: 0,
      averageMastery: 0,
      cards: ENZYMOPATHIES_SMART_DECK,
      memory: {},
    };
  }

  static saveDeck(entry: SmartDeckLibraryEntry): void {
    if (typeof window === "undefined") return;
    const all = this.getAllDecks();
    const idx = all.findIndex((d) => d.id === entry.id);
    if (idx >= 0) {
      all[idx] = entry;
    } else {
      all.unshift(entry);
    }
    localStorage.setItem(SMART_LIBRARY_STORAGE_KEY, JSON.stringify(all));
  }

  /**
   * Choisit pour chaque carte une NOUVELLE modalité qui n'a pas encore été utilisée
   * et augmente le niveau de formulation (Niveau 1 → Niveau 2 → Niveau 3).
   */
  static buildRotatedQueue(
    deckEntry: SmartDeckLibraryEntry,
    config: SmartFlashcardConfig
  ): {
    card: SmartFlashcard;
    modality: SmartQuestionModality;
    activeTier: 1 | 2 | 3;
    effectivePrompt: string;
    previousModality?: SmartQuestionModality;
  }[] {
    const allowed: SmartQuestionModality[] =
      config.engineMode === "spaced_repetition"
        ? ["read_understand"]
        : config.enabledModalities.length > 0
        ? config.enabledModalities
        : ["categorize", "multiple_choice", "word_bank", "true_false"];

    // S'assure que les cartes utilisées sont strictement assainies de tout placeholder
    const cardsSource =
      deckEntry.id === "deck-enzymopathies-ucad"
        ? ENZYMOPATHIES_SMART_DECK
        : normalizeSmartDeck(deckEntry.cards, deckEntry.subjectTag);

    const cardsCopy = [...cardsSource];
    if (config.sortBy === "random") {
      cardsCopy.sort(() => Math.random() - 0.5);
    } else if (config.sortBy === "weakest_first") {
      cardsCopy.sort((a, b) => {
        const memA = deckEntry.memory[a.id];
        const memB = deckEntry.memory[b.id];
        const errA = (memA?.timesFailed || 0) - (memA?.timesCorrect || 0);
        const errB = (memB?.timesFailed || 0) - (memB?.timesCorrect || 0);
        return errB - errA;
      });
    } else {
      // "chronological_course" : suit l'ordre exact des sections du cours du début à la fin
      cardsCopy.sort((a, b) => a.createdAt - b.createdAt);
    }

    const total = Math.min(config.cardsPerCycle, Math.max(cardsCopy.length, config.cardsPerCycle));
    const queue = [];

    for (let i = 0; i < total; i++) {
      const card = cardsCopy[i % cardsCopy.length];
      const mem = deckEntry.memory[card.id];
      const used = mem?.usedModalities || [];
      const previousModality = used.length > 0 ? used[used.length - 1] : undefined;

      // Filtrer les modalités non encore posées sur cette carte
      const unseenModalities = allowed.filter((m) => !used.includes(m));
      const pool =
        unseenModalities.length > 0
          ? unseenModalities
          : allowed.filter((m) => m !== previousModality);

      const chosenModality =
        pool.length > 0 ? pool[i % pool.length] : allowed[i % allowed.length];

      // Escalade automatique du niveau de difficulté (Tier 1 -> 2 -> 3)
      const activeTier: 1 | 2 | 3 = config.difficultyEscalation
        ? mem?.currentDifficultyTier ||
          (Math.min(3, 1 + deckEntry.sessionsCompleted) as 1 | 2 | 3)
        : card.difficulty;

      const effectivePrompt =
        activeTier === 3 && card.variants?.level3Prompt
          ? card.variants.level3Prompt
          : activeTier === 2 && card.variants?.level2Prompt
          ? card.variants.level2Prompt
          : card.variants?.level1Prompt || card.prompt;

      queue.push({
        card,
        modality: chosenModality,
        activeTier,
        effectivePrompt,
        previousModality,
      });
    }

    return queue;
  }
}

// Vérifie si une valeur est un placeholder générique interdit
function isGenericPlaceholder(str?: string): boolean {
  if (!str || !str.trim()) return true;
  const s = str.trim().toLowerCase();
  if (
    s.includes("catégorie") ||
    s.includes("categorie") ||
    s.includes("élément") ||
    s.includes("element") ||
    s.includes("placeholder")
  ) {
    return true;
  }
  return /^(cat[eéè]gorie(\s*[ab\d]+)?|[\d\s\W]*[eéè]l[eéè]ment(\s*\d+)?|option\s*[abcd\d]+|item\s*\d+|terme\s*alternatif\s*\d+|placeholder)$/i.test(
    s
  );
}

function extractCleanConcept(text: string, maxLen = 68): string {
  const cleaned = text
    .replace(/^(quel(?:le)?s?\s+(?:est|sont)\s+|d[ée]finir\s+|d[ée]crire\s+|citer\s+)/i, "")
    .replace(/\?+$/, "")
    .replace(/\*\*/g, "")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trim() + "…";
}

export function normalizeSmartDeck(
  rawCards: any[],
  fallbackSubject = "HÉMATOLOGIE"
): SmartFlashcard[] {
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return ENZYMOPATHIES_SMART_DECK;
  }

  return rawCards.map((raw, idx) => {
    const fallbackRef =
      ENZYMOPATHIES_SMART_DECK[idx % ENZYMOPATHIES_SMART_DECK.length];

    const prompt = String(raw.prompt || raw.question || fallbackRef.prompt).trim();
    const answer = String(raw.answer || raw.back || fallbackRef.answer).trim();

    const rawMissing = raw.cloze?.missingTerm || raw.wordBank?.correctWord;
    const missingTerm = !isGenericPlaceholder(rawMissing)
      ? String(rawMissing).trim()
      : fallbackRef.cloze.missingTerm;

    const rawDistractors: string[] = Array.isArray(raw.cloze?.distractors)
      ? raw.cloze.distractors.filter((d: string) => !isGenericPlaceholder(d))
      : [];

    const cleanDistractors =
      rawDistractors.length >= 3
        ? rawDistractors.slice(0, 3)
        : fallbackRef.cloze.distractors;

    const rawCatA = raw.categorize?.categoryA;
    const rawCatB = raw.categorize?.categoryB;
    const hasValidCategories =
      !isGenericPlaceholder(rawCatA) && !isGenericPlaceholder(rawCatB);

    const categoryA = hasValidCategories
      ? String(rawCatA).trim()
      : fallbackRef.categorize.categoryA;

    const categoryB = hasValidCategories
      ? String(rawCatB).trim()
      : fallbackRef.categorize.categoryB;

    const rawCatItems = Array.isArray(raw.categorize?.items)
      ? raw.categorize.items
      : [];
    const hasValidCatItems =
      rawCatItems.length >= 4 &&
      rawCatItems.every((it: any) => !isGenericPlaceholder(it?.label || it?.text));

    const normalizedCatItems = hasValidCatItems
      ? rawCatItems.slice(0, 4).map((it: any, i: number) => ({
          id: String(i + 1),
          label: String(it.label || it.text).trim(),
          target: (it.target === "B" || it.correctCategory === "B" ? "B" : "A") as "A" | "B",
        }))
      : fallbackRef.categorize.items;

    const rawMcqOpts = Array.isArray(raw.mcq?.options) ? raw.mcq.options : [];
    const hasValidMcq =
      rawMcqOpts.length === 4 &&
      rawMcqOpts.every((o: any) => !isGenericPlaceholder(o?.text));

    const normalizedMcqOptions = hasValidMcq
      ? rawMcqOpts.map((o: any, i: number) => ({
          id: (["A", "B", "C", "D"] as const)[i],
          text: String(o.text).trim(),
          isCorrect: Boolean(o.isCorrect),
        }))
      : fallbackRef.mcq.options;

    const rawPairs = Array.isArray(raw.matching?.pairs) ? raw.matching.pairs : [];
    const hasValidPairs =
      rawPairs.length >= 3 &&
      rawPairs.every(
        (p: any) => !isGenericPlaceholder(p?.left) && !isGenericPlaceholder(p?.right)
      );

    const normalizedPairs = hasValidPairs
      ? rawPairs.slice(0, 3).map((p: any, i: number) => ({
          id: `pair-${idx}-${i}`,
          left: String(p.left).trim(),
          right: String(p.right).trim(),
        }))
      : fallbackRef.matching.pairs;

    return {
      id: String(raw.id || `smart-card-${idx + 1}`),
      subjectTag: String(raw.subjectTag || raw.tag || fallbackSubject)
        .toUpperCase()
        .replace(/\s+/g, "_"),
      courseSection: String(
        raw.courseSection || fallbackRef.courseSection || `Section ${idx + 1}`
      ),
      objectiveTitle: String(raw.objectiveTitle || fallbackRef.objectiveTitle),
      customTags: Array.isArray(raw.customTags) ? raw.customTags : fallbackRef.customTags,
      createdAt: Number(raw.createdAt || 1000 + idx),
      difficulty: (raw.difficulty === 1 || raw.difficulty === 3 ? raw.difficulty : 2) as 1 | 2 | 3,
      prompt,
      variants: {
        level1Prompt: String(raw.variants?.level1Prompt || prompt),
        level2Prompt: String(
          raw.variants?.level2Prompt || fallbackRef.variants?.level2Prompt || prompt
        ),
        level3Prompt: String(
          raw.variants?.level3Prompt || fallbackRef.variants?.level3Prompt || prompt
        ),
      },
      answer,
      keywords:
        Array.isArray(raw.keywords) && raw.keywords.length > 0
          ? raw.keywords.map(String)
          : fallbackRef.keywords,
      mcq: {
        question: String(raw.mcq?.question || prompt),
        options: normalizedMcqOptions,
      },
      trueFalse: {
        statement: String(raw.trueFalse?.statement || fallbackRef.trueFalse.statement),
        isTrue: Boolean(raw.trueFalse?.isTrue ?? true),
      },
      cloze: {
        sentenceBefore: String(
          raw.cloze?.sentenceBefore || fallbackRef.cloze.sentenceBefore
        ),
        missingTerm,
        sentenceAfter: String(raw.cloze?.sentenceAfter || fallbackRef.cloze.sentenceAfter),
        distractors: cleanDistractors,
      },
      categorize: {
        instruction: String(
          raw.categorize?.instruction ||
            "Classe les éléments dans les catégories correspondantes"
        ),
        categoryA,
        categoryB,
        items: normalizedCatItems,
      },
      matching: {
        instruction: String(
          raw.matching?.instruction || fallbackRef.matching.instruction
        ),
        pairs: normalizedPairs,
      },
      deepDive: {
        expectedSummary: String(
          raw.deepDive?.expectedSummary || fallbackRef.deepDive.expectedSummary
        ),
        coreExplanation: String(
          raw.deepDive?.coreExplanation || fallbackRef.deepDive.coreExplanation
        ),
        distinctionOrCounterExample: String(
          raw.deepDive?.distinctionOrCounterExample ||
            fallbackRef.deepDive.distinctionOrCounterExample
        ),
        commonPitfall: String(
          raw.deepDive?.commonPitfall || fallbackRef.deepDive.commonPitfall
        ),
        causalChainProTip: String(
          raw.deepDive?.causalChainProTip || fallbackRef.deepDive.causalChainProTip
        ),
      },
    };
  });
}
