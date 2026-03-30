require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');

const { connectMongo } = require('./database/mongoConnection');
const { connectMySQL } = require('./database/mysqlConnection');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const authRoutes    = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const marksRoutes   = require('./routes/marksRoutes');

app.use('/api/auth',     authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/marks',    marksRoutes);

app.get('/',            (_, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));
app.get('/coordinator', (_, res) => res.sendFile(path.join(__dirname, '../frontend/coordinator-dashboard.html')));
app.get('/teacher',     (_, res) => res.sendFile(path.join(__dirname, '../frontend/teacher-dashboard.html')));
app.get('/student',     (_, res) => res.sendFile(path.join(__dirname, '../frontend/student-dashboard.html')));

io.on('connection', (socket) => {
  socket.on('register', ({ role, studentId, userClass, subject }) => {

    if (role === 'student' && studentId) {
      // Student joins ONLY their personal room
      // NOT the class room — prevents leaking coordinator notifications
      socket.join('student:' + studentId);
      // Join a separate live-data room for chart refresh events (no notifications)
      socket.join('live:class:' + userClass);
    }

    if (role === 'coordinator' && userClass) {
      // Coordinator gets their own room — separate from students
      socket.join('coord:' + userClass);
      // Also join live-data room to receive refresh triggers
      socket.join('live:class:' + userClass);
    }

    if (role === 'teacher' && subject) {
      socket.join('teacher:' + subject);
      ['CS1','CS2','CS3','CS4'].forEach(c => socket.join('live:class:' + c));
    }
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectMongo();
    await connectMySQL();
    server.listen(PORT, () => {
      console.log(`\n🎓  EduTrack v5  →  http://localhost:${PORT}`);
      console.log(`   MongoDB : ${process.env.MONGO_URI  || 'mongodb://localhost:27017/edutrack_users'}`);
      console.log(`   MySQL   : ${process.env.MYSQL_HOST || 'localhost'}/${process.env.MYSQL_DATABASE || 'edutrack_marks'}`);
      console.log(`\n   Run seed first time: npm run seed\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
