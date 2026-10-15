// js/halls.js - logic for halls.html (browse + search all halls)

let allHalls = []; // keep a copy in memory so search filtering doesn't need new API calls

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('halls');
  await loadAllHalls();

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    filterAndRenderHalls(e.target.value);
  });
});

async function loadAllHalls() {
  const grid = document.getElementById('hallsGrid');
  try {
    allHalls = await apiRequest('/halls');
    filterAndRenderHalls('');
  } catch (err) {
    grid.innerHTML = `<p class="alert alert-error">Could not load halls: ${escapeHtml(err.message)}</p>`;
  }
}

function filterAndRenderHalls(query) {
  const grid = document.getElementById('hallsGrid');
  const q = query.trim().toLowerCase();

  const filtered = q
    ? allHalls.filter(h =>
        h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q))
    : allHalls;

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="text-muted">No halls match your search.</p>';
    return;
  }

  grid.innerHTML = filtered.map(hallCardHtml).join('');

  // Switch on tilt / reveal and fill in the live availability badges
  afterHallCardsRendered(grid);
}
