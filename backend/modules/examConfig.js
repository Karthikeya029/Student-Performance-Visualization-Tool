const EXAMS = ['Minor 1', 'Mid Term', 'Minor 2', 'Final'];
const EXAM_MAX_MARKS = [20, 30, 20, 100];
const EXAM_WEIGHTS = [10, 30, 10, 50];

function getExamMax(examIndex) {
  return EXAM_MAX_MARKS[examIndex] ?? 100;
}

function getExamWeight(examIndex) {
  return EXAM_WEIGHTS[examIndex] ?? 0;
}

function normalizeMark(mark, examIndex) {
  const value = Number(mark) || 0;
  const max = getExamMax(examIndex);
  return max > 0 ? (value / max) * 100 : 0;
}

function weightedContribution(mark, examIndex) {
  return normalizeMark(mark, examIndex) * (getExamWeight(examIndex) / 100);
}

function averageMarks(marks = []) {
  if (!Array.isArray(marks) || !marks.length) return 0;
  const score = marks.reduce((sum, mark, index) => sum + weightedContribution(mark, index), 0);
  return Math.round(score * 10) / 10;
}

module.exports = {
  EXAMS,
  EXAM_MAX_MARKS,
  EXAM_WEIGHTS,
  getExamMax,
  getExamWeight,
  normalizeMark,
  weightedContribution,
  averageMarks
};
