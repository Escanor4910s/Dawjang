import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPlan = "gratuit" | "premium" | "pro" | "admin";

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

  const fetchUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is admin using the database function, known admin UID or email
      let userIsAdmin = false;
      try {
        const { data: isAdminResult } = await supabase.rpc('is_admin');
        if (isAdminResult) userIsAdmin = true;
      } catch {
        // RPC might fail or be restricted
      }

      const email = user.email ? user.email.toLowerCase().trim() : "";
      if (
        user.id === 'e647256e-12a1-46b4-8362-22ffa6ecec5f' ||
        email === 'tallathiam232@gmail.com' ||
        email === 'thiam232@gmail.com' ||
        email === 'thiam.232@gmail.com' ||
        (email.includes('thiam') && email.includes('232'))
      ) {
        userIsAdmin = true;
      }

      setIsAdmin(userIsAdmin);

      // Get user's plan from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (profile?.plan) {
        setPlan(profile.plan as UserPlan);
      } else {
        setPlan("gratuit");
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newPlan = (payload.new as any)?.plan;
            if (newPlan) {
              setPlan(newPlan as UserPlan);
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    const handleLocalPlanUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ plan?: string }>;
      if (customEvent.detail?.plan) {
        setPlan(customEvent.detail.plan as UserPlan);
      }
    };
    window.addEventListener("hippocampus_plan_updated", handleLocalPlanUpdate);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener("hippocampus_plan_updated", handleLocalPlanUpdate);
    };
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

  return { isAdmin, plan, loading, hasAccess, refetch: fetchUserRole };
};
