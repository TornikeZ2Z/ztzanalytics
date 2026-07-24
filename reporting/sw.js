/* Zip to Zip reporting — shell-freshness service worker.
 *
 * WHY: the portal is served by GitHub Pages, which stamps every file with
 * `Cache-Control: max-age=600` and offers NO way to override it (no _headers file,
 * and a <meta http-equiv="Cache-Control"> is ignored for the document's own HTTP
 * cache). So a freshly-deployed index.html stays invisible for up to 10 minutes —
 * the browser keeps serving the old shell, which keeps requesting the OLD ?v=
 * asset versions, so the deploy silently does nothing. This has bitten repeatedly.
 *
 * WHAT: intercept ONLY top-level navigations (the HTML document) and always fetch
 * them from the network, bypassing the HTTP cache. Everything else — the ?v=-busted
 * JS/CSS, images, API calls — passes straight through and keeps its normal cache.
 * We deliberately cache nothing here: the goal is freshness, not offline support
 * (the app needs the network for its data API regardless).
 *
 * Safe to remove: delete this file + the registration in index.html; the SW
 * self-unregisters nothing, but with no controller the browser reverts to normal.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (req.method === 'GET' && isDoc) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
    );
  }
  // all other requests: default browser handling (versioned assets stay cached)
});
