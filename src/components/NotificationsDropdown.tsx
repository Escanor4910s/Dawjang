// src/components/NotificationsDropdown.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { formatRelativeNotificationTime } from "@/lib/notificationHub";
import { resolveToastSemantics } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "study_ai" | "system";

interface NotificationsDropdownProps {
  collapsed?: boolean;
  inHeader?: boolean;
}

export function NotificationsDropdown({
  collapsed = false,
  inHeader = false,
}: NotificationsDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === "unread") return !n.read;
      if (activeTab === "study_ai") return n.category === "ai" || n.category === "study" || n.category === "gamification";
      if (activeTab === "system") return n.category === "system" || n.category === "alert";
      return true;
    });
  }, [notifications, activeTab]);

  const resolveDestination = (n: AppNotification): string | null => {
    if (n.link) return n.link;
    const text = `${n.title} ${n.message}`.toLowerCase();
    if (/examen blanc/.test(text)) return "/examen-blanc";
    if (/synthèse|résumé/.test(text)) return "/summaries";
    if (/flashcard|révision/.test(text)) return "/flashcards";
    if (/qcm|quiz/.test(text)) return "/qcm";
    if (/cours|bibliothèque/.test(text)) return "/library";
    if (/lv\.|palier|médaille|badge/.test(text)) return "/settings";
    return null;
  };

  const handleOpenNotification = (n: AppNotification) => {
    markAsRead(n.id);
    const dest = resolveDestination(n);
    if (dest) {
      setIsOpen(false);
      if (dest.startsWith("http")) window.open(dest, "_blank", "noopener,noreferrer");
      else navigate(dest);
    }
  };

  const handleCopy = async (e: React.MouseEvent, n: AppNotification, badgeLabel: string) => {
    e.stopPropagation();
    markAsRead(n.id);
    const payload = n.copyText || `[${badgeLabel}] ${n.title}${n.message ? `\n${n.message}` : ""}`;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(n.id);
    setTimeout(() => setCopiedId((curr) => (curr === n.id ? null : curr)), 1800);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Boîte d'activité DawJang"
          title="Notifications DawJang"
          className={cn(
            "group/bell relative flex items-center justify-center rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-all duration-200 shrink-0 outline-none cursor-pointer",
            collapsed && !inHeader
              ? "h-8 w-8 border border-border/70 bg-card/70 hover:bg-card"
              : inHeader
              ? "h-9 w-9 rounded-xl border border-border/80 bg-card/90 hover:border-foreground/30"
              : "h-7 w-7 rounded-lg hover:bg-[#D5C9B3] dark:hover:bg-stone-800"
          )}
        >
          <Bell className="h-3.5 w-3.5 transition-transform duration-200 group-hover/bell:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground shadow-2xs ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={collapsed && !inHeader ? "right" : "bottom"}
        align={inHeader ? "end" : "start"}
        sideOffset={10}
        className="w-[min(94vw,410px)] rounded-2xl border border-[#18181B]/12 dark:border-white/12 bg-[#FFFFFF]/98 dark:bg-[#141416]/98 backdrop-blur-2xl p-0 shadow-[0_24px_60px_-14px_rgba(15,15,18,0.28)] overflow-hidden z-[90]"
      >
        {/* En-tête éditorial */}
        <div className="border-b border-border/75 bg-[#FAF8F5]/80 dark:bg-white/[0.02] px-4 pt-3.5 pb-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-[1px] font-mono text-[10px] font-bold text-primary">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  <span>Tout lire</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  title="Vider l'historique"
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Onglets de filtrage compacts */}
          <div className="flex items-center gap-1">
            {[
              { id: "all" as const, label: "Tout" },
              { id: "unread" as const, label: `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
              { id: "study_ai" as const, label: "IA & Étude" },
              { id: "system" as const, label: "Système" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  activeTab === tab.id
                    ? "bg-foreground text-background shadow-2xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des notifications */}
        <div className="max-h-[390px] overflow-y-auto divide-y divide-border/60 scrollbar-none">
          {filtered.length === 0 ? (
            <div className="py-11 px-6 text-center space-y-1.5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-medium text-foreground">
                {activeTab === "unread" ? "Tout est à jour" : "Aucune notification"}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                Vos générations IA, rappels de flashcards et paliers LV. s'afficheront ici.
              </p>
            </div>
          ) : (
            filtered.map((n) => {
              const meta = resolveToastSemantics(n.title, n.message, n.tone === "error" ? "destructive" : "default", n.tone);
              const isExpanded = Boolean(expandedIds[n.id]);
              const isCopied = copiedId === n.id;
              const dest = resolveDestination(n);
              const isLong =
                n.message.length > 90 ||
                n.message.includes("\n") ||
                (n.message.match(/,/g) || []).length >= 3;

              return (
                <div
                  key={n.id}
                  onClick={() => handleOpenNotification(n)}
                  className={cn(
                    "group/row relative flex items-start gap-3 p-3.5 transition-colors hover:bg-secondary/45 cursor-pointer",
                    !n.read && "bg-primary/[0.035]"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                      meta.iconBoxClass
                    )}
                  >
                    {meta.icon}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="text-[12.5px] font-semibold text-foreground truncate max-w-[175px]">
                          {n.title}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-[0.5px] font-mono text-[8.5px] font-semibold uppercase tracking-wider shrink-0",
                            meta.pillClass
                          )}
                        >
                          {meta.badgeLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, n, meta.badgeLabel)}
                          title="Copier cette notification"
                          className={cn(
                            "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 font-mono text-[9.5px] font-medium transition-colors cursor-pointer",
                            isCopied
                              ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                              : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-2.5 w-2.5" />
                              <span>Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>

                        {isLong && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(n.id);
                              setExpandedIds((prev) => ({ ...prev, [n.id]: !prev[n.id] }));
                            }}
                            className="inline-flex h-5 items-center gap-0.5 rounded-md border border-border/70 bg-background px-1.5 font-mono text-[9.5px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          title="Supprimer"
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground/70 hover:text-destructive rounded transition-all cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {n.message && (
                      !isExpanded ? (
                        <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-2 break-words">
                          {n.message}
                        </p>
                      ) : (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg border border-border/80 bg-[#FAF8F5] dark:bg-white/[0.04] p-2 max-h-40 overflow-y-auto text-[11px] font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words select-all"
                        >
                          {n.message}
                        </div>
                      )
                    )}

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatRelativeNotificationTime(n.timestamp, n.createdAt)}
                      </span>
                      {dest && (
                        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-primary opacity-80 group-hover/row:opacity-100">
                          <span>{n.actionLabel || "Ouvrir"}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pied de panneau : accès rapide aux réglages */}
        <div className="flex items-center justify-between border-t border-border/75 bg-[#FAF8F5]/70 dark:bg-white/[0.02] px-4 py-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            DawJang Notification Hub
          </span>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate("/settings");
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Settings2 className="h-3 w-3" />
            <span>Préférences</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationsDropdown;
