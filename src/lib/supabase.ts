import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DraftState } from "./draft";
import type { BattleResult } from "./battle-sim";
import { XP_DUEL_COMPLETE, XP_MATCH_LOSS, XP_MATCH_WIN, XP_QUIZ_BASE, XP_QUIZ_PER_CORRECT } from "./levels";
import { getTodaysChallenge, todayKeyBerlin, type DailyQuestId } from "./dailyChallenge";
import type { TcgRarity } from "./tcgRarities";

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

export type InviteCode = {
  code: string;
  createdAt: string;
  usedBy: string | null;
  usedAt: string | null;
};

/**
 * Mints a new single-use registration code under the signed-in user's own
 * account. Only actually succeeds for an admin account — enforced by the
 * `invite_codes` insert RLS policy (migration 0016), not by this function —
 * a non-admin call just comes back with a (translated) permission error.
 */
export async function createInviteCode(): Promise<{ code?: string; error?: string }> {
  if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
  const userId = await ensureSupabaseSession();
  if (!userId) return { error: "Nicht angemeldet." };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomShareCode(8);
    const { error } = await supabase.from("invite_codes").insert({ code, created_by: userId });
    if (!error) return { code };
    if (error.code === "42501") return { error: "Nur das Admin-Konto darf Einladungscodes erstellen." };
    if (error.code !== "23505") return { error: error.message }; // not a collision — stop retrying
  }
  return { error: "Konnte keinen eindeutigen Code erstellen, bitte nochmal versuchen." };
}

/** Invite codes created by the signed-in user — only returns rows for an admin account (see RLS policy on invite_codes). */
export async function fetchMyInviteCodes(): Promise<InviteCode[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("invite_codes")
    .select("code, created_at, used_by, used_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    code: r.code as string,
    createdAt: r.created_at as string,
    usedBy: r.used_by as string | null,
    usedAt: r.used_at as string | null,
  }));
}

/**
 * Creates a real account. Upgrades the browser's current anonymous session
 * in place rather than signing out and starting fresh — that keeps the
 * same auth.uid(), so any tier lists already synced under the anonymous
 * session carry over automatically instead of needing a separate migration
 * step.
 *
 * The actual email/password update happens server-side (/api/auth/register)
 * via the Supabase admin API instead of a client-side `updateUser({email})`
 * call — the latter triggers Supabase's "secure email change" confirmation
 * email every time, which is both pointless (the synthetic address can't
 * receive mail) and runs into the free tier's email rate limit after a
 * handful of signups. After the server confirms the update, we sign in
 * fresh with the new credentials so the browser's session reflects the
 * real (non-anonymous) account.
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
  const trimmedCode = inviteCode.trim();
  if (!trimmedCode) return { error: "Einladungscode wird benötigt." };

  await ensureSupabaseSession(); // ensures an anonymous session (and its data) exists to upgrade
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: "Sitzung konnte nicht erstellt werden." };

  const email = usernameToEmail(trimmed);
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, username: trimmed, password, email, avatarCharacterId, inviteCode: trimmedCode }),
  });
  const body: { error?: string } = await res.json().catch(() => ({ error: "Registrierung fehlgeschlagen." }));
  if (!res.ok) return { error: body.error ?? "Registrierung fehlgeschlagen." };

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: signInError.message };
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
  if (!error) await claimDailyQuestFor("tierliste");
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
  phase: "lobby" | "drafting" | "roles" | "result";
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
    if (!error && data) {
      await claimDailyQuestFor("live-draft");
      return data as LiveDraftSession;
    }
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
 * Cancels a live draft lobby the caller hosts (only while it's still in the
 * "lobby" phase — once drafting starts, leaving is handled by the other
 * players picking around a stale seat, not by deleting the row). Deletes
 * the row outright so it stops showing up as "Weiterspielen" on Home and
 * as joinable via its invite code. Silently no-ops if the caller isn't the
 * host or the lobby already moved on (RLS/the phase filter just won't
 * match any row).
 */
export async function cancelLiveDraft(id: string, hostId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("draft_sessions").delete().eq("id", id).eq("host_id", hostId).eq("phase", "lobby");
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

/** Atomically adds `delta` to the signed-in user's account-wide xp (see migration 0010). */
export async function incrementXp(delta: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.rpc("increment_xp", { delta });
}

/**
 * Mode-aware XP award (see migration 0011's award_xp()): logs the run and
 * applies per-mode diminishing returns server-side (crew/blind-ranking only)
 * before clamping to the shared daily cap. Prefer this over incrementXp for
 * any XP tied to completing a specific game mode.
 */
export async function awardModeXp(mode: string, baseXp: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.rpc("award_xp", { p_mode: mode, p_base_xp: baseXp });
}

/**
 * Claims the Daily-Quest bonus (migration 0020) if `questId` matches
 * today's challenge (src/lib/dailyChallenge.ts) and it hasn't been claimed
 * yet today — no-ops (and makes no network call) otherwise, so call sites
 * can call this unconditionally for the mode they just completed. Several
 * CHALLENGE_POOL entries share an id, so completing *any* run of that mode
 * counts — see the comment on DailyQuestId for why.
 */
async function claimDailyQuestFor(questId: DailyQuestId): Promise<boolean> {
  if (!supabase) return false;
  if (getTodaysChallenge().id !== questId) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("claim_daily_quest", { p_quest_id: questId });
  return Boolean(data);
}

/** Whether the signed-in user has already claimed today's Daily Quest. */
export async function fetchDailyQuestClaimedToday(): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase
    .from("daily_quest_claims")
    .select("claim_date")
    .eq("user_id", userId)
    .eq("claim_date", todayKeyBerlin())
    .maybeSingle();
  return Boolean(data);
}

/** Records a completed duel (any result) toward the Daily Quest, plus the Duell-Board's own mode XP/Berry (migration 0021 — it previously awarded neither). */
export async function recordDuelCompletion(): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await awardModeXp("duell", XP_DUEL_COMPLETE);
  await claimDailyQuestFor("duell");
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
  await awardModeXp(mode, result === "win" ? XP_MATCH_WIN : XP_MATCH_LOSS);
  if (result === "win" && (mode === "imu" || mode === "zufallsgegner")) await claimDailyQuestFor(mode);
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

export type FriendRequest = {
  friendshipId: string;
  requesterId: string;
  username: string;
  avatarCharacterId: string | null;
};

export type Friend = {
  friendshipId: string;
  userId: string;
  username: string;
  avatarCharacterId: string | null;
  online: boolean;
  equippedFrame: string | null;
  equippedTitle: string | null;
  equippedColor: string | null;
};

/**
 * Sends a friend request to whoever owns this share_code (migration 0002 —
 * same code already used to look up a friend's public tier lists). Replaces
 * the old "everyone recently online counts as a friend" stand-in with a
 * real opt-in graph (migration 0013).
 */
export async function sendFriendRequestByShareCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Nicht verbunden." };
  const myUserId = await ensureSupabaseSession();
  if (!myUserId) return { ok: false, error: "Nicht angemeldet." };

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("share_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!target) return { ok: false, error: "Kein Nutzer mit diesem Code gefunden." };
  if (target.id === myUserId) return { ok: false, error: "Das ist dein eigener Code." };

  const { error } = await supabase.from("friendships").insert({ requester_id: myUserId, addressee_id: target.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ihr seid schon verbunden oder die Anfrage läuft bereits." };
    return { ok: false, error: "Anfrage konnte nicht gesendet werden." };
  }
  return { ok: true };
}

/** Pending requests addressed to me, newest first. */
export async function fetchIncomingFriendRequests(): Promise<FriendRequest[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  if (!myUserId) return [];
  const { data: rows } = await supabase
    .from("friendships")
    .select("id, requester_id")
    .eq("addressee_id", myUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const requesterIds = rows.map((r) => r.requester_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id")
    .in("id", requesterIds);

  return rows.map((r) => {
    const p = profiles?.find((p) => p.id === r.requester_id);
    return {
      friendshipId: r.id,
      requesterId: r.requester_id,
      username: p?.username ?? "?",
      avatarCharacterId: p?.avatar_character_id ?? null,
    };
  });
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", friendshipId);
}

/** Also used to cancel a request you sent, or unfriend an accepted one. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("friendships").delete().eq("id", friendshipId);
}

/** Accepted friends, each flagged online based on the AuthGate heartbeat (same 2-minute window as before). */
export async function fetchFriends(): Promise<Friend[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  if (!myUserId) return [];
  const { data: rows } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${myUserId},addressee_id.eq.${myUserId}`);
  if (!rows || rows.length === 0) return [];

  const friendIds = rows.map((r) => (r.requester_id === myUserId ? r.addressee_id : r.requester_id));
  const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id, last_seen, equipped_frame, equipped_title, equipped_color")
    .in("id", friendIds);

  return rows.map((r) => {
    const friendId = r.requester_id === myUserId ? r.addressee_id : r.requester_id;
    const p = profiles?.find((p) => p.id === friendId);
    return {
      friendshipId: r.id,
      userId: friendId,
      username: p?.username ?? "?",
      avatarCharacterId: p?.avatar_character_id ?? null,
      online: !!p?.last_seen && p.last_seen >= twoMinAgo,
      equippedFrame: (p?.equipped_frame as string | null) ?? null,
      equippedTitle: (p?.equipped_title as string | null) ?? null,
      equippedColor: (p?.equipped_color as string | null) ?? null,
    };
  });
}

export type PublicProfileCosmetics = {
  userId: string;
  avatarCharacterId: string | null;
  equippedFrame: string | null;
  equippedTitle: string | null;
  equippedColor: string | null;
};

/** Same equipped_* columns as fetchFriends(), but for an arbitrary set of user ids — used to show Live-Draft co-players' frame/title without requiring a friendship (same public RLS as the friends list). */
export async function fetchPublicProfilesCosmetics(userIds: string[]): Promise<PublicProfileCosmetics[]> {
  if (!supabase || userIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(userIds));
  const { data } = await supabase
    .from("profiles")
    .select("id, avatar_character_id, equipped_frame, equipped_title, equipped_color")
    .in("id", uniqueIds);
  return (data ?? []).map((p) => ({
    userId: p.id as string,
    avatarCharacterId: (p.avatar_character_id as string | null) ?? null,
    equippedFrame: (p.equipped_frame as string | null) ?? null,
    equippedTitle: (p.equipped_title as string | null) ?? null,
    equippedColor: (p.equipped_color as string | null) ?? null,
  }));
}

export type DraftInvite = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  inviteCode: string;
  createdAt: string;
};

/** Sends a Live-Draft invite to a friend (migration 0024) — the RLS policy only lets this succeed for an accepted friendship. */
export async function sendDraftInvite(toUserId: string, inviteCode: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Nicht verbunden." };
  const myUserId = await ensureSupabaseSession();
  if (!myUserId) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase
    .from("draft_invites")
    .insert({ from_user_id: myUserId, to_user_id: toUserId, invite_code: inviteCode.trim().toUpperCase() });
  if (error) return { ok: false, error: "Einladung konnte nicht gesendet werden." };
  return { ok: true };
}

/** Invites addressed to me, newest first — shown as a banner on the home overview. */
export async function fetchIncomingDraftInvites(): Promise<DraftInvite[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  if (!myUserId) return [];
  const { data: rows } = await supabase
    .from("draft_invites")
    .select("id, from_user_id, invite_code, created_at")
    .eq("to_user_id", myUserId)
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const fromIds = Array.from(new Set(rows.map((r) => r.from_user_id)));
  const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", fromIds);

  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromUsername: profiles?.find((p) => p.id === r.from_user_id)?.username ?? "?",
    inviteCode: r.invite_code,
    createdAt: r.created_at,
  }));
}

/** Clears an invite once it's been accepted or dismissed. */
export async function dismissDraftInvite(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("draft_invites").delete().eq("id", id);
}

/**
 * Pushes new incoming invites the moment they're sent (Boss's ask: a
 * pop-up anywhere in the app, not just a banner you'd only see on the home
 * screen you happen to be on). The payload only carries the raw row, not
 * the sender's username, so the callback re-fetches via
 * fetchIncomingDraftInvites() rather than trying to assemble it here.
 */
export function subscribeDraftInvites(userId: string, onInsert: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`draft_invites_${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "draft_invites", filter: `to_user_id=eq.${userId}` },
      () => onInsert()
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
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
const OPEN_LOBBY_MAX_AGE_HOURS = 12;

export async function fetchRelevantLiveDrafts(): Promise<OpenLiveDraft[]> {
  if (!supabase) return [];
  const myUserId = await ensureSupabaseSession();
  const cutoff = new Date(Date.now() - OPEN_LOBBY_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("draft_sessions")
    .select("id, invite_code, host_id, phase, state, max_players, updated_at")
    .neq("phase", "result")
    .gte("updated_at", cutoff)
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
  await awardModeXp("quiz", XP_QUIZ_BASE + score * XP_QUIZ_PER_CORRECT);
  if (score >= 1) await claimDailyQuestFor("quiz-1");
  if (score >= 5) await claimDailyQuestFor("quiz-5");
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

export type GlobalLeaderboardEntry = {
  userId: string;
  username: string;
  avatarCharacterId: string | null;
  xp: number;
};

/**
 * Account-wide XP ranking across every signed-up user (Q180) — distinct from
 * fetchLeaderboard()/fetchQuizLeaderboard(), which only rank match/quiz
 * results. `profiles` is already readable by everyone (migration 0001), and
 * only the already-public username/xp/avatar fields are selected here.
 */
export async function fetchGlobalLeaderboard(limit = 50): Promise<GlobalLeaderboardEntry[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_character_id, xp")
    .not("username", "is", null)
    .order("xp", { ascending: false })
    .limit(limit);
  return (data ?? []).map((p) => ({
    userId: p.id,
    username: p.username as string,
    avatarCharacterId: p.avatar_character_id,
    xp: (p.xp as number) ?? 0,
  }));
}

export type QuizSession = {
  id: string;
  invite_code: string;
  host_id: string;
  category: string;
  difficulty: string;
  questions: unknown[];
  created_at: string;
  /** Index of the question that's currently "live" for everyone — the round-robin turn pointer (Q123, migration 0015). */
  current_index: number;
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

export async function fetchQuizParticipants(sessionId: string): Promise<QuizParticipant[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("quiz_participants")
    .select("session_id, user_id, username, score, finished_at")
    .eq("session_id", sessionId)
    .order("score", { ascending: false, nullsFirst: false });
  return (data as QuizParticipant[]) ?? [];
}

/** Turn order for the round-robin live quiz (Q123) — join order, earliest first. */
export async function fetchQuizTurnOrder(sessionId: string): Promise<{ userId: string; username: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("quiz_participants")
    .select("user_id, username, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });
  return (data ?? []).map((p) => ({ userId: p.user_id as string, username: p.username as string }));
}

/** Refetches just the session row — used to poll the shared current_index turn pointer. */
export async function fetchQuizSession(sessionId: string): Promise<QuizSession | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("quiz_sessions").select().eq("id", sessionId).maybeSingle();
  return (data as QuizSession) ?? null;
}

/** Atomically advances the shared turn pointer by one — fails harmlessly (returns false) if another client already advanced it first. */
export async function advanceQuizTurn(sessionId: string, expectedIndex: number): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.rpc("advance_quiz_turn", { p_session_id: sessionId, p_expected_index: expectedIndex });
  return data === true;
}

/** Called by whoever's turn it is, right after answering — adds one point to their own running score if they got it right. */
export async function awardQuizTurnPoint(sessionId: string, correct: boolean): Promise<void> {
  if (!supabase || !correct) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  const { data } = await supabase
    .from("quiz_participants")
    .select("score")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const nextScore = (data?.score ?? 0) + 1;
  await supabase
    .from("quiz_participants")
    .update({ score: nextScore, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
}

/** Called once by each client when it detects the shared quiz has ended — awards XP for this participant's own final score. */
export async function finalizeQuizParticipant(sessionId: string): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  const { data } = await supabase
    .from("quiz_participants")
    .select("score, finished_at")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.finished_at) return; // already finalized
  const score = data.score ?? 0;
  await supabase
    .from("quiz_participants")
    .update({ finished_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  await awardModeXp("quiz", XP_QUIZ_BASE + score * XP_QUIZ_PER_CORRECT);
  if (score >= 1) await claimDailyQuestFor("quiz-1");
  if (score >= 5) await claimDailyQuestFor("quiz-5");
}

// --- Account-wide XP for modes that otherwise only keep local history ---
// Crew-Builder and Blind Ranking have no leaderboard/result table of their
// own (just localStorage) — these just award XP on completion.

export async function recordCrewCompletion(xp: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await awardModeXp("crew", xp);
  await claimDailyQuestFor("crew");
}

export async function recordBlindRankingCompletion(xp: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await awardModeXp("blind-ranking", xp);
  await claimDailyQuestFor("blind-ranking");
}

/** `bounty` is the Fusions-Piraten's raw Berry bounty (not XP) — needed to check the ">1 Mrd." Daily Quest. */
export async function recordFusionCompletion(xp: number, bounty: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await awardModeXp("fusion", xp);
  if (bounty >= 1_000_000_000) await claimDailyQuestFor("fusion-1b");
}

// --- Achievements (currently Fusions-Pirat badges, see fusionAchievements.ts) ---

export async function fetchMyAchievements(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const userId = await ensureSupabaseSession();
  if (!userId) return new Set();
  const { data } = await supabase.from("achievements").select("achievement_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.achievement_id as string));
}

/**
 * Unlocks the achievement (and its Berry bonus) via migration 0012's
 * unlock_achievement RPC, which does the insert and the Berry award
 * atomically. Returns true when it was newly unlocked.
 */
export async function unlockAchievement(achievementId: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("unlock_achievement", { p_achievement_id: achievementId });
  return Boolean(data);
}

// --- Level/rank profile info ---

export type MyLevelInfo = {
  xp: number;
  equippedFrame: string | null;
  /** Rank frame (Bronze/Silber/Gold/…, see COSMETIC_FRAMES) decorating the
   *  square profile-hero card — independent of equippedFrame above, which
   *  is the round avatar frame bought in the shop. */
  equippedRankFrame: string | null;
  berries: number;
  equippedColor: string | null;
  equippedTitle: string | null;
  equippedArena: string | null;
};

export async function fetchMyLevelInfo(): Promise<MyLevelInfo | null> {
  if (!supabase) return null;
  const userId = await ensureSupabaseSession();
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("xp, equipped_frame, equipped_rank_frame, berries, equipped_color, equipped_title, equipped_arena")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    xp: (data.xp as number) ?? 0,
    equippedFrame: (data.equipped_frame as string | null) ?? null,
    equippedRankFrame: (data.equipped_rank_frame as string | null) ?? null,
    berries: (data.berries as number) ?? 0,
    equippedTitle: (data.equipped_title as string | null) ?? null,
    equippedArena: (data.equipped_arena as string | null) ?? null,
    equippedColor: (data.equipped_color as string | null) ?? null,
  };
}

export async function setEquippedFrame(frameId: string | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ equipped_frame: frameId }).eq("id", userId);
}

export async function setEquippedRankFrame(frameId: string | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ equipped_rank_frame: frameId }).eq("id", userId);
}

/** Lets a user change their avatar after signup (previously only ever set once, at registration). */
export async function setAvatarCharacterId(characterId: string): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ avatar_character_id: characterId }).eq("id", userId);
}

export async function setEquippedColor(colorId: string | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ equipped_color: colorId }).eq("id", userId);
}

export async function setEquippedTitle(titleId: string | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ equipped_title: titleId }).eq("id", userId);
}

export async function setEquippedArena(arenaId: string | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSupabaseSession();
  if (!userId) return;
  await supabase.from("profiles").update({ equipped_arena: arenaId }).eq("id", userId);
}

// --- Berry shop (migration 0012) ---
// A general, extensible cosmetics shop: `category` is open-ended ("frame",
// "color", and later backgrounds/sound-packs etc.) so new categories need
// only a new DB row, not a schema change.

export type ShopItem = {
  id: string;
  category: string;
  label: string;
  price: number;
  minLevel: number;
  className: string;
};

export async function fetchShopItems(): Promise<ShopItem[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("shop_items")
    .select("id, category, label, price, min_level, class_name")
    .order("price", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    label: r.label as string,
    price: r.price as number,
    minLevel: r.min_level as number,
    className: r.class_name as string,
  }));
}

/** The signed-in user's owned (purchased) shop item ids. */
export async function fetchMyShopPurchases(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const userId = await ensureSupabaseSession();
  if (!userId) return new Set();
  const { data } = await supabase.from("shop_purchases").select("item_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.item_id as string));
}

/** Buys a shop item (level + Berry checks happen server-side). Returns false if locked, unaffordable, or not configured. */
export async function purchaseShopItem(itemId: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("purchase_shop_item", { p_item_id: itemId });
  return Boolean(data);
}

/** Equips an owned shop item into its category's profile slot. Returns false if not owned. */
export async function equipShopItem(itemId: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("equip_shop_item", { p_item_id: itemId });
  return Boolean(data);
}

/** The signed-in user's current upgrade level per game mode (migration 0021), e.g. `{ quiz: 2 }`. Modes with no row owned are left out (level 0). */
export async function fetchMyModeUpgradeLevels(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const userId = await ensureSupabaseSession();
  if (!userId) return {};
  const { data } = await supabase.from("mode_upgrade_levels").select("mode, level").eq("user_id", userId);
  const levels: Record<string, number> = {};
  for (const row of data ?? []) levels[row.mode as string] = row.level as number;
  return levels;
}

/** Buys the next level of a per-mode upgrade (cost/cap checks happen server-side). Returns false if maxed out or unaffordable. */
export async function purchaseModeUpgrade(mode: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("purchase_mode_upgrade", { p_mode: mode });
  return Boolean(data);
}

// --- TCG mode (migration 0027) ---
// Admin-only until an admin flips the global switch (Boss, 2026-10-17) —
// every server-side RPC re-checks profiles.is_admin / tcg_settings.enabled
// on every call, this client-side check (TcgBoard) is only for not
// showing the mode to everyone else before then.

export type TcgCard = {
  id: string;
  characterId: string;
  characterName: string;
  crew: string | null;
  versionLabel: string;
  rarity: TcgRarity;
  imageUrl: string | null;
};

/** The full card catalog (not just owned cards) — used to render "not yet owned" placeholders in the collection. */
export async function fetchTcgCards(): Promise<TcgCard[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("tcg_cards")
    .select("id, character_id, character_name, crew, version_label, rarity, image_url")
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    characterId: r.character_id as string,
    characterName: r.character_name as string,
    crew: r.crew as string | null,
    versionLabel: r.version_label as string,
    rarity: r.rarity as TcgRarity,
    imageUrl: r.image_url as string | null,
  }));
}

/** card_id -> quantity owned, for the signed-in user. */
export async function fetchMyTcgCollection(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const userId = await ensureSupabaseSession();
  if (!userId) return {};
  const { data } = await supabase.from("tcg_user_cards").select("card_id, quantity").eq("user_id", userId);
  const owned: Record<string, number> = {};
  for (const row of data ?? []) owned[row.card_id as string] = row.quantity as number;
  return owned;
}

/** Whether today's (Europe/Berlin) daily pack has already been opened — applies to admins too since migration 0029. */
export async function fetchTcgPackClaimedToday(): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("tcg_pack_claimed_today");
  return Boolean(data);
}

/** Whether an admin has opened the mode to everyone (migration 0027's tcg_settings row). Readable by anyone signed in, writable only via setTcgGlobalEnabled (admin-checked server-side). */
export async function fetchTcgGlobalEnabled(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from("tcg_settings").select("enabled").eq("id", 1).maybeSingle();
  return Boolean(data?.enabled);
}

/** Admin-only: flips the global switch that opens the TCG mode to everyone. Returns false if not admin. */
export async function setTcgGlobalEnabled(enabled: boolean): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("tcg_set_global_enabled", { p_enabled: enabled });
  return Boolean(data);
}

/** Admin-only: wipes the signed-in admin's own TCG collection/fragments/pack claim so they can test from scratch. Returns false if not admin. */
export async function resetMyTcgCollection(): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("tcg_reset_my_collection");
  return Boolean(data);
}

/** The signed-in user's Fragmente balance (profiles.tcg_fragments), earned from duplicate pulls (Q60/Q67). */
export async function fetchMyTcgFragments(): Promise<number> {
  if (!supabase) return 0;
  const userId = await ensureSupabaseSession();
  if (!userId) return 0;
  const { data } = await supabase.from("profiles").select("tcg_fragments").eq("id", userId).maybeSingle();
  return (data?.tcg_fragments as number) ?? 0;
}

/** Exchanges Fragmente for Berry (1:1 since migration 0029). Returns false if unaffordable/invalid. */
export async function exchangeTcgFragments(amount: number): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSupabaseSession();
  if (!userId) return false;
  const { data } = await supabase.rpc("tcg_exchange_fragments", { p_amount: amount });
  return Boolean(data);
}

export type TcgPackResult =
  | {
      ok: true;
      fragmentsGained: number;
      cards: { cardId: string; characterName: string; versionLabel: string; rarity: TcgRarity; imageUrl: string | null; duplicate: boolean }[];
    }
  | { ok: false; error: "not_signed_in" | "not_admin" | "already_claimed" | "not_enough_berries" | "no_backend" };

type TcgPackError = Extract<TcgPackResult, { ok: false }>["error"];

function parseTcgPackResult(data: { ok: boolean; error?: string; fragments_gained?: number; cards?: Record<string, unknown>[] } | null, error: unknown): TcgPackResult {
  if (error || !data) return { ok: false, error: "not_signed_in" };
  if (!data.ok) return { ok: false, error: data.error as TcgPackError };
  return {
    ok: true,
    fragmentsGained: (data.fragments_gained as number) ?? 0,
    cards: (data.cards as Record<string, unknown>[]).map((c) => ({
      cardId: c.card_id as string,
      characterName: c.character_name as string,
      versionLabel: c.version_label as string,
      rarity: c.rarity as TcgRarity,
      imageUrl: c.image_url as string | null,
      duplicate: Boolean(c.duplicate),
    })),
  };
}

/** Opens today's daily pack (5 cards) — drop weights, pity, duplicate->Fragmente conversion and the daily/admin/global-switch checks all happen server-side. Admins are no longer exempt from the daily claim (migration 0029). */
export async function openDailyTcgPack(): Promise<TcgPackResult> {
  if (!supabase) return { ok: false, error: "no_backend" };
  const userId = await ensureSupabaseSession();
  if (!userId) return { ok: false, error: "not_signed_in" };
  const { data, error } = await supabase.rpc("tcg_open_daily_pack");
  return parseTcgPackResult(data, error);
}

/** Buys a 5-card pack for 200 Berry (migration 0029) — same drop odds as the free daily pack, just an extra pull; doesn't touch the daily-claim limit or award XP. */
export async function buyTcgPack(): Promise<TcgPackResult> {
  if (!supabase) return { ok: false, error: "no_backend" };
  const userId = await ensureSupabaseSession();
  if (!userId) return { ok: false, error: "not_signed_in" };
  const { data, error } = await supabase.rpc("tcg_buy_pack");
  return parseTcgPackResult(data, error);
}
