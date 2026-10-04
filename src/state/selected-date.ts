import { create } from 'zustand';

import { health } from '@/health';

/** The day being viewed. Shared by Home, Activity and Sleep so switching tabs keeps the same date. */
export const useSelectedDate = create<{ date: string; setDate: (d: string) => void }>((set) => ({
  date: health.lastDay,
  setDate: (date) => set({ date }),
}));

