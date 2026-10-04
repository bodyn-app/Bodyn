// Shape of the daily summaries produced by src/health/import/parse-core.ts (in the browser import and scripts/parse-health-export.mts).
// A HealthKitProvider later must return the same shapes.
export type HeartRateDay = { min: number; avg: number; max: number; hist: Record<string, number> };

export type SleepSession = {
  start: string;
  end: string;
  asleepMin: number;
  inBedMin: number;
  awakeMin: number;
  coreMin: number;
  deepMin: number;
  remMin: number;
  efficiency: number;
  /** [startMin, endMin, stage] relative to sleep start. stage: 0 awake, 1 core, 2 deep, 3 rem */
  stages: [number, number, number][];
};

export type DaySummary = {
  steps: number | null;
  distanceKm: number | null;
  activeKcal: number | null;
  basalKcal: number | null;
  exerciseMin: number | null;
  standHours: number | null;
  goals: { moveKcal: number | null; exerciseMin: number | null; standHours: number | null } | null;
  hourly: { steps: number[] | null; activeKcal: number[] | null; hr: (number | null)[] | null };
  hr: HeartRateDay | null;
  rhr: number | null;
  hrvAvg: number | null;
  hrvSamples: number;
  spo2: number | null;
  respAvg: number | null;
  vo2max: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  sleep: SleepSession | null;
  naps: SleepSession[];
  /** `hrvAll` is every SDNN reading inside the sleep window, so scoring can damp a single artefact; `hrv` is their plain mean (what Apple Health shows). */
  overnight: { hrv?: number | null; hrvAll?: number[]; hrMin?: number | null; hrAvg?: number | null; resp?: number | null };
};

export type Workout = {
  type: string;
  start: string;
  end: string;
  durationMin: number | null;
  distanceKm: number | null;
  /** active energy burned during the workout */
  kcal: number | null;
  /** resting (basal) energy burned during the same period */
  kcalRest: number | null;
  source: string;
  hrAvg: number | null;
  hrMin: number | null;
  hrMax: number | null;
  route: string | null;
};

export type Profile = {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
};
