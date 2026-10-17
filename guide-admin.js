// ============================================================
// GUIDE DE L'ADMINISTRATION
// Centre d'aide complet + visite guidée pas à pas, disponibles à tout
// moment (bouton « Guide » en haut de l'écran, touche ?, ou Paramètres).
// Proposé automatiquement à la première ouverture de l'administration.
// Aucun emoji : uniquement des icônes SVG (charte du site).
// ============================================================
(function () {
  'use strict';

  var CLE_PREF = 'pharma-guide';
  // Administration reliée à la base de données (connexion, enregistrement sur le serveur)
  var MODE_BASE = (typeof PharmaAdminCloud !== 'undefined') && PharmaAdminCloud.actif;

  // ── Préférences (propres à ce navigateur) ──
  function lirePref() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(CLE_PREF) || 'null'); } catch (e) {}
    return p && typeof p === 'object' ? p : { proposer: true, visiteTerminee: false };
  }
  function ecrirePref(p) { try { localStorage.setItem(CLE_PREF, JSON.stringify(p)); } catch (e) {} }

  // ── Icônes ──
  var I = {
    livre: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    boussole: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    fermer: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    loupe: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    fleche: '<polyline points="9 18 15 12 9 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    alerte: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };
  function svg(nom, t) {
    t = t || 16;
    return '<svg width="' + t + '" height="' + t + '" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[nom] + '</svg>';
  }

  // ── Contenu du guide ──
  // Chaque chapitre : page de l'admin concernée, résumé, sections (HTML écrit ici, jamais saisi
  // par un utilisateur), et une courte visite guidée de la page.
  function liste(items) { return '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
  function etapes(items) { return '<ol>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
  function note(txt, type) { return '<div class="gd-note' + (type ? ' gd-note-' + type : '') + '">' + svg(type === 'alerte' ? 'alerte' : 'info', 15) + '<div>' + txt + '</div></div>'; }

  var CHAPITRES = [
    {
      id: 'demarrer', titre: 'Bien démarrer', page: 'dashboard',
      resume: 'Le rôle de l\'administration et le circuit d\'une commande, du site jusqu\'au comptoir.',
      corps:
        '<p>L\'administration est l\'outil de l\'équipe : on y suit les commandes passées sur le site, on gère le catalogue, les promotions, la fidélité, les horaires et les réglages de la pharmacie. Tout ce qui est modifié ici se répercute sur le site des clients.</p>'
        + '<h4>Le circuit d\'une commande</h4>'
        + etapes([
          'Le client commande sur le site, sans paiement en ligne. Il reçoit un <strong>numéro de commande</strong> et un <strong>code de retrait</strong> à 6 caractères, à l\'écran et par email.',
          'La commande arrive dans <strong>Commandes</strong> avec le statut <em>En préparation</em>. La cloche en haut de l\'écran le signale.',
          'Vous préparez les produits puis cliquez sur <strong>Prête</strong> : le client reçoit l\'email « commande prête ».',
          'Au comptoir, le client donne son numéro ou son code : vous le saisissez dans <strong>Validation Scan</strong>. La commande passe à <em>Retirée</em> et le client règle sur place.'
        ])
        + '<h4>Se repérer</h4>'
        + liste([
          '<strong>Menu de gauche</strong> : toutes les pages. Sur téléphone, il s\'ouvre avec le bouton à trois traits.',
          '<strong>Bouton vert en haut à droite</strong> : l\'action principale de la page affichée (nouveau produit, nouvelle promo, etc.).',
          '<strong>Cloche</strong> : alertes (nouvelle commande, stock faible, palier fidélité).',
          '<strong>Recherche</strong> : tapez le nom d\'une page (« commandes », « clients »…) ou d\'un produit ou d\'un client.',
          '<strong>Guide</strong> : ce guide, à tout moment. Raccourci clavier : touche <kbd>?</kbd>.'
        ])
        + note('Pour les fenêtres : la touche <kbd>Échap</kbd> les ferme. Les suppressions demandent toujours une confirmation.'),
      visite: 'complete'
    },
    {
      id: 'dashboard', titre: 'Tableau de bord', page: 'dashboard',
      resume: 'Les chiffres du moment et ce qui demande une action.',
      corps:
        '<p>Le tableau de bord résume la situation en un coup d\'œil.</p>'
        + liste([
          '<strong>Commandes</strong> : commandes au statut <em>En préparation</em>, à préparer.',
          '<strong>Stock faible</strong> : produits dont le stock est inférieur ou égal à leur seuil d\'alerte.',
          '<strong>Promos actives</strong> et <strong>tickets ouverts</strong>.',
          '<strong>Encadré jaune</strong> : le prochain jour spécial (garde ou fermeture) et l\'état du bandeau d\'annonce du site.',
          '<strong>Dernières commandes</strong> et <strong>tickets récents</strong> : l\'œil ouvre le détail.'
        ])
        + note('Les chiffres se mettent à jour tout seuls quand une commande arrive pendant que l\'administration est ouverte.'),
      visite: [
        { page: 'dashboard', cible: '#page-dashboard .stats-grid', titre: 'Les indicateurs', texte: 'Commandes à préparer, stocks faibles, promotions actives et tickets ouverts.' },
        { page: 'dashboard', cible: '#page-dashboard .garde-banner', titre: 'Jours spéciaux', texte: 'Le prochain jour de garde ou de fermeture, et l\'état du bandeau affiché sur le site.' },
        { page: 'dashboard', cible: '#page-dashboard .g2', titre: 'Les dernières activités', texte: 'Les commandes et tickets les plus récents, avec un accès direct au détail.' }
      ]
    },
    {
      id: 'commandes', titre: 'Commandes', page: 'commandes',
      resume: 'Préparer, signaler « prête », annuler ou retrouver une commande.',
      corps:
        '<p>Chaque commande du site apparaît ici avec le client, les produits, le total, la personne qui l\'a traitée et son statut.</p>'
        + '<h4>Les statuts</h4>'
        + liste([
          '<em>En préparation</em> : la commande vient d\'arriver.',
          '<em>Prête</em> : les produits sont prêts, le client a été prévenu par email.',
          '<em>Retirée</em> : le client est passé, la vente est conclue au comptoir.',
          '<em>Annulée</em> : la commande ne sera pas retirée ; le stock a été remis en rayon.'
        ])
        + '<h4>Préparer une commande</h4>'
        + etapes([
          'Cliquez sur l\'œil pour voir le détail : produits, téléphone, email et code de retrait.',
          'Préparez les produits, puis cliquez sur <strong>Prête</strong> (dans la liste ou dans le détail).',
          'Le client reçoit automatiquement l\'email « commande prête » si cet envoi est activé dans Notifications.'
        ])
        + '<h4>Prévenir le client vous-même (email prérempli)</h4>'
        + '<p>Le détail de chaque commande propose, pour chaque email (confirmation, commande prête, code fidélité), un bouton <strong>Ouvrir l\'email</strong> : votre messagerie s\'ouvre avec l\'adresse du client, l\'objet et le texte déjà rédigés, dans la langue du client. <strong>Copier le texte</strong> sert si votre messagerie ne s\'ouvre pas. Ces emails ne consomment pas le quota EmailJS.</p>'
        + '<p>Si l\'email automatique « commande prête » ne part pas (échec, quota épuisé, emails coupés), la fenêtre « Prévenir le client » s\'ouvre d\'elle-même après le clic sur Prête.</p>'
        + '<h4>Annuler ou supprimer</h4>'
        + liste([
          '<strong>Annuler</strong> (icône orange) : à utiliser quand le client ne viendra pas. Le stock est remis, le compteur de fidélité du client est corrigé, le code promo utilisé est rendu et un code fidélité non utilisé déclenché par cette commande est retiré.',
          '<strong>Supprimer définitivement</strong> (icône rouge) : efface la commande. Préférez l\'annulation, qui garde une trace.'
        ])
        + '<h4>Retrouver une commande</h4>'
        + '<p>La zone de recherche accepte le numéro, le nom du client ou un produit ; la liste déroulante filtre par statut.</p>'
        + note('Un client a perdu son code de retrait ? Cherchez sa commande par son nom ici, vérifiez son identité au comptoir, puis validez le retrait avec le numéro de commande dans Validation Scan.')
        + (MODE_BASE
          ? note('Le bouton « Tout vider » est désactivé avec la base de données : les commandes s\'annulent ou se suppriment une par une, pour ne jamais effacer de vraies commandes par erreur.')
          : note('Le bouton « Tout vider » efface toutes les commandes : il sert uniquement aux essais. Ne l\'utilisez pas une fois le site ouvert aux clients.', 'alerte')),
      visite: [
        { page: 'commandes', cible: '#page-commandes .toolbar', titre: 'Rechercher et filtrer', texte: 'Par numéro, client ou produit, et par statut.' },
        { page: 'commandes', cible: '#page-commandes .card', titre: 'La liste des commandes', texte: 'L\'œil ouvre le détail. « Prête » prévient le client. L\'icône orange annule (stock et fidélité corrigés), l\'icône rouge supprime.' }
      ]
    },
    {
      id: 'scan', titre: 'Validation Scan (retrait au comptoir)', page: 'scan',
      resume: 'Valider le retrait d\'une commande avec son numéro ou son code.',
      corps:
        etapes([
          'Demandez au client son <strong>numéro de commande</strong> (par exemple #1042) ou son <strong>code de retrait</strong> à 6 caractères, présent dans ses emails et affiché à la fin de sa commande.',
          'Saisissez-le dans le champ (majuscules ou minuscules, avec ou sans #) puis appuyez sur <kbd>Entrée</kbd> ou sur <strong>Valider</strong>.',
          'La commande passe à <em>Retirée</em>, avec votre nom et l\'heure, dans l\'historique du jour. Encaissez le client.'
        ])
        + '<h4>Messages possibles</h4>'
        + liste([
          '<em>Commande introuvable</em> : vérifiez la saisie (le code ne contient ni O, ni 0, ni I, ni 1, ni L).',
          '<em>Déjà été retirée</em> : la commande a déjà été remise.',
          '<em>A été annulée</em> : la commande ne peut plus être retirée.'
        ])
        + note('La lecture d\'un QR code personnel avec une douchette ou la caméra arrivera avec les comptes clients.'),
      visite: [
        { page: 'scan', cible: '#scan-input', parent: '.card', titre: 'Valider un retrait', texte: 'Saisissez le numéro de commande ou le code de retrait du client, puis Entrée.' },
        { page: 'scan', cible: '#tbody-scan-histo', parent: '.card', titre: 'Historique du jour', texte: 'Chaque retrait validé aujourd\'hui, avec la personne qui l\'a validé et l\'heure.' }
      ]
    },
    {
      id: 'produits', titre: 'Produits (catalogue)', page: 'produits',
      resume: 'Ajouter, modifier ou retirer un produit du site.',
      corps:
        '<h4>Ajouter un produit</h4>'
        + etapes([
          'Cliquez sur <strong>Nouveau produit</strong> (bouton vert en haut).',
          'Renseignez le nom (obligatoire et unique), la référence, la catégorie (ou tapez une nouvelle catégorie), le prix, le stock et le seuil d\'alerte.',
          'Enregistrez : le produit apparaît aussitôt dans le catalogue du site.'
        ])
        + '<h4>Les contrôles</h4>'
        + liste([
          'Le prix doit être supérieur à 0 ; le stock et le seuil sont des nombres entiers positifs.',
          'Deux produits ne peuvent pas porter le même nom.',
          'À stock 0, le site affiche « Rupture de stock » et le bouton d\'achat est désactivé.'
        ])
        + '<h4>Actions sur un produit</h4>'
        + liste([
          '<strong>Crayon</strong> : modifier.',
          '<strong>Étiquette</strong> : créer une promotion sur ce produit (le produit est présélectionné).',
          '<strong>Corbeille</strong> : supprimer le produit du catalogue (les commandes passées restent intactes).'
        ])
        + '<h4>Photos</h4>'
        + liste([
          '<strong>Photo d\'un produit</strong> : dans la fenêtre du produit, « Ajouter une photo », puis Sauvegarder. Sur téléphone, vous pouvez prendre la photo directement.',
          '<strong>Photo d\'un rayon</strong> : encadré « Photos des rayons » sous la liste des produits. Elle apparaît sur la page d\'accueil, au bout de la ligne du rayon.',
          'Les photos sont réduites automatiquement. Préférez un produit entier sur fond blanc, sans texte ajouté.',
          'Sans photo, le site affiche l\'icône du rayon.'
        ])
        + note('Utilisez vos propres photos ou celles fournies par la marque pour la vente en ligne : une image trouvée sur internet n\'est pas libre de droits.')
        + note('Le site ne vend que de la parapharmacie : n\'ajoutez aucun médicament au catalogue.', 'alerte'),
      visite: [
        { page: 'produits', cible: '#topbar-cta', titre: 'Nouveau produit', texte: 'Le bouton vert ouvre le formulaire de création.' },
        { page: 'produits', cible: '#page-produits .toolbar', titre: 'Rechercher', texte: 'Par nom, référence ou catégorie, avec filtre par catégorie.' },
        { page: 'produits', cible: '#page-produits .card', titre: 'Le catalogue', texte: 'Le stock et son état (disponible, faible, rupture). Crayon : modifier ; étiquette : créer une promo ; corbeille : supprimer.' },
        { page: 'produits', cible: '#photos-rayons', titre: 'Photos des rayons', texte: 'Une photo par rayon, affichée sur la page d\'accueil. Les photos des produits s\'ajoutent dans la fenêtre de chaque produit.' }
      ]
    },
    {
      id: 'stocks', titre: 'Stocks', page: 'stocks',
      resume: 'Mettre à jour rapidement les quantités disponibles.',
      corps:
        etapes([
          'Repérez le produit (la recherche aide pour un long catalogue).',
          'Saisissez la nouvelle quantité dans la case puis cliquez sur <strong>Màj</strong>.'
        ])
        + liste([
          'Chaque commande retire automatiquement les quantités commandées (un lot de 3 retire 3 unités).',
          'Une annulation remet les quantités en stock.',
          'Quand un produit passe sous son seuil d\'alerte, la cloche vous prévient.',
          'États : <em>OK</em>, <em>Faible</em> (au seuil ou en dessous), <em>Rupture</em> (0).'
        ])
        + note('Le stock du site est indépendant de votre logiciel d\'officine : pensez à le tenir à jour lors des réceptions et des ventes au comptoir.', 'alerte'),
      visite: [
        { page: 'stocks', cible: '#page-stocks .card', titre: 'Mise à jour rapide', texte: 'Saisissez la quantité réelle puis « Màj ». Un stock à 0 met le produit en rupture sur le site.' }
      ]
    },
    {
      id: 'promos', titre: 'Promotions', page: 'promos',
      resume: 'Mettre un produit ou un lot en avant, avec un prix barré et des dates.',
      corps:
        etapes([
          'Cliquez sur <strong>Nouvelle promo</strong>, ou sur l\'étiquette d\'un produit dans la page Produits.',
          'Choisissez le produit et le nombre d\'unités par lot (3 pour un lot de 3).',
          'Indiquez le prix normal et le prix promo : le pourcentage se calcule seul.',
          'Choisissez les dates de début et de fin, puis enregistrez.'
        ])
        + liste([
          'La promo s\'affiche sur l\'accueil du site du premier au dernier jour inclus, dès minuit.',
          'Le prix promo doit être inférieur au prix normal, la fin après le début.',
          'Le stock consommé est celui du produit relié (un lot de 3 retire 3 unités).',
          'Supprimez une promo pour la retirer immédiatement du site.'
        ])
        + note('Créer une promotion n\'envoie aucun message aux clients : pour les prévenir, utilisez Notifications.'),
      visite: [
        { page: 'promos', cible: '#topbar-cta', titre: 'Nouvelle promo', texte: 'Ouvre le formulaire : produit, unités par lot, prix et dates.' },
        { page: 'promos', cible: '#page-promos .card', titre: 'Promotions en cours', texte: 'Modifier ou supprimer une promotion. Elle est visible sur le site entre ses dates.' }
      ]
    },
    {
      id: 'codes', titre: 'Codes promo et fidélité', page: 'codes-promo',
      resume: 'Les codes automatiques de fidélité et les codes que vous créez vous-même.',
      corps:
        '<h4>La fidélité automatique</h4>'
        + liste([
          'Tous les <em>N</em> achats (réglable dans Paramètres), le client reçoit un code de réduction <strong>FID-…</strong> : nominatif, utilisable une seule fois, valable 30 jours, envoyé par email.',
          'Le client est reconnu par son <strong>adresse email</strong> : il doit utiliser la même à chaque commande.',
          'Après chaque code, son compteur repart de zéro (le 6e achat compte comme 1 sur 5).',
          'Si la commande qui a déclenché le code est annulée et que le code n\'a pas servi, il est retiré.'
        ])
        + '<h4>Créer un code vous-même</h4>'
        + etapes([
          'Choisissez le client : « Tous les clients » (code libre, utilisable sans limite) ou un client précis (code personnel, utilisable une fois).',
          'Indiquez la réduction (1 à 100 %) et la catégorie concernée (ou tous les produits).',
          'Cliquez sur <strong>Régénérer</strong> pour changer le code proposé, puis sur <strong>Créer le code</strong>.'
        ])
        + '<h4>Gérer les codes</h4>'
        + liste([
          'Copier le code pour le transmettre au client.',
          'Désactiver (et réactiver) un code sans le supprimer.',
          'États : <em>Actif</em>, <em>Épuisé</em> (nombre d\'utilisations atteint), <em>Désactivé</em>.'
        ])
        + note('Un code limité à une catégorie ne s\'applique qu\'aux produits de cette catégorie dans le panier.'),
      visite: [
        { page: 'codes-promo', cible: '#regle-fidelite', parent: '.card', titre: 'La règle de fidélité', texte: 'Elle reprend le palier et la réduction réglés dans Paramètres.' },
        { page: 'codes-promo', cible: '#cval', parent: '.card', titre: 'Créer un code', texte: 'Client, réduction, catégorie, puis « Créer le code ».' },
        { page: 'codes-promo', cible: '#tbody-codes', parent: '.card', titre: 'Tous les codes', texte: 'Copier, désactiver ou supprimer. Les codes FID-… sont ceux de la fidélité.' }
      ]
    },
    {
      id: 'clients', titre: 'Clients', page: 'clients',
      resume: 'Les fiches clients, leur fidélité et leurs achats.',
      corps:
        liste([
          'Une fiche est créée automatiquement à la première commande d\'un client.',
          'La colonne <strong>Fidélité</strong> montre où il en est dans le cycle en cours (par exemple 2/5).',
          'La colonne <strong>RGPD</strong> indique si le client a accepté le programme de fidélité et l\'historique.',
          'La recherche ignore les accents et les majuscules (« zoe » trouve « Zoé »).'
        ])
        + '<h4>Ajouter ou modifier un client</h4>'
        + etapes([
          'Cliquez sur <strong>Nouveau client</strong> ou sur le crayon.',
          'L\'adresse email doit être valide et ne pas être déjà utilisée par un autre client : c\'est elle qui relie les commandes et la fidélité.'
        ])
        + note('Ne notez jamais d\'information de santé (traitement, pathologie) dans les fiches ou les tickets : le site n\'est pas prévu pour ces données.', 'alerte')
        + note('Supprimer un client efface sa fiche ; ses commandes passées restent visibles dans Commandes.'),
      visite: [
        { page: 'clients', cible: '#page-clients .toolbar', titre: 'Rechercher un client', texte: 'Par nom, email ou téléphone, et filtre Compte / Invité.' },
        { page: 'clients', cible: '#page-clients .card', titre: 'Les fiches', texte: 'Achats, dépenses et progression de fidélité. Crayon : modifier ; corbeille : supprimer.' }
      ]
    },
    {
      id: 'tickets', titre: 'Tickets (demandes clients)', page: 'tickets',
      resume: 'Suivre les demandes : réponse, notes internes, résolution.',
      corps:
        etapes([
          'Cliquez sur <strong>Répondre</strong> (ou Voir) pour ouvrir le ticket.',
          'Écrivez votre réponse et, si besoin, une <strong>note interne</strong> (visible uniquement par l\'équipe).',
          '<strong>Envoyer réponse</strong> enregistre la réponse dans l\'historique du ticket et le passe à <em>En cours</em>.',
          'Quand la demande est traitée, cliquez sur <strong>Marquer résolu</strong>.'
        ])
        + note('La réponse est enregistrée mais pas encore envoyée automatiquement au client : transmettez-la par téléphone ou par email. Les demandes du site arriveront ici quand le formulaire de contact sera activé ; les tickets actuels sont des exemples.'),
      visite: [
        { page: 'tickets', cible: '#page-tickets .card', titre: 'Les tickets', texte: 'Priorité, statut, commande liée. Ouvrez un ticket pour répondre, noter ou le résoudre.' }
      ]
    },
    {
      id: 'messages', titre: 'Messages internes', page: 'messages',
      resume: 'Communiquer entre membres de l\'équipe.',
      corps:
        liste([
          'Écrivez votre message puis appuyez sur <kbd>Entrée</kbd> ou sur Envoyer.',
          'Le badge du menu indique les messages non lus ; ouvrir la page les marque comme lus.'
        ])
        + note('Ces messages sont internes : ils ne sont jamais visibles par les clients.'),
      visite: [
        { page: 'messages', cible: '#msg-input', parent: '.card', titre: 'Messagerie de l\'équipe', texte: 'Pour se passer les consignes : réassort, client à rappeler, etc.' }
      ]
    },
    {
      id: 'conseils', titre: 'Conseils de la pharmacie', page: 'conseils',
      resume: 'Les conseils santé affichés sur la page d\'accueil.',
      corps:
        etapes([
          'Cliquez sur <strong>Nouveau conseil</strong>.',
          'Choisissez une icône, une couleur de fond, un titre (obligatoire) et un texte court.',
          'Enregistrez : l\'aperçu montre le rendu.'
        ])
        + liste([
          'Les <strong>3 premiers conseils actifs</strong> de la liste s\'affichent au dos des cartes animées de l\'accueil du site.',
          'L\'interrupteur active ou masque un conseil sans le supprimer.'
        ])
        + note('Restez sur des conseils généraux (hydratation, soleil, saison) : pas de conseil de traitement ou de posologie.', 'alerte'),
      visite: [
        { page: 'conseils', cible: '#conseils-list', titre: 'Vos conseils', texte: 'Interrupteur pour activer ou masquer, crayon pour modifier. Les 3 premiers actifs sont affichés sur l\'accueil.' }
      ]
    },
    {
      id: 'horaires', titre: 'Horaires, gardes et bandeau', page: 'horaires',
      resume: 'Les horaires d\'ouverture, les jours spéciaux et le bandeau d\'annonce du site.',
      corps:
        '<h4>Horaires habituels</h4>'
        + etapes([
          'Pour chaque jour, l\'interrupteur indique si la pharmacie est ouverte ; saisissez l\'heure d\'ouverture et de fermeture.',
          'Cliquez sur <strong>Sauvegarder</strong> : les horaires du pied de page du site et des emails sont mis à jour.'
        ])
        + note('Un jour ouvert doit avoir ses deux heures, et la fermeture doit être après l\'ouverture.')
        + '<h4>Jours spéciaux et gardes</h4>'
        + etapes([
          'Cliquez sur <strong>Jour spécial</strong> (bouton vert).',
          'Choisissez le type (garde, fermeture, horaires modifiés), la date, les heures et un message.'
        ])
        + liste([
          'Les jours spéciaux des 14 prochains jours s\'affichent dans le pied de page du site.',
          'Le prochain jour spécial apparaît aussi sur le tableau de bord.'
        ])
        + '<h4>Bandeau d\'annonce</h4>'
        + '<p>Écrivez le message, activez « Afficher sur le site » puis <strong>Mettre à jour</strong> : il s\'affiche en haut de toutes les pages du site. Désactivez-le quand l\'information n\'est plus d\'actualité.</p>',
      visite: [
        { page: 'horaires', cible: '#h-lundi', parent: '.card', titre: 'Horaires habituels', texte: 'Ouvert ou fermé, heures d\'ouverture et de fermeture, puis Sauvegarder.' },
        { page: 'horaires', cible: '#jours-speciaux-list', parent: '.card', titre: 'Jours spéciaux', texte: 'Gardes et fermetures exceptionnelles, annoncées sur le site 14 jours avant.' },
        { page: 'horaires', cible: '#bandeau-msg', parent: '.card', titre: 'Bandeau du site', texte: 'Un message affiché en haut du site, à activer ou désactiver.' }
      ]
    },
    {
      id: 'notifications', titre: 'Notifications et emails', page: 'notifications',
      resume: 'Les emails automatiques aux clients et leur suivi.',
      corps:
        '<h4>Emails automatiques</h4>'
        + liste([
          '<strong>Commande reçue</strong> : confirmation avec le code de retrait et la progression de fidélité.',
          '<strong>Commande prête</strong> : envoyé quand vous cliquez sur « Prête ».',
          '<strong>Code fidélité débloqué</strong> : envoyé quand le client atteint le palier.',
          'Les envois grisés (relance, rappel d\'expiration, alerte de stock) nécessitent un serveur : ils arriveront plus tard.'
        ])
        + '<h4>Journal des envois</h4>'
        + '<p>Chaque email envoyé ou en échec y figure, avec le destinataire et la raison de l\'échec. C\'est le premier endroit à regarder quand un client dit ne rien avoir reçu.</p>'
        + '<h4>Envoyer une notification</h4>'
        + '<p>Vous pouvez préparer un message (promotion, garde…). Il est enregistré « En attente d\'envoi » : l\'envoi réel aux clients nécessitera le serveur.</p>'
        + '<h4>Emails restants</h4>'
        + '<p>Le décompte affiché en tête du journal part du nombre relevé dans votre tableau de bord EmailJS (à saisir dans Paramètres) et retire chaque email envoyé. Une alerte apparaît sur le tableau de bord quand il en reste 20 ou moins.</p>'
        + note('Les emails partent avec le compte EmailJS réglé dans Paramètres. L\'offre gratuite est limitée à 200 emails par mois. ' + (MODE_BASE ? 'Le décompte compte tous les emails envoyés, y compris les confirmations parties du téléphone des clients' : 'Tant que le site n\'est pas relié au serveur, le décompte ne voit que les emails partis de ce navigateur') + ' : recalez-le de temps en temps avec le chiffre d\'EmailJS.'),
      visite: [
        { page: 'notifications', cible: '#notif-auto-list', titre: 'Emails automatiques', texte: 'Activez ou coupez chaque envoi automatique.' },
        { page: 'notifications', cible: '#email-journal', parent: '.card', titre: 'Journal des envois', texte: 'Chaque email envoyé ou en échec, avec la raison.' }
      ]
    },
    {
      id: 'rapport', titre: 'Rapport hebdomadaire', page: 'rapport',
      resume: 'Les chiffres des 7 derniers jours, à imprimer ou enregistrer en PDF.',
      corps:
        liste([
          'Chiffre d\'affaires, nombre de commandes, panier moyen, produits les plus commandés, stocks faibles et codes promo, calculés sur les 7 derniers jours.',
          '<strong>PDF</strong> : ouvre l\'impression du rapport ; choisissez « Enregistrer en PDF » comme imprimante pour obtenir un fichier.',
          'La configuration (destinataire, jour, heure, contenu) est enregistrée pour l\'envoi automatique, qui arrivera avec le serveur.'
        ]),
      visite: [
        { page: 'rapport', cible: '#rapport-carte', titre: 'Le rapport', texte: 'Les chiffres de la semaine. Le bouton PDF imprime ou enregistre le rapport.' }
      ]
    },
    {
      id: 'employes', titre: 'Employés', page: 'employes',
      resume: 'La liste de l\'équipe et les rôles.',
      corps:
        liste([
          '<strong>Admin</strong> : accès complet, y compris les paramètres.',
          '<strong>Employé</strong> : commandes et tickets ; peut être limité aux heures d\'ouverture (Paramètres).',
          'Le compte administrateur principal ne peut pas être supprimé.'
        ])
        + (MODE_BASE
          ? '<h4>Ajouter un membre de l\'équipe</h4>' + liste([
              'Créez d\'abord son compte dans Supabase : menu Authentication, Users, Add user, Create new user (son adresse email et un mot de passe d\'au moins 10 caractères, case « Auto Confirm User » cochée).',
              'Revenez ici, « Nouvel employé », saisissez la <strong>même adresse email</strong> et choisissez le rôle.',
              'Retirer un membre lui ôte l\'accès à l\'administration ; son compte reste un simple compte client.'
            ]) + note('Chaque membre a son propre compte et son propre mot de passe : ne partagez jamais un compte. L\'administration se déconnecte toute seule après 60 minutes sans activité.', 'alerte')
          : note('Chaque membre de l\'équipe aura son propre identifiant et mot de passe avec la connexion sécurisée : en attendant, cette liste sert à organiser l\'équipe. Ne partagez pas l\'accès à l\'administration en dehors de l\'équipe.', 'alerte')),
      visite: [
        { page: 'employes', cible: '#page-employes .card', titre: 'L\'équipe', texte: 'Ajoutez, modifiez ou retirez un membre de l\'équipe.' }
      ]
    },
    {
      id: 'parametres', titre: 'Paramètres', page: 'parametres',
      resume: 'Identité de la pharmacie, mentions légales, fidélité, emails, apparence.',
      corps:
        liste([
          '<strong>Informations pharmacie</strong> : nom, adresse, téléphone, email. Elles apparaissent sur le site, dans les emails et les pages légales.',
          '<strong>Restriction accès employés</strong> : s\'enregistre dès que vous basculez l\'interrupteur ; l\'administrateur garde toujours l\'accès.',
          '<strong>Informations légales</strong> : obligatoires avant d\'ouvrir le site au public (SIRET, pharmacien titulaire, numéro d\'Ordre, licence d\'officine, hébergeur…). Le compteur indique ce qu\'il reste à compléter.',
          '<strong>Programme de fidélité</strong> : nombre d\'achats pour débloquer un code et pourcentage de réduction.',
          '<strong>Emails automatiques</strong> : réglages EmailJS, bouton d\'envoi de test et <strong>décompte des emails restants</strong> (saisissez le nombre relevé dans EmailJS, puis « Mettre à jour le décompte »).',
          '<strong>Apparence</strong> : couleur principale (site, administration et emails) et nom affiché.',
          '<strong>Guide de prise en main</strong> : relancer ce guide et choisir s\'il est proposé à l\'ouverture.'
        ])
        + note('Ne saisissez jamais la clé privée EmailJS : seule la clé publique est prévue pour une page web.', 'alerte'),
      visite: [
        { page: 'parametres', cible: '#par-nom', parent: '.card', titre: 'Informations de la pharmacie', texte: 'Utilisées sur le site, dans les emails et les pages légales.' },
        { page: 'parametres', cible: '#lg-siret', parent: '.card', titre: 'Mentions légales', texte: 'À compléter entièrement avant l\'ouverture au public.' },
        { page: 'parametres', cible: '#par-fid-seuil', parent: '.card', titre: 'Programme de fidélité', texte: 'Le palier et la réduction du code fidélité.' },
        { page: 'parametres', cible: '#em-service', parent: '.card', titre: 'Emails', texte: 'Réglages du service d\'envoi et email de test.' }
      ]
    },
    {
      id: 'securite', titre: 'Bonnes pratiques et sécurité', page: null,
      resume: 'Les réflexes à garder pour protéger les clients et la pharmacie.',
      corps:
        liste([
          'Ne communiquez jamais l\'adresse de l\'administration ni vos accès en dehors de l\'équipe.',
          'Sur un poste partagé, fermez l\'onglet de l\'administration quand vous vous absentez.',
          'Vérifiez l\'identité du client au comptoir avant de valider un retrait sans code.',
          'Ne saisissez aucune donnée de santé (pathologie, traitement, ordonnance) dans les fiches, tickets, notes ou messages.',
          'Ne collez jamais de code ou de texte venant d\'une source inconnue dans les champs de l\'administration.',
          'Avant l\'ouverture au public : compléter les mentions légales, remplacer l\'adresse d\'envoi de test par une adresse professionnelle et supprimer les données de démonstration.'
        ])
        + note('Un client demande l\'accès à ses données ou leur suppression (RGPD) ? Notez sa demande, vérifiez son identité et traitez-la dans un délai d\'un mois.'),
      visite: null
    },
    {
      id: 'faq', titre: 'Questions fréquentes', page: null,
      resume: 'Les situations courantes et comment les résoudre.',
      corps:
        '<h4>Un client dit ne pas avoir reçu son email</h4>'
        + '<p>Regardez le <strong>journal des envois</strong> (Notifications) : adresse erronée, échec d\'envoi ? Conseillez-lui de vérifier ses courriers indésirables. Son code de retrait figure aussi dans le détail de la commande.</p>'
        + '<h4>Un client a perdu son code de retrait</h4>'
        + '<p>Retrouvez la commande par son nom dans <strong>Commandes</strong>, vérifiez son identité, puis validez avec le numéro de commande dans <strong>Validation Scan</strong>.</p>'
        + '<h4>Un produit n\'apparaît pas sur le site</h4>'
        + '<p>Vérifiez qu\'il existe dans Produits et que son stock n\'est pas à 0 (il est alors affiché en rupture). Le client doit recharger la page pour voir les changements.</p>'
        + '<h4>Une promotion n\'apparaît pas</h4>'
        + '<p>Vérifiez ses dates : elle n\'est visible qu\'entre le premier et le dernier jour.</p>'
        + '<h4>Un code promo est refusé</h4>'
        + '<p>Dans Codes promo : est-il désactivé, épuisé ou expiré ? Est-il réservé à un client précis ou à une catégorie absente du panier ?</p>'
        + '<h4>Un client n\'a pas eu son code fidélité</h4>'
        + '<p>Vérifiez qu\'il a toujours utilisé la <strong>même adresse email</strong> : c\'est elle qui compte ses achats. Sa fiche Clients montre sa progression.</p>'
        + '<h4>Le client ne viendra pas chercher sa commande</h4>'
        + '<p>Annulez-la dans Commandes : le stock est remis en rayon et sa fidélité est corrigée.</p>',
      visite: null
    }
  ];

  // ── Visite complète : les étapes essentielles de toute l'administration ──
  var VISITE_COMPLETE = [
    { titre: 'Bienvenue dans votre administration', texte: 'En 2 minutes, voici les endroits essentiels. Utilisez les flèches du clavier ou les boutons pour avancer, Échap pour quitter.' },
    { page: 'dashboard', cible: '.sidebar .nav', mobileMenu: true, titre: 'Le menu', texte: 'Toutes les pages de l\'administration : commandes, catalogue, promotions, clients, horaires, paramètres…' },
    { page: 'dashboard', cible: '#page-dashboard .stats-grid', titre: 'Le tableau de bord', texte: 'Ce qui demande votre attention : commandes à préparer, stocks faibles, promotions, tickets.' },
    { page: 'dashboard', cible: '#notif-bell', titre: 'Les alertes', texte: 'La cloche signale chaque nouvelle commande, un stock faible ou un palier de fidélité atteint. Cliquez sur une alerte pour ouvrir la bonne page.' },
    { page: 'dashboard', cible: '.topbar-search', optionnel: true, titre: 'La recherche', texte: 'Tapez « commandes », « clients »… ou le nom d\'un produit ou d\'un client pour y aller directement.' },
    { page: 'commandes', cible: '#page-commandes .card', titre: 'Les commandes', texte: 'L\'œil ouvre le détail ; « Prête » prévient le client par email ; l\'icône orange annule la commande en remettant le stock.' },
    { page: 'scan', cible: '#scan-input', parent: '.card', titre: 'Le retrait au comptoir', texte: 'Saisissez le numéro de commande ou le code de retrait du client : la commande passe à « Retirée ».' },
    { page: 'produits', cible: '#topbar-cta', titre: 'Le bouton d\'action', texte: 'Il change selon la page : ici « Nouveau produit », ailleurs « Nouvelle promo », « Nouveau client »…' },
    { page: 'promos', cible: '#page-promos .card', titre: 'Les promotions', texte: 'Un prix barré entre deux dates, affiché sur l\'accueil du site.' },
    { page: 'codes-promo', cible: '#regle-fidelite', parent: '.card', titre: 'La fidélité', texte: 'Le code de réduction automatique, et les codes que vous créez pour vos clients.' },
    { page: 'horaires', cible: '#h-lundi', parent: '.card', titre: 'Horaires et gardes', texte: 'Horaires, jours de garde ou de fermeture et bandeau d\'annonce : tout est repris sur le site.' },
    { page: 'parametres', cible: '#par-nom', parent: '.card', titre: 'Les paramètres', texte: 'Identité de la pharmacie, mentions légales, fidélité, emails et apparence.' },
    { cible: '#btn-guide', titre: 'Le guide, à tout moment', texte: 'Ce bouton ouvre le guide complet, page par page, avec une visite de chaque écran. Raccourci : touche ?.' }
  ];

  // ════════════════════════════════════════════════════════
  // STYLES (préfixe gd- : aucun conflit avec l'administration)
  // ════════════════════════════════════════════════════════
  var CSS = ''
    + '.gd-btn-guide svg{flex-shrink:0}'
    + '@media(max-width:640px){.gd-btn-guide .gd-lib{display:none}}'
    + '.gd-ov{position:fixed;inset:0;background:rgba(15,20,28,0.55);backdrop-filter:blur(3px);z-index:2000;display:none;align-items:center;justify-content:center;padding:16px}'
    + '.gd-ov.open{display:flex}'
    + '.gd-boite{background:var(--blanc,#fff);color:var(--texte,#1A1F2B);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.25);width:min(980px,100%);height:min(680px,100%);display:flex;flex-direction:column;overflow:hidden;font-family:Manrope,sans-serif}'
    + '.gd-tete{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--bord,#E4E8EE)}'
    + '.gd-tete-ico{width:34px;height:34px;border-radius:9px;background:var(--vert-pale,#E6F4ED);color:var(--vert,#1B6B45);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.gd-tete h2{font-size:1rem;font-weight:800;margin:0;flex:1}'
    + '.gd-recherche{display:flex;align-items:center;gap:6px;border:1px solid var(--bord,#E4E8EE);border-radius:9px;padding:0 10px;height:34px;color:var(--texte-3,#9AA3B2);width:220px;max-width:40vw}'
    + '.gd-recherche input{border:none!important;outline:none;box-shadow:none!important;background:transparent!important;padding:0!important;height:auto!important;font:inherit;font-size:0.8rem;font-weight:500;color:var(--texte,#1A1F2B);width:100%}'
    + '.gd-pied input[type=checkbox]{accent-color:var(--vert,#1B6B45);width:15px;height:15px}'
    + '.gd-x{width:34px;height:34px;border-radius:9px;border:1px solid var(--bord,#E4E8EE);background:transparent;color:var(--texte-2,#5A6478);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.gd-x:hover{background:var(--fond,#F2F4F7)}'
    + '.gd-corps{flex:1;display:flex;min-height:0}'
    + '.gd-nav{width:250px;border-right:1px solid var(--bord,#E4E8EE);overflow-y:auto;padding:8px;flex-shrink:0;background:var(--fond,#F2F4F7)}'
    + '.gd-nav button{display:block;width:100%;text-align:left;border:none;background:transparent;font:inherit;font-size:0.8rem;font-weight:600;color:var(--texte-2,#5A6478);padding:9px 10px;border-radius:8px;cursor:pointer;line-height:1.3}'
    + '.gd-nav button small{display:block;font-weight:500;font-size:0.68rem;color:var(--texte-3,#9AA3B2);margin-top:2px}'
    + '.gd-nav button:hover{background:rgba(27,107,69,0.07);color:var(--texte,#1A1F2B)}'
    + '.gd-nav button.actif{background:var(--blanc,#fff);color:var(--vert,#1B6B45);box-shadow:0 1px 4px rgba(0,0,0,0.06)}'
    + '.gd-nav .gd-vide{font-size:0.78rem;color:var(--texte-3,#9AA3B2);padding:10px}'
    + '.gd-contenu{flex:1;overflow-y:auto;padding:20px 26px 26px;font-size:0.84rem;line-height:1.65;color:var(--texte-2,#5A6478)}'
    + '.gd-contenu h3{font-size:1.15rem;font-weight:800;color:var(--texte,#1A1F2B);margin:0 0 4px}'
    + '.gd-contenu .gd-resume{color:var(--texte-3,#9AA3B2);margin:0 0 14px;font-size:0.82rem}'
    + '.gd-contenu h4{font-size:0.86rem;font-weight:800;color:var(--texte,#1A1F2B);margin:18px 0 6px}'
    + '.gd-contenu p{margin:0 0 10px}'
    + '.gd-contenu ul,.gd-contenu ol{margin:0 0 10px;padding-left:20px}'
    + '.gd-contenu li{margin-bottom:5px}'
    + '.gd-contenu strong{color:var(--texte,#1A1F2B)}'
    + '.gd-contenu kbd{font-family:inherit;font-size:0.72rem;font-weight:700;border:1px solid var(--bord,#E4E8EE);border-bottom-width:2px;border-radius:5px;padding:1px 6px;background:var(--fond,#F2F4F7);color:var(--texte,#1A1F2B)}'
    + '.gd-note{display:flex;gap:10px;align-items:flex-start;background:var(--vert-pale,#E6F4ED);border:1px solid rgba(27,107,69,0.15);color:var(--texte,#1A1F2B);border-radius:10px;padding:10px 12px;margin:12px 0;font-size:0.8rem;line-height:1.55}'
    + '.gd-note svg{color:var(--vert,#1B6B45);flex-shrink:0;margin-top:2px}'
    + '.gd-note-alerte{background:rgba(240,180,41,0.12);border-color:rgba(240,180,41,0.35)}'
    + '.gd-note-alerte svg{color:#B07C00}'
    + '.gd-actions{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 14px}'
    + '.gd-b{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border-radius:8px;font:inherit;font-size:0.76rem;font-weight:700;cursor:pointer;border:1px solid var(--bord,#E4E8EE);background:var(--blanc,#fff);color:var(--texte,#1A1F2B)}'
    + '.gd-b:hover{border-color:var(--vert,#1B6B45);color:var(--vert,#1B6B45)}'
    + '.gd-b-p{background:var(--vert,#1B6B45);border-color:var(--vert,#1B6B45);color:#fff}'
    + '.gd-b-p:hover{color:#fff;filter:brightness(1.08)}'
    + '.gd-pied{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px;border-top:1px solid var(--bord,#E4E8EE);flex-wrap:wrap}'
    + '.gd-pied label{display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--texte-2,#5A6478);cursor:pointer}'
    + '@media(max-width:720px){.gd-ov{padding:0}.gd-boite{border-radius:0;height:100%}.gd-corps{flex-direction:column}.gd-nav{width:auto;border-right:none;border-bottom:1px solid var(--bord,#E4E8EE);display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:8px;flex-shrink:0}.gd-nav button{white-space:nowrap;width:auto}.gd-nav button small{display:none}.gd-contenu{padding:16px}.gd-recherche{width:auto;flex:1;max-width:none}.gd-tete h2{display:none}}'
    // visite guidée
    + '.gd-calque{position:fixed;inset:0;z-index:2100}'
    + '.gd-spot{position:fixed;border-radius:10px;box-shadow:0 0 0 9999px rgba(15,20,28,0.58);z-index:2101;pointer-events:none;transition:all 0.25s ease;outline:2px solid var(--vert-vif,#2ECC7A);outline-offset:2px}'
    + '.gd-spot.sans-cible{width:0!important;height:0!important;left:50%!important;top:40%!important;outline:none}'
    + '.gd-bulle{position:fixed;z-index:2102;width:min(340px,calc(100vw - 24px));background:var(--blanc,#fff);color:var(--texte,#1A1F2B);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.3);padding:16px 16px 12px;font-family:Manrope,sans-serif;transition:top 0.25s ease,left 0.25s ease}'
    + '.gd-bulle .gd-etape{font-size:0.68rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--vert,#1B6B45);margin-bottom:4px}'
    + '.gd-bulle h3{font-size:0.95rem;font-weight:800;margin:0 0 6px}'
    + '.gd-bulle p{font-size:0.8rem;line-height:1.55;color:var(--texte-2,#5A6478);margin:0 0 12px}'
    + '.gd-bulle .gd-nav-b{display:flex;align-items:center;justify-content:space-between;gap:8px}'
    + '.gd-bulle .gd-quitter{background:none;border:none;font:inherit;font-size:0.74rem;font-weight:600;color:var(--texte-3,#9AA3B2);cursor:pointer;padding:6px 2px}'
    + '.gd-bulle .gd-quitter:hover{color:var(--texte,#1A1F2B)}'
    + '.gd-points{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}'
    + '.gd-points span{width:6px;height:6px;border-radius:50%;background:var(--bord,#E4E8EE)}'
    + '.gd-points span.fait{background:var(--vert-vif,#2ECC7A)}'
    + '@media(max-width:640px){.gd-bulle{left:12px!important;right:12px;bottom:12px;top:auto!important;width:auto}}'
    // carte d'accueil
    + '.gd-accueil{position:fixed;right:18px;bottom:18px;z-index:1900;width:min(360px,calc(100vw - 24px));background:var(--blanc,#fff);color:var(--texte,#1A1F2B);border:1px solid var(--bord,#E4E8EE);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.2);padding:18px;font-family:Manrope,sans-serif;animation:gdMonte 0.35s ease}'
    + '@keyframes gdMonte{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'
    + '.gd-accueil h3{font-size:0.95rem;font-weight:800;margin:0 0 6px;display:flex;align-items:center;gap:8px}'
    + '.gd-accueil h3 svg{color:var(--vert,#1B6B45)}'
    + '.gd-accueil p{font-size:0.8rem;line-height:1.55;color:var(--texte-2,#5A6478);margin:0 0 12px}'
    + '.gd-accueil .gd-actions{margin:0}'
    + '.gd-accueil .gd-lien{background:none;border:none;font:inherit;font-size:0.72rem;color:var(--texte-3,#9AA3B2);cursor:pointer;text-decoration:underline;margin-top:10px;padding:0}'
    + '@media(max-width:640px){.gd-accueil{left:12px;right:12px;bottom:12px;width:auto}}';

  function injecterStyles() {
    if (document.getElementById('gd-styles')) return;
    var st = document.createElement('style');
    st.id = 'gd-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ════════════════════════════════════════════════════════
  // CENTRE D'AIDE
  // ════════════════════════════════════════════════════════
  var centre = null, chapitreCourant = null;

  function normaliser(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function texteBrut(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }

  function construireCentre() {
    centre = document.createElement('div');
    centre.className = 'gd-ov';
    centre.id = 'gd-centre';
    centre.setAttribute('role', 'dialog');
    centre.setAttribute('aria-modal', 'true');
    centre.setAttribute('aria-labelledby', 'gd-titre-centre');
    centre.innerHTML =
      '<div class="gd-boite">'
      + '<div class="gd-tete"><div class="gd-tete-ico">' + svg('livre', 18) + '</div><h2 id="gd-titre-centre">Guide de l\'administration</h2>'
      + '<label class="gd-recherche">' + svg('loupe', 13) + '<input id="gd-recherche" type="search" placeholder="Rechercher dans le guide" aria-label="Rechercher dans le guide"></label>'
      + '<button class="gd-x" id="gd-fermer" aria-label="Fermer le guide">' + svg('fermer', 16) + '</button></div>'
      + '<div class="gd-corps"><nav class="gd-nav" id="gd-nav" aria-label="Chapitres du guide"></nav><div class="gd-contenu" id="gd-contenu" tabindex="0"></div></div>'
      + '<div class="gd-pied"><label><input type="checkbox" id="gd-proposer"> Proposer le guide à l\'ouverture de l\'administration</label>'
      + '<button class="gd-b gd-b-p" id="gd-visite-complete">' + svg('boussole', 14) + 'Lancer la visite guidée</button></div>'
      + '</div>';
    document.body.appendChild(centre);
    centre.addEventListener('click', function (e) { if (e.target === centre) fermerCentre(); });
    centre.querySelector('#gd-fermer').addEventListener('click', fermerCentre);
    centre.querySelector('#gd-recherche').addEventListener('input', function () { remplirNav(this.value); });
    centre.querySelector('#gd-proposer').addEventListener('change', function () {
      var p = lirePref(); p.proposer = this.checked; ecrirePref(p); majCarteParametres();
    });
    centre.querySelector('#gd-visite-complete').addEventListener('click', function () { fermerCentre(); lancerVisite(VISITE_COMPLETE, 'complete'); });
  }

  function remplirNav(recherche) {
    var nav = centre.querySelector('#gd-nav');
    var q = normaliser(recherche).trim();
    var liste = CHAPITRES.filter(function (c) {
      if (!q) return true;
      var tout = normaliser(c.titre + ' ' + c.resume + ' ' + texteBrut(c.corps));
      return q.split(/\s+/).every(function (mot) { return tout.indexOf(mot) !== -1; });
    });
    nav.innerHTML = '';
    if (!liste.length) { nav.innerHTML = '<div class="gd-vide">Aucun résultat. Essayez un autre mot.</div>'; return; }
    liste.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-chapitre', c.id);
      b.innerHTML = c.titre + '<small>' + c.resume + '</small>';
      if (chapitreCourant === c.id) b.className = 'actif';
      b.addEventListener('click', function () { afficherChapitre(c.id); });
      nav.appendChild(b);
    });
    if (q && liste.length && liste.every(function (c) { return c.id !== chapitreCourant; })) afficherChapitre(liste[0].id);
  }

  function afficherChapitre(id) {
    var c = CHAPITRES.find(function (x) { return x.id === id; }) || CHAPITRES[0];
    chapitreCourant = c.id;
    centre.querySelectorAll('#gd-nav button').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-chapitre') === c.id); });
    var actions = '';
    if (c.page) actions += '<button class="gd-b" data-gd="aller">' + svg('fleche', 13) + 'Ouvrir cette page</button>';
    if (c.visite) actions += '<button class="gd-b gd-b-p" data-gd="visite">' + svg('boussole', 13) + (c.visite === 'complete' ? 'Visite complète' : 'Visite de cette page') + '</button>';
    var zone = centre.querySelector('#gd-contenu');
    zone.innerHTML = '<h3>' + c.titre + '</h3><p class="gd-resume">' + c.resume + '</p>'
      + (actions ? '<div class="gd-actions">' + actions + '</div>' : '') + c.corps;
    zone.scrollTop = 0;
    var bAller = zone.querySelector('[data-gd="aller"]');
    if (bAller) bAller.addEventListener('click', function () { fermerCentre(); allerPage(c.page); });
    var bVisite = zone.querySelector('[data-gd="visite"]');
    if (bVisite) bVisite.addEventListener('click', function () {
      fermerCentre();
      if (c.visite === 'complete') lancerVisite(VISITE_COMPLETE, 'complete'); else lancerVisite(c.visite, c.id);
    });
  }

  // Chapitre correspondant à la page affichée (aide contextuelle)
  function chapitreDeLaPage() {
    var page = (typeof currentPage === 'string') ? currentPage : 'dashboard';
    var c = CHAPITRES.find(function (x) { return x.page === page && x.id !== 'demarrer'; });
    return c ? c.id : 'demarrer';
  }

  function ouvrirCentre(idChapitre) {
    if (!centre) construireCentre();
    fermerAccueil();
    centre.querySelector('#gd-recherche').value = '';
    chapitreCourant = idChapitre || chapitreDeLaPage();
    remplirNav('');
    afficherChapitre(chapitreCourant);
    centre.querySelector('#gd-proposer').checked = lirePref().proposer !== false;
    centre.classList.add('open');
    setTimeout(function () { var f = centre.querySelector('#gd-recherche'); if (f) f.focus(); }, 50);
  }
  function fermerCentre() {
    if (centre) centre.classList.remove('open');
    var b = document.getElementById('btn-guide');
    if (b) b.focus();
  }
  function centreOuvert() { return !!(centre && centre.classList.contains('open')); }

  function allerPage(page) {
    if (typeof go !== 'function' || !page) return;
    if (typeof currentPage === 'string' && currentPage === page) return;
    go(page);
  }

  // ════════════════════════════════════════════════════════
  // VISITE GUIDÉE
  // ════════════════════════════════════════════════════════
  var visite = null; // { etapes, i, nom, calque, spot, bulle, menuOuvert }

  function lancerVisite(etapesVisite, nom) {
    if (!etapesVisite || !etapesVisite.length) return;
    arreterVisite(true);
    fermerAccueil();
    var calque = document.createElement('div'); calque.className = 'gd-calque';
    var spot = document.createElement('div'); spot.className = 'gd-spot';
    var bulle = document.createElement('div'); bulle.className = 'gd-bulle';
    bulle.setAttribute('role', 'dialog'); bulle.setAttribute('aria-live', 'polite'); bulle.setAttribute('aria-label', 'Visite guidée');
    document.body.appendChild(calque); document.body.appendChild(spot); document.body.appendChild(bulle);
    visite = { etapes: etapesVisite, i: 0, nom: nom, calque: calque, spot: spot, bulle: bulle, menuOuvert: false, jeton: 0 };
    calque.addEventListener('click', function (e) { e.preventDefault(); });
    afficherEtape(0);
  }

  function estMobile() { return window.innerWidth <= 1024; }

  function ouvrirMenuMobile(ouvrir) {
    var sb = document.querySelector('.sidebar');
    if (!sb || !estMobile()) return;
    var estOuvert = sb.classList.contains('open');
    if (ouvrir && !estOuvert && typeof toggleSidebar === 'function') { toggleSidebar(); visite.menuOuvert = true; }
    if (!ouvrir && estOuvert && visite && visite.menuOuvert && typeof closeSidebar === 'function') { closeSidebar(); visite.menuOuvert = false; }
  }

  function trouverCible(e) {
    if (!e.cible) return null;
    var el = document.querySelector(e.cible);
    if (el && e.parent && el.closest(e.parent)) el = el.closest(e.parent);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return el;
  }

  function afficherEtape(i, sens) {
    if (!visite) return;
    if (i < 0) i = 0;
    if (i >= visite.etapes.length) { terminerVisite(); return; }
    sens = sens || (i >= visite.i ? 1 : -1);
    visite.i = i;
    var e = visite.etapes[i];
    var jeton = ++visite.jeton;
    var attente = 0;
    // Le texte change tout de suite ; la mise en lumière suit quand la page est affichée
    remplirBulle(e, i);
    if (e.page && typeof currentPage === 'string' && currentPage !== e.page) { allerPage(e.page); attente = 520; }
    setTimeout(function () {
      if (!visite || jeton !== visite.jeton) return;
      ouvrirMenuMobile(!!e.mobileMenu);
      setTimeout(function () {
        if (!visite || jeton !== visite.jeton) return;
        var cible = trouverCible(e);
        // Élément absent à cet écran (par exemple la recherche, masquée sur téléphone) : étape suivante
        if (e.cible && !cible && e.optionnel) { afficherEtape(i + sens, sens); return; }
        if (cible) {
          try { cible.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (err) { cible.scrollIntoView(); }
        }
        positionner(cible);
      }, e.mobileMenu ? 320 : 30);
    }, attente);
  }

  function remplirBulle(e, i) {
    var n = visite.etapes.length;
    var points = '';
    for (var k = 0; k < n; k++) points += '<span class="' + (k <= i ? 'fait' : '') + '"></span>';
    visite.bulle.innerHTML =
      '<div class="gd-etape">Étape ' + (i + 1) + ' sur ' + n + '</div>'
      + '<div class="gd-points" aria-hidden="true">' + points + '</div>'
      + '<h3>' + e.titre + '</h3><p>' + e.texte + '</p>'
      + '<div class="gd-nav-b"><button class="gd-quitter" data-gd="quitter">Quitter la visite</button>'
      + '<div style="display:flex;gap:6px">'
      + (i > 0 ? '<button class="gd-b" data-gd="prec">Précédent</button>' : '')
      + '<button class="gd-b gd-b-p" data-gd="suiv">' + (i === n - 1 ? 'Terminer' : 'Suivant') + '</button>'
      + '</div></div>';
    visite.bulle.querySelector('[data-gd="quitter"]').addEventListener('click', function () { arreterVisite(); });
    var p = visite.bulle.querySelector('[data-gd="prec"]');
    if (p) p.addEventListener('click', function () { afficherEtape(visite.i - 1, -1); });
    visite.bulle.querySelector('[data-gd="suiv"]').addEventListener('click', function () { afficherEtape(visite.i + 1, 1); });
    var s = visite.bulle.querySelector('[data-gd="suiv"]');
    if (s) s.focus();
  }

  function positionner(cible) {
    if (!visite) return;
    var spot = visite.spot, bulle = visite.bulle;
    var vw = window.innerWidth, vh = window.innerHeight;
    if (!cible) {
      spot.classList.add('sans-cible');
      spot.style.left = '50%'; spot.style.top = '40%'; spot.style.width = '0px'; spot.style.height = '0px';
      var bw = bulle.offsetWidth, bh = bulle.offsetHeight;
      bulle.style.left = Math.max(12, (vw - bw) / 2) + 'px';
      bulle.style.top = Math.max(12, (vh - bh) / 2) + 'px';
      return;
    }
    spot.classList.remove('sans-cible');
    var r = cible.getBoundingClientRect();
    var m = 6;
    var x = Math.max(4, r.left - m), y = Math.max(4, r.top - m);
    var w = Math.min(vw - 8, r.width + 2 * m), h = Math.min(vh - 8, r.height + 2 * m);
    spot.style.left = x + 'px'; spot.style.top = y + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px';
    if (vw <= 640) return; // sur téléphone, la bulle est fixée en bas de l'écran (CSS)
    var bw2 = bulle.offsetWidth, bh2 = bulle.offsetHeight;
    var top;
    if (y + h + 12 + bh2 <= vh) top = y + h + 12;          // en dessous
    else if (y - 12 - bh2 >= 0) top = y - 12 - bh2;         // au-dessus
    else top = Math.max(12, Math.min(vh - bh2 - 12, y));    // à côté
    var left = x;
    if (top === y || (top > y && top < y + h)) left = (x + w + 12 + bw2 <= vw) ? x + w + 12 : Math.max(12, x - 12 - bw2);
    left = Math.max(12, Math.min(vw - bw2 - 12, left));
    bulle.style.left = left + 'px'; bulle.style.top = top + 'px';
  }

  function repositionner() {
    if (!visite) return;
    positionner(trouverCible(visite.etapes[visite.i]));
  }

  function arreterVisite(silencieux) {
    if (!visite) return;
    ouvrirMenuMobile(false);
    ['calque', 'spot', 'bulle'].forEach(function (k) { if (visite[k] && visite[k].parentNode) visite[k].parentNode.removeChild(visite[k]); });
    visite = null;
    if (!silencieux && typeof toast === 'function') toast('Le guide reste disponible à tout moment avec le bouton « Guide » en haut de l\'écran');
  }

  function terminerVisite() {
    var nom = visite && visite.nom;
    arreterVisite(true);
    if (nom === 'complete') {
      var p = lirePref(); p.visiteTerminee = true; p.proposer = false; ecrirePref(p);
      majCarteParametres();
    }
    if (typeof toast === 'function') toast('Visite terminée. Le guide complet reste disponible avec le bouton « Guide »');
  }

  // ════════════════════════════════════════════════════════
  // PROPOSITION À LA PREMIÈRE OUVERTURE
  // ════════════════════════════════════════════════════════
  var accueil = null;
  function proposerAccueil() {
    var p = lirePref();
    if (p.proposer === false) return;
    var plusTard = false;
    try { plusTard = sessionStorage.getItem('pharma-guide-plus-tard') === '1'; } catch (e) {}
    if (plusTard || document.body.innerText.indexOf('Accès non autorisé') !== -1) return;
    // Écran de connexion affiché (base de données) : proposé après la connexion
    if (document.body.classList.contains('pharma-verrou') || accueil) return;
    accueil = document.createElement('div');
    accueil.className = 'gd-accueil';
    accueil.setAttribute('role', 'dialog');
    accueil.setAttribute('aria-label', 'Découvrir l\'administration');
    accueil.innerHTML = '<h3>' + svg('boussole', 18) + (p.visiteTerminee ? 'Besoin d\'un rappel ?' : 'Première visite ?') + '</h3>'
      + '<p>Découvrez l\'administration en 2 minutes : les commandes, le retrait au comptoir, le catalogue, la fidélité et les réglages.</p>'
      + '<div class="gd-actions"><button class="gd-b gd-b-p" data-gd="go">' + svg('boussole', 13) + 'Commencer la visite</button>'
      + '<button class="gd-b" data-gd="guide">' + svg('livre', 13) + 'Ouvrir le guide</button>'
      + '<button class="gd-b" data-gd="tard">Plus tard</button></div>'
      + '<button class="gd-lien" data-gd="jamais">Ne plus me le proposer</button>';
    document.body.appendChild(accueil);
    reserverPlace(true);
    accueil.querySelector('[data-gd="go"]').addEventListener('click', function () { fermerAccueil(); lancerVisite(VISITE_COMPLETE, 'complete'); });
    accueil.querySelector('[data-gd="guide"]').addEventListener('click', function () { fermerAccueil(); ouvrirCentre('demarrer'); });
    accueil.querySelector('[data-gd="tard"]').addEventListener('click', function () {
      try { sessionStorage.setItem('pharma-guide-plus-tard', '1'); } catch (e) {}
      fermerAccueil();
    });
    accueil.querySelector('[data-gd="jamais"]').addEventListener('click', function () {
      var pr = lirePref(); pr.proposer = false; ecrirePref(pr); fermerAccueil(); majCarteParametres();
      if (typeof toast === 'function') toast('Le guide reste disponible avec le bouton « Guide » en haut de l\'écran');
    });
  }
  function fermerAccueil() { if (accueil && accueil.parentNode) accueil.parentNode.removeChild(accueil); accueil = null; reserverPlace(false); }
  // Tant que la carte est affichée, une marge est ajoutée en bas de la page : le bas de l'écran
  // (dernières lignes d'un tableau, boutons d'action) peut toujours défiler au-dessus d'elle.
  function reserverPlace(oui) {
    var zone = document.querySelector('.content') || document.body;
    zone.style.paddingBottom = (oui && accueil) ? (accueil.offsetHeight + 36) + 'px' : '';
  }

  // ════════════════════════════════════════════════════════
  // BOUTON « GUIDE » ET CARTE DANS LES PARAMÈTRES
  // ════════════════════════════════════════════════════════
  function ajouterBouton() {
    if (document.getElementById('btn-guide')) return;
    var barre = document.querySelector('.topbar');
    if (!barre) return;
    var b = document.createElement('button');
    b.className = 'btn btn-ghost gd-btn-guide';
    b.id = 'btn-guide';
    b.type = 'button';
    b.title = 'Guide de l\'administration (touche ?)';
    b.setAttribute('aria-label', 'Ouvrir le guide de l\'administration');
    b.innerHTML = svg('livre', 13) + '<span class="gd-lib">Guide</span>';
    b.addEventListener('click', function () { ouvrirCentre(); });
    var cloche = barre.querySelector('.notif-wrap');
    if (cloche) barre.insertBefore(b, cloche); else barre.appendChild(b);
  }

  function ajouterCarteParametres() {
    var page = document.getElementById('page-parametres');
    if (!page || document.getElementById('gd-carte-param')) return;
    var colonne = page.querySelector('.g2 > div:last-child') || page;
    var carte = document.createElement('div');
    carte.className = 'card mb3';
    carte.id = 'gd-carte-param';
    carte.innerHTML = '<div class="card-header"><div class="card-title">Guide de prise en main</div></div><div class="card-body">'
      + '<div style="font-size:0.78rem;color:var(--texte-2);line-height:1.6;margin-bottom:12px">Le guide explique chaque page de l\'administration. Il est disponible à tout moment avec le bouton « Guide » en haut de l\'écran ou la touche <strong>?</strong>.</div>'
      + '<label class="toggle-wrap mb3"><input type="checkbox" class="toggle-input" id="gd-param-proposer"><span class="toggle-track"></span><span style="font-size:0.76rem;font-weight:600">Proposer le guide à l\'ouverture de l\'administration</span></label>'
      + '<div class="flex-gap"><button class="btn btn-primary" type="button" id="gd-param-visite">Lancer la visite guidée</button><button class="btn btn-ghost" type="button" id="gd-param-guide">Ouvrir le guide</button></div>'
      + '</div>';
    colonne.insertBefore(carte, colonne.firstChild);
    carte.querySelector('#gd-param-proposer').addEventListener('change', function () {
      var p = lirePref(); p.proposer = this.checked; ecrirePref(p);
      if (typeof toast === 'function') toast(this.checked ? 'Le guide sera proposé à l\'ouverture' : 'Le guide ne sera plus proposé à l\'ouverture');
    });
    carte.querySelector('#gd-param-visite').addEventListener('click', function () { lancerVisite(VISITE_COMPLETE, 'complete'); });
    carte.querySelector('#gd-param-guide').addEventListener('click', function () { ouvrirCentre('demarrer'); });
    majCarteParametres();
  }
  function majCarteParametres() {
    var c = document.getElementById('gd-param-proposer');
    if (c) c.checked = lirePref().proposer !== false;
  }

  // ════════════════════════════════════════════════════════
  // CLAVIER ET DÉMARRAGE
  // ════════════════════════════════════════════════════════
  function saisieEnCours(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (visite) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); arreterVisite(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); afficherEtape(visite.i + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); afficherEtape(visite.i - 1, -1); }
      return;
    }
    if (centreOuvert() && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fermerCentre(); return; }
    if (e.key === '?' && !saisieEnCours(e) && !e.ctrlKey && !e.metaKey && !e.altKey && !document.body.classList.contains('pharma-verrou')) { e.preventDefault(); ouvrirCentre(); }
  }, true);
  window.addEventListener('resize', repositionner);
  window.addEventListener('scroll', repositionner, true);

  function demarrer() {
    if (!document.querySelector('.topbar')) return; // page bloquée (accès restreint)
    injecterStyles();
    ajouterBouton();
    ajouterCarteParametres();
    setTimeout(proposerAccueil, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  // Accès depuis le reste de l'administration (et pour les tests)
  window.PharmaGuide = {
    proposer: function () { setTimeout(proposerAccueil, 800); },
    ouvrir: ouvrirCentre, fermer: fermerCentre, visite: function (nom) {
      if (!nom || nom === 'complete') return lancerVisite(VISITE_COMPLETE, 'complete');
      var c = CHAPITRES.find(function (x) { return x.id === nom; });
      if (c && c.visite && c.visite !== 'complete') lancerVisite(c.visite, c.id);
    },
    arreter: function () { arreterVisite(true); }, chapitres: CHAPITRES, visiteComplete: VISITE_COMPLETE,
    etat: function () { return { visite: visite ? { i: visite.i, n: visite.etapes.length, nom: visite.nom } : null, centre: centreOuvert(), chapitre: chapitreCourant, pref: lirePref() }; }
  };
})();
