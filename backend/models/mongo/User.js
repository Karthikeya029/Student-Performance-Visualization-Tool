// MongoDB — User Database
// Stores login credentials and profile for all 3 roles
const { mongoose } = require('../../database/mongoConnection');

const userSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true },
  role:      { type: String, enum: ['coordinator','teacher','student'], required: true },
  name:      { type: String, required: true },
  class:     { type: String, default: null },    // coordinator & student
  subject:   { type: String, default: null },    // teacher only
  studentId: { type: String, default: null },    // student only
  email:     { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
