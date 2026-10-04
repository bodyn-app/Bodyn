import { health } from '@/health';

import { createMetrics } from './engine';

import type { MetricKey } from '@/coach/insights';

import { fitnessTrend, metricProfile } from './fitness-profile';

export const metrics = createMetrics(health);
export * from './engine';
export { BAND_YEARS, fitnessAgeFromVo2, fitnessBand, vo2Median } from './fitness';
export type { FitnessBand, FitnessResult } from './fitness';
export type { FitnessTrend, MetricProfile, Tone as ProfileTone } from './fitness-profile';
export { stressLabel } from './stress';
export type { StressHour, StressLabel, StressResult } from './stress';

const deps = { provider: health, metrics };
/** A metric's last 30 days against your longer personal baseline, for the Fitness age page. */
export const fitnessProfile = (key: MetricKey, date: string) => metricProfile(deps, key, date);
/** Improving / steady / declining, from the last few months of fitness age. */
export const fitnessTrendNow = () => fitnessTrend(deps, health.getProfile().sex);
