/**
 * FacultyScheduleScreen
 * Shows ONLY the logged-in faculty's own scheduled visits.
 * Backend enforces this via faculty_user_id = req.user.id.
 *
 * Filters: All | Scheduled | Completed | Missed
 * Sections: Today | Upcoming | Past
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { EmptyState, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { theme } from '../../utils/theme';
import { scheduleService } from '../../services/scheduleService';

const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed',    value: 'missed' },
];

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

function VisitCard({ item, onPress }) {
  const sc = STATUS_COLOR[item.status] || theme.colors.textMuted;
  const rc = ROUND_COLOR[item.round]   || theme.colors.primary;

  const today = new Date().toISOString().slice(0, 10);
  const isToday     = item.visitDate === today;
  const isFuture    = item.visitDate >  today;
  // A visit is "done" if it was completed/started OR if an actual visit record already exists for it
  const isCompleted = item.status === 'completed' || item.status === 'started'
    || !!(item.actualVisitId || item.actual_visit_id);
  // Can only start if: today's date, still scheduled, and NOT already completed
  const canStart    = isToday && item.status === 'scheduled' && !isCompleted;

  return (
    <TouchableOpacity
      style={[s.card, isToday && !isCompleted && s.cardToday, isCompleted && s.cardDone]}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.82}
    >
      {/* Banners */}
      {isCompleted && (
        <View style={s.doneBanner}>
          <Ionicons name="checkmark-circle" size={13} color="#fff" />
          <Text style={s.doneBannerTxt}>✓ VISIT COMPLETED — TAP TO VIEW DETAILS</Text>
        </View>
      )}
      {canStart && (
        <View style={s.todayBanner}>
          <Text style={s.todayBannerTxt}>🟢 TODAY'S VISIT — TAP TO START</Text>
        </View>
      )}
      {isFuture && item.status === 'scheduled' && (
        <View style={s.lockedBanner}>
          <Ionicons name="lock-closed" size={11} color="#555" />
          <Text style={s.lockedBannerTxt}>LOCKED UNTIL {item.visitDate}</Text>
        </View>
      )}

      <View style={s.cardTop}>
        {/* Date + day column */}
        <View style={s.dateCol}>
          <Text style={s.dateNum}>{item.visitDate?.slice(8, 10) || '—'}</Text>
          <Text style={s.dateMon}>
            {item.visitDate
              ? new Date(item.visitDate + 'T00:00:00Z')
                  .toLocaleDateString('en-GB', { month:'short', timeZone:'UTC' })
              : ''}
          </Text>
          <Text style={s.dateDay}>{item.dayOfWeek?.slice(0, 3) || ''}</Text>
        </View>

        {/* Main content */}
        <View style={s.cardBody}>
          <View style={s.cardBodyTop}>
            <View style={[s.roundPill, { backgroundColor: rc + '15', borderColor: rc + '40' }]}>
              <Text style={[s.roundPillTxt, { color: rc }]}>{item.round}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: sc + '15' }]}>
              <Text style={[s.statusPillTxt, { color: sc }]}>{item.status}</Text>
            </View>
          </View>

          <Text style={s.hostelName} numberOfLines={1}>
            {item.hostel?.name || item.hostelType || '—'}
          </Text>
          <View style={s.hostelMeta}>
            <Ionicons
              name={item.hostelType === 'girls' ? 'female' : 'male'}
              size={12}
              color={item.hostelType === 'girls' ? theme.colors.accent : theme.colors.secondary}
            />
            <Text style={[s.hostelTypeTxt, {
              color: item.hostelType === 'girls' ? theme.colors.accent : theme.colors.secondary,
            }]}>
              {item.hostelType === 'girls' ? 'Girls' : 'Boys'} Hostel
            </Text>
            {item.hostel?.location ? (
              <Text style={s.hostelLoc} numberOfLines={1}> · {item.hostel.location}</Text>
            ) : null}
          </View>
        </View>

        {/* Chevron / Lock */}
        {isFuture && !isCompleted ? (
          <Ionicons name="lock-closed-outline" size={16} color={theme.colors.textMuted} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        )}
      </View>

      {/* Action hint */}
      {canStart && (
        <View style={s.actionHint}>
          <Ionicons name="play-circle-outline" size={14} color={theme.colors.success} />
          <Text style={s.actionHintTxt}>Tap to Start Visit</Text>
        </View>
      )}
      {isCompleted && (
        <View style={s.actionHint}>
          <Ionicons name="eye-outline" size={14} color={theme.colors.primary} />
          <Text style={[s.actionHintTxt, { color: theme.colors.primary }]}>Tap to View Visit Details</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title, count }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={s.sectionCount}>
          <Text style={s.sectionCountTxt}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function FacultyScheduleScreen() {
  const navigation = useNavigation();

  const [visits,       setVisits]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [statusFilter, setFilter]      = useState('');
  const [hostelFilter, setHostelFilter] = useState(''); // '', 'boys', 'girls'
  const [pagination,   setPagination]   = useState({ total: 0 });

  useFocusEffect(
    useCallback(() => { loadVisits(); }, [statusFilter])
  );

  const loadVisits = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await scheduleService.getMySchedule({
        status: statusFilter || undefined,
        limit:  10000,
      });
      if (res.success) {
        setVisits(res.data.visits || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load schedule.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredVisits = React.useMemo(() => {
    if (!hostelFilter) return visits;
    return visits.filter(v => v.hostelType === hostelFilter);
  }, [visits, hostelFilter]);

  // Partition into today / upcoming / past
  const today    = new Date().toISOString().slice(0, 10);
  const todayV   = filteredVisits.filter(v => v.visitDate === today);
  const upcomingV= filteredVisits.filter(v => v.visitDate >  today);
  const pastV    = filteredVisits.filter(v => v.visitDate <  today);

  // Build flat list with section headers
  const sections = [];
  if (todayV.length > 0) {
    sections.push({ type:'header', id:'h-today', title:'Today', count: todayV.length });
    todayV.forEach((v, i) => sections.push({ type:'item', id: v.id || `t${i}`, data: v }));
  }
  if (upcomingV.length > 0) {
    sections.push({ type:'header', id:'h-upcoming', title:'Upcoming', count: upcomingV.length });
    upcomingV.forEach((v, i) => sections.push({ type:'item', id: v.id || `u${i}`, data: v }));
  }
  if (pastV.length > 0) {
    sections.push({ type:'header', id:'h-past', title:'Past', count: pastV.length });
    pastV.forEach((v, i) => sections.push({ type:'item', id: v.id || `p${i}`, data: v }));
  }

  const handleVisitPress = (visit) => {
    const today2 = new Date().toISOString().slice(0, 10);

    // ── COMPLETED: permanently locked — show details only ─────────────
    // A visit is done if status is completed/started OR it already has an actual_visit_id
    const alreadyDone = visit.status === 'completed' || visit.status === 'started'
      || !!(visit.actualVisitId || visit.actual_visit_id);

    if (alreadyDone) {
      const actualId = visit.actualVisitId || visit.actual_visit_id;
      if (actualId) {
        navigation.navigate('VisitDetail', { visitId: actualId });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Visit Already Completed ✓',
          text2: 'This visit has been completed and submitted. View Visit History for details.',
        });
      }
      return;
    }

    // ── TODAY + scheduled (not yet done): allow start once ────────────
    if (visit.visitDate === today2 && visit.status === 'scheduled') {
      navigation.navigate('StartVisit', {
        hostelId:        visit.hostelId || visit.hostel?.id,
        hostelName:      visit.hostel?.name,
        hostelType:      visit.hostelType,
        scheduledVisitId: visit.id,
      });
      return;
    }

    // ── FUTURE: locked until visit date ──────────────────────────────
    if (visit.visitDate > today2) {
      Toast.show({
        type: 'info',
        text1: 'Visit Locked 🔒',
        text2: `Scheduled for ${visit.visitDate}. You can start on the visit date.`,
      });
      return;
    }

    // ── PAST + still scheduled (missed/pending) ───────────────────────
    if (visit.visitDate < today2 && visit.status === 'scheduled') {
      Toast.show({
        type: 'info',
        text1: 'Past Scheduled Visit 🗓',
        text2: `This visit date has passed (${visit.visitDate}). Contact admin if it needs to be recorded.`,
      });
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <AppHeader
        title="My Schedule"
        subtitle={`${filteredVisits.length} assigned visits`}
        showBack
        backgroundColor={theme.colors.primary}
      />

      {/* Hostel filter chips */}
      <View style={s.hostelFilterBar}>
        {[
          { label: 'All Hostels', value: '' },
          { label: '👧 Girls Hostel', value: 'girls' },
          { label: '👦 Boys Hostel', value: 'boys' },
        ].map(hf => (
          <TouchableOpacity
            key={hf.value}
            style={[s.hChip, hostelFilter === hf.value && s.hChipActive]}
            onPress={() => setHostelFilter(hf.value)}
          >
            <Text style={[s.hChipTxt, hostelFilter === hf.value && s.hChipTxtActive]}>{hf.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filter chips */}
      <View style={s.filterBar}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[s.chip, statusFilter === f.value && s.chipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[s.chipTxt, statusFilter === f.value && s.chipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <SectionHeader title={item.title} count={item.count} />;
            }
            return <VisitCard item={item.data} onPress={handleVisitPress} />;
          }}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadVisits(true)} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No scheduled visits"
              message="You have no visits assigned yet. Contact your administrator."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  hostelFilterBar: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 8, backgroundColor: theme.colors.surface },
  hChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border },
  hChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  hChipTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  hChipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.bold },
  filterBar:  { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, gap: 8, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chip:       { paddingHorizontal: 14, paddingVertical: 5, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt:    { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  chipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },
  listContent:{ padding: 12, paddingBottom: 32 },
  sectionHead:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 6, paddingHorizontal: 2 },
  sectionTitle:{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  sectionCount:{ backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full, paddingHorizontal: 7, paddingVertical: 1 },
  sectionCountTxt: { fontSize: theme.fontSize.xs, color: '#fff', fontWeight: theme.fontWeight.bold },
  card:       { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, marginBottom: 8, overflow: 'hidden', ...theme.shadow.sm },
  cardToday:  { borderWidth: 1.5, borderColor: theme.colors.success + '60' },
  cardDone:   { borderWidth: 1.5, borderColor: theme.colors.primary + '40', opacity: 0.92 },
  todayBanner:{ backgroundColor: theme.colors.success, paddingVertical: 3, paddingHorizontal: 12 },
  todayBannerTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff', letterSpacing: 0.8 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.primary, paddingVertical: 3, paddingHorizontal: 12 },
  doneBannerTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff', letterSpacing: 0.6 },
  lockedBanner:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0e0e0', paddingVertical: 3, paddingHorizontal: 12 },
  lockedBannerTxt: { fontSize: 10, fontWeight: theme.fontWeight.bold, color: '#555', letterSpacing: 0.8 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', padding: 12 },
  dateCol:    { width: 46, alignItems: 'center', marginRight: 12 },
  dateNum:    { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, lineHeight: 28 },
  dateMon:    { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.semiBold, textTransform: 'uppercase' },
  dateDay:    { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  cardBody:   { flex: 1 },
  cardBodyTop:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  roundPill:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full, borderWidth: 1 },
  roundPillTxt:{ fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  statusPillTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },
  hostelName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  hostelMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  hostelTypeTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
  hostelLoc:  { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, flex: 1 },
  actionHint: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingBottom: 10 },
  actionHintTxt: { fontSize: theme.fontSize.xs, color: theme.colors.success, fontWeight: theme.fontWeight.semiBold },
});
