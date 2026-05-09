import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

export type UserPlan = "gratuit" | "premium" | "pro" | "admin";

export interface PlanCheckResult {
  userId: string;
  plan: UserPlan;
  isAdmin: boolean;
  hasAccess: boolean;
  errorResponse?: Response;
}

export interface PlanRequirements {
  requiredPlan: "premium" | "pro";
  featureName: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Check user's subscription plan and access rights
 * Returns user info if access granted, or an error response if denied
 */
export async function checkUserPlan(
  req: Request,
  requirements: PlanRequirements
): Promise<PlanCheckResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      userId: "",
      plan: "gratuit",
      isAdmin: false,
      hasAccess: false,
      errorResponse: new Response(
        JSON.stringify({ error: "Authorization header manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Verify user token
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      userId: "",
      plan: "gratuit",
      isAdmin: false,
      hasAccess: false,
      errorResponse: new Response(
        JSON.stringify({ error: "Token invalide ou expiré" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Check if user is admin (query user_roles directly with service role
  // because rpc('is_admin') relies on auth.uid() which is NULL here)
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = !!roleRow;

  // Get user's plan from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as UserPlan) || "gratuit";

  // Admin always has access
  if (isAdmin) {
    return {
      userId: user.id,
      plan: "admin",
      isAdmin: true,
      hasAccess: true,
    };
  }

  // Check access based on required plan
  let hasAccess = false;
  if (requirements.requiredPlan === "premium") {
    hasAccess = plan === "premium" || plan === "pro";
  } else if (requirements.requiredPlan === "pro") {
    hasAccess = plan === "pro";
  }

  if (!hasAccess) {
    return {
      userId: user.id,
      plan,
      isAdmin: false,
      hasAccess: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Accès refusé",
          message: `${requirements.featureName} est réservé aux abonnés ${requirements.requiredPlan === "pro" ? "Pro" : "Premium"}.`,
          requiredPlan: requirements.requiredPlan,
          currentPlan: plan,
          upgradeRequired: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    userId: user.id,
    plan,
    isAdmin: false,
    hasAccess: true,
  };
}

/**
 * Get user info without checking plan requirements
 * Useful for features with tiered access (e.g., different limits per plan)
 */
export async function getUserPlanInfo(
  req: Request
): Promise<{ userId: string; plan: UserPlan; isAdmin: boolean } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Check if user is admin (direct query, see note in checkUserPlan)
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = !!roleRow;

  if (isAdmin) {
    return { userId: user.id, plan: "admin", isAdmin: true };
  }

  // Get user's plan from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    plan: (profile?.plan as UserPlan) || "gratuit",
    isAdmin: false,
  };
}

/**
 * Check daily usage limits for freemium users
 */
export async function checkDailyLimit(
  userId: string,
  limitType: "qcm" | "summary" | "upload",
  limits: { gratuit: number; premium: number; pro: number },
  plan: UserPlan
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  // Admin and pro have unlimited access
  if (plan === "admin" || plan === "pro") {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  const limit = plan === "premium" ? limits.premium : limits.gratuit;
  
  // For premium with high limits, consider it unlimited
  if (limit >= 1000) {
    return { allowed: true, remaining: limit, limit };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get today's usage
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let count = 0;

  if (limitType === "qcm") {
    const { count: qcmCount } = await supabase
      .from("qcm_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());
    count = qcmCount || 0;
  } else if (limitType === "summary") {
    const { count: summaryCount } = await supabase
      .from("summaries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());
    count = summaryCount || 0;
  } else if (limitType === "upload") {
    const { count: uploadCount } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());
    count = uploadCount || 0;
  }

  const remaining = Math.max(0, limit - count);
  return {
    allowed: remaining > 0,
    remaining,
    limit,
  };
}
