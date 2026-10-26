// Page d'accueil publique : dernières questions et projets + chiffres clés.
// Règles reprises de lib/mock/server.ts (home()). Appelée par le front en GET /accueil.
const express = require('express');
const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { questionSummariesByIds, projectSummariesByIds } = require('../services/summaries');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [qIds, pIds, statsRes] = await Promise.all([
      query('SELECT id FROM questions ORDER BY created_at DESC LIMIT 4'),
      query('SELECT id FROM projects ORDER BY created_at DESC LIMIT 3'),
      query(
        `SELECT
           (SELECT count(*) FROM users WHERE role = 'developpeur') AS devs,
           (SELECT count(DISTINCT country) FROM users WHERE role = 'developpeur') AS countries,
           (SELECT count(*) FROM answers) AS answers`
      ),
    ]);
    const [questions, projects] = await Promise.all([
      questionSummariesByIds(qIds.rows.map((r) => r.id)),
      projectSummariesByIds(pIds.rows.map((r) => r.id)),
    ]);
    const s = statsRes.rows[0];
    res.json({
      questions,
      projects,
      stats: { devs: Number(s.devs), countries: Number(s.countries), answers: Number(s.answers) },
    });
  })
);

module.exports = router;
