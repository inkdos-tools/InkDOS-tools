// InkDOS-tools: keep a small tool on this device (scope: its folder). build.py writes the cache prefix, the build
// version and the file list. Install stores every file; pages ask the network first (so a new build reaches them)
// and fall back to the stored copy, ignoring the query (?inkdos-theme=); other files come from the stored copy.
'use strict';
const PREFIX = '__PREFIX__';
const CACHE = PREFIX + '__VERSION__';
const FILES = __FILES__;
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map(scoped))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (request.mode === 'navigate') {
    if (!url.href.startsWith(self.registration.scope)) return;
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((c) => c.put(url.origin + url.pathname, copy)); }
      return response;
    }).catch(async (error) => {
      const stored = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
      if (stored) return stored;
      throw error;
    }));
    return;
  }
  event.respondWith((async () => {
    const stored = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
    if (stored) return stored;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') (await caches.open(CACHE)).put(request, response.clone());
    return response;
  })());
});
