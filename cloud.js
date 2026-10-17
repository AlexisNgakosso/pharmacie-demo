// ============================================================
// LIEN AVEC LA BASE DE DONNÉES (Supabase)
// ============================================================
// Chargé après supabase.js (bibliothèque officielle), supabase-config.js et data.js.
//
// Deux modes :
//  * mode « base de données » : supabase-config.js contient l'adresse du projet et sa clé
//    publique. Le catalogue et les réglages sont lus dans la base, les commandes y sont
//    enregistrées par le serveur (qui relit lui-même prix, stock et codes promo).
//  * mode local (démonstration) : PHARMA_SUPABASE vaut null. Tout reste dans le navigateur,
//    comme avant (data.js / PharmaStore).
//
// Les données lues dans la base sont remises dans la même forme que DATA (data.js),
// pour que l'affichage du site fonctionne à l'identique dans les deux modes.

var PharmaCloud = (function () {
  'use strict';

  var cfg = (typeof PHARMA_SUPABASE !== 'undefined') ? PHARMA_SUPABASE : null;
  var prevu = !!(cfg && cfg.url && cfg.cle);   // une base est configurée
  var actif = false;                            // ... et la connexion est utilisable
  var probleme = '';
  var sb = null;

  // Rôle inscrit dans une ancienne clé au format JWT (« anon » ou « service_role »)
  function roleDuJeton(cle) {
    var parties = String(cle || '').split('.');
    if (parties.length !== 3) return '';
    try {
      var b64 = parties[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(atob(b64)).role || '';
    } catch (e) { return ''; }
  }

  if (prevu) {
    var url = String(cfg.url).trim().replace(/\/+$/, '');
    var cle = String(cfg.cle).trim();
    if (/^sb_secret_/i.test(cle) || roleDuJeton(cle) === 'service_role') {
      // Garde-fou : une clé secrète publiée dans le site donnerait un accès total à la base.
      probleme = 'cle-secrete';
      console.error('supabase-config.js contient une clé SECRÈTE. Le site refuse de l\'utiliser : '
        + 'remplacez-la par la clé publique (sb_publishable_…), puis changez la clé secrète dans Supabase.');
    } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      probleme = 'adresse';
      console.error('supabase-config.js : adresse de projet invalide (attendu : https://xxxx.supabase.co).');
    } else if (typeof supabase === 'undefined' || !supabase || typeof supabase.createClient !== 'function') {
      probleme = 'bibliotheque';
      console.error('supabase.js n\'est pas chargé : vérifiez que le fichier est bien à côté des pages.');
    } else {
      try {
        sb = supabase.createClient(url, cle, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'pharma-auth' }
        });
        actif = true;
      } catch (e) {
        probleme = 'initialisation';
        console.error('Connexion à la base impossible à initialiser', e);
      }
    }
  }

  // ── OUTILS ──────────────────────────────────────────────
  function nombre(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function entier(v) { var n = parseInt(v, 10); return isFinite(n) ? n : 0; }
  function objet(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
  function tableau(v) { return Array.isArray(v) ? v : []; }
  function texte(v) { return v == null ? '' : String(v); }
  function copie(v) { return JSON.parse(JSON.stringify(v)); }

  // Abandonne l'attente au-delà d'un délai (le serveur ne répond pas, connexion coupée)
  function avecDelai(promesse, ms, message) {
    var minuteur;
    var delai = new Promise(function (ok, ko) {
      minuteur = setTimeout(function () {
        var e = new Error(message || 'Le serveur ne répond pas. Vérifiez votre connexion internet puis réessayez.');
        e.delai = true;
        ko(e);
      }, ms);
    });
    return Promise.race([Promise.resolve(promesse), delai]).then(function (r) {
      clearTimeout(minuteur); return r;
    }, function (e) { clearTimeout(minuteur); throw e; });
  }

  // Message compréhensible par un client à partir d'une erreur de la base
  function erreurLisible(e) {
    var msg = texte(e && e.message);
    var code = texte(e && e.code);
    if (e && e.delai) return msg;
    if (code === 'P0001' && msg) return msg;   // messages rédigés dans les fonctions de la base
    if (code === '42501' || /permission denied|row-level security/i.test(msg)) return 'Accès refusé.';
    if (code === '28000') return 'Connexion requise.';
    if (!code || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
      return 'Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.';
    }
    return 'Le serveur a refusé la demande (' + code + '). Réessayez ou contactez la pharmacie.';
  }
  function versErreur(e) {
    var err = new Error(erreurLisible(e));
    err.code = e && e.code;
    err.delai = !!(e && e.delai);
    return err;
  }

  // Requête de lecture ou appel de fonction : renvoie les données, ou lève une erreur lisible
  function executer(requete, ms) {
    return avecDelai(requete, ms || 15000).then(function (r) {
      if (r && r.error) throw r.error;
      return r ? r.data : null;
    }).then(null, function (e) { throw versErreur(e); });
  }

  // ── CONVERSIONS base → forme DATA (data.js) ─────────────
  function produitVersLocal(r) {
    return { id: r.id, nom: texte(r.nom), ref: texte(r.ref), cat: texte(r.cat), prix: nombre(r.prix),
             stock: entier(r.stock), seuil: entier(r.seuil), desc: texte(r.description), actif: r.actif !== false,
             photo: pharmaPhotoValide(r.photo) };
  }
  // Photos des rayons : { nom du rayon: adresse } (colonne absente tant que 04-photos.sql n'a pas été exécuté)
  function photosRayonsVersLocal(lignes) {
    var photos = {};
    tableau(lignes).forEach(function (c) {
      var u = pharmaPhotoValide(c && c.photo);
      if (u) photos[texte(c.nom)] = u;
    });
    return photos;
  }
  function promoVersLocal(r) {
    return { id: r.id, produit: texte(r.produit), produitId: r.produit_id == null ? null : r.produit_id,
             qte: entier(r.qte) || 1, prixNormal: nombre(r.prix_normal), prixPromo: nombre(r.prix_promo),
             pct: entier(r.pct), debut: texte(r.debut), fin: texte(r.fin), statut: texte(r.statut) };
  }
  function conseilVersLocal(r) {
    return { id: r.id, icone: texte(r.icone), titre: texte(r.titre), texte: texte(r.texte),
             couleur: texte(r.couleur), actif: r.actif !== false };
  }
  function appliquerReglagesPublics(d, r) {
    var p = d.parametres;
    p.nom = texte(r.nom);
    p.adresse = texte(r.adresse);
    p.tel = texte(r.tel);
    p.email = texte(r.email);
    p.couleurPrimaire = texte(r.couleur_primaire) || p.couleurPrimaire;
    p.logoTexte = texte(r.logo_texte);
    p.bandeauActif = !!r.bandeau_actif;
    p.bandeauMsg = texte(r.bandeau_msg);
    p.fideliteSeuil = entier(r.fidelite_seuil) || 5;
    p.fideliteReduction = entier(r.fidelite_reduction) || 10;
    p.legal = objet(r.legal);
    p.emailjs = objet(r.emailjs);
    p.notifAuto = objet(r.notif_auto);
    d.horaires = objet(r.horaires);
    d.joursSpeciaux = tableau(r.jours_speciaux);
  }

  // Données vides de la même forme que DATA : réglages de data.js en attendant la base,
  // mais aucun produit, commande ou client (rien d'inventé ne doit s'afficher).
  var LISTES = ['categories', 'produits', 'promos', 'conseils', 'codesPromo', 'alertes', 'notifications',
                'emailLog', 'clients', 'employes', 'commandes', 'tickets', 'messages', 'joursSpeciaux'];
  function squelette() {
    var d = copie(PHARMA_SEED_DATA);
    LISTES.forEach(function (k) { d[k] = []; });
    return d;
  }

  // ── COPIE LOCALE DU CATALOGUE ───────────────────────────
  // Le dernier catalogue reçu est gardé dans le navigateur : à la visite suivante, la page
  // s'affiche immédiatement puis se met à jour dès que la base répond. Uniquement des
  // informations publiques (aucune donnée de client).
  var CLE_CACHE = 'pharma-cache-public';
  var VERSION_CACHE = 1;
  var depuisCache = false;
  function lireCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CLE_CACHE) || 'null');
      if (!c || c.v !== VERSION_CACHE || !c.d) return null;
      if (Date.now() - nombre(c.t) > 7 * 24 * 3600 * 1000) return null;   // trop ancien
      return c.d;
    } catch (e) { return null; }
  }
  function ecrireCache(d) {
    try {
      localStorage.setItem(CLE_CACHE, JSON.stringify({ v: VERSION_CACHE, t: Date.now(), d: {
        parametres: d.parametres, horaires: d.horaires, joursSpeciaux: d.joursSpeciaux,
        categories: d.categories, photosRayons: d.photosRayons, produits: d.produits, promos: d.promos, conseils: d.conseils
      } }));
    } catch (e) { /* stockage plein ou bloqué : sans conséquence */ }
  }

  // Données affichées à l'ouverture de la page, avant la réponse de la base
  function donneesInitiales() {
    var d = squelette();
    var c = lireCache();
    if (c) {
      ['horaires', 'joursSpeciaux', 'categories', 'photosRayons', 'produits', 'promos', 'conseils'].forEach(function (k) {
        if (c[k] !== undefined) d[k] = c[k];
      });
      if (c.parametres && typeof c.parametres === 'object') {
        Object.keys(c.parametres).forEach(function (k) { d.parametres[k] = c.parametres[k]; });
      }
      depuisCache = true;
    }
    return PharmaStore.migrer(d);
  }

  // ── LECTURE DES DONNÉES PUBLIQUES (site client) ─────────
  function chargerPublic() {
    if (!actif) return Promise.reject(new Error('Base de données non disponible.'));
    return Promise.all([
      executer(sb.from('settings_public').select('*').eq('id', 1).maybeSingle()),
      executer(sb.from('categories').select('*').order('id')),
      executer(sb.from('produits').select('*').order('id')),
      executer(sb.from('promos').select('*').order('id')),
      executer(sb.from('conseils').select('*').order('id'))
    ]).then(function (r) {
      var d = squelette();
      if (r[0]) appliquerReglagesPublics(d, r[0]);
      d.categories = tableau(r[1]).map(function (c) { return texte(c.nom); });
      d.photosRayons = photosRayonsVersLocal(r[1]);
      d.produits = tableau(r[2]).filter(function (p) { return p.actif !== false; }).map(produitVersLocal);
      d.promos = tableau(r[3]).map(promoVersLocal);
      d.conseils = tableau(r[4]).filter(function (c) { return c.actif !== false; }).map(conseilVersLocal);
      d = PharmaStore.migrer(d);
      ecrireCache(d);
      return d;
    });
  }

  // ── CODE PROMO (aperçu dans le panier) ──────────────────
  // Renvoie { ok, code, pct, scope } ou { ok:false, erreur }. Un code personnel (fidélité)
  // n'est reconnu qu'avec l'adresse email de son titulaire.
  function verifierCode(code, email) {
    if (!actif) return Promise.reject(new Error('Base de données non disponible.'));
    return executer(sb.rpc('verifier_code_promo', { p_code: texte(code), p_email: texte(email) })).then(function (r) {
      r = objet(r);
      if (r.ok === true) {
        return { ok: true, code: texte(r.code), pct: entier(r.pct), scope: texte(r.scope) || 'Tous' };
      }
      return { ok: false, erreur: texte(r.erreur) || 'Code promo invalide' };
    });
  }

  // ── COMMANDE ────────────────────────────────────────────
  // p : { nom, email, tel, lignes:[{type:'prod'|'promo', id, qty}], code, langue }
  // Le serveur relit prix, stock et code promo, crée le client, décompte le stock et la
  // fidélité. Renvoie sa réponse ({ ok:true, id, code_retrait, ... } ou { ok:false, erreur }).
  function passerCommande(p) {
    if (!actif) return Promise.reject(new Error('Le service de commande est momentanément indisponible.'));
    var requete = sb.rpc('passer_commande', {
      p_nom: texte(p.nom), p_email: texte(p.email), p_tel: texte(p.tel),
      p_lignes: tableau(p.lignes), p_code: p.code ? texte(p.code) : null, p_lang: texte(p.langue) || 'fr'
    });
    return executer(requete, 25000).then(function (r) { return objet(r); }, function (e) {
      if (e.delai) {
        e.message = 'Le serveur met trop de temps à répondre. Avant de recommencer, vérifiez votre boîte email : '
          + 'si une confirmation est arrivée, votre commande est bien enregistrée.';
      }
      throw e;
    });
  }

  // ── JOURNAL DES EMAILS ──────────────────────────────────
  // Depuis le site client, seule la fonction prévue est appelée : elle n'accepte qu'un email
  // lié à une commande récente, et ne laisse pas choisir le destinataire.
  var TYPES_JOURNAL_PUBLIC = ['commandeRecue', 'commandePrete', 'codeFidelite'];
  function journaliserEmail(type, params, resultat, test) {
    if (!actif || test || !resultat || resultat.manuel) return Promise.resolve();
    if (TYPES_JOURNAL_PUBLIC.indexOf(type) === -1) return Promise.resolve();
    var commande = texte(params && params.order_id);
    if (!commande) return Promise.resolve();
    var detail = resultat.ok ? '' : texte(resultat.detail || resultat.raison).slice(0, 200);
    return executer(sb.rpc('journaliser_email', {
      p_type: type, p_commande: commande, p_statut: resultat.ok ? 'Envoyé' : 'Échec', p_detail: detail
    })).then(null, function (e) { console.warn('Journal des emails non enregistré', e); });
  }

  return {
    prevu: prevu,
    actif: actif,
    probleme: probleme,
    client: function () { return sb; },
    get depuisCache() { return depuisCache; },
    donneesInitiales: donneesInitiales,
    chargerPublic: chargerPublic,
    verifierCode: verifierCode,
    passerCommande: passerCommande,
    journaliserEmail: journaliserEmail,
    erreurLisible: erreurLisible,
    executer: executer,
    // conversions réutilisées par l'administration et l'espace client
    conv: { produit: produitVersLocal, promo: promoVersLocal, conseil: conseilVersLocal, reglagesPublics: appliquerReglagesPublics,
            photosRayons: photosRayonsVersLocal },
    squelette: squelette
  };
})();
