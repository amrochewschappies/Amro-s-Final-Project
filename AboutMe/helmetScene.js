import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---- Postprocessing imports ----
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { LuminosityShader } from 'three/examples/jsm/shaders/LuminosityShader.js';

// ===== Config =====
const ANIM_DELAY_MS = 2000; // start animation after 2s
const CLIP_INDEX = 0;       // which animation to play if there are multiple

// ===== Scene =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 17, 40);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('three-canvas'),
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 10, 10);
scene.add(dirLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const grayPass = new ShaderPass(LuminosityShader);
composer.addPass(grayPass);

const glitchPass = new GlitchPass();
glitchPass.goWild = false; 
composer.addPass(glitchPass);

const filmPass = new FilmPass(
  0.35,
  0.025, 
  648,   
  false 
);
composer.addPass(filmPass);

const loader = new GLTFLoader();
let mixer = null;
let action = null;
let hasStarted = false;

const MODEL_URL = new URL('./helmet-model.glb', import.meta.url).toString();

loader.load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations[Math.min(CLIP_INDEX, gltf.animations.length - 1)];
      action = mixer.clipAction(clip);

      action.setLoop(THREE.LoopOnce, 0);
      action.clampWhenFinished = true;
      action.paused = true;

      mixer.addEventListener('finished', () => {
        action.paused = true;
        action.enabled = true;
        action.time = action.getClip().duration;
        mixer.update(0);
      });

      setTimeout(() => {
        if (action && !hasStarted) {
          hasStarted = true;
          action.reset();
          action.paused = false;
          action.play();


          const overlay = document.querySelector('.about-overlay');
          if (overlay) overlay.classList.add('visible');
        }
      }, ANIM_DELAY_MS);
    } else {
      setTimeout(() => {
        const overlay = document.querySelector('.about-overlay');
        if (overlay) overlay.classList.add('visible');
      }, ANIM_DELAY_MS);
    }
  },
  undefined,
  (error) => console.error('Error loading GLTF:', error)
);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  composer.render();
}
animate();
