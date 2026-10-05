import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { AppText, Card, fmtNum } from '@/components/ui';
import { importHealthZip, ImportError } from '@/health/import/import-zip';
import type { HealthData } from '@/health/import/parse-core';
import { canStoreHealthData, saveHealthData } from '@/health/storage';
import { makeStyles, radius, space, useTheme } from '@/theme';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; pct: number }
  | { kind: 'done'; data: HealthData }
  | { kind: 'error'; message: string };

/** Opens the system file picker (on iPhone: the Files app) for a single .zip. */
function pickZip(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    // The input must stay in the page while the picker is open: iOS Safari can discard a detached input while
    // the user is in Files, and then the chosen file never arrives (picking "did nothing" until the 3rd or 4th try).
    input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

/** Restarts the app so every screen, cache and the coach pick up the new snapshot from scratch. */
export const reloadApp = () => {
  if (Platform.OS === 'web') window.location.reload();
};

const STEPS = [
  'Open the Health app on your iPhone',
  'Tap your picture (top right) → Export All Health Data',
  'Choose Save to Files → On My iPhone',
  'Come back here and choose that export.zip',
];

/** Import flow for an Apple Health export. Parsing happens on this device and nothing is uploaded. */
export function HealthImport({ showSteps = true }: { showSteps?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  if (Platform.OS !== 'web' || !canStoreHealthData())
    return (
      <Card>
        <AppText muted>Importing an Apple Health export works in the Bodyn web app (Safari, then Add to Home Screen). Private Browsing can’t keep data.</AppText>
      </Card>
    );

  const start = async () => {
    const file = await pickZip();
    if (!file) return;
    setPhase({ kind: 'reading', pct: 0 });
    try {
      const data = await importHealthZip(file, ({ read, total }) => setPhase({ kind: 'reading', pct: Math.round((read / total) * 100) }));
      saveHealthData(data);
      setPhase({ kind: 'done', data });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof ImportError || e instanceof Error ? e.message : 'Something went wrong reading the export.' });
    }
  };

  if (phase.kind === 'done') {
    const { data } = phase;
    const days = Object.keys(data.days).length;
    return (
      <View style={{ gap: space.md }}>
        <Card style={{ gap: space.sm }}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color={colors.good} />
            <AppText variant="h3">Import complete</AppText>
          </View>
          <AppText muted>
            {fmtNum(days)} days ({data.firstDay} → {data.lastDay}) and {fmtNum(data.workouts.length)} workouts, saved on this device only.
          </AppText>
        </Card>
        <Card style={{ gap: space.sm }}>
          <View style={styles.row}>
            <Ionicons name="trash-outline" size={20} color={colors.warn} />
            <AppText variant="h3">Tidy up the export</AppText>
          </View>
          <AppText muted>Bodyn has what it needs. The export.zip in Files still holds your full health history. Delete it if you don’t want to keep a copy (and make sure it isn’t in iCloud Drive).</AppText>
        </Card>
        <Pressable style={styles.button} onPress={reloadApp} accessibilityRole="button">
          <AppText variant="h3" style={{ color: colors.onLime }}>
            Open Bodyn
          </AppText>
        </Pressable>
      </View>
    );
  }

  const reading = phase.kind === 'reading';
  return (
    <View style={{ gap: space.md }}>
      {showSteps ? (
        <Card style={{ gap: space.sm }}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.row}>
              <View style={styles.stepNum}>
                <AppText variant="small" style={{ color: colors.onLime, fontWeight: '700' }}>
                  {i + 1}
                </AppText>
              </View>
              <AppText style={{ flex: 1 }}>{s}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Pressable style={[styles.button, reading && { opacity: 0.6 }]} onPress={start} disabled={reading} accessibilityRole="button">
        {reading ? <ActivityIndicator color={colors.onLime} /> : <Ionicons name="folder-open-outline" size={20} color={colors.onLime} />}
        <AppText variant="h3" style={{ color: colors.onLime }}>
          {reading ? `Reading export… ${phase.pct}%` : 'Choose export.zip'}
        </AppText>
      </Pressable>
      {reading ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${phase.pct}%` }]} />
        </View>
      ) : null}
      {reading ? (
        <AppText variant="small" muted style={{ textAlign: 'center' }}>
          Keep this screen open. A large export can take a minute.
        </AppText>
      ) : null}
      {phase.kind === 'error' ? (
        <Card style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Ionicons name="alert-circle" size={20} color={colors.bad} />
          <AppText style={{ flex: 1 }}>{phase.message}</AppText>
        </Card>
      ) : null}

      <View style={[styles.row, { paddingHorizontal: space.xs }]}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <AppText variant="small" muted style={{ flex: 1 }}>
          Your export is read on this device. Nothing is uploaded, and the data stays in this app on this phone.
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  button: { flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: radius.pill, paddingVertical: space.md + 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.lime },
}));
