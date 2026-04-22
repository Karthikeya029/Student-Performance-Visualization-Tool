// MySQL — Subject-wise Attendance
// One row per student per subject — 0 to 100%
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/mysqlConnection');

const SubjectAttendance = sequelize.define('SubjectAttendance', {
  id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  studentId:  { type: DataTypes.STRING(15), allowNull: false },
  subject:    { type: DataTypes.STRING(60), allowNull: false },
  percentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 100 },
  updatedBy:  { type: DataTypes.STRING(80), allowNull: true }
}, {
  tableName:  'subject_attendance',
  timestamps: true,
  indexes:    [{ unique: true, fields: ['studentId', 'subject'] }]
});

module.exports = SubjectAttendance;
