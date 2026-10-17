// ============================================================
// PHARMACIE GUY MÔQUET — Données partagées (admin.html / site.html / compte.html)
// ============================================================
// Ce fichier doit être chargé AVANT admin.js / site.js / compte.js
// dans les 3 pages HTML (<script src="data.js"></script>).
//
// Principe : DATA est la source de vérité unique. Elle est chargée
// depuis localStorage si elle existe déjà (visite précédente, ou
// modification faite côté admin), sinon on part des données de
// démonstration ci-dessous (identiques à celles historiquement
// codées en dur dans admin.js).

var PHARMA_STORAGE_KEY = 'pharma-data';

// Les données de démonstration utilisent des dates relatives à aujourd'hui :
// sans cela, promos et codes seraient déjà expirés à la première ouverture.
// Date au format AAAA-MM-JJ selon l'heure LOCALE (celle de la pharmacie), et non UTC :
// avec toISOString(), entre minuit et 2 h du matin à Paris on obtiendrait la date de la veille.
// Ce format se compare directement comme du texte (« 2026-10-12 » < « 2026-10-13 »).
function pharmaDateLocale(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function _pharmaDate(joursDecalage) {
  var d = new Date();
  d.setDate(d.getDate() + joursDecalage);
  return pharmaDateLocale(d);
}

var PHARMA_SEED_DATA = {
  categories: ['Solaire', 'Vitamines', 'Hygiène', 'Beauté', 'Bébé', 'Minceur', 'Aromathérapie'],
  produits: [
    { id:1, nom:'Crème Solaire SPF50 100ml', ref:'SOL-001', cat:'Solaire', prix:8.40, stock:45, seuil:10, desc:'Protection solaire haute performance' },
    { id:2, nom:'Vitamine C 1000mg 60cp', ref:'VIT-012', cat:'Vitamines', prix:15.00, stock:7, seuil:10, desc:'Complément vitaminé' },
    { id:3, nom:'Gel Douche Surgras 400ml', ref:'HYG-034', cat:'Hygiène', prix:6.20, stock:0, seuil:10, desc:'Gel doux pour peaux sensibles' }
  ],
  promos: [
    { id:1, produit:'Lot Crème Solaire SPF50 x3', prixNormal:25.20, prixPromo:18.90, pct:-25, debut:_pharmaDate(-15), fin:_pharmaDate(30), statut:'Active' }
  ],
  conseils: [
    { id:1, icone:'soleil', titre:'Il fait chaud !', texte:'Hydratez-vous et protégez votre peau.', couleur:'#1B6B45', actif:true },
    { id:2, icone:'pilule', titre:'Le saviez-vous ?', texte:'La Vitamine C booste l\'immunité, idéale en été contre la fatigue.', couleur:'#D9A441', actif:true },
    { id:3, icone:'goutte', titre:'Hydratation', texte:'Buvez au moins 1,5L d\'eau par jour, surtout en été !', couleur:'#2ECC7A', actif:true }
  ],
  codesPromo: [
    { code:'PHARM-MD10', client:'Marie Dupont', pct:10, scope:'Tous', origine:'Auto (fidélité)', usages:0, maxUsages:1, expire:_pharmaDate(20), actif:true },
    { code:'PHARM-AB15', client:'Ahmed Benali', pct:15, scope:'Solaire', origine:'Manuel', usages:1, maxUsages:2, expire:_pharmaDate(45), actif:true },
    { code:'BIENVENUE', client:'Tous les clients', pct:5, scope:'Tous', origine:'Manuel', usages:0, maxUsages:0, expire:'', actif:true },
    { code:'ETE2025', client:'Tous les clients', pct:20, scope:'Solaire', origine:'Manuel', usages:0, maxUsages:0, expire:_pharmaDate(60), actif:true }
  ],
  // Alertes internes affichées dans la cloche de l'admin
  // (remplacent l'email d'alerte à la pharmacie)
  alertes: [],
  // Historique des notifications envoyées aux clients
  notifications: [],
  // Journal des emails automatiques (confirmation, commande prête, code
  // fidélité) : permet de savoir si un envoi a réussi ou échoué.
  emailLog: [],
  clients: [
    { id:1, nom:'Marie Dupont', email:'marie.d@email.com', tel:'06 12 34 56 78', type:'Compte', notifs:'Email + SMS', rgpd:true, achats:5, depenses:120 },
    { id:2, nom:'Ahmed Benali', email:'ahmed.b@email.com', tel:'06 98 76 54 32', type:'Compte', notifs:'Email', rgpd:true, achats:3, depenses:76 },
    { id:3, nom:'Sophie Laurent', email:'s.laurent@email.com', tel:'', type:'Invité', notifs:'Email', rgpd:false, achats:1, depenses:6.20 }
  ],
  employes: [
    { id:1, nom:'Admin Principal', email:'admin@pharmacie-demo.test', role:'Admin', acces:'Tout', actif:true },
    { id:2, nom:'Karim Mansouri', email:'k.mansouri@pharmacie-demo.test', role:'Employé', acces:'Commandes + Tickets', actif:true }
  ],
  // Aucune commande de démonstration : les commandes proviennent du site client.
  commandes: [],
  tickets: [
    { id:'#T-087', client:'Jean Pierre', type:'Problème commande', sujet:'Produit manquant', commande:'#1039', doc:true, priorite:'Urgent', statut:'Ouvert' },
    { id:'#T-086', client:'Fatima Kaci', type:'Question produit', sujet:'Crème peaux sensibles ?', commande:'', doc:false, priorite:'Normal', statut:'En cours' }
  ],
  messages: [
    { id:1, de:'Karim Mansouri', msg:'Stock Vitamine C très bas, penser à renouveler.', heure:'09h15', lu:false },
    { id:2, de:'Admin Principal', msg:'Merci, commande passée ce matin.', heure:'09h32', lu:true }
  ],
  horaires: {
    lundi:    { ouvert:true, debut:'09:00', fin:'21:00' },
    mardi:    { ouvert:true, debut:'09:00', fin:'21:00' },
    mercredi: { ouvert:true, debut:'09:00', fin:'21:00' },
    jeudi:    { ouvert:true, debut:'09:00', fin:'21:00' },
    vendredi: { ouvert:true, debut:'09:00', fin:'21:00' },
    samedi:   { ouvert:true, debut:'09:00', fin:'21:00' },
    dimanche: { ouvert:true, debut:'09:00', fin:'20:00' }
  },
  // Photos des rayons de la page d'accueil ({ 'Solaire': adresse de la photo }), ajoutées dans l'admin.
  // Les photos des produits sont dans le champ « photo » de chaque produit.
  photosRayons: {},
  joursSpeciaux: [
    { date:_pharmaDate(5), type:'Garde', debut:'08:00', fin:'20:00', msg:'Pharmacie de garde — Ouverts de 8h à 20h' },
    { date:_pharmaDate(40), type:'Fermeture', debut:'', fin:'', msg:'Fermés exceptionnellement ce jour' }
  ],
  parametres: {
    nom: 'Pharmacie Démo',
    adresse: '1 rue de l’Exemple, 75000 Paris',
    tel: '01 00 00 00 00',
    email: 'contact@pharmacie-demo.test',
    couleurPrimaire: '#1B6B45',
    logoTexte: 'Pharmacie Démo',
    bandeauActif: true,
    bandeauMsg: 'Version de démonstration : pharmacie fictive, aucune commande réelle',
    restrictionEmployes: true,
    rapportJour: 'lundi',
    rapportHeure: '08:00',
    rapportEmail: 'contact@pharmacie-demo.test',
    fideliteSeuil: 5,
    fideliteReduction: 10,
    // ── INFORMATIONS LÉGALES (obligatoires avant mise en ligne) ──
    // Article 1-1 de la LCEN + obligations propres aux officines.
    // Les valeurs entre crochets sont des marqueurs à compléter.
    legal: {
      raisonSociale: 'PHARMACIE DÉMO (fictive)',
      formeJuridique: 'SELASU (Société d\'exercice libéral par actions simplifiée à associé unique)',
      capital: '[Capital social à compléter]',
      siret: '[SIRET à compléter]',
      rcs: '[RCS à compléter]',
      tva: '[N° TVA intracommunautaire à compléter]',
      titulaire: '[Nom et prénom du pharmacien titulaire à compléter]',
      numeroOrdre: '[N° d\'inscription à l\'Ordre à compléter]',
      directeurPublication: '[Nom du directeur de la publication à compléter]',
      ars: 'Agence Régionale de Santé Île-de-France — 35 rue de la Gare, 75019 Paris',
      licence: '[N° de licence d\'officine à compléter]',
      hebergeur: 'Netlify, Inc. — 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis',
      hebergeurTel: '[Téléphone de l\'hébergeur à compléter]',
      mediateur: '[Médiateur de la consommation à compléter]'
    },
    // ── DÉCOMPTE DES EMAILS RESTANTS (EmailJS) ──
    // { releve: nombre relevé dans EmailJS, releveLe: date du relevé, envoyes: envois réussis depuis }
    emailQuota: null,
    // ── ENVOI D'EMAILS (EmailJS) ──
    // Identifiants du compte EmailJS de la pharmacie (section Emails de
    // l'admin). La clé publique est faite pour être visible dans une page web ;
    // la clé PRIVÉE ne doit jamais être saisie ici.
    emailjs: {
      actif: false,
      serviceId: '',
      templateId: '',
      publicKey: '',
      logoUrl: '',   // optionnel : adresse https d'un logo PNG/JPG pour les emails
      siteUrl: ''    // optionnel : adresse publique du site (bouton « Suivre ma commande »)
    },
    // Événements déclenchant un email automatique.
    // Seuls les 3 premiers sont réalisables sans serveur (déclenchés par une
    // action dans le navigateur) ; les autres nécessitent un serveur.
    notifAuto: {
      commandeRecue: true,
      commandePrete: true,
      codeFidelite: true
    }
  }
};

// ── ALERTES ADMIN ──────────────────────────────────────────
// Crée une alerte visible dans la cloche du back-office.
// Appelée depuis site.js (nouvelle commande, stock bas) et admin.js.
// Les alertes sont plafonnées pour ne pas faire grossir le stockage indéfiniment.
var PHARMA_MAX_ALERTES = 50;
// Compteur incrémental : garantit l'unicité même si plusieurs alertes
// sont créées dans la même milliseconde (Date.now() seul ne suffit pas).
var _pharmaAlerteSeq = 0;
function pharmaAjouterAlerte(data, type, titre, texte, lien) {
  if (!data.alertes) data.alertes = [];
  var id;
  do {
    _pharmaAlerteSeq++;
    id = Date.now() * 1000 + (_pharmaAlerteSeq % 1000);
  } while (data.alertes.some(function(a){ return a.id === id; }));
  data.alertes.unshift({
    id: id,
    type: type,           // 'commande' | 'stock' | 'ticket' | 'fidelite'
    titre: titre,
    texte: texte,
    lien: lien || '',     // page admin à ouvrir au clic
    timestamp: new Date().toISOString(),
    lu: false
  });
  if (data.alertes.length > PHARMA_MAX_ALERTES) {
    data.alertes = data.alertes.slice(0, PHARMA_MAX_ALERTES);
  }
}

// ── COUCHE DE PERSISTANCE ──────────────────────────────────
var PharmaStore = {
  // Charge DATA depuis localStorage, ou initialise avec les données de démo
  load: function() {
    var raw = null;
    try { raw = localStorage.getItem(PHARMA_STORAGE_KEY); } catch (e) {}
    if (raw) {
      try {
        return this.migrer(JSON.parse(raw));
      } catch (e) {
        console.warn('pharma-data corrompu, réinitialisation avec les données de démo.', e);
      }
    }
    // Rien de valide en localStorage : on seed avec les données de démo
    var seed = JSON.parse(JSON.stringify(PHARMA_SEED_DATA));
    this.save(seed);
    return seed;
  },
  // Complète les données sauvegardées avec les champs ajoutés depuis, et
  // répare celles dont le type est incorrect (données corrompues, version
  // antérieure incompatible). Sans cette vérification de type, un champ
  // corrompu ferait planter tout le site au premier .filter() ou .map().
  migrer: function(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return JSON.parse(JSON.stringify(PHARMA_SEED_DATA));
    }
    var copie = function(v) {
      return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    };
    Object.keys(PHARMA_SEED_DATA).forEach(function(cle) {
      var attendu = PHARMA_SEED_DATA[cle];
      var actuel = data[cle];
      var typeOk;
      if (Array.isArray(attendu)) {
        typeOk = Array.isArray(actuel);
      } else if (attendu && typeof attendu === 'object') {
        typeOk = actuel && typeof actuel === 'object' && !Array.isArray(actuel);
      } else {
        typeOk = actuel !== undefined && actuel !== null;
      }
      if (!typeOk) data[cle] = copie(attendu);
    });
    // Les paramètres sont complétés champ par champ (nouveaux réglages ajoutés au fil des versions)
    Object.keys(PHARMA_SEED_DATA.parametres).forEach(function(cle) {
      var attendu = PHARMA_SEED_DATA.parametres[cle];
      var actuel = data.parametres[cle];
      var typeOk = (attendu && typeof attendu === 'object')
        ? (actuel && typeof actuel === 'object')
        : (actuel !== undefined && actuel !== null);
      if (!typeOk) data.parametres[cle] = copie(attendu);
      else if (attendu && typeof attendu === 'object' && !Array.isArray(attendu)) {
        // Réglages imbriqués (emailjs, legal, notifAuto) : on ajoute les champs
        // introduits depuis, sans toucher à ceux déjà renseignés.
        Object.keys(attendu).forEach(function(sous) {
          if (data.parametres[cle][sous] === undefined || data.parametres[cle][sous] === null) {
            data.parametres[cle][sous] = copie(attendu[sous]);
          }
        });
      }
    });
    // Horaires : un jour manquant est complété (sinon l'affichage des horaires planterait)
    Object.keys(PHARMA_SEED_DATA.horaires).forEach(function(jour) {
      var h = data.horaires[jour];
      if (!h || typeof h !== 'object') data.horaires[jour] = copie(PHARMA_SEED_DATA.horaires[jour]);
    });
    // Anciens libellés d'origine des codes de démo (avant la fidélité par cycle)
    if (Array.isArray(data.codesPromo)) {
      data.codesPromo.forEach(function(c) {
        if (!c) return;
        if (c.origine === 'Auto (5 achats)') c.origine = 'Auto (fidélité)';
        else if (c.origine === 'Auto (150€)') c.origine = 'Manuel';
      });
    }
    return data;
  },
  // Sauvegarde l'objet DATA complet dans localStorage
  save: function(data) {
    try {
      localStorage.setItem(PHARMA_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Impossible de sauvegarder pharma-data (quota localStorage dépassé ?)', e);
      return false;
    }
  },
  // Modifie les données à partir de leur état LE PLUS RÉCENT en stockage, puis
  // sauvegarde. À utiliser pour toute écriture différée (après un envoi
  // d'email par exemple) : sauvegarder une copie en mémoire plus ancienne
  // écraserait ce qu'un autre onglet (admin, site) a écrit entre-temps.
  mettreAJour: function(fn) {
    var frais = this.load();
    fn(frais);
    this.save(frais);
    return frais;
  },
  // Réinitialise complètement aux données de démo (utile pour les tests)
  reset: function() {
    var seed = JSON.parse(JSON.stringify(PHARMA_SEED_DATA));
    this.save(seed);
    return seed;
  }
};

// ── VALIDATION D'EMAIL (commune au site, à l'admin et aux envois) ──
// Une seule adresse, sans espace, virgule ni point-virgule : on ne peut pas glisser
// plusieurs destinataires dans le champ pour détourner l'envoi d'emails.
var PHARMA_EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
function pharmaEmailValide(e) {
  var s = String(e == null ? '' : e).trim();
  return s.length > 0 && s.length <= 200 && PHARMA_EMAIL_RE.test(s);
}

// ── PHOTOS DES PRODUITS ET DES RAYONS ──────────────────────
// Une photo n'est affichée que si son adresse a l'une de ces deux formes :
//  * une image du bucket « photos » d'un projet Supabase (mode base de données) ;
//  * une image JPEG, PNG ou WebP gardée dans le navigateur (mode démonstration).
// Toute autre valeur (adresse d'un autre site, javascript:, guillemets) est ignorée :
// une adresse modifiée ne peut ni injecter de code ni charger une image d'ailleurs.
var PHARMA_PHOTO_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/photos\/[A-Za-z0-9_-]+([.\/][A-Za-z0-9_-]+)*$/;
var PHARMA_PHOTO_DATA_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+={0,2}$/;
var PHARMA_PHOTO_DATA_MAX = 700000;   // environ 500 Ko d'image
function pharmaPhotoValide(v) {
  var s = (typeof v === 'string') ? v : '';
  if (s.length <= 400 && PHARMA_PHOTO_URL_RE.test(s)) return s;
  if (s.length <= PHARMA_PHOTO_DATA_MAX && PHARMA_PHOTO_DATA_RE.test(s)) return s;
  return '';
}
// Photo d'un rayon (catégorie), ou '' s'il n'en a pas
function pharmaPhotoRayon(data, cat) {
  var photos = data && data.photosRayons;
  if (!photos || typeof photos !== 'object' || !Object.prototype.hasOwnProperty.call(photos, cat)) return '';
  return pharmaPhotoValide(photos[cat]);
}

// ── NOM ET ADRESSE DANS LES TEXTES DU SITE ─────────────────
// Les phrases du site reprennent le nom et la ville saisis dans l'admin (Paramètres) :
// rien n'est à retaper ailleurs quand la pharmacie change de nom ou d'adresse.
var PharmaTextes = {
  // « 37 Bd. Roger Salengro, 78711 Mantes-la-Ville » → { rue, cp, ville }
  decouperAdresse: function(adresse) {
    var a = String(adresse == null ? '' : adresse).trim().replace(/\s+/g, ' ');
    var m = /^(?:(.*?)[,\s]+)?(\d{5}) (.+)$/.exec(a);
    if (!m) return { rue: a, cp: '', ville: '' };
    return { rue: (m[1] || '').replace(/[,\s]+$/, ''), cp: m[2], ville: m[3].replace(/[,\s]+$/, '') };
  },
  // Ville affichée, avec l'arrondissement à Paris, Lyon et Marseille (75017 Paris → « Paris »)
  villeAffichee: function(adresse) {
    var d = this.decouperAdresse(adresse);
    if (!d.ville) return '';
    var grandes = { '75': 'Paris', '69': 'Lyon', '13': 'Marseille' };
    var base = grandes[d.cp.slice(0, 2)];
    if (base && d.ville.toLowerCase() === base.toLowerCase() && /^(750|751|690|130)/.test(d.cp)) {
      var n = d.cp === '75116' ? 16 : parseInt(d.cp.slice(3), 10);
      var max = base === 'Paris' ? 20 : (base === 'Lyon' ? 9 : 16);
      if (n >= 1 && n <= max) return base + ' ' + (n === 1 ? '1er' : n + 'e');
    }
    return d.ville;
  },
  // « 1 rue de l’Exemple, Paris »
  adresseCourte: function(adresse) {
    var d = this.decouperAdresse(adresse), ville = this.villeAffichee(adresse);
    return (d.rue && ville) ? d.rue + ', ' + ville : String(adresse == null ? '' : adresse).trim();
  },
  // « à la Pharmacie So Ouest », « à La Grande Pharmacie », « chez Espace Santé »
  aLaNom: function(nom) {
    var n = String(nom == null ? '' : nom).trim().replace(/\s+/g, ' ');
    if (!n) return 'en pharmacie';
    if (/^la /i.test(n)) return 'à la ' + n.slice(3);
    if (/^l['’]/i.test(n)) return 'à l\'' + n.slice(2);
    if (/^((grande|petite|nouvelle|vieille) )?(para)?pharmacie\b/i.test(n)) return 'à la ' + n;
    return 'chez ' + n;
  }
};

// ── ICÔNES DES CONSEILS (admin et page d'accueil) ──
var PHARMA_ICONES_CONSEIL = {
  soleil:   '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>',
  pilule:   '<path d="M10.5 20.5L3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
  goutte:   '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  coeur:    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  feuille:  '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  info:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};

// ── CLIENTS : identification ───────────────────────────────
// L'email identifie un client. Le nom seul ne suffit pas : deux personnes
// peuvent s'appeler « Marie Dupont » et ne doivent pas partager leur
// compteur de fidélité. Le nom sert de repli uniquement quand aucun email
// n'est connu (anciennes fiches, profil client non renseigné).
var PharmaClients = {
  normEmail: function(e) { return String(e == null ? '' : e).trim().toLowerCase(); },
  normNom: function(n) { return String(n == null ? '' : n).trim().replace(/\s+/g, ' ').toLowerCase(); },
  trouver: function(data, nom, email) {
    var liste = (data && data.clients) || [];
    var e = this.normEmail(email);
    var n = this.normNom(nom);
    var self = this;
    if (e) {
      var parEmail = liste.filter(function(c) { return self.normEmail(c.email) === e; })[0];
      if (parEmail) return parEmail;
      // Email inconnu : on ne reprend une fiche existante par son nom que si
      // elle n'a pas d'email (sinon c'est une autre personne du même nom).
      return liste.filter(function(c) { return self.normNom(c.nom) === n && !self.normEmail(c.email); })[0] || null;
    }
    if (!n) return null;
    return liste.filter(function(c) { return self.normNom(c.nom) === n; })[0] || null;
  },
  // Une commande appartient-elle à ce client ? (email si les deux le connaissent, sinon nom)
  commandeAppartient: function(commande, nom, email) {
    var ec = this.normEmail(commande && commande.email);
    var e = this.normEmail(email);
    if (ec && e) return ec === e;
    return this.normNom(commande && commande.client) === this.normNom(nom);
  }
};

// ── FIDÉLITÉ : règles partagées (site, compte client, admin) ──
// Le palier et la réduction se règlent dans l'admin. Le compteur « achats »
// ne fait qu'augmenter ; la progression affichée est calculée par cycle :
// après chaque code débloqué, le client repart de 0 (6e achat = 1 / 5).
var PharmaFidelite = {
  config: function(data) {
    var p = (data && data.parametres) || {};
    var seuil = parseInt(p.fideliteSeuil, 10);
    var reduction = parseInt(p.fideliteReduction, 10);
    return { seuil: seuil > 0 ? seuil : 5, reduction: reduction > 0 ? reduction : 10 };
  },
  progression: function(achats, seuil) {
    achats = Math.max(0, parseInt(achats, 10) || 0);
    var reste = achats % seuil;
    var atteint = achats > 0 && reste === 0;
    return {
      courant: atteint ? seuil : reste,   // 5 / 5 au palier, puis 1 / 5, 2 / 5...
      atteint: atteint,
      restant: atteint ? 0 : seuil - reste,
      pct: Math.round((atteint ? seuil : reste) / seuil * 100)
    };
  },
  // Code fidélité actuellement utilisable par ce client (le plus récent), ou null
  codeActif: function(data, client) {
    if (!client) return null;
    var aujourdhui = pharmaDateLocale();
    var codes = (data.codesPromo || []).filter(function(c) {
      var origine = String(c.origine || '');
      if (origine.indexOf('Auto (fidélité)') !== 0) return false;
      var sien = (c.clientId !== undefined) ? c.clientId === client.id : c.client === client.nom;
      if (!sien || c.actif === false) return false;
      if (c.maxUsages > 0 && c.usages >= c.maxUsages) return false;
      if (c.expire && c.expire < aujourdhui) return false;
      return true;
    });
    return codes.length ? codes[codes.length - 1] : null;
  }
};
