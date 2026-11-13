import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ListRow } from '@/components/ui/list-row';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { describeWeightConvention, type Equipment } from '@/domain/catalog';
import { useServices } from '@/features/services-provider';
import { ActiveWorkoutBanner } from '@/features/workout/active-workout-banner';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; equipment: Equipment[] };

/** Lists every piece of equipment in the catalog. Tap one to see its exercises. */
export function EquipmentList() {
  const { catalog } = useServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false; // ignore the result if the screen closed while loading
    catalog.listEquipment().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: 'ready', equipment: result.value }
          : { status: 'error', message: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  return (
    <ThemedView style={styles.container}>
      {state.status === 'loading' && <ActivityIndicator style={styles.centered} />}

      {state.status === 'error' && (
        <ThemedText style={styles.centered} themeColor="textSecondary">
          {state.message}
        </ThemedText>
      )}

      {state.status === 'ready' && (
        <FlatList
          style={styles.list}
          data={state.equipment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<ActiveWorkoutBanner />}
          ListEmptyComponent={<ThemedText themeColor="textSecondary">No equipment yet.</ThemedText>}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: '/equipment/[equipmentId]', params: { equipmentId: item.id } }}
              asChild>
              <ListRow title={item.name} subtitle={describeWeightConvention(item)} />
            </Link>
          )}
        />
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
