import { afterEach, describe, expect, it } from 'vitest';

import type { DaySummary, SleepSession } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { useHealthPrefs } from '../state/health-prefs';
import { createMetrics, normCdf, recoveryBand, strainLabel, targetStrain, toStrain, zoneMinutes } from './engine';

const sleepSession = (over: Partial<SleepSession> = {}): SleepSession => ({
  start: '2026-01-01 23:30:00 +0200',
  end: '2026-01-02 07:30:00 +0200',
  asleepMin: 450,
  inBedMin: 480,
  awakeMin: 30,
  coreMin: 250,
  deepMin: 90,
  remMin: 110,
  efficiency: 94,
  stages: [],
  ...over,
});

const emptyDay = (over: Partial<DaySummary> = {}): DaySummary => ({
  steps: 0, distanceKm: 0, activeKcal: 0, basalKcal: 0, exerciseMin: 0, standHours: 0, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: null, hrvAvg: null, hrvSamples: 0,
  spo2: null, respAvg: null, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
  ...over,
});

const providerOf = (days: Record<string, DaySummary>): HealthProvider => ({
  firstDay: '2026-01-01',
  lastDay: '2026-03-31',
  getDay: (d) => days[d],
  getRange: (from, to) => {
    const out: { date: string; day: DaySummary | undefined }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] });
    return out;
  },
  getWorkouts: () => [],
  getHrSamples: () => [],
  getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
});

/** 40 days of stable physiology (HRV 40 ms, RHR 60, resp 14) with a normal sleep each night. */
const baselineDays = () => {
  const days: Record<string, DaySummary> = {};
  for (let i = 0; i < 40; i++) {
    const d = addDays('2026-01-01', i);
    days[d] = emptyDay({ rhr: 60 + (i % 3) - 1, overnight: { hrv: 40 + (i % 4) - 1.5, resp: 14 + ((i % 3) - 1) * 0.2 }, sleep: sleepSession() });
  }
  return days;
};

afterEach(() => {
  useHealthPrefs.setState({ sleepGoalMin: null, hrMaxSource: 'auto', hrMaxManual: null, hrRestSource: 'auto', hrRestManual: null, zoneBands: null, status: 'active' });
});

describe('math helpers', () => {
  it('normCdf is a proper CDF', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 5);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1)).toBeCloseTo(1 - normCdf(1), 6);
  });
  it('bands and labels', () => {
    expect(recoveryBand(66)).toBe('yellow');
    expect(recoveryBand(67)).toBe('green');
    expect(recoveryBand(33)).toBe('red');
    expect(strainLabel(9.9)).toBe('Light');
    expect(strainLabel(18)).toBe('All out');
    expect(targetStrain('green')[0]).toBeGreaterThan(targetStrain('red')[1] - 1);
  });
  it('toStrain is 0 at 0, log-shaped and capped at 21', () => {
    expect(toStrain(0)).toBe(0);
    const [a, b, c] = [toStrain(50), toStrain(100), toStrain(200)];
    expect(b - a).toBeGreaterThan(c - b - (c - b) * 0.5); // diminishing returns
    expect(b - a).toBeGreaterThan((c - b) / 2);
    expect(toStrain(1e6)).toBe(21);
  });
  it('zoneMinutes buckets by % of max HR', () => {
    const z = zoneMinutes({ '60': 10, '150': 5, '180': 2 }, 190);
    expect(z[0]).toBeCloseTo(10); // 62.5/190 = 33%
    expect(z[3]).toBeCloseTo(5); // 152.5/190 = 80.3%
    expect(z[4]).toBeCloseTo(2); // 182.5/190 = 96%
  });
});

describe('sleep score', () => {
  it('is high for a full, efficient, restorative night and lower when short', () => {
    const days = baselineDays();
    days['2026-02-15'] = emptyDay({ sleep: sleepSession() });
    days['2026-02-16'] = emptyDay({ sleep: sleepSession({ asleepMin: 240, efficiency: 80, deepMin: 20, remMin: 30 }) });
    const m = createMetrics(providerOf(days));
    expect(m.sleep('2026-02-15')!.score).toBeGreaterThan(90);
    expect(m.sleep('2026-02-16')!.score).toBeLessThan(55);
  });
  it('sleep need rises after a high-strain day', () => {
    const days = baselineDays();
    days['2026-02-14'] = emptyDay({ hr: { min: 50, avg: 90, max: 190, hist: { '150': 90, '170': 30 } } });
    days['2026-02-15'] = emptyDay({ sleep: sleepSession() });
    const m = createMetrics(providerOf(days));
    expect(m.sleep('2026-02-15')!.needMin).toBeGreaterThan(m.sleep('2026-02-05')!.needMin);
  });
  it('is null without a sleep session', () => {
    expect(createMetrics(providerOf({ '2026-02-15': emptyDay() })).sleep('2026-02-15')).toBeNull();
  });
});

describe('recovery', () => {
  it('rises with higher HRV / lower RHR and falls with the opposite, vs. own baseline', () => {
    const days = baselineDays();
    days['2026-02-15'] = emptyDay({ rhr: 54, overnight: { hrv: 55, resp: 13.6 }, sleep: sleepSession() });
    days['2026-02-16'] = emptyDay({ rhr: 68, overnight: { hrv: 26, resp: 15.2 }, sleep: sleepSession() });
    const m = createMetrics(providerOf(days));
    expect(m.recovery('2026-02-15')!.band).toBe('green');
    expect(m.recovery('2026-02-16')!.band).toBe('red');
    expect(m.recovery('2026-02-15')!.score).toBeGreaterThan(m.recovery('2026-02-16')!.score);
  });
  it('an average day sits near the middle', () => {
    const days = baselineDays();
    const r = createMetrics(providerOf(days)).recovery('2026-02-05')!;
    expect(r.score).toBeGreaterThan(35);
    expect(r.score).toBeLessThan(75);
  });
  it('needs a baseline before it scores', () => {
    const days = { '2026-01-01': emptyDay({ rhr: 60, overnight: { hrv: 40 } }) };
    expect(createMetrics(providerOf(days)).recovery('2026-01-01')).toBeNull();
  });
});

describe('strain', () => {
  it('is null with no heart-rate data and ~0 for a resting day', () => {
    const days = baselineDays();
    days['2026-02-20'] = emptyDay({ hr: { min: 50, avg: 60, max: 70, hist: { '55': 600, '60': 300 } } });
    const m = createMetrics(providerOf(days));
    expect(m.strain('2026-02-19')).toBeNull();
    expect(m.strain('2026-02-20')!.strain).toBeLessThan(1);
  });
  it('increases with time at high heart rate and stays within 0–21', () => {
    const days = baselineDays();
    days['2026-02-20'] = emptyDay({ hr: { min: 50, avg: 80, max: 150, hist: { '60': 500, '140': 20 } } });
    days['2026-02-21'] = emptyDay({ hr: { min: 50, avg: 100, max: 190, hist: { '60': 500, '140': 60, '170': 40 } } });
    const m = createMetrics(providerOf(days));
    const a = m.strain('2026-02-20')!.strain;
    const b = m.strain('2026-02-21')!.strain;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(21);
  });
});

describe('health-prefs overrides', () => {
  it('a manual sleep goal changes needMin, even for an already-computed date (cache invalidation)', () => {
    const days = baselineDays();
    days['2026-02-15'] = emptyDay({ sleep: sleepSession() });
    const m = createMetrics(providerOf(days));
    const before = m.sleep('2026-02-15')!.needMin;
    useHealthPrefs.setState({ sleepGoalMin: 540 }); // 9h instead of the 8h default
    const after = m.sleep('2026-02-15')!.needMin;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeCloseTo(540 + (before - 480), 0);
  });

  it('a manual max/resting HR overrides the computed profile and changes strain', () => {
    const days = baselineDays();
    days['2026-02-20'] = emptyDay({ hr: { min: 50, avg: 100, max: 190, hist: { '60': 500, '140': 60, '170': 40 } } });
    const m = createMetrics(providerOf(days));
    const before = m.strain('2026-02-20')!;
    // a much higher max HR shrinks heart-rate reserve, so the same effort scores as less strain
    useHealthPrefs.setState({ hrMaxSource: 'manual', hrMaxManual: 220, hrRestSource: 'manual', hrRestManual: 50 });
    const after = m.strain('2026-02-20')!;
    expect(after.hrMax).toBe(220);
    expect(after.hrRest).toBe(50);
    expect(after.strain).not.toBe(before.strain);
  });

  it('custom zone bands change zone minutes for an already-computed date', () => {
    const days = baselineDays();
    days['2026-02-20'] = emptyDay({ hr: { min: 50, avg: 100, max: 190, hist: { '150': 30 } } }); // 152.5/190 ≈ 80%, zone 4 by default
    const m = createMetrics(providerOf(days));
    expect(m.strain('2026-02-20')!.zones[3]).toBeCloseTo(30); // default edges put 80% in zone 4 (index 3)
    useHealthPrefs.setState({ zoneBands: [0.5, 0.6, 0.7, 0.75] }); // 80% now falls above the top edge → zone 5
    const after = m.strain('2026-02-20')!;
    expect(after.zones[4]).toBeCloseTo(30);
    expect(after.zones[3]).toBe(0);
  });
});

describe('HRV outlier rein-in', () => {
  /** nights with a realistic HRV spread (30-60 ms), each recorded as two similar readings */
  const steadyNights = () => {
    const days: Record<string, DaySummary> = {};
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-01-01', i);
      const h = 30 + (i % 7) * 5;
      days[d] = emptyDay({ rhr: 60 + (i % 3) - 1, overnight: { hrv: h, hrvAll: [h - 3, h + 3], hrAvg: 58 + (i % 3) - 1, resp: 14 }, sleep: sleepSession() });
    }
    return days;
  };

  it('one artefact reading cannot run away with the score', () => {
    const days = steadyNights();
    // 36 and 155 average to 95.5 — the shape of a real movement spike near wake-up
    days['2026-02-15'] = emptyDay({ rhr: 60, overnight: { hrv: 95.5, hrvAll: [36, 155], hrAvg: 58, resp: 14 }, sleep: sleepSession() });
    const c = createMetrics(providerOf(days)).recovery('2026-02-15')!.contributors.find((x) => x.key === 'hrv')!;
    expect(c.value).toBe(95.5); // the real reading is still what we show
    expect(c.capped).toBeLessThan(c.value); // but a smaller number was scored
    expect(c.capped).toBeGreaterThan(36); // and the good half of the night still counts
    expect(c.z).toBeLessThan(2); // uncapped this sat at ~2.5, dominating a 50%-weighted signal
  });

  it('leaves an ordinary night completely alone', () => {
    const days = steadyNights();
    days['2026-02-15'] = emptyDay({ rhr: 60, overnight: { hrv: 46, hrvAll: [44, 48], hrAvg: 58, resp: 14 }, sleep: sleepSession() });
    const c = createMetrics(providerOf(days)).recovery('2026-02-15')!.contributors.find((x) => x.key === 'hrv')!;
    expect(c.capped).toBeUndefined();
    expect(c.z).toBeGreaterThan(0);
  });

  it('a genuinely great night still scores well', () => {
    const days = steadyNights();
    days['2026-02-15'] = emptyDay({ rhr: 55, overnight: { hrv: 70, hrvAll: [68, 72], hrAvg: 55, resp: 13.6 }, sleep: sleepSession() });
    const r = createMetrics(providerOf(days)).recovery('2026-02-15')!;
    expect(r.contributors.find((x) => x.key === 'hrv')!.z).toBeGreaterThan(1);
    expect(r.band).toBe('green');
  });

  it('still works for a night with no per-reading detail', () => {
    const days = steadyNights();
    days['2026-02-15'] = emptyDay({ rhr: 60, overnight: { hrv: 200, hrAvg: 58, resp: 14 }, sleep: sleepSession() });
    const c = createMetrics(providerOf(days)).recovery('2026-02-15')!.contributors.find((x) => x.key === 'hrv')!;
    expect(c.capped).toBeLessThan(200);
  });

  it('resting heart rate can be read from your sleep instead of the daily figure', () => {
    const days = steadyNights();
    days['2026-02-15'] = emptyDay({ rhr: 70, overnight: { hrv: 40, hrvAll: [38, 42], hrAvg: 58, resp: 14 }, sleep: sleepSession() });
    const m = createMetrics(providerOf(days));
    expect(m.recovery('2026-02-15')!.contributors.find((x) => x.key === 'rhr')!.value).toBe(70);
    useHealthPrefs.setState({ hrRestSource: 'sleep' });
    expect(m.recovery('2026-02-15')!.contributors.find((x) => x.key === 'rhr')!.value).toBe(58);
  });
});
