// The intro, once per visit and wordless: five start lights come on one by one, hold, and go out together.
// Lights out is the start for everyone at once. Any key, click, wheel or touch skips it.
const html = document.documentElement;
export function playIntro() {
  return new Promise(done => {
    const box = document.getElementById('intro');
    if (!html.classList.contains('intro') || !box) { box && box.remove(); return done(); }
    box.classList.add('kr-on');
    const cv = document.getElementById('introCv'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
    let fin = false, t0 = 0, raf = 0;
    const ON = [0.35, 0.77, 1.19, 1.61, 2.03], OUT = 2.5;
    const finish = () => {
      if (fin) return; fin = true; cancelAnimationFrame(raf); off();
      try { sessionStorage.setItem('kairo:intro', '1'); } catch { }
      html.classList.remove('intro'); box.classList.add('kr-out'); setTimeout(() => box.remove(), 480); done();
    };
    const off = () => ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(e => removeEventListener(e, finish, true));
    ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(e => addEventListener(e, finish, { capture: true, passive: true }));
    setTimeout(finish, 6000);
    function lamp(cx, cy, R, lit) {
      const p = R / 5.2;
      c.fillStyle = lit ? '#ff4433' : 'rgba(255,68,51,0.09)';
      if (lit) { c.shadowColor = '#ff4433'; c.shadowBlur = 34; }
      c.beginPath();
      for (let y = -R; y <= R; y += p) for (let x = -R; x <= R; x += p) if (x * x + y * y <= R * R * 0.92) { c.moveTo(cx + x + p * 0.36, cy + y); c.arc(cx + x, cy + y, p * 0.36, 0, 6.2832); }
      c.fill(); c.shadowBlur = 0;
    }
    function frame(now) {
      if (!t0) t0 = now; const t = (now - t0) / 1000;
      c.clearRect(0, 0, W, H);
      const uw = 250, gap = (W - uw * 5) / 6;
      for (let i = 0; i < 5; i++) {
        const x = gap + i * (uw + gap), lit = t >= ON[i] && t < OUT;
        c.fillStyle = '#121512'; c.strokeStyle = '#262b25'; c.lineWidth = 3;
        c.beginPath(); c.roundRect(x, 40, uw, 440, 34); c.fill(); c.stroke();
        lamp(x + uw / 2, 160, 78, lit); lamp(x + uw / 2, 360, 78, lit);
      }
      if (t >= OUT + 0.08) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
