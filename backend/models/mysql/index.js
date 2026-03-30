// Export all MySQL models together
const ExamMark       = require('./ExamMark');
const Attendance     = require('./Attendance');
const ProcessedResult = require('./ProcessedResult');
module.exports = { ExamMark, Attendance, ProcessedResult };
