// ─── Hostel Name → Location Key Mapping ─────────────────────────────────────
export function hostelToLocKey(hostelName) {
  if (!hostelName) return null;
  const n = hostelName.toUpperCase();
  if (n.includes('SRTH')) return 'srth';
  if (n.includes('SVH'))  return 'svh';
  if (n.includes('TARA')) return 'tara';
  if (n.includes('SJB') || n.includes('SBP')) return 'sjb';
  return null;
}

export const LOCATIONS = [
  { label: 'SRTH',    key: 'srth' },
  { label: 'SVH',     key: 'svh'  },
  { label: 'TARA',    key: 'tara' },
  { label: 'SJB/SBP', key: 'sjb' },
];

// ─── Normalize form data payload (handles camelCase <-> snake_case compatibility)
export function normalizeFormData(d) {
  if (!d) return {};
  const res = { ...d };

  // Anti-Ragging fields
  if (d.disciplineStatus && !d.discipline_status) res.discipline_status = d.disciplineStatus;
  if (d.cleanlinessStatus && !d.cleanliness_status) res.cleanliness_status = d.cleanlinessStatus;
  if (d.environmentStatus && !d.environment_status) res.environment_status = d.environmentStatus;
  if (d.seniorInteraction && !d.senior_interaction) res.senior_interaction = d.seniorInteraction;
  if (d.fresherInteraction && !d.fresher_interaction) res.fresher_interaction = d.fresherInteraction;
  if (d.antiraggingSuggestions && !d.antiragging_suggestions) res.antiragging_suggestions = d.antiraggingSuggestions;
  if (d.otherSuggestions && !d.other_suggestions) res.other_suggestions = d.otherSuggestions;

  // Mess Feedback fields
  if (d.mealType && !d.meal_type) res.meal_type = d.mealType;
  if (d.tastedFood && !d.tasted_food) res.tasted_food = d.tastedFood;
  if (d.menuItems && !d.menu_items) res.menu_items = d.menuItems;
  if (d.platesClean && !d.plates_clean) res.plates_clean = d.platesClean;
  if (d.foodHot && !d.food_hot) res.food_hot = d.foodHot;
  if (d.foodRemarks && !d.food_remarks) res.food_remarks = d.foodRemarks;
  if (d.overallFeedback && !d.overall_feedback) res.overall_feedback = d.overallFeedback;
  if (d.improvementSuggestions && !d.improvement_suggestions) res.improvement_suggestions = d.improvementSuggestions;

  // Location fields
  ['srth', 'svh', 'tara', 'sjb'].forEach(loc => {
    const timeCamel = `loc${loc.charAt(0).toUpperCase() + loc.slice(1)}Time`;
    const timeSnake = `loc_${loc}_time`;
    if (d[timeCamel] && !d[timeSnake]) res[timeSnake] = d[timeCamel];

    const remCamel = `loc${loc.charAt(0).toUpperCase() + loc.slice(1)}Remarks`;
    const remSnake = `loc_${loc}_remarks`;
    if (d[remCamel] && !d[remSnake]) res[remSnake] = d[remCamel];
  });

  return res;
}

// ─── Auto-fill initial form data from visit ──────────────────────────────────
export function buildInitialData(visit, existingData) {
  if (existingData) return normalizeFormData(existingData);

  const locKey = hostelToLocKey(visit?.hostel?.name);
  const pre = {};
  if (locKey && visit?.checkIn) {
    const d = new Date(visit.checkIn);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    pre[`loc_${locKey}_time`] = `${hh}:${mm}`;
  }
  return pre;
}

// ─── Format helpers for PDF/display ─────────────────────────────────────────
export function fmtDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
export function fmtDay(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { weekday: 'long' });
}
export function fmtTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Anti-Ragging HTML Template ──────────────────────────────────────────────
export function generateAntiRaggingHTML(visit, rawFormData) {
  const formData = normalizeFormData(rawFormData);
  const d = visit?.checkIn ? new Date(visit.checkIn) : new Date();
  const timeStr = fmtTime(d);
  const locKey  = hostelToLocKey(visit?.hostel?.name);
  const hostelType = visit?.hostel?.type === 'girls' ? 'Girls' : 'Boys';

  const gt = (key) =>
    (key === locKey && !formData[`loc_${key}_time`]) ? timeStr : (formData[`loc_${key}_time`] || '');

  const CSS = `
    @page { size: A4 portrait; margin: 12mm 15mm 10mm 15mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; background: #fff; line-height: 1.3; }
    .hdr { text-align: center; margin-bottom: 3px; }
    .hdr .big { font-size: 13pt; font-weight: bold; display: block; }
    .hdr .med { font-size: 11pt; font-weight: bold; display: block; }
    .hdr .sm  { font-size: 10pt; display: block; }
    .hr { border: none; border-top: 1.5px solid #000; margin: 3px 0; }
    .committee { font-size: 12pt; font-weight: bold; text-align: center; margin: 2px 0 1px; }
    .subtitle  { font-size: 10.5pt; font-weight: bold; text-align: center; margin-bottom: 3px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    td, th { padding: 2px 5px; vertical-align: middle; word-wrap: break-word; }
    .tbl td, .tbl th { border: 1px solid #000; }
    .tbl th { background: #ebebeb; font-weight: bold; text-align: center; font-size: 10pt; }
    .sec { font-weight: bold; font-size: 10.5pt; margin: 4px 0 1px; display: block; }
    .box  { border: 1px solid #000; min-height: 18px; padding: 1px 5px; font-size: 10pt; margin-bottom: 3px; }
    .box2 { border: 1px solid #000; min-height: 28px; padding: 1px 5px; font-size: 10pt; margin-bottom: 3px; }
    .notes { margin-top: 6px; font-size: 9.5pt; line-height: 1.4; }
    .helpline { border: 1px solid #000; text-align: center; padding: 3px 5px; font-weight: bold; font-size: 10pt; margin-top: 6px; }
  `;

  const locsRows = LOCATIONS.map(l =>
    `<tr><td>${l.label}</td><td>${esc(gt(l.key))}</td><td>${esc(formData[`loc_${l.key}_remarks`])}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Anti-Ragging Visit Report</title><style>${CSS}</style></head><body>
<div class="hdr">
  <span class="big">G.S.Mandal's</span>
  <span class="big">Maharashtra Institute of Technology,</span>
  <span class="med">Chhatrapati Sambhajinagar</span>
  <span class="sm">(An Autonomous Institute)</span>
</div>
<hr class="hr">
<div class="committee">Anti-Ragging Committee</div>
<div class="subtitle">${hostelType} Hostel Visit report ${d.getFullYear()}</div>
<hr class="hr">
<table class="tbl" style="margin-bottom:3px;">
  <colgroup><col style="width:35%"><col style="width:28%"><col style="width:14%"><col style="width:23%"></colgroup>
  <tr><td>Date and Day of visit:</td><td>${fmtDate(d)}, ${fmtDay(d)}</td><td>Time slot:-</td><td>${timeStr}</td></tr>
</table>
<table class="tbl" style="margin-bottom:5px;">
  <colgroup><col style="width:35%"><col style="width:28%"><col style="width:14%"><col style="width:23%"></colgroup>
  <tr><td>Name of Member/s:</td><td>${esc(visit?.faculty?.name)}</td><td>Department:-</td><td>${esc(visit?.faculty?.department)}</td></tr>
</table>
<span class="sec">&#8226; Locations visited</span>
<table class="tbl" style="margin-bottom:4px;">
  <colgroup><col style="width:22%"><col style="width:18%"><col style="width:60%"></colgroup>
  <thead><tr><th>Locations</th><th>Time</th><th>Remarks</th></tr></thead>
  <tbody>${locsRows}</tbody>
</table>
<table class="tbl" style="margin-bottom:3px;"><colgroup><col style="width:42%"><col></colgroup>
  <tr><td>&#8226; Status of Discipline</td><td>${esc(formData.discipline_status)}</td></tr>
</table>
<table class="tbl" style="margin-bottom:3px;"><colgroup><col style="width:42%"><col></colgroup>
  <tr><td>&#8226; Status of Cleanliness</td><td>${esc(formData.cleanliness_status)}</td></tr>
</table>
<table class="tbl" style="margin-bottom:3px;"><colgroup><col style="width:42%"><col></colgroup>
  <tr><td>&#8226; Overall Environment</td><td>${esc(formData.environment_status)}</td></tr>
</table>
<table class="tbl" style="margin-bottom:3px;"><colgroup><col style="width:58%"><col></colgroup>
  <tr><td>&#8226; Did you interact with senior students?</td><td>${esc(formData.senior_interaction)}</td></tr>
</table>
<table class="tbl" style="margin-bottom:4px;"><colgroup><col style="width:58%"><col></colgroup>
  <tr><td>&#8226; Did you interact with fresher student?</td><td>${esc(formData.fresher_interaction)}</td></tr>
</table>
<span class="sec">&#8226; Suggestions related to Anti-ragging only</span>
<div class="box2">${esc(formData.antiragging_suggestions)}</div>
<span class="sec">&#8226; Any other Suggestions</span>
<div class="box2">${esc(formData.other_suggestions)}</div>
<table style="margin-top:8px;width:100%;border-collapse:collapse;">
  <tr>
    <td style="width:55%;height:60px;vertical-align:bottom;padding-bottom:4px;">
      <div style="border-top:1.5px solid #000;padding-top:4px;font-size:11pt;">Signature of the Faculty</div>
    </td>
    <td style="width:45%;height:60px;vertical-align:bottom;text-align:right;padding-bottom:4px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="white-space:nowrap;padding-right:6px;font-size:11pt;">Cell No:-</td>
          <td style="border-bottom:1.5px solid #000;min-width:100px;font-size:11pt;">${esc(visit?.faculty?.phone)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<div class="notes">
  <strong>Note:</strong><br>
  1) The faculty members should visit all the ${hostelType} Hostels (as applicable) on the premises<br>
  2) The visiting faculty should write feedback of issues related to only ragging in Hostel Visit Feedback Form and also submit the same to Anti Ragging Committee Coordinator by the next working day.
</div>
<div class="helpline">Anti-Ragging Helpline Number 1800-180-5522 (Toll-free) and email helpline@antiragging.net</div>
</body></html>`;
}

// ─── Mess Feedback HTML Template ─────────────────────────────────────────────
export function generateMessFeedbackHTML(visit, rawFormData) {
  const formData = normalizeFormData(rawFormData);
  const d = visit?.checkIn ? new Date(visit.checkIn) : new Date();
  const timeStr = fmtTime(d);
  const locKey  = hostelToLocKey(visit?.hostel?.name);

  const gt  = (key) =>
    (key === locKey && !formData[`loc_${key}_time`]) ? timeStr : (formData[`loc_${key}_time`] || '');
  const yn  = (k) => {
    if (formData[k] === 'Yes') return 'Yes <b>&#10003;</b> / No';
    if (formData[k] === 'No')  return 'Yes / No <b>&#10003;</b>';
    return 'Yes / No';
  };
  const meal = (m) => formData.meal_type === m ? `<b><u>${m}</u></b>` : m;
  const ovf  = (v) => formData.overall_feedback === v ? `<b><u>${v}</u></b>` : v;

  const CSS = `
    @page { size: A4 portrait; margin: 12mm 15mm 10mm 15mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; background: #fff; line-height: 1.3; }
    .hdr { text-align: center; margin-bottom: 3px; }
    .hdr .big { font-size: 13pt; font-weight: bold; display: block; }
    .hdr .med { font-size: 11pt; font-weight: bold; display: block; }
    .hdr .sm  { font-size: 10pt; display: block; }
    .hr { border: none; border-top: 1.5px solid #000; margin: 3px 0; }
    .committee { font-size: 12pt; font-weight: bold; text-align: center; margin: 2px 0 1px; }
    .subtitle  { font-size: 10.5pt; font-weight: bold; text-align: center; margin-bottom: 3px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    td, th { padding: 2px 5px; vertical-align: middle; word-wrap: break-word; }
    .tbl td, .tbl th { border: 1px solid #000; }
    .tbl th { background: #ebebeb; font-weight: bold; text-align: center; font-size: 10pt; }
    .sec { font-weight: bold; font-size: 10.5pt; margin: 4px 0 1px; display: block; }
    .box  { border: 1px solid #000; min-height: 18px; padding: 1px 5px; font-size: 10pt; margin-bottom: 3px; }
    .box2 { border: 1px solid #000; min-height: 28px; padding: 1px 5px; font-size: 10pt; margin-bottom: 3px; }
  `;

  const locsRows = LOCATIONS.map(l =>
    `<tr><td>${l.label}</td><td>${esc(gt(l.key))}</td><td>${esc(formData[`loc_${l.key}_remarks`])}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Mess Feedback Form</title><style>${CSS}</style></head><body>
<div class="hdr">
  <span class="big">G.S.Mandal's</span>
  <span class="big">Maharashtra Institute of Technology,</span>
  <span class="med">Chhatrapati Sambhajinagar</span>
  <span class="sm">(An Autonomous Institute)</span>
</div>
<hr class="hr">
<div class="committee">Hostel Mess Food Quality Inspection Committee</div>
<div class="subtitle">Feedback Form for Daily Inspection</div>
<hr class="hr">
<table class="tbl" style="margin-bottom:3px;">
  <colgroup><col style="width:35%"><col style="width:28%"><col style="width:14%"><col style="width:23%"></colgroup>
  <tr><td>Date and Day of visit:</td><td>${fmtDate(d)}, ${fmtDay(d)}</td><td>Time slot:-</td><td>${timeStr}</td></tr>
</table>
<table class="tbl" style="margin-bottom:4px;">
  <colgroup><col style="width:35%"><col style="width:28%"><col style="width:14%"><col style="width:23%"></colgroup>
  <tr><td>Name of Member/s:</td><td>${esc(visit?.faculty?.name)}</td><td>Department:-</td><td>${esc(visit?.faculty?.department)}</td></tr>
</table>
<span class="sec">&#8226; Locations visited</span>
<table class="tbl" style="margin-bottom:4px;">
  <colgroup><col style="width:22%"><col style="width:18%"><col style="width:60%"></colgroup>
  <thead><tr><th>Locations</th><th>Time</th><th>Remarks</th></tr></thead>
  <tbody>${locsRows}</tbody>
</table>
<table class="tbl" style="margin-bottom:4px;">
  <colgroup><col style="width:30%"><col></colgroup>
  <tr><td>Date: ${fmtDate(d)}</td><td>Meal: ${meal('Breakfast')} &nbsp;/&nbsp; ${meal('Lunch')} &nbsp;/&nbsp; ${meal('Dinner')}</td></tr>
</table>
<table class="tbl" style="margin-bottom:2px;">
  <tr><td>1) Have you tasted food in the served meal? : ${yn('tasted_food')}</td></tr>
</table>
<div style="margin:2px 0 1px;font-size:10.5pt;">2) Menu items in the meal:</div>
<div class="box">${esc(formData.menu_items)}</div>
<table class="tbl" style="margin-bottom:2px;">
  <tr><td>3) Has the cleanliness of the dining hall been maintained? : ${yn('cleanliness')}</td></tr>
</table>
<table class="tbl" style="margin-bottom:2px;">
  <tr><td>4) Were the empty Plates/Spoons neatly cleaned? : ${yn('plates_clean')}</td></tr>
</table>
<table class="tbl" style="margin-bottom:3px;">
  <tr><td>5) Was the food served hot? : ${yn('food_hot')}</td></tr>
</table>
<div style="margin:2px 0 1px;font-size:10.5pt;">6) Write your detailed remarks about the taste and condition of the food:</div>
<div class="box2">${esc(formData.food_remarks)}</div>
<table class="tbl" style="margin-bottom:3px;">
  <tr><td>7) Overall Feedback about the food: ${ovf('Satisfactory')} &nbsp;/&nbsp; ${ovf('Needs improvement')}</td></tr>
</table>
<div style="margin:2px 0 1px;font-size:10.5pt;">8) Please suggest areas of improvement:</div>
<div class="box2">${esc(formData.improvement_suggestions)}</div>
<table class="tbl" style="margin-top:8px;">
  <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
  <tr>
    <td style="height:42px;vertical-align:bottom;padding-bottom:3px;">
      Signature of Visiting faculty<br><br>1)&nbsp;${esc(visit?.faculty?.name)}
    </td>
    <td style="vertical-align:bottom;padding-bottom:3px;">Signature of Visiting faculty<br><br>2)</td>
  </tr>
</table>
</body></html>`;
}
