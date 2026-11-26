// the frame every page shares: the progress line, the menu, smooth links, and a soft fade between pages
import { $, $$ } from './util.js';
export function shell({ onNav } = {}) {
  const top = $('#top'), prog = $('#prog');
  const onScroll = () => {
    if (top) top.classList.toggle('solid', scrollY > 30);
    if (prog) { const h = document.documentElement.scrollHeight - innerHeight; prog.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const nav = $('#nav'), mb = $('#menuBtn');
  mb && mb.addEventListener('click', () => nav && nav.classList.toggle('open'));
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const h = a.getAttribute('href'); let el = null; try { el = h.length > 1 && $(h); } catch { return; } if (!el) return;
    e.preventDefault(); nav && nav.classList.remove('open'); onNav ? onNav(el) : el.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', h);
  }));
  // which section is on screen
  const links = $$('#nav a[href^="#"]'), secs = links.map(a => { try { return $(a.getAttribute('href')); } catch { return null; } });
  const spy = () => { let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; }); links.forEach((a, i) => a.classList.toggle('on', i === cur)); };
  addEventListener('scroll', spy, { passive: true }); spy();
  // leaving for another page: a quick fade instead of a hard cut
  const veil = document.createElement('div'); veil.className = 'veil'; document.body.append(veil);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || u.pathname === location.pathname) return;
    e.preventDefault(); document.documentElement.classList.add('leave'); setTimeout(() => { location.href = u.href; }, 300);
  });
  addEventListener('pageshow', e => { if (e.persisted) document.documentElement.classList.remove('leave'); });
}
