// Fil d'actualité : union questions / projets / leçons triée par date, pagination de 8.
// Règles reprises de lib/mock/server.ts (feed()). Réponse : Page<FeedItem> avec
// FeedItem = { type: 'question' | 'projet' | 'lecon', date, item }.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { questionSummariesByIds, projectSummariesByIds } = require('../services/summaries');

const router = express.Router();
const PAGE_SIZE = 8;

const feedQuerySchema = z.object({
  type: z.enum(['question', 'projet', 'lecon']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  following: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(feedQuerySchema, req.query);

    // Technologies suivies : filtre uniquement si le visiteur est connecté et en suit au moins une
    // (sinon on affiche tout, comme le mock).
    let follow = null;
    if (opts.following && req.user) {
      const { rows } = await query('SELECT tag FROM followed_tags WHERE user_id = $1', [req.user.id]);
      if (rows.length) follow = rows.map((r) => r.tag);
    }

    // Les leçons n'ont pas de date de publication : comme le mock, on en met en avant une sur trois,
    // datée de façon dégressive (1 j, 3,5 j, 6 j…) pour qu'elles s'intercalent dans le fil.
    const lessonsRes = await query(
      `SELECT l.id, l.track_id, l.title, l.minutes, t.title AS track_title
       FROM lessons l JOIN tracks t ON t.id = l.track_id
       ORDER BY t.position, l.position`
    );
    const lessonEntries = lessonsRes.rows
      .filter((_, i) => i % 3 === 0)
      .map((l, i) => ({
        type: 'lecon',
        id: l.id,
        date: new Date(Date.now() - (1 + i * 2.5) * 86400000),
        item: { id: l.id, trackId: l.track_id, title: l.title, trackTitle: l.track_title, minutes: l.minutes },
      }));

    // Entrées légères (id + date) : on ne charge les résumés complets que pour la page demandée.
    const entries = [];
    if (!opts.type || opts.type === 'question') {
      const { rows } = await query(
        `SELECT q.id, q.created_at FROM questions q
         WHERE $1::text[] IS NULL OR EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = q.id AND qt.tag = ANY($1))`,
        [follow]
      );
      rows.forEach((r) => entries.push({ type: 'question', id: r.id, date: r.created_at }));
    }
    if (!opts.type || opts.type === 'projet') {
      const { rows } = await query(
        `SELECT p.id, p.created_at FROM projects p
         WHERE $1::text[] IS NULL OR EXISTS (SELECT 1 FROM project_techs pt WHERE pt.project_id = p.id AND pt.tech = ANY($1))`,
        [follow]
      );
      rows.forEach((r) => entries.push({ type: 'projet', id: r.id, date: r.created_at }));
    }
    if (!opts.type || opts.type === 'lecon') entries.push(...lessonEntries);

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = entries.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const slice = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const [questions, projects] = await Promise.all([
      questionSummariesByIds(slice.filter((e) => e.type === 'question').map((e) => e.id)),
      projectSummariesByIds(slice.filter((e) => e.type === 'projet').map((e) => e.id)),
    ]);
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const pMap = new Map(projects.map((p) => [p.id, p]));

    const items = slice.map((e) => ({
      type: e.type,
      date: new Date(e.date).toISOString(),
      item: e.type === 'question' ? qMap.get(e.id) : e.type === 'projet' ? pMap.get(e.id) : e.item,
    }));

    res.json({ items, page, pageCount, total });
  })
);

module.exports = router;
