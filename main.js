import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";


gsap.registerPlugin(ScrollTrigger);
const scene = new THREE.Scene();

const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
directionalLight.position.set(10, 50, 10);
directionalLight.castShadow = true;
const lightc = new THREE.DirectionalLightHelper(directionalLight, 4)

scene.add(directionalLight);
scene.add(lightc)
directionalLight.intensity = 0

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(45,  sizes.width / sizes.height , 0.1, 1000);
camera.position.z = 27;
camera.position.y = -1;
camera.position.x = 0.05;
scene.add(camera);

const canvas = document.querySelector(".webgl");

const renderer = new THREE.WebGLRenderer({canvas});
renderer.setSize(sizes.width, sizes.height);
renderer.setClearColor(0x2e2d2b);

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


const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    //controls.update();
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    // directionalLight.intensity = scrollProgress * 9;
    // camera.position.z = 27 + scrollProgress / 2;
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

gsap.to(directionalLight, {
    scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
    },
    intensity: 10,
});

gsap.to(camera.position, {
    scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
    },
    z: 28, // Move camera along the Z axis (further away for better view)
});

gsap.to(camera.position, {
  scrollTrigger: {
    trigger: "#section-3",  // Trigger action when section 3 is in view
    start: "top center",  // Trigger when the top of the section reaches the center of the viewport
    end: "bottom top",  // End when the bottom of the section reaches the top of the viewport
    scrub: true,  // Smoothly scrub through the animation as you scroll
  },
  x: 40,  // Move camera along the X axis
  y: 2,  // Move camera along the Y axis
  z: 10, // Move camera along the Z axis (further away for better view)
  duration: 1,  // Optional duration (scrub should make this feel continuous)
});

gsap.to(camera.rotation, {
  scrollTrigger: {
    trigger: "#section-3",  // Trigger action when section 3 is in view
    start: "top center",  // Trigger when the top of the section reaches the center of the viewport
    end: "bottom top",  // End when the bottom of the section reaches the top of the viewport
    scrub: true,  // Smoothly scrub through the animation as you scroll
    markers: true,  // Enable markers for debugging (you can remove this in production)
  },
//   x: Math.PI / 4,  // Rotate camera by 45° (π/4 radians) on the X axis
  y: Math.PI / 2,  // Rotate camera by 90° (π/2 radians) on the Y axis
});