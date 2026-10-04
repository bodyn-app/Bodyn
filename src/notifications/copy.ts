// All notification wording in one place: short, friendly, specific, and never a diagnosis.
import { clockText } from './circadian';

type Text = { title: string; body: string };

export const wording = {
  windDown: (bed: number): Text => ({
    title: 'Wind down soon',
    body: `Bedtime is at ${clockText(bed)}. Dim the lights and put screens away.`,
  }),
  earlyNight: (bed: number, recovery: number | null): Text => ({
    title: 'Early night tonight',
    body:
      recovery != null && recovery < 34
        ? `Recovery is ${recovery}%. Be in bed by ${clockText(bed)}, 30 minutes earlier than usual, to catch up on sleep.`
        : `You are a little behind on sleep this week. Be in bed by ${clockText(bed)}, 30 minutes earlier than usual.`,
  }),
  focus: (start: number, end: number, low: boolean): Text => ({
    title: 'Best focus time',
    body: low
      ? `Recovery is low, so keep it light. Your clearest stretch is ${clockText(start)}–${clockText(end)}.`
      : `Your sharpest window is ${clockText(start)}–${clockText(end)}. Save your hardest work for it.`,
  }),
  dip: (start: number, end: number): Text => ({
    title: 'Afternoon dip ahead',
    body: `Energy usually dips around ${clockText(start)}–${clockText(end)}. A short walk, some water or a 15 minute break beats another coffee.`,
  }),
  activity: (start: number, end: number, low: boolean): Text => ({
    title: low ? 'Gentle movement window' : 'Good time to be active',
    body: low
      ? `An easy walk between ${clockText(start)} and ${clockText(end)} fits today.`
      : `Your energy is up between ${clockText(start)} and ${clockText(end)}: a good time to train.`,
  }),
  caffeine: (cutoff: number): Text => ({
    title: 'Last call for caffeine',
    body: `Have your last coffee or tea before ${clockText(cutoff)} so it doesn't cut into your sleep.`,
  }),
  hydration: (i: number): Text => ({
    title: 'Water break',
    body: [
      'Time for a glass of water. Tap to log it.',
      'Keep sipping: a glass of water now keeps your energy steady.',
      'Water break. How many glasses so far today?',
      'Top up your water, and ease off as bedtime gets close.',
    ][i % 4],
  }),
};
