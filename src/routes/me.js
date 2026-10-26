// Profil et paramètres du compte connecté.
// Règles reprises de lib/mock/server.ts (auth.updateProfile/linkGithub, settings.*).
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db/pool');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');
const points = require('../services/points');
const { loadMe } = require('../utils/publicUser');

const router = express.Router();
router.use(requireUser); // toutes les routes de ce fichier exigent une session

// --- PATCH /moi -----------------------------------------------------------------
const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom.').optional(),
  bio: z.string().max(280, 'La bio dépasse 280 caractères.').optional(),
  avatarUrl: z.string().trim().url().optional().nullable(),
  country: z.string().trim().min(1).optional(),
  city: z.string().trim().optional().nullable(),
  skills: z.array(z.string().trim().min(1)).optional(),
  // DeclaredLink[] : remplace entièrement la liste (cf. mock : "Object.assign(u, patch)").
  links: z
    .array(
      z.object({
        kind: z.enum(['github', 'site', 'projet']),
        label: z.string().trim().min(1),
        url: z.string().trim().url(),
      })
    )
    .optional(),
  following: z.array(z.string().trim().min(1)).optional(),
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

// --- POST /moi/github --------------------------------------------------------------
router.post(
  '/github',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'developpeur') throw ApiError.forbidden();
    await query('UPDATE users SET github_verified = true, updated_at = now() WHERE id = $1', [req.user.id]);
    await points.giveBadge(req.user.id, 'b8');
    res.json(await loadMe(req.user.id));
  })
);

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
const changePasswordSchema = z.object({
  current: z.string().min(1, 'Mot de passe incorrect.'),
  next: z.string().min(8, 'Le nouveau mot de passe doit faire au moins 8 caractères.'),
});

router.post(
  '/mot-de-passe',
  asyncHandler(async (req, res) => {
    const data = validate(changePasswordSchema, req.body);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(data.current, rows[0].password_hash);
    if (!ok) throw ApiError.badRequest('Le mot de passe actuel est incorrect.', { current: 'Mot de passe incorrect.' });

    const newHash = await bcrypt.hash(data.next, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user.id]);
    res.status(204).end();
  })
);

// --- DELETE /moi -----------------------------------------------------------------
const deleteAccountSchema = z.object({ password: z.string().min(1, 'Mot de passe incorrect.') });

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      throw ApiError.forbidden("Un compte admin ne peut pas être supprimé depuis l'interface.");
    }
    const data = validate(deleteAccountSchema, req.body);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(data.password, rows[0].password_hash);
    if (!ok) throw ApiError.badRequest('Mot de passe incorrect.', { password: 'Mot de passe incorrect.' });

    await query('DELETE FROM users WHERE id = $1', [req.user.id]); // cascade sur toutes les tables liées (FK ON DELETE CASCADE)
    res.clearCookie(env.sessionCookieName);
    res.clearCookie(env.csrfCookieName);
    res.status(204).end();
  })
);

module.exports = router;
