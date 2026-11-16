import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { Spacing } from '@/constants/theme';
import type { Exercise } from '@/domain/catalog';
import type { FlagSetting, Flags } from '@/domain/settings';
import { formatClock } from '@/domain/timer';
import { useServices } from '@/features/services-provider';
import { useTheme } from '@/hooks/use-theme';
import type { RestSetting } from '@/services/settings-service';

interface RestRow {
  equipmentName: string;
  exercise: Exercise;
  setting: RestSetting;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; flags: Flags; rests: RestRow[] };

const FLAG_LABELS: Record<FlagSetting, string> = {
  confirmCancelWorkout: 'Ask before cancelling a workout',
  confirmCancelRest: 'Ask before cancelling a rest',
};

/**
 * Settings: confirmation questions on/off (to undo "Don't ask again"), rest times per exercise,
 * and a short About. Reloads whenever the tab comes into view.
 */
export function SettingsScreen() {
  const { catalog, settings } = useServices();
  const theme = useTheme();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async (): Promise<LoadState> => {
    const flags = await settings.getFlags();
    if (!flags.ok) return { status: 'error', message: flags.error };
    const equipment = await catalog.listEquipment();
    if (!equipment.ok) return { status: 'error', message: equipment.error };

    const rests: RestRow[] = [];
    for (const item of equipment.value) {
      const detail = await catalog.getEquipmentWithExercises(item.id);
      if (!detail.ok) continue;
      for (const exercise of detail.value.exercises) {
        const setting = await settings.getRestSetting(exercise.id);
        if (setting.ok) rests.push({ equipmentName: item.name, exercise, setting: setting.value });
      }
    }
    return { status: 'ready', flags: flags.value, rests };
  }, [catalog, settings]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().then((next) => {
        if (!cancelled) setState(next);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function toggle(key: FlagSetting, value: boolean) {
    await settings.setFlag(key, value);
    setState(await load());
  }

  async function resetToRecommended(exerciseId: string) {
    await settings.setCustomRest(exerciseId, null);
    setState(await load());
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      {state.status === 'loading' && <ActivityIndicator />}
      {state.status === 'error' && <ThemedText themeColor="textSecondary">{state.message}</ThemedText>}

      {state.status === 'ready' && (
        <>
          <Section title="Confirmations">
            {(Object.keys(FLAG_LABELS) as FlagSetting[]).map((key) => (
              <View key={key} style={styles.row}>
                <ThemedText style={styles.flex}>{FLAG_LABELS[key]}</ThemedText>
                <Switch
                  accessibilityLabel={FLAG_LABELS[key]}
                  value={state.flags[key]}
                  onValueChange={(value) => toggle(key, value)}
                  trackColor={{ true: theme.text, false: theme.backgroundSelected }}
                  thumbColor={theme.background}
                />
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Turn these back on if you chose “Don’t ask again”.
            </ThemedText>
          </Section>

          <Section title="Rest times">
            {state.rests.map(({ equipmentName, exercise, setting }) => (
              <View key={exercise.id} style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{exercise.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {equipmentName} · {formatClock(setting.effectiveMs)} ·{' '}
                    {setting.customMs === null ? 'Recommended' : 'Custom'}
                  </ThemedText>
                </View>
                {setting.customMs !== null && (
                  <AppButton
                    label="Use recommended"
                    variant="secondary"
                    compact
                    accessibilityLabel={`Use recommended rest for ${exercise.name}`}
                    onPress={() => resetToRecommended(exercise.id)}
                  />
                )}
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Change an exercise’s rest from its logging screen.
            </ThemedText>
          </Section>

          <Section title="About">
            <ThemedText type="small">MatosLog {version}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Works offline. Your workouts and settings are saved on this phone only.
            </ThemedText>
          </Section>
        </>
      )}
    </ScreenScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {title.toUpperCase()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
});
