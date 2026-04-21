const { supabase } = require('../config/db');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── SUBMIT / UPDATE FORM ────────────────────────────────────────────────────
exports.submitForm = async (req, res, next) => {
  try {
    const { formType, data } = req.body;
    const visitId = req.params.id;

    console.log('[FormController] submitForm called:', { visitId, formType, userId: req.user?.id });

    if (!formType || !data)
      return res.status(400).json({ success: false, message: 'formType and data are required' });

    if (!['anti_ragging', 'mess_feedback'].includes(formType))
      return res.status(400).json({ success: false, message: 'Invalid formType' });

    // Fetch visit to check ownership
    const { data: visit, error: fetchErr } = await supabase
      .from('visits')
      .select('id, faculty_id, form_submissions')
      .eq('id', visitId)
      .single();

    if (fetchErr) {
      console.error('[FormController] Fetch visit error:', fetchErr);
      // Check if form_submissions column doesn't exist
      if (fetchErr.message?.includes('column') || fetchErr.code === '42703') {
        return res.status(500).json({
          success: false,
          message: 'Database schema error: form_submissions column missing. Run the SQL migration in Supabase.'
        });
      }
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    if (!visit)
      return res.status(404).json({ success: false, message: 'Visit not found' });

    // Only faculty who owns the visit can save
    if (req.user.role === 'faculty' && visit.faculty_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied — not your visit' });

    if (req.user.role !== 'faculty')
      return res.status(403).json({ success: false, message: 'Only faculty can submit forms' });

    // Build updated form_submissions array
    const existing = Array.isArray(visit.form_submissions) ? visit.form_submissions : [];
    const idx = existing.findIndex(f => f.form_type === formType);
    const newEntry = { form_type: formType, submitted_at: new Date().toISOString(), data };

    let updated;
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = newEntry;
    } else {
      updated = [...existing, newEntry];
    }

    const { error: updateErr } = await supabase
      .from('visits')
      .update({ form_submissions: updated })
      .eq('id', visitId);

    if (updateErr) {
      console.error('[FormController] Update form_submissions error:', updateErr);
      throw new Error(updateErr.message);
    }

    console.log('[FormController] Form saved successfully:', { visitId, formType });
    res.json({ success: true, message: 'Form saved successfully', data: updated });
  } catch (err) {
    console.error('[FormController] submitForm exception:', err);
    next(err);
  }
};

// ─── GET FORMS FOR A VISIT ────────────────────────────────────────────────────
exports.getForms = async (req, res, next) => {
  try {
    const visitId = req.params.id;
    console.log('[FormController] getForms called:', { visitId, userId: req.user?.id });

    const { data: visit, error } = await supabase
      .from('visits')
      .select(`
        id, faculty_id, purpose, check_in, check_out, duration,
        faculty_remarks, form_submissions,
        faculty:faculty_id ( id, name, email, department, phone ),
        hostel:hostel_id ( id, name, type, location )
      `)
      .eq('id', visitId)
      .single();

    if (error) {
      console.error('[FormController] getForms error:', error);
      if (error.message?.includes('column') || error.code === '42703') {
        return res.status(500).json({
          success: false,
          message: 'Database schema error: form_submissions column missing. Run the SQL migration.'
        });
      }
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    if (!visit)
      return res.status(404).json({ success: false, message: 'Visit not found' });

    // Faculty can only see their own visit forms
    if (req.user.role === 'faculty' && visit.faculty_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          faculty: visit.faculty,
          hostel: visit.hostel,
          purpose: visit.purpose,
          checkIn: visit.check_in,
          checkOut: visit.check_out,
          duration: visit.duration,
          facultyRemarks: visit.faculty_remarks,
        },
        forms: Array.isArray(visit.form_submissions) ? visit.form_submissions : [],
      },
    });
  } catch (err) { next(err); }
};

// ─── DOWNLOAD FORM AS DOCX ────────────────────────────────────────────────────
exports.downloadForm = async (req, res, next) => {
  try {
    const { id: visitId, formType } = req.params;

    if (!['anti_ragging', 'mess_feedback'].includes(formType))
      return res.status(400).json({ success: false, message: 'Invalid formType' });

    const { data: visit, error } = await supabase
      .from('visits')
      .select(`
        id, check_in,
        faculty:faculty_id ( name, email, department, phone ),
        hostel:hostel_id ( name, type )
      `)
      .eq('id', visitId)
      .single();

    if (error || !visit)
      return res.status(404).json({ success: false, message: 'Visit not found' });

    // Fetch form_submissions separately (keep select lean above)
    const { data: visitFull } = await supabase
      .from('visits')
      .select('form_submissions')
      .eq('id', visitId)
      .single();

    const forms = Array.isArray(visitFull?.form_submissions) ? visitFull.form_submissions : [];
    const submission = forms.find(f => f.form_type === formType);

    if (!submission)
      return res.status(404).json({ success: false, message: 'Form not submitted yet. Please fill and save the form first.' });

    const visitData = {
      checkIn: visit.check_in,
      faculty_name: visit.faculty?.name || '',
      faculty_dept: visit.faculty?.department || '',
      faculty_phone: visit.faculty?.phone || '',
      hostel_name: visit.hostel?.name || '',
      hostel_type: visit.hostel?.type || 'boys',
      year: new Date(visit.check_in).getFullYear(),
    };

    const payload = JSON.stringify({ visit: visitData, formData: submission.data });
    const tmpFile = path.join(os.tmpdir(), `hvms_${visitId}_${formType}_${Date.now()}.docx`);
    const scriptPath = path.join(__dirname, '../utils/generate_form.py');

    // Use 'python' on Windows, 'python3' on other systems
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const py = spawn(pythonCmd, [scriptPath, formType, payload, tmpFile]);
    let stderr = '';
    py.stderr.on('data', d => { stderr += d.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        console.error('Form generation error:', stderr);
        return res.status(500).json({ success: false, message: 'Document generation failed. Ensure python3 and python-docx are installed on the server.' });
      }
      const label = formType === 'anti_ragging' ? 'AntiRagging_Form' : 'MessFeedback_Form';
      const fname = `MIT_${label}_${(visit.faculty?.name || 'Faculty').replace(/\s+/g, '_')}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      const stream = fs.createReadStream(tmpFile);
      stream.pipe(res);
      stream.on('end', () => fs.unlink(tmpFile, () => {}));
      stream.on('error', () => res.status(500).end());
    });

    py.on('error', () => {
      res.status(500).json({ success: false, message: 'python3 not found on server. Install python3 and python-docx.' });
    });
  } catch (err) { next(err); }
};
