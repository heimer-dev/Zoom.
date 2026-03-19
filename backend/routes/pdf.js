const express = require('express');
const path = require('path');
const { getDb } = require('../database/init');

const router = express.Router();

// Convert Quill Delta JSON to HTML
function deltaToHtml(content) {
  if (!content) return '';
  let delta;
  try {
    delta = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    // Not JSON, return as-is (already HTML or plain text)
    return content;
  }
  if (!delta || !delta.ops) return content;

  let html = '';
  let listBuffer = [];
  let listType = null;

  function flushList() {
    if (listBuffer.length === 0) return;
    const tag = listType === 'ordered' ? 'ol' : 'ul';
    html += `<${tag}>${listBuffer.map(li => `<li>${li}</li>`).join('')}</${tag}>`;
    listBuffer = [];
    listType = null;
  }

  for (let i = 0; i < delta.ops.length; i++) {
    const op = delta.ops[i];
    if (typeof op.insert !== 'string') continue;

    const attrs = op.attributes || {};
    const nextOp = delta.ops[i + 1];
    const nextAttrs = (nextOp && nextOp.insert === '\n' && nextOp.attributes) ? nextOp.attributes : null;

    if (op.insert === '\n') {
      // Block-level newline
      const blockAttrs = attrs;
      if (blockAttrs.header) {
        // already handled by accumulation below
      } else if (blockAttrs.list) {
        // handled below
      } else {
        flushList();
        html += '<br>';
      }
      continue;
    }

    // Accumulate text until next \n to apply block formatting
    // Inline formatting
    let text = op.insert.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (attrs.bold) text = `<strong>${text}</strong>`;
    if (attrs.italic) text = `<em>${text}</em>`;
    if (attrs.underline) text = `<u>${text}</u>`;
    if (attrs.strike) text = `<s>${text}</s>`;
    if (attrs.link) text = `<a href="${attrs.link}">${text}</a>`;

    // Check what block type follows this insert
    if (nextAttrs && nextAttrs.header) {
      flushList();
      html += `<h${nextAttrs.header}>${text}</h${nextAttrs.header}>`;
      i++; // skip the \n
    } else if (nextAttrs && nextAttrs.list) {
      if (listType && listType !== nextAttrs.list) flushList();
      listType = nextAttrs.list;
      listBuffer.push(text);
      i++; // skip the \n
    } else if (nextAttrs && nextAttrs.blockquote) {
      flushList();
      html += `<blockquote>${text}</blockquote>`;
      i++;
    } else {
      flushList();
      html += text;
    }
  }

  flushList();
  // Wrap bare text runs in paragraphs
  html = html.replace(/([^>]+)(<br>|$)/g, (match, text, ending) => {
    if (text.trim()) return `<p>${text.trim()}</p>${ending}`;
    return ending;
  });
  return html;
}

// Generate PDF for an edition
router.get('/edition/:id', async (req, res) => {
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
    ORDER BY a.position ASC
  `).all(req.params.id);
  db.close();

  // Build HTML for the PDF
  const blockIcons = {
    article: '📰', joke: '😂', student_month: '⭐', quote: '💬',
    events: '📅', sports: '⚽', recipe: '🍳', poll: '📊',
    tip: '💡', announcement: '📢', gallery: '🖼️', interview: '🎤'
  };
  const blockLabels = {
    article: 'Artikel', joke: 'Witz der Woche', student_month: 'Schüler des Monats',
    quote: 'Zitat der Woche', events: 'Veranstaltungen', sports: 'Sportecke',
    recipe: 'Rezept der Woche', poll: 'Umfrage', tip: 'Tipp der Redaktion',
    announcement: 'Bekanntmachung', gallery: 'Fotogalerie', interview: 'Interview'
  };

  const articlesHtml = articles.map(a => {
    const isSpecial = a.block_type !== 'article';
    const layoutClass = a.layout === 'two_column' ? 'two-col' : a.layout === 'feature' ? 'feature' : '';
    return `
      <div class="article-block ${layoutClass}" style="background:${a.bg_color};color:${a.text_color};border-top:4px solid ${a.accent_color};margin-bottom:24px;padding:20px;border-radius:8px;page-break-inside:avoid;">
        ${isSpecial ? `<div class="block-badge" style="background:${a.accent_color};color:#fff;display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;margin-bottom:8px;">${blockIcons[a.block_type] || ''} ${blockLabels[a.block_type] || a.block_type}</div>` : ''}
        <h2 style="color:${a.header_color};margin:0 0 12px;font-size:18px;">${a.title}</h2>
        ${a.author_name ? `<div style="font-size:11px;color:#6b7280;margin-bottom:10px;">von ${a.author_name}</div>` : ''}
        <div class="article-content">${deltaToHtml(a.content)}</div>
      </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #fff; color: #1f2937; font-size: 13px; }
  .cover { background: ${edition.cover_color || '#1e40af'}; color: #fff; padding: 60px 40px; text-align: center; min-height: 180px; }
  .cover h1 { font-family: 'Playfair Display', serif; font-size: 56px; letter-spacing: 2px; }
  .cover .subtitle { font-size: 18px; opacity: 0.85; margin-top: 8px; }
  .cover .meta { font-size: 13px; opacity: 0.7; margin-top: 4px; }
  .content { padding: 32px; }
  .two-col { columns: 2; column-gap: 20px; }
  .feature { font-size: 15px; }
  .article-content img { max-width: 100%; height: auto; }
  .article-content h1, .article-content h2, .article-content h3 { margin: 12px 0 6px; }
  .article-content p { margin-bottom: 8px; line-height: 1.6; }
  .article-content ul, .article-content ol { padding-left: 20px; margin-bottom: 8px; }
  .article-content blockquote { border-left: 3px solid #1e40af; padding-left: 12px; color: #4b5563; font-style: italic; margin: 10px 0; }
</style>
</head>
<body>
  <div class="cover">
    <h1>Zoom.</h1>
    <div class="subtitle">${edition.title}</div>
    <div class="meta">${edition.edition_number ? `Ausgabe ${edition.edition_number} · ` : ''}${edition.published_at ? new Date(edition.published_at).toLocaleDateString('de-DE') : ''} · Burgaugymnasium</div>
  </div>
  <div class="content">${articlesHtml}</div>
</body>
</html>`;

  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '15mm', left: '0' }
    });
    await browser.close();

    const filename = `zoom-${edition.edition_number || edition.id}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF Fehler:', err.message);
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden', detail: err.message });
  }
});

module.exports = router;
