// Notifications de l'utilisateur connecté.
const express = require('express');
const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT id, kind, text, href, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map((n) => ({ id: n.id, kind: n.kind, text: n.text, href: n.href, read: n.read, date: n.created_at })));
  })
);

router.get(
  '/non-lues',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT count(*) FROM notifications WHERE user_id = $1 AND read = false', [req.user.id]);
    res.json({ count: Number(rows[0].count) });
  })
);

router.post(
  '/tout-lu',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user.id]);
    res.status(204).end();
  })
);

module.exports = router;
