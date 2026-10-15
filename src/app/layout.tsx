import type { Metadata, Viewport } from "next";
import { Anton, Bitter, Geist_Mono, Pirata_One } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

// Warm slab-serif body face (replaces the earlier geometric Geist Sans) —
// reads more like carved/painted lettering on wood/parchment, matching the
// Holz-Gold illustrated assets (bars, icons, frames, Berry coin) rather than
// a generic app-UI sans-serif.
const bodyFont = Bitter({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Bold condensed poster/stencil face for headings, character names and
// mode titles — matches the wanted-poster reference mockups (Phase 12),
// replacing the earlier rounded/cute Baloo 2. Main --font-display (see
// globals.css's @theme inline block).
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

// Blackletter mood font, now reserved for rare dramatic flavor (--font-mystery)
// rather than the everyday display face — see globals.css.
const pirataOne = Pirata_One({
  variable: "--font-pirata",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Piece Draft-App",
  description: "Privates Fan-Projekt: Draft-Spiele und Tierlisten rund um One Piece.",
  // "Zum Home-Bildschirm hinzufügen" + schwarz-transparente Statusleiste:
  // erst im installierten Standalone-Modus liegt sie über dem Header-Banner
  // statt über einer leeren Fläche (Boss' Chatti-Mockup).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pirate Draft",
  },
  // Next only emits the modern "mobile-web-app-capable" meta tag; older
  // iOS (pre-16.4) only honors the legacy "apple-"-prefixed one.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/images/icons/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icons/app/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/icons/app/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#693c1b",
};

// The whole app renders behind AuthGate's client-side auth check, so no
// route here can produce a static instant-navigation shell — opt out of
// that dev-only validation rather than chase an unreachable target.
export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${bodyFont.variable} ${geistMono.variable} ${anton.variable} ${pirataOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
