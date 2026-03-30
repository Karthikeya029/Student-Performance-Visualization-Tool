// MongoDB — Student Profile
// Stores flexible student metadata (attendance, grade, class)
const { mongoose } = require('../../database/mongoConnection');

const studentProfileSchema = new mongoose.Schema({
  studentId:  { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  class:      { type: String, required: true },
  email:      { type: String, default: null },
  attendance: { type: Number, default: 100 },
  grade:      { type: String, default: 'N/A' },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

studentProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date(); next();
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
