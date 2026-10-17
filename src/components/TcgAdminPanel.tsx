"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { fetchTcgGlobalEnabled, resetMyTcgCollection, setTcgGlobalEnabled } from "@/lib/supabase";

/** Admin-only TCG controls — moved out of the TCG page itself and into Profil's admin area (Boss, 2026-10-17: "der Admin bereich soll aus dem TCG Entfernt werden"), next to InviteCodesPanel. */
export function TcgAdminPanel() {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTcgGlobalEnabled().then((enabled) => {
      setGlobalEnabled(enabled);
      setLoaded(true);
    });
  }, []);

  async function handleToggleGlobal() {
    setBusy(true);
    const ok = await setTcgGlobalEnabled(!globalEnabled);
    setBusy(false);
    if (ok) setGlobalEnabled((v) => !v);
  }

  async function handleResetCollection() {
    if (!window.confirm("Deine ganze TCG-Sammlung (Karten, Fragmente, heutiges Pack) wirklich zurücksetzen?")) return;
    setBusy(true);
    await resetMyTcgCollection();
    setBusy(false);
  }

  if (!loaded) return null;

  return (
    <div className="op-card flex flex-wrap items-center gap-2 p-3 text-xs">
      <span className="font-semibold text-mode-tcg">TCG-Admin:</span>
      <Button size="sm" variant="secondary" onClick={handleToggleGlobal} disabled={busy}>
        {globalEnabled ? "Für alle sperren" : "Für alle freischalten"}
      </Button>
      <Button size="sm" variant="danger" onClick={handleResetCollection} disabled={busy}>
        Meine Sammlung zurücksetzen
      </Button>
      <span className="text-black/50 dark:text-white/40">{globalEnabled ? "Für alle sichtbar" : "Nur für Admins sichtbar"}</span>
    </div>
  );
}
