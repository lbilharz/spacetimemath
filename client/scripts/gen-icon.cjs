#!/usr/bin/env node
/**
 * Generates assets/logo.png — the 1UP Grid mark (3×3 colored squares,
 * navy gradient background, 1024×1024).
 *
 * Run: node scripts/gen-icon.cjs
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const PADDING = SIZE * 0.10;           // 10% inset — a bit more breathing room
const GAP = SIZE * 0.038;              // gap between cells
const CELL = (SIZE - 2 * PADDING - 2 * GAP) / 3;
const CELL_RX = SIZE * 0.055;          // cell corner radius
const BG_RX = SIZE * 0.22;            // icon corner radius

// Brand colors — bottom-right is null = dark "locked" slot
const COLORS = [
  '#5DD23C', '#5DD23C', '#FBBA00',
  '#5DD23C', '#FBBA00', '#4FA7FF',
  '#4FA7FF', '#E8391D', null,
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function roundRectClip(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// ── Background: deep radial gradient, lighter at top-center ──────────────────
const bgGrad = ctx.createRadialGradient(
  SIZE * 0.45, SIZE * 0.30, SIZE * 0.05,   // inner: top-center
  SIZE * 0.50, SIZE * 0.55, SIZE * 0.72,   // outer: slight bottom bias
);
bgGrad.addColorStop(0.0, '#3a5566');
bgGrad.addColorStop(0.6, '#253545');
bgGrad.addColorStop(1.0, '#18262f');
ctx.fillStyle = bgGrad;
roundRect(ctx, 0, 0, SIZE, SIZE, BG_RX);

// ── Very subtle inner vignette (darkens edges slightly) ───────────────────────
const vigGrad = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE*0.2, SIZE/2, SIZE/2, SIZE*0.72);
vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
vigGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
ctx.fillStyle = vigGrad;
roundRect(ctx, 0, 0, SIZE, SIZE, BG_RX);

// ── Draw each cell ────────────────────────────────────────────────────────────
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    const color = COLORS[row * 3 + col];
    const x = PADDING + col * (CELL + GAP);
    const y = PADDING + row * (CELL + GAP);

    if (color === null) {
      // Dark "locked" slot — barely lighter than the background
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, x, y, CELL, CELL, CELL_RX);
      continue;
    }

    // 1. Base cell color
    ctx.fillStyle = color;
    roundRect(ctx, x, y, CELL, CELL, CELL_RX);

    // 2. Top-shine: white gradient over top ~50% of cell (inside clip)
    ctx.save();
    roundRectClip(ctx, x, y, CELL, CELL, CELL_RX);
    const shine = ctx.createLinearGradient(x, y, x, y + CELL * 0.55);
    shine.addColorStop(0.0, 'rgba(255,255,255,0.30)');
    shine.addColorStop(1.0, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.restore();

    // 3. Bottom shadow: subtle darkening of bottom 30%
    ctx.save();
    roundRectClip(ctx, x, y, CELL, CELL, CELL_RX);
    const shadow = ctx.createLinearGradient(x, y + CELL * 0.7, x, y + CELL);
    shadow.addColorStop(0.0, 'rgba(0,0,0,0.00)');
    shadow.addColorStop(1.0, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = shadow;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.restore();
  }
}

// ── Write output ──────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'assets', 'logo.png');
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
console.log(`✓ ${outPath}`);
