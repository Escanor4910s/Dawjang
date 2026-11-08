import React from "react";
import { UpgradePrompt } from "./UpgradePrompt";

export interface PlanGuardProps {
  children: React.ReactNode;
  requiredPlan?: "free" | "pro" | "premium";
  featureName?: string;
  allowBypass?: boolean;
}

export function PlanGuard({
  children,
  featureName,
  allowBypass = true,
}: PlanGuardProps) {
  // Ne bloque jamais l'accès à vos outils (QCM, Résumés, Infini) par défaut
  if (allowBypass) {
    return <>{children}</>;
  }

  return (
    <div className="py-8 max-w-xl mx-auto">
      <UpgradePrompt feature={featureName} />
    </div>
  );
}

export default PlanGuard;
