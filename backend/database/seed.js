// ─────────────────────────────────────────────────────────────────
//  SEED SCRIPT — Run once: npm run seed
//  Reads existing users.json + students.json and populates:
//    MongoDB  → users + student profiles
//    MySQL    → exam marks + attendance + processed results
// ─────────────────────────────────────────────────────────────────
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { connectMongo }  = require('./mongoConnection');
const { connectMySQL }  = require('./mysqlConnection');
const User              = require('../models/mongo/User');
const StudentProfile    = require('../models/mongo/StudentProfile');
const { ExamMark, Attendance, ProcessedResult } = require('../models/mysql');

const USERS_FILE    = path.join(__dirname, '../../database/users.json');
const STUDENTS_FILE = path.join(__dirname, '../../database/students.json');
const EXAMS         = ['Unit Test 1','Mid Term','Unit Test 2','Final'];

function calcGrade(avg) {
  if (avg>=90) return 'A+'; if (avg>=80) return 'A'; if (avg>=70) return 'B';
  if (avg>=60) return 'C';  if (avg>=50) return 'D'; return 'F';
}

async function seed() {
  console.log('\n🌱 Starting seed...\n');
  await connectMongo();
  await connectMySQL();

  const rawUsers    = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const rawStudents = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf8'));

  // ── 1. MongoDB: Users ─────────────────────────────────────────
  await User.deleteMany({});
  const userDocs = rawUsers.map(u => ({
    username:  u.username,
    password:  u.password,       // already bcrypt-hashed in JSON
    role:      u.role,
    name:      u.name,
    class:     u.class   || null,
    subject:   u.subject || null,
    studentId: u.studentId || null,
    email:     u.email   || (u.studentId ? `${u.username}@cs.edu` : null)
  }));
  await User.insertMany(userDocs);
  console.log(`✅ MongoDB Users: ${userDocs.length} inserted`);

  // ── 2. MongoDB: Student Profiles ─────────────────────────────
  await StudentProfile.deleteMany({});
  const profileDocs = rawStudents.map(s => ({
    studentId:  s.id,
    name:       s.name,
    class:      s.class,
    email:      s.email || `${s.id.toLowerCase()}@cs.edu`,
    attendance: s.attendance || 100,
    grade:      s.grade || 'N/A'
  }));
  await StudentProfile.insertMany(profileDocs);
  console.log(`✅ MongoDB Student Profiles: ${profileDocs.length} inserted`);

  // ── 3. MySQL: Exam Marks ──────────────────────────────────────
  await ExamMark.destroy({ where: {} });
  const markRows = [];
  for (const s of rawStudents) {
    for (const [subject, marksArr] of Object.entries(s.marks || {})) {
      marksArr.forEach((mark, idx) => {
        markRows.push({ studentId: s.id, subject, examName: EXAMS[idx], examIndex: idx, mark });
      });
    }
  }
  // Bulk insert in chunks of 500
  for (let i = 0; i < markRows.length; i += 500) {
    await ExamMark.bulkCreate(markRows.slice(i, i+500), { ignoreDuplicates: true });
  }
  console.log(`✅ MySQL Exam Marks: ${markRows.length} rows inserted`);

  // ── 4. MySQL: Attendance ──────────────────────────────────────
  await Attendance.destroy({ where: {} });
  const attRows = rawStudents.map(s => ({
    studentId:  s.id,
    percentage: s.attendance || 100,
    updatedBy:  'seed'
  }));
  await Attendance.bulkCreate(attRows, { ignoreDuplicates: true });
  console.log(`✅ MySQL Attendance: ${attRows.length} rows inserted`);

  // ── 5. MySQL: Processed Results ───────────────────────────────
  await ProcessedResult.destroy({ where: {} });
  const processedRows = rawStudents.map(s => {
    const subjectAverages = {};
    let total = 0, count = 0;
    for (const [subj, arr] of Object.entries(s.marks || {})) {
      const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
      subjectAverages[subj] = Math.round(avg * 10) / 10;
      total += avg; count++;
    }
    const overallAverage = count ? Math.round((total/count)*10)/10 : 0;
    return {
      studentId: s.id,
      overallAverage,
      grade:    calcGrade(overallAverage),
      subjectAverages: JSON.stringify(subjectAverages),
      lastComputedAt: new Date()
    };
  });
  await ProcessedResult.bulkCreate(processedRows, { ignoreDuplicates: true });
  console.log(`✅ MySQL Processed Results: ${processedRows.length} rows inserted`);

  console.log('\n🎉 Seed complete! All 3 databases populated.\n');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
