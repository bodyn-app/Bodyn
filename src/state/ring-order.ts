import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bodyn.ringOrder';

export type RingId = 'recovery' | 'sleep' | 'strain';
export const RING_IDS: RingId[] = ['recovery', 'sleep', 'strain'];
export const RING_LABEL: Record<RingId, string> = { recovery: 'Recovery', sleep: 'Sleep', strain: 'Strain' };

/**
 * Coerces anything read back from storage into a real permutation of the three rings: unknown or duplicated
 * entries are dropped and anything missing is appended in the default order, so a corrupt or older saved
 * value can never leave a ring off the home screen.
 */
export function normalizeOrder(saved: unknown): RingId[] {
  const list = Array.isArray(saved) ? saved : [];
  const out: RingId[] = [];
  for (const v of list) if (RING_IDS.includes(v as RingId) && !out.includes(v as RingId)) out.push(v as RingId);
  for (const id of RING_IDS) if (!out.includes(id)) out.push(id);
  return out;
}

/** Puts `ring` in `position`, moving whatever was there to the slot `ring` came from — so it stays a permutation. */
export function swapped(order: RingId[], position: number, ring: RingId): RingId[] {
  const from = order.indexOf(ring);
  if (from < 0 || position < 0 || position >= order.length || from === position) return order;
  const next = [...order];
  next[position] = ring;
  next[from] = order[position];
  return next;
}

type State = {
  order: RingId[];
  /** move `ring` into `position`, swapping with whatever is already there */
  swap: (position: number, ring: RingId) => void;
  reset: () => void;
};

export const useRingOrder = create<State>((set, get) => ({
  order: [...RING_IDS],
  swap: (position, ring) => set({ order: swapped(get().order, position, ring) }),
  reset: () => set({ order: [...RING_IDS] }),
}));

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v) useRingOrder.setState({ order: normalizeOrder(JSON.parse(v)) });
  })
  .catch(() => {})
  .finally(() => {
    useRingOrder.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify(s.order)).catch(() => {});
    });
  });
