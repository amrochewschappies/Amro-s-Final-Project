import * as THREE from "three"; 
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";


gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
gsap.registerPlugin(ScrollTrigger);

/* ------- Loader DOM refs ------- */
const loaderEl = document.getElementById("loader");
const barEl = document.getElementById("loader-bar");
const textEl = document.getElementById("loader-text");

/* ------- LoadingManager ------- */
const manager = new THREE.LoadingManager();

manager.onStart = () => {
  if (textEl) textEl.textContent = "0%";
  if (barEl) barEl.style.width = "0%";
};

manager.onProgress = (url, loaded, total) => {
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  if (textEl) textEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
};

manager.onLoad = () => {
  // Fade out overlay, fade in canvas
  gsap.to("#loader", { autoAlpha: 0, duration: 0.5, onComplete: () => loaderEl?.remove() });
  gsap.to(".webgl", { autoAlpha: 1, duration: 0.5 });
};

const scene = new THREE.Scene();

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(45,  sizes.width / sizes.height , 0.1, 10000);
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
rightCarLight.position.set(6.15,-0.3,20)
rightCarLight.castShadow = false
rightCarLight.target.position.copy(camera.position);
scene.add(rightCarLight.target);
scene.add(rightCarLight)

const canvas = document.querySelector(".webgl");

const renderer = new THREE.WebGLRenderer({canvas});
renderer.setSize(sizes.width, sizes.height);
renderer.setClearColor(0x000000);
renderer.domElement.style.opacity = 0;

// Set up the post-processing pipeline
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Set up the bloom pass specifically for the left car light
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // Strength of bloom
  0.4, // Bloom radius
  0.85 // Bloom threshold
);
composer.addPass(bloomPass);

const gltfLoader = new GLTFLoader(manager);
// 1) Keep a list of actions
let mixer;
let actions = [];

gltfLoader.load("../Assets/Wheels.glb", (gltf) => {
  gltf.scene.scale.set(2, 2, 2);
  scene.add(gltf.scene);

  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);

    actions = gltf.animations.map((clip) => {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.enabled = true;
      a.play();          // start them once...
      a.paused = true;   // ...but keep them paused until section 2 is visible
      return a;
    });

    // 2) ScrollTrigger that controls play/pause for ALL actions
    ScrollTrigger.create({
      trigger: "#section-4asdasd",
      start: "top center",
      end: "bottom center",
      onEnter: () => { actions.forEach(a => a.paused = false); },
      onLeave: () => { actions.forEach(a => a.paused = true); },
      onEnterBack: () => { actions.forEach(a => a.paused = false); },
      onLeaveBack: () => { actions.forEach(a => a.paused = true); },
      // If you want them to RESTART each time you re-enter, add:
      // onEnter: () => { actions.forEach(a => { a.reset(); a.paused = false; }); },
      // onEnterBack: () => { actions.forEach(a => { a.reset(); a.paused = false; }); },
    });
  }
}, undefined, (err) => console.error("GLB load error:", err));

/* -------- Rain (Points) -------- */
const RAIN_COUNT = 15000;                       // adjust for perf
const RAIN_AREA = { w: 160, h: 120, d: 160 };   // box around camera
const FALL_MIN = 20, FALL_MAX = 34;             // m/s range
const WIND = { x: 1.2, z: -0.6 };               // sideways drift

// Make rain follow the camera so you're always inside it
const rainGroup = new THREE.Group();
camera.add(rainGroup);

const rainGeom = new THREE.BufferGeometry();
const positions = new Float32Array(RAIN_COUNT * 3);
const speeds    = new Float32Array(RAIN_COUNT);

// Spawn drops in a box centered on camera
for (let i = 0; i < RAIN_COUNT; i++) {
  const ix = i * 3;
  positions[ix + 0] = (Math.random() - 0.5) * RAIN_AREA.w;
  positions[ix + 1] = Math.random() * RAIN_AREA.h * 0.5; // start mostly above
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

// per-frame updater
function updateRain(dt) {
  const pos = rainGeom.attributes.position.array;
  let changed = false;

  for (let i = 0; i < RAIN_COUNT; i++) {
    const ix = i * 3;

    // fall
    pos[ix + 1] -= speeds[i] * dt;
    // wind
    pos[ix + 0] += WIND.x * dt;
    pos[ix + 2] += WIND.z * dt;

    // recycle when below the box
    if (pos[ix + 1] < -RAIN_AREA.h * 0.5) {
      pos[ix + 1] = RAIN_AREA.h * 0.5;
      pos[ix + 0] = (Math.random() - 0.5) * RAIN_AREA.w;
      pos[ix + 2] = (Math.random() - 0.5) * RAIN_AREA.d;
      speeds[i] = THREE.MathUtils.lerp(FALL_MIN, FALL_MAX, Math.random());
    }

    // wrap X/Z so particles don’t drift away forever
    if (pos[ix + 0] < -RAIN_AREA.w * 0.5) pos[ix + 0] += RAIN_AREA.w;
    if (pos[ix + 0] >  RAIN_AREA.w * 0.5) pos[ix + 0] -= RAIN_AREA.w;
    if (pos[ix + 2] < -RAIN_AREA.d * 0.5) pos[ix + 2] += RAIN_AREA.d;
    if (pos[ix + 2] >  RAIN_AREA.d * 0.5) pos[ix + 2] -= RAIN_AREA.d;

    changed = true;
  }

  if (changed) rainGeom.attributes.position.needsUpdate = true;
}



let scrollProgress = 0; // Variable to store scroll progress
let maxScroll = document.body.scrollHeight - window.innerHeight;

// Update the scroll progress on scroll
window.addEventListener("scroll", () => {
    scrollProgress = window.scrollY / maxScroll; // Get scroll percentage
});

const rgbeLoader = new RGBELoader(manager);
rgbeLoader.load('../Assets/DarkStorm4K.hdr', (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  // scene.environment = tex;   // for PBR reflections
  scene.background = tex;    // if you want to see it
  scene.environment = null;
});

const textureLoader = new THREE.TextureLoader(manager);
textureLoader.load("../Assets/Car Light.png", (texture) => {
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const glowSprite = new THREE.Sprite(spriteMaterial);
  glowSprite.scale.set(2, 2, 1); // Adjust size
  glowSprite.position.copy(leftCarLight.position);

  scene.add(glowSprite);
});

textureLoader.load("../Assets/Car Light.png", (texture) => {
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const rightGlowSprite = new THREE.Sprite(spriteMaterial);
  rightGlowSprite.scale.set(2, 2, 1); // Adjust size
  rightGlowSprite.position.copy(rightCarLight.position);

  scene.add(rightGlowSprite);
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updateRain(delta);
    if (mixer) mixer.update(delta);
    composer.render(); // Use composer.render() instead of renderer.render()
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
    z: 48, // Move camera along the Z axis (further away for better view)
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
    start: "top center",
    end: "bottom center",
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
    start: "top center",
    end: "bottom top",
    scrub: true,
    immediateRender: false,
    invalidateOnRefresh: true
  }
});

projects_tl.to(camera.position, {
  x: -1.2,
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


