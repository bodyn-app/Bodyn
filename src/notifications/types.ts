export type NotifCategory = 'bedtime' | 'focus' | 'energy' | 'caffeine' | 'hydration';
export const CATEGORIES: NotifCategory[] = ['bedtime', 'focus', 'energy', 'caffeine', 'hydration'];

export type Prefs = {
  /** master switch */
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  /** minutes before bedtime for the wind-down reminder */
  bedtimeLeadMin: number;
  hydrationCount: number;
  /** quiet hours: "auto" = while you should be asleep (bedtime to wake time); "custom" uses start/end (minutes after midnight) */
  quietMode: 'auto' | 'custom';
  quietStart: number;
  quietEnd: number;
  /** most notifications per day */
  dailyCap: number;
};

export const DEFAULT_PREFS: Prefs = {
  enabled: true,
  categories: { bedtime: true, focus: true, energy: true, caffeine: true, hydration: true },
  bedtimeLeadMin: 45,
  hydrationCount: 4,
  quietMode: 'auto',
  quietStart: 23 * 60,
  quietEnd: 7 * 60,
  dailyCap: 6,
};

export type PlannedNotification = {
  /** stable: the same item gets the same id every time the plan is rebuilt */
  id: string;
  category: NotifCategory;
  kind: string;
  title: string;
  body: string;
  at: Date;
  /** screen to open when tapped */
  url: string;
  /** higher wins when the daily cap or the minimum gap forces a choice */
  priority: number;
};

export type WindowKey = 'focus' | 'dip' | 'activity' | 'winddown';
/** minutes after local midnight of the plan day; can pass 1440 for late nights */
export type DayWindow = { key: WindowKey; start: number; end: number };
export type DayModel = {
  wake: number;
  /** bedtime, never earlier than the wake time (so 01:42 is 1542) */
  bed: number;
  /** the usual bedtime, before any "earlier tonight" shift */
  usualBed: number;
  windows: DayWindow[];
  caffeineCutoff: number | null;
  /** an earlier bedtime was suggested tonight (low recovery or built-up sleep debt) */
  early: boolean;
  /** a low-recovery day: lighter wording, shorter focus window */
  low: boolean;
  recovery: number | null;
  /** the wake/bed times come from the user's own recent nights */
  personal: boolean;
};
