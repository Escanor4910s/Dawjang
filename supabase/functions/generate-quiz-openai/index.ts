import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(difficulty: string, type: string): string {
  const baseFormat = `Tu es un expert en génération de QCM médicaux de niveau universitaire. Tu dois IMPÉRATIVEMENT répondre UNIQUEMENT avec un array JSON valide, sans aucun texte avant ou après.

IMPORTANT - VARIÉTÉ ET ORIGINALITÉ:
- Génère des questions UNIQUES et VARIÉES à chaque appel
- Varie les formulations
- Alterne entre questions positives et négatives
- Ne répète JAMAIS la même structure deux fois de suite

Format EXACT requis:
[
  {
    "question": "Texte de la question?",
    "choices": ["Choix A", "Choix B", "Choix C", "Choix D", "Choix E"],
    "correct": [0],
    "explanation": "Explication détaillée"
  }
]

RÈGLES STRICTES:
- "question": string
- "choices": array de 5 strings
- "correct": array d'index (0-based) des bonnes réponses
- "explanation": string
- PAS de texte hors JSON, PAS de markdown
- SEULEMENT le JSON`;

  if (difficulty === "facile") {
    return `${baseFormat}

NIVEAU FACILE:
- UNE SEULE bonne réponse par question
- Formulation directe, sans pièges
- Les réponses doivent être retrouvables dans le texte`;
  }
  
  if (difficulty === "intermediaire") {
    return `${baseFormat}

NIVEAU INTERMÉDIAIRE:
- 1 à 5 bonnes réponses possibles
- Reformulation intelligente
- Nuances diagnostiques ou thérapeutiques`;
  }
  
  if (difficulty === "difficile") {
    return `${baseFormat}

NIVEAU DIFFICILE:
- Enrichi avec des connaissances médicales externes
- Raisonnement et analyse complexe
- 1 à 5 bonnes réponses possibles
- Niveau concours/internat médical`;
  }

  return baseFormat;
}

function getTypePrompt(type: string, nbQuestions: number, content: string): string {
  if (type === "groupage") {
    return `Génère exactement ${nbQuestions} QCM de type GROUPAGE.

STRUCTURE GROUPAGE - TRÈS IMPORTANT:
- La question DOIT contenir l'énoncé principal SUIVI de 5 affirmations numérotées, chacune sur sa propre ligne
- Format EXACT de la question: "Concernant [sujet], quelles affirmations sont exactes?\\n1. [affirmation1]\\n2. [affirmation2]\\n3. [affirmation3]\\n4. [affirmation4]\\n5. [affirmation5]"

- Les "choices" doivent être EXACTEMENT: ["A", "B", "C", "D", "E"]
- Le barème est: A=1+2+3 vraies, B=1+3 vraies, C=2+4 vraies, D=4 uniquement, E=autre combinaison
- "correct" contient l'index de la bonne lettre (0=A, 1=B, 2=C, 3=D, 4=E)
- Tu DOIS t'assurer que les affirmations vraies/fausses correspondent bien à la lettre correcte
- L'explication doit détailler pourquoi chaque affirmation est vraie ou fausse

Cours médical:
${content}`;
  }

  if (type === "election") {
    return `Génère exactement ${nbQuestions} QCM de type ÉLECTION.

RÈGLES ÉLECTION:
- EXACTEMENT 1 SEULE bonne réponse parmi 5 propositions
- Les 4 autres sont TOUTES FAUSSES
- correct contient UN SEUL index
- 5 choix (A-E)

Cours médical:
${content}`;
  }

  if (type === "censure") {
    return `Génère exactement ${nbQuestions} QCM de type CENSURE.

RÈGLES CENSURE:
- EXACTEMENT 1 SEULE mauvaise réponse parmi 5 propositions
- Les 4 autres sont TOUTES VRAIES
- correct contient UN SEUL index correspondant à la FAUSSE proposition
- Varie les formulations: "laquelle est FAUSSE?", "SAUF UNE. Laquelle?"
- 5 choix (A-E)

Cours médical:
${content}`;
  }

  if (type === "cas-cliniques") {
    return `Génère exactement ${nbQuestions} QCM basés sur des CAS CLINIQUES.
- Vignette clinique + question diagnostique/thérapeutique
- 5 choix, 1 à 5 bonnes réponses

Cours médical:
${content}`;
  }

  if (type === "vrai-faux") {
    return `Génère exactement ${nbQuestions} QCM VRAI/FAUX.
- choices: ["Vrai", "Faux"]
- correct: [0] pour Vrai ou [1] pour Faux

Cours médical:
${content}`;
  }

  return `Génère exactement ${nbQuestions} QCM CLASSIQUES.
- 5 choix (A-E), 1 à 5 bonnes réponses
- Explication détaillée

Cours médical:
${content}`;
}

async function generateQuizForChunk(content: string, nbQuestions: number, type: string, difficulty: string) {
  console.log(`Generating ${nbQuestions} ${difficulty} questions (${type}) for chunk of ${content.length} characters`);
  
  const systemPrompt = getSystemPrompt(difficulty, type);
  const userPrompt = getTypePrompt(type, nbQuestions, content);

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
      temperature: 0.9
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[ADMIN] API error:', response.status, errText);
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
    
    const qcm = JSON.parse(cleaned);
    if (!Array.isArray(qcm)) throw new Error('Not an array');
    
    const validatedQcm = qcm.filter((q: any) => {
      if (!q.question || !Array.isArray(q.choices) || !Array.isArray(q.correct)) return false;
      return true;
    });
    
    if (validatedQcm.length === 0) throw new Error('No valid questions');
    
    console.log(`Generated ${validatedQcm.length} questions`);
    return validatedQcm;
    
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    return [{ 
      question: "⚠️ Erreur lors de la génération", 
      choices: ["Réessayer", "Fichier différent", "Fichier plus court", "Support", "Autre"],
      correct: [0],
      explanation: "Erreur de génération. Veuillez réessayer."
    }];
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
    const { content, nbQuestions, type, difficulty = "facile" } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: "Le contenu est requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (content.length < 100) {
      return new Response(JSON.stringify({ error: "Contenu trop court (min 100 car.)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (content.length > 50000) {
      return new Response(JSON.stringify({ error: "Contenu trop long (max 50000 car.)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!nbQuestions || typeof nbQuestions !== 'number' || nbQuestions < 1 || nbQuestions > 50) {
      return new Response(JSON.stringify({ error: "Nombre de questions: 1-50" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const validTypes = ['classique', 'groupage', 'cas-cliniques', 'vrai-faux', 'qcm', 'election', 'censure'];
    if (!type || !validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: "Type invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const validDifficulties = ['facile', 'intermediaire', 'difficile'];
    if (!validDifficulties.includes(difficulty)) {
      return new Response(JSON.stringify({ error: "Difficulté invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!Deno.env.get('LOVABLE_API_KEY')) {
      return new Response(JSON.stringify({ error: "Service indisponible" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Quiz gen: ${nbQuestions}q, type:${type}, diff:${difficulty}, len:${content.length}`);

    const maxChunkSize = 5000;
    let allQuestions: any[] = [];
    
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
      
      const questionsPerChunk = Math.ceil(nbQuestions / chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunkQuestions = await generateQuizForChunk(chunks[i], questionsPerChunk, type, difficulty);
          allQuestions = allQuestions.concat(chunkQuestions);
        } catch (chunkError: any) {
          if (chunkError.message === 'RATE_LIMIT' || chunkError.message === 'PAYMENT_REQUIRED') throw chunkError;
        }
      }
      allQuestions = allQuestions.slice(0, nbQuestions);
    } else {
      allQuestions = await generateQuizForChunk(content, nbQuestions, type, difficulty);
    }
    
    if (allQuestions.length === 0) {
      return new Response(JSON.stringify({ error: "Impossible de générer des questions." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    return new Response(JSON.stringify({ qcm: allQuestions }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (err: any) {
    console.error('[ADMIN] Error:', err);
    if (err.message === 'RATE_LIMIT') {
      return new Response(JSON.stringify({ error: "Limite atteinte. Réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (err.message === 'PAYMENT_REQUIRED') {
      return new Response(JSON.stringify({ error: "Quota atteint." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Erreur. Veuillez réessayer." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

serve(handler);