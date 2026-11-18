/* 보면대 서비스 워커: 오프라인 실행 + 다른 앱(카카오톡 등)에서 공유한 PDF 받기 */
importScripts('db.js');

const CACHE = 'bomyeondae-v1';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'db.js', 'manifest.webmanifest',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'samples/sample-1.pdf', 'samples/sample-2.pdf', 'samples/sample-3.pdf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 공유 받기 (manifest의 share_target)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        for (const f of form.getAll('pdf')) {
          if (f && typeof f !== 'string') await DB.addInbox(f.name || '악보.pdf', f);
        }
      } catch (err) { console.error(err); }
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.postMessage('shared'));
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // 화면 이동은 네트워크 우선(최신 버전), 안 되면 캐시
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copy));
      return r;
    }).catch(() => caches.match('index.html')));
    return;
  }

  // 나머지는 캐시 우선 + 뒤에서 새로고침
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
