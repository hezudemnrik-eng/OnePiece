-- TCG follow-up (Boss, 2026-10-17): XP should be awarded for every pack
-- opened, including bought ones, not just the free daily pack. Same fixed
-- 15 XP as tcg_open_daily_pack (Q18) — buying a pack doesn't buy more XP
-- per pull than the free one, just the same amount, extra times.
--
-- Safe to re-run: CREATE OR REPLACE FUNCTION only, no data-destructive
-- statements.

create or replace function public.tcg_buy_pack()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_enabled boolean;
  v_cost constant int := 200;
  v_rows int;
  v_draw jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select is_admin into v_is_admin from public.profiles where id = v_user;
  v_is_admin := coalesce(v_is_admin, false);

  select enabled into v_enabled from public.tcg_settings where id = 1;
  if not v_is_admin and not coalesce(v_enabled, false) then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  update public.profiles set berries = berries - v_cost
    where id = v_user and berries >= v_cost;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_enough_berries');
  end if;

  v_draw := public.tcg_draw_pack_cards(v_user);

  -- Same fixed XP as the free daily pack (Boss, 2026-10-17: every pack
  -- opened should give XP, bought ones included).
  perform public._clamp_and_award_xp(v_user, 15);

  return jsonb_build_object('ok', true, 'cards', v_draw->'cards', 'fragments_gained', v_draw->'fragments_gained');
end;
$$;
