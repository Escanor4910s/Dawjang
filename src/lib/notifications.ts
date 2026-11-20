// src/lib/notifications.ts
// Relais système / PWA DawJang (utilisé uniquement en arrière-plan quand l'onglet n'est pas visible)

export type SystemNotificationPermission =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export function getNotificationPermissionStatus(): SystemNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  icon?: string,
  url?: string
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const targetUrl = url || "/dashboard";
  const resolvedIcon = icon || "/pwa-192x192.png";
  const options: NotificationOptions = {
    body,
    icon: resolvedIcon,
    badge: "/pwa-192x192.png",
    tag: `dawjang-${Date.now()}`,
    data: { url: targetUrl },
  };

  // 1. Priorité au Service Worker (obligatoire sur mobile/PWA et affiche l'app DawJang)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      // Poursuit sur le repli desktop ci-dessous
    }
  }

  // 2. Repli desktop (notamment en dev local sans Service Worker actif)
  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      try {
        window.focus();
        if (targetUrl.startsWith("http")) {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        } else {
          window.location.href = targetUrl;
        }
      } finally {
        notif.close();
      }
    };
  } catch (err) {
    console.warn("[DawJang Notifications] Relais système indisponible:", err);
  }
}

/**
 * Déclenche une bannière OS/PWA DawJang UNIQUEMENT si l'utilisateur a changé d'onglet
 * ou réduit l'application (évite le doublon avec la carte flottante DawJang à l'écran).
 */
export function notifyBackgroundIfHidden(
  title: string,
  body: string,
  url?: string
): void {
  if (typeof document === "undefined" || !document.hidden) return;
  if (getNotificationPermissionStatus() !== "granted") return;
  void sendLocalNotification(title, body, undefined, url);
}
