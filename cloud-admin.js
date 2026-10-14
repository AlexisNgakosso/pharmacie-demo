// ============================================================
// ADMINISTRATION RELIÉE À LA BASE DE DONNÉES (Supabase)
// ============================================================
// Chargé dans admin.html après cloud.js et avant admin.js. En mode démonstration
// (aucune base configurée), ce fichier ne fait rien et l'administration fonctionne comme avant.
//
// Principe :
//  * connexion obligatoire (email et mot de passe du compte Supabase) ; seuls les comptes
//    « employé » ou « admin » entrent. La base vérifie elle-même ces droits à chaque requête ;
//  * les données sont lues dans la base puis remises dans la forme de DATA (data.js) :
//    les pages de l'administration s'affichent sans changement ;
//  * à chaque enregistrement (persist), les différences avec la dernière lecture sont envoyées
//    à la base, table par table (ajouts, modifications, suppressions) ;
//  * les commandes ne sont jamais modifiées directement : « prête », « retirée », « annulée »
//    et « supprimée » passent par les fonctions du serveur, qui tiennent stock et fidélité ;
//  * les données sont relues toutes les 20 secondes (nouvelles commandes, alertes) ;
//  * déconnexion automatique après 60 minutes sans activité (poste partagé au comptoir).

var PharmaAdminCloud = (function () {
  'use strict';

  var actif = (typeof PharmaCloud !== 'undefined') && PharmaCloud.prevu;
  if (!actif) return { actif: false };

  var sb = PharmaCloud.client();
  var executer = PharmaCloud.executer;
  var connecte = false;
  var profil = null;              // profil du compte connecté
  var colonnesPrivees = {};       // colonnes présentes dans settings_private (selon la mise à jour SQL)
  var INACTIVITE_MAX = 60 * 60 * 1000;
  var INTERVALLE_RELECTURE = 20 * 1000;

  // ── OUTILS ──────────────────────────────────────────────
  function nombre(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function entier(v) { var n = parseInt(v, 10); return isFinite(n) ? n : 0; }
  function texte(v) { return v == null ? '' : String(v); }
  function tableau(v) { return Array.isArray(v) ? v : []; }
  function objet(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
  function egal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // Copie indépendante : l'instantané ne doit jamais partager un objet avec les données affichées
  // (sinon une modification faite sur place, comme l'ajout d'un jour spécial, passerait inaperçue)
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function deux(n) { return ('0' + n).slice(-2); }
  function dateCourte(iso) {   // « 14/10 9h05 », comme les commandes du mode démonstration
    var d = new Date(iso);
    return isNaN(d) ? '' : deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + ' ' + d.getHours() + 'h' + deux(d.getMinutes());
  }
  function heureCourte(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getHours() + 'h' + deux(d.getMinutes());
  }
  function arrondi(n) { return Math.round(nombre(n) * 100) / 100; }
  function notifier(msg, type) { if (typeof toast === 'function') toast(msg, type); }

  // Les données en mémoire gardent le lien avec leur ligne en base (identifiant d'origine),
  // sans ajouter de champ visible : un élément sans lien est un ajout à enregistrer.
  var idsBase = new WeakMap();

  // ── CONVERSIONS ─────────────────────────────────────────
  var conv = PharmaCloud.conv;
  function clientVersLocal(r) {
    return { id: r.id, nom: texte(r.nom), email: texte(r.email), tel: texte(r.tel), type: texte(r.type) || 'Invité',
             notifs: texte(r.notifs), rgpd: !!r.rgpd, achats: entier(r.achats), depenses: nombre(r.depenses), userId: r.user_id || null };
  }
  function codeVersLocal(r, nomsClients) {
    var c = { code: texte(r.code), client: r.client_id == null ? 'Tous les clients' : (nomsClients[r.client_id] || 'Client supprimé'),
              pct: entier(r.pct), scope: texte(r.scope) || 'Tous', origine: texte(r.origine), usages: entier(r.usages),
              maxUsages: entier(r.max_usages), expire: texte(r.expire), actif: r.actif !== false,
              commandeId: texte(r.commande_id), palier: entier(r.palier) };
    if (r.client_id != null) c.clientId = r.client_id;
    return c;
  }
  function commandeVersLocal(r) {
    var c = { id: texte(r.id), client: texte(r.client_nom), email: texte(r.email), tel: texte(r.tel), produits: texte(r.produits),
              total: nombre(r.total), remise: nombre(r.remise), codePromo: texte(r.code_promo), codeRetrait: texte(r.code_retrait),
              lang: texte(r.lang) || 'fr', statut: texte(r.statut), valide: texte(r.valide), timestamp: texte(r.created_at),
              date: dateCourte(r.created_at),
              lignes: tableau(r.lignes).map(function (l) {
                return { nom: texte(l.nom), qty: entier(l.qty), unites: entier(l.unites) || 1, produitId: l.produit_id == null ? null : l.produit_id };
              }) };
    if (r.client_id != null) c.clientId = r.client_id;
    if (r.retrait_ts) c.retraitTs = texte(r.retrait_ts);
    return c;
  }
  function ticketVersLocal(r) {
    return { id: texte(r.id), client: texte(r.client), type: texte(r.type), sujet: texte(r.sujet), commande: texte(r.commande),
             doc: !!r.doc, priorite: texte(r.priorite) || 'Normal', statut: texte(r.statut) || 'Ouvert',
             reponse: texte(r.reponse), note: texte(r.note), historique: tableau(r.historique), timestamp: texte(r.created_at) };
  }
  function messageVersLocal(r) {
    return { id: r.id, de: texte(r.de), msg: texte(r.msg), heure: heureCourte(r.created_at), lu: !!r.lu, timestamp: texte(r.created_at) };
  }
  function alerteVersLocal(r) {
    return { id: r.id, type: texte(r.type), titre: texte(r.titre), texte: texte(r.texte), lien: texte(r.lien), timestamp: texte(r.created_at), lu: !!r.lu };
  }
  function notificationVersLocal(r) {
    return { id: r.id, type: texte(r.type), message: texte(r.message), destinataires: entier(r.destinataires), cible: texte(r.cible),
             statut: texte(r.statut), timestamp: texte(r.created_at) };
  }
  function emailVersLocal(r) {
    return { id: r.id, timestamp: texte(r.created_at), type: texte(r.type), destinataire: texte(r.destinataire),
             commande: texte(r.commande), statut: texte(r.statut), detail: texte(r.detail) };
  }
  function nomProfil(p) {
    var n = (texte(p.prenom) + ' ' + texte(p.nom)).trim();
    return n || texte(p.email).split('@')[0] || 'Compte';
  }

  // Forme « base » de chaque élément (ce qui est comparé et envoyé)
  function trouverProduitParNom(nom) {
    var n = texte(nom).trim().toLowerCase();
    return (DATA.produits || []).find(function (p) { return texte(p.nom).trim().toLowerCase() === n && idsBase.has(p); }) || null;
  }
  var TABLES = [
    { cle: 'produits', table: 'produits', id: 'id', versBase: function (p) {
        return { nom: texte(p.nom).trim(), ref: texte(p.ref), cat: texte(p.cat) || null, prix: arrondi(p.prix), stock: entier(p.stock),
                 seuil: entier(p.seuil), description: texte(p.desc), actif: p.actif !== false };
      } },
    { cle: 'promos', table: 'promos', id: 'id', versBase: function (p) {
        // Produit dont le stock est consommé : celui qui porte le nom choisi dans la liste,
        // sinon celui déjà relié (lot au libellé différent, ex. « Lot Crème Solaire x3 »)
        var prod = trouverProduitParNom(p.produit);
        var pid = prod ? idsBase.get(prod) : (p.produitId == null ? null : p.produitId);
        return { produit: texte(p.produit), produit_id: pid, qte: entier(p.qte) || 1, prix_normal: arrondi(p.prixNormal),
                 prix_promo: arrondi(p.prixPromo), pct: entier(p.pct), debut: texte(p.debut).slice(0, 10) || null,
                 fin: texte(p.fin).slice(0, 10) || null, statut: texte(p.statut) || 'Active' };
      } },
    { cle: 'conseils', table: 'conseils', id: 'id', versBase: function (c) {
        return { icone: texte(c.icone), titre: texte(c.titre), texte: texte(c.texte), couleur: texte(c.couleur) || '#1B6B45', actif: c.actif !== false };
      } },
    { cle: 'clients', table: 'clients', id: 'id', versBase: function (c) {
        return { nom: texte(c.nom).trim(), email: texte(c.email).trim(), tel: texte(c.tel), type: c.type === 'Compte' ? 'Compte' : 'Invité',
                 notifs: texte(c.notifs) || 'Email', rgpd: !!c.rgpd, achats: entier(c.achats), depenses: arrondi(c.depenses) };
      } },
    { cle: 'codesPromo', table: 'codes_promo', id: 'code', versBase: function (c) {
        var clientId = null;
        if (c.clientId !== undefined && c.clientId !== null) clientId = c.clientId;
        else if (c.client && c.client !== 'Tous les clients') {
          var n = PharmaClients.normNom(c.client);
          var cl = (DATA.clients || []).find(function (x) { return PharmaClients.normNom(x.nom) === n && idsBase.has(x); });
          // Un code nominatif sans client retrouvé deviendrait utilisable par tous : refusé
          if (!cl) throw new Error('le client « ' + c.client + ' » est introuvable pour le code ' + c.code);
          clientId = idsBase.get(cl);
        }
        return { code: texte(c.code).trim().toUpperCase(), client_id: clientId, pct: entier(c.pct), scope: texte(c.scope) || 'Tous',
                 origine: texte(c.origine) || 'Manuel', usages: entier(c.usages), max_usages: entier(c.maxUsages),
                 expire: texte(c.expire).slice(0, 10) || null, actif: c.actif !== false };
      } },
    { cle: 'tickets', table: 'tickets', id: 'id', versBase: function (t) {
        return { client: texte(t.client), type: texte(t.type), sujet: texte(t.sujet), commande: texte(t.commande), doc: !!t.doc,
                 priorite: t.priorite === 'Urgent' ? 'Urgent' : 'Normal', statut: texte(t.statut) || 'Ouvert',
                 reponse: texte(t.reponse), note: texte(t.note), historique: tableau(t.historique) };
      } },
    { cle: 'messages', table: 'messages', id: 'id', versBase: function (m) {
        return { de: texte(m.de), msg: texte(m.msg), lu: !!m.lu };
      } },
    { cle: 'alertes', table: 'alertes', id: 'id', versBase: function (a) {
        return { type: texte(a.type), titre: texte(a.titre), texte: texte(a.texte), lien: texte(a.lien), lu: !!a.lu };
      } },
    { cle: 'notifications', table: 'notifications', id: 'id', versBase: function (n) {
        return { type: texte(n.type), message: texte(n.message), destinataires: entier(n.destinataires), cible: texte(n.cible) || 'tous',
                 statut: texte(n.statut) };
      } }
  ];

  function reglagesPublicsVersBase(d) {
    var p = d.parametres || {};
    return { nom: texte(p.nom), adresse: texte(p.adresse), tel: texte(p.tel), email: texte(p.email),
             couleur_primaire: /^#[0-9a-fA-F]{6}$/.test(texte(p.couleurPrimaire)) ? p.couleurPrimaire : '#1B6B45',
             logo_texte: texte(p.logoTexte), bandeau_actif: !!p.bandeauActif, bandeau_msg: texte(p.bandeauMsg),
             fidelite_seuil: entier(p.fideliteSeuil) || 5, fidelite_reduction: entier(p.fideliteReduction) || 10,
             horaires: objet(d.horaires), jours_speciaux: tableau(d.joursSpeciaux), legal: objet(p.legal),
             emailjs: objet(p.emailjs), notif_auto: objet(p.notifAuto) };
  }
  function reglagesPrivesVersBase(d) {
    var p = d.parametres || {};
    var r = { restriction_employes: !!p.restrictionEmployes, rapport_jour: texte(p.rapportJour) || 'lundi',
              rapport_heure: texte(p.rapportHeure) || '08:00', rapport_email: texte(p.rapportEmail) };
    if (colonnesPrivees.email_quota) {
      var q = p.emailQuota;
      r.email_quota = (q && typeof q === 'object') ? { releve: entier(q.releve), releveLe: texte(q.releveLe) } : null;
    }
    if (colonnesPrivees.rapport_contenu) r.rapport_contenu = objet(p.rapportContenu);
    return r;
  }
  function roleVersBase(e) { return e.role === 'Admin' ? 'admin' : 'employe'; }
  function accesParDefaut(e) { return e.role === 'Admin' ? 'Tout' : 'Commandes + Tickets'; }

  // ── LECTURE DE TOUTES LES DONNÉES DU PERSONNEL ──────────
  function chargerTout() {
    var q = [
      sb.from('settings_public').select('*').eq('id', 1).maybeSingle(),
      sb.from('settings_private').select('*').eq('id', 1).maybeSingle(),
      sb.from('categories').select('*').order('id'),
      sb.from('produits').select('*').order('id'),
      sb.from('promos').select('*').order('id'),
      sb.from('conseils').select('*').order('id'),
      sb.from('clients').select('*').order('id'),
      sb.from('codes_promo').select('*').order('created_at'),
      sb.from('commandes').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('tickets').select('*').order('created_at', { ascending: false }),
      sb.from('messages').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('alertes').select('*').order('created_at', { ascending: false }).limit(50),
      sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      sb.from('email_log').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('profiles').select('id,role,actif,acces,email,prenom,nom').order('created_at')
    ];
    return Promise.all(q.map(function (r) { return executer(r); })).then(function (r) {
      var d = PharmaCloud.squelette();
      var prive = r[1];
      if (r[0]) conv.reglagesPublics(d, r[0]);
      colonnesPrivees = {};
      if (prive) {
        Object.keys(prive).forEach(function (k) { colonnesPrivees[k] = true; });
        d.parametres.restrictionEmployes = !!prive.restriction_employes;
        d.parametres.rapportJour = texte(prive.rapport_jour);
        d.parametres.rapportHeure = texte(prive.rapport_heure);
        d.parametres.rapportEmail = texte(prive.rapport_email);
        if (prive.rapport_contenu && typeof prive.rapport_contenu === 'object') d.parametres.rapportContenu = prive.rapport_contenu;
      }
      d.categories = tableau(r[2]).map(function (c) { return texte(c.nom); });
      d.produits = tableau(r[3]).map(conv.produit);
      d.promos = tableau(r[4]).map(conv.promo);
      d.conseils = tableau(r[5]).map(conv.conseil);
      d.clients = tableau(r[6]).map(clientVersLocal);
      var noms = {};
      d.clients.forEach(function (c) { noms[c.id] = c.nom; });
      d.codesPromo = tableau(r[7]).map(function (c) { return codeVersLocal(c, noms); });
      d.commandes = tableau(r[8]).map(commandeVersLocal);
      d.tickets = tableau(r[9]).map(ticketVersLocal);
      d.messages = tableau(r[10]).map(messageVersLocal).reverse();
      d.alertes = tableau(r[11]).map(alerteVersLocal);
      d.notifications = tableau(r[12]).map(notificationVersLocal);
      d.emailLog = tableau(r[13]).map(emailVersLocal);
      var profils = tableau(r[14]);
      d.employes = profils.filter(function (p) { return p.role === 'employe' || p.role === 'admin'; }).map(function (p, i) {
        var e = { id: i + 1, uid: p.id, nom: nomProfil(p), email: texte(p.email), role: p.role === 'admin' ? 'Admin' : 'Employé', actif: p.actif !== false };
        e.acces = texte(p.acces) || accesParDefaut(e);
        return e;
      });
      // Décompte des emails restants : envois réussis depuis le dernier relevé (journal de la base)
      var q0 = prive && prive.email_quota;
      if (q0 && typeof q0 === 'object' && q0.releve !== undefined) {
        var depuis = new Date(q0.releveLe || 0).getTime() || 0;
        d.parametres.emailQuota = { releve: entier(q0.releve), releveLe: texte(q0.releveLe),
          envoyes: d.emailLog.filter(function (e) { return e.statut === 'Envoyé' && new Date(e.timestamp).getTime() >= depuis; }).length };
      } else {
        d.parametres.emailQuota = null;
      }
      d = PharmaStore.migrer ? migrerSansSemer(d) : d;
      return { donnees: d, profils: profils, prive: !!prive };
    });
  }
  // Complète les réglages manquants (anciens enregistrements) sans réinjecter de données de démonstration
  function migrerSansSemer(d) {
    var listes = {};
    ['categories', 'produits', 'promos', 'conseils', 'codesPromo', 'alertes', 'notifications', 'emailLog', 'clients', 'employes', 'commandes', 'tickets', 'messages', 'joursSpeciaux']
      .forEach(function (k) { listes[k] = d[k]; });
    var m = PharmaStore.migrer(d);
    Object.keys(listes).forEach(function (k) { if (Array.isArray(listes[k])) m[k] = listes[k]; });
    return m;
  }

  // ── INSTANTANÉ : état de la base à la dernière lecture ──
  var instantane = null;
  var profilsConnus = [];
  function prendreInstantane(d) {
    instantane = { tables: {}, categories: d.categories.slice(), public: clone(reglagesPublicsVersBase(d)), prive: clone(reglagesPrivesVersBase(d)), employes: {} };
    TABLES.forEach(function (def) {
      var m = new Map();
      (d[def.cle] || []).forEach(function (obj) {
        var dbid = obj[def.id === 'code' ? 'code' : 'id'];
        idsBase.set(obj, dbid);
        try { m.set(dbid, clone(def.versBase(obj))); } catch (e) { m.set(dbid, null); }
      });
      instantane.tables[def.cle] = m;
    });
    (d.employes || []).forEach(function (e) { instantane.employes[e.uid] = { role: roleVersBase(e), acces: texte(e.acces) }; });
  }

  // ── ENREGISTREMENT DES MODIFICATIONS ────────────────────
  function verifierLigne(res, quoi) {
    if (!Array.isArray(res) || res.length === 0) throw new Error(quoi + ' : modification refusée (droits insuffisants)');
    return res[0];
  }
  function synchroniser() {
    var erreurs = [];
    var etapes = [];
    function etape(fn) { etapes.push(fn); }
    var d = DATA;

    // 1. Catégories ajoutées (avant les produits qui les utilisent)
    var avantCat = instantane.categories;
    d.categories.forEach(function (nom) {
      if (avantCat.indexOf(nom) === -1 && texte(nom).trim()) {
        etape(function () {
          return executer(sb.from('categories').insert({ nom: texte(nom).trim() }).select()).then(function () { avantCat.push(nom); });
        });
      }
    });
    // 2. Tables : ajouts, modifications, suppressions
    TABLES.forEach(function (def) {
      var snap = instantane.tables[def.cle];
      var vus = {};
      (d[def.cle] || []).forEach(function (obj) {
        var ligne;
        try { ligne = clone(def.versBase(obj)); } catch (e) { erreurs.push(e.message); return; }
        if (!idsBase.has(obj)) {
          etape(function () {
            return executer(sb.from(def.table).insert(ligne).select()).then(function (res) {
              var cree = verifierLigne(res, 'Ajout');
              var nid = cree[def.id];
              idsBase.set(obj, nid);
              if (def.id === 'id') obj.id = nid;
              snap.set(nid, ligne);
            });
          });
          return;
        }
        var dbid = idsBase.get(obj);
        vus[String(dbid)] = true;
        var avant = snap.get(dbid);
        if (!avant) return;
        var changes = {}, n = 0;
        Object.keys(ligne).forEach(function (k) { if (!egal(ligne[k], avant[k])) { changes[k] = ligne[k]; n++; } });
        if (n) {
          etape(function () {
            return executer(sb.from(def.table).update(changes).eq(def.id, dbid).select()).then(function (res) {
              verifierLigne(res, 'Modification');
              snap.set(dbid, ligne);
            });
          });
        }
      });
      snap.forEach(function (ligne, dbid) {
        if (vus[String(dbid)]) return;
        etape(function () {
          return executer(sb.from(def.table).delete().eq(def.id, dbid).select()).then(function (res) {
            verifierLigne(res, 'Suppression');
            snap.delete(dbid);
          });
        });
      });
    });
    // 3. Catégories retirées (après les produits)
    avantCat.slice().forEach(function (nom) {
      if (d.categories.indexOf(nom) === -1) {
        etape(function () {
          return executer(sb.from('categories').delete().eq('nom', nom).select()).then(function () {
            avantCat.splice(avantCat.indexOf(nom), 1);
          });
        });
      }
    });
    // 4. Réglages (une seule ligne chacun ; réservé à l'administrateur)
    [['settings_public', reglagesPublicsVersBase, 'public'], ['settings_private', reglagesPrivesVersBase, 'prive']].forEach(function (r) {
      var ligne = clone(r[1](d)), avant = instantane[r[2]], changes = {}, n = 0;
      Object.keys(ligne).forEach(function (k) { if (!egal(ligne[k], avant[k])) { changes[k] = ligne[k]; n++; } });
      if (!n) return;
      etape(function () {
        return executer(sb.from(r[0]).update(changes).eq('id', 1).select()).then(function (res) {
          if (!Array.isArray(res) || !res.length) throw new Error('seul un administrateur peut modifier les réglages');
          instantane[r[2]] = ligne;
        });
      });
    });
    // 5. Équipe : les rôles se donnent par la fonction du serveur (jamais en écrivant le profil)
    var restants = {};
    Object.keys(instantane.employes).forEach(function (uid) { restants[uid] = true; });
    (d.employes || []).forEach(function (e) {
      var role = roleVersBase(e), acces = texte(e.acces) || accesParDefaut(e);
      var uid = e.uid;
      if (!uid) {
        var email = texte(e.email).trim().toLowerCase();
        var p = profilsConnus.find(function (x) { return texte(x.email).toLowerCase() === email; });
        if (!email || !p) {
          erreurs.push('aucun compte n\'existe avec l\'adresse ' + (e.email || '(vide)') + '. Créez d\'abord le compte dans Supabase (Authentication, Users, Add user), puis ajoutez l\'employé ici');
          return;
        }
        uid = p.id;
        e.uid = uid;
      }
      delete restants[uid];
      var avant = instantane.employes[uid];
      if (avant && avant.role === role && avant.acces === acces) return;
      etape(function () {
        return executer(sb.rpc('definir_role', { p_user: uid, p_role: role, p_acces: acces })).then(function () {
          instantane.employes[uid] = { role: role, acces: acces };
        });
      });
    });
    Object.keys(restants).forEach(function (uid) {
      etape(function () {
        return executer(sb.rpc('definir_role', { p_user: uid, p_role: 'client', p_acces: '' })).then(function () {
          delete instantane.employes[uid];
        });
      });
    });

    // Exécution dans l'ordre ; une erreur n'empêche pas les étapes suivantes
    return etapes.reduce(function (chaine, fn) {
      return chaine.then(function () {
        return fn().then(null, function (e) { erreurs.push((e && e.message) || 'erreur inconnue'); });
      });
    }, Promise.resolve()).then(function () { return erreurs; });
  }

  var sync = { enCours: false, aRefaire: false };
  function planifierSync() {
    if (!connecte || !instantane) return;
    if (sync.enCours) { sync.aRefaire = true; return; }
    lancerSync();
  }
  function lancerSync() {
    sync.enCours = true;
    etatEnregistrement('enCours');
    synchroniser().then(function (erreurs) {
      sync.enCours = false;
      if (sync.aRefaire) { sync.aRefaire = false; lancerSync(); return; }
      if (erreurs.length) {
        etatEnregistrement('erreur');
        notifier('Modification non enregistrée : ' + erreurs[0], 'error');
        console.warn('Enregistrement :', erreurs);
      } else {
        etatEnregistrement('ok');
      }
      // Relecture : ce qui est affiché correspond toujours à ce que contient la base
      recharger({ force: true });
    });
  }

  // Petit indicateur discret dans la barre du haut
  function etatEnregistrement(etat) {
    var el = document.getElementById('etat-base');
    if (!el) return;
    el.setAttribute('data-etat', etat);
    el.textContent = etat === 'enCours' ? 'Enregistrement…' : (etat === 'erreur' ? 'Non enregistré' : 'Enregistré');
    clearTimeout(el._t);
    if (etat === 'ok') el._t = setTimeout(function () { el.textContent = ''; el.removeAttribute('data-etat'); }, 2500);
  }

  // ── RELECTURE ───────────────────────────────────────────
  var derniereSignature = '';
  var derniereLecture = 0;
  var reglagesInternesLus = false;   // faux pour un compte « employé » en dehors des heures d'ouverture
  var lectureEnCours = null;
  var PAGES_FORMULAIRE = ['parametres', 'horaires'];
  function recharger(options) {
    options = options || {};
    if (!connecte) return Promise.resolve(false);
    if (sync.enCours) return Promise.resolve(false);   // ne jamais écraser une modification en cours d'envoi
    if (lectureEnCours) return lectureEnCours;
    lectureEnCours = chargerTout().then(function (res) {
      lectureEnCours = null;
      derniereLecture = Date.now();
      // Déconnexion survenue pendant la lecture : ces données ne doivent pas s'afficher
      if (!connecte) return false;
      reglagesInternesLus = res.prive;
      if (sync.enCours) return false;
      var sig = JSON.stringify(res.donnees);
      profilsConnus = res.profils;
      if (!options.force && sig === derniereSignature) return false;
      derniereSignature = sig;
      var avant = (typeof nbAlertesNonLues === 'function') ? nbAlertesNonLues() : 0;
      DATA = res.donnees;
      prendreInstantane(DATA);
      var apres = (typeof nbAlertesNonLues === 'function') ? nbAlertesNonLues() : 0;
      rafraichirEcran(apres > avant && !options.force && !options.premiere);
      return true;
    }, function (e) {
      lectureEnCours = null;
      console.warn('Relecture impossible :', e && e.message);
      if (options.premiere) throw e;
      return false;
    });
    return lectureEnCours;
  }
  function rafraichirEcran(nouveau) {
    if (typeof appliquerCouleur === 'function') appliquerCouleur();
    if (typeof renderNotifCloche === 'function') renderNotifCloche(nouveau);
    if (typeof updateNavBadges === 'function') updateNavBadges();
    if (typeof currentPage === 'string' && PAGES_FORMULAIRE.indexOf(currentPage) === -1 && typeof renderPage === 'function') {
      // Les pages avec filtres gardent la recherche et le filtre en cours
      if (currentPage === 'commandes' && typeof filtrerCommandes === 'function') filtrerCommandes();
      else if (currentPage === 'tickets' && typeof filtrerTickets === 'function') filtrerTickets();
      else if (currentPage === 'clients' && typeof filtrerClients === 'function') filtrerClients();
      else renderPage(currentPage);
    }
    if (nouveau) notifier('Nouvelle activité reçue');
  }

  // ── COMMANDES : actions passant par le serveur ──────────
  function rpc(nom, params) { return executer(sb.rpc(nom, params)); }
  function apresAction(message) {
    if (message) notifier(message);
    return recharger({ force: true });
  }
  function marquerPrete(id) {
    return rpc('marquer_prete', { p_id: id }).then(function () {
      var c = DATA.commandes.find(function (x) { return x.id === id; });
      if (c) { c.statut = 'Prête'; }
      return recharger({ force: true }).then(function () { return true; });
    }, function (e) { notifier(e.message, 'error'); return recharger({ force: true }).then(function () { return false; }); });
  }
  function annuler(id) {
    return rpc('annuler_commande', { p_id: id }).then(function () {
      return apresAction('Commande ' + id + ' annulée : stock et fidélité mis à jour');
    }, function (e) { notifier(e.message, 'error'); return recharger({ force: true }); });
  }
  function supprimer(id) {
    return rpc('supprimer_commande', { p_id: id }).then(function () {
      return apresAction('Commande ' + id + ' supprimée');
    }, function (e) { notifier(e.message, 'error'); return recharger({ force: true }); });
  }
  function validerRetrait(ref) {
    return rpc('valider_retrait', { p_ref: ref }).then(function (r) {
      return apresAction('Commande ' + texte(r && r.id) + ' validée par ' + texte(r && r.valide)).then(function () { return true; });
    }, function (e) { notifier(e.message, 'error'); return false; });
  }

  // ── JOURNAL DES EMAILS (envois faits depuis l'administration) ──
  function journaliserEmailPersonnel(type, params, resultat, test) {
    if (!resultat || !connecte) return Promise.resolve();
    var statut = resultat.manuel ? 'Préparé (envoi manuel)' : (resultat.ok ? 'Envoyé' : 'Échec');
    var ligne = { type: test ? 'test' : type, commande: texte(params && params.order_id), destinataire: texte(params && params.to_email),
                  statut: statut, detail: (resultat.ok || resultat.manuel) ? '' : texte(resultat.detail || resultat.raison).slice(0, 200) };
    // Affiché tout de suite ; la base le garde pour tous les postes
    if (Array.isArray(DATA.emailLog)) DATA.emailLog.unshift({ id: 'nouveau-' + Date.now(), timestamp: new Date().toISOString(), type: ligne.type,
      destinataire: ligne.destinataire, commande: ligne.commande, statut: statut, detail: ligne.detail });
    var q = DATA.parametres && DATA.parametres.emailQuota;
    if (resultat.ok && q && typeof q === 'object') q.envoyes = entier(q.envoyes) + 1;
    return executer(sb.from('email_log').insert(ligne).select()).then(null, function (e) {
      console.warn('Journal des emails non enregistré :', e && e.message);
    });
  }

  // ── CONNEXION ───────────────────────────────────────────
  var STYLE = ''
    + '.cx-ov{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;'
    + 'background:#1A2030;background-image:linear-gradient(160deg,#252B34 0%,#1A2030 60%,#162035 100%);font-family:Manrope,system-ui,sans-serif}'
    + '.cx-carte{width:100%;max-width:380px;background:#fff;color:#1A1F2B;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.35);padding:28px 24px}'
    + '.cx-logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--vert,#1B6B45),var(--vert-vif,#2ECC7A));display:flex;align-items:center;justify-content:center;margin-bottom:14px}'
    + '.cx-nom{font-size:1.05rem;font-weight:800;line-height:1.3}'
    + '.cx-sous{font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9AA3B2;margin-top:2px;margin-bottom:20px}'
    + '.cx-champ{margin-bottom:14px}.cx-champ label{display:block;font-size:0.74rem;font-weight:700;color:#5A6478;margin-bottom:5px}'
    + '.cx-champ input{width:100%;height:42px;border:1px solid #E4E8EE;border-radius:10px;padding:0 12px;font:500 0.9rem Manrope,system-ui,sans-serif;color:#1A1F2B;background:#F7F8FA;outline:none}'
    + '.cx-champ input:focus{border-color:var(--vert,#1B6B45);background:#fff;box-shadow:0 0 0 3px rgba(27,107,69,0.12)}'
    + '.cx-btn{width:100%;height:44px;border:0;border-radius:10px;background:var(--vert,#1B6B45);color:#fff;font:700 0.9rem Manrope,system-ui,sans-serif;cursor:pointer;margin-top:4px}'
    + '.cx-btn:disabled{opacity:0.6;cursor:wait}.cx-btn-sec{background:#F2F4F7;color:#1A1F2B;margin-top:10px}'
    + '.cx-err{display:none;background:rgba(229,83,83,0.1);color:#B4402F;border-radius:9px;padding:10px 12px;font-size:0.8rem;line-height:1.45;margin-bottom:14px}'
    + '.cx-info{font-size:0.78rem;color:#5A6478;line-height:1.55;margin-bottom:16px}'
    + '.cx-pied{margin-top:18px;font-size:0.72rem;color:#9AA3B2;line-height:1.5;text-align:center}'
    + '.cx-pied a,.cx-lien{color:var(--vert,#1B6B45);font-weight:700;text-decoration:none;background:none;border:0;cursor:pointer;font:inherit;padding:0}'
    + '.cx-aide{display:none;margin-top:12px;font-size:0.76rem;color:#5A6478;line-height:1.55;background:#F7F8FA;border-radius:9px;padding:10px 12px}'
    + '#etat-base{font-size:0.7rem;font-weight:700;color:#9AA3B2;white-space:nowrap}#etat-base[data-etat="erreur"]{color:#E55353}#etat-base[data-etat="enCours"]{color:#F0B429}'
    + '.cx-deco{margin-left:auto;width:28px;height:28px;border-radius:7px;border:0;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.cx-deco:hover{background:rgba(229,83,83,0.25);color:#fff}'
    // Barre latérale réduite (tablette) : avatar et bouton de déconnexion l'un sous l'autre
    + '@media(max-width:1024px) and (min-width:769px){.sidebar-footer .user-pill{flex-direction:column;gap:6px;padding:7px 4px}.cx-deco{margin-left:0}}';
  var SVG_LOGO = '<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
  var SVG_SORTIE = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

  var ov = null;
  function esc(s) { return texte(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function nomPharmacie() { return (typeof DATA !== 'undefined' && DATA && DATA.parametres && DATA.parametres.nom) || 'Pharmacie'; }
  function ouvrirVerrou() {
    document.body.classList.add('pharma-verrou');
    if (ov) return ov;
    if (!document.getElementById('cx-style')) {
      var st = document.createElement('style');
      st.id = 'cx-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    ov = document.createElement('div');
    ov.className = 'cx-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'cx-titre');
    document.body.appendChild(ov);
    return ov;
  }
  function fermerVerrou() {
    document.body.classList.remove('pharma-verrou');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }
  function entete() {
    return '<div class="cx-logo">' + SVG_LOGO + '</div><div class="cx-nom" id="cx-titre">' + esc(nomPharmacie()) + '</div><div class="cx-sous">Administration</div>';
  }
  function afficherConnexion(message) {
    ouvrirVerrou();
    ov.innerHTML = '<form class="cx-carte" id="cx-form" novalidate>' + entete()
      + '<div class="cx-err" id="cx-err" role="alert"></div>'
      + '<div class="cx-champ"><label for="cx-email">Adresse email</label><input type="email" id="cx-email" autocomplete="username" maxlength="200" required></div>'
      + '<div class="cx-champ"><label for="cx-mdp">Mot de passe</label><input type="password" id="cx-mdp" autocomplete="current-password" maxlength="200" required></div>'
      + '<button class="cx-btn" type="submit" id="cx-ok">Se connecter</button>'
      + '<div style="text-align:center;margin-top:12px"><button type="button" class="cx-lien" id="cx-oubli">Mot de passe oublié ?</button></div>'
      + '<div class="cx-aide" id="cx-aide">Demandez à l\'administrateur de la pharmacie de vous envoyer un lien de réinitialisation : dans Supabase, menu Authentication, Users, puis les trois points à droite de votre compte, « Send password recovery ».</div>'
      + '<div class="cx-pied">Accès réservé à l\'équipe de la pharmacie : chaque membre a son propre compte.<br><a href="site.html">Retour au site</a></div>'
      + '</form>';
    var err = document.getElementById('cx-err');
    if (message) { err.textContent = message; err.style.display = 'block'; }
    document.getElementById('cx-oubli').addEventListener('click', function () {
      var a = document.getElementById('cx-aide'); a.style.display = a.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('cx-form').addEventListener('submit', function (e) {
      e.preventDefault();
      seConnecter();
    });
    setTimeout(function () { var f = document.getElementById('cx-email'); if (f) f.focus(); }, 50);
  }
  function afficherMessage(titre, texteMsg, avecDeconnexion) {
    ouvrirVerrou();
    ov.innerHTML = '<div class="cx-carte">' + entete() + '<div class="cx-info"><strong>' + esc(titre) + '</strong><br>' + esc(texteMsg) + '</div>'
      + (avecDeconnexion ? '<button class="cx-btn" type="button" id="cx-reessayer">Réessayer</button><button class="cx-btn cx-btn-sec" type="button" id="cx-sortir">Se déconnecter</button>' : '')
      + '<div class="cx-pied"><a href="site.html">Retour au site</a></div></div>';
    if (avecDeconnexion) {
      document.getElementById('cx-reessayer').addEventListener('click', function () { entrer(); });
      document.getElementById('cx-sortir').addEventListener('click', function () { deconnecter(); });
    }
  }
  function afficherChargement() {
    ouvrirVerrou();
    ov.innerHTML = '<div class="cx-carte" role="status">' + entete() + '<div class="cx-info">Chargement des données…</div></div>';
  }
  function erreurConnexion(e) {
    var m = texte(e && e.message);
    if (/invalid login credentials/i.test(m)) return 'Adresse email ou mot de passe incorrect.';
    if (/email not confirmed/i.test(m)) return 'Cette adresse email n\'a pas encore été confirmée.';
    if (/rate limit|too many/i.test(m) || (e && e.status === 429)) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
    if (/fetch|network|load failed/i.test(m)) return 'Connexion au serveur impossible. Vérifiez la connexion internet.';
    return 'Connexion impossible : ' + (m || 'erreur inconnue') + '.';
  }
  function seConnecter() {
    var email = texte(document.getElementById('cx-email').value).trim();
    var mdp = texte(document.getElementById('cx-mdp').value);
    var err = document.getElementById('cx-err');
    var bouton = document.getElementById('cx-ok');
    err.style.display = 'none';
    if (!pharmaEmailValide(email) || !mdp) { err.textContent = 'Saisissez votre adresse email et votre mot de passe.'; err.style.display = 'block'; return; }
    bouton.disabled = true; bouton.textContent = 'Connexion…';
    sb.auth.signInWithPassword({ email: email, password: mdp }).then(function (r) {
      if (r.error) throw r.error;
      entrer();
    }).then(null, function (e) {
      bouton.disabled = false; bouton.textContent = 'Se connecter';
      err.textContent = erreurConnexion(e); err.style.display = 'block';
    });
  }

  // Après la connexion : contrôle du rôle, lecture des données, ouverture de l'administration
  function entrer() {
    afficherChargement();
    return sb.auth.getUser().then(function (r) {
      var user = r && r.data && r.data.user;
      if (!user) { afficherConnexion(); return; }
      return executer(sb.from('profiles').select('*').eq('id', user.id).maybeSingle()).then(function (p) {
        if (!p || (p.role !== 'admin' && p.role !== 'employe')) {
          return sb.auth.signOut().then(function () {
            afficherConnexion('Ce compte n\'a pas accès à l\'administration. Il est réservé à l\'équipe de la pharmacie.');
          });
        }
        if (p.actif === false) {
          return sb.auth.signOut().then(function () { afficherConnexion('Ce compte est désactivé. Contactez l\'administrateur de la pharmacie.'); });
        }
        profil = p;
        connecte = true;
        return recharger({ force: true, premiere: true }).then(function () {
          // Un compte « employé » en dehors des heures d'ouverture ne reçoit aucune donnée interne
          if (p.role === 'employe' && !reglagesInternesLus) {
            connecte = false;
            afficherMessage('Accès en dehors des heures d\'ouverture',
              'L\'administration est réservée aux heures d\'ouverture de la pharmacie pour les comptes « employé ». Contactez l\'administrateur si vous avez besoin d\'un accès exceptionnel.', true);
            return;
          }
          ouvrirAdministration();
        });
      });
    }).then(null, function (e) {
      connecte = false;
      afficherMessage('Chargement impossible', (e && e.message) || 'Erreur inconnue.', true);
    });
  }

  function ouvrirAdministration() {
    // Utilisateur affiché et utilisé pour signer les validations (« validé par … »)
    currentUser = { nom: nomProfil(profil), role: profil.role === 'admin' ? 'Admin' : 'Employé', uid: profil.id };
    var nom = document.querySelector('.sidebar-footer .user-name');
    var role = document.querySelector('.sidebar-footer .user-role');
    var av = document.querySelector('.sidebar-footer .avatar');
    if (nom) nom.textContent = currentUser.nom;
    if (role) role.textContent = currentUser.role === 'Admin' ? 'Administrateur' : 'Employé';
    if (av) av.textContent = currentUser.nom.split(/\s+/).map(function (m) { return m.charAt(0); }).join('').slice(0, 2).toUpperCase() || 'PH';
    var pill = document.querySelector('.sidebar-footer .user-pill');
    if (pill && !document.getElementById('cx-deco')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'cx-deco'; b.className = 'cx-deco';
      b.title = 'Se déconnecter'; b.setAttribute('aria-label', 'Se déconnecter');
      b.innerHTML = SVG_SORTIE;
      b.addEventListener('click', function () { deconnecter(); });
      pill.appendChild(b);
    }
    var badgeScan = document.getElementById('scan-connecte');
    if (badgeScan) badgeScan.textContent = 'Connecté : ' + currentUser.nom;
    var barre = document.querySelector('.topbar');
    if (barre && !document.getElementById('etat-base')) {
      var etat = document.createElement('span');
      etat.id = 'etat-base'; etat.setAttribute('role', 'status'); etat.setAttribute('aria-live', 'polite');
      var titre = document.getElementById('page-title');
      if (titre && titre.nextSibling) barre.insertBefore(etat, titre.nextSibling); else barre.appendChild(etat);
    }
    PharmaCloud.journaliserEmail = journaliserEmailPersonnel;
    fermerVerrou();
    rafraichirEcran(false);
    // Base installée avant la mise à jour du 14 octobre : le signaler à l'administrateur
    if (profil.role === 'admin' && !colonnesPrivees.email_quota) {
      setTimeout(function () {
        notifier('Mise à jour de la base à faire : exécutez le fichier 03-mise-a-jour-admin.sql dans Supabase (SQL Editor). En attendant, le décompte des emails ne sera pas gardé.', 'error');
      }, 1500);
    }
    demarrerSurveillance();
    if (window.PharmaGuide && typeof window.PharmaGuide.proposer === 'function') window.PharmaGuide.proposer();
  }

  function deconnecter(message) {
    connecte = false;
    profil = null;
    instantane = null;
    derniereSignature = '';
    arreterSurveillance();
    oublierActivite();
    return sb.auth.signOut().then(null, function () {}).then(function () {
      // Plus aucune donnée de la pharmacie ne reste affichée derrière l'écran de connexion
      var nom = DATA && DATA.parametres ? DATA.parametres.nom : '';
      var couleur = DATA && DATA.parametres ? DATA.parametres.couleurPrimaire : '';
      DATA = PharmaCloud.squelette();
      if (nom) DATA.parametres.nom = nom;
      if (couleur) DATA.parametres.couleurPrimaire = couleur;
      document.querySelectorAll('[id^="m-"].open').forEach(function (m) { m.classList.remove('open'); });
      if (typeof renderPage === 'function' && typeof currentPage === 'string') { try { renderPage(currentPage); } catch (e) {} }
      if (typeof renderNotifCloche === 'function') renderNotifCloche(false);
      if (typeof updateNavBadges === 'function') updateNavBadges();
      afficherConnexion(message);
    });
  }

  // ── SURVEILLANCE : relecture régulière et inactivité ────
  // L'heure de la dernière activité est gardée dans le navigateur (un simple nombre) :
  // une session restée ouverte la veille sur le poste du comptoir n'est pas reprise le
  // lendemain sans mot de passe, et une activité dans un autre onglet compte aussi.
  var CLE_ACTIVITE = 'pharma-admin-activite';
  var derniereNote = 0;
  function noterActivite() {
    derniereNote = Date.now();
    try { localStorage.setItem(CLE_ACTIVITE, String(derniereNote)); } catch (e) {}
  }
  function derniereActivite() {
    var t = 0;
    try { t = parseInt(localStorage.getItem(CLE_ACTIVITE), 10) || 0; } catch (e) {}
    return Math.max(t, derniereNote);
  }
  function oublierActivite() {
    derniereNote = 0;
    try { localStorage.removeItem(CLE_ACTIVITE); } catch (e) {}
  }
  var minuteurRelecture = null, minuteurInactivite = null;
  function armerInactivite(delai) {
    clearTimeout(minuteurInactivite);
    minuteurInactivite = setTimeout(function () {
      if (!connecte) return;
      if (sync.enCours) { armerInactivite(5000); return; }
      // Activité récente dans un autre onglet : on attend la fin de son propre délai
      var reste = derniereActivite() + INACTIVITE_MAX - Date.now();
      if (reste > 1000) { armerInactivite(reste); return; }
      deconnecter('Vous avez été déconnecté après 60 minutes sans activité.');
    }, Math.max(1000, delai));
  }
  function activite() {
    if (!connecte) return;
    if (Date.now() - derniereNote > 15000) noterActivite();
    armerInactivite(INACTIVITE_MAX);
  }
  var EVENEMENTS = ['mousedown', 'keydown', 'touchstart', 'wheel'];
  function demarrerSurveillance() {
    arreterSurveillance();
    minuteurRelecture = setInterval(function () {
      if (connecte && document.visibilityState === 'visible') recharger();
    }, INTERVALLE_RELECTURE);
    EVENEMENTS.forEach(function (ev) { document.addEventListener(ev, activite, true); });
    activite();
  }
  function arreterSurveillance() {
    clearInterval(minuteurRelecture); minuteurRelecture = null;
    clearTimeout(minuteurInactivite); minuteurInactivite = null;
    EVENEMENTS.forEach(function (ev) { document.removeEventListener(ev, activite, true); });
  }
  document.addEventListener('visibilitychange', function () {
    if (connecte && document.visibilityState === 'visible' && Date.now() - derniereLecture > 10000) recharger();
  });

  // ── DÉMARRAGE (appelé par admin.js au chargement de la page) ──
  function demarrer() {
    // Garde-fou : la page ne doit jamais fonctionner sur des données locales en mode base de données
    if (!PharmaCloud.actif || !sb) {
      afficherMessage('Configuration de la base incorrecte',
        'Le fichier supabase-config.js est invalide (adresse du projet, clé ou bibliothèque supabase.js manquante). Le détail est affiché dans la console (F12).', false);
      return;
    }
    // Nom et couleur de la pharmacie affichés dès l'écran de connexion (informations publiques)
    PharmaCloud.chargerPublic().then(function (d) {
      DATA.parametres.nom = d.parametres.nom;
      DATA.parametres.couleurPrimaire = d.parametres.couleurPrimaire;
      if (typeof appliquerCouleur === 'function') appliquerCouleur();
      var n = document.getElementById('cx-titre');
      if (n) n.textContent = nomPharmacie();
    }, function () {});
    sb.auth.onAuthStateChange(function (evenement) {
      if (evenement === 'SIGNED_OUT' && connecte) { connecte = false; arreterSurveillance(); afficherConnexion('Votre session a expiré. Reconnectez-vous.'); }
    });
    afficherChargement();
    sb.auth.getSession().then(function (r) {
      var session = r && r.data && r.data.session;
      if (!session) { afficherConnexion(); return; }
      // Session d'une visite précédente : reprise seulement si la dernière activité date de moins de 60 minutes
      if (Date.now() - derniereActivite() > INACTIVITE_MAX) {
        oublierActivite();
        sb.auth.signOut().then(null, function () {}).then(function () {
          afficherConnexion('Vous avez été déconnecté après 60 minutes sans activité.');
        });
        return;
      }
      entrer();
    }, function () { afficherConnexion(); });
  }

  return {
    actif: true,
    demarrer: demarrer,
    planifierSync: planifierSync,
    recharger: recharger,
    marquerPrete: marquerPrete,
    annuler: annuler,
    supprimer: supprimer,
    validerRetrait: validerRetrait,
    deconnecter: deconnecter,
    estConnecte: function () { return connecte; },
    // pour les tests
    _synchroniser: synchroniser
  };
})();

// En mode base de données, le stockage du navigateur n'est plus la source des données :
// PharmaStore renvoie les données en mémoire et chaque enregistrement part vers la base.
if (PharmaAdminCloud.actif) {
  PharmaStore.load = function () { return (typeof DATA !== 'undefined' && DATA) ? DATA : PharmaCloud.squelette(); };
  PharmaStore.save = function () { PharmaAdminCloud.planifierSync(); return true; };
  PharmaStore.mettreAJour = function (fn) { var d = PharmaStore.load(); fn(d); PharmaAdminCloud.planifierSync(); return d; };
  PharmaStore.reset = function () { return PharmaStore.load(); };
}
