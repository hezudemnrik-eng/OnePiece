"use client";

import { useEffect } from "react";

// Registriert public/sw.js, damit Grafiken (Bilder/Icons) auf dem Gerät
// zwischengespeichert werden. Nur in Produktion, damit `next dev` nicht
// durch einen aktiven Service Worker verwirrt wird.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Kein Service Worker ist kein Fehler, den der Nutzer sehen muss —
      // die App funktioniert dann einfach ohne Offline-Bild-Cache weiter.
    });
  }, []);

  return null;
}
