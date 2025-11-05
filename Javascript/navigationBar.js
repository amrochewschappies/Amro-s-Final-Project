// navbar.js
// UPDATED: audio button now play/pause (no restart) and binds scroll on first click.

import { audioDir, bindScrollToClips } from "./audioController.js"; // adjust path

const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ||
  '/Amro-s-Final-Project/';

const navPages = [
  { name: "Home", href: `${BASE}index.html` },
  { name: "Under The Helmet", href: `${BASE}AboutMe/aboutMe.html` },
  { name: "Projects", href: `${BASE}index.html#projects-section` },
];


const logoUrl = new URL('../Assets/Amros Logo.png', import.meta.url).href;

export function loadNavbar(CurrentPageName) {
  const nav = document.querySelector("#nav-bar");

  const navbarContainer = document.createElement("div");
  navbarContainer.classList.add("navbar-container");

  // LEFT - Brand Name
  const nameSection = document.createElement("div");
  nameSection.classList.add("navbar-left");
  const logo = document.createElement("img");
  logo.classList.add("logo-image")
  logo.src = logoUrl
  nameSection.appendChild(logo);

  // RIGHT - Buttons
  const rightSection = document.createElement("div");
  rightSection.classList.add("navbar-right");

  // --- Audio Button (icon) ---
  const audioBtn = document.createElement("button");
  audioBtn.classList.add("audio-btn");

  const audioSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  audioSVG.setAttribute("viewBox", "0 0 24 24");
  audioSVG.classList.add("audio-icon");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "black");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  // Paths
  const STRAIGHT = "M2 12H22";
  const WAVE = "M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0";

  path.setAttribute("d", STRAIGHT); // start with straight line
  audioSVG.appendChild(path);
  audioBtn.appendChild(audioSVG);

  let scrollBound = false;
  const setWave = () => { path.setAttribute("d", WAVE); path.classList.add("wave-animate"); };
  const setStraight = () => { path.setAttribute("d", STRAIGHT); path.classList.remove("wave-animate"); };

  audioBtn.addEventListener("click", async () => {
    const playing = await audioDir.toggle({ startId: "intro" }); // play/pause with fades
    if (playing) {
      setWave();
      if (!scrollBound) { bindScrollToClips(); scrollBound = true; }
    } else {
      setStraight();
    }
  });


  const SECTION_OFFSETS = {
    "#projects-section": -35, // <-- set your custom offset in px
  };

  // helper: smooth scroll with offset
  function scrollToWithOffset(selector, offsetPx = 0) {
    const el = document.querySelector(selector);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - offsetPx;
    window.scrollTo({ top: y, behavior: "smooth" });
  }


  // LET'S TALK button
  const talkBtn = document.createElement("button");
  talkBtn.classList.add("talk-btn");
  talkBtn.innerText = "LET'S TALK";

  talkBtn.addEventListener("click", () => {
    window.location.href = "mailto:amro4ahmed4@gmail.com?subject=Let's%20Talk&body=Hi%20Amro,";
  });

  // MENU button
  const menuWrapper = document.createElement("div");
  menuWrapper.classList.add("menu-wrapper");

  const menuBtn = document.createElement("button");
  menuBtn.classList.add("menu-btn");
  menuBtn.innerHTML = "MENU &#x2022;&#x2022;"; // MENU ..

  const menuContent = document.createElement("div");
  menuContent.classList.add("menu-content");

  const isHome = () => /\/index\.html?$/.test(window.location.pathname);

  navPages.forEach((page) => {
    const link = document.createElement("a");
    link.setAttribute("href", page.href);
    link.innerText = page.name;

    // If the link is the Projects section (hash) and we are already on Home,
    // intercept and do smooth scroll with offset.
    if (page.href.endsWith("#projects-section") && isHome()) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        menuContent.classList.toggle("show");
        const offset = SECTION_OFFSETS["#projects-section"] ?? 0;
        scrollToWithOffset("#projects-section", offset);
      });
    }

    menuContent.appendChild(link);
  });


  menuBtn.addEventListener("click", () => {
    menuContent.classList.toggle("show");
  });

  menuWrapper.appendChild(menuBtn);
  menuWrapper.appendChild(menuContent);

  // Combine all right side elements
  rightSection.appendChild(audioBtn);
  rightSection.appendChild(talkBtn);
  rightSection.appendChild(menuWrapper);

  navbarContainer.appendChild(nameSection);
  navbarContainer.appendChild(rightSection);
  nav.appendChild(navbarContainer);
}
