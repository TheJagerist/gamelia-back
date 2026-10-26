// Gestion unique des cookies de session (httpOnly) et CSRF (lisible par le front).
// Utilisé par les routes d'auth ET par le middleware de session : les attributs (domain, path…)
// doivent être identiques à la pose et à l'effacement, sinon le navigateur ne supprime rien.
const env = require('../config/env');

const SESSION_TTL_MS = env.sessionTtlDays * 24 * 60 * 60 * 1000;

// En local (localhost) on n'envoie pas d'attribut Domain : certains navigateurs refusent
// "Domain=localhost", et un cookie sans Domain est partagé entre les ports (front :3000, API :4000).
// En production, COOKIE_DOMAIN = domaine parent commun au front et à l'API (ex. ".gamelia.africa") :
// c'est nécessaire car le front lit le cookie CSRF via document.cookie.
const domain = env.cookieDomain && env.cookieDomain !== 'localhost' ? env.cookieDomain : undefined;

const baseOpts = { domain, secure: env.isProd, sameSite: 'lax', path: '/' };

function setSessionCookies(res, sessionId, csrfToken) {
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  res.cookie(env.sessionCookieName, sessionId, { ...baseOpts, httpOnly: true, expires });
  // httpOnly = false volontairement : lib/api/http.ts lit ce cookie pour renvoyer X-CSRF-Token.
  res.cookie(env.csrfCookieName, csrfToken, { ...baseOpts, httpOnly: false, expires });
}

function clearSessionCookies(res) {
  res.clearCookie(env.sessionCookieName, baseOpts);
  res.clearCookie(env.csrfCookieName, baseOpts);
}

module.exports = { SESSION_TTL_MS, setSessionCookies, clearSessionCookies };
