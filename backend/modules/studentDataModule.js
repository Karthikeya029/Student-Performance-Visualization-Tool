// ─────────────────────────────────────────────────────────────────
//  Student Data Module
//  Profiles & attendance → MongoDB (StudentProfile)
//  Marks                 → MySQL  (ExamMark)
//  Processed results     → MySQL  (ProcessedResult) [cache]
// ─────────────────────────────────────────────────────────────────
const StudentProfile  = require('../models/mongo/StudentProfile');
const { ExamMark, Attendance, ProcessedResult } = require('../models/mysql');

const EXAMS    = ['Unit Test 1','Mid Term','Unit Test 2','Final'];
const SUBJECTS = ['Mathematics','Science','English','History','Computer Science'];

function calcGrade(avg) {
  if (avg>=90) return 'A+'; if (avg>=80) return 'A'; if (avg>=70) return 'B';
  if (avg>=60) return 'C';  if (avg>=50) return 'D'; return 'F';
}

// ── Helpers ───────────────────────────────────────────────────────

// Build marks object {subject: [m0,m1,m2,m3]} from MySQL rows
function buildMarksMap(markRows) {
  const marks = {};
  for (const row of markRows) {
    if (!marks[row.subject]) marks[row.subject] = [0,0,0,0];
    marks[row.subject][row.examIndex] = row.mark;
  }
  return marks;
}

// Recompute processed result for one student and save to MySQL
async function recomputeProcessed(studentId) {
  const markRows = await ExamMark.findAll({ where: { studentId }, raw: true });
  const marks    = buildMarksMap(markRows);
  const subjects = Object.keys(marks);
  const subjectAverages = {};
  let total = 0, count = 0;
  for (const subj of subjects) {
    const arr = marks[subj];
    const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
    subjectAverages[subj] = Math.round(avg * 10) / 10;
    total += avg; count++;
  }
  const overallAverage = count ? Math.round((total/count)*10)/10 : 0;
  const grade = calcGrade(overallAverage);

  // Update ProcessedResult (upsert)
  await ProcessedResult.upsert({
    studentId, overallAverage, grade,
    subjectAverages: JSON.stringify(subjectAverages),
    lastComputedAt: new Date()
  });

  // Update grade in MongoDB profile
  await StudentProfile.findOneAndUpdate({ studentId }, { grade, updatedAt: new Date() });

  return { overallAverage, grade, subjectAverages, marks };
}

// ── Student Profile (MongoDB) ─────────────────────────────────────

async function getAllStudents(cls) {
  const query = cls ? { class: cls } : {};
  const profiles = await StudentProfile.find(query).lean().sort({ studentId: 1 });

  // Attach attendance from MySQL
  const attRows = await Attendance.findAll({
    where: cls ? { studentId: profiles.map(p=>p.studentId) } : {},
    raw: true
  });
  const attMap = {};
  attRows.forEach(a => attMap[a.studentId] = a.percentage);

  // Attach marks from MySQL
  const studentIds = profiles.map(p => p.studentId);
  const markRows = await ExamMark.findAll({
    where: { studentId: studentIds },
    raw: true
  });
  // Group marks by studentId
  const marksMap = {};
  for (const row of markRows) {
    if (!marksMap[row.studentId]) marksMap[row.studentId] = {};
    if (!marksMap[row.studentId][row.subject]) marksMap[row.studentId][row.subject] = [0,0,0,0];
    marksMap[row.studentId][row.subject][row.examIndex] = row.mark;
  }

  return profiles.map(p => ({
    id:         p.studentId,
    name:       p.name,
    class:      p.class,
    email:      p.email,
    attendance: attMap[p.studentId] ?? p.attendance,
    grade:      p.grade,
    marks:      marksMap[p.studentId] || {},
    exams:      EXAMS
  }));
}

async function getStudentById(studentId) {
  const profile = await StudentProfile.findOne({ studentId }).lean();
  if (!profile) throw new Error('Student not found: ' + studentId);

  const markRows = await ExamMark.findAll({ where: { studentId }, raw: true });
  const attRow   = await Attendance.findOne({ where: { studentId }, raw: true });

  return {
    id:         profile.studentId,
    name:       profile.name,
    class:      profile.class,
    email:      profile.email,
    attendance: attRow ? attRow.percentage : profile.attendance,
    grade:      profile.grade,
    marks:      buildMarksMap(markRows),
    exams:      EXAMS
  };
}

async function addStudent(data) {
  const studentId = data.id;
  const exists = await StudentProfile.findOne({ studentId });
  if (exists) throw new Error('Student ID already exists');

  // 1. Create MongoDB profile
  await StudentProfile.create({
    studentId, name: data.name, class: data.class,
    email: data.email || `${studentId.toLowerCase()}@cs.edu`,
    attendance: data.attendance || 100, grade: 'N/A'
  });

  // 2. Create MySQL attendance row
  await Attendance.create({ studentId, percentage: data.attendance || 100 });

  // 3. Init empty processed result
  await ProcessedResult.create({
    studentId, overallAverage: 0, grade: 'N/A',
    subjectAverages: '{}', lastComputedAt: new Date()
  });

  return getStudentById(studentId);
}

async function updateAttendance(studentId, percentage, updatedBy) {
  // Update MySQL attendance (source of truth)
  await Attendance.upsert({ studentId, percentage, updatedBy });
  // Keep MongoDB profile in sync
  await StudentProfile.findOneAndUpdate({ studentId }, { attendance: percentage, updatedAt: new Date() });
  return percentage;
}

async function deleteStudent(studentId) {
  const exists = await StudentProfile.findOne({ studentId });
  if (!exists) throw new Error('Student not found');
  // Remove from all 3 stores
  await StudentProfile.deleteOne({ studentId });
  await ExamMark.destroy({ where: { studentId } });
  await Attendance.destroy({ where: { studentId } });
  await ProcessedResult.destroy({ where: { studentId } });
  return { message: 'Student deleted from all databases' };
}

// ── Marks (MySQL) ─────────────────────────────────────────────────

async function updateSubjectMarks(studentId, subject, marksArray) {
  // Upsert each exam mark row in MySQL
  for (let i = 0; i < 4; i++) {
    await ExamMark.upsert({
      studentId, subject,
      examName:  EXAMS[i],
      examIndex: i,
      mark:      marksArray[i]
    });
  }
  // Rebuild processed result (cache)
  const computed = await recomputeProcessed(studentId);
  return getStudentById(studentId);
}

// ── Summary (uses ProcessedResult cache) ─────────────────────────

async function getClassSummary(cls) {
  const profiles = await StudentProfile.find(cls ? { class: cls } : {}).lean().sort({ studentId: 1 });
  const studentIds = profiles.map(p => p.studentId);

  const processedRows = await ProcessedResult.findAll({
    where: { studentId: studentIds }, raw: true
  });
  const attRows = await Attendance.findAll({
    where: { studentId: studentIds }, raw: true
  });
  const procMap = {}, attMap = {};
  processedRows.forEach(r => procMap[r.studentId] = r);
  attRows.forEach(a => attMap[a.studentId] = a.percentage);

  return profiles.map(p => {
    const proc = procMap[p.studentId] || {};
    const subjectAvgs = proc.subjectAverages ? JSON.parse(proc.subjectAverages) : {};
    return {
      id:             p.studentId,
      name:           p.name,
      class:          p.class,
      attendance:     attMap[p.studentId] ?? p.attendance,
      grade:          p.grade,
      overallAverage: proc.overallAverage || 0,
      subjectAvgs
    };
  });
}

async function computeOverall(marks) {
  const avgs = Object.values(marks).map(arr => arr.reduce((a,b)=>a+b,0)/arr.length);
  if (!avgs.length) return 0;
  return Math.round((avgs.reduce((a,b)=>a+b,0)/avgs.length)*10)/10;
}

module.exports = {
  getAllStudents, getStudentById, addStudent,
  updateAttendance, deleteStudent,
  updateSubjectMarks, getClassSummary,
  recomputeProcessed, buildMarksMap, computeOverall,
  EXAMS, SUBJECTS, calcGrade
};
