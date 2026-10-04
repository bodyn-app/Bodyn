import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FitnessAgeCard } from '@/components/fitness-card';
import { AppText, Card, fmtNum, SectionHeader } from '@/components/ui';
import { health, healthImportedAt } from '@/health';
import { convertWeight, weightLabel } from '@/lib/units';
import { useUnitsPrefs } from '@/state/units-prefs';
import { useUserName } from '@/state/user-name';
import { font, makeStyles, space, useTheme } from '@/theme';

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnitsPrefs();
  const { name, setName } = useUserName();
  const p = health.getProfile();
  const rows: [string, string][] = [
    ['Age', p.age ? `${p.age} y` : '–'],
    ['Height', p.heightCm ? `${fmtNum(p.heightCm)} cm` : '–'],
    ['Weight', p.weightKg ? `${fmtNum(convertWeight(p.weightKg, units.weight), 1)} ${weightLabel(units.weight)}` : '–'],
    ['Body fat', p.bodyFatPct ? `${fmtNum(p.bodyFatPct, 1)} %` : '–'],
  ];
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          {name.trim() ? (
            <AppText variant="h1" style={{ color: colors.onLime }}>
              {name.trim()[0].toUpperCase()}
            </AppText>
          ) : (
            <Ionicons name="person" size={36} color={colors.onLime} />
          )}
        </View>
        {/* kept on this device only; tap to edit */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Add your name"
          placeholderTextColor={colors.textMuted}
          maxLength={40}
          autoCapitalize="words"
          autoComplete="off"
          accessibilityLabel="Your name"
          style={[font.h2, styles.name, { color: colors.text }]}
        />
        <AppText variant="small" muted style={{ textAlign: 'center', marginBottom: space.md }}>
          Data {health.firstDay} → {health.lastDay}
        </AppText>

        <FitnessAgeCard />

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md }} onPress={() => router.push('/profile/preferences')}>
          <Ionicons name="options" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Preferences</AppText>
            <AppText variant="small" muted>
              Appearance, units, health defaults
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md }} onPress={() => router.push('/health-data')}>
          <Ionicons name="cloud-download-outline" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Health data</AppText>
            <AppText variant="small" muted>
              {healthImportedAt ? `Imported ${new Date(healthImportedAt).toLocaleDateString()} · ` : ''}Re-import, delete
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>

        <SectionHeader title="Body" />
        <Card style={{ gap: space.md }}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <AppText muted>{k}</AppText>
              <AppText variant="h3">{v}</AppText>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  avatar: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { textAlign: 'center', marginTop: space.md, paddingVertical: space.xs, alignSelf: 'center', minWidth: 200 },
}));
