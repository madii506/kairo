// Launch a coin on Kairo, for real: Raydium LaunchLab, one transaction that creates the coin with your buy inside it.
// The flow: store the image, build the launch (tried against Solana before you sign), your wallet signs, this page signs for the
// new coin's address (that key is made here and never leaves the page), Solana confirms, and the receipt reads block 0 back from the chain.
import { $, esc, store, toast, short, pct, copy } from './util.js';
import { wallet } from './wallet.js';
import * as ed from '../vendor/ed25519.js';

const API = '/api/launch?a=';
const SITE = location.origin;
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) { let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of bytes) { if (x === 0) s = '1' + s; else break; } return s; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtTok = n => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n))).replace(/\.0([MK])$/, '$1');
const ago = t => { if (!t) return ''; const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
async function api(op, body, q = '') {
  const r = await fetch(API + op + q, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!j || !j.ok) { const e = new Error((j && j.error) || `The server did not answer (${r.status}). Try again.`); e.code = j && j.code; throw e; }
  return j;
}

// ---------- the signature this page adds: the new coin's address signs the exact message the wallet signed ----------
function cu16(b, o) { let len = 0, size = 0; for (;;) { const e = b[o + size]; len |= (e & 0x7f) << (size * 7); size++; if (!(e & 0x80)) break; } return [len, size]; }
async function signAsMint(tx, pub, seed) {
  const [n, s] = cu16(tx, 0), msg = tx.subarray(s + n * 64);
  let o = msg[0] & 0x80 ? 1 : 0; const nReq = msg[o]; o += 3;
  const [nk, ks] = cu16(msg, o); o += ks;
  let at = -1;
  for (let i = 0; i < Math.min(nReq, nk, n); i++) { const k = msg.subarray(o + i * 32, o + i * 32 + 32); if (k.every((x, j) => x === pub[j])) { at = i; break; } }
  if (at < 0) throw new Error('The wallet changed the launch so the new coin no longer signs it. Nothing was sent.');
  if (tx.subarray(s, s + 64).every(x => x === 0)) throw new Error('The wallet did not sign. Nothing was sent.');
  const sig = await ed.signAsync(msg, seed), full = new Uint8Array(tx);
  full.set(sig, s + at * 64); return full;
}

// ---------- the receipt paper, as a draft or as read from the chain ----------
function rows(d) {
  if (!d.live) return [
    ['COIN', d.t ? '$' + d.t : 'YOUR TICKER'], ['NAME', (d.n || 'Your coin').toUpperCase().slice(0, 22)], ['VENUE', 'RAYDIUM'], null,
    ['BLOCK 0', d.sol ? 'YOUR BUY' : 'NO BUY'], ['SIZE', d.sol ? (d.q ? '≈ ' + pct(d.q.pct) + ' OF SUPPLY' : d.sol + ' SOL') : '—'], ['PAID', d.sol ? d.sol + ' SOL' : '—'], ['OTHER BUYERS', 'READ AT LAUNCH'], null,
    ['BLOCK 1', 'OPEN', 1], ['WHO CAN BUY', 'EVERYONE'],
  ];
  const r = d.rc, n = r.others.length;
  return [
    ['COIN', d.t ? '$' + d.t : short(r.mint, 4)], ['NAME', (d.n || '').toUpperCase().slice(0, 22) || '—'], ['VENUE', 'RAYDIUM'], ['SLOT', r.slot.toLocaleString('en-US')], null,
    ['BLOCK 0', (r.dev.pct > 0 ? 1 : 0) + n + ((r.dev.pct > 0 ? 1 : 0) + n === 1 ? ' BUY' : ' BUYS')], ['BUYER', r.dev.pct > 0 ? 'THE CREATOR' : '—'], ['SIZE', r.dev.pct > 0 ? pct(r.dev.pct) + ' OF SUPPLY' : '—'],
    ['OTHER BUYERS', n ? `${n} · ${pct(r.othersPct)} ✗` : '0 ✓', n ? 2 : 1], null,
    ['BLOCK 1', 'OPEN', 1], ['WHO CAN BUY', 'EVERYONE'],
  ];
}
const foot = d => !d.live ? (d.sol ? 'BLOCK 0 OPENS WITH YOU.' : 'BLOCK 0 STARTS EMPTY.') : (d.rc.others.length || d.rc.dev.again) ? `BLOCK 0 HELD ${d.rc.others.length + (d.rc.dev.pct > 0 ? 1 : 0)} BUYS.` : d.rc.dev.pct > 0 ? 'BLOCK 0 HELD ONE BUY.' : 'BLOCK 0 HELD NO BUY.';
export function paperHTML(d) {
  return `<span class="spec${d.live ? ' live' : ''}">${d.live ? 'ON CHAIN' : 'DRAFT'}</span><div class="c big">KAIRO</div><div class="c">LAUNCH RECEIPT</div><hr>`
    + rows(d).map(r => r ? `<div class="row"><span>${esc(r[0])}</span><span${r[2] === 1 ? ' class="ok"' : r[2] === 2 ? ' class="no"' : ''}>${esc(r[1])}</span></div>` : '<hr>').join('')
    + `<hr><div class="c">${esc(foot(d))}</div><div class="bars"></div>`;
}
async function receiptPng(d) {
  try { await document.fonts.load('700 20px Silk'); } catch { /* falls back to monospace */ }
  const S = 2, W = 380, list = rows(d), H = 250 + list.length * 21, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; const c = cv.getContext('2d'); c.scale(S, S);
  c.fillStyle = '#0d0f0d'; c.fillRect(0, 0, W, H);
  const x0 = 20, w = W - 40; c.fillStyle = '#f4efe0'; c.fillRect(x0, 16, w, H - 44);
  for (let x = x0; x < x0 + w; x += 10) { c.beginPath(); c.moveTo(x, H - 28); c.lineTo(x + 5, H - 20); c.lineTo(x + 10, H - 28); c.fill(); }
  c.fillStyle = '#1a1c18'; let y = 62; const L = 36, R = x0 + w - 16;
  const ctr = (t, sz) => { c.font = `700 ${sz}px Silk, monospace`; c.textAlign = 'center'; c.fillStyle = '#1a1c18'; c.fillText(t, W / 2, y); };
  const row = r => { c.font = '700 13px Silk, monospace'; c.textAlign = 'left'; c.fillStyle = '#1a1c18'; c.fillText(r[0], L, y); c.textAlign = 'right'; c.fillStyle = r[2] === 1 ? '#3f7a10' : r[2] === 2 ? '#b0281c' : '#1a1c18'; c.fillText(r[1], R, y); y += 21; };
  const hr = () => { y -= 6; c.strokeStyle = '#b9b4a3'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); c.setLineDash([]); y += 24; };
  ctr('KAIRO', 26); y += 22; ctr('LAUNCH RECEIPT', 13); y += 22; hr();
  list.forEach(r => (r ? row(r) : hr())); hr();
  ctr(foot(d), 13); y += 18;
  const bars = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2]; let bx = L; c.fillStyle = '#1a1c18';
  while (bx < R - 4) { for (const b of bars) { if (bx >= R - 4) break; c.fillRect(bx, y, b, 46); bx += b + 2; } }
  c.save(); c.translate(R - 40, 52); c.rotate(0.14); const col = d.live ? '#3f7a10' : '#c0392b'; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2; c.globalAlpha = 0.85;
  c.strokeRect(-44, -16, 88, 24); c.font = '700 11px Silk, monospace'; c.textAlign = 'center'; c.fillText(d.live ? 'ON CHAIN' : 'DRAFT', 0, 1); c.restore();
  cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kairo-receipt${d.t ? '-' + d.t.toLowerCase() : ''}.png`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }, 'image/png');
}
const reprint = p => { p.classList.remove('reprint'); void p.offsetWidth; p.classList.add('reprint'); };

// ---------- the launch form ----------
export function mountLaunch() {
  const f = $('#lform'); if (!f) return;
  const name = $('#lName'), tick = $('#lTick'), desc = $('#lDesc'), buy = $('#lBuy'), xh = $('#lX'), tg = $('#lTg'), web = $('#lWeb'), file = $('#lImg'), go = $('#lGo'), paper = $('#pPaper'), st = $('#lStatus'), flow = $('#lFlow');
  let img = null, imgUrl = null, curve = null, busy = false, live = null;
  const T = () => tick.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const N = () => name.value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  const SOL = () => Math.round(+buy.value * 100) / 100;
  const quote = sol => { if (!sol || !curve) return null; const inn = sol * 1e9 * (1 - curve.fee), out = curve.a - curve.a * curve.b / (curve.b + inn); return { tokens: out / 1e6, pct: out / curve.supply * 100 }; };
  const draft = () => ({ live: false, t: T(), n: N(), sol: SOL(), q: quote(SOL()) });

  function paint() {
    const t = T(), n = N(), d = desc.value.trim(), sol = SOL(), q = quote(sol);
    $('#lBuyV').textContent = sol ? `${sol} SOL${q ? ' · ≈ ' + pct(q.pct) : ''}` : 'NO BUY';
    $('#cTick').textContent = t ? '$' + t : '$TICKER';
    $('#cName').textContent = n || 'Your coin';
    $('#cDesc').textContent = d || 'Your description shows here.';
    $('#cBuy').textContent = sol ? (q ? '≈ ' + pct(q.pct) : sol + ' SOL') : 'NO BUY';
    $('#cPic').innerHTML = img ? `<img src="${img}" alt="">` : `<span>${esc((t || 'K').slice(0, 1))}</span>`;
    if (!live) paper.innerHTML = paperHTML(draft());
    $('#lCost').innerHTML = sol
      ? `You spend about <b>${(sol + 0.025).toFixed(3)} SOL</b>: your ${sol} SOL buy plus about 0.025 SOL for the coin's accounts and network fees. Kairo takes nothing.`
      : `You spend about <b>0.025 SOL</b> for the coin's accounts and network fees, and make no buy. Kairo takes nothing.`;
    go.innerHTML = wallet.address ? `Launch ${t ? '$' + esc(t) : 'your coin'} <span class="ar">→</span>` : 'Connect a wallet to launch <span class="ar">→</span>';
    $('#lPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(live
      ? `$${live.t} is live on Kairo.\n\nBlock 0: ${live.rc.others.length ? `my buy and ${live.rc.others.length} other wallet${live.rc.others.length === 1 ? '' : 's'}, all on the receipt.` : `my buy, inside the create. Nobody else.`}\nFrom block 1, it's everyone's.\n\n${SITE}/app#r=${live.rc.sig}`
      : `${t ? '$' + t + ' is' : 'My coin is'} launching on Kairo.\n\nMy buy goes inside the transaction that creates the coin, so block 0 opens with me${sol ? ` (${sol} SOL)` : ''}.\nFrom block 1, it's everyone's.`);
    store.set('kairo:draft', { name: name.value, tick: tick.value, desc: desc.value, buy: buy.value, x: xh.value, tg: tg.value, web: web.value, img, imgUrl });
  }
  // a saved draft comes back
  const d0 = store.get('kairo:draft', null);
  if (d0) { name.value = d0.name || ''; tick.value = d0.tick || ''; desc.value = d0.desc || ''; buy.value = d0.buy != null && +d0.buy <= 5 ? d0.buy : 0.5; xh.value = d0.x || ''; tg.value = d0.tg || ''; web.value = d0.web || ''; img = d0.img || null; imgUrl = d0.imgUrl || null; }
  [name, tick, desc, buy, xh, tg, web].forEach(i => i.addEventListener('input', paint));
  [name, tick, buy].forEach(i => i.addEventListener('change', () => !live && reprint(paper)));
  wallet.on(s => { const b = $('#wBtn'); if (b) { b.classList.toggle('on', !!s.address); b.innerHTML = s.address ? `<i></i>${esc(short(s.address, 4))}` : 'Connect wallet'; } paint(); });
  $('#wBtn') && $('#wBtn').addEventListener('click', () => wallet.open());
  api('config').then(j => { curve = { a: +j.a, b: +j.b, supply: +j.supply, fee: (+j.tradeFee + +j.platformFee) / (+j.feeDenominator || 1e6) }; paint(); }).catch(() => { });

  // the image: cropped square in the browser
  const drop = $('#lDrop');
  const take = fl => {
    if (!fl || !/^image\//.test(fl.type)) { toast('Pick an image file'); return; }
    const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
      const s = Math.min(im.width, im.height), cv = document.createElement('canvas'), c = cv.getContext('2d'); cv.width = cv.height = 512;
      c.fillStyle = '#0d0f0d'; c.fillRect(0, 0, 512, 512); c.imageSmoothingQuality = 'high';
      c.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 512, 512);
      img = cv.toDataURL('image/jpeg', 0.9); imgUrl = null; paint(); !live && reprint(paper);
    }; im.onerror = () => toast("That image didn't open"); im.src = r.result; }; r.readAsDataURL(fl);
  };
  file.addEventListener('change', () => take(file.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));

  // ---------- the launch ----------
  const say = (html, err) => { st.className = 'lstatus' + (err ? ' err' : ''); st.innerHTML = html; st.hidden = false; };
  const step = (k, state, note) => {
    const li = flow.querySelector(`[data-k="${k}"]`); if (!li) return;
    li.className = state; const n = li.querySelector('small'); if (n) n.innerHTML = note || '';
  };
  const lock = on => { busy = on; [name, tick, desc, buy, xh, tg, web, file].forEach(i => (i.disabled = on)); go.disabled = on; f.classList.toggle('busy', on); };
  async function land(sig, b64, lastValid) {
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < 100000) {
      await sleep(1200); n++;
      let s = null; try { s = await api('status', null, `&sig=${sig}&h=${lastValid}`); } catch { continue; }
      if (s.state === 'confirmed') return s.slot;
      if (s.state === 'failed') throw new Error('The launch landed but failed on chain, so no coin was made. Solana kept only the network fee. ' + (s.err || ''));
      if (s.state === 'expired') { const e = new Error('Solana did not take the launch in time, so nothing happened and nothing was spent. Launch again.'); e.code = 'expired'; throw e; }
      if (n % 3 === 0) api('send', { tx: b64 }).catch(() => { });   // keep it in front of the network until it lands
    }
    throw new Error(`No answer from Solana yet. It may still land: check <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">the transaction ↗</a> before you try again.`);
  }
  async function readReceipt(sig) {
    for (let i = 0; i < 6; i++) { try { return await api('receipt', null, `&sig=${sig}`); } catch (e) { if (e.code !== 'pending' && i > 1) throw e; } await sleep(2000); }
    throw new Error('Solana has not shown block 0 yet. Open the receipt again in a minute.');
  }
  async function launch() {
    if (busy) return;
    const miss = !N() ? 'Give your coin a name.' : !T() ? 'Give your coin a ticker.' : !img ? 'Add an image.' : null;
    if (miss) { say(esc(miss), true); return; }
    if (!wallet.address) { wallet.open(); return; }
    lock(true); flow.hidden = false; st.hidden = true;
    flow.querySelectorAll('li').forEach(li => { li.className = ''; const n = li.querySelector('small'); if (n) n.textContent = ''; });
    flow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const t = T(), n = N(), sol = SOL();
    try {
      step('img', 'run');
      if (!imgUrl) imgUrl = (await api('img', { data: img })).url;
      step('img', 'ok'); paint();

      step('build', 'run', 'Building the launch and trying it against Solana…');
      const seed = ed.utils.randomPrivateKey(), pub = await ed.getPublicKeyAsync(seed), mint = b58(pub);
      const r = await api('build', { wallet: wallet.address, mint, name: n, symbol: t, desc: desc.value.trim(), image: imgUrl, x: xh.value.trim(), telegram: tg.value.trim(), website: web.value.trim(), buySol: sol });
      step('build', 'ok', sol ? `${fmtTok(r.tokens)} $${esc(t)} (${pct(r.pct)} of supply) for ${r.buySol} SOL${r.cost ? ` · about ${r.cost.toFixed(3)} SOL in all` : ''}` : 'No buy: block 0 holds the create alone.');

      step('sign', 'run', 'Approve the launch in your wallet.');
      let signed;
      try { signed = await wallet.signTx(fromB64(r.tx)); }
      catch (e) { throw new Error(/reject|cancel|denied|declin/i.test(e && e.message || '') ? 'You cancelled in your wallet. Nothing was sent.' : (e && e.message) || 'The wallet did not sign.'); }
      const full = await signAsMint(signed, pub, seed), b64 = toB64(full);
      step('sign', 'ok');

      step('send', 'run');
      const { sig } = await api('send', { tx: b64 });
      step('send', 'ok', `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${esc(short(sig, 6))} ↗</a>`);
      const mine = store.get('kairo:mine', []); mine.unshift({ mint: r.mint, sig, t, n, at: Date.now() }); store.set('kairo:mine', mine.slice(0, 40));

      step('land', 'run', 'Waiting for Solana…');
      const slot = await land(sig, b64, r.lastValid);
      step('land', 'ok', `Block ${slot.toLocaleString('en-US')}`);

      step('read', 'run', 'Reading block 0 back from the chain…');
      const rc = await readReceipt(sig);
      step('read', 'ok', rc.clean ? 'Block 0 held your buy alone.' : `${rc.others.length} other wallet${rc.others.length === 1 ? '' : 's'} bought in block 0. They're on the receipt.`);
      live = { t, n, rc, mint: r.mint, image: imgUrl };
      showLive();
    } catch (e) {
      const li = flow.querySelector('li.run'); if (li) li.className = 'bad';
      say((e && e.message) || String(e), true);
    }
    lock(false); paint();
  }
  function showLive() {
    const rc = live.rc;
    paper.innerHTML = paperHTML({ live: true, t: live.t, n: live.n, rc }); reprint(paper);
    const box = $('#lDone'), url = `${SITE}/app#r=${rc.sig}`;
    box.innerHTML = `<b>$${esc(live.t)} is live on Raydium.</b><p>${rc.clean ? 'Block 0 held your buy and nothing else.' : `Block 0 held your buy and ${rc.others.length} other wallet${rc.others.length === 1 ? '' : 's'}. The receipt names ${rc.others.length === 1 ? 'it' : 'them'}.`}</p>
      <button class="ca" type="button" id="lMint"><span>COIN</span><code>${esc(rc.mint)}</code><em>COPY</em></button>
      <div class="prow"><a class="btn g" href="${esc(rc.links.raydium)}" target="_blank" rel="noopener">Trade on Raydium ↗</a><a class="btn o" href="${esc(rc.links.tx)}" target="_blank" rel="noopener">Solscan ↗</a><a class="btn o" href="#scan=${esc(rc.mint)}">Full block 0 scan</a><button class="btn o" type="button" id="lLink">Copy receipt link</button><button class="btn o" type="button" id="lAgain">Launch another</button></div>`;
    box.hidden = false;
    $('#lMint').onclick = () => copy(rc.mint, 'Coin address copied');
    $('#lLink').onclick = () => copy(url, 'Receipt link copied');
    $('#lAgain').onclick = () => { live = null; box.hidden = true; flow.hidden = true; st.hidden = true; [name, tick, desc, xh, tg, web].forEach(i => (i.value = '')); buy.value = 0.5; img = null; imgUrl = null; paint(); reprint(paper); scrollTo({ top: 0, behavior: 'smooth' }); };
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  f.addEventListener('submit', e => { e.preventDefault(); launch(); });
  $('#lReset').addEventListener('click', () => { if (busy) return; [name, tick, desc, xh, tg, web].forEach(i => (i.value = '')); buy.value = 0.5; img = null; imgUrl = null; st.hidden = true; paint(); reprint(paper); });
  $('#lPng').addEventListener('click', () => receiptPng(live ? { live: true, t: live.t, n: live.n, rc: live.rc } : draft()));
  paint();
}

// ---------- the coins launched through Kairo ----------
export function mountCoins() {
  const box = $('#coinList'), view = $('#rView'); if (!box) return { load() { }, open() { } };
  let timer = 0, last = 0;
  const chip = c => !c.block0 ? '<span class="cb0">BLOCK 0 · READING</span>' : c.block0.clean ? '<span class="cb0 ok">BLOCK 0 · ONE BUY ✓</span>' : `<span class="cb0 x">BLOCK 0 · +${c.block0.others} OTHER${c.block0.others === 1 ? '' : 'S'} ✗</span>`;
  const curve = c => c.status != null && c.status >= 2 ? '<span class="ccurve done"><i style="width:100%"></i><em>ON RAYDIUM</em></span>' : c.curve != null ? `<span class="ccurve"><i style="width:${Math.max(2, c.curve).toFixed(1)}%"></i><em>${c.curve < 10 ? c.curve.toFixed(1) : Math.round(c.curve)}% TO RAYDIUM</em></span>` : '<span class="ccurve"><i></i><em>—</em></span>';
  async function load() {
    if (Date.now() - last < 8000) return; last = Date.now();
    try {
      const j = await api('list');
      if (!j.coins.length) { box.innerHTML = `<div class="cempty"><b>No coins yet.</b><span>The first coin launched on Kairo shows up here, with the receipt of its block 0.</span><a class="btn g" href="#launch">Launch the first one <span class="ar">→</span></a></div>`; return; }
      box.innerHTML = j.coins.map(c => `<a class="crow" href="#r=${esc(c.sig)}"><span class="cimg">${c.image && /^https:\/\//.test(c.image) ? `<img src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i>${esc((c.symbol || 'K').slice(0, 1))}</i>`}</span><span class="cname"><b>${esc(c.symbol ? '$' + c.symbol : short(c.mint, 4))}</b><i>${esc(c.name || '')}</i></span><span class="cdev">DEV BUY <b>${c.dev ? pct(c.dev) : '—'}</b></span>${chip(c)}${curve(c)}<span class="cage">${esc(ago(c.time))}</span></a>`).join('');
    } catch (e) { box.innerHTML = `<div class="cempty"><b>The chain did not answer.</b><span>${esc(e.message || '')}</span><button class="btn o" type="button" id="cRetry">Try again</button></div>`; const b = $('#cRetry'); b && (b.onclick = () => { last = 0; load(); }); }
  }
  async function open(sig) {
    view.hidden = false; view.innerHTML = '<div class="rc-load">Reading block 0 from Solana…</div>';
    try {
      const rc = await api('receipt', null, `&sig=${sig}`);
      let t = '', n = '';
      try { const j = await api('list'); const c = j.coins.find(x => x.sig === sig); if (c) { t = c.symbol || ''; n = c.name || ''; } } catch { /* names are optional */ }
      const d = { live: true, t, n, rc };
      view.innerHTML = `<div class="rcpt"><div class="printer big"><div class="slot"></div><div class="paper vis">${paperHTML(d)}</div></div>
        <div class="rc-side"><span class="tagl">${rc.kairo ? 'Launched on Kairo' : 'A Raydium LaunchLab launch'}</span><h3>${esc(t ? '$' + t : short(rc.mint, 6))}</h3>
        <p>${rc.clean ? "Block 0 held the creator's buy and nothing else." : rc.others.length ? `Block 0 held the creator's buy and ${rc.others.length} other wallet${rc.others.length === 1 ? '' : 's'}:` : 'Block 0 held no buy from the creator.'}</p>
        ${rc.others.length ? `<div class="wl">${rc.others.slice(0, 12).map(o => `<div><span>${esc(short(o.owner, 6))}${o.paidByDev ? ' · paid by the dev' : ''}</span><span class="x">${pct(o.pct)}</span></div>`).join('')}</div>` : ''}
        <p class="rc-meta">Block ${rc.slot.toLocaleString('en-US')} · ${rc.time ? new Date(rc.time * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : ''}${rc.partial ? ' · read in part' : ''}</p>
        <div class="prow"><a class="btn g" href="${esc(rc.links.raydium)}" target="_blank" rel="noopener">Trade on Raydium ↗</a><a class="btn o" href="${esc(rc.links.tx)}" target="_blank" rel="noopener">The launch on Solscan ↗</a><a class="btn o" href="#scan=${esc(rc.mint)}">Full block 0 scan</a><button class="btn o" type="button" id="rPng">Save receipt</button></div></div></div>`;
      $('#rPng').onclick = () => receiptPng(d);
    } catch (e) { view.innerHTML = `<div class="rc-load err">${esc(e.message || String(e))}</div>`; }
  }
  return {
    load() { load(); clearInterval(timer); timer = setInterval(() => { if (!box.closest('[hidden]') && !document.hidden) load(); }, 30000); },
    open(sig) { open(sig); load(); },
    close() { view.hidden = true; view.innerHTML = ''; },
  };
}
