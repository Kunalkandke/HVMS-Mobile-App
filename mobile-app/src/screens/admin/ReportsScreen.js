import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { reportService } from '../../services/reportService';
import { theme } from '../../utils/theme';
import { formatDate, formatDuration } from '../../utils/helpers';
import { Card, StatCard, EmptyState } from '../../components/common/UIComponents';
import { AppHeader } from '../../components/common/AppHeader';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ReportsScreen() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [hostelStats, setHostelStats] = useState([]);
  const [facultyStats, setFacultyStats] = useState([]);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const fetchAll = async () => {
    try {
      const [dashRes, hostelRes, facultyRes, monthlyRes] = await Promise.all([
        reportService.getDashboardStats(),
        reportService.getByHostel(),
        reportService.getByFaculty(),
        reportService.getMonthlyReport(month, year),
      ]);
      if (dashRes.success) setStats(dashRes.data);
      if (hostelRes.success) setHostelStats(hostelRes.data || []);
      if (facultyRes.success) setFacultyStats(facultyRes.data || []);
      if (monthlyRes.success) setMonthlyData(monthlyRes.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load reports' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchAll(); }, [month]));
  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const maxHostelCount = Math.max(...hostelStats.map(h => h.totalVisits), 1);
  const maxFacultyCount = Math.max(...facultyStats.map(f => f.totalVisits), 1);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppHeader title="Reports & Analytics" />
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Reports & Analytics" subtitle={`${MONTHS[month-1]} ${year}`} />

      {/* Tab Bar */}
      <View style={styles.tabs}>
        {[
          { key: 'overview', label: 'Overview', icon: 'grid-outline' },
          { key: 'hostels', label: 'By Hostel', icon: 'business-outline' },
          { key: 'faculty', label: 'By Faculty', icon: 'people-outline' },
          { key: 'monthly', label: 'Monthly', icon: 'calendar-outline' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon} size={14} color={tab === t.key ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Overview Tab ── */}
        {tab === 'overview' && stats && (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Active Now" value={stats.activeCount ?? 0} icon="radio-button-on" color={theme.colors.success} />
              <StatCard label="Today" value={stats.todayCount ?? 0} icon="today-outline" color={theme.colors.primary} />
              <StatCard label="This Month" value={stats.monthCount ?? 0} icon="calendar-outline" color={theme.colors.secondary} />
            </View>
            {stats.hostelWise?.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>Today's Visits by Hostel</Text>
                {stats.hostelWise.map((h, i) => (
                  <View key={h._id || h.hostelName || i} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>{h.hostelName}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {
                        width: `${Math.round((h.count / Math.max(...stats.hostelWise.map(x=>x.count), 1)) * 100)}%`,
                        backgroundColor: theme.colors.primary,
                      }]} />
                    </View>
                    <Text style={styles.barCount}>{h.count}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ── By Hostel Tab ── */}
        {tab === 'hostels' && (
          hostelStats.length === 0 ? <EmptyState icon="business-outline" message="No hostel data available" /> :
          hostelStats.map((h, i) => (
            <Card key={h._id || h.hostelName || i} style={styles.rankCard}>
              <View style={styles.rankHeader}>
                <View style={styles.rankNum}><Text style={styles.rankNumText}>#{i + 1}</Text></View>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{h.hostelName}</Text>
                  <Text style={styles.rankType}>{h.type?.toUpperCase()}</Text>
                </View>
                <Text style={styles.rankTotal}>{h.totalVisits}</Text>
              </View>
              <View style={styles.rankBar}>
                <View style={[styles.rankFill, { width: `${Math.round((h.totalVisits / maxHostelCount) * 100)}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <View style={styles.rankMeta}>
                <Text style={styles.rankMetaText}>✓ Completed: {h.completedVisits}</Text>
                {h.avgDuration ? <Text style={styles.rankMetaText}>⌛ Avg: {formatDuration(Math.round(h.avgDuration))}</Text> : null}
              </View>
            </Card>
          ))
        )}

        {/* ── By Faculty Tab ── */}
        {tab === 'faculty' && (
          facultyStats.length === 0 ? <EmptyState icon="people-outline" message="No faculty data available" /> :
          facultyStats.map((f, i) => (
            <Card key={f._id || f.facultyName || i} style={styles.rankCard}>
              <View style={styles.rankHeader}>
                <View style={[styles.rankNum, { backgroundColor: theme.colors.roleFaculty + '18' }]}>
                  <Text style={[styles.rankNumText, { color: theme.colors.roleFaculty }]}>#{i + 1}</Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{f.facultyName}</Text>
                  <Text style={styles.rankType}>{f.department || f.email}</Text>
                </View>
                <Text style={styles.rankTotal}>{f.totalVisits}</Text>
              </View>
              <View style={styles.rankBar}>
                <View style={[styles.rankFill, { width: `${Math.round((f.totalVisits / maxFacultyCount) * 100)}%`, backgroundColor: theme.colors.roleFaculty }]} />
              </View>
              <View style={styles.rankMeta}>
                <Text style={styles.rankMetaText}>✓ Completed: {f.completedVisits}</Text>
                {f.lastVisit ? <Text style={styles.rankMetaText}>Last: {formatDate(f.lastVisit)}</Text> : null}
              </View>
            </Card>
          ))
        )}

        {/* ── Monthly Tab ── */}
        {tab === 'monthly' && (
          <>
            <View style={styles.monthSelector}>
              <TouchableOpacity onPress={() => setMonth(m => m === 1 ? 12 : m - 1)} style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
              <TouchableOpacity onPress={() => setMonth(m => m === 12 ? 1 : m + 1)} style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            {monthlyData && (
              <Card style={styles.monthCard}>
                <Text style={styles.chartTitle}>Total Visits: {monthlyData.total}</Text>
                {(monthlyData.dailyBreakdown || []).slice(-14).map((day, i) => (
                  <View key={day._id || i} style={styles.dayRow}>
                    <Text style={styles.dayDate}>{day._id?.slice(5)}</Text>
                    <View style={styles.dayTrack}>
                      <View style={[styles.dayFill, {
                        width: `${Math.round((day.count / Math.max(...(monthlyData.dailyBreakdown || []).map(d => d.count), 1)) * 100)}%`,
                        backgroundColor: theme.colors.secondary,
                      }]} />
                    </View>
                    <Text style={styles.dayCount}>{day.count}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: {
    flexDirection: 'row', backgroundColor: theme.colors.surface,
    marginHorizontal: 14, marginTop: 10, borderRadius: theme.borderRadius.md,
    padding: 4, ...theme.shadow.sm,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 8, gap: 3 },
  tabActive: { backgroundColor: theme.colors.primary + '15' },
  tabText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: theme.colors.primary },
  scroll: { padding: 14, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chartCard: { marginBottom: 12 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 90, fontSize: 12, color: theme.colors.textSecondary },
  barTrack: { flex: 1, height: 10, backgroundColor: theme.colors.borderLight, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: { width: 28, fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  rankCard: { marginBottom: 10 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rankNum: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: theme.colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  rankNumText: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  rankType: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  rankTotal: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  rankBar: { height: 8, backgroundColor: theme.colors.borderLight, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  rankFill: { height: '100%', borderRadius: 4 },
  rankMeta: { flexDirection: 'row', gap: 16 },
  rankMetaText: { fontSize: 12, color: theme.colors.textSecondary },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, gap: 16 },
  monthArrow: { padding: 6, backgroundColor: theme.colors.surface, borderRadius: 8, ...theme.shadow.sm },
  monthLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, minWidth: 100, textAlign: 'center' },
  monthCard: { marginBottom: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  dayDate: { width: 36, fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  dayTrack: { flex: 1, height: 8, backgroundColor: theme.colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  dayFill: { height: '100%', borderRadius: 4 },
  dayCount: { width: 24, fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
});
