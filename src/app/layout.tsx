import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "One Piece Draft-App",
  description: "Privates Fan-Projekt: Draft-Spiele und Tierlisten rund um One Piece.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-3">
          <Link href="/" className="font-semibold">
            One Piece Draft-App
          </Link>
          <AccountPanel />
        </header>
        {children}
      </body>
    </html>
  );
}
