import type { Ionicons } from '@expo/vector-icons';

import type { HealthProvider } from '../health/provider';
import type { Metrics, RecoveryResult, SleepScoreResult } from '../metrics/engine';
import type { StressResult } from '../metrics/stress';

export type Deps = { provider: HealthProvider; metrics: Metrics; /** what to call the user in greetings, if they set a name */ userName?: () => string | null };

export type IconName = keyof typeof Ionicons.glyphMap;
export type Verdict = 'push' | 'train' | 'easy' | 'walk' | 'rest' | 'sleep' | 'nodata';
export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';

/** Everything the coach knows about one day. Any metric can be null when there is no data. */
export type DayCtx = {
  date: string;
  isToday: boolean;
  recovery: RecoveryResult | null;
  sleep: SleepScoreResult | null;
  sleepMin: number | null;
  needMin: number | null;
  strain: number | null;
  prevStrain: number | null;
  stress: StressResult | null;
  /** suggested bedtime for tonight, "HH:MM" */
  bedtime: string | null;
};

/** The seven complete days before `date`. */
export type WeekCtx = {
  avgRecovery: number | null;
  avgSleepMin: number | null;
  totalStrain: number;
  workouts: number;
  hardDays: number;
  /** hard days (strain ≥ 14) in a row, counting back from the day before `date` */
  consecutiveHard: number;
  /** days since the last easy day (strain < 6); 0 when yesterday was easy */
  daysSinceRest: number | null;
  /** recent 3-day recovery average minus the 4 days before, in points */
  recoveryTrend: number | null;
  sleepDebtMin: number;
};

export type Ctx = { day: DayCtx; week: WeekCtx };

export type Advice = {
  verdict: Verdict;
  tone: Tone;
  icon: IconName;
  /** short chip label, e.g. "Train smart" */
  title: string;
  headline: string;
  body: string;
  actions: string[];
  /** suggested strain range for the day */
  target: [number, number] | null;
};

export type PlanDay = { date: string; label: string; verdict: Verdict; target: [number, number] | null; isToday: boolean };

// ---- chat ----
export type Topic = 'recovery' | 'sleep' | 'strain' | 'stress' | 'hrv' | 'rhr' | 'zones' | 'steps' | 'calories' | 'fitness' | 'workout' | 'fatigue' | 'general';
export type Ask = 'define' | 'why' | 'status' | 'compare' | 'record' | 'trend' | 'advice' | 'plan';
export type When = 'ref' | 'yesterday' | 'week' | 'lastweek' | 'month' | 'all' | 'tomorrow';
export type Aspect = 'deep' | 'rem' | 'light' | 'duration' | 'efficiency' | 'consistency' | 'bedtime' | 'lateworkout' | 'weekday';
export type Deferred = 'correlation' | 'peers' | 'life' | 'medical';

export type Parsed = {
  text: string;
  topics: Topic[];
  topic: Topic | null;
  ask: Ask;
  when: When;
  term: string | null;
  aspect: Aspect | null;
  versus: 'prev' | 'avg' | null;
  number: number | null;
  weekday: number | null;
  /** "my recovery", "today": the question is about the user's own numbers */
  personal: boolean;
  deferred: Deferred | null;
  smalltalk: 'greet' | 'thanks' | null;
  followUp: boolean;
  /** the parser found something it understands */
  understood: boolean;
};

export type CoachReply = { text: string; bullets?: string[]; chips?: string[]; kind: 'answer' | 'deferred' | 'unknown' | 'smalltalk' };
