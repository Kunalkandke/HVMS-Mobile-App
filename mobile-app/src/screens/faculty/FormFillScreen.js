import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { formService } from '../../services/formService';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../utils/theme';
import { formatDateTime } from '../../utils/helpers';
import {
  LOCATIONS, buildInitialData,
  generateAntiRaggingHTML, generateMessFeedbackHTML,
} from '../../utils/formHelpers';
import AppHeader from '../../components/common/AppHeader';

// ─── Option selector for Yes/No / status fields ─────────────────────────────
function OptionSelector({ value, options, onChange, readOnly }) {
  return (
    <View style={styles.optionRow}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.optionBtn, active && styles.optionBtnActive]}
            onPress={() => !readOnly && onChange(opt)}
            activeOpacity={readOnly ? 1 : 0.75}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Dropdown picker ─────────────────────────────────────────────────────────
function Picker({ label, value, options, onChange, readOnly, required, error }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text>
      {readOnly ? (
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyText}>{value || '—'}</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.pickerTrigger, error && styles.fieldError]}
            onPress={() => setOpen(true)}
          >
            <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
              {value || `Select ${label}...`}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setOpen(false)} activeOpacity={1}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{label}</Text>
                <FlatList
                  data={options}
                  keyExtractor={i => i}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.modalOption, item === value && styles.modalOptionActive]}
                      onPress={() => { onChange(item); setOpen(false); }}
                    >
                      <Text style={[styles.modalOptionText, item === value && styles.modalOptionTextActive]}>
                        {item}
                      </Text>
                      {item === value && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </View>
  );
}

// ─── Locations table row ─────────────────────────────────────────────────────
function LocationRow({ loc, locKey, data, onChange, readOnly }) {
  return (
    <View style={styles.locRow}>
      <Text style={styles.locLabel}>{loc}</Text>
      {readOnly ? (
        <Text style={[styles.locTimeInput, styles.readOnlyInline]}>{data[`loc_${locKey}_time`] || '—'}</Text>
      ) : (
        <TextInput
          style={styles.locTimeInput}
          value={data[`loc_${locKey}_time`] || ''}
          onChangeText={v => onChange(`loc_${locKey}_time`, v)}
          placeholder="HH:MM"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      )}
      {readOnly ? (
        <Text style={[styles.locRemarksInput, styles.readOnlyInline]}>{data[`loc_${locKey}_remarks`] || '—'}</Text>
      ) : (
        <TextInput
          style={styles.locRemarksInput}
          value={data[`loc_${locKey}_remarks`] || ''}
          onChangeText={v => onChange(`loc_${locKey}_remarks`, v)}
          placeholder="Remarks..."
          placeholderTextColor={theme.colors.textMuted}
        />
      )}
    </View>
  );
}

// ─── Field components ────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multiline, required, error, readOnly, numberOfLines = 3 }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text>
      {readOnly ? (
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyText}>{value || '—'}</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.textInput, multiline && { minHeight: numberOfLines * 22, textAlignVertical: 'top' }, error && styles.fieldError]}
            value={value || ''}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textMuted}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : 1}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function FormFillScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { visitId, formType, visitData, existingData, readOnly } = route.params || {};

  const [data, setData] = useState(() => buildInitialData(visitData, existingData));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [formSaved, setFormSaved] = useState(!!existingData); // Track if form has been saved

  // Validate visitId on mount
  useEffect(() => {
    if (!visitId) {
      console.error('[FormFillScreen] Missing visitId!', route.params);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Visit ID is missing. Please try again.' });
      navigation.goBack();
    }
  }, [visitId]);

  const isAntiRagging = formType === 'anti_ragging';
  const formTitle = isAntiRagging ? 'Anti-Ragging Committee' : 'Mess Food Quality Inspection';

  const set = (key, val) => {
    setData(d => ({ ...d, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (isAntiRagging) {
      if (!data.discipline_status)       e.discipline_status   = 'Required';
      if (!data.cleanliness_status)      e.cleanliness_status  = 'Required';
      if (!data.environment_status)      e.environment_status  = 'Required';
      if (!data.antiragging_suggestions?.trim()) e.antiragging_suggestions = 'Required';
    } else {
      if (!data.meal_type)             e.meal_type           = 'Required';
      if (!data.tasted_food)           e.tasted_food         = 'Required';
      if (!data.cleanliness)           e.cleanliness         = 'Required';
      if (!data.plates_clean)          e.plates_clean        = 'Required';
      if (!data.food_hot)              e.food_hot            = 'Required';
      if (!data.food_remarks?.trim())  e.food_remarks        = 'Required';
      if (!data.overall_feedback)      e.overall_feedback    = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Toast.show({ type: 'error', text1: 'Please fill all required fields' });
      return;
    }
    if (!visitId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Visit ID is missing' });
      return;
    }
    setSaving(true);
    try {
      console.log('[FormFillScreen] Saving form:', { visitId, formType });
      const res = await formService.submitForm(visitId, formType, data);
      console.log('[FormFillScreen] Save response:', res);
      if (res.success) {
        setFormSaved(true);
        Toast.show({ type: 'success', text1: 'Form Saved!', text2: 'You can now download the Word document.' });
      } else {
        Toast.show({ type: 'error', text1: 'Save Failed', text2: res.message || 'Unknown error' });
      }
    } catch (err) {
      console.error('[FormFillScreen] Save error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not save form' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPDF = async () => {
    setPrintLoading(true);
    try {
      const html = isAntiRagging
        ? generateAntiRaggingHTML(visitData, data)
        : generateMessFeedbackHTML(visitData, data);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${formTitle} - PDF`,
      });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'PDF Failed', text2: err.message || 'Could not generate PDF' });
    } finally {
      setPrintLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    // First verify form was actually saved by fetching it
    setDownloading(true);
    try {
      console.log('[FormFillScreen] Checking forms for download:', { visitId, formType });

      // Check if form exists on server before attempting download
      const formsRes = await formService.getForms(visitId);
      console.log('[FormFillScreen] getForms response:', formsRes);

      if (!formsRes.success) {
        Toast.show({ type: 'error', text1: 'Error', text2: formsRes.message || 'Could not verify form status' });
        setDownloading(false);
        return;
      }

      const forms = formsRes.data?.forms || [];
      // Check both camelCase (formType) and snake_case (form_type) due to normalization
      console.log('[FormFillScreen] Found forms:', forms.map(f => f.formType || f.form_type));

      const savedForm = forms.find(f => (f.formType || f.form_type) === formType);
      if (!savedForm) {
        Toast.show({
          type: 'error',
          text1: 'Save First',
          text2: `No ${formType} form found. Please save the form first.`
        });
        setDownloading(false);
        return;
      }

      console.log('[FormFillScreen] Downloading form:', { visitId, formType });
      const token = await SecureStore.getItemAsync('hvms_token');
      const url = formService.getDownloadUrl(visitId, formType);
      const dest = `${FileSystem.documentDirectory}${formType}_form_${Date.now()}.docx`;
      const result = await FileSystem.downloadAsync(url, dest, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      console.log('[FormFillScreen] Download result status:', result.status);

      if (result.status === 200) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dialogTitle: `${formTitle} - Word Document`,
        });
      } else {
        // Try to read error message from response
        let errorMsg = 'Download failed';
        try {
          const errorContent = await FileSystem.readAsStringAsync(result.uri);
          const errorJson = JSON.parse(errorContent);
          errorMsg = errorJson.message || errorMsg;
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch {}
        Toast.show({ type: 'error', text1: 'Download Failed', text2: errorMsg });
      }
    } catch (err) {
      console.error('[FormFillScreen] Download error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Download failed' });
    } finally {
      setDownloading(false);
    }
  };

  const STATUS_OPTS = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];
  const YES_NO = ['Yes', 'No'];

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={formTitle}
        subtitle={readOnly ? 'View Only' : (existingData ? 'Edit & Save' : 'Fill & Submit')}
        showBack
      />

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPreview(true)}>
          <Ionicons name="eye-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handlePrintPDF} disabled={printLoading}>
          {printLoading
            ? <ActivityIndicator size="small" color={theme.colors.warning} />
            : <Ionicons name="print-outline" size={16} color={theme.colors.warning} />
          }
          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadDocx} disabled={downloading}>
          {downloading
            ? <ActivityIndicator size="small" color={theme.colors.success} />
            : <Ionicons name="document-outline" size={16} color={theme.colors.success} />
          }
          <Text style={[styles.actionBtnText, { color: theme.colors.success }]}>DOCX</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Visit info strip */}
        {visitData && (
          <View style={styles.visitStrip}>
            <Text style={styles.visitStripText}>
              {visitData.faculty?.name} • {visitData.hostel?.name}
            </Text>
            <Text style={styles.visitStripTime}>{formatDateTime(visitData.checkIn)}</Text>
          </View>
        )}

        {/* ── Locations Table ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Locations Visited</Text>
          <View style={styles.locHeader}>
            <Text style={[styles.locLabel, styles.locHeaderText]}>Hostel</Text>
            <Text style={[styles.locTimeInput, styles.locHeaderText]}>Time</Text>
            <Text style={[styles.locRemarksInput, styles.locHeaderText]}>Remarks</Text>
          </View>
          {LOCATIONS.map(l => (
            <LocationRow
              key={l.key}
              loc={l.label}
              locKey={l.key}
              data={data}
              onChange={set}
              readOnly={readOnly}
            />
          ))}
        </View>

        {/* ── Anti-Ragging Fields ── */}
        {isAntiRagging && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status Assessment</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Status of Discipline *</Text>
                <OptionSelector value={data.discipline_status} options={STATUS_OPTS} onChange={v => set('discipline_status', v)} readOnly={readOnly} />
                {errors.discipline_status && <Text style={styles.errorText}>{errors.discipline_status}</Text>}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Status of Cleanliness *</Text>
                <OptionSelector value={data.cleanliness_status} options={STATUS_OPTS} onChange={v => set('cleanliness_status', v)} readOnly={readOnly} />
                {errors.cleanliness_status && <Text style={styles.errorText}>{errors.cleanliness_status}</Text>}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Overall Environment *</Text>
                <OptionSelector value={data.environment_status} options={STATUS_OPTS} onChange={v => set('environment_status', v)} readOnly={readOnly} />
                {errors.environment_status && <Text style={styles.errorText}>{errors.environment_status}</Text>}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Interacted with Senior Students?</Text>
                <OptionSelector value={data.senior_interaction} options={YES_NO} onChange={v => set('senior_interaction', v)} readOnly={readOnly} />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Interacted with Fresher Students?</Text>
                <OptionSelector value={data.fresher_interaction} options={YES_NO} onChange={v => set('fresher_interaction', v)} readOnly={readOnly} />
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              <Field label="Anti-Ragging Suggestions" value={data.antiragging_suggestions} onChange={v => set('antiragging_suggestions', v)} placeholder="Suggestions related to Anti-Ragging only..." multiline required error={errors.antiragging_suggestions} readOnly={readOnly} numberOfLines={4} />
              <Field label="Any Other Suggestions (Optional)" value={data.other_suggestions} onChange={v => set('other_suggestions', v)} placeholder="Any other observations..." multiline readOnly={readOnly} numberOfLines={3} />
            </View>
          </>
        )}

        {/* ── Mess Feedback Fields ── */}
        {!isAntiRagging && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meal Information</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Meal Type *</Text>
                <OptionSelector value={data.meal_type} options={['Breakfast', 'Lunch', 'Dinner']} onChange={v => set('meal_type', v)} readOnly={readOnly} />
                {errors.meal_type && <Text style={styles.errorText}>{errors.meal_type}</Text>}
              </View>
              <Field label="Menu Items (Optional)" value={data.menu_items} onChange={v => set('menu_items', v)} placeholder="List the menu items served..." multiline readOnly={readOnly} numberOfLines={2} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quality Checks</Text>
              {[
                { key: 'tasted_food',  label: '1. Did you taste the food?',                    required: true },
                { key: 'cleanliness',  label: '2. Was the dining hall clean?',                  required: true },
                { key: 'plates_clean', label: '3. Were plates/spoons neatly cleaned?',           required: true },
                { key: 'food_hot',     label: '4. Was the food served hot?',                    required: true },
              ].map(f => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{f.label}{f.required ? ' *' : ''}</Text>
                  <OptionSelector value={data[f.key]} options={YES_NO} onChange={v => set(f.key, v)} readOnly={readOnly} />
                  {errors[f.key] && <Text style={styles.errorText}>{errors[f.key]}</Text>}
                </View>
              ))}
              <Field label="5. Detailed Food Remarks *" value={data.food_remarks} onChange={v => set('food_remarks', v)} placeholder="Describe taste and condition of food..." multiline required error={errors.food_remarks} readOnly={readOnly} numberOfLines={4} />
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>6. Overall Feedback *</Text>
                <OptionSelector value={data.overall_feedback} options={['Satisfactory', 'Needs improvement']} onChange={v => set('overall_feedback', v)} readOnly={readOnly} />
                {errors.overall_feedback && <Text style={styles.errorText}>{errors.overall_feedback}</Text>}
              </View>
              <Field label="7. Areas of Improvement (Optional)" value={data.improvement_suggestions} onChange={v => set('improvement_suggestions', v)} placeholder="Suggestions for improvement..." multiline readOnly={readOnly} numberOfLines={3} />
            </View>
          </>
        )}

        {/* Save Button */}
        {!readOnly && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {existingData ? 'Update Form' : 'Submit Form'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* PDF Preview Modal */}
      <Modal visible={showPreview} animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{formTitle} — Preview</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{
              html: isAntiRagging
                ? generateAntiRaggingHTML(visitData, data)
                : generateMessFeedbackHTML(visitData, data),
            }}
            style={{ flex: 1 }}
            scalesPageToFit
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  actionBar: {
    flexDirection: 'row', backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    paddingHorizontal: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  scroll: { padding: 14, paddingBottom: 40 },
  visitStrip: {
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.borderRadius.md,
    padding: 10, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  visitStripText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  visitStripTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14, marginBottom: 12, ...theme.shadow.sm,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  locHeader: {
    flexDirection: 'row', paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginBottom: 4,
  },
  locHeaderText: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase' },
  locRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  locLabel: { width: 70, fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  locTimeInput: {
    width: 72, fontSize: 13, color: theme.colors.textPrimary,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    marginHorizontal: 4, backgroundColor: theme.colors.surfaceVariant,
  },
  locRemarksInput: {
    flex: 1, fontSize: 13, color: theme.colors.textPrimary,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyInline: {
    backgroundColor: 'transparent', borderWidth: 0,
    color: theme.colors.textSecondary,
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  textInput: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyBox: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md, padding: 10,
    borderWidth: 1, borderColor: theme.colors.borderLight, minHeight: 40,
  },
  readOnlyText: { fontSize: 14, color: theme.colors.textPrimary },
  fieldError: { borderColor: theme.colors.error },
  errorText: { fontSize: 11, color: theme.colors.error, marginTop: 3 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: theme.borderRadius.full, borderWidth: 1.5,
    borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant,
  },
  optionBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  optionText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  optionTextActive: { color: '#fff' },
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: theme.colors.surfaceVariant,
  },
  pickerText: { fontSize: 14, color: theme.colors.textPrimary },
  pickerPlaceholder: { color: theme.colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '60%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: theme.colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 10 },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  modalOptionActive: { backgroundColor: theme.colors.primary + '08' },
  modalOptionText: { fontSize: 14, color: theme.colors.textPrimary },
  modalOptionTextActive: { color: theme.colors.primary, fontWeight: '700' },
  saveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md,
    paddingVertical: 14, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginTop: 4, ...theme.shadow.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.primary, padding: 16,
  },
  previewTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  previewClose: { padding: 4 },
});
