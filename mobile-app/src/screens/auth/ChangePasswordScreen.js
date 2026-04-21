import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import AppHeader from '../../components/common/AppHeader';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import { theme } from '../../utils/theme';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { logout, updateUser } = useAuth();
  const isForced = route.params?.forced;

  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.current) errs.current = 'Current password required';
    if (!form.newPass) errs.newPass = 'New password required';
    else if (form.newPass.length < 8) errs.newPass = 'Minimum 8 characters';
    if (form.newPass !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authService.changePassword(form.current, form.newPass);
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Password Changed', text2: 'Please login again.' });
        updateUser({ mustChangePassword: false });
        setTimeout(() => {
          if (isForced) logout();
          else navigation.goBack();
        }, 1500);
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Change Password"
        subtitle={isForced ? 'Required on first login' : undefined}
        showBack={!isForced}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isForced && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                You must change your password before continuing.
              </Text>
            </View>
          )}

          <InputField
            label="Current Password"
            value={form.current}
            onChangeText={(v) => set('current', v)}
            secureTextEntry
            icon="lock-closed-outline"
            error={errors.current}
            required
          />
          <InputField
            label="New Password"
            value={form.newPass}
            onChangeText={(v) => set('newPass', v)}
            secureTextEntry
            icon="lock-open-outline"
            error={errors.newPass}
            required
          />
          <InputField
            label="Confirm New Password"
            value={form.confirm}
            onChangeText={(v) => set('confirm', v)}
            secureTextEntry
            icon="checkmark-circle-outline"
            error={errors.confirm}
            required
          />

          <View style={styles.hint}>
            <Text style={styles.hintText}>Password must be at least 8 characters long.</Text>
          </View>

          <Button
            title="Update Password"
            onPress={handleSubmit}
            loading={loading}
            icon="shield-checkmark-outline"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20 },
  notice: {
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  noticeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    fontWeight: theme.fontWeight.medium,
  },
  hint: {
    backgroundColor: theme.colors.infoLight,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    marginBottom: 16,
  },
  hintText: { fontSize: theme.fontSize.xs, color: theme.colors.info },
});
