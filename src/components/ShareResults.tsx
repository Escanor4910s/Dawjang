// src/components/ShareResults.tsx
import React, { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DawJangDragonIcon, DawJangWordmark } from "@/components/landing/HippocampusLogo";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ShareResultsProps {
  title?: string;
  score?: number;
  total?: number;
  subject?: string;
  streak?: number;
  className?: string;
}

export function ShareResults({
  title = "Session d'évaluation",
  score = 18,
  total = 20,
  subject = "Médecine",
  streak = 7,
  className,
}: ShareResultsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const percentage = total > 0 ? Math.round((score / total) * 100) : 100;
  const summaryText = `DawJang — ${title} (${subject}) : ${score}/${total} (${percentage}% de réussite) • Cadence : ${streak} jours.`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    toast({
      title: "Rapport DawJang copié",
      description: "Le récapitulatif de votre session a été copié.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Résultat DawJang",
          text: summaryText,
          url: window.location.origin,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className={cn(
        "group rounded-xl border border-border/85 bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <DawJangDragonIcon className="h-8 w-8 text-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <DawJangWordmark size="sm" />
            <span className="text-border">•</span>
            <span className="text-[13.5px] font-semibold text-foreground group-hover:text-primary transition-colors">
              {title}
            </span>
            <span className="font-mono text-[11.5px] font-semibold text-primary tabular-nums">
              {percentage}%
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground font-mono tabular-nums">
            Score : {score}/{total} • {subject}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copied ? "Copié" : "Copier le score"}</span>
        </Button>
        <Button size="sm" onClick={handleNativeShare}>
          <Share2 className="h-3.5 w-3.5" />
          <span>Partager</span>
        </Button>
      </div>
    </div>
  );
}

export default ShareResults;
