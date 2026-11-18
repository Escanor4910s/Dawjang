import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkUserPlan } from "../_shared/plan-utils.ts";
import { extractCompletionText } from "../_shared/ai-utils.ts";
import { callAI, hasAiKey } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

/**
 * Conversation du Professeur MOR (Gemini 2.5 Flash via OpenRouter).
 * Le widget envoie { messages: [{role, content}, ...] } avec le contexte DawJang
 * déjà intégré dans le message système.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const planCheck = await checkUserPlan(req, {
    requiredPlan: "premium",
    featureName: "Assistant MOR",
  });
  if (planCheck.errorResponse) return planCheck.errorResponse;

  if (!hasAiKey()) return json({ error: "Service IA non configuré" }, 503);

  try {
    const body = await req.json();
    const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];

    // Validation stricte : rôles autorisés, contenu texte borné
    let remainingCharacters = 60000;
    const messages = raw
      .filter((m: any) => m && ALLOWED_ROLES.has(m.role) && typeof m.content === "string")
      .slice(-12)
      .reverse()
      .map((m: any) => {
        const content = m.content.slice(0, Math.min(16000, remainingCharacters));
        remainingCharacters -= content.length;
        return { role: m.role, content };
      })
      .filter((m) => m.content.length > 0)
      .reverse();

    if (!messages.some((m) => m.role === "user")) {
      return json({ error: "Message utilisateur manquant" }, 400);
    }

    const max_tokens = Math.max(256, Math.min(8192, Number(body?.max_tokens) || 4096));
    const response = await callAI({ messages, temperature: 0.45, max_tokens });

    if (!response.ok) {
      const errText = await response.text();
      console.error("mor-chat AI error:", response.status, errText.slice(0, 300));
      if (response.status === 429) return json({ error: "Trop de requêtes, réessayez dans un instant." }, 429);
      if (response.status === 402) return json({ error: "Quota IA atteint." }, 402);
      return json({ error: "Le service IA est momentanément indisponible." }, 502);
    }

    const data = await response.json();
    const reply = extractCompletionText(data).trim();
    if (!reply) return json({ error: "Réponse IA vide." }, 502);

    return json({ reply });
  } catch (err) {
    console.error("mor-chat error:", err);
    return json({ error: "Erreur serveur." }, 500);
  }
});
