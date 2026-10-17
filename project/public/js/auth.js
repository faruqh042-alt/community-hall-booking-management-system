// js/auth.js
// Shared helper functions used by every page: talking to the API,
// storing the login token, and building the navbar.

// Because we serve the frontend from the SAME Express server (see server.js),
// we can use a relative path. If you ever run the frontend on a different
// port/server, change this to something like "http://localhost:5000/api".
const API_BASE = '/api';

// ---- Token / user storage (using localStorage) ----
function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

function isLoggedIn() {
  return !!getToken();
}

// A small wrapper around fetch() that automatically adds the JWT token
// (if we have one) to the Authorization header, and parses JSON.
async function apiRequest(path, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  if (response.status === 401 && token) clearSession();
  if (!response.ok) {
    // Throw so calling code can catch() and show data.message
    const error = new Error(data.message || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }

  return data;
}

// Builds the navbar depending on whether the visitor is logged out, a normal
// user, or an admin. Every page has <div id="navbar" class="navbar"></div>.
// New in the bright theme: logo mark, active-link indicator (the page you are
// on is highlighted) and a hamburger menu on small screens.
function renderNavbar() {
  const navbarEl = document.getElementById('navbar');
  if (!navbarEl) return;

  const user = getUser();

  // Which link is "active"? booking + hall details belong under Browse Halls.
  let page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'booking.html' || page === 'hall-details.html') page = 'halls.html';
  if (page === 'owner.html') page = 'owner.html';
  if (page === 'manager.html') page = 'manager.html';
  const linkClass = (file) => (file === page ? ' class="active" aria-current="page"' : '');

  let rightLinks = '';
  if (user) {
    rightLinks += `<li><span class="nav-user">Hi, ${escapeHtml(user.name)}</span></li>`;
    if (user.role === 'owner') {
      rightLinks += `<li><a href="owner.html"${linkClass('owner.html')}>Owner dashboard</a></li>`;
    } else if (user.role === 'manager') {
      rightLinks += `<li><a href="manager.html"${linkClass('manager.html')}>Manager dashboard</a></li>`;
    } else if (user.role === 'admin') {
      rightLinks += `<li><a href="admin.html"${linkClass('admin.html')}>Admin Dashboard</a></li>`;
    } else {
      rightLinks += `<li><a href="booking-history.html"${linkClass('booking-history.html')}>My Bookings</a></li>`;
    }
    rightLinks += `<li><button class="btn btn-outline btn-sm" id="logoutBtn" type="button">Logout</button></li>`;
  } else {
    rightLinks += `<li><a href="login.html" class="btn btn-outline btn-sm">Login</a></li>`;
    rightLinks += `<li><a href="register.html" class="btn btn-sm">Sign Up</a></li>`;
  }

  navbarEl.innerHTML = `
    <div class="container">
      <a href="index.html" class="brand" aria-label="Community Hall Booking Management System - home">
        <span class="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10 12 4l9 6"/><path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9"/><path d="M3 20h18"/>
          </svg>
        </span>
        <span class="brand-text"><strong>Community Hall</strong><small>Booking Management System</small></span>
      </a>
      <button class="nav-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mainNav">
        <span></span><span></span><span></span>
      </button>
      <nav id="mainNav" aria-label="Main">
        <ul>
          <li><a href="index.html"${linkClass('index.html')}>Home</a></li>
          <li><a href="halls.html"${linkClass('halls.html')}>Browse Halls</a></li>
          ${rightLinks}
        </ul>
      </nav>
    </div>
  `;

  initThemeToggle(navbarEl.querySelector('nav ul'));
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Mobile menu: open/close, close on link click or Escape
  const toggle = document.getElementById('navToggle');
  const setOpen = (open) => {
    navbarEl.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(!navbarEl.classList.contains('open')));
  navbarEl.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // effects.js adds the sound button once the menu exists
  if (typeof initSoundToggle === 'function') initSoundToggle();
}

function applyTheme(theme, persist = true) {
  const next = theme === 'dark' ? 'dark' : 'light';
  const changed = document.documentElement.dataset.theme !== next;
  if (persist && changed) document.documentElement.classList.add('theme-transition');
  document.documentElement.dataset.theme = next;
  if (persist && changed) {
    window.clearTimeout(applyTheme.transitionTimer);
    applyTheme.transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 240);
  }
  if (persist) {
    try { localStorage.setItem('siteTheme', next); } catch (err) { /* storage can be disabled */ }
  }
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(next === 'dark'));
    toggle.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`);
    toggle.title = `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`;
    toggle.innerHTML = next === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.6 8.6 0 1 0 20.2 15.6Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  }
}

function initThemeToggle(list) {
  if (!list || document.getElementById('themeToggle')) return;
  const item = document.createElement('li');
  item.innerHTML = '<button id="themeToggle" class="theme-toggle" type="button" aria-pressed="false"></button>';
  list.appendChild(item);
  applyTheme(document.documentElement.dataset.theme, false);
  item.querySelector('button').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// Redirects to login.html if the visitor is not logged in.
// Call this at the top of pages that require login (booking, booking-history).
function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Redirects away if the visitor is not an admin.
function requireAdmin() {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Small helper to avoid basic HTML injection when showing user-provided text.
// It also escapes quotes, because the result is used inside HTML attributes
// such as alt="..." where a stray " would break the markup.
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The fixed list of bookable time slots. It lives here (not in booking.js)
// so the hall cards can also use it to show "slots free today".
const TIME_SLOTS = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM'
];

// Today as YYYY-MM-DD in the visitor's own time zone (what the calendar uses)
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Illustrated hall picture used whenever a hall has no photo, or its photo
// file is missing. The colours rotate with the hall id so the cards look varied.
// It is a data: URI, so it can never trigger another image error (no loops).
function hallPlaceholder(seed) {
  const palettes = [
    ['#BFE3FF', '#2563EB', '#8B5CF6'],   // sky / blue / violet
    ['#E9D5FF', '#8B5CF6', '#2563EB'],   // lavender / violet / blue
    ['#FFE2D2', '#FF6B6B', '#8B5CF6'],   // peach / coral / violet
    ['#D1FAE5', '#38BDF8', '#2563EB']    // mint / sky / blue
  ];
  const [bg, main, accent] = palettes[Math.abs(Number(seed) || 0) % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>
    <rect width="400" height="250" fill="url(#g)"/>
    <circle cx="330" cy="55" r="22" fill="#FFD9B8"/>
    <ellipse cx="70" cy="48" rx="34" ry="11" fill="#fff" opacity=".9"/><ellipse cx="92" cy="40" rx="20" ry="9" fill="#fff" opacity=".9"/>
    <path d="M0 205 Q200 188 400 205 L400 250 L0 250Z" fill="#D1FAE5"/>
    <rect x="95" y="120" width="210" height="88" fill="#fff" stroke="#E2E8F0"/>
    <polygon points="82,124 200,72 318,124" fill="${main}"/>
    <rect x="88" y="124" width="224" height="9" fill="#DBEAFE"/>
    <g fill="#F8FAFC" stroke="#CBD5E1"><rect x="108" y="135" width="13" height="70"/><rect x="140" y="135" width="13" height="70"/><rect x="247" y="135" width="13" height="70"/><rect x="279" y="135" width="13" height="70"/></g>
    <path d="M180 208V160Q200 134 220 160V208Z" fill="${accent}"/>
    <rect x="165" y="208" width="70" height="6" fill="#CBD5E1"/>
    <path d="M10 40 Q200 100 390 40" fill="none" stroke="#94A3B8"/>
    <polygon points="50,58 66,63 58,80" fill="${main}"/><polygon points="100,70 116,75 108,92" fill="${accent}"/><polygon points="290,75 306,70 298,92" fill="${main}"/><polygon points="340,63 356,58 348,80" fill="${accent}"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
// Kept for older code that still refers to the single placeholder
const PLACEHOLDER_IMG = hallPlaceholder(0);

// Format "2026-09-23" style dates nicely
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------
// Live availability badges.
// Any element like <span class="avail-badge" data-hall-id="3"> is filled in
// from the REAL backend (GET /api/halls/:id/availability?date=today), counting
// how many of the TIME_SLOTS are still free today. Results are cached per
// hall + date so searching/re-rendering the list does not call the API again.
// ---------------------------------------------------------------------
const availabilityCache = new Map();

function setAvailabilityBadge(badge, bookedCount) {
  const total = TIME_SLOTS.length;
  const free = Math.max(total - bookedCount, 0);
  badge.classList.remove('avail-open', 'avail-few', 'avail-full');
  if (free === 0) {
    badge.classList.add('avail-full');
    badge.textContent = 'Fully booked today';
  } else if (free < total) {
    badge.classList.add('avail-few');
    badge.textContent = `${free} of ${total} slots free today`;
  } else {
    badge.classList.add('avail-open');
    badge.textContent = 'All slots free today';
  }
}

async function loadAvailabilityBadges(root) {
  const scope = root || document;
  const date = todayISO();
  const badges = Array.from(scope.querySelectorAll('.avail-badge[data-hall-id]'));

  await Promise.all(badges.map(async (badge) => {
    const key = `${badge.dataset.hallId}|${date}`;
    try {
      if (!availabilityCache.has(key)) {
        availabilityCache.set(key, apiRequest(`/halls/${badge.dataset.hallId}/availability?date=${date}`));
      }
      const result = await availabilityCache.get(key);
      setAvailabilityBadge(badge, (result.bookedSlots || []).length);
    } catch (err) {
      availabilityCache.delete(key);
      badge.textContent = 'Check availability';
    }
  }));
}
