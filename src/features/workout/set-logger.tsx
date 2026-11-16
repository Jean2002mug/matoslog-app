import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { Spacing } from '@/constants/theme';
import { describeWeightConvention, formatKg, type ExerciseWithEquipment } from '@/domain/catalog';
import { useServices } from '@/features/services-provider';
import { useTheme } from '@/hooks/use-theme';

import { useActiveWorkout } from './active-workout-provider';
import { RestSettingRow } from './rest-setting';
import { RestTimerCard } from './rest-timer-card';
import { WorkoutTimerCard } from './workout-timer-card';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ExerciseWithEquipment };

/**
 * Log sets for one exercise: type weight and reps, tap "Add set".
 * The first set starts a workout; every set starts the rest timer. The form is pre-filled
 * with the last weight and reps logged for this exercise.
 */
export function SetLogger({ exerciseId }: { exerciseId: string }) {
  const { catalog, workout } = useServices();
  const theme = useTheme();
  const { state: activeState, run } = useActiveWorkout();

  const [exerciseState, setExerciseState] = useState<LoadState>({ status: 'loading' });
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalog.getExerciseWithEquipment(exerciseId).then((result) => {
      if (cancelled) return;
      setExerciseState(
        result.ok
          ? { status: 'ready', data: result.value }
          : { status: 'error', message: result.error },
      );
    });
    // Pre-fill with what was logged last time for this exercise (only if still empty).
    workout.getLastSet(exerciseId).then((result) => {
      if (cancelled || !result.ok || !result.value) return;
      const last = result.value;
      setWeightText((text) => text || formatKg(last.weightCg));
      setRepsText((text) => text || String(last.reps));
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, workout, exerciseId]);

  async function handleAddSet() {
    setBusy(true);
    setError(null);
    const result = await run(() => workout.addSet({ exerciseId, weightText, repsText }));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Close the keypad so the rest timer and the new set are visible. Weight and reps stay
    // filled in, because the next set is often the same.
    Keyboard.dismiss();
  }

  async function handleDeleteSet(setId: string) {
    setBusy(true);
    setError(null);
    const result = await run(() => workout.deleteSet(setId));
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  const active = activeState.status === 'ready' ? activeState.active : null;
  const sets = active ? active.sets.filter((s) => s.exerciseId === exerciseId) : [];

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  // <Stack.Screen> renders nothing, so the scroll view is still the screen's first child.
  return (
    <>
      {exerciseState.status === 'ready' && (
        <Stack.Screen options={{ title: exerciseState.data.exercise.name }} />
      )}
      <ScreenScrollView contentContainerStyle={styles.content}>
        {exerciseState.status === 'loading' && <ActivityIndicator />}

        {exerciseState.status === 'error' && (
          <ThemedText themeColor="textSecondary">{exerciseState.message}</ThemedText>
        )}

        {exerciseState.status === 'ready' && (
          <>
            <WorkoutTimerCard compact onError={setError} />

            <ThemedText type="small" themeColor="textSecondary">
              {describeWeightConvention(exerciseState.data.equipment)}
            </ThemedText>

            <View style={styles.fields}>
              <View style={styles.field}>
                <ThemedText type="smallBold">Weight (kg)</ThemedText>
                <TextInput
                  accessibilityLabel="Weight in kg"
                  style={inputStyle}
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 22.5"
                  placeholderTextColor={theme.textSecondary}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold">Reps</ThemedText>
                <TextInput
                  accessibilityLabel="Reps"
                  style={inputStyle}
                  value={repsText}
                  onChangeText={setRepsText}
                  keyboardType="number-pad"
                  placeholder="e.g. 8"
                  placeholderTextColor={theme.textSecondary}
                  selectTextOnFocus
                />
              </View>
            </View>

            <AppButton label="Add set" disabled={busy} onPress={handleAddSet} />

            {error ? (
              <ThemedText type="small" accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}

            <RestTimerCard onError={setError} />
            <RestSettingRow exerciseId={exerciseId} />

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              This workout
            </ThemedText>
            {sets.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No sets yet for this exercise.
              </ThemedText>
            ) : (
              sets.map((set, index) => (
                <ThemedView key={set.id} type="backgroundElement" style={styles.setRow}>
                  <ThemedText style={styles.setText}>
                    Set {index + 1} · {formatKg(set.weightCg)} kg × {set.reps}
                  </ThemedText>
                  <AppButton
                    label="Delete"
                    variant="secondary"
                    compact
                    disabled={busy}
                    accessibilityLabel={`Delete set ${index + 1}`}
                    onPress={() => handleDeleteSet(set.id)}
                  />
                </ThemedView>
              ))
            )}
          </>
        )}
      </ScreenScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  fields: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  input: {
    fontSize: 18,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  error: {
    color: '#D93025',
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  setText: {
    flex: 1,
  },
});
