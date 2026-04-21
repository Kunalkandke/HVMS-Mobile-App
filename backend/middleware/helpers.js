const { supabase } = require('../config/db');

// ─── Role Authorization ───────────────────────────────────────────────────────
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

// ─── Global Error Handler ────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.isOperational ? err.message : 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// ─── Async Audit Logger (fire-and-forget) ────────────────────────────────────
const auditLogger = (userId, action, entityId, entityType, metadata = {}, ipAddress = null) => {
  supabase
    .from('audit_logs')
    .insert({
      user_id: userId || null,
      action,
      entity_id: entityId || null,
      entity_type: entityType || null,
      metadata,
      ip_address: ipAddress,
    })
    .then(({ error }) => {
      if (error) console.warn('Audit log failed:', error.message);
    });
};

module.exports = { authorizeRoles, errorHandler, auditLogger };
