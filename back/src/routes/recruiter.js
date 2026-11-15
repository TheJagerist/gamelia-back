// Espace recruteur : défis recruteurs, candidatures, recherche de talents, contact.
// Règles reprises de lib/mock/server.ts (recruiter.* et opportunities.*).
// requireRole('recruteur') bloque déjà un recruteur non 'valide' (403
// recruteur_non_valide), donc toutes les routes de ce fichier supposent un
// recruteur validé par un admin.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { userCols, toPublicUser } = require('../utils/publicUser');
const { startConversation, assertCanWrite, withTransaction } = require('./messages');
const { notifyUser, notifyAdmins } = require('../services/notifier');
const mails = require('../services/mail-templates');

const router = express.Router();
const PAGE_SIZE = 8;

const notify = notifyUser; // notification dans le site + e-mail éventuel (services/notifier.js)

/** Le recruteur connecté, au format PublicUser (champ `recruiter` de RecruiterChallenge). */
async function selfPublic(userId) {
  const { rows } = await query(`SELECT ${userCols('u', '')} FROM users u WHERE u.id = $1`, [userId]);
  return toPublicUser(rows[0]);
}

async function skillsFor(challengeId) {
  const { rows } = await query('SELECT skill FROM recruiter_challenge_skills WHERE challenge_id = $1', [challengeId]);
  return rows.map((r) => r.skill);
}

router.use(requireRole('recruteur'));

// --- GET /recruteur/defis (les siens, tous statuts) --------------------------------
router.get(
  '/defis',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, title, summary, brief, country, remote, deadline, reward, status, created_at,
              (SELECT count(*) FROM applications a WHERE a.challenge_id = recruiter_challenges.id) AS application_count
       FROM recruiter_challenges WHERE recruiter_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    const recruiter = await selfPublic(req.user.id);
    const items = await Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        title: c.title,
        company: req.user.company || '',
        recruiter,
        summary: c.summary,
        brief: c.brief,
        skills: await skillsFor(c.id),
        country: c.country,
        remote: c.remote,
        deadline: c.deadline,
        reward: c.reward,
        status: c.status,
        applicationCount: Number(c.application_count),
      }))
    );
    res.json(items);
  })
);

// --- GET /recruteur/defis/:id (avec candidatures) -----------------------------------
router.get(
  '/defis/:id',
  asyncHandler(async (req, res) => {
    const cRes = await query('SELECT * FROM recruiter_challenges WHERE id = $1', [req.params.id]);
    const challenge = cRes.rows[0];
    if (!challenge) throw ApiError.notFound();
    if (challenge.recruiter_id !== req.user.id) throw ApiError.forbidden();

    const appsRes = await query(
      `SELECT a.id, a.code_url, a.demo_url, a.message, a.created_at, a.status, a.score, a.feedback, a.proposal,
              ${userCols('u', 'dev_')}
       FROM applications a JOIN users u ON u.id = a.dev_id
       WHERE a.challenge_id = $1 ORDER BY a.created_at DESC`,
      [challenge.id]
    );

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        company: req.user.company || '',
        recruiter: await selfPublic(req.user.id),
        summary: challenge.summary,
        brief: challenge.brief,
        skills: await skillsFor(challenge.id),
        country: challenge.country,
        remote: challenge.remote,
        deadline: challenge.deadline,
        reward: challenge.reward,
        status: challenge.status,
        applicationCount: appsRes.rows.length,
      },
      applications: appsRes.rows.map((a) => ({
        id: a.id,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        dev: toPublicUser(a, 'dev_'),
        codeUrl: a.code_url,
        demoUrl: a.demo_url,
        message: a.message,
        createdAt: a.created_at,
        status: a.status,
        score: a.score,
        feedback: a.feedback,
        proposal: a.proposal,
      })),
    });
  })
);

// --- GET /recruteur/candidatures (toutes, sur tous ses défis) -----------------------
const appsQuerySchema = z.object({
  status: z.enum(['recue', 'evaluee', 'retenue', 'non_retenue']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

router.get(
  '/candidatures',
  asyncHandler(async (req, res) => {
    const opts = validate(appsQuerySchema, req.query);
    const where = ['c.recruiter_id = $1'];
    const params = [req.user.id];
    if (opts.status) {
      params.push(opts.status);
      where.push(`a.status = $${params.length}`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countRes = await query(`SELECT count(*) FROM applications a JOIN recruiter_challenges c ON c.id = a.challenge_id ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `SELECT a.id, a.code_url, a.demo_url, a.message, a.created_at, a.status, a.score, a.feedback, a.proposal,
              c.id AS challenge_id, c.title AS challenge_title,
              ${userCols('u', 'dev_')}
       FROM applications a JOIN recruiter_challenges c ON c.id = a.challenge_id JOIN users u ON u.id = a.dev_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = rows.map((a) => ({
      id: a.id,
      challengeId: a.challenge_id,
      challengeTitle: a.challenge_title,
      dev: toPublicUser(a, 'dev_'),
      codeUrl: a.code_url,
      demoUrl: a.demo_url,
      message: a.message,
      createdAt: a.created_at,
      status: a.status,
      score: a.score,
      feedback: a.feedback,
      proposal: a.proposal,
    }));
    res.json({ items, page, pageCount, total });
  })
);

// --- POST /recruteur/defis ------------------------------------------------------------
const createChallengeSchema = z.object({
  title: z.string().trim().min(8, 'Au moins 8 caractères.').max(160, '160 caractères au maximum.'),
  summary: z.string().trim().min(15, 'Résumez le défi en une phrase.').max(200, '200 caractères au maximum.'),
  brief: z.string().trim().min(50, 'Décrivez le travail attendu (au moins 50 caractères).').max(10000, 'L’énoncé est trop long (10 000 caractères au maximum).'),
  skills: z.array(z.string().trim().min(1).max(40)).min(1, 'Choisissez au moins une compétence.').max(12, 'Douze compétences au maximum.'),
  country: z.string().trim().min(1).max(60),
  remote: z.boolean().default(true),
  deadline: z.string().refine((d) => !Number.isNaN(Date.parse(d)) && Date.parse(d) > Date.now(), { message: 'Choisissez une date future.' }),
  reward: z.string().trim().max(200, '200 caractères au maximum.').optional().default(''),
});

router.post(
  '/defis',
  asyncHandler(async (req, res) => {
    const data = validate(createChallengeSchema, req.body);
    const reward = data.reward.trim() || 'À discuter';

    const insertRes = await query(
      `INSERT INTO recruiter_challenges (recruiter_id, title, summary, brief, country, remote, deadline, reward, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'en_attente') RETURNING id`,
      [req.user.id, data.title, data.summary, data.brief, data.country, data.remote, new Date(data.deadline).toISOString(), reward]
    );
    const challengeId = insertRes.rows[0].id;
    for (const skill of data.skills) {
      await query('INSERT INTO recruiter_challenge_skills (challenge_id, skill) VALUES ($1, $2)', [challengeId, skill]);
    }

    await notifyAdmins('validation', `Nouveau défi recruteur à valider : ${data.title}.`, '/admin/validations', ({ name }) =>
      mails.adminToValidate({ name, text: `Un recruteur (${req.user.company || req.user.name}) a soumis un nouveau défi à valider : ${data.title}.`, path: '/admin/validations' })
    );

    res.status(201).json({ id: challengeId });
  })
);

// --- POST /recruteur/candidatures/:id/evaluation --------------------------------------
const evaluateSchema = z.object({
  score: z.number().int().min(1, 'Donnez une note de 1 à 5.').max(5, 'Donnez une note de 1 à 5.'),
  feedback: z.string().trim().max(5000, 'Le retour est trop long (5 000 caractères au maximum).').optional().default(''),
});

router.post(
  '/candidatures/:id/evaluation',
  asyncHandler(async (req, res) => {
    const data = validate(evaluateSchema, req.body);
    const aRes = await query(
      `SELECT a.id, a.dev_id, a.status, c.recruiter_id, c.title AS challenge_title
       FROM applications a JOIN recruiter_challenges c ON c.id = a.challenge_id WHERE a.id = $1`,
      [req.params.id]
    );
    const app = aRes.rows[0];
    if (!app) throw ApiError.notFound();
    if (app.recruiter_id !== req.user.id) throw ApiError.forbidden();

    const newStatus = app.status === 'recue' ? 'evaluee' : app.status;
    await query('UPDATE applications SET score = $1, feedback = $2, status = $3 WHERE id = $4', [data.score, data.feedback, newStatus, app.id]);
    await notify(app.dev_id, 'candidature', `Votre candidature sur « ${app.challenge_title} » a été évaluée.`, `/opportunites/${req.params.id}`, ({ name }) =>
      mails.applicationEvaluated({ name, challengeTitle: app.challenge_title, path: `/opportunites/${req.params.id}` })
    );
    res.status(204).end();
  })
);

// --- POST /recruteur/candidatures/:id/decision -----------------------------------------
const decideSchema = z
  .object({
    retained: z.boolean(),
    proposal: z.string().trim().max(5000, 'La proposition est trop longue (5 000 caractères au maximum).').optional(),
  })
  .refine((d) => !d.retained || (d.proposal && d.proposal.length >= 20), {
    message: 'Rédigez une proposition de collaboration (au moins 20 caractères).',
    path: ['proposal'],
  });

router.post(
  '/candidatures/:id/decision',
  asyncHandler(async (req, res) => {
    const data = validate(decideSchema, req.body);
    const aRes = await query(
      `SELECT a.id, a.dev_id, c.recruiter_id, c.title AS challenge_title
       FROM applications a JOIN recruiter_challenges c ON c.id = a.challenge_id WHERE a.id = $1`,
      [req.params.id]
    );
    const app = aRes.rows[0];
    if (!app) throw ApiError.notFound();
    if (app.recruiter_id !== req.user.id) throw ApiError.forbidden();

    const newStatus = data.retained ? 'retenue' : 'non_retenue';
    await query('UPDATE applications SET status = $1, proposal = $2 WHERE id = $3', [newStatus, data.retained ? data.proposal.trim() : null, app.id]);
    await notify(
      app.dev_id,
      'candidature',
      data.retained
        ? `${req.user.company} vous propose une collaboration après « ${app.challenge_title} ».`
        : `Votre candidature sur « ${app.challenge_title} » n'a pas été retenue.`,
      `/opportunites/${req.params.id}`,
      ({ name }) =>
        data.retained
          ? mails.applicationRetained({ name, company: req.user.company || req.user.name, challengeTitle: app.challenge_title, path: `/opportunites/${req.params.id}` })
          : mails.applicationNotRetained({ name, challengeTitle: app.challenge_title, path: `/opportunites/${req.params.id}` })
    );
    res.status(204).end();
  })
);

// --- POST /recruteur/defis/:id/cloturer --------------------------------------------------
router.post(
  '/defis/:id/cloturer',
  asyncHandler(async (req, res) => {
    const cRes = await query('SELECT id, recruiter_id FROM recruiter_challenges WHERE id = $1', [req.params.id]);
    const challenge = cRes.rows[0];
    if (!challenge || challenge.recruiter_id !== req.user.id) throw ApiError.notFound();
    await query("UPDATE recruiter_challenges SET status = 'cloture' WHERE id = $1", [challenge.id]);
    res.status(204).end();
  })
);

// --- GET /recruteur/talents ------------------------------------------------------------
const talentsQuerySchema = z.object({
  skill: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  level: z.enum(['Débutant', 'Intermédiaire', 'Confirmé']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

router.get(
  '/talents',
  asyncHandler(async (req, res) => {
    const opts = validate(talentsQuerySchema, req.query);
    const where = [`u.role = 'developpeur'`, `COALESCE(s.privacy_visible_recruteurs, true) = true`];
    const params = [];
    if (opts.skill) {
      params.push(opts.skill);
      where.push(`$${params.length} = ANY(u.skills)`);
    }
    if (opts.country) {
      params.push(opts.country);
      where.push(`u.country = $${params.length}`);
    }
    if (opts.level) {
      params.push(opts.level);
      where.push(`u.level = $${params.length}`);
    }
    if (opts.q) {
      params.push(`%${opts.q}%`);
      where.push(`(u.name ILIKE $${params.length} OR u.bio ILIKE $${params.length})`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countRes = await query(`SELECT count(*) FROM users u LEFT JOIN user_settings s ON s.user_id = u.id ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `SELECT ${userCols('u', '')},
              (SELECT count(*) FROM user_challenge_status ucs WHERE ucs.user_id = u.id AND ucs.status = 'reussi') AS verified_count
       FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
       ${whereClause}
       ORDER BY u.points DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = rows.map((u) => ({ ...toPublicUser(u), verifiedCount: Number(u.verified_count) }));
    res.json({ items, page, pageCount, total });
  })
);

// --- POST /recruteur/contacts -----------------------------------------------------------
const contactSchema = z.object({
  username: z.string().trim().min(1),
  message: z
    .string()
    .trim()
    .min(20, 'Votre message doit faire au moins 20 caractères.')
    .max(1000, 'Votre message doit faire au plus 1000 caractères.'),
});

router.post(
  '/contacts',
  asyncHandler(async (req, res) => {
    const data = validate(contactSchema, req.body);
    const uRes = await query('SELECT id, role FROM users WHERE username = $1', [data.username]);
    const target = uRes.rows[0];
    if (!target || target.role !== 'developpeur') throw ApiError.notFound();

    // Le contact ouvre (ou complète) la conversation privée : le développeur peut répondre dans « Messages ».
    const conversationId = await withTransaction(async (client) => {
      await assertCanWrite(client, req.user.id, target.id);
      return startConversation(client, req.user.id, target.id, data.message);
    });
    const preview = data.message.length > 80 ? `${data.message.slice(0, 80)}…` : data.message;
    await notify(target.id, 'candidature', `${req.user.name} (${req.user.company}) souhaite vous contacter : « ${preview} »`, `/messages?c=${conversationId}`, ({ name }) =>
      mails.recruiterContact({ name, from: req.user.name, company: req.user.company || req.user.name, path: `/messages?c=${conversationId}` })
    );
    res.status(204).end();
  })
);

module.exports = router;
