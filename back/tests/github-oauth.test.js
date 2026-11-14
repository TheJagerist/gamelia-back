// Connexion avec GitHub (OAuth) : un faux GitHub joue le rôle de github.com et d'api.github.com.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
let srvOff;
let base;
let github;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  github = await h.startFakeGithub();
  srv = await h.startServer(4108, {
    AUTH_RATE_LIMIT_MAX: '1000',
    GITHUB_API_URL: github.url,
    GITHUB_OAUTH_URL: github.url,
    GITHUB_CLIENT_ID: h.OAUTH_CLIENT.id,
    GITHUB_CLIENT_SECRET: h.OAUTH_CLIENT.secret,
    GITHUB_CALLBACK_URL: 'https://site.test/api/auth/github/callback',
  });
  srvOff = await h.startServer(4109, { AUTH_RATE_LIMIT_MAX: '1000', GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '' });
  base = srv.base;
});
after(async () => {
  srv?.stop();
  srvOff?.stop();
  github?.stop();
  await h.cleanup();
});

let n = 0;
const nextId = () => Date.now() * 100 + ++n; // unique d'un run à l'autre : la base de test n'est pas vidée
const manual = { redirect: 'manual' };

/** Démarre le flux : renvoie l'état que GitHub recevrait, et garde le cookie signé dans le client. */
async function start(client, mode) {
  const r = await client.get(`/auth/github/start${mode ? `?mode=${mode}` : ''}`, manual);
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  return { loc, state: loc.searchParams.get('state') };
}
/** Retour de GitHub : le navigateur est renvoyé vers /auth/github/callback?code=…&state=… */
async function callback(client, code, state) {
  const r = await client.get(`/auth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, manual);
  return { status: r.status, to: new URL(r.headers.get('location') || 'http://x/').pathname + new URL(r.headers.get('location') || 'http://x/').search };
}
const profile = (extra = {}) => {
  const id = nextId();
  const login = `octo-${id}`;
  return { id, login, name: 'Awa Diop', emails: [{ email: `${login}@mail.test`, primary: true, verified: true }], ...extra };
};
/** Inscription complète avec GitHub : renvoie le client connecté et le compte créé. */
async function signUpWithGithub(p = profile(), country = 'Sénégal') {
  const c = new h.Client(base);
  const { state } = await start(c);
  const back = await callback(c, github.grant(p), state);
  assert.equal(back.to, '/inscription/github');
  const done = await c.post('/auth/github/finaliser', { country, acceptTerms: true });
  return { client: c, profile: p, res: done };
}

describe('Connexion avec GitHub : configuration', () => {
  it('/auth/github/etat indique si GitHub est configuré', async () => {
    assert.deepEqual((await new h.Client(base).get('/auth/github/etat')).body, { enabled: true });
    assert.deepEqual((await new h.Client(srvOff.base).get('/auth/github/etat')).body, { enabled: false });
  });

  it('sans configuration, /start renvoie vers la page de connexion avec une erreur, sans rien casser', async () => {
    const r = await new h.Client(srvOff.base).get('/auth/github/start', manual);
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=github_indisponible$/);
  });

  it('/start redirige vers GitHub avec l’identifiant, l’adresse de retour, l’état et les droits minimaux', async () => {
    const c = new h.Client(base);
    const { loc } = await start(c);
    assert.equal(loc.origin + loc.pathname, `${github.url}/login/oauth/authorize`);
    assert.equal(loc.searchParams.get('client_id'), h.OAUTH_CLIENT.id);
    assert.equal(loc.searchParams.get('redirect_uri'), 'https://site.test/api/auth/github/callback');
    assert.equal(loc.searchParams.get('scope'), 'read:user user:email');
    assert.match(loc.searchParams.get('state'), /^[0-9a-f]{48}$/);
    assert.ok(c.cookies.has('gamelia_oauth'), 'cookie d’état posé');
  });
});

describe('Connexion avec GitHub : inscription et connexion', () => {
  it('première connexion : création du compte après choix du pays et acceptation des conditions', async () => {
    const p = profile({ name: 'Awa Diop' });
    const c = new h.Client(base);
    const { state } = await start(c);
    const back = await callback(c, github.grant(p), state);
    assert.equal(back.status, 302);
    assert.equal(back.to, '/inscription/github');
    assert.equal((await c.get('/auth/me')).body, null, 'pas encore de session : le compte n’existe pas');

    const waiting = await c.get('/auth/github/en-attente');
    assert.equal(waiting.status, 200);
    assert.deepEqual(waiting.body, { login: p.login, name: 'Awa Diop', email: `${p.login}@mail.test` });

    assert.equal((await c.post('/auth/github/finaliser', { country: 'Sénégal' })).status, 400, 'conditions obligatoires');
    assert.equal((await c.post('/auth/github/finaliser', { country: '', acceptTerms: true })).status, 400, 'pays obligatoire');

    const done = await c.post('/auth/github/finaliser', { country: 'Sénégal', acceptTerms: true });
    assert.equal(done.status, 201);
    assert.equal(done.body.name, 'Awa Diop');
    assert.equal(done.body.role, 'developpeur');
    assert.equal(done.body.country, 'Sénégal');
    assert.equal(done.body.githubVerified, true, 'GitHub prouve l’identité : badge « compte vérifié »');
    assert.equal(done.body.hasPassword, false);
    assert.equal(done.body.email, `${p.login}@mail.test`);
    assert.ok(!('passwordHash' in done.body) && !JSON.stringify(done.body).includes('password_hash'));

    const me = await c.get('/auth/me');
    assert.equal(me.body.id, done.body.id, 'la session est ouverte');
    assert.equal((await c.get('/auth/github/en-attente')).status, 404, 'la demande est consommée');
    const { query } = require('../src/db/pool');
    const row = (await query('SELECT github_id, github_username, terms_accepted_at, has_password FROM users WHERE id = $1', [done.body.id])).rows[0];
    assert.equal(Number(row.github_id), p.id);
    assert.equal(row.github_username, p.login);
    assert.ok(row.terms_accepted_at, 'acceptation des conditions enregistrée');
  });

  it('connexions suivantes : le compte relié s’ouvre directement, sans nouvelle inscription', async () => {
    const { profile: p, res: created } = await signUpWithGithub();
    const again = new h.Client(base);
    const { state } = await start(again);
    const back = await callback(again, github.grant(p), state);
    assert.equal(back.to, '/connexion?github=ok');
    const me = await again.get('/auth/me');
    assert.equal(me.body.id, created.body.id);
  });

  it('le nom d’utilisateur vient du login GitHub et reste unique', async () => {
    const tag = Date.now().toString(36);
    const a = await signUpWithGithub(profile({ id: nextId(), login: `dev-twin-${tag}` }));
    const b = await signUpWithGithub(profile({ id: nextId(), login: `Dev_Twin_${tag}` }));
    assert.equal(a.res.status, 201);
    assert.equal(b.res.status, 201);
    assert.notEqual(a.res.body.username, b.res.body.username);
  });

  it('un compte sans nom public prend son login comme nom', async () => {
    const r = await signUpWithGithub(profile({ name: '' }));
    assert.equal(r.res.body.name, r.profile.login);
  });
});

describe('Connexion avec GitHub : sécurité', () => {
  it('refuse un retour avec un « state » faux, absent ou rejoué', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    const code = github.grant(profile());
    assert.match((await callback(c, code, 'x'.repeat(48))).to, /erreur=github_etat/);
    // L'état est à usage unique : même le bon « state » ne marche plus après un essai.
    assert.match((await callback(c, code, state)).to, /erreur=github_etat/);
    // Sans cookie d'état (retour forgé depuis un autre navigateur).
    const stranger = new h.Client(base);
    assert.match((await callback(stranger, github.grant(profile()), state)).to, /erreur=github_etat/);
    assert.equal((await stranger.get('/auth/me')).body, null);
  });

  it('refuse un cookie d’état falsifié', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    c.cookies.set('gamelia_oauth', encodeURIComponent(JSON.stringify({ state, mode: 'connexion' })));
    assert.match((await callback(c, github.grant(profile()), state)).to, /erreur=github_etat/);
  });

  it('refuse un cookie d’inscription en attente falsifié', async () => {
    const c = new h.Client(base);
    c.cookies.set('gamelia_oauth_new', encodeURIComponent(JSON.stringify({ id: 1, login: 'pirate', email: 'pirate@mail.test' })));
    assert.equal((await c.get('/auth/github/en-attente')).status, 404);
    assert.equal((await c.post('/auth/github/finaliser', { country: 'Sénégal', acceptTerms: true })).status, 400);
  });

  it('un code GitHub refusé ou déjà utilisé donne une erreur, pas un plantage', async () => {
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, 'code_inconnu', state)).to, /erreur=github_echec/);
  });

  it('le refus du membre sur la page de GitHub revient proprement à la connexion', async () => {
    const c = new h.Client(base);
    await start(c);
    const r = await c.get('/auth/github/callback?error=access_denied', manual);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=github_refuse$/);
  });

  it('une adresse e-mail déjà inscrite n’est JAMAIS reliée automatiquement à un compte GitHub', async () => {
    const victim = await h.register(base, { name: 'Victime Réelle' });
    const p = profile({ emails: [{ email: victim.email, primary: true, verified: true }] });
    const c = new h.Client(base);
    const { state } = await start(c);
    const back = await callback(c, github.grant(p), state);
    assert.match(back.to, /erreur=github_email_existe/);
    assert.equal((await c.get('/auth/me')).body, null, 'aucune session ouverte');
    const { query } = require('../src/db/pool');
    const row = (await query('SELECT github_id FROM users WHERE email = $1', [victim.email])).rows[0];
    assert.equal(row.github_id, null, 'le compte existant n’a pas été relié');
  });

  it('refuse un compte GitHub sans adresse e-mail vérifiée', async () => {
    const p = profile({ emails: [{ email: 'non-verifiee@mail.test', primary: true, verified: false }] });
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, github.grant(p), state)).to, /erreur=github_email/);
    assert.equal((await c.get('/auth/github/en-attente')).status, 404);
  });

  it('utilise l’adresse vérifiée, pas une adresse non vérifiée placée en premier', async () => {
    const p = profile({
      emails: [
        { email: 'fausse@mail.test', primary: false, verified: false },
        { email: 'vraie@mail.test', primary: false, verified: true },
      ],
    });
    const c = new h.Client(base);
    const { state } = await start(c);
    await callback(c, github.grant(p), state);
    assert.equal((await c.get('/auth/github/en-attente')).body.email, 'vraie@mail.test');
  });

  it('un compte GitHub ne crée pas deux comptes Gamelia (inscription simultanée)', async () => {
    const p = profile();
    const a = new h.Client(base);
    const b = new h.Client(base);
    await callback(a, github.grant(p), (await start(a)).state);
    await callback(b, github.grant(p), (await start(b)).state);
    const ra = await a.post('/auth/github/finaliser', { country: 'Sénégal', acceptTerms: true });
    const rb = await b.post('/auth/github/finaliser', { country: 'Sénégal', acceptTerms: true });
    assert.equal(ra.status, 201);
    assert.equal(rb.status, 409);
  });

  it('un recruteur non validé relié à GitHub ne peut pas se connecter avec GitHub', async () => {
    const rec = await h.register(base, { role: 'recruteur', name: 'Recruteur Test', company: 'Entreprise Test' });
    assert.equal(rec.res.status, 201);
    const { query } = require('../src/db/pool');
    const p = profile();
    await query('UPDATE users SET github_id = $2, github_username = $3 WHERE email = $1', [rec.email, p.id, p.login]);
    const c = new h.Client(base);
    const { state } = await start(c);
    assert.match((await callback(c, github.grant(p), state)).to, /erreur=recruteur_non_valide/);
    assert.equal((await c.get('/auth/me')).body, null);
  });
});

describe('Connexion avec GitHub : relier un compte existant', () => {
  it('un membre connecté relie son compte GitHub et obtient le badge « compte vérifié »', async () => {
    const m = await h.register(base, { name: 'Membre Lié' });
    assert.equal(m.user.githubVerified, false);
    const { loc, state } = await start(m.client, 'lier');
    assert.equal(loc.searchParams.get('scope'), 'read:user', 'droits minimaux : pas besoin de l’e-mail pour relier');
    const p = profile();
    const back = await callback(m.client, github.grant(p), state);
    assert.equal(back.to, '/profil?github=ok');
    const me = await m.client.get('/auth/me');
    assert.equal(me.body.githubVerified, true);
    assert.equal(me.body.hasPassword, true, 'son mot de passe reste valable');
    // Il peut aussi se connecter avec GitHub, depuis un autre navigateur.
    const other = new h.Client(base);
    const again = await callback(other, github.grant(p), (await start(other)).state);
    assert.equal(again.to, '/connexion?github=ok');
    assert.equal((await other.get('/auth/me')).body.id, me.body.id);
  });

  it('« lier » exige d’être connecté', async () => {
    const r = await new h.Client(base).get('/auth/github/start?mode=lier', manual);
    assert.match(r.headers.get('location'), /\/connexion\?erreur=session$/);
  });

  it('un compte GitHub déjà relié à un autre membre ne peut pas l’être une seconde fois', async () => {
    const first = await h.register(base, { name: 'Premier' });
    const second = await h.register(base, { name: 'Second' });
    const p = profile();
    await callback(first.client, github.grant(p), (await start(first.client, 'lier')).state);
    const back = await callback(second.client, github.grant(p), (await start(second.client, 'lier')).state);
    assert.equal(back.to, '/profil?github=github_deja_lie');
    assert.equal((await second.client.get('/auth/me')).body.githubVerified, false);
  });

  it('le retour d’un autre membre connecté n’est pas accepté (état volé)', async () => {
    const a = await h.register(base, { name: 'Alice' });
    const b = await h.register(base, { name: 'Bob' });
    const { state } = await start(a.client, 'lier');
    // Bob rejoue le cookie d'état d'Alice mais reste connecté sous son propre compte.
    b.client.cookies.set('gamelia_oauth', a.client.cookies.get('gamelia_oauth'));
    const back = await callback(b.client, github.grant(profile()), state);
    assert.match(back.to, /erreur=session/);
    assert.equal((await b.client.get('/auth/me')).body.githubVerified, false);
  });
});

describe('Compte créé avec GitHub : mot de passe et suppression', () => {
  it('peut définir un mot de passe sans « mot de passe actuel », puis se connecter par e-mail', async () => {
    const { client, res } = await signUpWithGithub();
    assert.equal(res.body.hasPassword, false);
    const login = await new h.Client(base).post('/auth/connexion', { email: res.body.email, password: 'MotDePasse-Test1' });
    assert.equal(login.status, 400, 'tant qu’aucun mot de passe n’est défini, la connexion par e-mail est impossible');

    assert.equal((await client.post('/moi/mot-de-passe', { next: 'court' })).status, 400, 'mot de passe trop court');
    assert.equal((await client.post('/moi/mot-de-passe', { next: 'Nouveau-Mot-De-Passe-1' })).status, 204);
    assert.equal((await client.get('/auth/me')).body.hasPassword, true);
    const ok = await new h.Client(base).post('/auth/connexion', { email: res.body.email, password: 'Nouveau-Mot-De-Passe-1' });
    assert.equal(ok.status, 200);
    // Une fois défini, changer de mot de passe exige de nouveau l'ancien.
    assert.equal((await client.post('/moi/mot-de-passe', { next: 'Encore-Un-Autre-2' })).status, 400);
    assert.equal((await client.post('/moi/mot-de-passe', { current: 'Nouveau-Mot-De-Passe-1', next: 'Encore-Un-Autre-2' })).status, 204);
  });

  it('un compte avec mot de passe ne peut pas le changer sans l’actuel', async () => {
    const m = await h.register(base, { name: 'Avec Mot De Passe' });
    assert.equal((await m.client.post('/moi/mot-de-passe', { next: 'Nouveau-Mot-De-Passe-1' })).status, 400);
    assert.equal((await m.client.post('/moi/mot-de-passe', { current: 'faux', next: 'Nouveau-Mot-De-Passe-1' })).status, 400);
  });

  it('peut supprimer son compte en retapant son nom d’utilisateur', async () => {
    const { client, res } = await signUpWithGithub();
    assert.equal((await client.del('/moi', {})).status, 400);
    assert.equal((await client.del('/moi', { confirm: 'quelquun-d-autre' })).status, 400);
    assert.equal((await client.del('/moi', { password: 'MotDePasse-Test1' })).status, 400, 'le mot de passe ne sert à rien sans en avoir défini un');
    assert.equal((await client.del('/moi', { confirm: res.body.username.toUpperCase() })).status, 204);
    assert.equal((await client.get('/auth/me')).body, null);
  });

  it('un compte avec mot de passe ne peut pas être supprimé avec « confirm » seul', async () => {
    const m = await h.register(base, { name: 'A Mot De Passe' });
    assert.equal((await m.client.del('/moi', { confirm: m.user.username })).status, 400);
    assert.equal((await m.client.del('/moi', { password: h.PASSWORD })).status, 204);
  });
});
