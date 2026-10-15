// js/register.js - logic for register.html

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();

  if (isLoggedIn()) {
    window.location.href = 'halls.html';
    return;
  }

  document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const alertBox = document.getElementById('registerAlert');
  const btn = document.getElementById('registerBtn');

  alertBox.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    alertBox.innerHTML = `<p class="alert alert-success">Account created! Redirecting to login...</p>`;
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  } catch (err) {
    alertBox.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  }
}
