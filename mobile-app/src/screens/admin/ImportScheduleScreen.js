/**
 * ImportScheduleScreen — v2 (fixed)
 *
 * Step 1: Pick .xlsx file
 * Step 2: Parse → Preview  (faculty summary + schedule summary + warnings)
 * Step 3: Confirm / Discard
 *
 * Changes from v1:
 *  - Confirm result now shows totalVisitsInserted, duplicatesSkipped, failedRows,
 *    newFacultyCreated, and any per-row errors from the controller.
 *  - Faculty list shows FAC-code for existing users.
 *  - Schedule list shows all 4 rounds clearly.
 *  - Blocking error banner only blocks if hostel is missing.
 *  - Phone-conflict warnings are shown but do NOT block import.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import AppHeader from '../../components/common/AppHeader';
import { theme } from '../../utils/theme';
import { scheduleService } from '../../services/scheduleService';

const STEP_PICK       = 'pick';
const STEP_UPLOADING  = 'uploading';
const STEP_PREVIEW    = 'preview';
const STEP_CONFIRMING = 'confirming';
const STEP_DONE       = 'done';

const HOSTEL_COLOR = { boys: theme.colors.secondary, girls: theme.colors.accent };

const FAC_META = {
  new:              { icon: 'person-add-outline',       color: theme.colors.success, label: 'New account' },
  existing_user:    { icon: 'checkmark-circle-outline', color: theme.colors.primary, label: 'Exists'      },
  existing_profile: { icon: 'time-outline',             color: theme.colors.warning, label: 'Incomplete'  },
};

const ROUND_COLOR = {
  'Round-I':   '#1565c0',
  'Round-II':  '#2e7d32',
  'Round-III': '#e65100',
  'Round-IV':  '#6a1b9a',
};

/* ── tiny atoms ───────────────────────────────────────────────────────────── */
function SRow({ label, value, vc }) {
  return (
    <View style={s.sRow}>
      <Text style={s.sLabel}>{label}</Text>
      <Text style={[s.sVal, vc ? { color: vc } : null]}>{value ?? '—'}</Text>
    </View>
  );
}

function WarnBanner({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <View style={s.warnBox}>
      <View style={s.warnHead}>
        <Ionicons name="warning-outline" size={15} color={theme.colors.warning} />
        <Text style={s.warnTitle}> {warnings.length} Warning{warnings.length > 1 ? 's' : ''}</Text>
      </View>
      {warnings.map((w, i) => <Text key={i} style={s.warnLine}>• {w}</Text>)}
    </View>
  );
}

function ErrBanner({ preview }) {
  if (!preview?.hasBlockingErrors) return null;
  return (
    <View style={s.errBox}>
      <Ionicons name="close-circle-outline" size={15} color={theme.colors.error} />
      <Text style={s.errText}>
        {' '}No {preview.meta?.hostelType || ''} hostel found in HVMS.
        Create a hostel of the correct type before confirming.
      </Text>
    </View>
  );
}

function FacultyRow({ item }) {
  const m = FAC_META[item.status] || FAC_META.new;
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: m.color + '18' }]}>
        <Ionicons name={m.icon} size={17} color={m.color} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={s.rowSub}>
          {item.phone ? `📱 ${item.phone}` : '📱 No phone'} · {item.appearances} round{item.appearances !== 1 ? 's' : ''}
        </Text>
        {!!item.phoneConflict && (
          <Text style={s.conflict}>⚠ Phone conflict: {item.phoneConflictDetails}</Text>
        )}
        {!!item.conflictingPhones && (
          <Text style={s.conflict}>⚠ Two phones in Excel: {item.conflictingPhones.join(' / ')}</Text>
        )}
      </View>
      <View style={[s.chip, { backgroundColor: m.color + '18' }]}>
        <Text style={[s.chipTxt, { color: m.color }]}>{m.label}</Text>
      </View>
    </View>
  );
}

function ScheduleRow({ item }) {
  const rc = ROUND_COLOR[item.round] || theme.colors.primary;
  return (
    <View style={s.row}>
      <View style={[s.roundBadge, { backgroundColor: rc + '15', borderColor: rc + '40' }]}>
        <Text style={[s.roundBadgeTxt, { color: rc }]} numberOfLines={1}>
          {item.round.replace('Round-', 'R')}
        </Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {item.visitDate}
          {item.dayOfWeek ? `  (${item.dayOfWeek.slice(0, 3)})` : ''}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>{item.facultyName}</Text>
        <Text style={s.rowSub2} numberOfLines={1}>
          {item.hostelName || item.hostelType}
          {item.facultyPhone ? ` · 📱 ${item.facultyPhone}` : ''}
        </Text>
      </View>
    </View>
  );
}

function ResultCard({ result }) {
  if (!result) return null;
  const hasErrors = result.errors?.length > 0;
  return (
    <View style={s.resultCard}>
      <View style={[s.resultHeader, { backgroundColor: hasErrors ? theme.colors.warningLight : theme.colors.successLight }]}>
        <Ionicons
          name={hasErrors ? 'warning-outline' : 'checkmark-circle-outline'}
          size={22}
          color={hasErrors ? theme.colors.warning : theme.colors.success}
        />
        <Text style={[s.resultTitle, { color: hasErrors ? theme.colors.warning : theme.colors.success }]}>
          {hasErrors ? 'Import completed with warnings' : 'Import successful'}
        </Text>
      </View>
      <View style={s.resultBody}>
        <SRow label="Visits scheduled"      value={result.totalVisitsInserted}  vc={result.totalVisitsInserted > 0 ? theme.colors.success : null} />
        <SRow label="Duplicates skipped"    value={result.duplicatesSkipped} />
        <SRow label="Failed rows"           value={result.failedRows}           vc={result.failedRows > 0 ? theme.colors.error : null} />
        <SRow label="New faculty accounts"  value={result.newFacultyCreated}    vc={result.newFacultyCreated > 0 ? theme.colors.success : null} />
        <SRow label="Hostel"                value={result.hostelName} />
      </View>
      {hasErrors && (
        <View style={s.resultErrors}>
          <Text style={s.resultErrorsTitle}>Row errors:</Text>
          {result.errors.slice(0, 10).map((e, i) => (
            <Text key={i} style={s.resultErrorLine}>• {e}</Text>
          ))}
          {result.errors.length > 10 && (
            <Text style={s.resultErrorLine}>…and {result.errors.length - 10} more</Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ── main ─────────────────────────────────────────────────────────────────── */
export default function ImportScheduleScreen() {
  const [step,       setStep]      = useState(STEP_PICK);
  const [file,       setFile]      = useState(null);
  const [uploadId,   setUploadId]  = useState(null);
  const [preview,    setPreview]   = useState(null);
  const [activeTab,  setActiveTab] = useState('faculty');
  const [importResult, setImportResult] = useState(null);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0] ?? result;
      if (!asset?.uri) return;
      const name = asset.name || asset.uri.split('/').pop() || 'schedule.xlsx';
      if (!name.match(/\.(xlsx|xls)$/i)) {
        Toast.show({ type: 'error', text1: 'Wrong file type', text2: 'Please select an .xlsx Excel file.' });
        return;
      }
      setFile({ uri: asset.uri, name, mimeType: asset.mimeType });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'File Picker Error', text2: err.message });
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) { Toast.show({ type: 'error', text1: 'No file selected' }); return; }
    setStep(STEP_UPLOADING);
    try {
      const res = await scheduleService.uploadPreview(file);
      if (!res.success) throw new Error(res.message || 'Upload failed.');
      setUploadId(res.uploadId);
      setPreview(res.preview);
      setActiveTab('faculty');
      setStep(STEP_PREVIEW);
    } catch (err) {
      setStep(STEP_PICK);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message || 'Server error.' });
    }
  }, [file]);

  const handleConfirm = useCallback(() => {
    if (!uploadId || preview?.hasBlockingErrors) return;
    const { facultySummary, scheduleSummary } = preview;
    Alert.alert(
      'Confirm Import',
      `This will:\n\n` +
      `• Create ${facultySummary.newFaculty} new faculty account(s)\n` +
      `  Login: Faculty ID  |  Password: Mobile number\n\n` +
      `• Schedule ${scheduleSummary.totalRows} visit records\n` +
      `  (${(scheduleSummary.rounds || []).length} rounds × faculty)\n\n` +
      `Faculty will be required to change their password on first login.\n\nProceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Import',
          onPress: async () => {
            setStep(STEP_CONFIRMING);
            try {
              const res = await scheduleService.confirmImport(uploadId);
              if (!res.success) throw new Error(res.message);
              setImportResult(res.data);
              setStep(STEP_DONE);
            } catch (err) {
              setStep(STEP_PREVIEW);
              Toast.show({ type: 'error', text1: 'Confirm Failed', text2: err.message });
            }
          },
        },
      ]
    );
  }, [uploadId, preview]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Preview', 'Discard this preview and start over?', [
      { text: 'Keep Preview', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive',
        onPress: () => {
          if (uploadId) scheduleService.rejectUpload(uploadId).catch(() => {});
          setStep(STEP_PICK); setFile(null); setUploadId(null); setPreview(null);
        },
      },
    ]);
  }, [uploadId]);

  const handleStartOver = useCallback(() => {
    setStep(STEP_PICK);
    setFile(null); setUploadId(null); setPreview(null); setImportResult(null);
  }, []);

  /* loading */
  if (step === STEP_UPLOADING || step === STEP_CONFIRMING) {
    return (
      <SafeAreaView style={s.container}>
        <AppHeader title="Import Excel Schedule" showBack backgroundColor={theme.colors.primary} />
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={s.loadTitle}>
            {step === STEP_UPLOADING ? 'Parsing Excel file…' : 'Creating faculty accounts and scheduling visits…'}
          </Text>
          <Text style={s.loadSub}>This may take 10–30 seconds for large files.</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* done */
  if (step === STEP_DONE) {
    return (
      <SafeAreaView style={s.container}>
        <AppHeader title="Import Complete" showBack onBack={handleStartOver} backgroundColor={theme.colors.success} />
        <ScrollView contentContainerStyle={s.pickScroll}>
          <ResultCard result={importResult} />
          <View style={s.doneInfoCard}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={s.doneInfoText}>
              New faculty can log in immediately using:{'\n'}
              <Text style={{ fontWeight: '700' }}>Faculty ID</Text> (e.g. FAC001) as username{'\n'}
              <Text style={{ fontWeight: '700' }}>Mobile number</Text> as initial password{'\n\n'}
              They will be asked to change their password on first login.
            </Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={handleStartOver} activeOpacity={0.82}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={s.primaryBtnTxt}>Import Another File</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* step 1: pick */
  if (step === STEP_PICK) {
    return (
      <SafeAreaView style={s.container}>
        <AppHeader
          title="Import Excel Schedule"
          subtitle="Boys / Girls Hostel"
          showBack
          backgroundColor={theme.colors.primary}
        />
        <ScrollView contentContainerStyle={s.pickScroll}>
          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.infoTitle}>One file → Faculty accounts + Scheduled visits</Text>
              <Text style={s.infoBody}>
                Upload the Boys or Girls Hostel schedule Excel.{'\n'}
                Faculty login accounts (FAC001, FAC002…) and all 4-round scheduled visits are created automatically.
              </Text>
            </View>
          </View>

          {[
            'Upload Excel file (.xlsx)',
            'Parse: extract faculty + all 4 rounds',
            'Review the preview',
            'Confirm → accounts + schedule created',
          ].map((lbl, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepNum}><Text style={s.stepNumTxt}>{i + 1}</Text></View>
              <Text style={s.stepLbl}>{lbl}</Text>
            </View>
          ))}

          <TouchableOpacity style={s.dropZone} onPress={pickFile} activeOpacity={0.82}>
            <View style={[s.dropIcon, file && { backgroundColor: theme.colors.success + '15' }]}>
              <Ionicons
                name={file ? 'document-text' : 'document-outline'}
                size={36}
                color={file ? theme.colors.success : theme.colors.primary}
              />
            </View>
            {file
              ? (<><Text style={s.dropName} numberOfLines={2}>{file.name}</Text><Text style={s.dropChange}>Tap to change file</Text></>)
              : (<><Text style={s.dropLbl}>Tap to select Excel file</Text><Text style={s.dropHint}>.xlsx only · max 10 MB</Text></>)
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.primaryBtn, !file && s.primaryBtnOff]}
            onPress={handleUpload} disabled={!file} activeOpacity={0.82}
          >
            <Ionicons name="analytics-outline" size={20} color="#fff" />
            <Text style={s.primaryBtnTxt}>Parse and Preview</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* step 2: preview */
  if (step === STEP_PREVIEW && preview) {
    const { meta, facultySummary, scheduleSummary, faculty, scheduleRows, warnings } = preview;
    const hc = HOSTEL_COLOR[meta.hostelType] || theme.colors.primary;
    const listData = activeTab === 'faculty' ? faculty : scheduleRows;

    return (
      <SafeAreaView style={s.container}>
        <AppHeader
          title="Import Preview"
          subtitle={`${meta.hostelType === 'girls' ? 'Girls' : 'Boys'} · ${meta.academicYear || ''}`}
          showBack
          onBack={handleDiscard}
          backgroundColor={theme.colors.primary}
        />

        <FlatList
          data={listData}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) =>
            activeTab === 'faculty' ? <FacultyRow item={item} /> : <ScheduleRow item={item} />
          }
          contentContainerStyle={s.previewList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* hostel badge */}
              <View style={[s.hostelBadge, { backgroundColor: hc + '12', borderColor: hc + '35' }]}>
                <Ionicons name={meta.hostelType === 'girls' ? 'female' : 'male'} size={15} color={hc} />
                <Text style={[s.hostelBadgeTxt, { color: hc }]}>
                  {meta.hostelType === 'girls' ? 'Girls' : 'Boys'} Hostel · {meta.academicYear || '—'}
                </Text>
                {meta.hostelMatch
                  ? <Text style={[s.hostelMatch, { color: hc }]}> → {meta.hostelMatch.name}</Text>
                  : <Text style={s.hostelMissing}> ⚠ No hostel matched</Text>}
              </View>

              <ErrBanner preview={preview} />
              <WarnBanner warnings={warnings} />

              {/* summary grid */}
              <View style={s.summaryGrid}>
                <View style={s.summaryCard}>
                  <Text style={s.summaryCardTitle}>Faculty</Text>
                  <SRow label="Total unique"     value={facultySummary.total} />
                  <SRow label="New accounts"     value={facultySummary.newFaculty}
                    vc={facultySummary.newFaculty > 0 ? theme.colors.success : null} />
                  <SRow label="Already in HVMS"  value={facultySummary.existingFaculty} />
                  <SRow label="Missing phone"    value={facultySummary.missingPhones}
                    vc={facultySummary.missingPhones > 0 ? theme.colors.warning : null} />
                  <SRow label="Phone conflicts"  value={facultySummary.phoneConflicts}
                    vc={facultySummary.phoneConflicts > 0 ? theme.colors.warning : null} />
                </View>
                <View style={s.summaryCard}>
                  <Text style={s.summaryCardTitle}>Schedule</Text>
                  <SRow label="Total records"    value={scheduleSummary.totalRows} />
                  <SRow label="Date groups"      value={scheduleSummary.totalGroups} />
                  <SRow label="Rounds"           value={(scheduleSummary.rounds || []).join(', ')} />
                  <SRow label="Date from"        value={scheduleSummary.dateFrom} />
                  <SRow label="Date to"          value={scheduleSummary.dateTo} />
                  <SRow label="Hostel"
                    value={scheduleSummary.hostelName || (meta.hostelMatch ? '✓' : '✗ Not found')}
                    vc={!meta.hostelMatch ? theme.colors.error : theme.colors.success} />
                </View>
              </View>

              {/* credential info */}
              {facultySummary.newFaculty > 0 && (
                <View style={s.credInfoCard}>
                  <Ionicons name="key-outline" size={16} color={theme.colors.primary} />
                  <Text style={s.credInfoText}>
                    {facultySummary.newFaculty} new faculty account{facultySummary.newFaculty !== 1 ? 's' : ''} will be created.{'\n'}
                    Login: <Text style={{ fontWeight: '700' }}>Faculty ID</Text>  |  Password: <Text style={{ fontWeight: '700' }}>Mobile number</Text>{'\n'}
                    Password change required on first login.
                  </Text>
                </View>
              )}

              {/* tabs */}
              <View style={s.tabBar}>
                {[
                  { key: 'faculty',  label: `Faculty (${facultySummary.total})`,       icon: 'people-outline'   },
                  { key: 'schedule', label: `Schedule (${scheduleSummary.totalRows})`, icon: 'calendar-outline' },
                ].map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.tab, activeTab === t.key && s.tabActive]}
                    onPress={() => setActiveTab(t.key)}
                  >
                    <Ionicons
                      name={t.icon} size={14}
                      color={activeTab === t.key ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={s.emptyTxt}>Nothing to display.</Text>}
        />

        {/* action bar */}
        <View style={s.actionBar}>
          <TouchableOpacity style={s.discardBtn} onPress={handleDiscard} activeOpacity={0.82}>
            <Ionicons name="close-outline" size={18} color={theme.colors.error} />
            <Text style={s.discardTxt}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, preview.hasBlockingErrors && s.confirmBtnOff]}
            onPress={handleConfirm}
            disabled={!!preview.hasBlockingErrors}
            activeOpacity={0.82}
          >
            <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
            <Text style={s.confirmTxt}>Confirm Import</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

/* ── styles ───────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  loadWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadTitle:  { marginTop: 18, fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary, textAlign: 'center' },
  loadSub:    { marginTop: 8, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'center' },
  pickScroll: { padding: 20, paddingBottom: 40 },
  infoCard:   { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: theme.colors.primary + '0e', borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.primary + '20', padding: 14, marginBottom: 20 },
  infoTitle:  { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: 3 },
  infoBody:   { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, lineHeight: 18 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, padding: 11, marginBottom: 6, ...theme.shadow.sm },
  stepNum:    { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumTxt: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: '#fff' },
  stepLbl:    { fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: theme.fontWeight.medium },
  dropZone:   { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg, padding: 34, alignItems: 'center', backgroundColor: theme.colors.surface, marginVertical: 20 },
  dropIcon:   { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary + '0e', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dropLbl:    { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  dropHint:   { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 4 },
  dropName:   { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.success, textAlign: 'center', marginBottom: 4 },
  dropChange: { fontSize: theme.fontSize.xs, color: theme.colors.primary },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg, paddingVertical: 15 },
  primaryBtnOff: { backgroundColor: theme.colors.textMuted },
  primaryBtnTxt: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: '#fff' },
  // done
  resultCard:        { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, marginBottom: 16, overflow: 'hidden', ...theme.shadow.sm },
  resultHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  resultTitle:       { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold },
  resultBody:        { padding: 14, paddingTop: 0 },
  resultErrors:      { backgroundColor: theme.colors.errorLight, padding: 12, margin: 14, marginTop: 0, borderRadius: theme.borderRadius.sm },
  resultErrorsTitle: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.error, marginBottom: 4 },
  resultErrorLine:   { fontSize: theme.fontSize.xs, color: theme.colors.error, lineHeight: 18 },
  doneInfoCard:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: theme.colors.primary + '0e', borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.primary + '20', padding: 14, marginBottom: 20 },
  doneInfoText:      { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, lineHeight: 22 },
  // preview
  previewList:    { padding: 12, paddingBottom: 100 },
  hostelBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.borderRadius.full, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 10 },
  hostelBadgeTxt: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  hostelMatch:    { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium, opacity: 0.85 },
  hostelMissing:  { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold, color: theme.colors.error },
  warnBox:        { backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.md, borderLeftWidth: 3, borderLeftColor: theme.colors.warning, padding: 12, marginBottom: 8 },
  warnHead:       { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  warnTitle:      { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.warning },
  warnLine:       { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, lineHeight: 18, marginBottom: 2 },
  errBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 5, backgroundColor: theme.colors.errorLight, borderRadius: theme.borderRadius.md, borderLeftWidth: 3, borderLeftColor: theme.colors.error, padding: 12, marginBottom: 8 },
  errText:        { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.error, lineHeight: 20 },
  summaryGrid:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  summaryCard:      { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: 12, ...theme.shadow.sm },
  summaryCardTitle: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: 8 },
  sRow:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sLabel:           { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, flex: 1 },
  sVal:             { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
  credInfoCard:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: theme.colors.primary + '0a', borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.primary + '20', padding: 12, marginBottom: 10 },
  credInfoText:     { flex: 1, fontSize: theme.fontSize.xs, color: theme.colors.textPrimary, lineHeight: 20 },
  tabBar:           { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: 4, marginBottom: 8, ...theme.shadow.sm },
  tab:              { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: theme.borderRadius.sm },
  tabActive:        { backgroundColor: theme.colors.primary + '12' },
  tabTxt:           { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium, color: theme.colors.textMuted },
  tabTxtActive:     { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, color: theme.colors.primary },
  emptyTxt:         { textAlign: 'center', color: theme.colors.textMuted, padding: 32, fontSize: theme.fontSize.sm },
  row:              { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: 10, marginBottom: 6, ...theme.shadow.sm },
  rowIcon:          { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rowBody:          { flex: 1 },
  rowTitle:         { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semiBold, color: theme.colors.textPrimary },
  rowSub:           { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  rowSub2:          { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  conflict:         { fontSize: theme.fontSize.xs, color: theme.colors.warning, marginTop: 2 },
  chip:             { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full, marginLeft: 6 },
  chipTxt:          { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semiBold },
  roundBadge:       { width: 38, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, borderRadius: theme.borderRadius.sm, borderWidth: 1, marginRight: 10 },
  roundBadgeTxt:    { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold },
  actionBar:        { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, ...theme.shadow.md },
  discardBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: theme.colors.error, borderRadius: theme.borderRadius.lg, paddingVertical: 13 },
  discardTxt:       { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semiBold, color: theme.colors.error },
  confirmBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.success, borderRadius: theme.borderRadius.lg, paddingVertical: 13 },
  confirmBtnOff:    { backgroundColor: theme.colors.textMuted },
  confirmTxt:       { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold, color: '#fff' },
});
