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
  firstOpenSeat,
  getTeam,
  isLobbyFull,
  pickCharacter,
  skipRoll,
  type DraftTeam,
} from "@/lib/draft";
import { simulateBattle, type BattleResult } from "@/lib/battle-sim";
import { getRoleAdjustedVersions } from "@/lib/crewRoles";
import { playAccept, playSkip, vibrate } from "@/lib/sfx";
import {
  createLiveDraft,
  ensureSupabaseSession,
  fetchLiveDraftByCode,
  fetchLiveDraftById,
  getCurrentAuthUser,
  recordMatchResult,
  subscribeLiveDraft,
  writeLiveDraft,
  type LiveDraftSession,
} from "@/lib/supabase";
import { AnimatedBattleLog } from "./AnimatedBattleLog";
import { RoleAssignmentPanel } from "./RoleAssignmentPanel";
import { RollPanel } from "./RollPanel";
import { TimerBar } from "./TimerBar";
import { VictoryBanner } from "./VictoryBanner";

const PICK_SECONDS = 30;
const ROLES_SECONDS = 45;
const NICKNAME_KEY = "op-nickname";

type View = "loading" | "home" | "create-form" | "join-form" | "lobby" | "drafting" | "roles" | "result";

function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "Spieler";
  } catch {
    return "Spieler";
  }
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

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPickFiredRef = useRef(false);
  const autoConfirmRolesFiredRef = useRef(false);
  const matchRecordedRef = useRef(false);

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
    return () => {
      cancelled = true;
    };
  }, []);

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
    let result: BattleResult;
    if (isTeamMode) {
      const sideA = session.state.players.filter((p) => p.team === "A");
      const sideB = session.state.players.filter((p) => p.team === "B");
      const sideAVersions = sideA.flatMap((p) => getRoleAdjustedVersions(getTeam(session.state, p.id, characters), p.roleAssignments));
      const sideANames = sideA.flatMap((p) => getTeam(session.state, p.id, characters).map((c) => c.name));
      const sideBVersions = sideB.flatMap((p) => getRoleAdjustedVersions(getTeam(session.state, p.id, characters), p.roleAssignments));
      const sideBNames = sideB.flatMap((p) => getTeam(session.state, p.id, characters).map((c) => c.name));
      result = simulateBattle(sideAVersions, sideANames, sideBVersions, sideBNames);
    } else {
      const [p1, p2] = session.state.players;
      const rosterA = getTeam(session.state, p1.id, characters);
      const rosterB = getTeam(session.state, p2.id, characters);
      result = simulateBattle(
        getRoleAdjustedVersions(rosterA, p1.roleAssignments),
        rosterA.map((c) => c.name),
        getRoleAdjustedVersions(rosterB, p2.roleAssignments),
        rosterB.map((c) => c.name)
      );
    }
    writeLiveDraft(session.id, session.updated_at, { phase: "result", battle: result }).then((r) => {
      if (r.session) setSession(r.session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state.players, session?.phase, myUserId]);

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

  function backToHome() {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    detachPolling();
    setSession(null);
    setErrorMsg("");
    setView("home");
  }

  if (effectiveView === "loading") {
    return <p className="text-sm text-black/60 dark:text-white/50">Verbinde…</p>;
  }

  if (effectiveView === "home") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value || "Spieler")}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setView("create-form")}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            Lobby erstellen
          </button>
          <button
            onClick={() => setView("join-form")}
            className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 font-medium"
          >
            Mit Code beitreten
          </button>
        </div>
      </div>
    );
  }

  if (effectiveView === "create-form") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Anzahl Spieler (2 oder 4)
          <select
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Teamgröße
          <input
            type="number"
            min={1}
            max={10}
            value={teamSize}
            onChange={(e) => setTeamSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        {playerCount === 4 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} />
            Team-vs-Team (2 gegen 2)
          </label>
        )}
        {errorMsg && <p className="text-sm text-amber-600">{errorMsg}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            Lobby erstellen
          </button>
          <button onClick={() => setView("home")} className="text-sm text-black/50 dark:text-white/40">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (effectiveView === "join-form") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Einladungscode
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="z. B. AB3XQ9"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 font-mono uppercase"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={joinAsSpectator} onChange={(e) => setJoinAsSpectator(e.target.checked)} />
          Nur zuschauen (nicht selbst draften)
        </label>
        {errorMsg && <p className="text-sm text-amber-600">{errorMsg}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => handleJoin()}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            Beitreten
          </button>
          <button onClick={() => setView("home")} className="text-sm text-black/50 dark:text-white/40">
            Zurück
          </button>
        </div>
      </div>
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
      <div className="flex flex-col gap-4 max-w-md">
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
              <span>
                Sitz {i + 1}: {p.userId ? p.name : <em className="text-black/40 dark:text-white/30">offen</em>}
                {p.team && ` · Team ${p.team}`}
                {p.userId === myUserId && <span className="ml-2 text-amber-600 text-xs">Du</span>}
              </span>
              {teamModeEnabled && isHost && p.userId && (
                <div className="flex gap-1 shrink-0">
                  {(["A", "B"] as const).map((team) => (
                    <button
                      key={team}
                      onClick={() => handleAssignTeam(i, p.team === team ? undefined : team)}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        p.team === team
                          ? "bg-amber-600 text-white"
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
          <button
            onClick={startDraft}
            disabled={!canStart}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700 disabled:opacity-40"
          >
            {!full ? "Warte auf weitere Spieler…" : !teamsAssigned ? "Teile erst alle Teams zu…" : "Draft starten"}
          </button>
        )}
        {!isHost && !full && <p className="text-sm text-black/50 dark:text-white/40">Warte auf weitere Spieler…</p>}
        <button onClick={backToHome} className="self-start text-sm text-black/50 dark:text-white/40">
          Verlassen
        </button>
      </div>
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

    return (
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p key={player.id} className="op-turn-pulse text-sm">
              Am Zug: <span className="font-semibold">{player.name}</span>
              {myTurn && <span className="text-amber-600"> (du!)</span>} · Runde {session.state.round}
            </p>
            <TimerBar secondsLeft={secondsLeft} totalSeconds={PICK_SECONDS} />
          </div>
          <RollPanel
            offered={offered}
            skipsLeft={player.skipsLeft}
            onPick={applyPick}
            onSkip={applySkip}
            readOnly={!myTurn}
          />
          {!myTurn && !isSpectator && (
            <p className="mt-3 text-sm text-black/50 dark:text-white/40">Warte, bis {player.name} gezogen hat…</p>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          {session.state.players.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="mb-2 text-sm font-semibold">
                {p.name}
                {p.team && <span className="text-amber-600"> · Team {p.team}</span>} ({p.pickedCharacterIds.length}/
                {session.state.teamSize})
              </p>
              <ul className="space-y-1 text-sm text-black/70 dark:text-white/60">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id} className="op-slide-in">
                    {characters.find((c) => c.id === id)?.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-black/60 dark:text-white/50">
            Bereit: {readyCount}/{session.state.players.length}
          </p>
          <TimerBar secondsLeft={secondsLeft} totalSeconds={ROLES_SECONDS} />
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {session.state.players.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="mb-2 font-semibold">{p.name}</p>
              <ul className="space-y-1 text-sm">
                {p.pickedCharacterIds.map((id) => (
                  <li key={id}>{characters.find((c) => c.id === id)?.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {session.battle ? (
          <div className="rounded-lg border border-amber-500/40 p-4">
            <p className="mb-2 font-semibold">Kampfsimulation: {winnerLabel} gewinnt!</p>
            <AnimatedBattleLog battle={session.battle} />
          </div>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/40">Kampfsimulation wird berechnet…</p>
        )}
        <button
          onClick={backToHome}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Zur Startseite
        </button>
      </div>
    );
  }

  return null;
}
