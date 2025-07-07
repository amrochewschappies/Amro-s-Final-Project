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

gltfLoader.load("./Datsun.glb", (gltf) => {
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
    directionalLight.intensity = scrollProgress * 1.5;
    camera.position.z = 27 + scrollProgress / 2;
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
