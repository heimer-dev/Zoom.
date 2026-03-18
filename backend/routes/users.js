const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/init');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const ROLES = ['contributor', 'editor', 'admin', 'superadmin'];

// List users (admin+)
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, username, display_name, email, role, must_change_password, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  db.close();
  res.json(users);
});

// Create user (admin+)
router.post('/', authenticate, requireRole('admin'), (req, res) => {
  const { username, password, display_name, email, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });

  // Admins can only create up to their own role
  const hierarchy = { superadmin: 4, admin: 3, editor: 2, contributor: 1 };
  if ((hierarchy[role] || 0) > (hierarchy[req.user.role] || 0)) {
    return res.status(403).json({ error: 'Kann keine Benutzer mit höherer Rolle erstellen' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) { db.close(); return res.status(409).json({ error: 'Benutzername bereits vergeben' }); }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password, display_name, email, role, must_change_password, created_by)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(username, hash, display_name || username, email || null, role || 'contributor', req.user.id);
  db.close();
  res.status(201).json({ id: result.lastInsertRowid, username, display_name: display_name || username, role: role || 'contributor' });
});

// Update user (admin+)
router.put('/:id', authenticate, requireRole('admin'), (req, res) => {
  const { display_name, email, role, password } = req.body;
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) { db.close(); return res.status(404).json({ error: 'Benutzer nicht gefunden' }); }

  const hierarchy = { superadmin: 4, admin: 3, editor: 2, contributor: 1 };
  if ((hierarchy[target.role] || 0) > (hierarchy[req.user.role] || 0)) {
    db.close();
    return res.status(403).json({ error: 'Kann diesen Benutzer nicht bearbeiten' });
  }

  const updates = [];
  const params = [];
  if (display_name) { updates.push('display_name = ?'); params.push(display_name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (role && (hierarchy[role] || 0) <= (hierarchy[req.user.role] || 0)) {
    updates.push('role = ?'); params.push(role);
  }
  if (password && password.length >= 6) {
    updates.push('password = ?'); params.push(bcrypt.hashSync(password, 10));
    updates.push('must_change_password = 1');
  }
  if (updates.length > 0) {
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  }
  db.close();
  res.json({ success: true });
});

// Delete user (superadmin only)
router.delete('/:id', authenticate, requireRole('superadmin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Kann eigenen Account nicht löschen' });
  }
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ success: true });
});

module.exports = router;
