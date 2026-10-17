const managerState = { halls: [], bookings: [], page: 1, total: 0, limit: 25, calendarMonth: new Date().toISOString().slice(0, 7) };

function debounce(callback, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  bindManagerEvents();
  if (!requireLogin()) return;
  try {
    const data = await apiRequest('/manager/dashboard');
    if (getUser()?.role !== 'manager') throw new Error('This page is restricted to authorized hall managers.');
    renderManagerDashboard(data);
    await Promise.all([loadManagerBookings(), loadManagerCalendar()]);
  } catch (error) {
    managerAlert(error.message, 'error');
    if (error.status === 401 || error.status === 403) {
      window.setTimeout(() => { window.location.href = 'login.html'; }, 900);
    }
  } finally {
    document.getElementById('pageLoader')?.classList.add('loader-hidden');
  }
});

function bindManagerEvents() {
  document.getElementById('managerBookingSearch').addEventListener('input', debounce(() => {
    managerState.page = 1;
    loadManagerBookings();
  }, 250));
  document.getElementById('managerBookingStatus').addEventListener('change', () => {
    managerState.page = 1;
    loadManagerBookings();
  });
  document.getElementById('managerBookingsPager').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    managerState.page = Number(button.dataset.page);
    loadManagerBookings();
  });
  document.getElementById('managerBookingsTable').addEventListener('click', handleManagerBookingAction);
  document.getElementById('managerHalls').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-hall]');
    if (button) openManagerHallForm(Number(button.dataset.editHall));
  });
  document.getElementById('managerHallForm').addEventListener('submit', saveManagerHall);
  document.getElementById('closeManagerHallEdit').addEventListener('click', () => {
    document.getElementById('managerHallEdit').classList.add('hidden');
  });
  document.getElementById('exportManagerBookings').addEventListener('click', downloadManagerReport);
  document.getElementById('managerCalendarPrev').addEventListener('click', () => shiftCalendarMonth(-1));
  document.getElementById('managerCalendarNext').addEventListener('click', () => shiftCalendarMonth(1));
}

function renderManagerDashboard(data) {
  managerState.halls = data.halls || [];
  const stats = data.stats || {};
  Object.entries({
    managerHallsCount: stats.halls,
    managerBookingsCount: stats.bookings,
    managerPendingCount: stats.pending,
    managerApprovedCount: stats.approved,
    managerCancelledCount: stats.cancelled
  }).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) animateCount(element, Number(value) || 0);
  });
  renderManagerHalls();
  renderManagerUpcoming(data.upcoming || []);
  renderManagerActivity(data.recentActivity || []);
}

function renderManagerHalls() {
  const container = document.getElementById('managerHalls');
  if (!managerState.halls.length) {
    container.innerHTML = '<p class="text-muted">No active halls are assigned to this account yet. Ask the owner to assign a venue.</p>';
    return;
  }
  container.innerHTML = managerState.halls.map(hall => `
    <article class="manager-hall-card">
      ${hall.image ? `<img src="${escapeHtml(hall.image)}" alt="${escapeHtml(hall.name)}" loading="lazy">` : ''}
      <div class="manager-hall-card-body"><h3>${escapeHtml(hall.name)}</h3>
        <p>${escapeHtml(hall.location)} · Capacity ${Number(hall.capacity).toLocaleString()}</p>
        <p>${Number(hall.can_edit_price) ? `₹${Number(hall.price).toLocaleString('en-IN')} per booking` : 'Price management restricted'}</p>
        ${hall.facilities ? `<p>${escapeHtml(hall.facilities)}</p>` : ''}
        <button class="btn btn-outline btn-sm" type="button" data-edit-hall="${Number(hall.id)}">Edit hall details</button>
      </div>
    </article>`).join('');
}

function renderManagerUpcoming(bookings) {
  const container = document.getElementById('managerUpcoming');
  container.innerHTML = bookings.length ? `<div class="mini-list">${bookings.map(booking => `
    <div class="mini-list-item"><div><strong>${escapeHtml(booking.hall_name)} · ${escapeHtml(booking.user_name)}</strong>
      <small>${formatDate(booking.date)} · ${escapeHtml(booking.time_slot)} · ${escapeHtml(booking.location)}</small>
    </div>${managerStatusBadge(booking.status)}</div>`).join('')}</div>`
    : '<p class="text-muted">No upcoming booking requests or events.</p>';
}

function renderManagerActivity(rows) {
  const container = document.getElementById('managerActivity');
  container.innerHTML = rows.length ? `<div class="mini-list">${rows.map(row => `
    <div class="mini-list-item"><div><strong>${escapeHtml(row.user_name)} · ${escapeHtml(row.hall_name)}</strong>
      <small>${formatDateTime(row.created_at)} · ${formatDate(row.date)} · ${escapeHtml(row.time_slot)}</small>
    </div>${managerStatusBadge(row.status)}</div>`).join('')}</div>`
    : '<p class="text-muted">No booking activity has been recorded yet.</p>';
}

async function loadManagerCalendar() {
  const title = document.getElementById('managerCalendarTitle');
  title.textContent = new Date(`${managerState.calendarMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
  const container = document.getElementById('managerCalendar');
  container.innerHTML = '<p class="text-muted" role="status">Loading calendar…</p>';
  try {
    const rows = await apiRequest(`/manager/calendar?month=${encodeURIComponent(managerState.calendarMonth)}`);
    renderManagerCalendar(rows);
  } catch (error) {
    container.innerHTML = `<p class="alert alert-error">${escapeHtml(error.message)}</p>`;
  }
}

function renderManagerCalendar(bookings) {
  const container = document.getElementById('managerCalendar');
  const [year, month] = managerState.calendarMonth.split('-').map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map();
  bookings.forEach(booking => {
    const key = managerISODate(booking.date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(booking);
  });
  const headings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(day => `<span class="calendar-weekday" role="columnheader">${day}</span>`).join('');
  const blanks = Array.from({ length: firstWeekday }, () => '<span class="manager-calendar-blank" aria-hidden="true"></span>').join('');
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${managerState.calendarMonth}-${String(index + 1).padStart(2, '0')}`;
    const entries = byDate.get(date) || [];
    return `<div class="manager-calendar-day${entries.length ? ' has-events' : ''}" role="gridcell" aria-label="${date}${entries.length ? `, ${entries.length} bookings` : ''}">
      <strong>${index + 1}</strong>${entries.slice(0, 3).map(entry => `
        <span class="manager-calendar-event" title="${escapeHtml(`${entry.time_slot} · ${entry.hall_name} · ${entry.user_name}`)}">
          ${escapeHtml(entry.time_slot)} · ${escapeHtml(entry.hall_name)}
        </span>`).join('')}${entries.length > 3 ? `<small>+${entries.length - 3} more</small>` : ''}
    </div>`;
  }).join('');
  container.innerHTML = `<div class="manager-calendar-grid" role="grid" aria-label="Bookings in ${managerState.calendarMonth}">
    ${headings}${blanks}${days}</div>`;
}

function managerISODate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function shiftCalendarMonth(offset) {
  const [year, month] = managerState.calendarMonth.split('-').map(Number);
  managerState.calendarMonth = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
  loadManagerCalendar();
}

async function loadManagerBookings() {
  const params = new URLSearchParams({
    page: String(managerState.page),
    limit: String(managerState.limit)
  });
  const search = document.getElementById('managerBookingSearch').value.trim();
  const status = document.getElementById('managerBookingStatus').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const container = document.getElementById('managerBookingsTable');
  container.innerHTML = '<p class="text-muted" role="status">Loading assigned-hall bookings…</p>';
  try {
    const result = await apiRequest(`/manager/bookings?${params}`);
    managerState.bookings = result.bookings || [];
    managerState.total = Number(result.total) || 0;
    renderManagerBookings();
  } catch (error) {
    container.innerHTML = `<p class="alert alert-error">${escapeHtml(error.message)}</p>`;
  }
}

function renderManagerBookings() {
  const container = document.getElementById('managerBookingsTable');
  if (!managerState.bookings.length) {
    container.innerHTML = '<p class="text-muted">No bookings match these filters.</p>';
    renderManagerPager();
    return;
  }
  container.innerHTML = `<table class="owner-table"><thead><tr>
    <th>Guest</th><th>Hall</th><th>Date &amp; time</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>${managerState.bookings.map(booking => {
      const actions = booking.status === 'pending'
        ? '<button class="btn btn-sm" data-status="approved">Approve</button> <button class="btn btn-sm btn-danger" data-status="rejected">Reject</button>'
        : booking.status === 'approved'
          ? '<button class="btn btn-sm btn-danger" data-status="cancelled">Cancel</button>'
          : '—';
      return `<tr data-booking-id="${Number(booking.id)}">
        <td>${escapeHtml(booking.user_name)}<small class="table-secondary">${escapeHtml(booking.user_email)}</small></td>
        <td>${escapeHtml(booking.hall_name)}<small class="table-secondary">${escapeHtml(booking.location)}</small></td>
        <td>${formatDate(booking.date)}<small class="table-secondary">${escapeHtml(booking.time_slot)}</small></td>
        <td>${managerStatusBadge(booking.status)}</td><td class="table-actions">${actions}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  renderManagerPager();
}

function renderManagerPager() {
  const pages = Math.max(1, Math.ceil(managerState.total / managerState.limit));
  document.getElementById('managerBookingsPager').innerHTML = `
    <button type="button" data-page="${Math.max(1, managerState.page - 1)}" ${managerState.page <= 1 ? 'disabled' : ''}>Previous</button>
    <span>Page ${managerState.page} of ${pages} · ${managerState.total} bookings</span>
    <button type="button" data-page="${Math.min(pages, managerState.page + 1)}" ${managerState.page >= pages ? 'disabled' : ''}>Next</button>`;
}

async function handleManagerBookingAction(event) {
  const button = event.target.closest('button[data-status]');
  if (!button) return;
  const row = button.closest('[data-booking-id]');
  const booking = managerState.bookings.find(item => Number(item.id) === Number(row?.dataset.bookingId));
  if (!booking) return;
  const status = button.dataset.status;
  const verb = { approved: 'approve', rejected: 'reject', cancelled: 'cancel' }[status];
  if (!window.confirm(`Are you sure you want to ${verb} ${booking.user_name}'s booking at ${booking.hall_name}?`)) return;
  button.disabled = true;
  try {
    await apiRequest(`/manager/bookings/${booking.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    managerAlert(`Booking ${status} successfully.`, 'success');
    renderManagerDashboard(await apiRequest('/manager/dashboard'));
    await Promise.all([loadManagerBookings(), loadManagerCalendar()]);
  } catch (error) {
    button.disabled = false;
    managerAlert(error.message, 'error');
  }
}

function openManagerHallForm(hallId) {
  const hall = managerState.halls.find(item => Number(item.id) === hallId);
  if (!hall) return;
  document.getElementById('managerHallForm').reset();
  document.getElementById('managerHallId').value = hall.id;
  document.getElementById('managerHallName').value = hall.name || '';
  document.getElementById('managerHallLocation').value = hall.location || '';
  const price = document.getElementById('managerHallPrice');
  price.value = hall.price ?? '';
  price.disabled = !Number(hall.can_edit_price);
  document.getElementById('managerHallCapacity').value = hall.capacity ?? '';
  document.getElementById('managerHallImage').value = hall.image || '';
  document.getElementById('managerHallFacilities').value = hall.facilities || '';
  document.getElementById('managerHallDescription').value = hall.description || '';
  document.getElementById('managerHallEditTitle').textContent = `Edit ${hall.name}`;
  document.getElementById('managerHallAlert').textContent = '';
  const panel = document.getElementById('managerHallEdit');
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveManagerHall(event) {
  event.preventDefault();
  const id = Number(document.getElementById('managerHallId').value);
  const hall = {
    name: document.getElementById('managerHallName').value.trim(),
    location: document.getElementById('managerHallLocation').value.trim(),
    capacity: Number(document.getElementById('managerHallCapacity').value),
    image: document.getElementById('managerHallImage').value.trim(),
    facilities: document.getElementById('managerHallFacilities').value.trim(),
    description: document.getElementById('managerHallDescription').value.trim()
  };
  const price = document.getElementById('managerHallPrice');
  if (!price.disabled) hall.price = Number(price.value);
  const alert = document.getElementById('managerHallAlert');
  try {
    await apiRequest(`/manager/halls/${id}`, { method: 'PUT', body: JSON.stringify(hall) });
    document.getElementById('managerHallEdit').classList.add('hidden');
    renderManagerDashboard(await apiRequest('/manager/dashboard'));
    managerAlert('Hall information updated.', 'success');
  } catch (error) {
    alert.innerHTML = `<p class="alert alert-error">${escapeHtml(error.message)}</p>`;
  }
}

async function downloadManagerReport() {
  const button = document.getElementById('exportManagerBookings');
  button.disabled = true;
  try {
    const rows = [];
    const status = document.getElementById('managerBookingStatus').value;
    const search = document.getElementById('managerBookingSearch').value.trim();
    const pages = Math.max(1, Math.ceil(managerState.total / 100));
    for (let page = 1; page <= pages; page += 1) {
      const params = new URLSearchParams({ page: String(page), limit: '100' });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const result = await apiRequest(`/manager/bookings?${params}`);
      rows.push(...result.bookings);
      if (rows.length >= Number(result.total)) break;
    }
    const columns = ['id', 'user_name', 'user_email', 'hall_name', 'location', 'date', 'time_slot', 'status'];
    const csv = [columns.join(','), ...rows.map(row =>
      columns.map(column => managerCsvCell(row[column])).join(',')
    )].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assigned-hall-bookings.csv';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    managerAlert(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function managerCsvCell(value) {
  let text = String(value ?? '');
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function managerStatusBadge(status) {
  const value = ['pending', 'approved', 'rejected', 'cancelled'].includes(status) ? status : 'pending';
  return `<span class="badge badge-${value}">${escapeHtml(value)}</span>`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function managerAlert(message, type) {
  const alert = document.getElementById('managerAlert');
  if (!alert) return;
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
