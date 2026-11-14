import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui/list-row';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { describeWeightConvention, type EquipmentWithExercises } from '@/domain/catalog';
import { useServices } from '@/features/services-provider';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: EquipmentWithExercises };

/** Shows the exercises for one piece of equipment. Tap one to log sets. */
export function ExerciseList({ equipmentId }: { equipmentId: string }) {
  const { catalog } = useServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    catalog.getEquipmentWithExercises(equipmentId).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: 'ready', data: result.value }
          : { status: 'error', message: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, equipmentId]);

  // <Stack.Screen> renders nothing, so the scroll view is still the screen's first child.
  return (
    <>
      {state.status === 'ready' && <Stack.Screen options={{ title: state.data.equipment.name }} />}
      <ScreenScrollView>
        {state.status === 'loading' && <ActivityIndicator />}

        {state.status === 'error' && (
          <ThemedText themeColor="textSecondary">{state.message}</ThemedText>
        )}

        {state.status === 'ready' && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {describeWeightConvention(state.data.equipment)}
            </ThemedText>
            {state.data.exercises.length === 0 && (
              <ThemedText themeColor="textSecondary">No exercises for this equipment.</ThemedText>
            )}
            {state.data.exercises.map((item) => (
              <Link
                key={item.id}
                href={{ pathname: '/exercise/[exerciseId]', params: { exerciseId: item.id } }}
                asChild>
                <ListRow title={item.name} />
              </Link>
            ))}
          </>
        )}
      </ScreenScrollView>
    </>
  );
}
