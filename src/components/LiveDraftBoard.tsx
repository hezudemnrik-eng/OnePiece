"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { characters, type Role } from "@/lib/characters";
import {
  allRematchReady,
  allRolesConfirmed,
  assignRole,
  assignTeam,
  autoPick,
  claimSeat,
  clearSeat,
  confirmRoles,
  createDraft,
  currentPlayer,
  DRAFT_EMOTES,
  firstOpenSeat,
  getTeam,
  isLobbyFull,
  pickCharacter,
  randomizeStartingPlayer,
  resolveTeamRoleConflicts,
  sendEmote,
  skipRoll,
  touchPresence,
  voteRematch,
  type DraftEmote,
  type DraftState,
  type DraftTeam,
} from "@/lib/draft";
import { simulateBattle, simulateFreeForAll, type BattleResult } from "@/lib/battle-sim";
import { getRoleAdjustedVersions } from "@/lib/crewRoles";
import { checkDraftAchievements, type DraftAchievement } from "@/lib/draftAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  abandonLiveDraft,
  createLiveDraft,
  ensureSupabaseSession,
  fetchFriends,
  fetchLiveDraftByCode,
  cancelLiveDraft,
  fetchLiveDraftById,
  fetchPublicProfilesCosmetics,
  fetchShopItems,
  getCurrentAuthUser,
  incrementXp,
  recordMatchResult,
  sendDraftInvite,
  subscribeLiveDraft,
  unlockAchievement,
  writeLiveDraft,
  type Friend,
  type LiveDraftSession,
  type PublicProfileCosmetics,
  type ShopItem,
} from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RoleAssignmentPanel } from "./RoleAssignmentPanel";
import { RollPanel } from "./RollPanel";
import { VictoryBanner } from "./VictoryBanner";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

const NICKNAME_KEY = "op-nickname";
const PRESENCE_INTERVAL_MS = 7000;
const STALE_MS = 15000;

type View = "loading" | "home" | "create-form" | "join-form" | "lobby" | "drafting" | "roles" | "result";

// Chatti-drawn emote icons (Boss, 2026-10-15: no unicode/stock emoji for
// Live-Draft) — one PNG per DRAFT_EMOTES id, used for both the chat bar
// buttons and the floating pop-up reactions.
const EMOTE_ICON: Record<DraftEmote, string> = {
  thumbsup: "/live-draft/emotes/thumbsup.png",
  laugh: "/live-draft/emotes/laugh.png",
  shocked: "/live-draft/emotes/shocked.png",
  fire: "/live-draft/emotes/fire.png",
  angry: "/live-draft/emotes/angry.png",
  wow: "/live-draft/emotes/wow.png",
  heart: "/live-draft/emotes/heart.png",
  peek: "/live-draft/emotes/peek.png",
};
const EMOTE_ALT: Record<DraftEmote, string> = {
  thumbsup: "Daumen hoch",
  laugh: "Lachen",
  shocked: "Geschockt",
  fire: "Feuer",
  angry: "Wütend",
  wow: "Staunen",
  heart: "Herz",
  peek: "Spitzbübisch",
};

function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "Spieler";
  } catch {
    return "Spieler";
  }
}

/** Avatar+Rahmen+Titel+Namensfarbe for a seated player, mirroring FriendsPanel's Avatar — falls back to the bare name when no profile cosmetics are loaded yet (e.g. an open seat, or before the lookup resolves). */
const TEAM_RING_COLOR: Record<DraftTeam, string> = {
  A: "var(--mode-draft)",
  B: "#e11d48",
};

function PlayerIdentity({
  userId,
  name,
  cosmetics,
  shopItems,
  team,
}: {
  userId?: string | null;
  name: string;
  cosmetics: Record<string, PublicProfileCosmetics>;
  shopItems: ShopItem[];
  /** Tints the avatar ring with the player's Team A/B color (Boss's ask) when set. */
  team?: DraftTeam;
}) {
  const c = userId ? cosmetics[userId] : undefined;
  const avatar = c?.avatarCharacterId ? characters.find((ch) => ch.id === c.avatarCharacterId) : null;
  const frameImage = c?.equippedFrame ? FRAME_IMAGES[c.equippedFrame] : undefined;
  const frameClass = c?.equippedFrame
    ? (shopItems.find((i) => i.category === "frame" && i.id === c.equippedFrame)?.className ?? "")
    : "";
  const colorClass = c?.equippedColor
    ? shopItems.find((i) => i.category === "color" && i.id === c.equippedColor)?.className ?? ""
    : "";
  const title = c?.equippedTitle ? shopItems.find((i) => i.category === "title" && i.id === c.equippedTitle) : undefined;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {avatar?.imageUrl && (
        <span
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={team ? { boxShadow: `0 0 0 2px ${TEAM_RING_COLOR[team]}` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className={`h-9 w-9 rounded-full object-cover object-top ${frameImage ? "" : frameClass}`}
          />
          {frameImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frameImage} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          )}
        </span>
      )}
      <span className="min-w-0 truncate">
        <span className={`font-semibold ${colorClass}`}>{name}</span>
        {title && <span className="ml-1 text-xs opacity-70">{title.label}</span>}
      </span>
    </span>
  );
}

export function LiveDraftBoard() {
  const searchParams = useSearchParams();
  const lastAutoJoinCodeRef = useRef<string | null>(null);
  const [view, setView] = useState<View>("loading");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState(() => loadNickname());
  const [session, setSession] = useState<LiveDraftSession | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // The window check keeps this 0 (deterministic) during Next.js 16's
  // prerender of the static shell; on the client it's a real timestamp
  // from the very first render, so no separate effect has to set it.
  const [nowTick, setNowTick] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));

  // create-form fields
  const [playerCount, setPlayerCount] = useState(2);
  const [teamSize, setTeamSize] = useState(5);
  const [teamMode, setTeamMode] = useState(false);

  // join-form fields
  const [codeInput, setCodeInput] = useState("");
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);

  const [newAchievements, setNewAchievements] = useState<DraftAchievement[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [cosmetics, setCosmetics] = useState<Record<string, PublicProfileCosmetics>>({});
  const loadedCosmeticsKeyRef = useRef("");

  // Lobby-only: friends offered for an in-app invite (Boss's ask) instead of
  // only sharing the invite code outside the app.
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invitedFriendIds, setInvitedFriendIds] = useState<string[]>([]);

  // Floating pop-up emotes (Boss's ask): a short-lived overlay item per new
  // chat message, independent of the small text log, that animates in and
  // fades out on its own via CSS (see op-emote-pop in globals.css).
  const [floatingEmotes, setFloatingEmotes] = useState<{ key: string; emote: DraftEmote; label: string; leftPct: number }[]>([]);
  const lastChatAtRef = useRef<string>("");

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchRecordedRef = useRef(false);
  const achievementsCheckedRef = useRef(false);
  const rematchCreateFiredRef = useRef(false);
  const rematchJoinFiredRef = useRef(false);
  const lastHeartbeatRef = useRef(0);
  // Guards the two "somebody left mid-round" rescue effects below (auto-pick
  // for an empty seat's turn, auto-confirm for an empty seat's roles) so the
  // single client responsible for them doesn't refire the same write every
  // render — reset whenever the thing they're keyed on changes.
  const autoPickFiredAtRef = useRef<string | null>(null);
  const autoConfirmFiredRef = useRef(false);

  function detachPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(NICKNAME_KEY, nickname);
    } catch {
      // ignore
    }
  }, [nickname]);

  useEffect(() => {
    let cancelled = false;
    ensureSupabaseSession().then((id) => {
      if (!cancelled) {
        setMyUserId(id);
        // Only move off the loading screen — if the session took a moment
        // and the user already clicked into create/join, don't stomp that.
        setView((v) => (v === "loading" ? "home" : v));
      }
    });
    getCurrentAuthUser().then((u) => {
      if (!cancelled && u?.username) setNickname(u.username);
    });
    fetchShopItems().then((items) => {
      if (!cancelled) setShopItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Co-players' frame/title/color, keyed by userId — fetched whenever the
  // set of seated players changes (not on every realtime/poll tick, since
  // most of those just update picks/turns, not who's seated).
  useEffect(() => {
    const seatedIds = (session?.state.players ?? [])
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id));
    const key = Array.from(new Set(seatedIds)).sort().join(",");
    if (!key || key === loadedCosmeticsKeyRef.current) return;
    loadedCosmeticsKeyRef.current = key;
    fetchPublicProfilesCosmetics(seatedIds).then((rows) => {
      setCosmetics((prev) => {
        const next = { ...prev };
        for (const row of rows) next[row.userId] = row;
        return next;
      });
    });
  }, [session]);

  // Friends for the lobby's invite picker — fetched once per lobby visit,
  // not on every realtime/poll tick.
  useEffect(() => {
    if (session?.phase !== "lobby" || isSpectator) return;
    fetchFriends().then(setFriends);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, session?.id]);

  // Floating emote pop-ups: watches the shared chat log for entries newer
  // than the last one we've already shown, and gives each its own
  // short-lived overlay item that removes itself once its CSS animation
  // (op-emote-pop) finishes.
  useEffect(() => {
    const log = session?.state.chatLog ?? [];
    const fresh = log.filter((m) => m.at > lastChatAtRef.current);
    if (fresh.length === 0) return;
    lastChatAtRef.current = log[log.length - 1].at;
    const items = fresh.map((m) => ({
      key: `${m.at}-${m.playerId}`,
      emote: m.emote,
      label: chatLabel(m.playerId),
      leftPct: 20 + Math.random() * 60,
    }));
    setFloatingEmotes((prev) => [...prev, ...items]);
    for (const item of items) {
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((f) => f.key !== item.key));
      }, 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.chatLog]);

  // Lets the Übersicht's "weiterspielen" links and the app-wide invite
  // pop-up (/draft/live?code=XXXX) jump straight back into a lobby or
  // in-progress draft without retyping the code. Keyed on the code itself
  // (not a one-shot ref) — Next.js reuses this same component instance for
  // a same-route navigation, so accepting a *second* invite while already
  // on this page only updates the `code` search param without remounting;
  // a fire-once ref would silently ignore that second invite.
  useEffect(() => {
    if (!myUserId) return;
    const code = searchParams.get("code");
    if (!code || code === lastAutoJoinCodeRef.current) return;
    lastAutoJoinCodeRef.current = code;
    handleJoin(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId, searchParams]);

  // nowTick doesn't drive any on-screen countdown (there is no visible
  // per-second timer in this board) — it only exists so the heartbeat
  // (every PRESENCE_INTERVAL_MS) and stale-player check (STALE_MS = 15s)
  // below get re-evaluated periodically. Ticking every 1s forced this
  // whole (large, image-heavy) board to fully re-render once a second,
  // which is exactly the "laggt sehr beim Live Draft" symptom on phones.
  // Every 4s is still far tighter than the 7s/15s thresholds it feeds.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 4000);
    return () => clearInterval(id);
  }, []);

  function attach(s: LiveDraftSession) {
    setSession(s);
    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeLiveDraft(s.id, setSession);

    // Realtime push isn't guaranteed — the project's Realtime service can
    // be unhealthy independently of the database itself (seen in testing:
    // a Cloudflare edge error on the websocket handshake while REST calls
    // worked fine). Poll as a redundant fallback; once realtime is
    // healthy this is just a harmless no-op most ticks (same updated_at).
    detachPolling();
    pollIntervalRef.current = setInterval(async () => {
      const latest = await fetchLiveDraftById(s.id);
      if (latest) {
        setSession((prev) => (prev && prev.updated_at === latest.updated_at ? prev : latest));
      }
    }, 2500);
  }

  useEffect(
    () => () => {
      unsubscribeRef.current?.();
      detachPolling();
    },
    []
  );

  // Derived, not stored: once a session exists, which screen shows is
  // purely a function of its phase, computed fresh every render. Storing
  // it as separate state that an effect copies session.phase into would
  // need to fire on every realtime push and poll tick just to stay in
  // sync — a textbook case of state that should just be computed instead.
  const effectiveView: View = session
    ? session.phase === "lobby"
      ? "lobby"
      : session.phase === "drafting"
        ? "drafting"
        : session.phase === "roles"
          ? "roles"
          : "result"
    : view;

  async function handleCreate() {
    if (!myUserId) return;
    setErrorMsg("");
    const ids = characters.map((c) => c.id);
    const teamModeEnabled = teamMode && playerCount === 4;
    const placeholderNames = Array.from({ length: playerCount }, () => "Offen");
    let initial = createDraft(placeholderNames, ids, teamSize, { teamModeEnabled });
    initial = claimSeat(initial, 0, myUserId, nickname || "Spieler");
    const created = await createLiveDraft(initial, playerCount);
    if (!created) {
      setErrorMsg("Konnte keine Lobby erstellen. Ist Supabase richtig eingerichtet?");
      return;
    }
    setIsSpectator(false);
    attach(created);
  }

  async function handleJoin(codeOverride?: string) {
    if (!myUserId) return;
    setErrorMsg("");
    const code = codeOverride ?? codeInput;
    // Retry the lookup a few times before giving up: right after an invite
    // is sent, the invitee's accept can reach us before the just-created
    // lobby row has replicated, which looked exactly like an invalid code
    // (a one-shot fetch here was why the invite pop-up sometimes failed to
    // join at all).
    let found: LiveDraftSession | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      found = await fetchLiveDraftByCode(code);
      if (found) break;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!found) {
      setErrorMsg("Kein Draft mit diesem Code gefunden.");
      return;
    }

    const alreadySeated = found.state.players.some((p) => p.userId === myUserId);
    const mustSpectate = joinAsSpectator || found.phase !== "lobby";

    if (mustSpectate && !alreadySeated) {
      setIsSpectator(true);
      attach(found);
      return;
    }
    if (alreadySeated) {
      setIsSpectator(false);
      attach(found);
      return;
    }

    // Try to claim an open seat, retrying a few times against conflicting writes.
    let current = found;
    for (let attempt = 0; attempt < 5; attempt++) {
      const seatIndex = firstOpenSeat(current.state);
      if (seatIndex === -1) {
        setErrorMsg("Die Lobby ist schon voll — du kannst nur zuschauen.");
        setIsSpectator(true);
        attach(current);
        return;
      }
      const nextState = claimSeat(current.state, seatIndex, myUserId, nickname || "Spieler");
      const result = await writeLiveDraft(current.id, current.updated_at, { state: nextState });
      if (result.session) {
        setIsSpectator(false);
        attach(result.session);
        return;
      }
      const refetched = await fetchLiveDraftById(current.id);
      if (!refetched) break;
      current = refetched;
    }
    setErrorMsg("Konnte der Lobby nicht beitreten (zu viele gleichzeitige Beitritte). Bitte nochmal versuchen.");
  }

  async function startDraft() {
    if (!session) return;
    const state = randomizeStartingPlayer(session.state);
    const result = await writeLiveDraft(session.id, session.updated_at, { phase: "drafting", state });
    if (result.session) setSession(result.session);
  }

  async function handleAssignTeam(seatIndex: number, team: DraftTeam | undefined) {
    if (!session) return;
    const next = assignTeam(session.state, seatIndex, team);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  async function applyPick(characterId: string) {
    if (!session) return;
    playAccept();
    vibrate(30);
    const next = pickCharacter(session.state, characterId);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  async function applySkip() {
    if (!session) return;
    playSkip();
    vibrate(15);
    const next = skipRoll(session.state);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  // Presence heartbeat (Q109): each client periodically touches its own
  // player's lastSeenAt so the others can tell a closed tab apart from a
  // teammate who's just thinking. Throttled against the existing 1s
  // nowTick rather than a second independent interval, matching how the
  // auto-pick/auto-confirm checks below already work off the same clock.
  // Also runs during "result" (not just drafting/roles) now — isPrimaryActor
  // below needs a *live* staleness signal on the result screen too, to pick
  // a present client for rematch creation instead of getting stuck on
  // whoever happens to sit in the lowest seat if that's the one who left.
  useEffect(() => {
    if (!session || !myUserId || isSpectator) return;
    if (effectiveView !== "drafting" && effectiveView !== "roles" && effectiveView !== "result") return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    if (nowTick - lastHeartbeatRef.current < PRESENCE_INTERVAL_MS) return;
    lastHeartbeatRef.current = nowTick;
    const next = touchPresence(session.state, me.id);
    writeLiveDraft(session.id, session.updated_at, { state: next }).then((result) => {
      if (result.session) setSession(result.session);
    });
  }, [nowTick, effectiveView, session, myUserId, isSpectator]);

  function isPlayerStale(lastSeenAt: string | undefined): boolean {
    if (!lastSeenAt) return false;
    return nowTick - new Date(lastSeenAt).getTime() > STALE_MS;
  }

  /** The first seated player's `id` and `userId`, in seat order — used below
   * to pick exactly one present client to perform a "somebody's missing"
   * rescue write, the same single-writer pattern as the host-only effects,
   * but keyed off who's actually still here rather than host_id (the host
   * themself might be the one who's gone — see handleLeaveRound). */
  function firstSeatedPlayer(state: DraftState) {
    return state.players.find((p) => p.userId);
  }

  /**
   * True for exactly one present client: the earliest-seated player who
   * isn't stale (falls back to the earliest seated player at all, if
   * somehow everyone currently reads as stale — better one write attempt
   * too many than none). Every single-writer transition below
   * (drafting -> roles, roles -> result, result -> rematch lobby) used to
   * gate on `session.host_id === myUserId` instead — which meant the whole
   * draft silently wedged if the host's own tab ever closed (no explicit
   * "leave") right as the draft finished: nobody else was allowed to flip
   * the phase, so everyone just sat on a frozen "Runde X von Y" forever
   * (Boss, 2026-10-17: "6 von 5 und dann geht nichts mehr" — this kept
   * happening even after the round-counter math itself was fixed, because
   * that bug was a *symptom* of this one, not the cause). Picking "whoever's
   * seated and actually present" instead of "specifically the host" removes
   * that single point of failure — it has to be the non-stale check and not
   * just "first seated player", since a gone host is still "seated"
   * (userId set) until someone explicitly leaves; optimistic concurrency
   * (writeLiveDraft's expectedUpdatedAt check) still keeps two clients from
   * double-writing the same transition if two both read as present.
   */
  function isPrimaryActor(state: DraftState): boolean {
    const present = state.players.find((p) => p.userId && !isPlayerStale(p.lastSeenAt));
    const anchor = present ?? firstSeatedPlayer(state);
    return anchor?.userId === myUserId;
  }

  // Rescue for a round stuck on a turn nobody can take (Boss, 2026-10-17:
  // "manchmal bleibt die Runde... stehen und es geht nichts mehr weiter",
  // and again after the round-counter fix: "6 von 5 und dann geht nichts
  // mehr") — covers both ways that happens: the seat is empty (left via
  // handleLeaveRound, which clears userId but keeps the player's progress),
  // or the seat is still claimed but its player has gone quiet (tab closed
  // without clicking "Verlassen", phone locked, connection dropped) for
  // longer than STALE_MS — the same signal the "scheint die Verbindung
  // verloren" warning already uses, just acted on instead of only shown.
  // The earliest still-*present* client (isPrimaryActor, which already
  // skips stale seats when picking who acts) auto-picks on their behalf so
  // the draft keeps moving instead of pausing forever on a turn nobody still
  // here can take. Depends on nowTick (not just turnStartedAt) because
  // staleness is itself time-based — a player can go from "maybe still
  // thinking" to "gone" without any other draft state changing.
  useEffect(() => {
    if (!session || session.phase !== "drafting" || session.state.finished || isSpectator) return;
    const state = session.state;
    const player = currentPlayer(state);
    if (player.userId && !isPlayerStale(player.lastSeenAt)) return;
    if (!isPrimaryActor(state)) return;
    if (autoPickFiredAtRef.current === state.turnStartedAt) return;
    autoPickFiredAtRef.current = state.turnStartedAt;
    const next = autoPick(state);
    writeLiveDraft(session.id, session.updated_at, { state: next }).then((r) => {
      if (r.session) setSession(r.session);
      else autoPickFiredAtRef.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.currentPlayerIndex, session?.state.turnStartedAt, session?.phase, myUserId, isSpectator, nowTick]);

  // Same rescue for the role-assignment phase: allRolesConfirmed also
  // requires an "every userId || pickedCharacterIds.length > 0" player to be
  // ready, so someone who left — or just went stale, see the rescue above —
  // after drafting but before confirming roles would otherwise block the
  // battle forever. Auto-confirms with no role assignments on their behalf
  // (same as skipping roles voluntarily).
  useEffect(() => {
    if (!session || session.phase !== "roles" || isSpectator) return;
    const state = session.state;
    const abandoned = state.players.filter(
      (p) => (!p.userId || isPlayerStale(p.lastSeenAt)) && !p.rolesReady && p.pickedCharacterIds.length > 0
    );
    if (abandoned.length === 0) return;
    if (!isPrimaryActor(state)) return;
    if (autoConfirmFiredRef.current) return;
    autoConfirmFiredRef.current = true;
    const next = abandoned.reduce((acc, p) => confirmRoles(acc, p.id), state);
    writeLiveDraft(session.id, session.updated_at, { state: next }).then((r) => {
      if (r.session) setSession(r.session);
      else autoConfirmFiredRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.players, session?.phase, myUserId, isSpectator, nowTick]);

  /** Index into state.players of the non-team battle's winner — winnerIndex
   * for a 3+ player free-for-all, otherwise the old winnerTeam "A"/"B" ->
   * 0/1 mapping for a 2-player draft. Team-mode winners are looked up by
   * p.team === battle.winnerTeam directly at each call site instead. */
  function resolveWinnerIndex(state: DraftState, battle: BattleResult): number {
    if (state.players.length > 2 && battle.winnerIndex !== undefined) return battle.winnerIndex;
    return battle.winnerTeam === "A" ? 0 : 1;
  }

  // Whichever present client is the "primary actor" (see isPrimaryActor)
  // moves the draft into the role-assignment phase once it finishes, so
  // exactly one client writes the transition instead of every client racing
  // to (or, as it used to be, specifically the host — who might be gone).
  useEffect(() => {
    if (!session || session.phase !== "drafting" || !session.state.finished) return;
    if (!isPrimaryActor(session.state)) return;
    writeLiveDraft(session.id, session.updated_at, { phase: "roles" }).then((r) => {
      if (r.session) setSession(r.session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.finished, session?.phase, myUserId]);

  // Same single-writer pattern: the primary actor's browser computes the
  // battle result once every seated player has confirmed their role
  // assignments.
  useEffect(() => {
    if (!session || session.phase !== "roles" || !allRolesConfirmed(session.state)) return;
    if (!isPrimaryActor(session.state)) return;

    const isTeamMode = session.state.players.some((p) => p.team);
    // Teammates assigned roles independently of each other — resolve any
    // clash over the same crew position by lottery before battling (Q104).
    const state = isTeamMode ? resolveTeamRoleConflicts(session.state) : session.state;
    let result: BattleResult;
    if (isTeamMode) {
      const sideA = state.players.filter((p) => p.team === "A");
      const sideB = state.players.filter((p) => p.team === "B");
      const sideAVersions = sideA.flatMap((p) => getRoleAdjustedVersions(getTeam(state, p.id, characters), p.roleAssignments));
      const sideANames = sideA.flatMap((p) => getTeam(state, p.id, characters).map((c) => c.name));
      const sideBVersions = sideB.flatMap((p) => getRoleAdjustedVersions(getTeam(state, p.id, characters), p.roleAssignments));
      const sideBNames = sideB.flatMap((p) => getTeam(state, p.id, characters).map((c) => c.name));
      result = simulateBattle(sideAVersions, sideANames, sideBVersions, sideBNames);
    } else if (state.players.length > 2) {
      // Free-for-all with 3+ players (Boss, 2026-10-17): no fixed teams, so
      // simulateBattle's two-sided "A vs B" shape doesn't fit — every
      // player's roster is its own side, see simulateFreeForAll.
      const sidesVersions = state.players.map((p) => getRoleAdjustedVersions(getTeam(state, p.id, characters), p.roleAssignments));
      const sidesNames = state.players.map((p) => getTeam(state, p.id, characters).map((c) => c.name));
      const ffa = simulateFreeForAll(sidesVersions, sidesNames);
      result = { winnerTeam: "A", winnerIndex: ffa.winnerIndex, rounds: ffa.rounds };
    } else {
      const [p1, p2] = state.players;
      const rosterA = getTeam(state, p1.id, characters);
      const rosterB = getTeam(state, p2.id, characters);
      result = simulateBattle(
        getRoleAdjustedVersions(rosterA, p1.roleAssignments),
        rosterA.map((c) => c.name),
        getRoleAdjustedVersions(rosterB, p2.roleAssignments),
        rosterB.map((c) => c.name)
      );
    }
    writeLiveDraft(session.id, session.updated_at, { state, phase: "result", battle: result }).then((r) => {
      if (r.session) setSession(r.session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.players, session?.phase, myUserId]);

  // Every participant's own browser checks its own draft achievements once —
  // mirrors the match-result recording effect just below.
  useEffect(() => {
    if (!session || session.phase !== "result" || !session.battle || !myUserId || isSpectator) return;
    if (achievementsCheckedRef.current) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    achievementsCheckedRef.current = true;
    const battle = session.battle;
    const won = me.team ? me.team === battle.winnerTeam : session.state.players.indexOf(me) === resolveWinnerIndex(session.state, battle);
    const roster = getTeam(session.state, me.id, characters);
    const opponentRoster = session.state.players
      .filter((p) => (me.team ? p.team !== me.team : p.id !== me.id))
      .flatMap((p) => getTeam(session.state, p.id, characters));
    const rerolls = session.state.rerollsUsed?.[me.id] ?? 0;
    const earned = checkDraftAchievements(roster, opponentRoster, won, rerolls, me.roleAssignments);
    if (earned.length === 0) return;
    Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) }))).then((results) => {
      const fresh = results.filter((r) => r.isNew).map((r) => r.a);
      if (fresh.length > 0) {
        incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
        setNewAchievements(fresh);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.finished, session?.phase, myUserId]);

  async function handleAssignRole(characterId: string, role: Role) {
    if (!session || !myUserId) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    const next = assignRole(session.state, me.id, characterId, role);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  async function handleConfirmRoles() {
    if (!session || !myUserId) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    const next = confirmRoles(session.state, me.id);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  // Every participant's own browser records its own win/loss once — not
  // just the host's — so the friend leaderboard reflects everyone.
  useEffect(() => {
    if (!session || session.phase !== "result" || !session.battle || !myUserId || isSpectator) return;
    if (matchRecordedRef.current) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    matchRecordedRef.current = true;
    const won = me.team ? me.team === session.battle.winnerTeam : session.state.players.indexOf(me) === resolveWinnerIndex(session.state, session.battle);
    const opponents = session.state.players.filter((p) => p.id !== me.id).map((p) => p.name).join(", ");
    recordMatchResult("live-draft", opponents, won ? "win" : "loss");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.finished, session?.phase, myUserId]);

  // Once every seated player has voted ready (handleVoteRematch), the
  // primary actor's browser alone creates the fresh lobby — exactly one
  // writer, like the other single-writer transitions above — pre-seating
  // every player into it (not just itself) so nobody has to separately
  // "join" afterwards. Used to be host-only, which meant a host who closed
  // their tab after voting (without using the new "Verlassen" button) could
  // leave everyone else's vote stuck forever with nobody allowed to create
  // the rematch.
  useEffect(() => {
    if (!session || session.phase !== "result" || isSpectator) return;
    if (!isPrimaryActor(session.state)) return;
    if (session.state.rematchInviteCode || !allRematchReady(session.state)) return;
    if (rematchCreateFiredRef.current) return;
    rematchCreateFiredRef.current = true;

    (async () => {
      const ids = characters.map((c) => c.id);
      const teamModeEnabled = Boolean(session.state.teamModeEnabled);
      const placeholderNames = session.state.players.map(() => "Offen");
      let initial = createDraft(placeholderNames, ids, session.state.teamSize, { teamModeEnabled });
      session.state.players.forEach((p, i) => {
        if (!p.userId) return;
        initial = claimSeat(initial, i, p.userId, p.name);
        if (p.team) initial = assignTeam(initial, i, p.team);
      });
      const created = await createLiveDraft(initial, session.state.players.length);
      if (!created) {
        rematchCreateFiredRef.current = false;
        setErrorMsg("Konnte kein Rematch starten.");
        return;
      }
      // Everyone already voted and is pre-seeded above — Boss wants the
      // rematch to drop straight into the round instead of a redundant
      // lobby screen. Move the fresh session past "lobby" before anyone
      // (host included) can see it, so nobody has to press "Start" again.
      let startedSession = created;
      const started = await writeLiveDraft(created.id, created.updated_at, {
        phase: "drafting",
        state: randomizeStartingPlayer(created.state),
      });
      if (started.session) startedSession = started.session;
      // Retries against whoever's vote landed last, same optimistic-concurrency
      // pattern as every other write here — only the primary actor writes
      // this field, but a vote from another player can still land in
      // between. Written only now (after the phase flip above) so another
      // client never observes the invite code while the new session is
      // still "lobby".
      let current = session;
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await writeLiveDraft(current.id, current.updated_at, {
          state: { ...current.state, rematchInviteCode: created.invite_code },
        });
        if (result.session) break;
        const refetched = await fetchLiveDraftById(session.id);
        if (!refetched) break;
        current = refetched;
      }
      setIsSpectator(false);
      attach(startedSession);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.players, session?.phase, myUserId, isSpectator]);

  // Everyone else just watches the finished session for the invite code the
  // primary actor wrote above and jumps straight in — they're already
  // seated in the new round (pre-filled by claimSeat/assignTeam and moved
  // past "lobby" by the primary actor above), so this fetches and attaches
  // directly instead of going through handleJoin's seat-claiming path,
  // which doesn't apply here.
  // Retries a few times against replica lag: a one-shot attempt that quietly
  // gave up on a transient `null` fetch — while permanently marking itself
  // "already tried" — was why a rematch sometimes left someone stuck on the
  // old result screen. Resetting the ref alone doesn't actually get retried
  // though, since none of this effect's other dependencies change on their
  // own afterwards (the old session's rematchInviteCode never changes
  // again) — so `nowTick`, which already ticks once a second for the
  // on-screen timers, is included here purely to give the effect a reason
  // to re-run and notice the ref was reset.
  useEffect(() => {
    if (!session || session.phase !== "result" || isSpectator) return;
    if (isPrimaryActor(session.state) || !session.state.rematchInviteCode) return;
    if (rematchJoinFiredRef.current) return;
    rematchJoinFiredRef.current = true;
    const inviteCode = session.state.rematchInviteCode;
    (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const found = await fetchLiveDraftByCode(inviteCode);
        if (found) {
          setIsSpectator(false);
          attach(found);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      // Let the next tick try again instead of giving up for good.
      rematchJoinFiredRef.current = false;
      setErrorMsg("Konnte dem Rematch nicht automatisch beitreten. Versuche es gleich erneut…");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.rematchInviteCode, session?.phase, myUserId, isSpectator, nowTick]);

  async function handleSendEmote(emote: DraftEmote) {
    if (!session || !myUserId) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    const next = sendEmote(session.state, me.id, emote);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
  }

  // "Verlassen" in the lobby screen used to only reset local view state —
  // the draft_sessions row itself was never touched, so a host who left
  // still had their lobby sitting in the DB as "wartet auf Spieler" and
  // kept seeing it reappear on Home under "Weiterspielen" (and, since
  // creating it already claimed the day's Tagesquest, with no way to make
  // it go away). Now it actually cancels (host) or frees the seat (guest)
  // server-side before leaving.
  async function leaveLobby() {
    if (session && myUserId && !isSpectator) {
      if (session.host_id === myUserId) {
        await cancelLiveDraft(session.id, myUserId);
      } else {
        const next = clearSeat(session.state, myUserId);
        await writeLiveDraft(session.id, session.updated_at, { state: next });
      }
    }
    backToHome();
  }

  // "Verlassen" once the round itself is underway (drafting/roles/result) —
  // previously there was no way to leave at all past the lobby (a stale seat
  // was meant to be "handled by the other players picking around it", but
  // nothing ever actually did that, so one gone player could leave everyone
  // else stuck forever — Boss, 2026-10-17: "Die Runde soll über ein Button
  // leave bar sein"). Frees the seat; if nobody else is left seated the
  // session is abandoned outright instead of orphaning the row, and if the
  // leaver was host, hands host_id to another seated player so the
  // host-only transition effects (phase changes, rematch creation) don't
  // die with them. The auto-pick/auto-confirm rescue effects above pick up
  // the freed seat's remaining turns from here.
  async function handleLeaveRound() {
    if (!session || !myUserId || isSpectator) {
      backToHome();
      return;
    }
    const next = clearSeat(session.state, myUserId);
    const stillSeated = next.players.filter((p) => p.userId);
    if (stillSeated.length === 0) {
      await abandonLiveDraft(session.id);
      backToHome();
      return;
    }
    const patch: { state: DraftState; host_id?: string } =
      session.host_id === myUserId ? { state: next, host_id: stillSeated[0].userId! } : { state: next };
    let current = session;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await writeLiveDraft(current.id, current.updated_at, patch);
      if (result.session || result.error) break;
      const refetched = await fetchLiveDraftById(current.id);
      if (!refetched) break;
      current = refetched;
    }
    backToHome();
  }

  function backToHome() {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    detachPolling();
    setSession(null);
    setErrorMsg("");
    setNewAchievements([]);
    achievementsCheckedRef.current = false;
    matchRecordedRef.current = false;
    rematchCreateFiredRef.current = false;
    rematchJoinFiredRef.current = false;
    lastAutoJoinCodeRef.current = null;
    setInvitedFriendIds([]);
    setFloatingEmotes([]);
    lastChatAtRef.current = "";
    setView("home");
  }

  async function handleInviteFriend(friendUserId: string) {
    if (!session) return;
    const result = await sendDraftInvite(friendUserId, session.invite_code);
    if (result.ok) setInvitedFriendIds((prev) => [...prev, friendUserId]);
  }

  // Votes this browser's own player ready for a rematch — Boss's ask was
  // that nobody starts a new lobby alone: everyone has to press the button
  // first, and only then do they all land in the same fresh lobby together
  // (see the two effects below, which do the actual creating/joining once
  // every seated player has voted).
  async function handleVoteRematch() {
    if (!session || !myUserId) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    const next = voteRematch(session.state, me.id);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
    else if (result.conflict) {
      const refetched = await fetchLiveDraftById(session.id);
      if (refetched) setSession(refetched);
    }
  }

  function chatLabel(playerId: string): string {
    return session?.state.players.find((p) => p.id === playerId)?.name ?? "?";
  }

  // MVP = the character that dealt the most total damage across the battle
  // log, attributed back to whichever player drafted it (Boss's ask — the
  // draft itself has no other per-player performance metric to show).
  function computeMvp(s: LiveDraftSession): { characterName: string; playerName: string } | null {
    if (!s.battle) return null;
    const damageByName = new Map<string, number>();
    for (const r of s.battle.rounds) {
      damageByName.set(r.attackerName, (damageByName.get(r.attackerName) ?? 0) + r.damage);
    }
    let best: { name: string; damage: number } | null = null;
    for (const [name, damage] of damageByName) {
      if (!best || damage > best.damage) best = { name, damage };
    }
    if (!best) return null;
    for (const p of s.state.players) {
      const picked = p.pickedCharacterIds
        .map((id) => characters.find((c) => c.id === id))
        .find((c) => c?.name === best!.name);
      if (picked) return { characterName: best.name, playerName: p.name };
    }
    return null;
  }

  // Chat is intentionally limited to a fixed set of preset reactions (Q108)
  // — no free text, so no moderation surface needed for a feature this small.
  // The reactions themselves show up as the floating pop-up overlay
  // (renderFloatingEmotes) rather than a text log.
  function renderChatBar() {
    if (!session || isSpectator) return null;
    return (
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-black/15 dark:border-white/15 p-3">
        {DRAFT_EMOTES.map((emote) => (
          <button
            key={emote}
            onClick={() => handleSendEmote(emote)}
            className="rounded-full border border-black/15 dark:border-white/15 p-1 transition hover:border-mode-draft/50"
          >
            <img src={EMOTE_ICON[emote]} alt={EMOTE_ALT[emote]} className="h-10 w-10" />
          </button>
        ))}
      </div>
    );
  }

  // Overlay of short-lived floating emotes (see the effect populating
  // floatingEmotes) — pinned over the whole screen so a reaction is visible
  // no matter where on the board the viewer is looking, then disappears on
  // its own once op-emote-pop finishes.
  function renderFloatingEmotes() {
    if (floatingEmotes.length === 0) return null;
    return (
      <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center">
        <div className="relative h-0 w-full max-w-md">
          {floatingEmotes.map((f) => (
            <span
              key={f.key}
              className="op-emote-pop absolute flex flex-col items-center gap-1"
              style={{ left: `${f.leftPct}%` }}
            >
              <img src={EMOTE_ICON[f.emote]} alt={f.label} className="h-16 w-16 drop-shadow-md" />
              <span className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{f.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Dedicated background for the lobby-setup screens (Boss, 2026-10-15: "die
  // Ansicht bei der Lobbyerstellung soll auch ein Hintergrund bekommen") —
  // same fixed+overlay technique as the page-level background in
  // draft/live/page.tsx, just rendered later in the DOM so it paints over it
  // only while home/create-form/join-form/lobby are shown.
  function renderLobbyBackground() {
    return (
      <>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-55 dark:opacity-45"
          style={{ backgroundImage: "url(/live-draft/lobby-background.jpg)" }}
        />
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-white/45 dark:bg-black/45" />
      </>
    );
  }

  if (effectiveView === "loading") {
    return <LoadingSpinner label="Verbinde…" />;
  }

  if (effectiveView === "home") {
    return (
      <>
        {renderLobbyBackground()}
        <Card
          variant="spotlight"
          accent="draft"
          className="op-chatti-frame flex flex-col gap-4 max-w-md"
          style={{ backgroundColor: "rgba(10, 8, 6, 0.32)" }}
        >
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <Input value={nickname} onChange={(e) => setNickname(e.target.value || "Spieler")} />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setView("create-form")}>Lobby erstellen</Button>
          <Button variant="secondary" onClick={() => setView("join-form")}>
            Mit Code beitreten
          </Button>
        </div>
        </Card>
      </>
    );
  }

  if (effectiveView === "create-form") {
    return (
      <>
        {renderLobbyBackground()}
        <Card
          variant="spotlight"
          accent="draft"
          className="op-chatti-frame flex flex-col gap-4 max-w-md"
          style={{ backgroundColor: "rgba(10, 8, 6, 0.32)" }}
        >
        <label className="flex flex-col gap-1 text-sm">
          Anzahl Spieler
          <Select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Teamgröße
          <Input
            type="number"
            min={1}
            max={10}
            value={teamSize}
            onChange={(e) => setTeamSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        {playerCount === 4 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} />
            Team-vs-Team (2 gegen 2)
          </label>
        )}
        {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
        <div className="flex gap-3">
          <Button onClick={handleCreate}>Lobby erstellen</Button>
          <Button variant="ghost" onClick={() => setView("home")} className="text-black/50 dark:text-white/40">
            Zurück
          </Button>
        </div>
        </Card>
      </>
    );
  }

  if (effectiveView === "join-form") {
    return (
      <>
        {renderLobbyBackground()}
        <Card
          variant="spotlight"
          accent="draft"
          className="op-chatti-frame flex flex-col gap-4 max-w-md"
          style={{ backgroundColor: "rgba(10, 8, 6, 0.32)" }}
        >
        <label className="flex flex-col gap-1 text-sm">
          Einladungscode
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="z. B. AB3XQ9"
            className="font-mono uppercase"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={joinAsSpectator} onChange={(e) => setJoinAsSpectator(e.target.checked)} />
          Nur zuschauen (nicht selbst draften)
        </label>
        {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
        <div className="flex gap-3">
          <Button onClick={() => handleJoin()}>Beitreten</Button>
          <Button variant="ghost" onClick={() => setView("home")} className="text-black/50 dark:text-white/40">
            Zurück
          </Button>
        </div>
        </Card>
      </>
    );
  }

  if (effectiveView === "lobby" && session) {
    const full = isLobbyFull(session.state);
    const isHost = session.host_id === myUserId;
    const teamModeEnabled = Boolean(session.state.teamModeEnabled);
    const claimedPlayers = session.state.players.filter((p) => p.userId);
    const teamsAssigned = !teamModeEnabled || claimedPlayers.every((p) => p.team);
    const canStart = full && teamsAssigned;
    return (
      <>
        {renderLobbyBackground()}
        <Card
          variant="spotlight"
          accent="draft"
          className="op-chatti-frame flex flex-col gap-4 max-w-md"
          style={{ backgroundColor: "rgba(10, 8, 6, 0.32)" }}
        >
        <div>
          <p className="text-sm text-black/60 dark:text-white/50">Einladungscode</p>
          <p className="font-mono text-2xl tracking-widest">{session.invite_code}</p>
        </div>
        {teamModeEnabled && isHost && (
          <p className="text-sm text-black/60 dark:text-white/50">
            Teile jeden Spieler einem Team zu, bevor du den Draft startest — danach lässt sich das nicht mehr ändern.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {session.state.players.map((p, i) => (
            <li
              key={i}
              className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-1">
                <span className="shrink-0">Sitz {i + 1}:</span>
                {p.userId ? (
                  <span key={p.userId} className="op-pop-in">
                    <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} team={p.team} />
                  </span>
                ) : (
                  <em className="text-black/40 dark:text-white/30">offen</em>
                )}
                {p.team && <span className="shrink-0">· Team {p.team}</span>}
                {p.userId === myUserId && <span className="shrink-0 text-mode-draft text-xs">Du</span>}
              </span>
              {teamModeEnabled && isHost && p.userId && (
                <div className="flex gap-1 shrink-0">
                  {(["A", "B"] as const).map((team) => (
                    <button
                      key={team}
                      onClick={() => handleAssignTeam(i, p.team === team ? undefined : team)}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        p.team === team
                          ? "bg-mode-draft text-poster-ink"
                          : "border border-black/15 dark:border-white/15 text-black/60 dark:text-white/50"
                      }`}
                    >
                      Team {team}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!isSpectator && !full && friends.length > 0 && (
          <div className="op-card flex flex-col gap-2 border-2 border-mode-draft/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mode-draft">📨 Freund einladen</p>
            <ul className="flex flex-col gap-1.5">
              {friends.map((f) => {
                const alreadyInLobby = session.state.players.some((p) => p.userId === f.userId);
                const invited = invitedFriendIds.includes(f.userId);
                return (
                  <li key={f.userId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{f.username}</span>
                    <Button
                      variant={alreadyInLobby || invited ? "secondary" : "primary"}
                      className="shrink-0 px-3 py-1.5 text-xs"
                      disabled={alreadyInLobby || invited}
                      onClick={() => handleInviteFriend(f.userId)}
                    >
                      {alreadyInLobby ? "schon da" : invited ? "eingeladen ✓" : "einladen"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {isSpectator && <p className="text-sm text-black/50 dark:text-white/40">Du schaust nur zu.</p>}
        {isHost && (
          <Button onClick={startDraft} disabled={!canStart}>
            {!full ? "Warte auf weitere Spieler…" : !teamsAssigned ? "Teile erst alle Teams zu…" : "Draft starten"}
          </Button>
        )}
        {!isHost && !full && <p className="text-sm text-black/50 dark:text-white/40">Warte auf weitere Spieler…</p>}
        <Button variant="ghost" onClick={leaveLobby} className="self-start text-black/50 dark:text-white/40">
          {isHost ? "Lobby abbrechen" : "Verlassen"}
        </Button>
        </Card>
      </>
    );
  }

  if (effectiveView === "drafting" && session) {
    const player = currentPlayer(session.state);
    const myTurn = !isSpectator && player.userId === myUserId;
    const offered = session.state.rolledCharacterIds
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const disconnected = !isSpectator && player.userId && player.userId !== myUserId && isPlayerStale(player.lastSeenAt);
    const me = !isSpectator ? session.state.players.find((p) => p.userId === myUserId) : undefined;
    const myPicks = (me?.pickedCharacterIds ?? [])
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    return (
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        {renderFloatingEmotes()}
        <div>
          <div className="mb-4 flex flex-col items-start gap-1">
            <span
              key={session.state.round}
              className="op-round-flash font-[family-name:var(--font-display)] text-2xl font-semibold text-mode-draft"
            >
              Runde {session.state.round} von {session.state.teamSize}
            </span>
            <p key={player.id} className="op-turn-pulse text-sm">
              Am Zug: <span className="font-semibold">{player.name}</span>
              {myTurn && <span className="text-mode-draft"> (du!)</span>}
            </p>
          </div>
          {disconnected && (
            <p className="mb-3 text-sm text-danger">
              ⚠️ {player.name} scheint die Verbindung verloren zu haben — der Entwurf pausiert, bis die Person zurück ist.
            </p>
          )}
          {myPicks.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5">
              <p className="text-xs uppercase tracking-[0.2em] text-black/50 dark:text-white/40">Dein Team</p>
              <div className="flex flex-wrap gap-2">
                {myPicks.map((c) => (
                  <div key={c.id} className="op-pop-in flex flex-col items-center gap-1">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 rounded-lg border-2 object-cover object-top shadow"
                        style={{ borderColor: "var(--mode-draft)" }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-mode-draft text-[10px]">
                        {c.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <RollPanel
            offered={offered}
            skipsLeft={player.skipsLeft}
            onPick={applyPick}
            onSkip={applySkip}
            readOnly={!myTurn}
          />
          {!myTurn && !isSpectator && !disconnected && (
            <p className="mt-3 text-sm text-black/50 dark:text-white/40">Warte, bis {player.name} gezogen hat…</p>
          )}
          {!isSpectator && (
            <Button variant="ghost" onClick={handleLeaveRound} className="mt-4 self-start text-black/50 dark:text-white/40">
              Runde verlassen
            </Button>
          )}
        </div>
        <aside className="flex flex-col gap-2 sm:gap-4">
          {session.state.players.map((p) => (
            <Card
              key={p.id}
              variant="plain"
              accent="draft"
              className={`op-chatti-frame p-2 sm:p-3 transition-shadow ${p.id === player.id ? "op-current-turn-glow" : ""}`}
            >
              <p className="mb-2 flex items-center gap-1 text-sm">
                <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} team={p.team} />
                {p.id === player.id && <span className="shrink-0 text-mode-draft">🎯</span>}
                {p.team && <span className="shrink-0 text-mode-draft">· Team {p.team}</span>}
                <span className="shrink-0">
                  ({p.pickedCharacterIds.length}/{session.state.teamSize})
                </span>
              </p>
              {/* Full pick-name list hidden below sm (Boss, 2026-10-15: draft picks
                  felt too small/cramped on mobile) — the own-picks thumbnail row
                  above the roll panel already shows these; this list just ate into
                  the vertical budget useFitScreen scales down to fit one screen. */}
              <ul className="hidden space-y-1 text-sm text-black/70 dark:text-white/60 sm:block">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id} className="op-slide-in">
                    {characters.find((c) => c.id === id)?.name}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {renderChatBar()}
        </aside>
      </div>
    );
  }

  if (effectiveView === "roles" && session) {
    const me = session.state.players.find((p) => p.userId === myUserId);
    const roster = me ? getTeam(session.state, me.id, characters) : [];
    const readyCount = session.state.players.filter((p) => p.rolesReady).length;
    const stalePlayers = session.state.players.filter(
      (p) => p.userId && p.userId !== myUserId && !p.rolesReady && isPlayerStale(p.lastSeenAt)
    );

    return (
      <div className="flex flex-col gap-4">
        {renderFloatingEmotes()}
        <p className="text-sm text-black/60 dark:text-white/50">
          Bereit: {readyCount}/{session.state.players.length}
        </p>
        {stalePlayers.length > 0 && (
          <p className="text-sm text-danger">
            ⚠️ {stalePlayers.map((p) => p.name).join(", ")} scheint die Verbindung verloren zu haben — es pausiert, bis die
            Person zurück ist.
          </p>
        )}
        {isSpectator || !me ? (
          <p className="text-sm text-black/50 dark:text-white/40">Warte, bis alle Spieler ihre Rollen zugeteilt haben…</p>
        ) : me.rolesReady ? (
          <p className="text-sm text-black/50 dark:text-white/40">Rollen bestätigt — warte auf die anderen Spieler…</p>
        ) : (
          <RoleAssignmentPanel
            roster={roster}
            assignments={me.roleAssignments}
            onAssign={handleAssignRole}
            onConfirm={handleConfirmRoles}
            confirmLabel="Bereit"
          />
        )}
        {renderChatBar()}
        {!isSpectator && (
          <Button variant="ghost" onClick={handleLeaveRound} className="self-start text-black/50 dark:text-white/40">
            Runde verlassen
          </Button>
        )}
      </div>
    );
  }

  if (effectiveView === "result" && session) {
    const isTeamMode = session.state.players.some((p) => p.team);
    let winnerLabel = "";
    if (session.battle) {
      if (isTeamMode) {
        const names = session.state.players
          .filter((p) => p.team === session.battle!.winnerTeam)
          .map((p) => p.name)
          .join(" & ");
        winnerLabel = `Team ${session.battle.winnerTeam} (${names})`;
      } else {
        winnerLabel = session.state.players[resolveWinnerIndex(session.state, session.battle)]?.name ?? "";
      }
    }
    const me = session.state.players.find((p) => p.userId === myUserId);
    const myWon =
      !isSpectator && me && session.battle
        ? me.team
          ? me.team === session.battle.winnerTeam
          : session.state.players.indexOf(me) === resolveWinnerIndex(session.state, session.battle)
        : null;
    const mvp = computeMvp(session);
    const seatedCount = session.state.players.filter((p) => p.userId).length;
    const rematchReadyCount = session.state.players.filter((p) => p.rematchReady).length;
    return (
      <div className="flex flex-col gap-6">
        {renderFloatingEmotes()}
        {session.battle && <VictoryBanner won={myWon} label={myWon === null ? `${winnerLabel} gewinnt!` : undefined} />}
        <h2 className="text-xl font-semibold">Draft beendet</h2>
        {!isSpectator && me && (
          <div className="flex flex-col gap-2">
            {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
            <div className="flex items-center gap-3">
              <img src="/live-draft/badge-rematch.png" alt="" className="h-20 w-20 shrink-0" />
              <Button onClick={handleVoteRematch} disabled={me.rematchReady} className="flex-1 py-3 text-lg">
                {me.rematchReady ? "Warte auf die anderen…" : "Rematch"}
              </Button>
            </div>
            {me.rematchReady && (
              <div className="flex flex-wrap items-center gap-2">
                {session.state.players
                  .filter((p) => p.userId)
                  .map((p) => (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        p.rematchReady
                          ? "border-mode-draft bg-mode-draft/15 text-mode-draft"
                          : "border-black/15 text-black/50 dark:border-white/15 dark:text-white/40"
                      }`}
                    >
                      {p.rematchReady ? "✅" : "⏳"} {p.name}
                    </span>
                  ))}
                <span className="text-xs text-black/50 dark:text-white/40">
                  ({rematchReadyCount}/{seatedCount} bereit)
                </span>
              </div>
            )}
            {renderChatBar()}
          </div>
        )}
        {mvp && (
          <p className="op-pop-in flex items-center gap-2 text-sm">
            <img src="/live-draft/badge-mvp.png" alt="MVP" className="h-14 w-14" />
            <span className="font-semibold">MVP:</span> {mvp.characterName} ({mvp.playerName})
          </p>
        )}
        {newAchievements.length > 0 && (
          <div className="op-pop-in rounded-xl border border-accent bg-accent/10 p-3">
            <p className="mb-1 text-sm font-semibold text-accent-ink">🏆 Neue Erfolge freigeschaltet!</p>
            <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
              {newAchievements.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span> — {a.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {session.state.players.map((p) => (
            <Card key={p.id} variant="plain" accent="draft" className="op-chatti-frame p-3">
              <p className="mb-2">
                <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} team={p.team} />
              </p>
              <ul className="space-y-1 text-sm">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        {session.battle ? (
          <Card variant="plain" accent="draft" className="op-chatti-frame p-4">
            <p className="mb-2 font-semibold">Kampfsimulation: {winnerLabel} gewinnt!</p>
            <AnimatedBattleLog battle={session.battle} />
          </Card>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/40">Kampfsimulation wird berechnet…</p>
        )}
        <Button variant="ghost" onClick={handleLeaveRound} className="self-start text-black/50 dark:text-white/40">
          Zur Startseite
        </Button>
      </div>
    );
  }

  return null;
}
