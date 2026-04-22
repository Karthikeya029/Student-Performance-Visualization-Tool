const { teacherUpdateMarks, coordinatorUpdateMarks } = require('../modules/marksEntryModule');
const { getStudentVisualization, getClassVisualization, getTeacherSubjectVisualization } = require('../modules/visualizationModule');
const { getStudentById } = require('../modules/studentDataModule');
const notif = require('../modules/notificationModule');

async function updateMarks(req, res) {
  try {
    const { studentId, subject, marks } = req.body;
    const user = req.user;
    const io   = req.app.get('io');
    let result;

    if (user.role === 'teacher') {
      result = await teacherUpdateMarks(studentId, subject, user.subject, marks);
    } else if (user.role === 'coordinator') {
      result = await coordinatorUpdateMarks(studentId, subject, user.class, marks);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const student      = await getStudentById(studentId);
    const avg          = marks.length ? Math.round((marks.reduce((a,b)=>a+b,0)/marks.length)*10)/10 : 0;
    const timestamp    = new Date().toISOString();
    const updaterLabel = user.role === 'teacher' ? `Teacher (${user.name})` : `Coordinator (${user.name})`;

    const livePayload = {
      studentId, studentName: student.name,
      subject, marks, avg,
      updatedBy: user.name, updaterRole: user.role,
      class: student.class, timestamp
    };

    // 1. Notify the STUDENT directly (personal room)
    notif.notifyStudent(io, studentId, {
      type:    'marks_updated',
      icon:    '📝',
      title:   `${subject} marks updated`,
      message: `Your ${subject} marks were updated by ${updaterLabel}. New average: ${avg}%`,
      ...livePayload
    });

    // 2. Live refresh trigger for student (chart auto-reload)
    io.to('student:' + studentId).emit('marks_updated', livePayload);

    // 3. Live refresh trigger for coordinator dashboard
    notif.emitLiveRefresh(io, student.class, 'class_marks_updated', livePayload);

    // 4. Notify coordinator (coordinator-only room, NOT students)
    notif.notifyCoordinator(io, student.class, {
      type:    'marks_updated',
      icon:    '📝',
      title:   `Marks updated — ${student.name}`,
      message: `${subject} updated by ${updaterLabel}. Avg: ${avg}%`,
      ...livePayload
    });

    // 5. Notify teacher (both when teacher or coordinator updates)
    io.to('teacher:' + subject).emit('subject_marks_updated', livePayload);
    notif.notifyTeacher(io, subject, {
      type:    'marks_updated',
      icon:    '📝',
      title:   `Marks updated — ${student.name} (${student.class})`,
      message: `${subject} updated by ${updaterLabel}. Avg: ${avg}%`,
      ...livePayload
    });

    // 6. Performance alert if avg < 60
    if (avg < 60) {
      notif.notifyStudent(io, studentId, {
        type:    'performance_alert',
        icon:    '⚠️',
        title:   `Low score alert: ${subject}`,
        message: `Your ${subject} average is ${avg}% — below the 60% passing threshold. Please speak to your teacher for guidance.`,
        ...livePayload
      });
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
}

async function studentViz(req, res) {
  try { res.json(await getStudentVisualization(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
}

async function classViz(req, res) {
  try { res.json(await getClassVisualization(req.params.cls)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

async function teacherViz(req, res) {
  try { res.json(await getTeacherSubjectVisualization(req.params.subject)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

function getNotifs(req, res) {
  const u  = req.user;
  const id = u.role === 'student' ? u.studentId : u.role === 'coordinator' ? u.class : u.subject;
  res.json(notif.getNotifications(u.role, id));
}

function readNotif(req, res) {
  const u  = req.user;
  const id = u.role === 'student' ? u.studentId : u.role === 'coordinator' ? u.class : u.subject;
  notif.markRead(u.role, id, req.params.nid);
  res.json({ ok: true });
}

function readAllNotifs(req, res) {
  const u  = req.user;
  const id = u.role === 'student' ? u.studentId : u.role === 'coordinator' ? u.class : u.subject;
  notif.markAllRead(u.role, id);
  res.json({ ok: true });
}

module.exports = { updateMarks, studentViz, classViz, teacherViz, getNotifs, readNotif, readAllNotifs };
