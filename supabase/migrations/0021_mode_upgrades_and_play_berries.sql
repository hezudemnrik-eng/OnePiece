-- Two related asks from Boss (2026-10-14): (1) playing any game mode
-- should give Berry, not just leveling up / achievements, and (2) the shop
-- should sell a per-mode "upgrade" with diminishing returns (each level
-- costs more and adds a smaller bonus than the last) that boosts the
-- XP/Berry earned in that mode.

-- One row per user per mode, levels start at 0 (no upgrade owned).
create table if not exists public.mode_upgrade_levels (
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  level int not null default 0,
  primary key (user_id, mode)
);

alter table public.mode_upgrade_levels enable row level security;

-- "for all" (not just select) because purchase_mode_upgrade() below runs
-- as the calling user (no security definer) and needs to insert/update
-- its own row — same pattern as "users manage their own profile" (0001).
create policy "users manage their own mode upgrades"
  on public.mode_upgrade_levels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Flat Berry reward for completing a run of any mode — separate budget
-- from the level-up/achievement Berry bonuses in migration 0012, and
-- deliberately uncapped/undecayed (unlike XP) since Boss just asked for
-- "Berry fürs Spielen", not another throttle.
create or replace function public.berry_per_mode_run()
returns int
language sql
immutable
as $$
  select 15;
$$;

create or replace function public.mode_upgrade_max_level()
returns int
language sql
immutable
as $$
  select 5;
$$;

-- Cost to go from `current_level` to `current_level + 1` — grows linearly
-- so each level is a bigger ask than the last.
create or replace function public.mode_upgrade_cost(current_level int)
returns int
language sql
immutable
as $$
  select 250 * (current_level + 1);
$$;

-- Cumulative XP/Berry bonus percent granted by owning `level` upgrades,
-- as a diminishing-returns series (each level adds 65% of the previous
-- level's increment) — level 1 is +12%, level 5 is ~+30% total, never
-- quite reaching the 12/(1-0.65) ≈ +34.3% asymptote.
create or replace function public.mode_upgrade_bonus_percent(level int)
returns numeric
language sql
immutable
as $$
  select case
    when level <= 0 then 0
    else 12.0 * (1 - power(0.65, level)) / (1 - 0.65)
  end;
$$;

create or replace function public.mode_upgrade_multiplier(p_user uuid, p_mode text)
returns numeric
language plpgsql
as $$
declare
  v_level int;
begin
  select level into v_level from public.mode_upgrade_levels where user_id = p_user and mode = p_mode;
  return 1 + coalesce(public.mode_upgrade_bonus_percent(coalesce(v_level, 0)), 0) / 100.0;
end;
$$;

-- Atomically checks funds/level cap, deducts Berry, and bumps the mode's
-- upgrade level by one. Same shape as purchase_shop_item() in migration
-- 0012, just against mode_upgrade_levels instead of shop_purchases.
create or replace function public.purchase_mode_upgrade(p_mode text)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_level int;
  v_cost int;
  v_rows int;
begin
  if v_user is null then
    return false;
  end if;

  insert into public.mode_upgrade_levels (user_id, mode, level) values (v_user, p_mode, 0)
    on conflict (user_id, mode) do nothing;

  select level into v_level from public.mode_upgrade_levels where user_id = v_user and mode = p_mode;
  if v_level >= public.mode_upgrade_max_level() then
    return false;
  end if;

  v_cost := public.mode_upgrade_cost(v_level);

  update public.profiles set berries = berries - v_cost where id = v_user and berries >= v_cost;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false; -- unaffordable (or lost a race with another spend)
  end if;

  update public.mode_upgrade_levels set level = v_level + 1 where user_id = v_user and mode = p_mode;
  return true;
end;
$$;

-- Replaces the 0011 version: on top of the existing per-repeat XP decay,
-- both the XP and the new flat per-run Berry reward are now scaled by the
-- player's mode_upgrade level for p_mode. Return type/signature unchanged.
create or replace function public.award_xp(p_mode text, p_base_xp int)
returns int
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_runs_today int;
  v_repeat_multiplier numeric := 1.0;
  v_upgrade_multiplier numeric;
  v_wanted int;
  v_berries int;
begin
  if v_user is null then
    return 0;
  end if;

  insert into public.mode_run_log (user_id, mode) values (v_user, p_mode);

  if p_mode in ('crew', 'blind-ranking') then
    select count(*) into v_runs_today
      from public.mode_run_log
      where user_id = v_user and mode = p_mode and created_at::date = current_date;
    v_repeat_multiplier := greatest(0.2, power(0.8, greatest(0, v_runs_today - 1)));
  end if;

  v_upgrade_multiplier := public.mode_upgrade_multiplier(v_user, p_mode);

  v_wanted := greatest(0, round(p_base_xp * v_repeat_multiplier * v_upgrade_multiplier)::int);

  v_berries := greatest(0, round(public.berry_per_mode_run() * v_upgrade_multiplier)::int);
  update public.profiles set berries = berries + v_berries where id = v_user;

  return public._clamp_and_award_xp(v_user, v_wanted);
end;
$$;
