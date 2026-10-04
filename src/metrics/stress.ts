// Daytime stress: how far your heart rate sits above YOUR usual level while you are awake and not moving.
// Hours when you are asleep, exercising or walking around are left out, so movement doesn't look like stress.
// Scale 0–3: Low (< 1), Moderate (1–2), High (≥ 2).
import { addDays, type HealthProvider } from '../health/provider';
import { clamp, mean, sd } from './math';

export type StressLabel = 'Low' | 'Moderate' | 'High';
export type HourState = 'asleep' | 'active' | 'awake' | 'nodata';
export type StressHour = { hour: number; hr: number | null; state: HourState; level: number | null };
export type StressResult = {
  /** average of the awake, inactive hours, 0–3 */
  level: number;
  label: StressLabel;
  hours: StressHour[];
  /** number of hours at level ≥ 2 */
  highHours: number;
  /** your typical heart rate during awake, inactive hours over the previous 30 days */
  baselineHr: number;
  baselineSd: number;
  awakeHours: number;
};

const BASELINE_DAYS = 30;
const MIN_BASELINE_HOURS = 30;
const MIN_AWAKE_HOURS = 3;
const STEPS_ACTIVE = 400; // steps in an hour → "moving"
const KCAL_ACTIVE = 30; // active kcal in an hour → "moving"
const WORKOUT_OVERLAP_MIN = 10;
const LEVEL_AT_BASELINE = 0.8; // a typical hour sits in the Low band
const LEVEL_PER_SD = 0.7;
const SD_FLOOR = 3; // bpm

export const stressLabel = (level: number): StressLabel => (level < 1 ? 'Low' : level < 2 ? 'Moderate' : 'High');

const clockMin = (stamp: string) => +stamp.slice(11, 13) * 60 + +stamp.slice(14, 16);

export function createStress(provider: HealthProvider) {
  const cache = new Map<string, StressResult | null>();
  const baselineCache = new Map<string, { mean: number; sd: number } | null>();

  /** Classify each hour of a day as asleep / active / awake(inactive) / no data. */
  function classify(date: string) {
    const day = provider.getDay(date);
    const hrByHour = day?.hourly.hr;
    if (!day || !hrByHour) return null;

    const asleep = new Array<boolean>(24).fill(false);
    const markSleep = (from: number, to: number) => {
      for (let h = 0; h < 24; h++) if (h * 60 + 30 >= from && h * 60 + 30 < to) asleep[h] = true;
    };
    for (const s of [day.sleep, ...day.naps]) {
      if (!s) continue;
      markSleep(s.start.slice(0, 10) === date ? clockMin(s.start) : 0, s.end.slice(0, 10) === date ? clockMin(s.end) : 1440);
    }
    // tonight's sleep starts on this date and continues into the next day
    const next = provider.getDay(addDays(date, 1));
    for (const s of [next?.sleep, ...(next?.naps ?? [])]) if (s && s.start.slice(0, 10) === date) markSleep(clockMin(s.start), 1440);

    const workouts = provider.getWorkouts(date, date).map((w) => [clockMin(w.start), clockMin(w.end) + (w.end.slice(0, 10) > date ? 1440 : 0)] as const);
    const overlaps = (h: number) => workouts.some(([s, e]) => Math.min(e, h * 60 + 60) - Math.max(s, h * 60) >= WORKOUT_OVERLAP_MIN);

    return Array.from({ length: 24 }, (_, hour) => {
      const hr = hrByHour[hour] ?? null;
      const moving = (day.hourly.steps?.[hour] ?? 0) >= STEPS_ACTIVE || (day.hourly.activeKcal?.[hour] ?? 0) >= KCAL_ACTIVE;
      const state: HourState = asleep[hour] ? 'asleep' : hr == null ? 'nodata' : moving || overlaps(hour) ? 'active' : 'awake';
      return { hour, hr, state };
    });
  }

  function baseline(date: string) {
    if (baselineCache.has(date)) return baselineCache.get(date)!;
    const values: number[] = [];
    for (let k = 1; k <= BASELINE_DAYS; k++)
      for (const h of classify(addDays(date, -k)) ?? []) if (h.state === 'awake' && h.hr != null) values.push(h.hr);
    const res = values.length >= MIN_BASELINE_HOURS ? { mean: mean(values), sd: Math.max(sd(values), SD_FLOOR) } : null;
    baselineCache.set(date, res);
    return res;
  }

  function stress(date: string): StressResult | null {
    if (cache.has(date)) return cache.get(date)!;
    let res: StressResult | null = null;
    const cls = classify(date);
    const base = baseline(date);
    if (cls && base) {
      const hours: StressHour[] = cls.map((h) => ({
        ...h,
        level: h.state === 'awake' && h.hr != null ? clamp(LEVEL_AT_BASELINE + LEVEL_PER_SD * ((h.hr - base.mean) / base.sd), 0, 3) : null,
      }));
      const levels = hours.map((h) => h.level).filter((l): l is number => l != null);
      if (levels.length >= MIN_AWAKE_HOURS) {
        const level = mean(levels);
        res = {
          level: Math.round(level * 10) / 10,
          label: stressLabel(level),
          hours,
          highHours: levels.filter((l) => l >= 2).length,
          baselineHr: base.mean,
          baselineSd: base.sd,
          awakeHours: levels.length,
        };
      }
    }
    cache.set(date, res);
    return res;
  }

  return stress;
}
