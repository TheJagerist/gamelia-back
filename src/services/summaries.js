// Constructeurs partagés de QuestionSummary / ProjectSummary (lib/types.ts).
// Utilisés par les listes (/questions, /projets), le fil (/fil) et l'accueil (/accueil)
// pour que le front reçoive exactement la même forme partout.
const { query } = require('../db/pool');
const { userCols, toPublicUser } = require('../utils/publicUser');

function mapQuestionSummary(row) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.body.slice(0, 160),
    tags: row.tags,
    author: toPublicUser(row, 'author_'),
    createdAt: row.created_at,
    votes: row.votes,
    answerCount: Number(row.answer_count),
    hasBestAnswer: !!row.best_answer_id,
  };
}

function mapProjectSummary(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    techs: row.techs,
    owner: toPublicUser(row, 'owner_'),
    hasVideo: !!row.video_url,
    videoUrl: row.video_url ?? undefined,
    seekingCollaborators: row.seeking_collaborators,
    createdAt: row.created_at,
    validatedReviews: Number(row.validated_reviews),
  };
}

const QUESTION_SUMMARY_SELECT = `
  SELECT q.id, q.title, q.body, q.votes, q.created_at, q.best_answer_id,
         ${userCols('u', 'author_')},
         COALESCE(array_agg(qt.tag) FILTER (WHERE qt.tag IS NOT NULL), '{}') AS tags,
         (SELECT count(*) FROM answers a WHERE a.question_id = q.id) AS answer_count
  FROM questions q
  JOIN users u ON u.id = q.author_id
  LEFT JOIN question_tags qt ON qt.question_id = q.id`;

const PROJECT_SUMMARY_SELECT = `
  SELECT p.id, p.title, p.summary, p.video_url, p.seeking_collaborators, p.created_at,
         ${userCols('u', 'owner_')},
         COALESCE((SELECT array_agg(pt.tech) FROM project_techs pt WHERE pt.project_id = p.id), '{}') AS techs,
         (SELECT count(*) FROM project_reviews r WHERE r.project_id = p.id AND r.validated_by_owner = true) AS validated_reviews
  FROM projects p
  JOIN users u ON u.id = p.owner_id`;

/** Résumés de questions pour une liste d'ids, renvoyés dans l'ordre demandé. */
async function questionSummariesByIds(ids) {
  if (!ids.length) return [];
  const { rows } = await query(`${QUESTION_SUMMARY_SELECT} WHERE q.id = ANY($1) GROUP BY q.id, u.id`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, mapQuestionSummary(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function projectSummariesByIds(ids) {
  if (!ids.length) return [];
  const { rows } = await query(`${PROJECT_SUMMARY_SELECT} WHERE p.id = ANY($1)`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, mapProjectSummary(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = {
  mapQuestionSummary,
  mapProjectSummary,
  questionSummariesByIds,
  projectSummariesByIds,
  QUESTION_SUMMARY_SELECT,
  PROJECT_SUMMARY_SELECT,
};
