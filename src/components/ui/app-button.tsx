import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'danger';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  /** Smaller padding, for buttons inside list rows. */
  compact?: boolean;
};

const DANGER = '#D93025';

/** A simple themed button used across the app. */
export function AppButton({
  label,
  variant = 'primary',
  compact = false,
  disabled,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const colors = {
    primary: { background: theme.text, text: theme.background },
    secondary: { background: theme.backgroundSelected, text: theme.text },
    danger: { background: DANGER, text: '#ffffff' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: colors.background },
        (pressed || disabled) && styles.dimmed,
      ]}
      {...props}>
      <Text style={[styles.label, compact && styles.compactLabel, { color: colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  label: {
    fontSize: 16,
    fontWeight: 600,
  },
  compactLabel: {
    fontSize: 14,
  },
  dimmed: {
    opacity: 0.5,
  },
});
