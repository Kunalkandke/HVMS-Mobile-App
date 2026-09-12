import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { Badge, EmptyState, LoadingSpinner } from '../../components/common/UIComponents';
import Button from '../../components/common/Button';
import { userService } from '../../services/userService';
import { theme, getRoleColor } from '../../utils/theme';
import { getRoleLabel, getInitials } from '../../utils/helpers';

const ROLE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Faculty', value: 'faculty' },
  { label: 'Warden', value: 'warden' },
  { label: 'Admin', value: 'admin' },
];

export default function ManageUsersScreen() {
  const navigation = useNavigation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ total: 0 });

  useFocusEffect(
    useCallback(() => { loadUsers(); }, [roleFilter])
  );

  const loadUsers = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await userService.getAllUsers({ role: roleFilter || undefined, limit: 50 });
      if (res.success) {
        setUsers(res.data.users || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load users' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleStatus = (user) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    Alert.alert(
      `${user.isActive ? 'Deactivate' : 'Activate'} User`,
      `Are you sure you want to ${action} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: user.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await userService.toggleUserStatus(user._id, !user.isActive);
              if (res.success) {
                Toast.show({ type: 'success', text1: `User ${action}d` });
                loadUsers();
              }
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (user) => {
    Alert.alert(
      'Reset Password',
      `Reset password for ${user.name}? A new password will be emailed to them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const res = await userService.resetPassword(user._id);
              if (res.success) Toast.show({ type: 'success', text1: 'Password Reset', text2: 'New password sent by email' });
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }) => {
    const roleColor = getRoleColor(item.role);
    const isImported = item.importSource === 'excel_import';
    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '18' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.userName}>{item.name}</Text>
              {isImported && (
                <View style={styles.importedTag}>
                  <Text style={styles.importedTagTxt}>Excel</Text>
                </View>
              )}
            </View>
            {/* Faculty code badge for imported faculty */}
            {item.facultyCode ? (
              <View style={styles.facultyCodeRow}>
                <Ionicons name="id-card-outline" size={12} color={theme.colors.primary} />
                <Text style={styles.facultyCode}>{item.facultyCode}</Text>
                {item.mustChangePassword && (
                  <View style={styles.pwdBadge}>
                    <Text style={styles.pwdBadgeTxt}>Pwd change required</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.userEmail}>{item.email || '— No email —'}</Text>
            )}
            <Text style={styles.userDept}>{item.department || item.assignedHostel?.name || ''}</Text>
            {item.phone ? <Text style={styles.userPhone}>📱 {item.phone}</Text> : null}
          </View>
          <View style={styles.userMeta}>
            <Badge label={getRoleLabel(item.role)} color={roleColor} size="sm" />
            <View style={[styles.statusDot, { backgroundColor: item.isActive ? theme.colors.success : theme.colors.error }]} />
          </View>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: item.isActive ? theme.colors.error : theme.colors.success }]}
            onPress={() => handleToggleStatus(item)}
          >
            <Ionicons
              name={item.isActive ? 'person-remove-outline' : 'person-add-outline'}
              size={14}
              color={item.isActive ? theme.colors.error : theme.colors.success}
            />
            <Text style={[styles.actionBtnText, { color: item.isActive ? theme.colors.error : theme.colors.success }]}>
              {item.isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.colors.warning }]}
            onPress={() => handleResetPassword(item)}
          >
            <Ionicons name="key-outline" size={14} color={theme.colors.warning} />
            <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Reset Pwd</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Manage Users"
        subtitle={`${pagination.total || users.length} users`}
        rightIcon="person-add-outline"
        onRightPress={() => navigation.navigate('CreateUser')}
      />

      {/* Role Filter */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, roleFilter === f.value && styles.chipActive]}
            onPress={() => setRoleFilter(f.value)}
          >
            <Text style={[styles.chipText, roleFilter === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i._id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No users found"
              action={() => navigation.navigate('CreateUser')}
              actionLabel="Create User"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },
  listContent: { padding: 16, paddingBottom: 32 },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.sm,
  },
  userHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold },
  userInfo: { flex: 1 },
  userName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  userEmail: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 1 },
  userDept:  { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  userPhone: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  userMeta: { alignItems: 'flex-end', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  importedTag: { backgroundColor: theme.colors.secondary + '20', borderRadius: theme.borderRadius.full, paddingHorizontal: 6, paddingVertical: 1 },
  importedTagTxt: { fontSize: 10, fontWeight: theme.fontWeight.bold, color: theme.colors.secondary },
  facultyCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  facultyCode: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  pwdBadge: { backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.full, paddingHorizontal: 6, paddingVertical: 1 },
  pwdBadgeTxt: { fontSize: 10, color: theme.colors.warning, fontWeight: theme.fontWeight.semiBold },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },
});
