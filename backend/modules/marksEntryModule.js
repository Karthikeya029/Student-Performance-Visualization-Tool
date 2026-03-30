// ─────────────────────────────────────────────────────────────────
//  Marks Entry Module — MySQL Exam Marks Database
//  Validates then writes to MySQL, then triggers ProcessedResult rebuild
// ─────────────────────────────────────────────────────────────────
const { updateSubjectMarks, getStudentById, getAllStudents } = require('./studentDataModule');
const { validateMarksArray, validateSubject } = require('./validationModule');

const SUBJECTS = ['Mathematics','Science','English','History','Computer Science'];
const EXAMS    = ['Unit Test 1','Mid Term','Unit Test 2','Final'];

async function teacherUpdateMarks(studentId, subject, teacherSubject, marksArray) {
  if (subject !== teacherSubject)
    throw new Error(`You can only update marks for: ${teacherSubject}`);
  const sv = validateSubject(subject);
  if (!sv.ok) throw new Error(sv.error);
  const mv = validateMarksArray(marksArray);
  if (!mv.ok) throw new Error(mv.error);
  return updateSubjectMarks(studentId, subject, mv.values);
}

async function coordinatorUpdateMarks(studentId, subject, coordinatorClass, marksArray) {
  const student = await getStudentById(studentId);
  if (student.class !== coordinatorClass)
    throw new Error(`Student ${studentId} is not in your class (${coordinatorClass})`);
  const sv = validateSubject(subject);
  if (!sv.ok) throw new Error(sv.error);
  const mv = validateMarksArray(marksArray);
  if (!mv.ok) throw new Error(mv.error);
  return updateSubjectMarks(studentId, subject, mv.values);
}

async function getSubjectByClass(subject, cls) {
  const students = await getAllStudents(cls);
  return students.map(s => {
    const arr = s.marks[subject] || [0,0,0,0];
    const avg = Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10;
    return { id: s.id, name: s.name, class: s.class, marks: arr, average: avg };
  });
}

module.exports = { teacherUpdateMarks, coordinatorUpdateMarks, getSubjectByClass, SUBJECTS, EXAMS };
