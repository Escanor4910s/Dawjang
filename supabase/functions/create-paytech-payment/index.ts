import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYTECH_API_KEY = Deno.env.get("PAYTECH_API_KEY");
const PAYTECH_API_SECRET = Deno.env.get("PAYTECH_API_SECRET");

const ALLOWED_ORIGINS = [
  Deno.env.get("SITE_URL") ?? "",
  "https://vhzdbhdyytvaipkbcsvs.supabase.co",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Server-side pricing — single source of truth
const PRICING: Record<string, { monthly: number; yearly: number; name: string }> = {
  premium: { monthly: 2500, yearly: 22500, name: "Plan Premium" },
  pro:     { monthly: 5000, yearly: 45000, name: "Plan Excellence" },
};

const VALID_PLAN_IDS = Object.keys(PRICING);

function isValidHttpsUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Parse & validate input ──────────────────────────────
    const body = await req.json();
    const { planId, isYearly, successUrl, cancelUrl } = body;

    if (!planId || !VALID_PLAN_IDS.includes(planId)) {
      return new Response(
        JSON.stringify({ error: `Invalid planId. Must be one of: ${VALID_PLAN_IDS.join(", ")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!successUrl || !cancelUrl || !isValidHttpsUrl(successUrl) || !isValidHttpsUrl(cancelUrl)) {
      return new Response(
        JSON.stringify({ error: "successUrl and cancelUrl must be valid HTTPS URLs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // ── 2. Authenticate user ───────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ── 3. Build PayTech request ───────────────────────────────
    const selectedPlan = PRICING[planId];
    const price = isYearly ? selectedPlan.yearly : selectedPlan.monthly;
    const refCommand = `${user.id}_${Date.now()}`;

    const formData = new URLSearchParams();
    formData.append("item_name", selectedPlan.name);
    formData.append("item_price", price.toString());
    formData.append("currency", "XOF");
    formData.append("ref_command", refCommand);
    formData.append("command_name", `Abonnement Hipocampus - ${selectedPlan.name}`);
    formData.append("env", "test"); // Change to "prod" when account is activated
    formData.append("ipn_url", `${Deno.env.get("SUPABASE_URL")}/functions/v1/paytech-webhook`);
    formData.append("success_url", successUrl);
    formData.append("cancel_url", cancelUrl);
    formData.append("custom_field", JSON.stringify({ userId: user.id, planId, isYearly }));

    const response = await fetch("https://paytech.sn/api/payment/request-payment", {
      method: "POST",
      headers: {
        "API_KEY": PAYTECH_API_KEY ?? "",
        "API_SECRET": PAYTECH_API_SECRET ?? "",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success === 1) {
      return new Response(JSON.stringify({ redirect_url: data.redirect_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      return new Response(
        JSON.stringify({ error: data.errors?.[0] || data.message || "PayTech payment initialization failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
