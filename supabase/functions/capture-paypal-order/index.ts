import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const PRICING = {
  premium: { monthly: 2500, yearly: 24000 },
  pro: { monthly: 4000, yearly: 38400 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUserPlanInfo(req);
    if (!user) return json({ error: "Authentification requise" }, 401);

    const { orderId, planId, isYearly } = await req.json();
    if (typeof orderId !== "string" || !/^[A-Z0-9-]+$/i.test(orderId) || typeof planId !== "string" || !Object.hasOwn(PRICING, planId)) {
      return json({ error: "Paramètres de paiement invalides" }, 400);
    }
    const plan = planId as keyof typeof PRICING;
    const cycle = isYearly === true ? "yearly" : "monthly";
    const expectedXof = PRICING[plan][cycle];
    const expectedEur = (expectedXof / 655.957).toFixed(2);

    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "PayPal non configuré" }, 503);
    const baseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com";

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenResponse.ok) return json({ error: "Authentification PayPal refusée" }, 502);
    const { access_token: accessToken } = await tokenResponse.json();

    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: "{}",
    });
    let capture = await captureResponse.json();
    if (!captureResponse.ok) {
      const alreadyCaptured = capture?.details?.some((detail: { issue?: string }) => detail.issue === "ORDER_ALREADY_CAPTURED");
      if (!alreadyCaptured) {
        console.error("PayPal capture refused:", captureResponse.status, capture?.name);
        return json({ error: "Capture PayPal refusée" }, 402);
      }
      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      capture = await orderResponse.json();
      if (!orderResponse.ok) return json({ error: "Commande PayPal introuvable" }, 400);
    }

    const unit = capture?.purchase_units?.[0];
    const captureDetail = unit?.payments?.captures?.[0];
    if (
      capture?.status !== "COMPLETED" ||
      captureDetail?.status !== "COMPLETED" ||
      captureDetail?.amount?.currency_code !== "EUR" ||
      captureDetail?.amount?.value !== expectedEur
    ) {
      console.error("PayPal amount or status mismatch", { orderId, plan, cycle });
      return json({ error: "Montant ou statut PayPal invalide" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("record_completed_payment", {
      p_user_id: user.userId,
      p_plan_id: plan,
      p_amount: expectedXof,
      p_currency: "XOF",
      p_billing_cycle: cycle,
      p_reference: String(captureDetail.id || orderId),
      p_provider_token: orderId,
      p_payment_method: "paypal",
      p_metadata: { paypal_order_id: orderId, paypal_capture_id: captureDetail.id },
    });
    if (error) {
      console.error("PayPal payment recording failed:", error.message);
      return json({ error: "Paiement capturé mais enregistrement impossible. Contactez le support." }, 500);
    }

    return json({ success: true, alreadyProcessed: data?.alreadyProcessed === true });
  } catch (error) {
    console.error("capture-paypal-order:", error);
    return json({ error: "Erreur de validation du paiement" }, 500);
  }
});
