// The drawn scenes: two launches side by side, the pinned slot tape that opens a coin, and the hero's running tape.
import { fit, clamp, ease, eio, rng, whileVisible } from './util.js';
import { onMoment } from './clock.js';

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
    for (let i = 0; i < 9; i++) add('sniper', 0.6 + R() * 0.5, 0.5, { q: i });
    for (let i = 0; i < 18; i++) add('people', 0.9 + R() * 1.6, 0.6, { q: 9 + i });
  }
  whileVisible(cv, t0 => {
    const [c, w, h] = fit(cv); const t = t0 % LOOP; c.clearRect(0, 0, w, h);
    const fade = t > LOOP - 0.8 ? 1 - (t - (LOOP - 0.8)) / 0.8 : t < 0.25 ? t / 0.25 : 1; c.globalAlpha = fade;
    const s0 = h * 0.5, s1 = h * 0.3, y0 = h * 0.16, gap = w * 0.025, bx0 = w * 0.04;
    const bxs = [bx0, ...slots(w, s1 + gap, 4, bx0 + s0 + gap * 1.6)];
    const opening = mode === 'kairo' ? 3 : -1, openAt = 3.5;
    // the blocks
    bxs.forEach((x, i) => {
      const s = i ? s1 : s0, y = i ? y0 + (s0 - s1) : y0;
      const isOpen = i === opening && t >= openAt;
      c.fillStyle = isOpen ? 'rgba(196,255,120,0.1)' : C.box; c.strokeStyle = isOpen ? C.go : i === 0 ? C.line2 : C.line; c.lineWidth = isOpen ? 2 : 1.5;
      rr(c, x, y, s, s, 8); c.fill(); c.stroke();
      label(c, i === 0 ? 'BLOCK 0' : i === opening ? (t >= openAt ? ':00 OPEN' : ':00') : `BLOCK ${i}`, x, y - 8, isOpen ? C.go : C.dim, Math.max(9, h * 0.032));
      if (mode === 'kairo' && i > 0 && i < opening && t > 0.4) lock(c, x + s / 2, y + s / 2, s * 0.32, C.line2);
    });
    if (mode === 'kairo' && t > 0.3) lock(c, bx0 + s0 - 14, y0 + 16, 18, C.go);
    // where each dot ends up
    const slot = (b, k) => {
      const s = b ? s1 : s0, x = bxs[b], y = b ? y0 + (s0 - s1) : y0, n = b ? 4 : 6, cell = s / (n + 1);
      return [x + cell * (1 + (k % n)), y + cell * (1 + Math.floor(k / n))];
    };
    const qx = k => w * 0.08 + (k % 14) * (w * 0.84 / 14), qy = k => h * 0.84 + Math.floor(k / 14) * h * 0.07;
    const openSlot = k => { const x = bxs[3], y = y0 + (s0 - s1), n = 6, cell = s1 / (n + 1); return [x + cell * (1 + (k % n)), y + cell * (1 + Math.floor(k / n) % 6)]; };
    const r = Math.max(2.5, h * 0.013);
    for (const p of parts) {
      if (t < p.start) continue;
      const col = p.kind === 'dev' ? C.go : p.kind === 'bundle' ? C.red : p.kind === 'sniper' ? C.amber : C.people;
      let x, y; const sx = -20 - p.sx * 60, sy = h * (0.2 + p.sy * 0.7);
      let [tx, ty] = p.tgt.b !== undefined ? slot(p.tgt.b, p.tgt.k) : [qx(p.tgt.q), qy(p.tgt.q)];
      const k = clamp((t - p.start) / p.dur);
      if (mode === 'kairo' && p.tgt.q !== undefined && t >= openAt) {          // :00, everyone at once
        const [ox, oy] = openSlot(p.tgt.q); const k2 = ease(clamp((t - openAt - p.j * 0.08) / 0.55));
        x = tx + (ox - tx) * k2; y = ty + (oy - ty) * k2 - Math.sin(k2 * Math.PI) * h * 0.12;
      } else if (mode === 'normal' && (p.kind === 'bundle' || p.kind === 'sniper') && t > 4.6) {   // they sell into the people
        const k3 = ease(clamp((t - 4.6 - p.j * 0.6) / 0.9)); x = tx + k3 * w * 0.9; y = ty - k3 * h * 0.3;
      } else { const e = eio(k); x = sx + (tx - sx) * e; y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * h * 0.08; }
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    }
    // notes
    if (mode === 'normal') {
      if (t > 1.2 && t < 4.6) label(c, 'BLOCK 0: 27 WALLETS', bx0, y0 + s0 + 18, C.red, Math.max(9, h * 0.034));
      if (t > 4.6) label(c, 'THEY SELL INTO THE PEOPLE', bx0, y0 + s0 + 18, C.red, Math.max(9, h * 0.034));
    } else {
      label(c, 'BLOCK 0: 1 BUY', bx0, y0 + s0 + 18, C.go, Math.max(9, h * 0.034));
      if (t > 0.8 && t < openAt) { const left = Math.max(0, Math.ceil(openAt - t)); label(c, `WAITING FOR :00 · 00:0${left}`, w * 0.08, h * 0.79, C.amber, Math.max(9, h * 0.032)); }
      if (t >= openAt + 0.4) label(c, 'EVERYONE · SAME SECOND', bxs[3] + s1, y0 + s0 + 18, C.go, Math.max(9, h * 0.034), 'right');
    }
    c.globalAlpha = 1;
  });
}

// ---------- 02: the slot tape, driven by the pinned scroll (p 0..1) and the clock (t)
export function openScene(cv) {
  const R = rng(11); const crowd = Array.from({ length: 34 }, (_, i) => ({ kind: i < 8 ? 'bot' : 'p', x: R(), y: R(), j: R() }));
  let P = 0;
  whileVisible(cv, t => {
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h);
    const p = P, step = Math.min(3, Math.floor(p * 4)), k = p * 4 - step;
    const bw = Math.min(w * 0.13, h * 0.2), gap = bw * 0.28, cy = h * 0.45;
    const OPEN = 7, scroll = eio(clamp(p / 0.78)) * (OPEN - 1.2) * (bw + gap);
    const x0 = w * 0.18 - scroll;
    for (let i = 0; i < 12; i++) {
      const x = x0 + i * (bw + gap), y = cy - bw / 2; if (x > w + bw || x < -bw * 2) continue;
      const open = i === OPEN && p >= 0.76;
      c.fillStyle = open ? 'rgba(196,255,120,0.12)' : C.box; c.strokeStyle = open ? C.go : i === 0 ? C.go : C.line; c.lineWidth = open || i === 0 ? 2 : 1.4;
      rr(c, x, y, bw, bw, 10); c.fill(); c.stroke();
      label(c, i === 0 ? 'BLOCK 0' : i === OPEN ? ':00' : String(i), x, y - 10, i === 0 || open ? C.go : C.dim, Math.max(9, bw * 0.13));
      if (i === 0) { c.fillStyle = C.go; c.beginPath(); c.arc(x + bw / 2, y + bw / 2, bw * 0.09, 0, 6.2832); c.fill(); lock(c, x + bw - 14, y + 16, 16, C.go); label(c, '1 BUY', x, y + bw + 18, C.go, Math.max(9, bw * 0.12)); }
      else if (i < OPEN) lock(c, x + bw / 2, y + bw / 2 + 4, bw * 0.3, C.line2);
    }
    // bots try the closed blocks and bounce off
    if (p > 0.22 && p < 0.78) {
      for (let j = 0; j < 7; j++) {
        const ph = (t * 0.9 + j / 7) % 1, bi = 1 + (j % 5), x = x0 + bi * (bw + gap) + bw / 2 + (j % 2 ? -bw * 0.2 : bw * 0.2);
        const top = cy - bw / 2, y = ph < 0.5 ? top - (1 - ph * 2) * h * 0.3 : top - Math.sin((ph - 0.5) * 2 * Math.PI) * h * 0.08;
        c.fillStyle = C.red; c.globalAlpha = ph < 0.5 ? 1 : 1 - (ph - 0.5) * 1.4; c.beginPath(); c.arc(x, y - 6, 4, 0, 6.2832); c.fill(); c.globalAlpha = 1;
        if (ph > 0.48 && ph < 0.62) label(c, 'x', x + 6, top - 4, C.red, 12);
      }
    }
    // the log under the tape: the creator's buy goes in, every early buy bounces
    if (p < 0.48) {
      const L = [[0.0, 'SLOT 0', 'CREATE', 'THE COIN', 'OK', C.go], [0.06, 'SLOT 0', 'BUY', 'THE CREATOR · 2.0%', 'OK', C.go],
        [0.26, 'SLOT 1', 'BUY', 'BUNDLE · 20 WALLETS', 'REFUSED', C.red], [0.31, 'SLOT 2', 'BUY', 'SNIPER · TIP 0.4 SOL', 'REFUSED', C.red],
        [0.36, 'SLOT 3', 'BUY', 'SNIPER · TIP 1.2 SOL', 'REFUSED', C.red], [0.41, 'SLOT 4', 'BUY', 'BUNDLE · 12 WALLETS', 'REFUSED', C.red]];
      const fade = p > 0.43 ? 1 - (p - 0.43) / 0.05 : 1, fs = Math.max(10, Math.min(13, w * 0.017)), lh = fs * 2, lx = w * 0.07, lw = w * 0.86;
      let ly = h * 0.64; c.font = `600 ${fs}px JB, monospace`; c.textBaseline = 'middle';
      for (const [at, sl, op, who, res, col] of L) {
        if (p < at) continue; const a = clamp((p - at) / 0.025) * fade; if (a <= 0) continue;
        c.globalAlpha = a * 0.5; c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, ly + lh / 2); c.lineTo(lx + lw, ly + lh / 2); c.stroke();
        c.globalAlpha = a; c.textAlign = 'left'; c.fillStyle = C.dim; c.fillText(sl, lx, ly); c.fillStyle = C.ink; c.fillText(op, lx + fs * 6, ly); c.fillText(who, lx + fs * 11.5, ly);
        c.textAlign = 'right'; c.fillStyle = col; c.fillText(res, lx + lw, ly); ly += lh;
      }
      c.globalAlpha = 1; c.textBaseline = 'alphabetic';
    }
    // the crowd gathers, then everyone lands in the opening block at once
    if (p > 0.45) {
      const ox = x0 + OPEN * (bw + gap), oy = cy - bw / 2, land = clamp((p - 0.76) / 0.12);
      const gather = ease(clamp((p - 0.45) / 0.2));
      crowd.forEach((d, i) => {
        const gx = w * 0.1 + d.x * w * 0.8, gy = h * 0.8 + d.y * h * 0.12;
        const cell = bw / 7, tx = ox + cell * (1 + (i % 6)), ty = oy + cell * (1 + Math.floor(i / 6));
        const sx = d.x < 0.5 ? -20 : w + 20;
        let x = sx + (gx - sx) * gather, y = gy;
        if (land > 0) { const e = eio(clamp(land * 1.4 - d.j * 0.4)); x = gx + (tx - gx) * e; y = gy + (ty - gy) * e - Math.sin(e * Math.PI) * h * 0.18; }
        else y += Math.sin(t * 3 + i) * 2;
        c.fillStyle = d.kind === 'bot' ? C.amber : C.people; c.beginPath(); c.arc(x, y, 3.6, 0, 6.2832); c.fill();
      });
      if (land <= 0) label(c, 'WAITING FOR :00', w * 0.1, h * 0.77, C.amber, Math.max(9, bw * 0.12));
      else label(c, 'EVERYONE · SAME SECOND', w * 0.5, h * 0.94, C.go, Math.max(10, bw * 0.14), 'center');
    }
    // the countdown
    if (p > 0.5) {
      const secs = p < 0.76 ? Math.max(1, 3 - Math.floor(clamp((p - 0.5) / 0.26) * 3)) : 0;
      const txt = secs ? `00:0${secs}` : 'OPEN';
      c.font = `700 ${Math.round(bw * 0.42)}px Silk, monospace`; c.textAlign = 'center'; c.fillStyle = secs ? C.amber : C.go;
      c.shadowColor = c.fillStyle; c.shadowBlur = 16; c.fillText(txt, w * 0.5, h * 0.17); c.shadowBlur = 0;
    }
  });
  return { set(p) { P = p; } };
}

// ---------- the hero's running tape: a block every 400 ms, and at every :00 the opening block goes by
export function tape(cv) {
  const marks = []; onMoment(() => marks.push(performance.now()));
  whileVisible(cv, (t, now) => {
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h);
    const s = h * 0.62, gap = s * 0.55, step = s + gap, speed = step / 0.4, off = (t * speed) % step, n = Math.ceil(w / step) + 2;
    const base = Math.floor(t * speed / step);
    for (let i = -1; i < n; i++) {
      const x = w - (i * step + off) , y = (h - s) / 2, id = base - i;
      const hot = marks.some(m => Math.abs(((now - m) / 1000) * speed - (w - x)) < step * 0.5);
      c.strokeStyle = hot ? C.go : C.line; c.fillStyle = hot ? 'rgba(196,255,120,0.14)' : 'rgba(21,25,21,0.9)'; c.lineWidth = hot ? 2 : 1.2;
      rr(c, x, y, s, s, 5); c.fill(); c.stroke();
      const dots = hot ? 9 : (id * 2654435761 >>> 0) % 4;
      c.fillStyle = hot ? C.go : C.line2;
      for (let d = 0; d < dots; d++) { c.beginPath(); c.arc(x + s * (0.25 + 0.25 * (d % 3)), y + s * (0.25 + 0.25 * Math.floor(d / 3)), 1.6, 0, 6.2832); c.fill(); }
    }
  });
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

// ---------- the minute: sixty lamps, one per second, and every :00 they all go at once
export function lamps(cv) {
  whileVisible(cv, () => {
    const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h); if (w < 60) return;
    const now = Date.now(), s = (now % 60000) / 1000, sec = Math.floor(s), rowsN = w < 640 ? 2 : 1, per = 60 / rowsN;
    const gap = w / per, r = Math.min(gap * 0.34, (h - 26) / rowsN * 0.36), flash = s < 1.1 ? 1 - s / 1.1 : 0;
    for (let i = 0; i < 60; i++) {
      const col = i % per, row = Math.floor(i / per), x = gap * (col + 0.5), y = (rowsN === 1 ? h * 0.42 : h * (0.26 + row * 0.42));
      let a = 0.09, fill = C.go;
      if (i < sec) a = 0.85; else if (i === sec) a = 0.35 + 0.6 * (s - sec);
      if (flash) { a = Math.max(a, flash); fill = flash > 0.5 ? '#f1ffe0' : C.go; }
      c.globalAlpha = a; c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      if (i === sec && !flash) { c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, r * 1.9, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
    const marks = rowsN === 1 ? [0, 15, 30, 45] : [0, 15];
    for (const m of marks) for (let row = 0; row < rowsN; row++) {
      const i = m + row * per; if (i >= 60) continue;
      const x = gap * ((i % per) + 0.5), y = (rowsN === 1 ? h * 0.42 : h * (0.26 + row * 0.42)) + r + 16;
      const first = i % per === 0; label(c, ':' + String(i).padStart(2, '0'), first ? x - r : x, y, i === 0 ? C.go : C.dim, 10, first ? 'left' : 'center');
    }
  });
}

// ---------- the chart: the first candle of a bundled launch, and the first candle of a Kairo launch
export function candles(cv, mode) {
  const R = rng(mode === 'kairo' ? 17 : 5), N = 28, OPEN = 9, seq = [];
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
      if (i < OPEN) { seq.push(null); continue; }                          // closed: no trades at all before :00
      if (i === OPEN) { o = 1.02; cl = 1.36; vol = 1; }                    // everyone, in the same block
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
    if (mode === 'kairo') {
      const xo = cw * OPEN;
      c.strokeStyle = C.line2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(0, Y(1.02)); c.lineTo(Math.min(xo, cw * Math.max(shown, 0.5)), Y(1.02)); c.stroke(); c.setLineDash([]);
      lock(c, xo * 0.45, Y(1.02) - 26, 18, C.line2); label(c, 'CLOSED', xo * 0.45, Y(1.02) + 22, C.dim, 10, 'center');
      c.strokeStyle = shown > OPEN ? C.go : C.line2; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(xo, h * 0.04); c.lineTo(xo, h); c.stroke(); c.setLineDash([]);
      label(c, ':00 OPEN', xo + 6, h * 0.08, shown > OPEN ? C.go : C.dim, 10);
    }
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
    if (mode === 'kairo' && shown > OPEN) { const x = cw * (OPEN + 0.5), y = Y(seq[OPEN].h); lead(x, y - 4, x, Y(2.05), C.go); tagl('EVERYONE AT ONCE', x - cw * 0.3, Y(2.05) - 8, C.go); }
  });
}
