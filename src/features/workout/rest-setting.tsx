import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { Spacing } from '@/constants/theme';
import { formatClock, REST_PRESETS_MS, REST_STEP_MS } from '@/domain/timer';
import { useServices } from '@/features/services-provider';
import type { RestSetting } from '@/services/settings-service';

/**
 * "Rest after each set: 2:30 · Recommended", with Change to customize it for this exercise:
 * quick presets, −15 s / +15 s, and "Use recommended". Saved on the phone.
 */
export function RestSettingRow({ exerciseId }: { exerciseId: string }) {
  const { settings } = useServices();
  const [setting, setSetting] = useState<RestSetting | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    settings.getRestSetting(exerciseId).then((result) => {
      if (!cancelled && result.ok) setSetting(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [settings, exerciseId]);

  if (!setting) return null;

  async function choose(restMs: number | null) {
    setError(null);
    const result = await settings.setCustomRest(exerciseId, restMs);
    if (result.ok) setSetting(result.value);
    else setError(result.error);
  }

  const recommended = setting.customMs === null;

  return (
    <ThemedView type="backgroundElement" style={styles.box}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            Rest after each set
          </ThemedText>
          <ThemedText type="smallBold" accessibilityLabel={`Rest after each set ${formatClock(setting.effectiveMs)}${recommended ? ', recommended' : ''}`}>
            {formatClock(setting.effectiveMs)} · {recommended ? 'Recommended' : 'Custom'}
          </ThemedText>
        </View>
        <AppButton
          label={editing ? 'Done' : 'Change'}
          variant="secondary"
          compact
          accessibilityLabel={editing ? 'Done changing rest' : 'Change rest'}
          onPress={() => setEditing((v) => !v)}
        />
      </View>

      {editing && (
        <>
          <View style={styles.chips}>
            {REST_PRESETS_MS.map((ms) => (
              <AppButton
                key={ms}
                label={
                  ms === setting.recommendedMs ? `${formatClock(ms)} ★` : formatClock(ms)
                }
                variant={ms === setting.effectiveMs ? 'primary' : 'secondary'}
                compact
                accessibilityLabel={`Rest ${formatClock(ms)}${ms === setting.recommendedMs ? ', recommended' : ''}`}
                onPress={() => choose(ms)}
              />
            ))}
          </View>
          <View style={styles.chips}>
            <AppButton
              label="−15 s"
              variant="secondary"
              compact
              accessibilityLabel="Shorter rest"
              onPress={() => choose(setting.effectiveMs - REST_STEP_MS)}
            />
            <AppButton
              label="+15 s"
              variant="secondary"
              compact
              accessibilityLabel="Longer rest"
              onPress={() => choose(setting.effectiveMs + REST_STEP_MS)}
            />
            {!recommended && (
              <AppButton
                label={`Use recommended (${formatClock(setting.recommendedMs)})`}
                variant="secondary"
                compact
                onPress={() => choose(null)}
              />
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            ★ Recommended for this exercise. Applies from your next set.
          </ThemedText>
        </>
      )}
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
