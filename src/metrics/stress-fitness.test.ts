import { describe, expect, it } from 'vitest';

import type { DaySummary, SleepSession } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { BAND_YEARS, createFitness, fitnessAgeFromVo2, fitnessBand, fitnessCategory, vo2Median } from './fitness';
import { createStress, stressLabel } from './stress';

const emptyDay = (over: Partial<DaySummary> = {}): DaySummary => ({
  steps: 0, distanceKm: 0, activeKcal: 0, basalKcal: 0, exerciseMin: 0, standHours: 0, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: null, hrvAvg: null, hrvSamples: 0,
  spo2: null, respAvg: null, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
  ...over,
});
const night = (wakeDate: string): SleepSession => ({
  start: `${addDays(wakeDate, -1)} 23:30:00 +0200`, end: `${wakeDate} 07:30:00 +0200`,
  asleepMin: 450, inBedMin: 480, awakeMin: 30, coreMin: 250, deepMin: 90, remMin: 110, efficiency: 94, stages: [],
});
const providerOf = (days: Record<string, DaySummary>, sex = 'male'): HealthProvider => {
  const keys = Object.keys(days).sort();
  return {
    firstDay: keys[0], lastDay: keys[keys.length - 1],
    getDay: (d) => days[d],
    getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
    getWorkouts: () => [],
    getHrSamples: () => [],
    getProfile: () => ({ age: 30, sex, heightCm: 180, weightKg: 75, bodyFatPct: null }),
  };
};

/** hourly HR: ~68–72 bpm while awake, 55 asleep */
const calmHours = () => Array.from({ length: 24 }, (_, h) => (h < 7 ? 55 : 68 + (h % 5)));
const baseline = () => {
  const days: Record<string, DaySummary> = {};
  for (let i = 0; i < 40; i++) {
    const d = addDays('2026-01-01', i);
    days[d] = emptyDay({ hourly: { steps: null, activeKcal: null, hr: calmHours() }, sleep: night(d) });
  }
  return days;
};

describe('stress', () => {
  it('a normal day sits in the Low band; a day with high daytime HR is higher', () => {
    const days = baseline();
    days['2026-02-15'] = emptyDay({ hourly: { steps: null, activeKcal: null, hr: calmHours() }, sleep: night('2026-02-15') });
    days['2026-02-16'] = emptyDay({ hourly: { steps: null, activeKcal: null, hr: calmHours().map((v, h) => (h >= 9 && h <= 17 ? 92 : v)) }, sleep: night('2026-02-16') });
    const s = createStress(providerOf(days));
    expect(s('2026-02-15')!.label).toBe('Low');
    expect(s('2026-02-16')!.level).toBeGreaterThan(s('2026-02-15')!.level + 0.8);
    expect(s('2026-02-16')!.highHours).toBeGreaterThan(3);
  });

  it('leaves out sleeping and moving hours', () => {
    const days = baseline();
    const steps = new Array(24).fill(0);
    steps[10] = 900;
    days['2026-02-15'] = emptyDay({ hourly: { steps, activeKcal: null, hr: calmHours() }, sleep: night('2026-02-15') });
    const r = createStress(providerOf(days))('2026-02-15')!;
    expect(r.hours[3].state).toBe('asleep'); // 03:30 is inside 23:30–07:30
    expect(r.hours[10].state).toBe('active');
    expect(r.hours[10].level).toBeNull();
    expect(r.hours[12].state).toBe('awake');
  });

  it('needs a baseline first and stays within 0–3', () => {
    const days = baseline();
    const s = createStress(providerOf(days));
    expect(s('2026-01-01')).toBeNull();
    days['2026-02-20'] = emptyDay({ hourly: { steps: null, activeKcal: null, hr: new Array(24).fill(180) }, sleep: night('2026-02-20') });
    const r = createStress(providerOf(days))('2026-02-20')!;
    expect(r.level).toBeLessThanOrEqual(3);
    expect(r.label).toBe('High');
  });

  it('labels', () => {
    expect(stressLabel(0.99)).toBe('Low');
    expect(stressLabel(1)).toBe('Moderate');
    expect(stressLabel(2)).toBe('High');
  });
});

describe('fitness age', () => {
  it('matches your real age when your VO2 max equals the median for that age', () => {
    expect(fitnessAgeFromVo2(vo2Median(30, 'male'), 'male')).toBeCloseTo(30, 5);
    expect(fitnessAgeFromVo2(vo2Median(55, 'female'), 'female')).toBeCloseTo(55, 5);
  });
  it('is younger for higher VO2 max, older for lower, and clamped', () => {
    expect(fitnessAgeFromVo2(52, 'male')).toBeLessThan(fitnessAgeFromVo2(40, 'male'));
    expect(fitnessAgeFromVo2(80, 'male')).toBe(18);
    expect(fitnessAgeFromVo2(5, 'male')).toBe(90);
  });
  it('uses sex-specific references', () => {
    expect(vo2Median(30, 'male')).toBeGreaterThan(vo2Median(30, 'female'));
  });
  it('summarises readings: smooths with the last 3, compares with real age, builds a monthly series', () => {
    const days: Record<string, DaySummary> = {
      '2026-01-10': emptyDay({ vo2max: 30 }),
      '2026-03-05': emptyDay({ vo2max: 46 }),
      '2026-03-20': emptyDay({ vo2max: 48 }),
      '2026-04-02': emptyDay({ vo2max: 47 }),
    };
    const f = createFitness(providerOf(days))()!;
    expect(f.vo2).toBe(47); // median of last three, the old 30 is ignored
    expect(f.fitnessAge).toBeLessThan(30);
    expect(f.delta).toBeCloseTo(f.fitnessAge - 30, 5);
    expect(f.fitnessAge * 10).toBeCloseTo(Math.round(f.fitnessAge * 10), 5); // one decimal place
    expect(f.monthly.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(f.monthly[1].vo2).toBeNull();
    expect(f.monthly[2].vo2).toBe(47);
  });
  it('returns null without readings', () => {
    expect(createFitness(providerOf({ '2026-01-01': emptyDay() }))()).toBeNull();
  });
  it('categories', () => {
    expect(fitnessCategory(1.2)).toBe('Excellent');
    expect(fitnessCategory(0.9)).toBe('Average');
    expect(fitnessCategory(0.7)).toBe('Below average');
  });

  it('bands "about the same" within a 9-month tolerance either side of real age, not just exact equality', () => {
    const age = 30;
    expect(fitnessBand(age, age)).toBe('same');
    expect(fitnessBand(age - BAND_YEARS + 0.01, age)).toBe('same');
    expect(fitnessBand(age + BAND_YEARS - 0.01, age)).toBe('same');
    expect(fitnessBand(age - BAND_YEARS, age)).toBe('younger'); // exactly on the boundary counts as outside "same"
    expect(fitnessBand(age + BAND_YEARS, age)).toBe('older');
    expect(fitnessBand(age - 3, age)).toBe('younger');
    expect(fitnessBand(age + 3, age)).toBe('older');
  });
});
