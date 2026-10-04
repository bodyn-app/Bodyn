import { describe, expect, it } from 'vitest';

import type { Deps } from '../coach/types';
import type { DaySummary, SleepSession, Workout } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { createMetrics } from '../metrics/engine';
import { CAFFEINE_HOURS_BEFORE_BED, clockText, dayModel, usualWorkoutHour } from './circadian';
import { atMinutes, buildPlan, localDay, MAX_SCHEDULED, MIN_GAP_MIN, unreadCount, upcoming } from './plan';
import { CATEGORIES, DEFAULT_PREFS, type Prefs } from './types';

// ---------- a synthetic history ----------
const emptyDay = (over: Partial<DaySummary> = {}): DaySummary => ({
  steps: 5000, distanceKm: 3, activeKcal: 300, basalKcal: 1700, exerciseMin: 20, standHours: 10, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: 60, hrvAvg: 50, hrvSamples: 3,
  spo2: null, respAvg: 14, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
  ...over,
});
const night = (wakeDate: string, asleepMin = 450, wake = '07:30:00'): SleepSession => ({
  start: `${addDays(wakeDate, -1)} 23:30:00 +0200`, end: `${wakeDate} ${wake} +0200`,
  asleepMin, inBedMin: asleepMin + 30, awakeMin: 30, coreMin: 250, deepMin: 90, remMin: 110, efficiency: 94, stages: [],
});
const workout = (date: string, hour: number): Workout => ({
  type: 'Running', start: `${date} ${String(hour).padStart(2, '0')}:00:00 +0200`, end: `${date} ${String(hour + 1).padStart(2, '0')}:00:00 +0200`,
  durationMin: 45, distanceKm: 6, kcal: 400, kcalRest: 60, source: 'Apple Watch', hrAvg: 150, hrMin: 90, hrMax: 178, route: null,
});
function history(opts: { workouts?: Workout[]; lastDay?: Partial<DaySummary> } = {}) {
  const days: Record<string, DaySummary> = {};
  for (let i = 0; i < 60; i++) {
    const d = addDays('2026-01-01', i);
    days[d] = emptyDay({ sleep: night(d, 440 + (i % 5) * 5), hrvAvg: 50 + (i % 3), rhr: 58 + (i % 3) });
  }
  const keys = Object.keys(days).sort();
  const last = keys[keys.length - 1];
  if (opts.lastDay) days[last] = { ...days[last], ...opts.lastDay };
  const workouts = opts.workouts ?? [];
  const provider: HealthProvider = {
    firstDay: keys[0], lastDay: last,
    getDay: (d) => days[d],
    getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
    getWorkouts: (from, to) => workouts.filter((w) => (!from || w.start.slice(0, 10) >= from) && (!to || w.start.slice(0, 10) <= to)),
    getHrSamples: () => [],
    getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
  };
  const deps: Deps = { provider, metrics: createMetrics(provider) };
  return { deps, last };
}
const LOW_DAY: Partial<DaySummary> = { hrvAvg: 15, rhr: 82, respAvg: 17, sleep: night('2026-03-01', 290) };
const NOW = new Date(2026, 2, 5, 8, 0); // 8 Mar-ish local morning, any date works
const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...over });

describe('day model', () => {
  it('anchors the windows on the usual wake time, in a sensible order', () => {
    const { deps, last } = history();
    const m = dayModel(deps, last, false);
    expect(clockText(m.wake)).toBe('07:30');
    const [focus, dip, activity, wind] = m.windows;
    expect(focus.start).toBe(m.wake + 120);
    expect(focus.end).toBe(m.wake + 270);
    expect(dip.start).toBeGreaterThan(focus.end);
    expect(activity.start).toBeGreaterThan(dip.end);
    expect(wind.end).toBe(m.bed);
    expect(wind.start).toBe(m.bed - 60);
    expect(m.personal).toBe(true);
  });

  it('puts the caffeine cutoff 9 hours before bed', () => {
    const { deps, last } = history();
    const m = dayModel(deps, last, false);
    expect(m.caffeineCutoff).toBe(m.bed - CAFFEINE_HOURS_BEFORE_BED * 60);
  });

  it('a low-recovery day gets an earlier bedtime and a shorter focus window; an adjust-off day does not', () => {
    const { deps, last } = history({ lastDay: LOW_DAY });
    const low = dayModel(deps, last, true);
    const usual = dayModel(deps, last, false);
    expect(low.low).toBe(true);
    expect(low.early).toBe(true);
    expect(low.bed).toBe(usual.bed - 30);
    expect(low.windows[0].end - low.windows[0].start).toBeLessThan(usual.windows[0].end - usual.windows[0].start);
    expect(usual.early).toBe(false);
  });

  it('uses your own workout habit for the activity window once there are enough workouts', () => {
    const many = Array.from({ length: 8 }, (_, i) => workout(addDays('2026-01-05', i * 3), 18));
    const { deps, last } = history({ workouts: many });
    expect(usualWorkoutHour(deps)).toBe(18);
    const m = dayModel(deps, last, false);
    expect(m.windows[2].start).toBe(18 * 60);
    const few = history({ workouts: many.slice(0, 3) });
    expect(usualWorkoutHour(few.deps)).toBeNull();
  });

  it('falls back to a 07:00 wake and 23:00 bedtime when there are no nights yet', () => {
    const { deps, last } = history();
    const empty: HealthProvider = { ...deps.provider, getDay: () => undefined };
    const m = dayModel({ provider: empty, metrics: createMetrics(empty) }, last, false);
    expect(m.personal).toBe(false);
    expect(clockText(m.wake)).toBe('07:00');
    expect(clockText(m.bed)).toBe('23:00');
  });
});

describe('plan', () => {
  const { deps } = history();
  const plan = buildPlan(deps, NOW, prefs());

  it('is sorted by time, has unique stable ids and stays under the iOS limit', () => {
    expect(plan.length).toBeGreaterThan(5);
    expect(plan.length).toBeLessThanOrEqual(MAX_SCHEDULED);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThanOrEqual(plan[i - 1].at.getTime());
    const again = buildPlan(deps, NOW, prefs());
    expect(again.map((p) => p.id)).toEqual(plan.map((p) => p.id));
  });

  it('keeps at least 20 minutes between two notifications', () => {
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime() - plan[i - 1].at.getTime()).toBeGreaterThanOrEqual(MIN_GAP_MIN * 60000);
  });

  it('stays quiet while you should be asleep, except the bedtime reminder itself', () => {
    const m = dayModel(deps, deps.provider.lastDay, false);
    const start = m.bed % 1440;
    const end = m.wake % 1440;
    for (const p of plan) {
      if (p.category === 'bedtime') continue;
      const min = p.at.getHours() * 60 + p.at.getMinutes();
      const asleep = start <= end ? min >= start && min < end : min >= start || min < end;
      expect(asleep, `${p.id} at ${p.at.toString()}`).toBe(false);
    }
  });

  it('custom quiet hours are respected', () => {
    const custom = buildPlan(deps, NOW, prefs({ quietMode: 'custom', quietStart: 12 * 60, quietEnd: 15 * 60 }));
    for (const p of custom) {
      if (p.category === 'bedtime') continue;
      const min = p.at.getHours() * 60 + p.at.getMinutes();
      expect(min >= 12 * 60 && min < 15 * 60, p.id).toBe(false);
    }
  });

  it('never sends more than the daily cap in a day and keeps the highest priorities', () => {
    const capped = buildPlan(deps, NOW, prefs({ dailyCap: 3 }));
    const perDay = new Map<string, number>();
    for (const p of capped) perDay.set(localDay(p.at), (perDay.get(localDay(p.at)) ?? 0) + 1);
    for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(3);
    expect(capped.some((p) => p.category === 'bedtime')).toBe(true);
    expect(capped.filter((p) => p.category === 'hydration').length).toBeLessThan(plan.filter((p) => p.category === 'hydration').length + 1);
  });

  it('a category that is switched off produces nothing', () => {
    for (const c of CATEGORIES) {
      const off = buildPlan(deps, NOW, prefs({ categories: { ...DEFAULT_PREFS.categories, [c]: false } }));
      expect(off.some((p) => p.category === c), c).toBe(false);
    }
    const none = buildPlan(deps, NOW, prefs({ categories: { bedtime: false, focus: false, energy: false, caffeine: false, hydration: false } }));
    expect(none).toEqual([]);
  });

  it('the hydration count is honoured (at most that many per day)', () => {
    const two = buildPlan(deps, NOW, prefs({ hydrationCount: 2 }));
    const today = two.filter((p) => p.category === 'hydration' && localDay(p.at) === localDay(NOW));
    expect(today.length).toBeLessThanOrEqual(2);
  });

  it('the wind-down reminder comes exactly the chosen number of minutes before bed', () => {
    const { deps: d2, last } = history();
    const usual = dayModel(d2, last, false);
    const tonight = dayModel(d2, last, true); // today can carry an "earlier tonight" shift
    for (const lead of [30, 45, 60]) {
      const items = buildPlan(d2, NOW, prefs({ bedtimeLeadMin: lead })).filter((x) => x.category === 'bedtime');
      expect(items.length).toBe(2);
      for (const p of items) {
        const bed = p.id.endsWith(localDay(NOW)) ? tonight.bed : usual.bed;
        expect(p.at.getHours() * 60 + p.at.getMinutes()).toBe((bed - lead) % 1440);
      }
    }
  });

  it('uses the "early night" wording on a low-recovery day, the plain wind-down otherwise', () => {
    const low = history({ lastDay: LOW_DAY });
    const lowPlan = buildPlan(low.deps, NOW, prefs());
    const today = lowPlan.find((p) => p.category === 'bedtime' && p.id.endsWith(localDay(NOW)))!;
    expect(today.kind).toBe('early');
    expect(today.title).toBe('Early night tonight');
    const tomorrow = lowPlan.find((p) => p.category === 'bedtime' && !p.id.endsWith(localDay(NOW)))!;
    expect(tomorrow.kind).toBe('winddown');
  });

  it('upcoming() drops what has passed', () => {
    const later = new Date(NOW.getTime() + 6 * 3600000);
    const up = upcoming(plan, later);
    expect(up.every((p) => p.at.getTime() > later.getTime())).toBe(true);
    expect(up.length).toBeLessThan(plan.length);
  });

  it('counts what came due since the inbox was last opened, for today only', () => {
    const noon = new Date(2026, 2, 5, 12, 0);
    const due = plan.filter((p) => p.at.getTime() <= noon.getTime() && localDay(p.at) === localDay(noon)).length;
    expect(unreadCount(plan, noon, 0)).toBe(due);
    expect(unreadCount(plan, noon, noon.getTime())).toBe(0);
    expect(unreadCount(plan, new Date(2026, 2, 5, 0, 1), 0)).toBeLessThanOrEqual(1);
  });

  it('time helpers cross midnight correctly', () => {
    expect(localDay(atMinutes('2026-03-05', 1542))).toBe('2026-03-06');
    expect(atMinutes('2026-03-05', 1542).getHours()).toBe(1);
    expect(atMinutes('2026-03-05', 1542).getMinutes()).toBe(42);
  });

  it('wording is friendly, never names another product and makes no medical claims', () => {
    const all = [...plan, ...buildPlan(history({ lastDay: LOW_DAY }).deps, NOW, prefs())].map((p) => `${p.title} ${p.body}`).join(' ');
    expect(all).not.toMatch(/whoop|athlytic|oura|fitbit|garmin|strava|livity/i);
    expect(all).not.toMatch(/diagnos|disease|treat|cure|medical|doctor|illness/i);
    expect(all).not.toMatch(/undefined|NaN|null/);
  });
});
