const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('../lib/db');
const settings = require('../lib/settings');
const push = require('../lib/push');
const { logError } = require('../lib/errors');

const router = express.Router();
const LOW_TAGS = ['slow', 'cold', 'wrong', 'price', 'clean', 'noise', 'quality', 'attitude'];
const DETAIL_TAGS = {
  slow: ['slow_order', 'slow_food', 'slow_drinks', 'slow_bill'],
  cold: ['cold_arrived'],
  wrong: ['wrong_item', 'wrong_missing'],
  price: ['price_food', 'price_drinks', 'price_value'],
  clean: ['clean_table', 'clean_dishes', 'clean_wc', 'clean_area'],
  noise: ['noise_music', 'noise_guests', 'noise_kids'],
  quality: ['quality_taste', 'quality_cooking', 'quality_portion'],
  attitude: ['attitude_rude', 'attitude_ignored', 'attitude_help']
};
const HIGH_TAGS = ['food', 'drinks', 'staff', 'atmosphere', 'music', 'value'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9]{6,20}$/;

function clientHash(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + '|' + (req.headers['user-agent'] || '') + '|' + (process.env.SESSION_SECRET || 'salt')).digest('hex').slice(0, 32);
}
async function tableByCode(code) {
  if (!CODE.test(code || '')) return null;
  const r = await db.q(`SELECT t.id, t.label, z.name AS zone_name FROM tables t LEFT JOIN zones z ON z.id = t.zone_id
                        WHERE t.code = $1 AND t.active`, [code]);
  return r.rows[0] || null;
}

// The guest form. The QR points to /r/<random code>; the table number is never sent to the browser.
router.get('/r/:code', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'form', 'index.html'));
});

router.get('/api/public/form/:code', async (req, res) => {
  const t = await tableByCode(req.params.code);
  if (!t) return res.status(404).json({ error: 'not_found' });
  const s = await settings.all();
  const p = await db.q(`SELECT p.id, p.name_bg, p.name_en, p.name_el, c.name_bg AS cat_bg, c.name_en AS cat_en, c.name_el AS cat_el
                        FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
                        WHERE p.active AND p.is_new AND (c.id IS NULL OR c.active)
                        ORDER BY c.sort NULLS LAST, c.id, p.sort, p.id`);
  res.json({
    ok: true,
    address: { bg: s.venue_address_bg, en: s.venue_address_en, el: s.venue_address_el },
    products: p.rows,
    issued_at: Date.now()
  });
});

router.post('/api/public/reviews', express.json({ limit: '8kb' }), async (req, res) => {
  try {
    const b = req.body || {};
    const s = await settings.all();
    // honeypot: real people never fill the hidden "website" field
    if (b.website) return res.status(202).json({ ok: true });
    if (!UUID.test(b.submission_id || '')) return res.status(400).json({ error: 'bad_submission' });
    const t = await tableByCode(b.code);
    if (!t) return res.status(404).json({ error: 'not_found' });
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
    const issued = Number(b.issued_at);
    if (!issued || Date.now() - issued < s.min_fill_seconds * 1000) return res.status(429).json({ error: 'too_fast' });

    // duplicate (double tap, retry on bad network) -> same answer, no second record
    const dup = await db.q('SELECT id FROM reviews WHERE submission_id=$1', [b.submission_id]);
    if (dup.rowCount) return res.json({ ok: true, id: dup.rows[0].id, duplicate: true });

    const ch = clientHash(req);
    const perDevice = await db.q(`SELECT count(*)::int n FROM reviews WHERE client_hash=$1 AND created_at > now() - interval '10 minutes'`, [ch]);
    if (perDevice.rows[0].n >= s.rate_limit_per_device_10min) return res.status(429).json({ error: 'rate_limited' });
    const perTable = await db.q(`SELECT count(*)::int n FROM reviews WHERE table_id=$1 AND created_at > now() - interval '30 minutes'`, [t.id]);
    if (perTable.rows[0].n >= s.rate_limit_per_table_30min) return res.status(429).json({ error: 'rate_limited' });

    const allowed = rating <= 3 ? LOW_TAGS : HIGH_TAGS;
    const selected = Array.isArray(b.tags) ? b.tags.filter(x => typeof x === 'string') : [];
    const baseTags = [...new Set(selected.filter(x => allowed.includes(x)))];
    // Detail labels are valid only for their selected main reason. Never count as separate review submissions.
    const detailTags = rating <= 3 ? selected.filter(x => baseTags.some(k => (DETAIL_TAGS[k] || []).includes(x))) : [];
    const tags = [...new Set(baseTags.concat(detailTags))];
    const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 1000) || null : null;
    let phone = null, consent = false;
    const suppliedPhone = typeof b.phone === 'string' ? b.phone.trim() : '';
    // Fail visibly instead of silently saving a review without its callback number.
    if (suppliedPhone && b.phone_consent !== true)
      return res.status(400).json({ error: 'phone_consent_required' });
    if (b.phone_consent === true) {
      const cleaned = suppliedPhone.replace(/[^\d+]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleaned))
        return res.status(400).json({ error: 'invalid_phone' });
      phone = cleaned; consent = true;
    }
    const lang = ['bg', 'en', 'el'].includes(b.lang) ? b.lang : 'bg';

    const browserHash = typeof b.browser_id === 'string' && UUID.test(b.browser_id)
      ? crypto.createHmac('sha256', process.env.SESSION_SECRET || 'rai-review-fallback').update(b.browser_id).digest('hex') : null;
    const review = await db.tx(async c => {
      let repeated = false;
      let suspicionReason = null;
      if (browserHash) {
        // One shared PostgreSQL history across all tables, IP networks and app sessions.
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [browserHash]);
        const previous = await c.query(
          "SELECT count(*)::int AS total_48h, count(*) FILTER (WHERE created_at >= now() - interval '10 hours')::int AS total_10h " +
          "FROM reviews WHERE browser_hash=$1 AND created_at >= now() - interval '48 hours'", [browserHash]);
        const n10 = previous.rows[0].total_10h + 1;
        const n48 = previous.rows[0].total_48h + 1;
        // A second review within ten hours, or a third within two days, merits manual review.
        const reasons = [];
        if (n10 >= 2) reasons.push(n10 + ' оценки от един браузър за 10 часа');
        if (n48 >= 3) reasons.push(n48 + ' оценки от един браузър за 48 часа');
        repeated = reasons.length > 0;
        suspicionReason = repeated ? reasons.join('; ') : null;
      }
      const ins = await c.query(
        `INSERT INTO reviews (submission_id, table_id, table_label, zone_name, rating, tags, comment, phone, phone_consent, phone_purge_at, lang, client_hash, browser_hash, suspected_repeat, suspicion_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $8::text IS NULL THEN NULL ELSE now() + make_interval(days => $10) END, $11, $12, $13, $14, $15)
         ON CONFLICT (submission_id) DO NOTHING RETURNING *`,
        [b.submission_id, t.id, t.label, t.zone_name, rating, tags, comment, phone, consent, s.phone_retention_days, lang, ch, browserHash, repeated, suspicionReason]);
      if (!ins.rowCount) return null;
      const rev = ins.rows[0];
      const votes = b.products && typeof b.products === 'object' ? b.products : {};
      const ids = Object.keys(votes).map(Number).filter(Number.isInteger).slice(0, 50);
      if (ids.length) {
        const pr = await c.query('SELECT id, name_bg FROM products WHERE id = ANY($1) AND active', [ids]);
        for (const p of pr.rows) {
          const v = Number(votes[p.id]);
          if (v === 1 || v === -1) await c.query('INSERT INTO review_products(review_id, product_id, product_name, vote) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [rev.id, p.id, p.name_bg, v]);
        }
      }
      await push.queueReview(rev, c, 'new', s);
      return rev;
    });
    if (!review) {
      const again = await db.q('SELECT id FROM reviews WHERE submission_id=$1', [b.submission_id]);
      return res.json({ ok: true, id: again.rows[0] && again.rows[0].id, duplicate: true });
    }
    res.status(201).json({ ok: true, id: review.id });
    // notify after answering the guest, so a slow push service never delays the form
    push.processPending().catch(e => logError('notify', e));
  } catch (e) {
    await logError('public.review', e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'form', 'privacy.html')));
module.exports = { router, LOW_TAGS, HIGH_TAGS };
