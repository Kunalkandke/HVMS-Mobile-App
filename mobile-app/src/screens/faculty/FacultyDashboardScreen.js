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
      const [myVisitsRes, dashRes] = await Promise.all([
        visitService.getMyVisits({ limit: 5 }),
        reportService.getDashboardStats(),
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
});
