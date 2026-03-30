// ─────────────────────────────────────────────────────────────────
//  Notification Module
//  Rooms:
//    student     → 'student:<studentId>'   (personal only)
//    coordinator → 'coord:<class>'         (coordinator only)
//    teacher     → 'teacher:<subject>'     (teacher only)
//    live data   → 'live:class:<cls>'      (chart refresh, no notifs)
// ─────────────────────────────────────────────────────────────────

const store = {};   // in-memory per-session store

function push(key, n) {
  if (!store[key]) store[key] = [];
  store[key].unshift({ ...n, id: Date.now() + '_' + Math.random(), read: false, timestamp: n.timestamp || new Date().toISOString() });
  if (store[key].length > 200) store[key].pop();
}

function getNotifications(role, id) {
  return store[`${role}:${id}`] || [];
}

function markRead(role, id, notifId) {
  const list = store[`${role}:${id}`] || [];
  const n = list.find(x => String(x.id) === String(notifId));
  if (n) n.read = true;
}

function markAllRead(role, id) {
  (store[`${role}:${id}`] || []).forEach(n => n.read = true);
}

function unreadCount(role, id) {
  return (store[`${role}:${id}`] || []).filter(n => !n.read).length;
}

// ── Notify student (personal room only) ──────────────────────────
function notifyStudent(io, studentId, notif) {
  const key  = `student:${studentId}`;
  push(key, notif);
  const unread = unreadCount('student', studentId);
  io.to('student:' + studentId).emit('notification', {
    ...notif,
    unread,
    timestamp: notif.timestamp || new Date().toISOString()
  });
}

// ── Notify coordinator (coord room only, students never join this) 
function notifyCoordinator(io, cls, notif) {
  const key = `coordinator:${cls}`;
  push(key, notif);
  io.to('coord:' + cls).emit('notification', {
    ...notif,
    unread: unreadCount('coordinator', cls),
    timestamp: notif.timestamp || new Date().toISOString()
  });
}

// ── Notify teacher ────────────────────────────────────────────────
function notifyTeacher(io, subject, notif) {
  const key = `teacher:${subject}`;
  push(key, notif);
  io.to('teacher:' + subject).emit('notification', {
    ...notif,
    unread: unreadCount('teacher', subject),
    timestamp: notif.timestamp || new Date().toISOString()
  });
}

// ── Live data refresh (no notification, just triggers chart reload) 
function emitLiveRefresh(io, cls, event, payload) {
  io.to('live:class:' + cls).emit(event, payload);
}

module.exports = {
  getNotifications, markRead, markAllRead, unreadCount,
  notifyStudent, notifyCoordinator, notifyTeacher, emitLiveRefresh
};
