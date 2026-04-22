const express = require('express');
const router  = express.Router();
const { login, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../modules/authenticationModule');

function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = verifyToken(token); next(); }
  catch { res.status(403).json({ error: 'Invalid token' }); }
}

router.post('/login',           login);
router.put('/change-password',  auth, changePassword);

module.exports = router;
