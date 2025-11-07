import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import '../Javascript/IntertactiveAnimations.js'
import { audioDir } from '../Javascript/audioController.js';
import { mix } from 'three/tsl';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// ---- Loop timing (tweak these) ----
const CYCLE_SEC = 26;     // total cycle length (intro + play) in seconds
const INTRO_SEC = 3.2;    // blackout + flicker + reveal timeline duration
const PLAY_SEC = Math.max(0, CYCLE_SEC - INTRO_SEC); // time animations run each loop

const loaderEl = document.getElementById("loader");
const barEl = document.getElementById("loader-bar");
const textEl = document.getElementById("loader-text");
const blackoutEl = document.getElementById("blackout");
const s6Heading = document.getElementById("section-6-heading");
let s6InView = false;

// ===== Speedometer loader helpers =====
const ARC_LEN = 251; // must match the stroke-dasharray on #arc in the SVG
function setLoaderProgress(p) {
  const pct = Math.max(0, Math.min(100, p));
  const arc = document.getElementById('arc');
  const needle = document.getElementById('needle');
  const spd = document.getElementById('spd');

  if (arc) arc.setAttribute('stroke-dashoffset', ARC_LEN * (1 - pct / 100));
  if (needle) needle.setAttribute('transform', `rotate(${-90 + (pct * 1.8)} 100 120)`); // -90..+90
  if (spd) spd.textContent = Math.round(pct);
}
function finishLoader() {
  gsap.to("#loader", {
    autoAlpha: 0, duration: 0.5, onComplete: () => {
      document.getElementById('loader')?.remove();
    }
  });
  gsap.to(".webgl", { autoAlpha: 1, duration: 0.5 });
  ScrollTrigger.refresh();
}

const manager = new THREE.LoadingManager();
manager.onStart = () => { setLoaderProgress(0); };
manager.onProgress = (_url, loaded, total) => {
  const pct = total ? (loaded / total) * 100 : 0;
  setLoaderProgress(pct);
};
manager.onLoad = () => {
  setLoaderProgress(100);
  finishLoader();
};

// ===== Scene
const scene = new THREE.Scene();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 10000);
camera.position.z = 32;
camera.position.y = -2;
camera.position.x = 0.05;

if (window.innerWidth) {
  camera.position.z = 42;
  camera.position.y = -2;
  camera.position.x = 6.05;
}

scene.add(camera);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0);
directionalLight.position.set(10, 50, 30);
directionalLight.castShadow = true;
scene.add(directionalLight);

const leftCarLight = new THREE.SpotLight(0xffffff, 0);
leftCarLight.position.set(-6.74, -0.3, 20)
leftCarLight.castShadow = false
leftCarLight.target.position.copy(camera.position);
scene.add(leftCarLight.target);
scene.add(leftCarLight)

const rightCarLight = new THREE.SpotLight(0xffffff, 0);
rightCarLight.position.set(6.15, -0.3, 20)
rightCarLight.castShadow = false
rightCarLight.target.position.copy(camera.position);
scene.add(rightCarLight.target);
scene.add(rightCarLight)

const canvas = document.querySelector(".webgl");

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height, false);
renderer.setClearColor(0x000000);
renderer.domElement.style.opacity = 0;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);
// (optional) tame bloom so tiny dots don't flare too much
bloomPass.threshold = 0.85;
bloomPass.strength = 1.5;
bloomPass.radius = 0.4;

composer.addPass(bloomPass);

// ===== GLTF & animation
const gltfLoader = new GLTFLoader(manager);
let mixer;
let actions = [];

const glbUrl = new URL('../Assets/Prefinal.glb', import.meta.url).href;
const hdrUrl = new URL('../Assets/DarkStorm4K.hdr', import.meta.url).href;
const imgUrl = new URL('../Assets/Car Light.png', import.meta.url).href;
const FLICKER_URL = new URL("../Assets/Flicker.mp3", import.meta.url).toString();

gltfLoader.load(glbUrl, (gltf) => {
  gltf.scene.scale.set(2, 2, 2);
  scene.add(gltf.scene);

  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);

    // Let all clips loop freely during the play window
    actions = gltf.animations.map((clip) => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.enabled = true;
      a.play();
      a.paused = true; // idle until we start a cycle
      return a;
    });

    // Utility helpers for cycle control
    let cycleDC = null; // gsap.delayedCall handle

    const toFirstFrame = () => {
      if (!mixer) return;
      actions.forEach(a => {
        a.enabled = true;
        a.reset();       // time=0, weight=1
        a.paused = true; // hold at frame 0
      });
      mixer.setTime(0);
    };
    const playFromStart = () => {
      toFirstFrame();
      actions.forEach(a => (a.paused = false));
    };
    const pauseAll = () => {
      actions.forEach(a => (a.paused = true));
    };
    const cancelNextCycle = () => {
      if (cycleDC) { cycleDC.kill(); cycleDC = null; }
    };
    const scheduleNextCycle = () => {
      cancelNextCycle();
      // After animations play for PLAY_SEC, go back to blackout→flicker→reveal
      cycleDC = gsap.delayedCall(PLAY_SEC, () => {

        if (!s6InView) return;          // don't loop when off-screen
        pauseAll();                     // freeze before blackout
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;
        lockBlackout("s6-intro");       // use shared blackout
        section6RevealTL.restart(true); // will unlock + playFromStart + reschedule
      });
    };

    // ===== Section 6 timeline (blackout → flicker → reveal → play)
    const section6RevealTL = gsap.timeline({ paused: true });

    section6RevealTL
      .add(() => {
        // heading prep + blink while black
        gsap.set(s6Heading, { zIndex: 10000, opacity: 0 });
        setTimeout(() => {
          s6Heading?.classList.add('s6-blink');

        }, 1700);

        // play flicker interlude during blackout, auto-switch to "drop"
        audioDir.playInterludeAndSwitch(FLICKER_URL, "drop", {
          duckTo: 0,
          interludeGain: 1.0,
        });

        // dim headlights while black
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;
      })
      .to({}, { duration: INTRO_SEC - 0.3 }) // hold black during flicker (e.g., 2.9s)
      .add(() => {
        s6Heading?.classList.remove('s6-blink');
        gsap.set(s6Heading, { zIndex: 10000, opacity: 1 });
      })
      .to({}, { duration: 0.3 })
      .add(() => {
        // reveal and start animation
        unlockBlackout("s6-intro"); // shared
        if (s6InView) {
          setTimeout(() => {
            playFromStart();
            scheduleNextCycle();      // start the play window timer
          }, 2000);
        } else {
          actions.forEach(a => { a.reset(); a.paused = true; });
          mixer?.setTime(0);
        }
      });

    // ===== ScrollTrigger for Section 6
    ScrollTrigger.create({
      trigger: "#section-6",
      start: "top center",
      end: "bottom center",

      onEnter: () => {
        s6InView = true;
        toFirstFrame();
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;

        lockBlackout("s6-intro");

        if (window.innerWidth < 600) {

          scene.fog = new THREE.FogExp2(0x808080, 0.0010)
          gsap.to(camera.position, {
            x: -100,
            y: 7,
            z: -99,
            duration: 2,
            ease: "power2.inOut"
          });

          gsap.to(camera.rotation, {
            x: -0.1,
            y: -2.35,
            z: 0,
            duration: 2,
            ease: "power2.inOut"
          });
        }

        section6RevealTL.restart(true); // runs intro → play → schedule
      },

      onEnterBack: () => {
        s6InView = true;
        toFirstFrame();
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;

        lockBlackout("s6-intro");

        if (window.innerWidth < 600) {

          scene.fog = new THREE.FogExp2(0x808080, 0.0010)
          gsap.to(camera.position, {
            x: -100,
            y: 7,
            z: -99,
            duration: 2,
            ease: "power2.inOut"
          });

          gsap.to(camera.rotation, {
            x: -0.1,
            y: -2.35,
            z: 0,
            duration: 2,
            ease: "power2.inOut"
          });
        }
        section6RevealTL.restart(true);
      },

      onLeave: () => {
        s6InView = false;
        cancelNextCycle();
        pauseAll();
        mixer?.setTime(0);

        rightCarLight.intensity = 150;
        leftCarLight.intensity = 150;

        unlockBlackout("s6-intro");
        section6RevealTL.pause(0);
      },

      onLeaveBack: () => {
        s6InView = false;
        cancelNextCycle();
        pauseAll();
        mixer?.setTime(0);

        rightCarLight.intensity = 150;
        leftCarLight.intensity = 150;

        unlockBlackout("s6-intro");
        section6RevealTL.pause(0);
      }
    });

    // ===== Bridge 4→6 (kept)
    let playedBlackout4_6 = false;
    ScrollTrigger.create({
      trigger: "#bridge-4-6",
      start: "top top",
      end: "bottom top",
      onEnter: () => {
        lockBlackout("bridge-4-6");
        if (!playedBlackout4_6) {
          playedBlackout4_6 = true;
          audioDir.switchTo("verse", { mask: true, quantizeToBar: false });
          audioDir.playInterludeAndSwitch(
            new URL("../Assets/Flicker.mp3", import.meta.url).toString(),
            "drop",
            { duckTo: 0, interludeGain: 1.0 }
          );
        }
      },
      onEnterBack: () => lockBlackout("bridge-4-6"),
      onLeave: () => unlockBlackout("bridge-4-6"),
      onLeaveBack: () => unlockBlackout("bridge-4-6"),
      refreshPriority: 10,
    });

    // ===== Bridge 6→7 (kept)
    ScrollTrigger.create({
      trigger: "#bridge-6-7",
      start: "top top",
      end: "bottom top",
      onEnter: () => lockBlackout("bridge-6-7"),
      onEnterBack: () => lockBlackout("bridge-6-7"),
      onLeave: () => unlockBlackout("bridge-6-7"),
      onLeaveBack: () => unlockBlackout("bridge-6-7"),
      refreshPriority: 10,
    });

  }
}, undefined, (err) => console.error("GLB load error:", err));

// ===== Blackout control (shared – single source of truth)
const blackoutLocks = new Set();
function _applyBlackout() {
  blackoutEl?.classList.toggle('is-visible', blackoutLocks.size > 0);
}
function lockBlackout(tag = 'anon') {
  blackoutLocks.add(tag);
  _applyBlackout();
}
function unlockBlackout(tag = 'anon') {
  blackoutLocks.delete(tag);
  _applyBlackout();
}
function clearAllBlackouts() {
  blackoutLocks.clear();
  _applyBlackout();
}

// ===== Rain
const RAIN_COUNT = 15000;
const RAIN_AREA = { w: 160, h: 120, d: 160 };
const FALL_MIN = 20, FALL_MAX = 34;
const WIND = { x: 1.2, z: -0.6 };

const rainGroup = new THREE.Group();
camera.add(rainGroup);

const rainGeom = new THREE.BufferGeometry();
const positions = new Float32Array(RAIN_COUNT * 3);
const speeds = new Float32Array(RAIN_COUNT);

for (let i = 0; i < RAIN_COUNT; i++) {
  const ix = i * 3;
  positions[ix + 0] = (Math.random() - 0.5) * RAIN_AREA.w;
  positions[ix + 1] = Math.random() * RAIN_AREA.h * 0.5;
  positions[ix + 2] = (Math.random() - 0.5) * RAIN_AREA.d;
  speeds[i] = THREE.MathUtils.lerp(FALL_MIN, FALL_MAX, Math.random());
}
rainGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const rainMaterial = new THREE.PointsMaterial({
  color: 0x808080,
  size: 0.05,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  sizeAttenuation: false
});

const rain = new THREE.Points(rainGeom, rainMaterial);
rainGroup.add(rain);

scene.fog = new THREE.FogExp2(0x808080, 0.0020)

function updateRain(dt) {
  const pos = rainGeom.attributes.position.array;
  let changed = false;

  for (let i = 0; i < RAIN_COUNT; i++) {
    const ix = i * 3;

    pos[ix + 1] -= speeds[i] * dt;

    pos[ix + 0] += WIND.x * dt;
    pos[ix + 2] += WIND.z * dt;

    if (pos[ix + 1] < -RAIN_AREA.h * 0.5) {
      pos[ix + 1] = RAIN_AREA.h * 0.5;
      pos[ix + 0] = (Math.random() - 0.5) * RAIN_AREA.w;
      pos[ix + 2] = (Math.random() - 0.5) * RAIN_AREA.d;
      speeds[i] = THREE.MathUtils.lerp(FALL_MIN, FALL_MAX, Math.random());
    }

    if (pos[ix + 0] < -RAIN_AREA.w * 0.5) pos[ix + 0] += RAIN_AREA.w;
    if (pos[ix + 0] > RAIN_AREA.w * 0.5) pos[ix + 0] -= RAIN_AREA.w;
    if (pos[ix + 2] < -RAIN_AREA.d * 0.5) pos[ix + 2] += RAIN_AREA.d;
    if (pos[ix + 2] > RAIN_AREA.d * 0.5) pos[ix + 2] -= RAIN_AREA.d;

    changed = true;
  }

  if (changed) rainGeom.attributes.position.needsUpdate = true;
}

// ===== Env + *controlled* glow sprites
const rgbeLoader = new RGBELoader(manager);
rgbeLoader.load(hdrUrl, (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = tex;
  scene.environment = null;
});

const textureLoader = new THREE.TextureLoader(manager);

// --- NEW: single sprite creator and intensity-sync ---
let leftGlow, rightGlow, glowTexture;

function createGlow(position) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0 // start hidden
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(2, 2, 1);
  s.position.copy(position);
  scene.add(s);
  return s;
}

// preload texture once, then build both sprites
textureLoader.load(imgUrl, (tex) => {
  glowTexture = tex;
  leftGlow = createGlow(leftCarLight.position);
  rightGlow = createGlow(rightCarLight.position);
});

// keep glow opacity in sync with light intensity (0..150 → 0..1)
function syncHeadlightGlow() {
  if (!leftGlow || !rightGlow) return;
  const toAlpha = (i) => THREE.MathUtils.clamp(i / 150, 0, 1);
  leftGlow.material.opacity = toAlpha(leftCarLight.intensity);
  rightGlow.material.opacity = toAlpha(rightCarLight.intensity);
  leftGlow.visible = leftCarLight.intensity > 0.01;
  rightGlow.visible = rightCarLight.intensity > 0.01;
}

// ===== Scroll-linked lights/camera
gsap.to([leftCarLight, rightCarLight], {
  scrollTrigger: {
    trigger: "#section-1",
    start: "top bottom",
    end: "center bottom",
    scrub: true,
  },
  intensity: 150,
  onUpdate: syncHeadlightGlow // keep synced while scrubbing
});


let section4_tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#section-4",
    start: "top bottom",
    end: "bottom top",
    scrub: true,
    immediateRender: false
  }
});


let projects_tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#projects-section",
    start: "top bottom",
    end: "center top",
    scrub: true,
    immediateRender: false,
    invalidateOnRefresh: true
  }
});


ScrollTrigger.matchMedia({
  // Small phones (<400px)
  "(max-width: 599px)": function () {
    gsap.to(camera.position, {
      scrollTrigger: {
        trigger: "#section-3",
        start: "top top", 
        end: "bottom center",
        scrub: true,
      },
      z: 70,
      x: 0.05,
      overwrite: "auto"
    });

    section4_tl.to(camera.position, {
      x: -118,
      y: -2,
      z: 85
    }).to(camera.rotation, {
      x: -0.24234443,
      y: -2.19294443,
      z: -0.201213
    }, 0);

    projects_tl.to(camera.position, {
      x: -0.2,
      y: -5.5,
      z: -85,
      ease: "none"
    })
      .to(camera.rotation, {
        x: 0,
        y: -3.14,
        z: 0,
        ease: "none"
      }, "<");
  },

  // Medium devices (400px–767px)
  "(min-width: 600px) and (max-width: 2767px)": function () {
    gsap.to(camera.position, {
      scrollTrigger: {
        trigger: "#section-3",
        start: "top center",
        end: "bottom center",
        scrub: true,
      },
      z: 48,
    });
    section4_tl.to(camera.position, {
      x: -58,
      y: -2,
      z: -45
    }).to(camera.rotation, {
      x: -0.24234443,
      y: -2.19294443,
      z: -0.201213
    }, 0);


    projects_tl.to(camera.position, {
      x: -0.2,
      y: -5.5,
      z: -35,
      ease: "none"
    })
      .to(camera.rotation, {
        x: 0,
        y: -3.14,
        z: 0,
        ease: "none"
      }, "<");
  },
});


gsap.to(directionalLight, {
  scrollTrigger: {
    trigger: "#section-4",
    start: "top center",
    end: "bottom center",
    scrub: true,
  },
  intensity: 0.4,
});




projects_tl.to(directionalLight.position, {
  x: -20,
  y: 80,
  z: -50
});

// ===== Animate/render
const clock = new THREE.Clock();

ScrollTrigger.refresh();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateRain(delta);
  if (mixer && s6InView) mixer.update(delta);

  // NEW: always keep glow synced with current light values
  syncHeadlightGlow();

  composer.render();
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
