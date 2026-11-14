// Connexion avec Google (OAuth / OpenID Connect) : un faux Google joue le rôle des serveurs de Google.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
let srvOff;
let base;
let google;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  google = await h.startFakeGoogle();
  srv = await h.startServer(4121, {
    AUTH_RATE_LIMIT_MAX: '1000',
    GOOGLE_AUTH_URL: `${google.url}/authorize`,
    GOOGLE_TOKEN_URL: `${google.url}/token`,
    GOOGLE_USERINFO_URL: `${google.url}/userinfo`,
    GOOGLE_CLIENT_ID: h.OAUTH_CLIENT.id,
    GOOGLE_CLIENT_SECRET: h.OAUTH_CLIENT.secret,
    GOOGLE_CALLBACK_URL: 'https://site.test/api/auth/google/callback',
  });
  srvOff = await h.startServer(4122, { AUTH_RATE_LIMIT_MAX: '1000', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
  base = srv.base;
});
after(async () => {
  srv?.stop();
  srvOff?.stop();
  google?.stop();
  await h.cleanup();
});

let n = 0;
const nextId = () => `${Date.now()}${++n}`; // « sub » unique d'un run à l'autre : la base de test n'est pas vidée
const manual = { redirect: 'manual' };

async function start(client, mode) {
  const r = await client.get(`/auth/google/start${mode ? `?mode=${mode}` : ''}`, manual);
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  return { loc, state: loc.searchParams.get('state') };
}
async function callback(client, code, state) {
  const r = await client.get(`/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, manual);
  const u = new URL(r.headers.get('location') || 'http://x/');
  return { status: r.status, to: u.pathname + u.search };
}
const profile = (extra = {}) => {
  const sub = nextId();
  return { sub, email: `g${sub}@mail.test`, email_verified: true, name: 'Awa Diop', ...extra };
};
async function signUpWithGoogle(p = profile(), country = 'Sénégal') {
  const c = new h.Client(base);
  const { state } = await start(c);
  const back = await callback(c, google.grant(p), state);
  assert.equal(back.to, '/inscription/google');
  const done = await c.post('/auth/google/finaliser', { country, acceptTerms: true });
  return { client: c, profile: p, res: done };
}

describe('Connexion avec Google : configuration', () => {
  it('/auth/google/etat indique si Google est configuré', async () => {
    assert.deepEqual((await new h.Client(base).get('/auth/google/etat')).body, { enabled: true });
    assert.deepEqual((await new h.Client(srvOff.base).get('/auth/google/etat')).body, { enabled: false });
  });

  it('sans configuration, /start renvoie vers la connexion avec une erreur, sans rien casser', async () => {
    const r = await new h.Client(srvOff.base).get('/auth/google/start', manual);
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=google_indisponible$/);
  });

  it('/start redirige vers Google avec identifiant, adresse de retour, état et droits minimaux', async () => {
    const c = new h.Client(base);
    const { loc } = await start(c);
    assert.equal(loc.origin + loc.pathname, `${google.url}/authorize`);
    assert.equal(loc.searchParams.get('client_id'), h.OAUTH_CLIENT.id);
    assert.equal(loc.searchParams.get('redirect_uri'), 'https://site.test/api/auth/google/callback');
    assert.equal(loc.searchParams.get('response_type'), 'code');
    assert.equal(loc.searchParams.get('scope'), 'openid email profile');
    assert.match(loc.searchParams.get('state'), /^[0-9a-f]{48}$/);
    assert.ok(c.cookies.has('gamelia_oauth_google'));
  });
});

describe('Connexion avec Google : inscription et connexion', () => {
  it('première connexion : création du compte après choix du pays et acceptation des conditions', async () => {
    const p = profile();
    const c = new h.Client(base);
    const { state } = await start(c);
    const back = await callback(c, google.grant(p), state);
    assert.equal(back.to, '/inscription/google');
    assert.equal((await c.get('/auth/me')).body, null, 'pas encore de session');
    assert.deepEqual((await c.get('/auth/google/en-attente')).body, { name: 'Awa Diop', email: p.email });

    assert.equal((await c.post('/auth/google/finaliser', { country: 'Sénégal' })).status, 400, 'conditions obligatoires');
    assert.equal((await c.post('/auth/google/finaliser', { country: '', acceptTerms: true })).status, 400, 'pays obligatoire');

    const done = await c.post('/auth/google/finaliser', { country: 'Sénégal', acceptTerms: true });
    assert.equal(done.status, 201);
    assert.equal(done.body.name, 'Awa Diop');
    assert.equal(done.body.role, 'developpeur');
    assert.equal(done.body.email, p.email);
    assert.equal(done.body.hasPassword, false);
    assert.equal(done.body.googleLinked, true);
    assert.equal(done.body.githubVerified, false, 'Google ne donne pas le badge GitHub');
    assert.ok(!JSON.stringify(done.body).includes('password_hash') && !('passwordHash' in done.body));
    assert.equal((await c.get('/auth/me')).body.id, done.body.id, 'session ouverte');
    assert.equal((await c.get('/auth/google/en-attente')).status, 404, 'demande consommée');
  });

  it('connexions suivantes : le compte relié s’ouvre directement', async () => {
    const { profile: p, res } = await signUpWithGoogle();
    const again = new h.Client(base);
    const { state } = await start(again);
    const back = await callback(again, google.grant(p), state);
    assert.equal(back.to, '/connexion?google=ok');
    assert.equal((await again.get('/auth/me')).body.id, res.body.id);
  });

  it('un nom absent donne un nom construit sur l’adresse e-mail', async () => {
    const r = await signUpWithGoogle(profile({ name: '' }));
    assert.equal(r.res.status, 201);
    assert.ok(r.res.body.name.length >= 2);
  });

  it('deux comptes de même nom reçoivent deux noms d’utilisateur différents', async () => {
    const a = await signUpWithGoogle(profile({ name: 'Jumeau Google' }));
    const b = await signUpWithGoogle(profile({ name: 'Jumeau Google' }));
    assert.notEqual(a.res.body.username, b.res.body.username);
  });
});

describe('Connexion avec Google : sécurité', () => {
  it('refuse un « state » faux, absent ou rejoué', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    const code = google.grant(profile());
    assert.match((await callback(c, code, 'x'.repeat(48))).to, /erreur=google_etat/);
    assert.match((await callback(c, code, state)).to, /erreur=google_etat/, 'état à usage unique');
    const stranger = new h.Client(base);
    assert.match((await callback(stranger, google.grant(profile()), state)).to, /erreur=google_etat/);
    assert.equal((await stranger.get('/auth/me')).body, null);
  });

  it('refuse un cookie d’état ou d’inscription falsifié', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    c.cookies.set('gamelia_oauth_google', encodeURIComponent(JSON.stringify({ state, mode: 'connexion' })));
    assert.match((await callback(c, google.grant(profile()), state)).to, /erreur=google_etat/);
    const d = new h.Client(base);
    d.cookies.set('gamelia_oauth_google_new', encodeURIComponent(JSON.stringify({ sub: '1', email: 'pirate@mail.test', name: 'P' })));
    assert.equal((await d.get('/auth/google/en-attente')).status, 404);
    assert.equal((await d.post('/auth/google/finaliser', { country: 'Sénégal', acceptTerms: true })).status, 400);
  });

  it('un code refusé donne une erreur, pas un plantage', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, 'code_inconnu', state)).to, /erreur=google_echec/);
  });

  it('le refus du membre sur la page de Google revient proprement à la connexion', async () => {
    const c = new h.Client(base);
    await start(c);
    const r = await c.get('/auth/google/callback?error=access_denied', manual);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=google_refuse$/);
  });

  it('une adresse e-mail déjà inscrite n’est JAMAIS reliée automatiquement à un compte Google', async () => {
    const victim = await h.register(base, { name: 'Victime Réelle' });
    const p = profile({ email: victim.email });
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, google.grant(p), state)).to, /erreur=google_email_existe/);
    assert.equal((await c.get('/auth/me')).body, null);
    const { query } = require('../src/db/pool');
    assert.equal((await query('SELECT google_id FROM users WHERE email = $1', [victim.email])).rows[0].google_id, null);
  });

  it('refuse une adresse e-mail non vérifiée par Google', async () => {
    const p = profile({ email_verified: false });
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, google.grant(p), state)).to, /erreur=google_email/);
    assert.equal((await c.get('/auth/google/en-attente')).status, 404);
  });

  it('un compte Google ne crée pas deux comptes (inscription simultanée)', async () => {
    const p = profile();
    const a = new h.Client(base);
    const b = new h.Client(base);
    await callback(a, google.grant(p), (await start(a)).state);
    await callback(b, google.grant(p), (await start(b)).state);
    assert.equal((await a.post('/auth/google/finaliser', { country: 'Sénégal', acceptTerms: true })).status, 201);
    assert.equal((await b.post('/auth/google/finaliser', { country: 'Sénégal', acceptTerms: true })).status, 409);
  });

  it('un recruteur non validé relié à Google ne peut pas se connecter', async () => {
    const rec = await h.register(base, { role: 'recruteur', name: 'Recruteur Google', company: 'Entreprise Test' });
    assert.equal(rec.res.status, 201);
    const { query } = require('../src/db/pool');
    const p = profile();
    await query('UPDATE users SET google_id = $2 WHERE email = $1', [rec.email, p.sub]);
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, google.grant(p), state)).to, /erreur=recruteur_non_valide/);
    assert.equal((await c.get('/auth/me')).body, null);
  });
});

describe('Connexion avec Google : relier un compte existant', () => {
  it('un membre connecté relie son compte Google, puis se connecte avec', async () => {
    const m = await h.register(base, { name: 'Membre Lié' });
    assert.equal(m.user.googleLinked, false);
    const { state } = await start(m.client, 'lier');
    const p = profile();
    assert.equal((await callback(m.client, google.grant(p), state)).to, '/parametres?google=ok');
    const me = await m.client.get('/auth/me');
    assert.equal(me.body.googleLinked, true);
    assert.equal(me.body.hasPassword, true, 'son mot de passe reste valable');
    const other = new h.Client(base);
    assert.equal((await callback(other, google.grant(p), (await start(other)).state)).to, '/connexion?google=ok');
    assert.equal((await other.get('/auth/me')).body.id, me.body.id);
  });

  it('« lier » exige d’être connecté', async () => {
    const r = await new h.Client(base).get('/auth/google/start?mode=lier', manual);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=session$/);
  });

  it('un compte Google déjà relié à un autre membre ne peut pas l’être deux fois', async () => {
    const first = await h.register(base, { name: 'Premier' });
    const second = await h.register(base, { name: 'Second' });
    const p = profile();
    await callback(first.client, google.grant(p), (await start(first.client, 'lier')).state);
    const back = await callback(second.client, google.grant(p), (await start(second.client, 'lier')).state);
    assert.equal(back.to, '/parametres?google=google_deja_lie');
    assert.equal((await second.client.get('/auth/me')).body.googleLinked, false);
  });

  it('le retour d’un autre membre connecté n’est pas accepté (état volé)', async () => {
    const a = await h.register(base, { name: 'Alice' });
    const b = await h.register(base, { name: 'Bob' });
    const { state } = await start(a.client, 'lier');
    b.client.cookies.set('gamelia_oauth_google', a.client.cookies.get('gamelia_oauth_google'));
    assert.match((await callback(b.client, google.grant(profile()), state)).to, /erreur=session/);
    assert.equal((await b.client.get('/auth/me')).body.googleLinked, false);
  });
});

describe('Compte créé avec Google : mot de passe et suppression', () => {
  it('peut définir un mot de passe sans « mot de passe actuel », puis se connecter par e-mail', async () => {
    const { client, res } = await signUpWithGoogle();
    assert.equal((await new h.Client(base).post('/auth/connexion', { email: res.body.email, password: 'MotDePasse-Test1' })).status, 400);
    assert.equal((await client.post('/moi/mot-de-passe', { next: 'Nouveau-Mot-De-Passe-1' })).status, 204);
    assert.equal((await new h.Client(base).post('/auth/connexion', { email: res.body.email, password: 'Nouveau-Mot-De-Passe-1' })).status, 200);
  });

  it('peut supprimer son compte en retapant son nom d’utilisateur', async () => {
    const { client, res } = await signUpWithGoogle();
    assert.equal((await client.del('/moi', {})).status, 400);
    assert.equal((await client.del('/moi', { confirm: res.body.username })).status, 204);
    assert.equal((await client.get('/auth/me')).body, null);
  });
});
