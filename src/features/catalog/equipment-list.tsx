import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { SqliteCatalogRepository } from '@/data/sqlite-catalog-repository';
import { describeWeightConvention, type Equipment } from '@/domain/catalog';
import { CatalogService } from '@/services/catalog-service';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; equipment: Equipment[] };

/** Lists every piece of equipment in the catalog, straight from the database. */
export function EquipmentList() {
  const db = useSQLiteContext();
  const service = useMemo(() => new CatalogService(new SqliteCatalogRepository(db)), [db]);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false; // ignore the result if the screen closed while loading
    service.listEquipment().then((result) => {
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
  }, [service]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Equipment</ThemedText>

        {state.status === 'loading' && <ActivityIndicator style={styles.centered} />}

        {state.status === 'error' && (
          <ThemedText style={styles.centered} themeColor="textSecondary">
            {state.message}
          </ThemedText>
        )}

        {state.status === 'ready' && (
          <FlatList
            data={state.equipment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary">No equipment yet.</ThemedText>
            }
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeWeightConvention(item)}
                </ThemedText>
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  centered: {
    marginTop: Spacing.four,
    alignSelf: 'center',
  },
});
