import type { Colors } from '@/theme';

import type { NotifCategory } from './types';

/** the colour each notification category wears in the inbox and settings */
export const categoryColor = (c: Colors, cat: NotifCategory) =>
  cat === 'bedtime' ? c.rem : cat === 'focus' ? c.core : cat === 'energy' ? c.good : cat === 'caffeine' ? c.warn : c.rest;
