import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthImport } from '@/components/health-import';
import { AppText } from '@/components/ui';
import { makeStyles, space, useTheme } from '@/theme';

/** First run: there is no data on this device yet, so the only thing to do is import an Apple Health export. */
export function Welcome() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={styles.logo}>
          <AppText variant="h1" style={{ color: colors.onLime }}>
            B
          </AppText>
        </View>
        <View style={{ gap: space.xs }}>
          <AppText variant="h1" style={{ textAlign: 'center' }}>
            Welcome to Bodyn
          </AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            Bring in your Apple Health data to see your sleep, recovery and strain.
          </AppText>
        </View>
        <HealthImport />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  logo: { alignSelf: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
}));
