import type { MetadataRoute } from "next";

// Lets Boss "Add to Home Screen" and open the app in standalone display
// mode — only then does env(safe-area-inset-top) become non-zero and the
// OS status bar can sit translucently over the header banner, matching
// his ChatGPT mockup. A regular browser tab never shows that effect,
// manifest or not.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "One Piece Draft-App",
    short_name: "Pirate Draft",
    description: "Privates Fan-Projekt: Draft-Spiele und Tierlisten rund um One Piece.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1626",
    theme_color: "#693c1b",
    icons: [
      { src: "/images/icons/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icons/app/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/images/icons/app/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
