-- Adds real username+password accounts on top of the existing anonymous
-- auth flow. Supabase Auth's email/password sign-up still needs an email
-- internally, so the app synthesizes one as `<username>@onepiece.local` —
-- the user only ever sees/enters a username. Anonymous sessions keep
-- working unchanged for anyone who doesn't log in (solo modes, quick
-- hotseat drafts don't need an account).

alter table public.profiles
  add column if not exists username text unique;

-- Usernames are matched case-insensitively (we lowercase before storing),
-- but keep the unique index as a safety net against races.
create unique index if not exists profiles_username_key on public.profiles (username);
