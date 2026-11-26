// runs before the page paints: the intro plays once per visit, and never holds the page for long
(function () {
  try {
    var seen = sessionStorage.getItem('kairo:intro') === '1';
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm) { document.documentElement.classList.add('hold'); setTimeout(function () { document.documentElement.classList.remove('hold'); }, 9500); }
    if (!seen && !calm && document.documentElement) {
      document.documentElement.classList.add('intro');
      var drop = function (force) { var i = document.getElementById('intro'); if (!force && i && i.classList.contains('kr-on')) return; document.documentElement.classList.remove('intro'); if (i) i.remove(); };
      setTimeout(function () { drop(false); }, 4000);
      setTimeout(function () { drop(true); }, 9000);
    }
  } catch (e) { }
})();
