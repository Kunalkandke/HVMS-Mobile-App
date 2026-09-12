import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { hostelService } from '../../services/hostelService';
import { theme } from '../../utils/theme';
import { Badge, EmptyState } from '../../components/common/UIComponents';
import { AppHeader } from '../../components/common/AppHeader';

export default function ManageHostelsScreen() {
  const navigation = useNavigation();
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchHostels = async () => {
    try {
      const res = await hostelService.getAllHostels();
      if (res.success) setHostels(res.data || []);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load hostels' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchHostels(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchHostels(); };

  const handleDelete = (hostel) => {
    Alert.alert(
      'Deactivate Hostel',
      `Deactivate "${hostel.name}"? It will no longer be selectable for new visits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate', style: 'destructive',
          onPress: async () => {
            setActionLoading(hostel._id);
            try {
              const res = await hostelService.deleteHostel(hostel._id);
              if (res.success) {
                setHostels(prev => prev.filter(h => h._id !== hostel._id));
                Toast.show({ type: 'success', text1: 'Hostel deactivated' });
              }
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Error', text2: err.message });
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const filtered = search.trim()
    ? hostels.filter(h =>
        h.name?.toLowerCase().includes(search.toLowerCase()) ||
        h.location?.toLowerCase().includes(search.toLowerCase())
      )
    : hostels;

  const boysCount = hostels.filter(h => h.type === 'boys').length;
  const girlsCount = hostels.filter(h => h.type === 'girls').length;

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: item.type === 'boys' ? theme.colors.secondary + '18' : theme.colors.accent + '18' }]}>
          <Ionicons
            name={item.type === 'boys' ? 'man-outline' : 'woman-outline'}
            size={24}
            color={item.type === 'boys' ? theme.colors.secondary : theme.colors.accent}
          />
        </View>
        <View style={styles.hostelInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.hostelName}>{item.name}</Text>
            <Badge
              label={item.type === 'boys' ? 'Boys' : 'Girls'}
              color={item.type === 'boys' ? theme.colors.secondary : theme.colors.accent}
              size="sm"
            />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={12} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>Capacity: {item.capacity}</Text>
          </View>
        </View>
      </View>

      {/* Warden Info */}
      <View style={styles.wardenRow}>
        <Ionicons
          name={item.warden ? 'person-circle-outline' : 'person-circle-outline'}
          size={15}
          color={item.warden ? theme.colors.roleWarden : theme.colors.textMuted}
        />
        <Text style={[styles.wardenText, !item.warden && styles.wardenMissing]}>
          {item.warden ? `Warden: ${item.warden.name}` : 'No warden assigned'}
        </Text>
        {!item.warden && (
          <View style={styles.warningDot}>
            <Ionicons name="warning-outline" size={12} color={theme.colors.warning} />
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {actionLoading === item._id ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 8 }} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('HostelVisits', { hostelId: item.id || item._id, hostelName: item.name, hostelType: item.type })}
          >
            <Ionicons name="calendar-outline" size={15} color={theme.colors.secondary} />
            <Text style={[styles.actionText, { color: theme.colors.secondary }]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CreateHostel', { hostel: item, editMode: true })}
          >
            <Ionicons name="create-outline" size={15} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
            <Text style={[styles.actionText, { color: theme.colors.error }]}>Deactivate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Manage Hostels"
        subtitle={`${hostels.length} hostels registered`}
        rightAction={{ icon: 'add-circle-outline', onPress: () => navigation.navigate('CreateHostel') }}
      />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statPill, { backgroundColor: theme.colors.secondary + '15' }]}>
          <Ionicons name="man" size={16} color={theme.colors.secondary} />
          <Text style={[styles.statVal, { color: theme.colors.secondary }]}>{boysCount}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.secondary }]}>Boys</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: theme.colors.accent + '15' }]}>
          <Ionicons name="woman" size={16} color={theme.colors.accent} />
          <Text style={[styles.statVal, { color: theme.colors.accent }]}>{girlsCount}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.accent }]}>Girls</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: theme.colors.primary + '10' }]}>
          <Ionicons name="business" size={16} color={theme.colors.primary} />
          <Text style={[styles.statVal, { color: theme.colors.primary }]}>{hostels.length}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.primary }]}>Total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search hostel name, location..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity> : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              message="No hostels registered"
              subMessage="Tap + to add your first hostel"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, gap: 8 },
  statPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.borderRadius.md, paddingVertical: 8, gap: 4,
  },
  statVal: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginVertical: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  list: { padding: 14, paddingTop: 4, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
    padding: 14, marginBottom: 10, ...theme.shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  iconWrap: {
    width: 50, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  hostelInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  hostelName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: theme.colors.textSecondary },
  wardenRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, padding: 8,
    marginBottom: 10,
  },
  wardenText: { fontSize: 12, color: theme.colors.roleWarden, fontWeight: '500', flex: 1 },
  wardenMissing: { color: theme.colors.textMuted },
  warningDot: { marginLeft: 'auto' },
  actions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.borderLight, paddingTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 7, borderRadius: 8,
    backgroundColor: theme.colors.primary + '12',
  },
  deleteBtn: { backgroundColor: theme.colors.errorLight },
  actionText: { fontSize: 13, fontWeight: '600' },
});
