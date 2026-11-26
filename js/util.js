// small helpers shared by every page
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const ease = x => 1 - Math.pow(1 - x, 3);
export const eio = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const isAddr = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
export const short = (s, n = 4) => (s && s.length > n * 2 + 1 ? s.slice(0, n) + '…' + s.slice(-n) : s || '');
export const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const mobile = () => innerWidth < 1001;
export const pct = v => (v == null ? '—' : (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3)).replace(/\.?0+$/, '') + '%');
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
let tt = 0;
export function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }
export async function copy(text, msg = 'Copied') { try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Copy failed'); } }
// size a canvas to its box at the device's pixel ratio; returns [ctx, w, h] in CSS pixels
export function fit(cv, max = 2) {
  const r = cv.getBoundingClientRect(), d = Math.min(max, devicePixelRatio || 1), w = Math.max(1, r.width), h = Math.max(1, r.height);
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return [c, w, h];
}
// run fn(t) every frame while the element is on screen
export function whileVisible(el, fn) {
  let vis = false, raf = 0; const t0 = performance.now();
  const loop = now => { raf = vis ? requestAnimationFrame(loop) : 0; if (vis) fn((now - t0) / 1000, now); };
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '80px' }).observe(el);
}
