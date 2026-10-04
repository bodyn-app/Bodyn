import type { Ionicons } from '@expo/vector-icons';
import type { ComponentType } from 'react';

import type { WidgetId } from '@/state/home-layout';

import { CaloriesCard } from './calories-card';
import { GuidanceCard } from './guidance-card';
import { HeartRateCard } from './heart-rate-card';
import { StressCard } from './stress-card';
import { SummaryActivityCard } from './summary-activity-card';
import { WeeklyTrendsCard } from './weekly-trends-card';

type WidgetDef = {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  Component: ComponentType<{ date: string }>;
};

/**
 * Everything the home page can show, in its default order. The date strip and the score rings are deliberately
 * NOT in here — they are rendered directly by the home screen, which is what guarantees they can never be
 * reordered or hidden, whatever ends up in the saved layout.
 */
export const WIDGETS: Record<WidgetId, WidgetDef> = {
  guidance: { label: "Coach's call", hint: 'Your daily guidance and actions', icon: 'sparkles', Component: GuidanceCard },
  stress: { label: 'Stress', hint: "Today's stress level through the day", icon: 'pulse', Component: StressCard },
  summary: { label: 'Summary Activity', hint: 'Activity, sleep and workouts for the day', icon: 'footsteps', Component: SummaryActivityCard },
  trends: { label: 'Weekly Trends', hint: 'Last 7 days for the metric you pick', icon: 'bar-chart', Component: WeeklyTrendsCard },
  calories: { label: 'Calories', hint: 'Active and rest calories', icon: 'flame', Component: CaloriesCard },
  heartRate: { label: 'Heart rate', hint: 'Average and resting heart rate', icon: 'heart-outline', Component: HeartRateCard },
};
