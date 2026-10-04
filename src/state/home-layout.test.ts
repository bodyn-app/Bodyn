import { describe, expect, it } from 'vitest';

import { isHalf, moved, normalizeLayout, packRows, visibleWidgets, WIDGET_IDS, type WidgetId } from './home-layout';

describe('normalizeLayout', () => {
  it('keeps a valid saved layout', () => {
    const { order, hidden } = normalizeLayout(['trends', 'guidance', 'stress', 'summary', 'calories', 'heartRate'], ['stress']);
    expect(order[0]).toBe('trends');
    expect(hidden).toEqual(['stress']);
  });
  it('always returns every widget exactly once, whatever was saved', () => {
    for (const junk of [null, undefined, 'trends', {}, [], ['nope'], ['trends', 'trends']]) {
      const { order } = normalizeLayout(junk, null);
      expect([...order].sort()).toEqual([...WIDGET_IDS].sort());
    }
  });
  it('appends widgets added since the layout was saved, keeping the saved order first', () => {
    const { order } = normalizeLayout(['heartRate', 'trends'], null);
    expect(order.slice(0, 2)).toEqual(['heartRate', 'trends']);
    expect([...order].sort()).toEqual([...WIDGET_IDS].sort());
  });
  it('drops unknown or duplicated hidden ids', () => {
    expect(normalizeLayout(null, ['stress', 'stress', 'bogus']).hidden).toEqual(['stress']);
  });
  it('never lets the fixed date strip or score rings into the layout', () => {
    const { order } = normalizeLayout(['dayStrip', 'rings', 'guidance'], ['dayStrip', 'rings']);
    expect(order).not.toContain('dayStrip');
    expect(order).not.toContain('rings');
    expect(normalizeLayout(null, ['dayStrip', 'rings']).hidden).toEqual([]);
  });
});

describe('visibleWidgets', () => {
  it('leaves out anything hidden, keeping order', () => {
    expect(visibleWidgets(['guidance', 'stress', 'trends'], ['stress'])).toEqual(['guidance', 'trends']);
  });
  it('can be empty when everything is hidden', () => {
    expect(visibleWidgets([...WIDGET_IDS], [...WIDGET_IDS])).toEqual([]);
  });
});

describe('packRows', () => {
  it('pairs the two half-width tiles into one row, full-width widgets take their own', () => {
    expect(packRows(['guidance', 'stress', 'calories', 'heartRate'])).toEqual([['guidance'], ['stress'], ['calories', 'heartRate']]);
  });
  it('leaves a half-width tile alone in its row when its partner is hidden', () => {
    expect(packRows(['guidance', 'calories'])).toEqual([['guidance'], ['calories']]);
  });
  it('does not pair half-width tiles that are not next to each other', () => {
    expect(packRows(['calories', 'trends', 'heartRate'])).toEqual([['calories'], ['trends'], ['heartRate']]);
  });
  it('pairs them in whichever order the user put them', () => {
    expect(packRows(['heartRate', 'calories'])).toEqual([['heartRate', 'calories']]);
  });
  it('never drops or duplicates a widget, and never puts more than two in a row', () => {
    const rows = packRows([...WIDGET_IDS]);
    expect(rows.flat().sort()).toEqual([...WIDGET_IDS].sort());
    expect(rows.every((r) => r.length <= 2)).toBe(true);
  });
  it('knows which widgets are half-width', () => {
    expect(isHalf('calories')).toBe(true);
    expect(isHalf('guidance')).toBe(false);
  });
});

describe('moved', () => {
  it('moves an item down and up, keeping every other item', () => {
    const list: WidgetId[] = ['guidance', 'stress', 'summary', 'trends'];
    expect(moved(list, 0, 2)).toEqual(['stress', 'summary', 'guidance', 'trends']);
    expect(moved(list, 3, 0)).toEqual(['trends', 'guidance', 'stress', 'summary']);
  });
  it('is a no-op for the same or an out-of-range index', () => {
    const list: WidgetId[] = ['guidance', 'stress'];
    expect(moved(list, 1, 1)).toBe(list);
    expect(moved(list, 0, 9)).toBe(list);
    expect(moved(list, -1, 0)).toBe(list);
  });
  it('never loses or duplicates an item', () => {
    let list: WidgetId[] = [...WIDGET_IDS];
    for (const [from, to] of [[0, 5], [3, 1], [5, 0], [2, 4]]) {
      list = moved(list, from, to);
      expect([...list].sort()).toEqual([...WIDGET_IDS].sort());
    }
  });
});
