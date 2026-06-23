import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ══════════════════════════════════════════════════════════════════
//  DUDU & BUBU — Pico Park-Style Cooperative 3D Adventure
//  Complete game engine with particles, animations, 20 levels
// ══════════════════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────────────
const CW = 800, CH = 500;
const PW = 36, PH = 52;
const GY = 430;
const EXIT_W = 60, EXIT_H = 70;
const SPIKE_SZ = 28;
const COIN_SZ = 20;
const TRAMP_W = 60, TRAMP_H = 14;
const BLOCK_SZ = 40;

let scene3d, camera, renderer, container;
let localPIdx = 0;
let localBear, remoteBear;
let currentLevel = null;
let lvIdx = 0;
let gameState = 'lobby';
let t = 0;
let deathCount = 0;
let levelStartTime = 0;

// Level element arrays
let barriers3d = [];
let plates3d = [];
let trampolines3d = [];
let conveyors3d = [];
let fallingPlats3d = [];
let pushBlocks3d = [];
let movingPlats3d = [];
let keysGot = new Set();
let coinsGot = new Set();
let totalCoins = 0;
let lvCompTmr = 0;

// Camera shake
let shakeIntensity = 0;
let shakeDecay = 0.92;

// ══════════════════════════════════════════════════════════════
//  SOUND SYSTEM
// ══════════════════════════════════════════════════════════════
let _ac = null;
function ac() { return _ac || (_ac = new (window.AudioContext || window.webkitAudioContext)()); }

function sfx(freq, dur, type = 'sine', vol = 0.15) {
    try {
        const c = ac(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
        g.gain.setValueAtTime(vol, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.start(c.currentTime); o.stop(c.currentTime + dur);
    } catch (e) { }
}

function playJump() {
    const pitch = 350 + Math.random() * 80;
    sfx(pitch, 0.12, 'sine', 0.1);
    setTimeout(() => sfx(pitch + 150, 0.08, 'sine', 0.08), 60);
}

function playLand() { sfx(120, 0.06, 'triangle', 0.08); }

function playCollect() {
    sfx(523, 0.07); setTimeout(() => sfx(659, 0.07), 70); setTimeout(() => sfx(784, 0.12), 140);
}

function playDeath() {
    sfx(200, 0.3, 'sawtooth', 0.12);
    setTimeout(() => sfx(150, 0.2, 'sawtooth', 0.1), 100);
}

function playBounce() {
    sfx(400, 0.15, 'sine', 0.12);
    setTimeout(() => sfx(600, 0.1, 'sine', 0.1), 80);
    setTimeout(() => sfx(800, 0.08, 'sine', 0.08), 140);
}

function playLevel() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx(f, 0.3, 'sine', 0.12), i * 120));
}

function playVictory() {
    [523, 659, 784, 1047, 1318].forEach((f, i) => setTimeout(() => sfx(f, 0.4, 'sine', 0.12), i * 100));
}

function playSlide() { sfx(280, 0.05, 'sine', 0.04); }

// Background music - simple procedural loop
let musicPlaying = false;
let musicInterval = null;
const MELODY = [523, 587, 659, 698, 784, 698, 659, 587];
let melodyIdx = 0;

function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    musicInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        sfx(MELODY[melodyIdx % MELODY.length], 0.3, 'sine', 0.03);
        sfx(MELODY[melodyIdx % MELODY.length] / 2, 0.4, 'triangle', 0.02);
        melodyIdx++;
    }, 400);
}

function stopMusic() {
    musicPlaying = false;
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
}

// ══════════════════════════════════════════════════════════════
//  3D PARTICLE SYSTEM
// ══════════════════════════════════════════════════════════════
const particles = [];
const particlePool = [];

function getParticleMesh(color, size) {
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    return new THREE.Mesh(geo, mat);
}

function spawnParticles(x, y, color, count, speed = 3, size = 2, life = 1) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
        const sp = speed * (0.5 + Math.random());
        const mesh = getParticleMesh(color, size * (0.5 + Math.random()));
        mesh.position.set(x - CW / 2, CH / 2 - y, Math.random() * 20);
        scene3d.add(mesh);
        particles.push({
            mesh, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp - 1,
            life, maxLife: life, decay: 0.015 + Math.random() * 0.01
        });
    }
}

function spawnHeartParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        const hue = 330 + Math.random() * 30;
        const color = new THREE.Color(`hsl(${hue}, 90%, 65%)`);
        const geo = new THREE.SphereGeometry(3 + Math.random() * 2, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x - CW / 2 + (Math.random() - 0.5) * 40, CH / 2 - y, Math.random() * 10);
        scene3d.add(mesh);
        particles.push({
            mesh, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 3,
            life: 1.5, maxLife: 1.5, decay: 0.012
        });
    }
}

function spawnDust(x, y) {
    spawnParticles(x, y, 0xCCBBAA, 5, 1.5, 1.5, 0.5);
}

function spawnDeathEffect(x, y) {
    spawnParticles(x, y, 0xFF4444, 20, 5, 3, 1.2);
    spawnParticles(x, y, 0xFFAA00, 10, 3, 2, 0.8);
}

function spawnCollectEffect(x, y) {
    spawnParticles(x, y, 0xFFD700, 12, 4, 2.5, 0.8);
    spawnParticles(x, y, 0xFFFFFF, 6, 2, 1.5, 0.6);
}

function spawnBounceEffect(x, y) {
    spawnParticles(x, y, 0x00FF88, 8, 3, 2, 0.6);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.x += p.vx * 0.3;
        p.mesh.position.y += p.vy * 0.3;
        p.vy -= 0.03; // gravity
        p.life -= p.decay;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
        p.mesh.scale.setScalar(p.life / p.maxLife);
        if (p.life <= 0) {
            scene3d.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  3D BEAR CLASS — Enhanced with animations
// ══════════════════════════════════════════════════════════════
class Bear3D {
    constructor(x, y, char, scn) {
        this.x = x; this.y = y; this.z = 0;
        this.vx = 0; this.vy = 0;
        this.lastX = x; this.lastY = y;
        this.targetX = x; this.targetY = y;
        this.onGround = false;
        this.wasOnGround = false;
        this.facing = 1;
        this.char = char;
        this.anim = 'idle';
        this.frame = 0;
        this.spawnX = x; this.spawnY = y;
        this.isDead = false;
        this.deathTimer = 0;
        this.celebTimer = 0;
        this.blinkTimer = 0;
        this.blinkDuration = 0;
        this.jumpedThisFrame = false;
        this.stackedOn = null; // bear this one is standing on

        this.group = new THREE.Group();
        this.group.position.set(x - CW / 2, CH / 2 - (y + PH / 2), 0);
        scn.add(this.group);

        const isPanda = char === 'dudu'; // Dudu is panda
        const bodyCol = isPanda ? 0xFDFDFD : 0xD59F7B; // Bubu is soft warm brown, Dudu is soft milk white
        const bellyCol = isPanda ? 0xFFFFFF : 0xF7E3D4;
        const armCol = isPanda ? 0x2E2E2E : bodyCol; // Dudu has dark panda limbs
        const legCol = isPanda ? 0x2E2E2E : bodyCol;
        const earCol = isPanda ? 0x2E2E2E : bodyCol; // Dudu has dark panda ears
        const innerEarCol = isPanda ? 0xFFD2E0 : bellyCol; // Dudu has cute pink inner ears
        this.bodyCol = bodyCol;

        // Body
        this.bodyMesh = new THREE.Mesh(
            new RoundedBoxGeometry(28, 36, 20, 4, 6),
            new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.5 })
        );
        this.group.add(this.bodyMesh);

        // Belly
        const belly = new THREE.Mesh(
            new THREE.SphereGeometry(12, 16, 16),
            new THREE.MeshStandardMaterial({ color: bellyCol, roughness: 0.7 })
        );
        belly.position.set(0, -3, 9);
        belly.scale.set(1, 1.1, 0.4);
        this.group.add(belly);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 24, 2);
        this.group.add(this.headGroup);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(17, 24, 24),
            new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.5 })
        );
        this.headGroup.add(head);

        // Ears
        [-12, 12].forEach(ex => {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(7, 12, 12),
                new THREE.MeshStandardMaterial({ color: earCol, roughness: 0.5 })
            );
            ear.position.set(ex, 14, -2);
            this.headGroup.add(ear);

            // Inner ear
            const inner = new THREE.Mesh(
                new THREE.SphereGeometry(4, 8, 8),
                new THREE.MeshStandardMaterial({ color: innerEarCol, roughness: 0.6 })
            );
            inner.position.set(ex, 14, 0);
            this.headGroup.add(inner);
        });

        // Eyes
        this.eyes = [];
        [-7, 7].forEach(ex => {
            // Panda black eye patches for Dudu
            if (isPanda) {
                const patch = new THREE.Mesh(
                    new THREE.SphereGeometry(5.5, 12, 12),
                    new THREE.MeshStandardMaterial({ color: 0x2E2E2E, roughness: 0.7 })
                );
                patch.position.set(ex, 4, 14.5);
                patch.scale.set(1.1, 1.3, 0.4);
                this.headGroup.add(patch);
            }

            const eyeWhite = new THREE.Mesh(
                new THREE.SphereGeometry(4, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
            );
            eyeWhite.position.set(ex, 4, 15);
            this.headGroup.add(eyeWhite);

            const pupil = new THREE.Mesh(
                new THREE.SphereGeometry(2.2, 10, 10),
                new THREE.MeshBasicMaterial({ color: 0x111111 })
            );
            pupil.position.set(ex, 4, 17);
            this.headGroup.add(pupil);

            // Eyelid for blinking
            const lid = new THREE.Mesh(
                new THREE.SphereGeometry(4.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
                new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.5 })
            );
            lid.position.set(ex, 4, 15);
            lid.rotation.x = -Math.PI / 2; // closed
            lid.visible = false;
            this.headGroup.add(lid);
            this.eyes.push({ white: eyeWhite, pupil, lid });
        });

        // Nose
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(3.5, 12, 12),
            new THREE.MeshStandardMaterial({ color: isPanda ? 0x2E2E2E : 0x3D1A00 })
        );
        nose.position.set(0, 0, 17);
        nose.scale.set(1, 0.7, 0.5);
        this.headGroup.add(nose);

        // Mouth (smile line)
        const smileCurve = new THREE.EllipseCurve(0, -3, 4, 2, Math.PI * 0.1, Math.PI * 0.9, false);
        const smilePoints = smileCurve.getPoints(20);
        const smileGeo = new THREE.BufferGeometry().setFromPoints(smilePoints.map(p => new THREE.Vector3(p.x, p.y, 17)));
        const smile = new THREE.Line(smileGeo, new THREE.LineBasicMaterial({ color: isPanda ? 0x2E2E2E : 0x3D1A00, linewidth: 2 }));
        this.headGroup.add(smile);

        // Arms
        this.leftArm = this.createArm(armCol, -16);
        this.rightArm = this.createArm(armCol, 16);

        // Legs
        this.leftLeg = this.createLeg(legCol, -8);
        this.rightLeg = this.createLeg(legCol, 8);

        // Name label (sprite)
        this.nameSprite = this.createNameLabel(char === 'dudu' ? 'Dudu' : 'Bubu', char === 'dudu' ? '#FFAEC9' : '#C4956A');

        // Glow aura
        const glowCol = char === 'dudu' ? 0xFFC0CB : 0xFFD700; // soft pink for Dudu, warm gold for Bubu
        const glowGeo = new THREE.SphereGeometry(30, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.08 });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.group.add(this.glow);

        // Blink timer
        this.blinkTimer = 100 + Math.random() * 200;
    }

    createArm(color, xOff) {
        const arm = new THREE.Mesh(
            new RoundedBoxGeometry(8, 20, 8, 2, 3),
            new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
        );
        arm.position.set(xOff, -2, 0);
        this.group.add(arm);
        return arm;
    }

    createLeg(color, xOff) {
        const leg = new THREE.Mesh(
            new RoundedBoxGeometry(10, 14, 10, 2, 3),
            new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
        );
        leg.position.set(xOff, -22, 0);
        this.group.add(leg);
        return leg;
    }

    createNameLabel(name, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 22px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(name, 64, 28);
        ctx.fillText(name, 64, 28);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(50, 16, 1);
        sprite.position.set(0, 50, 0);
        this.group.add(sprite);
        return sprite;
    }

    update(input, platforms, barriers, spikes, otherBear) {
        if (this.isDead) {
            this.deathTimer--;
            this.group.rotation.z += 0.2;
            this.group.scale.multiplyScalar(0.95);
            if (this.deathTimer <= 0) {
                this.respawn();
            }
            return;
        }

        if (this.celebTimer > 0) {
            this.celebTimer--;
            this.group.position.y += Math.sin(this.frame * 0.2) * 0.5;
            if (this.celebTimer % 15 === 0) {
                spawnHeartParticles(this.x, this.y, 3);
            }
            this.frame++;
            return;
        }

        this.lastX = this.x;
        this.lastY = this.y;

        this.jumpedThisFrame = false;
        const gravity = 0.55;
        const jumpForce = -11.5;
        const speed = 4.2;
        const friction = 0.82;

        // Horizontal
        if (input.left) { this.vx = -speed; this.facing = -1; this.anim = 'walk'; }
        else if (input.right) { this.vx = speed; this.facing = 1; this.anim = 'walk'; }
        else { this.vx *= friction; if (Math.abs(this.vx) < 0.2) { this.vx = 0; this.anim = 'idle'; } }

        // Conveyor effect
        for (const cv of conveyors3d) {
            if (this.onGround && this.x + PW / 2 > cv.x && this.x - PW / 2 < cv.x + cv.w &&
                this.y + PH >= cv.y - 5 && this.y + PH <= cv.y + cv.h + 10) {
                this.vx += cv.speed * 0.6;
                if (t % 10 === 0) playSlide();
            }
        }

        // Ice friction
        let onIce = false;
        for (const p of platforms) {
            if (p.isIce && this.onGround && this.x + PW / 2 > p.x && this.x - PW / 2 < p.x + p.w &&
                this.y + PH >= p.y - 5 && this.y + PH <= p.y + 10) {
                onIce = true;
            }
        }
        if (onIce) {
            // Less friction on ice
            if (!input.left && !input.right) this.vx *= 0.97;
        }

        // Moving platform carry
        for (const mp of movingPlats3d) {
            if (this.onGround && this.x + PW / 2 > mp.x && this.x - PW / 2 < mp.x + mp.w &&
                this.y + PH >= mp.y - 5 && this.y + PH <= mp.y + 10) {
                this.x += mp.vx || 0;
                this.y = mp.y - PH;
            }
        }

        // Gravity
        this.vy += gravity;
        if (this.vy > 16) this.vy = 16;

        // Jump
        if (input.up && this.onGround) {
            this.vy = jumpForce;
            this.onGround = false;
            this.anim = 'jump';
            this.jumpedThisFrame = true;
            this.stackedOn = null;
            playJump();
        }

        // Move
        const prevY = this.y;
        this.wasOnGround = this.onGround;
        this.x += this.vx;

        // Stacking carry
        if (this.stackedOn && !this.stackedOn.isDead) {
            const otherDx = this.stackedOn.x - this.stackedOn.lastX;
            this.x += otherDx;
        }

        this.y += this.vy;

        // Bounds
        if (this.x < PW / 2) this.x = PW / 2;
        if (this.x > CW - PW / 2) this.x = CW - PW / 2;

        // Barrier collision
        for (const b of barriers) {
            if (b.open) continue;
            if (this.x + PW / 2 > b.x && this.x - PW / 2 < b.x + b.w &&
                this.y + PH > b.y && this.y < b.y + b.h) {
                const ol = this.x + PW / 2 - b.x;
                const or2 = b.x + b.w - (this.x - PW / 2);
                if (ol < or2) { this.x = b.x - PW / 2; } else { this.x = b.x + b.w + PW / 2; }
                this.vx = 0;
            }
        }

        // Push blocks collision
        for (const pb of pushBlocks3d) {
            if (this.x + PW / 2 > pb.x && this.x - PW / 2 < pb.x + pb.w &&
                this.y + PH > pb.y && this.y < pb.y + pb.h) {
                // Push horizontally
                if (this.y + PH > pb.y + 5 && this.y < pb.y + pb.h - 5) {
                    if (this.vx > 0) { pb.x += 2; this.x = pb.x - PW / 2; }
                    else if (this.vx < 0) { pb.x -= 2; this.x = pb.x + pb.w + PW / 2; }
                    // Clamp block to world
                    pb.x = Math.max(0, Math.min(CW - pb.w, pb.x));
                    if (window.NET_pushBlock) window.NET_pushBlock({ id: pb.id, x: pb.x, y: pb.y });
                }
                // Land on top
                else if (this.vy >= 0 && prevY + PH <= pb.y + 5) {
                    this.y = pb.y - PH;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }

        // Platform collision
        this.onGround = false;
        const allPlats = [...platforms, ...movingPlats3d.map(mp => ({ x: mp.x, y: mp.y, w: mp.w, h: mp.h }))];

        // Add non-fallen falling platforms
        for (const fp of fallingPlats3d) {
            if (fp.state !== 'fallen') {
                allPlats.push({ x: fp.x, y: fp.y, w: fp.w, h: fp.h });
            }
        }

        for (const p of allPlats) {
            if (this.x + PW / 2 > p.x && this.x - PW / 2 < p.x + p.w) {
                if (this.vy >= 0 && prevY + PH <= p.y + 8 && this.y + PH >= p.y) {
                    this.y = p.y - PH;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }

        // Falling platform trigger
        for (const fp of fallingPlats3d) {
            if (fp.state === 'idle' && this.onGround &&
                this.x + PW / 2 > fp.x && this.x - PW / 2 < fp.x + fp.w &&
                this.y + PH >= fp.y - 3 && this.y + PH <= fp.y + fp.h + 5) {
                fp.state = 'shaking';
                fp.timer = 45; // shake for 45 frames then fall
                if (window.NET_fallingPlatform) window.NET_fallingPlatform({ id: fp.id, state: 'shaking' });
            }
        }

        // Bear stacking — stand on other bear's head
        if (otherBear && !otherBear.isDead) {
            const dx = Math.abs(this.x - otherBear.x);
            if (dx < PW * 0.8) {
                if (this.vy >= 0 && prevY + PH <= otherBear.y + 5 && this.y + PH >= otherBear.y) {
                    this.y = otherBear.y - PH;
                    this.vy = 0;
                    this.onGround = true;
                    this.stackedOn = otherBear;
                } else {
                    this.stackedOn = null;
                }
            } else {
                this.stackedOn = null;
            }
        }

        // Trampoline bounce
        for (const tr of trampolines3d) {
            if (this.vy > 0 && this.x + PW / 2 > tr.x && this.x - PW / 2 < tr.x + tr.w &&
                this.y + PH >= tr.y && this.y + PH <= tr.y + tr.h + 15) {
                this.vy = tr.force || -16;
                this.onGround = false;
                tr.bounceAnim = 10;
                playBounce();
                spawnBounceEffect(this.x, tr.y);
            }
        }

        // Floor failsafe
        if (this.y + PH > CH + 80) {
            this.die();
        }

        // Spike collision
        if (spikes) {
            for (const s of spikes) {
                const pad = 8;
                if (this.x + PW / 2 > s.x + pad && this.x - PW / 2 < s.x + SPIKE_SZ - pad &&
                    this.y + PH > s.y + pad && this.y < s.y + SPIKE_SZ) {
                    this.die();
                }
            }
        }

        // Landing effect
        if (this.onGround && !this.wasOnGround && this.vy >= 0) {
            if (!this.jumpedThisFrame) {
                playLand();
                spawnDust(this.x, this.y + PH);
            }
        }

        // Update 3D position & animations
        this.updateVisuals();
    }

    updateVisuals() {
        this.group.position.set(this.x - CW / 2, CH / 2 - (this.y + PH / 2), this.z);

        // Smooth rotation for facing
        const targetRot = this.facing === 1 ? 0 : Math.PI;
        let diff = targetRot - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * 0.18;

        this.frame++;

        // Idle breathing
        if (this.anim === 'idle') {
            const breath = Math.sin(this.frame * 0.04) * 0.03;
            this.bodyMesh.scale.set(1, 1 + breath, 1);
            this.leftArm.rotation.z = 0;
            this.rightArm.rotation.z = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }

        // Walk animation
        if (this.anim === 'walk') {
            const walkCycle = this.frame * 0.3;
            this.group.position.y += Math.sin(walkCycle) * 2;
            this.leftArm.rotation.x = Math.sin(walkCycle) * 0.4;
            this.rightArm.rotation.x = -Math.sin(walkCycle) * 0.4;
            this.leftLeg.rotation.x = -Math.sin(walkCycle) * 0.3;
            this.rightLeg.rotation.x = Math.sin(walkCycle) * 0.3;
            this.bodyMesh.scale.set(1, 1, 1);
        }

        // Jump animation - squash & stretch
        if (this.anim === 'jump') {
            if (this.vy < -5) {
                // Stretching up
                this.bodyMesh.scale.set(0.9, 1.15, 0.9);
            } else if (this.vy > 5) {
                // Falling
                this.bodyMesh.scale.set(1.05, 0.9, 1.05);
            }
            this.leftArm.rotation.z = -0.5;
            this.rightArm.rotation.z = 0.5;
            this.leftLeg.rotation.x = 0.2;
            this.rightLeg.rotation.x = 0.2;
        }

        // Land squash
        if (this.onGround && !this.wasOnGround) {
            this.bodyMesh.scale.set(1.2, 0.8, 1.2);
        }

        // Smooth scale back
        this.bodyMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);

        // Eye blinking
        this.blinkTimer--;
        if (this.blinkTimer <= 0) {
            if (this.blinkDuration <= 0) {
                // Start blink
                this.blinkDuration = 6;
                this.eyes.forEach(e => { e.lid.visible = true; e.white.visible = false; e.pupil.visible = false; });
            }
        }
        if (this.blinkDuration > 0) {
            this.blinkDuration--;
            if (this.blinkDuration <= 0) {
                this.eyes.forEach(e => { e.lid.visible = false; e.white.visible = true; e.pupil.visible = true; });
                this.blinkTimer = 80 + Math.random() * 200;
            }
        }

        // Glow pulse
        if (this.glow) {
            this.glow.material.opacity = 0.06 + Math.sin(this.frame * 0.05) * 0.03;
        }
    }

    die(isLocal = true) {
        if (this.isDead) return;
        this.isDead = true;
        this.deathTimer = 40;
        playDeath();
        shakeIntensity = 8;
        spawnDeathEffect(this.x, this.y + PH / 2);
        if (isLocal) {
            deathCount++;
            updateHUD();
            if (window.NET_death) window.NET_death();
        }
    }

    respawn() {
        this.isDead = false;
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.targetX = this.spawnX;
        this.targetY = this.spawnY;
        this.vx = 0; this.vy = 0;
        this.group.rotation.z = 0;
        this.group.scale.set(1, 1, 1);
        this.group.position.set(this.x - CW / 2, CH / 2 - (this.y + PH / 2), 0);
        spawnParticles(this.x, this.y, 0x00FF88, 15, 3, 2, 0.8);
    }

    celebrate() { this.celebTimer = 120; }

    applyState(s) {
        this.targetX = s.x;
        this.targetY = s.y;
        this.facing = s.facing;
        this.anim = s.anim;
        this.frame = s.frame;
        this.onGround = s.onGround || false;
    }

    updateRemote() {
        if (this.isDead) {
            this.deathTimer--;
            this.group.rotation.z += 0.2;
            this.group.scale.multiplyScalar(0.95);
            return;
        }

        this.lastX = this.x;
        this.lastY = this.y;

        // Lerp towards target position for high-quality network smoothing
        if (this.targetX !== undefined) {
            this.x += (this.targetX - this.x) * 0.35;
            this.y += (this.targetY - this.y) * 0.35;
        }

        this.updateVisuals();
    }

    getState() {
        return { x: this.x, y: this.y, facing: this.facing, anim: this.anim, frame: this.frame, onGround: this.onGround };
    }
}

// ══════════════════════════════════════════════════════════════
//  LEVEL DEFINITIONS — 15 Levels
// ══════════════════════════════════════════════════════════════
function buildLevels() {
    return [
        // Level 1: Tutorial
        {
            name: '🌸 Sweet Meadow',
            hint: 'Grab the key 🔑, then BOTH reach the Heart Portal 💖 together!',
            sky: [0x87CEEB, 0xC5EFC5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 200, y: 370, w: 120, h: 14 },
                { x: 450, y: 330, w: 140, h: 14 },
            ],
            keys: [{ id: 0, x: 510, y: 300 }],
            exit: { x: 680, y: GY - EXIT_H + 10 },
            spawns: [{ x: 60, y: GY - PH }, { x: 120, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 2: Multiple keys
        {
            name: '🍯 Honey Forest',
            hint: 'Split up! Each bear grabs a key, then reunite at the portal! 🍯',
            sky: [0xFFF8DC, 0xC8E6C9],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 80, y: 380, w: 150, h: 14 },
                { x: 350, y: 320, w: 100, h: 14 },
                { x: 550, y: 260, w: 120, h: 14 },
                { x: 650, y: 370, w: 130, h: 14 },
            ],
            keys: [{ id: 0, x: 390, y: 290 }, { id: 1, x: 600, y: 230 }],
            exit: { x: 700, y: 370 - EXIT_H + 10 },
            spawns: [{ x: 100, y: 380 - PH }, { x: 160, y: 380 - PH }],
            totalKeys: 2,
        },
        // Level 3: Pressure plates
        {
            name: '🌺 Blossom Bridge',
            hint: 'One bear holds the button 🟡 while the other sneaks past! 🤝',
            sky: [0xFFD1DC, 0xFFF0F5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 0, y: 390, w: 200, h: 14 },
                { x: 300, y: 340, w: 100, h: 14 },
                { x: 500, y: 340, w: 100, h: 14 },
                { x: 650, y: 390, w: 150, h: 14 },
            ],
            keys: [{ id: 0, x: 540, y: 310 }],
            plates: [{ id: 0, x: 80, y: 390, w: 50, h: 10, doorId: 0 }],
            barriers: [{ id: 0, x: 440, y: 300, w: 18, h: 90 }],
            exit: { x: 700, y: 390 - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 4: Bear stacking
        {
            name: '🤝 Stack Up!',
            hint: 'Stand on your partner\'s head to reach the high key! 🐻🐻',
            sky: [0xE8F5E9, 0xA5D6A7],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 300, y: 280, w: 200, h: 14 },
                { x: 550, y: 350, w: 130, h: 14 },
            ],
            keys: [{ id: 0, x: 390, y: 240 }],
            exit: { x: 620, y: 350 - EXIT_H + 10 },
            spawns: [{ x: 60, y: GY - PH }, { x: 130, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 5: Trampolines
        {
            name: '🟢 Bounce Valley',
            hint: 'Use the green bounce pads to reach new heights! 🦘',
            sky: [0xE0F7FA, 0x80DEEA],
            platforms: [
                { x: 0, y: GY, w: 200, h: 70, isGround: true },
                { x: 350, y: 300, w: 100, h: 14 },
                { x: 600, y: GY, w: 200, h: 70, isGround: true },
                { x: 550, y: 220, w: 120, h: 14 },
            ],
            keys: [{ id: 0, x: 600, y: 190 }],
            trampolines: [
                { x: 220, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -17 },
                { x: 450, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -18 },
            ],
            exit: { x: 700, y: GY - EXIT_H + 10 },
            spawns: [{ x: 50, y: GY - PH }, { x: 120, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 6: Cloud steps (vertical)
        {
            name: '☁️ Cloud Steps',
            hint: 'Climb higher together — keys are in the clouds! ☁️',
            sky: [0xDDEEFF, 0xB3D4F5],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 60, y: 380, w: 130, h: 14 },
                { x: 250, y: 320, w: 110, h: 14 },
                { x: 450, y: 260, w: 120, h: 14 },
                { x: 620, y: 200, w: 140, h: 14 },
                { x: 200, y: 180, w: 100, h: 14 },
            ],
            keys: [{ id: 0, x: 490, y: 230 }, { id: 1, x: 240, y: 150 }],
            exit: { x: 670, y: 200 - EXIT_H + 10 },
            spawns: [{ x: 80, y: GY - PH }, { x: 150, y: GY - PH }],
            totalKeys: 2,
        },
        // Level 7: Ice
        {
            name: '🧊 Ice Cave',
            hint: 'Careful! The blue platforms are slippery ice! 🧊',
            sky: [0xE3F2FD, 0x90CAF9],
            platforms: [
                { x: 0, y: GY, w: 150, h: 70, isGround: true },
                { x: 200, y: 380, w: 180, h: 14, isIce: true },
                { x: 430, y: 340, w: 160, h: 14, isIce: true },
                { x: 650, y: GY, w: 150, h: 70, isGround: true },
            ],
            keys: [{ id: 0, x: 500, y: 310 }],
            spikes: [{ x: 160, y: GY - SPIKE_SZ }, { x: 600, y: GY - SPIKE_SZ }],
            exit: { x: 700, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 8: Push blocks
        {
            name: '📦 Block Push',
            hint: 'Push the crate onto the button to open the gate! 📦',
            sky: [0xFFF3E0, 0xFFCC02],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 500, y: 350, w: 200, h: 14 },
            ],
            keys: [{ id: 0, x: 650, y: 320 }],
            plates: [{ id: 0, x: 300, y: GY, w: 50, h: 10, doorId: 0 }],
            barriers: [{ id: 0, x: 470, y: 310, w: 18, h: 90 }],
            pushBlocks: [{ id: 0, x: 150, y: GY - BLOCK_SZ, w: BLOCK_SZ, h: BLOCK_SZ }],
            exit: { x: 720, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 9: Spikes gauntlet
        {
            name: '💀 Spike Valley',
            hint: 'Watch your step! Time your jumps carefully! 💀',
            sky: [0xFF9E80, 0xFF5722],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 200, y: 380, w: 90, h: 14 },
                { x: 400, y: 340, w: 90, h: 14 },
                { x: 600, y: 380, w: 90, h: 14 },
            ],
            keys: [{ id: 0, x: 440, y: 310 }],
            spikes: [
                { x: 280, y: GY - SPIKE_SZ }, { x: 308, y: GY - SPIKE_SZ }, { x: 336, y: GY - SPIKE_SZ },
                { x: 480, y: GY - SPIKE_SZ }, { x: 508, y: GY - SPIKE_SZ }, { x: 536, y: GY - SPIKE_SZ },
            ],
            coins: [{ id: 0, x: 150, y: GY - 40 }, { id: 1, x: 700, y: GY - 40 }],
            exit: { x: 700, y: 380 - EXIT_H + 10 },
            spawns: [{ x: 50, y: GY - PH }, { x: 110, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 10: Conveyors
        {
            name: '⬅️ Conveyor Chaos',
            hint: 'The belts push you! Fight the current to get the key! ⬅️➡️',
            sky: [0xFCE4EC, 0xF48FB1],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 200, y: 360, w: 200, h: 14 },
                { x: 500, y: 300, w: 180, h: 14 },
            ],
            keys: [{ id: 0, x: 580, y: 270 }],
            conveyors: [
                { x: 200, y: 360, w: 200, h: 14, speed: -3 },
                { x: 500, y: 300, w: 180, h: 14, speed: 2.5 },
            ],
            exit: { x: 720, y: GY - EXIT_H + 10 },
            spawns: [{ x: 50, y: GY - PH }, { x: 110, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 11: Falling platforms
        {
            name: '💥 Crumble Run',
            hint: 'Platforms crumble when you step on them! Move FAST! 💨',
            sky: [0xFFF9C4, 0xFFD54F],
            platforms: [
                { x: 0, y: GY, w: 150, h: 70, isGround: true },
                { x: 650, y: GY, w: 150, h: 70, isGround: true },
            ],
            keys: [{ id: 0, x: 400, y: 310 }],
            fallingPlatforms: [
                { id: 0, x: 180, y: 380, w: 80, h: 14 },
                { id: 1, x: 290, y: 340, w: 80, h: 14 },
                { id: 2, x: 400, y: 360, w: 80, h: 14 },
                { id: 3, x: 510, y: 330, w: 80, h: 14 },
            ],
            exit: { x: 700, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 12: Moving platforms over gap
        {
            name: '⛰️ The Great Divide',
            hint: 'Ride the moving platform across the gap! 🚂',
            sky: [0xB39DDB, 0x7E57C2],
            platforms: [
                { x: 0, y: GY, w: 180, h: 70, isGround: true },
                { x: 620, y: GY, w: 180, h: 70, isGround: true },
            ],
            keys: [{ id: 0, x: 680, y: GY - 40 }],
            spikes: [{ x: 250, y: GY + 20 }, { x: 350, y: GY + 20 }, { x: 450, y: GY + 20 }],
            movingPlatforms: [
                { x: 200, y: 370, w: 90, h: 14, x1: 200, x2: 560, y1: 370, y2: 370, speed: 2 },
            ],
            exit: { x: 720, y: GY - EXIT_H + 10 },
            spawns: [{ x: 50, y: GY - PH }, { x: 110, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 13: Mixed mechanics
        {
            name: '🎪 Mixed Madness',
            hint: 'Everything at once! Work together! 🎪',
            sky: [0xF3E5F5, 0xCE93D8],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 100, y: 350, w: 100, h: 14 },
                { x: 350, y: 280, w: 100, h: 14, isIce: true },
                { x: 600, y: 350, w: 100, h: 14 },
            ],
            keys: [{ id: 0, x: 160, y: 320 }, { id: 1, x: 650, y: 320 }],
            spikes: [{ x: 240, y: GY - SPIKE_SZ }, { x: 490, y: GY - SPIKE_SZ }],
            trampolines: [{ x: 280, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -16 }],
            plates: [{ id: 0, x: 500, y: GY, w: 50, h: 10, doorId: 0 }],
            barriers: [{ id: 0, x: 570, y: 310, w: 18, h: 80 }],
            exit: { x: 720, y: GY - EXIT_H + 10 },
            spawns: [{ x: 30, y: GY - PH }, { x: 80, y: GY - PH }],
            totalKeys: 2,
        },
        // Level 14: Vertical gauntlet
        {
            name: '🌙 Moonlit Ascent',
            hint: 'Climb to the top! Use everything you\'ve learned! 🌙',
            sky: [0x1A237E, 0x3949AB],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 50, y: 380, w: 120, h: 14 },
                { x: 250, y: 330, w: 100, h: 14 },
                { x: 500, y: 290, w: 100, h: 14 },
                { x: 300, y: 230, w: 100, h: 14, isIce: true },
                { x: 100, y: 180, w: 120, h: 14 },
                { x: 550, y: 160, w: 150, h: 14 },
            ],
            keys: [{ id: 0, x: 340, y: 200 }, { id: 1, x: 620, y: 130 }],
            spikes: [{ x: 400, y: GY - SPIKE_SZ }, { x: 428, y: GY - SPIKE_SZ }],
            trampolines: [{ x: 180, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -18 }],
            coins: [{ id: 0, x: 520, y: 260 }, { id: 1, x: 150, y: 150 }],
            exit: { x: 620, y: 160 - EXIT_H + 10 },
            spawns: [{ x: 50, y: GY - PH }, { x: 110, y: GY - PH }],
            totalKeys: 2,
        },
        // Level 15: Summit of Hearts
        {
            name: '💕 Summit of Hearts',
            hint: 'Work together to climb to the summit! 💖',
            sky: [0xFF6B9D, 0xFF8E53],
            platforms: [
                { x: 0, y: GY, w: CW, h: 70, isGround: true },
                { x: 50, y: 370, w: 120, h: 14 },
                { x: 250, y: 320, w: 100, h: 14 },
                { x: 500, y: 280, w: 120, h: 14 },
                { x: 350, y: 220, w: 100, h: 14, isIce: true },
                { x: 600, y: 180, w: 150, h: 14 },
            ],
            keys: [{ id: 0, x: 120, y: 340 }, { id: 1, x: 540, y: 250 }, { id: 2, x: 670, y: 150 }],
            spikes: [
                { x: 200, y: GY - SPIKE_SZ }, { x: 228, y: GY - SPIKE_SZ },
                { x: 420, y: GY - SPIKE_SZ }, { x: 448, y: GY - SPIKE_SZ },
            ],
            plates: [{ id: 0, x: 300, y: GY, w: 50, h: 10, doorId: 0 }],
            barriers: [{ id: 0, x: 470, y: 240, w: 18, h: 80 }],
            trampolines: [{ x: 150, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -17 }],
            movingPlatforms: [{ x: 380, y: 160, w: 80, h: 14, x1: 200, x2: 500, y1: 160, y2: 160, speed: 2 }],
            coins: [{ id: 0, x: 400, y: 130 }, { id: 1, x: 300, y: 200 }],
            exit: { x: 680, y: 180 - EXIT_H + 10 },
            spawns: [{ x: 30, y: GY - PH }, { x: 80, y: GY - PH }],
            totalKeys: 3,
        },
        // Level 16: Love Elevator
        {
            name: '❤️ Love Elevator',
            hint: 'Take turns on the buttons to lift each other up! 🔄',
            sky: [0xFCE4EC, 0xF8BBD0],
            platforms: [
                { x: 0, y: GY, w: 200, h: 70, isGround: true },
                { x: 280, y: 350, w: 100, h: 14 },
                { x: 420, y: 280, w: 100, h: 14 },
                { x: 560, y: 210, w: 100, h: 14 },
                { x: 680, y: 210, w: 120, h: 14 },
            ],
            keys: [{ id: 0, x: 470, y: 240 }, { id: 1, x: 610, y: 170 }],
            plates: [
                { id: 0, x: 100, y: GY, w: 50, h: 10, doorId: 0 },
                { id: 1, x: 310, y: 350, w: 50, h: 10, doorId: 1 }
            ],
            barriers: [
                { id: 0, x: 400, y: 200, w: 18, h: 120 },
                { id: 1, x: 540, y: 130, w: 18, h: 120 }
            ],
            exit: { x: 720, y: 210 - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 2,
        },
        // Level 17: Rainbow Ridge
        {
            name: '🌈 Rainbow Ridge',
            hint: 'Ride the colorful belts and watch out for the spikes! 🌈',
            sky: [0x1E1E2F, 0xE91E63],
            platforms: [
                { x: 0, y: GY, w: 150, h: 70, isGround: true },
                { x: 350, y: 350, w: 100, h: 14 },
                { x: 650, y: GY, w: 150, h: 70, isGround: true },
            ],
            conveyors: [
                { x: 150, y: 380, w: 200, h: 14, speed: 3 },
                { x: 450, y: 320, w: 200, h: 14, speed: -3 }
            ],
            keys: [{ id: 0, x: 400, y: 310 }],
            spikes: [
                { x: 370, y: GY - SPIKE_SZ },
                { x: 400, y: GY - SPIKE_SZ },
                { x: 430, y: GY - SPIKE_SZ }
            ],
            exit: { x: 700, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 90, y: GY - PH }],
            totalKeys: 1,
        },
        // Level 18: Ice & Fire
        {
            name: '💞 Ice & Fire',
            hint: 'Slide on slippery ice peaks to collect love notes! ❄️🔥',
            sky: [0xFF8A80, 0x82B1FF],
            platforms: [
                { x: 0, y: GY, w: 160, h: 70, isGround: true },
                { x: 220, y: 360, w: 100, h: 14, isIce: true },
                { x: 380, y: 300, w: 100, h: 14, isIce: true },
                { x: 540, y: 360, w: 100, h: 14, isIce: true },
                { x: 680, y: GY, w: 120, h: 70, isGround: true },
            ],
            keys: [{ id: 0, x: 270, y: 320 }, { id: 1, x: 430, y: 260 }, { id: 2, x: 590, y: 320 }],
            spikes: [
                { x: 170, y: GY - SPIKE_SZ }, { x: 195, y: GY - SPIKE_SZ },
                { x: 330, y: GY - SPIKE_SZ }, { x: 355, y: GY - SPIKE_SZ },
                { x: 490, y: GY - SPIKE_SZ }, { x: 515, y: GY - SPIKE_SZ }
            ],
            exit: { x: 720, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 100, y: GY - PH }],
            totalKeys: 3,
        },
        // Level 19: Trust Leap
        {
            name: '💖 Trust Leap',
            hint: 'Step on the plate to create the bridge in mid-air! 🌉',
            sky: [0x4A148C, 0x880E4F],
            platforms: [
                { x: 0, y: GY, w: 120, h: 70, isGround: true },
                { x: 220, y: 320, w: 180, h: 14 },
                { x: 500, y: 260, w: 120, h: 14 },
                { x: 660, y: GY, w: 140, h: 70, isGround: true },
            ],
            trampolines: [
                { x: 140, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -18 }
            ],
            keys: [{ id: 0, x: 310, y: 280 }, { id: 1, x: 560, y: 220 }],
            plates: [
                { id: 0, x: 60, y: GY, w: 50, h: 10, doorId: 0 }
            ],
            barriers: [
                { id: 0, x: 450, y: 200, w: 18, h: 180 }
            ],
            exit: { x: 700, y: GY - EXIT_H + 10 },
            spawns: [{ x: 20, y: GY - PH }, { x: 70, y: GY - PH }],
            totalKeys: 2,
        },
        // Level 20: Eternal Love Portal
        {
            name: '💝 Eternal Love Portal',
            hint: 'Grand Finale! Double stack and bounce to reach the portal together! 🐻🐼💖',
            sky: [0xFF80AB, 0xFFD54F],
            platforms: [
                { x: 0, y: GY, w: 120, h: 70, isGround: true },
                { x: 180, y: 340, w: 100, h: 14 },
                { x: 300, y: GY, w: 200, h: 70, isGround: true },
                { x: 520, y: 340, w: 100, h: 14 },
                { x: 680, y: GY, w: 120, h: 70, isGround: true },
            ],
            trampolines: [
                { x: 30, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -16 },
                { x: 710, y: GY - TRAMP_H, w: TRAMP_W, h: TRAMP_H, force: -16 }
            ],
            movingPlatforms: [
                { x: 350, y: 220, w: 100, h: 14, x1: 200, x2: 500, y1: 220, y2: 220, speed: 2.5 }
            ],
            keys: [
                { id: 0, x: 230, y: 300 },
                { id: 1, x: 400, y: 180 },
                { id: 2, x: 570, y: 300 },
                { id: 3, x: 400, y: 110 }
            ],
            spikes: [
                { x: 130, y: GY - SPIKE_SZ }, { x: 155, y: GY - SPIKE_SZ },
                { x: 620, y: GY - SPIKE_SZ }, { x: 645, y: GY - SPIKE_SZ }
            ],
            exit: { x: 370, y: GY - EXIT_H + 10 },
            spawns: [{ x: 40, y: GY - PH }, { x: 80, y: GY - PH }],
            totalKeys: 4,
        },
    ];
}

const levels = buildLevels();

// ══════════════════════════════════════════════════════════════
//  HUD OVERLAY
// ══════════════════════════════════════════════════════════════
let hudOverlay = null;
function createHUD() {
    hudOverlay = document.createElement('div');
    hudOverlay.id = 'game-hud';
    hudOverlay.style.cssText = `
        position:absolute;top:0;left:0;right:0;height:50px;
        background:linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0));
        display:flex;align-items:center;justify-content:center;
        font-family:'Nunito',sans-serif;pointer-events:none;z-index:10;
        padding:0 16px;
    `;
    container.style.position = 'relative';
    container.appendChild(hudOverlay);
    updateHUD();
}

function updateHUD() {
    if (!hudOverlay || !currentLevel) return;
    const allKeys = keysGot.size >= currentLevel.totalKeys;
    const keyColor = allKeys ? '#7FFF00' : '#FFD700';
    const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = String(elapsed % 60).padStart(2, '0');

    hudOverlay.innerHTML = `
        <div style="position:absolute;left:12px;top:6px;display:flex;align-items:center;gap:8px;">
            <div style="font-size:11px;font-weight:800;color:#D2956A;text-shadow:0 1px 3px rgba(0,0,0,0.5);">🐻 DUDU</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.45);">WASD+Space</div>
        </div>
        <div style="text-align:center;display:flex;gap:20px;align-items:center;">
            <div style="font-size:12px;font-weight:700;color:${keyColor};text-shadow:0 0 8px ${keyColor};">🔑 ${keysGot.size}/${currentLevel.totalKeys}</div>
            <div>
                <div style="font-size:14px;font-weight:800;color:#FFE4A0;text-shadow:0 2px 6px rgba(0,0,0,0.5);">${currentLevel.name}</div>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);">⏱${mins}:${secs}</div>
            <div style="font-size:11px;color:#FF6B6B;">💀${deathCount}</div>
        </div>
        <div style="position:absolute;right:12px;top:6px;text-align:right;display:flex;align-items:center;gap:8px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.45);">Arrows+Enter</div>
            <div style="font-size:11px;font-weight:800;color:#F0E0D8;text-shadow:0 1px 3px rgba(0,0,0,0.5);">BUBU 🐻</div>
        </div>
    `;
}

// Update HUD timer every second
setInterval(() => { if (gameState === 'playing') updateHUD(); }, 1000);

// ══════════════════════════════════════════════════════════════
//  LEVEL TRANSITION OVERLAY
// ══════════════════════════════════════════════════════════════
function showLevelTransition(name, hint, callback) {
    const overlay = document.getElementById('level-transition');
    if (!overlay) { callback(); return; }
    const title = overlay.querySelector('.lt-title');
    const subtitle = overlay.querySelector('.lt-hint');
    if (title) title.textContent = name;
    if (subtitle) subtitle.textContent = hint;
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        callback();
    }, 1800);
}

// ══════════════════════════════════════════════════════════════
//  INIT & LEVEL LOADING
// ══════════════════════════════════════════════════════════════
function init3D() {
    container = document.getElementById('three-container');
    scene3d = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, CW / CH, 1, 2000);
    camera.position.set(0, 40, 680);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(CW, CH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Lighting
    scene3d.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dLight.position.set(200, 400, 500);
    dLight.castShadow = true;
    dLight.shadow.mapSize.set(1024, 1024);
    scene3d.add(dLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x8888FF, 0.3);
    rimLight.position.set(-200, 100, -300);
    scene3d.add(rimLight);

    createHUD();
    loadLevel3D(lvIdx);
    startMusic();
    loop();
}

function loadLevel3D(idx) {
    if (idx >= levels.length) {
        gameState = 'complete';
        stopMusic();
        return;
    }

    // Cleanup
    const toRemove = scene3d.children.filter(c => c.isLvObj);
    toRemove.forEach(c => {
        scene3d.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
    });
    // Cleanup particles
    particles.forEach(p => {
        scene3d.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
    });
    particles.length = 0;

    const lv = levels[idx];
    currentLevel = lv;
    keysGot.clear();
    coinsGot.clear();
    lvCompTmr = 0;
    levelStartTime = Date.now();

    barriers3d = (lv.barriers || []).map(b => ({ ...b, open: false }));
    plates3d = (lv.plates || []).map(p => ({ ...p, active: false }));
    trampolines3d = (lv.trampolines || []).map(tr => ({ ...tr, bounceAnim: 0 }));
    conveyors3d = (lv.conveyors || []).map(cv => ({ ...cv }));
    fallingPlats3d = (lv.fallingPlatforms || []).map(fp => ({ ...fp, state: 'idle', timer: 0, respawnTimer: 0 }));
    pushBlocks3d = (lv.pushBlocks || []).map(pb => ({ ...pb }));
    movingPlats3d = (lv.movingPlatforms || []).map(mp => ({ ...mp, vx: 0, vy: 0 }));
    totalCoins = (lv.coins || []).length;

    // Sky
    const skyCol1 = new THREE.Color(lv.sky[0]);
    const skyCol2 = new THREE.Color(lv.sky[1]);
    scene3d.background = skyCol1;

    // Hint bar
    const hintEl = document.getElementById('hint-bar');
    if (hintEl) hintEl.textContent = lv.hint || '';

    // ── Build 3D Level Objects ──

    // Platforms
    lv.platforms.forEach(p => {
        const geo = new RoundedBoxGeometry(p.w, Math.max(p.h, 12), 50, 4, 8);
        let mat;
        if (p.isIce) {
            mat = new THREE.MeshPhysicalMaterial({
                color: 0x88DDFF, transmission: 0.4, opacity: 0.7,
                transparent: true, roughness: 0.05, metalness: 0.1, thickness: 8,
            });
        } else if (p.isGround) {
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xFFFFFF, transmission: 0.6, opacity: 0.4,
                transparent: true, roughness: 0, thickness: 15, reflectivity: 0.4,
            });
        } else {
            mat = new THREE.MeshPhysicalMaterial({
                color: 0xFFFFFF, transmission: 0.8, opacity: 0.5,
                transparent: true, roughness: 0, thickness: 10, reflectivity: 0.5,
            });
        }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x + p.w / 2 - CW / 2, CH / 2 - (p.y + p.h / 2), -25);
        mesh.receiveShadow = true;
        mesh.isLvObj = true;
        scene3d.add(mesh);
    });

    // Spikes
    (lv.spikes || []).forEach(s => {
        const geo = new THREE.ConeGeometry(SPIKE_SZ / 2, SPIKE_SZ, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x546E7A, metalness: 0.9, roughness: 0.15 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(s.x + SPIKE_SZ / 2 - CW / 2, CH / 2 - (s.y + SPIKE_SZ / 2), 0);
        mesh.isLvObj = true; mesh.castShadow = true;
        scene3d.add(mesh);
    });

    // Coins
    (lv.coins || []).forEach(c => {
        const geo = new THREE.CylinderGeometry(COIN_SZ / 2, COIN_SZ / 2, 3, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1, emissive: 0x332200 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(c.x + COIN_SZ / 2 - CW / 2, CH / 2 - (c.y + COIN_SZ / 2), 0);
        mesh.rotation.x = Math.PI / 2;
        mesh.isLvObj = true; mesh.isCoin = true; mesh.coinId = c.id;
        scene3d.add(mesh);
    });

    // Barriers
    (lv.barriers || []).forEach(b => {
        const geo = new RoundedBoxGeometry(b.w + 4, b.h, 30, 2, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xDD2222, roughness: 0.4, emissive: 0x330000 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(b.x + b.w / 2 - CW / 2, CH / 2 - (b.y + b.h / 2), 0);
        mesh.isLvObj = true; mesh.isBarrier = true; mesh.barrierId = b.id;
        scene3d.add(mesh);
    });

    // Pressure Plates
    (lv.plates || []).forEach(pl => {
        const geo = new RoundedBoxGeometry(pl.w, pl.h + 4, 40, 2, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3, emissive: 0x221100 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pl.x + pl.w / 2 - CW / 2, CH / 2 - (pl.y + pl.h / 2), 0);
        mesh.isLvObj = true; mesh.isPlate = true; mesh.plateId = pl.id;
        scene3d.add(mesh);
    });

    // Trampolines
    trampolines3d.forEach(tr => {
        const geo = new RoundedBoxGeometry(tr.w, tr.h + 4, 40, 2, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00E676, roughness: 0.3, emissive: 0x003300 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(tr.x + tr.w / 2 - CW / 2, CH / 2 - (tr.y + tr.h / 2), 0);
        mesh.isLvObj = true; mesh.isTrampoline = true;
        tr.mesh = mesh;
        scene3d.add(mesh);
    });

    // Conveyors
    conveyors3d.forEach(cv => {
        const geo = new RoundedBoxGeometry(cv.w, cv.h + 2, 42, 2, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0xFF9800, roughness: 0.4, emissive: 0x331100 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cv.x + cv.w / 2 - CW / 2, CH / 2 - (cv.y + cv.h / 2), 0);
        mesh.isLvObj = true;
        // Arrow indicators
        const arrowCount = Math.floor(cv.w / 30);
        for (let i = 0; i < arrowCount; i++) {
            const arrowGeo = new THREE.ConeGeometry(4, 8, 4);
            const arrowMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 });
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);
            arrow.rotation.z = cv.speed > 0 ? -Math.PI / 2 : Math.PI / 2;
            arrow.position.set(-cv.w / 2 + 15 + i * 30, 0, 22);
            mesh.add(arrow);
            arrow.isLvObj = true;
        }
        scene3d.add(mesh);
    });

    // Falling platforms
    fallingPlats3d.forEach(fp => {
        const geo = new RoundedBoxGeometry(fp.w, fp.h, 40, 2, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xFFAB00, roughness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(fp.x + fp.w / 2 - CW / 2, CH / 2 - (fp.y + fp.h / 2), -25);
        mesh.isLvObj = true;
        fp.mesh = mesh;
        fp.origY = fp.y;
        scene3d.add(mesh);
    });

    // Push blocks
    pushBlocks3d.forEach(pb => {
        const geo = new RoundedBoxGeometry(pb.w, pb.h, 36, 2, 5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pb.x + pb.w / 2 - CW / 2, CH / 2 - (pb.y + pb.h / 2), 0);
        mesh.isLvObj = true; mesh.isPushBlock = true; mesh.blockId = pb.id;
        pb.mesh = mesh;
        scene3d.add(mesh);
    });

    // Moving platforms
    movingPlats3d.forEach(mp => {
        const geo = new RoundedBoxGeometry(mp.w, mp.h, 50, 2, 4);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xBBDDFF, transmission: 0.5, opacity: 0.6,
            transparent: true, roughness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(mp.x + mp.w / 2 - CW / 2, CH / 2 - (mp.y + mp.h / 2), -25);
        mesh.isLvObj = true;
        mp.mesh = mesh;
        scene3d.add(mesh);
    });

    // Keys
    (lv.keys || []).forEach(k => {
        const group = new THREE.Group();
        // Ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(10, 2.5, 8, 20),
            new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0x332200, metalness: 0.8, roughness: 0.2 })
        );
        group.add(ring);
        // Shaft
        const shaft = new THREE.Mesh(
            new RoundedBoxGeometry(4, 16, 3, 2, 2),
            new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 })
        );
        shaft.position.set(0, -16, 0);
        group.add(shaft);
        // Glow
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(18, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.08 })
        );
        group.add(glow);

        group.position.set(k.x - CW / 2, CH / 2 - k.y, 10);
        group.isLvObj = true; group.isKey = true; group.keyId = k.id;
        scene3d.add(group);
    });

    // Exit Portal
    const portalGroup = new THREE.Group();
    
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 10);
    heartShape.bezierCurveTo(-8, 22, -24, 16, -24, 0);
    heartShape.bezierCurveTo(-24, -14, -10, -26, 0, -38);
    heartShape.bezierCurveTo(10, -26, 24, -14, 24, 0);
    heartShape.bezierCurveTo(24, 16, 8, 22, 0, 10);

    const extrudeSettings = { depth: 8, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 2, bevelThickness: 2 };
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    heartGeo.center();

    const heartMat = new THREE.MeshPhysicalMaterial({
        color: 0xFF4D88, roughness: 0.1, metalness: 0.1,
        transmission: 0.5, opacity: 0.85, transparent: true,
        emissive: 0x440011
    });
    const portalMesh = new THREE.Mesh(heartGeo, heartMat);
    portalMesh.scale.setScalar(0.9);
    portalGroup.add(portalMesh);

    const innerHeartGeo = new THREE.ShapeGeometry(heartShape);
    innerHeartGeo.center();
    const innerHeartMat = new THREE.MeshBasicMaterial({
        color: 0xFF88BB, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide
    });
    const innerPortalMesh = new THREE.Mesh(innerHeartGeo, innerHeartMat);
    innerPortalMesh.position.z = 5;
    innerPortalMesh.scale.setScalar(0.75);
    portalGroup.add(innerPortalMesh);

    portalGroup.position.set(lv.exit.x + EXIT_W / 2 - CW / 2, CH / 2 - (lv.exit.y + EXIT_H / 2), -5);
    portalGroup.isLvObj = true; portalGroup.isExit = true;
    scene3d.add(portalGroup);

    // Floating cloud decorations
    for (let i = 0; i < 5; i++) {
        const cloudGroup = new THREE.Group();
        for (let j = 0; j < 3; j++) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(15 + Math.random() * 10, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.12 })
            );
            sphere.position.set(j * 18 - 18, Math.random() * 5, 0);
            cloudGroup.add(sphere);
        }
        cloudGroup.position.set(
            (Math.random() - 0.5) * CW,
            CH / 2 - 30 - Math.random() * 80,
            -80 - Math.random() * 100
        );
        cloudGroup.isLvObj = true;
        cloudGroup.isCloud = true;
        cloudGroup.userData.speed = 0.1 + Math.random() * 0.15;
        scene3d.add(cloudGroup);
    }

    // Reset bears
    const s0 = lv.spawns[0], s1 = lv.spawns[1];
    if (localBear) scene3d.remove(localBear.group);
    if (remoteBear) scene3d.remove(remoteBear.group);

    localBear = new Bear3D(
        localPIdx === 0 ? s0.x : s1.x, localPIdx === 0 ? s0.y : s1.y,
        localPIdx === 0 ? 'bubu' : 'dudu', scene3d
    );
    remoteBear = new Bear3D(
        localPIdx === 0 ? s1.x : s0.x, localPIdx === 0 ? s1.y : s0.y,
        localPIdx === 0 ? 'dudu' : 'bubu', scene3d
    );

    updateHUD();
}

// ══════════════════════════════════════════════════════════════
//  MAIN GAME LOOP
// ══════════════════════════════════════════════════════════════
function loop() {
    requestAnimationFrame(loop);
    if (gameState !== 'playing') return;
    t++;

    if (!localBear || !currentLevel) return;

    // Update moving platforms
    for (const mp of movingPlats3d) {
        const dist = Math.hypot(mp.x2 - mp.x1, mp.y2 - mp.y1);
        if (dist > 0) {
            const cycle = dist * 2 / mp.speed;
            const progress = (t % cycle) / cycle;
            const f = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
            const oldX = mp.x;
            mp.x = mp.x1 + (mp.x2 - mp.x1) * f;
            mp.y = mp.y1 + (mp.y2 - mp.y1) * f;
            mp.vx = mp.x - oldX;
            if (mp.mesh) {
                mp.mesh.position.set(mp.x + mp.w / 2 - CW / 2, CH / 2 - (mp.y + mp.h / 2), -25);
            }
        }
    }

    // Update falling platforms
    for (const fp of fallingPlats3d) {
        if (fp.state === 'shaking') {
            fp.timer--;
            if (fp.mesh) {
                fp.mesh.position.x += (Math.random() - 0.5) * 3;
                fp.mesh.material.color.setHex(fp.timer % 4 < 2 ? 0xFF5500 : 0xFFAB00);
            }
            if (fp.timer <= 0) {
                fp.state = 'fallen';
                fp.respawnTimer = 180; // respawn after 3 seconds
                if (fp.mesh) fp.mesh.visible = false;
                spawnParticles(fp.x + fp.w / 2, fp.y, 0xFFAB00, 10, 3, 2, 0.6);
            }
        }
        if (fp.state === 'fallen') {
            fp.respawnTimer--;
            if (fp.respawnTimer <= 0) {
                fp.state = 'idle';
                fp.y = fp.origY;
                if (fp.mesh) {
                    fp.mesh.visible = true;
                    fp.mesh.position.set(fp.x + fp.w / 2 - CW / 2, CH / 2 - (fp.y + fp.h / 2), -25);
                    fp.mesh.material.color.setHex(0xFFAB00);
                }
            }
        }
    }

    // Update trampoline animations
    for (const tr of trampolines3d) {
        if (tr.bounceAnim > 0) {
            tr.bounceAnim--;
            if (tr.mesh) {
                const squish = 1 + Math.sin(tr.bounceAnim * 0.5) * 0.3;
                tr.mesh.scale.set(1, squish, 1);
            }
        } else if (tr.mesh) {
            tr.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }
    }

    // Update push block visuals
    for (const pb of pushBlocks3d) {
        if (pb.mesh) {
            pb.mesh.position.set(pb.x + pb.w / 2 - CW / 2, CH / 2 - (pb.y + pb.h / 2), 0);
        }
    }

    // Update bears
    localBear.update(getInput(), currentLevel.platforms, barriers3d, currentLevel.spikes || [], remoteBear);
    if (remoteBear) {
        remoteBear.updateRemote();
        
        // Spawn romantic heart particles when close
        if (!localBear.isDead && !remoteBear.isDead) {
            const dist = Math.hypot(localBear.x - remoteBear.x, localBear.y - remoteBear.y);
            if (dist < 60 && t % 35 === 0) {
                const hx = (localBear.x + remoteBear.x) / 2;
                const hy = (localBear.y + remoteBear.y) / 2;
                spawnHeartParticles(hx, hy, 1);
            }
        }
    }
    if (window.NET_state) window.NET_state(localBear.getState());

    // Pressure plates
    plates3d.forEach(plate => {
        const wasActive = plate.active;
        plate.active = bearOnPlate(localBear, plate) || (remoteBear && bearOnPlate(remoteBear, plate));
        const bar = barriers3d.find(b => b.id === plate.doorId);
        if (bar) bar.open = plate.active;

        scene3d.children.forEach(c => {
            if (c.isPlate && c.plateId === plate.id) {
                c.material.color.setHex(plate.active ? 0x76FF03 : 0xFFD700);
                c.material.emissive.setHex(plate.active ? 0x003300 : 0x221100);
            }
            if (c.isBarrier && bar && c.barrierId === bar.id) {
                c.visible = !bar.open;
            }
        });

        if (wasActive !== plate.active && window.NET_plate)
            window.NET_plate({ id: plate.id, active: plate.active });
    });

    // Key pickup
    scene3d.children.forEach(c => {
        if (c.isKey && !c.collected) {
            const kx = c.position.x + CW / 2;
            const ky = CH / 2 - c.position.y;
            const dist = Math.hypot(localBear.x - kx, localBear.y - ky);
            if (dist < 35) {
                c.collected = true; c.visible = false;
                keysGot.add(c.keyId);
                playCollect();
                spawnCollectEffect(kx, ky);
                updateHUD();
                if (window.NET_key) window.NET_key(c.keyId);
            }
        }
    });

    // Coin pickup
    scene3d.children.forEach(c => {
        if (c.isCoin && !c.collected) {
            const cx = c.position.x + CW / 2;
            const cy = CH / 2 - c.position.y;
            const dist = Math.hypot(localBear.x - cx, localBear.y - cy);
            if (dist < 28) {
                c.collected = true; c.visible = false;
                coinsGot.add(c.coinId);
                playCollect();
                spawnCollectEffect(cx, cy);
                if (window.NET_coin) window.NET_coin(c.coinId);
            }
        }
    });

    // Portal animation
    const allKeys = keysGot.size >= currentLevel.totalKeys;
    scene3d.children.forEach(c => {
        if (c.isExit) {
            if (allKeys) {
                c.rotation.y += 0.035;
                const pulse = 1.0 + Math.sin(t * 0.08) * 0.08;
                c.scale.set(pulse, pulse, pulse);
            } else {
                c.rotation.y = Math.sin(t * 0.02) * 0.15;
                c.scale.set(0.85, 0.85, 0.85);
            }
        }
    });

    // Exit check
    if (allKeys && lvCompTmr === 0 && !localBear.isDead) {
        const distLocal = Math.hypot(localBear.x - (currentLevel.exit.x + EXIT_W / 2), localBear.y - (currentLevel.exit.y + EXIT_H / 2));
        const distRemote = remoteBear ? Math.hypot(remoteBear.x - (currentLevel.exit.x + EXIT_W / 2), remoteBear.y - (currentLevel.exit.y + EXIT_H / 2)) : 1000;
        if (distLocal < 55 && distRemote < 55) {
            triggerNextLevel();
        }
    }

    if (lvCompTmr > 0) lvCompTmr--;

    // Animate objects
    scene3d.children.forEach(c => {
        if (c.isCoin && !c.collected) c.rotation.z += 0.04;
        if (c.isKey && !c.collected) {
            c.rotation.y += 0.025;
            c.position.y += Math.sin(t * 0.04) * 0.15;
        }
        if (c.isCloud) {
            c.position.x += c.userData.speed;
            if (c.position.x > CW / 2 + 100) c.position.x = -CW / 2 - 100;
        }
    });

    updateParticles();

    // Camera shake
    if (shakeIntensity > 0.1) {
        camera.position.x = (Math.random() - 0.5) * shakeIntensity;
        camera.position.y = 40 + (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= shakeDecay;
    } else {
        camera.position.x = 0;
        camera.position.y = 40;
        shakeIntensity = 0;
    }

    renderer.render(scene3d, camera);
}

function bearOnPlate(bear, plate) {
    if (bear.isDead) return false;
    return bear.x + PW / 2 > plate.x && bear.x - PW / 2 < plate.x + plate.w &&
        bear.y + PH >= plate.y - 8 && bear.y + PH <= plate.y + plate.h + 15 &&
        bear.onGround;
}

function triggerNextLevel() {
    if (lvCompTmr > 0) return;
    lvCompTmr = 150;
    localBear.celebrate();
    if (remoteBear) remoteBear.celebrate();
    spawnHeartParticles(CW / 2, CH / 2, 25);
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
        return { left: !!keyState['KeyA'], right: !!keyState['KeyD'], up: !!keyState['KeyW'] || !!keyState['Space'] };
    } else {
        return { left: !!keyState['ArrowLeft'], right: !!keyState['ArrowRight'], up: !!keyState['ArrowUp'] || !!keyState['Enter'] };
    }
}

// ══════════════════════════════════════════════════════════════
//  NETWORK CALLBACKS
// ══════════════════════════════════════════════════════════════
window.onBothReady = (pIdx, startLevel) => {
    if (gameState !== 'lobby') return;
    localPIdx = pIdx;
    lvIdx = startLevel;
    deathCount = 0;

    const lv = levels[lvIdx];
    showLevelTransition(lv.name, lv.hint, () => {
        if (window.showScene) window.showScene('game');
        init3D();
        gameState = 'playing';
    });
};

window.onRemoteState = (state) => {
    if (remoteBear) remoteBear.applyState(state);
};

window.onRemoteKey = (id) => {
    if (!scene3d) return;
    const k = scene3d.children.find(c => c.isKey && c.keyId === id);
    if (k && !k.collected) {
        k.collected = true; k.visible = false;
        keysGot.add(id);
        const kx = k.position.x + CW / 2;
        const ky = CH / 2 - k.position.y;
        spawnCollectEffect(kx, ky);
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
        if (scene3d) {
            scene3d.children.forEach(c => {
                if (c.isPlate && c.plateId === data.id)
                    c.material.color.setHex(data.active ? 0x76FF03 : 0xFFD700);
                if (c.isBarrier && bar && c.barrierId === bar.id)
                    c.visible = !bar.open;
            });
        }
    }
};

window.onRemotePushBlock = (data) => {
    const pb = pushBlocks3d.find(b => b.id === data.id);
    if (pb) { pb.x = data.x; pb.y = data.y; }
};

window.onRemoteFallingPlatform = (data) => {
    const fp = fallingPlats3d.find(f => f.id === data.id);
    if (fp && fp.state === 'idle') {
        fp.state = data.state;
        fp.timer = 45;
    }
};

window.onRemoteDeath = (data) => {
    deathCount = data.totalDeaths;
    updateHUD();
    if (remoteBear) remoteBear.die(false);
};

window.onLoadLevel = (idx) => {
    if (idx >= levels.length) {
        gameState = 'complete';
        stopMusic();
        if (window.showScene) window.showScene('gamecomplete');
        playVictory();
    } else {
        const lv = levels[idx];
        showLevelTransition(lv.name, lv.hint, () => {
            lvIdx = idx;
            loadLevel3D(idx);
            lvCompTmr = 0;
            gameState = 'playing';
        });
    }
};

window.onPartnerLeft = () => {
    stopMusic();
    alert('💔 Your partner disconnected. Please refresh and start a new game.');
    location.reload();
};

if (window.NET_reportReady) window.NET_reportReady();
