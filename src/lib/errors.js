const db = require('./db');
async function logError(source, err, detail) {
  const message = (err && err.message) || String(err);
  console.error(`[${source}]`, message);
  try { await db.q('INSERT INTO error_log(source, message, detail) VALUES ($1,$2,$3)', [source, message.slice(0, 1000), (detail || (err && err.stack) || '').toString().slice(0, 4000)]); }
  catch (_) { /* never throw from the logger */ }
}
module.exports = { logError };
