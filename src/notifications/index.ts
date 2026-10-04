import { health } from '@/health';
import { metrics } from '@/metrics';

import type { Deps } from '../coach/types';
import { dayModel } from './circadian';
import { buildPlan, unreadCount, upcoming } from './plan';
import type { Prefs } from './types';

export * from './types';
export { clockText } from './circadian';
export { buildPlan, localDay, unreadCount, upcoming } from './plan';

const deps: Deps = { provider: health, metrics };

/** The app's notification plan from the real data and the real clock. */
export const notifications = {
  plan: (now: Date, prefs: Prefs) => buildPlan(deps, now, prefs),
  upcoming,
  unread: unreadCount,
  /** today's body clock: wake, focus, dip, activity, wind-down and bed */
  day: () => dayModel(deps, health.lastDay, true),
};
