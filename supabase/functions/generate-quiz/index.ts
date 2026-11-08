import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OptionLetter = "A" | "B" | "C" | "D" | "E";
const LETTERS: OptionLetter[] = ["A", "B", "C", "D", "E"];

// 1. Définition stricte des 3 nouveaux paliers cognitifs
const COGNITIVE_TIER_DIRECTIVES: Record<string, string> = {
  ancrage: `PALIER 1 — ANCRAGE & SÉMIOLOGIE (Fondations & Restitution Croisée) :
- INTERDICTION ABSOLUE de recopier une phrase du cours mot pour mot.
- Reformule les définitions, les seuils biologiques, les classifications et les signes cardinaux avec un vocabulaire médical précis et élégant.
- Construis des distracteurs crédibles en inversant deux seuils chiffrés voisins du cours, en confondant un signe constant avec un signe inconstant, ou en attribuant une caractéristique à une entité proche décrite dans le même document.`,

  mecanismes: `PALIER 2 — MÉCANISMES & CORRÉLATIONS (Physiopathologie & Causalité) :
- Ne pose AUCUNE question de simple définition.
- Chaque question doit exiger de relier une CAUSE à une CONSÉQUENCE présente dans le cours (ex: quel mécanisme physiopathologique explique tel signe clinique, telle complication ou telle anomalie paraclinique ?).
- Construis des distracteurs redoutables : utilise des faits VRAIS dans le cours mais dont le lien de causalité est inversé, anachronique ou non responsable de l'effet cité.`,

  discernement: `PALIER 3 — DISCERNEMENT & CAS CROISÉS (Synthèse Clinique & Nuances Restrictives) :
- Croise 2 à 3 sous-parties distinctes du cours dans une même question (ex: Terrain + Anomalie + Contre-indication ou Traitement).
- Utilise des micro-vignettes cliniques ou biologiques synthétiques basées à 100% sur les éléments du cours.
- Exploite les subtilités restrictives du cours (contre-indication absolue vs relative, signe pathognomonique vs évocateur, première intention vs seconde intention) sans jamais inventer de données hors-cours.`
};

// 2. Matrice d'angles syntaxiques pour briser la monotonie des énoncés
const DYNAMIC_STEM_ANGLES = [
  "Angle analytique direct : attaque directement par le phénomène physiopathologique ou sémiologique sans préambule scolaire.",
  "Angle différentiel : oppose deux entités, stades ou formes cliniques du cours pour tester le critère exact de distinction.",
  "Angle déductif : présente une constellation de 2 ou 3 signes/paramètres du cours et demande la conclusion logique qui s'impose.",
  "Angle de hiérarchisation / priorité : interroge sur l'élément déterminant, le gold-standard ou le mécanisme prépondérant décrit dans le texte.",
  "Angle d'interprétation fonctionnelle : part d'un résultat (biologique, clinique ou thérapeutique) mentionné dans le cours et remonte à son origine.",
  "Angle de restriction conditionnelle : cible une exception, une condition particulière ou un piège classique explicitement mentionné dans le support."
];

// 3. Mélangeur de Fisher-Yates + Algorithme Anti-Streak (Zéro A-A-A-A / B-B-B-B)
function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rebalanceAndShuffleQuestions(rawQuestions: any[]): any[] {
  const letterHistory: OptionLetter[] = [];
  const letterCounts: Record<OptionLetter, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  return rawQuestions.map((q, idx) => {
    const options = Array.isArray(q.options) ? q.options.slice(0, 5) : [];
    if (options.length < 5) return q;

    // Identifier la bonne option avant mélange
    const originalCorrectLetter = (q.correctLetter || "A").toUpperCase() as OptionLetter;
    const correctIndex = LETTERS.indexOf(originalCorrectLetter) !== -1
      ? LETTERS.indexOf(originalCorrectLetter)
      : 0;
    const correctOptionObj = options[correctIndex] || options[0];

    // Choisir la lettre cible idéale :
    // - Interdiction d'avoir la même lettre que les 2 questions précédentes (Anti-Streak strict)
    // - Priorité aux lettres les moins utilisées jusqu'ici pour équilibrer A, B, C, D, E
    const last1 = letterHistory[letterHistory.length - 1];
    const last2 = letterHistory[letterHistory.length - 2];

    const candidateLetters = shuffleArray(LETTERS).filter((letter) => {
      if (last1 && last2 && last1 === last2 && letter === last1) return false;
      if (last1 && letter === last1 && Math.random() < 0.75) return false; // Évite même les doublons fréquents
      return true;
    });

    candidateLetters.sort((a, b) => letterCounts[a] - letterCounts[b]);
    const targetCorrectLetter = candidateLetters[0] || LETTERS[idx % 5];
    const targetCorrectIdx = LETTERS.indexOf(targetCorrectLetter);

    // Séparer la bonne réponse et mélanger les 4 distracteurs
    const distractors = options.filter((_, i) => i !== correctIndex);
    const shuffledDistractors = shuffleArray(distractors);

    // Reconstruire les 5 options avec la bonne réponse exactement à targetCorrectIdx
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
        const d = shuffledDistractors[dPtr++] || { text: "Aucune de ces réponses", rationale: "" };
        finalOptions.push({
          letter: LETTERS[i],
          text: cleanOptionPrefix(d.text),
          rationale: d.rationale || "Proposition inexacte."
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

function cleanOptionPrefix(text: string): string {
  if (!text) return "";
  return text.replace(/^[A-E][\s.\-):]+/i, "").trim();
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
      excludedConcepts = [] // Liste des concepts ou questions des séries #1, #2 précédentes
    } = await req.json();

    if (!courseContent || courseContent.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Le contenu du cours est insuffisant pour générer des QCM." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tierDirective = COGNITIVE_TIER_DIRECTIVES[cognitiveTier] || COGNITIVE_TIER_DIRECTIVES.mecanismes;

    // Plan de distribution des archétypes et des angles syntaxiques question par question
    const archetypesPool = archetype === "mixte"
      ? ["complement_multiple", "groupage", "association", "censure", "jumelage"]
      : [archetype];

    const perQuestionBlueprint = Array.from({ length: questionCount }, (_, i) => {
      const chosenArchetype = archetypesPool[i % archetypesPool.length];
      const chosenAngle = DYNAMIC_STEM_ANGLES[i % DYNAMIC_STEM_ANGLES.length];
      return `Question #${i + 1} -> Type: "${chosenArchetype}" | Directive de style: ${chosenAngle}`;
    }).join("\n");

    const exclusionBlock = excludedConcepts.length > 0
      ? `\n=== MÉMOIRE D'EXCLUSION INTER-SÉRIES (SÉRIE #${seriesNumber}) ===
Les concepts et angles suivants ont DÉJÀ été testés dans les séries précédentes (${courseTitle} #1 à #${seriesNumber - 1}).
INTERDICTION FORMELLE de poser à nouveau des questions sur ces points précis, explore d'autres passages et détails du cours :
${excludedConcepts.map((c: string, i: number) => `- ${i + 1}. ${c}`).join("\n")}\n`
      : "";

    const systemPrompt = `Tu es un Professeur Agrégé de Médecine et concepteur d'épreuves docimologiques de haut niveau.
Ta mission est de générer exactement ${questionCount} QCM d'excellence à partir EXCLUSIVEMENT du cours fourni ("${courseTitle}", Série #${seriesNumber}).

${tierDirective}
${exclusionBlock}

=== RÈGLES DOCIMOLOGIQUES PAR ARCHÉTYPE ===
1. "complement_multiple" :
   - Énoncé précis et élégant. 5 propositions (A à E) dont UNE SEULE est exacte.
   - Les 4 distracteurs doivent être homogènes en longueur et en registre médical.

2. "censure" :
   - L'étudiant doit identifier l'unique proposition FAUSSE (ou INEXACTE) parmi les 5 propositions (4 sont vraies selon le cours, 1 seule comporte une erreur subtile).
   - Varie la formulation de l'énoncé sans jamais utiliser un moule mécanique répétitif.

3. "groupage" :
   - Tu DOIS obligatoirement remplir le tableau \`groupageStatements\` avec exactement 5 assertions numérotées "I", "II", "III", "IV", "V".
   - Les 5 \`options\` (A, B, C, D, E) doivent proposer des combinaisons crédibles de ces chiffres romains (ex: "I + II + IV", "II + III + V", "I + III", etc.).

4. "association" (CRITIQUE — ZÉRO ERREUR D'AFFICHAGE) :
   - Tu DOIS obligatoirement remplir l'objet \`matchingColumns\` contenant :
     * \`leftColumnTitle\` (ex: "Entités cliniques / Paramètres")
     * \`rightColumnTitle\` (ex: "Mécanismes / Caractéristiques")
     * \`leftItems\`: exactement 5 éléments identifiés de "1" à "5"
     * \`rightItems\`: exactement 5 éléments identifiés de "A" à "E"
   - Ensuite seulement, les 5 \`options\` de réponse proposent des appariements complets (ex: "1-B • 2-E • 3-A • 4-C • 5-D").

5. "jumelage" :
   - Tu DOIS obligatoirement remplir \`jumelageData\` avec \`statementOne\` (1ère assertion issue du cours), \`connector\` ("PARCE QUE" ou "D’OÙ"), et \`statementTwo\` (2ème assertion).
   - Les 5 \`options\` doivent expliciter clairement le statut de vérité et de liaison :
     * "Les deux propositions sont vraies et ont une relation de cause à effet"
     * "Les deux propositions sont vraies mais sans relation de cause à effet"
     * "La première proposition est vraie, mais la seconde est fausse"
     * "La première proposition est fausse, mais la seconde est vraie"
     * "Les deux propositions sont fausses"
   - Varie le cas de figure réel d'un jumelage à l'autre (ne crée pas uniquement des paires Vrai/Vrai liées).

=== PLAN DE VARIÉTÉ OBLIGATOIRE QUESTION PAR QUESTION ===
${perQuestionBlueprint}

Réponds UNIQUEMENT avec un objet JSON valide respectant strictement la structure suivante :
{
  "questions": [
    {
      "archetype": "complement_multiple" | "censure" | "groupage" | "jumelage" | "association",
      "cognitiveTier": "${cognitiveTier}",
      "stem": "Énoncé de la question (sans inclure les colonnes ni les assertions I-V qui ont leurs champs dédiés)",
      "conceptTag": "Résumé en 5 mots du concept précis testé",
      "matchingColumns": { // UNIQUEMENT si archetype === "association", sinon null
        "leftColumnTitle": "Titre Colonne 1",
        "rightColumnTitle": "Titre Colonne 2",
        "leftItems": [{ "id": "1", "text": "..." }, { "id": "2", "text": "..." }, { "id": "3", "text": "..." }, { "id": "4", "text": "..." }, { "id": "5", "text": "..." }],
        "rightItems": [{ "id": "A", "text": "..." }, { "id": "B", "text": "..." }, { "id": "C", "text": "..." }, { "id": "D", "text": "..." }, { "id": "E", "text": "..." }]
      },
      "groupageStatements": [ // UNIQUEMENT si archetype === "groupage", sinon null
        { "numeral": "I", "text": "...", "isTrue": true },
        { "numeral": "II", "text": "...", "isTrue": false },
        { "numeral": "III", "text": "...", "isTrue": true },
        { "numeral": "IV", "text": "...", "isTrue": true },
        { "numeral": "V", "text": "...", "isTrue": false }
      ],
      "jumelageData": { // UNIQUEMENT si archetype === "jumelage", sinon null
        "statementOne": "...",
        "connector": "PARCE QUE",
        "statementTwo": "..."
      },
      "options": [
        { "letter": "A", "text": "...", "rationale": "Justification précise selon le cours" },
        { "letter": "B", "text": "...", "rationale": "..." },
        { "letter": "C", "text": "...", "rationale": "..." },
        { "letter": "D", "text": "...", "rationale": "..." },
        { "letter": "E", "text": "...", "rationale": "..." }
      ],
      "correctLetter": "A" | "B" | "C" | "D" | "E",
      "globalExplanation": "Synthèse pédagogique claire expliquant la démarche de résolution.",
      "courseExcerpt": "Passage ou fait exact du cours qui valide la réponse."
    }
  ]
}`;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let parsedPayload: { questions: any[] } = { questions: [] };

    if (geminiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: "user",
                parts: [{ text: `CONTENU DU COURS (${courseTitle}) :\n\n${courseContent}` }]
              }
            ],
            generationConfig: {
              temperature: 0.65,
              responseMimeType: "application/json"
            }
          })
        }
      );

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      parsedPayload = JSON.parse(rawText);
    } else if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CONTENU DU COURS (${courseTitle}) :\n\n${courseContent}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.65
        })
      });

      const data = await response.json();
      parsedPayload = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    } else {
      throw new Error("Aucune clé API (GEMINI_API_KEY ou OPENAI_API_KEY) configurée dans Supabase.");
    }

    // Application du mélangeur cryptographique et anti-répétition des lettres (A-E)
    const balancedQuestions = rebalanceAndShuffleQuestions(parsedPayload.questions || []);

    return new Response(
      JSON.stringify({
        seriesTitle: `${courseTitle} #${seriesNumber}`,
        seriesNumber,
        cognitiveTier,
        archetype,
        questions: balancedQuestions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de la génération des QCM" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
