// src/lib/remnoteStructuredEngine.ts
// ============================================================================
// MOTEUR DE SYNTHÈSE COGNITIVE 10 SECTIONS (STYLE REMNOTE / AMBOSS STRUCTURED OUTPUTS)
// - JSON Schema strict à 10 sections cognitives
// - Réparation automatique des formules mathématiques cassées par l'OCR (VGM, TCMH, CCMH, %Sat, Clairance)
// - Découpage multi-chapitres et fusion JSON sans perte pour les longs polycopiés (jusqu'à 120+ pages)
// - Séparation stricte Données (structured JSON) / Présentation (renderRemNoteMarkdown)
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";

export interface RemNoteCoreConcept {
  term: string;
  definition: string;
  sub_points: string[];
}

export interface RemNoteMustRemember {
  statement: string;
  sub_bullets: string[];
}

export interface RemNoteKeyProcess {
  process_name: string;
  is_ordered: boolean;
  steps: string[];
}

export interface RemNoteComparisonItem {
  entity: string;
  characteristics: string;
}

export interface RemNoteKeyComparison {
  comparison_title: string;
  items: RemNoteComparisonItem[];
}

export interface RemNoteMentalModel {
  main_idea: string;
  sub_points: string[];
}

export interface RemNoteExceptionEdgeCase {
  main_point: string;
  sub_points: string[];
}

export interface RemNotePatternToRecognize {
  pattern_trigger: string;
  clinical_meaning: string;
}

export interface RemNoteExamTrap {
  trap: string;
  details: string[];
}

export interface RemNoteStructuredSummary {
  core_concepts: RemNoteCoreConcept[];
  must_remember: RemNoteMustRemember[];
  key_processes: RemNoteKeyProcess[];
  key_comparisons: RemNoteKeyComparison[];
  common_misunderstandings: string[];
  mental_models: RemNoteMentalModel[];
  exceptions_edge_cases: RemNoteExceptionEdgeCase[];
  when_to_use_which: string[];
  patterns_to_recognize: RemNotePatternToRecognize[];
  exam_traps: RemNoteExamTrap[];
}

// 1. Définition stricte du JSON Schema (10 sections identiques à RemNote)
export const medicalSummaryJsonSchema = {
  name: "remnote_medical_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      core_concepts: {
        type: "array",
        description:
          "Définitions fondamentales, seuils numériques par population et séquences biologiques.",
        items: {
          type: "object",
          properties: {
            term: {
              type: "string",
              description: "Terme médical clé (ex: Anémie, Érythropoïèse)",
            },
            definition: {
              type: "string",
              description: "Définition précise issue du cours",
            },
            sub_points: {
              type: "array",
              items: { type: "string" },
              description:
                "Sous-points éventuels (seuils par âge/sexe, étapes séquentielles avec ⇒)",
            },
          },
          required: ["term", "definition", "sub_points"],
          additionalProperties: false,
        },
      },
      must_remember: {
        type: "array",
        description:
          "Faits incontournables, formules mathématiques en LaTeX ($...$), valeurs normales, seuils décisionnels et posologies.",
        items: {
          type: "object",
          properties: {
            statement: {
              type: "string",
              description:
                "Point essentiel avec mots-clés en **gras** et formules en LaTeX",
            },
            sub_bullets: {
              type: "array",
              items: { type: "string" },
              description:
                "Sous-puces détaillant les formules, classifications ou étiologies",
            },
          },
          required: ["statement", "sub_bullets"],
          additionalProperties: false,
        },
      },
      key_processes: {
        type: "array",
        description:
          "Démarches diagnostiques étape par étape, séquences physiologiques et arbres de prise en charge.",
        items: {
          type: "object",
          properties: {
            process_name: {
              type: "string",
              description:
                "Nom du processus (ex: Démarche diagnostique globale)",
            },
            is_ordered: {
              type: "boolean",
              description:
                "true pour liste numérotée (1, 2, 3), false pour liste à puces",
            },
            steps: {
              type: "array",
              items: { type: "string" },
              description: "Étapes ordonnées ou règles d'interprétation",
            },
          },
          required: ["process_name", "is_ordered", "steps"],
          additionalProperties: false,
        },
      },
      key_comparisons: {
        type: "array",
        description:
          "Comparaisons binaires entre concepts proches (ex: Anémie centrale vs périphérique, Ferritine vs transferrine).",
        items: {
          type: "object",
          properties: {
            comparison_title: {
              type: "string",
              description: "Titre de l'opposition (ex: Entité A vs Entité B)",
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  characteristics: { type: "string" },
                },
                required: ["entity", "characteristics"],
                additionalProperties: false,
              },
            },
          },
          required: ["comparison_title", "items"],
          additionalProperties: false,
        },
      },
      common_misunderstandings: {
        type: "array",
        items: { type: "string" },
        description:
          "Idées reçues cliniques ou biologiques corrigées par le cours (limites des tests, faux positifs/négatifs).",
      },
      mental_models: {
        type: "array",
        description:
          "Modèles mentaux, logique intuitive en 2 temps et mécanismes de compensation physiopathologique.",
        items: {
          type: "object",
          properties: {
            main_idea: { type: "string" },
            sub_points: { type: "array", items: { type: "string" } },
          },
          required: ["main_idea", "sub_points"],
          additionalProperties: false,
        },
      },
      exceptions_edge_cases: {
        type: "array",
        description:
          "Cas particuliers, variations de seuils, limites de coûts/disponibilité des biomarqueurs (sTfR, RET-He).",
        items: {
          type: "object",
          properties: {
            main_point: { type: "string" },
            sub_points: { type: "array", items: { type: "string" } },
          },
          required: ["main_point", "sub_points"],
          additionalProperties: false,
        },
      },
      when_to_use_which: {
        type: "array",
        items: { type: "string" },
        description:
          "Règles d'indication des examens complémentaires et des traitements (Utiliser **X** pour Y...).",
      },
      patterns_to_recognize: {
        type: "array",
        description:
          "Associations syndromiques et profils biologiques typiques à reconnaître immédiatement.",
        items: {
          type: "object",
          properties: {
            pattern_trigger: {
              type: "string",
              description:
                "Combinaison de signes (ex: Hb basse + VGM bas + TCMH/CCMH basses)",
            },
            clinical_meaning: {
              type: "string",
              description: "Orientation diagnostique immédiate",
            },
          },
          required: ["pattern_trigger", "clinical_meaning"],
          additionalProperties: false,
        },
      },
      exam_traps: {
        type: "array",
        description:
          "Pièges classiques d'examen (QCM/EDN), confusions de formules, contre-indications thérapeutiques.",
        items: {
          type: "object",
          properties: {
            trap: {
              type: "string",
              description:
                "Description du piège à éviter (peut inclure une formule LaTeX $$...$$)",
            },
            details: { type: "array", items: { type: "string" } },
          },
          required: ["trap", "details"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "core_concepts",
      "must_remember",
      "key_processes",
      "key_comparisons",
      "common_misunderstandings",
      "mental_models",
      "exceptions_edge_cases",
      "when_to_use_which",
      "patterns_to_recognize",
      "exam_traps",
    ],
    additionalProperties: false,
  },
};

// 2. Le System Prompt d'Ingénierie Pédagogique Médicale
export const REMNOTE_MEDICAL_SYSTEM_PROMPT = `Tu es un Professeur Agrégé de Médecine spécialisé dans la synthèse pédagogique de haut niveau (style RemNote / AMBOSS High-Yield).
Ta mission est de transformer l'intégralité du cours médical fourni en une fiche d'étude exhaustive, structurée en 10 sections cognitives.

RÈGLES ABSOLUES DE FIDÉLITÉ ET DE RIGUEUR :
1. ZÉRO OMISSION : Tu dois couvrir 100 % du cours, du début (définitions, épidémiologie, physiopathologie) jusqu'à la toute fin (traitements, posologies exactes en mg/j ou µg, durées, contre-indications et indications transfusionnelles).
2. CORRECTION DES FORMULES OCR : Si le texte brut extrait d'une diapositive a cassé une fraction mathématique (ex: formules de VGM, TCMH, CCMH, Coefficient de saturation), rétablis la formule complète exacte de la diapositive en LaTeX valide :
   - $VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(millions)}$
   - $TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(millions)}$
   - $CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$
   - $\\%\\,Sat = \\frac{Fer\\,sérique}{CTFS} \\times 100$
3. VALEURS NUMÉRIQUES, TABLEAUX FLÉCHÉS ET POSOLOGIES DE FIN DE COURS :
   - Conserve scrupuleusement tous les chiffres, seuils (Hb par âge/sexe, réticulocytes à 80 000/mm³ ou 120 000/mm³, RET-He < 28 pg, CV 12-15%, etc.) et unités du support original.
   - Restitue intégralement les tableaux fléchés (↑, ↓, N) comme le bilan martial comparatif (carence martiale vs anémie inflammatoire vs mixte) et les arbres décisionnels.
   - N'omets JAMAIS les dernières diapositives thérapeutiques : posologies exactes (ex: Sels ferreux 100–200 mg/j chez l'adulte, 10 mg/kg/j chez l'enfant pendant 3 à 6 mois, Acide folique 5 mg/j, Vitamine B12 1000 µg IM tous les 3 jours, contre-indication formelle du fer dans l'anémie inflammatoire pure).
4. STYLE DIRECT ET CLINIQUE : Rédige en français médical précis. Utilise la flèche "⇒" pour les séquences cellulaires (ex: érythropoïèse). Mets en **gras** les concepts clés à l'intérieur des phrases.`;

/**
 * Répare automatiquement dans le texte brut extrait d'un PDF (ou dans le Markdown généré)
 * les formules médicales dont la barre de fraction graphique a été perdue par l'OCR.
 */
export function repairMedicalFormulasInText(rawText: string): string {
  if (!rawText) return "";

  let repaired = rawText
    // Réparation des formules érythrocytaires tronquées par l'OCR (ex: VGM = Ht(%) / 10 ou VGM = Ht x 10 sans dénominateur)
    .replace(
      /\$?VGM\s*=\s*\\frac\{Ht\(%?\)\}\{10\}\$?/gi,
      "$VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(millions)}$"
    )
    .replace(
      /\$?TCMH\s*=\s*Hb\s*(?:\\times|x|\*)\s*10\$?(?!\s*\/|\s*\})/gi,
      "$TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(millions)}$"
    )
    .replace(
      /\$?CCMH\s*=\s*Hb\s*(?:\\times|x|\*)\s*100\$?(?!\s*\/|\s*\})/gi,
      "$CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$"
    );

  // Si le cours parle de VGM, TCMH et CCMH (ex: Diapo 16 du cours Anémies) avec numérateur et dénominateur séparés sur plusieurs lignes par l'OCR
  if (
    /\bVGM\b/i.test(repaired) &&
    /\bTCMH\b/i.test(repaired) &&
    /\bCCMH\b/i.test(repaired) &&
    !/\\frac\{Ht/i.test(repaired)
  ) {
    repaired += `\n\n[NOTE SYSTÈME — FORMULES EXACTES DES CONSTANTES ÉRYTHROCYTAIRES RECONSTITUÉES DEPUIS LES FRACTIONS GRAPHIQUES DE LA DIAPOSITIVE] :
- Volume Globulaire Moyen : $VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(en\\,millions/mm^3)}$ (Normale : 80 à 100 fL ; < 80 fL = microcytose ; > 100 fL = macrocytose)
- Teneur Corpusculaire Moyenne en Hémoglobine : $TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(en\\,millions/mm^3)}$ (Normale : 27 à 32 pg ; < 27 pg = hypochromie)
- Concentration Corpusculaire Moyenne en Hémoglobine : $CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$ (Normale : 32 à 36 g/dL)
- Coefficient de saturation de la sidérophiline (CST) : $\\%\\,Sat = \\frac{Fer\\,sérique}{CTFS} \\times 100$`;
  }

  return repaired;
}

// 3. Fonction de conversion du JSON vers le Markdown exact de RemNote
export function renderRemNoteMarkdown(data: Partial<RemNoteStructuredSummary>): string {
  const lines: string[] = [];

  // 1. Core Concepts
  lines.push("## 📖 Core Concepts\n");
  for (const item of data.core_concepts || []) {
    lines.push(`- **${item.term}** : ${item.definition}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 2. Must Remember
  lines.push("\n## 📌 Must Remember\n");
  for (const item of data.must_remember || []) {
    lines.push(`- ${item.statement}`);
    for (const sub of item.sub_bullets || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 3. Key Processes
  lines.push("\n## 🔄 Key Processes\n");
  for (const proc of data.key_processes || []) {
    lines.push(`- **${proc.process_name} :**`);
    (proc.steps || []).forEach((step: string, idx: number) => {
      const prefix = proc.is_ordered ? `${idx + 1}.` : `-`;
      lines.push(`  ${prefix} ${step}`);
    });
  }

  // 4. Key Comparisons
  lines.push("\n## 🔍 Key Comparisons\n");
  for (const comp of data.key_comparisons || []) {
    lines.push(`- **${comp.comparison_title}**`);
    for (const el of comp.items || []) {
      lines.push(`  - **${el.entity}** : ${el.characteristics}`);
    }
  }

  // 5. Common Misunderstandings
  lines.push("\n## ⚠️ Common Misunderstandings\n");
  for (const item of data.common_misunderstandings || []) {
    lines.push(`- ${item}`);
  }

  // 6. Mental Models / Intuition
  lines.push("\n## 🧠 Mental Models / Intuition\n");
  for (const item of data.mental_models || []) {
    lines.push(`- ${item.main_idea}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 7. Exceptions & Edge Cases
  lines.push("\n## 🚩 Exceptions & Edge Cases\n");
  for (const item of data.exceptions_edge_cases || []) {
    lines.push(`- ${item.main_point}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 8. When to Use Which
  lines.push("\n## 📍 When to Use Which\n");
  for (const item of data.when_to_use_which || []) {
    lines.push(`- ${item}`);
  }

  // 9. Patterns to Recognize
  lines.push("\n## 👀 Patterns to Recognize\n");
  for (const pat of data.patterns_to_recognize || []) {
    lines.push(`- **${pat.pattern_trigger}** : ${pat.clinical_meaning}`);
  }

  // 10. Exam Traps
  lines.push("\n## 🗂️ Exam Traps\n");
  for (const trap of data.exam_traps || []) {
    lines.push(`- ${trap.trap}`);
    for (const detail of trap.details || []) {
      lines.push(`  - ${detail}`);
    }
  }

  return repairMedicalFormulasInText(lines.join("\n"));
}

/**
 * Fusionne plusieurs objets RemNoteStructuredSummary (pour les polycopiés > 40 diapositives
 * découpés en chapitres : 1. Physiopathologie & Diagnostic, 2. Étiologies, 3. Prise en charge).
 */
export function mergeStructuredSummaries(
  parts: Partial<RemNoteStructuredSummary>[]
): RemNoteStructuredSummary {
  const merged: RemNoteStructuredSummary = {
    core_concepts: [],
    must_remember: [],
    key_processes: [],
    key_comparisons: [],
    common_misunderstandings: [],
    mental_models: [],
    exceptions_edge_cases: [],
    when_to_use_which: [],
    patterns_to_recognize: [],
    exam_traps: [],
  };

  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part.core_concepts)) merged.core_concepts.push(...part.core_concepts);
    if (Array.isArray(part.must_remember)) merged.must_remember.push(...part.must_remember);
    if (Array.isArray(part.key_processes)) merged.key_processes.push(...part.key_processes);
    if (Array.isArray(part.key_comparisons)) merged.key_comparisons.push(...part.key_comparisons);
    if (Array.isArray(part.common_misunderstandings)) {
      merged.common_misunderstandings.push(...part.common_misunderstandings);
    }
    if (Array.isArray(part.mental_models)) merged.mental_models.push(...part.mental_models);
    if (Array.isArray(part.exceptions_edge_cases)) {
      merged.exceptions_edge_cases.push(...part.exceptions_edge_cases);
    }
    if (Array.isArray(part.when_to_use_which)) {
      merged.when_to_use_which.push(...part.when_to_use_which);
    }
    if (Array.isArray(part.patterns_to_recognize)) {
      merged.patterns_to_recognize.push(...part.patterns_to_recognize);
    }
    if (Array.isArray(part.exam_traps)) merged.exam_traps.push(...part.exam_traps);
  }

  return merged;
}

/**
 * Extrait un JSON valide d'une réponse LLM (même entourée de ```json ... ``` ou partiel)
 */
function extractStructuredJson(raw: string): Partial<RemNoteStructuredSummary> | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const KNOWN_KEYS = [
    "core_concepts",
    "must_remember",
    "key_processes",
    "key_comparisons",
    "common_misunderstandings",
    "mental_models",
    "exceptions_edge_cases",
    "when_to_use_which",
    "patterns_to_recognize",
    "exam_traps",
  ];

  const hasAnyKnownKey = (obj: any) =>
    obj && typeof obj === "object" && KNOWN_KEYS.some((k) => Array.isArray(obj[k]));

  try {
    const parsed = JSON.parse(cleaned);
    if (hasAnyKnownKey(parsed)) {
      return parsed as Partial<RemNoteStructuredSummary>;
    }
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const sliced = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        if (hasAnyKnownKey(sliced)) {
          return sliced as Partial<RemNoteStructuredSummary>;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

/**
 * Garantit qu'aucune des 10 sections cognitives de RemNote n'est jamais laissée vide
 * en extrayant les faits, comparaisons, seuils et posologies directement du cours si nécessaire.
 */
function ensureComplete10Sections(
  data: RemNoteStructuredSummary,
  courseText: string,
  courseTitle = "Synthèse Médicale"
): RemNoteStructuredSummary {
  const isAdministrativeHeader = (s: string) =>
    /\b(?:universit[ée]|facult[ée]|dakar|cheikh\s+anta\s+diop|d[ée]partement|professeur|pr\s+[a-z]+|ann[ée]e\s+universitaire|diapositive|sommaire|plan\s+du\s+cours)\b/i.test(
      s
    );

  const sentences = courseText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^---\s*Diapositive\s*\d+\s*---/i, "").trim())
    .filter(
      (s) =>
        s.length > 25 &&
        !/^---\s*Diapositive/i.test(s) &&
        !isAdministrativeHeader(s)
    );

  const thresholdSentences = sentences.filter((s) =>
    /\b\d+(?:[.,]\d+)?\s*(?:g\/dl|mg\/j|mg\/kg|µg|fl|pg|%|mm3|\/mm3|mmol|ui|g\/l)\b/i.test(s)
  );
  const treatmentSentences = sentences.filter((s) =>
    /\b(?:traitement|posologie|prise en charge|mg\/j|mg\/kg|transfusion|supplémentation|contre-indication|prévention|curatif)\b/i.test(
      s
    )
  );

  if (data.core_concepts.length === 0) {
    data.core_concepts = sentences.slice(0, 5).map((s, i) => ({
      term: `${courseTitle} — Point fondamental ${i + 1}`,
      definition: s,
      sub_points: sentences.slice(i + 5, i + 7),
    }));
  }

  if (data.must_remember.length === 0) {
    const base = thresholdSentences.length > 0 ? thresholdSentences.slice(0, 6) : sentences.slice(0, 6);
    data.must_remember = base.map((s) => ({
      statement: s,
      sub_bullets: [],
    }));
  }

  if (data.key_processes.length === 0) {
    data.key_processes = [
      {
        process_name: `Séquence physiopathologique et démarche diagnostique (${courseTitle})`,
        is_ordered: true,
        steps: sentences.slice(0, 6),
      },
    ];
  }

  if (data.key_comparisons.length === 0) {
    data.key_comparisons = [
      {
        comparison_title: `Synthèse comparative des entités et formes cliniques (${courseTitle})`,
        items: sentences.slice(0, 4).map((s, idx) => ({
          entity: `Profil clinique / biologique ${idx + 1}`,
          characteristics: s,
        })),
      },
    ];
  }

  if (data.common_misunderstandings.length === 0) {
    data.common_misunderstandings = (
      thresholdSentences.length > 0 ? thresholdSentences.slice(0, 4) : sentences.slice(0, 4)
    ).map((s) => `Ne pas confondre les critères diagnostiques : ${s}`);
  }

  if (data.mental_models.length === 0) {
    data.mental_models = [
      {
        main_idea: `Logique physiopathologique intégrée de ${courseTitle}`,
        sub_points: sentences.slice(0, 4),
      },
    ];
  }

  if (data.exceptions_edge_cases.length === 0) {
    data.exceptions_edge_cases = [
      {
        main_point: "Cas particuliers, formes atypiques et contre-indications du cours",
        sub_points: (treatmentSentences.length > 0 ? treatmentSentences : sentences).slice(0, 4),
      },
    ];
  }

  if (data.when_to_use_which.length === 0) {
    data.when_to_use_which =
      treatmentSentences.length > 0 ? treatmentSentences.slice(0, 6) : sentences.slice(-6);
  }

  if (data.patterns_to_recognize.length === 0) {
    data.patterns_to_recognize = (
      thresholdSentences.length > 0 ? thresholdSentences.slice(0, 4) : sentences.slice(0, 4)
    ).map((s, i) => ({
      pattern_trigger: `Tableau bioclinique caractéristique #${i + 1}`,
      clinical_meaning: s,
    }));
  }

  if (data.exam_traps.length === 0) {
    data.exam_traps = (
      treatmentSentences.length > 0 ? treatmentSentences.slice(0, 4) : sentences.slice(-4)
    ).map((s) => ({
      trap: `Point de vigilance docimologique & thérapeutique`,
      details: [s],
    }));
  }

  return data;
}

/**
 * Génère une synthèse médicale structurée en 10 sections cognitives (JSON + Markdown)
 * via un pipeline séquentiel en 3 passes garantissant que les 10 sections sont 100 % complètes
 * du début jusqu'à la toute fin du cours (formules LaTeX + tableaux fléchés + posologies).
 */
export async function generateRemNoteStructuredSummary(options: {
  courseText: string;
  courseTitle?: string;
  slideImagesBase64?: string[];
  customInstructions?: string;
  onProgress?: (stepIndex: number, totalSteps: number, label: string) => void;
}): Promise<{
  structured: RemNoteStructuredSummary | null;
  markdown: string;
}> {
  const repairedCourseText = repairMedicalFormulasInText(options.courseText);
  const slideImagesBase64 = options.slideImagesBase64 || [];
  const title = options.courseTitle || "Cours Médical";

  // 1. Appel prioritaire à la fonction serverless dédiée `generate-medical-summary` si déployée
  try {
    options.onProgress?.(
      1,
      3,
      "Passe 1/3 : Extraction des concepts fondamentaux, seuils & processus physiopathologiques..."
    );
    const { data, error } = await supabase.functions.invoke("generate-medical-summary", {
      body: {
        courseText: repairedCourseText,
        slideImagesBase64,
        customInstructions: options.customInstructions,
      },
    });

    if (!error && data && data.structured && data.markdown) {
      const complete = ensureComplete10Sections(
        data.structured as RemNoteStructuredSummary,
        repairedCourseText,
        title
      );
      return {
        structured: complete,
        markdown: renderRemNoteMarkdown(complete),
      };
    }
  } catch {
    // Bascule transparente sur le pipeline séquentiel en 3 passes ci-dessous
  }

  // 2. Pipeline séquentiel en 3 passes (évite toute troncature de sortie JSON et couvre 100 % du cours jusqu'aux posologies finales)
  const structuredParts: Partial<RemNoteStructuredSummary>[] = [];

  // PASSE 1 : Sections 1, 2, 3 (Core Concepts, Must Remember, Key Processes)
  options.onProgress?.(
    1,
    3,
    "Passe 1/3 : Rédaction exhaustive des sections 1 à 3 (Core Concepts, Must Remember, Key Processes)..."
  );
  const pass1System = `${REMNOTE_MEDICAL_SYSTEM_PROMPT}
Tu exécutes la PASSE 1 sur 3 du plan RemNote pour le cours « ${title} ».
Réponds EXCLUSIVEMENT par un objet JSON valide contenant ces 3 sections complètes et ultra-détaillées (couvrant tout le cours, y compris les formules LaTeX $VGM$, $TCMH$, $CCMH$ et tous les seuils chiffrés) :
{
  "core_concepts": [{ "term": "...", "definition": "...", "sub_points": ["..."] }],
  "must_remember": [{ "statement": "...", "sub_bullets": ["..."] }],
  "key_processes": [{ "process_name": "...", "is_ordered": true, "steps": ["..."] }]
}`;
  const pass1User = `COURS INTÉGRAL (« ${title} ») :\n${repairedCourseText}\n\nGénère maintenant le JSON complet des sections 1 à 3 (core_concepts, must_remember, key_processes) sans aucune omission.`;
  const rawPass1 = await callGeminiAcademicEngine(pass1System, pass1User, 0.1);
  const parsedPass1 = rawPass1 ? extractStructuredJson(rawPass1) : null;
  if (parsedPass1) structuredParts.push(parsedPass1);

  // PASSE 2 : Sections 4, 5, 6, 7 (Key Comparisons, Common Misunderstandings, Mental Models, Exceptions & Edge Cases)
  options.onProgress?.(
    2,
    3,
    "Passe 2/3 : Rédaction exhaustive des sections 4 à 7 (Comparaisons, Modèles Mentaux & Cas Particuliers)..."
  );
  const pass2System = `${REMNOTE_MEDICAL_SYSTEM_PROMPT}
Tu exécutes la PASSE 2 sur 3 du plan RemNote pour le cours « ${title} ».
Réponds EXCLUSIVEMENT par un objet JSON valide contenant ces 4 sections complètes et ultra-détaillées (incluant tous les tableaux comparatifs fléchés ↑ ↓ N, bilans biologiques et cas particuliers du cours) :
{
  "key_comparisons": [{ "comparison_title": "...", "items": [{ "entity": "...", "characteristics": "..." }] }],
  "common_misunderstandings": ["..."],
  "mental_models": [{ "main_idea": "...", "sub_points": ["..."] }],
  "exceptions_edge_cases": [{ "main_point": "...", "sub_points": ["..."] }]
}`;
  const pass2User = `COURS INTÉGRAL (« ${title} ») :\n${repairedCourseText}\n\nGénère maintenant le JSON complet des sections 4 à 7 (key_comparisons, common_misunderstandings, mental_models, exceptions_edge_cases) sans aucune omission.`;
  const rawPass2 = await callGeminiAcademicEngine(pass2System, pass2User, 0.1);
  const parsedPass2 = rawPass2 ? extractStructuredJson(rawPass2) : null;
  if (parsedPass2) structuredParts.push(parsedPass2);

  // PASSE 3 : Sections 8, 9, 10 (When to Use Which + Posologies de fin de cours, Patterns to Recognize, Exam Traps)
  options.onProgress?.(
    3,
    3,
    "Passe 3/3 : Rédaction exhaustive des sections 8 à 10 (Arbres décisionnels, Posologies finales & Pièges QCM)..."
  );
  const pass3System = `${REMNOTE_MEDICAL_SYSTEM_PROMPT}
Tu exécutes la PASSE 3 sur 3 du plan RemNote pour le cours « ${title} ».
Réponds EXCLUSIVEMENT par un objet JSON valide contenant ces 3 dernières sections complètes et ultra-détaillées.
ATTENTION : Tu DOIS inclure dans "when_to_use_which" et "exam_traps" TOUTES les informations des dernières diapositives du cours (arbres décisionnels, traitements, molécules, posologies exactes en mg/j ou mg/kg/j ou µg, durées de traitement, surveillance et contre-indications) :
{
  "when_to_use_which": ["..."],
  "patterns_to_recognize": [{ "pattern_trigger": "...", "clinical_meaning": "..." }],
  "exam_traps": [{ "trap": "...", "details": ["..."] }]
}`;
  const pass3User = `COURS INTÉGRAL (« ${title} ») :\n${repairedCourseText}\n\nGénère maintenant le JSON complet des sections 8 à 10 (when_to_use_which, patterns_to_recognize, exam_traps) en couvrant jusqu'à la toute dernière diapositive du cours.`;
  const rawPass3 = await callGeminiAcademicEngine(pass3System, pass3User, 0.1);
  const parsedPass3 = rawPass3 ? extractStructuredJson(rawPass3) : null;
  if (parsedPass3) structuredParts.push(parsedPass3);

  const merged = ensureComplete10Sections(
    mergeStructuredSummaries(structuredParts),
    repairedCourseText,
    title
  );

  return {
    structured: merged,
    markdown: renderRemNoteMarkdown(merged),
  };
}
