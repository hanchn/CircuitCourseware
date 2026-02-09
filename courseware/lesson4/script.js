import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.maxPolarAngle = Math.PI / 2.2;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 20;

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
let battery1, battery2;
let batteryBox;
let bulb;
let switchObj;
let wires = [];
let isSwitchClosed = false; // Start Open for better interaction
let bulbMaterial, filamentMaterial;
const batteries = [];

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

// --- Component Creators ---

// 1. Battery Box (Serial)
function createBatteryBox() {
    const group = new THREE.Group();
    group.name = 'batteryBox';
    
    // Main Case
    const caseGeo = new THREE.BoxGeometry(3.6, 0.8, 4.0); // Slightly larger
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
    const base = new THREE.Mesh(caseGeo, caseMat);
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);
    
    // Slots (Visual indents)
    const slotGeo = new THREE.BoxGeometry(3.3, 0.5, 1.6);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const slot1 = new THREE.Mesh(slotGeo, slotMat);
    slot1.position.set(0, 0.6, -1.0);
    group.add(slot1);
    
    const slot2 = new THREE.Mesh(slotGeo, slotMat);
    slot2.position.set(0, 0.6, 1.0);
    group.add(slot2);
    
    // --- Contacts & Details ---
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.2 });
    
    // Helper: Create Spring
    function createSpring() {
        const points = [];
        const turns = 6; // More turns
        const length = 0.5; // Longer
        const radius = 0.25; // Bigger radius
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const angle = t * Math.PI * 2 * turns;
            const x = t * length;
            const y = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            points.push(new THREE.Vector3(x, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const geo = new THREE.TubeGeometry(curve, 60, 0.04, 8, false); // Thicker wire
        const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 }); // Brighter metal
        return new THREE.Mesh(geo, mat);
    }

    // Helper: Create Plate
    function createPlate() {
        const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
        return new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.6), mat); // Larger plate
    }

    // Helper: Create Polarity Label
    function createLabel(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8 });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.5, 0.5, 0.5);
        return sprite;
    }

    // -- Slot 1 (Back): Left (+), Right (-) --
    // Plate Left
    const plate1 = createPlate();
    plate1.position.set(-1.6, 0.6, -1.0);
    group.add(plate1);
    
    // Spring Right (Points -X)
    const spring1 = createSpring();
    spring1.rotation.y = Math.PI; // Flip to point Left
    spring1.position.set(1.6, 0.6, -1.0);
    group.add(spring1);

    // Labels Slot 1
    const l1Plus = createLabel('+', '#ff0000');
    l1Plus.position.set(-1.0, 0.36, -1.0); // On floor of slot
    l1Plus.rotation.x = -Math.PI/2; // Lay flat? Sprites always face camera.
    // Actually Sprites face camera, so just position them. 
    // If we want flat labels on floor, use PlaneMesh.
    // Let's use Plane for floor labels.
    function createFlatLabel(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        // bg
        // ctx.fillStyle = '#111111';
        // ctx.fillRect(0,0,64,64);
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
    const flatL1Plus = createFlatLabel('+', '#555555');
    flatL1Plus.position.set(-1.0, 0.36, -1.0); // Slightly above bottom of slot (0.4 - 0.2 = 0.2? Slot center y=0.6, height 0.5 -> bottom 0.35)
    group.add(flatL1Plus);
    
    const flatL1Neg = createFlatLabel('-', '#555555');
    flatL1Neg.position.set(1.0, 0.36, -1.0);
    group.add(flatL1Neg);


    // -- Slot 2 (Front): Left (-), Right (+) --
    // Spring Left (Points +X)
    const spring2 = createSpring();
    spring2.position.set(-1.6, 0.6, 1.0);
    group.add(spring2);
    
    // Plate Right
    const plate2 = createPlate();
    plate2.position.set(1.6, 0.6, 1.0);
    group.add(plate2);

    // Labels Slot 2
    const flatL2Neg = createFlatLabel('-', '#555555');
    flatL2Neg.position.set(-1.0, 0.36, 1.0);
    group.add(flatL2Neg);
    
    const flatL2Plus = createFlatLabel('+', '#555555');
    flatL2Plus.position.set(1.0, 0.36, 1.0);
    group.add(flatL2Plus);

    // -- Connections --
    // Series Bar (Left side) - Connects S1 Left(+) to S2 Left(-)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.2), metalMat);
    bar.position.set(-1.75, 0.6, 0); 
    group.add(bar);
    
    // Output Terminals (Right Side)
    const termBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 2.2), new THREE.MeshStandardMaterial({color: 0x333333}));
    termBase.position.set(1.9, 0.4, 0);
    group.add(termBase);

    // Positive Terminal (Red) at Right Front (Slot 2 Right)
    const termPos = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3), new THREE.MeshStandardMaterial({color: 0xff0000}));
    termPos.position.set(1.9, 0.7, 1.0); // Output + (Front)
    group.add(termPos);
    
    // Negative Terminal (Black) at Right Back (Slot 1 Right)
    const termNeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3), new THREE.MeshStandardMaterial({color: 0x000000}));
    termNeg.position.set(1.9, 0.7, -1.0); // Output - (Back)
    group.add(termNeg);

    group.userData = {
        slots: [
            // Slot 1: Expects Tip(+) at Left (-X) -> Spring at Right(-), Plate at Left(+)
            { id: 1, pos: new THREE.Vector3(0, 0.6, -1.0), occupied: false, expectedDir: new THREE.Vector3(-1, 0, 0) }, 
            // Slot 2: Expects Tip(+) at Right (+X) -> Plate at Right(+), Spring at Left(-)
            { id: 2, pos: new THREE.Vector3(0, 0.6, 1.0), occupied: false, expectedDir: new THREE.Vector3(1, 0, 0) }
        ],
        terminals: {
            pos: new THREE.Vector3(1.9, 0.7, 1.0), // + (Right Front)
            neg: new THREE.Vector3(1.9, 0.7, -1.0) // - (Right Back)
        }
    };

    return group;
}

// 2. Battery
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
        inSlot: null
    };

    return group;
}

// 3. Bulb
function createBulb() {
    const group = new THREE.Group();
    group.name = 'bulb';
    
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

    group.userData = { terminals: { t1: new THREE.Vector3(0.4, 0.5, 0), t2: new THREE.Vector3(-0.4, 0.5, 0) } };

    return group;
}

// 4. Switch (Knife Switch)
function createSwitch() {
    const group = new THREE.Group();
    group.name = 'switch';
    
    // Base
    const baseGeo = new THREE.BoxGeometry(1.5, 0.2, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    group.add(base);

    // Contacts (Metal clips)
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    const clipGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    
    // Rear hinge
    const rearClip = new THREE.Mesh(clipGeo, metalMat);
    rearClip.position.set(0, 0.4, 1.0);
    group.add(rearClip);
    
    // Hinge Pin
    const pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6);
    const pin = new THREE.Mesh(pinGeo, metalMat);
    pin.rotation.z = Math.PI / 2; // Horizontal pin
    pin.position.set(0, 0.5, 1.0);
    group.add(pin);

    // Front contact
    const frontClip = new THREE.Mesh(clipGeo, metalMat);
    frontClip.position.set(0, 0.4, -1.0);
    group.add(frontClip);

    // Lever Group
    const leverGroup = new THREE.Group();
    leverGroup.name = 'lever'; // Add name for easy access
    leverGroup.position.set(0, 0.5, 1.0); // Pivot at rear
    
    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.2, 0.1, 2.2);
    bladeGeo.translate(0, 0, -1.0); 
    const blade = new THREE.Mesh(bladeGeo, metalMat);
    leverGroup.add(blade);

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 2;
    handle.position.set(0, 0, -2.2);
    leverGroup.add(handle);

    // Closed state (Flat)
    leverGroup.rotation.x = Math.PI / 3; // Start Open
    group.add(leverGroup);

    // Terminals
    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0xc0c0c0}));
    t1.position.set(0, 0.2, 1.2);
    group.add(t1);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0xc0c0c0}));
    t2.position.set(0, 0.2, -1.2);
    group.add(t2);

    group.userData = { terminals: { front: new THREE.Vector3(0, 0.2, -1.2), rear: new THREE.Vector3(0, 0.2, 1.2) } };
    
    return group;
}

// --- Init Scene ---
batteryBox = createBatteryBox();
batteryBox.position.set(-3, 0, 0);
scene.add(batteryBox);

battery1 = createBattery(1);
battery1.position.set(-2, 0.5, 6.5); // Moved left
batteries.push(battery1);
scene.add(battery1);

battery2 = createBattery(2);
battery2.position.set(2, 0.5, 6.5); // Moved right
batteries.push(battery2);
scene.add(battery2);

bulb = createBulb();
bulb.position.set(3, 0, 0);
scene.add(bulb);

switchObj = createSwitch();
switchObj.position.set(0, 0, 4); // Moved further forward
switchObj.rotation.y = Math.PI / 2;
scene.add(switchObj);

// --- Wires ---
function createWires() {
    // 1. Box(+) [Right Front] to Switch(Left)
    const p1 = batteryBox.localToWorld(batteryBox.userData.terminals.pos.clone());
    const p2 = switchObj.localToWorld(switchObj.userData.terminals.front.clone());
    
    // Control points for cleaner path
    const cp1 = p1.clone().add(new THREE.Vector3(0, 0, 1)); // Out Front from box
    const cp2 = p2.clone().add(new THREE.Vector3(-1, 0, 0)); // Into switch
    
    const w1 = updateWireMesh(p1, [cp1, cp2], p2);
    scene.add(w1);
    wires.push(w1);

    // 2. Switch(Right) to Bulb(Left)
    const p3 = switchObj.localToWorld(switchObj.userData.terminals.rear.clone());
    const p4 = bulb.localToWorld(bulb.userData.terminals.t2.clone()); // Left terminal
    
    const cp3 = p3.clone().add(new THREE.Vector3(1, 0, 0));
    const cp4 = p4.clone().add(new THREE.Vector3(0, 0, 1));
    
    const w2 = updateWireMesh(p3, [cp3, cp4], p4);
    scene.add(w2);
    wires.push(w2);

    // 3. Bulb(Right) to Box(-) [Right Back]
    const p5 = bulb.localToWorld(bulb.userData.terminals.t1.clone());
    const p6 = batteryBox.localToWorld(batteryBox.userData.terminals.neg.clone());
    
    // Path: Bulb Right -> Behind Bulb -> Behind Switch -> Box Back
    const cp5 = p5.clone().add(new THREE.Vector3(0, 0, -1));
    const cp6 = new THREE.Vector3(3, 0.1, -2); // Behind Bulb
    const cp7 = new THREE.Vector3(0, 0.1, -2); // Behind Switch
    const cp8 = p6.clone().add(new THREE.Vector3(1, 0, -1)); // Into Box Back
    
    const w3 = updateWireMesh(p5, [cp5, cp6, cp7, cp8], p6);
    scene.add(w3);
    wires.push(w3);
}

// Update matrices before calculating positions
scene.updateMatrixWorld(true);
createWires();


// --- Custom Drag Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(batteries, true);
    
    if (intersects.length > 0) {
        // Find Group
        let obj = intersects[0].object;
        while(obj && !obj.userData.type) {
            obj = obj.parent;
        }
        
        if (obj && obj.userData.type === 'battery') {
            isDragging = true;
            dragObject = obj;
            orbitControls.enabled = false;
            
            // Calculate offset
            // Raycast to plane
            raycaster.ray.intersectPlane(dragPlane, dragOffset);
            dragOffset.sub(dragObject.position);
            
            // Lift
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
        // Apply pos
        const newPos = intersectPoint.sub(dragOffset);
        newPos.y = 1.5; // Keep height
        dragObject.position.copy(newPos);
    }
});

window.addEventListener('mouseup', () => {
    if (isDragging && dragObject) {
        isDragging = false;
        orbitControls.enabled = true;
        
        // Drop logic
        dragObject.position.y = 0.5;
        checkDrop(dragObject);
        checkCircuit();
        
        dragObject = null;
    }
});

function checkDrop(battery) {
    const battPos = battery.position.clone();
    const boxWorldPos = new THREE.Vector3();
    batteryBox.getWorldPosition(boxWorldPos);
    
    for (let slot of batteryBox.userData.slots) {
        const slotWorldPos = slot.pos.clone().applyMatrix4(batteryBox.matrixWorld);
        
        if (battPos.distanceTo(slotWorldPos) < 1.0 && (!slot.occupied || battery.userData.inSlot === slot.id)) {
            // Snap
            battery.position.copy(slotWorldPos);
            slot.occupied = true;
            battery.userData.inSlot = slot.id;
            return;
        }
    }
    
    // Clear slot if moved out
    if (battery.userData.inSlot) {
        const prevSlot = batteryBox.userData.slots.find(s => s.id === battery.userData.inSlot);
        if (prevSlot) prevSlot.occupied = false;
        battery.userData.inSlot = null;
    }
}

// Toggle Switch
function toggleSwitch() {
    // If it's closed (down), target is Open (up, PI/3)
    // If it's open (up), target is Closed (down, 0)
    const targetRot = isSwitchClosed ? Math.PI / 3 : 0; 
    
    // Toggle state AFTER setting target logic based on CURRENT state
    isSwitchClosed = !isSwitchClosed;

    const leverGroup = switchObj.getObjectByName('lever'); 
    if (!leverGroup) return;

    // Simple animation
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
            // Ensure exact end rotation
            leverGroup.rotation.x = targetRot;
            checkCircuit(); 
        }
    }
    animateSwitch();
}

// Click to flip (when not dragging)
window.addEventListener('click', (e) => {
    if (isDragging) return; // Prevent click trigger after drag
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check Switch first
    const switchHits = raycaster.intersectObjects(scene.children, true);
    if (switchHits.length > 0) {
        let obj = switchHits[0].object;
        while(obj) {
            if (obj.name === 'switch') {
                toggleSwitch();
                return;
            }
            obj = obj.parent;
        }
    }

    // Check Batteries
    const intersects = raycaster.intersectObjects(batteries, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj && !obj.userData.type) obj = obj.parent;
        
        if (obj && obj.userData.type === 'battery') {
            obj.rotation.y += Math.PI;
            checkCircuit();
        }
    }
});

function checkCircuit() {
    const s1 = batteryBox.userData.slots[0];
    const s2 = batteryBox.userData.slots[1];
    
    if (!s1.occupied || !s2.occupied) {
        turnOffBulb();
        return;
    }
    
    const b1 = batteries.find(b => b.userData.inSlot === 1);
    const b2 = batteries.find(b => b.userData.inSlot === 2);
    
    if (!b1 || !b2) return;
    
    // Check orientation
    // Battery Local X+ is Tip
    const boxRight = new THREE.Vector3(1, 0, 0).applyQuaternion(batteryBox.quaternion).normalize();
    
    // B1: Tip should point Left (-X of box)
    const dir1 = new THREE.Vector3(1, 0, 0).applyQuaternion(b1.quaternion).normalize();
    const valid1 = dir1.dot(boxRight) < -0.8;
    
    // B2: Tip should point Right (+X of box)
    const dir2 = new THREE.Vector3(1, 0, 0).applyQuaternion(b2.quaternion).normalize();
    const valid2 = dir2.dot(boxRight) > 0.8;
    
    if (valid1 && valid2 && isSwitchClosed) {
        turnOnBulb();
        document.getElementById('success-msg').style.display = 'block';
    } else {
        turnOffBulb();
        document.getElementById('success-msg').style.display = 'none';
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
        light.position.set(3, 2, 0);
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
}

document.getElementById('reset-btn').addEventListener('click', () => {
    battery1.position.set(-2, 0.5, 6.5);
    battery1.rotation.y = 0;
    battery1.userData.inSlot = null;
    
    battery2.position.set(2, 0.5, 6.5);
    battery2.rotation.y = 0;
    battery2.userData.inSlot = null;
    
    batteryBox.userData.slots.forEach(s => s.occupied = false);
    checkCircuit();
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
