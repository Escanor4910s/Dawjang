import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let result = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0;
    const codeB = i < b.length ? b.charCodeAt(i) : 0;
    result |= codeA ^ codeB;
  }
  return result === 0 && a.length === b.length;
}

const PAYTECH_API_KEY = Deno.env.get("PAYTECH_API_KEY");
const PAYTECH_API_SECRET = Deno.env.get("PAYTECH_API_SECRET");

// Compute expected hashes once at startup
let expectedKeyHash: string | null = null;
let expectedSecretHash: string | null = null;

async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getExpectedHashes() {
  if (!expectedKeyHash) {
    expectedKeyHash = await sha256(PAYTECH_API_KEY ?? "");
    expectedSecretHash = await sha256(PAYTECH_API_SECRET ?? "");
  }
  return { expectedKeyHash, expectedSecretHash };
}

const VALID_PLAN_IDS = ["premium", "pro"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Parse payload (PayTech IPN can send JSON or form data) ──
    let payload: Record<string, string> = {};

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = String(value);
      });
    }

    // ── 2. Verify IPN authenticity ────────────────────────────
    const hashes = await getExpectedHashes();

    if (
      !payload.api_key_sha256 ||
      !payload.api_secret_sha256 ||
      !timingSafeEqual(payload.api_key_sha256, hashes.expectedKeyHash || "") ||
      !timingSafeEqual(payload.api_secret_sha256, hashes.expectedSecretHash || "")
    ) {
      console.error("IPN signature mismatch — rejecting request");
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // ── 3. Handle sale_complete event ─────────────────────────
    if (payload.type_event === "sale_complete") {
      let customField: { userId?: string; planId?: string; isYearly?: boolean };
      try {
        customField = JSON.parse(payload.custom_field ?? "{}");
      } catch {
        console.error("Failed to parse custom_field:", payload.custom_field);
        return new Response("Bad custom_field", { status: 400, headers: corsHeaders });
      }

      const { userId, planId, isYearly } = customField;

      // Validate extracted data
      if (!userId || typeof userId !== 'string' || !planId || !VALID_PLAN_IDS.includes(planId)) {
        console.error("Invalid custom_field data:", customField);
        return new Response("Invalid custom_field values", { status: 400, headers: corsHeaders });
      }

      // Use service role key (admin) to update user plan
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + (isYearly ? 365 : 30));

      // Record payment in history table
      await supabaseAdmin.from("payments").insert({
        user_id: userId,
        plan_id: planId,
        amount: parseInt(payload.item_price || "0", 10),
        currency: payload.currency || "XOF",
        billing_cycle: isYearly ? "yearly" : "monthly",
        status: "completed",
        paytech_ref: payload.ref_command || null,
        paytech_token: payload.token || null,
        payment_method: payload.payment_method || null,
        completed_at: now.toISOString(),
      });

      // Update user profile with plan + expiration
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          plan: planId,
          plan_updated_at: now.toISOString(),
          plan_expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId);

      if (error) {
        console.error(`DB error upgrading user ${userId}:`, error);
        return new Response("Database update failed", { status: 500, headers: corsHeaders });
      }

      console.log(`✅ User ${userId} upgraded to ${planId} (expires ${expiresAt.toISOString()})`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("IPN processing error:", message);
    return new Response(message, { status: 400, headers: corsHeaders });
  }
});
