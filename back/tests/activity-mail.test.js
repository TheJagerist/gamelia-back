// E-mails de suivi d'activité : prévenir un membre hors du site (candidature reçue, retour du recruteur, défi relevé,
// réponse à une question, message privé…). Un faux serveur SMTP local reçoit les messages ; aucun vrai e-mail n'est envoyé.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let smtp;
let srv;
let srvNoMail;
let admin;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  smtp = await h.startFakeSmtp();
  const common = { AUTH_RATE_LIMIT_MAX: '1000', MAIL_RETRY_DELAY_MS: '100' };
  srv = await h.startServer(4110, {
    ...common,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    MAIL_FROM: 'Gamelia <no-reply@gamelia.test>',
    FRONT_ORIGIN: 'https://gamelia.test',
  });
  srvNoMail = await h.startServer(4111, { ...common, SMTP_HOST: '', MAIL_FROM: '' });
  admin = await h.createAdmin(srv.base);
});
after(async () => {
  srv?.stop();
  srvNoMail?.stop();
  smtp?.stop();
  await h.cleanup();
});

const mailsTo = (email) => smtp.messages.filter((m) => (m.to || '').includes(email));
async function waitSubject(email, re, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = mailsTo(email).find((x) => re.test(x.subject));
    if (m) return m;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}
const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

const deadline = (days) => new Date(Date.now() + days * 86400000).toISOString();
const challengeInput = (o = {}) => ({
  title: 'API de paiement mobile',
  summary: 'Construire une API de paiement.',
  brief: 'Concevez une API REST qui gère des paiements Mobile Money avec idempotence, webhooks et tests automatisés.',
  skills: ['Node.js', 'API'],
  country: 'Sénégal',
  remote: true,
  deadline: deadline(20),
  reward: '500 000 FCFA',
  ...o,
});

async function validatedRecruiter(base, adminClient, opts = {}) {
  const rec = await h.register(base, { role: 'recruteur', company: 'Baobab Test', ...opts });
  const entry = (await adminClient.get('/admin/recruteurs')).body.find((u) => u.email === rec.email);
  await adminClient.post(`/admin/recruteurs/${entry.id}`, { approve: true });
  const c = new h.Client(base);
  assert.equal((await c.post('/auth/connexion', { email: rec.email, password: h.PASSWORD })).status, 200);
  return { client: c, email: rec.email, name: rec.user && rec.user.name };
}

describe('Parcours d’un défi recruteur : chaque étape prévient la bonne personne', () => {
  let rec, dev, devMail, cid, appId;

  before(async () => {
    rec = await validatedRecruiter(srv.base, admin, { name: 'Mme Mbuyi' });
    const d = await h.register(srv.base, { name: 'Awa <Dev>' });
    dev = d.client;
    devMail = d.email;
  });

  it('les admins sont prévenus par e-mail quand un recruteur soumet un défi', async () => {
    smtp.clear();
    const r = await rec.client.post('/recruteur/defis', challengeInput());
    assert.equal(r.status, 201);
    cid = r.body.id;
    const adminMail = await (async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const x = smtp.messages.find((y) => /attend votre validation/.test(y.subject));
        if (x) return x;
        await settle(50);
      }
      return null;
    })();
    assert.ok(adminMail, 'un e-mail doit partir vers les administrateurs');
    assert.match(adminMail.text, /API de paiement mobile/);
    assert.match(adminMail.text, /https:\/\/gamelia\.test\/admin\/validations/);
  });

  it('le recruteur reçoit un e-mail quand son défi est publié', async () => {
    assert.equal((await admin.post(`/admin/defis/${cid}`, { approve: true })).status, 204);
    const m = await waitSubject(rec.email, /défi est publié/);
    assert.ok(m);
    assert.match(m.text, /API de paiement mobile/);
    assert.match(m.text, /https:\/\/gamelia\.test\/recruteur\/defis/);
  });

  it('le recruteur est prévenu par e-mail d’une nouvelle candidature (avec le nom du développeur, échappé en HTML)', async () => {
    const ok = await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/test/paiement', message: 'Voici ma solution avec idempotence et webhooks signés.' });
    assert.equal(ok.status, 204);
    const m = await waitSubject(rec.email, /Nouvelle candidature/);
    assert.ok(m, 'e-mail de candidature attendu');
    assert.match(m.text, /Awa <Dev>/);
    assert.ok(!m.html.includes('Awa <Dev>'), 'le nom doit être échappé dans la version HTML');
    assert.match(m.html, /Awa &lt;Dev&gt;/);
    assert.match(m.text, new RegExp(`https://gamelia\\.test/recruteur/defis/${cid}`));
    assert.ok(!/Awa/.test(m.subject), 'aucun nom de membre dans l’objet');
    appId = (await rec.client.get(`/recruteur/defis/${cid}`)).body.applications[0].id;
  });

  it('le développeur reçoit un e-mail quand le recruteur évalue sa candidature', async () => {
    assert.equal((await rec.client.post(`/recruteur/candidatures/${appId}/evaluation`, { score: 5, feedback: 'Excellent travail.' })).status, 204);
    const m = await waitSubject(devMail, /a évalué votre candidature/);
    assert.ok(m);
    assert.match(m.text, /API de paiement mobile/);
    assert.ok(!m.text.includes('Excellent travail'), 'le retour du recruteur reste dans le site');
  });

  it('le développeur reçoit un e-mail de félicitations quand sa candidature est retenue, avec le nom de l’entreprise', async () => {
    assert.equal((await rec.client.post(`/recruteur/candidatures/${appId}/decision`, { retained: true, proposal: 'Nous vous proposons une mission de 3 mois.' })).status, 204);
    const m = await waitSubject(devMail, /candidature est retenue/);
    assert.ok(m);
    assert.match(m.text, /Baobab Test/);
    assert.ok(!m.text.includes('mission de 3 mois'), 'la proposition reste dans le site');
  });

  it('un refus envoie un e-mail bienveillant, et jamais le texte « retenue »', async () => {
    const dev2 = await h.register(srv.base, { name: 'Moussa' });
    await dev2.client.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/test/autre', message: 'Une autre solution tout aussi complète.' });
    const id2 = (await rec.client.get(`/recruteur/defis/${cid}`)).body.applications.find((a) => a.dev.name === 'Moussa').id;
    assert.equal((await rec.client.post(`/recruteur/candidatures/${id2}/decision`, { retained: false })).status, 204);
    const m = await waitSubject(dev2.email, /pas été retenue/);
    assert.ok(m);
    assert.ok(!/est retenue/.test(m.subject));
  });

  it('le contact d’un recruteur prévient le développeur sans recopier le message privé', async () => {
    const target = await h.register(srv.base, { name: 'Fatou' });
    const username = target.user.username;
    const r = await rec.client.post('/recruteur/contacts', { username, message: 'Bonjour, votre profil correspond à notre mission secrète.' });
    assert.equal(r.status, 204);
    const m = await waitSubject(target.email, /recruteur souhaite vous contacter/);
    assert.ok(m);
    assert.match(m.text, /Mme Mbuyi/);
    assert.match(m.text, /Baobab Test/);
    assert.ok(!m.text.includes('mission secrète'));
    await settle();
    assert.equal(mailsTo(target.email).filter((x) => !/Bienvenue/.test(x.subject)).length, 1, 'un seul e-mail de contact (pas de doublon avec le message privé)');
  });
});

describe('Défis de la plateforme : félicitations ou demande de correction', () => {
  it('un défi validé envoie un e-mail de félicitations avec les points ; un refus envoie une demande de correction', async () => {
    const d = await h.register(srv.base, { name: 'Brahim' });
    assert.equal((await d.client.post('/defis/d1/solutions', { codeUrl: 'https://github.com/test/api-taches', note: 'Voici.' })).status, 204);
    const sub = (await admin.get('/admin/solutions')).body.find((s) => s.codeUrl === 'https://github.com/test/api-taches');
    assert.equal((await admin.post(`/admin/solutions/${sub.id}`, { approve: true })).status, 204);
    const m = await waitSubject(d.email, /Bravo/);
    assert.ok(m, 'e-mail de félicitations attendu');
    assert.match(m.text, new RegExp(`${sub.challenge.points} points`));
    assert.match(m.text, /https:\/\/gamelia\.test\/defis\/d1/);

    const d2 = await h.register(srv.base);
    await d2.client.post('/defis/d4/solutions', { codeUrl: 'https://github.com/test/profil', note: 'v1' });
    const sub2 = (await admin.get('/admin/solutions')).body.find((s) => s.codeUrl === 'https://github.com/test/profil');
    assert.equal((await admin.post(`/admin/solutions/${sub2.id}`, { approve: false })).status, 204);
    const r = await waitSubject(d2.email, /doit être revue/);
    assert.ok(r);
    assert.ok(!/Bravo/.test(r.subject));
  });
});

describe('Communauté et messages privés', () => {
  it('une réponse à une question prévient son auteur ; la meilleure réponse prévient le répondant', async () => {
    const asker = await h.register(srv.base, { name: 'Questionneur' });
    const answerer = await h.register(srv.base, { name: 'Répondeur' });
    const q = await asker.client.post('/questions', { title: 'Comment appeler une API avec fetch ?', body: 'Je veux envoyer une requête POST avec un corps JSON depuis le navigateur, comment faire ?', tags: ['JavaScript'] });
    assert.equal(q.status, 201, JSON.stringify(q.body));
    const qid = q.body.id;
    const a = await answerer.client.post(`/questions/${qid}/reponses`, { body: 'Utilisez fetch avec method POST et un en-tête Content-Type JSON.' });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    const m = await waitSubject(asker.email, /a répondu à votre question/);
    assert.ok(m);
    assert.match(m.text, /Répondeur/);
    assert.ok(!m.text.includes('fetch avec method POST'), 'le contenu de la réponse reste dans le site');

    const answerId = a.body.answerId;
    assert.equal((await asker.client.post(`/questions/${qid}/meilleure-reponse`, { answerId })).status, 204);
    assert.ok(await waitSubject(answerer.email, /choisie comme la meilleure/));
  });

  it('un message privé prévient une seule fois tant que la conversation n’est pas lue, sans recopier le message', async () => {
    const a = await h.register(srv.base, { name: 'Alice' });
    const b = await h.register(srv.base, { name: 'Boris' });
    const first = await a.client.post('/messages/conversations', { username: b.user.username, body: 'Texte très privé numéro un.' });
    assert.equal(first.status, 201);
    const convId = first.body.id;
    const m = await waitSubject(b.email, /Nouveau message privé/);
    assert.ok(m);
    assert.match(m.text, /Alice/);
    assert.ok(!m.text.includes('très privé'));
    assert.ok(!m.html.includes('très privé'));

    assert.equal((await a.client.post(`/messages/conversations/${convId}/messages`, { body: 'Deuxième message.' })).status, 201);
    assert.equal((await a.client.post(`/messages/conversations/${convId}/messages`, { body: 'Troisième message.' })).status, 201);
    await settle();
    assert.equal(mailsTo(b.email).filter((x) => /Nouveau message/.test(x.subject)).length, 1, 'un seul e-mail pour une série de messages non lus');

    // Boris lit la conversation, puis Alice écrit de nouveau : un nouvel e-mail est permis.
    assert.equal((await b.client.post(`/messages/conversations/${convId}/lu`)).status, 204);
    assert.equal((await a.client.post(`/messages/conversations/${convId}/messages`, { body: 'Quatrième message.' })).status, 201);
    const t0 = Date.now();
    while (mailsTo(b.email).filter((x) => /Nouveau message/.test(x.subject)).length < 2 && Date.now() - t0 < 6000) await settle(50);
    assert.equal(mailsTo(b.email).filter((x) => /Nouveau message/.test(x.subject)).length, 2);
  });
});

describe('Réglages et pannes', () => {
  it('un membre qui a désactivé « Candidatures » ne reçoit ni notification ni e-mail', async () => {
    const rec = await validatedRecruiter(srv.base, admin, { company: 'Silence SA' });
    const s = await rec.client.get('/moi/parametres');
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const upd = await rec.client.patch('/moi/parametres', { notify: { candidatures: false } });
    assert.ok([200, 204].includes(upd.status), JSON.stringify(upd.body));
    const c = await rec.client.post('/recruteur/defis', challengeInput({ title: 'Défi silencieux de test' }));
    await admin.post(`/admin/defis/${c.body.id}`, { approve: true });
    assert.ok(await waitSubject(rec.email, /défi est publié/), 'les décisions de l’équipe sont toujours envoyées');
    const dev = await h.register(srv.base, { name: 'Candidat' });
    assert.equal((await dev.client.post(`/defis-recruteurs/${c.body.id}/candidatures`, { codeUrl: 'https://github.com/test/silence', message: 'Une solution suffisamment longue.' })).status, 204);
    await settle(800);
    assert.equal(mailsTo(rec.email).filter((x) => /Nouvelle candidature/.test(x.subject)).length, 0);
    assert.ok(!(await rec.client.get('/notifications')).body.some((n) => n.kind === 'candidature'));
  });

  it('sans SMTP, toutes les actions fonctionnent et les notifications du site restent créées', async () => {
    const adminNo = await h.createAdmin(srvNoMail.base);
    const rec = await validatedRecruiter(srvNoMail.base, adminNo);
    const c = await rec.client.post('/recruteur/defis', challengeInput());
    assert.equal(c.status, 201);
    assert.equal((await adminNo.post(`/admin/defis/${c.body.id}`, { approve: true })).status, 204);
    const dev = await h.register(srvNoMail.base);
    assert.equal((await dev.client.post(`/defis-recruteurs/${c.body.id}/candidatures`, { codeUrl: 'https://github.com/test/x', message: 'Une solution suffisamment longue.' })).status, 204);
    assert.ok((await rec.client.get('/notifications')).body.some((n) => n.kind === 'candidature'));
  });

  it('une panne du serveur d’e-mails ne fait échouer aucune action', async () => {
    smtp.setMode('reject');
    try {
      const rec = await validatedRecruiter(srv.base, admin);
      const c = await rec.client.post('/recruteur/defis', challengeInput({ title: 'Défi pendant la panne' }));
      assert.equal(c.status, 201);
      assert.equal((await admin.post(`/admin/defis/${c.body.id}`, { approve: true })).status, 204);
      const dev = await h.register(srv.base);
      assert.equal((await dev.client.post(`/defis-recruteurs/${c.body.id}/candidatures`, { codeUrl: 'https://github.com/test/panne', message: 'Une solution suffisamment longue.' })).status, 204);
      assert.ok((await rec.client.get('/notifications')).body.some((n) => n.kind === 'candidature'));
    } finally {
      smtp.setMode('ok');
    }
  });
});
