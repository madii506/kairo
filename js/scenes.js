// The drawn scenes: two launches side by side, the pinned slot tape that opens a coin, and the hero's running tape.
import { fit, clamp, ease, eio, rng, whileVisible } from './util.js';

const C = { go: '#c4ff78', red: '#ff6b5e', amber: '#ffc24d', people: '#8fb7ff', line: '#30372f', line2: '#3b4438', dim: '#6f776c', ink: '#f3f1e7', box: '#151915' };
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function lock(c, x, y, s, col) {                               // a tiny padlock
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, s * 0.14); c.beginPath(); c.arc(x, y - s * 0.12, s * 0.26, Math.PI, 0); c.stroke();
  c.fillStyle = col; rr(c, x - s * 0.36, y - s * 0.12, s * 0.72, s * 0.56, s * 0.08); c.fill();
}
function label(c, t, x, y, col = C.dim, size = 10, align = 'left') { c.fillStyle = col; c.font = `700 ${size}px Silk, monospace`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(t, x, y); }
function slots(w, s, n, x0) { const out = []; for (let i = 0; i < n; i++) out.push(x0 + i * s); return out; }

// ---------- 01: a bundled launch and a Kairo launch, looping
export function duo(cv, mode) {
  const R = rng(mode === 'kairo' ? 7 : 3); const LOOP = 7.6;
  const parts = [];
  const add = (kind, start, dur, tgt) => parts.push({ kind, start, dur, sx: R(), sy: R(), tgt, j: R() });
  if (mode === 'normal') {
    add('dev', 0.35, 0.45, { b: 0, k: 0 });
    for (let i = 0; i < 20; i++) add('bundle', 0.5 + R() * 0.25, 0.4, { b: 0, k: i + 1 });
    for (let i = 0; i < 6; i++) add('sniper', 0.7 + R() * 0.3, 0.35, { b: 0, k: 21 + i });
    for (let i = 0; i < 14; i++) add('people', 2.0 + i * 0.16 + R() * 0.1, 0.6, { b: 2 + (i % 3), k: Math.floor(i / 3) });
  } else {
    add('dev', 0.35, 0.45, { b: 0, k: 0 });
    for (let i = 0; i < 8; i++) add('sniper', 0.6 + R() * 0.4, 0.45, { bounce: true, b: 1 + (i % 2), k: Math.floor(i / 2) });
    for (let i = 0; i < 18; i++) add('people', 1.5 + i * 0.11 + R() * 0.1, 0.6, { b: 1 + (i % 4), k: 4 + Math.floor(i / 4) });
  }
  whileVisible(cv, t0 => {
    const [c, w, h] = fit(cv); const t = t0 % LOOP; c.clearRect(0, 0, w, h);
    const fade = t > LOOP - 0.8 ? 1 - (t - (LOOP - 0.8)) / 0.8 : t < 0.25 ? t / 0.25 : 1; c.globalAlpha = fade;
    const s0 = h * 0.5, s1 = h * 0.3, y0 = h * 0.16, gap = w * 0.025, bx0 = w * 0.04, kz = mode === 'kairo';
    const bxs = [bx0, ...slots(w, s1 + gap, 4, bx0 + s0 + gap * 1.6)];
    const openAt = 1.4;
    // the blocks
    bxs.forEach((x, i) => {
      const s = i ? s1 : s0, y = i ? y0 + (s0 - s1) : y0;
      const isOpen = kz && i > 0 && t >= openAt;
      c.fillStyle = isOpen ? 'rgba(196,255,120,0.06)' : C.box; c.strokeStyle = isOpen ? 'rgba(196,255,120,0.55)' : i === 0 ? C.line2 : C.line; c.lineWidth = 1.5;
      rr(c, x, y, s, s, 8); c.fill(); c.stroke();
      label(c, `BLOCK ${i}`, x, y - 8, isOpen ? C.go : C.dim, Math.max(9, h * 0.032));
    });
    if (kz && t > 0.3) lock(c, bx0 + s0 - 14, y0 + 16, 18, C.go);
    // where each dot ends up
    const slot = (b, k) => {
      const s = b ? s1 : s0, x = bxs[b], y = b ? y0 + (s0 - s1) : y0, n = b ? 4 : 6, cell = s / (n + 1);
      return [x + cell * (1 + (k % n)), y + cell * (1 + Math.floor(k / n))];
    };
    const r = Math.max(2.5, h * 0.013);
    let bounced = 0;
    for (const p of parts) {
      if (t < p.start) continue;
      const col = p.kind === 'dev' ? C.go : p.kind === 'bundle' ? C.red : p.kind === 'sniper' ? C.amber : C.people;
      let x, y; const sx = -20 - p.sx * 60, sy = h * (0.2 + p.sy * 0.7);
      const [tx, ty] = slot(p.tgt.b, p.tgt.k);
      const k = clamp((t - p.start) / p.dur);
      if (p.tgt.bounce) {                                                     // they try block 0, bounce off its lock, then buy from block 1 like everyone
        const ex = bx0 + s0 * (0.3 + 0.5 * p.j), ey = y0 - 6;
        const back = 1.9 + p.j * 0.6;
        if (t < p.start + p.dur) { const e = eio(k); x = sx + (ex - sx) * e; y = sy + (ey - sy) * e - Math.sin(e * Math.PI) * h * 0.1; }
        else if (t < back) { bounced++; const e = clamp((t - p.start - p.dur) / 0.4); x = ex - e * 18; y = ey - e * 26 + e * e * 30; if (e < 1) label(c, 'x', ex + 4, ey - 4, C.red, 12); }
        else { const e = eio(clamp((t - back) / 0.6)); const bx = ex - 18, by = ey + 4; x = bx + (tx - bx) * e; y = by + (ty - by) * e - Math.sin(e * Math.PI) * h * 0.1; }
      } else if (mode === 'normal' && (p.kind === 'bundle' || p.kind === 'sniper') && t > 4.6) {   // they sell into the people
        const k3 = ease(clamp((t - 4.6 - p.j * 0.6) / 0.9)); x = tx + k3 * w * 0.9; y = ty - k3 * h * 0.3;
      } else { const e = eio(k); x = sx + (tx - sx) * e; y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * h * 0.08; }
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    }
    // notes
    const fs = Math.max(9, h * 0.034);
    if (!kz) {
      if (t > 1.2 && t < 4.6) label(c, 'BLOCK 0: 27 WALLETS', bx0, y0 + s0 + 18, C.red, fs);
      if (t > 4.6) label(c, 'THEY SELL INTO THE PEOPLE', bx0, y0 + s0 + 18, C.red, fs);
    } else {
      label(c, 'BLOCK 0: 1 BUY', bx0, y0 + s0 + 18, C.go, fs);
      if (bounced) label(c, 'BOTS REFUSED IN BLOCK 0', bx0, y0 + s0 + 18 + fs * 1.6, C.red, fs);
      if (t >= 2.4) label(c, 'FROM BLOCK 1: EVERYONE', bxs[4] + s1, y0 + s0 + 18, C.go, fs, 'right');
    }
    c.globalAlpha = 1;
  });
}

// ---------- 03: how a launch works, driven by the pinned scroll (p 0..1)
export function openScene(cv) {
  const R = rng(11); const crowd = Array.from({ length: 30 }, (_, i) => ({ kind: i < 7 ? 'bot' : 'p', x: R(), y: R(), j: R(), b: 1 + (i % 3) }));
  let P = 0;
  whileVisible(cv, t => {
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h); if (w < 60) return;
    const p = P, bw = Math.min(w * 0.15, h * 0.24), gap = bw * 0.32, cy = h * 0.4, x0 = w * 0.08;
    const N = 5, open = p >= 0.5;
    for (let i = 0; i < N; i++) {
      const x = x0 + i * (bw + gap), y = cy - bw / 2, born = i === 0 ? p > 0.02 : open;
      c.globalAlpha = i === 0 ? 1 : open ? 1 : 0.45;
      c.fillStyle = i > 0 && open ? 'rgba(196,255,120,0.07)' : C.box; c.strokeStyle = i === 0 ? C.go : open ? 'rgba(196,255,120,0.6)' : C.line; c.lineWidth = i === 0 ? 2 : 1.4;
      rr(c, x, y, bw, bw, 10); c.fill(); c.stroke();
      label(c, `BLOCK ${i}`, x, y - 10, i === 0 || open ? C.go : C.dim, Math.max(9, bw * 0.12));
      if (i === 0 && born) { c.fillStyle = C.go; c.beginPath(); c.arc(x + bw / 2, y + bw / 2, bw * 0.09, 0, 6.2832); c.fill(); lock(c, x + bw - 14, y + 16, 16, C.go); label(c, '1 BUY · THE CREATOR', x, y + bw + 18, C.go, Math.max(9, bw * 0.11)); }
      if (i > 0 && !open) lock(c, x + bw / 2, y + bw / 2 + 4, bw * 0.26, C.line2);
    }
    c.globalAlpha = 1;
    // bots try block 0 and bounce
    if (p > 0.22 && p < 0.55) {
      for (let j = 0; j < 7; j++) {
        const ph = (t * 0.9 + j / 7) % 1, x = x0 + bw * (0.2 + 0.6 * (j / 6)), top = cy - bw / 2;
        const y = ph < 0.5 ? top - (1 - ph * 2) * h * 0.28 : top - Math.sin((ph - 0.5) * 2 * Math.PI) * h * 0.07;
        c.fillStyle = C.red; c.globalAlpha = ph < 0.5 ? 1 : 1 - (ph - 0.5) * 1.4; c.beginPath(); c.arc(x, y - 6, 4, 0, 6.2832); c.fill(); c.globalAlpha = 1;
        if (ph > 0.48 && ph < 0.62) label(c, 'x', x + 6, top - 4, C.red, 12);
      }
    }
    // the log: the creator's buy goes in, every other block 0 buy bounces
    if (p < 0.5) {
      const L = [[0.0, 'BLOCK 0', 'CREATE', 'THE COIN', 'OK', C.go], [0.06, 'BLOCK 0', 'BUY', 'THE CREATOR · 2.0%', 'OK', C.go],
        [0.26, 'BLOCK 0', 'BUY', 'BUNDLE · 20 WALLETS', 'REFUSED', C.red], [0.31, 'BLOCK 0', 'BUY', 'SNIPER · TIP 0.4 SOL', 'REFUSED', C.red],
        [0.36, 'BLOCK 0', 'BUY', 'SNIPER · TIP 1.2 SOL', 'REFUSED', C.red], [0.41, 'BLOCK 0', 'BUY', 'BUNDLE · 12 WALLETS', 'REFUSED', C.red]];
      const fade = p > 0.45 ? 1 - (p - 0.45) / 0.05 : 1, fs = Math.max(10, Math.min(13, w * 0.017)), lh = fs * 2, lx = w * 0.07, lw = w * 0.86;
      let ly = h * 0.66; c.font = `600 ${fs}px JB, monospace`; c.textBaseline = 'middle';
      for (const [at, sl, op, who, res, col] of L) {
        if (p < at) continue; const a = clamp((p - at) / 0.025) * fade; if (a <= 0) continue;
        c.globalAlpha = a * 0.5; c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, ly + lh / 2); c.lineTo(lx + lw, ly + lh / 2); c.stroke();
        c.globalAlpha = a; c.textAlign = 'left'; c.fillStyle = C.dim; c.fillText(sl, lx, ly); c.fillStyle = C.ink; c.fillText(op, lx + fs * 6.5, ly); c.fillText(who, lx + fs * 12, ly);
        c.textAlign = 'right'; c.fillStyle = col; c.fillText(res, lx + lw, ly); ly += lh;
      }
      c.globalAlpha = 1; c.textBaseline = 'alphabetic';
    }
    // from block 1, everyone: the crowd comes in and lands across the open blocks
    if (p > 0.5) {
      const land = clamp((p - 0.62) / 0.3), gather = ease(clamp((p - 0.5) / 0.12));
      crowd.forEach((d, i) => {
        const gx = w * 0.1 + d.x * w * 0.8, gy = h * 0.8 + d.y * h * 0.12;
        const bx = x0 + d.b * (bw + gap), by = cy - bw / 2, cell = bw / 5, k = Math.floor(i / 3);
        const tx = bx + cell * (1 + (k % 4)), ty = by + cell * (1 + Math.floor(k / 4));
        const sx = d.x < 0.5 ? -20 : w + 20;
        let x = sx + (gx - sx) * gather, y = gy;
        if (land > 0) { const e = eio(clamp(land * 1.5 - d.j * 0.5)); x = gx + (tx - gx) * e; y = gy + (ty - gy) * e - Math.sin(e * Math.PI) * h * 0.16; }
        else y += Math.sin(t * 3 + i) * 2;
        c.fillStyle = d.kind === 'bot' ? C.amber : C.people; c.beginPath(); c.arc(x, y, 3.6, 0, 6.2832); c.fill();
      });
      label(c, land > 0.5 ? 'EVERYONE · FROM BLOCK 1' : 'OPEN TO EVERYONE', w * 0.5, h * 0.95, C.go, Math.max(10, bw * 0.12), 'center');
    }
  });
  return { set(p) { P = p; } };
}

// ---------- anatomy of a bundle: one wallet funds twenty fresh ones, and they all try block 0
export function bundle(cv, getMode) {
  const R = rng(21), N = 20, LOOP = 7.2;
  const ws = Array.from({ length: N }, (_, i) => ({ i, d: R() * 0.5, j: R() }));
  let mode = 'normal', cyc = -1, off = 0, lastT = 0;
  whileVisible(cv, t0 => {
    lastT = t0; const t = t0 - off;
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h); if (w < 60) return;
    const cy0 = Math.floor(t / LOOP), lt = t - cy0 * LOOP; if (cy0 !== cyc) { cyc = cy0; mode = getMode(cyc); }
    const kz = mode === 'kairo', fade = lt > 6.4 ? 1 - (lt - 6.4) / 0.8 : 1;
    const fx = w * 0.1, fy = h * 0.5, bs = Math.min(h * 0.5, w * 0.17), bx = w * 0.86 - bs / 2, by = h * 0.5 - bs / 2;
    const gx0 = w * 0.31, gx1 = w * 0.6, cols = 4, rows = 5;
    const pos = k => { const cx = k % cols, ry = Math.floor(k / cols); return [gx0 + (gx1 - gx0) * (cx / (cols - 1)), h * 0.17 + (h * 0.66) * (ry / (rows - 1))]; };
    c.globalAlpha = fade;
    // the funder
    c.fillStyle = C.box; c.strokeStyle = C.amber; c.lineWidth = 2; c.beginPath(); c.arc(fx, fy, Math.max(16, h * 0.07), 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = C.amber; c.beginPath(); c.arc(fx, fy, Math.max(5, h * 0.022), 0, 6.2832); c.fill();
    label(c, 'ONE HAND', fx, fy + Math.max(16, h * 0.07) + 18, C.amber, Math.max(9, h * 0.026), 'center');
    // block 0
    c.fillStyle = kz ? C.box : 'rgba(255,107,94,0.06)'; c.strokeStyle = kz ? C.go : C.red; c.lineWidth = 2; rr(c, bx, by, bs, bs, 12); c.fill(); c.stroke();
    label(c, 'BLOCK 0', bx, by - 10, kz ? C.go : C.red, Math.max(9, h * 0.026));
    if (kz) { c.fillStyle = C.go; c.beginPath(); c.arc(bx + bs / 2, by + bs / 2, bs * 0.07, 0, 6.2832); c.fill(); lock(c, bx + bs - 18, by + 20, 18, C.go); }
    let landed = 0, bounced = 0;
    ws.forEach((wl, k) => {
      const [x, y] = pos(k), fundAt = 0.25 + wl.d * 1.4, buyAt = 2.3 + wl.d * 1.3;
      // the funding line and its SOL
      c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy); c.lineTo(x, y); c.stroke();
      const fk = clamp((lt - fundAt) / 0.5);
      if (fk > 0 && fk < 1) { c.fillStyle = C.amber; c.beginPath(); c.arc(fx + (x - fx) * eio(fk), fy + (y - fy) * eio(fk), 3, 0, 6.2832); c.fill(); }
      const funded = fk >= 1;
      c.fillStyle = funded ? '#3a2f12' : C.box; c.strokeStyle = funded ? C.amber : C.line2; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, Math.max(7, h * 0.027), 0, 6.2832); c.fill(); c.stroke();
      // the buy, into block 0 or off its lock
      const bk = clamp((lt - buyAt) / 0.55); if (!funded || bk <= 0) return;
      const tx = bx + bs * (0.2 + 0.6 * ((k % 5) / 4)), ty = by + bs * (0.2 + 0.6 * (Math.floor(k / 5) / 3));
      if (!kz) {
        if (bk < 1) { c.fillStyle = C.red; c.beginPath(); c.arc(x + (tx - x) * eio(bk), y + (ty - y) * eio(bk), 3.4, 0, 6.2832); c.fill(); }
        else { landed++; c.fillStyle = C.red; c.beginPath(); c.arc(tx, ty, Math.max(3, bs * 0.035), 0, 6.2832); c.fill(); }
      } else {
        const ex = bx - 6, ey = by + bs * (0.1 + 0.8 * wl.j);
        if (bk < 0.6) { const e = eio(bk / 0.6); c.fillStyle = C.red; c.beginPath(); c.arc(x + (ex - x) * e, y + (ey - y) * e, 3.4, 0, 6.2832); c.fill(); }
        else { bounced++; const e = (bk - 0.6) / 0.4; c.globalAlpha = fade * (1 - e); c.fillStyle = C.red; c.beginPath(); c.arc(ex - e * 40, ey + e * 30 * (wl.j - 0.5), 3.4, 0, 6.2832); c.fill(); label(c, 'x', ex + 4, ey + 4, C.red, 12); c.globalAlpha = fade; }
      }
    });
    const fs = Math.max(10, Math.min(13, h * 0.03)), narrow = w < 600;
    const tag = (t, y, col) => { c.font = `700 ${fs}px Silk, monospace`; const tw = c.measureText(t).width; label(c, t, Math.min(w - 6 - tw / 2, Math.max(6 + tw / 2, bx + bs / 2)), y, col, fs, 'center'); };
    if (lt > 1.9) label(c, '20 FRESH WALLETS', (gx0 + gx1) / 2, h * 0.08, C.dim, fs, 'center');
    if (!kz && landed) tag(narrow ? `${landed} WALLETS` : `${landed} WALLETS · ONE HAND`, by + bs + 24, C.red);
    if (kz && lt > 2.6) tag(narrow ? `${bounced} REFUSED` : `${bounced} REFUSED · CLOSED`, by + bs + 24, C.red);
    if (kz) tag(narrow ? '1 BUY' : '1 BUY · THE CREATOR', by + bs + 24 + fs * 1.7, C.go);
    c.globalAlpha = 1;
  });
  return { restart() { off = lastT; cyc = -1; } };
}

// ---------- the chart: the first candle of a bundled launch, and the first candle of a Kairo launch
export function candles(cv, mode) {
  const R = rng(mode === 'kairo' ? 17 : 5), N = 28, seq = [];
  let p = 1;
  for (let i = 0; i < N; i++) {
    let o = p, cl, vol;
    if (mode === 'normal') {
      if (i === 0) { cl = 2.7; vol = 1; }                                  // the bundle: block 0
      else if (i === 1) { cl = 3.0; vol = 0.45; }                          // people see a green candle and buy
      else if (i === 2) { cl = 2.5; vol = 0.6; }
      else if (i === 3) { cl = 1.7; vol = 0.85; }                          // the bundle sells into them
      else if (i === 4) { cl = 1.9; vol = 0.3; }
      else if (i === 5) { cl = 1.35; vol = 0.6; }
      else { cl = Math.max(0.75, o + (R() - 0.58) * 0.22); vol = 0.08 + R() * 0.22; }
    } else {
      if (i === 0) { cl = 1.06; vol = 0.12; }                              // block 0: the creator's one buy
      else if (i === 1) { cl = 1.42; vol = 0.9; }                          // block 1: everyone who came
      else { cl = Math.max(0.85, o + (R() - 0.47) * 0.2); vol = 0.1 + R() * 0.3; }
    }
    const hi = Math.max(o, cl) + R() * 0.12, lo = Math.min(o, cl) - R() * 0.1;
    seq.push({ o, c: cl, h: hi, l: lo, v: vol }); p = cl;
  }
  const max = 3.3, min = 0.6, LOOP = 9.5;
  whileVisible(cv, t => {
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h); if (w < 60) return;
    const lt = t % LOOP, shown = Math.floor(clamp(lt / 6.2) * N + 0.0001), ph = h * 0.74, vy0 = h * 0.97, vh = h * 0.18;
    const cw = w / N, Y = v => ph - ((v - min) / (max - min)) * (ph - h * 0.06);
    c.strokeStyle = C.line; c.lineWidth = 1; c.setLineDash([3, 6]);
    for (let k = 1; k < 4; k++) { const y = h * 0.06 + (ph - h * 0.06) * (k / 4); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.setLineDash([]);
    for (let i = 0; i < Math.min(shown, N); i++) {
      const k = seq[i]; if (!k) continue;
      const x = cw * (i + 0.5), up = k.c >= k.o, col = up ? C.go : C.red, last = i === shown - 1;
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, cw * 0.08);
      c.beginPath(); c.moveTo(x, Y(k.h)); c.lineTo(x, Y(k.l)); c.stroke();
      const y0 = Y(Math.max(k.o, k.c)), y1 = Y(Math.min(k.o, k.c)); c.globalAlpha = last ? 1 : 0.9; c.fillRect(x - cw * 0.32, y0, cw * 0.64, Math.max(2, y1 - y0));
      c.globalAlpha = 0.5; c.fillRect(x - cw * 0.32, vy0 - vh * k.v, cw * 0.64, vh * k.v); c.globalAlpha = 1;
    }
    const lead = (x0, y0, x1, y1, col) => { c.strokeStyle = col; c.lineWidth = 1; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.globalAlpha = 1; };
    const tagl = (t, x, y, col) => { c.font = '700 10px Silk, monospace'; const tw = c.measureText(t).width; x = Math.min(x, w - tw - 6); c.fillStyle = 'rgba(21,25,21,0.92)'; rr(c, x - 5, y - 12, tw + 10, 17, 4); c.fill(); label(c, t, x, y, col, 10); };
    if (mode === 'normal' && shown > 0) { const x = cw * 0.5, y = Y(seq[0].c); lead(x + cw * 0.4, y + 8, cw * 2.3, y + 8, C.red); tagl('BLOCK 0: THE BUNDLE', cw * 2.5, y + 12, C.red); }
    if (mode === 'normal' && shown > 3 && w > 420) { const x = cw * 3.5, y = Y((seq[3].o + seq[3].c) / 2); lead(x + cw * 0.4, y, cw * 5.3, y, C.red); tagl('THE BUNDLE SELLS', cw * 5.5, y + 4, C.red); }
    if (mode === 'kairo' && shown > 0) { const x = cw * 0.5, y = Y(seq[0].l); lead(x, y + 4, x, Y(0.78), C.go); tagl("BLOCK 0: THE DEV'S BUY", x - cw * 0.3, Y(0.78) + 14, C.go); }
    if (mode === 'kairo' && shown > 1) { const x = cw * 1.5, y = Y(seq[1].h); lead(x, y - 4, x, Y(2.05), C.go); tagl('BLOCK 1: EVERYONE', x - cw * 0.3, Y(2.05) - 8, C.go); }
  });
}
