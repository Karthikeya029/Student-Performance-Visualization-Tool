// ─────────────────────────────────────────────────────────────────
//  Visualization Module
//  Uses ProcessedResult cache (MySQL) for speed
//  Falls back to live calculation only if cache is missing
// ─────────────────────────────────────────────────────────────────
const StudentProfile  = require('../models/mongo/StudentProfile');
const { ExamMark, Attendance, ProcessedResult } = require('../models/mysql');
const { buildMarksMap, calcGrade, EXAMS, SUBJECTS } = require('./studentDataModule');

const CLASSES = ['CS1','CS2','CS3','CS4'];

// ── Student View ──────────────────────────────────────────────────
async function getStudentVisualization(studentId) {
  const profile  = await StudentProfile.findOne({ studentId }).lean();
  if (!profile) throw new Error('Student not found');

  const markRows = await ExamMark.findAll({ where: { studentId }, raw: true });
  const attRow   = await Attendance.findOne({ where: { studentId }, raw: true });
  const marks    = buildMarksMap(markRows);
  const subjects = Object.keys(marks);

  return {
    student: {
      id:         studentId,
      name:       profile.name,
      class:      profile.class,
      email:      profile.email,
      attendance: attRow ? attRow.percentage : profile.attendance,
      grade:      profile.grade
    },
    exams:     EXAMS,
    lineData:  subjects.map(s => ({ label: s, data: marks[s] })),
    barData:   subjects.map(s => {
      const arr = marks[s];
      return { subject: s, average: Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10 };
    }),
    radarData: subjects.map(s => ({ subject: s, score: marks[s][3] || 0 }))
  };
}

// ── Class View (uses ProcessedResult cache) ───────────────────────
async function getClassVisualization(cls) {
  const profiles = await StudentProfile.find({ class: cls }).lean().sort({ studentId: 1 });
  const studentIds = profiles.map(p => p.studentId);

  // Use ProcessedResult for per-student averages (fast cache)
  const processedRows = await ProcessedResult.findAll({ where: { studentId: studentIds }, raw: true });
  const attRows       = await Attendance.findAll({ where: { studentId: studentIds }, raw: true });
  const procMap = {}, attMap = {};
  processedRows.forEach(r => procMap[r.studentId] = r);
  attRows.forEach(a => attMap[a.studentId] = a.percentage);

  // For subject averages and exam trends, still need raw marks
  const markRows = await ExamMark.findAll({ where: { studentId: studentIds }, raw: true });
  const allMarks = {}; // { studentId: { subject: [m0,m1,m2,m3] } }
  for (const row of markRows) {
    if (!allMarks[row.studentId]) allMarks[row.studentId] = {};
    if (!allMarks[row.studentId][row.subject]) allMarks[row.studentId][row.subject] = [0,0,0,0];
    allMarks[row.studentId][row.subject][row.examIndex] = row.mark;
  }

  // Subject class averages
  const subjectTotals = {}, subjectCounts = {};
  for (const sid of studentIds) {
    for (const subj of SUBJECTS) {
      const arr = allMarks[sid]?.[subj];
      if (!arr) continue;
      const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
      subjectTotals[subj] = (subjectTotals[subj]||0) + avg;
      subjectCounts[subj] = (subjectCounts[subj]||0) + 1;
    }
  }
  const classAverages = SUBJECTS.map(s => ({
    subject: s,
    average: subjectCounts[s] ? Math.round((subjectTotals[s]/subjectCounts[s])*10)/10 : 0
  }));

  // Exam trends
  const examTrends = EXAMS.map((exam, ei) => {
    let total=0, cnt=0;
    for (const sid of studentIds) {
      for (const subj of SUBJECTS) {
        const arr = allMarks[sid]?.[subj];
        if (arr) { total+=arr[ei]; cnt++; }
      }
    }
    return { exam, average: cnt ? Math.round((total/cnt)*10)/10 : 0 };
  });

  // Grade distribution (from ProcessedResult cache)
  const grades = {'A+':0,'A':0,'B':0,'C':0,'D':0,'F':0};
  const studentAverages = profiles.map(p => {
    const proc = procMap[p.studentId] || {};
    if (proc.grade && grades[proc.grade]!==undefined) grades[proc.grade]++;
    return {
      id:         p.studentId,
      name:       p.name,
      overall:    proc.overallAverage || 0,
      grade:      proc.grade || p.grade,
      attendance: attMap[p.studentId] ?? p.attendance
    };
  });

  return { classAverages, studentAverages, gradeDistribution: grades, examTrends, totalStudents: profiles.length, classLabel: cls };
}

// ── Teacher View ──────────────────────────────────────────────────
async function getTeacherSubjectVisualization(subject) {
  const allProfiles = await StudentProfile.find({}).lean();
  const studentIds  = allProfiles.map(p => p.studentId);
  const markRows    = await ExamMark.findAll({ where: { studentId: studentIds, subject }, raw: true });

  // Build per-student marks for this subject
  const subjectMarks = {}; // { studentId: [m0,m1,m2,m3] }
  for (const row of markRows) {
    if (!subjectMarks[row.studentId]) subjectMarks[row.studentId] = [0,0,0,0];
    subjectMarks[row.studentId][row.examIndex] = row.mark;
  }

  // Class averages for this subject
  const classAverages = CLASSES.map(cls => {
    const group = allProfiles.filter(p => p.class === cls);
    let total=0, cnt=0;
    group.forEach(p => {
      const arr = subjectMarks[p.studentId];
      if (arr) { total+=arr.reduce((a,b)=>a+b,0)/arr.length; cnt++; }
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
        group.forEach(p => { const arr=subjectMarks[p.studentId]; if(arr){total+=arr[ei];cnt++;} });
        return cnt ? Math.round((total/cnt)*10)/10 : 0;
      })
    };
  });

  // Grade distribution
  const gradeDistribution = {'A+':0,'A':0,'B':0,'C':0,'D':0,'F':0};
  allProfiles.forEach(p => {
    const arr = subjectMarks[p.studentId];
    if (!arr) return;
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    const g   = calcGrade(avg);
    if (gradeDistribution[g]!==undefined) gradeDistribution[g]++;
  });

  return { subject, classAverages, examTrends, gradeDistribution, exams: EXAMS };
}

module.exports = { getStudentVisualization, getClassVisualization, getTeacherSubjectVisualization };
