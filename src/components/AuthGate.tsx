"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import { AccountPanel } from "./AccountPanel";
import {
  getCurrentAuthUser,
  isSupabaseConfigured,
  pingOnline,
  signInWithUsername,
  signUpWithUsername,
  type AuthUser,
} from "@/lib/supabase";

const AVATAR_CHOICES = [
  "luffy",
  "zoro",
  "nami",
  "usopp",
  "sanji",
  "chopper",
  "robin",
  "franky",
  "brook",
  "jinbe",
  "shanks",
  "ace",
].map((id) => characters.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [avatarId, setAvatarId] = useState(AVATAR_CHOICES[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function refreshUser() {
    return getCurrentAuthUser().then((u) => {
      setUser(u);
      setLoaded(true);
    });
  }

  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      setUser(u);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }
    pingOnline();
    heartbeatRef.current = setInterval(pingOnline, 60_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user]);

  if (!isSupabaseConfigured()) {
    // No backend to gate against — fall back to open access rather than
    // locking the app out entirely.
    return <>{children}</>;
  }

  if (!loaded) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-black/50 dark:text-white/40">Verbinde…</p>
      </main>
    );
  }

  if (user && user.username && !user.isAnonymous) {
    return (
      <>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-[var(--background)]/85 backdrop-blur px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-amber-700 dark:text-amber-400"
          >
            <span aria-hidden>🏴‍☠️</span>
            One Piece Draft-App
          </Link>
          <AccountPanel onSignedOut={refreshUser} />
        </header>
        {children}
      </>
    );
  }

  async function handleSubmit() {
    setBusy(true);
    setError("");
    const result =
      mode === "signup"
        ? await signUpWithUsername(username, password, inviteCode, avatarId || null)
        : await signInWithUsername(username, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUsername("");
    setPassword("");
    setInviteCode("");
    await refreshUser();
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <p className="font-[family-name:var(--font-display)] text-3xl text-amber-700 dark:text-amber-400">
            One Piece Draft-App
          </p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/50">
            {mode === "signup" ? "Account erstellen, um loszulegen" : "Anmelden, um weiterzumachen"}
          </p>
        </div>

        <div className="flex gap-2 rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === "login" ? "bg-amber-600 text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Anmelden
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === "signup" ? "bg-amber-600 text-white" : "text-black/60 dark:text-white/50"}`}
          >
            Registrieren
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Nutzername
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-2"
          />
        </label>

        {mode === "signup" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Einladungscode
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="von deinem Freund bekommen"
                className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-2"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm">
              <span>Avatar</span>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_CHOICES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAvatarId(c.id)}
                    title={c.name}
                    className={`relative rounded-full overflow-hidden border-2 ${avatarId === c.id ? "border-amber-500" : "border-transparent"}`}
                  >
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.name} referrerPolicy="no-referrer" className="h-10 w-10 object-cover object-top" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy || !username || !password || (mode === "signup" && !inviteCode)}
          className="rounded-md bg-amber-600 text-white px-4 py-2.5 font-medium hover:bg-amber-700 disabled:opacity-40"
        >
          {mode === "signup" ? "Account erstellen" : "Anmelden"}
        </button>
      </div>
    </main>
  );
}
