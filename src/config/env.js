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
};

env.isProd = env.nodeEnv === 'production';

module.exports = env;
