// ===== USER MANAGEMENT =====
async function renderUsers() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const res = await apiFetch('/users');
  if (!res.ok) { main.innerHTML = `<div class="empty-state"><div class="empty-icon">🚫</div><div class="empty-title">Keine Berechtigung</div></div>`; return; }
  const users = await res.json();
  const me = getUser();

  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Benutzer</h1><div class="page-subtitle">Redaktionsmitglieder verwalten</div></div>
      <button class="btn btn-primary" onclick="showNewUserModal()">+ Neuer Benutzer</button>
    </div>
    <div class="card">
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Benutzer</th><th>Rolle</th><th>Email</th><th>Erstellt</th><th>Aktionen</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>
                  <div style="font-weight:600">${escHtml(u.display_name || u.username)}</div>
                  <div style="font-size:12px;color:#9ca3af">@${escHtml(u.username)}</div>
                </td>
                <td><span class="topbar-user-badge ${roleBadgeClass(u.role)}">${roleLabel(u.role)}</span></td>
                <td>${escHtml(u.email || '–')}</td>
                <td>${formatDate(u.created_at)}</td>
                <td style="display:flex;gap:6px">
                  ${u.id !== me.id ? `<button class="btn btn-secondary btn-sm" onclick="showEditUserModal(${u.id},'${escHtml(u.username)}','${escHtml(u.display_name||'')}','${escHtml(u.email||'')}','${u.role}')">✏️</button>` : '<span style="color:#9ca3af;font-size:12px">(Du)</span>'}
                  ${hasRole('superadmin') && u.id !== me.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.username)}')">🗑</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Roles info -->
    <div class="card" style="margin-top:24px">
      <div class="card-header"><span class="card-title">Rollen-Übersicht</span></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
          ${[
            { role: 'contributor', label: 'Mitarbeiter', desc: 'Kann eigene Artikel schreiben und bearbeiten' },
            { role: 'editor', label: 'Redakteur', desc: 'Kann alle Artikel bearbeiten und Ausgaben verwalten' },
            { role: 'admin', label: 'Admin', desc: 'Kann Benutzer anlegen und Einstellungen ändern' },
            { role: 'superadmin', label: 'Super-Admin', desc: 'Voller Zugriff auf alles' }
          ].map(r => `
            <div style="padding:16px;border-radius:10px;border:1px solid #e5e7eb">
              <span class="topbar-user-badge ${roleBadgeClass(r.role)}" style="margin-bottom:8px;display:inline-block">${r.label}</span>
              <div style="font-size:12px;color:#6b7280">${r.desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function showNewUserModal() {
  const me = getUser();
  const availRoles = ['contributor', 'editor', 'admin'];
  if (me.role === 'superadmin') availRoles.push('superadmin');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="new-user-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Neuer Benutzer</span>
          <button class="modal-close" onclick="document.getElementById('new-user-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Benutzername *</label>
              <input type="text" id="nu-username" class="form-input" placeholder="benutzername">
            </div>
            <div class="form-group">
              <label class="form-label">Anzeigename</label>
              <input type="text" id="nu-display" class="form-input" placeholder="Max Mustermann">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Passwort *</label>
              <input type="password" id="nu-password" class="form-input" placeholder="Mindestens 6 Zeichen">
              <div class="form-hint">Benutzer muss Passwort beim ersten Login ändern</div>
            </div>
            <div class="form-group">
              <label class="form-label">E-Mail</label>
              <input type="email" id="nu-email" class="form-input" placeholder="optional">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Rolle</label>
            <select id="nu-role" class="form-select">
              ${availRoles.map(r => `<option value="${r}">${roleLabel(r)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('new-user-modal').remove()">Abbrechen</button>
          <button class="btn btn-primary" onclick="createUser()">Erstellen</button>
        </div>
      </div>
    </div>`);
}

async function createUser() {
  const username = document.getElementById('nu-username').value.trim();
  const password = document.getElementById('nu-password').value;
  if (!username || !password) { showToast('Benutzername und Passwort erforderlich', 'error'); return; }

  const res = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      display_name: document.getElementById('nu-display').value.trim() || undefined,
      email: document.getElementById('nu-email').value.trim() || undefined,
      role: document.getElementById('nu-role').value
    })
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  document.getElementById('new-user-modal')?.remove();
  showToast(`Benutzer "${username}" erstellt!`, 'success');
  renderUsers();
}

function showEditUserModal(id, username, display_name, email, role) {
  const me = getUser();
  const availRoles = ['contributor', 'editor', 'admin'];
  if (me.role === 'superadmin') availRoles.push('superadmin');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="edit-user-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Benutzer bearbeiten: @${escHtml(username)}</span>
          <button class="modal-close" onclick="document.getElementById('edit-user-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Anzeigename</label>
              <input type="text" id="eu-display" class="form-input" value="${escHtml(display_name)}">
            </div>
            <div class="form-group">
              <label class="form-label">E-Mail</label>
              <input type="email" id="eu-email" class="form-input" value="${escHtml(email)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Rolle</label>
            <select id="eu-role" class="form-select">
              ${availRoles.map(r => `<option value="${r}" ${r===role?'selected':''}>${roleLabel(r)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Neues Passwort (leer lassen = unverändert)</label>
            <input type="password" id="eu-password" class="form-input" placeholder="Leer lassen für keine Änderung">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('edit-user-modal').remove()">Abbrechen</button>
          <button class="btn btn-primary" onclick="updateUser(${id})">Speichern</button>
        </div>
      </div>
    </div>`);
}

async function updateUser(id) {
  const body = {
    display_name: document.getElementById('eu-display').value.trim(),
    email: document.getElementById('eu-email').value.trim(),
    role: document.getElementById('eu-role').value
  };
  const pw = document.getElementById('eu-password').value;
  if (pw) body.password = pw;

  const res = await apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) { document.getElementById('edit-user-modal')?.remove(); showToast('Benutzer aktualisiert', 'success'); renderUsers(); }
  else { const d = await res.json(); showToast(d.error || 'Fehler', 'error'); }
}

async function deleteUser(id, username) {
  if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
  const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (res.ok) { showToast('Benutzer gelöscht', 'success'); renderUsers(); }
  else showToast('Fehler beim Löschen', 'error');
}
