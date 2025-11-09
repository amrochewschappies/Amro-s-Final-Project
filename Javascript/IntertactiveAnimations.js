// ===== Snap-to-section scrolling (desktop + mobile) =====
const sections = [...document.querySelectorAll(".lock-section")];

// Scrolling root / helpers
const ROOT = document.scrollingElement || document.documentElement;
const getY = () => ROOT.scrollTop || window.pageYOffset || 0;
const setY = (y) => window.scrollTo(0, y);

// Config
const TOLERANCE = 50;
const SNAP_AFTER_IDLE_MS = 140;   // snap to nearest after natural scrolling stops
const ANIM_DONE_GRACE_MS = 800;   // extra time before we allow another snap
const FIRST_SECTION_DURATION = 1500;
const DEFAULT_DURATION = 1000;

let stops = [];
let currentIndex = -1;
let isAnimating = false;
let snappingEnabled = true;
let snapCooldown = false;
let idleTimer = null;

// Build stops using bounding rects (more robust than offsetTop)
function computeStops() {
  stops = sections.map((el, i) => {
    const rectTop = el.getBoundingClientRect().top + getY();
    let adjustment = 0;
    // keep your custom offsets
    if (i === 3) adjustment = -350;
    if (i === 5) adjustment = 760;
    return rectTop + adjustment;
  });
}

// Call on startup and on layout changes
const remeasure = () => {
  computeStops();
  // After remeasure, re-lock to nearest to avoid drift when address bar toggles
  if (!isAnimating) currentIndex = findNearestSection();
};

window.addEventListener("load", () => {
  // tiny delay lets fonts/images settle
  setTimeout(remeasure, 0);
});
window.addEventListener("resize", remeasure);
window.addEventListener("orientationchange", remeasure);
// iOS/Android dynamic viewport changes
if (window.visualViewport) {
  visualViewport.addEventListener("resize", () => {
    // debounce a little to avoid thrashing
    clearTimeout(idleTimer);
    idleTimer = setTimeout(remeasure, 60);
  }, { passive: true });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function goToSection(index, duration = DEFAULT_DURATION) {
  if (index < 0 || index >= stops.length) {
    currentIndex = -1;
    return;
  }

  isAnimating = true;
  snapCooldown = true;
  currentIndex = index;

  const startY = getY();
  const targetY = stops[currentIndex];
  const distance = targetY - startY;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    setY(startY + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      // let the browser settle
      setTimeout(() => {
        isAnimating = false;
      }, ANIM_DONE_GRACE_MS);
      setTimeout(() => { snapCooldown = false; }, 100 + ANIM_DONE_GRACE_MS);
    }
  }

  requestAnimationFrame(step);
}

function findNearestSection() {
  const y = getY();
  let nearest = 0;
  let minDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const d = Math.abs(stops[i] - y);
    if (d < minDist) { minDist = d; nearest = i; }
  }
  return nearest;
}

// ===== Desktop wheel =====
window.addEventListener("wheel", (e) => {
  if (!snappingEnabled) return;
  if (isAnimating) { e.preventDefault(); return; }

  const dir = e.deltaY > 0 ? 1 : -1;

  if (currentIndex === -1) currentIndex = findNearestSection();

  const y = getY();
  let target;
  if (dir > 0) {
    // going down
    if (y < stops[currentIndex] - TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.min(currentIndex + 1, stops.length - 1);
    }
  } else {
    // going up
    if (y > stops[currentIndex] + TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.max(currentIndex - 1, 0);
    }
  }

  goToSection(target, currentIndex === 0 ? FIRST_SECTION_DURATION : DEFAULT_DURATION);
  e.preventDefault();
}, { passive: false });

// ===== Keyboard =====
window.addEventListener("keydown", (e) => {
  if (!snappingEnabled || isAnimating) return;
  if (!["ArrowDown", "PageDown", "ArrowUp", "PageUp"].includes(e.key)) return;

  if (currentIndex === -1) currentIndex = findNearestSection();
  const y = getY();

  if (e.key === "ArrowDown" || e.key === "PageDown") {
    const target = (y < stops[currentIndex] - TOLERANCE)
      ? currentIndex
      : Math.min(currentIndex + 1, stops.length - 1);
    goToSection(target);
  } else {
    const target = (y > stops[currentIndex] + TOLERANCE)
      ? currentIndex
      : Math.max(currentIndex - 1, 0);
    goToSection(target);
  }
});

// ===== Mobile touch (swipe to snap) =====
let touchStartY = 0;
let touchLastY = 0;
let touchStartTime = 0;

window.addEventListener("touchstart", (e) => {
  if (!snappingEnabled) return;
  if (e.touches.length !== 1) return;
  touchStartY = e.touches[0].clientY;
  touchLastY = touchStartY;
  touchStartTime = performance.now();
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  // When snapping is in control, prevent native scroll while animating
  if (snappingEnabled && isAnimating) {
    e.preventDefault();
  }
  if (e.touches.length !== 1) return;
  touchLastY = e.touches[0].clientY;
}, { passive: false }); // IMPORTANT: passive:false so preventDefault works

window.addEventListener("touchend", () => {
  if (!snappingEnabled || isAnimating || snapCooldown) return;

  const dy = touchLastY - touchStartY;     // +dy means finger moved down
  const dt = Math.max(performance.now() - touchStartTime, 1);
  const velocity = Math.abs(dy / dt);      // px per ms

  // thresholds
  const MIN_SWIPE_PX = 40;
  const MIN_VELOCITY = 0.4 / 1000; // ~0.0004 px/ms -> tune as needed

  if (Math.abs(dy) < MIN_SWIPE_PX && velocity < MIN_VELOCITY) {
    // small gesture: when user lifts finger, gently snap to nearest
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!isAnimating && !snapCooldown) {
        currentIndex = findNearestSection();
        goToSection(currentIndex, 500);
      }
    }, 10);
    return;
  }

  // Determine direction from gesture
  const dir = dy < 0 ? 1 : -1; // finger up -> scroll down

  if (currentIndex === -1) currentIndex = findNearestSection();
  const y = getY();

  let target;
  if (dir > 0) {
    // down
    if (y < stops[currentIndex] - TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.min(currentIndex + 1, stops.length - 1);
    }
  } else {
    // up
    if (y > stops[currentIndex] + TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.max(currentIndex - 1, 0);
    }
  }

  goToSection(target, currentIndex === 0 ? FIRST_SECTION_DURATION : DEFAULT_DURATION);
}, { passive: true });

// ===== Natural scroll settle snap (safety net) =====
window.addEventListener("scroll", () => {
  if (!snappingEnabled || isAnimating) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!isAnimating && !snapCooldown) {
      const nearest = findNearestSection();
      if (Math.abs(getY() - stops[nearest]) > TOLERANCE) {
        goToSection(nearest, 450);
      } else {
        currentIndex = nearest;
      }
    }
  }, SNAP_AFTER_IDLE_MS);
}, { passive: true });
