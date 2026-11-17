// Flapurr scenery: the backdrop, the rooftop ground, the scratching-post cat trees
// and the golden fish. Drawing only: nothing here changes the course, the hitboxes
// or the score. Everything is deterministic from a seed so a post looks the same
// on every frame.
const TAU = Math.PI * 2;
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const mix = (a, b, amount) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * amount)).join(',')})`; };
const tone = (hex, amount) => mix(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount));
function box(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

// Extra colors for each unlockable sky (the sky itself comes from crew-progress.js).
export const SKY_ART = {
  midnight:{ feature:'moon', far:'#1f2e52', near:'#0d1529', window:'#ffd98a', cloud:'#a9c0ea', horizon:'#2b4674', ground:'#0a0f1c', lip:'#26365a', lipLight:'#4a659c' },
  sunset:{ feature:'sun', far:'#51364f', near:'#2b1f38', window:'#ffd08c', cloud:'#f4b79a', horizon:'#dc8a6e', ground:'#17131f', lip:'#4c3449', lipLight:'#8a5f72' },
  aurora:{ feature:'aurora', far:'#183a44', near:'#0d2129', window:'#d9ffb5', cloud:'#a3e6cc', horizon:'#2f8377', ground:'#0b1518', lip:'#1f4a4c', lipLight:'#3d8a88' }
};
export const skyArt = sky => SKY_ART[sky?.id] || SKY_ART.midnight;

// ---------- Skyline tiles (built once, then scrolled) ----------
const TILE = 840;
function skyline(seed, { minW, maxW, minH, maxH, lit, near }) {
  const r = makeRng(seed), list = []; let x = 0;
  while (x < TILE - minW) {
    const w = Math.min(TILE - x, Math.round(minW + r() * (maxW - minW))), h = Math.round(minH + r() * (maxH - minH)), windows = [];
    const stepX = near ? 13 : 9, stepY = near ? 16 : 12;
    for (let wy = 10; wy < h - 8; wy += stepY) for (let wx = 6; wx < w - 8; wx += stepX) if (r() < lit) windows.push([wx, wy]);
    list.push({ x, w, h, windows, roof:r(), extra:r() });
    x += w + (r() < 0.3 ? Math.round(4 + r() * 12) : 0);
  }
  if (near) list[Math.floor(list.length / 2)].cat = true; // one rooftop cat per tile
  return list;
}
const FAR = skyline(0xC47, { minW:34, maxW:70, minH:60, maxH:150, lit:0.3, near:false });
const NEAR = skyline(0x51A, { minW:46, maxW:96, minH:28, maxH:78, lit:0.18, near:true });
function drawSkyline(ctx, list, { offset, W, baseY, color, windowColor, near, time }) {
  const off = ((offset % TILE) + TILE) % TILE;
  for (const b of list) for (const bx of [b.x - off, b.x - off + TILE]) {
    if (bx >= W || bx + b.w <= 0) continue;
    const top = baseY - b.h;
    ctx.fillStyle = color; ctx.fillRect(bx, top, b.w, b.h + 2);
    if (near && b.roof < 0.4) { ctx.beginPath(); ctx.moveTo(bx - 3, top + 1); ctx.lineTo(bx + b.w / 2, top - 16); ctx.lineTo(bx + b.w + 3, top + 1); ctx.closePath(); ctx.fill(); ctx.fillRect(bx + b.w * 0.68, top - 20, 7, 16); }
    else if (near && b.roof > 0.8) { ctx.fillRect(bx + 6, top - 5, b.w - 12, 5); }
    else if (!near && b.roof < 0.3) { ctx.fillRect(bx + b.w / 2 - 1, top - 16, 2, 16); ctx.fillRect(bx + b.w / 2 - 4, top - 10, 8, 2); }
    else if (!near && b.roof > 0.82) { ctx.fillRect(bx + b.w * 0.3, top - 9, b.w * 0.4, 9); ctx.fillRect(bx + b.w * 0.3 + 2, top - 14, 2, 5); ctx.fillRect(bx + b.w * 0.7 - 4, top - 14, 2, 5); }
    if (b.cat) { // a neighbour watching from the roof
      const cx = bx + b.w * 0.3, cy = top - (near && b.roof < 0.4 ? 9 : 0);
      ctx.beginPath(); ctx.ellipse(cx, cy - 6, 6, 7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy - 14, 4.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 4.4, cy - 16); ctx.lineTo(cx - 3.6, cy - 21.5); ctx.lineTo(cx - 0.6, cy - 18); ctx.moveTo(cx + 4.4, cy - 16); ctx.lineTo(cx + 3.6, cy - 21.5); ctx.lineTo(cx + 0.6, cy - 18); ctx.fill();
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 5, cy - 2); ctx.quadraticCurveTo(cx + 13, cy - 3 + Math.sin(time * 0.05) * 2, cx + 11, cy - 11); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = windowColor;
    const size = near ? [4, 5] : [3, 4];
    for (const [wx, wy] of b.windows) { ctx.globalAlpha = near ? 0.6 : 0.42; ctx.fillRect(bx + wx, top + wy, size[0], size[1]); }
    ctx.globalAlpha = 1;
  }
}
function cloud(ctx, x, y, s, ears) {
  ctx.beginPath();
  ctx.ellipse(x, y, 30 * s, 11 * s, 0, 0, TAU); ctx.ellipse(x - 16 * s, y - 6 * s, 15 * s, 10 * s, 0, 0, TAU); ctx.ellipse(x + 10 * s, y - 9 * s, 19 * s, 13 * s, 0, 0, TAU);
  ctx.fill();
  if (ears) { ctx.beginPath(); ctx.moveTo(x - 1 * s, y - 17 * s); ctx.lineTo(x + 3 * s, y - 29 * s); ctx.lineTo(x + 10 * s, y - 20 * s); ctx.moveTo(x + 12 * s, y - 20 * s); ctx.lineTo(x + 20 * s, y - 29 * s); ctx.lineTo(x + 23 * s, y - 16 * s); ctx.fill(); }
}

// ---------- Backdrop ----------
export function drawBackdrop(ctx, { sky, t, scroll, W, H, groundTop, still = false }) {
  const art = skyArt(sky), time = still ? 0 : t, drift = still ? 0 : t * 0.1;
  const g = ctx.createLinearGradient(0, 0, 0, groundTop);
  g.addColorStop(0, sky.top); g.addColorStop(0.62, sky.bottom); g.addColorStop(1, mix(sky.bottom, art.horizon, 0.6));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // twinkling stars
  ctx.fillStyle = sky.star;
  for (let i = 0; i < 70; i++) {
    const x = (i * 97 + 13) % W, y = (i * 151 + 29) % (groundTop - 150), size = 1 + (i % 3) * 0.6;
    ctx.globalAlpha = (art.feature === 'sun' ? 0.4 : 1) * (0.22 + 0.4 * (0.5 + 0.5 * Math.sin(time * 0.035 + i * 1.7)));
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  if (art.feature === 'moon') {
    const cx = 322, cy = 104;
    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 78); glow.addColorStop(0, 'rgba(214,228,255,.30)'); glow.addColorStop(1, 'rgba(214,228,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 80, cy - 80, 160, 160);
    ctx.fillStyle = '#f3ecd6'; ctx.beginPath(); ctx.arc(cx, cy, 23, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,150,130,.28)';
    for (const [dx, dy, r] of [[-8, -6, 5], [7, 4, 6.5], [-3, 10, 3.2], [9, -10, 2.6]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, TAU); ctx.fill(); }
  } else if (art.feature === 'sun') {
    const cx = 300, cy = groundTop - 92;
    const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 170); glow.addColorStop(0, 'rgba(255,190,140,.42)'); glow.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 170, cy - 170, 340, 340);
    const disc = ctx.createLinearGradient(0, cy - 60, 0, cy + 60); disc.addColorStop(0, '#ffe2a8'); disc.addColorStop(1, '#f08a6c');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 60, 0, TAU); ctx.clip(); ctx.fillStyle = disc; ctx.fillRect(cx - 60, cy - 60, 120, 120);
    ctx.fillStyle = mix(sky.bottom, art.horizon, 0.6); // retro sunset bands
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - 60, cy + 4 + i * 11, 120, 2 + i * 1.3);
    ctx.restore();
  } else {
    // soft curtains: stacked wide strokes that fade as they fall
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [k, base, color] of [[0, 110, '120,255,190'], [1.9, 170, '110,220,255'], [3.7, 232, '190,150,255']]) {
      const top = x => base + Math.sin(x * 0.012 + time * 0.012 + k) * 26 + Math.sin(x * 0.031 + k * 2) * 9;
      for (let layer = 0; layer < 9; layer++) {
        ctx.strokeStyle = `rgba(${color},${(0.075 * (1 - layer / 9)).toFixed(3)})`; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(-20, top(-20) + layer * 13);
        for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, top(x) + layer * 13);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // an occasional shooting star
  if (!still && art.feature !== 'sun') {
    const cycle = Math.floor(t / 620), phase = (t % 620) / 34;
    if (phase < 1) {
      const r = makeRng(cycle * 7919 + 3), sx = 60 + r() * 260, sy = 30 + r() * 120, x = sx + phase * 120, y = sy + phase * 52;
      const trail = ctx.createLinearGradient(x - 46, y - 20, x, y); trail.addColorStop(0, 'rgba(255,255,255,0)'); trail.addColorStop(1, `rgba(255,255,255,${0.85 * (1 - phase)})`);
      ctx.strokeStyle = trail; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 46, y - 20); ctx.lineTo(x, y); ctx.stroke();
    }
  }

  // clouds; every other one has ears
  ctx.fillStyle = art.cloud;
  for (let i = 0; i < 4; i++) {
    const span = W + 240, x = ((((i * 197 + 80 - scroll * 0.05 - drift) % span) + span) % span) - 120, y = 150 + ((i * 83) % 190);
    ctx.globalAlpha = 0.09 + (i % 2) * 0.04; cloud(ctx, x, y + (still ? 0 : Math.sin((t + i * 60) * 0.02) * 3), 0.9 + (i % 3) * 0.25, i % 2 === 0);
  }
  ctx.globalAlpha = 1;

  // horizon haze, then two skyline layers moving at different speeds
  const haze = ctx.createLinearGradient(0, groundTop - 190, 0, groundTop); haze.addColorStop(0, 'rgba(0,0,0,0)'); haze.addColorStop(1, mix(art.horizon, '#ffffff', 0.1).replace('rgb', 'rgba').replace(')', ',.38)'));
  ctx.fillStyle = haze; ctx.fillRect(0, groundTop - 190, W, 190);
  drawSkyline(ctx, FAR, { offset:scroll * 0.12 + 40, W, baseY:groundTop, color:art.far, windowColor:art.window, near:false, time });
  drawSkyline(ctx, NEAR, { offset:scroll * 0.3, W, baseY:groundTop, color:art.near, windowColor:art.window, near:true, time });
}

// ---------- Ground: a rooftop ledge that scrolls with the posts ----------
export function drawGroundArt(ctx, { sky, scroll, W, H, groundTop }) {
  const art = skyArt(sky);
  const fill = ctx.createLinearGradient(0, groundTop, 0, H); fill.addColorStop(0, mix(art.lip, art.ground, 0.45)); fill.addColorStop(0.5, art.ground);
  ctx.fillStyle = fill; ctx.fillRect(0, groundTop, W, H - groundTop);
  ctx.fillStyle = art.lip; ctx.fillRect(0, groundTop, W, 13);
  const off = ((scroll % 28) + 28) % 28;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let x = -off; x < W; x += 28) ctx.fillRect(x, groundTop + 3, 1.5, 10);
  ctx.fillStyle = art.lipLight; ctx.fillRect(0, groundTop, W, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let x = -off + 3; x < W; x += 28) ctx.fillRect(x, groundTop + 4, 21, 2);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, groundTop + 13, W, 4);
}

// ---------- Scratching-post cat trees ----------
const CARPETS = ['#4f8f8a', '#8a6aa8', '#c8745c', '#c79f45', '#6482ba', '#7b9c61'];
const EYES = ['#edc752', '#9fc66d', '#8abde0'];
export function postStyle(seed) {
  const r = makeRng(seed);
  return { carpet:CARPETS[Math.floor(r() * CARPETS.length)], cubby:r() < 0.45, eyes:EYES[Math.floor(r() * EYES.length)], blink:Math.floor(r() * 400), fray:[r(), r(), r(), r(), r()] };
}
// The post fills x..x+w and y..y+h exactly like its hitbox; the perch and base
// overhang a few pixels for looks only. `hanging` posts come down from the top.
export function drawCatTree(ctx, { x, y, w, h, hanging, seed, t = 0 }) {
  if (h <= 2) return;
  const style = postStyle(seed), px = x + 9, pw = w - 18, perchH = Math.min(16, h), baseH = 13;
  ctx.save();

  // sisal post
  const body = ctx.createLinearGradient(px, 0, px + pw, 0);
  body.addColorStop(0, '#73542e'); body.addColorStop(0.2, '#a9834f'); body.addColorStop(0.48, '#d6b780'); body.addColorStop(0.8, '#a67f4c'); body.addColorStop(1, '#684b29');
  ctx.fillStyle = body; box(ctx, px, y, pw, h, 5); ctx.fill();
  ctx.save(); box(ctx, px, y, pw, h, 5); ctx.clip();
  ctx.lineCap = 'round';
  for (let yy = y - 4; yy < y + h + 6; yy += 7) { // rope coils sag a little, like a cylinder seen from the front
    ctx.strokeStyle = 'rgba(70,48,20,.46)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px - 1, yy); ctx.quadraticCurveTo(px + pw / 2, yy + 3.4, px + pw + 1, yy); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,205,.22)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(px + pw * 0.26, yy + 3.6); ctx.quadraticCurveTo(px + pw * 0.45, yy + 5, px + pw * 0.64, yy + 3.8); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(214,183,128,.75)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; // a few frayed fibres
  style.fray.forEach((value, i) => { const fy = y + 18 + value * Math.max(0, h - 36), side = i % 2 ? px + pw : px, dir = i % 2 ? 1 : -1; if (h > 40) { ctx.beginPath(); ctx.moveTo(side, fy); ctx.lineTo(side + dir * (3 + value * 4), fy - 3 + value * 5); ctx.stroke(); } });

  // a cubby with someone watching
  if (!hanging && style.cubby && h > 175) {
    const cy = Math.min(y + h - 78, Math.max(y + 66, y + h * 0.48)), top = cy - 28;
    const carpet = ctx.createLinearGradient(x, 0, x + w, 0); carpet.addColorStop(0, tone(style.carpet, -0.22)); carpet.addColorStop(0.5, tone(style.carpet, 0.04)); carpet.addColorStop(1, tone(style.carpet, -0.26));
    ctx.fillStyle = carpet; box(ctx, x - 1, top, w + 2, 56, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; box(ctx, x + 3, top + 2, w - 6, 5, 3); ctx.fill();
    ctx.fillStyle = '#130e17'; ctx.beginPath(); ctx.ellipse(x + w / 2, cy + 2, 17, 19, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = tone(style.carpet, 0.22); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + w / 2, cy + 2, 17, 19, 0, 0, TAU); ctx.stroke();
    const blinking = (t + style.blink) % 260 < 9;
    for (const dx of [-7, 7]) {
      if (blinking) { ctx.strokeStyle = style.eyes; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + w / 2 + dx - 4, cy); ctx.lineTo(x + w / 2 + dx + 4, cy); ctx.stroke(); continue; }
      ctx.fillStyle = style.eyes; ctx.beginPath(); ctx.ellipse(x + w / 2 + dx, cy, 4.2, 3.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#130e17'; ctx.beginPath(); ctx.ellipse(x + w / 2 + dx, cy, 1.2, 3, 0, 0, TAU); ctx.fill();
    }
  }

  // the far end: a ceiling plate, or a wooden base on the roof
  const wood = ctx.createLinearGradient(0, 0, 0, baseH); wood.addColorStop(0, '#a87c52'); wood.addColorStop(1, '#6f4d30');
  if (hanging) { ctx.fillStyle = '#7a5738'; box(ctx, x - 5, y - 4, w + 10, 11, 4); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, y + 7, pw, 5); }
  else if (h > perchH + baseH) {
    const by = y + h - baseH;
    ctx.save(); ctx.translate(0, by); ctx.fillStyle = wood; box(ctx, x - 7, 0, w + 14, baseH + 2, 5); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; box(ctx, x - 4, by + 2, w + 8, 3, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, by - 5, pw, 5);
  }

  // the carpeted perch at the gap
  const py = hanging ? y + h - perchH : y;
  const carpet = ctx.createLinearGradient(0, py, 0, py + perchH); carpet.addColorStop(0, tone(style.carpet, 0.2)); carpet.addColorStop(0.5, style.carpet); carpet.addColorStop(1, tone(style.carpet, -0.28));
  ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(px, hanging ? py - 6 : py + perchH, pw, 6); // shadow on the post
  ctx.fillStyle = carpet; box(ctx, x - 4, py, w + 8, perchH, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; box(ctx, x, py + 2, w, 4, 3); ctx.fill();
  ctx.fillStyle = tone(style.carpet, 0.3); // plush tufts along the edge that faces the gap
  const edge = hanging ? py + perchH - 1 : py + 1;
  for (let tx = x - 1; tx <= x + w + 1; tx += 6) { ctx.beginPath(); ctx.arc(tx, edge, 2.3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------- Golden fish ----------
export function drawGoldFish(ctx, x, y, t = 0, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 24); glow.addColorStop(0, 'rgba(255,214,102,.5)'); glow.addColorStop(1, 'rgba(255,214,102,0)');
  ctx.fillStyle = glow; ctx.fillRect(-24, -24, 48, 48);
  const wag = Math.sin(t * 0.25) * 2.5;
  ctx.fillStyle = '#f2a03a'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(17, -7 + wag); ctx.lineTo(14, 0); ctx.lineTo(17, 7 + wag); ctx.closePath(); ctx.fill(); // tail
  ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(4, -11); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill(); // fin
  const body = ctx.createLinearGradient(0, -8, 0, 8); body.addColorStop(0, '#fff0a6'); body.addColorStop(0.55, '#ffcb4d'); body.addColorStop(1, '#f0983a');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 11, 7.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-1, 0, 5.5, -2.3, -1.2); ctx.stroke();
  ctx.fillStyle = '#3b2a12'; ctx.beginPath(); ctx.arc(-6, -1.5, 1.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffbe0'; // two little sparkles
  for (const [angle, radius] of [[t * 0.05, 17], [t * 0.05 + 2.6, 15]]) {
    const sx = Math.cos(angle) * radius, sy = Math.sin(angle) * radius * 0.7, s = 2.2 + Math.sin(t * 0.2 + angle) * 0.8;
    ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.35, sy - s * 0.35); ctx.lineTo(sx + s, sy); ctx.lineTo(sx + s * 0.35, sy + s * 0.35); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * 0.35, sy + s * 0.35); ctx.lineTo(sx - s, sy); ctx.lineTo(sx - s * 0.35, sy - s * 0.35); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
