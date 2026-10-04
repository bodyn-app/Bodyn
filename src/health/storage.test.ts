import { afterEach, describe, expect, it, vi } from 'vitest';

const asyncKeys = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (k: string) => Promise.resolve(asyncKeys.get(k) ?? null),
    setItem: (k: string, v: string) => Promise.resolve(void asyncKeys.set(k, v)),
    getAllKeys: () => Promise.resolve([...asyncKeys.keys()]),
    multiRemove: (ks: string[]) => Promise.resolve(void ks.forEach((k) => asyncKeys.delete(k))),
  },
}));

import type { HealthData } from './import/parse-core';
import { clearAllLocalData, decodeHealthData, encodeHealthData, HEALTH_KEY, isHealthData, loadHealthData, saveHealthData } from './storage';
import { createStoredProvider } from './stored-provider';

const day = (steps: number) => ({
  steps, distanceKm: null, activeKcal: null, basalKcal: null, exerciseMin: null, standHours: null, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: null, hrvAvg: null, hrvSamples: 0, spo2: null,
  respAvg: null, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
});
const sample = (): HealthData => ({
  generatedAt: '2026-09-30T12:00:00.000Z',
  firstDay: '2026-09-10',
  lastDay: '2026-09-12',
  days: { '2026-09-10': day(100), '2026-09-12': day(300) },
  hr: { '2026-09-12': [[600, 61]] },
  workouts: [
    { type: 'Running', start: '2026-09-10 07:00:00 +0300', end: '2026-09-10 07:30:00 +0300', durationMin: 30, distanceKm: 5, kcal: 300, kcalRest: null, source: 'Apple Watch', hrAvg: null, hrMin: null, hrMax: null, route: null },
    { type: 'Walking', start: '2026-09-12 07:00:00 +0300', end: '2026-09-12 07:30:00 +0300', durationMin: 30, distanceKm: 2, kcal: 100, kcalRest: null, source: 'Apple Watch', hrAvg: null, hrMin: null, hrMax: null, route: null },
  ],
  profile: { age: 30, sex: 'male', heightCm: 180, weightKg: 80, bodyFatPct: null },
});

/** an in-memory stand-in for the browser's localStorage */
function fakeLocalStorage(quota = Infinity) {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new DOMException('full', 'QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    get length() {
      return m.size;
    },
  };
  // Object.keys(localStorage) lists the stored keys in browsers; mirror that
  return new Proxy(ls, { ownKeys: () => [...m.keys()], getOwnPropertyDescriptor: (_, k) => (m.has(k as string) ? { enumerable: true, configurable: true, value: m.get(k as string) } : undefined) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  asyncKeys.clear();
});

describe('health snapshot encoding', () => {
  it('round-trips a dataset through the compressed form', () => {
    expect(decodeHealthData(encodeHealthData(sample()))).toEqual(sample());
  });
  it('treats damaged or foreign snapshots as no data instead of crashing', () => {
    expect(decodeHealthData('not base64 !!')).toBeNull();
    expect(decodeHealthData(btoa('plain text'))).toBeNull();
  });
});

describe('isHealthData', () => {
  it('accepts a well-formed dataset', () => expect(isHealthData(sample())).toBe(true));
  it.each([
    ['a bad date key', (d: HealthData) => ({ ...d, days: { ...d.days, 'yesterday': day(1) } })],
    ['firstDay after lastDay', (d: HealthData) => ({ ...d, firstDay: '2026-10-01' })],
    ['a day missing its parts', (d: HealthData) => ({ ...d, days: { '2026-09-10': { steps: 1 } } })],
    ['workouts that are not workouts', (d: HealthData) => ({ ...d, workouts: [{ hello: 'world' }] })],
    ['a missing profile', (d: HealthData) => ({ ...d, profile: undefined })],
  ])('rejects %s', (_, mutate) => expect(isHealthData(mutate(sample()) as unknown)).toBe(false));
});

describe('saving on the device', () => {
  it('saves and loads back the snapshot', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    saveHealthData(sample());
    expect(loadHealthData()).toEqual(sample());
  });
  it('explains when the browser cannot store anything (e.g. Private Browsing)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveHealthData(sample())).toThrow(/Private Browsing/);
  });
  it('explains when the device is out of space', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage(10));
    expect(() => saveHealthData(sample())).toThrow(/storage space/);
  });
  it('Delete all data removes every bodyn key and leaves other sites’ keys alone', async () => {
    const ls = fakeLocalStorage();
    vi.stubGlobal('localStorage', ls);
    saveHealthData(sample());
    ls.setItem('bodyn.units', '{}');
    ls.setItem('other-app', 'keep');
    asyncKeys.set('bodyn.intake', '[]');
    asyncKeys.set('unrelated', 'keep');
    await clearAllLocalData();
    expect(ls.getItem(HEALTH_KEY)).toBeNull();
    expect(ls.getItem('bodyn.units')).toBeNull();
    expect(ls.getItem('other-app')).toBe('keep');
    expect([...asyncKeys.keys()]).toEqual(['unrelated']);
  });
});

describe('createStoredProvider', () => {
  it('serves days, gap-filled ranges, workouts by date and recent HR samples', () => {
    const p = createStoredProvider(sample());
    expect([p.firstDay, p.lastDay]).toEqual(['2026-09-10', '2026-09-12']);
    expect(p.getRange('2026-09-10', '2026-09-12').map((r) => r.day?.steps ?? null)).toEqual([100, null, 300]);
    expect(p.getWorkouts('2026-09-11').map((w) => w.type)).toEqual(['Walking']);
    expect(p.getHrSamples('2026-09-12')).toEqual([[600, 61]]);
    expect(p.getProfile().weightKg).toBe(80);
  });
  it('is empty but safe to call before anything is imported', () => {
    const p = createStoredProvider(null);
    expect(p.firstDay).toBe(p.lastDay);
    expect(p.getDay(p.lastDay)).toBeUndefined();
    expect(p.getWorkouts()).toEqual([]);
    expect(p.getProfile().age).toBeNull();
  });
});
