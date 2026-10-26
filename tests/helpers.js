// Outils des tests d'intégration : démarrage du serveur, client HTTP avec cookies, comptes de test.
// Les tests utilisent une VRAIE base PostgreSQL (pas de mock) : c'est ce qui valide les contraintes SQL.
require('dotenv').config();
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');
const TEST_DOMAIN = '@test.gamelia';
const PASSWORD = 'MotDePasse-Test1';

// Garde-fou : les tests créent et suppriment des comptes. Ils ne doivent jamais tourner sur la base de production.
function assertSafeDatabase() {
  const url = process.env.DATABASE_URL || '';
  const dbName = url.split('/').pop().split('?')[0];
  if (process.env.NODE_ENV === 'production' || (!/test/i.test(dbName) && process.env.ALLOW_TEST_ON_ANY_DB !== '1')) {
    throw new Error(
      `Les tests refusent de tourner sur la base « ${dbName} ». Utilisez une base dédiée dont le nom contient "test" ` +
        '(ex. DATABASE_URL=postgres://…/gamelia_test), puis relancez `npm run migrate && npm run seed` dessus.'
    );
  }
}

function prepareDatabase() {
  execFileSync('node', ['src/db/migrate.js'], { cwd: ROOT, stdio: 'pipe', env: process.env });
  execFileSync('node', ['src/db/seed.js'], { cwd: ROOT, stdio: 'pipe', env: process.env });
}

async function startServer(port, extraEnv = {}) {
  const child = spawn('node', ['src/server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${base}/sante`);
      if (r.ok) return { base, stop: () => child.kill() };
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`Le serveur de test n'a pas démarré :\n${log}`);
}

// Client HTTP qui garde les cookies (session + CSRF) comme un navigateur, et envoie X-CSRF-Token
// sur les requêtes non-GET exactement comme lib/api/http.ts du front.
class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }
  async req(method, url, body, { csrf = true, headers = {} } = {}) {
    const h = { Accept: 'application/json', ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const token = this.cookies.get('gamelia_csrf');
    if (csrf && token && method !== 'GET') h['X-CSRF-Token'] = token;
    const res = await fetch(this.base + url, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split('; ');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      const expired = attrs.some((a) => /^expires=/i.test(a) && new Date(a.slice(8)) < new Date()) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, body: data, headers: res.headers };
  }
  get(url, opts) { return this.req('GET', url, undefined, opts); }
  post(url, body = {}, opts) { return this.req('POST', url, body, opts); }
  patch(url, body = {}, opts) { return this.req('PATCH', url, body, opts); }
  del(url, body, opts) { return this.req('DELETE', url, body, opts); }
}

let counter = 0;
const unique = (label) => `${label}-${Date.now().toString(36)}-${++counter}`;

// Crée un compte via l'API (développeur ou recruteur) et renvoie un client connecté (sauf recruteur non validé).
async function register(base, { role = 'developpeur', name, country = 'Sénégal', company } = {}) {
  const c = new Client(base);
  const email = `${unique(role.slice(0, 3))}${TEST_DOMAIN}`;
  const res = await c.post('/auth/inscription', { role, name: name || `Test ${unique('u')}`, email, password: PASSWORD, country, ...(company ? { company } : {}) });
  return { client: c, email, res, user: res.body };
}

// Un admin ne peut pas être créé via l'API : insertion directe, comme le fait `npm run create-admin`.
async function createAdmin(base) {
  const { query } = require('../src/db/pool');
  const email = `${unique('adm')}${TEST_DOMAIN}`;
  const hash = await bcrypt.hash(PASSWORD, 4);
  const { rows } = await query(
    "INSERT INTO users (username, name, email, password_hash, role, country) VALUES ($1,$2,$3,$4,'admin','Sénégal') RETURNING id",
    [unique('admin'), 'Admin Test', email, hash]
  );
  await query('INSERT INTO user_settings (user_id) VALUES ($1)', [rows[0].id]);
  const c = new Client(base);
  const res = await c.post('/auth/connexion', { email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Connexion admin impossible : ${JSON.stringify(res.body)}`);
  return c;
}

async function cleanup() {
  const { query, pool } = require('../src/db/pool');
  await query(`DELETE FROM users WHERE email LIKE '%${TEST_DOMAIN}'`); // ON DELETE CASCADE nettoie tout le reste
  await pool.end();
}

module.exports = { assertSafeDatabase, prepareDatabase, startServer, Client, register, createAdmin, cleanup, PASSWORD, TEST_DOMAIN };
