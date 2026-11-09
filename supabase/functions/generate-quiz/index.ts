import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OptionLetter = "A" | "B" | "C" | "D" | "E";
const LETTERS: OptionLetter[] = ["A", "B", "C", "D", "E"];
const MAX_QUESTIONS_PER_BATCH = 10;
const MAX_CONCURRENT_BATCHES = 2;

const COGNITIVE_TIER_DIRECTIVES: Record<string, string> = {
  ancrage: `PALIER 1 — ANCRAGE & SÉMIOLOGIE (Fondations & Restitution Croisée) :
- INTERDICTION ABSOLUE de copier-coller une phrase du cours mot pour mot.
- Reformule les définitions, les seuils biologiques, les classifications et les signes cardinaux avec une terminologie médicale exacte.
- Construis des distracteurs crédibles en inversant deux seuils chiffrés voisins du cours, en confondant un signe constant avec un signe inconstant, ou en attribuant une caractéristique à une entité voisine du même chapitre.`,

  mecanismes: `PALIER 2 — MÉCANISMES & CORRÉLATIONS (Physiopathologie & Causalité) :
- Ne pose AUCUNE question de simple définition.
- Chaque question doit exiger de relier une CAUSE à une CONSÉQUENCE présente dans le cours (ex: quel mécanisme physiopathologique explique tel signe clinique, telle complication ou telle anomalie paraclinique ?).
- Construis des distracteurs redoutables : utilise des propositions VRAIES dans le cours mais dont le lien de causalité est inversé ou anachronique.`,

  discernement: `PALIER 3 — DISCERNEMENT & CAS CROISÉS (Synthèse Clinique & Nuances Restrictives) :
- Croise 2 à 3 sous-parties distinctes du cours dans une même question (ex: Terrain + Anomalie paraclinique + Contre-indication ou Traitement).
- Utilise des micro-vignettes cliniques ou biologiques synthétiques basées à 100% sur les éléments du cours.
- Cible les subtilités restrictives du cours (contre-indication absolue vs relative, signe pathognomonique vs fréquent, 1ère intention vs 2nde intention) sans jamais inventer hors-cours.`
};

const DYNAMIC_STEM_ANGLES = [
  "Attaque directe par le phénomène physiopathologique ou sémiologique sans formule scolaire répétitive.",
  "Approche différentielle : oppose deux entités, stades ou formes cliniques du cours pour tester le critère formel de distinction.",
  "Approche déductive : présente une constellation de 2 ou 3 signes/paramètres du cours et demande la conclusion logique qui s'impose.",
  "Approche de hiérarchisation : interroge sur l'élément déterminant, le critère de certitude ou le mécanisme prépondérant décrit dans le texte.",
  "Approche fonctionnelle inversée : part d'un résultat biologique, clinique ou thérapeutique mentionné dans le cours et remonte à sa cause.",
  "Approche de restriction conditionnelle : cible une exception, une condition particulière ou un piège classique explicitement mentionné dans le support."
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cleanOptionPrefix(text: string): string {
  if (!text) return "";
  return String(text).replace(/^[A-E][\s.\-):]+/i, "").trim();
}

/**
 * Mélangeur déterministe Fisher-Yates + Anti-Streak côté serveur :
 * Garantit qu'aucune suite A-A-A ou B-B-B ne puisse jamais sortir.
 */
function rebalanceAndShuffleQuestions(rawQuestions: any[]): any[] {
  const letterHistory: OptionLetter[] = [];
  const letterCounts: Record<OptionLetter, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  return rawQuestions.map((q, idx) => {
    const rawOpts = Array.isArray(q.options) ? q.options.slice(0, 5) : [];
    while (rawOpts.length < 5) {
      rawOpts.push({
        letter: LETTERS[rawOpts.length],
        text: `Proposition complémentaire ${rawOpts.length + 1}`,
        rationale: "Distracteur complémentaire."
      });
    }

    const originalCorrectLetter = String(q.correctLetter || q.correct_answer || "A")
      .trim()
      .toUpperCase()
      .charAt(0) as OptionLetter;

    const correctIndex = LETTERS.indexOf(originalCorrectLetter) !== -1
      ? LETTERS.indexOf(originalCorrectLetter)
      : 0;
    const correctOptionObj = rawOpts[correctIndex] || rawOpts[0];

    const last1 = letterHistory[letterHistory.length - 1];
    const last2 = letterHistory[letterHistory.length - 2];

    const candidateLetters = shuffleArray(LETTERS).filter((letter) => {
      if (last1 && last2 && last1 === last2 && letter === last1) return false;
      if (last1 && letter === last1) return false; // Zéro répétition immédiate quand évitable
      return true;
    });

    candidateLetters.sort((a, b) => letterCounts[a] - letterCounts[b]);
    const targetCorrectLetter = candidateLetters[0] || LETTERS[idx % 5];
    const targetCorrectIdx = LETTERS.indexOf(targetCorrectLetter);

    const distractors = rawOpts.filter((_: any, i: number) => i !== correctIndex);
    const shuffledDistractors = shuffleArray(distractors);

    const finalOptions = [];
    let dPtr = 0;
    for (let i = 0; i < 5; i++) {
      if (i === targetCorrectIdx) {
        finalOptions.push({
          letter: LETTERS[i],
          text: cleanOptionPrefix(correctOptionObj.text || correctOptionObj),
          rationale: correctOptionObj.rationale || "Proposition exacte selon le cours."
        });
      } else {
        const d = shuffledDistractors[dPtr++] || { text: "Proposition inexacte", rationale: "" };
        finalOptions.push({
          letter: LETTERS[i],
          text: cleanOptionPrefix(d.text || d),
          rationale: d.rationale || "Proposition inexacte selon le cours."
        });
      }
    }

    letterHistory.push(targetCorrectLetter);
    letterCounts[targetCorrectLetter]++;

    return {
      ...q,
      id: q.id || `q-${Date.now()}-${idx + 1}`,
      index: idx + 1,
      options: finalOptions,
      correctLetter: targetCorrectLetter,
    };
  });
}

function safeParseQuestionsJson(rawText: string): any[] {
  const cleaned = String(rawText || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const questionsArrayStart = cleaned.indexOf('"questions"');
    const bracketStart = cleaned.indexOf("[", questionsArrayStart !== -1 ? questionsArrayStart : 0);
    if (bracketStart !== -1) {
      const arrayContent = cleaned.slice(bracketStart + 1);
      const salvaged: any[] = [];
      let depth = 0;
      let objectStart = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < arrayContent.length; i++) {
        const ch = arrayContent[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (ch === "\\") {
          escapeNext = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === "{") {
          if (depth === 0) objectStart = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && objectStart !== -1) {
            const objStr = arrayContent.slice(objectStart, i + 1);
            try {
              const validQ = JSON.parse(objStr);
              if (validQ && validQ.stem && Array.isArray(validQ.options)) {
                salvaged.push(validQ);
              }
            } catch {
              // Ignore truncated last item
            }
            objectStart = -1;
          }
        }
      }
      if (salvaged.length > 0) return salvaged;
    }
  }
  return [];
}

/**
 * Étape 1 : Gemini 2.5 Flash agit UNIQUEMENT comme extracteur/nettoyeur documentaire
 * sur les cours volumineux pour soulager Claude Sonnet 4.6 sans jamais rédiger de QCM.
 */
async function preprocessCourseWithGeminiFlash(
  rawCourseContent: string,
  excludedConcepts: string[],
  geminiKey?: string
): Promise<{ cleanCourseTitle: string; structuredMedicalFacts: string }> {
  if (!geminiKey || rawCourseContent.length < 14000) {
    return { cleanCourseTitle: "", structuredMedicalFacts: rawCourseContent };
  }

  try {
    const extractionPrompt = `Tu es un extracteur documentaire médical. Tu NE DOIS PAS rédiger de QCM.
Nettoie ce cours brut pour le Maître d'Œuvre (Claude Sonnet 4.6) :
1. Retire les numéros de page, en-têtes et sommaires.
2. Extrais le titre médical court du sujet (ex: "Anémie").
3. Garde 100% des faits médicaux, chiffres, seuils, mécanismes, listes et exceptions.
${excludedConcepts.length > 0 ? `4. Mets en valeur les notions non couvertes par : ${excludedConcepts.slice(0, 35).join(" | ")}` : ""}
Réponds en JSON : { "cleanCourseTitle": "...", "structuredMedicalFacts": "..." }`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${extractionPrompt}\n\nCOURS:\n${rawCourseContent}` }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }
    );

    if (!resp.ok) return { cleanCourseTitle: "", structuredMedicalFacts: rawCourseContent };
    const data = await resp.json();
    const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return {
      cleanCourseTitle: parsed.cleanCourseTitle || "",
      structuredMedicalFacts: parsed.structuredMedicalFacts || rawCourseContent,
    };
  } catch {
    return { cleanCourseTitle: "", structuredMedicalFacts: rawCourseContent };
  }
}

/**
 * Appel principal au Maître d'Œuvre : Claude Sonnet 4.6 (avec Prompt Caching + Retry)
 * et fallback intelligent si l'environnement Supabase utilise une autre clé.
 */
async function callMasterLLM(params: {
  systemPrompt: string;
  courseText: string;
  batchInstruction: string;
  anthropicKey?: string;
  openaiKey?: string;
  geminiKey?: string;
}): Promise<any[]> {
  const { systemPrompt, courseText, batchInstruction, anthropicKey, openaiKey, geminiKey } = params;

  // 1. Maître d'Œuvre prioritaire : Claude Sonnet 4.6
  if (anthropicKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            temperature: 0.6,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `SUPPORT DE COURS MÉDICAL :\n\n${courseText}`,
                    cache_control: { type: "ephemeral" },
                  },
                  { type: "text", text: batchInstruction },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.content?.[0]?.text || "{}";
          const parsed = safeParseQuestionsJson(rawText);
          if (parsed.length > 0) return parsed;
        } else if ([429, 500, 502, 503, 529].includes(response.status) && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        } else {
          break;
        }
      } catch {
        if (attempt < 2) await sleep(1200 * (attempt + 1));
      }
    }
  }

  // 2. Fallback OpenAI / Compatible si ANTHROPIC_API_KEY absente ou saturée
  if (openaiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `SUPPORT DE COURS :\n${courseText}\n\n${batchInstruction}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const parsed = safeParseQuestionsJson(data?.choices?.[0]?.message?.content || "{}");
      if (parsed.length > 0) return parsed;
    }
  }

  // 3. Fallback Gemini si seule GEMINI_API_KEY est configurée dans les secrets Supabase
  if (geminiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            { role: "user", parts: [{ text: `SUPPORT DE COURS :\n${courseText}\n\n${batchInstruction}` }] },
          ],
          generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
        }),
      }
    );
    if (response.ok) {
      const data = await response.json();
      const parsed = safeParseQuestionsJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      if (parsed.length > 0) return parsed;
    }
  }

  throw new Error("Aucune clé IA active (ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY) n'a répondu.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const courseContent = body.courseContent || body.content || body.text || "";
    const courseTitle = body.courseTitle || body.title || "Cours Médical";
    const requestedArchetypes: string[] = Array.isArray(body.archetypes) && body.archetypes.length > 0
      ? body.archetypes
      : body.archetype && body.archetype !== "mixte"
      ? [body.archetype]
      : ["complement_multiple", "groupage", "association", "censure", "jumelage"];

    const cognitiveTier = body.cognitiveTier || body.difficulty || "mecanismes";
    const safeQuestionCount = Math.max(1, Math.min(50, Number(body.questionCount || body.count || 10)));
    const seriesNumber = Number(body.seriesNumber || 1);
    const excludedConcepts: string[] = Array.isArray(body.excludedConcepts) ? body.excludedConcepts : [];
    const examArchiveText: string = body.examArchiveText || "";

    if (!courseContent || String(courseContent).trim().length < 30) {
      return new Response(
        JSON.stringify({ error: "Le contenu du cours est vide ou insuffisant." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const { cleanCourseTitle, structuredMedicalFacts } = await preprocessCourseWithGeminiFlash(
      courseContent,
      excludedConcepts,
      geminiKey
    );

    const finalCourseTitle = cleanCourseTitle || courseTitle;
    const tierDirective = COGNITIVE_TIER_DIRECTIVES[cognitiveTier] || COGNITIVE_TIER_DIRECTIVES.mecanismes;

    const exclusionBlock = excludedConcepts.length > 0
      ? `\n=== MÉMOIRE D'EXCLUSION INTER-SÉRIES (${finalCourseTitle} #${seriesNumber}) ===
Les concepts suivants ont DÉJÀ été interrogés dans les séries précédentes (#1 à #${seriesNumber - 1}).
INTERDICTION FORMELLE de poser à nouveau des questions sur ces points :
${excludedConcepts.slice(0, 60).map((c, i) => `${i + 1}. ${c}`).join("\n")}\n`
      : "";

    const archiveBlock = examArchiveText.trim().length > 20
      ? `\n=== CALIBRAGE DOCIMOLOGIQUE SUR ANNALES (PÔLE B) ===
Inspire-toi du niveau d'exigence, du ton professoral et de la subtilité des pièges de cet extrait d'annales :
${examArchiveText.slice(0, 4000)}\n`
      : "";

    const masterSystemPrompt = `Tu es le Maître d'Œuvre Docimologique de DawJang Studio Académique (Professeur Agrégé de Médecine).
Tu conçois des QCM médicaux d'une rigueur universitaire absolue à partir EXCLUSIVEMENT du cours fourni ("${finalCourseTitle}", Série #${seriesNumber}).

${tierDirective}
${exclusionBlock}
${archiveBlock}

=== RÈGLES ARCHITECTURALES OBLIGATOIRES PAR TYPE DE QCM ===
1. "complement_multiple" (Élection / QCU) :
   - Énoncé médical ciselé et original. 5 propositions (A à E) homogènes dont UNE SEULE est exacte.
2. "censure" :
   - L'étudiant doit identifier l'unique proposition FAUSSE (inexacte) parmi les 5 propositions (4 sont vraies selon le cours, 1 seule comporte une erreur subtile).
3. "groupage" :
   - Remplis OBLIGATOIREMENT le tableau \`groupageStatements\` avec exactement 5 propositions numérotées "I", "II", "III", "IV", "V" (et leur booléen \`isTrue\`).
   - Les 5 \`options\` (A à E) proposent uniquement des combinaisons de chiffres romains (ex: "I + II + IV", "II + III + V", "I + III", etc.).
4. "association" (RÈGLE CRITIQUE — PRÉSENTER LES 2 COLONNES AVANT LES CHOIX) :
   - Ne mets JAMAIS les listes à relier en vrac dans l'énoncé. Tu DOIS remplir OBLIGATOIREMENT l'objet \`matchingColumns\` avec :
     * \`leftColumnTitle\` : Titre de la Colonne 1 (éléments 1 à 5)
     * \`rightColumnTitle\` : Titre de la Colonne 2 (éléments A à E)
     * \`leftItems\` : Exactement 5 objets \`{ "id": "1", "text": "..." }\` jusqu'à "5"
     * \`rightItems\` : Exactement 5 objets \`{ "id": "A", "text": "..." }\` jusqu'à "E"
   - Ensuite seulement, les 5 \`options\` proposent des combinaisons d'appariement complètes (ex: "1-B • 2-E • 3-A • 4-C • 5-D").
5. "jumelage" :
   - Remplis OBLIGATOIREMENT \`jumelageData\` avec \`statementOne\`, \`connector\` ("PARCE QUE" ou "D’OÙ"), et \`statementTwo\`.
   - Les 5 \`options\` correspondent aux 5 cas canoniques du jumelage médical :
     * "Les deux propositions sont vraies et ont une relation de cause à effet"
     * "Les deux propositions sont vraies mais sans relation de cause à effet"
     * "La première proposition est vraie, mais la seconde est fausse"
     * "La première proposition est fausse, mais la seconde est vraie"
     * "Les deux propositions sont fausses"

Réponds EXCLUSIVEMENT avec un objet JSON valide respectant ce schéma :
{
  "questions": [
    {
      "archetype": "complement_multiple" | "censure" | "groupage" | "jumelage" | "association",
      "cognitiveTier": "${cognitiveTier}",
      "stem": "Énoncé principal de la question",
      "conceptTag": "Concept précis testé (4 à 6 mots)",
      "matchingColumns": null | {
        "leftColumnTitle": "Colonne 1 (Entités)",
        "rightColumnTitle": "Colonne 2 (Mécanismes / Propriétés)",
        "leftItems": [{ "id": "1", "text": "..." }, { "id": "2", "text": "..." }, { "id": "3", "text": "..." }, { "id": "4", "text": "..." }, { "id": "5", "text": "..." }],
        "rightItems": [{ "id": "A", "text": "..." }, { "id": "B", "text": "..." }, { "id": "C", "text": "..." }, { "id": "D", "text": "..." }, { "id": "E", "text": "..." }]
      },
      "groupageStatements": null | [
        { "numeral": "I", "text": "...", "isTrue": true },
        { "numeral": "II", "text": "...", "isTrue": false },
        { "numeral": "III", "text": "...", "isTrue": true },
        { "numeral": "IV", "text": "...", "isTrue": false },
        { "numeral": "V", "text": "...", "isTrue": true }
      ],
      "jumelageData": null | {
        "statementOne": "...",
        "connector": "PARCE QUE",
        "statementTwo": "..."
      },
      "options": [
        { "letter": "A", "text": "...", "rationale": "Justification précise tirée du cours" },
        { "letter": "B", "text": "...", "rationale": "..." },
        { "letter": "C", "text": "...", "rationale": "..." },
        { "letter": "D", "text": "...", "rationale": "..." },
        { "letter": "E", "text": "...", "rationale": "..." }
      ],
      "correctLetter": "A" | "B" | "C" | "D" | "E",
      "globalExplanation": "Synthèse docimologique complète expliquant le raisonnement.",
      "courseExcerpt": "Passage ou fait exact du cours validant la réponse."
    }
  ]
}`;

    const totalBatches = Math.ceil(safeQuestionCount / MAX_QUESTIONS_PER_BATCH);
    const batches = [];
    let remaining = safeQuestionCount;
    let startIdx = 0;

    for (let b = 0; b < totalBatches; b++) {
      const countForBatch = Math.min(MAX_QUESTIONS_PER_BATCH, remaining);
      const startPct = Math.round((b / totalBatches) * 100);
      const endPct = Math.round(((b + 1) / totalBatches) * 100);

      const blueprint = Array.from({ length: countForBatch }, (_, i) => {
        const globalIdx = startIdx + i;
        const arch = requestedArchetypes[globalIdx % requestedArchetypes.length];
        const angle = DYNAMIC_STEM_ANGLES[globalIdx % DYNAMIC_STEM_ANGLES.length];
        return `- Question #${globalIdx + 1} : Type obligatoire = "${arch}" | Angle = ${angle}`;
      }).join("\n");

      batches.push({
        batchIndex: b,
        instruction: `LOT ${b + 1}/${totalBatches} : Génère exactement ${countForBatch} QCM (Questions #${startIdx + 1} à #${startIdx + countForBatch}).
Focus du cours : Tranche ${startPct}% à ${endPct}% du document pour éviter tout doublon entre les lots.
Plan obligatoire :
${blueprint}`
      });

      remaining -= countForBatch;
      startIdx += countForBatch;
    }

    const allRawQuestions: any[] = [];

    if (batches.length > 0) {
      const firstBatch = await callMasterLLM({
        systemPrompt: masterSystemPrompt,
        courseText: structuredMedicalFacts,
        batchInstruction: batches[0].instruction,
        anthropicKey,
        openaiKey,
        geminiKey,
      });
      allRawQuestions.push(...firstBatch);
    }

    const restBatches = batches.slice(1);
    for (let i = 0; i < restBatches.length; i += MAX_CONCURRENT_BATCHES) {
      const slice = restBatches.slice(i, i + MAX_CONCURRENT_BATCHES);
      const results = await Promise.all(
        slice.map((b) =>
          callMasterLLM({
            systemPrompt: masterSystemPrompt,
            courseText: structuredMedicalFacts,
            batchInstruction: b.instruction,
            anthropicKey,
            openaiKey,
            geminiKey,
          })
        )
      );
      for (const r of results) allRawQuestions.push(...r);
    }

    const balancedQuestions = rebalanceAndShuffleQuestions(allRawQuestions);

    return new Response(
      JSON.stringify({
        seriesTitle: `${finalCourseTitle} #${seriesNumber}`,
        cleanCourseTitle: finalCourseTitle,
        seriesNumber,
        cognitiveTier,
        archetypes: requestedArchetypes,
        questions: balancedQuestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de la génération docimologique." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
