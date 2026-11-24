const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const ssl = /sslmode=require/.test(url) || process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined;
    pool = new Pool({ connectionString: url, ssl, max: 10 });
  }
  return pool;
}
const q = (text, params) => getPool().query(text, params);
async function tx(fn) {
  const c = await getPool().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
async function close() { if (pool) { await pool.end(); pool = null; } }
module.exports = { q, tx, getPool, close };
