// Design tokens (dark = from the reference image, light = matching companion) + theme hooks.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';
import { create } from 'zustand';

export const darkColors = {
  bg: '#0B0D0A',
  surface: '#161914',
  surfaceAlt: '#20241D',
  border: '#272C24',
  text: '#FFFFFF',
  textMuted: '#8B9286',
  textDim: '#5B6157',
  /** brand accent for fills, lines, icons */
  lime: '#B8F53D',
  /** brand accent when used as text */
  limeText: '#B8F53D',
  limeDim: '#5E7D1F',
  onLime: '#0B0D0A',
  barIdle: '#3A3F37',
  // resting (basal) calories
  rest: '#4FA3FF',
  // sleep stages
  awake: '#FF8A5B',
  rem: '#9B87FF',
  core: '#4FA3FF',
  deep: '#2E5BFF',
  // score bands
  good: '#3DDC84',
  warn: '#F5C542',
  bad: '#FF5A4F',
};

export type Colors = { [K in keyof typeof darkColors]: string };

export const lightColors: Colors = {
  bg: '#F3F5EF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8ECE1',
  border: '#DDE2D6',
  text: '#10140D',
  textMuted: '#5B6454',
  textDim: '#98A08F',
  lime: '#86C400',
  limeText: '#4A7D00',
  limeDim: '#C5E28C',
  onLime: '#10140D',
  barIdle: '#D4DACB',
  rest: '#2B8CE8',
  awake: '#F2733A',
  rem: '#7C67F0',
  core: '#2B8CE8',
  deep: '#2447D9',
  good: '#17A34A',
  warn: '#D69200',
  bad: '#E5483D',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const font = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  tiny: { fontSize: 10, fontWeight: '500' as const },
  big: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -1 },
};

// ---------- appearance setting (light / dark / system), remembered between launches ----------
export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'bodyn.appearance';

export const useThemeMode = create<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>((set) => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },
}));

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v === 'light' || v === 'dark' || v === 'system') useThemeMode.setState({ mode: v });
  })
  .catch(() => {});

/** Current palette. "system" follows the phone's appearance. */
export function useTheme() {
  const mode = useThemeMode((s) => s.mode);
  const system = useColorScheme();
  const scheme: 'light' | 'dark' = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  return { colors: scheme === 'dark' ? darkColors : lightColors, scheme, mode };
}

type Style = ViewStyle | TextStyle | ImageStyle;
/** Like StyleSheet.create, but the styles are rebuilt when the theme changes. Usage: const useStyles = makeStyles((c) => ({...})); */
export function makeStyles<T extends Record<string, Style>>(factory: (c: Colors) => T) {
  return function useStyles() {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
