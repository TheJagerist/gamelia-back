// Côté développeur : voir les défis recruteurs publiés et y candidater.
// Règles reprises de lib/mock/server.ts (opportunities.*).
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { userCols, toPublicUser } = require('../utils/publicUser');

const router = express.Router();
const PAGE_SIZE = 6;

const ALLOWED_VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'm.youtube.com', 'vimeo.com', 'player.vimeo.com'];
function isAllowedVideo(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return ALLOWED_VIDEO_HOSTS.includes(host);
  } catch {
    return false;
  }
}

async function skillsFor(challengeId) {
  const { rows } = await query('SELECT skill FROM recruiter_challenge_skills WHERE challenge_id = $1', [challengeId]);
  return rows.map((r) => r.skill);
}

async function myApplication(challengeId, devId) {
  if (!devId) return undefined;
  const { rows } = await query(
    `SELECT a.*, c.title AS challenge_title FROM applications a JOIN recruiter_challenges c ON c.id = a.challenge_id
     WHERE a.challenge_id = $1 AND a.dev_id = $2`,
    [challengeId, devId]
  );
  const a = rows[0];
  if (!a) return undefined;
  return {
    id: a.id,
    challengeId: a.challenge_id,
    challengeTitle: a.challenge_title,
    codeUrl: a.code_url,
    demoUrl: a.demo_url,
    message: a.message,
    createdAt: a.created_at,
    status: a.status,
    score: a.score,
    feedback: a.feedback,
    proposal: a.proposal,
  };
}

router.use(requireRole('developpeur'));

// --- GET /defis-recruteurs ----------------------------------------------------------
const listQuerySchema = z.object({
  skill: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(listQuerySchema, req.query);
    const where = [`c.status = 'publie'`];
    const params = [];
    if (opts.skill) {
      params.push(opts.skill);
      where.push(`c.id IN (SELECT challenge_id FROM recruiter_challenge_skills WHERE skill = $${params.length})`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countRes = await query(`SELECT count(*) FROM recruiter_challenges c ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `SELECT c.id, c.title, c.summary, c.brief, c.country, c.remote, c.deadline, c.reward, c.status, c.created_at,
              u.company,
              ${userCols('u', 'rec_')},
              (SELECT count(*) FROM applications a WHERE a.challenge_id = c.id) AS application_count
       FROM recruiter_challenges c JOIN users u ON u.id = c.recruiter_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = await Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        title: c.title,
        company: c.company || '',
        recruiter: toPublicUser(c, 'rec_'),
        summary: c.summary,
        brief: c.brief,
        skills: await skillsFor(c.id),
        country: c.country,
        remote: c.remote,
        deadline: c.deadline,
        reward: c.reward,
        status: c.status,
        applicationCount: Number(c.application_count),
        myApplication: await myApplication(c.id, req.user.id),
      }))
    );
    res.json({ items, page, pageCount, total });
  })
);

// --- GET /defis-recruteurs/:id --------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cRes = await query(
      `SELECT c.id, c.title, c.summary, c.brief, c.country, c.remote, c.deadline, c.reward, c.status, c.created_at,
              u.company,
              ${userCols('u', 'rec_')}
       FROM recruiter_challenges c JOIN users u ON u.id = c.recruiter_id
       WHERE c.id = $1 AND c.status != 'en_attente'`,
      [req.params.id]
    );
    const c = cRes.rows[0];
    if (!c) throw ApiError.notFound();

    const countRes = await query('SELECT count(*) FROM applications WHERE challenge_id = $1', [c.id]);

    res.json({
      id: c.id,
      title: c.title,
      company: c.company || '',
      recruiter: toPublicUser(c, 'rec_'),
      summary: c.summary,
      brief: c.brief,
      skills: await skillsFor(c.id),
      country: c.country,
      remote: c.remote,
      deadline: c.deadline,
      reward: c.reward,
      status: c.status,
      applicationCount: Number(countRes.rows[0].count),
      myApplication: await myApplication(c.id, req.user.id),
    });
  })
);

// --- POST /defis-recruteurs/:id/candidatures --------------------------------------------
const applySchema = z.object({
  codeUrl: z.string().trim().max(500, 'Ce lien est trop long.').refine((u) => /^https:\/\//.test(u), { message: 'Indiquez un lien https vers le code.' }),
  // Accepté si https:// OU vidéo YouTube/Vimeo (cf. mock : isAllowedVideo || /^https/). Validé dans le schéma
  // pour que le formulaire reçoive toutes ses erreurs d'un coup.
  demoUrl: z
    .string()
    .trim()
    .max(500, 'Ce lien est trop long.')
    .optional()
    .refine((u) => !u || isAllowedVideo(u) || /^https:\/\//.test(u), { message: 'Lien de démo invalide.' }),
  message: z.string().trim().min(20, 'Présentez votre solution en au moins 20 caractères.').max(5000, 'Le message est trop long (5 000 caractères au maximum).'),
});

router.post(
  '/:id/candidatures',
  asyncHandler(async (req, res) => {
    const data = validate(applySchema, req.body);

    const cRes = await query("SELECT id, title, recruiter_id FROM recruiter_challenges WHERE id = $1 AND status = 'publie'", [req.params.id]);
    const challenge = cRes.rows[0];
    if (!challenge) throw ApiError.notFound();

    try {
      await query(
        'INSERT INTO applications (challenge_id, dev_id, code_url, demo_url, message) VALUES ($1,$2,$3,$4,$5)',
        [challenge.id, req.user.id, data.codeUrl, data.demoUrl || null, data.message]
      );
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Vous avez déjà candidaté à ce défi.');
      throw err;
    }

    const column = 'notify_candidatures';
    const settingsRes = await query(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = $1`, [challenge.recruiter_id]);
    if (!settingsRes.rows.length || settingsRes.rows[0].enabled !== false) {
      await query('INSERT INTO notifications (user_id, kind, text, href) VALUES ($1, $2, $3, $4)', [
        challenge.recruiter_id,
        'candidature',
        `Nouvelle candidature de ${req.user.name} sur « ${challenge.title} ».`,
        `/recruteur/defis/${challenge.id}`,
      ]);
    }

    res.status(204).end();
  })
);

module.exports = router;
