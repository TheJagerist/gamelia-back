// Espace « Agnès » : l'assistante IA de Gamelia.
//   GET  /agnes/etat                -> { available, model }
//   GET  /agnes/questions/:id       -> { available, answer: AgnesAnswer | null }   (public)
//   POST /agnes/questions/:id       -> AgnesAnswer   (membre connecté ; générée une fois puis partagée)
//   POST /agnes/discussion          -> { reply }     (membre connecté ; historique envoyé par le front)
// Règles : la piste d'Agnès ne rapporte aucun point, n'est jamais « meilleure réponse », et chaque
// membre a un nombre limité de demandes par heure (AGNES_LIMIT_PER_HOUR) pour protéger le quota de la clé.
const express = require('express');
const { z } = require('zod');
const env = require('../config/env');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');
const agnes = require('../services/agnes');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TURNS = 12; // messages d'historique transmis au maximum
const MAX_CHARS = 4000; // par message

// Demandes en cours par question : deux clics simultanés ne déclenchent qu'un seul appel à l'API.
const pending = new Map();

function toAnswer(row) {
  return { questionId: row.question_id, body: row.body, model: row.model, createdAt: row.created_at };
}

async function assertQuota(userId) {
  const { rows } = await query("SELECT count(*) FROM agnes_usage WHERE user_id = $1 AND created_at > now() - interval '1 hour'", [userId]);
  if (Number(rows[0].count) >= env.agnes.perHour) {
    throw ApiError.tooMany(`Vous avez atteint la limite de ${env.agnes.perHour} demandes à Agnès par heure. Réessayez un peu plus tard.`);
  }
}

const logUsage = (userId, kind) => query('INSERT INTO agnes_usage (user_id, kind) VALUES ($1, $2)', [userId, kind]);

function questionId(req) {
  if (!UUID_RE.test(req.params.id)) throw ApiError.notFound();
  return req.params.id;
}

// --- GET /agnes/etat -----------------------------------------------------------------
router.get('/etat', (req, res) => {
  res.json({ available: agnes.isAvailable(), model: env.agnes.model });
});

// --- GET /agnes/questions/:id --------------------------------------------------------------
router.get(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const id = questionId(req);
    const { rows } = await query(
      `SELECT q.id, a.question_id, a.body, a.model, a.created_at
       FROM questions q LEFT JOIN agnes_answers a ON a.question_id = q.id WHERE q.id = $1`,
      [id]
    );
    if (!rows[0]) throw ApiError.notFound();
    res.json({ available: agnes.isAvailable(), answer: rows[0].question_id ? toAnswer(rows[0]) : null });
  })
);

// --- POST /agnes/questions/:id -------------------------------------------------------------
// Toute la demande (lecture de la piste existante, quota, appel à l'API, enregistrement) forme un seul
// travail, enregistré dans `pending` AVANT la première attente. Deux clics simultanés partagent donc
// le même travail : un seul appel à l'API, même si celle-ci répond très vite.
async function answerQuestion(id, user) {
  const existing = await query('SELECT question_id, body, model, created_at FROM agnes_answers WHERE question_id = $1', [id]);
  if (existing.rows[0]) return { answer: toAnswer(existing.rows[0]), created: false };

  const qRes = await query(
    `SELECT q.id, q.title, q.body, q.code_lang, q.code_content,
            COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM question_tags t WHERE t.question_id = q.id), '{}') AS tags
     FROM questions q WHERE q.id = $1`,
    [id]
  );
  const q = qRes.rows[0];
  if (!q) throw ApiError.notFound();

  await assertQuota(user.id);
  const body = await agnes.ask([{ role: 'user', content: agnes.questionPrompt(q) }], { maxTokens: 1400 });
  await logUsage(user.id, 'question');
  const { rows } = await query(
    `INSERT INTO agnes_answers (question_id, body, model, requested_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (question_id) DO UPDATE SET question_id = EXCLUDED.question_id
     RETURNING question_id, body, model, created_at`,
    [id, body, env.agnes.model, user.id]
  );
  return { answer: toAnswer(rows[0]), created: true };
}

router.post(
  '/questions/:id',
  requireUser,
  asyncHandler(async (req, res) => {
    const id = questionId(req);
    if (!pending.has(id)) {
      const job = answerQuestion(id, req.user);
      pending.set(id, job);
      job.catch(() => undefined).finally(() => pending.delete(id));
    }
    const { answer, created } = await pending.get(id);
    res.status(created ? 201 : 200).json(answer);
  })
);

// --- POST /agnes/discussion -----------------------------------------------------------------
const discussionSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1, 'Le message est vide.').max(MAX_CHARS, `Chaque message doit faire au plus ${MAX_CHARS} caractères.`),
      })
    )
    .min(1, 'Écrivez votre question à Agnès.')
    .max(40, 'La discussion est trop longue. Commencez une nouvelle discussion.')
    .refine((list) => list.length === 0 || list[list.length - 1].role === 'user', 'Le dernier message doit être votre question.'),
});

router.post(
  '/discussion',
  requireUser,
  asyncHandler(async (req, res) => {
    const { messages } = validate(discussionSchema, req.body);
    await assertQuota(req.user.id);
    const reply = await agnes.ask(messages.slice(-MAX_TURNS));
    await logUsage(req.user.id, 'discussion');
    res.json({ reply });
  })
);

module.exports = router;
