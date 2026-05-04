// ─────────────────────────────────────────────────────────────────
//  Student Data Module
//  MongoDB → StudentProfile (metadata, overall grade)
//  MySQL   → ExamMark, Attendance, SubjectAttendance, ProcessedResult
// ─────────────────────────────────────────────────────────────────
const StudentProfile  = require('../models/mongo/StudentProfile');
const { ExamMark, Attendance, SubjectAttendance, ProcessedResult } = require('../models/mysql');
const { EXAMS, EXAM_MAX_MARKS, averageMarks } = require('./examConfig');

const SUBJECTS = ['Mathematics','Physics','English','French','DSA'];

function calcGrade(avg) {
  if (avg>=90) return 'A+'; if (avg>=80) return 'A'; if (avg>=70) return 'B';
  if (avg>=60) return 'C';  if (avg>=50) return 'D'; return 'F';
}

function buildMarksMap(markRows) {
  const marks = {};
  for (const row of markRows) {
    if (!marks[row.subject]) marks[row.subject] = [0,0,0,0];
    marks[row.subject][row.examIndex] = row.mark;
  }
  return marks;
}

// Build subjectAttendance map from rows
function buildSubjectAttMap(rows) {
  const map = {};
  for (const r of rows) map[r.subject] = r.percentage;
  return map;
}

// Recompute processed result for one student
async function recomputeProcessed(studentId) {
  const markRows = await ExamMark.findAll({ where: { studentId }, raw: true });
  const marks    = buildMarksMap(markRows);
  const subjects = Object.keys(marks);
  const subjectAverages = {};
  let total = 0, count = 0;
  for (const subj of subjects) {
    const arr = marks[subj];
    const avg = averageMarks(arr);
    subjectAverages[subj] = avg;
    total += avg; count++;
  }
  const overallAverage = count ? Math.round((total/count)*10)/10 : 0;
  const grade = calcGrade(overallAverage);
  await ProcessedResult.upsert({
    studentId, overallAverage, grade,
    subjectAverages: JSON.stringify(subjectAverages),
    lastComputedAt: new Date()
  });
  await StudentProfile.findOneAndUpdate({ studentId }, { grade, updatedAt: new Date() });
  return { overallAverage, grade, subjectAverages, marks };
}

// ── Get all students (with marks + attendance) ────────────────────
async function getAllStudents(cls) {
  const query   = cls ? { class: cls } : {};
  const profiles = await StudentProfile.find(query).lean().sort({ studentId: 1 });
  const ids      = profiles.map(p => p.studentId);

  const attRows  = await Attendance.findAll({ where: { studentId: ids }, raw: true });
  const markRows = await ExamMark.findAll({ where: { studentId: ids }, raw: true });
  const subjAttRows = await SubjectAttendance.findAll({ where: { studentId: ids }, raw: true });

  const attMap = {}, marksMap = {}, subjAttMap = {};
  attRows.forEach(a => attMap[a.studentId] = a.percentage);
  for (const row of markRows) {
    if (!marksMap[row.studentId]) marksMap[row.studentId] = {};
    if (!marksMap[row.studentId][row.subject]) marksMap[row.studentId][row.subject] = [0,0,0,0];
    marksMap[row.studentId][row.subject][row.examIndex] = row.mark;
  }
  for (const row of subjAttRows) {
    if (!subjAttMap[row.studentId]) subjAttMap[row.studentId] = {};
    subjAttMap[row.studentId][row.subject] = row.percentage;
  }

  return profiles.map(p => ({
    id:                p.studentId,
    name:              p.name,
    class:             p.class,
    email:             p.email,
    attendance:        attMap[p.studentId] ?? p.attendance,
    subjectAttendance: subjAttMap[p.studentId] || {},
    grade:             p.grade,
    marks:             marksMap[p.studentId] || {},
    exams:             EXAMS
  }));
}

async function getStudentById(studentId) {
  const profile = await StudentProfile.findOne({ studentId }).lean();
  if (!profile) throw new Error('Student not found: ' + studentId);
  const markRows    = await ExamMark.findAll({ where: { studentId }, raw: true });
  const attRow      = await Attendance.findOne({ where: { studentId }, raw: true });
  const subjAttRows = await SubjectAttendance.findAll({ where: { studentId }, raw: true });

  return {
    id:                profile.studentId,
    name:              profile.name,
    class:             profile.class,
    email:             profile.email,
    attendance:        attRow ? attRow.percentage : profile.attendance,
    subjectAttendance: buildSubjectAttMap(subjAttRows),
    grade:             profile.grade,
    marks:             buildMarksMap(markRows),
    exams:             EXAMS
  };
}

async function addStudent(data) {
  const studentId = data.id;
  const exists = await StudentProfile.findOne({ studentId });
  if (exists) throw new Error('Student ID already exists');
  await StudentProfile.create({
    studentId, name: data.name, class: data.class,
    email: data.email || `${studentId.toLowerCase()}@cs.edu`,
    attendance: data.attendance || 100, grade: 'N/A'
  });
  await Attendance.create({ studentId, percentage: data.attendance || 100 });
  // Init subject attendance at 100% for all subjects
  for (const subj of SUBJECTS) {
    await SubjectAttendance.create({ studentId, subject: subj, percentage: 100 });
  }
  await ProcessedResult.create({
    studentId, overallAverage: 0, grade: 'N/A',
    subjectAverages: '{}', lastComputedAt: new Date()
  });
  return getStudentById(studentId);
}

async function updateAttendance(studentId, percentage, updatedBy) {
  await Attendance.upsert({ studentId, percentage, updatedBy });
  await StudentProfile.findOneAndUpdate({ studentId }, { attendance: percentage, updatedAt: new Date() });
  return percentage;
}

// Update subject marks (all 4 exams) + recompute processed result
async function updateSubjectMarks(studentId, subject, marksArray) {
  for (let i = 0; i < EXAMS.length; i++) {
    await ExamMark.upsert({
      studentId,
      subject,
      examName: EXAMS[i],
      examIndex: i,
      mark: marksArray[i]
    });
  }
  await recomputeProcessed(studentId);
  return getStudentById(studentId);
}

// Update subject-specific attendance
async function updateSubjectAttendance(studentId, subject, percentage, updatedBy) {
  await SubjectAttendance.upsert({ studentId, subject, percentage, updatedBy });
  return percentage;
}

async function deleteStudent(studentId) {
  const exists = await StudentProfile.findOne({ studentId });
  if (!exists) throw new Error('Student not found');
  await StudentProfile.deleteOne({ studentId });
  await ExamMark.destroy({ where: { studentId } });
  await Attendance.destroy({ where: { studentId } });
  await SubjectAttendance.destroy({ where: { studentId } });
  await ProcessedResult.destroy({ where: { studentId } });
  return { message: 'Student deleted from all databases' };
}

async function getClassSummary(cls) {
  const profiles = await StudentProfile.find(cls ? { class: cls } : {}).lean().sort({ studentId: 1 });
  const ids      = profiles.map(p => p.studentId);
  const processedRows = await ProcessedResult.findAll({ where: { studentId: ids }, raw: true });
  const attRows       = await Attendance.findAll({ where: { studentId: ids }, raw: true });
  const subjAttRows   = await SubjectAttendance.findAll({ where: { studentId: ids }, raw: true });
  const procMap = {}, attMap = {}, subjAttMap = {};
  processedRows.forEach(r => procMap[r.studentId] = r);
  attRows.forEach(a => attMap[a.studentId] = a.percentage);
  for (const row of subjAttRows) {
    if (!subjAttMap[row.studentId]) subjAttMap[row.studentId] = {};
    subjAttMap[row.studentId][row.subject] = row.percentage;
  }
  return profiles.map(p => {
    const proc = procMap[p.studentId] || {};
    const subjectAvgs = proc.subjectAverages ? JSON.parse(proc.subjectAverages) : {};
    return {
      id:                p.studentId,
      name:              p.name,
      class:             p.class,
      attendance:        attMap[p.studentId] ?? p.attendance,
      subjectAttendance: subjAttMap[p.studentId] || {},
      grade:             p.grade,
      overallAverage:    proc.overallAverage || 0,
      subjectAvgs
    };
  });
}

async function computeOverall(marks) {
  const avgs = Object.values(marks).map(arr => averageMarks(arr));
  if (!avgs.length) return 0;
  return Math.round((avgs.reduce((a,b)=>a+b,0)/avgs.length)*10)/10;
}

module.exports = {
  getAllStudents, getStudentById, addStudent,
  updateAttendance, updateSubjectMarks, updateSubjectAttendance, deleteStudent, getClassSummary,
  recomputeProcessed, buildMarksMap, buildSubjectAttMap, computeOverall,
  EXAMS, EXAM_MAX_MARKS, SUBJECTS, calcGrade, averageMarks
};
