import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import { theme } from '../../utils/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Login ID / Faculty ID / Email is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        if (result.user?.mustChangePassword) {
          navigation.navigate('ChangePassword', { forced: true });
        }
      } else {
        Toast.show({ type: 'error', text1: 'Login Failed', text2: result.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.primary, '#1a237e', theme.colors.secondary]}
      style={styles.gradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 40, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Brand Header */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="business" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.appName}>HVMS</Text>
            <Text style={styles.appTagline}>Hostel Visit Management System</Text>
            <Text style={styles.appCollege}>Engineering College Portal</Text>
          </View>

          {/* Main Login Card */}
          <View style={[styles.card, { marginBottom: 24 }]}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to access your dashboard</Text>

            {/* Login Identifier Field */}
            <InputField
              label="Login ID / Faculty Code / Email"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
              placeholder="e.g. FAC001, 9876543210, or email"
              icon="person-outline"
              error={errors.email}
              required
              autoCapitalize="none"
            />

            {/* Password Field */}
            <InputField
              label="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              placeholder="Enter password or mobile no."
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
              required
            />

            {/* Faculty Login Guidance Banner */}
            <View style={styles.facultyHintBox}>
              <Ionicons name="information-circle" size={20} color={theme.colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.facultyHintTitle}>Faculty Sign In Instructions</Text>
                <Text style={styles.facultyHintTxt}>
                  • <Text style={{ fontWeight: '700' }}>Login ID</Text>: Your Faculty ID (e.g. <Text style={{ fontWeight: '700', color: theme.colors.primary }}>FAC001</Text>) or 10-digit mobile number.
                </Text>
                <Text style={styles.facultyHintTxt}>
                  • <Text style={{ fontWeight: '700' }}>Initial Password</Text>: Your 10-digit mobile number.
                </Text>
              </View>
            </View>

            {/* Login Button */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              icon="log-in-outline"
              iconPosition="right"
              style={styles.loginBtn}
            />

            {/* Role Info */}
            <View style={styles.roleInfo}>
              <Text style={styles.roleInfoTitle}>Authorized Roles</Text>
              <View style={styles.roleChips}>
                {['Admin', 'Faculty', 'Warden'].map((role) => (
                  <View key={role} style={styles.roleChip}>
                    <Text style={styles.roleChipText}>{role}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.footer}>
              Faculty credentials are set during schedule import. Contact Admin for login help.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...theme.shadow.lg,
  },
  appName: {
    fontSize: 34,
    fontWeight: theme.fontWeight.extraBold,
    color: '#fff',
    letterSpacing: 4,
  },
  appTagline: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 4,
    letterSpacing: 0.3,
    fontWeight: '500',
  },
  appCollege: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    ...theme.shadow.lg,
  },
  cardTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  facultyHintBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary + '30',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 18,
  },
  facultyHintTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  facultyHintTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  loginBtn: { marginTop: 4 },
  roleInfo: {
    marginTop: 20,
    padding: 14,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md,
  },
  roleInfoTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  roleChips: { flexDirection: 'row', gap: 8 },
  roleChip: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  roleChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semiBold,
  },
  footer: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
