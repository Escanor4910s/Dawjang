import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPlan = "gratuit" | "premium" | "pro" | "admin";

function activePlan(plan: unknown, expiresAt: unknown): UserPlan {
  if (typeof expiresAt === "string" && new Date(expiresAt).getTime() <= Date.now()) {
    return "gratuit";
  }
  return plan === "premium" || plan === "pro" || plan === "admin" ? plan : "gratuit";
}

interface UserRoleData {
  isAdmin: boolean;
  plan: UserPlan;
  loading: boolean;
  hasAccess: (requiredPlan: "premium" | "pro") => boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UserRoleData => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<UserPlan>("gratuit");
  const [loading, setLoading] = useState(true);
  const [authVersion, setAuthVersion] = useState(0);

  const fetchUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setPlan("gratuit");
        setLoading(false);
        return;
      }

      const { data: isAdminResult, error: adminError } = await supabase.rpc('is_admin');
      if (adminError) {
        console.error("Error checking admin role:", adminError);
      }
      setIsAdmin(Boolean(isAdminResult));

      // Get user's plan from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, plan_expires_at")
        .eq("id", user.id)
        .single();

      setPlan(activePlan(profile?.plan, profile?.plan_expires_at));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole, authVersion]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      setAuthVersion((version) => version + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Listen for realtime changes on the profiles table (plan field)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('plan-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
             
            const profile = payload.new as { plan?: unknown; plan_expires_at?: unknown };
            setPlan(activePlan(profile.plan, profile.plan_expires_at));
          }
        )
        .subscribe();
    };

    setupRealtime();

    const handleLocalPlanUpdate = () => {
      void fetchUserRole();
    };
    window.addEventListener("hippocampus_plan_updated", handleLocalPlanUpdate);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener("hippocampus_plan_updated", handleLocalPlanUpdate);
    };
  }, [fetchUserRole, authVersion]);

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

  return { isAdmin, plan, loading, hasAccess, refetch: fetchUserRole };
};
