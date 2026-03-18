// ===== UTILITY FUNCTIONS =====
const API = '/api';

function getToken() { return localStorage.getItem('zoom_token'); }
function setToken(t) { localStorage.setItem('zoom_token', t); }
function clearToken() { localStorage.removeItem('zoom_token'); localStorage.removeItem('zoom_user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('zoom_user')); } catch { return null; } }
function setUser(u) { localStorage.setItem('zoom_user', JSON.stringify(u)); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 401) { clearToken(); location.reload(); throw new Error('Nicht authentifiziert'); }
  return res;
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function hasRole(minRole) {
  const u = getUser();
  if (!u) return false;
  const h = { superadmin: 4, admin: 3, editor: 2, contributor: 1 };
  return (h[u.role] || 0) >= (h[minRole] || 0);
}

function roleBadgeClass(role) {
  return { superadmin: 'badge-superadmin', admin: 'badge-admin', editor: 'badge-editor', contributor: 'badge-contributor' }[role] || '';
}
function roleLabel(role) {
  return { superadmin: 'Super-Admin', admin: 'Admin', editor: 'Redakteur', contributor: 'Mitarbeiter' }[role] || role;
}

function formatDate(dt) {
  if (!dt) return '–';
  return new Date(dt).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
