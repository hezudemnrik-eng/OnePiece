// Cached hier NUR statische Grafiken (Bilder/Icons), damit sie beim
// nächsten Öffnen sofort aus dem Speicher kommen statt neu zu laden.
// HTML/JS/CSS und alle Supabase-Anfragen laufen bewusst NICHT über den
// Cache — sonst würde ein neues Deploy nicht ankommen (siehe Boss' "Änderung
// nicht in der App"-Vorfall). CACHE_NAME hochzählen räumt alte Bild-Caches
// weg, falls sich mal die Cache-Strategie ändert.
const CACHE_NAME = "onepiece-images-v1";
const IMAGE_PATH_PREFIXES = ["/images/", "/live-draft/"];

function isCacheableImageRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (request.destination === "image") return true;
  return IMAGE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheableImageRequest(request, url)) {
    // Alles andere (Seiten, JS, CSS, API/Supabase) unberührt lassen —
    // normaler Netzwerk-Request, damit neue Deploys sofort ankommen.
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      // Stale-while-revalidate: sofort aus dem Speicher anzeigen (falls da),
      // im Hintergrund aktualisieren.
      return cached || networkFetch;
    })
  );
});
