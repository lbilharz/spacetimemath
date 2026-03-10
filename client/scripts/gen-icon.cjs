#!/usr/bin/env node
/**
 * Generates assets/logo.png — the noggin Grid mark (3×3 colored squares,
 * transparent background, 1024×1024). Used by @capacitor/assets easy mode.
 *
 * Run: node scripts/gen-icon.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const PADDING = SIZE * 0.06;   // 6% inset
const GAP = SIZE * 0.05;       // 5% gap between cells
const CELL = (SIZE - 2 * PADDING - 2 * GAP) / 3;
const CELL_RX = SIZE * 0.05;   // cell corner radius

const COLORS = [
  '#5DD23C', '#5DD23C', '#FBBA00',
  '#5DD23C', '#FBBA00', '#4FA7FF',
  '#4FA7FF', '#E8391D', 'rgba(255,255,255,0.35)',
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Navy rounded-rect background (mirrors the favicon.svg outer container).
// @capacitor/assets will use a white outer background; iOS rounds the corners.
ctx.fillStyle = '#2C3E50';
roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);

// Draw the 3×3 grid of colored squares.
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    ctx.fillStyle = COLORS[row * 3 + col];
    const x = PADDING + col * (CELL + GAP);
    const y = PADDING + row * (CELL + GAP);
    roundRect(ctx, x, y, CELL, CELL, CELL_RX);
  }
}

const outPath = path.join(__dirname, '..', 'assets', 'logo.png');
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
console.log(`✓ ${outPath}`);
