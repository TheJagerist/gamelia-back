// E-mails automatiques : validation / refus d'un compte recruteur par l'admin.
// Un faux serveur SMTP local reçoit les messages ; aucun vrai e-mail n'est envoyé.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let smtp;
let srv; // API avec SMTP configuré
let srvNoMail; // API sans SMTP
let admin;
let adminNoMail;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  smtp = await h.startFakeSmtp();
  const common = { AUTH_RATE_LIMIT_MAX: '1000', MAIL_RETRY_DELAY_MS: '100' };
  srv = await h.startServer(4105, {
    ...common,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    MAIL_FROM: 'Gamelia <no-reply@gamelia.test>',
    MAIL_REPLY_TO: 'equipe@gamelia.test',
    FRONT_ORIGIN: 'https://gamelia.test',
  });
  srvNoMail = await h.startServer(4106, { ...common, SMTP_HOST: '', MAIL_FROM: '' });
  admin = await h.createAdmin(srv.base);
  adminNoMail = await h.createAdmin(srvNoMail.base);
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
const APPROVED = /compte recruteur Gamelia est validé$/;
const REFUSED = /n'a pas pu être validée/;

async function pendingRecruiter(base, adminClient, opts = {}) {
  const rec = await h.register(base, { role: 'recruteur', company: 'Acme Test', ...opts });
  assert.equal(rec.res.status, 201, JSON.stringify(rec.res.body));
  const entry = (await adminClient.get('/admin/recruteurs')).body.find((u) => u.email === rec.email);
  assert.ok(entry, 'le recruteur doit apparaître dans la liste des comptes en attente');
  return { ...rec, id: entry.id };
}

describe('e-mail à la validation du compte recruteur', () => {
  it("à l'inscription, envoie seulement l'accusé de réception (aucun e-mail de validation avant la décision)", async () => {
    smtp.clear();
    const rec = await pendingRecruiter(srv.base, admin);
    assert.ok(await waitSubject(rec.email, /bien reçue/));
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(mailsTo(rec.email).map((m) => m.subject), ['Votre demande de compte recruteur Gamelia est bien reçue']);
  });

  it('envoie un e-mail de validation avec le bon destinataire, le bon objet et le lien de connexion', async () => {
    const rec = await pendingRecruiter(srv.base, admin, { name: 'Awa Traoré' });
    const r = await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    assert.equal(r.status, 204);
    const m = await waitSubject(rec.email, APPROVED);
    assert.ok(m, "l'e-mail de validation doit arriver");
    assert.equal(m.subject, 'Votre compte recruteur Gamelia est validé');
    assert.match(m.from, /no-reply@gamelia\.test/);
    assert.match(m.replyTo, /equipe@gamelia\.test/);
    assert.match(m.text, /Awa Traoré/);
    assert.match(m.text, /Acme Test/);
    assert.match(m.text, /https:\/\/gamelia\.test\/connexion/);
    assert.match(m.html, /href="https:\/\/gamelia\.test\/connexion"/);
  });

  it('envoie un e-mail de refus quand la demande est refusée', async () => {
    const rec = await pendingRecruiter(srv.base, admin);
    assert.equal((await admin.post(`/admin/recruteurs/${rec.id}`, { approve: false })).status, 204);
    const m = await waitSubject(rec.email, REFUSED);
    assert.ok(m, "l'e-mail de refus doit arriver");
    assert.doesNotMatch(m.text, /https:\/\/gamelia\.test\/connexion/);
  });

  it("n'envoie pas deux e-mails si l'admin valide deux fois le même compte", async () => {
    const rec = await pendingRecruiter(srv.base, admin);
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    await waitSubject(rec.email, APPROVED);
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(mailsTo(rec.email).filter((m) => APPROVED.test(m.subject)).length, 1);
  });

  it('envoie un nouvel e-mail si la décision change (refusé puis validé)', async () => {
    const rec = await pendingRecruiter(srv.base, admin);
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: false });
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    assert.ok(await waitSubject(rec.email, APPROVED));
    assert.ok(await waitSubject(rec.email, REFUSED));
  });

  it('échappe le nom et l’entreprise dans la version HTML (pas d’injection de balises)', async () => {
    const rec = await pendingRecruiter(srv.base, admin, { name: 'Eve <script>alert(1)</script>', company: 'A&B "Corp" <img src=x>' });
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    const m = await waitSubject(rec.email, APPROVED);
    assert.ok(m);
    assert.doesNotMatch(m.html, /<script>/);
    assert.doesNotMatch(m.html, /<img src=x>/);
    assert.match(m.html, /&lt;script&gt;/);
    assert.match(m.html, /A&amp;B &quot;Corp&quot;/);
  });

  it('ne met pas de nom de membre dans l’objet (pas de contenu libre dans les en-têtes)', async () => {
    const rec = await pendingRecruiter(srv.base, admin, { name: 'Bcc: pirate@exemple.com' });
    await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    const m = await waitSubject(rec.email, APPROVED);
    assert.ok(m);
    assert.doesNotMatch(m.subject, /pirate/);
    assert.doesNotMatch(m.raw.split('\r\n\r\n')[0], /^bcc:/im);
  });
});

describe('robustesse : une panne e-mail ne doit jamais bloquer le site', () => {
  it("la validation réussit et le statut change même si le serveur d'e-mails refuse le message", async () => {
    smtp.setMode('reject');
    const rec = await pendingRecruiter(srv.base, admin);
    const r = await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true });
    assert.equal(r.status, 204);
    const c = new h.Client(srv.base);
    const login = await c.post('/auth/connexion', { email: rec.email, password: h.PASSWORD });
    assert.equal(login.status, 200);
    assert.equal(login.body.recruiterStatus, 'valide');
    await new Promise((r2) => setTimeout(r2, 400));
    assert.equal(mailsTo(rec.email).length, 0, 'rien n’a pu être livré pendant la panne');
    smtp.setMode('ok');
  });

  it("réessaie une fois après une panne passagère (réponse 451) puis livre l'e-mail de validation", async () => {
    const rec = await pendingRecruiter(srv.base, admin);
    assert.ok(await waitSubject(rec.email, /bien reçue/));
    smtp.setMode('flaky'); // le premier envoi suivant reçoit 451
    assert.equal((await admin.post(`/admin/recruteurs/${rec.id}`, { approve: true })).status, 204);
    const m = await waitSubject(rec.email, APPROVED, 8000);
    assert.ok(m, "l'e-mail doit être livré à la deuxième tentative");
    smtp.setMode('ok');
  });

  it("la validation réussit quand le serveur d'e-mails est injoignable", async () => {
    const net = require('node:net');
    const tmp = net.createServer();
    await new Promise((r) => tmp.listen(0, '127.0.0.1', r));
    const deadPort = tmp.address().port;
    await new Promise((r) => tmp.close(r)); // port fermé : connexion refusée
    const dead = await h.startServer(4107, { AUTH_RATE_LIMIT_MAX: '1000', MAIL_RETRY_DELAY_MS: '100', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(deadPort), MAIL_FROM: 'x@gamelia.test' });
    try {
      const adm = await h.createAdmin(dead.base);
      const rec = await pendingRecruiter(dead.base, adm);
      const t0 = Date.now();
      assert.equal((await adm.post(`/admin/recruteurs/${rec.id}`, { approve: true })).status, 204);
      assert.ok(Date.now() - t0 < 3000, 'la réponse ne doit pas attendre le serveur d’e-mails');
      assert.equal((await adm.get('/admin/recruteurs')).body.some((u) => u.email === rec.email), false);
      assert.equal((await h.Client.prototype.get.call(adm, '/sante')).status, 200, "l'API doit rester en vie");
    } finally {
      dead.stop();
    }
  });

  it('sans configuration SMTP, la validation fonctionne simplement sans envoyer d’e-mail', async () => {
    smtp.clear();
    const rec = await pendingRecruiter(srvNoMail.base, adminNoMail);
    assert.equal((await adminNoMail.post(`/admin/recruteurs/${rec.id}`, { approve: true })).status, 204);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(smtp.messages.length, 0);
    const c = new h.Client(srvNoMail.base);
    assert.equal((await c.post('/auth/connexion', { email: rec.email, password: h.PASSWORD })).body.recruiterStatus, 'valide');
  });
});
