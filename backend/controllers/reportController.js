const { supabase } = require('../config/db');

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    // For wardens — scope to their hostel
    const hostelFilter = req.user.role === 'warden' && req.user.assignedHostelId
      ? req.user.assignedHostelId : null;

    const buildQuery = (q) => hostelFilter ? q.eq('hostel_id', hostelFilter) : q;

    // Parallel queries
    const [activeRes, todayRes, monthRes, hostelWiseRes] = await Promise.all([
      buildQuery(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'active')),
      buildQuery(supabase.from('visits').select('id', { count: 'exact', head: true }).gte('check_in', todayISO)),
      buildQuery(supabase.from('visits').select('id', { count: 'exact', head: true }).gte('check_in', monthStart)),
      // Hostel-wise today breakdown
      (async () => {
        let q = supabase
          .from('visits')
          .select('hostel_id, hostel:hostel_id(name, type)')
          .gte('check_in', todayISO);
        if (hostelFilter) q = q.eq('hostel_id', hostelFilter);
        const { data } = await q;
        if (!data) return [];
        // Group by hostel_id
        const grouped = {};
        data.forEach(v => {
          const key = v.hostel_id;
          if (!grouped[key]) grouped[key] = { hostelName: v.hostel?.name, type: v.hostel?.type, count: 0 };
          grouped[key].count++;
        });
        return Object.values(grouped).sort((a, b) => b.count - a.count);
      })(),
    ]);

    res.json({
      success: true,
      data: {
        activeCount: activeRes.count ?? 0,
        todayCount: todayRes.count ?? 0,
        monthCount: monthRes.count ?? 0,
        hostelWise: hostelWiseRes,
      },
    });
  } catch (err) { next(err); }
};

// ─── DAILY REPORT ─────────────────────────────────────────────────────────────
exports.getDaily = async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const start = new Date(dateStr);
    const end = new Date(dateStr);
    end.setDate(end.getDate() + 1);

    const { data: visits, error } = await supabase
      .from('visits')
      .select(`
        *,
        faculty:faculty_id ( id, name, email, department ),
        hostel:hostel_id ( id, name, type )
      `)
      .gte('check_in', start.toISOString())
      .lt('check_in', end.toISOString())
      .order('check_in', { ascending: false });

    if (error) throw new Error(error.message);

    const durArr = visits.filter(v => v.duration).map(v => v.duration);
    const avgDuration = durArr.length
      ? (durArr.reduce((a, b) => a + b, 0) / durArr.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        date: dateStr,
        stats: {
          totalVisits: visits.length,
          completed: visits.filter(v => v.status === 'completed').length,
          active: visits.filter(v => v.status === 'active').length,
          avgDuration: Number(avgDuration),
        },
        visits,
      },
    });
  } catch (err) { next(err); }
};

// ─── MONTHLY REPORT ───────────────────────────────────────────────────────────
exports.getMonthly = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: visits, error, count } = await supabase
      .from('visits')
      .select('id, status, check_in', { count: 'exact' })
      .gte('check_in', start)
      .lte('check_in', end);

    if (error) throw new Error(error.message);

    // Group by date
    const grouped = {};
    (visits || []).forEach(v => {
      const d = v.check_in?.split('T')[0];
      if (!grouped[d]) grouped[d] = { _id: d, count: 0, completed: 0 };
      grouped[d].count++;
      if (v.status === 'completed') grouped[d].completed++;
    });

    const dailyBreakdown = Object.values(grouped).sort((a, b) => a._id.localeCompare(b._id));

    res.json({
      success: true,
      data: { month, year, total: count ?? 0, dailyBreakdown },
    });
  } catch (err) { next(err); }
};

// ─── BY HOSTEL ────────────────────────────────────────────────────────────────
exports.getByHostel = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    let query = supabase
      .from('visits')
      .select('hostel_id, status, duration, hostel:hostel_id(name, type)');

    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);
    if (req.user.role === 'warden' && req.user.assignedHostelId) {
      query = query.eq('hostel_id', req.user.assignedHostelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Aggregate in JS
    const grouped = {};
    (data || []).forEach(v => {
      const key = v.hostel_id;
      if (!grouped[key]) grouped[key] = {
        hostelName: v.hostel?.name, type: v.hostel?.type,
        totalVisits: 0, completedVisits: 0, durations: [],
      };
      grouped[key].totalVisits++;
      if (v.status === 'completed') grouped[key].completedVisits++;
      if (v.duration) grouped[key].durations.push(v.duration);
    });

    const result = Object.values(grouped).map(g => ({
      hostelName: g.hostelName,
      type: g.type,
      totalVisits: g.totalVisits,
      completedVisits: g.completedVisits,
      avgDuration: g.durations.length
        ? Number((g.durations.reduce((a, b) => a + b, 0) / g.durations.length).toFixed(1))
        : null,
    })).sort((a, b) => b.totalVisits - a.totalVisits);

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── BY FACULTY ───────────────────────────────────────────────────────────────
exports.getByFaculty = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    let query = supabase
      .from('visits')
      .select('faculty_id, status, duration, check_in, faculty:faculty_id(name, email, department)');

    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const grouped = {};
    (data || []).forEach(v => {
      const key = v.faculty_id;
      if (!grouped[key]) grouped[key] = {
        facultyName: v.faculty?.name, email: v.faculty?.email,
        department: v.faculty?.department,
        totalVisits: 0, completedVisits: 0, durations: [], lastVisit: null,
      };
      grouped[key].totalVisits++;
      if (v.status === 'completed') grouped[key].completedVisits++;
      if (v.duration) grouped[key].durations.push(v.duration);
      if (!grouped[key].lastVisit || v.check_in > grouped[key].lastVisit)
        grouped[key].lastVisit = v.check_in;
    });

    const result = Object.values(grouped).map(g => ({
      facultyName: g.facultyName, email: g.email, department: g.department,
      totalVisits: g.totalVisits, completedVisits: g.completedVisits,
      avgDuration: g.durations.length
        ? Number((g.durations.reduce((a, b) => a + b, 0) / g.durations.length).toFixed(1))
        : null,
      lastVisit: g.lastVisit,
    })).sort((a, b) => b.totalVisits - a.totalVisits);

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
