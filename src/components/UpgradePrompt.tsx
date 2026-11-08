// src/components/UpgradePrompt.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PremiumBadge } from "./PremiumBadge";
import { DawJangDragonIcon, DawJangWordmark } from "@/components/landing/HippocampusLogo";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface UpgradePromptProps {
  title?: string;
  description?: string;
  feature?: string;
  compact?: boolean;
  className?: string;
  onUpgrade?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  requiredPlan?: string;
  featureName?: string;
}

export function UpgradePrompt({
  title = "Passez à l'édition DawJang Pro",
  description = "Débloquez la génération illimitée de QCM par IA, le Rédacteur de résumés et le calibrage complet de vos Flashcards.",
  feature,
  compact = false,
  className,
  onUpgrade,
  isOpen,
  onClose,
  requiredPlan,
  featureName,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  if (isOpen !== undefined && !isOpen) {
    return null;
  }

  const effectiveTitle = featureName ? `Débloquez : ${featureName}` : title;
  const effectiveDescription = requiredPlan ? `Cette fonctionnalité est réservée aux abonnés ${requiredPlan === "pro" ? "DawJang Pro" : "Premium"}.` : description;

  const handleAction = () => {
    if (onClose) onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/subscription");
    }
  };

  const cardContent = (
    <Card className={cn("overflow-hidden border-0 shadow-none", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DawJangDragonIcon className="h-7 w-7 text-foreground" />
            <DawJangWordmark size="sm" />
          </div>
          <PremiumBadge label={requiredPlan === "pro" ? "Pro" : "Premium"} size="md" />
        </div>
        <CardTitle className="text-xl mt-1">{effectiveTitle}</CardTitle>
        <CardDescription>{effectiveDescription}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px]">
          {[
            "Constructeur & Générateur QCM illimité",
            "Synthèses de cours par IA & Rédacteur",
            "Mode Infini & Duels compétitifs",
            "Import de masse & révision hors-ligne",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-foreground/85">
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" />
              </div>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button onClick={handleAction}>
            <Sparkles className="h-4 w-4" />
            <span>Passer à l'offre supérieure</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {cardContent}
        </DialogContent>
      </Dialog>
    );
  }

  if (compact) {
    return (
      <div
        onClick={handleAction}
        className={cn(
          "group cursor-pointer rounded-xl border border-border bg-card p-3.5 flex items-center justify-between gap-3 transition-all duration-200 hover:border-primary/40",
          className
        )}
      >
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <DawJangDragonIcon className="h-5 w-5 text-foreground" />
            <PremiumBadge />
            <span className="text-[12.5px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {feature || "DawJang Pro"}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate">
            QCM, Flashcards & Résumés IA illimités
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DawJangDragonIcon className="h-7 w-7 text-foreground" />
            <DawJangWordmark size="sm" />
          </div>
          <PremiumBadge label="Pro" size="md" />
        </div>
        <CardTitle className="text-xl mt-1">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px]">
          {[
            "Constructeur & Générateur QCM illimité",
            "Synthèses de cours par IA & Rédacteur",
            "Mode Infini & Duels compétitifs",
            "Import de masse & révision hors-ligne",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-foreground/85">
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" />
              </div>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button onClick={handleAction}>
            <Sparkles className="h-4 w-4" />
            <span>Activer DawJang Pro</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default UpgradePrompt;
