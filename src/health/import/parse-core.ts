// Turns the lines of an Apple Health export.xml into the compact daily summaries the app runs on.
// Pure (no fs, no DOM) so the same code runs in the browser import and in scripts/parse-health-export.mts.
// Records are matched with regexes line by line — no XML parser, so no entity expansion from the file's DTD.
import type { DaySummary, Profile, SleepSession, Workout } from '../../data/types';

export type HealthData = {
  generatedAt: string;
  firstDay: string;
  lastDay: string;
  days: Record<string, DaySummary>;
  /** raw heart-rate samples [minuteOfDay, bpm] for the most recent days only */
  hr: Record<string, [number, number][]>;
  workouts: Workout[];
  profile: Profile;
};

export type ParseOptions = {
  /** ignore records before this fixed day; overrides `historyYears` */
  cutoff?: string;
  /** otherwise keep this many years of history before the export date (default 2) */
  historyYears?: number;
  hrRecentDays?: number;
  /** clock used for age and generatedAt; injectable for tests */
  now?: number;
};

const HR_GAP_CAP_MIN = 10; // cap on minutes an HR sample is assumed to represent
const HR_BUCKET = 5; // bpm width of the per-day HR histogram

const Q = 'HKQuantityTypeIdentifier';
const C = 'HKCategoryTypeIdentifier';
const T = {
  steps: `${Q}StepCount`,
  dist: `${Q}DistanceWalkingRunning`,
  active: `${Q}ActiveEnergyBurned`,
  basal: `${Q}BasalEnergyBurned`,
  hr: `${Q}HeartRate`,
  rhr: `${Q}RestingHeartRate`,
  hrv: `${Q}HeartRateVariabilitySDNN`,
  resp: `${Q}RespiratoryRate`,
  spo2: `${Q}OxygenSaturation`,
  vo2: `${Q}VO2Max`,
  mass: `${Q}BodyMass`,
  fat: `${Q}BodyFatPercentage`,
  height: `${Q}Height`,
  sleep: `${C}SleepAnalysis`,
};
const WANTED = new Set(Object.values(T));

// ---------- helpers ----------
const attrs = (line: string) => {
  const o: Record<string, string> = {};
  for (const m of line.matchAll(/([\w:]+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};
// Apple timestamps look like "2026-09-10 03:07:53 +0300"; keep local wall-clock parts as-is.
const localDate = (s: string) => s.slice(0, 10);
const localMinOfDay = (s: string) => +s.slice(11, 13) * 60 + +s.slice(14, 16);
const localHour = (s: string) => +s.slice(11, 13);
const epoch = (s: string) => Date.parse(`${s.slice(0, 10)}T${s.slice(11, 19)}${s.slice(20, 23)}:${s.slice(23, 25)}`);
const round = (n: number | null | undefined, d = 1): number | null => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const zeros = () => new Array<number>(24).fill(0);
/** the same calendar day n years earlier, as a string for comparisons ("2026-09-23" → "2024-09-23") */
const yearsBefore = (day: string, n: number) => `${+day.slice(0, 4) - n}${day.slice(4, 10)}`;
const prevDay = (day: string) => new Date(Date.parse(day) - 864e5).toISOString().slice(0, 10);

type Source = { total: number; hourly: number[] };
type Stage = 'Awake' | 'AsleepCore' | 'AsleepDeep' | 'AsleepREM' | 'AsleepUnspecified';
type SleepRec = [number, number, Stage, string, string]; // [startEpoch, endEpoch, stage, startStr, endStr]
type Session = SleepSession & { startMs: number; endMs: number; wakeDay: string };

export function createParser(opts: ParseOptions = {}) {
  const HR_RECENT_DAYS = opts.hrRecentDays ?? 14;
  const now = opts.now ?? Date.now();
  const years = opts.historyYears ?? 2;
  // a window relative to the export, so anyone's export works however old or new it is. Until <ExportDate> is read
  // (it comes before the records) the window ends today
  let CUTOFF = opts.cutoff ?? yearsBefore(new Date(now).toISOString(), years);

  // per-source accumulators for additive metrics: acc[metric][day][source] = { total, hourly[24] }
  const acc: Record<'steps' | 'dist' | 'active' | 'basal', Record<string, Record<string, Source>>> = { steps: {}, dist: {}, active: {}, basal: {} };
  const add = (metric: keyof typeof acc, day: string, source: string, hour: number, v: number) => {
    const d = (acc[metric][day] ??= {});
    const s = (d[source] ??= { total: 0, hourly: zeros() });
    s.total += v;
    s.hourly[hour] += v;
  };

  const hrByDay: Record<string, [number, number, number][]> = {}; // day -> [[epochMs, minOfDay, bpm]]
  const point: Record<'rhr' | 'vo2' | 'mass' | 'fat', Record<string, number>> = { rhr: {}, vo2: {}, mass: {}, fat: {} };
  const hrvByDay: Record<string, [number, number, number][]> = {}; // day -> [[epochMs, minOfDay, ms]]
  const respByDay: Record<string, [number, number][]> = {}; // day -> [[epochMs, v]]
  const spo2ByDay: Record<string, [number, number][]> = {};
  const sleepRecs: SleepRec[] = [];
  const workouts: Workout[] = [];
  const activitySummary: Record<string, { activeKcal: number; moveGoal: number | null; exerciseMin: number; exerciseGoal: number | null; standHours: number; standGoal: number | null }> = {};
  let profile: Partial<Profile> = {};
  let latestHeight: number | null = null;
  let curWorkout: Workout | null = null;
  let lines = 0;

  function line(raw: string) {
    lines++;
    const line = raw.trimStart();
    const c1 = line.charCodeAt(1); // fast dispatch on '<R'ecord / '<W'orkout ...

    if (c1 === 82 /* R */ && line.startsWith('<Record ')) {
      const tm = line.match(/type="([^"]+)"/);
      if (!tm || !WANTED.has(tm[1])) return;
      const a = attrs(line);
      const start = a.startDate;
      if (!start) return;
      const day = localDate(start);
      if (day < CUTOFF) return;
      const src = a.sourceName ?? '';
      const isWatch = src.includes('Watch');
      const v = a.value !== undefined ? parseFloat(a.value) : NaN;
      const hour = localHour(start);

      switch (tm[1]) {
        case T.steps: add('steps', day, src, hour, v); break;
        case T.dist: add('dist', day, src, hour, v); break;
        case T.active: if (isWatch) add('active', day, src, hour, v); break;
        case T.basal: add('basal', day, src, hour, v); break;
        case T.hr: if (isWatch) (hrByDay[day] ??= []).push([epoch(start), localMinOfDay(start), v]); break;
        case T.rhr: if (isWatch) point.rhr[day] = v; break;
        case T.hrv: if (isWatch) (hrvByDay[day] ??= []).push([epoch(start), localMinOfDay(start), v]); break;
        case T.resp: if (isWatch) (respByDay[day] ??= []).push([epoch(start), v]); break;
        case T.spo2: if (isWatch) (spo2ByDay[day] ??= []).push([epoch(start), v <= 1 ? v * 100 : v]); break;
        case T.vo2: point.vo2[day] = v; break;
        case T.mass: point.mass[day] = v; break;
        case T.fat: point.fat[day] = v <= 1 ? v * 100 : v; break;
        case T.height: latestHeight = v; break;
        case T.sleep: {
          if (!isWatch || !a.value || !a.endDate || a.value.endsWith('InBed')) break;
          const stage = a.value.replace('HKCategoryValueSleepAnalysis', '') as Stage; // Awake|AsleepCore|AsleepDeep|AsleepREM|AsleepUnspecified
          if (!(stage in STAGE_CODE)) break;
          sleepRecs.push([epoch(start), epoch(a.endDate), stage, start, a.endDate]);
          break;
        }
      }
    } else if (c1 === 65 /* A */ && line.startsWith('<ActivitySummary ')) {
      const a = attrs(line);
      const day = a.dateComponents;
      if (day && day >= CUTOFF)
        activitySummary[day] = {
          activeKcal: +a.activeEnergyBurned || 0,
          moveGoal: +a.activeEnergyBurnedGoal || null,
          exerciseMin: +a.appleExerciseTime || 0,
          exerciseGoal: +a.appleExerciseTimeGoal || null,
          standHours: +a.appleStandHours || 0,
          standGoal: +a.appleStandHoursGoal || null,
        };
    } else if (c1 === 87 /* W */ && line.startsWith('<Workout ')) {
      const a = attrs(line);
      if (!a.startDate || !a.endDate) return;
      curWorkout = {
        type: (a.workoutActivityType ?? '').replace('HKWorkoutActivityType', ''),
        start: a.startDate,
        end: a.endDate,
        durationMin: round(+a.duration, 1),
        distanceKm: a.totalDistance ? round(+a.totalDistance * (a.totalDistanceUnit === 'mi' ? 1.609344 : 1), 2) : null,
        kcal: a.totalEnergyBurned ? round(+a.totalEnergyBurned, 0) : null,
        source: a.sourceName ?? '',
        kcalRest: null,
        hrAvg: null, hrMin: null, hrMax: null, route: null,
      };
      if (line.endsWith('/>')) { workouts.push(curWorkout); curWorkout = null; }
    } else if (curWorkout && c1 === 87 && line.startsWith('<WorkoutStatistics ')) {
      const a = attrs(line);
      if (a.type === `${Q}HeartRate`) {
        curWorkout.hrAvg = round(+a.average, 0);
        curWorkout.hrMin = round(+a.minimum, 0);
        curWorkout.hrMax = round(+a.maximum, 0);
      } else if (a.type === `${Q}ActiveEnergyBurned`) {
        // newer exports keep workout energy here instead of on the <Workout> element
        curWorkout.kcal ??= round(+a.sum, 0);
      } else if (a.type === `${Q}BasalEnergyBurned`) {
        curWorkout.kcalRest = round(+a.sum, 0);
      } else if (a.type?.startsWith(`${Q}Distance`) && curWorkout.distanceKm == null) {
        const f = a.unit === 'mi' ? 1.609344 : a.unit === 'm' ? 0.001 : a.unit === 'yd' ? 0.0009144 : 1;
        curWorkout.distanceKm = round(+a.sum * f, 2);
      }
    } else if (curWorkout && c1 === 70 /* F */ && line.startsWith('<FileReference ')) {
      curWorkout.route = attrs(line).path?.split('/').pop() ?? null;
    } else if (curWorkout && line.startsWith('</Workout>')) {
      workouts.push(curWorkout);
      curWorkout = null;
    } else if (c1 === 69 /* E */ && line.startsWith('<ExportDate ')) {
      const v = attrs(line).value;
      if (!opts.cutoff && v && /^\d{4}-\d{2}-\d{2}/.test(v)) CUTOFF = yearsBefore(v, years);
    } else if (c1 === 77 /* M */ && line.startsWith('<Me ')) {
      const a = attrs(line);
      const dob = a.HKCharacteristicTypeIdentifierDateOfBirth;
      profile = {
        age: dob ? Math.floor((now - Date.parse(dob)) / (365.25 * 864e5)) : null,
        sex: (a.HKCharacteristicTypeIdentifierBiologicalSex ?? '').replace('HKBiologicalSex', '').toLowerCase() || null,
      };
    }
  }

  function finish(): HealthData {
    // ---------- sleep sessions ----------
    const GAP_MS = 90 * 60e3;
    sleepRecs.sort((a, b) => a[0] - b[0]);
    const clusters: { recs: SleepRec[]; endMs: number }[] = [];
    for (const r of sleepRecs) {
      const last = clusters[clusters.length - 1];
      if (last && r[0] - last.endMs < GAP_MS) {
        last.recs.push(r);
        last.endMs = Math.max(last.endMs, r[1]);
      } else clusters.push({ recs: [r], endMs: r[1] });
    }
    const minutes = (r: SleepRec) => (r[1] - r[0]) / 60e3;
    const sessions = clusters
      .map((cl): Session | null => {
        // trim leading/trailing awake so start = first asleep, end = last asleep
        let recs = cl.recs;
        while (recs.length && recs[0][2] === 'Awake') recs = recs.slice(1);
        while (recs.length && recs[recs.length - 1][2] === 'Awake') recs = recs.slice(0, -1);
        if (!recs.length) return null;
        const stageMin: Record<Stage, number> = { Awake: 0, AsleepCore: 0, AsleepDeep: 0, AsleepREM: 0, AsleepUnspecified: 0 };
        for (const r of recs) stageMin[r[2]] += minutes(r);
        const asleepMin = stageMin.AsleepCore + stageMin.AsleepDeep + stageMin.AsleepREM + stageMin.AsleepUnspecified;
        const startMs = recs[0][0];
        const endMs = recs[recs.length - 1][1];
        return {
          startMs, endMs,
          wakeDay: localDate(recs[recs.length - 1][4]),
          start: recs[0][3], end: recs[recs.length - 1][4],
          asleepMin: round(asleepMin, 0)!,
          inBedMin: round((endMs - startMs) / 60e3, 0)!,
          awakeMin: round(stageMin.Awake, 0)!,
          coreMin: round(stageMin.AsleepCore + stageMin.AsleepUnspecified, 0)!,
          deepMin: round(stageMin.AsleepDeep, 0)!,
          remMin: round(stageMin.AsleepREM, 0)!,
          efficiency: round((asleepMin / ((endMs - startMs) / 60e3)) * 100, 0)!,
          // hypnogram: [startMinFromSleepStart, endMinFromSleepStart, stage 0=awake 1=core 2=deep 3=rem]
          stages: recs.map((r) => [round((r[0] - startMs) / 60e3, 2)!, round((r[1] - startMs) / 60e3, 2)!, STAGE_CODE[r[2]]]),
        };
      })
      .filter((s): s is Session => !!s && s.asleepMin >= 20);

    const sleepByDay: Record<string, { main: Session | null; naps: Session[] }> = {};
    for (const s of sessions) {
      const slot = (sleepByDay[s.wakeDay] ??= { main: null, naps: [] });
      if (!slot.main || s.asleepMin > slot.main.asleepMin) {
        if (slot.main) slot.naps.push(slot.main);
        slot.main = s;
      } else slot.naps.push(s);
    }
    const strip = ({ startMs, endMs, wakeDay, ...rest }: Session): SleepSession => rest;

    // ---------- assemble days ----------
    const pickSource = (metric: keyof typeof acc, day: string) => {
      const d = acc[metric][day];
      if (!d) return null;
      return Object.values(d).reduce((best, s) => (s.total > best.total ? s : best));
    };

    const allDays = new Set([
      ...Object.keys(acc.steps), ...Object.keys(acc.active), ...Object.keys(hrByDay), ...Object.keys(sleepByDay),
      ...Object.keys(activitySummary), ...Object.keys(hrvByDay),
    ]);

    const days: Record<string, DaySummary> = {};
    const hrRecent: Record<string, [number, number][]> = {};
    const sortedDays = [...allDays].filter((d) => d >= CUTOFF).sort();
    if (!sortedDays.length) throw new Error('No health records found in this export.');
    const lastDay = sortedDays[sortedDays.length - 1];
    const recentFrom = new Date(Date.parse(lastDay) - (HR_RECENT_DAYS - 1) * 864e5).toISOString().slice(0, 10);

    for (const day of sortedDays) {
      const steps = pickSource('steps', day);
      const dist = pickSource('dist', day);
      const active = pickSource('active', day);
      const basal = pickSource('basal', day);
      const summary = activitySummary[day] ?? null;

      // heart rate: min/avg/max, hourly avg, and time-weighted histogram (minutes per 5-bpm bucket)
      let hr: DaySummary['hr'] = null;
      let hrHourly: (number | null)[] | null = null;
      const samples = (hrByDay[day] ?? []).sort((a, b) => a[0] - b[0]);
      if (samples.length) {
        let min = Infinity;
        let max = -Infinity;
        for (const s of samples) {
          if (s[2] < min) min = s[2];
          if (s[2] > max) max = s[2];
        }
        const hist: Record<string, number> = {};
        const hours: number[][] = Array.from({ length: 24 }, () => []);
        samples.forEach((s, i) => {
          const next = samples[i + 1];
          const w = Math.min(next ? (next[0] - s[0]) / 60e3 : HR_GAP_CAP_MIN, HR_GAP_CAP_MIN);
          const b = Math.floor(s[2] / HR_BUCKET) * HR_BUCKET;
          hist[b] = round((hist[b] ?? 0) + w, 2)!;
          hours[Math.floor(s[1] / 60)].push(s[2]);
        });
        hr = { min, avg: round(mean(samples.map((s) => s[2])), 0)!, max, hist };
        hrHourly = hours.map((h) => round(mean(h), 0));
        if (day >= recentFrom) hrRecent[day] = samples.map((s) => [s[1], s[2]]);
      }

      // sleep + overnight physiology
      const slot = sleepByDay[day];
      const sleep = slot?.main ? strip(slot.main) : null;
      const naps = (slot?.naps ?? []).map(strip);
      let overnight: DaySummary['overnight'] = {};
      if (slot?.main) {
        const { startMs, endMs } = slot.main;
        const within = <R extends number[]>(arr: R[], idx: number) => arr.filter((x) => x[0] >= startMs && x[0] <= endMs).map((x) => x[idx]);
        const hrvN = within(hrvByDay[day] ?? [], 2);
        // HRV often recorded during the night of the previous calendar day too
        const prev = prevDay(day);
        const hrvPrev = within(hrvByDay[prev] ?? [], 2);
        const hrN = within(hrByDay[day] ?? [], 2).concat(within(hrByDay[prev] ?? [], 2));
        // keep the individual overnight readings too: with only a handful of SDNN samples a night, one
        // artefact (often a movement spike near wake-up) can double the mean, and the scoring engine needs the
        // raw values to be able to rein that in against your own baseline
        const hrvNight = hrvN.concat(hrvPrev);
        overnight = {
          hrv: round(mean(hrvNight), 1),
          hrvAll: hrvNight.map((v) => round(v, 1)!),
          hrMin: hrN.length ? Math.min(...hrN) : null,
          hrAvg: round(mean(hrN), 0),
          resp: round(mean(within(respByDay[day] ?? [], 1).concat(within(respByDay[prev] ?? [], 1))), 1),
        };
      }

      const hrvAll = (hrvByDay[day] ?? []).map((x) => x[2]);
      days[day] = {
        steps: steps ? Math.round(steps.total) : null,
        distanceKm: dist ? round(dist.total, 2) : null,
        activeKcal: summary ? Math.round(summary.activeKcal) : active ? Math.round(active.total) : null,
        basalKcal: basal ? Math.round(basal.total) : null,
        exerciseMin: summary?.exerciseMin ?? null,
        standHours: summary?.standHours ?? null,
        goals: summary ? { moveKcal: summary.moveGoal, exerciseMin: summary.exerciseGoal, standHours: summary.standGoal } : null,
        hourly: {
          steps: steps ? steps.hourly.map(Math.round) : null,
          activeKcal: active ? active.hourly.map((v) => round(v, 1)!) : null,
          hr: hrHourly,
        },
        hr,
        rhr: point.rhr[day] ?? null,
        hrvAvg: round(mean(hrvAll), 1),
        hrvSamples: hrvAll.length,
        spo2: round(mean((spo2ByDay[day] ?? []).map((x) => x[1])), 1),
        respAvg: round(mean((respByDay[day] ?? []).map((x) => x[1])), 1),
        vo2max: point.vo2[day] ?? null,
        weightKg: point.mass[day] ?? null,
        bodyFatPct: point.fat[day] != null ? round(point.fat[day], 1) : null,
        sleep,
        naps,
        overnight,
      };
    }

    const lastWeight = Object.entries(point.mass).sort().pop();
    const lastFat = Object.entries(point.fat).sort().pop();
    const fullProfile: Profile = {
      age: profile.age ?? null,
      sex: profile.sex ?? null,
      heightCm: latestHeight,
      weightKg: lastWeight?.[1] ?? null,
      bodyFatPct: lastFat ? round(lastFat[1], 1) : null,
    };

    workouts.sort((a, b) => (a.start < b.start ? -1 : 1));
    return {
      generatedAt: new Date(now).toISOString(),
      firstDay: sortedDays[0],
      lastDay,
      days,
      hr: hrRecent,
      workouts: workouts.filter((w) => localDate(w.start) >= CUTOFF),
      profile: fullProfile,
    };
  }

  return {
    line,
    finish,
    get lines() {
      return lines;
    },
  };
}

const STAGE_CODE: Record<Stage, number> = { Awake: 0, AsleepCore: 1, AsleepDeep: 2, AsleepREM: 3, AsleepUnspecified: 1 };

/** Splits streamed text into lines, carrying a partial last line over to the next chunk. Handles \n and \r\n. */
export function createLineSplitter(onLine: (line: string) => void) {
  let rest = '';
  const emit = (l: string) => onLine(l.endsWith('\r') ? l.slice(0, -1) : l);
  return {
    push(text: string) {
      const parts = (rest + text).split('\n');
      rest = parts.pop() ?? '';
      for (const p of parts) emit(p);
    },
    end() {
      if (rest) emit(rest);
      rest = '';
    },
  };
}
