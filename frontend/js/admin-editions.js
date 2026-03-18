// ===== EDITIONS LIST =====
async function renderEditions() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const res = await apiFetch('/editions');
  const editions = await res.json();

  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Ausgaben</h1><div class="page-subtitle">Alle Ausgaben der Zoom.</div></div>
      ${hasRole('editor') ? `<button class="btn btn-primary" onclick="showNewEditionModal()">+ Neue Ausgabe</button>` : ''}
    </div>
    <div class="card">
      <div style="overflow-x:auto">
        ${editions.length === 0 ? `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">Noch keine Ausgaben</div></div>` : `
        <table class="data-table">
          <thead><tr><th>Titel</th><th>Nr.</th><th>Artikel</th><th>Status</th><th>Erstellt</th><th>Aktionen</th></tr></thead>
          <tbody>
            ${editions.map(e => `
              <tr>
                <td>
                  <div style="font-weight:600">${escHtml(e.title)}</div>
                  ${e.subtitle ? `<div style="font-size:12px;color:#9ca3af">${escHtml(e.subtitle)}</div>` : ''}
                </td>
                <td>${escHtml(e.edition_number || '–')}</td>
                <td>${e.article_count || 0}</td>
                <td><span class="edition-badge ${e.status === 'published' ? 'badge-published' : 'badge-draft'}">${e.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span></td>
                <td>${formatDate(e.created_at)}</td>
                <td style="display:flex;gap:6px">
                  ${hasRole('editor') ? `<button class="btn btn-secondary btn-sm" onclick="editEdition(${e.id})">✏️ Bearbeiten</button>` : ''}
                  ${hasRole('editor') ? `<a href="/reader.html?id=${e.id}" target="_blank" class="btn btn-secondary btn-sm">👁 Ansicht</a>` : ''}
                  ${hasRole('admin') ? `<button class="btn btn-danger btn-sm" onclick="deleteEdition(${e.id},'${escHtml(e.title)}')">🗑</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}

function showNewEditionModal() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="new-edition-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Neue Ausgabe erstellen</span>
          <button class="modal-close" onclick="document.getElementById('new-edition-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titel *</label>
              <input type="text" id="ne-title" class="form-input" placeholder="z.B. Frühlingsausgabe 2024">
            </div>
            <div class="form-group">
              <label class="form-label">Ausgabe-Nr.</label>
              <input type="text" id="ne-number" class="form-input" placeholder="z.B. 42">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Untertitel</label>
            <input type="text" id="ne-subtitle" class="form-input" placeholder="Kurzbeschreibung">
          </div>
          <div class="form-group">
            <label class="form-label">Cover-Farbe</label>
            <div class="form-color-row">
              <input type="color" id="ne-color" value="#1e40af">
              <input type="text" class="form-input" style="width:120px" id="ne-color-text" value="#1e40af" oninput="document.getElementById('ne-color').value=this.value">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('new-edition-modal').remove()">Abbrechen</button>
          <button class="btn btn-primary" onclick="createEdition()">Erstellen</button>
        </div>
      </div>
    </div>`);

  document.getElementById('ne-color').addEventListener('input', e => {
    document.getElementById('ne-color-text').value = e.target.value;
  });
}

async function createEdition() {
  const title = document.getElementById('ne-title').value.trim();
  if (!title) { showToast('Titel ist erforderlich', 'error'); return; }
  const body = {
    title,
    edition_number: document.getElementById('ne-number').value.trim() || undefined,
    subtitle: document.getElementById('ne-subtitle').value.trim() || undefined,
    cover_color: document.getElementById('ne-color').value
  };
  const res = await apiFetch('/editions', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  document.getElementById('new-edition-modal')?.remove();
  showToast('Ausgabe erstellt!', 'success');
  editEdition(data.id);
}

async function deleteEdition(id, title) {
  if (!confirm(`Ausgabe "${title}" wirklich löschen? Alle Artikel werden ebenfalls gelöscht.`)) return;
  const res = await apiFetch(`/editions/${id}`, { method: 'DELETE' });
  if (res.ok) { showToast('Ausgabe gelöscht', 'success'); renderEditions(); }
  else showToast('Fehler beim Löschen', 'error');
}

// ===== EDITION EDITOR =====
let currentEdition = null;
let currentArticle = null;
let quillInstance = null;
let autoSaveTimer = null;

const BLOCK_INFO = {
  article:       { icon: '📰', label: 'Artikel', color: '#1e40af' },
  joke:          { icon: '😂', label: 'Witz der Woche', color: '#f59e0b' },
  student_month: { icon: '⭐', label: 'Schüler des Monats', color: '#7c3aed' },
  quote:         { icon: '💬', label: 'Zitat der Woche', color: '#0891b2' },
  events:        { icon: '📅', label: 'Veranstaltungen', color: '#059669' },
  sports:        { icon: '⚽', label: 'Sportecke', color: '#dc2626' },
  recipe:        { icon: '🍳', label: 'Rezept der Woche', color: '#d97706' },
  poll:          { icon: '📊', label: 'Umfrage', color: '#4f46e5' },
  tip:           { icon: '💡', label: 'Tipp der Redaktion', color: '#0284c7' },
  announcement:  { icon: '📢', label: 'Bekanntmachung', color: '#be123c' },
  gallery:       { icon: '🖼️', label: 'Fotogalerie', color: '#0f766e' },
  interview:     { icon: '🎤', label: 'Interview', color: '#7e22ce' }
};

const LAYOUT_INFO = {
  single:     { icon: '▬', label: 'Einspaltig' },
  two_column: { icon: '⊟', label: 'Zweispaltig' },
  feature:    { icon: '★', label: 'Feature' },
  sidebar:    { icon: '▤', label: 'Mit Sidebar' },
  full_width: { icon: '▭', label: 'Ganze Breite' }
};

async function editEdition(id) {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  main.className = 'admin-main editor-page';

  try {
    const res = await apiFetch(`/editions/${id}`);
    currentEdition = await res.json();
    currentArticle = null;
    renderEditorShell();
    renderArticleList();
  } catch(e) {
    main.innerHTML = `<div style="padding:32px" class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Fehler beim Laden</div></div>`;
  }
}

function renderEditorShell() {
  const e = currentEdition;
  const main = document.getElementById('admin-main');
  main.innerHTML = `
    <!-- Editor topbar -->
    <div class="editor-topbar">
      <button class="btn btn-secondary btn-sm" onclick="navigate('editions')">← Zurück</button>
      <div class="editor-edition-title">${escHtml(e.title)}</div>
      <span class="editor-status-badge ${e.status === 'published' ? 'status-published' : 'status-draft'}" id="edition-status-badge">
        ${e.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
      </span>
      <div style="flex:1"></div>
      <span class="autosave-indicator" id="autosave-ind">●</span>
      ${hasRole('editor') ? `<button class="btn btn-secondary btn-sm" onclick="showEditionSettingsModal()">⚙️ Einstellungen</button>` : ''}
      ${hasRole('editor') && e.status === 'draft' ? `<button class="btn btn-success btn-sm" onclick="publishEdition()">🚀 Veröffentlichen</button>` : ''}
      ${hasRole('editor') && e.status === 'published' ? `<button class="btn btn-secondary btn-sm" onclick="unpublishEdition()">📥 Zurück zu Entwurf</button>` : ''}
      <a href="/api/pdf/edition/${e.id}" target="_blank" class="btn btn-secondary btn-sm">⬇ PDF</a>
    </div>

    <!-- Split editor -->
    <div class="editor-split">
      <!-- Left: Article list -->
      <div class="editor-split-left">
        <div style="padding:16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;font-weight:600;color:#374151">Abschnitte</span>
          ${hasRole('contributor') ? `<button class="btn btn-primary btn-sm" onclick="showNewArticleModal()">+ Neu</button>` : ''}
        </div>
        <div id="article-list-container" style="flex:1;overflow-y:auto"></div>
      </div>

      <!-- Middle: Editor -->
      <div class="editor-split-main">
        <div id="editor-area" style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;flex-direction:column;gap:12px">
          <div style="font-size:48px">📝</div>
          <div style="font-size:15px;font-weight:500">Wähle einen Abschnitt zum Bearbeiten</div>
          <div style="font-size:13px">oder erstelle einen neuen Abschnitt</div>
        </div>
      </div>

      <!-- Right: Settings panel -->
      <div class="settings-panel" id="article-settings-panel" style="display:none"></div>
    </div>`;
}

function renderArticleList() {
  const container = document.getElementById('article-list-container');
  if (!container) return;
  const articles = currentEdition.articles || [];

  if (articles.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">Noch keine Abschnitte.<br>Erstelle deinen ersten!</div>`;
    return;
  }

  container.innerHTML = articles.map((a, i) => {
    const info = BLOCK_INFO[a.block_type] || BLOCK_INFO.article;
    const isSelected = currentArticle?.id === a.id;
    return `
      <div class="article-item ${isSelected ? 'selected' : ''}" onclick="selectArticle(${a.id})" draggable="true" data-id="${a.id}" data-pos="${i}">
        <div class="article-item-icon">${info.icon}</div>
        <div class="article-item-info">
          <div class="article-item-title">${escHtml(a.title)}</div>
          <div class="article-item-meta">${info.label}</div>
        </div>
        <div class="article-item-actions">
          ${hasRole('editor') ? `<button class="btn btn-danger btn-icon btn-sm" onclick="event.stopPropagation();deleteArticle(${a.id})" title="Löschen">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');

  setupDragDrop();
}

async function selectArticle(id) {
  const article = currentEdition.articles.find(a => a.id === id);
  if (!article) return;
  currentArticle = article;

  // Highlight selected
  document.querySelectorAll('.article-item').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.article-item[data-id="${id}"]`)?.classList.add('selected');

  renderArticleEditor(article);
  renderArticleSettings(article);
}

function renderArticleEditor(article) {
  const area = document.getElementById('editor-area');
  const canEdit = hasRole('contributor') && (article.author_id === getUser()?.id || hasRole('editor'));

  area.innerHTML = `
    <div class="article-editor-panel" style="height:100%;display:flex;flex-direction:column">
      <div class="article-editor-header">
        ${canEdit ? `
          <input type="text" class="article-title-input" id="article-title-input"
            value="${escHtml(article.title)}" placeholder="Titel des Abschnitts"
            oninput="scheduleAutoSave()">
        ` : `<div class="article-title-input" style="cursor:default">${escHtml(article.title)}</div>`}
      </div>
      <div id="editor-container" style="flex:1;overflow-y:auto"></div>
    </div>`;

  // Load Quill
  loadQuill(article, canEdit);
}

function loadQuill(article, canEdit) {
  // Load Quill CSS/JS if not already loaded
  if (!window.Quill) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
    script.onload = () => initQuill(article, canEdit);
    document.head.appendChild(script);
  } else {
    initQuill(article, canEdit);
  }
}

function initQuill(article, canEdit) {
  const container = document.getElementById('editor-container');
  if (!container) return;

  const toolbarOptions = canEdit ? [
    [{ 'font': ['sans-serif', 'serif', 'monospace', 'playfair'] }],
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    ['link', 'image'],
    ['clean']
  ] : false;

  // Register Playfair Display font
  if (window.Quill) {
    const Font = Quill.import('formats/font');
    Font.whitelist = ['sans-serif', 'serif', 'monospace', 'playfair'];
    Quill.register(Font, true);
  }

  quillInstance = new Quill('#editor-container', {
    theme: 'snow',
    readOnly: !canEdit,
    modules: { toolbar: toolbarOptions },
    placeholder: 'Schreibe hier deinen Text…'
  });

  // Apply Playfair font style
  const style = document.createElement('style');
  style.textContent = `.ql-font-playfair { font-family: 'Playfair Display', serif; }`;
  document.head.appendChild(style);

  // Set content
  if (article.content) {
    try {
      const delta = JSON.parse(article.content);
      quillInstance.setContents(delta);
    } catch {
      quillInstance.clipboard.dangerouslyPasteHTML(article.content);
    }
  }

  if (canEdit) {
    quillInstance.on('text-change', () => scheduleAutoSave());
  }
}

function scheduleAutoSave() {
  const ind = document.getElementById('autosave-ind');
  if (ind) { ind.className = 'autosave-indicator saving'; ind.textContent = '● Speichern…'; }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 1500);
}

async function autoSave() {
  if (!currentArticle || !quillInstance) return;
  const title = document.getElementById('article-title-input')?.value || currentArticle.title;
  const content = JSON.stringify(quillInstance.getContents());

  try {
    const res = await apiFetch(`/articles/${currentArticle.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content })
    });
    if (res.ok) {
      const updated = await res.json();
      // Update local state
      const idx = currentEdition.articles.findIndex(a => a.id === currentArticle.id);
      if (idx !== -1) { currentEdition.articles[idx] = { ...currentEdition.articles[idx], ...updated }; currentArticle = currentEdition.articles[idx]; }
      renderArticleList();
      const ind = document.getElementById('autosave-ind');
      if (ind) { ind.className = 'autosave-indicator saved'; ind.textContent = '✓ Gespeichert'; setTimeout(() => { if(ind) { ind.className='autosave-indicator'; ind.textContent='●'; } }, 2000); }
    }
  } catch(e) { /* silent fail */ }
}

function renderArticleSettings(article) {
  const panel = document.getElementById('article-settings-panel');
  if (!panel) return;
  panel.style.display = 'block';

  const canEdit = hasRole('editor');
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Abschnitt-Einstellungen</div>

    <!-- Block type -->
    <div class="form-group">
      <label class="form-label">Abschnittstyp</label>
      <div class="block-type-grid">
        ${Object.entries(BLOCK_INFO).map(([id, info]) => `
          <button class="block-type-btn ${article.block_type === id ? 'selected' : ''}" onclick="${canEdit ? `changeBlockType('${id}')` : ''}" ${canEdit ? '' : 'disabled'} title="${info.label}">
            <span class="bt-icon">${info.icon}</span>${info.label}
          </button>`).join('')}
      </div>
    </div>

    <!-- Layout -->
    <div class="form-group">
      <label class="form-label">Layout</label>
      <div class="layout-grid">
        ${Object.entries(LAYOUT_INFO).map(([id, info]) => `
          <button class="layout-btn ${article.layout === id ? 'selected' : ''}" onclick="${canEdit ? `changeLayout('${id}')` : ''}" ${canEdit ? '' : 'disabled'}>
            <span class="layout-icon">${info.icon}</span>${info.label}
          </button>`).join('')}
      </div>
    </div>

    <!-- Colors -->
    <div class="form-group">
      <label class="form-label">Farben</label>
      ${colorRow('Hintergrund', 'bg_color', article.bg_color, canEdit)}
      ${colorRow('Text', 'text_color', article.text_color, canEdit)}
      ${colorRow('Akzent', 'accent_color', article.accent_color, canEdit)}
      ${colorRow('Überschriften', 'header_color', article.header_color, canEdit)}
    </div>

    ${canEdit ? `<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="saveArticleSettings()">💾 Speichern</button>` : ''}
  `;
}

function colorRow(label, field, value, canEdit) {
  return `
    <div class="color-row">
      <span class="color-label">${label}</span>
      <div class="color-input-wrap">
        <input type="color" id="color-${field}" value="${value || '#ffffff'}" ${canEdit ? `oninput="document.getElementById('text-${field}').value=this.value"` : 'disabled'}>
        <input type="text" id="text-${field}" value="${value || '#ffffff'}" ${canEdit ? `oninput="document.getElementById('color-${field}').value=this.value"` : 'disabled readonly'} style="width:80px;padding:4px 8px;font-size:11px;border:1px solid #e5e7eb;border-radius:5px;font-family:monospace">
      </div>
    </div>`;
}

async function saveArticleSettings() {
  if (!currentArticle) return;
  const body = {
    bg_color: document.getElementById('color-bg_color')?.value,
    text_color: document.getElementById('color-text_color')?.value,
    accent_color: document.getElementById('color-accent_color')?.value,
    header_color: document.getElementById('color-header_color')?.value
  };
  const res = await apiFetch(`/articles/${currentArticle.id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) {
    const updated = await res.json();
    const idx = currentEdition.articles.findIndex(a => a.id === currentArticle.id);
    if (idx !== -1) { currentEdition.articles[idx] = { ...currentEdition.articles[idx], ...updated }; currentArticle = currentEdition.articles[idx]; }
    showToast('Einstellungen gespeichert', 'success');
  } else showToast('Fehler beim Speichern', 'error');
}

async function changeBlockType(type) {
  if (!currentArticle) return;
  const res = await apiFetch(`/articles/${currentArticle.id}`, { method: 'PUT', body: JSON.stringify({ block_type: type }) });
  if (res.ok) {
    const updated = await res.json();
    const idx = currentEdition.articles.findIndex(a => a.id === currentArticle.id);
    if (idx !== -1) { currentEdition.articles[idx] = { ...currentEdition.articles[idx], ...updated }; currentArticle = currentEdition.articles[idx]; }
    renderArticleSettings(currentArticle);
    renderArticleList();
  }
}

async function changeLayout(layout) {
  if (!currentArticle) return;
  const res = await apiFetch(`/articles/${currentArticle.id}`, { method: 'PUT', body: JSON.stringify({ layout }) });
  if (res.ok) {
    const updated = await res.json();
    const idx = currentEdition.articles.findIndex(a => a.id === currentArticle.id);
    if (idx !== -1) { currentEdition.articles[idx] = { ...currentEdition.articles[idx], ...updated }; currentArticle = currentEdition.articles[idx]; }
    renderArticleSettings(currentArticle);
  }
}

function showNewArticleModal() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="new-article-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Neuer Abschnitt</span>
          <button class="modal-close" onclick="document.getElementById('new-article-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Titel *</label>
            <input type="text" id="na-title" class="form-input" placeholder="Abschnitts-Titel">
          </div>
          <div class="form-group">
            <label class="form-label">Typ</label>
            <div class="block-type-grid">
              ${Object.entries(BLOCK_INFO).map(([id, info]) => `
                <button class="block-type-btn ${id === 'article' ? 'selected' : ''}" onclick="selectNewBlockType(this,'${id}')">
                  <span class="bt-icon">${info.icon}</span>${info.label}
                </button>`).join('')}
            </div>
            <input type="hidden" id="na-type" value="article">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('new-article-modal').remove()">Abbrechen</button>
          <button class="btn btn-primary" onclick="createArticle()">Erstellen</button>
        </div>
      </div>
    </div>`);
}

function selectNewBlockType(el, type) {
  document.querySelectorAll('#new-article-modal .block-type-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('na-type').value = type;
}

async function createArticle() {
  const title = document.getElementById('na-title').value.trim();
  const block_type = document.getElementById('na-type').value;
  if (!title) { showToast('Titel erforderlich', 'error'); return; }
  const info = BLOCK_INFO[block_type] || BLOCK_INFO.article;

  const res = await apiFetch('/articles', {
    method: 'POST',
    body: JSON.stringify({
      edition_id: currentEdition.id, title, block_type,
      accent_color: info.color, position: (currentEdition.articles || []).length
    })
  });
  if (!res.ok) { const d = await res.json(); showToast(d.error || 'Fehler', 'error'); return; }
  const article = await res.json();
  currentEdition.articles = [...(currentEdition.articles || []), article];
  document.getElementById('new-article-modal')?.remove();
  showToast('Abschnitt erstellt!', 'success');
  renderArticleList();
  selectArticle(article.id);
}

async function deleteArticle(id) {
  if (!confirm('Diesen Abschnitt wirklich löschen?')) return;
  const res = await apiFetch(`/articles/${id}`, { method: 'DELETE' });
  if (res.ok) {
    currentEdition.articles = currentEdition.articles.filter(a => a.id !== id);
    if (currentArticle?.id === id) {
      currentArticle = null;
      document.getElementById('article-settings-panel').style.display = 'none';
      document.getElementById('editor-area').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;flex-direction:column;gap:12px"><div style="font-size:48px">📝</div><div>Wähle einen Abschnitt</div></div>`;
    }
    renderArticleList();
    showToast('Abschnitt gelöscht', 'success');
  }
}

async function publishEdition() {
  if (!confirm('Diese Ausgabe veröffentlichen? Sie wird dann für alle sichtbar.')) return;
  const res = await apiFetch(`/editions/${currentEdition.id}`, { method: 'PUT', body: JSON.stringify({ status: 'published' }) });
  if (res.ok) {
    currentEdition.status = 'published';
    showToast('🎉 Ausgabe veröffentlicht!', 'success');
    renderEditorShell();
    renderArticleList();
    if (currentArticle) selectArticle(currentArticle.id);
  }
}

async function unpublishEdition() {
  const res = await apiFetch(`/editions/${currentEdition.id}`, { method: 'PUT', body: JSON.stringify({ status: 'draft' }) });
  if (res.ok) { currentEdition.status = 'draft'; showToast('Zurück zu Entwurf', 'success'); renderEditorShell(); renderArticleList(); if (currentArticle) selectArticle(currentArticle.id); }
}

function showEditionSettingsModal() {
  const e = currentEdition;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="edition-settings-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Ausgaben-Einstellungen</span>
          <button class="modal-close" onclick="document.getElementById('edition-settings-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titel *</label>
              <input type="text" id="es-title" class="form-input" value="${escHtml(e.title)}">
            </div>
            <div class="form-group">
              <label class="form-label">Ausgabe-Nr.</label>
              <input type="text" id="es-number" class="form-input" value="${escHtml(e.edition_number||'')}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Untertitel</label>
            <input type="text" id="es-subtitle" class="form-input" value="${escHtml(e.subtitle||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Cover-Farbe</label>
            <div class="form-color-row">
              <input type="color" id="es-color" value="${e.cover_color||'#1e40af'}">
              <input type="text" class="form-input" style="width:120px" value="${e.cover_color||'#1e40af'}" oninput="document.getElementById('es-color').value=this.value">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('edition-settings-modal').remove()">Abbrechen</button>
          <button class="btn btn-primary" onclick="saveEditionSettings()">Speichern</button>
        </div>
      </div>
    </div>`);
  document.getElementById('es-color').addEventListener('input', e => {
    e.target.nextElementSibling.value = e.target.value;
  });
}

async function saveEditionSettings() {
  const body = {
    title: document.getElementById('es-title').value.trim(),
    edition_number: document.getElementById('es-number').value.trim(),
    subtitle: document.getElementById('es-subtitle').value.trim(),
    cover_color: document.getElementById('es-color').value
  };
  if (!body.title) { showToast('Titel erforderlich', 'error'); return; }
  const res = await apiFetch(`/editions/${currentEdition.id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) {
    const updated = await res.json();
    currentEdition = { ...currentEdition, ...updated };
    document.getElementById('edition-settings-modal')?.remove();
    showToast('Einstellungen gespeichert', 'success');
    renderEditorShell();
    renderArticleList();
    if (currentArticle) selectArticle(currentArticle.id);
  }
}

// Drag & Drop reordering
function setupDragDrop() {
  const items = document.querySelectorAll('.article-item[draggable]');
  let dragSrc = null;
  items.forEach(item => {
    item.addEventListener('dragstart', e => { dragSrc = item; item.style.opacity = '0.5'; });
    item.addEventListener('dragend', () => { item.style.opacity = '1'; });
    item.addEventListener('dragover', e => { e.preventDefault(); });
    item.addEventListener('drop', async e => {
      e.preventDefault();
      if (dragSrc === item) return;
      const srcId = parseInt(dragSrc.dataset.id);
      const dstId = parseInt(item.dataset.id);
      const articles = currentEdition.articles;
      const srcIdx = articles.findIndex(a => a.id === srcId);
      const dstIdx = articles.findIndex(a => a.id === dstId);
      const moved = articles.splice(srcIdx, 1)[0];
      articles.splice(dstIdx, 0, moved);
      renderArticleList();
      await apiFetch(`/editions/${currentEdition.id}/reorder`, {
        method: 'POST', body: JSON.stringify({ order: articles.map(a => a.id) })
      });
    });
  });
}
