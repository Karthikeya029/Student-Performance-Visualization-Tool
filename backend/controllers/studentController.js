const {
  getAllStudents, getStudentById, addStudent,
  updateAttendance, updateSubjectAttendance, deleteStudent, getClassSummary
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
    await createStudentUser({ studentId: id, name, className: cls,
      email: email || `${id.toLowerCase()}@cs.edu`, password: 'password' });
    const io = req.app.get('io'), ts = new Date().toISOString();
    notif.emitLiveRefresh(io, cls, 'student_added', { student, addedBy: req.user.name, timestamp: ts });
    notif.notifyCoordinator(io, cls, { type:'student_added', icon:'➕',
      title:`New student: ${name}`,
      message:`${name} (${id}) added to class ${cls}. Login: ${id.toLowerCase()} / password`, timestamp: ts });
    notif.notifyStudent(io, id, { type:'welcome', icon:'👋', title:'Welcome to EduTrack!',
      message:`Hello ${name}! Your account is ready for class ${cls}. Username: ${id.toLowerCase()}, Password: password`,
      timestamp: ts });
    res.status(201).json({ ...student, loginCreated: true, loginUsername: id.toLowerCase(), loginPassword: 'password' });
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function update(req, res) {
  try {
    const { attendance, subject, subjectAttendance } = req.body;
    const isTeacher = req.user.role === 'teacher';

    // ── Update subject-specific attendance ────────────────────────
    if (subject !== undefined && subjectAttendance !== undefined) {
      if (isTeacher && subject !== req.user.subject) {
        return res.status(403).json({ error: `You can only update ${req.user.subject} attendance` });
      }
      const chk = validateAttendance(subjectAttendance);
      if (!chk.ok) return res.status(400).json({ error: chk.error });
      const sid     = req.params.id;
      const student = await getStudentById(sid);
      await updateSubjectAttendance(sid, subject, chk.value, req.user.name);
      const io = req.app.get('io'), ts = new Date().toISOString();
      const payload = { studentId: sid, studentName: student.name, subject,
                        attendance: chk.value, updatedBy: req.user.name, class: student.class, timestamp: ts };
      io.to('student:' + sid).emit('subject_attendance_updated', payload);
      notif.emitLiveRefresh(io, student.class, 'class_attendance_updated', payload);
      notif.notifyStudent(io, sid, { type:'attendance_updated', icon:'📅',
        title:`${subject} Attendance Updated`,
        message:`Your ${subject} attendance is now ${chk.value}% — updated by ${req.user.name}.`,
        ...payload });
      if (chk.value < 75) {
        notif.notifyStudent(io, sid, { type:'attendance_alert', icon:'🚨',
          title:`⚠️ Low ${subject} Attendance`,
          message:`Your ${subject} attendance is ${chk.value}% — below the 75% minimum.`, ...payload });
      }
      notif.notifyCoordinator(io, student.class, { type:'attendance_updated', icon:'📅',
        title:`${subject} attendance — ${student.name}`,
        message:`${student.name}'s ${subject} attendance set to ${chk.value}% by ${req.user.name}.`, ...payload });
      notif.notifyTeacher(io, subject, { type:'attendance_updated', icon:'📅',
        title:`${subject} attendance — ${student.name} (${student.class})`,
        message:`${student.name}'s ${subject} attendance set to ${chk.value}% by ${req.user.name}.`, ...payload });
      return res.json(await getStudentById(sid));
    }

    // ── Update overall attendance ─────────────────────────────────
    if (isTeacher) return res.status(403).json({ error: 'Teachers can only update subject attendance' });
    if (attendance === undefined) return res.status(400).json({ error: 'Nothing to update' });
    const chk = validateAttendance(attendance);
    if (!chk.ok) return res.status(400).json({ error: chk.error });
    const att     = chk.value, sid = req.params.id;
    await updateAttendance(sid, att, req.user.name);
    const student = await getStudentById(sid);
    const io = req.app.get('io'), ts = new Date().toISOString();
    const payload = { studentId: sid, studentName: student.name, attendance: att,
                      updatedBy: req.user.name, class: student.class, timestamp: ts };
    io.to('student:' + sid).emit('attendance_updated', payload);
    notif.emitLiveRefresh(io, student.class, 'class_attendance_updated', payload);
    const attStatus = att >= 75 ? 'You are in good standing ✅' : '⚠️ Below the 75% required minimum';
    notif.notifyStudent(io, sid, { type:'attendance_updated', icon:'📅', title:'Attendance Updated',
      message:`Your attendance is now ${att}% — ${attStatus}`, ...payload });
    if (att < 75) {
      notif.notifyStudent(io, sid, { type:'attendance_alert', icon:'🚨', title:'⚠️ Low Attendance Warning',
        message:`Your attendance is ${att}% — below the 75% minimum. Please contact your coordinator.`, ...payload });
    }
    notif.notifyCoordinator(io, student.class, { type:'attendance_updated', icon:'📅',
      title:`Attendance — ${student.name}`, message:`${student.name} attendance set to ${att}% by ${req.user.name}.${att<75?' ⚠️ Below 75%!':''}`,
      ...payload });
    res.json(student);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    const student = await getStudentById(req.params.id);
    await deleteStudent(req.params.id);
    await deleteStudentUser(req.params.id);
    const io = req.app.get('io'), ts = new Date().toISOString();
    notif.emitLiveRefresh(io, student.class, 'student_removed',
      { studentId: req.params.id, studentName: student.name, removedBy: req.user.name, class: student.class, timestamp: ts });
    notif.notifyCoordinator(io, student.class, { type:'student_removed', icon:'🗑️',
      title:`Student removed: ${student.name}`,
      message:`${student.name} (${req.params.id}) removed from all databases.`, timestamp: ts });
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
