// The openings board: every new pump.fun coin, live from PumpPortal's public feed in the browser, read through Kairo's rules.
// Nothing here is simulated. If the feed is down, the board says so and offers a retry.
import { esc, short } from './util.js';
import { nextOpen, hms, ms, mmss, onMoment } from './clock.js';

const WS = 'wss://pumpportal.fun/api/data', SUPPLY = 1e9, KEEP = 60;
const safe = s => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 32) : '');
const PAL = ['#c4ff78', '#ffc24d', '#8fb7ff', '#f4efe0', '#ff9f7a', '#9cf0d0'];
const hue = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
const fmt = p => (p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p.toFixed(3)).replace(/\.?0+$/, '') + '%';

export function mountLive({ board, empty, st, retry, out, show = Infinity, scanHref = m => '#scan=' + m }) {
  const coins = new Map(); let ws = null, tries = 0, rt = 0;
  const n = { born: 0, held: 0, b0: 0 };
  const status = (k, txt) => { st.className = 'st ' + k; st.querySelector('b').textContent = txt; retry.hidden = k !== 'off'; };
  const send = o => { if (ws && ws.readyState === 1) try { ws.send(JSON.stringify(o)); } catch { /* the next reconnect resubscribes */ } };
  const put = (el, v) => { if (!el || el.textContent === String(v)) return; el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const stats = () => { put(out.born, n.born); put(out.held, n.held); put(out.b0, n.b0); };

  function connect() {
    status('', tries ? 'Reconnecting' : 'Connecting');
    let me; try { me = new WebSocket(WS); } catch { return fail(); }
    ws = me;
    const giveUp = setTimeout(() => { if (me.readyState !== 1) try { me.close(); } catch { /* */ } }, 9000);
    me.onopen = () => {
      if (ws !== me) return; clearTimeout(giveUp); tries = 0; status('live', 'Live');
      send({ method: 'subscribeNewToken' });
      const open = [...coins.values()].filter(c => !c.closed).map(c => c.mint); if (open.length) send({ method: 'subscribeTokenTrade', keys: open });
    };
    me.onmessage = e => { if (ws !== me) return; let m; try { m = JSON.parse(e.data); } catch { return; } if (!m || typeof m !== 'object') return; if (m.txType === 'create') create(m); else if (m.txType === 'buy' || m.txType === 'sell') trade(m); };
    me.onclose = () => { clearTimeout(giveUp); if (ws === me) fail(); };
    me.onerror = () => { };
  }
  function fail() {
    if (tries > 5) { status('off', 'Feed offline'); return; }
    status('', 'Reconnecting'); clearTimeout(rt); rt = setTimeout(connect, Math.min(20000, 1500 * 2 ** tries++));
  }
  retry.addEventListener('click', () => { tries = 0; clearTimeout(rt); const w = ws; ws = null; try { w && w.close(); } catch { /* */ } connect(); });

  function create(m) {
    if (typeof m.mint !== 'string' || coins.has(m.mint) || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m.mint)) return;
    const now = Date.now();
    const c = { mint: m.mint, sym: safe(m.symbol) || '???', name: safe(m.name) || 'Unnamed', creator: m.traderPublicKey, t: now, openAt: nextOpen(now),
      dev: Math.max(0, (Number(m.initialBuy) || 0) / SUPPLY * 100), v0: Number(m.vTokensInBondingCurve) || 0, first: true, held: 0, heldPct: 0, unseen: 0, opened: false, closed: false };
    coins.set(c.mint, c); n.born++;
    send({ method: 'subscribeTokenTrade', keys: [c.mint] });
    const row = document.createElement('div'); row.className = 'brow new'; c.el = row;
    row.innerHTML = `<div class="cn"><i style="background:${hue(c.mint)}">${esc(c.sym.slice(0, 1).toUpperCase())}</i><div><b>$${esc(c.sym)}</b><small>${esc(c.name)} · ${esc(short(c.mint, 4))}</small></div></div>
      <span class="mono">${hms(now)}${ms(now)}</span><span class="mono">${fmt(c.dev)}</span>
      <span class="hold"><b>0 buys</b><small>nothing yet</small></span><span class="op">IN ${mmss(c.openAt - now)}</span>
      <a class="sc" href="${esc(scanHref(c.mint))}">Scan block 0 →</a>`;
    empty.hidden = true; board.insertBefore(row, empty.nextSibling);
    setTimeout(() => row.classList.remove('new'), 800);
    const rows = board.querySelectorAll('.brow:not(.bh)');                 // only the newest rows stay on screen; every coin is still counted
    if (rows.length > show) for (const r of [...rows].slice(show)) { const k = [...coins.values()].find(x => x.el === r); if (k) k.el = null; r.remove(); }
    if (coins.size > KEEP) { const old = coins.values().next().value; drop(old); }
    stats();
  }
  function drop(c) { if (!c.closed) send({ method: 'unsubscribeTokenTrade', keys: [c.mint] }); c.closed = true; c.el && c.el.remove(); coins.delete(c.mint); }
  function trade(m) {
    const c = coins.get(m.mint); if (!c || c.closed) return;
    const tok = Math.max(0, Number(m.tokenAmount) || 0), p = tok / SUPPLY * 100;
    if (c.first) {                    // tokens that left the curve before the first trade the feed sent us: usually a block 0 bundle
      c.first = false;
      const v = Number(m.vTokensInBondingCurve) || 0, before = m.txType === 'buy' ? v + tok : v - tok;
      if (c.v0 > 0 && before > 0 && c.v0 - before > SUPPLY * 0.0005) { c.unseen = (c.v0 - before) / SUPPLY * 100; n.b0++; }
    }
    if (m.txType === 'buy' && m.traderPublicKey !== c.creator && !c.opened) { c.held++; c.heldPct += p; n.held++; }
    paint(c); stats();
  }
  function paint(c) {
    const h = c.el && c.el.querySelector('.hold'); if (!h) return;
    const b0 = c.unseen ? `<span class="b0" title="${fmt(c.unseen)} of supply left the curve before the first trade the feed saw">BLOCK 0? ${fmt(c.unseen)}</span>` : '';
    h.innerHTML = `<b>${c.held} buy${c.held === 1 ? '' : 's'}</b>${b0}<small>${c.held ? fmt(c.heldPct) + ' of supply would wait' : 'nothing yet'}</small>`;
  }
  // every second, the countdowns; at every :00, everything born before it opens at once
  document.addEventListener('kairo:second', e => {
    const now = e.detail.t;
    for (const c of coins.values()) if (!c.opened && c.el) c.el.querySelector('.op').textContent = `IN ${mmss(Math.max(0, c.openAt - now))}`;
  });
  onMoment(() => {
    const now = Date.now(); let k = 0;
    for (const c of coins.values()) {
      if (c.opened || c.openAt > now + 200) continue;
      c.opened = true; k++;
      if (c.el) { c.el.classList.add('opened', 'flash'); c.el.querySelector('.op').textContent = 'OPENED :00'; setTimeout(() => c.el && c.el.classList.remove('flash'), 1300); }
      setTimeout(() => { if (!c.closed) { send({ method: 'unsubscribeTokenTrade', keys: [c.mint] }); c.closed = true; } }, 15000);
    }
    put(out.opened, k);
  });
  connect();
}
