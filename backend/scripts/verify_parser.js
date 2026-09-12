'use strict';
require('dotenv').config();

const XLSX = require('xlsx');
const { parseScheduleExcel, buildPreview } = require('../services/excelParserService');

const rows = [
  ['Squad Schedule'],
  [],
  ['Maharashtra Institute of Technology, Chhatrapati Sambhajinagar'],
  ['Anti Ragging Visiting staff Squad 2026-2027'],
  ['Schedule for Boys Hostel'],
  ['Round -I','Round -II','Round -III','Round -IV','Faculty -I','Contact No','Faculty -II','Contact No'],
  // Aug 1 group: 3 faculty (2 primary + 1 continuation)
  ['1-Aug-26','12-Oct-26','29-Dec-26','11-Mar-27','Mr. Lomte Sachin Vijay','9226891714','Mr. Upadhye Vasudev Raghunath','9673217878'],
  ['','','','','Prof. Sanjay V. Mhaske','9422705878','',''],
  // Aug 2 group: 3 faculty
  ['2-Aug-26','13-Oct-26','30-Dec-26','12-Mar-27','Dr. Keche Ashok Jayawantrao','9325756115','Mr. Chatorikar Ram Nagnathrao','9766037828'],
  ['','','','','Ar. Tushar Sharad Paithankar','9960626950','',''],
  // Aug 5 group: comma-separated phone number
  ['5-Aug-26','16-Oct-26','2-Jan-27','15-Mar-27','Dr. Zine Pankaj Uttamrao','8447429650','Mr. Pawar Shrikant Nandlal','9420114316, 9975711727'],
  ['','','','','Dr. Prasad Ramakant Kulkarni','9890601238','',''],
  // Aug 6 group: regular 2-faculty, no continuation
  ['6-Aug-26','17-Oct-26','3-Jan-27','16-Mar-27','Mr. Andhale Sunil Raosaheb','9370201888','Mr. Jaiswal Abhishek Prafulkumar','9960964688'],
  // Footer rows — must all be skipped
  ['Note:-Faculties are instructed to visit the hostel between 7.30 pm to 10.00 pm.'],
  ['','','','','Coordinator','','','Director'],
  ['','','','','Maharashtra Institute of Technology, Chhatrapati Sambhajinagar (An Autonomous Institute)'],
];

const ws  = XLSX.utils.aoa_to_sheet(rows);
const wb  = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

const result = parseScheduleExcel(buf, 'Boys-Hostel-Verify.xlsx');

let pass = true;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) pass = false;
  console.log((ok ? '  PASS' : '  FAIL'), label + ':', actual, ok ? '' : '(expected: ' + expected + ')');
}

console.log('\n=== PARSER RESULTS ===');
check('hostelType',        result.hostelType,    'boys');
check('academicYear',      result.academicYear,  '2026-2027');
check('scheduleGroups',    result.scheduleGroups.length, 4);
check('unique faculty',    result.facultyList.length,   11);
// 3+3+3+2 faculty × 4 rounds each = 44
check('totalExpected',     result.totalExpected, 44);
check('warnings',          result.warnings.length, 0);

console.log('\n=== PER-GROUP ===');
const expectedFacultyCounts = [3, 3, 3, 2];
result.scheduleGroups.forEach((g, i) => {
  const label = 'Group ' + (i + 1) + ' faculty count';
  check(label, g.faculty.length, expectedFacultyCounts[i]);

  const labelD = 'Group ' + (i + 1) + ' date count';
  check(labelD, g.dates.length, 4);

  console.log('    Rounds:', g.dates.map(function(d) { return d.round; }).join(', '));
  console.log('    Faculty:', g.faculty.map(function(f) { return f.name.split(' ').slice(-1)[0]; }).join(', '));
});

console.log('\n=== PREVIEW ROWS ===');
const preview = buildPreview(result, [], [{ id: 'h1', name: 'Boys Hostel', type: 'boys' }], []);
check('preview.scheduleRows', preview.scheduleRows.length, 44);

const byRound = {};
preview.scheduleRows.forEach(function(r) { byRound[r.round] = (byRound[r.round] || 0) + 1; });
Object.keys(byRound).sort().forEach(function(r) {
  console.log('    ' + r + ':', byRound[r], 'rows (expected 11)');
});

console.log('\n=== EDGE CASES ===');
// Phone extraction: comma-separated
const pawarVisit = preview.scheduleRows.find(function(r) { return r.facultyName.indexOf('Pawar Shrikant') !== -1; });
check('comma-phone extraction', pawarVisit ? pawarVisit.facultyPhone : 'NOT FOUND', '9420114316');

// Continuation row correctly assigned to group 1
const sanjaySeen = result.scheduleGroups[0].faculty.some(function(f) { return f.name.indexOf('Sanjay') !== -1; });
check('continuation row in group 1', sanjaySeen, true);

// Footer skipped
const noteInData = result.scheduleGroups.some(function(g) {
  return g.faculty.some(function(f) { return f.name.toLowerCase().indexOf('note') !== -1; });
});
check('footer rows skipped', noteInData, false);

// Coordinator line skipped
const coordInData = result.scheduleGroups.some(function(g) {
  return g.faculty.some(function(f) { return f.name.toLowerCase().indexOf('coordinator') !== -1; });
});
check('coordinator line skipped', coordInData, false);

console.log('\n=== AUTH LOGIC SIMULATION ===');
const bcrypt = require('bcryptjs');
const phone  = '9226891714';
const hash   = bcrypt.hashSync(phone, 12);
const matchCorrect = bcrypt.compareSync(phone, hash);
const matchWrong   = bcrypt.compareSync('wrongpassword', hash);
check('bcrypt hash+verify (correct phone)', matchCorrect, true);
check('bcrypt hash+verify (wrong phone)',   matchWrong,   false);
console.log('    Sample FAC code: FAC001, FAC002 ... FAC' + String(result.facultyList.length).padStart(3,'0'));

console.log('\n=== OVERALL: ' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===\n');
process.exitCode = pass ? 0 : 1;
