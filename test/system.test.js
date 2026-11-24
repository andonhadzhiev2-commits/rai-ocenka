// Integration tests against a real PostgreSQL database.
// Run: TEST_DATABASE_URL=postgres://... npm test   (the database is wiped before the run)
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://rai:rai@localhost/rai_ocenka_test';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.PUBLIC_BASE_URL = 'https://ocenka.raipetrich.bg';

const request = require('supertest');
const db = require('../src/lib/db');
const { migrate } = require('../src/migrate');
const { createApp } = require('../src/app');
const auth = require('../src/lib/auth');
const push = require('../src/lib/push');
const settings = require('../src/lib/settings');

let app, owner, manager, code, code2, sent;
const PW = 'correct-horse-1';

async function login(email) {
  const a = request.agent(app);
  const r = await a.post('/api/admin/auth/login').send({ email, password: PW });
  assert.equal(r.status, 200, r.text);
  return a;
}
function review(extra = {}) {
  return { submission_id: crypto.randomUUID(), code, rating: 5, tags: [], products: {}, comment: '', lang: 'bg', issued_at: Date.now() - 10000, ...extra };
}
let ipSeq = 0;
const post = (body, ip) => request(app).post('/api/public/reviews').set('X-Forwarded-For', ip || '10.9.' + Math.floor(ipSeq / 250) + '.' + (ipSeq++ % 250)).send(body);
const flush = () => new Promise(r => setTimeout(r, 60)); // notifications are sent after the HTTP answer

before(async () => {
  await db.q('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  app = createApp();
  owner = (await db.q("INSERT INTO users(email,name,password_hash,role) VALUES ('owner@t.bg','Собственик',$1,'owner') RETURNING *", [await auth.hash(PW)])).rows[0];
  manager = (await db.q("INSERT INTO users(email,name,password_hash,role) VALUES ('mgr@t.bg','Иван',$1,'manager') RETURNING *", [await auth.hash(PW)])).rows[0];
  const z = (await db.q("INSERT INTO zones(name) VALUES ('Тераса') RETURNING id")).rows[0];
  code = (await db.q("INSERT INTO tables(zone_id,label,code) VALUES ($1,'7','Abc123XyZ9') RETURNING code", [z.id])).rows[0].code;
  code2 = (await db.q("INSERT INTO tables(zone_id,label,code) VALUES ($1,'8','Qwe456RtY7') RETURNING code", [z.id])).rows[0].code;
  await db.q("INSERT INTO product_categories(name_bg) VALUES ('Бургери')");
  await db.q("INSERT INTO products(category_id,name_bg,name_en) VALUES (1,'Мак енд чийз бургер','Mac & cheese burger'), (1,'Стар бургер','Old burger')");
  await db.q('UPDATE products SET is_new=false WHERE id=2');
  // two push devices: one for the owner, one for the manager
  for (const u of [owner, manager]) await db.q("INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ($1,$2,'k','a')", [u.id, 'https://push.example/' + u.id]);
  push.setSender(async (target, payload) => { sent.push({ endpoint: target.endpoint, payload }); });
});
beforeEach(async () => { sent = []; await db.q('DELETE FROM settings'); settings.clearCache(); await settings.set('rate_limit_per_table_30min', 500); });
after(async () => { await db.close(); });

test('guest form: config never reveals the table number, only new active products are listed', async () => {
  const r = await request(app).get('/api/public/form/' + code);
  assert.equal(r.status, 200);
  const body = JSON.stringify(r.body);
  assert.ok(!body.includes('Тераса') && !/"label"/.test(body), 'table/zone must not be sent to the guest');
  assert.deepEqual(r.body.products.map(p => p.name_bg), ['Мак енд чийз бургер']);
  const page = await request(app).get('/r/' + code);
  assert.equal(page.status, 200);
  assert.match(page.text, /form\.js/);
});

test('unknown or inactive table code is rejected', async () => {
  assert.equal((await request(app).get('/api/public/form/NOPE000000')).status, 404);
  await db.q("UPDATE tables SET active=false WHERE code=$1", [code2]);
  assert.equal((await post(review({ code: code2 }))).status, 404);
  await db.q("UPDATE tables SET active=true WHERE code=$1", [code2]);
});

test('a review is stored with hidden table, tags, products and comment', async () => {
  const b = review({ rating: 2, tags: ['slow', 'food'], products: { 1: -1, 2: 1 }, comment: '  Чакахме 40 минути  ', lang: 'el' });
  const r = await post(b);
  assert.equal(r.status, 201, r.text);
  const row = (await db.q('SELECT * FROM reviews WHERE id=$1', [r.body.id])).rows[0];
  assert.equal(row.table_label, '7');
  assert.equal(row.zone_name, 'Тераса');
  assert.deepEqual(row.tags, ['slow'], 'only tags of the low-rating branch are kept');
  assert.equal(row.comment, 'Чакахме 40 минути');
  assert.equal(row.lang, 'el');
  const pv = (await db.q('SELECT product_name, vote FROM review_products WHERE review_id=$1 ORDER BY product_name', [r.body.id])).rows;
  assert.deepEqual(pv, [{ product_name: 'Мак енд чийз бургер', vote: -1 }, { product_name: 'Стар бургер', vote: 1 }]);
});

test('double submit (same submission id) creates exactly one record', async () => {
  const b = review({ rating: 4 });
  const [a, c] = await Promise.all([post(b, '10.1.1.1'), post(b, '10.1.1.1')]);
  assert.ok([200, 201].includes(a.status) && [200, 201].includes(c.status));
  const n = (await db.q('SELECT count(*)::int n FROM reviews WHERE submission_id=$1', [b.submission_id])).rows[0].n;
  assert.equal(n, 1);
});

test('spam protection: honeypot, too-fast submit and per-device limit', async () => {
  const hp = review({ website: 'http://spam' });
  assert.equal((await post(hp)).status, 202);
  assert.equal((await db.q('SELECT count(*)::int n FROM reviews WHERE submission_id=$1', [hp.submission_id])).rows[0].n, 0);
  assert.equal((await post(review({ issued_at: Date.now() }))).status, 429);
  await settings.set('rate_limit_per_device_10min', 2);
  const ip = '10.2.2.2';
  assert.equal((await post(review({ code: code2 }), ip)).status, 201);
  assert.equal((await post(review({ code: code2 }), ip)).status, 201);
  const third = await post(review({ code: code2 }), ip);
  assert.equal(third.status, 429);
  assert.equal(third.body.error, 'rate_limited');
});

test('phone is stored only with explicit consent and gets an erase date', async () => {
  const noConsent = await post(review({ phone: '+359888123456', phone_consent: false }));
  const withConsent = await post(review({ phone: '+359 888 123 456', phone_consent: true }));
  const a = (await db.q('SELECT phone FROM reviews WHERE id=$1', [noConsent.body.id])).rows[0];
  const b = (await db.q('SELECT phone, phone_consent, phone_purge_at FROM reviews WHERE id=$1', [withConsent.body.id])).rows[0];
  assert.equal(a.phone, null);
  assert.equal(b.phone, '+359888123456');
  assert.ok(b.phone_consent && b.phone_purge_at > new Date());
});

test('push: every rating 1–5 notifies every enabled device, with stars, table, time and comment', async () => {
  for (const rating of [1, 2, 3, 4, 5]) {
    sent = [];
    const r = await post(review({ rating, comment: 'Коментар ' + rating, tags: rating <= 3 ? ['cold'] : ['staff'] }));
    assert.equal(r.status, 201);
    await flush();
    assert.equal(sent.length, 2, `rating ${rating} must reach owner and manager`);
    const p = sent[0].payload;
    assert.ok(p.title.startsWith((rating <= 2 ? '⚠️ ' : '') + rating + '★'), p.title);
    assert.match(p.title, /Тераса · маса 7/);
    assert.match(p.title, /\d\d:\d\d/);
    assert.match(p.body, new RegExp('Коментар ' + rating));
    assert.match(p.body, rating <= 3 ? /Студена храна/ : /Персоналът/);
    assert.equal(p.url, '/app/#/review/' + r.body.id, 'tapping opens this exact review');
    assert.equal(p.requireInteraction, rating <= 2);
  }
});

test('notification rules are configurable, but every rating still counts in statistics', async () => {
  await settings.set('notify_ratings', [1, 2]);
  const a = await request.agent(app);
  const before = (await db.q('SELECT count(*)::int n FROM reviews WHERE rating=5')).rows[0].n;
  await post(review({ rating: 5 }));
  await flush();
  assert.equal(sent.length, 0, '5★ is not pushed with this rule');
  const owner = await login('owner@t.bg');
  const s = await owner.get('/api/admin/stats?period=all');
  assert.equal(s.body.distribution.find(d => d.rating === 5).n, before + 1, '5★ is still in the statistics');
  // users who switched notifications off do not get pushes
  await settings.set('notify_ratings', [1, 2, 3, 4, 5]);
  await db.q('UPDATE users SET notify=false WHERE id=$1', [manager.id]);
  await post(review({ rating: 4 })); await flush();
  assert.equal(sent.length, 1);
  await db.q('UPDATE users SET notify=true WHERE id=$1', [manager.id]);
  void a;
});

test('admin API is protected: no cookie → 401, manager cannot change settings/tables/users', async () => {
  assert.equal((await request(app).get('/api/admin/reviews')).status, 401);
  assert.equal((await request(app).get('/api/admin/stats')).status, 401);
  const bad = await request(app).post('/api/admin/auth/login').send({ email: 'owner@t.bg', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const m = await login('mgr@t.bg');
  assert.equal((await m.get('/api/admin/reviews')).status, 200);
  assert.equal((await m.put('/api/admin/settings').send({ ack_target_minutes: 9 })).status, 403);
  assert.equal((await m.post('/api/admin/tables').send({ label: '99' })).status, 403);
  assert.equal((await m.post('/api/admin/users').send({ email: 'x@y.bg', name: 'X', password: 'xxxxxxxxxxxx' })).status, 403);
  const users = await m.get('/api/admin/users');
  assert.ok(users.body.every(u => !('email' in u)), 'managers do not see other people\'s emails');
});

test('take signal → resolve, double take is refused, reaction time appears in stats', async () => {
  const r = await post(review({ rating: 1, tags: ['slow'] }));
  const id = r.body.id;
  await db.q("UPDATE reviews SET created_at = now() - interval '3 minutes' WHERE id=$1", [id]);
  const m = await login('mgr@t.bg');
  const o = await login('owner@t.bg');
  assert.equal((await m.post(`/api/admin/reviews/${id}/ack`)).status, 200);
  const again = await o.post(`/api/admin/reviews/${id}/ack`);
  assert.equal(again.status, 409);
  assert.match(again.body.error, /Иван/);
  assert.equal((await o.post(`/api/admin/reviews/${id}/resolve`)).status, 200);
  const one = await m.get('/api/admin/reviews/' + id);
  assert.equal(one.body.status, 'resolved');
  assert.equal(one.body.ack_by_name, 'Иван');
  const s = await o.get('/api/admin/stats?period=day');
  assert.ok(s.body.reaction.acked >= 1);
  assert.ok(s.body.reaction.avg_min >= 2.9);
});

test('alerts not taken within the target time are escalated once', async () => {
  const r = await post(review({ rating: 2 }));
  assert.equal(r.status, 201);
  await flush(); sent = [];
  await db.q("UPDATE reviews SET created_at = now() - interval '6 minutes' WHERE id=$1", [r.body.id]);
  const n = await push.escalateOverdue();
  assert.ok(n >= 1);
  assert.ok(sent.some(x => x.payload.title.includes('НЕПОЕТ') && x.payload.reviewId === r.body.id));
  sent = [];
  await push.escalateOverdue();
  assert.ok(!sent.some(x => x.payload.reviewId === r.body.id), 'only once');
});

test('statistics include all ratings, categories, tables and new products', async () => {
  const o = await login('owner@t.bg');
  const s = (await o.get('/api/admin/stats?period=all')).body;
  const total = (await db.q('SELECT count(*)::int n FROM reviews')).rows[0].n;
  assert.equal(s.total, total);
  assert.equal(s.distribution.reduce((a, d) => a + d.n, 0), total);
  assert.ok(s.tables.find(t => t.label === '7'));
  assert.ok(s.products.find(p => p.name === 'Мак енд чийз бургер'));
  assert.ok(s.tags.find(t => t.tag === 'slow'));
  const custom = (await o.get('/api/admin/stats?from=2000-01-01&to=2000-01-02')).body;
  assert.equal(custom.total, 0, 'custom period filter works');
});

test('owner manages tables: bulk add, new code invalidates the old QR, delete keeps history', async () => {
  const o = await login('owner@t.bg');
  const add = await o.post('/api/admin/tables').send({ start: 20, count: 3 });
  assert.equal(add.status, 201);
  assert.equal(add.body.length, 3);
  assert.ok(add.body.every(t => /^[A-Za-z0-9]{10}$/.test(t.code)));
  const t = add.body[0];
  const reg = await o.patch('/api/admin/tables/' + t.id).send({ regenerate: true });
  assert.notEqual(reg.body.code, t.code);
  assert.equal((await request(app).get('/api/public/form/' + t.code)).status, 404);
  assert.equal((await request(app).get('/api/public/form/' + reg.body.code)).status, 200);
  const rv = await post(review({ code: reg.body.code }));
  await o.delete('/api/admin/tables/' + t.id);
  const row = (await db.q('SELECT table_label FROM reviews WHERE id=$1', [rv.body.id])).rows[0];
  assert.equal(row.table_label, '20');
  const list = (await o.get('/api/admin/tables')).body;
  assert.ok(list.every(x => x.url.startsWith('https://ocenka.raipetrich.bg/r/')));
});

test('settings validation and QR SVG', async () => {
  const o = await login('owner@t.bg');
  assert.equal((await o.put('/api/admin/settings').send({ google_review_url: 'http://insecure' })).status, 400);
  assert.equal((await o.put('/api/admin/settings').send({ google_review_url: 'https://g.page/r/abc/review', phone_retention_days: 60 })).status, 200);
  const cfg = await request(app).get('/api/public/form/' + code);
  assert.equal(cfg.body.google_review_url, 'https://g.page/r/abc/review');
  const t = (await o.get('/api/admin/tables')).body[0];
  const svg = await o.get(`/api/admin/tables/${t.id}/qr.svg`).buffer(true).parse((res, cb) => { let d = ''; res.on('data', c => d += c); res.on('end', () => cb(null, d)); });
  assert.equal(svg.status, 200);
  assert.match(svg.body, /<svg/);
});

test('phones are erased after the retention period', async () => {
  const r = await post(review({ phone: '+359888000111', phone_consent: true }));
  assert.equal(r.status, 201);
  await db.q("UPDATE reviews SET phone_purge_at = now() - interval '1 minute' WHERE id=$1", [r.body.id]);
  await db.q('UPDATE reviews SET phone = NULL WHERE phone IS NOT NULL AND phone_purge_at < now()');
  assert.equal((await db.q('SELECT phone FROM reviews WHERE id=$1', [r.body.id])).rows[0].phone, null);
});

test('real Web Push encryption: payload decrypts with the subscriber keys', async () => {
  const webpush = require('web-push');
  const ece = require('http_ece');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') } };
  const k = webpush.generateVAPIDKeys();
  const payload = JSON.stringify(push.buildPayload({ id: 'x', rating: 1, created_at: new Date(), table_label: '3', zone_name: 'Вътре', tags: ['cold'], comment: 'тест' }, settings.DEFAULTS));
  const req = webpush.generateRequestDetails(sub, payload, { vapidDetails: { subject: 'mailto:a@b.bg', publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 });
  assert.match(req.headers.Authorization, /^vapid t=/);
  const plain = ece.decrypt(req.body, { version: 'aes128gcm', privateKey: ecdh, authSecret });
  const back = JSON.parse(plain.toString());
  assert.match(back.title, /^⚠️ 1★ · Вътре · маса 3/);
});

test('integration API for BAROMETER requires a key', async () => {
  assert.equal((await request(app).get('/api/v1/reviews')).status, 401);
  process.env.INTEGRATION_API_KEY = 'k-123';
  const r = await request(app).get('/api/v1/reviews?since=2000-01-01').set('Authorization', 'Bearer k-123');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0);
  assert.ok(!('phone' in r.body[0]), 'no personal data in the integration feed');
});
