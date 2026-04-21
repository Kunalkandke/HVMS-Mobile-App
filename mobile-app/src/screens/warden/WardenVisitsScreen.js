import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { visitService } from '../../services/visitService';
import { theme, getStatusColor } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel, getInitials } from '../../utils/helpers';
import { Badge, EmptyState } from '../../components/common/UIComponents';
import AppHeader from '../../components/common/AppHeader';
import SelectPicker from '../../components/forms/SelectPicker';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

export default function WardenVisitsScreen() {
  const navigation = useNavigation();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [verifyModal, setVerifyModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [wardenRemarks, setWardenRemarks] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const fetchHostelVisits = async (reset = false) => {
    if (reset) setLoading(true);
    try {
      // Wardens should use getActiveVisits() and getHostelVisits() - NOT getAllVisits()
      // Backend automatically filters by warden's assigned hostel
      const [activeRes, completedRes] = await Promise.all([
        visitService.getActiveVisits(), // Gets active visits for warden's hostel
        visitService.getHostelVisits({ status: 'completed', limit: 50 }), // Gets completed visits
      ]);

      let combined = [];
      if (activeRes.success) {
        combined = activeRes.data || [];
      }
      if (completedRes.success) {
        const completedVisits = completedRes.data?.visits || [];
        combined = [...combined, ...completedVisits];
      }

      // Apply status filter if set
      if (statusFilter) {
        combined = combined.filter(v => v.status === statusFilter);
      }

      setVisits(combined);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load visits' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchHostelVisits(true); }, [statusFilter]));
  const onRefresh = () => { setRefreshing(true); fetchHostelVisits(false); };

  const openVerify = (visit) => {
    setSelectedVisit(visit);
    setWardenRemarks(visit.wardenRemarks || visit.warden_remarks || '');
    setVerifyModal(true);
  };

  const handleVerify = async () => {
    if (!selectedVisit) return;
    setVerifyLoading(true);
    try {
      const res = await visitService.verifyVisit(selectedVisit._id || selectedVisit.id, wardenRemarks.trim() || undefined);
      if (res.success) {
        setVisits(prev => prev.map(v =>
          (v._id || v.id) === (selectedVisit._id || selectedVisit.id) ? { ...v, isVerified: true, wardenRemarks: wardenRemarks.trim() } : v
        ));
        Toast.show({ type: 'success', text1: 'Visit Verified' });
        setVerifyModal(false);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleOpenForms = (visit) => {
    navigation.navigate('FormSelection', {
      visitId: visit._id || visit.id,
      visitData: {
        id: visit._id || visit.id,
        hostel: visit.hostel,
        faculty: visit.faculty,
        purpose: visit.purpose,
        checkIn: visit.checkIn || visit.check_in,
        checkOut: visit.checkOut || visit.check_out,
        duration: visit.duration,
      },
      readOnly: true, // Warden sees read-only
    });
  };

  const unverifiedCount = visits.filter(v => v.status === 'completed' && !v.isVerified).length;

  const renderItem = ({ item }) => (
    <View style={[styles.card, item.status === 'active' && styles.cardActive]}>
      {item.status === 'active' && <View style={styles.activeStripe} />}
      <View style={styles.cardTop}>
        <View style={styles.facultyAvatar}>
          <Text style={styles.facultyAvatarText}>{getInitials(item.faculty?.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.facultyName}>{item.faculty?.name}</Text>
          <Text style={styles.dept}>{item.faculty?.department || item.faculty?.email}</Text>
        </View>
        <Badge label={item.status} color={getStatusColor(item.status)} size="sm" />
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{item.hostel?.name}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="flag-outline" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{getPurposeLabel(item.purpose)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{formatDateTime(item.checkIn || item.check_in)}</Text>
        </View>
        {item.duration && (
          <View style={styles.metaItem}>
            <Ionicons name="hourglass-outline" size={12} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        {/* Forms button */}
        {item.status === 'completed' && (
          <TouchableOpacity style={styles.formsBtn} onPress={() => handleOpenForms(item)}>
            <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.formsBtnText}>View Forms</Text>
            {Array.isArray(item.form_submissions) && item.form_submissions.length > 0 && (
              <View style={styles.formBadge}>
                <Text style={styles.formBadgeText}>{item.form_submissions.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Verify button */}
        {item.status === 'completed' && !item.isVerified && (
          <TouchableOpacity style={styles.verifyBtn} onPress={() => openVerify(item)}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.roleWarden} />
            <Text style={styles.verifyBtnText}>Verify</Text>
          </TouchableOpacity>
        )}
        {item.isVerified && (
          <View style={styles.verifiedChip}>
            <Ionicons name="shield-checkmark" size={14} color={theme.colors.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Hostel Visits"
        subtitle={unverifiedCount > 0 ? `${unverifiedCount} pending verification` : 'All up to date'}
      />

      {unverifiedCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning} />
          <Text style={styles.alertText}>{unverifiedCount} visit{unverifiedCount > 1 ? 's' : ''} need verification</Text>
        </View>
      )}

      <View style={styles.filterBar}>
        <SelectPicker
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          placeholder="All Status"
          compact
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.roleWarden} /></View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={item => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.roleWarden} />}
          ListEmptyComponent={<EmptyState icon="business-outline" message="No visits found" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Verify Modal */}
      <Modal visible={verifyModal} transparent animationType="slide" onRequestClose={() => setVerifyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Visit</Text>
              <TouchableOpacity onPress={() => setVerifyModal(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedVisit && (
              <View style={styles.modalVisitInfo}>
                <Text style={styles.modalFaculty}>{selectedVisit.faculty?.name}</Text>
                <Text style={styles.modalMeta}>{selectedVisit.hostel?.name} · {getPurposeLabel(selectedVisit.purpose)}</Text>
              </View>
            )}
            <InputField
              label="Warden Remarks (optional)"
              value={wardenRemarks}
              onChangeText={setWardenRemarks}
              placeholder="Add your observations..."
              multiline
              numberOfLines={3}
              icon="chatbubble-outline"
            />
            <Button label="Confirm Verification" title="Confirm Verification" onPress={handleVerify} loading={verifyLoading} icon="shield-checkmark-outline" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.warningLight, marginHorizontal: 14,
    marginTop: 8, borderRadius: theme.borderRadius.md, padding: 10,
    borderWidth: 1, borderColor: theme.colors.warning + '40',
  },
  alertText: { fontSize: 13, color: theme.colors.warning, fontWeight: '600', flex: 1 },
  filterBar: { paddingHorizontal: 14, paddingVertical: 10 },
  list: { padding: 14, paddingTop: 4, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
    padding: 14, marginBottom: 10, ...theme.shadow.sm, overflow: 'hidden',
  },
  cardActive: { borderWidth: 1, borderColor: theme.colors.success + '50' },
  activeStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.colors.success },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  facultyAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.roleFaculty + '18',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  facultyAvatarText: { fontSize: 14, fontWeight: '800', color: theme.colors.roleFaculty },
  cardInfo: { flex: 1 },
  facultyName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  dept: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: theme.colors.textMuted },
  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.borderLight, paddingTop: 8, flexWrap: 'wrap' },
  formsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.primary + '12',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  formsBtnText: { fontSize: 12, color: theme.colors.primary, fontWeight: '700' },
  formBadge: {
    backgroundColor: theme.colors.success, borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  formBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.roleWarden + '15',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  verifyBtnText: { fontSize: 12, color: theme.colors.roleWarden, fontWeight: '700' },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 12, color: theme.colors.success, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  modalVisitInfo: {
    backgroundColor: theme.colors.surfaceVariant, borderRadius: theme.borderRadius.md,
    padding: 12, marginBottom: 16,
  },
  modalFaculty: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  modalMeta: { fontSize: 12, color: theme.colors.textSecondary },
});
