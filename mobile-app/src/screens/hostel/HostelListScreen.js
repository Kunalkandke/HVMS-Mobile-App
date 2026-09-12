import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { EmptyState, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { hostelService } from '../../services/hostelService';
import { theme } from '../../utils/theme';
import { useAuth } from '../../context/AuthContext';

export default function HostelListScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'boys', 'girls'

  useFocusEffect(
    useCallback(() => { loadHostels(); }, [])
  );

  const loadHostels = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await hostelService.getAllHostels();
      if (res.success) {
        setHostels(res.data || []);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load hostels' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleHostelPress = (item) => {
    if (user?.role === 'warden' && user?.assignedHostel?.id && user.assignedHostel.id !== item.id) {
      Toast.show({
        type: 'info',
        text1: 'Assigned Hostel Only',
        text2: `You are assigned to ${user.assignedHostel.name}. Opening your hostel...`,
      });
      navigation.navigate('HostelVisits', {
        hostelId: user.assignedHostel.id,
        hostelName: user.assignedHostel.name,
        hostelType: user.assignedHostel.type,
      });
      return;
    }

    navigation.navigate('HostelVisits', {
      hostelId: item.id,
      hostelName: item.name,
      hostelType: item.type,
    });
  };

  const filteredHostels = hostels.filter(h => {
    if (filterType === 'boys') return h.type === 'boys';
    if (filterType === 'girls') return h.type === 'girls';
    return true;
  });

  const boysCount = hostels.filter(h => h.type === 'boys').length;
  const girlsCount = hostels.filter(h => h.type === 'girls').length;

  const renderHostel = ({ item }) => {
    const isGirls = item.type === 'girls';
    const accentColor = isGirls ? theme.colors.accent : theme.colors.primary;
    const isAssignedWardenHostel = user?.role === 'warden' && user?.assignedHostel?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, isAssignedWardenHostel && styles.cardAssigned]}
        onPress={() => handleHostelPress(item)}
        activeOpacity={0.82}
      >
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
          <Ionicons
            name={isGirls ? 'female' : 'male'}
            size={24}
            color={accentColor}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.hostelName}>{item.name}</Text>
            {isAssignedWardenHostel && (
              <Badge label="Your Hostel" color={theme.colors.success} size="sm" />
            )}
          </View>

          <View style={styles.metaRow}>
            <Badge
              label={isGirls ? 'Girls Hostel' : 'Boys Hostel'}
              color={accentColor}
              size="sm"
            />
            {item.capacity ? (
              <Text style={styles.capacityTxt}>Cap: {item.capacity}</Text>
            ) : null}
          </View>

          {item.warden ? (
            <Text style={styles.wardenTxt}>👤 Warden: {item.warden.name}</Text>
          ) : (
            <Text style={styles.noWardenTxt}>⚠️ No Warden Assigned</Text>
          )}

          {item.location ? (
            <Text style={styles.locationTxt}>📍 {item.location}</Text>
          ) : null}
        </View>

        <View style={styles.arrowCol}>
          <Text style={styles.viewVisitsTxt}>Visits</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Hostel Visits Dashboard"
        subtitle="Select a hostel to view visit schedules"
        showBack={true}
      />

      {/* Role Notice Banner */}
      <View style={styles.roleBanner}>
        <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
        <Text style={styles.roleBannerTxt}>
          {user?.role === 'admin' && '👑 Admin View: Inspect visit schedules for any hostel.'}
          {user?.role === 'warden' && '🛡 Warden View: View scheduled visits for your assigned hostel.'}
          {user?.role === 'faculty' && '🎓 Faculty View: View your assigned scheduled visits per hostel.'}
        </Text>
      </View>

      {/* Type Filter Chips */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterChipTxt, filterType === 'all' && styles.filterChipTxtActive]}>
            All Hostels ({hostels.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterType === 'boys' && styles.filterChipActive]}
          onPress={() => setFilterType('boys')}
        >
          <Ionicons name="male" size={14} color={filterType === 'boys' ? '#fff' : theme.colors.primary} />
          <Text style={[styles.filterChipTxt, filterType === 'boys' && styles.filterChipTxtActive]}>
            Boys ({boysCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterType === 'girls' && styles.filterChipActive]}
          onPress={() => setFilterType('girls')}
        >
          <Ionicons name="female" size={14} color={filterType === 'girls' ? '#fff' : theme.colors.accent} />
          <Text style={[styles.filterChipTxt, filterType === 'girls' && styles.filterChipTxtActive]}>
            Girls ({girlsCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={filteredHostels}
          keyExtractor={(item) => item.id}
          renderItem={renderHostel}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHostels(true)} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              title="No Hostels Found"
              message="No active hostels match your filter."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary + '25',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  roleBannerTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textPrimary, fontWeight: '600', flex: 1 },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
  filterChipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.bold },
  listContent: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.sm,
  },
  cardAssigned: {
    borderWidth: 1.5,
    borderColor: theme.colors.success,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  hostelName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  capacityTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  wardenTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  noWardenTxt: { fontSize: theme.fontSize.xs, color: theme.colors.warning, marginTop: 2 },
  locationTxt: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
  arrowCol: { alignItems: 'center', gap: 2, paddingLeft: 8 },
  viewVisitsTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
});
