import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

import { dailyWaterMl, type IntakeEntry } from './intake-log';

const at = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
const now = new Date(2026, 8, 28, 15);

describe('dailyWaterMl', () => {
  it('returns one total per day, oldest first, ending today', () => {
    const out = dailyWaterMl([], 7, now);
    expect(out).toHaveLength(7);
    expect(out[0].day.getDate()).toBe(22);
    expect(out[6].day.getDate()).toBe(28);
    expect(out.every((d) => d.ml === 0)).toBe(true);
  });
  it('sums each day’s water in ml, ignoring caffeine and other days', () => {
    const entries: IntakeEntry[] = [
      { id: 1, kind: 'water', at: at(28, 9), ml: 500 },
      { id: 2, kind: 'water', at: at(28, 12), ml: 330 },
      { id: 3, kind: 'caffeine', at: at(28, 10) },
      { id: 4, kind: 'water', at: at(27, 23), ml: 750 },
      { id: 5, kind: 'water', at: at(20, 9), ml: 1000 },
    ];
    const out = dailyWaterMl(entries, 7, now);
    expect(out[6].ml).toBe(830);
    expect(out[5].ml).toBe(750);
    expect(out.reduce((t, d) => t + d.ml, 0)).toBe(1580);
  });
  it('counts old entries without a size as one 250 ml glass', () => {
    expect(dailyWaterMl([{ id: 1, kind: 'water', at: at(28, 8) }], 1, now)[0].ml).toBe(250);
  });
});
