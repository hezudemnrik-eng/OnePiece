import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DraftState } from "./draft";
import type { BattleResult } from "./battle-sim";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Returns null until NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are set (see .env.example). Live multiplayer draft sync and persisted
 * tier lists need a real Supabase project; until then the app falls back
 * to local-only state so the UI stays usable during early development.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Ensures the browser has a Supabase session, signing in anonymously if
 * needed. We don't ask for email/password (see question-catalog answers:
 * nickname + invite code, no real accounts) — anonymous auth still gives
 * every browser a stable auth.uid() that Row Level Security can scope
 * rows to. Returns null when Supabase isn't configured or the call fails.
 *
 * The TierListEditor fires off several Supabase calls from separate
 * effects right on mount (fetching lists, loading the profile), each of
 * which calls this. Without de-duping, two concurrent callers could both
 * see "no session yet" and each call signInAnonymously(), which mints TWO
 * different anonymous identities — whichever request then lands first
 * writes rows under a user id that doesn't match the session the OTHER
 * caller is about to use, so its query fails RLS. Caching the in-flight
 * promise means every caller on this page load shares the same sign-in.
 */
let sessionPromise: Promise<string | null> | null = null;

export async function ensureSupabaseSession(): Promise<string | null> {
  if (!supabase) return null;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase!.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: signInData, error } = await supabase!.auth.signInAnonymously();
      if (error || !signInData.session) {
        sessionPromise = null; // allow a later retry instead of caching a permanent failure
        return null;
      }
      return signInData.session.user.id;
    })();
  }
  return sessionPromise;
}

function usernameToEmail(username: string): string {
  let slug = username
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "");
  if (!slug) {
    // Deterministic fallback (no randomness) so the same unusual username
    // always maps back to the same synthetic email on login.
    let hash = 7;
    for (const ch of username) hash = (hash * 31 + ch.charCodeAt(0)) % 1000000;
    slug = `user${hash}`;
  }
  return `${slug}@onepiece.local`;
}

export type AuthUser = {
  id: string;
  username: string | null;
  isAnonymous: boolean;
  avatarCharacterId: string | null;
  isAdmin: boolean;
};

/** The signed-in user, if any (anonymous or a real username+password account). */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_character_id, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    username: profile?.username ?? null,
    isAnonymous: data.user.is_anonymous ?? true,
    avatarCharacterId: profile?.avatar_character_id ?? null,
    isAdmin: profile?.is_admin ?? false,
  };
}

/** Checks a registration invite code against the shared setting in app_settings. */
export async function checkInviteCode(code: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from("app_settings").select("value").eq("key", "invite_code").maybeSingle();
  if (!data) return true; // no code configured yet — don't block registration
  return data.value.trim().toLowerCase() === code.trim().toLowerCase();
}

/**
 * Creates a real account. Upgrades the browser's current anonymous session
 * in place (via `updateUser`) rather than signing out and starting fresh —
 * that keeps the same auth.uid(), so any tier lists already synced under
 * the anonymous session carry over automatically instead of needing a
 * separate migration step.
 */
export async function signUpWithUsername(
  username: string,
  password: string,
  inviteCode: string,
  avatarCharacterId: string | null
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
  const trimmed = username.trim();
  if (trimmed.length < 3) return { error: "Nutzername muss mindestens 3 Zeichen haben." };
  if (password.length < 6) return { error: "Passwort muss mindestens 6 Zeichen haben." };

  const codeOk = await checkInviteCode(inviteCode);
  if (!codeOk) return { error: "Einladungscode ist falsch." };

  await ensureSupabaseSession(); // ensures an anonymous session (and its data) exists to upgrade
  const email = usernameToEmail(trimmed);
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Dieser Nutzername ist schon vergeben." };
    }
    return { error: error.message };
  }
  if (!data.user) return { error: "Registrierung fehlgeschlagen." };

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      username: trimmed,
      nickname: trimmed,
      avatar_character_id: avatarCharacterId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) return { error: profileError.message };
  return {};
}

export async function signInWithUsername(username: string, password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
  const email = usernameToEmail(username.trim());
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Nutzername oder Passwort ist falsch." };
  return {};
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  sessionPromise = null;
}

/** Updates the heartbeat timestamp Übersicht/friend lists use to show who's online. */
export async function pingOnline(): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
}

export type RemoteTierList = {
  id: string;
  name: string;
  category: string;
  assignments: Record<string, string>;
  is_public: boolean;
  updated_at: string;
};

export type TierListFetchResult = {
  /** null when Supabase isn't configured, or the session/anonymous sign-in failed. */
  userId: string | null;
  lists: RemoteTierList[];
  /** Set when the session was fine but the query itself failed (e.g. the
   * migration hasn't been applied yet, so the table doesn't exist). */
  error?: string;
};

/**
 * Lists the current user's own tier lists. Callers use `userId`/`error` to
 * tell "synced, just empty" apart from the two ways sync can be broken:
 * no session (auth not configured / anonymous sign-ins disabled) vs. a
 * session but a failing query (e.g. the schema migration never ran).
 */
export async function fetchMyTierLists(): Promise<TierListFetchResult> {
  if (!supabase) return { userId: null, lists: [] };
  const userId = await ensureSupabaseSession();
  if (!userId) return { userId: null, lists: [] };
  const { data, error } = await supabase
    .from("tier_lists")
    .select("id, name, category, assignments, is_public, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { userId, lists: [], error: error.message };
  return { userId, lists: (data as RemoteTierList[]) ?? [] };
}

/** Creates or updates (by owner_id + name + category) a tier list. No-op if Supabase isn't configured. */
export async function saveTierListRemote(
  name: string,
  category: string,
  assignments: Record<string, string>,
  isPublic: boolean
): Promise<{ error?: string }> {
  if (!supabase) return {};
  const userId = await ensureSupabaseSession();
  if (!userId) return { error: "no session" };
  const { error } = await supabase
    .from("tier_lists")
    .upsert(
      { owner_id: userId, name, category, assignments, is_public: isPublic, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,name,category" }
    );
  return error ? { error: error.message } : {};
}

export type Profile = { id: string; nickname: string; share_code: string };

function randomShareCode(length = 6): string {
  // No 0/O/1/I — avoids codes friends misread when typing them in by hand.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export type LiveDraftSession = {
  id: string;
  invite_code: string;
  host_id: string;
  max_players: number;
  phase: "lobby" | "drafting" | "result";
  state: DraftState;
  battle: BattleResult | null;
  updated_at: string;
};

/** Creates a live draft lobby and returns it, or null on failure (not configured / no session). */
export async function createLiveDraft(
  initialState: DraftState,
  maxPlayers: number
): Promise<LiveDraftSession | null> {
  if (!supabase) return null;
  const userId = await ensureSupabaseSession();
  if (!userId) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = randomShareCode();
    const { data, error } = await supabase
      .from("draft_sessions")
      .insert({
        invite_code: inviteCode,
        host_id: userId,
        max_players: maxPlayers,
        phase: "lobby",
        state: initialState,
      })
      .select()
      .single();
    if (!error && data) return data as LiveDraftSession;
    if (error && error.code !== "23505") break; // not an invite-code collision — stop retrying
  }
  return null;
}

/** Looks up a live draft lobby/session by its invite code. */
export async function fetchLiveDraftByCode(inviteCode: string): Promise<LiveDraftSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("draft_sessions")
    .select()
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as LiveDraftSession;
}

export async function fetchLiveDraftById(id: string): Promise<LiveDraftSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("draft_sessions").select().eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as LiveDraftSession;
}

/**
 * Writes a new state/phase/battle for a live draft, but only if nobody
 * else's write landed since `expectedUpdatedAt` (optimistic concurrency —
 * two people clicking "join" or "pick" at the same instant shouldn't
 * silently clobber each other). Returns `conflict: true` when that
 * happened; the caller re-fetches the row and retries against the new
 * state rather than resending its now-stale write.
 */
export async function writeLiveDraft(
  id: string,
  expectedUpdatedAt: string,
  patch: { state?: DraftState; phase?: LiveDraftSession["phase"]; battle?: BattleResult }
): Promise<{ session?: LiveDraftSession; conflict?: boolean; error?: string }> {
  if (!supabase) return { error: "not configured" };
  const { data, error } = await supabase
    .from("draft_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { conflict: true };
  return { session: data as LiveDraftSession };
}

/**
 * Subscribes to live changes on one draft session row. Returns an
 * unsubscribe function. Requires the table to be added to Supabase's
 * `supabase_realtime` publication (see migration 0003).
 */
export function subscribeLiveDraft(
  id: string,
  onChange: (session: LiveDraftSession) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`draft_session_${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "draft_sessions", filter: `id=eq.${id}` },
      (payload) => onChange(payload.new as LiveDraftSession)
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Ensures this browser's anonymous user has a profile with a stable,
 * human-shareable code (so a friend can type it in rather than handling a
 * raw auth.uid()). The code is generated once and kept; only the nickname
 * is updated on later calls. Returns null if Supabase isn't configured,
 * the session fails, or the table is missing (migration not applied).
 */
export async function ensureProfile(nickname: string): Promise<Profile | null> {
  if (!supabase) return null;
  const userId = await ensureSupabaseSession();
  if (!userId) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, nickname, share_code")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.share_code) {
    if (existing.nickname !== nickname) {
      await supabase.from("profiles").update({ nickname }).eq("id", userId);
    }
    return { id: userId, nickname, share_code: existing.share_code };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomShareCode();
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, nickname, share_code: code }, { onConflict: "id" })
      .select("id, nickname, share_code")
      .single();
    if (!error && data?.share_code) return data as Profile;
    if (error && error.code !== "23505") break; // not a share_code collision — stop retrying
  }
  return null;
}

export type FriendPublicList = {
  ownerNickname: string;
  name: string;
  category: string;
  assignments: Record<string, string>;
};

/** Looks up a friend's public tier lists by their share code. */
export async function fetchPublicListsByShareCode(
  code: string
): Promise<{ ok: boolean; lists: FriendPublicList[] }> {
  if (!supabase) return { ok: false, lists: [] };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("share_code", code.trim().toUpperCase())
    .maybeSingle();
  if (profileError || !profile) return { ok: false, lists: [] };

  const { data: lists, error } = await supabase
    .from("tier_lists")
    .select("name, category, assignments")
    .eq("owner_id", profile.id)
    .eq("is_public", true);
  if (error || !lists) return { ok: false, lists: [] };

  return {
    ok: true,
    lists: lists.map((l) => ({
      ownerNickname: profile.nickname,
      name: l.name,
      category: l.category,
      assignments: l.assignments,
    })),
  };
}

export type MatchMode = "imu" | "zufallsgegner" | "live-draft";

/** Appends one match result for the signed-in user (solo-vs-AI and live-draft only — see migration 0007). */
export async function recordMatchResult(
  mode: MatchMode,
  opponentLabel: string,
  result: "win" | "loss"
): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("match_results").insert({ user_id: userId, mode, opponent_label: opponentLabel, result });
}

export type LeaderboardEntry = {
  userId: string;
  username: string;
  avatarCharacterId: string | null;
  wins: number;
  losses: number;
};

/** Aggregates match_results + profiles into a per-player win/loss leaderboard. Small friend-group scale — fine to aggregate client-side. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const { data: results } = await supabase.from("match_results").select("user_id, result");
  if (!results || results.length === 0) return [];

  const tally = new Map<string, { wins: number; losses: number }>();
  for (const r of results) {
    const entry = tally.get(r.user_id) ?? { wins: 0, losses: 0 };
    if (r.result === "win") entry.wins++;
    else entry.losses++;
    tally.set(r.user_id, entry);
  }

  const userIds = Array.from(tally.keys());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id")
    .in("id", userIds);

  return userIds
    .map((userId) => {
      const profile = profiles?.find((p) => p.id === userId);
      const { wins, losses } = tally.get(userId)!;
      return { userId, username: profile?.username ?? "?", avatarCharacterId: profile?.avatar_character_id ?? null, wins, losses };
    })
    .filter((e) => e.username !== "?")
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

export type RecentMatch = {
  mode: MatchMode;
  opponentLabel: string;
  result: "win" | "loss";
  createdAt: string;
};

/** The signed-in user's most recent matches, newest first. */
export async function fetchMyRecentMatches(limit = 5): Promise<RecentMatch[]> {
  if (!supabase) return [];
  const userId = await ensureSupabaseSession();
  if (!userId) return [];
  const { data } = await supabase
    .from("match_results")
    .select("mode, opponent_label, result, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    mode: r.mode as MatchMode,
    opponentLabel: r.opponent_label,
    result: r.result as "win" | "loss",
    createdAt: r.created_at,
  }));
}

export type OnlineProfile = {
  userId: string;
  username: string;
  avatarCharacterId: string | null;
};

/** Everyone else in the friend group active in the last 2 minutes (based on the AuthGate heartbeat). */
export async function fetchOnlineFriends(): Promise<OnlineProfile[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id, last_seen")
    .not("username", "is", null)
    .gte("last_seen", twoMinAgo);
  return (data ?? [])
    .filter((p) => p.id !== myUserId)
    .map((p) => ({ userId: p.id, username: p.username as string, avatarCharacterId: p.avatar_character_id }));
}

export type OpenLiveDraft = {
  id: string;
  inviteCode: string;
  hostId: string;
  phase: LiveDraftSession["phase"];
  playerCount: number;
  maxPlayers: number;
  updatedAt: string;
  /** True when the signed-in user already holds a seat in this session. */
  isMine: boolean;
};

/**
 * Live draft sessions relevant to the signed-in user's home overview: open
 * lobbies anyone can join, plus in-progress drafts they're already seated
 * in (so they can jump back in). Fetches the most recently active sessions
 * and filters client-side — fine at this app's scale.
 */
export async function fetchRelevantLiveDrafts(): Promise<OpenLiveDraft[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  const { data } = await supabase
    .from("draft_sessions")
    .select("id, invite_code, host_id, phase, state, max_players, updated_at")
    .neq("phase", "result")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (!data) return [];

  return data
    .map((s) => {
      const players = (s.state as LiveDraftSession["state"]).players;
      const isMine = players.some((p) => p.userId === myUserId);
      return {
        id: s.id,
        inviteCode: s.invite_code,
        hostId: s.host_id,
        phase: s.phase,
        playerCount: players.filter((p) => p.userId).length,
        maxPlayers: s.max_players,
        updatedAt: s.updated_at,
        isMine,
      };
    })
    .filter((s) => s.isMine || s.phase === "lobby");
}

/** Appends one solo quiz result for the signed-in user. */
export async function recordQuizResult(
  score: number,
  total: number,
  category: string,
  difficulty: string
): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("quiz_results").insert({ user_id: userId, score, total, category, difficulty });
}

export type QuizLeaderboardEntry = {
  userId: string;
  username: string;
  avatarCharacterId: string | null;
  totalScore: number;
  totalQuestions: number;
  quizzesPlayed: number;
};

/** Aggregates quiz_results + profiles into a per-player quiz leaderboard, same pattern as fetchLeaderboard(). */
export async function fetchQuizLeaderboard(): Promise<QuizLeaderboardEntry[]> {
  if (!supabase) return [];
  const { data: results } = await supabase.from("quiz_results").select("user_id, score, total");
  if (!results || results.length === 0) return [];

  const tally = new Map<string, { totalScore: number; totalQuestions: number; quizzesPlayed: number }>();
  for (const r of results) {
    const entry = tally.get(r.user_id) ?? { totalScore: 0, totalQuestions: 0, quizzesPlayed: 0 };
    entry.totalScore += r.score;
    entry.totalQuestions += r.total;
    entry.quizzesPlayed += 1;
    tally.set(r.user_id, entry);
  }

  const userIds = Array.from(tally.keys());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id")
    .in("id", userIds);

  return userIds
    .map((userId) => {
      const profile = profiles?.find((p) => p.id === userId);
      const stats = tally.get(userId)!;
      return {
        userId,
        username: profile?.username ?? "?",
        avatarCharacterId: profile?.avatar_character_id ?? null,
        ...stats,
      };
    })
    .filter((e) => e.username !== "?")
    .sort((a, b) => b.totalScore / Math.max(1, b.totalQuestions) - a.totalScore / Math.max(1, a.totalQuestions));
}

export type QuizSession = {
  id: string;
  invite_code: string;
  host_id: string;
  category: string;
  difficulty: string;
  questions: unknown[];
  created_at: string;
};

/** Creates a multiplayer quiz lobby with a fixed, shared question set. */
export async function createQuizSession(
  category: string,
  difficulty: string,
  questions: unknown[]
): Promise<QuizSession | null> {
  if (!supabase) return null;
  const userId = await ensureSupabaseSession();
  if (!userId) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .insert({ invite_code: inviteCode, host_id: userId, category, difficulty, questions })
      .select()
      .single();
    if (!error && data) return data as QuizSession;
    if (error && error.code !== "23505") break;
  }
  return null;
}

export async function fetchQuizSessionByCode(inviteCode: string): Promise<QuizSession | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("quiz_sessions")
    .select()
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .maybeSingle();
  return (data as QuizSession) ?? null;
}

export type QuizParticipant = {
  session_id: string;
  user_id: string;
  username: string;
  score: number | null;
  finished_at: string | null;
};

/** Claims (or re-fetches) this user's participant row for a quiz session. */
export async function joinQuizSession(sessionId: string, username: string): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase
    .from("quiz_participants")
    .upsert({ session_id: sessionId, user_id: userId, username }, { onConflict: "session_id,user_id" });
}

export async function submitQuizScore(sessionId: string, score: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase
    .from("quiz_participants")
    .update({ score, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
}

export async function fetchQuizParticipants(sessionId: string): Promise<QuizParticipant[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("quiz_participants")
    .select("session_id, user_id, username, score, finished_at")
    .eq("session_id", sessionId)
    .order("score", { ascending: false, nullsFirst: false });
  return (data as QuizParticipant[]) ?? [];
}
