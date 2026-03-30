const { loginUser } = require('../modules/authenticationModule');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = await loginUser(username, password);
    res.json(result);
  } catch (e) { res.status(401).json({ error: e.message }); }
}

module.exports = { login };
