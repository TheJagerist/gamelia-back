// Authentification, session, CSRF, rôles, validation des entrées, limitation de débit.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
let base;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  srv = await h.startServer(4101, { AUTH_RATE_LIMIT_MAX: '1000' });
  base = srv.base;
});
after(async () => {
  srv?.stop();
  await h.cleanup();
});

describe('Inscription et connexion', () => {
  it('GET /sante répond', async () => {
    const r = await new h.Client(base).get('/sante');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
  });

  it('inscrit un développeur, ouvre une session et renvoie un User complet sans secret', async () => {
    const { client, res, email } = await h.register(base, { name: 'Awa Test' });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'developpeur');
    assert.equal(res.body.email, email);
    assert.equal(res.body.points, 0);
    assert.deepEqual(res.body.links, []);
    assert.deepEqual(res.body.following, []);
    assert.ok(res.body.joinedAt);
    assert.equal(JSON.stringify(res.body).includes('password'), false);
    assert.ok(client.cookies.get('gamelia_session'), 'cookie de session posé');
    assert.ok(client.cookies.get('gamelia_csrf'), 'cookie CSRF posé');
  });

  it('refuse un e-mail déjà utilisé (409)', async () => {
    const { email } = await h.register(base);
    const r = await new h.Client(base).post('/auth/inscription', { role: 'developpeur', name: 'Doublon', email, password: h.PASSWORD, country: 'Sénégal' });
    assert.equal(r.status, 409);
    assert.ok(r.body.message);
  });

  it('valide les champs : nom, e-mail, mot de passe, rôle (400 avec fields)', async () => {
    const r = await new h.Client(base).post('/auth/inscription', { role: 'developpeur', name: 'A', email: 'pas-un-email', password: '123', country: 'Sénégal' });
    assert.equal(r.status, 400);
    assert.ok(r.body.fields.name && r.body.fields.email && r.body.fields.password);
    const admin = await new h.Client(base).post('/auth/inscription', { role: 'admin', name: 'Pirate', email: `p${h.TEST_DOMAIN}`, password: h.PASSWORD, country: 'Sénégal' });
    assert.equal(admin.status, 400, "on ne peut pas s'inscrire comme admin");
  });

  it('exige le nom de l’entreprise pour un recruteur', async () => {
    const r = await new h.Client(base).post('/auth/inscription', { role: 'recruteur', name: 'Rec Test', email: `rec-sans-ent${h.TEST_DOMAIN}`, password: h.PASSWORD, country: 'Sénégal' });
    assert.equal(r.status, 400);
    assert.ok(r.body.fields.company);
  });

  it('connecte avec les bons identifiants, refuse les mauvais avec un message générique', async () => {
    const { email } = await h.register(base);
    const bad = await new h.Client(base).post('/auth/connexion', { email, password: 'mauvais-mot-de-passe' });
    assert.equal(bad.status, 400);
    const unknown = await new h.Client(base).post('/auth/connexion', { email: `inconnu${h.TEST_DOMAIN}`, password: 'peu-importe-123' });
    assert.equal(unknown.status, 400);
    assert.equal(bad.body.message, unknown.body.message, "ne révèle pas si l'e-mail existe");
    const ok = await new h.Client(base).post('/auth/connexion', { email: email.toUpperCase(), password: h.PASSWORD });
    assert.equal(ok.status, 200, 'e-mail insensible à la casse');
  });

  it('GET /auth/me : User si connecté, null sinon ; déconnexion invalide la session', async () => {
    const { client } = await h.register(base);
    const me = await client.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'developpeur');
    const out = await client.post('/auth/deconnexion');
    assert.equal(out.status, 204);
    assert.equal((await client.get('/auth/me')).body, null);
    assert.equal((await new h.Client(base).get('/auth/me')).body, null);
  });

  it('un cookie de session falsifié est ignoré', async () => {
    const c = new h.Client(base);
    c.cookies.set('gamelia_session', '00000000-0000-4000-8000-000000000000');
    assert.equal((await c.get('/auth/me')).body, null);
  });
});

describe('Protection CSRF', () => {
  it('refuse une écriture authentifiée sans jeton CSRF, ou avec un faux jeton (403)', async () => {
    const { client } = await h.register(base);
    const sans = await client.post('/questions', { title: 'Un titre assez long ?', body: 'Un corps de question assez long.', tags: ['Git'] }, { csrf: false });
    assert.equal(sans.status, 403);
    const faux = await client.post('/questions', { title: 'Un titre assez long ?', body: 'Un corps de question assez long.', tags: ['Git'] }, { csrf: false, headers: { 'X-CSRF-Token': 'faux-jeton' } });
    assert.equal(faux.status, 403);
    const bon = await client.post('/questions', { title: 'Un titre assez long ?', body: 'Un corps de question assez long.', tags: ['Git'] });
    assert.equal(bon.status, 201);
  });

  it('n’accepte pas le jeton CSRF d’une autre session', async () => {
    const a = await h.register(base);
    const b = await h.register(base);
    const r = await a.client.post('/questions', { title: 'Un titre assez long ?', body: 'Un corps de question assez long.', tags: ['Git'] }, { csrf: false, headers: { 'X-CSRF-Token': b.client.cookies.get('gamelia_csrf') } });
    assert.equal(r.status, 403);
  });
});

describe('Rôles et accès', () => {
  it('401 sans session sur les routes protégées', async () => {
    const c = new h.Client(base);
    for (const [m, url] of [['POST', '/questions'], ['GET', '/moi/progression'], ['GET', '/notifications'], ['POST', '/signalements'], ['GET', '/recruteur/defis'], ['GET', '/admin/compteurs'], ['GET', '/defis-recruteurs']]) {
      const r = await c.req(m, url, m === 'POST' ? {} : undefined);
      assert.equal(r.status, 401, `${m} ${url}`);
    }
  });

  it('403 pour un développeur sur les espaces recruteur et admin', async () => {
    const { client } = await h.register(base);
    assert.equal((await client.get('/recruteur/defis')).status, 403);
    assert.equal((await client.get('/admin/compteurs')).status, 403);
    assert.equal((await client.get('/admin/signalements')).status, 403);
  });

  it('un recruteur non validé ne peut pas se connecter (403 recruteur_non_valide) puis le peut une fois validé', async () => {
    const rec = await h.register(base, { role: 'recruteur', company: 'Acme Test' });
    assert.equal(rec.res.status, 201);
    assert.deepEqual(rec.res.body, { pending: true });
    assert.equal(rec.client.cookies.size, 0, 'aucune session ouverte avant validation');
    const login = await new h.Client(base).post('/auth/connexion', { email: rec.email, password: h.PASSWORD });
    assert.equal(login.status, 403);
    assert.equal(login.body.code, 'recruteur_non_valide');

    const admin = await h.createAdmin(base);
    const pending = await admin.get('/admin/recruteurs');
    const entry = pending.body.find((u) => u.email === rec.email);
    assert.ok(entry, "l'admin voit la demande");
    assert.equal(entry.recruiterStatus, 'en_attente');
    assert.equal((await admin.post(`/admin/recruteurs/${entry.id}`, { approve: true })).status, 204);
    assert.equal((await new h.Client(base).post('/auth/connexion', { email: rec.email, password: h.PASSWORD })).status, 200);
  });
});

describe('Compte : profil, mot de passe, suppression', () => {
  it('met à jour le profil et remplace les liens ; la bio est limitée à 280 caractères', async () => {
    const { client } = await h.register(base);
    const bad = await client.patch('/moi', { bio: 'x'.repeat(281) });
    assert.equal(bad.status, 400);
    const r = await client.patch('/moi', { bio: 'Développeuse.', city: 'Dakar', skills: ['Node.js'], links: [{ kind: 'github', label: 'GitHub', url: 'https://github.com/test' }], following: ['Git'] });
    assert.equal(r.status, 200);
    assert.equal(r.body.city, 'Dakar');
    assert.equal(r.body.links.length, 1);
    assert.deepEqual(r.body.following, ['Git']);
    const again = await client.patch('/moi', { links: [] });
    assert.deepEqual(again.body.links, []);
    assert.equal(again.body.city, 'Dakar', 'PATCH ne touche que les champs fournis');
  });

  it('GitHub confirmé : badge « compte vérifié »', async () => {
    const { client } = await h.register(base);
    const r = await client.post('/moi/github');
    assert.equal(r.body.githubVerified, true);
    const p = await client.get('/moi/progression');
    assert.ok(p.body.badges.some((b) => b.id === 'b8'));
  });

  it('change le mot de passe (vérifie l’ancien) puis supprime le compte (vérifie le mot de passe)', async () => {
    const { client, email } = await h.register(base);
    assert.equal((await client.post('/moi/mot-de-passe', { current: 'faux-actuel-123', next: 'NouveauMotDePasse-9' })).status, 400);
    assert.equal((await client.post('/moi/mot-de-passe', { current: h.PASSWORD, next: 'court' })).status, 400);
    assert.equal((await client.post('/moi/mot-de-passe', { current: h.PASSWORD, next: 'NouveauMotDePasse-9' })).status, 204);
    assert.equal((await new h.Client(base).post('/auth/connexion', { email, password: h.PASSWORD })).status, 400);
    assert.equal((await new h.Client(base).post('/auth/connexion', { email, password: 'NouveauMotDePasse-9' })).status, 200);

    assert.equal((await client.del('/moi', { password: 'mauvais-mot-de-passe' })).status, 400);
    assert.equal((await client.del('/moi', { password: 'NouveauMotDePasse-9' })).status, 204);
    assert.equal((await new h.Client(base).post('/auth/connexion', { email, password: 'NouveauMotDePasse-9' })).status, 400);
  });

  it('un admin ne peut pas supprimer son compte depuis l’interface (403)', async () => {
    const admin = await h.createAdmin(base);
    assert.equal((await admin.del('/moi', { password: h.PASSWORD })).status, 403);
  });
});

describe('Robustesse', () => {
  it('un JSON invalide renvoie 400 (pas 500)', async () => {
    const r = await new h.Client(base).post('/auth/connexion', '{pas du json');
    assert.equal(r.status, 400);
    assert.ok(r.body.message);
  });

  it('un identifiant mal formé dans l’URL renvoie 404 (pas 500)', async () => {
    const { client } = await h.register(base);
    for (const url of ['/questions/abc', '/projets/pas-un-uuid', '/defis-recruteurs/123']) {
      const r = await client.get(url);
      assert.equal(r.status, 404, url);
      assert.ok(r.body.message);
    }
    assert.equal((await client.post('/questions/abc/reponses', { body: 'Une réponse assez longue.' })).status, 404);
  });

  it('une route inconnue renvoie 404 au format {message}', async () => {
    const r = await new h.Client(base).get('/route-inconnue');
    assert.equal(r.status, 404);
    assert.ok(r.body.message);
  });

  it('CORS : seule l’origine du front est autorisée, avec les cookies', async () => {
    const ok = await fetch(`${base}/sante`, { headers: { Origin: process.env.FRONT_ORIGIN } });
    assert.equal(ok.headers.get('access-control-allow-origin'), process.env.FRONT_ORIGIN);
    assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
    const other = await fetch(`${base}/sante`, { headers: { Origin: 'https://site-pirate.example' } });
    assert.notEqual(other.headers.get('access-control-allow-origin'), 'https://site-pirate.example');
    assert.notEqual(ok.headers.get('access-control-allow-origin'), '*');
  });
});

describe('Limitation de débit sur /auth', () => {
  it('renvoie 429 après 10 tentatives par minute (réglage de production)', async () => {
    const limited = await h.startServer(4102); // AUTH_RATE_LIMIT_MAX par défaut = 10
    try {
      const c = new h.Client(limited.base);
      const codes = [];
      for (let i = 0; i < 12; i++) codes.push((await c.post('/auth/connexion', { email: `x${i}${h.TEST_DOMAIN}`, password: 'mot-de-passe-faux' })).status);
      assert.equal(codes.slice(0, 10).every((s) => s === 400), true, `10 premières tentatives acceptées : ${codes}`);
      assert.equal(codes[10], 429);
      const r = await c.post('/auth/connexion', { email: `y${h.TEST_DOMAIN}`, password: 'mot-de-passe-faux' });
      assert.equal(r.status, 429);
      assert.ok(r.body.message);
    } finally {
      limited.stop();
    }
  });
});
