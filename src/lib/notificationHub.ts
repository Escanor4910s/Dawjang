// src/lib/notificationHub.ts
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedDb";
import { getSavedStudentProfile } from "@/lib/studentProfile";
import { uiAudio } from "@/utils/audio";
import { notifyBackgroundIfHidden } from "@/lib/notifications";

export type NotificationCategory = "ai" | "study" | "gamification" | "system" | "alert";
export type NotificationTone = "default" | "success" | "info" | "warning" | "error" | "ai" | "xp" | "loading";

export interface NotificationAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface DawJangNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  tone: NotificationTone;
  createdAt: string;
  timestamp: number;
  read: boolean;
  link?: string;
  actionLabel?: string;
  action?: NotificationAction;
  copyText?: string;
  durationMs?: number;
  source?: string;
}

export interface NotifyOptions {
  id?: string;
  title: string;
  description?: string;
  category?: NotificationCategory;
  tone?: NotificationTone;
  link?: string;
  action?: NotificationAction;
  copyText?: string;
  durationMs?: number;
  silentToast?: boolean; // Archive uniquement dans la cloche sans afficher le toast
  skipCenter?: boolean; // Affiche le toast sans archiver (ex: toast de chargement)
  persistToDb?: boolean;
  playSound?: boolean;
  notifyIfHidden?: boolean;
  bypassPrefs?: boolean;
  deduplicateMs?: number;
  source?: string;
}

export const HUB_STORAGE_KEY = "dawjang_notifications_hub_v3";
export const NOTIFICATION_PREFS_CACHE_KEY = "dawjang_notification_prefs_v1";

export interface NotificationPrefsSnapshot {
  notify_revision_reminders: boolean;
  notify_new_qcm: boolean;
  notify_flashcard_alerts: boolean;
  notify_weekly_results: boolean;
  notify_subscription_alerts: boolean;
}

export function cacheNotificationPrefs(prefs: Partial<NotificationPrefsSnapshot>) {
  try {
    const prev = readCachedNotificationPrefs();
    localStorage.setItem(
      NOTIFICATION_PREFS_CACHE_KEY,
      JSON.stringify({ ...prev, ...prefs })
    );
  } catch {
    // ignore
  }
}

export function readCachedNotificationPrefs(): NotificationPrefsSnapshot {
  const defaults: NotificationPrefsSnapshot = {
    notify_revision_reminders: true,
    notify_new_qcm: true,
    notify_flashcard_alerts: true,
    notify_weekly_results: true,
    notify_subscription_alerts: true,
  };
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_CACHE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}
const LEGACY_STORAGE_KEY = "hippocampus_notifications_center_v2";
const MAX_STORED_NOTIFICATIONS = 60;

export const HUB_PUSH_EVENT = "dawjang:notification-pushed";
export const HUB_UPDATE_EVENT = "dawjang:notification-updated";
export const HUB_DISMISS_EVENT = "dawjang:notification-dismissed";
export const HUB_STORE_SYNC_EVENT = "dawjang:notification-store-sync";

const recentSignatures = new Map<string, number>();

export function inferCategoryAndTone(
  title: string,
  message: string,
  explicitTone?: NotificationTone,
  explicitCategory?: NotificationCategory
): { category: NotificationCategory; tone: NotificationTone } {
  const combined = `${title} ${message}`.toLowerCase();

  let tone: NotificationTone = explicitTone || "default";
  if (!explicitTone) {
    if (/erreur|impossible|invalide|échec|refusé|manquant|illisible|alerte|hors-ligne|interromp/.test(combined)) {
      tone = "error";
    } else if (/lv\.|palier|médaille|badge|xp|victoire|carte débloquée|rang/.test(combined)) {
      tone = "xp";
    } else if (/synthèse|résumé|génér|examen blanc|ia |sonnet|gemini|audit|flashcard/.test(combined)) {
      tone = "ai";
    } else if (/attention|avertissement|doublon|limite|supprimé|retiré|purgé|réinitialisé/.test(combined)) {
      tone = "warning";
    } else if (/enregistré|succès|prêt|créé|validé|activé|mis à jour|restauré|téléchargé|copié|rejoint/.test(combined)) {
      tone = "success";
    } else {
      tone = "info";
    }
  }

  let category: NotificationCategory = explicitCategory || "system";
  if (!explicitCategory) {
    if (tone === "error") {
      category = "alert";
    } else if (tone === "xp" || /lv\.|palier|médaille|badge|xp|duel|arène|carte/.test(combined)) {
      category = "gamification";
    } else if (/synthèse|résumé|examen blanc|génér|ia |audit/.test(combined)) {
      category = "ai";
    } else if (/qcm|flashcard|révision|cours|bibliothèque|rappel|épreuve|ecos/.test(combined)) {
      category = "study";
    } else {
      category = "system";
    }
  }

  return { category, tone };
}

export function formatRelativeNotificationTime(timestamp?: number, fallback?: string): string {
  if (!timestamp || !Number.isFinite(timestamp)) return fallback || "Aujourd'hui";
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "À l'instant";
  if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) {
    return new Date(timestamp).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffSec < 172800) return "Hier";
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function migrateLegacyIfNeeded(): DawJangNotification[] {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return [];
    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed.slice(0, 40).map((item: any, idx: number) => {
      const title = String(item?.title || "Notification DawJang");
      const message = String(item?.message || "");
      const inferred = inferCategoryAndTone(title, message);
      return {
        id: String(item?.id || `migrated-${now}-${idx}`),
        title,
        message,
        category: inferred.category,
        tone: inferred.tone,
        createdAt: String(item?.createdAt || "Récent"),
        timestamp: now - idx * 60000,
        read: Boolean(item?.read),
        link: item?.link,
      };
    });
  } catch {
    return [];
  }
}

export function readStoredNotifications(): DawJangNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const migrated = migrateLegacyIfNeeded();
    if (migrated.length > 0) {
      localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const welcome: DawJangNotification[] = [
      {
        id: "dawjang-welcome-hub",
        title: "Centre d'activité DawJang actif",
        message:
          "Vos synthèses, examens blancs, rappels de flashcards et paliers LV. apparaissent ici en temps réel.",
        category: "system",
        tone: "info",
        createdAt: "Aujourd'hui",
        timestamp: Date.now(),
        read: false,
      },
    ];
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(welcome));
    return welcome;
  } catch {
    return [];
  }
}

export function writeStoredNotifications(list: DawJangNotification[]) {
  if (typeof window === "undefined") return;
  try {
    const compact = list.slice(0, MAX_STORED_NOTIFICATIONS).map(({ action: _fn, ...serializable }) => serializable);
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(compact));
    window.dispatchEvent(new CustomEvent(HUB_STORE_SYNC_EVENT));
  } catch {
    // Ignore quota localStorage
  }
}

function playSubtleFeedbackSound(tone: NotificationTone) {
  try {
    const profile = getSavedStudentProfile();
    if (profile.soundEffects === false) return;
    if (tone === "error") uiAudio.playError();
    else if (tone === "xp" || tone === "ai") uiAudio.playSuccessChime();
    else if (tone === "success" || tone === "warning") uiAudio.playNotificationPing();
  } catch {
    // Ignore Web Audio restriction avant interaction utilisateur
  }
}

async function persistNotificationToSupabase(notif: DawJangNotification) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await untypedTable("notifications").insert({
      user_id: user.id,
      title: notif.title,
      message: notif.message,
      type: notif.tone,
      category: notif.category,
      link: notif.link || null,
      action_label: notif.actionLabel || null,
      read: false,
    });
  } catch {
    // Échec silencieux si hors-ligne ou colonne non migrée
  }
}

export function emitAppNotification(opts: NotifyOptions): string {
  const title = String(opts.title || "").trim() || "Notification DawJang";
  const message = String(opts.description || "").trim();
  const { category, tone } = inferCategoryAndTone(title, message, opts.tone, opts.category);

  const dedupWindow = opts.deduplicateMs ?? 2400;
  const sig = `${tone}::${title}::${message}`;
  const now = Date.now();
  const prevTs = recentSignatures.get(sig);
  if (!opts.id && dedupWindow > 0 && prevTs && now - prevTs < dedupWindow) {
    return `dedup-${prevTs}`;
  }
  recentSignatures.set(sig, now);
  if (recentSignatures.size > 40) {
    const oldestKey = recentSignatures.keys().next().value;
    if (oldestKey) recentSignatures.delete(oldestKey);
  }

  const id = opts.id || `dj-notif-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const link = opts.link || opts.action?.to;
  const actionLabel = opts.action?.label;

  const isLongOrError = tone === "error" || message.length > 110;
  const durationMs =
    opts.durationMs ?? (tone === "loading" ? 15000 : isLongOrError ? 7200 : 4800);

  const item: DawJangNotification = {
    id,
    title,
    message,
    category,
    tone,
    createdAt: new Date(now).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    timestamp: now,
    read: false,
    link,
    actionLabel,
    action: opts.action,
    copyText: opts.copyText,
    durationMs,
    source: opts.source,
  };

  // 1. Archive dans le Centre de notifications (cloche)
  if (!opts.skipCenter && tone !== "loading") {
    const current = readStoredNotifications();
    const withoutDup = current.filter((n) => n.id !== id);
    writeStoredNotifications([item, ...withoutDup]);
  }

  // 2. Diffuse vers le DawJangToaster flottant
  if (typeof window !== "undefined" && !opts.silentToast) {
    window.dispatchEvent(new CustomEvent(HUB_PUSH_EVENT, { detail: item }));
  }

  // 3. Feedback audio subtil si activé
  if (opts.playSound && !opts.silentToast) {
    playSubtleFeedbackSound(tone);
  }

  // 4. Persistance optionnelle dans Supabase
  if (opts.persistToDb) {
    void persistNotificationToSupabase(item);
  }

  // 5. Relais discret vers l'OS/PWA uniquement si l'onglet est masqué
  if (opts.notifyIfHidden) {
    notifyBackgroundIfHidden(item.title, item.message, item.link);
  }

  return id;
}

export function updateAppNotification(id: string, patch: Partial<NotifyOptions>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HUB_UPDATE_EVENT, { detail: { id, patch } }));
}

export function dismissAppNotification(id?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HUB_DISMISS_EVENT, { detail: { id } }));
}

/**
 * API sémantique concise à utiliser dans toute l'application DawJang :
 *   notify.aiReady("Examen blanc prêt", "15 QCM vérifiés par Sonnet 4.6", { label: "Ouvrir", to: "/examen-blanc" })
 */
export const notify = {
  push: emitAppNotification,
  update: updateAppNotification,
  dismiss: dismissAppNotification,
  success: (title: string, description?: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({ title, description, tone: "success", ...extra }),
  info: (title: string, description?: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({ title, description, tone: "info", ...extra }),
  warning: (title: string, description?: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({ title, description, tone: "warning", ...extra }),
  error: (title: string, description?: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({ title, description, tone: "error", category: "alert", ...extra }),
  loading: (title: string, description?: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({ title, description, tone: "loading", skipCenter: true, ...extra }),
  aiReady: (
    title: string,
    description: string,
    action?: NotificationAction,
    extra?: Partial<NotifyOptions>
  ) => {
    const prefs = readCachedNotificationPrefs();
    if (!extra?.bypassPrefs && prefs.notify_new_qcm === false) return "";
    return emitAppNotification({
      title,
      description,
      category: "ai",
      tone: "ai",
      action,
      playSound: true,
      persistToDb: true,
      notifyIfHidden: true,
      ...extra,
    });
  },
  reminder: (
    title: string,
    description: string,
    action?: NotificationAction,
    extra?: Partial<NotifyOptions>
  ) => {
    const prefs = readCachedNotificationPrefs();
    if (
      !extra?.bypassPrefs &&
      prefs.notify_revision_reminders === false &&
      prefs.notify_flashcard_alerts === false
    ) {
      return "";
    }
    return emitAppNotification({
      title,
      description,
      category: "study",
      tone: "info",
      action,
      playSound: true,
      notifyIfHidden: true,
      ...extra,
    });
  },
  xp: (title: string, description: string, extra?: Partial<NotifyOptions>) =>
    emitAppNotification({
      title,
      description,
      category: "gamification",
      tone: "xp",
      playSound: true,
      ...extra,
    }),
};
