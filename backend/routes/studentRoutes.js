const express = require('express');
const router  = express.Router();
const { getAll, getOne, create, update, remove, summary, subjectSummary } = require('../controllers/studentController');
const { verifyToken } = require('../modules/authenticationModule');

function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = verifyToken(token); next(); }
  catch { res.status(403).json({ error: 'Invalid token' }); }
}
function coordOnly(req, res, next) {
  if (req.user.role !== 'coordinator') return res.status(403).json({ error: 'Coordinator only' });
  next();
}
function coordOrTeacher(req, res, next) {
  if (!['coordinator','teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
  next();
}

// Coordinator sees only their class automatically
router.get('/', auth, (req, res, next) => {
  if (req.user.role === 'coordinator') req.query.cls = req.user.class;
  next();
}, getAll);

router.get('/summary',           auth, coordOrTeacher, summary);
router.get('/subject/:subject',  auth, coordOrTeacher, subjectSummary);
router.get('/:id',               auth, getOne);
router.post('/',                 auth, coordOnly, create);
router.put('/:id',               auth, coordOnly, update);
router.delete('/:id',            auth, coordOnly, remove);

module.exports = router;
