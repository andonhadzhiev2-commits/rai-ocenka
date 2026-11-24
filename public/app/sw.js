/* РАЙ Оценка service worker: push notifications + offline app shell */
const CACHE = 'rai-ocenka-v1';
const SHELL = ['/app/', '/app/index.html', '/app/app.css', '/app/app.js', '/app/logo.png', '/app/icons/icon-192.png', '/app/icons/badge-96.png', '/app/manifest.webmanifest'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // network first, fall back to the cached shell when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok && SHELL.includes(url.pathname)) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/app/index.html'))));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'РАЙ Оценка', body: e.data && e.data.text() }; }
  const opts = {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: true,
    icon: '/app/icons/icon-192.png',
    badge: '/app/icons/badge-96.png',
    requireInteraction: !!d.requireInteraction,
    vibrate: d.alert ? [300, 120, 300, 120, 300] : [120],
    data: { url: d.url || '/app/', reviewId: d.reviewId || null },
    timestamp: Date.now()
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'РАЙ Оценка', opts),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: 'review', reviewId: d.reviewId })))
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/app/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) {
      if (c.url.startsWith(self.location.origin + '/app')) { c.postMessage({ type: 'open', url: target }); return c.focus().then(() => c.navigate ? c.navigate(target) : null).catch(() => null); }
    }
    return self.clients.openWindow(target);
  }));
});
