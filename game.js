// game.js (ES module) — Flapurr!
// Cat-themed flappy game + Firebase Firestore leaderboard + total plays.
//
// Requires <script type="module" src="game.js"></script> in index.html

// --- DEBUG OVERLAY (remove later) ---
const __dbg = document.createElement("div");
__dbg.style.cssText =
  "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;" +
  "background:rgba(0,0,0,.85);color:#fff;padding:10px 12px;border-radius:12px;" +
  "font:12px/1.35 system-ui;white-space:pre-wrap;max-height:40vh;overflow:auto;";
__dbg.textContent = "Flapurr debug: loading…";
window.addEventListener("error", (e) => {
  __dbg.textContent = "JS ERROR:\n" + (e?.message || e) + "\n" + (e?.filename || "") + ":" + (e?.lineno || "");
  document.body.appendChild(__dbg);
});
window.addEventListener("unhandledrejection", (e) => {
  __dbg.textContent = "PROMISE ERROR:\n" + (e?.reason?.message || e?.reason || e);
  document.body.appendChild(__dbg);
});
setTimeout(() => {
  document.body.appendChild(__dbg);
  __dbg.textContent = "Flapurr debug: script reached runtime ✅";
}, 600);


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

// ---------- Firebase config (yours) ----------
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

// ---------- Firebase init ----------
let db = null;

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    netStatus.textContent = "Connected to cat HQ ✅";

    await incrementPlays();
    await refreshLeaderboard();
  } catch (e) {
    console.error(e);
    netStatus.textContent = "Couldn’t connect to Firebase (leaderboard disabled).";
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

// ---------- Modal UI ----------
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

// Tap outside card closes modal (nice on mobile)
modal.addEventListener("pointerdown", (e) => {
  if (e.target === modal) closeModal();
});

// ---------- Mobile-friendly canvas scaling ----------
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

// Fullscreen (best on Android/desktop; iOS Safari may ignore)
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

// ---------- Game state ----------
let started = false;
let gameOver = false;
let score = 0;
let best = Number(localStorage.getItem("flapurr_best") || 0);

const cat = { x: 120, y: WORLD_H * 0.45, r: 18, vy: 0, rot: 0 };
const CAT_PALETTES = [
  { body: "#ffd6a6", ear: "#ffbf80", stripe: "rgba(120,60,20,0.35)" }, // ginger
  { body: "#cfcfd6", ear: "#b9b9c2", stripe: "rgba(50,50,60,0.28)" },   // gray
  { body: "#2b2b2f", ear: "#3a3a40", stripe: "rgba(255,255,255,0.10)" }, // black
  { body: "#fff2d7", ear: "#f0d9b2", stripe: "rgba(120,90,40,0.22)" },  // cream
  { body: "#b07a4a", ear: "#9a6a40", stripe: "rgba(40,20,10,0.25)" },   // brown
];
let catStyle = CAT_PALETTES[Math.floor(Math.random() * CAT_PALETTES.length)];
let pipes = [];
let t = 0;

// Sparkles = “treat crumbs”
let sparkles = []; // {x,y,vx,vy,life}

// ---------- Audio (tiny synth meows; no files) ----------
let audioCtx = null;

function beep(freq, dur = 0.06, type = "triangle", gain = 0.04) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    // iOS requires user gesture to start; pointerdown triggers flap() which calls beep()
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
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

  pipes.push({ x, gapCenter, passed: false });
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

  statusEl.textContent = `Game Over • Score: ${score} • Best: ${best} • Tap to restart`;
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

// ---------- Input ----------
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  // If game over: close modal and restart quickly
  if (gameOver) {
    closeModal();
    reset();
    started = true;
  }

  flap();
}, { passive: false });

// Desktop keyboard support
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

  // floating “cat” clouds
  for (let i = 0; i < 6; i++) {
  const x = ((t * 0.45) + i * 140) % (WORLD_W + 200) - 100;
  const y = 80 + (i * 57) % 240;
  const s = 0.6 + (i % 3) * 0.12;
  drawSkyCat(x, y, s, i);
}
  }
  function drawSkyCat(x, y, s, i) {
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

}

function drawFishCloud(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#a9c7ff";

  // body
  roundRect(-22, -10, 64, 26, 12);
  ctx.fill();

  // tail
  ctx.beginPath();
  ctx.moveTo(42, 3);
  ctx.lineTo(58, -6);
  ctx.lineTo(58, 12);
  ctx.closePath();
  ctx.fill();

  // eye
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#0b1020";
  ctx.beginPath();
  ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPipes() {
  for (const p of pipes) {
    const topH = p.gapCenter - PIPE_GAP / 2;
    const botY = p.gapCenter + PIPE_GAP / 2;
    const botH = (WORLD_H - GROUND_H) - botY;

    // “Scratch post” style
    const pg = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    pg.addColorStop(0, "#cfa77a");
    pg.addColorStop(1, "#b48a5c");
    ctx.fillStyle = pg;

    roundRect(p.x, 0, PIPE_W, topH, 12); ctx.fill();
    roundRect(p.x, botY, PIPE_W, botH, 12); ctx.fill();

    // scratches
    ctx.strokeStyle = "rgba(40,20,10,0.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const sx = p.x + 12 + i * 9;

      ctx.beginPath();
      ctx.moveTo(sx, 12);
      ctx.lineTo(sx + 6, topH - 18);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx, botY + 18);
      ctx.lineTo(sx + 6, botY + botH - 18);
      ctx.stroke();
    }
  }
}

function drawGround() {
  ctx.fillStyle = "#0a0f1c";
  ctx.fillRect(0, WORLD_H - GROUND_H, WORLD_W, GROUND_H);

  // pawprint pattern
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

function drawCat() {
  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.rot);

  // body
  ctx.fillStyle = catStyle.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.fillStyle = catStyle.ear;
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(-18, -22);
  ctx.lineTo(-2, -18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -10);
  ctx.lineTo(18, -22);
  ctx.lineTo(2, -18);
  ctx.closePath();
  ctx.fill();

  // stripes
  ctx.strokeStyle = catStyle.stripe;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
  ctx.moveTo(-7, 2); ctx.lineTo(7, 2);
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
    ctx.moveTo(8 * s, 4);  ctx.lineTo(20 * s, 1);
    ctx.moveTo(8 * s, 6);  ctx.lineTo(20 * s, 6);
    ctx.stroke();
  }

  // tail
  ctx.strokeStyle = "#ffbf80";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.quadraticCurveTo(-34, 0, -30, -10);
  ctx.stroke();

  ctx.restore();
}

function drawSparkles() {
  for (const sp of sparkles) {
    ctx.globalAlpha = Math.max(0, sp.life / 30);
    ctx.fillStyle = "#ffd36e";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawUI() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // score big
  ctx.font = "800 48px system-ui";
  ctx.fillStyle = "rgba(231,238,252,0.92)";
  ctx.fillText(String(score), WORLD_W / 2, 84);

  if (!started && !gameOver) {
    ctx.font = "800 34px system-ui";
    ctx.fillText("FLAPURR!", WORLD_W / 2, WORLD_H / 2 - 40);
    ctx.font = "600 16px system-ui";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Tap to flap", WORLD_W / 2, WORLD_H / 2 + 4);
    ctx.fillText("Pass scratch posts to earn treats 🐟", WORLD_W / 2, WORLD_H / 2 + 28);
    ctx.globalAlpha = 1;
  }
}

// ---------- Game loop ----------
function update() {
  t++;

  if (started && !gameOver) {
    // physics
    cat.vy += GRAVITY;
    cat.y += cat.vy;

    // rotation
    cat.rot = Math.max(-0.55, Math.min(1.0, cat.vy / 12));

    // move pipes
    for (const p of pipes) p.x -= PIPE_SPEED;

    // recycle pipes
    if (pipes.length && pipes[0].x + PIPE_W < -20) {
      pipes.shift();
      const lastX = pipes[pipes.length - 1].x;
      addPipe(lastX + PIPE_SPACING);
    }

    // scoring
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < cat.x - cat.r) {
        p.passed = true;
        score += 1;
        statusEl.textContent = `Playing • Score: ${score} • Best: ${best}`;
        beep(740, 0.05, "triangle", 0.03);

        // sparkle burst
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

    // boundaries
    if (cat.y - cat.r < 0) {
      cat.y = cat.r;
      cat.vy = 0;
    }
    if (cat.y + cat.r > WORLD_H - GROUND_H) setGameOver();

    // collisions
    for (const p of pipes) {
      const topH = p.gapCenter - PIPE_GAP / 2;
      const botY = p.gapCenter + PIPE_GAP / 2;
      const botH = (WORLD_H - GROUND_H) - botY;

      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, 0, PIPE_W, topH)) setGameOver();
      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, botY, PIPE_W, botH)) setGameOver();
    }
  }

  // update sparkles
  sparkles = sparkles.filter(sp => sp.life > 0);
  for (const sp of sparkles) {
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.04;
    sp.life -= 1;
  }

  // draw
  drawBG();
  drawPipes();
  drawGround();
  drawSparkles();
  drawCat();
  drawUI();

  requestAnimationFrame(update);
}

// ---------- Start ----------
reset();
update();
initFirebase();