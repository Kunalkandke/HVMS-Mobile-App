import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, StyleSheet, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../utils/theme';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',   // primary | secondary | outline | danger | ghost
  size = 'md',           // sm | md | lg
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
    textStyle,
  ];

  const iconColor =
    variant === 'outline' || variant === 'ghost'
      ? theme.colors.primary
      : variant === 'danger'
      ? '#fff'
      : '#fff';

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={18} color={iconColor} style={styles.iconLeft} />
          )}
          <Text style={labelStyle}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={18} color={iconColor} style={styles.iconRight} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: 6 },
  iconRight: { marginLeft: 6 },

  // Variants
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.secondary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  danger: { backgroundColor: theme.colors.error },
  ghost: { backgroundColor: theme.colors.primaryLight + '15' },

  // Sizes
  size_sm: { paddingVertical: 8, paddingHorizontal: 14 },
  size_md: { paddingVertical: 13, paddingHorizontal: 20 },
  size_lg: { paddingVertical: 16, paddingHorizontal: 28 },

  disabled: { opacity: 0.5 },

  // Labels
  label: { fontWeight: theme.fontWeight.semiBold, letterSpacing: 0.3 },
  label_primary: { color: '#fff' },
  label_secondary: { color: '#fff' },
  label_outline: { color: theme.colors.primary },
  label_danger: { color: '#fff' },
  label_ghost: { color: theme.colors.primary },

  labelSize_sm: { fontSize: theme.fontSize.sm },
  labelSize_md: { fontSize: theme.fontSize.md },
  labelSize_lg: { fontSize: theme.fontSize.lg },
});

export default Button;
