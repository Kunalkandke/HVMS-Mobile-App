'use strict';
/**
 * HVMS Excel Parser Service — v2 (fixed)
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses the MIT Chhatrapati Sambhajinagar Anti-Ragging Squad Schedule Excel.
 *
 * EXCEL STRUCTURE (identical for Boys & Girls files, single sheet):
 *
 *  Row 0: Title       — "Hostel Squad Schedule" / "Squad Schedule"
 *  Row 1: blank
 *  Row 2: Institution — "Maharashtra Institute of Technology, Chhatrapati…"
 *  Row 3: Year title  — "Anti Ragging Visiting staff Squad 2026-2027"
 *  Row 4: Hostel type — "Schedule for Girls' Hostel" / "Schedule for Boys Hostel"
 *  Row 5: Headers     — Round -I | Round -II | Round -III | Round -IV | Faculty -I | Contact No | Faculty -II | Contact No
 *  Row 6+: DATA ROWS
 *  Footer rows: Note / Coordinator / Director  →  skipped
 *
 *  DATA ROW columns (0-indexed):
 *    [0] Round-I  date  (can be JS Date, number serial, or string "1-Aug-26")
 *    [1] Round-II date
 *    [2] Round-III date
 *    [3] Round-IV date
 *    [4] Faculty-I  Name
 *    [5] Faculty-I  Contact No  (may contain multiple numbers: "9876,5432")
 *    [6] Faculty-II Name
 *    [7] Faculty-II Contact No
 *
 *  CONTINUATION ROWS (Boys file):
 *    Cols [0-3] blank, col [4] = extra faculty name, col [5] = their phone.
 *    They belong to the same date-group as the row above.
 *
 *  Each DATA ROW → up to 4 date entries × N faculty = up to 4×N scheduled_visit records.
 */

const XLSX = require('xlsx');

// ─── Round labels — index matches column position 0-3 ─────────────────────────
const ROUND_LABELS = ['Round-I', 'Round-II', 'Round-III', 'Round-IV'];

const MONTH_MAP = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
};

// Rows whose concatenated text matches these patterns are skipped entirely
const SKIP_RE = [
  /note[\s:-]/i,
  /coordinator/i,
  /\bdirector\b/i,
  /maharashtra\s+institute/i,
  /anti[\s-]*ragging/i,
  /visiting\s+staff\s+squad/i,
  /schedule\s+for\s+(girls|boys)/i,
  /hostel\s+squad\s+schedule/i,
  /squad\s+schedule/i,
  // The header row itself
  /round\s*-?\s*i.*faculty\s*-?\s*i/i,
];

// ─── Cell helpers ─────────────────────────────────────────────────────────────

/** Any xlsx cell → trimmed string (never null). */
function cs(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
  return String(v).trim();
}

/**
 * Parse a cell value → ISO date "YYYY-MM-DD", or null.
 * Handles: JS Date, Excel serial number, "1-Aug-26", "2026-08-01", "01/08/2026".
 */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;

  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }

  if (typeof v === 'number') {
    if (v < 1) return null; // not a date serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return null;
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }

  const s = String(v).trim();
  if (!s) return null;

  // "1-Aug-26" or "01-Aug-2026"
  const m1 = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3})[\s\-\/](\d{2,4})$/);
  if (m1) {
    const mon = MONTH_MAP[m1[2].toLowerCase()];
    if (!mon) return null;
    let yr = m1[3];
    if (yr.length === 2) yr = '20' + yr;
    return `${yr}-${mon}-${m1[1].padStart(2,'0')}`;
  }

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const m3 = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})$/);
  if (m3) {
    let yr = m3[3];
    if (yr.length === 2) yr = '20' + yr;
    return `${yr}-${m3[2].padStart(2,'0')}-${m3[1].padStart(2,'0')}`;
  }

  return null;
}

/** ISO date → day-of-week string. */
function dow(iso) {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday:'long', timeZone:'UTC' });
  } catch { return null; }
}

/**
 * Extract the first usable phone number.
 * Handles: comma / semicolon / newline / slash separated lists,
 *          extra spaces, letters mixed in.
 */
function extractPhone(raw) {
  if (!raw) return '';
  const s = String(raw);
  // Split on common separators
  const parts = s.split(/[,;\n\/\\]+/);
  for (const p of parts) {
    const d = p.replace(/[^0-9+]/g, '').trim();
    if (d.length >= 7) return d;
  }
  // fallback: strip everything non-numeric
  const fb = s.replace(/[^0-9+]/g, '');
  return fb.length >= 7 ? fb.slice(0, 15) : '';
}

/**
 * Normalise a faculty name for deduplication.
 * Strips titles (Dr, Mr, Ms, Mrs, Prof, Ar), dots, extra spaces.
 */
function normaliseName(n) {
  if (!n) return '';
  return n
    .toLowerCase()
    .replace(/\b(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|ar\.?)\b\.?/gi, '')
    .replace(/\.+/g, ' ')
    .replace(/[,;'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if the row's text content should be skipped. */
function skipRow(cells) {
  const t = cells.map(cs).join(' ').trim();
  if (!t) return true;
  return SKIP_RE.some(r => r.test(t));
}

// ─── Metadata detection ───────────────────────────────────────────────────────

function detectHostelType(rows) {
  for (const row of rows.slice(0, 8)) {
    const t = row.map(cs).join(' ').toLowerCase();
    if (t.includes('girls')) return 'girls';
    if (t.includes('boys'))  return 'boys';
  }
  return null;
}

function detectAcademicYear(rows) {
  for (const row of rows.slice(0, 8)) {
    const t = row.map(cs).join(' ');
    const m = t.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return null;
}

/** Return 0-based index of the first data row (row after the header row). */
function findDataStart(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const t = rows[i].map(cs).join(' ').toLowerCase();
    // The header row contains both "round" and "faculty" and "contact"
    if (t.includes('round') && t.includes('faculty') && t.includes('contact')) {
      return i + 1;
    }
  }
  return 6; // safe fallback matching the known structure
}

// ─── Faculty dedup map helper ─────────────────────────────────────────────────

function upsertFaculty(map, rawName, nameKey, phone, rawPhone) {
  if (!nameKey) return null;
  if (map.has(nameKey)) {
    const e = map.get(nameKey);
    e.appearances += 1;
    if (phone && e.phone && phone !== e.phone && !e.conflictingPhones) {
      e.conflictingPhones = [e.phone, phone];
    }
    if (!e.phone && phone) { e.phone = phone; e.rawPhone = rawPhone; }
    return e;
  }
  const entry = { name: rawName, nameKey, phone, rawPhone, appearances: 1, conflictingPhones: null };
  map.set(nameKey, entry);
  return entry;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a Boys or Girls hostel schedule Excel buffer.
 *
 * Returns:
 * {
 *   hostelType:     'boys' | 'girls' | null,
 *   academicYear:   string | null,
 *   sheetName:      string,
 *   facultyList:    FacultyEntry[],
 *   scheduleGroups: ScheduleGroup[],
 *   warnings:       string[],
 * }
 *
 * ScheduleGroup = {
 *   dates:    [ { round:'Round-I', isoDate:'YYYY-MM-DD', dayOfWeek:'Saturday' }, … ],
 *   faculty:  [ { name, nameKey, phone, rawPhone, slot:'Faculty-I'|'Faculty-II'|'Faculty-III+' }, … ],
 *   originalRow: number,   // 1-based Excel row number of the primary row
 * }
 *
 * NOTE: dates[] will always contain ALL successfully-parsed rounds (up to 4).
 *       The build step expands each group into dates.length × faculty.length records.
 */
function parseScheduleExcel(buffer, fileName) {
  fileName = fileName || 'schedule.xlsx';
  const warnings = [];

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type:'buffer', cellDates:true, raw:false });
  } catch (e) {
    throw new Error('Failed to read Excel file: ' + e.message);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets.');

  const sheet   = workbook.Sheets[sheetName];
  // raw:true keeps Date objects and numbers unformatted so parseDate works correctly
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'', raw:true });

  if (!rawRows || rawRows.length === 0) throw new Error('Excel sheet is empty.');

  const hostelType   = detectHostelType(rawRows);
  const academicYear = detectAcademicYear(rawRows);
  const dataStart    = findDataStart(rawRows);

  if (!hostelType)   warnings.push('Could not detect hostel type (Boys/Girls) from file.');
  if (!academicYear) warnings.push('Could not detect academic year from file.');

  const facultyMap     = new Map();
  const scheduleGroups = [];
  let   currentGroup   = null;

  for (let ri = dataStart; ri < rawRows.length; ri++) {
    const row      = rawRows[ri];
    const excelRow = ri + 1; // 1-based for traceability

    if (skipRow(row)) continue;

    const c0 = row[0], c1 = row[1], c2 = row[2], c3 = row[3];
    const c4 = row[4], c5 = row[5], c6 = row[6], c7 = row[7];

    // ── Try to parse all 4 date columns ───────────────────────────────────
    // IMPORTANT: parse EVERY column independently, never stop at first failure.
    const parsedDates = [c0, c1, c2, c3].map((v, i) => {
      const iso = parseDate(v);
      if (!iso) return null;
      return { round: ROUND_LABELS[i], isoDate: iso, dayOfWeek: dow(iso) };
    });
    // Keep all 4 slots (some may be null if that round column was blank this row)
    const validDates = parsedDates.filter(Boolean);

    const fac1Name = cs(c4);
    const fac1Key  = normaliseName(fac1Name);

    // ── CONTINUATION ROW: all date cols blank, faculty name present ───────
    if (validDates.length === 0) {
      if (!fac1Key) continue;
      if (skipRow([c4, c5])) continue;
      if (!currentGroup) {
        warnings.push(`Row ${excelRow}: faculty "${fac1Name}" has no parent date group — skipped.`);
        continue;
      }
      const phone = extractPhone(cs(c5));
      upsertFaculty(facultyMap, fac1Name, fac1Key, phone, cs(c5));
      currentGroup.faculty.push({ name:fac1Name, nameKey:fac1Key, phone, rawPhone:cs(c5), slot:'Faculty-III+' });
      continue;
    }

    // ── PRIMARY DATA ROW ──────────────────────────────────────────────────
    // Warn only; do NOT skip the row because of missing dates.
    if (validDates.length < 4) {
      const rawVals = [c0,c1,c2,c3].map(cs).join(' | ');
      warnings.push(`Row ${excelRow}: only ${validDates.length}/4 round dates parsed [${rawVals}].`);
    }

    currentGroup = { dates: validDates, faculty: [], originalRow: excelRow };
    scheduleGroups.push(currentGroup);

    // Faculty-I
    if (fac1Key) {
      const phone = extractPhone(cs(c5));
      upsertFaculty(facultyMap, fac1Name, fac1Key, phone, cs(c5));
      currentGroup.faculty.push({ name:fac1Name, nameKey:fac1Key, phone, rawPhone:cs(c5), slot:'Faculty-I' });
    } else {
      warnings.push(`Row ${excelRow}: Faculty-I name is blank.`);
    }

    // Faculty-II (optional — Girls file always has it; some Boys rows may not)
    const fac2Name = cs(c6);
    const fac2Key  = normaliseName(fac2Name);
    if (fac2Key) {
      const phone = extractPhone(cs(c7));
      upsertFaculty(facultyMap, fac2Name, fac2Key, phone, cs(c7));
      currentGroup.faculty.push({ name:fac2Name, nameKey:fac2Key, phone, rawPhone:cs(c7), slot:'Faculty-II' });
    }
  }

  const facultyList = Array.from(facultyMap.values());

  const noPhone = facultyList.filter(f => !f.phone);
  if (noPhone.length > 0) {
    warnings.push(
      `${noPhone.length} faculty have no phone number: ` +
      noPhone.map(f => f.name).slice(0, 5).join(', ') +
      (noPhone.length > 5 ? ` …and ${noPhone.length - 5} more` : '')
    );
  }

  if (scheduleGroups.length === 0) {
    warnings.push('No schedule data rows found — check the file format.');
  }

  // Compute total expected schedule records for validation
  const totalExpected = scheduleGroups.reduce((sum, g) => sum + g.dates.length * g.faculty.length, 0);

  return { hostelType, academicYear, sheetName, facultyList, scheduleGroups, warnings, totalExpected };
}

// ─── Preview builder ──────────────────────────────────────────────────────────

/**
 * Cross-reference parseResult against live HVMS data and build
 * a structured preview payload for the Admin review step.
 *
 * @param parseResult     Output of parseScheduleExcel()
 * @param existingUsers   [ { id, name, phone, faculty_code } ] from users table
 * @param hostels         [ { id, name, type } ] from hostels (is_active=true)
 * @param existingProfiles [ { id, name_key, phone, resolved_user_id } ] from faculty_profiles
 */
function buildPreview(parseResult, existingUsers, hostels, existingProfiles) {
  const { hostelType, academicYear, sheetName, facultyList, scheduleGroups, warnings, totalExpected } = parseResult;

  // ── Hostel matching ────────────────────────────────────────────────────────
  const matchedHostels = hostels.filter(h => h.type === hostelType);
  const hostelMatch    = matchedHostels[0] || null;
  const hostelWarnings = [];

  if (!hostelMatch) {
    hostelWarnings.push(
      `No active ${hostelType} hostel found in HVMS. Create one before confirming.`
    );
  } else if (matchedHostels.length > 1) {
    hostelWarnings.push(
      `${matchedHostels.length} ${hostelType} hostels found ` +
      `(${matchedHostels.map(h => h.name).join(', ')}). ` +
      `"${hostelMatch.name}" will be used.`
    );
  }

  // ── Faculty cross-reference ────────────────────────────────────────────────
  const userByKey    = new Map(existingUsers.map(u => [normaliseName(u.name), u]));
  const profileByKey = new Map((existingProfiles || []).map(p => [p.name_key, p]));

  const facultyPreview = facultyList.map(f => {
    const eu = userByKey.get(f.nameKey)    || null;
    const ep = profileByKey.get(f.nameKey) || null;

    let status = 'new', matchedId = null, matchType = null;
    let phoneConflict = false, phoneConflictDetails = null;

    if (eu) {
      status = 'existing_user'; matchedId = eu.id; matchType = 'user';
      const ep2 = (eu.phone || '').replace(/\D/g, '');
      const np  = (f.phone  || '').replace(/\D/g, '');
      if (ep2 && np && ep2 !== np) {
        phoneConflict = true;
        phoneConflictDetails = `Excel: ${f.phone} | HVMS: ${eu.phone}`;
      }
    } else if (ep) {
      if (ep.resolved_user_id) {
        status = 'existing_user'; matchedId = ep.resolved_user_id; matchType = 'user_via_profile';
      } else {
        status = 'existing_profile'; matchedId = ep.id; matchType = 'profile';
        const ep2 = (ep.phone || '').replace(/\D/g, '');
        const np  = (f.phone  || '').replace(/\D/g, '');
        if (ep2 && np && ep2 !== np) {
          phoneConflict = true;
          phoneConflictDetails = `Excel: ${f.phone} | Profile: ${ep.phone}`;
        }
      }
    }

    return {
      name: f.name, nameKey: f.nameKey,
      phone: f.phone, rawPhone: f.rawPhone,
      appearances: f.appearances,
      conflictingPhones: f.conflictingPhones,
      status, matchedId, matchType,
      phoneConflict, phoneConflictDetails,
    };
  });

  // ── Expand schedule rows — ALL rounds, ALL faculty ─────────────────────────
  const scheduleRows = [];
  for (const group of scheduleGroups) {
    // CRITICAL: iterate over ALL dates (all 4 rounds), then ALL faculty
    for (const dateEntry of group.dates) {
      for (const fac of group.faculty) {
        scheduleRows.push({
          round:          dateEntry.round,
          visitDate:      dateEntry.isoDate,
          dayOfWeek:      dateEntry.dayOfWeek,
          facultyName:    fac.name,
          facultyNameKey: fac.nameKey,
          facultyPhone:   fac.phone,
          slot:           fac.slot,
          hostelType,
          hostelId:       hostelMatch?.id   || null,
          hostelName:     hostelMatch?.name || null,
          originalRow:    group.originalRow,
          originalSheet:  sheetName,
        });
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const newFaculty        = facultyPreview.filter(f => f.status === 'new').length;
  const existingFaculty   = facultyPreview.filter(f => f.status !== 'new').length;
  const phoneConflicts    = facultyPreview.filter(f => f.phoneConflict).length;
  const missingPhones     = facultyPreview.filter(f => !f.phone).length;
  const internalConflicts = facultyPreview.filter(f => f.conflictingPhones).length;

  const allWarnings = [
    ...warnings,
    ...hostelWarnings,
    ...(phoneConflicts    > 0 ? [`${phoneConflicts} faculty have phone conflicts with existing HVMS records.`]   : []),
    ...(internalConflicts > 0 ? [`${internalConflicts} faculty appear with two different phones in the Excel.`]  : []),
  ];

  const allDates = scheduleRows.map(r => r.visitDate).filter(Boolean).sort();

  return {
    meta: {
      hostelType, academicYear, sheetName,
      hostelMatch: hostelMatch ? { id:hostelMatch.id, name:hostelMatch.name, type:hostelMatch.type } : null,
    },
    facultySummary: {
      total: facultyPreview.length, newFaculty, existingFaculty,
      phoneConflicts, missingPhones, internalConflicts,
    },
    scheduleSummary: {
      totalRows:   scheduleRows.length,
      totalExpected,
      hostelType,
      hostelName:  hostelMatch?.name || null,
      dateFrom:    allDates[0]       || null,
      dateTo:      allDates[allDates.length - 1] || null,
      rounds:      [...new Set(scheduleRows.map(r => r.round))].sort(),
      totalGroups: scheduleGroups.length,
    },
    faculty:      facultyPreview,
    scheduleRows,
    warnings:     allWarnings,
    hasBlockingErrors: !hostelMatch,
  };
}

module.exports = { parseScheduleExcel, buildPreview, normaliseName, extractPhone };
