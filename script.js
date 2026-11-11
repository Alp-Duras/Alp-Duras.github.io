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
    ornamentCanvas: $('ornament-canvas'), hint: $('hint'), fire: $('fireplace'),
    chai: $('pet-chai'), sef: $('pet-sef'), flash: $('pet-flash'), petTag: $('pet-tag'), arrow: $('arrow-canvas'), mug: $('mug'),
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

  // ---- Fireplace ----
  const FW = 84, FH = 72, MANTEL_Y = 10;
  const FB = { x: 22, y: 27, w: 40, h: 39 };      // firebox opening
  const FIRE_BASE = 59;
  function inFirebox(x, y) {
    if (x < FB.x || x >= FB.x + FB.w || y < FB.y || y >= FB.y + FB.h) return false;
    const dx = (x + 0.5 - (FB.x + FB.w / 2)) / (FB.w / 2);
    return y >= FB.y + 8 - 8 * Math.sqrt(Math.max(0, 1 - dx * dx));
  }
  function buildFireplace() {
    const b = new Buf(FW, FH);
    // stone surround
    const stones = ['#6f5a80', '#7b6690', '#655175', '#735e86'];
    for (let y = 14; y < 66; y++) {
      const row = Math.floor((y - 14) / 6), off = (row % 2) * 6;
      for (let x = 5; x < 79; x++) {
        const bx = Math.floor((x + off) / 12);
        const mortar = (y - 14) % 6 === 5 || (x + off) % 12 === 11;
        let c = mortar ? '#4a3a5c' : stones[(bx * 7 + row * 3) % 4];
        if (!mortar && (y - 14) % 6 === 0) c = mix(c, '#ffffff', 0.14);
        b.set(x, y, c);
      }
    }
    // arch trim and the dark firebox with soot-dark bricks
    for (let y = FB.y - 2; y < FB.y + FB.h; y++) for (let x = FB.x - 2; x < FB.x + FB.w + 2; x++) {
      if (inFirebox(x, y)) continue;
      const near = inFirebox(x + 1, y) || inFirebox(x - 1, y) || inFirebox(x, y + 1) || inFirebox(x + 2, y) || inFirebox(x - 2, y) || inFirebox(x, y + 2);
      if (near) b.set(x, y, '#9a86ad');
    }
    for (let y = FB.y; y < FB.y + FB.h; y++) for (let x = FB.x; x < FB.x + FB.w; x++) {
      if (!inFirebox(x, y)) continue;
      const brickRow = Math.floor((y - FB.y) / 4), off = (brickRow % 2) * 4;
      let c = ((y - FB.y) % 4 === 3 || (x + off) % 8 === 7) ? '#160812' : '#2a1020';
      if (x < FB.x + 3 || x > FB.x + FB.w - 4) c = '#12060f';
      b.set(x, y, c);
    }
    // grate and back log
    b.rect(FB.x + 4, 62, FB.w - 8, 1, '#3a3044');
    b.rect(FB.x + 6, 63, 1, 3, '#3a3044'); b.rect(FB.x + FB.w - 7, 63, 1, 3, '#3a3044');
    b.rect(FB.x + 9, 56, 22, 3, '#5b3428'); b.rect(FB.x + 9, 56, 22, 1, '#7a4a32');
    // hearth
    b.rect(0, 66, FW, 6, '#8a7698');
    b.rect(0, 66, FW, 1, '#a493b3');
    b.rect(0, 70, FW, 2, '#6a5578');
    for (let x = 13; x < FW; x += 14) b.rect(x, 67, 1, 3, '#5a4868');
    // mantel shelf and corbels
    b.rect(0, MANTEL_Y, FW, 1, '#a8694a');
    b.rect(0, MANTEL_Y + 1, FW, 2, '#7a4630');
    b.rect(0, MANTEL_Y + 3, FW, 1, '#5e3322');
    [[3, 0], [76, 1]].forEach(([x]) => { b.rect(x, 14, 5, 2, '#7a4630'); b.rect(x + 1, 16, 3, 2, '#6b3d24'); });
    // evergreen swag along the mantel edge
    for (let x = 1; x < FW - 1; x++) {
      const s = (x % 14) / 14, y = MANTEL_Y + 3 + Math.round(Math.sin(Math.PI * s) * 3);
      b.set(x, y, (x * 7) % 5 === 0 ? '#3fa36a' : '#21754c');
      b.set(x, y + 1, (x * 3) % 4 === 0 ? '#155036' : '#1d6b45');
    }
    // stockings
    const stocking = (ox, body, mark, markCol) => b.map([
      'cccccc....', 'cCcccc....', 'cccccc....', '.pppp.....', '.p' + mark + 'pp.....', '.pppp.....', '.pppp.....', '.pppp.....',
      '.ppppp....', '.pppppp...', '.ppppppp..', '.pppppppp.', '..ppppppp.', '...pppp...'
    ], { c: '#fff4e2', C: '#e2d3ff', p: body, h: markCol, s: markCol }, ox, 15);
    stocking(8, '#8e5bd6', 'h', '#ff6fb5');
    stocking(65, '#d6334d', 's', '#ffd45a');
    b.set(10, 14, '#ffd45a'); b.set(67, 14, '#ffd45a');
    // candles on the mantel (flames are drawn live)
    b.rect(9, 3, 3, 7, '#fff4e2'); b.rect(11, 3, 1, 7, '#e2d3ff');
    b.rect(15, 5, 3, 5, '#fff4e2'); b.rect(17, 5, 1, 5, '#e2d3ff');
    b.rect(8, 9, 11, 1, '#e0a23a');
    // a little framed heart
    b.rect(60, 1, 12, 9, '#ffd45a'); b.rect(61, 2, 10, 7, '#3b1a4c');
    b.map(['.pp.pp.', 'ppppppp', '.ppppp.', '..ppp..', '...p...'], { p: '#ff6fb5' }, 62, 3);
    b.outline(OUT);
    return b.toCanvas();
  }

  // ---- The pets ----
  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;

  // ---- Flash, the dog ----
  // Two versions to play with. Change FLASH_STYLE to switch:
  //   'big'      — the full-size Flash as a black goldendoodle, drawn natively at his large size (current)
  //   'original' — the first, small 1x Flash, kept exactly as he was
  const FLASH_STYLE = 'big';

  function buildFlash(step, tail, happy) {
    return FLASH_STYLE === 'original' ? buildFlashOriginal(step, tail, happy) : buildFlashBig(step, tail, happy);
  }

  // The first 1x Flash, saved as-is.
  function buildFlashOriginal(step, tail, happy) {
    const b = new Buf(42, 30);
    const D = { k: '#120d18', d: '#1d1726', m: '#2b2436', l: '#3d354b', g: '#6f6880', t: '#a08c74', sheen: '#58506a' };
    const fur = (x, y) => {
      const h = hash2(x * 3 + 11, y * 7 + 5);
      return h < 0.2 ? D.l : h < 0.58 ? D.m : h < 0.88 ? D.d : D.k;
    };
    const legs = [[11, 2, true], [14, 0, false], [26, 0, true], [29, 2, false]];
    for (const [lx, p, far] of legs) {
      const swing = step < 0 ? 0 : [-2, 0, 2, 0][(step + p) % 4];
      for (let y = 19; y < 27; y++) {
        const x0 = lx + Math.round((swing * (y - 19)) / 7);
        for (let i = 0; i < 3; i++) b.set(x0 + i, y, far ? (hash2(x0 + i, y) < 0.3 ? D.d : D.k) : fur(x0 + i, y));
      }
      b.rect(lx + swing, 27, 4, 1, far ? D.k : D.d);
    }
    for (let y = 0; y < 30; y++) for (let x = 0; x < 42; x++) {
      const j = (hash2(x, y + 40) - 0.5) * 0.22;
      if (ell(x, y, 18, 15, 12, 6.5) <= 1 + j || ell(x, y, 27, 13, 5, 7) <= 1 + j || ell(x, y, 31, 8, 5.5, 5) <= 1 + j) b.set(x, y, fur(x, y));
    }
    for (let i = 0; i < 8; i++) {
      const x = Math.round(7 - i * 0.6 + tail * i * 0.35), y = Math.round(12 - i * 1.05);
      b.set(x, y, fur(x, y)); b.set(x + 1, y, fur(x + 1, y)); if (i > 5) b.set(x, y, D.l);
    }
    for (let y = 7; y < 16; y++) for (let x = 32; x < 41; x++) {
      const inSnout = ell(x, y, 36, 10, 3.6, 2.6) <= 1;
      const inBeard = y >= 11 && y <= 14 + (x % 2) && x >= 33 && x <= 38 - (y > 13 ? 1 : 0);
      if (!inSnout && !inBeard) continue;
      const h = hash2(x * 5, y * 3);
      b.set(x, y, h < 0.32 ? D.g : h < 0.52 ? D.t : h < 0.8 ? D.m : D.d);
    }
    for (let y = 4; y < 17; y++) for (let x = 25; x < 32; x++) {
      if (ell(x, y, 28.5, 10, 2.4, 5.2) <= 1) b.set(x, y, hash2(x, y * 9) < 0.35 ? D.m : D.d);
    }
    const snap = b.px.slice();
    for (let y = 1; y < 30; y++) for (let x = 0; x < 42; x++) {
      if (snap[y * 42 + x] && !snap[(y - 1) * 42 + x] && y < 22) b.set(x, y, hash2(x, y) < 0.5 ? D.sheen : D.g);
    }
    b.set(31, 5, D.g); b.set(32, 5, D.l); b.set(33, 6, D.g); b.set(34, 6, D.l);
    b.set(33, 8, '#05030a'); b.set(32, 8, D.k); b.set(34, 7, D.g);
    b.set(39, 9, '#05030a'); b.set(40, 9, '#05030a'); b.set(39, 10, '#05030a'); b.set(40, 10, '#05030a'); b.set(39, 9, '#4a4058');
    if (happy) { b.set(37, 13, '#ff7a9a'); b.set(37, 14, '#ff7a9a'); b.set(38, 13, '#e0587c'); }
    const B = { b: '#2f6fd6', l: '#6aa6ff', d: '#1f4a9a', w: '#e8f0ff' };
    b.rect(25, 11, 7, 2, B.b); b.rect(25, 11, 7, 1, B.l);
    b.rect(25, 13, 6, 1, B.b); b.rect(26, 14, 4, 1, B.b); b.rect(27, 15, 2, 1, B.b); b.set(27, 16, B.d);
    b.set(30, 13, B.d); b.set(29, 14, B.d); b.set(26, 13, B.w); b.set(28, 14, B.w); b.set(29, 12, B.w);
    b.outline('#06030a');
    return b.toCanvas();
  }

  // The big Flash: a black goldendoodle. Shapes are described on a small design grid but
  // drawn pixel by pixel at full size, so curls and the outline stay one art pixel wide.
  // Doodle traits: round teddy-bear head, long heavy ears, short bearded muzzle,
  // dense curls, fluffy legs with pom paws, and a feathery plume tail.
  const FLASH_K = 2;            // design units -> art pixels
  function buildFlashBig(step, tail, happy) {
    const K = FLASH_K, DW = 54, DH = 38;
    const W = Math.ceil(DW * K) + 2, H = Math.ceil(DH * K) + 2;
    const b = new Buf(W, H);
    const D = { k: '#0f0b13', d: '#19131f', m: '#251d2d', l: '#352b3f', glint: '#4c4158', warm: '#4a3a34', sheen: '#5a5070' };
    const B = { b: '#8fb8ee', l: '#c4dcff', d: '#3b5fb0', w: '#ffffff' };
    const E = (u, v, cx, cy, rx, ry) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
    const swingOf = (p) => (step < 0 ? 0 : [-2.4, 0, 2.4, 0][(step + p) % 4]);

    // thick fluffy legs that end in round pom paws
    const LEG_TOP = 19, GROUND = 36;
    const inLeg = (u, v, lx, p, jit) => {
      if (v < LEG_TOP || v > GROUND) return false;
      const k = (v - LEG_TOP) / (GROUND - LEG_TOP);
      const cx = lx + swingOf(p) * k;
      if (v > GROUND - 2.4) return E(u, v, cx + 0.5, GROUND - 1.2, 2.9 + jit * 0.5, 1.3) <= 1;   // pom paw
      return Math.abs(u - cx) <= 2.9 - 0.5 * k + jit;
    };
    // feathery plume tail, curling up over the back
    const tailPts = [];
    for (let s = 0; s <= 1.0001; s += 0.04) {
      tailPts.push([8 - 4.4 * s + tail * 1.8 * s + 6 * s * s * s, 14 - 12 * s + 4.2 * s * s, 2.5 - 0.8 * s]);
    }
    const inTail = (u, v, jit) => tailPts.some(([tx, ty, r]) => (u - tx) ** 2 + (v - ty) ** 2 <= (r + jit) ** 2);

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x - 1 + 0.5) / K, v = (y - 1 + 0.5) / K;
      const j = (hash2(x * 2 + 7, y * 3 + 1) - 0.5) * 0.2;     // curly edges
      const jl = (hash2(x + 5, y * 5) - 0.5) * 0.9;            // shaggier edges on legs and tail
      let c = null;

      if (inLeg(u, v, 10, 2, jl) || inLeg(u, v, 31, 0, jl)) c = 'K';    // far legs
      if (inTail(u, v, jl)) c = 'F';

      const torso = E(u, v, 21, 16, 12.5, 6.6) <= 1 + j;
      const rump = E(u, v, 10.5, 15.5, 5.6, 6.2) <= 1 + j;
      const thigh = E(u, v, 13, 19.5, 5, 4.8) <= 1 + j;
      const belly = u > 14 && u < 31 && v > 19 && v < 22.6 + (hash2(x, 9) - 0.5) * 1.8;   // fluffy fringe under the belly
      const chest = E(u, v, 32, 17, 6.2, 7.6) <= 1 + j;
      const neck = E(u, v, 35.5, 12, 4.6, 5.6) <= 1 + j;
      const head = E(u, v, 39.5, 8.6, 7.4, 7) <= 1 + j * 1.8;              // round teddy-bear dome
      if (torso || rump || thigh || belly || chest || neck || head) c = 'F';

      if (inLeg(u, v, 14.5, 0, jl) || inLeg(u, v, 34.5, 2, jl)) c = 'F';   // near legs

      // short, fluffy, bearded muzzle
      const muzzle = E(u, v, 46, 11.6, 4.4, 3.5) <= 1 + j * 1.5;
      const beard = u > 41.5 && u < 49 && v > 12 && v < 16.2 + (hash2(x, 5) - 0.5) * 1.6 - Math.max(0, u - 47) * 0.9;
      if (muzzle || beard) c = 'M';

      // long heavy ear, hanging from the side of the head
      const ear = E(u, v, 37.2, 12.4, 3.4, 6.6) <= 1 + j * 1.6;
      if (ear) c = 'E';

      // light-blue bandana wrapped around the neck, under the ear
      const along = (u - 34.4) * 0.66 - (v - 15.6) * 0.75;
      if ((chest || neck) && Math.abs(along) <= 1.5 && !(ear && v < 16.5)) c = along > 0.9 ? 'bl' : along < -0.95 ? 'bd' : 'bb';

      if (c) b.set(x, y, c);
    }

    // turn the shape tokens into curly black fur
    const snap = b.px.slice();
    const tok = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : snap[y * W + x]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = tok(x, y);
      if (!c) continue;
      const curl = hash2(Math.floor(x / 2) + 31, Math.floor(y / 2) + 17);      // curls come in little clumps
      const h = hash2(x * 3 + 11, y * 7 + 5) * 0.45 + curl * 0.55;
      let col;
      if (c === 'F') col = h < 0.12 ? D.glint : h < 0.3 ? D.l : h < 0.62 ? D.m : h < 0.88 ? D.d : D.k;
      else if (c === 'K') col = h < 0.3 ? D.d : D.k;
      else if (c === 'E') {
        // the ear's edge catches a little light so it reads against the head
        const edge = tok(x - 1, y) !== 'E' || tok(x + 1, y) !== 'E';
        col = edge ? (h < 0.55 ? D.sheen : D.glint) : (h < 0.25 ? D.l : h < 0.7 ? D.d : D.k);
      }
      else if (c === 'M') col = h < 0.08 ? D.warm : h < 0.2 ? D.glint : h < 0.55 ? D.m : D.d;
      else if (c === 'bb') col = ((x * 5 + y * 3) % 11 === 0) ? B.w : B.b;
      else if (c === 'bl') col = B.l;
      else col = B.d;
      if ((c === 'F' || c === 'E') && !tok(x, y - 1) && y < 24 * K) col = curl < 0.5 ? D.sheen : D.glint;
      b.set(x, y, col);
    }

    // face: eye under a fluffy brow, big nose, tongue when happy
    const P = (u, v, w, h, col) => b.rect(Math.round(u * K) + 1, Math.round(v * K) + 1, w, h, col);
    P(40.6, 5.6, 4, 1, D.glint); P(41.6, 5.2, 2, 1, D.sheen);              // brow fluff
    P(41.4, 6.8, 3, 2, '#05030a'); P(41.4, 6.8, 1, 1, '#ece4f4');            // eye with a glint
    P(48.6, 9.2, 4, 3, '#05030a'); P(49.1, 9.2, 2, 1, '#4e4458');            // nose
    P(45.5, 13.6, 5, 1, '#05030a');                                          // mouth
    if (happy) { P(46.2, 14, 3, 4, '#ff7a9a'); P(46.7, 15.4, 2, 1, '#e0587c'); }
    b.outline('#06030a');
    return b.toCanvas();
  }

  // Chai: a round black British Shorthair loaf with folded ears and big yellow-green eyes.
  function buildChai(blink, tailUp) {
    const W2 = 31, H2 = 24, ox = 1, oy = 1;
    const b = new Buf(W2, H2);
    const C = { k: '#0f0b14', d: '#1c1623', m: '#28202f', l: '#3a3045', s: '#5e5270', g: '#8a8094' };
    const fur = (x, y) => { const h = hash2(x * 7, y * 13); return h < 0.15 ? C.l : h < 0.62 ? C.m : C.d; };
    const set = (x, y, c) => b.set(x + ox, y + oy, c);
    const head = (x, y) => ell(x, y, 14, 8, 8, 6.8) <= 1;
    for (let y = 0; y < 22; y++) for (let x = 0; x < 29; x++) {
      if (ell(x, y, 14, 16, 12.5, 5.5) <= 1) set(x, y, fur(x, y));
    }
    // shadow under the chin so the round head sits on the body
    for (let x = 0; x < 29; x++) for (let y = 10; y < 18; y++) if (!head(x, y) && head(x, y - 1)) { set(x, y, C.k); set(x, y + 1, C.d); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 29; x++) if (head(x, y)) set(x, y, fur(x, y));
    // tail curled along the front, tip twitching
    for (let x = 17; x < 26; x++) set(x, 20, C.d);
    set(25, 19, C.d); set(26, 18, C.d); set(26, tailUp ? 16 : 17, C.l); if (tailUp) set(26, 17, C.d);
    // folded ears: little rounded caps
    [[7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [6, 4]].forEach(([x, y]) => set(x, y, C.d));
    [[19, 2], [20, 2], [21, 2], [20, 3], [21, 3], [22, 3], [22, 4]].forEach(([x, y]) => set(x, y, C.d));
    set(7, 2, C.s); set(8, 2, C.s); set(20, 2, C.s); set(21, 2, C.s);
    // front paws
    b.rect(ox + 8, oy + 19, 5, 2, C.m); b.rect(ox + 16, oy + 19, 5, 2, C.m);
    set(9, 20, C.s); set(11, 20, C.s); set(17, 20, C.s); set(19, 20, C.s);
    // sheen on the head and back
    const snap = b.px.slice();
    for (let y = 1; y < H2; y++) for (let x = 0; x < W2; x++) if (snap[y * W2 + x] && !snap[(y - 1) * W2 + x]) b.set(x, y, C.s);
    set(10, 3, C.l); set(11, 3, C.l); set(17, 3, C.l); set(18, 3, C.l);
    // face
    if (blink) {
      for (let x = 9; x < 12; x++) set(x, 8, C.g);
      for (let x = 16; x < 19; x++) set(x, 8, C.g);
    } else {
      [[9, '#d4e07a', '#a8bc56'], [16, '#f2d05a', '#c8a032']].forEach(([x, top, bot]) => {
        set(x, 7, top); set(x + 1, 7, '#0a0810'); set(x + 2, 7, top);
        set(x, 8, top); set(x + 1, 8, '#0a0810'); set(x + 2, 8, bot);
        set(x, 9, bot); set(x + 1, 9, '#0a0810'); set(x + 2, 9, bot);
        set(x, 7, '#fffbe0');
      });
    }
    set(8, 5, C.s); set(9, 5, C.s); set(10, 6, C.s); set(11, 6, C.s);       // grumpy brows
    set(16, 6, C.s); set(17, 6, C.s); set(18, 5, C.s); set(19, 5, C.s);
    set(13, 11, C.l); set(15, 11, C.l); set(14, 11, '#5a3a4c'); set(14, 12, C.s);
    set(13, 13, C.s); set(15, 13, C.s); set(14, 14, C.g);
    [[3, 11], [4, 11], [5, 12], [4, 13], [24, 11], [25, 11], [23, 12], [24, 13]].forEach(([x, y]) => set(x, y, C.g));
    b.outline('#06030a');
    return b.toCanvas();
  }

  // Sef: a fluffy orange Maine Coon, lying down and dozing by the tree (faces right).
  const SEF_Z = 9;   // rows above the cat for the floating z's
  function buildSef(awake, breath) {
    const b = new Buf(36, 25 + SEF_Z), oy = SEF_Z;
    const O = { o: '#e8913f', s: '#c06a2a', l: '#f6b56a', w: '#fff0dc', p: '#f0a0a0' };
    const set = (x, y, c) => b.set(x, y + oy, c);
    const furO = (x, y) => (((x + Math.floor(y / 2)) % 5 === 0 && y < 17) ? O.s : (hash2(x, y) < 0.12 ? O.l : O.o));
    for (let y = 0; y < 25; y++) for (let x = 0; x < 36; x++) {
      const j = (hash2(x + 3, y + 9) - 0.5) * 0.2;
      if (ell(x, y, 14, 15 - breath * 0.5, 12, 6 + breath * 0.5) <= 1 + j) set(x, y, y > 18 ? O.l : furO(x, y));
    }
    // head with a fluffy ruff
    for (let y = 2; y < 18; y++) for (let x = 17; x < 34; x++) {
      const j = (hash2(x * 2, y) - 0.5) * 0.3;
      if (ell(x, y, 25.5, 9, 6.2, 5.6) <= 1 + j) set(x, y, hash2(x, y * 3) < 0.15 ? O.l : O.o);
      if (y >= 12 && ell(x, y, 25.5, 14, 5.2, 3.4) <= 1 + j) set(x, y, hash2(x, y) < 0.3 ? O.l : O.w);
    }
    // tufted ears
    [[21, 1, O.l], [21, 2, O.o], [22, 2, O.o], [20, 3, O.o], [21, 3, O.p], [22, 3, O.o], [23, 3, O.o],
     [30, 1, O.l], [29, 2, O.o], [30, 2, O.o], [28, 3, O.o], [29, 3, O.p], [30, 3, O.o], [31, 3, O.o]].forEach(([x, y, c]) => set(x, y, c));
    set(21, 0, O.w); set(30, 0, O.w);
    // forehead tabby marks
    set(24, 4, O.s); set(25, 5, O.s); set(26, 4, O.s); set(27, 5, O.s); set(23, 6, O.s); set(28, 6, O.s);
    // eyes
    if (awake) {
      set(22, 9, '#7ad6a0'); set(23, 9, '#1a1010'); set(22, 10, '#3f9a6a'); set(23, 10, '#1a1010');
      set(28, 9, '#1a1010'); set(29, 9, '#7ad6a0'); set(28, 10, '#1a1010'); set(29, 10, '#3f9a6a');
    } else {
      set(21, 9, '#7a3a1a'); set(22, 10, '#7a3a1a'); set(23, 10, '#7a3a1a');
      set(28, 10, '#7a3a1a'); set(29, 10, '#7a3a1a'); set(30, 9, '#7a3a1a');
    }
    // muzzle and nose
    set(24, 11, O.w); set(26, 11, O.w); set(25, 11, O.p); set(25, 12, O.w); set(24, 12, O.w); set(26, 12, O.w);
    // paws stretched forward
    for (let x = 26; x < 34; x++) { set(x, 19, O.o); set(x, 20, x > 31 ? O.l : O.o); }
    set(33, 19, O.l);
    // the enormous fluffy tail, wrapped around the front
    for (let i = 0; i < 22; i++) {
      const x = 1 + i, y = 17 + Math.round(Math.sin((i / 21) * Math.PI) * 3);
      for (let k = 0; k < 3; k++) set(x, y + k, i > 18 ? O.w : (i % 4 === 0 ? O.s : (k === 0 ? O.l : O.o)));
    }
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
    mug: buildMug(), holly: buildHolly(), plane: buildPlane(), fireplace: buildFireplace(),
    flash: {
      walk: [0, 1, 2, 3].map((s) => buildFlash(s, [-1, 0, 1, 0][s], false)),
      stand: [buildFlash(-1, -1, false), buildFlash(-1, 1, false)],
      happy: [buildFlash(-1, -1.5, true), buildFlash(-1, 1.5, true)]
    },
    chai: { open: buildChai(false, false), blink: buildChai(true, false), twitch: buildChai(false, true) },
    sef: { sleep: [buildSef(false, 0), buildSef(false, 1)], awake: buildSef(true, 0) }
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
    const setS = (s) => { S = s; el.root.style.setProperty('--s', s + 'px'); };
    const measureSign = (w) => { el.sign.style.width = w + 'px'; return el.sign.offsetHeight; };
    let signW, signLeft, signTop, signH, treeLeft, treeTop, sceneH, fpLeft, fpTop, mugLeft, mugTop;

    if (!portrait) {
      // Sign hangs over the mantel on the left; the tree stands by the window on the right.
      const plan = (s) => {
        setS(s);
        const tLeft = snap(Math.min(vw * 0.69 - (TW * s) / 2, vw - TW * s - 24));
        const sLeft = snap(Math.max(20, vw * 0.05));
        const sW = snap(Math.min(600, Math.max(300, vw * 0.36), tLeft - sLeft - 28));
        const sH = measureSign(sW);
        // height needed so the sign clears the mantel candles
        const need = Math.ceil((36 + sH + 3 * s + (TH - 130 + FH) * s) / 0.97);
        return { tLeft, sLeft, sW, sH, need, fits: FW * s <= tLeft - 24 && need <= vh };
      };
      let p = null;
      for (let s = 8; s >= 2 && !p; s--) {
        if (TH * s > vh * 0.76 || TW * s > vw * 0.36) continue;
        const q = plan(s);
        if (q.fits) p = q;
      }
      if (!p) p = plan(2);
      treeLeft = p.tLeft; signLeft = p.sLeft; signW = p.sW; signH = p.sH;
      sceneH = Math.max(vh, p.need, TH * S + 70);
      treeTop = snap(sceneH - Math.round(sceneH * 0.03) - TH * S);
      const floorCss = treeTop + 124 * S;
      fpTop = floorCss + (6 - FH) * S;
      const signMid = signLeft + signW / 2;
      fpLeft = snap(Math.max(8, Math.min(signMid - (FW * S) / 2, treeLeft - FW * S - 12)));
      signTop = snap(Math.max(32, Math.min((fpTop - signH) / 2, fpTop - 3 * S - signH)));
      mugLeft = snap(Math.max(8, vw * 0.025));
      mugTop = sceneH - MH * S - snap(8);
    } else {
      // Sign on top; fireplace bottom-left with the mug on its mantel; tree on the right.
      const maxSignW = Math.min(vw - 24, 540);
      setS(2);
      signH = measureSign(maxSignW);
      let s = 2;
      for (let k = 6; k >= 2; k--) {
        if (TW * k <= vw * 0.6 && FW * k <= vw * 0.5 && 36 + signH + 26 + TH * k + 10 <= vh) { s = k; break; }
      }
      setS(s);
      signW = snap(maxSignW);
      signH = measureSign(signW);
      signLeft = snap((vw - signW) / 2);
      signTop = snap(36);
      sceneH = Math.max(vh, signTop + signH + 26 + TH * S + 10);
      const place = () => {
        treeTop = snap(sceneH - 10 - TH * S);
        treeLeft = snap(vw - TW * S - Math.max(4, vw * 0.02));
        fpTop = treeTop + (124 + 6 - FH) * S;
        fpLeft = snap(Math.max(4, vw * 0.02));
        mugLeft = fpLeft + (FW - MW + 1) * S;
        mugTop = fpTop + (MANTEL_Y - MH + 1) * S;
      };
      place();
      const clash = signTop + signH + 6 - (mugTop + MUG_TOP * S);
      if (clash > 0) { sceneH += snap(clash + S); place(); }
    }

    // logical (art pixel) coordinates
    const W = Math.ceil(vw / S), H = Math.ceil(sceneH / S);
    const tl = Math.round(treeLeft / S), tt = Math.round(treeTop / S);
    const fl = Math.round(fpLeft / S), ft = Math.round(fpTop / S);
    const floorY = tt + 124;
    const signL = { x: Math.round(signLeft / S), y: Math.round(signTop / S), w: Math.round(signW / S), h: Math.ceil(signH / S) };
    let win;
    if (!portrait) {
      const wx = Math.max(signL.x + signL.w, fl + FW) + Math.max(6, Math.round(W * 0.03));
      const wr = W - Math.max(5, Math.round(W * 0.035));
      const wy = Math.max(8, Math.round(H * 0.08));
      win = { x: wx, y: wy, w: Math.max(40, wr - wx), h: Math.max(30, floorY - 26 - wy) };
    } else {
      const wy = signL.y + Math.round(signL.h * 0.45);
      win = { x: Math.round(W * 0.05), y: wy, w: Math.round(W * 0.9), h: Math.max(30, Math.min(floorY - 24, ft - 6) - wy) };
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
      fire: { x: fl + FB.x + FB.w / 2, y: ft + FH + 1, rx: Math.round(FW * 0.55) },
      rug: { x: tl + TCX, y: Math.min(H - 4, tt + 140), rx: Math.round(TW * 0.62), ry: Math.max(5, Math.min(14, H - (tt + 140) - 1)) }
    };
    buildBackground();

    // apply sizes
    el.scene.style.height = sceneH + 'px';
    sizeCanvas(el.bg, W, H);
    el.sign.style.left = signLeft + 'px';
    el.sign.style.top = signTop + 'px';
    el.sign.style.setProperty('--rope', signTop + 'px');

    sizeCanvas(el.fire, FW, FH);
    el.fire.style.left = fpLeft + 'px';
    el.fire.style.top = fpTop + 'px';

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
    el.mug.style.left = mugLeft + 'px';
    el.mug.style.top = mugTop + 'px';

    sizeCanvas(el.signLights, signL.w, 8);
    el.signLights.style.top = -4 * S + 'px';
    sizeCanvas(el.holly, sprites.holly.width, sprites.holly.height);
    el.holly.getContext('2d').drawImage(sprites.holly, 0, 0);

    sizeCanvas(el.fx, Math.ceil(vw / S), Math.ceil(vh / S));

    // pets: Chai warms up by the fire, Sef naps on the rug, Flash wanders in front
    const dog = sprites.flash.walk[0], chaiC = sprites.chai.open, sefC = sprites.sef.awake;
    const ml = Math.round(mugLeft / S);
    if (!portrait) {
      pets.chai = { x: fl + FB.x + FB.w - 8, bottom: ft + FH + 4 };
      pets.sef = { x: Math.min(W - sefC.width - 2, tl + TW - 10), bottom: Math.min(H - 4, tt + 151) };
      pets.dogMin = ml + MW + 2;
      pets.dogMax = Math.max(pets.dogMin + 20, tl + 6);
    } else {
      pets.chai = { x: fl + FB.x + 4, bottom: ft + FH + 4 };
      pets.sef = { x: win.x + 1, bottom: win.y + win.h + 2 };   // napping on the window sill
      pets.dogMin = 2;
      pets.dogMax = Math.max(pets.dogMin + 20, W - dog.width - 2);
    }
    pets.dogBottom = H - 1;
    pets.dogX = Math.min(pets.dogMax, Math.max(pets.dogMin, pets.dogX ?? (pets.dogMin + pets.dogMax) / 2));
    placePet(el.chai, chaiC, pets.chai.x, pets.chai.bottom);
    placePet(el.sef, sefC, pets.sef.x, pets.sef.bottom);
    placePet(el.flash, dog, pets.dogX, pets.dogBottom);

    draw(performance.now() / 1000, 0);
  }

  function placePet(btn, sprite, x, bottom) {
    const c = btn.firstElementChild;
    sizeCanvas(c, sprite.width, sprite.height);
    btn.style.left = Math.round(x) * S + 'px';
    btn.style.top = (bottom - sprite.height) * S + 'px';
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

    // warm firelight spilling onto the floor
    if (L.fire) {
      const fl = L.fire, a = still ? 0.6 : 0.5 + 0.18 * Math.sin(tm * 7) + 0.1 * Math.sin(tm * 13.7);
      for (let y = fl.y - 2; y < Math.min(L.H, fl.y + 14); y++) for (let x = fl.x - fl.rx; x <= fl.x + fl.rx; x++) {
        const d = ((x - fl.x) / fl.rx) ** 2 + ((y - fl.y) / 14) ** 2;
        if (d > 1 || y < L.floorY) continue;
        if ((1 - d) * a * 16 > BAYER[y % 4][(x + 64) % 4] + 0.5) {
          g.fillStyle = 'rgba(255,160,80,0.22)'; g.fillRect(x, y, 1, 1);
        }
      }
    }

    drawFireplace(tm, still);
    drawTree(tm, still);
    drawSparkles(tm, still);
    drawMug(tm, still);
    drawPets(tm, dt, still);
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

  /* ---------- pets, every frame ---------- */
  const pets = { dogX: null, dir: 1, mode: 'walk', timer: 4, walked: 0, happyUntil: 0, sefAwakeUntil: 0, chaiBlinkUntil: 0 };

  function drawPets(t, dt, still) {
    if (!pets.chai) return;
    const now = performance.now() / 1000;

    // Chai: blinks now and then, flicks her tail, slow-blinks when greeted
    const chaiFrame = (now < pets.chaiBlinkUntil || (!still && t % 6.5 < 0.22)) ? sprites.chai.blink
      : (!still && t % 3.7 < 0.5) ? sprites.chai.twitch : sprites.chai.open;
    paint(el.chai, chaiFrame);

    // Sef: sleeps and breathes, z's drift up; opens his eyes when greeted
    const awake = now < pets.sefAwakeUntil;
    const sefFrame = awake ? sprites.sef.awake : sprites.sef.sleep[still ? 0 : Math.floor(t * 0.8) % 2];
    const sg = paint(el.sef, sefFrame);
    if (!awake) {
      const zs = still ? [0.5] : [0, 0.5];
      zs.forEach((off) => {
        const k = still ? 0.5 : (t * 0.35 + off) % 1;
        const x = 31 + Math.round(k * 1), y = Math.round(5 - k * 5);
        sg.fillStyle = rgba('#cdb6ff', still ? 0.9 : Math.min(1, (1 - k) * 1.6));
        sg.fillRect(x, y, 4, 1); sg.fillRect(x + 2, y + 1, 1, 1); sg.fillRect(x + 1, y + 2, 1, 1); sg.fillRect(x, y + 3, 4, 1);
      });
    }

    // Flash: trots between the mug and the tree, pausing to wag
    const happy = now < pets.happyUntil;
    if (!still && dt > 0 && !happy) {
      if (pets.mode === 'walk') {
        pets.dogX += pets.dir * 12 * dt;
        pets.walked += 12 * dt;
        if (pets.dogX <= pets.dogMin || pets.dogX >= pets.dogMax) {
          pets.dogX = Math.min(pets.dogMax, Math.max(pets.dogMin, pets.dogX));
          pets.dir *= -1; pets.mode = 'pause'; pets.timer = 2.5 + Math.random() * 3;
        } else if ((pets.timer -= dt) <= 0) {
          pets.mode = 'pause'; pets.timer = 2 + Math.random() * 3;
        }
      } else if ((pets.timer -= dt) <= 0) {
        pets.mode = 'walk'; pets.timer = 5 + Math.random() * 6;
        if (Math.random() < 0.35) pets.dir *= -1;
      }
    }
    let dogFrame;
    if (happy) dogFrame = sprites.flash.happy[Math.floor(now * 8) % 2];
    else if (still || pets.mode === 'pause') dogFrame = sprites.flash.stand[still ? 0 : Math.floor(t * 2.5) % 2];
    else dogFrame = sprites.flash.walk[Math.floor(pets.walked / 3) % 4];
    const hop = happy && Math.floor(now * 4) % 2 ? 1 : 0;
    el.flash.style.left = Math.round(pets.dogX) * S + 'px';
    el.flash.style.top = (pets.dogBottom - dogFrame.height - hop) * S + 'px';
    el.flash.firstElementChild.classList.toggle('flip', pets.dir < 0);
    paint(el.flash, dogFrame);
    if (tagFor) positionTag();
  }

  function paint(btn, sprite) {
    const g = btn.firstElementChild.getContext('2d');
    g.clearRect(0, 0, sprite.width, sprite.height);
    g.drawImage(sprite, 0, 0);
    return g;
  }

  // greet a pet: show its name and let it react
  let tagFor = null, tagTimer = 0;
  const PET_NAMES = { 'pet-chai': 'Chai', 'pet-sef': 'Sef', 'pet-flash': 'Flash' };
  function positionTag() {
    const r = tagFor.getBoundingClientRect(), s = el.scene.getBoundingClientRect();
    el.petTag.style.left = (r.left - s.left + r.width / 2) + 'px';
    el.petTag.style.top = (r.top - s.top - el.petTag.offsetHeight - 4 * S) + 'px';
  }
  function greet(btn) {
    const now = performance.now() / 1000;
    if (btn === el.flash) { pets.happyUntil = now + 2.2; pets.mode = 'pause'; pets.timer = 1.5; }
    if (btn === el.sef) pets.sefAwakeUntil = now + 2.6;
    if (btn === el.chai) pets.chaiBlinkUntil = now + 1.1;
    tagFor = btn;
    el.petTag.textContent = PET_NAMES[btn.id];
    el.petTag.classList.remove('show');
    void el.petTag.offsetWidth;
    el.petTag.classList.add('show');
    positionTag();
    clearTimeout(tagTimer);
    tagTimer = setTimeout(() => { el.petTag.classList.remove('show'); tagFor = null; }, 2600);
    if (reduced) draw(0, 0);
    if (reduced) setTimeout(() => draw(0, 0), 2700);
  }
  [el.chai, el.sef, el.flash].forEach((btn) => btn.addEventListener('click', () => greet(btn)));

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function drawFireplace(t, still) {
    const g = el.fire.getContext('2d');
    g.clearRect(0, 0, FW, FH);
    g.drawImage(sprites.fireplace, 0, 0);
    const tt = still ? 0.6 : t;
    const q = Math.floor(tt * 12);
    const cx = FB.x + FB.w / 2, half = 15;
    // the back of the firebox warms up and flickers
    g.fillStyle = `rgba(255,130,60,${(still ? 0.2 : 0.16 + 0.07 * Math.sin(tt * 9)).toFixed(3)})`;
    for (let y = FB.y + 6; y < FIRE_BASE + 2; y++) {
      const w = Math.round((y - FB.y) * 0.9);
      g.fillRect(Math.max(FB.x + 3, cx - w), y, Math.min(FB.w - 6, w * 2), 1);
    }
    // flames: each column gets its own flickering height
    for (let x = Math.floor(cx - half); x < cx + half; x++) {
      const k = 1 - Math.abs(x + 0.5 - cx) / half;
      if (k <= 0) continue;
      const n = Math.sin(x * 1.3 + tt * 9) * 0.5 + Math.sin(x * 0.55 - tt * 6.1) * 0.5;
      const h = Math.round((5 + 17 * Math.pow(k, 0.8)) * (0.78 + 0.16 * n + 0.12 * hash2(x, q)));
      for (let j = 0; j < h; j++) {
        const f = j / h;
        g.fillStyle = f < 0.22 ? '#fff3b0' : f < 0.48 ? '#ffd45a' : f < 0.74 ? '#ff9a3c' : f < 0.93 ? '#ff5a3c' : '#c95bd6';
        g.fillRect(x, FIRE_BASE - j, 1, 1);
      }
    }
    // rising embers
    if (!still) {
      for (let i = 0; i < 4; i++) {
        const life = (tt * 0.9 + i * 0.27) % 1;
        const y = Math.round(FIRE_BASE - 16 - life * 14);
        const x = Math.round(cx + Math.sin(tt * 2 + i * 2.3) * 7 + (i - 1.5) * 3);
        g.fillStyle = life < 0.6 ? '#ffd45a' : '#ff8a5c';
        if (y > FB.y + 6) g.fillRect(x, y, 1, 1);
      }
    }
    // front log in front of the flames
    g.fillStyle = OUT; g.fillRect(FB.x + 5, FIRE_BASE - 1, FB.w - 10, 5);
    g.fillStyle = '#6b3d24'; g.fillRect(FB.x + 6, FIRE_BASE, FB.w - 12, 3);
    g.fillStyle = '#8a5434'; g.fillRect(FB.x + 6, FIRE_BASE, FB.w - 12, 1);
    g.fillStyle = '#c8956a'; g.fillRect(FB.x + 6, FIRE_BASE, 2, 3); g.fillRect(FB.x + FB.w - 8, FIRE_BASE, 2, 3);
    g.fillStyle = '#ff8a5c'; g.fillRect(FB.x + 14, FIRE_BASE + 2, 3, 1); g.fillRect(FB.x + 24, FIRE_BASE + 2, 2, 1);
    // candle flames
    [[10, 2], [16, 4]].forEach(([x, y], i) => {
      const wob = still ? 0 : (hash2(i, Math.floor(tt * 6)) < 0.3 ? 1 : 0);
      g.fillStyle = '#ff9a3c'; g.fillRect(x, y, 1, 1);
      g.fillStyle = '#ffd45a'; g.fillRect(x, y - 1, 1, 1);
      g.fillStyle = '#fff3b0'; g.fillRect(x + wob, y - 2, 1, 1);
      g.fillStyle = 'rgba(255,212,90,0.25)'; g.fillRect(x - 1, y - 2, 3, 3);
    });
    // lights in the mantel swag
    for (let x = 7, i = 0; x < FW - 3; x += 14, i++) {
      const col = LED[(i + 2) % LED.length];
      const on = still || Math.sin(t * 2 + i * 1.7) > -0.45;
      const y = MANTEL_Y + 3 + Math.round(Math.sin(Math.PI * ((x % 14) / 14)) * 3) + 2;
      g.fillStyle = on ? col : mix(col, '#1a0f20', 0.55);
      g.fillRect(x, y, 1, 2);
      if (on) { g.fillStyle = rgba(col, 0.35); g.fillRect(x - 1, y, 3, 2); }
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
