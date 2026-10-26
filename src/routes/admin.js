// Espace admin. Ce fichier ne couvre pour l'instant QUE la validation des
// défis pratiques (ferme le cycle ouvert par POST /defis/:id/solutions).
// Les routes recruteurs/signalements seront ajoutées avec leurs features
// respectives plutôt qu'en isolé ici (cf. api-routes.md).
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const points = require('../services/points');
const { userCols, toPublicUser, loadMe } = require('../utils/publicUser');

const router = express.Router();
router.use(requireRole('admin')); // toutes les routes de ce fichier exigent un admin

// --- GET /admin/solutions ------------------------------------------------------
router.get(
  '/solutions',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT s.id, s.code_url, s.note, s.created_at, s.status,
              c.id AS challenge_id, c.title AS challenge_title, c.points AS challenge_points,
              ${userCols('u', 'dev_')}
       FROM practical_submissions s
       JOIN challenges c ON c.id = s.challenge_id
       JOIN users u ON u.id = s.dev_id
       WHERE s.status = 'en_attente'
       ORDER BY s.created_at ASC`
    );

    const items = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        challenge: { id: row.challenge_id, title: row.challenge_title, points: row.challenge_points },
        dev: toPublicUser(row, 'dev_'),
        codeUrl: row.code_url,
        note: row.note,
        date: row.created_at,
        status: row.status,
      }))
    );
    res.json(items);
  })
);

// --- POST /admin/solutions/:id ----------------------------------------------------
const decideSchema = z.object({ approve: z.boolean() });

router.post(
  '/solutions/:id',
  asyncHandler(async (req, res) => {
    const data = validate(decideSchema, req.body);

    const sRes = await query(
      `SELECT s.id, s.dev_id, s.status, c.id AS challenge_id, c.title AS challenge_title, c.points AS challenge_points
       FROM practical_submissions s JOIN challenges c ON c.id = s.challenge_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    const submission = sRes.rows[0];
    if (!submission) throw ApiError.notFound();
    if (submission.status !== 'en_attente') {
      throw ApiError.conflict('Cette soumission a déjà été traitée.');
    }

    const newStatus = data.approve ? 'valide' : 'refuse';
    await query('UPDATE practical_submissions SET status = $1, decided_at = now() WHERE id = $2', [newStatus, submission.id]);

    const challengeStatus = data.approve ? 'reussi' : 'refuse';
    await query(
      `INSERT INTO user_challenge_status (user_id, challenge_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, challenge_id) DO UPDATE SET status = $3, updated_at = now()`,
      [submission.dev_id, submission.challenge_id, challengeStatus]
    );

    if (data.approve) {
      await points.award(submission.dev_id, `Défi réussi : ${submission.challenge_title}`, submission.challenge_points);
      await points.giveBadge(submission.dev_id, 'b4');
    }

    // Pas de colonne notify_validation dans user_settings (le kind 'validation' n'a
    // pas d'opt-out dédié côté mock) : on notifie toujours, comme le fait admin.decideSubmission().
    await query(
      `INSERT INTO notifications (user_id, kind, text, href)
       VALUES ($1, 'validation', $2, $3)`,
      [
        submission.dev_id,
        data.approve
          ? `Votre solution au défi « ${submission.challenge_title} » est validée.`
          : `Votre solution au défi « ${submission.challenge_title} » doit être revue.`,
        `/defis/${submission.challenge_id}`,
      ]
    );

    res.status(204).end();
  })
);

// --- GET /admin/recruteurs (comptes en attente) ------------------------------------
router.get(
  '/recruteurs',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id FROM users WHERE role = 'recruteur' AND recruiter_status = 'en_attente' ORDER BY created_at ASC`
    );
    res.json(await Promise.all(rows.map((r) => loadMe(r.id))));
  })
);

// --- POST /admin/recruteurs/:id -----------------------------------------------------
router.post(
  '/recruteurs/:id',
  asyncHandler(async (req, res) => {
    const data = validate(decideSchema, req.body);
    const uRes = await query("SELECT id FROM users WHERE id = $1 AND role = 'recruteur'", [req.params.id]);
    if (!uRes.rows[0]) throw ApiError.notFound();

    const newStatus = data.approve ? 'valide' : 'refuse';
    await query('UPDATE users SET recruiter_status = $1, updated_at = now() WHERE id = $2', [newStatus, req.params.id]);
    res.status(204).end();
  })
);

// --- GET /admin/defis (défis recruteurs en attente) ----------------------------------
router.get(
  '/defis',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.title, c.summary, c.brief, c.country, c.remote, c.deadline, c.reward, c.status, c.created_at,
              u.company,
              ${userCols('u', 'rec_')}
       FROM recruiter_challenges c JOIN users u ON u.id = c.recruiter_id
       WHERE c.status = 'en_attente' ORDER BY c.created_at ASC`
    );
    const items = await Promise.all(
      rows.map(async (c) => {
        const skillsRes = await query('SELECT skill FROM recruiter_challenge_skills WHERE challenge_id = $1', [c.id]);
        const countRes = await query('SELECT count(*) FROM applications WHERE challenge_id = $1', [c.id]);
        return {
          id: c.id,
          title: c.title,
          company: c.company || '',
          recruiter: toPublicUser(c, 'rec_'),
          summary: c.summary,
          brief: c.brief,
          skills: skillsRes.rows.map((r) => r.skill),
          country: c.country,
          remote: c.remote,
          deadline: c.deadline,
          reward: c.reward,
          status: c.status,
          applicationCount: Number(countRes.rows[0].count),
        };
      })
    );
    res.json(items);
  })
);

// --- POST /admin/defis/:id ------------------------------------------------------------
router.post(
  '/defis/:id',
  asyncHandler(async (req, res) => {
    const data = validate(decideSchema, req.body);
    const cRes = await query('SELECT id, recruiter_id, title FROM recruiter_challenges WHERE id = $1', [req.params.id]);
    const challenge = cRes.rows[0];
    if (!challenge) throw ApiError.notFound();

    const newStatus = data.approve ? 'publie' : 'refuse';
    await query('UPDATE recruiter_challenges SET status = $1 WHERE id = $2', [newStatus, challenge.id]);
    await query('INSERT INTO notifications (user_id, kind, text, href) VALUES ($1, $2, $3, $4)', [
      challenge.recruiter_id,
      'validation',
      data.approve ? `Votre défi « ${challenge.title} » est publié.` : `Votre défi « ${challenge.title} » n'a pas été accepté.`,
      '/recruteur/defis',
    ]);
    res.status(204).end();
  })
);

// --- GET /admin/signalements ----------------------------------------------------------
const reportsQuerySchema = z.object({ status: z.enum(['ouvert', 'traite', 'rejete']).optional().default('ouvert') });

router.get(
  '/signalements',
  asyncHandler(async (req, res) => {
    const opts = validate(reportsQuerySchema, req.query);
    const { rows } = await query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
              ${userCols('u', 'reporter_')}
       FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.status = $1 ORDER BY r.created_at ASC`,
      [opts.status]
    );

    const items = await Promise.all(
      rows.map(async (r) => {
        // Titre et lien de la cible selon son type (cf. reportView() dans mock/server.ts).
        let title = '';
        let href = '#';
        if (r.target_type === 'question') {
          const q = await query('SELECT title FROM questions WHERE id = $1', [r.target_id]);
          title = q.rows[0]?.title || 'Question supprimée';
          href = `/questions/${r.target_id}`;
        } else if (r.target_type === 'projet') {
          const p = await query('SELECT title FROM projects WHERE id = $1', [r.target_id]);
          title = p.rows[0]?.title || 'Projet supprimé';
          href = `/projets/${r.target_id}`;
        } else if (r.target_type === 'reponse') {
          const a = await query('SELECT body, question_id FROM answers WHERE id = $1', [r.target_id]);
          if (a.rows[0]) {
            title = `Réponse : « ${a.rows[0].body.slice(0, 60)}… »`;
            href = `/questions/${a.rows[0].question_id}`;
          } else {
            title = 'Réponse supprimée';
          }
        } else {
          // 'commentaire' : l'id peut désigner un commentaire de réponse ou de projet (deux tables).
          const ac = await query(
            `SELECT c.body, a.question_id FROM answer_comments c JOIN answers a ON a.id = c.answer_id WHERE c.id = $1`,
            [r.target_id]
          );
          const pc = ac.rows[0] ? { rows: [] } : await query('SELECT body, project_id FROM project_comments WHERE id = $1', [r.target_id]);
          if (ac.rows[0]) {
            title = `Commentaire : « ${ac.rows[0].body.slice(0, 60)} »`;
            href = `/questions/${ac.rows[0].question_id}`;
          } else if (pc.rows[0]) {
            title = `Commentaire : « ${pc.rows[0].body.slice(0, 60)} »`;
            href = `/projets/${pc.rows[0].project_id}`;
          } else {
            title = 'Commentaire supprimé';
          }
        }
        return {
          id: r.id,
          targetType: r.target_type,
          targetId: r.target_id,
          targetTitle: title,
          targetHref: href,
          reason: r.reason,
          details: r.details,
          reporter: toPublicUser(r, 'reporter_'),
          date: r.created_at,
          status: r.status,
        };
      })
    );
    res.json(items);
  })
);

// --- POST /admin/signalements/:id -----------------------------------------------------
const decideReportSchema = z.object({ action: z.enum(['retirer', 'rejeter']) });

router.post(
  '/signalements/:id',
  asyncHandler(async (req, res) => {
    const data = validate(decideReportSchema, req.body);
    const rRes = await query('SELECT id, target_type, target_id, status FROM reports WHERE id = $1', [req.params.id]);
    const report = rRes.rows[0];
    if (!report) throw ApiError.notFound();
    if (report.status !== 'ouvert') throw ApiError.conflict('Ce signalement a déjà été traité.');

    if (data.action === 'retirer') {
      // Retrait en cascade du contenu signalé, cf. mock : suppression directe de la cible.
      if (report.target_type === 'question') await query('DELETE FROM questions WHERE id = $1', [report.target_id]);
      else if (report.target_type === 'projet') await query('DELETE FROM projects WHERE id = $1', [report.target_id]);
      else if (report.target_type === 'reponse') await query('DELETE FROM answers WHERE id = $1', [report.target_id]);
      // 'commentaire' : pas de distinction answer_comments/project_comments dans le mock
      // (un seul id générique) — on tente les deux tables, l'une des deux correspondra.
      else if (report.target_type === 'commentaire') {
        await query('DELETE FROM answer_comments WHERE id = $1', [report.target_id]);
        await query('DELETE FROM project_comments WHERE id = $1', [report.target_id]);
      }
      await query("UPDATE reports SET status = 'traite' WHERE id = $1", [report.id]);
    } else {
      await query("UPDATE reports SET status = 'rejete' WHERE id = $1", [report.id]);
    }
    res.status(204).end();
  })
);

// --- GET /admin/compteurs ---------------------------------------------------------
router.get(
  '/compteurs',
  asyncHandler(async (req, res) => {
    const [recruiters, challenges, submissions, reports] = await Promise.all([
      query("SELECT count(*) FROM users WHERE recruiter_status = 'en_attente'"),
      query("SELECT count(*) FROM recruiter_challenges WHERE status = 'en_attente'"),
      query("SELECT count(*) FROM practical_submissions WHERE status = 'en_attente'"),
      query("SELECT count(*) FROM reports WHERE status = 'ouvert'"),
    ]);
    res.json({
      recruiters: Number(recruiters.rows[0].count),
      challenges: Number(challenges.rows[0].count),
      submissions: Number(submissions.rows[0].count),
      reports: Number(reports.rows[0].count),
    });
  })
);

module.exports = router;
