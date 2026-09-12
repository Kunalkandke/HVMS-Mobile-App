import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { visitService } from '../../services/visitService';
import { reportService } from '../../services/reportService';
import { scheduleService } from '../../services/scheduleService';
import { StatCard, SectionHeader, EmptyState } from '../../components/common/UIComponents';
import VisitCard from '../../components/cards/VisitCard';
import { theme } from '../../utils/theme';
import { formatDate, getInitials } from '../../utils/helpers';

export default function FacultyDashboardScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  const [activeVisit, setActiveVisit] = useState(null);
  const [recentVisits, setRecentVisits] = useState([]);
  const [stats, setStats] = useState({ todayCount: 0, monthCount: 0, totalVisits: 0 });
  const [scheduledVisits, setScheduledVisits] = useState([]);  // upcoming from Excel import
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [myVisitsRes, dashRes, scheduleRes] = await Promise.all([
        visitService.getMyVisits({ limit: 5 }),
        reportService.getDashboardStats(),
        scheduleService.getMySchedule({ limit: 5 }).catch(() => ({ success: false })),
      ]);

      if (myVisitsRes.success) {
        const visits = myVisitsRes.data.visits || [];
        const active = visits.find((v) => v.status === 'active');
        setActiveVisit(active || null);
        setRecentVisits(visits.filter((v) => v.status === 'completed').slice(0, 3));
        setStats((s) => ({ ...s, totalVisits: myVisitsRes.data.pagination?.total || 0 }));
      }
      if (dashRes.success) {
        setStats((s) => ({
          ...s,
          todayCount: dashRes.data.todayCount,
          monthCount: dashRes.data.monthCount,
        }));
      }
      if (scheduleRes.success) {
        // Show only upcoming + today visits (next 3)
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = (scheduleRes.data.visits || [])
          .filter(v => v.visitDate >= today && v.status === 'scheduled')
          .slice(0, 3);
        setScheduledVisits(upcoming);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const today = formatDate(new Date(), 'EEEE, dd MMM yyyy');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        style={[styles.header, { paddingTop: 16 }]}
      >
        <View style={styles.headerTop}>
          <View style={styles.greetBlock}>
            <Text style={styles.greeting}>Good {getGreeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Visit Banner */}
        {activeVisit && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => navigation.navigate('EndVisit', { visit: activeVisit })}
          >
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeBannerTitle}>Active Visit in Progress</Text>
              <Text style={styles.activeBannerSub}>
                {activeVisit.hostel?.name} • Tap to end
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Today's Visits" value={stats.todayCount} icon="today-outline" color={theme.colors.secondary} />
          <StatCard label="This Month" value={stats.monthCount} icon="calendar-outline" color={theme.colors.success} />
          <StatCard label="Total" value={stats.totalVisits} icon="list-outline" color={theme.colors.warning} />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="play-circle"
              label="Start Visit"
              color={theme.colors.success}
              onPress={() => navigation.navigate('StartVisit')}
              disabled={!!activeVisit}
              disabledHint={activeVisit ? 'End current visit first' : undefined}
            />
            <ActionButton
              icon="stop-circle"
              label="End Visit"
              color={theme.colors.error}
              onPress={() => activeVisit && navigation.navigate('EndVisit', { visit: activeVisit })}
              disabled={!activeVisit}
              disabledHint={!activeVisit ? 'No active visit' : undefined}
            />
            <ActionButton
              icon="time"
              label="History"
              color={theme.colors.primary}
              onPress={() => navigation.navigate('Visits')}
            />
            <ActionButton
              icon="person"
              label="Profile"
              color={theme.colors.secondary}
              onPress={() => navigation.navigate('Profile')}
            />
          </View>
        </View>

        {/* My Assigned Schedule */}
        <View style={styles.section}>
          <SectionHeader
            title="My Hostel Visits"
            action="View All"
            onAction={() => navigation.navigate('FacultySchedule')}
          />
          {scheduledVisits.length === 0 ? (
            <View style={styles.scheduleEmpty}>
              <Ionicons name="calendar-outline" size={32} color={theme.colors.textMuted} />
              <Text style={styles.scheduleEmptyTxt}>No upcoming assigned visits</Text>
            </View>
          ) : (
            scheduledVisits.map((sv, i) => {
              const today = new Date().toISOString().slice(0, 10);
              const isToday = sv.visitDate === today;
              const roundColors = {
                'Round-I':'#1565c0','Round-II':'#2e7d32','Round-III':'#e65100','Round-IV':'#6a1b9a',
              };
              const rc = roundColors[sv.round] || theme.colors.primary;
              return (
                <TouchableOpacity
                  key={sv.id || i}
                  style={[styles.scheduleCard, isToday && styles.scheduleCardToday]}
                  onPress={() => navigation.navigate('FacultySchedule')}
                  activeOpacity={0.82}
                >
                  {isToday && (
                    <View style={styles.todayTag}>
                      <Text style={styles.todayTagTxt}>TODAY</Text>
                    </View>
                  )}
                  <View style={styles.scheduleCardRow}>
                    <View style={styles.scheduleDateCol}>
                      <Text style={styles.scheduleDateNum}>{sv.visitDate?.slice(8, 10) || '—'}</Text>
                      <Text style={styles.scheduleDateMon}>
                        {sv.visitDate
                          ? new Date(sv.visitDate + 'T00:00:00Z')
                              .toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.scheduleCardBody}>
                      <View style={[styles.scheduleRoundPill, { backgroundColor: rc + '15', borderColor: rc + '40' }]}>
                        <Text style={[styles.scheduleRoundTxt, { color: rc }]}>{sv.round}</Text>
                      </View>
                      <Text style={styles.scheduleHostel} numberOfLines={1}>
                        {sv.hostel?.name || sv.hostelType || '—'}
                      </Text>
                      <Text style={styles.scheduleDow}>{sv.dayOfWeek || ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Recent Visits */}
        <View style={styles.section}>
          <SectionHeader
            title="Recent Visits"
            action="View All"
            onAction={() => navigation.navigate('Visits')}
          />
          {recentVisits.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No recent visits"
              message="Start a visit to see your history here."
            />
          ) : (
            recentVisits.map((v) => (
              <VisitCard
                key={v._id || v.id}
                visit={v}
                onPress={() => navigation.navigate('VisitDetail', { visitId: v._id || v.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, color, onPress, disabled, disabledHint }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + (disabled ? '20' : '18') }]}>
        <Ionicons name={icon} size={28} color={disabled ? color + '60' : color} />
      </View>
      <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
      {disabledHint ? <Text style={styles.actionHint}>{disabledHint}</Text> : null}
    </TouchableOpacity>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetBlock: { flex: 1 },
  greeting: { fontSize: theme.fontSize.sm, color: 'rgba(255,255,255,0.75)' },
  userName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
    marginTop: 2,
  },
  dateText: { fontSize: theme.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  headerActions: { marginLeft: 12 },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caf50',
    marginRight: 10,
  },
  activeBannerTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semiBold,
    color: '#fff',
  },
  activeBannerSub: { fontSize: theme.fontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  section: { marginBottom: 20 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    width: '47%',
    ...theme.shadow.sm,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
  },
  actionLabelDisabled: { color: theme.colors.textMuted },
  actionHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  // Scheduled visits section
  scheduleEmpty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  scheduleEmptyTxt: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  scheduleCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    marginBottom: 8, overflow: 'hidden', ...theme.shadow.sm,
  },
  scheduleCardToday: { borderWidth: 1.5, borderColor: theme.colors.success + '60' },
  todayTag: { backgroundColor: theme.colors.success, paddingVertical: 3, paddingHorizontal: 12 },
  todayTagTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff', letterSpacing: 0.8 },
  scheduleCardRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  scheduleDateCol: { width: 44, alignItems: 'center', marginRight: 12 },
  scheduleDateNum: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  scheduleDateMon: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.semiBold, textTransform: 'uppercase' },
  scheduleCardBody: { flex: 1 },
  scheduleRoundPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full, borderWidth: 1, marginBottom: 4 },
  scheduleRoundTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  scheduleHostel: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  scheduleDow: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
});
