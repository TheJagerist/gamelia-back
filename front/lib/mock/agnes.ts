// Agnès simulée (mode démonstration). Les vraies réponses viennent de l'API Agnes AI, appelée par notre serveur.
// Ici, les réponses sont préparées à l'avance et clairement signalées comme simulées.
// Règles reproduites : lecture publique, demande réservée aux membres connectés, une seule piste par question.
import { ApiError } from '../api/errors';
import type { AgnesAnswer, AgnesTurn } from '../types';
import { load, net, now, requireUser } from './server';

const KEY = 'gamelia-demo-agnes-v1';
const MODEL = 'agnes-2.0-flash (démo)';
const NOTE = '_Mode démonstration : cette réponse est simulée. Avec l’API branchée, c’est la vraie Agnès qui répond._';

type Store = Record<string, AgnesAnswer>;
let store: Store | null = null;

function db(): Store {
  if (store) return store;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    store = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    store = {};
  }
  return store as Store;
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db()));
  } catch {
    /* stockage indisponible : la démo continue en mémoire */
  }
}

export function reset() {
  store = {};
  save();
}

// Conseils de départ par technologie (simulation).
const TIPS: { match: RegExp; text: string; code?: [string, string] }[] = [
  {
    match: /python|django|requests/i,
    text: 'En Python, vérifie d’abord ce que renvoie vraiment le serveur : affiche le code HTTP et le corps brut avant de le transformer. Une méthode appelée sans parenthèses (`reponse.json` au lieu de `reponse.json()`) renvoie la fonction elle-même, pas les données.',
    code: ['python', "reponse = requests.post(URL, json=donnees, timeout=10)\nprint(reponse.status_code, reponse.text[:200])  # ce que le serveur renvoie\nreponse.raise_for_status()\nresultat = reponse.json()  # avec les parenthèses"],
  },
  {
    match: /javascript|react|node|js\b|fetch/i,
    text: 'En JavaScript, la plupart des « variables vides » viennent d’une promesse non attendue : sans `await` (ou `.then`), tu lis la valeur avant que la réponse n’arrive. Vérifie aussi l’onglet Réseau du navigateur.',
    code: ['javascript', "const reponse = await fetch(url, { headers: { Accept: 'application/json' } });\nif (!reponse.ok) throw new Error(`Erreur ${reponse.status}`);\nconst donnees = await reponse.json();\nconsole.log(donnees);"],
  },
  {
    match: /php|laravel/i,
    text: 'Avec Laravel, commence par lire `storage/logs/laravel.log` : l’erreur exacte y est presque toujours. Une erreur 419 vient du jeton CSRF ou d’un cookie de session non renvoyé (vérifie `APP_URL` et `SESSION_DOMAIN`).',
    code: ['php', "<form method=\"POST\" action=\"/contact\">\n    @csrf\n    <!-- champs du formulaire -->\n</form>"],
  },
  {
    match: /sql|postgres|mysql/i,
    text: 'En SQL, construis la requête par étapes : d’abord le `SELECT` simple, puis le filtre `WHERE`, puis le regroupement. Utilise toujours des requêtes paramétrées pour les valeurs venant d’un formulaire.',
    code: ['sql', "SELECT client_id, COUNT(*) AS nb\nFROM commandes\nWHERE date_commande >= $1\nGROUP BY client_id\nORDER BY nb DESC;"],
  },
  {
    match: /flutter|dart/i,
    text: 'Avec Flutter, pour travailler sans réseau : enregistre chaque saisie dans une base locale (sqflite ou Hive) avec un indicateur « à synchroniser », puis envoie-les au retour de la connexion.',
  },
  {
    match: /git/i,
    text: 'Avec Git, commence toujours par `git status` et `git log --oneline -5` pour voir où tu en es. Si un secret a été poussé, change-le immédiatement : il est compromis, même après suppression.',
    code: ['bash', 'git status\ngit log --oneline -5'],
  },
  {
    match: /déploiement|deploiement|vps|nginx|serveur/i,
    text: 'Pour garder une application en ligne sur un VPS, utilise un gestionnaire de processus (systemd ou PM2) et mets Nginx devant pour le HTTPS (Certbot).',
    code: ['bash', 'pm2 start server.js --name mon-api\npm2 startup\npm2 save'],
  },
  {
    match: /html|css|flex|grid|centrer/i,
    text: 'En CSS, pour centrer un élément, Flexbox sur le parent suffit dans la plupart des cas.',
    code: ['css', '.parent {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}'],
  },
];

function tipFor(text: string) {
  return TIPS.find((t) => t.match.test(text));
}

function compose(intro: string, subject: string, closing: string) {
  const tip = tipFor(subject);
  const parts = [NOTE, intro];
  if (tip) {
    parts.push(tip.text);
    if (tip.code) parts.push('```' + tip.code[0] + '\n' + tip.code[1] + '\n```');
  } else {
    parts.push('Commence par isoler le problème : reproduis-le avec le plus petit exemple possible, lis le message d’erreur complet et note ce que tu attendais par rapport à ce que tu obtiens.');
  }
  parts.push(closing);
  return parts.join('\n\n');
}

export const agnes = {
  async status() {
    await net();
    return { available: true, model: MODEL };
  },

  async forQuestion(questionId: string) {
    await net();
    if (!load().questions.some((q) => q.id === questionId)) throw new ApiError(404);
    return { available: true, answer: db()[questionId] ?? null };
  },

  async askQuestion(questionId: string): Promise<AgnesAnswer> {
    await net();
    requireUser();
    const q = load().questions.find((x) => x.id === questionId);
    if (!q) throw new ApiError(404);
    const existing = db()[questionId];
    if (existing) return existing;
    await new Promise((r) => setTimeout(r, 900)); // le temps de « réfléchir »
    const answer: AgnesAnswer = {
      questionId,
      model: MODEL,
      createdAt: now(),
      body: compose(
        `Voici une première piste pour « ${q.title} ».`,
        [q.title, q.body, q.tags.join(' '), q.code?.lang ?? ''].join(' '),
        'Si ça ne suffit pas, précise dans un commentaire le message d’erreur exact et ce que tu as déjà essayé : la communauté pourra aller plus loin.',
      ),
    };
    db()[questionId] = answer;
    save();
    return answer;
  },

  async chat(messages: AgnesTurn[]): Promise<{ reply: string }> {
    await net();
    requireUser();
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) throw new ApiError(400, 'Écrivez votre question à Agnès.');
    await new Promise((r) => setTimeout(r, 700));
    return {
      reply: compose(
        'Bonne question ! Voici comment je m’y prendrais.',
        last.content,
        'Tu veux que je détaille une étape, ou que je t’aide à transformer ça en question pour la communauté ?',
      ),
    };
  },
};
