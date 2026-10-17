// js/admin.js - logic for admin.html (the dashboard)
// Handles: sidebar tab switching, live statistics, listing / adding / editing /
// deleting halls, and listing / approving / rejecting bookings.
// All numbers come from the existing admin API routes - nothing is made up.

let adminHalls = [];      // last list of halls from GET /api/halls
let adminBookings = [];   // last list of bookings from GET /api/admin/bookings

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  if (!requireAdmin()) return; // kicks non-admins back to login.html

  setupTabs();
  setupHallForm();

  await Promise.all([loadAdminHalls(), loadAdminBookings()]);
});

// ---------------- SIDEBAR / TAB SWITCHING ----------------
function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

// Wrap a table so it can scroll sideways on phones instead of breaking the page
function tableWrap(html) { return `<div class="table-wrap">${html}</div>`; }

// =========================================================
// DASHBOARD STATISTICS (real data from the two API calls)
// =========================================================
function renderStats() {
  const count = (status) => adminBookings.filter(b => b.status === status).length;
  const values = {
    statHalls: adminHalls.length,
    statBookings: adminBookings.length,
    statPending: count('pending'),
    statApproved: count('approved'),
    statRejected: count('rejected')
  };
  Object.entries(values).forEach(([id, value]) => animateCount(document.getElementById(id), value));
  renderRecentBookings();
}

// Newest five bookings (the API already returns them newest first)
function renderRecentBookings() {
  const box = document.getElementById('recentBookings');
  if (!box) return;
  const recent = adminBookings.slice(0, 5);
  if (recent.length === 0) { box.innerHTML = '<p class="text-muted">No bookings yet.</p>'; return; }

  box.innerHTML = tableWrap(`
    <table>
      <thead><tr><th>Hall</th><th>User</th><th>Date</th><th>Time Slot</th><th>Status</th></tr></thead>
      <tbody>
        ${recent.map(b => `
          <tr>
            <td>${escapeHtml(b.hall_name)}</td>
            <td>${escapeHtml(b.user_name)}</td>
            <td>${formatDate(b.date)}</td>
            <td>${escapeHtml(b.time_slot)}</td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`);
}

// =========================================================
// HALLS MANAGEMENT
// =========================================================
async function loadAdminHalls() {
  const container = document.getElementById('adminHallsList');
  try {
    adminHalls = await apiRequest('/halls');
    renderStats();

    if (adminHalls.length === 0) {
      container.innerHTML = '<p class="text-muted">No halls added yet.</p>';
      return;
    }

    container.innerHTML = tableWrap(`
      <table>
        <thead>
          <tr><th>Name</th><th>Location</th><th>Price</th><th>Capacity</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${adminHalls.map(h => `
            <tr>
              <td>${escapeHtml(h.name)}</td>
              <td>${escapeHtml(h.location)}</td>
              <td>₹${Number(h.price).toLocaleString('en-IN')}</td>
              <td>${Number(h.capacity)}</td>
              <td>
                <button class="btn btn-sm btn-outline" data-action="edit" data-id="${Number(h.id)}" type="button">Edit</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-id="${Number(h.id)}" type="button">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`);
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">Could not load halls: ${escapeHtml(err.message)}</p>`;
  }
}

function setupHallForm() {
  document.getElementById('addHallBtn').addEventListener('click', () => {
    resetHallForm();
    document.getElementById('hallFormTitle').textContent = 'Add New Hall';
    document.getElementById('hallFormWrap').classList.remove('hidden');
  });

  document.getElementById('cancelHallFormBtn').addEventListener('click', () => {
    document.getElementById('hallFormWrap').classList.add('hidden');
  });

  document.getElementById('hallForm').addEventListener('submit', handleHallFormSubmit);

  // Edit / Delete buttons are created dynamically, so listen on the container.
  // (The old version put the whole hall object inside an inline onclick, which
  // broke whenever a hall name contained an apostrophe.)
  document.getElementById('adminHallsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit') {
      const hall = adminHalls.find(h => Number(h.id) === id);
      if (hall) editHall(hall);
    } else if (btn.dataset.action === 'delete') {
      deleteHall(id);
    }
  });
}

function resetHallForm() {
  document.getElementById('hallForm').reset();
  document.getElementById('hallId').value = '';
  document.getElementById('hallFormAlert').innerHTML = '';
}

function editHall(hall) {
  document.getElementById('hallFormTitle').textContent = 'Edit Hall';
  document.getElementById('hallId').value = hall.id;
  document.getElementById('hallName').value = hall.name;
  document.getElementById('hallLocation').value = hall.location;
  document.getElementById('hallPrice').value = hall.price;
  document.getElementById('hallCapacity').value = hall.capacity;
  document.getElementById('hallImage').value = hall.image || '';
  document.getElementById('hallDescription').value = hall.description || '';
  document.getElementById('hallFormAlert').innerHTML = '';
  const wrap = document.getElementById('hallFormWrap');
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleHallFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('hallId').value;
  const payload = {
    name: document.getElementById('hallName').value.trim(),
    location: document.getElementById('hallLocation').value.trim(),
    price: document.getElementById('hallPrice').value,
    capacity: document.getElementById('hallCapacity').value,
    image: document.getElementById('hallImage').value.trim(),
    description: document.getElementById('hallDescription').value.trim()
  };

  const alertBox = document.getElementById('hallFormAlert');
  const submitBtn = document.getElementById('hallFormSubmitBtn');
  submitBtn.disabled = true;

  try {
    if (id) {
      await apiRequest(`/admin/halls/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiRequest('/admin/halls', { method: 'POST', body: JSON.stringify(payload) });
    }
    document.getElementById('hallFormWrap').classList.add('hidden');
    showToast(id ? 'Hall updated.' : 'Hall added.', 'success');
    await loadAdminHalls();
  } catch (err) {
    alertBox.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteHall(id) {
  if (!confirm('Delete this hall? Its bookings will be deleted too. This cannot be undone.')) return;

  try {
    await apiRequest(`/admin/halls/${id}`, { method: 'DELETE' });
    showToast('Hall deleted.', 'success');
    // Bookings of a deleted hall are removed by the database (ON DELETE CASCADE)
    await Promise.all([loadAdminHalls(), loadAdminBookings()]);
  } catch (err) {
    showToast('Could not delete hall: ' + err.message, 'error');
  }
}

// =========================================================
// BOOKINGS MANAGEMENT
// =========================================================
async function loadAdminBookings() {
  const container = document.getElementById('adminBookingsList');
  try {
    adminBookings = await apiRequest('/admin/bookings');
    renderStats();

    if (adminBookings.length === 0) {
      container.innerHTML = '<p class="text-muted">No bookings yet.</p>';
      return;
    }

    container.innerHTML = tableWrap(`
      <table>
        <thead>
          <tr><th>Hall</th><th>User</th><th>Date</th><th>Time Slot</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${adminBookings.map(b => `
            <tr>
              <td>${escapeHtml(b.hall_name)}</td>
              <td>${escapeHtml(b.user_name)}<br><span class="text-muted">${escapeHtml(b.user_email)}</span></td>
              <td>${formatDate(b.date)}</td>
              <td>${escapeHtml(b.time_slot)}</td>
              <td><span class="badge badge-${b.status}">${b.status}</span></td>
              <td>
                ${b.status !== 'approved' ? `<button class="btn btn-sm btn-success" onclick="setBookingStatus(${Number(b.id)}, 'approved')" type="button">Approve</button>` : ''}
                ${b.status !== 'rejected' ? `<button class="btn btn-sm btn-danger" onclick="setBookingStatus(${Number(b.id)}, 'rejected')" type="button">Reject</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`);
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">Could not load bookings: ${escapeHtml(err.message)}</p>`;
  }
}

async function setBookingStatus(id, status) {
  try {
    await apiRequest(`/admin/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast(`Booking ${status}.`, status === 'approved' ? 'success' : 'info');
    await loadAdminBookings();
  } catch (err) {
    showToast('Could not update booking: ' + err.message, 'error');
  }
}
