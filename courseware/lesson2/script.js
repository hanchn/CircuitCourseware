import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.2; // Don't go below floor
controls.minDistance = 3;
controls.maxDistance = 15;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- Models & Logic ---

const components = [];
const connectionPoints = [];
let wires = [];
let isDrawing = false;
let currentLine = null;
let startPoint = null;

// Materials
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const pointHoverMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const wireMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 3 });

// 1. Battery
function createBattery() {
    const group = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 2.5, 32),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    body.position.y = 1.25;
    body.castShadow = true;
    group.add(body);

    // Label
    const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.61, 0.61, 1.5, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    label.position.y = 1.25;
    group.add(label);

    // Positive
    const pos = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    pos.position.y = 2.6;
    group.add(pos);

    // Connection Point Positive
    const cpPos = new THREE.Mesh(new THREE.SphereGeometry(0.15), pointMat.clone());
    cpPos.position.set(0, 2.7, 0);
    cpPos.userData = { type: 'point', parent: 'battery', pole: 'pos' };
    group.add(cpPos);
    connectionPoints.push(cpPos);

    // Connection Point Negative
    const cpNeg = new THREE.Mesh(new THREE.SphereGeometry(0.15), pointMat.clone());
    cpNeg.position.set(0, 0.1, 0); // Near bottom
    cpNeg.userData = { type: 'point', parent: 'battery', pole: 'neg' };
    group.add(cpNeg);
    connectionPoints.push(cpNeg);

    return group;
}

// 2. Bulb
let bulbMaterial; // Ref to change color
function createBulb() {
    const group = new THREE.Group();
    
    // Glass
    bulbMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3, 
        transmission: 0.9,
        roughness: 0,
        emissive: 0x000000
    });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), bulbMaterial);
    glass.position.y = 1.8;
    group.add(glass);

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    base.position.y = 1.0;
    group.add(base);

    // Connection Point 1 (Side of base)
    const cp1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), pointMat.clone());
    cp1.position.set(0.4, 1.0, 0);
    cp1.userData = { type: 'point', parent: 'bulb', id: 1 };
    group.add(cp1);
    connectionPoints.push(cp1);

    // Connection Point 2 (Bottom)
    const cp2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), pointMat.clone());
    cp2.position.set(0, 0.5, 0);
    cp2.userData = { type: 'point', parent: 'bulb', id: 2 };
    group.add(cp2);
    connectionPoints.push(cp2);

    return group;
}

// Init Objects
const battery = createBattery();
battery.position.set(-2, 0, 0);
scene.add(battery);

const bulb = createBulb();
bulb.position.set(2, 0, 0);
scene.add(bulb);

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // For raycasting against a virtual plane if needed, but we use objects here

function getIntersects(event, objects) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(objects, false);
}

// Hover Effect
window.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        // Update line end position
        const intersects = getIntersects(e, [floor, battery, bulb]); // Intersect against floor for drawing in space? 
        // Better: Plane at height of start point? Or just project to screen plane?
        // Simple approach: Unproject mouse to 3D at specific distance or intersect invisible plane facing camera
        
        let targetPos = new THREE.Vector3();
        
        // Find intersection with floor or objects to give depth
        const hit = raycaster.intersectObjects([floor, ...connectionPoints], true)[0];
        if (hit) {
            targetPos.copy(hit.point);
        } else {
             // Fallback: project ray
            raycaster.ray.at(5, targetPos);
        }

        if (currentLine) {
            const positions = currentLine.geometry.attributes.position.array;
            positions[3] = targetPos.x;
            positions[4] = targetPos.y;
            positions[5] = targetPos.z;
            currentLine.geometry.attributes.position.needsUpdate = true;
        }
        return;
    }

    // Highlight connection points
    const intersects = getIntersects(e, connectionPoints);
    connectionPoints.forEach(p => p.material.color.set(0xff0000)); // Reset
    document.body.style.cursor = 'default';
    
    if (intersects.length > 0) {
        intersects[0].object.material.color.set(0x00ff00);
        document.body.style.cursor = 'crosshair';
        controls.enabled = false; // Disable orbit when hovering point
    } else {
        controls.enabled = true;
    }
});

window.addEventListener('mousedown', (e) => {
    const intersects = getIntersects(e, connectionPoints);
    if (intersects.length > 0) {
        isDrawing = true;
        startPoint = intersects[0].object;
        controls.enabled = false;

        // Create temp line
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            startPoint.getWorldPosition(new THREE.Vector3()).x,
            startPoint.getWorldPosition(new THREE.Vector3()).y,
            startPoint.getWorldPosition(new THREE.Vector3()).z,
            startPoint.getWorldPosition(new THREE.Vector3()).x,
            startPoint.getWorldPosition(new THREE.Vector3()).y,
            startPoint.getWorldPosition(new THREE.Vector3()).z
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        currentLine = new THREE.Line(geometry, wireMat);
        scene.add(currentLine);
    }
});

window.addEventListener('mouseup', (e) => {
    if (isDrawing) {
        isDrawing = false;
        controls.enabled = true;
        
        const intersects = getIntersects(e, connectionPoints);
        let endPoint = null;

        if (intersects.length > 0) {
            endPoint = intersects[0].object;
        }

        // Validate connection
        if (endPoint && endPoint !== startPoint) {
            // Valid connection, snap line to end point
            const positions = currentLine.geometry.attributes.position.array;
            const endPos = endPoint.getWorldPosition(new THREE.Vector3());
            positions[3] = endPos.x;
            positions[4] = endPos.y;
            positions[5] = endPos.z;
            currentLine.geometry.attributes.position.needsUpdate = true;
            
            // Store wire logic
            wires.push({
                start: startPoint.userData,
                end: endPoint.userData,
                mesh: currentLine
            });
            
            checkCircuit();
        } else {
            // Invalid, remove line
            scene.remove(currentLine);
        }
        currentLine = null;
        startPoint = null;
    }
});

// --- Circuit Logic ---
function checkCircuit() {
    // Goal: Connect Battery(+) to Bulb(Any) AND Battery(-) to Bulb(Any)
    // Simplified logic: Check if we have wires connecting Battery to Bulb
    
    let batteryPosConnected = false;
    let batteryNegConnected = false;

    wires.forEach(wire => {
        const s = wire.start;
        const e = wire.end;
        
        // Check connection: Battery Pos -> Bulb
        if ((s.parent === 'battery' && s.pole === 'pos' && e.parent === 'bulb') ||
            (e.parent === 'battery' && e.pole === 'pos' && s.parent === 'bulb')) {
            batteryPosConnected = true;
        }

        // Check connection: Battery Neg -> Bulb
        if ((s.parent === 'battery' && s.pole === 'neg' && e.parent === 'bulb') ||
            (e.parent === 'battery' && e.pole === 'neg' && s.parent === 'bulb')) {
            batteryNegConnected = true;
        }
    });

    if (batteryPosConnected && batteryNegConnected) {
        lightUp();
    }
}

function lightUp() {
    bulbMaterial.emissive.set(0xffff00); // Yellow glow
    bulbMaterial.emissiveIntensity = 1;
    bulbMaterial.opacity = 0.8;
    
    // Add point light for effect
    if (!scene.getObjectByName('bulbLight')) {
        const light = new THREE.PointLight(0xffaa00, 5, 10);
        light.name = 'bulbLight';
        light.position.set(2, 2, 0);
        scene.add(light);
    }

    document.getElementById('success-msg').style.display = 'block';
}

function resetCircuit() {
    // Remove wires
    wires.forEach(w => scene.remove(w.mesh));
    wires = [];
    
    // Reset bulb
    bulbMaterial.emissive.set(0x000000);
    bulbMaterial.opacity = 0.3;
    const light = scene.getObjectByName('bulbLight');
    if (light) scene.remove(light);

    document.getElementById('success-msg').style.display = 'none';
}

document.getElementById('reset-btn').addEventListener('click', resetCircuit);

// Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
