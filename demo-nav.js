// Menu de test (version de démonstration uniquement) : passer d'une page à l'autre,
// repartir des données de départ, et masquer le menu. Ce fichier n'existe pas dans le vrai site.
(function () {
  var CLE = 'pharma-demo-menu';
  var pages = [['site.html', 'Site'], ['admin.html', 'Admin'], ['compte.html', 'Compte']];
  var ici = (location.pathname.split('/').pop() || '').toLowerCase();

  function lireMasque() { try { return localStorage.getItem(CLE) === 'masque'; } catch (e) { return false; } }
  function ecrireMasque(v) { try { if (v) localStorage.setItem(CLE, 'masque'); else localStorage.removeItem(CLE); } catch (e) {} }

  var base = 'position:fixed;left:calc(10px + env(safe-area-inset-left, 0px));bottom:calc(10px + env(safe-area-inset-bottom, 0px));z-index:5000;font:600 12px/1 Manrope,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.25);';

  // Barre complète
  var nav = document.createElement('div');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Menu de test');
  nav.style.cssText = base + 'display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:#12321F';

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
      Object.keys(localStorage).forEach(function (k) { if (/^pharma/.test(k) && k !== CLE) localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (e) {}
    location.reload();
  });
  nav.appendChild(reset);

  var masquer = document.createElement('button');
  masquer.type = 'button';
  masquer.setAttribute('aria-label', 'Masquer le menu de test');
  masquer.title = 'Masquer';
  masquer.textContent = '×';
  masquer.style.cssText = 'width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,0.12);color:#E6F4EC;font:600 18px/1 system-ui,sans-serif;cursor:pointer;margin-left:2px';
  nav.appendChild(masquer);

  // Pastille affichée quand le menu est masqué : un toucher le fait réapparaître
  var pastille = document.createElement('button');
  pastille.type = 'button';
  pastille.setAttribute('aria-label', 'Afficher le menu de test');
  pastille.textContent = 'T';
  pastille.style.cssText = base + 'width:34px;height:34px;border:0;border-radius:50%;background:#12321F;color:#9FE0BC;font-size:13px;cursor:pointer;opacity:0.75';

  function appliquer(masque) {
    nav.style.display = masque ? 'none' : 'flex';
    pastille.style.display = masque ? 'block' : 'none';
  }
  masquer.addEventListener('click', function () { ecrireMasque(true); appliquer(true); });
  pastille.addEventListener('click', function () { ecrireMasque(false); appliquer(false); });

  document.body.appendChild(nav);
  document.body.appendChild(pastille);
  appliquer(lireMasque());
})();
