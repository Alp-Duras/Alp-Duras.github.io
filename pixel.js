/* Tiny pixel-art toolkit shared by the countdown and the game.
   Everything is drawn one logical pixel at a time, then scaled up with
   crisp (nearest-neighbour) edges so the whole world shares one pixel grid. */
(function (global) {
  'use strict';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }

  // Deterministic random numbers, so the tree looks the same on every visit.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function mix(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  // A small pixel buffer: set colours, outline silhouettes, then bake to a canvas.
  class Buf {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.px = new Array(w * h).fill(null);
    }
    set(x, y, c) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.px[y * this.w + x] = c;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      return this.px[y * this.w + x];
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }
    map(rows, pal, ox = 0, oy = 0) {
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) this.set(ox + x, oy + y, c); }
      });
      return this;
    }
    // Draw a 1px outline around every filled pixel.
    outline(c) {
      const snap = this.px.slice();
      const filled = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && snap[y * this.w + x] !== null;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (snap[y * this.w + x] !== null) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) this.px[y * this.w + x] = c;
      }
      return this;
    }
    blit(src, ox, oy) {
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x];
        if (c !== null) this.set(ox + x, oy + y, c);
      }
      return this;
    }
    toCanvas() {
      const cv = makeCanvas(this.w, this.h), g = cv.getContext('2d');
      for (let y = 0; y < this.h; y++) {
        let x = 0;
        while (x < this.w) {
          const c = this.px[y * this.w + x];
          if (c === null) { x++; continue; }
          let run = 1;
          while (x + run < this.w && this.px[y * this.w + x + run] === c) run++;
          g.fillStyle = c;
          g.fillRect(x, y, run, 1);
          x += run;
        }
      }
      return cv;
    }
  }

  // 6px-tall bitmap lettering for text painted inside the pixel world.
  const GLYPHS = {
    'N': ['1001', '1101', '1011', '1001', '1001', '0000'],
    'T': ['111', '010', '010', '010', '010', '000'],
    'e': ['000', '010', '101', '110', '011', '000'],
    'x': ['000', '101', '010', '010', '101', '000'],
    't': ['010', '111', '010', '010', '001', '000'],
    's': ['000', '011', '100', '001', '110', '000'],
    'o': ['000', '010', '101', '101', '010', '000'],
    'p': ['000', '110', '101', '110', '100', '100'],
    'r': ['000', '101', '110', '100', '100', '000'],
    'n': ['000', '110', '101', '101', '101', '000'],
    ':': ['0', '0', '1', '0', '1', '0'],
    ' ': ['00', '00', '00', '00', '00', '00']
  };
  function textWidth(str) {
    let w = 0;
    for (const ch of str) w += (GLYPHS[ch] || GLYPHS[' '])[0].length + 1;
    return w - 1;
  }
  function drawText(g, str, x, y, color) {
    g.fillStyle = color;
    for (const ch of str) {
      const gl = GLYPHS[ch] || GLYPHS[' '];
      gl.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') g.fillRect(x + i, y + j, 1, 1); });
      x += gl[0].length + 1;
    }
  }

  global.Pixel = { makeCanvas, rng, rgba, mix, Buf, textWidth, drawText };
})(window);
