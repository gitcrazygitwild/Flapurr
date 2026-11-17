// Golden fish and the hat rack. Golden fish are a cosmetic collectible: they never
// change the score, the course or the leaderboard. Lifetime fish unlock hats.
const TAU = Math.PI * 2;
export const HATS = [
  { id:'none', name:'No hat', icon:'🐾', fish:0 },
  { id:'bow', name:'Bow tie', icon:'🎀', fish:3 },
  { id:'party', name:'Party hat', icon:'🎉', fish:8 },
  { id:'shades', name:'Sunglasses', icon:'🕶️', fish:15 },
  { id:'wizard', name:'Wizard hat', icon:'🧙', fish:25 },
  { id:'crown', name:'Crown', icon:'👑', fish:40 }
];
// The fish jar is a plain count saved on this device.
export const readFish = value => { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 999999) : 0; };
export const availableHat = (id, fish) => HATS.find(hat => hat.id === id && readFish(fish) >= hat.fish) || HATS[0];
export const nextHat = fish => HATS.find(hat => hat.fish > readFish(fish)) || null;
export const unlockedBetween = (before, after) => HATS.filter(hat => hat.fish > readFish(before) && hat.fish <= readFish(after));

// Where a golden fish floats behind a post, or null for most posts. `roll` and
// `offset` are 0–1 random numbers from the cosmetic RNG, never the course RNG.
export const FISH_CHANCE = 0.4, FISH_RADIUS = 13;
export function fishSpawn(roll, offset, gapCenter, { postWidth, spacing, top, bottom }) {
  if (!(roll < FISH_CHANCE)) return null;
  const y = Math.max(top, Math.min(bottom, gapCenter + (offset - 0.5) * 150));
  return { dx:postWidth + (spacing - postWidth) / 2, y, taken:false };
}
export const fishCaught = (catX, catY, catR, fishX, fishY) => Math.hypot(catX - fishX, catY - fishY) <= catR + FISH_RADIUS;

// Hats are drawn in the cat's own coordinates: body centred on (0,0), ears up top,
// eyes at y = -2, facing the viewer.
export function drawHat(ctx, id, t = 0) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (id === 'bow') {
    ctx.fillStyle = '#e2506a';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 12.5); ctx.lineTo(9 * s, 7.5); ctx.lineTo(9 * s, 17.5); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#b8344e'; ctx.beginPath(); ctx.arc(0, 12.5, 2.6, 0, TAU); ctx.fill();
  } else if (id === 'party') {
    ctx.fillStyle = '#6fb8e8'; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(1, -38); ctx.lineTo(9, -14); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(1, -38); ctx.lineTo(9, -14); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 3; for (let y = -34; y < -10; y += 8) { ctx.beginPath(); ctx.moveTo(-12, y + 5); ctx.lineTo(12, y - 3); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.arc(1, -38, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2f5ff'; ctx.beginPath(); ctx.ellipse(0.5, -14, 9.5, 2.4, 0, 0, TAU); ctx.fill();
  } else if (id === 'shades') {
    ctx.fillStyle = '#12141c';
    for (const x of [-6.2, 6.2]) { ctx.beginPath(); ctx.ellipse(x, -2, 5.8, 4.6, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#12141c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(1, -3); ctx.moveTo(-11.6, -3); ctx.lineTo(-17, -6); ctx.moveTo(11.6, -3); ctx.lineTo(17, -6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; for (const x of [-8, 4.4]) { ctx.beginPath(); ctx.moveTo(x, -3.6); ctx.lineTo(x + 3, -5); ctx.stroke(); }
  } else if (id === 'wizard') {
    ctx.fillStyle = '#5b4bb5'; ctx.beginPath(); ctx.moveTo(-11, -15); ctx.quadraticCurveTo(-2, -34, 9, -43); ctx.quadraticCurveTo(8, -28, 12, -15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3c9a'; ctx.beginPath(); ctx.ellipse(0.5, -15, 17, 4.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd96a';
    for (const [x, y, s] of [[-1, -24, 2.6], [5, -32, 1.8], [5, -20, 1.5]]) { const k = s * (0.85 + 0.15 * Math.sin(t * 0.15 + x)); ctx.beginPath(); ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.35, y - k * 0.35); ctx.lineTo(x + k, y); ctx.lineTo(x + k * 0.35, y + k * 0.35); ctx.lineTo(x, y + k); ctx.lineTo(x - k * 0.35, y + k * 0.35); ctx.lineTo(x - k, y); ctx.lineTo(x - k * 0.35, y - k * 0.35); ctx.closePath(); ctx.fill(); }
  } else if (id === 'crown') {
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(-12, -29); ctx.lineTo(-6, -22); ctx.lineTo(0, -32); ctx.lineTo(6, -22); ctx.lineTo(12, -29); ctx.lineTo(11, -15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d99a2b'; ctx.fillRect(-11, -18.5, 22, 3.5);
    for (const [x, y, color] of [[-12, -29, '#e2506a'], [0, -32, '#6fb8e8'], [12, -29, '#7bd69a']]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 2.1, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
