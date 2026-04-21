import React from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../utils/theme';

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.88}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, color = theme.colors.primary, size = 'md' }) {
  const bg = color + '18';
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.badgeText, { color }, size === 'sm' && styles.badgeTextSm]}>{label}</Text>
    </View>
  );
}

export function StatCard({ label, value, icon, color = theme.colors.primary, onPress }) {
  const bg = color + '12';
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.statCard, theme.shadow.sm]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Wrapper>
  );
}

export function EmptyState({ icon = 'document-text-outline', title, message, subMessage, action, actionLabel }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={44} color={theme.colors.textMuted} />
      </View>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {subMessage ? <Text style={styles.emptySubMessage}>{subMessage}</Text> : null}
      {action ? (
        <TouchableOpacity style={styles.emptyAction} onPress={action}>
          <Text style={styles.emptyActionText}>{actionLabel || 'Try again'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <TouchableOpacity onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

export function InfoRow({ label, value, icon }) {
  return (
    <View style={styles.infoRow}>
      {icon ? <Ionicons name={icon} size={16} color={theme.colors.textMuted} style={styles.infoIcon} /> : null}
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md, ...theme.shadow.sm, marginBottom: theme.spacing.sm,
  },
  badge: { borderRadius: theme.borderRadius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold },
  badgeTextSm: { fontSize: theme.fontSize.xs },
  statCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md, alignItems: 'center', flex: 1, marginHorizontal: 4,
  },
  statIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  statLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary, textAlign: 'center' },
  emptyMessage: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptySubMessage: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyAction: { marginTop: 18, backgroundColor: theme.colors.primary + '15', paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.borderRadius.full },
  emptyActionText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.primary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  sectionAction: { fontSize: theme.fontSize.sm, color: theme.colors.primary, fontWeight: theme.fontWeight.semiBold },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  infoIcon: { marginRight: 8 },
  infoLabel: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  infoValue: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
});
