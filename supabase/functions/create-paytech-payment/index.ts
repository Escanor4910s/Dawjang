import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYTECH_API_KEY = Deno.env.get("PAYTECH_API_KEY");
const PAYTECH_API_SECRET = Deno.env.get("PAYTECH_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { planId, isYearly, successUrl, cancelUrl } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Pricing mapping (matching src/config/pricing.ts)
    const pricing: any = {
      premium: { monthly: 2500, yearly: 22500, name: "Plan Premium" },
      pro: { monthly: 5000, yearly: 45000, name: "Plan Excellence" },
    };

    const selectedPlan = pricing[planId];
    if (!selectedPlan) throw new Error("Invalid plan ID");

    const price = isYearly ? selectedPlan.yearly : selectedPlan.monthly;
    const refCommand = `${user.id}_${Date.now()}`;

    // Prepare PayTech request
    const formData = new URLSearchParams();
    formData.append("item_name", selectedPlan.name);
    formData.append("item_price", price.toString());
    formData.append("currency", "XOF");
    formData.append("ref_command", refCommand);
    formData.append("command_name", `Abonnement Hipocampus - ${selectedPlan.name}`);
    formData.append("env", "test"); // Change to "prod" for live
    formData.append("ipn_url", `${Deno.env.get("SUPABASE_URL")}/functions/v1/paytech-webhook`);
    formData.append("success_url", successUrl);
    formData.append("cancel_url", cancelUrl);
    formData.append("custom_field", JSON.stringify({ userId: user.id, planId, isYearly }));

    const response = await fetch("https://paytech.sn/api/v1/payment/request-payment", {
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
      throw new Error(data.errors?.[0] || "PayTech payment initialization failed");
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
