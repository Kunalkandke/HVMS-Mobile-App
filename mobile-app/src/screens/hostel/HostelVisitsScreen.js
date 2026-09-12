import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { EmptyState, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { scheduleService } from '../../services/scheduleService';
import { theme } from '../../utils/theme';
import { useAuth } from '../../context/AuthContext';

const ROUND_FILTERS = ['All', 'Round-I', 'Round-II', 'Round-III', 'Round-IV'];

const STATUS_COLOR = {
  scheduled: theme.colors.primary,
  notified:  theme.colors.info,
  started:   theme.colors.warning,
  completed: theme.colors.success,
  missed:    theme.colors.error,
  cancelled: theme.colors.textMuted,
};

const ROUND_COLOR = {
  'Round-I':   '#1565c0',
  'Round-II':  '#2e7d32',
  'Round-III': '#e65100',
  'Round-IV':  '#6a1b9a',
};

export default function HostelVisitsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { hostelId, hostelName, hostelType } = route.params || {};

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roundFilter, setRoundFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pagination, setPagination] = useState({ total: 0 });

  useFocusEffect(
    useCallback(() => {
      if (hostelId) loadVisits();
    }, [hostelId, roundFilter, statusFilter])
  );

  const loadVisits = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = { limit: 10000 };
      if (roundFilter !== 'All') params.round = roundFilter;
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();

      const res = await scheduleService.getScheduleByHostel(hostelId, params);
      if (res.success) {
        setVisits(res.data.visits || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to load visits' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleCardPress = (item) => {
    const isMyVisit = user?.role === 'faculty' && (item.faculty_user?.id === user.id || item.faculty_user_id === user.id);
    const isAdminOrWarden = user?.role === 'admin' || user?.role === 'warden';
    const facName = item.faculty_user?.name || item.excel_faculty_name || 'Unassigned Faculty';

    if (item.actual_visit_id) {
      navigation.navigate('VisitDetail', { visitId: item.actual_visit_id });
    } else if (isMyVisit && item.visit_date === todayStr && item.status === 'scheduled') {
      navigation.navigate('StartVisit', {
        hostelId: item.hostel_id || hostelId,
        hostelName: item.hostel?.name || hostelName,
        hostelType: item.hostel_type || hostelType,
        scheduledVisitId: item.id,
      });
    } else {
      Toast.show({
        type: 'info',
        text1: `${item.round || 'Scheduled Visit'} • ${item.status?.toUpperCase() || 'SCHEDULED'}`,
        text2: `Faculty: ${facName} | Date: ${item.visit_date || 'N/A'}`,
      });
    }
  };

  const renderVisit = ({ item }) => {
    const sc = STATUS_COLOR[item.status] || theme.colors.textMuted;
    const rc = ROUND_COLOR[item.round] || theme.colors.primary;
    const isToday = item.visit_date === todayStr;
    const isFuture = item.visit_date > todayStr;
    const facName = item.faculty_user?.name || item.excel_faculty_name || 'Unassigned';
    const facCode = item.faculty_user?.faculty_code;
    const facDept = item.faculty_user?.department;
    const isMyVisit = user?.role === 'faculty' && (item.faculty_user?.id === user.id || item.faculty_user_id === user.id);

    return (
      <TouchableOpacity
        style={[styles.card, isToday && styles.cardToday]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.82}
      >
        {isToday && item.status === 'scheduled' && (
          <View style={styles.todayBanner}>
            <Text style={styles.todayBannerTxt}>🟢 TODAY'S VISIT — TAP TO START</Text>
          </View>
        )}
        {isFuture && item.status === 'scheduled' && (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed" size={11} color="#555" />
            <Text style={styles.lockedBannerTxt}>LOCKED UNTIL {item.visit_date}</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.dateCol}>
            <Text style={styles.dateNum}>{item.visit_date?.slice(8, 10) || '—'}</Text>
            <Text style={styles.dateMon}>
              {item.visit_date
                ? new Date(item.visit_date + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
                : ''}
            </Text>
            <Text style={styles.dateDay}>{item.day_of_week?.slice(0, 3) || ''}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTopBadges}>
              <View style={[styles.roundPill, { backgroundColor: rc + '15', borderColor: rc + '40' }]}>
                <Text style={[styles.roundPillTxt, { color: rc }]}>{item.round}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: sc + '15' }]}>
                <Text style={[styles.statusPillTxt, { color: sc }]}>{item.status}</Text>
              </View>
              {isMyVisit && (
                <View style={styles.myVisitPill}>
                  <Text style={styles.myVisitPillTxt}>Assigned to You</Text>
                </View>
              )}
            </View>

            <Text style={styles.facName} numberOfLines={1}>
              👤 {facName}
            </Text>

            {facCode ? (
              <Text style={styles.facCodeTxt}>
                🆔 {facCode} {facDept ? `· ${facDept}` : ''}
              </Text>
            ) : item.excel_phone ? (
              <Text style={styles.facCodeTxt}>📱 {item.excel_phone}</Text>
            ) : null}
          </View>

          {isFuture ? (
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
          ) : item.actual_visit_id || (isMyVisit && isToday) ? (
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={hostelName || 'Hostel Schedule'}
        subtitle={`${pagination.total || visits.length} visits scheduled`}
        showBack
      />

      {/* Filter Row: Rounds */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROUND_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, roundFilter === item && styles.chipActive]}
              onPress={() => setRoundFilter(item)}
            >
              <Text style={[styles.chipTxt, roundFilter === item && styles.chipTxtActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisit}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadVisits(true)} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Visits Found"
              message={`No scheduled visits found for ${roundFilter !== 'All' ? roundFilter : 'this hostel'}.`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  filterSection: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 8,
  },
  filterList: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  chipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  cardToday: { borderWidth: 1.5, borderColor: theme.colors.success + '60' },
  todayBanner: { backgroundColor: theme.colors.success, paddingVertical: 3, paddingHorizontal: 12 },
  todayBannerTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff', letterSpacing: 0.8 },
  lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0e0e0', paddingVertical: 3, paddingHorizontal: 12 },
  lockedBannerTxt: { fontSize: 10, fontWeight: theme.fontWeight.bold, color: '#555', letterSpacing: 0.8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  dateCol: { width: 46, alignItems: 'center', marginRight: 12 },
  dateNum: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, lineHeight: 28 },
  dateMon: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.semiBold, textTransform: 'uppercase' },
  dateDay: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  cardBody: { flex: 1 },
  cardTopBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  roundPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full, borderWidth: 1 },
  roundPillTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusPillTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },
  myVisitPill: { backgroundColor: theme.colors.primary + '18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  myVisitPillTxt: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
  facName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  facCodeTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
});
