import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../utils/theme';

export function SelectPicker({
  label,
  value,
  onChange,
  onSelect,
  options = [],
  placeholder = 'Select an option',
  error,
  required = false,
  disabled = false,
  compact = false,
}) {
  const [visible, setVisible] = useState(false);
  // support both onChange and onSelect prop names
  const handleChange = onChange || onSelect || (() => {});
  const selected = options.find((o) => String(o.value) === String(value));

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactTrigger, disabled && styles.disabled]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.75}
      >
        <Text style={styles.compactText} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
        <PickerModal
          visible={visible}
          onClose={() => setVisible(false)}
          options={options}
          value={value}
          label={label || placeholder}
          onSelect={(v) => { handleChange(v); setVisible(false); }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError, disabled && styles.disabled]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.75}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PickerModal
        visible={visible}
        onClose={() => setVisible(false)}
        options={options}
        value={value}
        label={label || 'Select'}
        onSelect={(v) => { handleChange(v); setVisible(false); }}
      />
    </View>
  );
}

function PickerModal({ visible, onClose, options, value, label, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            renderItem={({ item }) => {
              const isSelected = String(item.value) === String(value);
              return (
                <TouchableOpacity
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => onSelect(item.value)}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 320 }}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: {
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary, marginBottom: 6,
  },
  required: { color: theme.colors.error },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 13, minHeight: 50,
  },
  triggerError: { borderColor: theme.colors.error },
  disabled: { opacity: 0.6 },
  triggerText: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary, flex: 1 },
  placeholder: { color: theme.colors.textMuted },
  error: { fontSize: theme.fontSize.xs, color: theme.colors.error, marginTop: 4 },
  compactTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10, height: 42,
    borderWidth: 1, borderColor: theme.colors.border, minWidth: 90,
  },
  compactText: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: theme.colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary, marginBottom: 12, paddingHorizontal: 4,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  optionSelected: { backgroundColor: theme.colors.primary + '08' },
  optionText: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary },
  optionTextSelected: { fontWeight: theme.fontWeight.semiBold, color: theme.colors.primary },
});

export default SelectPicker;
