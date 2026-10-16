// Service Worker als Route statt als statische Datei unter public/sw.js,
// damit der Cache-Name die aktuelle Vercel-Commit-SHA enthält. So räumt
// JEDES Deploy automatisch den alten Bild-Cache weg (siehe activate-Handler
// unten) — Boss ersetzt öfter eine Grafik unter demselben Dateinamen
// (Chatti-Bilder), und ohne das würde er nach einem Update erst noch die
// alte Version sehen, bis sie sich im Hintergrund selbst überschreibt.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export async function GET() {
  const body = `
const CACHE_NAME = "onepiece-images-${BUILD_ID}";
const IMAGE_PATH_PREFIXES = ["/images/", "/live-draft/"];

function isCacheableImageRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (request.destination === "image") return true;
  return IMAGE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Jedes neue Deploy hat eine neue CACHE_NAME (Build-SHA) -> alle älteren
  // Bild-Caches werden hier gelöscht, auch wenn sich der Dateiname eines
  // Bildes nie geändert hat.
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
    // Seiten, JS, CSS, API/Supabase unberührt lassen — normaler
    // Netzwerk-Request, damit neue Deploys sofort ankommen.
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Der Browser soll das Skript selbst bei jedem Besuch neu abfragen
      // (üblicherweise tut er das sowieso alle 24h) statt eine veraltete
      // Version davon zu cachen.
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
