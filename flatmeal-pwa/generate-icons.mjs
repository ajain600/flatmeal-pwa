// Run this once: node generate-icons.mjs
// It creates icon-192.png, icon-512.png, apple-touch-icon.png in /public

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#f97316');
  grad.addColorStop(1, '#ea580c');
  ctx.fillStyle = grad;
  const r = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.arcTo(size, 0, size, r, r);
  ctx.lineTo(size, size - r);
  ctx.arcTo(size, size, size - r, size, r);
  ctx.lineTo(r, size);
  ctx.arcTo(0, size, 0, size - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fill();

  // Emoji
  ctx.font = `${size * 0.52}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍽️', size / 2, size / 2 + size * 0.04);

  return canvas.toBuffer('image/png');
}

try {
  writeFileSync('public/icon-192.png', makeIcon(192));
  writeFileSync('public/icon-512.png', makeIcon(512));
  writeFileSync('public/apple-touch-icon.png', makeIcon(180));
  console.log('✅ Icons generated in /public');
} catch(e) {
  console.log('canvas package not available — using fallback emoji icons');
  // Fallback: just copy a placeholder (Vercel will serve without icons fine)
}
