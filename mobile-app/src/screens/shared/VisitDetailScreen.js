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
import { formService } from '../../services/formService';
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
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [wardenRemark, setWardenRemark] = useState('');

  useEffect(() => { loadVisit(); }, []);

  const loadVisit = async () => {
    try {
      const res = await visitService.getVisitById(visitId);
      if (res.success) {
        setVisit(res.data);
        try {
          const formRes = await formService.getForms(visitId);
          if (formRes.success && formRes.data?.forms) {
            setForms(formRes.data.forms);
          }
        } catch (fErr) {
          console.warn('[VisitDetailScreen] Could not load forms:', fErr);
        }
      }
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

  const visitDateObj = visit.checkIn
    ? new Date(visit.checkIn)
    : visit.check_in
    ? new Date(visit.check_in)
    : visit.visitDate
    ? new Date(visit.visitDate + 'T00:00:00Z')
    : null;

  const visitDateStr = visitDateObj
    ? visitDateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

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
          <InfoRow label="Visit Date" value={visitDateStr} icon="calendar-outline" />
          <InfoRow label="Purpose" value={getPurposeLabel(visit.purpose)} icon="clipboard-outline" />
          {visit.purposeDetail && (
            <InfoRow label="Details" value={visit.purposeDetail} icon="document-text-outline" />
          )}
          <InfoRow label="Check-in" value={formatDateTime(visit.checkIn || visit.check_in)} icon="log-in-outline" />
          <InfoRow label="Check-out" value={formatDateTime(visit.checkOut || visit.check_out)} icon="log-out-outline" />
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

        {/* Render Submitted Forms Detailed Sections */}
        {forms.map((f, idx) => {
          const type = f.formType || f.form_type;
          const isAnti = type === 'anti_ragging';
          const title = isAnti ? 'Anti-Ragging Form Details' : 'Mess Feedback Form Details';
          const icon = isAnti ? 'shield-checkmark-outline' : 'restaurant-outline';
          const data = f.data || {};

          return (
            <Card key={f._id || f.id || String(idx)} style={{ borderWidth: 1, borderColor: theme.colors.primary + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionLabel, { marginBottom: 0, color: theme.colors.primary }]}>{title}</Text>
              </View>

              {isAnti ? (
                <>
                  <InfoRow label="Discipline Status" value={data.discipline_status || data.disciplineStatus} icon="ribbon-outline" />
                  <InfoRow label="Cleanliness Status" value={data.cleanliness_status || data.cleanlinessStatus} icon="sparkles-outline" />
                  <InfoRow label="Overall Environment" value={data.environment_status || data.environmentStatus} icon="leaf-outline" />
                  <InfoRow label="Senior Interaction" value={data.senior_interaction || data.seniorInteraction} icon="people-outline" />
                  <InfoRow label="Fresher Interaction" value={data.fresher_interaction || data.fresherInteraction} icon="person-add-outline" />
                  {data.antiragging_suggestions || data.antiRaggingSuggestions ? (
                    <InfoRow label="Anti-Ragging Suggestions" value={data.antiragging_suggestions || data.antiRaggingSuggestions} icon="chatbox-ellipses-outline" />
                  ) : null}
                  {data.other_suggestions || data.otherSuggestions ? (
                    <InfoRow label="Other Observations" value={data.other_suggestions || data.otherSuggestions} icon="chatbubble-outline" />
                  ) : null}
                </>
              ) : (
                <>
                  <InfoRow label="Meal Type" value={data.meal_type || data.mealType} icon="fast-food-outline" />
                  {data.menu_items || data.menuItems ? (
                    <InfoRow label="Menu Items" value={data.menu_items || data.menuItems} icon="list-outline" />
                  ) : null}
                  <InfoRow label="Tasted Food" value={data.tasted_food || data.tastedFood} icon="restaurant-outline" />
                  <InfoRow label="Dining Hall Clean" value={data.cleanliness} icon="sparkles-outline" />
                  <InfoRow label="Plates/Spoons Clean" value={data.plates_clean || data.platesClean} icon="checkmark-done-outline" />
                  <InfoRow label="Food Served Hot" value={data.food_hot || data.foodHot} icon="flame-outline" />
                  {data.food_remarks || data.foodRemarks ? (
                    <InfoRow label="Food Remarks" value={data.food_remarks || data.foodRemarks} icon="chatbox-text-outline" />
                  ) : null}
                  <InfoRow label="Overall Feedback" value={data.overall_feedback || data.overallFeedback} icon="thumbs-up-outline" />
                  {data.improvement_suggestions || data.improvementSuggestions ? (
                    <InfoRow label="Improvement Areas" value={data.improvement_suggestions || data.improvementSuggestions} icon="trending-up-outline" />
                  ) : null}
                </>
              )}
            </Card>
          );
        })}

        {/* View / Download Forms Button */}
        {(user?.role === 'admin' || user?.role === 'warden' || user?.role === 'faculty') && (
          <Card>
            <Text style={styles.sectionLabel}>Forms & Export</Text>
            <Text style={styles.verifyHint}>
              View, edit, or download PDF / Word documents for this visit.
            </Text>
            <Button
              title="Open Forms & Export (PDF / Word)"
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
                readOnly: user?.role !== 'faculty' || visit.status === 'completed',
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
