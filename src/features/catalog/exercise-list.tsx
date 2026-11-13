import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ListRow } from '@/components/ui/list-row';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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

  return (
    <ThemedView style={styles.container}>
      {state.status === 'loading' && <ActivityIndicator style={styles.centered} />}

      {state.status === 'error' && (
        <ThemedText style={styles.centered} themeColor="textSecondary">
          {state.message}
        </ThemedText>
      )}

      {state.status === 'ready' && (
        <>
          <Stack.Screen options={{ title: state.data.equipment.name }} />
          <FlatList
            style={styles.list}
            data={state.data.exercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <ThemedText type="small" themeColor="textSecondary">
                {describeWeightConvention(state.data.equipment)}
              </ThemedText>
            }
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary">No exercises for this equipment.</ThemedText>
            }
            renderItem={({ item }) => (
              <Link
                href={{ pathname: '/exercise/[exerciseId]', params: { exerciseId: item.id } }}
                asChild>
                <ListRow title={item.name} />
              </Link>
            )}
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  listContent: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  centered: {
    marginTop: Spacing.four,
  },
});
