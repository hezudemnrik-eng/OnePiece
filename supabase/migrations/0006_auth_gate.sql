-- Supports the mandatory login gate: avatar, online-status heartbeat, an
-- admin flag, and a shared invite code required to register.

alter table public.profiles
  add column if not exists avatar_character_id text,
  add column if not exists last_seen timestamptz,
  add column if not exists is_admin boolean not null default false;

-- A tiny settings table for things an admin wants to change without a
-- redeploy — right now just the shared registration invite code.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

create policy "app settings are readable by everyone"
  on public.app_settings for select
  using (true);

-- No public write policy: only you can change this, via the SQL editor.
insert into public.app_settings (key, value)
  values ('invite_code', 'strawhat')
  on conflict (key) do nothing;

-- To make yourself admin, run (after you've registered your real account):
--   update public.profiles set is_admin = true where username = 'DEIN_NUTZERNAME';
