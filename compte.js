// ════════════════════════════════════════════
// PHARMACIE GUY MÔQUET — Espace client
// ════════════════════════════════════════════

// ── DONNÉES PARTAGÉES (mêmes que admin.html / site.html) ──
var DATA = PharmaStore.load();

// ── CONFIGURATION PHARMACIE ──
function applyPharmacyConfig() {
  var cfg = DATA.parametres || {};
  document.title = 'Mon espace — ' + (cfg.nom || 'Pharmacie Démo');
  var bn = document.getElementById('brand-name-header');
  if (bn) bn.textContent = cfg.nom || 'Pharmacie Démo';
}

// ── FIDÉLITÉ (données réelles du client, partagées avec admin.html) ──
function getClientInitials(nom) {
  var initials = nom.split(' ').map(function(w){ return w.charAt(0).toUpperCase(); }).join('').slice(0, 2);
  return initials || 'CL';
}
function getProfilEnregistre() {
  var profil = null;
  try { profil = JSON.parse(localStorage.getItem('pharma-profil') || 'null'); } catch (e) {}
  return profil;
}
function getCurrentClientNom() {
  // Identité du client : profil enregistré dans "Mon profil", sinon persona démo
  // "Marie Dupont" (tant qu'il n'y a pas de vraie authentification — étape Supabase à venir).
  var profil = getProfilEnregistre();
  if (profil && (profil.prenom || profil.nom)) {
    var full = ((profil.prenom || '') + ' ' + (profil.nom || '')).trim();
    if (full) return full;
  }
  return 'Marie Dupont';
}
// L'email du profil sert à retrouver le client de façon fiable (deux personnes
// peuvent porter le même nom). Vide tant que le profil n'en contient pas.
function getCurrentClientEmail() {
  var profil = getProfilEnregistre();
  return (profil && profil.email) ? String(profil.email).trim() : '';
}
function getCurrentClient() {
  return PharmaClients.trouver(DATA, getCurrentClientNom(), getCurrentClientEmail());
}
function formatDateFr(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(iso || '');
}
function initFidelite() {
  var cfg = PharmaFidelite.config(DATA);
  var seuil = cfg.seuil;
  var clientNom = getCurrentClientNom();
  var client = getCurrentClient();
  var achats = client ? client.achats : 0;
  var prog = PharmaFidelite.progression(achats, seuil);
  var code = PharmaFidelite.codeActif(DATA, client);

  var nomEl = document.getElementById('fid-nom');
  if (nomEl) nomEl.textContent = clientNom;
  var numEl = document.getElementById('fid-numero');
  if (numEl) numEl.textContent = 'N° fidélité · ' + getClientInitials(clientNom) + '-' + new Date().getFullYear() + '-' + String(client ? client.id : 0).padStart(4, '0');
  var compteurEl = document.getElementById('fid-compteur');
  if (compteurEl) compteurEl.textContent = prog.courant + ' / ' + seuil + ' achats';

  // Texte d'état selon la situation réelle du client
  var statut;
  if (!client || achats === 0) statut = 'Aucun achat pour l\'instant — ' + seuil + ' achats pour débloquer ' + cfg.reduction + ' % de réduction';
  else if (prog.atteint) statut = 'Palier atteint !';
  else statut = prog.restant + ' achat' + (prog.restant > 1 ? 's' : '') + ' avant votre réduction';
  var statutEl = document.getElementById('fid-statut');
  if (statutEl) statutEl.textContent = statut;

  var codeLabelEl = document.getElementById('fid-code-label');
  var codeEl = document.getElementById('fid-code');
  if (code) {
    if (codeLabelEl) codeLabelEl.textContent = 'Code -' + code.pct + '% disponible';
    if (codeEl) codeEl.textContent = code.code + (code.expire ? ' · valable jusqu\'au ' + formatDateFr(code.expire) : '');
  } else {
    var label = 'Code -' + cfg.reduction + '% à débloquer';
    var detail = '—';
    if (client && prog.atteint) {
      // Palier atteint mais aucun code utilisable : il a été utilisé ou il a expiré
      var dernier = (DATA.codesPromo || []).filter(function(c) {
        var sien = (c.clientId !== undefined) ? c.clientId === client.id : c.client === client.nom;
        return sien && String(c.origine || '').indexOf('Auto (fidélité)') === 0;
      }).pop();
      if (dernier) {
        label = 'Code -' + dernier.pct + '%';
        detail = (dernier.maxUsages > 0 && dernier.usages >= dernier.maxUsages) ? 'Code déjà utilisé' : 'Code expiré — contactez la pharmacie';
      }
    }
    if (codeLabelEl) codeLabelEl.textContent = label;
    if (codeEl) codeEl.textContent = detail;
  }
  var fillEl = document.getElementById('fid-fill');
  if (fillEl) fillEl.style.width = prog.pct + '%';
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

// ── MES COMMANDES (lues depuis DATA.commandes, partagées avec l'admin) ──
function renderMesCommandes() {
  var box = document.getElementById('orders-list');
  if (!box) return;
  var clientNom = getCurrentClientNom();
  var clientEmail = getCurrentClientEmail();
  var commandes = DATA.commandes.filter(function(c){ return PharmaClients.commandeAppartient(c, clientNom, clientEmail); })
    .slice()
    .sort(function(a, b) {
      // Tri par timestamp réel (plus récentes en premier).
      // Les anciennes commandes sans timestamp passent en dernier.
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

  if (!commandes.length) {
    box.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--texte-3)">'
      + '<svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:12px"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
      + '<p style="margin:0 0 16px">Vous n\'avez pas encore passé de commande.</p>'
      + '<a href="site.html#catalogue" class="btn btn-primary" style="text-decoration:none">Découvrir le catalogue</a>'
      + '</div>';
    return;
  }

  var BADGES = {
    'En préparation': { cls:'ob-prep', label:'En préparation' },
    'Prête':          { cls:'ob-ready', label:'Prête à retirer' },
    'Retirée':        { cls:'ob-done', label:'Retirée' },
    'Annulée':        { cls:'ob-cancel', label:'Annulée' }
  };
  var html = '';
  commandes.forEach(function(c) {
    var badge = BADGES[c.statut] || { cls:'ob-prep', label:c.statut };
    html += '<div class="order">';
    html += '<div class="order-head"><div><div class="order-id">Commande '+escHtml(c.id)+'</div><div class="order-date">'+escHtml(c.date)+'</div></div>';
    html += '<span class="order-badge '+badge.cls+'">'+escHtml(badge.label)+'</span></div>';
    html += '<div class="order-items">'+escHtml(c.produits)+'</div>';
    if (c.codeRetrait && c.statut !== 'Retirée') html += '<div class="order-items" style="margin-top:6px">Code de retrait : <strong style="letter-spacing:2px">'+escHtml(c.codeRetrait)+'</strong></div>';
    html += '<div class="order-total">Total : '+Number(c.total || 0).toFixed(2).replace('.',',')+'€</div>';
    if (c.statut === 'Prête') {
      html += '<div class="order-ready-banner"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Votre commande est prête ! Présentez votre numéro de commande' + (c.codeRetrait ? ' ou votre code de retrait <strong>' + escHtml(c.codeRetrait) + '</strong>' : '') + ' en pharmacie.</div>';
    }
    html += '</div>';
  });
  box.innerHTML = html;
}

// ── THEME (détection intelligente) ──
function initTheme() {
  var saved = null;
  try { saved = localStorage.getItem('pharma-theme'); } catch(e){}
  if (saved) { setTheme(saved); return; }
  // Mode automatique : on APPLIQUE le thème sans l'enregistrer, sinon le choix
  // « Automatique » se figerait aussitôt sur la valeur du moment et ne suivrait
  // plus ni le réglage système ni l'heure de la journée.
  setTheme(themeAutomatique(), false);
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      var mc = null;
      try { mc = localStorage.getItem('pharma-theme'); } catch(err){}
      if (!mc) setTheme(e.matches ? 'dark' : 'light', false);
    });
  }
}
// Thème déduit du système, avec repli sur l'heure (nuit = sombre)
function themeAutomatique() {
  var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (systemPrefersDark) return 'dark';
  var hour = new Date().getHours();
  return (hour >= 20 || hour < 7) ? 'dark' : 'light';
}
function setTheme(theme, memoriser) {
  document.documentElement.setAttribute('data-theme', theme);
  // memoriser === false : application temporaire (mode automatique)
  if (memoriser !== false) {
    try { localStorage.setItem('pharma-theme', theme); } catch(e){}
  }
  var icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'dark') icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    else icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>';
  }
}
function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
}

// ── AVATAR (upload + aperçu local via localStorage) ──
function initAvatar() {
  var saved = null;
  try { saved = localStorage.getItem('pharma-avatar'); } catch(e){}
  if (saved) setAvatarImage(saved);
  var input = document.getElementById('avatar-input');
  if (input) {
    input.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.match(/^image\//)) { pharmaToast('Merci de choisir un fichier image'); return; }
      if (file.size > 2 * 1024 * 1024) { pharmaToast('Image trop lourde (2 Mo maximum)'); return; }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataUrl = ev.target.result;
        try { localStorage.setItem('pharma-avatar', dataUrl); } catch(err) { pharmaToast('Image trop lourde pour être enregistrée'); return; }
        setAvatarImage(dataUrl);
        pharmaToast('Photo de profil mise à jour');
      };
      reader.readAsDataURL(file);
    });
  }
}
function setAvatarImage(dataUrl) {
  var av = document.getElementById('profile-avatar');
  if (!av) return;
  var img = av.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    av.insertBefore(img, av.firstChild);
  }
  img.src = dataUrl;
  var initials = document.getElementById('avatar-initials');
  if (initials) initials.style.display = 'none';
}

// ── PROFIL (infos personnelles persistées en localStorage) ──
var PROFIL_FIELDS = ['prenom','nom','email','tel','naissance','langue','adresse','cp','ville'];
var SUPPORTED_LANGS = ['fr','en','ar','he'];
function detectSystemLang() {
  var nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
  var code = nav.split('-')[0];
  if (code === 'iw') code = 'he'; // ancien code ISO de l'hébreu, encore utilisé par certains navigateurs
  return SUPPORTED_LANGS.indexOf(code) !== -1 ? code : 'fr'; // repli sur le français si langue non gérée
}
function initProfil() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem('pharma-profil') || 'null'); } catch(e){}
  if (!saved) {
    // Première visite : la langue s'initialise sur celle du système/navigateur
    saved = { langue: detectSystemLang() };
    try { localStorage.setItem('pharma-profil', JSON.stringify(saved)); } catch(e){}
  } else if (!saved.langue) {
    // Profil existant créé avant l'ajout de ce champ : on la détecte a posteriori
    saved.langue = detectSystemLang();
    try { localStorage.setItem('pharma-profil', JSON.stringify(saved)); } catch(e){}
  }
  PROFIL_FIELDS.forEach(function(key) {
    var el = document.getElementById('pf-'+key);
    if (el && saved[key] !== undefined) el.value = saved[key];
  });
}
function saveProfil() {
  var data = {};
  PROFIL_FIELDS.forEach(function(key) {
    var el = document.getElementById('pf-'+key);
    data[key] = el ? String(el.value).trim() : '';
  });
  if (data.email && !pharmaEmailValide(data.email)) { pharmaToast('Adresse email invalide'); return; }
  try { localStorage.setItem('pharma-profil', JSON.stringify(data)); } catch(e){}
  syncProfilDisplay();
  initFidelite();
  renderMesCommandes();
  pharmaToast('Profil mis à jour');
}

// Répercute le profil enregistré partout dans la page (sidebar, avatar, notifications)
function syncProfilDisplay() {
  var profil = null;
  try { profil = JSON.parse(localStorage.getItem('pharma-profil') || 'null'); } catch(e){}
  if (!profil) return;
  var nomComplet = ((profil.prenom||'') + ' ' + (profil.nom||'')).trim();
  if (nomComplet) {
    var nomEl = document.getElementById('sidebar-nom');
    if (nomEl) nomEl.textContent = nomComplet;
    var initEl = document.getElementById('avatar-initials');
    if (initEl) initEl.textContent = getClientInitials(nomComplet);
  }
  if (profil.email) {
    var mailEl = document.getElementById('sidebar-email');
    if (mailEl) mailEl.textContent = profil.email;
    var notifMail = document.getElementById('notif-email');
    if (notifMail) notifMail.textContent = profil.email;
  }
}

// ── SÉLECTEUR DE THÈME (Clair / Sombre / Automatique) ──
function setThemePref(pref) {
  if (pref === 'auto') {
    try { localStorage.removeItem('pharma-theme'); } catch(e){}
    initTheme();
  } else {
    setTheme(pref);
  }
  updateThemeOptionsUI();
  pharmaToast('Préférence d\'apparence enregistrée');
}
function updateThemeOptionsUI() {
  var saved = null;
  try { saved = localStorage.getItem('pharma-theme'); } catch(e){}
  var current = saved || 'auto';
  document.querySelectorAll('.theme-opt').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === current);
  });
}

// ── TABS ──
function showTab(id, el) {
  // Protection : une ancre invalide dans l'URL (compte.html#inconnu) ne doit
  // pas provoquer d'erreur JavaScript et bloquer le reste de la page.
  var cible = document.getElementById('tab-' + id);
  if (!cible) return;
  document.querySelectorAll('.page-tab').forEach(function(t){ t.classList.remove('active'); });
  cible.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(function(m){ m.classList.remove('active'); });
  if (el) el.classList.add('active');
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── NOTIF GLOBAL ──
function toggleGlobalNotif() {
  var global = document.getElementById('notif-global');
  var types = document.getElementById('notif-types');
  if (!global || !types) return;
  if (global.checked) {
    types.style.opacity = '1';
    types.style.pointerEvents = 'auto';
  } else {
    types.style.opacity = '0.4';
    types.style.pointerEvents = 'none';
    pharmaToast('Toutes les notifications sont désactivées');
  }
}

// ── DELETE ACCOUNT ──
function confirmDelete() {
  if (confirm('Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.')) {
    pharmaToast('Demande de suppression enregistrée');
  }
}

// ── TOAST ──
window.pharmaToast = function(msg) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--vert-vif)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  // Le message est ajouté en texte brut : un nom de produit ne peut pas y injecter de HTML
  el.appendChild(document.createTextNode(String(msg == null ? '' : msg)));
  var c = document.getElementById('toast');
  if (c) c.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition='all 0.3s'; setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},300); }, 2800);
};

// Étape de transition : le site client est relié à la base de données, pas encore l'espace client
function afficherAvisCompteNonRelie() {
  var layout = document.querySelector('.layout');
  if (!layout || document.getElementById('avis-base')) return;
  var avis = document.createElement('div');
  avis.id = 'avis-base';
  avis.setAttribute('role', 'note');
  avis.style.cssText = 'max-width:1100px;margin:20px auto 0;padding:0 16px';
  avis.innerHTML = '<div style="padding:12px 16px;border-radius:12px;background:#FBF1DF;color:#5C3D0B;font-size:0.82rem;line-height:1.5;border:1px solid #EBCB8B">'
    + '<strong>Aperçu de l\'espace client.</strong> Il n\'est pas encore relié à la base de données : les commandes passées sur le site n\'y apparaissent pas encore.</div>';
  layout.parentNode.insertBefore(avis, layout);
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', function() {
  if (typeof PHARMA_SUPABASE !== 'undefined' && PHARMA_SUPABASE) afficherAvisCompteNonRelie();
  applyPharmacyConfig();
  initProfil();
  syncProfilDisplay();
  initFidelite();
  renderMesCommandes();
  initTheme();
  updateThemeOptionsUI();
  initAvatar();
  // L'admin (autre onglet) fait évoluer commandes et codes : on se recale sur les données les plus récentes.
  window.addEventListener('storage', function(e) {
    if (e.key === 'pharma-data') { DATA = PharmaStore.load(); initFidelite(); renderMesCommandes(); }
  });
  var tb = document.getElementById('theme-btn');
  if (tb) tb.addEventListener('click', function(){ toggleTheme(); updateThemeOptionsUI(); });
  // Ouvrir un onglet via hash (#commandes, #notifs...)
  // Seuls des noms d'onglet simples sont acceptés (une ancre piégée ne peut pas casser la page)
  var hash = window.location.hash.replace('#','').replace(/[^a-z-]/g, '');
  if (hash && document.getElementById('tab-'+hash)) {
    var menuItem = document.querySelector('.menu-item[onclick*="'+hash+'"]');
    showTab(hash, menuItem);
  }
});
