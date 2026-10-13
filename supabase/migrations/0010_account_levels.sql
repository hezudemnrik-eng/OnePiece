-- Account-wide XP/level system: every completed run in any game mode
-- (match, quiz, crew, blind ranking, fusion) awards XP toward one
-- account-wide level and One-Piece-themed rank title. Level/rank/XP
-- curves are derived client-side from this raw xp total (see
-- src/lib/levels.ts) so they can be tuned without a migration.
--
-- Starts everyone at 0 — existing match_results/quiz_results are not
-- backfilled into xp, per explicit request.

alter table public.profiles
  add column if not exists xp int not null default 0,
  add column if not exists equipped_frame text;

-- Atomic increment avoids a read-modify-write race if someone has the
-- app open in two tabs finishing runs around the same time.
create or replace function public.increment_xp(delta int)
returns void
language sql
as $$
  update public.profiles set xp = xp + delta where id = auth.uid();
$$;

-- Unlocked achievements (currently Fusions-Pirat badges — rarity, crew-set
-- and bounty-milestone — but the table isn't scoped to one mode so later
-- modes can add their own achievement_id values here too).
create table if not exists public.achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;

create policy "achievements are readable by everyone signed in"
  on public.achievements for select
  using (auth.role() = 'authenticated');

create policy "users unlock their own achievements"
  on public.achievements for insert
  with check (auth.uid() = user_id);
