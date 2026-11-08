// supabase/functions/_shared/summary-engine.ts
// Calculateur de quotas et constructeur de prompt docimologique pour Deno Edge Functions

export type CompressionStyle = 'v1_standard_tables' | 'v2_ultra_compact_lists';
export type LexicalFidelity = 'verbatim_strict' | 'academic_synthesized';
export type DensityPreset = 'flash_350' | 'high_yield_500' | 'standard_900' | 'custom';

export interface SummaryParameters {
  targetWordCount: number;
  compressionStyle: CompressionStyle;
  lexicalFidelity: LexicalFidelity;
  strictObjectivesFilter: boolean;
  useTelegraphicSymbols: boolean;
  surgicalBoldAnchors: boolean;
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

export const DEFAULT_SUMMARY_PARAMS: SummaryParameters = {
  targetWordCount: 500,
  compressionStyle: 'v2_ultra_compact_lists',
  lexicalFidelity: 'verbatim_strict',
  strictObjectivesFilter: true,
  useTelegraphicSymbols: true,
  surgicalBoldAnchors: true,
  displayQuotasInHeaders: true,
};

const CATEGORY_RULES: Array<{
  category: ObjectiveQuota['category'];
  weight: number;
  keywords: RegExp;
}> = [
  {
    category: 'definition',
    weight: 0.8,
    keywords: /\b(définir|définition|concept|terminologie)\b/i,
  },
  {
    category: 'diagnostic_workup',
    weight: 3.5,
    keywords: /\b(démarche|étiologique|étiologies|causes|diagnostiquer|diagnostic différentiel|arbre|orientation)\b/i,
  },
  {
    category: 'treatment',
    weight: 2.0,
    keywords: /\b(traitement|traiter|prise en charge|thérapeutique|indications|posologie|protocole)\b/i,
  },
  {
    category: 'interpretation',
    weight: 1.4,
    keywords: /\b(interpréter|analyser|hémogramme|bilan|examen|constantes|biologique|radiologique)\b/i,
  },
  {
    category: 'mechanisms_clinic',
    weight: 1.3,
    keywords: /\b(décrire|énumérer|mécanismes|physiopathologie|signes|cliniques|symptômes|sémiologie|formes)\b/i,
  },
];

export function calculateObjectiveQuotas(
  objectives: string[],
  totalWords: number
): ObjectiveQuota[] {
  if (!objectives || objectives.length === 0) return [];

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

export function extractObjectivesFromCourseText(text: string): string[] {
  if (!text) return [];

  const objMatch = text.match(
    /(?:objectifs?\s*(?:pédagogiques?|du\s*cours|de\s*la\s*leçon)?)\s*[:\n]([\s\S]*?)(?=(?:--- Diapositive|\n\s*(?:plan|sommaire|chapitre|i[.)]|introduction|généralités)\b|$))/i
  );

  const pool = objMatch ? objMatch[1] : text.slice(0, 5000);
  const lines = pool.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const extracted: string[] = [];
  const verbRegex = /^(?:(?:\d+[.\-)]\s*|Objectif\s*\d+\s*[:.\-)]\s*|[•\-*]\s*))?(définir|citer|décrire|énumérer|lister|expliquer|interpréter|diagnostiquer|classer|comparer|reconnaître|traiter|énoncer|savoir)\b/i;

  for (const line of lines) {
    if (verbRegex.test(line)) {
      const cleaned = line
        .replace(/^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.\-)]|[•\-*])\s*/i, "")
        .trim();
      if (cleaned.length > 5 && !extracted.includes(cleaned)) {
        extracted.push(cleaned);
      }
    }
  }

  return extracted;
}

export function buildCourseSummaryPrompt(
  courseContent: string,
  objectives: string[],
  params: SummaryParameters = DEFAULT_SUMMARY_PARAMS
): { systemInstruction: string; userPrompt: string; quotas: ObjectiveQuota[] } {
  const quotas = calculateObjectiveQuotas(objectives, params.targetWordCount);

  const quotaBlueprint =
    quotas.length > 0
      ? quotas
          .map(
            (q) =>
              `- Objectif ${q.index} ("${q.title}") : Quota strict = ${q.percentage}% (~${q.allocatedWords} mots max)`
          )
          .join('\n')
      : `- Identifie d'abord la diapositive "Objectifs" du cours, puis répartis exactement les ${params.targetWordCount} mots selon cette pondération : Définir (~8%), Mécanismes/Clinique (~12% chacun), Interprétation paraclinique (~15%), Démarche étiologique (~33%), Traitement (~20%).`;

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

EXHAUSTIVITÉ ABSOLUE : Traite l'intégralité des objectifs du premier au dernier sans restriction de longueur ni plafond de mots.

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
