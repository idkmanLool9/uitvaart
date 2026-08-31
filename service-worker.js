// Service worker voor offline-modus
// Cache-strategie:
//  - App-shell (HTML/CSS/JS/icon/manifest): cache-first, fall back naar netwerk
//  - Supabase REST/Storage/Auth: network-only (schrijven en authenticatie)
//  - Externe libraries (jsdelivr Supabase SDK): stale-while-revalidate

// Cache-naam bevat het buildnummer (groeit elke release). Bij wijziging
// wordt de oude cache automatisch opgeruimd in het 'activate'-event.
const CACHE_VERSION = 'sok-uitvaart-build-165';
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './support.html',
  './style.css',
  './print.css',
  './manifest.webmanifest',
  './icon.svg',
  './js/config.js',
  './js/supabase-client.js',
  './js/snelstart.js',
  './js/data.js',
  './js/demo.js',
  './js/core.js',
  './js/views-list.js',
  './js/views-leden.js',
  './js/views-form.js',
  './js/views-detail.js',
  './js/views-kisten.js',
  './js/views-graven.js',
  './js/views-bloemen.js',
  './js/views-eten.js',
  './js/views-factuur.js',
  './js/views-familie-portaal.js',
  './js/views-portaal.js',
  './js/app.js',
  './js/native.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(async c => {
        // Forceer 'reload' zodat we de HTTP-cache van de browser overslaan.
        // Anders cacht de nieuwe SW stilletjes de oude bestanden en blijft
        // de gebruiker een versie achterlopen.
        await Promise.all(SHELL.map(async url => {
          try {
            const resp = await fetch(url, { cache: 'reload' });
            if (resp && resp.ok) await c.put(url, resp);
          } catch (err) {
            console.warn('SW shell fetch faalde:', url, err);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Vanuit de app SKIP_WAITING-bericht ontvangen om meteen te activeren
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase publieke storage-objecten (logo + kistfoto's + bloemen +
  // eten/drinken-foto's): stale-while-revalidate zodat ze offline werken
  if ((url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) &&
      url.pathname.startsWith('/storage/v1/object/public/')) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Overige Supabase API (REST, auth, signed URLs, realtime): nooit cachen
  if (url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) {
    return;
  }

  // jsdelivr CDN (Supabase SDK + EmailJS + html2pdf) + Google Fonts:
  // stale-while-revalidate zodat ze offline werken na 1e laad
  if (url.host === 'cdn.jsdelivr.net' ||
      url.host === 'fonts.googleapis.com' ||
      url.host === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Losse statische pagina's (support/privacy): altijd de echte pagina serveren,
  // nooit de app-shell als fallback. Werkt voor /support én /support.html.
  if (url.origin === location.origin) {
    const staticMatch = url.pathname.match(/^\/(support|privacy)(?:\.html)?$/);
    if (staticMatch) {
      const file = './' + staticMatch[1] + '.html';
      e.respondWith(
        fetch(new Request(req, { cache: 'no-cache' }))
          .then(resp => {
            if (resp && resp.ok && resp.type === 'basic') {
              caches.open(CACHE_VERSION).then(c => c.put(file, resp.clone()));
            }
            return resp;
          })
          .catch(() => caches.match(file))
      );
      return;
    }
  }

  // Eigen assets
  if (url.origin === location.origin) {
    // HTML / navigaties: network-first met cache-fallback
    // (zo komen updates direct binnen zodra je online bent)
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
      e.respondWith(networkFirst(req));
      return;
    }
    // Eigen JS/CSS/icons: ook network-first met cache-fallback. Zo krijgen
    // gebruikers na een hard-reload meteen de nieuwste versies, ipv eerst
    // de oude uit cache (stale-while-revalidate gaf 1-build-achter gedrag
    // bij sneltoets-updates).
    e.respondWith(networkFirst(req));
    return;
  }
});

async function networkFirst(req) {
  try {
    // 'no-cache' = altijd revalideren bij server (ETag/If-Modified-Since).
    // Zo krijgen we nooit een oude HTTP-cache-versie terwijl er een
    // nieuwere file klaarstaat op de server.
    const freshReq = new Request(req, { cache: 'no-cache' });
    const resp = await fetch(freshReq);
    if (resp && resp.ok && resp.type === 'basic') {
      const c = await caches.open(CACHE_VERSION);
      c.put(req, resp.clone());
    }
    return resp;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp && resp.ok) {
      caches.open(CACHE_VERSION).then(c => c.put(req, resp.clone()));
    }
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─── Push-notificaties ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = { title: 'Uitvaart Intake', body: 'Je hebt een nieuwe melding.', url: '/' };
  if (event.data) {
    try { payload = Object.assign(payload, event.data.json()); }
    catch (_) { payload.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icon.svg',
      badge: './icon.svg',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'sok-default',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.registration.scope) && 'focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
