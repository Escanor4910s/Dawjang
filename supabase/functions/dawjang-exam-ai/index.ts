import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import {
  handleAuditExamAnnale,
  handleGenerateExamenBlancBlock,
  handleVisionOcrExtract,
} from "../_shared/examen-blanc-ai.ts";
import { getAiPoolSummary } from "../_shared/sonnet-pool.ts";
import { getUserPlanInfo, checkExamAiActionAccess } from "../_shared/plan-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const userInfo = await getUserPlanInfo(req);
    if (!userInfo) return jsonResponse({ error: "Authentification requise" }, 401);

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Requête invalide" }, 400);
    }
    const accessError = await checkExamAiActionAccess(userInfo, body);
    if (accessError) return accessError;

    if (body?.action === "pool_status") {
      return jsonResponse({ ok: true, pool: getAiPoolSummary() });
    }

    if (body?.action === "vision_ocr_extract") {
      const res = await handleVisionOcrExtract(body);
      return jsonResponse(res, res.error ? res.status || 500 : 200);
    }

    if (body?.action === "generate_examen_blanc_block") {
      const res = await handleGenerateExamenBlancBlock(body);
      return jsonResponse(res, res.error ? res.status || 500 : 200);
    }

    if (body?.action === "audit_exam_annale") {
      const res = await handleAuditExamAnnale(body);
      return jsonResponse(res, res.error ? res.status || 500 : 200);
    }

    return jsonResponse(
      { error: `Action non reconnue : ${String(body?.action || "aucune")}` },
      400
    );
  } catch (error) {
    const invalidJson = error instanceof SyntaxError;
    return jsonResponse(
      { error: invalidJson ? "Requête JSON invalide." : "Erreur interne dawjang-exam-ai." },
      invalidJson ? 400 : 500
    );
  }
});
