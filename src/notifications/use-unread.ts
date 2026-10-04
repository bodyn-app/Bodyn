import { useMemo } from 'react';

import { useNotificationPrefs } from '@/state/notification-prefs';

import { notifications } from './index';

/** Unread count for the Home bell: notifications that came due today since the inbox was last opened. */
export function useUnread(now = new Date()) {
  const p = useNotificationPrefs();
  const minute = Math.floor(now.getTime() / 60000);
  return useMemo(() => {
    if (!p.enabled || !p.hydrated) return 0;
    return notifications.unread(notifications.plan(new Date(minute * 60000), p), new Date(minute * 60000), p.seenUntil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, p.enabled, p.hydrated, p.categories, p.bedtimeLeadMin, p.hydrationCount, p.quietMode, p.quietStart, p.quietEnd, p.dailyCap, p.seenUntil]);
}
