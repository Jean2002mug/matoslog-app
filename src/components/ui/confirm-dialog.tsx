import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button, for actions that delete something. */
  destructive?: boolean;
  /** Shows a "Don't ask again" checkbox. */
  offerDontAskAgain?: boolean;
  onConfirm(dontAskAgain: boolean): void;
  onCancel(): void;
}

/**
 * A yes/no question in a small pop-up, optionally with "Don't ask again".
 * Built with React Native's Modal rather than the system alert, because system alerts
 * can't contain a checkbox and don't work on web.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  offerDontAskAgain = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  function close(confirmed: boolean) {
    const choice = dontAskAgain;
    setDontAskAgain(false); // start unticked next time
    if (confirmed) onConfirm(choice);
    else onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)} // Android back button
    >
      <View style={styles.backdrop}>
        <ThemedView style={styles.dialog} accessibilityViewIsModal>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>

          {offerDontAskAgain && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dontAskAgain }}
              onPress={() => setDontAskAgain((v) => !v)}
              style={styles.checkboxRow}
              hitSlop={8}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.text },
                  dontAskAgain && { backgroundColor: theme.text },
                ]}>
                {dontAskAgain && (
                  <ThemedText style={[styles.tick, { color: theme.background }]}>✓</ThemedText>
                )}
              </View>
              <ThemedText type="small">Don’t ask again</ThemedText>
            </Pressable>
          )}

          <View style={styles.actions}>
            <AppButton label="Keep going" variant="secondary" onPress={() => close(false)} />
            <AppButton
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={() => close(true)}
            />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 700,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
