"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  dismissDraftInvite,
  ensureSupabaseSession,
  fetchIncomingDraftInvites,
  subscribeDraftInvites,
  type DraftInvite,
} from "@/lib/supabase";
import { Button } from "./ui/Button";

const POLL_MS = 10000;

/**
 * App-wide pop-up for Live-Draft invites (Boss's ask) — mounted once in
 * AuthGate so it shows up over whatever page is open, not just a banner on
 * the home screen you'd have to be looking at. Realtime push (see
 * subscribeDraftInvites) delivers it almost instantly; the poll is just a
 * fallback for the same reasons LiveDraftBoard already polls alongside its
 * realtime subscription.
 */
export function DraftInviteOverlay() {
  const [invites, setInvites] = useState<DraftInvite[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    function refresh() {
      fetchIncomingDraftInvites().then((rows) => {
        if (!cancelled) setInvites(rows);
      });
    }

    ensureSupabaseSession().then((userId) => {
      if (cancelled || !userId) return;
      refresh();
      unsubscribe = subscribeDraftInvites(userId, refresh);
      poll = setInterval(refresh, POLL_MS);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (poll) clearInterval(poll);
    };
  }, []);

  function dismiss(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    dismissDraftInvite(id);
  }

  if (invites.length === 0) return null;
  const invite = invites[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="op-pop-in op-card w-full max-w-sm flex flex-col gap-4 p-5 text-center">
        <p className="text-sm text-black/60 dark:text-white/50">Live-Draft-Einladung</p>
        <p className="text-base">
          <span className="font-semibold">{invite.fromUsername}</span> lädt dich zu einem Live-Draft ein
        </p>
        <div className="flex gap-3">
          <Link href={`/draft/live?code=${invite.inviteCode}`} className="flex-1" onClick={() => dismiss(invite.id)}>
            <Button className="w-full">Beitreten</Button>
          </Link>
          <Button variant="ghost" className="flex-1" onClick={() => dismiss(invite.id)}>
            Ablehnen
          </Button>
        </div>
        {invites.length > 1 && (
          <p className="text-xs text-black/50 dark:text-white/40">+{invites.length - 1} weitere Einladung(en)</p>
        )}
      </div>
    </div>
  );
}
