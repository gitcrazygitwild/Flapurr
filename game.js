// game.js (ES module) — Flapurr!
// Firebase Firestore leaderboard + total plays + name entry modal
// House cats, cosmetic skies, yarn gates, and local crew progress

import { WORLD, fitViewport, rulesFor, circleRectCollide, fixedStepper, MILESTONES, medalFor, readFlightLog, recordFlight, resultText, continueAllowed, reviveShift } from './game-core.js?v=5';
import { createAdProvider } from './ads.js?v=1';
import { drawBackdrop, drawGroundArt, drawCatTree, drawGoldFish } from './scenery.js?v=1';
import { readFish, availableHat, unlockedBetween, fishSpawn, fishCaught, drawHat } from './wardrobe.js?v=1';
import { readCrewProgress, recordCrewFlight, stampCount, availableSky, isCleanPass, flightAdvice } from './crew-progress.js';
import { catAvatar, renderCrew, renderWardrobe } from './crew-ui.js?v=2';
import { challengeDay, daySeed, courseRandom, HOUSE_CATS, dailyBestKey } from './challenge.js?v=2';
let initializeApp, getFirestore, collection, addDoc, query, orderBy, limit, getDocs, doc, runTransaction, serverTimestamp;
const preview = new URLSearchParams(location.search).get('demo') === '1';
const readSetting = key => { try { return localStorage.getItem(key); } catch { return null; } };
const saveSetting = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
let mode = 'classic', runDay = challengeDay(), paused = false, muted = readSetting('flapurr_muted') === '1';
let nextCourse = courseRandom(Math.random() * 4294967296);
const bestKey = () => mode === 'daily' ? dailyBestKey(runDay) : mode === 'practice' ? 'flapurr_practice_best' : 'flapurr_best';
let selectedPilot=readSetting('flapurr_pilot') || 'random', flightLog=readFlightLog(readSetting('flapurr_flights_v1')), lastResult=null, milestone=null;
let crewProgress = readCrewProgress(readSetting('flapurr_crew_v1'), flightLog.recent);
saveSetting('flapurr_crew_v1', JSON.stringify(crewProgress));
let sky = availableSky(readSetting('flapurr_sky'), crewProgress);
let flightStats = { frames: 0, clean: 0, streak: 0, bestStreak: 0 }, flightCallout = null;
let currentRules=rulesFor(mode);
const stepper=fixedStepper();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

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
// Keep score entry visible inside native game fullscreen.
document.querySelector(".stage").append(document.getElementById('runResult'),modal);
const finalScoreEl = document.getElementById("finalScore");
const nameInput = document.getElementById("name");
const submitBtn = document.getElementById("submit");
const skipBtn = document.getElementById("skip");
const submitStatus = document.getElementById("submitStatus");

const setNet = (m) => { if (netStatus) netStatus.textContent = m; };



// ---------- Firebase ----------
let db = null;

async function initFirebase() {
  if (preview) { setNet('Preview · online scores are disabled.'); boardEl.innerHTML = '<li class="board-empty">Your local adventures still count.</li>'; document.getElementById('refreshBoard').disabled = true; return; }
  try {
    const [appSdk, firestoreSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js')
    ]);
    ({initializeApp} = appSdk);
    ({getFirestore,collection,addDoc,query,orderBy,limit,getDocs,doc,runTransaction,serverTimestamp} = firestoreSdk);
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    setNet("Connected to cat HQ ✅");

    // A blocked visit counter must not prevent reading the leaderboard.
    const results = await Promise.allSettled([incrementPlays(), refreshLeaderboard()]);
    if (results[1].status === 'rejected') {
      boardEl.innerHTML = '<li class="board-empty">Top Cats is unavailable right now.</li>';
      setNet('You can keep flying. Refresh the board to reconnect.');
    } else setNet(results[0].status === 'rejected' ? 'Top Cats is up to date. Visit count unavailable.' : 'Top Cats is up to date.');
  } catch (e) {
    console.error(e);
    setNet("Cat HQ is taking a break. You can still play; online scores are unavailable.");
    boardEl.innerHTML = '<li class="board-empty">The crew is still cleared for takeoff.</li>';
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
  const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
  const snap = await getDocs(q);

  boardEl.replaceChildren();
  if (snap.empty) {
    boardEl.innerHTML = "<li>No scores yet. Be the first cat!</li>";
    return;
  }

  snap.forEach((d) => {
    const data = d.data() || {};
    const safeName = String(data.name || "Anonymous").slice(0, 16);
    const safeScore = Math.max(0, Math.min(9999, Math.floor(Number(data.score || 0))));
    const li = document.createElement("li");
    const rank = document.createElement('span'); rank.className = 'board-rank'; rank.textContent = String(boardEl.children.length + 1).padStart(2, '0');
    const name = document.createElement('span'); name.textContent = safeName;
    const score = document.createElement('strong'); score.textContent = String(Number.isFinite(safeScore) ? safeScore : 0);
    li.append(rank, name, score);
    boardEl.appendChild(li);
  });
}

async function submitScore(name, score) {
  if (!db || mode !== "classic") return { ok: false, msg: "Online scores are available in Classic when connected." };

  const cleanName = String(name || "").trim().slice(0, 16);
  if (cleanName.length < 1) return { ok: false, msg: "Name required (1–16 chars)." };

  const cleanScore = Math.max(0, Math.min(9999, Math.floor(Number(score || 0))));

  await addDoc(collection(db, "scores"), {
    name: cleanName,
    score: cleanScore,
    createdAt: serverTimestamp()
  });

  // A successful write stays successful even if the subsequent read fails.
  await refreshLeaderboard().catch(() => setNet('Your score was saved. Refresh Top Cats to see the latest board.'));
  return { ok: true, msg: "Submitted! 🐾" };
}

// ---------- Modal ----------
document.getElementById('refreshBoard').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  try { if (!db) await initFirebase(); else { await refreshLeaderboard(); setNet('Top Cats is up to date.'); } }
  catch { setNet('Could not refresh Top Cats. Your local game is ready.'); }
  finally { button.disabled = preview; }
});

let lastGameScore = 0;
let modalReturnFocus = null;

function openModal(score) {
  modalReturnFocus = document.activeElement;
  lastGameScore = score;
  finalScoreEl.textContent = String(score);
  submitStatus.textContent = "";
  submitBtn.disabled=!!(lastResult?.submitted || lastResult?.submitting);

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  nameInput.value = readSetting("flapurr_name") || "";
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus({preventScroll:true});
  modalReturnFocus = null;
}

submitBtn.addEventListener("click", async () => {
  const result = lastResult;
  if (submitBtn.disabled || !result || result.submitted || result.submitting) return;
  result.submitting = true;
  submitBtn.disabled = true;
  const name = nameInput.value;
  saveSetting("flapurr_name", name.trim().slice(0, 16));
  try {
    const response = await submitScore(name, result.score);
    if (response.ok) result.submitted = true;
    if (lastResult === result) {
      submitStatus.textContent = response.msg;
      document.getElementById('shareScore').disabled = !!result.submitted;
      if (response.ok) setTimeout(() => {
        if (lastResult === result && modal.classList.contains('show')) { closeModal(); canvas.focus({preventScroll:true}); }
      }, 700);
    }
  } catch (error) {
    console.error(error);
    if (lastResult === result) submitStatus.textContent = "Could not submit your score. Please try again shortly.";
  } finally {
    result.submitting = false;
    if (lastResult === result) submitBtn.disabled = !!result.submitted;
  }
});

skipBtn.addEventListener("click", () => closeModal());


// ---------- Canvas scaling ----------
const WORLD_W = WORLD.width;
const WORLD_H = WORLD.height;

let scale = 1, offsetX = 0, offsetY = 0;

function resizeCanvasToCSS() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  const viewport=fitViewport(cssW,cssH,window.devicePixelRatio || 1);
  const dpr=viewport.dpr;
  canvas.width=viewport.width;canvas.height=viewport.height;
  scale=viewport.scale;offsetX=viewport.x;offsetY=viewport.y;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
}

resizeCanvasToCSS();
window.addEventListener("resize", resizeCanvasToCSS);
window.addEventListener("orientationchange", resizeCanvasToCSS);
new ResizeObserver(resizeCanvasToCSS).observe(canvas);

fsBtn?.addEventListener("click", async () => {
  try {
    const el = document.querySelector(".stage");
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
    setTimeout(resizeCanvasToCSS, 60);
  } catch (_) {}
});

// ---------- Game constants ----------
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
let catStyle = HOUSE_CATS[0];
let catStripeMode = 0; // 0 none, 1 heavy bands, 2 tabby, 3 mixed

// ---------- State ----------
let started = false;
let gameOver = false;
// Continue (rewarded ad): one per Classic run. `crashSnapshot` undoes the crash's
// bookkeeping if the run continues, so a run is counted once, when it truly ends.
const ads = createAdProvider();
let continueUsed = false, invulnerable = 0, crashSnapshot = null, offerToken = 0;
// Scenery scroll, resume countdown (ms), golden fish and the chosen hat. All cosmetic.
let worldScroll = 0, resumeLeft = 0, crashFall = false;
let fishJar = readFish(readSetting('flapurr_fish_v1')), runFish = 0, jarAtStart = fishJar, hat = availableHat(readSetting('flapurr_hat'), fishJar);
let score = 0; // displayed as treats
let best = Number(readSetting("flapurr_best") || 0);

const cat = { x: 120, y: WORLD_H * 0.45, r: 18, vy: 0, rot: 0 };
// The mouse is decorative and never changes the cat’s collision radius.
const mouse = { x: cat.x, y: cat.y, vx: 0, vy: 0 };

const MOUSE_ANCHOR = 0.72;   // stays within cat hitbox (logic position)
const MOUSE_YOFF   = 6;

const MOUSE_GAP    = 18;     // <-- daylight between cat + mouse (tune 12–26)
const MOUSE_DRAW_AHEAD = 12; // extra forward bias based on cat speed
let pipes = [];
let t = 0;
let lastTime = 0;
let time60 = 0; // accumulates "frames at 60fps"
const MOUSE_COLORS = ["#c9c2b6", "#b7b1a7", "#9c8f86", "#d1c7b8", "#8a7c73"];
let mouseColor = MOUSE_COLORS[0];

// Treat “sparkles”
let sparkles = []; // {x,y,vx,vy,life}

// ---------- Tiny synth sounds ----------
let audioCtx = null;
function beep(freq, dur = 0.06, type = "triangle", gain = 0.04) {
  if (muted) return;
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

function hiss(dur = 0.20, gainValue = 0.08) {
  if (muted) return;
  try {

    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();

    const length = Math.floor(audioCtx.sampleRate * dur);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.9;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);

    source.connect(gain);
    gain.connect(audioCtx.destination);

    source.start();
    source.stop(audioCtx.currentTime + dur);
  } catch (e) {
    console.error("hiss failed", e);
  }
}


// ---------- Helpers ----------
function reset() {
  paused = false;
  currentRules=rulesFor(mode);stepper.reset();milestone=null;
  flightStats = {frames:0,clean:0,streak:0,bestStreak:0}; flightCallout = null;
  document.getElementById('runResult').hidden=true;
  document.getElementById('resultCopyFallback').hidden=true;
  runDay = challengeDay();
  nextCourse = courseRandom(mode === 'daily' ? daySeed(runDay) : Math.random() * 4294967296);
  best = Number(readSetting(bestKey()) || 0);
  document.getElementById('pauseOverlay').hidden = true;
  document.getElementById('dailyResult').textContent = '';
  started = false;
  gameOver = false;
  continueUsed = false; invulnerable = 0; crashSnapshot = null; offerToken++; hideContinue();
  resumeLeft = 0; crashFall = false; runFish = 0; jarAtStart = fishJar;
  score = 0;
  t = 0;
  lastTime=0;
  time60=0;
  sparkles = [];
mouseColor = MOUSE_COLORS[Math.floor(rand() * MOUSE_COLORS.length)];
  catStyle = mode === 'daily' ? HOUSE_CATS[daySeed(runDay) % HOUSE_CATS.length] : HOUSE_CATS.find(cat => cat.name === selectedPilot) || HOUSE_CATS[Math.floor(Math.random() * HOUSE_CATS.length)];
  catStripeMode = 2;
  cat.y = WORLD_H * 0.45;
  cat.vy = 0;
  cat.rot = 0;

  mouse.x = cat.x + cat.r * MOUSE_ANCHOR; // anchor starts in front-half of cat
  mouse.y = cat.y + MOUSE_YOFF;
  mouse.vx = 0;
  mouse.vy = 0;

  pipes = [];
  for (let i = 0; i < 4; i++) addPipe(WORLD_W + 200 + i * PIPE_SPACING);

  statusEl.textContent = `Ready • ${mode === "daily" ? "Daily best" : "Best"}: ${best}`;
  updateControls();
}

function addPipe(x) {
  const marginTop = 70;
  const marginBottom = GROUND_H + 70;
  const centerMin = marginTop + currentRules.gap / 2;
  const centerMax = WORLD_H - marginBottom - currentRules.gap / 2;
  const gapCenter = centerMin + nextCourse() * (centerMax - centerMin);
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
  // A golden fish sometimes floats behind the post (cosmetic RNG; never the course).
  fish: fishSpawn(rand(), rand(), gapCenter, { postWidth:PIPE_W, spacing:PIPE_SPACING, top:70, bottom:WORLD_H - GROUND_H - 70 }),
});
}

function flap() {
  if (paused || gameOver || resumeLeft > 0 || modal.classList.contains("show")) return;
  if (!started) { started = true; updateControls(); }
  cat.vy = currentRules.flapVelocity;
  beep(520, 0.04, "square", 0.03);
}

function setGameOver(reason = '') {
  if (gameOver) return;
  gameOver = true;
  crashSnapshot = { best, flightLog, crewProgress };
  if (!reducedMotion.matches) {
    crashFall = true; if (reason !== 'ground') cat.vy = -4.5;
    for (let i = 0; i < 9; i++) sparkles.push({ x:cat.x, y:cat.y, vx:(rand() - 0.5) * 4.5, vy:(rand() - 0.7) * 4, life:26, kind:'puff', color:catStyle.body });
  }
  const newBest = score > best, beforeStamps = stampCount(crewProgress);
  hiss(0.14, 0.02);

  if (score > best) {
    best = score;
    saveSetting(bestKey(), String(best));
  }

  statusEl.textContent = `Game Over • Treats: ${score} • Best: ${best} • Tap to restart`;
  lastResult={score,mode,cat:catStyle.name,day:runDay,continued:continueUsed};
  crewProgress = recordCrewFlight(crewProgress, lastResult);
  saveSetting('flapurr_crew_v1', JSON.stringify(crewProgress));
  updateCrew();
  flightLog=recordFlight(flightLog,lastResult);saveSetting('flapurr_flights_v1',JSON.stringify(flightLog));renderFlightLog();
  const medal=medalFor(score);
  document.getElementById('runResult').hidden=false;
  document.getElementById('resultMedal').textContent=medal.icon;
  document.getElementById('resultTitle').textContent=newBest ? 'A new personal best!' : medal.name;
  document.getElementById('resultSummary').textContent=`${lastResult.cat} collected ${score} treats. ${mode==='daily'?'Today’s':mode==='practice'?'Practice':'Classic'} best: ${best}. Press Space to fly again.`;
  document.getElementById('resultStats').textContent = `${Math.floor(flightStats.frames / 60)}s airborne · ${flightStats.clean} clean passes · best streak ${flightStats.bestStreak}`;
  document.getElementById('flightAdvice').textContent = flightAdvice(reason, score);
  const gained = stampCount(crewProgress) - beforeStamps;
  document.getElementById('crewReward').textContent = gained ? `✦ ${gained} new crew stamp${gained === 1 ? '' : 's'}! ${stampCount(crewProgress) >= 6 && beforeStamps < 6 ? 'Catnip aurora unlocked.' : stampCount(crewProgress) >= 3 && beforeStamps < 3 ? 'Peach sunset unlocked.' : 'A little closer to your next sky.'}` : '';
  const newHats = unlockedBetween(jarAtStart, fishJar);
  document.getElementById('fishReward').textContent = runFish ? `🐠 +${runFish} golden fish · ${fishJar} in the jar.${newHats.length ? ` New for the hat rack: ${newHats.map(item => item.name).join(', ')}!` : ''}` : '';
  document.getElementById('resultStatus').textContent='';
  document.getElementById('shareScore').hidden=mode!=='classic' || preview || continueUsed;
  document.getElementById('shareScore').disabled=false;
  document.getElementById('continueNote').textContent = continueUsed && mode === 'classic' ? 'Continued runs stay off Top Cats, so the board stays fair.' : '';
  updateControls();
  offerContinue();
}
// ---------- Continue after a crash ----------
function hideContinue() { const button = document.getElementById('continueRun'); if (button) { button.hidden = true; button.disabled = false; } }
async function offerContinue() {
  if (!continueAllowed({ mode, used:continueUsed, score })) return;
  const token = ++offerToken, show = await ads.offer().catch(() => null);
  if (!show || token !== offerToken || !gameOver) return;
  const button = document.getElementById('continueRun');
  button.hidden = false; button.disabled = false;
  button.onclick = async () => {
    if (token !== offerToken || !gameOver) return;
    button.disabled = true; const wasMuted = muted; muted = true;
    const result = await show().catch(() => 'unavailable');
    muted = wasMuted;
    if (token !== offerToken || !gameOver) return;
    if (result === 'rewarded') revive();
    else { hideContinue(); document.getElementById('resultStatus').textContent = result === 'dismissed' ? 'No problem. Fly again whenever you’re ready.' : 'No ad was available this time.'; }
  };
}
function revive() {
  // Undo the crash's bookkeeping; the run is recorded once, when it really ends.
  if (crashSnapshot) {
    ({ best, flightLog, crewProgress } = crashSnapshot); crashSnapshot = null;
    saveSetting(bestKey(), String(best)); saveSetting('flapurr_flights_v1', JSON.stringify(flightLog)); saveSetting('flapurr_crew_v1', JSON.stringify(crewProgress));
    renderFlightLog(); updateCrew();
  }
  const shift = reviveShift(pipes.map(p => p.x), cat.x, cat.r, PIPE_W);
  for (const p of pipes) p.x += shift;
  const next = pipes.find(p => p.x + PIPE_W >= cat.x - cat.r);
  cat.y = next ? next.gapCenter : WORLD_H * 0.45; cat.vy = 0; cat.rot = 0;
  mouse.x = cat.x + cat.r * MOUSE_ANCHOR; mouse.y = cat.y + MOUSE_YOFF; mouse.vx = 0; mouse.vy = 0;
  continueUsed = true; invulnerable = 75; offerToken++; crashFall = false;
  gameOver = false; started = false; // hover until the next flap
  hideContinue();
  document.getElementById('runResult').hidden = true;
  statusEl.textContent = `Back in the air • Treats: ${score} • Tap or Space to fly`;
  updateControls(); canvas.focus({ preventScroll:true });
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
  ctx.save();

  // flatter base (very subtle shading)
  const g = ctx.createRadialGradient(cx - r*0.15, cy - r*0.15, r*0.2, cx, cy, r);
  g.addColorStop(0, shade(base, +0.06));
  g.addColorStop(1, shade(base, -0.10));

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // lots of thin yarn wraps (two tones)
  ctx.lineCap = "round";
  const dark = shade(base, -0.18);
  const light = shade(base, +0.10);

  // “wrap bands” (curved, slightly irregular)
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const rr = r * (0.30 + t * 0.68);

    const a = t * Math.PI * 1.6;
    const span = Math.PI * (0.75 + 0.20 * Math.sin(i * 1.7));

    // dark strand
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1.1, r * 0.055);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, a, a + span);
    ctx.stroke();

    // light highlight strand slightly offset
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = Math.max(1.0, r * 0.045);
    ctx.beginPath();
    ctx.arc(cx + 0.6, cy - 0.6, rr, a + 0.10, a + span + 0.10);
    ctx.stroke();
  }

  // fuzzy fibers (tiny random dashes around edges)
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    const px = cx + Math.cos(ang) * (r * 0.92);
    const py = cy + Math.sin(ang) * (r * 0.92);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang) * 2.6, py + Math.sin(ang) * 2.6);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawString(fromX, fromY, toX, toY) {
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo((fromX + toX) / 2, (fromY + toY) / 2 + 12, toX, toY);
  ctx.stroke();
}

// ---------- Input and play controls ----------
function updateControls() {
  const pause = document.getElementById('pause');
  pause.disabled = !started || gameOver;
  pause.textContent = paused ? 'Resume' : 'Pause';
  pause.setAttribute('aria-pressed', String(paused));
  document.getElementById('sound').textContent = muted ? 'Sound off' : 'Sound on';
  document.getElementById('sound').setAttribute('aria-pressed', String(muted));
  document.getElementById('sound').setAttribute('aria-label', muted ? 'Enable game sounds' : 'Mute game sounds');
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  document.getElementById('challengeInfo').textContent = mode === 'daily'
    ? `${runDay} · Fly with ${HOUSE_CATS[daySeed(runDay) % 3].name} · Same course all day · Best: ${best}`
    : mode==='practice' ? 'Wider gaps, a gentler pace. Find your rhythm; Practice never posts to Top Cats.' : 'A fresh course every run. Collect treats and climb the Top Cats board.';
  const picker=document.getElementById('pilot');picker.disabled=mode==='daily';picker.value=mode==='daily'?catStyle.name:selectedPilot;
  document.getElementById('dailyNote').hidden = mode !== 'daily';
  document.getElementById('pilotAvatar').innerHTML = catAvatar(catStyle.name);
  document.getElementById('pilotName').textContent = catStyle.name;
  document.getElementById('pilotDescription').textContent = mode === 'daily' ? 'Today’s daily challenge pilot.' : catStyle.name === 'Hubert' ? 'Dark tabby. Golden eyes. Big plans.' : catStyle.name === 'Mack' ? 'Green eyes. Endless curiosity.' : 'Blue eyes. Head in the clouds.';
  updateHUD();
}
const RESUME_MS = 1800;
function setPaused(value) {
  if (!started || gameOver) return;
  paused = value; lastTime = 0;stepper.reset();
  resumeLeft = paused ? 0 : RESUME_MS; // 3-2-1 before the cat moves again
  document.getElementById('pauseOverlay').hidden = !paused;
  statusEl.textContent = paused ? 'Paused · your run is safe here' : 'Get ready…';
  updateControls();
  if (paused && document.visibilityState === 'visible') document.getElementById('resume').focus();
  else if (!paused) canvas.focus({preventScroll:true});
}
document.getElementById('pause').addEventListener('click', () => setPaused(!paused));
document.getElementById('resume').addEventListener('click', () => setPaused(false));
document.getElementById('restart').addEventListener('click', () => { closeModal(); reset(); canvas.focus({preventScroll:true}); });
document.getElementById('sound').addEventListener('click', () => { muted = !muted; saveSetting('flapurr_muted', muted ? '1' : '0'); updateControls();canvas.focus({preventScroll:true}); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') setPaused(true); });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  if (mode === button.dataset.mode) return;
  mode = button.dataset.mode; closeModal(); reset();canvas.focus({preventScroll:true});
}));
canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (paused) return;
  if (gameOver) { closeModal(); reset(); }
  canvas.focus({preventScroll:true}); flap();
}, {passive:false});
window.addEventListener('keydown', event => {
  if (modal.classList.contains('show')) {
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Enter' && event.target === nameInput) { event.preventDefault(); submitBtn.click(); }
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('input,button')].filter(item => !item.disabled), first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.code==='Space') {
    event.preventDefault();if(event.repeat)return;
    if(gameOver)reset();if(paused)setPaused(false);canvas.focus({preventScroll:true});flap();return;
  }
  if(event.repeat)return;
  if(event.key.toLowerCase()==='p' || event.key==='Escape'){event.preventDefault();setPaused(!paused);}
  if(event.key.toLowerCase()==='r'){event.preventDefault();closeModal();reset();canvas.focus({preventScroll:true});}
});
document.getElementById('pilot').addEventListener('change',event=>{selectedPilot=event.target.value;saveSetting('flapurr_pilot',selectedPilot);closeModal();reset();canvas.focus({preventScroll:true});});
document.getElementById('retry').addEventListener('click',()=>{reset();canvas.focus({preventScroll:true});flap();});
document.getElementById('shareScore').addEventListener('click',()=>{if(lastResult?.mode==='classic')openModal(lastResult.score);});
document.getElementById('copyResult').addEventListener('click',async()=>{
  if(!lastResult)return;
  const text=resultText(lastResult);
  try{await navigator.clipboard.writeText(text);document.getElementById('resultStatus').textContent='Copied. Send a little cat brag.';canvas.focus({preventScroll:true});}
  catch{const field=document.getElementById('resultCopyFallback');field.hidden=false;field.value=text;field.focus();field.select();document.getElementById('resultStatus').textContent='Select and copy this result.';}
});
function updateHUD() {
  document.getElementById('hudBest').textContent = Math.max(best, score);
  document.getElementById('hudClean').textContent = flightStats.clean;
  const next = MILESTONES.find(medal => medal.score > score);
  document.getElementById('hudNext').textContent = next ? `${next.score - score} treat${next.score - score === 1 ? '' : 's'}` : 'Legend ✦';
}
function updateCrew() {
  renderCrew(crewProgress, sky, id => { sky = availableSky(id, crewProgress); saveSetting('flapurr_sky', sky.id); updateCrew(); });
}
function renderHats() {
  hat = availableHat(hat.id, fishJar);
  renderWardrobe(fishJar, hat.id, id => { hat = availableHat(id, fishJar); saveSetting('flapurr_hat', hat.id); renderHats(); canvas.focus({preventScroll:true}); });
}
function renderFlightLog() {
  document.getElementById('flightTotals').textContent=`${flightLog.runs} flights · ${flightLog.treats} treats collected`;
  const list=document.getElementById('recentFlights');list.replaceChildren();
  for(const run of flightLog.recent){const row=document.createElement('li'),label=document.createElement('span'),score=document.createElement('strong');label.textContent=`${run.cat} · ${run.mode} · ${run.day}`;score.textContent=`${medalFor(run.score).icon} ${run.score}`;row.append(label,score);list.append(row);}
  if(!flightLog.recent.length){const row=document.createElement('li');row.textContent='Your next adventure starts the log.';list.append(row);}
}
document.addEventListener('fullscreenchange', resizeCanvasToCSS);

// ---------- Drawing ----------
function drawBG() {
  // Cosmetic sky palettes never affect the course or collision geometry.
  drawBackdrop(ctx, { sky, t, scroll:worldScroll, W:WORLD_W, H:WORLD_H, groundTop:WORLD_H - GROUND_H, still:reducedMotion.matches });
}

function drawPipes() {
  for (const p of pipes) {
    const topH = p.gapCenter - currentRules.gap / 2;
    const botY = p.gapCenter + currentRules.gap / 2;
    const botH = (WORLD_H - GROUND_H) - botY;

    // posts (tan)
    drawCatTree(ctx, { x:p.x, y:0, w:PIPE_W, h:topH, hanging:true, seed:p.seed ^ 0xA1B2C3D4, t });
    drawCatTree(ctx, { x:p.x, y:botY, w:PIPE_W, h:botH, hanging:false, seed:p.seed ^ 0x1F2E3D4C, t });
    
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
    if (p.fish && !p.fish.taken) drawGoldFish(ctx, p.x + p.fish.dx, p.fish.y + (reducedMotion.matches ? 0 : Math.sin(t * 0.08 + p.x * 0.01) * 4), t);
  }
}

function drawGround() {
  drawGroundArt(ctx, { sky, scroll:worldScroll, W:WORLD_W, H:WORLD_H, groundTop:WORLD_H - GROUND_H });

  // pawprints walk along with the roof
  ctx.globalAlpha = 0.16;
  for (let x = 0; x < WORLD_W + 80; x += 60) {
    const px = x - worldScroll % 60;
    const py = WORLD_H - GROUND_H / 2 + 6 + ((x / 60) % 2) * 8;
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

  const ahead = gameOver ? MOUSE_GAP : MOUSE_GAP + Math.max(0, cat.vy) * 0.4 + (cat.rot * MOUSE_DRAW_AHEAD);
  ctx.translate(mouse.x + ahead, mouse.y);

  const tilt = Math.max(-0.35, Math.min(0.35, mouse.vy * 0.06));
  ctx.rotate(tilt);

  ctx.globalAlpha = 1;

  const bodyCol = mouseColor || "#c9c2b6";
  const headCol = shade(bodyCol, +0.08);

  // body
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = headCol;
  ctx.beginPath();
  ctx.ellipse(8, -2, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.fillStyle = headCol;
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
  ctx.strokeStyle = shade(bodyCol, -0.05);
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
  ctx.fillStyle = "rgba(255,170,185,0.55)"; // inner ears
  ctx.beginPath(); ctx.moveTo(-9.5, -12.5); ctx.lineTo(-14.5, -19.5); ctx.lineTo(-5, -17); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9.5, -12.5);  ctx.lineTo(14.5, -19.5);  ctx.lineTo(5, -17);  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.13)"; // soft belly
  ctx.beginPath(); ctx.ellipse(0, 7, 11, 7.5, 0, 0, Math.PI * 2); ctx.fill();

// stripes (bigger / more visible sometimes)
if (catStripeMode !== 0) {
  ctx.strokeStyle = catStyle.stripe;
  ctx.lineWidth = 4.5;        // bigger
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;

  ctx.beginPath();

  if (catStripeMode === 1) {
    // heavy horizontal bands
    ctx.moveTo(-12, -6); ctx.lineTo(12, -6);
    ctx.moveTo(-13,  1); ctx.lineTo(13,  1);
    ctx.moveTo(-11,  8); ctx.lineTo(11,  8);
  } else if (catStripeMode === 2) {
    // chunky tabby diagonals
    for (let i = -10; i <= 10; i += 6) {
      ctx.moveTo(-14, i); ctx.lineTo(-2, i - 5);
      ctx.moveTo( 14, i); ctx.lineTo( 2, i - 5);
    }
  } else {
    // mixed: 2 bands + side slashes
    ctx.moveTo(-12, -5); ctx.lineTo(12, -5);
    ctx.moveTo(-12,  4); ctx.lineTo(12,  4);
    ctx.moveTo(-14,  2); ctx.lineTo(-4, -1);
    ctx.moveTo( 14,  2); ctx.lineTo( 4, -1);
    ctx.moveTo(-14,  9); ctx.lineTo(-5,  6);
    ctx.moveTo( 14,  9); ctx.lineTo( 5,  6);
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

  // eyes
  if (gameOver) {
    // bonked: little crossed eyes
    ctx.strokeStyle = "#0b1020"; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.beginPath();
    for (const x of [-6, 6]) { ctx.moveTo(x - 2.6, -4.6); ctx.lineTo(x + 2.6, 0.6); ctx.moveTo(x + 2.6, -4.6); ctx.lineTo(x - 2.6, 0.6); }
    ctx.stroke();
  } else if (!reducedMotion.matches && t % 230 < 7) {
    // a quick blink
    ctx.strokeStyle = "#0b1020"; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.beginPath();
    for (const x of [-6, 6]) { ctx.moveTo(x - 3.4, -2); ctx.quadraticCurveTo(x, 0, x + 3.4, -2); }
    ctx.stroke();
  } else {
    if (catStyle.eyes) {
      ctx.fillStyle = catStyle.eyes;
      for (const x of [-6, 6]) { ctx.beginPath(); ctx.ellipse(x, -2, 4.2, 3.6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = "#0b1020";
    ctx.beginPath(); ctx.arc(-6, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 6, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; // eye shine
    ctx.beginPath(); ctx.arc(-6.9, -2.9, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 5.1, -2.9, 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(240,140,160,0.95)"; // nose
  ctx.beginPath(); ctx.moveTo(-1.5, 0.6); ctx.lineTo(1.5, 0.6); ctx.lineTo(0, 2.2); ctx.closePath(); ctx.fill();

// mouth (always)
ctx.strokeStyle = "rgba(11,16,32,0.55)";
ctx.lineWidth = 1.6;
ctx.lineCap = "round";
ctx.beginPath();
// little "w" mouth
ctx.moveTo(-2, 2);
ctx.quadraticCurveTo(0, 4, 2, 2);
ctx.moveTo(0, 2);
ctx.lineTo(0, 3.5);
ctx.stroke();

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
  const wag = reducedMotion.matches ? 0 : Math.sin(t * 0.14) * 3;
  ctx.moveTo(-18, 6);
  ctx.quadraticCurveTo(-34, wag, -30 + wag * 0.4, -10 + wag);
  ctx.stroke();

  drawHat(ctx, hat.id, t);
  ctx.restore();
}

function drawSparkles() {
  // ensure we start clean even if previous draw changed alpha
  ctx.globalAlpha = 1;

  for (const sp of sparkles) {
    ctx.globalAlpha = Math.max(0, sp.life / 30);
    if (sp.kind === 'puff') { ctx.fillStyle = sp.color || '#cfe3ff'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 2 + sp.life / 9, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.font = sp.kind === 'star' ? "13px system-ui" : "16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sp.kind === 'star' ? "✨" : "🐟", sp.x, sp.y);
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
  if (runFish > 0) { // golden fish caught this flight
    drawGoldFish(ctx, WORLD_W - 52, 84, 0, 0.8);
    ctx.font = "700 17px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#ffe08a"; ctx.fillText(String(runFish), WORLD_W - 38, 85); ctx.textAlign = "center";
    ctx.fillStyle = "rgba(231,238,252,0.92)";
  }
  if (resumeLeft > 0 && !paused) {
    const n = Math.ceil(resumeLeft / (RESUME_MS / 3)), pulse = 1 - ((resumeLeft % (RESUME_MS / 3)) / (RESUME_MS / 3));
    ctx.fillStyle = "rgba(8,12,26,0.38)"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = "rgba(255,224,138,0.9)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(WORLD_W / 2, WORLD_H / 2 - 20, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pulse)); ctx.stroke();
    ctx.fillStyle = "#fff6dc"; ctx.font = "800 72px system-ui"; ctx.fillText(String(n), WORLD_W / 2, WORLD_H / 2 - 16);
    ctx.font = "600 16px system-ui"; ctx.fillStyle = "rgba(231,238,252,0.9)"; ctx.fillText("Get ready…", WORLD_W / 2, WORLD_H / 2 + 62);
  }

  if (!started && !gameOver && continueUsed) {
    ctx.font = "800 30px system-ui";
    ctx.fillText("Back in the air!", WORLD_W / 2, WORLD_H / 2 + 60);
    ctx.font = "600 16px system-ui"; ctx.globalAlpha = 0.85;
    ctx.fillText("Space or tap to keep flying", WORLD_W / 2, WORLD_H / 2 + 96);
    ctx.globalAlpha = 1;
  } else if (!started && !gameOver) {
    ctx.font = "800 34px system-ui";
    ctx.fillText("FLAPURR!", WORLD_W / 2, WORLD_H / 2 + 40);
    ctx.font = "600 16px system-ui";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Space or tap to fly", WORLD_W / 2, WORLD_H / 2 + 82);
    ctx.fillText(mode==='practice' ? "Find your rhythm. You’ve got this." : "Pass yarn gates. Collect treats.", WORLD_W / 2, WORLD_H / 2 + 106);
    ctx.globalAlpha = 1;
  }
}

// ---------- Loop ----------
function simulate(dt) {
  time60 += dt;
  t = time60; // keep your sin() animations working

  if (started && !gameOver && !paused) {
    flightStats.frames += dt;
    if (invulnerable > 0) invulnerable = Math.max(0, invulnerable - dt);
    // physics (dt-based)
    cat.vy += currentRules.gravity * dt;
    cat.y  += cat.vy * dt;
    cat.rot = Math.max(-0.55, Math.min(1.0, cat.vy / 12));

    // mouse chase (keep "feel" stable across fps)
    const anchorX = cat.x + cat.r * MOUSE_ANCHOR;
    const anchorY = cat.y + MOUSE_YOFF + Math.sin(t * 0.12) * 2;

    // scale the spring a bit by dt so it behaves similarly at different fps
    const spring = 0.18 * dt;
    const damp   = Math.pow(0.72, dt);

    mouse.vx += (anchorX - mouse.x) * spring;
    mouse.vy += (anchorY - mouse.y) * spring;
    mouse.vx *= damp;
    mouse.vy *= damp;
    mouse.x  += mouse.vx * dt;
    mouse.y  += mouse.vy * dt;

    // clamp mouse within cat front-half hitbox
    const minX = cat.x + cat.r * 0.35;
    const maxX = cat.x + cat.r * 0.90;
    mouse.x = Math.max(minX, Math.min(maxX, mouse.x));

    // pipes move (dt-based)
    for (const p of pipes) p.x -= currentRules.speed * dt;
    worldScroll += currentRules.speed * dt;

    // golden fish: cosmetic, banked the moment they're caught
    for (const p of pipes) {
      if (!p.fish || p.fish.taken || !fishCaught(cat.x, cat.y, cat.r, p.x + p.fish.dx, p.fish.y)) continue;
      p.fish.taken = true; runFish++; fishJar = readFish(fishJar + 1); saveSetting('flapurr_fish_v1', String(fishJar));
      beep(988, 0.07, "sine", 0.04); setTimeout(() => beep(1319, 0.09, "sine", 0.035), 70);
      flightCallout = { text:`Golden fish! ${fishJar} in the jar`, frames:70 };
      for (let i = 0; i < (reducedMotion.matches ? 0 : 8); i++) sparkles.push({ x:p.x + p.fish.dx, y:p.fish.y, vx:(rand() - 0.5) * 3, vy:(rand() - 0.5) * 3, life:28, kind:'star' });
      renderHats();
    }

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
        if (isCleanPass(cat.y, p.gapCenter, currentRules.gap)) {
          flightStats.clean++; flightStats.streak++; flightStats.bestStreak = Math.max(flightStats.bestStreak, flightStats.streak);
          flightCallout = { text: flightStats.streak > 1 ? `${flightStats.streak} clean passes in a row!` : 'Clean pass. Very catlike.', frames: 80 };
        } else flightStats.streak = 0;
        updateHUD();
        const earned=MILESTONES.find(m=>m.score===score);if(earned)milestone={...earned,frames:100};
        statusEl.textContent = `Playing • Treats: ${score} • Best: ${best}`;
        beep(740, 0.05, "triangle", 0.03);

        for (let i = 0; i < (reducedMotion.matches ? 0 : 10); i++) {
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

    // bounds
    if (cat.y - cat.r < 0) { cat.y = cat.r; cat.vy = 0; }
    if (cat.y + cat.r > WORLD_H - GROUND_H) { if (invulnerable > 0) { cat.y = WORLD_H - GROUND_H - cat.r; cat.vy = Math.min(cat.vy, 0); } else setGameOver('ground'); }

    // collisions
    for (const p of pipes) {
      const topH = p.gapCenter - currentRules.gap / 2;
      const botY = p.gapCenter + currentRules.gap / 2;
      const botH = (WORLD_H - GROUND_H) - botY;

      if (invulnerable > 0) continue; // a moment of grace right after a continue
      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, 0, PIPE_W, topH)) setGameOver('upper');
      if (circleRectCollide(cat.x, cat.y, cat.r, p.x, botY, PIPE_W, botH)) setGameOver('lower');
    }
  } else if (gameOver && crashFall) {
    // A tumble to the roof after a bonk. Looks only: the run has already ended.
    cat.vy = Math.min(cat.vy + currentRules.gravity * dt, 13); cat.y += cat.vy * dt; cat.rot += 0.2 * dt;
    mouse.x += 2.8 * dt; // the mouse makes a run for it
    if (cat.y + cat.r >= WORLD_H - GROUND_H) { cat.y = WORLD_H - GROUND_H - cat.r; cat.rot = Math.PI; crashFall = false; }
  }

  // sparkles (dt-based)
  sparkles = sparkles.filter(sp => sp.life > 0);
  for (const sp of sparkles) {
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 0.04 * dt;
    sp.life -= dt;
  }

  if (flightCallout) { flightCallout.frames -= dt; if (flightCallout.frames <= 0) flightCallout = null; }
  if(milestone) {milestone.frames-=dt;if(milestone.frames<=0)milestone=null;}
}
function update(now=0) {
  const elapsed=lastTime ? now-lastTime : 0;lastTime=now;
  if (resumeLeft > 0 && !paused) {
    resumeLeft -= Math.min(100, elapsed);
    if (resumeLeft <= 0) { resumeLeft = 0; stepper.reset(); statusEl.textContent = `Playing • Treats: ${score} • Best: ${best}`; }
  } else if(!paused)stepper.advance(elapsed,simulate);
  // Clear the ENTIRE backing bitmap, including letterbox margins, before
  // returning to world coordinates. Clip all artwork to the playable area.
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0b1020';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,WORLD_W,WORLD_H);ctx.clip();
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
  ctx.globalAlpha = invulnerable > 0 && started && Math.floor(t / 6) % 2 ? 0.45 : 1; // blink while protected
  drawCat();
  drawMouse();
  ctx.globalAlpha = 1;
  drawUI();
  if(milestone && !gameOver){ctx.font='600 15px system-ui';ctx.textAlign='center';ctx.fillStyle='#b8f3cc';ctx.fillText(`${milestone.icon} ${milestone.name}`,WORLD_W/2,125);}
  else if(flightCallout && !gameOver){ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#e8c89d';ctx.fillText(flightCallout.text,WORLD_W/2,125);}
  if(mode==='practice' && started && !gameOver){const next=pipes.find(p=>p.x+PIPE_W>=cat.x-cat.r);if(next){ctx.save();ctx.setLineDash([4,7]);ctx.strokeStyle='#b6efd055';ctx.beginPath();ctx.moveTo(cat.x+35,next.gapCenter);ctx.lineTo(next.x+PIPE_W,next.gapCenter);ctx.stroke();ctx.restore();}}
  ctx.restore();

  requestAnimationFrame(update);
}

// ---------- Start ----------
renderFlightLog();
updateCrew();
renderHats();
reset();
update();
setNet("Connecting to cat HQ…");
initFirebase();

// Offline play: a network-first service worker keeps the last good copy of the game.
if (!preview && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
