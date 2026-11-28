const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const db = require('./lib/db');
const { router: publicRouter } = require('./routes/public');
const adminRouter = require('./routes/admin');
const { logError } = require('./lib/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'frame-ancestors': ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  // force HTTPS behind Railway's proxy
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
    next();
  });
  app.use(cookieParser());

  app.get('/healthz', async (req, res) => {
    try { await db.q('SELECT 1'); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false }); }
  });

  app.use(publicRouter);
  app.use('/api/admin', adminRouter);

  // Read-only API for the future BAROMETER module (header: Authorization: Bearer <INTEGRATION_API_KEY>)
  app.get('/api/v1/reviews', async (req, res) => {
    const key = process.env.INTEGRATION_API_KEY;
    if (!key || req.headers.authorization !== 'Bearer ' + key) return res.status(401).json({ error: 'unauthorized' });
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 7 * 864e5);
    const rows = await db.q(`SELECT id, table_id, created_at, table_label, zone_name, rating, tags, comment, status, ack_at, resolved_at,
      COALESCE((SELECT json_agg(json_build_object('name', product_name, 'vote', vote)) FROM review_products rp WHERE rp.review_id = r.id), '[]') products
      FROM reviews r WHERE created_at >= $1 ORDER BY created_at LIMIT 5000`, [isNaN(since) ? new Date(0) : since]);
    res.json(rows.rows);
  });

  // Private, read-only table positions for Barometer. Never return QR tokens or contact data.
  app.get('/api/v1/floorplan', async (req, res, next) => {
    const key = process.env.INTEGRATION_API_KEY;
    if (!key || req.headers.authorization !== 'Bearer ' + key) return res.status(401).json({ error: 'unauthorized' });
    try {
      const result = await db.q(`SELECT t.id, t.label, t.active, t.map_x, t.map_y, z.name AS zone_name
        FROM tables t LEFT JOIN zones z ON z.id=t.zone_id ORDER BY t.id`);
      res.set('Cache-Control', 'no-store').json(result.rows);
    } catch (error) { next(error); }
  });

  const pub = path.join(__dirname, '..', 'public');
  app.get('/app', (req, res, next) => (req.originalUrl.split('?')[0] === '/app' ? res.redirect('/app/') : next()));
  app.use('/app', express.static(path.join(pub, 'app'), {
    setHeaders: (res, file) => {
      if (file.endsWith('sw.js')) { res.set('Service-Worker-Allowed', '/app/'); res.set('Cache-Control', 'no-cache'); }
      else if (file.endsWith('.html') || file.endsWith('.webmanifest')) res.set('Cache-Control', 'no-cache');
    }
  }));
  app.use('/form', express.static(path.join(pub, 'form'), { maxAge: '1h' }));
  app.get('/', (req, res) => res.redirect('/app/'));

  app.use((err, req, res, next) => { logError('express', err); res.status(500).json({ error: 'server_error' }); });
  return app;
}
module.exports = { createApp };
