// The receipt printer: draft the receipt a coin would carry on Kairo, then save it as a PNG or post it. Nothing is launched.
import { $, $$ } from './util.js';
import { nextOpen, hms, mmss } from './clock.js';

export function mountPrinter() {
  const name = $('#pName'), tick = $('#pTick'), buy = $('#pBuy'), seg = $('#pOpen'), paper = $('#pPaper');
  if (!paper) return;
  let mins = 1;
  const openAt = () => nextOpen() + (mins - 1) * 60000;
  const T = () => tick.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const TT = () => (T() ? '$' + T() : 'YOUR TICKER');
  const N = () => (name.value.replace(/[<>]/g, '').trim() || 'Your coin').toUpperCase().slice(0, 24);
  const B = () => (+buy.value).toFixed(1);
  function upd(again) {
    $('#rCoin').textContent = TT(); $('#rName').textContent = N();
    $('#pBuyV').textContent = B() + '%'; $('#rBuy').textContent = B() + '% OF SUPPLY';
    $('#rOpen').textContent = hms(openAt()) + ' UTC'; $('#rIn').textContent = mmss(openAt() - Date.now());
    $('#pX').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`Drafted my launch on Kairo.\n\nBlock 0: one buy, mine (${B()}% of supply). No bundles, no snipes.\nIt opens on the minute, for everyone at once.\n\nNot first. On time.`);
    if (again) { paper.classList.remove('reprint'); void paper.offsetWidth; paper.classList.add('reprint'); }
  }
  [name, tick].forEach(i => i.addEventListener('input', () => upd(false)));
  [name, tick].forEach(i => i.addEventListener('change', () => upd(true)));
  buy.addEventListener('input', () => upd(false)); buy.addEventListener('change', () => upd(true));
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; mins = +b.dataset.m; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); upd(true); });
  document.addEventListener('kairo:second', () => upd(false));
  $('#pPng').addEventListener('click', async () => {
    try { await document.fonts.load('700 20px Silk'); } catch { /* falls back to monospace */ }
    const S = 2, W = 380, H = 640, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; const c = cv.getContext('2d'); c.scale(S, S);
    c.fillStyle = '#0d0f0d'; c.fillRect(0, 0, W, H);
    const x0 = 20, w = W - 40; c.fillStyle = '#f4efe0'; c.fillRect(x0, 16, w, H - 44);
    for (let x = x0; x < x0 + w; x += 10) { c.beginPath(); c.moveTo(x, H - 28); c.lineTo(x + 5, H - 20); c.lineTo(x + 10, H - 28); c.fill(); }
    c.fillStyle = '#1a1c18'; c.textBaseline = 'alphabetic';
    let y = 62; const L = 36, R = x0 + w - 16;
    const ctr = (t, sz) => { c.font = `700 ${sz}px Silk, monospace`; c.textAlign = 'center'; c.fillText(t, W / 2, y); };
    const row = (a, b, ok) => { c.font = '700 13px Silk, monospace'; c.textAlign = 'left'; c.fillStyle = '#1a1c18'; c.fillText(a, L, y); c.textAlign = 'right'; c.fillStyle = ok ? '#3f7a10' : '#1a1c18'; c.fillText(b, R, y); c.fillStyle = '#1a1c18'; y += 21; };
    const hr = () => { y -= 6; c.strokeStyle = '#b9b4a3'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); c.setLineDash([]); y += 24; };
    ctr('KAIRO', 26); y += 22; ctr('OPENING RECEIPT', 13); y += 22; hr();
    row('COIN', TT()); row('NAME', N()); row('VENUE', 'SOLANA'); hr();
    row('BLOCK 0', '1 BUY'); row('BUYER', 'THE CREATOR'); row('SIZE', B() + '% OF SUPPLY'); row('BUNDLES', '0', true); row('SNIPES', '0', true); hr();
    row('OPENS AT', hms(openAt()) + ' UTC'); row('BEFORE OPEN', '0 TRADES', true); row('OPENING BLOCK', 'EVERYONE'); hr();
    ctr('NOT FIRST. ON TIME.', 13); y += 18;
    const bars = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2]; let bx = L;
    while (bx < R - 4) { for (const b of bars) { if (bx >= R - 4) break; c.fillRect(bx, y, b, 46); bx += b + 2; } }
    c.save(); c.translate(R - 34, 52); c.rotate(0.14); c.strokeStyle = '#c0392b'; c.fillStyle = '#c0392b'; c.lineWidth = 2; c.globalAlpha = 0.8;
    c.strokeRect(-36, -16, 72, 24); c.font = '700 11px Silk, monospace'; c.textAlign = 'center'; c.fillText('DRAFT', 0, 1); c.restore();
    cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kairo-receipt${T() ? '-' + T().toLowerCase() : ''}.png`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png');
  });
  upd(false);
}
