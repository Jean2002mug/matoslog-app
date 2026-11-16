import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { Spacing } from '@/constants/theme';
import { describeWeightConvention, formatKg } from '@/domain/catalog';
import { formatDuration, formatPaused, plural, type CompletedWorkoutDetail } from '@/domain/history';
import { useServices } from '@/features/services-provider';

import { formatWorkoutDate, formatWorkoutTime } from './format-date';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: CompletedWorkoutDetail };

/** One finished workout, read-only: its sets grouped by exercise. */
export function WorkoutDetail({ workoutId }: { workoutId: string }) {
  const { workout } = useServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    workout.getCompletedWorkout(workoutId).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: 'ready', detail: result.value }
          : { status: 'error', message: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [workout, workoutId]);

  // <Stack.Screen> renders nothing, so the scroll view is still the screen's first child.
  return (
    <>
      {state.status === 'ready' && (
        <Stack.Screen options={{ title: formatWorkoutDate(state.detail.workout.startedAt) }} />
      )}
      <ScreenScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' && <ActivityIndicator />}

        {state.status === 'error' && (
          <ThemedText themeColor="textSecondary">{state.message}</ThemedText>
        )}

        {state.status === 'ready' && <DetailBody detail={state.detail} />}
      </ScreenScrollView>
    </>
  );
}

function DetailBody({ detail }: { detail: CompletedWorkoutDetail }) {
  const { workout: w, groups } = detail;
  const setCount = groups.reduce((total, g) => total + g.sets.length, 0);

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {[
          `Started ${formatWorkoutTime(w.startedAt)}`,
          w.finishedAt ? formatDuration(w.startedAt, w.finishedAt) : null,
          formatPaused(w.pausedMs),
          plural(setCount, 'set'),
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>

      {groups.map(({ exercise, equipment, sets }) => (
        <ThemedView key={exercise.id} type="backgroundElement" style={styles.group}>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {equipment.name} · {describeWeightConvention(equipment)}
          </ThemedText>
          {sets.map((set, index) => (
            <ThemedText key={set.id}>
              Set {index + 1} · {formatKg(set.weightCg)} kg × {set.reps}
            </ThemedText>
          ))}
        </ThemedView>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  group: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
