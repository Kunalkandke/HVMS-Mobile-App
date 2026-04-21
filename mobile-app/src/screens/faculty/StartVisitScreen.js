import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import SelectPicker from '../../components/forms/SelectPicker';
import { hostelService } from '../../services/hostelService';
import { visitService } from '../../services/visitService';
import { theme } from '../../utils/theme';
import { PURPOSE_OPTIONS } from '../../utils/helpers';

export default function StartVisitScreen() {
  const navigation = useNavigation();

  const [hostels, setHostels] = useState([]);
  const [hostelOptions, setHostelOptions] = useState([]);
  const [form, setForm] = useState({
    hostelId: '',
    purpose: '',
    purposeDetail: '',
    facultyRemarks: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingHostels, setLoadingHostels] = useState(true);

  useEffect(() => {
    loadHostels();
  }, []);

  const loadHostels = async () => {
    try {
      const res = await hostelService.getAllHostels();
      if (res.success) {
        setHostels(res.data);
        setHostelOptions(res.data.map((h) => ({
          label: `${h.name} (${h.type === 'boys' ? 'Boys' : 'Girls'})`,
          value: h._id || h.id,
        })));
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load hostels' });
    } finally {
      setLoadingHostels(false);
    }
  };

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.hostelId) errs.hostelId = 'Please select a hostel';
    if (!form.purpose) errs.purpose = 'Please select a purpose';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleStart = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await visitService.startVisit({
        hostelId: form.hostelId,
        purpose: form.purpose,
        purposeDetail: form.purposeDetail || undefined,
        facultyRemarks: form.facultyRemarks || undefined,
      });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Visit Started!', text2: `Checked in to ${res.data.hostel?.name}` });
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not start visit' });
    } finally {
      setLoading(false);
    }
  };

  const selectedHostel = hostels.find((h) => (h._id || h.id) === form.hostelId);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Start Visit" subtitle="Check in to a hostel" showBack />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>Check-in Instructions</Text>
            <Text style={styles.infoText}>
              Select the hostel and purpose for your visit. A warden will be notified upon check-out.
            </Text>
          </View>

          <SelectPicker
            label="Select Hostel"
            value={form.hostelId}
            onSelect={(v) => set('hostelId', v)}
            options={hostelOptions}
            placeholder={loadingHostels ? 'Loading hostels...' : 'Choose a hostel'}
            error={errors.hostelId}
            required
            disabled={loadingHostels}
          />

          {/* Hostel detail preview */}
          {selectedHostel && (
            <View style={styles.hostelPreview}>
              <Text style={styles.hostelPreviewName}>{selectedHostel.name}</Text>
              <Text style={styles.hostelPreviewMeta}>
                {selectedHostel.type === 'boys' ? 'Boys Hostel' : 'Girls Hostel'} •{' '}
                {selectedHostel.location}
                {selectedHostel.capacity ? ` • Capacity: ${selectedHostel.capacity}` : ''}
              </Text>
            </View>
          )}

          <SelectPicker
            label="Purpose of Visit"
            value={form.purpose}
            onSelect={(v) => set('purpose', v)}
            options={PURPOSE_OPTIONS}
            placeholder="Select purpose"
            error={errors.purpose}
            required
          />

          <InputField
            label="Purpose Details (Optional)"
            value={form.purposeDetail}
            onChangeText={(v) => set('purposeDetail', v)}
            placeholder="Briefly describe your visit..."
            multiline
            numberOfLines={3}
            icon="clipboard-outline"
            maxLength={300}
          />

          <InputField
            label="Initial Remarks (Optional)"
            value={form.facultyRemarks}
            onChangeText={(v) => set('facultyRemarks', v)}
            placeholder="Any remarks before entering..."
            multiline
            numberOfLines={2}
            icon="chatbubble-outline"
            maxLength={200}
          />

          <View style={styles.timeNote}>
            <Text style={styles.timeNoteText}>
              ⏱  Check-in time will be recorded as:{' '}
              <Text style={styles.timeNoteBold}>{new Date().toLocaleTimeString()}</Text>
            </Text>
          </View>

          <Button
            title="Start Visit Now"
            onPress={handleStart}
            loading={loading}
            icon="play-circle-outline"
            size="lg"
            style={{ marginTop: 8 }}
          />
          <Button
            title="Cancel"
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
  infoBanner: {
    backgroundColor: theme.colors.infoLight,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  infoTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.info,
    marginBottom: 4,
  },
  infoText: { fontSize: theme.fontSize.sm, color: theme.colors.info + 'cc', lineHeight: 19 },
  hostelPreview: {
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  hostelPreviewName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  hostelPreviewMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  timeNote: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  timeNoteText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  timeNoteBold: { fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
});
