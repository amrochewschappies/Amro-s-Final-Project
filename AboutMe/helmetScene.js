import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ===== Config =====
const ANIM_DELAY_MS = 2000; // <- start animation after 3s (change as you like)
const CLIP_INDEX = 0;       // <- which animation to play if there are multiple

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 17, 40);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('three-canvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const sceneLight = new THREE.AmbientLight(0xffffff, 5);
scene.add(sceneLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(3, 10, 10);
scene.add(dirLight);

// Load model + setup animation (play once after delay)
const loader = new GLTFLoader();
let mixer = null;
let action = null;
let hasStarted = false;

loader.load(
    './Helmet Model.glb',
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const clip = gltf.animations[Math.min(CLIP_INDEX, gltf.animations.length - 1)];
            action = mixer.clipAction(clip);

            // Play ONCE, keep last frame
            action.setLoop(THREE.LoopOnce, 0);
            action.clampWhenFinished = true;

            // Start paused; trigger later
            action.paused = true;

            // When it finishes, stop updating the mixer to save CPU
            mixer.addEventListener('finished', () => {
                // Freeze exactly on the last frame and keep the pose
                action.paused = true;
                action.enabled = true;                   // keep its influence active
                action.time = action.getClip().duration; // ensure it's at the final frame
                mixer.update(0);                         // apply pose immediately
                // (Do NOT call mixer.stopAllAction())
            });

            // Delay start
            setTimeout(() => {
                if (action && !hasStarted) {
                    hasStarted = true;
                    action.reset();
                    action.paused = false;
                    action.play();
                    document.querySelector('.about-overlay').classList.add('visible'); // triggers fade-in
                }
            }, ANIM_DELAY_MS);
        } else {
            // No animations: still fade in after the same delay
            setTimeout(() => {
                document.querySelector('.about-overlay').classList.add('visible');
            }, ANIM_DELAY_MS);
        }
    },
    undefined,
    (error) => console.error('Error loading GLTF:', error)
);

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}
animate();
