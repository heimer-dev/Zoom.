const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET || 'zoom-newspaper-secret-2024-burgaugymnasium';

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht authentifiziert' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, username, display_name, role, must_change_password FROM users WHERE id = ?').get(payload.id);
    db.close();
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiges Token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht authentifiziert' });
    const hierarchy = { superadmin: 4, admin: 3, editor: 2, contributor: 1 };
    const userLevel = hierarchy[req.user.role] || 0;
    const required = Math.max(...roles.map(r => hierarchy[r] || 0));
    if (userLevel < required) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
