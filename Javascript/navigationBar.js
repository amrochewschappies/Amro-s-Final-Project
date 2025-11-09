import { audioDir, bindScrollToClips } from "./audioController.js";

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
  if (!nav) return;

  const navbarContainer = document.createElement("div");
  navbarContainer.classList.add("navbar-container");

  const nameSection = document.createElement("div");
  nameSection.classList.add("navbar-left");

  const logoLink = document.createElement("a");
  logoLink.href = "/Amro-s-Final-Project/";

  const logo = document.createElement("img");
  logo.classList.add("logo-image");
  logo.src = logoUrl;
  logo.alt = "Amro Logo";
  logoLink.appendChild(logo);
  nameSection.appendChild(logoLink);

  const rightSection = document.createElement("div");
  rightSection.classList.add("navbar-right");

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

  const STRAIGHT = "M2 12H22";
  const WAVE     = "M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0";
  path.setAttribute("d", STRAIGHT);
  audioSVG.appendChild(path);
  audioBtn.appendChild(audioSVG);

  let scrollBound = false;
  const setWave = () => { path.setAttribute("d", WAVE); path.classList.add("wave-animate"); };
  const setStraight = () => { path.setAttribute("d", STRAIGHT); path.classList.remove("wave-animate"); };

  audioBtn.addEventListener("click", async () => {
    const playing = await audioDir.toggle({ startId: "intro" }); 
    if (playing) {
      setWave();
      if (!scrollBound) { bindScrollToClips(); scrollBound = true; }
    } else {
      setStraight();
    }
  });

  const audioWrapper = document.createElement("div");
  audioWrapper.classList.add("audio-wrapper");

  const audioNotice = document.createElement("div");
  audioNotice.classList.add("audio-notice");
  audioNotice.innerHTML = "Best<br>experienced<br>with<br>audio";

  audioWrapper.appendChild(audioBtn);
  audioWrapper.appendChild(audioNotice);

  const SECTION_OFFSETS = { "#projects-section": -55 };
  function scrollToWithOffset(selector, offsetPx = 0) {
    const el = document.querySelector(selector);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - offsetPx;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  const talkBtn = document.createElement("button");
  talkBtn.classList.add("talk-btn");
  talkBtn.innerText = "LET'S TALK";
  talkBtn.addEventListener("click", () => {
    window.location.href = "mailto:amro4ahmed4@gmail.com?subject=Let's%20Talk&body=Hi%20Amro,";
  });

  const menuWrapper = document.createElement("div");
  menuWrapper.classList.add("menu-wrapper");

  const menuBtn = document.createElement("button");
  menuBtn.classList.add("menu-btn");
  menuBtn.innerHTML = "MENU &#x2022;&#x2022;";

  const menuContent = document.createElement("div");
  menuContent.classList.add("menu-content");

  const isHome = () => /\/index\.html?$/.test(window.location.pathname);

  navPages.forEach((page) => {
    const link = document.createElement("a");
    link.setAttribute("href", page.href);
    link.innerText = page.name;

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

  rightSection.appendChild(audioWrapper);
  rightSection.appendChild(talkBtn);
  rightSection.appendChild(menuWrapper);

  navbarContainer.appendChild(nameSection);
  navbarContainer.appendChild(rightSection);
  nav.appendChild(navbarContainer);

  function triggerAudioIntro() {
    audioBtn.classList.add("pop-in");
    setTimeout(() => audioBtn.classList.remove("pop-in"), 900);

    audioNotice.classList.add("show", "pulse");
    setTimeout(() => audioNotice.classList.remove("pulse"), 1500);
    setTimeout(() => audioNotice.classList.remove("show"), 3000);
  }

  const startIntro = () => setTimeout(triggerAudioIntro, 300);

  window.addEventListener('site-ready', startIntro, { once: true });

  if (window.__siteReady) startIntro();

  window.addEventListener('load', () => {
    if (!window.__siteReady) {
      setTimeout(() => {
        startIntro();
      }, 2200);
    }
  }, { once: true });
}
