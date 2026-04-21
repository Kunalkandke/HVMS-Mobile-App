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
import { userService } from '../../services/userService';
import { hostelService } from '../../services/hostelService';
import { theme } from '../../utils/theme';
import { ROLE_OPTIONS } from '../../utils/helpers';

export default function CreateUserScreen() {
  const navigation = useNavigation();

  const [form, setForm] = useState({
    name: '', email: '', role: '', department: '', phone: '', assignedHostel: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState([]);

  useEffect(() => {
    hostelService.getAllHostels()
      .then((r) => r.success && setHostels(r.data.map((h) => ({ label: h.name, value: h._id || h.id }))))
      .catch(() => {});
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';
    if (!form.role) errs.role = 'Role is required';
    if (form.role === 'warden' && !form.assignedHostel) errs.assignedHostel = 'Assign a hostel for warden';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        phone: form.phone || undefined,
        department: form.role !== 'warden' ? (form.department || undefined) : undefined,
        assignedHostel: form.role === 'warden' ? form.assignedHostel : undefined,
      };
      const res = await userService.createUser(payload);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'User Created',
          text2: res.data?.emailSent ? 'Welcome email sent.' : `Temp password: ${res.data?.tempPassword}`,
        });
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Create User" subtitle="Add a new system user" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              A temporary password will be generated and sent to the user's email.
            </Text>
          </View>

          <InputField label="Full Name" value={form.name} onChangeText={(v) => set('name', v)}
            icon="person-outline" required error={errors.name} autoCapitalize="words" />
          <InputField label="Email Address" value={form.email} onChangeText={(v) => set('email', v)}
            icon="mail-outline" required error={errors.email} keyboardType="email-address" />
          <InputField label="Phone Number" value={form.phone} onChangeText={(v) => set('phone', v)}
            icon="call-outline" keyboardType="phone-pad" />

          <SelectPicker label="Role" value={form.role} onSelect={(v) => set('role', v)}
            options={ROLE_OPTIONS} placeholder="Select role" required error={errors.role} />

          {form.role === 'warden' ? (
            <SelectPicker label="Assign Hostel" value={form.assignedHostel}
              onSelect={(v) => set('assignedHostel', v)}
              options={hostels} placeholder="Select hostel"
              required error={errors.assignedHostel} />
          ) : form.role === 'faculty' || form.role === 'admin' ? (
            <InputField label="Department" value={form.department}
              onChangeText={(v) => set('department', v)} icon="school-outline" />
          ) : null}

          <Button title="Create User" onPress={handleCreate} loading={loading}
            icon="person-add-outline" style={{ marginTop: 8 }} />
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="ghost" style={{ marginTop: 10 }} />
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
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  infoText: { fontSize: theme.fontSize.sm, color: theme.colors.info },
});
