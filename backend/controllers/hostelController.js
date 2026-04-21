const { supabase } = require('../config/db');
const { auditLogger } = require('../middleware/helpers');

// ─── GET ALL HOSTELS ─────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('hostels')
      .select(`
        *,
        warden:warden_id ( id, name, email, phone )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
};

// ─── GET HOSTEL BY ID ─────────────────────────────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('hostels')
      .select(`
        *,
        warden:warden_id ( id, name, email, phone )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Hostel not found' });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── CREATE HOSTEL ────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { name, type, capacity, location } = req.body;
    if (!name || !type || !capacity || !location)
      return res.status(400).json({ success: false, message: 'Name, type, capacity, location required' });

    const { data, error } = await supabase
      .from('hostels')
      .insert({ name: name.trim(), type, capacity: Number(capacity), location: location.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') // unique violation
        return res.status(400).json({ success: false, message: 'Hostel name already exists' });
      throw new Error(error.message);
    }

    auditLogger(req.user.id, 'CREATE_HOSTEL', data.id, 'Hostel', { name }, req.ip);
    res.status(201).json({ success: true, message: 'Hostel created successfully', data });
  } catch (err) { next(err); }
};

// ─── UPDATE HOSTEL ────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { name, type, capacity, location } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (type) updates.type = type;
    if (capacity) updates.capacity = Number(capacity);
    if (location) updates.location = location.trim();

    const { data, error } = await supabase
      .from('hostels')
      .update(updates)
      .eq('id', req.params.id)
      .select(`*, warden:warden_id ( id, name, email )`)
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Hostel not found' });

    auditLogger(req.user.id, 'UPDATE_HOSTEL', data.id, 'Hostel', {}, req.ip);
    res.json({ success: true, message: 'Hostel updated', data });
  } catch (err) { next(err); }
};

// ─── ASSIGN WARDEN ────────────────────────────────────────────────────────────
exports.assignWarden = async (req, res, next) => {
  try {
    const { wardenId } = req.body;
    if (!wardenId)
      return res.status(400).json({ success: false, message: 'wardenId is required' });

    // Verify warden exists with correct role
    const { data: warden, error: wardenErr } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', wardenId)
      .eq('role', 'warden')
      .single();

    if (wardenErr || !warden)
      return res.status(404).json({ success: false, message: 'Warden not found or user is not a warden' });

    // Remove warden from any existing hostel
    await supabase.from('hostels').update({ warden_id: null }).eq('warden_id', wardenId);
    await supabase.from('users').update({ assigned_hostel_id: null }).eq('assigned_hostel_id', req.params.id);

    // Assign to new hostel
    const { data: hostel, error: hostelErr } = await supabase
      .from('hostels')
      .update({ warden_id: wardenId })
      .eq('id', req.params.id)
      .select(`*, warden:warden_id ( id, name, email )`)
      .single();

    if (hostelErr || !hostel)
      return res.status(404).json({ success: false, message: 'Hostel not found' });

    // Link warden to hostel in users table
    await supabase.from('users').update({ assigned_hostel_id: req.params.id }).eq('id', wardenId);

    auditLogger(req.user.id, 'ASSIGN_WARDEN', hostel.id, 'Hostel', { wardenId }, req.ip);
    res.json({ success: true, message: 'Warden assigned successfully', data: hostel });
  } catch (err) { next(err); }
};

// ─── DEACTIVATE HOSTEL ────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('hostels')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'Hostel not found' });

    auditLogger(req.user.id, 'DELETE_HOSTEL', data.id, 'Hostel', {}, req.ip);
    res.json({ success: true, message: 'Hostel deactivated successfully' });
  } catch (err) { next(err); }
};
