// supabase/functions/_shared/llm.ts
// Point d'accès unique à l'IA pour toutes les fonctions serveur.
// Modèle : Gemini 2.5 Flash via OpenRouter. La clé n'est JAMAIS dans le code :
// elle vit dans les secrets Supabase (OPENROUTER_API_KEY).
//
// Repli : si OPENROUTER_API_KEY est absente, l'ancienne passerelle Lovable
// (LOVABLE_API_KEY) reste utilisée pour ne rien casser pendant la migration.

export const AI_MODEL = "google/gemini-2.5-flash";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function hasAiKey(): boolean {
  return !!(Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_API_KEY"));
}

export function aiEndpoint(): { url: string; headers: Record<string, string>; model: string } {
  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  if (orKey) {
    return {
      url: OPENROUTER_URL,
      model: AI_MODEL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${orKey}`,
        // En-têtes d'attribution recommandés par OpenRouter
        "HTTP-Referer": Deno.env.get("APP_PUBLIC_URL") || "https://dawjang.app",
        "X-Title": "DawJang",
      },
    };
  }
  return {
    url: LOVABLE_URL,
    model: AI_MODEL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    },
  };
}

/** Appel chat-completions (format OpenAI) avec le modèle Gemini 2.5 Flash. */
export function callAI(body: Record<string, unknown>): Promise<Response> {
  const { url, headers, model } = aiEndpoint();
  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, model }),
  });
}
