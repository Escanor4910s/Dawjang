import { callGeminiAcademicEngine } from "@/lib/syncEngine";
// src/lib/coPilotSummaryEngine.ts
// Architecture Tandem Inversé : Gemini 2.5 Flash (Cartographe / Suggestions) ➔ Claude Sonnet 5.5 (Rédacteur Synthétique Ultra-Condensé)
// Objectif : ~350 à 450 mots au total (2 à 3 pages PDF) • Budget strict par objectif • Adaptatif toutes matières

import { getAdaptiveConfrontationRows } from "@/lib/disciplineProfileEngine";

export interface CourseObjectiveSuggestion {
  objectiveNumber: number;
  objectiveTitle: string;
  sourceSlides: string;
  mandatoryFactsAndNumbers: string[];
  strictlyForbiddenToInclude: string;
  maxWordBudget: number;
}

export interface FinalSectionOutput {
  id?: string;
  objectiveNumber: number;
  title: string;
  content: string;
}

export interface MasterSummaryResult {
  totalSections: number;
  suggestionsUsed: CourseObjectiveSuggestion[];
  sections: FinalSectionOutput[];
  markdown: string;
}

/**
 * ============================================================================
 * 1. NETTOYEUR & NORMALISATEUR DE TABLEAUX / OBJECTIFS (ZÉRO "supérieur à" PARASITE)
 * ============================================================================
 */
export function sanitizeAndFormatForDawJang(markdown: string): string {
  if (!markdown) return "";

  let text = markdown
    // 0. PURGE CIBLÉE DES PRÉAMBULES REDONDANTS (sans jamais supprimer les blockquotes `>` de Partie III / IV ni PARTIE I)
    .replace(/<blockquote\b[^>]*>[\s\S]*?(?:Synth[eèé]se\s*M[eèé]dicale\s*Ultra-Condens|Sommaire\s*Ex[eèé]cutif|Moins de)[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<h[1-3]\b[^>]*>[\s\S]*?(?:Synth[eèé]se\s*&?\s*Cadre|Sommaire\s*Ex[eèé]cutif)[\s\S]*?<\/h[1-3]>/gi, "")
    .replace(/^\s*(?:#{1,3}\s*)?(?:SECTION\s*\d+\s*[:.-]?\s*)?(?:Synth[eèé]se\s*&?\s*Cadre\s*Nosologique|Sommaire\s*Ex[eèé]cutif|Synth[eèé]se\s*M[eèé]dicale\s*Ultra-Condens[eèé]e[^\n]*)\s*\n+/gi, "")
    .replace(/\n*>\s*(?:\*\*)?Synth[eèé]se\s*M[eèé]dicale\s*Ultra-Condens[eèé]e[\s\S]*?(?=\n\s*---\s*\n|\n\s*#{1,3}\s*Objectif|\n\s*#|$)(?:---\s*\n*)?/gi, "\n\n")
    .replace(/\n*>\s*(?:\*\*)?Synth[eèé]se\s*Fid[eèé]le\s*aux\s*Objectifs[\s\S]*?(?=\n\s*---\s*\n|\n\s*#{1,3}\s*Objectif|\n\s*#|$)(?:---\s*\n*)?/gi, "\n\n")
    .replace(/^SECTION\s*\d+\s*[^\n]*\n+/gim, "");

  // Si le document est un résumé Mode 1 (pas de PARTIE I ni de @SYNTHESE_META_) et contient un Objectif 1 plus bas, supprimer uniquement le sommaire redondant en tête
  const isUnifiedSynthese = /(?:@SYNTHESE_META_|PARTIE\s*(?:I|1)\b|VOLET\s*1\b|1\.1\.\s*V[ée]rit[ée]\s*statistique)/i.test(text);
  if (!isUnifiedSynthese) {
    const firstObjIdx = text.search(/(?:^|\n)#{1,3}\s+(?:Objectif\s*1\b|\d+\.\s*Objectif\s*1\b|Chapitre\s*1\b)/i);
    if (firstObjIdx > 0 && firstObjIdx < 1200) {
      const headerPreamble = text.slice(0, firstObjIdx).trim();
      if (
        headerPreamble.includes("Synthèse Fidèle") ||
        headerPreamble.includes("Sommaire Exécutif") ||
        headerPreamble.includes("Cadre Nosologique") ||
        headerPreamble.includes("Synthèse Médicale Ultra-Condensée")
      ) {
        text = text.slice(firstObjIdx).trim();
      }
    }
  }

  text = text
    // A. Répare immédiatement un texte déjà pollué par "supérieur à" dans l'encadré d'objectifs
    .replace(/\s*supérieur à\s*(\*\*Synthèse Fidèle)/gi, "\n> $1")
    .replace(/\s*supérieur à\s*(\d+\.\s*\*\*Objectif)/gi, "\n> $1")
    .replace(/\s*supérieur à\s*(\d+\.\s*Objectif)/gi, "\n> $1")
    .replace(/--\s*supérieur à/g, "-->")
    .replace(/^supérieur à\s+/gm, "> ")

    // A2. Nettoie tout ancien marqueur [SUB] en sous-puce indentée `  ◦ `
    .replace(/^[ \t]*[-•*]?\s*\[SUB\]\s*/gm, "  ◦ ")
    .replace(/\[SUB\]\s*/g, "")

    // B. Supprime les blocs Mermaid bruts que le PDF ne peut pas dessiner (Folio 13)
    .replace(/```mermaid[\s\S]*?```/gi, "")
    .replace(/mermaid\s+graph\s+TD[\s\S]*?(?=\n\n|\n#|\n■|$)/gi, "")

    // C. Corrige les formules LaTeX cassées (Folios 07, 11, 13)
    .replace(/\\\$/g, "$")
    .replace(/[lIW]frac\{/g, "\\frac{")
    .replace(/\\frac\(/g, "\\frac{")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\$(\{\\wedge\}|\^)3\$/g, "³")
    .replace(/\\\$(\{\\wedge\}|\^)3\\\$/g, "³")
    .replace(/mm\^3/g, "mm³")
    .replace(/mm\^2/g, "mm²")

    // D. Sécurisation universelle des comparaisons chiffrées (zéro chevron nu qui avale du texte)
    // Note : (?<!^|\n) empêche impérativement de convertir les citations Markdown (ex: "> 1. Objectif 1") en "supérieur à"
    .replace(/<\s*=/g, "≤")
    .replace(/>\s*=/g, "≥")
    .replace(/<\s*(\d)/g, "< $1")
    .replace(/(?<!^|\n)\s*>\s*(\d)/g, " > $1")

    // F. Supprime toutes les phrases d'introduction conversationnelles d'IA (y compris "Absolument ! En tant que Professeur...")
    .replace(
      /^(?:Absolument\s*!?|Bien\s+s[ûu]r\s*!?|Certainement\s*!?|En\s+tant\s+que\s+Professeur[^\n]*|Voici\s+la\s+r[ée]daction[^\n]*|Voici\s+les\s+sous-parties[^\n]*|Bas[ée]\s+sur\s+le\s+support[^\n]*|Voici\s+le\s+r[ée]sum[ée][^\n]*|En\s+r[ée]sum[ée][^\n]*|D'apr[èe]s\s+le\s+document[^\n]*|Dans\s+ce\s+cours[^\n]*|Voici\s+la\s+section\s+correspondant[^\n]*)\s*\n+/gim,
      ""
    )
    .replace(
      /\n+(?:Absolument\s*!?|Bien\s+s[ûu]r\s*!?|Certainement\s*!?|En\s+tant\s+que\s+Professeur)[^\n]*(?:\n+[^\n#*•◦|[-][^\n]*)?\n+/gi,
      "\n\n"
    )

    // G. Nettoie tout artefact "/ / /" ou "**" parasite après la barre "|" finale d'un tableau
    .replace(/\|\s*\*+\s*$/gm, "|")
    .replace(/(?:\s*\/\s*){2,}(?=\s*\||$)/gm, "");

  // H. Normalisation stricte des tableaux Markdown pour l'export PDF (avec réparation des cellules multi-lignes et préservation du **gras**)
  text = normalizeMarkdownTables(text);

  return text.trim();
}

/** Alias rétrocompatible pour les imports existants */
export const cleanForDawJangPdf = sanitizeAndFormatForDawJang;

/**
 * Génère automatiquement les 5 lignes discriminantes d'un tableau 3.2 de confrontation inter-cours
 * si jamais le flux IA a été interrompu juste après l'en-tête à 5 colonnes.
 */
function buildFallbackConfrontationRows(headers: string[]): string[][] {
  return getAdaptiveConfrontationRows(headers);
}

/**
 * Répare les tableaux Markdown cassés avant l'export PDF :
 * - Rejoint automatiquement les lignes de tableau brisées par des sauts de ligne internes dans une cellule
 * - Préserve intégralement les marqueurs **gras** et ==surligné== dans les cellules
 * - Élimine toute ligne finale de tableau manifestement tronquée en plein milieu d'une phrase
 * - Développe automatiquement le tableau 3.2 s'il a été interrompu juste après son en-tête
 * - Remplace tout tableau tronqué par sa version complète si un appel de continuation l'a régénéré juste après
 * - Force une barre "|" au début et à la fin de chaque ligne de tableau sans jamais ajouter de "/ / /"
 */
export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown) return "";
  const rawLines = markdown.split("\n");

  // Étape 1 : Rejoindre uniquement les cellules véritablement coupées par un retour à la ligne interne
  const mergedLines: string[] = [];

  const isStructuralBoundary = (s: string) =>
    !s ||
    /^#{1,4}\s/.test(s) ||
    /^===\s/.test(s) ||
    /^--\s/.test(s) ||
    /^>\s/.test(s) ||
    /^\[(?:PI[ÈE]GE|AVERTISSEMENT|[ÉE]TAPE|RAPPEL|R[ÈE]GLE)/i.test(s) ||
    /^★/.test(s);

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line
      .trim()
      .replace(/\|\s*\*+\s*$/, "|")
      .replace(/(?:\s*\/\s*){2,}(?=\s*\||$)/g, "");

    if (
      trimmed &&
      !trimmed.startsWith("|") &&
      !isStructuralBoundary(trimmed) &&
      mergedLines.length > 0
    ) {
      const prev = mergedLines[mergedLines.length - 1].trim();
      if (prev.startsWith("|") && !prev.endsWith("|") && !/^[|\s:-]+$/.test(prev)) {
        const cleanedFrag = trimmed.replace(/^[-•*◦]\s+/, "• ");
        mergedLines[mergedLines.length - 1] = `${prev} ${cleanedFrag}`;
        continue;
      }
    }

    mergedLines.push(trimmed.startsWith("|") ? trimmed : line);
  }

  // Étape 2 : Collecte structurée par bloc de tableau pour éliminer les en-têtes orphelins et fusionner les tableaux repris en continuation
  const out: string[] = [];
  let inTable = false;
  let tableColCount = 0;
  let currentHeaderCells: string[] = [];
  let currentDataRows: string[][] = [];

  let lastEmittedTableStartIdx = -1;
  let lastEmittedTableHeaderKey = "";
  let lastEmittedTableRowCount = 0;
  let nonEmptyLinesSinceLastTable = 0;

  const flushTableBlock = () => {
    if (!inTable) return;

    // Si un tableau 3.2 (5 colonnes "Paramètre discriminant | ...") a été coupé juste après son en-tête (0 ligne de données), le développer automatiquement !
    if (
      currentDataRows.length === 0 &&
      currentHeaderCells.length >= 4 &&
      /param[èe]tre|crit[èe]re/i.test(currentHeaderCells[0] || "")
    ) {
      const fallbackRows = buildFallbackConfrontationRows(currentHeaderCells);
      currentDataRows = fallbackRows.map((r) => {
        const rowCopy = [...r];
        while (rowCopy.length < tableColCount) rowCopy.push("-");
        return rowCopy.slice(0, tableColCount);
      });
    }

    // Si un autre tableau n'a aucune ligne de données (en-tête orphelin), on ne l'émet pas
    if (currentDataRows.length === 0) {
      inTable = false;
      tableColCount = 0;
      currentHeaderCells = [];
      currentDataRows = [];
      return;
    }

    const headerKey = currentHeaderCells
      .map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .join("|");

    // Si le tableau précédent dans la même sous-partie avait EXACTEMENT le même en-tête mais moins de lignes (cas d'une reprise de continuation), remplacer le tableau tronqué par le tableau complet !
    if (
      headerKey &&
      headerKey === lastEmittedTableHeaderKey &&
      nonEmptyLinesSinceLastTable <= 3 &&
      lastEmittedTableStartIdx >= 0 &&
      currentDataRows.length >= lastEmittedTableRowCount
    ) {
      out.splice(lastEmittedTableStartIdx);
    }

    if (out.length > 0 && out[out.length - 1] !== "") {
      out.push("");
    }

    lastEmittedTableStartIdx = out.length;
    lastEmittedTableHeaderKey = headerKey;
    lastEmittedTableRowCount = currentDataRows.length;
    nonEmptyLinesSinceLastTable = 0;

    out.push("| " + currentHeaderCells.join(" | ") + " |");
    out.push("| " + currentHeaderCells.map(() => "---").join(" | ") + " |");
    for (const r of currentDataRows) {
      out.push("| " + r.join(" | ") + " |");
    }
    out.push("");

    inTable = false;
    tableColCount = 0;
    currentHeaderCells = [];
    currentDataRows = [];
  };

  for (let i = 0; i < mergedLines.length; i++) {
    const rawLine = mergedLines[i].trim();
    const pipeCount = (rawLine.match(/\|/g) || []).length;

    if (rawLine.startsWith("|") && pipeCount >= 2) {
      if (/^[|\s:-]+$/.test(rawLine)) {
        continue;
      }

      let cleanRow = rawLine
        .replace(/\|\s*\*+\s*$/, "|")
        .replace(/(?:\s*\/\s*){2,}(?=\s*\||$)/g, "");
      if (!cleanRow.startsWith("|")) cleanRow = "| " + cleanRow;
      if (!cleanRow.endsWith("|")) cleanRow = cleanRow + " |";

      const cells = cleanRow
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim().replace(/(?:\s*\/\s*){2,}$/g, ""));

      while (cells.length > 2 && cells[cells.length - 1] === "") {
        cells.pop();
      }

      if (!inTable) {
        inTable = true;
        tableColCount = Math.max(2, cells.length);
        currentHeaderCells = cells.slice(0, tableColCount);
        while (currentHeaderCells.length < tableColCount) {
          currentHeaderCells.push("-");
        }
        currentDataRows = [];
      } else {
        const nextLine = i + 1 < mergedLines.length ? mergedLines[i + 1].trim() : "";
        const isLastRowOfTable = !nextLine.startsWith("|");
        if (
          isLastRowOfTable &&
          !rawLine.endsWith("|") &&
          cells.filter(Boolean).length < tableColCount
        ) {
          continue;
        }

        // Si le modèle a ré-émis la ligne d'en-tête exacte à l'intérieur du même tableau, l'ignorer
        const rowKey = cells
          .slice(0, tableColCount)
          .map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""))
          .join("|");
        const curHeaderKey = currentHeaderCells
          .map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""))
          .join("|");
        if (rowKey === curHeaderKey) {
          continue;
        }

        while (cells.length < tableColCount) cells.push("-");
        const nonEmptyTail = cells.slice(tableColCount - 1).filter(Boolean);
        const normalizedCells =
          cells.length > tableColCount
            ? [
                ...cells.slice(0, tableColCount - 1),
                nonEmptyTail.join(" / ") || "-",
              ]
            : cells.slice(0, tableColCount);
        currentDataRows.push(normalizedCells);
      }
    } else if (rawLine.startsWith("|") && pipeCount === 1) {
      // Ligne de tableau tronquée dès la 1re cellule (ex: "| **Clinique (rate, ganglions") : toujours l'ignorer
      continue;
    } else {
      if (inTable) {
        flushTableBlock();
      }
      if (rawLine.length > 0) {
        nonEmptyLinesSinceLastTable++;
        if (/^#{1,3}\s+|^===\s+/i.test(rawLine)) {
          lastEmittedTableHeaderKey = "";
          lastEmittedTableStartIdx = -1;
        }
      }
      out.push(mergedLines[i]);
    }
  }

  if (inTable) {
    flushTableBlock();
  }

  return out.join("\n");
}

/**
 * ============================================================================
 * 2. LE FILTRE ANTI-DOUBLONS ET PRÉSENTATION PROPRE DES OBJECTIFS
 * ============================================================================
 * 1. Supprime la fausse "Section 01 (1-Anémies 2026 > Synthèse Fidèle...)" de la liste des sections
 * 2. Empêche tout objectif (comme l'Objectif 5) d'apparaître 2, 3 ou 4 fois
 * 3. Applique le nettoyeur de tableaux et de symboles sur chaque section
 */
export function deduplicateAndCleanSections(rawSections: FinalSectionOutput[]): FinalSectionOutput[] {
  const uniqueSections = new Map<string, FinalSectionOutput>();

  for (const sec of rawSections) {
    const rawTitle = String(sec?.title || "").trim();

    // Ignore la fausse section d'en-tête qui répète le titre du fichier PDF ou l'intro générale
    const lower = rawTitle.toLowerCase();
    if (
      lower.includes("anemies 2026") ||
      lower.includes("anémies 2026") ||
      lower.includes("synthèse fidèle") ||
      lower.includes("synthèse médicale condensée") ||
      lower.includes("synthèse médicale ultra-condensée") ||
      lower.includes("synthèse & cadre") ||
      lower.includes("cadre nosologique") ||
      lower.includes("sommaire exécutif") ||
      lower.startsWith("#")
    ) {
      continue;
    }

    const cleanTitle = rawTitle
      .replace(/supérieur à[\s\S]*/i, "")
      .replace(/^(?:OBJECTIF\s*\d+\s*[:.\-–—]?\s*)/i, "")
      .replace(/^\d+\.\s*/, "")
      .trim();

    if (!cleanTitle || cleanTitle.length < 3) continue;

    // Clé de dédoublonnage sur les 35 premiers caractères du titre de l'objectif normalisé
    const dedupKey = String(cleanTitle || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 32);

    // Si l'Objectif 5 (ex: "savoir mener la demarche...") existe déjà, on ne l'ajoute PAS une 2e, 3e ou 4e fois !
    if (!uniqueSections.has(dedupKey)) {
      uniqueSections.set(dedupKey, {
        ...sec,
        objectiveNumber: uniqueSections.size + 1,
        title: cleanTitle,
        content: sanitizeAndFormatForDawJang(sec.content),
      });
    }
  }

  return Array.from(uniqueSections.values()).map((sec, idx) => ({
    ...sec,
    objectiveNumber: idx + 1,
  }));
}

/**
 * ============================================================================
 * 3. PROMPT DE COMPRESSION ULTRA-HAUTE DENSITÉ (MAX 450 MOTS / 2-3 PAGES PDF)
 * ============================================================================
 */
export const ULTRA_COMPRESSED_SONNET_PROMPT = `Tu es un Rédacteur Synthétique Médical Universitaire multi-spécialités des Éditions DawJang Press.
Ta mission : produire une MONOGRAPHIE DE SYNTHÈSE HAUTE PRÉCISION (format "High-Yield Pédagogique"), 100 % adaptée à la discipline réelle du cours fourni, parfaitement équilibrée entre concision chirurgicale et clarté logique.
BUDGET GLOBAL : 550 à 750 mots AU TOTAL pour l'ensemble du cours (soit environ 80 à 120 mots par objectif).
RÈGLE D'OR : Moins de mots que le diaporama original, mais avec toute la logique clinique, anatomo-radiologique, biologique ou thérapeutique propre à la matière pour que l'étudiant comprenne et retienne la marche à suivre.

LOIS PÉDAGOGIQUES ET RÉDACTIONNELLES ADAPTATIVES :
1. CALIBRAGE STRICT : 80 à 120 mots par objectif. Ni trop sec, ni encyclopédique : juste l'explication logique et les repères clés authentiquement présents dans le cours.
2. DÉMARCHE LOGIQUE D'ANALYSE ET D'INTERPRÉTATION ADAPTÉE À LA MATIÈRE DU COURS :
   - Adapte IMPÉRATIVEMENT ta grille de lecture à la discipline réelle du support (sans jamais plaquer les critères d'une autre matière) :
     * Si le cours relève de la Traumatologie / Orthopédie / Chirurgie : structure mécanisme lésionnel (haute/basse énergie, choc direct/indirect), bilan vasculo-nerveux et cutané (ouverture Gustilo), lecture radiographique & classifications de référence (Garden, Schatzker, Neer, Salter-Harris, Pauwels, etc. si présentes dans le cours), urgence et choix orthopédique vs chirurgical, complications précoces et tardives (loge, pseudarthrose, nécrose, raideur).
     * Si le cours relève d'une spécialité Médicale d'organe (Cardiologie, Pneumologie, Neurologie, Néphrologie, Hépato-Gastro, Endocrinologie, Infectiologie, Rhumatologie, Pédiatrie, Gynécologie...) : structure signes positifs et seuils de gravité, examens paracliniques clés (ECG, imagerie, endoscopie, sérologies, bilans biologiques du cours), scores et diagnostics différentiels, conduite à tenir d'urgence et de fond.
     * Si et SEULEMENT SI le cours porte sur un bilan biologique ou hématologique : développe l'interprétation méthodique des paramètres et seuils fournis par ce cours.
3. DÉMARCHE DIAGNOSTIQUE ÉTIOLOGIQUE & DIFFÉRENTIELLE :
   - Structure un arbre décisionnel clair reliant les tableaux cliniques du cours aux examens de 1re intention, aux étiologies maîtresses et aux diagnostics différentiels.
4. DÉFINITION, SCORES & EXCEPTIONS :
   - Définition officielle en 1-2 phrases avec seuils chiffrés, stades ou pièges diagnostiques précisés dans le support.
5. TRIADES, SIGNES CLÉS & URGENCES :
   - Indique les signes cardinaux, complications vitales ou fonctionnelles et éléments pronostiques nettement mis en relief.
6. ÉLÉMENTS À ÉVITER & TRAITEMENTS :
   - Précise les molécules, gestes, immobilisations, indications opératoires, posologies/durées et contre-indications formelles du cours.
7. ZÉRO INTRO / ZÉRO CONCLUSION / ZÉRO SOMMAIRE / ZÉRO ROBOTIQUE :
   - N'écris jamais "Voici la rédaction...", "Cette pathologie est définie comme...", "Ce cours aborde...".
   - Attaque directement le contenu sous le titre ## Objectif X.
   - STRICTEMENT INTERDIT : Ne génère JAMAIS de sommaire introductif, de cartouche de synthèse préalable, de citation blockquote listant les objectifs (ex: jamais de "> Synthèse Médicale Ultra-Condensée..."), ni de liste numérotée des objectifs en tête de document. Le document commence directement et exclusivement à l'Objectif 1 !
8. FORMATAGE STRICT SÉCURISÉ POUR LE PDF :
   - N'utilise JAMAIS les symboles bruts "<" ou ">" non sécurisés : écris toujours "inférieur à", "supérieur à", "≤" ou "≥".
   - Ne laisse aucun astérisque orphelin "**" en fin de ligne (ferme toujours les balises Markdown proprement).
   - Tableaux Markdown propres encadrés de lignes vides.`;

/**
 * ÉTAPE 1 : GEMINI 2.5 FLASH AGIT COMME "CONSEILLER / CARTOGRAPHE"
 */
export async function getGeminiProgressiveSuggestions(
  courseText: string,
  geminiApiKey?: string,
  predefinedObjectives?: string[]
): Promise<CourseObjectiveSuggestion[]> {
  const prompt = `Tu es l'Assistant Cartographe Médical des Éditions DawJang Press.
Analyse ce support de cours et extrais la liste exacte des objectifs pédagogiques annoncés au début du cours (sans jamais en inventer ni les dédoubler).

${
  predefinedObjectives && predefinedObjectives.length > 0
    ? `OBJECTIFS OFFICIELS DÉJÀ VALIDÉS PAR LE PROFESSEUR (respecte STRICTEMENT cette liste de ${predefinedObjectives.length} objectifs, sans en ajouter ni en supprimer aucun) :\n${predefinedObjectives
        .map((o, idx) => `${idx + 1}. ${o}`)
        .join("\n")}`
    : ""
}

Pour CHAQUE objectif unique du cours, prépare une fiche de suggestions ultra-stricte destinée au rédacteur (Claude Sonnet 5.5) :
1. "objectiveNumber": numéro d'ordre (ex: 1 à ${predefinedObjectives?.length || 6}).
2. "objectiveTitle": intitulé exact de l'objectif tel qu'écrit dans le cours.
3. "sourceSlides": quelles diapositives précises couvrent cet objectif.
4. "mandatoryFactsAndNumbers": liste télégraphique des SEULS faits, seuils chiffrés, formules exactes et mots-clés présents sur ces diapositives. N'ajoute AUCUNE connaissance externe qui n'est pas écrite dans le PDF.
5. "strictlyForbiddenToInclude": indique précisément à Sonnet 5.5 ce qu'il ne doit PAS mettre dans cet objectif pour éviter tout débordement sur les autres objectifs et tout bavardage hors-cours (ex: dans la définition, interdiction de parler d'hémolyse ou de traitement).
6. "maxWordBudget": fixe un budget équilibré de 80 à 120 mots maximum par objectif (pour que tout le résumé fasse entre 550 et 750 mots au total).

Renvoie UNIQUEMENT un objet JSON valide au format :
{
  "suggestions": [
    {
      "objectiveNumber": 1,
      "objectiveTitle": "...",
      "sourceSlides": "...",
      "mandatoryFactsAndNumbers": ["..."],
      "strictlyForbiddenToInclude": "...",
      "maxWordBudget": 120
    }
  ]
}

SUPPORT DE COURS :
${courseText.slice(0, 50000)}`;

  const rawJson = await callGeminiAcademicEngine(
    "Tu produis uniquement le JSON demandé, sans commentaire.",
    prompt,
    0.1,
  ) || "";

  let parsedSuggestions: CourseObjectiveSuggestion[] = [];
  try {
    const cleanJson = rawJson.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const match = cleanJson.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleanJson);
    if (Array.isArray(parsed?.suggestions)) {
      parsedSuggestions = parsed.suggestions;
    }
  } catch {
    // Repli local
  }

  if (parsedSuggestions.length === 0 && predefinedObjectives && predefinedObjectives.length > 0) {
    parsedSuggestions = predefinedObjectives.map((obj, idx) => ({
      objectiveNumber: idx + 1,
      objectiveTitle: obj,
      sourceSlides: `Section ${idx + 1}`,
      mandatoryFactsAndNumbers: [obj],
      strictlyForbiddenToInclude: "Ne traiter que cet objectif sans déborder sur les autres.",
      maxWordBudget: 120,
    }));
  }

  // Dédoublonnage absolu des suggestions
  const uniqueMap = new Map<string, CourseObjectiveSuggestion>();
  for (const item of parsedSuggestions) {
    const rawTitle = String(item?.objectiveTitle || (item as any)?.title || "").trim();
    const key = rawTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 32);

    if (!uniqueMap.has(key) && key.length > 3) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values()).map((item, idx) => ({
    ...item,
    objectiveNumber: idx + 1,
  }));
}

/**
 * ÉTAPE 2 : CLAUDE SONNET 5.5 RÉDIGE LA SYNTHÈSE ULTRA-COMPRESSÉE (MAX 450 MOTS AU TOTAL)
 */
export async function writeCondensedSummaryWithSonnet(
  courseText: string,
  suggestions: CourseObjectiveSuggestion[],
  anthropicApiKey?: string
): Promise<FinalSectionOutput[]> {
  const userPrompt = `Voici le support de cours original et les suggestions directrices préparées pour les ${suggestions.length} objectifs uniques.
Rédige chaque objectif avec la logique clinique et le format demandé (80 à 120 mots par objectif, total du cours entre 550 et 750 mots).
Adapte strictement les critères d'analyse, d'interprétation (sémiologique, radiologique, morphologique, biologique, classifications, scores ou prise en charge) à la discipline réelle du support, étape par étape, sans jamais importer de paramètres d'une autre matière !

=== PLAN DES ${suggestions.length} OBJECTIFS UNIQUES DE GEMINI 2.5 FLASH ===
${JSON.stringify(suggestions, null, 2)}

=== SUPPORT DE COURS ORIGINAL ===
${courseText.slice(0, 50000)}

Renvoie UNIQUEMENT un objet JSON strict :
{
  "sections": [
    {
      "objectiveNumber": 1,
      "title": "Titre exact de l'objectif",
      "content": "Contenu Markdown ultra-condensé télégraphique respectant le budget strict de 50-75 mots"
    }
  ]
}`;

  const rawText = await callGeminiAcademicEngine(
    ULTRA_COMPRESSED_SONNET_PROMPT,
    userPrompt,
    0.1,
  ) || "";

  const cleanJsonText = rawText.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleanJsonText.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleanJsonText || '{"sections":[]}');

  const rawSections: FinalSectionOutput[] = (
    Array.isArray(parsed?.sections) ? parsed.sections : []
  ).map((s: any, idx: number) => ({
    objectiveNumber: s.objectiveNumber || idx + 1,
    title: s.title || `Objectif ${idx + 1}`,
    content: s.content || "",
  }));

  // Filtrage chirurgical : dédoublonne l'Objectif 5 et assainit chaque section
  return deduplicateAndCleanSections(rawSections);
}

/**
 * ============================================================================
 * 4. ORCHESTRATEUR PRINCIPAL DU TANDEM : GEMINI SUGGÈRE ➔ SONNET SYNTHÉTISE
 * ============================================================================
 */
export async function generateMasterMedicalSummary(options: {
  courseTitle: string;
  courseText: string;
  predefinedObjectives?: string[];
  geminiApiKey?: string;
  anthropicApiKey?: string;
  onProgress?: (step: number, total: number, label: string) => void;
}): Promise<MasterSummaryResult> {
  const {
    courseTitle,
    courseText,
    predefinedObjectives,
    geminiApiKey,
    anthropicApiKey,
    onProgress,
  } = options;

  // 1. Gemini 2.5 Flash scanne le cours et produit la cartographie chirurgicale sans doublon
  onProgress?.(
    1,
    2,
    "Étape 1 : Cartographie chirurgicale par Gemini 2.5 Flash (Zéro doublon)..."
  );
  const geminiSuggestions = await getGeminiProgressiveSuggestions(
    courseText,
    geminiApiKey,
    predefinedObjectives
  );

  // 2. Claude Sonnet 5.5 rédige la synthèse ultra-condensée (< 450 mots au total)
  onProgress?.(
    2,
    2,
    `Étape 2 : Rédaction condensée des ${geminiSuggestions.length} objectifs par Claude Sonnet 5.5 (Format High-Yield < 450 mots)...`
  );
  const finalSections = await writeCondensedSummaryWithSonnet(
    courseText,
    geminiSuggestions,
    anthropicApiKey
  );

  // 3. Assemblage du Markdown final propre : démarre DIRECTEMENT à l'Objectif 1 (zéro cartouche redondant en tête)
  const bodySections = finalSections.map((s) => {
    let content = s.content.trim();
    // Retirer tout titre redondant en tête
    content = content
      .replace(/^(?:#{1,3}\s*(?:Objectif\s*\d+\s*[:.\-–—]?\s*)?[^\n]+\n+)/i, "")
      .trim();
    return `## Objectif ${s.objectiveNumber} : ${s.title}\n\n${content}`;
  });

  const fullMarkdown = sanitizeAndFormatForDawJang(
    bodySections.join("\n\n---\n\n")
  );

  return {
    totalSections: finalSections.length,
    suggestionsUsed: geminiSuggestions,
    sections: finalSections,
    markdown: fullMarkdown,
  };
}
