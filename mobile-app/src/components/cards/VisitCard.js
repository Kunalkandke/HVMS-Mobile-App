import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, getStatusColor } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel } from '../../utils/helpers';
import { Badge } from '../common/UIComponents';

export default function VisitCard({ visit, onPress, showFaculty = false }) {
  const statusColor = getStatusColor(visit.status);
  const isActive = visit.status === 'active';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(visit)}
      activeOpacity={0.88}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.hostelInfo}>
          <Ionicons name="business-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.hostelName} numberOfLines={1}>
            {visit.hostel?.name || 'Unknown Hostel'}
          </Text>
        </View>
        <Badge
          label={isActive ? 'Active' : 'Completed'}
          color={statusColor}
          size="sm"
        />
      </View>

      {/* Active visit pulse indicator */}
      {isActive && (
        <View style={styles.activeBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.activeBannerText}>Visit in progress</Text>
        </View>
      )}

      {/* Faculty info (for admin/warden views) */}
      {showFaculty && visit.faculty && (
        <View style={styles.row}>
          <Ionicons name="person-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>
            {visit.faculty.name}
            {visit.faculty.department ? ` • ${visit.faculty.department}` : ''}
          </Text>
        </View>
      )}

      {/* Purpose */}
      <View style={styles.row}>
        <Ionicons name="clipboard-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.metaText}>{getPurposeLabel(visit.purpose)}</Text>
      </View>

      {/* Check-in time */}
      <View style={styles.row}>
        <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.metaText}>In: {formatDateTime(visit.checkIn)}</Text>
      </View>

      {/* Check-out / duration */}
      {visit.checkOut && (
        <View style={styles.row}>
          <Ionicons name="exit-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>
            Out: {formatDateTime(visit.checkOut)}
            {visit.duration ? ` • ${formatDuration(visit.duration)}` : ''}
          </Text>
        </View>
      )}

      {/* Verified badge */}
      {visit.isVerified && (
        <View style={styles.verifiedRow}>
          <Ionicons name="shield-checkmark" size={13} color={theme.colors.success} />
          <Text style={styles.verifiedText}>Verified by Warden</Text>
        </View>
      )}

      {/* Tap hint */}
      {onPress && (
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap for details</Text>
          <Ionicons name="chevron-forward" size={13} color={theme.colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hostelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  hostelName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginLeft: 6,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successLight,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  activeBannerText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.success,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  verifiedText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: theme.fontWeight.medium,
    marginLeft: 4,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  tapHintText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginRight: 2,
  },
});
