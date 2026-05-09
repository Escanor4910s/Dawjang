export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendLocalNotification(title: string, body: string, icon?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'hippocampus-reminder',
  });
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
