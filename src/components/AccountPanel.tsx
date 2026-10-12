"use client";

import { useEffect, useState } from "react";
import {
  getCurrentAuthUser,
  isSupabaseConfigured,
  signInWithUsername,
  signOutUser,
  signUpWithUsername,
  type AuthUser,
} from "@/lib/supabase";

export function AccountPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      setUser(u);
      setLoaded(true);
    });
  }, []);

  if (!isSupabaseConfigured() || !loaded) return null;

  async function handleSubmit() {
    setBusy(true);
    setError("");
    const result =
      mode === "signup" ? await signUpWithUsername(username, password) : await signInWithUsername(username, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const u = await getCurrentAuthUser();
    setUser(u);
    setOpen(false);
    setUsername("");
    setPassword("");
  }

  async function handleLogout() {
    await signOutUser();
    setUser(null);
  }

  if (user && user.username && !user.isAnonymous) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span>
          Angemeldet als <span className="font-semibold">{user.username}</span>
        </span>
        <button onClick={handleLogout} className="text-black/50 dark:text-white/40 hover:underline">
          Abmelden
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-black/15 dark:border-white/15 px-3 py-1.5 text-sm font-medium"
      >
        Anmelden / Registrieren
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-4 shadow-lg z-10 flex flex-col gap-3">
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode("login")}
              className={mode === "login" ? "font-semibold text-amber-600" : "text-black/50 dark:text-white/40"}
            >
              Anmelden
            </button>
            <button
              onClick={() => setMode("signup")}
              className={mode === "signup" ? "font-semibold text-amber-600" : "text-black/50 dark:text-white/40"}
            >
              Registrieren
            </button>
          </div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nutzername"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Passwort"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={busy || !username || !password}
            className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
          >
            {mode === "signup" ? "Account erstellen" : "Anmelden"}
          </button>
        </div>
      )}
    </div>
  );
}
