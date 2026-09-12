import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { reportService } from '../../services/reportService';
import { visitService } from '../../services/visitService';
import {
  StatCard, SectionHeader, EmptyState, LoadingSpinner,
} from '../../components/common/UIComponents';
import VisitCard from '../../components/cards/VisitCard';
import { theme } from '../../utils/theme';
import { getInitials, formatDate } from '../../utils/helpers';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [stats, setStats] = useState({ activeCount: 0, todayCount: 0, monthCount: 0, hostelWise: [] });
  const [activeVisits, setActiveVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [dashRes, activeRes] = await Promise.all([
        reportService.getDashboardStats(),
        visitService.getActiveVisits(),
      ]);
      if (dashRes.success) setStats(dashRes.data);
      if (activeRes.success) setActiveVisits(activeRes.data?.slice(0, 5) || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.roleAdmin, '#6a1b9a']}
        style={[styles.header, { paddingTop: 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Admin Dashboard</Text>
            <Text style={styles.date}>{formatDate(new Date(), 'EEEE, dd MMM yyyy')}</Text>
          </View>
          <TouchableOpacity style={styles.avatarCircle} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.colors.primary} />
          }
        >
          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard label="Active Now" value={stats.activeCount} icon="pulse-outline" color={theme.colors.success} />
            <StatCard label="Today" value={stats.todayCount} icon="today-outline" color={theme.colors.secondary} />
            <StatCard label="This Month" value={stats.monthCount} icon="calendar-outline" color={theme.colors.warning} />
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <SectionHeader title="Management" />
            <View style={styles.adminGrid}>
              {[
                { icon: 'people',    label: 'Users',         color: theme.colors.roleFaculty, screen: 'Users' },
                { icon: 'business',  label: 'Hostels',       color: theme.colors.roleWarden,  screen: 'Hostels' },
                { icon: 'bar-chart', label: 'Reports',       color: theme.colors.warning,     screen: 'Reports' },
                { icon: 'list',      label: 'All Visits',    color: theme.colors.secondary,   screen: 'AllVisits' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.adminCard}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.adminIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={26} color={item.color} />
                  </View>
                  <Text style={styles.adminLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Faculty Panel — prominent banner */}
            <TouchableOpacity
              style={styles.facultyPanelBtn}
              onPress={() => navigation.navigate('Users')}
              activeOpacity={0.82}
            >
              <View style={styles.facultyPanelIcon}>
                <Ionicons name="id-card" size={22} color={theme.colors.roleFaculty} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.facultyPanelLabel}>Faculty Panel</Text>
                <Text style={styles.facultyPanelHint}>View, edit & manage Excel-imported faculty accounts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Schedule & Faculty Import — Phase 1 */}
          <View style={styles.section}>
            <SectionHeader title="Schedule & Faculty Import" />
            <TouchableOpacity
              style={styles.importPrimaryBtn}
              onPress={() => navigation.navigate('ImportSchedule')}
              activeOpacity={0.82}
            >
              <View style={styles.importPrimaryIcon}>
                <Ionicons name="cloud-upload-outline" size={26} color="#fff" />
              </View>
              <View style={styles.importPrimaryText}>
                <Text style={styles.importPrimaryLabel}>Import Excel Schedule</Text>
                <Text style={styles.importPrimaryHint}>Upload Boys or Girls hostel .xlsx file</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <View style={styles.importSecondaryRow}>
              <TouchableOpacity
                style={styles.importSecondaryBtn}
                onPress={() => navigation.navigate('ScheduleManagement', { initialTab: 'uploads' })}
                activeOpacity={0.82}
              >
                <Ionicons name="people-outline" size={20} color={theme.colors.roleFaculty} />
                <Text style={[styles.importSecondaryLabel, { color: theme.colors.roleFaculty }]}>
                  Faculty Records
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.importSecondaryBtn}
                onPress={() => navigation.navigate('HostelList')}
                activeOpacity={0.82}
              >
                <Ionicons name="business-outline" size={20} color={theme.colors.roleWarden} />
                <Text style={[styles.importSecondaryLabel, { color: theme.colors.roleWarden }]}>
                  Hostel Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.importSecondaryBtn}
                onPress={() => navigation.navigate('ScheduleManagement')}
                activeOpacity={0.82}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.secondary} />
                <Text style={[styles.importSecondaryLabel, { color: theme.colors.secondary }]}>
                  Visits Schedule
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hostel-wise summary */}
          {stats.hostelWise?.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Today's Activity by Hostel" />
              {stats.hostelWise.map((h, i) => (
                <View key={h._id || h.hostelName || i} style={styles.hostelRow}>
                  <View style={[styles.hostelDot, { backgroundColor: h.type === 'boys' ? theme.colors.secondary : theme.colors.accent }]} />
                  <Text style={styles.hostelName} numberOfLines={1}>{h.hostelName}</Text>
                  <Text style={styles.hostelCount}>{h.count} visits</Text>
                </View>
              ))}
            </View>
          )}

          {/* Active Visits */}
          <View style={styles.section}>
            <SectionHeader
              title={`Active Visits (${stats.activeCount})`}
              action="See All"
              onAction={() => navigation.navigate('AllVisits')}
            />
            {activeVisits.length === 0 ? (
              <EmptyState icon="pulse-outline" title="No active visits" />
            ) : (
              activeVisits.map((v) => (
                <VisitCard
                  key={v._id || v.id || String(Math.random())}
                  visit={v}
                  showFaculty
                  onPress={() => navigation.navigate('VisitDetail', { visitId: v._id })}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
  date: { fontSize: theme.fontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: '#fff' },
  scroll: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  section: { marginBottom: 20 },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adminCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    width: '47%',
    ...theme.shadow.sm,
  },
  adminIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
  },
  hostelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 6,
    ...theme.shadow.sm,
  },
  hostelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  hostelName: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: theme.fontWeight.medium },
  hostelCount: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  // Schedule import section
  importPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: 16, marginBottom: 10,
    ...theme.shadow.md,
  },
  importPrimaryIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  importPrimaryText: { flex: 1 },
  importPrimaryLabel: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: '#fff' },
  importPrimaryHint:  { fontSize: theme.fontSize.xs, color: 'rgba(255,255,255,0.70)', marginTop: 2 },
  importSecondaryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  importSecondaryBtn: {
    flex: 1, minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12, ...theme.shadow.sm,
  },
  importSecondaryLabel: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, flex: 1 },
  // Faculty Panel banner
  facultyPanelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14, marginTop: 10,
    borderWidth: 1.5, borderColor: theme.colors.roleFaculty + '30',
    ...theme.shadow.sm,
  },
  facultyPanelIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.roleFaculty + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  facultyPanelLabel: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  facultyPanelHint:  { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
});
