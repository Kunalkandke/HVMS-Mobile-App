import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Image, Animated,
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
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result.success) {
        if (result.user?.mustChangePassword) {
          navigation.navigate('ChangePassword', { forced: true });
        }
        // AuthContext → RootNavigator will auto-navigate to Main
      } else {
        Toast.show({ type: 'error', text1: 'Login Failed', text2: result.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.primaryLight, theme.colors.secondary]}
      style={styles.gradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="business" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.appName}>HVMS</Text>
            <Text style={styles.appTagline}>Hostel Visit Management System</Text>
            <Text style={styles.appCollege}>Engineering College Portal</Text>
          </View>

          {/* Login Card */}
          <View style={[styles.card, { marginBottom: 24 }]}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            <InputField
              label="Email Address"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
              placeholder="your@email.com"
              keyboardType="email-address"
              icon="mail-outline"
              error={errors.email}
              required
              autoCapitalize="none"
            />

            <InputField
              label="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              placeholder="Enter your password"
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
              required
            />

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
              <Text style={styles.roleInfoTitle}>Supported Roles</Text>
              <View style={styles.roleChips}>
                {['Admin', 'Faculty', 'Warden'].map((role) => (
                  <View key={role} style={styles.roleChip}>
                    <Text style={styles.roleChipText}>{role}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.footer}>
              Credentials are managed by your system administrator.
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
  brand: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  appCollege: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
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
    marginBottom: 24,
  },
  loginBtn: { marginTop: 6 },
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
