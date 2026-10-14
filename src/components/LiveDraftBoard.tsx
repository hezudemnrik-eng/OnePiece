"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { characters, type Role } from "@/lib/characters";
import {
  allRolesConfirmed,
  assignRole,
  assignTeam,
  autoPick,
  claimSeat,
  confirmRoles,
  createDraft,
  currentPlayer,
  DRAFT_EMOTES,
  firstOpenSeat,
  getTeam,
  isLobbyFull,
  pickCharacter,
  resolveTeamRoleConflicts,
  sendEmote,
  skipRoll,
  touchPresence,
  type DraftEmote,
  type DraftTeam,
} from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { getRoleAdjustedVersions } from "@/lib/crewRoles";
import { checkDraftAchievements, type DraftAchievement } from "@/lib/draftAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { FRAME_IMAGES } from "@/lib/frameImages";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import { LoadingSpinner } from "./LoadingSpinner";
import {
  createLiveDraft,
  ensureSupabaseSession,
  fetchLiveDraftByCode,
  fetchLiveDraftById,
  fetchPublicProfilesCosmetics,
  fetchShopItems,
  getCurrentAuthUser,
  incrementXp,
  recordMatchResult,
  subscribeLiveDraft,
  unlockAchievement,
  writeLiveDraft,
  type LiveDraftSession,
  type PublicProfileCosmetics,
  type ShopItem,
} from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RoleAssignmentPanel } from "./RoleAssignmentPanel";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

const PICK_SECONDS = 30;
const ROLES_SECONDS = 45;
const NICKNAME_KEY = "op-nickname";
const PRESENCE_INTERVAL_MS = 7000;
const STALE_MS = 15000;

type View = "loading" | "home" | "create-form" | "join-form" | "lobby" | "drafting" | "roles" | "result";

function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "Spieler";
  } catch {
    return "Spieler";
  }
}

/** Avatar+Rahmen+Titel+Namensfarbe for a seated player, mirroring FriendsPanel's Avatar — falls back to the bare name when no profile cosmetics are loaded yet (e.g. an open seat, or before the lookup resolves). */
function PlayerIdentity({
  userId,
  name,
  cosmetics,
  shopItems,
}: {
  userId?: string | null;
  name: string;
  cosmetics: Record<string, PublicProfileCosmetics>;
  shopItems: ShopItem[];
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
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className={`h-7 w-7 rounded-full object-cover object-top ${frameImage ? "" : frameClass}`}
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
  const autoJoinedRef = useRef(false);
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

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPickFiredRef = useRef(false);
  const autoConfirmRolesFiredRef = useRef(false);
  const matchRecordedRef = useRef(false);
  const achievementsCheckedRef = useRef(false);
  const lastHeartbeatRef = useRef(0);

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

  // Lets the Übersicht's "weiterspielen" links (/draft/live?code=XXXX) jump
  // straight back into a lobby or in-progress draft without retyping the code.
  useEffect(() => {
    if (!myUserId || autoJoinedRef.current) return;
    const code = searchParams.get("code");
    if (!code) return;
    autoJoinedRef.current = true;
    handleJoin(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function attach(s: LiveDraftSession) {
    setSession(s);
    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeLiveDraft(s.id, (updated) => {
      setSession(updated);
      autoPickFiredRef.current = false;
      autoConfirmRolesFiredRef.current = false;
    });

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
    const found = await fetchLiveDraftByCode(codeOverride ?? codeInput);
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
    const result = await writeLiveDraft(session.id, session.updated_at, { phase: "drafting" });
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
  useEffect(() => {
    if (!session || !myUserId || isSpectator) return;
    if (effectiveView !== "drafting" && effectiveView !== "roles") return;
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

  // Only the current player's own browser fires the timeout auto-pick, so
  // two tabs never race to both auto-pick the same turn.
  useEffect(() => {
    if (view !== "drafting" || !session || !myUserId || isSpectator) return;
    const player = currentPlayer(session.state);
    if (player.userId !== myUserId) return;
    const elapsed = (nowTick - new Date(session.state.turnStartedAt).getTime()) / 1000;
    if (elapsed >= PICK_SECONDS && !autoPickFiredRef.current) {
      autoPickFiredRef.current = true;
      const next = autoPick(session.state);
      writeLiveDraft(session.id, session.updated_at, { state: next }).then((result) => {
        if (result.session) setSession(result.session);
      });
    }
  }, [nowTick, view, session, myUserId, isSpectator]);

  // The host's browser moves the draft into the role-assignment phase once
  // it finishes, so exactly one client writes the transition instead of
  // every client racing to.
  useEffect(() => {
    if (!session || session.phase !== "drafting" || !session.state.finished) return;
    if (session.host_id !== myUserId) return;
    writeLiveDraft(session.id, session.updated_at, { phase: "roles" }).then((r) => {
      if (r.session) setSession(r.session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.finished, session?.phase, myUserId]);

  // The host's browser computes the battle result once every seated player
  // has confirmed their role assignments, so exactly one client writes it.
  useEffect(() => {
    if (!session || session.phase !== "roles" || !allRolesConfirmed(session.state)) return;
    if (session.host_id !== myUserId) return;

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
    const won = me.team ? me.team === battle.winnerTeam : session.state.players.indexOf(me) === (battle.winnerTeam === "A" ? 0 : 1);
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

  // Auto-confirms this viewer's roles (with whatever they've assigned so
  // far, possibly nothing) if they sit on the role-assignment screen too
  // long — mirrors the pick timer so a quiet player can't stall the match.
  useEffect(() => {
    if (effectiveView !== "roles" || !session || !myUserId || isSpectator) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me || me.rolesReady) return;
    const elapsed = (nowTick - new Date(session.state.turnStartedAt).getTime()) / 1000;
    if (elapsed >= ROLES_SECONDS && !autoConfirmRolesFiredRef.current) {
      autoConfirmRolesFiredRef.current = true;
      handleConfirmRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, effectiveView, session, myUserId, isSpectator]);

  // Every participant's own browser records its own win/loss once — not
  // just the host's — so the friend leaderboard reflects everyone.
  useEffect(() => {
    if (!session || session.phase !== "result" || !session.battle || !myUserId || isSpectator) return;
    if (matchRecordedRef.current) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    matchRecordedRef.current = true;
    const won = me.team ? me.team === session.battle.winnerTeam : session.state.players.indexOf(me) === (session.battle.winnerTeam === "A" ? 0 : 1);
    const opponents = session.state.players.filter((p) => p.id !== me.id).map((p) => p.name).join(", ");
    recordMatchResult("live-draft", opponents, won ? "win" : "loss");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.finished, session?.phase, myUserId]);

  async function handleSendEmote(emote: DraftEmote) {
    if (!session || !myUserId) return;
    const me = session.state.players.find((p) => p.userId === myUserId);
    if (!me) return;
    const next = sendEmote(session.state, me.id, emote);
    const result = await writeLiveDraft(session.id, session.updated_at, { state: next });
    if (result.session) setSession(result.session);
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
    setView("home");
  }

  function chatLabel(playerId: string): string {
    return session?.state.players.find((p) => p.id === playerId)?.name ?? "?";
  }

  // Chat is intentionally limited to a fixed set of preset reactions (Q108)
  // — no free text, so no moderation surface needed for a feature this small.
  function renderChatBar() {
    if (!session || isSpectator) return null;
    const recent = session.state.chatLog?.slice(-6) ?? [];
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 dark:border-white/15 p-3">
        <div className="flex flex-wrap gap-1.5">
          {DRAFT_EMOTES.map((emote) => (
            <button
              key={emote}
              onClick={() => handleSendEmote(emote)}
              className="rounded-full border border-black/15 dark:border-white/15 px-2 py-1 text-base transition hover:border-mode-draft/50"
            >
              {emote}
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-black/50 dark:text-white/40">
            {recent.map((m, i) => (
              <li key={i}>
                {chatLabel(m.playerId)}: {m.emote}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (effectiveView === "loading") {
    return <LoadingSpinner label="Verbinde…" />;
  }

  if (effectiveView === "home") {
    return (
      <Card variant="spotlight" accent="draft" className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <Input value={nickname} onChange={(e) => setNickname(e.target.value || "Spieler")} />
        </label>
        <div className="flex gap-3">
          <Button onClick={() => setView("create-form")}>Lobby erstellen</Button>
          <Button variant="secondary" onClick={() => setView("join-form")}>
            Mit Code beitreten
          </Button>
        </div>
      </Card>
    );
  }

  if (effectiveView === "create-form") {
    return (
      <Card variant="spotlight" accent="draft" className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Anzahl Spieler (2 oder 4)
          <Select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            <option value={2}>2</option>
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
    );
  }

  if (effectiveView === "join-form") {
    return (
      <Card variant="spotlight" accent="draft" className="flex flex-col gap-4 max-w-md">
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
      <Card variant="spotlight" accent="draft" className="flex flex-col gap-4 max-w-md">
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
                  <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} />
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
        {isSpectator && <p className="text-sm text-black/50 dark:text-white/40">Du schaust nur zu.</p>}
        {isHost && (
          <Button onClick={startDraft} disabled={!canStart}>
            {!full ? "Warte auf weitere Spieler…" : !teamsAssigned ? "Teile erst alle Teams zu…" : "Draft starten"}
          </Button>
        )}
        {!isHost && !full && <p className="text-sm text-black/50 dark:text-white/40">Warte auf weitere Spieler…</p>}
        <Button variant="ghost" onClick={backToHome} className="self-start text-black/50 dark:text-white/40">
          Verlassen
        </Button>
      </Card>
    );
  }

  if (effectiveView === "drafting" && session) {
    const player = currentPlayer(session.state);
    const myTurn = !isSpectator && player.userId === myUserId;
    const elapsed = Math.floor((nowTick - new Date(session.state.turnStartedAt).getTime()) / 1000);
    const secondsLeft = Math.max(0, PICK_SECONDS - elapsed);
    const offered = session.state.rolledCharacterIds
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const disconnected = !isSpectator && player.userId && player.userId !== myUserId && isPlayerStale(player.lastSeenAt);

    return (
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p key={player.id} className="op-turn-pulse text-sm">
              Am Zug: <span className="font-semibold">{player.name}</span>
              {myTurn && <span className="text-mode-draft"> (du!)</span>} · Runde {session.state.round}
            </p>
            <TimerBar secondsLeft={secondsLeft} totalSeconds={PICK_SECONDS} />
          </div>
          {disconnected && (
            <p className="mb-3 text-sm text-danger">
              ⚠️ {player.name} scheint die Verbindung verloren zu haben — der Entwurf pausiert, bis die Person zurück ist.
            </p>
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
        </div>
        <aside className="flex flex-col gap-4">
          {session.state.players.map((p) => (
            <Card key={p.id} variant="framed" accent="draft" className="p-3">
              <p className="mb-2 flex items-center gap-1 text-sm">
                <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} />
                {p.team && <span className="shrink-0 text-mode-draft">· Team {p.team}</span>}
                <span className="shrink-0">
                  ({p.pickedCharacterIds.length}/{session.state.teamSize})
                </span>
              </p>
              <ul className="space-y-1 text-sm text-black/70 dark:text-white/60">
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
    const elapsed = Math.floor((nowTick - new Date(session.state.turnStartedAt).getTime()) / 1000);
    const secondsLeft = Math.max(0, ROLES_SECONDS - elapsed);
    const readyCount = session.state.players.filter((p) => p.rolesReady).length;
    const stalePlayers = session.state.players.filter(
      (p) => p.userId && p.userId !== myUserId && !p.rolesReady && isPlayerStale(p.lastSeenAt)
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-black/60 dark:text-white/50">
            Bereit: {readyCount}/{session.state.players.length}
          </p>
          <TimerBar secondsLeft={secondsLeft} totalSeconds={ROLES_SECONDS} />
        </div>
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
        winnerLabel = session.state.players[session.battle.winnerTeam === "A" ? 0 : 1]?.name ?? "";
      }
    }
    const me = session.state.players.find((p) => p.userId === myUserId);
    const myWon =
      !isSpectator && me && session.battle
        ? me.team
          ? me.team === session.battle.winnerTeam
          : session.state.players.indexOf(me) === (session.battle.winnerTeam === "A" ? 0 : 1)
        : null;
    return (
      <div className="flex flex-col gap-6">
        {session.battle && <VictoryBanner won={myWon} label={myWon === null ? `${winnerLabel} gewinnt!` : undefined} />}
        <h2 className="text-xl font-semibold">Draft beendet</h2>
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
            <Card key={p.id} variant="framed" accent="draft" className="p-3">
              <p className="mb-2">
                <PlayerIdentity userId={p.userId} name={p.name} cosmetics={cosmetics} shopItems={shopItems} />
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
          <Card variant="framed" accent="draft" className="p-4">
            <p className="mb-2 font-semibold">Kampfsimulation: {winnerLabel} gewinnt!</p>
            <AnimatedBattleLog battle={session.battle} />
          </Card>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/40">Kampfsimulation wird berechnet…</p>
        )}
        <Button onClick={backToHome} className="self-start">
          Zur Startseite
        </Button>
      </div>
    );
  }

  return null;
}
