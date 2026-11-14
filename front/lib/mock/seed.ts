// Données de démonstration. Même forme que les réponses prévues de l'API.
// Utilisées seulement en mode démonstration (NEXT_PUBLIC_API_MOCK=true) ; absentes du site réel.
import type { Badge, Level, LessonBlock, QuizQuestion, User } from '../types';

const d = (daysAgo: number, h = 10) => {
  // Dates relatives au jour de la démo, pour que « il y a 2 heures » reste vrai.
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - daysAgo);
  if (daysAgo > 0) t.setUTCHours(h);
  else t.setTime(Date.now() - Math.max(1, 12 - h) * 3600000);
  return t.toISOString();
};

export { COUNTRIES, TAGS } from '../constants';

export interface DbUser extends User { password: string }

export const users: DbUser[] = [
  { id: 'u1', username: 'awa.diop', name: 'Awa Diop', email: 'awa@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Sénégal', city: 'Dakar', bio: "Étudiante en licence informatique. J'apprends le back-end avec Python et j'aime aider les débutants.", skills: ['Python', 'Django', 'SQL'], level: 'Intermédiaire', points: 1240, githubVerified: true, links: [{ kind: 'github', label: 'github.com/awadiop', url: 'https://github.com/awadiop' }, { kind: 'site', label: 'awa.dev', url: 'https://awa.dev' }], joinedAt: d(120), following: ['Python', 'Django'] },
  { id: 'u2', username: 'koffi.mensah', name: 'Koffi Mensah', email: 'koffi@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Togo', city: 'Lomé', bio: 'Développeur full-stack JavaScript. Trois ans de missions freelance pour des PME.', skills: ['JavaScript', 'React', 'Node.js', 'API'], level: 'Confirmé', points: 3870, githubVerified: true, links: [{ kind: 'github', label: 'github.com/koffim', url: 'https://github.com/koffim' }], joinedAt: d(300) },
  { id: 'u3', username: 'mireille.nkoghe', name: 'Mireille Nkoghe', email: 'mireille@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Gabon', city: 'Libreville', bio: 'Développeuse mobile Flutter. Je construis des applications qui marchent hors connexion.', skills: ['Flutter', 'Dart', 'API'], level: 'Confirmé', points: 2950, githubVerified: false, links: [{ kind: 'github', label: 'github.com/mnkoghe', url: 'https://github.com/mnkoghe' }, { kind: 'projet', label: 'Stock Facile sur le Play Store', url: 'https://play.google.com' }], joinedAt: d(210) },
  { id: 'u4', username: 'jean.kabila', name: 'Jean-Marc Ilunga', email: 'jeanmarc@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'RD Congo', city: 'Kinshasa', bio: 'PHP et Laravel au quotidien, curieux de tout le reste.', skills: ['PHP', 'Laravel', 'SQL'], level: 'Intermédiaire', points: 1810, githubVerified: true, links: [], joinedAt: d(150) },
  { id: 'u5', username: 'fatou.traore', name: 'Fatou Traoré', email: 'fatou@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Mali', city: 'Bamako', bio: 'Je débute en développement web. Objectif : mon premier stage cette année.', skills: ['HTML-CSS', 'JavaScript'], level: 'Débutant', points: 320, githubVerified: false, links: [], joinedAt: d(25) },
  { id: 'u6', username: 'yannick.essomba', name: 'Yannick Essomba', email: 'yannick@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Cameroun', city: 'Douala', bio: 'DevOps et Linux. Je mets en ligne ce que les autres construisent.', skills: ['Déploiement', 'Git', 'Node.js'], level: 'Confirmé', points: 2410, githubVerified: true, links: [{ kind: 'github', label: 'github.com/yessomba', url: 'https://github.com/yessomba' }], joinedAt: d(260) },
  { id: 'u7', username: 'aicha.bamba', name: 'Aïcha Bamba', email: 'aicha@demo.gamelia', password: 'demo1234', role: 'developpeur', country: "Côte d'Ivoire", city: 'Abidjan', bio: 'Data et Python. Je transforme des fichiers Excel en tableaux de bord.', skills: ['Python', 'SQL', 'API'], level: 'Intermédiaire', points: 1530, githubVerified: false, links: [], joinedAt: d(95) },
  { id: 'u8', username: 'patrick.uwimana', name: 'Patrick Uwimana', email: 'patrick@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Rwanda', city: 'Kigali', bio: 'Java et Spring en entreprise, React le soir.', skills: ['Java', 'React'], level: 'Confirmé', points: 2120, githubVerified: true, links: [], joinedAt: d(180) },
  { id: 'u9', username: 'gaby.alila', name: 'Gaby Alila', email: 'gaby@demo.gamelia', password: 'demo1234', role: 'developpeur', country: 'Gabon', city: 'Libreville', bio: "Élève ingénieure en génie industriel. Je relie le terrain et le code.", skills: ['JavaScript', 'React', 'Python'], level: 'Intermédiaire', points: 860, githubVerified: false, links: [{ kind: 'github', label: 'github.com/gabyalila', url: 'https://github.com/gabyalila' }], joinedAt: d(40), following: ['React'] },
  { id: 'r1', username: 'nadia.kivutech', name: 'Nadia Mbuyi', email: 'recruteur@demo.gamelia', password: 'demo1234', role: 'recruteur', country: 'RD Congo', city: 'Kinshasa', bio: 'Responsable technique chez Kivu Tech, éditeur de logiciels de gestion.', skills: [], level: 'Confirmé', points: 0, githubVerified: false, links: [], joinedAt: d(30), company: 'Kivu Tech', recruiterStatus: 'valide' },
  { id: 'r2', username: 'samuel.baobab', name: 'Samuel Ondo', email: 'samuel@demo.gamelia', password: 'demo1234', role: 'recruteur', country: 'Gabon', city: 'Libreville', bio: 'Fondateur de Baobab Pay, paiement mobile.', skills: [], level: 'Confirmé', points: 0, githubVerified: false, links: [], joinedAt: d(3), company: 'Baobab Pay', recruiterStatus: 'en_attente' },
  { id: 'r3', username: 'lina.sahel', name: 'Lina Coulibaly', email: 'lina@demo.gamelia', password: 'demo1234', role: 'recruteur', country: 'Burkina Faso', city: 'Ouagadougou', bio: 'Recrutement pour Sahel Data.', skills: [], level: 'Confirmé', points: 0, githubVerified: false, links: [], joinedAt: d(1), company: 'Sahel Data', recruiterStatus: 'en_attente' },
  { id: 'a1', username: 'equipe.gamelia', name: 'Équipe Gamelia', email: 'admin@demo.gamelia', password: 'demo1234', role: 'admin', country: 'Gabon', bio: 'Modération et validation.', skills: [], level: 'Confirmé', points: 0, githubVerified: false, links: [], joinedAt: d(400) },
];

export interface DbComment { id: string; authorId: string; body: string; createdAt: string }
export interface DbAnswer { id: string; authorId: string; body: string; code?: { lang: string; content: string }; createdAt: string; votes: number; comments: DbComment[] }
export interface DbQuestion { id: string; title: string; body: string; code?: { lang: string; content: string }; tags: string[]; authorId: string; createdAt: string; votes: number; bestAnswerId?: string; answers: DbAnswer[] }

export const questions: DbQuestion[] = [
  {
    id: 'q1', title: 'Comment connecter mon application à une API ?', tags: ['Python', 'API'], authorId: 'u1', createdAt: d(0, 8), votes: 12,
    body: "Mon formulaire envoie les données, mais je ne reçois rien en retour. Le serveur répond 200 et pourtant ma variable reste vide. J'utilise la bibliothèque requests.",
    code: { lang: 'python', content: "import requests\n\nreponse = requests.post(URL, data=formulaire)\nresultat = reponse.json\nprint(resultat)" },
    bestAnswerId: 'a1',
    answers: [
      { id: 'a1', authorId: 'u2', createdAt: d(0, 9), votes: 9, body: "Il manque les parenthèses : reponse.json est une méthode. Sans elles, tu affiches la fonction elle-même, pas les données. Vérifie aussi que l'API attend du JSON et pas un formulaire.", code: { lang: 'python', content: "reponse = requests.post(URL, json=formulaire, timeout=10)\nreponse.raise_for_status()\nresultat = reponse.json()\nprint(resultat)" }, comments: [{ id: 'c1', authorId: 'u1', body: "C'était exactement ça, merci ! Le timeout est une bonne idée aussi.", createdAt: d(0, 9) }] },
      { id: 'a2', authorId: 'u3', createdAt: d(0, 10), votes: 3, body: "Je peux te montrer mon projet qui fait la même chose, avec une courte vidéo. Regarde la partie où j'affiche la réponse dans la console.", comments: [] },
    ],
  },
  {
    id: 'q2', title: 'Laravel : erreur 419 « Page expired » sur mon formulaire', tags: ['PHP', 'Laravel'], authorId: 'u4', createdAt: d(0, 6), votes: 7,
    body: "À chaque envoi de mon formulaire de contact, j'obtiens une page 419. En local tout marchait, le problème est apparu après la mise en ligne.",
    answers: [
      { id: 'a3', authorId: 'u6', createdAt: d(0, 7), votes: 5, body: "Vérifie que @csrf est bien dans le formulaire, puis regarde SESSION_DOMAIN et APP_URL dans le .env du serveur : si le domaine ne correspond pas, le cookie de session n'est jamais renvoyé.", comments: [] },
    ],
  },
  {
    id: 'q3', title: 'Flutter : garder les données quand le téléphone perd la connexion', tags: ['Flutter'], authorId: 'u5', createdAt: d(1, 14), votes: 15,
    body: "Mes utilisateurs perdent souvent le réseau. Quelle est la façon la plus simple d'enregistrer les saisies et de les envoyer plus tard ?",
    bestAnswerId: 'a4',
    answers: [
      { id: 'a4', authorId: 'u3', createdAt: d(1, 15), votes: 11, body: "Enregistre chaque saisie dans une base locale (sqflite ou Hive) avec un champ « synchronisé ». Au retour du réseau, envoie tout ce qui n'est pas synchronisé, puis marque les lignes. C'est ce que fait Stock Facile.", comments: [{ id: 'c2', authorId: 'u5', body: 'Merci, je teste avec Hive ce soir.', createdAt: d(1, 18) }] },
      { id: 'a5', authorId: 'u2', createdAt: d(1, 16), votes: 2, body: "Pense aussi à afficher clairement à l'utilisateur ce qui est en attente d'envoi, sinon il ressaisit tout.", comments: [] },
    ],
  },
  {
    id: 'q4', title: 'Quelle différence entre let, const et var en JavaScript ?', tags: ['JavaScript'], authorId: 'u5', createdAt: d(2, 9), votes: 6,
    body: "Je vois les trois dans les tutoriels. Laquelle utiliser par défaut, et pourquoi var est-il déconseillé ?",
    answers: [
      { id: 'a6', authorId: 'u9', createdAt: d(2, 11), votes: 4, body: "Utilise const par défaut, let quand la valeur doit changer. var ignore les blocs { } et peut être utilisée avant sa déclaration, ce qui crée des bugs difficiles à trouver.", code: { lang: 'javascript', content: "if (true) {\n  var a = 1;\n  let b = 2;\n}\nconsole.log(a); // 1\nconsole.log(b); // ReferenceError" }, comments: [] },
    ],
  },
  { id: 'q5', title: 'Mettre en ligne une API Node.js sur un VPS sans la couper', tags: ['Node.js', 'Déploiement'], authorId: 'u7', createdAt: d(2, 16), votes: 9, body: "Quand je ferme mon terminal SSH, mon API s'arrête. Comment la garder en marche et la relancer après un redémarrage du serveur ?", answers: [{ id: 'a7', authorId: 'u6', createdAt: d(2, 17), votes: 8, body: "Utilise un gestionnaire de processus comme PM2 (pm2 start, puis pm2 startup et pm2 save) ou un service systemd. Mets Nginx devant pour le HTTPS.", comments: [] }], bestAnswerId: 'a7' },
  { id: 'q6', title: 'Requête SQL : compter les commandes par client et par mois', tags: ['SQL'], authorId: 'u7', createdAt: d(3, 10), votes: 4, bestAnswerId: 'a12', body: "J'ai une table commandes(id, client_id, date_commande). Je veux le nombre de commandes par client et par mois, sur l'année en cours.", answers: [{ id: 'a12', authorId: 'u1', createdAt: d(3, 12), votes: 6, body: 'Regroupe par client et par mois tronqué. Avec PostgreSQL, date_trunc fait le travail :', code: { lang: 'sql', content: "SELECT client_id,\n       date_trunc('month', date_commande) AS mois,\n       COUNT(*) AS nb_commandes\nFROM commandes\nWHERE date_commande >= date_trunc('year', now())\nGROUP BY client_id, mois\nORDER BY client_id, mois;" }, comments: [] }] },
  { id: 'q7', title: 'React : mon useEffect se lance deux fois', tags: ['React'], authorId: 'u9', createdAt: d(3, 13), votes: 10, body: "En développement, mon appel à l'API part deux fois au chargement de la page. Est-ce un bug de mon code ?", answers: [{ id: 'a8', authorId: 'u8', createdAt: d(3, 14), votes: 7, body: "C'est le mode strict de React 18 qui monte, démonte et remonte les composants en développement pour révéler les effets mal nettoyés. En production, il ne se lance qu'une fois. Ajoute une fonction de nettoyage avec un AbortController.", comments: [] }] },
  { id: 'q8', title: 'Git : annuler un commit déjà poussé sur la branche principale', tags: ['Git'], authorId: 'u4', createdAt: d(4, 9), votes: 5, body: "J'ai poussé un fichier .env par erreur. Comment l'enlever proprement ?", answers: [{ id: 'a9', authorId: 'u6', createdAt: d(4, 10), votes: 6, body: "D'abord, change immédiatement tous les secrets qu'il contenait : ils sont compromis. Ensuite, ajoute .env au .gitignore, retire-le avec git rm --cached .env et fais un nouveau commit. Pour l'effacer de l'historique, il faut réécrire l'historique, à faire avec l'équipe.", comments: [] }] },
  { id: 'q9', title: 'Django : envoyer un SMS de confirmation après inscription', tags: ['Django', 'Python', 'API'], authorId: 'u1', createdAt: d(5, 15), votes: 3, body: "Quels services d'envoi de SMS fonctionnent bien en Afrique de l'Ouest et comment les appeler depuis Django sans bloquer la requête ?", answers: [] },
  { id: 'q10', title: 'Comment structurer un projet React qui grandit ?', tags: ['React', 'JavaScript'], authorId: 'u5', createdAt: d(6, 10), votes: 8, body: "Mon dossier components contient 40 fichiers. Comment organiser les pages, les composants et les appels à l'API ?", answers: [{ id: 'a10', authorId: 'u2', createdAt: d(6, 12), votes: 5, body: "Regroupe par fonctionnalité (questions/, projets/…), garde un dossier de composants communs, et un seul module pour tous les appels à l'API.", comments: [] }] },
  { id: 'q11', title: 'Java : différence entre une interface et une classe abstraite', tags: ['Java'], authorId: 'u9', createdAt: d(7, 9), votes: 2, body: 'Dans quels cas choisir l’une plutôt que l’autre ?', answers: [] },
  { id: 'q12', title: 'Payer par Mobile Money dans une application web : par où commencer ?', tags: ['API', 'PHP'], authorId: 'u4', createdAt: d(8, 11), votes: 14, body: "Je dois intégrer le paiement par Mobile Money pour un client. Faut-il passer par un agrégateur ? Comment tester sans argent réel ?", answers: [{ id: 'a11', authorId: 'u2', createdAt: d(8, 13), votes: 9, body: "Passe par un agrégateur : une seule intégration pour plusieurs opérateurs. Ils proposent presque tous un mode bac à sable. Vérifie toujours le paiement côté serveur via le webhook, jamais seulement dans le navigateur.", comments: [] }] },
];

export interface DbReview { id: string; authorId: string; rating: number; body: string; createdAt: string; validatedByOwner: boolean }
export interface DbCollab { id: string; fromId: string; role: string; message: string; status: 'en_attente' | 'acceptee' | 'refusee'; createdAt: string }
export interface DbProject { id: string; title: string; summary: string; description: string; techs: string[]; ownerId: string; videoUrl?: string; codeUrl: string; seekingCollaborators: boolean; createdAt: string; comments: DbComment[]; reviews: DbReview[]; collabRequests: DbCollab[] }

export const projects: DbProject[] = [
  { id: 'p1', title: 'Stock Facile, suivi de stock pour petits commerces', summary: 'Application mobile hors connexion pour suivre les entrées, sorties et ruptures de stock.', description: "Les boutiquiers notent leurs ventes sur un cahier. Stock Facile remplace ce cahier : chaque vente est enregistrée sur le téléphone, même sans réseau, puis synchronisée. Une alerte prévient quand un produit va manquer.\n\nJe cherche quelqu'un pour retravailler l'interface du tableau de bord.", techs: ['Flutter', 'API', 'SQL'], ownerId: 'u3', videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', codeUrl: 'https://github.com/mnkoghe/stock-facile', seekingCollaborators: true, createdAt: d(1, 12), comments: [{ id: 'pc1', authorId: 'u5', body: "Très utile ! Est-ce que l'appli gère plusieurs boutiques ?", createdAt: d(1, 13) }], reviews: [{ id: 'rv1', authorId: 'u2', rating: 5, body: 'Synchronisation bien pensée, code lisible. La gestion des conflits mérite un test de plus.', createdAt: d(1, 14), validatedByOwner: true }, { id: 'rv2', authorId: 'u6', rating: 4, body: "Bonne architecture. J'ajouterais une sauvegarde automatique sur le serveur.", createdAt: d(0, 9), validatedByOwner: false }], collabRequests: [] },
  { id: 'p2', title: 'Tontine en ligne', summary: 'Gérer une tontine entre amis : cotisations, tours et rappels par SMS.', description: "Une application web pour organiser les tontines : chaque membre voit qui a cotisé, à qui revient le tour, et reçoit un rappel la veille.", techs: ['Laravel', 'PHP', 'SQL'], ownerId: 'u4', videoUrl: 'https://vimeo.com/76979871', codeUrl: 'https://github.com/jmilunga/tontine', seekingCollaborators: false, createdAt: d(3, 10), comments: [], reviews: [{ id: 'rv3', authorId: 'u1', rating: 5, body: 'Interface claire, et les rappels fonctionnent bien.', createdAt: d(2, 10), validatedByOwner: true }], collabRequests: [] },
  { id: 'p3', title: 'Bus Dakar, horaires et arrêts', summary: 'Trouver le prochain bus et l’arrêt le plus proche, en un écran.', description: "Les horaires des lignes de bus de Dakar sont difficiles à trouver. Ce site les regroupe et calcule l'arrêt le plus proche.", techs: ['React', 'Node.js', 'API'], ownerId: 'u1', codeUrl: 'https://github.com/awadiop/bus-dakar', seekingCollaborators: true, createdAt: d(4, 15), comments: [], reviews: [], collabRequests: [] },
  { id: 'p4', title: 'Déploiement en un clic pour projets étudiants', summary: 'Un script qui met en ligne un projet Node.js ou PHP sur un VPS avec HTTPS.', description: "Ce script installe Nginx, configure le certificat HTTPS et lance l'application avec PM2. Pensé pour les étudiants qui découvrent les serveurs.", techs: ['Déploiement', 'Node.js', 'Git'], ownerId: 'u6', videoUrl: 'https://youtu.be/aqz-KE-bpKQ', codeUrl: 'https://github.com/yessomba/deploy-un-clic', seekingCollaborators: false, createdAt: d(6, 9), comments: [], reviews: [{ id: 'rv4', authorId: 'u2', rating: 5, body: "Je l'ai utilisé pour trois clients, aucun souci.", createdAt: d(5, 10), validatedByOwner: true }, { id: 'rv5', authorId: 'u4', rating: 4, body: 'Très pratique, il manque juste la prise en charge de MySQL.', createdAt: d(4, 10), validatedByOwner: true }], collabRequests: [] },
  { id: 'p5', title: 'Tableau de bord des ventes à partir d’Excel', summary: 'Importer un fichier Excel et obtenir des graphiques de ventes lisibles.', description: 'Un outil Python qui lit les fichiers Excel des commerciaux et produit un tableau de bord partagé.', techs: ['Python', 'SQL'], ownerId: 'u7', codeUrl: 'https://github.com/aichab/ventes', seekingCollaborators: true, createdAt: d(9, 11), comments: [], reviews: [], collabRequests: [] },
  { id: 'p6', title: 'Annuaire des artisans de Kigali', summary: 'Trouver un plombier, un électricien ou un menuisier vérifié près de chez soi.', description: 'Site React avec une API Java. Les artisans sont vérifiés par une association partenaire.', techs: ['React', 'Java'], ownerId: 'u8', videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', codeUrl: 'https://github.com/puwimana/artisans', seekingCollaborators: false, createdAt: d(11, 16), comments: [], reviews: [{ id: 'rv6', authorId: 'u9', rating: 4, body: 'Recherche rapide et claire.', createdAt: d(10, 9), validatedByOwner: true }], collabRequests: [] },
];

const quiz = (items: [string, string[], number][]): QuizQuestion[] =>
  items.map(([prompt, options, answer], i) => ({ id: `qq${i + 1}`, prompt, options, answer }));

export interface DbLesson { id: string; trackId: string; title: string; minutes: number; blocks: LessonBlock[]; quiz: QuizQuestion[]; explanations: string[] }
export interface DbTrack { id: string; title: string; level: Level; description: string; lessonIds: string[] }

export const tracks: DbTrack[] = [
  { id: 'web', title: 'Créer son premier site web', level: 'Débutant', description: 'HTML, CSS et un peu de JavaScript pour publier une page qui fonctionne sur téléphone.', lessonIds: ['web-1', 'web-2', 'web-3'] },
  { id: 'api', title: 'Parler à une API', level: 'Intermédiaire', description: 'Comprendre les requêtes HTTP, lire du JSON et gérer les erreurs, en JavaScript.', lessonIds: ['api-1', 'api-2', 'api-3'] },
  { id: 'git', title: 'Git et mise en ligne', level: 'Intermédiaire', description: 'Versionner son code, travailler en équipe et mettre un projet en ligne.', lessonIds: ['git-1', 'git-2', 'git-3'] },
];

export const lessons: DbLesson[] = [
  { id: 'web-1', trackId: 'web', title: 'La structure d’une page HTML', minutes: 6, blocks: [
    { type: 'p', text: "Une page web est un document texte. Le HTML décrit ce qu'il contient : des titres, des paragraphes, des liens, des images. Le navigateur lit ce document et l'affiche." },
    { type: 'code', lang: 'markup', content: '<!DOCTYPE html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>Ma première page</title>\n  </head>\n  <body>\n    <h1>Bonjour Dakar</h1>\n    <p>Ma première page en ligne.</p>\n  </body>\n</html>' },
    { type: 'tip', text: 'La ligne meta viewport est indispensable : sans elle, votre page sera minuscule sur téléphone.' },
    { type: 'p', text: "La partie <head> contient les informations sur la page (titre, encodage). La partie <body> contient ce que voit le visiteur." },
  ], quiz: quiz([
    ['Où place-t-on le contenu visible de la page ?', ['Dans <head>', 'Dans <body>', 'Dans <title>'], 1],
    ['À quoi sert la balise meta viewport ?', ['Changer la couleur du site', 'Adapter la page à la largeur du téléphone', 'Ajouter une image'], 1],
    ['Quelle balise crée le titre principal ?', ['<h1>', '<p>', '<title>'], 0],
  ]), explanations: ['Tout ce qui est visible se trouve dans <body>.', 'Elle indique au navigateur mobile d’utiliser la largeur réelle de l’écran.', '<h1> est le titre principal de la page ; <title> est le nom affiché dans l’onglet.'] },
  { id: 'web-2', trackId: 'web', title: 'Mettre en forme avec CSS', minutes: 8, blocks: [
    { type: 'p', text: 'Le CSS décrit l’apparence : couleurs, tailles, espacements, disposition. Une règle CSS choisit des éléments puis leur applique des propriétés.' },
    { type: 'code', lang: 'css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 16px;\n}\n\nh1 {\n  color: #5b3765;\n  font-size: 2rem;\n}' },
    { type: 'tip', text: 'Commencez toujours par le téléphone, puis ajoutez des règles pour les grands écrans avec @media (min-width: 768px).' },
  ], quiz: quiz([
    ['Que fait le sélecteur h1 ?', ['Il choisit tous les titres principaux', 'Il crée un titre', 'Il supprime les titres'], 0],
    ['Quelle règle cible les écrans larges ?', ['@media (min-width: 768px)', '@import', ':root'], 0],
    ['Quelle propriété change la couleur du texte ?', ['background', 'color', 'font-size'], 1],
  ]), explanations: ['Un sélecteur choisit des éléments existants.', 'min-width applique la règle à partir d’une largeur donnée.', 'color agit sur le texte, background sur le fond.'] },
  { id: 'web-3', trackId: 'web', title: 'Réagir à un clic avec JavaScript', minutes: 9, blocks: [
    { type: 'p', text: 'JavaScript rend la page interactive : il écoute les actions du visiteur et modifie la page en réponse.' },
    { type: 'code', lang: 'javascript', content: "const bouton = document.querySelector('#saluer');\n\nbouton.addEventListener('click', () => {\n  bouton.textContent = 'Merci !';\n});" },
    { type: 'tip', text: 'Utilisez textContent plutôt qu’innerHTML pour afficher du texte : c’est plus sûr.' },
  ], quiz: quiz([
    ['Quelle méthode écoute un clic ?', ['addEventListener', 'querySelector', 'console.log'], 0],
    ['Pourquoi préférer textContent à innerHTML ?', ['C’est plus rapide à écrire', 'Il n’interprète pas le HTML, donc évite les injections', 'Il change la couleur'], 1],
    ['Que renvoie querySelector("#saluer") ?', ['Tous les boutons', 'L’élément dont l’id est saluer', 'Une erreur'], 1],
  ]), explanations: ['addEventListener associe une fonction à un évènement.', 'textContent affiche le texte tel quel : un script inséré par un visiteur ne s’exécutera pas.', 'Le # désigne un id, unique dans la page.'] },
  { id: 'api-1', trackId: 'api', title: 'Requête et réponse HTTP', minutes: 7, blocks: [
    { type: 'p', text: 'Une API répond à des requêtes. Chaque requête a une méthode (GET pour lire, POST pour créer), une adresse, et parfois un corps. La réponse a un code d’état et un contenu.' },
    { type: 'tip', text: 'Les codes 2xx signifient succès, 4xx une erreur de la requête, 5xx une erreur du serveur.' },
  ], quiz: quiz([
    ['Quelle méthode sert à lire des données ?', ['GET', 'POST', 'DELETE'], 0],
    ['Que signifie un code 404 ?', ['Succès', 'Ressource introuvable', 'Erreur du serveur'], 1],
    ['Un code 500 indique…', ['une erreur du serveur', 'une requête réussie', 'un accès refusé'], 0],
  ]), explanations: ['GET lit, POST crée.', '404 : la ressource demandée n’existe pas.', 'Les codes 5xx viennent du serveur.'] },
  { id: 'api-2', trackId: 'api', title: 'Appeler une API avec fetch', minutes: 9, blocks: [
    { type: 'p', text: 'fetch envoie une requête et renvoie une promesse. On attend la réponse, on vérifie le code, puis on lit le JSON.' },
    { type: 'code', lang: 'javascript', content: "async function chargerQuestions() {\n  const reponse = await fetch('/api/questions');\n  if (!reponse.ok) {\n    throw new Error('Erreur ' + reponse.status);\n  }\n  return reponse.json();\n}" },
  ], quiz: quiz([
    ['Que vérifie reponse.ok ?', ['Que le code est entre 200 et 299', 'Que le JSON est valide', 'Que la connexion est rapide'], 0],
    ['Que renvoie reponse.json() ?', ['Une chaîne', 'Une promesse des données', 'Un nombre'], 1],
    ['fetch rejette-t-il la promesse sur un code 404 ?', ['Oui', 'Non, il faut vérifier reponse.ok', 'Seulement sur mobile'], 1],
  ]), explanations: ['ok vaut true pour les codes 2xx.', 'json() lit le corps et renvoie une promesse.', 'fetch ne rejette que sur une erreur réseau.'] },
  { id: 'api-3', trackId: 'api', title: 'Gérer les erreurs et la lenteur', minutes: 8, blocks: [
    { type: 'p', text: 'Sur une connexion lente, une requête peut prendre plusieurs secondes ou échouer. Affichez un état de chargement, un message clair en cas d’erreur et un bouton pour réessayer.' },
    { type: 'tip', text: 'Un AbortController permet d’annuler une requête trop longue.' },
  ], quiz: quiz([
    ['Que montrer pendant le chargement ?', ['Rien', 'Un indicateur de chargement', 'Une erreur'], 1],
    ['Que doit proposer un écran d’erreur ?', ['Un bouton Réessayer', 'Le code source', 'Une page blanche'], 0],
    ['À quoi sert AbortController ?', ['Annuler une requête', 'Accélérer le réseau', 'Lire le JSON'], 0],
  ]), explanations: ['L’utilisateur doit savoir que quelque chose se passe.', 'Toujours offrir une solution.', 'Il permet d’interrompre une requête.'] },
  { id: 'git-1', trackId: 'git', title: 'Premiers pas avec Git', minutes: 7, blocks: [
    { type: 'p', text: 'Git garde l’historique de votre code. Chaque commit est une photo du projet à un instant donné.' },
    { type: 'code', lang: 'bash', content: 'git init\ngit add .\ngit commit -m "Première version"' },
  ], quiz: quiz([
    ['Que fait git commit ?', ['Il enregistre une version', 'Il supprime un fichier', 'Il met en ligne'], 0],
    ['Quel fichier liste ce que Git doit ignorer ?', ['.gitignore', 'README.md', '.env'], 0],
    ['Faut-il mettre le fichier .env dans Git ?', ['Oui', 'Non, il contient des secrets', 'Seulement en équipe'], 1],
  ]), explanations: ['Un commit enregistre l’état du projet.', '.gitignore liste les fichiers exclus.', 'Les secrets ne doivent jamais être versionnés.'] },
  { id: 'git-2', trackId: 'git', title: 'Branches et relecture', minutes: 8, blocks: [
    { type: 'p', text: 'Chaque fonctionnalité se développe sur sa propre branche, puis est relue par un autre membre avant d’être fusionnée.' },
    { type: 'code', lang: 'bash', content: 'git switch -c questions-reponses\n# ... travail ...\ngit push -u origin questions-reponses' },
  ], quiz: quiz([
    ['Pourquoi travailler sur une branche ?', ['Pour isoler son travail', 'Pour aller plus vite sur le réseau', 'Pour supprimer l’historique'], 0],
    ['Qui relit avant la fusion ?', ['Personne', 'Un autre membre', 'Le serveur'], 1],
    ['Quelle commande crée et ouvre une branche ?', ['git switch -c', 'git log', 'git status'], 0],
  ]), explanations: ['Une branche isole les changements.', 'La relecture par un autre membre limite les erreurs.', 'switch -c crée puis bascule.'] },
  { id: 'git-3', trackId: 'git', title: 'Mettre en ligne sur un VPS', minutes: 10, blocks: [
    { type: 'p', text: 'Sur un serveur, on récupère le code, on installe les dépendances, on construit, puis on lance l’application avec un gestionnaire de processus. Nginx reçoit les visiteurs et gère le HTTPS.' },
    { type: 'code', lang: 'bash', content: 'git pull\nnpm ci\nnpm run build\npm2 restart gamelia' },
  ], quiz: quiz([
    ['Quel outil garde l’application en marche ?', ['PM2', 'Git', 'CSS'], 0],
    ['Qui gère le HTTPS dans cette architecture ?', ['Nginx', 'Le navigateur', 'Git'], 0],
    ['Que fait npm ci ?', ['Installe exactement les dépendances du fichier de verrouillage', 'Supprime le projet', 'Lance les tests'], 0],
  ]), explanations: ['PM2 relance l’application si elle s’arrête.', 'Nginx termine la connexion HTTPS.', 'npm ci est reproductible.'] },
];

export interface DbChallenge { id: string; title: string; kind: 'quiz' | 'pratique'; level: Level; tags: string[]; points: number; summary: string; brief: string; quiz?: QuizQuestion[]; explanations?: string[]; participants: number; weekly?: boolean }

export const challenges: DbChallenge[] = [
  { id: 'd1', title: 'Créer une API de tâches', kind: 'pratique', level: 'Intermédiaire', tags: ['API', 'Node.js'], points: 150, weekly: true, participants: 64, summary: 'Une petite API pour créer, lister, terminer et supprimer des tâches.', brief: "Créez une API avec quatre routes : lister les tâches, créer une tâche, la marquer comme terminée, la supprimer. Les données peuvent rester en mémoire. Ajoutez un fichier README qui explique comment lancer le projet.\n\nEnvoyez le lien vers votre dépôt. Un membre de l'équipe Gamelia vérifie la solution sous 48 h." },
  { id: 'd2', title: 'Les bases de JavaScript', kind: 'quiz', level: 'Débutant', tags: ['JavaScript'], points: 40, participants: 212, summary: 'Cinq questions sur les variables, les fonctions et les tableaux.', brief: 'Répondez aux questions. La correction est immédiate.', quiz: quiz([
    ['Que vaut typeof [] ?', ['"array"', '"object"', '"list"'], 1],
    ['Quelle méthode ajoute un élément à la fin d’un tableau ?', ['push', 'pop', 'shift'], 0],
    ['Que vaut 2 + "2" ?', ['4', '"22"', 'Une erreur'], 1],
    ['Quel mot-clé déclare une constante ?', ['let', 'var', 'const'], 2],
    ['Que renvoie [1, 2, 3].map(x => x * 2) ?', ['[2, 4, 6]', '6', '[1, 2, 3]'], 0],
  ]), explanations: ['Les tableaux sont des objets en JavaScript.', 'push ajoute à la fin, pop retire à la fin.', 'Le nombre est converti en texte puis concaténé.', 'const empêche une nouvelle affectation.', 'map crée un nouveau tableau transformé.'] },
  { id: 'd3', title: 'SQL : jointures et regroupements', kind: 'quiz', level: 'Intermédiaire', tags: ['SQL'], points: 60, participants: 98, summary: 'Quatre questions sur JOIN, GROUP BY et HAVING.', brief: 'Répondez aux questions. La correction est immédiate.', quiz: quiz([
    ['Quelle clause filtre après un GROUP BY ?', ['WHERE', 'HAVING', 'ORDER BY'], 1],
    ['Un LEFT JOIN garde…', ['toutes les lignes de la table de gauche', 'seulement les correspondances', 'toutes les lignes des deux tables'], 0],
    ['Quelle fonction compte des lignes ?', ['SUM', 'COUNT', 'AVG'], 1],
    ['Que fait DISTINCT ?', ['Supprime les doublons du résultat', 'Trie le résultat', 'Supprime la table'], 0],
  ]), explanations: ['WHERE filtre avant le regroupement, HAVING après.', 'Les lignes sans correspondance ont des colonnes vides.', 'COUNT compte, SUM additionne.', 'DISTINCT ne garde que les lignes uniques.'] },
  { id: 'd4', title: 'Page de profil responsive', kind: 'pratique', level: 'Débutant', tags: ['HTML-CSS'], points: 80, participants: 141, summary: 'Une page de profil lisible de 360 px à grand écran.', brief: 'Réalisez une page de profil (photo, nom, compétences, liens) en HTML et CSS. Elle doit rester lisible sur un téléphone de 360 px et sur ordinateur. Envoyez le lien du dépôt et de la page en ligne.' },
  { id: 'd5', title: 'Git en équipe', kind: 'quiz', level: 'Débutant', tags: ['Git'], points: 40, participants: 176, summary: 'Trois questions sur les branches et les conflits.', brief: 'Répondez aux questions. La correction est immédiate.', quiz: quiz([
    ['Que fait git pull ?', ['Récupère et fusionne les changements distants', 'Envoie vos commits', 'Supprime une branche'], 0],
    ['Quand apparaît un conflit ?', ['Quand deux personnes modifient les mêmes lignes', 'À chaque commit', 'Quand on crée une branche'], 0],
    ['Où voir l’historique des commits ?', ['git log', 'git add', 'git init'], 0],
  ]), explanations: ['pull = fetch + merge.', 'Git ne sait pas choisir entre deux versions des mêmes lignes.', 'git log affiche l’historique.'] },
  { id: 'd6', title: 'Application hors connexion', kind: 'pratique', level: 'Confirmé', tags: ['Flutter', 'API'], points: 250, participants: 22, summary: 'Une liste de courses qui se synchronise au retour du réseau.', brief: "Créez une application (Flutter ou web) qui permet d'ajouter des éléments sans réseau et les synchronise avec une API au retour de la connexion. Montrez la synchronisation dans une courte vidéo." },
  { id: 'd7', title: 'Python : listes et dictionnaires', kind: 'quiz', level: 'Débutant', tags: ['Python'], points: 40, participants: 189, summary: 'Quatre questions pour vérifier les bases.', brief: 'Répondez aux questions. La correction est immédiate.', quiz: quiz([
    ['Comment lire la valeur de la clé "nom" sans erreur si elle manque ?', ['d["nom"]', 'd.get("nom")', 'd.nom'], 1],
    ['Que renvoie len([1, 2, 3]) ?', ['3', '2', '6'], 0],
    ['Quelle structure garde des paires clé-valeur ?', ['list', 'dict', 'tuple'], 1],
    ['Que fait liste.append(4) ?', ['Ajoute 4 à la fin', 'Remplace la liste', 'Renvoie une copie'], 0],
  ]), explanations: ['get renvoie None si la clé manque.', 'len compte les éléments.', 'Un dict associe des clés à des valeurs.', 'append modifie la liste sur place.'] },
];

export const badges: Badge[] = [
  { id: 'b1', name: 'Première réponse', description: 'Répondre à une question pour la première fois.', glyph: 'R' },
  { id: 'b2', name: 'Meilleure réponse', description: 'Voir une de ses réponses choisie par l’auteur.', glyph: '★' },
  { id: 'b3', name: 'Piste terminée', description: 'Terminer une piste d’apprentissage.', glyph: 'P' },
  { id: 'b4', name: 'Premier défi', description: 'Réussir un premier défi.', glyph: 'D' },
  { id: 'b5', name: 'Projet publié', description: 'Publier un projet avec une démo.', glyph: '▶' },
  { id: 'b6', name: 'Bon relecteur', description: 'Voir trois revues validées par les propriétaires.', glyph: '✓' },
  { id: 'b7', name: 'Pilier du pays', description: 'Entrer dans le top 10 de son pays.', glyph: '10' },
  { id: 'b8', name: 'Compte vérifié', description: 'Relier et confirmer son compte GitHub.', glyph: 'G' },
];

export interface DbRecruiterChallenge { id: string; recruiterId: string; title: string; summary: string; brief: string; skills: string[]; country: string; remote: boolean; deadline: string; reward: string; status: 'en_attente' | 'publie' | 'cloture' | 'refuse'; createdAt: string }

const future = (days: number) => { const t = new Date(); t.setUTCDate(t.getUTCDate() + days); return t.toISOString(); };

export const recruiterChallenges: DbRecruiterChallenge[] = [
  { id: 'rc1', recruiterId: 'r1', title: 'Module de facturation pour une PME', summary: 'Ajoutez la création de factures PDF à notre application de gestion.', brief: "Kivu Tech édite un logiciel de gestion pour les PME de Kinshasa. Le défi : créer un module qui génère une facture PDF à partir d'une commande (client, lignes, TVA), avec une API et une page d'aperçu.\n\nLivrables : lien vers le dépôt, courte vidéo de démonstration. Les meilleurs candidats seront contactés pour une mission rémunérée de trois mois.", skills: ['PHP', 'Laravel', 'API'], country: 'RD Congo', remote: true, deadline: future(12), reward: 'Mission de 3 mois, rémunérée', status: 'publie', createdAt: d(5) },
  { id: 'rc2', recruiterId: 'r1', title: 'Tableau de bord des ventes en React', summary: 'Un tableau de bord rapide, utilisable sur une connexion lente.', brief: "Créez un tableau de bord React qui affiche les ventes par jour et par produit à partir d'une API fournie. La page doit rester utilisable en 3G.\n\nLivrables : dépôt et page en ligne.", skills: ['React', 'JavaScript'], country: 'RD Congo', remote: true, deadline: future(20), reward: 'Stage de 6 mois', status: 'publie', createdAt: d(2) },
  { id: 'rc3', recruiterId: 'r2', title: 'Intégration Mobile Money', summary: 'Brancher un agrégateur de paiement sur une boutique en ligne.', brief: 'Intégrer un paiement Mobile Money en mode bac à sable sur une boutique de démonstration, avec vérification côté serveur.', skills: ['API', 'Node.js'], country: 'Gabon', remote: false, deadline: future(25), reward: 'CDI développeur back-end', status: 'en_attente', createdAt: d(1) },
];

export interface DbApplication { id: string; challengeId: string; devId: string; codeUrl: string; demoUrl?: string; message: string; createdAt: string; status: 'recue' | 'evaluee' | 'retenue' | 'non_retenue'; score?: number; feedback?: string; proposal?: string }

export const applications: DbApplication[] = [
  { id: 'ap1', challengeId: 'rc1', devId: 'u4', codeUrl: 'https://github.com/jmilunga/factures', demoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', message: "J'utilise Laravel tous les jours et j'ai déjà construit un module de devis.", createdAt: d(3), status: 'evaluee', score: 4, feedback: 'Code propre, TVA bien gérée. Il manque les tests.' },
  { id: 'ap2', challengeId: 'rc1', devId: 'u1', codeUrl: 'https://github.com/awadiop/facturation', message: 'Je propose une version avec Django pour l’API et un export PDF.', createdAt: d(2), status: 'recue' },
  { id: 'ap3', challengeId: 'rc2', devId: 'u2', codeUrl: 'https://github.com/koffim/dashboard-ventes', demoUrl: 'https://vimeo.com/76979871', message: 'Tableau de bord sous 60 Ko de JavaScript, testé en 3G.', createdAt: d(1), status: 'recue' },
  { id: 'ap4', challengeId: 'rc2', devId: 'u8', codeUrl: 'https://github.com/puwimana/ventes-react', message: 'Version avec graphiques accessibles au clavier.', createdAt: d(1), status: 'recue' },
];

export interface DbSubmission { id: string; challengeId: string; devId: string; codeUrl: string; note: string; date: string; status: 'en_attente' | 'valide' | 'refuse' }
export const submissions: DbSubmission[] = [
  { id: 's1', challengeId: 'd1', devId: 'u5', codeUrl: 'https://github.com/fatoutraore/api-taches', note: 'Première API, avec Express.', date: d(1), status: 'en_attente' },
  { id: 's2', challengeId: 'd4', devId: 'u9', codeUrl: 'https://github.com/gabyalila/profil', note: 'Testé sur un téléphone de 360 px.', date: d(2), status: 'en_attente' },
  { id: 's3', challengeId: 'd1', devId: 'u2', codeUrl: 'https://github.com/koffim/api-taches', note: '', date: d(6), status: 'valide' },
];

export interface DbReport { id: string; targetType: 'question' | 'reponse' | 'projet' | 'commentaire'; targetId: string; reason: string; details?: string; reporterId: string; date: string; status: 'ouvert' | 'traite' | 'rejete' }
export const reports: DbReport[] = [
  { id: 'sg1', targetType: 'question', targetId: 'q11', reason: 'Doublon', details: 'Même question posée la semaine dernière.', reporterId: 'u2', date: d(1), status: 'ouvert' },
  { id: 'sg2', targetType: 'projet', targetId: 'p5', reason: 'Lien cassé', details: 'Le lien du code renvoie une erreur 404.', reporterId: 'u1', date: d(0), status: 'ouvert' },
];

export interface DbNotification { id: string; userId: string; kind: 'reponse' | 'commentaire' | 'badge' | 'candidature' | 'validation' | 'collaboration'; text: string; href: string; read: boolean; date: string }
export const notifications: DbNotification[] = [
  { id: 'n1', userId: 'u1', kind: 'reponse', text: 'Koffi Mensah a répondu à « Comment connecter mon application à une API ? »', href: '/questions/q1', read: false, date: d(0, 9) },
  { id: 'n2', userId: 'u1', kind: 'badge', text: 'Vous avez obtenu le badge « Premier défi ».', href: '/progression', read: false, date: d(1, 12) },
  { id: 'n3', userId: 'u1', kind: 'commentaire', text: 'Fatou Traoré a commenté votre projet « Bus Dakar ».', href: '/projets/p3', read: true, date: d(3, 10) },
  { id: 'n4', userId: 'r1', kind: 'candidature', text: 'Nouvelle candidature de Koffi Mensah sur « Tableau de bord des ventes en React ».', href: '/recruteur/defis/rc2', read: false, date: d(1, 11) },
  { id: 'n5', userId: 'a1', kind: 'validation', text: 'Deux comptes recruteurs attendent une validation.', href: '/admin/validations', read: false, date: d(0, 8) },
];

// Progression de la démo pour Awa (u1)
export const progressSeed: Record<string, { lessonsDone: string[]; challengeStatus: Record<string, 'reussi' | 'echoue' | 'en_attente' | 'refuse'>; badgeIds: string[]; history: { label: string; points: number; date: string }[] }> = {
  u1: {
    lessonsDone: ['web-1', 'web-2', 'web-3', 'api-1'],
    challengeStatus: { d2: 'reussi', d7: 'reussi' },
    badgeIds: ['b1', 'b2', 'b3', 'b4', 'b8'],
    history: [
      { label: 'Meilleure réponse sur « Requête SQL : compter les commandes »', points: 25, date: d(0, 9) },
      { label: 'Défi réussi : Python, listes et dictionnaires', points: 40, date: d(1, 12) },
      { label: 'Réponse votée utile', points: 5, date: d(2, 15) },
      { label: 'Piste terminée : Créer son premier site web', points: 60, date: d(4, 18) },
      { label: 'Défi réussi : Les bases de JavaScript', points: 40, date: d(6, 11) },
      { label: 'Projet publié : Bus Dakar', points: 30, date: d(4, 15) },
    ],
  },
};
