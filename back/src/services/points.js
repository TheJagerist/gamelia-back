// Module central de points : TOUTE attribution de points passe par award().
// Objectif : un seul endroit où vivent le plafond quotidien et les règles
// anti-triche, pour ne jamais les dupliquer (et donc désynchroniser) entre
// les 6 routes qui distribuent des points (réponse, vote, meilleure réponse,
// quiz leçon, défi, revue validée).
const { pool } = require('../db/pool');

const DAILY_CAP = 200; // cf. api-routes.md / mock/server.ts

const LEVEL_THRESHOLDS = [
  { min: 2000, level: 'Confirmé' },
  { min: 500, level: 'Intermédiaire' },
  { min: 0, level: 'Débutant' },
];

function levelFor(points) {
  return LEVEL_THRESHOLDS.find((t) => points >= t.min).level;
}

/**
 * Crédite des points à un utilisateur, en respectant le plafond quotidien.
 * Si le montant demandé dépasserait le plafond, seule la part restante est
 * créditée (jamais 0 silencieux sans raison : on renvoie ce qui a été
 * réellement accordé pour que l'appelant puisse informer l'utilisateur).
 *
 * @param {string} userId
 * @param {string} label - texte lisible, stocké dans point_events.label
 * @param {number} amount - montant demandé (toujours positif)
 * @returns {Promise<{awarded: number, newTotal: number, newLevel: string, leveledUp: boolean}>}
 */
async function award(userId, label, amount) {
  if (amount <= 0) throw new Error('award() attend un montant positif');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrou de ligne pour sérialiser les crédits concurrents du même user
    // (ex. deux votes qui arrivent au même moment) et éviter une lecture
    // du plafond déjà périmée au moment de l'insert.
    const userRow = await client.query('SELECT role, points, level FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRow.rows.length === 0) throw new Error(`Utilisateur introuvable : ${userId}`);
    const before = userRow.rows[0];

    // Seuls les développeurs gagnent des points (cf. award() dans mock/server.ts :
    // "if (u.role !== 'developpeur') return 0"). Un recruteur ou un admin qui
    // déclencherait ce chemin (ne devrait jamais arriver vu les routes, mais on
    // se protège) ne doit rien recevoir.
    if (before.role !== 'developpeur') {
      await client.query('ROLLBACK');
      return { awarded: 0, newTotal: 0, newLevel: before.level, leveledUp: false };
    }

    const todayRow = await client.query(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM point_events
       WHERE user_id = $1 AND created_at >= date_trunc('day', now())`,
      [userId]
    );
    const earnedToday = Number(todayRow.rows[0].total);
    const awarded = Math.max(0, Math.min(amount, DAILY_CAP - earnedToday));

    if (awarded > 0) {
      await client.query('INSERT INTO point_events (user_id, label, points) VALUES ($1, $2, $3)', [userId, String(label).slice(0, 200), awarded]);
    }

    const newTotal = before.points + awarded;
    const newLevel = levelFor(newTotal);
    if (newLevel !== before.level || awarded > 0) {
      await client.query('UPDATE users SET points = $1, level = $2, updated_at = now() WHERE id = $3', [newTotal, newLevel, userId]);
    }

    await client.query('COMMIT');
    return { awarded, newTotal, newLevel, leveledUp: newLevel !== before.level };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Points déjà gagnés aujourd'hui (UTC) — pour l'écran de progression (/moi/progression). */
async function todayPoints(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(points), 0) AS total FROM point_events
     WHERE user_id = $1 AND created_at >= date_trunc('day', now())`,
    [userId]
  );
  return Number(rows[0].total);
}

/**
 * Attribue un badge une seule fois (idempotent). Retourne true si c'est une
 * première attribution (pour déclencher une notification), false si le
 * badge était déjà acquis.
 */
async function giveBadge(userId, badgeId) {
  const { rowCount } = await pool.query(
    `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)
     ON CONFLICT (user_id, badge_id) DO NOTHING`,
    [userId, badgeId]
  );
  return rowCount === 1;
}

/**
 * Garde anti-triche commune : refuse qu'un utilisateur gagne des points sur
 * son propre contenu (vote sur sa propre question/réponse, revue de son
 * propre projet, etc.). À appeler AVANT award() dans chaque route concernée.
 */
function assertNotSelf(actingUserId, ownerId, message = 'Vous ne pouvez pas réaliser cette action sur votre propre contenu.') {
  const ApiError = require('../utils/ApiError');
  if (actingUserId === ownerId) throw ApiError.forbidden(message, 'auto_interaction');
}

module.exports = { award, todayPoints, giveBadge, levelFor, assertNotSelf, DAILY_CAP };
