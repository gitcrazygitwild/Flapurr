// game.js (ES module) — Flapurr!
// Firebase Firestore leaderboard + total plays + name entry modal
// Random cat color each run + floating sky cats + yarn ball gates + treat counter UI

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyCtm5P6i-nS-J6BRFu9qNu1MzfCvzLIinY",
  authDomain: "flapurr-web.firebaseapp.com",
  projectId: "flapurr-web",
  storageBucket: "flapurr-web.firebasestorage.app",
  messagingSenderId: "166196214299",
  appId: "1:166196214299:web:fd4cb3e828c4ab6e4956be",
  measurementId: "G-GW767ZB0M2"
};

// ---------- DOM ----------
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const fsBtn = document.getElementById("fs");

const netStatus = document.getElementById("netStatus");
const playsEl = document.getElementById("plays");
const boardEl = document.getElementById("board");

const modal = document.getElementById("modal");
const finalScoreEl = document.getElementById("finalScore");
const nameInput = document.getElementById("name");
const submitBtn = document.getElementById("submit");
const skipBtn = document.getElementById("skip");
const submitStatus = document.getElementById("submitStatus");

const setNet = (m) => { if (netStatus) netStatus.textContent = m; };

// iOS pinch/tap zoom weirdness helper
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

// ---------- Firebase ----------
let db = null;

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    setNet("Connected to cat HQ ✅");

    await incrementPlays();
    await refreshLeaderboard();
  } catch (e) {
    console.error(e);
    setNet("Firebase error: " + (e?.message || String(e)));
  }
}

async function incrementPlays() {
  if (!db) return;
  const ref = doc(db, "stats", "global");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, { plays: 1 });
      playsEl.textContent = "1";
      return;
    }
    const cur = Number(snap.data().plays || 0);
    tx.update(ref, { plays: cur + 1 });
    playsEl.textContent = String(cur + 1);
  });
}

async function refreshLeaderboard() {
  if (!db) return;
  boardEl.innerHTML = "";

  const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
  const snap = await getDocs(q);

  if (snap.empty) {
    boardEl.innerHTML = "<li>No scores yet. Be the first cat!</li>";
    return;
  }

  snap.forEach((d) => {
    const data = d.data() || {};
    const safeName = String(data.name || "Anonymous").slice(0, 16);
    const safeScore = Math.max(0, Math.min(9999, Math.floor(Number(data.score || 0))));
    const li = document.createElement("li");
    li.textContent = `${safeName} — ${safeScore}`;
    boardEl.appendChild(li);
  });
}

async function submitScore(name, score) {
  if (!db) return { ok: false, msg: "Firebase not connected." };

  const cleanName = String(name || "").trim().slice(0, 16);
  if (cleanName.length < 1) return { ok: false, msg: "Name required (1–16 chars)." };

  const cleanScore = Math.max(0, Math.min(9999, Math.floor(Number(score || 0))));

  await addDoc(collection(db, "scores"), {
    name: cleanName,
    score: cleanScore,
    createdAt: serverTimestamp()
  });

  await refreshLeaderboard();
  return { ok: true, msg: "Submitted! 🐾" };
}

// ---------- Modal ----------
let lastGameScore = 0;

function openModal(score) {
  lastGameScore = score;
  finalScoreEl.textContent = String(score);
  submitStatus.textContent = "";

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  nameInput.value = localStorage.getItem("flapurr_name") || "";
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

submitBtn.addEventListener("click", async () => {
  submitBtn.disabled = true;
  const nm = nameInput.value;
  localStorage.setItem("flapurr_name", nm.trim().slice(0, 16));

  try {
    const res = await submitScore(nm, lastGameScore);
    submitStatus.textContent = res.msg;
    if (res.ok) setTimeout(closeModal, 700);
  } catch (e) {
    console.error(e);
    submitStatus.textContent = "Submit failed. Check Firebase rules/config.";
  } finally {
    submitBtn.disabled = false;
  }
});

skipBtn.addEventListener("click", () => closeModal());
modal.addEventListener("pointerdown", (e) => { if (e.target === modal) closeModal(); });

// ---------- Canvas scaling ----------
const WORLD_W = 420;
const WORLD_H = 640;

let scale = 1, offsetX = 0, offsetY = 0;

function resizeCanvasToCSS() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  const s = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  scale = s;
  offsetX = (cssW - WORLD_W * s) / 2;
  offsetY = (cssH - WORLD_H * s) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
}

resizeCanvasToCSS();
window.addEventListener("resize", resizeCanvasToCSS);
window.addEventListener("orientationchange", resizeCanvasToCSS);

fsBtn?.addEventListener("click", async () => {
  try {
    const el = document.querySelector(".stage");
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
    setTimeout(resizeCanvasToCSS, 60);
  } catch (_) {}
});

// ---------- Game constants ----------
const GRAVITY = 0.45;
const FLAP_VY = -8.3;
const PIPE_SPEED = 2.55;
const PIPE_GAP = 150;
const PIPE_W = 70;
const PIPE_SPACING = 210;
const GROUND_H = 86;

// ---------- RNG ----------
let rngSeed = Math.floor(Math.random() * 1e9);
const rand = () => ((rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0) / 4294967296);

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    // LCG
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}


// ---------- Cat palettes (random each reset) ----------
const CAT_PALETTES = [
  { body: "#ffd6a6", ear: "#ffbf80", stripe: "rgba(120,60,20,0.35)" },  // ginger
  { body: "#cfcfd6", ear: "#b9b9c2", stripe: "rgba(50,50,60,0.28)" },   // gray
  { body: "#2b2b2f", ear: "#3a3a40", stripe: "rgba(255,255,255,0.10)" },// black
  { body: "#fff2d7", ear: "#f0d9b2", stripe: "rgba(120,90,40,0.22)" },  // cream
  { body: "#b07a4a", ear: "#9a6a40", stripe: "rgba(40,20,10,0.25)" },   // brown
];
let catStyle = CAT_PALETTES[Math.floor(Math.random() * CAT_PALETTES.length)];

// ---------- State ----------
let started = false;
let gameOver = false;
let score = 0; // displayed as treats
let best = Number(localStorage.getItem("flapurr_best") || 0);

const cat = { x: 120, y: WORLD_H * 0.45, r: 18, vy: 0, rot: 0 };
// Mouse bait the cat chases (purely visual, stays within cat hitbox front half)
// Mouse bait the cat chases
const mouse = { x: cat.x, y: cat.y, vx: 0, vy: 0 };

const MOUSE_ANCHOR = 0.72;   // stays within cat hitbox (logic position)
const MOUSE_YOFF   = 6;

const MOUSE_GAP    = 16;     // <-- daylight between cat + mouse (tune 12–26)
const MOUSE_DRAW_AHEAD = 10; // extra forward bias based on cat speed
let pipes = [];
let t = 0;

// Treat “sparkles”
let sparkles = []; // {x,y,vx,vy,life}

// ---------- Tiny synth sounds ----------
let audioCtx = null;
function beep(freq, dur = 0.06, type = "triangle", gain = 0.04) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

// ---------- Helpers ----------
function reset() {
  started = false;
  gameOver = false;
  score = 0;
  t = 0;
  sparkles = [];

  catStyle = CAT_PALETTES[Math.floor(Math.random() * CAT_PALETTES.length)];

  cat.y = WORLD_H * 0.45;
  cat.vy = 0;
  cat.rot = 0;

  mouse.x = cat.x + cat.r * MOUSE_LEAD;
  mouse.y = cat.y + MOUSE_YOFF;
  mouse.vx = 0;
  mouse.vy = 0;

  pipes = [];
  for (let i = 0; i < 4; i++) addPipe(WORLD_W + 200 + i * PIPE_SPACING);

  statusEl.textContent = `Ready • Best: ${best}`;
}

function addPipe(x) {
  const marginTop = 70;
  const marginBottom = GROUND_H + 70;
  const centerMin = marginTop + PIPE_GAP / 2;
  const centerMax = WORLD_H - marginBottom - PIPE_GAP / 2;
  const gapCenter = centerMin + rand() * (centerMax - centerMin);
  const BALL_COLORS = ["#ff7aa8", "#7ac7ff", "#7dffb3", "#ffd77a", "#b58cff", "#ff8f7a"];

pipes.push({
  x,
  gapCenter,
  passed: false,
  seed: (rngSeed ^ ((x * 1000) | 0) ^ ((gapCenter * 10) | 0)) >>> 0,

  // random ball styling per pipe
  topDx: (rand() - 0.5) * (PIPE_W * 0.35),
  botDx: (rand() - 0.5) * (PIPE_W * 0.35),
  topR: 20 + rand() * 10,
  botR: 20 + rand() * 10,
  topColor: BALL_COLORS[Math.floor(rand() * BALL_COLORS.length)],
  botColor: BALL_COLORS[Math.floor(rand() * BALL_COLORS.length)],
});
}

function drawFray(rx, y, rw, dir, r01) {
  // little fibers poking out of the rope edge
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  for (let i = 0; i < 18; i++) {
    const x = rx + 6 + r01() * (rw - 12);
    const len = 3 + r01() * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r01() - 0.5) * 6, y + dir * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawKnot(cx, cy, r, baseHex, r01) {
  // knot = small fuzzy oval + a couple cross strands
  ctx.save();
  const g = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.2, cx, cy, r);
  g.addColorStop(0, shade(baseHex, +0.10));
  g.addColorStop(1, shade(baseHex, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r*1.25, r*0.9, (r01()-0.5)*0.4, 0, Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r*1.1, cy - r*0.2);
  ctx.lineTo(cx + r*1.1, cy + r*0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - r*0.8, cy + r*0.35);
  ctx.lineTo(cx + r*0.8, cy - r*0.35);
  ctx.stroke();

  ctx.restore();
}

function flap() {
  if (!started) started = true;
  if (gameOver) return;
  cat.vy = FLAP_VY;
  beep(520, 0.04, "square", 0.03);
}

function setGameOver() {
  if (gameOver) return;
  gameOver = true;

  beep(140, 0.10, "sawtooth", 0.03);

  if (score > best) {
    best = score;
    localStorage.setItem("flapurr_best", String(best));
  }

  statusEl.textContent = `Game Over • Treats: ${score} • Best: ${best} • Tap to restart`;
  openModal(score);
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= cr * cr;
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r,g,b){
  const to = (v)=>v.toString(16).padStart(2,"0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function shade(hex, amt) { // amt: -1..+1
  const {r,g,b} = hexToRgb(hex);
  const f = (v)=>Math.max(0, Math.min(255, Math.round(v + (amt*255))));
  return rgbToHex(f(r), f(g), f(b));
}

// Yarn helpers
  function drawYarnBall(cx, cy, r, base = "#ff7aa8") {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
  g.addColorStop(0, shade(base, +0.25));
  g.addColorStop(1, shade(base, -0.20));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.35 + i * 0.08), a, a + Math.PI * 0.85);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawRopePost(x, y, w, h, flipCaps = false, seed = 1) {
  const r01 = makeRng(seed);
  const inset = 6;
  const rx = x + inset;
  const ry = y;
  const rw = w - inset * 2;
  const rh = h;

  // core behind rope
  ctx.fillStyle = "#cdb892";
  roundRect(rx, ry, rw, rh, 10);
  ctx.fill();

  // caps sizes
  const capH = Math.min(16, Math.max(10, h * 0.18));
  const baseH = Math.min(22, Math.max(14, h * 0.22));

  // rope area excludes caps a bit so fray sits nicely
  const ropeTop = ry + capH * 0.70;
  const ropeBot = ry + rh - baseH * 0.75;
  const ropeH = Math.max(0, ropeBot - ropeTop);

  // rope color family
  const ropeBase = "#8b6a3f";

  // --- rope texture (spiral wraps) ---
  ctx.save();
  ctx.beginPath();
  roundRect(rx, ropeTop, rw, ropeH, 10);
  ctx.clip();

  // cylindrical shading
  const edge = ctx.createLinearGradient(rx, 0, rx + rw, 0);
  edge.addColorStop(0.0, "rgba(0,0,0,0.18)");
  edge.addColorStop(0.18, "rgba(0,0,0,0.06)");
  edge.addColorStop(0.50, "rgba(255,255,255,0.04)");
  edge.addColorStop(0.82, "rgba(0,0,0,0.06)");
  edge.addColorStop(1.0, "rgba(0,0,0,0.18)");
  ctx.fillStyle = edge;
  ctx.fillRect(rx, ropeTop, rw, ropeH);

  // spiral parameters (less vertical)
  const step = 12;
  const slope = 0.28; // smaller = more horizontal
  const ropeYJitter = 1.6;

  const ropeDark = "rgba(125, 92, 48, 0.72)";
  const ropeLight = "rgba(255, 255, 255, 0.22)";

  ctx.lineCap = "round";

  // occasional knots (per post)
  const knotCount = ropeH > 120 ? 1 + (r01() < 0.25 ? 1 : 0) : (r01() < 0.20 ? 1 : 0);
  const knots = [];
  for (let i = 0; i < knotCount; i++) {
    knots.push({
      x: rx + rw * (0.30 + r01() * 0.40),
      y: ropeTop + ropeH * (0.15 + r01() * 0.70),
      r: 5 + r01() * 4
    });
  }

  for (let yy = ropeTop - 40; yy < ropeTop + ropeH + 40; yy += step) {
    const j = Math.sin(yy * 0.06) * ropeYJitter; // static, no time component
    // thickness variation
    const thick = 6.4 + (Math.sin(yy * 0.09) * 0.9);
    // dark strand
    ctx.strokeStyle = ropeDark;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(rx - 30, yy + j);
    ctx.lineTo(rx + rw + 30, yy + j + rw * slope);
    ctx.stroke();

    // highlight
    ctx.strokeStyle = ropeLight;
    ctx.lineWidth = Math.max(1.8, thick * 0.32);
    ctx.beginPath();
    ctx.moveTo(rx - 30, yy + j - 1);
    ctx.lineTo(rx + rw + 30, yy + j + rw * slope - 1);
    ctx.stroke();
  }

  // draw knots on top of wraps
    // for (const k of knots) {
    // drawKnot(k.x, k.y, k.r, ropeBase, r01);
   // }

  ctx.restore();

  // frayed edges where rope meets caps
    if (ropeH > 20) {
    drawFray(rx, ropeTop + 1, rw, -1, r01);
    drawFray(rx, ropeBot - 1, rw, +1, r01);
   }

// caps: normal = cap at top, base at bottom
// flipCaps = cap at bottom (gap edge) and base at top
const topCapY = flipCaps ? (y + h - capH + 2) : (y - 2);
const baseY   = flipCaps ? (y - 2) : (y + h - baseH + 2);

// cap
ctx.fillStyle = "#9aa3b5";
roundRect(x + 2, topCapY, w - 4, capH, 10);
ctx.fill();

ctx.fillStyle = "rgba(255,255,255,0.22)";
roundRect(x + 6, topCapY + 3, w - 12, capH * 0.42, 10);
ctx.fill();

// base
ctx.fillStyle = "#7f889b";
roundRect(x - 2, baseY, w + 4, baseH, 12);
ctx.fill();

// base shadow (keep it near the bottom of whichever base is "down")
ctx.fillStyle = "rgba(0,0,0,0.20)";
if (!flipCaps) {
  roundRect(x - 2, y + h - 8, w + 4, 10, 10);
} else {
  roundRect(x - 2, y + 2, w + 4, 10, 10);
}
ctx.fill();
}

function drawString(fromX, fromY, toX, toY) {
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo((fromX + toX) / 2, (fromY + toY) / 2 + 12, toX, toY);
  ctx.stroke();
}

// Kill iOS double-tap-to-zoom + dblclick zoom
let __lastTouchEnd = 0;

document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - __lastTouchEnd < 350) e.preventDefault();
    __lastTouchEnd = now;
  },
  { passive: false }
);

document.addEventListener(
  "dblclick",
  (e) => e.preventDefault(),
  { passive: false }
);

// ---------- Input ----------

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  if (gameOver) {
    closeModal();
    reset();
    started = true;
  }
  flap();
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); flap(); }
  if (e.key.toLowerCase() === "r") { e.preventDefault(); closeModal(); reset(); }
}, { passive: false });

// ---------- Drawing ----------
function drawBG() {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#121b2e");
  g.addColorStop(1, "#0b1020");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // stars
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + 13) % WORLD_W;
    const y = (i * 151 + 29) % (WORLD_H - 180);
    const tw = 1 + (i % 3);
    ctx.fillStyle = "#cfe3ff";
    ctx.fillRect(x, y, tw, tw);
  }
  ctx.globalAlpha = 1;

  // floating sky cats
  for (let i = 0; i < 6; i++) {
    const x = ((t * 0.45) + i * 140) % (WORLD_W + 200) - 100;
    const y = 80 + (i * 57) % 240;
    const s = 0.6 + (i % 3) * 0.12;
    drawSkyCat(x, y, s, i);
  }
}

function drawSkyCat(x, y, s, i) {
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(x, y + Math.sin((t + i * 40) * 0.03) * 6);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#cfe3ff";

  // body
  roundRect(-18, -8, 44, 22, 11);
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.ellipse(-10, -10, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.beginPath(); ctx.moveTo(-18, -16); ctx.lineTo(-24, -26); ctx.lineTo(-10, -22); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2, -16);  ctx.lineTo(-6,  -26); ctx.lineTo(6,  -22); ctx.closePath(); ctx.fill();

  // tail
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#cfe3ff";
  ctx.beginPath();
  ctx.moveTo(24, 6);
  ctx.quadraticCurveTo(40, 0, 34, -10);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPipes() {
  for (const p of pipes) {
    const topH = p.gapCenter - PIPE_GAP / 2;
    const botY = p.gapCenter + PIPE_GAP / 2;
    const botH = (WORLD_H - GROUND_H) - botY;

    // posts (tan)
    drawRopePost(p.x, 0,   PIPE_W, topH, true,  p.seed ^ 0xA1B2C3D4);
    drawRopePost(p.x, botY, PIPE_W, botH, false, p.seed ^ 0x1F2E3D4C);
    
    // yarn balls at the gap edges (SAFE positioning)
    const topR = Math.min(p.topR, PIPE_W * 0.48);
    const botR = Math.min(p.botR, PIPE_W * 0.48);

    const topBallX = p.x + PIPE_W / 2 + p.topDx;
    const topBallY = Math.max(topR + 10, topH - topR - 6);

    const botBallX = p.x + PIPE_W / 2 + p.botDx;
    const botBallY = Math.min(WORLD_H - GROUND_H - botR - 10, botY + botR + 6);
    // strings start exactly at the post ends
    // start string from the RIGHT EDGE of the post
    const postRight = p.x + PIPE_W;

    drawString(postRight, topH, topBallX, topBallY);
    drawString(postRight, botY, botBallX, botBallY);

    ctx.fillStyle = "#8b6a3f";
    ctx.beginPath();
    ctx.arc(postRight, topH, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(postRight, botY, 3, 0, Math.PI * 2);
    ctx.fill();

    drawYarnBall(topBallX, topBallY, topR, p.topColor);
    drawYarnBall(botBallX, botBallY, botR, p.botColor);
  }
}

function drawGround() {
  ctx.fillStyle = "#0a0f1c";
  ctx.fillRect(0, WORLD_H - GROUND_H, WORLD_W, GROUND_H);

  // pawprints
  ctx.globalAlpha = 0.18;
  for (let x = 0; x < WORLD_W + 40; x += 60) {
    const px = x - (t * 1.2) % 60;
    const py = WORLD_H - GROUND_H / 2 + ((x / 60) % 2) * 8;
    drawPaw(px, py, 1.0);
  }
  ctx.globalAlpha = 1;
}

function drawPaw(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "#cfe3ff";
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [[-12, -2], [-4, -8], [4, -8], [12, -2]];
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx, ty, 4.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMouse() {
  ctx.save();
  ctx.translate(mouse.x, mouse.y);

  // tiny tilt based on vertical speed
  const tilt = Math.max(-0.35, Math.min(0.35, mouse.vy * 0.06));
  ctx.rotate(tilt);

  // body
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#c9c2b6";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = "#d6cec1";
  ctx.beginPath();
  ctx.ellipse(8, -2, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.fillStyle = "#d6cec1";
  ctx.beginPath(); ctx.ellipse(5.5, -7, 2.5, 3, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10.5, -7, 2.5, 3,  0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,170,190,0.85)";
  ctx.beginPath(); ctx.ellipse(5.5, -7, 1.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10.5, -7, 1.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();

  // eye
  ctx.fillStyle = "#0b1020";
  ctx.beginPath();
  ctx.arc(10, -2, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "rgba(255,120,160,0.95)";
  ctx.beginPath();
  ctx.arc(14, -1, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // whisker
  ctx.strokeStyle = "rgba(30,30,30,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(18, -2);
  ctx.stroke();

  // tail
  ctx.strokeStyle = "#c9c2b6";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(-16, -2, -14, -10);
  ctx.stroke();

  ctx.restore();
}

function drawCat() {
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.rot);

  // body
  ctx.fillStyle = catStyle.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.fillStyle = catStyle.ear;
  ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-18, -22); ctx.lineTo(-2, -18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -10);  ctx.lineTo(18, -22);  ctx.lineTo(2, -18);  ctx.closePath(); ctx.fill();

  // stripes
  ctx.strokeStyle = catStyle.stripe;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
  ctx.moveTo(-7, 2);  ctx.lineTo(7, 2);
  ctx.stroke();

  // eyes
  ctx.fillStyle = "#0b1020";
  ctx.beginPath(); ctx.arc(-6, -2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -2, 2.2, 0, Math.PI * 2); ctx.fill();

  // whiskers
  ctx.strokeStyle = "rgba(11,16,32,0.55)";
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(8 * s, 4); ctx.lineTo(20 * s, 1);
    ctx.moveTo(8 * s, 6); ctx.lineTo(20 * s, 6);
    ctx.stroke();
  }

  // tail
  ctx.strokeStyle = catStyle.ear;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.quadraticCurveTo(-34, 0, -30, -10);
  ctx.stroke();

  ctx.restore();
}

function drawSparkles() {
  // ensure we start clean even if previous draw changed alpha
  ctx.globalAlpha = 1;

  for (const sp of sparkles) {
    ctx.globalAlpha = Math.max(0, sp.life / 30);
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐟", sp.x, sp.y);
  }

  // IMPORTANT: always reset after loop (even if sparkles is empty)
  ctx.globalAlpha = 1;
}

function drawUI() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "800 44px system-ui";
  ctx.fillStyle = "rgba(231,238,252,0.92)";
  ctx.fillText(`🐟 ${score}`, WORLD_W / 2, 84);

  if (!started && !gameOver) {
    ctx.font = "800 34px system-ui";
    ctx.fillText("FLAPURR!", WORLD_W / 2, WORLD_H / 2 - 40);
    ctx.font = "600 16px system-ui";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Tap to flap", WORLD_W / 2, WORLD_H / 2 + 4);
    ctx.fillText("Pass yarn balls to collect treats 🐟", WORLD_W / 2, WORLD_H / 2 + 28);
    ctx.globalAlpha = 1;
  }
}

// ---------- Loop ----------
function update() {
  t++;

  if (started && !gameOver) {
    cat.vy += GRAVITY;
    cat.y += cat.vy;
    cat.rot = Math.max(-0.55, Math.min(1.0, cat.vy / 12));

// --- mouse chase motion (springy but never catchable) ---
const targetX = cat.x + cat.r * MOUSE_LEAD;
const targetY = cat.y + MOUSE_YOFF + Math.sin(t * 0.12) * 2;

// simple spring + damping
mouse.vx += (targetX - mouse.x) * 0.18;
mouse.vy += (targetY - mouse.y) * 0.18;
mouse.vx *= 0.72;
mouse.vy *= 0.72;
mouse.x += mouse.vx;
mouse.y += mouse.vy;

// clamp so mouse stays within front half of the cat hitbox (doesn't affect collisions)
const minX = cat.x + cat.r * 0.35;
const maxX = cat.x + cat.r * 0.90;
mouse.x = Math.max(minX, Math.min(maxX, mouse.x));

    for (const p of pipes) p.x -= PIPE_SPEED;

    if (pipes.length && pipes[0].x + PIPE_W < -20) {
      pipes.shift();
      const lastX = pipes[pipes.length - 1].x;
      addPipe(lastX + PIPE_SPACING);
    }

    // scoring (treats)
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < cat.x - cat.r) {
        p.passed = true;
        score += 1;
        statusEl.textContent = `Playing • Treats: ${score} • Best: ${best}`;
        beep(740, 0.05, "triangle", 0.03);

        for (let i = 0; i < 10; i++) {
          sparkles.push({
            x: cat.x + 10,
            y: cat.y,
            vx: (rand() - 0.5) * 2.4,
            vy: (rand() - 0.5) * 2.4,
            life: 30
          });
        }
      }
    }

    if (cat.y - cat.r < 0) { cat.y = cat.r; cat.vy = 0; }
    if (cat.y + cat.r > WORLD_H - GROUND_H) setGameOver();

    for (const p of pipes) {
      const topH = p.gapCenter - PIPE_GAP / 2;
      const botY = p.gapCenter + PIPE_GAP / 2;
      const botH = (WORLD_H - GROUND_H) - botY;

      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, 0, PIPE_W, topH)) setGameOver();
      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, botY, PIPE_W, botH)) setGameOver();
    }
  }

  // sparkles
  sparkles = sparkles.filter(sp => sp.life > 0);
  for (const sp of sparkles) {
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.04;
    sp.life -= 1;
  }

// draw (bulletproof state reset)
ctx.save();
ctx.globalAlpha = 1;
ctx.globalCompositeOperation = "source-over";
ctx.filter = "none";
ctx.shadowBlur = 0;
ctx.shadowColor = "transparent";
ctx.setLineDash([]);

drawBG();

ctx.globalAlpha = 1;
drawPipes();

ctx.globalAlpha = 1;
drawGround();

ctx.globalAlpha = 1;
drawSparkles();

ctx.globalAlpha = 1;
drawCat();
drawMouse(); // draw after cat so it’s “in front” (cat chasing)

ctx.globalAlpha = 1;
drawUI();
ctx.restore();


  requestAnimationFrame(update);
}

// ---------- Start ----------
reset();
update();
setNet("Connecting to cat HQ…");
initFirebase();