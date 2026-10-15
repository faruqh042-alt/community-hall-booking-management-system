// js/main.js - hall cards (shared) + the home page's featured halls.
// hallCardHtml() is also used by halls.js, so halls.html loads this file too.

document.addEventListener('DOMContentLoaded', async () => {
  // Only the home page has #featuredHalls. (Before, this ran on halls.html too
  // and crashed because that element does not exist there.)
  if (!document.getElementById('featuredHalls')) return;
  renderNavbar();
  await loadFeaturedHalls();
});

async function loadFeaturedHalls() {
  const container = document.getElementById('featuredHalls');
  try {
    const halls = await apiRequest('/halls');
    const featured = halls.slice(0, 3); // first 3 halls from the database

    if (featured.length === 0) {
      container.innerHTML = '<p class="text-muted">No halls available yet.</p>';
      return;
    }

    container.innerHTML = featured.map(hallCardHtml).join('');
    afterHallCardsRendered(container);
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">Could not load halls: ${escapeHtml(err.message)}</p>`;
  }
}

// Cards are injected after the page loads, so switch on their animations
// and fill in the live availability badges.
function afterHallCardsRendered(container) {
  if (typeof refreshTilt === 'function') refreshTilt(container);
  if (typeof refreshScrollReveal === 'function') refreshScrollReveal(container);
  loadAvailabilityBadges(container);
}

// Comma-separated "facilities" are shown only if the hall record has them.
function facilityList(hall) {
  return String(hall.facilities || '').split(',').map(s => s.trim()).filter(Boolean);
}

// One hall card. Everything shown comes from the database record.
// "tilt" = 3D mouse tilt, "reveal" = fade/slide in on scroll.
function hallCardHtml(hall) {
  const id = Number(hall.id);
  const src = hall.image ? escapeHtml(hall.image) : hallPlaceholder(id);
  const facilities = facilityList(hall).slice(0, 3)
    .map(f => `<span class="chip chip-violet">${escapeHtml(f)}</span>`).join('');

  return `
    <article class="card hall-card tilt reveal">
      <div class="card-media">
        <img src="${src}" alt="${escapeHtml(hall.name)}" loading="lazy"
             onerror="this.onerror=null;this.src=hallPlaceholder(${id});">
        <span class="avail-badge" data-hall-id="${id}">Checking availability…</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(hall.name)}</h3>
        <p class="card-meta">📍 ${escapeHtml(hall.location)}</p>
        <div class="chips">
          <span class="chip">👥 Up to ${Number(hall.capacity)} guests</span>
          ${facilities}
        </div>
        <p class="card-price">₹${Number(hall.price).toLocaleString('en-IN')} <small>/ booking</small></p>
        <div class="card-actions">
          <a href="booking.html?id=${id}" class="btn btn-sm">Book Now</a>
          <a href="hall-details.html?id=${id}" class="btn btn-sm btn-outline">View Details</a>
        </div>
      </div>
    </article>
  `;
}
