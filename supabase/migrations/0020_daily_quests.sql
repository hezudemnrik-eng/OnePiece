-- Daily quest completion + reward (Boss, 2026-10-14): the "Heute: ..."
-- challenge on Home (src/lib/dailyChallenge.ts) previously was display-only.
-- One claim per user per day, regardless of which quest text is shown that
-- day (quest_id is stored for reference/debugging only).

create table if not exists public.daily_quest_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_date date not null,
  quest_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.daily_quest_claims enable row level security;

create policy "users read their own daily quest claims"
  on public.daily_quest_claims for select
  using (auth.uid() = user_id);

create policy "users record their own daily quest claims"
  on public.daily_quest_claims for insert
  with check (auth.uid() = user_id);

-- Tunable reward size (see also DAILY_QUEST_XP_BONUS/DAILY_QUEST_BERRY_BONUS
-- in src/lib/levels.ts, which just mirror these for display purposes).
create or replace function public.daily_quest_xp_bonus()
returns int
language sql
immutable
as $$
  select 60;
$$;

create or replace function public.daily_quest_berry_bonus()
returns int
language sql
immutable
as $$
  select 80;
$$;

-- Atomically claims today's daily quest for the signed-in user: records the
-- claim (no-op if already claimed today), then awards the XP/Berry bonus on
-- top of whatever the completed run itself already paid out via award_xp().
-- Returns false if not signed in or already claimed today.
create or replace function public.claim_daily_quest(p_quest_id text)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_rows int;
begin
  if v_user is null then
    return false;
  end if;

  insert into public.daily_quest_claims (user_id, claim_date, quest_id)
    values (v_user, current_date, p_quest_id)
    on conflict (user_id, claim_date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false; -- already claimed today
  end if;

  perform public._clamp_and_award_xp(v_user, public.daily_quest_xp_bonus());
  update public.profiles set berries = berries + public.daily_quest_berry_bonus() where id = v_user;
  return true;
end;
$$;
