// The simulator: one made-up launch run twice, the usual way and the Kairo way, with the same wallets.
// A simple bonding curve; the numbers on screen come from this run, nothing else.
import { $, fit, clamp, ease, rng } from './util.js';

const COL = { dev: '#c4ff78', bundle: '#ff6b5e', sniper: '#ffc24d', people: '#8fb7ff' };
const BLOCKS = 24, OPEN = 1;
const cost = (s0, s1) => (s1 - s0) + 1.5 * (s1 * s1 - s0 * s0);           // price rises with what's been sold: 1 + 3s

function plan(seed) {
  const R = rng(seed), w = [];
  w.push({ g: 'dev', amt: 0.02 });
  for (let i = 0; i < 20; i++) w.push({ g: 'bundle', amt: 0.012 + R() * 0.006 });
  for (let i = 0; i < 8; i++) w.push({ g: 'sniper', amt: 0.01 + R() * 0.006 });
  for (let i = 0; i < 30; i++) w.push({ g: 'people', amt: 0.004 + R() * 0.006, at: 3 + Math.floor(R() * 20) });
  const normal = w.map((x, i) => ({ ...x, block: x.g === 'people' ? x.at : 0, ord: x.g === 'dev' ? -1 : x.g === 'people' ? 100 + x.at * 10 + R() : i + R() }));
  // on Kairo, block 0 is the creator's buy alone. Everyone else buys from block 1, in the order the network sets
  const kairo = w.map(x => ({ ...x, block: x.g === 'dev' ? 0 : x.g === 'people' ? x.at : x.g === 'bundle' ? 1 : 1 + Math.floor(R() * 2), ord: x.g === 'dev' ? -1 : 1 + R() }));
  for (const lane of [normal, kairo]) {
    lane.sort((a, b) => a.block - b.block || a.ord - b.ord); let s = 0;
    for (const x of lane) { x.p0 = s; s += x.amt; x.price = cost(x.p0, s) / x.amt; }
  }
  return { normal, kairo };
}
const avg = (l, gs) => { const xs = l.filter(x => gs.includes(x.g)); const t = xs.reduce((a, x) => a + x.amt, 0); return xs.reduce((a, x) => a + x.price * x.amt, 0) / (t || 1); };

export function mountSim() {
  const btn = $('#simGo'); if (!btn) return;
  const lanes = [{ cv: $('#simA'), clock: $('#simClockA'), f: $('#simFA'), bars: ['#sAd', '#sAb', '#sAh'].map(s => $(s)), key: 'normal' },
                 { cv: $('#simB'), clock: $('#simClockB'), f: $('#simFB'), bars: ['#sBd', '#sBb', '#sBh'].map(s => $(s)), key: 'kairo' }];
  let run = null, seed = 7;
  function draw(lane, events, tau) {
    const [c, w, h] = fit(lane.cv); c.clearRect(0, 0, w, h); if (w < 60 || h < 30) return;      // hidden (an app tab that isn't open)
    const rows = w < 640 ? 2 : 1, per0 = BLOCKS / rows, bw = (w - 8) / per0, s = Math.min(bw * 0.82, (h - 14 * rows) / rows * 0.86), y0 = rows === 1 ? (h - s) / 2 : 14;
    for (let b = 0; b < BLOCKS; b++) {
      const col = b % per0, row = Math.floor(b / per0), y = y0 + row * (s + 14);
      const x = 4 + col * bw + (bw - s) / 2, past = b <= tau, isOpen = lane.key === 'kairo' && b === OPEN;
      c.fillStyle = past ? (isOpen ? 'rgba(196,255,120,0.14)' : '#181c18') : '#121512'; c.strokeStyle = isOpen && past ? '#c4ff78' : b === 0 ? '#3b4438' : '#262b25'; c.lineWidth = isOpen && past ? 2 : 1;
      c.beginPath(); c.roundRect(x, y, s, s, 4); c.fill(); c.stroke();
      const inb = events.filter(e => e.block === b && e.block <= tau); const n = inb.length; if (!n) continue;
      const per = Math.ceil(Math.sqrt(n)), cell = s / (per + 1);
      inb.forEach((e, i) => { c.fillStyle = COL[e.g]; c.beginPath(); c.arc(x + cell * (1 + (i % per)), y + cell * (1 + Math.floor(i / per)), Math.max(1.4, cell * 0.38), 0, 6.2832); c.fill(); });
    }
    c.font = '700 10px Silk, monospace'; c.fillStyle = '#6f776c'; c.textAlign = 'left'; c.fillText('BLOCK 0', 4 + (bw - s) / 2, y0 - 4);

  }
  function frame(now) {
    const k = clamp((now - run.t0) / 4600), tau = Math.floor(k * (BLOCKS - 0.001));
    for (const lane of lanes) {
      const ev = run.plan[lane.key]; draw(lane, ev, tau);
      const done = ev.filter(e => e.block <= tau), by = g => done.filter(e => e.g === g).reduce((a, e) => a + e.amt, 0) * 100;
      lane.bars[0].style.width = `${by('dev')}%`; lane.bars[1].style.width = `${by('bundle') + by('sniper')}%`; lane.bars[2].style.width = `${by('people')}%`;
      lane.clock.textContent = lane.key === 'kairo' ? (tau < OPEN ? 'BLOCK 0 · CREATOR ONLY' : `BLOCK ${tau} · OPEN`) : `BLOCK ${tau}`;
      lane.f.innerHTML = `<span>Dev <b>${by('dev').toFixed(1)}%</b></span><span>Bundles + snipers <b>${(by('bundle') + by('sniper')).toFixed(1)}%</b></span><span>People <b>${by('people').toFixed(1)}%</b></span>`;
    }
    if (k < 1) requestAnimationFrame(frame); else finish();
  }
  function finish() {
    const n = run.plan.normal, kz = run.plan.kairo;
    const before = l => l.filter(e => e.block === 0 && e.g !== 'dev').reduce((a, e) => a + e.amt, 0) * 100;   // supply bought in block 0 by anyone but the dev
    const b0 = l => l.filter(e => e.block === 0 && e.g !== 'dev').length;
    const ratio = l => avg(l, ['people']) / avg(l, ['bundle', 'sniper']);
    const bn = before(n), bk = before(kz), zn = b0(n), zk = b0(kz), rn = ratio(n), rk = ratio(kz), fmt = r => `${r.toFixed(2)}x`;
    const t0 = performance.now(), D = 1100;                                    // the numbers count up into place
    const step = now => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      $('#vd1').innerHTML = `<span style="color:var(--red)">${(bn * e).toFixed(1)}%</span> → <span style="color:var(--go)">${(bk * e).toFixed(1)}%</span>`;
      $('#vd2').innerHTML = `<span style="color:var(--red)">${Math.round(zn * e)}</span> → <span style="color:var(--go)">${Math.round(zk * e)}</span>`;
      $('#vd3').innerHTML = `<span style="color:var(--red)">${fmt(1 + (rn - 1) * e)}</span> → <span style="color:var(--go)">${fmt(1 + (rk - 1) * e)}</span>`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    btn.disabled = false; btn.innerHTML = 'Run it again <span class="ar">→</span>';
  }
  btn.addEventListener('click', () => {
    btn.disabled = true; seed = (seed * 31 + 17) % 9973; run = { plan: plan(seed), t0: performance.now() }; requestAnimationFrame(frame);
  });
  // an idle first frame, so the lanes aren't empty boxes
  const p0 = plan(seed); lanes.forEach(l => draw(l, p0[l.key], -1));
  addEventListener('resize', () => { if (!run) lanes.forEach(l => draw(l, p0[l.key], -1)); });
  return { autoplay() { if (!run) btn.click(); } };
}
