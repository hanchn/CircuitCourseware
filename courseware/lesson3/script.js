import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.2;
controls.minDistance = 3;
controls.maxDistance = 20;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- Global State ---
const components = [];
const connectionPoints = [];
let wires = [];
let isDrawing = false;
let currentLine = null;
let startPoint = null;

// Materials
const pointMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const pointHoverMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const haloMat = new THREE.MeshBasicMaterial({ 
    color: 0xff3300, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
});
const wireMat = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50, 
    roughness: 0.5,
    metalness: 0.1
});

// --- Helper Functions ---

function createConnectionPoint(userData) {
    const group = new THREE.Group();
    
    // Core
    const coreGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const core = new THREE.Mesh(coreGeo, pointMat.clone());
    core.userData = userData;
    group.add(core);

    // Halo
    const haloShellGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const haloShell = new THREE.Mesh(haloShellGeo, haloMat.clone());
    haloShell.name = "halo";
    group.add(haloShell);

    connectionPoints.push(core);
    return group;
}

function updateWireMesh(mesh, startPos, endPos, bendFactor = 1) {
    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    const dist = startPos.distanceTo(endPos);
    mid.y += 1.0 + dist * 0.2; 
    mid.z += dist * 0.3 * bendFactor;

    const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);
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

// --- Component Creators ---

// 1. Battery
function createBattery() {
    const group = new THREE.Group();
    group.name = 'battery';
    
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
    cpPosGroup.position.set(0, 2.8, 0); 
    
    // Label +
    const canvasPos = document.createElement('canvas');
    const ctxPos = canvasPos.getContext('2d');
    canvasPos.width = 64; canvasPos.height = 64;
    ctxPos.fillStyle = '#ff0000';
    ctxPos.font = 'bold 48px Arial';
    ctxPos.fillText('+', 15, 50);
    const labelPos = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvasPos), depthTest: false })); 
    labelPos.position.set(-0.6, 0, 0); 
    labelPos.scale.set(0.5, 0.5, 0.5);
    cpPosGroup.add(labelPos);
    group.add(cpPosGroup);

    // Connection Point Negative
    const cpNegGroup = createConnectionPoint({ type: 'point', parent: 'battery', pole: 'neg' });
    cpNegGroup.position.set(0, -0.2, 0);
    
    // Label -
    const canvasNeg = document.createElement('canvas');
    const ctxNeg = canvasNeg.getContext('2d');
    canvasNeg.width = 64; canvasNeg.height = 64;
    ctxNeg.fillStyle = '#000000';
    ctxNeg.font = 'bold 48px Arial';
    ctxNeg.fillText('-', 20, 45);
    const labelNeg = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvasNeg), depthTest: false }));
    labelNeg.position.set(-0.6, 0, 0); 
    labelNeg.scale.set(0.5, 0.5, 0.5);
    cpNegGroup.add(labelNeg);
    group.add(cpNegGroup);

    return group;
}

// 2. Bulb
let bulbMaterial; 
let filamentMaterial;
function createBulb() {
    const group = new THREE.Group();
    group.name = 'bulb';
    
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

    // Filament
    filamentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555, 
        emissive: 0x000000
    });
    
    const supportGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const s1 = new THREE.Mesh(supportGeo, supportMat);
    s1.position.set(-0.2, 1.4, 0);
    group.add(s1);
    const s2 = new THREE.Mesh(supportGeo, supportMat);
    s2.position.set(0.2, 1.4, 0);
    group.add(s2);

    const filamentPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, 1.8, 0),
        new THREE.Vector3(-0.1, 2.0, 0),
        new THREE.Vector3(0, 1.8, 0),
        new THREE.Vector3(0.1, 2.0, 0),
        new THREE.Vector3(0.2, 1.8, 0)
    ]);
    const filament = new THREE.Mesh(new THREE.TubeGeometry(filamentPath, 20, 0.015, 8, false), filamentMaterial);
    group.add(filament);

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    base.position.y = 1.0;
    group.add(base);

    // Connection Points
    const cp1Group = createConnectionPoint({ type: 'point', parent: 'bulb', id: 1 });
    cp1Group.position.set(0.4, 1.0, 0);
    group.add(cp1Group);

    const cp2Group = createConnectionPoint({ type: 'point', parent: 'bulb', id: 2 });
    cp2Group.position.set(0, 0.5, 0);
    group.add(cp2Group);

    return group;
}

// 3. Switch
let switchLever;
let isSwitchClosed = false;
function createSwitch() {
    const group = new THREE.Group();
    group.name = 'switch';
    
    // Base
    const baseGeo = new THREE.BoxGeometry(1.5, 0.2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);

    // Contacts
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

    // Connection Points for Switch (Front and Rear)
    const cpRearGroup = createConnectionPoint({ type: 'point', parent: 'switch', id: 'rear' });
    cpRearGroup.position.set(0, 0.4, 1.5); // Behind the hinge
    group.add(cpRearGroup);

    const cpFrontGroup = createConnectionPoint({ type: 'point', parent: 'switch', id: 'front' });
    cpFrontGroup.position.set(0, 0.4, -1.5); // In front of contact
    group.add(cpFrontGroup);

    // Lever Group
    switchLever = new THREE.Group();
    switchLever.position.set(0, 0.5, 1.0);
    
    const bladeGeo = new THREE.BoxGeometry(0.2, 0.1, 2.2);
    bladeGeo.translate(0, 0, -1.0); 
    const blade = new THREE.Mesh(bladeGeo, metalMat);
    switchLever.add(blade);

    const handleGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 2;
    handle.position.set(0, 0, -2.2);
    switchLever.add(handle);

    switchLever.rotation.x = Math.PI / 4; // Open
    group.add(switchLever);

    return group;
}

// Add objects
const battery = createBattery();
battery.rotation.z = -Math.PI / 2;
battery.position.set(-3, 0.6, -2);
scene.add(battery);

const bulb = createBulb();
bulb.position.set(3, 0, -2);
scene.add(bulb);

const switchObj = createSwitch();
switchObj.position.set(0, 0, 3); // Place switch in front
switchObj.rotation.y = Math.PI / 2; // Rotate 90 degrees
scene.add(switchObj);

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getIntersects(event, objects) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(objects, false);
}

function isPointOccupied(userData) {
    return wires.some(w => {
        // Check start
        const startMatch = (w.start.parent === userData.parent) && 
                           (w.start.id === userData.id) && 
                           (w.start.pole === userData.pole);
        // Check end
        const endMatch = (w.end.parent === userData.parent) && 
                         (w.end.id === userData.id) && 
                         (w.end.pole === userData.pole);
        return startMatch || endMatch;
    });
}

// Hover
window.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        let targetPos = new THREE.Vector3();
        // Allow snapping to valid end points while drawing
        const intersects = getIntersects(e, connectionPoints);
        let snapped = false;
        
        if (intersects.length > 0) {
            const point = intersects[0].object;
            // Only snap if not occupied and not the start point
            if (!isPointOccupied(point.userData) && point !== startPoint) {
                targetPos.copy(point.getWorldPosition(new THREE.Vector3()));
                snapped = true;
                point.material.color.set(0x00ff00); // Highlight potential target
            }
        }

        if (!snapped) {
            // Reset colors of points if not snapped (cleanup previous frame highlights)
             connectionPoints.forEach(p => {
                 if (p !== startPoint) p.material.color.set(0xff3300);
             });
             
            // Normal raycast
            const hit = raycaster.intersectObjects([floor, ...connectionPoints], true)[0];
            if (hit) {
                targetPos.copy(hit.point);
            } else {
                raycaster.ray.at(5, targetPos);
            }
        }

        if (currentLine) {
            const startPos = startPoint.getWorldPosition(new THREE.Vector3());
            updateWireMesh(currentLine, startPos, targetPos, currentLine.userData.bendFactor);
        }
        return;
    }

    const intersects = getIntersects(e, connectionPoints);
    connectionPoints.forEach(p => p.material.color.set(0xff3300));
    document.body.style.cursor = 'default';
    
    if (intersects.length > 0) {
        const point = intersects[0].object;
        if (!isPointOccupied(point.userData)) {
            point.material.color.set(0x00ff00);
            document.body.style.cursor = 'crosshair';
            controls.enabled = false;
        } else {
            // Occupied: Show visual feedback (e.g. grey)
            point.material.color.set(0x888888); 
            document.body.style.cursor = 'not-allowed';
            // Allow controls so user isn't stuck
            controls.enabled = true; 
        }
    } else {
        controls.enabled = true;
    }
});

// Wiring Click
window.addEventListener('mousedown', (e) => {
    const intersects = getIntersects(e, connectionPoints);
    if (intersects.length > 0) {
        const point = intersects[0].object;
        
        // Check if occupied
        if (isPointOccupied(point.userData)) {
            return; // Ignore click
        }

        isDrawing = true;
        startPoint = point;
        controls.enabled = false;

        const startPos = startPoint.getWorldPosition(new THREE.Vector3());
        const bendFactor = (wires.length % 2 === 0) ? 1 : -1;
        
        currentLine = updateWireMesh(null, startPos, startPos, bendFactor);
        currentLine.userData.bendFactor = bendFactor;
        scene.add(currentLine);
    } else {
        // Check for Switch Click
        // Raycast against scene children
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        if (hits.length > 0) {
            let obj = hits[0].object;
            // Traverse up
            while(obj) {
                if (obj.name === 'switch') {
                    toggleSwitch();
                    return;
                }
                obj = obj.parent;
            }
        }
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

        // Check if endPoint is occupied
        if (endPoint && isPointOccupied(endPoint.userData)) {
             endPoint = null; // Treat as invalid
        }

        if (endPoint && endPoint !== startPoint) {
            const startPos = startPoint.getWorldPosition(new THREE.Vector3());
            const endPos = endPoint.getWorldPosition(new THREE.Vector3());
            
            updateWireMesh(currentLine, startPos, endPos, currentLine.userData.bendFactor);
            
            wires.push({
                start: startPoint.userData,
                end: endPoint.userData,
                mesh: currentLine
            });
            
            checkCircuit();
        } else {
            if (currentLine) {
                currentLine.geometry.dispose();
                scene.remove(currentLine);
            }
        }
        currentLine = null;
        startPoint = null;
    }
});

// Double click to remove wire
window.addEventListener('dblclick', (e) => {
    const intersects = getIntersects(e, wires.map(w => w.mesh));
    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const wireIndex = wires.findIndex(w => w.mesh === mesh);
        if (wireIndex > -1) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            wires.splice(wireIndex, 1);
            checkCircuit();
        }
    }
});

function toggleSwitch() {
    isSwitchClosed = !isSwitchClosed;
    const targetRot = isSwitchClosed ? 0 : Math.PI / 4;
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
            checkCircuit(); // Check circuit after toggle
        }
    }
    animateSwitch();
}

// --- Circuit Logic ---
function checkCircuit() {
    // Build Graph
    // Nodes: 'battery-pos', 'battery-neg', 'bulb-1', 'bulb-2', 'switch-front', 'switch-rear'
    // Internal Connections:
    // Bulb: bulb-1 <-> bulb-2 (Always connected internally via filament? Yes, but filament is the load)
    // Switch: switch-front <-> switch-rear (Only if closed)
    // Battery: source.
    
    // Actually, to light the bulb, we need a path from Battery(+) to Battery(-) passing through Bulb.
    // And if the path passes through Switch, the switch must be closed.
    
    // Let's model connectivity.
    // Map Component IDs to a list of connected Component IDs.
    const adj = new Map();
    
    function addEdge(u, v) {
        if (!adj.has(u)) adj.set(u, []);
        if (!adj.has(v)) adj.set(v, []);
        adj.get(u).push(v);
        adj.get(v).push(u);
    }
    
    // Add Wires
    wires.forEach(w => {
        const u = `${w.start.parent}-${w.start.id || w.start.pole}`;
        const v = `${w.end.parent}-${w.end.id || w.end.pole}`;
        addEdge(u, v);
    });
    
    // Add Internal Component Connections (if closed/conductive)
    // Bulb is conductive (it's the load, but for path finding, it connects its two terminals)
    addEdge('bulb-1', 'bulb-2');
    
    // Switch is conductive ONLY if closed
    if (isSwitchClosed) {
        addEdge('switch-front', 'switch-rear');
    }
    
    // BFS from Battery(+) to Battery(-)
    const startNode = 'battery-pos';
    const endNode = 'battery-neg';
    
    if (!adj.has(startNode) || !adj.has(endNode)) {
        turnOffBulb();
        return;
    }
    
    const queue = [startNode];
    const visited = new Set();
    visited.add(startNode);
    const parent = new Map(); // To reconstruct path
    
    let found = false;
    while(queue.length > 0) {
        const curr = queue.shift();
        if (curr === endNode) {
            found = true;
            break;
        }
        
        const neighbors = adj.get(curr) || [];
        for (const n of neighbors) {
            if (!visited.has(n)) {
                visited.add(n);
                parent.set(n, curr);
                queue.push(n);
            }
        }
    }
    
    if (found) {
        // Verify path passes through Bulb
        // Reconstruct path
        let curr = endNode;
        let hasBulb = false;
        let hasSwitch = false;
        
        while(curr !== startNode) {
            if (curr.includes('bulb')) hasBulb = true;
            if (curr.includes('switch')) hasSwitch = true;
            curr = parent.get(curr);
        }
        
        if (hasBulb) {
            turnOnBulb();
            
            // Check if switch was used
            if (hasSwitch) {
                 document.getElementById('success-msg').innerText = "🎉 恭喜！你成功用开关控制了灯泡！";
                 document.getElementById('success-msg').style.display = 'block';
            } else {
                 document.getElementById('success-msg').innerText = "💡 灯亮了！但你没用到开关哦，试试把开关串联进去！";
                 document.getElementById('success-msg').style.display = 'block';
            }
        } else {
            // Short circuit? (Battery connected to itself without bulb)
            turnOffBulb();
        }
    } else {
        turnOffBulb();
    }
}

function turnOnBulb() {
    bulbMaterial.emissive.set(0xffff00);
    bulbMaterial.emissiveIntensity = 1;
    bulbMaterial.opacity = 0.8;
    filamentMaterial.color.set(0xffaa00);
    filamentMaterial.emissive.set(0xffaa00);
    filamentMaterial.emissiveIntensity = 2;
    
    if (!scene.getObjectByName('bulbLight')) {
        const light = new THREE.PointLight(0xffaa00, 5, 10);
        light.name = 'bulbLight';
        light.position.set(3, 2, -2);
        scene.add(light);
    }
}

function turnOffBulb() {
    bulbMaterial.emissive.set(0x000000);
    bulbMaterial.opacity = 0.3;
    filamentMaterial.color.set(0x555555);
    filamentMaterial.emissive.set(0x000000);
    filamentMaterial.emissiveIntensity = 0;
    
    const light = scene.getObjectByName('bulbLight');
    if (light) scene.remove(light);
    
    document.getElementById('success-msg').style.display = 'none';
}

function resetCircuit() {
    wires.forEach(w => scene.remove(w.mesh));
    wires = [];
    isSwitchClosed = false;
    switchLever.rotation.x = Math.PI / 4;
    checkCircuit();
}

document.getElementById('reset-btn').addEventListener('click', resetCircuit);

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Halo Pulse
    const time = Date.now() * 0.003;
    const scale = 1 + Math.sin(time) * 0.2;
    const opacity = 0.3 + Math.sin(time) * 0.15;
    
    connectionPoints.forEach(cp => {
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
