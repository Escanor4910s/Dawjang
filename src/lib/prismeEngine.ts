// src/lib/prismeEngine.ts
// Moteur Docimologique Universel DAWJANG / HIPPOCAMPUS (FMPOS Dakar x Harvard / Oxford)
// Inclut l'auto-réparation (Self-Healing) des questions d'Association, Groupage, Jumelage, Censure, Élection et Compléments Multiples.

export type AnswerLetter = "A" | "B" | "C" | "D" | "E";

export type FacultyQCMType =
  | "ELECTION"              // 1 seule proposition vraie (A-E)
  | "CENSURE"               // 1 seule proposition fausse "sauf une / inexacte" (A-E)
  | "GROUPAGE"              // Propositions 1 à 4/5 codées A=1+2+3, B=1+3, C=2+4, D=4, E=autre
  | "JUMELAGE"              // Cause à effet : A=VV lié, B=VV non lié, C=VF, D=FV, E=FF
  | "COMPLEMENTS_MULTIPLES" // 1 à 5 réponses à cocher parmi A-E ("1 fausse cochée = 0 pt")
  | "ASSOCIATION";          // Appariement Liste 1 (1..4) <-> Liste 2 (a..d) avec tableau TOUJOURS visible

export type SessionGenerationMode =
  | "CUSTOM_QCM_MIX"
  | "PROGRESSIVE_CLINICAL"
  | "HYBRID_EXAM_SIMULATOR";

export type WritingSignature =
  | "UCAD_AMPHI"            // DAWIA 1 : Style direct des professeurs FMPOS
  | "HARVARD_OXFORD_UCAD";  // DAWIA 2 : Haute Docimologie & Litige Clinique (FMPOS x Harvard/Oxford)

export type QuestionPolarity = "CHERCHER_VRAIES" | "CHERCHER_FAUSSES";

export type TrapCategory =
  | "INVERSION_TOPOGRAPHIQUE"
  | "CONFUSION_SYNDROMIQUE"
  | "STADE_CLASSIFICATION"
  | "INTENTION_DIAG_THERAP"
  | "EXCLUSIVITE_ABUSIVE"
  | "INVERSION_MECANISME"
  | "FAUX_LIEN_CAUSAL"
  | "DONNEE_CHIFFREE_ALTEREE"
  | "PROPOSITION_EXACTE";

export interface MirrorQuestion {
  stem: string;
  answer: string;
  courseAnchor: string;
}

export interface PrismeOption {
  letter: AnswerLetter;
  label: string;
  isStatementTrueInCourse: boolean;
  isTargetToCheck: boolean;
  trapCategory: TrapCategory;
  trapBadgeLabel: string;
  feedback: string;
  mirrorQuestion?: MirrorQuestion;
}

export interface ProgressiveClinicalCaseHeader {
  caseId: string;
  caseNumber: number;
  caseTitle: string;
  initialPresentation?: string;
  narrativeUpdate?: string;
  clinicalStageLabel: string;
}

export interface AssociationMatrix {
  leftColumnTitle?: string;
  rightColumnTitle?: string;
  leftItems: { num: number; text: string }[];
  rightItems: { code: string; text: string }[];
}

export interface PrismeQCMQuestion {
  id: string;
  number: number;
  type: FacultyQCMType;
  polarity: QuestionPolarity;
  sectionIndex: number;
  sectionTitle: string;
  mutationLevel: 1 | 2 | 3 | 4;
  stem: string;
  clinicalCase?: ProgressiveClinicalCaseHeader;
  numberedPropositions?: {
    num: 1 | 2 | 3 | 4 | 5;
    text: string;
    isTrueInCourse: boolean;
    trapBadgeLabel?: string;
    feedback: string;
  }[];
  jumelagePair?: {
    statement1: string;
    connector: "parce que" | "et" | "alors que";
    statement2: string;
    statement1True: boolean;
    statement2True: boolean;
    hasCausalLink: boolean;
  };
  associationMatrix?: AssociationMatrix;
  options: PrismeOption[];
  correctLetters: AnswerLetter[];
  exactCourseQuote: string;
  factSignature: string;
}

// ============================================================================
// 1. EMPREINTE SHA-256 DU COURS (PERSISTANCE ANTI-RÉPÉTITION MÊME APRÈS SUPPRESSION)
// ============================================================================

export async function computeCourseHash(rawText: string): Promise<string> {
  const normalized = rawText
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// 2. SÉQUENCE DE BONNES RÉPONSES ÉQUILIBRÉE ANTI-SÉRIES (ZÉRO "A, A, A, B, B, B")
// ============================================================================

export function generateBalancedAnswerSequence(
  count: number,
  maxConsecutive = 2
): AnswerLetter[] {
  const letters: AnswerLetter[] = ["A", "B", "C", "D", "E"];
  const pool: AnswerLetter[] = [];

  while (pool.length < count) {
    const bag = [...letters];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    pool.push(...bag);
  }

  const result = pool.slice(0, count);

  for (let i = maxConsecutive; i < result.length; i++) {
    let isStreak = true;
    for (let k = 1; k <= maxConsecutive; k++) {
      if (result[i - k] !== result[i]) {
        isStreak = false;
        break;
      }
    }
    if (isStreak) {
      const swapIdx = result.findIndex(
        (candidate, idx) =>
          idx !== i &&
          candidate !== result[i] &&
          result[idx - 1] !== result[i] &&
          result[idx + 1] !== result[i]
      );
      if (swapIdx !== -1) {
        [result[i], result[swapIdx]] = [result[swapIdx], result[i]];
      }
    }
  }

  return result;
}

// ============================================================================
// 3. NETTOYEUR & SANITIZER ANTI-BUG VISUEL (CORRIGE LES ERREURS DE L'CAPTURE D'ÉCRAN)
// ============================================================================

/**
 * Supprime toutes les fuites d'annotations internes ("(Déplacement officiel)", "(Cible)", etc.)
 * et garantit que TOUTE question d'ASSOCIATION, GROUPAGE ou JUMELAGE possède ses listes visibles
 * à la fois dans les objets structurés ET directement dans le texte si un composant legacy l'affiche !
 */
export function sanitizeAndRepairQuestion(rawQ: any, indexFallback = 1): PrismeQCMQuestion {
  const cleanLabelText = (txt: string): string => {
    if (!txt) return "";
    return txt
      .replace(/\(Déplacement officiel\)/gi, "")
      .replace(/\(Bonne réponse\)/gi, "")
      .replace(/\(Cible imposée\)/gi, "")
      .replace(/\(Proposition exacte\)/gi, "")
      .replace(/\(Proposition fausse\)/gi, "")
      .replace(/^[A-E]\s*[:=\-]\s*(?=[A-E]\s*=)/i, "")
      .trim();
  };

  const qType: FacultyQCMType = rawQ.type || "ELECTION";
  let stem = cleanLabelText(rawQ.stem || rawQ.question || `Question #${rawQ.number || indexFallback}`);

  // Réparation automatique de la matrice d'ASSOCIATION pour qu'elle ne soit JAMAIS invisible
  let associationMatrix: AssociationMatrix | undefined = rawQ.associationMatrix;
  if (qType === "ASSOCIATION") {
    if (
      !associationMatrix ||
      !Array.isArray(associationMatrix.leftItems) ||
      associationMatrix.leftItems.length === 0 ||
      !Array.isArray(associationMatrix.rightItems) ||
      associationMatrix.rightItems.length === 0
    ) {
      // Tente d'extraire depuis rawQ.leftItems / rawQ.rightItems ou rawQ.pairs
      const rawLeft = rawQ.leftItems || rawQ.list1 || [];
      const rawRight = rawQ.rightItems || rawQ.list2 || [];
      if (rawLeft.length > 0 && rawRight.length > 0) {
        associationMatrix = {
          leftColumnTitle: "Liste 1 (Éléments à associer)",
          rightColumnTitle: "Liste 2 (Correspondances)",
          leftItems: rawLeft.map((it: any, idx: number) => ({
            num: it.num || idx + 1,
            text: typeof it === "string" ? it : it.text || it.label || `Élément ${idx + 1}`,
          })),
          rightItems: rawRight.map((it: any, idx: number) => ({
            code: it.code || ["a", "b", "c", "d", "e"][idx] || String(idx + 1),
            text: typeof it === "string" ? it : it.text || it.label || `Cible ${idx + 1}`,
          })),
        };
      }
    }
  }

  // Nettoyage des 5 options A-E et suppression des options absurdes ("Les propositions 1, 2 et 3 sont exactes" dans une Association !)
  const letters: AnswerLetter[] = ["A", "B", "C", "D", "E"];
  const rawOptions: any[] = Array.isArray(rawQ.options) ? rawQ.options : [];

  const cleanedOptions: PrismeOption[] = letters.map((letter, idx) => {
    const existing = rawOptions[idx] || {};
    let label = cleanLabelText(existing.label || existing.text || "");

    // Si c'est une question d'ASSOCIATION et que l'option E contient par erreur une phrase de Groupage ("Les propositions 1, 2 et 3 sont exactes uniquement"), on la remplace par une vraie combinaison d'appariement !
    if (
      qType === "ASSOCIATION" &&
      (/propositions\s+1,\s*2/i.test(label) || !label)
    ) {
      const fallbackCombos = [
        "Appariement : 1-a • 2-b • 3-c • 4-d",
        "Appariement : 1-b • 2-d • 3-a • 4-c",
        "Appariement : 1-c • 2-a • 3-d • 4-b",
        "Appariement : 1-d • 2-c • 3-b • 4-a",
        "Appariement : 1-b • 2-a • 3-d • 4-c",
      ];
      label = fallbackCombos[idx];
    }

    return {
      letter,
      label: label || `Proposition ${letter}`,
      isStatementTrueInCourse: Boolean(existing.isStatementTrueInCourse),
      isTargetToCheck: Boolean(existing.isTargetToCheck),
      trapCategory: existing.trapCategory || "CONFUSION_SYNDROMIQUE",
      trapBadgeLabel: cleanLabelText(existing.trapBadgeLabel || ""),
      feedback: cleanLabelText(existing.feedback || existing.explanation || ""),
      mirrorQuestion: existing.mirrorQuestion,
    };
  });

  return {
    ...rawQ,
    id: rawQ.id || `q_${Date.now()}_${indexFallback}`,
    number: rawQ.number || indexFallback,
    type: qType,
    polarity: rawQ.polarity || (qType === "CENSURE" ? "CHERCHER_FAUSSES" : "CHERCHER_VRAIES"),
    sectionIndex: rawQ.sectionIndex ?? 0,
    sectionTitle: rawQ.sectionTitle || "Section du cours",
    mutationLevel: rawQ.mutationLevel || 2,
    stem,
    associationMatrix,
    options: cleanedOptions,
    correctLetters:
      Array.isArray(rawQ.correctLetters) && rawQ.correctLetters.length > 0
        ? rawQ.correctLetters
        : ["A"],
    exactCourseQuote: rawQ.exactCourseQuote || "",
    factSignature: rawQ.factSignature || stem.slice(0, 50),
  };
}

/**
 * Convertit si besoin une question PrismeQCMQuestion en texte auto-portant
 * pour que MÊME un composant legacy qui n'affiche que `question.stem` montre quand même
 * les propositions 1-4 (Groupage), les 2 phrases (Jumelage) ou les 2 colonnes (Association) !
 */
export function buildSelfContainedStemForLegacyUI(q: PrismeQCMQuestion): string {
  let fullStem = q.stem;

  if (q.type === "ASSOCIATION" && q.associationMatrix) {
    const leftText = q.associationMatrix.leftItems
      .map((item) => `${item.num}. ${item.text}`)
      .join("\n");
    const rightText = q.associationMatrix.rightItems
      .map((item) => `${item.code.toUpperCase()}. ${item.text}`)
      .join("\n");

    if (!fullStem.includes("1.")) {
      fullStem += `\n\n📋 ÉLÉMENTS À ASSOCIER :\n${leftText}\n\n🎯 CORRESPONDANCES :\n${rightText}`;
    }
  } else if (q.type === "GROUPAGE" && q.numberedPropositions && q.numberedPropositions.length > 0) {
    const propsText = q.numberedPropositions
      .map((p) => `${p.num}- ${p.text}`)
      .join("\n");
    if (!fullStem.includes("1-")) {
      fullStem += `\n\n${propsText}`;
    }
  } else if (q.type === "JUMELAGE" && q.jumelagePair) {
    if (!fullStem.includes(q.jumelagePair.statement1)) {
      fullStem += `\n\n1) « ${q.jumelagePair.statement1} »\n   — ${q.jumelagePair.connector.toUpperCase()} —\n2) « ${q.jumelagePair.statement2} »`;
    }
  }

  return fullStem;
}

// ============================================================================
// 4. NOTATION OFFICIELLE UCAD (AVEC RÈGLE D'ANNULATION EN SÉMIOLOGIE / TOR)
// ============================================================================

export function evaluateFacultyQuestionScore(
  question: PrismeQCMQuestion,
  userSelectedLetters: AnswerLetter[]
): {
  score: number;
  status: "unanswered" | "perfect" | "partial_safe" | "cancelled_by_false" | "wrong";
  falseCheckedCount: number;
  correctCheckedCount: number;
  missedCorrectCount: number;
} {
  if (!userSelectedLetters || userSelectedLetters.length === 0) {
    return {
      score: 0,
      status: "unanswered",
      falseCheckedCount: 0,
      correctCheckedCount: 0,
      missedCorrectCount: question.correctLetters.length,
    };
  }

  const targetSet = new Set(question.correctLetters);
  let correctCheckedCount = 0;
  let falseCheckedCount = 0;

  for (const letter of userSelectedLetters) {
    if (targetSet.has(letter)) {
      correctCheckedCount++;
    } else {
      falseCheckedCount++;
    }
  }

  const missedCorrectCount = Math.max(0, targetSet.size - correctCheckedCount);

  if (question.type !== "COMPLEMENTS_MULTIPLES") {
    const isRight =
      falseCheckedCount === 0 &&
      correctCheckedCount === 1 &&
      userSelectedLetters.length === 1;
    return {
      score: isRight ? 1 : 0,
      status: isRight ? "perfect" : "wrong",
      falseCheckedCount,
      correctCheckedCount,
      missedCorrectCount,
    };
  }

  if (falseCheckedCount > 0) {
    return {
      score: 0,
      status: "cancelled_by_false",
      falseCheckedCount,
      correctCheckedCount,
      missedCorrectCount,
    };
  }

  const partialScore = Number((correctCheckedCount / Math.max(1, targetSet.size)).toFixed(2));
  return {
    score: partialScore,
    status: correctCheckedCount === targetSet.size ? "perfect" : "partial_safe",
    falseCheckedCount: 0,
    correctCheckedCount,
    missedCorrectCount,
  };
}

// ============================================================================
// 5. DÉCOUPAGE EXHAUSTIF DU COURS (100% DES SECTIONS COUVERTES)
// ============================================================================

export function splitCourseIntoExhaustiveSections(
  rawCourse: string,
  maxCharsPerSection = 3400
): { index: number; title: string; content: string }[] {
  const cleaned = rawCourse.trim();
  if (!cleaned) return [];

  const rawBlocks = cleaned
    .split(/(?=^#{1,3}\s|^[I|V|X]+\.\s|^[0-9]+\.\s)/m)
    .filter((s) => s.trim().length > 0);

  const chunks: { index: number; title: string; content: string }[] = [];

  for (const block of rawBlocks) {
    const lines = block.trim().split("\n");
    const firstLine = lines[0].replace(/^#+\s*/, "").trim();
    const title =
      firstLine.length > 3 && firstLine.length < 90
        ? firstLine
        : `Section ${chunks.length + 1}`;

    if (block.length <= maxCharsPerSection) {
      chunks.push({ index: chunks.length, title, content: block.trim() });
    } else {
      const paragraphs = block.split(/\n\s*\n/);
      let current = "";
      let part = 1;
      for (const p of paragraphs) {
        if ((current + "\n\n" + p).length > maxCharsPerSection && current.length > 0) {
          chunks.push({
            index: chunks.length,
            title: `${title} (Partie ${part++})`,
            content: current.trim(),
          });
          current = p;
        } else {
          current += (current ? "\n\n" : "") + p;
        }
      }
      if (current.trim()) {
        chunks.push({
          index: chunks.length,
          title: part > 1 ? `${title} (Partie ${part})` : title,
          content: current.trim(),
        });
      }
    }
  }

  return chunks;
}

// ============================================================================
// 6. PROMPT SYSTÈME UNIVERSEL (AVEC OBLIGATION STRICTE SUR ASSOCIATION / GROUPAGE)
// ============================================================================

export function buildPrismeSystemPrompt(params: {
  courseSectionTitle: string;
  courseSectionIndex: number;
  courseSectionText: string;
  ghostExcludedStems: string[];
  generationMode: SessionGenerationMode;
  writingSignature: WritingSignature;
  questionSpecs: {
    number: number;
    type: FacultyQCMType;
    polarity: QuestionPolarity;
    targetLetters: AnswerLetter[];
    mutationLevel: 1 | 2 | 3 | 4;
    clinicalCasePlan?: {
      caseId: string;
      caseNumber: number;
      stepIndex: number;
      totalSteps: number;
      stepRole: string;
    };
  }[];
}): string {
  return `
Tu es le Comité Docimologique d'Excellence réunissant les Professeurs Titulaires de la FMPOS (UCAD Dakar : Anatomie, Physiologie, Sémiologie, Hématologie, Maladies de Système, Traumatologie-Orthopédie-Rhumatologie) et les concepteurs d'examens de Harvard Medical School et d'Oxford.

SECTION DU COURS À COUVRIR (Segment #${params.courseSectionIndex + 1} : "${params.courseSectionTitle}") :
"""
${params.courseSectionText}
"""

REGISTRE FANTÔME ANTI-RÉPÉTITION (INTERDICTION FORMELLE DE REPOSER CES QUESTIONS) :
${
  params.ghostExcludedStems.length > 0
    ? params.ghostExcludedStems.map((s) => `- "${s}"`).join("\n")
    : "- Aucune question antérieure sur ce segment."
}

PLAN DE GÉNÉRATION OBLIGATOIRE POUR CETTE SECTION :
${params.questionSpecs
  .map((spec) => {
    const caseStr = spec.clinicalCasePlan
      ? ` | CAS CLINIQUE ÉVOLUTIF #${spec.clinicalCasePlan.caseNumber} (${spec.clinicalCasePlan.caseId}) - Étape ${spec.clinicalCasePlan.stepIndex}/${spec.clinicalCasePlan.totalSteps} (${spec.clinicalCasePlan.stepRole})`
      : " | QCM Autonome";
    return `- Question Q${spec.number}${caseStr} | Format = ${spec.type} | Polarité = ${spec.polarity} | Bonne(s) réponse(s) imposée(s) = [${spec.targetLetters.join(", ")}]`;
  })
  .join("\n")}

===============================================================================
RÈGLES ABSOLUES ANTI-ERREURS DE STRUCTURE PAR TYPE DE QCM :
===============================================================================
1. INTERDICTION D'ANNOTATIONS PARASITES :
   - N'écris JAMAIS de mentions internes comme "(Déplacement officiel)", "(Bonne réponse)", "(Cible)" dans le texte des options !
2. RÈGLE STRICTE POUR "ASSOCIATION" (OBLIGATOIRE) :
   - Tu DOIS OBLIGATOIREMENT fournir l'objet "associationMatrix" contenant :
     * "leftItems": exactement 4 éléments numérotés de 1 à 4 issus du cours (ex: [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, {"num": 3, "text": "..."}, {"num": 4, "text": "..."}]).
     * "rightItems": exactement 4 éléments codés de "a" à "d" issus du cours (ex: [{"code": "a", "text": "..."}, {"code": "b", "text": "..."}, {"code": "c", "text": "..."}, {"code": "d", "text": "..."}]).
   - Les 5 propositions A, B, C, D, E d'une ASSOCIATION doivent TOUTES être des combinaisons d'appariement de la forme :
     "1-a • 2-c • 3-b • 4-d" (N'écris JAMAIS "Les propositions 1, 2 et 3 sont exactes" dans une question d'ASSOCIATION !).
3. RÈGLE STRICTE POUR "GROUPAGE" (COMPLÉMENTS GROUPÉS) :
   - Tu DOIS OBLIGATOIREMENT fournir "numberedPropositions" avec 4 affirmations numérotées de 1 à 4 (chacune avec "num", "text", "isTrueInCourse", "feedback").
   - Les 5 options A, B, C, D, E suivent impérativement le code UCAD :
     A = 1+2+3 | B = 1+3 | C = 2+4 | D = 4 uniquement | E = Autre choix.
4. RÈGLE STRICTE POUR "JUMELAGE" (CAUSE À EFFET) :
   - Tu DOIS OBLIGATOIREMENT fournir "jumelagePair" avec "statement1", "connector" ("parce que", "et", "alors que"), "statement2", "statement1True", "statement2True", "hasCausalLink".
   - Les 5 options A, B, C, D, E suivent le code UCAD :
     A = Vrai-Vrai avec relation de cause à effet | B = Vrai-Vrai sans relation de cause à effet | C = Vrai-Faux | D = Faux-Vrai | E = Faux-Faux.
5. RÈGLE STRICTE POUR "ELECTION", "CENSURE" ET "COMPLEMENTS_MULTIPLES" :
   - 5 propositions A, B, C, D, E de longueur et de structure grammaticale homogènes.
   - En CENSURE : 4 propositions sont VRAIES dans le cours et 1 seule est FAUSSE (qui est la réponse attendue).
   - En COMPLEMENTS_MULTIPLES : Seules les lettres de "targetLetters" sont à cocher ("isTargetToCheck: true").

Pour CHAQUE option A-E, fournis "trapCategory", "trapBadgeLabel", "feedback" (justification précise renvoyant au cours) et, sur les propositions fausses, "mirrorQuestion" ({ "stem", "answer", "courseAnchor" }).

Réponds UNIQUEMENT avec un JSON valide : { "questions": [...] }.
`;
}
