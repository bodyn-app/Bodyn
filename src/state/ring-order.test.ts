import { describe, expect, it } from 'vitest';

import { normalizeOrder, RING_IDS, swapped, type RingId } from './ring-order';

const isPermutation = (o: RingId[]) => o.length === RING_IDS.length && RING_IDS.every((id) => o.includes(id));

describe('normalizeOrder', () => {
  it('keeps a valid saved order as-is', () => {
    expect(normalizeOrder(['strain', 'recovery', 'sleep'])).toEqual(['strain', 'recovery', 'sleep']);
  });
  it('falls back to the default for junk, and always returns all three rings', () => {
    for (const junk of [null, undefined, 'strain', {}, [], ['nope'], ['sleep', 'sleep', 'sleep']]) {
      const out = normalizeOrder(junk);
      expect(isPermutation(out)).toBe(true);
    }
    expect(normalizeOrder(null)).toEqual(RING_IDS);
  });
  it('appends anything missing, keeping the saved part first', () => {
    expect(normalizeOrder(['strain'])).toEqual(['strain', 'recovery', 'sleep']);
  });
});

describe('swapped', () => {
  it('swaps the two rings and stays a permutation', () => {
    const out = swapped(['recovery', 'sleep', 'strain'], 0, 'strain');
    expect(out).toEqual(['strain', 'sleep', 'recovery']);
    expect(isPermutation(out)).toBe(true);
  });
  it('is a no-op when the ring is already in that position', () => {
    const order: RingId[] = ['recovery', 'sleep', 'strain'];
    expect(swapped(order, 0, 'recovery')).toBe(order);
  });
  it('ignores an out-of-range position', () => {
    const order: RingId[] = ['recovery', 'sleep', 'strain'];
    expect(swapped(order, 5, 'sleep')).toBe(order);
    expect(swapped(order, -1, 'sleep')).toBe(order);
  });
  it('any sequence of swaps leaves every ring present exactly once', () => {
    let order: RingId[] = [...RING_IDS];
    for (const [pos, ring] of [[0, 'strain'], [2, 'recovery'], [1, 'strain'], [0, 'sleep']] as [number, RingId][]) {
      order = swapped(order, pos, ring);
      expect(isPermutation(order)).toBe(true);
    }
  });
});
