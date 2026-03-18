const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  db.close();

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      must_change_password: !!user.must_change_password
    }
  });
});

// Change password
router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  // Superadmin first-login bypass: allow if must_change_password is set
  if (!user.must_change_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password)) {
      db.close();
      return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
    }
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);
  db.close();
  res.json({ success: true });
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

module.exports = router;
