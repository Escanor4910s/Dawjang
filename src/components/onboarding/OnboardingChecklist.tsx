import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DEFAULT_STEPS = [
  {
    id: "step-quiz",
    title: "Construire ou générer un premier QCM",
    desc: "Testez le constructeur manuel ou l'importation IA",
    url: "/qcm",
  },
  {
    id: "step-summary",
    title: "Structurer une fiche avec le Rédacteur IA",
    desc: "Transformez vos notes brutes en synthèse Rang A / Rang B",
    url: "/summaries",
  },
  {
    id: "step-infini",
    title: "Enchaîner 5 questions en Mode Infini",
    desc: "Évaluez vos réflexes diagnostiques en continu",
    url: "/infini",
  },
  {
    id: "step-flashcards",
    title: "Valider votre session d'ancrage quotidien",
    desc: "Consolidez votre mémoire à long terme avec FSRS",
    url: "/flashcards",
  },
];

const CHECKLIST_KEY = "hippocampus_onboarding_steps_v1";

export interface OnboardingChecklistProps {
  className?: string;
  steps?: unknown[];
  completionPercentage?: number;
  isComplete?: boolean;
  onDismiss?: () => void;
  onReset?: () => void;
}

export function OnboardingChecklist({
  className,
  onDismiss,
}: OnboardingChecklistProps = {}) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>(["step-quiz"]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCompleted(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  if (dismissed) return null;

  const toggleStep = (id: string, url: string) => {
    const updated = completed.includes(id)
      ? completed
      : [...completed, id];
    setCompleted(updated);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated));
    navigate(url);
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const progress = Math.round((completed.length / DEFAULT_STEPS.length) * 100);

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px]">
            Prise en main du Studio DawJang
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] font-semibold text-primary tabular-nums">
              {completed.length}/{DEFAULT_STEPS.length}
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              title="Masquer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <CardDescription>
          Explorez les outils essentiels de votre environnement de travail médical.
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>

      <CardContent className="space-y-1.5 pt-2">
        {DEFAULT_STEPS.map((s) => {
          const isDone = completed.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggleStep(s.id, s.url)}
              className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-secondary/60 transition-colors duration-150"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[13px] font-medium truncate transition-colors",
                      isDone
                        ? "line-through text-muted-foreground"
                        : "text-foreground group-hover:text-primary"
                    )}
                  >
                    {s.title}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground truncate">
                    {s.desc}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default OnboardingChecklist;
