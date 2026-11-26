// Wallets, through the Wallet Standard: Phantom, Solflare, Backpack and the rest register themselves here.
// Kairo asks a wallet for one thing: to sign the launch you built. Nothing else, and never your recovery phrase.
import { $, esc, short, store, toast } from './util.js';

const CHAIN = 'solana:mainnet';
const W = { list: [], w: null, acct: null, subs: new Set(), tried: new Set() };
const state = () => ({ address: W.acct ? W.acct.address : null, name: W.w ? W.w.name : null, icon: W.w ? W.w.icon : null });
const emit = () => W.subs.forEach(f => { try { f(state()); } catch { /* a listener failing must not stop the rest */ } });

function usable(w) {
  try {
    const f = (w && w.features) || {}, st = f['solana:signTransaction'];
    if (!st || !f['standard:connect'] || !(w.chains || []).some(c => String(c).startsWith('solana:'))) return false;
    const v = st.supportedTransactionVersions; return !v || [...v].includes(0);
  } catch { return false; }
}
function add(w) {
  if (!usable(w) || W.list.some(x => x.name === w.name)) return;
  W.list.push(w);
  // the wallet used last time comes back without a prompt when it allows that
  if (!W.w && store.get('kairo:wallet', null) === w.name && !W.tried.has(w.name)) {
    W.tried.add(w.name);
    const acct = w.accounts && w.accounts[0];
    if (acct) use(w, acct);
    else w.features['standard:connect'].connect({ silent: true }).then(r => { const a = (r && r.accounts && r.accounts[0]) || (w.accounts && w.accounts[0]); if (a && !W.w) use(w, a); }).catch(() => { });
  }
  if (isOpen()) render();
}


function use(w, acct) {
  W.w = w; W.acct = acct; store.set('kairo:wallet', w.name);
  try {
    if (!w.__kairo && w.features['standard:events']) {
      w.__kairo = true;
      w.features['standard:events'].on('change', ({ accounts }) => { if (W.w !== w || !accounts) return; if (accounts.length) { W.acct = accounts[0]; emit(); } else disconnect(); });
    }
  } catch { }
  emit();
}
function disconnect() {
  const w = W.w; W.w = null; W.acct = null; store.set('kairo:wallet', null);
  try { w && w.features['standard:disconnect'] && w.features['standard:disconnect'].disconnect(); } catch { }
  emit();
}
async function connect(w) {
  const r = await w.features['standard:connect'].connect();
  const acct = (r && r.accounts && r.accounts[0]) || (w.accounts && w.accounts[0]);
  if (!acct) throw new Error('The wallet shared no account.');
  use(w, acct); return acct.address;
}

// sign one transaction (bytes in, bytes out); the wallet shows it first
async function signTx(bytes) {
  if (!W.w || !W.acct) throw new Error('Connect a wallet first.');
  const [r] = await W.w.features['solana:signTransaction'].signTransaction({ account: W.acct, chain: CHAIN, transaction: bytes });
  if (!r || !r.signedTransaction) throw new Error('The wallet did not return a signed transaction.');
  return new Uint8Array(r.signedTransaction);
}

// ---------- the picker ----------
const mob = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isOpen = () => { const m = $('#wModal'); return m && !m.hidden; };
function render() {
  const box = $('#wList'); if (!box) return;
  if (W.w) {
    box.innerHTML = `<div class="wcur">${W.w.icon ? `<img src="${esc(W.w.icon)}" alt="">` : '<i></i>'}<div><b>${esc(W.w.name)}</b><code>${esc(W.acct.address)}</code></div></div><button class="wopt out" type="button" id="wOut"><span>Disconnect</span></button>`;
    $('#wOut').onclick = () => { disconnect(); close(); toast('Disconnected'); };
    return;
  }
  if (!W.list.length) {
    const here = encodeURIComponent(location.href), ref = encodeURIComponent(location.origin);
    box.innerHTML = mob()
      ? `<p class="wnone">Open Kairo inside your wallet's browser to launch from your phone.</p><a class="wopt" href="https://phantom.app/ul/browse/${here}?ref=${ref}"><span>Open in Phantom</span><em>→</em></a><a class="wopt" href="https://solflare.com/ul/v1/browse/${here}?ref=${ref}"><span>Open in Solflare</span><em>→</em></a>`
      : `<p class="wnone">No Solana wallet in this browser yet.</p><a class="wopt" href="https://phantom.com/download" target="_blank" rel="noopener"><span>Get Phantom</span><em>↗</em></a><a class="wopt" href="https://solflare.com/download" target="_blank" rel="noopener"><span>Get Solflare</span><em>↗</em></a><a class="wopt" href="https://backpack.app/downloads" target="_blank" rel="noopener"><span>Get Backpack</span><em>↗</em></a>`;
    return;
  }
  box.innerHTML = W.list.map((w, i) => `<button class="wopt" type="button" data-i="${i}">${w.icon ? `<img src="${esc(w.icon)}" alt="">` : '<i></i>'}<span>${esc(w.name)}</span><em>Connect →</em></button>`).join('');
  box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', async () => {
    const w = W.list[+b.dataset.i]; b.disabled = true;
    try { const a = await connect(w); close(); toast('Connected ' + short(a)); }
    catch (e) { toast((e && e.message ? e.message : 'Connection cancelled').slice(0, 90)); }
    b.disabled = false;
  }));
}
let back = null;
function open() { const m = $('#wModal'); if (!m) return; render(); back = document.activeElement; m.hidden = false; requestAnimationFrame(() => m.classList.add('on')); const f = m.querySelector('.wopt, .wx'); f && f.focus(); }
function close() { const m = $('#wModal'); if (!m || m.hidden) return; m.classList.remove('on'); m.hidden = true; back && back.focus && back.focus(); }
addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) close(); });
addEventListener('click', e => { const m = $('#wModal'); if (!m || m.hidden) return; if (e.target === m || e.target.closest('#wClose')) close(); });

export const wallet = {
  open, close, signTx, disconnect,
  on(fn) { W.subs.add(fn); fn(state()); return () => W.subs.delete(fn); },
  get address() { return W.acct ? W.acct.address : null; },
  get name() { return W.w ? W.w.name : null; },
};

// listen last: a wallet can register the moment the app says it's ready
const api = Object.freeze({ register: (...ws) => { ws.forEach(add); return () => { }; } });
addEventListener('wallet-standard:register-wallet', e => { try { e.detail(api); } catch { } });
try { dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })); } catch { }
