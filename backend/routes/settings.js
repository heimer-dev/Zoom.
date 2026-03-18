const express = require('express');
const { getDb } = require('../database/init');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  db.close();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  Object.entries(req.body).forEach(([key, value]) => upsert.run(key, value));
  db.close();
  res.json({ success: true });
});

module.exports = router;
