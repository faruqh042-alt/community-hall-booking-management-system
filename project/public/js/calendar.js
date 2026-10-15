/* ==========================================================================
   calendar.js — lightweight custom calendar date-picker (no libraries)
   --------------------------------------------------------------------------
   HOW TO USE:
   1. Include this file in a page's <body>, after effects.js:
        <script src="js/effects.js"></script>
        <script src="js/calendar.js"></script>   <-- add this line
        <script src="js/booking.js"></script>

   2. In your HTML, instead of <input type="date">, add a small wrapper:

        <div class="datepicker-wrap" id="datePickerWrap">
          <button type="button" class="date-trigger" id="dateTrigger">
            📅 Select a date
          </button>
        </div>

   3. In your page's JS, create the picker:

        const picker = createDatePicker({
          triggerEl: document.getElementById('dateTrigger'),
          wrapEl: document.getElementById('datePickerWrap'),
          minDate: new Date(),                 // optional — disable earlier dates
          onSelect: (isoDateString) => {
            console.log('User picked:', isoDateString); // "2026-10-05"
          }
        });

      That's it — createDatePicker() builds the whole floating calendar
      panel, handles month navigation, keyboard-free clicking, and closes
      itself when you click outside.
   ========================================================================== */

function createDatePicker({ triggerEl, wrapEl, minDate = null, onSelect }) {
  if (!triggerEl || !wrapEl) return null;

  const MONTH_NAMES = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
  const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let viewDate = new Date();      // month currently shown in the panel
  let selectedDate = null;        // Date object of the chosen day
  const min = minDate ? stripTime(minDate) : null;

  // Build the floating panel once and keep it in the DOM (hidden) so we're
  // not creating/destroying it on every open — smoother, cheaper.
  const panel = document.createElement('div');
  panel.className = 'calendar-panel';
  wrapEl.appendChild(panel);

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();        // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = stripTime(new Date());

    let cellsHtml = DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    // Empty leading cells so the 1st lines up under the correct weekday
    for (let i = 0; i < startWeekday; i++) {
      cellsHtml += `<div class="cal-day cal-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const isPast = min && cellDate < min;
      const isToday = cellDate.getTime() === today.getTime();
      const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();

      const classes = ['cal-day'];
      if (isPast) classes.push('cal-disabled');
      if (isToday) classes.push('cal-today');
      if (isSelected) classes.push('cal-selected');

      cellsHtml += `<div class="${classes.join(' ')}" data-date="${toISO(cellDate)}">${day}</div>`;
    }

    panel.innerHTML = `
      <div class="calendar-header">
        <button type="button" class="calendar-nav-btn" id="calPrevBtn">&larr;</button>
        <span class="cal-title">${MONTH_NAMES[month]} ${year}</span>
        <button type="button" class="calendar-nav-btn" id="calNextBtn">&rarr;</button>
      </div>
      <div class="calendar-grid">${cellsHtml}</div>
    `;

    panel.querySelector('#calPrevBtn').addEventListener('click', () => {
      viewDate = new Date(year, month - 1, 1);
      render();
    });
    panel.querySelector('#calNextBtn').addEventListener('click', () => {
      viewDate = new Date(year, month + 1, 1);
      render();
    });

    panel.querySelectorAll('.cal-day:not(.cal-empty):not(.cal-disabled)').forEach(cell => {
      cell.addEventListener('click', () => {
        selectedDate = stripTime(new Date(cell.dataset.date + 'T00:00:00'));
        triggerEl.textContent = '📅 ' + selectedDate.toDateString();
        render();      // redraw so the new selection highlights
        closePanel();
        if (typeof onSelect === 'function') onSelect(toISO(selectedDate));
      });
    });
  }

  function openPanel() {
    render();
    panel.classList.add('open');
    triggerEl.classList.add('active');
    document.addEventListener('click', handleOutsideClick);
  }
  function closePanel() {
    panel.classList.remove('open');
    triggerEl.classList.remove('active');
    document.removeEventListener('click', handleOutsideClick);
  }
  function handleOutsideClick(e) {
    if (!wrapEl.contains(e.target)) closePanel();
  }

  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  // Small public API in case the page needs to reset/read the picker
  return {
    getSelectedDate: () => selectedDate ? toISO(selectedDate) : null,
    reset: () => { selectedDate = null; triggerEl.textContent = '📅 Select a date'; render(); }
  };
}
