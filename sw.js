// Flapurr offline support. Network first: when online you always get the newest
// game and the cache is refreshed; when offline the last good copy is served.
const CACHE = 'flapurr-offline-v1';
const CORE = ['./', 'index.html', 'style.css', 'game.js', 'game-core.js', 'challenge.js', 'crew-progress.js', 'crew-ui.js', 'ads.js', 'scenery.js', 'wardrobe.js', 'icon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {})); });
self.addEventListener('activate', event => event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flapurr-') && key !== CACHE).map(key => caches.delete(key))))])));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return; // Firebase and ads go straight to the network
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}); }
    return response;
  }).catch(async () => (await caches.match(request)) || (await caches.match(request, { ignoreSearch:true })) || (request.mode === 'navigate' ? (await caches.match('./')) || Response.error() : Response.error())));
});
