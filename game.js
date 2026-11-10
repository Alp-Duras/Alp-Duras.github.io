/* Sofia's Christmas Run — a small endless runner.
   The world is drawn in art pixels (P screen pixels each); only Sofia's face
   photo is drawn at full resolution so she stays recognisable. */
(function () {
  'use strict';
  const { makeCanvas, rng, Buf } = window.Pixel;

  const P = 4;                 // canvas pixels per art pixel
  const H = 144;               // world height in art pixels
  const GROUND = H - 20;       // y of the snow surface
  const GRAVITY = 1250, JUMP = 330, CUT = 150;
  const BEST_KEY = 'sofiaChristmasRun.best';
  const OUT = '#1a0826';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const ui = {
    stage: $('stage'), score: $('score'), best: $('best'), start: $('start-panel'), over: $('over-panel'),
    startBtn: $('start-btn'), restartBtn: $('restart-btn'), jumpBtn: $('jump-btn'),
    finalScore: $('final-score'), newBest: $('new-best'), overTitle: $('over-title'), status: $('status')
  };
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  let W = 256;

  /* ---------- best score (saved on this device) ---------- */
  function readBest() {
    try { return Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage unavailable: keep it for this visit */ }
  }
  let best = readBest();
  ui.best.textContent = best;

  /* ---------- Sofia's head ---------- */
  // The photo already has a transparent background; this crops to the face.
  const HEAD_SRC = { x: 14, y: 24, w: 220, h: 280 };
  const HEAD_W = 20, HEAD_H = Math.round(HEAD_W * HEAD_SRC.h / HEAD_SRC.w);
  const head = new Image();
  let headReady = false;
  head.onload = () => { headReady = true; };
  head.src = 'src/head.png';

  /* ======================================================================
     Sprites
     ====================================================================== */
  const C = {
    coat: '#8e5bd6', coatL: '#b48cf0', coatS: '#6a3fa0', trim: '#fff4e2', scarf: '#ff5d8f', scarfS: '#c93a6a',
    legs: '#3b1a4c', boot: '#5b3428', bootL: '#7a4a32', gold: '#ffd45a'
  };

  function buildBody(frame) {
    const b = new Buf(18, 19), o = 1;
    const r = (x, y, w, h, c) => b.rect(x + o, y + o, w, h, c);
    // scarf with a tail that flutters behind
    r(3, 0, 10, 2, C.scarf); r(3, 1, 10, 1, C.scarfS);
    if (frame === 0) { r(0, 1, 3, 1, C.scarf); r(0, 2, 2, 1, C.scarfS); }
    else { r(0, 0, 3, 1, C.scarf); r(1, 1, 2, 1, C.scarfS); }
    // coat
    r(3, 2, 10, 7, C.coat); r(3, 2, 2, 7, C.coatL); r(11, 2, 2, 7, C.coatS);
    r(2, 8, 12, 2, C.coat); r(2, 8, 1, 2, C.coatL); r(12, 8, 2, 2, C.coatS);
    r(2, 10, 12, 1, C.trim);
    b.set(8 + o, 4 + o, C.gold); b.set(8 + o, 6 + o, C.gold);
    // arms
    if (frame === 2) { r(12, 0, 2, 4, C.coatS); r(12, 0, 2, 1, C.scarf); }
    else if (frame === 0) { r(11, 4, 3, 2, C.coatS); r(14, 4, 1, 2, C.scarf); }
    else { r(11, 4, 2, 4, C.coatS); r(11, 8, 2, 1, C.scarf); }
    // legs and boots
    if (frame === 0) {
      r(4, 11, 2, 3, C.legs); r(3, 14, 4, 2, C.boot); r(3, 14, 1, 1, C.bootL);
      r(9, 11, 2, 2, C.legs); r(10, 12, 2, 2, C.legs); r(11, 13, 3, 2, C.boot);
    } else if (frame === 1) {
      r(4, 11, 2, 2, C.legs); r(3, 12, 2, 2, C.legs); r(1, 13, 3, 2, C.boot);
      r(9, 11, 2, 3, C.legs); r(9, 14, 4, 2, C.boot); r(9, 14, 1, 1, C.bootL);
    } else {
      r(4, 11, 2, 2, C.legs); r(4, 13, 4, 2, C.boot);
      r(9, 11, 2, 2, C.legs); r(10, 12, 3, 2, C.boot);
    }
    b.outline(OUT);
    return b.toCanvas();
  }

  function buildHat() {
    const b = new Buf(21, 12);
    for (let r = 0; r < 7; r++) {
      const L = Math.round(4 + (6 - r) * 1.0), R = Math.round(15 - (6 - r) * 0.25);
      for (let x = L; x <= R; x++) b.set(x, r + 1, x <= L ? '#b48cf0' : x >= R - 1 ? '#6a3fa0' : '#8e5bd6');
    }
    b.rect(2, 8, 17, 2, '#fff4e2'); b.rect(2, 10, 17, 1, '#e2d3ff');
    b.map(['.ww.', 'wwww', 'wWww', '.ww.'], { w: '#fff4e2', W: '#ffffff' }, 15, 0);
    b.outline(OUT);
    return b.toCanvas();
  }

  function present(w, h, body, shade, lid, rib) {
    const b = new Buf(w + 2, h + 5), ox = 1, oy = 4;
    b.rect(ox, oy, w, h, body);
    b.rect(ox + w - 2, oy, 2, h, shade);
    b.rect(ox, oy, w, 2, lid);
    const mx = ox + Math.floor(w / 2) - 1;
    b.rect(mx, oy, 2, h, rib);
    b.rect(ox, oy + Math.floor(h / 2), w, 1, rib);
    b.map(['bb..bb', 'b.bb.b', '.bbbb.'], { b: rib }, mx - 2, oy - 3);
    b.outline(OUT);
    return b;
  }

  function buildSnowman() {
    const b = new Buf(19, 30);
    const ball = (cx, cy, r) => {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const d = (x * x + y * y) / (r * r);
        if (d > 1) continue;
        b.set(cx + x, cy + y, x + y > r * 0.6 ? '#d9c9f5' : (x + y < -r * 0.9 ? '#ffffff' : '#fffaf2'));
      }
    };
    ball(9, 22, 6); ball(9, 13, 4.5); ball(9, 7, 3.6);
    b.rect(5, 3, 9, 1, '#3b1a4c'); b.rect(6, 0, 7, 3, '#3b1a4c'); b.rect(6, 2, 7, 1, '#8e5bd6');
    b.set(8, 6, '#1a0826'); b.set(10, 6, '#1a0826');
    b.set(10, 8, '#ff9a3c'); b.set(11, 8, '#ff9a3c'); b.set(12, 8, '#e0731f');
    b.rect(5, 10, 9, 2, '#9a5cf0'); b.rect(11, 12, 2, 3, '#9a5cf0'); b.set(12, 14, '#6a33b8');
    b.set(9, 14, '#3b1a4c'); b.set(9, 17, '#3b1a4c');
    b.set(3, 13, '#5b3428'); b.set(2, 12, '#5b3428'); b.set(1, 11, '#5b3428');
    b.set(15, 13, '#5b3428'); b.set(16, 12, '#5b3428'); b.set(17, 12, '#5b3428');
    b.outline(OUT);
    return b;
  }

  function buildCane() {
    const b = new Buf(9, 22);
    const c = (x, y) => b.set(x, y, ((x + y) % 4 < 2) ? '#e23a52' : '#fff6ee');
    for (let y = 4; y < 21; y++) { c(5, y); c(6, y); }
    for (let x = 2; x < 7; x++) { c(x, 1); c(x, 2); }
    c(1, 3); c(2, 3); c(1, 4); c(2, 4); c(1, 5); c(2, 5);
    b.outline(OUT);
    return b;
  }

  const OBSTACLES = [
    { name: 'a present', make: () => present(10, 9, '#7b4bb3', '#5d2d8a', '#9a6bd6', '#ffd45a'), min: 0 },
    { name: 'a present', make: () => present(12, 11, '#d6334d', '#a3203a', '#ff6b80', '#fff1dc'), min: 0 },
    { name: 'a candy cane', make: buildCane, min: 60 },
    { name: 'a snowman', make: buildSnowman, min: 120 },
    {
      name: 'a stack of presents', min: 250, make: () => {
        const b = new Buf(16, 26);
        b.blit(present(14, 11, '#2f8f5b', '#1f6b45', '#4fb377', '#cdb6ff'), 0, 10);
        b.blit(present(9, 8, '#e9b949', '#bf8f2a', '#ffd97a', '#8e5bd6'), 3, 0);
        return b;
      }
    },
    {
      name: 'some presents', min: 180, make: () => {
        const b = new Buf(24, 15);
        b.blit(present(10, 9, '#ff8ac4', '#d0589a', '#ffb8de', '#ffffff'), 0, 1);
        b.blit(present(11, 10, '#3fc7c0', '#21817e', '#9ff2ea', '#ff5d8f'), 11, 0);
        return b;
      }
    }
  ];
  OBSTACLES.forEach((o) => {
    const b = o.make();
    // trim empty rows so the obstacle sits right on the snow
    let bottom = b.h - 1;
    while (bottom > 0 && b.px.slice(bottom * b.w, bottom * b.w + b.w).every((c) => c === null)) bottom--;
    o.canvas = b.toCanvas();
    o.w = b.w; o.h = bottom + 1;
  });

  const sprites = { run: [buildBody(0), buildBody(1)], jump: buildBody(2), hat: buildHat() };

  /* ---------- scenery tiles ---------- */
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let sky = null, stars = [];
  function buildSky() {
    const R = rng(19);
    const b = makeCanvas(W, H), g = b.getContext('2d');
    const bands = ['#170a2a', '#1f0e36', '#2a1448', '#391b5e', '#4d2577', '#66338f', '#8a4fa8'];
    for (let y = 0; y < GROUND; y++) {
      const p = (y / GROUND) * (bands.length - 1);
      const i = Math.min(bands.length - 2, Math.floor(p)), f = p - i;
      for (let x = 0; x < W; x++) {
        g.fillStyle = f * 16 > BAYER[y % 4][x % 4] + 0.5 ? bands[i + 1] : bands[i];
        g.fillRect(x, y, 1, 1);
      }
    }
    stars = [];
    for (let i = 0; i < W / 3; i++) {
      const x = Math.floor(R() * W), y = Math.floor(R() * GROUND * 0.55);
      g.fillStyle = ['#fff6e6', '#e2d3ff', '#ffe7a3'][i % 3];
      g.fillRect(x, y, 1, 1);
      if (R() < 0.25) stars.push({ x, y, ph: R() * 6.28 });
    }
    const mx = W - 30, my = 18;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      if (x * x + y * y > 38) continue;
      if ((x + 4) * (x + 4) + (y - 1) * (y - 1) <= 28) continue;
      g.fillStyle = x + y < -2 ? '#fffbea' : '#ffe7b0';
      g.fillRect(mx + x, my + y, 1, 1);
    }
    sky = b;
  }

  function buildSkyline() {
    const R = rng(416), w = 360, h = 56;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    let x = 0;
    while (x < w) {
      const bw = 4 + Math.floor(R() * 7), bh = 6 + Math.floor(R() * 18);
      g.fillStyle = '#3a2160'; g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 2; wy < h - 1; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
        if (R() < 0.18) { g.fillStyle = '#9c7cc9'; g.fillRect(wx, wy, 1, 1); }
      }
      x += bw + Math.floor(R() * 3);
    }
    const tx = 120;
    g.fillStyle = '#2e1a52';
    g.fillRect(tx - 1, h - 30, 3, 30); g.fillRect(tx - 2, h - 12, 5, 12); g.fillRect(tx, h - 54, 1, 54);
    g.fillRect(tx - 3, h - 36, 7, 3); g.fillRect(tx - 2, h - 37, 5, 1); g.fillRect(tx - 2, h - 33, 5, 1);
    g.fillRect(tx - 1, h - 44, 3, 3);
    g.fillStyle = '#ffd27a'; g.fillRect(tx - 2, h - 35, 1, 1); g.fillRect(tx, h - 35, 1, 1); g.fillRect(tx + 2, h - 35, 1, 1);
    g.fillStyle = '#ff4d6d'; g.fillRect(tx, h - 55, 1, 1);
    return c;
  }

  function buildHills() {
    const w = 240, h = 34, c = makeCanvas(w, h), g = c.getContext('2d');
    for (let x = 0; x < w; x++) {
      const y1 = Math.round(14 + Math.sin((x / w) * Math.PI * 2) * 7 + Math.sin((x / w) * Math.PI * 6) * 3);
      g.fillStyle = '#b9a0e6'; g.fillRect(x, y1, 1, h - y1);
      g.fillStyle = '#dccdf7'; g.fillRect(x, y1, 1, 1);
      const y2 = Math.round(22 + Math.sin((x / w) * Math.PI * 4 + 1) * 4);
      g.fillStyle = '#cbb6f0'; g.fillRect(x, y2, 1, h - y2);
      g.fillStyle = '#efe6fb'; g.fillRect(x, y2, 1, 1);
    }
    return c;
  }

  function buildPine(scale, seed) {
    const R = rng(seed);
    const w = Math.round(22 * scale), h = Math.round(36 * scale);
    const b = new Buf(w + 2, h + 4), cx = Math.floor((w + 2) / 2);
    const tiers = 3;
    for (let i = tiers - 1; i >= 0; i--) {
      const top = Math.round(3 + i * h * 0.24), bottom = Math.round(top + h * 0.42), hw = (w / 2) * (0.5 + i * 0.25);
      for (let y = top; y <= bottom; y++) {
        const half = 1 + (hw - 1) * ((y - top) / (bottom - top));
        for (let x = Math.ceil(cx - half); x <= cx + half; x++) {
          const rel = (x - cx) / half;
          b.set(x, y, rel < -0.4 ? '#35975f' : rel > 0.4 ? '#175a3d' : '#21754c');
          if (y === bottom || (y === bottom - 1 && (x % 3 === 0))) b.set(x, y, '#efe6fb');
        }
      }
    }
    b.rect(cx - 1, h - 2, 3, 4, '#5b3428');
    b.map(['.y.', 'yyy', '.y.'], { y: '#ffd45a' }, cx - 1, 0);
    b.outline('#0b2f22');
    const lights = [];
    for (let i = 0; i < 9 * scale; i++) {
      const y = 6 + Math.floor(R() * (h - 10)), x = cx + Math.round((R() - 0.5) * (y / h) * w * 0.8);
      if (b.get(x, y) && b.get(x, y) !== '#0b2f22') lights.push({ x, y, c: ['#ff4d6d', '#ffd45a', '#5ee6d8', '#ff8ad8', '#b98cff'][i % 5] });
    }
    lights.forEach((l) => b.set(l.x, l.y, l.c));
    return b;
  }

  function buildTrees() {
    const w = 300, h = 50, out = new Buf(w, h);
    [[14, 1, 3], [96, 1.3, 5], [170, 0.85, 8], [236, 1.15, 11]].forEach(([x, s, seed]) => {
      const t = buildPine(s, seed);
      out.blit(t, x, h - t.h);
    });
    return out.toCanvas();
  }

  function buildGround() {
    const R = rng(5), w = 96, h = H - GROUND, c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#e2d3ff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f1e8fc'; g.fillRect(0, 0, w, 4);
    g.fillStyle = '#fffaf2'; g.fillRect(0, 0, w, 1);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = R() < 0.5 ? '#cdb6ff' : '#f6f0ff';
      g.fillRect(Math.floor(R() * w), 5 + Math.floor(R() * (h - 6)), R() < 0.3 ? 2 : 1, 1);
    }
    g.fillStyle = '#b9a0e6';
    for (let x = 0; x < w; x += 12) g.fillRect(x, 9, 6, 1);
    return c;
  }

  const tiles = { skyline: buildSkyline(), hills: buildHills(), trees: buildTrees(), ground: buildGround() };

  /* ======================================================================
     Game state
     ====================================================================== */
  const state = {
    mode: 'start', dist: 0, score: 0, speed: 0, nextGap: 0, obstacles: [],
    y: 0, vy: 0, onGround: true, held: false, buffer: 0, runT: 0, overAt: 0, flash: 0, lastHundred: 0
  };
  const PX = 26;      // Sofia's x position
  let flakes = [];

  function resetWorld() {
    state.dist = 0; state.score = 0; state.speed = 130; state.obstacles = [];
    state.nextGap = 120; state.y = 0; state.vy = 0; state.onGround = true; state.buffer = 0; state.lastHundred = 0;
  }

  function resize() {
    const portrait = window.innerWidth < 640 && window.innerHeight > window.innerWidth;
    const nextW = portrait ? 168 : 256;
    if (nextW !== W || !sky) {
      W = nextW;
      canvas.width = W * P; canvas.height = H * P;
      ui.stage.style.setProperty('--ratio', `${W} / ${H}`);
      ui.stage.style.setProperty('--aspect', String(W / H));
      buildSky();
      flakes = [];
      const n = reduceMQ.matches ? 18 : 55;
      for (let i = 0; i < n; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 8 + Math.random() * 14, ph: Math.random() * 6.28 });
    }
  }

  function startGame() {
    resetWorld();
    state.mode = 'running';
    ui.start.hidden = true; ui.over.hidden = true;
    ui.stage.classList.add('is-running');
    ui.status.textContent = 'Running. Jump with Space, the up arrow, or a tap.';
    canvas.focus && canvas.blur();
    jump();
  }

  function gameOver(hit) {
    state.mode = 'over';
    state.overAt = performance.now();
    const final = Math.floor(state.score);
    const isBest = final > best;
    if (isBest) { best = final; saveBest(best); ui.best.textContent = best; }
    ui.finalScore.textContent = final;
    ui.newBest.hidden = !isBest;
    ui.overTitle.textContent = `Oops, ${hit.name}!`;
    ui.over.hidden = false;
    ui.stage.classList.remove('is-running');
    ui.status.textContent = `Game over. You scored ${final}. ${isBest ? 'That is a new best.' : `Your best is ${best}.`}`;
    setTimeout(() => { if (state.mode === 'over') ui.restartBtn.focus({ preventScroll: true }); }, 60);
  }

  function jump() {
    if (state.onGround) {
      state.vy = -JUMP; state.onGround = false; state.buffer = 0;
    } else {
      state.buffer = 0.13;
    }
  }

  function press() {
    state.held = true;
    if (state.mode === 'start') startGame();
    else if (state.mode === 'running') jump();
    else if (state.mode === 'over' && performance.now() - state.overAt > 450) startGame();
  }
  function release() {
    state.held = false;
    if (state.mode === 'running' && state.vy < -CUT) state.vy = -CUT;
  }

  /* ---------- update ---------- */
  function update(dt) {
    const R = Math.random;
    if (state.mode !== 'running') {
      if (state.mode === 'start') state.dist += 18 * dt;
      return;
    }
    state.speed = Math.min(330, 130 + state.score * 0.11);
    const move = state.speed * dt;
    state.dist += move;
    state.score += move * 0.08;
    state.runT += dt * (state.speed / 130);

    const hundred = Math.floor(state.score / 100);
    if (hundred > state.lastHundred) { state.lastHundred = hundred; state.flash = 0.6; }
    if (state.flash > 0) state.flash -= dt;

    // physics
    if (!state.onGround) {
      state.vy += GRAVITY * dt;
      state.y += state.vy * dt;
      if (state.y >= 0) {
        state.y = 0; state.vy = 0; state.onGround = true;
        if (state.buffer > 0) jump();
      }
    }
    if (state.buffer > 0) state.buffer -= dt;

    // obstacles
    state.nextGap -= move;
    if (state.nextGap <= 0) {
      const pool = OBSTACLES.filter((o) => state.score >= o.min);
      const o = pool[Math.floor(R() * pool.length)];
      state.obstacles.push({ o, x: W + 4 });
      if (state.score > 300 && o.w <= 12 && R() < 0.22) state.obstacles.push({ o: OBSTACLES[0], x: W + 4 + o.w + 2 });
      const minGap = 78 + state.speed * 0.5;
      state.nextGap = minGap + R() * Math.max(50, 150 - state.score * 0.04);
    }
    for (const ob of state.obstacles) ob.x -= move;
    state.obstacles = state.obstacles.filter((ob) => ob.x + ob.o.w > -4);

    // collision (forgiving boxes)
    const feet = GROUND + state.y;
    const me = { x: PX + 4, y: feet - 15 - HEAD_H + 8, w: 10, h: 15 + HEAD_H - 9 };
    for (const ob of state.obstacles) {
      const box = { x: ob.x + 2, y: GROUND - ob.o.h + 2, w: ob.o.w - 4, h: ob.o.h - 2 };
      if (me.x < box.x + box.w && me.x + me.w > box.x && me.y < box.y + box.h && me.y + me.h > box.y) {
        gameOver(ob.o);
        break;
      }
    }
  }

  /* ---------- draw ---------- */
  function img(c, x, y, w = c.width, h = c.height) {
    ctx.drawImage(c, Math.round(x) * P, Math.round(y) * P, w * P, h * P);
  }
  function tile(c, factor, y) {
    const off = Math.floor((state.dist * factor) % c.width);
    for (let x = -off; x < W; x += c.width) img(c, x, y);
  }

  function draw(t, dt) {
    ctx.imageSmoothingEnabled = false;
    img(sky, 0, 0);
    for (const s of stars) {
      if (Math.sin(t * 1.6 + s.ph) > 0.2) { ctx.fillStyle = 'rgba(255,246,230,.55)'; ctx.fillRect((s.x - 1) * P, s.y * P, 3 * P, P); ctx.fillRect(s.x * P, (s.y - 1) * P, P, 3 * P); }
    }
    tile(tiles.skyline, 0.06, GROUND - 30 - tiles.skyline.height + 14);
    tile(tiles.hills, 0.2, GROUND - tiles.hills.height + 2);
    tile(tiles.trees, 0.45, GROUND - tiles.trees.height + 1);
    tile(tiles.ground, 1, GROUND);

    for (const ob of state.obstacles) img(ob.o.canvas, ob.x, GROUND - ob.o.h);

    drawSofia(t);

    // snowfall
    const still = reduceMQ.matches && state.mode !== 'running';
    ctx.fillStyle = 'rgba(255,250,242,.9)';
    for (const f of flakes) {
      if (!still) {
        f.y += f.v * dt;
        f.x += (Math.sin(t + f.ph) * 3 - (state.mode === 'running' ? state.speed * 0.15 : 4)) * dt;
        if (f.y > GROUND + 4) { f.y = -2; f.x = Math.random() * (W + 40); }
        if (f.x < -2) f.x += W + 4;
      }
      ctx.fillRect(Math.round(f.x) * P, Math.round(f.y) * P, P, P);
    }

    if (state.flash > 0 && Math.floor(state.flash * 10) % 2 === 0) ui.score.parentElement.classList.add('flash');
    else ui.score.parentElement.classList.remove('flash');
  }

  function drawSofia(t) {
    const feet = GROUND + Math.round(state.y);
    const airborne = !state.onGround;
    const frame = airborne ? sprites.jump : sprites.run[state.mode === 'running' ? Math.floor(state.runT * 9) % 2 : 0];
    const bodyX = PX, bodyY = feet - frame.height + 2;
    const bob = !airborne && state.mode === 'running' && Math.floor(state.runT * 9) % 2 ? 1 : 0;
    // soft shadow on the snow
    ctx.fillStyle = 'rgba(106,63,160,.35)';
    const sw = airborne ? 8 : 12;
    ctx.fillRect((PX + 9 - sw / 2) * P, (GROUND + 1) * P, sw * P, P);

    img(frame, bodyX, bodyY);
    const hx = bodyX + 9 - HEAD_W / 2, hy = bodyY - HEAD_H + 5 + bob;
    if (headReady) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(head, HEAD_SRC.x, HEAD_SRC.y, HEAD_SRC.w, HEAD_SRC.h, Math.round(hx) * P, Math.round(hy) * P, HEAD_W * P, HEAD_H * P);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.fillStyle = '#f0c09a'; ctx.fillRect((hx + 3) * P, (hy + 5) * P, 14 * P, 16 * P);
      ctx.fillStyle = '#3b1a1a'; ctx.fillRect((hx + 2) * P, (hy + 2) * P, 16 * P, 5 * P);
    }
    img(sprites.hat, hx + 1, hy - 7 + 0);
  }

  /* ---------- loop ---------- */
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.034, (now - last) / 1000) : 0;
    last = now;
    update(dt);
    draw(now / 1000, dt);
    ui.score.textContent = Math.floor(state.score);
  }

  /* ---------- input ---------- */
  const JUMP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W']);
  window.addEventListener('keydown', (e) => {
    if (!JUMP_KEYS.has(e.key)) return;
    const onControl = e.target.closest && e.target.closest('a, button');
    // Let Space/Enter activate focused buttons and links normally outside of play.
    if (onControl && state.mode !== 'running' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (e.repeat) return;
    press();
  });
  window.addEventListener('keyup', (e) => { if (JUMP_KEYS.has(e.key)) release(); });

  ui.stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    e.preventDefault();
    press();
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  ui.jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  ui.jumpBtn.addEventListener('click', (e) => { if (e.detail === 0) { press(); release(); } });
  ui.startBtn.addEventListener('click', () => { if (state.mode === 'start') { startGame(); release(); } });
  ui.restartBtn.addEventListener('click', () => { if (state.mode === 'over') { startGame(); release(); } });

  document.addEventListener('visibilitychange', () => { last = 0; state.held = false; });
  window.addEventListener('resize', () => { if (state.mode !== 'running') resize(); });

  resetWorld();
  resize();
  requestAnimationFrame(frame);
})();
