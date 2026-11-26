// runs before the page paints: the hero holds its buttons and floats back for a moment so they can rise in with the name
(function () {
  try {
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm) { document.documentElement.classList.add('hold'); setTimeout(function () { document.documentElement.classList.remove('hold'); }, 4000); }
  } catch (e) { }
})();
