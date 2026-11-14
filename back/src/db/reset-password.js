// Définit un nouveau mot de passe pour un compte et ferme toutes ses sessions.
// Le site n'envoie pas d'e-mail : c'est l'équipe qui lance cette commande sur le serveur, après avoir
// vérifié l'identité du membre qui en fait la demande.
// Usage :
//   RESET_EMAIL=membre@exemple.com RESET_PASSWORD='nouveau-mot-de-passe' npm run reset-password
const bcrypt = require('bcryptjs');
const { pool, query } = require('./pool');

async function run() {
  const email = (process.env.RESET_EMAIL || '').trim().toLowerCase();
  const password = process.env.RESET_PASSWORD || '';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('RESET_EMAIL manquant ou invalide.');
  if (password.length < 8 || password.length > 128) throw new Error('RESET_PASSWORD doit faire entre 8 et 128 caractères.');

  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows[0]) throw new Error(`Aucun compte avec l'adresse ${email}.`);

  const hash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $2, has_password = true, updated_at = now() WHERE id = $1', [rows[0].id, hash]);
  await query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
  console.log(`[reset-password] mot de passe remplacé pour ${email} ; ses sessions ouvertes sont fermées.`);
}

run()
  .catch((err) => {
    console.error(`[reset-password] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
