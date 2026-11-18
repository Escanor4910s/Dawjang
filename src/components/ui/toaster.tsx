// src/components/ui/toaster.tsx
import React, { useState } from "react";
import {
  useToast,
  pauseToastTimeout,
  resumeToastTimeout,
} from "@/hooks/use-toast";
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
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SemanticToastKind =
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
 * la bonne icône et la bonne signature chromatique (standard Gemini / Claude / Stripe 2026)
 */
export function resolveToastSemantics(
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
  accentBorderClass: string;
} {
  const combined = `${titleText} ${descText}`.toLowerCase();

  if (
    variant === "destructive" ||
    /erreur|impossible|invalide|échec|aucun|refusé|court|manquant|illisible/.test(combined)
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
      accentBorderClass: "border-l-[3px] border-l-rose-500",
    };
  }

  if (/supprimé|retiré|vidé|purgé|effacé|réinitialisé/.test(combined)) {
    return {
      kind: "delete",
      badgeLabel: "Suppression",
      icon: <Trash2 className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-[#C96442]/35 bg-[#C96442]/12 text-[#C96442] dark:text-orange-400",
      barClass: "bg-[#C96442]",
      pillClass:
        "bg-[#C96442]/12 text-[#C96442] border-[#C96442]/25",
      accentBorderClass: "border-l-[3px] border-l-[#C96442]",
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
      accentBorderClass: "border-l-[3px] border-l-amber-500",
    };
  }

  if (/examen|chronomètre|épreuve|copie|docimologique|qcm/.test(combined)) {
    return {
      kind: "exam",
      badgeLabel: "Mode Examen",
      icon: <Timer className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-primary/40 bg-primary/12 text-primary",
      barClass: "bg-primary",
      pillClass: "bg-primary/12 text-primary border-primary/25",
      accentBorderClass: "border-l-[3px] border-l-primary",
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
      accentBorderClass: "border-l-[3px] border-l-foreground",
    };
  }

  if (/import|chargé|upload|bibliothèque|ajouté|indexé/.test(combined)) {
    return {
      kind: "upload",
      badgeLabel: "Bibliothèque",
      icon: <FileUp className="h-4 w-4 stroke-[2.1]" />,
      iconBoxClass:
        "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
      barClass: "bg-emerald-500",
      pillClass:
        "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
      accentBorderClass: "border-l-[3px] border-l-emerald-500",
    };
  }

  if (
    /enregistré|succès|prêt|créé|validé|activé|mis à jour|restauré|téléchargé|extrait/.test(
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
      accentBorderClass: "border-l-[3px] border-l-emerald-500",
    };
  }

  return {
    kind: "info",
    badgeLabel: "DawJang",
    icon: <Sparkles className="h-4 w-4 stroke-[2.1]" />,
    iconBoxClass: "border-primary/35 bg-primary/12 text-primary",
    barClass: "bg-primary",
    pillClass: "bg-primary/12 text-primary border-primary/25",
    accentBorderClass: "border-l-[3px] border-l-primary",
  };
}

function extractNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join(" ");
  if (React.isValidElement(node) && node.props?.children) {
    return extractNodeText(node.props.children);
  }
  return "";
}

function ToastCardItem({
  id,
  title,
  description,
  action,
  variant,
  createdAt,
  ...props
}: any) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const titleStr = extractNodeText(title).trim();
  const descStr = extractNodeText(description).trim();
  const meta = resolveToastSemantics(titleStr, descStr, variant);

  const isLong =
    descStr.length > 90 ||
    descStr.includes("\n") ||
    (descStr.match(/,/g) || []).length >= 2;

  const formattedPayload = `[${meta.badgeLabel}] ${titleStr || "Notification"}${
    descStr ? `\n${descStr}` : ""
  }`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    pauseToastTimeout(id);
    try {
      await navigator.clipboard.writeText(formattedPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = formattedPayload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    if (next) {
      pauseToastTimeout(id);
    } else {
      resumeToastTimeout(id, 3800);
    }
  };

  return (
    <Toast
      variant={variant}
      onMouseEnter={() => pauseToastTimeout(id)}
      onMouseLeave={() => {
        if (!expanded) resumeToastTimeout(id, 2800);
      }}
      className={cn(meta.accentBorderClass)}
      {...props}
    >
      <div className="flex items-start gap-3 w-full">
        {/* Médaillon d'icône sémantique (style Gemini / Claude / Stripe 2026) */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-transform duration-200 group-hover/toast:scale-105 mt-0.5",
            meta.iconBoxClass
          )}
        >
          {meta.icon}
        </div>

        {/* Corps principal + barre d'outils supérieure droite (Copier, Détails, Fermer) */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {title && <ToastTitle className="truncate max-w-[215px]">{title}</ToastTitle>}
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-[1px] font-mono text-[9px] font-bold uppercase tracking-wider shrink-0",
                  meta.pillClass
                )}
              >
                {meta.badgeLabel}
              </span>
            </div>

            {/* Barre d'actions rapides : Copier-Coller + Onglet Déplier + Fermer */}
            <div className="flex items-center gap-1 shrink-0 -mt-0.5 -mr-1">
              <button
                type="button"
                onClick={handleCopy}
                title="Copier l'intégralité de la notification (pour Google Antigravity ou diagnostic)"
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-lg border px-1.5 font-mono text-[10px] font-semibold transition-all cursor-pointer",
                  copied
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 stroke-[2.5]" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="hidden sm:inline">Copier</span>
                  </>
                )}
              </button>

              {isLong && (
                <button
                  type="button"
                  onClick={toggleExpand}
                  title={expanded ? "Réduire les détails" : "Déplier toute la notification"}
                  className={cn(
                    "inline-flex h-6 items-center gap-0.5 rounded-lg border px-1.5 font-mono text-[10px] font-semibold transition-all cursor-pointer",
                    expanded
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/70 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span>{expanded ? "Réduire" : "Détails"}</span>
                  {expanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}

              <ToastClose />
            </div>
          </div>

          {/* Description : compacte par défaut (2 lignes max), ou tiroir complet déroulable */}
          {description && (
            <div className="space-y-1.5">
              {!expanded ? (
                <ToastDescription
                  onClick={isLong ? toggleExpand : undefined}
                  className={cn(
                    "line-clamp-2 break-words text-[12px] leading-snug",
                    isLong && "cursor-pointer hover:text-foreground transition-colors"
                  )}
                >
                  {description}
                </ToastDescription>
              ) : (
                <div className="rounded-xl border border-border/80 bg-secondary/45 p-2.5 max-h-48 overflow-y-auto text-[11.5px] font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words select-all">
                  {descStr || description}
                </div>
              )}

              {isLong && !expanded && (
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="inline-flex items-center gap-1 text-[10.5px] font-mono font-semibold text-primary hover:underline cursor-pointer"
                >
                  <span>Afficher le détail complet ({descStr.length} caractères)</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {action && <div className="pt-1">{action}</div>}
        </div>
      </div>

      {/* Jauge temporelle vivante en pied de carte (se met en pause au survol ou quand les détails sont ouverts) */}
      <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-secondary/70 overflow-hidden">
        <div
          className={cn(
            "h-full w-full dawjang-toast-bar",
            meta.barClass,
            expanded && "!animate-none opacity-40"
          )}
        />
      </div>
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={5200}>
      <style>{`
        @keyframes dawjangToastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .dawjang-toast-bar {
          transform-origin: left center;
          animation: dawjangToastProgress 4.8s linear forwards;
        }
        .group\\/toast:hover .dawjang-toast-bar {
          animation-play-state: paused;
        }
      `}</style>

      {toasts.map((t) => (
        <ToastCardItem key={t.id} {...t} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
