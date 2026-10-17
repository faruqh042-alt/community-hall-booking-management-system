/* ==========================================================================
   effects.js — interaction layer (bright theme)
   --------------------------------------------------------------------------
   Include on every page AFTER auth.js and BEFORE the page's own script:
     <script src="js/auth.js"></script>
     <script src="js/effects.js"></script>
     <script src="js/animations.js"></script>
     <script src="js/main.js"></script>

   What it does (each part detects what exists on the page, so one file
   works everywhere):
     - loader fade-out            - scroll reveal (IntersectionObserver)
     - sticky-navbar shadow       - 3D card tilt
     - button ripple + sounds     - hero particles + parallax + typing text
     - page fade between pages    - showToast() and animateCount() helpers

   The normal mouse cursor is never hidden or replaced.
   ========================================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

document.addEventListener('DOMContentLoaded', () => {
  removeLegacyCursor();
  initLoader();
  initScrollReveal();
  initNavbarScroll();
  initTiltCards();
  initButtonRipple();
  initSoundToggle();
  initHeroParticles();
  initHeroParallax();
  initTypingSubtitle();
  initSmoothPageExit();
});

/* ======================================================================
   CURSOR FIX — older versions replaced the pointer with a custom cursor.
   If any page still contains those elements, remove them so the normal
   mouse cursor is the only one.
   ====================================================================== */
function removeLegacyCursor() {
  document.querySelectorAll('#cursorDot, #cursorOutline, .cursor-trail-dot').forEach(el => el.remove());
}

/* ======================================================================
   LOADER — soft ring, hidden once the page has loaded
   ====================================================================== */
function initLoader() {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;
  const hide = () => loader.classList.add('loader-hidden');
  if (document.readyState === 'complete') setTimeout(hide, 250);
  else window.addEventListener('load', () => setTimeout(hide, 250));
  setTimeout(hide, 2500); // never trap the visitor behind the loader
}

/* ======================================================================
   SCROLL REVEAL — fade + slide up, staggered inside each parent.
   Safe to call again after injecting new cards (already-set-up elements
   are skipped).
   ====================================================================== */
let revealObserver = null;

function initScrollReveal(root) {
  const scope = root || document;
  const targets = Array.from(scope.querySelectorAll('.reveal:not([data-reveal-ready])'));
  if (targets.length === 0) return;

  // No animation wanted, or no IntersectionObserver: just show everything.
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach(el => { el.setAttribute('data-reveal-ready', '1'); el.classList.add('in-view'); });
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target); // reveal once, then stop watching
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }

  // Stagger: each element's delay is its position among its siblings
  const counters = new Map();
  targets.forEach(el => {
    el.setAttribute('data-reveal-ready', '1');
    if (el.hasAttribute('data-delay')) {
      el.style.setProperty('--delay', el.getAttribute('data-delay'));
    } else {
      const n = counters.get(el.parentElement) || 0;
      el.style.setProperty('--delay', Math.min(n, 6));
      counters.set(el.parentElement, n + 1);
    }
    revealObserver.observe(el);
  });
}

// Call after an API call injects new cards.
function refreshScrollReveal(container) { initScrollReveal(container); }

/* ======================================================================
   STICKY NAVBAR — shadow gets stronger once the page scrolls
   ====================================================================== */
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ======================================================================
   3D TILT — any element with class="tilt". Desktop only.
   The float animation uses the `translate` property, so it no longer
   overrides the `transform` we set here (that was why tilt never showed).
   ====================================================================== */
function initTiltCards(root) {
  if (isTouchDevice || prefersReducedMotion) return;
  const scope = root || document;

  scope.querySelectorAll('.tilt:not([data-tilt-ready])').forEach(card => {
    card.setAttribute('data-tilt-ready', '1');
    let frame = null;

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.12s ease-out, box-shadow 0.35s ease';
    });

    card.addEventListener('mousemove', (e) => {
      if (frame) return;                        // at most one update per frame
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 .. 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) translateY(-6px)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      card.style.transition = 'transform 0.5s ease, box-shadow 0.35s ease';
      card.style.transform = '';                // smooth reset to the stylesheet value
    });
  });
}
function refreshTilt(container) { initTiltCards(container); }

/* ======================================================================
   BUTTON RIPPLE + light haptic feedback
   ====================================================================== */
function initButtonRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    playClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    if (prefersReducedMotion) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  });

  // Hover sound (delegated, so cards added later work too)
  let lastHoverTarget = null;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.btn, .card, .slot.available');
    if (t && t !== lastHoverTarget) playHoverSound();
    lastHoverTarget = t;
  });
}

/* ======================================================================
   SOUND EFFECTS — tiny tones from the Web Audio API (no audio files).
   Off by default; the 🔈 / 🔊 button in the navbar turns them on.
   ====================================================================== */
let audioCtx = null;
let soundOn = false;
try { soundOn = localStorage.getItem('soundOn') === 'true'; } catch (e) { /* storage blocked */ }

function playTone(freq, duration, volume) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* audio can be blocked before the first click */ }
}
function playHoverSound() { playTone(700, 0.06, 0.03); }
function playClickSound() { playTone(420, 0.09, 0.05); }

// Adds the sound toggle to the navbar. renderNavbar() (auth.js) also calls
// this after it builds the menu, so the order of scripts does not matter.
function initSoundToggle() {
  const list = document.querySelector('#navbar nav ul');
  if (!list || document.getElementById('soundToggleBtn')) return;

  const li = document.createElement('li');
  li.innerHTML = `<button id="soundToggleBtn" class="icon-btn" type="button"
                    aria-label="Toggle sound effects" title="Toggle sound effects">${soundOn ? '🔊' : '🔈'}</button>`;
  list.appendChild(li);

  document.getElementById('soundToggleBtn').addEventListener('click', (e) => {
    soundOn = !soundOn;
    try { localStorage.setItem('soundOn', String(soundOn)); } catch (err) { /* ignore */ }
    e.currentTarget.textContent = soundOn ? '🔊' : '🔈';
    if (soundOn) playClickSound();
  });
}

/* ======================================================================
   HERO PARTICLES — soft pastel bubbles drifting upward (canvas).
   Different sizes/speeds give depth. No shadow blur, and the loop pauses
   when the tab is hidden or the hero is scrolled out of view.
   ====================================================================== */
function initHeroParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas || prefersReducedMotion) return;

  const ctx = canvas.getContext('2d');
  const colours = ['211,154,8', '245,200,76', '184,120,36', '217,106,67', '255,233,171'];
  const count = window.matchMedia('(max-width: 768px)').matches ? 16 : 34;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0, particles = [], rafId = null, visible = true;

  function resize() {
    w = canvas.width = canvas.offsetWidth * dpr;
    h = canvas.height = canvas.offsetHeight * dpr;
    particles = Array.from({ length: count }, () => {
      const depth = Math.random();                       // 0 = far, 1 = near
      return {
        x: Math.random() * w, y: Math.random() * h,
        r: (3 + depth * 9) * dpr,
        speed: (0.12 + depth * 0.45) * dpr,
        drift: (Math.random() - 0.5) * 0.25 * dpr,
        alpha: 0.12 + depth * 0.22,
        colour: colours[Math.floor(Math.random() * colours.length)]
      };
    });
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.y -= p.speed; p.x += p.drift;
      if (p.y < -p.r) { p.y = h + p.r; p.x = Math.random() * w; }
      if (p.x < -p.r) p.x = w + p.r; else if (p.x > w + p.r) p.x = -p.r;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.colour},${p.alpha})`;
      ctx.fill();
    }
    rafId = requestAnimationFrame(frame);
  }
  const start = () => { if (!rafId && visible && !document.hidden) rafId = requestAnimationFrame(frame); };
  const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

  resize();
  start();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 200); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  }
}

/* ======================================================================
   HERO PARALLAX — elements with data-depth drift slightly with the mouse.
   Uses the `translate` property so it composes with their float animation.
   ====================================================================== */
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  if (!hero || isTouchDevice || prefersReducedMotion) return;
  const layers = Array.from(hero.querySelectorAll('[data-depth]'));
  if (layers.length === 0) return;

  let frame = null;
  hero.addEventListener('mousemove', (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      layers.forEach(el => {
        const d = parseFloat(el.dataset.depth) || 10;
        el.style.translate = `${(px * d).toFixed(1)}px ${(py * d).toFixed(1)}px`;
      });
    });
  });
  hero.addEventListener('mouseleave', () => layers.forEach(el => { el.style.translate = ''; }));
}

/* ======================================================================
   TYPING SUBTITLE — <p id="typedSubtitle" data-text="...">
   ====================================================================== */
function initTypingSubtitle() {
  const el = document.getElementById('typedSubtitle');
  if (!el) return;
  const fullText = el.getAttribute('data-text') || el.textContent || '';
  if (prefersReducedMotion) { el.textContent = fullText; return; }

  el.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'typing-cursor';
  caret.textContent = ' ';
  let i = 0;
  (function typeNext() {
    el.textContent = fullText.slice(0, i);
    el.appendChild(caret);
    if (i++ < fullText.length) setTimeout(typeNext, 32);
  })();
}

/* ======================================================================
   TOAST — showToast('message', 'success' | 'error' | 'info')
   ====================================================================== */
function showToast(message, type = 'info', duration = 2800) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-in toast-${icons[type] ? type : 'info'}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const icon = document.createElement('span');
  icon.textContent = icons[type] || icons.info;
  const text = document.createElement('span');
  text.textContent = message;              // textContent: server messages can't inject HTML
  toast.append(icon, text);
  document.body.appendChild(toast);

  if (navigator.vibrate) navigator.vibrate(type === 'error' ? [10, 40, 10] : 8);
  setTimeout(() => {
    toast.classList.replace('toast-in', 'toast-out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/* ======================================================================
   COUNT-UP — animateCount(element, 42) eases the number up from 0.
   Used for the dashboard statistics (real values from the API).
   ====================================================================== */
function animateCount(el, target, duration = 800) {
  if (!el) return;
  target = Number(target) || 0;
  if (prefersReducedMotion || target === 0) { el.textContent = target.toLocaleString('en-IN'); return; }
  const start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);                  // ease-out
    el.textContent = Math.round(target * eased).toLocaleString('en-IN');
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

/* ======================================================================
   PAGE TRANSITIONS — fade out before following an internal page link.
   Delegated, so links created later (hall cards) also fade.
   ====================================================================== */
function initSmoothPageExit() {
  // Coming back with the browser's Back button can restore the faded-out
  // page from cache; clear the class so the page is visible again.
  window.addEventListener('pageshow', () => document.body.classList.remove('page-exit'));
  if (prefersReducedMotion) return;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;   // open-in-new-tab keys
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    const href = link.getAttribute('href');
    if (!href || /^(#|https?:|mailto:|tel:|javascript:)/i.test(href)) return;

    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 280);
  });
}
