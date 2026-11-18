import React from "react";
import { UpgradePrompt } from "./UpgradePrompt";
import { useUserRole } from "@/hooks/useUserRole";

export interface PlanGuardProps {
  children: React.ReactNode;
  requiredPlan?: "free" | "pro" | "premium";
  featureName?: string;
  allowBypass?: boolean;
}

export function PlanGuard({
  children,
  requiredPlan = "premium",
  featureName,
  allowBypass = false,
}: PlanGuardProps) {
  const { hasAccess, loading } = useUserRole();

  if (allowBypass || requiredPlan === "free" || (!loading && hasAccess(requiredPlan))) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" role="status">
        Vérification de votre abonnement...
      </div>
    );
  }

  return (
    <div className="py-8 max-w-xl mx-auto">
      <UpgradePrompt feature={featureName} />
    </div>
  );
}

export default PlanGuard;
