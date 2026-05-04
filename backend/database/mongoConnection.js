//  DATA LAYER 1 — MongoDB Connection
//  Stores: User profiles, login credentials, roles

require('dotenv').config();
const mongoose = require('mongoose');

let connected = false;

async function connectMongo() {
  if (connected) return;
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/edutrack_users';
  try {
    await mongoose.connect(uri);
    connected = true;
    console.log('✅ MongoDB connected →', uri);
  } catch (err) {
    console.error('❌ MongoDB failed:', err.message);
    console.log('   Fix: make sure MongoDB is running (mongod)');
    process.exit(1);
  }
}

module.exports = { connectMongo, mongoose };
