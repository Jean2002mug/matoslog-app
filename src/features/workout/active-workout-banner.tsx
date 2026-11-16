import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';

import { useActiveWorkout } from './active-workout-provider';
import { RestTimerCard } from './rest-timer-card';
import { WorkoutTimerCard } from './workout-timer-card';

/**
 * Top of the Equipment tab. During a workout: the workout timer (Pause, Finish, Cancel) and
 * any running rest, so the rest keeps counting while you pick the next exercise.
 * Otherwise: a one-line hint on how to start.
 */
export function ActiveWorkoutBanner() {
  const { state } = useActiveWorkout();
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'error') {
    return <ThemedText themeColor="textSecondary">{state.message}</ThemedText>;
  }
  if (state.status === 'loading') return null;

  if (state.active === null) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Pick the equipment in front of you, then an exercise. Your first set starts the workout.
      </ThemedText>
    );
  }

  return (
    <>
      <WorkoutTimerCard onError={setError} />
      <RestTimerCard onError={setError} />
      {error ? (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </>
  );
}
