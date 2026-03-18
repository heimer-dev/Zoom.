// ===== DASHBOARD =====
async function renderDashboard() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading"><div class="spinner"></div> Lade Dashboard…</div>`;

  try {
    const [edRes, usrRes] = await Promise.all([
      apiFetch('/editions'),
      hasRole('admin') ? apiFetch('/users') : Promise.resolve(null)
    ]);
    const editions = await edRes.json();
    const users = usrRes ? await usrRes.json() : [];

    const published = editions.filter(e => e.status === 'published').length;
    const drafts = editions.filter(e => e.status === 'draft').length;

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <div class="page-subtitle">Willkommen zurück, ${escHtml(getUser()?.display_name || getUser()?.username)}!</div>
        </div>
        <button class="btn btn-primary" onclick="navigate('editions')">+ Neue Ausgabe</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${editions.length}</div>
          <div class="stat-label">Ausgaben gesamt</div>
        </div>
        <div class="stat-card" style="border-color:#3b82f6">
          <div class="stat-value" style="color:#2563eb">${published}</div>
          <div class="stat-label">Veröffentlicht</div>
        </div>
        <div class="stat-card" style="border-color:#f59e0b">
          <div class="stat-value" style="color:#d97706">${drafts}</div>
          <div class="stat-label">Entwürfe</div>
        </div>
        ${hasRole('admin') ? `
        <div class="stat-card" style="border-color:#8b5cf6">
          <div class="stat-value" style="color:#7c3aed">${users.length}</div>
          <div class="stat-label">Redaktionsmitglieder</div>
        </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Letzte Ausgaben</span>
          <button class="btn btn-secondary btn-sm" onclick="navigate('editions')">Alle anzeigen</button>
        </div>
        <div style="overflow-x:auto">
          ${editions.length === 0 ? `
            <div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">Noch keine Ausgaben</div><div class="empty-text">Erstelle deine erste Ausgabe!</div></div>
          ` : `
          <table class="data-table">
            <thead><tr><th>Titel</th><th>Ausgabe</th><th>Status</th><th>Erstellt</th><th>Aktionen</th></tr></thead>
            <tbody>
              ${editions.slice(0,5).map(e => `
                <tr>
                  <td><strong>${escHtml(e.title)}</strong></td>
                  <td>${escHtml(e.edition_number || '–')}</td>
                  <td><span class="edition-badge ${e.status === 'published' ? 'badge-published' : 'badge-draft'}">${e.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span></td>
                  <td>${formatDate(e.created_at)}</td>
                  <td><button class="btn btn-secondary btn-sm" onclick="editEdition(${e.id})">Bearbeiten</button></td>
                </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;
  } catch(e) {
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Fehler beim Laden</div></div>`;
  }
}
