import type { Character, Role } from "./characters";

export type DraftTeam = "A" | "B";

export type DraftPlayer = {
  id: string;
  name: string;
  pickedCharacterIds: string[];
  /** Set when the draft is Team-vs-Team; undefined for free-for-all drafts. */
  team?: DraftTeam;
  /** Supabase auth.uid() of whoever claimed this seat, for live drafts; undefined/null = open seat. */
  userId?: string | null;
  /** How many more times this player may reroll their current offer this turn — resets to skipsPerTurn at the start of each of their turns (see advanceTurn), rather than being a fixed pool for the whole draft. */
  skipsLeft: number;
  /** Crew position assigned to each of this player's own picked characters (characterId -> Role), set after the draft finishes. A role can only be held by one of this player's characters at a time (see assignRole) — picking the character's own natural role (Character.role) gives a battle bonus, any other specific role a penalty; "Sonstige" is always neutral. */
  roleAssignments?: Record<string, Role>;
  /** Whether this player has confirmed their role assignments (or chosen to skip them) and is ready for battle. */
  rolesReady?: boolean;
  /** Whether this player has voted for a rematch on the result screen (see voteRematch) — the rematch lobby is only created once every seated player has. */
  rematchReady?: boolean;
  /** ISO timestamp of this player's last heartbeat in a live draft — lets other clients tell a quiet turn apart from a genuinely closed tab (see touchPresence). Unused in hotseat/solo modes. */
  lastSeenAt?: string;
};

/** Chat is intentionally limited to a fixed set of preset reactions (Q108) rather than free text — no moderation surface needed for a feature this small. */
/** Chatti-drawn emote icon ids (Boss, 2026-10-15: "alles designs und Icon und Emotes sollen von chatti erstellt werden" — no unicode/stock emoji). Files live under /public/live-draft/emotes/<id>.png, see DRAFT_EMOTE_LABELS in LiveDraftBoard.tsx for the German alt text. */
export const DRAFT_EMOTES = ["thumbsup", "laugh", "shocked", "fire", "angry", "wow", "heart", "peek"] as const;
export type DraftEmote = (typeof DRAFT_EMOTES)[number];
export type ChatMessage = { playerId: string; emote: DraftEmote; at: string };

const MAX_CHAT_LOG = 12;

export type DraftState = {
  players: DraftPlayer[];
  availableCharacterIds: string[];
  teamSize: number;
  currentPlayerIndex: number;
  round: number;
  direction: 1 | -1; // snake draft reverses direction each round
  finished: boolean;
  /** Names of people watching without drafting themselves. */
  spectators: string[];
  /** Whether the host can assign players to Team A/B in the lobby (see assignTeam). Once the draft leaves the lobby phase, assignments are frozen — there's no mutator that changes `team` after that point. */
  teamModeEnabled?: boolean;
  /** ISO timestamp of when the current turn began — lets every client in a
   * live draft agree on the pick-timer countdown instead of each running
   * its own clock from whenever it happened to render. Unused in hotseat
   * mode (each browser already has a single, authoritative local timer). */
  turnStartedAt: string;
  /** The characters currently offered to the player on turn — pick one
   * (pickCharacter) or reroll the whole offer (skipRoll). Empty once the
   * draft has finished. Normally OFFER_COUNT long; shorter only if the
   * available pool runs lower than that. Offering a small choice instead
   * of a single take-it-or-leave-it roll is the main lever against the
   * draft feeling like pure gambling — you always have some say. */
  rolledCharacterIds: string[];
  /** How many times the player on turn may reroll their current offer, refilled to this value at the start of each of their turns. */
  skipsPerTurn: number;
  /** Total rerolls each player has spent across the whole draft (playerId -> count) — skipsLeft alone can't answer this since it resets every turn. Used for the "no rerolls" achievement. */
  rerollsUsed?: Record<string, number>;
  /** Preset emote reactions sent during the draft (Q108), newest last, capped at MAX_CHAT_LOG. */
  chatLog?: ChatMessage[];
  /** Invite code of a fresh lobby created once every seated player has voted ready for a rematch (see voteRematch/allRematchReady) — lets every participant jump straight into the same new lobby together instead of one starting alone and the rest having to be given a code. Set once and never cleared, since a finished draft's state is never written again after this. */
  rematchInviteCode?: string;
};

const OFFER_COUNT = 3;

function rollMultiple(pool: string[], count: number, rng: () => number): string[] {
  const copy = [...pool];
  const picked: string[] = [];
  while (picked.length < count && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

export function createDraft(
  playerNames: string[],
  allCharacterIds: string[],
  teamSize: number,
  options: {
    teams?: DraftTeam[];
    teamModeEnabled?: boolean;
    spectators?: string[];
    skipsPerTurn?: number;
    rng?: () => number;
  } = {}
): DraftState {
  const skipsPerTurn = options.skipsPerTurn ?? 1;
  const rng = options.rng ?? Math.random;
  const availableCharacterIds = [...allCharacterIds];
  return {
    players: playerNames.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      pickedCharacterIds: [],
      team: options.teams?.[i],
      skipsLeft: skipsPerTurn,
    })),
    availableCharacterIds,
    teamSize,
    currentPlayerIndex: 0,
    round: 1,
    direction: 1,
    finished: false,
    spectators: options.spectators ?? [],
    teamModeEnabled: options.teamModeEnabled,
    turnStartedAt: new Date().toISOString(),
    rolledCharacterIds: rollMultiple(availableCharacterIds, OFFER_COUNT, rng),
    skipsPerTurn,
  };
}

/** All characters picked so far by every player on a given side, for Team-vs-Team drafts. */
export function getTeamSidePicks(state: DraftState, team: DraftTeam): string[] {
  return state.players.filter((p) => p.team === team).flatMap((p) => p.pickedCharacterIds);
}

/** The first seat nobody has claimed yet, for a live draft's lobby. -1 if the lobby is full. */
export function firstOpenSeat(state: DraftState): number {
  return state.players.findIndex((p) => !p.userId);
}

/** Claims an open seat for a live draft. No-op (returns the same state) if the seat is already taken. */
export function claimSeat(state: DraftState, seatIndex: number, userId: string, name: string): DraftState {
  const seat = state.players[seatIndex];
  if (!seat || seat.userId) return state;
  const players = state.players.map((p, i) => (i === seatIndex ? { ...p, userId, name } : p));
  return { ...state, players };
}

/** Frees a seat back up (the inverse of claimSeat) — used when a non-host player leaves a lobby. */
export function clearSeat(state: DraftState, userId: string): DraftState {
  const players = state.players.map((p) => (p.userId === userId ? { ...p, userId: undefined, name: "", team: undefined } : p));
  return { ...state, players };
}

/** Assigns (or clears, with `team: undefined`) the host's Team A/B pick for a seat. Only meant to be called while the draft is still in its lobby phase — callers are expected to stop offering this once the draft starts, which is what makes the assignment "locked" from then on. */
export function assignTeam(state: DraftState, seatIndex: number, team: DraftTeam | undefined): DraftState {
  const seat = state.players[seatIndex];
  if (!seat) return state;
  const players = state.players.map((p, i) => (i === seatIndex ? { ...p, team } : p));
  return { ...state, players };
}

export function isLobbyFull(state: DraftState): boolean {
  return state.players.every((p) => Boolean(p.userId));
}

/**
 * Picks a random starting player instead of always defaulting to seat 0 —
 * call this once, right when a live draft actually leaves the lobby.
 * createDraft always starts at index 0, but in a live draft seat 0 is
 * always the host (claimSeat(initial, 0, ...) at lobby creation), so
 * without this the host would have the first-pick advantage in every
 * single game (Boss, 2026-10-17: "jeder soll die gleichen chancen haben").
 * No-op once the draft has actually started picking.
 */
export function randomizeStartingPlayer(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.players.length <= 1) return state;
  if (state.round > 1 || state.players.some((p) => p.pickedCharacterIds.length > 0)) return state;
  const currentPlayerIndex = Math.floor(rng() * state.players.length);
  return { ...state, currentPlayerIndex, turnStartedAt: new Date().toISOString() };
}

export function currentPlayer(state: DraftState): DraftPlayer {
  return state.players[state.currentPlayerIndex];
}

function advanceTurn(state: DraftState, rng: () => number): DraftState {
  // Check finished *before* touching round/direction — the last pick of the
  // draft often also lands on a snake-turn boundary (every player's very
  // last pick does, for an even player count), and incrementing round for a
  // turn that never actually happens left the finished state one round
  // ahead of teamSize (Boss, 2026-10-17: "Runde bleibt bei 6 von 5 stehen" —
  // with teamSize 5 the round counter kept ticking to 6 right as the draft
  // finished).
  const finished = state.players.every((p) => p.pickedCharacterIds.length >= state.teamSize);
  if (finished) {
    return { ...state, finished: true, turnStartedAt: new Date().toISOString(), rolledCharacterIds: [] };
  }

  const playerCount = state.players.length;
  let { currentPlayerIndex, round, direction } = state;

  const nextIndex = currentPlayerIndex + direction;
  if (nextIndex < 0 || nextIndex >= playerCount) {
    // snake draft: reverse direction, same player picks again (classic "snake")
    direction = direction === 1 ? -1 : 1;
    round += 1;
  } else {
    currentPlayerIndex = nextIndex;
  }

  // Refill the now-current player's skips for their fresh turn.
  const players = state.players.map((p, i) => (i === currentPlayerIndex ? { ...p, skipsLeft: state.skipsPerTurn } : p));

  return {
    ...state,
    players,
    currentPlayerIndex,
    round,
    direction,
    finished: false,
    turnStartedAt: new Date().toISOString(),
    rolledCharacterIds: rollMultiple(state.availableCharacterIds, OFFER_COUNT, rng),
  };
}

/** Picks one of the currently offered characters for the player on turn. No-op if characterId isn't actually one of the offered ones. */
export function pickCharacter(state: DraftState, characterId: string, rng: () => number = Math.random): DraftState {
  if (state.finished || !state.rolledCharacterIds.includes(characterId)) return state;
  const player = currentPlayer(state);
  if (player.pickedCharacterIds.length >= state.teamSize) return state;

  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, pickedCharacterIds: [...p.pickedCharacterIds, characterId] } : p
  );
  const availableCharacterIds = state.availableCharacterIds.filter((id) => id !== characterId);

  return advanceTurn({ ...state, players, availableCharacterIds }, rng);
}

/** Rerolls the whole offer for the player on turn, spending one of their skips. No-op once skips run out. */
export function skipRoll(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.finished || state.rolledCharacterIds.length === 0) return state;
  const player = currentPlayer(state);
  if (player.skipsLeft <= 0) return state;

  const players = state.players.map((p) => (p.id === player.id ? { ...p, skipsLeft: p.skipsLeft - 1 } : p));
  const rolledCharacterIds = rollMultiple(state.availableCharacterIds, OFFER_COUNT, rng);
  const rerollsUsed = { ...state.rerollsUsed, [player.id]: (state.rerollsUsed?.[player.id] ?? 0) + 1 };

  return { ...state, players, rolledCharacterIds, rerollsUsed, turnStartedAt: new Date().toISOString() };
}

/** Used when the pick timer runs out: the player gets a random one of whatever was currently offered. */
export function autoPick(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.finished || state.rolledCharacterIds.length === 0) return state;
  const characterId = state.rolledCharacterIds[Math.floor(rng() * state.rolledCharacterIds.length)];
  return pickCharacter(state, characterId, rng);
}

export function getTeam(state: DraftState, playerId: string, allCharacters: Character[]): Character[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return player.pickedCharacterIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c));
}

/**
 * Assigns a crew position to one of this player's own picked characters.
 * Enforced unique per player (not shared across teammates in Team-vs-Team
 * mode — see crewRoles.ts) — if another of their characters already holds
 * that role, it's cleared from them first (a swap, not a conflict error).
 * No-op if the draft isn't finished yet or the character isn't actually
 * one of this player's picks.
 */
export function assignRole(state: DraftState, playerId: string, characterId: string, role: Role): DraftState {
  if (!state.finished) return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.pickedCharacterIds.includes(characterId)) return state;

  const nextAssignments: Record<string, Role> = { ...player.roleAssignments };
  for (const [existingCharId, existingRole] of Object.entries(nextAssignments)) {
    if (existingRole === role && existingCharId !== characterId) delete nextAssignments[existingCharId];
  }
  nextAssignments[characterId] = role;

  const players = state.players.map((p) => (p.id === playerId ? { ...p, roleAssignments: nextAssignments } : p));
  return { ...state, players };
}

/** Marks a player ready for battle — role assignment is optional, this can be called with nothing assigned to just fight with unmodified stats. */
export function confirmRoles(state: DraftState, playerId: string): DraftState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, rolesReady: true } : p));
  return { ...state, players };
}

/** True once every seated (claimed) player has confirmed their roles — the live draft's battle computation waits for this before running. */
export function allRolesConfirmed(state: DraftState): boolean {
  return state.players.filter((p) => p.userId || p.pickedCharacterIds.length > 0).every((p) => p.rolesReady);
}

/** Votes this player ready for a rematch on the result screen (see allRematchReady). */
export function voteRematch(state: DraftState, playerId: string): DraftState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, rematchReady: true } : p));
  return { ...state, players };
}

/** True once every seated player has voted for a rematch — only then is the fresh lobby created, so nobody starts one alone while waiting for the others. */
export function allRematchReady(state: DraftState): boolean {
  return state.players.filter((p) => p.userId).every((p) => p.rematchReady);
}

/** Heartbeat for a live draft (Q109): each client periodically touches its own player's lastSeenAt so the others can tell a disconnected tab apart from a teammate who's just thinking — see LiveDraftBoard's presence effect and staleness check. */
export function touchPresence(state: DraftState, playerId: string): DraftState {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, lastSeenAt: new Date().toISOString() } : p));
  return { ...state, players };
}

/** Appends a preset emote reaction to the shared chat log (Q108). No-op for an unknown player. */
export function sendEmote(state: DraftState, playerId: string, emote: DraftEmote): DraftState {
  if (!state.players.some((p) => p.id === playerId)) return state;
  const chatLog = [...(state.chatLog ?? []), { playerId, emote, at: new Date().toISOString() }].slice(-MAX_CHAT_LOG);
  return { ...state, chatLog };
}

/**
 * Resolves crew-position conflicts between teammates in Team-vs-Team mode
 * (Q104), by lottery. assignRole only guards uniqueness within one player's
 * own roster, so two different players on the same team can each
 * independently end up assigning the same specific role (e.g. both pick
 * "Kapitän") — this scans every team for such clashes and, for each one,
 * randomly keeps a single claim while the rest fall back to "Sonstige".
 * No-op for free-for-all drafts (no teams at all). Call once, after every
 * player has confirmed their roles and before the battle is computed.
 */
export function resolveTeamRoleConflicts(state: DraftState, rng: () => number = Math.random): DraftState {
  const teams = new Set(state.players.map((p) => p.team).filter((t): t is DraftTeam => Boolean(t)));
  if (teams.size === 0) return state;

  const players = state.players.map((p) => ({ ...p, roleAssignments: { ...p.roleAssignments } }));
  for (const team of teams) {
    const teammates = players.filter((p) => p.team === team);
    const claims = new Map<Role, { player: (typeof players)[number]; characterId: string }[]>();
    for (const player of teammates) {
      for (const [characterId, role] of Object.entries(player.roleAssignments)) {
        if (role === "Sonstige") continue;
        const list = claims.get(role) ?? [];
        list.push({ player, characterId });
        claims.set(role, list);
      }
    }
    for (const claimants of claims.values()) {
      if (claimants.length <= 1) continue;
      const winnerIndex = Math.floor(rng() * claimants.length);
      claimants.forEach((claim, i) => {
        if (i !== winnerIndex) claim.player.roleAssignments[claim.characterId] = "Sonstige";
      });
    }
  }
  return { ...state, players };
}
