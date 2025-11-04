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
  const arc    = document.getElementById('arc');
  const needle = document.getElementById('needle');
  const spd    = document.getElementById('spd');

  if (arc)    arc.setAttribute('stroke-dashoffset', ARC_LEN * (1 - pct / 100));
  if (needle) needle.setAttribute('transform', `rotate(${ -90 + (pct * 1.8) } 100 120)`); // -90..+90
  if (spd)    spd.textContent = Math.round(pct);
}

function finishLoader() {
  gsap.to("#loader", { autoAlpha: 0, duration: 0.5, onComplete: () => {
    document.getElementById('loader')?.remove();
  }});
  gsap.to(".webgl", { autoAlpha: 1, duration: 0.5 });
  ScrollTrigger.refresh();
}


const manager = new THREE.LoadingManager();

manager.onStart = () => {
  setLoaderProgress(0);
};

manager.onProgress = (_url, loaded, total) => {
  const pct = total ? (loaded / total) * 100 : 0;
  setLoaderProgress(pct);
};

manager.onLoad = () => {
  setLoaderProgress(100);
  finishLoader();
};

const scene = new THREE.Scene();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 10000);
camera.position.z = 32;
camera.position.y = -2;
camera.position.x = 0.05;
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
renderer.setSize(sizes.width, sizes.height);
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
composer.addPass(bloomPass);

const gltfLoader = new GLTFLoader(manager);
let mixer;
let actions = [];


const glbUrl = new URL('../Assets/Prefinal.glb', import.meta.url).href;
const hdrUrl = new URL('../Assets/DarkStorm4K.hdr', import.meta.url).href;
const imgUrl = new URL('../Assets/Car Light.png', import.meta.url).href;


gltfLoader.load(glbUrl, (gltf) => {
  gltf.scene.scale.set(2, 2, 2);
  scene.add(gltf.scene);

  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);

    actions = gltf.animations.map((clip) => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.enabled = true;
      a.play();
      a.paused = true;
      return a;
    });

    const toFirstFrame = () => {
      if (!mixer) return;
      actions.forEach(a => {
        a.enabled = true;
        a.reset();     // sets time=0 and weight=1
        a.paused = true;
      });
      mixer.setTime(0); // make sure mixer evaluates at 0
    };

    const playFromStart = () => {
      toFirstFrame();
      actions.forEach(a => (a.paused = false));
    };

    const section6RevealTL = gsap.timeline({ paused: true });
    // After you create `actions` (keep your existing code above intact)
    section6RevealTL
      .add(() => {
        // Heading prep
        gsap.set(s6Heading, { zIndex: 10000, opacity: 0 });
        setTimeout(() => {
          s6Heading?.classList.add('s6-blink'); // optional blink
        }, 2000);
      })
      .to({}, { duration: 2.9 }) // hold on black while blinking
      .add(() => s6Heading?.classList.remove('s6-blink'))
      .add(() => {
        // Heading prep
        gsap.set(s6Heading, { zIndex: 10000, opacity: 1 });
      })
      .to({}, { duration: 0.3 }) // settle
      .add(() => {
        // Timed fade out of this specific blackout
        unlockBlackout("s6-intro");
        if (s6InView) actions.forEach(a => a.paused = false);
        else {
          actions.forEach(a => { a.reset(); a.paused = true; });
          mixer?.setTime(0);
        }
      })
      .add(async () => {
        if (audioDir.current) {
          await audioDir._fadeMasterTo(0, 5.2);   // fade out over 1.2s
          audioDir.stop();
        }
        await audioDir.start("drop");
      }, "+=0.8")


    ScrollTrigger.create({
      trigger: "#section-6",
      start: "top center",
      end: "bottom center",

      onEnter: () => {
        s6InView = true;
        actions.forEach(a => { a.enabled = true; a.reset(); a.paused = true; });
        mixer?.setTime(0);
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;

        lockBlackout("s6-intro");            // 🔒 name this lock
        section6RevealTL.restart(true);      // run reveal animation
      },

      onEnterBack: () => {
        s6InView = true;
        actions.forEach(a => { a.enabled = true; a.reset(); a.paused = true; });
        mixer?.setTime(0);
        rightCarLight.intensity = 0;
        leftCarLight.intensity = 0;

        lockBlackout("s6-intro");
        section6RevealTL.restart(true);
      },

      onLeave: () => {
        s6InView = false;
        rightCarLight.intensity = 150;
        leftCarLight.intensity = 150;
        actions.forEach(a => { a.reset(); a.paused = true; });
        mixer?.setTime(0);

        unlockBlackout("s6-intro");          // 🔓 make sure it unlocks when leaving
        section6RevealTL.pause(0);
      },

      onLeaveBack: () => {
        s6InView = false;
        rightCarLight.intensity = 150;
        leftCarLight.intensity = 150;
        actions.forEach(a => { a.reset(); a.paused = true; });
        mixer?.setTime(0);

        unlockBlackout("s6-intro");
        section6RevealTL.pause(0);
      }
    });

  }
}, undefined, (err) => console.error("GLB load error:", err));

// === NEW BLACKOUT CONTROL SYSTEM ===
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

// Bridge 4→6
let playedBlackout4_6 = false;

// Bridge 4→6
ScrollTrigger.create({
  trigger: "#bridge-4-6",
  start: "top top",
  end: "bottom top",
  // NO scrub here
  onEnter: () => {
    lockBlackout("bridge-4-6");

    // fire only once per pass; remove the guard if you want it every time
    if (!playedBlackout4_6) {
      playedBlackout4_6 = true;

      // 1) make sure we’re on the verse right now (optional, keeps things tidy)
      audioDir.switchTo("verse", { mask: true, quantizeToBar: false });

      // 2) play interlude while screen is black; switch to "drop" when it ends
      audioDir.playInterludeAndSwitch(
        new URL("../Assets/Flicker.mp3", import.meta.url).toString(),
        "drop",
        {
          duckTo: 0,          // fully duck verse under blackout
          interludeGain: 1.0, // interlude loudness
          crossfade: 0.25
        }
      );
    }
  },
  onEnterBack: () => lockBlackout("bridge-4-6"),
  onLeave: () => unlockBlackout("bridge-4-6"),
  onLeaveBack: () => unlockBlackout("bridge-4-6"),

  refreshPriority: 10, // ensure bridges register early
});

// Bridge 6→7
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



let scrollProgress = 0;
let maxScroll = document.body.scrollHeight - window.innerHeight;


window.addEventListener("scroll", () => {
  scrollProgress = window.scrollY / maxScroll;
});

const rgbeLoader = new RGBELoader(manager);
rgbeLoader.load(hdrUrl, (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  // scene.environment = tex;
  scene.background = tex;
  scene.environment = null;
});

const textureLoader = new THREE.TextureLoader(manager);
textureLoader.load(imgUrl, (texture) => {
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const glowSprite = new THREE.Sprite(spriteMaterial);
  glowSprite.scale.set(2, 2, 1);
  glowSprite.position.copy(leftCarLight.position);

  scene.add(glowSprite);
});

textureLoader.load(imgUrl, (texture) => {
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const rightGlowSprite = new THREE.Sprite(spriteMaterial);
  rightGlowSprite.scale.set(2, 2, 1);
  rightGlowSprite.position.copy(rightCarLight.position);

  scene.add(rightGlowSprite);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateRain(delta);
  if (mixer && s6InView) mixer.update(delta);
  composer.render();
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

gsap.to([leftCarLight, rightCarLight], {
  scrollTrigger: {
    trigger: "#section-1",
    start: "top bottom",
    end: "centre top",
    scrub: true,
  },
  intensity: 150,
});


// gsap.to(directionalLight, {
//     scrollTrigger: {
//         trigger: "#section-1",
//         start: "top bottom",
//         end: "bottom center",
//         scrub: true,
//     },
//     intensity: 0,
// });

// gsap.to(directionalLight, {
//     scrollTrigger: {
//         trigger: "#section-3",               
//         start: "top center",
//         end: "bottom center",
//         scrub: true,
//     },
//     intensity: 10,
// });

gsap.to(camera.position, {
  scrollTrigger: {
    trigger: "#section-3",
    start: "top center",
    end: "bottom center",
    scrub: true,
  },
  z: 48,
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



let section4_tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#section-4",
    start: "top bottom",
    end: "bottom top",
    scrub: true,
    immediateRender: false
  }
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

projects_tl.to(directionalLight.position, {
  x: -20,
  y: 80,
  z: -50
})


