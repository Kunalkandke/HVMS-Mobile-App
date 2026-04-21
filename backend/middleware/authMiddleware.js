const jwt = require('jsonwebtoken');
const { supabase } = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = auth.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      return res.status(401).json({ success: false, message: msg });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, assigned_hostel_id')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Unauthorized — user not found or inactive' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      assignedHostelId: user.assigned_hostel_id,
    };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authMiddleware };
