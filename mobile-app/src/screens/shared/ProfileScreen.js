import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { Card, Divider } from '../../components/common/UIComponents';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import { theme, getRoleColor } from '../../utils/theme';
import { getInitials, getRoleLabel } from '../../utils/helpers';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || '',
  });
  const [saving, setSaving] = useState(false);
  const roleColor = getRoleColor(user?.role);

  const handleSave = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    setSaving(true);
    try {
      const res = await authService.updateProfile(form);
      if (res.success) {
        updateUser(res.data);
        setEditing(false);
        Toast.show({ type: 'success', text1: 'Profile Updated' });
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res.message });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        style={styles.header}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { borderColor: roleColor }]}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Text style={styles.roleBadgeText}>{getRoleLabel(user?.role)}</Text>
          </View>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.department ? <Text style={styles.userDept}>{user.department}</Text> : null}
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Profile Information</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="pencil-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <InputField
                label="Full Name"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                icon="person-outline"
                required
              />
              <InputField
                label="Phone Number"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                icon="call-outline"
                keyboardType="phone-pad"
              />
              {user?.role !== 'warden' && (
                <InputField
                  label="Department"
                  value={form.department}
                  onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
                  icon="school-outline"
                />
              )}
              <View style={styles.editActions}>
                <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
                <Button
                  title="Cancel"
                  onPress={() => {
                    setEditing(false);
                    setForm({ name: user?.name || '', phone: user?.phone || '', department: user?.department || '' });
                  }}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <>
              <ProfileRow icon="person-outline" label="Name" value={user?.name} />
              <ProfileRow icon="mail-outline" label="Email" value={user?.email} />
              <ProfileRow icon="call-outline" label="Phone" value={user?.phone || '—'} />
              {user?.role !== 'warden' && (
                <ProfileRow icon="school-outline" label="Department" value={user?.department || '—'} />
              )}
              {user?.assignedHostel && (
                <ProfileRow icon="business-outline" label="Assigned Hostel" value={user.assignedHostel?.name || '—'} />
              )}
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Account</Text>
          <Divider style={{ marginVertical: 8 }} />
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.menuLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          icon="log-out-outline"
          style={{ marginTop: 8 }}
        />
        <Text style={styles.version}>HVMS v2.0 • {getRoleLabel(user?.role)} Portal</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <View style={styles.profileRow}>
      <Ionicons name={icon} size={16} color={theme.colors.textMuted} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={styles.profileRowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  avatarWrap: { alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3,
  },
  avatarText: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: '#fff' },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: theme.borderRadius.full, marginTop: -8,
  },
  roleBadgeText: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff' },
  userName: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: '#fff', marginTop: 8 },
  userEmail: { fontSize: theme.fontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  userDept: { fontSize: theme.fontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  content: { padding: 16, paddingBottom: 32 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  profileRowLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  profileRowValue: { fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: theme.fontWeight.medium, marginTop: 1 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  menuLabel: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.textPrimary },
  version: { textAlign: 'center', fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 16 },
});
