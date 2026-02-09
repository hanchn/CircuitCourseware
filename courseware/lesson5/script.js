import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 22); // Zoom out to see both
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.maxPolarAngle = Math.PI / 2.2;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 50;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- Global State ---
const circuits = []; 
const allBatteries = []; 

// Drag State
let isDragging = false;
let dragObject = null;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragOffset = new THREE.Vector3();

// Materials
const wireMat = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50, 
    roughness: 0.5,
    metalness: 0.1
});
const metalMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.2 });

// --- Helper Functions ---

function updateWireMesh(startPos, points, endPos) {
    const allPoints = [startPos, ...points, endPos];
    const curve = new THREE.CatmullRomCurve3(allPoints);
    curve.curveType = 'catmullrom';
    curve.tension = 0.5;
    
    const geometry = new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
    const mesh = new THREE.Mesh(geometry, wireMat);
    mesh.castShadow = true;
    return mesh;
}

// Reusable Parts Helpers
function createSpring() {
    const points = [];
    const turns = 6;
    const length = 0.5;
    const radius = 0.25;
    for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const angle = t * Math.PI * 2 * turns;
        const x = t * length;
        const y = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 60, 0.04, 8, false); 
    const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 }); 
    return new THREE.Mesh(geo, mat);
}

function createPlate() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
    return new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.6), mat); 
}

function createFlatLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

// --- Component Creators ---

function createBatteryBox(circuitId) {
    const group = new THREE.Group();
    group.name = 'batteryBox';
    
    // Common Dimensions
    const boxWidth = 3.6;
    
    // --- Double Battery Box (Series) ---
    const caseGeo = new THREE.BoxGeometry(boxWidth, 0.8, 4.0); 
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
    const base = new THREE.Mesh(caseGeo, caseMat);
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);
    
    const slotGeo = new THREE.BoxGeometry(3.3, 0.5, 1.6);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const slot1 = new THREE.Mesh(slotGeo, slotMat);
    slot1.position.set(0, 0.6, -1.0);
    group.add(slot1);
    
    const slot2 = new THREE.Mesh(slotGeo, slotMat);
    slot2.position.set(0, 0.6, 1.0);
    group.add(slot2);
    
    // Slot 1 (Back): Left(+), Right(-)
    const plate1 = createPlate();
    plate1.position.set(-1.6, 0.6, -1.0);
    group.add(plate1);
    
    const spring1 = createSpring();
    spring1.rotation.y = Math.PI; 
    spring1.position.set(1.6, 0.6, -1.0);
    group.add(spring1);
    
    const l1Plus = createFlatLabel('+', '#555555');
    l1Plus.position.set(-1.0, 0.36, -1.0); 
    group.add(l1Plus);
    
    const l1Neg = createFlatLabel('-', '#555555');
    l1Neg.position.set(1.0, 0.36, -1.0);
    group.add(l1Neg);

    // Slot 2 (Front): Left(-), Right(+)
    const spring2 = createSpring();
    spring2.position.set(-1.6, 0.6, 1.0);
    group.add(spring2);
    
    const plate2 = createPlate();
    plate2.position.set(1.6, 0.6, 1.0);
    group.add(plate2);
    
    const l2Neg = createFlatLabel('-', '#555555');
    l2Neg.position.set(-1.0, 0.36, 1.0);
    group.add(l2Neg);
    
    const l2Plus = createFlatLabel('+', '#555555');
    l2Plus.position.set(1.0, 0.36, 1.0);
    group.add(l2Plus);

    // Series Bar (Left side)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.2), metalMat);
    bar.position.set(-1.75, 0.6, 0); 
    group.add(bar);
    
    // Terminals (Right Side)
    const termBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 2.2), new THREE.MeshStandardMaterial({color: 0x333333}));
    termBase.position.set(1.9, 0.4, 0);
    group.add(termBase);

    const termPos = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3), new THREE.MeshStandardMaterial({color: 0xff0000}));
    termPos.position.set(1.9, 0.7, 1.0); 
    group.add(termPos);
    
    const termNeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3), new THREE.MeshStandardMaterial({color: 0x000000}));
    termNeg.position.set(1.9, 0.7, -1.0); 
    group.add(termNeg);

    group.userData = {
        circuitId: circuitId,
        type: 'double',
        slots: [
            { id: 1, pos: new THREE.Vector3(0, 0.6, -1.0), occupied: false, expectedDir: new THREE.Vector3(-1, 0, 0) }, 
            { id: 2, pos: new THREE.Vector3(0, 0.6, 1.0), occupied: false, expectedDir: new THREE.Vector3(1, 0, 0) }
        ],
        terminals: {
            pos: new THREE.Vector3(1.9, 0.7, 1.0),
            neg: new THREE.Vector3(1.9, 0.7, -1.0)
        }
    };

    return group;
}

function createBattery(id) {
    const group = new THREE.Group();
    group.name = 'battery_' + id;
    
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 2.8, 32),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    body.rotation.z = -Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.51, 0.51, 1.8, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    label.rotation.z = -Math.PI / 2;
    group.add(label);

    const pos = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    pos.rotation.z = -Math.PI / 2;
    pos.position.x = 1.5; 
    group.add(pos);
    
    const canvasPos = document.createElement('canvas');
    const ctxPos = canvasPos.getContext('2d');
    canvasPos.width = 64; canvasPos.height = 64;
    ctxPos.fillStyle = '#ff0000';
    ctxPos.font = 'bold 48px Arial';
    ctxPos.fillText('+', 15, 50);
    const labelPos = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvasPos) })); 
    labelPos.position.set(0.8, 0.6, 0); 
    labelPos.scale.set(0.5, 0.5, 0.5);
    group.add(labelPos);

    const neg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    neg.rotation.z = -Math.PI / 2;
    neg.position.x = -1.4;
    group.add(neg);

    group.userData = {
        type: 'battery',
        id: id,
        parentBox: null,
        inSlot: null
    };

    return group;
}

function createBulb(circuitId, suffix) {
    const group = new THREE.Group();
    group.name = 'bulb_' + suffix;
    
    const bulbMaterial = new THREE.MeshPhysicalMaterial({ 
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

    const filamentMaterial = new THREE.MeshStandardMaterial({ 
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

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    base.position.y = 1.0;
    group.add(base);

    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0x000000}));
    t1.position.set(0.4, 0.5, 0);
    group.add(t1);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0x000000}));
    t2.position.set(-0.4, 0.5, 0);
    group.add(t2);

    group.userData = { 
        circuitId: circuitId,
        terminals: { t1: new THREE.Vector3(0.4, 0.5, 0), t2: new THREE.Vector3(-0.4, 0.5, 0) },
        materials: { bulb: bulbMaterial, filament: filamentMaterial }
    };

    return group;
}

function createSwitch(circuitId) {
    const group = new THREE.Group();
    group.name = 'switch';
    
    const baseGeo = new THREE.BoxGeometry(1.5, 0.2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    const clipGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    
    const rearClip = new THREE.Mesh(clipGeo, metalMat);
    rearClip.position.set(0, 0.4, 1.0);
    group.add(rearClip);
    
    const pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6);
    const pin = new THREE.Mesh(pinGeo, metalMat);
    pin.rotation.z = Math.PI / 2; 
    pin.position.set(0, 0.5, 1.0);
    group.add(pin);

    const frontClip = new THREE.Mesh(clipGeo, metalMat);
    frontClip.position.set(0, 0.4, -1.0);
    group.add(frontClip);

    const leverGroup = new THREE.Group();
    leverGroup.name = 'lever'; 
    leverGroup.position.set(0, 0.5, 1.0); 
    
    const bladeGeo = new THREE.BoxGeometry(0.2, 0.1, 2.2);
    bladeGeo.translate(0, 0, -1.0); 
    const blade = new THREE.Mesh(bladeGeo, metalMat);
    leverGroup.add(blade);

    const handleGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 2;
    handle.position.set(0, 0, -2.2);
    leverGroup.add(handle);

    leverGroup.rotation.x = Math.PI / 3; 
    group.add(leverGroup);

    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0xc0c0c0}));
    t1.position.set(0, 0.2, 1.2);
    group.add(t1);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0xc0c0c0}));
    t2.position.set(0, 0.2, -1.2);
    group.add(t2);

    group.userData = { 
        circuitId: circuitId,
        terminals: { front: new THREE.Vector3(0, 0.2, -1.2), rear: new THREE.Vector3(0, 0.2, 1.2) } 
    };
    
    return group;
}

// --- Circuit Builder ---
function initCircuit(offsetX, id, bulbMode) {
    const group = new THREE.Group();
    group.position.set(offsetX, 0, 0);
    scene.add(group);

    const box = createBatteryBox(id);
    box.position.set(-3, 0, 0);
    group.add(box);

    const sw = createSwitch(id);
    sw.position.set(0, 0, 4);
    sw.rotation.y = Math.PI / 2;
    group.add(sw);

    const batteryList = [];
    const b1 = createBattery(id * 10 + 1);
    
    // Adjust initial battery positions to avoid overlapping with wires
    // Series (Left): Default
    // Parallel (Right): Move further back
    const battZ = bulbMode === 'parallel' ? 9.5 : 6.5;
    
    b1.position.set(-2, 0.5, battZ);
    group.add(b1);
    batteryList.push(b1);
    allBatteries.push(b1);

    const b2 = createBattery(id * 10 + 2);
    b2.position.set(2, 0.5, battZ);
    group.add(b2);
    batteryList.push(b2);
    allBatteries.push(b2);

    const bulbs = [];

    // Helper for world pos in group
    function getPosInGroup(obj, localVec) {
        const v = localVec.clone();
        v.applyQuaternion(obj.quaternion);
        v.add(obj.position);
        return v;
    }

    if (bulbMode === 'series') {
        // --- Series Bulbs ---
        const bulb1 = createBulb(id, '1');
        bulb1.position.set(2, 0, 0);
        group.add(bulb1);
        bulbs.push(bulb1);

        const bulb2 = createBulb(id, '2');
        bulb2.position.set(4, 0, 0);
        group.add(bulb2);
        bulbs.push(bulb2);

        // Wiring:
        // 1. Box(+) -> Switch(Front)
        const p1 = getPosInGroup(box, box.userData.terminals.pos);
        const p2 = getPosInGroup(sw, sw.userData.terminals.front);
        const cp1 = p1.clone().add(new THREE.Vector3(0, 0, 1)); 
        const cp2 = p2.clone().add(new THREE.Vector3(-1, 0, 0)); 
        group.add(updateWireMesh(p1, [cp1, cp2], p2));

        // 2. Switch(Rear) -> Bulb1(Left)
        const p3 = getPosInGroup(sw, sw.userData.terminals.rear);
        const p4 = getPosInGroup(bulb1, bulb1.userData.terminals.t2);
        const cp3 = p3.clone().add(new THREE.Vector3(1, 0, 0));
        const cp4 = p4.clone().add(new THREE.Vector3(0, 0, 1));
        group.add(updateWireMesh(p3, [cp3, cp4], p4));

        // 3. Bulb1(Right) -> Bulb2(Left)
        const p5 = getPosInGroup(bulb1, bulb1.userData.terminals.t1);
        const p6 = getPosInGroup(bulb2, bulb2.userData.terminals.t2);
        const cp5 = p5.clone().add(new THREE.Vector3(0, 0, -0.5));
        const cp6 = p6.clone().add(new THREE.Vector3(0, 0, 0.5));
        group.add(updateWireMesh(p5, [cp5, cp6], p6));

        // 4. Bulb2(Right) -> Box(-)
        const p7 = getPosInGroup(bulb2, bulb2.userData.terminals.t1);
        const p8 = getPosInGroup(box, box.userData.terminals.neg);
        const cp7 = p7.clone().add(new THREE.Vector3(0, 0, -1));
        const cp8 = new THREE.Vector3(4.5, 0.1, -2);
        const cp9 = new THREE.Vector3(0, 0.1, -2);
        const cp10 = p8.clone().add(new THREE.Vector3(1, 0, -1));
        group.add(updateWireMesh(p7, [cp7, cp8, cp9, cp10], p8));

    } else {
        // --- Parallel Bulbs ---
        // Layout: Switch is at z=4. We center bulbs around z=4 line.
        const zCenter = 4;
        const zSpacing = 3;
        
        // Move bulbs further right (x=5 instead of x=3) to create more space from switch
        const bulbX = 5;
        const splitX = 2.5; // Split bus moved from 1.5 to 2.5
        const mergeX = 7.0; // Merge bus moved from 4.5 to 7.0

        const bulb1 = createBulb(id, '1');
        bulb1.position.set(bulbX, 0, zCenter - zSpacing); 
        group.add(bulb1);
        bulbs.push(bulb1);

        const bulb2 = createBulb(id, '2');
        bulb2.position.set(bulbX, 0, zCenter + zSpacing); 
        group.add(bulb2);
        bulbs.push(bulb2);

        // Wiring - Rectangular Style
        // 1. Box(+) -> Switch(Front)
        const p1 = getPosInGroup(box, box.userData.terminals.pos);
        const p2 = getPosInGroup(sw, sw.userData.terminals.front);
        const cp1 = p1.clone().add(new THREE.Vector3(0, 0, 1)); 
        const cp2 = p2.clone().add(new THREE.Vector3(-1, 0, 0)); 
        group.add(updateWireMesh(p1, [cp1, cp2], p2));

        // 2. Switch(Rear) -> Split Vertical Bus
        const pSwitchOut = getPosInGroup(sw, sw.userData.terminals.rear); // ~ (1.2, 0, 4)
        const splitNodeCenter = new THREE.Vector3(splitX, 0.1, zCenter);
        
        group.add(updateWireMesh(pSwitchOut, [], splitNodeCenter));

        // 3. Split Bus -> Bulb 1 (Back)
        const splitNode1 = new THREE.Vector3(splitX, 0.1, zCenter - zSpacing);
        const corner1 = new THREE.Vector3(bulbX - 0.4, 0.1, zCenter - zSpacing);
        const pB1L = getPosInGroup(bulb1, bulb1.userData.terminals.t2);
        
        group.add(updateWireMesh(splitNodeCenter, [splitNode1, corner1], pB1L));

        // 4. Split Bus -> Bulb 2 (Front)
        const splitNode2 = new THREE.Vector3(splitX, 0.1, zCenter + zSpacing);
        const corner2 = new THREE.Vector3(bulbX - 0.4, 0.1, zCenter + zSpacing);
        const pB2L = getPosInGroup(bulb2, bulb2.userData.terminals.t2);
        
        group.add(updateWireMesh(splitNodeCenter, [splitNode2, corner2], pB2L));

        // 5. Bulb 1 (Right) -> Merge Bus
        const pB1R = getPosInGroup(bulb1, bulb1.userData.terminals.t1);
        const corner3 = new THREE.Vector3(mergeX, 0.1, zCenter - zSpacing);
        const mergeNodeCenter = new THREE.Vector3(mergeX, 0.1, zCenter);
        
        group.add(updateWireMesh(pB1R, [corner3], mergeNodeCenter));

        // 6. Bulb 2 (Right) -> Merge Bus
        const pB2R = getPosInGroup(bulb2, bulb2.userData.terminals.t1);
        const corner4 = new THREE.Vector3(mergeX, 0.1, zCenter + zSpacing);
        
        group.add(updateWireMesh(pB2R, [corner4], mergeNodeCenter));

        // 7. Merge Bus -> Box(-)
        const pBoxNeg = getPosInGroup(box, box.userData.terminals.neg);
        const corner5 = new THREE.Vector3(mergeX, 0.1, -2);
        const corner6 = new THREE.Vector3(0, 0.1, -2); // Go behind everything
        const cpEnd = pBoxNeg.clone().add(new THREE.Vector3(1, 0, -1));
        
        group.add(updateWireMesh(mergeNodeCenter, [corner5, corner6, cpEnd], pBoxNeg));
    }

    // Store circuit data
    circuits.push({
        id: id,
        bulbMode: bulbMode,
        group: group,
        box: box,
        switch: sw,
        bulbs: bulbs,
        batteries: batteryList,
        isSwitchClosed: false
    });
}

// Create Two Circuits
initCircuit(-6, 0, 'series'); // Left Circuit (Series)
initCircuit(6, 1, 'parallel');  // Right Circuit (Parallel)


// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function toggleSwitch(circuit) {
    circuit.isSwitchClosed = !circuit.isSwitchClosed;
    const targetRot = circuit.isSwitchClosed ? 0 : Math.PI / 3;
    const leverGroup = circuit.switch.getObjectByName('lever'); 
    
    const startRot = leverGroup.rotation.x;
    const duration = 200;
    const startTime = Date.now();
    
    function animateSwitch() {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        leverGroup.rotation.x = startRot + (targetRot - startRot) * progress;
        
        if (progress < 1) {
            requestAnimationFrame(animateSwitch);
        } else {
            leverGroup.rotation.x = targetRot;
            checkCircuit(circuit); 
        }
    }
    animateSwitch();
}

window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(allBatteries, true);
    
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj && !obj.userData.type) obj = obj.parent;
        
        if (obj && obj.userData.type === 'battery') {
            isDragging = true;
            dragObject = obj;
            orbitControls.enabled = false;
            
            raycaster.ray.intersectPlane(dragPlane, dragOffset);
            
            const worldPos = new THREE.Vector3();
            dragObject.getWorldPosition(worldPos);
            dragOffset.sub(worldPos);
            
            dragObject.position.y = 1.5;
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !dragObject) return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersectPoint);
    
    if (intersectPoint) {
        const worldTarget = intersectPoint.sub(dragOffset);
        worldTarget.y = 1.5;
        
        if (dragObject.parent) {
            dragObject.parent.worldToLocal(worldTarget);
        }
        dragObject.position.copy(worldTarget);
    }
});

window.addEventListener('mouseup', () => {
    if (isDragging && dragObject) {
        isDragging = false;
        orbitControls.enabled = true;
        dragObject.position.y = 0.5;
        checkDrop(dragObject);
        circuits.forEach(c => checkCircuit(c));
        dragObject = null;
    }
});

function checkDrop(battery) {
    const battWorldPos = new THREE.Vector3();
    battery.getWorldPosition(battWorldPos);
    
    let dropped = false;
    
    for (const circuit of circuits) {
        const box = circuit.box;
        
        for (let slot of box.userData.slots) {
            const slotWorldPos = slot.pos.clone().applyMatrix4(box.matrixWorld);
            
            if (battWorldPos.distanceTo(slotWorldPos) < 1.0) {
                if (!slot.occupied || battery.userData.inSlot === slot && battery.userData.parentBox === box) {
                    const localTarget = slotWorldPos.clone();
                    if (battery.parent) {
                        battery.parent.worldToLocal(localTarget);
                    }
                    battery.position.copy(localTarget);
                    
                    if (battery.userData.parentBox && battery.userData.inSlot) {
                        battery.userData.inSlot.occupied = false;
                    }
                    
                    slot.occupied = true;
                    battery.userData.parentBox = box;
                    battery.userData.inSlot = slot;
                    dropped = true;
                    return; 
                }
            }
        }
    }
    
    if (!dropped && battery.userData.inSlot) {
        battery.userData.inSlot.occupied = false;
        battery.userData.inSlot = null;
        battery.userData.parentBox = null;
    }
}

window.addEventListener('click', (e) => {
    if (isDragging) return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObjects(scene.children, true);
    for (let hit of hits) {
        let obj = hit.object;
        let switchGroup = null;
        while(obj) {
            if (obj.name === 'switch') {
                switchGroup = obj;
                break;
            }
            obj = obj.parent;
        }
        
        if (switchGroup) {
            const circuit = circuits.find(c => c.switch === switchGroup);
            if (circuit) {
                toggleSwitch(circuit);
                return; 
            }
        }
    }
    
    const battHits = raycaster.intersectObjects(allBatteries, true);
    if (battHits.length > 0) {
        let obj = battHits[0].object;
        while(obj && !obj.userData.type) obj = obj.parent;
        
        if (obj && obj.userData.type === 'battery') {
            obj.rotation.y += Math.PI;
            circuits.forEach(c => checkCircuit(c));
        }
    }
});

function checkCircuit(circuit) {
    const box = circuit.box;
    let allValid = true;
    
    // Iterate all required slots for this box
    for (const slot of box.userData.slots) {
        if (!slot.occupied) {
            allValid = false;
            break;
        }
        
        // Check battery in this slot
        const batt = allBatteries.find(b => b.userData.parentBox === box && b.userData.inSlot === slot);
        if (!batt) {
            allValid = false;
            break;
        }
        
        // Check Orientation
        const boxRightWorld = new THREE.Vector3(1,0,0).applyQuaternion(box.getWorldQuaternion(new THREE.Quaternion()));
        const battDir = new THREE.Vector3(1, 0, 0).applyQuaternion(batt.getWorldQuaternion(new THREE.Quaternion())).normalize();
        
        const expectedDot = slot.expectedDir.x; // -1 or 1
        const dot = battDir.dot(boxRightWorld);
        
        if (expectedDot < 0) {
            if (dot > -0.8) allValid = false;
        } else {
            if (dot < 0.8) allValid = false;
        }
    }
    
    if (allValid && circuit.isSwitchClosed) {
        turnOnBulbs(circuit);
    } else {
        turnOffBulbs(circuit);
    }
    
    const anyOn = circuits.some(c => c.isBulbsOn);
    const msg = document.getElementById('success-msg');
    if (msg) msg.style.display = anyOn ? 'block' : 'none';
}

function turnOnBulbs(circuit) {
    circuit.isBulbsOn = true;
    
    // Logic:
    // Parallel: Full Voltage (3V) -> Very Bright
    // Series: Half Voltage (1.5V) -> Dimmer
    
    const isParallel = circuit.bulbMode === 'parallel';
    const intensity = isParallel ? 1.5 : 0.6; 
    const bulbColor = isParallel ? 0xffff00 : 0xffaa00; 
    const filColor = isParallel ? 0xffffff : 0xff8800;

    circuit.bulbs.forEach((bulbGroup, idx) => {
        const { bulb, filament } = bulbGroup.userData.materials;
        
        bulb.emissive.set(bulbColor);
        bulb.emissiveIntensity = intensity;
        bulb.opacity = 0.9;
        
        filament.color.set(filColor);
        filament.emissive.set(filColor);
        filament.emissiveIntensity = intensity * 2;
        
        const lightName = 'bulbLight_' + idx;
        if (!circuit.group.getObjectByName(lightName)) {
            const light = new THREE.PointLight(bulbColor, 3 * intensity, 8);
            light.name = lightName;
            light.position.copy(bulbGroup.position).add(new THREE.Vector3(0, 2, 0));
            circuit.group.add(light);
        }
    });
}

function turnOffBulbs(circuit) {
    circuit.isBulbsOn = false;
    
    circuit.bulbs.forEach((bulbGroup, idx) => {
        const { bulb, filament } = bulbGroup.userData.materials;
        
        bulb.emissive.set(0x000000);
        bulb.opacity = 0.3;
        
        filament.color.set(0x555555);
        filament.emissive.set(0x000000);
        filament.emissiveIntensity = 0;
        
        const lightName = 'bulbLight_' + idx;
        const light = circuit.group.getObjectByName(lightName);
        if (light) circuit.group.remove(light);
    });
}

document.getElementById('reset-btn').addEventListener('click', () => {
    circuits.forEach(c => {
        c.isSwitchClosed = false;
        c.switch.getObjectByName('lever').rotation.x = Math.PI / 3;
        c.box.userData.slots.forEach(s => s.occupied = false);
        turnOffBulbs(c);
    });
    
    allBatteries.forEach(b => {
        b.userData.inSlot = null;
        b.userData.parentBox = null;
        b.rotation.y = 0;
        
        // Reset position
        const id = b.userData.id;
        const battIndex = id % 10; 
        const xOffset = battIndex === 1 ? -2 : 2;
        
        // Determine if this battery belongs to parallel circuit (id start with 1) or series (id start with 0)
        // Circuit IDs passed were 0 and 1. Battery IDs are id*10 + 1/2.
        // Left Circuit (Series): id=0 -> Batt 1, 2
        // Right Circuit (Parallel): id=1 -> Batt 11, 12
        
        const isParallel = id > 10;
        const zPos = isParallel ? 9.5 : 6.5;
        
        b.position.set(xOffset, 0.5, zPos);
    });
    
    document.getElementById('success-msg').style.display = 'none';
});

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
