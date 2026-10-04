import type { Tip } from '@/components/charts';
import { STRENGTH_TYPES } from '@/coach/insights';
import { fmtDuration, fmtNum } from '@/components/ui';
import { addDays, health } from '@/health';
import { dateLabel } from '@/lib/format';
import { convertDistance, distanceDecimals, distanceLabel } from '@/lib/units';
import { metrics } from '@/metrics';
import { useUnitsPrefs } from '@/state/units-prefs';

export type TrendKey =
  | 'recovery' | 'sleepScore' | 'strain' | 'stress' | 'steps' | 'distance' | 'active' | 'sleep' | 'rhr'
  | 'sleepConsistency' | 'hrZone13' | 'hrZone45' | 'strengthMin' | 'leanMass' | 'vo2';
/** the fitness-age-only metrics: not shown as chips on the shared /trends page, only opened from the Fitness age page itself */
const FITNESS_ONLY: TrendKey[] = ['sleepConsistency', 'hrZone13', 'hrZone45', 'strengthMin', 'leanMass', 'vo2'];

export type TrendDef = {
  label: string;
  unit: string;
  get: (date: string) => number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  /** summed over the range (steps, km, kcal) rather than only averaged */
  total: boolean;
  /** lower is better (resting heart rate) */
  lowerIsBetter?: boolean;
};

export const TRENDS: Record<TrendKey, TrendDef> = {
  recovery: { label: 'Recovery', unit: '%', get: (d) => metrics.recovery(d)?.score, fmt: (v) => fmtNum(v), total: false },
  sleepScore: { label: 'Sleep score', unit: '%', get: (d) => metrics.sleep(d)?.score, fmt: (v) => fmtNum(v), total: false },
  strain: { label: 'Strain', unit: '/21', get: (d) => metrics.strain(d)?.strain, fmt: (v) => fmtNum(v, 1), total: false },
  stress: { label: 'Stress', unit: '/3', get: (d) => metrics.stress(d)?.level, fmt: (v) => fmtNum(v, 1), total: false, lowerIsBetter: true },
  steps: { label: 'Steps', unit: '', get: (d) => health.getDay(d)?.steps, fmt: (v) => fmtNum(v), total: true },
  distance: {
    label: 'Distance',
    // a getter, not a plain string — reads the live unit preference every time `.unit` is accessed
    get unit() { return distanceLabel(useUnitsPrefs.getState().distance); },
    get: (d) => { const km = health.getDay(d)?.distanceKm; return km == null ? null : convertDistance(km, useUnitsPrefs.getState().distance); },
    fmt: (v) => fmtNum(v, distanceDecimals(useUnitsPrefs.getState().distance)),
    total: true,
  },
  active: { label: 'Active kcal', unit: 'kcal', get: (d) => health.getDay(d)?.activeKcal, fmt: (v) => fmtNum(v), total: true },
  sleep: { label: 'Time asleep', unit: '', get: (d) => health.getDay(d)?.sleep?.asleepMin, fmt: (v) => fmtDuration(v), total: false },
  rhr: { label: 'Resting HR', unit: 'bpm', get: (d) => health.getDay(d)?.rhr, fmt: (v) => fmtNum(v), total: false, lowerIsBetter: true },
  sleepConsistency: { label: 'Sleep consistency', unit: '/100', get: (d) => metrics.sleep(d)?.components.find((c) => c.key === 'consistency')?.score, fmt: (v) => fmtNum(v), total: false },
  hrZone13: { label: 'Zones 2–3', unit: 'min', get: (d) => { const z = metrics.strain(d)?.zones; return z ? z[1] + z[2] : null; }, fmt: (v) => fmtNum(v), total: true },
  hrZone45: { label: 'Zones 4–5', unit: 'min', get: (d) => { const z = metrics.strain(d)?.zones; return z ? z[3] + z[4] : null; }, fmt: (v) => fmtNum(v), total: true },
  strengthMin: { label: 'Strength time', unit: 'min', get: (d) => health.getWorkouts(d, d).filter((w) => STRENGTH_TYPES.has(w.type)).reduce((t, w) => t + (w.durationMin ?? 0), 0), fmt: (v) => fmtNum(v), total: true },
  leanMass: { label: 'Lean body mass', unit: '%', get: (d) => { const bf = health.getDay(d)?.bodyFatPct; return bf != null ? 100 - bf : null; }, fmt: (v) => fmtNum(v, 1), total: false },
  vo2: { label: 'VO2 max', unit: 'mL/kg/min', get: (d) => health.getDay(d)?.vo2max, fmt: (v) => fmtNum(v, 1), total: false },
};
/** every key, including the fitness-age-only ones — pass any of these to `trendSeries`/`trendTips` directly */
export const ALL_TREND_KEYS = Object.keys(TRENDS) as TrendKey[];
/** the ones shown as chips on the shared /trends page */
export const TREND_KEYS = ALL_TREND_KEYS.filter((k) => !FITNESS_ONLY.includes(k));

export function trendSeries(key: TrendKey, endDate: string, days: number) {
  const def = TRENDS[key];
  const dates = Array.from({ length: days }, (_, i) => addDays(endDate, i - (days - 1)));
  const values = dates.map((d) => def.get(d) ?? null);
  const present = values.filter((v): v is number => v != null && v > 0);
  const sum = present.reduce((a, b) => a + b, 0);
  return {
    dates,
    values,
    avg: present.length ? sum / present.length : null,
    total: present.length ? sum : null,
    best: present.length ? (def.lowerIsBetter ? Math.min(...present) : Math.max(...present)) : null,
    daysWithData: present.length,
  };
}

/** Touch-readout captions for a trendSeries: "Thu, 17 Sep" / "86 %". */
export function trendTips(key: TrendKey, series: { dates: string[]; values: (number | null)[] }): Tip[] {
  const def = TRENDS[key];
  return series.dates.map((d, i) => {
    const v = series.values[i];
    return { title: dateLabel(d, health.lastDay), value: v == null ? 'No data' : `${def.fmt(v)}${def.unit ? ` ${def.unit}` : ''}` };
  });
}
