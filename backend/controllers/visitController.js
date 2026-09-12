const { supabase } = require('../config/db');
const { auditLogger } = require('../middleware/helpers');
const { sendVisitCompletedEmail } = require('../services/emailService');

// ─── Helper: fetch visit with faculty + hostel joined ────────────────────────
const getVisitFull = async (visitId) => {
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      faculty:faculty_id ( id, name, email, department, phone ),
      hostel:hostel_id (
        id, name, type, location,
        warden:warden_id ( id, name, email )
      )
    `)
    .eq('id', visitId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ─── START VISIT ─────────────────────────────────────────────────────────────
exports.startVisit = async (req, res, next) => {
  try {
    const { hostelId, purpose, purposeDetail, facultyRemarks, scheduledVisitId } = req.body;
    if (!hostelId || !purpose)
      return res.status(400).json({ success: false, message: 'Hostel and purpose are required' });

    // Check for existing active visit
    const { data: active } = await supabase
      .from('visits')
      .select('id')
      .eq('faculty_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (active)
      return res.status(400).json({ success: false, message: 'You already have an active visit. End it first.' });

    // Verify hostel exists and is active
    const { data: hostel, error: hostelErr } = await supabase
      .from('hostels')
      .select('id, name, type')
      .eq('id', hostelId)
      .eq('is_active', true)
      .single();

    if (hostelErr || !hostel)
      return res.status(404).json({ success: false, message: 'Hostel not found or inactive' });

    const { data: visit, error: visitErr } = await supabase
      .from('visits')
      .insert({
        faculty_id: req.user.id,
        hostel_id: hostelId,
        purpose,
        purpose_detail: purposeDetail || null,
        faculty_remarks: facultyRemarks || null,
        check_in: new Date().toISOString(),
        status: 'active',
      })
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department ),
        hostel:hostel_id ( id, name, type, location )
      `)
      .single();

    if (visitErr) throw new Error(visitErr.message);

    // Link scheduled_visits if scheduledVisitId provided or matching today's visit
    const todayStr = new Date().toISOString().slice(0, 10);
    if (scheduledVisitId) {
      await supabase
        .from('scheduled_visits')
        .update({ actual_visit_id: visit.id, status: 'started' })
        .eq('id', scheduledVisitId);
    } else {
      await supabase
        .from('scheduled_visits')
        .update({ actual_visit_id: visit.id, status: 'started' })
        .eq('faculty_user_id', req.user.id)
        .eq('visit_date', todayStr)
        .eq('status', 'scheduled');
    }

    auditLogger(req.user.id, 'START_VISIT', visit.id, 'Visit', { hostelId, purpose }, req.ip);
    res.status(201).json({ success: true, message: 'Visit started successfully', data: visit });
  } catch (err) { next(err); }
};

// ─── END VISIT ────────────────────────────────────────────────────────────────
exports.endVisit = async (req, res, next) => {
  try {
    const { data: visit, error: fetchErr } = await supabase
      .from('visits')
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department ),
        hostel:hostel_id ( id, name, type, location, warden_id )
      `)
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !visit)
      return res.status(404).json({ success: false, message: 'Visit not found' });
    if (visit.faculty_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Not authorized — this is not your visit' });
    if (visit.status === 'completed')
      return res.status(400).json({ success: false, message: 'Visit already completed' });

    const checkOut = new Date();
    const duration = Math.max(1, Math.round((checkOut - new Date(visit.check_in)) / 60000));

    const { data: updated, error: updateErr } = await supabase
      .from('visits')
      .update({
        check_out: checkOut.toISOString(),
        duration,
        status: 'completed',
        faculty_remarks: req.body.facultyRemarks || visit.faculty_remarks,
      })
      .eq('id', req.params.id)
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department ),
        hostel:hostel_id ( id, name, type, location )
      `)
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // Update scheduled_visits status to completed
    await supabase
      .from('scheduled_visits')
      .update({ status: 'completed' })
      .eq('actual_visit_id', visit.id);

    auditLogger(req.user.id, 'END_VISIT', visit.id, 'Visit', { duration }, req.ip);

    // Notify warden via email (non-blocking)
    if (visit.hostel?.warden_id) {
      const { data: warden } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', visit.hostel.warden_id)
        .single();

      if (warden?.email) {
        sendVisitCompletedEmail({
          wardenEmail: warden.email,
          wardenName: warden.name,
          facultyName: visit.faculty?.name,
          facultyDept: visit.faculty?.department,
          hostelName: visit.hostel?.name,
          checkIn: visit.check_in,
          checkOut: checkOut.toISOString(),
          duration,
          purpose: visit.purpose,
          facultyRemarks: updated.faculty_remarks,
        }).catch(() => {});
      }
    }

    res.json({ success: true, message: 'Visit ended successfully', data: updated });
  } catch (err) { next(err); }
};

// ─── GET MY VISITS (faculty) ─────────────────────────────────────────────────
exports.getMyVisits = async (req, res, next) => {
  try {
    const { status, hostelId, from, to, page = 1, limit = 10000 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('visits')
      .select(`
        *,
        hostel:hostel_id ( id, name, type, location )
      `, { count: 'exact' })
      .eq('faculty_id', req.user.id)
      .order('check_in', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (hostelId) query = query.eq('hostel_id', hostelId);
    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);

    const { data: visits, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data: {
        visits: visits || [],
        pagination: {
          total: count,
          page: Number(page),
          pages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (err) { next(err); }
};

// ─── GET ACTIVE VISITS (warden/admin) ────────────────────────────────────────
exports.getActiveVisits = async (req, res, next) => {
  try {
    let query = supabase
      .from('visits')
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department, phone ),
        hostel:hostel_id ( id, name, type, location )
      `)
      .eq('status', 'active')
      .order('check_in', { ascending: false });

    if (req.user.role === 'warden') {
      if (!req.user.assignedHostelId) {
        return res.json({ success: true, data: [] });
      }
      query = query.eq('hostel_id', req.user.assignedHostelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
};

// ─── GET ALL VISITS (admin) ───────────────────────────────────────────────────
exports.getAllVisits = async (req, res, next) => {
  try {
    const { status, hostelId, facultyId, from, to, page = 1, limit = 10000 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('visits')
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department ),
        hostel:hostel_id ( id, name, type )
      `, { count: 'exact' })
      .order('check_in', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (hostelId) query = query.eq('hostel_id', hostelId);
    if (facultyId) query = query.eq('faculty_id', facultyId);
    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);

    const { data: visits, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data: {
        visits: visits || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ─── GET VISIT BY ID ──────────────────────────────────────────────────────────
exports.getVisitById = async (req, res, next) => {
  try {
    const visit = await getVisitFull(req.params.id);
    res.json({ success: true, data: visit });
  } catch (err) {
    if (err.message.includes('No rows')) return res.status(404).json({ success: false, message: 'Visit not found' });
    next(err);
  }
};

// ─── GET HOSTEL VISITS (warden) ───────────────────────────────────────────────
exports.getHostelVisits = async (req, res, next) => {
  try {
    if (!req.user.assignedHostelId) {
      return res.json({ success: true, data: { visits: [], pagination: { total: 0, page: 1, pages: 1 } } });
    }
    const { status, page = 1, limit = 10000 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('visits')
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department, phone ),
        hostel:hostel_id ( id, name, type, location )
      `, { count: 'exact' })
      .eq('hostel_id', req.user.assignedHostelId)
      .order('check_in', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data: visits, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data: {
        visits: visits || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ─── VERIFY VISIT (warden) ────────────────────────────────────────────────────
exports.verifyVisit = async (req, res, next) => {
  try {
    const { data: visit, error: fetchErr } = await supabase
      .from('visits')
      .select('id, hostel_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !visit)
      return res.status(404).json({ success: false, message: 'Visit not found' });

    if (req.user.assignedHostelId !== visit.hostel_id)
      return res.status(403).json({ success: false, message: 'Not authorized — this hostel is not assigned to you' });

    const { data: updated, error: updateErr } = await supabase
      .from('visits')
      .update({
        is_verified: true,
        warden_remarks: req.body.wardenRemarks || null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    auditLogger(req.user.id, 'VERIFY_VISIT', visit.id, 'Visit', {}, req.ip);
    res.json({ success: true, message: 'Visit verified successfully', data: updated });
  } catch (err) { next(err); }
};
