(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const fsBtn = document.getElementById("fs");

  // --- Fixed "game world" size (we render into this), but canvas adapts to screen ---
  const WORLD_W = 420;
  const WORLD_H = 640;

  // Game constants (in world units)
  const GRAVITY = 0.45;
  const FLAP_VY = -8.3;
  const PIPE_SPEED = 2.55;
  const PIPE_GAP = 150;
  const PIPE_W = 70;
  const PIPE_SPACING = 210;
  const GROUND_H = 86;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resizeCanvasToCSS() {
    // CSS size (what you see on screen)
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));

    // Use devicePixelRatio for crispness
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    // Compute scale to fit WORLD into CSS box, preserving aspect ratio
    const s = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    scale = s;
    offsetX = (cssW - WORLD_W * s) / 2;
    offsetY = (cssH - WORLD_H * s) / 2;

    // Reset transform: first to physical pixels, then map world->screen
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
  }

  // Call once now and when layout changes
  resizeCanvasToCSS();
  window.addEventListener("resize", resizeCanvasToCSS);
  window.addEventListener("orientationchange", resizeCanvasToCSS);

  // --- RNG ---
  let rngSeed = Math.floor(Math.random() * 1e9);
  const rand = () => {
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

  // --- State ---
  let started = false;
  let gameOver = false;
  let score = 0;
  let best = Number(localStorage.getItem("flapurr_best") || 0);

  const cat = { x: 120, y: WORLD_H * 0.45, r: 18, vy: 0, rot: 0 };
  let pipes = [];
  let t = 0;

  function reset() {
    started = false;
    gameOver = false;
    score = 0;
    t = 0;
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
  }

  function setGameOver() {
    if (gameOver) return;
    gameOver = true;
    if (score > best) {
      best = score;
      localStorage.setItem("flapurr_best", String(best));
    }
    statusEl.textContent = `Game Over • Score: ${score} • Best: ${best} • Tap to restart`;
  }

  // --- Input ---
  // Mobile: tap/click anywhere on the canvas area; also prevent page scroll.
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (gameOver) { reset(); started = true; }
    flap();
  }, { passive: false });

  // Desktop keys still work
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); flap(); }
    if (e.key.toLowerCase() === "r") reset();
  }, { passive: false });

  // Fullscreen (works best on Android/desktop; iOS Safari is limited)
  fsBtn?.addEventListener("click", async () => {
    try {
      const el = document.querySelector(".stage");
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
      setTimeout(resizeCanvasToCSS, 50);
    } catch (_) {}
  });

  // --- Collision helpers ---
  function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= cr * cr;
  }

  // --- Drawing helpers ---
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

  function drawFishCloud(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#a9c7ff";
    roundRect(-22, -10, 64, 26, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(42, 3);
    ctx.lineTo(58, -6);
    ctx.lineTo(58, 12);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#0b1020";
    ctx.beginPath();
    ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

  function drawBG() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, "#121b2e");
    g.addColorStop(1, "#0b1020");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 60; i++) {
      const x = (i * 97 + 13) % WORLD_W;
      const y = (i * 151 + 29) % (WORLD_H - 180);
      const tw = 1 + (i % 3);
      ctx.fillStyle = "#cfe3ff";
      ctx.fillRect(x, y, tw, tw);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < 6; i++) {
      const x = ((t * 0.6) + i * 120) % (WORLD_W + 160) - 80;
      const y = 70 + (i * 53) % 220;
      drawFishCloud(x, y, 0.9);
    }
  }

  function drawPipes() {
    for (const p of pipes) {
      const topH = p.gapCenter - PIPE_GAP / 2;
      const botY = p.gapCenter + PIPE_GAP / 2;
      const botH = (WORLD_H - GROUND_H) - botY;

      const pg = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      pg.addColorStop(0, "#2bd66f");
      pg.addColorStop(1, "#18a554");
      ctx.fillStyle = pg;

      roundRect(p.x, 0, PIPE_W, topH, 12);
      ctx.fill();

      roundRect(p.x, botY, PIPE_W, botH, 12);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(p.x, topH - 10, PIPE_W, 10);
      ctx.fillRect(p.x, botY, PIPE_W, 10);
    }
  }

  function drawGround() {
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(0, WORLD_H - GROUND_H, WORLD_W, GROUND_H);

    ctx.globalAlpha = 0.18;
    for (let x = 0; x < WORLD_W + 40; x += 60) {
      const px = x - (t * 1.2) % 60;
      const py = WORLD_H - GROUND_H / 2 + ((x / 60) % 2) * 8;
      drawPaw(px, py, 1.0);
    }
    ctx.globalAlpha = 1;
  }

  function drawCat() {
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.rotate(cat.rot);

    ctx.fillStyle = "#ffd6a6";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffbf80";
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(-18, -22); ctx.lineTo(-2, -18);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -10); ctx.lineTo(18, -22); ctx.lineTo(2, -18);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = "rgba(120,60,20,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
    ctx.moveTo(-7, 2); ctx.lineTo(7, 2);
    ctx.stroke();

    ctx.fillStyle = "#0b1020";
    ctx.beginPath(); ctx.arc(-6, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -2, 2.2, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "rgba(11,16,32,0.55)";
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(8 * s, 4); ctx.lineTo(20 * s, 1);
      ctx.moveTo(8 * s, 6); ctx.lineTo(20 * s, 6);
      ctx.stroke();
    }

    ctx.strokeStyle = "#ffbf80";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-34, 0, -30, -10);
    ctx.stroke();

    ctx.restore();
  }

  function drawUI() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "800 48px system-ui";
    ctx.fillStyle = "rgba(231,238,252,0.92)";
    ctx.fillText(String(score), WORLD_W / 2, 84);

    if (!started && !gameOver) {
      ctx.font = "800 34px system-ui";
      ctx.fillText("FLAPURR!", WORLD_W / 2, WORLD_H / 2 - 40);
      ctx.font = "600 16px system-ui";
      ctx.globalAlpha = 0.85;
      ctx.fillText("Tap to flap", WORLD_W / 2, WORLD_H / 2 + 4);
      ctx.fillText("Dodge the scratch posts 🐾", WORLD_W / 2, WORLD_H / 2 + 28);
      ctx.globalAlpha = 1;
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(WORLD_W / 2 - 160, WORLD_H / 2 - 110, 320, 190, 16);
      ctx.fill();

      ctx.fillStyle = "#e7eefc";
      ctx.font = "800 28px system-ui";
      ctx.fillText("MEOWTCH!", WORLD_W / 2, WORLD_H / 2 - 60);

      ctx.font = "600 16px system-ui";
      ctx.fillText(`Score: ${score}`, WORLD_W / 2, WORLD_H / 2 - 18);
      ctx.fillText(`Best: ${best}`, WORLD_W / 2, WORLD_H / 2 + 8);
      ctx.globalAlpha = 0.9;
      ctx.fillText("Tap to restart", WORLD_W / 2, WORLD_H / 2 + 48);
      ctx.globalAlpha = 1;
    }
  }

  function update() {
    t++;

    if (started && !gameOver) {
      cat.vy += GRAVITY;
      cat.y += cat.vy;
      cat.rot = Math.max(-0.55, Math.min(1.0, cat.vy / 12));

      for (const p of pipes) p.x -= PIPE_SPEED;

      if (pipes.length && pipes[0].x + PIPE_W < -20) {
        pipes.shift();
        const lastX = pipes[pipes.length - 1].x;
        addPipe(lastX + PIPE_SPACING);
      }

      for (const p of pipes) {
        if (!p.passed && p.x + PIPE_W < cat.x - cat.r) {
          p.passed = true;
          score += 1;
          statusEl.textContent = `Playing • Score: ${score} • Best: ${best}`;
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

    // Clear (in world coords)
    drawBG();
    drawPipes();
    drawGround();
    drawCat();
    drawUI();

    requestAnimationFrame(update);
  }

  reset();
  update();
})();
