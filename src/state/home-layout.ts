import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bodyn.homeLayout';

export type WidgetId = 'guidance' | 'stress' | 'summary' | 'trends' | 'calories' | 'heartRate';
/** every widget, in the order the home page shipped with */
export const WIDGET_IDS: WidgetId[] = ['guidance', 'stress', 'summary', 'trends', 'calories', 'heartRate'];

/**
 * Coerces whatever came back from storage into a usable layout: unknown and duplicated ids are dropped, any
 * widget added to the app since the layout was saved is appended, and `hidden` can only contain real ids.
 * A saved layout from an older build therefore can never blank out the home page.
 */
export function normalizeLayout(savedOrder: unknown, savedHidden: unknown): { order: WidgetId[]; hidden: WidgetId[] } {
  const known = (v: unknown): v is WidgetId => typeof v === 'string' && (WIDGET_IDS as string[]).includes(v);
  const order: WidgetId[] = [];
  for (const v of Array.isArray(savedOrder) ? savedOrder : []) if (known(v) && !order.includes(v)) order.push(v);
  for (const id of WIDGET_IDS) if (!order.includes(id)) order.push(id);
  const hidden: WidgetId[] = [];
  for (const v of Array.isArray(savedHidden) ? savedHidden : []) if (known(v) && !hidden.includes(v)) hidden.push(v);
  return { order, hidden };
}

/** The widgets actually drawn on the home page, in order. */
export const visibleWidgets = (order: WidgetId[], hidden: WidgetId[]) => order.filter((id) => !hidden.includes(id));

/** Widgets that render as a half-width tile, pairing up two to a row (the calories / heart-rate tiles). */
const HALF: WidgetId[] = ['calories', 'heartRate'];
export const isHalf = (id: WidgetId) => HALF.includes(id);

/**
 * Groups visible widgets into rows: two consecutive half-width widgets share a row (as the calories and
 * heart-rate tiles look today), anything else takes a row of its own. A half-width widget left on its own —
 * because its partner was hidden or moved away — simply fills the row.
 */
export function packRows(ids: WidgetId[]): WidgetId[][] {
  const rows: WidgetId[][] = [];
  for (const id of ids) {
    const last = rows[rows.length - 1];
    if (isHalf(id) && last && last.length === 1 && isHalf(last[0])) last.push(id);
    else rows.push([id]);
  }
  return rows;
}

/** Moves the item at `from` to `to`, keeping every other item's relative order. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

type State = {
  order: WidgetId[];
  hidden: WidgetId[];
  setOrder: (order: WidgetId[]) => void;
  /** move a widget by index within the full order */
  move: (from: number, to: number) => void;
  hide: (id: WidgetId) => void;
  show: (id: WidgetId) => void;
  reset: () => void;
};

export const useHomeLayout = create<State>((set, get) => ({
  order: [...WIDGET_IDS],
  hidden: [],
  setOrder: (order) => set({ order }),
  move: (from, to) => set({ order: moved(get().order, from, to) }),
  hide: (id) => set({ hidden: get().hidden.includes(id) ? get().hidden : [...get().hidden, id] }),
  show: (id) => set({ hidden: get().hidden.filter((h) => h !== id) }),
  reset: () => set({ order: [...WIDGET_IDS], hidden: [] }),
}));

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!v) return;
    const saved = JSON.parse(v) as { order?: unknown; hidden?: unknown };
    useHomeLayout.setState(normalizeLayout(saved.order, saved.hidden));
  })
  .catch(() => {})
  .finally(() => {
    useHomeLayout.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ order: s.order, hidden: s.hidden })).catch(() => {});
    });
  });
