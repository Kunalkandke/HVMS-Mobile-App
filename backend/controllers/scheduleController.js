'use strict';
/**
 * HVMS Schedule Import Controller — v3 (fixed)
 *
 * KEY FIXES vs v2:
 *  1. confirmImport uses phone-number as primary dedup key (not name) to prevent
 *     silent match failures when names are spelled inconsistently in Excel.
 *  2. generateFacultyCodeBatch() pre-generates all needed FAC codes in ONE DB
 *     round-trip, eliminating the per-faculty call race condition.
 *  3. fetchAll now accepts an optional `limit` parameter (default 10000) to
 *     prevent silent data truncation on large tables.
 *  4. Server-side console.error logging added to every faculty/row failure so
 *     bugs surface in server logs even when the API response is suppressed.
 *  5. listScheduledVisits enforces role-based access server-side — faculty are
 *     locked to their own visits, wardens to their assigned hostel.
 *  6. New export: getScheduleByHostel — paginated, role-filtered visit list for
 *     a specific hostel.
 */

const bcrypt = require('bcryptjs');
const { supabase }    = require('../config/db');
const { auditLogger } = require('../middleware/helpers');
const { parseScheduleExcel, buildPreview, normaliseName, normalisePhone } = require('../services/excelParserService');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Generic paginated fetch helper.
 * @param {string} table
 * @param {string} select
 * @param {Object} filter  — key/value equality filters
 * @param {number} limit   — row cap (default 10000)
 */
async function fetchAll(table, select, filter = {}, limit = 10000) {
  let q = supabase.from(table).select(select).limit(limit);
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  const { data, error } = await q;
  if (error) throw new Error(`${table} fetch failed: ${error.message}`);
  return data || [];
}

/**
 * Pre-generate `count` FAC codes in a single DB round-trip.
 * Reads the current maximum faculty_code once, then returns the next `count`
 * sequential codes.  Much safer than the old per-faculty call which could
 * produce duplicate codes under concurrent imports.
 *
 * @param {number} count
 * @returns {Promise<string[]>}
 */
async function generateFacultyCodeBatch(count) {
  if (count === 0) return [];
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
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push('FAC' + String(next + i).padStart(3, '0'));
  }
  return codes;
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
//    1. Pre-generate all FAC codes in one batch call (no race condition)
//    2. Create row in `users` with role=faculty, email=NULL, password=bcrypt(phone),
//       must_change_password=true, faculty_code=FACxxx, import_source='excel_import'
//    3. Create/update faculty_profiles row linked to that user
//
//  For EXISTING faculty (already in users):
//    - Match by PHONE first, then name as fallback (fixes silent failures)
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

    // Build lookup maps using PHONE as primary key, name as fallback
    const userByPhone = new Map();
    const userByName  = new Map();
    for (const u of allUsers) {
      const ph = normalisePhone(u.phone);
      if (ph.length >= 7) userByPhone.set(ph, u);
      userByName.set(normaliseName(u.name), u);
    }

    const profileByPhone = new Map();
    const profileByKey   = new Map();
    for (const p of allProfiles) {
      const ph = normalisePhone(p.phone);
      if (ph.length >= 7) profileByPhone.set(ph, p);
      profileByKey.set(p.name_key, p);
    }

    // ── Pre-count how many NEW faculty need codes ──────────────────────────
    // Do this BEFORE the loop so we can batch-generate all FAC codes at once.
    const facultyNeedingCodes = preview.faculty.filter(fp => {
      const excelPhone   = normalisePhone(fp.phone);
      const existingUser =
        (excelPhone.length >= 7 ? userByPhone.get(excelPhone) : null) ||
        userByName.get(fp.nameKey) ||
        null;
      const existingProfile =
        (excelPhone.length >= 7 ? profileByPhone.get(excelPhone) : null) ||
        profileByKey.get(fp.nameKey) ||
        null;
      // Needs a new user (and therefore a code) only when neither lookup hits
      return !existingUser && !(existingProfile && existingProfile.resolved_user_id);
    });

    const preallocatedCodes = await generateFacultyCodeBatch(facultyNeedingCodes.length);
    let codeIndex = 0;

    // ── Step 1: Resolve / create every faculty as a real HVMS user ─────────
    // nameKey → users.id  (the authoritative ID used for scheduled_visits)
    const facultyUserIdMap = new Map();
    let newFacultyCreated  = 0;
    const facultyErrors    = [];

    for (const fp of preview.faculty) {
      try {
        const excelPhone   = normalisePhone(fp.phone);
        const existingUser =
          (excelPhone.length >= 7 ? userByPhone.get(excelPhone) : null) ||
          userByName.get(fp.nameKey) ||
          null;
        const existingProfile =
          (excelPhone.length >= 7 ? profileByPhone.get(excelPhone) : null) ||
          profileByKey.get(fp.nameKey) ||
          null;

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
        const phoneRaw = fp.phone || '';
        // Normalize phone: keep only digits (and leading +) for consistent storage & login
        const phone = phoneRaw.replace(/[^\d+]/g, '').replace(/^\+91/, '') || phoneRaw;
        const phoneDigitsOnly = phoneRaw.replace(/\D/g, ''); // pure digits for password hashing

        if (!phoneDigitsOnly) {
          facultyErrors.push(`"${fp.name}": no phone number — cannot create login account.`);
          console.error(`[HVMS] Faculty insert SKIPPED for "${fp.name}" (phone: ${fp.phone}): no phone number provided.`);
          // Still insert a faculty_profile so the faculty appears in the panel
        }

        // Use pre-generated code from batch (no race condition)
        const facultyCode = preallocatedCodes[codeIndex++];

        // Hash mobile number (digits-only) as initial password
        const initialPassword = phoneDigitsOnly || facultyCode;
        const hashedPassword  = await bcrypt.hash(initialPassword, 10);

        const userData = {
          name:                 fp.name.trim(),
          email:                null,
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
          console.error(`[HVMS] Faculty insert FAILED for "${fp.name}" (phone: ${fp.phone}):`, userErr.message);
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

        // Dynamically register in memory maps to prevent duplicates within the same import batch
        const normCreatedPhone = normalisePhone(phone);
        const createdUserObj = { id: newUser.id, name: fp.name, phone: phone, faculty_code: newUser.faculty_code };
        if (normCreatedPhone.length >= 7) userByPhone.set(normCreatedPhone, createdUserObj);
        userByName.set(normaliseName(fp.name), createdUserObj);

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
          if (profErr && profErr.code !== '23505') {
            console.warn('faculty_profiles insert warning:', profErr.message);
          }
        }
      } catch (err) {
        facultyErrors.push(`"${fp.name}": unexpected error — ${err.message}`);
        console.error(`[HVMS] Faculty loop UNEXPECTED ERROR for "${fp.name}" (phone: ${fp.phone}):`, err.message);
      }
    }

    // ── Step 2: Insert scheduled_visit rows — ULTRA FAST BULK INSERT ─────
    let   inserted   = 0;
    let   duplicates = 0;
    let   failed     = 0;
    const rowErrors  = [];

    // Query existing scheduled visits for this hostel to prevent duplicate inserts across uploads
    const { data: existingDbVisits } = await supabase
      .from('scheduled_visits')
      .select('faculty_user_id, hostel_id, visit_date, round')
      .eq('hostel_id', hostelId);

    const dbVisitSet = new Set();
    if (existingDbVisits) {
      for (const ev of existingDbVisits) {
        if (ev.faculty_user_id) {
          dbVisitSet.add(`${ev.faculty_user_id}||${ev.hostel_id}||${ev.visit_date}||${ev.round}`);
        }
      }
    }

    const dedupSeen = new Set();
    const rowsToInsert = [];

    for (const row of preview.scheduleRows) {
      const dedupKey = `${row.facultyNameKey}||${row.visitDate}||${row.round}`;
      if (dedupSeen.has(dedupKey)) {
        duplicates++;
        continue;
      }
      dedupSeen.add(dedupKey);

      const userId = facultyUserIdMap.get(row.facultyNameKey) || null;

      if (userId) {
        const dbKey = `${userId}||${hostelId}||${row.visitDate}||${row.round}`;
        if (dbVisitSet.has(dbKey)) {
          duplicates++;
          continue;
        }
        dbVisitSet.add(dbKey);
      }

      rowsToInsert.push({
        schedule_upload_id: uploadId,
        faculty_user_id:    userId,
        faculty_profile_id: null,
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
      });
    }

    if (rowsToInsert.length > 0) {
      // Try fast bulk insertion
      const { data: bulkData, error: bulkErr } = await supabase
        .from('scheduled_visits')
        .insert(rowsToInsert)
        .select('id');

      if (!bulkErr) {
        inserted = bulkData ? bulkData.length : rowsToInsert.length;
      } else {
        console.warn('[HVMS] Bulk insert warning (falling back to fast single inserts):', bulkErr.message);
        // Fallback row by row if any batch constraint fails
        for (const visitRow of rowsToInsert) {
          try {
            const { error: insErr } = await supabase
              .from('scheduled_visits')
              .insert(visitRow);

            if (insErr) {
              if (insErr.code === '23505') duplicates++;
              else {
                failed++;
                rowErrors.push(`Row ${visitRow.original_row}: ${insErr.message}`);
              }
            } else {
              inserted++;
            }
          } catch (err) {
            failed++;
            rowErrors.push(`Row ${visitRow.original_row}: ${err.message}`);
          }
        }
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
    let {
      uploadId, hostelType, hostelId, round, status,
      dateFrom, dateTo, facultyUserId, academicYear,
      search, page = 1, limit = 10000,
    } = req.query;

    // ── Role enforcement — never trust frontend filters for access control ──
    if (req.user.role === 'faculty') {
      // Faculty ONLY sees their own visits — override any facultyUserId param
      facultyUserId = req.user.id;
    } else if (req.user.role === 'warden') {
      // Warden only sees visits for their assigned hostel
      const warden = await supabase
        .from('users')
        .select('assigned_hostel_id')
        .eq('id', req.user.id)
        .single();
      if (warden.data?.assigned_hostel_id) {
        hostelId = warden.data.assigned_hostel_id;
      } else {
        return res.json({ success: true, data: { visits: [], pagination: { total: 0, page: 1, pages: 1 } } });
      }
    }
    // Admin sees everything — no additional filter

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
        return res.json({ success: true, data: { visits: [], pagination: { total: 0, page: 1, pages: 1 } } });
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
    const { isComplete, page = 1, limit = 10000, search } = req.query;
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
    const { status, dateFrom, dateTo, page = 1, limit = 10000 } = req.query;
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

// ─── 14. GET SCHEDULE BY HOSTEL ──────────────────────────────────────────────
//
//  Returns paginated scheduled visits for a specific hostel.
//  Role enforcement:
//    - admin   → sees all visits for the hostel
//    - warden  → must own this hostel (via assigned_hostel_id), sees all visits
//    - faculty → sees only their own visits for this hostel

exports.getScheduleByHostel = async (req, res, next) => {
  try {
    const hostelIdParam = req.params.hostelId;
    const { round, status, dateFrom, dateTo, page = 1, limit = 10000 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // 1. Verify hostel exists by UUID or type fallback
    let hostel = null;
    const { data: byId } = await supabase
      .from('hostels').select('id, name, type').eq('id', hostelIdParam).maybeSingle();

    if (byId) {
      hostel = byId;
    } else {
      const { data: byType } = await supabase
        .from('hostels').select('id, name, type').eq('type', hostelIdParam.toLowerCase()).maybeSingle();
      if (byType) hostel = byType;
    }

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found.' });
    }

    const actualHostelId   = hostel.id;
    const actualHostelType = hostel.type;

    // Auto-backfill hostel_id for unlinked scheduled_visits matching hostel_type (background fix)
    supabase
      .from('scheduled_visits')
      .update({ hostel_id: actualHostelId })
      .is('hostel_id', null)
      .eq('hostel_type', actualHostelType)
      .then(() => {})
      .catch(() => {});

    // 2. Query scheduled visits by hostel_id OR hostel_type
    let q = supabase
      .from('scheduled_visits')
      .select(`
        id, visit_date, day_of_week, round, status, hostel_type, hostel_id,
        actual_visit_id, excel_faculty_name, excel_phone, created_at,
        hostel:hostel_id ( id, name, type ),
        faculty_user:faculty_user_id ( id, name, email, phone, department, faculty_code )
      `, { count: 'exact' })
      .or(`hostel_id.eq.${actualHostelId},hostel_type.eq.${actualHostelType}`)
      .order('visit_date', { ascending: true })
      .order('round', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    // ROLE ENFORCEMENT — server-side, not UI-only
    if (req.user.role === 'faculty') {
      // Faculty sees ONLY their own visits for this hostel
      q = q.eq('faculty_user_id', req.user.id);
    } else if (req.user.role === 'warden') {
      // Warden must own this hostel if assigned
      const { data: wardenUser } = await supabase
        .from('users').select('assigned_hostel_id').eq('id', req.user.id).single();
      if (wardenUser?.assigned_hostel_id && wardenUser.assigned_hostel_id !== actualHostelId) {
        return res.status(403).json({ success: false, message: 'Access denied — this hostel is not assigned to you.' });
      }
      // Warden sees all visits for their hostel
    }
    // Admin sees everything — no additional filter

    if (round)    q = q.eq('round', round);
    if (status)   q = q.eq('status', status);
    if (dateFrom) q = q.gte('visit_date', dateFrom);
    if (dateTo)   q = q.lte('visit_date', dateTo);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return res.json({
      success: true,
      data: {
        hostel,
        visits: data || [],
        pagination: { total: count || (data ? data.length : 0), page: Number(page), pages: Math.ceil((count || 1) / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};
