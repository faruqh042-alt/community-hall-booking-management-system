// js/login.js - logic for login.html

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();

  // If already logged in, skip straight to the halls page
  if (isLoggedIn()) {
    window.location.href = 'halls.html';
    return;
  }

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const alertBox = document.getElementById('loginAlert');
  const btn = document.getElementById('loginBtn');

  alertBox.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    saveSession(data.token, data.user);

    // Send admins to the dashboard, regular users to the halls list
    if (data.user.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'halls.html';
    }
  } catch (err) {
    alertBox.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}
