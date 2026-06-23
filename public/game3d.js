import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ── Configuration ──────────────────────────────────────────────
const CW = 800, CH = 500;
const PW = 42, PH = 60;
const GY = 450;
const EXIT_W = 68, EXIT_H = 76;
const SPIKE_SZ = 32;
const COIN_SZ = 22;

let scene3d, camera, renderer, container;
let localPIdx = 0;
let localBear, remoteBear;
let currentLevel = null;
let lvIdx = 0;
let gameState = 'lobby';
let t = 0;

// ── Sound ──────────────────────────────────────────────────────
let _ac = null;
function ac() { return _ac || (_ac = new (window.AudioContext || window.webkitAudioContext)()); }

function sfx(freq, dur, type = 'sine', vol = 0.18) {
    try {
        const c = ac(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
        g.gain.setValueAtTime(vol, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.start(c.currentTime); o.stop(c.currentTime + dur);
    } catch (e) { }
}

function playCollect() {
    sfx(523, 0.08); setTimeout(() => sfx(659, 0.08), 80); setTimeout(() => sfx(784, 0.15), 160);
}
function playLevel() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx(f, 0.3, 'sine', 0.15), i * 120));
}
function playVictory() {
    [523, 659, 784, 1047, 1318].forEach((f, i) => setTimeout(() => sfx(f, 0.4, 'sine', 0.15), i * 100));
}

// ── HUD Overlay (HTML-based since we're using WebGL) ───────────
let hudOverlay = null;
function createHUD() {
    hudOverlay = document.createElement('div');
    hudOverlay.id = 'game-hud';
    hudOverlay.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0;
        height: 46px; background: rgba(0,0,0,0.38);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Nunito', sans-serif; pointer-events: none; z-index: 10;
    `;
    container.style.position = 'relative';
    container.appendChild(hudOverlay);
    updateHUD();
}

function updateHUD() {
    if (!hudOverlay || !currentLevel) return;
    const allKeys = keysGot.size >= currentLevel.totalKeys;
    const keyColor = allKeys ? '#7FFF00' : '#FFD700';
    hudOverlay.innerHTML = `
        <div style="position:absolute;left:10px;top:4px">
            <div style="font-size:12px;font-weight:800;color:#D2956A;">🐻 DUDU</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.55);">WASD + Space</div>
        </div>
        <div style="text-align:center">
            <div style="font-size:13px;font-weight:700;color:${keyColor};">🔑 ${keysGot.size} / ${currentLevel.totalKeys}</div>
            <div style="font-size:15px;font-weight:700;color:#FFE4A0;">${currentLevel.name}</div>
        </div>
        <div style="position:absolute;right:10px;top:4px;text-align:right;">
            <div style="font-size:12px;font-weight:800;color:#F0E0D8;">BUBU 🐻</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.55);">Arrows + Enter</div>
        </div>
    `;
}

// ── 3D Bear Class ──────────────────────────────────────────────
class Bear3D {
    constructor(x, y, char, scn) {
        this.x = x; this.y = y; this.z = 0;
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.facing = 1;
        this.char = char;
        this.anim = 'idle';
        this.frame = 0;
        this.spawnX = x;
        this.spawnY = y;

        this.group = new THREE.Group();
        this.group.position.set(x - CW / 2, CH / 2 - (y + PH / 2), 0);
        scn.add(this.group);

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

        // Spike collision — respawn
        if (spikes) {
            for (const s of spikes) {
                const pad = 6;
                if (this.x + PW / 2 > s.x + pad && this.x - PW / 2 < s.x + SPIKE_SZ - pad &&
                    this.y + PH > s.y + pad && this.y < s.y + SPIKE_SZ - pad) {
                    this.reset();
                }
            }
        }

        // Floor failsafe
        if (this.y + PH > CH + 50) {
            this.reset();
        }

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

    reset() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = 0;
        this.vy = 0;
        this.group.position.set(this.x - CW / 2, CH / 2 - (this.y + PH / 2), 0);
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
            hint: 'Grab the golden key, then BOTH reach the Heart Portal together! 💕',
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
            spawns: [{ x: 55, y: 380 }, { x: 105, y: 380 }],
            totalKeys: 1,
        },
        {
            name: '🍯 Honey Forest',
            hint: 'Split up! Each grab a key, then reunite at the Heart Portal! 🍯',
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
            spawns: [{ x: 80, y: 350 }, { x: 130, y: 350 }],
            totalKeys: 2,
        },
        {
            name: '🌺 Blossom Bridge',
            hint: 'One bear holds the 🟡 button while the other sneaks past the red wall!',
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
            spikes: [], movingPlatforms: [], coins: [],
            exit: { x: 718, y: 416 },
            spawns: [{ x: 45, y: 380 }, { x: 95, y: 380 }],
            totalKeys: 1,
        },
        {
            name: '💀 Spike Valley',
            hint: 'Watch your step! Spikes are sharp! 🌵',
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
            coins: [{ id: 0, x: 140, y: 400 }, { id: 1, x: 650, y: 400 }],
            plates: [], barriers: [], movingPlatforms: [],
            exit: { x: 700, y: 380 },
            spawns: [{ x: 50, y: 380 }, { x: 100, y: 380 }],
            totalKeys: 1,
        },
        {
            name: '☁️ Cloud Steps',
            hint: 'Climb higher together — keys are up in the clouds! ☁️',
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
            spawns: [{ x: 75, y: 380 }, { x: 125, y: 380 }],
            totalKeys: 2,
        },
        {
            name: '💕 Summit of Hearts',
            hint: 'Final level! Use the button, collect 3 keys, reach the portal as ONE! 💖',
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
            exit: { x: 700, y: 380 },
            spawns: [{ x: 50, y: 380 }, { x: 100, y: 380 }],
            totalKeys: 3,
            spikes: [], movingPlatforms: [], coins: []
        }
    ];
}

const levels = buildLevels();
let keysGot = new Set();
let coinsGot = new Set();
let totalCoins = 0;
let barriers3d = [];
let plates3d = [];
let lvCompTmr = 0;

function init3D() {
    container = document.getElementById('three-container');
    scene3d = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, CW / CH, 1, 2000);
    camera.position.set(0, 50, 700);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(CW, CH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene3d.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dLight.position.set(150, 300, 400);
    dLight.castShadow = true;
    scene3d.add(dLight);

    createHUD();
    loadLevel3D(lvIdx);
    loop();
}

function loadLevel3D(idx) {
    if (idx >= levels.length) {
        gameState = 'complete';
        return;
    }

    // Cleanup level objects
    const toRemove = scene3d.children.filter(c => c.isLvObj);
    toRemove.forEach(c => scene3d.remove(c));

    keysGot.clear();
    coinsGot.clear();

    const lv = levels[idx];
    currentLevel = lv;
    barriers3d = (lv.barriers || []).map(b => ({ ...b, open: false }));
    plates3d = (lv.plates || []).map(p => ({ ...p, active: false }));
    totalCoins = (lv.coins || []).length;

    scene3d.background = new THREE.Color(lv.sky[0]);

    // Update hint bar
    const hintEl = document.getElementById('hint-bar');
    if (hintEl) hintEl.textContent = lv.hint || '';

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
        scene3d.add(mesh);
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
            scene3d.add(mesh);
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
            scene3d.add(mesh);
        });
    }

    // 3D Barriers (red walls)
    if (lv.barriers) {
        lv.barriers.forEach(b => {
            const geo = new RoundedBoxGeometry(b.w, b.h, 30, 2, 4);
            const mat = new THREE.MeshStandardMaterial({ color: 0xCC2222, roughness: 0.5 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(b.x + b.w / 2 - CW / 2, CH / 2 - (b.y + b.h / 2), 0);
            mesh.isLvObj = true;
            mesh.isBarrier = true;
            mesh.barrierId = b.id;
            scene3d.add(mesh);
        });
    }

    // 3D Pressure Plates
    if (lv.plates) {
        lv.plates.forEach(pl => {
            const geo = new RoundedBoxGeometry(pl.w, pl.h, 40, 2, 3);
            const mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.4 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pl.x + pl.w / 2 - CW / 2, CH / 2 - (pl.y + pl.h / 2), 0);
            mesh.isLvObj = true;
            mesh.isPlate = true;
            mesh.plateId = pl.id;
            scene3d.add(mesh);
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
            scene3d.add(mesh);
        });
    }

    // 3D Exit Portal
    const portalGeo = new THREE.TorusGeometry(EXIT_W / 2, 6, 16, 40);
    const portalMat = new THREE.MeshBasicMaterial({ color: 0xFF4D88, transparent: true, opacity: 0.8 });
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(lv.exit.x + EXIT_W / 2 - CW / 2, CH / 2 - (lv.exit.y + EXIT_H / 2), -10);
    portal.isLvObj = true; portal.isExit = true;
    scene3d.add(portal);

    // Reset bears
    const s0 = lv.spawns[0], s1 = lv.spawns[1];
    if (localBear) scene3d.remove(localBear.group);
    if (remoteBear) scene3d.remove(remoteBear.group);

    localBear = new Bear3D(localPIdx === 0 ? s0.x : s1.x, localPIdx === 0 ? s0.y : s1.y, localPIdx === 0 ? 'dudu' : 'bubu', scene3d);
    remoteBear = new Bear3D(localPIdx === 0 ? s1.x : s0.x, localPIdx === 0 ? s1.y : s0.y, localPIdx === 0 ? 'bubu' : 'dudu', scene3d);

    updateHUD();
}

function loop() {
    requestAnimationFrame(loop);
    if (gameState !== 'playing') return;
    t++;

    if (localBear && currentLevel) {
        localBear.update(getInput(), currentLevel.platforms, barriers3d, currentLevel.spikes || []);
        if (window.NET_state) window.NET_state(localBear.getState());

        // Pressure plate check
        plates3d.forEach(plate => {
            const wasActive = plate.active;
            plate.active = bearOnPlate(localBear, plate) || (remoteBear && bearOnPlate(remoteBear, plate));
            const bar = barriers3d.find(b => b.id === plate.doorId);
            if (bar) bar.open = plate.active;

            // Update 3D plate visual
            scene3d.children.forEach(c => {
                if (c.isPlate && c.plateId === plate.id) {
                    c.material.color.setHex(plate.active ? 0x7FFF00 : 0xFFD700);
                }
            });

            // Update 3D barrier visual
            scene3d.children.forEach(c => {
                if (c.isBarrier && bar && c.barrierId === bar.id) {
                    c.visible = !bar.open;
                }
            });

            if (wasActive !== plate.active && window.NET_plate) {
                window.NET_plate({ id: plate.id, active: plate.active });
            }
        });

        // Key pickup
        scene3d.children.forEach(c => {
            if (c.isKey && !c.collected) {
                const dist = Math.hypot(localBear.x - (c.position.x + CW / 2), localBear.y - (CH / 2 - c.position.y));
                if (dist < 30) {
                    c.collected = true; c.visible = false;
                    keysGot.add(c.keyId);
                    playCollect();
                    updateHUD();
                    if (window.NET_key) window.NET_key(c.keyId);
                }
            }
        });

        // Coin pickup
        scene3d.children.forEach(c => {
            if (c.isCoin && !c.collected) {
                const dist = Math.hypot(localBear.x - (c.position.x + CW / 2), localBear.y - (CH / 2 - c.position.y));
                if (dist < 25) {
                    c.collected = true; c.visible = false;
                    coinsGot.add(c.coinId);
                    playCollect();
                    if (window.NET_coin) window.NET_coin(c.coinId);
                }
            }
        });

        // Exit check
        const allKeys = keysGot.size >= currentLevel.totalKeys;
        if (allKeys) {
            const exit = scene3d.children.find(c => c.isExit);
            if (exit) {
                exit.rotation.z += 0.05;
                exit.material.color.setHex(0xFF4D88);
                exit.material.opacity = 0.9;
            }

            const distLocal = Math.hypot(localBear.x - (currentLevel.exit.x + EXIT_W / 2), localBear.y - (currentLevel.exit.y + EXIT_H / 2));
            const distRemote = remoteBear ? Math.hypot(remoteBear.x - (currentLevel.exit.x + EXIT_W / 2), remoteBear.y - (currentLevel.exit.y + EXIT_H / 2)) : 1000;

            if (distLocal < 50 && distRemote < 50 && lvCompTmr === 0) {
                triggerNextLevel();
            }
        } else {
            // Locked portal — dim
            const exit = scene3d.children.find(c => c.isExit);
            if (exit) {
                exit.material.color.setHex(0x888888);
                exit.material.opacity = 0.3;
            }
        }
    }

    // Level complete overlay timer
    if (lvCompTmr > 0) {
        lvCompTmr--;
    }

    // Animate coins and keys
    scene3d.children.forEach(c => {
        if (c.isCoin || c.isKey) c.rotation.y += 0.03;
    });

    renderer.render(scene3d, camera);
}

function bearOnPlate(bear, plate) {
    return bear.x + PW / 2 > plate.x && bear.x - PW / 2 < plate.x + plate.w &&
        bear.y + PH >= plate.y - 10 && bear.y + PH <= plate.y + plate.h + 20 &&
        bear.onGround;
}

function triggerNextLevel() {
    if (lvCompTmr > 0) return;
    lvCompTmr = 120;
    playLevel();
    if (window.NET_nextLevel) window.NET_nextLevel(lvIdx + 1);
}

// ── Input ──────────────────────────────────────────────────────
const keyState = {};
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    keyState[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', e => { keyState[e.code] = false; });

function getInput() {
    if (localPIdx === 0) {
        return {
            left: !!keyState['KeyA'],
            right: !!keyState['KeyD'],
            up: !!keyState['KeyW'] || !!keyState['Space']
        };
    } else {
        return {
            left: !!keyState['ArrowLeft'],
            right: !!keyState['ArrowRight'],
            up: !!keyState['ArrowUp'] || !!keyState['Enter']
        };
    }
}

// ── Network Integration ────────────────────────────────────────
window.onBothReady = (pIdx, startLevel) => {
    if (gameState !== 'lobby') return;
    localPIdx = pIdx;
    lvIdx = startLevel;

    if (window.showScene) window.showScene('game');

    init3D();
    gameState = 'playing';
};

window.onRemoteKey = (id) => {
    if (!scene3d) return;
    const k = scene3d.children.find(c => c.isKey && c.keyId === id);
    if (k && !k.collected) {
        k.collected = true; k.visible = false;
        keysGot.add(id);
        playCollect();
        updateHUD();
    }
};

window.onRemoteCoin = (id) => {
    if (!scene3d) return;
    const c = scene3d.children.find(ch => ch.isCoin && ch.coinId === id);
    if (c && !c.collected) {
        c.collected = true; c.visible = false;
        coinsGot.add(id);
        playCollect();
    }
};

window.onRemotePlate = (data) => {
    const plate = plates3d.find(p => p.id === data.id);
    if (plate) {
        plate.active = data.active;
        const bar = barriers3d.find(b => b.id === plate.doorId);
        if (bar) bar.open = data.active;

        // Update 3D visuals
        if (scene3d) {
            scene3d.children.forEach(c => {
                if (c.isPlate && c.plateId === data.id) {
                    c.material.color.setHex(data.active ? 0x7FFF00 : 0xFFD700);
                }
                if (c.isBarrier && bar && c.barrierId === bar.id) {
                    c.visible = !bar.open;
                }
            });
        }
    }
};

window.onLoadLevel = (idx) => {
    if (idx >= levels.length) {
        gameState = 'complete';
        if (window.showScene) window.showScene('gamecomplete');
        playVictory();
    } else {
        lvIdx = idx;
        loadLevel3D(idx);
        lvCompTmr = 0;
        gameState = 'playing';
    }
};

window.onRemoteState = (state) => {
    if (remoteBear) remoteBear.applyState(state);
};

window.onPartnerLeft = () => {
    alert('💔 Your partner disconnected. Please refresh and start a new game.');
    location.reload();
};

// Report ready to network layer (in case bothReady arrived before this module loaded)
if (window.NET_reportReady) window.NET_reportReady();
