import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { callAI, hasAiKey } from "../_shared/llm.ts";
import { repairAndParseQuizJson, STRICT_JSON_PROMPT_GUARD } from "../_shared/json-repair.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSystemPrompt(difficulty: string, type: string): string {
  const baseFormat = `Tu es le moteur d'intelligence docimologique Supabase AI.
Tu conçois des évaluations médicales adaptatives de haut niveau.
Tu dois répondre UNIQUEMENT avec un tableau JSON valide.

Format :
[
  {
    "question": "Énoncé de la question",
    "choices": ["Option A", "Option B", "Option C", "Option D", "Option E"],
    "correct": [0],
    "explanation": "Explication détaillée de chaque item"
  }
]`;

  return `${baseFormat}\n\n${STRICT_JSON_PROMPT_GUARD}`;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const content = body.content || body.courseText || body.text || "";
    const nbQuestions = Number(body.nbQuestions || body.count || 10);
    const type = body.type || body.format || "classique";
    const difficulty = body.difficulty || "intermediaire";

    if (!content || typeof content !== 'string' || content.length < 50) {
      return new Response(JSON.stringify({ error: "Contenu de cours manquant ou insuffisant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = getSystemPrompt(difficulty, type);
    const userPrompt = `Génère ${nbQuestions} questions docimologiques (${type}, difficulté ${difficulty}) sur le support de cours ci-dessous :\n\n${content.slice(0, 15000)}`;

    const response = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Erreur moteur IA", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || "";

    const parsed = repairAndParseQuizJson(rawOutput);
    const qcm = Array.isArray(parsed) ? parsed : (parsed?.qcm || parsed?.questions || [parsed]);

    return new Response(JSON.stringify({ qcm, questions: qcm }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[generate-quiz-supabase-ai] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erreur de génération" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
