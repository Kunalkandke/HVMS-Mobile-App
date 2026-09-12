const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const { generateToken } = require('../utils/helpers');
const { auditLogger } = require('../middleware/helpers');

// ─── Helper: fetch user with hostel joined ───────────────────────────────────
const getUserWithHostel = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, name, email, role, department, phone, profile_photo,
      is_active, must_change_password, created_at, faculty_code, import_source,
      assigned_hostel_id,
      hostels:assigned_hostel_id ( id, name, type, location )
    `)
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    department: data.department,
    phone: data.phone,
    profilePhoto: data.profile_photo,
    assignedHostel: data.hostels || null,
    assigned_hostel_id: data.assigned_hostel_id || null,
    mustChangePassword: data.must_change_password,
    facultyCode: data.faculty_code || null,
    importSource: data.import_source || 'manual',
    isActive: data.is_active,
  };
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    // Accept either { email, password } or { facultyCode, password }
    const { email, password, facultyCode } = req.body;
    const identifier = (facultyCode || email || '').trim();

    if (!identifier || !password)
      return res.status(400).json({ success: false, message: 'Login ID and password are required' });

    const selectFields = 'id, name, email, password, role, department, phone, profile_photo, assigned_hostel_id, is_active, must_change_password, faculty_code, import_source';

    let user = null;

    // 1. Try matching faculty_code case-insensitively (e.g. FAC001, FAC-001, fac001)
    const { data: byCode } = await supabase
      .from('users')
      .select(selectFields)
      .ilike('faculty_code', identifier)
      .maybeSingle();

    if (byCode) {
      user = byCode;
    } else {
      // 2. Try matching email
      const { data: byEmail } = await supabase
        .from('users')
        .select(selectFields)
        .ilike('email', identifier.toLowerCase())
        .maybeSingle();

      if (byEmail) {
        user = byEmail;
      } else {
        // 3. Try matching phone or faculty_code/email via allUsers lookup
        const digitsOnly = identifier.replace(/\D/g, '');
        const { data: allUsers } = await supabase
          .from('users')
          .select(selectFields)
          .limit(10000);

        if (allUsers) {
          user = allUsers.find(u => {
            const uCode = (u.faculty_code || '').trim().toLowerCase();
            const uPhone = (u.phone || '').replace(/\D/g, '');
            const uEmail = (u.email || '').trim().toLowerCase();
            const searchLower = identifier.toLowerCase();

            return (
              (uCode && uCode === searchLower) ||
              (uEmail && uEmail === searchLower) ||
              (digitsOnly.length >= 7 && uPhone && uPhone === digitsOnly) ||
              (uCode && uCode.replace(/\D/g, '') === digitsOnly && digitsOnly.length >= 3)
            );
          });
        }
      }
    }

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid credentials. User account not found.' });

    if (!user.is_active)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact administrator.' });

    // Password verification:
    // Try raw password, then digits-only password, then faculty_code as password fallback
    const passwordTrimmed = password.trim();
    const passwordDigits = passwordTrimmed.replace(/\D/g, '');

    let match = await bcrypt.compare(passwordTrimmed, user.password);
    if (!match && passwordDigits) {
      match = await bcrypt.compare(passwordDigits, user.password);
    }
    if (!match && user.faculty_code) {
      match = await bcrypt.compare(user.faculty_code, user.password);
    }

    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid password. For faculty initial login, use your 10-digit mobile number as password.' });

    const token = generateToken({ userId: user.id, role: user.role, name: user.name });

    // Fetch hostel info if warden
    let assignedHostel = null;
    if (user.assigned_hostel_id) {
      const { data: hostel } = await supabase
        .from('hostels')
        .select('id, name, type, location')
        .eq('id', user.assigned_hostel_id)
        .single();
      assignedHostel = hostel || null;
    }

    auditLogger(user.id, 'LOGIN', null, null, { email: user.email, facultyCode: user.faculty_code }, req.ip);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          phone: user.phone,
          profilePhoto: user.profile_photo,
          assignedHostel,
          mustChangePassword: user.must_change_password,
          facultyCode: user.faculty_code || null,
          importSource: user.import_source || 'manual',
        },
      },
    });
  } catch (err) { next(err); }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    auditLogger(req.user.id, 'LOGOUT', null, null, {}, req.ip);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

// ─── GET ME ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await getUserWithHostel(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, department } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (department !== undefined) updates.department = department.trim();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, role, department, phone, profile_photo, assigned_hostel_id')
      .single();

    if (error) throw new Error(error.message);

    auditLogger(req.user.id, 'UPDATE_PROFILE', req.user.id, 'User', {}, req.ip);
    res.json({ success: true, message: 'Profile updated successfully', data });
  } catch (err) { next(err); }
};

// ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ success: false, message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashed, must_change_password: false })
      .eq('id', req.user.id);

    if (updateError) throw new Error(updateError.message);

    auditLogger(req.user.id, 'CHANGE_PASSWORD', req.user.id, 'User', {}, req.ip);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};
