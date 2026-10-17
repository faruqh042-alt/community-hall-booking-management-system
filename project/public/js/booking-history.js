// js/booking-history.js - logic for booking-history.html

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  if (!requireLogin()) return;
  await loadMyBookings();
});

async function loadMyBookings() {
  const container = document.getElementById('bookingsList');
  try {
    const bookings = await apiRequest('/bookings');

    if (bookings.length === 0) {
      container.innerHTML = `<p class="text-muted">You haven't made any bookings yet.
        <a href="halls.html">Browse halls &rarr;</a></p>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrap"><table>
        <thead>
          <tr>
            <th>Hall</th>
            <th>Location</th>
            <th>Date</th>
            <th>Time Slot</th>
            <th>Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${bookings.map(b => `
            <tr>
              <td><a href="hall-details.html?id=${Number(b.hall_id)}">${escapeHtml(b.hall_name)}</a></td>
              <td>${escapeHtml(b.location)}</td>
              <td>${formatDate(b.date)}</td>
              <td>${escapeHtml(b.time_slot)}</td>
              <td>₹${Number(b.price).toLocaleString('en-IN')}</td>
              <td><span class="badge badge-${b.status}">${b.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">Could not load bookings: ${escapeHtml(err.message)}</p>`;
  }
}
