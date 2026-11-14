// Pool de connexions PostgreSQL unique, partagé par toute l'app.
const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Erreur sur une connexion inactive du pool (ex. coupure réseau) : ne doit
  // jamais planter le process, juste être loguée.
  // eslint-disable-next-line no-console
  console.error('[db] Erreur inattendue sur une connexion inactive du pool', err);
});

// Helper de requête simple. Pour les transactions, utiliser pool.connect()
// directement (voir services/points.js pour un exemple avec BEGIN/COMMIT).
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
