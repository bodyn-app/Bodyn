// Fitness age: the age at which the typical person of your sex has the same VO2 max as you.
//
// Reference: published median (50th percentile) treadmill VO2 max, mL/kg/min — men 48.0 at ages 20–29 falling to
// 24.4 at 70–79, women 37.6 falling to 18.3 (FRIEND registry, Kaminsky et al., Mayo Clinic Proceedings 2015).
// We connect the age-25 and age-75 medians with a straight line. Real decline is slightly curved, so treat it as an estimate.
import { addDays, type HealthProvider } from '../health/provider';
import { clamp, median } from './math';

const REFERENCE = {
  male: { at25: 48.0, at75: 24.4 },
  female: { at25: 37.6, at75: 18.3 },
} as const;
type Sex = keyof typeof REFERENCE;
const sexKey = (sex: string | null | undefined): Sex => (sex === 'female' ? 'female' : 'male');

/** Median VO2 max for a given age and sex (straight line between ages 25 and 75). */
export function vo2Median(age: number, sex: string | null | undefined) {
  const r = REFERENCE[sexKey(sex)];
  return r.at25 + ((r.at75 - r.at25) * (age - 25)) / 50;
}

/** Age whose median VO2 max equals `vo2`, kept within 18–90. */
export function fitnessAgeFromVo2(vo2: number, sex: string | null | undefined) {
  const r = REFERENCE[sexKey(sex)];
  return clamp(25 + ((r.at25 - vo2) * 50) / (r.at25 - r.at75), 18, 90);
}

export type FitnessCategory = 'Excellent' | 'Above average' | 'Average' | 'Below average';
export const fitnessCategory = (ratio: number): FitnessCategory => (ratio >= 1.15 ? 'Excellent' : ratio >= 1.0 ? 'Above average' : ratio >= 0.85 ? 'Average' : 'Below average');

// how far fitness age can sit from real age and still count as "about the same" — the middle of a 6-12 month range
export const BAND_YEARS = 0.75;
export type FitnessBand = 'younger' | 'same' | 'older';
export const fitnessBand = (fitnessAge: number, age: number): FitnessBand =>
  fitnessAge <= age - BAND_YEARS ? 'younger' : fitnessAge >= age + BAND_YEARS ? 'older' : 'same';

export type FitnessResult = {
  /** current VO2 max (median of the last 3 readings, to smooth out noise) */
  vo2: number;
  latestDate: string;
  readings: number;
  /** one decimal place */
  fitnessAge: number;
  age: number;
  /** fitness age minus real age, one decimal place: negative = fitter than your age */
  delta: number;
  band: FitnessBand;
  /** typical VO2 max for your real age and sex */
  typical: number;
  category: FitnessCategory;
  /** monthly average VO2 max, oldest first (gaps are months without readings) */
  monthly: { month: string; vo2: number | null }[];
};

export function createFitness(provider: HealthProvider) {
  let cached: FitnessResult | null | undefined;
  return function fitness(): FitnessResult | null {
    if (cached !== undefined) return cached;
    const { age, sex } = provider.getProfile();
    const readings = provider
      .getRange(provider.firstDay, provider.lastDay)
      .filter((r) => r.day?.vo2max != null)
      .map((r) => ({ date: r.date, vo2: r.day!.vo2max! }));
    if (!readings.length || !age) return (cached = null);

    const vo2 = median(readings.slice(-3).map((r) => r.vo2));
    const fitnessAge = fitnessAgeFromVo2(vo2, sex);
    const typical = vo2Median(age, sex);

    const byMonth = new Map<string, number[]>();
    for (const r of readings) byMonth.set(r.date.slice(0, 7), [...(byMonth.get(r.date.slice(0, 7)) ?? []), r.vo2]);
    const monthly: { month: string; vo2: number | null }[] = [];
    const last = readings[readings.length - 1].date.slice(0, 7);
    for (let m = readings[0].date.slice(0, 7); m <= last; m = addDays(`${m}-15`, 30).slice(0, 7)) {
      const v = byMonth.get(m);
      monthly.push({ month: m, vo2: v ? v.reduce((a, b) => a + b, 0) / v.length : null });
    }

    const roundedAge = Math.round(fitnessAge * 10) / 10;
    return (cached = {
      vo2,
      latestDate: readings[readings.length - 1].date,
      readings: readings.length,
      fitnessAge: roundedAge,
      age,
      delta: Math.round((roundedAge - age) * 10) / 10,
      band: fitnessBand(roundedAge, age),
      typical,
      category: fitnessCategory(vo2 / typical),
      monthly,
    });
  };
}
