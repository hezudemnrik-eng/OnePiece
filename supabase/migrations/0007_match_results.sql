-- Append-only match log, powering the new Übersicht's personal stats and
-- friend leaderboard. Only solo-vs-AI and live-draft results are recorded
-- (hotseat is multiple physical players sharing one login, so it doesn't
-- map cleanly to a single account's win/loss).

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  opponent_label text not null default '',
  result text not null check (result in ('win', 'loss')),
  created_at timestamptz not null default now()
);

alter table public.match_results enable row level security;

create policy "match results are readable by everyone signed in"
  on public.match_results for select
  using (auth.role() = 'authenticated');

create policy "users record their own match results"
  on public.match_results for insert
  with check (auth.uid() = user_id);

create index if not exists match_results_user_id_idx on public.match_results (user_id);
create index if not exists match_results_created_at_idx on public.match_results (created_at desc);
