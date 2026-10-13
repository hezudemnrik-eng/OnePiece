import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono, Pirata_One } from "next/font/google";
import Script from "next/script";
import { AuthGate } from "@/components/AuthGate";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// The whole app renders behind AuthGate's client-side auth check, so no
// route here can produce a static instant-navigation shell — opt out of
// that dev-only validation rather than chase an unreachable target.
export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${pirataOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Applies a saved manual light/dark override before first paint, so
            switching doesn't flash the system-default theme while React hydrates. */}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
