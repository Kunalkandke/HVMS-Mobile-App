const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const { generatePassword } = require('../utils/helpers');
const { sendWelcomeEmail } = require('../services/emailService');

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10000 } = req.query;
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

// ─── UPDATE USER ─────────────────────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const { name, department, phone, email } = req.body;
    const updates = {};
    if (name       !== undefined && name !== null)       updates.name       = name.trim();
    if (department !== undefined && department !== null) updates.department = department.trim();
    if (phone      !== undefined && phone !== null)      updates.phone      = phone.trim();
    if (email      !== undefined && email !== null) {
      const emailTrimmed = email.trim().toLowerCase();
      if (emailTrimmed) {
        // Check for duplicate email (exclude the user being updated)
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', emailTrimmed)
          .neq('id', req.params.id)
          .maybeSingle();
        if (existing)
          return res.status(400).json({ success: false, message: 'Email is already in use by another account.' });
        updates.email = emailTrimmed;
      }
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update.' });

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, email, role, department, phone, is_active, faculty_code, import_source')
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

// ─── UPDATE FACULTY DETAILS (Admin: name, phone, email, dept, hostel) ────────
exports.updateFacultyDetails = async (req, res, next) => {
  try {
    const { name, phone, email, department, assignedHostelId, resetPasswordToPhone } = req.body;
    const userId = req.params.id;

    // Fetch current user to verify role
    const { data: existing, error: fetchErr } = await supabase
      .from('users')
      .select('id, name, email, phone, role, faculty_code, import_source')
      .eq('id', userId)
      .single();

    if (fetchErr || !existing)
      return res.status(404).json({ success: false, message: 'User not found' });

    const updates = {};
    if (name !== undefined && name !== null)       updates.name = name.trim();
    if (department !== undefined && department !== null) updates.department = department.trim();
    if (assignedHostelId !== undefined)            updates.assigned_hostel_id = assignedHostelId || null;

    // Phone update: normalize digits, update phone field
    let newPhoneDigits = null;
    if (phone !== undefined && phone !== null) {
      const raw = phone.trim();
      newPhoneDigits = raw.replace(/\D/g, ''); // pure digits for hashing
      const normalized = raw.replace(/[^\d+]/g, '').replace(/^\+91/, '') || raw;
      updates.phone = normalized;
    }

    // Email update: check for duplicates
    if (email !== undefined && email !== null) {
      const emailTrimmed = email.trim().toLowerCase();
      if (emailTrimmed) {
        const { data: dup } = await supabase
          .from('users')
          .select('id')
          .eq('email', emailTrimmed)
          .neq('id', userId)
          .maybeSingle();
        if (dup)
          return res.status(400).json({ success: false, message: 'Email is already in use by another account.' });
        updates.email = emailTrimmed;
      } else {
        updates.email = null; // allow clearing email
      }
    }

    // Re-hash password if phone changed or resetPasswordToPhone flag is set
    if (resetPasswordToPhone || newPhoneDigits) {
      const digits = newPhoneDigits || (existing.phone || '').replace(/\D/g, '');
      if (digits) {
        const hashed = await bcrypt.hash(digits, 12);
        updates.password = hashed;
        updates.must_change_password = true; // force re-login with new password
      }
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'No fields to update.' });

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, name, email, role, department, phone, is_active, faculty_code, import_source, assigned_hostel_id, must_change_password')
      .single();

    if (error || !data)
      return res.status(500).json({ success: false, message: error?.message || 'Update failed' });

    // Also update faculty_profiles linked to this user (name, phone)
    if (updates.name || updates.phone) {
      const profileUpdate = {};
      if (updates.name) profileUpdate.name = updates.name;
      if (updates.phone) profileUpdate.phone = updates.phone;
      await supabase.from('faculty_profiles')
        .update(profileUpdate)
        .eq('resolved_user_id', userId);
    }

    res.json({
      success: true,
      message: `Faculty details updated${updates.password ? ' — password reset to phone number' : ''}`,
      data,
    });
  } catch (err) { next(err); }
};

// ─── GET FACULTY USERS (paginated, with schedule stats) ───────────────────────
exports.getFacultyUsers = async (req, res, next) => {
  try {
    const { search, isActive, page = 1, limit = 10000 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('users')
      .select(`
        id, name, email, role, department, phone,
        is_active, must_change_password, created_at,
        faculty_code, import_source,
        assigned_hostel_id,
        hostels:assigned_hostel_id ( id, name, type )
      `, { count: 'exact' })
      .eq('role', 'faculty')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (isActive !== undefined && isActive !== '')
      query = query.eq('is_active', isActive === 'true');
    if (search) query = query.ilike('name', `%${search}%`);

    let { data: users, error, count } = await query;

    // Fallback if join error occurs: query users directly without hostels join
    if (error) {
      console.warn('[getFacultyUsers] Supabase query retry without join:', error.message);
      let fallbackQuery = supabase
        .from('users')
        .select('id, name, email, role, department, phone, is_active, must_change_password, created_at, faculty_code, import_source, assigned_hostel_id', { count: 'exact' })
        .eq('role', 'faculty')
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      if (isActive !== undefined && isActive !== '')
        fallbackQuery = fallbackQuery.eq('is_active', isActive === 'true');
      if (search) fallbackQuery = fallbackQuery.ilike('name', `%${search}%`);

      const fb = await fallbackQuery;
      users = fb.data || [];
      count = fb.count || users.length;
    }

    // Attach schedule statistics (total visits, boys vs girls visits) for each faculty
    const userIds = (users || []).map(u => u.id);
    const statsMap = new Map();
    if (userIds.length > 0) {
      const { data: visitsSummary } = await supabase
        .from('scheduled_visits')
        .select('faculty_user_id, hostel_type')
        .in('faculty_user_id', userIds);

      if (visitsSummary) {
        for (const v of visitsSummary) {
          if (!v.faculty_user_id) continue;
          const s = statsMap.get(v.faculty_user_id) || { total: 0, boys: 0, girls: 0 };
          s.total++;
          if (v.hostel_type === 'boys') s.boys++;
          if (v.hostel_type === 'girls') s.girls++;
          statsMap.set(v.faculty_user_id, s);
        }
      }
    }

    const usersWithStats = (users || []).map(u => ({
      ...u,
      stats: statsMap.get(u.id) || { total: 0, boys: 0, girls: 0 },
    }));

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: { total: count || (users ? users.length : 0), page: Number(page), pages: Math.ceil((count || 1) / Number(limit)) },
      },
    });
  } catch (err) { next(err); }
};
