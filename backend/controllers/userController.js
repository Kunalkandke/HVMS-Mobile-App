const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const { generatePassword } = require('../utils/helpers');
const { sendWelcomeEmail } = require('../services/emailService');

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('users')
      .select(`
        id, name, email, role, department, phone, profile_photo,
        is_active, must_change_password, created_at,
        faculty_code, import_source,
        assigned_hostel_id,
        hostels:assigned_hostel_id ( id, name, type )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (role) query = query.eq('role', role);
    if (isActive !== undefined && isActive !== '')
      query = query.eq('is_active', isActive === 'true');

    const { data: users, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data: {
        users: users || [],
        pagination: { total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};

// ─── GET USER BY ID ───────────────────────────────────────────────────────────
exports.getUserById = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, name, email, role, department, phone, profile_photo,
        is_active, must_change_password, created_at,
        faculty_code, import_source,
        assigned_hostel_id,
        hostels:assigned_hostel_id ( id, name, type, location )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── CREATE USER ──────────────────────────────────────────────────────────────
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, role, department, phone, assignedHostel } = req.body;
    if (!name || !email || !role)
      return res.status(400).json({ success: false, message: 'Name, email, and role are required' });

    // Check duplicate email
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const tempPassword = generatePassword();
    const hashed = await bcrypt.hash(tempPassword, 12);

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role,
      department: role === 'warden' ? '' : (department?.trim() || ''),
      phone: phone?.trim() || '',
      must_change_password: true,
      is_active: true,
      assigned_hostel_id: role === 'warden' && assignedHostel ? assignedHostel : null,
    };

    const { data: user, error: createErr } = await supabase
      .from('users')
      .insert(userData)
      .select('id, name, email, role, department, phone, is_active, created_at')
      .single();

    if (createErr) throw new Error(createErr.message);

    // If warden with hostel — update hostel.warden_id
    if (role === 'warden' && assignedHostel) {
      await supabase.from('hostels').update({ warden_id: user.id }).eq('id', assignedHostel);
      // Clear from any other hostel first
      await supabase.from('hostels').update({ warden_id: null })
        .eq('warden_id', user.id)
        .neq('id', assignedHostel);
    }

    // Welcome email
    const emailSent = await sendWelcomeEmail({
      name: user.name,
      email: user.email,
      password: tempPassword,
      role,
      department: role !== 'warden' ? department : null,
    }).catch(() => false);

    res.status(201).json({
      success: true,
      message: `User created${emailSent ? ' and welcome email sent' : ' (email not sent — check SMTP config)'}`,
      data: { user, tempPassword, emailSent },
    });
  } catch (err) { next(err); }
};

// ─── UPDATE USER ──────────────────────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const { name, department, phone } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (department !== undefined) updates.department = department.trim();
    if (phone !== undefined) updates.phone = phone.trim();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, email, role, department, phone, is_active')
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User updated', data });
  } catch (err) { next(err); }
};

// ─── TOGGLE USER STATUS ───────────────────────────────────────────────────────
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', req.params.id)
      .select('id, name, email, role, is_active')
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data,
    });
  } catch (err) { next(err); }
};

// ─── CHANGE USER ROLE ─────────────────────────────────────────────────────────
exports.changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'faculty', 'warden'].includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role' });

    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, name, email, role')
      .single();

    if (error || !data)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Role updated', data });
  } catch (err) { next(err); }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, name, email, role, department')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const newPassword = generatePassword();
    const hashed = await bcrypt.hash(newPassword, 12);

    await supabase
      .from('users')
      .update({ password: hashed, must_change_password: true })
      .eq('id', req.params.id);

    await sendWelcomeEmail({
      name: user.name, email: user.email,
      password: newPassword, role: user.role,
      department: user.department,
    }).catch(() => {});

    res.json({ success: true, message: 'Password reset. New credentials emailed to user.' });
  } catch (err) { next(err); }
};
