import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Pirata_One } from "next/font/google";
import { AccountPanel } from "@/components/AccountPanel";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pirataOne = Pirata_One({
  variable: "--font-pirata",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Piece Draft-App",
  description: "Privates Fan-Projekt: Draft-Spiele und Tierlisten rund um One Piece.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${pirataOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-[var(--background)]/85 backdrop-blur px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-amber-700 dark:text-amber-400">
            <span aria-hidden>🏴‍☠️</span>
            One Piece Draft-App
          </Link>
          <AccountPanel />
        </header>
        {children}
      </body>
    </html>
  );
}
