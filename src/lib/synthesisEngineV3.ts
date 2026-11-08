// ============================================================================
// MOTEUR DE SYNTHÈSE DOCIMOLOGIQUE & MÉDICALE V3 — ARCHITECTURE CALIBRÉE
// Supporte les 4 Doctrines d'Élite + Calibrage Débridé ou Ciblé + Tous Paramètres
// ============================================================================

export type SynthesisDoctrine =
  | 'remnote_structured'
  | 'objectives_verbatim'
  | 'harvard_method'
  | 'arva'
  | 'world_number_one';

export type SynthesisDensityMode =
  | 'unlimited'
  | 'high_density'
  | 'balanced'
  | 'flash'
  | 'custom';

export interface SynthesisConfig {
  doctrine: SynthesisDoctrine;
  /** Mode de densité : 'unlimited' = 100 % exhaustif sans plafond de mots */
  densityMode?: SynthesisDensityMode;
  /** 0 = illimité (couverture intégrale 100 %), > 0 = cible de mots */
  targetWordCount: number;
  objectives: string[];
  verbatimProfessorSyntax: boolean;
  autoRichFormatting: boolean;
  preserveCourseTables: boolean;
  useLogicalConnectors?: boolean;
  strictObjectivesFilter?: boolean;
  includeClinicalPearls?: boolean;
  customInstructions?: string;
}

export const DEFAULT_SYNTHESIS_CONFIG: SynthesisConfig = {
  doctrine: 'objectives_verbatim',
  densityMode: 'unlimited',
  targetWordCount: 0,
  objectives: [],
  verbatimProfessorSyntax: true,
  autoRichFormatting: true,
  preserveCourseTables: true,
  useLogicalConnectors: true,
  strictObjectivesFilter: true,
  includeClinicalPearls: true,
  customInstructions: '',
};

/**
 * Calcule le quota de mots par section (uniquement si un plafond > 0 est demandé).
 * Si targetWordCount <= 0 ou densityMode === 'unlimited', retourne un mode sans plafond.
 */
export function computeSectionQuotas(config: SynthesisConfig): {
  isUnlimited: boolean;
  sectionCount: number;
  wordsPerSection: number;
  minTotalWords: number;
  maxTotalWords: number;
} {
  const isUnlimited =
    config.densityMode === 'unlimited' || !config.targetWordCount || config.targetWordCount <= 0;

  const sectionCount =
    config.objectives.length > 0
      ? config.objectives.length
      : config.doctrine === 'harvard_method'
      ? 4
      : config.doctrine === 'arva'
      ? 4
      : 6;

  if (isUnlimited) {
    return {
      isUnlimited: true,
      sectionCount,
      wordsPerSection: 0,
      minTotalWords: 0,
      maxTotalWords: 0,
    };
  }

  const effectiveTarget = Math.max(300, config.targetWordCount);
  const wordsPerSection = Math.max(120, Math.round(effectiveTarget / sectionCount));
  const minTotalWords = Math.round(effectiveTarget * 0.9);
  const maxTotalWords = Math.round(effectiveTarget * 1.15);

  return {
    isUnlimited: false,
    sectionCount,
    wordsPerSection,
    minTotalWords,
    maxTotalWords,
  };
}

/**
 * Génère le System Prompt dynamique et verrouillé pour le modèle LLM
 * en prenant en compte 100 % des paramètres définis par l'utilisateur.
 */
export function buildDynamicSynthesisPrompt(config: SynthesisConfig): string {
  const quotas = computeSectionQuotas(config);

  const doctrineInstructions: Record<SynthesisDoctrine, string> = {
    remnote_structured: `
### DOCTRINE 0 : ARCHITECTURE COGNITIVE 10 SECTIONS (STYLE REMNOTE / AMBOSS HIGH-YIELD + LATEX)
- Structure obligatoirement la synthèse selon les **10 sections cognitives suivantes** :
  1. \`## 📖 Core Concepts\` (Définitions fondamentales, seuils numériques par population et séquences biologiques avec \`⇒\`)
  2. \`## 📌 Must Remember\` (Faits incontournables, formules mathématiques en LaTeX \`$...$\`, valeurs normales, seuils décisionnels et posologies exactes de fin de cours)
  3. \`## 🔄 Key Processes\` (Démarches diagnostiques étape par étape numérotées, séquences physiologiques et arbres de prise en charge)
  4. \`## 🔍 Key Comparisons\` (Comparaisons binaires entre concepts proches : ex. Anémie centrale vs périphérique, Carence martiale vs Anémie inflammatoire avec flèches ↑/↓)
  5. \`## ⚠️ Common Misunderstandings\` (Idées reçues cliniques ou biologiques corrigées par le cours, faux positifs/négatifs)
  6. \`## 🧠 Mental Models / Intuition\` (Modèles mentaux, logique intuitive en 2 temps et mécanismes de compensation physiopathologique)
  7. \`## 🚩 Exceptions & Edge Cases\` (Cas particuliers, variations de seuils, limites de disponibilité/coût des biomarqueurs)
  8. \`## 📍 When to Use Which\` (Règles d'indication des examens complémentaires et des traitements : \`Utiliser **X** pour Y...\`)
  9. \`## 👀 Patterns to Recognize\` (Associations syndromiques et profils biologiques typiques : \`**Combinaison de signes** : Orientation diagnostique immédiate\`)
  10. \`## 🗂️ Exam Traps\` (Pièges classiques d'examen QCM/EDN, confusions de formules LaTeX, contre-indications thérapeutiques formelles)`,
    objectives_verbatim: `
### DOCTRINE 1 : PAR OBJECTIFS DU COURS (100 % STRUCTURÉ PAR OBJECTIFS)
- Le résumé DOIT être organisé EXCLUSIVEMENT autour des objectifs pédagogiques fournis (ou extraits du cours si la liste est vide).
- Chaque objectif constitue une grande section obligatoire titrée exactement : \`## Objectif N : [Intitulé exact de l'objectif]\`.
- Traite chaque objectif dans son ordre exact d'apparition, sans en fusionner ni en omettre aucun.
- Sous chaque objectif, développe méthodiquement toutes les notions, mécanismes, classifications, critères diagnostiques et conduites à tenir présents dans le cours.`,

    harvard_method: `
### DOCTRINE 2 : MÉTHODE DE HARVARD (4 PILIERS ANALYTIQUES & ILLNESS SCRIPTS)
- Structure l'intégralité du cours selon les **4 Piliers Analytiques de la Harvard Medical School** :
  1. \`## 1. Idée maîtresse & Concept Central\` (Définition officielle, épidémiologie clé, enjeux vitaux et synthèse exécutive de chaque entité du cours)
  2. \`## 2. Mécanisme Physiopathologique\` (Architecture causale complète : étiologies → lésion initiale → cascade cellulaire/hémodynamique → conséquences cliniques avec flèches logiques \`→\`)
  3. \`## 3. Preuve Clinique & Paraclinique\` (Sémiologie discriminante, examen physique, examens complémentaires de 1re intention vs Gold Standard, seuils chiffrés et tableaux différentiels)
  4. \`## 4. Décision Clinique, Thérapeutique & Red Flags\` (Algorithmes de prise en charge, urgences absolues, molécules, posologies, surveillance et pièges d'examen)
- Pour chaque pathologie ou syndrome abordé dans le cours, applique rigoureusement cette grille analytique.`,

    arva: `
### DOCTRINE 3 : MÉTHODE ARVA EXCELLENCE (ACTIVE RECALL & VIGNETTES CLINIQUES)
- Structure la synthèse en **4 Piliers Docimologiques ARVA** haute rétention :
  1. \`## 1. Matrice Active Recall (Questions-Réponses Ciblées)\` : Transforme les concepts fondamentaux, définitions et chiffres clés du cours en paires Question docimologique précise / Réponse synthétique directe.
  2. \`## 2. Scripts Cliniques Différentiels (Illness Scripts)\` : Compare les formes cliniques, étiologies et diagnostics différentiels (Terrain, Sémiologie, Examen clé, Traitement).
  3. \`## 3. Vignette Clinique d'Application & Algorithme Décisionnel\` : Synthétise la démarche diagnostique et thérapeutique sous forme de conduite à tenir graduée (\`Si [Signe/Seuil] → Alors [Action immédiate]\`).
  4. \`## 4. Visas de Révision, Réflexes & Pièges Docimologiques\` : Liste condensée des constantes vitales, triades pathognomoniques, contre-indications absolues et erreurs fatales aux QCM.`,

    world_number_one: `
### DOCTRINE 4 : STANDARD MONDIAL N°1 (SYNTHÈSE AMBOSS / FIRST AID / OXFORD HANDBOOK)
- Architecture encyclopédique ultra-dense inspirée des références médicales internationales (AMBOSS, USMLE First Aid) :
  - Hiérarchie claire par sections thématiques (\`## 1. ...\`, \`## 2. ...\`, etc.) couvrant 100 % du polycopié du début à la fin.
  - Intégration systématique des **Triades/Tétrades cliniques**, **Gold Standards diagnostiques**, **Scores cliniques**, et **Algorithmes thérapeutiques de 1re / 2e intention**.
  - Chaque affirmation est condensée au maximum de sa valeur informative sans aucune phrase de remplissage.`,
  };

  const objectivesBlock =
    config.objectives.length > 0
      ? `### LISTE STRICTE DES OBJECTIFS PÉDAGOGIQUES (${config.objectives.length} sections obligatoires) :
${config.objectives
  .map(
    (obj, idx) =>
      `${idx + 1}. **Objectif ${idx + 1}** : "${obj}"${
        !quotas.isUnlimited ? ` *(Cible : ~${quotas.wordsPerSection} mots)*` : ` *(Couverture 100 % exhaustive)*`
      }`
  )
  .join('\n')}`
      : `### EXTRACTION AUTOMATIQUE DES SECTIONS DU COURS :
Aucun objectif séparé n'ayant été fourni, identifie toutes les parties du cours du début jusqu'à la dernière page (${quotas.sectionCount} grandes sections minimum) et traite-les intégralement.`;

  const volumeBlock = quotas.isUnlimited
    ? `### 1. CALIBRE DE VOLUME : MODE INTÉGRAL DÉBRIDÉ (100 % EXHAUSTIF — ZÉRO PLAFOND DE MOTS)
- **INTERDICTION D'OMETTRE OU DE RÉSUMER SUPERFICIELLEMENT** : Ne fixe aucune limite arbitraire de longueur.
- Couvre le cours **de la première à la toute dernière ligne** avec une exhaustivité chirurgicale.
- Conserve 100 % des valeurs numériques, seuils biologiques, délais horaires, pourcentages, classifications, grades, posologies et critères diagnostiques.`
    : `### 1. CALIBRE DE VOLUME : CALIBRAGE PRÉCIS (${config.targetWordCount} MOTS CIBLÉS)
- **Cible globale** : Rédige entre **${quotas.minTotalWords} et ${quotas.maxTotalWords} mots** au total.
- **Équilibre par section** : Consacre environ **${quotas.wordsPerSection} mots par section** (${quotas.sectionCount} sections) pour que la fin du cours soit aussi bien traitée que le début.
- **Priorité docimologique** : Concentre la densité sur les critères diagnostiques, les seuils chiffrés, la physiopathologie clé et la prise en charge.`;

  const verbatimRule = config.verbatimProfessorSyntax
    ? `- **FIDÉLITÉ VERBATIM PROFESSEUR (ACTIVÉE)** : Conserve scrupuleusement la terminologie exacte, les définitions officielles, les acronymes et les classifications tels qu'énoncés par l'enseignant dans le support source. N'invente aucune donnée externe contradictoire.`
    : `- **REFORMULATION PÉDAGOGIQUE FLUIDE (ACTIVÉE)** : Clarifie et réorganise les passages complexes du cours avec une syntaxe médicale limpide tout en préservant l'exactitude des faits et des chiffres.`;

  const formattingRule = config.autoRichFormatting
    ? `- **MISE EN RELIEF DOCIMOLOGIQUE & MARQUEURS SÉMANTIQUES (ACTIVÉS)** :
  - Mets en **gras (\`**terme**\`)** les concepts pivots, seuils biologiques, signes pathognomoniques et médicaments de 1re intention.
  - Utilise \`✓\` en début de puce pour les **Règles d'or / Examens de référence (Gold Standard) / Conduites à tenir**.
  - Utilise \`⚠️\` en début de puce pour les **Pièges d'examen / Contre-indications / Urgences vitales**.`
    : `- **SOBRIÉTÉ TYPOGRAPHIQUE (ACTIVÉE)** : Utilise une mise en forme sobre et épurée, en réservant le gras uniquement aux titres de sous-parties et aux concepts principaux sans surcharger le texte d'icônes.`;

  const tablesRule = config.preserveCourseTables
    ? `- **TABLEAUX COMPARATIFS MARKDOWN (ACTIVÉS)** : Conserve tous les tableaux du cours et synthétise toute comparaison (diagnostics différentiels, classifications, stades de gravité, classes thérapeutiques) sous forme de **vrais tableaux Markdown GFM** (\`| Critère | Entité A | Entité B |\`).`
    : `- **ZÉRO TABLEAU — LISTES HIÉRARCHIQUES EXCLUSIVES (ACTIVÉ)** : N'utilise **AUCUN tableau Markdown** (\`| ... |\`). Convertis systématiquement toutes les données comparatives et tous les tableaux du cours en **listes à puces hiérarchiques structurées**.`;

  const connectorsRule =
    config.useLogicalConnectors !== false
      ? `- **SYNTAXE TÉLÉGRAPHIQUE & OPÉRATEURS LOGIQUES (ACTIVÉS)** : Utilise les opérateurs logiques médicaux pour condenser les chaînes causales : \`→\` (entraîne / implique), \`↑\` (augmentation), \`↓\` (diminution), \`±\` (inconstant), \`≠\` (différent de).`
      : `- **RÉDACTION COMPLÈTE SANS ABRÉVIATIONS FLÉCHÉES (ACTIVÉE)** : Rédige les liens de causalité en toutes lettres avec des phrases complètes sans utiliser de flèches télégraphiques.`;

  const strictFilterRule =
    config.strictObjectivesFilter !== false
      ? `- **PURGE STRICTE DU BRUIT ET DES HORS-SUJETS (ACTIVÉE)** : Élimine impérativement les métadonnées administratives (noms des professeurs, faculté, dates, numéros de diapositives, objectifs recopiés en préambule, anecdotes historiques non évaluables).`
      : `- **CONTEXTUALISATION ÉLARGIE (ACTIVÉE)** : Conserve les éléments de contexte historique, épidémiologique général et les rappels introductifs du cours.`;

  const clinicalPearlsRule =
    config.includeClinicalPearls !== false
      ? `- **FOCUS CONCOURS, PIÈGES QCM & RED FLAGS (ACTIVÉ)** : À la fin de chaque grande section ou objectif, inclus un sous-bloc synthétique **\`> ⚠️ Pièges d'examen & Réflexes cliniques\`** mettant en évidence les confusions classiques aux QCM et les signes de gravité immédiate.`
      : `- **EXPOSÉ FACTUEL DIRECT (ACTIVÉ)** : Ne rajoute pas d'encadrés supplémentaires de pièges QCM en fin de section ; reste strictement sur le déroulé factuel du cours.`;

  const customRule =
    config.customInstructions && config.customInstructions.trim().length > 0
      ? `\n### 4. DIRECTIVES PERSONNALISÉES DE L'ÉTUDIANT (PRIORITÉ ABSOLUE) :\n${config.customInstructions.trim()}\n`
      : '';

  return `Tu es un Professeur Agrégé de Médecine et Directeur de Rédaction Académique du Studio DawJang.
Ta mission est de produire une synthèse magistrale, d'une précision chirurgicale, prête pour la révision de haut niveau.

${volumeBlock}

${doctrineInstructions[config.doctrine] || doctrineInstructions.objectives_verbatim}

${objectivesBlock}

### 2. RÈGLES DE MISE EN FORME & PARAMÈTRES ACTIFS (À RESPECTER À 100 %) :
- **CORRECTION DES FORMULES OCR EN LATEX VALIDE** : Si le texte brut extrait d'une diapositive a cassé une fraction mathématique (ex: formules de VGM, TCMH, CCMH, Coefficient de saturation, Clairance), rétablis systématiquement la formule complète exacte en LaTeX valide :
  - $VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(millions)}$
  - $TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(millions)}$
  - $CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$
  - $\\%\\,Sat = \\frac{Fer\\,sérique}{CTFS} \\times 100$
- **PROTECTION DES TABLEAUX FLÉCHÉS ET DE LA FIN DU COURS (POSOLOGIES)** : Restitue intégralement les variations fléchées (↑, ↓, N), les arbres décisionnels et 100 % des posologies thérapeutiques des dernières diapositives (doses en mg/j, mg/kg, µg, durées, contre-indications et seuils transfusionnels).
${verbatimRule}
${tablesRule}
${formattingRule}
${connectorsRule}
${strictFilterRule}
${clinicalPearlsRule}
${customRule}
### 3. FORMAT DE SORTIE :
- Rends **UNIQUEMENT** le contenu Markdown final de la synthèse, directement exploitable.
- Ne mets aucun bloc de code englobant (\`\`\`markdown) ni aucune phrase d'introduction ou de conclusion conversationnelle ("Voici votre résumé...").
- Commence immédiatement par le premier titre de section \`## ...\`.`;
}

/**
 * Wrapper compatible avec les Edge Functions et le moteur d'appel direct
 */
export function buildEliteSynthesisPrompt(
  courseText: string,
  objectives: string[],
  config: SynthesisConfig
): {
  systemInstruction: string;
  userPrompt: string;
  quotas: ReturnType<typeof computeSectionQuotas>;
  apiGenerationConfig: { temperature: number; maxOutputTokens: number };
} {
  const effectiveConfig: SynthesisConfig = {
    ...config,
    objectives: objectives.length > 0 ? objectives : config.objectives || [],
  };
  const quotas = computeSectionQuotas(effectiveConfig);
  const systemInstruction = buildDynamicSynthesisPrompt(effectiveConfig);
  const userPrompt = `Voici le texte intégral du cours à synthétiser selon les paramètres exacts définis :\n\n${courseText}`;

  return {
    systemInstruction,
    userPrompt,
    quotas,
    apiGenerationConfig: {
      temperature: 0.15,
      maxOutputTokens: 8192,
    },
  };
}

/**
 * Post-processeur de sécurité : nettoie les artefacts éventuels et vérifie les métriques.
 */
export function postProcessSynthesisOutput(
  rawMarkdown: string,
  config: SynthesisConfig
): {
  cleanedMarkdown: string;
  wordCount: number;
  isWithinBounds: boolean;
  deviationPercent: number;
} {
  const cleaned = rawMarkdown
    // Suppression des blocs de code englobants éventuels
    .replace(/^```(?:markdown|html|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    // Suppression des phrases méta d'introduction IA
    .replace(/^(Voici|Bien sûr|Absolument|En tant que).*?\n+/i, '')
    // Normalisation des séparateurs === Objectif X === en ## Objectif X
    .replace(/^===\s*(.+?)\s*===$/gm, '## $1')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const quotas = computeSectionQuotas(config);
  if (quotas.isUnlimited) {
    return {
      cleanedMarkdown: cleaned,
      wordCount,
      isWithinBounds: true,
      deviationPercent: 0,
    };
  }

  const deviationPercent = Math.round(
    ((wordCount - config.targetWordCount) / Math.max(1, config.targetWordCount)) * 100
  );
  const isWithinBounds =
    wordCount >= quotas.minTotalWords && wordCount <= quotas.maxTotalWords;

  return {
    cleanedMarkdown: cleaned,
    wordCount,
    isWithinBounds,
    deviationPercent,
  };
}
