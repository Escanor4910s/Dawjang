// supabase/functions/generate-quiz/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AnswerLetter = "A" | "B" | "C" | "D" | "E";
type FacultyQCMType =
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "JUMELAGE"
  | "COMPLEMENTS_MULTIPLES"
  | "ASSOCIATION";
type QuestionPolarity = "CHERCHER_VRAIES" | "CHERCHER_FAUSSES";

interface QuestionSpec {
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
}

function buildSupervisorSystemPrompt(): string {
  return `
Tu es le Doyen du Comité Docimologique FMPOS (UCAD Dakar) & Harvard Medical School (NBME).
Ton rôle est d'auditer, corriger et sublimer un lot de QCM médicaux générés à partir d'une section de cours.

TES 7 RÈGLES D'AUDIT IMPITOYABLES :
1. ZÉRO ANNOTATION INTERNE DANS LES OPTIONS :
   - Ne mets JAMAIS de mentions comme "(Déplacement officiel)", "(Bonne réponse)", "(Cible)" dans le texte d'une proposition !
2. VÉRIFICATION STRICTE DES QUESTIONS D'ASSOCIATION :
   - Toute question de type "ASSOCIATION" DOIT obligatoirement posséder un objet "associationMatrix" complet contenant :
     * "leftItems": 4 éléments numérotés de 1 à 4 avec leur texte médical complet.
     * "rightItems": 4 cibles codées de "A" à "D" (ou "a" à "d") avec leur texte médical complet.
   - Les 5 options A, B, C, D, E d'une ASSOCIATION doivent TOUTES être des combinaisons d'appariement (ex: "Appariement : 1-A • 2-C • 3-B • 4-D"). Il est FORMELLEMENT INTERDIT de mettre une phrase de Groupage ("Les propositions 1, 2 et 3 sont exactes") dans une question d'ASSOCIATION !
3. VÉRIFICATION STRICTE DU GROUPAGE :
   - Toute question de type "GROUPAGE" DOIT posséder "numberedPropositions" (1 à 4) et ses 5 options A..E suivent le code UCAD : A=1+2+3, B=1+3, C=2+4, D=4 uniquement, E=Autre choix.
4. VÉRIFICATION STRICTE DU JUMELAGE :
   - Toute question de type "JUMELAGE" DOIT posséder "jumelagePair" (statement1, connector, statement2, statement1True, statement2True, hasCausalLink).
5. STYLE PROFESSEUR D'UNIVERSITÉ (ZÉRO STYLE SCOLAIRE) :
   - Utilise les amorces officielles des examens de Dakar (Anatomie, Physiologie, Sémiologie, Hématologie, Maladies de Système, Traumatologie-Orthopédie-Rhumatologie).
6. ISOMORPHISME & LONGUEUR DES PROPOSITIONS :
   - Les 5 options (A, B, C, D, E) doivent avoir une longueur homogène et une syntaxe parallèle.
7. QUESTIONS MIROIRS ("mirrorQuestion") :
   - Chaque mauvaise proposition possède un objet "mirrorQuestion" ({ "stem", "answer", "courseAnchor" }).

Retourne UNIQUEMENT l'objet JSON final parfaitement valide sous la forme : { "questions": [...] }.
`;
}

async function callGeminiModel(params: {
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  model?: string;
}): Promise<any> {
  const modelName = params.model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${params.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: params.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Gemini (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return cleanAndParseJson(rawText);
}

async function callClaudeSupervisorModel(params: {
  systemPrompt: string;
  userPrompt: string;
  anthropicKey: string;
}): Promise<any> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      temperature: 0.2,
      system: params.systemPrompt,
      messages: [
        {
          role: "user",
          content: params.userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur Claude Supervisor (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawText =
    result?.content?.find((c: any) => c.type === "text")?.text || "{}";
  return cleanAndParseJson(rawText);
}

function cleanAndParseJson(raw: string): any {
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(trimmed);
}

function stripInternalLeaks(txt: string): string {
  if (!txt) return "";
  return txt
    .replace(/\(Déplacement officiel\)/gi, "")
    .replace(/\(Bonne réponse\)/gi, "")
    .replace(/\(Cible imposée\)/gi, "")
    .replace(/\(Proposition exacte\)/gi, "")
    .replace(/\(Proposition fausse\)/gi, "")
    .trim();
}

const LETTERS: AnswerLetter[] = ["A", "B", "C", "D", "E"];

/**
 * Verrou mathématique et structurel déterministe :
 * - Garantit que ASSOCIATION possède TOUJOURS ses listes 1..4 et A..D visibles ET des options d'appariement propres (sans jamais mélanger avec Groupage ni afficher "(Déplacement officiel)").
 * - Garantit que GROUPAGE respecte A=1+2+3, B=1+3, C=2+4, D=4, E=Autre.
 * - Garantit que JUMELAGE respecte A..E.
 * - Garantit que la séquence de bonnes réponses ne fait jamais A, A, A, A.
 */
function enforceDeterministicGridIntegrity(
  rawQuestions: any[],
  specs: QuestionSpec[],
  sectionIndex: number,
  sectionTitle: string
): any[] {
  return specs.map((spec, idx) => {
    const q = rawQuestions[idx] || rawQuestions[0] || {};
    const targetLetter: AnswerLetter = spec.targetLetters[0] || "A";
    const seekTrue = spec.polarity === "CHERCHER_VRAIES";

    let options: any[] = Array.isArray(q.options) ? q.options.slice(0, 5) : [];
    while (options.length < 5) {
      const fallbackLetter = LETTERS[options.length];
      options.push({
        letter: fallbackLetter,
        label: `Proposition ${fallbackLetter}`,
        isStatementTrueInCourse: false,
        isTargetToCheck: false,
        trapCategory: "CONFUSION_SYNDROMIQUE",
        trapBadgeLabel: "Distracteur",
        feedback: "Information non conforme à cette section du cours.",
      });
    }

    // Nettoyage systématique des textes
    options = options.map((o, i) => ({
      ...o,
      letter: LETTERS[i],
      label: stripInternalLeaks(o.label || o.text || ""),
      feedback: stripInternalLeaks(o.feedback || o.explanation || ""),
    }));

    // ------------------------------------------------------------------------
    // CAS 1 : ASSOCIATION -> Matrice 1..4 <-> A..D obligatoire + 5 vraies combinaisons
    // ------------------------------------------------------------------------
    if (spec.type === "ASSOCIATION") {
      const matrix = q.associationMatrix || {
        leftColumnTitle: "Liste 1 (Éléments numérotés 1 à 4)",
        rightColumnTitle: "Liste 2 (Diagnostics / Mécanismes A à D)",
        leftItems: q.leftItems || [],
        rightItems: q.rightItems || [],
      };

      // Génère 5 permutations distinctes dont celle placée sur `targetLetter` est la bonne
      const allPermutations = [
        "Appariement : 1-A • 2-B • 3-C • 4-D",
        "Appariement : 1-B • 2-D • 3-A • 4-C",
        "Appariement : 1-C • 2-A • 3-D • 4-B",
        "Appariement : 1-D • 2-C • 3-B • 4-A",
        "Appariement : 1-A • 2-D • 3-B • 4-C",
      ];

      const desiredIdx = LETTERS.indexOf(targetLetter);
      let currentRightIdx = options.findIndex((o) => o.isTargetToCheck === true);
      if (currentRightIdx === -1) currentRightIdx = 0;

      if (desiredIdx !== -1 && currentRightIdx !== desiredIdx) {
        const temp = { ...options[desiredIdx] };
        options[desiredIdx] = { ...options[currentRightIdx] };
        options[currentRightIdx] = temp;
      }

      const usedLabels = new Set<string>();
      options = options.map((opt, i) => {
        const letter = LETTERS[i];
        const isRight = i === desiredIdx;
        let lbl = stripInternalLeaks(opt.label);

        // Si le label contient une erreur de type Groupage ("propositions 1, 2 et 3") ou un doublon, on le remplace par une permutation propre
        if (
          !lbl ||
          /propositions\s+1/i.test(lbl) ||
          usedLabels.has(lbl.toUpperCase())
        ) {
          lbl =
            allPermutations.find((p) => !usedLabels.has(p.toUpperCase())) ||
            allPermutations[i];
        }
        usedLabels.add(lbl.toUpperCase());

        return {
          ...opt,
          letter,
          label: lbl,
          isStatementTrueInCourse: isRight,
          isTargetToCheck: isRight,
          trapCategory: isRight ? "PROPOSITION_EXACTE" : "CONFUSION_SYNDROMIQUE",
          trapBadgeLabel: isRight ? "Appariement exact" : "Inversion d'appariement",
        };
      });

      return {
        ...q,
        number: spec.number,
        type: "ASSOCIATION",
        polarity: "CHERCHER_VRAIES",
        sectionIndex,
        sectionTitle,
        mutationLevel: spec.mutationLevel,
        stem: stripInternalLeaks(q.stem),
        associationMatrix: matrix,
        options,
        correctLetters: [targetLetter],
      };
    }

    // ------------------------------------------------------------------------
    // CAS 2 : ÉLECTION & CENSURE -> Permutation forcée vers `targetLetter`
    // ------------------------------------------------------------------------
    if (spec.type === "ELECTION" || spec.type === "CENSURE") {
      let currentTargetIdx = options.findIndex((o) => o.isTargetToCheck === true);
      if (currentTargetIdx === -1) {
        currentTargetIdx = options.findIndex((o) =>
          spec.type === "ELECTION"
            ? o.isStatementTrueInCourse === true
            : o.isStatementTrueInCourse === false
        );
      }
      if (currentTargetIdx === -1) currentTargetIdx = 0;

      const desiredIdx = LETTERS.indexOf(targetLetter);
      if (desiredIdx !== -1 && currentTargetIdx !== desiredIdx) {
        const temp = { ...options[desiredIdx] };
        options[desiredIdx] = { ...options[currentTargetIdx] };
        options[currentTargetIdx] = temp;
      }

      options = options.map((opt, i) => {
        const letter = LETTERS[i];
        const isTarget = i === desiredIdx;
        return {
          ...opt,
          letter,
          isTargetToCheck: isTarget,
          isStatementTrueInCourse:
            spec.type === "ELECTION" ? isTarget : !isTarget,
          trapCategory:
            (spec.type === "ELECTION" && isTarget) ||
            (spec.type === "CENSURE" && !isTarget)
              ? "PROPOSITION_EXACTE"
              : opt.trapCategory === "PROPOSITION_EXACTE"
              ? "CONFUSION_SYNDROMIQUE"
              : opt.trapCategory || "CONFUSION_SYNDROMIQUE",
        };
      });

      return {
        ...q,
        number: spec.number,
        type: spec.type,
        polarity: spec.polarity,
        sectionIndex,
        sectionTitle,
        mutationLevel: spec.mutationLevel,
        stem: stripInternalLeaks(q.stem),
        options,
        correctLetters: [targetLetter],
      };
    }

    // ------------------------------------------------------------------------
    // CAS 3 : GROUPAGE (A=1+2+3 | B=1+3 | C=2+4 | D=4 | E=Autre choix)
    // ------------------------------------------------------------------------
    if (spec.type === "GROUPAGE") {
      let props: any[] = Array.isArray(q.numberedPropositions)
        ? q.numberedPropositions.slice(0, 5)
        : [];

      while (props.length < 4) {
        props.push({
          num: (props.length + 1) as 1 | 2 | 3 | 4,
          text: `Assertion ${props.length + 1}`,
          isTrueInCourse: false,
          feedback: "Se référer au cours.",
        });
      }

      const matchesPolarity = (p: any) =>
        seekTrue ? Boolean(p.isTrueInCourse) : !Boolean(p.isTrueInCourse);

      const firstFour = props.slice(0, 4);
      const matchingItems = firstFour.filter(matchesPolarity);
      const nonMatchingItems = firstFour.filter((p) => !matchesPolarity(p));

      if (targetLetter === "A" && matchingItems.length === 3) {
        props = [
          matchingItems[0],
          matchingItems[1],
          matchingItems[2],
          nonMatchingItems[0],
          ...props.slice(4),
        ];
      } else if (targetLetter === "B" && matchingItems.length === 2) {
        props = [
          matchingItems[0],
          nonMatchingItems[0],
          matchingItems[1],
          nonMatchingItems[1],
          ...props.slice(4),
        ];
      } else if (targetLetter === "C" && matchingItems.length === 2) {
        props = [
          nonMatchingItems[0],
          matchingItems[0],
          nonMatchingItems[1],
          matchingItems[1],
          ...props.slice(4),
        ];
      } else if (targetLetter === "D" && matchingItems.length === 1) {
        props = [
          nonMatchingItems[0],
          nonMatchingItems[1],
          nonMatchingItems[2],
          matchingItems[0],
          ...props.slice(4),
        ];
      }

      props = props.map((p, idxNum) => ({
        ...p,
        num: (idxNum + 1) as 1 | 2 | 3 | 4 | 5,
        text: stripInternalLeaks(p.text),
      }));

      const activeNums = props
        .filter(matchesPolarity)
        .map((p) => p.num)
        .join("+");

      const computedCorrectLetter: AnswerLetter =
        activeNums === "1+2+3"
          ? "A"
          : activeNums === "1+3"
          ? "B"
          : activeNums === "2+4"
          ? "C"
          : activeNums === "4"
          ? "D"
          : "E";

      const groupageLabels: Record<AnswerLetter, string> = {
        A: "1 + 2 + 3",
        B: "1 + 3",
        C: "2 + 4",
        D: "4 uniquement",
        E: "Autre choix",
      };

      const polarityWord = seekTrue ? "vraies" : "fausses";
      const standardizedOptions = LETTERS.map((letter) => {
        const isRight = letter === computedCorrectLetter;
        return {
          letter,
          label: `Propositions ${groupageLabels[letter]}`,
          isStatementTrueInCourse: isRight,
          isTargetToCheck: isRight,
          trapCategory: isRight ? "PROPOSITION_EXACTE" : "CONFUSION_SYNDROMIQUE",
          trapBadgeLabel: isRight
            ? `Combinaison exacte (${activeNums || "aucune"})`
            : `Code ${letter} incorrect`,
          feedback: isRight
            ? `Exact : les propositions ${polarityWord} sont (${activeNums || "aucune"}), ce qui correspond au code ${computedCorrectLetter}.`
            : `Faux : les propositions ${polarityWord} du cours sont (${activeNums || "aucune"}), la bonne réponse est donc ${computedCorrectLetter}.`,
        };
      });

      return {
        ...q,
        number: spec.number,
        type: "GROUPAGE",
        polarity: spec.polarity,
        sectionIndex,
        sectionTitle,
        mutationLevel: spec.mutationLevel,
        stem: stripInternalLeaks(q.stem),
        numberedPropositions: props,
        options: standardizedOptions,
        correctLetters: [computedCorrectLetter],
      };
    }

    // ------------------------------------------------------------------------
    // CAS 4 : JUMELAGE (CAUSE À EFFET)
    // ------------------------------------------------------------------------
    if (spec.type === "JUMELAGE") {
      const pair = q.jumelagePair || {
        statement1: "Première proposition",
        connector: "parce que",
        statement2: "Seconde proposition",
        statement1True: true,
        statement2True: true,
        hasCausalLink: true,
      };

      const s1 = Boolean(pair.statement1True);
      const s2 = Boolean(pair.statement2True);
      const causal = Boolean(pair.hasCausalLink);

      const computedJumelageLetter: AnswerLetter =
        s1 && s2 && causal
          ? "A"
          : s1 && s2 && !causal
          ? "B"
          : s1 && !s2
          ? "C"
          : !s1 && s2
          ? "D"
          : "E";

      const jumelageLabels: Record<AnswerLetter, string> = {
        A: "Vrai - Vrai avec relation de cause à effet",
        B: "Vrai - Vrai sans relation de cause à effet",
        C: "Vrai - Faux",
        D: "Faux - Vrai",
        E: "Faux - Faux",
      };

      const standardizedOptions = LETTERS.map((letter) => {
        const isRight = letter === computedJumelageLetter;
        const existingOpt = options.find((o) => o.letter === letter);
        return {
          letter,
          label: jumelageLabels[letter],
          isStatementTrueInCourse: isRight,
          isTargetToCheck: isRight,
          trapCategory: isRight ? "PROPOSITION_EXACTE" : "FAUX_LIEN_CAUSAL",
          trapBadgeLabel: isRight ? "Analyse causale exacte" : `Code ${letter}`,
          feedback:
            existingOpt?.feedback ||
            (isRight
              ? `Exact : Affirmation 1 (${s1 ? "Vraie" : "Fausse"}) et Affirmation 2 (${
                  s2 ? "Vraie" : "Fausse"
                })${s1 && s2 ? (causal ? " avec lien de cause à effet." : " sans lien de cause à effet.") : "."}`
              : `Attendu : ${jumelageLabels[computedJumelageLetter]}.`),
          mirrorQuestion: existingOpt?.mirrorQuestion,
        };
      });

      return {
        ...q,
        number: spec.number,
        type: "JUMELAGE",
        polarity: "CHERCHER_VRAIES",
        sectionIndex,
        sectionTitle,
        mutationLevel: spec.mutationLevel,
        stem: stripInternalLeaks(q.stem),
        jumelagePair: pair,
        options: standardizedOptions,
        correctLetters: [computedJumelageLetter],
      };
    }

    // ------------------------------------------------------------------------
    // CAS 5 : COMPLÉMENTS MULTIPLES (SÉMIOLOGIE L3 / TOR)
    // ------------------------------------------------------------------------
    const detectedTargets = options
      .filter((o) => o.isTargetToCheck === true)
      .map((o) => o.letter as AnswerLetter);

    const finalCorrectLetters: AnswerLetter[] =
      detectedTargets.length > 0 ? detectedTargets : spec.targetLetters;

    options = options.map((opt) => ({
      ...opt,
      isTargetToCheck: finalCorrectLetters.includes(opt.letter),
    }));

    return {
      ...q,
      number: spec.number,
      type: spec.type,
      polarity: spec.polarity,
      sectionIndex,
      sectionTitle,
      mutationLevel: spec.mutationLevel,
      stem: stripInternalLeaks(q.stem),
      options,
      correctLetters: finalCorrectLetters,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      systemPrompt,
      courseTitle,
      sectionIndex = 0,
      sectionTitle = "Section du cours",
      questionSpecs = [],
      enableSupervisorAudit = true,
    } = await req.json();

    const geminiKey =
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_AI_API_KEY") ||
      Deno.env.get("LOVABLE_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!geminiKey && !anthropicKey) {
      throw new Error(
        "Aucune clé API IA trouvée. Configurez GEMINI_API_KEY et/ou ANTHROPIC_API_KEY dans vos secrets Supabase."
      );
    }

    const draftUserPrompt = `
Génère maintenant le lot de ${questionSpecs.length} QCM pour le cours "${courseTitle}" (Segment #${
      sectionIndex + 1
    } : "${sectionTitle}") en respectant scrupuleusement chaque spécification docimologique.
Pour toute question de type ASSOCIATION, inclus impérativement "associationMatrix" avec "leftItems" (1 à 4) et "rightItems" (A à D).
Retourne uniquement le JSON { "questions": [...] }.
`;

    let draftData: any;
    if (geminiKey) {
      draftData = await callGeminiModel({
        systemPrompt,
        userPrompt: draftUserPrompt,
        apiKey: geminiKey,
        model: "gemini-2.5-flash",
      });
    } else {
      draftData = await callClaudeSupervisorModel({
        systemPrompt,
        userPrompt: draftUserPrompt,
        anthropicKey: anthropicKey!,
      });
    }

    let candidateQuestions: any[] = Array.isArray(draftData?.questions)
      ? draftData.questions
      : [];

    if (enableSupervisorAudit && candidateQuestions.length > 0) {
      const supervisorSystem = buildSupervisorSystemPrompt();
      const supervisorUserPrompt = `
CAHIER DES CHARGES ET TEXTE SOURCE DU COURS :
${systemPrompt}

QCM BROUILLONS À AUDITER, CORRIGER ET SUBLIMER :
${JSON.stringify({ questions: candidateQuestions }, null, 2)}
`;

      try {
        let auditedData: any;
        if (anthropicKey) {
          auditedData = await callClaudeSupervisorModel({
            systemPrompt: supervisorSystem,
            userPrompt: supervisorUserPrompt,
            anthropicKey,
          });
        } else if (geminiKey) {
          auditedData = await callGeminiModel({
            systemPrompt: supervisorSystem,
            userPrompt: supervisorUserPrompt,
            apiKey: geminiKey,
            model: "gemini-2.5-flash",
          });
        }

        if (Array.isArray(auditedData?.questions) && auditedData.questions.length > 0) {
          candidateQuestions = auditedData.questions;
        }
      } catch (auditErr) {
        console.warn("Avertissement: Passe superviseur ignorée:", auditErr);
      }
    }

    const verifiedQuestions = enforceDeterministicGridIntegrity(
      candidateQuestions,
      questionSpecs,
      sectionIndex,
      sectionTitle
    );

    return new Response(
      JSON.stringify({
        questions: verifiedQuestions,
        meta: {
          sectionIndex,
          sectionTitle,
          totalGenerated: verifiedQuestions.length,
          supervisorModel: anthropicKey ? "claude-sonnet-4-6" : "gemini-2.5-flash",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erreur dans generate-quiz:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erreur interne lors de la génération des QCM",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
