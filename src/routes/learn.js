// Apprentissage : pistes, leçons, quiz de leçon.
// Règles reprises de lib/mock/server.ts (learn.*) : seuil de réussite 66%,
// +15 pts par leçon réussie (une seule fois), +60 pts + badge b3 si la piste
// entière est terminée.
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const points = require('../services/points');

const tracksRouter = express.Router();
const lessonsRouter = express.Router();

// --- GET /pistes -----------------------------------------------------------
tracksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const tracksRes = await query('SELECT id, title, level, description FROM tracks ORDER BY position');
    const lessonsRes = await query('SELECT id, track_id, title, minutes, position FROM lessons ORDER BY track_id, position');

    let doneIds = new Set();
    if (req.user) {
      const doneRes = await query('SELECT lesson_id FROM user_lesson_progress WHERE user_id = $1', [req.user.id]);
      doneIds = new Set(doneRes.rows.map((r) => r.lesson_id));
    }

    const byTrack = new Map();
    for (const l of lessonsRes.rows) {
      if (!byTrack.has(l.track_id)) byTrack.set(l.track_id, []);
      byTrack.get(l.track_id).push(l);
    }

    const result = tracksRes.rows.map((t) => {
      const ls = byTrack.get(t.id) || [];
      const doneCount = ls.filter((l) => doneIds.has(l.id)).length;
      return {
        id: t.id,
        title: t.title,
        level: t.level,
        description: t.description,
        lessons: ls.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, done: doneIds.has(l.id) })),
        progress: ls.length ? doneCount / ls.length : 0,
      };
    });
    res.json(result);
  })
);

// --- GET /pistes/:id ---------------------------------------------------------
tracksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tRes = await query('SELECT id, title, level, description FROM tracks WHERE id = $1', [req.params.id]);
    const t = tRes.rows[0];
    if (!t) throw ApiError.notFound();

    const lessonsRes = await query('SELECT id, title, minutes FROM lessons WHERE track_id = $1 ORDER BY position', [t.id]);
    let doneIds = new Set();
    if (req.user) {
      const doneRes = await query('SELECT lesson_id FROM user_lesson_progress WHERE user_id = $1', [req.user.id]);
      doneIds = new Set(doneRes.rows.map((r) => r.lesson_id));
    }
    const ls = lessonsRes.rows;
    const doneCount = ls.filter((l) => doneIds.has(l.id)).length;

    res.json({
      id: t.id,
      title: t.title,
      level: t.level,
      description: t.description,
      lessons: ls.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, done: doneIds.has(l.id) })),
      progress: ls.length ? doneCount / ls.length : 0,
    });
  })
);

// --- GET /lecons/:id ----------------------------------------------------------
lessonsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lRes = await query(
      `SELECT l.id, l.track_id, l.title, l.minutes, l.blocks, l.position, t.title AS track_title
       FROM lessons l JOIN tracks t ON t.id = l.track_id WHERE l.id = $1`,
      [req.params.id]
    );
    const l = lRes.rows[0];
    if (!l) throw ApiError.notFound();

    // next/prev par position dans la même piste (remplace trackIds[i-1]/[i+1] du mock).
    const prevRes = await query('SELECT id FROM lessons WHERE track_id = $1 AND position = $2', [l.track_id, l.position - 1]);
    const nextRes = await query('SELECT id FROM lessons WHERE track_id = $1 AND position = $2', [l.track_id, l.position + 1]);
    const prev = prevRes.rows[0]?.id;
    const next = nextRes.rows[0]?.id;

    // Jamais renvoyer correct_index avant correction (cf. mock : "quiz: l.quiz.map(({answer, ...q}) => q)").
    const quizRes = await query(
      'SELECT id, prompt, options FROM lesson_quiz_questions WHERE lesson_id = $1 ORDER BY position',
      [l.id]
    );

    let done = false;
    if (req.user) {
      const doneRes = await query('SELECT 1 FROM user_lesson_progress WHERE user_id = $1 AND lesson_id = $2', [req.user.id, l.id]);
      done = doneRes.rows.length > 0;
    }

    res.json({
      id: l.id,
      trackId: l.track_id,
      title: l.title,
      minutes: l.minutes,
      blocks: l.blocks,
      quiz: quizRes.rows,
      done,
      trackTitle: l.track_title,
      next,
      prev,
    });
  })
);

// --- POST /lecons/:id/quiz ------------------------------------------------------
const quizSubmitSchema = z.object({ answers: z.array(z.number().int()) });

lessonsRouter.post(
  '/:id/quiz',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const data = validate(quizSubmitSchema, req.body);
    const lRes = await query('SELECT id, track_id, title FROM lessons WHERE id = $1', [req.params.id]);
    const lesson = lRes.rows[0];
    if (!lesson) throw ApiError.notFound();

    const quizRes = await query(
      'SELECT id, prompt, options, correct_index, explanation FROM lesson_quiz_questions WHERE lesson_id = $1 ORDER BY position',
      [lesson.id]
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
    const passed = score >= Math.ceil(questions.length * 0.66); // seuil mock : >= 66%

    let pointsEarned = 0;
    let badge;
    const alreadyDoneRes = await query('SELECT 1 FROM user_lesson_progress WHERE user_id = $1 AND lesson_id = $2', [req.user.id, lesson.id]);
    const alreadyDone = alreadyDoneRes.rows.length > 0;

    if (passed && !alreadyDone) {
      await query('INSERT INTO user_lesson_progress (user_id, lesson_id) VALUES ($1, $2)', [req.user.id, lesson.id]);
      const r1 = await points.award(req.user.id, `Leçon réussie : ${lesson.title}`, 15);
      pointsEarned += r1.awarded;

      // Piste complète ? (toutes les leçons de la piste sont faites)
      const allLessonsRes = await query('SELECT id FROM lessons WHERE track_id = $1', [lesson.track_id]);
      const doneRes = await query('SELECT lesson_id FROM user_lesson_progress WHERE user_id = $1 AND lesson_id = ANY($2)', [
        req.user.id,
        allLessonsRes.rows.map((l) => l.id),
      ]);
      if (doneRes.rows.length === allLessonsRes.rows.length) {
        const trackRes = await query('SELECT title FROM tracks WHERE id = $1', [lesson.track_id]);
        const r2 = await points.award(req.user.id, `Piste terminée : ${trackRes.rows[0].title}`, 60);
        pointsEarned += r2.awarded;
        const firstTime = await points.giveBadge(req.user.id, 'b3');
        if (firstTime) {
          const bRes = await query('SELECT * FROM badges WHERE id = $1', ['b3']);
          badge = { id: bRes.rows[0].id, name: bRes.rows[0].name, description: bRes.rows[0].description, glyph: bRes.rows[0].glyph };
        }
      }
    }

    res.json({ score, total: questions.length, passed, pointsEarned, corrections, badge });
  })
);

module.exports = { tracksRouter, lessonsRouter };
