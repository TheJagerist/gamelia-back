// Auth par cookie httpOnly opaque (pas de JWT). Le cookie contient l'id de
// session (sessions.id), jamais l'id utilisateur directement.
const env = require('../config/env');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { clearSessionCookies } = require('../utils/cookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Charge la session + l'utilisateur si le cookie est présent et valide.
// Ne bloque jamais : une route publique doit pouvoir répondre différemment
// selon que req.user existe ou non (ex. GET /profils/:username).
async function attachSession(req, res, next) {
  try {
    const sessionId = req.cookies[env.sessionCookieName];
    if (!sessionId) return next();

    // Alias explicites : un simple "u.*" après "s.id" ferait écraser s.id par u.id
    // dans le résultat pg (les deux colonnes s'appellent "id"). On nomme tout à la main.
    const { rows } = await query(
      `SELECT
         s.id AS session_id, s.csrf_token, s.expires_at,
         u.id AS user_id, u.username, u.name, u.email, u.role, u.country, u.city,
         u.bio, u.avatar_url, u.skills, u.level, u.points, u.github_verified,
         u.company, u.recruiter_status
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId]
    );
    const row = rows[0];
    if (!row || new Date(row.expires_at) < new Date()) {
      clearSessionCookies(res);
      return next();
    }

    req.sessionId = sessionId;
    req.csrfToken = row.csrf_token;
    req.user = {
      id: row.user_id,
      username: row.username,
      name: row.name,
      email: row.email,
      role: row.role,
      country: row.country,
      city: row.city,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      skills: row.skills,
      level: row.level,
      points: row.points,
      githubVerified: row.github_verified,
      company: row.company,
      recruiterStatus: row.recruiter_status,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Vérifie le jeton CSRF (double-submit cookie) sur toute requête mutante
// d'un utilisateur connecté. Cohérent avec lib_api_http.ts qui envoie
// X-CSRF-Token uniquement quand method !== 'GET'.
function checkCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.user) return next(); // pas de session = pas de CSRF à vérifier ici ; requireUser gérera le 401

  const header = req.get('X-CSRF-Token');
  if (!header || header !== req.csrfToken) {
    return next(new ApiError(403, "Jeton de sécurité invalide ou expiré. Rechargez la page et réessayez."));
  }
  next();
}

// Exige une session valide.
function requireUser(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

// Exige un rôle précis. Cas spécial recruteur : doit aussi être validé par un admin.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    if (req.user.role === 'recruteur' && req.user.recruiterStatus !== 'valide') {
      return next(ApiError.forbidden('Votre compte recruteur est en attente de validation.', 'recruteur_non_valide'));
    }
    next();
  };
}

module.exports = { attachSession, checkCsrf, requireUser, requireRole };
