// Peuple les tables de RÉFÉRENCE (catalogues fixes), pas les données de démo
// (users/questions/projets). Sans ce script, toute route qui donne un badge
// échoue (FK badges manquante), et /pistes, /defis renvoient du vide.
// Contenu copié depuis lib/mock/seed.ts pour rester identique à ce que le
// front affichait déjà en mode démo (mêmes textes, mêmes id).
const { pool } = require('./pool');

const badges = [
  ['b1', 'Première réponse', 'Répondre à une question pour la première fois.', 'R'],
  ['b2', 'Meilleure réponse', 'Voir une de ses réponses choisie par l’auteur.', '★'],
  ['b3', 'Piste terminée', 'Terminer une piste d’apprentissage.', 'P'],
  ['b4', 'Premier défi', 'Réussir un premier défi.', 'D'],
  ['b5', 'Projet publié', 'Publier un projet avec une démo.', '▶'],
  ['b6', 'Bon relecteur', 'Voir trois revues validées par les propriétaires.', '✓'],
  ['b7', 'Pilier du pays', 'Entrer dans le top 10 de son pays.', '10'],
  ['b8', 'Compte vérifié', 'Relier et confirmer son compte GitHub.', 'G'],
];

const tracks = [
  ['web', 'Créer son premier site web', 'Débutant', 'HTML, CSS et un peu de JavaScript pour publier une page qui fonctionne sur téléphone.', 0],
  ['api', 'Parler à une API', 'Intermédiaire', 'Comprendre les requêtes HTTP, lire du JSON et gérer les erreurs, en JavaScript.', 1],
  ['git', 'Git et mise en ligne', 'Intermédiaire', 'Versionner son code, travailler en équipe et mettre un projet en ligne.', 2],
];

// Texte et exemples de chaque leçon (blocs p / code / tip / try) : src/db/lessons-content.json.
// Sans ce fichier, les leçons s'affichent vides sur le site réel.
const lessonContent = require('./lessons-content.json');

// [id, trackId, title, minutes, position]
const lessons = [
  ['web-1', 'web', 'La structure d’une page HTML', 6, 0],
  ['web-2', 'web', 'Mettre en forme avec CSS', 8, 1],
  ['web-3', 'web', 'Réagir à un clic avec JavaScript', 9, 2],
  ['api-1', 'api', 'Requête et réponse HTTP', 7, 0],
  ['api-2', 'api', 'Appeler une API avec fetch', 9, 1],
  ['api-3', 'api', 'Gérer les erreurs et la lenteur', 8, 2],
  ['git-1', 'git', 'Premiers pas avec Git', 7, 0],
  ['git-2', 'git', 'Branches et relecture', 8, 1],
  ['git-3', 'git', 'Mettre en ligne sur un VPS', 10, 2],
];

// Défis : [id, title, kind, level, points, summary, brief, weekly, tags[]]
const challenges = [
  ['d1', 'Créer une API de tâches', 'pratique', 'Intermédiaire', 150,
    'Une petite API pour créer, lister, terminer et supprimer des tâches.',
    "Créez une API avec quatre routes : lister les tâches, créer une tâche, la marquer comme terminée, la supprimer. Les données peuvent rester en mémoire. Ajoutez un fichier README qui explique comment lancer le projet.\n\nEnvoyez le lien vers votre dépôt. Un membre de l'équipe Gamelia vérifie la solution sous 48 h.",
    true, ['API', 'Node.js']],
  ['d2', 'Les bases de JavaScript', 'quiz', 'Débutant', 40,
    'Cinq questions sur les variables, les fonctions et les tableaux.',
    'Répondez aux questions. La correction est immédiate.', false, ['JavaScript']],
  ['d3', 'SQL : jointures et regroupements', 'quiz', 'Intermédiaire', 60,
    'Quatre questions sur JOIN, GROUP BY et HAVING.',
    'Répondez aux questions. La correction est immédiate.', false, ['SQL']],
  ['d4', 'Page de profil responsive', 'pratique', 'Débutant', 80,
    'Une page de profil lisible de 360 px à grand écran.',
    'Réalisez une page de profil (photo, nom, compétences, liens) en HTML et CSS. Elle doit rester lisible sur un téléphone de 360 px et sur ordinateur. Envoyez le lien du dépôt et de la page en ligne.',
    false, ['HTML-CSS']],
  ['d5', 'Git en équipe', 'quiz', 'Débutant', 40,
    'Trois questions sur les branches et les conflits.',
    'Répondez aux questions. La correction est immédiate.', false, ['Git']],
  ['d6', 'Application hors connexion', 'pratique', 'Confirmé', 250,
    'Une liste de courses qui se synchronise au retour du réseau.',
    "Créez une application (Flutter ou web) qui permet d'ajouter des éléments sans réseau et les synchronise avec une API au retour de la connexion. Montrez la synchronisation dans une courte vidéo.",
    false, ['Flutter', 'API']],
  ['d7', 'Python : listes et dictionnaires', 'quiz', 'Débutant', 40,
    'Quatre questions pour vérifier les bases.',
    'Répondez aux questions. La correction est immédiate.', false, ['Python']],
];

// Quiz leçons : [lessonId, [[prompt, options[], correctIndex, explanation], ...]]
const lessonQuiz = {
  'web-1': [
    ['Où place-t-on le contenu visible de la page ?', ['Dans <head>', 'Dans <body>', 'Dans <title>'], 1, 'Tout ce qui est visible se trouve dans <body>.'],
    ['À quoi sert la balise meta viewport ?', ['Changer la couleur du site', 'Adapter la page à la largeur du téléphone', 'Ajouter une image'], 1, 'Elle indique au navigateur mobile d’utiliser la largeur réelle de l’écran.'],
    ['Quelle balise crée le titre principal ?', ['<h1>', '<p>', '<title>'], 0, '<h1> est le titre principal de la page ; <title> est le nom affiché dans l’onglet.'],
  ],
  'web-2': [
    ['Que fait le sélecteur h1 ?', ['Il choisit tous les titres principaux', 'Il crée un titre', 'Il supprime les titres'], 0, 'Un sélecteur choisit des éléments existants.'],
    ['Quelle règle cible les écrans larges ?', ['@media (min-width: 768px)', '@import', ':root'], 0, 'min-width applique la règle à partir d’une largeur donnée.'],
    ['Quelle propriété change la couleur du texte ?', ['background', 'color', 'font-size'], 1, 'color agit sur le texte, background sur le fond.'],
  ],
  'web-3': [
    ['Quelle méthode écoute un clic ?', ['addEventListener', 'querySelector', 'console.log'], 0, 'addEventListener associe une fonction à un évènement.'],
    ['Pourquoi préférer textContent à innerHTML ?', ['C’est plus rapide à écrire', 'Il n’interprète pas le HTML, donc évite les injections', 'Il change la couleur'], 1, 'textContent affiche le texte tel quel.'],
    ['Que renvoie querySelector("#saluer") ?', ['Tous les boutons', 'L’élément dont l’id est saluer', 'Une erreur'], 1, 'Le # désigne un id, unique dans la page.'],
  ],
  'api-1': [
    ['Quelle méthode sert à lire des données ?', ['GET', 'POST', 'DELETE'], 0, 'GET lit, POST crée.'],
    ['Que signifie un code 404 ?', ['Succès', 'Ressource introuvable', 'Erreur du serveur'], 1, '404 : la ressource demandée n’existe pas.'],
    ['Un code 500 indique…', ['une erreur du serveur', 'une requête réussie', 'un accès refusé'], 0, 'Les codes 5xx viennent du serveur.'],
  ],
  'api-2': [
    ['Que vérifie reponse.ok ?', ['Que le code est entre 200 et 299', 'Que le JSON est valide', 'Que la connexion est rapide'], 0, 'ok vaut true pour les codes 2xx.'],
    ['Que renvoie reponse.json() ?', ['Une chaîne', 'Une promesse des données', 'Un nombre'], 1, 'json() lit le corps et renvoie une promesse.'],
    ['fetch rejette-t-il la promesse sur un code 404 ?', ['Oui', 'Non, il faut vérifier reponse.ok', 'Seulement sur mobile'], 1, 'fetch ne rejette que sur une erreur réseau.'],
  ],
  'api-3': [
    ['Que montrer pendant le chargement ?', ['Rien', 'Un indicateur de chargement', 'Une erreur'], 1, 'L’utilisateur doit savoir que quelque chose se passe.'],
    ['Que doit proposer un écran d’erreur ?', ['Un bouton Réessayer', 'Le code source', 'Une page blanche'], 0, 'Toujours offrir une solution.'],
    ['À quoi sert AbortController ?', ['Annuler une requête', 'Accélérer le réseau', 'Lire le JSON'], 0, 'Il permet d’interrompre une requête.'],
  ],
  'git-1': [
    ['Que fait git commit ?', ['Il enregistre une version', 'Il supprime un fichier', 'Il met en ligne'], 0, 'Un commit enregistre l’état du projet.'],
    ['Quel fichier liste ce que Git doit ignorer ?', ['.gitignore', 'README.md', '.env'], 0, '.gitignore liste les fichiers exclus.'],
    ['Faut-il mettre le fichier .env dans Git ?', ['Oui', 'Non, il contient des secrets', 'Seulement en équipe'], 1, 'Les secrets ne doivent jamais être versionnés.'],
  ],
  'git-2': [
    ['Pourquoi travailler sur une branche ?', ['Pour isoler son travail', 'Pour aller plus vite sur le réseau', 'Pour supprimer l’historique'], 0, 'Une branche isole les changements.'],
    ['Qui relit avant la fusion ?', ['Personne', 'Un autre membre', 'Le serveur'], 1, 'La relecture par un autre membre limite les erreurs.'],
    ['Quelle commande crée et ouvre une branche ?', ['git switch -c', 'git log', 'git status'], 0, 'switch -c crée puis bascule.'],
  ],
  'git-3': [
    ['Quel outil garde l’application en marche ?', ['PM2', 'Git', 'CSS'], 0, 'PM2 relance l’application si elle s’arrête.'],
    ['Qui gère le HTTPS dans cette architecture ?', ['Nginx', 'Le navigateur', 'Git'], 0, 'Nginx termine la connexion HTTPS.'],
    ['Que fait npm ci ?', ['Installe exactement les dépendances du fichier de verrouillage', 'Supprime le projet', 'Lance les tests'], 0, 'npm ci est reproductible.'],
  ],
};

// Quiz défis : [challengeId, [[prompt, options[], correctIndex, explanation], ...]]
const challengeQuiz = {
  d2: [
    ['Que vaut typeof [] ?', ['"array"', '"object"', '"list"'], 1, 'Les tableaux sont des objets en JavaScript.'],
    ['Quelle méthode ajoute un élément à la fin d’un tableau ?', ['push', 'pop', 'shift'], 0, 'push ajoute à la fin, pop retire à la fin.'],
    ['Que vaut 2 + "2" ?', ['4', '"22"', 'Une erreur'], 1, 'Le nombre est converti en texte puis concaténé.'],
    ['Quel mot-clé déclare une constante ?', ['let', 'var', 'const'], 2, 'const empêche une nouvelle affectation.'],
    ['Que renvoie [1, 2, 3].map(x => x * 2) ?', ['[2, 4, 6]', '6', '[1, 2, 3]'], 0, 'map crée un nouveau tableau transformé.'],
  ],
  d3: [
    ['Quelle clause filtre après un GROUP BY ?', ['WHERE', 'HAVING', 'ORDER BY'], 1, 'WHERE filtre avant le regroupement, HAVING après.'],
    ['Un LEFT JOIN garde…', ['toutes les lignes de la table de gauche', 'seulement les correspondances', 'toutes les lignes des deux tables'], 0, 'Les lignes sans correspondance ont des colonnes vides.'],
    ['Quelle fonction compte des lignes ?', ['SUM', 'COUNT', 'AVG'], 1, 'COUNT compte, SUM additionne.'],
    ['Que fait DISTINCT ?', ['Supprime les doublons du résultat', 'Trie le résultat', 'Supprime la table'], 0, 'DISTINCT ne garde que les lignes uniques.'],
  ],
  d5: [
    ['Que fait git pull ?', ['Récupère et fusionne les changements distants', 'Envoie vos commits', 'Supprime une branche'], 0, 'pull = fetch + merge.'],
    ['Quand apparaît un conflit ?', ['Quand deux personnes modifient les mêmes lignes', 'À chaque commit', 'Quand on crée une branche'], 0, 'Git ne sait pas choisir entre deux versions des mêmes lignes.'],
    ['Où voir l’historique des commits ?', ['git log', 'git add', 'git init'], 0, 'git log affiche l’historique.'],
  ],
  d7: [
    ['Comment lire la valeur de la clé "nom" sans erreur si elle manque ?', ['d["nom"]', 'd.get("nom")', 'd.nom'], 1, 'get renvoie None si la clé manque.'],
    ['Que renvoie len([1, 2, 3]) ?', ['3', '2', '6'], 0, 'len compte les éléments.'],
    ['Quelle structure garde des paires clé-valeur ?', ['list', 'dict', 'tuple'], 1, 'Un dict associe des clés à des valeurs.'],
    ['Que fait liste.append(4) ?', ['Ajoute 4 à la fin', 'Remplace la liste', 'Renvoie une copie'], 0, 'append modifie la liste sur place.'],
  ],
};

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [id, name, description, glyph] of badges) {
      await client.query(
        `INSERT INTO badges (id, name, description, glyph) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, glyph=$4`,
        [id, name, description, glyph]
      );
    }

    for (const [id, title, level, description, position] of tracks) {
      await client.query(
        `INSERT INTO tracks (id, title, level, description, position) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET title=$2, level=$3, description=$4, position=$5`,
        [id, title, level, description, position]
      );
    }

    for (const [id, trackId, title, minutes, position] of lessons) {
      await client.query(
        `INSERT INTO lessons (id, track_id, title, minutes, position, blocks) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (id) DO UPDATE SET track_id=$2, title=$3, minutes=$4, position=$5, blocks=$6::jsonb`,
        [id, trackId, title, minutes, position, JSON.stringify(lessonContent[id]?.blocks ?? [])]
      );
      const quizItems = lessonQuiz[id] || [];
      await client.query('DELETE FROM lesson_quiz_questions WHERE lesson_id = $1', [id]);
      for (let i = 0; i < quizItems.length; i++) {
        const [prompt, options, correctIndex, explanation] = quizItems[i];
        await client.query(
          `INSERT INTO lesson_quiz_questions (lesson_id, position, prompt, options, correct_index, explanation)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, i, prompt, options, correctIndex, explanation]
        );
      }
    }

    for (const [id, title, kind, level, pts, summary, brief, weekly, tags] of challenges) {
      await client.query(
        `INSERT INTO challenges (id, title, kind, level, points, summary, brief, weekly) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET title=$2, kind=$3, level=$4, points=$5, summary=$6, brief=$7, weekly=$8`,
        [id, title, kind, level, pts, summary, brief, weekly]
      );
      await client.query('DELETE FROM challenge_tags WHERE challenge_id = $1', [id]);
      for (const tag of tags) {
        await client.query('INSERT INTO challenge_tags (challenge_id, tag) VALUES ($1,$2)', [id, tag]);
      }
      const quizItems = challengeQuiz[id] || [];
      await client.query('DELETE FROM challenge_quiz_questions WHERE challenge_id = $1', [id]);
      for (let i = 0; i < quizItems.length; i++) {
        const [prompt, options, correctIndex, explanation] = quizItems[i];
        await client.query(
          `INSERT INTO challenge_quiz_questions (challenge_id, position, prompt, options, correct_index, explanation)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, i, prompt, options, correctIndex, explanation]
        );
      }
    }

    await client.query('COMMIT');
    console.log('[seed] catalogues de référence peuplés (badges, pistes, leçons, défis).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
