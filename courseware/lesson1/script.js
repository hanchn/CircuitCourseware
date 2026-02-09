import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff); // Light blue background

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 8);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// Floor
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xeeeeee,
    roughness: 0.8
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- Object Creation Helpers ---

// 1. Battery (AA style)
function createBattery() {
    const batteryGroup = new THREE.Group();
    batteryGroup.name = "battery";
    batteryGroup.userData = {
        title: "干电池 (电源)",
        desc: "我是电池，是电路的心脏！我身体里储存着化学能，可以转化成电能，为灯泡提供动力。我有正极(+)和负极(-)两个耳朵。"
    };

    // Main Body
    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 32);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Black wrapper
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.position.y = 1.25;
    batteryGroup.add(body);

    // Label (Yellow stripe)
    const labelGeo = new THREE.CylinderGeometry(0.61, 0.61, 1.5, 32, 1, true);
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = 1.25;
    batteryGroup.add(label);

    // Positive Terminal (Top bump)
    const posGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    const pos = new THREE.Mesh(posGeo, metalMat);
    pos.position.y = 2.6;
    pos.castShadow = true;
    batteryGroup.add(pos);

    // Negative Terminal (Bottom plate - visual only)
    const negGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 32);
    const neg = new THREE.Mesh(negGeo, metalMat);
    neg.position.y = 0.05;
    batteryGroup.add(neg);

    return batteryGroup;
}

// 2. Light Bulb
function createBulb() {
    const bulbGroup = new THREE.Group();
    bulbGroup.name = "bulb";
    bulbGroup.userData = {
        title: "小灯泡 (用电器)",
        desc: "我是小灯泡！当电流流过我的身体（灯丝）时，我会发光发热。我有两个连接点，分别在金属螺纹和底部的小黑点上。"
    };

    // Glass Bulb
    const glassGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const glassMat = new THREE.MeshPhysicalMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3, 
        roughness: 0, 
        metalness: 0,
        transmission: 0.9 
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = 1.8;
    glass.castShadow = true;
    bulbGroup.add(glass);

    // Metal Base (Screw part)
    const baseGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.3 });
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = 1.0;
    base.castShadow = true;
    bulbGroup.add(base);

    // Bottom Contact
    const contactGeo = new THREE.CylinderGeometry(0.1, 0.05, 0.2, 16);
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const contact = new THREE.Mesh(contactGeo, blackMat);
    contact.position.y = 0.5;
    bulbGroup.add(contact);

    return bulbGroup;
}

// Add objects to scene
const battery = createBattery();
battery.position.set(-2, 0, 0);
scene.add(battery);

const bulb = createBulb();
bulb.position.set(2, 0, 0);
scene.add(bulb);

// --- Interaction Logic ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// UI Elements
const infoPanel = document.getElementById('info-panel');
const infoTitle = document.getElementById('info-title');
const infoDesc = document.getElementById('info-desc');
const closeBtn = document.getElementById('close-btn');

function showInfo(title, desc) {
    infoTitle.innerText = title;
    infoDesc.innerText = desc;
    infoPanel.classList.remove('hidden');
}

closeBtn.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
});

function onMouseClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Intersect against our known objects
    // Note: We need to traverse up to find the group name if we hit a child mesh
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Find the first object that is part of our interactive groups
        let object = intersects[0].object;
        let group = null;

        // Traverse up to find the group
        while(object) {
            if (object.name === 'battery' || object.name === 'bulb') {
                group = object;
                break;
            }
            object = object.parent;
        }

        if (group) {
            showInfo(group.userData.title, group.userData.desc);
            
            // Simple bounce animation
            const initialY = group.position.y;
            // Reset others
            battery.position.y = 0;
            bulb.position.y = 0;
            
            group.position.y = 0.5;
            setTimeout(() => {
                group.position.y = 0;
            }, 300);
        }
    }
}

window.addEventListener('click', onMouseClick);

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
