// Contenu des leçons : le site réel doit afficher le texte et les exemples (le seed les écrit dans la base).
// Régression : le seed laissait « blocks » vide, donc les leçons ne montraient que le quiz.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let srv;
const IDS = ['web-1', 'web-2', 'web-3', 'api-1', 'api-2', 'api-3', 'git-1', 'git-2', 'git-3'];

before(async () => {
  h.assertSafeDatabase();
  h.prepareDatabase();
  srv = await h.startServer(4120, { AUTH_RATE_LIMIT_MAX: '1000' });
});
after(async () => {
  srv?.stop();
  await h.cleanup();
});

describe('Contenu des leçons', () => {
  it('chaque leçon a du texte, au moins un exemple ou une astuce, et un quiz', async () => {
    const anon = new h.Client(srv.base);
    for (const id of IDS) {
      const r = await anon.get(`/lecons/${id}`);
      assert.equal(r.status, 200, id);
      const types = r.body.blocks.map((b) => b.type);
      assert.ok(r.body.blocks.length >= 4, `${id} : contenu trop court (${r.body.blocks.length} blocs)`);
      assert.ok(types.includes('p'), `${id} : pas de texte`);
      assert.ok(types.includes('code') || types.includes('try'), `${id} : pas d'exemple de code`);
      assert.ok(r.body.quiz.length >= 3, `${id} : quiz incomplet`);
      for (const b of r.body.blocks) {
        if (b.type === 'p' || b.type === 'tip') assert.ok(typeof b.text === 'string' && b.text.length > 10, `${id} : bloc ${b.type} vide`);
        if (b.type === 'code') assert.ok(b.lang && b.content, `${id} : bloc code incomplet`);
      }
    }
  });

  it('les 3 leçons web proposent un éditeur « Essayer » complet', async () => {
    const anon = new h.Client(srv.base);
    for (const id of ['web-1', 'web-2', 'web-3']) {
      const tries = (await anon.get(`/lecons/${id}`)).body.blocks.filter((b) => b.type === 'try');
      assert.ok(tries.length >= 1, `${id} : pas d'éditeur`);
      for (const t of tries) {
        assert.equal(typeof t.title, 'string');
        for (const k of ['html', 'css', 'js']) assert.equal(typeof t[k], 'string', `${id} : champ ${k}`);
        assert.ok(t.html.trim().length > 0);
      }
    }
  });

  it('relancer le seed rétablit le contenu des leçons', async () => {
    const { query } = require('../src/db/pool');
    await query("UPDATE lessons SET blocks = '[]'::jsonb WHERE id = 'web-1'");
    require('node:child_process').execFileSync('node', ['src/db/seed.js'], { cwd: require('node:path').join(__dirname, '..'), env: process.env, stdio: 'pipe' });
    const r = await new h.Client(srv.base).get('/lecons/web-1');
    assert.ok(r.body.blocks.length >= 4);
  });
});
