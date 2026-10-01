// ==============================================================================
// Nittoo In-App & Browser Notification Helper (Stage 21)
//
// ARCHITECTURAL GUARANTEES & BROWSER LIMITATIONS:
// 1. In-App Notifications are primary and deterministic: Due reminders are surfaced
//    automatically on page load, focus refresh, and navigation without permissions.
// 2. Browser Notification API is an optional enhancement:
//    - Permission is NEVER requested on page load or automatically.
//    - It must strictly be requested after explicit user action (e.g. clicking "Enable browser reminders").
// 3. Platform Limitations:
//    - Standard web browsers (and standalone PWAs without a dedicated background push server)
//      cannot guarantee arbitrary scheduled execution while the app/tab is closed.
//    - Nittoo does NOT claim guaranteed background delivery when the browser is closed.
// ==============================================================================

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Checks whether the browser supports the Notification API.
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current browser notification permission state.
 */
export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * Requests browser notification permission STRICTLY after explicit user interaction.
 * NEVER call this on page load or component mount.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch (error) {
    console.warn('Notification permission request failed:', error);
    return getBrowserNotificationPermission();
  }
}

/**
 * Sends an immediate browser notification if permission has already been granted.
 * Gracefully falls back if unsupported or denied without throwing errors.
 */
export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      ...options,
    });
    return true;
  } catch (err) {
    console.warn('Failed to display browser notification:', err);
    return false;
  }
}
