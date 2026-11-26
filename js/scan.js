// The block 0 scanner: read any Solana coin's launch from the chain and show what Kairo would have done with it.
import { $, esc, isAddr, short, pct, fit, toast } from './util.js';

const hhmm = s => { if (!s) return '—'; const d = new Date(s * 1000); return d.toISOString().slice(11, 19) + ' UTC'; };
const day = s => (s ? new Date(s * 1000).toISOString().slice(0, 10) : '');

function drawMap(cv, r) {
  const [c, w, h] = fit(cv); c.clearRect(0, 0, w, h);
  const b0 = r.block0.buyers, s0 = Math.min(h * 0.72, w * 0.42), x0 = 10, y0 = (h - s0) / 2 + 8;
  c.fillStyle = '#151915'; c.strokeStyle = '#3b4438'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x0, y0, s0, s0, 10); c.fill(); c.stroke();
  c.font = '700 10px Silk, monospace'; c.fillStyle = '#6f776c'; c.textAlign = 'left'; c.fillText(`BLOCK 0 · SLOT ${r.launch.slot}`, x0, y0 - 8);
  const all = [{ dev: true }, ...b0.filter(b => !b.dev)], n = Math.max(1, all.length), per = Math.ceil(Math.sqrt(n)), cell = s0 / (per + 1), rad = Math.max(2.4, Math.min(9, cell * 0.36));
  all.forEach((b, i) => { c.fillStyle = b.dev ? '#c4ff78' : b.bundle ? '#ff6b5e' : '#ffc24d'; c.beginPath(); c.arc(x0 + cell * (1 + (i % per)), y0 + cell * (1 + Math.floor(i / per)), rad, 0, 6.2832); c.fill(); });
  // from block 1: the first minute of open trading, everyone who bought (they all pass)
  const ex = x0 + s0 + 26, ew = w - ex - 10, ey = y0 + s0 * 0.25, eh = s0 * 0.5, win = (r.after && r.after.window) || 60;
  c.strokeStyle = 'rgba(196,255,120,0.45)'; c.beginPath(); c.roundRect(ex, ey, ew, eh, 8); c.stroke();
  c.fillStyle = '#c4ff78'; c.fillText('FROM BLOCK 1 · OPEN TO EVERYONE', ex, ey - 8);
  ((r.after && r.after.buys) || []).slice(0, 220).forEach((b, i) => { const x = ex + 6 + Math.min(1, b.t / win) * (ew - 12), y = ey + 8 + ((i * 37) % 100) / 100 * (eh - 16); c.fillStyle = '#8fb7ff'; c.beginPath(); c.arc(x, y, 2.4, 0, 6.2832); c.fill(); });
  c.fillStyle = '#6f776c'; c.textAlign = 'right'; c.fillText(`FIRST ${win} SECONDS`, ex + ew, ey + eh + 18);
}

const ACT = { dev: ['dev', 'DEV BUY ✓'], refuse: ['refuse', 'BLOCK 0 ✗'], pass: ['pass', 'OPEN ✓'] };
function timeline(r) {
  const rows = (r.timeline || []).map(e => { const [k, label] = ACT[e.action] || ACT.pass; return `<div class="tr"><span>+${Math.max(0, e.t)}s</span><span>${e.slot === 0 ? 'BLOCK 0' : '+' + e.slot}</span><span>${esc(short(e.owner, 6))}${e.owner === r.creator ? ' · dev' : e.bundle ? ' · bundle' : ''}</span><span>${e.side === 'buy' ? 'buy' : 'sell'}</span><span>${pct(e.pct)}</span><span class="a ${k}">${label}</span></div>`; }).join('');
  return `<div class="tl"><div class="tl-wrap"><div class="tr"><span>TIME</span><span>SLOT</span><span>WALLET</span><span>SIDE</span><span>SUPPLY</span><span>KAIRO</span></div>${rows}</div></div>`;
}
let last = null; addEventListener('resize', () => last && last());
export function render(out, r, full = false) {
  const others = r.block0.buyers.filter(b => !b.dev), tone = r.verdict === 'blocked' ? 'r' : 'g';
  const img = r.image && /^https:\/\//.test(r.image) ? `<img src="${esc(r.image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '';
  out.innerHTML = `
    <div class="res">
      <div>
        <div class="coin">${img}<div><b>${esc(r.symbol ? '$' + r.symbol : short(r.mint, 6))}</b><span>${esc(r.name || '')}${r.venue ? ' · ' + esc(r.venue) : ''} · born ${esc(day(r.launch.time))} ${esc(hhmm(r.launch.time))}</span></div></div>
        <div class="hl ${tone}">${esc(r.headline)}</div>
        <div class="kv">
          <div><span>Wallets in block 0 besides the dev</span><b class="num" style="color:${others.length ? 'var(--red)' : 'var(--go)'}">${others.length}</b></div>
          <div><span>Supply they took in block 0</span><b class="num">${pct(r.block0.otherPct)}</b></div>
          <div><span>Bundled wallets found</span><b class="num">${r.bundles.reduce((a, b) => a + b.wallets.length, 0)}</b></div>
          <div><span>The dev's buy in block 0</span><b class="num" style="color:var(--go)">${pct(r.block0.devPct)}</b></div>
        </div>
        <p class="sim-note">${others.length ? `${others.length} wallet${others.length === 1 ? '' : 's'} bought in block 0 next to the dev. A Kairo receipt names every one of them.` : "Block 0 held the dev's buy alone: a clean receipt."} From block 1, everyone buys as usual: ${(r.after && r.after.count) || 0} buy${((r.after && r.after.count) || 0) === 1 ? '' : 's'} in the first minute. ${r.read.partial ? 'Read in part: the public RPC was slow, so this covers what arrived.' : ''}</p>
        <p class="sim-note"><a href="https://solscan.io/tx/${esc(r.launch.sig)}" target="_blank" rel="noopener" style="color:var(--go)">The launch on Solscan ↗</a></p>
      </div>
      <div class="blockmap"><canvas id="bmap"></canvas>
        <div class="wl">${[{ owner: r.creator, pct: r.block0.devPct, dev: true }, ...others].slice(0, 60).map(b => `<div><span>${esc(short(b.owner, 6))}${b.dev ? ' · dev' : b.bundle ? ' · bundle' : ''}</span><span class="${b.dev ? 'd' : 'x'}">${pct(b.pct)} ${b.dev ? '✓' : '✗'}</span></div>`).join('')}</div>
      </div>
    </div>${full ? timeline(r) : ''}`;
  const cv = $('#bmap', out); drawMap(cv, r);
  last = () => drawMap(cv, r);
}

export function mountScan({ form, input, out, err, paste, hash = true, full = false }) {
  if (!form) return;
  paste && paste.addEventListener('click', async () => { try { input.value = (await navigator.clipboard.readText()).trim(); input.focus(); } catch { toast('Paste with Ctrl+V'); } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const ca = input.value.trim(); err.textContent = '';
    if (!isAddr(ca)) { err.textContent = "That isn't a Solana address. Paste a coin's contract address."; return; }
    const btn = form.querySelector('button'); btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = 'Reading the chain…';
    out.innerHTML = `<div class="scan-empty"><div><b>READING</b>Walking back to the block ${esc(short(ca, 4))} was born in…</div><div><b>BLOCK 0</b>—</div><div><b>BUNDLES</b>—</div><div><b>BLOCK 1</b>—</div></div>`;
    try {
      const r = await fetch('/api/scan?mint=' + encodeURIComponent(ca)).then(x => x.json());
      if (!r || !r.ok) throw new Error((r && r.error) || 'The scan did not finish. Try again in a minute.');
      render(out, r, full); history.replaceState(null, '', '#scan=' + ca);
    } catch (x) { err.textContent = x.message || String(x); out.innerHTML = ''; }
    btn.disabled = false; btn.innerHTML = label;
  });
  const m = hash && /#scan=([1-9A-HJ-NP-Za-km-z]{32,44})/.exec(location.hash); if (m) { input.value = m[1]; form.requestSubmit(); }
}
