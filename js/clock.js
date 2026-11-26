// the one clock every visitor shares: UTC, the next minute, and the moment it turns
const pad = (n, w = 2) => String(n).padStart(w, '0');
export const now = () => Date.now();
export const nextOpen = (t = now()) => Math.floor(t / 60000) * 60000 + 60000;
export const toOpen = (t = now()) => nextOpen(t) - t;                       // ms to the next :00
export const hms = t => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
export const ms = t => '.' + pad(new Date(t).getUTCMilliseconds(), 3);
export const mmss = msLeft => { const s = Math.ceil(msLeft / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const subs = new Set();
export function onMoment(fn) { subs.add(fn); return () => subs.delete(fn); }
function arm() {
  setTimeout(() => {
    document.body.classList.add('moment'); subs.forEach(f => { try { f(); } catch (e) { } });
    setTimeout(() => document.body.classList.remove('moment'), 1300); arm();
  }, toOpen() + 5);
}
arm();
