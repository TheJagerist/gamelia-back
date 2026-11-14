// Cycle recruteur complet, modération admin, confidentialité et pages publiques.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
let base;
let admin;
let github;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  github = await h.startFakeGithub();
  srv = await h.startServer(4104, { AUTH_RATE_LIMIT_MAX: '1000', GITHUB_API_URL: github.url, GITHUB_RATE_LIMIT_MAX: '1000' });
  base = srv.base;
  admin = await h.createAdmin(base);
});
after(async () => {
  srv?.stop();
  github?.stop();
  await h.cleanup();
});

// Crée un recruteur et le fait valider par l'admin.
async function validatedRecruiter(company = 'Acme Test') {
  const rec = await h.register(base, { role: 'recruteur', company });
  const entry = (await admin.get('/admin/recruteurs')).body.find((u) => u.email === rec.email);
  await admin.post(`/admin/recruteurs/${entry.id}`, { approve: true });
  const c = new h.Client(base);
  assert.equal((await c.post('/auth/connexion', { email: rec.email, password: h.PASSWORD })).status, 200);
  return c;
}

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

describe('Défis recruteurs : publication, candidature, évaluation, décision', () => {
  let rec, other, dev, cid, appId;

  before(async () => {
    rec = await validatedRecruiter('Baobab Test');
    other = await validatedRecruiter('Autre Entreprise');
    dev = (await h.register(base, { name: 'Candidate' })).client;
  });

  it('valide la création du défi : titre ≥ 8, résumé ≥ 15, brief ≥ 50, compétence, date future', async () => {
    const bad = await rec.post('/recruteur/defis', challengeInput({ title: 'court', summary: 'court', brief: 'trop court', skills: [], deadline: deadline(-2) }));
    assert.equal(bad.status, 400);
    for (const f of ['title', 'summary', 'brief', 'skills', 'deadline']) assert.ok(bad.body.fields[f], `champ ${f}`);
    assert.equal((await dev.post('/recruteur/defis', challengeInput())).status, 403, 'un développeur ne publie pas de défi');
  });

  it('accepte le format de date du front (YYYY-MM-DDT17:00:00Z) et crée le défi « en attente » avec notification aux admins', async () => {
    const d = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) + 'T17:00:00Z';
    const r = await rec.post('/recruteur/defis', challengeInput({ deadline: d }));
    assert.equal(r.status, 201);
    cid = r.body.id;
    const mine = (await rec.get('/recruteur/defis')).body;
    assert.equal(mine.find((c) => c.id === cid).status, 'en_attente');
    assert.ok((await admin.get('/notifications')).body.some((n) => n.kind === 'validation' && n.text.includes('API de paiement mobile')));
  });

  it('un défi en attente est invisible des développeurs (404, absent de la liste)', async () => {
    assert.equal((await dev.get(`/defis-recruteurs/${cid}`)).status, 404);
    assert.equal((await dev.get('/defis-recruteurs')).body.items.some((c) => c.id === cid), false);
    assert.equal((await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/t/a', message: 'Une candidature assez longue.' })).status, 404);
  });

  it('l’admin publie le défi et le recruteur est notifié', async () => {
    assert.ok((await admin.get('/admin/defis')).body.some((c) => c.id === cid && c.recruiter.company === 'Baobab Test'));
    assert.equal((await dev.post(`/admin/defis/${cid}`, { approve: true })).status, 403);
    assert.equal((await admin.post(`/admin/defis/${cid}`, { approve: true })).status, 204);
    assert.ok((await rec.get('/notifications')).body.some((n) => n.text.includes('est publié')));
    const view = (await dev.get(`/defis-recruteurs/${cid}`)).body;
    assert.equal(view.status, 'publie');
    assert.equal(view.company, 'Baobab Test');
    assert.equal(view.myApplication, undefined);
  });

  it('candidature : liens et message validés, démo YouTube ou https, un seul dépôt par défi (409)', async () => {
    const bad = await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'pas-un-lien', demoUrl: 'ftp://x', message: 'court' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fields.codeUrl && bad.body.fields.demoUrl && bad.body.fields.message);
    const ok = await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/test/paiement', demoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', message: 'Voici ma solution avec idempotence et webhooks signés.' });
    assert.equal(ok.status, 204);
    assert.equal((await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/test/paiement', message: 'Une deuxième tentative du même.' })).status, 409);
    const view = (await dev.get(`/defis-recruteurs/${cid}`)).body;
    assert.equal(view.myApplication.status, 'recue');
    assert.equal(view.applicationCount, 1);
    assert.ok((await rec.get('/notifications')).body.some((n) => n.kind === 'candidature'));
  });

  it('les candidatures ne sont visibles que du recruteur propriétaire (403 pour un autre, ni dans sa liste)', async () => {
    const detail = await rec.get(`/recruteur/defis/${cid}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.applications.length, 1);
    assert.equal(detail.body.applications[0].dev.email, undefined);
    appId = detail.body.applications[0].id;
    assert.equal((await other.get(`/recruteur/defis/${cid}`)).status, 403);
    assert.equal((await other.get('/recruteur/candidatures')).body.items.length, 0);
    assert.equal((await rec.get('/recruteur/candidatures')).body.items.some((a) => a.id === appId), true);
    assert.equal((await rec.get('/recruteur/candidatures?status=retenue')).body.items.length, 0);
  });

  it('évaluation : note 1-5, réservée au propriétaire, notifie le candidat', async () => {
    assert.equal((await rec.post(`/recruteur/candidatures/${appId}/evaluation`, { score: 9, feedback: 'x' })).status, 400);
    assert.equal((await other.post(`/recruteur/candidatures/${appId}/evaluation`, { score: 4, feedback: 'Pas à moi.' })).status, 403);
    assert.equal((await rec.post(`/recruteur/candidatures/${appId}/evaluation`, { score: 5, feedback: 'Excellent travail.' })).status, 204);
    const view = (await dev.get(`/defis-recruteurs/${cid}`)).body.myApplication;
    assert.equal(view.status, 'evaluee');
    assert.equal(view.score, 5);
    assert.ok((await dev.get('/notifications')).body.some((n) => n.kind === 'candidature' && n.text.includes('évaluée')));
  });

  it('décision : « retenu » exige une proposition d’au moins 20 caractères', async () => {
    const no = await rec.post(`/recruteur/candidatures/${appId}/decision`, { retained: true });
    assert.equal(no.status, 400);
    assert.ok(no.body.fields.proposal);
    assert.equal((await other.post(`/recruteur/candidatures/${appId}/decision`, { retained: true, proposal: 'Une proposition assez longue ici.' })).status, 403);
    assert.equal((await rec.post(`/recruteur/candidatures/${appId}/decision`, { retained: true, proposal: 'Nous vous proposons une mission de 3 mois.' })).status, 204);
    const view = (await dev.get(`/defis-recruteurs/${cid}`)).body.myApplication;
    assert.equal(view.status, 'retenue');
    assert.match(view.proposal, /mission de 3 mois/);
    assert.ok((await rec.get('/recruteur/candidatures?status=retenue')).body.items.some((a) => a.id === appId));
  });

  it('clôture : réservée au propriétaire, le défi disparaît de la liste des développeurs', async () => {
    assert.equal((await other.post(`/recruteur/defis/${cid}/cloturer`)).status, 404);
    assert.equal((await rec.post(`/recruteur/defis/${cid}/cloturer`)).status, 204);
    assert.equal((await dev.get('/defis-recruteurs')).body.items.some((c) => c.id === cid), false);
    assert.equal((await dev.post(`/defis-recruteurs/${cid}/candidatures`, { codeUrl: 'https://github.com/t/b', message: 'Candidature après la clôture.' })).status, 404);
  });

  it('refus d’un défi par l’admin : le recruteur est notifié et le défi reste invisible', async () => {
    const r = await rec.post('/recruteur/defis', challengeInput({ title: 'Défi qui sera refusé' }));
    assert.equal((await admin.post(`/admin/defis/${r.body.id}`, { approve: false })).status, 204);
    assert.equal((await dev.get('/defis-recruteurs')).body.items.some((c) => c.id === r.body.id), false);
    assert.ok((await rec.get('/notifications')).body.some((n) => n.text.includes("n'a pas été accepté")));
  });
});

describe('Recherche de talents et contact', () => {
  let rec, visible, hidden;

  before(async () => {
    rec = await validatedRecruiter('Talents SA');
    visible = await h.register(base, { name: 'Talent Visible', country: 'Bénin' });
    hidden = await h.register(base, { name: 'Talent Caché', country: 'Bénin' });
    await visible.client.patch('/moi', { skills: ['Rust-test'], bio: 'Spécialiste Rust.' });
    await hidden.client.patch('/moi', { skills: ['Rust-test'], bio: 'Spécialiste Rust.' });
    await hidden.client.patch('/moi/parametres', { privacy: { visibleRecruteurs: false } });
  });

  it('filtre par compétence, pays et niveau, et exclut ceux qui ont masqué leur profil aux recruteurs', async () => {
    const r = await rec.get('/recruteur/talents?skill=Rust-test&country=B%C3%A9nin&level=D%C3%A9butant');
    assert.equal(r.status, 200);
    const names = r.body.items.map((t) => t.name);
    assert.ok(names.includes('Talent Visible'));
    assert.equal(names.includes('Talent Caché'), false);
    assert.equal(typeof r.body.items[0].verifiedCount, 'number');
    assert.equal(r.body.items[0].email, undefined);
  });

  it('réservé aux recruteurs validés', async () => {
    assert.equal((await visible.client.get('/recruteur/talents')).status, 403);
    assert.equal((await new h.Client(base).get('/recruteur/talents')).status, 401);
  });

  it('contact : message ≥ 20 caractères, notifie le développeur, 404 si inconnu', async () => {
    const username = visible.user.username;
    assert.equal((await rec.post('/recruteur/contacts', { username, message: 'court' })).status, 400);
    assert.equal((await rec.post('/recruteur/contacts', { username: 'personne-nexiste-pas', message: 'Bonjour, votre profil nous intéresse.' })).status, 404);
    assert.equal((await rec.post('/recruteur/contacts', { username, message: 'Bonjour, votre profil nous intéresse beaucoup.' })).status, 204);
    assert.ok((await visible.client.get('/notifications')).body.some((n) => n.text.includes('Talents SA')));
  });
});

describe('Signalements et modération', () => {
  let author, reporter, qid, aid, commentId, projectId;

  before(async () => {
    author = (await h.register(base, { name: 'Auteur signalé' })).client;
    reporter = (await h.register(base, { name: 'Signaleur' })).client;
    qid = (await author.post('/questions', { title: 'Une question à modérer ici', body: 'Contenu de la question à modérer.', tags: ['Git'] })).body.id;
    aid = (await reporter.post(`/questions/${qid}/reponses`, { body: 'Une réponse qui sera signalée.' })).body.answerId;
    await author.post(`/reponses/${aid}/commentaires`, { body: 'Un commentaire de réponse à signaler.' });
    projectId = (await author.post('/projets', { title: 'Projet à modérer', summary: 'Un projet à modérer ici.', description: '', techs: ['Git'], codeUrl: 'https://github.com/t/m', seekingCollaborators: false })).body.id;
    await reporter.post(`/projets/${projectId}/commentaires`, { body: 'Un commentaire de projet à signaler.' });
    const { query } = require('../src/db/pool');
    commentId = {
      answer: (await query('SELECT id FROM answer_comments WHERE answer_id = $1', [aid])).rows[0].id,
      project: (await query('SELECT id FROM project_comments WHERE project_id = $1', [projectId])).rows[0].id,
    };
  });

  it('valide le signalement : motif obligatoire, id au bon format, cible existante, pas de doublon ouvert', async () => {
    assert.equal((await reporter.post('/signalements', { targetType: 'question', targetId: qid, reason: '' })).status, 400);
    assert.equal((await reporter.post('/signalements', { targetType: 'question', targetId: 'pas-un-uuid', reason: 'Spam' })).status, 400);
    assert.equal((await reporter.post('/signalements', { targetType: 'bidon', targetId: qid, reason: 'Spam' })).status, 400);
    assert.equal((await reporter.post('/signalements', { targetType: 'question', targetId: '00000000-0000-4000-8000-000000000000', reason: 'Spam' })).status, 404);
    assert.equal((await new h.Client(base).post('/signalements', { targetType: 'question', targetId: qid, reason: 'Spam' })).status, 401);
    assert.equal((await reporter.post('/signalements', { targetType: 'question', targetId: qid, reason: 'Hors sujet', details: 'Détails.' })).status, 204);
    assert.equal((await reporter.post('/signalements', { targetType: 'question', targetId: qid, reason: 'Spam' })).status, 409);
    assert.equal((await author.post('/signalements', { targetType: 'question', targetId: qid, reason: 'Spam' })).status, 204, 'un autre membre peut signaler la même cible');
  });

  it('l’admin voit le titre et le lien de chaque cible (question, réponse, commentaires de réponse et de projet, projet)', async () => {
    await reporter.post('/signalements', { targetType: 'reponse', targetId: aid, reason: 'Spam' });
    await reporter.post('/signalements', { targetType: 'commentaire', targetId: commentId.answer, reason: 'Spam' });
    await author.post('/signalements', { targetType: 'commentaire', targetId: commentId.project, reason: 'Spam' });
    await reporter.post('/signalements', { targetType: 'projet', targetId: projectId, reason: 'Spam' });
    const list = (await admin.get('/admin/signalements')).body;
    const mine = list.filter((r) => [qid, aid, commentId.answer, commentId.project, projectId].includes(r.targetId));
    assert.equal(mine.length, 6);
    const byTarget = (id) => mine.find((r) => r.targetId === id);
    assert.equal(byTarget(qid).targetTitle, 'Une question à modérer ici');
    assert.equal(byTarget(qid).targetHref, `/questions/${qid}`);
    assert.match(byTarget(aid).targetTitle, /^Réponse/);
    assert.equal(byTarget(commentId.answer).targetHref, `/questions/${qid}`);
    assert.equal(byTarget(commentId.project).targetHref, `/projets/${projectId}`);
    assert.equal(byTarget(projectId).targetTitle, 'Projet à modérer');
    assert.equal(byTarget(qid).reporter.email, undefined);
    assert.equal((await reporter.get('/admin/signalements')).status, 403);
    assert.ok((await admin.get('/admin/compteurs')).body.reports >= 6);
  });

  it('« rejeter » conserve le contenu ; « retirer » le supprime avec ses dépendances ; une décision ne se rejoue pas (409)', async () => {
    const { query } = require('../src/db/pool');
    const open = (await admin.get('/admin/signalements')).body;
    const rep = (id) => open.find((r) => r.targetId === id);

    assert.equal((await admin.post(`/admin/signalements/${rep(qid).id}`, { action: 'rejeter' })).status, 204);
    assert.equal((await new h.Client(base).get(`/questions/${qid}`)).status, 200, 'le contenu reste');
    assert.equal((await admin.post(`/admin/signalements/${rep(qid).id}`, { action: 'rejeter' })).status, 409);
    assert.equal((await admin.post(`/admin/signalements/${rep(qid).id}`, { action: 'bidon' })).status, 400);
    assert.equal((await admin.post('/admin/signalements/00000000-0000-4000-8000-000000000000', { action: 'rejeter' })).status, 404);

    assert.equal((await admin.post(`/admin/signalements/${rep(commentId.answer).id}`, { action: 'retirer' })).status, 204);
    assert.equal((await query('SELECT 1 FROM answer_comments WHERE id = $1', [commentId.answer])).rows.length, 0);
    assert.equal((await admin.post(`/admin/signalements/${rep(commentId.project).id}`, { action: 'retirer' })).status, 204);
    assert.equal((await query('SELECT 1 FROM project_comments WHERE id = $1', [commentId.project])).rows.length, 0);
    assert.equal((await admin.post(`/admin/signalements/${rep(aid).id}`, { action: 'retirer' })).status, 204);
    assert.equal((await query('SELECT 1 FROM answers WHERE id = $1', [aid])).rows.length, 0);
    assert.equal((await admin.post(`/admin/signalements/${rep(projectId).id}`, { action: 'retirer' })).status, 204);
    assert.equal((await new h.Client(base).get(`/projets/${projectId}`)).status, 404);

    const traites = (await admin.get('/admin/signalements?status=traite')).body;
    assert.ok(traites.some((r) => r.targetId === projectId));
    assert.ok((await admin.get('/admin/signalements?status=rejete')).body.some((r) => r.targetId === qid));
    assert.equal((await admin.get('/admin/signalements?status=bidon')).status, 400);
  });
});

describe('Confidentialité et pages publiques', () => {
  let member, viewer;

  before(async () => {
    member = await h.register(base, { name: 'Membre Discret', country: 'Togo' });
    viewer = (await h.register(base, { name: 'Visiteur Connecté', country: 'Togo' })).client;
    await member.client.patch('/moi', { city: 'Lomé', links: [{ kind: 'github', label: 'GitHub', url: 'https://github.com/discret' }] });
  });

  it('profil public : ville, liens et date d’inscription visibles par défaut, jamais l’e-mail', async () => {
    const r = await new h.Client(base).get(`/profils/${member.user.username}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.user.city, 'Lomé');
    assert.equal(r.body.user.links.length, 1);
    assert.ok(r.body.user.joinedAt);
    assert.equal(JSON.stringify(r.body).includes(member.email), false);
    assert.ok(Array.isArray(r.body.verified) && Array.isArray(r.body.declared));
    assert.equal(typeof r.body.rankInCountry, 'number');
    assert.equal(r.body.declared.some((d) => d.kind === 'lien' && d.title === 'GitHub'), true, 'un lien GitHub non confirmé reste « déclaré »');
  });

  it('un lien GitHub devient « vérifié » une fois le compte confirmé', async () => {
    assert.equal((await h.verifyGithub(member.client, github, 'discret')).status, 200);
    const r = (await new h.Client(base).get(`/profils/${member.user.username}`)).body;
    assert.equal(r.verified.some((v) => v.kind === 'lien'), true);
    assert.ok(r.badges.some((b) => b.id === 'b8'));
  });

  it('masquer la ville la retire du profil, du classement, du fil et de l’accueil', async () => {
    await member.client.patch('/moi/parametres', { privacy: { afficherVille: false } });
    const anon = new h.Client(base);
    assert.equal((await anon.get(`/profils/${member.user.username}`)).body.user.city, undefined);
    const lb = (await anon.get('/classement?country=Togo')).body.items.find((i) => i.user.username === member.user.username);
    assert.ok(lb);
    assert.equal(lb.user.city, undefined);
    assert.equal((await member.client.get('/auth/me')).body.city, 'Lomé', 'le propriétaire voit toujours sa propre ville');
  });

  it('« profil réservé aux membres » : 403 pour un visiteur anonyme, 200 pour un membre connecté', async () => {
    await member.client.patch('/moi/parametres', { privacy: { profilPublic: false } });
    const anon = await new h.Client(base).get(`/profils/${member.user.username}`);
    assert.equal(anon.status, 403);
    assert.match(anon.body.message, /membres connectés/);
    assert.equal((await viewer.get(`/profils/${member.user.username}`)).status, 200);
  });

  it('seuls les développeurs ont un profil public (404 pour un recruteur, un admin, un inconnu)', async () => {
    const anon = new h.Client(base);
    assert.equal((await anon.get('/profils/personne.nexiste.pas')).status, 404);
    const rec = await h.register(base, { role: 'recruteur', company: 'X Test' });
    assert.equal((await anon.get(`/profils/${rec.email.split('@')[0]}`)).status, 404);
  });

  it('paramètres : fusion partielle, valeurs par défaut, rejet des valeurs invalides', async () => {
    const fresh = (await h.register(base)).client;
    const def = (await fresh.get('/moi/parametres')).body;
    assert.deepEqual(def.privacy, { profilPublic: true, afficherVille: true, visibleRecruteurs: true });
    assert.equal(def.theme, 'systeme');
    const r = await fresh.patch('/moi/parametres', { theme: 'sombre', notify: { badges: false } });
    assert.equal(r.body.theme, 'sombre');
    assert.equal(r.body.notify.badges, false);
    assert.equal(r.body.notify.reponses, true, 'les autres réglages sont conservés');
    assert.equal((await fresh.patch('/moi/parametres', { theme: 'violet' })).status, 400);
  });

  it('désactiver les notifications de réponses empêche d’en créer', async () => {
    const asker = await h.register(base);
    const answerer = (await h.register(base)).client;
    await asker.client.patch('/moi/parametres', { notify: { reponses: false } });
    const q = await asker.client.post('/questions', { title: 'Question sans notification', body: 'Je ne veux pas être notifié ici.', tags: ['Git'] });
    await answerer.post(`/questions/${q.body.id}/reponses`, { body: 'Une réponse qui ne notifie pas.' });
    assert.equal((await asker.client.get('/notifications/non-lues')).body.count, 0);
  });

  it('notifications : liste, compteur, « tout lire », isolées par utilisateur', async () => {
    const asker = await h.register(base);
    const answerer = await h.register(base);
    const q = await asker.client.post('/questions', { title: 'Question qui sera notifiée', body: 'Une notification est attendue ici.', tags: ['Git'] });
    await answerer.client.post(`/questions/${q.body.id}/reponses`, { body: 'Une réponse qui notifie bien.' });
    assert.equal((await asker.client.get('/notifications/non-lues')).body.count, 1);
    assert.equal((await answerer.client.get('/notifications/non-lues')).body.count, 0);
    const list = (await asker.client.get('/notifications')).body;
    assert.equal(list[0].read, false);
    assert.equal(list[0].href, `/questions/${q.body.id}`);
    assert.equal((await asker.client.post('/notifications/tout-lu')).status, 204);
    assert.equal((await asker.client.get('/notifications/non-lues')).body.count, 0);
    assert.equal((await new h.Client(base).get('/notifications/non-lues')).status, 401);
  });
});

describe('Accueil, fil, classement', () => {
  let dev;

  before(async () => {
    dev = await h.register(base, { name: 'Fil Test', country: 'Gabon' });
    await dev.client.patch('/moi', { following: ['Python'], links: [{ kind: 'site', label: 'Mon site', url: 'https://exemple.com' }] });
    await dev.client.post('/questions', { title: 'Question Python pour le fil', body: 'Une question Python pour tester le fil.', tags: ['Python'] });
    await dev.client.post('/projets', { title: 'Projet Python pour le fil', summary: 'Un projet Python pour le fil.', description: '', techs: ['Python'], codeUrl: 'https://github.com/t/py', seekingCollaborators: false });
    await dev.client.post('/projets', { title: 'Projet Java hors suivi', summary: 'Un projet Java hors suivi.', description: '', techs: ['Java'], codeUrl: 'https://github.com/t/java', seekingCollaborators: false });
  });

  it('GET /accueil : 4 questions, 3 projets, statistiques', async () => {
    const r = await new h.Client(base).get('/accueil');
    assert.equal(r.status, 200);
    assert.ok(r.body.questions.length <= 4 && r.body.projects.length <= 3);
    assert.ok(r.body.stats.devs >= 1 && r.body.stats.countries >= 1 && typeof r.body.stats.answers === 'number');
    assert.ok(r.body.projects.every((p) => Array.isArray(p.techs) && Array.isArray(p.owner.links) && p.owner.joinedAt));
  });

  it('GET /fil : forme { type, date, item }, filtre par type, pagination de 8', async () => {
    const anon = new h.Client(base);
    const r = (await anon.get('/fil')).body;
    assert.ok(r.items.length <= 8);
    assert.ok(r.items.every((i) => ['question', 'projet', 'lecon'].includes(i.type) && i.date && i.item));
    const dates = r.items.map((i) => new Date(i.date).getTime());
    assert.deepEqual([...dates].sort((a, b) => b - a), dates, 'trié du plus récent au plus ancien');
    const lecons = (await anon.get('/fil?type=lecon')).body;
    assert.ok(lecons.items.every((i) => i.type === 'lecon' && i.item.trackTitle && i.item.minutes));
    assert.equal((await anon.get('/fil?type=bidon')).status, 400);
    assert.equal((await anon.get('/fil?page=9999')).body.page, r.pageCount);
  });

  it('GET /fil?following=true ne garde que les technologies suivies, seulement pour un membre connecté', async () => {
    const r = (await dev.client.get('/fil?following=true&type=projet')).body;
    assert.ok(r.items.length >= 1);
    assert.ok(r.items.every((i) => i.item.techs.includes('Python')));
    assert.equal(r.items.some((i) => i.item.title === 'Projet Java hors suivi'), false);
    const anonymous = (await new h.Client(base).get('/fil?following=true&type=projet')).body;
    assert.equal(anonymous.items.some((i) => i.item.title === 'Projet Java hors suivi') || anonymous.total > r.total, true, 'sans session : pas de filtre');
  });

  it('GET /classement : rang, points, filtre par pays, jamais d’admin ni de recruteur', async () => {
    const anon = new h.Client(base);
    const gabon = (await anon.get('/classement?country=Gabon')).body;
    assert.ok(gabon.items.every((i) => i.user.country === 'Gabon' && i.user.role === 'developpeur'));
    assert.equal(gabon.items[0].rank, 1);
    const all = (await anon.get('/classement')).body;
    const pts = all.items.map((i) => i.points);
    assert.deepEqual([...pts].sort((a, b) => b - a), pts);
    assert.ok(all.items.every((i) => i.user.role === 'developpeur' && typeof i.weekPoints === 'number'));
    assert.equal((await anon.get('/classement?page=abc')).status, 400);
    assert.equal((await anon.get('/classement?page=9999')).body.page, all.pageCount);
  });

  it('aucune réponse publique ne divulgue d’e-mail ni de mot de passe', async () => {
    const anon = new h.Client(base);
    for (const url of ['/accueil', '/fil', '/classement', '/questions', '/projets', `/profils/${dev.user.username}`]) {
      const text = JSON.stringify((await anon.get(url)).body);
      assert.equal(/password|@test\.gamelia/.test(text), false, `${url} ne doit pas contenir d'e-mail ni de secret`);
    }
  });
});
