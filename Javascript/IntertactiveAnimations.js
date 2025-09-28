const sections = document.querySelectorAll(".lock-section");
let stops = Array.from(sections).map(el => el.offsetTop);

const TOLERANCE = 50; // px tolerance to decide "before/after" a stop
let currentIndex = -1; // -1 = not initialized for snapping
let isAnimating = false;

const snapStart = 800; // px from top where snapping starts
let snappingEnabled = false;

function updateStops() {
  stops = Array.from(sections).map((el, i) => {
    let base = el.offsetTop;
    let adjustment = 0;

    // Example: for section index 3 (the 4th section),
    // stop when the middle reaches the top of the screen
    if (i === 1) {
      adjustment = -350;
    }

    if (i === 3) {
      adjustment = 760;
    }

    // You can hardcode values or build a lookup table for custom offsets
    // e.g. {3: 200, 5: -100} to nudge section 4 down 200px, section 6 up 100px

    return base + adjustment;
  });
}
window.addEventListener("resize", updateStops);
window.addEventListener("load", updateStops);

let snapCooldown = false;

function goToSection(index) {
  if (index < 0 || index >= stops.length) {
    snappingEnabled = false;
    currentIndex = -1;
    return;
  }

  isAnimating = true;
  snapCooldown = true;
  currentIndex = index;

  window.scrollTo({ top: stops[currentIndex], behavior: "smooth" });

  // lock further gestures until animation ends
  setTimeout(() => {
    isAnimating = false;
  }, 700); // match smooth scroll duration

  // cooldown to block momentum overshoot
  setTimeout(() => {
    snapCooldown = false;
  }, 900); // adjust to taste
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

// Toggle snapping on/off depending on scroll position
window.addEventListener("scroll", () => {
  if (window.scrollY >= snapStart) {
    if (!snappingEnabled) {
      snappingEnabled = true;
      currentIndex = -1; // don't pre-set index; wait for first gesture
    }
  } else {
    if (snappingEnabled) {
      snappingEnabled = false;
      currentIndex = -1; // reset so next time it re-inits
    }
  }
}, { passive: true });

// Wheel control (one-step-per-gesture)
window.addEventListener("wheel", (e) => {
  if (!snappingEnabled) return;        // manual scrolling before threshold
  if (isAnimating) { e.preventDefault(); return; }

  const dir = e.deltaY > 0 ? 1 : -1;

  // initialize on first gesture after snapping enabled
  if (currentIndex === -1) currentIndex = findNearestSection();

  let target;
  if (dir > 0) {
    // scroll down:
    // if we're still before the current stop, snap to it first,
    // otherwise advance to the next stop.
    if (window.scrollY < stops[currentIndex] - TOLERANCE) {
      target = currentIndex;
    } else {
      target = Math.min(currentIndex + 1, stops.length - 1);
    }
  } else {
    // scroll up:
    // if we're below the current stop (by a bit), snap to it first,
    // otherwise go to the previous stop (or -1 to leave snapping).
    if (window.scrollY > stops[currentIndex] + TOLERANCE) {
      target = currentIndex;
    } else {
      target = currentIndex - 1; // may be -1 → will disable snapping
    }
  }

  goToSection(target);
  e.preventDefault();
}, { passive: false });

// Keyboard control mirrors same logic
window.addEventListener("keydown", (e) => {
  if (!snappingEnabled || isAnimating) return;

  if (e.key === "ArrowDown" || e.key === "PageDown") {
    if (currentIndex === -1) currentIndex = findNearestSection();
    // reuse same decision logic as wheel (down)
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


const projects = [
  { plate: "Proj#1-GP", content: "First project description" },
  { plate: "Proj#2-GP", content: "Second project description" },
  { plate: "Proj#3-GP", content: "Third project description" }
];

let currentProjectIndex = 0;

const numberPlate = document.getElementById("number-plate");
const gallery = document.getElementById("project-gallery");
const leftBtn = document.querySelector(".left-indicator");
const rightBtn = document.querySelector(".right-indicator");

function updateProject(index) {
  numberPlate.textContent = projects[index].plate;
  document.getElementById("project-content").innerHTML = `<p>${projects[index].content}</p>`;
}

function flicker(button) {
  button.classList.add("flicker");
  setTimeout(() => button.classList.remove("flicker"), 800);
}

leftBtn.addEventListener("click", () => {
  flicker(leftBtn);
  currentProjectIndex = (currentProjectIndex - 1 + projects.length) % projects.length;
  updateProject(currentProjectIndex);
});

rightBtn.addEventListener("click", () => {
  flicker(rightBtn);
  currentProjectIndex = (currentProjectIndex + 1) % projects.length;
  updateProject(currentProjectIndex);
});

// Initial load
updateProject(currentProjectIndex);
