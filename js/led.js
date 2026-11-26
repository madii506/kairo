// An LED board: text as round lamps on a 5 x 7 grid. Lit lamps glow green, the rest sit dim.
// In live mode (the hero) the board breathes, a bright band sweeps across it, lamps swell under the pointer,
// and it dissolves as you scroll away.
const G = {
  A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.#####....#....#....#....#.....####', D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####', G: '.#####....#....#.####...##...#.####', I: '#####..#....#....#....#....#..#####', K: '#...##..#.#.#..##...#.#..#..#.#...#',
  L: '#....#....#....#....#....#....#####', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.', P: '####.#...##...#####.#....#....#....',
  R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..', U: '#...##...##...##...##...##...#.###.',
  X: '#...##...#.#.#...#...#.#.#...##...#', Y: '#...##...#.#.#...#....#....#....#..', W: '#...##...##...##.#.##.#.##.#.#.#.#.',
  0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####', 3: '####.....#....#.###.....#....#####.',
  4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.', 6: '.###.#....#....####.#...##...#.###.', 7: '#####....#...#...#...#....#....#...',
  8: '.###.#...##...#.###.#...##...#.###.', 9: '.###.#...##...#.####....#....#.###.', ':': '.......#....#.........#....#.......', ' ': '.'.repeat(35), '-': '................###................', '.': '...........................#....#..',
};
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const frac = x => x - Math.floor(x);

export function led(cv, { text = '', pad = 1, on = '#c4ff78', off = 'rgba(196,255,120,0.07)', glow = 14, start = 1, hi = '#f1ffe0' } = {}) {
  const ctx = cv.getContext('2d');
  let cur = '', lit = [], cols = 0, seeds = [];
  const rv = { t0: 0, dur: 0, k: start }, fl = { t0: 0, dur: 0 };
  let isLive = false, ticking = false, vis = true, focus = 0, focusT = 0, scat = 0, gcv = null, gkey = '';
  const ptr = { x: -1e6, y: -1e6 }, sm = { x: -1e6, y: -1e6 };
  function layout(t) {
    const chars = [...t.toUpperCase()]; cols = chars.length * 6 - 1; lit = [];
    chars.forEach((ch, k) => { const g = G[ch] || G[' ']; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '#') lit.push([k * 6 + c, r]); });
    seeds = lit.map((_, i) => ({ a: frac(Math.sin(i * 12.9898) * 43758.5453), b: frac(Math.sin(i * 78.233) * 12543.123) }));
    cur = t; gkey = '';
  }
  layout(text);
  const geom = () => { const W = cv.width, H = cv.height, gc = cols + pad * 2, gr = 7 + pad * 2, p = Math.min(W / gc, H / gr); return { W, H, p, ox: (W - p * gc) / 2 + p * pad, oy: (H - p * gr) / 2 + p * pad, rr: p * 0.36 }; };
  function glowLayer(g) {                         // the glow is drawn once per text and size, then reused every frame
    const key = cur + '|' + g.W + 'x' + g.H; if (gkey === key && gcv) return gcv;
    gcv = gcv || document.createElement('canvas'); gcv.width = g.W; gcv.height = g.H;
    const c = gcv.getContext('2d'); c.clearRect(0, 0, g.W, g.H); c.shadowColor = on; c.shadowBlur = glow * (g.W / 1000); c.fillStyle = on; c.beginPath();
    for (const [cc, r] of lit) { const x = g.ox + (cc + 0.5) * g.p, y = g.oy + (r + 0.5) * g.p; c.moveTo(x + g.rr * 1.08, y); c.arc(x, y, g.rr * 1.08, 0, 6.2832); }
    c.fill(); gkey = key; return gcv;
  }
  function draw(now = performance.now()) {
    const g = geom(), { W, H, p, ox, oy, rr } = g;
    const reveal = rv.dur ? clamp((now - rv.t0) / rv.dur) : rv.k;
    const flick = fl.dur && now - fl.t0 < fl.dur ? 0.35 * (1 - (now - fl.t0) / fl.dur) : 0;
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (isLive) { focus += (focusT - focus) * 0.08; sm.x += (ptr.x - sm.x) * 0.16; sm.y += (ptr.y - sm.y) * 0.16; }
    const fade = 1 - scat * 0.75, R = p * 4.4, hasF = isLive && focus > 0.01;
    // the dim lamps, a little brighter under the pointer
    ctx.globalAlpha = fade; ctx.fillStyle = off; ctx.beginPath();
    for (let c = -pad; c < cols + pad; c++) for (let r = -pad; r < 7 + pad; r++) { const x = ox + (c + 0.5) * p, y = oy + (r + 0.5) * p; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 6.2832); }
    ctx.fill();
    if (hasF) {
      ctx.fillStyle = on;
      for (let c = -pad; c < cols + pad; c++) for (let r = -pad; r < 7 + pad; r++) {
        const x = ox + (c + 0.5) * p, y = oy + (r + 0.5) * p, d = Math.hypot(x - sm.x, y - sm.y); if (d > R) continue;
        const f = 1 - d / R; ctx.globalAlpha = 0.3 * f * f * focus * fade; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill();
      }
    }
    const cut = reveal * (cols + 6) - 3, settled = reveal >= 1 && !flick;
    // the glow under the lit lamps
    if (settled && scat < 0.97) { ctx.globalAlpha = (isLive ? 0.8 + 0.2 * Math.sin(now / 950) : 1) * (1 - scat) * (1 - scat); ctx.drawImage(glowLayer(g), 0, 0); }
    // the lit lamps
    if (!isLive && settled && !scat) {           // a still board: one path
      ctx.globalAlpha = 1; ctx.fillStyle = on; ctx.beginPath();
      for (const [c, r] of lit) { const x = ox + (c + 0.5) * p, y = oy + (r + 0.5) * p; ctx.moveTo(x + rr * 1.08, y); ctx.arc(x, y, rr * 1.08, 0, 6.2832); }
      ctx.fill(); ctx.globalAlpha = 1; return;
    }
    const sw = ((now / 1000) % 7.5) / 2.4, sx = isLive && sw <= 1 ? -p * 4 + sw * (W + p * 8) : -1e9, band = p * 2.2;
    if (!settled) { ctx.save(); ctx.shadowColor = on; ctx.shadowBlur = glow * (W / 1000); }
    for (let i = 0; i < lit.length; i++) {
      const [c, r] = lit[i], sd = seeds[i];
      if (c > cut) continue; if (c > cut - 3 && Math.random() < 0.5) continue;        // the edge of the reveal flickers
      if (flick && Math.random() < flick) continue;
      let x = ox + (c + 0.5) * p, y = oy + (r + 0.5) * p, rad = rr * 1.08, a = 1;
      if (isLive) {
        a = 0.86 + 0.14 * Math.sin(now / 1000 * 2.3 + sd.a * 40);                      // a slow shimmer
        if (hasF) { const d = Math.hypot(x - sm.x, y - sm.y); if (d < R) { const f = 1 - d / R; rad *= 1 + 0.5 * f * f * focus; a = Math.min(1, a + 0.3 * f * focus); } }
      }
      if (scat > 0) {                                                                   // dissolve: lamps shrink and drift up, the edges first
        const k = clamp(scat * 1.5 - sd.b * 0.5); rad *= 1 - k; a *= 1 - k * 0.6;
        x += (sd.a - 0.5) * p * 3 * k; y -= p * (1 + sd.b * 3) * k;
        if (rad < 0.3) continue;
      }
      ctx.globalAlpha = a; ctx.fillStyle = on; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      const db = Math.abs(x - sx);
      if (db < band) { ctx.globalAlpha = 0.65 * (1 - db / band) * (1 - scat); ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(x, y, rad * (1 + 0.16 * (1 - db / band)), 0, 6.2832); ctx.fill(); }
    }
    if (!settled) ctx.restore();
    ctx.globalAlpha = 1;
  }
  function tick(now) {                            // runs while a reveal or flicker plays, or forever in live mode while on screen
    const busy = (rv.dur && now - rv.t0 < rv.dur + 40) || (fl.dur && now - fl.t0 < fl.dur + 40);
    if (!(isLive && vis) && !busy) { ticking = false; draw(now); return; }
    draw(now); requestAnimationFrame(tick);
  }
  const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  draw();
  return {
    set(t) { if (t === cur) return; layout(t); if (!ticking) draw(); },
    reveal(dur = 900) { rv.t0 = performance.now(); rv.dur = dur; kick(); },
    flicker(dur = 500) { fl.t0 = performance.now(); fl.dur = dur; kick(); },
    scatter(k) { const v = clamp(k); if (Math.abs(v - scat) < 0.001) return; scat = v; if (!ticking) draw(); },
    live(at) {                                    // the hero board: follows the pointer and keeps moving while it's on screen
      isLive = true;
      const aim = (x, y, kind) => {
        const b = cv.getBoundingClientRect(); if (!b.width) return;
        ptr.x = (x - b.left) * (cv.width / b.width); ptr.y = (y - b.top) * (cv.height / b.height);
        if (sm.x < -1e5) { sm.x = ptr.x; sm.y = ptr.y; }
        const near = x > b.left - 140 && x < b.right + 140 && y > b.top - 140 && y < b.bottom + 140;
        focusT = near && kind !== 'touch' ? 1 : 0;
      };
      if (at) aim(at.x, at.y, 'mouse');
      addEventListener('pointermove', e => aim(e.clientX, e.clientY, e.pointerType), { passive: true });
      document.addEventListener('pointerleave', () => (focusT = 0));
      let onScreen = true; const upd = () => { vis = onScreen && !document.hidden; if (vis) kick(); };
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; upd(); }).observe(cv);
      document.addEventListener('visibilitychange', upd);
      kick();
    },
    draw,
  };
}
