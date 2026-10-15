// js/hall-details.js - logic for hall-details.html
// Reads the hall's ?id= from the URL and shows its full info plus a
// "Book" button that goes to booking.html?id=...

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  const hallId = new URLSearchParams(window.location.search).get('id');
  if (!hallId) {
    document.getElementById('hallDetails').innerHTML = '<p class="alert alert-error">No hall selected.</p>';
    return;
  }
  await loadHallDetails(hallId);
});

async function loadHallDetails(id) {
  const container = document.getElementById('hallDetails');
  try {
    const hall = await apiRequest(`/halls/${id}`);
    const hid = Number(hall.id);
    const src = hall.image ? escapeHtml(hall.image) : hallPlaceholder(hid);
    const facilities = String(hall.facilities || '').split(',').map(s => s.trim()).filter(Boolean)
      .map(f => `<span class="chip chip-violet">${escapeHtml(f)}</span>`).join('');

    container.innerHTML = `
      <a class="back-link" href="halls.html">&larr; Back to all halls</a>
      <div class="detail-layout">
        <img class="detail-img" src="${src}" alt="${escapeHtml(hall.name)}"
             onerror="this.onerror=null;this.src=hallPlaceholder(${hid});">
        <div class="detail-info">
          <span class="avail-badge" data-hall-id="${hid}" style="position:static;margin-bottom:14px;">Checking availability…</span>
          <h2>${escapeHtml(hall.name)}</h2>
          <p class="card-meta">📍 ${escapeHtml(hall.location)}</p>
          <div class="chips mt-16">
            <span class="chip">👥 Capacity: up to ${Number(hall.capacity)} guests</span>
            ${facilities}
          </div>
          <p class="card-price mt-16" style="font-size:1.6rem;">₹${Number(hall.price).toLocaleString('en-IN')} <small>/ booking</small></p>
          <p class="mt-16">${escapeHtml(hall.description || 'No description provided for this hall.')}</p>
          <a href="booking.html?id=${hid}" class="btn btn-lg btn-gradient mt-24">Check Availability &amp; Book</a>
        </div>
      </div>
    `;
    loadAvailabilityBadges(container);
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">Could not load hall: ${escapeHtml(err.message)}</p>`;
  }
}
