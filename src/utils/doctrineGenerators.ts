// src/utils/doctrineGenerators.ts
import { cleanAndStructureMarkdown } from "./formatters";
import { summaryDocToStructuredMarkdown, type SummaryDoc } from "@/lib/summaryDocConverter";
import type { SynthesisDoctrine } from "@/pages/Summaries";

export type Doctrine = "objectives_verbatim" | "harvard_method" | "arva" | "world_number_one";

export interface GenerateSummaryWithRetryOptions {
  objectives: string[];
  doctrine: SynthesisDoctrine | string;
  targetWordCount: number;
  invokeWithRetry: Function;
  courseText?: string;
  courseTitle?: string;
  maxRetries?: number;
  onProgress?: (attempt: number, currentWords: number) => void;
}

/**
 * Construit un prompt structuré et strict pour la doctrine ARVA
 */
export function buildArvaPrompt(objectives: string[], _wordLimit?: number): string {
  return `
Tu es un expert médical en synthèse ARVA.
Traite l'INTÉGRALITÉ des objectifs pédagogiques et cliniques listés ci-dessous, sans aucune limitation ni restriction de mots.

Produis un document complet, exhaustif et rigoureusement structuré selon les 4 parties obligatoires :
1) Matrice Active Recall (QCM docimologiques d'évaluation + justifications complètes)
2) Scripts Cliniques Différentiels (tableaux comparatifs détaillés, critères diagnostiques)
3) Vignette Clinique d’Application (cas clinique réaliste narratif, démarche et prise en charge)
4) Visas de Révision (fiches mémos de synthèse, seuils et drapeaux rouges)

Présente chaque partie en Markdown bien hiérarchisé avec titres H2, listes, tableaux, encadrés et citations.
Voici les objectifs à traiter :
${objectives.map((o) => `- ${o}`).join("\n")}
`;
}

/**
 * Dictionnaire unifié des prompts stricts par doctrine
 */
export const PROMPTS: Record<string, (objectives: string[], wordLimit: number) => string> = {
  objectives_verbatim: (objectives, wordLimit) => `
Tu es un expert médical appliquant STRICTEMENT la doctrine "Objectifs du Cours (Verbatim)".
Produis un résumé scrupuleusement fidèle aux objectifs listés ci-dessous, dans l'ordre chronologique.
Chaque objectif doit être représenté par un titre H2 ('## Nom de l'objectif') suivi des définitions exactes, constantes, seuils et classifications sans reformulation superflue.
Traite 100% des objectifs du premier au dernier avec une plénitude académique totale sans aucune limite de mots.

Objectifs du cours :  
${objectives.map((o) => `- ${o}`).join('\n')}`,

  harvard_method: (objectives, wordLimit) => `
Tu es un expert médical appliquant STRICTEMENT la Méthode Harvard.
Pour chaque objectif, génère une synthèse selon les 4 sections obligatoires :
## 1. Idée maîtresse : une phrase synthétisant le concept clé.
## 2. Mécanisme : description physiopathologique concise (2-3 phrases).
## 3. Preuve clinique : données factuelles, constantes et examens discriminants.
## 4. Décision clinique : règle de prescription pratique et drapeaux rouges.

Traite 100% des objectifs du premier au dernier avec une plénitude académique totale sans aucune limite de mots.

Objectifs :  
${objectives.map((o) => `- ${o}`).join('\n')}`,

  arva: (objectives, wordLimit) => buildArvaPrompt(objectives, wordLimit),

  world_number_one: (objectives, wordLimit) => `
Tu es un expert médical appliquant le Standard Mondial N°1 (AMBOSS / First Aid).
Structure chaque concept avec des Blocs High-Yield ⚡, Règles d'Or '- ✓ ', Pièges cliniques '- ⚠️ ' et tableaux comparatifs.
Traite 100% des objectifs sans aucune restriction de longueur ni limite de mots.

Objectifs :
${objectives.map((o) => `- ${o}`).join('\n')}`,
};

/**
 * Fonction unifiée de génération adaptative selon la doctrine choisie
 */
export async function generateSummary({
  doctrine,
  objectives,
  wordLimit = 2500,
  wordCount,
  invokeWithRetry,
}: {
  doctrine: string;
  objectives: string[];
  wordLimit?: number;
  wordCount?: number;
  invokeWithRetry: Function;
}): Promise<string> {
  const effectiveLimit = wordCount || wordLimit;
  const promptFn = PROMPTS[doctrine] || PROMPTS.objectives_verbatim;
  const prompt = promptFn(objectives, effectiveLimit);

  const { data, error } = await invokeWithRetry("generate-summary", {
    body: { doctrine, prompt, targetWordCount: effectiveLimit, objectives },
  });

  if (error) throw new Error(error.message);

  const raw = data?.summary || data?.content || data?.text || "";
  let extracted = "";
  if (typeof raw === "string") {
    extracted = raw;
  } else if (raw && typeof raw === "object") {
    extracted = summaryDocToStructuredMarkdown(raw as SummaryDoc);
  }

  return cleanAndStructureMarkdown(extracted, wordLimit).trim();
}

/**
 * Fonction de génération ARVA avec retry et validation de quota
 */
export async function generateArvaSummary(
  objectives: string[],
  wordLimit: number = 3000,
  invokeWithRetry: Function
): Promise<string> {
  const prompt = buildArvaPrompt(objectives);
  const { data, error } = await invokeWithRetry("generate-summary", {
    body: { prompt, doctrine: "arva", objectives },
  });
  if (error) throw new Error(error.message);

  const rawSummary = data?.summary || data?.content || data?.text || "";
  let extracted = "";
  if (typeof rawSummary === "string") {
    extracted = rawSummary;
  } else if (rawSummary && typeof rawSummary === "object") {
    extracted = summaryDocToStructuredMarkdown(rawSummary as SummaryDoc);
  }

  return cleanAndStructureMarkdown(extracted).trim();
}

/**
 * Construit un prompt strict et hermétique pour chaque doctrine
 */
export function getDoctrinePrompt(
  objs: string[],
  doc: string,
  wordCount: number,
  courseText?: string
): string {
  // Zéro restriction de budget de mots

  if (doc === "objectives_verbatim") {
    return `Tu es un assistant expert en synthèse médicale appliquant STRICTEMENT la doctrine "Objectif du cours (Verbatim)".
CONSIGNES IMPÉRATIVES :
1. Reste centré EXCLUSIVEMENT sur les objectifs listés ci-dessous, dans leur ordre chronologique.
2. Traite un objectif par section avec un titre '## Nom de l'objectif'.
3. Chaque objectif doit être complet et substantiel : restitue les définitions exactes, les chiffres, constantes et classifications du professeur sans jamais tronquer ni fusionner des objectifs.
4. Ne fais aucune reformulation superflue ni ajout d'information extérieure.
5. EXHAUSTIVITÉ TOTALE : Tu n'as aucune limite de mots. Développe chaque objectif (définitions complètes, physiopathologie, clinique, paraclinique, traitement) avec rigueur.
6. INTERDICTION FORMELLE d'utiliser la méthode Harvard ou une autre doctrine.

LISTE DES OBJECTIFS DU COURS :
${objs.length > 0 ? objs.map((o, i) => `${i + 1}. ${o}`).join("\n") : courseText || "Synthétise chaque objectif principal."}

Rends la réponse sous forme de Markdown structuré strict (titres '## ', sous-titres '### ', listes '- ').`;
  }

  if (doc === "harvard_method") {
    return `Tu es un assistant expert appliquant STRICTEMENT la "Méthode de Harvard" (Active-Recall & Illness Scripts).
CONSIGNES IMPÉRATIVES :
Pour chaque concept ou objectif clé, structure rigoureusement en 4 sections h2 :
## 1. Idée maîtresse : une phrase percutante synthétisant le concept et ses seuils.
## 2. Mécanisme : 2 à 3 phrases claires sur la physiopathologie (expliquer le pourquoi avant le comment).
## 3. Preuve clinique : données cliniques factuelles, constantes biologiques, examens discriminants et études.
## 4. Décision clinique : règle pratique de prescription, prise en charge graduée et piège mortel / red flag.

Respecte scrupuleusement cet ordre pour chaque section.
EXHAUSTIVITÉ TOTALE : Tu n'as AUCUN plafond ni limite de mots. Développe chaque objectif dans sa plénitude clinique.
N'UTILISE AUCUNE AUTRE DOCTRINE.

OBJECTIFS DU COURS :
${objs.length > 0 ? objs.map((o, i) => `- ${o}`).join("\n") : courseText || ""}`;
  }

  if (doc === "arva") {
    return `Tu es un expert médical d'élite. Tu rédiges une synthèse docimologique selon la doctrine "ARVA" (Active Recall + Harvard + Vignette Clinique) de standing international.
Tu dois IMPÉRATIVEMENT structurer la synthèse en 4 sections majeures, strictement dans cet ordre :

## 1. Matrice Active Recall (Questions & Preuves du cours)
- Énumère les questions clés et pièges QCM ciblés sur le cours.
- Fournis des réponses précises, chiffrées, avec références aux diapositives et seuils biologiques exacts.
- Utilise des listes à puces avec carrés '■ ' ou '◆ '.
- Développe cette section de manière exhaustive et approfondie sans limite de mots.

## 2. Scripts Cliniques Différentiels (Harvard Illness Scripts)
- Organise les pathologies ou entités du cours sous forme de tableaux différentiels comparatifs (| Pathologie / Entité | Mécanisme physiopathologique | Signes cliniques discriminants | Pièges docimologiques / Erreurs |).
- Détaille les diagnostics différentiels et les points d'opposition.
- Développe cette section de manière exhaustive et approfondie sans limite de mots.

## 3. Vignette Clinique d'Application (Case-Based Clinical Learning)
- Rédige un cas clinique complet, narratif, réaliste et immersif mettant en scène les concepts du cours.
- Décompose le cas en : Présentation du patient & Anamnèse -> Démarche diagnostique et examens hiérarchisés -> Décision thérapeutique graduée -> Évolution et piège évité.
- Développe cette section de manière exhaustive et approfondie sans limite de mots.

## 4. Visas de Révision & Annotations Personnelles
- Tableau de bord des repères mnémotechniques, réflexes d'examen, formules ou scores de calcul.
- Boîte de visas pour l'auto-évaluation de l'étudiant.
- Développe cette section de manière exhaustive et approfondie sans limite de mots.

EXHAUSTIVITÉ INTÉGRALE : Tu n'as AUCUNE limite de budget de mots. Développe chaque section dans toute sa richesse clinique.
N'UTILISE AUCUNE AUTRE DOCTRINE.

CONTENU DU COURS / OBJECTIFS :
${objs.length > 0 ? objs.map((o, i) => `${i + 1}. ${o}`).join("\n") : courseText || ""}`;
  }

  // Doctrine Standard Mondial N°1 (AMBOSS / First Aid)
  return `Tu es un assistant expert appliquant le "Standard Mondial N°1 (AMBOSS / First Aid)".
CONSIGNES IMPÉRATIVES :
1. Structure la synthèse autour des objectifs avec des Blocs High-Yield ⚡ pour les points de concours.
2. Identifie les Règles d'or '- ✓ ' et les Pièges cliniques éliminatoires '- ⚠️ '.
3. Présente les entités comparables sous forme de Tableaux différentiels Markdown (| Entité | Mécanisme | Signe discriminant |).
4. Mets en gras les mots-clés et seuils biologiques : **valeur clé**.
5. EXHAUSTIVITÉ TOTALE : Traite 100% des objectifs pédagogiques et cliniques sans aucune restriction de longueur ni plafond de mots.
N'UTILISE AUCUNE AUTRE DOCTRINE.

CONTENU DU COURS :
${courseText || objs.join("\n")}`;
}

/**
 * Génère une synthèse avec contrôle de longueur minimale et relance automatique
 */
export async function generateSummaryWithRetry({
  objectives,
  doctrine,
  targetWordCount,
  invokeWithRetry,
  courseText = "",
  courseTitle = "Synthèse Médicale",
  maxRetries = 2,
  onProgress,
}: GenerateSummaryWithRetryOptions): Promise<string> {
  let attempt = 0;
  let summary = "";

  while (attempt <= maxRetries) {
    const isRetry = attempt > 0;
    const prompt = getDoctrinePrompt(objectives, doctrine, targetWordCount, courseText);

    const bodyPayload = {
      content: courseText || objectives.join("\n"),
      title: courseTitle,
      prompt: isRetry
        ? `RAPPEL IMPORTANT : Le résumé précédent était incomplet ou trop court. Tu dois impérativement développer chaque section de manière exhaustive sans dévier de la doctrine sélectionnée.\n\n${prompt}`
        : prompt,
      strictPrompt: prompt,
      doctrine,
      targetWordCount,
      objectives,
    };

    const { data, error } = await invokeWithRetry("generate-summary", {
      body: bodyPayload,
      retries: 1,
    });

    if (error) {
      if (attempt === maxRetries) throw new Error(error.message);
      attempt++;
      continue;
    }

    const rawSummary = data?.summary || data?.content || data?.text || "";
    let extracted = "";
    if (typeof rawSummary === "string") {
      extracted = rawSummary;
    } else if (rawSummary && typeof rawSummary === "object") {
      extracted = summaryDocToStructuredMarkdown(rawSummary as SummaryDoc);
    }

    summary = cleanAndStructureMarkdown(extracted, targetWordCount);
    const wordCount = summary.trim().split(/\s+/).filter(Boolean).length;

    if (onProgress) {
      onProgress(attempt, wordCount);
    }

    // Si le résumé contient du contenu valide, accepter immédiatement
    if (wordCount >= 100) {
      break;
    }

    attempt++;
  }

  if (!summary || summary.trim().length === 0) {
    throw new Error("La synthèse générée est vide ou insuffisante.");
  }

  return summary;
}

/**
 * Prépare et structure le contenu pour l'éditeur selon la doctrine active
 */
export function formatContentForEditor(raw: string, doctrine: string): string {
  if (!raw || !raw.trim()) {
    return "";
  }

  let text = cleanAndStructureMarkdown(raw);

  // Spécificités pour objectifs verbatim
  if (doctrine === "objectives_verbatim") {
    // Garantir que chaque titre principal est un H2 bien aéré
    text = text
      .replace(/^###\s*(Objectif\s*\d*[:\s].*)$/gim, "## $1")
      .replace(/^#\s*(Objectif\s*\d*[:\s].*)$/gim, "## $1");
  }

  return text;
}

/**
 * Synthétiseur local déterministe haute fidélité (mode hors-ligne / secours instantané)
 * Respecte la doctrine et tous les paramètres actifs (tableaux, connecteurs, marqueurs, pièges).
 */
export function generateLocalAcademicSummary(params: {
  title: string;
  rawCourse: string;
  doctrine: Doctrine | string;
  objectives: string[];
  preserveTables: boolean;
  autoHighlightTerms: boolean;
  useLogicalConnectors: boolean;
  includeClinicalPearls: boolean;
  targetWordCount: number;
}): string {
  const {
    title,
    rawCourse,
    doctrine,
    objectives,
    preserveTables,
    autoHighlightTerms,
    useLogicalConnectors,
    includeClinicalPearls,
    targetWordCount,
  } = params;

  const cleanLines = rawCourse
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 12 && !/^---\s*Diapositive\s*\d+\s*---$/i.test(l));

  const formatSentence = (s: string): string => {
    let out = s.replace(/^[•·∙●◦\-*]\s*/, "").trim();
    if (useLogicalConnectors) {
      out = out
        .replace(/\b(entraîne|entraine|provoque|induit|conduit à)\b/gi, "→")
        .replace(/\b(augmentation|augmenté|hausse)\b/gi, "↑")
        .replace(/\b(diminution|diminué|baisse)\b/gi, "↓");
    }
    if (autoHighlightTerms) {
      out = out.replace(
        /\b(\d+(?:[.,]\d+)?\s*(?:mg|g\/dL|g\/L|mmol\/L|mmHg|%|UI\/L|mL\/min|heures?|jours?|ans?))\b/gi,
        "**$1**"
      );
    }
    return out;
  };

  const maxLines =
    targetWordCount > 0
      ? Math.max(12, Math.min(cleanLines.length, Math.round(targetWordCount / 14)))
      : cleanLines.length;

  const selectedLines = cleanLines.slice(0, maxLines);

  if (doctrine === "remnote_structured") {
    const step = Math.max(1, Math.ceil(selectedLines.length / 10));
    const chunk = (idx: number) => selectedLines.slice(idx * step, (idx + 1) * step);
    const hasAnemiaFormulas = /\bVGM\b/i.test(rawCourse) || /\bTCMH\b/i.test(rawCourse);

    return [
      `## 📖 Core Concepts`,
      ...(chunk(0).length > 0
        ? chunk(0).map((l, i) => `- **Concept ${i + 1}** : ${formatSentence(l)}`)
        : [`- **${title}** : Définition nosologique et critères fondamentaux.`]),
      "",
      `## 📌 Must Remember`,
      ...(hasAnemiaFormulas
        ? [
            `- **Constantes érythrocytaires (Formules exactes)** :`,
            `  - Volume Globulaire Moyen : $VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(millions)}$ (Normale : **80–100 fL** ; Microcytose si < 80 fL ; Macrocytose si > 100 fL)`,
            `  - Teneur Corpusculaire Moyenne en Hb : $TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(millions)}$ (Normale : **27–32 pg** ; Hypochromie si < 27 pg)`,
            `  - Concentration Corpusculaire Moyenne en Hb : $CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$ (Normale : **32–36 g/dL**)`,
            `  - Coefficient de saturation : $\\%\\,Sat = \\frac{Fer\\,sérique}{CTFS} \\times 100$`,
          ]
        : []),
      ...chunk(1).map((l) => `- ${formatSentence(l)}`),
      "",
      `## 🔄 Key Processes`,
      `- **Démarche diagnostique et thérapeutique :**`,
      ...chunk(2).map((l, i) => `  ${i + 1}. ${formatSentence(l)}`),
      "",
      `## 🔍 Key Comparisons`,
      `- **Diagnostic différentiel (${title})**`,
      ...chunk(3).map((l, i) => `  - **Repère ${i + 1}** : ${formatSentence(l)}`),
      "",
      `## ⚠️ Common Misunderstandings`,
      ...chunk(4).map((l) => `- ${formatSentence(l)}`),
      "",
      `## 🧠 Mental Models / Intuition`,
      ...chunk(5).map((l) => `- ${formatSentence(l)}`),
      "",
      `## 🚩 Exceptions & Edge Cases`,
      ...chunk(6).map((l) => `- ${formatSentence(l)}`),
      "",
      `## 📍 When to Use Which`,
      ...chunk(7).map((l) => `- ${formatSentence(l)}`),
      "",
      `## 👀 Patterns to Recognize`,
      ...chunk(8).map((l, i) => `- **Profil clinique ${i + 1}** : ${formatSentence(l)}`),
      "",
      `## 🗂️ Exam Traps`,
      ...chunk(9).map((l) => `- ⚠️ ${formatSentence(l)}`),
    ].join("\n");
  }

  if (doctrine === "harvard_method") {
    const q = Math.max(1, Math.ceil(selectedLines.length / 4));
    const p1 = selectedLines.slice(0, q).map((l) => `- ${formatSentence(l)}`).join("\n");
    const p2 = selectedLines.slice(q, q * 2).map((l) => `- ${useLogicalConnectors ? "→ " : ""}${formatSentence(l)}`).join("\n");
    const p3 = selectedLines.slice(q * 2, q * 3).map((l) => `- ${autoHighlightTerms ? "✓ " : ""}${formatSentence(l)}`).join("\n");
    const p4 = selectedLines.slice(q * 3).map((l) => `- ${includeClinicalPearls ? "⚠️ " : ""}${formatSentence(l)}`).join("\n");

    return [
      `## 1. Idée maîtresse & Concept Central — ${title}`,
      p1 || `- Synthèse nosologique et définition centrale de **${title}**.`,
      "",
      `## 2. Mécanisme Physiopathologique`,
      p2 || `- Architecture physiopathologique et cascade causale du cours.`,
      "",
      `## 3. Preuve Clinique & Paraclinique`,
      p3 || `- Critères diagnostiques et bilans complémentaires de référence.`,
      "",
      `## 4. Décision Clinique, Thérapeutique & Red Flags`,
      p4 || `- Prise en charge thérapeutique graduée et surveillance clinique.`,
    ].join("\n");
  }

  if (doctrine === "arva") {
    const q = Math.max(1, Math.ceil(selectedLines.length / 4));
    const s1 = selectedLines
      .slice(0, q)
      .map((l, i) => `- **Point docimologique ${i + 1}** : ${formatSentence(l)}`)
      .join("\n");
    const s2 = preserveTables
      ? [
          `| Critère d'analyse | Données clés du cours (${title}) |`,
          `| --- | --- |`,
          ...selectedLines
            .slice(q, q * 2)
            .slice(0, 8)
            .map((l, idx) => `| Repère ${idx + 1} | ${formatSentence(l).replace(/\|/g, "/")} |`),
        ].join("\n")
      : selectedLines
          .slice(q, q * 2)
          .map((l) => `- ${formatSentence(l)}`)
          .join("\n");
    const s3 = selectedLines
      .slice(q * 2, q * 3)
      .map((l) => `- ${useLogicalConnectors ? "→ " : ""}${formatSentence(l)}`)
      .join("\n");
    const s4 = selectedLines
      .slice(q * 3)
      .map((l) => `- ${includeClinicalPearls ? "⚠️ " : "✓ "}${formatSentence(l)}`)
      .join("\n");

    return [
      `## 1. Matrice Active Recall (Questions & Preuves du cours)`,
      s1,
      "",
      `## 2. Scripts Cliniques Différentiels (Illness Scripts)`,
      s2,
      "",
      `## 3. Vignette Clinique d'Application & Algorithme Décisionnel`,
      s3,
      "",
      `## 4. Visas de Révision & Pièges Docimologiques`,
      s4,
    ].join("\n");
  }

  // Par Objectifs (objectives_verbatim) ou Standard Mondial N°1 (world_number_one)
  const effectiveObjectives =
    objectives.length > 0
      ? objectives
      : [
          `Définitions, épidémiologie et cadre nosologique (${title})`,
          `Physiopathologie et mécanismes étiologiques`,
          `Diagnostic positif : clinique et examens paracliniques`,
          `Diagnostics différentiels, formes cliniques et évolution`,
          `Prise en charge thérapeutique et surveillance`,
        ];

  const chunkSize = Math.max(1, Math.ceil(selectedLines.length / effectiveObjectives.length));
  const sections: string[] = [];

  effectiveObjectives.forEach((obj, idx) => {
    const slice = selectedLines.slice(idx * chunkSize, (idx + 1) * chunkSize);
    const heading =
      doctrine === "world_number_one"
        ? `## ${idx + 1}. ${obj}`
        : `## Objectif ${idx + 1} : ${obj}`;

    const bullets = slice.map((l, i) => {
      const formatted = formatSentence(l);
      if (autoHighlightTerms && i === 0) return `- ✓ **Notion fondamentale** : ${formatted}`;
      return `- ${formatted}`;
    });

    if (includeClinicalPearls && slice.length > 0) {
      bullets.push(
        `> ⚠️ **Focus Examen & Vigilance** : Maîtriser les critères et seuils exacts relatifs à « ${obj} ».`
      );
    }

    sections.push(`${heading}\n${bullets.join("\n")}`);
  });

  return sections.join("\n\n");
}
