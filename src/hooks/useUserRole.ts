import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPlan = "gratuit" | "premium" | "pro" | "admin";

interface UserRoleData {
  isAdmin: boolean;
  plan: UserPlan;
  loading: boolean;
  hasAccess: (requiredPlan: "premium" | "pro") => boolean;
}

export const useUserRole = (): UserRoleData => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<UserPlan>("gratuit");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Check if user is admin using the database function
        const { data: isAdminResult } = await supabase.rpc('is_admin');
        setIsAdmin(!!isAdminResult);

        // Get user's plan from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        if (profile?.plan) {
          setPlan(profile.plan as UserPlan);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const hasAccess = (requiredPlan: "premium" | "pro"): boolean => {
    if (isAdmin) return true;
    if (requiredPlan === "premium") {
      return plan === "premium" || plan === "pro";
    }
    if (requiredPlan === "pro") {
      return plan === "pro";
    }
    return false;
  };

  return { isAdmin, plan, loading, hasAccess };
};
