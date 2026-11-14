const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, pool } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');
const { loadMe } = require('../utils/publicUser');
const { setSessionCookies, clearSessionCookies } = require('../utils/cookies');
const { createSession, generateUniqueUsername } = require('../utils/accounts');
const crypto = require('crypto');
const env = require('../config/env');
const mailTemplates = require('../services/mail-templates');
const { sendMailInBackground } = require('../services/mailer');

const router = express.Router();

// --- GET /auth/me -----------------------------------------------------------
// attachSession (monté globalement dans server.js) a déjà rempli req.user si
// un cookie de session valide est présent ; sinon req.user est undefined.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(req.user ? await loadMe(req.user.id) : null);
  })
);

// --- POST /auth/inscription --------------------------------------------------
const inscriptionSchema = z
  .object({
    role: z.enum(['developpeur', 'recruteur']),
    name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(120, 'Le nom ne doit pas dépasser 120 caractères.'),
    email: z.string().trim().toLowerCase().max(254, 'Adresse e-mail invalide.').email('Adresse e-mail invalide.'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(128, 'Le mot de passe ne doit pas dépasser 128 caractères.'),
    country: z.string().trim().min(2, 'Le pays est requis.').max(60, 'Le pays est requis.'),
    company: z.string().trim().min(1).max(120, 'Le nom de l’entreprise ne doit pas dépasser 120 caractères.').optional(),
    // Case « J'accepte les conditions d'utilisation et la politique de confidentialité » : obligatoire.
    acceptTerms: z.any().refine((v) => v === true, { message: 'Vous devez accepter les conditions d’utilisation et la politique de confidentialité.' }),
  })
  .refine((d) => d.role !== 'recruteur' || !!d.company, {
    message: "Le nom de l'entreprise est requis pour un compte recruteur.",
    path: ['company'],
  });

router.post(
  '/inscription',
  asyncHandler(async (req, res) => {
    const data = validate(inscriptionSchema, req.body);

    const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw ApiError.conflict('Un compte existe déjà avec cette adresse e-mail.');
    }

    const username = await generateUniqueUsername(data.name);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const recruiterStatus = data.role === 'recruteur' ? 'en_attente' : null;

    const inserted = await query(
      `INSERT INTO users (username, name, email, password_hash, role, country, company, recruiter_status, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
      [username, data.name, data.email, passwordHash, data.role, data.country, data.company || null, recruiterStatus]
    );
    const user = inserted.rows[0];

    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    if (data.role === 'recruteur') {
      // Compte en attente : pas de session ouverte, on notifie les admins.
      await notifyAllAdmins(
        'validation',
        `${user.name} (${user.company}) a demandé un compte recruteur.`,
        '/admin/validations'
      );
      sendMailInBackground({ to: user.email, ...mailTemplates.welcomeRecruiterPending(user) });
      return res.status(201).json({ pending: true });
    }

    sendMailInBackground({ to: user.email, ...mailTemplates.welcomeDeveloper(user) });
    const session = await createSession(user.id, req.get('user-agent'));
    setSessionCookies(res, session.id, session.csrf_token);
    res.status(201).json(await loadMe(user.id));
  })
);

async function notifyAllAdmins(kind, text, href) {
  await query(
    `INSERT INTO notifications (user_id, kind, text, href)
     SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'`,
    [kind, text, href]
  );
}

// --- POST /auth/connexion ----------------------------------------------------
const connexionSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, 'Adresse e-mail invalide.').email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.').max(128, 'Adresse e-mail ou mot de passe incorrect.'),
});

router.post(
  '/connexion',
  asyncHandler(async (req, res) => {
    const data = validate(connexionSchema, req.body);

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [data.email]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) {
      // Message volontairement générique : ne pas révéler si l'email existe.
      throw ApiError.badRequest('Adresse e-mail ou mot de passe incorrect.');
    }

    if (user.role === 'recruteur' && user.recruiter_status !== 'valide') {
      throw ApiError.forbidden('Votre compte recruteur est en attente de validation par un administrateur.', 'recruteur_non_valide');
    }

    const session = await createSession(user.id, req.get('user-agent'));
    setSessionCookies(res, session.id, session.csrf_token);
    res.json(await loadMe(user.id));
  })
);

// --- POST /auth/deconnexion ---------------------------------------------------
router.post(
  '/deconnexion',
  requireUser,
  asyncHandler(async (req, res) => {
    await query('DELETE FROM sessions WHERE id = $1', [req.sessionId]);
    clearSessionCookies(res);
    res.status(204).end();
  })
);

// --- Mot de passe oublié -------------------------------------------------------------
// Par e-mail : un lien à usage unique, valable 60 minutes, dont seule l'empreinte SHA-256 est stockée.
// Sans SMTP configuré, la fonction est désactivée (GET /auth/mot-de-passe-oublie/etat -> enabled:false) et le front
// renvoie vers l'équipe, qui utilise `npm run reset-password`.
const RESET_VALIDITY_MINUTES = 60;
const RESET_MAX_PER_HOUR = 3; // demandes par compte et par heure : évite d'inonder une boîte e-mail
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

router.get('/mot-de-passe-oublie/etat', (req, res) => res.json({ enabled: env.mail.enabled }));

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, 'Adresse e-mail invalide.').email('Adresse e-mail invalide.'),
});

router.post(
  '/mot-de-passe-oublie',
  asyncHandler(async (req, res) => {
    const data = validate(forgotSchema, req.body);
    if (!env.mail.enabled) {
      throw new ApiError(400, "L'envoi d'e-mails n'est pas activé sur ce site. Écrivez à l'équipe pour retrouver l'accès à votre compte.", { code: 'email_indisponible' });
    }
    // Réponse identique que le compte existe ou non (on ne révèle pas quelles adresses sont inscrites) ;
    // le travail se fait après la réponse, pour que le temps de réponse ne révèle rien non plus.
    res.status(202).json({ sent: true });
    setImmediate(() => {
      issueResetLink(data.email).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[mot-de-passe-oublie] échec :', err.message);
      });
    });
  })
);

async function issueResetLink(email) {
  const { rows } = await query('SELECT id, name, email FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) return;
  const recent = await query(
    "SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [user.id]
  );
  if (recent.rows[0].n >= RESET_MAX_PER_HOUR) return;
  const token = crypto.randomBytes(32).toString('base64url');
  // Un nouveau lien annule les précédents.
  await query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)",
    [user.id, hashToken(token), String(RESET_VALIDITY_MINUTES)]
  );
  const url = `${env.frontOrigin.replace(/\/+$/, '')}/reinitialiser-mot-de-passe?token=${token}`;
  sendMailInBackground({ to: user.email, ...mailTemplates.passwordReset({ name: user.name, url, validityMinutes: RESET_VALIDITY_MINUTES }) });
}

const resetSchema = z.object({
  token: z.string().min(20, 'Ce lien est invalide ou a expiré.').max(200, 'Ce lien est invalide ou a expiré.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(128, 'Le mot de passe ne doit pas dépasser 128 caractères.'),
});

router.post(
  '/reinitialiser-mot-de-passe',
  asyncHandler(async (req, res) => {
    const data = validate(resetSchema, req.body);
    const hash = await bcrypt.hash(data.password, 12);
    // Une seule requête atomique : le jeton n'est consommé que s'il est valide, non utilisé et non expiré
    // (deux envois simultanés du même lien ne peuvent pas réussir tous les deux).
    const used = await query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(data.token)]
    );
    if (!used.rows[0]) throw new ApiError(400, 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.', { code: 'lien_invalide' });
    const userId = used.rows[0].user_id;
    const { rows } = await query(
      'UPDATE users SET password_hash = $1, has_password = true, updated_at = now() WHERE id = $2 RETURNING name, email',
      [hash, userId]
    );
    // Toutes les sessions sont fermées (le mot de passe a peut-être fuité) et les autres liens annulés.
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    if (rows[0]) sendMailInBackground({ to: rows[0].email, ...mailTemplates.passwordChanged(rows[0]) });
    res.status(204).end();
  })
);

// Connexion avec GitHub (OAuth) : /auth/github/etat, /start, /callback, /en-attente, /finaliser.
router.use('/github', require('./github-oauth'));
// Connexion avec Google (OAuth) : /auth/google/etat, /start, /callback, /en-attente, /finaliser.
router.use('/google', require('./google-oauth'));

module.exports = router;
