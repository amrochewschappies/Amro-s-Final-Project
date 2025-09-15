const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        // If you want it to animate only once:
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 } // fire when 20% is visible
);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));


const lockSection = document.querySelector("#lock-section");
let locked = false;
let alreadySnapped = false; // <-- new flag

window.addEventListener("scroll", () => {
  const rect = lockSection.getBoundingClientRect();

  if (rect.top <= 0 && !locked && !alreadySnapped) {
    locked = true;
    alreadySnapped = true; // mark that we snapped once

    // Auto-scroll into place
    lockSection.scrollIntoView({ behavior: "smooth" });

    const release = freezeScrollAt(window.scrollY);

    // Lock scrolling
    disableScroll()

    // Unlock after delay (or user action)
    setTimeout(() => {
      release();
      enableScroll()
      locked = false;
    }, 2000); // adjust to your needs
  }

  if (rect.top > window.innerHeight / 2) {
    alreadySnapped = false;
    resetObserver();
  }
});

function disableScroll() {
  document.body.addEventListener("wheel", preventScroll, { passive: false });
  document.body.addEventListener("touchmove", preventScroll, { passive: false });
  document.body.addEventListener("keydown", preventKeys, { passive: false });
}

function enableScroll() {
  document.body.removeEventListener("wheel", preventScroll, { passive: false });
  document.body.removeEventListener("touchmove", preventScroll, { passive: false });
  document.body.removeEventListener("keydown", preventKeys, { passive: false });
}

function preventScroll(e) {
  e.preventDefault();
}

function preventKeys(e) {
  // Arrow keys, space, PgUp/PgDn
  if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
    e.preventDefault();
  }
}

function freezeScrollAt(y) {
  window.scrollTo(0, y);
  const lockHandler = () => window.scrollTo(0, y);
  window.addEventListener("scroll", lockHandler);
  return () => window.removeEventListener("scroll", lockHandler);
}

function resetObserver() {
  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.remove('in'); // remove the animation class
    observer.observe(el);      // reattach the observer
  });
}