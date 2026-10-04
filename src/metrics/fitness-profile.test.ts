import { describe, expect, it } from 'vitest';

import type { Deps } from '../coach/types';
import type { DaySummary, SleepSession, Workout } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { createMetrics } from './engine';
import { fitnessTrend, metricProfile } from './fitness-profile';

const emptyDay = (over: Partial<DaySummary> = {}): DaySummary => ({
  steps: 5000, distanceKm: 3, activeKcal: 300, basalKcal: 1700, exerciseMin: 20, standHours: 10, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: 60, hrvAvg: 50, hrvSamples: 3,
  spo2: null, respAvg: 14, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
  ...over,
});

/** `steps` sits at `stepsFrom` for the baseline, then moves to `stepsTo` for the most recent `recentDays` days. */
function history(n: number, stepsFrom: number, stepsTo: number, recentDays: number) {
  const days: Record<string, DaySummary> = {};
  for (let i = 0; i < n; i++) {
    const d = addDays('2026-01-01', i);
    days[d] = emptyDay({ steps: n - 1 - i < recentDays ? stepsTo : stepsFrom, rhr: 60 });
  }
  const keys = Object.keys(days).sort();
  const provider: HealthProvider = {
    firstDay: keys[0], lastDay: keys[keys.length - 1],
    getDay: (d) => days[d],
    getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
    getWorkouts: () => [],
    getHrSamples: () => [],
    getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
  };
  const deps: Deps = { provider, metrics: createMetrics(provider) };
  return { deps, last: keys[keys.length - 1] };
}

describe('metricProfile', () => {
  it('a higher-is-better metric trending up over the last 30 days reads "good"', () => {
    const { deps, last } = history(200, 6000, 12000, 25); // steps ramp up recently
    const p = metricProfile(deps, 'steps', last)!;
    expect(p).not.toBeNull();
    expect(p.short).toBeGreaterThan(p.long);
    expect(p.years).toBeGreaterThan(0);
    expect(p.tone).toBe('good');
  });

  it('a higher-is-better metric trending down reads "bad"', () => {
    const { deps, last } = history(200, 12000, 6000, 25);
    const p = metricProfile(deps, 'steps', last)!;
    expect(p.short).toBeLessThan(p.long);
    expect(p.years).toBeLessThan(0);
    expect(p.tone).toBe('bad');
  });

  it('a lower-is-better metric (resting heart rate) flips the sign: a recent drop reads "good"', () => {
    const days: Record<string, DaySummary> = {};
    for (let i = 0; i < 200; i++) days[addDays('2026-01-01', i)] = emptyDay({ rhr: i > 175 ? 52 : 62 }); // recent 25 days lower
    const keys = Object.keys(days).sort();
    const provider: HealthProvider = {
      firstDay: keys[0], lastDay: keys[keys.length - 1], getDay: (d) => days[d],
      getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
      getWorkouts: () => [], getHrSamples: () => [], getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
    };
    const deps: Deps = { provider, metrics: createMetrics(provider) };
    const p = metricProfile(deps, 'rhr', keys[keys.length - 1])!;
    expect(p.short).toBeLessThan(p.long); // the raw numbers went down
    expect(p.years).toBeGreaterThan(0); // but that's favourable for a lower-is-better metric
    expect(p.tone).toBe('good');
  });

  it('years is capped and never wildly large', () => {
    const { deps, last } = history(200, 1000, 20000, 5); // an extreme, sudden jump
    const p = metricProfile(deps, 'steps', last)!;
    expect(Math.abs(p.years)).toBeLessThanOrEqual(1.2);
  });

  it('a flat metric reads "neutral"', () => {
    const { deps, last } = history(200, 8000, 8000, 1);
    const p = metricProfile(deps, 'steps', last)!;
    expect(p.tone).toBe('neutral');
    expect(p.years).toBeCloseTo(0, 5);
  });

  it('returns null when there is no data at all for the metric', () => {
    const { deps, last } = history(10, 8000, 8000, 1);
    expect(metricProfile(deps, 'leanMass', last)).toBeNull();
  });

  it('sums HR zones 2–3 (excluding the rest-dominated zone 1) and 4–5 separately from the day\'s zone minutes', () => {
    const days: Record<string, DaySummary> = {};
    for (let i = 0; i < 40; i++) days[addDays('2026-01-01', i)] = emptyDay({ hr: { min: 55, avg: 70, max: 180, hist: { '65': 200, '125': 60, '175': 30 } } });
    const keys = Object.keys(days).sort();
    const provider: HealthProvider = {
      firstDay: keys[0], lastDay: keys[keys.length - 1], getDay: (d) => days[d],
      getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
      getWorkouts: () => [], getHrSamples: () => [], getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
    };
    const deps: Deps = { provider, metrics: createMetrics(provider) };
    const p13 = metricProfile(deps, 'hrZone13', keys[keys.length - 1]);
    const p45 = metricProfile(deps, 'hrZone45', keys[keys.length - 1]);
    expect(p13!.short).toBeGreaterThan(0);
    expect(p45!.short).toBeGreaterThan(0);
  });

  it('sums strength-type workout minutes for the day, ignoring other workout types', () => {
    const workout = (date: string, type: string, min: number): Workout => ({
      type, start: `${date} 08:00:00 +0200`, end: `${date} 09:00:00 +0200`, durationMin: min, distanceKm: null, kcal: 200, kcalRest: 40, source: 'Apple Watch', hrAvg: 120, hrMin: 90, hrMax: 140, route: null,
    });
    const days: Record<string, DaySummary> = {};
    const workouts: Workout[] = [];
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-01-01', i);
      days[d] = emptyDay();
      workouts.push(workout(d, 'TraditionalStrengthTraining', 30), workout(d, 'Running', 45));
    }
    const keys = Object.keys(days).sort();
    const provider: HealthProvider = {
      firstDay: keys[0], lastDay: keys[keys.length - 1], getDay: (d) => days[d],
      getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
      getWorkouts: (from, to) => workouts.filter((w) => (!from || w.start.slice(0, 10) >= from) && (!to || w.start.slice(0, 10) <= to)),
      getHrSamples: () => [], getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
    };
    const deps: Deps = { provider, metrics: createMetrics(provider) };
    const p = metricProfile(deps, 'strengthMin', keys[keys.length - 1])!;
    expect(p.short).toBe(30); // not 75 (30 + 45) — the run is excluded
  });
});

describe('fitnessTrend', () => {
  it('returns null with fewer than two months of VO2 readings', () => {
    const { deps, last } = history(20, 8000, 8000, 1);
    expect(fitnessTrend(deps, 'male')).toBeNull();
  });

  it('improving when VO2 max has risen over recent months, declining when it has fallen', () => {
    const up: Record<string, DaySummary> = {};
    const down: Record<string, DaySummary> = {};
    for (let i = 0; i < 150; i++) {
      const d = addDays('2026-01-01', i);
      const month = Math.floor(i / 30);
      up[d] = emptyDay(month >= 4 ? { vo2max: 45 } : month === 0 ? { vo2max: 30 } : {});
      down[d] = emptyDay(month >= 4 ? { vo2max: 30 } : month === 0 ? { vo2max: 45 } : {});
    }
    const provOf = (days: Record<string, DaySummary>): Deps => {
      const keys = Object.keys(days).sort();
      const provider: HealthProvider = {
        firstDay: keys[0], lastDay: keys[keys.length - 1], getDay: (d) => days[d],
        getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
        getWorkouts: () => [], getHrSamples: () => [], getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
      };
      return { provider, metrics: createMetrics(provider) };
    };
    expect(fitnessTrend(provOf(up), 'male')).toBe('improving');
    expect(fitnessTrend(provOf(down), 'male')).toBe('declining');
  });
});
