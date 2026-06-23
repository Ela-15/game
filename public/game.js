'use strict';
// ═══════════════════════════════════════════════════════════════
//  DUDU & BUBU ADVENTURE — Game Engine
//  Pico Park style cooperative puzzle platformer
//  Dudu = Brown Bear (P1: WASD+Space)
//  Bubu = White Bear  (P2: Arrows+Enter)
// ═══════════════════════════════════════════════════════════════

// ── Polyfill roundRect ──────────────────────────────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y); this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r); this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r); this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}

// ── Constants ──────────────────────────────────────────────────
const CW = 800, CH = 550;
const GY = 500;            // ground surface y
const PW = 36, PH = 44;   // player size
const GRAV = 0.55;
const JUMP_VEL = -13.5;
const WALK_SPD = 4.4;
const EXIT_W = 68, EXIT_H = 76;
const SPIKE_SZ = 32;
const COIN_SZ = 22;

// ── Level Definitions ──────────────────────────────────────────
function buildLevels() {
  return [
    {
      name: '🌸 Sweet Meadow',
      hint: 'Grab the golden key, then BOTH reach the Heart Portal together! 💕',
      sky: ['#87CEEB', '#C5EFC5'],
      platforms: [
        { x: 0, y: GY, w: CW, h: 50, isGround: true },
        { x: 170, y: 415, w: 130, h: 16 },
        { x: 370, y: 330, w: 150, h: 16 },
        { x: 590, y: 415, w: 130, h: 16 },
      ],
      keys: [{ id: 0, x: 442, y: 300 }],
      plates: [],
      barriers: [],
      exit: { x: 672, y: 422 },
      spawns: [{ x: 55, y: 454 }, { x: 105, y: 454 }],
      totalKeys: 1,
    },
    {
      name: '🍯 Honey Forest',
      hint: 'Split up! Each grab a key, then reunite at the Heart Portal! 🍯',
      sky: ['#FFF8DC', '#C8E6C9'],
      platforms: [
        { x: 0, y: GY, w: CW, h: 50, isGround: true },
        { x: 60, y: 418, w: 170, h: 16 },
        { x: 310, y: 348, w: 110, h: 16 },
        { x: 500, y: 275, w: 110, h: 16 },
        { x: 635, y: 398, w: 140, h: 16 },
      ],
      keys: [{ id: 0, x: 352, y: 320 }, { id: 1, x: 538, y: 248 }],
      plates: [],
      barriers: [],
      exit: { x: 710, y: 362 },
      spawns: [{ x: 80, y: 382 }, { x: 130, y: 382 }],
      totalKeys: 2,
    },
    {
      name: '🌺 Blossom Bridge',
      hint: 'One bear holds the 🟡 button while the other sneaks past the red wall!',
      sky: ['#FFD1DC', '#FFF0F5'],
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
      name: '☁️ Cloud Steps',
      hint: 'Climb higher together — keys are up in the clouds! ☁️',
      sky: ['#DDEEFF', '#B3D4F5'],
      platforms: [
        { x: 0, y: GY, w: CW, h: 50, isGround: true },
        { x: 55, y: 438, w: 150, h: 16 },
        { x: 260, y: 366, w: 125, h: 16 },
        { x: 430, y: 292, w: 130, h: 16 },
        { x: 605, y: 218, w: 160, h: 16 },
        { x: 155, y: 218, w: 100, h: 16 },
      ],
      keys: [{ id: 0, x: 468, y: 265 }, { id: 1, x: 178, y: 191 }],
      plates: [],
      barriers: [],
      exit: { x: 672, y: 186 },
      spawns: [{ x: 75, y: 402 }, { x: 125, y: 402 }],
      totalKeys: 2,
    },
    {
      name: '💕 Summit of Hearts',
      hint: 'Final level! Use the button, collect 3 keys, reach the portal as ONE! 💖',
      sky: ['#FF6B9D', '#FF8E53'],
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
    },
    {
      name: '💀 Spike Valley',
      hint: 'Watch your step! Spikes are sharp! 🌵',
      sky: ['#FF9E80', '#FF3D00'],
      platforms: [{ x: 0, y: GY, w: CW, h: 50, isGround: true }, { x: 200, y: 420, w: 100, h: 16 }, { x: 400, y: 340, w: 100, h: 16 }, { x: 600, y: 420, w: 100, h: 16 }],
      keys: [{ id: 0, x: 432, y: 310 }],
      plates: [], barriers: [],
      spikes: [
        { x: 300, y: GY - SPIKE_SZ }, { x: 332, y: GY - SPIKE_SZ }, { x: 364, y: GY - SPIKE_SZ },
        { x: 500, y: GY - SPIKE_SZ }, { x: 532, y: GY - SPIKE_SZ }, { x: 564, y: GY - SPIKE_SZ },
      ],
      movingPlatforms: [],
      coins: [{ id: 0, x: 100, y: 460 }, { id: 1, x: 700, y: 460 }],
      exit: { x: 700, y: 422 }, spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }], totalKeys: 1,
    },
    {
      name: '🚂 Moving Clouds',
      hint: 'The platforms are moving! Jump carefully! ☁️',
      sky: ['#CCEEFF', '#81D4FA'],
      platforms: [{ x: 0, y: GY, w: CW, h: 50, isGround: true }, { x: 0, y: 400, w: 120, h: 16 }],
      keys: [{ id: 0, x: 740, y: 180 }],
      plates: [], barriers: [], spikes: [],
      movingPlatforms: [
        { x: 150, y: 320, w: 100, h: 16, x1: 150, x2: 450, y1: 320, y2: 320, speed: 2 },
        { x: 500, y: 220, w: 100, h: 16, x1: 500, x2: 700, y1: 220, y2: 240, speed: 1.5 },
      ],
      coins: [{ id: 0, x: 300, y: 280 }, { id: 1, x: 600, y: 180 }],
      exit: { x: 700, y: 422 }, spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }], totalKeys: 1,
    },
    {
      name: '⛰️ The Great Divide',
      hint: 'A huge gap! Use the moving platform to cross. 🕳️',
      sky: ['#B39DDB', '#673AB7'],
      platforms: [{ x: 0, y: GY, w: 200, h: 50, isGround: true }, { x: 600, y: GY, w: 200, h: 50, isGround: true }],
      keys: [{ id: 0, x: 650, y: GY - 30 }],
      plates: [], barriers: [], spikes: [{ x: 250, y: GY + 10 }, { x: 350, y: GY + 10 }, { x: 450, y: GY + 10 }],
      movingPlatforms: [{ x: 220, y: 400, w: 80, h: 16, x1: 220, x2: 550, y1: 400, y2: 400, speed: 2.5 }],
      coins: [{ id: 0, x: 380, y: 350 }],
      exit: { x: 720, y: 422 }, spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }], totalKeys: 1,
    },
    {
      name: '🏵️ Coordination Peak',
      hint: 'One bear on the plate, the other grabs the key! 🤝',
      sky: ['#FFF59D', '#FBC02D'],
      platforms: [{ x: 0, y: GY, w: CW, h: 50, isGround: true }, { x: 500, y: 350, w: 200, h: 16 }],
      keys: [{ id: 0, x: 700, y: 310 }],
      plates: [{ id: 0, x: 100, y: GY, w: 60, h: 12, doorId: 0 }],
      barriers: [{ id: 0, x: 480, y: 300, w: 20, h: 60 }],
      spikes: [{ x: 300, y: GY - SPIKE_SZ }],
      movingPlatforms: [{ x: 200, y: 350, w: 80, h: 16, x1: 200, x2: 400, y1: 350, y2: 250, speed: 2 }],
      coins: [{ id: 0, x: 150, y: 300 }],
      exit: { x: 720, y: 422 }, spawns: [{ x: 40, y: 454 }, { x: 80, y: 454 }], totalKeys: 1,
    },
    {
      name: '🏁 Final Adventure!',
      hint: 'The ultimate test! SPIKES, CLOUDS, and LOVE! 💖',
      sky: ['#FF80AB', '#C2185B'],
      platforms: [{ x: 0, y: GY, w: CW, h: 50, isGround: true }, { x: 100, y: 380, w: 100, h: 16 }, { x: 600, y: 380, w: 100, h: 16 }],
      keys: [{ id: 0, x: 150, y: 340 }, { id: 1, x: 650, y: 340 }, { id: 2, x: 400, y: 150 }],
      plates: [{ id: 0, x: 375, y: GY, w: 50, h: 12, doorId: 0 }],
      barriers: [{ id: 0, x: 390, y: 250, w: 20, h: 100 }],
      spikes: [{ x: 250, y: GY - SPIKE_SZ }, { x: 500, y: GY - SPIKE_SZ }],
      movingPlatforms: [
        { x: 350, y: 250, w: 100, h: 16, x1: 100, x2: 700, y1: 250, y2: 250, speed: 3 },
      ],
      coins: [{ id: 0, x: 400, y: 100 }, { id: 1, x: 400, y: 50 }],
      exit: { x: 720, y: 422 }, spawns: [{ x: 50, y: 454 }, { x: 100, y: 454 }], totalKeys: 3,
    }
  ];
}

// ── Particles ──────────────────────────────────────────────────
const ptcls = [];

function spawnPtcls(x, y, col, n, type) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i / n) + Math.random() * 0.8;
    const sp = 2 + Math.random() * 3.5;
    ptcls.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
      life: 1, dec: 0.02 + Math.random() * 0.02, col, sz: 4 + Math.random() * 4, type
    });
  }
}

function spawnHearts(x, y, n) {
  for (let i = 0; i < n; i++) {
    ptcls.push({
      x: x + (Math.random() - 0.5) * 50, y, vx: (Math.random() - 0.5) * 2,
      vy: -(1.5 + Math.random() * 2.5), life: 1, dec: 0.013,
      col: `hsl(${330 + Math.random() * 30},90%,65%)`, sz: 9 + Math.random() * 7, type: 'heart'
    });
  }
}

function spawnStars(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 4;
    ptcls.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
      life: 1, dec: 0.018, col: '#FFD700', sz: 5 + Math.random() * 4, type: 'star'
    });
  }
}

function tickPtcls() {
  for (let i = ptcls.length - 1; i >= 0; i--) {
    const p = ptcls[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.life -= p.dec;
    if (p.life <= 0) ptcls.splice(i, 1);
  }
}

function drawPtcls(ctx) {
  ptcls.forEach(p => {
    ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.col;
    if (p.type === 'heart') heartShape(ctx, p.x, p.y, p.sz);
    else if (p.type === 'star') starShape(ctx, p.x, p.y, p.sz * 0.4, p.sz, 5);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
}

// ── Shapes ─────────────────────────────────────────────────────
function heartShape(ctx, x, y, r) {
  const s = r * 0.9;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.4);
  ctx.bezierCurveTo(-s * 0.1, s * 0.05, -s, s * 0.1, -s, -s * 0.3);
  ctx.bezierCurveTo(-s, -s * 0.9, 0, -s * 0.85, 0, -s * 0.4);
  ctx.bezierCurveTo(0, -s * 0.85, s, -s * 0.9, s, -s * 0.3);
  ctx.bezierCurveTo(s, s * 0.1, s * 0.1, s * 0.05, 0, s * 0.4);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function starShape(ctx, cx, cy, ir, or, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? or : ir;
    const a = Math.PI * i / pts - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
      : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}

// ── Player Class ───────────────────────────────────────────────
class Bear {
  constructor(x, y, character) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.character = character; // 'dudu' | 'bubu'
    this.spawnX = x; this.spawnY = y;
    this.anim = 'idle';        // idle, walk, jump, land, celebrate
    this.frame = 0;
    this.landTmr = 0;
    this.celebTmr = 0;
    this.jumped = false;
  }

  update(input, platforms, barriers, spikes, mPlats) {
    this.jumped = false;
    // Moving platforms horizontal shift if standing on one
    let mx = 0;
    for (const mp of mPlats) {
      if (this.onGround && this.x + PW > mp.x && this.x < mp.x + mp.w && this.y + PH >= mp.y - 2 && this.y + PH <= mp.y + 10) {
        mx = mp.vx || 0;
        this.y = mp.y - PH;
      }
    }
    this.x += mx;

    // Horizontal
    const moving = input.left || input.right;
    if (input.left) { this.vx = -WALK_SPD; this.facing = -1; }
    else if (input.right) { this.vx = WALK_SPD; this.facing = 1; }
    else { this.vx *= 0.75; if (Math.abs(this.vx) < 0.1) this.vx = 0; }

    // Jump
    if (input.jump && this.onGround) {
      this.vy = JUMP_VEL; this.onGround = false; this.jumped = true;
    }
    // Gravity
    this.vy += GRAV;
    if (this.vy > 18) this.vy = 18;

    // Move X
    this.x += this.vx;
    if (this.x < 0) this.x = 0;
    if (this.x + PW > CW) this.x = CW - PW;

    // Barrier X collision
    for (const b of barriers) {
      if (b.open) continue;
      if (this.x + PW > b.x && this.x < b.x + b.w && this.y + PH > b.y && this.y < b.y + b.h) {
        const ol = this.x + PW - b.x, or2 = b.x + b.w - this.x;
        if (ol < or2) { this.x = b.x - PW; } else { this.x = b.x + b.w; }
        this.vx = 0;
      }
    }

    // Move Y
    const prevY = this.y;
    this.y += this.vy;
    this.onGround = false;

    // Platform Y collision
    for (const p of platforms) {
      if (this.x + PW > p.x && this.x < p.x + p.w) {
        // Land on top
        if (this.vy >= 0 && prevY + PH <= p.y + 3 && this.y + PH >= p.y) {
          this.y = p.y - PH; this.vy = 0; this.onGround = true;
          if (this.anim === 'jump') { this.anim = 'land'; this.landTmr = 9; }
        }
        // Hit from below
        else if (this.vy < 0 && prevY >= p.y + p.h - 3 && this.y < p.y + p.h) {
          this.y = p.y + p.h; this.vy = 2;
        }
      }
    }
    // Floor failsafe
    if (this.y + PH > CH) { this.y = CH - PH; this.vy = 0; this.onGround = true; }

    // Spike collision
    for (const s of spikes) {
      const pad = 6;
      if (this.x + PW > s.x + pad && this.x < s.x + SPIKE_SZ - pad &&
        this.y + PH > s.y + pad && this.y < s.y + SPIKE_SZ - pad) {
        this.reset();
      }
    }

    // Animation state
    if (this.celebTmr > 0) {
      this.anim = 'celebrate'; this.celebTmr--;
    } else if (this.landTmr > 0) {
      this.landTmr--;
      if (this.landTmr === 0) this.anim = this.onGround ? 'idle' : 'jump';
    } else if (!this.onGround) {
      this.anim = 'jump';
    } else {
      this.anim = moving ? 'walk' : 'idle';
    }
    this.frame++;
  }

  celebrate() { this.celebTmr = 150; this.anim = 'celebrate'; }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0; this.vy = 0;
    spawnPtcls(this.x + PW / 2, this.y + PH / 2, '#FF0000', 15, 'circle');
    sfx(150, 0.2, 'sawtooth', 0.1);
  }

  getState() {
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy,
      facing: this.facing, anim: this.anim, frame: this.frame, onGround: this.onGround
    };
  }
  applyState(s) {
    this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy;
    this.facing = s.facing; this.anim = s.anim; this.frame = s.frame; this.onGround = s.onGround;
  }
}

// ── Bear Drawing ───────────────────────────────────────────────
function drawBear(ctx, bear) {
  const { x, y, facing, anim, frame, character } = bear;
  const isDudu = character === 'dudu';
  const img = isDudu ? imgDudu : imgBubu;

  const cx = x + PW / 2, cy = y + PH / 2;
  ctx.save();
  ctx.translate(cx, cy);

  // Apply facing and bob
  let sx = 0.55 * (isDudu ? 1.1 : 1), sy = 0.55 * (isDudu ? 1.1 : 1);
  const bob = anim === 'walk' ? Math.sin(frame * 0.4) * 2.5 : 0;

  // Squash & stretch
  if (anim === 'land' && bear.landTmr > 5) { sx *= 1.2; sy *= 0.8; }
  else if (anim === 'jump' && bear.vy < -6) { sx *= 0.9; sy *= 1.1; }

  ctx.scale(facing * sx, sy);
  ctx.translate(0, bob / sy);

  if (img.complete) {
    // Draw 3D Rendered Image
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  } else {
    // Fallback to old drawing logic (simplified)
    ctx.fillStyle = isDudu ? '#8B5E3C' : '#F5F0E8';
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Celebrate heart
  if (anim === 'celebrate') {
    const bz = Math.sin(frame * 0.15) * 5;
    ctx.fillStyle = '#FF4D88'; ctx.globalAlpha = 0.95;
    ctx.save();
    ctx.translate(facing < 0 ? 12 : -12, -70 + bz);
    ctx.scale(1 / sx, 1 / sy);
    heartShape(ctx, 0, 0, 13);
    ctx.restore();
  }
  ctx.restore();
}

// ── Level Rendering ─────────────────────────────────────────────
function drawBg(ctx, lv, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, lv.sky[0]);
  grad.addColorStop(1, lv.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);

  // Parallax stars/particles for 3D depth
  for (let i = 0; i < 20; i++) {
    const x = (Math.sin(i * 1234) * 0.5 + 0.5) * CW;
    const y = ((t * (0.2 + (i % 5) * 0.1) + i * 50) % (CH + 100)) - 50;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }

  // Decorative clouds with parallax
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  [
    { bx: 100, by: 70, bw: 65, layer: 0.1 },
    { bx: 370, by: 120, bw: 55, layer: 0.2 },
    { bx: 640, by: 50, bw: 70, layer: 0.15 },
  ].forEach(({ bx, by, bw, layer }) => {
    const ox = ((t * 0.005 * layer + bx * 0.001) % 1) * (CW + 200) - 100;
    drawCloud(ctx, ox, by, bw);
  });

  // Decorative trees (far background)
  const treePositions = [40, 140, 260, 430, 570, 680, 750];
  treePositions.forEach((tx, i) => {
    drawTree(ctx, tx, GY, 0.4 + i % 3 * 0.1, i % 2 === 0);
  });
}

function drawCloud(ctx, x, y, w) {
  if (x > CW + 120) x -= CW + 240;
  ctx.beginPath();
  ctx.arc(x, y, w * 0.38, 0, Math.PI * 2);
  ctx.arc(x + w * 0.3, y - w * 0.1, w * 0.3, 0, Math.PI * 2);
  ctx.arc(x + w * 0.6, y, w * 0.34, 0, Math.PI * 2);
  ctx.arc(x + w * 0.85, y + w * 0.05, w * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx, tx, ty, scale, dark) {
  const col1 = dark ? '#2E7D32' : '#388E3C';
  const col2 = dark ? '#1B5E20' : '#2E7D32';
  const trunk = dark ? '#4E342E' : '#5D4037';
  ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(tx, ty);
  // Trunk
  ctx.fillStyle = trunk; ctx.fillRect(-4 * scale, -16 * scale, 8 * scale, 18 * scale);
  // Layers
  [[0, -52, 26], [0, -38, 33], [0, -24, 40]].forEach(([dx, dy, r], i) => {
    ctx.fillStyle = i % 2 === 0 ? col1 : col2;
    ctx.beginPath(); ctx.arc(dx * scale, dy * scale, r * scale, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function drawPlatform(ctx, p) {
  const depth = 12;
  const sideCol = 'rgba(255,255,255,0.15)';
  const topCol = 'rgba(255,255,255,0.25)';

  if (p.isGround) {
    // 3D Glass Ground
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(p.x, p.y + depth, p.w, p.h - depth);

    // Top face
    const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + depth);
    g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, depth);

    // Glowing line
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke();
  } else {
    // 3D Glass Floating Platform
    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 10;

    // Main body
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    grad.addColorStop(0, 'rgba(255,255,255,0.2)'); grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 8); ctx.fill(); ctx.stroke();

    // Top highlight (glass edge)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(p.x + 2, p.y + 1, p.w - 4, 4, 4); ctx.stroke();

    // Side depth effect
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x + 8, p.y + p.h + 6);
    ctx.lineTo(p.x + p.w + 8, p.y + p.h + 6);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.closePath(); ctx.fill();

    ctx.restore();
  }
}

function drawKey(ctx, k, t) {
  if (k.collected) return;
  const by = Math.sin(t * 0.045) * 5;
  const rot = t * 0.025;
  ctx.save(); ctx.translate(k.x, k.y + by); ctx.rotate(rot);
  // Glow
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  gl.addColorStop(0, 'rgba(255,215,0,0.55)'); gl.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  // Key ring
  ctx.strokeStyle = '#996600'; ctx.lineWidth = 3.5; ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(0, -7, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Shaft
  ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#996600';
  ctx.beginPath(); ctx.roundRect(-3, 0, 6, 18, 2); ctx.fill(); ctx.stroke();
  // Teeth
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(3, 5, 6, 3); ctx.fillRect(3, 10, 5, 3);
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.arc(-2, -10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawExit(ctx, exit, ready, t) {
  const ecx = exit.x + EXIT_W / 2, ecy = exit.y + EXIT_H / 2;
  const pulse = Math.sin(t * 0.055) * 0.08 + 0.92;
  ctx.save(); ctx.translate(ecx, ecy); ctx.scale(pulse, pulse); ctx.translate(-ecx, -ecy);

  if (!ready) {
    // 3D Glass Lock
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.ellipse(ecx, ecy, EXIT_W / 2, EXIT_H / 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Lock icon
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.roundRect(ecx - 10, ecy - 5, 20, 15, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(ecx, ecy - 5, 7, Math.PI, 0); ctx.stroke();
  } else {
    // Glassy Portal
    const gg = ctx.createRadialGradient(ecx, ecy, 5, ecx, ecy, EXIT_W);
    gg.addColorStop(0, 'rgba(255,100,200,0.6)');
    gg.addColorStop(0.7, 'rgba(255,150,250,0.2)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, EXIT_W * 0.9, EXIT_H * 0.9, 0, 0, Math.PI * 2); ctx.fill();

    // Glowing Rings
    for (let i = 0; i < 3; i++) {
      const rr = (t * 0.5 + i * 20) % 40;
      ctx.strokeStyle = `rgba(255,150,220,${1 - rr / 40})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ecx, ecy, (EXIT_W / 2) + rr, (EXIT_H / 2) + rr, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // Center Heart
    ctx.fillStyle = '#FF4D88'; ctx.shadowColor = '#FF4D88'; ctx.shadowBlur = 20;
    heartShape(ctx, ecx, ecy, 22);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawPlate(ctx, plate) {
  const col = plate.active ? '#7FFF00' : '#FFD700';
  const border = plate.active ? '#2E7D32' : '#CC8800';
  ctx.fillStyle = col; ctx.strokeStyle = border; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(plate.x, plate.y, plate.w, plate.h, 5); ctx.fill(); ctx.stroke();
  // Down arrow hint
  ctx.fillStyle = border;
  ctx.beginPath();
  ctx.moveTo(plate.x + plate.w / 2, plate.y - 3);
  ctx.lineTo(plate.x + plate.w / 2 - 6, plate.y - 10);
  ctx.lineTo(plate.x + plate.w / 2 + 6, plate.y - 10);
  ctx.closePath(); ctx.fill();
}

function drawBarrier(ctx, b) {
  if (b.open) return;
  const bh = 15, bw = 20;
  for (let ry = b.y; ry < b.y + b.h; ry += bh) {
    const off = ((ry - b.y) / bh % 2) * (bw / 2);
    for (let rx = b.x - off; rx < b.x + b.w + bw; rx += bw) {
      const sx = Math.max(rx, b.x), sw = Math.min(rx + bw, b.x + b.w) - sx;
      if (sw <= 0) continue;
      ctx.fillStyle = '#CC2222'; ctx.fillRect(sx, ry, sw, bh - 1);
      ctx.strokeStyle = '#880000'; ctx.lineWidth = 1; ctx.strokeRect(sx, ry, sw, bh - 1);
    }
  }
}

function drawSpike(ctx, s) {
  const sz = SPIKE_SZ;
  ctx.save();
  // 3D Metal Spike
  const gd = ctx.createLinearGradient(s.x, s.y, s.x + sz, s.y + sz);
  gd.addColorStop(0, '#B0BEC5'); gd.addColorStop(0.5, '#455A64'); gd.addColorStop(1, '#263238');
  ctx.fillStyle = gd;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + sz);
  ctx.lineTo(s.x + sz / 2, s.y);
  ctx.lineTo(s.x + sz, s.y + sz);
  ctx.fill();

  // Highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s.x + sz / 2, s.y); ctx.lineTo(s.x + sz, s.y + sz); ctx.stroke();
  ctx.restore();
}

function drawCoin(ctx, c, t) {
  if (c.collected) return;
  const bob = Math.sin(t * 0.1) * 3;
  const rot = t * 0.12;
  const cx = c.x + COIN_SZ / 2, cy = c.y + COIN_SZ / 2 + bob;
  const width = Math.cos(rot) * COIN_SZ;

  ctx.save(); ctx.translate(cx, cy);
  // Glow
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  gl.addColorStop(0, 'rgba(255,215,0,0.4)'); gl.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();

  // 3D Rotating Coin
  ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 2;
  if (Math.abs(width) > 2) {
    ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(width) / 2, COIN_SZ / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Inner ring
    ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(width) / 4, COIN_SZ / 3, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    // Edge of the coin
    ctx.fillRect(-1, -COIN_SZ / 2, 2, COIN_SZ);
  }
  ctx.restore();
}

// ── HUD ────────────────────────────────────────────────────────
function drawHUD(ctx, lv, collected, total) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, CW, 46);

  // Level name
  ctx.font = 'bold 15px Nunito,sans-serif';
  ctx.fillStyle = '#FFE4A0';
  ctx.textAlign = 'center';
  ctx.fillText(lv.name, CW / 2, 30);

  // Key count
  ctx.font = 'bold 13px Nunito,sans-serif';
  ctx.fillStyle = collected >= total ? '#7FFF00' : '#FFD700';
  ctx.fillText(`🔑 ${collected} / ${total}`, CW / 2 - 40, 13);

  // Coin count
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`🪙 ${coinsGot.size} / ${totalCoins}`, CW / 2 + 40, 13);

  // P1 label
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px Nunito,sans-serif';
  ctx.fillStyle = '#D2956A';
  ctx.fillText('🐻 DUDU', 10, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px Nunito,sans-serif';
  ctx.fillText('WASD + Space', 10, 34);

  // P2 label
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px Nunito,sans-serif';
  ctx.fillStyle = '#F0E0D8';
  ctx.fillText('BUBU 🐻', CW - 10, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px Nunito,sans-serif';
  ctx.fillText('Arrows + Enter', CW - 10, 34);

  ctx.textAlign = 'left';
}

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
function playJump() { sfx(380, 0.15, 'sine', 0.12); setTimeout(() => sfx(520, 0.1), 80); }
function playLevel() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx(f, 0.3, 'sine', 0.15), i * 120));
}
function playVictory() {
  [523, 659, 784, 1047, 1318].forEach((f, i) => setTimeout(() => sfx(f, 0.4, 'sine', 0.15), i * 100));
}

// ── Game State ─────────────────────────────────────────────────
let scene = 'lobby';
let localPIdx = 0;        // 0=Dudu, 1=Bubu
let levels = buildLevels();
let lvIdx = 0;
let lv = null;
let localBear = null;
let remoteBear = null;
let keysGot = new Set();
let coinsGot = new Set();
let totalCoins = 0;
let barriers = [];
let plates = [];
let spikes = [];
let mPlats = [];
let t = 0;

// ── Images ─────────────────────────────────────────────────────
const imgDudu = new Image(); imgDudu.src = 'dudu_3d.png';
const imgBubu = new Image(); imgBubu.src = 'bubu_3d.png';

function loadLevel(index) {
  lv = JSON.parse(JSON.stringify(levels[index]));
  keysGot.clear();
  coinsGot.clear();
  barriers = lv.barriers.map(b => ({ ...b, open: false }));
  plates = lv.plates.map(p => ({ ...p, active: false }));
  spikes = lv.spikes || [];
  mPlats = (lv.movingPlatforms || []).map(p => ({ ...p, tx: 0, ty: 0, vx: 0, vy: 0 }));
  totalCoins = (lv.coins || []).length;

  const s0 = lv.spawns[0], s1 = lv.spawns[1];
  if (localPIdx === 0) {
    localBear = new Bear(s0.x, s0.y, 'dudu');
    remoteBear = new Bear(s1.x, s1.y, 'bubu');
  } else {
    localBear = new Bear(s1.x, s1.y, 'bubu');
    remoteBear = new Bear(s0.x, s0.y, 'dudu');
  }

  document.getElementById('hint-bar').textContent = lv.hint || '';
}

window.onRemoteCoin = (id) => {
  if (lv && lv.coins) {
    const c = lv.coins.find(item => item.id === id);
    if (c && !c.collected) {
      c.collected = true;
      coinsGot.add(id);
      spawnStars(c.x + COIN_SZ / 2, c.y + COIN_SZ / 2, 8);
      playCollect();
    }
  }
};

// ── Input ──────────────────────────────────────────────────────
const KS = {};
const PREV_JUMP = {};
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  KS[e.code] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { KS[e.code] = false; });

function getInput() {
  if (localPIdx === 0) {
    return { left: !!KS['KeyA'], right: !!KS['KeyD'], jump: !!KS['KeyW'] || !!KS['Space'] };
  } else {
    return { left: !!KS['ArrowLeft'], right: !!KS['ArrowRight'], jump: !!KS['ArrowUp'] || !!KS['Enter'] };
  }
}

// ── Overlap helpers ────────────────────────────────────────────
function bearInExit(bear) {
  const bx = bear.x + PW / 2, by = bear.y + PH / 2;
  const ex = lv.exit.x + EXIT_W / 2, ey = lv.exit.y + EXIT_H / 2;
  const dx = (bx - ex) / (EXIT_W / 2), dy = (by - ey) / (EXIT_H / 2);
  return dx * dx + dy * dy <= 1;
}

function bearOnPlate(bear, plate) {
  return bear.x + PW > plate.x && bear.x < plate.x + plate.w &&
    bear.y + PH >= plate.y && bear.y + PH <= plate.y + plate.h + 8 &&
    bear.onGround;
}

// ── Level complete overlay ─────────────────────────────────────
let lvCompTmr = 0;

function triggerLvComplete() {
  if (lvCompTmr > 0) return;
  lvCompTmr = 180;
  localBear.celebrate();
  if (remoteBear) remoteBear.celebrate();
  spawnHearts(CW / 2, CH / 2, 25);
  for (let i = 0; i < 40; i++) spawnPtcls(CW / 2, CH / 2, `hsl(${Math.random() * 360},90%,65%)`, 1, 'circle');
  playLevel();
  if (window.NET_nextLevel) window.NET_nextLevel(lvIdx + 1);
  // Redundant local loadLevel removed; we wait for onLoadLevel from socket.
}

function drawLvComplete(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, CW, CH);
  ctx.font = 'bold 44px Nunito,sans-serif';
  ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
  ctx.shadowColor = '#FF4D88'; ctx.shadowBlur = 24;
  ctx.fillText('💕 Level Complete! 💕', CW / 2, CH / 2 - 16);
  ctx.shadowBlur = 0;
  if (lvIdx + 1 < levels.length) {
    ctx.font = '20px Nunito,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Loading: ${levels[lvIdx + 1].name}…`, CW / 2, CH / 2 + 32);
  }
  ctx.textAlign = 'left';
}

// ── Scene helpers ──────────────────────────────────────────────
function showScene(name) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('scene-' + name);
  if (el) el.classList.add('active');
}

// ── Main Game Loop ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function loop() {
  requestAnimationFrame(loop);
  if (scene !== 'playing') return;
  t++;

  ctx.clearRect(0, 0, CW, CH);
  drawBg(ctx, lv, t);

  // Update moving platforms
  for (const mp of mPlats) {
    const dist = Math.sqrt((mp.x2 - mp.x1) ** 2 + (mp.y2 - mp.y1) ** 2);
    if (dist > 0) {
      const cycle = dist * 2 / mp.speed;
      const progress = (t % cycle) / cycle;
      const f = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      const oldX = mp.x;
      mp.x = mp.x1 + (mp.x2 - mp.x1) * f;
      mp.y = mp.y1 + (mp.y2 - mp.y1) * f;
      mp.vx = mp.x - oldX;
    }
  }

  lv.platforms.forEach(p => drawPlatform(ctx, p));
  mPlats.forEach(p => drawPlatform(ctx, p));
  barriers.forEach(b => drawBarrier(ctx, b));
  plates.forEach(p => drawPlate(ctx, p));
  spikes.forEach(s => drawSpike(ctx, s));
  lv.keys.forEach(k => drawKey(ctx, k, t));
  (lv.coins || []).forEach(c => drawCoin(ctx, c, t));

  const allKeys = keysGot.size >= lv.totalKeys;
  drawExit(ctx, lv.exit, allKeys, t);

  // Update local bear
  const lastGround = localBear.onGround;
  localBear.update(getInput(), [...lv.platforms, ...mPlats], allKeys ? [] : barriers, spikes, mPlats);
  if (!lastGround && localBear.onGround && localBear.vy >= 0) { /* landed */ }
  if (localBear.jumped) playJump();

  // Draw bears
  const dudu = localPIdx === 0 ? localBear : remoteBear;
  const bubu = localPIdx === 1 ? localBear : remoteBear;
  if (dudu) drawBear(ctx, dudu);
  if (bubu) drawBear(ctx, bubu);

  tickPtcls();
  drawPtcls(ctx);
  // Add coin count to HUD or separate display
  drawHUD(ctx, lv, keysGot.size, lv.totalKeys);
  if (lvCompTmr > 0) { lvCompTmr--; drawLvComplete(ctx); }

  // Pressure plates
  plates.forEach(plate => {
    const wasActive = plate.active;
    plate.active = bearOnPlate(localBear, plate) || (remoteBear && bearOnPlate(remoteBear, plate));
    const bar = barriers.find(b => b.id === plate.doorId);
    if (bar) bar.open = plate.active;
    if (wasActive !== plate.active && window.NET_plate)
      window.NET_plate({ id: plate.id, active: plate.active });
  });

  // Key pickup
  lv.keys.forEach(k => {
    if (k.collected) return;
    if (Math.abs(localBear.x + PW / 2 - k.x) < 20 && Math.abs(localBear.y + PH / 2 - k.y) < 22) {
      k.collected = true; keysGot.add(k.id);
      spawnStars(k.x, k.y, 16); spawnHearts(k.x, k.y - 10, 6);
      playCollect();
      if (window.NET_key) window.NET_key(k.id);
    }
  });

  // Coin collection
  (lv.coins || []).forEach(c => {
    if (!c.collected) {
      const bx = localBear.x + PW / 2, by = localBear.y + PH / 2;
      const cx = c.x + COIN_SZ / 2, cy = c.y + COIN_SZ / 2;
      if (Math.hypot(bx - cx, by - cy) < 25) {
        c.collected = true;
        coinsGot.add(c.id);
        spawnStars(cx, cy, 12);
        playCollect();
        if (window.NET_coin) window.NET_coin(c.id);
      }
    }
  });

  // Check level complete
  if (allKeys && lvCompTmr === 0 && bearInExit(localBear) && remoteBear && bearInExit(remoteBear)) {
    triggerLvComplete();
  }

  // Send network state
  if (window.NET_state) window.NET_state(localBear.getState());
}

// ── Network callbacks (called by network.js) ────────────────────
window.onRemoteState = (state) => {
  if (remoteBear) remoteBear.applyState(state);
};
window.onRemoteKey = (id) => {
  if (!lv) return;
  const k = lv.keys.find(k => k.id === id);
  if (k && !k.collected) {
    k.collected = true; keysGot.add(id);
    spawnStars(k.x, k.y, 16); spawnHearts(k.x, k.y - 10, 6); playCollect();
  }
};
window.onRemotePlate = (data) => {
  const plate = plates.find(p => p.id === data.id);
  if (plate) {
    plate.active = data.active;
    const bar = barriers.find(b => b.id === plate.doorId);
    if (bar) bar.open = data.active;
  }
};
window.onLoadLevel = (idx) => {
  if (idx >= levels.length) {
    scene = 'gamecomplete';
    showScene('gamecomplete');
    playVictory();
  } else {
    lvIdx = idx;
    loadLevel(idx);
    lvCompTmr = 0;
  }
};
window.onBothReady = (pIdx, startLevel) => {
  localPIdx = pIdx;
  lvIdx = startLevel;
  showScene('game');
  loadLevel(lvIdx);
  scene = 'playing';
};
window.onPartnerLeft = () => {
  alert('💔 Your partner disconnected. Please refresh and start a new game.');
  location.reload();
};

// Start loop
requestAnimationFrame(loop);
