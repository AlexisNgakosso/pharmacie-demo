// ============================================================
// PHARMACIE DÉMO — Back-office JS
// ============================================================

// ── DONNÉES PARTAGÉES ───────────────────────────────────────
// DATA vient désormais de data.js (PharmaStore), partagé avec site.html et compte.html via localStorage.
var DATA = PharmaStore.load();

// Sauvegarde DATA dans localStorage — à appeler après chaque modification.
function persist() {
  PharmaStore.save(DATA);
  updateNavBadges();
  if (typeof renderNotifCloche === 'function') renderNotifCloche(false);
}

var currentUser = { nom: 'Admin Principal', role: 'Admin' };
// Mode base de données (cloud-admin.js) : connexion obligatoire, données lues et enregistrées dans Supabase
var ADMIN_CLOUD = (typeof PharmaAdminCloud !== 'undefined') && PharmaAdminCloud.actif;
var currentPage = 'dashboard';

// Échappe une chaîne destinée à être injectée dans un attribut onclick="...('...')".
// Sans cela, un nom contenant une apostrophe (L'Oréal, N'Guyen) casse le HTML généré
// et rend les boutons de la ligne inopérants.
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

// Échappe une chaîne affichée dans du HTML (innerHTML), pour qu'un nom
// contenant < ou > s'affiche tel quel au lieu d'être interprété.
function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Nombre sûr : une valeur manquante ou enregistrée en texte (« 8.40 ») ne fait pas planter l'affichage
function nombre(v) { var n = Number(v); return isFinite(n) ? n : 0; }

// Couleur CSS sûre : seules les couleurs hexadécimales sont acceptées (sinon couleur par défaut),
// pour qu'une valeur saisie ne puisse pas injecter du style ou du code dans un attribut.
function couleurSure(c, defaut) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(c || '')) ? c : (defaut || '#1B6B45');
}

// Abrège un nom en "Prénom N." — tolère un nom en un seul mot ou vide.
function abregerNom(nom) {
  var parts = (nom || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client';
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[1].charAt(0) + '.';
}

// Formate le nom de l'utilisateur courant en "Prénom N." — tolère un nom en un seul mot.
function nomValideur() {
  return abregerNom(currentUser.nom);
}

// ── NORMALISATION (accents/casse) ───────────────────────────
function normalize(str) {
  return (str||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '');
}

function searchMatch(text, query) {
  if (!query) return true;
  var t = normalize(text), q = normalize(query);
  if (t.includes(q)) return true;
  // tolérance partielle
  var words = q.split(' ');
  return words.every(function(w) { return t.includes(w); });
}

// ── NAVIGATION ──────────────────────────────────────────────
var PAGE_META = {
  dashboard:     { title:'Tableau de bord',        cta:null },
  produits:      { title:'Produits',               cta:{ label:'Nouveau produit', fn:'openModal("m-produit")' } },
  rayons:        { title:'Rayons',                 cta:{ label:'Nouveau rayon', fn:'nouveauRayon()' } },
  promos:        { title:'Promotions',             cta:{ label:'Nouvelle promo', fn:'nouvellePromo()' } },
  'codes-promo': { title:'Codes Promo & Fidélité', cta:{ label:'Générer un code', fn:'regenCode()' } },
  conseils:      { title:'Conseils & Raccourcis',  cta:{ label:'Nouveau conseil', fn:'openModal("m-conseil");document.getElementById("cs-id").value=""' } },
  stocks:        { title:'Stocks',                 cta:null },
  commandes:     { title:'Commandes',              cta:null },
  tickets:       { title:'Tickets Support',        cta:null },
  clients:       { title:'Clients',                cta:{ label:'Nouveau client', fn:'openModal("m-client")' } },
  notifications: { title:'Notifications',          cta:null },
  rapport:       { title:'Rapport hebdomadaire',   cta:null },
  scan:          { title:'Validation Scan',        cta:null },
  employes:      { title:'Employés',               cta:{ label:'Nouvel employé', fn:'openModal("m-employe")' } },
  messages:      { title:'Messages internes',      cta:null },
  horaires:      { title:'Horaires & Gardes',      cta:{ label:'Jour spécial', fn:'openModal("m-garde")' } },
  parametres:    { title:'Paramètres',             cta:null }
};

// Dernière page ouverte dans cet onglet : on la retrouve en revenant du site (même onglet, même session).
// sessionStorage : oublié à la fermeture de l'onglet, rien n'est gardé d'une session à l'autre.
var CLE_PAGE_ADMIN = 'pharma-admin-page';
function memoriserPage(id) { try { sessionStorage.setItem(CLE_PAGE_ADMIN, id); } catch (e) {} }
function pageMemorisee() {
  var id = null;
  try { id = sessionStorage.getItem(CLE_PAGE_ADMIN); } catch (e) {}
  return (id && PAGE_META[id] && document.getElementById('page-' + id)) ? id : 'dashboard';
}
// Titre, bouton principal et menu de la page affichée
function majEnTetePage(id) {
  var meta = PAGE_META[id] || { title:id, cta:null };
  document.getElementById('page-title').textContent = meta.title;
  var cta = document.getElementById('topbar-cta');
  var ctaLbl = document.getElementById('topbar-cta-label');
  if (meta.cta) {
    cta.style.display = '';
    ctaLbl.textContent = meta.cta.label;
    cta.setAttribute('onclick', meta.cta.fn);
  } else { cta.style.display = 'none'; }
  document.querySelectorAll('.nav-item').forEach(function(n) {
    var oc = n.getAttribute('onclick') || '';
    n.classList.toggle('active', oc.indexOf("'"+id+"'") !== -1);
  });
}

function go(id) {
  // Vérif accès employé hors horaires
  if (currentUser.role !== 'Admin' && !checkAcces()) {
    showBlocage(); return;
  }
  if (id === currentPage) { if (isMobile()||isTablet()) closeSidebar(); return; }
  var old = document.getElementById('page-' + currentPage);
  if (old) {
    old.style.transition = 'all 0.22s ease';
    old.style.opacity = '0';
    old.style.transform = 'translateX(-16px)';
    setTimeout(function() { old.classList.remove('active'); old.style.cssText = ''; }, 220);
  }
  currentPage = id;
  memoriserPage(id);
  setTimeout(function() {
    var np = document.getElementById('page-' + id);
    if (np) {
      np.style.opacity = '0';
      np.style.transform = 'translateX(16px)';
      np.classList.add('active');
      requestAnimationFrame(function() {
        np.style.transition = 'all 0.25s ease';
        np.style.opacity = '1';
        np.style.transform = 'translateX(0)';
        setTimeout(function() { np.style.cssText = ''; }, 260);
      });
    }
    majEnTetePage(id);
    renderPage(id);
    if (isMobile() || isTablet()) closeSidebar();
  }, 230);
}

// ── RENDER PAGES ────────────────────────────────────────────
function renderPage(id) {
  switch(id) {
    case 'dashboard':   renderDashboard(); break;
    case 'produits':    renderProduits(); break;
    case 'rayons':      renderRayonsAdmin(); break;
    case 'promos':      renderPromos(); break;
    case 'clients':     renderClients(); break;
    case 'commandes':   renderCommandes(); break;
    case 'tickets':     renderTickets(); break;
    case 'employes':    renderEmployes(); break;
    case 'conseils':    renderConseils(); break;
    case 'stocks':      renderStocks(); break;
    case 'codes-promo': renderCodesPromo(); break;
    case 'rapport':     renderRapport(); break;
    case 'notifications': renderNotifications(); break;
    case 'messages':    renderMessages(); break;
    case 'horaires':    renderHoraires(); break;
    case 'parametres':  renderParametres(); break;
    case 'scan':        renderScan(); break;
  }
}

// ── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  var cmdAtt = DATA.commandes.filter(function(c){ return c.statut==='En préparation'; }).length;
  var stockFaible = DATA.produits.filter(function(p){ return p.stock <= p.seuil; }).length;
  var promosActives = DATA.promos.filter(function(p){ return p.statut==='Active'; }).length;
  var ticketsOuverts = DATA.tickets.filter(function(t){ return t.statut==='Ouvert'||t.statut==='En cours'; }).length;
  animCount('stat-commandes', cmdAtt);
  animCount('stat-stocks', stockFaible);
  animCount('stat-promos', promosActives);
  animCount('stat-tickets', ticketsOuverts);
  // Dernières commandes
  var html = '';
  DATA.commandes.slice(0,3).forEach(function(c) {
    var bc = c.statut==='Prête'?'b-green':c.statut==='Retirée'?'b-blue':'b-orange';
    html += '<tr><td><strong>'+escHtml(c.id)+'</strong></td><td><div class="td-main">'+escHtml(abregerNom(c.client))+'</div></td><td><span class="badge '+bc+'">'+escHtml(c.statut)+'</span></td><td><button class="act-btn" onclick="voirCommande(\''+escAttr(c.id)+'\')">'+svgEye()+'</button></td></tr>';
  });
  setHTML('dash-commandes', html);
  // Tickets
  var thtml = '';
  DATA.tickets.slice(0,3).forEach(function(t) {
    var bc = t.priorite==='Urgent'?'b-red pulse':'b-orange';
    thtml += '<tr><td><div class="td-main">'+escHtml(t.sujet)+'</div><div class="td-sub">'+escHtml(t.type)+'</div></td><td>'+escHtml(t.client)+'</td><td><span class="badge '+bc+'">'+escHtml(t.priorite)+'</span></td></tr>';
  });
  setHTML('dash-tickets', thtml);
  renderGardeTableauDeBord();
  renderQuotaTableauDeBord();
  // Messages non lus
  var nonLus = DATA.messages.filter(function(m){ return !m.lu; }).length;
  var msgBadge = document.getElementById('msg-badge');
  if (msgBadge) msgBadge.textContent = nonLus > 0 ? nonLus : '';
  if (msgBadge) msgBadge.style.display = nonLus > 0 ? '' : 'none';
  updateNavBadges();
}

// Encadré « jours spéciaux » du tableau de bord : prochain jour de garde ou de fermeture réel
function renderGardeTableauDeBord() {
  var titre = document.getElementById('dash-garde-titre');
  var texte = document.getElementById('dash-garde-texte');
  if (!titre || !texte) return;
  var auj = pharmaDateLocale();
  var prochains = (DATA.joursSpeciaux || []).filter(function(j){ return j && String(j.date || '').slice(0, 10) >= auj; })
    .sort(function(a, b){ return String(a.date) < String(b.date) ? -1 : 1; });
  var bandeau = DATA.parametres.bandeauActif && DATA.parametres.bandeauMsg ? 'Bandeau actif sur le site' : 'Bandeau du site désactivé';
  if (!prochains.length) {
    titre.textContent = 'Aucun jour spécial à venir';
    texte.textContent = bandeau;
    return;
  }
  var j = prochains[0];
  var d = String(j.date).slice(0, 10).split('-');
  var date = d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : j.date;
  titre.textContent = (j.type === 'Fermeture' ? 'Fermeture exceptionnelle' : (j.type || 'Jour spécial')) + ' — ' + date;
  texte.textContent = (j.type === 'Fermeture' ? 'Pharmacie fermée' : 'Horaires : ' + (j.debut || '?') + ' – ' + (j.fin || '?')) + ' · ' + bandeau;
}

// Badges de la sidebar : reflètent le nombre réel d'éléments nécessitant une action.
function updateNavBadges() {
  var enAttente = DATA.commandes.filter(function(c){ return c.statut === 'En préparation'; }).length;
  var ticketsOuverts = DATA.tickets.filter(function(t){ return t.statut === 'Ouvert' || t.statut === 'En cours'; }).length;
  [['badge-commandes', enAttente], ['badge-tickets', ticketsOuverts]].forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    if (!el) return;
    el.textContent = pair[1];
    el.style.display = pair[1] > 0 ? '' : 'none';
  });
}

// ── PRODUITS ────────────────────────────────────────────────
function renderProduits(filtre, cat) {
  var html = '';
  // Filtre de stock (Normal / Faible / Rupture), mêmes seuils que les badges du tableau
  var stockEl = document.getElementById('filter-stock-produits');
  var etatStock = stockEl ? stockEl.value : '';
  var list = DATA.produits.filter(function(p) {
    var matchSearch = !filtre || searchMatch(p.nom+' '+p.ref+' '+p.cat, filtre);
    var matchCat = !cat || cat === 'Toutes' || p.cat === cat;
    var matchStock = !etatStock
      || (etatStock === 'rupture' && p.stock <= 0)
      || (etatStock === 'faible' && p.stock > 0 && p.stock <= p.seuil)
      || (etatStock === 'ok' && p.stock > p.seuil);
    return matchSearch && matchCat && matchStock;
  });
  if (list.length === 0) {
    html = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--texte-3)">Aucun produit trouvé</td></tr>';
  }
  list.forEach(function(p) {
    var pct = Math.round(p.stock / Math.max(p.stock + p.seuil, 1) * 100);
    var bc = p.stock <= 0 ? 'b-red' : p.stock <= p.seuil ? 'b-or' : 'b-green';
    var label = p.stock <= 0 ? 'Rupture' : p.stock <= p.seuil ? 'Stock faible' : 'Disponible';
    var barColor = p.stock <= 0 ? 'var(--rouge)' : p.stock <= p.seuil ? 'var(--or)' : 'var(--vert-vif)';
    html += '<tr>';
    html += '<td><div class="td-main">'+escHtml(p.nom)+'</div><div class="td-sub">Réf. '+escHtml(p.ref)+'</div></td>';
    html += '<td><span class="badge b-grey">'+escHtml(p.cat)+'</span></td>';
    html += '<td>'+nombre(p.prix).toFixed(2)+'€</td>';
    html += '<td><div class="flex-gap"><span style="min-width:24px;color:'+(p.stock<=0?'var(--rouge)':p.stock<=p.seuil?'var(--or)':'')+'">'+p.stock+'</span><div class="progress" style="width:70px"><div class="progress-fill" style="width:'+Math.min(pct,100)+'%;background:'+barColor+'"></div></div></div></td>';
    html += '<td><span class="badge '+bc+'">'+label+'</span></td>';
    html += '<td class="actions-cell"><div><button class="act-btn" onclick="editProduit('+p.id+')" title="Modifier">'+svgEdit()+'</button><button class="act-btn" onclick="nouvellePromo(\''+escAttr(p.nom)+'\')" title="Créer promo">'+svgTag()+'</button><button class="act-btn" style="color:var(--rouge)" onclick="deleteProduit('+p.id+',\''+escAttr(p.nom)+'\')" title="Supprimer">'+svgTrash()+'</button></div></td>';
    html += '</tr>';
  });
  setHTML('tbody-produits', html);
  // Mettre à jour les catégories du filtre
  renderCatOptions('filter-cat-produits');
}

// Alimente un <select> de catégories.
// avecToutes : true pour un filtre (ajoute « Toutes catégories »),
// false pour un formulaire de saisie — sinon un produit pourrait être
// enregistré avec la catégorie littérale « Toutes », qui n'existe pas
// et le rendrait introuvable dans les filtres du catalogue client.
function renderCatOptions(elId, avecToutes) {
  var el = document.getElementById(elId);
  if (!el) return;
  var val = el.value;
  el.innerHTML = (avecToutes === false) ? '' : '<option value="Toutes">Toutes catégories</option>';
  DATA.categories.forEach(function(c) {
    el.innerHTML += '<option value="'+escAttr(c)+'"'+(val===c?' selected':'')+'>'+escHtml(c)+'</option>';
  });
}

function editProduit(id) {
  var p = DATA.produits.find(function(x){ return x.id===id; });
  if (!p) return;
  setVal('p-nom', p.nom); setVal('p-ref', p.ref);
  setVal('p-prix', p.prix); setVal('p-stock', p.stock);
  setVal('p-seuil', p.seuil); setVal('p-desc', p.desc);
  var catSel = document.getElementById('p-cat');
  if (catSel) catSel.value = p.cat;
  document.getElementById('p-id').value = id;
  document.getElementById('m-produit-title').textContent = 'Modifier — ' + p.nom;
  reinitialiserPhotoProduit();
  majChampPhotoProduit(p.photo);
  openModal('m-produit');
}

function saveProduit() {
  var id = parseInt(document.getElementById('p-id').value);
  var nom = getVal('p-nom');
  var newCat = getVal('p-new-cat').trim();
  var cat = newCat || getVal('p-cat');
  if (newCat && !DATA.categories.includes(newCat)) DATA.categories.push(newCat);
  if (!nom || !nom.trim()) { toast('Le nom est obligatoire', 'error'); return; }
  nom = nom.trim();
  var prix = parseFloat(String(getVal('p-prix')).replace(',', '.'));
  var stockSaisi = getVal('p-stock') === '' ? 0 : Number(getVal('p-stock'));
  var seuilSaisi = getVal('p-seuil') === '' ? 10 : Number(getVal('p-seuil'));
  if (!isFinite(prix) || prix <= 0) { toast('Indiquez un prix supérieur à 0', 'error'); return; }
  if (!Number.isInteger(stockSaisi) || stockSaisi < 0) { toast('Le stock doit être un nombre entier positif ou nul', 'error'); return; }
  if (!Number.isInteger(seuilSaisi) || seuilSaisi < 0) { toast('Le seuil d\'alerte doit être un nombre entier positif ou nul', 'error'); return; }
  prix = Math.round(prix * 100) / 100;
  if (DATA.produits.some(function(x){ return x.id !== id && String(x.nom).trim().toLowerCase() === nom.toLowerCase(); })) {
    toast('Un produit porte déjà ce nom', 'error'); return;
  }
  if (photoProduit.envoi) { toast('Patientez : la photo est en cours d\'envoi', 'error'); return; }
  var photo = pharmaPhotoValide(getVal('p-photo'));
  var cible = null, anciennePhoto = '';
  if (id) {
    var p = DATA.produits.find(function(x){ return x.id===id; });
    if (p) { anciennePhoto = p.photo || ''; p.nom=nom; p.ref=getVal('p-ref'); p.cat=cat; p.prix=prix; p.stock=stockSaisi; p.seuil=seuilSaisi; p.desc=getVal('p-desc'); p.photo=photo; cible = p; }
  } else {
    var newId = DATA.produits.length ? Math.max.apply(null, DATA.produits.map(function(x){return x.id;})) + 1 : 1;
    cible = { id:newId, nom:nom, ref:getVal('p-ref'), cat:cat, prix:prix, stock:stockSaisi, seuil:seuilSaisi, desc:getVal('p-desc'), photo:photo };
    DATA.produits.push(cible);
  }
  // Mode démonstration : mémoire du navigateur pleine, le produit est gardé sans la nouvelle photo
  var sansPhoto = false;
  if (!ADMIN_CLOUD && cible && photo && photo !== anciennePhoto && !PharmaStore.save(DATA)) {
    cible.photo = anciennePhoto; sansPhoto = true;
  }
  if (sansPhoto) toast('Produit enregistré sans la photo : la mémoire de ce navigateur est pleine', 'error');
  else toast(id ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');
  closeModal('m-produit');
  renderProduits();
  resetForm('form-produit');
  persist();
}

function deleteProduit(id, nom) {
  confirmer('Supprimer le produit "'+escHtml(nom)+'" ?', function() {
    DATA.produits = DATA.produits.filter(function(p){ return p.id !== id; });
    // Le produit sort aussi des rayons où il avait été ajouté
    Object.keys(DATA.contenuRayons || {}).forEach(function(c) {
      if (Array.isArray(DATA.contenuRayons[c])) DATA.contenuRayons[c] = DATA.contenuRayons[c].filter(function(x) { return x !== id; });
    });
    renderProduits();
    toast(nom+' supprimé');
    persist();
  });
}

// ── PHOTOS DES PRODUITS ET DES RAYONS ───────────────────────
// La photo choisie (ou prise avec le téléphone) est réduite dans le navigateur avant l'envoi :
// une photo de 4 Mo devient un fichier d'environ 100 Ko, affiché rapidement sur le site.
//  * mode base de données : elle est envoyée dans le dossier « photos » de Supabase ;
//  * mode démonstration : elle est gardée dans ce navigateur (place limitée).
var PHOTO_LOCAL_TOTAL_MAX = 2500000;   // démonstration : il faut laisser de la place aux commandes
var SVG_PHOTO = '<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
function photoCloud() { return ADMIN_CLOUD; }

function redimensionnerPhoto(fichier, cote, qualite) {
  return new Promise(function(ok, ko) {
    if (!fichier || !/^image\//.test(fichier.type || '')) { ko(new Error('Choisissez une image (photo JPEG, PNG ou WebP).')); return; }
    if (fichier.size > 25 * 1024 * 1024) { ko(new Error('Image trop lourde (25 Mo au maximum).')); return; }
    var adresse = URL.createObjectURL(fichier);
    var img = new Image();
    img.onload = function() {
      URL.revokeObjectURL(adresse);
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { ko(new Error('Image illisible.')); return; }
      var r = Math.min(1, cote / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * r));
      c.height = Math.max(1, Math.round(h * r));
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';               // fond blanc pour les images transparentes (PNG)
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ok(c);
    };
    img.onerror = function() { URL.revokeObjectURL(adresse); ko(new Error('Format d\'image non reconnu : utilisez une photo JPEG, PNG ou WebP.')); };
    img.src = adresse;
  });
}

// Place occupée par les photos gardées dans le navigateur (mode démonstration)
function poidsPhotosLocales(sauf) {
  var total = 0;
  (DATA.produits || []).forEach(function(p) { if (p.photo && p.photo !== sauf && /^data:/.test(p.photo)) total += p.photo.length; });
  Object.keys(DATA.photosRayons || {}).forEach(function(k) { var v = DATA.photosRayons[k]; if (v && v !== sauf && /^data:/.test(v)) total += String(v).length; });
  return total;
}

// Prépare la photo et renvoie son adresse (promesse). remplace : photo actuelle, qui libère sa place.
function preparerPhoto(fichier, dossier, remplace) {
  if (photoCloud()) {
    return redimensionnerPhoto(fichier, 1000, 0.82).then(function(c) {
      return new Promise(function(ok, ko) {
        c.toBlob(function(b) { b ? ok(b) : ko(new Error('Conversion de la photo impossible.')); }, 'image/jpeg', 0.82);
      });
    }).then(function(b) { return b.arrayBuffer(); }).then(function(octets) {
      return PharmaAdminCloud.envoyerPhoto(octets, dossier);
    });
  }
  return redimensionnerPhoto(fichier, 640, 0.78).then(function(c) {
    var url = c.toDataURL('image/jpeg', 0.78);
    if (!pharmaPhotoValide(url)) url = c.toDataURL('image/jpeg', 0.55);
    if (!pharmaPhotoValide(url)) throw new Error('Photo trop détaillée : essayez une autre image.');
    if (poidsPhotosLocales(remplace) + url.length > PHOTO_LOCAL_TOTAL_MAX) {
      throw new Error('Mode démonstration : la place réservée aux photos dans ce navigateur est pleine. Retirez une photo, ou reliez le site à la base de données.');
    }
    return url;
  });
}

function afficherApercuPhoto(el, url, avecAlt) {
  if (!el) return;
  var u = pharmaPhotoValide(url);
  el.innerHTML = '';
  if (!u) { el.innerHTML = SVG_PHOTO; return; }
  var img = document.createElement('img');
  img.alt = avecAlt || '';
  img.src = u;
  el.appendChild(img);
}

// Champ « Photo du produit » de la fenêtre Produit
var photoProduit = { jeton: 0, envoi: false };
function etatPhotoProduit(msg, erreur) {
  var el = document.getElementById('p-photo-etat');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('erreur', !!erreur);
}
function majChampPhotoProduit(url) {
  var u = pharmaPhotoValide(url);
  setVal('p-photo', u);
  afficherApercuPhoto(document.getElementById('p-photo-apercu'), u);
  var retirer = document.getElementById('p-photo-retirer');
  if (retirer) retirer.hidden = !u;
  var txt = document.getElementById('p-photo-choisir-txt');
  if (txt) txt.textContent = u ? 'Changer la photo' : 'Ajouter une photo';
}
function reinitialiserPhotoProduit() {
  photoProduit.jeton++;
  photoProduit.envoi = false;
  majChampPhotoProduit('');
  etatPhotoProduit('Photo sur fond blanc de préférence. Elle est réduite automatiquement.');
  var a = document.getElementById('p-photo-apercu');
  if (a) a.classList.remove('charge');
}
function choisirPhotoProduit(fichier) {
  if (!fichier) return;
  var jeton = ++photoProduit.jeton;
  var avant = getVal('p-photo');
  photoProduit.envoi = true;
  var apercu = document.getElementById('p-photo-apercu');
  if (apercu) apercu.classList.add('charge');
  etatPhotoProduit(photoCloud() ? 'Envoi de la photo…' : 'Préparation de la photo…');
  preparerPhoto(fichier, 'produits', avant).then(function(url) {
    if (jeton !== photoProduit.jeton) return;   // fenêtre fermée ou autre photo choisie entre-temps
    photoProduit.envoi = false;
    if (apercu) apercu.classList.remove('charge');
    majChampPhotoProduit(url);
    etatPhotoProduit('Photo prête : cliquez sur Sauvegarder pour l\'enregistrer.');
    verifierAffichagePhoto(apercu, etatPhotoProduit);
  }, function(e) {
    if (jeton !== photoProduit.jeton) return;
    photoProduit.envoi = false;
    if (apercu) apercu.classList.remove('charge');
    etatPhotoProduit('Photo non ajoutée : ' + ((e && e.message) || 'erreur inconnue'), true);
  });
}
// Mode base de données : la photo envoyée doit pouvoir s'afficher (dossier « photos » public)
function verifierAffichagePhoto(conteneur, signaler) {
  var img = conteneur && conteneur.querySelector('img');
  if (!img || !photoCloud()) return;
  img.addEventListener('error', function() {
    signaler('La photo est envoyée mais ne s\'affiche pas : dans Supabase, menu Storage, le dossier « photos » doit être public (Edit bucket, Public bucket).', true);
  }, { once: true });
}

// Photos des rayons : gérées dans la page Rayons (une photo par rayon, affichée sur l'accueil)
var photoRayons = { envoi: {} };
function renderPhotosRayons() { if (typeof renderRayonsAdmin === 'function') renderRayonsAdmin(); }
function etatTuileRayon(cat, msg, erreur) {
  var i = (DATA.categories || []).indexOf(cat);
  var el = document.querySelector('#liste-rayons .rayon-ligne[data-index="' + i + '"] .photo-etat');
  if (!el) return;
  el.textContent = msg; el.classList.toggle('erreur', !!erreur);
}
function choisirPhotoRayon(cat, fichier) {
  photoRayons.envoi[cat] = true;
  renderPhotosRayons();
  etatTuileRayon(cat, photoCloud() ? 'Envoi de la photo…' : 'Préparation de la photo…');
  preparerPhoto(fichier, 'rayons', pharmaPhotoRayon(DATA, cat)).then(function(url) {
    delete photoRayons.envoi[cat];
    enregistrerPhotoRayon(cat, url);
  }, function(e) {
    delete photoRayons.envoi[cat];
    renderPhotosRayons();
    etatTuileRayon(cat, 'Photo non ajoutée : ' + ((e && e.message) || 'erreur inconnue'), true);
  });
}
function enregistrerPhotoRayon(cat, url) {
  if ((DATA.categories || []).indexOf(cat) === -1) { renderPhotosRayons(); return; }   // rayon supprimé entre-temps
  if (!DATA.photosRayons || typeof DATA.photosRayons !== 'object') DATA.photosRayons = {};
  var avant = DATA.photosRayons[cat];
  if (url) DATA.photosRayons[cat] = url; else delete DATA.photosRayons[cat];
  if (!photoCloud() && !PharmaStore.save(DATA)) {
    if (avant) DATA.photosRayons[cat] = avant; else delete DATA.photosRayons[cat];
    renderPhotosRayons();
    etatTuileRayon(cat, 'Photo non enregistrée : la mémoire de ce navigateur est pleine.', true);
    return;
  }
  persist();
  renderPhotosRayons();
  toast(url ? 'Photo du rayon ' + cat + ' enregistrée' : 'Photo du rayon ' + cat + ' retirée');
}

document.addEventListener('DOMContentLoaded', function() {
  var f = document.getElementById('p-photo-fichier');
  if (f) f.addEventListener('change', function() {
    if (f.files && f.files[0]) choisirPhotoProduit(f.files[0]);
    f.value = '';   // la même photo peut être choisie à nouveau
  });
  var r = document.getElementById('p-photo-retirer');
  if (r) r.addEventListener('click', function() {
    photoProduit.jeton++;
    photoProduit.envoi = false;
    majChampPhotoProduit('');
    etatPhotoProduit('Photo retirée : cliquez sur Sauvegarder pour confirmer.');
  });
  reinitialiserPhotoProduit();
});
document.addEventListener('pharma-edition-fermee', function(ev) {
  if (ev.detail === 'm-produit') reinitialiserPhotoProduit();
});

// ── RAYONS : ordre, nom, photo et produits ──────────────────
// L'ordre des rayons est celui du site (accueil, menu, filtres du catalogue). Chaque rayon a sa page sur
// le site. Un produit est toujours dans son rayon principal (fenêtre du produit) et peut être ajouté à
// d'autres rayons ici. L'ordre des produits d'un rayon est celui de sa page.
var rayonOuvert = null;
var rechercheAjoutRayon = '';
var SVG_POIGNEE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
var SVG_PHOTO_PETIT = '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
var SVG_CHEVRON = '<svg class="chevron" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

function nomRayonValide(nom, ancien) {
  var n = String(nom == null ? '' : nom).trim().replace(/\s+/g, ' ');
  if (!n) return { erreur: 'Indiquez le nom du rayon' };
  if (n.length > 60) return { erreur: 'Le nom du rayon fait 60 caractères au plus' };
  if ((DATA.categories || []).some(function(c) { return c !== ancien && c.toLowerCase() === n.toLowerCase(); })) return { erreur: 'Un rayon porte déjà ce nom' };
  return { nom: n };
}

function renderRayonsAdmin() {
  var ul = document.getElementById('liste-rayons');
  if (!ul) return;
  var cats = DATA.categories || [];
  if (rayonOuvert && cats.indexOf(rayonOuvert) === -1) rayonOuvert = null;
  if (!cats.length) { ul.innerHTML = '<li class="rayons-aide">Aucun rayon pour l\'instant : créez-en un avec « Nouveau rayon ».</li>'; return; }
  var focusVisible = document.activeElement && document.activeElement.getAttribute('data-action') === 'visible'
    ? document.activeElement.closest('.rayon-ligne').getAttribute('data-index') : null;
  ul.innerHTML = cats.map(function(c, i) {
    var n = pharmaProduitsDuRayon(DATA, c).length;
    var ouvert = c === rayonOuvert, enCours = !!photoRayons.envoi[c];
    var visible = pharmaRayonVisible(DATA, c);
    var etat = (n ? n + ' produit' + (n > 1 ? 's' : '') : 'Aucun produit') + (!visible ? ' · masqué sur le site' : (n ? '' : ' : pas encore sur le site'));
    return '<li class="rayon-ligne' + (ouvert ? ' ouvert' : '') + (visible ? '' : ' masque') + '" data-index="' + i + '">'
      + '<div class="rayon-tete">'
      + '<button type="button" class="poignee" aria-label="' + escHtml('Déplacer le rayon ' + c + ' : glisser, ou flèches haut et bas') + '">' + SVG_POIGNEE + '</button>'
      + '<div class="photo-apercu' + (enCours ? ' charge' : '') + '" aria-hidden="true"></div>'
      + '<button type="button" class="rayon-ouvrir" aria-expanded="' + ouvert + '"><strong>' + escHtml(c) + '</strong><span>' + etat + '</span></button>'
      + '<div class="rayon-actions">'
      + '<label class="toggle-wrap toggle-acc rayon-visible" title="Afficher ce rayon sur le site"><input type="checkbox" class="toggle-input" data-action="visible"' + (visible ? ' checked' : '') + ' aria-label="' + escHtml('Afficher le rayon ' + c + ' sur le site') + '"><span class="toggle-track"></span><span class="toggle-txt">Sur le site</span></label>'
      + '<label class="btn btn-ghost photo-choisir" title="Photo du rayon"><input type="file" class="vh-input" accept="image/*" aria-label="' + escHtml('Photo du rayon ' + c) + '"' + (enCours ? ' disabled' : '') + '>' + SVG_PHOTO_PETIT + '<span>' + (enCours ? 'Envoi…' : 'Photo') + '</span></label>'
      + '<button type="button" class="btn btn-ghost" data-action="renommer" aria-label="' + escHtml('Renommer le rayon ' + c) + '">' + svgEdit() + '<span>Renommer</span></button>'
      + '<button type="button" class="btn btn-ghost" data-action="supprimer" style="color:var(--rouge)" aria-label="' + escHtml('Supprimer le rayon ' + c) + '">' + svgTrash() + '</button>'
      + SVG_CHEVRON + '</div></div>'
      + '<div class="photo-etat" role="status" aria-live="polite" style="padding:0 14px 0 50px"></div>'
      + (ouvert ? detailRayonHTML(c) : '')
      + '</li>';
  }).join('');
  ul.querySelectorAll('.rayon-ligne').forEach(function(li) {
    var c = cats[parseInt(li.getAttribute('data-index'), 10)];
    afficherApercuPhoto(li.querySelector('.photo-apercu'), pharmaPhotoRayon(DATA, c));
    li.querySelector('.rayon-ouvrir').addEventListener('click', function() {
      rayonOuvert = rayonOuvert === c ? null : c;
      rechercheAjoutRayon = '';
      renderRayonsAdmin();
    });
    var fichier = li.querySelector('input[type=file]');
    fichier.addEventListener('change', function() { if (fichier.files && fichier.files[0]) choisirPhotoRayon(c, fichier.files[0]); });
    li.querySelector('[data-action="renommer"]').addEventListener('click', function() { editerNomRayon(li, c); });
    li.querySelector('[data-action="supprimer"]').addEventListener('click', function() { supprimerRayon(c); });
    li.querySelector('[data-action="visible"]').addEventListener('change', function() { basculerRayonVisible(c, this.checked); });
    if (c === rayonOuvert) brancherDetailRayon(li, c);
  });
  if (focusVisible !== null) {
    var bouton = ul.querySelector('.rayon-ligne[data-index="' + focusVisible + '"] [data-action="visible"]');
    if (bouton) bouton.focus();
  }
  rendreReordonnable(ul, '.rayon-ligne', function(de, vers) {
    var avaitFocus = !!(document.activeElement && document.activeElement.classList.contains('poignee'));
    var c = DATA.categories.splice(de, 1)[0];
    DATA.categories.splice(vers, 0, c);
    persist();
    renderRayonsAdmin();
    var p = document.querySelector('#liste-rayons .rayon-ligne[data-index="' + vers + '"] .rayon-tete .poignee');
    if (p && avaitFocus) p.focus();
  });
}

function detailRayonHTML(c) {
  var produits = pharmaProduitsDuRayon(DATA, c);
  var html = '<div class="rayon-detail"><h4>Produits du rayon, dans l\'ordre de sa page</h4>';
  if (!produits.length) html += '<p class="rayons-aide">Aucun produit pour l\'instant. Ajoutez-en ci-dessous.</p>';
  html += '<ul class="liste-produits-rayon">' + produits.map(function(p) {
    var principal = p.cat === c;
    return '<li class="produit-rayon" data-id="' + nombre(p.id) + '">'
      + '<button type="button" class="poignee" aria-label="' + escHtml('Déplacer ' + p.nom + ' : glisser, ou flèches haut et bas') + '">' + SVG_POIGNEE + '</button>'
      + '<span class="nom">' + escHtml(p.nom) + '</span>'
      + (principal ? '<span class="badge-principal" title="Rayon choisi dans la fenêtre du produit">Rayon principal</span>'
                   : '<button type="button" class="btn btn-ghost" data-retirer aria-label="' + escHtml('Retirer ' + p.nom + ' du rayon') + '">Retirer</button>')
      + '</li>';
  }).join('') + '</ul>';
  if (pharmaPhotoRayon(DATA, c)) html += '<button type="button" class="btn btn-ghost" data-action="retirer-photo" style="margin-top:10px">Retirer la photo du rayon</button>';
  html += '<div class="ajout-produits"><label for="ajout-rayon-recherche">Ajouter des produits</label>'
    + '<input class="inp" id="ajout-rayon-recherche" type="search" placeholder="Rechercher un produit à ajouter..." autocomplete="off" value="' + escHtml(rechercheAjoutRayon) + '">'
    + '<ul class="resultats-ajout" id="ajout-rayon-resultats"></ul></div></div>';
  return html;
}
function resultatsAjoutRayon(c) {
  var dans = pharmaProduitsDuRayon(DATA, c).map(function(p) { return p.id; });
  var liste = (DATA.produits || []).filter(function(p) { return dans.indexOf(p.id) === -1 && searchMatch(p.nom + ' ' + p.ref + ' ' + p.cat, rechercheAjoutRayon); });
  if (!liste.length) return '<li class="vide">' + (rechercheAjoutRayon ? 'Aucun produit trouvé' : 'Tous les produits sont déjà dans ce rayon') + '</li>';
  return liste.slice(0, 30).map(function(p) {
    return '<li data-id="' + nombre(p.id) + '"><span>' + escHtml(p.nom) + (p.cat ? ' <span style="color:var(--texte-3)">· ' + escHtml(p.cat) + '</span>' : '') + '</span>'
      + '<button type="button" class="btn btn-ghost" aria-label="' + escHtml('Ajouter ' + p.nom + ' au rayon') + '">Ajouter</button></li>';
  }).join('') + (liste.length > 30 ? '<li class="vide">… précisez la recherche pour voir les autres produits</li>' : '');
}
function brancherDetailRayon(li, c) {
  var liste = li.querySelector('.liste-produits-rayon');
  liste.querySelectorAll('[data-retirer]').forEach(function(b) {
    b.addEventListener('click', function() { retirerDuRayon(c, nombre(b.closest('.produit-rayon').getAttribute('data-id'))); });
  });
  rendreReordonnable(liste, '.produit-rayon', function(de, vers) {
    var avaitFocus = !!(document.activeElement && document.activeElement.classList.contains('poignee'));
    var ids = pharmaProduitsDuRayon(DATA, c).map(function(p) { return p.id; });
    var id = ids.splice(de, 1)[0];
    ids.splice(vers, 0, id);
    enregistrerContenuRayon(c, ids);
    var p = document.querySelector('#liste-rayons .rayon-ligne.ouvert .produit-rayon:nth-child(' + (vers + 1) + ') .poignee');
    if (p && avaitFocus) p.focus();
  });
  var retirerPhoto = li.querySelector('[data-action="retirer-photo"]');
  if (retirerPhoto) retirerPhoto.addEventListener('click', function() { enregistrerPhotoRayon(c, ''); });
  var champ = li.querySelector('#ajout-rayon-recherche');
  var res = li.querySelector('#ajout-rayon-resultats');
  function remplir() {
    res.innerHTML = resultatsAjoutRayon(c);
    res.querySelectorAll('li[data-id] button').forEach(function(b) {
      b.addEventListener('click', function() { ajouterAuRayon(c, nombre(b.closest('li').getAttribute('data-id'))); });
    });
  }
  champ.addEventListener('input', function() { rechercheAjoutRayon = champ.value; remplir(); });
  remplir();
}
function enregistrerContenuRayon(c, ids) {
  if (!DATA.contenuRayons || typeof DATA.contenuRayons !== 'object') DATA.contenuRayons = {};
  DATA.contenuRayons[c] = ids;
  persist();
  renderRayonsAdmin();
}
function ajouterAuRayon(c, id) {
  var ids = pharmaProduitsDuRayon(DATA, c).map(function(p) { return p.id; });
  if (ids.indexOf(id) !== -1) return;
  ids.push(id);
  var p = DATA.produits.find(function(x) { return x.id === id; });
  enregistrerContenuRayon(c, ids);
  var champ = document.getElementById('ajout-rayon-recherche');
  if (champ) champ.focus();
  toast((p ? p.nom : 'Produit') + ' ajouté au rayon ' + c);
}
function retirerDuRayon(c, id) {
  var p = DATA.produits.find(function(x) { return x.id === id; });
  if (p && p.cat === c) { toast('C\'est le rayon principal de ce produit : changez-le dans la fenêtre du produit', 'error'); return; }
  enregistrerContenuRayon(c, pharmaProduitsDuRayon(DATA, c).map(function(x) { return x.id; }).filter(function(x) { return x !== id; }));
  toast((p ? p.nom : 'Produit') + ' retiré du rayon ' + c);
}

function nouveauRayon() {
  openModal('m-rayon');
  setTimeout(function() { var f = document.getElementById('ray-nom'); if (f) f.focus(); }, 80);
}
function creerRayon() {
  var v = nomRayonValide(getVal('ray-nom'));
  if (v.erreur) { toast(v.erreur, 'error'); return; }
  DATA.categories.push(v.nom);
  rayonOuvert = v.nom;
  rechercheAjoutRayon = '';
  closeModal('m-rayon');
  persist();
  if (currentPage === 'rayons') renderRayonsAdmin();
  toast('Rayon ' + v.nom + ' créé : ajoutez-lui des produits');
}

// Renommer : les produits, la photo, l'ordre et les codes promo du rayon suivent le nouveau nom
function editerNomRayon(li, c) {
  var tete = li.querySelector('.rayon-ouvrir');
  var bloc = document.createElement('form');
  bloc.className = 'rayon-renommer';
  bloc.innerHTML = '<input class="inp" maxlength="60" aria-label="' + escHtml('Nouveau nom du rayon ' + c) + '" value="' + escHtml(c) + '">'
    + '<button type="submit" class="btn btn-primary">Enregistrer</button><button type="button" class="btn btn-ghost">Annuler</button>';
  tete.replaceWith(bloc);
  li.querySelector('.rayon-actions').style.display = 'none';
  var champ = bloc.querySelector('input');
  champ.focus(); champ.select();
  bloc.querySelector('button[type=button]').addEventListener('click', renderRayonsAdmin);
  champ.addEventListener('keydown', function(e) { if (e.key === 'Escape') renderRayonsAdmin(); });
  bloc.addEventListener('submit', function(e) {
    e.preventDefault();
    var v = nomRayonValide(champ.value, c);
    if (v.erreur) { toast(v.erreur, 'error'); return; }
    if (v.nom === c) { renderRayonsAdmin(); return; }
    renommerRayon(c, v.nom);
  });
}
// Bouton « Sur le site » d'un rayon : masqué, il disparaît du site (rayons, filtres, menu, sa page),
// ses produits restent en vente dans « Tous » et dans leurs autres rayons
function basculerRayonVisible(c, visible) {
  if (!Array.isArray(DATA.rayonsMasques)) DATA.rayonsMasques = [];
  DATA.rayonsMasques = DATA.rayonsMasques.filter(function(x) { return x !== c; });
  if (!visible) DATA.rayonsMasques.push(c);
  persist();
  renderRayonsAdmin();
  toast(visible ? 'Rayon ' + c + ' affiché sur le site' : 'Rayon ' + c + ' masqué sur le site : ses produits restent en vente');
}
function renommerRayon(ancien, nouveau) {
  if (ADMIN_CLOUD) {
    // Avec la base : renommé directement par la base, qui met à jour les produits en même temps
    PharmaAdminCloud.renommerRayon(ancien, nouveau).then(function() {
      if (rayonOuvert === ancien) rayonOuvert = nouveau;
      renderRayonsAdmin();
      toast('Rayon renommé : ' + nouveau);
    }, function(e) { toast('Rayon non renommé : ' + ((e && e.message) || 'erreur inconnue'), 'error'); renderRayonsAdmin(); });
    return;
  }
  DATA.categories = DATA.categories.map(function(c) { return c === ancien ? nouveau : c; });
  DATA.produits.forEach(function(p) { if (p.cat === ancien) p.cat = nouveau; });
  (DATA.codesPromo || []).forEach(function(k) { if (k.scope === ancien) k.scope = nouveau; });
  if (Array.isArray(DATA.rayonsMasques)) DATA.rayonsMasques = DATA.rayonsMasques.map(function(x) { return x === ancien ? nouveau : x; });
  ['photosRayons', 'contenuRayons'].forEach(function(cle) {
    var o = DATA[cle];
    if (o && Object.prototype.hasOwnProperty.call(o, ancien)) { o[nouveau] = o[ancien]; delete o[ancien]; }
  });
  if (rayonOuvert === ancien) rayonOuvert = nouveau;
  persist();
  renderRayonsAdmin();
  toast('Rayon renommé : ' + nouveau);
}
function supprimerRayon(c) {
  var principaux = DATA.produits.filter(function(p) { return p.cat === c; });
  if (principaux.length) {
    toast('Le rayon ' + c + ' est le rayon principal de ' + principaux.length + ' produit' + (principaux.length > 1 ? 's' : '') + ' : choisissez-leur d\'abord un autre rayon (fenêtre du produit)', 'error');
    return;
  }
  var codes = (DATA.codesPromo || []).filter(function(k) { return k.scope === c; }).length;
  confirmer('Supprimer le rayon « ' + escHtml(c) + ' » ?' + (codes ? '<br><span style="font-size:0.78rem;color:var(--texte-2)">' + codes + ' code' + (codes > 1 ? 's' : '') + ' promo porte' + (codes > 1 ? 'nt' : '') + ' sur ce rayon : il' + (codes > 1 ? 's' : '') + ' ne s\'appliquer' + (codes > 1 ? 'ont' : 'a') + ' plus à aucun produit.</span>' : ''), function() {
    DATA.categories = DATA.categories.filter(function(x) { return x !== c; });
    if (DATA.photosRayons) delete DATA.photosRayons[c];
    if (DATA.contenuRayons) delete DATA.contenuRayons[c];
    if (Array.isArray(DATA.rayonsMasques)) DATA.rayonsMasques = DATA.rayonsMasques.filter(function(x) { return x !== c; });
    if (rayonOuvert === c) rayonOuvert = null;
    persist();
    renderRayonsAdmin();
    toast('Rayon ' + c + ' supprimé');
  });
}

// Glisser-déposer par la poignée, au doigt comme à la souris (l'élément suit le doigt et prend sa place
// au passage), et au clavier : flèches haut et bas sur la poignée.
function rendreReordonnable(liste, selecteur, surDeplacement) {
  var elements = Array.prototype.filter.call(liste.children, function(el) { return el.matches(selecteur); });
  elements.forEach(function(el, index) {
    var poignee = el.querySelector('.poignee');
    if (!poignee || poignee.closest(selecteur) !== el) return;
    poignee.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); surDeplacement(index, index - 1); }
      else if (e.key === 'ArrowDown' && index < elements.length - 1) { e.preventDefault(); surDeplacement(index, index + 1); }
    });
    poignee.addEventListener('pointerdown', function(e) { glisser(e, liste, el, selecteur, surDeplacement, poignee); });
  });
}
function glisser(e, liste, el, selecteur, surDeplacement, poignee) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  var freres = function() { return Array.prototype.filter.call(liste.children, function(x) { return x.matches(selecteur); }); };
  var depart = freres().indexOf(el);
  var pageY0 = e.clientY + window.scrollY, haut0 = el.offsetTop, dernierY = e.clientY;
  var defilement = null;
  try { poignee.setPointerCapture(e.pointerId); } catch (err) {}
  el.classList.add('en-glisser');
  document.body.classList.add('glisser-actif');
  function placer(clientY) {
    dernierY = clientY;
    var dy = clientY + window.scrollY - pageY0;
    el.style.transform = 'translateY(' + (dy - (el.offsetTop - haut0)) + 'px)';
    var r = el.getBoundingClientRect(), centre = r.top + r.height / 2;
    var suivant = el.nextElementSibling, precedent = el.previousElementSibling;
    if (suivant && suivant.matches(selecteur)) {
      var rs = suivant.getBoundingClientRect();
      if (centre > rs.top + rs.height / 2) { liste.insertBefore(suivant, el); placer(clientY); return; }
    }
    if (precedent && precedent.matches(selecteur)) {
      var rp = precedent.getBoundingClientRect();
      if (centre < rp.top + rp.height / 2) { liste.insertBefore(el, precedent); placer(clientY); return; }
    }
  }
  // Près du haut ou du bas de l'écran, la page défile toute seule (longue liste sur téléphone)
  function auBord() {
    var v = dernierY < 70 ? -10 : (dernierY > window.innerHeight - 70 ? 10 : 0);
    if (v) { window.scrollBy(0, v); placer(dernierY); }
    defilement = requestAnimationFrame(auBord);
  }
  defilement = requestAnimationFrame(auBord);
  // Écoute sur tout le document : déplacer la ligne dans la liste fait perdre la « capture » du pointeur
  // à la poignée ; sans cela, un relâchement hors de la poignée laissait le glisser bloqué et l'ordre non enregistré.
  function bouge(ev) { if (ev.pointerId === e.pointerId) placer(ev.clientY); }
  function fin(ev) {
    if (ev && ev.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
    cancelAnimationFrame(defilement);
    document.removeEventListener('pointermove', bouge);
    document.removeEventListener('pointerup', fin);
    document.removeEventListener('pointercancel', fin);
    el.classList.remove('en-glisser');
    el.style.transform = '';
    document.body.classList.remove('glisser-actif');
    var arrivee = freres().indexOf(el);
    if (arrivee !== depart && arrivee !== -1) surDeplacement(depart, arrivee);
  }
  document.addEventListener('pointermove', bouge);
  document.addEventListener('pointerup', fin);
  document.addEventListener('pointercancel', fin);
}

// ── CONSEILS PERSONNALISÉS ───────────────────────────────────
function renderConseils() {
  var html = '';
  DATA.conseils.forEach(function(c) {
    html += '<div class="conseil-card" style="border-left:4px solid '+couleurSure(c.couleur)+';background:var(--fond);border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:14px">';
    html += '<div style="width:44px;height:44px;border-radius:11px;background:'+couleurSure(c.couleur)+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+svgConseil(c.icone)+'</div>';
    html += '<div style="flex:1"><div style="font-weight:700;font-size:0.9rem">'+escHtml(c.titre)+'</div><div style="font-size:0.76rem;color:var(--texte-2);margin-top:2px">'+escHtml(c.texte)+'</div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<label class="toggle-wrap"><input type="checkbox" class="toggle-input"'+(c.actif?' checked':'')+' onchange="toggleConseil('+c.id+',this.checked)"><span class="toggle-track"></span></label>';
    html += '<button class="act-btn" onclick="editConseil('+c.id+')">'+svgEdit()+'</button>';
    html += '<button class="act-btn" style="color:var(--rouge)" onclick="deleteConseil('+c.id+',\''+escAttr(c.titre)+'\')">'+svgTrash()+'</button>';
    html += '</div></div>';
  });
  setHTML('conseils-list', html);
}

function editConseil(id) {
  var c = DATA.conseils.find(function(x){ return x.id===id; });
  if (!c) return;
  setVal('cs-icone', c.icone || 'info');
  setVal('cs-titre', c.titre);
  setVal('cs-texte', c.texte);
  setVal('cs-couleur', c.couleur);
  document.getElementById('cs-id').value = id;
  document.getElementById('m-conseil-title').textContent = 'Modifier le conseil';
  openModal('m-conseil');
}

function saveConseil() {
  var id = parseInt(document.getElementById('cs-id').value);
  var icone = getVal('cs-icone') || 'info';
  var titre = getVal('cs-titre');
  var texte = getVal('cs-texte');
  var couleur = getVal('cs-couleur')||'#1B6B45';
  if (!titre) { toast('Le titre est obligatoire','error'); return; }
  if (id) {
    var c = DATA.conseils.find(function(x){ return x.id===id; });
    if (c) { c.icone=icone; c.titre=titre; c.texte=texte; c.couleur=couleur; }
    toast('Conseil modifié');
  } else {
    var nid = DATA.conseils.length ? Math.max.apply(null,DATA.conseils.map(function(x){return x.id;}))+1 : 1;
    DATA.conseils.push({ id:nid, icone:icone, titre:titre, texte:texte, couleur:couleur, actif:true });
    toast('Conseil ajouté — les 3 premiers conseils actifs s\'affichent sur l\'accueil du site');
  }
  closeModal('m-conseil');
  renderConseils();
  document.getElementById('cs-id').value='';
  persist();
}

function toggleConseil(id, actif) {
  var c = DATA.conseils.find(function(x){ return x.id===id; });
  if (c) { c.actif=actif; toast(actif?'Conseil activé':'Conseil désactivé'); persist(); }
}

function deleteConseil(id, titre) {
  confirmer('Supprimer le conseil "'+escHtml(titre)+'" ?', function() {
    DATA.conseils = DATA.conseils.filter(function(c){ return c.id!==id; });
    renderConseils(); toast('Conseil supprimé');
    persist();
  });
}

// ── PROMOS ──────────────────────────────────────────────────
function renderPromos(filtre) {
  var html = '';
  var list = DATA.promos.filter(function(p) {
    return !filtre || searchMatch(p.produit, filtre);
  });
  if (list.length === 0) html = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--texte-3)">Aucune promotion</td></tr>';
  list.forEach(function(p) {
    var bc = p.statut==='Active'?'b-green':'b-grey';
    html += '<tr><td><div class="td-main">'+escHtml(p.produit)+'</div>'+(p.miseEnAvant ? '<div class="td-sub">Mise en avant sur l\'accueil</div>' : '')+'</td>';
    html += '<td>'+nombre(p.prixNormal).toFixed(2)+'€</td>';
    html += '<td><strong>'+nombre(p.prixPromo).toFixed(2)+'€</strong></td>';
    html += '<td><span class="badge b-vif">'+escHtml(p.pct)+'%</span></td>';
    html += '<td>'+escHtml(p.fin)+'</td>';
    html += '<td><span class="badge '+bc+'">'+escHtml(p.statut)+'</span></td>';
    html += '<td class="actions-cell"><div><button class="act-btn" onclick="editPromo('+p.id+')">'+svgEdit()+'</button><button class="act-btn" style="color:var(--rouge)" onclick="deletePromo('+p.id+',\''+escAttr(p.produit)+'\')">'+svgTrash()+'</button></div></td></tr>';
  });
  setHTML('tbody-promos', html);
}

function editPromo(id) {
  var p = DATA.promos.find(function(x){ return x.id===id; });
  if (!p) return;
  renderPromoProduitOptions(p.produit);
  document.getElementById('pn').value = p.prixNormal;
  document.getElementById('pp').value = p.prixPromo;
  setVal('promo-debut', p.debut || '');
  setVal('promo-fin', p.fin || '');
  setVal('promo-qte', p.qte || 1);
  var avant = document.getElementById('promo-avant');
  if (avant) avant.checked = p.miseEnAvant === true;
  document.getElementById('p-promo-id').value = id;
  calcP();
  openModal('m-promo');
}

// Remplit le select produit du modal promo avec les vrais produits du catalogue
function renderPromoProduitOptions(selected) {
  var el = document.getElementById('promo-produit');
  if (!el) return;
  var val = selected || el.value;
  el.innerHTML = DATA.produits.map(function(p) {
    return '<option value="'+escAttr(p.nom)+'"'+(val===p.nom?' selected':'')+'>'+escHtml(p.nom)+'</option>';
  }).join('');
  // Si la promo éditée porte sur un libellé absent du catalogue (ex. un lot), on l'ajoute
  if (val && !DATA.produits.some(function(p){ return p.nom === val; })) {
    el.innerHTML += '<option value="'+escHtml(val)+'" selected>'+escHtml(val)+'</option>';
  }
}

// Ouvre le modal promo en mode CRÉATION (réinitialise les champs et l'id d'édition).
// Nécessaire car p-promo-id conserve sa valeur si une édition précédente a été annulée.
function nouvellePromo(nomProduit) {
  var pid = document.getElementById('p-promo-id');
  if (pid) pid.value = '';
  renderPromoProduitOptions(nomProduit || '');
  setVal('promo-debut', '');
  setVal('promo-fin', '');
  setVal('promo-qte', 1);
  var avant = document.getElementById('promo-avant');
  if (avant) avant.checked = false;
  var pn = document.getElementById('pn'), pp = document.getElementById('pp');
  if (pn) pn.value = '';
  if (pp) pp.value = '';
  var titre = document.querySelector('#m-promo .modal-title');
  if (titre) titre.textContent = 'Créer une promotion';
  openModal('m-promo');
}

function savePromo() {
  var id = parseInt(document.getElementById('p-promo-id') ? document.getElementById('p-promo-id').value : 0);
  var pn = parseFloat(document.getElementById('pn').value)||0;
  var pp = parseFloat(document.getElementById('pp').value)||0;
  if (!(pn > 0) || !(pp > 0)) { toast('Indiquez deux prix supérieurs à 0','error'); return; }
  if (pp >= pn) { toast('Le prix promo doit être inférieur au prix normal','error'); return; }
  var pct = -Math.round((1-pp/pn)*100);
  var debut = getVal('promo-debut');
  var fin = getVal('promo-fin');
  if (debut && fin && fin < debut) { toast('La date de fin doit être après la date de début','error'); return; }
  var qte = parseInt(getVal('promo-qte')) || 1;
  var caseAvant = document.getElementById('promo-avant');
  var miseEnAvant = !!(caseAvant && caseAvant.checked);
  if (!(parseInt(getVal('promo-qte'), 10) >= 1)) { toast('Le nombre d\'unités par lot doit être d\'au moins 1','error'); return; }
  if (id) {
    var p = DATA.promos.find(function(x){ return x.id===id; });
    if (p) {
      p.produit = getVal('promo-produit') || p.produit;
      p.prixNormal=pn; p.prixPromo=pp; p.pct=pct;
      p.debut=debut; p.fin=fin; p.qte=qte; p.miseEnAvant=miseEnAvant;
    }
    toast('Promo modifiée');
  } else {
    var nid = DATA.promos.length ? Math.max.apply(null,DATA.promos.map(function(x){return x.id;}))+1 : 1;
    DATA.promos.push({
      id:nid, produit:getVal('promo-produit'), prixNormal:pn, prixPromo:pp, pct:pct,
      debut:debut, fin:fin, qte:qte, statut:'Active', miseEnAvant:miseEnAvant
    });
    toast('Promotion publiée sur le site');
  }
  closeModal('m-promo');
  renderPromos();
  if (document.getElementById('p-promo-id')) document.getElementById('p-promo-id').value='';
  persist();
}

function deletePromo(id, produit) {
  confirmer('Supprimer la promotion "'+escHtml(produit)+'" ?', function() {
    DATA.promos = DATA.promos.filter(function(p){ return p.id!==id; });
    renderPromos(); toast('Promotion supprimée');
    persist();
  });
}

// ── CODES PROMO ─────────────────────────────────────────────
function renderRegleFidelite() {
  var cfg = PharmaFidelite.config(DATA);
  var auto = DATA.parametres.notifAuto || {};
  var email = auto.codeFidelite === true && typeof PharmaEmail !== 'undefined' && PharmaEmail.pret(DATA);
  setHTML('regle-fidelite',
    '<div style="background:var(--vert-pale);border:1px solid rgba(27,107,69,0.15);border-radius:8px;padding:12px">'
    + '<div style="font-weight:700;font-size:0.8rem">Tous les '+cfg.seuil+' achats</div>'
    + '<div class="txt-muted mt2">Code <strong>-'+cfg.reduction+'%</strong> sur tous les produits · 30 jours · usage unique · réservé au client · '
    + (email ? 'envoyé automatiquement par email' : 'email automatique désactivé')+'</div></div>'
    + '<div class="txt-muted" style="margin-top:10px">Après chaque code débloqué, le compteur du client repart de zéro. Le palier et la réduction se règlent dans Paramètres &gt; Programme de fidélité.</div>');
}

function renderCodesPromo() {
  renderRegleFidelite();
  // Code proposé : toujours tiré au hasard à l'ouverture (jamais une valeur fixe, qui serait
  // la même dans toutes les pharmacies équipées du site et donc facile à deviner)
  var codeAffiche = document.getElementById('cval');
  if (codeAffiche && !/^PHARM-[A-Z0-9]{6}$/.test(codeAffiche.textContent.trim())) regenCode();
  // Alimente les listes déroulantes avec les vraies données
  var selClient = document.getElementById('cclient');
  if (selClient) {
    var cur = selClient.value;
    selClient.innerHTML = '<option>Tous les clients</option>' +
      DATA.clients.map(function(c){ return '<option'+(cur===c.nom?' selected':'')+'>'+escHtml(c.nom)+'</option>'; }).join('');
  }
  var selScope = document.getElementById('cscope');
  if (selScope) {
    var curS = selScope.value;
    selScope.innerHTML = '<option value="Tous">Tous les produits</option>' +
      DATA.categories.map(function(c){ return '<option'+(curS===c?' selected':'')+'>'+escHtml(c)+'</option>'; }).join('');
  }
  calcCode();

  var tb = document.getElementById('tbody-codes');
  if (!tb) return;
  if (!DATA.codesPromo.length) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--texte-3)">Aucun code promo pour le moment</td></tr>';
    return;
  }
  var html = '';
  DATA.codesPromo.forEach(function(c) {
    var expire = c.expire ? c.expire.split('-').reverse().join('/') : 'Illimité';
    var usages = c.maxUsages ? (c.usages+'/'+c.maxUsages) : (c.usages+'/∞');
    var epuise = c.maxUsages && c.usages >= c.maxUsages;
    var statut = !c.actif ? '<span class="badge b-red">Désactivé</span>'
               : epuise ? '<span class="badge b-or">Épuisé</span>'
               : '<span class="badge b-green">Actif</span>';
    html += '<tr>';
    html += '<td><code>'+escHtml(c.code)+'</code></td>';
    html += '<td>'+escHtml(c.client)+'</td>';
    html += '<td><span class="badge b-vif">-'+escHtml(c.pct)+'%</span></td>';
    html += '<td>'+(c.scope==='Tous'?'Tous produits':escHtml(c.scope))+'</td>';
    html += '<td><span class="badge b-blue">'+escHtml(c.origine)+'</span></td>';
    html += '<td>'+escHtml(usages)+'</td>';
    html += '<td>'+escHtml(expire)+'</td>';
    html += '<td>'+statut+'</td>';
    html += '<td class="flex-gap">';
    html += '<button class="act-btn" onclick="copyCode(\''+escAttr(c.code)+'\')" title="Copier"><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
    html += '<button class="act-btn" onclick="toggleCode(\''+escAttr(c.code)+'\')" title="'+(c.actif?'Désactiver':'Réactiver')+'" style="color:'+(c.actif?'var(--rouge)':'var(--vert)')+'"><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>';
    html += '<button class="act-btn" style="color:var(--rouge)" onclick="deleteCode(\''+escAttr(c.code)+'\')" title="Supprimer">'+svgTrash()+'</button>';
    html += '</td></tr>';
  });
  tb.innerHTML = html;
}

function genererCode() {
  var codeEl = document.getElementById('cval');
  var code = codeEl ? codeEl.textContent.trim() : '';
  if (!code) { toast('Aucun code généré','error'); return; }
  if (DATA.codesPromo.some(function(c){ return c.code === code; })) {
    toast('Ce code existe déjà — régénérez-en un autre','error'); return;
  }
  var pct = parseInt(getVal('cpct')) || 0;
  if (pct <= 0 || pct > 100) { toast('Réduction invalide (1 à 100%)','error'); return; }
  var scopeEl = document.getElementById('cscope');
  var scope = scopeEl ? (scopeEl.value === 'Tous les produits' ? 'Tous' : scopeEl.value) : 'Tous';
  var client = getVal('cclient') || 'Tous les clients';
  DATA.codesPromo.push({
    code: code, client: client, pct: pct, scope: scope,
    origine: 'Manuel', usages: 0, maxUsages: (client === 'Tous les clients' ? 0 : 1),
    expire: '', actif: true
  });
  persist();
  renderCodesPromo();
  regenCode();
  toast('Code '+code+' créé');
}

function toggleCode(code) {
  var c = DATA.codesPromo.find(function(x){ return x.code === code; });
  if (!c) return;
  c.actif = !c.actif;
  persist();
  renderCodesPromo();
  toast(c.actif ? 'Code réactivé' : 'Code désactivé');
}

function deleteCode(code) {
  confirmer('Supprimer définitivement le code "'+escHtml(code)+'" ?', function() {
    DATA.codesPromo = DATA.codesPromo.filter(function(c){ return c.code !== code; });
    persist();
    renderCodesPromo();
    toast('Code supprimé');
  });
}

// Icônes SVG des conseils (charte : SVG uniquement, pas d'emoji dans l'UI)
var CONSEIL_ICONES_ANCIEN = {
  soleil:   '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>',
  pilule:   '<path d="M10.5 20.5L3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
  goutte:   '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  coeur:    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  feuille:  '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  info:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};
var CONSEIL_ICONES = (typeof PHARMA_ICONES_CONSEIL !== 'undefined') ? PHARMA_ICONES_CONSEIL : CONSEIL_ICONES_ANCIEN;
function svgConseil(cle, taille) {
  var path = CONSEIL_ICONES[cle] || CONSEIL_ICONES.info;
  var t = taille || 22;
  return '<svg width="'+t+'" height="'+t+'" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
}

// ── RAPPORT HEBDOMADAIRE (statistiques réelles calculées depuis DATA) ──
function renderRapport() {
  var rc = DATA.parametres.rapportContenu;
  if (rc) ['promos','codes','ventes','employes'].forEach(function(k){ var el = document.getElementById('rap-'+k); if (el) el.checked = !!rc[k]; });
  var rjEl = document.getElementById('par-rapport-jour'), rhEl = document.getElementById('par-rapport-heure');
  setVal('par-rapport-email', DATA.parametres.rapportEmail);
  if (rjEl && DATA.parametres.rapportJour) rjEl.value = DATA.parametres.rapportJour;
  if (rhEl && DATA.parametres.rapportHeure) rhEl.value = DATA.parametres.rapportHeure;
  var maintenant = new Date();
  var debut = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);

  // On ne retient que les commandes horodatées des 7 derniers jours.
  // Les anciennes commandes sans timestamp sont exclues du calcul.
  var semaine = DATA.commandes.filter(function(c) {
    if (!c.timestamp) return false;
    var d = new Date(c.timestamp);
    return d >= debut && d <= maintenant;
  });

  var ca = semaine.reduce(function(s, c) { return s + nombre(c.total); }, 0);
  var nb = semaine.length;
  var panierMoyen = nb ? ca / nb : 0;
  var retirees = semaine.filter(function(c){ return c.statut === 'Retirée'; }).length;
  var enAttente = DATA.commandes.filter(function(c){ return c.statut === 'En préparation'; }).length;
  var promosActives = DATA.promos.filter(function(p){ return p.statut === 'Active'; }).length;
  var codesUtilises = DATA.codesPromo.reduce(function(s, c){ return s + (c.usages || 0); }, 0);
  var codesGeneres = DATA.codesPromo.length;
  var stockFaible = DATA.produits.filter(function(p){ return p.stock <= p.seuil; });

  // Produits les plus commandés (extraits du libellé "Nom xQté + Nom xQté")
  var ventes = {};
  semaine.forEach(function(c) {
    (c.produits || '').split(' + ').forEach(function(part) {
      var m = part.match(/^(.*?)\s+x(\d+)$/);
      if (!m) return;
      var nom = m[1].trim();
      ventes[nom] = (ventes[nom] || 0) + parseInt(m[2], 10);
    });
  });
  var top = Object.keys(ventes).map(function(k){ return { nom:k, qte:ventes[k] }; })
    .sort(function(a,b){ return b.qte - a.qte; }).slice(0, 3);

  var fmtDate = function(d) { return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2); };
  var per = document.getElementById('rapport-periode');
  if (per) per.textContent = 'Du ' + fmtDate(debut) + ' au ' + fmtDate(maintenant);

  var box = document.getElementById('rapport-contenu');
  if (!box) return;

  var html = '<div style="background:var(--fond);border-radius:9px;padding:12px;border:1px solid var(--bord)">';
  html += '<div class="g2" style="gap:8px;margin-bottom:10px">';
  html += statBox(nombre(ca).toFixed(2).replace('.', ',') + '€', 'Chiffre d\'affaires', 'var(--vert)');
  html += statBox(nb, 'Commandes', 'var(--bleu)');
  html += '</div>';
  html += '<div class="g2" style="gap:8px;margin-bottom:10px">';
  html += statBox(nombre(panierMoyen).toFixed(2).replace('.', ',') + '€', 'Panier moyen', 'var(--vert)');
  html += statBox(promosActives, 'Promos actives', 'var(--or)');
  html += '</div>';
  html += '<div style="font-size:0.76rem;color:var(--texte-2);line-height:1.7">';
  html += '<div>Commandes retirées : <strong>' + retirees + '</strong> · En attente : <strong>' + enAttente + '</strong></div>';
  html += '<div>Codes promo : <strong>' + codesGeneres + '</strong> existants · <strong>' + codesUtilises + '</strong> utilisation(s)</div>';
  if (top.length) {
    html += '<div style="margin-top:6px"><strong>Produits les plus commandés :</strong></div>';
    top.forEach(function(t, i) {
      html += '<div>' + (i+1) + '. ' + escHtml(t.nom) + ' — <strong>' + escHtml(t.qte) + '</strong> unité' + (t.qte>1?'s':'') + '</div>';
    });
  }
  if (stockFaible.length) {
    html += '<div style="margin-top:6px;color:var(--rouge)"><strong>' + stockFaible.length + ' produit(s) en stock faible :</strong> '
         + stockFaible.map(function(p){ return escHtml(p.nom) + ' (' + escHtml(p.stock) + ')'; }).join(', ') + '</div>';
  }
  html += '</div></div>';

  if (!nb) {
    html = '<div style="background:var(--fond);border-radius:9px;padding:20px;border:1px solid var(--bord);text-align:center;color:var(--texte-3);font-size:0.82rem">'
         + 'Aucune commande enregistrée sur les 7 derniers jours.</div>';
  }
  box.innerHTML = html;
}
function statBox(valeur, label, couleur) {
  return '<div style="background:var(--blanc);border-radius:7px;padding:9px;border:1px solid var(--bord);text-align:center">'
       + '<div style="font-size:1.3rem;font-weight:800;color:'+couleur+'">'+valeur+'</div>'
       + '<div class="txt-muted">'+label+'</div></div>';
}

// ── NOTIFICATIONS ───────────────────────────────────────────
// Chaque événement indique s'il est réalisable sans serveur. Les autres
// nécessitent un serveur (un envoi différé suppose un serveur qui tourne).
var NOTIF_EVENTS = [
  { cle:'commandeRecue',  titre:'Commande reçue',            desc:'Confirmation au client + alerte à la pharmacie dès la validation du panier.', dispo:true },
  { cle:'commandePrete',  titre:'Commande prête à retirer',  desc:'Envoyé quand un employé marque la commande « Prête ». Le plus utile pour faire venir le client.', dispo:true },
  { cle:'codeFidelite',   titre:'Code de fidélité débloqué', desc:'Envoyé automatiquement quand le client atteint le palier configuré.', dispo:true },
  { cle:'relanceRetrait', titre:'Relance commande non retirée', desc:'Nécessite un serveur qui vérifie les commandes en continu.', dispo:false },
  { cle:'codeExpire',     titre:'Rappel code promo bientôt expiré', desc:'Nécessite un serveur qui vérifie les dates en continu.', dispo:false },
  { cle:'stockFaible',    titre:'Alerte stock faible',       desc:'Nécessite un serveur pour surveiller les stocks hors connexion.', dispo:false }
];

function renderNotifications() {
  var cfg = DATA.parametres.notifAuto || {};
  var box = document.getElementById('notif-auto-list');
  if (box) {
    box.innerHTML = NOTIF_EVENTS.map(function(ev) {
      var actif = cfg[ev.cle] === true;
      var opacite = ev.dispo ? '' : 'opacity:0.55;';
      var badge = ev.dispo ? '' : '<span class="badge b-grey" style="margin-left:8px">Nécessite un serveur</span>';
      return '<div class="toggle-card" style="'+opacite+'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid var(--bord);border-radius:9px;margin-bottom:8px">'
        + '<div><div style="font-weight:700;font-size:0.82rem">'+ev.titre+badge+'</div>'
        + '<div style="font-size:0.74rem;color:var(--texte-2);margin-top:3px">'+ev.desc+'</div></div>'
        + '<label class="toggle-wrap" style="flex-shrink:0"><input type="checkbox" class="toggle-input"'
        + (actif?' checked':'') + (ev.dispo?'':' disabled')
        + ' onchange="toggleNotifAuto(\''+ev.cle+'\', this.checked)"><span class="toggle-track"></span></label>'
        + '</div>';
    }).join('');
  }

  // Destinataires : effectifs réels, plus de nombre inventé
  var sel = document.getElementById('notif-dest');
  if (sel) {
    var avecEmail = DATA.clients.filter(function(c){ return c.email; }).length;
    var avecSms = DATA.clients.filter(function(c){ return c.tel; }).length;
    sel.innerHTML = '<option value="tous">Tous les clients ('+DATA.clients.length+')</option>'
      + '<option value="email">Clients avec email ('+avecEmail+')</option>'
      + '<option value="sms">Clients avec téléphone ('+avecSms+')</option>';
  }
  renderNotifHistorique();
  renderEmailJournal();
}

function toggleNotifAuto(cle, actif) {
  if (!DATA.parametres.notifAuto) DATA.parametres.notifAuto = {};
  DATA.parametres.notifAuto[cle] = actif;
  persist();
  var ev = NOTIF_EVENTS.find(function(e){ return e.cle === cle; });
  toast((ev ? ev.titre : 'Notification') + (actif ? ' activée' : ' désactivée'));
}

function envoyerNotification() {
  var msg = (getVal('notif-msg') || '').trim();
  if (!msg) { toast('Saisissez un message','error'); return; }
  var type = getVal('notif-type') || 'Message personnalisé';
  var destCle = getVal('notif-dest') || 'tous';
  var cibles = DATA.clients.filter(function(c) {
    if (destCle === 'email') return !!c.email;
    if (destCle === 'sms') return !!c.tel;
    return true;
  });
  if (!cibles.length) { toast('Aucun destinataire correspondant','error'); return; }
  DATA.notifications.push({
    id: Date.now(),
    type: type,
    message: msg,
    destinataires: cibles.length,
    cible: destCle,
    timestamp: new Date().toISOString(),
    statut: 'En attente d\'envoi'
  });
  persist();
  setVal('notif-msg', '');
  renderNotifHistorique();
  toast('Notification enregistrée pour ' + cibles.length + ' client(s)');
}

function renderNotifHistorique() {
  var box = document.getElementById('notif-historique');
  if (!box) return;
  if (!DATA.notifications || !DATA.notifications.length) {
    box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--texte-3);font-size:0.82rem">Aucune notification envoyée pour le moment.</div>';
    return;
  }
  var liste = DATA.notifications.slice().sort(function(a,b){ return new Date(b.timestamp) - new Date(a.timestamp); });
  box.innerHTML = liste.map(function(n) {
    var d = new Date(n.timestamp);
    var date = ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear()+' à '+('0'+d.getHours()).slice(-2)+'h'+('0'+d.getMinutes()).slice(-2);
    return '<div style="border:1px solid var(--bord);border-radius:9px;padding:12px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px">'
      + '<span style="font-weight:700;font-size:0.8rem">'+escHtml(n.type)+'</span>'
      + '<span class="badge b-orange">'+escHtml(n.statut)+'</span></div>'
      + '<div style="font-size:0.78rem;color:var(--texte-2);line-height:1.5">'+escHtml(n.message)+'</div>'
      + '<div class="txt-muted" style="margin-top:6px">'+date+' · '+escHtml(n.destinataires)+' destinataire(s)</div>'
      + '<div style="margin-top:8px"><button class="act-btn" style="color:var(--rouge)" onclick="deleteNotification('+n.id+')" title="Supprimer">'+svgTrash()+'</button></div>'
      + '</div>';
  }).join('');
}

function deleteNotification(id) {
  confirmer('Supprimer cette notification de l\'historique ?', function() {
    DATA.notifications = DATA.notifications.filter(function(n){ return n.id !== id; });
    persist();
    renderNotifHistorique();
    toast('Notification supprimée');
  });
}

// ── FILTRES (recherche + statut combinés) ───────────────────
// Chaque filtre lit les DEUX champs, sinon changer l'un effaçait l'autre.
function filtrerCommandes() {
  renderCommandes(getVal('search-cmd'), getVal('filter-statut-cmd'));
}
function filtrerTickets() {
  renderTickets(getVal('search-tickets'), getVal('filter-statut-tickets'));
}
function filtrerClients() {
  renderClients(getVal('search-clients'), getVal('filter-type-clients'));
}

// ── GESTION DES COMMANDES ───────────────────────────────────
// Annuler : la commande reste visible (traçabilité) mais passe en "Annulée",
// et le stock des produits est remis à disposition.
function annulerCommande(id) {
  var c = DATA.commandes.find(function(x){ return x.id === id; });
  if (!c) return;
  if (c.statut === 'Annulée') { toast('Cette commande est déjà annulée'); return; }
  if (c.statut === 'Retirée') { toast('Impossible d\'annuler une commande déjà retirée','error'); return; }
  confirmer('Annuler la commande ' + escHtml(id) + ' de ' + escHtml(c.client) + ' ?<br><span style="font-size:0.78rem;color:var(--texte-2)">Le stock sera réapprovisionné et le compteur de fidélité du client corrigé.</span>', function() {
    if (ADMIN_CLOUD) { PharmaAdminCloud.annuler(id); return; }
    defaireCommande(c);
    c.statut = 'Annulée';
    persist();
    filtrerCommandes();
    toast('Commande ' + id + ' annulée : stock et fidélité mis à jour');
  }, { titre: 'Annuler la commande', bouton: 'Oui, annuler la commande' });
}

// Supprimer définitivement (efface aussi la trace côté client)
function deleteCommande(id) {
  var c = DATA.commandes.find(function(x){ return x.id === id; });
  if (!c) return;
  confirmer('Supprimer définitivement la commande ' + escHtml(id) + ' ?<br><span style="font-size:0.78rem;color:var(--texte-2)">Cette action est irréversible. Préférez « Annuler » pour garder une trace.</span>', function() {
    if (ADMIN_CLOUD) { PharmaAdminCloud.supprimer(id); return; }
    // Si elle n'était ni annulée ni retirée, le stock lui est encore réservé
    if (c.statut !== 'Annulée' && c.statut !== 'Retirée') defaireCommande(c);
    DATA.commandes = DATA.commandes.filter(function(x){ return x.id !== id; });
    persist();
    filtrerCommandes();
    toast('Commande ' + id + ' supprimée');
  });
}

// Remet en stock les produits d'une commande (annulation / suppression)
function restaurerStock(commande) {
  // Commandes récentes : détail exact des articles enregistré à la commande
  if (Array.isArray(commande.lignes) && commande.lignes.length) {
    commande.lignes.forEach(function(l) {
      var p = DATA.produits.find(function(x){ return x.id === l.produitId; });
      if (p) p.stock += (parseInt(l.qty, 10) || 0) * (parseInt(l.unites, 10) || 1);
    });
    return;
  }
  // Anciennes commandes : on retrouve les articles à partir du résumé texte
  (commande.produits || '').split(' + ').forEach(function(part) {
    var m = part.match(/^(.*?)\s+x(\d+)$/);
    if (!m) return;
    var nom = m[1].trim();
    var qte = parseInt(m[2], 10);
    var p = DATA.produits.find(function(x){ return x.nom === nom; });
    var unites = 1;
    if (!p) {
      // Article promo (lot) : correspondance approximative sur le premier mot
      var premierMot = nom.replace(/^Lot\s+/i, '').split(' ')[0].toLowerCase();
      p = DATA.produits.find(function(x){ return x.nom.toLowerCase().indexOf(premierMot) !== -1; });
      // Un lot contient plusieurs unités du produit : on restitue le bon total.
      var promo = DATA.promos.find(function(pr){ return pr.produit === nom; });
      if (promo && promo.qte > 0) {
        unites = promo.qte;
      } else {
        var mLot = nom.match(/x\s*(\d+)\s*$/i);
        if (mLot) unites = parseInt(mLot[1], 10);
      }
    }
    if (p) p.stock += qte * unites;
  });
}

// Défait les effets d'une commande non retirée : stock remis en rayon, compteur de
// fidélité et dépenses du client diminués, code promo utilisé rendu, code fidélité
// déclenché par cette commande retiré s'il n'a pas servi (5 fausses commandes ≠ un code).
function defaireCommande(c) {
  restaurerStock(c);
  var client = DATA.clients.find(function(x){ return c.clientId !== undefined && x.id === c.clientId; })
    || PharmaClients.trouver(DATA, c.client, c.email);
  if (client) {
    client.achats = Math.max(0, (client.achats || 0) - 1);
    client.depenses = Math.max(0, Math.round(((client.depenses || 0) - (c.total || 0)) * 100) / 100);
  }
  if (c.codePromo) {
    var cp = DATA.codesPromo.find(function(x){ return x.code === c.codePromo; });
    if (cp && cp.usages > 0) cp.usages -= 1;
  }
  DATA.codesPromo = DATA.codesPromo.filter(function(x) {
    return !(x.commandeId && x.commandeId === c.id && !x.usages && String(x.origine || '').indexOf('Auto (fidélité)') === 0);
  });
}

// Vide toutes les commandes de démonstration (données de test)
function viderCommandesDemo() {
  if (ADMIN_CLOUD) {
    toast('Avec la base de données, les commandes s\'annulent ou se suppriment une par une (pour ne jamais effacer de vraies commandes par erreur)', 'error');
    return;
  }
  confirmer('Supprimer TOUTES les commandes ?<br><span style="font-size:0.78rem;color:var(--texte-2)">Utile pour repartir sur des données propres pendant les tests.</span>', function() {
    DATA.commandes = [];
    persist();
    filtrerCommandes();
    toast('Toutes les commandes ont été supprimées');
  });
}

// ── CLOCHE DE NOTIFICATIONS ─────────────────────────────────
var NOTIF_STYLES = {
  commande: { couleur:'var(--vert)',  svg:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
  stock:    { couleur:'var(--rouge)', svg:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  ticket:   { couleur:'var(--or)',    svg:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/>' },
  fidelite: { couleur:'var(--bleu)',  svg:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' }
};
var _titreOriginal = document.title;
var _clignoteTimer = null;

function nbAlertesNonLues() {
  return (DATA.alertes || []).filter(function(a){ return !a.lu; }).length;
}

function renderNotifCloche(animer) {
  var nb = nbAlertesNonLues();
  var badge = document.getElementById('notif-count');
  if (badge) {
    badge.textContent = nb > 9 ? '9+' : nb;
    badge.style.display = nb > 0 ? '' : 'none';
  }
  var bell = document.getElementById('notif-bell');
  if (bell && animer && nb > 0) {
    bell.classList.remove('has-new');
    void bell.offsetWidth; // force le redémarrage de l'animation
    bell.classList.add('has-new');
  }
  majTitreOnglet(nb);
  renderNotifPanel();
}

// Fait clignoter le titre de l'onglet : l'employé voit l'alerte
// même si l'admin est ouvert en arrière-plan.
function majTitreOnglet(nb) {
  if (_clignoteTimer) { clearInterval(_clignoteTimer); _clignoteTimer = null; }
  if (nb > 0 && document.hidden) {
    var alterne = false;
    _clignoteTimer = setInterval(function() {
      document.title = alterne ? _titreOriginal : '(' + nb + ') Nouvelle activité';
      alterne = !alterne;
    }, 1200);
  } else {
    document.title = nb > 0 ? '(' + nb + ') ' + _titreOriginal : _titreOriginal;
  }
}

function renderNotifPanel() {
  var box = document.getElementById('notif-panel-body');
  if (!box) return;
  var liste = DATA.alertes || [];
  if (!liste.length) {
    box.innerHTML = '<div class="notif-vide">Aucune notification pour le moment.</div>';
    return;
  }
  box.innerHTML = liste.map(function(a) {
    var st = NOTIF_STYLES[a.type] || NOTIF_STYLES.commande;
    return '<div class="notif-item'+(a.lu?'':' unread')+'" onclick="ouvrirAlerte('+a.id+')">'
      + '<div class="notif-icon" style="background:'+st.couleur+'"><svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+st.svg+'</svg></div>'
      + '<div class="notif-body"><div class="notif-titre">'+escHtml(a.titre)+'</div>'
      + '<div class="notif-texte">'+escHtml(a.texte)+'</div>'
      + '<div class="notif-heure">'+tempsRelatif(a.timestamp)+'</div></div>'
      + (a.lu ? '' : '<span class="notif-dot"></span>')
      + '</div>';
  }).join('');
}

// Affiche "il y a 5 min" plutôt qu'une date brute
function tempsRelatif(iso) {
  if (!iso) return '';
  var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return 'Il y a ' + Math.floor(diff/60) + ' min';
  if (diff < 86400) return 'Il y a ' + Math.floor(diff/3600) + ' h';
  var d = new Date(iso);
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' à '+('0'+d.getHours()).slice(-2)+'h'+('0'+d.getMinutes()).slice(-2);
}

function toggleNotifPanel() {
  var panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifPanel();
}

function ouvrirAlerte(id) {
  var a = (DATA.alertes || []).find(function(x){ return x.id === id; });
  if (!a) return;
  if (!a.lu) { a.lu = true; persist(); }
  var panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open');
  renderNotifCloche(false);
  if (a.lien) go(a.lien);
}

function marquerToutLu() {
  (DATA.alertes || []).forEach(function(a){ a.lu = true; });
  persist();
  renderNotifCloche(false);
  toast('Notifications marquées comme lues');
}

// Détection des nouvelles alertes créées depuis un autre onglet
// (ex. une commande passée sur site.html pendant que l'admin est ouvert).
function initNotifSync() {
  window.addEventListener('storage', function(e) {
    if (e.key !== PHARMA_STORAGE_KEY) return;
    var avant = nbAlertesNonLues();
    DATA = PharmaStore.load();
    var apres = nbAlertesNonLues();
    renderNotifCloche(apres > avant);
    updateNavBadges();
    // Rafraîchit la page courante pour refléter les nouvelles données
    // Pages à formulaire (Paramètres, Horaires) : on ne les redessine pas, sinon une saisie
    // en cours serait effacée dès qu'un client passe commande dans un autre onglet.
    if (typeof currentPage === 'string' && ['parametres', 'horaires'].indexOf(currentPage) === -1) renderPage(currentPage);
    if (apres > avant) toast('Nouvelle activité reçue');
  });
  // Le clignotement du titre s'arrête quand l'employé revient sur l'onglet
  document.addEventListener('visibilitychange', function() {
    majTitreOnglet(nbAlertesNonLues());
  });
  // Ferme le panneau au clic extérieur
  document.addEventListener('click', function(e) {
    var wrap = document.querySelector('.notif-wrap');
    var panel = document.getElementById('notif-panel');
    if (wrap && panel && !wrap.contains(e.target)) panel.classList.remove('open');
  });
}

// ── INFORMATIONS LÉGALES ────────────────────────────────────
var LEGAL_CHAMPS = {
  'lg-raison':'raisonSociale', 'lg-forme':'formeJuridique', 'lg-capital':'capital',
  'lg-siret':'siret', 'lg-rcs':'rcs', 'lg-tva':'tva', 'lg-titulaire':'titulaire',
  'lg-ordre':'numeroOrdre', 'lg-directeur':'directeurPublication',
  'lg-mediateur':'mediateur', 'lg-ars':'ars', 'lg-licence':'licence',
  'lg-hebergeur':'hebergeur', 'lg-hebergeur-tel':'hebergeurTel'
};
function renderLegal() {
  var l = DATA.parametres.legal || {};
  Object.keys(LEGAL_CHAMPS).forEach(function(id) {
    setVal(id, l[LEGAL_CHAMPS[id]] || '');
  });
  majAlerteLegal();
}
// Signale les champs encore à compléter : le site ne doit pas être publié tant qu'il en reste.
function majAlerteLegal() {
  var l = DATA.parametres.legal || {};
  var manquants = Object.keys(LEGAL_CHAMPS).filter(function(id) {
    var v = l[LEGAL_CHAMPS[id]];
    return !v || String(v).indexOf('[') === 0;
  });
  var box = document.getElementById('lg-alerte');
  if (!box) return;
  if (!manquants.length) {
    box.innerHTML = '<div style="background:rgba(46,204,122,0.12);border:1px solid rgba(46,204,122,0.4);border-radius:8px;padding:10px 13px;font-size:0.78rem;color:var(--vert)"><strong>Informations complètes.</strong> Le site peut être mis en ligne.</div>';
  } else {
    box.innerHTML = '<div style="background:rgba(217,164,65,0.14);border:1px solid rgba(217,164,65,0.5);border-radius:8px;padding:10px 13px;font-size:0.78rem;color:#8a6414"><strong>'
      + manquants.length + ' information(s) à compléter</strong> avant la mise en ligne publique. Une absence de mentions légales conformes expose à des sanctions.</div>';
  }
}
function saveLegal() {
  if (!DATA.parametres.legal) DATA.parametres.legal = {};
  Object.keys(LEGAL_CHAMPS).forEach(function(id) {
    DATA.parametres.legal[LEGAL_CHAMPS[id]] = (getVal(id) || '').trim();
  });
  persist();
  majAlerteLegal();
  toast('Informations légales sauvegardées');
}

// ── CLIENTS ─────────────────────────────────────────────────
function renderClients(filtre, type) {
  var html = '';
  // Carte de fidélité scannée dans la recherche (« FID-000123 ») : le client est retrouvé par son numéro
  var idCarte = pharmaIdDepuisCarte(filtre);
  var list = DATA.clients.filter(function(c) {
    var ms = idCarte !== null ? c.id === idCarte : (!filtre || searchMatch(c.nom+' '+c.email+' '+c.tel, filtre));
    var mt = !type || type==='Tous' || c.type===type;
    return ms && mt;
  });
  if (list.length === 0) html = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--texte-3)">Aucun client trouvé</td></tr>';
  list.forEach(function(c) {
    var fidCfg = PharmaFidelite.config(DATA);
    var fidProg = PharmaFidelite.progression(c.achats, fidCfg.seuil);
    html += '<tr>';
    html += '<td><div class="td-main">'+escHtml(c.nom)+'</div><div class="td-sub">'+escHtml(c.email)+'</div></td>';
    html += '<td><span class="badge '+(c.type==='Compte'?'b-green':'b-grey')+'">'+escHtml(c.type)+'</span></td>';
    html += '<td>'+escHtml(c.notifs)+'</td>';
    html += '<td><span class="badge '+(c.rgpd?'b-green':'b-or')+'">'+(c.rgpd?'Consenti':'Partiel')+'</span></td>';
    html += '<td>'+nombre(c.achats)+' achats · '+nombre(c.depenses).toFixed(2)+'€</td>';
    html += '<td><div class="flex-gap"><div class="progress" style="width:60px"><div class="progress-fill" style="width:'+fidProg.pct+'%"></div></div><span class="txt-muted">'+fidProg.courant+'/'+fidCfg.seuil+'</span></div></td>';
    html += '<td class="actions-cell"><div><button class="act-btn" onclick="editClient('+c.id+')">'+svgEdit()+'</button><button class="act-btn" style="color:var(--rouge)" onclick="deleteClient('+c.id+',\''+escAttr(c.nom)+'\')">'+svgTrash()+'</button></div></td>';
    html += '</tr>';
  });
  setHTML('tbody-clients', html);
}

function editClient(id) {
  var c = DATA.clients.find(function(x){ return x.id===id; });
  if (!c) return;
  setVal('cl-nom', c.nom); setVal('cl-email', c.email); setVal('cl-tel', c.tel);
  document.getElementById('cl-type').value = c.type;
  document.getElementById('cl-id').value = id;
  openModal('m-client');
}

function saveClient() {
  var id = parseInt(document.getElementById('cl-id').value);
  var nom = (getVal('cl-nom') || '').trim(), email = (getVal('cl-email') || '').trim();
  if (!nom) { toast('Le nom est obligatoire', 'error'); return; }
  if (email && !pharmaEmailValide(email)) { toast('Adresse email invalide', 'error'); return; }
  // L'email identifie le client (fidélité, historique) : deux fiches ne peuvent pas partager la même adresse
  if (email && DATA.clients.some(function(x){ return x.id !== id && PharmaClients.normEmail(x.email) === PharmaClients.normEmail(email); })) {
    toast('Un autre client utilise déjà cette adresse email', 'error'); return;
  }
  if (id) {
    var c = DATA.clients.find(function(x){ return x.id===id; });
    if (c) { c.nom=nom; c.email=email; c.tel=getVal('cl-tel'); c.type=getVal('cl-type'); }
    toast('Client modifié');
  } else {
    var newId = DATA.clients.length ? Math.max.apply(null,DATA.clients.map(function(x){return x.id;}))+1 : 1;
    DATA.clients.push({ id:newId, nom:nom, email:email, tel:getVal('cl-tel'), type:getVal('cl-type'), notifs:'Email', rgpd:false, achats:0, depenses:0 });
    toast('Client ajouté');
  }
  closeModal('m-client');
  renderClients();
  resetForm('form-client');
  persist();
}

function deleteClient(id, nom) {
  confirmer('Supprimer le client "'+escHtml(nom)+'" ?', function() {
    DATA.clients = DATA.clients.filter(function(c){ return c.id!==id; });
    renderClients(); toast(nom+' supprimé');
    persist();
  });
}

// ── COMMANDES ───────────────────────────────────────────────
function renderCommandes(filtre, statut) {
  var html = '';
  var list = DATA.commandes.filter(function(c) {
    var ms = !filtre || searchMatch(c.id+' '+c.client+' '+c.produits, filtre);
    var mst = !statut || statut==='Tous' || c.statut===statut;
    return ms && mst;
  });
  if (!list.length) html = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--texte-3)">Aucune commande</td></tr>';
  list.forEach(function(c) {
    var bc = c.statut==='Prête'?'b-green':c.statut==='Retirée'?'b-blue':c.statut==='Annulée'?'b-red':'b-orange';
    html += '<tr>';
    html += '<td><strong>'+escHtml(c.id)+'</strong></td>';
    html += '<td><div class="td-main">'+escHtml(c.client)+'</div><div class="td-sub">'+escHtml(c.tel)+'</div></td>';
    html += '<td class="txt-muted">'+escHtml(c.produits)+'</td>';
    html += '<td><strong>'+nombre(c.total).toFixed(2)+'€</strong></td>';
    html += '<td class="txt-muted">'+escHtml(c.date)+'</td>';
    html += '<td>'+(c.valide?'<span class="badge b-green">'+escHtml(c.valide)+'</span>':'<span class="badge b-grey">En attente</span>')+'</td>';
    html += '<td><span class="badge '+bc+'">'+escHtml(c.statut)+'</span></td>';
    html += '<td class="actions-cell"><div><button class="act-btn" onclick="voirCommande(\''+escAttr(c.id)+'\')" title="Voir le détail">'+svgEye()+'</button>'
      + (c.statut==='En préparation'?'<button class="btn btn-primary" style="height:26px;font-size:0.7rem;padding:0 10px" onclick="marquerPrete(\''+escAttr(c.id)+'\')">Prête</button>':'')
      + (c.statut!=='Retirée' && c.statut!=='Annulée' ? '<button class="act-btn" style="color:var(--or)" onclick="annulerCommande(\''+escAttr(c.id)+'\')" title="Annuler la commande"><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>':'')
      + '<button class="act-btn" style="color:var(--rouge)" onclick="deleteCommande(\''+escAttr(c.id)+'\')" title="Supprimer définitivement">'+svgTrash()+'</button>'
      + '</div></td>';
    html += '</tr>';
  });
  setHTML('tbody-commandes', html);
}

function voirCommande(id) {
  var c = DATA.commandes.find(function(x){ return x.id===id; });
  if (!c) return;
  var bc = c.statut==='Prête'?'b-green':c.statut==='Retirée'?'b-blue':'b-orange';
  var body = '<div class="flex-between mb3"><div><div class="td-main">'+escHtml(c.client)+'</div><div class="td-sub">'+escHtml(c.tel)+(c.email ? ' · '+escHtml(c.email) : '')+'</div></div><span class="badge '+bc+'">'+escHtml(c.statut)+'</span></div>';
  body += '<div style="background:var(--fond);border-radius:8px;padding:12px;border:1px solid var(--bord);font-size:0.82rem;margin-bottom:12px">'+escHtml(c.produits)+'</div>';
  if (c.codeRetrait) body += '<div class="txt-muted" style="margin-bottom:12px">Code de retrait : <strong style="letter-spacing:2px">'+escHtml(c.codeRetrait)+'</strong></div>';
  body += '<div style="text-align:right;font-weight:800;margin-bottom:12px">Total : '+nombre(c.total).toFixed(2)+'€</div>';
  body += '<div style="background:var(--fond);border-radius:8px;padding:12px;border:1px solid var(--bord)"><div style="font-size:0.65rem;font-weight:700;color:var(--texte-3);text-transform:uppercase;margin-bottom:6px">Historique</div>';
  body += '<div class="txt-muted">Commande reçue — '+escHtml(c.date)+'</div>';
  if (c.statut !== 'En préparation') body += '<div class="txt-muted">Marquée prête — validée par '+escHtml(c.valide||'—')+'</div>';
  if (c.statut === 'Retirée') body += '<div class="txt-muted">Retirée en pharmacie</div>';
  body += '</div>';
  body += blocEmailPrerempliHTML(c);
  var footer = '<button class="btn btn-ghost" onclick="closeModal(\'m-detail\')">Fermer</button>';
  if (c.statut === 'En préparation') footer += '<button class="btn btn-primary" onclick="marquerPrete(\''+escAttr(c.id)+'\');closeModal(\'m-detail\')">Marquer prête & Notifier</button>';
  showDetail('Commande '+c.id, body, footer);
}

function marquerPrete(id) {
  // Base de données : le serveur change le statut et signe la validation
  if (ADMIN_CLOUD) {
    PharmaAdminCloud.marquerPrete(id).then(function(ok) { if (ok) notifierCommandePrete(id); });
    return;
  }
  var c = DATA.commandes.find(function(x){ return x.id===id; });
  if (!c) return;
  c.statut = 'Prête';
  c.valide = nomValideur();
  persist();
  renderCommandes();
  notifierCommandePrete(id);
}

// Email « commande prête » au client (et proposition de l'email prérempli si l'envoi échoue)
function notifierCommandePrete(id) {
  var c = DATA.commandes.find(function(x){ return x.id===id; });
  if (!c) return;
  if (typeof PharmaEmail === 'undefined') { toast('Commande '+id+' prête'); return; }
  // Email « commande prête » : asynchrone et tolérant. Le statut est déjà enregistré,
  // un échec d'envoi ne bloque rien et est signalé à l'employé.
  var ctx = { commande: {
    id: c.id, client: c.client, email: c.email, produits: c.produits, total: c.total,
    timestamp: c.timestamp, lang: c.lang, codeRetrait: c.codeRetrait
  } };
  PharmaEmail.envoyer('commandePrete', DATA, ctx).then(function(r) {
    DATA = PharmaStore.load(); // le journal d'envoi a été écrit en base
    if (currentPage === 'commandes') renderCommandes();
    if (currentPage === 'notifications') renderEmailJournal();
    if (currentPage === 'parametres') renderEtatQuota();
    renderQuotaTableauDeBord();
    if (r && r.ok) { toast('Client notifié par email — Commande '+id+' prête'); return; }
    if (r && r.ignore) toast('Commande '+id+' prête (email non envoyé : '+r.raison+')');
    else toast('Commande '+id+' prête, mais l\'email n\'a pas pu être envoyé','error');
    // Proposition immédiate de l'email « commande prête » prérempli, à envoyer soi-même :
    // si l'envoi a échoué, ou si les emails automatiques sont coupés (quota épuisé…).
    // Pas de fenêtre quand la pharmacie a volontairement désactivé ce type d'email dans Notifications.
    var proposer = !(r && r.ignore) || /non configuré/.test(String(r.raison || ''));
    var c2 = DATA.commandes.find(function(x){ return x.id === id; });
    if (proposer && c2 && PharmaEmail.emailValide(c2.email)) {
      showDetail('Prévenir le client — Commande '+id,
        '<div class="txt-muted" style="font-size:0.8rem">L\'email automatique n\'est pas parti. Envoyez-le depuis votre messagerie : tout est déjà rédigé.</div>' + blocEmailPrerempliHTML(c2),
        '<button class="btn btn-ghost" onclick="closeModal(\'m-detail\')">Fermer</button>');
    }
  });
}

// ── TICKETS ─────────────────────────────────────────────────
function renderTickets(filtre, statut) {
  var html = '';
  var list = DATA.tickets.filter(function(t) {
    var ms = !filtre || searchMatch(t.id+' '+t.client+' '+t.sujet+' '+t.type, filtre);
    var mst = !statut || statut==='Tous' || t.statut===statut;
    return ms && mst;
  });
  if (!list.length) html = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--texte-3)">Aucun ticket</td></tr>';
  list.forEach(function(t) {
    var bcp = t.priorite==='Urgent'?'b-red pulse':'b-grey';
    var bcs = t.statut==='Ouvert'?'b-red':t.statut==='En cours'?'b-orange':'b-green';
    html += '<tr>';
    html += '<td><strong>'+escHtml(t.id)+'</strong></td>';
    html += '<td>'+escHtml(t.client)+'</td>';
    html += '<td class="txt-muted">'+escHtml(t.type)+'</td>';
    html += '<td><div class="td-main">'+escHtml(t.sujet)+'</div></td>';
    html += '<td>'+(t.commande?'<span class="badge b-blue">'+escHtml(t.commande)+'</span>':'—')+'</td>';
    html += '<td>'+(t.doc?'<span class="badge b-blue">1 fichier</span>':'—')+'</td>';
    html += '<td><span class="badge '+bcp+'">'+escHtml(t.priorite)+'</span></td>';
    html += '<td><span class="badge '+bcs+'">'+escHtml(t.statut)+'</span></td>';
    html += '<td class="actions-cell"><div><button class="btn '+(t.statut==='Ouvert'?'btn-primary':'btn-ghost')+'" style="height:26px;font-size:0.7rem;padding:0 10px" onclick="voirTicket(\''+escAttr(t.id)+'\')">'+(t.statut==='Ouvert'?'Répondre':'Voir')+'</button></div></td>';
    html += '</tr>';
  });
  setHTML('tbody-tickets', html);
}

function voirTicket(id) {
  var t = DATA.tickets.find(function(x){ return x.id===id; });
  if (!t) return;
  var body = '<div class="flex-gap mb3"><span class="badge '+(t.priorite==='Urgent'?'b-red':'b-grey')+'">'+escHtml(t.priorite)+'</span><span class="badge b-orange">'+escHtml(t.type)+'</span>'+(t.commande?'<span class="badge b-blue">'+escHtml(t.commande)+'</span>':'')+'</div>';
  body += '<div class="msg mb3"><div><div class="msg-bubble msg-client">'+escHtml(t.sujet)+'</div><div class="msg-meta">'+escHtml(t.client)+'</div></div></div>';
  (Array.isArray(t.historique) ? t.historique : []).forEach(function(h) {
    var d = new Date(h.date);
    var quand = isNaN(d) ? '' : ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+('0'+d.getHours()).slice(-2)+'h'+('0'+d.getMinutes()).slice(-2);
    body += '<div class="msg mb3" style="text-align:right"><div><div class="msg-bubble '+(h.type==='note'?'msg-note" style="background:var(--or-pale);color:var(--texte)':'msg-admin')+'">'+escHtml(h.texte)+'</div>'
      + '<div class="msg-meta">'+(h.type==='note'?'Note interne · ':'Réponse · ')+escHtml(h.auteur)+' · '+escHtml(quand)+'</div></div></div>';
  });
  body += '<hr><div class="form-group mb3"><label>Répondre au client</label><textarea id="ticket-reponse" placeholder="Votre réponse..."></textarea></div>';
  body += '<div class="form-group"><label>Note interne (invisible par le client)</label><textarea id="ticket-note" placeholder="Note interne..." style="background:var(--or-pale)"></textarea></div>';
  var footer = '<button class="btn btn-ghost" onclick="closeModal(\'m-detail\')">Fermer</button>';
  footer += '<button class="btn btn-ghost" onclick="resoudreTicket(\''+escAttr(id)+'\')">Marquer résolu</button>';
  footer += '<button class="btn btn-primary" onclick="repondreTicket(\''+escAttr(id)+'\')">Envoyer réponse</button>';
  showDetail('Ticket '+id+' — '+t.client, body, footer);
}

function repondreTicket(id) {
  var t = DATA.tickets.find(function(x){ return x.id===id; });
  if (!t) return;
  var reponse = (getVal('ticket-reponse') || '').trim();
  var note = (getVal('ticket-note') || '').trim();
  if (!reponse && !note) { toast('Écrivez une réponse ou une note interne', 'error'); return; }
  if (!Array.isArray(t.historique)) t.historique = [];
  var maintenant = new Date().toISOString();
  if (reponse) { t.historique.push({ type:'reponse', texte:reponse, auteur:nomValideur(), date:maintenant }); t.statut = 'En cours'; }
  if (note) t.historique.push({ type:'note', texte:note, auteur:nomValideur(), date:maintenant });
  closeModal('m-detail');
  renderTickets();
  // L'envoi au client par email arrivera avec la messagerie du serveur : on ne prétend pas l'avoir envoyé
  toast(reponse ? 'Réponse enregistrée dans le ticket (à transmettre au client par téléphone ou email en attendant l\'envoi automatique)' : 'Note interne enregistrée');
  persist();
}

function resoudreTicket(id) {
  var t = DATA.tickets.find(function(x){ return x.id===id; });
  if (t) t.statut = 'Résolu';
  closeModal('m-detail');
  renderTickets();
  toast('Ticket '+id+' marqué résolu');
  persist();
}

// ── EMPLOYES ────────────────────────────────────────────────
function renderEmployes() {
  var html = '';
  DATA.employes.forEach(function(e) {
    html += '<tr>';
    html += '<td><div class="td-main">'+escHtml(e.nom)+'</div><div class="td-sub">'+escHtml(e.email)+'</div></td>';
    html += '<td><span class="badge '+(e.role==='Admin'?'b-red':'b-blue')+'">'+escHtml(e.role)+'</span></td>';
    html += '<td class="txt-muted">'+escHtml(e.acces)+'</td>';
    html += '<td><span class="badge '+(e.actif?'b-green':'b-grey')+'">'+(e.actif?'Actif':'Inactif')+'</span></td>';
    html += '<td class="actions-cell"><div>';
    if (currentUser.role === 'Admin') {
      html += '<button class="act-btn" onclick="editEmploye('+e.id+')">'+svgEdit()+'</button>';
      if (e.role !== 'Admin') html += '<button class="act-btn" style="color:var(--rouge)" onclick="deleteEmploye('+e.id+',\''+escAttr(e.nom)+'\')">'+svgTrash()+'</button>';
    }
    html += '</div></td></tr>';
  });
  setHTML('tbody-employes', html);
}

function editEmploye(id) {
  var e = DATA.employes.find(function(x){ return x.id===id; });
  if (!e) return;
  setVal('emp-nom', e.nom); setVal('emp-email', e.email);
  document.getElementById('emp-role').value = e.role;
  document.getElementById('emp-id').value = id;
  openModal('m-employe');
}

function saveEmploye() {
  var id = parseInt(document.getElementById('emp-id').value);
  var nom = (getVal('emp-nom') || '').trim(), email = (getVal('emp-email') || '').trim(), role = getVal('emp-role');
  if (!nom) { toast('Le nom est obligatoire', 'error'); return; }
  if (email && !pharmaEmailValide(email)) { toast('Adresse email invalide', 'error'); return; }
  if (id) {
    var e = DATA.employes.find(function(x){ return x.id===id; });
    if (e) { e.nom=nom; e.email=email; e.role=role; e.acces=role==='Admin'?'Tout':'Commandes + Tickets'; }
    toast('Employé modifié');
  } else {
    var nid = DATA.employes.length ? Math.max.apply(null,DATA.employes.map(function(x){return x.id;}))+1 : 1;
    DATA.employes.push({ id:nid, nom:nom, email:email, role:role, acces:role==='Admin'?'Tout':'Commandes + Tickets', actif:true });
    toast('Employé ajouté');
  }
  closeModal('m-employe'); renderEmployes(); resetForm('form-employe');
  persist();
}

function deleteEmploye(id, nom) {
  confirmer('Supprimer le compte de "'+escHtml(nom)+'" ?', function() {
    DATA.employes = DATA.employes.filter(function(e){ return e.id!==id; });
    renderEmployes(); toast(nom+' supprimé');
    persist();
  });
}

// ── STOCKS ──────────────────────────────────────────────────
function renderStocks(filtre) {
  var html = '';
  var list = DATA.produits.filter(function(p) {
    return !filtre || searchMatch(p.nom+' '+p.ref, filtre);
  });
  list.forEach(function(p) {
    var bc = p.stock<=0?'b-red':p.stock<=p.seuil?'b-or':'b-green';
    var label = p.stock<=0?'Rupture':p.stock<=p.seuil?'Faible':'OK';
    html += '<tr>';
    html += '<td><div class="td-main">'+escHtml(p.nom)+'</div><div class="td-sub">'+escHtml(p.ref)+'</div></td>';
    html += '<td style="'+(p.stock<=0?'color:var(--rouge);font-weight:700':p.stock<=p.seuil?'color:var(--or);font-weight:700':'')+'">'+p.stock+'</td>';
    html += '<td>'+p.seuil+'</td>';
    html += '<td><span class="badge '+bc+'">'+label+'</span></td>';
    html += '<td class="actions-cell"><div><input class="inp" type="number" id="stock-'+p.id+'" value="'+p.stock+'" style="width:70px;height:30px"><button class="btn btn-primary" style="height:30px;font-size:0.7rem;padding:0 10px" onclick="updateStock('+p.id+')">Màj</button></div></td>';
    html += '</tr>';
  });
  setHTML('tbody-stocks', html);
}

function updateStock(id) {
  var p = DATA.produits.find(function(x){ return x.id===id; });
  var input = document.getElementById('stock-'+id);
  if (p && input) {
    var v = input.value === '' ? NaN : Number(input.value);
    if (!Number.isInteger(v) || v < 0) { toast('Le stock doit être un nombre entier positif ou nul','error'); return; }
    p.stock = v;
    renderStocks();
    toast('Stock de "'+p.nom+'" mis à jour : '+p.stock+' unités');
    persist();
  }
}

// ── MESSAGES INTERNES ───────────────────────────────────────
function renderMessages() {
  var html = '';
  DATA.messages.forEach(function(m) {
    var isMe = m.de === currentUser.nom;
    html += '<div style="display:flex;flex-direction:column;align-items:'+(isMe?'flex-end':'flex-start');
    html += ';margin-bottom:12px">';
    html += '<div class="msg-bubble '+(isMe?'msg-admin':'msg-client')+'">'+escHtml(m.msg)+'</div>';
    html += '<div class="msg-meta">'+(isMe?'Vous':escHtml(m.de))+' · '+escHtml(m.heure)+'</div></div>';
  });
  setHTML('messages-thread', html);
  // Marquer tous comme lus
  var hadUnread = DATA.messages.some(function(m){ return !m.lu; });
  DATA.messages.forEach(function(m){ m.lu=true; });
  if (hadUnread) persist();
  var badge = document.getElementById('msg-badge');
  if (badge) { badge.textContent=''; badge.style.display='none'; }
  // Scroll bas
  var thread = document.getElementById('messages-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function envoyerMessage() {
  var inp = document.getElementById('msg-input');
  if (!inp || !inp.value.trim()) return;
  var now = new Date();
  var heure = now.getHours()+'h'+(now.getMinutes()<10?'0':'')+now.getMinutes();
  DATA.messages.push({ id:DATA.messages.length+1, de:currentUser.nom, msg:inp.value.trim(), heure:heure, lu:true });
  inp.value = '';
  renderMessages();
  persist();
}

// ── HORAIRES ────────────────────────────────────────────────
function renderHoraires() {
  var jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  jours.forEach(function(j) {
    var h = (DATA.horaires && DATA.horaires[j]) || { ouvert: false, debut: '', fin: '' };
    var tog = document.getElementById('h-'+j);
    var deb = document.getElementById('h-'+j+'-deb');
    var fin = document.getElementById('h-'+j+'-fin');
    if (tog) tog.checked = h.ouvert;
    if (deb) deb.value = h.debut;
    if (fin) fin.value = h.fin;
  });
  // Jours spéciaux
  var html = '';
  DATA.joursSpeciaux.forEach(function(js, i) {
    var bg = js.type==='Fermeture'?'background:var(--rouge-pale);border-color:rgba(229,83,83,0.2)':'';
    html += '<div class="sday" style="'+bg+'">';
    html += '<div><div class="sday-date">'+escHtml(js.date)+'</div><div class="sday-type">'+escHtml(js.type)+'</div></div>';
    html += '<div class="sday-hrs" style="'+(js.type==='Fermeture'?'color:var(--rouge)':'')+'">'+(js.type==='Fermeture'?'Fermé':escHtml(js.debut)+' – '+escHtml(js.fin))+'</div>';
    html += '<button class="act-btn" onclick="deleteJourSpecial('+i+')">'+svgTrash()+'</button>';
    html += '</div>';
  });
  setHTML('jours-speciaux-list', html || '<div class="txt-muted" style="padding:10px">Aucun jour spécial</div>');
  // Bandeau
  var bTog = document.getElementById('bandeau-tog');
  var bMsg = document.getElementById('bandeau-msg');
  if (bTog) bTog.checked = DATA.parametres.bandeauActif;
  if (bMsg) bMsg.value = DATA.parametres.bandeauMsg;
}

function saveHoraires() {
  var jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var nouveaux = {};
  for (var i = 0; i < jours.length; i++) {
    var j = jours[i];
    var tog = document.getElementById('h-'+j);
    var deb = document.getElementById('h-'+j+'-deb');
    var fin = document.getElementById('h-'+j+'-fin');
    var h = { ouvert: tog?tog.checked:false, debut: deb?deb.value:'', fin: fin?fin.value:'' };
    if (h.ouvert && (!h.debut || !h.fin)) { toast('Indiquez l\'heure d\'ouverture et de fermeture du '+j, 'error'); return; }
    if (h.ouvert && h.fin <= h.debut) { toast('Le '+j+', l\'heure de fermeture doit être après l\'ouverture', 'error'); return; }
    nouveaux[j] = h;
  }
  DATA.horaires = nouveaux;
  toast('Horaires sauvegardés');
  persist();
}

function saveGarde() {
  var date = getVal('g-date'), type = getVal('g-type');
  var debut = getVal('g-debut'), fin = getVal('g-fin'), msg = getVal('g-msg');
  if (!date) { toast('La date est obligatoire','error'); return; }
  DATA.joursSpeciaux.push({ date:date, type:type, debut:debut, fin:fin, msg:msg });
  closeModal('m-garde');
  renderHoraires();
  toast('Jour spécial ajouté');
  persist();
}

function deleteJourSpecial(i) {
  confirmer('Supprimer ce jour spécial ?', function() {
    DATA.joursSpeciaux.splice(i, 1);
    renderHoraires();
    toast('Jour spécial supprimé');
    persist();
  });
}

function saveBandeau() {
  var tog = document.getElementById('bandeau-tog');
  var msg = document.getElementById('bandeau-msg');
  DATA.parametres.bandeauActif = tog ? tog.checked : false;
  DATA.parametres.bandeauMsg = msg ? msg.value : '';
  toast('Bandeau mis à jour');
  persist();
}

// ── PARAMETRES ──────────────────────────────────────────────
function renderParametres() {
  setVal('par-nom', DATA.parametres.nom);
  setVal('par-adresse', DATA.parametres.adresse);
  setVal('par-tel', DATA.parametres.tel);
  setVal('par-email', DATA.parametres.email);
  setVal('par-rapport-email', DATA.parametres.rapportEmail);
  setVal('par-couleur', DATA.parametres.couleurPrimaire || '#1B6B45');
  setVal('par-logo', DATA.parametres.logoTexte || DATA.parametres.nom);
  setVal('par-fid-seuil', DATA.parametres.fideliteSeuil || 5);
  setVal('par-fid-reduction', DATA.parametres.fideliteReduction || 10);
  var rj = document.getElementById('par-rapport-jour');
  var rh = document.getElementById('par-rapport-heure');
  var rt = document.getElementById('par-restriction');
  if (rj) rj.value = DATA.parametres.rapportJour;
  if (rh) rh.value = DATA.parametres.rapportHeure;
  if (rt) rt.checked = DATA.parametres.restrictionEmployes;
  renderLegal();
  renderEmailParams();
}

// Apparence : couleur principale + logo, appliqués aussi au site client
function saveApparence() {
  var couleur = getVal('par-couleur') || '#1B6B45';
  if (!/^#[0-9a-fA-F]{6}$/.test(couleur)) { toast('Couleur invalide','error'); return; }
  DATA.parametres.couleurPrimaire = couleur;
  DATA.parametres.logoTexte = (getVal('par-logo') || '').trim() || DATA.parametres.nom;
  persist();
  appliquerCouleur();
  toast('Apparence sauvegardée');
}

// Applique la couleur principale à l'interface admin en direct
function appliquerCouleur() {
  var c = DATA.parametres.couleurPrimaire;
  if (c) document.documentElement.style.setProperty('--vert', c);
  // Nom de la pharmacie dans la sidebar et le titre de l'onglet
  var nom = DATA.parametres.nom || 'Pharmacie';
  var logo = document.getElementById('admin-logo-name');
  if (logo) logo.textContent = nom;
  var equipe = document.getElementById('messages-nom-pharmacie');
  if (equipe) equipe.textContent = nom;
  document.title = nom + ' — Administration';
  _titreOriginal = document.title;
}

// Programme de fidélité : palier et réduction
function saveFidelite() {
  var seuil = parseInt(getVal('par-fid-seuil'), 10);
  var reduction = parseInt(getVal('par-fid-reduction'), 10);
  if (!seuil || seuil < 1) { toast('Le palier doit être d\'au moins 1 achat','error'); return; }
  if (!reduction || reduction < 1 || reduction > 100) { toast('La réduction doit être entre 1 et 100 %','error'); return; }
  DATA.parametres.fideliteSeuil = seuil;
  DATA.parametres.fideliteReduction = reduction;
  persist();
  toast('Programme de fidélité mis à jour : ' + seuil + ' achats = -' + reduction + '%');
}

function saveParametres() {
  var nom = (getVal('par-nom') || '').trim();
  var email = (getVal('par-email') || '').trim();
  if (!nom) { toast('Le nom de la pharmacie est obligatoire','error'); return; }
  if (email && !pharmaEmailValide(email)) { toast('Adresse email de la pharmacie invalide','error'); return; }
  DATA.parametres.nom = nom;
  DATA.parametres.adresse = (getVal('par-adresse') || '').trim();
  DATA.parametres.tel = (getVal('par-tel') || '').trim();
  DATA.parametres.email = email;
  toast('Paramètres sauvegardés');
  persist();
  appliquerCouleur();
}

// La restriction horaire s'enregistre dès qu'on bascule l'interrupteur
function saveRestriction(actif) {
  DATA.parametres.restrictionEmployes = !!actif;
  persist();
  toast(actif ? 'Restriction horaire activée pour les employés' : 'Restriction horaire désactivée');
}

// ── EMAILS (EmailJS) ────────────────────────────────────────
function renderEmailParams() {
  var c = (DATA.parametres.emailjs) || {};
  var tog = document.getElementById('em-actif');
  if (tog) tog.checked = c.actif === true;
  setVal('em-service', c.serviceId);
  setVal('em-template', c.templateId);
  setVal('em-key', c.publicKey);
  setVal('em-logo', c.logoUrl);
  setVal('em-site', c.siteUrl);
  var q = (typeof PharmaEmail !== 'undefined') ? PharmaEmail.quota(DATA) : null;
  setVal('em-quota', q ? String(q.restants) : '');
  renderEtatQuota();
}

// ── DÉCOMPTE DES EMAILS RESTANTS ────────────────────────────
function texteDateCourte(iso) {
  var d = new Date(iso);
  return isNaN(d) ? '' : ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2);
}
// Résumé du décompte (HTML sûr : uniquement des nombres et des textes fixes)
function resumeQuotaHTML(q, avecNote) {
  if (!q) return '<div class="txt-muted" style="font-size:0.78rem">Décompte non activé : saisissez le nombre d\'emails restants relevé dans EmailJS.</div>';
  var couleur = q.epuise ? 'var(--rouge)' : (q.alerte ? '#B07C00' : 'var(--vert)');
  var html = '<div style="font-size:0.82rem;line-height:1.5"><strong style="color:'+couleur+'">'+q.restants+' email'+(q.restants > 1 ? 's' : '')+' restant'+(q.restants > 1 ? 's' : '')+'</strong>'
    + ' <span class="txt-muted">· relevé : '+q.releve+(q.releveLe ? ' le '+texteDateCourte(q.releveLe) : '')+' · '+q.envoyes+' envoyé'+(q.envoyes > 1 ? 's' : '')+' depuis</span></div>';
  if (avecNote) html += '<div style="font-size:0.72rem;color:var(--texte-3);line-height:1.5;margin-top:4px">'
    + (ADMIN_CLOUD
      ? 'Tous les emails envoyés sont décomptés, y compris les confirmations parties du téléphone des clients. Recalez de temps en temps avec le chiffre d\'EmailJS.'
      : 'Tant que le site n\'est pas relié au serveur, seuls les emails partis de ce navigateur sont décomptés. Les confirmations partent du téléphone des clients : le chiffre réel peut être plus bas. Recalez-le de temps en temps avec celui d\'EmailJS.')
    + '</div>';
  if (q.epuise) html += '<div style="font-size:0.76rem;color:var(--rouge);margin-top:4px">Quota sans doute épuisé : utilisez l\'email prérempli depuis le détail de chaque commande.</div>';
  return html;
}
function renderEtatQuota() {
  var box = document.getElementById('em-quota-etat');
  if (box) box.innerHTML = resumeQuotaHTML(typeof PharmaEmail !== 'undefined' ? PharmaEmail.quota(DATA) : null, true);
}
function saveEmailQuota() {
  var brut = (getVal('em-quota') || '').trim();
  if (brut === '') {
    DATA.parametres.emailQuota = null;
    persist(); renderEtatQuota(); renderQuotaTableauDeBord();
    toast('Décompte des emails désactivé');
    return;
  }
  if (!/^\d{1,6}$/.test(brut)) { toast('Indiquez un nombre entier (0 ou plus)','error'); return; }
  var n = parseInt(brut, 10);
  DATA.parametres.emailQuota = { releve: n, releveLe: new Date().toISOString(), envoyes: 0 };
  persist(); renderEtatQuota(); renderQuotaTableauDeBord();
  toast('Décompte mis à jour : '+n+' email'+(n > 1 ? 's' : '')+' restant'+(n > 1 ? 's' : ''));
}
// Alerte du tableau de bord quand il reste peu d'emails (20 ou moins)
function renderQuotaTableauDeBord() {
  var box = document.getElementById('dash-quota');
  if (!box) return;
  var q = (typeof PharmaEmail !== 'undefined') ? PharmaEmail.quota(DATA) : null;
  if (!q || !q.alerte) { box.innerHTML = ''; return; }
  var fond = q.epuise ? 'var(--rouge-pale, rgba(229,83,83,0.1))' : 'var(--or-pale, rgba(217,164,65,0.14))';
  box.innerHTML = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:'+fond+';border:1px solid var(--bord);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:0.8rem">'
    + '<div style="flex:1;min-width:200px"><strong>'+(q.epuise ? 'Plus d\'emails automatiques ce mois-ci' : 'Il reste '+q.restants+' email'+(q.restants > 1 ? 's' : '')+' automatique'+(q.restants > 1 ? 's' : ''))+'</strong>'
    + '<div class="txt-muted" style="font-size:0.74rem">'+(q.epuise ? 'Prévenez les clients avec l\'email prérempli (détail de la commande).' : 'Pensez à vérifier le chiffre dans EmailJS. Le détail de chaque commande propose un email prérempli à envoyer vous-même.')+'</div></div>'
    + '<button class="btn btn-ghost" onclick="go(\'parametres\')">Voir le décompte</button></div>';
}

// ── EMAIL PRÉREMPLI (envoi manuel) ──────────────────────────
var TYPES_PREREMPLI = { commandeRecue: 'Confirmation de commande', commandePrete: 'Commande prête', codeFidelite: 'Code fidélité' };
function ctxEmailCommande(c, type) {
  var ctx = { commande: { id: c.id, client: c.client, email: c.email, produits: c.produits, total: c.total,
    timestamp: c.timestamp, lang: c.lang, codeRetrait: c.codeRetrait, codePromo: c.codePromo, remise: c.remise } };
  if (type === 'codeFidelite') {
    var code = (DATA.codesPromo || []).find(function(x){ return x && x.commandeId === c.id; });
    if (!code) return null;
    var cfg = PharmaFidelite.config(DATA);
    ctx.fidelite = { seuil: cfg.seuil, reduction: cfg.reduction };
    ctx.code = { code: code.code, pct: code.pct, expire: code.expire };
  }
  return ctx;
}
function preparerEmail(id, type) {
  if (typeof PharmaEmail === 'undefined') return null;
  var c = DATA.commandes.find(function(x){ return x.id === id; });
  if (!c || !PharmaEmail.emailValide(c.email)) return null;
  var ctx = ctxEmailCommande(c, type);
  return ctx ? PharmaEmail.prerempli(type, DATA, ctx) : null;
}
// Types d'email proposés pour une commande (selon son état)
function typesEmailCommande(c) {
  var t = ['commandeRecue'];
  if (c.statut === 'Prête') t.push('commandePrete');
  if ((DATA.codesPromo || []).some(function(x){ return x && x.commandeId === c.id; })) t.push('codeFidelite');
  return t;
}
function blocEmailPrerempliHTML(c) {
  if (typeof PharmaEmail === 'undefined') return '';
  if (!PharmaEmail.emailValide(c.email)) return '<div class="txt-muted" style="font-size:0.76rem;margin-top:12px">Pas d\'adresse email valide pour ce client : prévenez-le par téléphone.</div>';
  var echecs = (DATA.emailLog || []).filter(function(e){ return e && e.commande === c.id && e.statut === 'Échec'; }).length;
  var html = '<div style="background:var(--fond);border-radius:8px;padding:12px;border:1px solid var(--bord);margin-top:12px">'
    + '<div style="font-size:0.65rem;font-weight:700;color:var(--texte-3);text-transform:uppercase;margin-bottom:6px">Email au client, à envoyer vous-même</div>';
  if (echecs) html += '<div style="font-size:0.76rem;color:var(--rouge);margin-bottom:8px">L\'email automatique n\'est pas parti ('+echecs+' échec'+(echecs > 1 ? 's' : '')+'). Envoyez-le depuis votre messagerie :</div>';
  else html += '<div class="txt-muted" style="font-size:0.74rem;margin-bottom:8px">Ouvre votre messagerie avec l\'email déjà rédigé (sans consommer le quota EmailJS).</div>';
  typesEmailCommande(c).forEach(function(type) {
    var pre = preparerEmail(c.id, type);
    var lien = pre ? PharmaEmail.lienMailto(pre) : '';
    if (!lien) return;
    html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px"><span style="flex:1;min-width:140px;font-size:0.8rem;font-weight:600">'+escHtml(TYPES_PREREMPLI[type])+'</span>'
      + '<a class="btn btn-ghost" style="height:28px;font-size:0.72rem" href="'+escHtml(lien)+'" onclick="noterEmailManuel(\''+escAttr(c.id)+'\',\''+type+'\')">Ouvrir l\'email</a>'
      + '<button class="btn btn-ghost" style="height:28px;font-size:0.72rem" onclick="copierEmailPrerempli(\''+escAttr(c.id)+'\',\''+type+'\')">Copier le texte</button></div>';
  });
  return html + '</div>';
}
function noterEmailManuel(id, type) {
  var pre = preparerEmail(id, type);
  if (!pre) return;
  PharmaEmail.noterManuel(pre);
  DATA = PharmaStore.load();
  if (currentPage === 'notifications') renderEmailJournal();
}
function copierEmailPrerempli(id, type) {
  var pre = preparerEmail(id, type);
  if (!pre) { toast('Email impossible à préparer pour cette commande','error'); return; }
  var texte = 'À : ' + pre.destinataire + '\nObjet : ' + pre.sujet + '\n\n' + pre.corps;
  var fini = function() { noterEmailManuel(id, type); toast('Texte copié : collez-le dans votre messagerie'); };
  var secours = function() {
    var zone = document.createElement('textarea');
    zone.value = texte; zone.setAttribute('readonly', ''); zone.style.position = 'fixed'; zone.style.opacity = '0';
    document.body.appendChild(zone); zone.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(zone);
    if (ok) fini(); else toast('Copie impossible : utilisez « Ouvrir l\'email »','error');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(fini, secours);
    else secours();
  } catch (e) { secours(); }
}

function saveEmailParams() {
  var tog = document.getElementById('em-actif');
  var actif = tog ? tog.checked : false;
  var service = getVal('em-service').trim();
  var template = getVal('em-template').trim();
  var cle = getVal('em-key').trim();
  var logo = getVal('em-logo').trim();
  var site = getVal('em-site').trim();
  if (actif && (!service || !template || !cle)) { toast('Renseignez le Service ID, le Template ID et la clé publique','error'); return; }
  if (service && !/^service_[A-Za-z0-9_-]+$/.test(service)) { toast('Le Service ID doit commencer par service_','error'); return; }
  if (template && !/^template_[A-Za-z0-9_-]+$/.test(template)) { toast('Le Template ID doit commencer par template_','error'); return; }
  if (cle && !/^[A-Za-z0-9_-]{10,40}$/.test(cle)) { toast('Clé publique invalide','error'); return; }
  if (logo && !/^https:\/\//i.test(logo)) { toast('L\'adresse du logo doit commencer par https://','error'); return; }
  if (site && !/^https?:\/\//i.test(site)) { toast('L\'adresse du site doit commencer par https://','error'); return; }
  DATA.parametres.emailjs = { actif: actif, serviceId: service, templateId: template, publicKey: cle, logoUrl: logo, siteUrl: site };
  persist();
  toast('Réglages des emails sauvegardés');
}

function envoyerEmailTest() {
  var dest = getVal('em-test-dest').trim();
  var etat = document.getElementById('em-test-etat');
  if (typeof PharmaEmail === 'undefined') { toast('Module d\'envoi absent (emails.js)','error'); return; }
  if (!PharmaEmail.emailValide(dest)) { toast('Saisissez une adresse email valide','error'); return; }
  if (etat) etat.textContent = 'Envoi en cours…';
  var ctx = {
    commande: {
      id: '#TEST', client: 'Client Test', email: dest, lang: 'fr', codeRetrait: 'A1B2C3',
      produits: 'Crème solaire SPF50 × 1, Vitamine C × 2', total: 24.9, timestamp: new Date().toISOString()
    },
    fidelite: { seuil: PharmaFidelite.config(DATA).seuil, reduction: PharmaFidelite.config(DATA).reduction, achats: 2 }
  };
  PharmaEmail.envoyer('commandeRecue', DATA, ctx, { test: true }).then(function(r) {
    DATA = PharmaStore.load();
    renderEtatQuota(); // le test compte dans le quota
    if (currentPage === 'parametres') { /* les champs en cours de saisie ne sont pas réinitialisés */ }
    if (r && r.ok) { if (etat) etat.textContent = 'Test envoyé'; toast('Email de test envoyé à '+dest); }
    else {
      var raison = r && r.ignore ? r.raison : 'erreur ' + (r && r.status ? r.status : '') + ' ' + String(r && r.detail || '').slice(0, 80);
      if (etat) etat.textContent = 'Échec';
      toast('Test non envoyé : '+raison,'error');
    }
  });
}

var LIBELLES_EMAIL = { commandeRecue:'Commande reçue', commandePrete:'Commande prête', codeFidelite:'Code fidélité', test:'Test' };
function renderEmailJournal() {
  var box = document.getElementById('email-journal');
  if (!box) return;
  var log = DATA.emailLog || [];
  var entete = '<div style="margin-bottom:10px">'+resumeQuotaHTML(typeof PharmaEmail !== 'undefined' ? PharmaEmail.quota(DATA) : null, false)+'</div>';
  if (!log.length) {
    box.innerHTML = entete + '<div style="text-align:center;padding:20px;color:var(--texte-3);font-size:0.82rem">Aucun email automatique envoyé pour le moment.</div>';
    return;
  }
  var lignes = log.map(function(e) {
    var d = new Date(e.timestamp);
    var date = ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+('0'+d.getHours()).slice(-2)+'h'+('0'+d.getMinutes()).slice(-2);
    var ok = e.statut === 'Envoyé';
    var manuel = e.statut === 'Préparé (envoi manuel)';
    return '<tr><td class="txt-muted">'+date+'</td><td>'+escHtml(LIBELLES_EMAIL[e.type] || e.type)+'</td>'
      + '<td>'+escHtml(e.commande || '—')+'</td><td class="txt-muted">'+escHtml(e.destinataire)+'</td>'
      + '<td><span class="badge '+(ok?'b-green':(manuel?'b-blue':'b-red'))+'">'+escHtml(e.statut)+'</span>'
      + (ok || !e.detail ? '' : '<div class="td-sub">'+escHtml(e.detail)+'</div>')+'</td></tr>';
  }).join('');
  box.innerHTML = entete + '<table><thead><tr><th>Date</th><th>Type</th><th>Commande</th><th>Destinataire</th><th>Statut</th></tr></thead><tbody>'+lignes+'</tbody></table>';
}

// ── RAPPORT : configuration, envoi, impression ──────────────
function saveRapportConfig() {
  var email = (getVal('par-rapport-email') || '').trim();
  if (email && !pharmaEmailValide(email)) { toast('Adresse email du rapport invalide','error'); return; }
  var rj = document.getElementById('par-rapport-jour'), rh = document.getElementById('par-rapport-heure');
  DATA.parametres.rapportEmail = email;
  if (rj) DATA.parametres.rapportJour = rj.value;
  if (rh) DATA.parametres.rapportHeure = rh.value;
  DATA.parametres.rapportContenu = {
    promos: !!(document.getElementById('rap-promos') || {}).checked,
    codes: !!(document.getElementById('rap-codes') || {}).checked,
    ventes: !!(document.getElementById('rap-ventes') || {}).checked,
    employes: !!(document.getElementById('rap-employes') || {}).checked
  };
  persist();
  toast('Configuration du rapport enregistrée');
}
function envoyerRapport() {
  toast('L\'envoi du rapport par email arrivera avec le serveur. En attendant, utilisez le bouton PDF pour l\'imprimer ou l\'enregistrer.');
}
function imprimerRapport() {
  document.body.classList.add('impression-rapport');
  try { window.print(); } finally {
    setTimeout(function(){ document.body.classList.remove('impression-rapport'); }, 500);
  }
}

// ── ACCÈS RESTREINT ──────────────────────────────────────────
function checkAcces() {
  if (!DATA.parametres.restrictionEmployes) return true;
  var now = new Date();
  var jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var jour = jours[now.getDay()];
  var h = DATA.horaires[jour];
  // Jour spécial aujourd'hui : fermeture = pas d'accès ; garde ou horaires modifiés = ses heures
  var special = (DATA.joursSpeciaux || []).find(function(j){ return j && String(j.date || '').slice(0, 10) === pharmaDateLocale(now); });
  if (special) {
    if (special.type === 'Fermeture') return false;
    if (special.debut && special.fin) h = { ouvert: true, debut: special.debut, fin: special.fin };
  }
  if (!h || !h.ouvert || !h.debut || !h.fin) return false;
  var hNow = now.getHours() * 60 + now.getMinutes();
  var hDeb = parseInt(h.debut.split(':')[0])*60 + parseInt(h.debut.split(':')[1]||0);
  var hFin = parseInt(h.fin.split(':')[0])*60 + parseInt(h.fin.split(':')[1]||0);
  return hNow >= hDeb && hNow <= hFin;
}

function showBlocage() {
  if (ADMIN_CLOUD) {
    PharmaAdminCloud.deconnecter('Accès en dehors des heures d\'ouverture : l\'administration est réservée aux heures d\'ouverture pour les comptes « employé ».');
    return;
  }
  var nom = escHtml((DATA.parametres && DATA.parametres.nom) || 'Pharmacie');
  document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:var(--fond);font-family:Manrope,sans-serif;text-align:center;padding:30px">'
    + '<div style="width:60px;height:60px;background:linear-gradient(135deg,#1B6B45,#2ECC7A);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto"><svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>'
    + '<h1 style="font-size:1.2rem;font-weight:800;color:#1A1F2B">' + nom + '</h1>'
    + '<div style="background:white;border-radius:12px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:380px;width:100%">'
    + '<div style="width:46px;height:46px;border-radius:12px;background:#E55353;display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'
    + '<h2 style="font-size:1rem;font-weight:700;color:#1A1F2B;margin-bottom:8px">Accès non autorisé</h2>'
    + '<p style="font-size:0.82rem;color:#5A6478;line-height:1.6">L\'accès au back-office est restreint en dehors des heures d\'ouverture.<br><br>Contactez l\'administrateur si vous avez besoin d\'un accès exceptionnel.</p></div></div>';
}

// ── SCAN ────────────────────────────────────────────────────
function renderScan() {
  var auj = pharmaDateLocale();
  var lignes = DATA.commandes.filter(function(c) {
    return c.statut === 'Retirée' && c.retraitTs && pharmaDateLocale(new Date(c.retraitTs)) === auj;
  }).sort(function(a, b) { return new Date(b.retraitTs) - new Date(a.retraitTs); });
  if (!lignes.length) {
    setHTML('tbody-scan-histo', '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--texte-3)">Aucun retrait validé aujourd\'hui</td></tr>');
    return;
  }
  setHTML('tbody-scan-histo', lignes.map(function(c) {
    var d = new Date(c.retraitTs);
    var heure = ('0'+d.getHours()).slice(-2)+'h'+('0'+d.getMinutes()).slice(-2);
    return '<tr><td><strong>'+escHtml(c.id)+'</strong></td><td>'+escHtml(abregerNom(c.client))+'</td>'
      + '<td><span class="badge b-green">'+escHtml(c.valide || '—')+'</span></td><td class="txt-muted">'+heure+'</td></tr>';
  }).join(''));
}

// Retrouve une commande par son numéro (#1042 ou 1042) ou par son code de retrait
function trouverCommandeRetrait(saisie) {
  var val = String(saisie || '').trim();
  if (!val) return null;
  var up = val.toUpperCase();
  var parNumero = DATA.commandes.find(function(x){ return x.id === val || x.id === '#'+val; });
  if (parNumero) return parNumero;
  return DATA.commandes.find(function(x){ return x.codeRetrait && String(x.codeRetrait).toUpperCase() === up; }) || null;
}

function simulateScan() {
  var inp = document.getElementById('scan-input');
  var val = inp ? inp.value.trim() : '';
  if (!val) { toast('Saisissez le numéro de commande ou le code de retrait','error'); return; }
  if (ADMIN_CLOUD) {
    PharmaAdminCloud.validerRetrait(val).then(function(ok) { if (ok && inp) inp.value = ''; renderScan(); });
    return;
  }
  var c = trouverCommandeRetrait(val);
  if (!c) { toast('Commande introuvable','error'); return; }
  if (c.statut === 'Retirée') { toast('Cette commande a déjà été retirée','error'); return; }
  if (c.statut === 'Annulée') { toast('Cette commande a été annulée','error'); return; }
  c.statut = 'Retirée';
  c.valide = nomValideur();
  c.retraitTs = new Date().toISOString();
  if (inp) inp.value = '';
  toast('Commande '+c.id+' validée par '+c.valide);
  renderScan();
  persist();
}

// ── CODE PROMO ──────────────────────────────────────────────
function calcCode() {
  var pct = document.getElementById('cpct') ? document.getElementById('cpct').value : '10';
  var scope = document.getElementById('cscope') ? document.getElementById('cscope').value : 'Tous les produits';
  var lbl = document.getElementById('cscope-label');
  if (lbl) lbl.textContent = '-'+pct+'% sur '+scope.toLowerCase();
}

// Code de 6 caractères tirés au hasard (plus de 800 millions de combinaisons) : impossible à
// deviner par essais successifs, contrairement à l'ancien format à 4 caractères.
function regenCode() {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var tirage = null;
  try { tirage = new Uint32Array(6); (window.crypto || window.msCrypto).getRandomValues(tirage); } catch (e) { tirage = null; }
  var s = '';
  for (var i = 0; i < 6; i++) s += alphabet.charAt((tirage ? tirage[i] : Math.floor(Math.random() * alphabet.length)) % alphabet.length);
  var el = document.getElementById('cval');
  if (el) el.textContent = 'PHARM-'+s;
}

function copyCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function(){ toast('Code '+code+' copié !'); });
  } else { toast('Code '+code+' copié !'); }
}

// ── PROMO CALC ──────────────────────────────────────────────
function calcP() {
  var n = parseFloat(document.getElementById('pn')?document.getElementById('pn').value:0)||0;
  var p = parseFloat(document.getElementById('pp')?document.getElementById('pp').value:0)||0;
  var elPct = document.getElementById('ppct');
  var elInfo = document.querySelector('.promo-info');
  if (n>0 && p<n) {
    if (elPct) elPct.textContent = '-'+Math.round((1-p/n)*100)+'%';
    if (elInfo) elInfo.textContent = p.toFixed(2)+'€ au lieu de '+n.toFixed(2)+'€';
  } else if (n>0 && p>=n) {
    if (elPct) elPct.textContent = '0%';
    if (elInfo) elInfo.textContent = 'Le prix promo doit être inférieur au prix normal';
  }
}

// ── RECHERCHE GLOBALE ───────────────────────────────────────
function globalSearch(query) {
  if (!query) return;
  var q = normalize(query);
  var shortcuts = {
    'commande': 'commandes', 'ticket': 'tickets', 'produit': 'produits',
    'promo': 'promos', 'client': 'clients', 'stock': 'stocks',
    'employe': 'employes', 'horaire': 'horaires', 'message': 'messages',
    'rapport': 'rapport', 'code': 'codes-promo', 'notification': 'notifications',
    'parametre': 'parametres', 'scan': 'scan'
  };
  for (var k in shortcuts) {
    if (q.includes(k)) { go(shortcuts[k]); return; }
  }
  // Recherche dans produits
  var found = DATA.produits.filter(function(p){ return searchMatch(p.nom, query); });
  if (found.length) { go('produits'); setTimeout(function(){ renderProduits(query); }, 300); return; }
  // Recherche dans clients
  var fc = DATA.clients.filter(function(c){ return searchMatch(c.nom+' '+c.email, query); });
  if (fc.length) { go('clients'); setTimeout(function(){ renderClients(query); }, 300); }
}

// ── MODALS ──────────────────────────────────────────────────
function openModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  // Les listes déroulantes alimentées par les données sont rafraîchies à
  // l'ouverture : une catégorie ou un produit ajouté entre-temps doit apparaître.
  if (id === 'm-produit') renderCatOptions('p-cat', false);
  // Le modal promo doit toujours proposer les produits réellement présents au catalogue
  if (id === 'm-promo') {
    var pid = document.getElementById('p-promo-id');
    var enEdition = pid && pid.value;
    if (!enEdition) renderPromoProduitOptions();
  }
  el.classList.add('open');
}

// Fenêtres d'ajout et de modification : à la fermeture (enregistrement, Annuler, croix, Échap,
// clic à côté), l'élément modifié est oublié et le formulaire vidé. Sans cela, « Nouveau produit »
// (ou client, employé) ouvert après une modification écrasait l'élément modifié au lieu d'en créer un.
var MODALES_EDITION = {
  'm-produit': { id: 'p-id', form: 'form-produit', titre: 'm-produit-title', titreAjout: 'Ajouter un produit' },
  'm-client':  { id: 'cl-id', form: 'form-client' },
  'm-employe': { id: 'emp-id', form: 'form-employe' },
  'm-rayon':   { id: '', form: 'form-rayon' }
};
function oublierEdition(modalId) {
  var m = MODALES_EDITION[modalId];
  if (!m) return;
  var cache = document.getElementById(m.id);
  if (cache) cache.value = '';
  resetForm(m.form);
  if (m.titre) { var t = document.getElementById(m.titre); if (t) t.textContent = m.titreAjout; }
  document.dispatchEvent(new CustomEvent('pharma-edition-fermee', { detail: modalId }));
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  oublierEdition(id);
  el.style.animation = 'slideDown 0.22s ease forwards';
  setTimeout(function(){ el.classList.remove('open'); el.style.animation=''; }, 200);
}

function showDetail(title, body, footer) {
  var el = document.getElementById('m-detail');
  if (!el) return;
  document.getElementById('m-detail-title').textContent = title;
  document.getElementById('m-detail-body').innerHTML = body;
  document.getElementById('m-detail-footer').innerHTML = footer;
  openModal('m-detail');
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('overlay')) closeModal(e.target.id);
});

// Touche Échap : ferme la fenêtre ouverte (la plus récente) — accessibilité clavier
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var ouvertes = document.querySelectorAll('.overlay.open');
  if (ouvertes.length) { closeModal(ouvertes[ouvertes.length - 1].id); return; }
  var panel = document.getElementById('notif-panel');
  if (panel && panel.classList.contains('open') && typeof toggleNotifPanel === 'function') toggleNotifPanel();
});

// ── CONFIRMATION ────────────────────────────────────────────
var _confirmCb = null;
// options : { titre, bouton } — par défaut une suppression définitive.
function confirmer(msg, cb, options) {
  options = options || {};
  _confirmCb = cb;
  var el = document.getElementById('confirm-msg');
  // innerHTML pour permettre la mise en forme (<br>, précisions en petit).
  // Les données insérées dans ces messages sont toujours échappées (escHtml).
  if (el) el.innerHTML = msg;
  var titre = document.getElementById('confirm-titre');
  if (titre) titre.textContent = options.titre || 'Confirmer la suppression';
  var bouton = document.getElementById('confirm-ok');
  if (bouton) bouton.textContent = options.bouton || 'Supprimer définitivement';
  openModal('m-confirm');
}
function confirmOk() { closeModal('m-confirm'); if (_confirmCb) _confirmCb(); _confirmCb=null; }

// ── TOAST ────────────────────────────────────────────────────
var SVG_TOAST_OK = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
var SVG_TOAST_ERREUR = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
function toast(msg, type) {
  var container = document.getElementById('toast');
  if (!container) return;
  var erreur = type === 'error';
  var el = document.createElement('div');
  el.className = 'toast-item verre' + (erreur ? ' erreur' : '');
  el.innerHTML = erreur ? SVG_TOAST_ERREUR : SVG_TOAST_OK;
  // Texte brut : un nom de client ou de produit affiché dans un message ne peut pas injecter de HTML
  el.appendChild(document.createTextNode(String(msg == null ? '' : msg)));
  // Trois messages au plus à l'écran : le plus ancien laisse sa place
  while (container.children.length >= 3) container.removeChild(container.firstChild);
  container.appendChild(el);
  // Une erreur reste un peu plus longtemps : elle se lit en entier
  setTimeout(function(){
    el.classList.add('sortie');
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 360);
  }, erreur ? 4500 : 3200);
}

// ── COMPTEURS ANIMÉS ─────────────────────────────────────────
function animCount(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var n=0, step=Math.max(1,target/40);
  var t = setInterval(function(){
    n=Math.min(n+step,target);
    el.textContent=Math.round(n);
    if(n>=target) clearInterval(t);
  }, 25);
}

// ── SIDEBAR RESPONSIVE ───────────────────────────────────────
function isMobile() { return window.innerWidth <= 768; }
function isTablet() { return window.innerWidth > 768 && window.innerWidth <= 1024; }

function toggleSidebar() {
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  if (sb.classList.contains('open')) { closeSidebar(); }
  else { sb.classList.add('open'); if(bd) bd.classList.add('visible'); document.body.style.overflow='hidden'; }
}

function closeSidebar() {
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  sb.classList.remove('open');
  if(bd) bd.classList.remove('visible');
  document.body.style.overflow='';
}

function initResponsive() {
  var burger = document.getElementById('burger-btn');
  if (!burger) return;
  burger.style.display = (isMobile()||isTablet()) ? 'flex' : 'none';
  if (!isMobile() && !isTablet()) closeSidebar();
}
window.addEventListener('resize', initResponsive);

// ── PARTICULES ───────────────────────────────────────────────
function initParticles() {
  try {
    var canvas = document.getElementById('particles');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    canvas.width=220; canvas.height=window.innerHeight;
    var pts=[];
    for(var i=0;i<14;i++) pts.push({x:Math.random()*220,y:Math.random()*canvas.height,r:Math.random()*1.5+0.5,speed:Math.random()*0.25+0.08,opacity:Math.random()*0.2+0.04,drift:(Math.random()-0.5)*0.2});
    function draw(){
      ctx.clearRect(0,0,220,canvas.height);
      pts.forEach(function(p){
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(46,204,122,'+p.opacity+')'; ctx.fill();
        p.y-=p.speed; p.x+=p.drift;
        if(p.y<-10){p.y=canvas.height+10;p.x=Math.random()*220;}
        if(p.x<0||p.x>220) p.drift*=-1;
      });
      requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener('resize',function(){canvas.height=window.innerHeight;});
  } catch(e){}
}

// ── SVG ICONS ────────────────────────────────────────────────
function svgEdit() { return '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'; }
function svgTrash() { return '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
function svgEye() { return '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function svgTag() { return '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'; }

// ── UTILS ────────────────────────────────────────────────────
function setHTML(id, html) { var el=document.getElementById(id); if(el) el.innerHTML=html; }
function getVal(id) { var el=document.getElementById(id); return el?el.value:''; }
function setVal(id, val) { var el=document.getElementById(id); if(el) el.value=val||''; }
function resetForm(id) { var el=document.getElementById(id); if(el) el.reset(); }

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  appliquerCouleur();
  initNotifSync();
  renderNotifCloche(false);
  initResponsive();
  initParticles();
  var cta = document.getElementById('topbar-cta');
  if (cta) cta.style.display='none';
  var bd = document.getElementById('sidebar-backdrop');
  if (bd) bd.addEventListener('click', closeSidebar);
  var srch = document.querySelector('.topbar-search input');
  if (srch) {
    srch.addEventListener('keydown', function(e){ if(e.key==='Enter') globalSearch(this.value); });
    srch.addEventListener('input', function(){ if(!this.value) { var rows=document.querySelectorAll('.page.active tbody tr'); rows.forEach(function(r){r.style.display='';}); } });
  }
  var si = document.getElementById('scan-input');
  if (si) si.addEventListener('keydown', function(e){ if(e.key==='Enter') simulateScan(); });
  renderCatOptions('p-cat', false);
  renderCatOptions('filter-cat-produits');
  // Preview conseil en temps réel
  ['cs-icone','cs-titre','cs-texte','cs-couleur'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    // 'change' pour le <select>, 'input' pour les champs texte
    var evt = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, function() {
      var icone = getVal('cs-icone') || 'info';
      var titre = getVal('cs-titre') || 'Titre';
      var texte = getVal('cs-texte') || 'Texte du conseil...';
      var couleur = getVal('cs-couleur') || '#1B6B45';
      var pe = document.getElementById('cs-preview-icone');
      var pt = document.getElementById('cs-preview-titre');
      var px = document.getElementById('cs-preview-texte');
      var box = pe && pe.parentElement;
      if (pe) pe.innerHTML = svgConseil(icone);
      if (pt) pt.textContent = titre;
      if (px) px.textContent = texte;
      if (box) box.style.background = couleur;
    });
  });
  // Page de départ : la dernière ouverte dans cet onglet (retour depuis le site), sinon le tableau de bord
  currentPage = pageMemorisee();
  var dp = document.getElementById('page-' + currentPage);
  if (dp) dp.classList.add('active');
  majEnTetePage(currentPage);
  setTimeout(function() { renderPage(currentPage); }, 100);
  // Base de données : écran de connexion, puis lecture des données
  if (ADMIN_CLOUD) PharmaAdminCloud.demarrer();
});
