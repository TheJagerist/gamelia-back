// Projets, commentaires, revues par les pairs, demandes de collaboration.
// Règles reprises de lib/mock/server.ts (projects.*) : validation stricte du
// domaine vidéo côté back (jamais confiance au front), anti-triche sur les
// revues (pas sur son propre projet), badges b5 (vidéo) / b6 (3 revues validées).
const express = require('express');
const { z } = require('zod');
const { query, pool } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const points = require('../services/points');
const { userCols, toPublicUser } = require('../utils/publicUser');
const { mapProjectSummary, PROJECT_SUMMARY_SELECT } = require('../services/summaries');

const router = express.Router();
const PAGE_SIZE = 6;

// Même liste blanche que lib/video.ts côté front — revalidée ici, jamais
// prise pour acquise (cf. api-routes.md : "revalider en back").
const ALLOWED_VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'player.vimeo.com'];
function isAllowedVideo(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return ALLOWED_VIDEO_HOSTS.includes(host);
  } catch {
    return false;
  }
}

async function notify(userId, kind, text, href) {
  const column = { reponse: 'notify_reponses', commentaire: 'notify_commentaires', badge: 'notify_badges', candidature: 'notify_candidatures' }[kind];
  if (column) {
    const { rows } = await query(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = $1`, [userId]);
    if (rows.length && rows[0].enabled === false) return;
  }
  await query('INSERT INTO notifications (user_id, kind, text, href) VALUES ($1, $2, $3, $4)', [userId, kind, text, href]);
}

async function techsFor(projectId) {
  const { rows } = await query('SELECT tech FROM project_techs WHERE project_id = $1', [projectId]);
  return rows.map((r) => r.tech);
}

// --- GET /projets --------------------------------------------------------------
const listQuerySchema = z.object({
  tech: z.string().trim().min(1).optional(),
  seeking: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  owner: z.string().trim().min(1).optional(), // username
  page: z.coerce.number().int().min(1).optional().default(1),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(listQuerySchema, req.query);
    const where = [];
    const params = [];
    if (opts.tech) {
      params.push(opts.tech);
      where.push(`p.id IN (SELECT project_id FROM project_techs WHERE tech = $${params.length})`);
    }
    if (opts.seeking) where.push('p.seeking_collaborators = true');
    if (opts.owner) {
      params.push(opts.owner);
      where.push(`u.username = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) FROM projects p JOIN users u ON u.id = p.owner_id ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `${PROJECT_SUMMARY_SELECT}
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = rows.map(mapProjectSummary);
    res.json({ items, page, pageCount, total });
  })
);

// --- GET /projets/:id ------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const pRes = await query(
      `SELECT p.id, p.title, p.summary, p.description, p.code_url, p.video_url, p.seeking_collaborators, p.created_at,
              ${userCols('u', 'owner_')}
       FROM projects p JOIN users u ON u.id = p.owner_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    const p = pRes.rows[0];
    if (!p) throw ApiError.notFound();

    const commentsRes = await query(
      `SELECT c.id, c.body, c.created_at,
              ${userCols('u', 'author_')}
       FROM project_comments c JOIN users u ON u.id = c.author_id
       WHERE c.project_id = $1 ORDER BY c.created_at ASC`,
      [p.id]
    );

    const reviewsRes = await query(
      `SELECT r.id, r.rating, r.body, r.created_at, r.validated_by_owner,
              ${userCols('u', 'author_')}
       FROM project_reviews r JOIN users u ON u.id = r.author_id
       WHERE r.project_id = $1 ORDER BY r.created_at ASC`,
      [p.id]
    );

    // collabRequests visibles UNIQUEMENT si connecté = owner (cf. mock : "me && me.id === p.ownerId ? ... : []").
    let collabRequests = [];
    if (req.user && req.user.id === p.owner_id) {
      const collabRes = await query(
        `SELECT c.id, c.role, c.message, c.status, c.created_at,
                ${userCols('u', 'from_')}
         FROM collab_requests c JOIN users u ON u.id = c.from_id
         WHERE c.project_id = $1 ORDER BY c.created_at DESC`,
        [p.id]
      );
      collabRequests = collabRes.rows.map((c) => ({
        id: c.id,
        from: toPublicUser(c, 'from_'),
        role: c.role,
        message: c.message,
        status: c.status,
        createdAt: c.created_at,
      }));
    }

    res.json({
      id: p.id,
      title: p.title,
      summary: p.summary,
      techs: await techsFor(p.id),
      owner: toPublicUser(p, 'owner_'),
      hasVideo: !!p.video_url,
      videoUrl: p.video_url,
      seekingCollaborators: p.seeking_collaborators,
      createdAt: p.created_at,
      validatedReviews: reviewsRes.rows.filter((r) => r.validated_by_owner).length,
      description: p.description,
      codeUrl: p.code_url,
      comments: commentsRes.rows.map((c) => ({ id: c.id, author: toPublicUser(c, 'author_'), body: c.body, createdAt: c.created_at })),
      reviews: reviewsRes.rows.map((r) => ({
        id: r.id,
        author: toPublicUser(r, 'author_'),
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
        validatedByOwner: r.validated_by_owner,
      })),
      collabRequests,
    });
  })
);

// --- POST /projets ----------------------------------------------------------------
const createProjectSchema = z.object({
  title: z.string().trim().min(5, 'Au moins 5 caractères.'),
  summary: z.string().trim().min(10, 'Résumez le projet en une phrase.'),
  description: z.string().trim().default(''),
  techs: z.array(z.string().trim().min(1)).min(1, 'Choisissez au moins une technologie.'),
  videoUrl: z.string().trim().optional(),
  codeUrl: z.string().trim().refine((u) => /^https:\/\//.test(u), { message: 'Indiquez un lien https vers le code.' }),
  seekingCollaborators: z.boolean().default(false),
});

router.post(
  '/',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const raw = { ...req.body };
    const data = validate(createProjectSchema, raw);

    // Revalidation stricte du domaine vidéo, jamais déduite du front (cf. commentaire isAllowedVideo).
    if (data.videoUrl && !isAllowedVideo(data.videoUrl)) {
      throw ApiError.badRequest('Certaines informations sont incorrectes. Vérifiez le formulaire.', { videoUrl: 'Seuls les liens YouTube ou Vimeo sont acceptés.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        `INSERT INTO projects (title, summary, description, owner_id, video_url, code_url, seeking_collaborators)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [data.title, data.summary, data.description, req.user.id, data.videoUrl || null, data.codeUrl, data.seekingCollaborators]
      );
      const projectId = insertRes.rows[0].id;
      for (const tech of data.techs) {
        await client.query('INSERT INTO project_techs (project_id, tech) VALUES ($1, $2)', [projectId, tech]);
      }
      await client.query('COMMIT');

      const result = await points.award(req.user.id, `Projet publié : ${data.title}`, 30);
      if (data.videoUrl) await points.giveBadge(req.user.id, 'b5');

      res.status(201).json({ id: projectId, points: result.awarded });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// --- POST /projets/:id/commentaires -----------------------------------------------
const commentSchema = z.object({ body: z.string().trim().min(2, 'Le commentaire est vide.') });

router.post(
  '/:id/commentaires',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(commentSchema, req.body);
    const pRes = await query('SELECT id, title, owner_id FROM projects WHERE id = $1', [req.params.id]);
    const project = pRes.rows[0];
    if (!project) throw ApiError.notFound();

    const body = data.body.slice(0, 500);
    await query('INSERT INTO project_comments (project_id, author_id, body) VALUES ($1, $2, $3)', [project.id, req.user.id, body]);
    if (project.owner_id !== req.user.id) {
      await notify(project.owner_id, 'commentaire', `${req.user.name} a commenté votre projet « ${project.title} ».`, `/projets/${project.id}`);
    }
    res.status(204).end();
  })
);

// --- POST /projets/:id/revues --------------------------------------------------------
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10, 'Donnez une note et au moins une phrase de retour.'),
});

router.post(
  '/:id/revues',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(reviewSchema, req.body);
    const pRes = await query('SELECT id, title, owner_id FROM projects WHERE id = $1', [req.params.id]);
    const project = pRes.rows[0];
    if (!project) throw ApiError.notFound();
    if (project.owner_id === req.user.id) throw ApiError.forbidden('Vous ne pouvez pas évaluer votre propre projet.');

    try {
      await query('INSERT INTO project_reviews (project_id, author_id, rating, body) VALUES ($1, $2, $3, $4)', [project.id, req.user.id, data.rating, data.body]);
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Vous avez déjà évalué ce projet.');
      throw err;
    }
    await notify(project.owner_id, 'commentaire', `${req.user.name} a évalué votre projet « ${project.title} ».`, `/projets/${project.id}`);
    res.status(204).end();
  })
);

// --- POST /projets/:id/revues/:reviewId/valider ----------------------------------------
router.post(
  '/:id/revues/:reviewId/valider',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const pRes = await query('SELECT id, title, owner_id FROM projects WHERE id = $1', [req.params.id]);
    const project = pRes.rows[0];
    if (!project) throw ApiError.notFound();
    if (project.owner_id !== req.user.id) throw ApiError.forbidden('Seul le propriétaire du projet peut valider une revue.');

    const rRes = await query('SELECT id, author_id, validated_by_owner FROM project_reviews WHERE id = $1 AND project_id = $2', [req.params.reviewId, project.id]);
    const review = rRes.rows[0];
    if (!review) throw ApiError.notFound();

    if (!review.validated_by_owner) {
      await query('UPDATE project_reviews SET validated_by_owner = true WHERE id = $1', [review.id]);
      await points.award(review.author_id, `Revue validée sur « ${project.title} »`, 10);

      // 3 revues validées (tous projets confondus) -> badge b6, cf. mock : filtre global, pas par projet.
      const countRes = await query('SELECT count(*) FROM project_reviews WHERE author_id = $1 AND validated_by_owner = true', [review.author_id]);
      if (Number(countRes.rows[0].count) >= 3) await points.giveBadge(review.author_id, 'b6');
    }
    res.status(204).end();
  })
);

// --- POST /projets/:id/collaborations -------------------------------------------------
const collabSchema = z.object({
  role: z.string().trim().min(1, 'Indiquez un rôle.'),
  message: z.string().trim().min(10, 'Indiquez un rôle et un message d’au moins 10 caractères.'),
});

router.post(
  '/:id/collaborations',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(collabSchema, req.body);
    const pRes = await query('SELECT id, title, owner_id FROM projects WHERE id = $1', [req.params.id]);
    const project = pRes.rows[0];
    if (!project) throw ApiError.notFound();
    if (project.owner_id === req.user.id) throw ApiError.forbidden('C’est votre propre projet.');

    try {
      await query('INSERT INTO collab_requests (project_id, from_id, role, message) VALUES ($1, $2, $3, $4)', [project.id, req.user.id, data.role, data.message]);
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Vous avez déjà une demande en attente sur ce projet.');
      throw err;
    }
    await notify(project.owner_id, 'collaboration', `${req.user.name} propose de rejoindre « ${project.title} » comme ${data.role}.`, `/projets/${project.id}`);
    res.status(204).end();
  })
);

// --- POST /projets/:id/collaborations/:requestId ---------------------------------------
const answerCollabSchema = z.object({ accept: z.boolean() });

router.post(
  '/:id/collaborations/:requestId',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(answerCollabSchema, req.body);
    const pRes = await query('SELECT id, title, owner_id FROM projects WHERE id = $1', [req.params.id]);
    const project = pRes.rows[0];
    if (!project) throw ApiError.notFound();
    if (project.owner_id !== req.user.id) throw ApiError.forbidden();

    const cRes = await query('SELECT id, from_id FROM collab_requests WHERE id = $1 AND project_id = $2', [req.params.requestId, project.id]);
    const collab = cRes.rows[0];
    if (!collab) throw ApiError.notFound();

    const newStatus = data.accept ? 'acceptee' : 'refusee';
    await query('UPDATE collab_requests SET status = $1 WHERE id = $2', [newStatus, collab.id]);
    await notify(collab.from_id, 'collaboration', `${req.user.name} a ${data.accept ? 'accepté' : 'refusé'} votre demande sur « ${project.title} ».`, `/projets/${project.id}`);
    res.status(204).end();
  })
);

module.exports = router;
