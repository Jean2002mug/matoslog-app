import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { Spacing } from '@/constants/theme';
import { useServices } from '@/features/services-provider';

import { RestTimerCard } from './rest-timer-card';
import { useRestTimer } from './rest-timer-provider';
import { useActiveWorkout } from './use-active-workout';
import { WorkoutClock } from './workout-clock';

type Pending = 'finish' | 'discard' | null;

/**
 * Shows "Workout in progress" with Finish and Discard while a workout is active.
 * Each action asks for confirmation inline (built into the banner rather than a pop-up,
 * so it behaves the same on iOS, Android and web).
 */
export function ActiveWorkoutBanner() {
  const { workout } = useServices();
  const { state, refresh } = useActiveWorkout();
  const restTimer = useRestTimer();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'error') {
    return (
      <ThemedText themeColor="textSecondary" style={styles.error}>
        {state.message}
      </ThemedText>
    );
  }
  if (state.status !== 'ready' || state.active === null) return null;

  const setCount = state.active.sets.length;

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const result = pending === 'finish' ? await workout.finishWorkout() : await workout.discardWorkout();
    setBusy(false);
    setPending(null);
    if (result.ok) {
      restTimer.skip(); // no resting once the workout is over
    } else {
      setError(result.error);
    }
    await refresh();
  }

  return (
    <ThemedView type="backgroundSelected" style={styles.banner}>
      <ThemedText type="smallBold">
        Workout in progress · {setCount} {setCount === 1 ? 'set' : 'sets'}
      </ThemedText>
      <WorkoutClock type="small" prefix="Time · " startedAt={state.active.workout.startedAt} />

      {/* A rest started on the set logger keeps counting here while you pick the next exercise. */}
      <RestTimerCard />

      {pending === null ? (
        <View style={styles.actions}>
          <AppButton label="Finish" onPress={() => setPending('finish')} />
          <AppButton label="Discard" variant="secondary" onPress={() => setPending('discard')} />
        </View>
      ) : (
        <>
          <ThemedText type="small">
            {pending === 'finish'
              ? 'Finish and save this workout? It can’t be changed afterwards.'
              : 'Discard this workout? All its sets will be deleted.'}
          </ThemedText>
          <View style={styles.actions}>
            <AppButton
              label={pending === 'finish' ? 'Yes, finish' : 'Yes, discard'}
              variant={pending === 'finish' ? 'primary' : 'danger'}
              disabled={busy}
              onPress={confirm}
            />
            <AppButton
              label="Cancel"
              variant="secondary"
              disabled={busy}
              onPress={() => setPending(null)}
            />
          </View>
        </>
      )}

      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  error: {
    marginBottom: Spacing.two,
  },
});
