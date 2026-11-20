// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedDb";
import {
  type DawJangNotification,
  type NotificationCategory,
  type NotificationTone,
  HUB_STORE_SYNC_EVENT,
  emitAppNotification,
  inferCategoryAndTone,
  notify,
  readCachedNotificationPrefs,
  readStoredNotifications,
  writeStoredNotifications,
} from "@/lib/notificationHub";

export interface AppNotification {
  id: string;
  type: "level_up" | "badge" | "course" | "quiz" | "system";
  category: NotificationCategory;
  tone: NotificationTone;
  title: string;
  message: string;
  createdAt: string;
  timestamp: number;
  read: boolean;
  link?: string;
  actionLabel?: string;
  copyText?: string;
}

function toLegacyCompatible(n: DawJangNotification): AppNotification {
  const type: AppNotification["type"] =
    n.category === "gamification"
      ? "level_up"
      : n.category === "ai"
      ? "quiz"
      : n.category === "study"
      ? "course"
      : "system";
  return {
    id: n.id,
    type,
    category: n.category,
    tone: n.tone,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt,
    timestamp: n.timestamp,
    read: n.read,
    link: n.link,
    actionLabel: n.actionLabel,
    copyText: n.copyText,
  };
}

export function pushAppNotification(
  notif: {
    type?: "level_up" | "badge" | "course" | "quiz" | "system";
    title: string;
    message: string;
    link?: string;
    actionLabel?: string;
  },
  silent = false
) {
  const mappedCategory: NotificationCategory | undefined =
    notif.type === "level_up" || notif.type === "badge"
      ? "gamification"
      : notif.type === "course"
      ? "study"
      : notif.type === "quiz"
      ? "ai"
      : undefined;

  emitAppNotification({
    title: notif.title,
    description: notif.message,
    category: mappedCategory,
    link: notif.link,
    action:
      notif.link && notif.actionLabel
        ? { label: notif.actionLabel, to: notif.link }
        : undefined,
    silentToast: silent,
  });
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    readStoredNotifications().map(toLegacyCompatible)
  );

  const reload = useCallback(() => {
    setNotifications(readStoredNotifications().map(toLegacyCompatible));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(HUB_STORE_SYNC_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(HUB_STORE_SYNC_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  // Synchronisation Supabase Realtime sur public.notifications (notifications serveur / multi-appareils)
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connectRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      channel = supabase
        .channel(`dawjang-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const row = payload?.new;
            if (!row?.title) return;
            const existing = readStoredNotifications();
            if (existing.some((n) => n.id === row.id)) return;
            const inferred = inferCategoryAndTone(row.title, row.message || "");
            emitAppNotification({
              id: row.id,
              title: row.title,
              description: row.message || "",
              category: (row.category as NotificationCategory) || inferred.category,
              tone: (row.type as NotificationTone) || inferred.tone,
              link: row.link || undefined,
              action: row.link
                ? { label: row.action_label || "Ouvrir", to: row.link }
                : undefined,
              playSound: true,
            });
          }
        )
        .subscribe();
    };

    void connectRealtime();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    const next = readStoredNotifications().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    writeStoredNotifications(next);
    setNotifications(next.map(toLegacyCompatible));
    // Synchronise aussi en BDD si UUID Supabase
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      void untypedTable("notifications").update({ read: true }).eq("id", id);
    }
  }, []);

  const deleteNotification = useCallback((id: string) => {
    const next = readStoredNotifications().filter((n) => n.id !== id);
    writeStoredNotifications(next);
    setNotifications(next.map(toLegacyCompatible));
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      void untypedTable("notifications").delete().eq("id", id);
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    const next = readStoredNotifications().map((n) => ({ ...n, read: true }));
    writeStoredNotifications(next);
    setNotifications(next.map(toLegacyCompatible));
  }, []);

  const clearNotifications = useCallback(() => {
    writeStoredNotifications([]);
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearNotifications,
    pushNotification: pushAppNotification,
  };
}

/**
 * Service de rappel de révision quotidien :
 * - Affiche d'abord une notification native DawJang dans l'application (avec action directe)
 * - N'utilise la notification système OS que si l'onglet est en arrière-plan (document.hidden)
 */
export function useRevisionReminder(enabled = true) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const checkFlashcards = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const userCacheKey = `dawjang_revision_reminder_${user.id}`;
        const today = new Date().toISOString().split("T")[0];
        if (localStorage.getItem(userCacheKey) === today) return;

        const endOfDay = `${today}T23:59:59.999Z`;
        const { count, error } = await supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .lte("next_review", endOfDay);

        if (error || !count || count === 0) return;

        const prefs = readCachedNotificationPrefs();
        if (!prefs.notify_flashcard_alerts && !prefs.notify_revision_reminders) {
          return;
        }

        const title = "Révision du jour prête";
        const message = `Vous avez ${count} flashcard${count > 1 ? "s" : ""} à consolider aujourd'hui pour maintenir votre courbe de rétention.`;

        notify.reminder(
          title,
          message,
          { label: "Réviser maintenant", to: "/flashcards" },
          { persistToDb: true }
        );

        localStorage.setItem(userCacheKey, today);
      } catch (err) {
        console.warn("[useRevisionReminder]", err);
      }
    };

    void checkFlashcards();
    intervalRef.current = setInterval(checkFlashcards, 2 * 60 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);
}

export default useNotifications;
