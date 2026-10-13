-- Makes leveling harder, per explicit request: a daily XP cap (all modes),
-- diminishing returns on repeating the same "farmable" mode multiple times
-- in one day (Crew-Builder, Blind Ranking — flat XP regardless of skill),
-- and a steeper level curve (see the coefficient bump in src/lib/levels.ts).
--
-- Both award_xp() and increment_xp() enforce the daily cap server-side —
-- client code can't bypass it by calling with a bigger delta.

alter table public.profiles
  add column if not exists xp_today int not null default 0,
  add column if not exists xp_today_date date;

-- One row per completed run, kept only to count today's repeats per mode
-- for the diminishing-returns check below (not used for any leaderboard).
create table if not exists public.mode_run_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  created_at timestamptz not null default now()
);

alter table public.mode_run_log enable row level security;

create policy "users read their own run log"
  on public.mode_run_log for select
  using (auth.uid() = user_id);

create policy "users log their own runs"
  on public.mode_run_log for insert
  with check (auth.uid() = user_id);

create index if not exists mode_run_log_user_mode_day_idx
  on public.mode_run_log (user_id, mode, created_at);

-- A generous daily budget (roughly 15-20 normal runs' worth) — not shown
-- in the UI, it just quietly stops counting once hit.
create or replace function public.daily_xp_cap()
returns int
language sql
immutable
as $$
  select 400;
$$;

-- Clamps `wanted` XP to what's left of today's cap for this user, updates
-- the running total, and returns the amount actually awarded. Shared by
-- award_xp() and increment_xp() below.
create or replace function public._clamp_and_award_xp(p_user uuid, p_wanted int)
returns int
language plpgsql
as $$
declare
  v_today date := current_date;
  v_xp_today int;
  v_xp_today_date date;
  v_awarded int;
begin
  select xp_today, xp_today_date into v_xp_today, v_xp_today_date
    from public.profiles where id = p_user;

  if v_xp_today_date is distinct from v_today then
    v_xp_today := 0;
  end if;

  v_awarded := greatest(0, least(p_wanted, public.daily_xp_cap() - v_xp_today));

  update public.profiles
    set xp = xp + v_awarded,
        xp_today = v_xp_today + v_awarded,
        xp_today_date = v_today
    where id = p_user;

  return v_awarded;
end;
$$;

-- Flat/uncapped-by-mode XP (match wins/losses, quiz score, achievement
-- bonuses) — still subject to the daily cap, just no per-repeat decay.
create or replace function public.increment_xp(delta int)
returns int
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return 0;
  end if;
  return public._clamp_and_award_xp(v_user, delta);
end;
$$;

-- Mode-aware XP award: logs the run, applies ~20%-per-repeat diminishing
-- returns (floor 20% of base) for the farmable modes only, then clamps to
-- the daily cap. Returns the amount actually awarded.
create or replace function public.award_xp(p_mode text, p_base_xp int)
returns int
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_runs_today int;
  v_multiplier numeric := 1.0;
  v_wanted int;
begin
  if v_user is null then
    return 0;
  end if;

  insert into public.mode_run_log (user_id, mode) values (v_user, p_mode);

  if p_mode in ('crew', 'blind-ranking') then
    select count(*) into v_runs_today
      from public.mode_run_log
      where user_id = v_user and mode = p_mode and created_at::date = current_date;
    v_multiplier := greatest(0.2, power(0.8, greatest(0, v_runs_today - 1)));
  end if;

  v_wanted := greatest(0, round(p_base_xp * v_multiplier)::int);
  return public._clamp_and_award_xp(v_user, v_wanted);
end;
$$;
