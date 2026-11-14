// Messagerie privée entre membres. Règles reprises de lib/mock/messages.ts (front) :
//  - réservée aux développeurs et aux recruteurs validés ; l'admin n'a pas de messagerie ;
//  - on ne lit que ses propres conversations (404 sinon, sans révéler qu'elles existent) ;
//  - 1 à 1000 caractères par message, 10 messages par minute au maximum (429) ;
//  - un membre bloqué ne peut plus écrire, et on ne peut pas s'écrire à soi-même.
const express = require('express');
const { z } = require('zod');
const { query, pool } = require('../db/pool');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { userCols, toPublicUser } = require('../utils/publicUser');

const router = express.Router();
const MAX_LEN = 1000;
const MAX_PER_MINUTE = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(requireRole('developpeur', 'recruteur'));

const bodySchema = z
  .string({ error: `Votre message doit contenir entre 1 et ${MAX_LEN} caractères.` })
  .trim()
  .min(1, `Votre message doit contenir entre 1 et ${MAX_LEN} caractères.`)
  .max(MAX_LEN, `Votre message doit contenir entre 1 et ${MAX_LEN} caractères.`);

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

function toMessage(row, meId) {
  return { id: row.id, conversationId: row.conversation_id, body: row.body, createdAt: row.created_at, mine: row.author_id === meId };
}

/** Résumés de conversations du membre connecté (optionnellement une seule). */
async function summaries(meId, conversationId) {
  const params = [meId];
  let filter = '';
  if (conversationId) {
    params.push(conversationId);
    filter = 'AND c.id = $2';
  }
  const { rows } = await query(
    `SELECT c.id AS conv_id, c.last_message_at,
            ${userCols('o', 'with_')},
            lm.body AS last_body, lm.created_at AS last_at, lm.author_id AS last_author,
            (SELECT count(*) FROM messages m
               WHERE m.conversation_id = c.id AND m.author_id <> $1
                 AND m.created_at > COALESCE((SELECT r.last_read_at FROM conversation_reads r
                                              WHERE r.conversation_id = c.id AND r.user_id = $1), '-infinity')) AS unread,
            EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = o.id) AS blocked_by_me
     FROM conversations c
     JOIN users o ON o.id = CASE WHEN c.user_low = $1 THEN c.user_high ELSE c.user_low END
     LEFT JOIN LATERAL (
       SELECT m.body, m.created_at, m.author_id FROM messages m
       WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
     ) lm ON true
     WHERE (c.user_low = $1 OR c.user_high = $1) ${filter}
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    params
  );
  return rows.map((r) => ({
    id: r.conv_id,
    with: toPublicUser(r, 'with_'),
    lastMessage: r.last_at ? { body: r.last_body, createdAt: r.last_at, mine: r.last_author === meId } : null,
    unread: Number(r.unread),
    blockedByMe: r.blocked_by_me,
  }));
}

async function findMember(username) {
  const { rows } = await query('SELECT id, role FROM users WHERE username = $1', [username]);
  return rows[0];
}

async function assertCanWrite(client, meId, otherId) {
  const { rows } = await client.query(
    `SELECT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS by_me,
            EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = $1) AS by_other`,
    [meId, otherId]
  );
  if (rows[0].by_me) throw ApiError.forbidden('Débloquez ce membre pour lui écrire.', 'bloque_par_moi');
  if (rows[0].by_other) throw ApiError.forbidden('Vous ne pouvez pas écrire à ce membre.', 'bloque');
}

async function assertNotTooFast(client, meId) {
  const { rows } = await client.query(
    "SELECT count(*) FROM messages WHERE author_id = $1 AND created_at > now() - interval '1 minute'",
    [meId]
  );
  if (Number(rows[0].count) >= MAX_PER_MINUTE) throw ApiError.tooMany('Vous envoyez trop de messages. Patientez une minute avant de réessayer.');
}

/** Ajoute un message dans une conversation (dans une transaction déjà ouverte). */
async function pushMessage(client, conversationId, meId, body) {
  const { rows } = await client.query(
    'INSERT INTO messages (conversation_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, conversation_id, author_id, body, created_at',
    [conversationId, meId, body]
  );
  const m = rows[0];
  await client.query('UPDATE conversations SET last_message_at = $2 WHERE id = $1', [conversationId, m.created_at]);
  await client.query(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = GREATEST(conversation_reads.last_read_at, EXCLUDED.last_read_at)`,
    [conversationId, meId, m.created_at]
  );
  return m;
}

/** Ouvre (ou retrouve) la conversation entre deux membres et y écrit. Utilisé aussi par le contact recruteur. */
async function startConversation(client, meId, otherId, body) {
  const [low, high] = pair(meId, otherId);
  const { rows } = await client.query(
    `INSERT INTO conversations (user_low, user_high) VALUES ($1, $2)
     ON CONFLICT (user_low, user_high) DO UPDATE SET user_low = EXCLUDED.user_low
     RETURNING id`,
    [low, high]
  );
  const id = rows[0].id;
  await pushMessage(client, id, meId, body);
  return id;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function conversationId(req) {
  if (!UUID_RE.test(req.params.id)) throw ApiError.notFound();
  return req.params.id;
}

// --- GET /messages/conversations ----------------------------------------------------
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    res.json(await summaries(req.user.id));
  })
);

// --- GET /messages/non-lus -------------------------------------------------------------
router.get(
  '/non-lus',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT count(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = $1
       WHERE (c.user_low = $1 OR c.user_high = $1) AND m.author_id <> $1
         AND m.created_at > COALESCE(r.last_read_at, '-infinity')`,
      [req.user.id]
    );
    res.json({ count: Number(rows[0].count) });
  })
);

// --- GET /messages/conversations/:id ----------------------------------------------------
router.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const id = conversationId(req);
    const [summary] = await summaries(req.user.id, id);
    if (!summary) throw ApiError.notFound();
    const { rows } = await query(
      `SELECT id, conversation_id, author_id, body, created_at FROM messages
       WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    );
    res.json({ ...summary, messages: rows.map((m) => toMessage(m, req.user.id)) });
  })
);

// --- POST /messages/conversations (premier message à un membre) -------------------------
const startSchema = z.object({ username: z.string().trim().min(1, 'Membre introuvable.').max(40, 'Membre introuvable.'), body: bodySchema });

router.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const data = validate(startSchema, req.body);
    const other = await findMember(data.username);
    if (!other) throw ApiError.notFound();
    if (other.id === req.user.id) throw new ApiError(400, 'Vous ne pouvez pas vous écrire à vous-même.', { code: 'validation' });
    if (other.role === 'admin') throw ApiError.forbidden();

    const id = await withTransaction(async (client) => {
      await assertCanWrite(client, req.user.id, other.id);
      await assertNotTooFast(client, req.user.id);
      return startConversation(client, req.user.id, other.id, data.body);
    });
    res.status(201).json({ id });
  })
);

// --- POST /messages/conversations/:id/messages ----------------------------------------------
const sendSchema = z.object({ body: bodySchema });

router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const id = conversationId(req);
    const data = validate(sendSchema, req.body);
    const { rows } = await query('SELECT user_low, user_high FROM conversations WHERE id = $1 AND (user_low = $2 OR user_high = $2)', [id, req.user.id]);
    const conv = rows[0];
    if (!conv) throw ApiError.notFound();
    const otherId = conv.user_low === req.user.id ? conv.user_high : conv.user_low;

    const m = await withTransaction(async (client) => {
      await assertCanWrite(client, req.user.id, otherId);
      await assertNotTooFast(client, req.user.id);
      return pushMessage(client, id, req.user.id, data.body);
    });
    res.status(201).json(toMessage(m, req.user.id));
  })
);

// --- POST /messages/conversations/:id/lu ----------------------------------------------------
router.post(
  '/conversations/:id/lu',
  asyncHandler(async (req, res) => {
    const id = conversationId(req);
    const { rowCount } = await query('SELECT 1 FROM conversations WHERE id = $1 AND (user_low = $2 OR user_high = $2)', [id, req.user.id]);
    if (!rowCount) throw ApiError.notFound();
    await query(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, clock_timestamp())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [id, req.user.id]
    );
    res.status(204).end();
  })
);

// --- POST /messages/blocages et DELETE /messages/blocages/:username ---------------------------
const blockSchema = z.object({ username: z.string().trim().min(1, 'Membre introuvable.').max(40, 'Membre introuvable.') });

router.post(
  '/blocages',
  asyncHandler(async (req, res) => {
    const { username } = validate(blockSchema, req.body);
    const other = await findMember(username);
    if (!other || other.id === req.user.id) throw ApiError.notFound();
    await query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, other.id]);
    res.status(204).end();
  })
);

router.delete(
  '/blocages/:username',
  asyncHandler(async (req, res) => {
    const other = await findMember(req.params.username);
    if (!other) throw ApiError.notFound();
    await query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.id, other.id]);
    res.status(204).end();
  })
);

module.exports = router;
module.exports.startConversation = startConversation;
module.exports.assertCanWrite = assertCanWrite;
module.exports.withTransaction = withTransaction;
