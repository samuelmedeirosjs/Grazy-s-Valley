const CACHE_NAME = "eu-te-amo-v2";

const FILES_TO_CACHE = [
  "./index.html",
  "./main.js",
  "./styles.css",
  "./manifest.json",

  "./assets/logo.png",
  "./assets/vida_real.png",

  "./assets/backgrounds/mapa_eu_te_amo.png",
  "./assets/sprites/girlfriend.png",
  "./assets/sprites/boyfriend.png",

  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});