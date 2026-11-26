// The launch form: name, ticker, image and your one buy in block 0, with a live coin card and its receipt.
// Launches go live in the next lap; until then the form saves a draft on this device and prints its receipt.
import { $, $$, esc, store, toast } from './util.js';

export function mountLaunch() {
  const f = $('#lform'); if (!f) return;
  const name = $('#lName'), tick = $('#lTick'), desc = $('#lDesc'), buy = $('#lBuy'), xh = $('#lX'), tg = $('#lTg'), web = $('#lWeb'), file = $('#lImg');
  let img = null;
  const T = () => tick.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const N = () => name.value.replace(/[<>]/g, '').trim().slice(0, 32);
  const B = () => (+buy.value).toFixed(1);
  function paint() {
    const t = T(), n = N(), d = desc.value.trim();
    $('#lBuyV').textContent = B() + '%';
    $('#cTick').textContent = t ? '$' + t : '$TICKER';
    $('#cName').textContent = n || 'Your coin';
    $('#cDesc').textContent = d || 'Your description shows here.';
    $('#cBuy').textContent = B() + '%';
    const pic = $('#cPic'); pic.innerHTML = img ? `<img src="${img}" alt="">` : `<span>${esc((t || 'K').slice(0, 1))}</span>`;
    $('#rCoin').textContent = t ? '$' + t : 'YOUR TICKER'; $('#rName').textContent = (n || 'Your coin').toUpperCase().slice(0, 24); $('#rBuy').textContent = B() + '% OF SUPPLY';
    $('#lPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`${t ? '$' + t + ' is' : 'My coin is'} launching on Kairo.\n\nBlock 0: one buy, mine (${B()}% of supply). No bundles, no snipers.\nFrom block 1, it's everyone's.`);
    store.set('kairo:draft', { name: name.value, tick: tick.value, desc: desc.value, buy: buy.value, x: xh.value, tg: tg.value, web: web.value, img });
  }
  function reprint() { const p = $('#pPaper'); p.classList.remove('reprint'); void p.offsetWidth; p.classList.add('reprint'); }
  // a saved draft comes back
  const d = store.get('kairo:draft', null);
  if (d) { name.value = d.name || ''; tick.value = d.tick || ''; desc.value = d.desc || ''; buy.value = d.buy || 1; xh.value = d.x || ''; tg.value = d.tg || ''; web.value = d.web || ''; img = d.img || null; }
  [name, tick, desc, buy, xh, tg, web].forEach(i => i.addEventListener('input', paint));
  [name, tick, buy].forEach(i => i.addEventListener('change', reprint));
  // the image: cropped square in the browser, kept small
  const drop = $('#lDrop');
  const take = fl => {
    if (!fl || !/^image\//.test(fl.type)) { toast('Pick an image file'); return; }
    const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
      const s = Math.min(im.width, im.height), cv = document.createElement('canvas'); cv.width = cv.height = 256;
      cv.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
      img = cv.toDataURL('image/jpeg', 0.86); paint(); reprint();
    }; im.src = r.result; }; r.readAsDataURL(fl);
  };
  file.addEventListener('change', () => take(file.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));
  // launch: checks the form, then says plainly where launches stand
  f.addEventListener('submit', e => {
    e.preventDefault();
    const miss = !N() ? 'Give your coin a name.' : !T() ? 'Give your coin a ticker.' : null;
    const st = $('#lStatus');
    if (miss) { st.className = 'lstatus err'; st.innerHTML = esc(miss); st.hidden = false; return; }
    st.className = 'lstatus'; st.hidden = false;
    st.innerHTML = `<b>Your launch is ready to go.</b> Launches on Kairo open in the next lap. Your draft is saved on this device, so it'll be here when they do. Save the receipt or post it while you wait.`;
    reprint(); st.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#lReset').addEventListener('click', () => { [name, tick, desc, xh, tg, web].forEach(i => (i.value = '')); buy.value = 1; img = null; $('#lStatus').hidden = true; paint(); reprint(); });
  // the receipt as a picture
  $('#lPng').addEventListener('click', async () => {
    try { await document.fonts.load('700 20px Silk'); } catch { /* falls back to monospace */ }
    const S = 2, W = 380, H = 620, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; const c = cv.getContext('2d'); c.scale(S, S);
    c.fillStyle = '#0d0f0d'; c.fillRect(0, 0, W, H);
    const x0 = 20, w = W - 40; c.fillStyle = '#f4efe0'; c.fillRect(x0, 16, w, H - 44);
    for (let x = x0; x < x0 + w; x += 10) { c.beginPath(); c.moveTo(x, H - 28); c.lineTo(x + 5, H - 20); c.lineTo(x + 10, H - 28); c.fill(); }
    c.fillStyle = '#1a1c18'; let y = 62; const L = 36, R = x0 + w - 16;
    const ctr = (t, sz) => { c.font = `700 ${sz}px Silk, monospace`; c.textAlign = 'center'; c.fillText(t, W / 2, y); };
    const row = (a, b, ok) => { c.font = '700 13px Silk, monospace'; c.textAlign = 'left'; c.fillStyle = '#1a1c18'; c.fillText(a, L, y); c.textAlign = 'right'; c.fillStyle = ok ? '#3f7a10' : '#1a1c18'; c.fillText(b, R, y); c.fillStyle = '#1a1c18'; y += 21; };
    const hr = () => { y -= 6; c.strokeStyle = '#b9b4a3'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); c.setLineDash([]); y += 24; };
    ctr('KAIRO', 26); y += 22; ctr('LAUNCH RECEIPT', 13); y += 22; hr();
    row('COIN', T() ? '$' + T() : 'YOUR TICKER'); row('NAME', (N() || 'Your coin').toUpperCase().slice(0, 18)); row('VENUE', 'SOLANA'); hr();
    row('BLOCK 0', '1 BUY'); row('BUYER', 'THE CREATOR'); row('SIZE', B() + '% OF SUPPLY'); row('BUNDLES', '0', true); row('SNIPES', '0', true); hr();
    row('BLOCK 1', 'OPEN'); row('WHO CAN BUY', 'EVERYONE'); hr();
    ctr('BLOCK 0 IS CLOSED.', 13); y += 18;
    const bars = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2]; let bx = L;
    while (bx < R - 4) { for (const b of bars) { if (bx >= R - 4) break; c.fillRect(bx, y, b, 46); bx += b + 2; } }
    c.save(); c.translate(R - 34, 52); c.rotate(0.14); c.strokeStyle = '#c0392b'; c.fillStyle = '#c0392b'; c.lineWidth = 2; c.globalAlpha = 0.8;
    c.strokeRect(-36, -16, 72, 24); c.font = '700 11px Silk, monospace'; c.textAlign = 'center'; c.fillText('DRAFT', 0, 1); c.restore();
    cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kairo-receipt${T() ? '-' + T().toLowerCase() : ''}.png`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png');
  });
  paint();
}
