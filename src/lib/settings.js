const db = require('./db');

// Defaults – every value can be changed later from the admin panel, no code changes needed.
const DEFAULTS = {
  public_base_url: process.env.PUBLIC_BASE_URL || 'https://ocenka.raipetrich.bg',
  public_base_url_confirmed: false,     // QR sheets are marked "TEST" until the owner confirms the address
  google_review_url: '',                // direct "write a review" link to the Rai Google profile
  notify_ratings: [1, 2, 3, 4, 5],      // which star ratings trigger a push (initially: all)
  alert_max_rating: 2,                  // ratings <= this are treated as alerts (red, 5-minute tracking)
  ack_target_minutes: 5,                // expected reaction time for alerts
  escalate_unacked: true,               // re-notify everyone if an alert is not taken within the target
  phone_retention_days: 90,             // phones are erased automatically after this many days
  rate_limit_per_device_10min: 4,       // max reviews from one device in 10 minutes
  rate_limit_per_table_30min: 12,       // max reviews from one table code in 30 minutes
  min_fill_seconds: 3,                  // faster submissions are treated as bots
  venue_address_bg: 'ул. Цар Симеон 24, Петрич',
  venue_address_en: '24 Tsar Simeon St, Petrich',
  venue_address_el: 'οδ. Τσαρ Σιμεών 24, Πέτριτς'
};

const PUBLIC_KEYS = ['google_review_url', 'venue_address_bg', 'venue_address_en', 'venue_address_el'];

let cache = null, cacheAt = 0;
async function all() {
  if (cache && Date.now() - cacheAt < 5000) return cache;
  const r = await db.q('SELECT key, value FROM settings');
  const s = { ...DEFAULTS };
  for (const row of r.rows) s[row.key] = row.value;
  cache = s; cacheAt = Date.now();
  return s;
}
async function get(key) { return (await all())[key]; }
async function set(key, value) {
  if (!(key in DEFAULTS) && !key.startsWith('_')) throw Object.assign(new Error('Unknown setting: ' + key), { status: 400 });
  await db.q(`INSERT INTO settings(key, value, updated_at) VALUES ($1, $2::jsonb, now())
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value)]);
  cache = null;
}
function validate(key, v) {
  const num = (min, max) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw Object.assign(new Error(`${key}: ${min}–${max}`), { status: 400 }); return n; };
  switch (key) {
    case 'notify_ratings':
      if (!Array.isArray(v)) throw Object.assign(new Error('notify_ratings must be a list'), { status: 400 });
      return [...new Set(v.map(Number).filter(n => n >= 1 && n <= 5))].sort();
    case 'alert_max_rating': return num(0, 5);
    case 'ack_target_minutes': return num(1, 120);
    case 'phone_retention_days': return num(1, 730);
    case 'rate_limit_per_device_10min': return num(1, 100);
    case 'rate_limit_per_table_30min': return num(1, 500);
    case 'min_fill_seconds': return num(0, 60);
    case 'public_base_url_confirmed':
    case 'escalate_unacked': return Boolean(v);
    case 'public_base_url':
    case 'google_review_url': {
      const s = String(v || '').trim().replace(/\/+$/, '');
      if (s && !/^https:\/\/[^\s]+$/i.test(s)) throw Object.assign(new Error(`${key} must start with https://`), { status: 400 });
      return s;
    }
    default: return String(v ?? '').slice(0, 300);
  }
}
function clearCache() { cache = null; }
module.exports = { DEFAULTS, PUBLIC_KEYS, all, get, set, validate, clearCache };
