"use client";

import { useEffect, useState } from "react";
import { characters } from "@/lib/characters";
import {
  fetchFriends,
  fetchIncomingFriendRequests,
  removeFriendship,
  respondToFriendRequest,
  sendFriendRequestByShareCode,
  type Friend,
  type FriendRequest,
} from "@/lib/supabase";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";

function avatarFor(id: string | null) {
  return id ? characters.find((c) => c.id === id) : null;
}

function Avatar({ userId, username, avatarCharacterId, online }: { userId: string; username: string; avatarCharacterId: string | null; online?: boolean }) {
  const avatar = avatarFor(avatarCharacterId);
  return (
    <span className="relative shrink-0" key={userId}>
      {avatar?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar.imageUrl}
          alt={username}
          referrerPolicy="no-referrer"
          className="h-8 w-8 rounded-full object-cover object-top"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
          {username.slice(0, 2).toUpperCase()}
        </span>
      )}
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--background)] ${
            online ? "bg-success" : "bg-black/20 dark:bg-white/20"
          }`}
        />
      )}
    </span>
  );
}

/** Friend requests (incoming), the accepted friend list, and an "add by share code" form (Q75). */
export function FriendsPanel() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function reload() {
    return Promise.all([fetchFriends(), fetchIncomingFriendRequests()]).then(([f, r]) => {
      setFriends(f);
      setRequests(r);
      setLoaded(true);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSendRequest() {
    if (!codeInput.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await sendFriendRequestByShareCode(codeInput);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Fehlgeschlagen.");
      return;
    }
    setCodeInput("");
    await reload();
  }

  async function handleRespond(id: string, accept: boolean) {
    await respondToFriendRequest(id, accept);
    await reload();
  }

  async function handleRemove(id: string) {
    await removeFriendship(id);
    await reload();
  }

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="Freundescode eingeben"
          className="flex-1"
        />
        <Button variant="secondary" size="sm" onClick={handleSendRequest} disabled={busy || !codeInput.trim()}>
          Anfrage senden
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      {requests.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {requests.map((r) => (
            <li key={r.friendshipId} className="flex items-center gap-2 text-sm">
              <Avatar userId={r.requesterId} username={r.username} avatarCharacterId={r.avatarCharacterId} />
              <span className="flex-1">{r.username}</span>
              <Button size="sm" onClick={() => handleRespond(r.friendshipId, true)}>
                Annehmen
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleRespond(r.friendshipId, false)}>
                Ablehnen
              </Button>
            </li>
          ))}
        </ul>
      )}

      {friends.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/30">Noch keine Freunde — teile deinen Code oben.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {friends.map((f) => (
            <li key={f.friendshipId}>
              <Card variant="plain" className="flex items-center gap-2 px-3 py-2 text-sm">
                <Avatar userId={f.userId} username={f.username} avatarCharacterId={f.avatarCharacterId} online={f.online} />
                <span className="flex-1">{f.username}</span>
                <button
                  onClick={() => handleRemove(f.friendshipId)}
                  className="text-xs text-black/40 dark:text-white/30 hover:text-danger hover:underline"
                >
                  entfernen
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
