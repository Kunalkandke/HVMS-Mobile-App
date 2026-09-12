import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { hostelService } from '../../services/hostelService';
import { userService } from '../../services/userService';
import { theme } from '../../utils/theme';
import { AppHeader } from '../../components/common/AppHeader';
import { InputField } from '../../components/common/InputField';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/forms/SelectPicker';

const TYPE_OPTIONS = [
  { label: 'Boys Hostel', value: 'boys' },
  { label: 'Girls Hostel', value: 'girls' },
];

export default function CreateHostelScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const hostel = route.params?.hostel;
  const editMode = route.params?.editMode === true;

  const [form, setForm] = useState({
    name: hostel?.name || '',
    type: hostel?.type || 'boys',
    capacity: hostel?.capacity?.toString() || '',
    location: hostel?.location || '',
    wardenId: hostel?.warden?._id || '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [wardens, setWardens] = useState([]);

  useEffect(() => {
    userService.getAllUsers({ role: 'warden', limit: 10000 })
      .then(res => { if (res.success) setWardens(res.data.users || []); })
      .catch(() => {});
  }, []);

  const wardenOptions = [
    { label: 'No warden assigned', value: '' },
    ...wardens.map(w => ({ label: `${w.name} (${w.email})`, value: w._id })),
  ];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Hostel name is required';
    if (!form.capacity || isNaN(Number(form.capacity)) || Number(form.capacity) < 1)
      e.capacity = 'Valid capacity is required';
    if (!form.location.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        capacity: Number(form.capacity),
        location: form.location.trim(),
      };

      let res;
      if (editMode) {
        res = await hostelService.updateHostel(hostel._id, payload);
      } else {
        res = await hostelService.createHostel(payload);
      }

      if (res.success) {
        // Assign warden if selected
        if (form.wardenId && (!editMode || form.wardenId !== hostel?.warden?._id)) {
          const hostelId = editMode ? hostel._id : res.data._id;
          await hostelService.assignWarden(hostelId, form.wardenId).catch(() => {});
        }
        Toast.show({
          type: 'success',
          text1: editMode ? 'Hostel Updated' : 'Hostel Created',
          text2: form.name.trim(),
        });
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: null }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={editMode ? 'Edit Hostel' : 'Create Hostel'}
        subtitle={editMode ? 'Update hostel details' : 'Register a new hostel'}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hostel Information</Text>

            <InputField
              label="Hostel Name *"
              value={form.name}
              onChangeText={set('name')}
              placeholder="e.g. Cauvery Boys Hostel"
              error={errors.name}
              icon="business-outline"
            />

            <View style={styles.field}>
              <Text style={styles.label}>Hostel Type *</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    label={opt.label}
                    onPress={() => set('type')(opt.value)}
                    variant={form.type === opt.value ? 'primary' : 'outline'}
                    style={styles.typeBtn}
                    icon={opt.value === 'boys' ? 'man-outline' : 'woman-outline'}
                    size="sm"
                  />
                ))}
              </View>
            </View>

            <InputField
              label="Capacity *"
              value={form.capacity}
              onChangeText={set('capacity')}
              placeholder="e.g. 200"
              error={errors.capacity}
              icon="people-outline"
              keyboardType="number-pad"
            />
            <InputField
              label="Location / Block *"
              value={form.location}
              onChangeText={set('location')}
              placeholder="e.g. Block A, North Campus"
              error={errors.location}
              icon="location-outline"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Warden Assignment</Text>
            <Text style={styles.sectionSubtitle}>
              Assign a warden to this hostel. Wardens will be notified of completed visits.
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Warden</Text>
              <SelectPicker
                value={form.wardenId}
                onChange={set('wardenId')}
                options={wardenOptions}
                placeholder="Select warden"
              />
            </View>
          </View>

          <Button
            label={editMode ? 'Save Changes' : 'Create Hostel'}
            onPress={handleSubmit}
            loading={loading}
            icon={editMode ? 'save-outline' : 'add-circle-outline'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg,
    padding: 18, marginBottom: 14, ...theme.shadow.sm,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  sectionSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 14, lineHeight: 17 },
  field: { marginBottom: 14 },
  label: {
    fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1 },
});
