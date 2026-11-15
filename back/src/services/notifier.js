// Notifications : une seule porte d'entrée pour « prévenir un membre ».
//
//  - crée la notification dans le site (table notifications), sauf si le membre a désactivé ce type de notification ;
//  - envoie en plus un e-mail quand un modèle est fourni, pour que le membre soit prévenu même hors du site.
//
// Règles :
//  - le même réglage (Paramètres > Notifications) gouverne la notification et l'e-mail : un membre qui a coupé « Réponses à
//    mes questions » ne reçoit ni l'un ni l'autre. Les messages sans réglage (validation d'un défi, collaboration…)
//    sont toujours envoyés : ils concernent une décision sur ce que le membre a lui-même soumis ;
//  - l'e-mail est facultatif et jamais bloquant (voir mailer.js) : une panne SMTP ne fait pas échouer l'action ;
//  - un e-mail ne contient jamais le texte d'un message privé, ni de texte de membre dans son objet.
const { query } = require('../db/pool');
const { sendMailInBackground } = require('./mailer');

const COLUMN_BY_KIND = {
  reponse: 'notify_reponses',
  commentaire: 'notify_commentaires',
  badge: 'notify_badges',
  candidature: 'notify_candidatures',
};

/**
 * @param {string} userId
 * @param {string} kind    type de notification (voir COLUMN_BY_KIND ; les autres sont toujours envoyés)
 * @param {string} text    texte de la notification dans le site
 * @param {string} href    chemin du site (ex. « /questions/… »)
 * @param {(recipient: {name: string}) => {subject: string, text: string, html: string}} [mail]  modèle d'e-mail, facultatif
 */
async function notifyUser(userId, kind, text, href, mail) {
  const column = COLUMN_BY_KIND[kind];
  if (column) {
    const { rows } = await query(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = $1`, [userId]);
    if (rows.length && rows[0].enabled === false) return;
  }
  await query('INSERT INTO notifications (user_id, kind, text, href) VALUES ($1, $2, $3, $4)', [userId, kind, text, href]);
  if (mail) await mailUser(userId, mail);
}

/** E-mail seul (sans notification dans le site). Ne lève jamais d'erreur. */
async function mailUser(userId, mail) {
  try {
    const { rows } = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
    if (!rows.length || !rows[0].email) return;
    sendMailInBackground({ to: rows[0].email, ...mail({ name: rows[0].name }) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifier] e-mail non envoyé :', err && err.message);
  }
}

/** Notification (et e-mail) à tous les administrateurs. */
async function notifyAdmins(kind, text, href, mail) {
  await query(
    `INSERT INTO notifications (user_id, kind, text, href)
     SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'`,
    [kind, text, href]
  );
  if (!mail) return;
  try {
    const { rows } = await query("SELECT name, email FROM users WHERE role = 'admin' AND email IS NOT NULL");
    for (const a of rows) sendMailInBackground({ to: a.email, ...mail({ name: a.name }) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifier] e-mail aux administrateurs non envoyé :', err && err.message);
  }
}

/**
 * Message privé reçu : un seul e-mail par « série » de messages non lus. On n'écrit que si ce message est le premier que
 * le destinataire n'a pas encore lu dans cette conversation ; tant qu'il ne l'a pas ouverte, les suivants n'envoient rien.
 * Le contenu du message n'est jamais recopié dans l'e-mail.
 */
async function mailNewMessage(conversationId, fromUserId, toUserId, mail) {
  try {
    const { rows } = await query(
      `SELECT count(*) AS n FROM messages m
        WHERE m.conversation_id = $1 AND m.author_id = $2
          AND m.created_at > COALESCE((SELECT r.last_read_at FROM conversation_reads r
                                        WHERE r.conversation_id = $1 AND r.user_id = $3), '-infinity')`,
      [conversationId, fromUserId, toUserId]
    );
    if (Number(rows[0].n) !== 1) return;
    const pref = await query('SELECT notify_candidatures AS enabled FROM user_settings WHERE user_id = $1', [toUserId]);
    if (pref.rows.length && pref.rows[0].enabled === false) return;
    await mailUser(toUserId, mail);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notifier] e-mail de message non envoyé :', err && err.message);
  }
}

module.exports = { notifyUser, notifyAdmins, mailUser, mailNewMessage };
