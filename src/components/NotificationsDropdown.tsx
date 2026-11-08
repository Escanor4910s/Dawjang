// src/components/NotificationsDropdown.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  Trash2,
  Trophy,
  Sparkles,
  BookOpen,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    const titleLower = String(n?.title || "").toLowerCase();
    const msgLower = String(n?.message || "").toLowerCase();
    if (n.link) {
      setIsOpen(false);
      navigate(n.link);
    } else if (
      n.type === "quiz" ||
      titleLower.includes("examen") ||
      titleLower.includes("qcm")
    ) {
      setIsOpen(false);
      navigate("/quiz");
    } else if (
      n.type === "course" ||
      titleLower.includes("cours") ||
      titleLower.includes("bibliothèque")
    ) {
      setIsOpen(false);
      navigate("/library");
    } else if (
      titleLower.includes("révision") ||
      msgLower.includes("flashcard")
    ) {
      setIsOpen(false);
      navigate("/flashcards");
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Centre de notifications"
          className="group/bell relative flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-200 outline-none"
        >
          <Bell className="h-4 w-4 transition-transform duration-200 group-hover/bell:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground shadow-xs ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={12}
        className="w-[360px] rounded-2xl border border-border/90 bg-card/95 backdrop-blur-xl p-0 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)] overflow-hidden"
      >
        {/* En-tête du Centre de Notifications */}
        <div className="flex items-center justify-between border-b border-border/80 bg-secondary/35 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-foreground">
              Centre d'activité
            </span>
            {unreadCount > 0 && (
              <span className="rounded-md border border-primary/25 bg-primary/12 px-1.5 py-[1px] font-mono text-[10px] font-bold text-primary">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="Tout marquer comme lu"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-card hover:text-primary transition-colors"
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
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-card rounded-lg transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Liste des notifications avec icônes contextuelles */}
        <div className="max-h-[340px] overflow-y-auto divide-y divide-border/60 scrollbar-none">
          {notifications.length === 0 ? (
            <div className="py-10 px-6 text-center space-y-1.5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-medium text-foreground">
                Aucune notification en attente
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                Vos actions, imports de cours et passages de niveaux LV. s'afficheront ici.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const textLower = `${n.title} ${n.message}`.toLowerCase();
              const isDel = /supprimé|retiré|vidé|purgé/.test(textLower);
              const isLevel =
                n.type === "level_up" ||
                n.type === "badge" ||
                /lv\.|palier|médaille|xp|badge/.test(textLower);
              const isCourse =
                n.type === "course" ||
                /cours|fichier|bibliothèque|import/.test(textLower);
              const isRevision =
                /révision|rappel|flashcard/.test(textLower);

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "group/notif relative flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-secondary/45",
                    !n.read && "bg-primary/[0.04]"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                      isDel
                        ? "border-[#C96442]/30 bg-[#C96442]/12 text-[#C96442]"
                        : isLevel
                        ? "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-400"
                        : isRevision
                        ? "border-primary/30 bg-primary/12 text-primary"
                        : isCourse
                        ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : "border-primary/30 bg-primary/12 text-primary"
                    )}
                  >
                    {isDel ? (
                      <Trash2 className="h-3.5 w-3.5" />
                    ) : isLevel ? (
                      <Trophy className="h-3.5 w-3.5" />
                    ) : isRevision ? (
                      <BookOpen className="h-3.5 w-3.5" />
                    ) : isCourse ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5 pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-foreground truncate flex items-center gap-1.5">
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        {n.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {n.createdAt}
                      </span>
                    </div>
                    {n.message && (
                      <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-2">
                        {n.message}
                      </p>
                    )}
                  </div>

                  {/* Bouton de suppression individuelle au survol */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(e, n.id)}
                    title="Supprimer cette notification"
                    className="absolute right-2 top-3 opacity-0 group-hover/notif:opacity-100 p-1 text-muted-foreground/60 hover:text-destructive hover:bg-secondary rounded-md transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationsDropdown;
