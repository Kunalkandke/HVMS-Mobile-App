/**
 * ManageUsersScreen — Redesigned with Faculty Panel
 *
 * Tab 1: Faculty Panel  — all faculty (Excel-imported) with unique FAC IDs, edit icons
 * Tab 2: All Users      — original manage-users view (All / Warden / Admin filter)
 *
 * Faculty Panel features:
 *  - Shows Faculty ID (FAC001), Name, Phone, Department
 *  - Edit icon (pencil) on each card → opens EditFacultyModal
 *  - Pull-to-refresh + search
 *  - Login credentials shown: "Login: FAC001 | Password: Mobile number"
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, TextInput, Modal, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { Badge, EmptyState, LoadingSpinner } from '../../components/common/UIComponents';
import { userService } from '../../services/userService';
import { hostelService } from '../../services/hostelService';
import { theme, getRoleColor } from '../../utils/theme';
import { getRoleLabel, getInitials } from '../../utils/helpers';

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'faculty', label: 'Faculty Panel', icon: 'id-card-outline' },
  { key: 'all',     label: 'All Users',     icon: 'people-outline'  },
];

const ROLE_FILTERS = [
  { label: 'All',     value: '' },
  { label: 'Warden',  value: 'warden' },
  { label: 'Admin',   value: 'admin' },
];

// ─── Edit Faculty Modal ───────────────────────────────────────────────────────
function EditFacultyModal({ faculty, visible, hostels, onClose, onSaved }) {
  const [name,       setName]       = useState(faculty?.name       || '');
  const [phone,      setPhone]      = useState(faculty?.phone      || '');
  const [email,      setEmail]      = useState(faculty?.email      || '');
  const [department, setDepartment] = useState(faculty?.department || '');
  const [hostelId,   setHostelId]   = useState(faculty?.assignedHostelId || null);
  const [saving,     setSaving]     = useState(false);

  // Sync fields when faculty prop changes (opening a different card)
  React.useEffect(() => {
    if (faculty) {
      setName(faculty.name || '');
      setPhone(faculty.phone || '');
      setEmail(faculty.email || '');
      setDepartment(faculty.department || '');
      setHostelId(faculty.assignedHostelId || null);
    }
  }, [faculty?.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    setSaving(true);
    try {
      const res = await userService.updateFacultyDetails(faculty.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        department: department.trim(),
        assignedHostelId: hostelId || null,
      });
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Faculty Updated', text2: res.message });
        onSaved(res.data);
        onClose();
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = () => {
    if (!phone.trim()) {
      Toast.show({ type: 'error', text1: 'No phone set', text2: 'Enter phone number first to reset password.' });
      return;
    }
    Alert.alert(
      'Reset Password',
      `Reset ${faculty?.name}'s password to their mobile number?\n\nNew password: ${phone.trim().replace(/\D/g, '')}\n\nThey will be required to change it on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await userService.updateFacultyDetails(faculty.id, {
                phone: phone.trim(),
                resetPasswordToPhone: true,
              });
              if (res.success) {
                Toast.show({ type: 'success', text1: 'Password Reset', text2: 'Password set to mobile number.' });
              }
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (!faculty) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={modal.container}>
          {/* Header */}
          <View style={modal.header}>
            <TouchableOpacity onPress={onClose} style={modal.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={modal.title}>Edit Faculty</Text>
              <Text style={modal.subtitle}>{faculty.facultyCode || faculty.faculty_code || '—'}</Text>
            </View>
            <TouchableOpacity style={modal.saveBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={modal.saveTxt}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Login info chip */}
          <View style={modal.credCard}>
            <Ionicons name="key-outline" size={14} color={theme.colors.primary} />
            <Text style={modal.credText}>
              Login: <Text style={{ fontWeight: '700' }}>{faculty.facultyCode || faculty.faculty_code || 'FAC???'}</Text>
              {'  '}|{'  '}
              Password: <Text style={{ fontWeight: '700' }}>Mobile number</Text>
            </Text>
          </View>

          <ScrollView contentContainerStyle={modal.scroll} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={modal.label}>Full Name *</Text>
            <TextInput
              style={modal.input}
              value={name}
              onChangeText={setName}
              placeholder="Faculty full name"
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Phone */}
            <Text style={modal.label}>Mobile Number (= Login Password)</Text>
            <TextInput
              style={modal.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={modal.hint}>⚠️ Changing mobile will NOT auto-reset their password. Use "Reset Password" below.</Text>

            {/* Email */}
            <Text style={modal.label}>Email (optional)</Text>
            <TextInput
              style={modal.input}
              value={email}
              onChangeText={setEmail}
              placeholder="faculty@college.edu"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Department */}
            <Text style={modal.label}>Department</Text>
            <TextInput
              style={modal.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g. Computer Science"
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Hostel Assignment */}
            <Text style={modal.label}>Assign to Hostel (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <TouchableOpacity
                style={[modal.hostelChip, !hostelId && modal.hostelChipActive]}
                onPress={() => setHostelId(null)}
              >
                <Text style={[modal.hostelChipTxt, !hostelId && modal.hostelChipTxtActive]}>None</Text>
              </TouchableOpacity>
              {hostels.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={[modal.hostelChip, hostelId === h.id && modal.hostelChipActive]}
                  onPress={() => setHostelId(h.id)}
                >
                  <Ionicons
                    name={h.type === 'girls' ? 'female' : 'male'}
                    size={12}
                    color={hostelId === h.id ? '#fff' : theme.colors.textSecondary}
                  />
                  <Text style={[modal.hostelChipTxt, hostelId === h.id && modal.hostelChipTxtActive]}>
                    {' '}{h.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Divider */}
            <View style={modal.divider} />

            {/* Reset Password button */}
            <TouchableOpacity style={modal.resetBtn} onPress={handleResetPassword} disabled={saving}>
              <Ionicons name="refresh-outline" size={16} color={theme.colors.warning} />
              <Text style={modal.resetTxt}>Reset Password to Mobile Number</Text>
            </TouchableOpacity>
            <Text style={modal.hint} style={{ marginTop: 0, marginBottom: 20, color: theme.colors.textMuted, fontSize: 11, paddingHorizontal: 4 }}>
              This will set their password to the current mobile number above and ask them to change it on next login.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Faculty Card ─────────────────────────────────────────────────────────────
function FacultyCard({ item, onEdit, onToggleStatus }) {
  const isImported = item.importSource === 'excel_import' || item.import_source === 'excel_import';
  const facCode = item.facultyCode || item.faculty_code;
  const isActive = item.isActive !== undefined ? item.isActive : (item.is_active !== undefined ? item.is_active : true);
  const mustChangePwd = item.mustChangePassword !== undefined ? item.mustChangePassword : (item.must_change_password || false);

  return (
    <View style={styles.facultyCard}>
      {/* Top row */}
      <View style={styles.facultyCardHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.roleFaculty + '18' }]}>
          <Text style={[styles.avatarText, { color: theme.colors.roleFaculty }]}>
            {getInitials(item.name)}
          </Text>
        </View>

        <View style={styles.facultyInfo}>
          {/* Faculty ID + Excel badge */}
          <View style={styles.facultyIdRow}>
            {facCode ? (
              <View style={styles.facIdBadge}>
                <Ionicons name="id-card-outline" size={11} color="#fff" />
                <Text style={styles.facIdTxt}>{facCode}</Text>
              </View>
            ) : null}
            {isImported && (
              <View style={styles.excelBadge}>
                <Text style={styles.excelBadgeTxt}>Excel</Text>
              </View>
            )}
            {mustChangePwd && (
              <View style={styles.pwdWarnBadge}>
                <Text style={styles.pwdWarnTxt}>Pwd Required</Text>
              </View>
            )}
          </View>
          <Text style={styles.facultyName} numberOfLines={1}>{item.name}</Text>
          {item.phone ? (
            <Text style={styles.facultyPhone}>📱 {item.phone}</Text>
          ) : (
            <Text style={[styles.facultyPhone, { color: theme.colors.error }]}>⚠ No phone</Text>
          )}
          {item.department ? (
            <Text style={styles.facultyDept}>{item.department}</Text>
          ) : null}
          {item.hostels?.name ? (
            <Text style={styles.facultyHostel}>🏠 {item.hostels.name}</Text>
          ) : null}
        </View>

        {/* Right: status dot + edit button */}
        <View style={styles.facultyMeta}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? theme.colors.success : theme.colors.error }]} />
          <TouchableOpacity style={styles.editIconBtn} onPress={() => onEdit(item)}>
            <Ionicons name="pencil" size={15} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Login credentials info */}
      <View style={styles.credRow}>
        <Ionicons name="log-in-outline" size={12} color={theme.colors.textMuted} />
        <Text style={styles.credRowTxt}>
          Login: <Text style={{ fontWeight: '700', color: theme.colors.primary }}>{facCode || '—'}</Text>
          {item.phone ? (
            <>{'  '}·{'  '}Password: <Text style={{ fontWeight: '700' }}>Mobile number</Text></>
          ) : null}
        </Text>
      </View>

      {/* Visit assignment summary badges */}
      {item.stats && item.stats.total > 0 && (
        <View style={styles.statsRow}>
          <Text style={styles.statsLabel}>Visits:</Text>
          {item.stats.boys > 0 && (
            <View style={[styles.statChip, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="male" size={10} color="#1565c0" />
              <Text style={[styles.statChipTxt, { color: '#1565c0' }]}>{item.stats.boys} Boys</Text>
            </View>
          )}
          {item.stats.girls > 0 && (
            <View style={[styles.statChip, { backgroundColor: '#fce4ec' }]}>
              <Ionicons name="female" size={10} color="#c2185b" />
              <Text style={[styles.statChipTxt, { color: '#c2185b' }]}>{item.stats.girls} Girls</Text>
            </View>
          )}
          <Text style={styles.statTotalTxt}>({item.stats.total} total)</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.facultyActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: isActive ? theme.colors.error : theme.colors.success }]}
          onPress={() => onToggleStatus({ ...item, isActive })}
        >
          <Ionicons
            name={isActive ? 'person-remove-outline' : 'person-add-outline'}
            size={13}
            color={isActive ? theme.colors.error : theme.colors.success}
          />
          <Text style={[styles.actionBtnText, { color: isActive ? theme.colors.error : theme.colors.success }]}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: theme.colors.primary, flex: 2 }]}
          onPress={() => onEdit(item)}
        >
          <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
          <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Edit Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Generic User Card (for All Users tab) ────────────────────────────────────
function UserCard({ item, onToggleStatus, onResetPassword, onEdit }) {
  const roleColor = getRoleColor(item.role);
  const isImported = item.importSource === 'excel_import' || item.import_source === 'excel_import';
  const facCode = item.facultyCode || item.faculty_code;

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
              <View style={styles.excelBadge}>
                <Text style={styles.excelBadgeTxt}>Excel</Text>
              </View>
            )}
          </View>
          {facCode ? (
            <View style={styles.facultyCodeRow}>
              <Ionicons name="id-card-outline" size={12} color={theme.colors.primary} />
              <Text style={styles.facultyCode}>{facCode}</Text>
              {item.mustChangePassword && (
                <View style={styles.pwdWarnBadge}>
                  <Text style={styles.pwdWarnTxt}>Pwd Required</Text>
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
          onPress={() => onToggleStatus(item)}
        >
          <Ionicons
            name={item.isActive ? 'person-remove-outline' : 'person-add-outline'}
            size={13} color={item.isActive ? theme.colors.error : theme.colors.success}
          />
          <Text style={[styles.actionBtnText, { color: item.isActive ? theme.colors.error : theme.colors.success }]}>
            {item.isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        {item.role === 'faculty' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.colors.primary }]}
            onPress={() => onEdit(item)}
          >
            <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
            <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: theme.colors.warning }]}
          onPress={() => onResetPassword(item)}
        >
          <Ionicons name="key-outline" size={13} color={theme.colors.warning} />
          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Reset Pwd</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManageUsersScreen() {
  const navigation = useNavigation();
  const [activeTab,   setActiveTab]   = useState('faculty');

  // Faculty Panel state
  const [faculty,     setFaculty]     = useState([]);
  const [facLoading,  setFacLoading]  = useState(true);
  const [facRefresh,  setFacRefresh]  = useState(false);
  const [facTotal,    setFacTotal]    = useState(0);
  const [facSearch,   setFacSearch]   = useState('');
  const [editTarget,  setEditTarget]  = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [hostels,     setHostels]     = useState([]);

  // All Users state
  const [users,       setUsers]       = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRefresh, setUsersRefresh] = useState(false);
  const [roleFilter,  setRoleFilter]  = useState('');
  const [pagination,  setPagination]  = useState({ total: 0 });

  // Faculty Panel filter & sort state
  const [facHostelFilter, setFacHostelFilter] = useState('all'); // all, boys, girls, both
  const [facSortBy,       setFacSortBy]       = useState('code'); // code, name, visits

  const processedFaculty = React.useMemo(() => {
    let list = [...faculty];
    if (facHostelFilter === 'boys') {
      list = list.filter(f => (f.stats?.boys || 0) > 0);
    } else if (facHostelFilter === 'girls') {
      list = list.filter(f => (f.stats?.girls || 0) > 0);
    } else if (facHostelFilter === 'both') {
      list = list.filter(f => (f.stats?.boys || 0) > 0 && (f.stats?.girls || 0) > 0);
    }

    list.sort((a, b) => {
      if (facSortBy === 'code') {
        const codeA = a.facultyCode || a.faculty_code || 'ZZZ999';
        const codeB = b.facultyCode || b.faculty_code || 'ZZZ999';
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (facSortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (facSortBy === 'visits') {
        return (b.stats?.total || 0) - (a.stats?.total || 0);
      }
      return 0;
    });
    return list;
  }, [faculty, facHostelFilter, facSortBy]);

  // Load hostels for the edit modal
  React.useEffect(() => {
    hostelService.getAllHostels()
      .then(r => { if (r.success) setHostels(r.data || []); })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFaculty();
      if (activeTab === 'all') loadUsers();
    }, [activeTab, roleFilter])
  );

  // ── Faculty Panel loaders ─────────────────────────────────────────────────
  const loadFaculty = async (isRefresh = false, search = facSearch) => {
    if (isRefresh) setFacRefresh(true);
    else setFacLoading(true);
    try {
      const res = await userService.getFacultyUsers({ search: search || undefined, limit: 10000 });
      if (res.success) {
        setFaculty(res.data.users || []);
        setFacTotal(res.data.pagination?.total || 0);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load faculty' });
    } finally {
      setFacLoading(false);
      setFacRefresh(false);
    }
  };

  const handleFacultySearch = useCallback((text) => {
    setFacSearch(text);
    loadFaculty(false, text);
  }, []);

  const handleEditOpen = (item) => {
    setEditTarget(item);
    setEditVisible(true);
  };

  const handleEditSaved = (updatedData) => {
    // Optimistically update the list
    setFaculty(prev => prev.map(f => (f.id === updatedData.id ? { ...f, ...updatedData } : f)));
    setUsers(prev => prev.map(u => (u.id === updatedData.id ? { ...u, ...updatedData } : u)));
  };

  // ── All Users loaders ─────────────────────────────────────────────────────
  const loadUsers = async (isRefresh = false) => {
    if (isRefresh) setUsersRefresh(true);
    else setUsersLoading(true);
    try {
      const res = await userService.getAllUsers({ role: roleFilter || undefined, limit: 10000 });
      if (res.success) {
        setUsers(res.data.users || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load users' });
    } finally {
      setUsersLoading(false);
      setUsersRefresh(false);
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
              const res = await userService.toggleUserStatus(user.id, !user.isActive);
              if (res.success) {
                Toast.show({ type: 'success', text1: `User ${action}d` });
                loadFaculty();
                if (activeTab === 'all') loadUsers();
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
              const res = await userService.resetPassword(user.id);
              if (res.success) Toast.show({ type: 'success', text1: 'Password Reset', text2: 'New password sent by email' });
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Failed', text2: err.message });
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Manage Users"
        subtitle={activeTab === 'faculty' ? `${processedFaculty.length} of ${facTotal} faculty` : `${pagination.total || users.length} users`}
        rightIcon="person-add-outline"
        onRightPress={() => navigation.navigate('CreateUser')}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(t.key);
              if (t.key === 'all' && users.length === 0) loadUsers();
            }}
          >
            <Ionicons
              name={t.icon}
              size={15}
              color={activeTab === t.key ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.tabTxt, activeTab === t.key && styles.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Faculty Panel ── */}
      {activeTab === 'faculty' && (
        <>
          {/* Search bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={facSearch}
                onChangeText={handleFacultySearch}
                placeholder="Search by name…"
                placeholderTextColor={theme.colors.textMuted}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {facSearch.length > 0 && (
                <TouchableOpacity onPress={() => handleFacultySearch('')}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter & Sort Bar */}
          <View style={styles.facFilterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[
                { label: 'All', value: 'all' },
                { label: '👦 Boys Visits', value: 'boys' },
                { label: '👧 Girls Visits', value: 'girls' },
                { label: '⚡ Both Hostels', value: 'both' },
              ].map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.facFilterChip, facHostelFilter === f.value && styles.facFilterChipActive]}
                  onPress={() => setFacHostelFilter(f.value)}
                >
                  <Text style={[styles.facFilterChipTxt, facHostelFilter === f.value && styles.facFilterChipTxtActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.vDivider} />

              {[
                { label: 'FAC ID', value: 'code' },
                { label: 'Name A-Z', value: 'name' },
                { label: 'Visits', value: 'visits' },
              ].map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.facSortChip, facSortBy === s.value && styles.facSortChipActive]}
                  onPress={() => setFacSortBy(s.value)}
                >
                  <Ionicons name="swap-vertical" size={11} color={facSortBy === s.value ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[styles.facSortChipTxt, facSortBy === s.value && styles.facSortChipTxtActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Info banner */}
          <View style={styles.infoBar}>
            <Ionicons name="information-circle-outline" size={13} color={theme.colors.primary} />
            <Text style={styles.infoBarTxt}>
              Faculty log in with their <Text style={{ fontWeight: '700' }}>Faculty ID</Text> + <Text style={{ fontWeight: '700' }}>mobile number</Text>
            </Text>
          </View>

          {facLoading ? (
            <LoadingSpinner />
          ) : (
            <FlatList
              data={processedFaculty}
              keyExtractor={(i) => i.id || String(Math.random())}
              renderItem={({ item }) => (
                <FacultyCard
                  item={item}
                  onEdit={handleEditOpen}
                  onToggleStatus={handleToggleStatus}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={facRefresh} onRefresh={() => loadFaculty(true)} tintColor={theme.colors.primary} />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="id-card-outline"
                  title="No faculty found"
                  message={facSearch || facHostelFilter !== 'all' ? 'Try adjusting your filters or search.' : 'Import an Excel schedule to create faculty accounts.'}
                  action={facSearch || facHostelFilter !== 'all' ? undefined : () => navigation.navigate('ImportSchedule')}
                  actionLabel={facSearch || facHostelFilter !== 'all' ? undefined : 'Import Schedule'}
                />
              }
            />
          )}
        </>
      )}

      {/* ── All Users ── */}
      {activeTab === 'all' && (
        <>
          {/* Role filter */}
          <View style={styles.filterRow}>
            {ROLE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, roleFilter === f.value && styles.chipActive]}
                onPress={() => {
                  setRoleFilter(f.value);
                  loadUsers();
                }}
              >
                <Text style={[styles.chipText, roleFilter === f.value && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {usersLoading ? (
            <LoadingSpinner />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(i) => i.id || String(Math.random())}
              renderItem={({ item }) => (
                <UserCard
                  item={item}
                  onToggleStatus={handleToggleStatus}
                  onResetPassword={handleResetPassword}
                  onEdit={handleEditOpen}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={usersRefresh} onRefresh={() => loadUsers(true)} tintColor={theme.colors.primary} />
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
        </>
      )}

      {/* Edit Faculty Modal */}
      <EditFacultyModal
        faculty={editTarget}
        visible={editVisible}
        hostels={hostels}
        onClose={() => { setEditVisible(false); setEditTarget(null); }}
        onSaved={handleEditSaved}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: theme.borderRadius.sm,
  },
  tabActive:    { backgroundColor: theme.colors.primary + '12' },
  tabTxt:       { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textMuted },
  tabTxtActive: { fontWeight: theme.fontWeight.bold, color: theme.colors.primary },

  // Search
  searchRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.surface },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textPrimary },

  // Faculty Panel filter & sort bar
  facFilterBar: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  facFilterChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  facFilterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  facFilterChipTxt: { fontSize: 11, fontWeight: theme.fontWeight.medium, color: theme.colors.textSecondary },
  facFilterChipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.bold },
  vDivider: { width: 1, height: 18, backgroundColor: theme.colors.border, alignSelf: 'center', marginHorizontal: 2 },
  facSortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  facSortChipActive: { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary },
  facSortChipTxt: { fontSize: 11, fontWeight: theme.fontWeight.medium, color: theme.colors.textMuted },
  facSortChipTxtActive: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },

  // Info bar
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: theme.colors.primary + '08',
    borderBottomWidth: 1, borderBottomColor: theme.colors.primary + '15',
  },
  infoBarTxt: { fontSize: 11, color: theme.colors.textSecondary },

  // Role filter chips (All Users tab)
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive:     { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText:       { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },

  listContent: { padding: 16, paddingBottom: 32 },

  // Faculty card
  facultyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14, marginBottom: 10,
    ...theme.shadow.sm,
  },
  facultyCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold },
  facultyInfo: { flex: 1 },
  facultyIdRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 3 },
  facIdBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  facIdTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  excelBadge: {
    backgroundColor: theme.colors.secondary + '20', borderRadius: theme.borderRadius.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  excelBadgeTxt: { fontSize: 10, fontWeight: theme.fontWeight.bold, color: theme.colors.secondary },
  pwdWarnBadge: {
    backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  pwdWarnTxt: { fontSize: 10, color: theme.colors.warning, fontWeight: theme.fontWeight.semiBold },
  facultyName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  facultyPhone: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  facultyDept:  { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  facultyHostel: { fontSize: theme.fontSize.xs, color: theme.colors.roleWarden, marginTop: 1 },
  facultyMeta: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  editIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },

  // Credential row
  credRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.primary + '08',
    borderRadius: theme.borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 8,
  },
  credRowTxt: { fontSize: 11, color: theme.colors.textSecondary },

  // Action buttons
  facultyActions: { flexDirection: 'row', gap: 8 },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderRadius: theme.borderRadius.sm, paddingVertical: 6,
  },
  actionBtnText: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },

  // All Users card
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10,
    ...theme.shadow.sm,
  },
  userHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  userInfo:    { flex: 1 },
  userName:    { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  userEmail:   { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 1 },
  userDept:    { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  userPhone:   { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  userMeta:    { alignItems: 'flex-end', gap: 6 },
  facultyCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  facultyCode: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
});

// ─── Edit Modal Styles ────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  closeBtn: { padding: 4 },
  title:    { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { fontSize: theme.fontSize.xs, color: theme.colors.primary, fontWeight: theme.fontWeight.semiBold },
  saveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 60, alignItems: 'center',
  },
  saveTxt: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.sm },

  credCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primary + '0a',
    borderBottomWidth: 1, borderBottomColor: theme.colors.primary + '15',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  credText: { fontSize: 12, color: theme.colors.textSecondary },

  scroll: { padding: 16, paddingBottom: 40 },
  label: {
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: theme.fontSize.sm, color: theme.colors.textPrimary,
    ...theme.shadow.sm,
  },
  hint: { fontSize: 11, color: theme.colors.warning, marginTop: 4, marginBottom: 4 },

  hostelChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  hostelChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  hostelChipTxt:    { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  hostelChipTxtActive: { color: '#fff', fontWeight: theme.fontWeight.semiBold },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: theme.colors.warning,
    borderRadius: theme.borderRadius.md, padding: 12, justifyContent: 'center',
  },
  resetTxt: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.warning },
});
