// Applique le thème mémorisé avant l'affichage, pour éviter un flash de couleur.
(function () {
  try {
    var t = localStorage.getItem('gamelia-theme');
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
