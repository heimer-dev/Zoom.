// ===== APP INIT & NAVIGATION =====
let currentPage = 'dashboard';

function initApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('change-pw-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';

  // Set topbar info
  document.getElementById('topbar-username').textContent = user.display_name || user.username;
  const badge = document.getElementById('topbar-role-badge');
  badge.className = `topbar-user-badge ${roleBadgeClass(user.role)}`;
  badge.textContent = roleLabel(user.role);

  // Show admin-only nav items
  if (hasRole('admin')) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }

  navigate('dashboard');
}

function navigate(page, ...args) {
  currentPage = page;

  // Update active state
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  // Reset admin-main class
  document.getElementById('admin-main').className = 'admin-main';

  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'editions': renderEditions(); break;
    case 'users': if (hasRole('admin')) renderUsers(); break;
    case 'settings': if (hasRole('admin')) renderSettings(); break;
    default: renderDashboard();
  }
}

// Auto-login check on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    // Verify token is still valid
    apiFetch('/auth/me').then(res => {
      if (res.ok) {
        res.json().then(u => {
          setUser(u);
          if (u.must_change_password) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('change-pw-screen').style.display = 'flex';
          } else {
            initApp(u);
          }
        });
      } else {
        clearToken();
        document.getElementById('login-screen').style.display = 'flex';
      }
    }).catch(() => {
      document.getElementById('login-screen').style.display = 'flex';
    });
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
});
