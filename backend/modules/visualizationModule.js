// ─────────────────────────────────────────────────────────────────
//  Visualization Module — includes subject attendance in all views
// ─────────────────────────────────────────────────────────────────
const StudentProfile  = require('../models/mongo/StudentProfile');
const { ExamMark, Attendance, SubjectAttendance, ProcessedResult } = require('../models/mysql');
const { buildMarksMap, buildSubjectAttMap, calcGrade, EXAMS, SUBJECTS, averageMarks } = require('./studentDataModule');
const { normalizeMark } = require('./examConfig');

const CLASSES = ['CS1','CS2','CS3','CS4'];

// ── Student view (includes subjectAttendance) ─────────────────────
async function getStudentVisualization(studentId) {
  const profile     = await StudentProfile.findOne({ studentId }).lean();
  if (!profile) throw new Error('Student not found');
  const markRows    = await ExamMark.findAll({ where: { studentId }, raw: true });
  const attRow      = await Attendance.findOne({ where: { studentId }, raw: true });
  const subjAttRows = await SubjectAttendance.findAll({ where: { studentId }, raw: true });
  const marks       = buildMarksMap(markRows);
  const subjects    = Object.keys(marks);
  const subjectAttendance = buildSubjectAttMap(subjAttRows);

  return {
    student: {
      id:                studentId,
      name:              profile.name,
      class:             profile.class,
      email:             profile.email,
      attendance:        attRow ? attRow.percentage : profile.attendance,
      subjectAttendance,
      grade:             profile.grade
    },
    exams:     EXAMS,
    lineData:  subjects.map(s => ({ label: s, data: marks[s] })),
    barData:   subjects.map(s => {
      const arr = marks[s];
      return { subject: s, average: averageMarks(arr) };
    }),
    radarData: subjects.map(s => ({ subject: s, score: marks[s][3] || 0 })),
    // Subject attendance for the Attendance page
    subjectAttendance
  };
}

// ── Class view ────────────────────────────────────────────────────
async function getClassVisualization(cls) {
  const profiles   = await StudentProfile.find({ class: cls }).lean().sort({ studentId: 1 });
  const ids        = profiles.map(p => p.studentId);
  const processedRows = await ProcessedResult.findAll({ where: { studentId: ids }, raw: true });
  const attRows       = await Attendance.findAll({ where: { studentId: ids }, raw: true });
  const subjAttRows   = await SubjectAttendance.findAll({ where: { studentId: ids }, raw: true });
  const markRows      = await ExamMark.findAll({ where: { studentId: ids }, raw: true });

  const procMap = {}, attMap = {}, subjAttMap = {};
  processedRows.forEach(r => procMap[r.studentId] = r);
  attRows.forEach(a => attMap[a.studentId] = a.percentage);
  for (const row of subjAttRows) {
    if (!subjAttMap[row.studentId]) subjAttMap[row.studentId] = {};
    subjAttMap[row.studentId][row.subject] = row.percentage;
  }

  const allMarks = {};
  for (const row of markRows) {
    if (!allMarks[row.studentId]) allMarks[row.studentId] = {};
    if (!allMarks[row.studentId][row.subject]) allMarks[row.studentId][row.subject] = [0,0,0,0];
    allMarks[row.studentId][row.subject][row.examIndex] = row.mark;
  }

  // Subject class averages (marks)
  const subjectTotals = {}, subjectCounts = {};
  for (const sid of ids) {
    for (const subj of SUBJECTS) {
      const arr = allMarks[sid]?.[subj];
      if (!arr) continue;
      const avg = averageMarks(arr);
      subjectTotals[subj] = (subjectTotals[subj]||0) + avg;
      subjectCounts[subj] = (subjectCounts[subj]||0) + 1;
    }
  }
  const classAverages = SUBJECTS.map(s => ({
    subject: s,
    average: subjectCounts[s] ? Math.round((subjectTotals[s]/subjectCounts[s])*10)/10 : 0
  }));

  // Subject attendance class averages
  const subjAttTotals = {}, subjAttCounts = {};
  for (const sid of ids) {
    for (const subj of SUBJECTS) {
      const pct = subjAttMap[sid]?.[subj];
      if (pct === undefined) continue;
      subjAttTotals[subj] = (subjAttTotals[subj]||0) + pct;
      subjAttCounts[subj] = (subjAttCounts[subj]||0) + 1;
    }
  }
  const subjectAttendanceAverages = SUBJECTS.map(s => ({
    subject: s,
    average: subjAttCounts[s] ? Math.round((subjAttTotals[s]/subjAttCounts[s])*10)/10 : 0
  }));

  // Exam trends
  const examTrends = EXAMS.map((exam, ei) => {
    let total=0, cnt=0;
    for (const sid of ids) {
      for (const subj of SUBJECTS) {
        const arr = allMarks[sid]?.[subj];
        if (arr) { total += normalizeMark(arr[ei], ei); cnt++; }
      }
    }
    return { exam, average: cnt ? Math.round((total/cnt)*10)/10 : 0 };
  });

  // Grade distribution
  const grades = {'A+':0,'A':0,'B':0,'C':0,'D':0,'F':0};
  const studentAverages = profiles.map(p => {
    const proc = procMap[p.studentId] || {};
    if (proc.grade && grades[proc.grade]!==undefined) grades[proc.grade]++;
    return {
      id:                p.studentId,
      name:              p.name,
      overall:           proc.overallAverage || 0,
      grade:             proc.grade || p.grade,
      attendance:        attMap[p.studentId] ?? p.attendance,
      subjectAttendance: subjAttMap[p.studentId] || {}
    };
  });

  return { classAverages, studentAverages, gradeDistribution: grades,
           examTrends, subjectAttendanceAverages, totalStudents: profiles.length, classLabel: cls };
}

// ── Teacher subject view ──────────────────────────────────────────
async function getTeacherSubjectVisualization(subject) {
  const allProfiles = await StudentProfile.find({}).lean();
  const ids         = allProfiles.map(p => p.studentId);
  const markRows    = await ExamMark.findAll({ where: { studentId: ids, subject }, raw: true });
  const subjAttRows = await SubjectAttendance.findAll({ where: { studentId: ids, subject }, raw: true });

  const subjectMarks = {}, subjectAtt = {};
  for (const row of markRows) {
    if (!subjectMarks[row.studentId]) subjectMarks[row.studentId] = [0,0,0,0];
    subjectMarks[row.studentId][row.examIndex] = row.mark;
  }
  subjAttRows.forEach(r => subjectAtt[r.studentId] = r.percentage);

  // Class averages for marks
  const classAverages = CLASSES.map(cls => {
    const group = allProfiles.filter(p => p.class === cls);
    let total=0, cnt=0;
    group.forEach(p => {
      const arr = subjectMarks[p.studentId];
      if (arr) { total += averageMarks(arr); cnt++; }
    });
    return { class: cls, average: cnt ? Math.round((total/cnt)*10)/10 : 0 };
  });

  // Class attendance averages for this subject
  const classAttendanceAverages = CLASSES.map(cls => {
    const group = allProfiles.filter(p => p.class === cls);
    let total=0, cnt=0;
    group.forEach(p => {
      const pct = subjectAtt[p.studentId];
      if (pct !== undefined) { total+=pct; cnt++; }
    });
    return { class: cls, average: cnt ? Math.round((total/cnt)*10)/10 : 0 };
  });

  // Exam trend per class
  const examTrends = CLASSES.map(cls => {
    const group = allProfiles.filter(p => p.class === cls);
    return {
      class: cls,
      data: EXAMS.map((_, ei) => {
        let total=0, cnt=0;
        group.forEach(p => { const arr=subjectMarks[p.studentId]; if(arr){total += normalizeMark(arr[ei], ei);cnt++;} });
        return cnt ? Math.round((total/cnt)*10)/10 : 0;
      })
    };
  });

  // Grade distribution
  const gradeDistribution = {'A+':0,'A':0,'B':0,'C':0,'D':0,'F':0};
  allProfiles.forEach(p => {
    const arr = subjectMarks[p.studentId];
    if (!arr) return;
    const g = calcGrade(averageMarks(arr));
    if (gradeDistribution[g]!==undefined) gradeDistribution[g]++;
  });

  return { subject, classAverages, classAttendanceAverages, examTrends, gradeDistribution, exams: EXAMS };
}

module.exports = { getStudentVisualization, getClassVisualization, getTeacherSubjectVisualization };
