import type { DaySummary, Profile, Workout } from '@/data/types';

/** Everything the UI and metrics engine know about health data. POC = fixtures, later = HealthKit. */
export interface HealthProvider {
  readonly firstDay: string;
  readonly lastDay: string;
  getDay(date: string): DaySummary | undefined;
  /** Inclusive range; days without data are returned with day = undefined. */
  getRange(from: string, to: string): { date: string; day: DaySummary | undefined }[];
  getWorkouts(from?: string, to?: string): Workout[];
  /** Raw heart-rate samples [minuteOfDay, bpm] — only available for recent days. */
  getHrSamples(date: string): [number, number][];
  getProfile(): Profile;
}

export const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
