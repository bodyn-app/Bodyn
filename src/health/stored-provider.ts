import type { DaySummary, Profile } from '@/data/types';

import type { HealthData } from './import/parse-core';
import { addDays, type HealthProvider } from './provider';

const EMPTY_PROFILE: Profile = { age: null, sex: null, heightCm: null, weightKg: null, bodyFatPct: null };
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};

/** A provider over a dataset imported on this device. With no data it is empty (the app shows the import screen). */
export function createStoredProvider(data: HealthData | null): HealthProvider {
  const days: Record<string, DaySummary> = data?.days ?? {};
  const hr = data?.hr ?? {};
  const workouts = data?.workouts ?? [];
  const firstDay = data?.firstDay ?? today();
  const lastDay = data?.lastDay ?? firstDay;
  return {
    firstDay,
    lastDay,
    getDay: (date) => days[date],
    getRange(from, to) {
      const out: { date: string; day: DaySummary | undefined }[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] });
      return out;
    },
    getWorkouts: (from, to) =>
      workouts.filter((w) => (!from || w.start.slice(0, 10) >= from) && (!to || w.start.slice(0, 10) <= to)),
    getHrSamples: (date) => hr[date] ?? [],
    getProfile: () => data?.profile ?? EMPTY_PROFILE,
  };
}
