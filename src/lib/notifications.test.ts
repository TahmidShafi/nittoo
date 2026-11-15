// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from './notifications';

describe('notifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles unsupported Notification API gracefully', async () => {
    vi.stubGlobal('Notification', undefined);
    // Remove 'Notification' from window if present
    delete (window as unknown as Record<string, unknown>).Notification;
    expect(isBrowserNotificationSupported()).toBe(false);
    expect(getBrowserNotificationPermission()).toBe('unsupported');
    expect(await requestBrowserNotificationPermission()).toBe('unsupported');
    expect(sendBrowserNotification('Hi')).toBe(false);
  });

  it('requests permission and sends notifications when granted', async () => {
    const mockCtor = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      constructor(title: string, options?: NotificationOptions) {
        mockCtor(title, options);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    Object.defineProperty(window, 'Notification', {
      value: FakeNotification,
      configurable: true,
      writable: true,
    });

    expect(isBrowserNotificationSupported()).toBe(true);
    expect(getBrowserNotificationPermission()).toBe('granted');
    expect(await requestBrowserNotificationPermission()).toBe('granted');
    expect(sendBrowserNotification('Restock', { body: 'Buy cleanser' })).toBe(true);
    expect(mockCtor).toHaveBeenCalledWith(
      'Restock',
      expect.objectContaining({ body: 'Buy cleanser' })
    );
  });
});
