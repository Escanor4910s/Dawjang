// ============================================================================
// summaryEngine.ts — Moteur de Résumé & Calculateur de Quotas Mathématiques
// Découplage strict entre calcul des quotas et compression par IA (T° = 0.1)
// ============================================================================

export type CompressionStyle = 'v1_standard_tables' | 'v2_ultra_compact_lists';
export type LexicalFidelity = 'verbatim_strict' | 'academic_synthesized';
export type DensityPreset = 'flash_350' | 'high_yield_500' | 'standard_900' | 'custom';

export interface SummaryParameters {
  /** Nombre total de mots cible pour l'ensemble du résumé (ex: 500) */
  targetWordCount: number;
  /** V1 (Tableaux + Listes) ou V2 (Zéro tableau, listes 2 niveaux ultra-compactes) */
  compressionStyle: CompressionStyle;
  /** Niveau de fidélité aux mots, phrases et seuils du professeur */
  lexicalFidelity: LexicalFidelity;
  /** Exclure strictement tout contenu hors objectifs (épidémiologie, rappels, etc.) */
  strictObjectivesFilter: boolean;
  /** Forcer l'usage des connecteurs logiques (→, ↑, ↓, N, +) et supprimer les verbes de liaison */
  useTelegraphicSymbols: boolean;
  /** Mettre en gras uniquement les ancres visuelles (seuils chiffrés, examens clés, contre-indications) */
  surgicalBoldAnchors: boolean;
  /** Afficher le quota (% et mots) à côté de chaque titre d'objectif */
  displayQuotasInHeaders: boolean;
}

export interface ObjectiveQuota {
  index: number;
  title: string;
  category: 'definition' | 'mechanisms_clinic' | 'interpretation' | 'diagnostic_workup' | 'treatment' | 'general';
  weight: number;
  percentage: number;
  allocatedWords: number;
}

// ============================================================================
// 2. CONFIGURATION PAR DÉFAUT & MÉTADONNÉES POUR L'INTERFACE (TOOLTIPS)
// ============================================================================

export const DEFAULT_SUMMARY_PARAMS: SummaryParameters = {
  targetWordCount: 500,
  compressionStyle: 'v2_ultra_compact_lists',
  lexicalFidelity: 'verbatim_strict',
  strictObjectivesFilter: true,
  useTelegraphicSymbols: true,
  surgicalBoldAnchors: true,
  displayQuotasInHeaders: true,
};

export const PRESET_BUDGETS: Record<Exclude<DensityPreset, 'custom'>, number> = {
  flash_350: 350,
  high_yield_500: 500,
  standard_900: 900,
};

export const PARAMETER_UI_SCHEMA = {
  targetWordCount: {
    label: 'Budget global de mots',
    tooltip: 'Définit la longueur maximale stricte du résumé. Le moteur répartit automatiquement ce budget entre les objectifs selon leur importance clinique.',
    min: 250,
    max: 1500,
    step: 50,
  },
  compressionStyle: {
    label: 'Architecture de compression',
    tooltip: 'Version 1 : utilise des tableaux comparatifs (idéal entre 800 et 1200 mots). Version 2 : fusionne les tableaux en listes linéaires à 2 niveaux (idéal sous 600 mots).',
    options: [
      { value: 'v1_standard_tables', label: 'Version 1 : Standard (Tableaux & Matrices)' },
      { value: 'v2_ultra_compact_lists', label: 'Version 2 : Ultra-Compact (Zéro tableau, listes denses)' },
    ],
  },
  lexicalFidelity: {
    label: 'Fidélité au cours du professeur',
    tooltip: 'En mode Verbatim Strict, l’IA conserve exactement la terminologie, les seuils chiffrés et la classification de l’enseignant sans synonyme externe.',
    options: [
      { value: 'verbatim_strict', label: 'Verbatim Strict (Mots et seuils exacts du prof)' },
      { value: 'academic_synthesized', label: 'Synthèse Académique (Reformulation fluide)' },
    ],
  },
  strictObjectivesFilter: {
    label: 'Filtrage strict par objectifs',
    tooltip: 'Supprime automatiquement les diapositives d’introduction, d’historique, d’épidémiologie ou de rappels fondamentaux qui ne figurent pas dans les objectifs.',
  },
  useTelegraphicSymbols: {
    label: 'Syntaxe télégraphique (→, ↑, ↓, N)',
    tooltip: 'Remplace les phrases de transition et verbes de liaison par des opérateurs logiques pour économiser jusqu’à 35 % de mots.',
  },
  surgicalBoldAnchors: {
    label: 'Gras chirurgical (Ancres visuelles)',
    tooltip: 'Réserve le gras aux valeurs seuils, examens de référence et contre-indications absolues pour accélérer la lecture rapide.',
  },
  displayQuotasInHeaders: {
    label: 'Afficher les quotas dans les titres',
    tooltip: 'Affiche le pourcentage et le nombre de mots alloués à côté de chaque titre d’objectif.',
  },
};

// ============================================================================
// 3. ALGORITHME DE PONDÉRATION TAXONOMIQUE DES OBJECTIFS
// ============================================================================

const CATEGORY_RULES: Array<{
  category: ObjectiveQuota['category'];
  weight: number;
  keywords: RegExp;
}> = [
  {
    category: 'definition',
    weight: 0.8, // ~7-8% du volume
    keywords: /\b(définir|définition|concept|terminologie)\b/i,
  },
  {
    category: 'diagnostic_workup',
    weight: 3.5, // ~30-35% du volume (cœur décisionnel)
    keywords: /\b(démarche|étiologique|étiologies|causes|diagnostiquer|diagnostic différentiel|arbre|orientation)\b/i,
  },
  {
    category: 'treatment',
    weight: 2.0, // ~18-22% du volume
    keywords: /\b(traitement|traiter|prise en charge|thérapeutique|indications|posologie|protocole)\b/i,
  },
  {
    category: 'interpretation',
    weight: 1.4, // ~12-15% du volume
    keywords: /\b(interpréter|analyser|hémogramme|bilan|examen|constantes|biologique|radiologique)\b/i,
  },
  {
    category: 'mechanisms_clinic',
    weight: 1.3, // ~10-15% du volume
    keywords: /\b(décrire|énumérer|mécanismes|physiopathologie|signes|cliniques|symptômes|sémiologie|formes)\b/i,
  },
];

/**
 * Calcule mathématiquement le quota en % et en mots pour chaque objectif du cours
 */
export function calculateObjectiveQuotas(
  objectives: string[],
  totalWords: number
): ObjectiveQuota[] {
  if (!objectives || objectives.length === 0) return [];

  // 1. Attribution du poids brut selon le verbe d'action / sémantique de l'objectif
  const rawQuotas = objectives.map((objText, idx) => {
    const cleanText = objText.replace(/^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.:\-)])\s*/i, '').trim();
    let matchedCategory: ObjectiveQuota['category'] = 'general';
    let matchedWeight = 1.5;

    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.test(cleanText)) {
        matchedCategory = rule.category;
        matchedWeight = rule.weight;
        break;
      }
    }

    return {
      index: idx + 1,
      title: cleanText,
      category: matchedCategory,
      weight: matchedWeight,
    };
  });

  // 2. Normalisation sur 100% et allocation exacte du budget de mots
  const totalWeight = rawQuotas.reduce((sum, item) => sum + item.weight, 0);

  return rawQuotas.map((item) => {
    const percentage = Math.max(1, Math.round((item.weight / totalWeight) * 100));
    const allocatedWords = Math.max(20, Math.round((item.weight / totalWeight) * totalWords));
    return {
      ...item,
      percentage,
      allocatedWords,
    };
  });
}

/**
 * Détecte et extrait fidèlement TOUS les objectifs pédagogiques depuis la diapositive
 * ou section « Objectifs » du professeur (supporte les objectifs sur 1 ou plusieurs lignes,
 * numérotés, à puces ou introduits par n'importe quel verbe d'action médical).
 */
export function extractObjectivesFromCourseText(text: string): string[] {
  if (!text || !text.trim()) return [];

  const ACTION_VERB_PATTERN =
    /^(?:(?:\d+\s*[.\-):]\s*|Objectif\s*\d+\s*[:.\-)]\s*|[a-z]\s*[.)]\s*|[•\-*❖❑➢▪►●♦◦]\s*))?(définir|citer|décrire|énumérer|lister|expliquer|interpréter|diagnostiquer|classer|comparer|reconnaître|reconnaitre|traiter|énoncer|enoncer|savoir|connaître|connaitre|identifier|poser|réunir|reunir|établir|etablir|proposer|planifier|indiquer|préciser|preciser|discuter|analyser|suspecter|conduire|distinguer|différencier|differencier|prendre|prévenir|prevenir|dépister|depister|orienter|surveiller|maîtriser|maitriser|comprendre|justifier|hiérarchiser|hierarchiser|évaluer|evaluer|rechercher|argumenter|prescrire|adapter|organiser|dégager|degager|rappeler|illustrer|schématiser|schematiser|calculer|mesurer|formuler|déterminer|determiner|synthétiser|synthetiser|appliquer|utiliser|choisir|sélectionner|selectionner|vérifier|verifier|contrôler|controler|gérer|gerer|assurer|réaliser|realiser|effectuer|pratiquer|mettre|déduire|deduire|confirmer|éliminer|eliminer|caractériser|caracteriser|classifier|situer|montrer|démontrer|demontrer)\b/i;

  const EXPLICIT_MARKER_PATTERN =
    /^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.\-):]|[•\-*❖❑➢▪►●♦◦])\s+/i;

  const HEADER_IGNORE_PATTERN =
    /^(?:---\s*Diapositive\s*\d+\s*---|objectifs?(?:\s+pédagogiques?|\s+du\s+cours|\s+de\s+la\s+leçon|\s+spécifiques?|\s*\(suite\))?\s*:?|(?:à|a)\s+la\s+fin\s+de\s+ce\s+cours.*|l['’]étudiant\s+doit\s+être\s+capable\s+de.*|au\s+terme\s+de\s+ce\s+cours.*)$/i;

  const TRAILING_CONNECTOR_PATTERN =
    /\b(?:de|du|des|d['’]|l['’]|la|le|les|un|une|et|ou|à|au|aux|en|dans|par|pour|sur|chez|selon|avec|sans|contre|entre|vers|devant|notamment|particulier|suivants?|suivantes?|tels?\s+que)\s*$/i;

  const CONTINUATION_START_PATTERN =
    /^(?:de|du|des|d['’]|et|ou|à|au|aux|en|dans|par|pour|sur|chez|avec|sans|selon|entre|vers|sous|devant|notamment|ainsi|afin|pendant|après|avant|qui|que|dont|où)\b/i;

  const repairObjectiveOcrText = (raw: string): string => {
    return raw
      .replace(/[\uE000-\uF8FF❖❑➢▪►●♦◦□■▫○◊]/g, " ")
      .replace(
        /(^|[\s:;.!?(-])crire\s+(la|le|les|l['’]|un|une|des|ses|son|sa|ces|principaux|principales|diff[ée]rents|diff[ée]rentes)\b/gi,
        "$1Décrire $2"
      )
      .replace(
        /(^|[\s:;.!?(-])num[ée]rer\s+(la|le|les|l['’]|un|une|des|principaux|principales)\b/gi,
        "$1Énumérer $2"
      )
      .replace(
        /(^|[\s:;.!?(-])[ée]\s*finir\s+(la|le|les|l['’]|un|une)\b/gi,
        "$1Définir $2"
      )
      .replace(/\b([cC])\s+lassification\b/g, "$1lassification")
      .replace(
        /(^|[\s:;.!?(-])lassification\s+(de|du|des|d['’])/gi,
        "$1Classification $2"
      )
      .replace(/\b([Mm]an[oœ]uvre)(de|du|des|d['’])/g, "$1 $2")
      .replace(
        /\b(D[ée]crire|D[ée]finir|Citer|[ÉEe]num[ée]rer|Expliquer|Classer|Classifier)(la|le|les|l['’]|un|une|des)\b/g,
        "$1 $2"
      );
  };

  const splitMergedObjectiveLine = (line: string, dedicatedSlide: boolean): string[] => {
    let working = line.trim();
    // Sépare un nouvel objectif qui commence en milieu de ligne par un marqueur ou un verbe d'action majuscule
    working = working.replace(
      /(?<=.{12,}(?:[A-Z0-9)]|[a-zà-ÿ]{2,}))(?<![,;:(-])\s+(?=(?:Objectif\s*\d+\s*[:.\-)]|\d+[.)]\s+[A-ZÀ-ÿ]|(?:Définir|Citer|Décrire|Énumérer|Lister|Expliquer|Interpréter|Diagnostiquer|Classer|Classifier|Comparer|Reconnaître|Reconnaitre|Traiter|Énoncer|Connaître|Connaitre|Identifier|Poser|Réunir|Établir|Proposer|Planifier|Indiquer|Préciser|Discuter|Analyser|Suspecter|Conduire|Distinguer|Différencier|Prendre|Prévenir|Dépister|Orienter|Surveiller|Maîtriser|Justifier|Hiérarchiser|Évaluer|Rechercher|Argumenter|Prescrire|Adapter|Organiser|Dégager|Rappeler|Illustrer|Schématiser|Calculer|Mesurer|Formuler|Déterminer|Synthétiser|Appliquer|Utiliser|Choisir|Sélectionner|Vérifier|Contrôler|Gérer|Assurer|Réaliser|Effectuer|Pratiquer|Caractériser|Situer|Montrer|Démontrer)\s+(?:la|le|les|l['’]|un|une|des|au|du|d['’])\b))/g,
      "\n"
    );
    // Sur une diapositive dédiée aux objectifs, sépare aussi un syntagme nominal titre suivi de « : » collé après un item complet
    if (dedicatedSlide) {
      working = working.replace(
        /(?<=.{15,}(?:[a-zà-ÿ]{3,}|[A-Z]{3,}|[0-9)]))\s+(?=(?!De\b|Du\b|Des\b|Et\b|Ou\b|En\b|Dans\b|Par\b|Pour\b|Sur\b|Chez\b|Avec\b|Sans\b)[A-ZÀÂÉÈÊËÎÏÔÛÙ][A-Za-zÀ-ÿ'’-]+(?:\s+(?:de|du|des|d['’]|la|le|les|[A-Za-zÀ-ÿ'’-]+)){1,6}\s*:)/g,
        "\n"
      );
    }
    return working
      .split(/\n+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  };

  // 1. Si le document est découpé en diapositives (--- Diapositive N ---), isoler la ou les diapositives d'Objectifs
  const candidateBlocks: string[] = [];
  if (/---\s*Diapositive\s*\d+\s*---/i.test(text)) {
    const slides = text.split(/---\s*Diapositive\s*\d+\s*---/i).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < Math.min(slides.length, 12); i++) {
      const slide = slides[i];
      const firstLines = slide.split(/\r?\n/).slice(0, 4).join(" ");
      if (/\bobjectifs?\b/i.test(firstLines) || /capable\s+de\b/i.test(firstLines)) {
        candidateBlocks.push(slide);
        // Vérifier si la diapositive suivante est la suite des objectifs
        if (i + 1 < slides.length) {
          const nextSlide = repairObjectiveOcrText(slides[i + 1]);
          const nextHeader = nextSlide.split(/\r?\n/)[0]?.trim() || "";
          if (
            /\bobjectifs?\b/i.test(nextHeader) ||
            ACTION_VERB_PATTERN.test(nextHeader) ||
            EXPLICIT_MARKER_PATTERN.test(nextHeader)
          ) {
            candidateBlocks.push(nextSlide);
          }
        }
        break;
      }
    }
  }

  // 2. Fallback si pas de marqueur de diapositive ou si le bloc d'objectifs est dans un texte continu
  if (candidateBlocks.length === 0) {
    const objSectionMatch = text.match(
      /(?:^|\n)\s*(?:objectifs?\s*(?:pédagogiques?|du\s*cours|de\s*la\s*leçon|spécifiques?)?)\s*[:\n]([\s\S]*?)(?=(?:\n\s*---\s*Diapositive|\n\s*(?:PLAN(?:\s+DU\s+COURS)?|SOMMAIRE|CHAPITRE\s+[I1]|INTRODUCTION|GÉNÉRALITÉS|I\s*[.\-)\s]+)\s*(?:\n|$)|$))/i
    );
    if (objSectionMatch && objSectionMatch[1]) {
      candidateBlocks.push(objSectionMatch[1]);
    } else {
      candidateBlocks.push(text.slice(0, 6000));
    }
  }

  const hasDedicatedObjectiveSlide =
    candidateBlocks.length > 0 &&
    (/\bobjectifs?\b/i.test(text.slice(0, 8000)) || /capable\s+de\b/i.test(text.slice(0, 8000)));

  const rawLines = candidateBlocks
    .join("\n")
    .split(/\r?\n/)
    .map((l) => repairObjectiveOcrText(l).trim())
    .filter(Boolean)
    .flatMap((l) => splitMergedObjectiveLine(l, hasDedicatedObjectiveSlide));

  const extracted: string[] = [];

  for (const line of rawLines) {
    if (HEADER_IGNORE_PATTERN.test(line)) continue;
    // Si on tombe sur un titre de chapitre explicite en majuscules seul sur sa ligne, on s'arrête
    if (/^(?:PLAN(?:\s+DU\s+COURS)?|INTRODUCTION|I\s*[.\-)\s]+GÉNÉRALITÉS|I\s*[.\-)\s]+DÉFINITION|PREMIÈRE\s+PARTIE)\s*$/i.test(line)) {
      break;
    }

    const isExplicitItem = EXPLICIT_MARKER_PATTERN.test(line);
    const isActionVerbStart = ACTION_VERB_PATTERN.test(line);
    const cleanedLine = line
      .replace(/^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.\-):]|[a-z]\s*[.)]|[•\-*❖❑➢▪►●♦◦])\s*/i, "")
      .trim();

    if (!cleanedLine) continue;

    const prevObjective = extracted.length > 0 ? extracted[extracted.length - 1] : null;
    const prevHasUnclosedParen =
      prevObjective !== null &&
      (prevObjective.match(/\(/g) || []).length > (prevObjective.match(/\)/g) || []).length;
    const prevNeedsContinuation =
      prevObjective !== null &&
      (TRAILING_CONNECTOR_PATTERN.test(prevObjective) ||
        /[,:\-/–—(]\s*$/.test(prevObjective) ||
        prevHasUnclosedParen ||
        (!isExplicitItem &&
          !isActionVerbStart &&
          (/^[a-zàâçéèêëîïôûùüÿ0-9)]/.test(cleanedLine) ||
            CONTINUATION_START_PATTERN.test(cleanedLine))));

    if (prevNeedsContinuation && extracted.length > 0) {
      extracted[extracted.length - 1] = `${prevObjective} ${cleanedLine}`.replace(/\s+/g, " ").trim();
      continue;
    }

    if (isExplicitItem || isActionVerbStart) {
      if (cleanedLine.length > 4 && !extracted.includes(cleanedLine)) {
        extracted.push(cleanedLine);
      }
    } else if (hasDedicatedObjectiveSlide && extracted.length > 0 && cleanedLine.length > 3) {
      // Sur une diapositive dédiée aux Objectifs, toute ligne autonome commençant par une majuscule (hors connecteur) ouvre un nouvel objectif nominal
      const isNominalObjective =
        /^[A-ZÀÂÉÈÊËÎÏÔÛÙ]/.test(cleanedLine) &&
        !CONTINUATION_START_PATTERN.test(cleanedLine) &&
        (Boolean(prevObjective && /[.;!?]$/.test(prevObjective)) ||
          cleanedLine.includes(":") ||
          /^Classification\s+/i.test(cleanedLine) ||
          cleanedLine.split(/\s+/).length >= 3);

      if (isNominalObjective) {
        if (!extracted.includes(cleanedLine)) {
          extracted.push(cleanedLine);
        }
      } else {
        extracted[extracted.length - 1] = `${prevObjective} ${cleanedLine}`.replace(/\s+/g, " ").trim();
      }
    }
  }

  return extracted.filter((obj) => obj.length > 5);
}

// ============================================================================
// 3B. EXTRACTEUR DÉTERMINISTE STRUCTURÉ (SECOURS HORS-LIGNE MULTI-DIAPOSITIVES)
// ============================================================================

export interface DeterministicObjectiveFallbackParams {
  objectiveTitle: string;
  objectiveIndex: number;
  totalObjectives: number;
  courseText: string;
  courseTitle?: string;
  allObjectives?: string[];
  usedSlideIndices?: Set<number>;
}

const FALLBACK_STOPWORDS = new Set([
  "dans", "pour", "avec", "sans", "chez", "entre", "sous", "vers", "selon",
  "cette", "ces", "cet", "une", "des", "les", "aux", "par", "sur", "qui", "que",
  "dont", "est", "sont", "etre", "avoir", "faire", "peut", "doit", "plus", "tres",
  "tout", "tous", "toute", "toutes", "autre", "autres", "meme", "aussi", "ainsi",
  "cours", "objectif", "objectifs", "chapitre", "diapositive", "definir", "citer",
  "decrire", "enumerer", "lister", "expliquer", "interpreter", "diagnostiquer",
  "classer", "comparer", "reconnaitre", "traiter", "enoncer", "savoir", "connaitre",
  "identifier", "preciser", "aspect", "aspects", "description", "valeur",
  "semiologique", "maladie", "patient", "patients", "prise", "charge",
]);

function normalizeStemToken(word: string): string {
  const base = word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (base.length > 4 && (base.endsWith("s") || base.endsWith("x"))) {
    return base.slice(0, -1);
  }
  return base;
}

function repairFallbackCourseOcr(raw: string): string {
  return raw
    .replace(/[\uE000-\uF8FF❖❑➢▪►●♦◦□■▫○◊]/g, " ")
    .replace(/˃/g, ">")
    .replace(/˂/g, "<")
    .replace(/\b([Mm]an[oœ]uvre)(de|du|des|d['’])/g, "$1 $2")
    .replace(/\b([cC])\s+lassification\b/g, "$1lassification")
    .replace(/(^|[\s:;.!?(-])crire\s+(la|le|les|l['’]|un|une|des)\b/gi, "$1Décrire $2");
}

function tokenizeNormalized(text: string): string[] {
  return text
    .split(/[^a-zA-ZÀ-ÿ0-9]+/)
    .map(normalizeStemToken)
    .filter((t) => t.length >= 3 && !FALLBACK_STOPWORDS.has(t));
}

interface ParsedFallbackSlide {
  index: number;
  heading: string;
  body: string;
  lines: string[];
  tokenSet: Set<string>;
  headingTokenSet: Set<string>;
  isMeta: boolean;
}

function parseSlidesForFallback(
  courseText: string,
  courseTitle = "",
  allObjectives: string[] = []
): ParsedFallbackSlide[] {
  const cleaned = repairFallbackCourseOcr(courseText);
  const rawChunks = /---\s*Diapositive\s*\d+\s*---/i.test(cleaned)
    ? cleaned.split(/---\s*Diapositive\s*\d+\s*---/i)
    : cleaned.split(/\n(?=#{1,3}\s+)|\n{2,}/);

  const objectiveJoinedTokens = new Set(tokenizeNormalized(allObjectives.join(" ")));
  const titleTokens = new Set(tokenizeNormalized(courseTitle));
  const actionLineRe =
    /^(?:[-*•\d.)\s]*)(?:définir|citer|décrire|énumérer|lister|expliquer|interpréter|diagnostiquer|classer|classifier|comparer|reconnaître|traiter|énoncer|connaître|identifier|préciser|signe\s+du)\b/i;

  const parsed: ParsedFallbackSlide[] = [];

  rawChunks.forEach((chunk, rawIdx) => {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.length < 20) return;

    const rawLines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length === 0) return;

    const firstTwo = rawLines.slice(0, 2).join(" ");
    const hasMetaHeader =
      /^(?:objectifs?(?:\s+pédagogiques?|\s+du\s+cours|\s+spécifiques?|\s*\(suite\))?|plan(?:\s+du\s+cours)?|sommaire|table\s+des\s+mati[èe]res|pr[ée]requis|conclusion|bibliographie|r[ée]f[ée]rences|merci)\s*:?$/i.test(
        rawLines[0]
      ) ||
      /\b(?:objectifs?\s+p[ée]dagogiques?|objectifs?\s+du\s+cours|doit\s+[êe]tre\s+capable\s+de)\b/i.test(
        firstTwo
      );

    const actionLineCount = rawLines.filter((l) => l.length <= 160 && actionLineRe.test(l)).length;
    const isObjectivesListSlide = actionLineCount >= 3 && rawLines.length <= 14;

    const slideTokens = tokenizeNormalized(trimmed);
    const isCoverSlide =
      parsed.length === 0 &&
      rawChunks.length > 2 &&
      rawLines.length <= 9 &&
      slideTokens.length <= 35 &&
      (/\b(?:universit[ée]|facult[ée]|fmpos?|ucad|pr\.?\s+|dr\.?\s+|ann[ée]e|cours\s*:|module\s*:|enseignement)/i.test(
        trimmed
      ) ||
        slideTokens.filter((t) => !titleTokens.has(t)).length <= 12);

    let objOverlapCount = 0;
    if (objectiveJoinedTokens.size > 0 && slideTokens.length > 0 && slideTokens.length <= 70) {
      for (const tok of slideTokens) {
        if (objectiveJoinedTokens.has(tok)) objOverlapCount++;
      }
    }
    const heavyObjectiveEcho =
      slideTokens.length > 0 &&
      slideTokens.length <= 65 &&
      objOverlapCount / slideTokens.length > 0.65 &&
      (hasMetaHeader || actionLineCount >= 2);

    const isMeta = hasMetaHeader || isObjectivesListSlide || isCoverSlide || heavyObjectiveEcho;

    parsed.push({
      index: rawIdx,
      heading: rawLines.slice(0, 2).join(" "),
      body: trimmed,
      lines: rawLines,
      tokenSet: new Set(slideTokens),
      headingTokenSet: new Set(tokenizeNormalized(rawLines.slice(0, 2).join(" "))),
      isMeta,
    });
  });

  return parsed;
}

function formatSlideLinesWithoutBrokenAbbr(slides: ParsedFallbackSlide[]): string[] {
  const abbrRe = /\b(M|Dr|Pr|Prof|St|Fig|fig|Ex|ex|Cf|cf|Env|env|Vol|vol|Art|art|[A-Z])\.(?=\s*[a-zA-ZÀ-ÿ0-9])/g;
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const slide of slides) {
    // Reconstitue d'abord les lignes brisées au milieu d'une phrase ou d'une parenthèse (ex: "(M.\nleprae)")
    const joinedLines: string[] = [];
    for (const rawLine of slide.lines) {
      const cleanedLine = rawLine.replace(/^[•\-*▪►●♦◦]\s+/, "").trim();
      if (!cleanedLine) continue;

      const prev = joinedLines.length > 0 ? joinedLines[joinedLines.length - 1] : null;
      const prevUnclosedParen =
        prev !== null && (prev.match(/\(/g) || []).length > (prev.match(/\)/g) || []).length;
      const startsLowerContinuation =
        /^[a-zàâçéèêëîïôûùüÿ,);]/.test(cleanedLine) && !/^(?:ou|et)\b/i.test(cleanedLine);
      const isListMarker = /^(?:\d+\s*[.)\-:]|[a-z]\s*[.)]|[•\-*▪►●♦◦])\s+/.test(rawLine);

      if (
        prev !== null &&
        !isListMarker &&
        (prevUnclosedParen ||
          (startsLowerContinuation && !/[.!?:\]]$/.test(prev)) ||
          /\b(?:de|du|des|d['’]|l['’]|la|le|les|un|une|et|ou|à|au|aux|par|pour|sur|chez|avec|sans)\s*$/i.test(
            prev
          ))
      ) {
        joinedLines[joinedLines.length - 1] = `${prev} ${cleanedLine}`.replace(/\s+/g, " ").trim();
      } else {
        joinedLines.push(cleanedLine);
      }
    }

    for (const line of joinedLines) {
      if (/^---\s*Diapositive/i.test(line)) continue;
      if (line.length <= 2) continue;

      if (line.length <= 240) {
        const key = line.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          bullets.push(`- ${line}`);
        }
      } else {
        const protectedLine = line.replace(abbrRe, "$1__ABBR_DOT__").replace(/\bc\.-à-d\./gi, "c__CAD__");
        const parts = protectedLine
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.replace(/__ABBR_DOT__/g, ".").replace(/c__CAD__/g, "c.-à-d.").trim())
          .filter((s) => s.length > 15);
        for (const p of parts) {
          const key = p.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            bullets.push(`- ${p}`);
          }
        }
      }
    }
  }

  return bullets.slice(0, 30);
}

export function buildDeterministicObjectiveSection(
  params: DeterministicObjectiveFallbackParams
): string {
  const {
    objectiveTitle,
    objectiveIndex,
    totalObjectives,
    courseText,
    courseTitle = "",
    allObjectives = [],
    usedSlideIndices = new Set<number>(),
  } = params;

  const allSlides = parseSlidesForFallback(courseText, courseTitle, allObjectives);
  let contentSlides = allSlides.filter((s) => !s.isMeta);
  if (contentSlides.length === 0) {
    contentSlides = allSlides.length > 1 ? allSlides.slice(1) : allSlides;
  }

  // Calcul des poids IDF pour neutraliser les mots omniprésents (ex. titre du cours sur chaque diapo)
  const docFreq = new Map<string, number>();
  for (const slide of contentSlides) {
    for (const tok of slide.tokenSet) {
      docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
    }
  }
  const titleTokens = new Set(tokenizeNormalized(courseTitle));
  const idfMap = new Map<string, number>();
  for (const [tok, df] of docFreq.entries()) {
    const ratio = df / Math.max(1, contentSlides.length);
    if (ratio > 0.55 || (titleTokens.has(tok) && ratio > 0.35)) {
      idfMap.set(tok, 0.15);
    } else {
      idfMap.set(tok, Math.max(0.5, Math.log((contentSlides.length + 1) / (df + 0.5))));
    }
  }

  const scoreSlideForObjective = (
    slide: ParsedFallbackSlide,
    posIdx: number,
    targetObjectiveTitle: string
  ): { score: number; discriminatingMatches: number } => {
    const tokens = tokenizeNormalized(targetObjectiveTitle);
    const pNames = (
      targetObjectiveTitle.match(
        /(?:\b[A-ZÀÂÉÈÊËÎÏÔÛÙ]{3,}\b|(?<=\b(?:de|du|d['’])\s+)[A-ZÀ-ÿ][a-zà-ÿ]{3,})/g
      ) || []
    ).map(normalizeStemToken);

    const isDef = /^\s*(?:définir|définition)\b/i.test(targetObjectiveTitle);
    const isComp =
      /\b(?:citer|énumérer|lister)\b.*\b(?:complications?|signes?|manifestations?|formes?|étiologies?)\b/i.test(
        targetObjectiveTitle
      );

    let score = 0;
    let discriminatingMatches = 0;

    for (const tok of tokens) {
      const weight = idfMap.get(tok) ?? 1.5;
      if (slide.headingTokenSet.has(tok)) {
        score += weight * 3.5;
        if (weight >= 0.7) discriminatingMatches++;
      } else if (slide.tokenSet.has(tok)) {
        score += weight * 1.6;
        if (weight >= 0.7) discriminatingMatches++;
      }
    }

    for (const pn of pNames) {
      if (pn.length < 3) continue;
      if (slide.headingTokenSet.has(pn)) {
        score += 16;
        discriminatingMatches++;
      } else if (slide.tokenSet.has(pn)) {
        score += 10;
        discriminatingMatches++;
      }
    }

    if (isDef) {
      if (
        /\b(?:d[ée]finition|g[ée]n[ée]ralit[ée]s|est\s+une\s+maladie|se\s+d[ée]finit|agent\s+pathog[èe]ne|bacille|mycobacterium)\b/i.test(
          slide.body
        )
      ) {
        score += 4.5;
      }
      if (posIdx <= Math.max(1, Math.floor(contentSlides.length * 0.25))) {
        score += 1.5;
      }
    }

    if (isComp) {
      if (
        /\b(?:complications?|atteintes?|neuropathies?|griffes?|maux\s+perforants?|paralysies?|l[ée]sions?|ost[ée]o|déformations?)\b/i.test(
          slide.body
        )
      ) {
        score += 3.5;
      }
      if (/\b(?:g[ée]n[ée]ralit[ée]s|d[ée]finition|historique|épidémiologie)\b/i.test(slide.heading)) {
        score *= 0.4;
      }
    }

    return { score, discriminatingMatches };
  };

  const scored = contentSlides.map((slide, posIdx) => {
    const mine = scoreSlideForObjective(slide, posIdx, objectiveTitle);
    let effectiveScore = mine.score;

    // Évite qu'un objectif précoce accapare une diapositive qui appartient manifestement à un autre objectif (ex. Bouvier / Wagner / Froment)
    if (allObjectives.length > 1) {
      let bestOtherScore = 0;
      for (let oi = 0; oi < allObjectives.length; oi++) {
        if (oi === objectiveIndex - 1) continue;
        const other = scoreSlideForObjective(slide, posIdx, allObjectives[oi]);
        if (other.score > bestOtherScore) bestOtherScore = other.score;
      }
      if (bestOtherScore > effectiveScore * 1.15) {
        effectiveScore *= 0.2;
      }
    }

    if (usedSlideIndices.has(slide.index)) {
      effectiveScore *= 0.12;
    }

    return { slide, posIdx, score: effectiveScore, discriminatingMatches: mine.discriminatingMatches };
  });

  const sortedByScore = [...scored].sort((a, b) => b.score - a.score || a.posIdx - b.posIdx);
  const unusedStrong = sortedByScore.filter(
    (item) => !usedSlideIndices.has(item.slide.index) && (item.score >= 3 || item.discriminatingMatches > 0)
  );

  const topScore = unusedStrong[0]?.score ?? 0;
  let selectedItems = unusedStrong
    .filter((item, idx) => idx === 0 || (item.score >= topScore * 0.55 && item.score >= 3))
    .slice(0, 3);

  if (selectedItems.length === 0) {
    const unusedSlides = scored.filter((item) => !usedSlideIndices.has(item.slide.index));
    if (unusedSlides.length > 0) {
      const targetPos = Math.floor(
        ((objectiveIndex - 1) / Math.max(1, totalObjectives)) * unusedSlides.length
      );
      selectedItems = unusedSlides.slice(targetPos, targetPos + 2);
    } else {
      selectedItems = sortedByScore.slice(0, 2);
    }
  }

  selectedItems.sort((a, b) => a.posIdx - b.posIdx);
  for (const item of selectedItems) {
    usedSlideIndices.add(item.slide.index);
  }

  const bulletLines = formatSlideLinesWithoutBrokenAbbr(selectedItems.map((s) => s.slide));

  return [
    `## Objectif ${objectiveIndex} : ${objectiveTitle}`,
    "",
    bulletLines.length > 0
      ? bulletLines.join("\n")
      : `- Synthèse fidèle au cours portant sur : **${objectiveTitle}**.`,
    "",
  ].join("\n");
}

// ============================================================================
// 4. CONSTRUCTEUR DU PROMPT SYSTÈME DYNAMIQUE
// ============================================================================

export function buildCourseSummaryPrompt(
  courseContent: string,
  objectives: string[],
  params: SummaryParameters = DEFAULT_SUMMARY_PARAMS
): { systemInstruction: string; userPrompt: string; quotas: ObjectiveQuota[] } {
  const quotas = calculateObjectiveQuotas(objectives, params.targetWordCount);

  // Formatage de la feuille de route budgétaire par objectif
  const quotaBlueprint =
    quotas.length > 0
      ? quotas
          .map(
            (q) =>
              `- Objectif ${q.index} ("${q.title}") : Quota strict = ${q.percentage}% (~${q.allocatedWords} mots max)`
          )
          .join('\n')
      : `- Identifie d'abord la diapositive "Objectifs" du cours, puis répartis exactement les ${params.targetWordCount} mots selon cette pondération : Définir (~8%), Mécanismes/Clinique (~12% chacun), Interprétation paraclinique (~15%), Démarche étiologique (~33%), Traitement (~20%).`;

  // Règle d'architecture (V1 vs V2)
  const layoutRules =
    params.compressionStyle === 'v2_ultra_compact_lists'
      ? `ARCHITECTURE V2 (ULTRA-COMPACTE — ZÉRO TABLEAU) :
- INTERDICTION ABSOLUE d'utiliser des tableaux Markdown.
- Utilise exclusivement des listes à puces hiérarchiques sur 2 niveaux maximum :
  * Niveau 1 (* **Concept clé** :) : Catégorie principale, constante ou sous-type nosologique.
  * Niveau 2 (  * *Sous-catégorie* :) : Énumération linéaire compacte où les anciennes colonnes de tableaux sont séparées par des points-virgules (;) ou des virgules sur une seule ligne.`
      : `ARCHITECTURE V1 (STANDARD HAUT RENDEMENT — AVEC TABLEAUX) :
- Utilise des tableaux Markdown matriciels pour comparer les mécanismes, les profils étiologiques et les protocoles thérapeutiques.
- Utilise des listes à puces concises pour les définitions et la sémiologie.`;

  // Règle de fidélité lexicale
  const fidelityRules =
    params.lexicalFidelity === 'verbatim_strict'
      ? `FIDÉLITÉ LEXICALE ABSOLUE AU PROFESSEUR (MODE VERBATIM) :
- Reste strictement collé aux mots, aux syntagmes, à la syntaxe et à la classification exacte du professeur dans le support.
- Ne remplace JAMAIS un terme du cours par un synonyme externe.
- Conserve intégralement toutes les valeurs numériques, unités, formules et seuils diagnostiques du cours.
- N'invente et n'ajoute aucune connaissance médicale externe au document fourni.
- INTERDICTION ABSOLUE DE CITER LA PAGE DE GARDE OU LES NOMS D'ENSEIGNANTS (ex. « Pr Moussa Seck »). Extraire uniquement la matière médicale des diapositives de fond.`
      : `FIDÉLITÉ AU COURS :
- Résume uniquement les informations présentes dans le support de cours en conservant toutes les valeurs chiffrées et seuils diagnostiques exacts.`;

  // Règle télégraphique
  const syntaxRules = params.useTelegraphicSymbols
    ? `STYLE TÉLÉGRAPHIQUE & OPÉRATEURS LOGIQUES :
- Supprime tous les verbes de liaison et phrases de transition ("Il faut noter que", "On observe", "Cela permet de").
- Remplace systématiquement les liens de causalité et variations par les symboles : → (conséquence/orientation), ↑ (augmentation), ↓ (baisse), N (normal), + (association).`
    : `STYLE RÉDACTIONNEL :
- Utilise des phrases nominales courtes et directes sans fioritures.`;

  const filterRules = params.strictObjectivesFilter
    ? `FILTRAGE STRICT PAR OBJECTIFS :
- Traite UNIQUEMENT ce qui répond directement aux objectifs du cours.
- EXCLUE TOTALEMENT les diapositives d'introduction, d'historique, d'épidémiologie générale (cartes, prévalences) et les rappels anatomiques ou cytologiques fondamentaux s'ils ne font pas l'objet d'un objectif explicite.`
    : '';

  const boldRules = params.surgicalBoldAnchors
    ? `- GRAS CHIRURGICAL : Réserve le gras (**...**) uniquement aux ancres visuelles critiques (noms des sous-types, seuils chiffrés décisifs, examens clés de confirmation et contre-indications absolues).`
    : '';

  const headerFormat = params.displayQuotasInHeaders
    ? `## [Numéro]. [Titre exact de l'objectif] *(Quota : X % — ~Y mots)*`
    : `## [Numéro]. [Titre exact de l'objectif]`;

  const systemInstruction = `Tu es un moteur d'ingénierie pédagogique médicale inspiré des grandes marques de synthèse clinique (AMBOSS, First Aid, Osmosis).
Ta mission est de transformer un cours magistral en un résumé à très haute densité, gouverné par des quotas de mots stricts.

EXHAUSTIVITÉ ABSOLUE : Traite l'intégralité des objectifs du premier au dernier.
PLAFOND GLOBAL STRICT : ${params.targetWordCount} mots, répartis selon les quotas ci-dessous sans sacrifier les faits médicaux essentiels.

${filterRules}

FEUILLE DE ROUTE DES QUOTAS PAR OBJECTIF :
${quotaBlueprint}

${fidelityRules}

${layoutRules}

${syntaxRules}
${boldRules}

FORMAT DES TITRES DE SECTION :
Utilise exactement ce format pour chaque objectif :
${headerFormat}`;

  const userPrompt = `Voici le contenu extrait du support de cours magistral. Génère le résumé en respectant strictement la feuille de route des quotas et les règles syntaxiques :\n\n${courseContent}`;

  return { systemInstruction, userPrompt, quotas };
}

// ============================================================================
// 5. CONVERTISSEUR MARKDOWN CLINIQUE → HTML HAUTE DENSITÉ POUR LE RÉDACTEUR
// ============================================================================

export function medicalMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inUl = false;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushUl = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
  };

  const flushTable = () => {
    if (inTable) {
      htmlParts.push(`
        <div class="overflow-x-auto my-3 rounded-lg border border-border">
          <table class="w-full text-xs text-left border-collapse">
            ${
              tableHeaders.length > 0
                ? `<thead class="bg-muted text-muted-foreground font-bold">
                    <tr>
                      ${tableHeaders.map((h) => `<th class="p-2.5 border-b border-border">${h}</th>`).join('')}
                    </tr>
                  </thead>`
                : ''
            }
            <tbody class="divide-y divide-border">
              ${tableRows
                .map(
                  (r, idx) => `
                <tr class="${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-muted/50 transition-colors">
                  ${r.map((c) => `<td class="p-2.5 align-top">${c}</td>`).join('')}
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `);
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const inlineFormat = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-primary/95 italic font-medium">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] font-bold text-primary">$1</code>')
      .replace(/→/g, '<span class="text-primary font-bold mx-1">→</span>')
      .replace(/↑/g, '<span class="text-emerald-600 dark:text-emerald-400 font-bold">↑</span>')
      .replace(/↓/g, '<span class="text-rose-600 dark:text-rose-400 font-bold">↓</span>');
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Ligne vide
    if (!line) {
      flushUl();
      flushTable();
      continue;
    }

    // Titre d'objectif (H2)
    const h2Match = line.match(/^##\s+(?:(\d+)\.\s*)?(.*?)(?:\s*\*\((.*?)\)\*)?$/);
    if (h2Match) {
      flushUl();
      flushTable();
      const num = h2Match[1] || `${i + 1}`;
      const title = inlineFormat(h2Match[2].trim());
      const quotaTag = h2Match[3] ? h2Match[3].trim() : null;

      htmlParts.push(`
        <div class="mb-5 mt-6 p-4 rounded-xl border border-primary/25 bg-card/60 shadow-xs space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary uppercase">
                OBJECTIF ${num}
              </span>
              <h2 class="text-base font-serif font-bold text-foreground">
                ${title}
              </h2>
            </div>
            ${
              quotaTag
                ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary text-secondary-foreground border border-border">
                    ${quotaTag}
                  </span>`
                : ''
            }
          </div>
          <div class="pt-1 space-y-2 text-sm text-foreground/90">
      `);
      continue;
    }

    // Fin de div pour les titres
    if (line.startsWith('## ') && htmlParts.length > 0) {
      flushUl();
      flushTable();
      htmlParts.push('</div></div>');
    }

    // Tableau Markdown
    if (line.startsWith('|') && line.endsWith('|')) {
      flushUl();
      if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) {
        // Séparateur de table Markdown
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => inlineFormat(c.trim()));

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Liste à puces de Niveau 2 (indentée)
    if (/^\s{2,}[*•-]\s+/.test(rawLine)) {
      if (!inUl) {
        htmlParts.push('<ul class="space-y-1 pl-6 list-disc text-xs text-foreground/85 my-1">');
        inUl = true;
      }
      const cleanContent = inlineFormat(line.replace(/^[*•-]\s+/, ''));
      htmlParts.push(`<li class="leading-relaxed text-xs pl-1">${cleanContent}</li>`);
      continue;
    }

    // Liste à puces de Niveau 1
    if (/^[*•-]\s+/.test(line)) {
      if (!inUl) {
        htmlParts.push('<ul class="space-y-1.5 pl-4 list-disc text-sm text-foreground/90 my-2">');
        inUl = true;
      }
      const cleanContent = inlineFormat(line.replace(/^[*•-]\s+/, ''));
      htmlParts.push(`<li class="leading-relaxed">${cleanContent}</li>`);
      continue;
    }

    // Paragraphe ordinaire
    flushUl();
    htmlParts.push(`<p class="text-sm font-medium leading-relaxed">${inlineFormat(line)}</p>`);
  }

  flushUl();
  flushTable();

  return htmlParts.join('\n').trim();
}
