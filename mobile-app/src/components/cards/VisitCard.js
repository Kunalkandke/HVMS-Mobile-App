import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, getStatusColor } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel } from '../../utils/helpers';
import { Badge } from '../common/UIComponents';

/**
 * VisitCard — shows a completed/active actual visit with full details.
 * Used in VisitHistoryScreen and FacultyDashboardScreen (Recent Visits).
 *
 * Props:
 *  visit       — visit object from visitService.getMyVisits()
 *  onPress     — called with the visit object when card is tapped
 *  showFaculty — show the faculty name row (for admin/warden views)
 */
export default function VisitCard({ visit, onPress, showFaculty = false }) {
  const statusColor = getStatusColor(visit.status);
  const isActive    = visit.status === 'active';
  const isCompleted = visit.status === 'completed';

  // Resolve the date to display.
  // Prefer checkIn timestamp → else visitDate field → else check_in field
  const visitDateObj = visit.checkIn
    ? new Date(visit.checkIn)
    : visit.check_in
    ? new Date(visit.check_in)
    : visit.visitDate
    ? new Date(visit.visitDate + 'T00:00:00Z')
    : null;

  const visitDateStr = visitDateObj
    ? visitDateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: visit.checkIn || visit.check_in ? undefined : 'UTC',
      })
    : '—';

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive, isCompleted && styles.cardCompleted]}
      onPress={() => onPress && onPress(visit)}
      activeOpacity={0.88}
    >
      {/* Status banner for active visits */}
      {isActive && (
        <View style={styles.activeBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.activeBannerText}>Visit in progress — tap to manage</Text>
        </View>
      )}

      {/* Header row: hostel name + status badge */}
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

      {/* Date of visit */}
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.metaText}>{visitDateStr}</Text>
      </View>

      {/* Purpose */}
      {visit.purpose && (
        <View style={styles.row}>
          <Ionicons name="clipboard-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{getPurposeLabel(visit.purpose)}</Text>
        </View>
      )}

      {/* Check-in time */}
      {(visit.checkIn || visit.check_in) && (
        <View style={styles.row}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>In: {formatDateTime(visit.checkIn || visit.check_in)}</Text>
        </View>
      )}

      {/* Check-out time + duration */}
      {(visit.checkOut || visit.check_out) && (
        <View style={styles.row}>
          <Ionicons name="exit-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>
            Out: {formatDateTime(visit.checkOut || visit.check_out)}
            {visit.duration ? ` · ${formatDuration(visit.duration)}` : ''}
          </Text>
        </View>
      )}

      {/* Purpose detail / remarks preview */}
      {visit.purposeDetail && (
        <View style={styles.row}>
          <Ionicons name="chatbubble-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={2}>{visit.purposeDetail}</Text>
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
          <Text style={styles.tapHintText}>Tap for full details</Text>
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
  cardActive: {
    borderWidth: 1.5,
    borderColor: theme.colors.success + '60',
  },
  cardCompleted: {
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  tapHintText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginRight: 2,
  },
});
