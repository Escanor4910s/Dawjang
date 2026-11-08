import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Découpe le texte du cours en 5 segments égaux du début à la toute fin
 * pour empêcher l'IA de se concentrer uniquement sur les premières pages.
 */
function splitCourseIntoBalancedZones(text: string): string {
  const clean = text.trim();
  const len = clean.length;
  if (len < 2000) return clean;

  const zoneSize = Math.ceil(len / 5);
  const zones = [
    { label: "ZONE 1 (Début du cours : Définitions, Épidémiologie, Rappels)", content: clean.slice(0, zoneSize) },
    { label: "ZONE 2 (Première moitié : Physiopathologie & Mécanismes)", content: clean.slice(zoneSize, zoneSize * 2) },
    { label: "ZONE 3 (Milieu du cours : Sémiologie clinique, Paraclinique & Tableaux)", content: clean.slice(zoneSize * 2, zoneSize * 3) },
    { label: "ZONE 4 (Seconde moitié : Formes cliniques, Variantes & Diagnostics différentiels)", content: clean.slice(zoneSize * 3, zoneSize * 4) },
    { label: "ZONE 5 (Fin du cours : Traitements, Contre-indications, Posologies & Conclusion)", content: clean.slice(zoneSize * 4) },
  ];

  return zones
    .map((z) => `\n=== ${z.label} ===\n${z.content.slice(0, 22000)}`)
    .join("\n\n");
}

const HIGH_LEVEL_SYSTEM_PROMPT = `Tu es un Professeur Agrégé d'Université concevant des évaluations de haut niveau (Concours d'Internat / Examen Classant / Master).
Ta mission est de générer un deck de Smart Flashcards ("cards") qui couvre L'INTÉGRALITÉ ABSOLUE du cours (de la Zone 1 jusqu'à la Zone 5 incluse).

RÈGLES D'EXIGENCE ACADÉMIQUE ET DE COUVERTURE TOTALE :
1. INTERDICTION DU SUPERFICIEL : Ne pose jamais de questions banales ou évidentes. Formule des questions basées sur des mécanismes physiopathologiques/conceptuels, des cas cliniques, des pièges paracliniques, des seuils chiffrés précis et des exceptions tirées du cours.
2. COUVERTURE DE LA ZONE 1 À LA ZONE 5 : Tu DOIS répartir les cartes équitablement sur les 5 zones du cours (Début, Physiopathologie, Tableaux/Paraclinique, Autres formes, Traitement/Conclusion). Aucun chapitre ni aucun tableau ne doit être oublié.
3. VARIANTES D'ESCALADE DE DIFFICULTÉ ("variants") : Pour chaque carte, fournis 3 formulations de difficulté croissante afin que l'application ne repose jamais la même question lors des sessions suivantes :
   - "level1Prompt" : Question de mécanisme précis.
   - "level2Prompt" : Question d'application clinique ou d'analyse comparative.
   - "level3Prompt" : Question de niveau expert (piège d'examen, exception ou contre-indication).
4. VRAIES CATÉGORIES & VRAIS ÉLÉMENTS ("categorize") :
   - Interdiction absolue d'écrire "Catégorie A" ou "Élément 1".
   - "categoryA" et "categoryB" doivent être deux vraies catégories analytiques du cours (ex: "Anémies à crises hémolytiques aiguës (IV)" vs "Anémies à hémolyse chronique (EV)", ou "Médicaments formellement contre-indiqués" vs "Médicaments utilisables sous réserve de posologie stricte").
   - "items" doit contenir 4 vrais éléments précis du cours à classer.

Retourne UNIQUEMENT un JSON valide respectant cette structure :
{
  "detectedSubject": "NOM_DE_LA_MATIERE",
  "cards": [
    {
      "id": "card-1",
      "subjectTag": "TAG_MATIERE",
      "courseSection": "Chapitre exact du cours (ex: III. Déficit en Pyruvate Kinase)",
      "objectiveTitle": "Objectif pédagogique rattaché",
      "difficulty": 2,
      "prompt": "Question analytique ou clinique de haut niveau",
      "variants": {
        "level1Prompt": "Formulation analytique de niveau 1",
        "level2Prompt": "Cas clinique ou mécanisme croisé de niveau 2",
        "level3Prompt": "Piège d'examen ou exception de niveau 3"
      },
      "answer": "Réponse complète, rigoureuse et chiffrée",
      "keywords": ["mot-clé-1", "mot-clé-2", "mot-clé-3"],
      "mcq": {
        "question": "Énoncé QCM de niveau concours (cas clinique ou mécanisme fin)",
        "options": [
          { "id": "A", "text": "Distracteur très plausible mais comportant une erreur subtile", "isCorrect": false },
          { "id": "B", "text": "Distracteur inversant deux mécanismes du cours", "isCorrect": false },
          { "id": "C", "text": "Distracteur portant sur une autre pathologie proche du cours", "isCorrect": false },
          { "id": "D", "text": "Proposition exacte et complète", "isCorrect": true }
        ]
      },
      "trueFalse": {
        "statement": "Affirmation complexe et nuancée testant un piège précis du cours",
        "isTrue": false
      },
      "cloze": {
        "sentenceBefore": "Début de l'énoncé technique avant le terme clé",
        "missingTerm": "terme exact",
        "sentenceAfter": "suite et fin de l'énoncé.",
        "distractors": ["terme proche 1", "terme proche 2", "terme proche 3"]
      },
      "categorize": {
        "instruction": "Classe ces éléments selon leur mécanisme ou indication",
        "categoryA": "Intitulé exact de la Catégorie A",
        "categoryB": "Intitulé exact de la Catégorie B",
        "items": [
          { "id": "1", "label": "Terme précis 1 du cours", "target": "A" },
          { "id": "2", "label": "Terme précis 2 du cours", "target": "B" },
          { "id": "3", "label": "Terme précis 3 du cours", "target": "A" },
          { "id": "4", "label": "Terme précis 4 du cours", "target": "B" }
        ]
      },
      "matching": {
        "instruction": "Associe chaque entité du cours à sa spécificité exacte",
        "pairs": [
          { "id": "p1", "left": "Entité 1", "right": "Spécificité 1" },
          { "id": "p2", "left": "Entité 2", "right": "Spécificité 2" },
          { "id": "p3", "left": "Entité 3", "right": "Spécificité 3" }
        ]
      },
      "deepDive": {
        "expectedSummary": "Synthèse exacte de la réponse attendue",
        "coreExplanation": "Justification approfondie avec **termes clés en gras**",
        "distinctionOrCounterExample": "Diagnostic différentiel / Distinction fine avec les autres entités du cours",
        "commonPitfall": "Piège classique d'examen à éviter absolument",
        "causalChainProTip": "Étape 1 → Étape 2 → Étape 3 → Conséquence clinique/finale."
      }
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      content,
      title = "Cours Universitaire",
      count = 15,
      objectives = [],
      previousQuestions = [],
      targetDifficulty = 2,
    } = await req.json();

    if (!content || content.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Le contenu du cours est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zonedContent = splitCourseIntoBalancedZones(content);

    const antiRepetitionBlock =
      Array.isArray(previousQuestions) && previousQuestions.length > 0
        ? `\nINTERDICTION DE RÉPÉTER CES QUESTIONS DÉJÀ POSÉES LORS DES SESSIONS PRÉCÉDENTES (reformule sous un angle plus complexe de niveau ${targetDifficulty}/3 ou interroge des détails non encore explorés du cours) :\n${previousQuestions
            .slice(0, 25)
            .map((q: string) => `- ${q}`)
            .join("\n")}\n`
        : "";

    const objectivesBlock =
      Array.isArray(objectives) && objectives.length > 0
        ? `\nOBJECTIFS PÉDAGOGIQUES DU COURS :\n${objectives
            .map((o: string, i: number) => `${i + 1}. ${o}`)
            .join("\n")}\n`
        : "";

    const apiKey =
      Deno.env.get("LOVABLE_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("OPENAI_API_KEY");

    const apiUrl = Deno.env.get("LOVABLE_API_KEY")
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : Deno.env.get("OPENAI_API_KEY")
      ? "https://api.openai.com/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    const modelName = Deno.env.get("LOVABLE_API_KEY")
      ? "google/gemini-2.5-pro"
      : Deno.env.get("OPENAI_API_KEY")
      ? "gpt-4o"
      : "gemini-2.5-pro";

    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: HIGH_LEVEL_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Cours : "${title}"
Nombre de cartes exigé : ${count} (réparties obligatoirement sur les 5 ZONES du cours ci-dessous).
Niveau de difficulté cible : ${targetDifficulty}/3.
${objectivesBlock}
${antiRepetitionBlock}
${zonedContent}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Erreur API IA (${aiRes.status}): ${await aiRes.text()}`);
    }

    const data = await aiRes.json();
    const rawContent = data.choices?.[0]?.message?.content || '{"cards":[]}';
    const cleanedJson = rawContent
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return new Response(cleanedJson, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
