"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { createInviteCode, fetchMyInviteCodes, type InviteCode } from "@/lib/supabase";

/** Admin-only: mint single-use registration codes and see who redeemed them. */
export function InviteCodesPanel() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  useEffect(() => {
    fetchMyInviteCodes()
      .then(setCodes)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setJustCreated(null);
    const result = await createInviteCode();
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.code) {
      setJustCreated(result.code);
      setCodes((prev) => [{ code: result.code!, createdAt: new Date().toISOString(), usedBy: null, usedAt: null }, ...prev]);
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
        Einladungscodes
      </h2>
      <Card variant="plain" className="space-y-3 p-4">
        <Button onClick={handleCreate} disabled={creating} size="sm">
          {creating ? "Erstelle…" : "Neuen Code erstellen"}
        </Button>
        {justCreated && (
          <p className="text-sm">
            Neuer Code: <span className="font-mono font-bold tracking-widest">{justCreated}</span>
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="text-sm text-black/50 dark:text-white/40">Lade Codes…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/40">Noch keine Codes erstellt.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {codes.map((c) => (
              <li key={c.code} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono tracking-widest">{c.code}</span>
                {c.usedBy ? (
                  <span className="text-xs text-black/50 dark:text-white/40">
                    benutzt am {new Date(c.usedAt!).toLocaleDateString("de-DE")}
                  </span>
                ) : (
                  <span className="text-xs text-success">offen</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
