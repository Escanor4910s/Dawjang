import { useNavigate } from "react-router-dom";
import { Zap, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  requiredPlan: "premium" | "pro";
  featureName?: string;
}

export const UpgradePrompt = ({ 
  isOpen, 
  onClose, 
  requiredPlan, 
  featureName 
}: UpgradePromptProps) => {
  const navigate = useNavigate();
  const isPro = requiredPlan === "pro";

  const handleUpgrade = () => {
    onClose();
    navigate("/subscription");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isPro ? "bg-violet-100 dark:bg-violet-900/30" : "bg-amber-100 dark:bg-amber-900/30"
          }`}>
            {isPro ? (
              <Crown className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            ) : (
              <Zap className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            Fonctionnalité {isPro ? "Pro" : "Premium"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {featureName ? (
              <>
                <strong>{featureName}</strong> est réservé aux abonnés {isPro ? "Pro" : "Premium"}.
              </>
            ) : (
              <>Cette fonctionnalité est réservée aux abonnés {isPro ? "Pro" : "Premium"}.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className={`p-4 rounded-xl border-2 ${
            isPro ? "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
          }`}>
            <h4 className="font-semibold mb-2">
              {isPro ? "🚀 Plan Pro" : "⚡ Plan Premium"}
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {isPro ? (
                <>
                  <li>✓ Tout Premium inclus</li>
                  <li>✓ Fusion multi-cours</li>
                  <li>✓ Fascicules 100+ QCM</li>
                  <li>✓ Export PDF avancé</li>
                  <li>✓ Agent MOR prioritaire</li>
                </>
              ) : (
                <>
                  <li>✓ QCM illimités</li>
                  <li>✓ Résumés complets</li>
                  <li>✓ Export PDF</li>
                  <li>✓ Agent MOR</li>
                  <li>✓ Mode examen</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Plus tard
            </Button>
            <Button 
              onClick={handleUpgrade}
              className={`flex-1 ${
                isPro 
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700" 
                  : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              } text-white`}
            >
              Passer à {isPro ? "Pro" : "Premium"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
