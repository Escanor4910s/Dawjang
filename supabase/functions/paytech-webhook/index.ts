import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYTECH_API_KEY = Deno.env.get("PAYTECH_API_KEY");
const PAYTECH_API_SECRET = Deno.env.get("PAYTECH_API_SECRET");

// Simple SHA256 helper for verification
async function sha256(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    // PayTech IPN sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const payload: any = {};
    formData.forEach((value, key) => { payload[key] = value; });

    console.log("Received PayTech IPN:", payload);

    // Verify authenticity
    const expectedKeyHash = await sha256(PAYTECH_API_KEY ?? "");
    const expectedSecretHash = await sha256(PAYTECH_API_SECRET ?? "");

    if (payload.api_key_sha256 !== expectedKeyHash || payload.api_secret_sha256 !== expectedSecretHash) {
      console.error("Invalid PayTech IPN signature");
      return new Response("Unauthorized", { status: 401 });
    }

    if (payload.type_event === "sale_complete") {
      const customField = JSON.parse(payload.custom_field);
      const { userId, planId } = customField;

      // Update user plan in database
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ 
          plan: planId,
          // Optional: add subscription dates here if needed
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user plan:", error);
        return new Response("Error updating database", { status: 500 });
      }

      console.log(`Successfully upgraded user ${userId} to ${planId}`);
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("IPN Processing Error:", error);
    return new Response(error.message, { status: 400 });
  }
});
