/* Counting down to you, Sofia — a pixel Christmas room.
   The countdown targets 7:00 PM in Toronto on December 19, 2026.
   Toronto is on Eastern Standard Time (UTC−5) in December, so the offset
   below pins one exact instant no matter where the page is opened. */
(function () {
  'use strict';
  const { makeCanvas, rng, rgba, mix, Buf, textWidth, drawText } = window.Pixel;

  /* ---------- Countdown target ---------- */
  const TARGET_ISO = '2026-12-19T19:00:00-05:00';
  let target = new Date(TARGET_ISO).getTime();
  // For testing the finale: add ?preview=10 to the URL to count down 10 seconds instead.
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) {
    const secs = Number(params.get('preview'));
    target = Date.now() + (Number.isFinite(secs) ? secs : 5) * 1000;
  }

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMQ.matches;

  const $ = (id) => document.getElementById(id);
  const el = {
    root: document.documentElement, scene: $('scene'), bg: $('bg'), sign: $('sign'),
    signLights: $('sign-lights'), holly: $('sign-holly'), display: $('display'), finale: $('finale'),
    days: $('days'), hours: $('hours'), minutes: $('minutes'), seconds: $('seconds'),
    tree: $('tree'), treeCanvas: $('tree-canvas'), sparkles: $('sparkles'), ornament: $('ornament'),
    ornamentCanvas: $('ornament-canvas'), hint: $('hint'), arrow: $('arrow-canvas'), mug: $('mug'),
    fx: $('fx'), dialog: $('surprise'), close: $('gift-close')
  };

  const OUT = '#2a1035';       // outline plum used across sprites
  const LED = ['#ff4d6d', '#ffd45a', '#5ee6d8', '#7aa8ff', '#ff8ad8', '#b98cff', '#9cff7a'];

  /* ======================================================================
     Sprites
     ====================================================================== */

  // ---- Christmas tree ----
  const TW = 104, TH = 158, TCX = 52;
  const TIERS = [
    { top: 16, bottom: 40, hw: 15 },
    { top: 30, bottom: 58, hw: 23 },
    { top: 45, bottom: 78, hw: 32 },
    { top: 62, bottom: 100, hw: 41 },
    { top: 80, bottom: 122, hw: 50 }
  ];
  const ORN = { x: 47, y: 30, w: 14, h: 18 };    // the special ornament, in tree pixels

  function tierHalf(t, y) {
    const k = Math.min(1, Math.max(0, (y - t.top) / (t.bottom - t.top)));
    const step = ((y - t.top) % 6 === 5) ? 1 : 0;   // little layered steps along the sides
    return 1.5 + (t.hw - 1.5) * k + step;
  }
  function tierEdge(t, x) {
    const ph = (((x - TCX) % 7) + 7) % 7;
    return t.bottom + 2 - Math.abs(ph - 3.5) * 0.9;  // drooping branch tips
  }
  function inTier(t, x, y) {
    if (y < t.top || y > t.bottom + 2) return false;
    if (Math.abs(x - TCX) > tierHalf(t, y)) return false;
    return y <= tierEdge(t, x);
  }

  function buildTree() {
    const R = rng(1219);
    const G = { dark: '#0f3d2b', shade: '#175a3d', mid: '#21754c', light: '#35975f', tip: '#5bbd7a', cast: '#0b2f22' };
    const body = new Buf(TW, TH);
    const mask = new Uint8Array(TW * TH);
    const inMask = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH && mask[y * TW + x] === 1;

    // trunk
    for (let y = 116; y < 134; y++) for (let x = 46; x < 58; x++) {
      body.set(x, y, x < 49 ? '#8a5434' : x > 54 ? '#4a2716' : '#6b3d24');
      mask[y * TW + x] = 1;
    }

    // tiers, from the widest at the bottom up to the tip
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const t = TIERS[i];
      // soft shadow cast by this tier onto the one below
      if (i < TIERS.length - 1) {
        for (let y = t.top; y < t.bottom + 6; y++) for (let x = 0; x < TW; x++) {
          if (!inTier(t, x, y) && inTier(t, x, y - 2) && inMask(x, y)) body.set(x, y, G.cast);
        }
      }
      for (let y = t.top; y <= t.bottom + 2; y++) for (let x = 0; x < TW; x++) {
        if (!inTier(t, x, y)) continue;
        const half = tierHalf(t, y), rel = (x - TCX) / half, ed = tierEdge(t, x) - y;
        let c = G.mid;
        if (rel < -0.42) c = G.light;
        if (rel > 0.35) c = G.shade;
        if (rel > 0.78) c = G.dark;
        const h = (x * 73856093 ^ y * 19349663) >>> 0;
        if (h % 9 === 0) c = c === G.mid ? G.light : (c === G.light ? G.tip : G.mid);
        if ((x * 3 + y * 2) % 11 === 0 && rel > -0.4) c = G.shade;
        if (ed < 1.5) c = rel < -0.15 ? G.tip : G.shade;
        body.set(x, y, c);
        mask[y * TW + x] = 1;
      }
    }

    // garlands: gold tinsel and lavender pearls, swooping across the tiers
    for (let i = 1; i < TIERS.length; i++) {
      const t = TIERS[i], span = t.bottom - t.top;
      const y0 = t.top + span * 0.38, y1 = t.top + span * 0.68;
      const x0 = TCX - tierHalf(t, y0), x1 = TCX + tierHalf(t, y1);
      const sag = 3 + i;
      const steps = Math.ceil((x1 - x0) * 2);
      for (let s = 0; s <= steps; s++) {
        const k = s / steps;
        const x = Math.round(x0 + (x1 - x0) * k);
        const y = Math.round(y0 + (y1 - y0) * k + Math.sin(Math.PI * k) * sag);
        if (!inMask(x, y)) continue;
        if (i % 2 === 0) {
          body.set(x, y, x % 2 ? '#f6c95c' : '#ffe9a3');
          if (inMask(x, y + 1)) body.set(x, y + 1, '#c48a2c');
        } else if (x % 3 === 0) {
          body.set(x, y, '#f3ecff');
          if (inMask(x, y + 1)) body.set(x, y + 1, '#a58ad8');
        }
      }
    }

    // ornaments
    const balls = [
      ['#e8384f', '#a3203a', '#ff9aa8'], ['#f4c25b', '#b9832a', '#fff0b8'], ['#8e5bd6', '#5d2d8a', '#d9c4ff'],
      ['#3fc7c0', '#21817e', '#b9fff8'], ['#ff7ac8', '#c0408c', '#ffd0ec'], ['#d9d0ff', '#9a88cc', '#ffffff']
    ];
    const placed = [];
    const reserved = (x, y, pad) => x > ORN.x - pad && x < ORN.x + ORN.w + pad && y > ORN.y - pad && y < ORN.y + ORN.h + pad;
    for (let tries = 0; tries < 900 && placed.length < 24; tries++) {
      const x = Math.floor(R() * (TW - 4)), y = 20 + Math.floor(R() * 100);
      let ok = true;
      for (let j = -1; j < 4 && ok; j++) for (let i = 0; i < 4 && ok; i++) if (!inMask(x + i, y + j)) ok = false;
      if (!ok || reserved(x, y, 3) || y > 114) continue;
      if (placed.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 9)) continue;
      placed.push({ x, y });
      const kind = placed.length % 8 === 0 ? 'cane' : 'ball';
      if (kind === 'cane') {
        ['wrw', 'r.r', 'w..', 'r..', 'w..'].forEach((row, j) => {
          for (let i = 0; i < 3; i++) if (row[i] !== '.') body.set(x + i, y + j, row[i] === 'r' ? '#e23a52' : '#fff6ee');
        });
      } else {
        const [c, d, l] = balls[placed.length % balls.length];
        ['.cc.', 'cccc', 'cccc', '.cc.'].forEach((row, j) => {
          for (let i = 0; i < 4; i++) if (row[i] === 'c') body.set(x + i, y + j, c);
        });
        body.set(x + 1, y + 1, l); body.set(x + 3, y + 2, d); body.set(x + 2, y + 3, d);
        body.set(x + 1, y - 1, '#e8d79a'); body.set(x + 2, y - 1, '#b8a060');
      }
    }

    // fairy lights (drawn live each frame)
    const lights = [];
    for (let tries = 0; tries < 2500 && lights.length < 78; tries++) {
      const x = Math.floor(R() * TW), y = 18 + Math.floor(R() * 102);
      if (!inMask(x, y) || reserved(x, y, 2) || x < 1 || x > TW - 2) continue;
      if (lights.some((l) => Math.abs(l.x - x) + Math.abs(l.y - y) < 5)) continue;
      if (placed.some((p) => x >= p.x - 1 && x <= p.x + 4 && y >= p.y - 2 && y <= p.y + 4)) continue;
      const col = LED[lights.length % LED.length];
      lights.push({ x, y, col, dim: mix(col, '#1a0f20', 0.55), halo: rgba(col, 0.42), phase: R() * 6.28, speed: 1.2 + R() * 2.4 });
    }

    body.outline('#08251a');

    // assemble: star, tree, skirt, presents
    const out = new Buf(TW, TH);
    const star = new Buf(17, 15).map([
      '........#........',
      '.......###.......',
      '.......#h#.......',
      '......##hy#......',
      '#######hyyy######',
      '.#hhhhhyyyyyyyy#.',
      '..#hhyyyyyyyyo#..',
      '...#yyyyyyyyo#...',
      '...#yyyyyyyyo#...',
      '..#yyyyo#yyyoo#..',
      '..#yyyo#.#yyoo#..',
      '.#yyo##...##yo#..',
      '.#o##.......##o#.',
      '.##...........##.'
    ], { '#': '#9a5a12', y: '#ffd45a', h: '#fff3b0', o: '#e0a23a' });
    out.blit(body, 0, 0);
    out.blit(star, TCX - 8, 2);

    // tree skirt
    const skirt = new Buf(TW, 16);
    for (let y = 0; y < 12; y++) for (let x = 0; x < TW; x++) {
      const dx = (x - TCX) / 38, dy = (y - 5) / 6;
      if (dx * dx + dy * dy > 1) continue;
      let c = y < 4 ? '#7b45b0' : '#5d2d8a';
      if (dx * dx + dy * dy > 0.72 && y > 5) c = (x % 3 === 0) ? '#e2d3ff' : '#fff1dc';
      skirt.set(x, y, c);
    }
    skirt.outline(OUT);
    out.blit(skirt, 0, 126);

    // presents
    const present = (x, y, w, h, body, shade, lid, rib, bow) => {
      const b = new Buf(w + 4, h + 5);
      const ox = 2, oy = 4;
      b.rect(ox, oy, w, h, body);
      b.rect(ox + w - 2, oy, 2, h, shade);
      b.rect(ox - 1, oy, w + 2, 2, lid);
      const mx = ox + Math.floor(w / 2) - 1;
      b.rect(mx, oy, 2, h, rib);
      b.rect(ox, oy + Math.floor(h / 2), w, 1, rib);
      b.map(['bb..bb', 'b.bb.b', '.bbbb.'], { b: bow }, mx - 2, oy - 3);
      b.outline(OUT);
      out.blit(b, x - ox, y - oy);
    };
    present(5, 133, 22, 20, '#7b4bb3', '#5d2d8a', '#9a6bd6', '#ffd45a', '#ffd45a');
    present(78, 139, 21, 14, '#e9b949', '#bf8f2a', '#ffd97a', '#8e5bd6', '#b98cff');
    present(25, 142, 15, 11, '#d6334d', '#a3203a', '#ff6b80', '#fff1dc', '#fff6e6');
    present(63, 136, 15, 17, '#2f8f5b', '#1f6b45', '#4fb377', '#cdb6ff', '#e2d3ff');
    present(42, 145, 14, 8, '#ff8ac4', '#d0589a', '#ffb8de', '#ffffff', '#ffffff');

    return { base: out.toCanvas(), lights };
  }

  // ---- The special ornament (the surprise) ----
  function buildOrnament() {
    const b = new Buf(ORN.w, ORN.h);
    b.map(['....gg', '...g..g', '....gg'], { g: '#ffd45a' }, 3, 0);
    b.rect(4, 3, 6, 2, '#e0a23a');
    b.rect(4, 3, 2, 1, '#fff3b0');
    for (let y = 5; y < 18; y++) for (let x = 0; x < 14; x++) {
      const dx = (x - 6.5) / 6.5, dy = (y - 11) / 6.4;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = '#9a5cf0';
      if (dx + dy < -0.6) c = '#c9a8ff';
      if (dx + dy > 0.7) c = '#6a33b8';
      if (d > 0.78 && dx + dy > 0.2) c = '#4f2290';
      b.set(x, y, c);
    }
    b.map(['.pp.pp.', 'ppwpppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'], { p: '#ff6fb5', w: '#ffd6ec' }, 3, 8);
    b.set(3, 7, '#f1e6ff'); b.set(2, 8, '#f1e6ff');
    const o = new Buf(ORN.w + 2, ORN.h + 2);
    o.blit(b, 1, 1);
    o.outline(OUT);
    return o.toCanvas();
  }

  // ---- "Click me!" arrow ----
  function buildArrow() {
    const b = new Buf(20, 13);
    for (let x = 1; x < 12; x++) for (let y = 5; y < 8; y++) b.set(x, y, y === 5 ? '#fff3b0' : y === 7 ? '#d99a2b' : '#ffd45a');
    for (let x = 11; x < 19; x++) {
      const half = Math.round(5 - (x - 11) * 5 / 7.5);
      for (let y = 6 - half; y <= 6 + half; y++) b.set(x, y, y < 6 ? '#fff3b0' : y > 6 ? '#e3a83c' : '#ffd45a');
    }
    b.outline(OUT);
    return b.toCanvas();
  }

  // ---- Hot chocolate ----
  const MW = 40, MH = 50, MUG_TOP = 16;
  function buildMug() {
    const b = new Buf(MW, MH), y0 = MUG_TOP;
    // saucer
    b.rect(2, y0 + 30, 36, 2, '#6a3fa0');
    b.rect(5, y0 + 29, 30, 1, '#8e5bd6');
    b.rect(5, y0 + 32, 30, 1, '#4b2775');
    // handle
    for (let y = y0 + 9; y < y0 + 23; y++) for (let x = 29; x < 36; x++) {
      if (x >= 34 || y <= y0 + 10 || y >= y0 + 21)b.set(x, y, x >= 35 || y >= y0 + 21 ? '#7656bf' : '#9a7ae0');
    }
    // mug body
    for (let y = y0 + 6; y < y0 + 30; y++) for (let x = 7; x < 30; x++) {
      let c = '#b99cf2';
      if (x < 9) c = '#dccbff';
      if (x > 25) c = '#8b69d4';
      if (y === y0 + 29) c = '#7656bf';
      b.set(x, y, c);
    }
    b.map(['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], { X: '#ff6fb5', H: '#ffd6ec' }, 15, y0 + 14);
    b.rect(7, y0 + 25, 23, 1, '#9a7ae0');
    // rim and cocoa
    b.rect(8, y0 + 2, 21, 1, '#efe6ff');
    b.rect(7, y0 + 3, 23, 1, '#d8c8ff');
    b.rect(8, y0 + 3, 21, 1, '#7a4329');
    b.rect(7, y0 + 4, 23, 1, '#d8c8ff');
    b.rect(8, y0 + 4, 21, 1, '#5e3220');
    b.rect(7, y0 + 5, 23, 1, '#efe6ff');
    b.rect(10, y0 + 3, 5, 1, '#94573a');
    // candy cane, hooked over the rim
    const cane = (x, y) => b.set(x, y, ((x + y) % 4 < 2) ? '#e23a52' : '#fff6ee');
    for (let y = 2; y < y0 + 4; y++) { cane(11, y); cane(12, y); }
    for (let x = 7; x < 13; x++) { cane(x, 0); cane(x, 1); }
    for (let y = 2; y < 6; y++) { cane(7, y); cane(8, y); }
    // marshmallows
    [[14, y0 - 1], [19, y0], [24, y0 - 2]].forEach(([x, y]) => {
      b.rect(x, y, 4, 3, '#fffaf2');
      b.rect(x + 3, y, 1, 3, '#e8dcff');
      b.rect(x, y + 2, 4, 1, '#d9c9f5');
    });
    b.outline(OUT);
    return b.toCanvas();
  }

  // ---- Holly for the sign ----
  function buildHolly() {
    const b = new Buf(16, 10).map([
      '.dg..........gd.',
      'dgGgg......ggGgd',
      '.dgGggg..gggGgd.',
      '..ddgggrrgggdd..',
      '.....drRrrd.....',
      '......rrrr......',
      '.......rr.......'
    ], { d: '#155036', g: '#2b8a58', G: '#5bbd7a', r: '#e23a52', R: '#ffb0bc' }, 0, 1);
    b.outline(OUT);
    return b.toCanvas();
  }

  // ---- Plane with banner ----
  const BANNER_TEXT = 'Next stop: Toronto';
  function buildPlane() {
    const p = new Buf(28, 11);
    p.rect(3, 4, 20, 4, '#f4efff');
    p.rect(3, 7, 20, 1, '#cbbcf0');
    p.rect(3, 6, 19, 1, '#cdb6ff');
    p.rect(23, 5, 2, 3, '#f4efff'); p.set(25, 6, '#f4efff'); p.set(25, 7, '#cbbcf0');
    p.set(23, 5, '#3b1a4c'); p.set(24, 5, '#3b1a4c');
    for (let x = 7; x < 21; x += 2) p.set(x, 5, '#8e5bd6');
    p.map(['p...', 'pp..', 'ppp.', 'pppp'], { p: '#8e5bd6' }, 3, 0);
    p.rect(10, 8, 7, 1, '#a58ad8'); p.rect(11, 9, 5, 1, '#8b6fd0');
    p.outline(OUT);
    const plane = p.toCanvas();

    const tw = textWidth(BANNER_TEXT);
    const bw = tw + 14, bh = 10;
    const banner = makeCanvas(bw + 2, bh + 2), g = banner.getContext('2d');
    g.fillStyle = OUT; g.fillRect(0, 0, bw + 2, bh + 2);
    g.fillStyle = '#fff6e6'; g.fillRect(1, 1, bw, bh);
    g.fillStyle = '#e2d3ff'; g.fillRect(1, bh, bw, 1);
    // little notched tail
    g.clearRect(0, 4, 2, 4); g.fillStyle = OUT; g.fillRect(2, 4, 1, 4);
    // heart
    g.fillStyle = '#ff6fb5';
    [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]].forEach(([x, y]) => g.fillRect(5 + x, 3 + y, 1, 1));
    drawText(g, BANNER_TEXT, 12, 3, '#3b1a4c');
    return { plane, banner, total: banner.width + 5 + plane.width };
  }

  const sprites = {
    tree: buildTree(), ornament: buildOrnament(), arrow: buildArrow(),
    mug: buildMug(), holly: buildHolly(), plane: buildPlane()
  };

  /* ======================================================================
     Room background (rebuilt on resize)
     ====================================================================== */
  let S = 3;                  // css pixels per art pixel — one scale for everything
  let L = null;               // current layout (logical pixels)
  let skyLayer = null, roomLayer = null;
  let stars = [], snow = [], garlandBulbs = [];
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function buildBackground() {
    const { W, H, win, glass, floorY, tower } = L;
    const R = rng(77);

    // --- sky, stars, moon and the Toronto skyline (seen through the window) ---
    skyLayer = makeCanvas(W, H);
    let g = skyLayer.getContext('2d');
    const bands = ['#170a2a', '#1f0e36', '#2a1448', '#391b5e', '#4d2577', '#66338f', '#8a4fa8'];
    for (let y = glass.y; y < glass.y + glass.h; y++) {
      const p = ((y - glass.y) / Math.max(1, glass.h - 1)) * (bands.length - 1);
      const i = Math.min(bands.length - 2, Math.floor(p)), f = p - i;
      for (let x = glass.x; x < glass.x + glass.w; x++) {
        g.fillStyle = f * 16 > BAYER[y % 4][x % 4] + 0.5 ? bands[i + 1] : bands[i];
        g.fillRect(x, y, 1, 1);
      }
    }
    stars = [];
    const nStars = Math.round(glass.w * glass.h / 110);
    for (let i = 0; i < nStars; i++) {
      const x = glass.x + 1 + Math.floor(R() * (glass.w - 2));
      const y = glass.y + 1 + Math.floor(R() * glass.h * 0.62);
      const col = ['#fff6e6', '#e2d3ff', '#ffe7a3'][i % 3];
      const big = R() < 0.14;
      stars.push({ x, y, col, big, twinkle: R() < 0.35, phase: R() * 6.28 });
      if (!big) { g.fillStyle = rgba(col, 0.8); g.fillRect(x, y, 1, 1); }
    }
    // crescent moon
    const mx = glass.x + glass.w - 12, my = glass.y + 9;
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      if (x * x + y * y > 26) continue;
      if ((x + 3) * (x + 3) + (y - 1) * (y - 1) <= 20) continue;
      g.fillStyle = x + y < -2 ? '#fffbea' : '#ffe7b0';
      g.fillRect(mx + x, my + y, 1, 1);
    }
    // skyline
    const ground = glass.y + glass.h - 3;
    const maxH = Math.max(8, Math.min(26, Math.round(glass.h * 0.3)));
    let x = glass.x - 2;
    while (x < glass.x + glass.w) {           // far buildings
      const w = 3 + Math.floor(R() * 5), h = 3 + Math.floor(R() * maxH * 0.6);
      g.fillStyle = '#3a2160'; g.fillRect(x, ground - h, w, h);
      x += w + (R() < 0.3 ? 1 : 0);
    }
    if (tower) {                                 // CN Tower and the dome beside it
      const th = Math.max(26, Math.min(80, Math.round(glass.h * 0.66)));
      const tx = tower;
      g.fillStyle = '#1c0c30';
      g.fillRect(tx - 1, ground - th * 0.55, 3, th * 0.55);
      g.fillRect(tx - 2, ground - th * 0.22, 5, th * 0.22);
      g.fillRect(tx, ground - th, 1, th);
      g.fillRect(tx - 1, ground - th * 0.8, 3, th * 0.25);
      const py = Math.round(ground - th * 0.62);
      g.fillRect(tx - 3, py, 7, 3); g.fillRect(tx - 2, py - 1, 5, 1); g.fillRect(tx - 2, py + 3, 5, 1);
      g.fillStyle = '#ffd27a'; g.fillRect(tx - 2, py + 1, 1, 1); g.fillRect(tx, py + 1, 1, 1); g.fillRect(tx + 2, py + 1, 1, 1);
      g.fillStyle = '#1c0c30'; g.fillRect(tx - 1, Math.round(ground - th * 0.8), 3, 2);
      for (let dx = -7; dx <= 7; dx++) {
        const hh = Math.round(Math.sqrt(1 - (dx * dx) / 64) * 5);
        g.fillStyle = '#2b1548'; g.fillRect(tx + 11 + dx, ground - hh, 1, hh);
        g.fillStyle = '#4a2f70'; g.fillRect(tx + 11 + dx, ground - hh, 1, 1);
      }
      L.towerTop = { x: tx, y: Math.round(ground - th) };
    }
    x = glass.x - 3;
    while (x < glass.x + glass.w) {            // near buildings with lit windows
      const w = 4 + Math.floor(R() * 6), h = 4 + Math.floor(R() * maxH);
      const nearTower = tower && x + w > tower - 6 && x < tower + 19;
      const hh = nearTower ? Math.min(h, 6) : h;
      g.fillStyle = '#24113c'; g.fillRect(x, ground - hh, w, hh);
      for (let wy = ground - hh + 2; wy < ground - 1; wy += 2) for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        if (R() < 0.2) { g.fillStyle = R() < 0.75 ? '#ffd27a' : '#c9b2f0'; g.fillRect(wx, wy, 1, 1); }
      }
      x += w + 1 + Math.floor(R() * 2);
    }
    g.fillStyle = '#efe6fb'; g.fillRect(glass.x, ground, glass.w, 1);
    g.fillStyle = '#d4c4ef'; g.fillRect(glass.x, ground + 1, glass.w, 2);

    // snowflakes outside
    snow = [];
    const nSnow = Math.round(glass.w * glass.h / 80);
    for (let i = 0; i < nSnow; i++) {
      snow.push({ x: glass.x + R() * glass.w, y: glass.y + R() * glass.h, v: 3 + R() * 6, ph: R() * 6.28, big: R() < 0.12 });
    }

    // --- the room ---
    roomLayer = makeCanvas(W, H);
    g = roomLayer.getContext('2d');
    g.fillStyle = '#3b1a4c'; g.fillRect(0, 0, W, H);
    for (let y = 4, row = 0; y < floorY; y += 10, row++) for (let x = (row % 2) * 7 + 3; x < W; x += 14) {
      g.fillStyle = '#43205a';
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#4f2a66'; g.fillRect(x, y, 1, 1);
    }
    // wainscot
    const wy = floorY - 16;
    g.fillStyle = '#2e1440'; g.fillRect(0, wy, W, 16);
    g.fillStyle = '#6c3b88'; g.fillRect(0, wy, W, 1);
    g.fillStyle = '#5a2f73'; g.fillRect(0, wy + 1, W, 2);
    for (let x = 6; x < W; x += 24) {
      g.fillStyle = '#25103a'; g.fillRect(x, wy + 5, 1, 9); g.fillRect(x, wy + 5, 18, 1);
      g.fillStyle = '#3a1a50'; g.fillRect(x + 18, wy + 5, 1, 9); g.fillRect(x, wy + 13, 19, 1);
    }
    g.fillStyle = '#1e0b2a'; g.fillRect(0, floorY - 2, W, 2);
    // wooden floor
    for (let y = floorY, row = 0; y < H; y += 5, row++) {
      g.fillStyle = row % 2 ? '#5a3330' : '#52302c'; g.fillRect(0, y, W, 5);
      g.fillStyle = '#3a1f22'; g.fillRect(0, y + 4, W, 1);
      for (let x = (row * 17) % 31; x < W; x += 31) {
        g.fillStyle = '#3a1f22'; g.fillRect(x, y, 1, 4);
        g.fillStyle = '#6b3f39'; g.fillRect(x + 1, y, 1, 1);
      }
    }
    // rug under the tree
    const rx = L.rug.x, ry = L.rug.y, rw = L.rug.rx, rh = L.rug.ry;
    for (let y = -rh; y <= rh; y++) for (let x = -rw; x <= rw; x++) {
      const d = (x * x) / (rw * rw) + (y * y) / (rh * rh);
      if (d > 1 || ry + y < floorY) continue;
      let c = '#6a3a9c';
      if (d > 0.82) c = '#a98ae0';
      else if (d > 0.7) c = '#4f2a78';
      else if (d < 0.45 && (Math.abs(x) + Math.abs(y) * 3) % 8 === 0) c = '#cdb6ff';
      g.fillStyle = c; g.fillRect(rx + x, ry + y, 1, 1);
    }

    // side table for the hot chocolate
    if (L.table) {
      const tb = L.table, cx = tb.x + Math.floor(tb.w / 2);
      g.fillStyle = OUT;
      g.fillRect(tb.x - 1, tb.y - 1, tb.w + 2, 6);
      g.fillRect(cx - 3, tb.y + 4, 6, tb.foot - tb.y - 4);
      g.fillRect(cx - 10, tb.foot - 2, 20, 3);
      g.fillStyle = '#7a4630'; g.fillRect(tb.x, tb.y, tb.w, 4);
      g.fillStyle = '#94593d'; g.fillRect(tb.x, tb.y, tb.w, 1);
      g.fillStyle = '#5e3322'; g.fillRect(tb.x, tb.y + 3, tb.w, 1);
      g.fillStyle = '#6b3d24'; g.fillRect(cx - 2, tb.y + 4, 4, tb.foot - tb.y - 6);
      g.fillStyle = '#8a5434'; g.fillRect(cx - 2, tb.y + 4, 1, tb.foot - tb.y - 6);
      g.fillStyle = '#7a4630'; g.fillRect(cx - 9, tb.foot - 1, 18, 1);
      // lace doily
      for (let x = tb.x + 3; x < tb.x + tb.w - 3; x++) {
        g.fillStyle = x % 2 ? '#e2d3ff' : '#fff6e6';
        g.fillRect(x, tb.y + 3, 1, 1);
        if (x % 3 === 0) g.fillRect(x, tb.y + 4, 1, 1);
      }
    }

    // window frame
    g.fillStyle = '#1e0b2a'; g.fillRect(win.x - 1, win.y - 1, win.w + 2, win.h + 2);
    g.fillStyle = '#efe3cf'; g.fillRect(win.x, win.y, win.w, win.h);
    g.fillStyle = '#fff8ea'; g.fillRect(win.x, win.y, win.w, 1); g.fillRect(win.x, win.y, 1, win.h);
    g.fillStyle = '#c8b59b'; g.fillRect(win.x, win.y + win.h - 1, win.w, 1); g.fillRect(win.x + win.w - 1, win.y, 1, win.h);
    g.clearRect(glass.x, glass.y, glass.w, glass.h);
    // mullions
    const cols = Math.max(1, Math.round(glass.w / 64));
    for (let i = 1; i < cols; i++) {
      const mxp = Math.round(glass.x + (glass.w * i) / cols) - 1;
      g.fillStyle = '#efe3cf'; g.fillRect(mxp, glass.y, 2, glass.h);
      g.fillStyle = '#c8b59b'; g.fillRect(mxp + 2, glass.y, 1, glass.h);
    }
    const myp = Math.round(glass.y + glass.h * 0.4);
    g.fillStyle = '#efe3cf'; g.fillRect(glass.x, myp, glass.w, 2);
    g.fillStyle = '#c8b59b'; g.fillRect(glass.x, myp + 2, glass.w, 1);
    // frost in the corners
    g.fillStyle = 'rgba(233,225,255,0.55)';
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7 - i; j++) {
      if ((i * 7 + j * 3) % 4 === 0) continue;
      g.fillRect(glass.x + i, glass.y + glass.h - 1 - j, 1, 1);
      g.fillRect(glass.x + glass.w - 1 - i, glass.y + glass.h - 1 - j, 1, 1);
    }
    // glass glints
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) { g.fillRect(glass.x + 6 + i, glass.y + 14 - i, 1, 1); g.fillRect(glass.x + 9 + i, glass.y + 14 - i, 1, 1); }
    // sill
    g.fillStyle = '#1e0b2a'; g.fillRect(win.x - 4, win.y + win.h, win.w + 8, 6);
    g.fillStyle = '#f6ecdc'; g.fillRect(win.x - 3, win.y + win.h, win.w + 6, 2);
    g.fillStyle = '#cdb89c'; g.fillRect(win.x - 3, win.y + win.h + 2, win.w + 6, 3);
    // evergreen garland across the top of the window
    garlandBulbs = [];
    const gx0 = win.x - 3, gx1 = win.x + win.w + 3, period = 22;
    for (let xx = gx0; xx < gx1; xx++) {
      const s = ((xx - gx0) % period) / period;
      const yy = win.y - 1 + Math.round(Math.sin(Math.PI * s) * 4);
      for (let k = 0; k < 3; k++) {
        const h = (xx * 31 + k * 17) % 5;
        g.fillStyle = h === 0 ? '#3fa36a' : h === 1 ? '#155036' : '#21754c';
        g.fillRect(xx, yy + k, 1, 1);
      }
      g.fillStyle = '#0f3d2b'; g.fillRect(xx, yy + 3, 1, 1);
      if (Math.abs(s - 0.33) < 0.5 / period || Math.abs(s - 0.7) < 0.5 / period) {
        garlandBulbs.push({ x: xx, y: yy + 4, col: LED[garlandBulbs.length % LED.length], phase: garlandBulbs.length * 1.7 });
      }
    }
    for (let xx = gx0; xx <= gx1; xx += period) {
      g.fillStyle = '#9a5cf0';
      g.fillRect(xx - 2, win.y - 2, 2, 2); g.fillRect(xx + 1, win.y - 2, 2, 2);
      g.fillStyle = '#ffd45a'; g.fillRect(xx, win.y - 2, 1, 2);
      g.fillStyle = '#6a33b8'; g.fillRect(xx - 1, win.y, 1, 3); g.fillRect(xx + 1, win.y, 1, 3);
    }
  }

  /* ======================================================================
     Layout
     ====================================================================== */
  const snap = (v) => Math.round(v / S) * S;

  function layout() {
    const vw = el.root.clientWidth, vh = window.innerHeight;
    const portrait = vw < 760 || vw / vh < 1;
    let signW, signLeft, signTop, signH, treeLeft, treeTop, sceneH;

    if (!portrait) {
      S = 2;
      for (let s = 8; s >= 2; s--) if (TH * s <= vh * 0.76 && TW * s <= vw * 0.36) { S = s; break; }
      el.root.style.setProperty('--s', S + 'px');
      treeLeft = snap(Math.min(vw * 0.69 - (TW * S) / 2, vw - TW * S - 24));
      signLeft = snap(Math.max(20, vw * 0.05));
      signW = snap(Math.min(600, Math.max(300, vw * 0.36), treeLeft - signLeft - 28));
      el.sign.style.width = signW + 'px';
      signH = el.sign.offsetHeight;
      sceneH = Math.max(vh, signH + 120, TH * S + 70);
      treeTop = snap(sceneH - Math.round(sceneH * 0.035) - TH * S);
      const floorCss = treeTop + 124 * S;
      signTop = snap(Math.max(40, (floorCss - signH) / 2 - sceneH * 0.03));
    } else {
      const maxSignW = Math.min(vw - 24, 540);
      el.sign.style.width = maxSignW + 'px';
      el.root.style.setProperty('--s', '2px');
      signH = el.sign.offsetHeight;
      S = 2;
      for (let s = 6; s >= 2; s--) if (TW * s <= vw * 0.9 && 36 + signH + 26 + TH * s + 10 <= vh) { S = s; break; }
      el.root.style.setProperty('--s', S + 'px');
      signW = snap(maxSignW);
      el.sign.style.width = signW + 'px';
      signH = el.sign.offsetHeight;
      signLeft = snap((vw - signW) / 2);
      signTop = snap(36);
      sceneH = Math.max(vh, signTop + signH + 26 + TH * S + 10);
      treeTop = snap(sceneH - 10 - TH * S);
      treeLeft = snap((vw - TW * S) / 2);
    }

    // logical (art pixel) coordinates
    const W = Math.ceil(vw / S), H = Math.ceil(sceneH / S);
    const tl = Math.round(treeLeft / S), tt = Math.round(treeTop / S);
    const floorY = tt + 124;
    const signL = { x: Math.round(signLeft / S), y: Math.round(signTop / S), w: Math.round(signW / S), h: Math.ceil(signH / S) };
    let win;
    if (!portrait) {
      const wx = signL.x + signL.w + Math.max(6, Math.round(W * 0.03));
      const wr = W - Math.max(5, Math.round(W * 0.035));
      const wy = Math.max(8, Math.round(H * 0.08));
      win = { x: wx, y: wy, w: Math.max(40, wr - wx), h: Math.max(30, floorY - 26 - wy) };
    } else {
      const wy = signL.y + Math.round(signL.h * 0.45);
      win = { x: Math.round(W * 0.05), y: wy, w: Math.round(W * 0.9), h: Math.max(30, floorY - 24 - wy) };
    }
    const F = 3;
    const glass = { x: win.x + F, y: win.y + F, w: win.w - F * 2, h: win.h - F * 2 };

    // put the CN Tower where the tree is not in the way
    let tower = null;
    const gapL = tl + 14 - glass.x, gapR = glass.x + glass.w - (tl + TW - 14);
    if (gapL >= 26) tower = glass.x + Math.round(gapL * 0.45);
    else if (gapR >= 30) tower = tl + TW - 14 + Math.round(gapR * 0.4);
    else if (gapL >= 12) tower = glass.x + 6;

    const planeTop = portrait ? Math.max(glass.y + 3, signL.y + signL.h + 3) : glass.y + 6;
    L = {
      W, H, portrait, win, glass, floorY, tower, planeY: planeTop,
      rug: { x: tl + TCX, y: Math.min(H - 4, tt + 140), rx: Math.round(TW * 0.62), ry: Math.max(5, Math.min(14, H - (tt + 140) - 1)) }
    };
    // In landscape the mug sits on a little side table, if there is room under the sign.
    if (!portrait) {
      const mx = Math.round(Math.max(12, vw * 0.04) / S);
      const top = Math.min(H - 22, Math.max(floorY + 4, H - 30));
      const mugCupTop = top - (MH - MUG_TOP);   // steam may drift past the sign; the cup may not
      if (mugCupTop > signL.y + signL.h + 1) L.table = { x: mx - 4, y: top, w: MW + 8, foot: H - 3 };
    }
    buildBackground();

    // apply sizes
    el.scene.style.height = sceneH + 'px';
    sizeCanvas(el.bg, W, H);
    el.sign.style.left = signLeft + 'px';
    el.sign.style.top = signTop + 'px';
    el.sign.style.setProperty('--rope', signTop + 'px');

    el.tree.style.left = treeLeft + 'px';
    el.tree.style.top = treeTop + 'px';
    sizeCanvas(el.treeCanvas, TW, TH);
    sizeCanvas(el.ornamentCanvas, sprites.ornament.width, sprites.ornament.height);
    el.ornament.style.setProperty('--ox', (ORN.x - 1) * S + 'px');
    el.ornament.style.setProperty('--oy', (ORN.y - 1) * S + 'px');
    el.ornament.style.setProperty('--ow', sprites.ornament.width * S + 'px');
    el.ornament.style.setProperty('--oh', sprites.ornament.height * S + 'px');
    sizeCanvas(el.sparkles, sprites.ornament.width + 16, sprites.ornament.height + 16);
    el.sparkles.style.left = (ORN.x - 9) * S + 'px';
    el.sparkles.style.top = (ORN.y - 9) * S + 'px';

    sizeCanvas(el.arrow, sprites.arrow.width, sprites.arrow.height);
    el.arrow.getContext('2d').drawImage(sprites.arrow, 0, 0);
    const arrowRight = treeLeft + (ORN.x - 3) * S;
    const arrowMidY = treeTop + (ORN.y + 11) * S;
    el.hint.style.left = (arrowRight - sprites.arrow.width * S) + 'px';
    el.hint.style.top = (arrowMidY - Math.round(sprites.arrow.height / 2) * S) + 'px';

    sizeCanvas(el.mug, MW, MH);
    const mugLeft = portrait ? snap(Math.max(4, treeLeft - MW * S * 0.35)) : snap(Math.max(12, vw * 0.04));
    el.mug.style.left = mugLeft + 'px';
    el.mug.style.top = (sceneH - MH * S - snap(portrait ? 4 : 10)) + 'px';
    if (L.table) el.mug.style.top = (L.table.y - (MH - 1)) * S + 'px';

    sizeCanvas(el.signLights, signL.w, 8);
    el.signLights.style.top = -4 * S + 'px';
    sizeCanvas(el.holly, sprites.holly.width, sprites.holly.height);
    el.holly.getContext('2d').drawImage(sprites.holly, 0, 0);

    sizeCanvas(el.fx, Math.ceil(vw / S), Math.ceil(vh / S));

    draw(performance.now() / 1000, 0);
  }

  function sizeCanvas(c, w, h) {
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    c.style.width = w * S + 'px';
    c.style.height = h * S + 'px';
  }

  /* ======================================================================
     Drawing each frame
     ====================================================================== */
  let celebrating = false;
  const confetti = [];

  function draw(t, dt) {
    if (!L) return;
    const still = reduced;
    const tm = still ? 0 : t;

    // background
    const g = el.bg.getContext('2d');
    g.clearRect(0, 0, L.W, L.H);
    g.drawImage(skyLayer, 0, 0);
    for (const s of stars) {
      if (!s.big && !(s.twinkle && !still)) continue;
      const on = still || !s.twinkle || Math.sin(tm * 1.7 + s.phase) > -0.2;
      if (s.big) {
        g.fillStyle = s.col; g.fillRect(s.x, s.y, 1, 1);
        if (on) { g.fillStyle = rgba(s.col, 0.55); g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
      } else if (!on) {
        g.fillStyle = '#24113c'; g.fillRect(s.x, s.y, 1, 1);
      }
    }
    if (L.towerTop) {
      g.fillStyle = (still || Math.floor(tm * 1.2) % 2 === 0) ? '#ff4d6d' : '#7a2a4a';
      g.fillRect(L.towerTop.x, L.towerTop.y - 1, 1, 1);
    }
    const { glass } = L;
    g.save();
    g.beginPath(); g.rect(glass.x, glass.y, glass.w, glass.h); g.clip();
    for (const f of snow) {
      if (!still) {
        f.y += f.v * dt;
        f.x += Math.sin(tm * 0.9 + f.ph) * 2.5 * dt;
        if (f.y > glass.y + glass.h) { f.y = glass.y - 2; f.x = glass.x + Math.random() * glass.w; }
      }
      g.fillStyle = f.big ? '#fff6e6' : 'rgba(242,234,255,0.85)';
      g.fillRect(Math.round(f.x), Math.round(f.y), f.big ? 2 : 1, f.big ? 2 : 1);
    }
    drawPlane(g, tm, still);
    g.restore();
    g.drawImage(roomLayer, 0, 0);
    for (const b of garlandBulbs) {
      const on = still || Math.sin(tm * 2.2 + b.phase) > -0.4;
      g.fillStyle = on ? b.col : mix(b.col, '#1a0f20', 0.55);
      g.fillRect(b.x, b.y, 1, 2);
      if (on) { g.fillStyle = rgba(b.col, 0.35); g.fillRect(b.x - 1, b.y, 3, 2); }
    }

    drawTree(tm, still);
    drawSparkles(tm, still);
    drawMug(tm, still);
    drawSignLights(tm, still);
    drawConfetti(dt, still);
  }

  function drawPlane(g, t, still) {
    const P = sprites.plane, { glass } = L;
    const speed = 11;
    const travel = glass.w + P.total + 8;
    const cycle = travel / speed + 5;
    let x;
    if (still) x = glass.x + Math.max(2, Math.round((glass.w - P.total) / 2));
    else {
      const k = t % cycle;
      if (k > travel / speed) return;
      x = Math.round(glass.x - P.total + k * speed);
    }
    const y = L.planeY + (still ? 0 : (Math.floor(t * 1.4) % 2));
    g.drawImage(P.banner, x, y);
    g.fillStyle = '#e2d3ff';
    g.fillRect(x + P.banner.width, y + 5, 5, 1);
    g.drawImage(P.plane, x + P.banner.width + 5, y - 1);
    const blink = still || Math.floor(t * 2) % 2 === 0;
    if (blink) { g.fillStyle = '#ff4d6d'; g.fillRect(x + P.banner.width + 5 + 13, y + 7, 1, 1); }
  }

  function drawTree(t, still) {
    const g = el.treeCanvas.getContext('2d');
    g.clearRect(0, 0, TW, TH);
    // star glow
    const pulse = still ? 0 : (Math.sin(t * 2) > 0 ? 1 : 0);
    for (let ring = 0; ring < 3; ring++) {
      const r = 9 + ring * 2 + pulse;
      g.fillStyle = `rgba(255,212,90,${0.2 - ring * 0.06})`;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const d = Math.abs(dx) + Math.abs(dy) * 1.2;
        if (d <= r && d > r - 2) g.fillRect(TCX + dx, 9 + dy, 1, 1);
      }
    }
    g.drawImage(sprites.tree.base, 0, 0);
    const fast = celebrating ? 3 : 1;
    for (const l of sprites.tree.lights) {
      const on = still || Math.sin(t * l.speed * fast + l.phase) > -0.5;
      const col = celebrating && !still ? LED[(Math.floor(t * 4) + l.x) % LED.length] : l.col;
      if (on) {
        g.fillStyle = celebrating ? rgba(col, 0.42) : l.halo;
        g.fillRect(l.x - 1, l.y, 3, 1); g.fillRect(l.x, l.y - 1, 1, 3);
        g.fillStyle = col; g.fillRect(l.x, l.y, 1, 1);
      } else {
        g.fillStyle = l.dim; g.fillRect(l.x, l.y, 1, 1);
      }
    }
  }

  function drawSparkles(t, still) {
    const g = el.sparkles.getContext('2d'), w = el.sparkles.width, h = el.sparkles.height;
    g.clearRect(0, 0, w, h);
    const spots = [[3, 6], [w - 4, 12], [w - 7, h - 5], [5, h - 9]];
    spots.forEach(([x, y], i) => {
      const phase = (t * 0.9 + i * 0.29) % 1;
      if (still ? i !== 1 : phase > 0.45) return;
      const big = still || phase < 0.22;
      g.fillStyle = '#ffe9a3';
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      if (big) { g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); g.fillRect(x, y - 2, 1, 1); g.fillRect(x, y + 2, 1, 1); }
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    });
    const og = el.ornamentCanvas.getContext('2d');
    if (!og._drawn) { og.drawImage(sprites.ornament, 0, 0); og._drawn = true; }
  }

  function drawMug(t, still) {
    const g = el.mug.getContext('2d');
    g.clearRect(0, 0, MW, MH);
    g.drawImage(sprites.mug, 0, 0);
    [[15, 0], [21, 2.1], [26, 4.2]].forEach(([bx, p]) => {
      for (let y = MUG_TOP - 1; y >= 1; y--) {
        const h = MUG_TOP - 1 - y;
        if (!still && (y + Math.floor(t * 7)) % 5 === 0) continue;
        if (still && y % 5 === 0) continue;
        const x = bx + Math.round(Math.sin(y * 0.55 + t * 2.4 + p) * (1 + h * 0.07));
        g.fillStyle = `rgba(243,234,255,${(0.75 * (1 - h / MUG_TOP)).toFixed(2)})`;
        g.fillRect(x, y, 1, 1);
      }
    });
  }

  function drawSignLights(t, still) {
    const c = el.signLights, g = c.getContext('2d'), w = c.width;
    g.clearRect(0, 0, w, c.height);
    const period = 12;
    for (let x = 0; x < w; x++) {
      const s = (x % period) / period;
      g.fillStyle = '#1c3a2a';
      g.fillRect(x, 1 + Math.round(Math.sin(Math.PI * s) * 2), 1, 1);
    }
    for (let x = 6, i = 0; x < w - 2; x += period, i++) {
      const col = LED[i % LED.length];
      const on = still || Math.sin(t * (celebrating ? 6 : 2.1) + i * 1.9) > -0.45;
      g.fillStyle = '#5b6b5f'; g.fillRect(x, 3, 2, 1);
      g.fillStyle = on ? col : mix(col, '#1a0f20', 0.55); g.fillRect(x, 4, 2, 3);
      if (on) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x, 4, 1, 1); g.fillStyle = rgba(col, 0.3); g.fillRect(x - 1, 4, 4, 4); }
    }
  }

  function drawConfetti(dt, still) {
    const c = el.fx, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (!celebrating) return;
    if (!still) {
      if (confetti.length < 180) {
        for (let i = 0; i < 3; i++)confetti.push({ x: Math.random() * c.width, y: -3, vy: 10 + Math.random() * 14, ph: Math.random() * 6.28, col: LED[(Math.random() * LED.length) | 0], tall: Math.random() < 0.5 });
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.y += p.vy * dt; p.x += Math.sin(p.y * 0.12 + p.ph) * 4 * dt;
        if (p.y > c.height + 3) confetti.splice(i, 1);
      }
    }
    for (const p of confetti) {
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tall ? 1 : 2, p.tall ? 2 : 1);
    }
  }

  /* ======================================================================
     Countdown
     ====================================================================== */
  const pad = (n) => String(n).padStart(2, '0');
  let tickTimer = 0;

  function tick() {
    const now = Date.now();
    const left = target - now;
    if (left <= 0) { celebrate(); return; }
    const s = Math.floor(left / 1000);
    el.days.textContent = pad(Math.floor(s / 86400));
    el.hours.textContent = pad(Math.floor((s % 86400) / 3600));
    el.minutes.textContent = pad(Math.floor((s % 3600) / 60));
    el.seconds.textContent = pad(s % 60);
    tickTimer = setTimeout(tick, 1000 - (now % 1000) + 10);
  }

  function celebrate() {
    clearTimeout(tickTimer);
    if (celebrating) return;
    celebrating = true;
    el.display.hidden = true;
    el.finale.hidden = false;
    el.sign.classList.add('is-here');
    // an opening burst of confetti (a still sprinkle when motion is reduced)
    const burst = reduced ? 70 : 110;
    for (let i = 0; i < burst; i++) {
      confetti.push({
        x: Math.random() * el.fx.width, y: Math.random() * el.fx.height * (reduced ? 1 : 0.6) - (reduced ? 0 : 10),
        vy: 10 + Math.random() * 14, ph: Math.random() * 6.28, col: LED[i % LED.length], tall: i % 2 === 0
      });
    }
    // the sign may have changed height
    requestAnimationFrame(layout);
  }

  /* ======================================================================
     Surprise popup
     ====================================================================== */
  function openGift() {
    if (el.dialog.open) return;
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
    el.root.classList.add('modal-open');
  }
  function closeGift() {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else { el.dialog.removeAttribute('open'); onClosed(); }
  }
  function onClosed() {
    el.root.classList.remove('modal-open');
    el.ornament.focus({ preventScroll: true });
  }
  el.ornament.addEventListener('click', openGift);
  el.hint.addEventListener('click', openGift);
  el.close.addEventListener('click', closeGift);
  el.dialog.addEventListener('close', onClosed);
  el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) closeGift(); });

  /* ======================================================================
     Start
     ====================================================================== */
  let last = 0, running = false;
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - last < 80) return;          // ~12 fps keeps the motion calm and pixel-like
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    draw(now / 1000, dt);
  }
  function setMotion() {
    reduced = reduceMQ.matches;
    el.root.classList.toggle('still', reduced);
    if (!reduced && !running) { running = true; last = 0; requestAnimationFrame(loop); }
    if (reduced) { running = false; draw(0, 0); }
  }
  (reduceMQ.addEventListener ? reduceMQ.addEventListener.bind(reduceMQ, 'change') : reduceMQ.addListener.bind(reduceMQ))(setMotion);

  let lastW = 0, lastH = 0, pending = false;
  window.addEventListener('resize', () => {
    const w = el.root.clientWidth, h = window.innerHeight;
    if (w === lastW && Math.abs(h - lastH) < 60) return;   // ignore mobile toolbar wiggles
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; lastW = w; lastH = h; layout(); });
  });

  tick();
  lastW = el.root.clientWidth; lastH = window.innerHeight;
  layout();
  setMotion();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
