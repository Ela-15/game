import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ── Configuration ──────────────────────────────────────────────
const CW = 800, CH = 500;
const PW = 42, PH = 60;
const GY = 450;
const EXIT_W = 68, EXIT_H = 76;
const SPIKE_SZ = 32;
const COIN_SZ = 22;

let scene, camera, renderer, container;
let localPIdx = 0;
let localBear, remoteBear;
let currentLevel = null;
let lvIdx = 0;
let gameState = 'lobby';
let t = 0;

// ── 3D Bear Class ──────────────────────────────────────────────
class Bear3D {
    constructor(x, y, char, scene) {
        this.x = x; this.y = y; this.z = 0;
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.facing = 1;
        this.char = char;
        this.anim = 'idle';
        this.frame = 0;

        this.group = new THREE.Group();
        this.group.position.set(x - CW / 2, CH / 2 - (y + PH / 2), 0);
        scene.add(this.group);

        const bodyCol = char === 'dudu' ? 0x8B5E3C : 0xF5F0E8;
        const bellyCol = char === 'dudu' ? 0xC4956A : 0xFFE0E8;

        // Body
        const body = new THREE.Mesh(
            new RoundedBoxGeometry(32, 42, 22, 4, 8),
            new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.6 })
        );
        this.group.add(body);

        // Belly
        const belly = new THREE.Mesh(
            new THREE.SphereGeometry(14, 16, 16),
            new THREE.MeshStandardMaterial({ color: bellyCol, roughness: 0.8 })
        );
        belly.position.set(0, -4, 10);
        belly.scale.set(1, 1.2, 0.4);
        this.group.add(belly);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(20, 24, 24),
            new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.6 })
        );
        head.position.set(0, 28, 2);
        this.group.add(head);

        // Ears
        [-14, 14].forEach(ex => {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(8, 16, 16),
                new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.6 })
            );
            ear.position.set(ex, 44, -2);
            this.group.add(ear);
        });

        // Eyes
        [-8, 8].forEach(ex => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0x000000 })
            );
            eye.position.set(ex, 32, 19);
            this.group.add(eye);
        });

        // Nose
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(4, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x3D1A00 })
        );
        nose.position.set(0, 25, 21);
        nose.scale.set(1, 0.7, 0.5);
        this.group.add(nose);
    }

    update(input, platforms, barriers, spikes) {
        const gravity = 0.6;
        const jump = -12;
        const speed = 4.5;
        const friction = 0.85;

        if (input.left) { this.vx = -speed; this.facing = -1; this.anim = 'walk'; }
        else if (input.right) { this.vx = speed; this.facing = 1; this.anim = 'walk'; }
        else { this.vx *= friction; if (Math.abs(this.vx) < 0.1) { this.vx = 0; this.anim = 'idle'; } }

        this.vy += gravity;
        const prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;

        // Constrain to world
        if (this.x < 20) this.x = 20;
        if (this.x > CW - 20) this.x = CW - 20;

        this.onGround = false;
        for (const p of platforms) {
            if (this.x + PW / 2 > p.x && this.x - PW / 2 < p.x + p.w) {
                if (this.vy >= 0 && prevY + PH <= p.y + 10 && this.y + PH >= p.y) {
                    this.y = p.y - PH;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }

        if (input.up && this.onGround) {
            this.vy = jump;
            this.onGround = false;
            this.anim = 'jump';
        }

        // Wrap-around or bounds check for Z (stay at 0)
        this.z = 0;

        // Update 3D position
        this.group.position.set(this.x - CW / 2, CH / 2 - (this.y + PH / 2), this.z);

        // Smooth Rotation
        const targetRot = this.facing === 1 ? 0 : Math.PI;
        let diff = targetRot - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * 0.15;

        // Anim Bob
        this.frame++;
        if (this.anim === 'walk') {
            this.group.position.y += Math.sin(this.frame * 0.25) * 3;
            this.group.rotation.z = Math.sin(this.frame * 0.2) * 0.05;
        } else {
            this.group.rotation.z = 0;
        }
    }

    applyState(s) {
        this.x = s.x; this.y = s.y; this.facing = s.facing;
        this.anim = s.anim; this.frame = s.frame;
        this.group.position.set(this.x - CW / 2, CH / 2 - (this.y + PH / 2), 0);
        const targetRot = this.facing === 1 ? 0 : Math.PI;
        this.group.rotation.y = targetRot;
    }

    getState() {
        return { x: this.x, y: this.y, facing: this.facing, anim: this.anim, frame: this.frame };
    }
}

// ── Level Building & Scene Setup ──────────────────────────────
function buildLevels() {
    const GY = 450;
    return [
        {
            name: '🌸 Sweet Meadow',
            sky: [0x87CEEB, 0xC5EFC5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 170, y: 415, w: 130, h: 16 },
                { x: 370, y: 330, w: 150, h: 16 },
                { x: 590, y: 415, w: 130, h: 16 },
            ],
            keys: [{ id: 0, x: 442, y: 300 }],
            plates: [], barriers: [], spikes: [], movingPlatforms: [], coins: [],
            exit: { x: 672, y: 422 },
            spawns: [{ x: 55, y: 454 }, { x: 105, y: 454 }],
            totalKeys: 1,
        },
        {
            name: '🍯 Honey Forest',
            sky: [0xFDFAE0, 0xC8E6C9],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 60, y: 418, w: 170, h: 16 },
                { x: 310, y: 348, w: 110, h: 16 },
                { x: 500, y: 275, w: 110, h: 16 },
                { x: 635, y: 398, w: 140, h: 16 },
            ],
            keys: [{ id: 0, x: 352, y: 320 }, { id: 1, x: 538, y: 248 }],
            plates: [], barriers: [], spikes: [], movingPlatforms: [], coins: [],
            exit: { x: 710, y: 362 },
            spawns: [{ x: 80, y: 382 }, { x: 130, y: 382 }],
            totalKeys: 2,
        },
        {
            name: '🌺 Blossom Bridge',
            sky: [0xFFD1DC, 0xFFF0F5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 0, y: 448, w: 210, h: 16 },
                { x: 275, y: 378, w: 90, h: 16 },
                { x: 455, y: 378, w: 90, h: 16 },
                { x: 605, y: 448, w: 195, h: 16 },
            ],
            keys: [{ id: 0, x: 312, y: 350 }],
            plates: [{ id: 0, x: 110, y: 448, w: 56, h: 13, doorId: 0 }],
            barriers: [{ id: 0, x: 550, y: 358, w: 22, h: 90 }],
            exit: { x: 718, y: 416 },
            spawns: [{ x: 45, y: 454 }, { x: 95, y: 454 }],
            totalKeys: 1,
        },
        {
            name: '💀 Spike Valley',
            sky: [0xFF9E80, 0xFF3D00],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 200, y: 420, w: 100, h: 16 },
                { x: 400, y: 340, w: 100, h: 16 },
                { x: 600, y: 420, w: 100, h: 16 }
            ],
            keys: [{ id: 0, x: 432, y: 310 }],
            spikes: [
                { x: 300, y: GY - SPIKE_SZ }, { x: 332, y: GY - SPIKE_SZ }, { x: 364, y: GY - SPIKE_SZ },
                { x: 500, y: GY - SPIKE_SZ }, { x: 532, y: GY - SPIKE_SZ }, { x: 564, y: GY - SPIKE_SZ },
            ],
            coins: [{ id: 0, x: 140, y: 460 }, { id: 1, x: 650, y: 460 }],
            exit: { x: 700, y: 422 },
            spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }],
            totalKeys: 1,
        },
        {
            name: '☁️ Cloud Steps',
            sky: [0xDDEEFF, 0xB3D4F5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 55, y: 438, w: 150, h: 16 },
                { x: 260, y: 366, w: 125, h: 16 },
                { x: 430, y: 292, w: 130, h: 16 },
                { x: 605, y: 218, w: 160, h: 16 },
                { x: 155, y: 218, w: 100, h: 16 },
            ],
            keys: [{ id: 0, x: 468, y: 265 }, { id: 1, x: 178, y: 191 }],
            plates: [], barriers: [], spikes: [], movingPlatforms: [], coins: [],
            exit: { x: 672, y: 186 },
            spawns: [{ x: 75, y: 402 }, { x: 125, y: 402 }],
            totalKeys: 2,
        },
        {
            name: '💕 Summit of Hearts',
            sky: [0xFF6B9D, 0xFF8E53],
            platforms: [
                { x: 0, y: GY, w: CW, h: 50, isGround: true },
                { x: 0, y: 448, w: 175, h: 16 },
                { x: 228, y: 396, w: 115, h: 16 },
                { x: 125, y: 320, w: 100, h: 16 },
                { x: 330, y: 248, w: 115, h: 16 },
                { x: 505, y: 330, w: 110, h: 16 },
                { x: 645, y: 396, w: 155, h: 16 },
                { x: 490, y: 188, w: 135, h: 16 },
            ],
            keys: [{ id: 0, x: 158, y: 293 }, { id: 1, x: 368, y: 222 }, { id: 2, x: 518, y: 162 }],
            plates: [{ id: 0, x: 258, y: 396, w: 50, h: 13, doorId: 0 }],
            barriers: [{ id: 0, x: 470, y: 306, w: 22, h: 90 }],
            exit: { x: 700, y: 422 },
            spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }],
            totalKeys: 3,
            spikes: [], movingPlatforms: [], coins: []
        }
    ];
}

const levels = buildLevels();
let keysGot = new Set();
let coinsGot = new Set();
let totalCoins = 0;

function init3D() {
    container = document.getElementById('three-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, CW / CH, 1, 2000);
    camera.position.set(0, 50, 700);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(CW, CH);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dLight.position.set(150, 300, 400);
    dLight.castShadow = true;
    scene.add(dLight);

    loadLevel3D(lvIdx);
    loop();
}

function loadLevel3D(idx) {
    if (idx >= levels.length) {
        gameState = 'complete';
        return;
    }

    // Cleanup
    scene.children.filter(c => c.isLvObj).forEach(c => scene.remove(c));
    keysGot.clear();

    const lv = levels[idx];
    currentLevel = lv;
    scene.background = new THREE.Color(lv.sky[0]);

    // 3D Glass Platforms
    lv.platforms.forEach(p => {
        const geo = new RoundedBoxGeometry(p.w, p.h, 60, 4, 10);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transmission: 1.0,
            opacity: 0.5,
            transparent: true,
            roughness: 0,
            thickness: 10,
            reflectivity: 0.5,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x + p.w / 2 - CW / 2, CH / 2 - (p.y + p.h / 2), -30);
        mesh.receiveShadow = true;
        mesh.isLvObj = true;
        scene.add(mesh);
    });

    // 3D Metal Spikes
    if (lv.spikes) {
        lv.spikes.forEach(s => {
            const geo = new THREE.ConeGeometry(SPIKE_SZ / 2, SPIKE_SZ, 16);
            const mat = new THREE.MeshStandardMaterial({ color: 0x607D8B, metalness: 0.8, roughness: 0.2 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(s.x + SPIKE_SZ / 2 - CW / 2, CH / 2 - (s.y + SPIKE_SZ / 2), 0);
            mesh.isLvObj = true;
            mesh.castShadow = true;
            scene.add(mesh);
        });
    }

    // 3D Coins
    if (lv.coins) {
        lv.coins.forEach(c => {
            const geo = new THREE.TorusGeometry(COIN_SZ / 2, 4, 8, 24);
            const mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(c.x + COIN_SZ / 2 - CW / 2, CH / 2 - (c.y + COIN_SZ / 2), 0);
            mesh.isLvObj = true;
            mesh.isCoin = true;
            mesh.coinId = c.id;
            scene.add(mesh);
        });
    }

    // 3D Keys
    if (lv.keys) {
        lv.keys.forEach(k => {
            const geo = new THREE.TorusGeometry(12, 3, 8, 24);
            const mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0x221100 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(k.x - CW / 2, CH / 2 - k.y, 10);
            mesh.isLvObj = true; mesh.isKey = true; mesh.keyId = k.id;
            scene.add(mesh);
        });
    }

    // 3D Exit Portal
    const portalGeo = new THREE.TorusGeometry(EXIT_W / 2, 6, 16, 40);
    const portalMat = new THREE.MeshBasicMaterial({ color: 0xFF4D88, transparent: true, opacity: 0.8 });
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(lv.exit.x + EXIT_W / 2 - CW / 2, CH / 2 - (lv.exit.y + EXIT_H / 2), -10);
    portal.isLvObj = true; portal.isExit = true;
    scene.add(portal);

    // Reset bears
    const s0 = lv.spawns[0], s1 = lv.spawns[1];
    if (localBear) scene.remove(localBear.group);
    if (remoteBear) scene.remove(remoteBear.group);

    localBear = new Bear3D(localPIdx === 0 ? s0.x : s1.x, localPIdx === 0 ? s0.y : s1.y, localPIdx === 0 ? 'dudu' : 'bubu', scene);
    remoteBear = new Bear3D(localPIdx === 0 ? s1.x : s0.x, localPIdx === 0 ? s1.y : s0.y, localPIdx === 0 ? 'bubu' : 'dudu', scene);
}

function loop() {
    requestAnimationFrame(loop);
    if (gameState !== 'playing') return;
    t++;

    if (localBear) {
        localBear.update(getInput(), currentLevel.platforms, [], []);
        if (window.NET_state) window.NET_state(localBear.getState());

        // Key pickup
        scene.children.forEach(c => {
            if (c.isKey && !c.collected) {
                const dist = Math.hypot(localBear.x - (c.position.x + CW / 2), localBear.y - (CH / 2 - c.position.y));
                if (dist < 30) {
                    c.collected = true; c.visible = false;
                    keysGot.add(c.keyId);
                    if (window.NET_key) window.NET_key(c.keyId);
                }
            }
        });

        // Exit check
        const allKeys = keysGot.size >= currentLevel.totalKeys;
        if (allKeys) {
            const exit = scene.children.find(c => c.isExit);
            if (exit) exit.rotation.z += 0.05;

            const distLocal = Math.hypot(localBear.x - (currentLevel.exit.x + EXIT_W / 2), localBear.y - (currentLevel.exit.y + EXIT_H / 2));
            const distRemote = remoteBear ? Math.hypot(remoteBear.x - (currentLevel.exit.x + EXIT_W / 2), remoteBear.y - (currentLevel.exit.y + EXIT_H / 2)) : 1000;

            if (distLocal < 40 && distRemote < 40) {
                triggerNextLevel();
            }
        }
    }

    // Animate coins and keys
    scene.children.forEach(c => {
        if (c.isCoin || c.isKey) c.rotation.y += 0.03;
    });

    renderer.render(scene, camera);
}

function triggerNextLevel() {
    gameState = 'loading';
    if (window.NET_nextLevel) window.NET_nextLevel(lvIdx + 1);
}

// ── Input ──────────────────────────────────────────────────────
const keyState = {};
window.addEventListener('keydown', e => keyState[e.code] = true);
window.addEventListener('keyup', e => keyState[e.code] = false);
function getInput() {
    return {
        left: keyState['ArrowLeft'] || keyState['KeyA'],
        right: keyState['ArrowRight'] || keyState['KeyD'],
        up: keyState['ArrowUp'] || keyState['KeyW'] || keyState['Space']
    };
}

// ── Network Integration ────────────────────────────────────────
window.onBothReady = (pIdx, startLevel) => {
    if (gameState !== 'lobby') return;
    localPIdx = pIdx;
    lvIdx = startLevel;
    document.getElementById('scene-lobby').classList.remove('active');
    document.getElementById('scene-game').classList.add('active');
    document.getElementById('three-container').classList.add('active');

    init3D();
    gameState = 'playing';
};

window.onRemoteKey = (id) => {
    const k = scene.children.find(c => c.isKey && c.keyId === id);
    if (k && !k.collected) {
        k.collected = true; k.visible = false;
        keysGot.add(id);
    }
};

window.onLoadLevel = (idx) => {
    if (idx >= levels.length) {
        gameState = 'complete';
        document.getElementById('scene-game').classList.remove('active');
        document.getElementById('scene-gamecomplete').classList.add('active');
    } else {
        lvIdx = idx;
        loadLevel3D(idx);
        gameState = 'playing';
    }
};

window.onRemoteState = (state) => {
    if (remoteBear) remoteBear.applyState(state);
};

if (window.NET_reportReady) window.NET_reportReady();
