// The name in the hero: KAIRO set in Silkscreen, built from square voxel pixels.
// The pixels fly in and land, lean away from the pointer, catch a passing light, jump at every :00,
// burst when you click and come back, and come apart as you scroll away.
const GRID = [                      // Silkscreen Bold, "KAIRO", one character per font pixel
  '##.##...###...##..####....###.',
  '####...##.##..##..##.##..##.##',
  '###....#####..##..####...##.##',
  '####...##.##..##..####...##.##',
  '##.##..##.##..##..##.##...###.',
];
const COLS = GRID[0].length, ROWS = GRID.length, PADX = 1, PADY = 1;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export function pixname(box, { color = '#c4ff78', side = '#5c8f2a', hi = '#f1ffe0', reduced = false } = {}) {
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); box.append(cv);
  const ctx = cv.getContext('2d');
  const px = [];
  GRID.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') px.push({ c, r, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, on: reduced, at: 0, s1: Math.random(), s2: Math.random(), s3: Math.random() }); }));
  let W = 0, H = 0, d = 1, u = 0, ox = 0, oy = 0, glow = null, run = false, vis = true, scat = 0, flash = 0, started = reduced, t0 = performance.now();
  const ptr = { x: -1e6, y: -1e6, a: 0, want: 0 };
  function size() {
    const b = cv.getBoundingClientRect(), bb = box.getBoundingClientRect(); if (!b.width) return;
    d = Math.min(2, devicePixelRatio || 1); W = Math.round(b.width * d); H = Math.round(b.height * d); cv.width = W; cv.height = H;
    u = (bb.width * d) / (COLS + PADX * 2);                                  // one font pixel, in canvas pixels
    ox = (bb.left - b.left) * d + u * PADX; oy = (bb.top - b.top) * d + ((bb.height * d) - u * ROWS) / 2;
    glow = null;
    if (!started || reduced) px.forEach(p => { const [hx, hy] = home(p); if (reduced || p.on) { p.x = hx; p.y = hy; } });
  }
  const home = p => [ox + (p.c + 0.5) * u, oy + (p.r + 0.5) * u];
  function glowLayer() {                                                     // a soft light under the letters, drawn once per size
    if (glow) return glow;
    glow = document.createElement('canvas'); glow.width = W; glow.height = H; const g = glow.getContext('2d');
    g.shadowColor = color; g.shadowBlur = u * 0.9; g.fillStyle = color;
    for (const p of px) { const [hx, hy] = home(p); g.fillRect(hx - u * 0.42, hy - u * 0.42, u * 0.84, u * 0.84); }
    return glow;
  }
  function cube(x, y, s, rot, a, face) {                                     // one voxel pixel: a side, a face, a lit edge
    const h = s / 2, dep = s * 0.2;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.globalAlpha = a;
    ctx.fillStyle = side; ctx.fillRect(-h + dep, -h + dep, s, s);
    ctx.fillStyle = face; ctx.fillRect(-h, -h, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-h, -h, s, s * 0.14); ctx.fillRect(-h, -h, s * 0.14, s);
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-h, h - s * 0.1, s, s * 0.1);
    ctx.restore();
  }
  function mix(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = sh => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; }
  function frame(now) {
    if (!run) return; requestAnimationFrame(frame);
    if (!W) size(); if (!W) return;
    const t = (now - t0) / 1000;
    ptr.a += (ptr.want - ptr.a) * 0.08; flash = Math.max(0, flash - 0.03);
    ctx.clearRect(0, 0, W, H);
    const landed = px.filter(p => p.on).length / px.length;
    if (!scat && landed > 0.98) { ctx.globalAlpha = (0.42 + 0.12 * Math.sin(t * 1.3)) * (1 - scat); ctx.drawImage(glowLayer(), 0, 0); ctx.globalAlpha = 1; }
    else if (landed > 0.5) { ctx.globalAlpha = 0.42 * (landed - 0.5) * 2 * (1 - scat) ** 2; ctx.drawImage(glowLayer(), 0, 0); ctx.globalAlpha = 1; }
    const R = u * 3.4, sweep = ((t % 7.5) / 2.2), sx = sweep <= 1 ? ox - u * 3 + sweep * (u * (COLS + 6)) : -1e9;
    for (const p of px) {
      if (!p.on) { if (started && now >= p.at) { p.on = true; const [hx, hy] = home(p); p.x = hx + (p.s1 - 0.5) * W * 0.5; p.y = hy + H * (0.55 + p.s2 * 0.4); p.vx = 0; p.vy = -u * (0.6 + p.s3 * 0.5); p.rot = (p.s3 - 0.5) * 3; } else continue; }
      let [tx, ty] = home(p);
      ty += Math.sin(t * 2.1 + p.c * 0.42) * u * 0.06;                       // the letters breathe in a slow wave
      if (ptr.a > 0.01) {                                                     // lean away from the pointer
        const dx = tx - ptr.x, dy = ty - ptr.y, dd = Math.hypot(dx, dy);
        if (dd < R) { const f = (1 - dd / R) ** 2 * ptr.a; tx += (dx / (dd || 1)) * f * u * 1.3; ty += (dy / (dd || 1)) * f * u * 1.3 - f * u * 0.4; }
      }
      let rt = 0;
      if (scat > 0) { const k = clamp(scat * 1.5 - p.s2 * 0.5); tx += (p.s1 - 0.5) * W * 0.5 * k; ty += -H * (0.2 + p.s3 * 0.6) * k; rt = (p.s1 - 0.5) * 4 * k; }
      p.vx = (p.vx + (tx - p.x) * 0.14) * 0.76; p.vy = (p.vy + (ty - p.y) * 0.14) * 0.76; p.vr = (p.vr + (rt - p.rot) * 0.12) * 0.8;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const db = Math.abs(p.x - sx), band = u * 1.8, lit = db < band ? 1 - db / band : 0;
      const face = flash > 0 || lit > 0 ? mix(color, hi, Math.max(flash, lit * 0.8)) : color;
      const a = (1 - scat * 0.85) * (scat > 0 ? 1 - clamp(scat * 1.5 - p.s2 * 0.5) * 0.6 : 1);
      if (a > 0.02) cube(p.x, p.y, u * 0.9, p.rot, a, face);
    }
    ctx.globalAlpha = 1;
  }
  function start() { if (run || !vis) return; run = true; requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { vis = e.isIntersecting && !document.hidden; if (vis) start(); else run = false; }).observe(box);
  document.addEventListener('visibilitychange', () => { vis = !document.hidden; if (vis) start(); else run = false; });
  addEventListener('resize', () => { W = 0; });
  addEventListener('pointermove', e => {
    const b = cv.getBoundingClientRect(); if (!b.width || e.pointerType === 'touch') return;
    ptr.x = (e.clientX - b.left) * d; ptr.y = (e.clientY - b.top) * d;
    const bb = box.getBoundingClientRect(); ptr.want = e.clientX > bb.left - 120 && e.clientX < bb.right + 120 && e.clientY > bb.top - 120 && e.clientY < bb.bottom + 120 ? 1 : 0;
  }, { passive: true });
  document.addEventListener('pointerleave', () => (ptr.want = 0));
  if (reduced) { requestAnimationFrame(() => { size(); run = true; frame(performance.now()); run = false; }); }
  return {
    assemble() {                                                            // the pixels fly in, left to right, and land
      if (reduced) return; size(); const now = performance.now(); started = true;
      px.forEach(p => { p.on = false; p.at = now + p.c * 26 + p.s1 * 260; });
      start();
    },
    burst(cx, cy) {                                                         // a click: everything jumps out and springs back
      if (reduced) return; const b = cv.getBoundingClientRect(); const x = (cx - b.left) * d, y = (cy - b.top) * d;
      for (const p of px) { const dx = p.x - x, dy = p.y - y, dd = Math.hypot(dx, dy) || 1; const f = u * (1.6 + 2.2 * Math.max(0, 1 - dd / (u * 12))); p.vx += (dx / dd) * f + (p.s1 - 0.5) * u; p.vy += (dy / dd) * f - u * 0.8; p.vr += (p.s2 - 0.5) * 0.8; }
      flash = 1;
    },
    jolt() { if (reduced) return; for (const p of px) { p.vy -= u * (0.5 + p.s3 * 0.6); p.vx += (p.s1 - 0.5) * u * 0.4; } flash = 1; },
    scatter(k) { scat = clamp(k); },
  };
}
