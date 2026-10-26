// Défis techniques : quiz auto-corrigés et défis pratiques soumis à validation admin.
// Règles reprises de lib/mock/server.ts (challenges.*) : seuil de réussite 75% pour
// les quiz, badge b4 pour tout premier défi réussi, URL de dépôt restreinte à
// github/gitlab/bitbucket pour les soumissions pratiques.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const points = require('../services/points');

const router = express.Router();
const PAGE_SIZE = 6;
const REPO_URL_RE = /^https:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\//;

async function tagsFor(challengeId) {
  const { rows } = await query('SELECT tag FROM challenge_tags WHERE challenge_id = $1', [challengeId]);
  return rows.map((r) => r.tag);
}

async function statusFor(userId, challengeId) {
  if (!userId) return 'a_faire';
  const { rows } = await query('SELECT status FROM user_challenge_status WHERE user_id = $1 AND challenge_id = $2', [userId, challengeId]);
  return rows[0]?.status || 'a_faire';
}

// --- GET /defis --------------------------------------------------------------
const listQuerySchema = z.object({
  kind: z.enum(['quiz', 'pratique']).optional(),
  level: z.enum(['Débutant', 'Intermédiaire', 'Confirmé']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(listQuerySchema, req.query);
    const where = [];
    const params = [];
    if (opts.kind) {
      params.push(opts.kind);
      where.push(`kind = $${params.length}`);
    }
    if (opts.level) {
      params.push(opts.level);
      where.push(`level = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) FROM challenges ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    // weekly en premier, cf. mock : "list.sort((a, b) => Number(!!b.weekly) - Number(!!a.weekly))".
    const { rows } = await query(
      `SELECT id, title, kind, level, points, summary, brief, weekly
       FROM challenges ${whereClause}
       ORDER BY weekly DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = [];
    for (const c of rows) {
      items.push({
        id: c.id,
        title: c.title,
        kind: c.kind,
        level: c.level,
        tags: await tagsFor(c.id),
        points: c.points,
        summary: c.summary,
        brief: c.brief,
        status: await statusFor(req.user?.id, c.id),
        weekly: c.weekly,
      });
    }
    res.json({ items, page, pageCount, total });
  })
);

// --- GET /defis/:id -----------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cRes = await query('SELECT id, title, kind, level, points, summary, brief, weekly FROM challenges WHERE id = $1', [req.params.id]);
    const c = cRes.rows[0];
    if (!c) throw ApiError.notFound();

    let quiz;
    if (c.kind === 'quiz') {
      const quizRes = await query('SELECT id, prompt, options FROM challenge_quiz_questions WHERE challenge_id = $1 ORDER BY position', [c.id]);
      quiz = quizRes.rows; // pas de correct_index, cf. mock
    }

    res.json({
      id: c.id,
      title: c.title,
      kind: c.kind,
      level: c.level,
      tags: await tagsFor(c.id),
      points: c.points,
      summary: c.summary,
      brief: c.brief,
      quiz,
      status: await statusFor(req.user?.id, c.id),
      weekly: c.weekly,
    });
  })
);

// --- POST /defis/:id/quiz -----------------------------------------------------
const quizSubmitSchema = z.object({ answers: z.array(z.number().int()) });

router.post(
  '/:id/quiz',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(quizSubmitSchema, req.body);
    const cRes = await query('SELECT id, title, kind, points FROM challenges WHERE id = $1', [req.params.id]);
    const challenge = cRes.rows[0];
    if (!challenge || challenge.kind !== 'quiz') throw ApiError.notFound();

    const quizRes = await query(
      'SELECT id, correct_index, explanation FROM challenge_quiz_questions WHERE challenge_id = $1 ORDER BY position',
      [challenge.id]
    );
    const questions = quizRes.rows;

    const corrections = questions.map((q, i) => ({
      questionId: q.id,
      chosen: data.answers[i],
      answer: q.correct_index,
      correct: data.answers[i] === q.correct_index,
      explanation: q.explanation,
    }));
    const score = corrections.filter((c) => c.correct).length;
    const passed = questions.length > 0 && score / questions.length >= 0.75; // seuil mock : >= 75%

    const currentStatus = await statusFor(req.user.id, challenge.id);
    let pointsEarned = 0;
    let badge;

    if (passed && currentStatus !== 'reussi') {
      await query(
        `INSERT INTO user_challenge_status (user_id, challenge_id, status) VALUES ($1, $2, 'reussi')
         ON CONFLICT (user_id, challenge_id) DO UPDATE SET status = 'reussi', updated_at = now()`,
        [req.user.id, challenge.id]
      );
      const result = await points.award(req.user.id, `Défi réussi : ${challenge.title}`, challenge.points);
      pointsEarned = result.awarded;
      const firstTime = await points.giveBadge(req.user.id, 'b4');
      if (firstTime) {
        const bRes = await query('SELECT * FROM badges WHERE id = $1', ['b4']);
        badge = { id: bRes.rows[0].id, name: bRes.rows[0].name, description: bRes.rows[0].description, glyph: bRes.rows[0].glyph };
      }
    } else if (!passed && currentStatus !== 'reussi') {
      await query(
        `INSERT INTO user_challenge_status (user_id, challenge_id, status) VALUES ($1, $2, 'echoue')
         ON CONFLICT (user_id, challenge_id) DO UPDATE SET status = 'echoue', updated_at = now()`,
        [req.user.id, challenge.id]
      );
    }

    res.json({ score, total: questions.length, passed, pointsEarned, corrections, badge });
  })
);

// --- POST /defis/:id/solutions (défi pratique) --------------------------------
const submitPracticalSchema = z.object({
  codeUrl: z.string().refine((url) => REPO_URL_RE.test(url), {
    message: 'Indiquez un lien vers un dépôt GitHub, GitLab ou Bitbucket.',
  }),
  note: z.string().trim().optional().default(''),
});

router.post(
  '/:id/solutions',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(submitPracticalSchema, req.body);
    const cRes = await query("SELECT id FROM challenges WHERE id = $1 AND kind = 'pratique'", [req.params.id]);
    if (!cRes.rows[0]) throw ApiError.notFound();

    try {
      await query(
        `INSERT INTO practical_submissions (challenge_id, dev_id, code_url, note, status)
         VALUES ($1, $2, $3, $4, 'en_attente')`,
        [req.params.id, req.user.id, data.codeUrl, data.note]
      );
    } catch (err) {
      // uq_submission_pending (index unique partiel) : une soumission en_attente existe déjà.
      if (err.code === '23505') throw ApiError.conflict('Votre solution est déjà en attente de validation.');
      throw err;
    }

    await query(
      `INSERT INTO user_challenge_status (user_id, challenge_id, status) VALUES ($1, $2, 'en_attente')
       ON CONFLICT (user_id, challenge_id) DO UPDATE SET status = 'en_attente', updated_at = now()`,
      [req.user.id, req.params.id]
    );

    res.status(204).end();
  })
);

module.exports = router;
