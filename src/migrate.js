const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

async function migrate() {
  await db.q('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await db.q('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await db.tx(async c => { await c.query(sql); await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]); });
    console.log('[migrate] applied', f);
  }
}
module.exports = { migrate };
if (require.main === module) migrate().then(() => db.close()).catch(e => { console.error(e); process.exit(1); });
