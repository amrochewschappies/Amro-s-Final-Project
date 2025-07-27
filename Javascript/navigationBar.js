const navPages = [
  { name: "Home", href: "/Rasha-Foundation/Home/homePage.html" },
  { name: "Under The Hood", href: "/Rasha-Foundation/Our Work/work.html" },
  {
    name: "The Team",
    href: "/Rasha-Foundation/Meet the team/ourTeamPage.html",
  },
  { name: "Volunteer", href: "/Rasha-Foundation/Volunteer/Volunteer.php" },
  { name: "Contact", href: "/Rasha-Foundation/Contact/contact.html" },
];

export function loadNavbar(CurrentPageName) {
  const nav = document.querySelector("#nav-bar");

  const navbarContainer = document.createElement("div");
  navbarContainer.classList.add("navbar-container");

  // LEFT - Brand Name
  const nameSection = document.createElement("div");
  nameSection.classList.add("navbar-left");
  const name = document.createElement("span");
  name.classList.add("navbar-name");
  name.innerText = "Amro";
  nameSection.appendChild(name);

  // RIGHT - Buttons
  const rightSection = document.createElement("div");
  rightSection.classList.add("navbar-right");

  // Circle button (icon)
  const audioBtn = document.createElement("button");
  audioBtn.classList.add("audio-btn");

  const audioSVG = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  audioSVG.setAttribute("viewBox", "0 0 24 24");
  audioSVG.classList.add("audio-icon");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "black");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  // Wavy line (static shape, but animated with stroke offset)
  const wavePath = "M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0";

  path.setAttribute("d", "M2 12H22"); // start with straight line

  audioSVG.appendChild(path);
  audioBtn.appendChild(audioSVG);

  let isPlaying = false;
  audioBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;

    if (isPlaying) {
      path.setAttribute("d", wavePath);
      path.classList.add("wave-animate");
    } else {
      path.setAttribute("d", "M2 12H22");
      path.classList.remove("wave-animate");
    }
  });

  // LET'S TALK button
  const talkBtn = document.createElement("button");
  talkBtn.classList.add("talk-btn");
  talkBtn.innerText = "LET'S TALK";

  // MENU button
  const menuWrapper = document.createElement("div");
  menuWrapper.classList.add("menu-wrapper");

  const menuBtn = document.createElement("button");
  menuBtn.classList.add("menu-btn");
  menuBtn.innerHTML = "MENU &#x2022;&#x2022;"; // MENU ..

  const menuContent = document.createElement("div");
  menuContent.classList.add("menu-content");

  navPages.forEach((page) => {
    const link = document.createElement("a");
    link.setAttribute("href", page.href);
    link.innerText = page.name;
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
