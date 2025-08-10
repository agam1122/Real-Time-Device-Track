const CACHE_NAME = "livemap-v1";

const urlsToCache = [
    "/",
    "/css/style.css",
    "/js/script.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/manifest.json"
];


self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

