import { gsap } from "gsap";

/**
 * Creates a stack of animated "bounce" cards that pop in and react to hover.
 * When a card is hovered, the number plate text changes to that card's label.
 * NEW: Click/keyboard opens corresponding URL from opts.links[i].
 */
export function createBounceCards(container, opts = {}) {
  // Resolve container element
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) throw new Error("BounceCards: container not found");

  // ====== OPTIONS ======
  const {
    images = [],                   // image URLs for each card
    labels = [],                   // labels per card (plate text + aria label)
    links = [],                    // NEW: URL per card (match index)
    clickTarget = "_blank",        // NEW: where to open ("_blank", "_self", etc.)
    relWhenBlank = "noopener noreferrer",
    useAnchors = false,            // NEW: set true to render <a> instead of <div>
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
    plateSelector = "#number-plate",  // element to display active card name
    defaultPlateText = "######-GP"    // fallback text when not hovering
  } = opts;

  const plateEl = document.querySelector(plateSelector);

  // ====== CREATE CARDS ======
  el.innerHTML = "";
  const cards = images.map((src, idx) => {
    const hasLink = typeof links[idx] === "string" && links[idx].trim().length > 0;

    const card = useAnchors && hasLink
      ? document.createElement("a")
      : document.createElement("div");

    card.className = "bounce-card";
    card.style.transform = transformStyles[idx] ?? "none";

    // Accessibility + interactivity affordances
    card.style.cursor = hasLink ? "pointer" : "default";
    card.setAttribute("aria-label", labels[idx] || `Project ${idx + 1}`);
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    // If using anchors, wire attributes
    if (card.tagName === "A" && hasLink) {
      card.href = links[idx];
      card.target = clickTarget;
      if (clickTarget === "_blank") card.rel = relWhenBlank;
    } else if (hasLink) {
      // For <div>, stash URL for click handler
      card.dataset.url = links[idx];
    }

    const img = document.createElement("img");
    img.src = src;
    img.alt = labels[idx] ? `card-${labels[idx]}` : `card-${idx + 1}`;
    img.draggable = false; // avoid drag ghost on desktop
    card.appendChild(img);

    el.appendChild(card);
    return card;
  });

  // ====== INTRO ANIMATION ======
  gsap.fromTo(
    cards,
    { scale: 0 },
    {
      scale: 1,
      stagger: animationStagger,
      ease: easeType,
      delay: animationDelay,
      duration: 0.8,
    }
  );

  // ====== HELPERS ======
  const getNoRotationTransform = (transformStr) => {
    const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
    if (hasRotate) return transformStr.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
    if (transformStr === "none") return "rotate(0deg)";
    return `${transformStr} rotate(0deg)`;
  };

  const getPushedTransform = (baseTransform, offsetX) => {
    const regex = /translate\(([-0-9.]+)px\)/;
    const match = baseTransform.match(regex);
    if (match) {
      const newX = parseFloat(match[1]) + offsetX;
      return baseTransform.replace(regex, `translate(${newX}px)`);
    }
    return baseTransform === "none"
      ? `translate(${offsetX}px)`
      : `${baseTransform} translate(${offsetX}px)`;
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

  // ====== CARD ANIMATIONS ======
  function pushSiblings(hoveredIdx) {
    if (!enableHover) return;

    setPlate(labels[hoveredIdx] || `PROJECT ${hoveredIdx + 1}`);

    cards.forEach((card, i) => {
      gsap.killTweensOf(card);
      const base = transformStyles[i] || "none";

      if (i === hoveredIdx) {
        gsap.to(card, {
          transform: getNoRotationTransform(base),
          duration: 0.4,
          ease: "back.out(1.4)",
          overwrite: "auto",
        });
      } else {
        const offset = i < hoveredIdx ? -160 : 160;
        const pushed = getPushedTransform(base, offset);
        const delay = Math.abs(hoveredIdx - i) * 0.05;
        gsap.to(card, {
          transform: pushed,
          duration: 0.4,
          delay,
          ease: "back.out(1.4)",
          overwrite: "auto",
        });
      }
    });
  }

  function resetSiblings() {
    if (!enableHover) return;

    cards.forEach((card, i) => {
      gsap.killTweensOf(card);
      const base = transformStyles[i] || "none";
      gsap.to(card, {
        transform: base,
        duration: 0.4,
        ease: "back.out(1.4)",
        overwrite: "auto",
      });
    });

    setPlate(defaultPlateText);
  }

  // ====== EVENT BINDINGS ======
  cards.forEach((card, i) => {
    // Hover interactions
    if (enableHover) {
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

    // Click / keyboard to open link (works for both <a> and <div>)
    const url = card.tagName === "A" ? card.href : card.dataset.url;
    if (url) {
      // Click on the whole card
      card.addEventListener("click", (e) => {
        // If it's an <a>, let the browser handle it unless modifier keys
        if (card.tagName === "A") return;
        e.preventDefault();
        if (clickTarget === "_self") {
          window.location.assign(url);
        } else {
          const w = window.open(url, clickTarget);
          // optional: if popup blocked, fallback
          if (!w) window.location.assign(url);
        }
      });

      // Keyboard: Enter / Space
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (card.tagName === "A") {
            // simulate click for anchors
            card.click();
          } else {
            if (clickTarget === "_self") {
              window.location.assign(url);
            } else {
              const w = window.open(url, clickTarget);
              if (!w) window.location.assign(url);
            }
          }
        }
      });
    }
  });

  // ====== INITIALIZE ======
  setPlate(defaultPlateText);

  // Public API
  return {
    setPlate,
    focus: (i) => pushSiblings(i),
    reset: resetSiblings,
  };
}
