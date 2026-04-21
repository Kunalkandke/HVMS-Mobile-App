import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import { Divider, InfoRow } from '../../components/common/UIComponents';
import { visitService } from '../../services/visitService';
import { theme } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel } from '../../utils/helpers';

export default function EndVisitScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visit } = route.params || {};

  const [remarks, setRemarks] = useState(visit?.facultyRemarks || '');
  const [loading, setLoading] = useState(false);

  if (!visit) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="End Visit" showBack />
        <View style={styles.errorState}>
          <Text style={styles.errorText}>No active visit found.</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const checkInTime = new Date(visit.checkIn);
  const currentDuration = Math.max(1, Math.round((new Date() - checkInTime) / 60000));

  const handleEndVisit = async () => {
    setLoading(true);
    try {
      const visitIdToEnd = visit._id || visit.id;
      const res = await visitService.endVisit(visitIdToEnd, remarks || undefined);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Visit Ended ✓',
          text2: `Duration: ${formatDuration(res.data.duration)}`,
        });

        // Use normalized response data (already has _id from api.js normalizeIds)
        const completedVisit = res.data;
        const visitIdForForms = completedVisit._id || completedVisit.id;

        // ── Navigate to Form Selection after ending visit ──────────────
        navigation.replace('FormSelection', {
          visitId: visitIdForForms,
          visitData: {
            id: visitIdForForms,
            hostel: completedVisit.hostel || visit.hostel,
            faculty: completedVisit.faculty || visit.faculty,
            purpose: completedVisit.purpose || visit.purpose,
            checkIn: completedVisit.checkIn || visit.checkIn,
            checkOut: completedVisit.checkOut,
            duration: completedVisit.duration,
            facultyRemarks: completedVisit.facultyRemarks || remarks,
          },
          readOnly: false,
        });
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not end visit' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="End Visit" subtitle="Check out of the hostel" showBack />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Active visit summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.summaryTitle}>Visit Currently Active</Text>
            </View>
            <Divider style={{ marginVertical: 12 }} />
            <InfoRow label="Hostel" value={visit.hostel?.name} icon="business-outline" />
            <InfoRow label="Type" value={visit.hostel?.type === 'boys' ? 'Boys Hostel' : 'Girls Hostel'} icon="home-outline" />
            <InfoRow label="Purpose" value={getPurposeLabel(visit.purpose)} icon="clipboard-outline" />
            <InfoRow label="Check-in" value={formatDateTime(visit.checkIn)} icon="time-outline" />
            <View style={styles.durationRow}>
              <Ionicons name="hourglass-outline" size={16} color={theme.colors.warning} />
              <Text style={styles.durationLabel}>Duration so far</Text>
              <Text style={styles.durationValue}>{formatDuration(currentDuration)}</Text>
            </View>
          </View>

          <InputField
            label="Final Remarks (Optional)"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Add any remarks about this visit..."
            multiline
            numberOfLines={4}
            icon="chatbubble-ellipses-outline"
            maxLength={500}
          />

          {/* Form hint banner */}
          <View style={styles.formHintBanner}>
            <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.formHintText}>
              After ending, you'll be prompted to fill the <Text style={styles.formHintBold}>Anti-Ragging</Text> and <Text style={styles.formHintBold}>Mess Feedback</Text> forms for this visit.
            </Text>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.warningText}>
              Ending this visit will notify the hostel warden via email.
            </Text>
          </View>

          <Button
            title="End Visit & Fill Forms"
            onPress={handleEndVisit}
            loading={loading}
            variant="danger"
            icon="stop-circle-outline"
            size="lg"
            style={{ marginTop: 8 }}
          />
          <Button
            title="Continue Visit"
            onPress={() => navigation.goBack()}
            variant="ghost"
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, marginBottom: 16 },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
    ...theme.shadow.sm,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center' },
  pulseDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: theme.colors.success, marginRight: 8,
  },
  summaryTitle: {
    fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  durationRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 7, marginTop: 4,
  },
  durationLabel: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.warning, marginLeft: 8 },
  durationValue: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: theme.colors.warning },
  formHintBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.primary + '30',
  },
  formHintText: { flex: 1, fontSize: 13, color: theme.colors.primary, lineHeight: 19 },
  formHintBold: { fontWeight: '700' },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 16, gap: 8,
  },
  warningText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.warning, lineHeight: 19 },
});
