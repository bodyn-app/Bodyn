// Builds the notifications for the rest of today and all of tomorrow, then keeps them few:
// quiet hours, a daily cap, and a minimum gap between two notifications.
import type { Deps } from '../coach/types';
import { dayModel } from './circadian';
import { wording } from './copy';
import type { DayModel, NotifCategory, PlannedNotification, Prefs } from './types';

export const MIN_GAP_MIN = 20;
export const MAX_SCHEDULED = 60; // iOS keeps at most 64 pending notifications

const PRIORITY = { bedtime: 100, caffeine: 80, focus: 70, dip: 60, activity: 55, hydration: 30 } as const;

const pad = (n: number) => String(n).padStart(2, '0');
/** local calendar day as YYYY-MM-DD */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** the moment `minutes` after local midnight of `iso` (values past 1440 land on the next day) */
export const atMinutes = (iso: string, minutes: number) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 0, Math.round(minutes));
const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

const inQuiet = (m: number, start: number, end: number) => (start <= end ? m >= start && m < end : m >= start || m < end);

type Candidate = Omit<PlannedNotification, 'at'> & { at: Date };

function candidates(iso: string, m: DayModel, low: boolean, prefs: Prefs): Candidate[] {
  const out: Candidate[] = [];
  const add = (category: NotifCategory, kind: string, minutes: number, text: { title: string; body: string }, url: string, priority: number) =>
    out.push({ id: `${category}-${kind}-${iso}`, category, kind, ...text, at: atMinutes(iso, minutes), url, priority });

  const [focus, dip, activity] = m.windows;
  add('bedtime', m.early ? 'early' : 'winddown', m.bed - prefs.bedtimeLeadMin, m.early ? wording.earlyNight(m.bed, m.recovery) : wording.windDown(m.bed), '/sleep-detail', PRIORITY.bedtime);
  add('focus', 'focus', focus.start - 10, wording.focus(focus.start, focus.end, low), '/notifications', PRIORITY.focus);
  add('energy', 'dip', dip.start - 15, wording.dip(dip.start, dip.end), '/notifications', PRIORITY.dip);
  add('energy', 'activity', activity.start - 15, wording.activity(activity.start, activity.end, low), '/notifications', PRIORITY.activity);
  if (m.caffeineCutoff != null) add('caffeine', 'lastcall', m.caffeineCutoff - 30, wording.caffeine(m.caffeineCutoff), '/quick-log', PRIORITY.caffeine);

  // evenly spread from an hour after waking to three hours before bed
  const n = Math.max(0, Math.min(6, prefs.hydrationCount));
  const from = m.wake + 60;
  const to = m.bed - 180;
  for (let i = 0; i < n && to > from; i++) {
    const t = n === 1 ? from : from + ((to - from) * i) / (n - 1);
    add('hydration', `water${i}`, Math.round(t / 5) * 5, wording.hydration(i), '/quick-log', PRIORITY.hydration);
  }
  return out;
}

/**
 * Today (from `now`'s calendar day) and tomorrow. Items before `now` stay in the list so the inbox can show
 * "today so far"; whoever schedules them drops the ones that have passed.
 */
export function buildPlan(d: Deps, now: Date, prefs: Prefs): PlannedNotification[] {
  const dataDate = d.provider.lastDay;
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const models: [string, DayModel][] = [
    [today, dayModel(d, dataDate, true)],
    [tomorrow, dayModel(d, dataDate, false)],
  ];

  const all: Candidate[] = [];
  for (const [iso, model] of models) {
    const quietStart = prefs.quietMode === 'auto' ? model.bed % 1440 : prefs.quietStart;
    const quietEnd = prefs.quietMode === 'auto' ? model.wake % 1440 : prefs.quietEnd;
    for (const c of candidates(iso, model, model.low, prefs)) {
      if (!prefs.categories[c.category]) continue;
      if (c.category !== 'bedtime' && inQuiet(minuteOfDay(c.at), quietStart, quietEnd)) continue;
      all.push(c);
    }
  }

  // keep the most important ones: one per gap window, at most `dailyCap` a day
  const perDay = new Map<string, number>();
  const kept: Candidate[] = [];
  for (const c of [...all].sort((a, b) => b.priority - a.priority || a.at.getTime() - b.at.getTime())) {
    const day = localDay(c.at);
    if ((perDay.get(day) ?? 0) >= prefs.dailyCap) continue;
    if (kept.some((k) => Math.abs(k.at.getTime() - c.at.getTime()) < MIN_GAP_MIN * 60000)) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    kept.push(c);
  }
  return kept.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

/** the part of a plan that still lies ahead */
export const upcoming = (plan: PlannedNotification[], now: Date) => plan.filter((p) => p.at.getTime() > now.getTime());

/** how many of today's notifications have come due since the inbox was last opened */
export const unreadCount = (plan: PlannedNotification[], now: Date, seenUntil: number) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return plan.filter((p) => p.at.getTime() <= now.getTime() && p.at.getTime() >= startOfToday && p.at.getTime() > seenUntil).length;
};
