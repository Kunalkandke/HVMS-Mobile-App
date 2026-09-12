import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { formService } from '../../services/formService';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../utils/theme';
import { formatDateTime, formatDuration, getPurposeLabel } from '../../utils/helpers';
import AppHeader from '../../components/common/AppHeader';

const FORMS = [
  {
    type: 'anti_ragging',
    title: 'Anti-Ragging Committee',
    subtitle: 'Hostel Visit Report',
    icon: 'shield-checkmark-outline',
    color: '#1565c0',
    description: 'Record discipline, cleanliness, environment status and ragging-related observations.',
  },
  {
    type: 'mess_feedback',
    title: 'Mess Food Quality Inspection',
    subtitle: 'Feedback Form for Daily Inspection',
    icon: 'restaurant-outline',
    color: '#2e7d32',
    description: 'Record meal quality, cleanliness, food taste and mess-related feedback.',
  },
];

export default function FormSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { visitId, visitData: passedVisitData, readOnly: passedReadOnly } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [visitData, setVisitData] = useState(passedVisitData || null);
  const [submittedForms, setSubmittedForms] = useState([]);
  const readOnly = passedReadOnly || (user?.role !== 'faculty');

  useFocusEffect(
    React.useCallback(() => {
      loadForms();
    }, [visitId])
  );

  const loadForms = async () => {
    try {
      const res = await formService.getForms(visitId);
      if (res.success) {
        if (!passedVisitData) setVisitData(res.data.visit);
        setSubmittedForms(res.data.forms || []);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to load forms' });
    } finally {
      setLoading(false);
    }
  };

  // Check both camelCase (formType) and snake_case (form_type) due to API normalization
  const isSubmitted = (type) => submittedForms.some(f => (f.formType || f.form_type) === type);

  const getSubmittedAt = (type) => {
    const form = submittedForms.find(f => (f.formType || f.form_type) === type);
    return form?.submittedAt || form?.submitted_at || null;
  };

  const handleFormPress = (type) => {
    const existingForm = submittedForms.find(f => (f.formType || f.form_type) === type);
    navigation.navigate('FormFill', {
      visitId,
      formType: type,
      visitData,
      existingData: existingForm?.data || null,
      readOnly,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Visit Forms" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading forms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Visit Forms"
        subtitle={readOnly ? 'View Only' : 'Fill & Submit'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Visit Summary */}
        {visitData && (
          <View style={styles.visitCard}>
            <View style={styles.visitCardTop}>
              <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.hostelName}>{visitData.hostel?.name}</Text>
              <View style={[styles.roleTag, { backgroundColor: readOnly ? theme.colors.textMuted + '20' : theme.colors.primary + '20' }]}>
                <Text style={[styles.roleTagText, { color: readOnly ? theme.colors.textMuted : theme.colors.primary }]}>
                  {readOnly ? (user?.role === 'warden' ? 'Warden View' : 'Admin View') : 'Faculty'}
                </Text>
              </View>
            </View>
            <View style={styles.visitMeta}>
              <MetaRow icon="flag-outline" text={getPurposeLabel(visitData.purpose)} />
              <MetaRow icon="log-in-outline" text={formatDateTime(visitData.checkIn)} />
              {visitData.duration && (
                <MetaRow icon="time-outline" text={formatDuration(visitData.duration)} />
              )}
              <MetaRow icon="person-outline" text={visitData.faculty?.name} />
            </View>
          </View>
        )}

        {/* Instruction */}
        {!readOnly && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
            <Text style={styles.infoText}>
              Select a form to fill. Forms are auto-filled with visit details. You can save and re-edit anytime.
            </Text>
          </View>
        )}

        {/* Form Cards */}
        <Text style={styles.sectionTitle}>Available Forms</Text>
        {FORMS.map(form => {
          const submitted = isSubmitted(form.type);
          const submittedAt = getSubmittedAt(form.type);
          return (
            <TouchableOpacity
              key={form.type}
              style={[styles.formCard, submitted && styles.formCardSubmitted]}
              onPress={() => handleFormPress(form.type)}
              activeOpacity={0.82}
            >
              {/* Submitted badge */}
              {submitted && (
                <View style={styles.submittedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                  <Text style={styles.submittedBadgeText}>Submitted</Text>
                </View>
              )}

              <View style={styles.formCardContent}>
                <View style={[styles.formIcon, { backgroundColor: form.color + '15' }]}>
                  <Ionicons name={form.icon} size={28} color={form.color} />
                </View>
                <View style={styles.formInfo}>
                  <Text style={styles.formTitle}>{form.title}</Text>
                  <Text style={styles.formSubtitle}>{form.subtitle}</Text>
                  <Text style={styles.formDesc}>{form.description}</Text>
                  {submitted && submittedAt && (
                    <Text style={styles.submittedTime}>
                      Saved: {formatDateTime(submittedAt)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.formCardFooter}>
                <View style={[styles.actionChip, { backgroundColor: form.color + '12' }]}>
                  <Ionicons
                    name={
                      readOnly
                        ? 'eye-outline'
                        : submitted
                        ? 'create-outline'
                        : 'document-text-outline'
                    }
                    size={14}
                    color={form.color}
                  />
                  <Text style={[styles.actionChipText, { color: form.color }]}>
                    {readOnly ? 'View Form' : submitted ? 'Edit Form' : 'Fill Form'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Summary for admin/warden when no forms submitted */}
        {readOnly && submittedForms.length === 0 && (
          <View style={styles.emptyForms}>
            <Ionicons name="document-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyFormsText}>No forms submitted for this visit yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, text }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={13} color={theme.colors.textMuted} />
      <Text style={styles.metaText}>{text || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: theme.colors.textSecondary, fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 40 },
  visitCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    ...theme.shadow.sm,
  },
  visitCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  hostelName: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  roleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleTagText: { fontSize: 11, fontWeight: '600' },
  visitMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: theme.colors.textSecondary },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.colors.infoLight,
    borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.info + '30',
  },
  infoText: { flex: 1, fontSize: 12, color: theme.colors.info, lineHeight: 18 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12, overflow: 'hidden', ...theme.shadow.sm,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  formCardSubmitted: { borderColor: theme.colors.success + '40' },
  submittedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 12, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.success + '20',
  },
  submittedBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.success },
  formCardContent: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 14 },
  formIcon: {
    width: 54, height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  formInfo: { flex: 1 },
  formTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  formSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  formDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, lineHeight: 17 },
  submittedTime: { fontSize: 11, color: theme.colors.success, marginTop: 4, fontWeight: '500' },
  formCardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  actionChipText: { fontSize: 12, fontWeight: '700' },
  emptyForms: { alignItems: 'center', paddingVertical: 40 },
  emptyFormsText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 10 },
});
