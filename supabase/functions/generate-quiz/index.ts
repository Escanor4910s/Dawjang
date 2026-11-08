import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OptionLetter = "A" | "B" | "C" | "D" | "E";
const LETTERS: OptionLetter[] = ["A", "B", "C", "D", "E"];

// 1. Directives des 3 Paliers Cognitifs exécutées par Claude Sonnet 4.6
const COGNITIVE_TIER_DIRECTIVES: Record<string, string> = {
  ancrage: `PALIER 1 — ANCRAGE & SÉMIOLOGIE (Fondations & Restitution Croisée) :
- INTERDICTION ABSOLUE de recopier une phrase du cours mot pour mot.
- Reformule les définitions, les seuils biologiques, les classifications et les signes cardinaux avec une terminologie médicale rigoureuse.
- Construis des distracteurs subtils en inversant deux seuils chiffrés voisins du cours, en confondant un signe constant avec un signe inconstant, ou en attribuant une propriété à une entité voisine du même chapitre.`,

  mecanismes: `PALIER 2 — MÉCANISMES & CORRÉLATIONS (Physiopathologie & Causalité) :
- Zéro question de simple définition.
- Chaque question doit obliger l'étudiant à relier une CAUSE à une CONSÉQUENCE présente dans le cours (ex: quel mécanisme physiopathologique explique tel signe clinique, telle complication ou telle anomalie biologique ?).
- Construis des distracteurs redoutables : utilise des propositions VRAIES dans le cours mais dont le lien de causalité est inversé ou anachronique.`,

  discernement: `PALIER 3 — DISCERNEMENT & CAS CROISÉS (Synthèse Clinique & Nuances Restrictives) :
- Croise 2 à 3 sous-parties distinctes du cours dans une même question (ex: Terrain + Anomalie paraclinique + Contre-indication ou Traitement).
- Formule des micro-vignettes synthétiques basées à 100% sur le contenu du cours.
- Cible les nuances restrictives du cours (absolu vs relatif, constant vs fréquent, 1ère intention vs 2nde intention) sans jamais inventer hors-cours.`
};

const DYNAMIC_STEM_ANGLES = [
  "Approche analytique directe : attaque directement par le mécanisme physiopathologique ou sémiologique sans formule scolaire répétitive.",
  "Approche différentielle : oppose deux entités, stades ou formes cliniques du cours pour tester le critère exact de distinction.",
  "Approche déductive : présente une constellation de 2 ou 3 signes/paramètres du cours et demande la conclusion logique qui s'impose.",
  "Approche de hiérarchisation : interroge sur l'élément déterminant, le critère formel ou le mécanisme prépondérant décrit dans le texte.",
  "Approche fonctionnelle inversée : part d'une anomalie biologique, clinique ou thérapeutique du cours et remonte à sa cause exacte.",
  "Approche d'exception conditionnelle : cible une particularité, une limite ou un piège explicitement mentionné dans le support."
];

// 2. Étape 1 (Optionnelle & Infaillible) : Gemini 2.5 Flash nettoie et structure la matière brute
async function preprocessCourseWithGeminiFlash(
  rawCourseContent: string,
  excludedConcepts: string[],
  geminiKey?: string
): Promise<{ cleanCourseTitle: string; structuredMedicalFacts: string }> {
  // Si le cours est déjà court (< 12 000 caractères) ou pas de clé Gemini, on passe directement à Sonnet 4.6
  if (!geminiKey || rawCourseContent.length < 12000) {
    return {
      cleanCourseTitle: "",
      structuredMedicalFacts: rawCourseContent,
    };
  }

  try {
    const extractionPrompt = `Tu es un ingénieur d'extraction documentaire médicale.
Tu NE DOIS PAS rédiger de QCM. Ta seule mission est de nettoyer ce cours brut pour le Maître d'Œuvre (Claude Sonnet 4.6) :
1. Supprime tout le bruit (numéros de page, sommaires, en-têtes, remerciements, phrases creuses).
2. Extrais un titre médical court et propre du sujet principal (2 à 4 mots max, ex: "Anémie Ferriprive").
3. Conserve 100% des faits médicaux, valeurs chiffrées, seuils, mécanismes physiopathologiques, listes, tableaux et exceptions sous une forme structurée ultra-dense.
${excludedConcepts.length > 0 ? `4. Mets particulièrement en avant les passages du cours qui N'ONT PAS encore été traités dans cette liste : ${excludedConcepts.join(" | ")}` : ""}

Réponds uniquement en JSON :
{
  "cleanCourseTitle": "Titre Médical Propre",
  "structuredMedicalFacts": "Tout le contenu médical nettoyé et structuré de manière exhaustive..."
}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${extractionPrompt}\n\nCOURS BRUT :\n${rawCourseContent}` }] }
          ],
          generationConfig: {
            temperature: 0.1, // Température quasi nulle : zéro hallucination, extraction pure
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!resp.ok) throw new Error("Fallback direct vers Sonnet");
    const data = await resp.json();
    const parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return {
      cleanCourseTitle: parsed.cleanCourseTitle || "",
      structuredMedicalFacts: parsed.structuredMedicalFacts || rawCourseContent,
    };
  } catch {
    // En cas de pépin sur Gemini 2.5, Sonnet 4.6 prend directement le texte brut sans interruption
    return { cleanCourseTitle: "", structuredMedicalFacts: rawCourseContent };
  }
}

// 3. Mélangeur de Fisher-Yates + Anti-Streak côté serveur (Zéro A-A-A-A)
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
  return text.replace(/^[A-E][\s.\-):]+/i, "").trim();
}

function rebalanceAndShuffleQuestions(rawQuestions: any[]): any[] {
  const letterHistory: OptionLetter[] = [];
  const letterCounts: Record<OptionLetter, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  return rawQuestions.map((q, idx) => {
    const options = Array.isArray(q.options) ? q.options.slice(0, 5) : [];
    if (options.length < 5) return q;

    const originalCorrectLetter = (q.correctLetter || "A").toUpperCase() as OptionLetter;
    const correctIndex = LETTERS.indexOf(originalCorrectLetter) !== -1
      ? LETTERS.indexOf(originalCorrectLetter)
      : 0;
    const correctOptionObj = options[correctIndex] || options[0];

    const last1 = letterHistory[letterHistory.length - 1];
    const last2 = letterHistory[letterHistory.length - 2];

    const candidateLetters = shuffleArray(LETTERS).filter((letter) => {
      if (last1 && last2 && last1 === last2 && letter === last1) return false;
      if (last1 && letter === last1 && Math.random() < 0.75) return false;
      return true;
    });

    candidateLetters.sort((a, b) => letterCounts[a] - letterCounts[b]);
    const targetCorrectLetter = candidateLetters[0] || LETTERS[idx % 5];
    const targetCorrectIdx = LETTERS.indexOf(targetCorrectLetter);

    const distractors = options.filter((_, i) => i !== correctIndex);
    const shuffledDistractors = shuffleArray(distractors);

    const finalOptions = [];
    let dPtr = 0;
    for (let i = 0; i < 5; i++) {
      if (i === targetCorrectIdx) {
        finalOptions.push({
          letter: LETTERS[i],
          text: cleanOptionPrefix(correctOptionObj.text),
          rationale: correctOptionObj.rationale || "Proposition exacte selon le cours."
        });
      } else {
        const d = shuffledDistractors[dPtr++] || { text: "Proposition inexacte", rationale: "" };
        finalOptions.push({
          letter: LETTERS[i],
          text: cleanOptionPrefix(d.text),
          rationale: d.rationale || "Proposition erronée selon le cours."
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      courseContent,
      courseTitle = "Cours Médical",
      archetype = "mixte",
      cognitiveTier = "mecanismes",
      questionCount = 10,
      seriesNumber = 1,
      excludedConcepts = []
    } = await req.json();

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!anthropicKey) {
      throw new Error("La clé ANTHROPIC_API_KEY est requise pour que Claude Sonnet 4.6 agisse comme Maître d'Œuvre.");
    }

    // ÉTAPE 1 : Pré-traitement rapide et sans risque par Gemini 2.5 Flash (uniquement si cours volumineux)
    const { cleanCourseTitle, structuredMedicalFacts } = await preprocessCourseWithGeminiFlash(
      courseContent,
      excludedConcepts,
      geminiKey
    );

    const finalCourseTitle = cleanCourseTitle || courseTitle;
    const tierDirective = COGNITIVE_TIER_DIRECTIVES[cognitiveTier] || COGNITIVE_TIER_DIRECTIVES.mecanismes;

    const archetypesPool = archetype === "mixte"
      ? ["complement_multiple", "groupage", "association", "censure", "jumelage"]
      : [archetype];

    const perQuestionBlueprint = Array.from({ length: questionCount }, (_, i) => {
      const chosenArchetype = archetypesPool[i % archetypesPool.length];
      const chosenAngle = DYNAMIC_STEM_ANGLES[i % DYNAMIC_STEM_ANGLES.length];
      return `- Question #${i + 1} : Type obligatoire = "${chosenArchetype}" | Style = ${chosenAngle}`;
    }).join("\n");

    const exclusionBlock = excludedConcepts.length > 0
      ? `\n=== EXCLUSION STRICTE INTER-SÉRIES (SÉRIE #${seriesNumber}) ===
Ces points ont DÉJÀ été interrogés dans les séries précédentes (${finalCourseTitle} #1 à #${seriesNumber - 1}).
Il est FORMELLEMENT INTERDIT de reposer des questions dessus :
${excludedConcepts.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}\n`
      : "";

    // ÉTAPE 2 : Claude Sonnet 4.6 — Maître d'Œuvre Exclusif avec Prompt Caching anti-surcharge
    const masterSystemPrompt = `Tu es le Maître d'Œuvre Docimologique (Professeur Agrégé de Médecine).
Tu conçois personnellement et intégralement ${questionCount} QCM d'excellence à partir du cours fourni ("${finalCourseTitle}", Série #${seriesNumber}).

${tierDirective}
${exclusionBlock}

=== RÈGLES ARCHITECTURALES STRICTES PAR TYPE DE QCM ===
1. "complement_multiple" :
   - Énoncé médical ciselé et original. 5 propositions (A à E) homogènes dont UNE SEULE est vraie.
2. "censure" :
   - L'étudiant doit identifier l'unique proposition FAUSSE parmi les 5 (4 sont exactes selon le cours, 1 seule contient un piège subtil). Varie la tournure de la question.
3. "groupage" :
   - Remplis OBLIGATOIREMENT \`groupageStatements\` avec exactement 5 propositions numérotées "I", "II", "III", "IV", "V" (et leur booléen \`isTrue\`).
   - Les 5 \`options\` (A à E) proposent uniquement des combinaisons de chiffres romains (ex: "I + II + IV", "II + III + V", "I + IV", etc.).
4. "association" (RÈGLE CRITIQUE) :
   - Avant les choix de réponses, tu DOIS présenter les deux colonnes à relier en remplissant OBLIGATOIREMENT \`matchingColumns\` :
     * \`leftColumnTitle\` : Titre de la colonne 1
     * \`rightColumnTitle\` : Titre de la colonne 2
     * \`leftItems\` : 5 éléments numérotés de "1" à "5"
     * \`rightItems\` : 5 éléments identifiés de "A" à "E"
   - Les 5 \`options\` de réponse proposent ensuite les appariements complets (ex: "1-B • 2-A • 3-C • 4-E • 5-D").
5. "jumelage" :
   - Remplis OBLIGATOIREMENT \`jumelageData\` avec \`statementOne\`, \`connector\` ("PARCE QUE" ou "D’OÙ"), et \`statementTwo\`.
   - Les 5 \`options\` correspondent aux 5 cas canoniques du jumelage médical.

=== CAHIER DES CHARGES QUESTION PAR QUESTION ===
${perQuestionBlueprint}

Réponds EXCLUSIVEMENT avec un objet JSON valide (sans balises markdown autour) :
{
  "questions": [
    {
      "archetype": "complement_multiple" | "censure" | "groupage" | "jumelage" | "association",
      "cognitiveTier": "${cognitiveTier}",
      "stem": "Énoncé principal de la question",
      "conceptTag": "Concept médical précis testé (4-6 mots)",
      "matchingColumns": null | {
        "leftColumnTitle": "...",
        "rightColumnTitle": "...",
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
      "globalExplanation": "Synthèse pédagogique expliquant le raisonnement complet.",
      "courseExcerpt": "Citation ou fait exact du cours prouvant la réponse."
    }
  ]
}`;

    // Modèle cible : Claude Sonnet 4.6 (avec fallback de résilience 3.7 / 3.5 si identifiant API alternatif)
    const targetModel = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
    const candidateModels = Array.from(new Set([
      targetModel,
      "claude-sonnet-4-6",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022"
    ]));

    let claudeResponse: Response | null = null;
    let selectedModel = targetModel;

    for (const modelToTry of candidateModels) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelToTry,
          max_tokens: 8192,
          temperature: 0.6,
          system: [
            {
              type: "text",
              text: masterSystemPrompt,
              cache_control: { type: "ephemeral" }
            }
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `MATIÈRE DU COURS (${finalCourseTitle}) :\n\n${structuredMedicalFacts}`,
                  cache_control: { type: "ephemeral" } // Garde le cours en cache pour les Séries #2, #3, #4 !
                },
                {
                  type: "text",
                  text: `Génère maintenant la Série #${seriesNumber} (${questionCount} QCM) en respectant strictement le JSON demandé.`
                }
              ]
            }
          ]
        })
      });

      if (resp.ok) {
        claudeResponse = resp;
        selectedModel = modelToTry;
        break;
      }

      const errText = await resp.text();
      if (resp.status === 404 || errText.includes("not_found_error")) {
        console.warn(`Modèle ${modelToTry} non disponible (${resp.status}), bascule automatique vers le modèle suivant...`);
        continue;
      } else {
        throw new Error(`Erreur Claude Sonnet (${resp.status}): ${errText}`);
      }
    }

    if (!claudeResponse || !claudeResponse.ok) {
      throw new Error(`Impossible de contacter un modèle Claude Sonnet valide.`);
    }

    const claudeData = await claudeResponse.json();
    const rawJsonText = claudeData?.content?.[0]?.text || "{}";
    const cleanedJson = rawJsonText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsedPayload = JSON.parse(cleanedJson);

    // ÉTAPE 3 : Mélangeur algorithmique côté serveur pour garantir l'aléatoire parfait A-E
    const balancedQuestions = rebalanceAndShuffleQuestions(parsedPayload.questions || []);

    return new Response(
      JSON.stringify({
        seriesTitle: `${finalCourseTitle} #${seriesNumber}`,
        cleanCourseTitle: finalCourseTitle,
        seriesNumber,
        cognitiveTier,
        archetype,
        orchestrator: selectedModel,
        preprocessor: geminiKey && courseContent.length >= 12000 ? "gemini-2.5-flash" : "none",
        questions: balancedQuestions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de la génération par le Maître d'Œuvre" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
