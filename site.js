// ════════════════════════════════════════════
// PHARMACIE DÉMO — Site client
// ════════════════════════════════════════════

// ── DONNÉES PARTAGÉES (admin.html / site.html / compte.html) ──
// Deux modes (voir cloud.js) :
//  * base de données (supabase-config.js renseigné) : le catalogue et les réglages sont lus
//    dans la base ; la commande est enregistrée par le serveur, qui relit prix, stock et codes.
//  * local (démonstration) : DATA vient de data.js et reste dans le navigateur.
var MODE_CLOUD = (typeof PharmaCloud !== 'undefined') && PharmaCloud.prevu;
var DATA = MODE_CLOUD ? PharmaCloud.donneesInitiales() : PharmaStore.load();
// Démonstration seulement (sans base) : le menu TEST simule un réseau lent ou coupé (site.html?simu=lent),
// pour voir le squelette et l'animation sans couper son propre réseau. Sans effet avec la base.
var SIMU = (!MODE_CLOUD && (/[?&]simu=(lent|coupe)(&|$)/.exec(location.search) || [])[1]) || '';
var DONNEES_SIMU = null;
if (SIMU) {
  DONNEES_SIMU = DATA;
  DATA = JSON.parse(JSON.stringify(DATA));
  ['categories', 'produits', 'promos', 'conseils', 'joursSpeciaux'].forEach(function(k) { DATA[k] = []; });
}
// Le catalogue vient-il du réseau ? (base de données, ou simulation de la démonstration)
var EN_LIGNE = MODE_CLOUD || !!SIMU;
// 'local' | 'chargement' (attente de la base) | 'pret' | 'erreur' (base injoignable)
var ETAT_CLOUD = MODE_CLOUD ? (PharmaCloud.actif ? 'chargement' : 'erreur') : (SIMU ? 'chargement' : 'local');
var dernierChargementCloud = 0;

// Chaque catégorie produit est associée à une icône SVG existante.
// Nouvelle catégorie non prévue → icône générique 'sparkle' par défaut.
var CAT_ICON_MAP = {
  'Solaire': 'sun', 'Vitamines': 'pill', 'Hygiène': 'drop',
  'Beauté': 'sparkle', 'Bébé': 'baby', 'Minceur': 'sparkle', 'Aromathérapie': 'drop'
};
function iconForCat(cat) { return CAT_ICON_MAP[cat] || 'sparkle'; }

// Échappe une chaîne injectée dans un attribut onclick="...('...')".
// Sans cela, un nom contenant une apostrophe (L'Oréal) casse le bouton généré.
function escAttr(str) {
  return String(str == null ? '' : str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
// Nombre sûr pour un affichage ou un appel onclick (jamais de texte)
function nombre(v) { var n = Number(v); return isFinite(n) ? n : 0; }

// Formate une date ISO (2025-06-30, format utilisé côté admin) en format lisible ("30 juin")
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function formatDateFr(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  if (parts.length !== 3) return iso; // déjà dans un autre format (ex: saisi manuellement) : on laisse tel quel
  var day = parseInt(parts[2], 10);
  var month = MOIS_FR[parseInt(parts[1], 10) - 1] || '';
  return day + ' ' + month;
}

// Échappe une chaîne affichée dans du HTML : un nom de produit contenant
// < ou > s'affiche tel quel au lieu d'être interprété comme une balise.
function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Retrouve le produit du catalogue correspondant au nom d'une promo
// (les promos peuvent être des "lots" au nom légèrement différent du
// produit catalogue — comparaison approximative sur le premier mot).
function matchProduitPourPromo(nomPromo) {
  var clean = String(nomPromo || '').replace(/^Lot\s+/i, '').replace(/\s*x\d+$/i, '').trim().toLowerCase();
  var premierMot = clean.split(' ')[0];
  return DATA.produits.find(function(p) {
    return String(p.nom || '').toLowerCase().indexOf(premierMot) !== -1;
  });
}

var PROMOS = [];
var CATALOGUE = [];
// Reconstruit PROMOS/CATALOGUE à partir de DATA (à appeler après tout rechargement de DATA)
function buildCatalogueData() {
  CATALOGUE = DATA.produits.map(function(p) {
    return { id:'prod-'+p.id, produitId:p.id, cat:p.cat, nom:p.nom, prix:p.prix, icon:iconForCat(p.cat), stock:p.stock, photo:pharmaPhotoValide(p.photo),
             rayons:pharmaRayonsDuProduit(DATA, p) };
  });
  // Une promo n'est affichée que si elle est active ET dans sa période de validité.
  // Sans ce contrôle, une promo oubliée resterait visible indéfiniment sur le site.
  // Comparaison de dates AAAA-MM-JJ à la date locale du jour (une promo qui commence
  // aujourd'hui est visible dès minuit, une promo qui finit aujourd'hui l'est jusqu'au soir)
  var auj = pharmaDateLocale();
  PROMOS = DATA.promos.filter(function(pr) {
    if (pr.statut !== 'Active') return false;
    if (pr.debut && String(pr.debut).slice(0, 10) > auj) return false;   // pas encore commencée
    if (pr.fin && String(pr.fin).slice(0, 10) < auj) return false;        // terminée
    return true;
  }).map(function(pr) {
    // Produit de la promo : celui qui lui est relié dans la base, sinon d'après son nom
    var produit = (pr.produitId != null && DATA.produits.find(function(p) { return p.id === pr.produitId; })) || matchProduitPourPromo(pr.produit);
    var cat = produit ? produit.cat : 'Autres';
    return {
      id: 'promo-'+pr.id, promoId: pr.id, cat: cat, nom: pr.produit,
      prixPromo: pr.prixPromo, prixNormal: pr.prixNormal,
      pct: Math.abs(pr.pct), fin: formatDateFr(pr.fin), finIso: String(pr.fin || '').slice(0, 10), icon: iconForCat(cat),
      photo: produit ? pharmaPhotoValide(produit.photo) : '', miseEnAvant: pr.miseEnAvant === true
    };
  });
}
buildCatalogueData();
// Base de données sans copie locale : les informations de la pharmacie ne sont connues qu'à la réponse
// de la base. D'ici là, celles de data.js (une autre pharmacie) ne doivent pas apparaître.
var infosFiables = !EN_LIGNE || (MODE_CLOUD && PharmaCloud.depuisCache);
if (!infosFiables) document.documentElement.classList.add('attente-base');

var FAQ = [
  { q:'Comment fonctionne le click & collect ?', a:'Vous choisissez vos produits sur le site, vous validez votre commande, puis vous la récupérez directement {A_LA_NOM}. Le règlement se fait sur place, au retrait.' },
  { q:'Quel est le délai de préparation d\'une commande ?', a:'Vos commandes sont généralement prêtes en 1h en moyenne pendant les horaires d\'ouverture. Vous recevrez une notification dès qu\'elle est disponible au retrait.' },
  { q:'Comment payer ma commande ?', a:'Le paiement se fait exclusivement en pharmacie au moment du retrait (carte bancaire, espèces ou chèque). Aucun paiement n\'est demandé au moment de la commande en ligne.' },
  { q:'Puis-je modifier ou annuler ma commande ?', a:'Oui, contactez la pharmacie par téléphone le plus tôt possible après votre commande. Si elle est déjà en préparation, certaines modifications peuvent ne plus être possibles.' },
  { q:'Comment fonctionne le programme de fidélité ?', a:'Chaque achat compte : une fois le palier atteint, un code de réduction est automatiquement généré et disponible dans votre espace client. Créez votre compte pour commencer à cumuler.' },
  { q:'Que se passe-t-il si un produit est en rupture de stock ?', a:'Si un produit de votre commande n\'est plus disponible, l\'équipe de la pharmacie vous contacte directement pour vous proposer une alternative ou ajuster votre commande.' }
];

var ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.5 20.5L3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>',
  baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 15a3 3 0 0 0 6 0"/></svg>'
};

// Visuel d'une carte : la photo ajoutée dans l'admin, sinon l'icône du rayon
function visuelCarte(p) {
  var u = pharmaPhotoValide(p && p.photo);
  return u ? '<img class="carte-photo" src="' + escHtml(u) + '" alt="" loading="lazy" decoding="async" data-photo data-icone="' + escHtml(p.icon || '') + '">' : (ICONS[p && p.icon] || '');
}

// Photos : la case garde un reflet tant que l'image n'est pas arrivée, puis l'image apparaît en fondu.
// Une image introuvable (supprimée, réseau coupé) laisse la place à l'icône du rayon.
function suivrePhoto(img, siEchec) {
  var cadre = img.parentNode;
  if (!cadre) return;
  function prete() { cadre.classList.add('photo-prete'); }
  function echec() {
    if (siEchec) { siEchec(img, cadre); return; }
    cadre.classList.remove('avec-photo');
    cadre.classList.add('photo-prete');
    img.insertAdjacentHTML('beforebegin', ICONS[img.getAttribute('data-icone')] || '');
    img.remove();
  }
  if (img.complete && img.getAttribute('src')) { if (img.naturalWidth) prete(); else echec(); return; }
  img.addEventListener('load', prete, { once: true });
  img.addEventListener('error', echec, { once: true });
}
function suivrePhotos(racine) {
  if (!racine) return;
  racine.querySelectorAll('img[data-photo]').forEach(function(img) {
    if (img.__suivie) return;
    img.__suivie = true;
    suivrePhoto(img);
  });
}

// Photo d'un article du panier : lue dans le catalogue au moment de l'affichage. Le panier enregistré
// ne garde pas de photo : une photo changée ou retirée dans l'admin est suivie partout.
function photoArticle(id) {
  var a = CATALOGUE.find(function(x) { return x.id === id; }) || PROMOS.find(function(x) { return x.id === id; });
  return a ? pharmaPhotoValide(a.photo) : '';
}
// Vignette d'un article (panier, récapitulatif, confirmation, message d'ajout) :
// la même photo que sur sa carte du catalogue, sinon l'icône du rayon
function vignetteArticle(item, classe) {
  var photo = photoArticle(item && item.id);
  return '<span class="' + classe + ' vignette' + (photo ? ' avec-photo' : '') + '" aria-hidden="true">' +
    visuelCarte({ photo: photo, icon: item && item.icon }) + '</span>';
}

var cart = [];
var appliedPromo = null;

// ── PERSISTANCE DU PANIER ───────────────────────────────────
// Le panier survit à un rechargement de page ou à une visite ultérieure.
var CART_KEY = 'pharma-cart';
function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ cart: cart, promo: appliedPromo }));
  } catch (e) { /* quota dépassé ou navigation privée : le panier reste en mémoire */ }
}
function loadCart() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(CART_KEY) || 'null'); } catch (e) {}
  if (!saved || !Array.isArray(saved.cart)) return;
  // On ne restaure que les articles encore disponibles au catalogue,
  // pour éviter un panier contenant un produit supprimé côté admin.
  cart = saved.cart.filter(function(item) {
    return item && item.id && typeof item.prix === 'number' && item.qty > 0;
  });
  if (saved.promo && saved.promo.code) {
    if (MODE_CLOUD) {
      // Mode base de données : le code est revérifié par le serveur au moment de la commande
      // (les valeurs gardées ici ne servent qu'à afficher la réduction dans le panier).
      var sp = saved.promo, pct = parseInt(sp.pct, 10);
      appliedPromo = (typeof sp.code === 'string' && pct >= 1 && pct <= 100)
        ? { code: sp.code.slice(0, 40), pct: pct, scope: String(sp.scope || 'Tous'), label: String(sp.label || ('-' + pct + '%')) }
        : null;
    } else {
      // Le code promo est revalidé : il a pu expirer ou être désactivé entre-temps
      var revalide = findCodePromo(saved.promo.code);
      appliedPromo = (revalide && !revalide.erreur) ? revalide : null;
    }
    if (appliedPromo) {
      var label = document.getElementById('promo-label');
      if (label) label.textContent = '('+appliedPromo.code+')';
      var input = document.getElementById('promo-input');
      if (input) input.value = appliedPromo.code;
      var feedback = document.getElementById('promo-feedback');
      if (feedback) {
        feedback.textContent = '✓ Code appliqué : '+appliedPromo.label;
        feedback.style.color = 'var(--vert)';
      }
    }
  }
}

// Codes promo valides (en vrai ça viendrait de la base de données)
// Les codes promo viennent désormais de DATA.codesPromo (gérés depuis l'admin).
// Un code est utilisable s'il est actif, non expiré et pas épuisé.
function findCodePromo(code) {
  var c = DATA.codesPromo.find(function(x){ return x.code.toUpperCase() === code.toUpperCase(); });
  if (!c) return null;
  if (!c.actif) return { erreur: 'Ce code a été désactivé' };
  if (c.expire && String(c.expire).slice(0, 10) < pharmaDateLocale()) return { erreur: 'Ce code a expiré' };
  if (c.maxUsages && c.usages >= c.maxUsages) return { erreur: 'Ce code a déjà été utilisé' };
  return { code: c.code, pct: c.pct, scope: c.scope, label: '-'+c.pct+'%'+(c.scope!=='Tous' ? ' '+c.scope : '') };
}

// ── CONFIGURATION PHARMACIE (nom, adresse, contact, bandeau) ──
function applyPharmacyConfig() {
  var cfg = DATA.parametres || {};
  // Couleur principale personnalisable depuis l'admin (revente à d'autres pharmacies).
  // Appliquée uniquement en thème clair : le thème sombre a sa propre palette.
  appliquerCouleurTheme();
  var nomPharma = cfg.nom || 'Pharmacie Démo';
  var villeTxt = PharmaTextes.villeAffichee(cfg.adresse);
  titreSite = nomPharma + ' — Parapharmacie & Click and Collect' + (villeTxt ? ' à ' + villeTxt : '');
  if (!document.body || !document.body.classList.contains('vue-rayon')) document.title = titreSite;
  document.querySelectorAll('#brand-name-header, #brand-name-footer, #brand-name-copyright').forEach(function(el) {
    el.textContent = nomPharma;
  });
  // Phrases du site qui citent la pharmacie : nom et ville repris des Paramètres de l'admin
  document.querySelectorAll('[data-pharma="a-la-nom"]').forEach(function(el) { el.textContent = PharmaTextes.aLaNom(nomPharma); });
  document.querySelectorAll('[data-pharma="ville"]').forEach(function(el) { el.textContent = villeTxt; });
  document.querySelectorAll('[data-pharma="bloc-ville"]').forEach(function(el) { el.style.display = villeTxt ? '' : 'none'; });
  document.querySelectorAll('[data-pharma="adresse-courte"]').forEach(function(el) { el.textContent = PharmaTextes.adresseCourte(cfg.adresse); });
  majReferencement(cfg, nomPharma, villeTxt);
  var addrLine = document.getElementById('footer-address-line');
  if (addrLine) addrLine.textContent = cfg.adresse || '';
  var addrPlain = document.getElementById('footer-address-plain');
  if (addrPlain) addrPlain.textContent = cfg.adresse || '';
  var telLink = document.getElementById('footer-tel-link');
  if (telLink && cfg.tel) {
    telLink.textContent = cfg.tel;
    telLink.href = 'tel:' + cfg.tel.replace(/\s+/g, '');
  }
  var emailLink = document.getElementById('footer-email-link');
  if (emailLink && cfg.email) emailLink.href = 'mailto:' + cfg.email;
  // Bandeau de garde / annonce (piloté depuis l'admin — Horaires & Gardes)
  var gb = document.getElementById('garde-bar');
  if (gb) {
    if (cfg.bandeauActif && cfg.bandeauMsg) {
      gb.textContent = cfg.bandeauMsg;
      gb.style.display = '';
    } else {
      gb.style.display = 'none';
    }
  }
  majHauteurBandeau();
  renderFooterHoraires();
  renderFideliteTextes();
}

// Description, aperçu de partage et fiche Google (données structurées) mis à jour avec
// les informations de l'admin. Les aperçus de partage (WhatsApp, Facebook) lisent la page
// sans l'exécuter : ils gardent ceux écrits dans site.html, à adapter à l'installation.
function majReferencement(cfg, nomPharma, villeTxt) {
  function meta(selecteur, valeur) {
    var el = document.querySelector(selecteur);
    if (el && valeur) el.setAttribute('content', valeur);
  }
  var adresseCourte = PharmaTextes.adresseCourte(cfg.adresse);
  meta('meta[name="description"]', 'Commandez vos produits de parapharmacie en ligne et récupérez-les ' + PharmaTextes.aLaNom(nomPharma)
    + (adresseCourte ? ', ' + adresseCourte : '') + '. Click & collect, sans paiement en ligne.');
  meta('meta[property="og:site_name"]', nomPharma);
  meta('meta[property="og:title"]', nomPharma + ' — Click & Collect' + (villeTxt ? ' à ' + villeTxt : ''));
  var ld = document.querySelector('script[type="application/ld+json"]');
  if (!ld) return;
  try {
    var fiche = JSON.parse(ld.textContent);
    var d = PharmaTextes.decouperAdresse(cfg.adresse);
    fiche.name = nomPharma;
    fiche.address = { '@type': 'PostalAddress', streetAddress: d.rue, postalCode: d.cp, addressLocality: d.ville, addressCountry: 'FR' };
    var chiffres = String(cfg.tel || '').replace(/\D/g, '');
    if (/^0\d{9}$/.test(chiffres)) fiche.telephone = '+33' + chiffres.slice(1);
    var jours = { lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday', vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday' };
    var h = DATA.horaires || {};
    fiche.openingHoursSpecification = JOURS_ORDRE.filter(function(j) { return h[j] && h[j].ouvert && h[j].debut && h[j].fin; })
      .map(function(j) { return { '@type': 'OpeningHoursSpecification', dayOfWeek: jours[j], opens: h[j].debut, closes: h[j].fin }; });
    ld.textContent = JSON.stringify(fiche, null, 2);
  } catch (e) { /* fiche laissée telle quelle */ }
}

// Textes du programme de fidélité, pilotés par la config admin
// (palier et % de réduction sont personnalisables par pharmacie).
function renderFideliteTextes() {
  var cfg = DATA.parametres || {};
  var seuil = cfg.fideliteSeuil || 5;
  var reduction = cfg.fideliteReduction || 10;
  var carte = document.getElementById('fid-resume-carte');
  if (carte) carte.textContent = seuil + ' achats = -' + reduction + '%';
  var slider = document.getElementById('fid-resume-slider');
  if (slider) slider.innerHTML = escHtml(seuil) + ' achats = <span style="color:var(--or)">-' + escHtml(reduction) + '% offert</span>';
  var qr = document.getElementById('fid-resume-carte-qr');
  if (qr) qr.textContent = 'Membre · ' + seuil + ' achats';
}

// ── HORAIRES DU FOOTER (depuis DATA.horaires, éditables en admin) ──
// Les jours consécutifs ayant les mêmes horaires sont regroupés (ex. "Lun-Ven : 9h-19h30").
var JOURS_ORDRE = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
var JOURS_COURT = { lundi:'Lun', mardi:'Mar', mercredi:'Mer', jeudi:'Jeu', vendredi:'Ven', samedi:'Sam', dimanche:'Dim' };
function formatHeure(h) {
  if (!h) return '';
  var parts = h.split(':');
  var min = parts[1] === '00' ? '' : parts[1];
  return parseInt(parts[0], 10) + 'h' + min;
}
function renderFooterHoraires() {
  var box = document.getElementById('footer-horaires');
  if (!box || !DATA.horaires) return;
  var groupes = [];
  JOURS_ORDRE.forEach(function(jour) {
    var h = DATA.horaires[jour];
    if (!h) return;
    var texte = h.ouvert ? (formatHeure(h.debut) + '-' + formatHeure(h.fin)) : 'Fermé';
    var dernier = groupes[groupes.length - 1];
    if (dernier && dernier.texte === texte) {
      dernier.fin = jour;
    } else {
      groupes.push({ debut: jour, fin: jour, texte: texte });
    }
  });
  var html = groupes.map(function(g) {
    var label = g.debut === g.fin ? JOURS_COURT[g.debut] : JOURS_COURT[g.debut] + '-' + JOURS_COURT[g.fin];
    return '<a style="cursor:default">' + escHtml(label) + ' : ' + escHtml(g.texte) + '</a>';
  }).join('');
  // Jours spéciaux des 14 prochains jours (gardes, fermetures exceptionnelles) saisis dans l'admin
  var auj = pharmaDateLocale();
  var limite = new Date(); limite.setDate(limite.getDate() + 14);
  var fin = pharmaDateLocale(limite);
  (DATA.joursSpeciaux || []).filter(function(j) {
    var d = String(j && j.date || '').slice(0, 10);
    return d && d >= auj && d <= fin;
  }).sort(function(a, b) { return String(a.date) < String(b.date) ? -1 : 1; }).forEach(function(j) {
    var jour = formatDateFr(String(j.date).slice(0, 10));
    var texte = j.type === 'Fermeture' ? 'Fermé le ' + jour
      : (j.type || 'Ouverture') + ' le ' + jour + (j.debut && j.fin ? ' : ' + formatHeure(j.debut) + '-' + formatHeure(j.fin) : '');
    html += '<a style="cursor:default;color:var(--or)" class="footer-special">' + escHtml(texte) + '</a>';
  });
  box.innerHTML = html;
}

// Le bandeau du haut passe sur 2 lignes sur un petit écran : l'en-tête se place juste
// en dessous, quelle que soit sa hauteur (et remonte en haut si le bandeau est désactivé).
function majHauteurBandeau() {
  var gb = document.getElementById('garde-bar');
  var h = (gb && gb.style.display !== 'none') ? gb.offsetHeight : 0;
  document.documentElement.style.setProperty('--bandeau-h', h + 'px');
}
window.addEventListener('resize', majHauteurBandeau);
window.addEventListener('orientationchange', majHauteurBandeau);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(majHauteurBandeau);

// ── PAGES LÉGALES ───────────────────────────────────────────
// Le contenu est généré depuis DATA.parametres : une autre pharmacie
// n'a qu'à remplir ses informations dans l'admin pour être conforme.
function todo(v) {
  if (!v || String(v).indexOf('[') === 0) {
    return '<span class="legal-todo">' + (v || '[à compléter]') + '</span>';
  }
  return v;
}

function contenuLegal(page) {
  // Toutes les valeurs saisies dans l'admin sont échappées avant d'être insérées dans la page.
  var brut = DATA.parametres || {};
  var p = {
    nom: escHtml(brut.nom), adresse: escHtml(brut.adresse), tel: escHtml(brut.tel), email: escHtml(brut.email),
    fideliteSeuil: parseInt(brut.fideliteSeuil, 10) || 5, fideliteReduction: parseInt(brut.fideliteReduction, 10) || 10
  };
  var emailActif = !!(brut.emailjs && brut.emailjs.actif);
  var l = {};
  var lb = brut.legal || {};
  Object.keys(lb).forEach(function(k) { l[k] = escHtml(lb[k]); });
  var nom = p.nom || 'la pharmacie';

  if (page === 'mentions') {
    return '<h3>Éditeur du site</h3>'
      + '<p><strong>' + nom + '</strong><br>'
      + 'Raison sociale : ' + todo(l.raisonSociale) + '<br>'
      + 'Forme juridique : ' + todo(l.formeJuridique) + '<br>'
      + 'Capital social : ' + todo(l.capital) + '<br>'
      + 'Adresse : ' + (p.adresse || '') + '<br>'
      + 'Téléphone : ' + (p.tel || '') + '<br>'
      + 'Email : ' + (p.email || '') + '</p>'
      + '<h3>Immatriculation</h3>'
      + '<p>SIRET : ' + todo(l.siret) + '<br>'
      + 'RCS : ' + todo(l.rcs) + '<br>'
      + 'N° TVA intracommunautaire : ' + todo(l.tva) + '</p>'
      + '<h3>Pharmacien titulaire</h3>'
      + '<p>' + todo(l.titulaire) + '<br>'
      + 'N° d\'inscription à l\'Ordre national des pharmaciens : ' + todo(l.numeroOrdre) + '</p>'
      + '<p>L\'exercice de la pharmacie est réglementé. Le pharmacien titulaire est inscrit au tableau de l\'Ordre national des pharmaciens, dont l\'annuaire public permet de vérifier cette inscription.</p>'
      + '<h3>Autorité de tutelle</h3>'
      + '<p>L\'officine exerce sous le contrôle de l\'autorité ayant délivré son autorisation d\'exploitation :<br>'
      + todo(l.ars) + '<br>'
      + 'N° de licence d\'officine : ' + todo(l.licence) + '</p>'
      + '<h3>Directeur de la publication</h3>'
      + '<p>' + todo(l.directeurPublication) + '</p>'
      + '<h3>Hébergeur</h3>'
      + '<p>' + todo(l.hebergeur) + '<br>'
      + 'Téléphone : ' + todo(l.hebergeurTel) + '</p>'
      + '<h3>Propriété intellectuelle</h3>'
      + '<p>L\'ensemble des contenus de ce site (textes, visuels, logos, structure) est protégé par le droit de la propriété intellectuelle. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.</p>'
      + '<h3>Données personnelles</h3>'
      + '<p>Les données collectées par ce site et vos droits sont décrits dans la politique de confidentialité.</p>'
      + '<h3>Signalement de contenu</h3>'
      + '<p>Pour signaler un contenu illicite ou toute erreur sur ce site, contactez-nous à ' + (p.email || '') + ' ou au ' + (p.tel || '') + '.</p>'
      + '<div class="legal-maj">Les mentions entourées en orange restent à compléter avant la mise en ligne publique du site.</div>';
  }

  if (page === 'cgv') {
    var seuil = p.fideliteSeuil || 5;
    var reduc = p.fideliteReduction || 10;
    return '<h3>Objet</h3>'
      + '<p>Les présentes conditions régissent le service de réservation en ligne avec retrait en officine (« click &amp; collect ») proposé par ' + nom + '. Elles s\'appliquent à toute commande passée sur ce site.</p>'
      + '<h3>Nature du service</h3>'
      + '<p><strong>Ce site ne constitue pas une vente à distance.</strong> Il s\'agit d\'un service de réservation : aucun paiement n\'est effectué en ligne. La vente est conclue en officine, au moment du retrait et du règlement.</p>'
      + '<p>Le service concerne exclusivement des produits de parapharmacie. Aucun médicament, sur ordonnance ou non, n\'est vendu via ce site.</p>'
      + '<h3>Commande</h3>'
      + '<ul><li>La commande vaut demande de réservation, sous réserve de disponibilité effective des produits.</li>'
      + '<li>Un récapitulatif est présenté avant validation.</li>'
      + '<li>La pharmacie confirme la disponibilité et vous informe dès que la commande est prête.</li>'
      + '<li>Si un produit s\'avère indisponible, la pharmacie vous contacte pour proposer une alternative ou ajuster la commande.</li></ul>'
      + '<h3>Prix</h3>'
      + '<p>Les prix sont indiqués en euros toutes taxes comprises. Ils sont donnés à titre indicatif et sont ceux pratiqués en officine au moment du retrait. En cas d\'écart, le prix affiché en officine fait foi.</p>'
      + '<h3>Retrait</h3>'
      + '<p>Le retrait s\'effectue à l\'officine, aux horaires d\'ouverture, sur présentation de votre numéro de commande et de votre code de retrait. Les commandes non retirées sous 7 jours sont automatiquement annulées et les produits remis en rayon. Le retrait est gratuit ; aucune livraison n\'est proposée.</p>'
      + '<h3>Paiement</h3>'
      + '<p>Le règlement s\'effectue exclusivement en officine lors du retrait (carte bancaire, espèces ou tout autre moyen accepté par la pharmacie).</p>'
      + '<h3>Annulation et rétractation</h3>'
      + '<p>Vous pouvez annuler votre réservation à tout moment avant le retrait, sans frais ni justification, en contactant la pharmacie au ' + (p.tel || '') + '.</p>'
      + '<p>Le droit de rétractation de 14 jours prévu pour la vente à distance ne s\'applique pas ici, puisque la vente est conclue en officine. Vous disposez néanmoins des garanties légales : garantie de conformité (deux ans à compter de la délivrance pour un bien neuf) et garantie des vices cachés.</p>'
      + '<h3>Programme de fidélité</h3>'
      + '<p>Après ' + seuil + ' achats, un code de réduction de ' + reduc + '% est généré automatiquement. Il est nominatif, à usage unique, non cessible et non convertible en espèces. Sa durée de validité est indiquée lors de son attribution.</p>'
      + '<h3>Responsabilité</h3>'
      + '<p>Les informations produits sont fournies à titre indicatif et ne remplacent pas l\'avis d\'un professionnel de santé. En cas de doute, demandez conseil à votre pharmacien.</p>'
      + '<h3>Litiges et médiation</h3>'
      + '<p>En cas de différend, contactez-nous en priorité afin de rechercher une solution amiable. À défaut, vous pouvez recourir gratuitement au médiateur de la consommation : ' + todo(l.mediateur) + '</p>'
      + '<p>Pour toute question relative à l\'exercice de la pharmacie ou à un conseil de santé, vous pouvez également saisir le Conseil régional de l\'Ordre des pharmaciens.</p>'
      + '<p>Les présentes conditions sont soumises au droit français.</p>'
      + '<div class="legal-maj">Document à faire valider par un professionnel du droit avant la mise en ligne.</div>';
  }

  // Politique de confidentialité
  return '<h3>Responsable du traitement</h3>'
    + '<p>' + nom + ' — ' + (p.adresse || '') + '<br>Téléphone : ' + (p.tel || '') + '<br>Contact pour toute question sur vos données personnelles : ' + (p.email || '') + '</p>'
    + '<h3>Données collectées</h3>'
    + '<p>Lors d\'une commande, nous collectons uniquement les données nécessaires à sa préparation et à votre information :</p>'
    + '<ul><li>Nom et prénom</li><li>Adresse email</li><li>Numéro de téléphone</li><li>Contenu de la commande</li></ul>'
    + '<p>Si vous créez un compte, s\'y ajoutent les informations que vous renseignez volontairement (date de naissance, adresse postale, langue préférée, photo de profil).</p>'
    + '<p>Votre nom, votre adresse email et votre numéro de téléphone sont <strong>obligatoires</strong> pour passer commande : sans eux, nous ne pouvons ni préparer votre commande ni vous prévenir qu\'elle est prête, et la commande ne peut pas être enregistrée. Les informations de compte sont facultatives.</p>'
    + '<h3>Finalités</h3>'
    + '<ul><li>Préparer votre commande et vous prévenir lorsqu\'elle est prête</li>'
    + '<li>Vous contacter en cas d\'indisponibilité d\'un produit</li>'
    + '<li>Gérer le programme de fidélité</li>'
    + '<li>Répondre à vos demandes</li></ul>'
    + '<p>Vos données ne sont ni vendues, ni louées, ni transmises à des tiers à des fins commerciales.</p>'
    + '<h3>Destinataires</h3>'
    + '<p>Les données sont destinées à ' + nom + ' et à son personnel habilité.</p>'
    + (emailActif
      ? '<p>Pour vous envoyer les emails de confirmation et de suivi, votre nom, votre adresse email et le contenu de votre commande sont transmis à EmailJS (EmailJS Pte. Ltd.), prestataire technique d\'envoi d\'emails qui agit pour notre compte. Les serveurs de ce prestataire sont situés <strong>aux États-Unis</strong> : ce transfert hors de l\'Union européenne est encadré, selon le prestataire, par des clauses contractuelles types.</p>'
      : '')
    + '<p>Le site est hébergé par ' + todo(l.hebergeur) + ' ; l\'hébergeur reçoit, dans ses journaux techniques, l\'adresse IP des visiteurs.</p>'
    + '<h3>Base légale</h3>'
    + '<p>Le traitement repose sur l\'exécution de votre demande de réservation et, pour les communications facultatives, sur votre consentement, révocable à tout moment.</p>'
    + '<h3>Durée de conservation</h3>'
    + '<p>Les données de commande sont conservées 3 ans à compter du dernier contact. Les données de compte sont conservées jusqu\'à sa suppression.</p>'
    + '<h3>Vos droits</h3>'
    + '<p>Vous disposez d\'un droit d\'accès, de rectification, d\'effacement, de limitation, d\'opposition et de portabilité. Lorsque le traitement repose sur votre consentement, vous pouvez le retirer à tout moment. Vous pouvez aussi définir des directives sur le sort de vos données après votre décès. Pour exercer ces droits, écrivez à ' + (p.email || '') + '.</p>'
    + '<p>Vous pouvez également introduire une réclamation auprès de la CNIL (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — cnil.fr).</p>'
    + '<h3>Cookies et stockage local</h3>'
    + '<p>Ce site utilise uniquement le stockage local de votre navigateur pour des fonctions strictement nécessaires : mémoriser votre panier, vos préférences d\'affichage (thème clair/sombre) et vos informations de compte. Aucun cookie publicitaire, aucun traceur, aucun outil de mesure d\'audience tiers n\'est utilisé.</p>'
    + '<p>Ces données restent sur votre appareil. Vous pouvez les effacer à tout moment via les paramètres de votre navigateur.</p>'
    + '<h3>Polices de caractères</h3>'
    + '<p>Pour afficher le site, votre navigateur télécharge ses polices de caractères depuis les serveurs de Google (Google Fonts). Cette requête transmet à Google votre adresse IP et des informations techniques sur votre navigateur. Le site ne transmet aucune autre donnée à Google.</p>'
    + '<h3>Sécurité</h3>'
    + '<p>Nous mettons en œuvre les mesures techniques appropriées pour protéger vos données contre tout accès non autorisé.</p>'
    + '<div class="legal-maj">Avant la mise en ligne : faire valider ce document par un professionnel du droit. Les paragraphes sur EmailJS et sur les polices Google sont à retirer si les emails passent par un prestataire européen et si les polices sont hébergées sur le site.</div>';
}

var LEGAL_TITRES = {
  mentions: 'Mentions légales',
  cgv: 'Conditions générales',
  confidentialite: 'Politique de confidentialité'
};

function ouvrirLegal(page) {
  var titre = document.getElementById('legal-titre');
  var contenu = document.getElementById('legal-content');
  var modal = document.getElementById('legal-modal');
  if (!modal) return;
  if (titre) titre.textContent = LEGAL_TITRES[page] || 'Informations légales';
  if (contenu) { contenu.innerHTML = contenuLegal(page); contenu.scrollTop = 0; }
  modal.classList.add('open');
}
function fermerLegal() {
  var modal = document.getElementById('legal-modal');
  if (modal) modal.classList.remove('open');
}

// ── BANDEAU COOKIES ─────────────────────────────────────────
// Le site n'utilise que du stockage strictement nécessaire, mais le bandeau
// informe l'utilisateur et lui laisse un choix aussi simple dans les deux sens
// (recommandation CNIL : refuser doit être aussi facile qu'accepter).
var COOKIE_KEY = 'pharma-cookies';
function initCookieBar() {
  var choix = null;
  try { choix = localStorage.getItem(COOKIE_KEY); } catch (e) {}
  if (choix) return;
  var bar = document.getElementById('cookie-bar');
  if (bar) setTimeout(function(){ bar.classList.add('show'); }, 900);
}
function cookieChoix(accepte) {
  try { localStorage.setItem(COOKIE_KEY, accepte ? 'accepte' : 'refuse'); } catch (e) {}
  var bar = document.getElementById('cookie-bar');
  if (bar) bar.classList.remove('show');
  pharmaToast(accepte ? 'Préférences enregistrées' : 'Seul le strict nécessaire sera utilisé');
}

// ── THEME JOUR/NUIT (détection intelligente) ──
function initTheme() {
  var saved = null;
  try { saved = localStorage.getItem('pharma-theme'); } catch(e){}

  if (saved) {
    // 1. Le client a déjà choisi → on respecte son choix
    setTheme(saved);
    return;
  }

  // 2. Suivre le réglage système du téléphone/ordinateur
  var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // 3. Se baser sur l'heure (nuit entre 20h et 7h)
  var hour = new Date().getHours();
  var isNightTime = (hour >= 20 || hour < 7);

  // Priorité : système → heure → par défaut nuit
  var theme;
  if (systemPrefersDark) {
    theme = 'dark';
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    // Système explicitement en clair, mais on bascule en nuit la nuit
    theme = isNightTime ? 'dark' : 'light';
  } else {
    // Pas de préférence système détectable → heure, défaut nuit
    theme = isNightTime ? 'dark' : 'light';
  }

  setTheme(theme, false);

  // Écouter les changements de mode système en temps réel (si pas de choix manuel)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      var manualChoice = null;
      try { manualChoice = localStorage.getItem('pharma-theme'); } catch(err){}
      if (!manualChoice) setTheme(e.matches ? 'dark' : 'light', false);
    });
  }
}
// Couleur principale choisie dans l'admin : appliquée en thème clair seulement. En passant au
// thème sombre, elle est retirée (sinon le vert foncé restait affiché sur fond sombre, peu lisible).
function appliquerCouleurTheme() {
  var cfg = (typeof DATA !== 'undefined' && DATA && DATA.parametres) || {};
  var racine = document.documentElement;
  if (cfg.couleurPrimaire && racine.getAttribute('data-theme') !== 'dark') racine.style.setProperty('--vert', cfg.couleurPrimaire);
  else racine.style.removeProperty('--vert');
}

function setTheme(theme, memoriser) {
  document.documentElement.setAttribute('data-theme', theme);
  appliquerCouleurTheme();
  // memoriser === false : application temporaire (aucun choix explicite du visiteur),
  // pour que le site continue de suivre le réglage système et l'heure.
  if (memoriser !== false) {
    try { localStorage.setItem('pharma-theme', theme); } catch(e){}
  }
  var icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'dark') {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>';
    }
  }
}
function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
}

// ── NIVEAU DE PERFORMANCE ──────────────────────────────────
// Le mode "économie d'énergie" d'un téléphone n'est PAS exposé aux sites web
// (aucune API standard, l'API Batterie ne fonctionne pas sur Safari/iOS).
// On s'appuie donc sur des signaux fiables et universels :
//  - prefers-reduced-motion : réglage système "Réduire les animations"
//  - nombre de cœurs CPU et taille d'écran : puissance de l'appareil
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function getPerfProfile() {
  if (prefersReducedMotion()) return { anim:false, nodes:0, drops:0, fps:0 };
  var cores = navigator.hardwareConcurrency || 4;
  var petitEcran = window.innerWidth < 900;
  if (cores <= 4 || window.innerWidth < 600) return { anim:true, nodes:12, drops:8, fps:30 };
  if (petitEcran) return { anim:true, nodes:20, drops:12, fps:30 };
  return { anim:true, nodes:28, drops:18, fps:60 };
}

// ── AMBIENT BACKGROUND (molécules + gouttes) ──
function initAmbient() {
  var canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  var perf = getPerfProfile();
  // Animation désactivée si l'utilisateur a demandé de réduire les animations
  if (!perf.anim) { canvas.style.display = 'none'; return; }
  var ctx = canvas.getContext('2d');
  var W, H, nodes = [], drops = [];
  var rafId = null, running = false, visible = true, onScreen = true;
  var frameInterval = 1000 / perf.fps, lastFrame = 0, lastDraw = 0;
  // Taille du fond = sa taille affichée (hauteur de l'écran barre d'adresse repliée, voir .ambient).
  // Sur téléphone, la barre d'adresse se replie ou revient au début du défilement et déclenche un
  // « resize » : la taille affichée ne change pas, le dessin n'est donc ni effacé ni étiré.
  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (w === W && h === H) return;
    W = canvas.width = w;
    H = canvas.height = h;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  // Molécules
  for (var i = 0; i < perf.nodes; i++) {
    nodes.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3, r:Math.random()*2+1 });
  }
  // Gouttes qui tombent
  for (var d = 0; d < perf.drops; d++) {
    drops.push({ x:Math.random()*W, y:Math.random()*H, len:Math.random()*14+6, speed:Math.random()*1.5+0.8, opacity:Math.random()*0.3+0.1 });
  }
  function draw(now) {
    if (!running) return;
    rafId = requestAnimationFrame(draw);
    // Limitation du nombre d'images par seconde (30 fps sur mobile) :
    // moitié moins de calculs, différence invisible pour un fond décoratif.
    if (now && frameInterval > 16.7) {
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;
    }
    // Déplacement proportionnel au temps écoulé : même vitesse si le téléphone saute des images
    // pendant un défilement (sinon les molécules ralentissent puis rattrapent d'un coup)
    var k = (now && lastDraw) ? Math.min(now - lastDraw, 64) / 16.67 : 1;
    lastDraw = now || 0;
    ctx.clearRect(0,0,W,H);
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    // Molécules du fond : sable doré, discret (le vert reste au logo et aux boutons)
    var color = isDark ? '214,190,140' : '160,128,64';
    // Molécules + liens
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx * k; n.y += n.vy * k;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba('+color+',0.4)';
      ctx.fill();
      for (var j = i+1; j < nodes.length; j++) {
        var m = nodes[j];
        var dx = n.x-m.x, dy = n.y-m.y;
        var dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = 'rgba('+color+','+(0.15*(1-dist/130))+')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    // Gouttes qui tombent
    for (var k = 0; k < drops.length; k++) {
      var dp = drops[k];
      ctx.beginPath();
      ctx.moveTo(dp.x, dp.y);
      ctx.lineTo(dp.x, dp.y + dp.len);
      var grad = ctx.createLinearGradient(dp.x, dp.y, dp.x, dp.y+dp.len);
      grad.addColorStop(0, 'rgba('+color+',0)');
      grad.addColorStop(1, 'rgba('+color+','+dp.opacity+')');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Petite goutte ronde en bas
      ctx.beginPath();
      ctx.arc(dp.x, dp.y + dp.len, 1.5, 0, Math.PI*2);
      ctx.fillStyle = 'rgba('+color+','+dp.opacity+')';
      ctx.fill();
      dp.y += dp.speed * k;
      if (dp.y > H + 20) { dp.y = -20; dp.x = Math.random()*W; }
    }
  }

  // Démarre / arrête l'animation. Elle ne tourne que si la page est visible
  // ET que le canvas est à l'écran — évite de consommer la batterie inutilement.
  function start() {
    if (running) return;
    running = true;
    lastFrame = 0; lastDraw = 0;
    rafId = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function refresh() {
    if (visible && onScreen) start(); else stop();
  }

  // Pause quand l'onglet passe en arrière-plan ou que l'écran se verrouille
  document.addEventListener('visibilitychange', function() {
    visible = !document.hidden;
    refresh();
  });
  // Pause quand le fond n'est plus à l'écran (client descendu dans la page)
  if (window.IntersectionObserver) {
    new IntersectionObserver(function(entries) {
      onScreen = entries[0].isIntersecting;
      refresh();
    }, { threshold: 0 }).observe(canvas);
  }
  start();
}

// ── ANNONCES DE L'ACCUEIL (promo et jours spéciaux saisis dans l'admin) ──
var JOURS_SEMAINE = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

// La promo mise en avant : la plus forte réduction, puis celle qui se termine le plus tôt
function ordrePromos(a, b) {
  var ecart = nombre(b.pct) - nombre(a.pct);
  if (ecart) return ecart;
  var fa = a.finIso || '9999', fb = b.finIso || '9999';
  return fa < fb ? -1 : (fa > fb ? 1 : 0);
}
function promoALaUne() {
  return PROMOS.slice().sort(ordrePromos)[0] || null;
}
// Promos qui défilent dans « La promo du moment » : celles cochées « Mise en avant » dans l'admin,
// la plus forte remise d'abord. Aucune cochée : la plus forte remise seule, comme avant.
function promosEnAvant() {
  var choisies = PROMOS.filter(function(p) { return p.miseEnAvant; }).sort(ordrePromos);
  if (choisies.length) return choisies;
  var p = promoALaUne();
  return p ? [p] : [];
}

// Prochain jour spécial (garde, fermeture, horaires modifiés) dans les 14 jours, comme dans le pied de page
function prochainJourSpecial() {
  var auj = pharmaDateLocale();
  var limite = new Date(); limite.setDate(limite.getDate() + 14);
  var fin = pharmaDateLocale(limite);
  return (DATA.joursSpeciaux || []).filter(function(j) {
    var d = String(j && j.date || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= auj && d <= fin;
  }).sort(function(a, b) { return String(a.date).slice(0, 10) < String(b.date).slice(0, 10) ? -1 : 1; })[0] || null;
}

// « aujourd'hui », « demain » ou « le samedi 24 octobre »
function quandJourSpecial(iso) {
  var demain = new Date(); demain.setDate(demain.getDate() + 1);
  if (iso === pharmaDateLocale()) return 'aujourd\'hui';
  if (iso === pharmaDateLocale(demain)) return 'demain';
  var p = iso.split('-');
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return 'le ' + (isNaN(d.getTime()) ? '' : JOURS_SEMAINE[d.getDay()] + ' ') + formatDateFr(iso);
}

function heureValide(h) { return /^\d{1,2}:\d{2}$/.test(String(h || '')); }

function texteJourSpecial(j) {
  var iso = String(j.date).slice(0, 10);
  var heures = (heureValide(j.debut) && heureValide(j.fin)) ? ' · ' + formatHeure(j.debut) + '–' + formatHeure(j.fin) : '';
  if (j.type === 'Fermeture') return 'Fermeture exceptionnelle ' + quandJourSpecial(iso);
  if (j.type === 'Garde') return 'Pharmacie de garde ' + quandJourSpecial(iso) + heures;
  return String(j.type || 'Horaires modifiés') + ' ' + quandJourSpecial(iso) + heures;
}

// Carte « promo » et chiffre « Jusqu'à -X % » du haut de page
function renderAnnonces() {
  var promo = promoALaUne();
  var prix = function(v) { return nombre(v).toFixed(2).replace('.', ',') + '€'; };
  var pct = promo ? Math.round(nombre(promo.pct)) : 0;
  var carte = document.getElementById('hero-promo');
  if (carte) {
    carte.innerHTML = promo
      ? '<span class="promo-badge">-' + pct + '%</span><div style="margin-top:10px"><div class="fc-title">' + escHtml(promo.nom) + '</div>'
        + '<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span class="price-now prix-promo">' + prix(promo.prixPromo) + '</span>'
        + (nombre(promo.prixNormal) > nombre(promo.prixPromo) ? '<span class="price-old">' + prix(promo.prixNormal) + '</span>' : '') + '</div></div>'
      : '<div style="margin-top:4px"><div class="fc-title">Réservez en ligne</div><div class="fc-sub">Réglez sur place, au retrait</div></div>';
  }
  var stat = document.getElementById('hero-stat-promo');
  var statNum = document.getElementById('hero-stat-promo-num');
  if (stat && statNum) {
    stat.style.display = pct > 0 ? '' : 'none';
    statNum.textContent = pct > 0 ? '-' + pct + '%' : '';
  }
}

// ════ RÉCIT DE L'ACCUEIL ════
// Chapitres remplis avec les données de l'admin : la promo du moment, les rayons, la fidélité
// et l'état d'ouverture du jour. Un chapitre sans contenu est masqué.
var recitAnime = !prefersReducedMotion() && !!window.IntersectionObserver;
var unePromo = null, fidRemplie = false;
// Chiffre de la promo : 'attente' (à 0, prêt à défiler), 'compte' (en train de défiler) ou 'fait'.
// Durée du défilement : 1 seconde, en ralentissant vers la fin pour qu'on voie le chiffre arriver.
var DUREE_COMPTE_UNE = 1000;
var uneAnim = { etat: 'attente', raf: 0 };

function renderRecit() {
  renderUne();
  renderRayons();
  renderFideliteRecit();
  renderAujourdhui();
}

// Chapitre « La promo du moment » : la promo affichée est celle où en est le défilement
var unePromos = [], uneIndex = 0;
function renderUne() {
  var avant = unePromo && unePromo.id;
  unePromos = promosEnAvant();
  var garde = unePromos.findIndex(function(x) { return x.id === avant; });
  uneIndex = garde >= 0 ? garde : (uneIndex < unePromos.length ? uneIndex : 0);
  var p = unePromos[uneIndex] || null;
  unePromo = p;
  renderUneNav();
  document.querySelectorAll('[data-si-promo]').forEach(function(el) { el.style.display = p ? '' : 'none'; });
  var grille = document.getElementById('promos');
  if (grille) grille.style.display = PROMOS.length ? '' : 'none';
  var sec = document.getElementById('a-la-une');
  if (!sec) return;
  sec.hidden = !p;
  if (!p) return;
  var pct = Math.round(nombre(p.pct));
  var prix = function(v) { return nombre(v).toFixed(2).replace('.', ',') + ' €'; };
  var nb = document.getElementById('une-pct');
  nb.setAttribute('data-cible', pct);
  if (!recitAnime || uneAnim.etat === 'fait') nb.textContent = pct;
  document.getElementById('une-reduction').textContent = 'Réduction de ' + pct + ' %';
  document.getElementById('une-nom').textContent = p.nom;
  var fig = document.getElementById('une-photo'), img = document.getElementById('une-img');
  if (fig && img) {
    var u = pharmaPhotoValide(p.photo);
    fig.hidden = !u;
    if (u) {
      if (img.getAttribute('src') !== u) {
        fig.classList.remove('photo-prete');
        img.src = u;
        suivrePhoto(img, function() { fig.hidden = true; });
      }
    } else img.removeAttribute('src');
  }
  document.getElementById('une-prix').textContent = prix(p.prixPromo);
  document.getElementById('une-ancien').textContent = nombre(p.prixNormal) > nombre(p.prixPromo) ? prix(p.prixNormal) : '';
  document.getElementById('une-fin').textContent = p.fin ? 'Jusqu\'au ' + p.fin : '';
  // Promo arrivée alors que le chiffre est déjà à l'écran (chargement depuis la base) : il défile tout de suite
  var geant = sec.querySelector('.une .chap-geant');
  if (recitAnime && uneAnim.etat === 'attente' && geant) {
    var r = geant.getBoundingClientRect();
    if (r.height && r.top < innerHeight && r.bottom > 0) requestAnimationFrame(compterUne);
  }
}

// Le chiffre de la réduction défile de 0 à sa valeur à chaque arrivée du chapitre à l'écran,
// en descendant comme en remontant
function compterUne() {
  var nb = document.getElementById('une-pct');
  var cible = parseInt(nb && nb.getAttribute('data-cible'), 10);
  if (nb && !(cible > 0)) { rackFocus(''); return; }   // rien à compter : tout reste au premier plan
  if (!nb || uneAnim.etat !== 'attente') return;
  uneAnim.etat = 'compte';
  rackFocus('chiffre');
  var debut = null, duree = DUREE_COMPTE_UNE;
  function pas(t) {
    if (uneAnim.etat !== 'compte') return;
    if (debut === null) debut = t;
    var x = Math.min(1, (t - debut) / duree);
    nb.textContent = Math.round(cible * (1 - Math.pow(1 - x, 2)));
    if (x < 1) uneAnim.raf = requestAnimationFrame(pas);
    else { uneAnim.etat = 'fait'; uneAnim.rack = setTimeout(function() { rackFocus('produit'); planifierUneSuivante(); }, 250); }
  }
  nb.textContent = '0';
  uneAnim.raf = requestAnimationFrame(pas);
}
// Le chiffre a quitté l'écran : il repart de 0, prêt à défiler au prochain passage
// Rack focus : la mise au point est sur le chiffre ('chiffre'), puis sur le produit ('produit'), ou neutre ('')
function rackFocus(plan) {
  var sec = document.getElementById('a-la-une');
  if (!sec) return;
  sec.classList.toggle('rack-chiffre', plan === 'chiffre');
  sec.classList.toggle('rack-produit', plan === 'produit');
}
function rearmerUne() {
  cancelAnimationFrame(uneAnim.raf);
  clearTimeout(uneAnim.rack);
  arreterMinuteurUne();
  // Prêt pour le prochain passage : le produit attend déjà en retrait, le chiffre aura la mise au point
  rackFocus('chiffre');
  uneAnim.etat = 'attente';
  var nb = document.getElementById('une-pct');
  if (nb) nb.textContent = '0';
}

// ── DÉFILEMENT DES PROMOS MISES EN AVANT ──
// La promo suivante arrive par la droite, la précédente part vers la gauche. Défilement automatique
// toutes les 5,5 secondes une fois le chiffre arrivé ; il s'interrompt sous la souris, pendant qu'on
// utilise le clavier dans le chapitre, hors de l'écran, et s'arrête dès que le visiteur choisit lui-même
// (flèches, points, glisser au doigt) ou touche « pause ». Animations réduites : pas de défilement automatique.
var DUREE_UNE = 5500;
var uneDefil = { minuteur: 0, survol: false, focus: false, arret: false, glisse: false };
var SVG_UNE = {
  prec: '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
  suiv: '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  lecture: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
};
function defilementAutoPossible() {
  return unePromos.length > 1 && recitAnime && !uneDefil.arret && !uneDefil.survol && !uneDefil.focus && !document.hidden;
}
function arreterMinuteurUne() {
  clearTimeout(uneDefil.minuteur);
  var nav = document.getElementById('une-nav');
  if (nav) nav.classList.remove('defile');
}
function planifierUneSuivante() {
  arreterMinuteurUne();
  if (!defilementAutoPossible() || uneAnim.etat !== 'fait') return;
  var nav = document.getElementById('une-nav');
  if (nav) { void nav.offsetWidth; nav.classList.add('defile'); }   // la jauge du point actif se remplit
  uneDefil.minuteur = setTimeout(function() { changerUne(1); }, DUREE_UNE);
}
function renderUneNav() {
  var nav = document.getElementById('une-nav');
  if (!nav) return;
  var n = unePromos.length;
  nav.hidden = n < 2;
  var sec = document.getElementById('a-la-une');
  if (sec) {
    if (n > 1) sec.setAttribute('aria-roledescription', 'carrousel'); else sec.removeAttribute('aria-roledescription');
  }
  if (n < 2) { arreterMinuteurUne(); return; }
  var points = document.getElementById('une-points');
  if (points && points.children.length !== n) {
    points.innerHTML = unePromos.map(function(p, i) { return '<button type="button" class="une-point" data-i="' + i + '"></button>'; }).join('');
  }
  if (points) Array.prototype.forEach.call(points.children, function(b, i) {
    var p = unePromos[i];
    b.setAttribute('aria-label', 'Promotion ' + (i + 1) + ' sur ' + n + (p ? ' : ' + p.nom : ''));
    if (i === uneIndex) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  var pause = document.getElementById('une-pause');
  if (pause) {
    var arrete = uneDefil.arret || !recitAnime;
    pause.innerHTML = arrete ? SVG_UNE.lecture : SVG_UNE.pause;
    pause.setAttribute('aria-label', arrete ? 'Faire défiler les promotions' : 'Mettre en pause le défilement');
    pause.hidden = !recitAnime;
  }
}
// sens : 1 = suivante (arrive par la droite), -1 = précédente ; cible : numéro précis (points)
function changerUne(sens, cible) {
  var n = unePromos.length;
  if (n < 2 || uneDefil.glisse) return;
  var i = cible != null ? cible : (uneIndex + sens + n) % n;
  if (i === uneIndex) { remettreUneEnPlace(); return; }
  if (cible != null) sens = i > uneIndex ? 1 : -1;
  arreterMinuteurUne();
  var une = document.querySelector('#a-la-une .une');
  function montrer() {
    rearmerUne();
    uneIndex = i;
    unePromo = unePromos[i];
    renderUne();   // le chiffre repart de 0 et défile dès que la promo est à l'écran
  }
  if (!une || !recitAnime) {
    montrer();
    if (une) { une.style.transition = 'none'; une.style.transform = ''; une.style.opacity = ''; }
    return;
  }
  uneDefil.glisse = true;
  une.style.transition = 'transform 0.3s cubic-bezier(0.4,0,1,1), opacity 0.3s';
  une.style.transform = 'translateX(' + (-sens * 70) + 'px)';
  une.style.opacity = '0';
  setTimeout(function() {
    montrer();
    une.style.transition = 'none';
    une.style.transform = 'translateX(' + (sens * 70) + 'px)';
    void une.offsetWidth;
    une.style.transition = 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.45s';
    une.style.transform = '';
    une.style.opacity = '';
    setTimeout(function() { une.style.transition = ''; uneDefil.glisse = false; }, 560);
  }, 300);
}
function remettreUneEnPlace() {
  var une = document.querySelector('#a-la-une .une');
  if (!une) return;
  une.style.transition = 'transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s';
  une.style.transform = '';
  une.style.opacity = '';
}
// Le visiteur choisit lui-même : le défilement automatique s'arrête (il peut le relancer avec le bouton)
function choixVisiteurUne(sens, cible) {
  uneDefil.arret = true;
  renderUneNav();
  changerUne(sens, cible);
}
function initDefilementUne() {
  var sec = document.getElementById('a-la-une');
  var une = sec && sec.querySelector('.une');
  if (!sec || !une) return;
  var prec = document.getElementById('une-prec'), suiv = document.getElementById('une-suiv');
  var points = document.getElementById('une-points'), pause = document.getElementById('une-pause');
  if (prec) { prec.innerHTML = SVG_UNE.prec; prec.addEventListener('click', function() { choixVisiteurUne(-1); }); }
  if (suiv) { suiv.innerHTML = SVG_UNE.suiv; suiv.addEventListener('click', function() { choixVisiteurUne(1); }); }
  if (points) points.addEventListener('click', function(e) {
    var b = e.target.closest('.une-point');
    if (b) choixVisiteurUne(0, parseInt(b.getAttribute('data-i'), 10));
  });
  if (pause) pause.addEventListener('click', function() {
    uneDefil.arret = !uneDefil.arret;
    renderUneNav();
    if (uneDefil.arret) arreterMinuteurUne(); else changerUne(1);
  });
  // Pause sous la souris et pendant l'usage du clavier dans le chapitre
  sec.addEventListener('pointerenter', function(e) { if (e.pointerType === 'mouse') { uneDefil.survol = true; arreterMinuteurUne(); } });
  sec.addEventListener('pointerleave', function(e) { if (e.pointerType === 'mouse') { uneDefil.survol = false; planifierUneSuivante(); } });
  sec.addEventListener('focusin', function() { uneDefil.focus = true; arreterMinuteurUne(); });
  sec.addEventListener('focusout', function(e) { if (!sec.contains(e.relatedTarget)) { uneDefil.focus = false; planifierUneSuivante(); } });
  document.addEventListener('visibilitychange', function() { if (document.hidden) arreterMinuteurUne(); else planifierUneSuivante(); });
  // Glisser au doigt (ou à la souris) : la promo suit, puis passe à la suivante ou revient en place
  var depart = null, glisse = false, dernierX = 0, dernierT = 0, vitesse = 0;
  une.addEventListener('pointerdown', function(e) {
    if (unePromos.length < 2 || uneDefil.glisse || (e.pointerType === 'mouse' && e.button !== 0)) return;
    depart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    glisse = false; dernierX = e.clientX; dernierT = e.timeStamp; vitesse = 0;
  });
  une.addEventListener('pointermove', function(e) {
    if (!depart || e.pointerId !== depart.id) return;
    var dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    if (!glisse) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { depart = null; return; }   // défilement de la page
      if (Math.abs(dx) < 10) return;
      glisse = true;
      try { une.setPointerCapture(e.pointerId); } catch (err) {}
      arreterMinuteurUne();
      une.style.transition = 'none';
      une.classList.add('glisse');
    }
    if (e.timeStamp > dernierT) vitesse = (e.clientX - dernierX) / (e.timeStamp - dernierT);
    dernierX = e.clientX; dernierT = e.timeStamp;
    une.style.transform = 'translateX(' + (dx * 0.9) + 'px)';
    une.style.opacity = String(1 - Math.min(Math.abs(dx) / 520, 0.45));
  });
  function finGlisse(e) {
    if (!depart || (e && e.pointerId !== depart.id)) return;
    var dx = (e ? e.clientX : dernierX) - depart.x;
    depart = null;
    if (!glisse) return;
    une.classList.remove('glisse');
    // Le toucher qui a servi à glisser ne déclenche pas le bouton sous le doigt (s'il y a un clic juste après)
    var bloquer = function(ev) { ev.stopPropagation(); ev.preventDefault(); };
    une.addEventListener('click', bloquer, true);
    setTimeout(function() { une.removeEventListener('click', bloquer, true); glisse = false; }, 350);
    if (Math.abs(dx) > 60 || Math.abs(vitesse) > 0.45) choixVisiteurUne(dx < 0 ? 1 : -1);
    else remettreUneEnPlace();
  }
  une.addEventListener('pointerup', finGlisse);
  une.addEventListener('pointercancel', function(e) { if (depart && e.pointerId === depart.id) { depart = null; une.classList.remove('glisse'); remettreUneEnPlace(); } });
  renderUneNav();
}

// Chapitre « Nos rayons » : les rayons qui ont des produits, dans l'ordre de l'admin ; chacun mène à sa page
var rayonsObserver = null;
function renderRayons() {
  var liste = document.getElementById('rayons-liste');
  var sec = document.getElementById('rayons');
  if (!liste || !sec) return;
  var cats = rayonsAvecProduits().slice(0, 20);
  sec.hidden = cats.length < 2;
  document.querySelectorAll('[data-si-rayons]').forEach(function(el) { el.style.display = cats.length < 2 ? 'none' : ''; });
  liste.classList.toggle('statique', !recitAnime);
  liste.innerHTML = cats.map(function(c) {
    var n = produitsCatalogueDuRayon(c).length;
    var photo = pharmaPhotoRayon(DATA, c);
    // --n : nombre de lettres ; sur téléphone, un nom long (« aromathérapie ») réduit sa taille pour laisser la place à la photo
    return '<li><a class="rayon' + (photo ? ' a-photo' : '') + '" style="--n:' + Math.max(1, String(c).length) + '" href="' + escHtml(lienRayon(c)) + '" data-cat="' + escHtml(c) + '" aria-label="' + escHtml('Rayon ' + c + ', ' + n + ' produit' + (n > 1 ? 's' : '')) + '">'
      + '<span class="rayon-mot">' + escHtml(c) + '</span><span class="rayon-nb" aria-hidden="true">' + n + '</span>'
      + (photo ? '<span class="rayon-photo" aria-hidden="true"><img src="' + escHtml(photo) + '" alt="" loading="lazy" decoding="async" data-photo></span>' : '')
      + '</a></li>';
  }).join('');
  liste.querySelectorAll('.rayon-photo img').forEach(function(img) {
    suivrePhoto(img, function(i, cadre) { var b = cadre.parentNode; cadre.remove(); if (b) b.classList.remove('a-photo'); });
  });
  if (rayonsObserver) liste.querySelectorAll('.rayon').forEach(function(b) { rayonsObserver.observe(b); });
  // Menu du téléphone : un lien par rayon
  var mm = document.getElementById('mm-rayons');
  if (mm) mm.innerHTML = cats.length < 2 ? '' : cats.map(function(c) { return '<a href="' + escHtml(lienRayon(c)) + '">' + escHtml(c) + '</a>'; }).join('');
}

// ════ PAGE D'UN RAYON (site.html?rayon=solaire) ════
// Même page que l'accueil : l'adresse désigne un rayon, l'accueil s'efface et la page du rayon s'affiche.
// L'adresse se partage ; le bouton « retour » du navigateur ramène à l'accueil.
var titreSite = '';
function lienRayon(nom) { return 'site.html?rayon=' + encodeURIComponent(pharmaSlugRayon(nom)); }
function slugAdresse() {
  var m = /[?&]rayon=([^&#]*)/.exec(location.search);
  if (!m) return '';
  try { return decodeURIComponent(m[1]).toLowerCase(); } catch (e) { return ''; }
}
function afficherVue(versHaut) {
  var page = document.getElementById('page-rayon');
  if (!page) return;
  var slug = slugAdresse();
  document.body.classList.toggle('vue-rayon', !!slug);
  page.hidden = !slug;
  if (slug) {
    renderPageRayon();
    if (versHaut) window.scrollTo(0, 0);
  } else {
    if (titreSite) document.title = titreSite;
  }
}
function renderPageRayon() {
  var slug = slugAdresse();
  if (!slug) return;
  var titre = document.getElementById('pr-titre'), sous = document.getElementById('pr-sous');
  var grille = document.getElementById('pr-grille'), photo = document.getElementById('pr-photo');
  var autres = document.getElementById('pr-autres'), blocAutres = document.getElementById('pr-autres-bloc');
  if (!titre || !grille) return;
  var nomPharma = ((DATA.parametres || {}).nom) || '';
  var listeAutres = function(sauf) {
    var cats = rayonsAvecProduits().filter(function(c) { return c !== sauf; });
    blocAutres.hidden = !cats.length;
    autres.innerHTML = cats.map(function(c) { return '<li><a href="' + escHtml(lienRayon(c)) + '">' + escHtml(c) + '</a></li>'; }).join('');
  };
  // Catalogue encore attendu (base de données) : squelette, ou message si le réseau manque
  if (EN_LIGNE && CATALOGUE.length === 0 && ETAT_CLOUD !== 'pret') {
    titre.innerHTML = ETAT_CLOUD === 'chargement' ? '<span class="skel-bar" style="width:5.5em;height:0.8em;border-radius:0.2em" aria-hidden="true"></span>' : '';
    sous.textContent = '';
    photo.hidden = true;
    grille.innerHTML = messageCatalogueCloud();
    blocAutres.hidden = true;
    return;
  }
  var nom = pharmaRayonDepuisSlug(DATA, slug);
  if (nom && !pharmaRayonVisible(DATA, nom)) nom = null;   // rayon masqué depuis l'admin
  if (!nom) {
    titre.textContent = 'Rayon introuvable';
    sous.textContent = 'Ce rayon n\'est plus proposé ou a changé de nom. Choisissez un autre rayon ci-dessous.';
    photo.hidden = true;
    grille.innerHTML = '';
    listeAutres(null);
    document.title = 'Rayon introuvable' + (nomPharma ? ' — ' + nomPharma : '');
    return;
  }
  var produits = produitsCatalogueDuRayon(nom);
  titre.textContent = nom;
  sous.textContent = produits.length ? produits.length + ' produit' + (produits.length > 1 ? 's' : '') + ', à réserver en ligne et à retirer en pharmacie' : '';
  var u = pharmaPhotoRayon(DATA, nom), img = photo.querySelector('img');
  photo.hidden = !u;
  if (u && img.getAttribute('src') !== u) { photo.classList.remove('photo-prete'); img.src = u; suivrePhoto(img, function() { photo.hidden = true; }); }
  grille.innerHTML = produits.length ? produits.map(carteProduitHTML).join('')
    : '<p class="pr-vide">Aucun produit dans ce rayon pour le moment.<br><a href="site.html#catalogue">Voir tout le catalogue</a></p>';
  suivrePhotos(grille);
  observeReveals();
  initTilt();
  listeAutres(nom);
  document.title = nom + (nomPharma ? ' — ' + nomPharma : '');
}
// Liens vers un rayon, et liens de l'accueil (#catalogue…) depuis la page d'un rayon : sans recharger la page
// ── RACCOURCIS VERS UNE SECTION : en fondu ──
// Le défilement automatique traversait toute la page trop vite. À la place : la page s'efface (fondu),
// saute directement à la section, puis réapparaît en fondu. L'en-tête reste en place pendant ce temps.
// avantSaut (facultatif) s'exécute page effacée : changer de vue (page d'un rayon -> accueil) par exemple.
var voileNav = null, minuteurVoile = 0;
// Saut immédiat malgré le défilement doux de la page (html{scroll-behavior:smooth}). La lecture du style
// calculé oblige le navigateur à prendre en compte le changement avant de défiler.
function sansDefilementDoux(fn) {
  var racine = document.documentElement, avant = racine.style.scrollBehavior;
  racine.style.scrollBehavior = 'auto';
  void getComputedStyle(racine).scrollBehavior;
  try { fn(); } finally { racine.style.scrollBehavior = avant; }
}
function allerA(cible, avantSaut) {
  function trouver() { return typeof cible === 'string' ? document.getElementById(cible.replace(/^#/, '')) : cible; }
  function sauter() {
    if (avantSaut) avantSaut();
    var el = trouver();
    if (!el) return;
    sansDefilementDoux(function() { el.scrollIntoView({ block: 'start' }); });
  }
  if (prefersReducedMotion()) { sauter(); return; }
  if (!voileNav) {
    voileNav = document.createElement('div');
    voileNav.className = 'voile-nav';
    voileNav.setAttribute('aria-hidden', 'true');
    document.body.appendChild(voileNav);
  }
  clearTimeout(minuteurVoile);
  voileNav.classList.add('visible');
  minuteurVoile = setTimeout(function() {
    sauter();
    // Une image pour que la page se place, puis elle réapparaît
    requestAnimationFrame(function() { requestAnimationFrame(function() { voileNav.classList.remove('visible'); }); });
  }, 240);
}

function initNavigationRayons() {
  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (/^site\.html\?rayon=[^#&]+$/.test(href)) {
      e.preventDefault();
      history.pushState({ rayon: true }, '', href);
      afficherVue(true);
      if (typeof closeMobileMenu === 'function') closeMobileMenu();
      return;
    }
    if (document.body.classList.contains('vue-rayon') && /^(site\.html)?#[\w-]+$/.test(href)) {
      e.preventDefault();
      var ancre = href.replace(/^site\.html/, '');
      if (typeof closeMobileMenu === 'function') closeMobileMenu();
      allerA(ancre, function() {
        history.pushState({}, '', location.pathname + ancre);
        afficherVue(false);
      });
      return;
    }
    // Lien vers une section de l'accueil (menu, menu du téléphone, pied de page, boutons) : en fondu
    if (/^#[\w-]+$/.test(href)) {
      var cible = document.getElementById(href.slice(1));
      if (!cible || cible.hidden || !cible.getClientRects().length) return;
      e.preventDefault();
      if (typeof closeMobileMenu === 'function') closeMobileMenu();
      try { history.replaceState(history.state, '', href); } catch (err) {}
      allerA(cible);
    }
  });
  window.addEventListener('popstate', function() { afficherVue(false); });
  retrouverPositionSite();
  afficherVue(false);
}

// ── RETOUR DEPUIS L'ADMINISTRATION OU L'ESPACE CLIENT ──
// En quittant le site pour l'admin ou l'espace client (même onglet), la page (accueil ou rayon) et la position
// sont notées ; en revenant dans les 30 minutes, on les retrouve. sessionStorage : propre à l'onglet.
var CLE_POSITION_SITE = 'pharma-site-position';
var positionARetrouver = null;
window.addEventListener('pagehide', function() {
  try { sessionStorage.setItem(CLE_POSITION_SITE, JSON.stringify({ vue: location.search, y: Math.round(window.scrollY || 0), t: Date.now() })); } catch (e) {}
});
function retrouverPositionSite() {
  var ref = document.referrer || '', dossier = location.origin + location.pathname.replace(/[^\/]*$/, '');
  // « .html » facultatif : certains hébergeurs (Cloudflare Pages) l'enlèvent des adresses
  if (ref.indexOf(dossier) !== 0 || !/^(admin|compte)(?:\.html)?(?:[?#]|$)/.test(ref.slice(dossier.length))) return;
  if (location.hash || location.search) return;   // lien précis (section, rayon) : on le respecte
  var n = null;
  try { n = JSON.parse(sessionStorage.getItem(CLE_POSITION_SITE) || 'null'); } catch (e) {}
  if (!n || !(Date.now() - n.t < 30 * 60 * 1000)) return;
  if (/^\?rayon=[^&#]+$/.test(n.vue || '')) history.replaceState(null, '', location.pathname + n.vue);
  positionARetrouver = Math.max(0, parseInt(n.y, 10) || 0);
  replacerPosition();
  window.addEventListener('load', replacerPosition);
  setTimeout(function() { positionARetrouver = null; }, 6000);   // plus tard, le visiteur a déjà bougé
}
// Appelée aussi à l'arrivée du catalogue de la base (la page s'allonge)
function replacerPosition() {
  if (positionARetrouver === null) return;
  var y = positionARetrouver;
  requestAnimationFrame(function() { sansDefilementDoux(function() { window.scrollTo(0, y); }); });
}

// Chapitre « Fidélité » : palier et réduction de l'admin, jauge qui se remplit à l'arrivée
function renderFideliteRecit() {
  var cfg = DATA.parametres || {};
  var seuil = parseInt(cfg.fideliteSeuil, 10) || 5;
  var reduction = parseInt(cfg.fideliteReduction, 10) || 10;
  var titre = document.getElementById('fid-titre');
  if (titre) titre.textContent = seuil + ' achats, -' + reduction + ' %';
  var jauge = document.getElementById('fid-jauge');
  if (!jauge) return;
  var n = Math.min(Math.max(seuil, 1), 12);
  if (jauge.children.length !== n) {
    var html = '';
    for (var i = 0; i < n; i++) html += '<span class="fid-seg' + ((!recitAnime || fidRemplie) ? ' plein' : '') + '"></span>';
    jauge.innerHTML = html;
  }
}
function remplirFidelite() {
  if (fidRemplie) return;
  fidRemplie = true;
  document.querySelectorAll('#fid-jauge .fid-seg').forEach(function(seg, i) {
    setTimeout(function() { seg.classList.add('plein'); }, 140 * i);
  });
}

// Chapitre « Aujourd'hui » : ouvert ou fermé, d'après les horaires et les jours spéciaux de l'admin
function minutesDe(h) { var p = String(h).split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
function horairesDu(d) {
  var iso = pharmaDateLocale(d);
  var special = (DATA.joursSpeciaux || []).find(function(j) { return j && String(j.date || '').slice(0, 10) === iso; }) || null;
  if (special && special.type === 'Fermeture') return { ouvert: false, special: special };
  if (special && heureValide(special.debut) && heureValide(special.fin)) return { ouvert: true, debut: special.debut, fin: special.fin, special: special };
  var h = (DATA.horaires || {})[JOURS_ORDRE[(d.getDay() + 6) % 7]];
  if (h && h.ouvert && heureValide(h.debut) && heureValide(h.fin)) return { ouvert: true, debut: h.debut, fin: h.fin, special: special };
  return { ouvert: false, special: special };
}
function etatOuverture(maintenant) {
  maintenant = maintenant || new Date();
  var jour = horairesDu(maintenant);
  var m = maintenant.getHours() * 60 + maintenant.getMinutes();
  var etat = { ouvert: false, titre: '', suite: '', special: jour.special };
  if (jour.ouvert && m >= minutesDe(jour.debut) && m < minutesDe(jour.fin)) {
    etat.ouvert = true;
    etat.titre = 'Ouvert jusqu\'à ' + formatHeure(jour.fin);
    return etat;
  }
  if (jour.ouvert && m < minutesDe(jour.debut)) {
    etat.titre = 'Ouvre aujourd\'hui à ' + formatHeure(jour.debut);
    return etat;
  }
  etat.titre = (jour.special && jour.special.type === 'Fermeture') ? 'Fermé aujourd\'hui' : 'Fermé';
  for (var k = 1; k <= 7; k++) {
    var d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + k);
    var h = horairesDu(d);
    if (h.ouvert) {
      etat.suite = 'Ouvre ' + (k === 1 ? 'demain' : JOURS_SEMAINE[d.getDay()]) + ' à ' + formatHeure(h.debut);
      break;
    }
  }
  return etat;
}
function renderAujourdhui() {
  var titre = document.getElementById('auj-titre');
  if (!titre) return;
  var cfg = DATA.parametres || {};
  var etat = etatOuverture();
  titre.textContent = etat.titre;
  var pastille = document.querySelector('#auj-etat .auj-pastille');
  if (pastille) pastille.classList.toggle('ferme', !etat.ouvert);
  var suite = document.getElementById('auj-suite');
  if (suite) suite.textContent = etat.suite || ((etat.special && etat.special.type === 'Garde') ? 'Pharmacie de garde aujourd\'hui' : '');
  // Prochain jour spécial (à partir de demain : celui du jour est déjà pris en compte ci-dessus)
  var special = document.getElementById('auj-special');
  if (special) {
    var j = prochainJourSpecial();
    var aVenir = j && String(j.date).slice(0, 10) !== pharmaDateLocale() ? j : null;
    special.hidden = !aVenir;
    special.textContent = aVenir ? texteJourSpecial(aVenir) : '';
  }
  var adresse = document.getElementById('auj-adresse');
  if (adresse) adresse.textContent = cfg.adresse || '';
  var tel = document.getElementById('auj-tel');
  if (tel) {
    tel.style.display = cfg.tel ? '' : 'none';
    tel.textContent = cfg.tel || '';
    tel.href = 'tel:' + String(cfg.tel || '').replace(/[^\d+]/g, '');
  }
  var iti = document.getElementById('auj-itineraire');
  if (iti) {
    iti.style.display = cfg.adresse ? '' : 'none';
    iti.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((cfg.nom ? cfg.nom + ', ' : '') + (cfg.adresse || ''));
  }
}

// Animations du récit, déclenchées par le navigateur à l'arrivée de chaque chapitre
// (aucun calcul pendant le défilement), et coupées si le téléphone demande moins d'animations.
function initRecit() {
  var ajouter = document.getElementById('une-ajouter');
  if (ajouter) ajouter.addEventListener('click', function() {
    var p = unePromo;
    if (p) addToCart(p.id, p.nom, nombre(p.prixPromo), p.icon, p.cat);
  });
  initRaccourci();
  initDefilementUne();
  setInterval(renderAujourdhui, 60000);
  if (!recitAnime) return;
  // Promo : le chiffre défile quand il est bien visible, et recommence après être sorti de l'écran
  var chiffreUne = document.querySelector('#a-la-une .chap-geant');
  if (chiffreUne && uneAnim.etat === 'attente') rackFocus('chiffre');
  if (chiffreUne) new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.intersectionRatio >= 0.5) compterUne();
      else if (!e.isIntersecting) rearmerUne();
    });
  }, { threshold: [0, 0.5] }).observe(chiffreUne);
  // Étapes : le grand chiffre suit l'étape qui passe au milieu de l'écran
  var chiffres = document.querySelectorAll('.etape-chiffre');
  var etapes = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting) return;
      var i = parseInt(e.target.getAttribute('data-etape'), 10);
      chiffres.forEach(function(c, k) { c.classList.toggle('actif', k === i); });
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('.etape[data-etape]').forEach(function(el) { etapes.observe(el); });
  // Rayons : le mot se remplit quand il traverse le milieu de l'écran
  rayonsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { e.target.classList.toggle('actif', e.isIntersecting); });
  }, { rootMargin: '-42% 0px -42% 0px' });
  document.querySelectorAll('#rayons-liste .rayon').forEach(function(b) { rayonsObserver.observe(b); });
  // Fidélité : la jauge se remplit segment par segment, une seule fois
  var fid = document.getElementById('fid-jauge');
  if (fid) new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) remplirFidelite(); });
  }, { threshold: 0.6 }).observe(fid);
}

// Raccourci « Catalogue » : visible pendant le récit, masqué en haut de page, sur le catalogue
// lui-même, au pied de page (il cacherait les liens légaux) et tant que le bandeau des cookies est ouvert
function initRaccourci() {
  var lien = document.getElementById('raccourci-catalogue');
  var hero = document.getElementById('accueil');
  var cat = document.getElementById('catalogue');
  var pied = document.querySelector('footer');
  if (!lien || !hero || !cat || !window.IntersectionObserver) return;
  var heroVu = true, catVu = false, piedVu = false;
  if (pied) new IntersectionObserver(function(e) { piedVu = e[0].isIntersecting; maj(); }).observe(pied);
  function maj() {
    var cookies = document.getElementById('cookie-bar');
    var cookiesOuverts = cookies && cookies.classList.contains('show');
    var visible = !heroVu && !catVu && !piedVu && !cookiesOuverts;
    lien.classList.toggle('visible', visible);
    lien.setAttribute('aria-hidden', visible ? 'false' : 'true');
    lien.tabIndex = visible ? 0 : -1;
  }
  new IntersectionObserver(function(e) { heroVu = e[0].isIntersecting; maj(); }).observe(hero);
  new IntersectionObserver(function(e) { catVu = e[0].isIntersecting; maj(); }, { rootMargin: '-20% 0px -20% 0px' }).observe(cat);
  lien.addEventListener('click', function(ev) {
    ev.preventDefault();
    allerA(cat);
  });
  var cookies = document.getElementById('cookie-bar');
  if (cookies && window.MutationObserver) new MutationObserver(maj).observe(cookies, { attributes: true, attributeFilter: ['class'] });
}


// ── MODAL DÉTAIL PROMO ──
function openPromoDetail(id) {
  var p = PROMOS.find(function(x){ return x.id===id; });
  if (!p) return;
  var modal = document.getElementById('promo-detail-modal');
  if (!modal) return;
  document.getElementById('pd-cat').textContent = p.cat;
  document.getElementById('pd-nom').textContent = p.nom;
  document.getElementById('pd-prix-promo').textContent = nombre(p.prixPromo).toFixed(2).replace('.',',')+'€';
  document.getElementById('pd-prix-normal').textContent = nombre(p.prixNormal).toFixed(2).replace('.',',')+'€';
  document.getElementById('pd-badge').textContent = '-'+p.pct+'%';
  document.getElementById('pd-timer').textContent = 'Jusqu\'au '+p.fin;
  var visuel = document.getElementById('pd-icon');
  visuel.innerHTML = visuelCarte(p);
  visuel.classList.remove('photo-prete');
  visuel.classList.toggle('avec-photo', !!pharmaPhotoValide(p.photo));
  suivrePhotos(visuel);
  // Gestionnaire posé directement (et non par une chaîne de code) : aucune donnée ne peut s'y injecter
  var btnAjout = document.getElementById('pd-add');
  btnAjout.removeAttribute('onclick');
  btnAjout.onclick = function() { addToCart(p.id, p.nom, nombre(p.prixPromo), p.icon, p.cat); closePromoDetail(); };
  modal.classList.add('open');
}
function closePromoDetail() {
  var modal = document.getElementById('promo-detail-modal');
  if (modal) modal.classList.remove('open');
}

function renderPromos() {
  var grid = document.getElementById('promo-grid');
  if (!grid) return;
  var html = '';
  PROMOS.forEach(function(p) {
    html += '<div class="promo-card reveal" data-tilt>';
    html += '<div class="promo-img'+(pharmaPhotoValide(p.photo)?' avec-photo':'')+'" onclick="openPromoDetail(\''+escAttr(p.id)+'\')" style="cursor:pointer" title="Voir la promo">'+visuelCarte(p);
    html += '<span class="promo-discount">-'+escHtml(p.pct)+'%</span>';
    html += '<span class="promo-timer">Jusqu\'au '+escHtml(p.fin)+'</span>';
    html += '<div style="position:absolute;inset:0;background:rgba(0,0,0,0);transition:background 0.25s;display:flex;align-items:center;justify-content:center;opacity:0;font-size:0.78rem;font-weight:700;color:#fff" class="promo-hover-overlay">Voir le détail →</div>';
    html += '</div>';
    html += '<div class="promo-content">';
    html += '<div class="promo-cat">'+escHtml(p.cat)+'</div>';
    html += '<div class="promo-name">'+escHtml(p.nom)+'</div>';
    html += '<div class="promo-prices"><span class="price-now prix-promo">'+nombre(p.prixPromo).toFixed(2).replace('.',',')+'€</span><span class="price-old">'+nombre(p.prixNormal).toFixed(2).replace('.',',')+'€</span></div>';
    html += '<button class="promo-add" onclick="addToCart(\''+escAttr(p.id)+'\',\''+escAttr(p.nom)+'\','+nombre(p.prixPromo)+',\''+escAttr(p.icon)+'\',\''+escAttr(p.cat)+'\')"><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Ajouter au panier</button>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
  suivrePhotos(grid);
  // Effet hover sur image promo
  grid.querySelectorAll('.promo-img').forEach(function(img) {
    var overlay = img.querySelector('.promo-hover-overlay');
    if (!overlay) return;
    img.addEventListener('mouseenter', function() { overlay.style.opacity='1'; overlay.style.background='rgba(0,0,0,0.35)'; });
    img.addEventListener('mouseleave', function() { overlay.style.opacity='0'; overlay.style.background='rgba(0,0,0,0)'; });
  });
  observeReveals();
  initTilt();
}

// ── RENDER CATALOGUE ──
var currentCat = 'Tous';
// Carte d'un produit (catalogue et pages de rayon)
function carteProduitHTML(p) {
  var rupture = p.stock !== undefined && p.stock <= 0;
  var html = '<div class="promo-card reveal" data-tilt>';
  html += '<div class="promo-img'+(pharmaPhotoValide(p.photo)?' avec-photo':'')+'">'+visuelCarte(p);
  if (rupture) html += '<span class="promo-discount" style="background:var(--texte-3)">Rupture de stock</span>';
  html += '</div>';
  html += '<div class="promo-content">';
  html += '<div class="promo-cat">'+escHtml(p.cat)+'</div>';
  html += '<div class="promo-name">'+escHtml(p.nom)+'</div>';
  html += '<div class="promo-prices"><span class="price-now">'+nombre(p.prix).toFixed(2).replace('.',',')+'€</span></div>';
  if (rupture) {
    html += '<button class="promo-add" disabled style="opacity:0.5;cursor:not-allowed">Indisponible</button>';
  } else {
    html += '<button class="promo-add" onclick="addToCart(\''+escAttr(p.id)+'\',\''+escAttr(p.nom)+'\','+nombre(p.prix)+',\''+escAttr(p.icon)+'\',\''+escAttr(p.cat)+'\')"><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Ajouter au panier</button>';
  }
  return html + '</div></div>';
}

// Produits d'un rayon tels qu'affichés (catalogue du site), dans l'ordre choisi dans l'admin
function produitsCatalogueDuRayon(nom) {
  return pharmaProduitsDuRayon(DATA, nom).map(function(p) {
    return CATALOGUE.find(function(x) { return x.produitId === p.id; });
  }).filter(Boolean);
}
// Rayons qui ont au moins un produit, dans l'ordre de l'admin
// Rayons proposés sur le site : ceux qui ont des produits et que l'admin n'a pas masqués
function rayonsAvecProduits() {
  return (DATA.categories || []).filter(function(c) { return pharmaRayonVisible(DATA, c) && produitsCatalogueDuRayon(c).length > 0; });
}

function renderCatalogue() {
  var grid = document.getElementById('catalogue-grid');
  var filters = document.getElementById('cat-filters');
  if (!grid) return;
  var cats = ['Tous'].concat(rayonsAvecProduits());
  if (cats.indexOf(currentCat) === -1) currentCat = 'Tous';
  if (filters) {
    filters.innerHTML = cats.map(function(c){
      return '<button class="cat-filter-btn" onclick="filterCat(\''+escAttr(c)+'\')" style="padding:8px 18px;border-radius:30px;border:1.5px solid '+(c===currentCat?'var(--vert)':'var(--bord)')+';background:'+(c===currentCat?'var(--vert)':'transparent')+';color:'+(c===currentCat?'#fff':'var(--texte-2)')+';font-weight:600;font-size:0.85rem;cursor:pointer;font-family:inherit;transition:all 0.2s">'+escHtml(c)+'</button>';
    }).join('');
  }
  // Filtre d'un rayon : ses produits (rayon principal ou ajoutés), dans l'ordre choisi dans l'admin
  var list = currentCat === 'Tous' ? CATALOGUE : produitsCatalogueDuRayon(currentCat);
  if (EN_LIGNE && CATALOGUE.length === 0 && ETAT_CLOUD !== 'pret') {
    grid.innerHTML = messageCatalogueCloud();
    return;
  }
  grid.innerHTML = list.map(carteProduitHTML).join('');
  suivrePhotos(grid);
  observeReveals();
  initTilt();
}
function filterCat(c) { currentCat = c; renderCatalogue(); }

// ── FAQ ──
function renderFaq() {
  var list = document.getElementById('faq-list');
  if (!list) return;
  var html = '';
  FAQ.forEach(function(f, i) {
    html += '<div class="faq-item" id="faq-'+i+'">';
    html += '<button class="faq-question" onclick="toggleFaq('+i+')" aria-expanded="false">';
    html += '<span>'+escHtml(f.q)+'</span>';
    html += '<span class="faq-icon"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></span>';
    html += '</button>';
    // {A_LA_NOM} : « à la Pharmacie … » d'après le nom saisi dans l'admin
    var reponse = f.a.replace('{A_LA_NOM}', escHtml(PharmaTextes.aLaNom((DATA.parametres || {}).nom)));
    html += '<div class="faq-answer"><div class="faq-answer-inner">'+reponse+'</div></div>';
    html += '</div>';
  });
  list.innerHTML = html;
}
function toggleFaq(i) {
  var item = document.getElementById('faq-'+i);
  if (!item) return;
  var wasOpen = item.classList.contains('open');
  // Accordéon : un seul item ouvert à la fois
  document.querySelectorAll('.faq-item.open').forEach(function(el) {
    el.classList.remove('open');
    el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    var ans = el.querySelector('.faq-answer');
    if (ans) ans.style.maxHeight = null;
  });
  if (!wasOpen) {
    item.classList.add('open');
    item.querySelector('.faq-question').setAttribute('aria-expanded', 'true');
    var ans = item.querySelector('.faq-answer');
    if (ans) ans.style.maxHeight = ans.scrollHeight + 'px';
  }
}

// ── PANIER ──
function addToCart(id, nom, prix, icon, cat) {
  var existing = cart.find(function(item){ return item.id===id; });
  if (existing) { existing.qty++; }
  else { cart.push({ id:id, nom:nom, prix:prix, icon:icon, cat:cat||'Tous', qty:1 }); }
  updateCart();
  pharmaToast(nom+' ajouté au panier', { article: { id: id, icon: icon } });
  // Pulse cart icon
  var btn = document.getElementById('cart-btn');
  if (btn) { btn.style.transform='scale(1.2)'; setTimeout(function(){btn.style.transform='';},200); }
}
function removeFromCart(id) {
  cart = cart.filter(function(item){ return item.id!==id; });
  updateCart();
}
function changeQty(id, delta) {
  var item = cart.find(function(i){ return i.id===id; });
  if (item) { item.qty += delta; if (item.qty <= 0) removeFromCart(id); else updateCart(); }
}
// Sous-total, réduction du code promo et total d'une liste d'articles (le panier, ou sa copie
// gardée pour la confirmation de commande)
function totauxPanier(lignes, promo) {
  var subtotal = lignes.reduce(function(s,i){ return s+i.prix*i.qty; }, 0);
  var discount = 0;
  if (promo) {
    if (promo.scope === 'Tous') {
      discount = subtotal * promo.pct / 100;
    } else {
      // Réduction sur une catégorie spécifique
      var catTotal = lignes.filter(function(i){ return i.cat === promo.scope; }).reduce(function(s,i){ return s+i.prix*i.qty; }, 0);
      discount = catTotal * promo.pct / 100;
    }
  }
  return { subtotal: subtotal, discount: discount, total: subtotal - discount };
}
function euros(v) { return nombre(v).toFixed(2).replace('.', ',') + '€'; }

// Liste des articles avec leur vignette, pour le récapitulatif avant de commander et la confirmation
// montants : total et réduction enregistrés avec la commande (ceux de la base font foi), à la confirmation
function recapArticlesHTML(lignes, promo, montants) {
  var t = totauxPanier(lignes, promo);
  if (montants && isFinite(Number(montants.total))) t = { discount: nombre(montants.remise), total: nombre(montants.total) };
  var nb = lignes.reduce(function(s, i) { return s + nombre(i.qty); }, 0);
  return '<ul class="recap-liste">' + lignes.map(function(i) {
    return '<li class="recap-ligne">' + vignetteArticle(i, 'recap-img') +
      '<span class="recap-nom">' + escHtml(i.nom) + '<small>' + nombre(i.qty) + ' × ' + euros(i.prix) + '</small></span>' +
      '<span class="recap-prix">' + euros(i.prix * i.qty) + '</span></li>';
  }).join('') + '</ul>' +
  (t.discount > 0 ? '<div class="recap-total recap-remise"><span>Réduction' + (promo && promo.code ? ' (' + escHtml(promo.code) + ')' : '') + '</span><span>-' + euros(t.discount) + '</span></div>' : '') +
  '<div class="recap-total"><span>Total, ' + nb + ' article' + (nb > 1 ? 's' : '') + ', à régler au retrait</span><strong>' + euros(t.total) + '</strong></div>';
}
function afficherRecapCommande() {
  var el = document.getElementById('co-recap');
  if (!el) return;
  el.innerHTML = cart.length ? recapArticlesHTML(cart, appliedPromo) : '';
  el.hidden = !cart.length;
  suivrePhotos(el);
}

function updateCart() {
  saveCart();
  var count = cart.reduce(function(s,i){ return s+i.qty; }, 0);
  var totaux = totauxPanier(cart, appliedPromo);
  var discount = totaux.discount;
  var total = totaux.total;
  var countEl = document.getElementById('cart-count');
  if (countEl) { countEl.textContent = count; countEl.style.display = count>0?'flex':'none'; }
  var totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = total.toFixed(2).replace('.',',')+'€';
  // Ligne réduction
  var discRow = document.getElementById('cart-discount-row');
  var discEl = document.getElementById('cart-discount');
  if (discRow && discEl) {
    if (discount > 0) {
      discRow.style.display = 'flex';
      discEl.textContent = '-'+discount.toFixed(2).replace('.',',')+'€';
    } else {
      discRow.style.display = 'none';
    }
  }
  var itemsEl = document.getElementById('cart-items');
  if (itemsEl) {
    if (cart.length === 0) {
      itemsEl.innerHTML = '<div class="cart-empty"><svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;opacity:0.3"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Votre panier est vide</p></div>';
    } else {
      var svgMoins = '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      var svgPlus = '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      var svgRetirer = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      itemsEl.innerHTML = cart.map(function(i){
        var id = escAttr(i.id), nom = escHtml(i.nom);
        return '<div class="cart-item">' + vignetteArticle(i, 'cart-item-img') + '<div class="cart-item-info"><div class="cart-item-name">'+nom+'</div><div class="cart-item-price">'+euros(i.prix)+'</div><div class="cart-qty">' +
          '<button onclick="changeQty(\''+id+'\',-1)" aria-label="Retirer un « '+nom+' »">'+svgMoins+'</button><span>'+nombre(i.qty)+'</span>' +
          '<button onclick="changeQty(\''+id+'\',1)" aria-label="Ajouter un « '+nom+' »">'+svgPlus+'</button>' +
          '<button class="cart-retirer" onclick="removeFromCart(\''+id+'\')" aria-label="Enlever « '+nom+' » du panier">'+svgRetirer+'</button></div></div></div>';
      }).join('');
      suivrePhotos(itemsEl);
    }
  }
  // Formulaire de commande déjà ouvert : son récapitulatif suit le panier (code promo appliqué, etc.)
  var co = document.getElementById('checkout-modal');
  if (co && co.classList.contains('open')) afficherRecapCommande();
}

// ── CODE PROMO ──
function applyPromo() {
  var input = document.getElementById('promo-input');
  var feedback = document.getElementById('promo-feedback');
  var label = document.getElementById('promo-label');
  if (!input) return;
  var code = input.value.trim().toUpperCase();
  if (!code) {
    var zoneEmail = document.getElementById('promo-email-zone');
    if (zoneEmail) zoneEmail.style.display = 'none';
    // Champ vide : si un code était appliqué, c'est une demande de retrait
    if (appliedPromo) {
      appliedPromo = null;
      if (label) label.textContent = '';
      feedback.textContent = 'Code retiré';
      feedback.style.color = 'var(--texte-3)';
      updateCart();
      return;
    }
    feedback.textContent='Entrez un code promo'; feedback.style.color='var(--texte-3)'; return;
  }
  if (cart.length === 0) { feedback.textContent='Votre panier est vide'; feedback.style.color='var(--texte-3)'; return; }
  if (MODE_CLOUD) { appliquerCodeCloud(code, emailConnu()); return; }
  var promo = findCodePromo(code);
  if (!promo || promo.erreur) {
    feedback.textContent = '✕ ' + (promo && promo.erreur ? promo.erreur : 'Code invalide');
    feedback.style.color = '#E55353';
    appliedPromo = null;
    updateCart();
    return;
  }
  // Vérifier si applicable (catégorie présente dans le panier)
  if (promo.scope !== 'Tous') {
    var hasCategory = cart.some(function(i){ return i.cat === promo.scope; });
    if (!hasCategory) {
      feedback.textContent = '✕ Ce code s\'applique aux produits '+promo.scope+', absents de votre panier';
      feedback.style.color = '#E55353';
      appliedPromo = null;
      updateCart();
      return;
    }
  }
  appliedPromo = promo;
  if (label) label.textContent = '('+code+')';
  feedback.textContent = '✓ Code appliqué : '+promo.label;
  feedback.style.color = 'var(--vert)';
  updateCart();
  pharmaToast('Code promo appliqué !');
}
function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

// Lit la valeur d'un champ par son id (chaîne vide si absent)
function getVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

// ── MODE INVITÉ ─────────────────────────────────────────────
// Sort du modal compte et emmène directement le client là où il doit aller :
// au paiement si son panier est prêt, au catalogue sinon.
function continuerEnInvite() {
  var modal = document.getElementById('account-modal');
  if (modal) modal.classList.remove('open');
  if (cart.length > 0) {
    prefillCheckout();
    var checkout = document.getElementById('checkout-modal');
    if (checkout) checkout.classList.add('open');
    pharmaToast('Mode invité — aucun compte nécessaire');
  } else {
    allerA('catalogue');
    pharmaToast('Mode invité activé — ajoutez vos produits au panier');
  }
}

// Pré-remplit le formulaire de commande avec le profil enregistré dans l'espace client,
// pour éviter au client de ressaisir ses coordonnées à chaque commande.
function prefillCheckout() {
  // Appelé à chaque ouverture du formulaire : le récapitulatif montre le panier du moment
  afficherRecapCommande();
  var profil = null;
  try { profil = JSON.parse(localStorage.getItem('pharma-profil') || 'null'); } catch (e) {}
  if (!profil) return;
  var nom = ((profil.prenom||'') + ' ' + (profil.nom||'')).trim();
  var champs = [['co-nom', nom], ['co-email', profil.email], ['co-tel', profil.tel]];
  champs.forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    if (el && !el.value && pair[1]) el.value = pair[1];
  });
}

// Génère un code de réduction unique pour un client ayant atteint le palier.
// Le code est ajouté à DATA.codesPromo : il est donc immédiatement visible
// dans l'admin (page Codes Promo) et utilisable dans le panier.
// Renvoie l'objet code créé ({code, pct, expire, ...}).
function genererCodeFidelite(client, reduction, commandeId, palier) {
  var initiales = (client.nom || 'CL').split(/\s+/).map(function(m){ return m.charAt(0).toUpperCase(); }).join('').slice(0,2) || 'CL';
  var base = 'FID-' + initiales + reduction;
  var code = base;
  var n = 2;
  // Garantit l'unicité si le client atteint le palier plusieurs fois
  while (DATA.codesPromo.some(function(c){ return c.code === code; })) {
    code = base + '-' + n;
    n++;
  }
  var expire = new Date();
  expire.setDate(expire.getDate() + 30); // valable 30 jours
  var obj = {
    code: code,
    client: client.nom,
    clientId: client.id,
    pct: reduction,
    scope: 'Tous',
    origine: 'Auto (fidélité)',
    usages: 0,
    maxUsages: 1,
    expire: pharmaDateLocale(expire),
    actif: true,
    commandeId: commandeId || '',   // commande qui l'a déclenché (annulée = code retiré s'il n'a pas servi)
    palier: palier || 0             // 1er palier, 2e palier... : un seul code par palier
  };
  DATA.codesPromo.push(obj);
  return obj;
}

// Un code créé pour un client précis (fidélité, ou généré à la main pour lui)
// ne peut servir qu'à ce client ; les codes « Tous les clients » sont libres.
function codePourClient(codeObj, client) {
  var dest = codeObj && codeObj.client;
  if (!dest || dest === 'Tous les clients') return true;
  if (!client) return false;
  if (codeObj.clientId !== undefined) return codeObj.clientId === client.id;
  return PharmaClients.normNom(dest) === PharmaClients.normNom(client.nom);
}

// Code de retrait : 6 caractères sans ambiguïté (ni 0/O ni 1/I/L), à présenter
// en pharmacie avec le numéro de commande.
function genererCodeRetrait() {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var existants = DATA.commandes.map(function(c) { return c.codeRetrait; });
  var code, i, tirage;
  do {
    code = '';
    tirage = null;
    try { tirage = new Uint32Array(6); (window.crypto || window.msCrypto).getRandomValues(tirage); } catch (e) { tirage = null; }
    for (i = 0; i < 6; i++) {
      code += alphabet.charAt((tirage ? tirage[i] : Math.floor(Math.random() * alphabet.length)) % alphabet.length);
    }
  } while (existants.indexOf(code) !== -1);
  return code;
}

// ── COMMANDE (persistée dans DATA partagée, visible côté admin) ──
function generateOrderId() {
  var maxNum = 1000;
  DATA.commandes.forEach(function(c) {
    var n = parseInt((c.id || '').replace('#', ''), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  return '#' + (maxNum + 1);
}
// Retrouve le produit DATA.produits correspondant à un article du panier
// (article catalogue : id direct ; article promo : correspondance par nom, cf. matchProduitPourPromo)
// Nombre d'unités du produit contenues dans un article du panier.
// Un lot promo « Lot Crème Solaire SPF50 x3 » consomme 3 unités de stock,
// pas 1 : sans cela le stock réel serait progressivement faussé.
function unitesParArticle(item) {
  if (typeof item.id === 'string' && item.id.indexOf('promo-') === 0) {
    var promoId = parseInt(item.id.replace('promo-', ''), 10);
    var promo = DATA.promos.find(function(p) { return p.id === promoId; });
    if (promo && promo.qte > 0) return promo.qte;
    // Pas de quantité renseignée : on la déduit du libellé (« ... x3 »)
    var m = (item.nom || '').match(/x\s*(\d+)\s*$/i);
    if (m) return parseInt(m[1], 10);
  }
  return 1;
}

function resolveProduitForCartItem(item) {
  // Article venant du catalogue : on a l'id produit directement (ex. "prod-2")
  if (typeof item.id === 'string' && item.id.indexOf('prod-') === 0) {
    var pid = parseInt(item.id.replace('prod-', ''), 10);
    var direct = DATA.produits.find(function(p) { return p.id === pid; });
    if (direct) return direct;
  }
  // Article venant d'une promo (lot) : correspondance approximative sur le nom
  return matchProduitPourPromo(item.nom);
}
function placeOrder() {
  if (cart.length === 0) return false;

  var err = document.getElementById('co-erreur');
  function showErr(msg) {
    if (err) { err.textContent = msg; err.style.display = 'block'; }
    else pharmaToast(msg);
    return false;
  }
  if (err) err.style.display = 'none';

  // Validation des coordonnées saisies dans le formulaire de commande
  var nomSaisi = (getVal('co-nom') || '').trim();
  var emailSaisi = (getVal('co-email') || '').trim();
  var telSaisi = (getVal('co-tel') || '').trim();
  if (!nomSaisi) return showErr('Merci d\'indiquer votre nom complet.');
  if (!pharmaEmailValide(emailSaisi)) return showErr('Merci d\'indiquer une seule adresse email valide.');
  if (!telSaisi || telSaisi.replace(/\D/g, '').length < 9) return showErr('Merci d\'indiquer un numéro de téléphone valide.');
  var cgu = document.getElementById('cgu-checkout');
  if (cgu && !cgu.checked) return showErr('Vous devez accepter les conditions pour commander.');

  // Recharge les données les plus récentes : cette page a pu rester ouverte
  // longtemps pendant que la pharmacie modifiait stocks, prix ou codes. Sans
  // cela, la commande réécrirait par-dessus ces modifications.
  DATA = PharmaStore.load();

  // Le code promo a pu être désactivé ou épuisé depuis qu'il a été appliqué
  var client = PharmaClients.trouver(DATA, nomSaisi, emailSaisi);
  if (appliedPromo && appliedPromo.code) {
    var revalide = findCodePromo(appliedPromo.code);
    if (!revalide || revalide.erreur) {
      appliedPromo = null;
      updateCart();
      return showErr('Le code promo n\'est plus valable' + (revalide && revalide.erreur ? ' (' + revalide.erreur.toLowerCase() + ')' : '') + '. Il a été retiré de votre panier.');
    }
    var codeBrut = DATA.codesPromo.find(function(c){ return c.code === appliedPromo.code; });
    if (codeBrut && !codePourClient(codeBrut, client)) {
      return showErr('Ce code est réservé à son titulaire. Utilisez le nom et l\'adresse email de son compte, ou retirez le code de votre panier.');
    }
  }

  // Vérification du stock disponible avant de valider
  var indisponibles = [];
  cart.forEach(function(item) {
    var p = resolveProduitForCartItem(item);
    var besoin = item.qty * unitesParArticle(item);
    if (p && p.stock < besoin) {
      indisponibles.push(item.nom + ' (reste ' + p.stock + ')');
    }
  });
  if (indisponibles.length) {
    return showErr('Stock insuffisant pour : ' + indisponibles.join(', ') + '. Ajustez votre panier.');
  }

  var produitsStr = cart.map(function(i) { return i.nom + ' x' + i.qty; }).join(' + ');
  var subtotal = cart.reduce(function(s, i) { return s + i.prix * i.qty; }, 0);
  var discount = 0;
  if (appliedPromo) {
    if (appliedPromo.scope === 'Tous') {
      discount = subtotal * appliedPromo.pct / 100;
    } else {
      var catTotal = cart.filter(function(i) { return i.cat === appliedPromo.scope; }).reduce(function(s, i) { return s + i.prix * i.qty; }, 0);
      discount = catTotal * appliedPromo.pct / 100;
    }
  }
  // Arrondi au centime pour éviter les totaux type 44.400000000000006
  var total = Math.round((subtotal - discount) * 100) / 100;

  var now = new Date();
  // On stocke un timestamp ISO complet (triable, avec l'année) EN PLUS de la
  // date lisible : indispensable pour trier, filtrer et générer les rapports.
  var dateStr = ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+' '+now.getHours()+'h'+('0'+now.getMinutes()).slice(-2);
  var timestamp = now.toISOString();

  var clientNom = nomSaisi, clientTel = telSaisi, clientEmail = emailSaisi;

  var numeroCommande = generateOrderId();
  var codeRetrait = genererCodeRetrait();
  var langueClient = (typeof PharmaEmail !== 'undefined') ? PharmaEmail.langueClient() : 'fr';
  var codePromoUtilise = (appliedPromo && appliedPromo.code) ? appliedPromo.code : '';
  var remiseEuros = Math.round(discount * 100) / 100;
  DATA.commandes.push({
    id: numeroCommande, client: clientNom, email: clientEmail, tel: clientTel,
    produits: produitsStr, total: total, date: dateStr, timestamp: timestamp, valide: '', statut: 'En préparation',
    codeRetrait: codeRetrait, lang: langueClient, codePromo: codePromoUtilise, remise: remiseEuros,
    // Détail des articles : permet de remettre exactement le bon stock en cas d'annulation
    lignes: cart.map(function(item) {
      var pr = resolveProduitForCartItem(item);
      return { nom: item.nom, qty: item.qty, unites: unitesParArticle(item), produitId: pr ? pr.id : null };
    })
  });

  // Décrémente le stock des produits commandés
  var alertesStock = [];
  cart.forEach(function(item) {
    var p = resolveProduitForCartItem(item);
    if (p) {
      p.stock = Math.max(0, p.stock - item.qty * unitesParArticle(item));
      // Alerte si le produit passe sous son seuil d'alerte
      if (p.stock <= p.seuil) alertesStock.push(p);
    }
  });

  // Fidélité : incrémente le compteur du client (le crée s'il n'existe pas encore côté admin).
  // Le client est identifié par son email (le nom seul ne suffit pas : deux
  // personnes peuvent porter le même nom).
  if (!client) {
    var newId = DATA.clients.length ? Math.max.apply(null, DATA.clients.map(function(c){ return c.id; })) + 1 : 1;
    client = { id:newId, nom:clientNom, email:clientEmail, tel:clientTel, type:'Compte', notifs:'Email', rgpd:false, achats:0, depenses:0 };
    DATA.clients.push(client);
  } else {
    // Fiche existante : on la complète si une information manquait
    if (!client.email) client.email = clientEmail;
    if (!client.tel) client.tel = clientTel;
  }
  client.achats += 1;
  client.depenses = Math.round((client.depenses + total) * 100) / 100;
  var commandeCreee = DATA.commandes[DATA.commandes.length - 1];
  commandeCreee.clientId = client.id;

  // ── FIDÉLITÉ : génération automatique du code au palier atteint ──
  // Le palier et la réduction sont configurables depuis l'admin (Paramètres).
  var fcfg = PharmaFidelite.config(DATA);
  var seuil = fcfg.seuil;
  var reduction = fcfg.reduction;
  var codeFidelite = null;
  if (PharmaFidelite.progression(client.achats, seuil).atteint) {
    // Un palier ne récompense qu'une fois (commande annulée puis repassée = pas de second code)
    var palier = Math.floor(client.achats / seuil);
    var dejaRecompense = DATA.codesPromo.some(function(c) { return c.clientId === client.id && c.palier === palier; });
    if (!dejaRecompense) codeFidelite = genererCodeFidelite(client, reduction, numeroCommande, palier);
  }

  // Comptabilise l'utilisation du code promo (limite d'usage gérée en admin)
  if (appliedPromo && appliedPromo.code) {
    var codeObj = DATA.codesPromo.find(function(c){ return c.code === appliedPromo.code; });
    if (codeObj) codeObj.usages += 1;
  }

  // ── ALERTES POUR LE BACK-OFFICE (remplacent l'email d'alerte) ──
  pharmaAjouterAlerte(DATA, 'commande',
    'Nouvelle commande ' + numeroCommande,
    clientNom + ' — ' + total.toFixed(2).replace('.', ',') + '€ · ' + produitsStr,
    'commandes');
  alertesStock.forEach(function(p) {
    pharmaAjouterAlerte(DATA, 'stock',
      p.stock === 0 ? 'Rupture de stock' : 'Stock faible',
      p.nom + ' : ' + p.stock + ' unité' + (p.stock > 1 ? 's' : '') + ' restante' + (p.stock > 1 ? 's' : ''),
      'stocks');
  });
  if (codeFidelite) {
    pharmaAjouterAlerte(DATA, 'fidelite',
      'Palier fidélité atteint',
      clientNom + ' a débloqué le code ' + codeFidelite.code + ' (-' + reduction + '%)',
      'codes-promo');
  }

  PharmaStore.save(DATA);

  // ── EMAILS (asynchrones : leur échec n'annule jamais la commande, déjà enregistrée) ──
  var emails = Promise.resolve([]);
  if (typeof PharmaEmail !== 'undefined') {
    try {
      var ctxCommande = {
        id: numeroCommande, client: clientNom, email: clientEmail, produits: produitsStr,
        total: total, timestamp: timestamp, lang: langueClient, codeRetrait: codeRetrait,
        codePromo: codePromoUtilise, remise: remiseEuros
      };
      var ctxFid = { seuil: seuil, reduction: reduction, achats: client.achats };
      var envois = [{ type: 'commandeRecue', data: DATA, ctx: { commande: ctxCommande, fidelite: ctxFid } }];
      if (codeFidelite) {
        envois.push({ type: 'codeFidelite', data: DATA, ctx: { commande: ctxCommande, fidelite: ctxFid,
          code: { code: codeFidelite.code, pct: codeFidelite.pct, expire: codeFidelite.expire } } });
      }
      emails = PharmaEmail.envoyerEnSerie(envois);
    } catch (e) {
      console.warn('Emails non envoyés', e);
    }
  }

  // Rafraîchit l'affichage (stock à jour immédiatement visible)
  buildCatalogueData();
  renderPromos();
  renderCatalogue();

  cart = [];
  appliedPromo = null;
  updateCart();
  return { ok: true, codeFidelite: codeFidelite ? codeFidelite.code : null, codeFidelitePct: reduction,
           total: total, remise: remiseEuros, numero: numeroCommande, codeRetrait: codeRetrait, email: clientEmail, emails: emails };
}

// ════════════════════════════════════════════
// MODE BASE DE DONNÉES (Supabase)
// ════════════════════════════════════════════

// Message affiché à la place du catalogue tant que la base n'a pas répondu
// ════ CHARGEMENT : SQUELETTE ════
// Première visite (aucune copie locale du catalogue) : tant que la base n'a pas répondu, la page montre des
// barres aux formes du contenu. Elles n'apparaissent qu'au-delà de 0,3 s, pour ne rien faire clignoter
// sur une bonne connexion. Aux visites suivantes, la copie locale s'affiche tout de suite.
var squelette = { visible: false, minuteur: null };
function attenteCatalogue() { return EN_LIGNE && ETAT_CLOUD === 'chargement' && CATALOGUE.length === 0; }
function cartesSquelette(n) {
  var carte = '<div class="promo-card skel-carte" aria-hidden="true"><div class="promo-img"></div><div class="promo-content">'
    + '<span class="skel-bar skel-ligne" style="width:34%;height:10px"></span>'
    + '<span class="skel-bar skel-ligne" style="width:82%;height:16px;margin-top:12px"></span>'
    + '<span class="skel-bar skel-ligne" style="width:30%;height:20px;margin-top:14px"></span>'
    + '<span class="skel-bar" style="height:40px;margin-top:16px;border-radius:11px"></span></div></div>';
  var html = '';
  for (var i = 0; i < n; i++) html += carte;
  return html;
}
function afficherSquelette() {
  if (!attenteCatalogue() || squelette.visible) return;
  squelette.visible = true;
  document.documentElement.classList.add('en-chargement');
  var une = document.getElementById('a-la-une');
  if (une) une.hidden = false;
  var rayons = document.getElementById('rayons'), liste = document.getElementById('rayons-liste');
  if (rayons && liste) {
    rayons.hidden = false;
    liste.innerHTML = [62, 48, 70, 40].map(function(l) { return '<li class="rayon-squelette" aria-hidden="true"><span class="skel-bar" style="width:' + l + '%"></span></li>'; }).join('');
  }
  var carte = document.getElementById('hero-promo');
  if (carte) carte.innerHTML = '<span class="skel-bar" style="width:54px;height:22px;border-radius:12px"></span>'
    + '<span class="skel-bar" style="width:80%;height:14px;margin-top:12px"></span><span class="skel-bar" style="width:46%;height:18px;margin-top:9px"></span>';
  renderCatalogue();
  renderPageRayon();
}
function preparerSquelette() {
  clearTimeout(squelette.minuteur);
  if (attenteCatalogue()) squelette.minuteur = setTimeout(afficherSquelette, 300);
}
// Fin de l'attente : le squelette s'efface et le vrai contenu arrive en fondu
function finSquelette(avecFondu) {
  clearTimeout(squelette.minuteur);
  var etaitVisible = squelette.visible;
  squelette.visible = false;
  document.documentElement.classList.remove('en-chargement');
  return function() {
    if (!etaitVisible || !avecFondu) return;
    ['#a-la-une .une', '#rayons-liste', '#catalogue-grid', '#hero-promo'].forEach(function(sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.classList.remove('vient-de-charger');
      void el.offsetWidth;
      el.classList.add('vient-de-charger');
    });
  };
}

// ════ RÉSEAU LENT OU ABSENT ════
// Safari ne donne pas la qualité du réseau aux sites : « connexion lente » = catalogue toujours attendu
// après 3 s ; « pas de réseau » = le navigateur le signale, ou la base ne répond pas. Une pastille en verre
// liquide l'indique avec la croix de la pharmacie qui se remplit, et le site réessaie tout seul.
var reseau = { etat: '', minuteurLent: null, minuteurEssai: null, minuteurMasque: null, delaiEssai: 15000, chargement: null, nbCroix: 0 };
var simuRetabli = false;
function horsLigne() { return navigator.onLine === false || (SIMU === 'coupe' && !simuRetabli); }
var CROIX_TRACE = 'M18 6h12a2 2 0 0 1 2 2v10h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H32v10a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V30H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h10V8a2 2 0 0 1 2-2z';
function svgCroixLiquide(taille, coupe) {
  var id = 'croix-clip-' + (++reseau.nbCroix);
  return '<svg class="croix-liquide' + (coupe ? ' coupe' : '') + '" width="' + taille + '" height="' + taille + '" viewBox="0 0 48 48" aria-hidden="true">'
    + '<defs><clipPath id="' + id + '"><path d="' + CROIX_TRACE + '"/></clipPath></defs>'
    + '<path class="croix-fond" d="' + CROIX_TRACE + '"/>'
    + '<g clip-path="url(#' + id + ')"><g class="croix-niveau"><path class="croix-vague croix-eau" d="M0 24q6-3.5 12 0t12 0t12 0t12 0t12 0t12 0V66H0z"/></g></g>'
    + '<path class="croix-contour" d="' + CROIX_TRACE + '"/></svg>';
}
// Pendule de Newton (pas de connexion) : cinq comprimés blancs, ceux des bouts se renvoient le mouvement
function htmlPendule(grand) {
  return '<span class="pendule ' + (grand ? 'grand' : 'petit') + '" aria-hidden="true">'
    + '<span class="pendule-bille"><i></i></span><span class="pendule-bille"><i></i></span><span class="pendule-bille"><i></i></span>'
    + '<span class="pendule-bille"><i></i></span><span class="pendule-bille"><i></i></span></span>';
}
var ICONE_RESEAU_OK = '<svg class="ok" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
// etat : 'lent' | 'coupe' (pas de catalogue) | 'coupe-cache' (catalogue déjà affiché) | 'essai' (nouvelle tentative)
//        | 'retabli' | '' (masquée)
function afficherEtatReseau(etat) {
  var el = document.getElementById('etat-reseau');
  clearTimeout(reseau.minuteurMasque);
  if (!el) {
    el = document.createElement('div');
    el.id = 'etat-reseau';
    el.className = 'etat-reseau verre';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    document.body.appendChild(el);
  }
  reseau.etat = etat;
  if (!etat) {
    if (el.hidden) return;
    el.classList.add('sortie');
    reseau.minuteurMasque = setTimeout(function() { el.hidden = true; el.classList.remove('sortie'); document.body.classList.remove('reseau-visible'); }, 360);
    return;
  }
  var html;
  if (etat === 'lent') html = svgCroixLiquide(26) + '<span>Connexion lente, le catalogue arrive…</span>';
  else if (etat === 'coupe') html = htmlPendule() + '<span>' + (horsLigne() ? 'Pas de réseau pour le moment' : 'Le catalogue ne répond pas') + '</span><button type="button">Réessayer</button>';
  else if (etat === 'coupe-cache') html = htmlPendule() + '<span>Pas de connexion : le catalogue affiché peut ne pas être à jour</span>';
  else if (etat === 'essai') html = htmlPendule() + '<span>Nouvel essai de connexion…</span>';
  else html = ICONE_RESEAU_OK + '<span>Connexion rétablie</span>';
  el.innerHTML = html;
  var bouton = el.querySelector('button');
  if (bouton) bouton.addEventListener('click', reessayerChargementCloud);
  el.classList.remove('sortie');
  el.hidden = false;
  document.body.classList.add('reseau-visible');
  if (etat === 'retabli') reseau.minuteurMasque = setTimeout(function() { afficherEtatReseau(''); }, 2500);
}
function lancerAttenteLente() {
  clearTimeout(reseau.minuteurLent);
  reseau.minuteurLent = setTimeout(function() { if (attenteCatalogue()) afficherEtatReseau('lent'); }, 3000);
}
// Nouvel essai automatique : 15 s, puis 30 s, puis toutes les minutes (seulement page affichée)
function planifierNouvelEssai() {
  clearTimeout(reseau.minuteurEssai);
  reseau.minuteurEssai = setTimeout(function() {
    if (ETAT_CLOUD !== 'erreur' && reseau.etat !== 'coupe-cache') return;
    if (document.visibilityState === 'hidden') { planifierNouvelEssai(); return; }
    nouvelEssai();
  }, reseau.delaiEssai);
  reseau.delaiEssai = Math.min(reseau.delaiEssai * 2, 60000);
}
function nouvelEssai() {
  if (CATALOGUE.length) chargerDonneesCloud();
  else reessayerChargementCloud();
}
function surveillerReseau() {
  window.addEventListener('online', function() {
    if (ETAT_CLOUD === 'erreur' || reseau.etat === 'coupe' || reseau.etat === 'coupe-cache') { reseau.delaiEssai = 15000; nouvelEssai(); }
  });
  window.addEventListener('offline', function() {
    if (ETAT_CLOUD === 'pret' && CATALOGUE.length) afficherEtatReseau('coupe-cache');
  });
  if (attenteCatalogue()) lancerAttenteLente();
}
// Démonstration : chargement simulé (lent : 6 s ; coupé : échec, puis retour du réseau au nouvel essai)
var essaisSimu = 0;
function chargerSimule() {
  essaisSimu++;
  if (SIMU === 'coupe' && essaisSimu > 1) simuRetabli = true;
  return new Promise(function(ok, ko) {
    if (SIMU === 'coupe' && !simuRetabli) setTimeout(function() { ko(new Error('Connexion au serveur impossible.')); }, 1500);
    else setTimeout(function() { ok(DONNEES_SIMU); }, SIMU === 'lent' ? 6000 : 2500);
  });
}

function messageCatalogueCloud() {
  if (ETAT_CLOUD === 'chargement') return '<p class="vh" role="status">Chargement du catalogue…</p>' + (squelette.visible ? cartesSquelette(6) : '');
  var tel = (infosFiables && DATA.parametres && DATA.parametres.tel) || '';
  var appel = tel ? ', ou appelez la pharmacie au <a href="tel:' + escHtml(tel.replace(/\s+/g, '')) + '">' + escHtml(tel) + '</a>' : '';
  return '<div class="hors-ligne" role="alert">' + htmlPendule(true)
    + '<p class="hors-ligne-titre">' + (horsLigne() ? 'Pas de réseau pour le moment' : 'Le catalogue ne répond pas pour le moment') + '</p>'
    + '<p class="hors-ligne-texte">Le catalogue n\'a pas pu être chargé. Il s\'affichera tout seul dès que la connexion reviendra' + appel + '.</p>'
    + '<button type="button" class="btn-lg btn-primary" onclick="reessayerChargementCloud()">Réessayer</button></div>';
}
function reessayerChargementCloud() {
  if (!CATALOGUE.length) {
    ETAT_CLOUD = 'chargement';
    afficherSquelette();
    renderCatalogue();
    if (reseau.etat === 'coupe') afficherEtatReseau('essai');
    else lancerAttenteLente();
  }
  chargerDonneesCloud();
}

// Lit le catalogue, les promos, les conseils et les réglages dans la base, puis met la page à jour
function chargerDonneesCloud() {
  if (!EN_LIGNE) return Promise.resolve(false);
  if (reseau.chargement) return reseau.chargement;
  if (!SIMU && !PharmaCloud.actif) { ETAT_CLOUD = 'erreur'; renderCatalogue(); return Promise.resolve(false); }
  reseau.chargement = (SIMU ? chargerSimule() : PharmaCloud.chargerPublic()).then(function(d) {
    reseau.chargement = null;
    clearTimeout(reseau.minuteurLent);
    clearTimeout(reseau.minuteurEssai);
    reseau.delaiEssai = 15000;
    if (reseau.etat === 'coupe' || reseau.etat === 'coupe-cache' || reseau.etat === 'essai') afficherEtatReseau('retabli');
    else if (reseau.etat === 'lent') afficherEtatReseau('');
    DATA = d;
    ETAT_CLOUD = 'pret';
    dernierChargementCloud = Date.now();
    infosFiables = true;
    document.documentElement.classList.remove('attente-base');
    var fondu = finSquelette(true);
    rafraichirAffichageCloud();
    fondu();
    return true;
  }, function(e) {
    reseau.chargement = null;
    console.warn('Catalogue non chargé depuis la base :', e && e.message);
    ETAT_CLOUD = 'erreur';
    clearTimeout(reseau.minuteurLent);
    finSquelette(false);
    // Les chapitres remplis par le squelette reprennent leur état (masqués sans données)
    renderAnnonces();
    renderRecit();
    renderCatalogue();
    renderPageRayon();
    afficherEtatReseau(CATALOGUE.length ? 'coupe-cache' : 'coupe');
    planifierNouvelEssai();
    return false;
  });
  return reseau.chargement;
}

var flipCardsLancees = false;
function rafraichirAffichageCloud() {
  applyPharmacyConfig();
  buildCatalogueData();
  renderPromos();
  renderAnnonces();
  renderRecit();
  renderCatalogue();
  renderPageRayon();
  renderConseilsSite();
  renderFaq();
  if (!flipCardsLancees) { flipCardsLancees = true; initFlipCards(); }
  nettoyerPanierCloud();
  replacerPosition();
}

// Le panier gardé d'une visite précédente est remis à jour avec le catalogue de la base :
// prix et noms actuels, articles retirés de la vente enlevés.
function nettoyerPanierCloud() {
  if (!cart.length) return;
  var retires = [];
  var references = CATALOGUE.concat(PROMOS);
  cart = cart.filter(function(item) {
    var ref = references.find(function(x) { return x.id === item.id; });
    if (!ref) { retires.push(item.nom); return false; }
    item.nom = ref.nom;
    item.prix = nombre(ref.prixPromo !== undefined ? ref.prixPromo : ref.prix);
    item.cat = ref.cat;
    item.icon = ref.icon;
    return true;
  });
  updateCart();
  if (retires.length === 1) pharmaToast('« ' + retires[0] + ' » n\'est plus disponible : retiré du panier');
  else if (retires.length > 1) pharmaToast(retires.length + ' articles ne sont plus disponibles : retirés du panier');
}

// Adresse email déjà connue sur cet appareil (formulaire de commande, profil enregistré)
function emailConnu() {
  var candidats = [getVal('co-email'), getVal('promo-email')];
  try {
    var profil = JSON.parse(localStorage.getItem('pharma-profil') || 'null');
    if (profil && profil.email) candidats.push(profil.email);
  } catch (e) {}
  for (var i = 0; i < candidats.length; i++) {
    var e = String(candidats[i] || '').trim();
    if (pharmaEmailValide(e)) return e;
  }
  return '';
}

// Code promo vérifié par le serveur. Un code personnel (fidélité) n'est reconnu qu'avec
// l'adresse email de son titulaire : si aucune adresse n'est connue, on la demande.
var verificationCodeEnCours = false;
function appliquerCodeCloud(code, email) {
  var feedback = document.getElementById('promo-feedback');
  var label = document.getElementById('promo-label');
  var zone = document.getElementById('promo-email-zone');
  if (verificationCodeEnCours || !feedback) return;
  verificationCodeEnCours = true;
  feedback.textContent = 'Vérification du code…';
  feedback.style.color = 'var(--texte-3)';
  PharmaCloud.verifierCode(code, email).then(function(r) {
    verificationCodeEnCours = false;
    if (!r.ok) {
      appliedPromo = null;
      if (label) label.textContent = '';
      updateCart();
      if (!email && r.erreur === 'Code promo invalide' && zone) {
        zone.style.display = 'block';
        feedback.textContent = 'Code non reconnu. S\'il s\'agit d\'un code personnel (fidélité), indiquez l\'adresse email de son titulaire :';
        feedback.style.color = 'var(--texte-2)';
        var champ = document.getElementById('promo-email');
        if (champ) champ.focus();
        return;
      }
      feedback.textContent = '✕ ' + r.erreur;
      feedback.style.color = '#E55353';
      return;
    }
    if (zone) zone.style.display = 'none';
    if (r.scope !== 'Tous' && !cart.some(function(i) { return i.cat === r.scope; })) {
      appliedPromo = null;
      if (label) label.textContent = '';
      updateCart();
      feedback.textContent = '✕ Ce code s\'applique aux produits ' + r.scope + ', absents de votre panier';
      feedback.style.color = '#E55353';
      return;
    }
    appliedPromo = { code: r.code, pct: r.pct, scope: r.scope, label: '-' + r.pct + '%' + (r.scope !== 'Tous' ? ' ' + r.scope : '') };
    // L'adresse qui a validé un code personnel est reprise dans le formulaire de commande
    if (email) {
      var co = document.getElementById('co-email');
      if (co && !co.value) co.value = email;
    }
    if (label) label.textContent = '(' + r.code + ')';
    feedback.textContent = '✓ Code appliqué : ' + appliedPromo.label;
    feedback.style.color = 'var(--vert)';
    updateCart();
    pharmaToast('Code promo appliqué !');
  }, function(e) {
    verificationCodeEnCours = false;
    feedback.textContent = '✕ ' + ((e && e.message) || 'Vérification impossible. Réessayez.');
    feedback.style.color = '#E55353';
  });
}
function verifierCodePersonnel() {
  var feedback = document.getElementById('promo-feedback');
  var code = (getVal('promo-input') || '').trim().toUpperCase();
  var email = (getVal('promo-email') || '').trim();
  if (!code) { applyPromo(); return; }
  if (!pharmaEmailValide(email)) {
    if (feedback) { feedback.textContent = '✕ Indiquez une adresse email valide'; feedback.style.color = '#E55353'; }
    return;
  }
  appliquerCodeCloud(code, email);
}

// Commande enregistrée par le serveur (fonction passer_commande). Le navigateur n'envoie que
// les articles et les quantités : le serveur relit prix, stock et code promo, calcule le total,
// crée la fiche client, décompte le stock et la fidélité. Renvoie une promesse.
function placeOrderCloud() {
  if (cart.length === 0) return Promise.resolve(false);
  var err = document.getElementById('co-erreur');
  function showErr(msg) {
    if (err) { err.textContent = msg; err.style.display = 'block'; }
    else pharmaToast(msg);
    return false;
  }
  if (err) err.style.display = 'none';

  var nomSaisi = (getVal('co-nom') || '').trim().replace(/\s+/g, ' ');
  var emailSaisi = (getVal('co-email') || '').trim();
  var telSaisi = (getVal('co-tel') || '').trim();
  if (nomSaisi.length < 2) return Promise.resolve(showErr('Merci d\'indiquer votre nom complet.'));
  if (!pharmaEmailValide(emailSaisi)) return Promise.resolve(showErr('Merci d\'indiquer une seule adresse email valide.'));
  if (!telSaisi || telSaisi.replace(/\D/g, '').length < 9) return Promise.resolve(showErr('Merci d\'indiquer un numéro de téléphone valide.'));
  var cgu = document.getElementById('cgu-checkout');
  if (cgu && !cgu.checked) return Promise.resolve(showErr('Vous devez accepter les conditions pour commander.'));

  var tel = (infosFiables && DATA.parametres && DATA.parametres.tel) || '';
  if (!PharmaCloud.actif) {
    return Promise.resolve(showErr('Le service de commande est momentanément indisponible.' + (tel ? ' Appelez la pharmacie au ' + tel + '.' : '')));
  }
  var lignes = cart.map(function(item) {
    var m = /^(prod|promo)-(\d+)$/.exec(String(item.id));
    return m ? { type: m[1], id: parseInt(m[2], 10), qty: item.qty } : null;
  });
  if (lignes.some(function(l) { return !l; })) {
    return Promise.resolve(showErr('Un article de votre panier n\'est plus valable. Retirez-le puis ajoutez-le de nouveau depuis le catalogue.'));
  }
  var langue = (typeof PharmaEmail !== 'undefined') ? PharmaEmail.langueClient() : 'fr';
  var codeUtilise = (appliedPromo && appliedPromo.code) ? appliedPromo.code : '';

  return PharmaCloud.passerCommande({ nom: nomSaisi, email: emailSaisi, tel: telSaisi, lignes: lignes, code: codeUtilise, langue: langue })
    .then(function(r) {
      if (!r || r.ok !== true) {
        // Refus lié au code promo (le reste n'a pas été enregistré) : le code est retiré
        appliedPromo = null;
        var label = document.getElementById('promo-label');
        if (label) label.textContent = '';
        var fb = document.getElementById('promo-feedback');
        if (fb) fb.textContent = '';
        updateCart();
        var raison = String((r && r.erreur) || 'code promo refusé');
        return showErr('Le code promo n\'a pas pu être appliqué (' + raison.charAt(0).toLowerCase() + raison.slice(1)
          + '). Il a été retiré : vérifiez le total du panier, puis confirmez de nouveau.');
      }

      var total = nombre(r.total), remise = nombre(r.remise);
      var codeFid = r.code_fidelite && r.code_fidelite.code ? r.code_fidelite : null;

      // ── EMAILS (leur échec n'annule jamais la commande, déjà enregistrée) ──
      var emails = Promise.resolve([]);
      if (typeof PharmaEmail !== 'undefined') {
        try {
          var ctxCommande = {
            id: r.id, client: nomSaisi, email: emailSaisi, produits: r.produits,
            total: total, timestamp: r.created_at, lang: r.lang || langue, codeRetrait: r.code_retrait,
            codePromo: codeUtilise, remise: remise
          };
          var ctxFid = { seuil: r.seuil, reduction: r.reduction, achats: r.achats };
          var envois = [{ type: 'commandeRecue', data: DATA, ctx: { commande: ctxCommande, fidelite: ctxFid } }];
          if (codeFid) {
            envois.push({ type: 'codeFidelite', data: DATA, ctx: { commande: ctxCommande, fidelite: ctxFid,
              code: { code: codeFid.code, pct: codeFid.pct, expire: codeFid.expire } } });
          }
          emails = PharmaEmail.envoyerEnSerie(envois);
        } catch (e) {
          console.warn('Emails non envoyés', e);
        }
      }

      cart = [];
      appliedPromo = null;
      var fb2 = document.getElementById('promo-feedback');
      if (fb2) fb2.textContent = '';
      var champCode = document.getElementById('promo-input');
      if (champCode) champCode.value = '';
      updateCart();
      chargerDonneesCloud();   // stock à jour pour la suite de la visite

      return { ok: true, codeFidelite: codeFid ? codeFid.code : null, codeFidelitePct: codeFid ? codeFid.pct : r.reduction,
               total: total, remise: remise, numero: r.id, codeRetrait: r.code_retrait, email: emailSaisi, emails: emails };
    }, function(e) {
      return showErr((e && e.message) || 'La commande n\'a pas pu être enregistrée. Réessayez.');
    });
}

// ── CONFIRMATION DE COMMANDE ──
// Affiche le numéro et le code de retrait dans la page même : le client les a
// sous les yeux quoi qu'il arrive à l'email (échec d'envoi, spams, adresse erronée).
function afficherConfirmation(res, commande) {
  var modal = document.getElementById('confirm-modal');
  if (!modal) { pharmaToast('Commande enregistrée — code de retrait : ' + res.codeRetrait); return; }
  var set = function(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
  set('conf-num', 'Commande ' + res.numero);
  set('conf-code', res.codeRetrait);
  // Articles commandés, d'après la copie du panier prise au moment de commander (le panier est vidé depuis)
  var recap = document.getElementById('conf-recap');
  if (recap) {
    var lignes = commande && commande.lignes || [];
    recap.innerHTML = lignes.length ? recapArticlesHTML(lignes, commande.promo, { total: res.total, remise: res.remise }) : '';
    recap.hidden = !lignes.length;
    suivrePhotos(recap);
  }
  var fid = document.getElementById('conf-fid');
  if (fid) {
    if (res.codeFidelite) {
      fid.style.display = 'block';
      fid.innerHTML = 'Palier fidélité atteint ! Votre code de réduction de ' + escHtml(res.codeFidelitePct) + ' % : <strong>' + escHtml(res.codeFidelite) + '</strong>';
    } else {
      fid.style.display = 'none';
      fid.innerHTML = '';
    }
  }
  var mail = document.getElementById('conf-mail');
  var avert = 'Notez bien votre numéro de commande et votre code de retrait.';
  if (mail) {
    mail.textContent = 'Envoi de votre email de confirmation…';
    Promise.resolve(res.emails).then(function(resultats) {
      var r = resultats && resultats[0];
      if (r && r.ok) mail.textContent = 'Un email de confirmation a été envoyé à ' + res.email + '.';
      else if (r && r.ignore) mail.textContent = avert;
      else mail.textContent = 'Votre email de confirmation n\'a pas pu être envoyé. ' + avert;
    }, function() { mail.textContent = avert; });
  }
  modal.classList.add('open');
}
function fermerConfirmation() {
  var modal = document.getElementById('confirm-modal');
  if (modal) modal.classList.remove('open');
}

// ── APPARITION AU DÉFILEMENT ──
// Titres et textes (« .reveal ») : apparition en fondu, une seule fois.
// Cartes (promotions, catalogue, « Pourquoi nous choisir ») : effet « volet ».
// La carte se déplie quand elle arrive à l'écran et se replie quand elle en sort complètement,
// pour rejouer l'effet au passage suivant. Les cartes qui arrivent ensemble se déplient l'une
// après l'autre, de gauche à droite. Aucun calcul pendant le défilement : c'est le navigateur
// qui signale l'entrée et la sortie (IntersectionObserver).
var CARTES_VOLET = '.promo-card, .feature';
var revealObserver, revealSortie, voletEntree, voletSortie;
function observeReveals() {
  var cartes = document.querySelectorAll(CARTES_VOLET);
  cartes.forEach(function(c) { if (c.classList.contains('reveal')) c.classList.add('volet'); });
  if (prefersReducedMotion() || !window.IntersectionObserver) {
    document.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('visible', 'volet-ouvert'); });
    return;
  }
  if (!revealObserver) {
    // Les blocs apparaissent à chaque arrivée à l'écran : sortis entièrement, ils se replient pour le passage suivant
    revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    revealSortie = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (!e.isIntersecting) e.target.classList.remove('visible'); });
    }, { threshold: 0 });
    voletEntree = new IntersectionObserver(function(entries) {
      var entrees = entries.filter(function(e) { return e.isIntersecting && !e.target.classList.contains('volet-ouvert'); });
      entrees.sort(function(x, y) {
        return (x.boundingClientRect.top - y.boundingClientRect.top) || (x.boundingClientRect.left - y.boundingClientRect.left);
      });
      entrees.forEach(function(e, i) {
        var el = e.target;
        el.style.transitionDelay = (Math.min(i, 3) * 0.08) + 's';
        el.classList.add('volet-ouvert');
        // Une fois dépliée, la carte réagit sans délai (survol à la souris)
        el.addEventListener('transitionend', function fin() { el.style.transitionDelay = ''; el.removeEventListener('transitionend', fin); });
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    voletSortie = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (!e.isIntersecting) { e.target.style.transitionDelay = '0s'; e.target.classList.remove('volet-ouvert'); }
      });
    }, { threshold: 0 });
  }
  document.querySelectorAll('.reveal:not(.volet)').forEach(function(el) { revealObserver.observe(el); revealSortie.observe(el); });
  document.querySelectorAll('.reveal.volet').forEach(function(el) { voletEntree.observe(el); voletSortie.observe(el); });
}

// ── GYROSCOPE (accéléromètre iPhone/Android) ──

// ── TILT 3D (souris desktop) ──
function initTilt() {
  if (prefersReducedMotion()) return;
  if (('ontouchstart' in window) || window.innerWidth <= 1024) return;
  document.querySelectorAll('[data-tilt]').forEach(function(card) {
    if (card._tiltInit) return;
    card._tiltInit = true;
    card.addEventListener('mousemove', function(e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'translateY(-8px) perspective(800px) rotateY('+(x*8)+'deg) rotateX('+(-y*8)+'deg)';
    });
    card.addEventListener('mouseleave', function() { card.style.transform = ''; });
  });
}

// ── FLIP CARDS AUTO (temps adaptatif au contenu) ──
function readingTime(text) {
  // 200 mots/min = ~3.3 mots/sec → minimum 2.5s, maximum 8s
  var words = (text || '').trim().split(/\s+/).length;
  var ms = Math.max(2500, Math.min(8000, (words / 3.3) * 1000));
  return ms;
}

// ── CONSEILS DE LA PHARMACIE (gérés dans l'admin, page Conseils) ──
// Les cartes animées de l'accueil affichent au verso les conseils actifs, dans l'ordre.
function renderConseilsSite() {
  var actifs = (DATA.conseils || []).filter(function(c) { return c && c.actif && (c.titre || c.texte); });
  document.querySelectorAll('.flip-card').forEach(function(card, i) {
    var back = card.querySelector('.flip-back');
    var c = actifs[i];
    if (!back) return;
    if (!c) {
      card.setAttribute('data-sans-conseil', '1');
      back.style.visibility = 'hidden';
      return;
    }
    card.removeAttribute('data-sans-conseil');
    back.style.visibility = '';
    var couleur = /^#[0-9a-fA-F]{6}$/.test(String(c.couleur || '')) ? c.couleur : '#1B6B45';
    var fonce = (typeof PharmaEmail !== 'undefined' && PharmaEmail.palette) ? PharmaEmail.palette(couleur).fonce : couleur;
    back.style.background = 'linear-gradient(135deg,' + couleur + ',' + fonce + ')';
    var icone = PHARMA_ICONES_CONSEIL[c.icone] || PHARMA_ICONES_CONSEIL.info;
    back.innerHTML = '<div><div class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' + icone + '</svg></div>'
      + '<div class="tip-title">' + escHtml(c.titre) + '</div><div class="tip-text">' + escHtml(c.texte) + '</div></div>';
  });
}

function initFlipCards() {
  var cards = document.querySelectorAll('.flip-card');
  cards.forEach(function(card, i) {
    if (card.getAttribute('data-sans-conseil')) return; // aucun conseil actif pour cette carte : elle ne se retourne pas
    var delay = parseInt(card.getAttribute('data-flip-delay') || 0);
    var backText = card.querySelector('.tip-text');
    var texte = backText ? backText.textContent : '';
    var titre = card.querySelector('.tip-title');
    var titreText = titre ? titre.textContent : '';
    var fullText = titreText + ' ' + texte;
    // Temps côté recto (fixe, 4s) et côté verso (adaptatif au texte)
    var tempsRecto = 4000;
    var tempsVerso = readingTime(fullText);
    var flipped = false;
    var timer;

    function startCycle() {
      // Attendre tempsRecto puis flipper
      timer = setTimeout(function() {
        flipped = true;
        card.classList.add('flipped');
        // Attendre le temps de lecture du verso puis revenir
        timer = setTimeout(function() {
          flipped = false;
          card.classList.remove('flipped');
          startCycle(); // recommencer
        }, tempsVerso);
      }, tempsRecto);
    }

    // Démarrage décalé selon la carte (minuteur mémorisé : un toucher avant le départ l'annule)
    timer = setTimeout(function() { startCycle(); }, delay + 2000 + i * 800);

    // Toucher = flip manuel + reset du cycle
    card.addEventListener('click', function() {
      clearTimeout(timer);
      flipped = !flipped;
      card.classList.toggle('flipped', flipped);
      // Reprendre le cycle automatique après interaction. Le minuteur est mémorisé :
      // plusieurs touchers rapprochés ne lancent pas plusieurs cycles en parallèle.
      timer = setTimeout(function() {
        flipped = false;
        card.classList.remove('flipped');
        startCycle();
      }, flipped ? tempsVerso : tempsRecto);
    });
  });
}


// Inclinaison des cartes du haut au gyroscope : retirée. Sur téléphone, ces cartes sont empilées sans
// transformation (CSS « REPOSITIONNEMENT CARTES MOBILE ») : l'inclinaison ne se voyait plus, mais elle
// demandait sur iPhone l'accès aux capteurs de mouvement et recalculait les cartes 60 fois par seconde.

// ── HERO PARALLAX 3D ──
function initHeroParallax() {
  var visual = document.getElementById('hero-visual');
  if (!visual) return;
  if (prefersReducedMotion()) return;
  visual.addEventListener('mousemove', function(e) {
    var r = visual.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    visual.querySelectorAll('[data-depth]').forEach(function(card) {
      var d = parseFloat(card.getAttribute('data-depth'));
      card.style.transform = card.style.transform.replace(/ translate3d[^)]*\)/g,'') + ' translate3d('+(x*30*d)+'px,'+(y*30*d)+'px,0)';
    });
  });
}

// ── DÉFILEMENT : en-tête, bandeau et profondeur des cartes du haut ──
// Calculé une seule fois par image affichée (requestAnimationFrame). Les cartes du haut
// bougent avec la propriété « translate », qui ne déclenche aucun recalcul de mise en page
// et ne touche pas à leur rotation 3D (gérée par « transform »).
function initScrollParallax() {
  var header = document.getElementById('header');
  var gb = document.getElementById('garde-bar');
  var visual = document.getElementById('hero-visual');
  var cartes = visual ? Array.prototype.slice.call(visual.querySelectorAll('[data-depth]')) : [];
  var profondeurs = cartes.map(function(c) { return parseFloat(c.getAttribute('data-depth')) || 0; });
  var parallaxe = cartes.length && !prefersReducedMotion() && ('translate' in document.documentElement.style);
  // Téléphone et petite tablette : cartes empilées, sans décalage (calculé pendant le défilement, il suivait
  // le doigt avec un temps de retard et se remettait en place d'un coup à l'arrêt)
  var etroit = window.matchMedia ? window.matchMedia('(max-width: 768px)') : { matches: false };
  var enAttente = false, dernierY = -1;
  function majDefilement() {
    enAttente = false;
    var y = window.scrollY || window.pageYOffset || 0;
    if (y === dernierY) return;
    dernierY = y;
    if (header) header.classList.toggle('scrolled', y > 30);
    if (gb) { gb.style.transition = 'transform 0.3s'; gb.style.transform = y > 30 ? 'translateY(-100%)' : 'translateY(0)'; }
    if (parallaxe && y < 900) {
      cartes.forEach(function(c, i) { c.style.translate = etroit.matches ? '' : '0 ' + (y * profondeurs[i] * 0.15).toFixed(1) + 'px'; });
    }
  }
  window.addEventListener('scroll', function() {
    if (!enAttente) { enAttente = true; requestAnimationFrame(majDefilement); }
  }, { passive: true });
  majDefilement();
}

// ── TOAST ──
// options.article : article ajouté au panier, montré par sa vignette (sa photo, sinon l'icône du rayon)
window.pharmaToast = function(msg, options) {
  var c = document.getElementById('toast');
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'toast verre';
  var coche = '<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var article = options && options.article;
  if (article && photoArticle(article.id)) {
    el.classList.add('toast-article');
    el.innerHTML = '<span class="toast-vignette">' + vignetteArticle(article, 'toast-img') + '<span class="toast-coche">' + coche + '</span></span>';
    suivrePhotos(el);
  } else {
    el.innerHTML = coche;
  }
  // Le message est ajouté en texte brut : un nom de produit ne peut pas y injecter de HTML
  el.appendChild(document.createTextNode(String(msg == null ? '' : msg)));
  // Trois messages au plus à l'écran : le plus ancien laisse sa place
  while (c.children.length >= 3) c.removeChild(c.firstChild);
  c.appendChild(el);
  document.body.classList.add('avec-message');
  setTimeout(function() {
    el.classList.add('sortie');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (!c.children.length) document.body.classList.remove('avec-message');
    }, 360);
  }, 2800);
};

// ── MODAL COMPTE ──
function openAccount() { document.getElementById('account-modal').classList.add('open'); }
function closeAccount() { document.getElementById('account-modal').classList.remove('open'); }

// ── INIT ──
window.addEventListener('DOMContentLoaded', function() {
  var cbHaut = document.getElementById('hero-code-barres');
  if (cbHaut) {
    cbHaut.innerHTML = pharmaCodeBarres('FIDELITE', 52, { embleme: 'vitrine' });
    pharmaAjusterCodeBarres(cbHaut);
    window.addEventListener('resize', function() { pharmaAjusterCodeBarres(cbHaut); });
  }
  applyPharmacyConfig();
  initTheme();
  initAmbient();
  renderAnnonces();
  renderRecit();
  initRecit();
  renderPromos();
  renderCatalogue();
  initNavigationRayons();
  renderFaq();
  loadCart();
  updateCart();
  initCookieBar();
  var legalModal = document.getElementById('legal-modal');
  if (legalModal) legalModal.addEventListener('click', function(e){ if (e.target === this) fermerLegal(); });
  observeReveals();
  initHeroParallax();
  initScrollParallax();
  renderConseilsSite();
  // En mode base de données, les cartes ne démarrent qu'avec de vrais conseils
  // (copie locale de la dernière visite, sinon à la réponse de la base)
  if (!MODE_CLOUD || PharmaCloud.depuisCache) { flipCardsLancees = true; initFlipCards(); }
  if (EN_LIGNE) {
    preparerSquelette();
    surveillerReseau();
    chargerDonneesCloud();
  }
  if (MODE_CLOUD) {
    // Retour sur la page après une longue absence : catalogue et stock relus
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && Date.now() - dernierChargementCloud > 5 * 60 * 1000) chargerDonneesCloud();
    });
  }

  // Theme button
  var tb = document.getElementById('theme-btn');
  if (tb) tb.addEventListener('click', toggleTheme);

  // Cart
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);

  // Account
  document.getElementById('account-btn').addEventListener('click', openAccount);
  var abm = document.getElementById('account-btn-m');
  if (abm) abm.addEventListener('click', function(){ closeMobileMenu(); openAccount(); });
  document.getElementById('account-close').addEventListener('click', closeAccount);
  document.getElementById('account-modal').addEventListener('click', function(e){ if(e.target===this) closeAccount(); });
  document.getElementById('fidelite-btn').addEventListener('click', function(){ document.getElementById('tab-signup').click(); openAccount(); });

  // Tabs
  document.getElementById('tab-login').addEventListener('click', function(){
    this.classList.add('active'); document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('login-form').style.display='block'; document.getElementById('signup-form').style.display='none';
  });
  document.getElementById('tab-signup').addEventListener('click', function(){
    this.classList.add('active'); document.getElementById('tab-login').classList.remove('active');
    document.getElementById('login-form').style.display='none'; document.getElementById('signup-form').style.display='block';
  });

  // Checkout
  document.getElementById('checkout-btn').addEventListener('click', function(){
    if (cart.length===0) { pharmaToast('Votre panier est vide'); return; }
    closeCart();
    prefillCheckout();
    document.getElementById('checkout-modal').classList.add('open');
  });
  document.getElementById('checkout-close').addEventListener('click', function(){ document.getElementById('checkout-modal').classList.remove('open'); });
  document.getElementById('checkout-modal').addEventListener('click', function(e){ if(e.target===this) this.classList.remove('open'); });
  var confClose = document.getElementById('conf-close');
  if (confClose) confClose.addEventListener('click', fermerConfirmation);
  var confModal = document.getElementById('confirm-modal');
  if (confModal) confModal.addEventListener('click', function(e){ if (e.target === this) fermerConfirmation(); });
  document.getElementById('confirm-order').addEventListener('click', function(){
    // Protection anti double-clic : sans cela, un client impatient qui clique
    // deux fois créerait deux commandes identiques.
    var btn = this;
    if (btn.disabled) return;
    btn.disabled = true;
    var libelle = btn.textContent;
    btn.textContent = 'Envoi en cours...';
    // Copie du panier commandé, pour la confirmation (le panier est vidé une fois la commande enregistrée)
    var commande = {
      lignes: cart.map(function(i) { return { id: i.id, nom: i.nom, prix: i.prix, icon: i.icon, cat: i.cat, qty: i.qty }; }),
      promo: appliedPromo ? { code: appliedPromo.code, pct: appliedPromo.pct, scope: appliedPromo.scope } : null
    };
    // Mode base de données : la réponse du serveur arrive plus tard (promesse)
    Promise.resolve(MODE_CLOUD ? placeOrderCloud() : placeOrder()).then(function(res) {
      if (res && res.ok) {
        document.getElementById('checkout-modal').classList.remove('open');
        afficherConfirmation(res, commande);
      }
      // Réactivation : immédiate si erreur (le client doit corriger),
      // différée en cas de succès pour laisser le modal se fermer.
      setTimeout(function() {
        btn.disabled = false;
        btn.textContent = libelle;
      }, res && res.ok ? 800 : 300);
    });
  });

  // Mobile menu
  document.getElementById('burger-m').addEventListener('click', function(){ document.getElementById('mobile-menu').classList.add('open'); });
  document.getElementById('mobile-menu-close').addEventListener('click', closeMobileMenu);
  document.querySelectorAll('.mm-link').forEach(function(l){ l.addEventListener('click', closeMobileMenu); });
});

function closeMobileMenu() { document.getElementById('mobile-menu').classList.remove('open'); }

// Touche Échap : ferme la fenêtre ou le panneau ouvert (accessibilité clavier)
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var ouverts = ['confirm-modal', 'checkout-modal', 'account-modal', 'legal-modal', 'promo-detail-modal'];
  for (var i = 0; i < ouverts.length; i++) {
    var m = document.getElementById(ouverts[i]);
    if (m && m.classList.contains('open')) {
      if (ouverts[i] === 'legal-modal' && typeof fermerLegal === 'function') fermerLegal();
      else if (ouverts[i] === 'confirm-modal' && typeof fermerConfirmation === 'function') fermerConfirmation();
      else m.classList.remove('open');
      return;
    }
  }
  var drawer = document.getElementById('cart-drawer');
  if (drawer && drawer.classList.contains('open')) { closeCart(); return; }
  var menu = document.getElementById('mobile-menu');
  if (menu && menu.classList.contains('open')) closeMobileMenu();
});
