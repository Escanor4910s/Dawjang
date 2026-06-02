import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(type: string, count: number): string {
  let typeInstruction = "";
  if (type === "socratic") {
    typeInstruction = `Lis le cours fourni. Génère exactement ${count} questions ouvertes spécifiques nécessitant une liste ou explication en réponse. Format JSON attendu : [{"question": "...", "answer": "..."}].
RÈGLES: 
- Le "recto" (question) doit poser une question directe.
- Le "verso" (answer) doit lister les points ou détailler la réponse de façon concise.`;
  } else if (type === "binary") {
    typeInstruction = `Lis le cours fourni. Formule exactement ${count} affirmations cliniques (certaines vraies, certaines fausses). Format JSON attendu : [{"question": "Assertion : [Ton texte]", "answer": "VRAI / FAUX, car [Justification médicale détaillée]"}].`;
  } else if (type === "concept") {
    typeInstruction = `Lis le cours fourni. Extrais exactement ${count} concepts clés. Format JSON attendu : [{"question": "Mot-clé", "answer": "Définition & implication express"}].`;
  } else {
    typeInstruction = `Génère exactement ${count} flashcards percutantes format question/réponse. Format JSON: [{"question": "...", "answer": "..."}].`;
  }

  return `Tu es un expert en ingénierie pédagogique médicale.
Ta mission est de forger un deck de Flashcards (cartes mémoire) de très haute qualité selon la demande.

DIRECTIVES :
${typeInstruction}

- Ne pose JAMAIS de questions à choix multiples (QCM).
- Couvre l'ensemble du texte fourni de manière stratégique.
- Réponds UNIQUEMENT avec un array JSON valide (sans markdown de code de préférence, ou alors json propre). AUCUN texte avant ou après.`;
}

// shuffle function
function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const userInfo = await getUserPlanInfo(req);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { courseId, count = 10, type = "socratic", scope = "global" } = await req.json();

    if (!courseId) {
      return new Response(JSON.stringify({ error: "courseId requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the course content
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("content")
      .eq("id", courseId)
      .single();

    if (courseError || !courseData?.content) {
      return new Response(JSON.stringify({ error: "Cours introuvable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let courseContent = courseData.content;

    // Apply Scope
    if (scope === "random") {
       const paragraphs = courseContent.split(/\n\n+/).filter((p: string) => p.trim().length > 20);
       courseContent = shuffleArray(paragraphs).join('\n\n');
    }
    
    // truncate if too large to fit in context (approx 20000 chars is safe for gpt-4o)
    if (courseContent.length > 20000) {
       courseContent = courseContent.substring(0, 20000);
    }

    const systemPrompt = getSystemPrompt(type, count);
    const userPrompt = `Texte du cours :\n${courseContent}`;

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
      const errTxt = await response.text();
      console.error('API error:', response.status, errTxt);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite d'utilisation IA atteinte" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`API AI erreur ${response.status}: ${errTxt}`);
    }

    const data = await response.json();
    let rawOutput = data.choices?.[0]?.message?.content || "";

    let cleaned = rawOutput.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.trim();
    
    let flashcards = [];
    try {
      flashcards = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Erreur parsing JSON IA. Réponse brute: ${cleaned.substring(0, 50)}...`);
    }

    if (!Array.isArray(flashcards)) throw new Error("Le résultat de l'IA n'est pas une liste JSON");
    
    const validatedCards = flashcards.filter((f: any) => f.question && f.answer);

    // Insert directly to DB
    const cardsToInsert = validatedCards.map((c: any) => ({
       user_id: userInfo.userId,
       course_id: courseId,
       question: c.question,
       answer: c.answer
    }));

    if (cardsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('flashcards').insert(cardsToInsert);
      if (insertError) {
         console.error("Erreur d'insertion DB:", insertError);
         return new Response(JSON.stringify({ error: "Erreur sauvegarde des cartes en BD: " + insertError.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ success: true, count: cardsToInsert.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

serve(handler);