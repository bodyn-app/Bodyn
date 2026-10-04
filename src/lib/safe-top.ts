import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Space to leave above a header for the status bar / Dynamic Island.
 * Some full-screen presentations report a zero top inset on iOS, which puts buttons under the clock, so fall back to the status bar height.
 */
export function useTopInset(): number {
  const { top } = useSafeAreaInsets();
  return Math.max(top, Platform.OS === 'ios' ? Constants.statusBarHeight ?? 0 : 0);
}
