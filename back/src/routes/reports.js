// Signalements de contenu (question, réponse, projet, commentaire).
// Règles reprises de lib/mock/server.ts (report()).
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

const createReportSchema = z.object({
  targetType: z.enum(['question', 'reponse', 'projet', 'commentaire']),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(1, 'Choisissez un motif.').max(100, 'Choisissez un motif.'),
  details: z.string().trim().max(2000, 'Les précisions sont trop longues (2 000 caractères au maximum).').optional(),
});

router.post(
  '/',
  requireUser,
  asyncHandler(async (req, res) => {
    const data = validate(createReportSchema, req.body);

    // La cible doit exister (le mock ne le vérifie pas, mais un signalement sur un contenu
    // inexistant ne pourrait jamais être traité par un admin).
    const lookups = {
      question: ['SELECT 1 FROM questions WHERE id = $1'],
      reponse: ['SELECT 1 FROM answers WHERE id = $1'],
      projet: ['SELECT 1 FROM projects WHERE id = $1'],
      commentaire: ['SELECT 1 FROM answer_comments WHERE id = $1', 'SELECT 1 FROM project_comments WHERE id = $1'],
    }[data.targetType];
    let exists = false;
    for (const sql of lookups) {
      if ((await query(sql, [data.targetId])).rows.length) {
        exists = true;
        break;
      }
    }
    if (!exists) throw ApiError.notFound();

    // target_type en base utilise 'reponse' pour les réponses (cf. schema.sql report_target_type),
    // cohérent avec ce que le front envoie déjà.
    try {
      await query(
        'INSERT INTO reports (target_type, target_id, reason, details, reporter_id) VALUES ($1,$2,$3,$4,$5)',
        [data.targetType, data.targetId, data.reason, data.details || null, req.user.id]
      );
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Vous avez déjà signalé ce contenu.');
      throw err;
    }
    res.status(204).end();
  })
);

module.exports = router;
