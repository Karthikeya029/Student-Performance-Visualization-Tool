// MySQL — Attendance Records
// One row per student, updated when coordinator changes attendance
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/mysqlConnection');

const Attendance = sequelize.define('Attendance', {
  id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  studentId:  { type: DataTypes.STRING(15), allowNull: false, unique: true },
  percentage: { type: DataTypes.FLOAT,      allowNull: false, defaultValue: 100 },
  updatedBy:  { type: DataTypes.STRING(80), allowNull: true }
}, {
  tableName:  'attendance',
  timestamps: true
});

module.exports = Attendance;
