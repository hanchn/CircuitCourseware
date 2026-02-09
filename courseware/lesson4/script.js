import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8ff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 12); // Higher view for drag and drop
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
let isSwitchClosed = true; // Default closed for this lesson
let bulbMaterial, filamentMaterial;
const batteries = [];

// Materials
const wireMat = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50, 
    roughness: 0.5,
    metalness: 0.1
});

// --- Helper Functions ---

function updateWireMesh(startPos, endPos) {
    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    const dist = startPos.distanceTo(endPos);
    mid.y += 0.5 + dist * 0.1; // Lower arc since it's pre-connected
    
    const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);
    const geometry = new THREE.TubeGeometry(curve, 20, 0.08, 8, false);
    const mesh = new THREE.Mesh(geometry, wireMat);
    mesh.castShadow = true;
    return mesh;
}

// --- Component Creators ---

// 1. Battery Box (Holds 2 AA batteries in series)
function createBatteryBox() {
    const group = new THREE.Group();
    group.name = 'batteryBox';
    
    // Main Case
    const caseGeo = new THREE.BoxGeometry(3.5, 0.8, 4.0);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Black plastic
    // Create an open box effect by using multiple meshes or just a flat base with sides?
    // Let's stick to a solid base for now with "slots"
    
    const base = new THREE.Mesh(caseGeo, caseMat);
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);
    
    // Slot 1 (Left)
    const slot1Geo = new THREE.BoxGeometry(3.0, 0.4, 1.4);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Darker inside
    const slot1 = new THREE.Mesh(slot1Geo, slotMat);
    slot1.position.set(0, 0.6, -1.0);
    group.add(slot1);
    
    // Slot 2 (Right)
    const slot2 = new THREE.Mesh(slot1Geo, slotMat);
    slot2.position.set(0, 0.6, 1.0);
    group.add(slot2);
    
    // Contacts (Springs and Plates)
    // Slot 1: Spring at Right (Negative), Plate at Left (Positive)
    // Spring (Visual spiral or cylinder)
    const springGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8);
    const springMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0 });
    const spring1 = new THREE.Mesh(springGeo, springMat);
    spring1.rotation.z = Math.PI / 2;
    spring1.position.set(1.3, 0.6, -1.0); // Right side of Slot 1
    group.add(spring1);
    
    const plateGeo = new THREE.BoxGeometry(0.1, 0.4, 0.4);
    const plate1 = new THREE.Mesh(plateGeo, springMat);
    plate1.position.set(-1.4, 0.6, -1.0); // Left side of Slot 1
    group.add(plate1);
    
    // Slot 2: Series connection means opposite orientation usually?
    // Let's say Slot 1: Left(+), Right(-)
    // Slot 2: Left(-), Right(+) to make series connection easy with a bar on one side?
    // Standard box: 
    // Row 1: + ... -  (Spring on Right)
    // Row 2: - ... +  (Spring on Left)
    // Connection: Right(-) of Row 1 connected to Right(+) of Row 2? No, that's complex.
    // Series: +[Bat1]- -> +[Bat2]-
    // Let's do:
    // Slot 1: Spring Right (-), Plate Left (+)
    // Slot 2: Spring Left (-), Plate Right (+)
    // Internal wire connects Slot 1 Right(-) to Slot 2 Left(-) ? No that's parallel or short.
    // Series: Slot 1 Right(-) connected to Slot 2 Right(+) ??
    // Let's simplify:
    // Slot 1: Plate Left (+), Spring Right (-)  <-- Battery 1 should be Left(+), Right(-)
    // Slot 2: Spring Left (-), Plate Right (+)  <-- Battery 2 should be Left(-), Right(+)
    // Box Output: Slot 1 Left(+) is Box(+), Slot 2 Right(-) is Box(-) ??
    // Internal connection: Slot 1 Right(-) connects to Slot 2 Left(-)? No.
    // Series: (+ B1 -) --connected-to-- (+ B2 -)
    // So if Slot 1 is (+ ... -) and Slot 2 is (- ... +) [flipped]
    // Then we connect Slot 1 (-) to Slot 2 (+) on one side.
    
    // Implementation:
    // Slot 1: Left (Plate +), Right (Spring -)
    // Slot 2: Left (Spring -), Right (Plate +)  <-- Wait, battery needs to be flipped here.
    // Internal Connection: Right (Spring - of S1) connected to Right (Plate + of S2).
    // Box Terminals: Left (Plate + of S1) is POS, Left (Spring - of S2) is NEG.
    
    // Spring 2 (Left side of Slot 2)
    const spring2 = new THREE.Mesh(springGeo, springMat);
    spring2.rotation.z = Math.PI / 2;
    spring2.position.set(-1.3, 0.6, 1.0); 
    group.add(spring2);
    
    // Plate 2 (Right side of Slot 2)
    const plate2 = new THREE.Mesh(plateGeo, springMat);
    plate2.position.set(1.4, 0.6, 1.0);
    group.add(plate2);
    
    // Visual Connection Bar (Right side)
    const barGeo = new THREE.BoxGeometry(0.2, 0.1, 2.2);
    const bar = new THREE.Mesh(barGeo, springMat);
    bar.position.set(1.55, 0.6, 0); // Connecting S1(-) and S2(+)
    group.add(bar);
    
    // Terminals (External)
    const termPos = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({color: 0xff0000}));
    termPos.position.set(-1.8, 0.5, -1.0); // Near S1(+)
    group.add(termPos);
    
    const termNeg = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({color: 0x000000}));
    termNeg.position.set(-1.8, 0.5, 1.0); // Near S2(-)
    group.add(termNeg);
    
    // Store slot positions for drag drop
    group.userData = {
        slots: [
            { id: 1, pos: new THREE.Vector3(0, 0.6, -1.0), occupied: false, expectedPoleDir: 1 }, // 1 means + is Left (-X local? No, Box is centered)
            // Battery default: Left is Bottom(-), Right is Top(+) if rotated -90Z?
            // Let's standardise Battery model first.
            { id: 2, pos: new THREE.Vector3(0, 0.6, 1.0), occupied: false, expectedPoleDir: -1 }
        ],
        terminals: {
            pos: new THREE.Vector3(-1.8, 0.5, -1.0),
            neg: new THREE.Vector3(-1.8, 0.5, 1.0)
        }
    };

    return group;
}

// 2. Battery (Single AA)
function createBattery(id) {
    const group = new THREE.Group();
    group.name = 'battery_' + id;
    
    // Body
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 2.8, 32),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    // Cylinder is Y-up. 
    // Rotate Z to make it lie along X.
    body.rotation.z = -Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    // Label
    const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.51, 0.51, 1.8, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    label.rotation.z = -Math.PI / 2;
    group.add(label);

    // Positive Tip (Right side in local X if not rotated, but after Z rot, Top is +X)
    // Original Cylinder: Top is Y+. Rotated -90 Z -> Top is X+.
    const pos = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    pos.rotation.z = -Math.PI / 2;
    pos.position.x = 1.5; // Tip
    group.add(pos);
    
    // Positive sign
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

    // Negative (Flat bottom at X-)
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
        emissive: 0x000000
    });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), bulbMaterial);
    glass.position.y = 1.8;
    group.add(glass);

    filamentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555, 
        emissive: 0x000000
    });
    
    // Simplified Filament
    const filament = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.02, 8, 20, Math.PI), 
        filamentMaterial
    );
    filament.position.y = 1.8;
    filament.rotation.z = Math.PI;
    group.add(filament);

    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    base.position.y = 1.0;
    group.add(base);

    // Terminals for wire connection (Visual only)
    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0x000000}));
    t1.position.set(0.4, 0.5, 0);
    group.add(t1);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0x000000}));
    t2.position.set(-0.4, 0.5, 0);
    group.add(t2);

    group.userData = { terminals: { t1: new THREE.Vector3(0.4, 0.5, 0), t2: new THREE.Vector3(-0.4, 0.5, 0) } };

    return group;
}

// 4. Switch
function createSwitch() {
    const group = new THREE.Group();
    group.name = 'switch';
    
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.2, 3),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    base.position.y = 0.1;
    group.add(base);

    // Lever
    const lever = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.1, 2.5),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })
    );
    lever.position.set(0, 0.3, 0);
    // Closed state
    group.add(lever);

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

// Battery Box
batteryBox = createBatteryBox();
batteryBox.position.set(-4, 0, 0);
scene.add(batteryBox);

// Batteries (Outside initially)
battery1 = createBattery(1);
battery1.position.set(0, 0.5, 4); // On floor
batteries.push(battery1);
scene.add(battery1);

battery2 = createBattery(2);
battery2.position.set(2, 0.5, 4); // On floor
batteries.push(battery2);
scene.add(battery2);

// Bulb
bulb = createBulb();
bulb.position.set(4, 0, 0);
scene.add(bulb);

// Switch
switchObj = createSwitch();
switchObj.position.set(0, 0, -2);
switchObj.rotation.y = Math.PI / 2;
scene.add(switchObj);

// --- Pre-wiring ---
// Path: Box(+) -> Switch -> Bulb -> Box(-)
function createWires() {
    // Box(+) to Switch(Rear)
    const boxPos = batteryBox.localToWorld(batteryBox.userData.terminals.pos.clone());
    const switchIn = switchObj.localToWorld(switchObj.userData.terminals.rear.clone());
    const w1 = updateWireMesh(boxPos, switchIn);
    scene.add(w1);
    wires.push(w1);

    // Switch(Front) to Bulb(T1)
    const switchOut = switchObj.localToWorld(switchObj.userData.terminals.front.clone());
    const bulbIn = bulb.localToWorld(bulb.userData.terminals.t1.clone());
    const w2 = updateWireMesh(switchOut, bulbIn);
    scene.add(w2);
    wires.push(w2);

    // Bulb(T2) to Box(-)
    const bulbOut = bulb.localToWorld(bulb.userData.terminals.t2.clone());
    const boxNeg = batteryBox.localToWorld(batteryBox.userData.terminals.neg.clone());
    const w3 = updateWireMesh(bulbOut, boxNeg);
    scene.add(w3);
    wires.push(w3);
}

// Delay wire creation slightly to ensure world matrices are updated? 
// Or just update them manually.
batteryBox.updateMatrixWorld();
switchObj.updateMatrixWorld();
bulb.updateMatrixWorld();
createWires();


// --- Interaction Logic (Drag & Drop) ---
const dragControls = new DragControls([...batteries], camera, renderer.domElement);

// Constrain drag to XZ plane (mostly)
dragControls.addEventListener('dragstart', function (event) {
    orbitControls.enabled = false;
    event.object.material?.emissive?.set(0xaaaaaa); // Highlight? No simple way on group
    // Lift up slightly
    event.object.position.y = 1.5;
});

dragControls.addEventListener('drag', function (event) {
    // Keep height constant
    event.object.position.y = 1.5;
});

dragControls.addEventListener('dragend', function (event) {
    orbitControls.enabled = true;
    const batt = event.object;
    batt.position.y = 0.5; // Drop

    checkDrop(batt);
    checkCircuit();
});

// Double click to remove from slot
window.addEventListener('dblclick', (event) => {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(batteries, true);
    
    if (intersects.length > 0) {
        // Find battery group
        let obj = intersects[0].object;
        while(obj && !obj.userData.type) {
            obj = obj.parent;
        }
        
        if (obj && obj.userData.type === 'battery' && obj.userData.inSlot) {
            // Remove from slot
            const slot = batteryBox.userData.slots.find(s => s.id === obj.userData.inSlot);
            if (slot) {
                slot.occupied = false;
                obj.userData.inSlot = null;
                // Move out
                obj.position.add(new THREE.Vector3(0, 0, 2));
                obj.rotation.y = 0; // Reset rotation
                checkCircuit();
            }
        }
    }
});


function checkDrop(battery) {
    const battPos = battery.position.clone();
    // Convert box slots to world
    const boxWorldPos = new THREE.Vector3();
    batteryBox.getWorldPosition(boxWorldPos);
    
    // Simple distance check against slots
    for (let slot of batteryBox.userData.slots) {
        const slotWorldPos = slot.pos.clone().applyMatrix4(batteryBox.matrixWorld);
        
        // Distance check
        if (battPos.distanceTo(slotWorldPos) < 1.0 && !slot.occupied) {
            // Snap to slot
            battery.position.copy(slotWorldPos);
            
            // Auto-orient? 
            // Let's assume user dragged it. We need to check orientation.
            // But dragging doesn't easily allow rotation with DragControls.
            // Simplified: If dropped near, we snap it in.
            // BUT we need to determine if it's "Forward" or "Backward".
            // Let's toggle orientation on click? Or just randomize/default?
            // User requirement: "防反了的话 灯泡不亮".
            // So we need to support two orientations.
            // DragControls doesn't rotate. 
            // Let's say: click battery to flip orientation?
            
            slot.occupied = true;
            battery.userData.inSlot = slot.id;
            
            // Check orientation based on current rotation?
            // Batteries are initialized with Z = -PI/2.
            // In box, they should align with Z axis.
            // If rotation.y is near 0, it points X+.
            // Wait, battery geometry: Tip is +X.
            // Box Slot 1: -X to Left, +X to Right.
            // Slot 1 needs Tip at Left (Plate +). So Tip points -X.
            // Slot 2 needs Tip at Right (Plate +). So Tip points +X.
            
            // Snap rotation to nearest 180 (X axis alignment)
            // But DragControls maintains rotation.
            // Let's set a default valid rotation for visual cleaness, 
            // OR let user click to flip.
            
            // For now, let's just snap position.
            return;
        }
    }
    
    // If not in slot, clear slot data if it was in one
    if (battery.userData.inSlot) {
        const prevSlot = batteryBox.userData.slots.find(s => s.id === battery.userData.inSlot);
        if (prevSlot) prevSlot.occupied = false;
        battery.userData.inSlot = null;
    }
}

// Click to flip battery
window.addEventListener('click', (event) => {
    // Only if not dragging (simple check)
    // We can check if mouse moved? 
    // Let's just use a raycast
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(batteries, true);
    
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj && !obj.userData.type) {
            obj = obj.parent;
        }
        if (obj && obj.userData.type === 'battery') {
             // Flip 180 around Y (World Up)
             // Battery axis is X. 
             obj.rotation.y += Math.PI;
             checkCircuit();
        }
    }
});


function checkCircuit() {
    // 1. Check if both batteries are in slots
    const s1 = batteryBox.userData.slots[0];
    const s2 = batteryBox.userData.slots[1];
    
    if (!s1.occupied || !s2.occupied) {
        turnOffBulb();
        return;
    }
    
    // 2. Check Orientation
    // Slot 1 Expects: Tip(+) at Left(-X local of box). 
    // Battery local X+ is Tip. 
    // So Battery X+ must point to Box -X.
    // Battery Rotation Y should be Math.PI (180 deg) relative to Box?
    // Let's check world direction.
    
    const b1 = batteries.find(b => b.userData.inSlot === 1);
    const b2 = batteries.find(b => b.userData.inSlot === 2);
    
    if (!b1 || !b2) return; // Should be covered by occupied check
    
    // Get direction of Tip (Local X+) in World space
    const dir1 = new THREE.Vector3(1, 0, 0).applyQuaternion(b1.quaternion).normalize();
    const dir2 = new THREE.Vector3(1, 0, 0).applyQuaternion(b2.quaternion).normalize();
    
    // Box Local X axis in World Space
    const boxRight = new THREE.Vector3(1, 0, 0).applyQuaternion(batteryBox.quaternion).normalize();
    
    // Slot 1: Plate is at Left (-X). Tip should touch Plate. So Tip should point -X.
    // Dot product with BoxRight should be -1.
    const valid1 = dir1.dot(boxRight) < -0.8;
    
    // Slot 2: Plate is at Right (+X). Tip should touch Plate. So Tip should point +X.
    // Dot product with BoxRight should be 1.
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
        light.position.set(4, 2, 0);
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

// Reset
document.getElementById('reset-btn').addEventListener('click', () => {
    battery1.position.set(0, 0.5, 4);
    battery1.rotation.y = 0;
    battery1.userData.inSlot = null;
    
    battery2.position.set(2, 0.5, 4);
    battery2.rotation.y = 0;
    battery2.userData.inSlot = null;
    
    batteryBox.userData.slots.forEach(s => s.occupied = false);
    
    checkCircuit();
});

// Loop
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
