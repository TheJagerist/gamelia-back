// Données de DÉMONSTRATION pour la soutenance et les tests du jury (npm run seed:demo).
// Prérequis : npm run migrate && npm run seed (catalogues de référence).
//
// - Relançable : supprime d'abord les comptes dont l'e-mail se termine par @demo.gamelia
//   (le reste de la base n'est pas touché) puis recrée tout.
// - Tout le contenu est fictif. Mot de passe de tous les comptes de démo : Demo2026!
// - Les points affichés correspondent à l'historique inséré (point_events), comme si les
//   actions avaient été faites via l'API ; le plafond de 200 pts/jour est respecté.
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const PASSWORD = 'Demo2026!';
const DOMAIN = '@demo.gamelia';
const ago = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000);
const levelFor = (p) => (p >= 2000 ? 'Confirmé' : p >= 500 ? 'Intermédiaire' : 'Débutant');

// ---------------------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------------------
// [username, nom, pays, ville, compétences, bio, points, githubVérifié, email (optionnel)]
const DEVS = [
  ['fatou.diop', 'Fatou Diop', 'Sénégal', 'Dakar', ['JavaScript', 'Node.js', 'SQL'], 'Développeuse back-end, je construis des API pour le commerce mobile.', 640, true, 'dev' + DOMAIN],
  ['landry.kabongo', 'Landry Kabongo', 'RD Congo', 'Kinshasa', ['Node.js', 'API', 'SQL', 'Déploiement'], 'Ingénieur logiciel, passionné par les paiements mobiles et la fiabilité.', 2060, true],
  ['omar.benali', 'Omar Benali', 'Maroc', 'Casablanca', ['Python', 'API', 'Git'], 'Je fais de l’automatisation et du traitement de données avec Python.', 760, true],
  ['yao.kouassi', 'Yao Kouassi', "Côte d'Ivoire", 'Abidjan', ['Flutter', 'API'], 'Développeur mobile Flutter, applications utilisables hors connexion.', 520, false],
  ['moussa.fall', 'Moussa Fall', 'Sénégal', 'Thiès', ['React', 'JavaScript', 'HTML-CSS'], 'Front-end : interfaces légères pour les connexions lentes.', 380, false],
  ['sekou.camara', 'Sékou Camara', 'Guinée', 'Conakry', ['PHP', 'SQL'], 'Je modernise des applications PHP pour des PME.', 420, false],
  ['grace.mavoungou', 'Grâce Mavoungou', 'Congo', 'Brazzaville', ['PHP', 'JavaScript', 'HTML-CSS'], 'Autodidacte, je construis des sites pour les commerces de mon quartier.', 250, false],
  ['chantal.mballa', 'Chantal Mballa', 'Cameroun', 'Douala', ['HTML-CSS', 'JavaScript'], 'En reconversion vers le développement web.', 310, false],
  ['rania.mejri', 'Rania Mejri', 'Tunisie', 'Tunis', ['Python', 'SQL'], 'Étudiante en data, je découvre le développement d’API.', 180, false],
  ['awa.ndiaye', 'Awa Ndiaye', 'Sénégal', 'Saint-Louis', ['Git', 'HTML-CSS'], 'Je débute et je pose beaucoup de questions.', 150, false],
  ['mariam.ouedraogo', 'Mariam Ouédraogo', 'Burkina Faso', 'Ouagadougou', ['Java'], 'Étudiante en informatique, j’apprends Java et les bases de données.', 90, false],
  ['joel.agbo', 'Joël Agbo', 'Bénin', 'Cotonou', ['JavaScript'], 'Nouveau sur Gamelia.', 0, false],
];

async function insert(c, table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
  return (await c.query(sql, keys.map((k) => row[k]))).rows[0];
}

// Historique de points réaliste, réparti sur plusieurs jours (≤ 200 pts/jour).
async function addHistory(c, userId, total, todayExtra = 0) {
  const pattern = [10, 15, 30, 5, 25, 60, 10, 40, 15, 25];
  const labels = [
    'Réponse à une question', 'Leçon réussie : La structure d’une page HTML', 'Défi réussi : Les bases de JavaScript',
    'Réponse votée utile', 'Leçon réussie : Requête et réponse HTTP', 'Projet publié', 'Revue validée sur un projet',
  ];
  let left = total - todayExtra;
  let day = 2, daySum = 0, i = 0;
  while (left > 0) {
    const pts = Math.min(pattern[i % pattern.length], left);
    await insert(c, 'point_events', { user_id: userId, label: labels[i % labels.length], points: pts, created_at: ago(day, i % 5) });
    left -= pts; daySum += pts; i++;
    if (daySum >= 120) { day++; daySum = 0; }
  }
  if (todayExtra > 0) {
    await insert(c, 'point_events', { user_id: userId, label: 'Réponse votée utile', points: todayExtra, created_at: ago(0, 1) });
  }
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows: ref } = await client.query('SELECT (SELECT count(*) FROM badges) AS b, (SELECT count(*) FROM challenges) AS c');
    if (Number(ref[0].b) === 0 || Number(ref[0].c) === 0) throw new Error('Catalogues vides : lancez d’abord `npm run seed`.');

    await client.query('BEGIN');
    const del = await client.query(`DELETE FROM users WHERE email LIKE '%${DOMAIN}'`);
    if (del.rowCount) console.log(`[seed:demo] ${del.rowCount} ancien(s) compte(s) de démo supprimé(s).`);

    const hash = await bcrypt.hash(PASSWORD, 12);
    const U = {}; // username -> ligne users
    const mkUser = async (o) => {
      const u = await insert(client, 'users', { password_hash: hash, joined_at: ago(14), ...o });
      await client.query('INSERT INTO user_settings (user_id) VALUES ($1)', [u.id]);
      U[u.username] = u;
      return u;
    };

    // --- Admin et recruteurs ---
    const admin = await mkUser({ username: 'equipe.gamelia', name: 'Équipe Gamelia', email: 'admin' + DOMAIN, role: 'admin', country: 'Sénégal', bio: 'Compte administrateur de démonstration.' });
    const rec = await mkUser({ username: 'aissatou.ndiaye', name: 'Aïssatou Ndiaye', email: 'recruteur' + DOMAIN, role: 'recruteur', country: 'Sénégal', city: 'Dakar', company: 'Baobab Tech', recruiter_status: 'valide', bio: 'Responsable technique chez Baobab Tech.' });
    const recWait = await mkUser({ username: 'eric.rakoto', name: 'Éric Rakoto', email: 'recruteur.attente' + DOMAIN, role: 'recruteur', country: 'Madagascar', city: 'Antananarivo', company: 'Tsiky Digital', recruiter_status: 'en_attente', joined_at: ago(0, 3) });

    // --- Développeurs ---
    for (const [username, name, country, city, skills, bio, points, gh, email] of DEVS) {
      await mkUser({ username, name, email: email || `${username}${DOMAIN}`, role: 'developpeur', country, city, skills, bio, points, level: levelFor(points), github_verified: gh });
    }
    const dv = (n) => U[n].id;

    // Historique de points (Fatou : 35 pts aujourd'hui pour montrer la jauge du plafond).
    for (const d of DEVS) await addHistory(client, dv(d[0]), d[6], d[0] === 'fatou.diop' ? 35 : 0);

    // Liens déclarés et technologies suivies
    const links = {
      'fatou.diop': [['github', 'GitHub', 'https://github.com/fatou-diop-demo'], ['site', 'Site personnel', 'https://fatou-diop.example.com'], ['projet', 'Carnet de recettes', 'https://recettes.example.com']],
      'landry.kabongo': [['github', 'GitHub', 'https://github.com/landry-kabongo-demo'], ['site', 'Blog technique', 'https://landry.example.com']],
      'omar.benali': [['github', 'GitHub', 'https://github.com/omar-benali-demo']],
      'yao.kouassi': [['github', 'GitHub', 'https://github.com/yao-kouassi-demo']],
    };
    for (const [u, list] of Object.entries(links)) {
      for (let i = 0; i < list.length; i++) await insert(client, 'declared_links', { user_id: dv(u), kind: list[i][0], label: list[i][1], url: list[i][2], position: i });
    }
    for (const t of ['JavaScript', 'Node.js']) await client.query('INSERT INTO followed_tags (user_id, tag) VALUES ($1,$2)', [dv('fatou.diop'), t]);

    // --- Apprentissage et défis ---
    const lessons = { 'landry.kabongo': ['web-1', 'web-2', 'web-3', 'api-1', 'api-2', 'api-3', 'git-1', 'git-2', 'git-3'], 'fatou.diop': ['web-1', 'web-2', 'web-3', 'api-1'], 'omar.benali': ['web-1', 'web-2', 'api-1', 'api-2', 'api-3'], 'yao.kouassi': ['web-1', 'web-2'], 'moussa.fall': ['web-1', 'web-2', 'web-3'], 'awa.ndiaye': ['web-1'] };
    for (const [u, ls] of Object.entries(lessons)) for (const l of ls) await client.query('INSERT INTO user_lesson_progress (user_id, lesson_id, completed_at) VALUES ($1,$2,$3)', [dv(u), l, ago(3)]);

    const status = async (u, ch, st) => client.query('INSERT INTO user_challenge_status (user_id, challenge_id, status, updated_at) VALUES ($1,$2,$3,$4)', [dv(u), ch, st, ago(2)]);
    const validSubmission = async (u, ch) => insert(client, 'practical_submissions', { challenge_id: ch, dev_id: dv(u), code_url: `https://github.com/${u.replace('.', '-')}-demo/${ch}`, note: 'Solution livrée avec un README.', status: 'valide', created_at: ago(5), decided_at: ago(4) });
    for (const ch of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) { await status('landry.kabongo', ch, 'reussi'); }
    for (const ch of ['d1', 'd4', 'd6']) await validSubmission('landry.kabongo', ch);
    for (const ch of ['d2', 'd5']) await status('fatou.diop', ch, 'reussi');
    await status('fatou.diop', 'd3', 'echoue');
    await status('fatou.diop', 'd1', 'en_attente');
    await insert(client, 'practical_submissions', { challenge_id: 'd1', dev_id: dv('fatou.diop'), code_url: 'https://github.com/fatou-diop-demo/api-taches', note: 'API en Express avec tests, README et exemples curl.', status: 'en_attente', created_at: ago(0, 5) });
    await status('moussa.fall', 'd4', 'en_attente');
    await insert(client, 'practical_submissions', { challenge_id: 'd4', dev_id: dv('moussa.fall'), code_url: 'https://github.com/moussa-fall-demo/profil-responsive', note: 'Testée à 360 px sur Chrome Android.', status: 'en_attente', created_at: ago(0, 9) });
    for (const u of ['omar.benali', 'yao.kouassi']) { await status(u, 'd2', 'reussi'); await status(u, 'd5', 'reussi'); }
    await status('omar.benali', 'd3', 'reussi');
    await validSubmission('omar.benali', 'd4'); await status('omar.benali', 'd4', 'reussi');

    // --- Badges ---
    const badges = { 'landry.kabongo': ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b8'], 'fatou.diop': ['b1', 'b2', 'b4', 'b5', 'b6', 'b8'], 'omar.benali': ['b1', 'b4', 'b8'], 'yao.kouassi': ['b1', 'b4'], 'moussa.fall': ['b1'], 'sekou.camara': ['b1'], 'awa.ndiaye': ['b1'] };
    for (const [u, bs] of Object.entries(badges)) for (const b of bs) await client.query('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES ($1,$2,$3)', [dv(u), b, ago(3)]);

    // --- Questions, réponses, commentaires, votes ---
    // [auteur, titre, corps, tags, joursAvant, code?, [réponses: [auteur, corps, joursAvant, code?, estMeilleure?, [commentaires: [auteur, texte]]]]]
    const QUESTIONS = [
      ['chantal.mballa', 'Comment centrer une div horizontalement et verticalement ?', 'J’ai essayé margin: auto mais ma div reste collée en haut de la page. Comment la centrer au milieu de l’écran, aussi sur téléphone ?', ['HTML-CSS'], 9, null, [
        ['yao.kouassi', 'Utilise Flexbox sur le conteneur parent : il suffit de lui donner la hauteur de l’écran, puis de centrer dans les deux sens.', 8, ['css', '.parent {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}'], true, [['chantal.mballa', 'Ça marche, merci beaucoup !']]],
        ['moussa.fall', 'Grid fonctionne aussi : display: grid; place-items: center; sur le parent donne le même résultat en une ligne.', 8, null, false, []],
      ]],
      ['joel.agbo', 'Quelle est la différence entre let, const et var en JavaScript ?', 'Je vois les trois dans des tutoriels différents. Lequel dois-je utiliser et pourquoi var est-il déconseillé ?', ['JavaScript'], 7, null, [
        ['fatou.diop', 'Préférez const par défaut, let quand la valeur doit changer. var a une portée de fonction et est « remonté » (hoisting), ce qui cause des bugs difficiles à trouver.', 7, null, true, [['joel.agbo', 'Très clair, merci !']]],
        ['omar.benali', 'En résumé : const et let ont une portée de bloc, var non. Le code moderne n’utilise presque plus var.', 6, null, false, []],
      ]],
      ['moussa.fall', 'Pourquoi mon fetch échoue avec une erreur CORS ?', 'Mon front sur localhost:3000 appelle mon API sur localhost:4000 et la console affiche une erreur CORS. Comment corriger ?', ['JavaScript', 'API'], 6, ['javascript', "fetch('http://localhost:4000/questions', { credentials: 'include' })"], [
        ['landry.kabongo', 'Le navigateur bloque la réponse tant que l’API ne l’autorise pas. Côté serveur, autorisez l’origine exacte du front et activez les cookies (credentials) ; avec credentials, le joker * est interdit.', 6, ['javascript', "app.use(cors({\n  origin: 'http://localhost:3000',\n  credentials: true,\n}));"], true, [['moussa.fall', 'Je n’avais pas vu que * était interdit avec credentials. Résolu.'], ['fatou.diop', 'N’oubliez pas la même origine exacte en production.']]],
      ]],
      ['yao.kouassi', 'Comment éviter les injections SQL avec Node.js et PostgreSQL ?', 'Je construis mes requêtes en concaténant des chaînes avec les données du formulaire. On m’a dit que c’est dangereux. Quelle est la bonne méthode ?', ['SQL', 'Node.js'], 5, null, [
        ['landry.kabongo', 'Ne concaténez jamais : utilisez des requêtes paramétrées. Le pilote envoie les valeurs séparément de la requête, donc elles ne peuvent pas être interprétées comme du SQL.', 5, ['javascript', "await pool.query(\n  'SELECT * FROM users WHERE email = $1',\n  [email]\n);"], true, []],
        ['fatou.diop', 'Ajoutez aussi une validation des entrées côté serveur (par exemple avec zod) : c’est une seconde barrière.', 4, null, false, []],
      ]],
      ['awa.ndiaye', 'Git : comment annuler mon dernier commit sans perdre mes modifications ?', 'J’ai commité trop vite, un fichier ne devait pas y être. Comment revenir en arrière mais garder mon travail ?', ['Git'], 4, null, [
        ['omar.benali', 'Utilise git reset --soft HEAD~1 : le commit disparaît mais les modifications restent dans la zone d’index. Si tu l’as déjà poussé, ne réécris pas l’historique partagé.', 4, ['bash', 'git reset --soft HEAD~1\ngit status'], true, []],
      ]],
      ['sekou.camara', 'Quelle architecture pour une application Flutter qui fonctionne hors connexion ?', 'Je dois permettre la saisie sans réseau puis synchroniser. Faut-il une base locale ? Comment gérer les conflits ?', ['Flutter', 'API'], 3, null, [
        ['yao.kouassi', 'Oui : stockez localement (SQLite) et gardez une file d’actions à rejouer au retour du réseau. Pour les conflits, la règle « dernier modifié gagne » suffit souvent pour commencer.', 3, null, false, [['sekou.camara', 'Merci, je commence par la file d’actions.']]],
      ]],
      ['fatou.diop', 'Comment déployer une API Node.js sur un VPS avec HTTPS ?', 'J’ai un VPS Ubuntu et un nom de domaine. Quelle est la méthode simple pour lancer mon API en continu avec un certificat HTTPS ?', ['Node.js', 'Déploiement'], 2, null, []],
      ['rania.mejri', 'Python : quelle différence entre une liste et un tuple ?', 'Je comprends que le tuple ne se modifie pas, mais quand est-ce vraiment utile ?', ['Python'], 1, null, [
        ['omar.benali', 'Un tuple exprime « ces valeurs vont ensemble et ne changent pas » (coordonnées, couple clé/valeur). Il peut aussi servir de clé de dictionnaire, contrairement à une liste.', 1, null, false, []],
      ]],
    ];

    const Q = []; // { id, titre, answers: [{id}] }
    for (const [author, title, body, tags, days, code, answers] of QUESTIONS) {
      const q = await insert(client, 'questions', { title, body, author_id: dv(author), created_at: ago(days), ...(code ? { code_lang: code[0], code_content: code[1] } : {}) });
      for (const t of tags) await client.query('INSERT INTO question_tags (question_id, tag) VALUES ($1,$2)', [q.id, t]);
      const rec = { id: q.id, title, author, answers: [] };
      for (const [aAuthor, aBody, aDays, aCode, best, comments] of answers) {
        const a = await insert(client, 'answers', { question_id: q.id, author_id: dv(aAuthor), body: aBody, created_at: ago(aDays, 2), ...(aCode ? { code_lang: aCode[0], code_content: aCode[1] } : {}) });
        for (const [cAuthor, cBody] of comments) await insert(client, 'answer_comments', { answer_id: a.id, author_id: dv(cAuthor), body: cBody, created_at: ago(Math.max(0, aDays - 1)) });
        if (best) await client.query('UPDATE questions SET best_answer_id = $1 WHERE id = $2', [a.id, q.id]);
        rec.answers.push({ id: a.id, author: aAuthor, best });
      }
      Q.push(rec);
    }
    // Votes : +1 des autres membres sur les meilleures réponses et quelques questions (jamais sur son propre contenu).
    const vote = async (voter, q, targetId, type) => {
      await insert(client, 'votes', { user_id: dv(voter), question_id: q.id, target_type: type, target_id: targetId, direction: 1 });
      await client.query(`UPDATE ${type === 'answer' ? 'answers' : 'questions'} SET votes = votes + 1 WHERE id = $1`, [targetId]);
    };
    const voters = Object.keys(U).filter((n) => !['equipe.gamelia', 'aissatou.ndiaye', 'eric.rakoto'].includes(n));
    for (const q of Q) {
      for (const a of q.answers.filter((x) => x.best)) {
        for (const v of voters.filter((x) => x !== a.author && x !== q.author).slice(0, 3)) await vote(v, q, a.id, 'answer');
      }
      for (const v of voters.filter((x) => x !== q.author).slice(0, 2)) await vote(v, q, q.id, 'question');
    }

    // --- Projets ---
    const VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // film libre (Blender), uniquement pour la démo
    // [propriétaire, titre, résumé, description, techs, vidéo, codeUrl, cherche collaborateurs, jours]
    const PROJECTS = [
      ['landry.kabongo', 'Moteur de paiement Mobile Money (démo)', 'Une API de paiement avec idempotence, webhooks et journal d’audit.', 'API REST en Node.js et PostgreSQL qui simule des paiements Mobile Money : clés d’idempotence pour éviter les doubles débits, webhooks signés et tableau de bord des transactions. Tests automatisés inclus.', ['Node.js', 'API', 'SQL'], VIDEO, 'https://github.com/landry-kabongo-demo/paiement-demo', true, 8],
      ['fatou.diop', 'Carnet de recettes africaines', 'Un site léger pour partager des recettes, optimisé pour les connexions lentes.', 'Application React qui charge moins de 100 Ko par page : recettes classées par pays, mode hors connexion pour la lecture, et formulaire d’ajout avec photo compressée.', ['React', 'JavaScript'], null, 'https://github.com/fatou-diop-demo/recettes', false, 6],
      ['yao.kouassi', 'Suivi de stock pour boutiques', 'Application Flutter de gestion de stock qui fonctionne sans réseau.', 'Saisie des entrées et sorties hors connexion, synchronisation automatique au retour du réseau et alerte de rupture. Pensée pour les petits commerces.', ['Flutter', 'API'], VIDEO, 'https://github.com/yao-kouassi-demo/stock', true, 5],
      ['omar.benali', 'Rappels de vaccination par SMS', 'Un script Python qui envoie des rappels de vaccination aux parents.', 'Lecture d’un fichier de rendez-vous, calcul des prochaines échéances et envoi de SMS via une passerelle. Rapport d’envoi en CSV.', ['Python', 'API'], null, 'https://github.com/omar-benali-demo/rappels-sms', false, 4],
      ['grace.mavoungou', 'Portail d’annonces locales', 'Un petit portail d’annonces pour les commerces d’un quartier.', 'Site PHP avec dépôt d’annonces, catégories et contact par téléphone. Hébergé sur un serveur mutualisé.', ['PHP'], null, 'https://github.com/grace-mavoungou-demo/annonces', true, 2],
    ];
    const P = {};
    for (const [owner, title, summary, description, techs, video, codeUrl, seeking, days] of PROJECTS) {
      const p = await insert(client, 'projects', { title, summary, description, owner_id: dv(owner), video_url: video, code_url: codeUrl, seeking_collaborators: seeking, created_at: ago(days) });
      for (const t of techs) await client.query('INSERT INTO project_techs (project_id, tech) VALUES ($1,$2)', [p.id, t]);
      P[owner] = p;
    }
    const review = (project, author, rating, body, validated, days) =>
      insert(client, 'project_reviews', { project_id: P[project].id, author_id: dv(author), rating, body, validated_by_owner: validated, created_at: ago(days) });
    await review('landry.kabongo', 'fatou.diop', 5, 'Architecture claire, l’idempotence est bien gérée. Les tests donnent confiance.', true, 7);
    await review('landry.kabongo', 'omar.benali', 4, 'Très bon projet. Il manque un exemple de configuration pour les webhooks.', true, 6);
    await review('yao.kouassi', 'fatou.diop', 4, 'La synchronisation hors connexion est bien pensée, la démo est convaincante.', true, 4);
    await review('omar.benali', 'fatou.diop', 5, 'Simple et utile. Le rapport CSV est un vrai plus pour le suivi.', true, 3);
    await review('fatou.diop', 'yao.kouassi', 4, 'Site rapide, les recettes se lisent bien même en connexion lente.', false, 2); // à valider par Fatou
    await insert(client, 'project_comments', { project_id: P['landry.kabongo'].id, author_id: dv('moussa.fall'), body: 'Bravo pour la clarté du README !', created_at: ago(6) });
    await insert(client, 'project_comments', { project_id: P['fatou.diop'].id, author_id: dv('chantal.mballa'), body: 'J’adore l’idée, pouvez-vous ajouter des recettes du Cameroun ?', created_at: ago(3) });
    await insert(client, 'collab_requests', { project_id: P['landry.kabongo'].id, from_id: dv('moussa.fall'), role: 'Développeur front-end', message: 'Je peux construire le tableau de bord des transactions en React.', status: 'en_attente', created_at: ago(2) });
    await insert(client, 'collab_requests', { project_id: P['fatou.diop'].id, from_id: dv('joel.agbo'), role: 'Rédaction de recettes', message: 'Je peux ajouter des recettes du Bénin et relire les textes.', status: 'en_attente', created_at: ago(1) });
    await insert(client, 'collab_requests', { project_id: P['yao.kouassi'].id, from_id: dv('fatou.diop'), role: 'API de synchronisation', message: 'Je propose de construire l’API de synchronisation en Node.js.', status: 'acceptee', created_at: ago(4) });

    // --- Défis recruteurs ---
    const rc = async (title, summary, brief, skills, country, deadlineDays, reward, st, createdDays) => {
      const c = await insert(client, 'recruiter_challenges', { recruiter_id: rec.id, title, summary, brief, country, remote: true, deadline: ago(-deadlineDays), reward, status: st, created_at: ago(createdDays) });
      for (const s of skills) await client.query('INSERT INTO recruiter_challenge_skills (challenge_id, skill) VALUES ($1,$2)', [c.id, s]);
      return c;
    };
    const rc1 = await rc('API de paiement Mobile Money (version démo)', 'Concevoir une API de paiement fiable, avec idempotence et webhooks.', 'Concevez une API REST qui gère des paiements Mobile Money : création de paiement, clé d’idempotence, webhook de confirmation signé et tests automatisés. Fournissez un README expliquant vos choix et un lien vers une démo en ligne ou une vidéo.', ['Node.js', 'API', 'SQL'], 'Sénégal', 20, 'Contrat de 3 mois', 'publie', 6);
    const rc2 = await rc('Tableau de bord de suivi des ventes', 'Un tableau de bord lisible pour suivre les ventes quotidiennes.', 'Construisez un tableau de bord web (React ou équivalent) affichant les ventes du jour, de la semaine et par produit à partir d’un fichier JSON fourni. L’interface doit rester rapide sur un téléphone en connexion 3G.', ['React', 'JavaScript'], 'Sénégal', 12, 'Mission de 6 semaines', 'publie', 4);
    await rc('Application mobile de collecte de données terrain', 'Une application de collecte qui fonctionne sans connexion.', 'Réalisez une application mobile permettant de remplir des formulaires de terrain sans réseau et de les synchroniser ensuite avec une API. Décrivez votre stratégie de gestion des conflits.', ['Flutter', 'API'], 'Sénégal', 25, 'À discuter', 'en_attente', 0);
    const rc4 = await rc('Outil d’import de fichiers CSV', 'Importer des fichiers CSV volumineux sans bloquer le serveur.', 'Proposez un import de fichiers CSV de plusieurs centaines de milliers de lignes, avec rapport d’erreurs par ligne.', ['Python', 'SQL'], 'Sénégal', -5, 'Mission courte', 'cloture', 20);

    const app = (challenge, dev, o) => insert(client, 'applications', { challenge_id: challenge.id, dev_id: dv(dev), created_at: ago(2), ...o });
    await app(rc1, 'landry.kabongo', { code_url: 'https://github.com/landry-kabongo-demo/paiement-demo', demo_url: VIDEO, message: 'Solution complète : idempotence par clé, webhooks signés HMAC, 42 tests automatisés et journal d’audit.', status: 'retenue', score: 5, feedback: 'Excellent travail : robuste, bien testé et très bien documenté.', proposal: 'Nous aimerions vous proposer une mission de 3 mois pour développer notre passerelle de paiement. Disponible pour un appel cette semaine ?' });
    await app(rc1, 'omar.benali', { code_url: 'https://github.com/omar-benali-demo/paiement-python', message: 'Version Python avec FastAPI : idempotence, webhooks et tests de charge de base.', status: 'evaluee', score: 3, feedback: 'Bonne base, mais la gestion des doubles notifications reste à renforcer.' });
    await app(rc1, 'fatou.diop', { code_url: 'https://github.com/fatou-diop-demo/paiement-express', demo_url: VIDEO, message: 'API Express + PostgreSQL : idempotence par clé unique, vérification de signature des webhooks et tests.', status: 'recue', created_at: ago(0, 6) });
    await app(rc4, 'rania.mejri', { code_url: 'https://github.com/rania-mejri-demo/import-csv', message: 'Import par lots avec COPY et rapport d’erreurs par ligne en CSV.', status: 'non_retenue', score: 2, feedback: 'Pas assez de tests sur les fichiers mal formés.' });

    // --- Signalements ouverts (pour l'espace admin) ---
    const reportTarget = Q[2].answers[0].id; // réponse sur le CORS
    await insert(client, 'reports', { target_type: 'reponse', target_id: reportTarget, reason: 'Contenu inapproprié', details: 'Démonstration : réponse signalée pour que l’admin puisse la traiter.', reporter_id: dv('awa.ndiaye'), created_at: ago(0, 4) });
    await insert(client, 'reports', { target_type: 'projet', target_id: P['grace.mavoungou'].id, reason: 'Spam', reporter_id: dv('moussa.fall'), created_at: ago(0, 2) });

    // --- Notifications ---
    const note = (u, kind, text, href, read, days, hours = 0) => insert(client, 'notifications', { user_id: u.id, kind, text, href, read, created_at: ago(days, hours) });
    await note(U['fatou.diop'], 'badge', 'Vous avez obtenu le badge « Bon relecteur ».', '/progression', true, 3);
    await note(U['fatou.diop'], 'commentaire', 'Yao Kouassi a évalué votre projet « Carnet de recettes africaines ».', `/projets/${P['fatou.diop'].id}`, false, 2);
    await note(U['fatou.diop'], 'collaboration', 'Joël Agbo propose de rejoindre « Carnet de recettes africaines » comme Rédaction de recettes.', `/projets/${P['fatou.diop'].id}`, false, 1);
    await note(U['fatou.diop'], 'collaboration', 'Yao Kouassi a accepté votre demande sur « Suivi de stock pour boutiques ».', `/projets/${P['yao.kouassi'].id}`, true, 3);
    await note(admin, 'validation', 'Éric Rakoto (Tsiky Digital) a demandé un compte recruteur.', '/admin/validations', false, 0, 3);
    await note(admin, 'validation', 'Nouveau défi recruteur à valider : Application mobile de collecte de données terrain.', '/admin/validations', false, 0, 1);
    await note(rec, 'candidature', 'Nouvelle candidature de Fatou Diop sur « API de paiement Mobile Money (version démo) ».', `/recruteur/defis/${rc1.id}`, false, 0, 6);

    await client.query('COMMIT');
    console.log(`[seed:demo] terminé : ${DEVS.length} développeurs, 1 admin, 2 recruteurs, ${QUESTIONS.length} questions, ${PROJECTS.length} projets, 4 défis recruteurs.`);
    console.log(`[seed:demo] mot de passe de tous les comptes de démo : ${PASSWORD}`);
    console.log('[seed:demo] comptes : dev@demo.gamelia (développeuse), recruteur@demo.gamelia (validé), recruteur.attente@demo.gamelia (en attente), admin@demo.gamelia');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[seed:demo] échec :', err.message);
  process.exit(1);
});
