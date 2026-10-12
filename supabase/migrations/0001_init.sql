-- Initial schema for the One Piece Draft-App.
-- Applied automatically by Supabase's GitHub integration on push to main.
--
-- Identity is intentionally lightweight (per the question-catalog answers:
-- no real user accounts needed) — we use Supabase's built-in anonymous
-- auth so every browser gets a stable auth.uid() without email/password,
-- and Row Level Security scopes writes to that id.

-- profiles: one row per anonymous auth user, holds the chosen nickname.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default 'Spieler',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "users manage their own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- tier_lists: a user's tier list. Shared for comparison when is_public is
-- true (the app's "Vergleich mit Freunden" is deliberately minimal — see
-- question catalog section I — so a simple public/private flag is enough
-- rather than a full friend graph).
create table if not exists public.tier_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Meine Tierliste',
  assignments jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tier_lists enable row level security;

create policy "owners read their own tier lists"
  on public.tier_lists for select
  using (auth.uid() = owner_id);

create policy "anyone can read public tier lists"
  on public.tier_lists for select
  using (is_public = true);

create policy "owners manage their own tier lists"
  on public.tier_lists for insert
  with check (auth.uid() = owner_id);

create policy "owners update their own tier lists"
  on public.tier_lists for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners delete their own tier lists"
  on public.tier_lists for delete
  using (auth.uid() = owner_id);

create unique index if not exists tier_lists_owner_name_key
  on public.tier_lists (owner_id, name);

-- draft_sessions: placeholder for the future live PvP draft (currently
-- hotseat-only in the app). Participants are listed by auth.uid(); only
-- they can read or write the session's state.
create table if not exists public.draft_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  participant_ids uuid[] not null default '{}',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.draft_sessions enable row level security;

create policy "participants read their draft session"
  on public.draft_sessions for select
  using (auth.uid() = any (participant_ids));

create policy "participants update their draft session"
  on public.draft_sessions for update
  using (auth.uid() = any (participant_ids))
  with check (auth.uid() = any (participant_ids));

create policy "anyone signed in can create a draft session"
  on public.draft_sessions for insert
  with check (auth.uid() = any (participant_ids));
