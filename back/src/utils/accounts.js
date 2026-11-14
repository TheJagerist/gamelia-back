// Fonctions partagées par l'inscription classique (routes/auth.js) et la connexion avec GitHub (routes/github-oauth.js).
const { query } = require('../db/pool');
const { SESSION_TTL_MS } = require('./cookies');

async function createSession(userId, userAgent) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { rows } = await query(
    `INSERT INTO sessions (user_id, user_agent, expires_at) VALUES ($1, $2, $3)
     RETURNING id, csrf_token`,
    [userId, userAgent || null, expiresAt]
  );
  return rows[0];
}

async function generateUniqueUsername(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30) || 'membre';

  let candidate = base;
  let suffix = 1;
  // Boucle bornée : en pratique converge en 1-2 tours, mais on évite toute
  // boucle infinie si la base est très générique.
  while (suffix < 1000) {
    const { rows } = await query('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  throw new Error('Impossible de générer un nom d’utilisateur unique.');
}

module.exports = { createSession, generateUniqueUsername };
