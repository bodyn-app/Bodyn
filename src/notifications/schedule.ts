// The iPhone side: permission, scheduling and test notifications through expo-notifications.
// Everything here is a local notification (works in Expo Go). Web has its own no-op version, schedule.web.ts.
import * as Notifications from 'expo-notifications';

import { upcoming } from './plan';
import type { PlannedNotification } from './types';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const toState = (p: Notifications.NotificationPermissionsStatus): PermissionState => (p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied');

export async function permissionState(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

/** Asks iOS for permission (the system prompt only appears the first time). */
export async function requestPermission(): Promise<PermissionState> {
  try {
    return toState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }));
  } catch {
    return 'unsupported';
  }
}

const content = (p: Pick<PlannedNotification, 'id' | 'title' | 'body' | 'url' | 'category'>): Notifications.NotificationContentInput => ({
  title: p.title,
  body: p.body,
  data: { url: p.url, id: p.id, category: p.category },
  interruptionLevel: 'active', // time-sensitive needs an entitlement that only a real build has
});

/** Replaces everything scheduled with the plan's future items. Returns how many were scheduled. */
export async function syncSchedule(plan: PlannedNotification[], now = new Date()): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await permissionState()) !== 'granted') return 0;
  let n = 0;
  for (const p of upcoming(plan, now)) {
    await Notifications.scheduleNotificationAsync({ identifier: p.id, content: content(p), trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at } });
    n++;
  }
  return n;
}

/** A notification 5 seconds from now. */
export async function sendTest(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'bodyn-test',
    content: content({ id: 'test', category: 'bedtime', title: 'Bodyn notifications are on', body: 'This is a test. Tap it to open your notification inbox.', url: '/notifications' }),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}

/** Sends the next three planned notifications 1, 2 and 3 minutes from now so you can see the real ones. */
export async function previewSchedule(plan: PlannedNotification[], now = new Date()): Promise<number> {
  const source = upcoming(plan, now).length >= 3 ? upcoming(plan, now) : plan;
  const first = source.slice(0, 3);
  for (const [i, p] of first.entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `bodyn-preview-${i}`,
      content: content(p),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 * (i + 1) },
    });
  }
  return first.length;
}
