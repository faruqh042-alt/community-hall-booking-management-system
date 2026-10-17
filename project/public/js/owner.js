const ownerState = {
  halls: [],
  bookings: [],
  users: [],
  userPage: 1,
  bookingPage: 1,
  selectedManagerId: null
};
const OWNER_PAGE_SIZE = 25;

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  setupOwnerTabs();
  setupOwnerEvents();
  try {
    const dashboard = await apiRequest('/owner/dashboard');
    if (getUser()?.role !== 'owner' || getUser()?.email?.toLowerCase() !== 'faruqh042@gmail.com') {
      throw new Error('This page is restricted to the verified owner account.');
    }
    renderOwnerDashboard(dashboard);
    await Promise.all([loadOwnerUsers(), loadOwnerHalls(), loadOwnerBookings()]);
  } catch (err) {
    showOwnerAlert(err.message, 'error');
    if (err.status === 401 || err.status === 403) {
      window.setTimeout(() => { window.location.href = 'login.html'; }, 900);
    }
  }
});

function setupOwnerTabs() {
  document.querySelectorAll('.owner-layout .tab-btn[data-tab]').forEach(button => {
    button.addEventListener('click', () => activateOwnerTab(button.dataset.tab));
  });
  document.querySelectorAll('[data-open-tab]').forEach(button => {
    button.addEventListener('click', () => activateOwnerTab(button.dataset.openTab));
  });
}

function activateOwnerTab(tabId) {
  if (!document.getElementById(tabId)) return;
  document.querySelectorAll('.owner-layout .tab-btn[data-tab]').forEach(button => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('.owner-layout .tab-content').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

function setupOwnerEvents() {
  document.getElementById('ownerUserSearch').addEventListener('input', debounce(() => {
    ownerState.userPage = 1;
    loadOwnerUsers();
  }, 250));
  document.getElementById('ownerUserRole').addEventListener('change', () => { ownerState.userPage = 1; loadOwnerUsers(); });
  document.getElementById('ownerUserActive').addEventListener('change', () => { ownerState.userPage = 1; loadOwnerUsers(); });
  document.getElementById('ownerHallSearch').addEventListener('input', renderOwnerHalls);
  document.getElementById('ownerHallActive').addEventListener('change', renderOwnerHalls);
  document.getElementById('ownerBookingSearch').addEventListener('input', debounce(() => {
    ownerState.bookingPage = 1;
    loadOwnerBookings();
  }, 250));
  document.getElementById('ownerBookingStatus').addEventListener('change', () => { ownerState.bookingPage = 1; loadOwnerBookings(); });
  document.getElementById('ownerUsersPager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) { ownerState.userPage = Number(button.dataset.page); loadOwnerUsers(); }
  });
  document.getElementById('ownerBookingsPager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) { ownerState.bookingPage = Number(button.dataset.page); loadOwnerBookings(); }
  });
  document.getElementById('ownerUsersTable').addEventListener('change', handleOwnerUserChange);
  document.getElementById('ownerUsersTable').addEventListener('click', handleOwnerUserAction);
  document.getElementById('ownerHallsTable').addEventListener('click', handleOwnerHallAction);
  document.getElementById('ownerBookingsTable').addEventListener('click', handleOwnerBookingAction);

  document.getElementById('newHallButton').addEventListener('click', () => showOwnerHallForm());
  document.getElementById('cancelHallEdit').addEventListener('click', hideOwnerHallForm);
  document.getElementById('ownerHallForm').addEventListener('submit', saveOwnerHall);
  document.getElementById('closeAssignments').addEventListener('click', hideManagerAssignments);
  document.getElementById('saveAssignments').addEventListener('click', saveManagerAssignments);
  document.getElementById('downloadBookings').addEventListener('click', downloadOwnerBookings);
}

function renderOwnerDashboard(data) {
  const stats = data.stats;
  const values = {
    ownerUsersCount: stats.users,
    ownerManagersCount: stats.managers,
    ownerHallsCount: stats.activeHalls,
    ownerBookingsCount: stats.bookings,
    ownerPendingCount: stats.pending,
    ownerApprovedCount: stats.approved,
    ownerClosedCount: stats.rejected + stats.cancelled
  };
  Object.entries(values).forEach(([id, value]) => animateCount(document.getElementById(id), value));
  document.getElementById('ownerRevenue').textContent = stats.revenue.available
    ? `₹${Number(stats.revenue.total).toLocaleString('en-IN')}`
    : 'Not recorded';
  document.getElementById('ownerRevenueNote').textContent =
    stats.revenue.reason || 'Revenue data is unavailable.';
  renderOwnerChart(data.monthlyBookings);
  renderHallPerformance(data.hallPerformance);
  renderRecentOwnerBookings(data.recentBookings);
  renderRecentUsers(data.recentUsers);
  renderOwnerActivity(data.recentActivity || []);

  const notice = document.getElementById('ownerAlert');
  notice.className = 'alert alert-info';
  notice.textContent = stats.pending
    ? `${stats.pending} booking request${stats.pending === 1 ? '' : 's'} waiting for review. Database connection verified.`
    : 'Database connection verified. There are no pending booking requests.';
}

function renderOwnerActivity(events) {
  const box = document.getElementById('ownerRecentActivity');
  if (!events.length) {
    box.innerHTML = '<p class="text-muted">No management actions have been recorded yet.</p>';
    return;
  }
  box.innerHTML = `<div class="mini-list">${events.map(event => {
    let details = {};
    try {
      details = typeof event.details === 'string' ? JSON.parse(event.details || '{}') : event.details || {};
    } catch (err) {
      details = {};
    }
    const target = event.entity_type === 'user' && event.entity_id
      ? `account #${Number(event.entity_id)}`
      : event.entity_type === 'hall' && event.entity_id
        ? `hall #${Number(event.entity_id)}`
        : event.entity_type === 'booking' && event.entity_id
          ? `booking #${Number(event.entity_id)}`
          : event.entity_type;
    const action = String(event.action || '').replace(/[._]/g, ' ');
    const extra = details.role ? ` · ${escapeHtml(details.role)}` : '';
    return `<div class="mini-list-item"><div><strong>${escapeHtml(event.actor_name || 'Former account')} ${escapeHtml(action)} ${escapeHtml(target)}${extra}</strong>
      <small>${formatDateTime(event.created_at)}</small></div></div>`;
  }).join('')}</div>`;
}

function renderOwnerChart(rows) {
  const chart = document.getElementById('ownerChart');
  if (!rows.length) {
    chart.innerHTML = '<p class="text-muted">There are no booking records in this period.</p>';
    return;
  }
  const maximum = Math.max(...rows.map(row => Number(row.total)), 1);
  chart.innerHTML = rows.map(row => {
    const height = Math.max(Number(row.total) / maximum * 100, 4);
    return `<div class="chart-column" title="${escapeHtml(row.month)}: ${Number(row.total)} bookings">
      <strong>${Number(row.total)}</strong><div class="chart-bar-track"><div class="chart-bar" style="height:${height}%"></div></div>
      <span>${escapeHtml(formatMonth(row.month))}</span></div>`;
  }).join('');
}

function renderHallPerformance(halls) {
  const container = document.getElementById('ownerHallPerformance');
  if (!halls.length) {
    container.innerHTML = '<p class="text-muted">No halls have been added.</p>';
    return;
  }
  container.innerHTML = `<div class="mini-list">${halls.map(hall => `
    <div class="mini-list-item"><div><strong>${escapeHtml(hall.name)}</strong>
      <small>${escapeHtml(hall.location)} · ${Number(hall.approved_bookings) || 0} approved · ${Number(hall.pending_bookings) || 0} pending</small>
    </div><span class="badge ${Number(hall.is_active) ? 'badge-approved' : 'badge-cancelled'}">${Number(hall.bookings) || 0} bookings</span></div>
  `).join('')}</div>`;
}

function renderRecentOwnerBookings(bookings) {
  const box = document.getElementById('ownerRecentBookings');
  if (!bookings.length) {
    box.innerHTML = '<p class="text-muted">No reservations have been made yet.</p>';
    return;
  }
  box.innerHTML = `<div class="mini-list">${bookings.map(booking => `
    <div class="mini-list-item"><div><strong>${escapeHtml(booking.hall_name)} · ${escapeHtml(booking.user_name)}</strong>
      <small>${formatDate(booking.date)} · ${escapeHtml(booking.time_slot)}</small>
    </div>${statusBadge(booking.status)}</div>
  `).join('')}</div>`;
}

function renderRecentUsers(users) {
  const box = document.getElementById('ownerRecentUsers');
  if (!users.length) {
    box.innerHTML = '<p class="text-muted">No user accounts have registered yet.</p>';
    return;
  }
  box.innerHTML = `<div class="mini-list">${users.map(user => `
    <div class="mini-list-item"><div><strong>${escapeHtml(user.name)}</strong>
      <small>${escapeHtml(user.email)} · ${formatDateTime(user.created_at)}</small>
    </div><span class="badge ${user.is_active ? 'badge-approved' : 'badge-cancelled'}">${escapeHtml(user.role)}</span></div>
  `).join('')}</div>`;
}

async function loadOwnerUsers() {
  const params = new URLSearchParams({
    page: String(ownerState.userPage),
    limit: String(OWNER_PAGE_SIZE),
    search: document.getElementById('ownerUserSearch').value.trim(),
    role: document.getElementById('ownerUserRole').value,
    active: document.getElementById('ownerUserActive').value
  });
  try {
    const result = await apiRequest(`/owner/users?${params}`);
    ownerState.users = result.users;
    renderOwnerUsers(result);
  } catch (err) {
    document.getElementById('ownerUsersTable').innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderOwnerUsers(result) {
  const box = document.getElementById('ownerUsersTable');
  if (!result.users.length) {
    box.innerHTML = '<p class="text-muted">No accounts match these filters.</p>';
    renderPager('ownerUsersPager', result.page, result.total, 'users');
    return;
  }
  box.innerHTML = `<table class="owner-table"><thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Registered</th><th>Manager access</th><th>Actions</th></tr></thead><tbody>
    ${result.users.map(user => `<tr data-user-id="${Number(user.id)}">
      <td><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td>
      <td><select class="inline-select" data-action="role" aria-label="Role for ${escapeHtml(user.name)}">
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option></select></td>
      <td><span class="badge ${user.is_active ? 'badge-approved' : 'badge-cancelled'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${formatDateTime(user.created_at)}</td>
      <td>${user.role === 'manager' ? `<button class="btn btn-sm btn-outline" data-action="assign">Assign halls</button>` : '—'}</td>
      <td><button class="btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}" data-action="active" data-active="${user.is_active ? 'false' : 'true'}">${user.is_active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`).join('')}
  </tbody></table>`;
  renderPager('ownerUsersPager', result.page, result.total, 'users');
}

function renderPager(elementId, page, total, type) {
  const pages = Math.max(1, Math.ceil(total / OWNER_PAGE_SIZE));
  document.getElementById(elementId).innerHTML = `
    <button type="button" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span>Page ${page} of ${pages} · ${total} records</span>
    <button type="button" data-page="${Math.min(pages, page + 1)}" ${page >= pages ? 'disabled' : ''}>Next</button>`;
}

async function handleOwnerUserChange(event) {
  const select = event.target.closest('select[data-action="role"]');
  if (!select) return;
  const row = select.closest('[data-user-id]');
  const user = ownerState.users.find(item => item.id === Number(row.dataset.userId));
  if (!user || select.value === user.role) return;
  if (!window.confirm(`Change ${user.name}'s role from ${user.role} to ${select.value}?`)) {
    select.value = user.role;
    return;
  }
  try {
    await apiRequest(`/owner/users/${user.id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: select.value })
    });
    showOwnerAlert(`${user.name} is now a ${select.value}.`, 'success');
    await Promise.all([loadOwnerUsers(), refreshOwnerDashboard()]);
  } catch (err) {
    select.value = user.role;
    showOwnerAlert(err.message, 'error');
  }
}

async function handleOwnerUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const userId = Number(button.closest('[data-user-id]').dataset.userId);
  const user = ownerState.users.find(item => item.id === userId);
  if (!user) return;
  if (button.dataset.action === 'assign') {
    showManagerAssignments(user);
    return;
  }
  if (button.dataset.action === 'active') {
    const active = button.dataset.active === 'true';
    if (!window.confirm(`${active ? 'Activate' : 'Deactivate'} ${user.name}'s account?`)) return;
    try {
      await apiRequest(`/owner/users/${userId}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active })
      });
      await Promise.all([loadOwnerUsers(), refreshOwnerDashboard()]);
    } catch (err) {
      showOwnerAlert(err.message, 'error');
    }
  }
}

async function showManagerAssignments(manager) {
  ownerState.selectedManagerId = manager.id;
  document.getElementById('assignmentTitle').textContent = `Assign halls · ${manager.name}`;
  const [halls, dashboard] = await Promise.all([
    apiRequest('/owner/halls'),
    apiRequest(`/owner/managers/${manager.id}/halls`)
  ]);
  ownerState.halls = halls;
  const assigned = new Map(dashboard.map(row => [Number(row.hall_id), Number(row.can_edit_price) === 1]));
  const container = document.getElementById('assignmentChoices');
  const activeHalls = halls.filter(hall => hall.is_active);
  container.innerHTML = activeHalls.length
    ? activeHalls.map(hall => `<div class="assignment-choice">
        <label><input type="checkbox" data-assigned-hall="${Number(hall.id)}" ${assigned.has(Number(hall.id)) ? 'checked' : ''}>
          <span>${escapeHtml(hall.name)}<small>${escapeHtml(hall.location)}</small></span></label>
        <label><input type="checkbox" data-edit-price="${Number(hall.id)}" ${assigned.get(Number(hall.id)) ? 'checked' : ''}>
          <span>Edit price</span></label>
      </div>`).join('')
    : '<p class="text-muted">There are no active halls to assign.</p>';
  document.getElementById('managerAssignments').classList.remove('hidden');
  document.getElementById('managerAssignments').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideManagerAssignments() {
  document.getElementById('managerAssignments').classList.add('hidden');
  ownerState.selectedManagerId = null;
}

async function saveManagerAssignments() {
  if (!ownerState.selectedManagerId) return;
  const halls = Array.from(document.querySelectorAll('[data-assigned-hall]:checked')).map(input => {
    const id = Number(input.dataset.assignedHall);
    return {
      id,
      canEditPrice: Boolean(document.querySelector(`[data-edit-price="${id}"]`)?.checked)
    };
  });
  try {
    await apiRequest(`/owner/managers/${ownerState.selectedManagerId}/halls`, {
      method: 'PUT',
      body: JSON.stringify({ halls })
    });
    showOwnerAlert('Manager hall access updated.', 'success');
    hideManagerAssignments();
  } catch (err) {
    showOwnerAlert(err.message, 'error');
  }
}

async function loadOwnerHalls() {
  try {
    ownerState.halls = await apiRequest('/owner/halls');
    renderOwnerHalls();
  } catch (err) {
    document.getElementById('ownerHallsTable').innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderOwnerHalls() {
  const query = document.getElementById('ownerHallSearch').value.trim().toLowerCase();
  const active = document.getElementById('ownerHallActive').value;
  const halls = ownerState.halls.filter(hall =>
    (!query || `${hall.name} ${hall.location}`.toLowerCase().includes(query)) &&
    (active === '' || String(Boolean(hall.is_active)) === active)
  );
  const box = document.getElementById('ownerHallsTable');
  if (!halls.length) {
    box.innerHTML = '<p class="text-muted">No halls match these filters.</p>';
    return;
  }
  box.innerHTML = `<table class="owner-table"><thead><tr><th>Hall</th><th>Location</th><th>Price</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${halls.map(hall => `<tr data-hall-id="${Number(hall.id)}">
      <td>${escapeHtml(hall.name)}</td><td>${escapeHtml(hall.location)}</td>
      <td>₹${Number(hall.price).toLocaleString('en-IN')}</td><td>${Number(hall.capacity)}</td>
      <td>${Number(hall.is_active) ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
      <td><button class="btn btn-sm btn-outline" data-action="edit">Edit</button>
      <button class="btn btn-sm ${Number(hall.is_active) ? 'btn-danger' : 'btn-success'}" data-action="active">${Number(hall.is_active) ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`).join('')}
  </tbody></table>`;
}

function handleOwnerHallAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const hall = ownerState.halls.find(item => item.id === Number(button.closest('[data-hall-id]').dataset.hallId));
  if (!hall) return;
  if (button.dataset.action === 'edit') {
    showOwnerHallForm(hall);
    return;
  }
  const active = !Boolean(hall.is_active);
  if (!window.confirm(`${active ? 'Activate' : 'Deactivate'} ${hall.name}? Existing booking history will be preserved.`)) return;
  apiRequest(`/owner/halls/${hall.id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active })
  }).then(loadOwnerHalls).catch(err => showOwnerAlert(err.message, 'error'));
}

function showOwnerHallForm(hall) {
  const form = document.getElementById('ownerHallForm');
  form.reset();
  document.getElementById('ownerHallFormAlert').textContent = '';
  document.getElementById('ownerHallId').value = hall?.id || '';
  document.getElementById('ownerHallName').value = hall?.name || '';
  document.getElementById('ownerHallLocation').value = hall?.location || '';
  document.getElementById('ownerHallPrice').value = hall?.price ?? '';
  document.getElementById('ownerHallCapacity').value = hall?.capacity ?? '';
  document.getElementById('ownerHallImage').value = hall?.image || '';
  document.getElementById('ownerHallFacilities').value = hall?.facilities || '';
  document.getElementById('ownerHallDescription').value = hall?.description || '';
  document.getElementById('ownerHallFormTitle').textContent = hall ? `Edit ${hall.name}` : 'Add a hall';
  document.getElementById('ownerHallFormPanel').classList.remove('hidden');
  document.getElementById('ownerHallFormPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideOwnerHallForm() {
  document.getElementById('ownerHallFormPanel').classList.add('hidden');
}

async function saveOwnerHall(event) {
  event.preventDefault();
  const id = document.getElementById('ownerHallId').value;
  const hall = {
    name: document.getElementById('ownerHallName').value.trim(),
    location: document.getElementById('ownerHallLocation').value.trim(),
    price: Number(document.getElementById('ownerHallPrice').value),
    capacity: Number(document.getElementById('ownerHallCapacity').value),
    image: document.getElementById('ownerHallImage').value.trim(),
    facilities: document.getElementById('ownerHallFacilities').value.trim(),
    description: document.getElementById('ownerHallDescription').value.trim()
  };
  try {
    await apiRequest(id ? `/owner/halls/${Number(id)}` : '/owner/halls', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(hall)
    });
    hideOwnerHallForm();
    await Promise.all([loadOwnerHalls(), refreshOwnerDashboard()]);
    showOwnerAlert(id ? 'Hall updated.' : 'Hall created.', 'success');
  } catch (err) {
    document.getElementById('ownerHallFormAlert').innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadOwnerBookings() {
  const params = new URLSearchParams({
    page: String(ownerState.bookingPage),
    limit: String(OWNER_PAGE_SIZE),
    search: document.getElementById('ownerBookingSearch').value.trim(),
    status: document.getElementById('ownerBookingStatus').value
  });
  try {
    const result = await apiRequest(`/owner/bookings?${params}`);
    ownerState.bookings = result.bookings;
    renderOwnerBookings(result);
  } catch (err) {
    document.getElementById('ownerBookingsTable').innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderOwnerBookings(result) {
  const box = document.getElementById('ownerBookingsTable');
  if (!result.bookings.length) {
    box.innerHTML = '<p class="text-muted">No bookings match these filters.</p>';
    renderPager('ownerBookingsPager', result.page, result.total, 'bookings');
    return;
  }
  box.innerHTML = `<table class="owner-table"><thead><tr><th>Hall / guest</th><th>Date &amp; time</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${result.bookings.map(booking => `<tr data-booking-id="${Number(booking.id)}">
      <td><strong>${escapeHtml(booking.hall_name)}</strong><small>${escapeHtml(booking.user_name)} · ${escapeHtml(booking.user_email)}</small></td>
      <td>${formatDate(booking.date)}<small>${escapeHtml(booking.time_slot)}</small></td>
      <td>₹${Number(booking.price).toLocaleString('en-IN')}</td>
      <td>${statusBadge(booking.status)}</td>
      <td>${booking.status === 'pending' ? `<button class="btn btn-sm btn-success" data-status="approved">Approve</button><button class="btn btn-sm btn-danger" data-status="rejected">Reject</button>` : ''}
      ${booking.status === 'approved' || booking.status === 'pending' ? '<button class="btn btn-sm btn-outline" data-status="cancelled">Cancel</button>' : '—'}</td>
    </tr>`).join('')}
  </tbody></table>`;
  renderPager('ownerBookingsPager', result.page, result.total, 'bookings');
}

async function handleOwnerBookingAction(event) {
  const button = event.target.closest('button[data-status]');
  if (!button) return;
  const row = button.closest('[data-booking-id]');
  const booking = ownerState.bookings.find(item => item.id === Number(row.dataset.bookingId));
  if (!booking) return;
  const next = button.dataset.status;
  if (!window.confirm(`${next[0].toUpperCase()}${next.slice(1)} booking for ${booking.hall_name}?`)) return;
  try {
    await apiRequest(`/owner/bookings/${booking.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: next })
    });
    await Promise.all([loadOwnerBookings(), refreshOwnerDashboard()]);
  } catch (err) {
    showOwnerAlert(err.message, 'error');
  }
}

async function downloadOwnerBookings() {
  try {
    const firstPage = await apiRequest('/owner/bookings?page=1&limit=100');
    const bookings = [...firstPage.bookings];
    const pageCount = Math.ceil(firstPage.total / firstPage.limit);
    for (let page = 2; page <= pageCount; page += 1) {
      const result = await apiRequest(`/owner/bookings?page=${page}&limit=100`);
      bookings.push(...result.bookings);
    }
    const headings = ['Booking ID', 'Hall', 'Location', 'Guest', 'Email', 'Date', 'Time slot', 'Price', 'Status'];
    const rows = bookings.map(booking => [
      booking.id, booking.hall_name, booking.location, booking.user_name, booking.user_email,
      formatDate(booking.date), booking.time_slot, booking.price, booking.status
    ]);
    const csv = [headings, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'community-hall-bookings.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showOwnerAlert(err.message, 'error');
  }
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function refreshOwnerDashboard() {
  const dashboard = await apiRequest('/owner/dashboard');
  renderOwnerDashboard(dashboard);
}

function statusBadge(status) {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}
function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function formatMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : date.toLocaleDateString('en-IN', { month: 'short' });
}
function showOwnerAlert(message, type) {
  const alert = document.getElementById('ownerAlert');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  if (type === 'success') window.setTimeout(() => { alert.textContent = ''; alert.className = ''; }, 3500);
}
function debounce(callback, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}
