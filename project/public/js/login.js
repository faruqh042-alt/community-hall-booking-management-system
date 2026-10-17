// js/login.js - logic for login.html

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();

  if (isLoggedIn()) {
    try {
      const current = await apiRequest('/me');
      saveSession(getToken(), current.user);
      window.location.href = getPostLoginDestination(current.user);
      return;
    } catch (error) {
      if (error.status === 401 || error.status === 403) clearSession();
      else {
        document.getElementById('loginAlert').innerHTML =
          `<p class="alert alert-error">${escapeHtml(error.message)} Sign in again after checking your connection.</p>`;
      }
    }
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

    window.location.href = getPostLoginDestination(data.user);
  } catch (err) {
    alertBox.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

function getPostLoginDestination(user) {
  if (user && user.role === 'owner' && user.email.toLowerCase() === 'faruqh042@gmail.com') return 'owner.html';
  if (user && user.role === 'manager') return 'manager.html';
  if (user && user.role === 'admin') return 'admin.html';

  const requested = new URLSearchParams(window.location.search).get('redirect');
  const bookingMatch = requested && requested.match(/^booking\.html\?id=([1-9]\d*)$/);
  if (bookingMatch && Number.isSafeInteger(Number(bookingMatch[1]))) {
    return `booking.html?id=${encodeURIComponent(bookingMatch[1])}`;
  }

  return 'halls.html';
}
