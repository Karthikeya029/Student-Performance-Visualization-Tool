// ─────────────────────────────────────────────────────────────────
//  Validation Module — centralised input rules
//  Used by controllers to reject bad data before touching the DB
// ─────────────────────────────────────────────────────────────────

const { EXAMS, EXAM_MAX_MARKS, getExamMax } = require('./examConfig');

/**
 * Validate a single mark value.
 * Returns { ok, value, error }
 */
function validateMark(raw, examIndex = null) {
  const v = Number(raw);
  const max = examIndex === null ? 100 : getExamMax(examIndex);
  const examLabel = examIndex === null ? 'Mark' : EXAMS[examIndex];
  if (raw === '' || raw === null || raw === undefined) return { ok: false, error: 'Mark cannot be empty' };
  if (!Number.isFinite(v))  return { ok: false, error: `Invalid mark value: "${raw}"` };
  if (!Number.isInteger(v)) return { ok: false, error: `Mark must be a whole number, got: ${v}` };
  if (v < 0)   return { ok: false, error: `${examLabel} cannot be negative (got ${v}). Must be 0–${max}.` };
  if (v > max) return { ok: false, error: `${examLabel} cannot exceed ${max} (got ${v}). Must be 0–${max}.` };
  return { ok: true, value: v };
}

/**
 * Validate an array of 4 marks (one per exam).
 * Returns { ok, values, error }
 */
function validateMarksArray(arr) {
  if (!Array.isArray(arr)) return { ok: false, error: 'Marks must be an array' };
  if (arr.length !== 4)    return { ok: false, error: `Expected 4 marks (Minor 1, Mid Term, Minor 2, Final), got ${arr.length}` };
  const values = [];
  for (let i = 0; i < arr.length; i++) {
    const result = validateMark(arr[i], i);
    if (!result.ok) return { ok: false, error: `Exam ${i + 1}: ${result.error}` };
    values.push(result.value);
  }
  return { ok: true, values };
}

/**
 * Validate attendance percentage.
 * Returns { ok, value, error }
 */
function validateAttendance(raw) {
  if (raw === '' || raw === null || raw === undefined) return { ok: false, error: 'Attendance cannot be empty' };
  const v = Number(raw);
  if (!Number.isFinite(v))  return { ok: false, error: `Invalid attendance value: "${raw}"` };
  if (v < 0)   return { ok: false, error: `Attendance cannot be negative (got ${v}). Must be 0–100.` };
  if (v > 100) return { ok: false, error: `Attendance cannot exceed 100% (got ${v}). Must be 0–100.` };
  return { ok: true, value: Math.round(v) };
}

/**
 * Validate a student ID string.
 */
function validateStudentId(id) {
  if (!id || typeof id !== 'string' || !id.trim())
    return { ok: false, error: 'Student ID is required' };
  if (!/^[A-Za-z0-9]+$/.test(id.trim()))
    return { ok: false, error: 'Student ID must contain only letters and numbers' };
  return { ok: true, value: id.trim().toUpperCase() };
}

/**
 * Validate subject name.
 */
const VALID_SUBJECTS = ['Mathematics', 'Physics', 'English', 'French', 'DSA']; 
function validateSubject(subject) {
  if (!subject) return { ok: false, error: 'Subject is required' };
  if (!VALID_SUBJECTS.includes(subject))
    return { ok: false, error: `Invalid subject "${subject}". Must be one of: ${VALID_SUBJECTS.join(', ')}` };
  return { ok: true, value: subject };
}

module.exports = {
  validateMark,
  validateMarksArray,
  validateAttendance,
  validateStudentId,
  validateSubject,
  VALID_SUBJECTS,
  EXAMS,
  EXAM_MAX_MARKS
};
