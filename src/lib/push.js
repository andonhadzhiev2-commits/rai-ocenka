const webpush = require('web-push');
const db = require('./db');
const settings = require('./settings');
const { logError } = require('./errors');

let sender = null;      // overridable in tests
let configured = false;

async function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  // Fallback: generate once and keep in the database (settings._vapid). Never sent to clients except the public key.
  const s = await settings.all();
  if (s._vapid && s._vapid.publicKey) return s._vapid;
  const k = webpush.generateVAPIDKeys();
  await settings.set('_vapid', k);
  return k;
}
async function configure() {
  if (configured) return;
  const k = await vapidKeys();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@raipetrich.bg', k.publicKey, k.privateKey);
  configured = true;
}
async function publicKey() { return (await vapidKeys()).publicKey; }
function setSender(fn) { sender = fn; }

const STAR = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const TAG_BG = {
  slow: 'Бавно обслужване', cold: 'Студена храна', wrong: 'Грешна поръчка', price: 'Цена', clean: 'Чистота', noise: 'Шум',
  food: 'Храната', drinks: 'Напитките', staff: 'Персоналът', atmosphere: 'Атмосферата', music: 'Музиката', value: 'Цената'
};
function placeOf(r) { return [r.zone_name, r.table_label ? 'маса ' + r.table_label : null].filter(Boolean).join(' · ') || 'без маса'; }
function timeOf(d) { return new Date(d).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia' }); }

function buildPayload(r, s, kind = 'new') {
  const alert = r.rating <= s.alert_max_rating;
  const tags = (r.tags || []).map(t => TAG_BG[t] || t).join(', ');
  const title = kind === 'escalation'
    ? `⏱ НЕПОЕТ СИГНАЛ ${r.rating}★ · ${placeOf(r)}`
    : `${alert ? '⚠️ ' : ''}${r.rating}★ · ${placeOf(r)} · ${timeOf(r.created_at)}`;
  const lines = [STAR(r.rating)];
  if (tags) lines.push(tags);
  if (r.comment) lines.push('„' + r.comment.slice(0, 140) + (r.comment.length > 140 ? '…' : '') + '“');
  if (kind === 'escalation') lines.push(`Не е поет от ${s.ack_target_minutes} мин.`);
  return {
    title, body: lines.join('\n'), tag: 'review-' + r.id + (kind === 'escalation' ? '-esc' : ''),
    url: '/app/#/review/' + r.id, alert, requireInteraction: alert, reviewId: r.id
  };
}

async function sendToUsers(userFilterSql, params, payload) {
  await configure();
  const subs = await db.q(
    `SELECT s.* FROM push_subscriptions s JOIN users u ON u.id = s.user_id
     WHERE u.active AND u.notify ${userFilterSql}`, params);
  let ok = 0;
  await Promise.all(subs.rows.map(async sub => {
    const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      const opts = { TTL: 3600, urgency: payload.alert ? 'high' : 'normal', topic: undefined };
      if (sender) await sender(target, payload); else await webpush.sendNotification(target, JSON.stringify(payload), opts);
      ok++;
      await db.q('UPDATE push_subscriptions SET last_success_at=now(), fail_count=0 WHERE id=$1', [sub.id]);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await db.q('DELETE FROM push_subscriptions WHERE id=$1', [sub.id]);
      else { await db.q('UPDATE push_subscriptions SET fail_count=fail_count+1 WHERE id=$1', [sub.id]); await logError('push', e, sub.endpoint.slice(0, 80)); }
    }
  }));
  return ok;
}

// Transactional outbox. Caller can supply its active transaction so the review
// and its notification tasks are either both committed or both rolled back.
async function queueReview(review, client, kind = 'new', currentSettings = null) {
  const s = currentSettings || await settings.all();
  if (kind === 'new' && !s.notify_ratings.includes(review.rating)) return 0;
  const query = client ? client.query.bind(client) : db.q;
  const payload = kind === 'callback' ? {
    title: '📞 Клиент иска връзка с теб',
    body: placeOf(review) + ' · ' + timeOf(review.created_at) + ' · Обади се на клиента.',
    tag: 'callback-' + review.id,
    url: '/app/#/review/' + review.id,
    alert: true,
    requireInteraction: true,
    reviewId: review.id
  } : buildPayload(review, s, kind);
  const result = await query(
    `INSERT INTO push_outbox(review_id, subscription_id, kind, payload)
     SELECT $1, ps.id, $2, $3::jsonb FROM push_subscriptions ps
     JOIN users u ON u.id=ps.user_id WHERE u.active AND u.notify AND ($2 <> 'callback' OR u.role='owner')
     ON CONFLICT(review_id, subscription_id, kind) DO NOTHING`,
    [review.id, kind, JSON.stringify(payload)]);
  return result.rowCount;
}

let draining = false;
async function processPending(limit = 100) {
  if (draining) return 0;
  draining = true;
  let handled = 0;
  try {
    await configure();
    // Stuck jobs from a crash are retried; sends can rarely duplicate if the
    // remote service accepted a push just before our process crashed.
    await db.q(`UPDATE push_outbox SET state='pending', locked_at=NULL
      WHERE state='processing' AND locked_at < now() - interval '2 minutes'`);
    const jobs = await db.q(
      `UPDATE push_outbox SET state='processing', locked_at=now(), attempts=attempts+1
       WHERE id IN (SELECT id FROM push_outbox
         WHERE state='pending' AND next_attempt_at <= now()
         ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
       RETURNING *`, [limit]);
    for (const job of jobs.rows) {
      const sub = (await db.q(`SELECT s.*, u.active, u.notify
        FROM push_subscriptions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [job.subscription_id])).rows[0];
      if (!sub || !sub.active || !sub.notify) {
        await db.q("UPDATE push_outbox SET state='failed', last_error='Device disabled' WHERE id=$1", [job.id]);
        continue;
      }
      const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      const payload = job.payload;
      try {
        if (sender) await sender(target, payload);
        else await webpush.sendNotification(target, JSON.stringify(payload), { TTL: 3600, urgency: payload.alert ? 'high' : 'normal' });
        await db.tx(async c => {
          await c.query("UPDATE push_outbox SET state='sent', sent_at=now(), locked_at=NULL, last_error=NULL WHERE id=$1", [job.id]);
          await c.query('UPDATE push_subscriptions SET last_success_at=now(), fail_count=0 WHERE id=$1', [sub.id]);
          await c.query('UPDATE reviews SET notified_count=notified_count+1 WHERE id=$1', [job.review_id]);
        });
        handled++;
      } catch (e) {
        const expired = e.statusCode === 404 || e.statusCode === 410;
        if (expired) {
          // Cascading delete cleans up future tasks for this dead subscription.
          await db.q('DELETE FROM push_subscriptions WHERE id=$1', [sub.id]);
        } else {
          const attempts = job.attempts;
          const permanent = attempts >= 8;
          await db.q(`UPDATE push_outbox SET state=$2, locked_at=NULL,
             next_attempt_at=now() + make_interval(secs => $3),
             last_error=$4 WHERE id=$1`,
             [job.id, permanent ? 'failed' : 'pending', Math.min(300, 5 * (2 ** Math.min(attempts, 6))), String(e.message || e).slice(0, 300)]);
          await db.q('UPDATE push_subscriptions SET fail_count=fail_count+1 WHERE id=$1', [sub.id]);
          await logError('push.outbox', e, sub.endpoint.slice(0, 80));
        }
      }
    }
  } finally { draining = false; }
  return handled;
}

async function notifyReview(review) {
  const s = await settings.all();
  if (!s.notify_ratings.includes(review.rating)) return 0;
  const n = await sendToUsers('', [], buildPayload(review, s, 'new'));
  await db.q('UPDATE reviews SET notified_count = notified_count + $2 WHERE id=$1', [review.id, n]);
  return n;
}

async function escalateOverdue() {
  const s = await settings.all();
  if (!s.escalate_unacked) return 0;
  const count = await db.tx(async client => {
    const rows = await client.query(
      `UPDATE reviews SET escalated_at=now()
       WHERE status='new' AND escalated_at IS NULL AND rating <= $1
         AND created_at < now() - make_interval(mins => $2) AND created_at > now() - interval '6 hours'
       RETURNING *`, [s.alert_max_rating, s.ack_target_minutes]);
    for (const rev of rows.rows) await queueReview(rev, client, 'escalation', s);
    return rows.rowCount;
  });
  await processPending();
  return count;
}

async function sendTest(userId) {
  return sendToUsers('AND u.id = $1', [userId], {
    title: 'РАЙ PULSE · тест', body: 'Известията работят на това устройство.', tag: 'test', url: '/app/#/me', alert: false
  });
}
module.exports = { configure, publicKey, setSender, notifyReview, queueReview, processPending, escalateOverdue, sendTest, buildPayload, TAG_BG };
