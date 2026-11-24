/* RAI Ocenka PWA service worker — versioned mobile shell and reliable updates */
const CACHE = 'rai-ocenka-mobile-20261124-62';
const SHELL = [
  '/app/',
  '/app/index.html',
  '/app/app.css?v=20261124-62',
  '/app/app.js?v=20261124-62',
  '/app/floorplan.js?v=20261124-60',
  '/app/pdf-export.js?v=20261124-28',
  '/app/logo.png',
  '/app/icons/icon-192.png',
  '/app/icons/badge-96.png',
  '/app/manifest.webmanifest'
];
const SHELL_PATHS = new Set(SHELL.map(url=>new URL(url,self.location.origin).pathname));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rai-ocenka-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(!url.pathname.startsWith('/app/'))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok&&SHELL_PATHS.has(url.pathname)){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{}));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    if(cached)return cached;
    // Never serve HTML in place of JS/CSS, which causes silent broken screens.
    if(req.mode==='navigate')return caches.match('/app/index.html');
    return Response.error();
  }));
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
