
const CACHE_NAME = 'pantry-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // DÔLEŽITÉ: Okamžite aktivuj nový Service Worker, nečakaj na zatvorenie tabov
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  // DÔLEŽITÉ: Prevezmi kontrolu nad všetkými otvorenými klientmi ihneď
  event.waitUntil(clients.claim());

  // Vymaž staré cache (napr. pantry-v1)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Pre navigačné requesty (HTML stránka) použi stratégiu Network First
  // Tzn. skús stiahnuť najnovšiu verziu, ak to zlyhá (offline), použi cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Pre ostatné súbory (obrázky, skripty) použi Cache First (rýchlosť)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
