// Small pure functions over the per-day metrics. They are the facts the coach's answers are built from.
import { addDays } from '../health/provider';
import type { Workout } from '../data/types';
import { fmtMin, ZONE_EDGES } from '../metrics/engine';
import type { Contributor } from '../metrics/engine';
import { mean, median } from '../metrics/math';
import type { Deps } from './types';

export type MetricKey =
  | 'recovery' | 'sleepScore' | 'sleepMin' | 'deep' | 'rem' | 'strain' | 'stress' | 'hrv' | 'rhr' | 'steps' | 'kcal'
  | 'sleepConsistency' | 'hrZone13' | 'hrZone45' | 'strengthMin' | 'leanMass' | 'vo2';

/** Strength-type workouts, for the "Strength activity time" fitness-age metric. */
export const STRENGTH_TYPES = new Set(['TraditionalStrengthTraining', 'CoreTraining']);

type Info = { label: string; unit: string; higherIsBetter: boolean | null; night: boolean; partialToday: boolean; fmt: (v: number) => string };
const n0 = (v: number) => String(Math.round(v));
const n1 = (v: number) => v.toFixed(1);
export const METRIC: Record<MetricKey, Info> = {
  recovery: { label: 'recovery', unit: '%', higherIsBetter: true, night: false, partialToday: false, fmt: n0 },
  sleepScore: { label: 'sleep score', unit: '%', higherIsBetter: true, night: true, partialToday: false, fmt: n0 },
  sleepMin: { label: 'sleep time', unit: '', higherIsBetter: true, night: true, partialToday: false, fmt: fmtMin },
  deep: { label: 'deep sleep', unit: '', higherIsBetter: true, night: true, partialToday: false, fmt: fmtMin },
  rem: { label: 'REM sleep', unit: '', higherIsBetter: true, night: true, partialToday: false, fmt: fmtMin },
  strain: { label: 'strain', unit: '/21', higherIsBetter: null, night: false, partialToday: true, fmt: n1 },
  stress: { label: 'stress', unit: '/3', higherIsBetter: false, night: false, partialToday: true, fmt: n1 },
  hrv: { label: 'HRV', unit: 'ms', higherIsBetter: true, night: false, partialToday: false, fmt: n0 },
  rhr: { label: 'resting heart rate', unit: 'bpm', higherIsBetter: false, night: false, partialToday: false, fmt: n0 },
  steps: { label: 'steps', unit: '', higherIsBetter: true, night: false, partialToday: true, fmt: (v) => Math.round(v).toLocaleString('en-US') },
  kcal: { label: 'active calories', unit: 'kcal', higherIsBetter: true, night: false, partialToday: true, fmt: n0 },
  sleepConsistency: { label: 'sleep consistency', unit: '/100', higherIsBetter: true, night: true, partialToday: false, fmt: n0 },
  // zone 1 (under 60% of max HR) covers almost all resting and sleeping time, so it swamps any real training
  // signal — this groups the light-to-moderate exercise zones only (2–3), excluding pure rest
  hrZone13: { label: 'time in zones 2–3', unit: 'min', higherIsBetter: true, night: false, partialToday: true, fmt: n0 },
  hrZone45: { label: 'time in zones 4–5', unit: 'min', higherIsBetter: true, night: false, partialToday: true, fmt: n0 },
  strengthMin: { label: 'strength activity time', unit: 'min', higherIsBetter: true, night: false, partialToday: true, fmt: n0 },
  leanMass: { label: 'lean body mass', unit: '%', higherIsBetter: true, night: false, partialToday: false, fmt: n1 },
  vo2: { label: 'VO2 max', unit: 'mL/kg/min', higherIsBetter: true, night: false, partialToday: false, fmt: n1 },
};
export const fmtMetric = (key: MetricKey, v: number) => {
  const u = METRIC[key].unit;
  return `${METRIC[key].fmt(v)}${u === '%' ? '%' : u ? ` ${u}` : ''}`;
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekdayName = (dow: number) => DOW_NAMES[dow];
export const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const clockMin = (stamp: string) => +stamp.slice(11, 13) * 60 + +stamp.slice(14, 16);
export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function metricValue(d: Deps, key: MetricKey, date: string): number | null {
  const day = d.provider.getDay(date);
  if (!day) return null;
  let v: number | null | undefined;
  switch (key) {
    case 'recovery': v = d.metrics.recovery(date)?.score; break;
    case 'sleepScore': v = d.metrics.sleep(date)?.score; break;
    case 'sleepMin': v = day.sleep?.asleepMin; break;
    case 'deep': v = day.sleep?.deepMin; break;
    case 'rem': v = day.sleep?.remMin; break;
    case 'strain': v = d.metrics.strain(date)?.strain; break;
    case 'stress': v = d.metrics.stress(date)?.level; break;
    case 'hrv': v = day.overnight?.hrv ?? day.hrvAvg; break;
    case 'rhr': v = day.rhr; break;
    case 'steps': v = day.steps; break;
    case 'kcal': v = day.activeKcal; break;
    case 'sleepConsistency': v = d.metrics.sleep(date)?.components.find((c) => c.key === 'consistency')?.score ?? null; break;
    case 'hrZone13': { const z = d.metrics.strain(date)?.zones; v = z ? z[1] + z[2] : null; break; }
    case 'hrZone45': { const z = d.metrics.strain(date)?.zones; v = z ? z[3] + z[4] : null; break; }
    case 'strengthMin': v = d.provider.getWorkouts(date, date).filter((w) => STRENGTH_TYPES.has(w.type)).reduce((t, w) => t + (w.durationMin ?? 0), 0); break;
    case 'leanMass': v = day.bodyFatPct != null ? 100 - day.bodyFatPct : null; break;
    case 'vo2': v = day.vo2max; break;
  }
  if (v == null || Number.isNaN(v)) return null;
  if ((key === 'steps' || key === 'kcal' || key === 'hrv' || key === 'rhr') && v <= 0) return null;
  return v;
}

const datesCache = new WeakMap<object, string[]>();
export function datesWithData(d: Deps): string[] {
  let out = datesCache.get(d.provider);
  if (!out) {
    out = [];
    for (let x = d.provider.firstDay; x <= d.provider.lastDay; x = addDays(x, 1)) if (d.provider.getDay(x)) out.push(x);
    datesCache.set(d.provider, out);
  }
  return out;
}

/** Values for `days` days ending at `end` (inclusive), skipping days with no value. */
export function valuesOver(d: Deps, key: MetricKey, end: string, days: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < days; k++) {
    const v = metricValue(d, key, addDays(end, -k));
    if (v != null) out.push(v);
  }
  return out;
}
export const avgOver = (d: Deps, key: MetricKey, end: string, days: number) => {
  const v = valuesOver(d, key, end, days);
  return v.length ? mean(v) : null;
};

export type Versus = { value: number; avg: number; diff: number; pct: number; n: number };
/** A day's value against the average of the `days` days before it. */
export function vsOwnAverage(d: Deps, key: MetricKey, date: string, days = 30): Versus | null {
  const value = metricValue(d, key, date);
  const prior = valuesOver(d, key, addDays(date, -1), days);
  if (value == null || prior.length < 4) return null;
  const avg = mean(prior);
  return { value, avg, diff: value - avg, pct: avg ? ((value - avg) / avg) * 100 : 0, n: prior.length };
}

export type Extreme = { date: string; value: number };
export type Records = { high: Extreme; low: Extreme; n: number };
export function records(d: Deps, key: MetricKey): Records | null {
  let high: Extreme | null = null;
  let low: Extreme | null = null;
  let n = 0;
  for (const date of datesWithData(d)) {
    if (METRIC[key].partialToday && date === d.provider.lastDay) continue;
    const v = metricValue(d, key, date);
    if (v == null) continue;
    n++;
    if (!high || v > high.value) high = { date, value: v };
    if (!low || v < low.value) low = { date, value: v };
  }
  return high && low ? { high, low, n } : null;
}

export type WeekdayRow = { dow: number; name: string; avg: number; n: number };
export type WeekdayPattern = { rows: WeekdayRow[]; high: WeekdayRow; low: WeekdayRow; night: boolean };
/** Average per weekday. For sleep the weekday is the evening you went to bed ("Friday night"). */
export function weekdayPattern(d: Deps, key: MetricKey): WeekdayPattern | null {
  const night = METRIC[key].night;
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const date of datesWithData(d)) {
    if (METRIC[key].partialToday && date === d.provider.lastDay) continue;
    const v = metricValue(d, key, date);
    if (v != null) buckets[dowOf(night ? addDays(date, -1) : date)].push(v);
  }
  const rows = buckets.map((b, dow) => ({ dow, name: weekdayName(dow), avg: b.length ? mean(b) : 0, n: b.length })).filter((r) => r.n >= 3);
  if (rows.length < 3) return null;
  const sorted = [...rows].sort((a, b) => b.avg - a.avg);
  return { rows, high: sorted[0], low: sorted[sorted.length - 1], night };
}

export type Direction = { recent: number; before: number; diff: number; pct: number; dir: 'up' | 'down' | 'flat' };
/** Average of the last `days` days against the `days` before that. */
export function trendDirection(d: Deps, key: MetricKey, end: string, days = 7): Direction | null {
  const recent = valuesOver(d, key, end, days);
  const before = valuesOver(d, key, addDays(end, -days), days);
  if (recent.length < 2 || before.length < 2) return null;
  const r = mean(recent);
  const b = mean(before);
  const pct = b ? ((r - b) / b) * 100 : 0;
  return { recent: r, before: b, diff: r - b, pct, dir: Math.abs(pct) < 3 ? 'flat' : pct > 0 ? 'up' : 'down' };
}

export type Driver = { c: Contributor; text: string };
const driverText = (c: Contributor) => {
  const val = c.key === 'sleep' ? `${Math.round(c.value)}/100` : `${c.value.toFixed(c.key === 'resp' ? 1 : 0)} ${c.unit}`;
  return c.baseline != null ? `${c.label}: ${val} (your usual ${c.baseline.toFixed(c.key === 'resp' ? 1 : 0)})` : `${c.label}: ${val}`;
};
export function recoveryDrivers(d: Deps, date: string) {
  const r = d.metrics.recovery(date);
  if (!r) return null;
  const ranked: Driver[] = [...r.contributors].sort((a, b) => a.z - b.z).map((c) => ({ c, text: driverText(c) }));
  return {
    score: r.score,
    band: r.band,
    ranked,
    worst: ranked[0] && ranked[0].c.z < -0.3 ? ranked[0] : null,
    best: ranked[ranked.length - 1] && ranked[ranked.length - 1].c.z > 0.3 ? ranked[ranked.length - 1] : null,
  };
}

export function weakestSleepPart(d: Deps, date: string) {
  const s = d.metrics.sleep(date);
  if (!s) return null;
  const ranked = s.components.filter((c) => c.score != null).sort((a, b) => a.score! - b.score!);
  return { score: s.score, needMin: s.needMin, ranked, weakest: ranked[0] ?? null };
}

export type Bedtime = { bed: string; wake: string; needMin: number };
/** Tonight's bedtime: your usual wake time minus the sleep you need (which grows with today's strain) and a 15 min buffer. */
export function bedtimeSuggestion(d: Deps, date: string): Bedtime | null {
  const wakes: number[] = [];
  for (let k = 0; k < 14; k++) {
    const s = d.provider.getDay(addDays(date, -k))?.sleep;
    if (s) wakes.push(clockMin(s.end));
  }
  if (wakes.length < 3) return null;
  const strain = d.metrics.strain(date)?.strain ?? 8;
  const needMin = Math.round(480 + 30 * (strain / 21));
  const wake = median(wakes);
  return { bed: hhmm(wake - needMin - 15), wake: hhmm(wake), needMin };
}

export type LateWorkout = { workout: Workout; endClock: string; late: boolean; sleepScore: number | null; avgSleepScore: number | null };
/** The previous day's last workout and whether it finished late in the evening, next to last night's sleep. */
export function lateWorkout(d: Deps, date: string): LateWorkout | null {
  const prev = addDays(date, -1);
  const list = d.provider.getWorkouts(prev, prev).filter((w) => (w.durationMin ?? 0) >= 10);
  if (!list.length) return null;
  const w = [...list].sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  const crossed = w.end.slice(0, 10) > w.start.slice(0, 10);
  const end = clockMin(w.end);
  return { workout: w, endClock: hhmm(end), late: crossed || end >= 20 * 60, sleepScore: metricValue(d, 'sleepScore', date), avgSleepScore: avgOver(d, 'sleepScore', addDays(date, -1), 30) };
}

export type WorkoutProfile = { workoutDayMedian: number; restDayMedian: number; avgWorkoutMin: number; n: number };
const profileCache = new WeakMap<object, WorkoutProfile | null>();
/** How much a typical workout of yours lifts the day's strain: workout days against days without one. */
export function workoutStrainProfile(d: Deps): WorkoutProfile | null {
  if (profileCache.has(d.provider)) return profileCache.get(d.provider)!;
  const withW = new Map<string, number>();
  for (const w of d.provider.getWorkouts()) if ((w.durationMin ?? 0) >= 20) withW.set(w.start.slice(0, 10), (withW.get(w.start.slice(0, 10)) ?? 0) + (w.durationMin ?? 0));
  const on: number[] = [];
  const off: number[] = [];
  for (const date of datesWithData(d)) {
    if (date === d.provider.lastDay) continue;
    const s = metricValue(d, 'strain', date);
    if (s == null) continue;
    (withW.has(date) ? on : off).push(s);
  }
  const mins = [...withW.values()];
  const res = on.length >= 5 && off.length >= 5 ? { workoutDayMedian: median(on), restDayMedian: median(off), avgWorkoutMin: mean(mins), n: on.length } : null;
  profileCache.set(d.provider, res);
  return res;
}

export type WorkoutCompare = { prev: Workout; count: number; avgDur: number | null; avgKcal: number | null; avgHr: number | null };
export function sameTypeCompare(d: Deps, w: Workout): WorkoutCompare | null {
  const before = d.provider.getWorkouts().filter((x) => x.type === w.type && x.start < w.start).sort((a, b) => (a.start < b.start ? 1 : -1));
  if (!before.length) return null;
  const last5 = before.slice(0, 5);
  const avg = (f: (x: Workout) => number | null) => {
    const v = last5.map(f).filter((x): x is number => x != null);
    return v.length ? mean(v) : null;
  };
  return { prev: before[0], count: before.length, avgDur: avg((x) => x.durationMin), avgKcal: avg((x) => x.kcal), avgHr: avg((x) => x.hrAvg) };
}

export type GroupStats = { n: number; sleepMin: number | null; sleepScore: number | null; prevStrain: number | null };
const groupCache = new WeakMap<object, { green: GroupStats; red: GroupStats } | null>();
/** What came with your green recoveries compared with your red ones, over the whole history. */
export function greenVsRed(d: Deps) {
  if (groupCache.has(d.provider)) return groupCache.get(d.provider)!;
  const acc = { green: { sm: [] as number[], ss: [] as number[], ps: [] as number[], n: 0 }, red: { sm: [] as number[], ss: [] as number[], ps: [] as number[], n: 0 } };
  for (const date of datesWithData(d)) {
    const r = d.metrics.recovery(date);
    if (!r || r.band === 'yellow') continue;
    const g = acc[r.band];
    g.n++;
    const sm = metricValue(d, 'sleepMin', date);
    const ss = metricValue(d, 'sleepScore', date);
    const ps = metricValue(d, 'strain', addDays(date, -1));
    if (sm != null) g.sm.push(sm);
    if (ss != null) g.ss.push(ss);
    if (ps != null) g.ps.push(ps);
  }
  const fin = (g: typeof acc.green): GroupStats => ({ n: g.n, sleepMin: g.sm.length ? mean(g.sm) : null, sleepScore: g.ss.length ? mean(g.ss) : null, prevStrain: g.ps.length ? mean(g.ps) : null });
  const res = acc.green.n >= 5 && acc.red.n >= 5 ? { green: fin(acc.green), red: fin(acc.red) } : null;
  groupCache.set(d.provider, res);
  return res;
}

/** Heart-rate zones as bpm ranges from max heart rate (zone edges are % of max HR, see ZONE_EDGES). */
export function zoneRanges(hrMax: number) {
  return [0, 1, 2, 3, 4].map((i) => ({ zone: i + 1, lo: Math.round(ZONE_EDGES[i] * hrMax), hi: i === 4 ? Math.round(hrMax) : Math.round(ZONE_EDGES[i + 1] * hrMax) }));
}
