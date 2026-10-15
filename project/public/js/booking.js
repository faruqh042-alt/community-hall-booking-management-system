// js/booking.js - logic for booking.html
// Two-column booking page: the hall's real details (from the database) on the
// left, the booking form on the right. The user picks a date in the calendar,
// sees which time slots are taken, chooses a free one and submits. The backend
// then saves the booking and emails the owner (server/utils/mailer.js).
//
// TIME_SLOTS, hallPlaceholder() and loadAvailabilityBadges() come from auth.js.

let currentHall = null;
let selectedDate = null;
let selectedSlot = null;
let bookedSlots = [];
let datePicker = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  requireLogin(); // booking requires being logged in

  // The hall id comes from the URL (?id=...) and is sent unchanged to the API
  const hallId = new URLSearchParams(window.location.search).get('id');
  if (!hallId) {
    document.getElementById('bookingWrap').innerHTML =
      '<p class="alert alert-error">No hall selected. <a href="halls.html">Browse halls</a></p>';
    return;
  }

  await loadHall(hallId);
});

async function loadHall(id) {
  const wrap = document.getElementById('bookingWrap');
  try {
    currentHall = await apiRequest(`/halls/${id}`);
    renderBookingForm();
  } catch (err) {
    wrap.innerHTML = `<p class="alert alert-error">Could not load hall: ${escapeHtml(err.message)}</p>`;
  }
}

function renderBookingForm() {
  const wrap = document.getElementById('bookingWrap');
  const hid = Number(currentHall.id);
  const src = currentHall.image ? escapeHtml(currentHall.image) : hallPlaceholder(hid);
  const facilities = String(currentHall.facilities || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(f => `<span class="chip chip-violet">${escapeHtml(f)}</span>`).join('');

  wrap.innerHTML = `
    <a class="back-link" href="hall-details.html?id=${hid}">&larr; Back to hall details</a>

    <div class="booking-layout">
      <!-- LEFT: hall information from the database -->
      <aside class="hall-panel">
        <img class="panel-img" src="${src}" alt="${escapeHtml(currentHall.name)}"
             onerror="this.onerror=null;this.src=hallPlaceholder(${hid});">
        <div class="panel-body">
          <span class="avail-badge" data-hall-id="${hid}" style="position:static;justify-self:start;">Checking availability…</span>
          <h2>${escapeHtml(currentHall.name)}</h2>
          <p class="card-meta">📍 ${escapeHtml(currentHall.location)}</p>
          <div class="chips">
            <span class="chip">👥 Up to ${Number(currentHall.capacity)} guests</span>
            ${facilities}
          </div>
          <p class="panel-desc">${escapeHtml(currentHall.description || 'No description provided for this hall.')}</p>
          <p class="panel-price">₹${Number(currentHall.price).toLocaleString('en-IN')} <small>/ booking</small></p>
          <div class="owner-box">
            Need help booking? Call or WhatsApp the owner:
            <a href="tel:+919353916328">+91 93539 16328</a>
          </div>
        </div>
      </aside>

      <!-- RIGHT: the booking form -->
      <section class="booking-card" aria-labelledby="bookingTitle">
        <h3 id="bookingTitle">Reserve this hall</h3>
        <p class="text-muted">Pick a date, then a free time slot. The owner approves every request.</p>

        <div id="bookingAlert" role="status" aria-live="polite"></div>

        <div class="step-label"><span class="step-num">1</span><label for="dateTrigger">Choose a date</label></div>
        <div class="datepicker-wrap" id="datePickerWrap">
          <button type="button" class="date-trigger" id="dateTrigger" aria-haspopup="dialog">📅 Select a date</button>
        </div>

        <div id="slotsSection" class="hidden">
          <div class="step-label"><span class="step-num">2</span>Choose a time slot</div>
          <div id="slotList" class="slot-list" role="group" aria-label="Time slots"></div>
        </div>

        <div id="selectionSummary" class="selection-summary hidden" aria-live="polite"></div>
        <button id="confirmBtn" class="btn btn-lg btn-gradient mt-16 hidden" style="width:100%;" type="button">Confirm Booking</button>
      </section>
    </div>
  `;

  loadAvailabilityBadges(wrap);

  // The custom calendar (calendar.js) replaces the plain browser date input
  datePicker = createDatePicker({
    triggerEl: document.getElementById('dateTrigger'),
    wrapEl: document.getElementById('datePickerWrap'),
    minDate: new Date(),           // past dates are disabled
    onSelect: (isoDate) => handleDateChange(isoDate)
  });

  document.getElementById('confirmBtn').addEventListener('click', submitBooking);
}

async function handleDateChange(isoDate) {
  selectedDate = isoDate;
  selectedSlot = null;
  document.getElementById('confirmBtn').classList.add('hidden');
  updateSummary();

  if (!isoDate) return;

  const slotsSection = document.getElementById('slotsSection');
  const slotList = document.getElementById('slotList');
  slotsSection.classList.remove('hidden');
  slotList.innerHTML = '<p class="text-muted">Checking availability...</p>';

  try {
    const result = await apiRequest(`/halls/${currentHall.id}/availability?date=${isoDate}`);
    bookedSlots = result.bookedSlots || [];
    renderSlots();
  } catch (err) {
    slotList.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
  }
}

function renderSlots() {
  const slotList = document.getElementById('slotList');

  // Real <button>s so the slots work with the keyboard too
  slotList.innerHTML = TIME_SLOTS.map(slot => {
    const isBooked = bookedSlots.includes(slot);
    return `<button type="button" class="slot ${isBooked ? 'unavailable' : 'available'}"
                    data-slot="${escapeHtml(slot)}" ${isBooked ? 'aria-disabled="true"' : 'aria-pressed="false"'}>
              ${escapeHtml(slot)}${isBooked ? ' (Already booked)' : ''}
            </button>`;
  }).join('');

  // Free slots: clicking selects one
  slotList.querySelectorAll('.slot.available').forEach(el => {
    el.addEventListener('click', () => {
      slotList.querySelectorAll('.slot').forEach(s => { s.classList.remove('selected'); s.setAttribute('aria-pressed', 'false'); });
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
      selectedSlot = el.dataset.slot;
      document.getElementById('confirmBtn').classList.remove('hidden');
      updateSummary();
    });
  });

  // Taken slots: shake + a message, so the user knows why it can't be chosen
  slotList.querySelectorAll('.slot.unavailable').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.remove('shake');
      void el.offsetWidth; // restart the animation
      el.classList.add('shake');
      showToast('This hall is already booked for that time slot by someone else.', 'error');
    });
  });
}

// "Your selection: Mon, 12 Oct 2026 · 9:00 AM - 12:00 PM"
function updateSummary() {
  const box = document.getElementById('selectionSummary');
  if (!box) return;
  if (!selectedDate || !selectedSlot) { box.classList.add('hidden'); return; }
  const nice = new Date(selectedDate + 'T00:00:00')
    .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  box.textContent = `Your selection: ${nice} · ${selectedSlot}`;
  box.classList.remove('hidden');
}

async function submitBooking() {
  const alertBox = document.getElementById('bookingAlert');
  const confirmBtn = document.getElementById('confirmBtn');

  if (!selectedDate || !selectedSlot) {
    alertBox.innerHTML = '<p class="alert alert-error">Please choose a date and a time slot.</p>';
    return;
  }

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Booking...';

  try {
    await apiRequest('/book', {
      method: 'POST',
      body: JSON.stringify({ hall_id: currentHall.id, date: selectedDate, time_slot: selectedSlot })
    });

    alertBox.innerHTML = `<p class="alert alert-success">
      ✨ Booking request submitted! It is now pending owner approval.
      <a href="booking-history.html">View my bookings &rarr;</a></p>`;
    showToast('Booking request sent successfully!', 'success');

    // Refresh availability so the slot that was just booked shows as taken
    const booked = selectedDate;
    await handleDateChange(booked);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Booking';
  } catch (err) {
    // 409 = someone else grabbed the slot a moment earlier
    if (err.message && err.message.toLowerCase().includes('already booked')) {
      showToast(err.message, 'error');
      await handleDateChange(selectedDate);
    } else {
      alertBox.innerHTML = `<p class="alert alert-error">${escapeHtml(err.message)}</p>`;
    }
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Booking';
  }
}
