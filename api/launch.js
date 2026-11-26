// KAIRO launches, on Raydium LaunchLab.
// One transaction creates the coin and makes the creator's buy, so the coin is born with that buy inside it: block 0 opens with the creator.
// This server builds that transaction unsigned and stores the coin's image and metadata as write-once public files. It never holds a key:
// the wallet signs as payer and creator, and the browser signs for the new mint (that key is made in the browser and never leaves it).
//   GET  ?a=config                      the curve, for the live preview of the creator's buy
//   POST ?a=img     {data}              store the coin's image (a data URL)           -> { url }
//   POST ?a=build   {wallet, mint, name, symbol, desc, image, x, telegram, website, buySol, dry}
//   POST ?a=send    {tx}                broadcast a signed Kairo launch               -> { sig }
//   GET  ?a=status&sig=&h=              pending | confirmed | failed | expired
//   GET  ?a=receipt&sig=                block 0 of a launch, read from the chain
//   GET  ?a=list                        every coin launched through Kairo, read from the chain
'use strict';
const { Connection, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = require('@solana/web3.js');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');
const crypto = require('node:crypto');

// a private RPC first when one is set (RPC_URL), then two free public ones; a refusal or a rate limit moves the call to the next
const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function rpcFetch(url, opts) {
  let last = null;
  for (let round = 0; round < 2; round++) {
    for (const u of RPCS) {
      try { const r = await fetch(u, { ...opts, signal: AbortSignal.timeout(12000) }); if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = r; continue; } return r; }
      catch (e) { last = e; }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  if (last instanceof Error) throw last; return last;
}
const conn = new Connection(RPCS[0], { commitment: 'confirmed', fetch: rpcFetch, disableRetryOnRateLimit: true });
async function rawRpc(url, method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`rpc ${r.status}`); return r.json();
}

const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const PROGRAM = R.LAUNCHPAD_PROGRAM, AUTH = R.getPdaLaunchpadAuth(PROGRAM).publicKey;
const CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
// Raydium's own LaunchLab platform, unless a Kairo platform config is set later
const PLATFORM = new PublicKey(process.env.KAIRO_PLATFORM || R.LAUNCHPAD_PLATFORM.toBase58());
// every Kairo launch sends 0 SOL to this address inside its own transaction, so the list of Kairo coins can be read from the chain
const TAG = new PublicKey(process.env.KAIRO_TAG || '99ri7DDXuQZbdz7VWi73i1cGzUpWs2QL49K93JFApLTG');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MPL = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const LUT = new PublicKey('AcL1Vo8oy1ULiavEcjSUcwfBSForXMudcZvDZy5nzJkU');   // Raydium's public address lookup table: keeps one transaction small enough
const SUPPLY = new BN('1000000000000000'), SELL = new BN('793100000000000'), RAISE = 85, DEC = 6;   // 1B supply, 793.1M sold on the curve, 85 SOL to graduate
const MAX_BUY = 5, CU_PRICE = +process.env.KAIRO_CU_PRICE || 500000, PFX = 'kairo/', SITE = 'https://kairo-five-iota.vercel.app';
const P58 = PROGRAM.toBase58(), TAG58 = TAG.toBase58(), AUTH58 = AUTH.toBase58(), WSOL58 = WSOL.toBase58();

// ---------- small helpers ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) { let n = 0n; for (const x of bytes) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of bytes) { if (x === 0) s = '1' + s; else break; } return s; }
const isSig = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(s);
const out = (res, code, b, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(b)); };
const body = req => new Promise(ok => {
  if (req.body) { try { return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); } catch { return ok({}); } }
  let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } });
});
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'That is not a Solana address.'); } };
function link(s, re, what) {
  s = clean(s, 200); if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\/[^\s<>"']+$/.test(s) || (re && !re.test(s))) throw new Error(`The ${what} must be a link${re ? ' to ' + what : ''}.`);
  return s;
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 24);
const pctOf = raw => Number(raw * 1000000n / BigInt(SUPPLY.toString())) / 10000;   // share of the 1B supply, in %

// ---------- storage: the coin's image and metadata, write-once ----------
const blob = () => require('@vercel/blob');
async function putFile(path, data, type) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Launches are switched off for a moment: storage is not connected yet.');
  try { return (await blob().put(PFX + path, data, { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: type, cacheControlMaxAge: 31536000 })).url; }
  catch (e) { if (/exist/i.test(e.message || '')) { const h = await blob().head(PFX + path).catch(() => null); if (h) return h.url; } throw e; }
}
async function img(req) {
  const b = await body(req);
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
  if (!m) throw new Error('Pick a png, jpg, webp or gif image.');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 800000) throw new Error('That image is too big (800 KB at most).');
  if (buf.length < 100) throw new Error('That image is empty.');
  return { ok: true, url: await putFile(`img/${sha(buf)}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`, buf, m[1]) };
}

// ---------- LaunchLab state ----------
let cfgCache = null, platCache = null, lutCache = null;
async function cfg() {
  if (cfgCache && Date.now() - cfgCache.t < 300000) return cfgCache.v;
  const a = await conn.getAccountInfo(CONFIG); if (!a) throw new Error('Raydium LaunchLab did not answer. Try again in a moment.');
  const v = R.LaunchpadConfig.decode(a.data); cfgCache = { t: Date.now(), v }; return v;
}
async function platform() {
  if (platCache && Date.now() - platCache.t < 300000) return platCache.v;
  const a = await conn.getAccountInfo(PLATFORM); if (!a) throw new Error('Raydium LaunchLab did not answer. Try again in a moment.');
  const v = R.PlatformConfig.decode(a.data); platCache = { t: Date.now(), v }; return v;
}
async function lookup() {
  if (lutCache && Date.now() - lutCache.t < 600000) return lutCache.v;
  const r = await conn.getAddressLookupTable(LUT).catch(() => null), v = (r && r.value) || null;
  if (v) lutCache = { t: Date.now(), v }; return v;
}
const sdk = owner => R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' });

// the curve's starting point, so the page can show what a buy gets before anything is built
async function config() {
  const [c, p] = await Promise.all([cfg(), platform()]);
  const init = R.Curve.getCurve(c.curveType).getInitParam({ supply: SUPPLY, totalFundRaising: new BN(RAISE * 1e9), totalSell: SELL, totalLockedAmount: new BN(0), migrateFee: c.migrateFee });
  return {
    ok: true, venue: 'Raydium LaunchLab', a: init.a.toString(), b: init.b.toString(), supply: SUPPLY.toString(), decimals: DEC, raiseSol: RAISE,
    tradeFee: c.tradeFeeRate.toString(), platformFee: p.feeRate.toString(), feeDenominator: '1000000', maxBuy: MAX_BUY,
    tag: TAG58, platform: PLATFORM.toBase58(), storage: !!process.env.BLOB_READ_WRITE_TOKEN,
  };
}

// ---------- build: one transaction, create + the creator's buy ----------
async function build(req) {
  const b = await body(req);
  const wallet = pk(b.wallet, 'Connect a wallet first.');
  const mint = pk(b.mint, 'The new coin address is missing. Reload the page and try again.');
  if (!PublicKey.isOnCurve(mint.toBytes())) throw new Error('The new coin address is not a key. Reload the page and try again.');
  const name = clean(b.name, 32).replace(/[<>]/g, ''), symbol = clean(b.symbol, 10).toUpperCase().replace(/^\$/, ''), desc = clean(b.desc, 500);
  if (!name) throw new Error('Give your coin a name.');
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new Error('The ticker can use letters and numbers, up to 10.');
  const dry = !!b.dry;
  const image = dry && !b.image ? SITE + '/img/og.jpg' : link(b.image, null, 'image');
  if (!image) throw new Error('Add an image.');
  const website = link(b.website, null, 'website'), x = link(b.x, /^https:\/\/(www\.)?(x|twitter)\.com\//i, 'X'), telegram = link(b.telegram, /^https:\/\/(www\.)?t\.me\//i, 'Telegram');
  const buySol = Math.round(Math.max(0, +b.buySol || 0) * 1000) / 1000;
  if (!(buySol <= MAX_BUY)) throw new Error(`Your buy can be up to ${MAX_BUY} SOL.`);

  const bal = await conn.getBalance(wallet).catch(() => null);
  const need = buySol + 0.03;
  if (!dry && bal != null && bal < need * 1e9) throw new Error(`Your wallet needs about ${need.toFixed(3)} SOL for this launch: your buy plus about 0.03 SOL for the coin's accounts and fees. It holds ${(bal / 1e9).toFixed(3)} SOL.`);

  // the metadata every wallet, explorer and Raydium reads, stored write-once
  const meta = {
    name, symbol, description: desc || `${name} ($${symbol}). Launched on Kairo: the creator's buy is inside the transaction that made the coin.`,
    image, showName: true, createdOn: SITE,
    ...(x && { twitter: x }), ...(telegram && { telegram }), ...(website && { website }),
  };
  const js = JSON.stringify(meta);
  const uri = dry ? SITE + '/m/dry-run' : await putFile(`meta/${sha(js)}.json`, js, 'application/json');
  if (uri.length > 200) throw new Error('The metadata link is too long.');

  const [c, raydium, lut, { blockhash, lastValidBlockHeight }] = await Promise.all([cfg(), sdk(wallet), lookup(), conn.getLatestBlockhash('confirmed')]);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId: PROGRAM, mintA: mint, decimals: DEC, name, symbol, uri, migrateType: 'cpmm', configId: CONFIG, configInfo: c, mintBDecimals: 9, platformId: PLATFORM,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0,
    supply: SUPPLY, totalSellA: SELL, totalFundRaisingB: new BN(RAISE * 1e9), totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    feePayer: wallet,
  });
  // every instruction the SDK made, create and buy together, in one transaction
  const CB = ComputeBudgetProgram.programId;
  const ixs = transactions.flatMap(t => t.instructions).filter(ix => !ix.programId.equals(CB));
  const tag = [new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from('kairo:' + mint.toBase58()) }), SystemProgram.transfer({ fromPubkey: wallet, toPubkey: TAG, lamports: 0 })];
  const compile = (units, memo) => new VersionedTransaction(new TransactionMessage({
    payerKey: wallet, recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE }), ...ixs, ...(memo ? tag : tag.slice(1))],
  }).compileToV0Message(lut ? [lut] : []));
  let memo = true, tx = compile(600000, true);
  if (tx.serialize().length > 1232) { memo = false; tx = compile(600000, false); }
  const size = tx.serialize().length;
  if (size > 1232) throw new Error(`This launch does not fit in one transaction (${size} bytes). Try a shorter name or ticker.`);
  // the signers must be exactly the wallet and the new mint
  const signers = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures).map(k => k.toBase58());
  if (signers.length !== 2 || signers[0] !== wallet.toBase58() || signers[1] !== mint.toBase58()) throw new Error('The launch was built with unexpected signers: ' + signers.join(', '));

  // run it once against mainnet before anyone signs
  const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [wallet.toBase58()] } });
  const logs = (sim.value.logs || []).slice(-14);
  if (sim.value.err) {
    const all = (sim.value.logs || []).join('\n'), e = JSON.stringify(sim.value.err);
    if (/insufficient lamports|insufficient funds|0x1\b|InsufficientFunds/i.test(all + e)) throw Object.assign(new Error(`Your wallet does not hold enough SOL for this launch. You need your buy (${buySol} SOL) plus about 0.03 SOL.`), { logs });
    throw Object.assign(new Error('The launch failed when we tried it against Solana, so nothing was sent. ' + (logs.filter(l => /error|failed/i.test(l)).slice(-1)[0] || e).slice(0, 220)), { logs });
  }
  const used = sim.value.unitsConsumed || 300000, units = Math.min(1400000, Math.ceil(used * 1.15) + 20000);
  tx = compile(units, memo);
  const post = sim.value.accounts && sim.value.accounts[0] ? sim.value.accounts[0].lamports : null;
  const cost = bal != null && post != null ? Math.max(0, (bal - post) / 1e9) : null;   // what the wallet spends in all: the buy, the coin's accounts and fees

  const sw = extInfo && extInfo.swapInfo, amountA = sw && sw.amountA && sw.amountA.amount ? BigInt(sw.amountA.amount.toString()) : 0n;
  const pool = (extInfo && extInfo.address && extInfo.address.poolId) ? extInfo.address.poolId.toBase58() : R.getPdaLaunchpadPoolId(PROGRAM, mint, WSOL).publicKey.toBase58();
  return {
    ok: true, tx: Buffer.from(tx.serialize()).toString('base64'), mint: mint.toBase58(), pool, uri, image, meta,
    lastValid: lastValidBlockHeight, units, bytes: tx.serialize().length, memo, buySol,
    tokens: Number(amountA) / 10 ** DEC, pct: pctOf(amountA), cost,
    ...(dry && { dry: true, logs, sdkTxs: transactions.length, used }),
  };
}

// ---------- send: only Kairo launches, to every RPC at once ----------
async function send(req) {
  const b = await body(req);
  const raw = Buffer.from(String(b.tx || ''), 'base64');
  if (raw.length < 200 || raw.length > 1232) throw new Error('That is not a Kairo launch.');
  let tx; try { tx = VersionedTransaction.deserialize(raw); } catch { throw new Error('That is not a Kairo launch.'); }
  const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
  if (!keys.includes(P58) || !keys.includes(TAG58)) throw new Error('Kairo only sends its own launches.');
  if (!tx.signatures.length || tx.signatures.some(s => s.every(x => x === 0))) throw new Error('The launch is missing a signature. Sign it in your wallet and try again.');
  const sig = b58(tx.signatures[0]), b64 = raw.toString('base64');
  const rs = await Promise.allSettled(RPCS.map(u => rawRpc(u, 'sendTransaction', [b64, { encoding: 'base64', skipPreflight: true, maxRetries: 0 }])));
  const good = rs.some(r => r.status === 'fulfilled' && r.value && !r.value.error);
  if (!good) {
    const why = rs.map(r => r.status === 'fulfilled' ? r.value && r.value.error && r.value.error.message : r.reason && r.reason.message).filter(Boolean)[0] || 'no answer';
    if (/blockhash not found/i.test(why)) throw Object.assign(new Error('This launch waited too long to be signed. Build it again.'), { code: 'expired' });
    throw new Error('Solana did not take the launch: ' + why.slice(0, 160));
  }
  return { ok: true, sig };
}

async function status(q) {
  const sig = q.get('sig'); if (!isSig(sig)) throw new Error('bad signature');
  const h = +q.get('h') || 0;
  const r = await conn.getSignatureStatuses([sig], { searchTransactionHistory: false });
  const s = r && r.value && r.value[0];
  if (s) {
    if (s.err) return { ok: true, state: 'failed', slot: s.slot, err: JSON.stringify(s.err).slice(0, 200) };
    if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { ok: true, state: 'confirmed', slot: s.slot };
    return { ok: true, state: 'pending', seen: true, slot: s.slot };
  }
  if (h) { const now = await conn.getBlockHeight('confirmed').catch(() => 0); if (now && now > h) return { ok: true, state: 'expired' }; }
  return { ok: true, state: 'pending' };
}

// ---------- the receipt: who bought in block 0, read from the chain ----------
const rcache = new Map();
function deltas(tx, mint) {
  const d = new Map();
  for (const x of (tx.meta && tx.meta.postTokenBalances) || []) if (x.mint === mint && x.owner) d.set(x.owner, (d.get(x.owner) || 0n) + BigInt(x.uiTokenAmount.amount));
  for (const x of (tx.meta && tx.meta.preTokenBalances) || []) if (x.mint === mint && x.owner) d.set(x.owner, (d.get(x.owner) || 0n) - BigInt(x.uiTokenAmount.amount));
  return d;
}
const mintOf = tx => {
  const l = ((tx.meta && tx.meta.logMessages) || []).map(s => /"kairo:([1-9A-HJ-NP-Za-km-z]{32,44})"/.exec(s)).find(Boolean);
  if (l) return l[1];
  for (const ix of tx.transaction.message.instructions) if (ix.program === 'spl-memo' && typeof ix.parsed === 'string' && /^kairo:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ix.parsed)) return ix.parsed.slice(6);
  return null;
};
async function receipt(sig) {
  if (rcache.has(sig)) return rcache.get(sig);
  const t = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!t) return { ok: false, code: 'pending', error: 'Solana has not shown this launch yet. Give it a few seconds.' };
  if (t.meta && t.meta.err) return { ok: false, code: 'failed', error: 'This launch failed on chain, so no coin was made.' };
  const keys = t.transaction.message.accountKeys.map(k => k.pubkey.toBase58());
  if (!keys.includes(P58)) return { ok: false, code: 'notlaunch', error: 'This is not a Raydium LaunchLab launch.' };
  const creator = keys[0], slot = t.slot, time = t.blockTime || null;
  const mint = mintOf(t) || [...new Set(((t.meta && t.meta.postTokenBalances) || []).map(x => x.mint))].find(m => m !== WSOL58);
  if (!mint) return { ok: false, code: 'notlaunch', error: 'No new coin in this transaction.' };
  const kairo = keys.includes(TAG58);
  const devRaw = (deltas(t, mint).get(creator) || 0n);
  // every other transaction in the same block that touched the coin
  let before, reached = false, same = [];
  for (let page = 0; page < 4 && !reached; page++) {
    const sigs = await conn.getSignaturesForAddress(new PublicKey(mint), { limit: 1000, before }, 'confirmed');
    if (!sigs.length) break;
    for (const s of sigs) { if (s.signature === sig) reached = true; else if (s.slot === slot && !s.err) same.push(s.signature); }
    before = sigs[sigs.length - 1].signature;
    if (sigs[sigs.length - 1].slot < slot) reached = true;
  }
  const others = new Map(); let devAgain = 0n;
  for (let i = 0; i < same.length && i < 60; i += 20) {
    const txs = await conn.getParsedTransactions(same.slice(i, i + 20), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    txs.forEach((tx, k) => {
      if (!tx || !tx.meta || tx.meta.err) return;
      const payer = tx.transaction.message.accountKeys[0].pubkey.toBase58();
      for (const [o, v] of deltas(tx, mint)) {
        if (v <= 0n || o === AUTH58) continue;
        if (o === creator) { devAgain += v; continue; }
        const e = others.get(o) || { owner: o, raw: 0n, sig: same[i + k], payer, paidByDev: payer === creator };
        e.raw += v; others.set(o, e);
      }
    });
  }
  const list = [...others.values()].sort((a, b) => (b.raw > a.raw ? 1 : -1)).map(e => ({ owner: e.owner, pct: pctOf(e.raw), sig: e.sig, paidByDev: e.paidByDev }));
  const r = {
    ok: true, kairo, mint, sig, slot, time, creator,
    dev: { tokens: Number(devRaw) / 10 ** DEC, pct: pctOf(devRaw), again: devAgain > 0n ? pctOf(devAgain) : 0 },
    others: list, othersPct: list.reduce((a, e) => a + e.pct, 0), clean: !list.length && devAgain === 0n, partial: !reached,
    links: { raydium: `https://raydium.io/launchpad/token/?mint=${mint}`, solscan: `https://solscan.io/token/${mint}`, tx: `https://solscan.io/tx/${sig}` },
  };
  if (reached && time && Date.now() / 1000 - time > 90) rcache.set(sig, r);
  return r;
}

// ---------- the list of Kairo coins ----------
let listCache = null;
const metaCache = new Map();
function parseMeta(buf) { let o = 65; const str = () => { const n = buf.readUInt32LE(o); o += 4; const s = buf.subarray(o, o + n).toString('utf8').replace(/\0+$/, '').trim(); o += n; return s; }; return { name: str(), symbol: str(), uri: str() }; }
async function list() {
  if (listCache && Date.now() - listCache.t < 20000) return listCache.v;
  const sigs = (await conn.getSignaturesForAddress(TAG, { limit: 200 })).filter(s => !s.err);
  const coins = [];
  for (let i = 0; i < sigs.length; i += 50) {
    const txs = await conn.getParsedTransactions(sigs.slice(i, i + 50).map(s => s.signature), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }).catch(() => []);
    txs.forEach((t, k) => {
      if (!t || !t.meta || t.meta.err) return;
      const keys = t.transaction.message.accountKeys.map(x => x.pubkey.toBase58());
      const mint = mintOf(t); if (!mint || !keys.includes(P58)) return;
      coins.push({ mint, sig: sigs[i + k].signature, slot: t.slot, time: t.blockTime || null, creator: keys[0], dev: pctOf(deltas(t, mint).get(keys[0]) || 0n) });
    });
  }
  const top = coins.slice(0, 60);
  if (top.length) {
    const mk = c => new PublicKey(c.mint);
    const [metas, pools] = await Promise.all([
      conn.getMultipleAccountsInfo(top.map(c => PublicKey.findProgramAddressSync([Buffer.from('metadata'), MPL.toBuffer(), mk(c).toBuffer()], MPL)[0])).catch(() => []),
      conn.getMultipleAccountsInfo(top.map(c => R.getPdaLaunchpadPoolId(PROGRAM, mk(c), WSOL).publicKey)).catch(() => []),
    ]);
    await Promise.all(top.map(async (c, i) => {
      try { const m = metas[i] && parseMeta(metas[i].data); if (m) { c.name = m.name; c.symbol = m.symbol; c.uri = m.uri; } } catch { }
      try {
        const p = pools[i] && R.LaunchpadPool.decode(pools[i].data);
        if (p) { const raise = Number(p.totalFundRaisingB.toString()); c.curve = raise ? Math.min(100, Number(p.realB.toString()) / raise * 100) : null; c.status = p.status; }
      } catch { }
      if (c.uri && /^https:\/\//.test(c.uri)) {
        if (!metaCache.has(c.uri)) { try { const r = await fetch(c.uri, { signal: AbortSignal.timeout(4000) }); const j = await r.json(); metaCache.set(c.uri, { image: typeof j.image === 'string' ? j.image : null, twitter: j.twitter || null, telegram: j.telegram || null, website: j.website || null }); } catch { metaCache.set(c.uri, {}); } }
        Object.assign(c, metaCache.get(c.uri));
      }
      const rc = rcache.get(c.sig); if (rc) c.block0 = { clean: rc.clean, others: rc.others.length };
    }));
    // read block 0 for a few coins that don't have it yet
    await Promise.all(top.filter(c => !c.block0).slice(0, 6).map(async c => { try { const rc = await receipt(c.sig); if (rc.ok) c.block0 = { clean: rc.clean, others: rc.others.length }; } catch { } }));
  }
  const v = { ok: true, tag: TAG58, count: coins.length, coins: top };
  listCache = { t: Date.now(), v }; return v;
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a');
  try {
    if (a === 'config') return out(res, 200, await config(), 's-maxage=300, stale-while-revalidate=600');
    if (a === 'list') return out(res, 200, await list(), 's-maxage=15, stale-while-revalidate=60');
    if (a === 'status') return out(res, 200, await status(q));
    if (a === 'receipt') {
      const sig = q.get('sig'); if (!isSig(sig)) return out(res, 400, { ok: false, error: 'That is not a transaction signature.' });
      const r = await receipt(sig);
      return out(res, 200, r, r.ok && rcache.has(sig) ? 's-maxage=31536000, immutable' : 'no-store');
    }
    if (req.method === 'POST' && a === 'img') return out(res, 200, await img(req));
    if (req.method === 'POST' && a === 'build') return out(res, 200, await build(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await send(req));
    return out(res, 404, { ok: false, error: 'unknown action' });
  } catch (e) {
    return out(res, 400, { ok: false, code: e.code || 'error', error: e.message || String(e), ...(e.logs && { logs: e.logs }) });
  }
};
module.exports._t = { build, img, list, receipt, config, conn, b58 };
