// Questions / réponses / commentaires / votes / meilleure réponse.
// PAGE_SIZE=6 et toutes les règles de points proviennent de lib/mock/server.ts
// (le front a déjà cette logique en mémoire locale ; on la reproduit fidèlement).
const express = require('express');
const { z } = require('zod');
const { query, pool } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser, requireRole } = require('../middleware/auth');
const points = require('../services/points');
const { userCols, toPublicUser } = require('../utils/publicUser');
const { mapQuestionSummary } = require('../services/summaries');

const router = express.Router();
const PAGE_SIZE = 6;

async function notify(userId, kind, text, href) {
  // Respecte le paramètre de notification de l'utilisateur, comme le mock
  // (notify() y vérifie settings.notify.<kind> avant d'insérer).
  const column = { reponse: 'notify_reponses', commentaire: 'notify_commentaires', badge: 'notify_badges', candidature: 'notify_candidatures' }[kind];
  if (column) {
    const { rows } = await query(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = $1`, [userId]);
    if (rows.length && rows[0].enabled === false) return;
  }
  await query('INSERT INTO notifications (user_id, kind, text, href) VALUES ($1, $2, $3, $4)', [userId, kind, text, href]);
}

// --- GET /questions -----------------------------------------------------------
const listQuerySchema = z.object({
  tag: z.string().trim().min(1).optional(),
  sort: z.enum(['recentes', 'sans-reponse', 'votes']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  q: z.string().trim().min(1).max(100).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(listQuerySchema, req.query);

    const where = [];
    const params = [];
    if (opts.tag) {
      params.push(opts.tag);
      where.push(`q.id IN (SELECT question_id FROM question_tags WHERE tag = $${params.length})`);
    }
    if (opts.q) {
      params.push(`%${opts.q}%`);
      where.push(`(q.title ILIKE $${params.length} OR q.body ILIKE $${params.length})`);
    }
    if (opts.sort === 'sans-reponse') {
      where.push(`NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id)`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = opts.sort === 'votes' ? 'q.votes DESC' : 'q.created_at DESC';

    const countRes = await query(`SELECT count(*) FROM questions q ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `SELECT q.id, q.title, q.body, q.votes, q.created_at, q.best_answer_id,
              ${userCols('u', 'author_')},
              COALESCE(array_agg(qt.tag) FILTER (WHERE qt.tag IS NOT NULL), '{}') AS tags,
              (SELECT count(*) FROM answers a WHERE a.question_id = q.id) AS answer_count
       FROM questions q
       JOIN users u ON u.id = q.author_id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       ${whereClause}
       GROUP BY q.id, u.id
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = rows.map(mapQuestionSummary);

    res.json({ items, page, pageCount, total });
  })
);

// --- GET /questions/:id ---------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const qRes = await query(
      `SELECT q.id, q.title, q.body, q.code_lang, q.code_content, q.votes, q.created_at, q.best_answer_id,
              ${userCols('u', 'author_')}
       FROM questions q JOIN users u ON u.id = q.author_id
       WHERE q.id = $1`,
      [req.params.id]
    );
    const q = qRes.rows[0];
    if (!q) throw ApiError.notFound();

    const tagsRes = await query('SELECT tag FROM question_tags WHERE question_id = $1', [q.id]);

    // Tri : meilleure réponse d'abord, puis par votes décroissants (cf. mock/server.ts .sort()).
    const answersRes = await query(
      `SELECT a.id, a.body, a.code_lang, a.code_content, a.votes, a.created_at,
              ${userCols('u', 'author_')},
              (a.id = $2) AS is_best
       FROM answers a JOIN users u ON u.id = a.author_id
       WHERE a.question_id = $1
       ORDER BY is_best DESC, a.votes DESC, a.created_at ASC`,
      [q.id, q.best_answer_id]
    );

    const answerIds = answersRes.rows.map((a) => a.id);
    const commentsByAnswer = new Map(answerIds.map((id) => [id, []]));
    if (answerIds.length) {
      const commentsRes = await query(
        `SELECT c.answer_id, c.id, c.body, c.created_at,
                ${userCols('u', 'author_')}
         FROM answer_comments c JOIN users u ON u.id = c.author_id
         WHERE c.answer_id = ANY($1)
         ORDER BY c.created_at ASC`,
        [answerIds]
      );
      for (const c of commentsRes.rows) {
        commentsByAnswer.get(c.answer_id).push({
          id: c.id,
          author: toPublicUser(c, 'author_'),
          body: c.body,
          createdAt: c.created_at,
        });
      }
    }

    let myVote = 0;
    const voteTargetIds = [q.id, ...answerIds];
    if (req.user) {
      const votesRes = await query('SELECT target_id, direction FROM votes WHERE user_id = $1 AND target_id = ANY($2)', [req.user.id, voteTargetIds]);
      const myVotes = new Map(votesRes.rows.map((v) => [v.target_id, v.direction]));
      myVote = myVotes.get(q.id) || 0;
      for (const a of answersRes.rows) a.my_vote = myVotes.get(a.id) || 0;
    } else {
      for (const a of answersRes.rows) a.my_vote = 0;
    }

    res.json({
      id: q.id,
      title: q.title,
      excerpt: q.body.slice(0, 160),
      tags: tagsRes.rows.map((t) => t.tag),
      author: toPublicUser(q, 'author_'),
      createdAt: q.created_at,
      votes: q.votes,
      answerCount: answersRes.rows.length,
      hasBestAnswer: !!q.best_answer_id,
      body: q.body,
      code: q.code_lang ? { lang: q.code_lang, content: q.code_content } : undefined,
      myVote,
      bestAnswerId: q.best_answer_id,
      answers: answersRes.rows.map((a) => ({
        id: a.id,
        author: toPublicUser(a, 'author_'),
        body: a.body,
        code: a.code_lang ? { lang: a.code_lang, content: a.code_content } : undefined,
        createdAt: a.created_at,
        votes: a.votes,
        myVote: a.my_vote,
        comments: commentsByAnswer.get(a.id),
      })),
    });
  })
);

const codeSchema = z.object({
  lang: z.string().trim().max(20, 'Langage inconnu.'),
  content: z.string().max(20000, 'Le code est trop long (20 000 caractères au maximum).'),
});

// --- POST /questions -------------------------------------------------------------
const createQuestionSchema = z.object({
  title: z.string().trim().min(10, 'Le titre doit faire au moins 10 caractères.').max(200, 'Le titre ne doit pas dépasser 200 caractères.'),
  body: z.string().trim().min(20, 'Décrivez votre problème en au moins 20 caractères.').max(10000, 'La description est trop longue (10 000 caractères au maximum).'),
  tags: z.array(z.string().trim().min(1).max(40)).min(1, 'Choisissez au moins un tag.').max(8, 'Huit tags au maximum.'),
  code: codeSchema.optional(),
});

router.post(
  '/',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(createQuestionSchema, req.body);
    const tags = data.tags.slice(0, 4); // cf. mock : "input.tags.slice(0, 4)"
    const hasCode = data.code && data.code.content.trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const qRes = await client.query(
        `INSERT INTO questions (title, body, code_lang, code_content, author_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [data.title, data.body, hasCode ? data.code.lang : null, hasCode ? data.code.content.trim() : null, req.user.id]
      );
      const questionId = qRes.rows[0].id;
      for (const tag of tags) {
        await client.query('INSERT INTO question_tags (question_id, tag) VALUES ($1, $2)', [questionId, tag]);
      }
      await client.query('COMMIT');
      res.status(201).json({ id: questionId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// --- POST /questions/:id/reponses -------------------------------------------------
const answerSchema = z.object({
  body: z.string().trim().min(10, 'Votre réponse doit faire au moins 10 caractères.').max(10000, 'La réponse est trop longue (10 000 caractères au maximum).'),
  code: codeSchema.optional(),
});

router.post(
  '/:id/reponses',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(answerSchema, req.body);
    const qRes = await query('SELECT id, title, author_id FROM questions WHERE id = $1', [req.params.id]);
    const question = qRes.rows[0];
    if (!question) throw ApiError.notFound();

    const hasCode = data.code && data.code.content.trim();
    const insertRes = await query(
      `INSERT INTO answers (question_id, author_id, body, code_lang, code_content)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [question.id, req.user.id, data.body, hasCode ? data.code.lang : null, hasCode ? data.code.content.trim() : null]
    );
    const answerId = insertRes.rows[0].id;

    // Pas de points si on répond à sa propre question (cf. mock : "q.authorId === u.id ? 0 : award(...)").
    let awarded = 0;
    if (question.author_id !== req.user.id) {
      const result = await points.award(req.user.id, `Réponse à « ${question.title} »`, 10);
      awarded = result.awarded;
      await notify(question.author_id, 'reponse', `${req.user.name} a répondu à « ${question.title} »`, `/questions/${question.id}`);
    }
    await points.giveBadge(req.user.id, 'b1');

    res.status(201).json({ points: awarded, answerId });
  })
);

// --- POST /reponses/:answerId/commentaires -----------------------------------------
// Monté séparément dans server.js sous /reponses, pas sous /questions (chemin différent
// du contrat : la route n'est pas imbriquée sous l'id de question).
const commentSchema = z.object({ body: z.string().trim().min(2, 'Le commentaire est vide.') }); // tronqué à 500 caractères plus bas

const commentsRouter = express.Router();
commentsRouter.post(
  '/:answerId/commentaires',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(commentSchema, req.body);
    const aRes = await query(
      `SELECT a.id, a.author_id, q.id AS question_id FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = $1`,
      [req.params.answerId]
    );
    const answer = aRes.rows[0];
    if (!answer) throw ApiError.notFound();

    const body = data.body.slice(0, 500); // tronqué comme le mock
    await query('INSERT INTO answer_comments (answer_id, author_id, body) VALUES ($1, $2, $3)', [answer.id, req.user.id, body]);
    if (answer.author_id !== req.user.id) {
      await notify(answer.author_id, 'commentaire', `${req.user.name} a commenté votre réponse.`, `/questions/${answer.question_id}`);
    }
    res.status(204).end();
  })
);

// --- POST /votes ---------------------------------------------------------------
const voteSchema = z.object({
  questionId: z.string().uuid(),
  targetId: z.string().uuid(),
  dir: z.union([z.literal(1), z.literal(-1)]),
});

const votesRouter = express.Router();
votesRouter.post(
  '/',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(voteSchema, req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const qRes = await client.query('SELECT id FROM questions WHERE id = $1 FOR UPDATE', [data.questionId]);
      if (!qRes.rows[0]) throw ApiError.notFound();

      const isQuestionTarget = data.targetId === data.questionId;
      const targetRes = await client.query(
        isQuestionTarget
          ? 'SELECT id, votes, author_id FROM questions WHERE id = $1 FOR UPDATE'
          : 'SELECT id, votes, author_id FROM answers WHERE id = $1 AND question_id = $2 FOR UPDATE',
        isQuestionTarget ? [data.targetId] : [data.targetId, data.questionId]
      );
      const target = targetRes.rows[0];
      if (!target) throw ApiError.notFound();
      if (target.author_id === req.user.id) throw ApiError.forbidden('Vous ne pouvez pas voter pour votre propre contenu.');

      const prevRes = await client.query('SELECT direction FROM votes WHERE user_id = $1 AND target_id = $2', [req.user.id, data.targetId]);
      const prev = prevRes.rows[0] ? prevRes.rows[0].direction : 0;
      const next = prev === data.dir ? 0 : data.dir; // toggle, cf. mock : "prev === dir ? 0 : dir"
      const delta = next - prev;

      if (next === 0) {
        await client.query('DELETE FROM votes WHERE user_id = $1 AND target_id = $2', [req.user.id, data.targetId]);
      } else if (prev === 0) {
        await client.query(
          'INSERT INTO votes (user_id, question_id, target_type, target_id, direction) VALUES ($1, $2, $3, $4, $5)',
          [req.user.id, data.questionId, isQuestionTarget ? 'question' : 'answer', data.targetId, next]
        );
      } else {
        await client.query('UPDATE votes SET direction = $1 WHERE user_id = $2 AND target_id = $3', [next, req.user.id, data.targetId]);
      }

      const newVotes = target.votes + delta;
      await client.query(isQuestionTarget ? 'UPDATE questions SET votes = $1 WHERE id = $2' : 'UPDATE answers SET votes = $1 WHERE id = $2', [newVotes, target.id]);

      await client.query('COMMIT');

      // +5 pts à l'auteur si nouveau vote positif, jamais sur la question elle-même
      // (cf. mock : "if (next === 1 && prev !== 1 && targetId !== q.id) award(...)").
      if (next === 1 && prev !== 1 && !isQuestionTarget) {
        await points.award(target.author_id, 'Réponse votée utile', 5);
      }

      res.json({ votes: newVotes, myVote: next });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  })
);

// --- POST /questions/:id/meilleure-reponse -----------------------------------------
const bestAnswerSchema = z.object({ answerId: z.string().uuid() });

router.post(
  '/:id/meilleure-reponse',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(bestAnswerSchema, req.body);
    const qRes = await query('SELECT id, title, author_id FROM questions WHERE id = $1', [req.params.id]);
    const question = qRes.rows[0];
    if (!question) throw ApiError.notFound();
    if (question.author_id !== req.user.id) {
      throw ApiError.forbidden("Seul l'auteur de la question peut choisir la meilleure réponse.");
    }

    const aRes = await query('SELECT id, author_id FROM answers WHERE id = $1 AND question_id = $2', [data.answerId, question.id]);
    const answer = aRes.rows[0];
    if (!answer) throw ApiError.notFound();

    await query('UPDATE questions SET best_answer_id = $1 WHERE id = $2', [answer.id, question.id]);

    if (answer.author_id !== req.user.id) {
      await points.award(answer.author_id, `Meilleure réponse sur « ${question.title} »`, 25);
      await points.giveBadge(answer.author_id, 'b2');
      await notify(answer.author_id, 'reponse', `Votre réponse a été choisie comme meilleure réponse sur « ${question.title} ».`, `/questions/${question.id}`);
    }

    res.status(204).end();
  })
);

module.exports = { questionsRouter: router, commentsRouter, votesRouter };
