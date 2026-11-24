const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const COOKIE = 'rai_session';
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set (min 32 chars)');
    return 'dev-only-secret-change-me-dev-only-secret';
  }
  return s;
}
const hash = pw => bcrypt.hash(pw, 11);
const verify = (pw, h) => bcrypt.compare(pw, h);

function issue(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, secret(), { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000, path: '/'
  });
}
function clear(res) { res.clearCookie(COOKIE, { path: '/' }); }

async function load(req) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return null;
  try {
    const p = jwt.verify(t, secret());
    const r = await db.q('SELECT id, email, name, role, active, notify, on_duty, token_version FROM users WHERE id=$1', [p.sub]);
    const u = r.rows[0];
    if (!u || !u.active || u.token_version !== p.v) return null;
    return u;
  } catch { return null; }
}
function requireUser(roles) {
  return async (req, res, next) => {
    const u = await load(req);
    if (!u) return res.status(401).json({ error: 'Необходим е вход.' });
    if (roles && !roles.includes(u.role)) return res.status(403).json({ error: 'Нямате права за това действие.' });
    req.user = u; next();
  };
}
function validPassword(pw) { return typeof pw === 'string' && pw.length >= 10; }
module.exports = { issue, clear, load, requireUser, hash, verify, validPassword, COOKIE };
