import type { Character } from "./characters";

export type DraftTeam = "A" | "B";

export type DraftPlayer = {
  id: string;
  name: string;
  pickedCharacterIds: string[];
  /** Set when the draft is Team-vs-Team; undefined for free-for-all drafts. */
  team?: DraftTeam;
  /** Supabase auth.uid() of whoever claimed this seat, for live drafts; undefined/null = open seat. */
  userId?: string | null;
  /** How many more times this player may reroll their current offered character. */
  skipsLeft: number;
};

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
  /** ISO timestamp of when the current turn began — lets every client in a
   * live draft agree on the pick-timer countdown instead of each running
   * its own clock from whenever it happened to render. Unused in hotseat
   * mode (each browser already has a single, authoritative local timer). */
  turnStartedAt: string;
  /** The character currently offered to the player on turn — accept it or
   * reroll (skipRoll). Null once the draft has finished. */
  rolledCharacterId: string | null;
  /** How many rerolls each player starts a draft with. */
  maxSkips: number;
};

function rollRandom(pool: string[], rng: () => number): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

export function createDraft(
  playerNames: string[],
  allCharacterIds: string[],
  teamSize: number,
  options: { teams?: DraftTeam[]; spectators?: string[]; maxSkips?: number; rng?: () => number } = {}
): DraftState {
  const maxSkips = options.maxSkips ?? 3;
  const rng = options.rng ?? Math.random;
  const availableCharacterIds = [...allCharacterIds];
  return {
    players: playerNames.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      pickedCharacterIds: [],
      team: options.teams?.[i],
      skipsLeft: maxSkips,
    })),
    availableCharacterIds,
    teamSize,
    currentPlayerIndex: 0,
    round: 1,
    direction: 1,
    finished: false,
    spectators: options.spectators ?? [],
    turnStartedAt: new Date().toISOString(),
    rolledCharacterId: rollRandom(availableCharacterIds, rng),
    maxSkips,
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

export function isLobbyFull(state: DraftState): boolean {
  return state.players.every((p) => Boolean(p.userId));
}

export function currentPlayer(state: DraftState): DraftPlayer {
  return state.players[state.currentPlayerIndex];
}

function advanceTurn(state: DraftState, rng: () => number): DraftState {
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

  const finished = state.players.every((p) => p.pickedCharacterIds.length >= state.teamSize);

  return {
    ...state,
    currentPlayerIndex,
    round,
    direction,
    finished,
    turnStartedAt: new Date().toISOString(),
    rolledCharacterId: finished ? null : rollRandom(state.availableCharacterIds, rng),
  };
}

/** Accepts the currently offered (rolled) character for the player on turn. */
export function acceptRoll(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.finished || !state.rolledCharacterId) return state;
  const characterId = state.rolledCharacterId;
  const player = currentPlayer(state);
  if (player.pickedCharacterIds.length >= state.teamSize) return state;

  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, pickedCharacterIds: [...p.pickedCharacterIds, characterId] } : p
  );
  const availableCharacterIds = state.availableCharacterIds.filter((id) => id !== characterId);

  return advanceTurn({ ...state, players, availableCharacterIds }, rng);
}

/** Rerolls the offered character for the player on turn, spending one of their skips. No-op once skips run out. */
export function skipRoll(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.finished || !state.rolledCharacterId) return state;
  const player = currentPlayer(state);
  if (player.skipsLeft <= 0) return state;

  const players = state.players.map((p) => (p.id === player.id ? { ...p, skipsLeft: p.skipsLeft - 1 } : p));
  const otherChoices = state.availableCharacterIds.filter((id) => id !== state.rolledCharacterId);
  const rolledCharacterId = rollRandom(otherChoices.length > 0 ? otherChoices : state.availableCharacterIds, rng);

  return { ...state, players, rolledCharacterId, turnStartedAt: new Date().toISOString() };
}

/** Used when the pick timer runs out: the player gets whatever was currently offered. */
export function autoPick(state: DraftState, rng: () => number = Math.random): DraftState {
  return acceptRoll(state, rng);
}

export function getTeam(state: DraftState, playerId: string, allCharacters: Character[]): Character[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return player.pickedCharacterIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c));
}
