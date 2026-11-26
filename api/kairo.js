// KAIRO API. No keys, no database, nothing signed here. Two jobs:
//   GET /api/config        the site's public settings (contract address and X link once they exist)
//   GET /api/scan?mint=…   the block 0 scan: read any Solana launch from the chain and replay it through Kairo's rules
//
// Kairo's rules, as the scan applies them:
//   1. block 0 is one buy: the creator's. The creator's buys in the launch block pass.
//   2. nothing else lands in block 0. Every other wallet that bought in the launch block would have been turned away.
//   3. from block 1, anyone can buy. The first minute after block 0 is read for context and passes untouched.
//   bundles (one signer buying for several wallets, or one wallet funding several early buyers) are flagged wherever they sit.
const crypto = require('node:crypto');

// a private RPC first when one is set (RPC_URL in Vercel's settings), then two free public ones: a refusal or a rate limit on one moves the call to the next
const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
const PUBLIC = !process.env.RPC_URL;            // the free RPCs rate-limit hard: go slower and retry longer
const { AsyncLocalStorage } = require('node:async_hooks');
const CLOCK = new AsyncLocalStorage(), HARD = 54000;   // every scan carries its own hard stop, well inside the function's 60 s
const until = () => { const c = CLOCK.getStore(); return c ? c.end - Date.now() : Infinity; };
const PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const MPL = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const TXOPT = { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1, commitment: 'confirmed' };   // v1 transactions are live on mainnet
const EARLY_CAP = 160, FUNDER_CAP = 24, BUDGET = 48000;
// exchange hot wallets: many strangers withdrawing from one exchange is not a bundle
const EXCHANGES = new Set([
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm', '5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD', 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5', 'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ', 'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
  'A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR',
]);
const isAddr = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
// the launchpads and pools we can name; anything else is just "Solana"
const VENUES = {
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pump.fun', 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'PumpSwap',
  'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab', '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium', 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium',
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN': 'Meteora', 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora', 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'Meteora',
  'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG': 'Moonshot', 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- base58 and program addresses (no dependencies) ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58dec(s) {
  let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad address'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.push(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c === '1') out.push(0); else break; }
  return Buffer.from(out.reverse());
}
function b58enc(b) {
  let n = 0n; for (const x of b) n = n * 256n + BigInt(x);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x === 0) s = '1' + s; else break; }
  return s;
}
const FP = 2n ** 255n - 19n;
const fmod = a => { const r = a % FP; return r >= 0n ? r : r + FP; };
function fpow(b, e) { let r = 1n; b = fmod(b); while (e > 0n) { if (e & 1n) r = r * b % FP; b = b * b % FP; e >>= 1n; } return r; }
const ED_D = fmod(-121665n * fpow(121666n, FP - 2n));
function onCurve(bytes) {                    // is this 32-byte string a valid ed25519 point? (a PDA must not be)
  let y = 0n; for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
  y &= (1n << 255n) - 1n;
  const y2 = y * y % FP, u = fmod(y2 - 1n), v = fmod(ED_D * y2 + 1n);
  const x2 = u * fpow(v, FP - 2n) % FP;
  return x2 === 0n || fpow(x2, (FP - 1n) / 2n) === 1n;
}
const pdaMemo = new Map();
function isPda(a) {                          // owned by a program address: a pool, curve or vault, never a person's wallet
  if (!pdaMemo.has(a)) { let v = false; try { const b = b58dec(a); v = b.length === 32 && !onCurve(b); } catch { v = false; } pdaMemo.set(a, v); }
  return pdaMemo.get(a);
}
function venueOf(tx) {
  if (!tx) return null;
  const ids = [];
  for (const ix of (tx.transaction && tx.transaction.message.instructions) || []) ids.push(ix.programId);
  for (const g of (tx.meta && tx.meta.innerInstructions) || []) for (const ix of g.instructions) ids.push(ix.programId);
  for (const id of ids) if (VENUES[id]) return VENUES[id];
  return null;
}
function pda(seeds, program) {
  const pid = b58dec(program);
  for (let bump = 255; bump >= 0; bump--) {
    const h = crypto.createHash('sha256');
    for (const s of seeds) h.update(s);
    h.update(Buffer.from([bump])); h.update(pid); h.update(Buffer.from('ProgramDerivedAddress'));
    const k = h.digest(); if (!onCurve(k)) return b58enc(k);
  }
  throw new Error('no program address');
}

// ---------- RPC: falls through to the next endpoint on refusals, backs off on rate limits ----------
async function post(url, payload) {
  const ms = Math.max(1500, Math.min(15000, until() - 500));
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(ms) });
  if (r.status === 429) throw Object.assign(new Error('rate limited'), { again: true });
  if (r.status === 401 || r.status === 403 || r.status >= 500) throw Object.assign(new Error('rpc ' + r.status), { next: true });
  return r.json();
}
const LIMITED = /rate|too many|429/i, REFUSED = /forbidden|token|not allowed|disabled|unauthori|not available|upgrade|api key/i;
const newer = m => { const v = /transaction version \((\d+)\) is not supported/i.exec(m); return v ? +v[1] : null; };
async function rpc(method, params) {
  let last, empty = false; const dead = new Set();
  for (let round = 0; round < (PUBLIC ? 6 : 4); round++) {
    let limited = false;
    for (const u of RPCS) {
      if (dead.has(u)) continue;
      if (until() < 1500) throw last || new Error('Solana did not answer in time');
      try {
        const j = await post(u, { jsonrpc: '2.0', id: 1, method, params });
        if (!j.error) { if (j.result == null && method === 'getTransaction') { empty = true; dead.add(u); continue; } return j.result; }   // a pruned RPC may not have it: ask the next one
        const m = String(j.error.message || ''), v = newer(m);
        if (v != null && params[1] && v > (params[1].maxSupportedTransactionVersion || 0)) {   // a newer transaction format: ask for it and go again
          TXOPT.maxSupportedTransactionVersion = Math.max(TXOPT.maxSupportedTransactionVersion, v);
          params = [params[0], { ...params[1], maxSupportedTransactionVersion: v }]; last = new Error(m); limited = true; continue;
        }
        if (LIMITED.test(m)) { last = new Error(m); limited = true; continue; }        // rate limited here: try the next RPC now
        if (REFUSED.test(m)) { last = new Error(m); dead.add(u); continue; }           // this RPC will not serve the call: skip it
        throw Object.assign(new Error(m || 'rpc error'), { final: true });
      } catch (e) {
        if (e.final) throw e;
        last = e;
        if (e.again) { limited = true; continue; }
        dead.add(u);                                                                 // refused, down or timed out: next RPC
      }
    }
    if (!limited || dead.size === RPCS.length) break;
    const wait = (PUBLIC ? 700 : 400) * (round + 1);   // every RPC rate-limited us: back off, but never past this scan's hard stop
    if (until() - wait < 1500) break;
    await sleep(wait);
  }
  if (empty) return null;
  throw last || new Error('Solana did not answer');
}
async function pmap(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
const noBatch = new Set();                            // RPCs that do not take JSON-RPC batches
async function many(method, list) {                  // JSON-RPC batches spread over the RPCs, then single calls for whatever is left
  const out = new Array(list.length).fill(null);
  const B = PUBLIC ? 10 : 20, starts = []; for (let i = 0; i < list.length; i += B) starts.push(i);
  await pmap(starts, PUBLIC ? 1 : 3, async s => {
    if (until() < 4000) return;                       // out of time: leave the rest unread (the scan says so)
    const part = list.slice(s, s + B);
    let todo = part.map((_, k) => k);
    for (let round = 0; round < (PUBLIC ? 4 : 3) && todo.length && until() > 5000; round++) {
      let limited = false;
      for (const u of RPCS) {
        if (noBatch.has(u) || !todo.length || until() < 5000) continue;
        let j;
        try { j = await post(u, todo.map(k => ({ jsonrpc: '2.0', id: k, method, params: part[k] }))); }
        catch (e) { if (e.again) limited = true; continue; }
        if (!Array.isArray(j)) { if (LIMITED.test(String(j && j.error && j.error.message || ''))) limited = true; else noBatch.add(u); continue; }
        for (const it of j) {
          if (!it) continue;
          if (it.result != null && !it.error) { out[s + it.id] = it.result; todo = todo.filter(k => k !== it.id); }
          else if (it.result === null && !it.error && method !== 'getTransaction') todo = todo.filter(k => k !== it.id);
          else if (LIMITED.test(String(it.error && it.error.message || ''))) limited = true;
          else { const v = newer(String(it.error && it.error.message || '')); if (v != null) TXOPT.maxSupportedTransactionVersion = Math.max(TXOPT.maxSupportedTransactionVersion, v); }
        }
      }
      if (!limited) break;                            // what is still missing is not a rate limit: try it one by one
      await sleep((PUBLIC ? 900 : 500) * (round + 1));
    }
    await pmap(todo, PUBLIC ? 2 : 3, async k => { try { out[s + k] = await rpc(method, part[k]); } catch { out[s + k] = null; } });
  });
  return out;
}

// ---------- reading transactions ----------
const keyOf = k => (typeof k === 'string' ? k : k && k.pubkey);
function deltas(tx, mint, skip = () => false) {      // owner → change in raw token amount of this mint
  const pre = new Map(), post = new Map(), out = new Map();
  for (const b of (tx.meta && tx.meta.preTokenBalances) || []) if (b.mint === mint) pre.set(b.accountIndex, b);
  for (const b of (tx.meta && tx.meta.postTokenBalances) || []) if (b.mint === mint) post.set(b.accountIndex, b);
  for (const idx of new Set([...pre.keys(), ...post.keys()])) {
    const a = pre.get(idx), b = post.get(idx), owner = (b && b.owner) || (a && a.owner);
    if (!owner || skip(owner)) continue;
    const d = BigInt((b && b.uiTokenAmount.amount) || '0') - BigInt((a && a.uiTokenAmount.amount) || '0');
    if (d !== 0n) out.set(owner, (out.get(owner) || 0n) + d);
  }
  return out;
}
function solIn(tx, wallet) {                         // SOL that arrived at a wallet in this transaction, by sender
  const ixs = [...((tx.transaction && tx.transaction.message.instructions) || [])];
  for (const inner of (tx.meta && tx.meta.innerInstructions) || []) ixs.push(...inner.instructions);
  const res = [];
  for (const ix of ixs) {
    if (ix.program !== 'system' || !ix.parsed) continue;
    const { type, info } = ix.parsed;
    if ((type === 'transfer' || type === 'transferWithSeed') && info.destination === wallet) res.push({ from: info.source, lamports: Number(info.lamports) });
    if ((type === 'createAccount' || type === 'createAccountWithSeed') && info.newAccount === wallet) res.push({ from: info.source, lamports: Number(info.lamports) });
  }
  return res.filter(x => x.from !== wallet && x.lamports >= 1e7);
}
const clean = s => (s ? String(s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40) : null);

async function metadata(mint, info) {
  let name = null, symbol = null, uri = null;
  const ext = (info.extensions || []).find(e => e.extension === 'tokenMetadata');
  if (ext && ext.state) ({ name, symbol, uri } = ext.state);
  if (!name) {
    try {
      const r = await rpc('getAccountInfo', [pda([Buffer.from('metadata'), b58dec(MPL), b58dec(mint)], MPL), { encoding: 'base64' }]);
      if (r && r.value) {
        const b = Buffer.from(r.value.data[0], 'base64'); let o = 65;
        const str = () => { const n = b.readUInt32LE(o); o += 4; const s = b.subarray(o, o + n).toString('utf8').replace(/\0+$/, ''); o += n; return s.trim(); };
        name = str(); symbol = str(); uri = str();
      }
    } catch { /* no metadata */ }
  }
  let image = null;
  if (uri && /^https:\/\//.test(uri)) {
    try {
      const r = await fetch(uri, { signal: AbortSignal.timeout(2500) }); const j = await r.json();
      if (j && typeof j.image === 'string' && /^https:\/\//.test(j.image)) image = j.image.slice(0, 300);
    } catch { /* image is optional */ }
  }
  return { name: clean(name), symbol: clean(symbol), image };
}

async function history(mint, left) {                // every signature for the mint, oldest first, or null if out of reach
  if (/helius/i.test(process.env.RPC_URL || '')) {   // Helius can read history oldest-first in one call
    try {
      const r = await rpc('getTransactionsForAddress', [mint, { transactionDetails: 'signatures', sortOrder: 'asc', limit: 1000 }]);
      const list = Array.isArray(r) ? r : r && Array.isArray(r.data) ? r.data : null;
      if (list && list.length && list[0].signature && list[0].slot != null) return { sigs: list, complete: true, pages: 1 };
    } catch { /* fall back to paging */ }
  }
  const max = process.env.RPC_URL ? 120 : 30;
  const all = []; let before;
  for (let p = 0; p < max; p++) {
    if (left() < 20000) return { sigs: null, seen: all.length };
    const page = (await rpc('getSignaturesForAddress', [mint, { limit: 1000, before, commitment: 'confirmed' }])) || [];
    all.push(...page);
    if (page.length < 1000) return { sigs: all.reverse(), complete: true, pages: p + 1 };
    before = page[page.length - 1].signature;
  }
  return { sigs: null, seen: all.length };
}

async function funding(cands, buyTx, left) {         // who sent each early wallet its SOL just before it bought
  const res = new Map(), fresh = new Map();
  for (const w of cands) {
    const tx = buyTx.get(w.first.sig), t = tx ? solIn(tx, w.owner) : [];
    if (t.length) res.set(w.owner, t.sort((a, b) => b.lamports - a.lamports)[0].from);
  }
  const need = cands.filter(w => !res.has(w.owner));
  if (!need.length || left() < 14000) return { res, fresh, partial: need.length > 0 };
  const lists = await many('getSignaturesForAddress', need.map(w => [w.owner, { before: w.first.sig, limit: 4, commitment: 'confirmed' }]));
  const want = [];
  need.forEach((w, i) => { const l = (lists[i] || []).filter(s => !s.err); fresh.set(w.owner, l.length < 4); l.forEach(s => want.push([w, s.signature])); });
  if (left() < 10000) return { res, fresh, partial: true };
  const txs = await many('getTransaction', want.map(([, s]) => [s, TXOPT]));
  want.forEach(([w], i) => {                          // newest first, so the first hit is the latest funding
    if (res.has(w.owner) || !txs[i]) return;
    const t = solIn(txs[i], w.owner); if (t.length) res.set(w.owner, t.sort((a, b) => b.lamports - a.lamports)[0].from);
  });
  return { res, fresh, partial: false };
}


// ---------- the scan ----------
function scan(mint) { return CLOCK.run({ end: Date.now() + HARD }, () => scanOnce(mint)); }
async function scanOnce(mint) {
  const T0 = Date.now(), left = () => BUDGET - (Date.now() - T0);
  const mi = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const acc = mi && mi.value;
  if (!acc) return { ok: false, code: 'missing', error: 'Nothing lives at that address. Check the contract address and try again.' };
  const prog = acc.owner, parsed = acc.data && acc.data.parsed;
  if ((prog !== TOKEN && prog !== TOKEN22) || !parsed || parsed.type !== 'mint') return { ok: false, code: 'notmint', error: 'That address is not a coin. Paste the contract address (the mint), not a wallet.' };
  const info = parsed.info, supply = BigInt(info.supply);
  if (supply <= 0n) return { ok: false, code: 'nosupply', error: 'That coin has no supply.' };
  // a pump.fun coin carries its creator on its bonding curve; every other launch is found from its history
  const bc = pda([Buffer.from('bonding-curve'), b58dec(mint)], PUMP);
  const [bci, meta] = await Promise.all([rpc('getAccountInfo', [bc, { encoding: 'base64', commitment: 'confirmed' }]), metadata(mint, info)]);
  const isPump = !!(bci && bci.value);
  let graduated = false, creator = null;
  if (isPump) {
    const bcd = Buffer.from(bci.value.data[0], 'base64');
    graduated = bcd.length > 48 && bcd[48] === 1;
    creator = bcd.length >= 81 ? b58enc(bcd.subarray(49, 81)) : null;
    if (creator === '11111111111111111111111111111111') creator = null;
  }

  const h = await history(mint, left);
  if (!h.sigs) return { ok: false, code: 'deep', error: `This coin has more than ${h.seen.toLocaleString('en-US')} transactions, too many to walk back to its launch in time. Older, busier coins need a faster RPC; the docs explain.`, meta };
  const sigs = h.sigs.filter(s => !s.err);
  if (!sigs.length) return { ok: false, code: 'empty', error: 'No transactions yet for this coin.', meta };
  // trading opens the first time tokens land in a pool or curve; anything before that is a pre-launch allocation
  let li = 0, head = [];
  if (!isPump) {
    head = await many('getTransaction', sigs.slice(0, 12).map(s => [s.signature, TXOPT]));
    const k = head.findIndex(tx => tx && !(tx.meta && tx.meta.err) && [...deltas(tx, mint)].some(([o, d]) => d > 0n && isPda(o)));
    li = k >= 0 ? k : 0;
    if (head[0]) creator = keyOf(head[0].transaction.message.accountKeys[0]);
  }
  const pre = new Map();
  for (let k = 0; k < li; k++) { const tx = head[k]; if (!tx || (tx.meta && tx.meta.err)) continue; for (const [o, d] of deltas(tx, mint, isPda)) pre.set(o, (pre.get(o) || 0n) + d); }
  const slot0 = sigs[li].slot, t0 = sigs[li].blockTime;
  const WINDOW = 60;                                                          // block 0, then the first minute after it
  const early = sigs.slice(li).filter(s => s.slot === slot0 || (s.blockTime != null && t0 != null && s.blockTime - t0 < WINDOW));
  const read = early.slice(0, EARLY_CAP);
  const txs = await many('getTransaction', read.map(s => [s.signature, TXOPT]));
  const loaded = txs.filter(Boolean).length, whole = loaded === early.length;   // a verdict only covers what was actually read
  if (!loaded) return { ok: false, code: 'slow', error: "Solana didn't send this launch's transactions in time, so there is nothing to judge yet. Try again in a minute.", meta };
  if (!creator && txs[0]) creator = keyOf(txs[0].transaction.message.accountKeys[0]);
  const venue = isPump ? 'pump.fun' : venueOf(txs[0]) || venueOf(head[li]) || 'Solana';
  const P = raw => Number((raw * 1000000n) / supply) / 10000;

  const events = [], buyTx = new Map();
  txs.forEach((tx, i) => {
    if (!tx || (tx.meta && tx.meta.err)) return;
    const payer = keyOf(tx.transaction.message.accountKeys[0]);
    for (const [owner, raw] of deltas(tx, mint, isPda)) {
      events.push({ i, sig: read[i].signature, slot: tx.slot, t: (tx.blockTime != null ? tx.blockTime : t0) - t0, payer, owner, raw });
      if (raw > 0n && !buyTx.has(read[i].signature)) buyTx.set(read[i].signature, tx);
    }
  });
  events.sort((a, b) => a.slot - b.slot || a.i - b.i);

  // every wallet that bought before the opening, the creator aside
  const per = new Map();
  for (const e of events) {
    if (e.raw <= 0n || e.owner === creator) continue;
    const w = per.get(e.owner) || { owner: e.owner, buys: 0, raw: 0n, raw0: 0n, first: e };
    w.buys++; w.raw += e.raw; if (e.slot === slot0) w.raw0 += e.raw; per.set(e.owner, w);
  }
  // bundles: one signer buying for several wallets, or one wallet funding several early buyers just before they bought
  const clusters = [], inCluster = new Map(), byPayer = new Map();
  for (const e of events) if (e.raw > 0n && e.owner !== creator && e.payer !== e.owner) { const s = byPayer.get(e.payer) || new Set(); s.add(e.owner); byPayer.set(e.payer, s); }
  for (const [via, set] of byPayer) if (set.size >= 2) { clusters.push({ kind: via === creator ? 'dev' : 'payer', via, wallets: [...set] }); set.forEach(o => inCluster.set(o, clusters.length - 1)); }
  const b0first = w => (w.first.slot === slot0 ? 0 : 1);
  const cands = [...per.values()].sort((a, b) => b0first(a) - b0first(b) || a.first.i - b.first.i).slice(0, FUNDER_CAP);
  const fu = await funding(cands, buyTx, left);
  const byFunder = new Map();
  for (const [owner, f] of fu.res) { if (!f || EXCHANGES.has(f)) continue; const l = byFunder.get(f) || []; l.push(owner); byFunder.set(f, l); }
  for (const [via, ws] of byFunder) {
    if (via === creator || ws.length >= 2) {
      clusters.push({ kind: via === creator ? 'dev' : 'funder', via, wallets: ws });
      ws.forEach(o => { if (!inCluster.has(o)) inCluster.set(o, clusters.length - 1); });
    }
  }

  // replay the launch through Kairo's rules
  let devRaw = (pre.get(creator) || 0n), refusedRaw = 0n, heldRaw = 0n, refused = 0, held = 0;
  const timeline = [], before = [], heldWallets = new Set();
  for (const e of events) {
    let action = 'pass';
    if (e.owner === creator) {
      if (e.slot === slot0) { devRaw += e.raw; if (e.raw > 0n) action = 'dev'; }      // what the creator holds once block 0 closes
      else if (e.raw > 0n) { action = 'pass'; }                                     // after block 0 the creator buys like anyone
    } else if (e.raw > 0n) {
      if (e.slot === slot0) { action = 'refuse'; refused++; refusedRaw += e.raw; }
      else { held++; heldRaw += e.raw; heldWallets.add(e.owner); if (before.length < 400) before.push({ t: e.t, owner: e.owner, pct: P(e.raw) }); }
    }
    if (e.owner === creator && e.raw < 0n && e.sig === read[0].signature) continue;   // the dev seeding a pool is the launch, not a trade
    if (timeline.length < 200) timeline.push({ t: e.t, slot: e.slot - slot0, owner: e.owner, side: e.raw > 0n ? 'buy' : 'sell', pct: P(e.raw < 0n ? -e.raw : e.raw), action, bundle: inCluster.has(e.owner), sig: e.sig });
  }
  if (devRaw < 0n) devRaw = 0n;
  const prelaunch = [...pre].filter(([o, v]) => o !== creator && v > 0n).map(([owner, v]) => ({ owner, pct: P(v) }));
  const others = [...per.values()].filter(w => w.raw0 > 0n).map(w => ({ owner: w.owner, pct: P(w.raw0), bundle: inCluster.has(w.owner), sniper: !inCluster.has(w.owner), payer: w.first.payer }));
  const buyers = [{ owner: creator, pct: P(devRaw), dev: true }, ...others.sort((a, b) => b.pct - a.pct)];
  const bundled = new Set([...inCluster.keys()]);

  const verdict = others.length || prelaunch.length ? 'blocked' : whole ? 'clean' : 'unsure';
  const n = others.length, s = x => (x === 1 ? '' : 's');
  const headline = n
    ? `${n} wallet${s(n)} bought in block 0 besides the dev. Kairo would have turned ${n === 1 ? 'it' : n === 2 ? 'both' : 'all ' + n} away.`
    : prelaunch.length ? `${prelaunch.length} wallet${s(prelaunch.length)} got the coin before trading opened. On Kairo, block 0 is the creator's buy and nothing else.`
    : whole ? "Block 0 held the dev's buy and nothing else. This launch already plays by Kairo's rules."
    : `Clean so far: nothing besides the dev in the ${loaded} of ${early.length} early transactions read.`;
  return {
    ok: true, mint, name: meta.name, symbol: meta.symbol, image: meta.image, creator, graduated, venue,
    program: prog === TOKEN22 ? 'token-2022' : 'token', supply: supply.toString(), decimals: info.decimals,
    launch: { slot: slot0, time: t0, sig: sigs[li].signature, afterMint: li },
    verdict, headline,
    block0: { buyers, devPct: P(devRaw), otherPct: P(refusedRaw), refused },
    prelaunch,
    bundles: clusters.map(c => ({ kind: c.kind, funder: c.via, wallets: c.wallets, pct: P(c.wallets.reduce((a, o) => a + ((per.get(o) || {}).raw || 0n), 0n)) })),
    after: { window: WINDOW, count: held, wallets: heldWallets.size, pct: P(heldRaw), buys: before },
    totals: { block0Others: n, bundled: bundled.size, held, heldWallets: heldWallets.size },
    timeline,
    read: { early: early.length, read: loaded, partial: !whole || fu.partial, rpc: process.env.RPC_URL ? 'custom' : 'public', ms: Date.now() - T0 },
  };
}

function out(res, code, obj, cache) {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', cache || 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = (u.searchParams.get('__p') || '').replace(/\/+$/, '');
  try {
    if (p === 'config') return out(res, 200, { ok: true, ca: process.env.KAIRO_CA || null, x: process.env.KAIRO_X || null, rpc: process.env.RPC_URL ? 'custom' : 'public' }, 's-maxage=60');
    if (p === 'scan') {
      const mint = (u.searchParams.get('mint') || '').trim();
      if (!isAddr(mint)) return out(res, 400, { ok: false, code: 'bad', error: 'That does not look like a Solana address.' });
      const r = await scan(mint);
      if (!r.ok) return out(res, 200, r, r.code === 'missing' || r.code === 'notmint' ? 's-maxage=300' : 'no-store');
      const age = Date.now() / 1000 - (r.launch.time || 0);
      return out(res, 200, r, `s-maxage=${age > 86400 && !r.read.partial ? 3600 : 120}, stale-while-revalidate=600`);
    }
    return out(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    return out(res, 502, { ok: false, code: 'rpc', error: 'Solana did not answer in time. Try again in a moment.', detail: String(e.message || e).slice(0, 160) });
  }
};
module.exports._t = { b58enc, b58dec, pda, onCurve, deltas, solIn, scan, PUMP, TOKEN, TOKEN22, ATA, MPL };
