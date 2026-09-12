'use strict';
/**
 * HVMS Schedule Import Controller — v2 (fixed)
 *
 * KEY FIXES vs v1:
 *  1. confirmImport now creates real rows in `users` table (role=faculty) —
 *     not just faculty_profiles — so faculty appear in Faculty Management panel.
 *  2. Generates FAC001…FAC999 faculty codes stored in users.faculty_code.
 *  3. Hashes mobile number as initial password; sets must_change_password=true.
 *  4. Scheduled_visit insertion is now row-by-row with per-row error handling,
 *     so a single duplicate never silently kills an entire batch of 200 rows.
 *  5. faculty_profiles.resolved_user_id is set immediately on creation.
 *  6. All 4 rounds are always fully inserted from the preview.scheduleRows.
 */

const bcrypt = require('bcryptjs');
const { supabase }    = require('../config/db');
const { auditLogger } = require('../middleware/helpers');
const { parseScheduleExcel, buildPreview, normaliseName } = require('../services/excelParserService');

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchAll(table, select, filter = {}) {
  let q = supabase.from(table).select(select);
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  const { data, error } = await q;
  if (error) throw new Error(`${table} fetch failed: ${error.message}`);
  return data || [];
}

/**
 * Generate the next available FAC code (FAC001, FAC002, …).
 * Reads the current max faculty_code from the users table and increments.
 * Thread-safe enough for sequential imports; for concurrent imports a DB
 * sequence would be ideal, but this is sufficient for this use-case.
 */
async function generateFacultyCode() {
  const { data, error } = await supabase
    .from('users')
    .select('faculty_code')
    .like('faculty_code', 'FAC%')
    .order('faculty_code', { ascending: false })
    .limit(1);

  if (error) throw new Error('Could not query faculty codes: ' + error.message);

  let next = 1;
  if (data && data.length > 0 && data[0].faculty_code) {
    const num = parseInt(data[0].faculty_code.replace('FAC', ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return 'FAC' + String(next).padStart(3, '0');
}

// ─── 1. UPLOAD + PARSE + PREVIEW ─────────────────────────────────────────────

exports.uploadPreview = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Send an xlsx file in the "schedule" field.' });
    }

    const originalName = req.file.originalname || 'schedule.xlsx';
    const buffer       = req.file.buffer;

    let parseResult;
    try {
      parseResult = parseScheduleExcel(buffer, originalName);
    } catch (parseErr) {
      return res.status(422).json({ success: false, message: 'Excel parse error: ' + parseErr.message });
    }

    if (req.body?.academicYear) parseResult.academicYear = req.body.academicYear;

    const [allUsers, allHostels, allProfiles] = await Promise.all([
      fetchAll('users',            'id, name, phone, faculty_code', {}),
      fetchAll('hostels',          'id, name, type',                { is_active: true }),
      fetchAll('faculty_profiles', 'id, name_key, phone, resolved_user_id', {}),
    ]);

    const preview = buildPreview(parseResult, allUsers, allHostels, allProfiles);

    // Duplicate upload detection
    if (parseResult.hostelType && parseResult.academicYear) {
      const { data: existing } = await supabase
        .from('schedule_uploads')
        .select('id, file_name, uploaded_at')
        .eq('hostel_type',   parseResult.hostelType)
        .eq('academic_year', parseResult.academicYear)
        .eq('status',        'confirmed');
      if (existing && existing.length > 0) {
        preview.warnings.unshift(
          `A confirmed ${parseResult.hostelType} schedule for ${parseResult.academicYear} already exists ` +
          `(${new Date(existing[0].uploaded_at).toLocaleDateString()}). ` +
          `Consider deleting the old one before confirming this import.`
        );
      }
    }

    const { data: uploadRecord, error: insertErr } = await supabase
      .from('schedule_uploads')
      .insert({
        file_name:              originalName,
        original_file_name:     originalName,
        academic_year:          parseResult.academicYear || 'Unknown',
        hostel_type:            parseResult.hostelType   || 'boys',
        uploaded_by:            req.user.id,
        status:                 'previewed',
        total_faculty:          preview.facultySummary.total,
        new_faculty:            preview.facultySummary.newFaculty,
        existing_faculty:       preview.facultySummary.existingFaculty,
        total_schedule_records: preview.scheduleSummary.totalRows,
        validation_error_count: preview.warnings.length,
        preview_data:           preview,
        parse_warnings:         preview.warnings,
      })
      .select('id, status, uploaded_at')
      .single();

    if (insertErr) throw new Error('Could not save upload record: ' + insertErr.message);

    auditLogger(req.user.id, 'SCHEDULE_UPLOAD_PREVIEW', uploadRecord.id, 'ScheduleUpload',
      { fileName: originalName, hostelType: parseResult.hostelType }, req.ip);

    return res.status(200).json({
      success:  true,
      message:  'Excel parsed. Review the preview then confirm to import.',
      uploadId: uploadRecord.id,
      preview,
    });
  } catch (err) { next(err); }
};

// ─── 2. CONFIRM IMPORT ────────────────────────────────────────────────────────
//
//  For NEW faculty (not yet in users table):
//    1. Generate FAC code
//    2. Create row in `users` with role=faculty, email=NULL, password=bcrypt(phone),
//       must_change_password=true, faculty_code=FACxxx, import_source='excel_import'
//    3. Create/update faculty_profiles row linked to that user
//
//  For EXISTING faculty (already in users):
//    - Use existing user.id directly
//    - Update faculty_profiles.resolved_user_id if not already set
//
//  Schedule insertion:
//    - Row-by-row with individual try/catch
//    - Count inserted, skipped (duplicate), failed

exports.confirmImport = async (req, res, next) => {
  try {
    const uploadId = req.params.id;

    const { data: upload, error: fetchErr } = await supabase
      .from('schedule_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (fetchErr || !upload)
      return res.status(404).json({ success: false, message: 'Upload record not found.' });
    if (upload.status === 'confirmed')
      return res.status(400).json({ success: false, message: 'This upload has already been confirmed.' });
    if (upload.status === 'rejected')
      return res.status(400).json({ success: false, message: 'This upload was rejected.' });

    const preview = upload.preview_data;
    if (!preview)
      return res.status(400).json({ success: false, message: 'No preview data found. Re-upload the file.' });
    if (preview.hasBlockingErrors)
      return res.status(400).json({ success: false, message: 'Cannot confirm — blocking errors exist (e.g. no hostel matched).', warnings: preview.warnings });

    const hostelId   = preview.meta?.hostelMatch?.id   || null;
    const hostelType = preview.meta?.hostelType        || upload.hostel_type;

    if (!hostelId)
      return res.status(400).json({ success: false, message: 'No hostel matched. Cannot create schedule records.' });

    // ── Re-fetch live DB state ─────────────────────────────────────────────
    const [allUsers, allProfiles] = await Promise.all([
      fetchAll('users',            'id, name, phone, faculty_code, import_source', {}),
      fetchAll('faculty_profiles', 'id, name_key, phone, resolved_user_id, is_complete', {}),
    ]);

    const userByKey    = new Map(allUsers.map(u    => [normaliseName(u.name), u]));
    const profileByKey = new Map(allProfiles.map(p => [p.name_key, p]));

    // ── Step 1: Resolve / create every faculty as a real HVMS user ─────────
    // nameKey → users.id  (the authoritative ID used for scheduled_visits)
    const facultyUserIdMap = new Map();
    let newFacultyCreated  = 0;
    const facultyErrors    = [];

    for (const fp of preview.faculty) {
      try {
        const existingUser    = userByKey.get(fp.nameKey) || null;
        const existingProfile = profileByKey.get(fp.nameKey) || null;

        if (existingUser) {
          // Already a full HVMS user — use as-is
          facultyUserIdMap.set(fp.nameKey, existingUser.id);

          // If there's an existing profile without a resolved_user_id, link it now
          if (existingProfile && !existingProfile.resolved_user_id) {
            await supabase.from('faculty_profiles')
              .update({ resolved_user_id: existingUser.id, is_complete: true })
              .eq('id', existingProfile.id);
          }
          continue;
        }

        if (existingProfile && existingProfile.resolved_user_id) {
          // Profile already linked to a user
          facultyUserIdMap.set(fp.nameKey, existingProfile.resolved_user_id);
          continue;
        }

        // ── CREATE a new HVMS user for this faculty ────────────────────────
        const phone = fp.phone || '';
        if (!phone) {
          facultyErrors.push(`"${fp.name}": no phone number — cannot create login account.`);
          // Still insert a faculty_profile so the faculty appears in the panel
        }

        // Generate unique faculty code
        const facultyCode = await generateFacultyCode();

        // Hash mobile number as initial password
        const initialPassword = phone || facultyCode; // fallback to code if no phone
        const hashedPassword  = await bcrypt.hash(initialPassword, 12);

        const userData = {
          name:                 fp.name.trim(),
          email:                null,            // nullable — to be filled by Admin
          password:             hashedPassword,
          role:                 'faculty',
          department:           '',
          phone:                phone,
          faculty_code:         facultyCode,
          must_change_password: true,
          is_active:            true,
          import_source:        'excel_import',
        };

        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert(userData)
          .select('id, name, faculty_code')
          .single();

        if (userErr) {
          // Check if it's a unique constraint race — someone else just created this user
          if (userErr.code === '23505') {
            const { data: raceUser } = await supabase
              .from('users')
              .select('id')
              .or(`faculty_code.eq.${facultyCode},phone.eq.${phone}`)
              .limit(1)
              .single();
            if (raceUser) {
              facultyUserIdMap.set(fp.nameKey, raceUser.id);
              continue;
            }
          }
          facultyErrors.push(`"${fp.name}": user creation failed — ${userErr.message}`);
          continue;
        }

        facultyUserIdMap.set(fp.nameKey, newUser.id);
        newFacultyCreated++;

        // Create or update faculty_profiles row, now fully linked
        if (existingProfile) {
          await supabase.from('faculty_profiles')
            .update({ resolved_user_id: newUser.id, is_complete: true })
            .eq('id', existingProfile.id);
        } else {
          const { error: profErr } = await supabase.from('faculty_profiles').insert({
            name:             fp.name,
            phone:            phone,
            name_key:         fp.nameKey,
            source:           'excel',
            is_complete:      true,
            resolved_user_id: newUser.id,
          });
          // Ignore duplicate profile (race condition) — the user was already created
          if (profErr && profErr.code !== '23505') {
            console.warn('faculty_profiles insert warning:', profErr.message);
          }
        }
      } catch (err) {
        facultyErrors.push(`"${fp.name}": unexpected error — ${err.message}`);
      }
    }

    // ── Step 2: Insert scheduled_visit rows — ONE BY ONE ───────────────────
    // Never batch — a single duplicate in a 200-row batch previously killed
    // the entire batch silently.  Row-by-row lets us count exactly.

    let   inserted   = 0;
    let   duplicates = 0;
    let   failed     = 0;
    const rowErrors  = [];

    // Dedup set — prevent sending the same record twice from the preview array
    const dedupSeen = new Set();

    for (const row of preview.scheduleRows) {
      // Build a dedup key that is round-specific so all 4 rounds are always inserted
      const dedupKey = `${row.facultyNameKey}||${row.visitDate}||${row.round}`;
      if (dedupSeen.has(dedupKey)) {
        duplicates++;
        continue;
      }
      dedupSeen.add(dedupKey);

      const userId = facultyUserIdMap.get(row.facultyNameKey) || null;

      const visitRow = {
        schedule_upload_id: uploadId,
        faculty_user_id:    userId,
        faculty_profile_id: null,   // no longer needed once userId is set
        hostel_id:          hostelId,
        hostel_type:        hostelType,
        visit_date:         row.visitDate,
        day_of_week:        row.dayOfWeek,
        round:              row.round,
        status:             'scheduled',
        original_sheet:     row.originalSheet,
        original_row:       row.originalRow,
        excel_faculty_name: row.facultyName,
        excel_phone:        row.facultyPhone,
      };

      try {
        const { error: insErr } = await supabase
          .from('scheduled_visits')
          .insert(visitRow);

        if (insErr) {
          if (insErr.code === '23505') {
            // True duplicate (same user + date + round already in DB)
            duplicates++;
          } else {
            failed++;
            rowErrors.push(`Row ${row.originalRow} (${row.round} ${row.visitDate} ${row.facultyName}): ${insErr.message}`);
          }
        } else {
          inserted++;
        }
      } catch (err) {
        failed++;
        rowErrors.push(`Row ${row.originalRow}: ${err.message}`);
      }
    }

    // ── Step 3: Mark upload confirmed ─────────────────────────────────────
    await supabase
      .from('schedule_uploads')
      .update({
        status:                 'confirmed',
        confirmed_at:           new Date().toISOString(),
        total_schedule_records: inserted,
        new_faculty:            newFacultyCreated,
      })
      .eq('id', uploadId);

    auditLogger(req.user.id, 'SCHEDULE_IMPORT_CONFIRMED', uploadId, 'ScheduleUpload',
      { inserted, duplicates, failed, newFacultyCreated, hostelType, hostelId }, req.ip);

    const allErrors = [...facultyErrors, ...rowErrors];

    return res.json({
      success: true,
      message: `Import confirmed. ${inserted} visits scheduled, ${newFacultyCreated} new faculty accounts created.`,
      data: {
        uploadId,
        totalVisitsInserted:  inserted,
        duplicatesSkipped:    duplicates,
        failedRows:           failed,
        newFacultyCreated,
        hostelName:           preview.meta?.hostelMatch?.name,
        errors:               allErrors.length > 0 ? allErrors : undefined,
      },
    });
  } catch (err) { next(err); }
};

// ─── 3. REJECT / DISCARD ─────────────────────────────────────────────────────

exports.rejectUpload = async (req, res, next) => {
  try {
    const { data: upload, error } = await supabase
      .from('schedule_uploads').select('id, status').eq('id', req.params.id).single();

    if (error || !upload)
      return res.status(404).json({ success: false, message: 'Upload not found.' });
    if (upload.status === 'confirmed')
      return res.status(400).json({ success: false, message: 'Cannot reject a confirmed upload. Use delete instead.' });

    await supabase.from('schedule_uploads')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', req.params.id);

    auditLogger(req.user.id, 'SCHEDULE_UPLOAD_REJECTED', req.params.id, 'ScheduleUpload', {}, req.ip);
    return res.json({ success: true, message: 'Upload rejected.' });
  } catch (err) { next(err); }
};

// ─── 4. LIST UPLOADS ─────────────────────────────────────────────────────────

exports.listUploads = async (req, res, next) => {
  try {
    const { status, hostelType, academicYear } = req.query;
    let q = supabase
      .from('schedule_uploads')
      .select(`id, file_name, original_file_name, academic_year, hostel_type,
               status, uploaded_at, confirmed_at,
               total_faculty, new_faculty, existing_faculty,
               total_schedule_records, validation_error_count, parse_warnings,
               uploader:uploaded_by ( id, name, email )`)
      .order('uploaded_at', { ascending: false });

    if (status)       q = q.eq('status',       status);
    if (hostelType)   q = q.eq('hostel_type',   hostelType);
    if (academicYear) q = q.eq('academic_year', academicYear);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
};

// ─── 5. GET SINGLE UPLOAD ────────────────────────────────────────────────────

exports.getUpload = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('schedule_uploads')
      .select('*, uploader:uploaded_by ( id, name, email )')
      .eq('id', req.params.id).single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Upload not found.' });
    return res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── 6. DELETE UPLOAD ────────────────────────────────────────────────────────

exports.deleteUpload = async (req, res, next) => {
  try {
    const uploadId = req.params.id;

    const { data: upload, error: fetchErr } = await supabase
      .from('schedule_uploads').select('id, status, file_name, total_schedule_records')
      .eq('id', uploadId).single();

    if (fetchErr || !upload)
      return res.status(404).json({ success: false, message: 'Upload not found.' });

    // Preserve scheduled visits that are already linked to actual visits
    // by nulling their upload FK instead of cascade-deleting them
    const { count: linkedCount } = await supabase
      .from('scheduled_visits')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_upload_id', uploadId)
      .not('actual_visit_id', 'is', null);

    if (linkedCount > 0) {
      await supabase.from('scheduled_visits')
        .update({ schedule_upload_id: null })
        .eq('schedule_upload_id', uploadId)
        .not('actual_visit_id', 'is', null);
    }

    const { error: delErr } = await supabase
      .from('schedule_uploads').delete().eq('id', uploadId);
    if (delErr) throw new Error(delErr.message);

    auditLogger(req.user.id, 'SCHEDULE_UPLOAD_DELETED', uploadId, 'ScheduleUpload',
      { fileName: upload.file_name, linkedCount }, req.ip);

    return res.json({
      success: true,
      message: `Upload deleted. ${linkedCount} visits linked to actual visits were preserved.`,
    });
  } catch (err) { next(err); }
};

// ─── 7. LIST SCHEDULED VISITS ────────────────────────────────────────────────

exports.listScheduledVisits = async (req, res, next) => {
  try {
    const {
      uploadId, hostelType, hostelId, round, status,
      dateFrom, dateTo, facultyUserId, academicYear,
      search, page = 1, limit = 30,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('scheduled_visits')
      .select(`
        id, visit_date, day_of_week, round, status, hostel_type,
        actual_visit_id, original_sheet, original_row,
        excel_faculty_name, excel_phone, created_at,
        schedule_upload:schedule_upload_id ( id, file_name, academic_year, status ),
        hostel:hostel_id ( id, name, type ),
        faculty_user:faculty_user_id ( id, name, email, phone, department, faculty_code )
      `, { count: 'exact' })
      .order('visit_date', { ascending: true })
      .order('round',      { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (uploadId)      q = q.eq('schedule_upload_id', uploadId);
    if (hostelType)    q = q.eq('hostel_type',        hostelType);
    if (hostelId)      q = q.eq('hostel_id',          hostelId);
    if (round)         q = q.eq('round',              round);
    if (status)        q = q.eq('status',             status);
    if (facultyUserId) q = q.eq('faculty_user_id',    facultyUserId);
    if (dateFrom)      q = q.gte('visit_date',        dateFrom);
    if (dateTo)        q = q.lte('visit_date',        dateTo);
    if (search)        q = q.ilike('excel_faculty_name', `%${search}%`);

    if (academicYear) {
      const { data: uploadIds } = await supabase
        .from('schedule_uploads').select('id').eq('academic_year', academicYear);
      const ids = (uploadIds || []).map(u => u.id);
      if (ids.length === 0) {
        return res.json({ success: true, data: { visits: [], pagination: { total:0, page:1, pages:1 } } });
      }
      q = q.in('schedule_upload_id', ids);
    }

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return res.json({
      success: true,
      data: {
        visits: data || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ─── 8. GET SINGLE SCHEDULED VISIT ───────────────────────────────────────────

exports.getScheduledVisit = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('scheduled_visits')
      .select(`*,
        schedule_upload:schedule_upload_id ( id, file_name, academic_year, hostel_type, status ),
        hostel:hostel_id ( id, name, type, location ),
        faculty_user:faculty_user_id ( id, name, email, phone, department, faculty_code )
      `)
      .eq('id', req.params.id).single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Scheduled visit not found.' });
    return res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── 9. LIST FACULTY PROFILES ────────────────────────────────────────────────

exports.listFacultyProfiles = async (req, res, next) => {
  try {
    const { isComplete, page = 1, limit = 30, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('faculty_profiles')
      .select(`id, name, phone, is_complete, is_active, source, created_at,
               resolved_user:resolved_user_id ( id, name, email, role, department, faculty_code )`,
        { count: 'exact' })
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (isComplete !== undefined && isComplete !== '')
      q = q.eq('is_complete', isComplete === 'true');
    if (search) q = q.ilike('name', `%${search}%`);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return res.json({
      success: true,
      data: {
        profiles: data || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ─── 10. GET SINGLE FACULTY PROFILE ──────────────────────────────────────────

exports.getFacultyProfile = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('faculty_profiles')
      .select(`*, resolved_user:resolved_user_id ( id, name, email, role, department, phone, is_active, faculty_code )`)
      .eq('id', req.params.id).single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Faculty profile not found.' });

    const { count: visitCount } = await supabase
      .from('scheduled_visits')
      .select('id', { count: 'exact', head: true })
      .eq('faculty_user_id', data.resolved_user_id);

    return res.json({ success: true, data: { ...data, scheduledVisitCount: visitCount || 0 } });
  } catch (err) { next(err); }
};

// ─── 11. UPDATE FACULTY PROFILE ──────────────────────────────────────────────

exports.updateFacultyProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name  !== undefined) { updates.name = name.trim(); updates.name_key = normaliseName(name.trim()); }
    if (phone !== undefined) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'Nothing to update.' });

    const { data, error } = await supabase
      .from('faculty_profiles').update(updates)
      .eq('id', req.params.id)
      .select('id, name, phone, is_complete, name_key').single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Profile not found.' });

    auditLogger(req.user.id, 'FACULTY_PROFILE_UPDATED', req.params.id, 'FacultyProfile', updates, req.ip);
    return res.json({ success: true, message: 'Faculty profile updated.', data });
  } catch (err) { next(err); }
};

// ─── 12. COMPLETE FACULTY PROFILE → link to existing HVMS user ───────────────

exports.completeFacultyProfile = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId)
      return res.status(400).json({ success: false, message: 'userId is required.' });

    const { data: user, error: userErr } = await supabase
      .from('users').select('id, name, email, role, phone').eq('id', userId).single();
    if (userErr || !user)
      return res.status(404).json({ success: false, message: 'HVMS user not found.' });

    const { data: profile, error: profileErr } = await supabase
      .from('faculty_profiles').select('id, name_key').eq('id', req.params.id).single();
    if (profileErr || !profile)
      return res.status(404).json({ success: false, message: 'Faculty profile not found.' });

    const { data: updated, error: updateErr } = await supabase
      .from('faculty_profiles')
      .update({ resolved_user_id: userId, is_complete: true })
      .eq('id', req.params.id)
      .select('id, name, phone, is_complete, resolved_user_id').single();
    if (updateErr) throw new Error(updateErr.message);

    await supabase.from('scheduled_visits')
      .update({ faculty_user_id: userId })
      .eq('faculty_profile_id', req.params.id);

    auditLogger(req.user.id, 'FACULTY_PROFILE_COMPLETED', req.params.id, 'FacultyProfile', { userId }, req.ip);
    return res.json({ success: true, message: `Profile linked to "${user.name}". Scheduled visits updated.`, data: updated });
  } catch (err) { next(err); }
};

// ─── 13. MY SCHEDULE (faculty sees own visits only) ───────────────────────────

exports.getMySchedule = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabase
      .from('scheduled_visits')
      .select(`
        id, visit_date, day_of_week, round, status, hostel_type,
        actual_visit_id, excel_faculty_name,
        hostel:hostel_id ( id, name, type, location ),
        schedule_upload:schedule_upload_id ( id, academic_year )
      `, { count: 'exact' })
      .eq('faculty_user_id', req.user.id)
      .order('visit_date', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (status)   q = q.eq('status',     status);
    if (dateFrom) q = q.gte('visit_date', dateFrom);
    if (dateTo)   q = q.lte('visit_date', dateTo);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return res.json({
      success: true,
      data: {
        visits: data || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};
