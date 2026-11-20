// src/components/ui/toaster.tsx
import React, { useState } from "react";
import {
  useToast,
  pauseToastTimeout,
  resumeToastTimeout,
  type ToasterToast,
} from "@/hooks/use-toast";
import { DawJangDragonIcon } from "@/components/landing/HippocampusLogo";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileUp,
  Info,
  Loader2,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationTone } from "@/lib/notificationHub";

export type SemanticToastKind =
  | "delete"
  | "level"
  | "exam"
  | "upload"
  | "copy"
  | "error"
  | "success"
  | "ai"
  | "loading"
  | "info";

/**
 * Conservé et exporté pour NotificationsDropdown.tsx et la cohérence des couleurs DawJang.
 */
export function resolveToastSemantics(
  titleText: string,
  descText: string,
  variant?: string | null,
  explicitTone?: NotificationTone
): {
  kind: SemanticToastKind;
  badgeLabel: string;
  icon: React.ReactNode;
  iconBoxClass: string;
  barClass: string;
  pillClass: string;
} {
  const combined = `${titleText} ${descText}`.toLowerCase();

  if (explicitTone === "loading") {
    return {
      kind: "loading",
      badgeLabel: "En cours",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin stroke-[2.2]" />,
      iconBoxClass: "border-primary/30 bg-primary/10 text-primary",
      barClass: "bg-[#C96442]",
      pillClass: "border-primary/25 bg-primary/10 text-primary",
    };
  }

  if (
    variant === "destructive" ||
    explicitTone === "error" ||
    /erreur|impossible|invalide|échec|refusé|manquant|illisible/.test(combined)
  ) {
    return {
      kind: "error",
      badgeLabel: "Alerte",
      icon: <AlertTriangle className="h-3.5 w-3.5 stroke-[2.2]" />,
      iconBoxClass:
        "border-rose-600/30 bg-rose-500/[0.12] text-rose-700 dark:text-rose-400",
      barClass: "bg-rose-600",
      pillClass:
        "border-rose-600/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }

  if (/supprimé|retiré|vidé|purgé|effacé|réinitialisé/.test(combined)) {
    return {
      kind: "delete",
      badgeLabel: "Suppression",
      icon: <Trash2 className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass:
        "border-[#C96442]/35 bg-[#C96442]/[0.12] text-[#C96442] dark:text-orange-400",
      barClass: "bg-[#C96442]",
      pillClass: "border-[#C96442]/25 bg-[#C96442]/10 text-[#C96442]",
    };
  }

  if (
    explicitTone === "xp" ||
    /lv\.|palier|médaille|badge|victoire|arène|duel|xp|carte débloquée/.test(
      combined
    )
  ) {
    return {
      kind: "level",
      badgeLabel: "Progression",
      icon: <Trophy className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass:
        "border-amber-600/35 bg-amber-500/[0.12] text-amber-700 dark:text-amber-400",
      barClass: "bg-amber-500",
      pillClass:
        "border-amber-500/30 bg-amber-500/[0.12] text-amber-800 dark:text-amber-300",
    };
  }

  if (
    explicitTone === "ai" ||
    /examen blanc|synthèse|résumé|sonnet|gemini|généré|audit/.test(combined)
  ) {
    return {
      kind: "ai",
      badgeLabel: "Studio IA",
      icon: <Sparkles className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass: "border-[#C96442]/35 bg-[#C96442]/[0.12] text-[#C96442]",
      barClass: "bg-[#C96442]",
      pillClass: "border-[#C96442]/25 bg-[#C96442]/10 text-[#C96442]",
    };
  }

  if (/examen|chronomètre|épreuve|copie|qcm/.test(combined)) {
    return {
      kind: "exam",
      badgeLabel: "Épreuve",
      icon: <Timer className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass: "border-[#C96442]/35 bg-[#C96442]/[0.12] text-[#C96442]",
      barClass: "bg-[#C96442]",
      pillClass: "border-[#C96442]/25 bg-[#C96442]/10 text-[#C96442]",
    };
  }

  if (/copié|presse-papiers/.test(combined)) {
    return {
      kind: "copy",
      badgeLabel: "Copié",
      icon: <Copy className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass: "border-border bg-secondary text-foreground",
      barClass: "bg-[#18181B] dark:bg-stone-300",
      pillClass: "border-border bg-secondary text-foreground",
    };
  }

  if (/import|chargé|upload|bibliothèque|ajouté|indexé/.test(combined)) {
    return {
      kind: "upload",
      badgeLabel: "Bibliothèque",
      icon: <FileUp className="h-3.5 w-3.5 stroke-[2.1]" />,
      iconBoxClass:
        "border-emerald-600/30 bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-400",
      barClass: "bg-emerald-600",
      pillClass:
        "border-emerald-600/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    };
  }

  if (
    explicitTone === "success" ||
    /enregistré|succès|prêt|créé|validé|activé|mis à jour|restauré|téléchargé|rejoint/.test(
      combined
    )
  ) {
    return {
      kind: "success",
      badgeLabel: "Confirmé",
      icon: <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.2]" />,
      iconBoxClass:
        "border-emerald-600/30 bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-400",
      barClass: "bg-emerald-600",
      pillClass:
        "border-emerald-600/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    };
  }

  return {
    kind: "info",
    badgeLabel: "Information",
    icon: <Info className="h-3.5 w-3.5 stroke-[2.1]" />,
    iconBoxClass: "border-border bg-secondary text-foreground",
    barClass: "bg-[#18181B] dark:bg-stone-300",
    pillClass: "border-border bg-secondary text-foreground",
  };
}

async function copyTextRobust(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function DawJangDesktopToastCard({
  item,
  index,
  isStackHovered,
  onDismiss,
}: {
  item: ToasterToast;
  index: number;
  isStackHovered: boolean;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const notif = item.notification;
  const titleStr = notif.title.trim();
  const descStr = (notif.message || "").trim();
  const meta = resolveToastSemantics(
    titleStr,
    descStr,
    item.variant,
    notif.tone
  );
  const durationSec = Math.max(3, (notif.durationMs || 5200) / 1000);

  const isOverflowing =
    descStr.length > 140 ||
    descStr.includes("\n") ||
    (descStr.match(/,/g) || []).length >= 4;

  const copyPayload =
    notif.copyText || `[DawJang] ${titleStr}${descStr ? `\n${descStr}` : ""}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    pauseToastTimeout(item.id);
    const ok = await copyTextRobust(copyPayload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    if (next) pauseToastTimeout(item.id);
    else resumeToastTimeout(item.id, 3800);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const act = notif.action;
    if (act?.onClick) {
      act.onClick();
      onDismiss(item.id);
      return;
    }
    const targetUrl = act?.to || notif.link;
    if (targetUrl) {
      onDismiss(item.id);
      if (targetUrl.startsWith("http")) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        window.history.pushState({}, "", targetUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  const isStackedBehind = !isStackHovered && index > 0;
  const hasAction = Boolean(notif.action || item.action);

  return (
    <div
      role={meta.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => pauseToastTimeout(item.id)}
      onMouseLeave={() => {
        if (!expanded && notif.tone !== "loading") {
          resumeToastTimeout(item.id, 3000);
        }
      }}
      style={{
        transform: isStackedBehind
          ? `translateY(-${index * 4}px) scale(${1 - index * 0.025})`
          : "translateY(0) scale(1)",
        opacity: isStackedBehind ? Math.max(0.74, 1 - index * 0.14) : 1,
        zIndex: 50 - index,
      }}
      className={cn(
        "group/toast pointer-events-auto relative w-full overflow-hidden rounded-[6px] border transition-all duration-200 ease-out",
        "bg-[#FFFFFF] dark:bg-[#1A1917] text-[#18181B] dark:text-[#F5F2EC]",
        meta.kind === "error"
          ? "border-rose-600/40 dark:border-rose-500/45"
          : "border-[#18181B]/[0.18] dark:border-white/[0.14]",
        "shadow-[0_20px_44px_-12px_rgba(18,17,15,0.24),0_6px_16px_-4px_rgba(18,17,15,0.12)] dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.82),0_6px_16px_-4px_rgba(0,0,0,0.55)]",
        "animate-in fade-in slide-in-from-right-4 duration-200"
      )}
    >
      {/* UNIQUE TRAIT FIN (1.5px) EN HAUT : joue le rôle de minuteur (droite -> gauche) */}
      <div className="h-[1.5px] w-full bg-[#18181B]/[0.06] dark:bg-white/[0.06] overflow-hidden">
        <div
          style={
            notif.tone !== "loading"
              ? { animationDuration: `${durationSec}s` }
              : undefined
          }
          className={cn(
            "h-full w-full",
            meta.barClass,
            notif.tone === "loading"
              ? "animate-pulse opacity-85"
              : "dawjang-toast-progress",
            (expanded || isStackHovered) && "[animation-play-state:paused]"
          )}
        />
      </div>

      {/* 1. BANDEAU D'EN-TÊTE ÉPURÉ : Logo + DawJang uniquement | Icônes à opacité adoucie */}
      <div className="flex items-center justify-between gap-2 border-b border-[#18181B]/[0.08] dark:border-white/[0.08] bg-[#F4F0E9] dark:bg-[#23211E] px-3.5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#18181B] text-[#FAF8F5] dark:bg-[#FAF8F5] dark:text-[#18181B] p-[1.5px]">
            <DawJangDragonIcon className="h-3 w-3" />
          </span>
          <span className="text-[12px] font-semibold tracking-[-0.015em] text-[#18181B] dark:text-[#F5F2EC] leading-none">
            DawJang
          </span>
        </div>

        {/* Bloc Copier / Déplier / Fermer : opacité diminuée au repos, pleine au survol */}
        <div
          className={cn(
            "flex items-center gap-0.5 shrink-0 transition-opacity duration-200",
            copied || expanded
              ? "opacity-100"
              : "opacity-50 group-hover/toast:opacity-75 hover:!opacity-100"
          )}
        >
          <button
            type="button"
            onClick={handleCopy}
            title="Copier le contenu de la notification"
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-[4px] px-1.5 font-mono text-[10px] font-medium transition-colors cursor-pointer",
              copied
                ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300"
                : "text-[#44403C] dark:text-stone-300 hover:bg-[#18181B]/[0.08] dark:hover:bg-white/10 hover:text-[#18181B] dark:hover:text-white"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 stroke-[2.5]" />
                <span>Copié</span>
              </>
            ) : (
              <Copy className="h-3.5 w-3.5 stroke-[1.9]" />
            )}
          </button>

          {isOverflowing && (
            <button
              type="button"
              onClick={handleToggleExpand}
              title={expanded ? "Réduire" : "Afficher tout le message"}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors cursor-pointer",
                expanded
                  ? "bg-[#C96442]/15 text-[#C96442]"
                  : "text-[#44403C] dark:text-stone-300 hover:bg-[#18181B]/[0.08] dark:hover:bg-white/10 hover:text-[#18181B] dark:hover:text-white"
              )}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="Fermer la notification"
            title="Fermer"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[#44403C] dark:text-stone-300 hover:bg-[#18181B]/[0.08] dark:hover:bg-white/10 hover:text-[#18181B] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5 stroke-[1.9]" />
          </button>
        </div>
      </div>

      {/* 2. CORPS PLEINE LARGEUR (sans second logo) : hiérarchie nette + ergonomie maximale */}
      <div className="px-4 py-3.5 space-y-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#18181B] dark:text-[#FAF8F5] leading-snug break-words">
              {titleStr}
            </h4>
            {!hasAction && notif.createdAt && (
              <span className="font-mono text-[10px] tabular-nums text-[#78716C]/80 dark:text-stone-400/75 shrink-0 pt-0.5">
                {notif.createdAt}
              </span>
            )}
          </div>

          {descStr && (
            <div className="space-y-1.5">
              {!expanded ? (
                <p
                  onClick={isOverflowing ? handleToggleExpand : undefined}
                  className={cn(
                    "text-[12.5px] text-[#57534E] dark:text-stone-300 leading-[1.48] line-clamp-3 break-words",
                    isOverflowing &&
                      "cursor-pointer hover:text-[#18181B] dark:hover:text-white transition-colors"
                  )}
                >
                  {descStr}
                </p>
              ) : (
                <div className="rounded-[4px] border border-[#18181B]/[0.12] dark:border-white/[0.12] bg-[#FAF8F5] dark:bg-[#121110] p-2.5 max-h-48 overflow-y-auto text-[11.5px] font-mono leading-relaxed text-[#18181B] dark:text-stone-200 whitespace-pre-wrap break-words select-all">
                  {descStr}
                </div>
              )}

              {isOverflowing && !expanded && (
                <button
                  type="button"
                  onClick={handleToggleExpand}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C96442] hover:underline cursor-pointer"
                >
                  <span>Afficher la suite</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Ligne d'action ergonomique + horodatage aligné à droite (sans mention "via ...") */}
        {hasAction && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {notif.action && (
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="group/cta inline-flex h-8 items-center gap-1.5 rounded-[5px] bg-[#18181B] dark:bg-[#FAF8F5] text-[#FAF8F5] dark:text-[#18181B] hover:bg-[#C96442] dark:hover:bg-[#C96442] dark:hover:text-white px-3 text-[12px] font-medium tracking-[-0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-150 active:scale-[0.98] cursor-pointer"
                >
                  <span>{notif.action.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/cta:translate-x-[1.5px] group-hover/cta:-translate-y-[1.5px]" />
                </button>
              )}
              {item.action}
            </div>

            {notif.createdAt && (
              <span className="font-mono text-[10.5px] tabular-nums text-[#78716C]/80 dark:text-stone-400/75 shrink-0">
                {notif.createdAt}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const [isStackHovered, setIsStackHovered] = useState(false);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes dawjangToastShrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .dawjang-toast-progress {
          transform-origin: left center;
          animation-name: dawjangToastShrink;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>

      <div
        aria-live="polite"
        onMouseEnter={() => setIsStackHovered(true)}
        onMouseLeave={() => setIsStackHovered(false)}
        className="pointer-events-none fixed bottom-5 right-5 z-[110] flex w-[calc(100vw-2rem)] sm:w-[384px] flex-col-reverse gap-2.5"
      >
        {toasts.map((t, index) => (
          <DawJangDesktopToastCard
            key={t.id}
            item={t}
            index={index}
            isStackHovered={isStackHovered}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </>
  );
}
