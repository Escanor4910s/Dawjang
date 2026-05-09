import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface PlanGuardProps {
  requiredPlan: "premium" | "pro";
  featureName: string;
  children: React.ReactNode;
}

export const PlanGuard = ({ requiredPlan, featureName, children }: PlanGuardProps) => {
  const { hasAccess, isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const allowed = isAdmin || hasAccess(requiredPlan);

  useEffect(() => {
    if (!loading && !allowed) {
      toast.error(`${featureName} est réservé aux abonnés ${requiredPlan === "pro" ? "Pro" : "Premium / Pro"}`);
      const t = setTimeout(() => navigate("/subscription"), 800);
      return () => clearTimeout(t);
    }
  }, [loading, allowed, navigate, requiredPlan, featureName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Accès restreint</h2>
          <p className="text-sm text-muted-foreground">
            <strong>{featureName}</strong> est réservé aux abonnés {requiredPlan === "pro" ? "Pro" : "Premium / Pro"}. Redirection vers les abonnements…
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};
