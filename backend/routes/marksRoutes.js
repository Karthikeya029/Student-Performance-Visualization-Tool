const express = require('express');
const router  = express.Router();
const {
  updateMarks, studentViz, classViz, teacherViz,
  getNotifs, readNotif, readAllNotifs
} = require('../controllers/marksController');
const { verifyToken } = require('../modules/authenticationModule');

function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = verifyToken(token); next(); }
  catch { res.status(403).json({ error: 'Invalid token' }); }
}

router.put('/update',                     auth, updateMarks);
router.get('/visualize/student/:id',      auth, studentViz);
router.get('/visualize/class/:cls',       auth, classViz);
router.get('/visualize/teacher/:subject', auth, teacherViz);

// Notification routes (shared by all roles)
router.get('/notifications',              auth, getNotifs);
router.put('/notifications/read-all',     auth, readAllNotifs);
router.put('/notifications/:nid/read',    auth, readNotif);

module.exports = router;
