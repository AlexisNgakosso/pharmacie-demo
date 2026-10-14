// Menu de test (version de démonstration uniquement) : passer d'une page à l'autre
// et repartir des données de départ. Ce fichier n'existe pas dans le vrai site.
(function () {
  var pages = [['site.html', 'Site'], ['admin.html', 'Admin'], ['compte.html', 'Compte']];
  var ici = (location.pathname.split('/').pop() || '').toLowerCase();
  var nav = document.createElement('div');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Menu de test');
  nav.style.cssText = 'position:fixed;left:calc(10px + env(safe-area-inset-left, 0px));bottom:calc(10px + env(safe-area-inset-bottom, 0px));z-index:5000;display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:#12321F;box-shadow:0 6px 20px rgba(0,0,0,0.25);font:600 12px/1 Manrope,system-ui,sans-serif';

  function lien(href, texte, actif) {
    var a = document.createElement('a');
    a.href = href; a.textContent = texte;
    a.style.cssText = 'padding:8px 11px;border-radius:999px;text-decoration:none;color:' + (actif ? '#12321F' : '#E6F4EC') + ';background:' + (actif ? '#9FE0BC' : 'transparent');
    return a;
  }
  var tag = document.createElement('span');
  tag.textContent = 'TEST';
  tag.style.cssText = 'padding:0 6px 0 8px;color:#9FE0BC;letter-spacing:0.08em;font-size:10px';
  nav.appendChild(tag);
  pages.forEach(function (p) { nav.appendChild(lien(p[0], p[1], ici === p[0])); });

  var reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Remettre à zéro';
  reset.style.cssText = 'padding:8px 11px;border:0;border-radius:999px;background:transparent;color:#F3C6C0;font:inherit;cursor:pointer';
  var attente = null;
  reset.addEventListener('click', function () {
    if (!attente) {
      reset.textContent = 'Confirmer ?';
      reset.style.background = '#B4402F'; reset.style.color = '#fff';
      attente = setTimeout(function () { attente = null; reset.textContent = 'Remettre à zéro'; reset.style.background = 'transparent'; reset.style.color = '#F3C6C0'; }, 4000);
      return;
    }
    clearTimeout(attente);
    try {
      Object.keys(localStorage).forEach(function (k) { if (/^pharma/.test(k)) localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (e) {}
    location.reload();
  });
  nav.appendChild(reset);
  document.body.appendChild(nav);
})();
