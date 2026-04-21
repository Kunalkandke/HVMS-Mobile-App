import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { Card, Badge, Divider, InfoRow, LoadingSpinner } from '../../components/common/UIComponents';
import { visitService } from '../../services/visitService';
import { useAuth } from '../../context/AuthContext';
import { theme, getStatusColor } from '../../utils/theme';
import {
  formatDateTime, formatDuration, getPurposeLabel,
} from '../../utils/helpers';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';

export default function VisitDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { visitId } = route.params || {};

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [wardenRemark, setWardenRemark] = useState('');

  useEffect(() => { loadVisit(); }, []);

  const loadVisit = async () => {
    try {
      const res = await visitService.getVisitById(visitId);
      if (res.success) setVisit(res.data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load visit' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await visitService.verifyVisit(visit._id || visit.id, wardenRemark || undefined);
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Visit Verified' });
        setVisit(res.data);
        setShowRemarkInput(false);
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Visit Details" showBack />
      <LoadingSpinner />
    </SafeAreaView>
  );

  if (!visit) return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Visit Details" showBack />
      <View style={styles.center}>
        <Text>Visit not found.</Text>
      </View>
    </SafeAreaView>
  );

  const statusColor = getStatusColor(visit.status);
  const canVerify =
    user?.role === 'warden' &&
    visit.status === 'completed' &&
    !visit.isVerified;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Visit Details" showBack />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Status Header */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + '12', borderColor: statusColor }]}>
          <Badge
            label={visit.status === 'active' ? '● Active' : '✓ Completed'}
            color={statusColor}
          />
          {visit.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color={theme.colors.success} />
              <Text style={styles.verifiedText}>Warden Verified</Text>
            </View>
          )}
        </View>

        {/* Hostel Info */}
        <Card>
          <Text style={styles.sectionLabel}>Hostel Information</Text>
          <InfoRow label="Hostel Name" value={visit.hostel?.name} icon="business-outline" />
          <InfoRow
            label="Type"
            value={visit.hostel?.type === 'boys' ? 'Boys Hostel' : 'Girls Hostel'}
            icon="home-outline"
          />
          <InfoRow label="Location" value={visit.hostel?.location} icon="location-outline" />
        </Card>

        {/* Visit Info */}
        <Card>
          <Text style={styles.sectionLabel}>Visit Information</Text>
          <InfoRow label="Purpose" value={getPurposeLabel(visit.purpose)} icon="clipboard-outline" />
          {visit.purposeDetail && (
            <InfoRow label="Details" value={visit.purposeDetail} icon="document-text-outline" />
          )}
          <InfoRow label="Check-in" value={formatDateTime(visit.checkIn)} icon="log-in-outline" />
          <InfoRow label="Check-out" value={formatDateTime(visit.checkOut)} icon="log-out-outline" />
          <InfoRow
            label="Duration"
            value={visit.duration ? formatDuration(visit.duration) : '—'}
            icon="hourglass-outline"
          />
        </Card>

        {/* Faculty Info */}
        {visit.faculty && (
          <Card>
            <Text style={styles.sectionLabel}>Faculty Information</Text>
            <InfoRow label="Name" value={visit.faculty.name} icon="person-outline" />
            <InfoRow label="Email" value={visit.faculty.email} icon="mail-outline" />
            <InfoRow label="Department" value={visit.faculty.department} icon="school-outline" />
          </Card>
        )}

        {/* Remarks */}
        {(visit.facultyRemarks || visit.wardenRemarks) && (
          <Card>
            <Text style={styles.sectionLabel}>Remarks</Text>
            {visit.facultyRemarks && (
              <>
                <Text style={styles.remarkLabel}>Faculty Remarks</Text>
                <Text style={styles.remarkText}>{visit.facultyRemarks}</Text>
              </>
            )}
            {visit.wardenRemarks && (
              <>
                {visit.facultyRemarks && <Divider />}
                <Text style={styles.remarkLabel}>Warden Remarks</Text>
                <Text style={styles.remarkText}>{visit.wardenRemarks}</Text>
              </>
            )}
          </Card>
        )}

        {/* View Forms Button - for admin/warden on completed visits */}
        {visit.status === 'completed' && (user?.role === 'admin' || user?.role === 'warden') && (
          <Card>
            <Text style={styles.sectionLabel}>Submitted Forms</Text>
            <Text style={styles.verifyHint}>
              View the Anti-Ragging and Mess Feedback forms submitted by the faculty.
            </Text>
            <Button
              title="View Forms"
              onPress={() => navigation.navigate('FormSelection', {
                visitId: visit._id || visit.id,
                visitData: {
                  id: visit._id || visit.id,
                  hostel: visit.hostel,
                  faculty: visit.faculty,
                  purpose: visit.purpose,
                  checkIn: visit.checkIn,
                  checkOut: visit.checkOut,
                  duration: visit.duration,
                },
                readOnly: true,
              })}
              variant="outline"
              icon="document-text-outline"
            />
          </Card>
        )}

        {/* Warden Verify Action */}
        {canVerify && (
          <Card style={{ borderWidth: 1.5, borderColor: theme.colors.success }}>
            <Text style={styles.sectionLabel}>Verify Visit</Text>
            <Text style={styles.verifyHint}>
              As warden, you can verify and add remarks to this completed visit.
            </Text>
            {showRemarkInput ? (
              <>
                <InputField
                  label="Add Warden Remarks (Optional)"
                  value={wardenRemark}
                  onChangeText={setWardenRemark}
                  placeholder="Add your observations..."
                  multiline
                  numberOfLines={3}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    title="Verify Visit"
                    onPress={handleVerify}
                    loading={verifying}
                    variant="primary"
                    style={{ flex: 1 }}
                    icon="shield-checkmark-outline"
                  />
                  <Button
                    title="Cancel"
                    onPress={() => setShowRemarkInput(false)}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <Button
                title="Mark as Verified"
                onPress={() => setShowRemarkInput(true)}
                variant="primary"
                icon="shield-checkmark-outline"
              />
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
    fontWeight: theme.fontWeight.semiBold,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  remarkLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  remarkText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  verifyHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 19,
  },
});
