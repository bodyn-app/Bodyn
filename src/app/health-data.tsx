import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, View } from 'react-native';

import { HealthImport, reloadApp } from '@/components/health-import';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { hasHealthData, health, healthImportedAt } from '@/health';
import { clearAllLocalData } from '@/health/storage';
import { space, useTheme } from '@/theme';

const CONFIRM = 'Delete all Bodyn data from this device? This removes your imported health data, preferences, chats and logs. It can’t be undone.';

/** Where the imported data lives: when it was imported, re-import a fresh export, or wipe everything. */
export default function HealthData() {
  const { colors } = useTheme();

  const wipe = async () => {
    await clearAllLocalData();
    reloadApp();
  };
  const confirmWipe = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(CONFIRM)) void wipe();
    } else Alert.alert('Delete all data', CONFIRM, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void wipe() }]);
  };

  return (
    <DetailScreen title="Health data">
      {hasHealthData ? (
        <Card style={{ gap: space.xs }}>
          <AppText variant="h3">On this device</AppText>
          <AppText muted>
            {health.firstDay} → {health.lastDay}
            {healthImportedAt ? ` · imported ${new Date(healthImportedAt).toLocaleDateString()}` : ''}
          </AppText>
        </Card>
      ) : null}

      <SectionHeader title={hasHealthData ? 'Import a newer export' : 'Import your data'} />
      <HealthImport />

      <SectionHeader title="Privacy" />
      <Card style={{ gap: space.sm }}>
        <AppText muted>
          Everything Bodyn knows about you is stored in this home-screen app on this phone. Removing the app from your home screen or clearing Safari website data erases it, and you can import again any time.
        </AppText>
        <Card onPress={confirmWipe} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surfaceAlt }}>
          <Ionicons name="trash-outline" size={20} color={colors.bad} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3" style={{ color: colors.bad }}>
              Delete all data
            </AppText>
            <AppText variant="small" muted>
              Health data, preferences, chats and logs
            </AppText>
          </View>
        </Card>
      </Card>
    </DetailScreen>
  );
}
