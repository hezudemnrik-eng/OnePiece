-- Boss (2026-10-14): the Fusions-Piraten mode-upgrade (migration 0021)
-- should NOT boost XP/Berry like every other mode's upgrade — it should
-- only raise the odds of rolling S/A-tier characters (done client-side in
-- rollFusionOption(), src/lib/fusionTraits.ts). Existing purchased levels
-- for 'fusion' are untouched; this only changes what the level *does*.
--
-- Replaces the 0021 version: identical except the upgrade multiplier is
-- forced to 1 for p_mode = 'fusion', so a fusion upgrade level no longer
-- changes the XP/Berry awarded for completing a fusion. Signature/return
-- type unchanged.
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

  v_upgrade_multiplier := case when p_mode = 'fusion' then 1 else public.mode_upgrade_multiplier(v_user, p_mode) end;

  v_wanted := greatest(0, round(p_base_xp * v_repeat_multiplier * v_upgrade_multiplier)::int);

  v_berries := greatest(0, round(public.berry_per_mode_run() * v_upgrade_multiplier)::int);
  update public.profiles set berries = berries + v_berries where id = v_user;

  return public._clamp_and_award_xp(v_user, v_wanted);
end;
$$;
