import { describe, expect, it } from 'vitest';

import { createLineSplitter, createParser } from './parse-core';

const Q = 'HKQuantityTypeIdentifier';
const WATCH = 'Apple Watch';
const PHONE = 'iPhone';
const rec = (type: string, start: string, value: number | string, source = WATCH, end = start) =>
  `  <Record type="${type}" sourceName="${source}" unit="x" startDate="${start} +0300" endDate="${end} +0300" value="${value}"/>`;
const sleep = (stage: string, start: string, end: string, source = WATCH) =>
  `  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${source}" startDate="${start} +0300" endDate="${end} +0300" value="HKCategoryValueSleepAnalysis${stage}"/>`;

const parse = (lines: string[], opts = {}) => {
  const p = createParser({ now: Date.parse('2026-09-30T12:00:00Z'), ...opts });
  for (const l of lines) p.line(l);
  return p.finish();
};

describe('createParser', () => {
  it('sums steps per day from the source with the highest total, with an hourly breakdown', () => {
    const d = parse([
      rec(`${Q}StepCount`, '2026-09-10 08:15:00', 1000, PHONE),
      rec(`${Q}StepCount`, '2026-09-10 09:30:00', 500, PHONE),
      rec(`${Q}StepCount`, '2026-09-10 08:20:00', 1200, WATCH),
    ]);
    expect(d.days['2026-09-10'].steps).toBe(1500);
    expect(d.days['2026-09-10'].hourly.steps?.[8]).toBe(1000);
    expect(d.days['2026-09-10'].hourly.steps?.[9]).toBe(500);
    expect(d.firstDay).toBe('2026-09-10');
    expect(d.lastDay).toBe('2026-09-10');
  });

  it('takes heart rate from the Watch only and keeps raw samples for recent days', () => {
    const d = parse([
      rec(`${Q}HeartRate`, '2026-09-10 10:00:00', 60),
      rec(`${Q}HeartRate`, '2026-09-10 10:05:00', 90),
      rec(`${Q}HeartRate`, '2026-09-10 10:07:00', 200, PHONE),
    ]);
    const hr = d.days['2026-09-10'].hr!;
    expect([hr.min, hr.avg, hr.max]).toEqual([60, 75, 90]);
    expect(hr.hist).toEqual({ 60: 5, 90: 10 });
    expect(d.hr['2026-09-10']).toEqual([[600, 60], [605, 90]]);
  });

  it('builds a sleep session from stages, trims awake edges, ignores InBed and assigns it to the wake-up day', () => {
    const d = parse([
      sleep('InBed', '2026-09-09 22:00:00', '2026-09-10 07:00:00'),
      sleep('Awake', '2026-09-09 23:00:00', '2026-09-09 23:10:00'),
      sleep('AsleepCore', '2026-09-09 23:10:00', '2026-09-10 01:10:00'),
      sleep('AsleepDeep', '2026-09-10 01:10:00', '2026-09-10 02:10:00'),
      sleep('AsleepREM', '2026-09-10 02:10:00', '2026-09-10 03:10:00'),
      sleep('Awake', '2026-09-10 03:10:00', '2026-09-10 03:30:00'),
      rec(`${Q}HeartRateVariabilitySDNN`, '2026-09-10 01:00:00', 50),
      rec(`${Q}HeartRateVariabilitySDNN`, '2026-09-09 23:30:00', 70),
    ]);
    const s = d.days['2026-09-10'].sleep!;
    expect(s.start).toBe('2026-09-09 23:10:00 +0300');
    expect(s.end).toBe('2026-09-10 03:10:00 +0300');
    expect([s.asleepMin, s.coreMin, s.deepMin, s.remMin, s.awakeMin, s.efficiency]).toEqual([240, 120, 60, 60, 0, 100]);
    expect(s.stages[0]).toEqual([0, 120, 1]);
    // the overnight HRV includes readings logged on the previous calendar day inside the sleep window
    expect(d.days['2026-09-10'].overnight.hrv).toBe(60);
  });

  it('drops sleep sessions shorter than 20 minutes and keeps shorter extra sessions as naps', () => {
    const d = parse([
      sleep('AsleepCore', '2026-09-10 00:00:00', '2026-09-10 06:00:00'),
      sleep('AsleepCore', '2026-09-10 14:00:00', '2026-09-10 14:40:00'),
      sleep('AsleepCore', '2026-09-10 18:00:00', '2026-09-10 18:10:00'),
    ]);
    expect(d.days['2026-09-10'].sleep?.asleepMin).toBe(360);
    expect(d.days['2026-09-10'].naps.map((n) => n.asleepMin)).toEqual([40]);
  });

  it('reads workouts with their statistics, converts miles, and keeps the route file name', () => {
    const d = parse([
      rec(`${Q}StepCount`, '2026-09-10 08:00:00', 10),
      '  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" sourceName="Apple Watch" startDate="2026-09-10 07:00:00 +0300" endDate="2026-09-10 07:30:30 +0300">',
      `   <WorkoutStatistics type="${Q}HeartRate" startDate="x" endDate="x" average="150.4" minimum="100" maximum="180" unit="count/min"/>`,
      `   <WorkoutStatistics type="${Q}ActiveEnergyBurned" startDate="x" endDate="x" sum="320.6" unit="kcal"/>`,
      `   <WorkoutStatistics type="${Q}DistanceWalkingRunning" startDate="x" endDate="x" sum="3" unit="mi"/>`,
      '   <WorkoutRoute sourceName="Apple Watch">',
      '    <FileReference path="/workout-routes/route_2026-09-10_7.00am.gpx"/>',
      '   </WorkoutRoute>',
      '  </Workout>',
    ]);
    expect(d.workouts).toEqual([
      {
        type: 'Running', start: '2026-09-10 07:00:00 +0300', end: '2026-09-10 07:30:30 +0300', durationMin: 30.5, distanceKm: 4.83, kcal: 321,
        source: 'Apple Watch', kcalRest: null, hrAvg: 150, hrMin: 100, hrMax: 180, route: 'route_2026-09-10_7.00am.gpx',
      },
    ]);
  });

  it('builds the profile from <Me> and the latest body measurements', () => {
    const d = parse([
      '  <Me HKCharacteristicTypeIdentifierDateOfBirth="1990-06-15" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexFemale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>',
      rec(`${Q}StepCount`, '2026-09-10 08:00:00', 10),
      rec(`${Q}BodyMass`, '2026-09-01 08:00:00', 70, PHONE),
      rec(`${Q}BodyMass`, '2026-09-08 08:00:00', 69.5, PHONE),
      rec(`${Q}BodyFatPercentage`, '2026-09-08 08:00:00', 0.214, PHONE),
      rec(`${Q}Height`, '2026-01-01 08:00:00', 170, PHONE),
    ]);
    expect(d.profile).toEqual({ age: 36, sex: 'female', heightCm: 170, weightKg: 69.5, bodyFatPct: 21.4 });
  });

  it('keeps the two years before the export date and ignores lines it does not know (header, DTD)', () => {
    const d = parse([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE HealthData [',
      '<!ENTITY boom "aaaaaaaaaa">',
      ']>',
      ' <ExportDate value="2026-09-23 14:01:21 +0300"/>',
      rec(`${Q}StepCount`, '2024-09-22 08:00:00', 999),
      rec(`${Q}StepCount`, '2024-09-23 08:00:00', 5),
      rec(`${Q}StepCount`, '2026-09-10 08:00:00', 10),
    ]);
    expect(Object.keys(d.days)).toEqual(['2024-09-23', '2026-09-10']);
  });

  it('measures the window from the export date, so an old export still imports', () => {
    const d = parse([' <ExportDate value="2021-05-01 09:00:00 +0000"/>', rec(`${Q}StepCount`, '2020-03-10 08:00:00', 42)]);
    expect(d.days['2020-03-10'].steps).toBe(42);
  });

  it('falls back to two years before today without an export date, and a fixed cutoff overrides both', () => {
    const lines = [rec(`${Q}StepCount`, '2024-09-29 08:00:00', 1), rec(`${Q}StepCount`, '2024-10-01 08:00:00', 2)];
    expect(Object.keys(parse(lines).days)).toEqual(['2024-10-01']);
    expect(Object.keys(parse([' <ExportDate value="2026-09-23 14:01:21 +0300"/>', ...lines], { cutoff: '2024-01-01' }).days)).toEqual(['2024-09-29', '2024-10-01']);
  });

  it('fails clearly when the export has no usable records', () => {
    expect(() => parse(['<HealthData locale="en_US">', '</HealthData>'])).toThrow('No health records');
  });
});

describe('createLineSplitter', () => {
  it('rebuilds lines split across chunks, including CRLF endings', () => {
    const out: string[] = [];
    const s = createLineSplitter((l) => out.push(l));
    for (const chunk of ['<Rec', 'ord a="1"/>\r', '\n<Me/>\n<W', 'orkout/>']) s.push(chunk);
    s.end();
    expect(out).toEqual(['<Record a="1"/>', '<Me/>', '<Workout/>']);
  });
});
