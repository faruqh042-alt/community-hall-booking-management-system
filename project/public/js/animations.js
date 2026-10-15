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
    const colours = ['#2563EB', '#38BDF8', '#8B5CF6', '#FF6B6B', '#34D399'];
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
})();
