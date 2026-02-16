// Service worker with aggressive update strategy for new deployments

const CACHE_NAME = "dailyq-shell-v3"; // Increment version on each deployment
const OFFLINE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // Skip waiting to activate immediately on new deployment
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Clear all old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients to reload
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "CACHE_UPDATED" });
        });
      });
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Network-first strategy for HTML to always get latest deployment
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match("/");
        })
    );
    return;
  }

  // Cache-first for other assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          return new Response("", { status: 503, statusText: "Offline" });
        })
      );
    }),
  );
});

