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

export type RemoteTierList = {
  id: string;
  name: string;
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
    .select("id, name, assignments, is_public, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { userId, lists: [], error: error.message };
  return { userId, lists: (data as RemoteTierList[]) ?? [] };
}

/** Creates or updates (by owner_id + name) a tier list. No-op if Supabase isn't configured. */
export async function saveTierListRemote(
  name: string,
  assignments: Record<string, string>,
  isPublic: boolean
): Promise<{ error?: string }> {
  if (!supabase) return {};
  const userId = await ensureSupabaseSession();
  if (!userId) return { error: "no session" };
  const { error } = await supabase
    .from("tier_lists")
    .upsert(
      { owner_id: userId, name, assignments, is_public: isPublic, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,name" }
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
    .select("name, assignments")
    .eq("owner_id", profile.id)
    .eq("is_public", true);
  if (error || !lists) return { ok: false, lists: [] };

  return {
    ok: true,
    lists: lists.map((l) => ({ ownerNickname: profile.nickname, name: l.name, assignments: l.assignments })),
  };
}
