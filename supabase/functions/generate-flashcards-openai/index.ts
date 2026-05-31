import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(difficulty: string): string {
  const baseFormat = `Tu es un expert en ingénierie pédagogique médicale et en mémorisation par répétition espacée.
Ta mission est d'extraire les concepts clés, définitions, symptômes, critères diagnostiques, et traitements d'un cours médical pour générer des Flashcards (cartes mémoire) de très haute qualité, concises et stimulantes.

RÈGLES STRICTES POUR LES FLASHCARDS:
1. Ne pose JAMAIS de questions de type "QCM" (ex: "Laquelle de ces propositions est vraie ?").
2. Le "recto" (question) doit demander un concept précis ou une association (ex: "Triade classique de la thrombophlébite", "Définition de l'infarctus", "Antidote du paracétamol").
3. Le "verso" (answer) doit être EXTRÊMEMENT CONCIS, souvent sous forme de tirets ou de mots-clés percutants. Pas de longues phrases.
4. Couvre l'ensemble du texte fourni de manière stratégique (privilégie les points essentiels à retenir pour un examen médical).
5. Réponds UNIQUEMENT avec un array JSON valide. Pas de texte avant ou après.

Format EXACT requis:
[
  {
    "question": "Concept à retenir (ex: Signe de Homans)",
    "answer": "Douleur provoquée à la dorsiflexion du pied (signe de TVP)"
  }
]`;

  if (difficulty === "facile") {
    return `${baseFormat}

NIVEAU FACILE:
- Focalise-toi sur les définitions de base, les mots-clés simples et les concepts fondamentaux.
- Les questions doivent être très directes (ex: "Définition de...", "Quel est l'organe touché dans...").
- Évite les cas particuliers ou les détails rares.`;
  }

  if (difficulty === "difficile") {
    return `${baseFormat}

NIVEAU DIFFICILE:
- Focalise-toi sur les diagnostics différentiels, les traitements de seconde intention, les effets secondaires spécifiques, ou les scores cliniques complexes.
- Les questions doivent pousser à la réflexion (ex: "Quels sont les 3 diagnostics différentiels de...", "Quel est le mécanisme physiopathologique exact de...").`;
  }

  return `${baseFormat}

NIVEAU INTERMÉDIAIRE:
- Focalise-toi sur les signes cliniques majeurs, les critères diagnostiques et les traitements de première ligne.
- Niveau classique de révision d'un étudiant en médecine.`;
}

async function generateFlashcardsForChunk(content: string, nbCards: number, difficulty: string) {
  console.log(`Generating approx ${nbCards} ${difficulty} flashcards for chunk of ${content.length} characters`);
  
  const systemPrompt = getSystemPrompt(difficulty);
  const userPrompt = `Génère exactement ${nbCards} flashcards à partir du cours médical suivant.
Rappel: Extraits courts, percutants, format question-réponse pour la mémorisation active. Évite absolument le format QCM.

Cours médical:
${content}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('API error:', response.status, errText);
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (response.status === 402) throw new Error('PAYMENT_REQUIRED');
    throw new Error('API request failed');
  }

  const data = await response.json();
  let rawOutput = data.choices?.[0]?.message?.content || "";

  try {
    let cleaned = rawOutput.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.trim();
    
    const flashcards = JSON.parse(cleaned);
    if (!Array.isArray(flashcards)) throw new Error('Not an array');
    
    const validatedCards = flashcards.filter((f: any) => f.question && f.answer);
    return validatedCards;
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    return [];
  }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate user
  const userInfo = await getUserPlanInfo(req);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { content, nbFlashcards = 10, difficulty = "intermediaire" } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: "Le contenu est requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!Deno.env.get('LOVABLE_API_KEY')) {
      return new Response(JSON.stringify({ error: "Service indisponible" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const maxChunkSize = 5000;
    let allCards: any[] = [];
    
    if (content.length > maxChunkSize) {
      const chunks: string[] = [];
      const paragraphs = content.split(/\n\n+/);
      let currentChunk = '';
      for (const para of paragraphs) {
        if ((currentChunk + para).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = para;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
      
      const cardsPerChunk = Math.ceil(nbFlashcards / chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunkCards = await generateFlashcardsForChunk(chunks[i], cardsPerChunk, difficulty);
          allCards = allCards.concat(chunkCards);
        } catch (chunkError: any) {
          if (chunkError.message === 'RATE_LIMIT' || chunkError.message === 'PAYMENT_REQUIRED') throw chunkError;
        }
      }
      allCards = allCards.slice(0, nbFlashcards);
    } else {
      allCards = await generateFlashcardsForChunk(content, nbFlashcards, difficulty);
    }
    
    if (allCards.length === 0) {
      return new Response(JSON.stringify({ error: "Impossible de générer des flashcards." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    return new Response(JSON.stringify({ flashcards: allCards }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (err: any) {
    console.error('Error:', err);
    if (err.message === 'RATE_LIMIT') {
      return new Response(JSON.stringify({ error: "Limite atteinte. Réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (err.message === 'PAYMENT_REQUIRED') {
      return new Response(JSON.stringify({ error: "Quota atteint." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Erreur serveur." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

serve(handler);