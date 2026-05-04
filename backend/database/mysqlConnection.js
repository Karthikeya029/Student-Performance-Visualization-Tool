//  DATA LAYER 2 — MySQL Connection (Sequelize ORM)
//  Stores: Exam marks, attendance records

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'edutrack_marks',
  process.env.MYSQL_USER     || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host:    process.env.MYSQL_HOST || 'localhost',
    port:    parseInt(process.env.MYSQL_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

async function connectMySQL() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected →', `${process.env.MYSQL_HOST || 'localhost'}/${process.env.MYSQL_DATABASE || 'edutrack_marks'}`);
    // sync: avoid alter in dev to prevent index explosion
    await sequelize.sync();
    console.log('✅ MySQL tables synced');
  } catch (err) {
    console.error('❌ MySQL failed:', err.message);
    console.log('   Fix: start MySQL and run: CREATE DATABASE edutrack_marks;');
    process.exit(1);
  }
}

module.exports = { sequelize, connectMySQL };
