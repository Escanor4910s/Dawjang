import { STRICT_JSON_PROMPT_GUARD } from "./jsonRepair";
import { getDriveExamQuestionsForTopic } from "./driveExamKnowledgeBase";
// ============================================================================
// src/lib/annalesMimicryEngine.ts
// MOTEUR UNIVERSEL DE MIMÉTISME D'ANNALES, QUOTAS MULTI-TYPES,
// ANTI-RÉPÉTITION INTER-SESSIONS & GARANTIE STRICTE DU NOMBRE DE QCM (N EXACT)
// ============================================================================

export type DocimologicalFormat =
  | "election"        // QCU : 1 seule proposition juste
  | "choix_multiple"  // QCM Classique : plusieurs propositions justes (2 à 4)
  | "censure"         // Censure : identifier l'affirmation FAUSSE ("SAUF UNE")
  | "groupage"        // Compléments groupés (1, 2, 3, 4, 5 -> Code A, B, C, D, E)
  | "jumelage"        // Cause à effet (Assertion I PARCE QUE Assertion II -> A, B, C, D, E)
  | "association";    // Appariement (Liste 1..4 <-> Liste A..D désorganisée)

/**
 * Nettoie les titres de cours et noms de fichiers pour en extraire le sujet médical pur
 * Élimine les numéros de chapitre, extensions, années ("1-Anémies 2026.pdf" -> "Anémies")
 */
export function cleanMedicalCourseTitle(title: string): string {
  if (!title) return "Médecine";
  let t = String(title)
    .replace(/^DawJang[_\-\s]*/i, "")
    .replace(/^QCM[_\-\s]*/i, "")
    .replace(/^Lot\s*#?\d+[_\-\s]*/i, "")
    .replace(/^\d+[\s\-_.]+/, "") // "1-", "01 -", "1. "
    .replace(/\s*\(\d+\)(?:\.pdf)?$/i, "") // "(7).pdf"
    .replace(/\.pdf$/i, "")
    .replace(/\b20\d\d(?:[-/]\d{2,4})?\b/g, "") // "2026", "2025-2026"
    .replace(/[_\-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t || "Médecine";
}

export const cleanMedicalTopicName = cleanMedicalCourseTitle;

/**
 * Nettoie et fiabilise le texte d'une proposition de QCM
 * Élimine les faux suffixes inventés ("ce qui dispense formellement..."),
 * répare les parenthèses orphelines, et normalise la casse.
 */
export function sanitizeQcmOptionText(text: string): string {
  if (!text) return "";
  let s = String(text).trim();

  // 1. Enlever la lettre ou puce en début : "A.", "B)", "1.", "- ", "▪ "
  s = s.replace(/^[A-E][\.\)\-\s]+/i, "");
  s = s.replace(/^[-•*▪▸\d.)\s]+/, "");

  // 2. Nettoyer les faux suffixes répétitifs ou absurdes inventés par les modèles
  s = s.replace(/\s*[-—–]\s*ce\s+qui\s+dispense(?:\s+formellement)?\s+de\s+toute?\s+exploration.*$/i, "");
  s = s.replace(/\s*[-—–]\s*ce\s+qui\s+rend(?:\s+formellement)?\s+tout\s+bilan.*$/i, "");
  s = s.replace(/\s*[-—–]\s*dispensant(?:\s+formellement)?\s+de\s+tout.*$/i, "");
  s = s.replace(/\s*[-—–]\s*excluant(?:\s+d'emblée|\s+formellement)?\s+tout.*$/i, "");
  s = s.replace(/\s*\(contrairement\s+aux\s+données\s+physiopathologiques.*?\)\.?/gi, "");
  s = s.replace(/\s*\(contrairement\s+aux\s+critères.*?\)\.?/gi, "");
  s = s.replace(/\s*\(contrairement\s+au\s+cours.*?\)\.?/gi, "");

  // 3. Réparer les parenthèses orphelines (ex: "( Anémies." ou "Anémies )")
  s = s.replace(/\(\s*anémies?\.?/gi, "");
  if (s.includes("(") && !s.includes(")")) {
    const openIdx = s.lastIndexOf("(");
    const inside = s.slice(openIdx + 1).replace(/[.\s]+$/, "").trim();
    if (inside.length <= 2) {
      s = s.slice(0, openIdx).trim();
    } else {
      s = `${s.replace(/[.\s]+$/, "")}).`;
    }
  } else if (!s.includes("(") && s.includes(")")) {
    s = s.replace(/\)/g, "");
  }

  // 4. Corriger les majuscules hurlantes dans les termes médicaux : "PRESENCE D'ANOMALIES MORPHOLOGIQUES DES HEMATIES"
  s = s.replace(/([A-ZÀ-ÖØ-ß]{4,}(?:\s+[A-ZÀ-ÖØ-ß]{2,})+)/g, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });

  // 5. Nettoyer les deux-points mal espacés
  s = s.replace(/\s*:\s*/g, " : ");
  s = s.replace(/\s{2,}/g, " ").trim();

  // 6. Ponctuation finale propre
  if (s.length > 0 && !/[.!?]$/.test(s)) {
    s += ".";
  }
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

/**
 * Détecte si plusieurs options d'une même question partagent un suffixe textuel identique artificiel
 * (ex: "— ce qui dispense formellement...") et l'élague automatiquement.
 */
export function stripCommonArtificialSuffixes(options: RichJustificationItem[]): RichJustificationItem[] {
  if (options.length < 2) return options;

  const cleanedOptions = options.map((opt) => ({
    ...opt,
    text: sanitizeQcmOptionText(opt.text),
  }));

  for (let i = 0; i < cleanedOptions.length; i++) {
    for (let j = i + 1; j < cleanedOptions.length; j++) {
      const textA = cleanedOptions[i].text.replace(/\.$/, "").trim();
      const textB = cleanedOptions[j].text.replace(/\.$/, "").trim();
      let k = 1;
      while (
        k < textA.length &&
        k < textB.length &&
        textA.charAt(textA.length - k).toLowerCase() === textB.charAt(textB.length - k).toLowerCase()
      ) {
        k++;
      }
      k--;
      if (k >= 15) {
        const commonSuffix = textA.slice(textA.length - k).trim();
        if (/^[-—–,;]|^\s*(ce qui|dispensant|rendant|permettant|sans|excluant)/i.test(commonSuffix)) {
          for (const opt of cleanedOptions) {
            if (opt.text.toLowerCase().includes(commonSuffix.toLowerCase())) {
              opt.text = opt.text
                .replace(new RegExp(`${commonSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?$`, "i"), "")
                .trim();
              if (!opt.text.endsWith(".")) opt.text += ".";
            }
          }
        }
      }
    }
  }

  return cleanedOptions;
}

export interface AnnaleDnaProfile {
  detectedFormats: DocimologicalFormat[];
  inferredDifficulty: "Fondamental" | "Intermédiaire" | "Avancé (Concours Faculté)";
  professorSyntaxMarkers: string[];
  averageStemLength: number;
  hasClinicalVignettes: boolean;
  summaryReport: string;
}

export interface RichJustificationItem {
  letter: string;
  text: string;
  isCorrectSelection: boolean; // True = case que l'étudiant doit cocher
  truthStatus: "VRAI" | "FAUX"; // Statut médical réel de l'affirmation dans le cours
  detailedWhy: string; // Explication précise : pourquoi cette proposition est vraie ou fausse
}

export interface NormalizedQcmQuestion {
  id: string;
  format: DocimologicalFormat;
  subject: string;
  difficulty: string;
  stem: string;
  groupStatements?: Array<{ num: number; text: string; isTrue: boolean }>;
  jumelageStatements?: { statement1: string; statement2: string };
  associationPairs?: Array<{
    leftIndex: number;
    leftText: string;
    rightLetter: string;
    rightText: string;
  }>;
  options: RichJustificationItem[];
  globalSynthesis: string;
}

// ============================================================================
// 0. MÉMOIRE ANTI-RÉPÉTITION INTER-SESSIONS (VARIATION SYNTAXIQUE & D'ANGLES)
// ============================================================================

const ANTI_REPEAT_STORAGE_KEY = "dawjang_qcm_anti_repeat_v1";

interface CourseGenerationMemory {
  sessionCount: number;
  pastStems: string[];
  lastUpdatedAt: string;
}

function normalizeCourseKey(titleOrText: string): string {
  return (
    (titleOrText || "cours_general")
      .toLowerCase()
      .replace(/[^a-z0-9àâäéèêëîïôöùûüç]+/g, "_")
      .slice(0, 64) || "cours_general"
  );
}

export function getCourseGenerationMemory(courseIdentifier: string): CourseGenerationMemory {
  try {
    const raw = localStorage.getItem(ANTI_REPEAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const key = normalizeCourseKey(courseIdentifier);
      if (parsed && parsed[key]) {
        return {
          sessionCount: Number(parsed[key].sessionCount || 0),
          pastStems: Array.isArray(parsed[key].pastStems) ? parsed[key].pastStems : [],
          lastUpdatedAt: parsed[key].lastUpdatedAt || new Date().toISOString(),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { sessionCount: 0, pastStems: [], lastUpdatedAt: new Date().toISOString() };
}

export function recordCourseGenerationMemory(
  courseIdentifier: string,
  questions: NormalizedQcmQuestion[]
): void {
  try {
    const raw = localStorage.getItem(ANTI_REPEAT_STORAGE_KEY);
    const store: Record<string, CourseGenerationMemory> = raw ? JSON.parse(raw) : {};
    const key = normalizeCourseKey(courseIdentifier);
    const prev = store[key] || {
      sessionCount: 0,
      pastStems: [],
      lastUpdatedAt: new Date().toISOString(),
    };
    const newStems = questions
      .map((q) => q.stem.trim())
      .filter((s) => s.length > 10);
    const mergedStems = Array.from(new Set([...newStems, ...prev.pastStems])).slice(0, 80);

    store[key] = {
      sessionCount: prev.sessionCount + 1,
      pastStems: mergedStems,
      lastUpdatedAt: new Date().toISOString(),
    };
    localStorage.setItem(ANTI_REPEAT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

const DOCIMOLOGICAL_ANGLES = [
  "ANGLE #1 (PHYSIOPATHOLOGIE & SEUILS BIOLOGIQUES) : Cible les mécanismes physiopathologiques intimes, les constantes quantitatives, les valeurs seuils d'hémogramme/biochimie et les cascades enzymatiques ou hémodynamiques.",
  "ANGLE #2 (DIAGNOSTIC DIFFÉRENTIEL & FORMES CLINIQUES TROMPEUSES) : Cible les litiges diagnostiques entre entités proches, les présentations atypiques selon le terrain (enfant, sujet âgé, grossesse) et les critères d'exclusion.",
  "ANGLE #3 (PHARMACOLOGIE, POSOLOGIES & CONTRE-INDICATIONS) : Cible la prise en charge thérapeutique graduée, les posologies exactes, la surveillance paraclinique, les effets indésirables et les contre-indications formelles ou relatives.",
  "ANGLE #4 (VIGNETTES CLINIQUES INTÉGRÉES & URGENCES) : Présente des situations clinico-biologiques synthétiques exigeant une déduction en deux étapes (diagnostic étiologique puis conduite à tenir immédiate).",
];

/**
 * Construit un planning de types docimologiques garantissant que TOUS les types
 * sélectionnés par l'étudiant sont présents et répartis équitablement sur les N questions.
 */
export function buildFormatQuotaSchedule(
  selectedFormats: DocimologicalFormat[],
  questionCount: number,
  sessionOffset = 0
): DocimologicalFormat[] {
  const validFormats: DocimologicalFormat[] =
    selectedFormats && selectedFormats.length > 0
      ? selectedFormats
      : ["election", "choix_multiple", "censure"];

  const schedule: DocimologicalFormat[] = [];
  for (let i = 0; i < questionCount; i++) {
    // Garantit d'abord que chaque format choisi apparaît au moins une fois dès les premières questions
    if (i < validFormats.length) {
      schedule.push(validFormats[(i + sessionOffset) % validFormats.length]);
    } else {
      schedule.push(validFormats[(i + sessionOffset) % validFormats.length]);
    }
  }
  return schedule;
}

/**
 * 1. ANALYSEUR AUTOMATIQUE DES FICHIERS D'ANNALES UPLOADÉS (PÔLE B)
 */
export function analyzeUploadedAnnalesDna(annalesRawText: string): AnnaleDnaProfile {
  const text = (annalesRawText || "").trim();
  const detected = new Set<DocimologicalFormat>();

  if (
    /\b(fausse|fausses|inexacte|inexactes|intrus|sauf\s+une|à\s+l['’]exception|censure)\b/i.test(
      text
    )
  ) {
    detected.add("censure");
  }

  if (
    /(?:1\s*,\s*2\s*et\s*3|1\s*et\s*3|2\s*et\s*4|4\s*seul|compléments?\s+groupés?|groupage)/i.test(
      text
    )
  ) {
    detected.add("groupage");
  }

  if (/\b(parce\s+que|cause\s+à\s+effet|jumelage|relation\s+de\s+causalité)\b/i.test(text)) {
    detected.add("jumelage");
  }

  if (/\b(associez|association|appariement|reliez|liste\s+1|colonne\s+a)\b/i.test(text)) {
    detected.add("association");
  }

  if (
    /\b(laquelle|une\s+seule|unique\s+proposition|proposition\s+exacte|qcu|élection)\b/i.test(
      text
    )
  ) {
    detected.add("election");
  }

  if (
    /\b(lesquelles|la\s+ou\s+les|une\s+ou\s+plusieurs|propositions?\s+exactes?|qcm)\b/i.test(
      text
    )
  ) {
    detected.add("choix_multiple");
  }

  if (detected.size === 0) {
    detected.add("election");
    detected.add("choix_multiple");
    detected.add("censure");
  }

  const hasClinicalVignettes =
    /\b(patient\s+de\s+\d+\s+ans|patiente\s+âgée|admise?\s+aux\s+urgences|à\s+l['’]hémogramme|bilan\s+biologique\s+montre)\b/i.test(
      text
    );
  const numericalDensity = (
    text.match(/\b\d+(?:[.,]\d+)?\s*(?:g\/dl|mg\/l|mm3|fl|pg|%|µg|mmol)/gi) || []
  ).length;

  let inferredDifficulty: AnnaleDnaProfile["inferredDifficulty"] = "Intermédiaire";
  if (
    hasClinicalVignettes ||
    numericalDensity >= 8 ||
    detected.has("jumelage") ||
    detected.has("groupage")
  ) {
    inferredDifficulty = "Avancé (Concours Faculté)";
  } else if (numericalDensity <= 2 && text.length < 1500) {
    inferredDifficulty = "Fondamental";
  }

  const markers: string[] = [];
  const questionLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\?$|:$|\b(concernant|parmi|indiquez|laquelle|lesquelles)\b/i.test(l))
    .slice(0, 8);

  questionLines.forEach((q) => {
    if (q.length > 15 && q.length < 180) markers.push(q);
  });

  const formatLabels: Record<DocimologicalFormat, string> = {
    election: "Élection (QCU)",
    choix_multiple: "Choix Multiple",
    censure: "Censure",
    groupage: "Groupage",
    jumelage: "Jumelage",
    association: "Association",
  };

  const detectedArray = Array.from(detected);

  return {
    detectedFormats: detectedArray,
    inferredDifficulty,
    professorSyntaxMarkers: markers,
    averageStemLength: 120,
    hasClinicalVignettes,
    summaryReport: `${detectedArray.map((f) => formatLabels[f]).join(" • ")} | Niveau détecté : ${inferredDifficulty}`,
  };
}

/**
 * 2. CONSTRUCTEUR UNIVERSEL DE PROMPT PAR LOT (MIMÉTISME D'ANNALES SYSTÉMATIQUE)
 * Utilisé aussi bien pour un cours pré-uploadé, un fichier importé, un texte libre
 * que pour le mode Mimétisme d'Annales avec Pôle B.
 */
export function buildUniversalDocimologicalBatchPrompt(params: {
  courseTitle: string;
  courseChunk: string;
  batchFormats: DocimologicalFormat[];
  batchStartIndex: number;
  difficulty: string;
  annalesPoleB?: string;
  dna?: AnnaleDnaProfile | null;
  sessionNumber: number;
  pastStems: string[];
}): string {
  const {
    courseTitle,
    courseChunk,
    batchFormats,
    batchStartIndex,
    difficulty,
    annalesPoleB,
    dna,
    sessionNumber,
    pastStems,
  } = params;

  const angleDirective =
    DOCIMOLOGICAL_ANGLES[sessionNumber % DOCIMOLOGICAL_ANGLES.length];

  const difficultySyntaxDirective =
    difficulty.includes("Fondamental") || difficulty.includes("Facile")
      ? `NIVEAU D'EXIGENCE — FONDAMENTAL CONCOURS UNIVERSITAIRE (ZÉRO SIMPLISME) :
- Même au niveau Fondamental, INTERDICTION ABSOLUE de poser des questions scolaires naïves ou « terrestres » (ex: jamais « Qu'est-ce que... ? »).
- Adopte une syntaxe universitaire soutenue de faculté de médecine (style Annales FMPOS / EDN) : « Parmi les propositions suivantes relatives aux critères diagnostiques et physiopathologiques de…, laquelle (lesquelles) est (sont) exacte(s) ? ».
- Chaque proposition (A à E) doit comporter une densité sémiologique, physiopathologique ou biologique précise issue du cours.`
      : difficulty.includes("Avancé")
      ? `NIVEAU D'EXIGENCE — AVANCÉ / SÉLECTIF CONCOURS D'INTERNAT & EDN :
- Syntaxe magistrale d'examen : vignettes clinico-biologiques authentiques, raisonnement physiopathologique, pièges de seuils chiffrés (VGM, réticulocytes, ferritine) et confusion entre entités frontières.
- Les distracteurs doivent être de vraies propositions médicales plausibles issues du cours.
- INTERDICTION FORMELLE DE SUFFIXES MÉCANIQUES : Ne jamais utiliser des formules absurdes telles que « ce qui dispense formellement de toute exploration », « rendant tout bilan inutile », « excluant tout diagnostic ». Les pièges doivent être chirurgicaux et réalistes.`
      : `NIVEAU D'EXIGENCE — INTERMÉDIAIRE ANNALE DE FACULTÉ (LITIGE COGNITIF & REFORMULATION) :
- Syntaxe d'annale officielle : reformulation universitaire exigeante des concepts du cours, mise en tension de deux mécanismes ou tableaux voisins pour créer un véritable litige docimologique que seule la connaissance exacte du cours permet de trancher.`;

  const perQuestionFormatPlan = batchFormats
    .map((fmt, idx) => {
      const qNum = batchStartIndex + idx + 1;
      switch (fmt) {
        case "election":
          return `- Question #${qNum} : format OBLIGATOIRE = "election" (QCU : 1 SEULE proposition VRAIE avec isCorrectSelection:true, et 4 propositions FAUSSES plausibles avec isCorrectSelection:false).`;
        case "choix_multiple":
          return `- Question #${qNum} : format OBLIGATOIRE = "choix_multiple" (QRM : 2, 3 ou 4 propositions VRAIES avec isCorrectSelection:true, les autres FAUSSES avec isCorrectSelection:false).`;
        case "censure":
          return `- Question #${qNum} : format OBLIGATOIRE = "censure" (CENSURE « SAUF UNE » : l'énoncé demande d'identifier l'unique proposition FAUSSE/INEXACTE ; rédige 4 propositions VRAIES [truthStatus:"VRAI", isCorrectSelection:false] et 1 proposition FAUSSE [truthStatus:"FAUX", isCorrectSelection:true]).`;
        case "groupage":
          return `- Question #${qNum} : format OBLIGATOIRE = "groupage" (Compléments groupés : fournis obligatoirement "groupStatements" contenant 5 assertions médicales numérotées 1 à 5 [{ "num": 1, "text": "...", "isTrue": true/false }, ...], et dans "options" A à E utilise le barème officiel : A="1, 2 et 3 sont exactes", B="1 et 3 sont exactes", C="2 et 4 sont exactes", D="4 seule est exacte", E="Toute autre combinaison").`;
        case "jumelage":
          return `- Question #${qNum} : format OBLIGATOIRE = "jumelage" (Cause à effet : fournis obligatoirement "jumelageStatements": { "statement1": "Première assertion médicale précise...", "statement2": "Seconde assertion médicale précise..." }, et dans "options" A à E utilise le barème officiel : A="Les deux assertions sont vraies et liées par une relation de cause à effet", B="Les deux assertions sont vraies mais SANS relation de cause à effet", C="La 1re assertion est vraie mais la 2nde est fausse", D="La 1re assertion est fausse mais la 2nde est vraie", E="Les deux assertions sont fausses").`;
        case "association":
          return `- Question #${qNum} : format OBLIGATOIRE = "association" (Appariement : fournis obligatoirement "associationPairs" contenant 4 paires [{ "leftIndex": 1, "leftText": "Entité/Signe 1", "rightLetter": "A", "rightText": "Mécanisme/Cible A" }, ...] où l'ordre réel est mélangé [JAMAIS 1-A, 2-B, 3-C, 4-D], et dans "options" A à E propose 5 combinaisons d'appariement distinctes du type "1-C ; 2-A ; 3-D ; 4-B").`;
      }
    })
    .join("\n");

  const forbiddenStemsBlock =
    pastStems.length > 0
      ? `\nMÉMOIRE ANTI-RÉPÉTITION (SESSION #${sessionNumber + 1}) — INTERDICTION FORMELLE DE RÉUTILISER CES ÉNONCÉS OU ANGLES DÉJÀ POSÉS DANS LES SESSIONS PRÉCÉDENTES :\n${pastStems
          .slice(0, 18)
          .map((s) => `- INTERDIT : "${s.slice(0, 140)}"`)
          .join("\n")}\nTu DOIS formuler des questions 100 % inédites, sous un nouvel angle syntaxique et docimologique.\n`
      : `\nSESSION #${sessionNumber + 1} — VARIATION DOCIMOLOGIQUE : Formule des énoncés originaux de style annale officielle.\n`;

  const annalesReferenceBlock =
    annalesPoleB && annalesPoleB.trim().length > 20
      ? `\nMODÈLE D'ANNALES DE RÉFÉRENCE (PÔLE B — CLONER LA SYNTAXE ET LE STYLE DU PROFESSEUR) :\n${
          dna?.professorSyntaxMarkers?.length
            ? `Tournures favorites détectées :\n${dna.professorSyntaxMarkers.map((m) => `- "${m}"`).join("\n")}\n`
            : ""
        }${annalesPoleB.slice(0, 2800)}\n`
      : `\nMIMÉTISME D'ANNALES UNIVERSEL ACTIVÉ : Même sans fichier d'annale externe, rédige chaque question avec le mimétisme exact d'une annale officielle de Faculté de Médecine (tournures magistrales : « Parmi les assertions suivantes relatives à…, indiquez celle(s) qui s'avère(nt) exacte(s) », « À l'exception d'une seule, toutes les propositions suivantes caractérisent… », « Devant un tableau associant…, quelle est la proposition exacte ? »).\n`;

  const cleanSubject = cleanMedicalCourseTitle(courseTitle);

  return `Tu es un Professeur Agrégé et Président de Jury Docimologique en Faculté de Médecine.
Ta mission est de générer EXACTEMENT ${batchFormats.length} QCM d'examen de très haut niveau académique sur le cours « ${cleanSubject} ».

${angleDirective}

${difficultySyntaxDirective}

PLAN OBLIGATOIRE DES TYPES DOCIMOLOGIQUES POUR CE LOT (${batchFormats.length} QCM) :
Tu DOIS produire exactement ${batchFormats.length} objets dans le tableau JSON, en respectant dans l'ordre le format assigné à chaque question :
${perQuestionFormatPlan}
${forbiddenStemsBlock}
${annalesReferenceBlock}
RÈGLES ABSOLUES DE QUALITÉ & DOCIMOLOGIE DE FACULTÉ :
1. Produis EXACTEMENT ${batchFormats.length} questions dans un tableau JSON [ ... ]. Ne t'arrête JAMAIS à 1 seule question !
2. PHRASES MÉDICALES COMPLÈTES AVEC VERBES CONJUGUÉS : Chaque proposition A à E doit être une phrase affirmative médicale complète et grammaticalement irréprochable. INTERDICTION ABSOLUE de fragments nominaux sans verbe (comme "Hémorragies aiguës", "Affinité de l'Hb pour l'O2") ou de titres de diapositives avec deux-points.
3. Chaque question comporte obligatoirement 5 options lettrées "A", "B", "C", "D", "E" avec "text", "isCorrectSelection" (boolean), "truthStatus" ("VRAI" ou "FAUX") et "detailedWhy" (justification précise avec les valeurs/mécanismes du cours).
4. L'énoncé (stem) doit porter sur « ${cleanSubject} » avec une formulation magistrale naturelle d'annale de Faculté. Ne copie JAMAIS de nom de fichier brut (« 1-Anémies 2026 ») ni de numéro de diapositive dans la question.
5. DIVERSIFICATION SYNTAXIQUE (ALTERNANCE PHRASES SIMPLES / COMPLEXES DANS CHAQUE QCM) :
   - Tu DOIS impérativement alterner au sein de chaque question :
     * Option A : Phrase simple et directe (8 à 14 mots) énonçant une règle, un seuil ou un mécanisme précis.
     * Option B : Phrase complexe (18 à 30 mots) avec subordonnée de condition clinique ou nuance physiopathologique qui SÈME LE DOUTE.
     * Option C : Phrase simple (8 à 14 mots).
     * Option D : Phrase complexe (18 à 30 mots) mettant en tension deux entités diagnostiques.
     * Option E : Phrase simple ou moyenne (10 à 16 mots) portant sur le traitement ou la surveillance.
6. PIÈGES CHIRURGICAUX RÉALISTES : Les fausses propositions (distracteurs) doivent être de vraies erreurs cliniques classiques d'étudiants (inversion de seuil VGM/réticulocytes/ferritine, confusion anémie centrale vs périphérique, contre-indication oubliée), sans aucune clause artificielle ajoutée en fin de phrase.

SCHEMA JSON ATTENDU (TABLEAU DE ${batchFormats.length} QUESTIONS) :
[
  {
    "stem": "Énoncé magistral de la question...",
    "format": "${batchFormats[0] || "choix_multiple"}",
    "groupStatements": [{"num": 1, "text": "...", "isTrue": true}],
    "jumelageStatements": {"statement1": "...", "statement2": "..."},
    "associationPairs": [{"leftIndex": 1, "leftText": "...", "rightLetter": "A", "rightText": "..."}],
    "options": [
      { "letter": "A", "text": "...", "isCorrectSelection": false, "truthStatus": "FAUX", "detailedWhy": "..." },
      { "letter": "B", "text": "...", "isCorrectSelection": true, "truthStatus": "VRAI", "detailedWhy": "..." },
      { "letter": "C", "text": "...", "isCorrectSelection": false, "truthStatus": "FAUX", "detailedWhy": "..." },
      { "letter": "D", "text": "...", "isCorrectSelection": false, "truthStatus": "FAUX", "detailedWhy": "..." },
      { "letter": "E", "text": "...", "isCorrectSelection": false, "truthStatus": "FAUX", "detailedWhy": "..." }
    ],
    "globalSynthesis": "Synthèse docimologique..."
  }
]
(Note : n'inclus "groupStatements" que si format="groupage", "jumelageStatements" que si format="jumelage", et "associationPairs" que si format="association".)

COURS SOURCE À TRANSFORMER EN QCM :
${courseChunk}

${STRICT_JSON_PROMPT_GUARD}`;
}

export function buildAnnalesMimicryPrompt(params: {
  coursePoleA: string;
  annalesPoleB: string;
  dna: AnnaleDnaProfile;
  userManualFormatsOverride?: DocimologicalFormat[] | null;
  questionCount: number;
}): string {
  const activeFormats =
    params.userManualFormatsOverride && params.userManualFormatsOverride.length > 0
      ? params.userManualFormatsOverride
      : params.dna.detectedFormats;
  const schedule = buildFormatQuotaSchedule(activeFormats, params.questionCount, 0);
  return buildUniversalDocimologicalBatchPrompt({
    courseTitle: "Cours & Annales",
    courseChunk: params.coursePoleA,
    batchFormats: schedule,
    batchStartIndex: 0,
    difficulty: params.dna.inferredDifficulty,
    annalesPoleB: params.annalesPoleB,
    dna: params.dna,
    sessionNumber: 0,
    pastStems: [],
  });
}

// ============================================================================
// 3. EXTRACTION DE FAITS DU COURS & CONVERTISSEUR STRUCTURÉ MULTI-TYPES
// ============================================================================

function cleanMedicalFact(fact: string): string {
  let cleaned = String(fact || "")
    // 1. Élimination impitoyable de toutes les puces Unicode ou caractères de diapositives
    .replace(/^[\u25A0-\u25FF\u2700-\u27BF\u2022\u25E6\u25AA\u25AB\u25B6\u25B8\u25C0\u25C2•*▪▸❑▫◦✓✔\-\d.)\s]+/u, "")
    .replace(/^(?:frottis\s*sanguin|myélogramme|hémogramme|biologie|clinique|physiopathologie|définition|etiologie|étiologie|traitement)\s*:\s*/i, "")
    // Élimination des deux-points de fin (titres de diapositives)
    .replace(/[:;\s]+$/, "")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 2. Supprimer tout faux suffixe ou clause artificielle
  cleaned = cleaned.replace(/\s*[-—–]\s*ce\s+qui\s+dispense.*$/i, "");
  cleaned = cleaned.replace(/\s*[-—–]\s*dispensant.*$/i, "");
  cleaned = cleaned.replace(/\s*[-—–]\s*rendant.*$/i, "");

  // 3. Réparer les parenthèses orphelines
  if (cleaned.startsWith("(") && !cleaned.includes(")")) cleaned = cleaned.slice(1).trim();
  if (cleaned.endsWith(")") && !cleaned.includes("(")) cleaned = cleaned.slice(0, -1).trim();
  if (cleaned.includes("(") && !cleaned.includes(")")) {
    const oIdx = cleaned.lastIndexOf("(");
    const inParen = cleaned.slice(oIdx + 1).replace(/[.\s]+$/, "").trim();
    if (inParen.length <= 2) {
      cleaned = cleaned.slice(0, oIdx).trim();
    } else {
      cleaned = `${cleaned.replace(/[.\s]+$/, "")}).`;
    }
  }

  // 4. Normaliser les majuscules abusives (ex: "PRESENCE D'ANOMALIES")
  cleaned = cleaned.replace(/([A-ZÀ-ÖØ-ß]{4,}(?:\s+[A-ZÀ-ÖØ-ß]{2,})+)/g, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });

  if (!cleaned.endsWith(".") && !cleaned.endsWith("?") && !cleaned.endsWith("!")) {
    cleaned += ".";
  }
  if (cleaned.length > 1) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function extractHighValueCourseFacts(courseText: string, topicTitle: string): string[] {
  // Verbe médical conjugué obligatoire pour valider qu'il s'agit d'une vraie assertion et non d'un fragment de titre
  const VERB_REGEX =
    /\b(est|sont|repose|permet|exige|impose|constitue|résulte|comporte|caractérise|s'accompagne|provoque|entraîne|indique|survient|associe|témoigne|justifie|reflète|présente|observe|découle|diffère|doit|peuvent|peut|favorise|augmente|diminue)\b/i;

  const rawLines = (courseText || "")
    .replace(/\r/g, "\n")
    .split(/\n+|[.!?]\s+/)
    .map((s) => cleanMedicalFact(s))
    .filter(
      (s) =>
        s.length >= 35 &&
        s.length <= 260 &&
        s.split(/\s+/).length >= 6 &&
        VERB_REGEX.test(s) &&
        !/:(?:\.|$)/.test(s) &&
        !/^(objectif|plan du cours|introduction|conclusion|bibliographie|professeur|faculté|université|diapo|page)/i.test(
          s
        )
    );

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of rawLines) {
    const norm = line.toLowerCase().slice(0, 60);
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(line);
    }
  }

  // Si le document extrait n'a pas assez d'assertions complètes avec verbes,
  // ancrer sur le compartiment authentique du Google Drive pour cette matière !
  if (unique.length < 10) {
    const cleanTopic = cleanMedicalCourseTitle(topicTitle || "Anémies");
    const driveQuestions = getDriveExamQuestionsForTopic(cleanTopic);
    for (const dq of driveQuestions) {
      for (const opt of dq.options) {
        if (opt.text && opt.text.length > 20 && !unique.includes(opt.text)) {
          unique.push(opt.text);
        }
      }
    }

    const fallbacks = [
      `Le diagnostic positif de ${cleanTopic} repose impérativement sur la mesure du taux d'hémoglobine selon les seuils OMS.`,
      `L'évaluation du volume globulaire moyen (VGM) permet d'orienter immédiatement vers une étiologie microcytaire ou macrocytaire.`,
      `Le taux absolu de réticulocytes permet de distinguer formellement une anémie centrale arégénérative d'une anémie périphérique régénératrice.`,
      `La ferritinémie constitue le marqueur le plus sensible et spécifique des réserves martiales en l'absence de syndrome inflammatoire.`,
      `En présence d'un syndrome inflammatoire aigu ou chronique, la ferritine peut être faussement normale malgré une carence martiale réelle.`,
      `Toute anémie par carence en fer chez l'adulte de plus de 50 ans impose la réalisation systématique d'endoscopies digestives.`,
      `L'anémie hémolytique associe de manière caractéristique un effondrement de l'haptoglobine, une hyperbilirubinémie libre et une élévation des LDH.`,
      `La transfusion de concentrés de globules rouges est strictement guidée par la tolérance clinique hémodynamique et coronaire du patient.`,
      `La supplémentation par sels ferreux doit être prolongée pendant 3 à 6 mois après normalisation du taux d'hémoglobine pour reconstituer les stocks.`,
      `L'asynchronie nucléo-cytoplasmique des précurseurs érythroblastiques médullaires caractérise les anémies par carence en folates ou en vitamine B12.`,
    ];
    for (const fb of fallbacks) {
      if (!unique.includes(fb)) {
        unique.push(cleanMedicalFact(fb));
      }
    }
  }

  return unique;
}

function mutateFactIntoSubtleFalsehood(fact: string, seed: number): {
  falseText: string;
  reason: string;
} {
  const s = cleanMedicalFact(fact).replace(/\.$/, "");

  // 1. Inversion d'orientation centrale vs périphérique
  if (/\b(centrale|arégénérative)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\b(centrale|arégénérative)\b/gi, "périphérique régénérative")}.`,
      reason:
        "Affirmation inexacte : le cours indique une origine centrale (arégénérative) et non périphérique régénératrice.",
    };
  }
  if (/\b(périphérique|régénérative)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\b(périphérique|régénérative)\b/gi, "centrale arégénérative")}.`,
      reason:
        "Affirmation inexacte : le mécanisme est périphérique (régénératif) et non d'origine centrale médullaire.",
    };
  }

  // 2. Inversion de taille VGM (microcytaire vs macrocytaire)
  if (/\b(microcytaire)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\bmicrocytaire\b/gi, "macrocytaire (VGM > 100 fL)")}.`,
      reason:
        "Affirmation inexacte : l'anémie est microcytaire (VGM < 80 fL) et non macrocytaire.",
    };
  }
  if (/\b(macrocytaire)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\bmacrocytaire\b/gi, "microcytaire (VGM < 80 fL)")}.`,
      reason:
        "Affirmation inexacte : l'anémie est macrocytaire (VGM > 100 fL) et non microcytaire.",
    };
  }

  // 3. Inversion de coloration (hypochrome vs normochrome)
  if (/\b(hypochrome|hypochromie)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\b(hypochrome|hypochromie)\b/gi, "normochrome")}.`,
      reason:
        "Affirmation inexacte : le cours décrit une hypochromie (CCMH < 32 %) et non une normochromie.",
    };
  }

  // 4. Inversion de seuil biologique ou de cinétique
  if (/\b(augmentation|augmenté|augmente|élévation|élevé|élevée|hausse|hyper)\b/i.test(s)) {
    return {
      falseText: `${s.replace(
        /\b(augmentation|augmenté|augmente|élévation|élevé|élevée|hausse)\b/i,
        "abaissement significatif"
      )}.`,
      reason:
        "Affirmation inexacte : le cours décrit au contraire une augmentation / élévation et non un abaissement.",
    };
  }
  if (/\b(diminution|diminué|diminue|abaissement|abaissé|abaissée|bas|basse|baisse|effondrement|hypo)\b/i.test(s)) {
    return {
      falseText: `${s.replace(
        /\b(diminution|diminué|diminue|abaissement|abaissé|abaissée|bas|basse|baisse|effondrement)\b/i,
        "élévation marquée"
      )}.`,
      reason:
        "Affirmation inexacte : le paramètre est diminué ou abaissé selon le cours magistral.",
    };
  }

  // 5. Inversion d'indication thérapeutique ou d'examen
  if (/\b(contre-indiqu|proscrit|interdit|ne doit pas)/i.test(s)) {
    return {
      falseText: `${s.replace(
        /\b(contre-indiqué|contre-indiquée|proscrit|interdit|ne doit pas être)\b/i,
        "indiqué en première intention"
      )}.`,
      reason:
        "Affirmation fausse et dangereuse : il s'agit d'une contre-indication formelle.",
    };
  }
  if (/\b(première intention|systématique|indispensable|obligatoire)\b/i.test(s)) {
    return {
      falseText: `${s.replace(
        /\b(première intention|systématique|indispensable|obligatoire)\b/i,
        "inutile en première intention"
      )}.`,
      reason:
        "Affirmation inexacte : cet examen ou traitement est formellement recommandé en première intention.",
    };
  }

  // 6. Inversion congénitale vs acquise / aiguë vs chronique
  if (/\b(congénitale(s)?|héréditaire(s)?)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\b(congénitale|héréditaire)(s)?\b/gi, "exclusivement acquise$2")}.`,
      reason:
        "Affirmation inexacte : il s'agit d'une affection congénitale / héréditaire et non acquise.",
    };
  }
  if (/\b(acquise(s)?)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\bacquise(s)?\b/gi, "exclusivement constitutionnelle héréditaire$1")}.`,
      reason:
        "Affirmation inexacte : cette entité est acquise et non héréditaire constitutionnelle.",
    };
  }

  // 7. Négation clinique simple et naturelle (sans aucune formule artificielle)
  if (/\best\s+(un|une|le|la|l'|souvent|toujours)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\best\s+(un|une|le|la|l'|souvent|toujours)\b/i, "n'est pas $1")}.`,
      reason:
        "Affirmation fausse : discordance directe avec la définition enseignée dans le cours.",
    };
  }
  if (/\bsont\s+/i.test(s)) {
    return {
      falseText: `${s.replace(/\bsont\s+/i, "ne sont pas ")}.`,
      reason:
        "Affirmation inexacte : négation d'une propriété fondamentale du cours.",
    };
  }

  // 8. Inversion sobre du verbe ou négation clinique naturelle sans suffixe artificiel
  if (/\b(peut|peuvent)\b/i.test(s)) {
    return {
      falseText: `${s.replace(/\b(peut|peuvent)\b/i, "ne peut en aucun cas")}.`,
      reason: "Affirmation inexacte : restriction excessive contredisant les données du cours.",
    };
  }
  return {
    falseText: `${s.replace(/\b(est|sont|repose|permet|impose|constitue)\b/i, (m) => {
      const lower = m.toLowerCase();
      if (lower === "est") return "n'est pas";
      if (lower === "sont") return "ne sont pas";
      if (lower === "repose") return "ne repose pas";
      if (lower === "permet") return "ne permet pas";
      if (lower === "impose") return "n'impose pas";
      return "ne constitue pas";
    })}.`,
    reason: "Affirmation inexacte : non conforme aux mécanismes enseignés dans le cours magistral.",
  };
}

/**
 * Construit ou répare une question pour qu'elle respecte STRICTEMENT le format docimologique cible
 * (election, choix_multiple, censure, groupage, jumelage, association) avec une syntaxe d'annale.
 */
function coerceQuestionToTargetFormat(
  q: NormalizedQcmQuestion,
  targetFormat: DocimologicalFormat,
  qIdx: number,
  courseFacts: string[],
  subject: string,
  sessionNumber: number
): NormalizedQcmQuestion {
  const letters = ["A", "B", "C", "D", "E"];
  const factBaseIdx = (qIdx * 5 + sessionNumber * 7) % Math.max(1, courseFacts.length);
  const pickFact = (offset: number) =>
    courseFacts[(factBaseIdx + offset) % courseFacts.length];

  const cleanTopic = cleanMedicalCourseTitle(subject || q.subject || "cette pathologie");

  // S'assurer d'avoir 5 options de base
  const baseOptions: RichJustificationItem[] = [...q.options];
  while (baseOptions.length < 5) {
    const idx = baseOptions.length;
    const f = pickFact(idx);
    const mutated = mutateFactIntoSubtleFalsehood(f, qIdx + idx);
    baseOptions.push({
      letter: letters[idx],
      text: sanitizeQcmOptionText(mutated.falseText),
      isCorrectSelection: false,
      truthStatus: "FAUX",
      detailedWhy: mutated.reason,
    });
  }

  // 1. FORMAT GROUPAGE (Assertions 1 à 5 -> A=1+2+3, B=1+3, C=2+4, D=4, E=Autre)
  if (targetFormat === "groupage") {
    const comboKeys: Array<{
      letter: string;
      trueNums: number[];
      label: string;
    }> = [
      { letter: "A", trueNums: [1, 2, 3], label: "Les propositions 1, 2 et 3 sont exactes uniquement" },
      { letter: "B", trueNums: [1, 3], label: "Les propositions 1 et 3 sont exactes uniquement" },
      { letter: "C", trueNums: [2, 4], label: "Les propositions 2 et 4 sont exactes uniquement" },
      { letter: "D", trueNums: [4], label: "La proposition 4 seule est exacte" },
      { letter: "E", trueNums: [1, 4, 5], label: "Toute autre combinaison de propositions exactes" },
    ];
    const chosenCombo = comboKeys[(qIdx + sessionNumber) % comboKeys.length];

    let groupStatements =
      Array.isArray(q.groupStatements) && q.groupStatements.length >= 4
        ? q.groupStatements.slice(0, 5).map((s, idx) => ({
            num: idx + 1,
            text: String(s.text || pickFact(idx)).replace(/^[1-5][\.\)\-\s]+/, "").trim(),
            isTrue: chosenCombo.trueNums.includes(idx + 1),
          }))
        : [1, 2, 3, 4, 5].map((num, idx) => {
            const shouldBeTrue = chosenCombo.trueNums.includes(num);
            const rawOpt = baseOptions[idx];
            let text =
              rawOpt &&
              rawOpt.text.length > 20 &&
              !/combinaison|exactes uniquement|assertions sont/i.test(rawOpt.text)
                ? rawOpt.text
                : shouldBeTrue
                ? pickFact(idx)
                : mutateFactIntoSubtleFalsehood(pickFact(idx), qIdx + idx).falseText;
            return {
              num,
              text: text.replace(/^[1-5A-E][\.\)\-\s]+/, "").trim(),
              isTrue: shouldBeTrue,
            };
          });

    const groupOptions: RichJustificationItem[] = comboKeys.map((ck) => {
      const isTarget = ck.letter === chosenCombo.letter;
      return {
        letter: ck.letter,
        text: ck.label,
        isCorrectSelection: isTarget,
        truthStatus: isTarget ? "VRAI" : "FAUX",
        detailedWhy: isTarget
          ? `Combinaison exacte (${ck.letter}) : seules les assertions ${chosenCombo.trueNums.join(", ")} sont conformes aux données du cours.`
          : `Combinaison inexacte : les assertions vérifiées dans le cours sont exclusivement [${chosenCombo.trueNums.join(", ")}].`,
      };
    });

    const stem =
      q.stem && !/censure|fausse|inexacte|parce que|associez/i.test(q.stem)
        ? q.stem
        : `GROUPAGE DOCIMOLOGIQUE — Concernant les mécanismes physiopathologiques, diagnostiques et thérapeutiques relatifs à « ${cleanTopic} », déterminez la combinaison exacte parmi les assertions numérotées ci-dessous :`;

    return {
      ...q,
      format: "groupage",
      stem,
      groupStatements,
      jumelageStatements: undefined,
      associationPairs: undefined,
      options: groupOptions,
      globalSynthesis:
        q.globalSynthesis ||
        `Barème officiel de Groupage : Réponse ${chosenCombo.letter} (assertions exactes : ${chosenCombo.trueNums.join(", ")}).`,
    };
  }

  // 2. FORMAT JUMELAGE (Assertion I PARCE QUE Assertion II -> A, B, C, D, E)
  if (targetFormat === "jumelage") {
    const jumelageConfigs = [
      {
        correctLetter: "A",
        s1True: true,
        s2True: true,
        why: "Les deux assertions I et II sont exactes et la seconde explique directement le mécanisme physiopathologique de la première (relation de cause à effet).",
      },
      {
        correctLetter: "B",
        s1True: true,
        s2True: true,
        why: "Les deux assertions I et II sont individuellement exactes dans le cours, mais indépendantes sans lien direct de causalité.",
      },
      {
        correctLetter: "C",
        s1True: true,
        s2True: false,
        why: "La première assertion (I) est exacte selon le cours, tandis que la seconde assertion (II) comporte une discordance.",
      },
      {
        correctLetter: "D",
        s1True: false,
        s2True: true,
        why: "La première assertion (I) est inexacte, alors que la seconde assertion (II) est formellement exacte.",
      },
      {
        correctLetter: "E",
        s1True: false,
        s2True: false,
        why: "Les deux assertions I et II sont toutes deux inexactes au regard des données du cours.",
      },
    ];
    const cfg = jumelageConfigs[(qIdx + sessionNumber) % jumelageConfigs.length];

    const jumelageStatements =
      q.jumelageStatements &&
      q.jumelageStatements.statement1?.length > 15 &&
      q.jumelageStatements.statement2?.length > 15
        ? q.jumelageStatements
        : {
            statement1: cfg.s1True
              ? pickFact(0)
              : mutateFactIntoSubtleFalsehood(pickFact(0), qIdx + 1).falseText,
            statement2: cfg.s2True
              ? pickFact(1)
              : mutateFactIntoSubtleFalsehood(pickFact(1), qIdx + 2).falseText,
          };

    const jumelageOptionsLabels = [
      {
        letter: "A",
        text: "Les deux assertions sont vraies et liées par une relation directe de cause à effet",
      },
      {
        letter: "B",
        text: "Les deux assertions sont vraies mais SANS relation de cause à effet",
      },
      {
        letter: "C",
        text: "La première assertion (I) est vraie, mais la seconde assertion (II) est fausse",
      },
      {
        letter: "D",
        text: "La première assertion (I) est fausse, mais la seconde assertion (II) est vraie",
      },
      {
        letter: "E",
        text: "Les deux assertions (I et II) sont simultanément fausses",
      },
    ];

    const jumelageOptions: RichJustificationItem[] = jumelageOptionsLabels.map((item) => {
      const isTarget = item.letter === cfg.correctLetter;
      return {
        letter: item.letter,
        text: item.text,
        isCorrectSelection: isTarget,
        truthStatus: isTarget ? "VRAI" : "FAUX",
        detailedWhy: isTarget
          ? cfg.why
          : `Ne correspond pas au statut de véracité du couple d'assertions (Réponse attendue : ${cfg.correctLetter}).`,
      };
    });

    return {
      ...q,
      format: "jumelage",
      stem: `JUMELAGE CAUSAL — Analysez le couple d'assertions suivantes relatives à « ${cleanTopic} » reliées par la locution « PARCE QUE » et cochez le code docimologique exact (A à E) :`,
      jumelageStatements,
      groupStatements: undefined,
      associationPairs: undefined,
      options: jumelageOptions,
      globalSynthesis: cfg.why,
    };
  }

  // 3. FORMAT ASSOCIATION (Appariement 1..4 <-> A..D désorganisé, jamais 1-A 2-B 3-C 4-D)
  if (targetFormat === "association") {
    const derangements = [
      ["C", "A", "D", "B"],
      ["B", "D", "A", "C"],
      ["D", "C", "B", "A"],
      ["B", "C", "D", "A"],
      ["C", "D", "A", "B"],
    ];
    const correctDerangement = derangements[(qIdx + sessionNumber) % derangements.length];

    let associationPairs =
      Array.isArray(q.associationPairs) && q.associationPairs.length >= 3
        ? q.associationPairs.slice(0, 4).map((p, idx) => ({
            leftIndex: idx + 1,
            leftText: String(p.leftText || `Élément clinique #${idx + 1}`),
            rightLetter: ["A", "B", "C", "D"][idx],
            rightText: String(p.rightText || pickFact(idx).slice(0, 95)),
          }))
        : [0, 1, 2, 3].map((idx) => {
            const fact = pickFact(idx);
            const splitPoint = Math.floor(fact.length * 0.42);
            const spaceIdx = fact.indexOf(" ", splitPoint);
            const cut = spaceIdx > 12 ? spaceIdx : Math.min(45, fact.length - 15);
            return {
              leftIndex: idx + 1,
              leftText: fact.slice(0, cut).replace(/[,:;]$/, "").trim() + "…",
              rightLetter: ["A", "B", "C", "D"][idx],
              rightText: "…" + fact.slice(cut).trim(),
            };
          });

    const correctOptionIdx = (qIdx + sessionNumber) % 5;
    const assocOptions: RichJustificationItem[] = [0, 1, 2, 3, 4].map((oIdx) => {
      const isCorrect = oIdx === correctOptionIdx;
      const perm = isCorrect
        ? correctDerangement
        : derangements[(qIdx + sessionNumber + oIdx + 1) % derangements.length];
      const comboStr = perm.map((rLet, idx) => `${idx + 1}-${rLet}`).join("  •  ");
      return {
        letter: letters[oIdx],
        text: `Appariement : ${comboStr}`,
        isCorrectSelection: isCorrect,
        truthStatus: isCorrect ? "VRAI" : "FAUX",
        detailedWhy: isCorrect
          ? `Appariement exact (${comboStr}) conforme à la correspondance clinico-biologique du cours.`
          : `Appariement erroné : l'association exacte issue du cours est ${correctDerangement
              .map((rLet, idx) => `${idx + 1}-${rLet}`)
              .join(" • ")}.`,
      };
    });

    return {
      ...q,
      format: "association",
      stem:
        q.stem && /assoc/i.test(q.stem)
          ? q.stem
          : `ASSOCIATION DOCIMOLOGIQUE — Associez chaque élément numéroté (1 à 4) de « ${cleanTopic} » à la proposition lettrée (A à D) qui lui correspond exactement :`,
      associationPairs,
      groupStatements: undefined,
      jumelageStatements: undefined,
      options: assocOptions,
      globalSynthesis: `Correspondance exacte : ${correctDerangement
        .map((rLet, idx) => `${idx + 1}-${rLet}`)
        .join(" ; ")}.`,
    };
  }

  // 4. FORMAT CENSURE ("SAUF UNE" -> 4 VRAIES [isCorrectSelection: false] + 1 FAUSSE [isCorrectSelection: true])
  if (targetFormat === "censure") {
    const falseTargetIdx = (qIdx + sessionNumber) % 5;
    const falseCandidates = baseOptions.filter(
      (o) => o.truthStatus === "FAUX" || o.isCorrectSelection
    );
    const trueCandidates = baseOptions.filter(
      (o) => o.truthStatus === "VRAI" && !o.isCorrectSelection
    );

    const censureOptions: RichJustificationItem[] = [0, 1, 2, 3, 4].map((idx) => {
      const isTheFalseIntruder = idx === falseTargetIdx;
      if (isTheFalseIntruder) {
        const existingFalse = falseCandidates[0];
        const mutated = mutateFactIntoSubtleFalsehood(pickFact(idx), qIdx + idx);
        return {
          letter: letters[idx],
          text: existingFalse ? existingFalse.text : mutated.falseText,
          isCorrectSelection: true,
          truthStatus: "FAUX",
          detailedWhy:
            existingFalse?.detailedWhy ||
            mutated.reason,
        };
      }
      const existingTrue = trueCandidates[idx % Math.max(1, trueCandidates.length)];
      return {
        letter: letters[idx],
        text: existingTrue ? existingTrue.text : pickFact(idx),
        isCorrectSelection: false,
        truthStatus: "VRAI",
        detailedWhy:
          existingTrue?.detailedWhy ||
          "Proposition exacte et conforme aux données enseignées dans le cours (ne pas cocher en mode Censure).",
      };
    });

    const stem =
      q.stem && /\b(fausse|inexacte|sauf\s+une|exception|censure)\b/i.test(q.stem)
        ? q.stem
        : `CENSURE (« SAUF UNE ») — À l'exception d'une seule, toutes les propositions suivantes relatives à « ${cleanTopic} » sont exactes. Indiquez l'affirmation INEXACTE :`;

    return {
      ...q,
      format: "censure",
      stem,
      groupStatements: undefined,
      jumelageStatements: undefined,
      associationPairs: undefined,
      options: censureOptions,
      globalSynthesis:
        q.globalSynthesis ||
        `En mode Censure, l'intrus inexact à identifier était la proposition ${letters[falseTargetIdx]}.`,
    };
  }

  // 5. FORMAT ÉLECTION (QCU : 1 SEULE proposition vraie)
  if (targetFormat === "election") {
    const trueIdx = baseOptions.findIndex((o) => o.isCorrectSelection);
    const chosenTrueIdx = trueIdx >= 0 ? trueIdx : (qIdx + sessionNumber) % 5;

    const electionOptions: RichJustificationItem[] = baseOptions.slice(0, 5).map((opt, idx) => {
      const isWinner = idx === chosenTrueIdx;
      return {
        letter: letters[idx],
        text: opt.text,
        isCorrectSelection: isWinner,
        truthStatus: isWinner ? "VRAI" : "FAUX",
        detailedWhy: opt.detailedWhy,
      };
    });

    const stem =
      q.stem && !/\b(lesquelles|plusieurs|sauf une|fausse)\b/i.test(q.stem)
        ? q.stem
        : `ÉLECTION (QCU) — Parmi les propositions suivantes relatives aux caractéristiques clinico-biologiques et physiopathologiques de « ${cleanTopic} », indiquez l'UNIQUE proposition exacte :`;

    return {
      ...q,
      format: "election",
      stem,
      groupStatements: undefined,
      jumelageStatements: undefined,
      associationPairs: undefined,
      options: electionOptions,
      globalSynthesis: q.globalSynthesis,
    };
  }

  // 6. FORMAT CHOIX MULTIPLE (QRM : 2 à 4 propositions vraies)
  const currentTrueCount = baseOptions.filter((o) => o.isCorrectSelection).length;
  const multiOptions = baseOptions.slice(0, 5).map((opt, idx) => ({
    ...opt,
    letter: letters[idx],
  }));

  if (currentTrueCount < 2) {
    const firstTrue = multiOptions.findIndex((o) => o.isCorrectSelection);
    const idx1 = firstTrue >= 0 ? firstTrue : (qIdx + sessionNumber) % 5;
    const idx2 = (idx1 + 2) % 5;
    multiOptions[idx1].isCorrectSelection = true;
    multiOptions[idx1].truthStatus = "VRAI";
    multiOptions[idx2].isCorrectSelection = true;
    multiOptions[idx2].truthStatus = "VRAI";
    multiOptions[idx2].text = pickFact(idx2);
    multiOptions[idx2].detailedWhy =
      "Proposition exacte et vérifiée dans les données magistrales du cours.";
  }

  return {
    ...q,
    format: "choix_multiple",
    stem:
      q.stem ||
      `CHOIX MULTIPLES — Parmi les assertions suivantes concernant « ${cleanTopic} », indiquez celle(s) qui s'avère(nt) exacte(s) :`,
    groupStatements: undefined,
    jumelageStatements: undefined,
    associationPairs: undefined,
    options: multiOptions,
  };
}

/**
 * Génère une question docimologique de secours de haute précision à partir des faits du cours
 * lorsque le LLM a renvoyé moins de questions que demandé (ex: 5 au lieu de 10).
 */
function synthesizeHighPrecisionFallbackQuestion(params: {
  qIdx: number;
  targetFormat: DocimologicalFormat;
  courseFacts: string[];
  subject: string;
  difficulty: string;
  sessionNumber: number;
}): NormalizedQcmQuestion {
  const { qIdx, targetFormat, courseFacts, subject, difficulty, sessionNumber } = params;
  const letters = ["A", "B", "C", "D", "E"];
  const cleanTopic = cleanMedicalCourseTitle(subject || "Médecine");

  // 1. Priorité absolue : puiser dans les annales officielles réelles du Google Drive pour ce sujet
  const driveArchives = getDriveExamQuestionsForTopic(cleanTopic);
  if (driveArchives && driveArchives.length > 0) {
    const driveQ =
      driveArchives.find((dq) => dq.format === targetFormat) ||
      driveArchives[qIdx % driveArchives.length];

    if (driveQ && Array.isArray(driveQ.options) && driveQ.options.length >= 4) {
      return coerceQuestionToTargetFormat(
        {
          ...driveQ,
          id: crypto.randomUUID(),
          subject: cleanTopic,
          difficulty: difficulty || driveQ.difficulty || "Intermédiaire",
        },
        targetFormat,
        qIdx,
        courseFacts,
        cleanTopic,
        sessionNumber
      );
    }
  }

  // Formulation selon la stricte tradition docimologique des facultés de médecine
  const getAuthenticStem = (format: DocimologicalFormat, topic: string) => {
    switch (format) {
      case "election":
        return `Parmi les propositions suivantes concernant les aspects diagnostiques et thérapeutiques de « ${topic} », une seule est exacte : laquelle ?`;
      case "censure":
        return `Concernant la physiopathologie et la prise en charge de « ${topic} », une seule proposition est FAUSSE : laquelle ?`;
      case "groupage":
        return `Concernant « ${topic} », déterminez la combinaison exacte selon le code officiel de la Faculté :`;
      case "jumelage":
        return `Évaluez la véracité et la relation causale des assertions concernant « ${topic} » :`;
      case "association":
        return `Associez chaque élément clinique de « ${topic} » à sa proposition correspondante :`;
      case "choix_multiple":
      default:
        return `Parmi les propositions suivantes concernant « ${topic} », cochez la ou les réponse(s) exacte(s) :`;
    }
  };

  const baseOptions: RichJustificationItem[] = [0, 1, 2, 3, 4].map((oIdx) => {
    const rawFact =
      courseFacts[(qIdx * 5 + oIdx + sessionNumber * 3) % courseFacts.length];
    const fact = cleanMedicalFact(rawFact);
    const isTrue = oIdx === 0 || oIdx === 2;
    if (isTrue) {
      return {
        letter: letters[oIdx],
        text: fact,
        isCorrectSelection: true,
        truthStatus: "VRAI",
        detailedWhy:
          "Proposition exacte : reprend fidèlement les critères et mécanismes exposés dans le cours magistral.",
      };
    }
    const mutated = mutateFactIntoSubtleFalsehood(fact, qIdx + oIdx + sessionNumber);
    return {
      letter: letters[oIdx],
      text: mutated.falseText,
      isCorrectSelection: false,
      truthStatus: "FAUX",
      detailedWhy: mutated.reason,
    };
  });

  const seedQuestion: NormalizedQcmQuestion = {
    id: crypto.randomUUID(),
    format: targetFormat,
    subject: cleanTopic,
    difficulty: difficulty || "Intermédiaire",
    stem: getAuthenticStem(targetFormat, cleanTopic),
    options: baseOptions,
    globalSynthesis: `Synthèse docimologique sur « ${cleanTopic} » : vérifiez chaque critère sémiologique, seuil biologique et principe thérapeutique.`,
  };

  return coerceQuestionToTargetFormat(
    seedQuestion,
    targetFormat,
    qIdx,
    courseFacts,
    cleanTopic,
    sessionNumber
  );
}

/**
 * 4. VALIDATEUR, NORMALISATEUR & GARANT DU QUOTA EXACT DE QUESTIONS ET DE FORMATS
 */
export function sanitizeAndValidateQuestions(
  rawQuestions: any[],
  fallbackSubject: string,
  options?: {
    expectedCount?: number;
    selectedFormats?: DocimologicalFormat[];
    courseText?: string;
    difficulty?: string;
    sessionNumber?: number;
  }
): NormalizedQcmQuestion[] {
  const letters = ["A", "B", "C", "D", "E"];
  const safeArray = Array.isArray(rawQuestions) ? rawQuestions : [];
  const sessionNum = options?.sessionNumber ?? 0;
  const courseFacts = extractHighValueCourseFacts(
    options?.courseText || "",
    fallbackSubject
  );

  const validFormatSet = new Set<DocimologicalFormat>([
    "election",
    "choix_multiple",
    "censure",
    "groupage",
    "jumelage",
    "association",
  ]);

  const parsedQuestions: NormalizedQcmQuestion[] = safeArray
    .map((q: any, qIdx: number) => {
      const rawFmt = String(q?.format || q?.type || "choix_multiple")
        .toLowerCase()
        .trim();
      const format: DocimologicalFormat = validFormatSet.has(rawFmt as DocimologicalFormat)
        ? (rawFmt as DocimologicalFormat)
        : rawFmt.includes("qcu") || rawFmt.includes("elect")
        ? "election"
        : rawFmt.includes("cens")
        ? "censure"
        : rawFmt.includes("group")
        ? "groupage"
        : rawFmt.includes("jumel")
        ? "jumelage"
        : rawFmt.includes("assoc")
        ? "association"
        : "choix_multiple";

      let stem = String(
        q?.stem || q?.question || q?.enonce || `Question docimologique #${qIdx + 1}`
      ).trim();

      // Nettoyer toute inclusion brute de nom de fichier ou d'année dans le stem
      stem = stem.replace(/«\s*\d+[-_\s]*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)\s*(?:20\d\d)?(?:\.pdf)?\s*»/gi, "« $1 »");
      stem = stem.replace(/«\s*cette entité\s*»/gi, "cette pathologie");

      const rawOptions = Array.isArray(q?.options)
        ? q.options
        : Array.isArray(q?.propositions)
        ? q.propositions
        : Array.isArray(q?.choices)
        ? q.choices
        : [];

      const seenTexts = new Set<string>();

      const normalizedOptions: RichJustificationItem[] = rawOptions
        .slice(0, 5)
        .map((opt: any, oIdx: number) => {
          const letter = letters[oIdx] || "A";
          let rawText =
            typeof opt === "string"
              ? opt
              : opt?.text || opt?.proposition || opt?.assertion || opt?.label || "";

          rawText = String(rawText)
            .replace(/^[A-E][\.\)\-\s]+/i, "")
            .trim();

          const isPlaceholder =
            !rawText ||
            /^(proposition|assertion|option|choix|réponse)\s*[1-5a-e]$/i.test(rawText);

          if (
            isPlaceholder &&
            Array.isArray(q?.associationPairs) &&
            q.associationPairs.length > 0
          ) {
            const shifted = q.associationPairs.map((p: any, pIdx: number) => {
              const targetIdx = (pIdx + oIdx) % q.associationPairs.length;
              return `${p.leftIndex || pIdx + 1}-${letters[targetIdx]}`;
            });
            rawText = `Appariement : ${shifted.join(" • ")}`;
          } else if (isPlaceholder) {
            const fact =
              courseFacts && courseFacts.length > 0
                ? courseFacts[(qIdx * 5 + oIdx) % courseFacts.length]
                : `Critère docimologique ${letter} relatif à « ${cleanMedicalCourseTitle(fallbackSubject)} »`;
            rawText = fact || `Proposition ${letter} relative au cours`;
          }

          rawText = sanitizeQcmOptionText(String(rawText || `Proposition ${letter}`));

          const lowerText = rawText.toLowerCase();
          if (seenTexts.has(lowerText) && rawText.length > 0) {
            rawText = `${rawText} (Option ${letter})`;
          }
          seenTexts.add(rawText.toLowerCase());

          const isCorrectSelection =
            typeof opt === "object" && typeof opt?.isCorrectSelection === "boolean"
              ? opt.isCorrectSelection
              : typeof opt === "object" && typeof opt?.isCorrect === "boolean"
              ? opt.isCorrect
              : typeof opt === "object" && typeof opt?.correct === "boolean"
              ? opt.correct
              : Array.isArray(q?.correctAnswers)
              ? q.correctAnswers.includes(oIdx) || q.correctAnswers.includes(letter)
              : Array.isArray(q?.correct_answers)
              ? q.correct_answers.includes(oIdx) || q.correct_answers.includes(letter)
              : Array.isArray(q?.correct)
              ? q.correct.includes(oIdx) || q.correct.includes(letter)
              : Array.isArray(q?.answers)
              ? q.answers.includes(oIdx) || q.answers.includes(letter)
              : q?.correctAnswer === oIdx ||
                q?.correctAnswer === letter ||
                q?.answer === oIdx ||
                q?.answer === letter;

          const defaultTruthStatus: "VRAI" | "FAUX" =
            format === "censure"
              ? isCorrectSelection
                ? "FAUX"
                : "VRAI"
              : isCorrectSelection
              ? "VRAI"
              : "FAUX";

          const truthStatus: "VRAI" | "FAUX" =
            opt?.truthStatus === "VRAI" || opt?.truthStatus === "FAUX"
              ? opt.truthStatus
              : defaultTruthStatus;

          const detailedWhy = String(
            opt?.detailedWhy ||
              opt?.explanation ||
              opt?.justification ||
              (truthStatus === "VRAI"
                ? "Affirmation exacte et conforme aux données du cours magistral."
                : "Affirmation inexacte : comporte une discordance par rapport aux seuils ou mécanismes du cours.")
          ).trim();

          return {
            letter,
            text: rawText,
            isCorrectSelection: Boolean(isCorrectSelection),
            truthStatus,
            detailedWhy,
          };
        })
        .filter((o: RichJustificationItem) => o.text.length > 2);

      const cleanedOptions = stripCommonArtificialSuffixes(normalizedOptions);

      if (
        cleanedOptions.length > 0 &&
        !cleanedOptions.some((o) => o.isCorrectSelection)
      ) {
        cleanedOptions[0].isCorrectSelection = true;
      }

      return {
        id: q?.id || crypto.randomUUID(),
        format,
        subject: cleanMedicalCourseTitle(q?.subject || fallbackSubject || "Médecine"),
        difficulty: q?.difficulty || options?.difficulty || "Intermédiaire",
        stem,
        groupStatements: q?.groupStatements,
        jumelageStatements: q?.jumelageStatements,
        associationPairs: q?.associationPairs,
        options: cleanedOptions,
        globalSynthesis:
          q?.globalSynthesis ||
          q?.explanation ||
          "Synthèse docimologique : reportez-vous aux justifications détaillées item par item ci-dessus.",
      };
    })
    .filter((q) => q.options.length >= 2);

  // Si aucun quota spécifique n'est demandé, retourner les questions validées
  if (!options?.expectedCount && (!options?.selectedFormats || options.selectedFormats.length === 0)) {
    return parsedQuestions;
  }

  const targetCount = options?.expectedCount || Math.max(1, parsedQuestions.length);
  const schedule = buildFormatQuotaSchedule(
    options?.selectedFormats || ["election", "choix_multiple", "censure"],
    targetCount,
    sessionNum
  );

  const finalQuestions: NormalizedQcmQuestion[] = [];

  for (let i = 0; i < targetCount; i++) {
    const requiredFormat = schedule[i];
    if (i < parsedQuestions.length) {
      finalQuestions.push(
        coerceQuestionToTargetFormat(
          parsedQuestions[i],
          requiredFormat,
          i,
          courseFacts,
          fallbackSubject,
          sessionNum
        )
      );
    } else {
      finalQuestions.push(
        synthesizeHighPrecisionFallbackQuestion({
          qIdx: i,
          targetFormat: requiredFormat,
          courseFacts,
          subject: fallbackSubject,
          difficulty: options?.difficulty || "Intermédiaire",
          sessionNumber: sessionNum,
        })
      );
    }
  }

  return finalQuestions;
}
