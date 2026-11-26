// The app: the live openings board, the block 0 scanner, the simulator and the receipt printer, one tab at a time.
import { $, $$ } from './util.js';
import { shell } from './shell.js';
import { toOpen, mmss, onMoment } from './clock.js';
import { led } from './led.js';
import { mountSim } from './sim.js';
import { mountScan } from './scan.js';
import { mountLive } from './live.js';
import { mountPrinter } from './printer.js';

shell();
const board = led($('#appLed'), { text: 'NEXT ' + mmss(toOpen()), glow: 10 });
let openUntil = 0;
document.addEventListener('kairo:second', e => { if (performance.now() > openUntil) board.set('NEXT ' + mmss(e.detail.left)); });
onMoment(() => { openUntil = performance.now() + 2400; board.set(' OPEN NOW '); board.flicker(800); });

const sim = mountSim();
const form = $('#scanForm'), input = $('#scanIn');
mountScan({ form, input, out: $('#scanOut'), err: $('#scanErr'), paste: $('#scanPaste'), hash: false, full: true });
mountPrinter();
mountLive({ board: $('#board'), empty: $('#bEmpty'), st: $('#feedSt'), retry: $('#feedRetry'),
  out: { born: $('#stBorn'), held: $('#stHeld'), b0: $('#stB0'), opened: $('#stOpened') } });

const panels = $$('[data-panel]');
function show(name) {
  if (!panels.some(p => p.dataset.panel === name)) name = 'live';
  panels.forEach(p => (p.hidden = p.dataset.panel !== name));
  $$('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
  $$('#nav a[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
  if (name === 'sim' && sim) sim.autoplay();
}
let lastScan = '';
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = /^scan=([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(h);
  if (m) { show('scan'); if (m[1] !== lastScan) { lastScan = m[1]; input.value = m[1]; scrollTo({ top: 0, behavior: 'smooth' }); form.requestSubmit(); } return; }
  show(h === 'launch' ? 'print' : h);
}
addEventListener('hashchange', route);
$$('.tab').forEach(t => t.addEventListener('click', () => { history.replaceState(null, '', '#' + t.dataset.tab); route(); }));
form.addEventListener('submit', () => { lastScan = input.value.trim(); });
route();
