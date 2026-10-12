-- Quiz feature: solo results (for personal stats + leaderboard) and
-- multiplayer sessions (shared question set, each player answers at their
-- own pace, scores compared on a shared leaderboard — simpler than
-- lockstep turns, which a quiz doesn't need).

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score int not null,
  total int not null,
  category text not null default 'alle',
  difficulty text not null default 'alle',
  created_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;

create policy "quiz results are readable by everyone signed in"
  on public.quiz_results for select
  using (auth.role() = 'authenticated');

create policy "users record their own quiz results"
  on public.quiz_results for insert
  with check (auth.uid() = user_id);

create index if not exists quiz_results_user_id_idx on public.quiz_results (user_id);

-- Multiplayer: one fixed question set per session, shared via invite code.
create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'alle',
  difficulty text not null default 'alle',
  questions jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.quiz_sessions enable row level security;

create policy "anyone signed in can read quiz sessions"
  on public.quiz_sessions for select
  using (auth.role() = 'authenticated');

create policy "anyone signed in can create a quiz session"
  on public.quiz_sessions for insert
  with check (auth.uid() = host_id);

create table if not exists public.quiz_participants (
  session_id uuid not null references public.quiz_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  score int,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.quiz_participants enable row level security;

create policy "anyone signed in can read quiz participants"
  on public.quiz_participants for select
  using (auth.role() = 'authenticated');

create policy "users manage their own participant row"
  on public.quiz_participants for insert
  with check (auth.uid() = user_id);

create policy "users update their own participant row"
  on public.quiz_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
