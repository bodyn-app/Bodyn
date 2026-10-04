// Bodyn metrics engine — transparent Sleep / Recovery / Strain scores.
// Pure TypeScript (no React), so it is unit-testable and works the same with fixtures or HealthKit.
//
//  Sleep    0–100  duration vs. need (need grows with yesterday's strain) + efficiency + restorative share + consistency
//  Recovery 0–100  overnight HRV, resting HR, respiratory rate and sleep, each vs. YOUR OWN 30-day baseline (z-scores)
//  Strain   0–21   log-scaled cardiovascular load (Banister TRIMP on heart-rate reserve) accumulated over the day
//
// The three are linked: yesterday's strain raises tonight's sleep need, sleep feeds recovery,
// and recovery decides how much strain is worth taking on today.
import type { DaySummary, SleepSession } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { useHealthPrefs } from '../state/health-prefs';
import { createFitness } from './fitness';
import { clamp, mean, median, normCdf, sd } from './math';
import { createStress } from './stress';

// ---------- math ----------
export { clamp, normCdf };

export const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;

// ---------- types ----------
export type SleepComponent = {
  key: 'duration' | 'efficiency' | 'restorative' | 'consistency';
  label: string;
  /** 0–100, null when it can't be computed (e.g. not enough previous nights) */
  score: number | null;
  weight: number;
  detail: string;
};
export type SleepScoreResult = { score: number; needMin: number; components: SleepComponent[] };

export type RecoveryBand = 'red' | 'yellow' | 'green';
export type Contributor = {
  key: 'hrv' | 'rhr' | 'resp' | 'sleep';
  label: string;
  unit: string;
  value: number;
  baseline: number | null;
  z: number;
  weight: number;
  higherIsBetter: boolean;
  /** set when a single reading sat so far from your own baseline that it was reined in before scoring (the raw reading stays in `value`) */
  capped?: number;
};
export type RecoveryResult = { score: number; band: RecoveryBand; z: number; contributors: Contributor[] };

export type StrainLabel = 'Light' | 'Moderate' | 'High' | 'All out';
export type StrainResult = {
  strain: number;
  trimp: number;
  hrRest: number;
  hrMax: number;
  label: StrainLabel;
  /** minutes per heart-rate zone (Zone 1..5, as % of max HR) */
  zones: number[];
};

// ---------- constants ----------
const BASELINE_DAYS = 30;
const MIN_BASELINE = 5;
const SLEEP_NEED_BASE_MIN = 480;
const SLEEP_NEED_MAX_EXTRA_MIN = 30; // added at strain 21
const SLEEP_WEIGHTS = { duration: 0.5, efficiency: 0.15, restorative: 0.2, consistency: 0.15 } as const;
const RECOVERY_WEIGHTS = { hrv: 0.5, rhr: 0.25, resp: 0.1, sleep: 0.15 } as const;

// Strain: strain = 21 * ln(1 + T/C) / ln(1 + T_MAX/C)  (T = TRIMP, T_MAX maps to 21)
const STRAIN_C = 25;
const STRAIN_TMAX = 400;
// Calibrated on the POC user's 19 months of data: rest days ≈ 2–6, workout days ≈ 8–14, hardest days ≈ 16–17.
const HRR_FLOOR = 0.05; // heart-rate reserve below 5% counts as resting
// A night of HRV is often only 2-6 SDNN samples, so one artefact (typically a movement spike near wake-up)
// can double the mean. Every reading is reined in to this multiple of your own typical HRV before scoring:
// a genuinely great or poor night still shows, but no single spike can run away with the recovery score.
const HRV_NIGHT_CAP = 2;
export const ZONE_EDGES = [0, 0.6, 0.7, 0.8, 0.9, 10] as const; // % of max HR

export const recoveryBand = (score: number): RecoveryBand => (score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red');
export const strainLabel = (s: number): StrainLabel => (s < 10 ? 'Light' : s < 14 ? 'Moderate' : s < 18 ? 'High' : 'All out');
/** Suggested strain range for today given recovery (a "target strain" for the day). */
export const targetStrain = (band: RecoveryBand): [number, number] => (band === 'green' ? [14, 18] : band === 'yellow' ? [10, 14] : [0, 10]);
export const toStrain = (trimp: number) => clamp((21 * Math.log1p(trimp / STRAIN_C)) / Math.log1p(STRAIN_TMAX / STRAIN_C), 0, 21);

const clockMin = (stamp: string) => +stamp.slice(11, 13) * 60 + +stamp.slice(14, 16);
const bedMin = (s: SleepSession) => {
  const m = clockMin(s.start);
  return m < 720 ? m + 1440 : m; // after-midnight bedtimes sit after evening ones
};
const wakeMin = (s: SleepSession) => clockMin(s.end);

/** Minutes per zone from a day's heart-rate histogram ({bucketStartBpm: minutes}, 5 bpm buckets). `edges` lets a user's own zone bands (% of max HR) override the defaults. */
export function zoneMinutes(hist: Record<string, number> | undefined, hrMax: number, edges: readonly number[] = ZONE_EDGES): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const [bucket, min] of Object.entries(hist ?? {})) {
    const frac = (Number(bucket) + 2.5) / hrMax;
    const z = edges.findIndex((edge, i) => i < 5 && frac >= edge && frac < edges[i + 1]);
    if (z >= 0) out[z] += min;
  }
  return out;
}

// ---------- engine ----------
export function createMetrics(provider: HealthProvider) {
  const sleepCache = new Map<string, SleepScoreResult | null>();
  const recoveryCache = new Map<string, RecoveryResult | null>();
  const strainCache = new Map<string, StrainResult | null>();
  const profile = provider.getProfile();
  const male = profile.sex !== 'female';
  const age = profile.age ?? 30;

  // Sleep/HR-zone/max-HR overrides in Preferences change what these caches would return, so any relevant
  // change must clear them — otherwise a date already viewed keeps showing numbers computed under the old settings.
  useHealthPrefs.subscribe((s, prev) => {
    if (s.sleepGoalMin !== prev.sleepGoalMin || s.hrMaxSource !== prev.hrMaxSource || s.hrMaxManual !== prev.hrMaxManual || s.hrRestSource !== prev.hrRestSource || s.hrRestManual !== prev.hrRestManual || s.zoneBands !== prev.zoneBands) {
      sleepCache.clear();
      recoveryCache.clear();
      strainCache.clear();
    }
  });

  const prior = (date: string, days: number) => {
    const out: { date: string; day: DaySummary }[] = [];
    for (let k = 1; k <= days; k++) {
      const d = addDays(date, -k);
      const day = provider.getDay(d);
      if (day) out.push({ date: d, day });
    }
    return out;
  };

  /**
   * A day's resting heart rate, honouring Preferences → Heart Preferences: Apple's own daily figure, the
   * average heart rate across your sleep, or a value you typed in. Used for both the recovery contributor and
   * its baseline, so the two are always measured the same way.
   */
  const rhrOf = (d: DaySummary | undefined): number | null | undefined => {
    if (!d) return null;
    const prefs = useHealthPrefs.getState();
    if (prefs.hrRestSource === 'manual' && prefs.hrRestManual != null) return prefs.hrRestManual;
    if (prefs.hrRestSource === 'sleep') return d.overnight?.hrAvg ?? d.rhr;
    return d.rhr;
  };

  /** Resting HR and max HR used for heart-rate-reserve maths — the user's manual overrides (Preferences → Heart Preferences) win when set. */
  function hrProfile(date: string) {
    const prefs = useHealthPrefs.getState();
    let hrRest: number;
    if (prefs.hrRestSource === 'manual' && prefs.hrRestManual != null) hrRest = prefs.hrRestManual;
    else {
      const rhrs = prior(date, BASELINE_DAYS).map((p) => rhrOf(p.day)).filter((v): v is number => v != null);
      hrRest = rhrs.length >= MIN_BASELINE ? median(rhrs) : rhrOf(provider.getDay(date)) ?? 60;
    }
    let hrMax: number;
    if (prefs.hrMaxSource === 'manual' && prefs.hrMaxManual != null) hrMax = prefs.hrMaxManual;
    else {
      const formula = 220 - age;
      const observed = prior(date, 180).map((p) => p.day.hr?.max ?? 0);
      hrMax = clamp(Math.max(formula, ...observed), formula, formula + 10);
    }
    return { hrRest, hrMax };
  }

  function strain(date: string): StrainResult | null {
    if (strainCache.has(date)) return strainCache.get(date)!;
    const day = provider.getDay(date);
    let res: StrainResult | null = null;
    if (day?.hr) {
      const { hrRest, hrMax } = hrProfile(date);
      const a = male ? 0.64 : 0.86;
      const b = male ? 1.92 : 1.67;
      let trimp = 0;
      for (const [bucket, min] of Object.entries(day.hr.hist)) {
        const hrr = clamp((Number(bucket) + 2.5 - hrRest) / (hrMax - hrRest), 0, 1);
        const x = clamp((hrr - HRR_FLOOR) / (1 - HRR_FLOOR), 0, 1);
        if (x > 0) trimp += min * x * a * Math.exp(b * x); // Banister TRIMP on rescaled reserve
      }
      const s = toStrain(trimp);
      const bands = useHealthPrefs.getState().zoneBands;
      const edges = bands ? [0, ...bands, 10] : ZONE_EDGES;
      res = { strain: Math.round(s * 10) / 10, trimp: Math.round(trimp), hrRest, hrMax, label: strainLabel(s), zones: zoneMinutes(day.hr.hist, hrMax, edges) };
    }
    strainCache.set(date, res);
    return res;
  }

  function sleep(date: string): SleepScoreResult | null {
    if (sleepCache.has(date)) return sleepCache.get(date)!;
    const s = provider.getDay(date)?.sleep;
    let res: SleepScoreResult | null = null;
    if (s) {
      const prevStrain = strain(addDays(date, -1))?.strain ?? null;
      const goalMin = useHealthPrefs.getState().sleepGoalMin ?? SLEEP_NEED_BASE_MIN;
      const needMin = Math.round(goalMin + SLEEP_NEED_MAX_EXTRA_MIN * ((prevStrain ?? 8) / 21));

      const durScore = clamp(s.asleepMin / needMin, 0, 1) * 100;
      const effScore = clamp((s.efficiency - 75) / 20, 0, 1) * 100;
      const restRatio = (s.deepMin + s.remMin) / Math.max(s.asleepMin, 1);
      const restScore = clamp(restRatio / 0.4, 0, 1) * 100;

      // consistency: bed/wake time vs. average of the previous nights (needs ≥ 3)
      const past = prior(date, 14).map((p) => p.day.sleep).filter((x): x is SleepSession => !!x).slice(0, 7);
      let consScore: number | null = null;
      let consDetail = 'Needs 3+ previous nights';
      if (past.length >= 3) {
        const dev = (Math.abs(bedMin(s) - mean(past.map(bedMin))) + Math.abs(wakeMin(s) - mean(past.map(wakeMin)))) / 2;
        consScore = clamp(1 - (dev - 30) / 90, 0, 1) * 100;
        consDetail = `${Math.round(dev)} min off your usual schedule`;
      }

      const components: SleepComponent[] = [
        { key: 'duration', label: 'Duration', score: durScore, weight: SLEEP_WEIGHTS.duration, detail: `${fmtMin(s.asleepMin)} of ${fmtMin(needMin)} needed` },
        { key: 'efficiency', label: 'Efficiency', score: effScore, weight: SLEEP_WEIGHTS.efficiency, detail: `${s.efficiency}% of time in bed asleep` },
        { key: 'restorative', label: 'Restorative sleep', score: restScore, weight: SLEEP_WEIGHTS.restorative, detail: `Deep + REM = ${Math.round(restRatio * 100)}% of sleep (goal 40%)` },
        { key: 'consistency', label: 'Consistency', score: consScore, weight: SLEEP_WEIGHTS.consistency, detail: consDetail },
      ];
      const used = components.filter((c) => c.score != null);
      const score = used.reduce((t, c) => t + c.score! * c.weight, 0) / used.reduce((t, c) => t + c.weight, 0);
      res = { score: Math.round(score), needMin, components };
    }
    sleepCache.set(date, res);
    return res;
  }

  function recovery(date: string): RecoveryResult | null {
    if (recoveryCache.has(date)) return recoveryCache.get(date)!;
    const day = provider.getDay(date);
    let res: RecoveryResult | null = null;
    if (day) {
      const hrvOf = (d: DaySummary) => d.overnight?.hrv ?? d.hrvAvg;
      const respOf = (d: DaySummary) => d.overnight?.resp ?? d.respAvg;
      const base = prior(date, BASELINE_DAYS).map((p) => p.day);
      const series = (f: (d: DaySummary) => number | null | undefined) => base.map(f).filter((v): v is number => v != null && v > 0);

      const contributors: Contributor[] = [];
      const hrv = hrvOf(day);
      const hrvB = series(hrvOf);
      if (hrv && hrvB.length >= MIN_BASELINE) {
        // anchored on the MEDIAN of your recent nights, which a freak night can't drag around
        const centre = median(hrvB);
        const rein = (v: number) => clamp(v, centre / HRV_NIGHT_CAP, centre * HRV_NIGHT_CAP);
        // average the night's individual readings once each has been reined in; a fixture without the
        // per-reading detail falls back to reining in the night's mean
        const nightly = day.overnight?.hrvAll?.length ? mean(day.overnight.hrvAll.map(rein)) : rein(hrv);
        const lb = hrvB.map((v) => Math.log(rein(v)));
        contributors.push({
          key: 'hrv', label: 'HRV (SDNN)', unit: 'ms', value: hrv, baseline: centre,
          z: clamp((Math.log(nightly) - mean(lb)) / Math.max(sd(lb), 0.08), -3, 3),
          weight: RECOVERY_WEIGHTS.hrv, higherIsBetter: true,
          ...(Math.abs(nightly - hrv) > 0.5 ? { capped: Math.round(nightly * 10) / 10 } : {}),
        });
      }
      const rhrB = series(rhrOf);
      const rhrToday = rhrOf(day);
      if (rhrToday && rhrB.length >= MIN_BASELINE)
        contributors.push({ key: 'rhr', label: 'Resting heart rate', unit: 'bpm', value: rhrToday, baseline: mean(rhrB), z: clamp(-(rhrToday - mean(rhrB)) / Math.max(sd(rhrB), 1.5), -3, 3), weight: RECOVERY_WEIGHTS.rhr, higherIsBetter: false });
      const resp = respOf(day);
      const respB = series(respOf);
      if (resp && respB.length >= MIN_BASELINE)
        contributors.push({ key: 'resp', label: 'Respiratory rate', unit: 'br/min', value: resp, baseline: mean(respB), z: clamp(-(resp - mean(respB)) / Math.max(sd(respB), 0.4), -3, 3), weight: RECOVERY_WEIGHTS.resp, higherIsBetter: false });

      // need HRV or resting HR as the physiological anchor
      if (contributors.some((c) => c.key === 'hrv' || c.key === 'rhr')) {
        const sl = sleep(date);
        if (sl) contributors.push({ key: 'sleep', label: 'Sleep score', unit: '/100', value: sl.score, baseline: null, z: clamp((sl.score - 75) / 15, -3, 3), weight: RECOVERY_WEIGHTS.sleep, higherIsBetter: true });
        const wsum = contributors.reduce((t, c) => t + c.weight, 0);
        const z = contributors.reduce((t, c) => t + c.z * c.weight, 0) / wsum;
        const score = Math.round(clamp(100 * normCdf(z + 0.15), 0, 100));
        res = { score, band: recoveryBand(score), z, contributors };
      }
    }
    recoveryCache.set(date, res);
    return res;
  }

  return { sleep, recovery, strain, hrProfile, stress: createStress(provider), fitness: createFitness(provider) };
}

export type Metrics = ReturnType<typeof createMetrics>;
