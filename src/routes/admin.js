const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const db = require('../lib/db');
const auth = require('../lib/auth');
const settings = require('../lib/settings');
const push = require('../lib/push');
const { logError } = require('../lib/errors');

const r = express.Router();
r.use(express.json({ limit: '32kb' }));
const OWNER = auth.requireUser(['owner']);
const ANY = auth.requireUser(['owner', 'manager']);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const wrap = fn => (req, res, next) => fn(req, res, next).catch(async e => { await logError('admin ' + req.method + ' ' + req.path, e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Грешка в сървъра.' }); });

// ---------- auth ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Твърде много опити. Опитайте след 15 минути.' } });
r.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = (await db.q('SELECT * FROM users WHERE lower(email)=lower($1)', [String(email || '').trim()])).rows[0];
  if (!u || !u.active || !(await auth.verify(String(password || ''), u.password_hash))) return bad(res, 'Грешен имейл или парола.', 401);
  auth.issue(res, u);
  res.json({ ok: true });
}));
r.post('/auth/logout', (req, res) => { auth.clear(res); res.json({ ok: true }); });
r.get('/auth/me', wrap(async (req, res) => {
  const u = await auth.load(req);
  if (!u) return bad(res, 'Необходим е вход.', 401);
  res.json({ id: u.id, email: u.email, name: u.name, role: u.role, notify: u.notify, on_duty: u.on_duty, vapid_public_key: await push.publicKey() });
}));
r.post('/auth/password', ANY, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  const u = (await db.q('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (!(await auth.verify(String(current || ''), u.password_hash))) return bad(res, 'Текущата парола е грешна.');
  if (!auth.validPassword(next)) return bad(res, 'Новата парола трябва да е поне 10 символа.');
  const upd = (await db.q('UPDATE users SET password_hash=$2, token_version=token_version+1 WHERE id=$1 RETURNING *', [u.id, await auth.hash(next)])).rows[0];
  auth.issue(res, upd);
  res.json({ ok: true });
}));

// ---------- me / push ----------
r.patch('/me', ANY, wrap(async (req, res) => {
  const { notify, on_duty } = req.body || {};
  if (typeof notify === 'boolean') await db.q('UPDATE users SET notify=$2 WHERE id=$1', [req.user.id, notify]);
  if (typeof on_duty === 'boolean') await db.q('UPDATE users SET on_duty=$2 WHERE id=$1', [req.user.id, on_duty]);
  res.json({ ok: true });
}));
r.post('/push/subscribe', ANY, wrap(async (req, res) => {
  const s = req.body && req.body.subscription;
  if (!s || !/^https:\/\//.test(s.endpoint || '') || !s.keys || !s.keys.p256dh || !s.keys.auth) return bad(res, 'Невалиден абонамент.');
  await db.q(`INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth, user_agent) VALUES ($1,$2,$3,$4,$5)
              ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, user_agent=EXCLUDED.user_agent, fail_count=0`,
    [req.user.id, s.endpoint, s.keys.p256dh, s.keys.auth, String(req.headers['user-agent'] || '').slice(0, 200)]);
  res.json({ ok: true });
}));
r.post('/push/unsubscribe', ANY, wrap(async (req, res) => {
  await db.q('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [String((req.body || {}).endpoint || ''), req.user.id]);
  res.json({ ok: true });
}));
r.post('/push/test', ANY, wrap(async (req, res) => res.json({ ok: true, delivered: await push.sendTest(req.user.id) })));
r.get('/push/devices', ANY, wrap(async (req, res) => {
  const d = await db.q('SELECT id, user_agent, created_at, last_success_at, fail_count FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(d.rows);
}));

// ---------- reviews ----------
function period(req) {
  const now = new Date();
  let from = req.query.from ? new Date(req.query.from) : null, to = req.query.to ? new Date(req.query.to) : null;
  const p = req.query.period || 'week';
  if (!from || isNaN(from)) {
    const d = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Sofia' }));
    const offset = now - d; // Sofia offset correction
    d.setHours(0, 0, 0, 0);
    const startToday = new Date(d.getTime() + offset);
    from = p === 'day' ? startToday : p === 'month' ? new Date(startToday.getTime() - 29 * 864e5) : p === 'all' ? new Date(0) : new Date(startToday.getTime() - 6 * 864e5);
  }
  if (!to || isNaN(to)) to = new Date(now.getTime() + 60000);
  else if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) to = new Date(to.getTime() + 864e5);
  return { from, to };
}
const REVIEW_COLS = `r.id, r.created_at, r.table_label, r.zone_name, r.rating, r.tags, r.comment, r.lang, r.status, r.ack_at, r.resolved_at, r.escalated_at,
  r.phone_consent, r.phone, ua.name AS ack_by_name, ur.name AS resolved_by_name,
  COALESCE((SELECT json_agg(json_build_object('name', product_name, 'vote', vote)) FROM review_products rp WHERE rp.review_id = r.id), '[]') AS products`;
r.get('/reviews', ANY, wrap(async (req, res) => {
  const { from, to } = period(req);
  const params = [from, to];
  let where = 'r.created_at >= $1 AND r.created_at < $2';
  if (req.query.status) { params.push(req.query.status); where += ` AND r.status = $${params.length}`; }
  if (req.query.rating) { params.push(Number(req.query.rating)); where += ` AND r.rating = $${params.length}`; }
  if (req.query.table) { params.push(Number(req.query.table)); where += ` AND r.table_id = $${params.length}`; }
  if (req.query.with_comment === '1') where += ` AND r.comment IS NOT NULL`;
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = await db.q(`SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users ua ON ua.id=r.ack_by LEFT JOIN users ur ON ur.id=r.resolved_by
                           WHERE ${where} ORDER BY r.created_at DESC LIMIT ${limit}`, params);
  res.json(rows.rows);
}));
r.get('/reviews/:id', ANY, wrap(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return bad(res, 'Няма такъв отзив.', 404);
  const row = await db.q(`SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users ua ON ua.id=r.ack_by LEFT JOIN users ur ON ur.id=r.resolved_by WHERE r.id=$1`, [req.params.id]);
  if (!row.rowCount) return bad(res, 'Няма такъв отзив.', 404);
  res.json(row.rows[0]);
}));
r.post('/reviews/:id/ack', ANY, wrap(async (req, res) => {
  const u = await db.q(`UPDATE reviews SET status='acknowledged', ack_by=$2, ack_at=now() WHERE id=$1 AND status='new' RETURNING id`, [req.params.id, req.user.id]);
  if (!u.rowCount) {
    const cur = await db.q('SELECT r.status, u.name FROM reviews r LEFT JOIN users u ON u.id=r.ack_by WHERE r.id=$1', [req.params.id]);
    if (!cur.rowCount) return bad(res, 'Няма такъв отзив.', 404);
    return res.status(409).json({ error: `Сигналът вече е поет${cur.rows[0].name ? ' от ' + cur.rows[0].name : ''}.` });
  }
  res.json({ ok: true });
}));
r.post('/reviews/:id/resolve', ANY, wrap(async (req, res) => {
  const u = await db.q(`UPDATE reviews SET status='resolved', resolved_by=$2, resolved_at=now(),
                        ack_by=COALESCE(ack_by,$2), ack_at=COALESCE(ack_at, now()) WHERE id=$1 AND status <> 'resolved' RETURNING id`, [req.params.id, req.user.id]);
  if (!u.rowCount) return bad(res, 'Отзивът вече е разрешен или не съществува.', 409);
  res.json({ ok: true });
}));

// ---------- stats ----------
r.get('/stats', ANY, wrap(async (req, res) => {
  const { from, to } = period(req);
  const s = await settings.all();
  const P = [from, to];
  const W = 'created_at >= $1 AND created_at < $2';
  const [tot, dist, tags, tbl, prod, trend, open, react, comments] = await Promise.all([
    db.q(`SELECT count(*)::int n, round(avg(rating)::numeric, 2)::float avg FROM reviews WHERE ${W}`, P),
    db.q(`SELECT rating, count(*)::int n FROM reviews WHERE ${W} GROUP BY rating`, P),
    db.q(`SELECT t AS tag, count(*)::int n, round(avg(rating)::numeric,2)::float avg FROM reviews, unnest(tags) t WHERE ${W} GROUP BY t ORDER BY n DESC`, P),
    db.q(`SELECT COALESCE(zone_name,'') zone, table_label label, count(*)::int n, round(avg(rating)::numeric,2)::float avg,
                 sum(CASE WHEN rating <= $3 THEN 1 ELSE 0 END)::int alerts
          FROM reviews WHERE ${W} GROUP BY zone_name, table_label ORDER BY n DESC`, [...P, s.alert_max_rating]),
    db.q(`SELECT rp.product_name name, sum(CASE WHEN vote=1 THEN 1 ELSE 0 END)::int up, sum(CASE WHEN vote=-1 THEN 1 ELSE 0 END)::int down
          FROM review_products rp JOIN reviews r ON r.id=rp.review_id WHERE r.created_at >= $1 AND r.created_at < $2
          GROUP BY rp.product_name ORDER BY (sum(CASE WHEN vote=1 THEN 1 ELSE 0 END) + sum(CASE WHEN vote=-1 THEN 1 ELSE 0 END)) DESC`, P),
    db.q(`SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Sofia'), 'YYYY-MM-DD') d, count(*)::int n, round(avg(rating)::numeric,2)::float avg
          FROM reviews WHERE ${W} GROUP BY 1 ORDER BY 1`, P),
    db.q(`SELECT count(*)::int total, sum(CASE WHEN rating <= $1 THEN 1 ELSE 0 END)::int alerts FROM reviews WHERE status='new'`, [s.alert_max_rating]),
    db.q(`SELECT round(avg(extract(epoch FROM ack_at - created_at))/60, 1)::float avg_min,
                 round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ack_at - created_at)))::numeric/60, 1)::float median_min,
                 count(*)::int acked,
                 sum(CASE WHEN ack_at - created_at <= make_interval(mins => $4) THEN 1 ELSE 0 END)::int in_target
          FROM reviews WHERE ${W} AND ack_at IS NOT NULL AND rating <= $3`, [...P, s.alert_max_rating, s.ack_target_minutes]),
    db.q(`SELECT id, created_at, rating, comment, table_label, zone_name FROM reviews WHERE ${W} AND comment IS NOT NULL ORDER BY created_at DESC LIMIT 30`, P)
  ]);
  const distribution = [1, 2, 3, 4, 5].map(k => ({ rating: k, n: (dist.rows.find(x => x.rating === k) || { n: 0 }).n }));
  const alertsInPeriod = (await db.q(`SELECT count(*)::int n FROM reviews WHERE ${W} AND rating <= $3`, [...P, s.alert_max_rating])).rows[0].n;
  res.json({
    from, to, total: tot.rows[0].n, avg: tot.rows[0].avg, distribution, tags: tags.rows, tables: tbl.rows,
    products: prod.rows, trend: trend.rows, open: open.rows[0], reaction: { ...react.rows[0], alerts: alertsInPeriod, target_min: s.ack_target_minutes },
    comments: comments.rows, alert_max_rating: s.alert_max_rating
  });
}));

// ---------- zones & tables (owner) ----------
const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const b = crypto.randomBytes(10); let s = ''; for (const x of b) s += a[x % a.length]; return s; };
r.get('/zones', ANY, wrap(async (req, res) => res.json((await db.q('SELECT * FROM zones ORDER BY sort, id')).rows)));
r.post('/zones', OWNER, wrap(async (req, res) => {
  const name = String((req.body || {}).name || '').trim(); if (!name) return bad(res, 'Въведете име на зоната.');
  res.status(201).json((await db.q('INSERT INTO zones(name, sort) VALUES ($1, COALESCE((SELECT max(sort)+1 FROM zones),0)) RETURNING *', [name])).rows[0]);
}));
r.patch('/zones/:id', OWNER, wrap(async (req, res) => {
  const { name, active, sort } = req.body || {};
  const z = await db.q('UPDATE zones SET name=COALESCE($2,name), active=COALESCE($3,active), sort=COALESCE($4,sort) WHERE id=$1 RETURNING *', [req.params.id, name ? String(name).trim() : null, typeof active === 'boolean' ? active : null, Number.isInteger(sort) ? sort : null]);
  z.rowCount ? res.json(z.rows[0]) : bad(res, 'Няма такава зона.', 404);
}));
r.delete('/zones/:id', OWNER, wrap(async (req, res) => {
  const used = await db.q('SELECT count(*)::int n FROM tables WHERE zone_id=$1', [req.params.id]);
  if (used.rows[0].n) return bad(res, 'В зоната има маси. Преместете или изтрийте масите първо.', 409);
  await db.q('DELETE FROM zones WHERE id=$1', [req.params.id]); res.json({ ok: true });
}));
r.get('/tables', ANY, wrap(async (req, res) => {
  const s = await settings.all();
  const t = await db.q(`SELECT t.*, z.name zone_name, (SELECT count(*)::int FROM reviews WHERE table_id=t.id) reviews
                        FROM tables t LEFT JOIN zones z ON z.id=t.zone_id
                        ORDER BY z.sort NULLS LAST, z.id, NULLIF(regexp_replace(t.label, '\\D', '', 'g'), '')::int NULLS LAST, t.label`);
  res.json(t.rows.map(x => ({ ...x, url: `${s.public_base_url}/r/${x.code}` })));
}));
r.post('/tables', OWNER, wrap(async (req, res) => {
  const { label, zone_id, count, start } = req.body || {};
  const z = zone_id ? Number(zone_id) : null;
  if (count) { // bulk: "add tables 1..N"
    const n = Math.min(100, Number(count)), s0 = Number(start) || 1; const out = [];
    for (let i = 0; i < n; i++) out.push((await db.q('INSERT INTO tables(zone_id,label,code) VALUES ($1,$2,$3) RETURNING *', [z, String(s0 + i), newCode()])).rows[0]);
    return res.status(201).json(out);
  }
  const l = String(label || '').trim(); if (!l) return bad(res, 'Въведете номер или име на масата.');
  res.status(201).json((await db.q('INSERT INTO tables(zone_id,label,code) VALUES ($1,$2,$3) RETURNING *', [z, l, newCode()])).rows[0]);
}));
r.patch('/tables/:id', OWNER, wrap(async (req, res) => {
  const { label, zone_id, active, regenerate } = req.body || {};
  const t = await db.q(`UPDATE tables SET label=COALESCE($2,label), zone_id=CASE WHEN $3::boolean THEN $4 ELSE zone_id END, active=COALESCE($5,active),
                        code=CASE WHEN $6::boolean THEN $7 ELSE code END WHERE id=$1 RETURNING *`,
    [req.params.id, label ? String(label).trim() : null, zone_id !== undefined, zone_id ? Number(zone_id) : null, typeof active === 'boolean' ? active : null, !!regenerate, newCode()]);
  t.rowCount ? res.json(t.rows[0]) : bad(res, 'Няма такава маса.', 404);
}));
r.delete('/tables/:id', OWNER, wrap(async (req, res) => {
  // reviews keep their table label snapshot, so statistics survive deleting a table
  await db.q('DELETE FROM tables WHERE id=$1', [req.params.id]); res.json({ ok: true });
}));
r.get('/tables/:id/qr.svg', ANY, wrap(async (req, res) => {
  const s = await settings.all();
  const t = (await db.q('SELECT code FROM tables WHERE id=$1', [req.params.id])).rows[0];
  if (!t) return bad(res, 'Няма такава маса.', 404);
  res.type('image/svg+xml').send(await QRCode.toString(`${s.public_base_url}/r/${t.code}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }));
}));

// ---------- menu (owner) ----------
const nm = b => ({ bg: String(b.name_bg || '').trim(), en: b.name_en ? String(b.name_en).trim() : null, el: b.name_el ? String(b.name_el).trim() : null });
r.get('/categories', ANY, wrap(async (req, res) => res.json((await db.q('SELECT * FROM product_categories ORDER BY sort, id')).rows)));
r.post('/categories', OWNER, wrap(async (req, res) => {
  const n = nm(req.body || {}); if (!n.bg) return bad(res, 'Въведете име на категорията.');
  res.status(201).json((await db.q('INSERT INTO product_categories(name_bg,name_en,name_el,sort) VALUES ($1,$2,$3,COALESCE((SELECT max(sort)+1 FROM product_categories),0)) RETURNING *', [n.bg, n.en, n.el])).rows[0]);
}));
r.patch('/categories/:id', OWNER, wrap(async (req, res) => {
  const b = req.body || {}; const n = nm(b);
  const c = await db.q('UPDATE product_categories SET name_bg=COALESCE(NULLIF($2,\'\'),name_bg), name_en=COALESCE($3,name_en), name_el=COALESCE($4,name_el), active=COALESCE($5,active) WHERE id=$1 RETURNING *',
    [req.params.id, n.bg, n.en, n.el, typeof b.active === 'boolean' ? b.active : null]);
  c.rowCount ? res.json(c.rows[0]) : bad(res, 'Няма такава категория.', 404);
}));
r.delete('/categories/:id', OWNER, wrap(async (req, res) => { await db.q('DELETE FROM product_categories WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));
r.get('/products', ANY, wrap(async (req, res) => res.json((await db.q(`SELECT p.*, c.name_bg cat_name,
  (SELECT sum(CASE WHEN vote=1 THEN 1 ELSE 0 END)::int FROM review_products WHERE product_id=p.id) up,
  (SELECT sum(CASE WHEN vote=-1 THEN 1 ELSE 0 END)::int FROM review_products WHERE product_id=p.id) down
  FROM products p LEFT JOIN product_categories c ON c.id=p.category_id ORDER BY c.sort NULLS LAST, c.id, p.sort, p.id`)).rows)));
r.post('/products', OWNER, wrap(async (req, res) => {
  const b = req.body || {}; const n = nm(b); if (!n.bg) return bad(res, 'Въведете име на продукта.');
  res.status(201).json((await db.q('INSERT INTO products(category_id,name_bg,name_en,name_el,is_new,sort) VALUES ($1,$2,$3,$4,$5,COALESCE((SELECT max(sort)+1 FROM products),0)) RETURNING *',
    [b.category_id ? Number(b.category_id) : null, n.bg, n.en, n.el, b.is_new !== false])).rows[0]);
}));
r.patch('/products/:id', OWNER, wrap(async (req, res) => {
  const b = req.body || {}; const n = nm(b);
  const p = await db.q(`UPDATE products SET name_bg=COALESCE(NULLIF($2,''),name_bg), name_en=COALESCE($3,name_en), name_el=COALESCE($4,name_el),
     is_new=COALESCE($5,is_new), active=COALESCE($6,active), category_id=CASE WHEN $7::boolean THEN $8 ELSE category_id END WHERE id=$1 RETURNING *`,
    [req.params.id, n.bg, n.en, n.el, typeof b.is_new === 'boolean' ? b.is_new : null, typeof b.active === 'boolean' ? b.active : null, b.category_id !== undefined, b.category_id ? Number(b.category_id) : null]);
  p.rowCount ? res.json(p.rows[0]) : bad(res, 'Няма такъв продукт.', 404);
}));
r.delete('/products/:id', OWNER, wrap(async (req, res) => { await db.q('DELETE FROM products WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---------- users (owner) ----------
r.get('/users', ANY, wrap(async (req, res) => {
  const u = await db.q(`SELECT u.id, u.email, u.name, u.role, u.active, u.notify, u.on_duty, u.created_at,
    (SELECT count(*)::int FROM push_subscriptions WHERE user_id=u.id) devices FROM users u ORDER BY u.role DESC, u.name`);
  res.json(req.user.role === 'owner' ? u.rows : u.rows.map(({ email, ...x }) => x));
}));
r.post('/users', OWNER, wrap(async (req, res) => {
  const { email, name, password, role } = req.body || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ''))) return bad(res, 'Въведете валиден имейл.');
  if (!String(name || '').trim()) return bad(res, 'Въведете име.');
  if (!auth.validPassword(password)) return bad(res, 'Паролата трябва да е поне 10 символа.');
  const rl = role === 'owner' ? 'owner' : 'manager';
  try {
    const u = await db.q('INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, active, notify, on_duty', [String(email).trim().toLowerCase(), String(name).trim(), await auth.hash(password), rl]);
    res.status(201).json(u.rows[0]);
  } catch (e) { if (e.code === '23505') return bad(res, 'Вече има потребител с този имейл.', 409); throw e; }
}));
r.patch('/users/:id', OWNER, wrap(async (req, res) => {
  const { name, active, notify, on_duty, role, password } = req.body || {};
  if (req.params.id === req.user.id && (active === false || role === 'manager')) return bad(res, 'Не можете да деактивирате или понижите себе си.');
  if (password !== undefined && !auth.validPassword(password)) return bad(res, 'Паролата трябва да е поне 10 символа.');
  const u = await db.q(`UPDATE users SET name=COALESCE($2,name), active=COALESCE($3,active), notify=COALESCE($4,notify), on_duty=COALESCE($5,on_duty),
      role=COALESCE($6,role), password_hash=COALESCE($7,password_hash),
      token_version = token_version + CASE WHEN $7::text IS NOT NULL OR $3 = false THEN 1 ELSE 0 END
      WHERE id=$1 RETURNING id, email, name, role, active, notify, on_duty`,
    [req.params.id, name ? String(name).trim() : null, typeof active === 'boolean' ? active : null, typeof notify === 'boolean' ? notify : null,
     typeof on_duty === 'boolean' ? on_duty : null, ['owner', 'manager'].includes(role) ? role : null, password ? await auth.hash(password) : null]);
  u.rowCount ? res.json(u.rows[0]) : bad(res, 'Няма такъв потребител.', 404);
}));
r.delete('/users/:id', OWNER, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return bad(res, 'Не можете да изтриете себе си.');
  await db.q('DELETE FROM users WHERE id=$1', [req.params.id]); res.json({ ok: true });
}));

// ---------- settings (owner) ----------
r.get('/settings', ANY, wrap(async (req, res) => {
  const s = await settings.all(); const out = {};
  for (const k of Object.keys(settings.DEFAULTS)) out[k] = s[k];
  res.json(out);
}));
r.put('/settings', OWNER, wrap(async (req, res) => {
  const b = req.body || {};
  for (const [k, v] of Object.entries(b)) {
    if (!(k in settings.DEFAULTS)) return bad(res, 'Непозната настройка: ' + k);
    await settings.set(k, settings.validate(k, v));
  }
  if ('public_base_url' in b && !('public_base_url_confirmed' in b)) await settings.set('public_base_url_confirmed', false);
  res.json({ ok: true });
}));
r.get('/errors', OWNER, wrap(async (req, res) => res.json((await db.q('SELECT * FROM error_log ORDER BY at DESC LIMIT 100')).rows)));

// ---------- export for BAROMETER / future integration ----------
r.get('/export/reviews.json', OWNER, wrap(async (req, res) => {
  const { from, to } = period(req);
  const rows = await db.q(`SELECT id, created_at, table_label, zone_name, rating, tags, comment, status, ack_at, resolved_at,
     COALESCE((SELECT json_agg(json_build_object('name', product_name, 'vote', vote)) FROM review_products rp WHERE rp.review_id = r.id), '[]') products
     FROM reviews r WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at`, [from, to]);
  res.json(rows.rows);
}));
module.exports = r;
