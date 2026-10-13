"use client";

import { useState } from "react";
import Link from "next/link";
import { MODES } from "@/lib/modes";

/** Hamburger button + slide-in drawer giving access to every game mode from any page. */
export function SidebarNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menü öffnen" className="text-xl leading-none">
        ☰
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex">
          <nav className="op-parchment op-slide-in h-full w-72 max-w-[85vw] overflow-y-auto border-r border-black/10 dark:border-white/10 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-[family-name:var(--font-display)] text-lg text-amber-700 dark:text-amber-400">
                Spielmodi
              </span>
              <button onClick={() => setOpen(false)} aria-label="Menü schließen" className="text-xl leading-none">
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-amber-500/10"
              >
                🏠 Übersicht
              </Link>
              {MODES.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm hover:bg-amber-500/10"
                >
                  <span className="mr-2" aria-hidden>
                    {m.icon}
                  </span>
                  {m.title}
                </Link>
              ))}
              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-amber-500/10"
              >
                👤 Profil
              </Link>
            </div>
          </nav>
          <button aria-label="Menü schließen" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
