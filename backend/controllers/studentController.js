const {
  getAllStudents, getStudentById, addStudent,
  updateAttendance, deleteStudent, getClassSummary
} = require('../modules/studentDataModule');
const { createStudentUser, deleteStudentUser } = require('../modules/authenticationModule');
const notif = require('../modules/notificationModule');
const { validateAttendance } = require('../modules/validationModule');

async function getAll(req, res) {
  try { res.json(await getAllStudents(req.query.cls || undefined)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function getOne(req, res) {
  try { res.json(await getStudentById(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
}

async function create(req, res) {
  try {
    const { id, name, class: cls, email, attendance } = req.body;
    if (attendance !== undefined) {
      const chk = validateAttendance(attendance);
      if (!chk.ok) return res.status(400).json({ error: chk.error });
      req.body.attendance = chk.value;
    }

    const student = await addStudent(req.body);

    // Auto-create login credentials in MongoDB
    await createStudentUser({
      studentId: id, name, className: cls,
      email: email || `${id.toLowerCase()}@cs.edu`,
      password: 'password'
    });

    const io = req.app.get('io');
    const ts = new Date().toISOString();

    // Live refresh for coordinator
    notif.emitLiveRefresh(io, cls, 'student_added', {
      student, addedBy: req.user.name, timestamp: ts
    });

    // Coordinator notification
    notif.notifyCoordinator(io, cls, {
      type: 'student_added', icon: '➕',
      title: `New student: ${name}`,
      message: `${name} (${id}) added to class ${cls}. Login: ${id.toLowerCase()} / password`,
      timestamp: ts
    });

    // Welcome notification for the new student (stored, shown on first login)
    notif.notifyStudent(io, id, {
      type: 'welcome', icon: '👋',
      title: 'Welcome to EduTrack!',
      message: `Hello ${name}! Your account has been created for class ${cls}. Username: ${id.toLowerCase()}, Password: password. Your marks will appear here as your teachers update them.`,
      timestamp: ts
    });

    res.status(201).json({
      ...student,
      loginCreated:   true,
      loginUsername:  id.toLowerCase(),
      loginPassword:  'password'
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    if (req.body.attendance === undefined)
      return res.status(400).json({ error: 'Nothing to update' });

    const chk = validateAttendance(req.body.attendance);
    if (!chk.ok) return res.status(400).json({ error: chk.error });

    const att     = chk.value;
    const sid     = req.params.id;
    await updateAttendance(sid, att, req.user.name);
    const student = await getStudentById(sid);
    const io      = req.app.get('io');
    const ts      = new Date().toISOString();

    const payload = {
      studentId:   sid,
      studentName: student.name,
      attendance:  att,
      updatedBy:   req.user.name,
      class:       student.class,
      timestamp:   ts
    };

    // Live refresh trigger for student's own chart
    io.to('student:' + sid).emit('attendance_updated', payload);

    // Live refresh for coordinator
    notif.emitLiveRefresh(io, student.class, 'class_attendance_updated', payload);

    // Notification directly to the student (personal room only)
    const attStatus = att >= 75 ? 'You are in good standing ✅' : '⚠️ Below the 75% required minimum';
    notif.notifyStudent(io, sid, {
      type:    'attendance_updated',
      icon:    '📅',
      title:   'Attendance Updated',
      message: `Your attendance has been updated to ${att}% by ${req.user.name}. ${attStatus}`,
      ...payload
    });

    // Low attendance alert to student
    if (att < 75) {
      notif.notifyStudent(io, sid, {
        type:    'attendance_alert',
        icon:    '🚨',
        title:   '⚠️ Low Attendance Warning',
        message: `Your attendance is ${att}% — below the 75% minimum requirement. Please contact your coordinator immediately.`,
        ...payload
      });
    }

    // Coordinator notification (coordinator-only room)
    notif.notifyCoordinator(io, student.class, {
      type:    'attendance_updated',
      icon:    '📅',
      title:   `Attendance updated — ${student.name}`,
      message: `${student.name}'s attendance set to ${att}% by ${req.user.name}.${att < 75 ? ' ⚠️ Below 75%!' : ''}`,
      ...payload
    });

    res.json(student);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const student = await getStudentById(req.params.id);
    await deleteStudent(req.params.id);
    await deleteStudentUser(req.params.id);

    const io = req.app.get('io');
    const ts = new Date().toISOString();

    notif.emitLiveRefresh(io, student.class, 'student_removed', {
      studentId: req.params.id, studentName: student.name,
      removedBy: req.user.name, class: student.class, timestamp: ts
    });
    notif.notifyCoordinator(io, student.class, {
      type: 'student_removed', icon: '🗑️',
      title: `Student removed: ${student.name}`,
      message: `${student.name} (${req.params.id}) removed from all databases by ${req.user.name}.`,
      timestamp: ts
    });

    res.json({ message: 'Student and login credentials deleted from all databases' });
  } catch (e) { res.status(404).json({ error: e.message }); }
}

async function summary(req, res) {
  try { res.json(await getClassSummary(req.query.cls || undefined)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function subjectSummary(req, res) {
  try {
    const { getSubjectByClass } = require('../modules/marksEntryModule');
    res.json(await getSubjectByClass(req.params.subject, req.query.cls || undefined));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { getAll, getOne, create, update, remove, summary, subjectSummary };
