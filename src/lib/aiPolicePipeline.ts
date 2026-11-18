import { callGeminiAcademicEngine } from "@/lib/syncEngine";
// src/lib/aiPolicePipeline.ts
// Pipeline Bi-Modèle DawJang Press : Ouvrier Gemini 2.5 Flash + Police IA Claude Sonnet 5.5
// Compatible avec les 3 modes :
// 1. "objectives" (Mode 1 : Objectifs du Cours Verbatim — DawJang Press)
// 2. "remnote"    (Mode 2 : 10 Sections Cognitives — Style RemNote)
// 3. "qcm"        (Mode 3 : Générateur de QCM docimologiques)

export type GenerationMode = "objectives" | "remnote" | "qcm";

export interface PipelineInput {
  mode: GenerationMode;
  courseTitle: string;
  courseText: string;
  extractedObjectives?: string[];
  geminiApiKey?: string;
  anthropicApiKey?: string;
  onProgress?: (step: number, total: number, label: string) => void;
}

export interface ObjectiveSection {
  objectiveNumber: number;
  title: string;
  content: string;
}

export interface ObjectivesPipelineResult {
  sections: ObjectiveSection[];
  markdown: string;
}

export interface RemNotePipelineResult {
  core_concepts: Array<{ term: string; definition: string; sub_points?: string[] }>;
  must_remember: Array<{ statement: string; sub_bullets?: string[] }>;
  key_processes: Array<{ process_name: string; steps: string[]; is_ordered?: boolean }>;
  key_comparisons: Array<{ comparison_title: string; items: Array<{ entity: string; characteristics: string }> }>;
  common_misunderstandings: string[];
  mental_models: Array<{ main_idea: string; sub_points: string[] }>;
  exceptions_edge_cases: Array<{ main_point: string; sub_points: string[] }>;
  when_to_use_which: string[];
  patterns_to_recognize: Array<{ pattern_trigger: string; clinical_meaning: string }>;
  exam_traps: Array<{ trap: string; details: string[] }>;
  markdown: string;
}

export interface QcmPipelineResult {
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

/**
 * BOUCLIER ANTI-TRONCATURE DAWJANG PRESS :
 * Empêche le parseur HTML/PDF d'interpréter "Hb < 13 g/dl ... > 80 000"
 * comme une balise HTML <13 ... > qui efface des pages entières du document.
 */
export function sanitizeForDawJangRenderer(text: string): string {
  if (!text || typeof text !== "string") return "";

  return text
    // 1. Supprime impitoyablement les phrases d'introduction conversationnelles d'IA
    .replace(
      /^(?:Voici la rédaction|Basé sur le support|Voici le résumé|En résumé|D'après le document|Dans ce cours|Voici la synthèse).*?\n+/gim,
      ""
    )
    .replace(/^Voici la section correspondant.*?\n+/gim, "")
    // 2. Corrige les échappements LaTeX corrompus observés dans les PDF générés
    .replace(/\\\$(\{\\wedge\}|\^)3\\\$/g, "³")
    .replace(/mm\^3/g, "mm³")
    .replace(/mm\^2/g, "mm²")
    // 3. Sécurise les opérateurs de comparaison pour qu'aucun chevrons nu n'ouvre une fausse balise HTML
    // Note : (?<!^|\n) empêche impérativement de convertir les citations Markdown (ex: "> 1. Objectif 1") en "supérieur à"
    .replace(/<\s*=/g, "≤")
    .replace(/>\s*=/g, "≥")
    .replace(/<\s*(\d)/g, "inférieur à $1")
    .replace(/(?<!^|\n)\s*>\s*(\d)/g, " supérieur à $1")
    // 4. Nettoie les doubles astérisques orphelins en fin de mot ou fin de ligne (ex: "13 g/dl**" -> "13 g/dl")
    .replace(/(?<=\S)\s*\*{2,}(?=\s|$)/g, "")
    .replace(/\*\*$/gm, "");
}

/**
 * PROMPT DE LA POLICE IA (CLAUDE SONNET 5.5)
 */
function buildSonnetPoliceSystemPrompt(mode: GenerationMode): string {
  const lowerSubjectContext = `${mode}`;
  const baseRules = `Tu es le Rédacteur en Chef Médical ("La Police IA") des Éditions DawJang Press, propulsé exclusivement par Claude Sonnet 5.5.
Ton rôle est d'inspecter, corriger, dédoublonner et compresser impérativement de moitié le travail produit par Gemini 2.5 Flash à partir du cours officiel fourni.

LOIS INVIOLABLES DE LA POLICE IA (CLAUDE SONNET 5.5 — 100 % ADAPTATIVES À LA MATIÈRE DU COURS) :
1. CALIBRAGE ÉQUILIBRÉ HAUTE VALEUR (550 À 750 MOTS AU TOTAL) :
   - Plafond de 80 à 120 mots par objectif : ni bavardage encyclopédique, ni sécheresse excessive.
   - Supprime impitoyablement toute phrase d'introduction, de transition ou de conclusion ("Voici la rédaction de...", "D'après le document fourni...", "Il est important de noter que...").
   - Adapte strictement les critères, examens et termes techniques à la discipline réelle du cours fourni (ex: radiographie/TDM/classifications en traumatologie-orthopédie, ECG/ETT/troponine en cardiologie, hémogramme/myélogramme en hématologie, etc.) sans jamais importer de concepts d'une autre spécialité.

2. DIRECTIVES DE CLARTÉ PÉDAGOGIQUE & CLINIQUE :
   - Si une section demande une DÉFINITION : donne la définition officielle en 1-2 phrases avec critères diagnostiques exacts et pièges d'exclusion du cours.
   - Si une section demande d'INTERPRÉTER UN EXAMEN CLÉ (radiographie, TDM, IRM, ECG, EFR, hémogramme, liquide synovial, ionogramme, etc.) : Ne fais pas de simple copier-coller. Explique à l'étudiant la démarche logique pas à pas propre à cet examen :
     1. Paramètres/incidences/critères de qualité ou valeurs seuils de certitude du cours.
     2. Analyse méthodique étape par étape des anomalies et classifications pronostiques.
     3. Qualification globale / stade exact et déduction immédiate sur le diagnostic ou la conduite à tenir.
   - Si une section demande les MÉCANISMES : donne la classification physiopathologique, anatomique ou lésionnelle concise telle qu'enseignée dans le cours.
   - Si une section demande les SIGNES CLINIQUES : syndrome/bilan clinique ordonné et recherche systématique des complications immédiates et signes de gravité.
   - Si une section demande le DIAGNOSTIC ÉTIOLOGIQUE / DIFFÉRENTIEL : arbre décisionnel direct reliant chaque profil aux examens de 1re intention, à l'examen de certitude et aux causes maîtresses.
   - Si une section demande le TRAITEMENT : buts, urgences, choix médico-chirurgicaux (molécules, posologies, durées, techniques, délais) et contre-indications formelles.
   - Si une section aborde une TRIADE ou CLASSIFICATION : cite les éléments nettement sans dilution.
   - Si une section cite des ÉLÉMENTS À ÉVITER ou contre-indications : liste à puces brève et percutante.

3. EXACTITUDE MATHÉMATIQUE & FORMULES LATEX :
   - Préserve et corrige en LaTeX valide toute formule ou mesure présente dans le cours (angles, scores, clairances, formules physiologiques ou biologiques) avec leurs dénominateurs complets.
   - Ne laisse jamais passer de symbole < ou > brut qui pourrait être interprété comme une balise HTML. Utilise "inférieur à" / "supérieur à" ou les symboles LaTeX \\lt / \\gt / \\le / \\ge.

4. ZÉRO DOUBLON & ZÉRO PLACEHOLDER :
   - Chaque objectif ne doit apparaître qu'UNE SEULE FOIS.
   - N'inclus JAMAIS le nom d'une université ("Université...", "FMPO"), d'un fichier annexe ou du titre de la diapositive comme contenu médical (${lowerSubjectContext}).`;

  if (mode === "objectives") {
    return `${baseRules}

SPÉCIFICITÉ DU MODE 1 (OBJECTIFS DU COURS VERBATIM ULTRA-CONDENSÉ) :
- Rends OBLIGATOIREMENT un objet JSON STRICT contenant exactement le tableau "sections".
- Il doit y avoir EXACTEMENT autant de sections que d'objectifs officiels fournis (ex: 6 objectifs = 6 sections, JAMAIS 10 sections avec doublons).
- Calibrage : 80 à 120 mots par section. Démarche logique pour les interprétations (hémogramme, bilans).
- Format JSON attendu :
{
  "sections": [
    {
      "objectiveNumber": 1,
      "title": "Titre exact de l'objectif 1",
      "content": "Texte médical clair, logique et structuré (80 à 120 mots), sans phrase d'introduction IA, avec puces cliniques et tableaux compacts | ... |."
    }
  ]
}`;
  }

  if (mode === "remnote") {
    return `${baseRules}

SPÉCIFICITÉ DU MODE 2 (STYLE REMNOTE — 10 SECTIONS COGNITIVES) :
- Rends un objet JSON STRICT respectant les 10 sections cognitives RemNote :
1. core_concepts: liste de { term, definition, sub_points }
2. must_remember: liste de { statement, sub_bullets }
3. key_processes: liste de { process_name, steps, is_ordered }
4. key_comparisons: liste de { comparison_title, items: [{ entity, characteristics }] }
5. common_misunderstandings: liste de phrases d'alertes
6. mental_models: liste de { main_idea, sub_points }
7. exceptions_edge_cases: liste de { main_point, sub_points }
8. when_to_use_which: liste de règles de prescription
9. patterns_to_recognize: liste de { pattern_trigger, clinical_meaning }
10. exam_traps: liste de { trap, details }

Format JSON strict attendu :
{
  "core_concepts": [...],
  "must_remember": [...],
  "key_processes": [...],
  "key_comparisons": [...],
  "common_misunderstandings": [...],
  "mental_models": [...],
  "exceptions_edge_cases": [...],
  "when_to_use_which": [...],
  "patterns_to_recognize": [...],
  "exam_traps": [...]
}`;
  }

  return `${baseRules}
SPÉCIFICITÉ DU MODE QCM :
- Rends un objet JSON STRICT avec un tableau "questions".
- Chaque question teste un point précis du cours (seuils, formules, pièges) avec 4 ou 5 options et une explication clinique détaillée.
Format attendu :
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}`;
}

/**
 * ÉCHELON 1 : Ouvrier d'extraction rapide (Gemini 2.5 Flash)
 */
async function callGemini25FlashDraft(input: PipelineInput): Promise<string | null> {
  const objectives = input.extractedObjectives?.length
    ? `Objectifs officiels du cours :\n${input.extractedObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
    : "";
  return callGeminiAcademicEngine(
    `Extrais et structure l'intégralité de ce cours médical selon le mode "${input.mode}" en JSON strict.`,
    `Titre du cours : ${input.courseTitle}\n${objectives}\nCONTENU DU COURS :\n${input.courseText.slice(0, 50000)}`,
    0.2,
  );
}

/**
 * ÉCHELON 2 : La "Police IA" (Claude Sonnet 4.6)
 * Supporte automatiquement OpenRouter (sk-or-...) et Anthropic Direct (sk-ant-...)
 */
async function callSonnetPolice(
  input: PipelineInput,
  geminiDraft: string | null
): Promise<any> {
  const systemPrompt = buildSonnetPoliceSystemPrompt(input.mode);

  const userMessage = geminiDraft
    ? `Voici le cours original ET le premier jet d'extraction produit par Gemini 2.5 Flash.
Agis comme la Police IA de DawJang Press :
1. Compare minutieusement le premier jet au cours original.
2. Corrige toutes les erreurs, formules tronquées et débordements hors sujet.
   (Définition = définition seule ; Mécanismes = mécanismes seuls ; Signes cliniques = signes cliniques seuls sans déborder sur un autre objectif).
3. Supprime toute répétition, tout doublon et toute phrase robotique d'IA ("Voici la rédaction...").
4. Rends UNIQUEMENT le JSON strict final, sans texte avant ni après.

=== COURS ORIGINAL DE RÉFÉRENCE ===
${input.courseText.slice(0, 50000)}

=== PREMIER JET GEMINI 2.5 FLASH À CONTRÔLER ===
${geminiDraft}`
    : `Prends le relais complet et génère directement la synthèse médicale parfaite en JSON strict à partir du cours ci-dessous :

Titre : ${input.courseTitle}
${
  input.extractedObjectives?.length
    ? `Objectifs officiels du cours :\n${input.extractedObjectives
        .map((o, idx) => `${idx + 1}. ${o}`)
        .join("\n")}`
    : ""
}

=== COURS ORIGINAL DE RÉFÉRENCE ===
${input.courseText.slice(0, 50000)}`;

  const rawResponse = await callGeminiAcademicEngine(systemPrompt, userMessage, 0.1) || "";

  if (!rawResponse || rawResponse.trim().length === 0) {
    throw new Error("Réponse vide de la Police IA Claude Sonnet.");
  }

  // Extraction propre du bloc JSON (qu'il soit dans un bloc ```json ou brut)
  const cleanJsonText = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Impossible de trouver un bloc JSON valide dans la réponse de la Police IA.");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Assemble un document Markdown haute fidélité à partir des sections vérifiées
 */
function buildMarkdownFromVerifiedSections(
  courseTitle: string,
  sections: ObjectiveSection[]
): string {
  const bodySections = sections.map((s) => {
    let content = s.content.trim();
    // Retirer tout titre redondant en tête de section
    content = content.replace(/^(?:#{1,3}\s*(?:Objectif\s*\d+\s*[:.\-–—]?\s*)?[^\n]+\n+)/i, "").trim();
    return `## Objectif ${s.objectiveNumber} : ${s.title}\n\n${content}`;
  });

  return bodySections.join("\n\n---\n\n");
}

/**
 * POINT D'ENTRÉE PRINCIPAL DU PIPELINE BI-MODÈLE
 */
export async function executeDualModelMedicalPipeline(input: PipelineInput): Promise<any> {
  const { mode, courseTitle, onProgress } = input;

  // 1. Échelon 1 : Premier jet d'extraction par Gemini 2.5 Flash
  onProgress?.(1, 3, "Échelon 1 : Extraction du support par Gemini 2.5 Flash...");
  let geminiDraft: string | null = null;
  try {
    geminiDraft = await callGemini25FlashDraft(input);
  } catch (err) {
    console.warn("[Pipeline] Gemini 2.5 Flash en échec, relais direct Sonnet 5.5 :", err);
  }

  // 2. Échelon 2 : Contrôle et rédaction par la Police IA (Claude Sonnet 5.5)
  onProgress?.(
    2,
    3,
    "Échelon 2 : Contrôle strict, dédoublonnage & rédaction par Claude Sonnet 5.5..."
  );
  const verifiedData = await callSonnetPolice(input, geminiDraft);

  // 3. Échelon 3 : Bouclier Anti-Troncature DawJang Press & normalisation
  onProgress?.(3, 3, "Échelon 3 : Activation du Bouclier Anti-Troncature DawJang Press...");

  if (mode === "objectives") {
    const rawSections: any[] = Array.isArray(verifiedData?.sections)
      ? verifiedData.sections
      : [];

    // Dédoublonnage strict par titre normalisé
    const seenTitles = new Set<string>();
    const cleanedSections: ObjectiveSection[] = [];

    rawSections.forEach((sec, idx) => {
      const rawTitle = (sec.title || `Objectif ${idx + 1}`).trim();
      const normTitle = rawTitle.toLowerCase().replace(/^(?:objectif\s*\d+\s*[:.\-–—]?\s*)/i, "");
      if (seenTitles.has(normTitle) && normTitle.length > 5) return;
      seenTitles.add(normTitle);

      cleanedSections.push({
        objectiveNumber: cleanedSections.length + 1,
        title: sanitizeForDawJangRenderer(rawTitle),
        content: sanitizeForDawJangRenderer(sec.content || ""),
      });
    });

    const markdown = buildMarkdownFromVerifiedSections(courseTitle, cleanedSections);
    return {
      sections: cleanedSections,
      markdown,
    } as ObjectivesPipelineResult;
  }

  if (mode === "remnote") {
    // Nettoyer tous les champs textuels avec le bouclier anti-troncature
    const sanitizedRemNote: any = {};
    for (const key of Object.keys(verifiedData)) {
      if (Array.isArray(verifiedData[key])) {
        sanitizedRemNote[key] = verifiedData[key].map((item: any) => {
          if (typeof item === "string") return sanitizeForDawJangRenderer(item);
          if (typeof item === "object" && item !== null) {
            const cleanObj: any = {};
            for (const subKey of Object.keys(item)) {
              if (typeof item[subKey] === "string") {
                cleanObj[subKey] = sanitizeForDawJangRenderer(item[subKey]);
              } else if (Array.isArray(item[subKey])) {
                cleanObj[subKey] = item[subKey].map((s: any) =>
                  typeof s === "string" ? sanitizeForDawJangRenderer(s) : s
                );
              } else {
                cleanObj[subKey] = item[subKey];
              }
            }
            return cleanObj;
          }
          return item;
        });
      } else if (typeof verifiedData[key] === "string") {
        sanitizedRemNote[key] = sanitizeForDawJangRenderer(verifiedData[key]);
      } else {
        sanitizedRemNote[key] = verifiedData[key];
      }
    }
    return sanitizedRemNote as RemNotePipelineResult;
  }

  if (mode === "qcm") {
    if (Array.isArray(verifiedData?.questions)) {
      verifiedData.questions = verifiedData.questions.map((q: any) => ({
        ...q,
        question: sanitizeForDawJangRenderer(q.question),
        explanation: sanitizeForDawJangRenderer(q.explanation),
        options: Array.isArray(q.options)
          ? q.options.map((opt: string) => sanitizeForDawJangRenderer(opt))
          : q.options,
      }));
    }
    return verifiedData as QcmPipelineResult;
  }

  return verifiedData;
}
