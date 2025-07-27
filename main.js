import * as THREE from "three"; 
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
gsap.registerPlugin(ScrollTrigger);
const scene = new THREE.Scene();

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(45,  sizes.width / sizes.height , 0.1, 1000);
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
rightCarLight.position.set(5.85,-0.3,20)
rightCarLight.castShadow = false
rightCarLight.target.position.copy(camera.position);
scene.add(rightCarLight.target);
scene.add(rightCarLight)

const canvas = document.querySelector(".webgl");

const renderer = new THREE.WebGLRenderer({canvas});
renderer.setSize(sizes.width, sizes.height);
renderer.setClearColor(0x000000);

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

const gltfLoader = new GLTFLoader();
let mixer;

gltfLoader.load("./Assets/Datsun.glb", (gltf) => {
    gltf.scene.scale.set(2, 2, 2);
    scene.add(gltf.scene);

    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
    }
});

let scrollProgress = 0; // Variable to store scroll progress
let maxScroll = document.body.scrollHeight - window.innerHeight;

// Update the scroll progress on scroll
window.addEventListener("scroll", () => {
    scrollProgress = window.scrollY / maxScroll; // Get scroll percentage
});

const textureLoader = new THREE.TextureLoader();
textureLoader.load("./Assets/Car Light.png", (texture) => {
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

textureLoader.load("./Assets/Car Light.png", (texture) => {
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

gsap.to(directionalLight, {
    scrollTrigger: {
        trigger: "#section-3",
        start: "top top",
        end: "bottom top",
        scrub: true,
    },
    intensity: 10,
});

gsap.to(camera.position, {
    scrollTrigger: {
        trigger: "#section-3",
        start: "top top",
        end: "bottom top",
        scrub: true,
    },
    z: 48, // Move camera along the Z axis (further away for better view)
});


gsap.to(camera.position, {
    scrollTrigger: {
        trigger: "#section-4",
        start: "top center",
        end: "bottom top",
        scrub: true,
    },
    x: -28,
    y: 20,
    z: 65, // Move camera along the Z axis (further away for better view)
});

gsap.to(camera.rotation, {
    scrollTrigger: {
        trigger: "#section-4",
        start: "top center",
        end: "bottom center",
        scrub: true,
    },
    x: -0.24234443,
    y: -0.1294443,
    z: -0.01213
});

gsap.to(camera.position, {
  scrollTrigger: {
    trigger: "#projects-section",
    start: "top center",
    end: "bottom top",
    scrub: true
  },
  motionPath: {
    path: [
      { x: camera.position.x, y: camera.position.y, z: camera.position.z }, // current camera position
      { x: -10, y: -5, z: -20 },  // control/midpoint — adjust for curve
      { x: 7.8, y: -11.5, z: -55 } // final camera destination
    ],
    curviness: 1.5,
    autoRotate: false
  },
  duration: 1
});

gsap.to(camera.rotation, {
    scrollTrigger: {
        trigger: "#projects-section",
        start: "top center",
        end: "bottom top",
        scrub: true,
    },
    x: 0,
    y: -3.72,
    z: 0
});

gsap.to(directionalLight.position, {
    scrollTrigger: {
        trigger: "#projects-section",
        start: "top top",
        end: "bottom top",
        scrub: true,
    },
    x: -20,
    y: 80,
    z: -30
});
