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
  async req(method, url, body, { csrf = true, headers = {}, redirect = 'follow' } = {}) {
    const h = { Accept: 'application/json', ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const token = this.cookies.get('gamelia_csrf');
    if (csrf && token && method !== 'GET') h['X-CSRF-Token'] = token;
    const res = await fetch(this.base + url, { method, headers: h, redirect, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
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
  const res = await c.post('/auth/inscription', { role, name: name || `Test ${unique('u')}`, email, password: PASSWORD, country, acceptTerms: true, ...(company ? { company } : {}) });
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

// Faux GitHub pour les tests : api.github.com (GET /users/:login, /user, /user/emails) et github.com
// (POST /login/oauth/access_token). Passer son URL au serveur de test via GITHUB_API_URL et GITHUB_OAUTH_URL.
//   bios : Map(login en minuscules -> bio), pour la vérification par code dans la bio.
//   grant({ id, login, name, emails }) : prépare un compte GitHub et renvoie le « code » que GitHub donnerait au retour.
const OAUTH_CLIENT = { id: 'test-client-id', secret: 'test-client-secret' };
async function startFakeGithub(port = 0) {
  const http = require('node:http');
  const bios = new Map();
  const codes = new Map(); // code -> profil
  const tokens = new Map(); // jeton -> profil
  let seq = 0;
  let next = null; // profil approuvé à la prochaine autorisation (null = l'utilisateur refuse)
  const grant = (profile) => {
    const code = `code_${++seq}`;
    codes.set(code, { name: '', emails: [], ...profile });
    return code;
  };
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const send = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && req.url === '/login/oauth/access_token') {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        let b = {};
        try {
          b = JSON.parse(raw);
        } catch {
          /* corps invalide */
        }
        const profile = codes.get(b.code);
        if (b.client_id !== OAUTH_CLIENT.id || b.client_secret !== OAUTH_CLIENT.secret || !profile) return send(200, { error: 'bad_verification_code' });
        codes.delete(b.code); // un code ne sert qu'une fois
        const token = `gho_test_${++seq}`;
        tokens.set(token, profile);
        send(200, { access_token: token, token_type: 'bearer', scope: 'read:user,user:email' });
      });
      return;
    }
    // Page d'autorisation de github.com : approuve tout de suite avec le compte préparé par approveNext() (ou refuse).
    if (req.method === 'GET' && req.url.startsWith('/login/oauth/authorize')) {
      const q = new URL(req.url, 'http://x').searchParams;
      const back = new URL(q.get('redirect_uri') || 'http://localhost/');
      if (q.get('client_id') !== OAUTH_CLIENT.id) {
        res.statusCode = 404;
        return res.end('{"message":"client_id inconnu"}');
      }
      if (!next) back.searchParams.set('error', 'access_denied');
      else back.searchParams.set('code', grant(next));
      back.searchParams.set('state', q.get('state') || '');
      res.statusCode = 302;
      res.setHeader('Location', back.toString());
      return res.end();
    }
    // Commande de test : POST /__approve-next avec le profil à utiliser pour la prochaine autorisation.
    if (req.method === 'POST' && req.url === '/__approve-next') {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        next = raw ? JSON.parse(raw) : null;
        send(200, { ok: true });
      });
      return;
    }
    const auth = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (req.url === '/user' || req.url === '/user/emails') {
      const profile = auth && tokens.get(auth[1]);
      if (!profile) return send(401, { message: 'Bad credentials' });
      return send(200, req.url === '/user' ? { id: profile.id, login: profile.login, name: profile.name } : profile.emails);
    }
    const m = /^\/users\/([^/]+)$/.exec(req.url);
    const login = m && decodeURIComponent(m[1]).toLowerCase();
    if (!login || !bios.has(login)) return send(404, { message: 'Not Found' });
    send(200, { login, bio: bios.get(login) });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}`, bios, grant, approveNext: (p) => (next = p), stop: () => server.close() };
}

// Faux Google : joue le rôle de accounts.google.com (autorisation), oauth2.googleapis.com (jeton) et openidconnect (profil).
//   grant({ sub, email, email_verified, name }) : prépare un compte Google et renvoie le « code » reçu au retour.
//   approveNext(profil | null) : compte approuvé à la prochaine autorisation (null = le membre refuse).
async function startFakeGoogle(port = 0) {
  const http = require('node:http');
  const codes = new Map();
  const tokens = new Map();
  let seq = 0;
  let next = null;
  const grant = (profile) => {
    const code = `gcode_${++seq}`;
    codes.set(code, { name: '', email_verified: true, ...profile });
    return code;
  };
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const send = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && req.url === '/token') {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        const b = Object.fromEntries(new URLSearchParams(raw));
        const profile = codes.get(b.code);
        if (b.client_id !== OAUTH_CLIENT.id || b.client_secret !== OAUTH_CLIENT.secret) return send(401, { error: 'invalid_client' });
        if (b.grant_type !== 'authorization_code' || !b.redirect_uri || !profile) return send(400, { error: 'invalid_grant' });
        codes.delete(b.code); // un code ne sert qu'une fois
        const token = `ya29.test_${++seq}`;
        tokens.set(token, profile);
        send(200, { access_token: token, token_type: 'Bearer', expires_in: 3599, scope: 'openid email profile' });
      });
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/authorize')) {
      const q = new URL(req.url, 'http://x').searchParams;
      const back = new URL(q.get('redirect_uri') || 'http://localhost/');
      if (q.get('client_id') !== OAUTH_CLIENT.id) {
        res.statusCode = 400;
        return res.end('{"error":"invalid_client"}');
      }
      if (!next) back.searchParams.set('error', 'access_denied');
      else back.searchParams.set('code', grant(next));
      back.searchParams.set('state', q.get('state') || '');
      res.statusCode = 302;
      res.setHeader('Location', back.toString());
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/__approve-next') {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        next = raw ? JSON.parse(raw) : null;
        send(200, { ok: true });
      });
      return;
    }
    if (req.url === '/userinfo') {
      const auth = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      const profile = auth && tokens.get(auth[1]);
      if (!profile) return send(401, { error: 'invalid_token' });
      return send(200, profile);
    }
    send(404, { error: 'not_found' });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}`, grant, approveNext: (p) => (next = p), stop: () => server.close() };
}

// Parcours complet de vérification GitHub pour un client connecté : demande du code, code placé dans la bio, vérification.
async function verifyGithub(client, github, username = unique('gh').replace(/[^a-z0-9]/gi, '')) {
  const code = (await client.post('/moi/github/code', { username })).body.code;
  github.bios.set(username.toLowerCase(), `Développeur. ${code}`);
  return client.post('/moi/github/verification');
}


// Faux serveur SMTP : accepte les e-mails sur un port local et les garde en mémoire pour les tests.
// mode : 'ok' (défaut) | 'reject' (550, panne définitive) | 'flaky' (451 au premier essai, panne passagère, puis ok).
async function startFakeSmtp() {
  const net = require('node:net');
  const messages = [];
  let mode = 'ok';
  let flakyDone = false;

  // RFC 2047 : l'espace entre deux mots encodés voisins n'en fait pas partie.
  const decodeWord = (w) =>
    w.replace(/(\?=)\s+(=\?UTF-8\?)/gi, '$1$2').replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=/gi, (_, enc, data) =>
      enc.toUpperCase() === 'B'
        ? Buffer.from(data, 'base64').toString('utf8')
        : Buffer.from(data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')
    );
  const decodeBody = (enc, body) => {
    if (/base64/i.test(enc)) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (/quoted-printable/i.test(enc)) {
      const bytes = body
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, 'latin1').toString('utf8');
    }
    return body;
  };
  const splitHeaders = (raw) => {
    const i = raw.indexOf('\r\n\r\n');
    const head = raw.slice(0, i).replace(/\r\n[ \t]+/g, ' ');
    const headers = {};
    for (const line of head.split('\r\n')) {
      const j = line.indexOf(':');
      if (j > 0) headers[line.slice(0, j).toLowerCase()] = line.slice(j + 1).trim();
    }
    return { headers, body: raw.slice(i + 4) };
  };
  function parse(raw) {
    const { headers, body } = splitHeaders(raw);
    const out = { raw, headers, subject: decodeWord(headers.subject || ''), to: headers.to, from: headers.from, replyTo: headers['reply-to'], text: '', html: '' };
    const boundary = /boundary="?([^";]+)"?/i.exec(headers['content-type'] || '')?.[1];
    const parts = boundary ? body.split('--' + boundary).slice(1, -1) : [raw];
    for (const part of parts) {
      const p = boundary ? splitHeaders(part.replace(/^\r\n/, '')) : { headers, body };
      const type = p.headers['content-type'] || '';
      const decoded = decodeBody(p.headers['content-transfer-encoding'] || '', p.body);
      if (/text\/plain/i.test(type)) out.text = decoded;
      else if (/text\/html/i.test(type)) out.html = decoded;
    }
    return out;
  }

  const server = net.createServer((sock) => {
    let buf = '';
    let inData = false;
    let data = '';
    sock.write('220 fake-smtp ready\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          messages.push(parse(data.replace(/\r\n\.\./g, '\r\n.')));
          sock.write('250 queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl === -1) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') sock.write('250-fake-smtp\r\n250 8BITMIME\r\n');
        else if (cmd === 'HELO') sock.write('250 fake-smtp\r\n');
        else if (cmd === 'MAIL') {
          if (mode === 'flaky' && !flakyDone) {
            flakyDone = true;
            sock.write('451 4.3.0 Try again later\r\n');
          } else sock.write('250 OK\r\n');
        } else if (cmd === 'RCPT') sock.write(mode === 'reject' ? '550 5.1.1 Mailbox unavailable\r\n' : '250 OK\r\n');
        else if (cmd === 'DATA') {
          inData = true;
          sock.write('354 Go ahead\r\n');
        } else if (cmd === 'RSET') sock.write('250 OK\r\n');
        else if (cmd === 'QUIT') {
          sock.write('221 Bye\r\n');
          sock.end();
        } else sock.write('250 OK\r\n');
      }
    });
    sock.on('error', () => {});
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: server.address().port,
    messages,
    setMode: (m) => {
      mode = m;
      flakyDone = false;
    },
    clear: () => (messages.length = 0),
    // Attend qu'un e-mail adressé à `to` arrive (l'envoi se fait en arrière-plan).
    async waitFor(to, ms = 5000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const m = messages.find((x) => (x.to || '').toLowerCase().includes(to.toLowerCase()));
        if (m) return m;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    },
    stop: () => server.close(),
  };
}

module.exports = { OAUTH_CLIENT, assertSafeDatabase, prepareDatabase, startServer, startFakeGithub, startFakeGoogle, startFakeSmtp, verifyGithub, Client, register, createAdmin, cleanup, PASSWORD, TEST_DOMAIN };
