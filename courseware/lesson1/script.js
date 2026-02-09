import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff); // Light blue background

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10); // Moved closer for tighter view
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
    pos.userData = {
        title: "正极 (+)",
        desc: "这是电池的正极，通常有一个小凸起。电流从这里流出来！"
    };
    batteryGroup.add(pos);

    // Negative Terminal (Bottom plate - visual only)
    const negGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 32);
    const neg = new THREE.Mesh(negGeo, metalMat);
    neg.position.y = 0.05;
    neg.userData = {
        title: "负极 (-)",
        desc: "这是电池的负极，通常是平平的底部。电流流了一圈后会回到这里。"
    };
    batteryGroup.add(neg);

    return batteryGroup;
}

// 2. Light Bulb
let bulbMaterial;
let filamentMaterial;
function createBulb() {
    const bulbGroup = new THREE.Group();
    bulbGroup.name = "bulb";
    bulbGroup.userData = {
        title: "小灯泡 (用电器)",
        desc: "我是小灯泡！当电流流过我的身体（灯丝）时，我会发光发热。我有两个连接点，分别在金属螺纹和底部的小黑点上。"
    };

    // Glass Bulb
    bulbMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3, 
        roughness: 0, 
        metalness: 0,
        transmission: 0.9,
        emissive: 0x000000
    });
    const glassGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const glass = new THREE.Mesh(glassGeo, bulbMaterial);
    glass.position.y = 1.8;
    glass.castShadow = true;
    bulbGroup.add(glass);

    // Filament (Tungsten Wire) - "M" shape
    filamentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555, // Dark grey when off
        emissive: 0x000000
    });
    
    // Filament supports
    const supportGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const s1 = new THREE.Mesh(supportGeo, supportMat);
    s1.position.set(-0.2, 1.4, 0);
    bulbGroup.add(s1);
    const s2 = new THREE.Mesh(supportGeo, supportMat);
    s2.position.set(0.2, 1.4, 0);
    bulbGroup.add(s2);

    // The coil itself
    const filamentPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, 1.8, 0),
        new THREE.Vector3(-0.1, 2.0, 0),
        new THREE.Vector3(0, 1.8, 0),
        new THREE.Vector3(0.1, 2.0, 0),
        new THREE.Vector3(0.2, 1.8, 0)
    ]);
    const filamentGeo = new THREE.TubeGeometry(filamentPath, 20, 0.015, 8, false);
    const filament = new THREE.Mesh(filamentGeo, filamentMaterial);
    bulbGroup.add(filament);

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

// 3. Switch (Knife Switch)
let switchLever;
let isSwitchClosed = false;
function createSwitch() {
    const group = new THREE.Group();
    group.name = "switch";
    group.userData = {
        title: "闸刀开关 (控制元件)",
        desc: "我是开关！我可以控制电路的通断。把闸刀合上，电路就通了；把闸刀拉开，电路就断了。"
    };

    // Base
    const baseGeo = new THREE.BoxGeometry(1.5, 0.2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Black plastic base
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);

    // Contacts (Metal clips)
    const clipGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    
    // Rear hinge
    const rearClip = new THREE.Mesh(clipGeo, metalMat);
    rearClip.position.set(0, 0.4, 1.0);
    group.add(rearClip);

    // Front contact
    const frontClip = new THREE.Mesh(clipGeo, metalMat);
    frontClip.position.set(0, 0.4, -1.0);
    group.add(frontClip);

    // Lever Group (Pivot at rear)
    switchLever = new THREE.Group();
    switchLever.position.set(0, 0.5, 1.0); // Pivot point
    
    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.2, 0.1, 2.2);
    // Move geometry so origin is at one end
    bladeGeo.translate(0, 0, -1.0); 
    const blade = new THREE.Mesh(bladeGeo, metalMat);
    switchLever.add(blade);

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red handle
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 2;
    handle.position.set(0, 0, -2.2);
    switchLever.add(handle);

    // Initial state: Open (Up 45 degrees)
    // Positive rotation lifts it UP relative to the hinge when rotated 180Y
    switchLever.rotation.x = Math.PI / 4; 
    
    group.add(switchLever);
    return group;
}

// Add objects to scene
const battery = createBattery();
battery.rotation.z = -Math.PI / 2; // Lie down
battery.position.set(-5.0, 0.6, 0); // Moved further left for more space
scene.add(battery);

const knifeSwitch = createSwitch();
knifeSwitch.position.set(0, 0.2, 0); // Center
knifeSwitch.rotation.y = Math.PI; // Rotate 180 deg so handle faces user
scene.add(knifeSwitch);

const bulb = createBulb();
bulb.position.set(3.5, 0, 0); // Closer to center
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
            if (object.name === 'battery' || object.name === 'bulb' || object.name === 'switch') {
                group = object;
                break;
            }
            object = object.parent;
        }

        if (group) {
            // Check if we hit a specific part with its own userData first (like battery terminals)
            // raycaster intersects are sorted by distance, so intersects[0] is the closest mesh
            // We need to check if that specific mesh has userData.title
            const hitMesh = intersects[0].object;
            if (hitMesh.userData && hitMesh.userData.title) {
                 showInfo(hitMesh.userData.title, hitMesh.userData.desc);
                 // Don't bounce the whole group if we clicked a terminal, maybe just flash it?
                 // For now, let's just return to avoid overriding with group info
                 return;
            }

            // Handle Switch Logic
            if (group.name === 'switch') {
                isSwitchClosed = !isSwitchClosed;
                // Animate Lever
                // Open state: Math.PI / 4 (Up)
                // Closed state: 0 degrees (flat)
                const targetRot = isSwitchClosed ? 0 : Math.PI / 4;
                
                // Simple animation
                const startRot = switchLever.rotation.x;
                const duration = 200;
                const startTime = Date.now();
                
                function animateSwitch() {
                    const now = Date.now();
                    const progress = Math.min((now - startTime) / duration, 1);
                    switchLever.rotation.x = startRot + (targetRot - startRot) * progress;
                    
                    if (progress < 1) {
                        requestAnimationFrame(animateSwitch);
                    } else {
                        // Animation done, check bulb
                        updateCircuitState();
                    }
                }
                animateSwitch();
                // return; // Removed to allow info panel to show
            }

            showInfo(group.userData.title, group.userData.desc);
            
            // Simple bounce animation
            if (group.name !== 'switch') { // Don't bounce switch to keep animation clean
                const initialY = group.position.y;
                // Reset others
                // battery.position.y = 0; // Removed: hardcoded 0 is wrong for new positions
                // bulb.position.y = 0;
                
                group.position.y += 0.5;
                setTimeout(() => {
                    group.position.y -= 0.5;
                }, 300);
            }
        }
    }
}

// Circuit State
function updateCircuitState() {
    if (isSwitchClosed) {
        // Light ON
        bulbMaterial.emissive.set(0xffff00);
        bulbMaterial.emissiveIntensity = 1;
        bulbMaterial.opacity = 0.8;
        filamentMaterial.color.set(0xffaa00);
        filamentMaterial.emissive.set(0xffaa00);
        filamentMaterial.emissiveIntensity = 2;

        if (!scene.getObjectByName('bulbLight')) {
            const light = new THREE.PointLight(0xffaa00, 5, 10);
            light.name = 'bulbLight';
            light.position.set(2, 2, 0);
            scene.add(light);
        }
    } else {
        // Light OFF
        bulbMaterial.emissive.set(0x000000);
        bulbMaterial.opacity = 0.3;
        filamentMaterial.color.set(0x555555);
        filamentMaterial.emissive.set(0x000000);
        filamentMaterial.emissiveIntensity = 0;

        const light = scene.getObjectByName('bulbLight');
        if (light) scene.remove(light);
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
