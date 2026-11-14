import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui/list-row';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { formatDuration, plural, type CompletedWorkoutSummary } from '@/domain/history';
import { useServices } from '@/features/services-provider';

import { formatWorkoutDate, formatWorkoutTime } from './format-date';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; workouts: CompletedWorkoutSummary[] };

/** Finished workouts, newest first. Reloads whenever the tab comes into view. */
export function HistoryList() {
  const { workout } = useServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workout.listCompletedWorkouts().then((result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { status: 'ready', workouts: result.value }
            : { status: 'error', message: result.error },
        );
      });
      return () => {
        cancelled = true;
      };
    }, [workout]),
  );

  // The scroll view is the screen's first child — see ScreenScrollView for why.
  return (
    <ScreenScrollView>
      {state.status === 'loading' && <ActivityIndicator />}

      {state.status === 'error' && <ThemedText themeColor="textSecondary">{state.message}</ThemedText>}

      {state.status === 'ready' && state.workouts.length === 0 && (
        <ThemedText themeColor="textSecondary">
          No finished workouts yet. Finish a workout and it will show up here.
        </ThemedText>
      )}

      {state.status === 'ready' &&
        state.workouts.map(({ workout: w, setCount, exerciseCount }) => (
          <Link
            key={w.id}
            href={{ pathname: '/history/[workoutId]', params: { workoutId: w.id } }}
            asChild>
            <ListRow
              title={`${formatWorkoutDate(w.startedAt)} · ${formatWorkoutTime(w.startedAt)}`}
              subtitle={[
                plural(exerciseCount, 'exercise'),
                plural(setCount, 'set'),
                w.finishedAt ? formatDuration(w.startedAt, w.finishedAt) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          </Link>
        ))}
    </ScreenScrollView>
  );
}
