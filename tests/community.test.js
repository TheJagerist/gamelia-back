// Questions/réponses/votes, moteur de points (plafond quotidien, anti-triche), apprentissage,
// défis, projets et revues. Chaque règle testée vient de lib/mock/server.ts (le contrat du front).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
let base;
const points = async (c) => (await c.get('/moi/progression')).body.points;

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  srv = await h.startServer(4103, { AUTH_RATE_LIMIT_MAX: '1000' });
  base = srv.base;
});
after(async () => {
  srv?.stop();
  await h.cleanup();
});

describe('Questions, réponses, votes', () => {
  let author, answerer, third, qid, aid;

  before(async () => {
    author = (await h.register(base, { name: 'Auteur Q' })).client;
    answerer = (await h.register(base, { name: 'Répondeur' })).client;
    third = (await h.register(base, { name: 'Troisième' })).client;
  });

  it('valide la création : titre ≥ 10, corps ≥ 20, au moins un tag ; garde 4 tags maximum', async () => {
    const bad = await author.post('/questions', { title: 'court', body: 'trop court', tags: [] });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fields.title && bad.body.fields.body && bad.body.fields.tags);
    const ok = await author.post('/questions', { title: 'Comment faire une jointure SQL ?', body: 'Je veux relier deux tables par une clé étrangère.', tags: ['SQL', 'API', 'Git', 'Python', 'Java'], code: { lang: 'sql', content: 'SELECT 1;' } });
    assert.equal(ok.status, 201);
    qid = ok.body.id;
    const detail = await new h.Client(base).get(`/questions/${qid}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.tags.length, 4);
    assert.deepEqual(detail.body.code, { lang: 'sql', content: 'SELECT 1;' });
    assert.equal(detail.body.answers.length, 0);
  });

  it('seul un développeur peut poser une question', async () => {
    const admin = await h.createAdmin(base);
    assert.equal((await admin.post('/questions', { title: 'Un titre assez long ?', body: 'Un corps de question assez long.', tags: ['Git'] })).status, 403);
  });

  it('répondre à une autre personne rapporte 10 points et le badge « Première réponse »', async () => {
    const r = await answerer.post(`/questions/${qid}/reponses`, { body: 'Utilise JOIN avec la clé étrangère.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.points, 10);
    aid = r.body.answerId;
    assert.equal(await points(answerer), 10);
    const prog = (await answerer.get('/moi/progression')).body;
    assert.ok(prog.badges.some((b) => b.id === 'b1'));
  });

  it('répondre à sa propre question ne rapporte aucun point (anti-triche)', async () => {
    const r = await author.post(`/questions/${qid}/reponses`, { body: 'Je me réponds à moi-même.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.points, 0);
    assert.equal(await points(author), 0);
  });

  it('refuse une réponse trop courte (400) et sur une question inconnue (404)', async () => {
    assert.equal((await answerer.post(`/questions/${qid}/reponses`, { body: 'court' })).status, 400);
    assert.equal((await answerer.post('/questions/00000000-0000-4000-8000-000000000000/reponses', { body: 'Une réponse assez longue.' })).status, 404);
  });

  it('le notifie l’auteur de la question, et commenter notifie l’auteur de la réponse', async () => {
    const n = (await author.get('/notifications')).body;
    assert.ok(n.some((x) => x.kind === 'reponse' && x.text.includes('Répondeur')));
    assert.equal((await third.post(`/reponses/${aid}/commentaires`, { body: 'Merci pour la précision.' })).status, 204);
    assert.ok((await answerer.get('/notifications')).body.some((x) => x.kind === 'commentaire'));
    assert.equal((await third.post(`/reponses/${aid}/commentaires`, { body: '' })).status, 400);
  });

  it('un vote est une bascule : revoter dans le même sens l’annule ; +5 pts à l’auteur seulement pour un nouveau +1', async () => {
    const v1 = await third.post('/votes', { questionId: qid, targetId: aid, dir: 1 });
    assert.deepEqual(v1.body, { votes: 1, myVote: 1 });
    assert.equal(await points(answerer), 15);
    const v2 = await third.post('/votes', { questionId: qid, targetId: aid, dir: 1 });
    assert.deepEqual(v2.body, { votes: 0, myVote: 0 });
    const v3 = await third.post('/votes', { questionId: qid, targetId: aid, dir: -1 });
    assert.deepEqual(v3.body, { votes: -1, myVote: -1 });
    assert.equal(await points(answerer), 15, 'un vote négatif ne retire ni ne donne de points');
  });

  it('on ne peut pas voter pour son propre contenu (403)', async () => {
    assert.equal((await answerer.post('/votes', { questionId: qid, targetId: aid, dir: 1 })).status, 403);
    assert.equal((await author.post('/votes', { questionId: qid, targetId: qid, dir: 1 })).status, 403);
  });

  it('seul l’auteur de la question choisit la meilleure réponse (+25 pts et badge à l’auteur de la réponse)', async () => {
    assert.equal((await third.post(`/questions/${qid}/meilleure-reponse`, { answerId: aid })).status, 403);
    const before = await points(answerer);
    assert.equal((await author.post(`/questions/${qid}/meilleure-reponse`, { answerId: aid })).status, 204);
    assert.equal(await points(answerer), before + 25);
    assert.ok((await answerer.get('/moi/progression')).body.badges.some((b) => b.id === 'b2'));
    const detail = (await new h.Client(base).get(`/questions/${qid}`)).body;
    assert.equal(detail.bestAnswerId, aid);
    assert.equal(detail.answers[0].id, aid, 'la meilleure réponse est affichée en premier');
  });

  it('la liste filtre par tag, par recherche et par « sans réponse », avec pagination', async () => {
    const anon = new h.Client(base);
    const byTag = await anon.get('/questions?tag=SQL');
    assert.ok(byTag.body.items.some((q) => q.id === qid));
    const search = await anon.get('/questions?q=jointure');
    assert.ok(search.body.items.some((q) => q.id === qid));
    const lone = await author.post('/questions', { title: 'Question sans aucune réponse', body: 'Personne ne répond encore à celle-ci.', tags: ['Git'] });
    const unanswered = await anon.get('/questions?sort=sans-reponse');
    assert.ok(unanswered.body.items.some((q) => q.id === lone.body.id));
    assert.equal(unanswered.body.items.some((q) => q.id === qid), false);
    const huge = await anon.get('/questions?page=9999');
    assert.equal(huge.status, 200);
    assert.equal(huge.body.page, huge.body.pageCount, 'la page est ramenée à la dernière');
  });
});

describe('Plafond quotidien de points (anti-triche)', () => {
  it('plafonne à 200 points par jour : 7 projets × 30 pts = 180 + 20, puis 0', async () => {
    const dev = (await h.register(base)).client;
    const credited = [];
    for (let i = 0; i < 8; i++) {
      const r = await dev.post('/projets', { title: `Projet de test ${i}`, summary: 'Un projet pour tester le plafond.', description: '', techs: ['Git'], codeUrl: 'https://github.com/test/plafond', seekingCollaborators: false });
      assert.equal(r.status, 201);
      credited.push(r.body.points);
    }
    assert.deepEqual(credited, [30, 30, 30, 30, 30, 30, 20, 0]);
    const p = (await dev.get('/moi/progression')).body;
    assert.equal(p.points, 200);
    assert.equal(p.todayPoints, 200);
    assert.equal(p.dailyCap, 200);
  });

  it('résiste aux requêtes simultanées (pas de dépassement du plafond)', async () => {
    const dev = (await h.register(base)).client;
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => dev.post('/projets', { title: `Course ${i} simultanée`, summary: 'Test de concurrence.', description: '', techs: ['Git'], codeUrl: 'https://github.com/test/course', seekingCollaborators: false }))
    );
    assert.ok(results.every((r) => r.status === 201));
    assert.equal(await points(dev), 200, '10 × 30 = 300 demandés, 200 crédités');
  });

  it('les recruteurs et admins ne gagnent jamais de points', async () => {
    const admin = await h.createAdmin(base);
    assert.equal((await admin.get('/moi/progression')).status, 403, 'la progression est réservée aux développeurs');
  });
});

describe('Pistes, leçons et défis quiz', () => {
  it('liste les pistes avec progression, et ne révèle jamais les bonnes réponses avant correction', async () => {
    const anon = new h.Client(base);
    const tracks = await anon.get('/pistes');
    assert.equal(tracks.body.length, 3);
    assert.ok(tracks.body.every((t) => t.progress === 0));
    const lesson = (await anon.get('/lecons/web-1')).body;
    assert.ok(lesson.quiz.length > 0);
    assert.equal(JSON.stringify(lesson).includes('"answer"'), false);
    assert.ok(!lesson.prev, 'la première leçon n’a pas de précédente');
    assert.equal(lesson.next, 'web-2');
    const challenge = (await anon.get('/defis/d2')).body;
    assert.equal(JSON.stringify(challenge).includes('"answer"'), false);
    assert.equal((await anon.get('/pistes/inconnue')).status, 404);
  });

  it('quiz de leçon : seuil 66 %, +15 pts à la première réussite seulement', async () => {
    const dev = (await h.register(base)).client;
    const lesson = (await dev.get('/lecons/web-1')).body;
    const wrong = await dev.post('/lecons/web-1/quiz', { answers: lesson.quiz.map(() => -1) });
    assert.equal(wrong.body.passed, false);
    assert.equal(wrong.body.pointsEarned, 0);
    const right = await dev.post('/lecons/web-1/quiz', { answers: wrong.body.corrections.map((c) => c.answer) });
    assert.equal(right.body.passed, true);
    assert.equal(right.body.pointsEarned, 15);
    const again = await dev.post('/lecons/web-1/quiz', { answers: wrong.body.corrections.map((c) => c.answer) });
    assert.equal(again.body.pointsEarned, 0, 'pas de points en double');
    assert.equal(await points(dev), 15);
    const track = (await dev.get('/pistes/web')).body;
    assert.ok(track.progress > 0 && track.lessons.find((l) => l.id === 'web-1').done === true);
  });

  it('terminer une piste complète rapporte +60 pts et le badge « Piste terminée »', async () => {
    const dev = (await h.register(base)).client;
    let last;
    for (const id of ['web-1', 'web-2', 'web-3']) {
      const l = (await dev.get(`/lecons/${id}`)).body;
      const probe = await dev.post(`/lecons/${id}/quiz`, { answers: l.quiz.map(() => -1) });
      last = await dev.post(`/lecons/${id}/quiz`, { answers: probe.body.corrections.map((c) => c.answer) });
      assert.equal(last.body.passed, true);
    }
    assert.equal(last.body.pointsEarned, 15 + 60);
    assert.equal(last.body.badge?.id, 'b3');
    assert.equal((await dev.get('/moi/portfolio')).body.verified.some((v) => v.id === 't-web'), true, 'la piste apparaît dans le portfolio vérifié');
  });

  it('quiz de défi : seuil 75 %, points du défi une seule fois, badge « Premier défi », ajout au portfolio', async () => {
    const dev = (await h.register(base)).client;
    const def = (await dev.get('/defis/d2')).body;
    const probe = await dev.post('/defis/d2/quiz', { answers: def.quiz.map(() => -1) });
    assert.equal(probe.body.passed, false);
    assert.equal((await dev.get('/defis/d2')).body.status, 'echoue');
    const win = await dev.post('/defis/d2/quiz', { answers: probe.body.corrections.map((c) => c.answer) });
    assert.equal(win.body.passed, true);
    assert.equal(win.body.pointsEarned, def.points);
    assert.equal(win.body.badge?.id, 'b4');
    assert.equal((await dev.get('/defis/d2')).body.status, 'reussi');
    const replay = await dev.post('/defis/d2/quiz', { answers: probe.body.corrections.map((c) => c.answer) });
    assert.equal(replay.body.pointsEarned, 0);
    const failAfter = await dev.post('/defis/d2/quiz', { answers: def.quiz.map(() => -1) });
    assert.equal(failAfter.body.passed, false);
    assert.equal((await dev.get('/defis/d2')).body.status, 'reussi', 'un échec ultérieur ne retire pas la réussite');
    assert.ok((await dev.get('/moi/portfolio')).body.verified.some((v) => v.title === def.title));
    assert.equal((await dev.post('/defis/d1/quiz', { answers: [0] })).status, 404, 'un défi pratique n’a pas de quiz');
  });

  it('la liste des défis met le défi de la semaine en premier et filtre par type', async () => {
    const anon = new h.Client(base);
    const all = (await anon.get('/defis')).body;
    assert.equal(all.items[0].weekly, true);
    const quiz = (await anon.get('/defis?kind=quiz')).body;
    assert.ok(quiz.items.length > 0 && quiz.items.every((c) => c.kind === 'quiz'));
  });
});

describe('Défis pratiques', () => {
  it('vérifie le dépôt, refuse le doublon en attente, puis l’admin valide : points, badge, portfolio', async () => {
    const dev = (await h.register(base)).client;
    const admin = await h.createAdmin(base);
    assert.equal((await dev.post('/defis/d1/solutions', { codeUrl: 'https://exemple.com/pas-un-depot', note: 'x' })).status, 400);
    assert.equal((await dev.post('/defis/d1/solutions', { codeUrl: 'http://github.com/t/a', note: 'x' })).status, 400, 'https obligatoire');
    assert.equal((await dev.post('/defis/d2/solutions', { codeUrl: 'https://github.com/t/a', note: 'x' })).status, 404, 'un défi quiz n’a pas de solution');
    assert.equal((await dev.post('/defis/d1/solutions', { codeUrl: 'https://github.com/test/api-taches', note: 'Voici ma solution.' })).status, 204);
    assert.equal((await dev.post('/defis/d1/solutions', { codeUrl: 'https://github.com/test/api-taches', note: 'Encore.' })).status, 409);
    assert.equal((await dev.get('/defis/d1')).body.status, 'en_attente');

    const list = (await admin.get('/admin/solutions')).body;
    const sub = list.find((s) => s.codeUrl === 'https://github.com/test/api-taches');
    assert.ok(sub && sub.status === 'en_attente');
    assert.equal((await dev.get('/admin/solutions')).status, 403);
    assert.equal((await admin.post(`/admin/solutions/${sub.id}`, { approve: true })).status, 204);
    assert.equal((await admin.post(`/admin/solutions/${sub.id}`, { approve: true })).status, 409, 'décision déjà prise');

    const prog = (await dev.get('/moi/progression')).body;
    assert.equal(prog.points, sub.challenge.points);
    assert.ok(prog.badges.some((b) => b.id === 'b4'));
    assert.equal((await dev.get('/defis/d1')).body.status, 'reussi');
    assert.ok((await dev.get('/notifications')).body.some((n) => n.kind === 'validation'));
  });

  it('un refus permet de soumettre à nouveau', async () => {
    const dev = (await h.register(base)).client;
    const admin = await h.createAdmin(base);
    await dev.post('/defis/d4/solutions', { codeUrl: 'https://github.com/test/profil', note: 'v1' });
    const sub = (await admin.get('/admin/solutions')).body.find((s) => s.codeUrl === 'https://github.com/test/profil');
    assert.equal((await admin.post(`/admin/solutions/${sub.id}`, { approve: false })).status, 204);
    assert.equal((await dev.get('/defis/d4')).body.status, 'refuse');
    assert.equal(await points(dev), 0);
    assert.equal((await dev.post('/defis/d4/solutions', { codeUrl: 'https://github.com/test/profil', note: 'v2' })).status, 204);
  });
});

describe('Projets, revues, collaborations', () => {
  let owner, reviewer, other, pid;
  const project = { title: 'Mon super projet', summary: 'Un projet complet pour les tests.', description: 'Description détaillée.', techs: ['Node.js', 'SQL'], codeUrl: 'https://github.com/test/projet', seekingCollaborators: true };

  before(async () => {
    owner = (await h.register(base, { name: 'Propriétaire' })).client;
    reviewer = (await h.register(base, { name: 'Relecteur' })).client;
    other = (await h.register(base, { name: 'Autre' })).client;
  });

  it('valide la création : titre, résumé, techs, lien de code https, domaine vidéo YouTube/Vimeo', async () => {
    assert.equal((await owner.post('/projets', { ...project, title: 'abc' })).status, 400);
    assert.equal((await owner.post('/projets', { ...project, techs: [] })).status, 400);
    assert.equal((await owner.post('/projets', { ...project, codeUrl: 'http://github.com/x/y' })).status, 400);
    const badVideo = await owner.post('/projets', { ...project, videoUrl: 'https://site-malveillant.example/video' });
    assert.equal(badVideo.status, 400);
    assert.ok(badVideo.body.fields.videoUrl);
    assert.equal((await owner.post('/projets', { ...project, videoUrl: 'https://youtube.com.evil.example/watch?v=1' })).status, 400, 'un faux sous-domaine ne passe pas');
    const ok = await owner.post('/projets', { ...project, videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.points, 30);
    pid = ok.body.id;
    assert.ok((await owner.get('/moi/progression')).body.badges.some((b) => b.id === 'b5'), 'badge projet avec vidéo');
  });

  it('la page projet est publique ; la liste filtre par techno, collaborateurs et propriétaire', async () => {
    const anon = new h.Client(base);
    const d = await anon.get(`/projets/${pid}`);
    assert.equal(d.status, 200);
    assert.equal(d.body.hasVideo, true);
    assert.deepEqual(d.body.collabRequests, []);
    assert.ok((await anon.get('/projets?tech=Node.js')).body.items.some((p) => p.id === pid));
    assert.ok((await anon.get('/projets?seeking=true')).body.items.some((p) => p.id === pid));
    assert.ok((await anon.get('/projets?seeking=false')).body.items.some((p) => p.id === pid), 'seeking=false = pas de filtre (comme le mock), et ne plante pas');
    assert.equal((await anon.get('/projets?seeking=bidon')).status, 400);
    const username = d.body.owner.username;
    assert.ok((await anon.get(`/projets?owner=${username}`)).body.items.every((p) => p.owner.username === username));
    assert.equal((await anon.get('/projets/00000000-0000-4000-8000-000000000000')).status, 404);
  });

  it('revue : pas sur son propre projet (403), une seule par personne (409), note 1-5 et texte ≥ 10', async () => {
    assert.equal((await owner.post(`/projets/${pid}/revues`, { rating: 5, body: 'Je me note moi-même.' })).status, 403);
    assert.equal((await reviewer.post(`/projets/${pid}/revues`, { rating: 9, body: 'Note invalide mais texte long.' })).status, 400);
    assert.equal((await reviewer.post(`/projets/${pid}/revues`, { rating: 4, body: 'court' })).status, 400);
    assert.equal((await reviewer.post(`/projets/${pid}/revues`, { rating: 4, body: 'Très bon projet, bien structuré.' })).status, 204);
    assert.equal((await reviewer.post(`/projets/${pid}/revues`, { rating: 5, body: 'Une deuxième revue du même.' })).status, 409);
    assert.ok((await owner.get('/notifications')).body.some((n) => n.text.includes('Relecteur')));
  });

  it('seul le propriétaire valide la revue : +10 pts au relecteur, projet « vérifié » dans le portfolio', async () => {
    const rid = (await owner.get(`/projets/${pid}`)).body.reviews[0].id;
    assert.equal((await other.post(`/projets/${pid}/revues/${rid}/valider`)).status, 403);
    assert.equal((await reviewer.post(`/projets/${pid}/revues/${rid}/valider`)).status, 403);
    assert.equal((await owner.post(`/projets/${pid}/revues/${rid}/valider`)).status, 204);
    assert.equal(await points(reviewer), 10);
    const d = (await owner.get(`/projets/${pid}`)).body;
    assert.equal(d.validatedReviews, 1);
    assert.ok((await owner.get('/moi/portfolio')).body.verified.some((v) => v.id === `p-${pid}`));
  });

  it('le badge « Bon relecteur » arrive à la 3e revue validée, tous projets confondus', async () => {
    const rev = (await h.register(base, { name: 'Gros relecteur' })).client;
    let lastBadge = false;
    for (let i = 0; i < 3; i++) {
      const o = (await h.register(base)).client;
      const p = await o.post('/projets', { ...project, title: `Projet relu numéro ${i}` });
      assert.equal((await rev.post(`/projets/${p.body.id}/revues`, { rating: 5, body: 'Relecture détaillée et utile.' })).status, 204);
      const rid = (await o.get(`/projets/${p.body.id}`)).body.reviews[0].id;
      await o.post(`/projets/${p.body.id}/revues/${rid}/valider`);
      lastBadge = (await rev.get('/moi/progression')).body.badges.some((b) => b.id === 'b6');
      if (i < 2) assert.equal(lastBadge, false);
    }
    assert.equal(lastBadge, true);
  });

  it('demandes de collaboration : pas sur son projet (403), pas de doublon en attente (409), visibles du seul propriétaire', async () => {
    assert.equal((await owner.post(`/projets/${pid}/collaborations`, { role: 'Moi', message: 'Je me propose moi-même.' })).status, 403);
    assert.equal((await other.post(`/projets/${pid}/collaborations`, { role: '', message: 'Rôle manquant ici.' })).status, 400);
    assert.equal((await other.post(`/projets/${pid}/collaborations`, { role: 'Développeur front-end', message: 'Je peux faire l’interface.' })).status, 204);
    assert.equal((await other.post(`/projets/${pid}/collaborations`, { role: 'Autre rôle', message: 'Une deuxième demande.' })).status, 409);
    assert.deepEqual((await other.get(`/projets/${pid}`)).body.collabRequests, []);
    assert.deepEqual((await new h.Client(base).get(`/projets/${pid}`)).body.collabRequests, []);
    const mine = (await owner.get(`/projets/${pid}`)).body.collabRequests;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].status, 'en_attente');
    assert.equal(mine[0].from.email, undefined, 'jamais d’e-mail dans un PublicUser');

    assert.equal((await other.post(`/projets/${pid}/collaborations/${mine[0].id}`, { accept: true })).status, 403);
    assert.equal((await owner.post(`/projets/${pid}/collaborations/${mine[0].id}`, { accept: true })).status, 204);
    assert.equal((await owner.get(`/projets/${pid}`)).body.collabRequests[0].status, 'acceptee');
    assert.ok((await other.get('/notifications')).body.some((n) => n.kind === 'collaboration' && n.text.includes('accepté')));
  });

  it('les commentaires de projet sont tronqués à 500 caractères et notifient le propriétaire', async () => {
    assert.equal((await other.post(`/projets/${pid}/commentaires`, { body: 'y'.repeat(800) })).status, 204);
    const c = (await owner.get(`/projets/${pid}`)).body.comments.at(-1);
    assert.equal(c.body.length, 500);
    assert.equal((await other.post(`/projets/${pid}/commentaires`, { body: ' ' })).status, 400);
  });
});
