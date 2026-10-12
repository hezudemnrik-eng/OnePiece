import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 */
export async function ensureSupabaseSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.session) return null;
  return signInData.session.user.id;
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
