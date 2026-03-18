const express = require('express');
const { getDb } = require('../database/init');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const BLOCK_TYPES = [
  'article', 'joke', 'student_month', 'quote', 'events',
  'sports', 'recipe', 'poll', 'tip', 'announcement', 'gallery', 'interview'
];

const LAYOUTS = ['single', 'two_column', 'feature', 'sidebar', 'full_width'];

// Create article in edition (contributor+)
router.post('/', authenticate, requireRole('contributor'), (req, res) => {
  const { edition_id, title, content, layout, block_type, bg_color, text_color, accent_color, header_color, position } = req.body;
  if (!edition_id || !title) return res.status(400).json({ error: 'edition_id und Titel erforderlich' });

  const db = getDb();
  const edition = db.prepare('SELECT id FROM editions WHERE id = ?').get(edition_id);
  if (!edition) { db.close(); return res.status(404).json({ error: 'Ausgabe nicht gefunden' }); }

  const result = db.prepare(`
    INSERT INTO articles (edition_id, title, content, layout, block_type, bg_color, text_color, accent_color, header_color, position, author_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    edition_id, title, content || '',
    LAYOUTS.includes(layout) ? layout : 'single',
    BLOCK_TYPES.includes(block_type) ? block_type : 'article',
    bg_color || '#ffffff', text_color || '#1f2937',
    accent_color || '#1e40af', header_color || '#1e3a8a',
    position || 0, req.user.id
  );
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);
  db.close();
  res.status(201).json(article);
});

// Update article (contributor can update own, editor+ can update all)
router.put('/:id', authenticate, requireRole('contributor'), (req, res) => {
  const db = getDb();
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) { db.close(); return res.status(404).json({ error: 'Artikel nicht gefunden' }); }

  const hierarchy = { superadmin: 4, admin: 3, editor: 2, contributor: 1 };
  const isOwner = article.author_id === req.user.id;
  const isEditor = (hierarchy[req.user.role] || 0) >= 2;
  if (!isOwner && !isEditor) { db.close(); return res.status(403).json({ error: 'Keine Berechtigung' }); }

  const { title, content, layout, block_type, bg_color, text_color, accent_color, header_color, position } = req.body;
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const params = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (layout && LAYOUTS.includes(layout)) { updates.push('layout = ?'); params.push(layout); }
  if (block_type && BLOCK_TYPES.includes(block_type)) { updates.push('block_type = ?'); params.push(block_type); }
  if (bg_color) { updates.push('bg_color = ?'); params.push(bg_color); }
  if (text_color) { updates.push('text_color = ?'); params.push(text_color); }
  if (accent_color) { updates.push('accent_color = ?'); params.push(accent_color); }
  if (header_color) { updates.push('header_color = ?'); params.push(header_color); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position); }

  db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  const updated = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  db.close();
  res.json(updated);
});

// Delete article (editor+)
router.delete('/:id', authenticate, requireRole('editor'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ success: true });
});

// Get block type metadata
router.get('/block-types', (req, res) => {
  res.json([
    { id: 'article',       label: 'Artikel',              icon: '📰', color: '#1e40af' },
    { id: 'joke',          label: 'Witz der Woche',        icon: '😂', color: '#f59e0b' },
    { id: 'student_month', label: 'Schüler des Monats',    icon: '⭐', color: '#7c3aed' },
    { id: 'quote',         label: 'Zitat der Woche',       icon: '💬', color: '#0891b2' },
    { id: 'events',        label: 'Veranstaltungen',       icon: '📅', color: '#059669' },
    { id: 'sports',        label: 'Sportecke',             icon: '⚽', color: '#dc2626' },
    { id: 'recipe',        label: 'Rezept der Woche',      icon: '🍳', color: '#d97706' },
    { id: 'poll',          label: 'Umfrage',               icon: '📊', color: '#4f46e5' },
    { id: 'tip',           label: 'Tipp der Redaktion',    icon: '💡', color: '#0284c7' },
    { id: 'announcement',  label: 'Bekanntmachung',        icon: '📢', color: '#be123c' },
    { id: 'gallery',       label: 'Fotogalerie',           icon: '🖼️', color: '#0f766e' },
    { id: 'interview',     label: 'Interview',             icon: '🎤', color: '#7e22ce' }
  ]);
});

module.exports = router;
