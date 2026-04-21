import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { visitService } from '../../services/visitService';
import { reportService } from '../../services/reportService';
import { theme } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel, getInitials } from '../../utils/helpers';
import { Badge, EmptyState, StatCard } from '../../components/common/UIComponents';

const POLL_INTERVAL = 15000; // 15 seconds

export default function WardenDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [activeVisits, setActiveVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef(null);

  const fetchData = async (silent = false) => {
    try {
      const [activeRes, statsRes] = await Promise.all([
        visitService.getActiveVisits(),
        reportService.getDashboardStats(),
      ]);
      if (activeRes.success) setActiveVisits(activeRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch {
      if (!silent) Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
      // Start polling when screen is focused
      pollingRef.current = setInterval(() => fetchData(true), POLL_INTERVAL);
      return () => {
        // Stop polling when screen loses focus
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.roleWarden} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.roleWarden} />}
      >
        {/* Header */}
        <LinearGradient colors={['#1b5e20', '#2e7d32', '#388e3c']} style={styles.banner}>
          <View style={styles.bannerTop}>
            <View>
              <Text style={styles.roleLabel}>Warden Portal</Text>
              <Text style={styles.nameText}>{user?.name?.split(' ')[0]} 👋</Text>
              {user?.assignedHostel && (
                <View style={styles.hostelBadge}>
                  <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.hostelBadgeText}>{user.assignedHostel.name}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
            </View>
          </View>

          {/* Active count banner */}
          <View style={styles.activeSummary}>
            <View style={styles.activePulse} />
            <Text style={styles.activeSummaryText}>
              {activeVisits.length > 0
                ? `${activeVisits.length} active visit${activeVisits.length > 1 ? 's' : ''} in progress`
                : 'No active visits right now'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Hostel Visits')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Stats */}
          {stats && (
            <View style={styles.statsRow}>
              <StatCard label="Active" value={stats.activeCount ?? 0} icon="radio-button-on" color={theme.colors.success} />
              <StatCard label="Today" value={stats.todayCount ?? 0} icon="today-outline" color={theme.colors.roleWarden} />
              <StatCard label="Month" value={stats.monthCount ?? 0} icon="calendar-outline" color={theme.colors.secondary} />
            </View>
          )}

          {/* Live Active Visits */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Visits</Text>
              <View style={[styles.liveChip, activeVisits.length > 0 && styles.liveChipActive]}>
                <View style={[styles.liveDot, activeVisits.length > 0 && styles.liveDotActive]} />
                <Text style={[styles.liveText, activeVisits.length > 0 && styles.liveTextActive]}>
                  {activeVisits.length > 0 ? 'LIVE' : 'NONE'}
                </Text>
              </View>
            </View>

            {activeVisits.length === 0 ? (
              <EmptyState
                icon="checkmark-circle-outline"
                message="No active visits"
                subMessage="All clear in your hostel"
              />
            ) : (
              activeVisits.map(visit => (
                <TouchableOpacity
                  key={visit._id || visit.id || String(Math.random())}
                  style={styles.visitCard}
                  onPress={() => navigation.navigate('Hostel Visits')}
                  activeOpacity={0.85}
                >
                  <View style={styles.visitTop}>
                    <View style={styles.facultyAvatar}>
                      <Text style={styles.facultyAvatarText}>{getInitials(visit.faculty?.name)}</Text>
                    </View>
                    <View style={styles.visitInfo}>
                      <Text style={styles.facultyName}>{visit.faculty?.name}</Text>
                      <Text style={styles.facultyDept}>{visit.faculty?.department}</Text>
                    </View>
                    <Badge label="Active" color={theme.colors.success} size="sm" />
                  </View>
                  <View style={styles.visitMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="flag-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={styles.metaText}>{getPurposeLabel(visit.purpose)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={styles.metaText}>{formatDateTime(visit.checkIn)}</Text>
                    </View>
                  </View>
                  {visit.facultyRemarks ? (
                    <Text style={styles.remarks} numberOfLines={1}>"{visit.facultyRemarks}"</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  roleLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  nameText: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2 },
  hostelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  hostelBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  activeSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.md, padding: 12,
  },
  activePulse: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#a5d6a7',
  },
  activeSummaryText: { flex: 1, fontSize: 13, color: '#fff', fontWeight: '500' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  body: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  liveChipActive: { backgroundColor: theme.colors.successLight },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textMuted },
  liveDotActive: { backgroundColor: theme.colors.success },
  liveText: { fontSize: 10, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 1 },
  liveTextActive: { color: theme.colors.success },
  visitCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
    padding: 14, marginBottom: 10, ...theme.shadow.sm,
    borderLeftWidth: 3, borderLeftColor: theme.colors.success,
  },
  visitTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  facultyAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.roleFaculty + '18',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  facultyAvatarText: { fontSize: 14, fontWeight: '800', color: theme.colors.roleFaculty },
  visitInfo: { flex: 1 },
  facultyName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  facultyDept: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  visitMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: theme.colors.textMuted },
  remarks: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 8 },
});
