/* ==========================================================================
   animations.js — extra visual effects (bright theme, vanilla JS)
   --------------------------------------------------------------------------
   Include AFTER effects.js on every page:
     <script src="js/effects.js"></script>
     <script src="js/animations.js"></script>

   - floating pastel shapes + soft gradient blobs behind every page
   - scroll progress bar
   - card spotlight (a soft light that follows the mouse across a card)
   - small pastel spark burst when something is clicked
   The mouse cursor itself is never changed.
   ========================================================================== */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  document.addEventListener('DOMContentLoaded', () => {
    injectBackgroundShapes();
    initScrollProgress();
    if (!isTouch) initCardSpotlight();
    initClickBurst();
    initPanda();
  });

  /* ---- Floating shapes + blobs (styled in animations.css) ---- */
  function injectBackgroundShapes() {
    if (document.querySelector('.bg-shapes')) return;
    const layer = document.createElement('div');
    layer.className = 'bg-shapes';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
      <div class="blob"></div><div class="blob"></div><div class="blob"></div>
      <div class="shape circle s1"></div>
      <div class="shape ring s2"></div>
      <div class="shape circle s3"></div>
      <div class="shape square s4"></div>
      <div class="shape plus s5"></div>
      <div class="shape circle s6"></div>`;
    document.body.prepend(layer);
  }

  /* ---- Scroll progress bar ---- */
  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.id = 'scrollProgress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }   // one update per frame
    }, { passive: true });
    update();
  }

  /* ---- Card spotlight: tell the CSS where the mouse is inside the card ---- */
  function initCardSpotlight() {
    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
    });
  }

  /* ---- Click burst: a few pastel sparks fly out from the click ---- */
  function initClickBurst() {
    if (reduceMotion) return;
    const colours = ['#D39A08', '#F5C84C', '#B87824', '#D96A43', '#F5DEBE'];
    document.addEventListener('click', (e) => {
      const count = 9;
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = 'burst-spark';
        spark.style.left = e.clientX + 'px';
        spark.style.top = e.clientY + 'px';
        spark.style.background = colours[i % colours.length];
        document.body.appendChild(spark);

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const dist = 30 + Math.random() * 40;
        // Web Animations API runs on the compositor — no CSS keyframes needed
        const anim = spark.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`, opacity: 0 }
        ], { duration: 550 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
        anim.onfinish = () => spark.remove();
      }
    });
  }

  function initPanda() {
    const panda = document.createElement('div');
    panda.className = 'panda-companion';
    panda.setAttribute('aria-hidden', 'true');
    panda.innerHTML = `
      <svg class="panda-art" viewBox="0 0 100 90" focusable="false">
        <ellipse class="panda-ear" cx="22" cy="20" rx="14" ry="15"/>
        <ellipse class="panda-ear" cx="78" cy="20" rx="14" ry="15"/>
        <ellipse class="panda-face" cx="50" cy="49" rx="38" ry="34"/>
        <ellipse class="panda-patch" cx="36" cy="44" rx="10" ry="13" transform="rotate(20 36 44)"/>
        <ellipse class="panda-patch" cx="64" cy="44" rx="10" ry="13" transform="rotate(-20 64 44)"/>
        <g class="panda-eye" transform="translate(36 43)">
          <circle class="panda-eye-white" r="5.2"/>
          <g class="panda-pupil" data-pupil><circle r="2.7"/></g>
          <ellipse class="panda-blink" cy="0" rx="5.5" ry="5.8"/>
        </g>
        <g class="panda-eye" transform="translate(64 43)">
          <circle class="panda-eye-white" r="5.2"/>
          <g class="panda-pupil" data-pupil><circle r="2.7"/></g>
          <ellipse class="panda-blink" cy="0" rx="5.5" ry="5.8"/>
        </g>
        <ellipse class="panda-cheek" cx="27" cy="58" rx="5" ry="2.7"/>
        <ellipse class="panda-cheek" cx="73" cy="58" rx="5" ry="2.7"/>
        <path class="panda-nose" d="M45 54 Q50 50 55 54 Q55 59 50 60 Q45 59 45 54Z"/>
        <path class="panda-mouth" d="M50 59 Q46 65 42 62 M50 59 Q54 65 58 62"/>
      </svg>`;
    document.body.appendChild(panda);

    if (isTouch || reduceMotion || !('PointerEvent' in window)) return;
    const pupils = panda.querySelectorAll('[data-pupil]');
    const point = { x: innerWidth / 2, y: innerHeight / 2 };
    const gaze = { x: 0, y: 0 };
    let frame = 0;
    let idleTimer = 0;

    function trackPointer(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      point.x = event.clientX;
      point.y = event.clientY;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        point.x = innerWidth / 2;
        point.y = innerHeight / 2;
        requestFrame();
      }, 2200);
      requestFrame();
    }

    function requestFrame() {
      if (!frame) frame = requestAnimationFrame(animate);
    }

    function animate() {
      frame = 0;
      const rect = panda.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const targetX = dx / distance * Math.min(2.4, distance / 95);
      const targetY = dy / distance * Math.min(2.4, distance / 95);
      gaze.x += (targetX - gaze.x) * 0.22;
      gaze.y += (targetY - gaze.y) * 0.22;
      const lookingX = Math.max(-7, Math.min(7, dx / Math.max(innerWidth / 2, 1) * 7));
      const lookingY = Math.max(-6, Math.min(6, dy / Math.max(innerHeight / 2, 1) * -6));
      panda.querySelector('.panda-art').style.transform =
        `rotateX(${lookingY.toFixed(2)}deg) rotateY(${lookingX.toFixed(2)}deg)`;
      pupils.forEach(pupil => {
        pupil.setAttribute('transform', `translate(${gaze.x.toFixed(2)} ${gaze.y.toFixed(2)})`);
      });

      if (Math.abs(targetX - gaze.x) > 0.04 || Math.abs(targetY - gaze.y) > 0.04) requestFrame();
    }

    function clearTracking() {
      window.removeEventListener('pointermove', trackPointer);
      window.clearTimeout(idleTimer);
      if (frame) cancelAnimationFrame(frame);
    }

    window.addEventListener('pointermove', trackPointer, { passive: true });
    window.addEventListener('pagehide', clearTracking, { once: true });
    document.addEventListener('pointerover', (event) => {
      if (event.target.closest('a, button, input, select, textarea')) panda.classList.add('is-curious');
    });
    document.addEventListener('pointerout', (event) => {
      if (event.target.closest('a, button, input, select, textarea') &&
          !event.relatedTarget?.closest?.('a, button, input, select, textarea')) {
        panda.classList.remove('is-curious');
      }
    });
  }
})();
