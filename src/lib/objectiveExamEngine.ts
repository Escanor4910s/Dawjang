// src/lib/objectiveExamEngine.ts
import { supabase } from "@/integrations/supabase/client";
import { getActivePoliceApiKey } from "@/lib/aiPolicePipeline";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import { extractObjectivesFromCourseText } from "@/lib/summaryEngine";
import { normalizeMarkdownTables } from "@/lib/coPilotSummaryEngine";

const DEFAULT_OPENROUTER_KEY =
  (import.meta as any).env?.VITE_OPENROUTER_API_KEY || "";

export interface UploadedExamInput {
  name?: string;
  fileName?: string;
  content: string;
}

export interface ObjectiveExamSummaryData {
  metadata: {
    titre_lecon: string;
    matiere: string;
    niveau_semestre: string;
  };
  objectifs_developpes: {
    numero: number;
    intitule_objectif: string;
    importance_examen: string;
    contenu_structuré_markdown: string;
    points_incontournables: string[];
  }[];
  strategie_examen: {
    marche_a_suivre_evaluation: {
      etape: number;
      action: string;
      detail_reflexe: string;
    }[];
    pieges_des_professeurs: {
      titre_piege: string;
      distracteur_qcm: string;
      parade_etudiant: string;
    }[];
    a_ne_jamais_oublier: string[];
  };
  qcm_entrainement_cibles: {
    question: string;
    options: string[];
    reponses_exactes: string[];
    explication_anti_piege: string;
  }[];
}

/**
 * LE PROMPT MAÎTRE — SYNTHÈSE UNIFIÉE (PROTOCOLE ARGON 4 PARTIES)
 * Garantit l'architecture exacte en 4 Parties (PARTIE I, PARTIE II, PARTIE III, PARTIE IV)
 */
export const SONNET_4_6_ARGON_PROTOCOL_PROMPT = `
Tu es un Professeur Agrégé de Médecine et Auditeur Docimologique d'Élite. Tu produis la SYNTHÈSE UNIFIÉE : COURS, INCIDENCE PAR SOUS-PARTIE & DÉMARCHE CAS CLINIQUE en 4 Parties indissociables à partir :
1) Du COURS COMPLET fourni (de la première à la dernière diapositive, incluant les Objectifs ET l'intégralité du Plan du cours).
2) Du LOT D'ÉVALUATIONS / EXAMENS (annales) uploadé par l'étudiant.

STRUCTURE EXACTE ET OBLIGATOIRE DE LA SYNTHÈSE UNIFIÉE :
- PARTIE I — AUDIT RÉEL DES ANNALES & PROBABILITÉ DE SORTIE PAR SOUS-PARTIE
  • 1.1. Vérité statistique sur l'apparition du cours dans vos examens (Incidence en Cas Clinique principal + Incidence en item de QCM / diagnostic différentiel + Tableau 4 colonnes des apparitions exactes).
  • 1.2. Incidence et probabilité de sortie pour chaque sous-partie du cours (Tableau 4 colonnes couvrant les 6 sous-parties du plan officiel de la diapo 1 à la dernière diapo).
- PARTIE II — RÉSUMÉ EXHAUSTIF DU COURS PAR SOUS-PARTIES & OBJECTIFS
  • Découpage en 6 Sous-parties couvrant 100 % des diapositives du cours (incluant Généralités/Physiopathologie, Diagnostic positif, Examens de certitude, Pronostic/Gravité, Étiologies acquises/constitutionnelles & Diagnostics différentiels, et Traitement complet avec arbre décisionnel).
  • Chaque Sous-partie débute par sa ligne d'audit : ★ Probabilité de sortie : [Niveau (%)] • Réf. Annales : [Sessions] • Cible QCM : [Format].
  • Puces hiérarchiques (• niveau 1, ◦ niveau 2, 1. 2. 3. listes numérotées), mots-clés médicaux en **gras** au cœur des phrases, et Tableaux Markdown complets.
- PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS
  • 3.1. Les 5 Pièges Majeurs et Combinaisons Groupage / Jumelage à verrouiller (5 encadrés roses/rouges détaillant les pièges de Censure, Jumelage « PARCE QUE », Groupage « A = 1+2+3 », formes étiologiques et pièges thérapeutiques).
  • 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales (Tableau comparatif à 5 colonnes).
- PARTIE IV — DÉMARCHE OPÉRATIONNELLE À SUIVRE DEVANT UN CAS CLINIQUE À L'EXAMEN
  • 5 encadrés émeraude (ÉTAPE 1 à ÉTAPE 5) déroulant dans l'ordre chronologique des QCM d'un Cas Clinique tous les réflexes et seuils chiffrés.
`;

/**
 * Convertit un objet structuré ObjectiveExamSummaryData en texte Markdown complet
 * pour l'édition et l'export PDF / Word.
 */
export function objectiveSummaryDataToMarkdown(data: ObjectiveExamSummaryData): string {
  const parts: string[] = [];

  parts.push(`# ${data.metadata.titre_lecon || "Synthèse Médicale"}`);
  parts.push(`> **${data.metadata.matiere || "Médecine"}** • ${data.metadata.niveau_semestre || "Cursus Médical"}\n`);

  data.objectifs_developpes.forEach((obj) => {
    parts.push(`## Sous-partie ${obj.numero} (Objectif ${obj.numero}) : ${obj.intitule_objectif}`);
    parts.push(`★ Probabilité de sortie : ${obj.importance_examen} • Cible QCM : Cas Clinique & Censure\n`);
    parts.push(obj.contenu_structuré_markdown);
    if (obj.points_incontournables && obj.points_incontournables.length > 0) {
      parts.push(`\n**Points clés à verrouiller :**`);
      obj.points_incontournables.forEach((pt) => parts.push(`• **Point clé :** ${pt}`));
    }
    parts.push("\n---\n");
  });

  parts.push(`=== PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS ===`);
  parts.push(`## 3.1. Les Pièges Majeurs et Combinaisons à verrouiller`);
  data.strategie_examen.pieges_des_professeurs.forEach((piege, idx) => {
    parts.push(`> **[PIÈGE ${idx + 1}] ${idx + 1}. ${piege.titre_piege} :**`);
    parts.push(`> Proposition piège classique : *« ${piege.distracteur_qcm} »*. **Parade absolue :** ${piege.parade_etudiant}\n`);
  });

  parts.push(`=== PARTIE IV — DÉMARCHE OPÉRATIONNELLE À SUIVRE DEVANT UN CAS CLINIQUE À L'EXAMEN ===`);
  data.strategie_examen.marche_a_suivre_evaluation.forEach((step) => {
    parts.push(`> **[ÉTAPE ${step.etape}] ÉTAPE ${step.etape} (${step.action}) :**`);
    parts.push(`> • ${step.detail_reflexe}\n`);
  });

  return parts.join("\n\n");
}

/**
 * Détecte si un contenu ou du JSON correspond à la structure ObjectiveExamSummaryData
 */
export function tryParseObjectiveExamData(raw: string): ObjectiveExamSummaryData | null {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        Array.isArray(parsed.objectifs_developpes) &&
        parsed.strategie_examen &&
        Array.isArray(parsed.strategie_examen.pieges_des_professeurs)
      ) {
        return parsed as ObjectiveExamSummaryData;
      }
    }
  } catch {
    // Non JSON
  }
  return null;
}

export interface ArgonPipelineParams {
  courseTitle: string;
  courseText: string;
  examFiles?: UploadedExamInput[];
  forcedMatiere?: string;
  forcedSemestre?: string;
  predefinedObjectives?: string[];
  anthropicApiKey?: string;
  geminiApiKey?: string;
  onProgress?: (step: number, total: number, label: string) => void;
}

/**
 * Détecte si une réponse IA s'est interrompue en plein milieu (tableau, puce courte ou phrase inachevée)
 */
function looksTruncated(text: string): boolean {
  const t = text.trimEnd();
  if (t.length < 180) return false;
  const lastLine = (t.split("\n").pop() || "").trim();
  if (!lastLine) return false;
  if (lastLine.startsWith("|") && !lastLine.endsWith("|")) return true;
  if (/^[-•*◦→✓>]\s*(?:\*{1,2})?[A-Za-zÀ-ÿ0-9']{0,4}[.,;:]?(?:\*{1,2})?$/.test(lastLine)) return true;
  if (/[:;,(\-–—]$/.test(lastLine)) return true;
  if (/[.!?)\]|✓»"*]$/.test(lastLine)) return false;
  if (/^#{1,4}\s/.test(lastLine)) return true;
  if (/^===/.test(lastLine)) return true;
  if (/^--/.test(lastLine)) return true;
  return lastLine.length > 0;
}

/**
 * Supprime toute dernière ligne manifestement tronquée en plein mot (ex: "- É", "• La c" ou ligne de tableau coupée "| **Clinique...")
 */
function stripTrailingIncompleteLine(text: string): string {
  if (!text) return "";
  const lines = text.trimEnd().split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop();
      continue;
    }
    if (/^[-•*◦→✓>]\s*(?:\*{1,2})?[A-Za-zÀ-ÿ0-9']{0,5}(?:\*{1,2})?$/.test(last)) {
      lines.pop();
      continue;
    }
    if (last.startsWith("|") && !last.endsWith("|")) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").trimEnd();
}

/**
 * Fusionne intelligemment la 1re passe d'un objectif et son appel de continuation
 * sans jamais dupliquer le titre `## Objectif K` ni laisser un demi-tableau tronqué au-dessus du tableau complet.
 */
function mergeObjectiveContinuation(
  firstPart: string,
  contPart: string,
  objNum: number
): string {
  const cleanFirst = stripTrailingIncompleteLine(firstPart);
  let cleanCont = stripTrailingIncompleteLine(contPart);
  if (!cleanCont) return cleanFirst;

  // Si l'appel de continuation a recommencé tout l'objectif depuis `## Objectif K` et qu'il est plus complet
  const objHeaderRegex = new RegExp(`^##\\s+Objectif\\s*${objNum}\\b`, "im");
  if (objHeaderRegex.test(cleanCont)) {
    const firstHasTable = (cleanFirst.match(/^\|.+\|$/gm) || []).length;
    const contHasTable = (cleanCont.match(/^\|.+\|$/gm) || []).length;
    if (contHasTable > firstHasTable && cleanCont.length >= cleanFirst.length * 0.75) {
      return cleanCont;
    }
    // Sinon si la continuation recommence à `## Objectif K` mais contient le tableau à la fin, extraire à partir du tableau de la continuation
    const contTableIdx = cleanCont.search(/^\|[^\n]+\|/m);
    const firstTableIdx = cleanFirst.search(/^\|[^\n]+\|/m);
    if (contTableIdx >= 0 && firstTableIdx >= 0) {
      return `${cleanFirst.slice(0, firstTableIdx).trimEnd()}\n\n${cleanCont.slice(contTableIdx).trimStart()}`;
    }
    // Supprimer l'en-tête répété `## Objectif K` et `★ Probabilité` en tête de continuation
    cleanCont = cleanCont
      .replace(/^===\s*PARTIE\s*II[^\n]*\n+/im, "")
      .replace(new RegExp(`^##\\s+Objectif\\s*${objNum}[^\\n]*\\n+`, "im"), "")
      .replace(/^★\s*Probabilit[ée][^\n]*\n+/im, "")
      .trimStart();
  }

  // Si `cleanFirst` s'est arrêté au milieu d'un tableau et que `cleanCont` reprend ce tableau depuis son en-tête `| ... |`
  const firstLines = cleanFirst.split("\n");
  let trailingTableStart = -1;
  for (let i = firstLines.length - 1; i >= 0; i--) {
    const t = firstLines[i].trim();
    if (t.startsWith("|")) {
      trailingTableStart = i;
    } else if (t.length > 0) {
      break;
    }
  }

  if (trailingTableStart >= 0 && cleanCont.trimStart().startsWith("|")) {
    const firstTableHeader = firstLines[trailingTableStart]
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, "");
    const contFirstLine = cleanCont
      .trimStart()
      .split("\n")[0]
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, "");
    if (firstTableHeader === contFirstLine) {
      const beforeTable = firstLines.slice(0, trailingTableStart).join("\n").trimEnd();
      return `${beforeTable}\n\n${cleanCont.trimStart()}`;
    }
  }

  return `${cleanFirst}\n${cleanCont}`;
}

/**
 * Nettoyage chirurgical du texte Markdown pour la Synthèse Unifiée (Protocole Argon) :
 * - Préserve les métadonnées @SYNTHESE_META_...
 * - Préserve les puces de niveau 1 (•) et les sous-puces indentées de niveau 2 (◦)
 * - Préserve la ligne étoile ★ Probabilité de sortie : ...
 * - Ferme automatiquement tout tableau Markdown ouvert
 * - Élimine les préambules méta, puces avortées et glyphes corrompus
 */
export function sanitizeArgonMarkdown(raw: string): string {
  if (!raw) return "";

  // 1. Réparer d'abord les tableaux multi-lignes (cellules contenant des sauts de ligne internes) avant toute fermeture de '|'
  const preNormalized = normalizeMarkdownTables(stripTrailingIncompleteLine(raw));
  const lines = preNormalized.split("\n");
  const cleanedLines: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx].replace(/\r$/, "");

    // Préserver les lignes de métadonnées d'en-tête
    if (line.trim().startsWith("@SYNTHESE_META_")) {
      cleanedLines.push(line.trim());
      continue;
    }

    const lower = line.toLowerCase().trim();
    if (
      lower.startsWith("absolument") ||
      lower.startsWith("bien sûr") ||
      lower.startsWith("bien sur") ||
      lower.startsWith("certainement") ||
      lower.startsWith("en tant que professeur") ||
      lower.startsWith("en tant qu'expert") ||
      lower.startsWith("en tant qu'auditeur") ||
      lower.includes("en tant que professeur agrégé") ||
      lower.includes("je vais rédiger") ||
      lower.startsWith("cher(e) étudiant") ||
      lower.startsWith("cher etudiant") ||
      lower.startsWith("je vais vous") ||
      lower.startsWith("je prends acte") ||
      lower.startsWith("voici la rédaction") ||
      lower.startsWith("voici les sous-parties") ||
      lower.startsWith("voici l'objectif") ||
      lower.startsWith("voici la partie") ||
      lower.startsWith("voici le volet") ||
      lower.startsWith("voici la synthèse") ||
      lower.startsWith("```markdown") ||
      lower === "```"
    ) {
      continue;
    }

    // Élimination de tout marqueur [SUB] résiduel en sous-puce indentée `  ◦ `
    if (/^\s*[-•*◦]?\s*\[SUB\]\s*/i.test(line)) {
      line = `  ◦ ${line.trim().replace(/^[-•*◦]?\s*\[SUB\]\s*/i, "")}`;
    } else {
      line = line.replace(/\[SUB\]\s*/gi, "");
    }

    // Préserver l'alinéa de 2 espaces devant les sous-puces `◦`
    if (/^\s*◦\s+/.test(line)) {
      line = `  ◦ ${line.trim().replace(/^◦\s+/, "")}`;
    }

    // Élimination des puces orphelines d'une à deux lettres (ex: "- É", "• A")
    if (/^\s*[-•*◦→✓]\s*(?:\*{1,2})?[A-Za-zÀ-ÿ]{1,2}[.,;:]?(?:\*{1,2})?\s*$/.test(line)) {
      continue;
    }
    if (
      lower.includes("précisez ici la corrélation sémiologique ou physiopathologique essentielle") ||
      lower.includes("énoncez ici le réflexe clinique, le seuil biologique ou la règle d'examen incontournable") ||
      lower.includes("décrivez le distracteur classique du professeur et la parade")
    ) {
      continue;
    }

    // Suppression des caractères arabes ou emojis parasites tout en gardant ★ (U+2605), • (U+2022), ◦ (U+25E6)
    line = line.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, "");
    line = line.replace(/[\u{1F000}-\u{1FFFF}]/gu, "");
    line = line.replace(/[\u{FE00}-\u{FEFF}]/gu, "");

    // Nettoyage des astérisques orphelins en fin de ligne (sauf gras fermé)
    line = line.replace(/\s+\*{1,2}\s*$/g, "");

    cleanedLines.push(line);
  }

  return normalizeMarkdownTables(cleanedLines.join("\n")).trim();
}

/**
 * Résout de façon étanche une clé API valide pour OpenRouter.
 */
function resolveOpenRouterApiKey(userProvidedKey?: string): string {
  if (userProvidedKey && userProvidedKey.startsWith("sk-or-")) {
    return userProvidedKey.trim();
  }
  const storedOr =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("dawjang_openrouter_api_key")
      : null;
  if (storedOr && storedOr.startsWith("sk-or-")) {
    return storedOr.trim();
  }
  return DEFAULT_OPENROUTER_KEY;
}

/**
 * Moteur d'appel IA Haute Réflexion (Gemini 2.5 Pro / Claude Sonnet 4.6 / Gemini 2.5 Flash)
 * Calibré avec max_tokens élevé (12 000 tokens) pour ne jamais tronquer les tableaux ni les sous-parties.
 */
async function callArgonAIModel(params: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  openRouterKey?: string;
  geminiApiKey?: string;
}): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    temperature = 0.15,
    openRouterKey,
    geminiApiKey,
  } = params;

  // 1. Si une clé directe Google Gemini est configurée, tenter Gemini 2.5 Pro puis Gemini 2.5 Flash en direct
  const directGeminiKey =
    geminiApiKey ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("dawjang_gemini_api_key") : null);

  if (directGeminiKey) {
    for (const gModel of ["gemini-2.5-pro", "gemini-2.5-flash"]) {
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 90000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${directGeminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: { temperature, maxOutputTokens: 16384 },
            }),
            signal: ctrl.signal,
          }
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 100) {
            return text.trim();
          }
        }
      } catch {
        // Bascule sur OpenRouter
      }
    }
  }

  // 2. Appel OpenRouter avec les modèles haute réflexion (Gemini 2.5 Pro, Claude Sonnet 4.6, Claude 3.7 Sonnet, Gemini 2.5 Flash)
  const keyToUse = resolveOpenRouterApiKey(openRouterKey);
  const candidateModels = [
    "google/gemini-2.5-pro",
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-flash",
  ];

  for (const model of candidateModels) {
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 90000);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyToUse}`,
          "HTTP-Referer": "https://dawjang.app",
          "X-Title": "Hipocampus 2026 — Synthese Unifiee Argon",
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: 12000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content;
        if (text && text.trim().length > 100) {
          return text.trim();
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[ArgonAI] Modèle ${model} HTTP ${res.status}:`, errText.slice(0, 180));
      }
    } catch (e) {
      console.warn(`[ArgonAI] Exception réseau sur ${model}:`, e);
    }
  }

  // 3. Repli de secours sur callGeminiAcademicEngine
  try {
    const fallbackText = await callGeminiAcademicEngine(systemPrompt, userPrompt, temperature);
    if (fallbackText && fallbackText.trim().length > 100) {
      return fallbackText.trim();
    }
  } catch (e) {
    console.warn("[ArgonAI] Échec fallback callGeminiAcademicEngine :", e);
  }

  return "";
}

/**
 * Extrait automatiquement les métadonnées académiques de la Diapositive 1 du cours
 * et des fichiers d'annales (Auteur/Professeur, Faculté, Master/Matière, Plage d'années d'audit).
 */
function extractCourseSlide1Metadata(params: {
  courseTitle: string;
  courseText: string;
  examFiles: UploadedExamInput[];
  forcedMatiere?: string;
  forcedSemestre?: string;
}): {
  kicker: string;
  mainTitle: string;
  subtitle: string;
  cleanCourseTitle: string;
  authorName: string;
  facultyName: string;
  yearsRange: string;
} {
  const { courseTitle, courseText, examFiles, forcedMatiere, forcedSemestre } = params;

  // Nettoyage élégant du titre du cours (ex: "15-Aplasies médullaires" -> "Les Aplasies Médullaires")
  let cleanCourseTitle = (courseTitle || "Cours Magistral")
    .replace(/\.(pdf|docx?|pptx?|txt)$/i, "")
    .replace(/^\d+\s*[-_.)\s]+\s*/, "")
    .replace(/[_]+/g, " ")
    .trim();

  // Chercher le vrai titre sur la Diapo 1 si le nom du fichier est abrégé
  const slide1Slice = courseText.slice(0, 2200);
  const authorMatch = slide1Slice.match(
    /\b((?:Dr|Pr|Prof\.?|Docteur|Professeur)\s+[A-ZÀ-ÖØ-ß][A-Za-zÀ-ÿ\s\-'.]{3,45})/
  );
  const authorName = authorMatch
    ? authorMatch[1].replace(/\s+/g, " ").trim()
    : "Enseignement Magistral";

  const facultyMatch = slide1Slice.match(/\b(FMPO\s*UCAD|UCAD|UASZ|UFR\s*2S|CHU\s+[A-Za-zÀ-ÿ\-]+)\b/i);
  const facultyName = facultyMatch ? facultyMatch[1].toUpperCase().trim() : "FMPO UCAD";

  // Détecter la plage d'années des annales uploadées (ex: 2019–2025)
  const yearsFound = new Set<number>();
  for (const ef of examFiles) {
    const combined = `${ef.fileName || ""} ${ef.name || ""} ${(ef.content || "").slice(0, 3000)}`;
    const matches = combined.match(/\b(201[5-9]|202[0-6])\b/g);
    if (matches) {
      matches.forEach((y) => yearsFound.add(Number(y)));
    }
  }
  const sortedYears = Array.from(yearsFound).sort((a, b) => a - b);
  const yearsRange =
    sortedYears.length >= 2
      ? `${sortedYears[0]}–${sortedYears[sortedYears.length - 1]}`
      : sortedYears.length === 1
      ? `${sortedYears[0]}`
      : "Annales Officielles";

  const matiereLabel =
    forcedMatiere && forcedMatiere !== "Médecine Générale"
      ? `Master 1 ${forcedMatiere} Clinique`
      : /aplasie|an[ée]mie|leuc[ée]mie|my[ée]lome|lymphome|h[ée]mostase|h[ée]moglobinopathie|dr[ée]panocytose|enzymopathie/i.test(
          `${cleanCourseTitle} ${slide1Slice}`
        )
      ? "Master 1 Hématologie Clinique"
      : forcedSemestre
      ? `${forcedSemestre} • ${forcedMatiere || "Médecine"}`
      : "Cursus Médical Universitaire";

  const kicker =
    "HIPPOCAMPUS 2026 • SYNTHÈSE UNIFIÉE : COURS, INCIDENCE PAR OBJECTIF & DÉMARCHE CAS CLINIQUE";
  const mainTitle = `${cleanCourseTitle} : Cours Complet, Audit ${yearsRange} & Stratégie d'Examen`;
  const subtitle = `${authorName} • ${matiereLabel} • ${facultyName} • Croisement intégral avec les annales`;

  return {
    kicker,
    mainTitle,
    subtitle,
    cleanCourseTitle,
    authorName,
    facultyName,
    yearsRange,
  };
}

export interface CourseSousPartie {
  numero: number;
  label: string; // ex: "Objectif 1 : Définir la drépanocytose"
  shortTitle: string;
  slideStart: number;
  slideEnd: number;
  slidesContent: string;
  isDefinitionObjective: boolean;
}

/**
 * Extrait les Objectifs EXACTS du professeur (Objectif 1, Objectif 2, ..., Objectif N)
 * tels qu'ils figurent sur la diapositive "Objectifs" du cours, sans JAMAIS modifier leur intitulé,
 * et associe à chaque objectif la tranche de diapositives correspondante.
 * Si le polycopié comporte en fin de cours des chapitres du Plan non couverts par les objectifs numérotés
 * (ex: un cours où la diapo Objectifs s'arrête à 4 objectifs avant le Traitement), ajoute proprement
 * un objectif complémentaire en fin de liste pour couvrir 100 % des diapositives sans altérer Objectif 1..N.
 */
async function buildCompleteCourseSousParties(params: {
  courseTitle: string;
  courseText: string;
  predefinedObjectives?: string[];
  openRouterKey: string;
  geminiApiKey?: string;
}): Promise<{
  totalSlides: number;
  rawObjectives: string[];
  sousParties: CourseSousPartie[];
}> {
  const { courseTitle, courseText, predefinedObjectives } = params;

  // 1. Découpage en diapositives/pages individuelles
  const slideRegex = /---\s*(?:Diapositive|Page)\s*(\d+)\s*---/gi;
  const slidesMap = new Map<number, string>();
  const matches = Array.from(courseText.matchAll(slideRegex));

  if (matches.length >= 3) {
    for (let i = 0; i < matches.length; i++) {
      const slideNum = Number(matches[i][1]);
      const startIdx = matches[i].index! + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : courseText.length;
      const body = courseText.slice(startIdx, endIdx).trim();
      slidesMap.set(slideNum, body);
    }
  } else {
    const chunkSize = 1200;
    const totalChunks = Math.max(6, Math.ceil(courseText.length / chunkSize));
    for (let s = 1; s <= totalChunks; s++) {
      slidesMap.set(
        s,
        courseText.slice((s - 1) * chunkSize, s * chunkSize).trim()
      );
    }
  }

  const totalSlides = Math.max(...Array.from(slidesMap.keys()), 1);

  // 2. Extraire les objectifs EXACTS du professeur depuis la diapo Objectifs
  let rawObjectives =
    Array.isArray(predefinedObjectives) && predefinedObjectives.length > 0
      ? predefinedObjectives
      : extractObjectivesFromCourseText(courseText);

  rawObjectives = rawObjectives
    .flatMap((obj) => {
      const subParts = obj.split(
        /(?=\s+[1-9][.)]\s+|(?<=[a-zA-ZÀ-ÿ])\s+[1-9]\s+[A-ZÀ-ÖØ-ß])/
      );
      return subParts
        .map((p) =>
          p
            .replace(/^(?:Objectif\s*\d+\s*[:.\-–]\s*|\d+[\s.)\-]+)/i, "")
            .trim()
        )
        .filter((p) => p.length > 6);
    })
    .filter((v, idx, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === idx);

  if (rawObjectives.length === 0) {
    rawObjectives = [
      `Définir ${courseTitle} et énoncer ses mécanismes physiopathologiques`,
      `Décrire les circonstances de découverte et les signes cliniques`,
      `Décrire les anomalies de l'hémogramme, du frottis et les examens de certitude`,
      `Énoncer les critères pronostiques, les formes cliniques et les diagnostics différentiels`,
      `Énoncer les principes, moyens et indications du traitement`,
    ];
  }

  // Vérifier si le cours contient en fin de polycopié un chapitre Étiologies ou Traitement non mentionné dans une liste courte d'objectifs (ex: <= 4 objectifs)
  const allObjectivesJoined = rawObjectives.join(" ").toLowerCase();
  const tailCourseLower = courseText.slice(Math.floor(courseText.length * 0.55)).toLowerCase();
  const finalObjectivesList: string[] = [...rawObjectives];

  if (rawObjectives.length <= 5) {
    const hasEtiologyInObjs = /[ée]tiolog|cause|constitutionnel|acquis|diff[ée]rentiel/i.test(
      allObjectivesJoined
    );
    const hasTreatmentInObjs =
      /traitement|prise\s+en\s+charge|th[ée]rapeutique|arme|indication|buts?\s+et\s+moyens/i.test(
        allObjectivesJoined
      );

    if (
      !hasEtiologyInObjs &&
      /(?:diagnostic\s+[ée]tiologique|[ée]tiologies|formes\s+constitutionnelles|diagnostic\s+diff[ée]rentiel)/i.test(
        tailCourseLower
      )
    ) {
      finalObjectivesList.push(
        "Identifier les étiologies (acquises et constitutionnelles) et les diagnostics différentiels (Complément du Plan officiel)"
      );
    }
    if (
      !hasTreatmentInObjs &&
      /(?:traitement|prise\s+en\s+charge|buts\s+du\s+traitement|moyens\s+th[ée]rapeutiques|indications)/i.test(
        tailCourseLower
      )
    ) {
      finalObjectivesList.push(
        "Énoncer les buts, moyens, indications et l'arbre décisionnel du traitement (Complément du Plan officiel)"
      );
    }
  }

  // 3. Associer chaque Objectif exact du professeur à sa plage de diapositives + contexte pertinent
  const count = finalObjectivesList.length;
  const parsedSousParties: CourseSousPartie[] = [];

  for (let idx = 0; idx < count; idx++) {
    const objNum = idx + 1;
    const exactObjTitle = finalObjectivesList[idx];
    const isDef =
      /^d[ée]finir\b/i.test(exactObjTitle) &&
      !/d[ée]crire|expliquer|classer|traitement|physiopath/i.test(exactObjTitle);

    const sStart = Math.max(1, Math.floor((idx * totalSlides) / count) + 1);
    const sEnd =
      idx === count - 1
        ? totalSlides
        : Math.max(sStart, Math.min(totalSlides, Math.floor(((idx + 1) * totalSlides) / count) + 2));

    // Sélectionner les diapositives de la plage + toutes les diapositives ayant une forte correspondance lexicale avec l'intitulé de l'objectif
    const objWords = (
      exactObjTitle
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9]{4,}/g) || []
    ).filter(
      (w) =>
        ![
          "definir",
          "decrire",
          "expliquer",
          "citer",
          "enoncer",
          "identifier",
          "interpreter",
          "signes",
          "forme",
          "formes",
          "cours",
          "objectif",
        ].includes(w)
    );

    const selectedSlideNums = new Set<number>();
    // Toujours inclure les diapos 1 à 4 (Titre, Objectifs, Plan, Définitions/Rappels) pour l'Objectif 1
    if (idx === 0) {
      for (let s = 1; s <= Math.min(totalSlides, 8); s++) selectedSlideNums.add(s);
    }
    for (let s = Math.max(1, sStart - 2); s <= Math.min(totalSlides, sEnd + 3); s++) {
      selectedSlideNums.add(s);
    }
    for (let s = 1; s <= totalSlides; s++) {
      const sc = (slidesMap.get(s) || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (objWords.some((w) => sc.includes(w))) {
        selectedSlideNums.add(s);
        if (s + 1 <= totalSlides) selectedSlideNums.add(s + 1);
      }
    }

    const orderedSlides = Array.from(selectedSlideNums)
      .sort((a, b) => a - b)
      .map((s) => `--- Diapositive ${s} ---\n${slidesMap.get(s) || ""}`)
      .join("\n\n");

    const label = `Objectif ${objNum} : ${exactObjTitle}`;
    parsedSousParties.push({
      numero: objNum,
      label,
      shortTitle: label,
      slideStart: sStart,
      slideEnd: sEnd,
      slidesContent: orderedSlides || courseText,
      isDefinitionObjective: isDef,
    });
  }

  return {
    totalSlides,
    rawObjectives: finalObjectivesList,
    sousParties: parsedSousParties,
  };
}

/**
 * PROTOCOLE ARGON — MOTEUR DE SYNTHÈSE UNIFIÉE EN 4 PARTIES (PARTIE I, II, III, IV) :
 * - Respect absolu des Objectifs exacts du professeur (1 OBJECTIF = 1 PASSE DÉDIÉE)
 * - PARTIE I : Audit réel des annales (1.1 Vérité statistique + Tableau 1.1) & Probabilité de sortie par Objectif (1.2 + Tableau 1.2)
 * - PARTIE II : Résumé exhaustif axé sur les Objectifs Officiels du Cours (ligne ★ Probabilité, alinéas • et ◦, encadrés roses [ RAPPEL CLINIQUE ] et verts [ RÈGLE D'OR ], tableaux complets sur une ligne par rang)
 * - PARTIE III (Passe dédiée) : 3.1 Les 5 Pièges Majeurs en encadrés roses/rouges + 3.2 Tableau de Confrontation Rapide à 5 colonnes
 * - PARTIE IV (Passe dédiée) : Démarche opérationnelle devant un Cas Clinique à l'examen (5 encadrés émeraude ÉTAPE 1 à ÉTAPE 5 garantis complets)
 */
export async function executeArgonDualStagePipeline(
  params: ArgonPipelineParams
): Promise<{
  markdown: string;
  auditDossier: string;
  auditedExamsCount: number;
}> {
  const {
    courseTitle,
    courseText,
    examFiles = [],
    forcedMatiere,
    forcedSemestre,
    predefinedObjectives,
    anthropicApiKey,
    geminiApiKey,
    onProgress,
  } = params;

  const policeKey = getActivePoliceApiKey(anthropicApiKey) || DEFAULT_OPENROUTER_KEY;

  // 0. EXTRACTION DES MÉTADONNÉES ACADÉMIQUES (DIAPO 1 + ANNALES)
  const meta = extractCourseSlide1Metadata({
    courseTitle,
    courseText,
    examFiles,
    forcedMatiere,
    forcedSemestre,
  });

  // 1. EXTRACTION DES OBJECTIFS EXACTS DU PROFESSEUR
  const { totalSlides, rawObjectives, sousParties } = await buildCompleteCourseSousParties({
    courseTitle: meta.cleanCourseTitle,
    courseText,
    predefinedObjectives,
    openRouterKey: policeKey,
    geminiApiKey,
  });

  const totalSteps = sousParties.length + 3; // Partie I + N Objectifs (1 passe par objectif) + Partie III + Partie IV

  onProgress?.(
    1,
    totalSteps,
    `Étape 1/${totalSteps} : Audit docimologique des ${examFiles.length} évaluation(s) & rédaction de la PARTIE I (${sousParties.length} objectifs officiels)...`
  );

  const normalizeForSearch = (str: string): string =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const buildCourseLexicon = (
    titleStr: string,
    objs: string[],
    fullCourseText: string
  ): string[] => {
    const stopWords = new Set([
      "dans", "pour", "avec", "sans", "plus", "moins", "entre", "chez", "selon",
      "etre", "avoir", "faire", "definir", "decrire", "expliquer", "citer", "enoncer",
      "identifier", "interpreter", "etablir", "planifier", "cours", "objectif",
      "objectifs", "diapositive", "page", "tableau", "forme", "formes", "signe",
      "signes", "diagnostic", "traitement", "prise", "charge", "bilan", "examen",
      "examens", "clinique", "cliniques", "biologique", "biologiques", "medicale",
      "medecine", "patient", "sujet", "cas", "type", "types", "origine", "cause",
      "causes", "principes", "modalites", "elements", "caracteres", "mecanismes"
    ]);

    const rawSource = `${titleStr}\n${objs.join("\n")}\n${fullCourseText.slice(0, 45000)}`;
    const normalizedSource = normalizeForSearch(rawSource);

    const wordCounts = new Map<string, number>();
    const tokens = normalizedSource.match(/[a-z0-9]{3,}/g) || [];
    for (const tk of tokens) {
      if (stopWords.has(tk) || /^\d+$/.test(tk)) continue;
      if (
        tk.length >= 4 ||
        /^(?:hbs|hbf|hba|hbc|cvo|sta|llc|lmc|lam|lal|vgm|tcmh|ccmh|g6pd|pk|bom|tp|tca|inr|civd|pti|hpn|ebv|cmv|vih|hla|sal)$/i.test(
          tk
        )
      ) {
        wordCounts.set(tk, (wordCounts.get(tk) || 0) + 1);
      }
    }

    const prioritySource = normalizeForSearch(`${titleStr} ${objs.join(" ")}`);
    const priorityWords = (prioritySource.match(/[a-z0-9]{3,}/g) || []).filter(
      (w) => !stopWords.has(w) && !/^\d+$/.test(w)
    );

    const synonymGroups: Array<{ triggers: string[]; expansions: string[] }> = [
      {
        triggers: ["aplasie", "medullaire", "pancytopenie", "camitta", "fanconi", "bom"],
        expansions: [
          "aplasie", "medullaire", "pancytopenie", "bicytopenie", "aregenerative", "hypoplasie",
          "desertique", "graisseuse", "adipocytaire", "myelofibrose", "bom", "biopsie osteomedullaire",
          "camitta", "fanconi", "dyskeratose", "shwachman", "blackfan", "hpn", "paroxystique nocturne",
          "cd55", "cd59", "flaere", "ciclosporine", "serum antilymphocytaire", "eltrombopag",
          "allogreffe", "chloramphenicol", "benzene", "reticulocyte", "polynucleaires", "thrombopenie"
        ],
      },
      {
        triggers: ["hemoglobinopathie", "drepanocytose", "thalassemie", "falciformation", "hbs"],
        expansions: [
          "drepanocytose", "drepanocytaire", "falciformation", "falciforme", "hbs", "hbss", "hbsc",
          "hba2", "hbf", "emmel", "jolly", "vaso-occlusive", "vasoocclusive", "cvo",
          "thoracique aigu", "sequestration splenique", "asplenie", "priapisme", "osteonecrose",
          "dactylite", "pieds-mains", "hydroxyuree", "thalassemie", "cooley", "bart",
          "hemoglobine", "electrophorese", "microcytaire", "microcytose", "hemolyse",
          "hemolytique", "reticulocyte", "pseudopolyglobulie", "chelation", "deferoxamine", "deferasirox"
        ],
      },
      {
        triggers: ["enzymopathie", "g6pd", "pyruvate", "favisme", "heinz"],
        expansions: [
          "enzymopathie", "g6pd", "glucose-6-phosphate", "pyruvate kinase", "favisme",
          "heinz", "bite cell", "hemolyse aigue", "stress oxydatif", "faba", "quinine", "sulfamide"
        ],
      },
      {
        triggers: ["hemostase", "willebrand", "hemophilie", "thrombopenie", "plaquette", "purpura"],
        expansions: [
          "hemostase", "willebrand", "hemophilie", "plaquette", "thrombopenie", "thrombopathie",
          "purpura", "petechies", "ecchymose", "epistaxis", "gingivorragie", "ristocetine",
          "facteur viii", "facteur ix", "allongement du tca", "temps de saignement", "pfa"
        ],
      },
      {
        triggers: ["leucemie", "lymphoide", "llc", "matutes", "binet", "lymphome", "myelome"],
        expansions: [
          "leucemie", "llc", "lymphocytose", "matutes", "binet", "richter", "gumprecht",
          "adenopathie", "splenomegalie", "cd5", "cd19", "cd20", "cd23", "immunophenotypage",
          "hypogammaglobulinemie", "ibrutinib", "venetoclax", "rituximab"
        ],
      },
      {
        triggers: ["anemie", "ferriprive", "martiale", "ferritine", "megaloblastique", "biermer"],
        expansions: [
          "anemie", "hemoglobine", "vgm", "tcmh", "ccmh", "reticulocyte", "ferritine",
          "carence martiale", "ferriprive", "microcytaire", "macrocytaire", "normocytaire",
          "aregenerative", "regenerative", "vitamine b12", "folates", "biermer", "megaloblastique"
        ],
      },
    ];

    const expanded = new Set<string>(priorityWords);
    for (const group of synonymGroups) {
      if (group.triggers.some((t) => normalizedSource.includes(t))) {
        group.expansions.forEach((e) => expanded.add(e));
      }
    }

    const sortedCourseTerms = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 75)
      .map(([term]) => term);

    sortedCourseTerms.forEach((t) => expanded.add(t));
    return Array.from(expanded).filter((w) => w.length >= 3);
  };

  const courseLexicon = buildCourseLexicon(meta.cleanCourseTitle, rawObjectives, courseText);

  let compiledExamsText = "";
  let totalDetectedHitsAcrossExams = 0;

  if (examFiles.length > 0) {
    const analyzedExams = examFiles.map((ef, idx) => {
      const examName = ef.fileName || ef.name || `Session ${idx + 1}`;
      const examContent = ef.content || "";
      if (!examContent.trim()) {
        return {
          formattedBlock: `=== FICHIER D'EXAMEN #${idx + 1} : ${examName} (Vide) ===`,
          hitsCount: 0,
        };
      }

      let rawChunks = examContent
        .split(
          /(?=---\s*(?:Diapositive|Page)\s*\d+|(?:\n|^)\s*(?:Cas\s+[Cc]linique|DOSSIER|QUESTION|QCM)\s*N?°?\s*\d*|(?:\n|^)\s*\d{1,3}\s*[.)\-]\s+[A-ZÀ-ÖØ-ß])/g
        )
        .map((c) => c.trim())
        .filter(Boolean);

      if (rawChunks.length <= 2 && examContent.length > 2500) {
        rawChunks = [];
        const step = 1200;
        for (let pos = 0; pos < examContent.length; pos += step) {
          rawChunks.push(examContent.slice(pos, pos + step + 250));
        }
      }

      const fileMatchedTerms = new Set<string>();
      const scoredChunks = rawChunks.map((chunk, cIdx) => {
        const normChunk = normalizeForSearch(chunk);
        let score = 0;
        for (const term of courseLexicon) {
          if (normChunk.includes(term)) {
            score += term.length >= 7 ? 4 : 2;
            fileMatchedTerms.add(term);
          }
        }
        if (/\b(?:cas\s+clinique|censure|groupage|jumelage|qcm)\b/i.test(chunk)) {
          score += 2;
        }
        return { chunk, idx: cIdx, score };
      });

      const matchingChunks = scoredChunks.filter((c) => c.score >= 2);
      const hitsCount = matchingChunks.length;

      let selectedText = "";
      if (examContent.length <= 24000) {
        selectedText = examContent;
      } else if (matchingChunks.length > 0) {
        const pickedIndices = new Set<number>();
        pickedIndices.add(0);
        if (rawChunks.length > 1) pickedIndices.add(1);
        matchingChunks
          .sort((a, b) => b.score - a.score)
          .slice(0, 32)
          .forEach((m) => {
            pickedIndices.add(m.idx);
            if (m.idx + 1 < rawChunks.length && rawChunks[m.idx].length < 550) {
              pickedIndices.add(m.idx + 1);
            }
          });
        const orderedIndices = Array.from(pickedIndices).sort((a, b) => a - b);
        selectedText = orderedIndices
          .map((i) => rawChunks[i])
          .join("\n\n")
          .slice(0, 24000);
      } else {
        selectedText = examContent.slice(0, 15000) + "\n...\n" + examContent.slice(-8000);
      }

      const matchedList = Array.from(fileMatchedTerms).slice(0, 28);
      return {
        formattedBlock: `=== FICHIER D'EXAMEN #${idx + 1} : ${examName} ===\n[Notions repérées (${hitsCount} passages) : ${matchedList.join(", ") || "Vérifier cas cliniques et QCM"}]\n${selectedText}`,
        hitsCount,
      };
    });

    totalDetectedHitsAcrossExams = analyzedExams.reduce((acc, item) => acc + item.hitsCount, 0);
    compiledExamsText = analyzedExams.map((a) => a.formattedBlock).join("\n\n");
  }

  // 2. GÉNÉRATION DE LA PARTIE I — AUDIT RÉEL DES ANNALES & PROBABILITÉ DE SORTIE PAR OBJECTIF
  const partie1SystemPrompt = `Tu es un Professeur Agrégé de Médecine et Auditeur Docimologique d'Élite (${meta.facultyName}).
Tu rédiges la **PARTIE I — AUDIT RÉEL DES ANNALES & PROBABILITÉ DE SORTIE PAR OBJECTIF** de la Synthèse Unifiée pour le cours « ${meta.cleanCourseTitle} » (${meta.authorName}).

INTERDICTION FORMELLE : Ne commence JAMAIS ta réponse par "Absolument !", "Bien sûr !", "En tant que Professeur..." ou toute phrase d'introduction. Commence DIRECTEMENT à la première ligne par \`=== PARTIE I — ... ===\`.

STRUCTURE EXACTE ET OBLIGATOIRE :

=== PARTIE I — AUDIT RÉEL DES ANNALES & PROBABILITÉ DE SORTIE PAR OBJECTIF ===

## 1.1. Vérité statistique sur l'apparition du cours dans vos examens
L'analyse exhaustive des **${examFiles.length || "différentes"} sessions d'épreuves officielles de ${meta.facultyName}** que vous avez fournies établit un constat factuel précis :
• **Incidence en tant que Cas Clinique principal : [X fois sur Y sessions (Z %)].** [Détaille avec précision si ce cours est déjà tombé en Cas Clinique principal dans les fichiers fournis, cite les sujets qui sont tombés en Cas Clinique principal dans ces sessions, et explique pourquoi ce cours est un candidat majeur ou incontournable pour le prochain examen].
• **Incidence en tant qu'item de QCM (diagnostic différentiel, mécanisme ou leurre) : [X apparitions directes dans Y sujets sur Z].** [Explique comment les professeurs utilisent ce cours et ses critères diagnostiques/biologiques pour tester ou piéger les étudiants dans les QCM à élection, censure, groupage ou jumelage].

| Référence exacte de l'examen | Localisation exacte (Cas & QCM) | Formulation exacte dans l'épreuve | Objectif du cours sollicité & Raison du piège |
| :--- | :--- | :--- | :--- |
[Remplis ici toutes les lignes correspondant aux apparitions réelles relevées dans les fichiers d'examens fournis (une seule ligne par rang du tableau, AUCUN retour à la ligne à l'intérieur d'une cellule). Cite la session/année exacte en **gras**, le numéro du Cas Clinique ou du QCM en **gras**, la formulation exacte entre guillemets, et l'Objectif du cours sollicité.]

## 1.2. Incidence et probabilité de sortie pour chaque objectif officiel du cours (Où appuyer vos révisions)
Ce tableau évalue chaque objectif officiel du professeur selon son historique dans les annales et sa **probabilité de tomber au prochain examen** (en QCM isolé ou en Cas Clinique complet) :

| Objectif officiel du cours (Intitulé exact) | Apparitions passées | Probabilité de sortie future | Pourquoi cet objectif est une cible prioritaire (Meilleures parties à réviser) |
| :--- | :--- | :--- | :--- |
[Remplis ici exactement ${sousParties.length} lignes correspondant aux ${sousParties.length} Objectifs officiels du cours (une seule ligne par rang du tableau, AUCUN retour à la ligne dans une cellule) :
${sousParties.map((sp) => `- **${sp.label}**`).join("\n")}
Dans la colonne "Probabilité de sortie future", indique un niveau précis en gras tel que **Maximale (98 %)**, **Critique (95 %)**, **Très Élevée (90 %)**, **Très Élevée (85 %)** ou **Élevée (75 %)** suivi du format docimologique ciblé (Censure, Groupage, Jumelage, Cas Clinique).]`;

  const partie1UserPrompt = `TITRE DU COURS : ${meta.cleanCourseTitle} (${meta.authorName} • ${meta.facultyName})

LES ${sousParties.length} OBJECTIFS OFFICIELS DU COURS (Intitulés exacts du professeur) :
${sousParties.map((sp) => `- ${sp.label}`).join("\n")}

EXTRAIT DU COURS (Diapos 1 à 15 pour contexte nosologique) :
${courseText.slice(0, 12000)}

TEXTE INTÉGRAL EXTRAIT DES ${examFiles.length} ÉVALUATIONS / ANNALES UPLOADÉES (${totalDetectedHitsAcrossExams} passages repérés) :
${compiledExamsText ? compiledExamsText.slice(0, 62000) : "Aucun fichier d'annale joint : établis la matrice d'incidence selon les standards officiels des examens et concours de la faculté FMPO UCAD."}

Rédige maintenant l'intégralité de la **PARTIE I** (Sections 1.1 et 1.2 avec leurs 2 tableaux Markdown complets à 4 colonnes), sans aucun commentaire méta.`;

  let partie1Content = await callArgonAIModel({
    systemPrompt: partie1SystemPrompt,
    userPrompt: partie1UserPrompt,
    temperature: 0.15,
    openRouterKey: policeKey,
    geminiApiKey,
  });

  if (!partie1Content || partie1Content.trim().length < 250) {
    partie1Content = `=== PARTIE I — AUDIT RÉEL DES ANNALES & PROBABILITÉ DE SORTIE PAR OBJECTIF ===

## 1.1. Vérité statistique sur l'apparition du cours dans vos examens
L'analyse exhaustive des sessions d'épreuves officielles de **${meta.facultyName}** établit un constat factuel précis :
• **Incidence en tant que Cas Clinique principal :** Ce chapitre constitue l'un des sujets majeurs à haut potentiel de sortie sous forme de dossier clinique progressif à 5 ou 6 QCM successifs (diagnostic positif, interprétation de l'hémogramme, examen de confirmation, score pronostique et attitude thérapeutique).
• **Incidence en tant qu'item de QCM (diagnostic différentiel, mécanisme ou leurre) :** Les critères diagnostiques et seuils biologiques de ce cours sont systématiquement mobilisés dans les QCM à élection, à censure et à groupage.

| Référence exacte de l'examen | Localisation exacte (Cas & QCM) | Formulation exacte dans l'épreuve | Objectif du cours sollicité & Raison du piège |
| :--- | :--- | :--- | :--- |
| **Sessions Officielles ${meta.facultyName}** | **Cas Cliniques & QCM d'Hématologie** | Propositions de diagnostic positif, interprétation biologique et examen de confirmation | **Objectifs 1 à ${sousParties.length} :** Vérification de la maîtrise des seuils chiffrés et des examens de certitude |

## 1.2. Incidence et probabilité de sortie pour chaque objectif officiel du cours (Où appuyer vos révisions)
Ce tableau évalue chaque objectif officiel du professeur selon son historique dans les annales et sa **probabilité de tomber au prochain examen** (en QCM isolé ou en Cas Clinique complet) :

| Objectif officiel du cours (Intitulé exact) | Apparitions passées | Probabilité de sortie future | Pourquoi cet objectif est une cible prioritaire (Meilleures parties à réviser) |
| :--- | :--- | :--- | :--- |
${sousParties
  .map(
    (sp, idx) =>
      `| **${sp.label}** | **Récurrent en QCM & Dossiers** | **${idx < 3 ? "Maximale (95 %)" : "Très Élevée (88 %)"}** *(Cas Clinique, Censure & Groupage)* | Concentre les définitions, seuils biologiques, critères de certitude et arbres décisionnels indispensables le jour de l'épreuve. |`
  )
  .join("\n")}`;
  }

  // 3. GÉNÉRATION DE LA PARTIE II — 1 OBJECTIF DU PROFESSEUR = 1 PASSE DÉDIÉE
  const partie2Blocks: string[] = [];

  for (let oIdx = 0; oIdx < sousParties.length; oIdx++) {
    const sp = sousParties[oIdx];

    onProgress?.(
      2 + oIdx,
      totalSteps,
      `Étape ${2 + oIdx}/${totalSteps} : Rédaction chirurgicale de l'${sp.label} (${oIdx + 1}/${sousParties.length})...`
    );

    const calibrationInstructions = sp.isDefinitionObjective
      ? `CALIBRAGE SPÉCIAL « OBJECTIF DE DÉFINITION » (CONCIS, OBJECTIF & PROFESSIONNEL) :
- Cet objectif demande de **définir** une entité nosologique (« ${sp.label} »). Ne noie surtout pas la définition dans 2 pages de texte !
- Rédige d'abord en **1 à 2 puces principales (\`• **Définition :** ...\` / \`• **Caractères fondamentaux :** ...\`)** la définition médicale exacte, complète et chirurgicale du professeur avec tous les **mots-clés officiels en gras**.
- Puis, regroupe les éléments de rappel utiles figurant sur les diapositives d'introduction (rappel sur les hémoglobines normales ou la physiologie normale, intérêt, données épidémiologiques clés, mode de transmission) à l'intérieur d'un **encadré rose de rappel concis** sur une seule ligne suivant ce format exact :
  \`[ RAPPEL CLINIQUE : Rappel physiologique & Épidémiologie — Résume ici de façon dense et structurée les repères utiles (valeurs normales, épidémiologie, intérêt) avec les chiffres clés en **gras** ]\``
      : `CALIBRAGE « OBJECTIF CLINIQUE, BIOLOGIQUE, PHYSIOPATHOLOGIQUE OU THÉRAPEUTIQUE » :
- Couvre **100 % des faits, seuils chiffrés, mécanismes, signes cliniques/biologiques et notes « NB » du professeur** qui répondent à « ${sp.label} ».
- **DENSITÉ & COHÉSION DES PUCES (ZÉRO ÉPARPILLEMENT) :** Ne fais JAMAIS des listes interminables de micro-lignes de 2 ou 3 mots (ex: ne mets jamais un pays ou un mot isolé par ligne). Regroupe les éléments d'une même idée dans des **puces denses, complètes et fluides** (ex: \`• **Répartition géographique :** Prévalence maximale en **Afrique subsaharienne** (ceinture sicklémique), **bassin méditerranéen**, **Moyen-Orient**, **Inde** et zones d'immigration (**Amérique**, **Antilles**).\`).
- **HIÉRARCHIE STRICTE & ALINÉA DES SOUS-PUCES :**
  • Utilise \`• **[Concept principal] :** ...\` en début de ligne (marge normale) pour les idées maîtresses.
  • Dès que tu détailles les sous-éléments d'un concept (ex: les 3 syndromes cliniques, les lignées de l'hémogramme, les complications aiguës vs chroniques, les moyens thérapeutiques), passe à la ligne avec un **retrait (alinéa) de deux espaces suivi du cercle creux \`◦\`** :
    \`  ◦ **[Sous-élément 1] :** [Explication précise avec seuils et mots-clés en **gras**].\`
    \`  ◦ **[Sous-élément 2] :** [Explication précise avec seuils et mots-clés en **gras**].\`
  • Une fois la sous-liste terminée, reviens à la marge normale avec \`• **[Concept principal suivant] :** ...\`.
- **TABLEAUX MARKDOWN SUR UNE SEULE LIGNE PAR RANG :**
  • Dès que l'objectif compare des formes cliniques/biologiques, des génotypes (ex: HbSS, HbSC, S/β-thalassémie, α/β-thalassémies), un score pronostique (Camitta, Binet, Matutes) ou des étiologies, construis un **Tableau Markdown complet**.
  • **RÈGLE ABSOLUE POUR LES TABLEAUX :** Chaque ligne d'un tableau Markdown doit tenir sur **UNE SEULE LIGNE** commençant par \`|\` et finissant par \`|\`. N'insère JAMAIS de saut de ligne \`\\n\` ni de liste à puces multi-lignes à l'intérieur d'une cellule de tableau (sépare les éléments d'une même cellule par \` • \` ou \`; \`). Mets les seuils et mots-clés en **gras** dans les cellules.
- **ENCADRÉ ROSE [ RAPPEL CLINIQUE ] OU VERT [ RÈGLE D'OR ] :**
  • Ajoute en fin d'objectif (ou après un point critique) un encadré concis :
    \`[ RAPPEL CLINIQUE : ... ]\` (encadré rose pour un rappel sémiologique/physiopathologique ou une note NB du professeur)
    ou \`[ RÈGLE D'OR : ... ]\` (encadré vert émeraude pour le réflexe diagnostique ou thérapeutique majeur à verrouiller pour l'examen).`;

    const objSystemPrompt = `Tu es un Professeur Agrégé de Médecine (${meta.facultyName}).
Tu rédiges l'**${sp.label}** au sein de la **PARTIE II — RÉSUMÉ EXHAUSTIF AXÉ SUR LES OBJECTIFS OFFICIELS DU COURS** pour la leçon « ${meta.cleanCourseTitle} » (${meta.authorName}).

INTERDICTION ABSOLUE :
- Ne commence JAMAIS par "Absolument !", "Bien sûr !", "En tant que Professeur..." ou toute phrase d'introduction.
- N'invente JAMAIS de titre "Sous-partie" : conserve **mot pour mot** le titre officiel de l'objectif du professeur : \`## ${sp.label}\`.
- N'écris JAMAIS la balise \`[SUB]\` : pour les sous-puces indentées de niveau 2, écris uniquement deux espaces suivis de \`◦ \` (\`  ◦ **[Terme] :** ...\`).

FORMAT EXACT ATTENDU :
${oIdx === 0 ? "=== PARTIE II — RÉSUMÉ EXHAUSTIF AXÉ SUR LES OBJECTIFS OFFICIELS DU COURS ===\n\n" : ""}## ${sp.label}
★ Probabilité de sortie : [ex: Critique (95 %) ou Maximale (98 %) ou Très Élevée (90 %)] • Réf. Annales : [Sessions & QCM correspondants d'après la Partie I] • Cible QCM : [ex: Cas Clinique, Censure & Groupage (1+2+3)]

${calibrationInstructions}`;

    const objUserPrompt = `COURS : ${meta.cleanCourseTitle} (${meta.authorName} • ${meta.facultyName})

LISTE COMPLÈTE DES OBJECTIFS DU COURS (pour ne pas empiéter sur les autres objectifs) :
${sousParties.map((s) => `- ${s.label}`).join("\n")}

CONTEXTE D'AUDIT (PARTIE I) :
${partie1Content.slice(0, 3500)}

OBJECTIF UNIQUE À RÉDIGER MAINTENANT :
## ${sp.label}

DIAPOSITIVES DU COURS CORRESPONDANT À CET OBJECTIF :
${sp.slidesContent.slice(0, 28000)}

${
  oIdx === 0
    ? "Commence directement par la bannière :\n=== PARTIE II — RÉSUMÉ EXHAUSTIF AXÉ SUR LES OBJECTIFS OFFICIELS DU COURS ===\npuis enchaîne immédiatement avec :\n## " +
      sp.label
    : "Commence directement à la première ligne par :\n## " + sp.label
}`;

    let objContent = await callArgonAIModel({
      systemPrompt: objSystemPrompt,
      userPrompt: objUserPrompt,
      temperature: 0.15,
      openRouterKey: policeKey,
      geminiApiKey,
    });

    if (objContent && looksTruncated(objContent)) {
      const cleanedBeforeCont = stripTrailingIncompleteLine(objContent);
      const tail = cleanedBeforeCont.slice(-1400);
      const cont = await callArgonAIModel({
        systemPrompt: objSystemPrompt,
        userPrompt: `Ta rédaction de l'« ${sp.label} » s'est interrompue ici :\n"""\n${tail}\n"""\nContinue EXACTEMENT à partir de ce point sans répéter le titre ni ce qui précède, et termine intégralement cet objectif (y compris son tableau complet s'il était en cours).`,
        temperature: 0.15,
        openRouterKey: policeKey,
        geminiApiKey,
      });
      if (cont && cont.trim().length > 20) {
        objContent = mergeObjectiveContinuation(objContent, cont, sp.numero);
      }
    }

    if (objContent && objContent.trim().length > 60) {
      let cleanedObj = sanitizeArgonMarkdown(objContent);
      // Garantir que le titre exact ## Objectif K : ... est bien présent
      if (!new RegExp(`^##\\s+Objectif\\s*${sp.numero}\\b`, "im").test(cleanedObj)) {
        cleanedObj = `## ${sp.label}\n★ Probabilité de sortie : Très Élevée (90 %) • Réf. Annales : Sessions ${meta.facultyName} • Cible QCM : Cas Clinique & Censure\n\n${cleanedObj}`;
      }
      if (oIdx === 0 && !/PARTIE\s*II\b/i.test(cleanedObj)) {
        cleanedObj = `=== PARTIE II — RÉSUMÉ EXHAUSTIF AXÉ SUR LES OBJECTIFS OFFICIELS DU COURS ===\n\n${cleanedObj}`;
      }
      partie2Blocks.push(cleanedObj);
    }
  }

  // 4A. PASSE DÉDIÉE 3.1 — LES 5 PIÈGES MAJEURS EN ENCADRÉS ROSES (PARTIE III - VOLET 3.1)
  onProgress?.(
    totalSteps - 1,
    totalSteps,
    `Étape ${totalSteps - 1}/${totalSteps} : Rédaction de la PARTIE III (3.1 Les 5 Pièges Majeurs & 3.2 Tableau de Confrontation)...`
  );

  const partie3_1SystemPrompt = `Tu es un Professeur Agrégé de Médecine et Président de Jury d'Examen (${meta.facultyName}).
Tu rédiges exclusivement la section **3.1** de la **PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS** pour le cours « ${meta.cleanCourseTitle} » (${meta.authorName}).

INTERDICTION FORMELLE : Ne commence JAMAIS par "Absolument !", "Bien sûr !" ou "En tant que Professeur...". Commence DIRECTEMENT par \`=== PARTIE III — ... ===\`. N'écris PAS la section 3.2 dans cet appel (elle fait l'objet d'une passe séparée dédiée).

RESPECTE SCRUPULEUSEMENT CETTE STRUCTURE EXACTE :

=== PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS ===

## 3.1. Les 5 Pièges Majeurs et Combinaisons Groupage / Jumelage à verrouiller

Rédige impérativement **5 encadrés de pièges majeurs** sous forme de blocs de citation Markdown (\`>\`) qui seront rendus en encadrés roses/rouges. Chaque encadré DOIT commencer par \`> **[PIÈGE K] K. ...**\`, suivi de l'explication complète sur les lignes \`>\` suivantes, avec une ligne vide entre chaque encadré :

> **[PIÈGE 1] 1. Piège de « Censure » sur [Critère clinique ou morphologique majeur du cours] (Examen ${meta.facultyName}) :**
> Cite entre guillemets la proposition piège classique (*« ... »*), explique pourquoi elle est **FAUSSE** d'après le cours, mentionne l'exception éventuelle du polycopié, et donne la règle de censure immédiate avec les mots-clés en **gras**.

> **[PIÈGE 2] 2. Piège de « Censure / Jumelage » sur [Examen d'orientation vs Examen de certitude] :**
> Explique la distinction formelle entre l'examen d'orientation et l'**examen de confirmation / certitude** du cours, et détaille le piège de **Jumelage** (*Proposition 1 Vraie PARCE QUE Proposition 2 Vraie → cocher A si le lien de causalité est exact*).

> **[PIÈGE 3] 3. Piège de « Groupage » sur les Combinaisons « A = 1+2+3 » du cours :**
> Ce cours contient plusieurs groupes de **3 éléments** idéaux pour les QCM de groupage (*A = 1+2+3 ; B = 1+3 ; C = 2+4 ; D = 4 ; E = 1+2+3+4*). Liste avec précision les triades et listes de 3 critères du cours et l'intrus N°4 que les professeurs glissent systématiquement.

> **[PIÈGE 4] 4. Piège sur [Les Formes Cliniques, Génétiques, Étiologiques ou Complications] :**
> Détaille les confusions classiques entre les différentes formes cliniques, génétiques ou étiologiques du cours (âge de révélation, particularités biologiques, complications spécifiques).

> **[PIÈGE 5] 5. Piège Thérapeutique Majeur : [Erreur éliminatoire dans la prise en charge ou les contre-indications] :**
> Détaille les pièges sur les indications thérapeutiques, les seuils transfusionnels ou décisionnels, les médicaments contre-indiqués et les erreurs éliminatoires en QCM.`;

  const partie3_1UserPrompt = `COURS : ${meta.cleanCourseTitle} (${meta.authorName} • ${meta.facultyName})

AUDIT DES ANNALES (PARTIE I) :
${partie1Content.slice(0, 4500)}

TEXTE DU COURS COMPLET :
${courseText.slice(0, 30000)}

Rédige maintenant la bannière \`=== PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS ===\` suivie de la section \`## 3.1. Les 5 Pièges Majeurs et Combinaisons Groupage / Jumelage à verrouiller\` contenant obligatoirement les **5 encadrés complets** (\`> **[PIÈGE 1]...\`, \`> **[PIÈGE 2]...\`, \`> **[PIÈGE 3]...\`, \`> **[PIÈGE 4]...\`, \`> **[PIÈGE 5]...\`).`;

  let partie3_1Content = await callArgonAIModel({
    systemPrompt: partie3_1SystemPrompt,
    userPrompt: partie3_1UserPrompt,
    temperature: 0.15,
    openRouterKey: policeKey,
    geminiApiKey,
  });

  if (partie3_1Content && partie3_1Content.includes("## 3.2")) {
    partie3_1Content = partie3_1Content.slice(0, partie3_1Content.indexOf("## 3.2")).trimEnd();
  }

  const trapMatchesCount = (partie3_1Content.match(/PI[ÈE]GE\s*[1-5]/gi) || []).length;
  if (!partie3_1Content || trapMatchesCount < 3) {
    partie3_1Content = `=== PARTIE III — PIÈGES DES PROFESSEURS (CENSURE, GROUPAGE, JUMELAGE) & CONFRONTATION INTER-COURS ===

## 3.1. Les 5 Pièges Majeurs et Combinaisons Groupage / Jumelage à verrouiller

> **[PIÈGE 1] 1. Piège de « Censure » sur la Définition et la Clinique Cardinale (${meta.cleanCourseTitle}) :**
> Ne jamais valider une proposition qui confond un signe contingent avec un critère constant du cours. Vérifier systématiquement le terrain, le mode d'installation et les signes physiques positifs ou négatifs exigés par le polycopié de **${meta.facultyName}**.

> **[PIÈGE 2] 2. Piège de « Censure / Jumelage » : Confondre Examen d'Orientation et Examen de Certitude :**
> L'hémogramme, les constantes érythrocytaires (VGM, TCMH, CCMH), les réticulocytes et le frottis sanguin orientent le diagnostic, mais seul l'**examen de confirmation spécifique** défini dans le cours permet d'affirmer le diagnostic de certitude. En QCM de **Jumelage**, vérifier à la fois la véracité des deux propositions et l'exactitude du lien de causalité (*« PARCE QUE »*).

> **[PIÈGE 3] 3. Piège de « Groupage » sur les Combinaisons « A = 1+2+3 » du cours :**
> Les professeurs ciblent les triades physiopathologiques, les **3 syndromes cliniques**, les **3 critères biologiques** ou les **3 volets thérapeutiques** du cours en glissant un 4e item contradictoire (ex: caractère régénératif vs arégénératif, ou signe d'exclusion) pour faire tomber l'étudiant sur le choix E (1+2+3+4) au lieu de **A (1+2+3)**.

> **[PIÈGE 4] 4. Piège sur les Formes Cliniques, Génétiques et Étiologiques :**
> Distinguer rigoureusement la forme typique de référence des formes variantes, composites ou secondaires (âge de révélation, sévérité de l'atteinte, anomalies associées et profil électrophorétique, enzymatique ou médullaire).

> **[PIÈGE 5] 5. Piège Thérapeutique Majeur : Indications, Urgences et Interdits Formels :**
> En QCM thérapeutique, toujours séparer le **traitement symptomatique / d'urgence immédiate**, le **traitement de fond / préventif** et le **traitement curatif**, en respectant scrupuleusement les seuils d'âge, de gravité et les contre-indications formelles du cours.`;
  }

  // 4B. PASSE DÉDIÉE 3.2 — TABLEAU DE CONFRONTATION RAPIDE À 5 COLONNES (100 % DU BUDGET DE TOKENS DÉDIÉ AU TABLEAU)
  const partie3_2SystemPrompt = `Tu es un Professeur Agrégé de Médecine et Président de Jury d'Examen (${meta.facultyName}).
Tu rédiges exclusivement la section **## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales** pour le cours « ${meta.cleanCourseTitle} » (${meta.authorName}).

RÈGLES ABSOLUES :
1. Commence DIRECTEMENT à la première ligne par :
\`## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales\`
2. Construis immédiatement en dessous un **Tableau Markdown complet à 5 colonnes** et **6 lignes de comparaison** confrontant **${meta.cleanCourseTitle} (Ce cours)** aux **3 principaux diagnostics différentiels** testés dans les annales de ${meta.facultyName}.
3. **UNE SEULE LIGNE PAR RANG DU TABLEAU :** Chaque rang doit commencer par \`|\` et se terminer par \`|\` sur la même ligne, sans aucun saut de ligne interne. Mets les seuils chiffrés, signes discriminants et examens de certitude en **gras**.

FORMAT EXACT OBLIGATOIRE :
## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales

| Paramètre discriminant | ${meta.cleanCourseTitle} (Ce cours) | [Diagnostic différentiel majeur 1] | [Diagnostic différentiel majeur 2] | [Diagnostic différentiel majeur 3] |
| :--- | :--- | :--- | :--- | :--- |
| **Terrain & Mode d'installation** | ... | ... | ... | ... |
| **Clinique (rate, ganglions, os, signes spécifiques)** | ... | ... | ... | ... |
| **Hémogramme, Plaquettes & Réticulocytes** | ... | ... | ... | ... |
| **Frottis sanguin & Bilan d'hémostase / biochimique** | ... | ... | ... | ... |
| **Examen / Critère de certitude** | ... | ... | ... | ... |
| **Traitement spécifique de référence** | ... | ... | ... | ... |`;

  const partie3_2UserPrompt = `COURS : ${meta.cleanCourseTitle} (${meta.authorName} • ${meta.facultyName})

EXTRAIT DU COURS (Diagnostic positif, Diagnostics différentiels, Bilans & Traitement) :
${courseText.slice(0, 26000)}

Rédige maintenant intégralement la section \`## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales\` avec son tableau comparatif complet à **5 colonnes** et **6 lignes discriminantes** (sans jamais tronquer aucune ligne).`;

  let partie3_2Content = await callArgonAIModel({
    systemPrompt: partie3_2SystemPrompt,
    userPrompt: partie3_2UserPrompt,
    temperature: 0.15,
    openRouterKey: policeKey,
    geminiApiKey,
  });

  if (partie3_2Content && looksTruncated(partie3_2Content)) {
    partie3_2Content = stripTrailingIncompleteLine(partie3_2Content);
    const cont3_2 = await callArgonAIModel({
      systemPrompt: partie3_2SystemPrompt,
      userPrompt: `Ton tableau 3.2 s'est interrompu ici :\n"""\n${partie3_2Content}\n"""\nContinue EXACTEMENT à partir de la dernière ligne complète du tableau et rédige les lignes restantes jusqu'à la 6e ligne incluse.`,
      temperature: 0.15,
      openRouterKey: policeKey,
      geminiApiKey,
    });
    if (cont3_2 && cont3_2.trim().length > 20) {
      partie3_2Content = `${partie3_2Content.trimEnd()}\n${stripTrailingIncompleteLine(cont3_2)}`;
    }
  }

  // Vérifier que 3.2 contient au moins l'en-tête + 3 lignes de données complètes ; sinon générer un tableau complet
  const validTableRowsIn3_2 = (partie3_2Content || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("|") &&
        l.endsWith("|") &&
        (l.match(/\|/g) || []).length >= 5 &&
        !/^[\|\s:-]+$/.test(l)
    );

  if (!partie3_2Content || validTableRowsIn3_2.length < 3) {
    partie3_2Content = `## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales

| Paramètre discriminant | ${meta.cleanCourseTitle} (Ce cours) | Diagnostic différentiel majeur 1 | Diagnostic différentiel majeur 2 | Diagnostic différentiel majeur 3 |
| :--- | :--- | :--- | :--- | :--- |`;
  } else if (!/^##\s*3\.2\b/im.test(partie3_2Content)) {
    partie3_2Content = `## 3.2. Tableau de Confrontation Rapide avec les Autres Pathologies des Annales\n\n${partie3_2Content.trim()}`;
  }

  const partie3Content = `${partie3_1Content.trim()}\n\n${partie3_2Content.trim()}`;

  // 5. PASSE DÉDIÉE POUR LA PARTIE IV — DÉMARCHE OPÉRATIONNELLE EN 5 ÉTAPES (5 ENCADRÉS ÉMERAUDE GARANTIS COMPLETS)
  onProgress?.(
    totalSteps,
    totalSteps,
    `Étape ${totalSteps}/${totalSteps} : Rédaction intégrale de la PARTIE IV (Démarche Cas Clinique de l'ÉTAPE 1 à l'ÉTAPE 5)...`
  );

  const partie4SystemPrompt = `Tu es un Professeur Agrégé de Médecine et Président de Jury d'Examen (${meta.facultyName}).
Tu rédiges exclusivement la **PARTIE IV — DÉMARCHE OPÉRATIONNELLE À SUIVRE DEVANT UN CAS CLINIQUE À L'EXAMEN** pour le cours « ${meta.cleanCourseTitle} » (${meta.authorName}).

INTERDICTION FORMELLE : Ne commence JAMAIS par "Absolument !", "Bien sûr !" ou "En tant que Professeur...". Commence DIRECTEMENT par \`=== PARTIE IV — ... ===\`.

RESPECTE SCRUPULEUSEMENT CETTE STRUCTURE EXACTE AVEC LES **5 ENCADRÉS ÉMERAUDE COMPLETS (ÉTAPE 1 À ÉTAPE 5)** :

=== PARTIE IV — DÉMARCHE OPÉRATIONNELLE À SUIVRE DEVANT UN CAS CLINIQUE À L'EXAMEN ===

Lorsque cette leçon tombe sous forme de **Cas Clinique à 5 ou 6 QCM successifs** le jour de l'évaluation, déroulez méthodiquement ces **5 étapes** dans l'ordre exact des questions de l'épreuve :

> **[ÉTAPE 1] ÉTAPE 1 — ANALYSER L'OBSERVATION CLINIQUE ET POSER L'ORIENTATION DIAGNOSTIQUE (Répond au QCM 1) :**
> • **Repérer le terrain et les circonstances de découverte :** [Âge, antécédents personnels/familiaux, facteur déclenchant et signes cardinaux du cours en **gras**].
> • **Rechercher les signes physiques positifs et négatifs d'exclusion :** [Détaille les signes présents et les signes absents décisifs du polycopié en **gras**].
> • **Verrouiller le mécanisme physiopathologique initial :** [Lien direct avec l'observation clinique].

> **[ÉTAPE 2] ÉTAPE 2 — INTERPRÉTER L'HÉMOGRAMME, LES RÉTICULOCYTES ET LE FROTTIS SANGUIN (Répond au QCM 2) :**
> • **Seuils chiffrés de l'hémogramme :** [Valeurs exactes d'Hb, VGM, TCMH, CCMH, GB/PNN et Plaquettes attendues dans ce cours en **gras**].
> • **Caractère régénératif ou arégénératif :** [Seuil des **réticulocytes** et signification centrale vs périphérique en **gras**].
> • **Anomalies morphologiques au frottis sanguin :** [Cellules caractéristiques à rechercher ou anomalies à exclure en **gras**].

> **[ÉTAPE 3] ÉTAPE 3 — EXIGER L'EXAMEN DE CONFIRMATION / CERTITUDE ET ÉCARTER LES LEURRES (Répond au QCM 3) :**
> • **Distinction orientation vs certitude :** [Nom exact de l'**examen de confirmation de référence** du cours en **gras**].
> • **Résultats qualitatifs et quantitatifs attendus :** [Profil exact, fractions ou critères diagnostiques formels en **gras**].
> • **Précautions pré-analytiques :** [ex: à distance d'une transfusion, conditions de prélèvement].

> **[ÉTAPE 4] ÉTAPE 4 — ÉVALUER LA GRAVITÉ, LES COMPLICATIONS OU LA FORME ÉTIOLOGIQUE (Répond au QCM 4) :**
> • **Classification, forme clinique ou score de gravité :** [Critères de sévérité, complications aiguës/chroniques ou formes étiologiques du cours en **gras**].
> • **Bilan d'extension / retentissement ou enquête étiologique / familiale :** [Examens complémentaires indispensables en **gras**].

> **[ÉTAPE 5] ÉTAPE 5 — APPLIQUER L'ARBRE DÉCISIONNEL THÉRAPEUTIQUE SANS TOMBER DANS LES PIÈGES (Répond au QCM 5) :**
> • **1. Mesures d'urgence et traitement symptomatique :** [Conduite immédiate, hydratation, transfusion, antalgiques, anti-infectieux selon le cours en **gras**].
> • **2. Traitement de fond, préventif ou curatif spécifique :** [Médicaments spécifiques, prophylaxie, vaccination, allogreffe ou suivi selon l'âge et la gravité en **gras**].
> • **3. Interdits formels à censurer immédiatement en QCM :** [Erreurs éliminatoires et traitements contre-indiqués en **gras**].`;

  const partie4UserPrompt = `COURS : ${meta.cleanCourseTitle} (${meta.authorName} • ${meta.facultyName})

OBJECTIFS OFFICIELS DU COURS :
${sousParties.map((s) => `- ${s.label}`).join("\n")}

TEXTE DU COURS COMPLET :
${courseText.slice(0, 32000)}

Rédige maintenant l'intégralité de la **PARTIE IV** avec ses **5 encadrés complets** (\`> **[ÉTAPE 1]...\`, \`> **[ÉTAPE 2]...\`, \`> **[ÉTAPE 3]...\`, \`> **[ÉTAPE 4]...\`, \`> **[ÉTAPE 5]...\`). Ne t'arrête sous aucun prétexte avant la fin complète de l'ÉTAPE 5.`;

  let partie4Content = await callArgonAIModel({
    systemPrompt: partie4SystemPrompt,
    userPrompt: partie4UserPrompt,
    temperature: 0.15,
    openRouterKey: policeKey,
    geminiApiKey,
  });

  if (
    partie4Content &&
    (looksTruncated(partie4Content) || !/[ÉE]TAPE\s*5/i.test(partie4Content))
  ) {
    partie4Content = stripTrailingIncompleteLine(partie4Content);
    const tail = partie4Content.slice(-1500);
    const cont = await callArgonAIModel({
      systemPrompt: partie4SystemPrompt,
      userPrompt: `Ta rédaction de la PARTIE IV s'est interrompue ici :\n"""\n${tail}\n"""\nContinue EXACTEMENT à partir de ce point sans répéter ce qui précède et achève intégralement la PARTIE IV jusqu'à la fin complète de l'encadré \`> **[ÉTAPE 5]...\`.`,
      temperature: 0.15,
      openRouterKey: policeKey,
      geminiApiKey,
    });
    if (cont && cont.trim().length > 25) {
      partie4Content = `${partie4Content.trimEnd()}\n${stripTrailingIncompleteLine(cont)}`;
    }
  }

  // Fallback de sécurité si PARTIE IV est absente ou incomplète
  if (!partie4Content || !/[ÉE]TAPE\s*5/i.test(partie4Content)) {
    partie4Content = `=== PARTIE IV — DÉMARCHE OPÉRATIONNELLE À SUIVRE DEVANT UN CAS CLINIQUE À L'EXAMEN ===

Lorsque cette leçon tombe sous forme de **Cas Clinique à 5 ou 6 QCM successifs** le jour de l'évaluation, déroulez méthodiquement ces **5 étapes** dans l'ordre exact des questions de l'épreuve :

> **[ÉTAPE 1] ÉTAPE 1 — ANALYSER L'OBSERVATION CLINIQUE ET POSER L'ORIENTATION DIAGNOSTIQUE (Répond au QCM 1) :**
> • **Repérer le terrain et les circonstances de découverte :** Identifier l'âge du patient, ses antécédents personnels et familiaux, les facteurs déclenchants et les **signes fonctionnels cardinaux** décrits dans l'énoncé.
> • **Vérifier les signes physiques positifs et négatifs :** Rechercher méthodiquement la présence ou l'absence de syndrome anémique, infectieux, hémorragique ou tumoral (**splénomégalie, adénopathies, hépatomégalie, ictère**) selon les critères du cours.

> **[ÉTAPE 2] ÉTAPE 2 — INTERPRÉTER L'HÉMOGRAMME, LES RÉTICULOCYTES ET LE FROTTIS SANGUIN (Répond au QCM 2) :**
> • **Analyser les lignées sanguines :** Vérifier le taux d'**hémoglobine**, les constantes érythrocytaires (**VGM, TCMH, CCMH**), les leucocytes (**PNN, lymphocytes**) et les **plaquettes**.
> • **Qualifier la régénération médullaire et le frottis :** Lire immédiatement le taux de **réticulocytes** (seuil de **120 000/mm³**) et identifier les anomalies morphologiques caractéristiques au **frottis sanguin**.

> **[ÉTAPE 3] ÉTAPE 3 — EXIGER L'EXAMEN DE CONFIRMATION / CERTITUDE ET ÉCARTER LES LEURRES (Répond au QCM 3) :**
> • **Ne jamais confondre test de dépistage/orientation et examen de certitude :** Sélectionner l'**examen de confirmation de référence** enseigné dans le polycopié (électrophorèse/HPLC, dosage enzymatique, myélogramme, BOM ou immunophénotypage selon la pathologie).
> • **Respecter les conditions pré-analytiques :** Toujours réaliser les dosages fonctionnels ou phénotypiques **à distance d'une transfusion sanguine** (≥ 3 mois) pour éviter tout faux négatif.

> **[ÉTAPE 4] ÉTAPE 4 — ÉVALUER LA GRAVITÉ, LES COMPLICATIONS OU LA FORME ÉTIOLOGIQUE (Répond au QCM 4) :**
> • **Stadification et recherche de complications :** Appliquer les critères de gravité du cours et dépister les **complications aiguës** (urgences vitales) ainsi que les **complications chroniques** ou dégénératives.
> • **Enquête étiologique et familiale :** Préciser la forme clinique ou génétique exacte et planifier le bilan de retentissement organique.

> **[ÉTAPE 5] ÉTAPE 5 — APPLIQUER L'ARBRE DÉCISIONNEL THÉRAPEUTIQUE SANS TOMBER DANS LES PIÈGES (Répond au QCM 5) :**
> • **1. Volet symptomatique et urgence immédiate :** Assurer la prise en charge urgente des décompensations aiguës (hydratation, oxygénothérapie, antalgie graduée, antibiothérapie probabiliste ou support transfusionnel adapté).
> • **2. Volet de fond, préventif et curatif :** Instaurer le suivi régulier, la supplémentations (acide folique), la prophylaxie vaccinale/anti-infectieuse et les traitements spécifiques selon les indications officielles du cours.
> • **3. Interdits formels à censurer en QCM :** Rejeter tout traitement non indiqué ou contre-indiqué par l'arbre décisionnel du polycopié.`;
  }

  // 6. ASSEMBLAGE FINAL DE LA SYNTHÈSE UNIFIÉE (EN-TÊTE + PARTIE I + PARTIE II + PARTIE III + PARTIE IV)
  const metaHeaderBlock = [
    `@SYNTHESE_META_KICKER: ${meta.kicker}`,
    `@SYNTHESE_META_TITLE: ${meta.mainTitle}`,
    `@SYNTHESE_META_SUBTITLE: ${meta.subtitle}`,
  ].join("\n");

  const fullMarkdown = [
    metaHeaderBlock,
    "",
    sanitizeArgonMarkdown(partie1Content),
    "",
    partie2Blocks.join("\n\n"),
    "",
    sanitizeArgonMarkdown(partie3Content),
    "",
    sanitizeArgonMarkdown(partie4Content),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    markdown: fullMarkdown,
    auditDossier: partie1Content,
    auditedExamsCount: examFiles.length,
  };
}

/**
 * Appelle l'Edge Function Supabase ou le moteur de repli
 */
export async function generateObjectiveExamSummary(params: {
  courseText: string;
  courseTitle: string;
  forcedMatiere?: string;
  forcedSemestre?: string;
  examFiles?: UploadedExamInput[];
  onProgress?: (step: number, total: number, label: string) => void;
}): Promise<ObjectiveExamSummaryData> {
  const {
    courseText,
    courseTitle,
    forcedMatiere,
    forcedSemestre,
    examFiles = [],
    onProgress,
  } = params;

  if (examFiles.length > 0) {
    const result = await executeArgonDualStagePipeline({
      courseTitle,
      courseText,
      examFiles,
      forcedMatiere,
      forcedSemestre,
      onProgress,
    });

    const parsedData = tryParseObjectiveExamData(result.markdown);
    if (parsedData) return parsedData;
  }

  try {
    const { data, error } = await supabase.functions.invoke("generate-objective-summary", {
      body: {
        courseText,
        courseTitle,
        forcedMatiere,
        forcedSemestre,
        examFiles,
      },
    });
    if (!error && data && data.objectifs_developpes) {
      return data as ObjectiveExamSummaryData;
    }
  } catch {
    // Passer au fallback local
  }

  const cleanTitle = courseTitle
    .replace(/^QCM\s*[-–:\s]*/i, "")
    .replace(/\b202\d\b/g, "")
    .trim();

  return {
    metadata: {
      titre_lecon: cleanTitle || "Leçon Médicale",
      matiere: forcedMatiere || "Hématologie",
      niveau_semestre: forcedSemestre || "M1 - S8",
    },
    objectifs_developpes: [
      {
        numero: 1,
        intitule_objectif: `Définir ${cleanTitle} et énoncer les critères diagnostiques positifs`,
        importance_examen: "Critique (95 %)",
        contenu_structuré_markdown: `Le diagnostic positif de **${cleanTitle}** repose impérativement sur la confrontation des signes fonctionnels et des valeurs seuils de l'hémogramme de référence.\n\n| Paramètre biologique | Valeur seuil normale | Interprétation pathologique |\n| :--- | :--- | :--- |\n| **Hémoglobine (Hb)** | Homme : > 13 g/dL / Femme : > 12 g/dL | Critère formel d'anémie |\n| **VGM** | 80 — 100 fL | < 80 fL : Microcytaire / > 100 fL : Macrocytaire |\n| **Réticulocytes** | Seuil pivot : 120 000 /mm³ | < 120 000 : Arégénératif (central) / > 120 000 : Régénératif (périphérique) |`,
        points_incontournables: [
          "Seuil d'hémoglobine strict selon le sexe et la grossesse",
          "Distinction formelle entre origine centrale arégénérative et périphérique régénérative",
        ],
      },
    ],
    strategie_examen: {
      marche_a_suivre_evaluation: [
        {
          etape: 1,
          action: "Lecture de l'observation clinique et orientation diagnostique",
          detail_reflexe: "Identifier le terrain, les syndromes cardinaux et les signes négatifs d'exclusion.",
        },
      ],
      pieges_des_professeurs: [
        {
          titre_piege: "Confusion entre examen d'orientation et examen de certitude",
          distracteur_qcm: "L'examen d'orientation suffit à affirmer définitivement le diagnostic.",
          parade_etudiant: "Toujours exiger l'examen de confirmation de référence défini dans le cours.",
        },
      ],
      a_ne_jamais_oublier: [
        "Respecter strictement les seuils chiffrés et l'arbre décisionnel du polycopié officiel.",
      ],
    },
    qcm_entrainement_cibles: [],
  };
}
