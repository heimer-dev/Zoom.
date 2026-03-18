// ===== SETTINGS =====
async function renderSettings() {
  const main = document.getElementById('admin-main');
  main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  const res = await apiFetch('/settings');
  const s = await res.json();

  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Einstellungen</h1><div class="page-subtitle">Erscheinungsbild und allgemeine Konfiguration</div></div>
    </div>

    <div class="card" style="max-width:640px">
      <div class="card-header"><span class="card-title">Zeitung</span></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Name der Zeitung</label>
          <input type="text" id="s-name" class="form-input" value="${escHtml(s.newspaper_name||'Zoom.')}">
        </div>
        <div class="form-group">
          <label class="form-label">Untertitel / Tagline</label>
          <input type="text" id="s-tagline" class="form-input" value="${escHtml(s.newspaper_tagline||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Schulname</label>
          <input type="text" id="s-school" class="form-input" value="${escHtml(s.school_name||'Burgaugymnasium')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Hauptfarbe</label>
            <div class="form-color-row">
              <input type="color" id="s-primary-color" value="${s.primary_color||'#1e40af'}">
              <span style="font-size:12px;color:#6b7280">Primärfarbe</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Sekundärfarbe</label>
            <div class="form-color-row">
              <input type="color" id="s-secondary-color" value="${s.secondary_color||'#3b82f6'}">
              <span style="font-size:12px;color:#6b7280">Akzentfarbe</span>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="saveSettings()">💾 Einstellungen speichern</button>
      </div>
    </div>

    <div class="card" style="max-width:640px;margin-top:24px">
      <div class="card-header"><span class="card-title">Passwort ändern</span></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Aktuelles Passwort</label>
          <input type="password" id="s-cur-pw" class="form-input">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Neues Passwort</label>
            <input type="password" id="s-new-pw" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Bestätigung</label>
            <input type="password" id="s-confirm-pw" class="form-input">
          </div>
        </div>
        <button class="btn btn-secondary" onclick="changeOwnPassword()">Passwort ändern</button>
      </div>
    </div>`;
}

async function saveSettings() {
  const body = {
    newspaper_name: document.getElementById('s-name').value.trim(),
    newspaper_tagline: document.getElementById('s-tagline').value.trim(),
    school_name: document.getElementById('s-school').value.trim(),
    primary_color: document.getElementById('s-primary-color').value,
    secondary_color: document.getElementById('s-secondary-color').value
  };
  const res = await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) showToast('Einstellungen gespeichert!', 'success');
  else showToast('Fehler beim Speichern', 'error');
}

async function changeOwnPassword() {
  const cur = document.getElementById('s-cur-pw').value;
  const np = document.getElementById('s-new-pw').value;
  const cp = document.getElementById('s-confirm-pw').value;
  if (!cur || !np) { showToast('Felder ausfüllen', 'error'); return; }
  if (np !== cp) { showToast('Passwörter stimmen nicht überein', 'error'); return; }
  if (np.length < 6) { showToast('Mindestens 6 Zeichen', 'error'); return; }

  const res = await apiFetch('/auth/change-password', {
    method: 'POST', body: JSON.stringify({ current_password: cur, new_password: np })
  });
  if (res.ok) {
    showToast('Passwort geändert!', 'success');
    document.getElementById('s-cur-pw').value = '';
    document.getElementById('s-new-pw').value = '';
    document.getElementById('s-confirm-pw').value = '';
  } else {
    const d = await res.json(); showToast(d.error || 'Fehler', 'error');
  }
}
