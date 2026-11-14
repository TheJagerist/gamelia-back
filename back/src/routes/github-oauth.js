// Connexion avec GitHub (OAuth 2.0, flux « application web »). Monté sous /auth/github par routes/auth.js.
//
//   GET  /auth/github/etat         -> { enabled }          le bouton s'affiche seulement si GitHub est configuré
//   GET  /auth/github/start        -> 302 vers GitHub      ?mode=connexion (défaut) | lier (relier un compte déjà connecté)
//   GET  /auth/github/callback     -> 302 vers le site     retour de GitHub : ouvre la session, ou prépare l'inscription
//   GET  /auth/github/en-attente   -> { login, name, email }   données GitHub d'une inscription à terminer
//   POST /auth/github/finaliser    -> User                 termine l'inscription (pays + conditions) et ouvre la session
//
// Sécurité :
//   - paramètre « state » aléatoire, gardé dans un cookie signé httpOnly de 10 minutes : refuse tout retour de GitHub
//     qui ne vient pas d'une demande faite depuis ce navigateur ;
//   - un compte Gamelia existant n'est JAMAIS relié automatiquement à un compte GitHub à cause d'une adresse e-mail identique
//     (Gamelia ne vérifie pas les e-mails : sinon on pourrait créer un compte avec l'adresse de quelqu'un d'autre, puis
//     récupérer son compte le jour où il se connecte avec GitHub). Pour relier, il faut être connecté, puis passer par « lier » ;
//   - seule l'adresse e-mail VÉRIFIÉE par GitHub est utilisée ;
//   - le jeton d'accès GitHub sert à lire le profil, puis est oublié : il n'est ni stocké ni journalisé.
const crypto = require('node:crypto');
const mailTemplates = require('../services/mail-templates');
const { sendMailInBackground } = require('../services/mailer');
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const env = require('../config/env');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { loadMe } = require('../utils/publicUser');
const { setSessionCookies, setSignedCookie, clearSignedCookie, readSignedCookie } = require('../utils/cookies');
const { createSession, generateUniqueUsername } = require('../utils/accounts');
const points = require('../services/points');

const router = express.Router();

const STATE_COOKIE = 'gamelia_oauth';
const PENDING_COOKIE = 'gamelia_oauth_new';
const STATE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 10000;

const cfg = env.githubOauth;
const isEnabled = () => Boolean(cfg.clientId && cfg.clientSecret);
const front = (path) => `${env.frontOrigin.replace(/\/+$/, '')}${path}`;

/** Redirection d'erreur vers la page où se trouvait le membre (le front affiche le message correspondant au code). */
function fail(res, mode, code) {
  if (mode === 'lier' && code !== 'session') return res.redirect(front(`/profil?github=${code}`));
  return res.redirect(front(`/connexion?erreur=${code}`));
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function githubFetch(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GITHUB_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Échange le code reçu de GitHub contre un jeton d'accès. Lève une erreur si GitHub refuse. */
async function exchangeCode(code) {
  const res = await githubFetch(`${cfg.siteUrl}/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'gamelia-oauth' },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: cfg.callbackUrl }),
  });
  const data = await res.json().catch(() => null);
  // GitHub répond 200 même pour un code refusé : l'erreur se lit dans le corps.
  if (!res.ok || !data || !data.access_token) throw new Error(`échange du code refusé (${(data && data.error) || res.status})`);
  return data.access_token;
}

const authHeaders = (token) => ({ Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'gamelia-oauth' });

async function fetchProfile(token) {
  const res = await githubFetch(`${env.githubApiUrl}/user`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`lecture du profil refusée (${res.status})`);
  const u = await res.json();
  if (!u || !Number.isSafeInteger(u.id) || typeof u.login !== 'string' || !u.login) throw new Error('profil GitHub inattendu');
  return { id: u.id, login: u.login, name: typeof u.name === 'string' ? u.name : '' };
}

/** Adresse e-mail principale vérifiée par GitHub (sinon une autre adresse vérifiée), ou null. */
async function fetchVerifiedEmail(token) {
  const res = await githubFetch(`${env.githubApiUrl}/user/emails`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`lecture des e-mails refusée (${res.status})`);
  const list = await res.json();
  if (!Array.isArray(list)) return null;
  const verified = list.filter((e) => e && e.verified === true && typeof e.email === 'string');
  const chosen = verified.find((e) => e.primary) || verified[0];
  return chosen ? chosen.email.trim().toLowerCase() : null;
}

router.get('/etat', (req, res) => {
  res.json({ enabled: isEnabled() });
});

router.get(
  '/start',
  asyncHandler(async (req, res) => {
    const mode = req.query.mode === 'lier' ? 'lier' : 'connexion';
    if (!isEnabled()) return fail(res, mode, 'github_indisponible');
    if (mode === 'lier' && !req.user) return fail(res, mode, 'session');

    const state = crypto.randomBytes(24).toString('hex');
    setSignedCookie(res, STATE_COOKIE, { state, mode, userId: req.user ? req.user.id : null }, STATE_TTL_MS);

    const url = new URL(`${cfg.siteUrl}/login/oauth/authorize`);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', cfg.callbackUrl);
    // « lier » n'a besoin que de l'identité ; « connexion » lit aussi l'adresse e-mail vérifiée pour créer le compte.
    url.searchParams.set('scope', mode === 'lier' ? 'read:user' : 'read:user user:email');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const saved = readSignedCookie(req, STATE_COOKIE);
    clearSignedCookie(res, STATE_COOKIE); // un état ne sert qu'une fois
    const mode = saved && saved.mode === 'lier' ? 'lier' : 'connexion';

    if (!isEnabled()) return fail(res, mode, 'github_indisponible');
    if (req.query.error) return fail(res, mode, 'github_refuse'); // le membre a refusé sur la page de GitHub
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!saved || !state || !code || !safeEqual(state, saved.state)) return fail(res, mode, 'github_etat');

    let gh;
    let email = null;
    try {
      const token = await exchangeCode(code);
      gh = await fetchProfile(token);
      if (mode === 'connexion') email = await fetchVerifiedEmail(token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[github-oauth]', err && err.message);
      return fail(res, mode, 'github_echec');
    }

    // --- Relier GitHub à un compte déjà connecté ---------------------------------------------------------------
    if (mode === 'lier') {
      if (!req.user || req.user.id !== saved.userId) return fail(res, mode, 'session');
      const clash = await query(
        'SELECT 1 FROM users WHERE id <> $3 AND (github_id = $1 OR (github_verified AND lower(github_username) = lower($2)))',
        [gh.id, gh.login, req.user.id]
      );
      if (clash.rows.length) return fail(res, mode, 'github_deja_lie');
      try {
        await query(
          `UPDATE users SET github_id = $2, github_username = $3, github_verified = true,
                  github_code = NULL, github_code_expires_at = NULL, updated_at = now() WHERE id = $1`,
          [req.user.id, gh.id, gh.login]
        );
      } catch (err) {
        if (err.code === '23505') return fail(res, mode, 'github_deja_lie');
        throw err;
      }
      await points.giveBadge(req.user.id, 'b8');
      return res.redirect(front('/profil?github=ok'));
    }

    // --- Connexion : le compte GitHub est déjà relié à un membre ----------------------------------------------
    const found = await query('SELECT id, role, recruiter_status FROM users WHERE github_id = $1', [gh.id]);
    if (found.rows.length) {
      const user = found.rows[0];
      if (user.role === 'recruteur' && user.recruiter_status !== 'valide') return fail(res, mode, 'recruteur_non_valide');
      const session = await createSession(user.id, req.get('user-agent'));
      setSessionCookies(res, session.id, session.csrf_token);
      return res.redirect(front('/connexion?github=ok')); // la page de connexion charge le compte puis redirige vers son espace
    }

    // --- Première connexion avec GitHub : on prépare la création du compte ---------------------------------------
    if (!email) return fail(res, mode, 'github_email');
    const taken = await query(
      `SELECT
         EXISTS (SELECT 1 FROM users WHERE email = $1) AS email_pris,
         EXISTS (SELECT 1 FROM users WHERE github_verified AND lower(github_username) = lower($2)) AS login_pris`,
      [email, gh.login]
    );
    if (taken.rows[0].email_pris) return fail(res, mode, 'github_email_existe');
    if (taken.rows[0].login_pris) return fail(res, mode, 'github_deja_lie');

    setSignedCookie(res, PENDING_COOKIE, { id: gh.id, login: gh.login, name: gh.name, email }, PENDING_TTL_MS);
    return res.redirect(front('/inscription/github'));
  })
);

router.get('/en-attente', (req, res) => {
  const pending = readSignedCookie(req, PENDING_COOKIE);
  if (!pending) throw new ApiError(404, 'Cette demande a expiré. Cliquez de nouveau sur « Continuer avec GitHub ».', { code: 'github_expire' });
  res.json({ login: pending.login, name: pending.name || pending.login, email: pending.email });
});

const finaliserSchema = z.object({
  country: z.string().trim().min(2, 'Le pays est requis.').max(60, 'Le pays est requis.'),
  acceptTerms: z.any().refine((v) => v === true, { message: 'Vous devez accepter les conditions d’utilisation et la politique de confidentialité.' }),
});

router.post(
  '/finaliser',
  asyncHandler(async (req, res) => {
    const data = validate(finaliserSchema, req.body);
    const pending = readSignedCookie(req, PENDING_COOKIE);
    if (!pending) throw new ApiError(400, 'Cette demande a expiré. Cliquez de nouveau sur « Continuer avec GitHub ».', { code: 'github_expire' });

    const dup = await query('SELECT 1 FROM users WHERE github_id = $1 OR email = $2', [pending.id, pending.email]);
    if (dup.rows.length) throw ApiError.conflict('Un compte existe déjà pour ce compte GitHub ou cette adresse e-mail.');

    const username = await generateUniqueUsername(pending.login);
    const name = (pending.name && pending.name.trim().length >= 2 ? pending.name.trim() : pending.login).slice(0, 120);
    // Mot de passe aléatoire que personne ne connaît : le compte ne s'ouvre qu'avec GitHub tant que le membre n'en définit pas un.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    let user;
    try {
      const inserted = await query(
        `INSERT INTO users (username, name, email, password_hash, has_password, role, country,
                            github_id, github_username, github_verified, terms_accepted_at)
         VALUES ($1, $2, $3, $4, false, 'developpeur', $5, $6, $7, true, now()) RETURNING id`,
        [username, name, pending.email, passwordHash, data.country, pending.id, pending.login]
      );
      user = inserted.rows[0];
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Un compte existe déjà pour ce compte GitHub ou cette adresse e-mail.');
      throw err;
    }
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
    await points.giveBadge(user.id, 'b8');
    sendMailInBackground({ to: pending.email, ...mailTemplates.welcomeDeveloper({ name }) });

    const session = await createSession(user.id, req.get('user-agent'));
    setSessionCookies(res, session.id, session.csrf_token);
    clearSignedCookie(res, PENDING_COOKIE);
    res.status(201).json(await loadMe(user.id));
  })
);

module.exports = router;
