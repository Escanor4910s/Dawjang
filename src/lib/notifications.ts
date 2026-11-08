export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendLocalNotification(title: string, body: string, icon?: string, url?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(title, {
      body,
      icon: icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'hippocampus-reminder',
    });

    notif.onclick = () => {
      try {
        window.focus();
        if (url) {
          window.location.href = url;
        } else {
          window.location.href = '/flashcards';
        }
      } catch (err) {
        console.warn('[Notification] Navigation on click failed:', err);
      } finally {
        notif.close();
      }
    };
  } catch (err) {
    console.warn('[sendLocalNotification] Failed to create Notification instance:', err);
  }
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
