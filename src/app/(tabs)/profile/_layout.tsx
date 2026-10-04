import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/**
 * The Account tab has its own stack, so drilling into Preferences and then switching tabs keeps your place —
 * come back to Account and you are still where you left off, instead of being sent to the top.
 */
export default function ProfileLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
