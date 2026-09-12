import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { visitService } from '../../services/visitService';
import { theme, getStatusColor } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel, getInitials } from '../../utils/helpers';
import { Badge, EmptyState } from '../../components/common/UIComponents';
import { AppHeader } from '../../components/common/AppHeader';
import { SelectPicker } from '../../components/forms/SelectPicker';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

export default function AllVisitsScreen() {
  const navigation = useNavigation();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const LIMIT = 10000;

  const fetchVisits = async (p = 1, reset = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await visitService.getAllVisits({
        page: p, limit: LIMIT,
        ...(statusFilter && { status: statusFilter }),
      });
      if (res.success) {
        const data = res.data.visits || [];
        setVisits(prev => reset ? data : [...prev, ...data]);
        setHasMore(data.length === LIMIT);
        setPage(p);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load visits' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchVisits(1, true); }, [statusFilter]));
  const onRefresh = () => { setRefreshing(true); fetchVisits(1, true); };
  const loadMore = () => { if (!loadingMore && hasMore) fetchVisits(page + 1); };

  const filtered = search.trim()
    ? visits.filter(v =>
        v.faculty?.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.hostel?.name?.toLowerCase().includes(search.toLowerCase()) ||
        getPurposeLabel(v.purpose).toLowerCase().includes(search.toLowerCase())
      )
    : visits;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('VisitDetail', { visitId: item._id || item.id })}
      activeOpacity={0.85}
    >
      {item.status === 'active' && <View style={styles.activeStripe} />}
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.roleFaculty + '18' }]}>
          <Text style={[styles.avatarText, { color: theme.colors.roleFaculty }]}>
            {getInitials(item.faculty?.name)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.facultyName}>{item.faculty?.name || 'Unknown'}</Text>
          <Text style={styles.dept}>{item.faculty?.department || item.faculty?.email}</Text>
        </View>
        <Badge label={item.status} color={getStatusColor(item.status)} size="sm" />
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{item.hostel?.name}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="flag-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{getPurposeLabel(item.purpose)}</Text>
        </View>
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.timeText}>{formatDateTime(item.checkIn)}</Text>
        {item.duration ? (
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        ) : null}
        {item.isVerified ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="shield-checkmark" size={12} color={theme.colors.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="All Visits" subtitle="System-wide visit records" onBack={() => navigation.goBack()} />

      <View style={styles.filterBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search faculty, hostel..."
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity> : null}
        </View>
        <SelectPicker value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Status" compact />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState icon="document-text-outline" message="No visits found" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={theme.colors.primary} /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  list: { padding: 14, paddingTop: 4, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
    padding: 14, marginBottom: 10, ...theme.shadow.sm, overflow: 'hidden',
  },
  activeStripe: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: theme.colors.success,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { fontSize: 14, fontWeight: '800' },
  info: { flex: 1 },
  facultyName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  dept: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  cardBottom: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: theme.colors.textSecondary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderLight, paddingTop: 8 },
  timeText: { fontSize: 11, color: theme.colors.textMuted, flex: 1 },
  durationText: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontSize: 11, color: theme.colors.success, fontWeight: '600' },
});
