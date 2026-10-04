import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useNotificationPrefs } from '@/state/notification-prefs';

import { notifications } from './index';
import { syncSchedule } from './schedule';

/**
 * Mounted once at the root: shows notifications while the app is open, keeps the schedule in step with the settings
 * (and refreshes it whenever the app comes to the front, because the text is fixed when it is scheduled),
 * and opens the right screen when a notification is tapped.
 */
export function useNotificationSetup() {
  const router = useRouter();
  const prefs = useNotificationPrefs();
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }, []);

  const key = JSON.stringify([prefs.enabled, prefs.categories, prefs.bedtimeLeadMin, prefs.hydrationCount, prefs.quietMode, prefs.quietStart, prefs.quietEnd, prefs.dailyCap]);
  useEffect(() => {
    if (!prefs.hydrated) return;
    const sync = () => {
      const s = useNotificationPrefs.getState();
      syncSchedule(s.enabled ? notifications.plan(new Date(), s) : []).catch(() => {});
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.hydrated, key]);

  useEffect(() => {
    if (!last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = last.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url as never);
  }, [last, router]);
}
