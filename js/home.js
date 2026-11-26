// The home page: lights out, the LED name, the drawn launches, the pinned tape, the simulator, the receipt, the scanner.
import { $, $$, clamp, reduced, mobile } from './util.js';
import { shell } from './shell.js';
import { nextOpen, hms, onMoment } from './clock.js';
import { led } from './led.js';
import { duo, openScene, bundle, lamps, candles } from './scenes.js';
import { mountLive } from './live.js';
import { mountSim } from './sim.js';
import { mountScan } from './scan.js';
import { pixname } from './pixname.js';

const html = document.documentElement;

// ---------- smooth scroll
let lenis = null;
if (window.Lenis && !reduced) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
}
const go = el => (lenis ? lenis.scrollTo(el, { offset: el.id === 'open' ? 0 : -4, duration: 1.4 }) : el.scrollIntoView({ behavior: 'smooth' }));
shell({ onNav: go });
window.__kairo = { get lenis() { return lenis; }, go };

// ---------- the pointer, shared by everything that follows it
const P = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, t: -1e9 };
addEventListener('pointermove', e => { P.x = e.clientX; P.y = e.clientY; P.nx = e.clientX / innerWidth - 0.5; P.ny = e.clientY / innerHeight - 0.5; if (e.pointerType !== 'touch') P.t = performance.now(); }, { passive: true });

// ---------- the living ground: LED trails falling down the board, sparks, a light that follows the pointer, a wave at every :00
const bg = (() => {
  const cv = $('#bgDots'); if (!cv || reduced) return { wave() { } };
  const c = cv.getContext('2d'), G = 22; let W = 0, H = 0, d = 1, trails = [], sparks = [], waves = [], last = 0, run = true;
  const spot = { x: P.x, y: P.y, a: 0 };
  const size = () => { d = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round((W * H) / (G * G) * (mobile() ? 0.006 : 0.011)); trails = Array.from({ length: n }, () => mk(true)); };
  const mk = any => ({ col: Math.floor(Math.random() * (W / G + 1)), y: any ? Math.random() * (H / G + 12) - 12 : -Math.random() * 14, v: 2 + Math.random() * 6, len: 3 + Math.floor(Math.random() * 8), a: 0.18 + Math.random() * 0.4 });
  addEventListener('resize', size); size();
  document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run) { last = 0; requestAnimationFrame(loop); } });
  function dot(x, y, r, a) { c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); }
  function loop(now) {
    if (!run) return; requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    c.clearRect(0, 0, W, H); c.fillStyle = '#c4ff78';
    const oy = ((1 - scrollY) % G + G) % G;                                  // the CSS dot grid scrolls with the page
    for (const t of trails) {
      t.y += t.v * dt; if (t.y - t.len > H / G + 1) Object.assign(t, mk(false));
      const hy = Math.floor(t.y), x = 1 + t.col * G;
      for (let k = 0; k < t.len; k++) { const y = oy + (hy - k) * G; if (y < -4 || y > H + 4) continue; const f = 1 - k / t.len; dot(x, y, k ? 1.25 : 1.7, t.a * f * f); }
    }
    if (Math.random() < 0.3) sparks.push({ x: 1 + Math.floor(Math.random() * (W / G + 1)) * G, r: Math.floor(Math.random() * (H / G + 1)), life: 1 });
    sparks = sparks.filter(s => (s.life -= dt * 1.6) > 0); for (const s of sparks) dot(s.x, oy + s.r * G, 1.4, 0.5 * s.life);
    // the light under the pointer: the board's own lamps, brighter near it
    const want = now - P.t < 2200 ? 1 : 0; spot.a += (want - spot.a) * 0.06; spot.x += (P.x - spot.x) * 0.2; spot.y += (P.y - spot.y) * 0.2;
    if (spot.a > 0.02) {
      const R = 170, i0 = Math.max(0, Math.floor((spot.x - R) / G)), i1 = Math.ceil((spot.x + R) / G), j0 = Math.floor((spot.y - R - oy) / G), j1 = Math.ceil((spot.y + R - oy) / G);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const x = 1 + i * G, y = oy + j * G, dd = Math.hypot(x - spot.x, y - spot.y); if (dd < R) { const f = 1 - dd / R; dot(x, y, 1 + f * 0.9, 0.62 * f * f * spot.a); } }
    }
    waves = waves.filter(w => now - w.t < 2600);
    for (const w of waves) {
      const R = (now - w.t) / 1000 * Math.max(W, H) * 0.62, band = 46, fade = 1 - (now - w.t) / 2600, cx = w.x, cy = w.y;
      const c0 = Math.max(0, Math.floor((cx - R - band) / G)), c1 = Math.min(Math.ceil(W / G), Math.ceil((cx + R + band) / G));
      for (let i = c0; i <= c1; i++) for (let j = -1; j <= H / G + 1; j++) {
        const x = 1 + i * G, y = oy + j * G, dd = Math.abs(Math.hypot(x - cx, y - cy) - R); if (dd < band) dot(x, y, 1.6, 0.75 * fade * (1 - dd / band));
      }
    }
    c.globalAlpha = 1;
  }
  requestAnimationFrame(loop);
  return { wave(x = W / 2, y = H / 2) { waves.push({ t: performance.now(), x, y }); } };
})();

// ---------- the LED name: it lights up after the start lights, follows the pointer, and flickers when you touch it
const name = pixname($('#heroName'), { reduced });
$('#heroName').addEventListener('pointerdown', e => { name.burst(e.clientX, e.clientY); bg.wave(e.clientX, e.clientY); });
document.addEventListener('kairo:second', e => { const rc = $('#rcptOpen'); if (rc) rc.textContent = hms(nextOpen(e.detail.t)) + ' UTC'; });
onMoment(() => {
  name.jolt(); bg.wave();
  const paper = $('#paper'); if (paper && paper.classList.contains('vis') && near(paper)) reprint(paper);
});
const near = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

// ---------- one frame loop: the floats, the hero, the marquees, the parallax, the pinned tape
const floats = $$('#hero .float').map((el, i) => { el.style.transitionDelay = `${0.25 + i * 0.07}s`; return { el, d: +el.dataset.depth || 0.5, x: 0, y: 0 }; });
const hwWord = $('#hwWord'), hwCta = $('#hwCta');
const pars = $$('[data-par]').map(el => ({ el, k: +el.dataset.par }));
const marqs = [['#marq', -1], ['#marq2', 1]].map(([s, dir]) => {
  const el = $(s); if (!el) return null; el.innerHTML += el.innerHTML + el.innerHTML;
  const m = { el, dir, x: 0, w: 0 }; const measure = () => (m.w = el.scrollWidth / 3); measure(); addEventListener('resize', measure); document.fonts && document.fonts.ready.then(measure);
  if (dir > 0) m.x = -1e9;                       // starts measured on the first frame
  return m;
}).filter(Boolean);
let lastY = scrollY, vel = 0;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced;
const mags = fine ? $$('.hero .btn, .final .btn, .cta-row .btn, #simGo, .rcpt-wrap .btn').map(el => ({ el, x: 0, y: 0 })) : [];
const pcur = fine ? Object.assign(document.createElement('div'), { className: 'pcur' }) : null;
const cur2 = { x: P.x, y: P.y };
if (pcur) {
  document.body.append(pcur);
  document.addEventListener('pointerover', e => pcur.classList.toggle('big', !!(e.target.closest && e.target.closest('a, button, summary, input, label, .pn, .seg2'))));
  addEventListener('pointerdown', () => pcur.classList.add('down')); addEventListener('pointerup', () => pcur.classList.remove('down'));
  document.addEventListener('pointerleave', () => pcur.classList.remove('on'));
}

const open = $('#open'), steps = $$('#steps .step'), rails = $$('#rail i'), tag = $('#openTag');
const os = openScene($('#openCv'));
const TAGS = ['SLOT TAPE · BLOCK 0', 'BLOCK 0 · CLOSED · BOTS TURNED AWAY', 'COUNTDOWN · PUBLIC TO EVERYONE', 'OPEN · EVERYONE AT :00'];
let cur = -1;

function frame(now) {
  requestAnimationFrame(frame);
  const sy = scrollY, vh = innerHeight;
  // the pixel that follows the pointer, and buttons that lean toward it
  if (pcur) { cur2.x += (P.x - cur2.x) * 0.24; cur2.y += (P.y - cur2.y) * 0.24; pcur.style.transform = `translate3d(${cur2.x.toFixed(1)}px,${cur2.y.toFixed(1)}px,0)`; pcur.classList.toggle('on', now - P.t < 3500); }
  for (const m of mags) {
    const r = m.el.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) continue;
    let tx = 0, ty = 0; const dx = P.x - (r.left + r.width / 2), dy = P.y - (r.top + r.height / 2);
    if (now - P.t < 3000 && Math.abs(dx) < r.width / 2 + 36 && Math.abs(dy) < r.height / 2 + 30) { tx = dx * 0.2; ty = dy * 0.28; }
    m.x += (tx - m.x) * 0.16; m.y += (ty - m.y) * 0.16; m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
  }
  vel += ((sy - lastY) - vel) * 0.18; lastY = sy;
  // the hero: the name tilts away and dissolves, the buttons go first, the floats drift with the pointer
  if (sy < vh * 1.4) {
    for (const f of floats) {
      const tx = -P.nx * 46 * f.d, ty = -P.ny * 32 * f.d - sy * 0.32 * f.d;
      f.x += (tx - f.x) * 0.07; f.y += (ty - f.y) * 0.07; f.el.style.transform = `translate3d(${f.x.toFixed(1)}px,${f.y.toFixed(1)}px,0)`;
    }
    const k = clamp(sy / (vh * 0.8));
    if (hwWord) hwWord.style.transform = `perspective(1000px) translate3d(0,${(sy * 0.22).toFixed(1)}px,0) rotateX(${(k * 22).toFixed(2)}deg) scale(${(1 - k * 0.1).toFixed(4)})`;
    if (hwCta) { hwCta.style.transform = `translate3d(0,${(sy * 0.4).toFixed(1)}px,0)`; hwCta.style.opacity = clamp(1 - k * 2.2).toFixed(3); }
    name.scatter(clamp((k - 0.08) / 0.75));
  }
  // the marquees drift on their own and run with the scroll
  for (const m of marqs) {
    if (!m.w) continue; if (m.x < -1e8) m.x = -m.w;
    const v = (reduced ? 0 : 0.7) + Math.min(26, Math.abs(vel)) * 0.55;
    m.x += m.dir * v; if (m.x <= -m.w) m.x += m.w; if (m.x > 0) m.x -= m.w;
    m.el.style.transform = `translate3d(${m.x.toFixed(1)}px,0,0) skewX(${clamp(-vel * 0.12 * -m.dir, -8, 8).toFixed(2)}deg)`;
  }
  // parallax: things that float a little slower than the page
  for (const p of pars) { const r = p.el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue; p.el.style.translate = `0 ${((r.top + r.height / 2 - vh / 2) * -p.k).toFixed(1)}px`; }
  // the pinned tape
  if (open) {
    let p;
    if (mobile()) p = ((now / 1000) % 11) / 11;
    else { const r = open.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) return; p = clamp(-r.top / (r.height - vh)); }
    os.set(p);
    const s = Math.min(3, Math.floor(p * 4));
    if (s !== cur) { cur = s; steps.forEach((el, i) => el.classList.toggle('on', i === s)); if (tag) tag.textContent = TAGS[s]; }
    rails.forEach((el, i) => el.style.setProperty('--k', i < s ? 1 : i > s ? 0 : (p * 4 - s).toFixed(3)));
  }
}
requestAnimationFrame(frame);

// ---------- the drawn scenes
duo($('#duoA'), 'normal'); duo($('#duoB'), 'kairo');
candles($('#chartA'), 'normal'); candles($('#chartB'), 'kairo');

// ---------- 02: a bundle, drawn. It alternates between the two launches until you pick one
const seg = $('#bundleSeg'); let picked = null;
const setSeg = m => seg && $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.m === m));
const bun = bundle($('#bundleCv'), cyc => { const m = picked || (cyc % 2 ? 'kairo' : 'normal'); setSeg(m); return m; });
seg && seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; picked = b.dataset.m; setSeg(picked); bun.restart(); });

// ---------- 04: the minute: the real UTC time on an LED board, sixty lamps, the facts counting into place
const ledTime = $('#ledTime') ? led($('#ledTime'), { text: hms(Date.now()), glow: 12 }) : null;
document.addEventListener('kairo:second', e => ledTime && ledTime.set(hms(e.detail.t)));
onMoment(() => ledTime && ledTime.flicker(700));
lamps($('#lampsCv'));
const facts = $$('#facts b');
if (facts.length) new IntersectionObserver(([e], o) => {
  if (!e.isIntersecting) return; o.disconnect(); const t0 = performance.now();
  const step = now => {
    const k = reduced ? 1 : Math.min(1, (now - t0) / 1500), ee = 1 - Math.pow(1 - k, 3);
    facts.forEach(b => { const from = +(b.dataset.from || 0), to = +b.dataset.to; b.textContent = (b.dataset.pre || '') + Math.round(from + (to - from) * ee) + (b.dataset.suf || ''); });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}, { threshold: 0.4 }).observe($('#facts'));

// ---------- 05: the live board, connected only when you get near it
const liveSec = $('#live');
if (liveSec) new IntersectionObserver(([e], o) => {
  if (!e.isIntersecting) return; o.disconnect();
  mountLive({ board: $('#board'), empty: $('#bEmpty'), st: $('#feedSt'), retry: $('#feedRetry'),
    out: { born: $('#stBorn'), held: $('#stHeld'), b0: $('#stB0'), opened: $('#stOpened') }, show: 6, scanHref: m => '/app#scan=' + m });
}, { rootMargin: '900px 0px' }).observe(liveSec);

// ---------- the simulator starts itself the first time it's seen
const sim = mountSim();
if (sim) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { sim.autoplay(); o.disconnect(); } }, { threshold: 0.22 }).observe($('#sim .sim'));

// ---------- the scanner
mountScan({ form: $('#scanForm'), input: $('#scanIn'), out: $('#scanOut'), err: $('#scanErr'), paste: $('#scanPaste') });

// ---------- the receipt prints when it's seen, and again at every :00 while you watch
function reprint(p) { p.style.transition = 'none'; p.classList.remove('vis'); void p.offsetWidth; p.style.transition = ''; p.classList.add('vis'); }

// ---------- the questions open and close smoothly
$$('.qa').forEach(d => {
  const sum = d.querySelector('summary'), body = d.querySelector('p'); if (!sum || !body) return;
  sum.addEventListener('click', e => {
    e.preventDefault(); if (d.dataset.busy) return; d.dataset.busy = '1';
    const ease = 'cubic-bezier(.16, 1, .3, 1)', done = () => delete d.dataset.busy;
    if (d.open) { const h = body.offsetHeight; const a = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: ease }); a.onfinish = () => { d.open = false; done(); }; }
    else { d.open = true; const h = body.offsetHeight; const a = body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 520, easing: ease }); a.onfinish = done; }
  });
});

// ---------- cards lean toward the pointer
if (fine) $$('.duo .card, .rule').forEach(el => {
  el.addEventListener('pointermove', e => { if (!el.classList.contains('vis')) return; const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.setProperty('--ty', (x * 7).toFixed(2) + 'deg'); el.style.setProperty('--tx', (-y * 6).toFixed(2) + 'deg'); el.classList.add('tilt'); });
  el.addEventListener('pointerleave', () => el.classList.remove('tilt'));
});
// ---------- the green words in a heading scramble through the board's characters before they settle
const GL = 'abcdefghkmnoprstuvwxyz0123456789';
function scramble(span, delay) {
  const fin = span.textContent; if (reduced || !fin.trim()) return;
  const t0 = performance.now() + delay, dur = 480 + fin.length * 40; let set = false;
  const step = now => {
    if (now < t0) { requestAnimationFrame(step); return; }
    if (!set) { span.style.width = span.getBoundingClientRect().width + 'px'; span.classList.add('scr'); set = true; }
    const k = (now - t0) / dur;
    if (k >= 1) { span.textContent = fin; span.style.width = ''; span.classList.remove('scr'); return; }
    const n = Math.floor(k * fin.length);
    span.textContent = fin.slice(0, n) + [...fin.slice(n)].map(ch => (/[\s.,:'0]/.test(ch) ? ch : GL[(Math.random() * GL.length) | 0])).join('');
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); sio.unobserve(e.target); } }), { threshold: 0.08 });
$$('.sec').forEach(el => sio.observe(el));

// ---------- eyebrows type themselves in, words rise, rows slide, cards land
const eys = $$('.sec .ey, .open .ey').map(el => { const t = el.textContent; return { el, t }; });
function typeIn(e) {
  if (reduced) return; let i = 0; const { el, t } = e;
  el.innerHTML = '<span></span><i class="cur"></i>'; const sp = el.firstChild;
  const step = () => { i++; sp.textContent = t.slice(0, i); if (i < t.length) setTimeout(step, 26); else setTimeout(() => { const c = el.querySelector('.cur'); c && c.remove(); }, 900); };
  step();
}
function splitWords(el) {
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => { if (!part) return; if (/^\s+$/.test(part)) { frag.append(part); return; } const s = document.createElement('span'); s.className = 'w'; s.textContent = part; s.style.transitionDelay = `${i++ * 60}ms`; frag.append(s); });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) walk(n);
  });
  walk(el);
}
$$('.split').forEach(splitWords);
$$('#vsTable .vs-row').forEach((r, i) => { r.style.transitionDelay = `${i * 90}ms`; const ok = r.querySelector('.ok'); if (ok) ok.style.transitionDelay = `${i * 90 + 260}ms`; });
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; e.target.classList.add('vis'); io.unobserve(e.target);
  if (e.target.classList.contains('split')) $$('em .w', e.target).forEach(w => scramble(w, parseFloat(w.style.transitionDelay) || 0));
  const ey = eys.find(x => x.el === e.target); if (ey) typeIn(ey);
}), { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
$$('.rv, .split, #vsTable, #lapsEl').forEach(el => io.observe(el));
eys.forEach(e => io.observe(e.el));
// (observe the printer, not the paper: a clipped paper never counts as seen)
const pio = new IntersectionObserver(([e]) => { if (e.isIntersecting) { $('#paper').classList.add('vis'); pio.disconnect(); } }, { threshold: 0.3 });
$('.printer') && pio.observe($('.printer'));

// ---------- straight to the home page: the name flies in, the buttons rise
requestAnimationFrame(() => { html.classList.remove('hold'); name.assemble(); bg.wave(); });
{ const h = location.hash; if (h && /^#[a-z]+$/.test(h)) { const el = $(h); if (el) setTimeout(() => go(el), 300); } }
if (lenis) { const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
