// ===== AUTH =====
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) { errEl.textContent = 'Bitte Benutzername und Passwort eingeben'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login fehlgeschlagen'; errEl.style.display = 'block'; return; }

    setToken(data.token);
    setUser(data.user);

    if (data.user.must_change_password) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('change-pw-screen').style.display = 'flex';
    } else {
      initApp(data.user);
    }
  } catch(e) {
    errEl.textContent = 'Verbindungsfehler'; errEl.style.display = 'block';
  }
}

async function doChangePassword() {
  const np = document.getElementById('new-password').value;
  const cp = document.getElementById('confirm-password').value;
  const errEl = document.getElementById('pw-error');
  errEl.style.display = 'none';

  if (np.length < 6) { errEl.textContent = 'Mindestens 6 Zeichen'; errEl.style.display = 'block'; return; }
  if (np !== cp) { errEl.textContent = 'Passwörter stimmen nicht überein'; errEl.style.display = 'block'; return; }

  try {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: np })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }

    const user = getUser();
    user.must_change_password = false;
    setUser(user);
    document.getElementById('change-pw-screen').style.display = 'none';
    initApp(user);
  } catch(e) {
    errEl.textContent = 'Fehler beim Speichern'; errEl.style.display = 'block';
  }
}

function logout() {
  clearToken();
  location.reload();
}

// Enter key on login form
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-username')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
});
