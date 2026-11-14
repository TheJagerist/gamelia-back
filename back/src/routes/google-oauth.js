// Connexion avec Google (OAuth 2.0 / OpenID Connect, flux « application web »). Monté sous /auth/google par routes/auth.js.
//
//   GET  /auth/google/etat         -> { enabled }          le bouton s'affiche seulement si Google est configuré
//   GET  /auth/google/start        -> 302 vers Google      ?mode=connexion (défaut) | lier (relier un compte déjà connecté)
//   GET  /auth/google/callback     -> 302 vers le site     retour de Google : ouvre la session, ou prépare l'inscription
//   GET  /auth/google/en-attente   -> { name, email }      données Google d'une inscription à terminer
//   POST /auth/google/finaliser    -> User                 termine l'inscription (pays + conditions) et ouvre la session
//
// Mêmes garanties que la connexion GitHub (voir github-oauth.js) :
//   - paramètre « state » aléatoire dans un cookie signé httpOnly de 10 minutes, à usage unique ;
//   - un compte Gamelia existant n'est JAMAIS relié automatiquement à un compte Google à cause d'une adresse e-mail
//     identique (Gamelia ne vérifie pas les e-mails à l'inscription : sinon on pourrait créer un compte avec l'adresse de
//     quelqu'un d'autre, puis récupérer son compte le jour où il se connecte avec Google) ; pour relier, il faut être
//     connecté puis passer par « lier » ;
//   - seule une adresse e-mail marquée « vérifiée » par Google est utilisée ;
//   - le jeton d'accès sert à lire le profil, puis est oublié : il n'est ni stocké ni journalisé ;
//   - identifiant stocké : « sub » (stable), jamais l'adresse e-mail comme clé.
const crypto = require('node:crypto');
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
const mailTemplates = require('../services/mail-templates');
const { sendMailInBackground } = require('../services/mailer');

const router = express.Router();

const STATE_COOKIE = 'gamelia_oauth_google';
const PENDING_COOKIE = 'gamelia_oauth_google_new';
const STATE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;
const GOOGLE_TIMEOUT_MS = 10000;

const cfg = env.googleOauth;
const isEnabled = () => Boolean(cfg.clientId && cfg.clientSecret);
const front = (path) => `${env.frontOrigin.replace(/\/+$/, '')}${path}`;

/** Redirection d'erreur vers la page où se trouvait le membre (le front affiche le message correspondant au code). */
function fail(res, mode, code) {
  if (mode === 'lier' && code !== 'session') return res.redirect(front(`/parametres?google=${code}`));
  return res.redirect(front(`/connexion?erreur=${code}`));
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function googleFetch(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Échange le code reçu de Google contre un jeton d'accès. Lève une erreur si Google refuse. */
async function exchangeCode(code) {
  const res = await googleFetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.callbackUrl,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || typeof data.access_token !== 'string') throw new Error(`échange du code refusé (${(data && data.error) || res.status})`);
  return data.access_token;
}

/** Profil Google : sub (stable), adresse e-mail et si Google l'a vérifiée, nom. */
async function fetchProfile(token) {
  const res = await googleFetch(cfg.userinfoUrl, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`lecture du profil refusée (${res.status})`);
  const u = await res.json();
  if (!u || typeof u.sub !== 'string' || !u.sub || u.sub.length > 255) throw new Error('profil Google inattendu');
  const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
  // Google envoie un booléen ; certains fournisseurs compatibles envoient la chaîne « true ».
  const verified = u.email_verified === true || u.email_verified === 'true';
  return { sub: u.sub, email: email && verified ? email : null, name: typeof u.name === 'string' ? u.name.trim() : '' };
}

router.get('/etat', (req, res) => {
  res.json({ enabled: isEnabled() });
});

router.get(
  '/start',
  asyncHandler(async (req, res) => {
    const mode = req.query.mode === 'lier' ? 'lier' : 'connexion';
    if (!isEnabled()) return fail(res, mode, 'google_indisponible');
    if (mode === 'lier' && !req.user) return fail(res, mode, 'session');

    const state = crypto.randomBytes(24).toString('hex');
    setSignedCookie(res, STATE_COOKIE, { state, mode, userId: req.user ? req.user.id : null }, STATE_TTL_MS);

    const url = new URL(cfg.authUrl);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', cfg.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile'); // identité de base seulement : aucun accès aux e-mails ni aux fichiers
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account'); // laisse choisir le compte Google à utiliser
    res.redirect(url.toString());
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const saved = readSignedCookie(req, STATE_COOKIE);
    clearSignedCookie(res, STATE_COOKIE); // un état ne sert qu'une fois
    const mode = saved && saved.mode === 'lier' ? 'lier' : 'connexion';

    if (!isEnabled()) return fail(res, mode, 'google_indisponible');
    if (req.query.error) return fail(res, mode, 'google_refuse'); // le membre a refusé sur la page de Google
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!saved || !state || !code || !safeEqual(state, saved.state)) return fail(res, mode, 'google_etat');

    let g;
    try {
      const token = await exchangeCode(code);
      g = await fetchProfile(token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[google-oauth]', err && err.message);
      return fail(res, mode, 'google_echec');
    }

    // --- Relier Google à un compte déjà connecté ----------------------------------------------------------------
    if (mode === 'lier') {
      if (!req.user || req.user.id !== saved.userId) return fail(res, mode, 'session');
      const clash = await query('SELECT 1 FROM users WHERE google_id = $1 AND id <> $2', [g.sub, req.user.id]);
      if (clash.rows.length) return fail(res, mode, 'google_deja_lie');
      try {
        await query('UPDATE users SET google_id = $2, updated_at = now() WHERE id = $1', [req.user.id, g.sub]);
      } catch (err) {
        if (err.code === '23505') return fail(res, mode, 'google_deja_lie');
        throw err;
      }
      return res.redirect(front('/parametres?google=ok'));
    }

    // --- Connexion : le compte Google est déjà relié à un membre -------------------------------------------------
    const found = await query('SELECT id, role, recruiter_status FROM users WHERE google_id = $1', [g.sub]);
    if (found.rows.length) {
      const user = found.rows[0];
      if (user.role === 'recruteur' && user.recruiter_status !== 'valide') return fail(res, mode, 'recruteur_non_valide');
      const session = await createSession(user.id, req.get('user-agent'));
      setSessionCookies(res, session.id, session.csrf_token);
      return res.redirect(front('/connexion?google=ok')); // la page de connexion charge le compte puis redirige vers son espace
    }

    // --- Première connexion avec Google : on prépare la création du compte -----------------------------------------
    if (!g.email) return fail(res, mode, 'google_email');
    const taken = await query('SELECT 1 FROM users WHERE email = $1', [g.email]);
    if (taken.rows.length) return fail(res, mode, 'google_email_existe');

    setSignedCookie(res, PENDING_COOKIE, { sub: g.sub, name: g.name, email: g.email }, PENDING_TTL_MS);
    return res.redirect(front('/inscription/google'));
  })
);

router.get('/en-attente', (req, res) => {
  const pending = readSignedCookie(req, PENDING_COOKIE);
  if (!pending) throw new ApiError(404, 'Cette demande a expiré. Cliquez de nouveau sur « Continuer avec Google ».', { code: 'google_expire' });
  res.json({ name: pending.name || pending.email.split('@')[0], email: pending.email });
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
    if (!pending) throw new ApiError(400, 'Cette demande a expiré. Cliquez de nouveau sur « Continuer avec Google ».', { code: 'google_expire' });

    const dup = await query('SELECT 1 FROM users WHERE google_id = $1 OR email = $2', [pending.sub, pending.email]);
    if (dup.rows.length) throw ApiError.conflict('Un compte existe déjà pour ce compte Google ou cette adresse e-mail.');

    const base = (pending.name && pending.name.trim().length >= 2 ? pending.name.trim() : pending.email.split('@')[0]).slice(0, 120);
    const username = await generateUniqueUsername(base);
    // Mot de passe aléatoire que personne ne connaît : le compte ne s'ouvre qu'avec Google tant que le membre n'en définit pas un.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    let user;
    try {
      const inserted = await query(
        `INSERT INTO users (username, name, email, password_hash, has_password, role, country, google_id, terms_accepted_at)
         VALUES ($1, $2, $3, $4, false, 'developpeur', $5, $6, now()) RETURNING id`,
        [username, base, pending.email, passwordHash, data.country, pending.sub]
      );
      user = inserted.rows[0];
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Un compte existe déjà pour ce compte Google ou cette adresse e-mail.');
      throw err;
    }
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
    sendMailInBackground({ to: pending.email, ...mailTemplates.welcomeDeveloper({ name: base }) });

    const session = await createSession(user.id, req.get('user-agent'));
    setSessionCookies(res, session.id, session.csrf_token);
    clearSignedCookie(res, PENDING_COOKIE);
    res.status(201).json(await loadMe(user.id));
  })
);

module.exports = router;
