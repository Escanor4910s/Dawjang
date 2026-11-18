import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkUserPlan } from "../_shared/plan-utils.ts";
import { callAI, hasAiKey } from "../_shared/llm.ts";
import { extractCompletionText } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const planCheck = await checkUserPlan(req, { requiredPlan: "premium", featureName: "OCR Vision" });
  if (planCheck.errorResponse) return planCheck.errorResponse;
  if (!hasAiKey()) return json({ error: "Service IA non configuré" }, 503);

  try {
    const body = await req.json();
    const base64 = typeof body?.image === "string" ? body.image : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
    if (!ALLOWED_MIME_TYPES.has(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 8_000_000) {
      return json({ error: "Image invalide ou trop volumineuse" }, 400);
    }
    const systemPrompt = typeof body?.systemPrompt === "string"
      ? body.systemPrompt.slice(0, 4000)
      : "Transcris fidèlement tout le texte visible de ce document médical. Conserve les valeurs, unités et tableaux. Ne commente pas.";

    const response = await callAI({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
      temperature: 0,
      max_tokens: 4096,
    });
    if (!response.ok) return json({ error: "Échec de la transcription Vision" }, 502);
    const data = await response.json();
    const text = extractCompletionText(data).trim();
    if (!text) return json({ error: "Aucun texte détecté" }, 422);
    return json({ text });
  } catch (error) {
    console.error("ocr-vision:", error);
    return json({ error: "Requête OCR invalide" }, 400);
  }
});
