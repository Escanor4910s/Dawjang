import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { extractCompletionText, logDiagnostic } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UploadedExamFile {
  fileName: string;
  content: string;
}

interface GeneratedQuestion {
  question: string;
  choices: string[];
  correct: number[];
  explanation: string;
  category?: string;
  lockOrder?: boolean;
  lockChoices?: boolean;
}

const LABELS_MAP: Record<string, string> = {
  election: "ÉLECTION (1 seule proposition correcte parmi A, B, C, D, E)",
  censure: "CENSURE (1 seule proposition incorrecte/fausse parmi A, B, C, D, E : 'sauf un / laquelle est fausse')",
  groupage: "GROUPAGE (Propositions numérotées avec code optique : A=1+2+3, B=1+3, C=2+4, D=4 seul, E=autre choix)",
  jumelage: "JUMELAGE / CAUSE À EFFET (2 propositions avec code : A=Vrai-Vrai lié, B=Vrai-Vrai non lié, C=Vrai-Faux, D=Faux-Vrai, E=Faux-Faux)",
  association: "ASSOCIATION (Appariement d'éléments anatomiques/physiologiques avec les lettres A, B, C, D, E)",
  "cas-cliniques": "CAS CLINIQUES ÉVOLUTIFS (Vignette clinique avec questions en cascade)",
  "complements-multiples": "COMPLÉMENTS MULTIPLES (5 propositions A-E, 1 à 5 réponses exactes)",
};

/**
 * Algorithme Anti-Séquence Répétitive (interdit A, A, A, A ou B, B, B, B...)
 * - Pour les questions dont les 5 propositions sont permutables (Élection, Censure),
 *   déplace automatiquement la bonne réponse vers un autre index (0..4) dès qu'une même lettre
 *   apparaît plus de 2 fois de suite ou domine trop le sujet.
 */
function rebalanceAnswerDistribution(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const letterCounts = [0, 0, 0, 0, 0];
  let prevLetter = -1;
  let streak = 0;

  return questions.map((q, qIdx) => {
    if (!Array.isArray(q.choices) || q.choices.length !== 5 || !Array.isArray(q.correct) || q.correct.length !== 1) {
      return q;
    }

    const currentAns = q.correct[0];
    if (currentAns < 0 || currentAns > 4) return q;

    const qUpper = q.question.toUpperCase();
    const isFixedCodeGrid =
      qUpper.includes("[GROUPAGE") ||
      qUpper.includes("[JUMELAGE") ||
      qUpper.includes("[CAUSE") ||
      qUpper.includes("[ASSOCIATION") ||
      q.choices[0].startsWith("A (") ||
      q.choices[0] === "A";

    const isStreakTooLong = currentAns === prevLetter && streak >= 2;
    const isOverrepresented = letterCounts[currentAns] > Math.ceil(questions.length / 5) + 1;

    // Si les choix sont des propositions de texte (Élection ou Censure) et qu'on a une répétition (ex: A, A, A)
    if (!isFixedCodeGrid && (isStreakTooLong || isOverrepresented)) {
      // Trouver la lettre (0..4) la moins utilisée qui soit différente de prevLetter
      let bestTarget = (currentAns + (qIdx % 4) + 1) % 5;
      let minUse = 999;
      for (let candidate = 0; candidate < 5; candidate++) {
        if (candidate !== prevLetter && letterCounts[candidate] < minUse) {
          minUse = letterCounts[candidate];
          bestTarget = candidate;
        }
      }

      if (bestTarget !== currentAns) {
        const newChoices = [...q.choices];
        // Nettoyer d'éventuels préfixes "A- " ou "A. " avant d'échanger
        const stripPrefix = (s: string) => s.replace(/^[A-E][\-\.\)]\s*/i, "").trim();
        const cleanedChoices = newChoices.map(stripPrefix);

        const temp = cleanedChoices[currentAns];
        cleanedChoices[currentAns] = cleanedChoices[bestTarget];
        cleanedChoices[bestTarget] = temp;

        prevLetter = bestTarget;
        streak = 1;
        letterCounts[bestTarget]++;

        return {
          ...q,
          choices: cleanedChoices,
          correct: [bestTarget],
        };
      }
    }

    if (currentAns === prevLetter) {
      streak++;
    } else {
      prevLetter = currentAns;
      streak = 1;
    }
    letterCounts[currentAns]++;
    return q;
  });
}

async function callQuizAI(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  preferSonnet?: boolean;
}): Promise<string> {
  const { systemPrompt, userPrompt, maxTokens, temperature, preferSonnet = true } = params;

  if (ANTHROPIC_API_KEY && preferSonnet) {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      throw new Error(`Erreur API Claude Sonnet (${anthropicRes.status})`);
    }

    const anthropicData = await anthropicRes.json();
    const textBlock = anthropicData?.content?.find((b: any) => b.type === "text");
    return textBlock?.text || "";
  }

  if (!LOVABLE_API_KEY) {
    throw new Error("Configuration API manquante (LOVABLE_API_KEY ou ANTHROPIC_API_KEY)");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", response.status, errorText);
    throw new Error(`Erreur API IA (${response.status})`);
  }

  const data = await response.json();
  return extractCompletionText(data);
}

function parseJSONQuestions(rawText: string): GeneratedQuestion[] {
  if (!rawText) return [];
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];

  const valid = parsed
    .filter(
      (q: any) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.choices) &&
        q.choices.length >= 2 &&
        Array.isArray(q.correct) &&
        q.correct.length > 0
    )
    .map((q: any) => ({
      question: q.question.trim(),
      choices: q.choices.map((c: any) => String(c).trim()),
      correct: q.correct.map((idx: any) => Number(idx)).filter((n: number) => !isNaN(n)),
      explanation: String(q.explanation || "Réponse issue directement du support de cours.").trim(),
      category: q.category ? String(q.category) : undefined,
      lockOrder: Boolean(q.lockOrder ?? true),
      lockChoices: Boolean(q.lockChoices ?? true),
    }));

  return rebalanceAnswerDistribution(valid);
}

/**
 * Récupère en base de données TOUTES les questions déjà générées pour cet utilisateur sur ce cours
 * (Y COMPRIS les sessions supprimées par l'utilisateur dont le statut est passé à 'deleted_memory')
 */
async function fetchPastQuestionsMemory(
  userId: string,
  courseTitle: string,
  clientPastQuestions: string[] = []
): Promise<string[]> {
  const memorySet = new Set<string>(clientPastQuestions.filter(Boolean));
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const cleanBaseTitle = courseTitle
      .replace(/\s*\(Session\s*\d+\)\s*$/i, "")
      .trim()
      .slice(0, 35);

    let query = supabase
      .from("qcm_sessions")
      .select("title, questions, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    if (cleanBaseTitle.length >= 4) {
      query = query.ilike("title", `%${cleanBaseTitle}%`);
    }

    const { data: sessions } = await query;
    if (Array.isArray(sessions)) {
      for (const s of sessions) {
        if (Array.isArray(s.questions)) {
          for (const q of s.questions) {
            if (q && typeof q.question === "string") {
              memorySet.add(q.question.replace(/\s+/g, " ").trim().slice(0, 160));
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[fetchPastQuestionsMemory] warning:", e);
  }
  return Array.from(memorySet).slice(0, 80);
}

// Prompts des modes classiques existants
function getClassicSystemPrompt(difficulty: string): string {
  const baseFormat = `Tu es un expert en génération de QCM médicaux de niveau universitaire. Tu dois IMPÉRATIVEMENT répondre UNIQUEMENT avec un array JSON valide, sans aucun texte avant ou après.
INTERDICTION DES SUITES DE MÊME LETTRE : Varie impérativement la position de la bonne réponse (A, B, C, D, E). Ne mets JAMAIS plus de 2 fois de suite la même lettre correcte.`;

  if (difficulty === "facile") {
    return `${baseFormat}\nNIVEAU FACILE: UNE SEULE bonne réponse par question, formulation directe basée sur le cours.`;
  }
  if (difficulty === "intermediaire") {
    return `${baseFormat}\nNIVEAU INTERMÉDIAIRE: 1 à 5 bonnes réponses possibles, reformulation intelligente.`;
  }
  return `${baseFormat}\nNIVEAU DIFFICILE: Raisonnement clinique avancé, 1 à 5 bonnes réponses possibles.`;
}

function getClassicTypePrompt(type: string, nbQuestions: number, content: string): string {
  if (type === "groupage") {
    return `Génère exactement ${nbQuestions} QCM de type GROUPAGE.
- Les "choices" doivent être EXACTEMENT: ["A", "B", "C", "D", "E"]
- Le barème est: A=1+2+3 vraies, B=1+3 vraies, C=2+4 vraies, D=4 uniquement, E=autre combinaison.
- Varie les bonnes lettres (A, B, C, D, E) d'une question à l'autre !
Cours médical:\n${content}`;
  }
  if (type === "election") {
    return `Génère exactement ${nbQuestions} QCM de type ÉLECTION (1 seule bonne réponse parmi 5 propositions A-E).\nCours médical:\n${content}`;
  }
  if (type === "censure") {
    return `Génère exactement ${nbQuestions} QCM de type CENSURE (1 seule proposition FAUSSE à identifier parmi 5 propositions A-E).\nCours médical:\n${content}`;
  }
  if (type === "cas-cliniques") {
    return `Génère exactement ${nbQuestions} QCM basés sur des CAS CLINIQUES.\nCours médical:\n${content}`;
  }
  if (type === "vrai-faux") {
    return `Génère exactement ${nbQuestions} QCM VRAI/FAUX (choices: ["Vrai", "Faux"]).\nCours médical:\n${content}`;
  }
  return `Génère exactement ${nbQuestions} QCM CLASSIQUES (5 choix A-E, 1 à 5 bonnes réponses).\nCours médical:\n${content}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userInfo = await getUserPlanInfo(req);
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      content,
      nbQuestions = 20,
      type = "classique",
      difficulty = "intermediaire",
      examFiles = [],
      courseTitle = "",
      selectedCustomTypes = [],
      pastQuestionsMemory = [],
    } = (await req.json()) as {
      content: string;
      nbQuestions?: number;
      type?: string;
      difficulty?: string;
      examFiles?: UploadedExamFile[];
      courseTitle?: string;
      selectedCustomTypes?: string[];
      pastQuestionsMemory?: string[];
    };

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Le contenu du cours est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetCount = Math.min(Math.max(Number(nbQuestions) || 20, 1), 50);

    // Récupérer la mémoire permanente des questions déjà posées (même supprimées)
    const previousQuestions = await fetchPastQuestionsMemory(
      userInfo.userId,
      courseTitle,
      pastQuestionsMemory
    );

    const memoryInstructionBlock =
      previousQuestions.length > 0
        ? `\n=== MÉMOIRE PERMANENTE DES QCM DÉJÀ GÉNÉRÉS (MÊME SUPPRIMÉS) — INTERDICTION DE RÉPÉTER ===
Voici les ${previousQuestions.length} questions déjà posées lors des sessions précédentes sur ce cours :
${previousQuestions.map((q, idx) => `${idx + 1}. ${q}`).join("\n")}

RÈGLE DE RÉGÉNÉRATION INFINIE :
- Tu ne dois JAMAIS reposer la même question mot pour mot.
- Si tu interroges une notion déjà abordée ci-dessus, tu DOIS la transformer : change de format (ex: transforme une Élection en Censure, en Groupage ou en Jumelage), inverse l'angle du piège, change les valeurs chiffrées ou interroge d'autres détails du cours encore inexplorés.\n`
        : "";

    // =========================================================================
    // MODE CLONAGE DOCIMOLOGIQUE D'EXAMEN OFFICIEL ("clonage_examen")
    // =========================================================================
    if (type === "clonage_examen") {
      const validExams = Array.isArray(examFiles)
        ? examFiles.filter((ef) => ef && ef.content && ef.content.trim().length > 20)
        : [];

      const hasCustomTypes =
        Array.isArray(selectedCustomTypes) && selectedCustomTypes.length > 0;

      const customTypesDirective = hasCustomTypes
        ? `CHOIX SPÉCIFIQUE DE L'ÉTUDIANT SUR LES TYPES DE QCM :
L'étudiant a explicitement demandé que son épreuve de ${targetCount} QCM soit composée UNIQUEMENT du (ou des) type(s) suivant(s) :
${selectedCustomTypes.map((t) => `- ${LABELS_MAP[t] || t.toUpperCase()}`).join("\n")}
Répartis équitablement les ${targetCount} questions entre ces types sélectionnés, tout en gardant 100% du niveau, de la syntaxe et du style de pièges des annales du professeur !`
        : `RÉPARTITION AUTOMATIQUE CALQUÉE SUR LES ANNALES :
Reproduis exactement les types de QCM (Élection, Censure, Groupage, Jumelage/Cause à effet, Association, Cas cliniques, Compléments multiples) et leur ordre d'apparition tels que le professeur les utilise dans les épreuves d'annales fournies.`;

      // PASSE 1 : Extraction de l'ADN Docimologique des annales uploadées
      let docimologicalBlueprint = `Style officiel UCAD : questions incisives, niveau d'exigence élevé mais 100% borné au cours.`;

      if (validExams.length > 0) {
        const compiledExams = validExams
          .map(
            (ef, i) =>
              `=== ÉPREUVE OFFICIELLE N°${i + 1} (${ef.fileName}) ===\n${ef.content.substring(0, 18000)}`
          )
          .join("\n\n");

        const dnaSystemPrompt = `Tu es un expert en docimologie médicale universitaire (UCAD).
Analyse à la loupe les épreuves d'examens officielles fournies pour voler et modéliser à 100% le style, la syntaxe, le niveau et la mécanique des pièges du professeur :
1. ARCHITECTURE DE L'ÉPREUVE (Blocs fixes Élection/Censure/Groupage/Jumelage/Association, ou Cas cliniques en cascade, ou panachage Physiologie).
2. SYNTAXE MOT POUR MOT DES AMORCES DU PROFESSEUR ("A propos de..., une seule proposition est correcte. Laquelle ?", "Tous ces éléments s'appliquent à... sauf un. Lequel ?", etc.).
3. MÉCANIQUE DES PIÈGES DU PROFESSEUR (inversion gauche/droite, antérieur/postérieur, échange d'hormones/nerfs, mot exclusif "uniquement/toujours", projections vertébrales).`;

        const dnaUserPrompt = `COURS CIBLÉ : ${courseTitle || "Cours médical"}

ÉPREUVES OFFICIELLES UPLOADÉES (${validExams.length}) :
${compiledExams}

Extrais la MATRICE DE CLONAGE DOCIMOLOGIQUE complète de ce professeur.`;

        docimologicalBlueprint = await callQuizAI({
          systemPrompt: dnaSystemPrompt,
          userPrompt: dnaUserPrompt,
          maxTokens: 2500,
          temperature: 0.1,
          preferSonnet: false,
        });
      }

      // PASSE 2 : Génération des QCM par le "Cerveau du Professeur"
      const cloneSystemPrompt = `Tu es LE PROFESSEUR titulaire de la chaire universitaire qui a rédigé les épreuves d'annales analysées.
Tu dois concevoir une épreuve officielle de **${targetCount} QCM** en défilement continu.

LES 6 LOIS ABSOLUES DU CLONAGE DOCIMOLOGIQUE :
1. FRONTIÈRE STRICTE DU COURS (ZÉRO HORS-SUJET) :
   - 100% des faits médicaux/anatomiques/physiologiques et 100% des bonnes réponses DOIVENT provenir EXCLUSIVEMENT du texte du cours fourni.
2. NIVEAU CALIBRÉ SUR LES ANNALES :
   - Le niveau de difficulté est directement calculé sur la subtilité des annales fournies.
3. ${customTypesDirective}
4. INTERDICTION FORMELLE DES SUITES DE MÊME LETTRE (ANTI A-A-A-A / B-B-B-B) :
   - Il est STRICTEMENT INTERDIT d'avoir plus de 2 questions consécutives ayant la même lettre de réponse (ex: jamais A, A, A ou B, B, B, B ou C, C, C).
   - Panache constamment la position de la bonne réponse (ex: B, D, A, A, E, C, B, D, C, A...) aussi bien dans les Élections/Censures que dans les Groupages (varie entre A=1+2+3, B=1+3, C=2+4, D=4 seul, E=autre) et les Jumelages (varie entre A, B, C, D, E) !
5. FORMATAGE EXACT DES TYPES DE QCM DANS LE JSON :
   - Indique toujours en début d'énoncé de chaque ` + "`question`" + ` le badge du type officiel entre crochets :
     • ` + "`[ÉLECTION] ...`" + ` -> 5 propositions dans ` + "`choices`" + `, 1 seul index dans ` + "`correct`" + `.
     • ` + "`[CENSURE] ...`" + ` -> 5 propositions dans ` + "`choices`" + `, 1 seul index (la proposition fausse) dans ` + "`correct`" + `.
     • ` + "`[GROUPAGE] Énoncé...\\n1- ...\\n2- ...\\n3- ...\\n4- ...\\n(Code : A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autre choix)`" + ` -> ` + "`choices`" + ` DOIT être ` + `["A (1+2+3)", "B (1+3)", "C (2+4)", "D (4 seul)", "E (Autre choix)"]` + `.
     • ` + "`[JUMELAGE] Proposition 1...\\nPARCE QUE (ou ET)\\nProposition 2...`" + ` -> ` + "`choices`" + ` DOIT être ` + `["A (Vrai-Vrai avec relation de cause à effet)", "B (Vrai-Vrai sans relation de cause à effet)", "C (Vrai-Faux)", "D (Faux-Vrai)", "E (Faux-Faux)"]` + `.
     • ` + "`[ASSOCIATION] ...`" + ` -> 5 propositions dans ` + "`choices`" + `.
     • ` + "`[COMPLÉMENTS MULTIPLES] ...`" + ` -> 5 propositions dans ` + "`choices`" + `, 1 à 5 index dans ` + "`correct`" + `.
6. ${memoryInstructionBlock}

FORMAT DE SORTIE OBLIGATOIRE (UNIQUEMENT UN TABLEAU JSON VALIDE, AUCUN TEXTE HORS DU JSON) :
[
  {
    "question": "[TYPE] Énoncé complet...",
    "choices": ["Proposition A", "Proposition B", "Proposition C", "Proposition D", "Proposition E"],
    "correct": [2],
    "explanation": "Correction détaillée basée sur le cours...",
    "lockOrder": true,
    "lockChoices": true
  }
]`;

      const cloneUserPrompt = `TITRE DU COURS : ${courseTitle || "Cours médical"}
NOMBRE EXACT DE QCM À GÉNÉRER : ${targetCount} QCM

=== MATRICE DE CLONAGE DOCIMOLOGIQUE EXTRAITE DES ANNALES DU PROFESSEUR ===
${docimologicalBlueprint}

=== CONTENU INTÉGRAL DU COURS (SOURCE EXCLUSIVE DES DONNÉES ET RÉPONSES) ===
${content.substring(0, 42000)}

Génère maintenant le tableau JSON contenant exactement ${targetCount} QCM en veillant à varier les lettres de réponses (jamais de A,A,A,A ni B,B,B,B) et à ne jamais répéter les questions de l'historique.`;

      const rawResponse = await callQuizAI({
        systemPrompt: cloneSystemPrompt,
        userPrompt: cloneUserPrompt,
        maxTokens: 8000,
        temperature: 0.3,
        preferSonnet: true,
      });

      const questions = parseJSONQuestions(rawResponse);
      if (questions.length === 0) {
        throw new Error("Impossible de parser les QCM générés. Veuillez réessayer.");
      }

      return new Response(
        JSON.stringify({
          qcm: questions,
          blueprintSummary: docimologicalBlueprint.slice(0, 500),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // MODES CLASSIQUES EXISTANTS (Avec Mémoire Anti-Doublon + Anti A-A-A-A)
    // =========================================================================
    const systemPrompt = `${getClassicSystemPrompt(difficulty)}\n${memoryInstructionBlock}`;
    const userPrompt = getClassicTypePrompt(type, targetCount, content.substring(0, 28000));

    const rawResponse = await callQuizAI({
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.6,
      preferSonnet: false,
    });

    const questions = parseJSONQuestions(rawResponse);
    if (questions.length === 0) {
      await logDiagnostic({
        function_name: "generate-quiz-openai",
        user_id: userInfo.userId,
        status: 502,
        request_payload: { type, difficulty, nbQuestions: targetCount },
        error: "Empty or invalid JSON questions array",
      });
      return new Response(
        JSON.stringify({ error: "Aucune question valide n'a pu être générée. Réessayez." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ qcm: questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-quiz-openai:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erreur lors de la génération du QCM" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
