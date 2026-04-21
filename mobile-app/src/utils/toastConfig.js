import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

const ToastBase = ({ icon, iconColor, borderColor, title, message }) => (
  <View style={[styles.container, { borderLeftColor: borderColor }]}>
    <Ionicons name={icon} size={22} color={iconColor} style={styles.icon} />
    <View style={styles.text}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  </View>
);

export const toastConfig = {
  success: ({ text1, text2 }) => (
    <ToastBase
      icon="checkmark-circle"
      iconColor={theme.colors.success}
      borderColor={theme.colors.success}
      title={text1}
      message={text2}
    />
  ),
  error: ({ text1, text2 }) => (
    <ToastBase
      icon="close-circle"
      iconColor={theme.colors.error}
      borderColor={theme.colors.error}
      title={text1}
      message={text2}
    />
  ),
  info: ({ text1, text2 }) => (
    <ToastBase
      icon="information-circle"
      iconColor={theme.colors.info}
      borderColor={theme.colors.info}
      title={text1}
      message={text2}
    />
  ),
  warning: ({ text1, text2 }) => (
    <ToastBase
      icon="warning"
      iconColor={theme.colors.warning}
      borderColor={theme.colors.warning}
      title={text1}
      message={text2}
    />
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    ...theme.shadow.md,
  },
  icon: { marginRight: 10 },
  text: { flex: 1 },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
