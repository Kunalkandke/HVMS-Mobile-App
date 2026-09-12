import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import VisitCard from '../../components/cards/VisitCard';
import { EmptyState, LoadingSpinner } from '../../components/common/UIComponents';
import { visitService } from '../../services/visitService';
import { theme } from '../../utils/theme';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

export default function VisitHistoryScreen() {
  const navigation = useNavigation();
  const insets = { bottom: 0 };

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useFocusEffect(
    useCallback(() => {
      loadVisits(1, statusFilter, false);
    }, [statusFilter])
  );

  const loadVisits = async (page = 1, status = statusFilter, append = false) => {
    if (page === 1 && !append) setLoading(true);
    if (append) setLoadingMore(true);
    try {
      const res = await visitService.getMyVisits({
        page,
        limit: 10000,
        status: status || undefined,
      });
      if (res.success) {
        const newVisits = res.data.visits || [];
        setVisits(append ? (prev) => [...prev, ...newVisits] : newVisits);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load visits' });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadVisits(1, statusFilter, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && pagination.page < pagination.pages) {
      loadVisits(pagination.page + 1, statusFilter, true);
    }
  };

  const handleFilterChange = (val) => {
    setStatusFilter(val);
    setVisits([]);
  };

  const handleOpenForms = (visit) => {
    const vid = visit._id || visit.id;
    navigation.navigate('FormSelection', {
      visitId: vid,
      visitData: {
        id: vid,
        hostel: visit.hostel,
        faculty: visit.faculty,
        purpose: visit.purpose,
        checkIn: visit.checkIn || visit.check_in,
        checkOut: visit.checkOut || visit.check_out,
        duration: visit.duration,
      },
      readOnly: false,
    });
  };

  const renderItem = ({ item }) => (
    <View>
      <VisitCard
        visit={item}
        onPress={() => navigation.navigate('VisitDetail', { visitId: item._id || item.id })}
      />
      {/* Forms button on completed visits */}
      {item.status === 'completed' && (
        <TouchableOpacity
          style={styles.formsBtn}
          onPress={() => handleOpenForms(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.formsBtnText}>Visit Forms</Text>
          {/* Show green dot if forms already submitted */}
          {Array.isArray(item.form_submissions) && item.form_submissions.length > 0 && (
            <View style={styles.formDot}>
              <Text style={styles.formDotText}>{item.form_submissions.length}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <AppHeader
        title="Visit History"
        subtitle={`${pagination.total} total visits`}
      />

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => handleFilterChange(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingSpinner message="Loading visits..." />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item, index) => item._id || item.id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <LoadingSpinner message="Loading more..." /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No visits found"
              message={
                statusFilter
                  ? `No ${statusFilter} visits found.`
                  : 'You have not made any visits yet.'
              }
              action={() => navigation.navigate('StartVisit')}
              actionLabel="Start a Visit"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },
  listContent: { padding: 16, paddingBottom: 32 },
  formsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primary + '10',
    marginHorizontal: 0, marginTop: -8, marginBottom: 8,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.colors.primary + '25',
  },
  formsBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  formDot: {
    backgroundColor: theme.colors.success, borderRadius: 10,
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  formDotText: { fontSize: 10, color: '#fff', fontWeight: '800' },
});
