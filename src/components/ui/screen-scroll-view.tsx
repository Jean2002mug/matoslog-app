import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The scrollable body of a screen inside the native tabs + Stack.
 *
 * It MUST be the first real child of the screen (a <Stack.Screen> before it is fine,
 * because it renders nothing). Expo's native-tabs docs:
 * - iOS only adjusts the content insets of the FIRST ScrollView in a screen. Without that,
 *   content slides under the header and the tab bar, and the top rows can't be reached.
 * - Tap-the-tab-to-scroll-to-top only works when the ScrollView is the first child.
 *   (FlatList doesn't support scroll-to-top in native tabs at all, so lists use this instead.)
 */
export function ScreenScrollView({ contentContainerStyle, style, ...props }: ScrollViewProps) {
  const theme = useTheme();
  return (
    <ScrollView
      // Push content below the header and above the tab bar (iOS).
      contentInsetAdjustmentBehavior="automatic"
      // Scroll focused text fields above the keyboard (iOS).
      automaticallyAdjustKeyboardInsets
      // Let buttons respond to the first tap while the keyboard is open.
      keyboardShouldPersistTaps="handled"
      // The decimal and number keypads have no "Done" key; dragging the list dismisses them.
      keyboardDismissMode="on-drag"
      style={[styles.scroll, { backgroundColor: theme.background }, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
});
