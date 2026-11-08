// src/components/ui/toaster.tsx
import React from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Timer,
  FileUp,
  Copy,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SemanticToastKind =
  | "delete"
  | "level"
  | "exam"
  | "upload"
  | "copy"
  | "error"
  | "success"
  | "info";

/**
 * Détecte automatiquement la nature exacte de l'action pour afficher
 * la bonne icône et la bonne signature chromatique (zéro icône (i) générique)
 */
function resolveToastSemantics(
  titleText: string,
  descText: string,
  variant?: string | null
): {
  kind: SemanticToastKind;
  badgeLabel: string;
  icon: React.ReactNode;
  iconBoxClass: string;
  barClass: string;
  pillClass: string;
} {
  const combined = `${titleText} ${descText}`.toLowerCase();

  if (
    variant === "destructive" ||
    /erreur|impossible|invalide|échec|aucun|refusé|court/.test(combined)
  ) {
    return {
      kind: "error",
      badgeLabel: "Alerte Système",
      icon: <AlertTriangle className="h-4 w-4 stroke-[2.2]" />,
      iconBoxClass:
        "border-rose-500/35 bg-rose-500/12 text-rose-600 dark:text-rose-400",
      barClass: "bg-rose-500",
      pillClass:
        "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25",
    };
  }

  if (/supprimé|retiré|vidé|purgé|effacé/.test(combined)) {
    return {
      kind: "delete",
      badgeLabel: "Suppression",
      icon: <Trash2 className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-orange-500/35 bg-orange-500/12 text-[#C96442] dark:text-orange-400",
      barClass: "bg-[#C96442]",
      pillClass:
        "bg-[#C96442]/12 text-[#C96442] border-[#C96442]/25",
    };
  }

  if (/lv\.|palier|médaille|badge|victoire|arène|duel|elo|xp/.test(combined)) {
    return {
      kind: "level",
      badgeLabel: "Progression LV.",
      icon: <Trophy className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
      barClass: "bg-amber-500",
      pillClass:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  }

  if (/examen|chronomètre|épreuve/.test(combined)) {
    return {
      kind: "exam",
      badgeLabel: "Mode Examen",
      icon: <Timer className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-primary/40 bg-primary/12 text-primary",
      barClass: "bg-primary",
      pillClass: "bg-primary/12 text-primary border-primary/25",
    };
  }

  if (/copié|presse-papiers|code/.test(combined)) {
    return {
      kind: "copy",
      badgeLabel: "Presse-papiers",
      icon: <Copy className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-foreground/20 bg-secondary text-foreground",
      barClass: "bg-foreground",
      pillClass: "bg-secondary text-foreground border-border",
    };
  }

  if (/import|chargé|upload|bibliothèque|ajouté/.test(combined)) {
    return {
      kind: "upload",
      badgeLabel: "Bibliothèque",
      icon: <FileUp className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      barClass: "bg-emerald-500",
      pillClass:
        "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    };
  }

  if (
    /enregistré|succès|prêt|créé|validé|activé|mis à jour|restauré|téléchargé/.test(
      combined
    )
  ) {
    return {
      kind: "success",
      badgeLabel: "Confirmé",
      icon: <CheckCircle2 className="h-4 w-4 stroke-[2.2]" />,
      iconBoxClass:
        "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      barClass: "bg-emerald-500",
      pillClass:
        "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    };
  }

  return {
    kind: "info",
    badgeLabel: "DawJang",
    icon: <Sparkles className="h-4 w-4 stroke-[2.1]" />,
    iconBoxClass: "border-primary/35 bg-primary/12 text-primary",
    barClass: "bg-primary",
    pillClass: "bg-primary/12 text-primary border-primary/25",
  };
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={4200}>
      <style>{`
        @keyframes dawjangToastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .dawjang-toast-bar {
          transform-origin: left center;
          animation: dawjangToastProgress 4.2s linear forwards;
        }
        .group\\/toast:hover .dawjang-toast-bar {
          animation-play-state: paused;
        }
      `}</style>

      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        const titleStr = typeof title === "string" ? title : "";
        const descStr = typeof description === "string" ? description : "";
        const meta = resolveToastSemantics(titleStr, descStr, variant);

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3.5 w-full pr-6">
              {/* Médaillon d'icône sculpté à gauche (sans espace vide) */}
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-300 group-hover/toast:scale-105",
                  meta.iconBoxClass
                )}
              >
                {meta.icon}
              </div>

              {/* Corps typographique aligné au cordeau */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-1.5 py-[1px] font-mono text-[9.5px] font-semibold uppercase tracking-wider",
                      meta.pillClass
                    )}
                  >
                    {meta.badgeLabel}
                  </span>
                </div>

                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>

              {/* Action éventuelle */}
              {action && <div className="shrink-0 self-center">{action}</div>}
            </div>

            {/* Bouton de fermeture tactile */}
            <ToastClose />

            {/* Jauge temporelle vivante en pied de carte (pause au survol) */}
            <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-secondary/70 overflow-hidden">
              <div
                className={cn("h-full w-full dawjang-toast-bar", meta.barClass)}
              />
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
