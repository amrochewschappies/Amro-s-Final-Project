const sections = document.querySelectorAll(".lock-section");
let stops = Array.from(sections).map(el => el.offsetTop);


const TOLERANCE = 50; // px tolerance to decide "before/after" a stop
let currentIndex = -1; // -1 = not initialized for snapping
let isAnimating = false;
let snappingEnabled = true; // ✅ always on — no toggle
const snapStart = 0; // no longer used, but kept for reference

function updateStops() {
  stops = Array.from(sections).map((el, i) => {
    let base = el.offsetTop;
    let adjustment = 0;

    if (i === 3) adjustment = -350;
    if (i === 5) adjustment = 760;

    return base + adjustment;
  });
}
window.addEventListener("resize", updateStops);
window.addEventListener("load", updateStops);

let snapCooldown = false;

function goToSection(index, duration = 1000) { // duration = scroll speed in ms
  if (index < 0 || index >= stops.length) {
    currentIndex = -1;
    return;
  }

  isAnimating = true;
  snapCooldown = true;
  currentIndex = index;

  const startY = window.scrollY;
  const targetY = stops[currentIndex];
  const distance = targetY - startY;
  const startTime = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      setTimeout(() => {
        isAnimating = false;
      }, 1000);
    }
  }

  requestAnimationFrame(step);

  // Optional cooldown
  setTimeout(() => { snapCooldown = false; }, duration + 500);
}

function findNearestSection() {
  const y = window.scrollY;
  let nearest = 0;
  let minDist = Infinity;
  stops.forEach((stop, i) => {
    const d = Math.abs(stop - y);
    if (d < minDist) { minDist = d; nearest = i; }
  });
  return nearest;
}


// ✅ Wheel control — always active
window.addEventListener("wheel", (e) => {
  if (!snappingEnabled) return;
  if (isAnimating) { e.preventDefault(); return; }

  const dir = e.deltaY > 0 ? 1 : -1;

  if (currentIndex === -1) currentIndex = findNearestSection();

  let target;
  if (dir > 0) {
    if (window.scrollY < stops[currentIndex] - TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.min(currentIndex + 1, stops.length - 1);
    }
  } else {
    if (window.scrollY > stops[currentIndex] + TOLERANCE) {
      target = currentIndex;
    } else {
      target = currentIndex - 1;
    }
  }

  if (currentIndex == 0) {
    goToSection(target, 1500)
  }
  else {
    goToSection(target);
  }

  e.preventDefault();
}, { passive: false });

// ✅ Keyboard control — always active
window.addEventListener("keydown", (e) => {
  if (!snappingEnabled || isAnimating) return;

  if (e.key === "ArrowDown" || e.key === "PageDown") {
    if (currentIndex === -1) currentIndex = findNearestSection();
    const target = (window.scrollY < stops[currentIndex] - TOLERANCE)
      ? currentIndex
      : Math.min(currentIndex + 1, stops.length - 1);
    goToSection(target);
  } else if (e.key === "ArrowUp" || e.key === "PageUp") {
    if (currentIndex === -1) currentIndex = findNearestSection();
    const target = (window.scrollY > stops[currentIndex] + TOLERANCE)
      ? currentIndex
      : currentIndex - 1;
    goToSection(target);
  }
});


