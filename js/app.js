// The app: launch a coin, scan any coin's block 0, run the simulator. One tab at a time.
import { $, $$ } from './util.js';
import { shell } from './shell.js';
import { mountSim } from './sim.js';
import { mountScan } from './scan.js';
import { mountLaunch } from './launch.js';

shell();
const sim = mountSim();
const form = $('#scanForm'), input = $('#scanIn');
mountScan({ form, input, out: $('#scanOut'), err: $('#scanErr'), paste: $('#scanPaste'), hash: false, full: true });
mountLaunch();

const panels = $$('[data-panel]');
function show(name) {
  if (!panels.some(p => p.dataset.panel === name)) name = 'launch';
  panels.forEach(p => (p.hidden = p.dataset.panel !== name));
  $$('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
  $$('#nav a[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === name && !a.classList.contains('go')));
  if (name === 'sim' && sim) sim.autoplay();
}
let lastScan = '';
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = /^scan=([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(h);
  if (m) { show('scan'); if (m[1] !== lastScan) { lastScan = m[1]; input.value = m[1]; scrollTo({ top: 0, behavior: 'smooth' }); form.requestSubmit(); } return; }
  show({ print: 'launch', live: 'launch' }[h] || h);
  const nav = $('#nav'); nav && nav.classList.remove('open');
}
addEventListener('hashchange', route);
$$('.tab').forEach(t => t.addEventListener('click', () => { history.replaceState(null, '', '#' + t.dataset.tab); route(); }));
form.addEventListener('submit', () => { lastScan = input.value.trim(); });
route();
