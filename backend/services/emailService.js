const nodemailer = require('nodemailer');

// Lazy-create transporter so missing SMTP config doesn't crash the app
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

const FROM = `"${process.env.FROM_NAME || 'HVMS System'}" <${process.env.FROM_EMAIL || 'noreply@college.edu'}>`;

// ─── WELCOME / RESET EMAIL ────────────────────────────────────────────────────
exports.sendWelcomeEmail = async ({ name, email, password, role, department }) => {
  const t = getTransporter();
  if (!t) return false;
  try {
    const roleLabel = role === 'admin' ? 'Administrator' : role === 'warden' ? 'Hostel Warden' : 'Faculty';
    await t.sendMail({
      from: FROM,
      to: email,
      subject: '🏫 HVMS Account Created — Your Login Credentials',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e4f0;border-radius:12px">
          <h2 style="color:#1a237e;margin-bottom:4px">Welcome to HVMS</h2>
          <p style="color:#5c6b8a;font-size:14px">Hostel Visit Management System</p>
          <hr style="border:none;border-top:1px solid #e0e4f0;margin:16px 0">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Your account has been created. Here are your login details:</p>
          <div style="background:#f4f6fb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:4px 0"><strong>Role:</strong> ${roleLabel}</p>
            ${department ? `<p style="margin:4px 0"><strong>Department:</strong> ${department}</p>` : ''}
            <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
            <p style="margin:4px 0"><strong>Temporary Password:</strong> <code style="background:#e8eaf6;padding:2px 6px;border-radius:4px">${password}</code></p>
          </div>
          <p style="color:#e53935;font-size:13px">⚠️ You will be required to change this password on first login.</p>
          <hr style="border:none;border-top:1px solid #e0e4f0;margin:16px 0">
          <p style="font-size:12px;color:#9aa3b8">HVMS · Engineering College · Do not share this email</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.warn('Welcome email failed:', err.message);
    return false;
  }
};

// ─── VISIT COMPLETED EMAIL (to warden) ───────────────────────────────────────
exports.sendVisitCompletedEmail = async ({
  wardenEmail, wardenName, facultyName, facultyDept,
  hostelName, checkIn, checkOut, duration, purpose, facultyRemarks,
}) => {
  const t = getTransporter();
  if (!t) return false;

  const purposeLabels = {
    inspection: 'Inspection', student_meeting: 'Student Meeting',
    routine_check: 'Routine Check', emergency: 'Emergency', other: 'Other',
  };

  try {
    await t.sendMail({
      from: FROM,
      to: wardenEmail,
      subject: `✅ Visit Completed — ${hostelName} | ${facultyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e4f0;border-radius:12px">
          <h2 style="color:#1a237e">Visit Completed</h2>
          <p>Hi <strong>${wardenName}</strong>, a faculty visit to your hostel has been completed.</p>
          <div style="background:#f4f6fb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:4px 0"><strong>Faculty:</strong> ${facultyName}</p>
            <p style="margin:4px 0"><strong>Department:</strong> ${facultyDept || '—'}</p>
            <p style="margin:4px 0"><strong>Hostel:</strong> ${hostelName}</p>
            <p style="margin:4px 0"><strong>Purpose:</strong> ${purposeLabels[purpose] || purpose}</p>
            <p style="margin:4px 0"><strong>Check-In:</strong> ${new Date(checkIn).toLocaleString()}</p>
            <p style="margin:4px 0"><strong>Check-Out:</strong> ${new Date(checkOut).toLocaleString()}</p>
            <p style="margin:4px 0"><strong>Duration:</strong> ${duration} minute(s)</p>
            ${facultyRemarks ? `<p style="margin:8px 0 0"><strong>Remarks:</strong> "${facultyRemarks}"</p>` : ''}
          </div>
          <p style="font-size:12px;color:#9aa3b8">Log in to HVMS to verify this visit and add your remarks.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.warn('Visit email failed:', err.message);
    return false;
  }
};
