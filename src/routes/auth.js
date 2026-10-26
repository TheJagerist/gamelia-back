const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, pool } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');
const { loadMe } = require('../utils/publicUser');
const { SESSION_TTL_MS, setSessionCookies, clearSessionCookies } = require('../utils/cookies');

const router = express.Router();

async function createSession(userId, userAgent) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { rows } = await query(
    `INSERT INTO sessions (user_id, user_agent, expires_at) VALUES ($1, $2, $3)
     RETURNING id, csrf_token`,
    [userId, userAgent || null, expiresAt]
  );
  return rows[0];
}

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
    name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.'),
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
    country: z.string().trim().min(2, 'Le pays est requis.'),
    company: z.string().trim().min(1).optional(),
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
      `INSERT INTO users (username, name, email, password_hash, role, country, company, recruiter_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
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
      return res.status(201).json({ pending: true });
    }

    const session = await createSession(user.id, req.get('user-agent'));
    setSessionCookies(res, session.id, session.csrf_token);
    res.status(201).json(await loadMe(user.id));
  })
);

async function generateUniqueUsername(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30) || 'membre';

  let candidate = base;
  let suffix = 1;
  // Boucle bornée : en pratique converge en 1-2 tours, mais on évite toute
  // boucle infinie si la base est très générique.
  while (suffix < 1000) {
    const { rows } = await query('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  throw new Error('Impossible de générer un nom d’utilisateur unique.');
}

async function notifyAllAdmins(kind, text, href) {
  await query(
    `INSERT INTO notifications (user_id, kind, text, href)
     SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'`,
    [kind, text, href]
  );
}

// --- POST /auth/connexion ----------------------------------------------------
const connexionSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
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

// --- POST /auth/mot-de-passe-oublie -------------------------------------------
const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.') });

router.post(
  '/mot-de-passe-oublie',
  asyncHandler(async (req, res) => {
    validate(forgotSchema, req.body);
    // Toujours répondre pareil, que l'email existe ou non (ne pas divulguer
    // l'existence d'un compte). L'envoi d'email réel est hors scope MVP —
    // TODO brancher un fournisseur (ex. Resend/SendGrid) avant la démo si le temps le permet.
    res.json({ sent: true });
  })
);

module.exports = router;
