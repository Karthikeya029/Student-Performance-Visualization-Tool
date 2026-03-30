// MySQL — Processed Data Storage (Data Layer 3)
// Cached computed results: overall average, subject averages, grade
// Rebuilt whenever marks change → used by Visualization Module for speed
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/mysqlConnection');

const ProcessedResult = sequelize.define('ProcessedResult', {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  studentId:       { type: DataTypes.STRING(15), allowNull: false, unique: true },
  overallAverage:  { type: DataTypes.FLOAT,      allowNull: false, defaultValue: 0 },
  grade:           { type: DataTypes.STRING(3),  allowNull: false, defaultValue: 'N/A' },
  subjectAverages: { type: DataTypes.TEXT,       allowNull: false, defaultValue: '{}' }, // JSON
  lastComputedAt:  { type: DataTypes.DATE,       defaultValue: DataTypes.NOW }
}, {
  tableName:  'processed_results',
  timestamps: true
});

module.exports = ProcessedResult;
