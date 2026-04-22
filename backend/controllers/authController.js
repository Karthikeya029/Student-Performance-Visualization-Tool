const { loginUser, verifyToken } = require('../modules/authenticationModule');
const bcrypt = require('bcryptjs');
const User   = require('../models/mongo/User');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = await loginUser(username, password);
    res.json(result);
  } catch (e) { res.status(401).json({ error: e.message }); }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
    if (!newPassword)      return res.status(400).json({ error: 'New password is required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different from current password' });

    // Find user in MongoDB
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    // Hash and save new password
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { login, changePassword };
