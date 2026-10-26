// Crée (ou promeut) un compte administrateur. Aucune route de l'API ne le permet, volontairement.
// Usage :
//   ADMIN_EMAIL=equipe@exemple.com ADMIN_PASSWORD='un-mot-de-passe-solide' ADMIN_NAME='Équipe Gamelia' npm run create-admin
const bcrypt = require('bcryptjs');
const { pool, query } = require('./pool');

async function run() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Équipe Gamelia').trim();
  const country = (process.env.ADMIN_COUNTRY || 'Sénégal').trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL manquant ou invalide.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD doit faire au moins 12 caractères.');

  const hash = await bcrypt.hash(password, 12);
  const existing = await query('SELECT id, role FROM users WHERE email = $1', [email]);

  if (existing.rows[0]) {
    await query("UPDATE users SET role = 'admin', password_hash = $2, recruiter_status = NULL, updated_at = now() WHERE id = $1", [existing.rows[0].id, hash]);
    console.log(`[create-admin] compte existant promu administrateur : ${email}`);
  } else {
    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'admin';
    let username = base;
    for (let i = 2; (await query('SELECT 1 FROM users WHERE username = $1', [username])).rows.length; i++) username = `${base}${i}`;
    const { rows } = await query(
      "INSERT INTO users (username, name, email, password_hash, role, country) VALUES ($1,$2,$3,$4,'admin',$5) RETURNING id",
      [username, name, email, hash, country]
    );
    await query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [rows[0].id]);
    console.log(`[create-admin] administrateur créé : ${email} (identifiant ${username})`);
  }
}

run()
  .catch((err) => {
    console.error(`[create-admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
