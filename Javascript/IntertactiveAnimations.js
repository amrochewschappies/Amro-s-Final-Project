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
      isAnimating = false;
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

// ❌ Removed the "Toggle snapping on/off depending on scroll position" block

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


// -------------------
// PROJECT CAROUSEL
// -------------------
const projects = [
  {
    plate: "FERRARI-GP", content: "This Ferrari-themed website is a digital showroom created as part of a course project to explore the integration of APIs and the effective visualization of data. The project showcases Ferrari's iconic models, combining sleek design with interactivity to deliver an engaging user experience. Visitors can explore a detailed gallery of Ferrari vehicles, enhanced with animations and data visualizations, such as price trends and performance metrics, to provide a comprehensive view of the brand's legacy and innovation.", image: "./Assets/Ferrari Background.png" },
  { plate: "GROVEEEE-GP", content: "Groveeee is a beach event listing web app developed during my first experience with React. It showcases beach-related events and includes features such as a favorites system, client-side routing, global state management with useContext, and side effect handling with useEffect, among other core React functionalities.", image: "./Assets/Groveeee Image.png" },
  { plate: "MLUNGISI-GP", content: "The Mlungisi corporation is dedicated to creating inclusive, gamified educational experiences tailored to neurodivergent learners. By leveraging individual strengths, we aim to make learning accessible, engaging, and empowering for all.", image: "./Assets/Mlungisi Logo.png" }
];

let currentProjectIndex = 0;

const numberPlate = document.getElementById("number-plate");
const gallery = document.getElementById("project-gallery");
const leftBtn = document.querySelector(".left-indicator");
const rightBtn = document.querySelector(".right-indicator");

function updateProject(index) {
  numberPlate.textContent = projects[index].plate;
  document.getElementById("project-content").innerHTML = `<p>${projects[index].content}</p>`;
  document.getElementById("project-image").src = projects[index].image;
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

updateProject(currentProjectIndex);
