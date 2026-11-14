// Mot de passe oublié par e-mail + e-mails de bienvenue à l'inscription.
// Faux serveur SMTP local : aucun vrai e-mail n'est envoyé.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { query } = require('../src/db/pool');

let smtp;
let srv;
let srvNoMail;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  smtp = await h.startFakeSmtp();
  const common = { AUTH_RATE_LIMIT_MAX: '1000', MAIL_RETRY_DELAY_MS: '100' };
  srv = await h.startServer(4108, {
    ...common,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    MAIL_FROM: 'Gamelia <no-reply@gamelia.test>',
    FRONT_ORIGIN: 'https://gamelia.test',
  });
  srvNoMail = await h.startServer(4109, { ...common, SMTP_HOST: '', MAIL_FROM: '' });
});
after(async () => {
  srv?.stop();
  srvNoMail?.stop();
  smtp?.stop();
  await h.cleanup();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mailsTo = (email) => smtp.messages.filter((m) => (m.to || '').toLowerCase().includes(email.toLowerCase()));
async function waitSubject(email, re, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = mailsTo(email).find((x) => re.test(x.subject));
    if (m) return m;
    await sleep(50);
  }
  return null;
}
const tokenOf = (m) => /token=([A-Za-z0-9_-]+)/.exec(m.text)?.[1];

async function devWithAccount() {
  const acc = await h.register(srv.base, { name: 'Moussa Keïta' });
  assert.equal(acc.res.status, 201);
  return acc;
}

describe('e-mails de bienvenue', () => {
  it('un développeur qui s’inscrit reçoit un e-mail de bienvenue', async () => {
    const acc = await devWithAccount();
    const m = await waitSubject(acc.email, /Bienvenue/);
    assert.ok(m, 'e-mail de bienvenue attendu');
    assert.match(m.text, /Moussa Keïta/);
    assert.match(m.text, /https:\/\/gamelia\.test\/connexion/);
  });

  it('un recruteur qui s’inscrit reçoit un accusé de réception (compte en attente), sans lien de connexion', async () => {
    const rec = await h.register(srv.base, { role: 'recruteur', company: 'Baobab SARL' });
    assert.equal(rec.res.status, 201);
    const m = await waitSubject(rec.email, /bien reçue/);
    assert.ok(m, 'accusé de réception attendu');
    assert.match(m.text, /Baobab SARL/);
    assert.match(m.text, /ne pouvez pas encore vous connecter/);
    assert.doesNotMatch(m.text, /gamelia\.test\/connexion/);
  });

  it('une inscription refusée (adresse déjà utilisée) n’envoie aucun e-mail', async () => {
    const acc = await devWithAccount();
    await waitSubject(acc.email, /Bienvenue/);
    const before = mailsTo(acc.email).length;
    const c = new h.Client(srv.base);
    const r = await c.post('/auth/inscription', { role: 'developpeur', name: 'Autre Personne', email: acc.email, password: h.PASSWORD, country: 'Togo', acceptTerms: true });
    assert.equal(r.status, 409);
    await sleep(400);
    assert.equal(mailsTo(acc.email).length, before);
  });
});

describe('mot de passe oublié', () => {
  it('l’état indique si la fonction est disponible (SMTP configuré ou non)', async () => {
    assert.deepEqual((await new h.Client(srv.base).get('/auth/mot-de-passe-oublie/etat')).body, { enabled: true });
    assert.deepEqual((await new h.Client(srvNoMail.base).get('/auth/mot-de-passe-oublie/etat')).body, { enabled: false });
  });

  it('sans SMTP, la demande est refusée avec un message clair (le front renvoie vers l’équipe)', async () => {
    const r = await new h.Client(srvNoMail.base).post('/auth/mot-de-passe-oublie', { email: 'quelquun@test.gamelia' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'email_indisponible');
  });

  it('adresse mal formée : 400', async () => {
    const r = await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: 'pas-une-adresse' });
    assert.equal(r.status, 400);
  });

  it('adresse inconnue : même réponse que pour un compte réel, et aucun e-mail', async () => {
    const c = new h.Client(srv.base);
    const known = await devWithAccount();
    const rKnown = await c.post('/auth/mot-de-passe-oublie', { email: known.email });
    const rUnknown = await c.post('/auth/mot-de-passe-oublie', { email: `inconnu-${Date.now()}@test.gamelia` });
    assert.equal(rKnown.status, rUnknown.status);
    assert.deepEqual(rKnown.body, rUnknown.body);
    await sleep(500);
    assert.equal(smtp.messages.filter((m) => /inconnu-/.test(m.to || '')).length, 0);
  });

  it('parcours complet : e-mail, nouveau mot de passe, connexion, anciennes sessions fermées, confirmation', async () => {
    const acc = await devWithAccount();
    const stillLogged = acc.client; // session ouverte à l'inscription
    assert.ok((await stillLogged.get('/auth/me')).body, 'session ouverte au départ');

    assert.equal((await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: acc.email })).status, 202);
    const mail = await waitSubject(acc.email, /Réinitialisation/);
    assert.ok(mail, 'e-mail de réinitialisation attendu');
    const token = tokenOf(mail);
    assert.ok(token && token.length >= 40);
    assert.match(mail.text, /https:\/\/gamelia\.test\/reinitialiser-mot-de-passe\?token=/);
    assert.match(mail.text, /60 minutes/);

    // Le jeton n'est stocké nulle part en clair.
    const raw = await query('SELECT count(*)::int AS n FROM password_reset_tokens WHERE token_hash = $1', [token]);
    assert.equal(raw.rows[0].n, 0);

    const c = new h.Client(srv.base);
    const NEW = 'Nouveau-Secret-42!';
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token, password: NEW })).status, 204);

    assert.equal((await new h.Client(srv.base).post('/auth/connexion', { email: acc.email, password: h.PASSWORD })).status, 400, 'ancien mot de passe refusé');
    assert.equal((await new h.Client(srv.base).post('/auth/connexion', { email: acc.email, password: NEW })).status, 200, 'nouveau mot de passe accepté');
    assert.equal((await stillLogged.get('/auth/me')).body, null, 'l’ancienne session doit être fermée');
    assert.ok(await waitSubject(acc.email, /a été modifié/), 'e-mail de confirmation attendu');
  });

  it('le lien ne sert qu’une fois', async () => {
    const acc = await devWithAccount();
    await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: acc.email });
    const token = tokenOf(await waitSubject(acc.email, /Réinitialisation/));
    const c = new h.Client(srv.base);
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token, password: 'Premier-Choix-1' })).status, 204);
    const again = await c.post('/auth/reinitialiser-mot-de-passe', { token, password: 'Second-Choix-22' });
    assert.equal(again.status, 400);
    assert.equal(again.body.code, 'lien_invalide');
    assert.equal((await new h.Client(srv.base).post('/auth/connexion', { email: acc.email, password: 'Premier-Choix-1' })).status, 200);
  });

  it('un lien expiré est refusé', async () => {
    const acc = await devWithAccount();
    await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: acc.email });
    const token = tokenOf(await waitSubject(acc.email, /Réinitialisation/));
    await query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [acc.email]);
    const r = await new h.Client(srv.base).post('/auth/reinitialiser-mot-de-passe', { token, password: 'Peu-Importe-123' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'lien_invalide');
    assert.equal((await new h.Client(srv.base).post('/auth/connexion', { email: acc.email, password: h.PASSWORD })).status, 200, 'le mot de passe n’a pas changé');
  });

  it('un jeton inventé est refusé', async () => {
    const r = await new h.Client(srv.base).post('/auth/reinitialiser-mot-de-passe', { token: 'a'.repeat(43), password: 'Peu-Importe-123' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'lien_invalide');
  });

  it('un mot de passe trop court est refusé sans consommer le lien', async () => {
    const acc = await devWithAccount();
    await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: acc.email });
    const token = tokenOf(await waitSubject(acc.email, /Réinitialisation/));
    const c = new h.Client(srv.base);
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token, password: 'court' })).status, 400);
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token, password: 'Assez-Long-123' })).status, 204, 'le lien doit rester utilisable');
  });

  it('une nouvelle demande annule le lien précédent', async () => {
    const acc = await devWithAccount();
    const c = new h.Client(srv.base);
    await c.post('/auth/mot-de-passe-oublie', { email: acc.email });
    const first = tokenOf(await waitSubject(acc.email, /Réinitialisation/));
    smtp.messages.splice(0, smtp.messages.length, ...smtp.messages.filter((m) => !(m.to || '').includes(acc.email) || !/Réinitialisation/.test(m.subject)));
    await c.post('/auth/mot-de-passe-oublie', { email: acc.email });
    const second = tokenOf(await waitSubject(acc.email, /Réinitialisation/));
    assert.notEqual(first, second);
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token: first, password: 'Ancien-Lien-123' })).status, 400);
    assert.equal((await c.post('/auth/reinitialiser-mot-de-passe', { token: second, password: 'Nouveau-Lien-123' })).status, 204);
  });

  it('limite à 3 e-mails par heure et par compte', async () => {
    const acc = await devWithAccount();
    const c = new h.Client(srv.base);
    for (let i = 0; i < 5; i++) {
      await c.post('/auth/mot-de-passe-oublie', { email: acc.email });
      await sleep(250);
    }
    await sleep(800);
    assert.equal(mailsTo(acc.email).filter((m) => /Réinitialisation/.test(m.subject)).length, 3);
  });

  it('l’adresse saisie est normalisée (majuscules, espaces autour)', async () => {
    const acc = await devWithAccount();
    await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: `  ${acc.email.toUpperCase()} ` });
    assert.ok(await waitSubject(acc.email, /Réinitialisation/));
  });

  it('un recruteur en attente peut changer son mot de passe mais reste bloqué à la connexion', async () => {
    const rec = await h.register(srv.base, { role: 'recruteur', company: 'Test SARL' });
    await new h.Client(srv.base).post('/auth/mot-de-passe-oublie', { email: rec.email });
    const token = tokenOf(await waitSubject(rec.email, /Réinitialisation/));
    assert.equal((await new h.Client(srv.base).post('/auth/reinitialiser-mot-de-passe', { token, password: 'Recruteur-Nouveau-1' })).status, 204);
    const login = await new h.Client(srv.base).post('/auth/connexion', { email: rec.email, password: 'Recruteur-Nouveau-1' });
    assert.equal(login.status, 403);
    assert.equal(login.body.code, 'recruteur_non_valide');
  });
});
