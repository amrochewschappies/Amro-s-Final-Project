import { gsap } from "gsap";

export function createBounceCards(container, opts = {}) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) throw new Error("BounceCards: container not found");

  const {
    images = [],
    labels = [],
    links = [],
    clickTarget = "_blank",
    relWhenBlank = "noopener noreferrer",
    useAnchors = false,
    animationDelay = 0.5,
    animationStagger = 0.06,
    easeType = "elastic.out(1, 0.8)",
    transformStyles = [
      "rotate(10deg) translate(-170px)",
      "rotate(5deg) translate(-85px)",
      "rotate(-3deg)",
      "rotate(-10deg) translate(85px)",
      "rotate(2deg) translate(170px)",
    ],
    enableHover = true,
    plateSelector = "#number-plate",
    defaultPlateText = "######-GP",
  } = opts;

  const mq = window.matchMedia("(max-width: 600px)");
  let isMobile = mq.matches;
  let computedEnableHover = enableHover && !isMobile;

  const plateEl = document.querySelector(plateSelector);

  const applyModeTransforms = (cards) => {
    cards.forEach((card, i) => {
      gsap.killTweensOf(card); 
      card.style.transform = isMobile ? "none" : (transformStyles[i] || "none");
      card.style.position = isMobile ? "static" : ""; 

    });
  };

  el.classList.add("bounce-wrap");
  el.innerHTML = "";
  const cards = images.map((src, idx) => {
    const hasLink = typeof links[idx] === "string" && links[idx].trim().length > 0;
    const card = useAnchors && hasLink ? document.createElement("a") : document.createElement("div");
    card.className = "bounce-card";

    card.style.transform = isMobile ? "none" : (transformStyles[idx] ?? "none");

    card.style.cursor = hasLink ? "pointer" : "default";
    card.setAttribute("aria-label", labels[idx] || `Project ${idx + 1}`);
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    if (card.tagName === "A" && hasLink) {
      card.href = links[idx];
      card.target = clickTarget;
      if (clickTarget === "_blank") card.rel = relWhenBlank;
    } else if (hasLink) {
      card.dataset.url = links[idx];
    }

    const img = document.createElement("img");
    img.src = src;
    img.alt = labels[idx] ? `card-${labels[idx]}` : `card-${idx + 1}`;
    img.draggable = false;
    card.appendChild(img);

    el.appendChild(card);
    return card;
  });

  if (!isMobile) {
    gsap.fromTo(
      cards,
      { scale: 0 },
      { scale: 1, stagger: animationStagger, ease: easeType, delay: animationDelay, duration: 0.8 }
    );
  }

  const getNoRotationTransform = (t) => {
    const hasRotate = /rotate\([\s\S]*?\)/.test(t);
    if (hasRotate) return t.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
    if (t === "none") return "rotate(0deg)";
    return `${t} rotate(0deg)`;
  };

  const getPushedTransform = (base, offsetX) => {
    const regex = /translate\(([-0-9.]+)px\)/;
    const match = base.match(regex);
    if (match) {
      const newX = parseFloat(match[1]) + offsetX;
      return base.replace(regex, `translate(${newX}px)`);
    }
    return base === "none" ? `translate(${offsetX}px)` : `${base} translate(${offsetX}px)`;
  };

  function setPlate(text) {
    if (!plateEl) return;
    const next = (text || defaultPlateText).toString().toUpperCase().slice(0, 14);
    gsap.to(plateEl, {
      duration: 0.15,
      onComplete: () => {
        plateEl.textContent = next;
        gsap.to(plateEl, { opacity: 1, duration: 0.15 });
      },
    });
  }

  function pushSiblings(hoveredIdx) {
    if (!computedEnableHover) return;
    setPlate(labels[hoveredIdx] || `PROJECT ${hoveredIdx + 1}`);

    cards.forEach((card, i) => {
      gsap.killTweensOf(card);
      const base = transformStyles[i] || "none";
      if (i === hoveredIdx) {
        gsap.to(card, { transform: getNoRotationTransform(base), duration: 0.4, ease: "back.out(1.4)", overwrite: "auto" });
      } else {
        const offset = i < hoveredIdx ? -160 : 160;
        const pushed = getPushedTransform(base, offset);
        const delay = Math.abs(hoveredIdx - i) * 0.05;
        gsap.to(card, { transform: pushed, duration: 0.4, delay, ease: "back.out(1.4)", overwrite: "auto" });
      }
    });
  }

  function resetSiblings() {
    if (!computedEnableHover) return;
    cards.forEach((card, i) => {
      gsap.killTweensOf(card);
      const base = transformStyles[i] || "none";
      gsap.to(card, { transform: base, duration: 0.4, ease: "back.out(1.4)", overwrite: "auto" });
    });
    setPlate(defaultPlateText);
  }
  
  cards.forEach((card, i) => {
    if (computedEnableHover) {
      card.addEventListener("mouseenter", () => pushSiblings(i));
      card.addEventListener("mouseleave", resetSiblings);
      card.addEventListener("touchstart", (e) => {
        e.preventDefault();
        pushSiblings(i);
      });
      document.addEventListener("touchstart", (e) => {
        if (!el.contains(e.target)) resetSiblings();
      });
    }

    const url = card.tagName === "A" ? card.href : card.dataset.url;
    if (url) {
      card.addEventListener("click", (e) => {
        if (card.tagName === "A") return; 
        e.preventDefault();
        if (clickTarget === "_self") window.location.assign(url);
        else {
          const w = window.open(url, clickTarget);
          if (!w) window.location.assign(url);
        }
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (card.tagName === "A") card.click();
          else {
            if (clickTarget === "_self") window.location.assign(url);
            else {
              const w = window.open(url, clickTarget);
              if (!w) window.location.assign(url);
            }
          }
        }
      });
    }
  });

  mq.addEventListener("change", (e) => {
    isMobile = e.matches;
    computedEnableHover = enableHover && !isMobile;
    applyModeTransforms(cards);

    if (isMobile) {
      gsap.killTweensOf(cards);
      setPlate(defaultPlateText);
    } else {
      gsap.fromTo(cards, { scale: 0 }, { scale: 1, stagger: animationStagger, ease: easeType, duration: 0.6 });
    }
  });

  setPlate(defaultPlateText);

  return {
    setPlate,
    focus: (i) => pushSiblings(i),
    reset: resetSiblings,
  };
}
