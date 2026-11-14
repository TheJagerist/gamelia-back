// Profil et paramètres du compte connecté.
// Profil (PATCH /moi), vérification GitHub, paramètres, mot de passe, suppression du compte.
const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db/pool');
const { clearSessionCookies } = require('../utils/cookies');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');
const points = require('../services/points');
const { loadMe } = require('../utils/publicUser');

// Lien externe : https uniquement. z.string().url() seul accepterait « javascript:… », qui s'exécuterait
// au clic sur le profil public (XSS stockée).
const httpsUrl = (message) =>
  z
    .string()
    .trim()
    .max(500, 'Ce lien est trop long.')
    .refine((u) => /^https:\/\/[^\s/]+\.[^\s/]+/.test(u), { message });

// Photo de profil : le front la réduit à 256 px et l'envoie en « data:image/jpeg;base64,… » (pas d'envoi de
// fichier sur le serveur). On accepte aussi un lien https. Rien d'autre : ni SVG (scripts possibles), ni autre schéma.
const AVATAR_DATA_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const avatarSchema = z
  .string()
  .trim()
  .max(150000, 'La photo est trop lourde. Choisissez une image plus petite.')
  .refine((u) => AVATAR_DATA_RE.test(u) || (u.length <= 500 && /^https:\/\/[^\s/]+\.[^\s/]+/.test(u)), { message: 'Cette image n’est pas utilisable. Choisissez une photo JPEG, PNG ou WebP.' });

const router = express.Router();
router.use(requireUser); // toutes les routes de ce fichier exigent une session

// --- PATCH /moi -----------------------------------------------------------------
const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom.').max(120, 'Le nom ne doit pas dépasser 120 caractères.').optional(),
  bio: z.string().max(280, 'La bio dépasse 280 caractères.').optional(),
  avatarUrl: avatarSchema.optional().nullable(), // null = retirer la photo
  country: z.string().trim().min(1).max(60).optional(),
  city: z.string().trim().max(80, 'La ville ne doit pas dépasser 80 caractères.').optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(30, 'Choisissez 30 compétences au maximum.').optional(),
  // DeclaredLink[] : remplace entièrement la liste (cf. mock : "Object.assign(u, patch)").
  links: z
    .array(
      z.object({
        kind: z.enum(['github', 'site', 'projet']),
        label: z.string().trim().min(1, 'Donnez un nom à ce lien.').max(160, 'Ce nom est trop long.'),
        url: httpsUrl('Indiquez un lien complet qui commence par https://'),
      })
    )
    .max(6, 'Six liens au maximum.')
    .optional(),
  following: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
});

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const data = validate(updateProfileSchema, req.body);

    const sets = [];
    const params = [];
    const push = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.name !== undefined) push('name', data.name);
    if (data.bio !== undefined) push('bio', data.bio);
    if (data.avatarUrl !== undefined) push('avatar_url', data.avatarUrl);
    if (data.country !== undefined) push('country', data.country);
    if (data.city !== undefined) push('city', data.city);
    if (data.skills !== undefined) push('skills', data.skills);

    if (sets.length) {
      params.push(req.user.id);
      await query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
    }

    if (data.links !== undefined) {
      await query('DELETE FROM declared_links WHERE user_id = $1', [req.user.id]);
      for (let i = 0; i < data.links.length; i++) {
        const l = data.links[i];
        await query('INSERT INTO declared_links (user_id, kind, label, url, position) VALUES ($1,$2,$3,$4,$5)', [req.user.id, l.kind, l.label, l.url, i]);
      }
    }

    if (data.following !== undefined) {
      await query('DELETE FROM followed_tags WHERE user_id = $1', [req.user.id]);
      for (const tag of data.following) {
        await query('INSERT INTO followed_tags (user_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, tag]);
      }
    }

    res.json(await loadMe(req.user.id));
  })
);

// --- Vérification du compte GitHub -----------------------------------------------------
// Le badge « compte vérifié » prouve que le membre contrôle réellement le compte GitHub indiqué :
//   1. POST /moi/github/code          { username } -> { username, code, expiresAt }
//      Gamelia génère un code à usage unique, valable 30 minutes.
//   2. Le membre colle ce code dans la bio de son profil GitHub (lui seul peut la modifier).
//   3. POST /moi/github/verification  -> User
//      L'API relit la bio publique sur api.github.com ; si le code y figure, le compte est vérifié.
// Aucun mot de passe ni jeton GitHub n'est demandé ni stocké.
const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const GITHUB_CODE_TTL_MS = 30 * 60 * 1000;

const githubLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.githubRateLimitMax,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de vérification. Patientez dix minutes puis réessayez.' },
});

function requireDeveloper(req) {
  if (req.user.role !== 'developpeur') throw ApiError.forbidden();
}

const githubCodeSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((u) => u.replace(/^@/, ''))
    .refine((u) => GITHUB_USERNAME_RE.test(u), { message: 'Indiquez votre nom d’utilisateur GitHub (lettres, chiffres et tirets), sans l’adresse complète.' }),
});

router.post(
  '/github/code',
  githubLimiter,
  asyncHandler(async (req, res) => {
    requireDeveloper(req);
    if (req.user.githubVerified) throw ApiError.conflict('Votre compte GitHub est déjà vérifié.');
    const { username } = validate(githubCodeSchema, req.body);

    const taken = await query('SELECT 1 FROM users WHERE github_verified AND lower(github_username) = lower($1) AND id <> $2', [username, req.user.id]);
    if (taken.rows.length) throw ApiError.conflict('Ce compte GitHub est déjà relié à un autre membre de Gamelia.');

    const code = `gamelia-${crypto.randomBytes(5).toString('hex')}`;
    const expiresAt = new Date(Date.now() + GITHUB_CODE_TTL_MS);
    await query('UPDATE users SET github_username = $2, github_code = $3, github_code_expires_at = $4, updated_at = now() WHERE id = $1', [req.user.id, username, code, expiresAt]);
    res.status(201).json({ username, code, expiresAt });
  })
);

router.post(
  '/github/verification',
  githubLimiter,
  asyncHandler(async (req, res) => {
    requireDeveloper(req);
    const { rows } = await query('SELECT github_verified, github_username, github_code, github_code_expires_at FROM users WHERE id = $1', [req.user.id]);
    const me = rows[0];
    if (me.github_verified) return res.json(await loadMe(req.user.id));
    if (!me.github_code || !me.github_username || new Date(me.github_code_expires_at) < new Date()) {
      throw ApiError.badRequest('Votre code a expiré. Demandez un nouveau code puis recommencez.');
    }

    const profile = await fetchGithubProfile(me.github_username);
    if (!profile) throw ApiError.badRequest(`Le compte GitHub « ${me.github_username} » est introuvable. Vérifiez le nom d’utilisateur.`);
    if (!String(profile.bio || '').includes(me.github_code)) {
      throw ApiError.badRequest(`Le code ${me.github_code} n’apparaît pas dans la bio GitHub de ${me.github_username}. Enregistrez-le dans votre bio, puis réessayez.`);
    }

    try {
      await query(
        'UPDATE users SET github_verified = true, github_username = $2, github_code = NULL, github_code_expires_at = NULL, updated_at = now() WHERE id = $1',
        [req.user.id, profile.login || me.github_username]
      );
    } catch (err) {
      // Index unique : deux membres ont tenté de vérifier le même compte GitHub en même temps.
      if (err.code === '23505') throw ApiError.conflict('Ce compte GitHub est déjà relié à un autre membre de Gamelia.');
      throw err;
    }
    await points.giveBadge(req.user.id, 'b8');
    res.json(await loadMe(req.user.id));
  })
);

/** Profil public GitHub ({ login, bio }), ou null si le compte n'existe pas. */
async function fetchGithubProfile(username) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res;
  try {
    res = await fetch(`${env.githubApiUrl}/users/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'gamelia-verification' },
      signal: ctrl.signal,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[github] appel impossible :', err && err.message);
    throw new ApiError(502, 'GitHub est injoignable pour le moment. Réessayez dans un instant.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[github] réponse ${res.status}`);
    throw new ApiError(502, 'GitHub n’a pas pu répondre (trop de demandes ou service indisponible). Réessayez dans quelques minutes.');
  }
  return res.json();
}

// --- GET /moi/parametres ------------------------------------------------------------
function toSettings(row) {
  return {
    theme: row.theme,
    language: row.language,
    notify: {
      reponses: row.notify_reponses,
      commentaires: row.notify_commentaires,
      badges: row.notify_badges,
      candidatures: row.notify_candidatures,
      resumeHebdo: row.notify_resume_hebdo,
    },
    privacy: {
      profilPublic: row.privacy_profil_public,
      afficherVille: row.privacy_afficher_ville,
      visibleRecruteurs: row.privacy_visible_recruteurs,
    },
  };
}

router.get(
  '/parametres',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    if (!rows.length) {
      // Filet de sécurité : une session ne devrait jamais exister sans ligne user_settings
      // (créée à l'inscription), mais on s'en protège plutôt que de planter.
      await query('INSERT INTO user_settings (user_id) VALUES ($1)', [req.user.id]);
      const retry = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
      return res.json(toSettings(retry.rows[0]));
    }
    res.json(toSettings(rows[0]));
  })
);

// --- PATCH /moi/parametres (merge, pas replace) --------------------------------------
const settingsPatchSchema = z.object({
  theme: z.enum(['systeme', 'clair', 'sombre']).optional(),
  language: z.enum(['fr', 'en']).optional(),
  notify: z
    .object({
      reponses: z.boolean().optional(),
      commentaires: z.boolean().optional(),
      badges: z.boolean().optional(),
      candidatures: z.boolean().optional(),
      resumeHebdo: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      profilPublic: z.boolean().optional(),
      afficherVille: z.boolean().optional(),
      visibleRecruteurs: z.boolean().optional(),
    })
    .optional(),
});

router.patch(
  '/parametres',
  asyncHandler(async (req, res) => {
    const data = validate(settingsPatchSchema, req.body);
    await query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.user.id]);

    const sets = [];
    const params = [];
    const push = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.theme !== undefined) push('theme', data.theme);
    if (data.language !== undefined) push('language', data.language);
    if (data.notify?.reponses !== undefined) push('notify_reponses', data.notify.reponses);
    if (data.notify?.commentaires !== undefined) push('notify_commentaires', data.notify.commentaires);
    if (data.notify?.badges !== undefined) push('notify_badges', data.notify.badges);
    if (data.notify?.candidatures !== undefined) push('notify_candidatures', data.notify.candidatures);
    if (data.notify?.resumeHebdo !== undefined) push('notify_resume_hebdo', data.notify.resumeHebdo);
    if (data.privacy?.profilPublic !== undefined) push('privacy_profil_public', data.privacy.profilPublic);
    if (data.privacy?.afficherVille !== undefined) push('privacy_afficher_ville', data.privacy.afficherVille);
    if (data.privacy?.visibleRecruteurs !== undefined) push('privacy_visible_recruteurs', data.privacy.visibleRecruteurs);

    if (sets.length) {
      params.push(req.user.id);
      await query(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = $${params.length}`, params);
    }

    const { rows } = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    res.json(toSettings(rows[0]));
  })
);

// --- POST /moi/mot-de-passe ----------------------------------------------------------
// `current` est facultatif : un compte créé avec GitHub n'a pas de mot de passe connu (has_password = false) et peut
// en définir un sans « mot de passe actuel ». Pour tous les autres comptes, il reste obligatoire.
const changePasswordSchema = z.object({
  current: z.string().optional(),
  next: z.string().min(8, 'Le nouveau mot de passe doit faire au moins 8 caractères.').max(128, 'Le mot de passe ne doit pas dépasser 128 caractères.'),
});

router.post(
  '/mot-de-passe',
  asyncHandler(async (req, res) => {
    const data = validate(changePasswordSchema, req.body);
    const { rows } = await query('SELECT password_hash, has_password FROM users WHERE id = $1', [req.user.id]);
    if (rows[0].has_password) {
      const ok = data.current && (await bcrypt.compare(data.current, rows[0].password_hash));
      if (!ok) throw ApiError.badRequest('Le mot de passe actuel est incorrect.', { current: 'Mot de passe incorrect.' });
    }

    const newHash = await bcrypt.hash(data.next, 12);
    await query('UPDATE users SET password_hash = $1, has_password = true, updated_at = now() WHERE id = $2', [newHash, req.user.id]);
    // Les autres appareils sont déconnectés : si le mot de passe a été changé parce qu'il a fuité,
    // une session ouverte ailleurs ne doit pas rester valable.
    await query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [req.user.id, req.sessionId]);
    res.status(204).end();
  })
);

// --- DELETE /moi -----------------------------------------------------------------
// Compte avec mot de passe : on demande le mot de passe. Compte créé avec GitHub et sans mot de passe défini :
// on demande de retaper son nom d'utilisateur (confirmation volontaire, comme pour supprimer un dépôt GitHub).
const deleteAccountSchema = z.object({ password: z.string().optional(), confirm: z.string().optional() });

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      throw ApiError.forbidden("Un compte admin ne peut pas être supprimé depuis l'interface.");
    }
    const data = validate(deleteAccountSchema, req.body);
    const { rows } = await query('SELECT password_hash, has_password, username FROM users WHERE id = $1', [req.user.id]);
    if (rows[0].has_password) {
      const ok = data.password && (await bcrypt.compare(data.password, rows[0].password_hash));
      if (!ok) throw ApiError.badRequest('Mot de passe incorrect.', { password: 'Mot de passe incorrect.' });
    } else if (String(data.confirm || '').trim().toLowerCase() !== rows[0].username.toLowerCase()) {
      throw ApiError.badRequest('Tapez votre nom d’utilisateur pour confirmer.', { password: 'Tapez votre nom d’utilisateur pour confirmer.' });
    }

    await query('DELETE FROM users WHERE id = $1', [req.user.id]); // cascade sur toutes les tables liées (FK ON DELETE CASCADE)
    clearSessionCookies(res);
    res.status(204).end();
  })
);

module.exports = router;
