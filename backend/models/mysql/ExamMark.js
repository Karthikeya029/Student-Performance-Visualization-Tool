// MySQL — Exam Marks Database
// One row per student × subject × exam
const { DataTypes } = require('sequelize');
const { sequelize } = require('../../database/mysqlConnection');

const ExamMark = sequelize.define('ExamMark', {
  id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  studentId:  { type: DataTypes.STRING(15), allowNull: false },
  subject:    { type: DataTypes.STRING(60), allowNull: false },
  examName:   { type: DataTypes.STRING(40), allowNull: false },
  examIndex:  { type: DataTypes.TINYINT,    allowNull: false },  // 0-3
  mark:       { type: DataTypes.FLOAT,      allowNull: false, defaultValue: 0 }
}, {
  tableName:  'exam_marks',
  timestamps: true,
  indexes: [{ unique: true, fields: ['studentId','subject','examIndex'] }]
});

module.exports = ExamMark;
