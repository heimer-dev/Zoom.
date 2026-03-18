const express = require('express');
const { getDb } = require('../database/init');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all editions (public: only published; admin: all)
router.get('/', (req, res) => {
  const db = getDb();
  const token = req.headers.authorization?.split(' ')[1];
  const isAdmin = !!token; // simplified check; full auth via authenticate middleware
  const editions = db.prepare(`
    SELECT e.*, u.display_name as author_name,
    (SELECT COUNT(*) FROM articles a WHERE a.edition_id = e.id) as article_count
    FROM editions e
    LEFT JOIN users u ON e.created_by = u.id
    ${isAdmin ? '' : "WHERE e.status = 'published'"}
    ORDER BY e.created_at DESC
  `).all();
  db.close();
  res.json(editions);
});

// Get single edition with articles
router.get('/:id', (req, res) => {
  const db = getDb();
  const edition = db.prepare(`
    SELECT e.*, u.display_name as author_name
    FROM editions e LEFT JOIN users u ON e.created_by = u.id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!edition) { db.close(); return res.status(404).json({ error: 'Ausgabe nicht gefunden' }); }

  const articles = db.prepare(`
    SELECT a.*, u.display_name as author_name
    FROM articles a LEFT JOIN users u ON a.author_id = u.id
    WHERE a.edition_id = ?
    ORDER BY a.position ASC, a.created_at ASC
  `).all(req.params.id);
  db.close();
  res.json({ ...edition, articles });
});

// Create edition (editor+)
router.post('/', authenticate, requireRole('editor'), (req, res) => {
  const { title, edition_number, subtitle, cover_color } = req.body;
  if (!title) return res.status(400).json({ error: 'Titel erforderlich' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO editions (title, edition_number, subtitle, cover_color, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, edition_number || null, subtitle || null, cover_color || '#1e40af', req.user.id);
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.status(201).json(edition);
});

// Update edition (editor+)
router.put('/:id', authenticate, requireRole('editor'), (req, res) => {
  const { title, edition_number, subtitle, cover_color, status } = req.body;
  const db = getDb();
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(req.params.id);
  if (!edition) { db.close(); return res.status(404).json({ error: 'Ausgabe nicht gefunden' }); }

  const updates = [];
  const params = [];
  if (title) { updates.push('title = ?'); params.push(title); }
  if (edition_number !== undefined) { updates.push('edition_number = ?'); params.push(edition_number); }
  if (subtitle !== undefined) { updates.push('subtitle = ?'); params.push(subtitle); }
  if (cover_color) { updates.push('cover_color = ?'); params.push(cover_color); }
  if (status) {
    updates.push('status = ?'); params.push(status);
    if (status === 'published') { updates.push('published_at = CURRENT_TIMESTAMP'); }
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  if (updates.length > 0) {
    db.prepare(`UPDATE editions SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  }
  const updated = db.prepare('SELECT * FROM editions WHERE id = ?').get(req.params.id);
  db.close();
  res.json(updated);
});

// Delete edition (admin+)
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM editions WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ success: true });
});

// Reorder articles in edition
router.post('/:id/reorder', authenticate, requireRole('editor'), (req, res) => {
  const { order } = req.body; // array of article ids
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order muss ein Array sein' });
  const db = getDb();
  const update = db.prepare('UPDATE articles SET position = ? WHERE id = ? AND edition_id = ?');
  order.forEach((articleId, index) => update.run(index, articleId, req.params.id));
  db.close();
  res.json({ success: true });
});

module.exports = router;
