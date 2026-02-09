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
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff3300 }); // Brighter red
const pointHoverMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const haloMat = new THREE.MeshBasicMaterial({ 
    color: 0xff3300, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
});

// Helper to create enhanced connection point
function createConnectionPoint(userData) {
    const group = new THREE.Group();
    
    // 1. Core Sphere (The clickable part)
    const coreGeo = new THREE.SphereGeometry(0.25, 16, 16); // Larger core
    const core = new THREE.Mesh(coreGeo, pointMat.clone());
    core.userData = userData; // Raycaster hits this
    group.add(core);

    // 2. Halo Ring (Visual aid)
    const haloGeo = new THREE.RingGeometry(0.3, 0.5, 32);
    const halo = new THREE.Mesh(haloGeo, haloMat.clone());
    halo.name = "halo";
    // Make halo always face camera or just lie flat? 
    // Let's make it a billboard or a sphere shell?
    // Sphere shell is better for 3D
    const haloShellGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const haloShell = new THREE.Mesh(haloShellGeo, haloMat.clone());
    haloShell.name = "halo";
    group.add(haloShell);

    connectionPoints.push(core); // We interact with the core
    return group;
}

const wireMat = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50, // Dark blue-grey like insulation
    roughness: 0.5,
    metalness: 0.1
});

// Helper to create wire mesh
function updateWireMesh(mesh, startPos, endPos, bendFactor = 1) {
    // Create a quadratic curve for slack
    // Midpoint is average of start/end + some offset
    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    
    // Calculate distance to adjust slack
    const dist = startPos.distanceTo(endPos);
    
    // Change to "Arc Up" instead of "Gravity Sag" to clear the battery body
    // Base height arc: always arc up at least 1.0 units, plus more for longer wires
    mid.y += 1.0 + dist * 0.2; 
    
    // Automatic Isolation: Bend outward/inward based on factor to avoid crossing
    // Increase Z separation to go AROUND the battery cylinder (radius 0.6)
    // Using a larger factor (0.6) to ensure we clear the radius even if close
    mid.z += dist * 0.5 * bendFactor;

    // Additional check: If wire is very long (crossing the battery), lift it more
    if (dist > 3) {
        mid.y += 0.5;
    }

    const curve = new THREE.QuadraticBezierCurve3(
        startPos,
        mid,
        endPos
    );

    const geometry = new THREE.TubeGeometry(curve, 20, 0.08, 8, false);
    
    if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = geometry;
    } else {
        mesh = new THREE.Mesh(geometry, wireMat);
        mesh.castShadow = true;
    }
    return mesh;
}

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
    const cpPosGroup = createConnectionPoint({ type: 'point', parent: 'battery', pole: 'pos' });
    cpPosGroup.position.set(2.8, 0, 0); 
    
    // Add text label for "+"
    const canvasPos = document.createElement('canvas');
    const ctxPos = canvasPos.getContext('2d');
    canvasPos.width = 64; canvasPos.height = 64;
    // Transparent background
    ctxPos.fillStyle = '#ff0000';
    ctxPos.font = 'bold 48px Arial';
    ctxPos.fillText('+', 15, 50);
    const texPos = new THREE.CanvasTexture(canvasPos);
    const labelPos = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPos, depthTest: false })); // Disable depth test to see through? No, just keep it simple.
    // Actually, SpriteMaterial is transparent by default if texture has alpha.
    // Let's ensure connection point is interactive. 
    // The core sphere is added to connectionPoints in createConnectionPoint.
    // The label is just visual.
    labelPos.position.set(0, 0.5, 0); // Float above point
    labelPos.scale.set(0.5, 0.5, 0.5);
    cpPosGroup.add(labelPos);
    
    group.add(cpPosGroup);

    // Connection Point Negative
    const cpNegGroup = createConnectionPoint({ type: 'point', parent: 'battery', pole: 'neg' });
    cpNegGroup.position.set(-0.2, 0, 0);
    
    // Add text label for "-"
    const canvasNeg = document.createElement('canvas');
    const ctxNeg = canvasNeg.getContext('2d');
    canvasNeg.width = 64; canvasNeg.height = 64;
    ctxNeg.fillStyle = '#000000';
    ctxNeg.font = 'bold 48px Arial';
    ctxNeg.fillText('-', 20, 45);
    const texNeg = new THREE.CanvasTexture(canvasNeg);
    const labelNeg = new THREE.Sprite(new THREE.SpriteMaterial({ map: texNeg }));
    labelNeg.position.set(0, 0.5, 0); // Float above point
    labelNeg.scale.set(0.5, 0.5, 0.5);
    cpNegGroup.add(labelNeg);

    group.add(cpNegGroup);

    return group;
}

// 2. Bulb
let bulbMaterial; // Ref to change color
let filamentMaterial;
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
    group.add(s1);
    const s2 = new THREE.Mesh(supportGeo, supportMat);
    s2.position.set(0.2, 1.4, 0);
    group.add(s2);

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
    group.add(filament);

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    base.position.y = 1.0;
    group.add(base);

    // Connection Point 1 (Side of base)
    const cp1Group = createConnectionPoint({ type: 'point', parent: 'bulb', id: 1 });
    cp1Group.position.set(0.4, 1.0, 0);
    group.add(cp1Group);

    // Connection Point 2 (Bottom)
    const cp2Group = createConnectionPoint({ type: 'point', parent: 'bulb', id: 2 });
    cp2Group.position.set(0, 0.5, 0);
    group.add(cp2Group);

    return group;
}

// Init Objects
const battery = createBattery();
battery.rotation.z = -Math.PI / 2; // Lie down
battery.position.set(-2.5, 0.6, 0); // Center roughly at x=-1.5 (Pivot is at bottom)
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
            const startPos = startPoint.getWorldPosition(new THREE.Vector3());
            updateWireMesh(currentLine, startPos, targetPos, currentLine.userData.bendFactor);
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

        // Create temp wire
        const startPos = startPoint.getWorldPosition(new THREE.Vector3());
        
        // Alternate bend direction based on wire count
        // Wire 0: bend +1 (towards camera/Z+)
        // Wire 1: bend -1 (away from camera/Z-)
        const bendFactor = (wires.length % 2 === 0) ? 1 : -1;
        
        // Init with same start/end
        currentLine = updateWireMesh(null, startPos, startPos, bendFactor);
        currentLine.userData.bendFactor = bendFactor; // Store for updates
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
            // Valid connection, snap wire to end point
            const startPos = startPoint.getWorldPosition(new THREE.Vector3());
            const endPos = endPoint.getWorldPosition(new THREE.Vector3());
            
            updateWireMesh(currentLine, startPos, endPos, currentLine.userData.bendFactor);
            
            // Store wire logic
            wires.push({
                start: startPoint.userData,
                end: endPoint.userData,
                mesh: currentLine
            });
            
            checkCircuit();
        } else {
            // Invalid, remove line
            if (currentLine) {
                currentLine.geometry.dispose();
                scene.remove(currentLine);
            }
        }
        currentLine = null;
        startPoint = null;
    }
});

// Double click to remove wires
window.addEventListener('dblclick', (e) => {
    // We need to raycast against wires
    const intersects = getIntersects(e, wires.map(w => w.mesh));
    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        // Find wire object
        const wireIndex = wires.findIndex(w => w.mesh === mesh);
        if (wireIndex > -1) {
            // Remove mesh
            scene.remove(mesh);
            mesh.geometry.dispose();
            // Remove from array
            wires.splice(wireIndex, 1);
            // Re-check circuit
            checkCircuit();
        }
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
    } else {
        // If not connected, turn off (in case it was on and we removed a wire)
        bulbMaterial.emissive.set(0x000000);
        bulbMaterial.opacity = 0.3;
        filamentMaterial.color.set(0x555555);
        filamentMaterial.emissive.set(0x000000);
        filamentMaterial.emissiveIntensity = 0;
        const light = scene.getObjectByName('bulbLight');
        if (light) scene.remove(light);
        document.getElementById('success-msg').style.display = 'none';
    }
}

function lightUp() {
    bulbMaterial.emissive.set(0xffff00); // Yellow glow
    bulbMaterial.emissiveIntensity = 1;
    bulbMaterial.opacity = 0.8;
    filamentMaterial.color.set(0xffaa00);
    filamentMaterial.emissive.set(0xffaa00);
    filamentMaterial.emissiveIntensity = 2;
    
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
    filamentMaterial.color.set(0x555555);
    filamentMaterial.emissive.set(0x000000);
    filamentMaterial.emissiveIntensity = 0;

    const light = scene.getObjectByName('bulbLight');
    if (light) scene.remove(light);

    document.getElementById('success-msg').style.display = 'none';
}

document.getElementById('reset-btn').addEventListener('click', resetCircuit);

// Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Animate Halo pulsing
    const time = Date.now() * 0.003;
    const scale = 1 + Math.sin(time) * 0.2;
    const opacity = 0.3 + Math.sin(time) * 0.15;
    
    connectionPoints.forEach(cp => {
        // cp is the core mesh, parent has the halo
        const group = cp.parent;
        const halo = group.getObjectByName('halo');
        if (halo) {
            halo.scale.set(scale, scale, scale);
            halo.material.opacity = opacity;
        }
    });

    renderer.render(scene, camera);
}
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
