import type { Character } from "./characters";

export type DraftTeam = "A" | "B";

export type DraftPlayer = {
  id: string;
  name: string;
  pickedCharacterIds: string[];
  /** Set when the draft is Team-vs-Team; undefined for free-for-all drafts. */
  team?: DraftTeam;
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
};

export function createDraft(
  playerNames: string[],
  allCharacterIds: string[],
  teamSize: number,
  options: { teams?: DraftTeam[]; spectators?: string[] } = {}
): DraftState {
  return {
    players: playerNames.map((name, i) => ({
      id: `p${i + 1}`,
      name,
      pickedCharacterIds: [],
      team: options.teams?.[i],
    })),
    availableCharacterIds: [...allCharacterIds],
    teamSize,
    currentPlayerIndex: 0,
    round: 1,
    direction: 1,
    finished: false,
    spectators: options.spectators ?? [],
  };
}

/** All characters picked so far by every player on a given side, for Team-vs-Team drafts. */
export function getTeamSidePicks(state: DraftState, team: DraftTeam): string[] {
  return state.players.filter((p) => p.team === team).flatMap((p) => p.pickedCharacterIds);
}

export function currentPlayer(state: DraftState): DraftPlayer {
  return state.players[state.currentPlayerIndex];
}

function advanceTurn(state: DraftState): DraftState {
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

  const finished = state.players.every(
    (p) => p.pickedCharacterIds.length >= state.teamSize
  );

  return { ...state, currentPlayerIndex, round, direction, finished };
}

export function pick(state: DraftState, characterId: string): DraftState {
  if (state.finished) return state;
  if (!state.availableCharacterIds.includes(characterId)) return state;

  const player = currentPlayer(state);
  if (player.pickedCharacterIds.length >= state.teamSize) return state;

  const players = state.players.map((p) =>
    p.id === player.id
      ? { ...p, pickedCharacterIds: [...p.pickedCharacterIds, characterId] }
      : p
  );
  const availableCharacterIds = state.availableCharacterIds.filter(
    (id) => id !== characterId
  );

  return advanceTurn({ ...state, players, availableCharacterIds });
}

/** Auto-pick a random available character for the current player, used when their pick timer runs out. */
export function autoPick(state: DraftState, rng: () => number = Math.random): DraftState {
  if (state.finished || state.availableCharacterIds.length === 0) return state;
  const index = Math.floor(rng() * state.availableCharacterIds.length);
  return pick(state, state.availableCharacterIds[index]);
}

export function getTeam(state: DraftState, playerId: string, allCharacters: Character[]): Character[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return player.pickedCharacterIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c));
}
