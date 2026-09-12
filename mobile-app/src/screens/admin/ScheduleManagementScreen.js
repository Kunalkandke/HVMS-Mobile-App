/**
 * ScheduleManagementScreen
 * View / filter / search all scheduled visits and upload history.
 * Two tabs: VISITS | UPLOADS
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { EmptyState, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { theme } from '../../utils/theme';
import { scheduleService } from '../../services/scheduleService';

const TAB_VISITS  = 'visits';
const TAB_UPLOADS = 'uploads';

const HOSTEL_FILTERS = [
  { label: 'All',   value: '' },
  { label: 'Boys',  value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed',    value: 'missed' },
];

const ROUND_FILTERS = [
  { label: 'All',    value: '' },
  { label: 'Rnd I',  value: 'Round-I' },
  { label: 'Rnd II', value: 'Round-II' },
  { label: 'Rnd III',value: 'Round-III' },
  { label: 'Rnd IV', value: 'Round-IV' },
];

const STATUS_COLOR = {
  scheduled: theme.colors.primary,
  notified:  theme.colors.info,
  started:   theme.colors.warning,
  completed: theme.colors.success,
  missed:    theme.colors.error,
  cancelled: theme.colors.textMuted,
};

const UPLOAD_STATUS_COLOR = {
  confirmed: theme.colors.success,
  previewed: theme.colors.warning,
  rejected:  theme.colors.error,
  draft:     theme.colors.textMuted,
};

/* ── visit card ──────────────────────────────────────────────────────────────*/
function VisitCard({ item }) {
  const statusColor = STATUS_COLOR[item.status] || theme.colors.textMuted;
  const faculty = item.facultyUser || item.facultyProfile;
  const facultyName = faculty?.name || item.excelFacultyName || '—';
  const hostelName  = item.hostel?.name || (item.hostelType === 'girls' ? "Girls Hostel" : "Boys Hostel");
  const hostelColor = item.hostelType === 'girls' ? theme.colors.accent : theme.colors.secondary;
  const facCode     = faculty?.facultyCode || faculty?.faculty_code;

  return (
    <View style={s.card}>
      <View style={s.cardLeft}>
        <Text style={s.cardDate}>{item.visitDate}</Text>
        <Text style={s.cardDay}>{item.dayOfWeek?.slice(0, 3) || ''}</Text>
      </View>
      <View style={s.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={s.cardTitle} numberOfLines={1}>{facultyName}</Text>
          {facCode && (
            <View style={s.facTag}>
              <Text style={s.facTagTxt}>{facCode}</Text>
            </View>
          )}
        </View>

        <View style={s.cardSubRow}>
          <View style={[s.hostelTypeBadge, { backgroundColor: hostelColor + '18', borderColor: hostelColor + '40' }]}>
            <Ionicons name={item.hostelType === 'girls' ? 'female' : 'male'} size={11} color={hostelColor} />
            <Text style={[s.hostelTypeBadgeTxt, { color: hostelColor }]}>
              {item.hostelType === 'girls' ? 'Girls' : 'Boys'} Hostel
            </Text>
          </View>
          <Text style={s.cardSub}>{hostelName} · {item.round}</Text>
        </View>

        {faculty?.phone && <Text style={s.cardPhone}>📱 {faculty.phone}</Text>}
      </View>
      <View style={[s.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
}

/* ── upload card ─────────────────────────────────────────────────────────────*/
function UploadCard({ item, onDelete }) {
  const sc = UPLOAD_STATUS_COLOR[item.status] || theme.colors.textMuted;
  const hostelColor = item.hostelType === 'girls' ? theme.colors.accent : theme.colors.secondary;

  return (
    <View style={s.uploadCard}>
      <View style={s.uploadCardTop}>
        <View style={[s.hostelTag, { backgroundColor: hostelColor + '15', borderColor: hostelColor + '40' }]}>
          <Ionicons name={item.hostelType === 'girls' ? 'female' : 'male'} size={13} color={hostelColor} />
          <Text style={[s.hostelTagTxt, { color: hostelColor }]}>
            {item.hostelType === 'girls' ? 'Girls' : 'Boys'}
          </Text>
        </View>
        <Text style={s.uploadYear}>{item.academicYear}</Text>
        <View style={[s.uploadStatusChip, { backgroundColor: sc + '18' }]}>
          <Text style={[s.uploadStatusTxt, { color: sc }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={s.uploadFileName} numberOfLines={1}>{item.originalFileName || item.fileName}</Text>
      <View style={s.uploadMeta}>
        <Text style={s.uploadMetaTxt}>
          {item.totalScheduleRecords} visits · {item.totalFaculty} faculty
        </Text>
        <Text style={s.uploadMetaTxt}>
          {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : ''}
        </Text>
      </View>
      {item.status === 'confirmed' && (
        <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.82}>
          <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
          <Text style={s.deleteBtnTxt}>Delete Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── chip filter row ─────────────────────────────────────────────────────────*/
function ChipRow({ options, value, onChange }) {
  return (
    <View style={s.chipRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value}
          style={[s.filterChip, value === o.value && s.filterChipActive]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[s.filterChipTxt, value === o.value && s.filterChipTxtActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ── main screen ─────────────────────────────────────────────────────────────*/
export default function ScheduleManagementScreen() {
  const navigation = useNavigation();

  const [tab,         setTab]         = useState(TAB_VISITS);
  const [visits,      setVisits]      = useState([]);
  const [uploads,     setUploads]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, pages: 1 });

  // filters
  const [search,       setSearch]      = useState('');
  const [hostelFilter, setHostelFilter]= useState('');
  const [statusFilter, setStatusFilter]= useState('');
  const [roundFilter,  setRoundFilter] = useState('');
  const [showFilters,  setShowFilters] = useState(false);

  const searchTimer = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [tab, hostelFilter, statusFilter, roundFilter])
  );

  const loadData = useCallback(async (isRefresh = false, page = 1) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (tab === TAB_VISITS) {
        const res = await scheduleService.listScheduledVisits({
          hostelType: hostelFilter || undefined,
          status:     statusFilter || undefined,
          round:      roundFilter  || undefined,
          page, limit: 10000,
        });
        if (res.success) {
          setVisits(res.data.visits || []);
          setPagination(res.data.pagination || {});
        }
      } else {
        const res = await scheduleService.listUploads({
          hostelType: hostelFilter || undefined,
        });
        if (res.success) setUploads(res.data || []);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Load Failed', text2: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, hostelFilter, statusFilter, roundFilter]);

  const handleDeleteUpload = useCallback((upload) => {
    Alert.alert(
      'Delete Schedule Upload',
      `Delete "${upload.originalFileName || upload.fileName}"?\n\nThis removes all ${upload.totalScheduleRecords} scheduled visit records from this upload.\n\nHistorical actual visits are NOT affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const res = await scheduleService.deleteUpload(upload.id || upload._id);
              if (!res.success) throw new Error(res.message);
              Toast.show({ type: 'success', text1: 'Upload Deleted' });
              loadData();
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Delete Failed', text2: err.message });
            }
          },
        },
      ]
    );
  }, [loadData]);

  const filteredVisits = visits.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (v.facultyUser?.name || v.facultyProfile?.name || v.excelFacultyName || '').toLowerCase();
    return name.includes(q) || (v.visitDate || '').includes(q) || (v.round || '').toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={s.container}>
      <AppHeader
        title="Schedule Records"
        subtitle={tab === TAB_VISITS
          ? `${pagination.total || visits.length} visits`
          : `${uploads.length} uploads`}
        showBack
        rightIcon="cloud-upload-outline"
        onRightPress={() => navigation.navigate('ImportSchedule')}
      />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {[
          { key: TAB_VISITS,  label: 'Scheduled Visits', icon: 'calendar-outline' },
          { key: TAB_UPLOADS, label: 'Upload History',   icon: 'cloud-upload-outline' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon} size={15} color={tab === t.key ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + filter toggle (visits tab only) */}
      {tab === TAB_VISITS && (
        <View style={s.searchBar}>
          <View style={s.searchInput}>
            <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={s.searchTxt}
              placeholder="Search faculty, date, round…"
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.filterToggle, showFilters && { backgroundColor: theme.colors.primary + '18' }]}
            onPress={() => setShowFilters(f => !f)}
          >
            <Ionicons name="options-outline" size={18} color={showFilters ? theme.colors.primary : theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter chips */}
      {tab === TAB_VISITS && showFilters && (
        <View style={s.filtersWrap}>
          <Text style={s.filterGroupLabel}>Hostel</Text>
          <ChipRow options={HOSTEL_FILTERS} value={hostelFilter} onChange={setHostelFilter} />
          <Text style={s.filterGroupLabel}>Status</Text>
          <ChipRow options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          <Text style={s.filterGroupLabel}>Round</Text>
          <ChipRow options={ROUND_FILTERS}  value={roundFilter}  onChange={setRoundFilter}  />
        </View>
      )}

      {tab === TAB_UPLOADS && (
        <View style={s.uploadFilterBar}>
          <Text style={s.filterGroupLabel}>Hostel</Text>
          <ChipRow options={HOSTEL_FILTERS} value={hostelFilter} onChange={v => { setHostelFilter(v); loadData(); }} />
        </View>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : tab === TAB_VISITS ? (
        <FlatList
          data={filteredVisits}
          keyExtractor={(item, i) => item.id || item._id || String(i)}
          renderItem={({ item }) => <VisitCard item={item} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" title="No scheduled visits"
              message="Import an Excel schedule to get started."
              action={() => navigation.navigate('ImportSchedule')}
              actionLabel="Import Schedule" />
          }
        />
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(item, i) => item.id || item._id || String(i)}
          renderItem={({ item }) => <UploadCard item={item} onDelete={handleDeleteUpload} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="cloud-upload-outline" title="No uploads yet"
              action={() => navigation.navigate('ImportSchedule')}
              actionLabel="Import Excel" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar:    { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.primary },
  tabTxt:    { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textMuted },
  tabTxtActive: { color: theme.colors.primary, fontWeight: theme.fontWeight.semiBold },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  searchInput:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceVariant, borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 8 },
  searchTxt:  { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textPrimary },
  filterToggle:{ padding: 8, borderRadius: theme.borderRadius.sm },
  filtersWrap:   { backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  uploadFilterBar:{ backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  filterGroupLabel: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textMuted, marginTop: 8, marginBottom: 4 },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border },
  filterChipActive:   { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipTxt:      { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  filterChipTxtActive:{ color: '#fff', fontWeight: theme.fontWeight.semiBold },
  listContent: { padding: 12, paddingBottom: 32 },
  // Visit card
  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 6, ...theme.shadow.sm },
  cardLeft:  { width: 52, alignItems: 'center', marginRight: 10 },
  cardDate:  { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  cardDay:   { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'center' },
  cardBody:  { flex: 1 },
  cardTitle: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  facTag: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full, paddingHorizontal: 6, paddingVertical: 1 },
  facTagTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  hostelTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.borderRadius.full, borderWidth: 1 },
  hostelTypeBadgeTxt: { fontSize: 10, fontWeight: theme.fontWeight.bold },
  cardSub:   { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
  cardPhone: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  // Upload card
  uploadCard:    { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10, ...theme.shadow.sm },
  uploadCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hostelTag:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full, borderWidth: 1 },
  hostelTagTxt:  { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  uploadYear:    { flex: 1, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  uploadStatusChip:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full },
  uploadStatusTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },
  uploadFileName:{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginBottom: 6 },
  uploadMeta:    { flexDirection: 'row', justifyContent: 'space-between' },
  uploadMetaTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-end' },
  deleteBtnTxt:  { fontSize: theme.fontSize.xs, color: theme.colors.error, fontWeight: theme.fontWeight.semiBold },
});
