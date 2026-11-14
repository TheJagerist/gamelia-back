// Point d'entrée unique pour les variables d'environnement.
// Échoue bruyamment au démarrage plutôt que de tomber plus tard avec une
// erreur obscure (ex. DATABASE_URL manquant -> crash silencieux de pg).
require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`[config] Variable d'environnement manquante : ${name}. Copier .env.example en .env et la remplir.`);
    process.exit(1);
  }
  return v;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  // Interface d'écoute. En production : 127.0.0.1, l'API n'est joignable que par nginx, jamais directement depuis Internet.
  host: process.env.HOST || undefined,
  frontOrigin: required('FRONT_ORIGIN'),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  cookieSecret: required('COOKIE_SECRET'),
  cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'gamelia_session',
  csrfCookieName: process.env.CSRF_COOKIE_NAME || 'gamelia_csrf',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 30),
  // Plafond de requêtes /auth par minute et par IP. 10 en production ; relevé uniquement par les tests automatisés.
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),

  // Agnès, l'assistante IA (API Agnes AI, compatible OpenAI). Facultatif : sans clé, l'espace Agnès
  // s'affiche « indisponible » et le reste du site fonctionne normalement. La clé ne quitte jamais le serveur.
  agnes: {
    apiKey: process.env.AGNES_API_KEY || '',
    apiUrl: (process.env.AGNES_API_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/+$/, ''),
    model: process.env.AGNES_MODEL || 'agnes-2.0-flash',
    timeoutMs: Number(process.env.AGNES_TIMEOUT_MS || 60000),
    // Nombre maximal de demandes à Agnès par membre et par heure (protège le quota de la clé).
    perHour: Number(process.env.AGNES_LIMIT_PER_HOUR || 30),
  },

  // API publique de GitHub, utilisée pour vérifier un compte (lecture de la bio publique, sans clé).
  // Remplacée par un faux serveur dans les tests automatisés.
  // Tentatives de vérification GitHub par membre et par 10 minutes (relevé uniquement par les tests).
  githubRateLimitMax: Number(process.env.GITHUB_RATE_LIMIT_MAX || 10),
  githubApiUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, ''),
};

// Connexion avec GitHub (OAuth). Facultatif : sans identifiant et sans secret, le bouton « Continuer avec GitHub »
// n'apparaît pas et le reste du site fonctionne. Le secret ne quitte jamais le serveur.
//   GITHUB_CALLBACK_URL : adresse de retour déclarée dans l'application GitHub (par défaut : FRONT_ORIGIN + /api/auth/github/callback,
//   soit la configuration du VPS ; en local, front sur :3000 et API sur :4000, mettre http://localhost:4000/auth/github/callback).
//   GITHUB_OAUTH_URL : site de GitHub (remplacé par un faux serveur dans les tests automatisés).
env.githubOauth = {
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  siteUrl: (process.env.GITHUB_OAUTH_URL || 'https://github.com').replace(/\/+$/, ''),
  callbackUrl: process.env.GITHUB_CALLBACK_URL || `${env.frontOrigin.replace(/\/+$/, '')}/api/auth/github/callback`,
};

// E-mails sortants (SMTP). Facultatif : sans SMTP_HOST et MAIL_FROM, aucun e-mail n'est envoyé (le fait est écrit dans
// les journaux) et le reste du site fonctionne normalement. Le mot de passe SMTP ne quitte jamais le serveur.
env.mail = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  // true pour le port 465 (TLS immédiat) ; false pour 587 (STARTTLS) ou 25.
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  password: process.env.SMTP_PASSWORD || '',
  // Expéditeur affiché, par exemple : Gamelia <no-reply@votre-domaine>
  from: process.env.MAIL_FROM || '',
  // Adresse où arrivent les réponses des membres (par exemple celle de l'équipe). Facultatif.
  replyTo: process.env.MAIL_REPLY_TO || '',
};
env.mail.enabled = Boolean(env.mail.host && env.mail.from);

env.isProd = env.nodeEnv === 'production';

// En production, on refuse de démarrer avec une configuration dangereuse plutôt que de tourner « à moitié ».
if (env.isProd) {
  const problems = [];
  if (!/^https:\/\//.test(env.frontOrigin)) problems.push('FRONT_ORIGIN doit commencer par https:// (les cookies de session sont « Secure »).');
  for (const name of ['SESSION_SECRET', 'COOKIE_SECRET']) {
    const v = process.env[name] || '';
    if (v.length < 32 || /change-me/i.test(v)) problems.push(`${name} doit être une valeur aléatoire d'au moins 32 caractères (voir .env.example).`);
  }
  if (/mot_de_passe|MOT_DE_PASSE/.test(env.databaseUrl)) problems.push("DATABASE_URL contient encore le mot de passe d'exemple.");
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.error(`[config] Configuration de production refusée :\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
}

module.exports = env;
