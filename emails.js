// ════════════════════════════════════════════
// PHARMACIE DÉMO — Envoi d'emails (EmailJS)
// ════════════════════════════════════════════
// Module partagé : chargé par site.html (confirmation, code fidélité) et
// admin.html (commande prête, email de test), APRÈS data.js.
//
// Principe : UN SEUL modèle EmailJS pour tous les emails et toutes les
// pharmacies. Rien de propre à une pharmacie n'est écrit dans le modèle :
// nom, adresse, couleurs, horaires viennent de DATA.parametres au moment de
// l'envoi, et les textes (FR / EN / AR / HE) sont fabriqués ici.
//
// Règle d'or : un email qui échoue ne doit JAMAIS empêcher ni annuler une
// commande. L'envoi est asynchrone, tolérant aux erreurs, et son résultat est
// consigné dans DATA.emailLog (visible dans l'admin, page Notifications).

var PharmaEmail = (function () {
  var ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
  var LANGUES = ['fr', 'en', 'ar', 'he'];
  var RTL = { ar: true, he: true };
  var LOCALES = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-u-nu-latn', he: 'he-IL' };
  var MAX_JOURNAL = 50;

  // ── TEXTES ──────────────────────────────────────────────
  // Marqueurs {x} remplacés à l'envoi. Les textes en arabe et en hébreu
  // gagneraient à être relus par un locuteur avant la mise en ligne.
  var TEXTES = {
    fr: {
      produits: 'Produits', date: 'Date', total: 'Total à régler en pharmacie',
      remise: 'Code {code}', retrait: 'Retrait en pharmacie', codeLabel: 'Code de retrait', adresse: 'Adresse',
      horaires: 'Horaires', tel: 'Téléphone', fidTitre: 'Programme fidélité',
      ferme: 'fermé', footer: 'Cet email a été envoyé suite à votre commande sur le site de {pharma}.',
      progression: '{n} / {seuil} achats',
      restant1: 'Plus qu\'un achat avant votre réduction de {pct} %.',
      restantN: 'Plus que {restant} achats avant votre réduction de {pct} %.',
      atteint: 'Palier atteint ! Votre code fidélité vous est envoyé dans un second email.',
      commandeRecue: {
        sujet: 'Confirmation de votre commande {id}', titre: 'Commande bien reçue',
        alerte: 'Nous préparons votre commande',
        salutation: 'Bonjour {prenom}, merci pour votre commande {id}. Nous vous prévenons dès qu\'elle est prête à être retirée.',
        bas: 'Au retrait, présentez votre numéro de commande {id} et votre code de retrait {code}.',
        cta: 'Voir mes commandes'
      },
      commandePrete: {
        sujet: 'Votre commande {id} est prête à être retirée', titre: 'Votre commande est prête',
        alerte: 'À retirer en pharmacie',
        salutation: 'Bonjour {prenom}, votre commande {id} est prête. Vous pouvez venir la retirer aux horaires ci-dessous.',
        bas: 'Au retrait, présentez votre numéro de commande {id} et votre code de retrait {code}.',
        cta: 'Voir mes commandes'
      },
      codeFidelite: {
        sujet: 'Votre code fidélité {pharma}', titre: 'Palier fidélité atteint',
        alerte: 'Une réduction vous attend',
        salutation: 'Félicitations {prenom} ! Vos {seuil} achats vous donnent droit à une réduction de {pct} %.',
        codeTitre: 'Votre code fidélité',
        codeTexte: '-{pct} % sur votre prochaine commande, valable jusqu\'au {expire}. Un seul usage.',
        bas: 'Saisissez ce code dans votre panier lors de votre prochaine commande.',
        cta: 'Commander'
      }
    },
    en: {
      produits: 'Items', date: 'Date', total: 'Total to pay at the pharmacy',
      remise: 'Code {code}', retrait: 'Pick-up at the pharmacy', codeLabel: 'Pick-up code', adresse: 'Address',
      horaires: 'Opening hours', tel: 'Phone', fidTitre: 'Loyalty programme',
      ferme: 'closed', footer: 'This email was sent following your order on the {pharma} website.',
      progression: '{n} / {seuil} purchases',
      restant1: 'Just one more purchase before your {pct}% reward.',
      restantN: '{restant} more purchases before your {pct}% reward.',
      atteint: 'Milestone reached! Your loyalty code is sent in a second email.',
      commandeRecue: {
        sujet: 'Confirmation of your order {id}', titre: 'Order received',
        alerte: 'We are preparing your order',
        salutation: 'Hello {prenom}, thank you for your order {id}. We will let you know as soon as it is ready for pick-up.',
        bas: 'At pick-up, show your order number {id} and your pick-up code {code}.',
        cta: 'View my orders'
      },
      commandePrete: {
        sujet: 'Your order {id} is ready for pick-up', titre: 'Your order is ready',
        alerte: 'Ready for pick-up at the pharmacy',
        salutation: 'Hello {prenom}, your order {id} is ready. You can collect it during the opening hours below.',
        bas: 'At pick-up, show your order number {id} and your pick-up code {code}.',
        cta: 'View my orders'
      },
      codeFidelite: {
        sujet: 'Your {pharma} loyalty code', titre: 'Loyalty milestone reached',
        alerte: 'A reward is waiting for you',
        salutation: 'Congratulations {prenom}! Your {seuil} purchases earn you a {pct}% discount.',
        codeTitre: 'Your loyalty code',
        codeTexte: '-{pct}% on your next order, valid until {expire}. Single use.',
        bas: 'Enter this code in your basket on your next order.',
        cta: 'Order now'
      }
    },
    ar: {
      produits: 'المنتجات', date: 'التاريخ', total: 'المجموع المستحق في الصيدلية',
      remise: 'رمز {code}', retrait: 'الاستلام في الصيدلية', codeLabel: 'رمز الاستلام', adresse: 'العنوان',
      horaires: 'ساعات العمل', tel: 'الهاتف', fidTitre: 'برنامج الولاء',
      ferme: 'مغلق', footer: 'أُرسلت هذه الرسالة بعد طلبك على موقع {pharma}.',
      progression: '{n} / {seuil} عمليات شراء',
      restant1: 'بقيت عملية شراء واحدة قبل تخفيضك بنسبة {pct}%.',
      restantN: 'بقي {restant} عمليات شراء قبل تخفيضك بنسبة {pct}%.',
      atteint: 'تم بلوغ المستوى! سيصلك رمز الولاء في رسالة منفصلة.',
      commandeRecue: {
        sujet: 'تأكيد طلبك {id}', titre: 'تم استلام طلبك',
        alerte: 'نقوم بتحضير طلبك',
        salutation: 'مرحباً {prenom}، شكراً على طلبك {id}. سنخبرك فور أن يكون جاهزاً للاستلام.',
        bas: 'عند الاستلام، قدّم رقم طلبك {id} ورمز الاستلام {code}.',
        cta: 'عرض طلباتي'
      },
      commandePrete: {
        sujet: 'طلبك {id} جاهز للاستلام', titre: 'طلبك جاهز',
        alerte: 'جاهز للاستلام في الصيدلية',
        salutation: 'مرحباً {prenom}، طلبك {id} جاهز. يمكنك استلامه خلال ساعات العمل أدناه.',
        bas: 'عند الاستلام، قدّم رقم طلبك {id} ورمز الاستلام {code}.',
        cta: 'عرض طلباتي'
      },
      codeFidelite: {
        sujet: 'رمز الولاء من {pharma}', titre: 'تم بلوغ مستوى الولاء',
        alerte: 'مكافأة بانتظارك',
        salutation: 'تهانينا {prenom}! مشترياتك الـ{seuil} تمنحك تخفيضاً بنسبة {pct}%.',
        codeTitre: 'رمز الولاء الخاص بك',
        codeTexte: 'خصم {pct}% على طلبك القادم، صالح حتى {expire}. استخدام واحد فقط.',
        bas: 'أدخل هذا الرمز في سلة مشترياتك عند طلبك القادم.',
        cta: 'اطلب الآن'
      }
    },
    he: {
      produits: 'מוצרים', date: 'תאריך', total: 'סה״כ לתשלום בבית המרקחת',
      remise: 'קוד {code}', retrait: 'איסוף בבית המרקחת', codeLabel: 'קוד איסוף', adresse: 'כתובת',
      horaires: 'שעות פעילות', tel: 'טלפון', fidTitre: 'תוכנית נאמנות',
      ferme: 'סגור', footer: 'הודעה זו נשלחה בעקבות הזמנתך באתר {pharma}.',
      progression: '{n} / {seuil} רכישות',
      restant1: 'נותרה רכישה אחת עד להנחה של {pct}%.',
      restantN: 'נותרו {restant} רכישות עד להנחה של {pct}%.',
      atteint: 'הגעת ליעד! קוד הנאמנות יישלח אליך במייל נפרד.',
      commandeRecue: {
        sujet: 'אישור הזמנה {id}', titre: 'ההזמנה שלך התקבלה',
        alerte: 'אנחנו מכינים את ההזמנה שלך',
        salutation: 'שלום {prenom}, תודה על הזמנתך {id}. נעדכן אותך ברגע שהיא מוכנה לאיסוף.',
        bas: 'באיסוף, יש להציג את מספר ההזמנה {id} ואת קוד האיסוף {code}.',
        cta: 'ההזמנות שלי'
      },
      commandePrete: {
        sujet: 'ההזמנה {id} מוכנה לאיסוף', titre: 'ההזמנה שלך מוכנה',
        alerte: 'מוכנה לאיסוף בבית המרקחת',
        salutation: 'שלום {prenom}, ההזמנה שלך {id} מוכנה. אפשר לאסוף אותה בשעות הפעילות המצוינות להלן.',
        bas: 'באיסוף, יש להציג את מספר ההזמנה {id} ואת קוד האיסוף {code}.',
        cta: 'ההזמנות שלי'
      },
      codeFidelite: {
        sujet: 'קוד הנאמנות שלך מ-{pharma}', titre: 'הגעת ליעד הנאמנות',
        alerte: 'הנחה מחכה לך',
        salutation: 'מזל טוב {prenom}! {seuil} הרכישות שלך מזכות אותך בהנחה של {pct}%.',
        codeTitre: 'קוד הנאמנות שלך',
        codeTexte: '{pct}% הנחה בהזמנה הבאה, בתוקף עד {expire}. שימוש חד-פעמי.',
        bas: 'יש להזין את הקוד בעגלת הקניות בהזמנה הבאה.',
        cta: 'להזמנה'
      }
    }
  };

  var TYPES = ['commandeRecue', 'commandePrete', 'codeFidelite'];

  // ── OUTILS ──────────────────────────────────────────────
  function remplir(modele, valeurs) {
    return String(modele == null ? '' : modele).replace(/\{(\w+)\}/g, function (m, cle) {
      return valeurs[cle] !== undefined && valeurs[cle] !== null ? String(valeurs[cle]) : '';
    });
  }
  function emailValide(e) {
    if (typeof pharmaEmailValide === 'function') return pharmaEmailValide(e);
    return /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(String(e || '').trim());
  }

  // Langue du client : celle de son profil, sinon celle de son système
  // (« iw » est l'ancien code de l'hébreu, encore utilisé par d'anciens appareils).
  function normaliserLangue(code) {
    var c = String(code || '').toLowerCase().split('-')[0];
    if (c === 'iw') c = 'he';
    return LANGUES.indexOf(c) !== -1 ? c : '';
  }
  function langueClient() {
    var profil = null;
    try { profil = JSON.parse(localStorage.getItem('pharma-profil') || 'null'); } catch (e) {}
    var l = normaliserLangue(profil && profil.langue);
    if (l) return l;
    try { l = normaliserLangue(navigator.language || navigator.userLanguage); } catch (e2) {}
    return l || 'fr';
  }

  // ── COULEURS (déduites de la couleur principale de la pharmacie) ──
  function hexVersHsl(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }
  function hslVersHex(h, s, l) {
    function f(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      var v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      var x = Math.round(v * 255).toString(16);
      return x.length === 1 ? '0' + x : x;
    }
    return ('#' + f(0) + f(8) + f(4)).toUpperCase();
  }
  function palette(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) hex = '#1B6B45';
    hex = hex.toUpperCase();
    // Vert d'origine : on garde les teintes validées du design
    if (hex === '#1B6B45') return { couleur: hex, fonce: '#0F4A2E', clair: '#2ECC7A' };
    var c = hexVersHsl(hex);
    return {
      couleur: hex,
      fonce: hslVersHex(c.h, c.s, Math.max(0.10, c.l * 0.68)),
      clair: hslVersHex(c.h, Math.min(0.75, c.s + 0.1), 0.52)
    };
  }

  // ── HORAIRES lisibles : « Lun–Sam 9h–21h · Dim 9h–20h » ──
  function heureTexte(h, lang) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
    if (!m) return String(h || '');
    if (lang === 'fr') return parseInt(m[1], 10) + 'h' + (m[2] === '00' ? '' : m[2]);
    return ('0' + parseInt(m[1], 10)).slice(-2) + ':' + m[2];
  }
  function horairesTexte(horaires, lang, T) {
    if (!horaires || typeof horaires !== 'object') return '';
    var cles = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    var noms;
    try {
      var fmt = new Intl.DateTimeFormat(LOCALES[lang] || 'fr-FR', { weekday: 'short' });
      noms = cles.map(function (c, i) { return fmt.format(new Date(2024, 0, 1 + i)).replace(/\.$/, ''); });
    } catch (e) { noms = cles.map(function (c) { return c.slice(0, 3); }); }
    var groupes = [];
    cles.forEach(function (cle, i) {
      var h = horaires[cle];
      if (!h) return;
      var texte = h.ouvert ? heureTexte(h.debut, lang) + '–' + heureTexte(h.fin, lang) : T.ferme;
      var dernier = groupes[groupes.length - 1];
      if (dernier && dernier.texte === texte && dernier.fin === i - 1) dernier.fin = i;
      else groupes.push({ debut: i, fin: i, texte: texte });
    });
    return groupes.map(function (g) {
      var jours = g.debut === g.fin ? noms[g.debut] : noms[g.debut] + '–' + noms[g.fin];
      return jours + ' ' + g.texte;
    }).join(' · ');
  }

  function formaterDate(iso, lang) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) d = new Date();
    try {
      return new Intl.DateTimeFormat(LOCALES[lang] || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
  }
  function formaterDateCourte(iso, lang) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    try { return new Intl.DateTimeFormat(LOCALES[lang] || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
    catch (e) { return String(iso); }
  }
  function formaterMontant(n, lang) {
    var v = Math.round((parseFloat(n) || 0) * 100) / 100;
    try { return new Intl.NumberFormat(LOCALES[lang] || 'fr-FR', { style: 'currency', currency: 'EUR' }).format(v); }
    catch (e) { return v.toFixed(2).replace('.', ',') + ' €'; }
  }

  // ── CONFIGURATION ET ACTIVATION ──
  function config(data) {
    var p = (data && data.parametres) || {};
    var c = p.emailjs || {};
    return {
      actif: c.actif === true,
      serviceId: String(c.serviceId || '').trim(),
      templateId: String(c.templateId || '').trim(),
      publicKey: String(c.publicKey || '').trim(),
      logoUrl: /^https:\/\//i.test(String(c.logoUrl || '').trim()) ? String(c.logoUrl).trim() : '',
      siteUrl: String(c.siteUrl || '').trim()
    };
  }
  function pret(data) {
    var c = config(data);
    return c.actif && !!c.serviceId && !!c.templateId && !!c.publicKey;
  }
  function typeActif(type, data) {
    var n = (data && data.parametres && data.parametres.notifAuto) || {};
    return n[type] === true;
  }

  // Adresse du bouton « Voir mes commandes » : adresse publique configurée,
  // sinon celle du site en cours (inutilisable en local ou en file://, donc omise).
  function lienCompte(cfg) {
    var base = cfg.siteUrl;
    if (!base) {
      try {
        if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
          base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
        }
      } catch (e) {}
    }
    if (!/^https?:\/\//i.test(base || '')) return '';
    return base.replace(/\/+$/, '').replace(/\/(site|admin|compte)\.html$/, '') + '/compte.html#commandes';
  }

  // ── CONSTRUCTION DES VARIABLES DU MODÈLE ──
  // ctx : { commande:{id,client,email,produits,total,timestamp,lang,codeRetrait,codePromo,remise},
  //         fidelite:{seuil,reduction,achats,atteint}, code:{code,pct,expire} }
  function construire(type, data, ctx) {
    ctx = ctx || {};
    var cmd = ctx.commande || {};
    var lang = normaliserLangue(cmd.lang) || 'fr';
    var T = TEXTES[lang];
    var TT = T[type] || T.commandeRecue;
    var p = (data && data.parametres) || {};
    var cfg = config(data);
    var pal = palette(p.couleurPrimaire);
    var nomPharma = p.nom || 'Pharmacie';
    var prenom = String(cmd.client || '').trim().split(/\s+/)[0] || '';
    var fid = ctx.fidelite || null;
    var code = ctx.code || null;

    var vals = {
      id: cmd.id || '', prenom: prenom, code: cmd.codeRetrait || '', pharma: nomPharma,
      seuil: fid ? fid.seuil : '', pct: code ? code.pct : (fid ? fid.reduction : ''),
      expire: code && code.expire ? formaterDateCourte(code.expire, lang) : ''
    };

    var params = {
      subject: remplir(TT.sujet, vals),
      to_email: String(cmd.email || '').trim(),
      lang: lang, dir: RTL[lang] ? 'rtl' : 'ltr', align_end: RTL[lang] ? 'left' : 'right',
      pharma_nom: nomPharma, pharma_adresse: p.adresse || '', pharma_tel: p.tel || '',
      pharma_email: p.email || '', pharma_horaires: horairesTexte(data && data.horaires, lang, T),
      couleur: pal.couleur, couleur_fonce: pal.fonce, couleur_clair: pal.clair,
      logo_url: cfg.logoUrl,
      order_id: cmd.id || '',
      txt_titre: remplir(TT.titre, vals), txt_alerte: remplir(TT.alerte, vals),
      txt_salutation: remplir(TT.salutation, vals),
      txt_section_commande: ({ fr: 'Votre commande', en: 'Your order', ar: 'طلبك', he: 'ההזמנה שלך' })[lang],
      txt_produits_label: T.produits, produits: cmd.produits || '',
      txt_date_label: T.date, date: formaterDate(cmd.timestamp, lang),
      remise: '', txt_remise_label: '',
      txt_total_label: T.total, total: formaterMontant(cmd.total, lang),
      code_retrait: '', txt_code_label: T.codeLabel,
      txt_section_retrait: T.retrait, txt_adresse_label: T.adresse,
      txt_horaires_label: T.horaires, txt_tel_label: T.tel,
      fid_progress: '', fid_pct: '0', txt_fid_titre: T.fidTitre, txt_fid_texte: '',
      fid_code: '', txt_fid_code_titre: '', txt_fid_code_texte: '',
      txt_message_bas: remplir(TT.bas, vals),
      lien_cta: lienCompte(cfg), txt_cta: TT.cta || '',
      txt_footer: remplir(T.footer, vals)
    };

    // Code de retrait en évidence (confirmation et « prête » ; pas dans l'email du code fidélité)
    if (type !== 'codeFidelite') params.code_retrait = cmd.codeRetrait || '';

    if (cmd.codePromo && cmd.remise > 0) {
      params.remise = '-' + formaterMontant(cmd.remise, lang);
      params.txt_remise_label = remplir(T.remise, { code: cmd.codePromo });
    }

    // Progression de fidélité : uniquement dans la confirmation de commande
    if (type === 'commandeRecue' && fid && fid.seuil > 0) {
      var prog = PharmaFidelite.progression(fid.achats, fid.seuil);
      params.fid_progress = remplir(T.progression, { n: prog.courant, seuil: fid.seuil });
      params.fid_pct = String(prog.pct);
      params.txt_fid_texte = prog.atteint
        ? T.atteint
        : remplir(prog.restant === 1 ? T.restant1 : T.restantN, { restant: prog.restant, pct: fid.reduction });
    }

    // Code fidélité débloqué
    if (type === 'codeFidelite' && code) {
      params.fid_code = code.code || '';
      params.txt_fid_code_titre = TT.codeTitre || '';
      params.txt_fid_code_texte = remplir(TT.codeTexte, vals);
    }
    return params;
  }

  // ── JOURNAL ──
  function journaliser(type, params, resultat, test) {
    // Site relié à la base : le journal est tenu par le serveur (cloud.js)
    if (typeof PharmaCloud !== 'undefined' && PharmaCloud.prevu) {
      PharmaCloud.journaliserEmail(type, params, resultat, test);
      return;
    }
    try {
      PharmaStore.mettreAJour(function (d) {
        if (!Array.isArray(d.emailLog)) d.emailLog = [];
        d.emailLog.unshift({
          id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString(),
          type: test ? 'test' : type,
          destinataire: params.to_email || '',
          commande: params.order_id || '',
          statut: resultat.manuel ? 'Préparé (envoi manuel)' : (resultat.ok ? 'Envoyé' : 'Échec'),
          detail: (resultat.ok || resultat.manuel) ? '' : String(resultat.detail || resultat.raison || '').slice(0, 200)
        });
        if (d.emailLog.length > MAX_JOURNAL) d.emailLog = d.emailLog.slice(0, MAX_JOURNAL);
        // Décompte du quota : un email envoyé avec succès est retiré du nombre relevé dans EmailJS
        var q = d.parametres && d.parametres.emailQuota;
        if (resultat.ok && q && typeof q === 'object') q.envoyes = (parseInt(q.envoyes, 10) || 0) + 1;
      });
    } catch (e) { console.warn('Journal des emails non enregistré', e); }
  }

  // ── ENVOI ──
  // Renvoie toujours une promesse RÉSOLUE (jamais rejetée) : {ok, status, detail|raison, ignore}
  function envoyer(type, data, ctx, options) {
    options = options || {};
    var test = options.test === true;
    if (TYPES.indexOf(type) === -1) return Promise.resolve({ ok: false, ignore: true, raison: 'type inconnu' });
    if (!test && !typeActif(type, data)) return Promise.resolve({ ok: false, ignore: true, raison: 'désactivé dans Notifications' });
    if (!pret(data) && !(test && config(data).serviceId && config(data).templateId && config(data).publicKey)) {
      return Promise.resolve({ ok: false, ignore: true, raison: 'EmailJS non configuré ou désactivé' });
    }
    var params = construire(type, data, ctx);
    if (!emailValide(params.to_email)) {
      var r0 = { ok: false, ignore: true, raison: 'adresse email du destinataire absente ou invalide' };
      return Promise.resolve(r0);
    }
    var cfg = config(data);
    if (typeof fetch !== 'function') {
      var r1 = { ok: false, status: 0, detail: 'fetch indisponible' };
      journaliser(type, params, r1, test);
      return Promise.resolve(r1);
    }
    var requete;
    try {
      requete = fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey, template_params: params })
      });
    } catch (e) {
      var r2 = { ok: false, status: 0, detail: String(e && e.message || e) };
      journaliser(type, params, r2, test);
      return Promise.resolve(r2);
    }
    return Promise.resolve(requete).then(function (res) {
      return Promise.resolve(res.text ? res.text() : '').then(function (txt) {
        return { ok: !!res.ok, status: res.status, detail: txt };
      }, function () { return { ok: !!res.ok, status: res.status, detail: '' }; });
    }, function (err) {
      return { ok: false, status: 0, detail: String(err && err.message || err) };
    }).then(function (r) {
      journaliser(type, params, r, test);
      return r;
    });
  }

  // ── DÉCOMPTE DES EMAILS RESTANTS ──
  // Le nombre restant est relevé à la main dans le tableau de bord EmailJS puis saisi dans
  // l'admin ; chaque email envoyé avec succès ensuite est décompté. Tant que le site n'est pas
  // relié au serveur, seuls les envois partis de CE navigateur sont comptés : le chiffre réel
  // peut donc être plus bas (les confirmations partent du téléphone des clients).
  var SEUIL_ALERTE_QUOTA = 20;
  function quota(data) {
    var q = data && data.parametres && data.parametres.emailQuota;
    if (!q || typeof q !== 'object') return null;
    var releve = parseInt(q.releve, 10);
    if (!isFinite(releve) || releve < 0) return null;
    var envoyes = Math.max(0, parseInt(q.envoyes, 10) || 0);
    var restants = Math.max(0, releve - envoyes);
    return { releve: releve, releveLe: q.releveLe || '', envoyes: envoyes, restants: restants,
      alerte: restants <= SEUIL_ALERTE_QUOTA, epuise: restants === 0 };
  }

  // ── EMAIL PRÉREMPLI (envoi manuel depuis la messagerie de la pharmacie) ──
  // Même contenu que l'email automatique, en texte simple, dans la langue du client.
  // Ne consomme aucun quota : c'est la pharmacie qui l'envoie depuis sa propre boîte.
  function prerempli(type, data, ctx) {
    var p = construire(type, data, ctx);
    var L = [p.txt_salutation, ''];
    if (type !== 'codeFidelite') {
      L.push(p.txt_section_commande + ' ' + p.order_id + (p.date ? ' (' + p.date + ')' : ''));
      if (p.produits) L.push(p.txt_produits_label + ' : ' + p.produits);
      if (p.remise) L.push(p.txt_remise_label + ' : ' + p.remise);
      L.push(p.txt_total_label + ' : ' + p.total);
      if (p.code_retrait) L.push(p.txt_code_label + ' : ' + p.code_retrait);
      L.push('');
    }
    if (p.fid_code) { L.push(p.txt_fid_code_titre + ' : ' + p.fid_code, p.txt_fid_code_texte, ''); }
    L.push(p.txt_section_retrait + ' : ' + p.pharma_nom);
    if (p.pharma_adresse) L.push(p.txt_adresse_label + ' : ' + p.pharma_adresse);
    if (p.pharma_horaires) L.push(p.txt_horaires_label + ' : ' + p.pharma_horaires);
    if (p.pharma_tel) L.push(p.txt_tel_label + ' : ' + p.pharma_tel);
    L.push('', p.txt_message_bas);
    if (p.lien_cta) L.push(p.txt_cta + ' : ' + p.lien_cta);
    L.push('', p.pharma_nom);
    return { type: type, destinataire: p.to_email, sujet: p.subject, corps: L.join('\n'), commande: p.order_id, lang: p.lang };
  }
  // Lien « mailto: » qui ouvre la messagerie avec l'email prêt à partir.
  // L'adresse est validée (une seule adresse) et tout le reste est encodé : rien ne peut
  // ajouter de destinataire caché ni d'en-tête.
  function lienMailto(pre) {
    if (!pre || !emailValide(pre.destinataire)) return '';
    var adr = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(pre.destinataire) ? pre.destinataire : encodeURIComponent(pre.destinataire);
    return 'mailto:' + adr + '?subject=' + encodeURIComponent(pre.sujet) + '&body=' + encodeURIComponent(String(pre.corps).replace(/\n/g, '\r\n'));
  }
  // Trace dans le journal qu'un email a été préparé pour un envoi manuel (non décompté du quota)
  function noterManuel(pre) {
    if (!pre) return;
    journaliser(pre.type, { to_email: pre.destinataire, order_id: pre.commande }, { ok: false, manuel: true }, false);
  }

  // Envoie plusieurs emails l'un après l'autre en laissant une seconde entre
  // chaque (le service gratuit limite la cadence des requêtes).
  function envoyerEnSerie(liste) {
    var resultats = [];
    return liste.reduce(function (chaine, item, i) {
      return chaine.then(function () {
        var attente = i === 0 ? Promise.resolve() : new Promise(function (ok) { setTimeout(ok, 1100); });
        return attente.then(function () { return envoyer(item.type, item.data, item.ctx); })
          .then(function (r) { resultats.push(r); });
      });
    }, Promise.resolve()).then(function () { return resultats; });
  }

  return {
    LANGUES: LANGUES, TYPES: TYPES,
    config: config, pret: pret, construire: construire, envoyer: envoyer, envoyerEnSerie: envoyerEnSerie,
    langueClient: langueClient, normaliserLangue: normaliserLangue, emailValide: emailValide,
    palette: palette, horairesTexte: function (h, l) { return horairesTexte(h, l, TEXTES[l] || TEXTES.fr); },
    quota: quota, prerempli: prerempli, lienMailto: lienMailto, noterManuel: noterManuel
  };
})();
