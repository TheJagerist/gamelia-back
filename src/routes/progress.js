// Progression personnelle, portfolio, profil public, classement.
// Règles reprises de lib/mock/server.ts (progression(), portfolioOf(), publicProfile(), leaderboard()).
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const points = require('../services/points');
const { userCols, toPublicUser } = require('../utils/publicUser');

const router = express.Router();

// --- GET /moi/progression --------------------------------------------------------
router.get(
  '/progression',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const uRes = await query('SELECT points, level FROM users WHERE id = $1', [req.user.id]);
    const u = uRes.rows[0];
    const floor = u.points >= 2000 ? 2000 : u.points >= 500 ? 500 : 0;
    const nextLevelAt = u.points >= 2000 ? null : u.points >= 500 ? 2000 : 500;
    const today = await points.todayPoints(req.user.id);

    const historyRes = await query(
      'SELECT id, label, points, created_at FROM point_events WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const earnedRes = await query('SELECT badge_id FROM user_badges WHERE user_id = $1', [req.user.id]);
    const earnedIds = new Set(earnedRes.rows.map((r) => r.badge_id));
    const allBadgesRes = await query('SELECT * FROM badges ORDER BY id');

    res.json({
      points: u.points,
      level: u.level,
      levelFloor: floor,
      nextLevelAt,
      todayPoints: today,
      dailyCap: points.DAILY_CAP,
      history: historyRes.rows.map((h) => ({ id: h.id, label: h.label, points: h.points, date: h.created_at })),
      badges: allBadgesRes.rows.filter((b) => earnedIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, description: b.description, glyph: b.glyph })),
      lockedBadges: allBadgesRes.rows.filter((b) => !earnedIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, description: b.description, glyph: b.glyph })),
    });
  })
);

// Calcule le portfolio (vérifié / déclaré) d'un utilisateur, cf. portfolioOf() du mock.
async function buildPortfolio(userId) {
  const verified = [];
  const declared = [];

  // Défis réussis (quiz ou pratique).
  const challengesRes = await query(
    `SELECT c.id, c.title, c.kind FROM user_challenge_status ucs
     JOIN challenges c ON c.id = ucs.challenge_id
     WHERE ucs.user_id = $1 AND ucs.status = 'reussi'`,
    [userId]
  );
  for (const c of challengesRes.rows) {
    verified.push({
      id: `v-${c.id}`,
      kind: 'defi',
      title: c.title,
      detail: c.kind === 'quiz' ? 'Défi quiz corrigé automatiquement' : "Défi pratique validé par l'équipe",
      href: `/defis/${c.id}`,
      verified: true,
    });
  }

  // Pistes entièrement terminées.
  const tracksRes = await query('SELECT id, title FROM tracks');
  for (const t of tracksRes.rows) {
    const totalRes = await query('SELECT count(*) FROM lessons WHERE track_id = $1', [t.id]);
    const doneRes = await query(
      `SELECT count(*) FROM user_lesson_progress ulp JOIN lessons l ON l.id = ulp.lesson_id
       WHERE ulp.user_id = $1 AND l.track_id = $2`,
      [userId, t.id]
    );
    const total = Number(totalRes.rows[0].count);
    if (total > 0 && Number(doneRes.rows[0].count) === total) {
      verified.push({ id: `t-${t.id}`, kind: 'piste', title: t.title, detail: 'Piste terminée, quiz réussis', href: `/apprendre/${t.id}`, verified: true });
    }
  }

  // Projets : vérifié si au moins une revue validée, sinon déclaré.
  const projectsRes = await query('SELECT id, title FROM projects WHERE owner_id = $1', [userId]);
  for (const p of projectsRes.rows) {
    const countRes = await query('SELECT count(*) FROM project_reviews WHERE project_id = $1 AND validated_by_owner = true', [p.id]);
    const n = Number(countRes.rows[0].count);
    const item = {
      id: `p-${p.id}`,
      kind: 'projet',
      title: p.title,
      detail: n ? `Projet relu par ${n} pair${n > 1 ? 's' : ''}` : 'Projet publié, pas encore relu par des pairs',
      href: `/projets/${p.id}`,
      verified: n > 0,
    };
    (n > 0 ? verified : declared).push(item);
  }

  // Liens déclarés : vérifié seulement pour GitHub si le compte est confirmé.
  const uRes = await query('SELECT github_verified FROM users WHERE id = $1', [userId]);
  const githubVerified = uRes.rows[0]?.github_verified;
  const linksRes = await query('SELECT kind, label, url FROM declared_links WHERE user_id = $1 ORDER BY position', [userId]);
  linksRes.rows.forEach((l, i) => {
    const ok = l.kind === 'github' && githubVerified;
    const item = {
      id: `l-${i}`,
      kind: 'lien',
      title: l.label,
      detail: l.kind === 'github' ? (ok ? 'Compte GitHub relié et confirmé' : 'Compte GitHub déclaré') : l.kind === 'site' ? 'Site déclaré' : 'Projet déclaré',
      href: l.url,
      verified: ok,
    };
    (ok ? verified : declared).push(item);
  });

  return { verified, declared };
}

// --- GET /moi/portfolio -----------------------------------------------------------
router.get(
  '/portfolio',
  requireRole('developpeur'),
  asyncHandler(async (req, res) => {
    const pf = await buildPortfolio(req.user.id);
    res.json({ ...pf, username: req.user.username });
  })
);

// --- GET /profils/:username ---------------------------------------------------------
const profilesRouter = express.Router();
profilesRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const uRes = await query(
      `SELECT ${userCols('u', '')} FROM users u WHERE u.username = $1 AND u.role = 'developpeur'`,
      [req.params.username]
    );
    const u = uRes.rows[0];
    if (!u) throw ApiError.notFound();

    const settingsRes = await query('SELECT privacy_profil_public FROM user_settings WHERE user_id = $1', [u.id]);
    const settings = settingsRes.rows[0];
    if (settings && settings.privacy_profil_public === false && !req.user) {
      throw ApiError.forbidden('Ce membre a choisi de montrer son profil uniquement aux membres connectés.');
    }

    const pf = await buildPortfolio(u.id);

    const earnedRes = await query('SELECT badge_id FROM user_badges WHERE user_id = $1', [u.id]);
    const earnedIds = new Set(earnedRes.rows.map((r) => r.badge_id));
    const allBadgesRes = await query('SELECT * FROM badges ORDER BY id');

    const answersRes = await query('SELECT count(*) FROM answers WHERE author_id = $1', [u.id]);
    const bestRes = await query(
      `SELECT count(*) FROM questions q JOIN answers a ON a.id = q.best_answer_id WHERE a.author_id = $1`,
      [u.id]
    );
    const projectsRes = await query('SELECT count(*) FROM projects WHERE owner_id = $1', [u.id]);

    const rankRes = await query(
      `SELECT rank FROM (
         SELECT id, RANK() OVER (ORDER BY points DESC) AS rank
         FROM users WHERE role = 'developpeur' AND country = $1
       ) ranked WHERE id = $2`,
      [u.country, u.id]
    );

    res.json({
      user: toPublicUser(u),
      ...pf,
      badges: allBadgesRes.rows.filter((b) => earnedIds.has(b.id)).map((b) => ({ id: b.id, name: b.name, description: b.description, glyph: b.glyph })),
      stats: {
        answers: Number(answersRes.rows[0].count),
        bestAnswers: Number(bestRes.rows[0].count),
        projects: Number(projectsRes.rows[0].count),
        challenges: pf.verified.filter((v) => v.kind === 'defi').length,
      },
      rankInCountry: rankRes.rows[0] ? Number(rankRes.rows[0].rank) : null,
    });
  })
);

// --- GET /classement -------------------------------------------------------------
const classementRouter = express.Router();
const leaderboardQuerySchema = z.object({
  country: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

classementRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = validate(leaderboardQuerySchema, req.query);
    const PAGE_SIZE = 10;
    const where = [`u.role = 'developpeur'`];
    const params = [];
    if (opts.country) {
      params.push(opts.country);
      where.push(`u.country = $${params.length}`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countRes = await query(`SELECT count(*) FROM users u ${whereClause}`, params);
    const total = Number(countRes.rows[0].count);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page), pageCount);
    const offset = (page - 1) * PAGE_SIZE;

    params.push(PAGE_SIZE, offset);
    const { rows } = await query(
      `SELECT ${userCols('u', '')},
              RANK() OVER (ORDER BY u.points DESC) AS rank
       FROM users u ${whereClause}
       ORDER BY u.points DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items = await Promise.all(
      rows.map(async (u) => {
        const weekRes = await query(
          `SELECT COALESCE(SUM(points), 0) AS total FROM point_events WHERE user_id = $1 AND created_at >= now() - interval '7 days'`,
          [u.id]
        );
        return {
          rank: Number(u.rank),
          user: toPublicUser(u),
          points: u.points,
          weekPoints: Number(weekRes.rows[0].total),
        };
      })
    );
    res.json({ items, page, pageCount, total });
  })
);

module.exports = { meProgressRouter: router, profilesRouter, classementRouter };
