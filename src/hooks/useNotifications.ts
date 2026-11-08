// src/hooks/useNotifications.ts
import { untypedTable } from "@/lib/untypedDb";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  sendLocalNotification,
  getNotificationPermissionStatus,
} from "@/lib/notifications";

export interface AppNotification {
  id: string;
  type: "level_up" | "badge" | "course" | "quiz" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

const NOTIFICATIONS_STORAGE_KEY = "hippocampus_notifications_center_v2";

export function pushAppNotification(
  notif: Omit<AppNotification, "id" | "createdAt" | "read">,
  silent = false
) {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const list: AppNotification[] = raw ? JSON.parse(raw) : [];

    // Évite d'empiler deux fois exactement la même notification à la même seconde
    if (
      list.length > 0 &&
      list[0].title === notif.title &&
      list[0].message === notif.message
    ) {
      return;
    }

    const created: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: false,
    };
    const updated = [created, ...list].slice(0, 40);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("hippocampus-notification-pushed", {
        detail: { created, silent },
      })
    );
  } catch (e) {
    console.error(e);
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (raw) {
        setNotifications(JSON.parse(raw));
      } else {
        const initial: AppNotification[] = [
          {
            id: "welcome-notif",
            type: "system",
            title: "Centre de notifications DawJang actif",
            message:
              "Vos passages de paliers LV., vos imports de cours et vos sessions d'examen sont archivés ici en temps réel.",
            createdAt: "Aujourd'hui",
            read: false,
          },
        ];
        localStorage.setItem(
          NOTIFICATIONS_STORAGE_KEY,
          JSON.stringify(initial)
        );
        setNotifications(initial);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const handleNewNotif = () => {
      loadNotifications();
    };

    window.addEventListener("hippocampus-notification-pushed", handleNewNotif);
    return () =>
      window.removeEventListener(
        "hippocampus-notification-pushed",
        handleNewNotif
      );
  }, [loadNotifications]);

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
  };

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
 * Service d'arrière-plan vérifiant quotidiennement les révisions de flashcards
 */
export function useRevisionReminder(enabled: boolean = true) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const checkFlashcards = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const userCacheKey = `hippo_dismissed_revision_reminder_${user.id}`;
        const today = new Date().toISOString().split("T")[0];
        const lastDismissed = localStorage.getItem(userCacheKey);

        if (lastDismissed === today) {
          return;
        }

        const endOfDay = `${today}T23:59:59.999Z`;

        const { count, error } = await supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .lte("next_review", endOfDay);

        if (error || !count || count === 0) return;

        try {
          const { data: existingNotifs } = await untypedTable("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "revision_reminder")
            .gte("created_at", today + "T00:00:00Z");

          if (existingNotifs && (existingNotifs as unknown[]).length > 0) {
            localStorage.setItem(userCacheKey, today);
            return;
          }

          await untypedTable("notifications").insert({
            user_id: user.id,
            title: "🎯 Révision du jour",
            message: `Vous avez ${count} flashcard${count > 1 ? "s" : ""} à réviser aujourd'hui !`,
            type: "revision_reminder",
            link: "/flashcards",
          });
        } catch {
          // Fallback silencieux
        }

        if (getNotificationPermissionStatus() === "granted") {
          sendLocalNotification(
            "🎯 Révision du jour",
            `Vous avez ${count} flashcard${count > 1 ? "s" : ""} à réviser aujourd'hui !`,
            undefined,
            "/flashcards"
          );
        }

        localStorage.setItem(userCacheKey, today);
      } catch (err) {
        console.error("[useRevisionReminder] Erreur:", err);
      }
    };

    checkFlashcards();
    intervalRef.current = setInterval(checkFlashcards, 2 * 60 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);
}

export default useNotifications;
