import { gsap } from "gsap";

/**
 * Creates a stack of animated "bounce" cards that pop in and react to hover.
 * When a card is hovered, the number plate text changes to that card's label.
 */
export function createBounceCards(container, opts = {}) {
  // Resolve container element
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) throw new Error("BounceCards: container not found");

  // ====== OPTIONS ======
  const {
    images = [],                   // image URLs for each card
    labels = [],        
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

  // Get number plate element
  const plateEl = document.querySelector(plateSelector);

  // ====== CREATE CARDS ======
  el.innerHTML = "";
  const cards = images.map((src, idx) => {
    const card = document.createElement("div");
    card.className = "bounce-card";
    card.style.transform = transformStyles[idx] ?? "none";

    const img = document.createElement("img");
    img.src = src;
    img.alt = labels[idx] ? `card-${labels[idx]}` : `card-${idx + 1}`;
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

  // ====== HELPER FUNCTIONS ======
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

  // Smooth plate text change
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
  if (enableHover) {
    cards.forEach((card, i) => {
      card.addEventListener("mouseenter", () => pushSiblings(i));
      card.addEventListener("mouseleave", resetSiblings);
      // Mobile/touch fallback
      card.addEventListener("touchstart", (e) => {
        e.preventDefault();
        pushSiblings(i);
      });
      document.addEventListener("touchstart", (e) => {
        if (!el.contains(e.target)) resetSiblings();
      });
    });
  }

  // ====== INITIALIZE ======
  setPlate(defaultPlateText);

  // Public API (optional)
  return {
    setPlate,
    focus: (i) => pushSiblings(i),
    reset: resetSiblings,
  };
}
