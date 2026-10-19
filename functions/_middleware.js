// ════════════════════════════════════════════
// Démo de test : accès réservé par mot de passe (Cloudflare Pages)
// ════════════════════════════════════════════
// Ce fichier passe avant CHAQUE page, script et image du site : sans le bon mot de passe,
// rien n'est envoyé au navigateur (ni les pages, ni le code).
// Le mot de passe n'est PAS écrit ici : il est rangé dans Cloudflare, dans les réglages du projet
// (variable secrète nommée MOT_DE_PASSE). Le changer là-bas déconnecte tous les visiteurs.

const COOKIE = 'acces_demo';
const DUREE_SECONDES = 30 * 24 * 3600;   // on reste connecté 30 jours sur l'appareil
const enc = new TextEncoder();

// Empreinte du mot de passe (HMAC-SHA256) : c'est elle qui est gardée dans le cookie, jamais le mot de passe
async function empreinte(motDePasse) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(motDePasse), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cle, enc.encode('acces-demo-v1'));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Comparaison en temps constant (ne révèle pas, par la durée, quelle partie est juste)
function egal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function lireCookie(requete, nom) {
  const brut = requete.headers.get('Cookie') || '';
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return '';
}
// Adresse de retour après connexion : uniquement une page de ce site (pas de redirection vers un autre site)
function retourSur(valeur) {
  const v = String(valeur || '');
  return (/^\/(?!\/)[A-Za-z0-9._~\-\/?=&%+]*$/.test(v) && v.length <= 300) ? v : '/';
}
function echapper(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const ENTETES = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};

function pageConnexion(message, statut, retour) {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Accès réservé — Pharmacie Démo</title>
<style>
:root{--fond:#F5F1E6;--carte:#FBF9F3;--texte:#1F2119;--doux:#716D60;--bord:#E4DDCE;--vert:#1B6B45;--grenat:#A8322D}
@media (prefers-color-scheme: dark){:root{--fond:#171510;--carte:#211E17;--texte:#EEE9DC;--doux:#A9A390;--bord:#3A352A;--vert:#3CC07D;--grenat:#FFB4A6}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--fond);color:var(--texte);font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
main{width:100%;max-width:380px;background:var(--carte);border:1px solid var(--bord);border-radius:20px;padding:30px 26px}
.croix{width:38px;height:38px;border-radius:11px;background:var(--vert);display:flex;align-items:center;justify-content:center;margin-bottom:18px}
h1{font:600 1.6rem/1.2 Georgia,'Times New Roman',serif;margin:0 0 6px}
p{margin:0 0 20px;color:var(--doux)}
label{display:block;font-weight:600;margin-bottom:6px}
input{width:100%;font:inherit;padding:12px 14px;border:1px solid var(--bord);border-radius:12px;background:var(--fond);color:var(--texte)}
input:focus{outline:3px solid color-mix(in srgb,var(--vert) 45%,transparent);outline-offset:1px}
button{width:100%;margin-top:14px;font:inherit;font-weight:700;padding:12px 14px;border:0;border-radius:12px;background:var(--vert);color:#fff;cursor:pointer}
@media (prefers-color-scheme: dark){button{color:#0E1A13}}
.erreur{color:var(--grenat);font-weight:600;margin:12px 0 0}
</style></head>
<body><main>
<div class="croix" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg></div>
<h1>Accès réservé</h1>
<p>Cette démonstration est privée. Entrez le mot de passe qui vous a été transmis.</p>
<form method="post" action="/__acces">
<input type="hidden" name="retour" value="${echapper(retour)}">
<label for="mdp">Mot de passe</label>
<input id="mdp" name="mdp" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Entrer</button>
${message ? `<p class="erreur" role="alert">${echapper(message)}</p>` : ''}
</form>
</main></body></html>`;
  return new Response(html, { status: statut, headers: ENTETES });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = env.MOT_DE_PASSE;
  if (!secret || String(secret).length < 6) {
    return pageConnexion('Accès fermé : le mot de passe n\'est pas encore réglé dans Cloudflare.', 503, '/');
  }
  const attendu = await empreinte(String(secret));

  if (url.pathname === '/__acces') {
    if (request.method !== 'POST') return Response.redirect(url.origin + '/', 303);
    let mdp = '', retour = '/';
    try { const f = await request.formData(); mdp = String(f.get('mdp') || '').slice(0, 200); retour = retourSur(f.get('retour')); } catch (e) {}
    if (mdp && egal(await empreinte(mdp), attendu)) {
      return new Response(null, { status: 303, headers: {
        'Location': retour,
        'Set-Cookie': `${COOKIE}=${attendu}; Max-Age=${DUREE_SECONDES}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store'
      } });
    }
    await new Promise(r => setTimeout(r, 900));   // freine les essais en rafale
    return pageConnexion('Mot de passe incorrect.', 401, retour);
  }
  // Le dossier functions/ (ce fichier) n'est jamais servi comme une page
  if (url.pathname.startsWith('/functions/') || url.pathname === '/functions') {
    return new Response('Introuvable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (url.pathname === '/__sortie') {
    return new Response(null, { status: 303, headers: { 'Location': '/', 'Set-Cookie': `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`, 'Cache-Control': 'no-store' } });
  }
  if (egal(lireCookie(request, COOKIE), attendu)) {
    const reponse = await context.next();
    const r = new Response(reponse.body, reponse);
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    r.headers.set('Cache-Control', 'private, no-cache');
    return r;
  }
  return pageConnexion('', 401, retourSur(url.pathname + url.search));
}
