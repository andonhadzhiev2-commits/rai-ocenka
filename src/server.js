const { createApp } = require('./app');
const { migrate } = require('./migrate');
const db = require('./lib/db');
const auth = require('./lib/auth');
const push = require('./lib/push');
const { logError } = require('./lib/errors');

async function bootstrapOwner() {
  const { OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME } = process.env;
  const n = (await db.q("SELECT count(*)::int n FROM users WHERE role='owner'")).rows[0].n;
  if (n || !OWNER_EMAIL || !OWNER_PASSWORD) return;
  if (!auth.validPassword(OWNER_PASSWORD)) throw new Error('OWNER_PASSWORD must be at least 10 characters');
  await db.q("INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,$3,'owner')", [OWNER_EMAIL.toLowerCase(), OWNER_NAME || 'Собственик', await auth.hash(OWNER_PASSWORD)]);
  console.log('[setup] owner account created for', OWNER_EMAIL);
}

function startJobs() {
  push.processPending().catch(e => logError('job.outbox', e));
  setInterval(() => push.processPending().catch(e => logError('job.outbox', e)), 5000);
  // alerts not taken within the target time are re-sent to everyone
  setInterval(() => push.escalateOverdue().catch(e => logError('job.escalate', e)), 30 * 1000);
  // phones are erased after the retention period
  const purge = () => db.q('UPDATE reviews SET phone = NULL WHERE phone IS NOT NULL AND phone_purge_at < now()').catch(e => logError('job.purge', e));
  purge(); setInterval(purge, 60 * 60 * 1000);
}

(async () => {
  await migrate();
  await bootstrapOwner();
  await push.configure();
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log('РАЙ Оценка listening on', port));
  startJobs();
})().catch(e => { console.error(e); process.exit(1); });
process.on('unhandledRejection', e => logError('unhandledRejection', e));
