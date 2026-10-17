-- TCG follow-up (Boss, 2026-10-17):
--  1. Admins no longer bypass the once-a-day pack limit — Boss explicitly
--     wants the 1-pack-per-day rule to apply to himself too, now that the
--     mode is about to go live for everyone. Admins keep every other
--     admin-only privilege (global enable switch, collection reset,
--     bypassing the "mode not yet enabled" gate).
--  2. Fragmente exchange for Berry at 1:1 instead of 10:1.
--  3. New: a 5-card pack purchasable in the Shop for 200 Berry
--     (tcg_buy_pack) — same drop weights/pity as the free daily pack, so
--     this only buys more pulls, never better odds (Boss's "gleiche
--     Chancen für alle" rule). Draw logic shared via tcg_draw_pack_cards
--     so both paths stay in sync.
--
-- Safe to re-run: all CREATE OR REPLACE FUNCTION, no data-destructive
-- statements.

-- Shared "draw 5 cards for this user" logic, pulled out of
-- tcg_open_daily_pack so tcg_buy_pack can reuse the exact same odds
-- without duplicating the weight table.
create or replace function public.tcg_draw_pack_cards(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.tcg_cards%rowtype;
  v_drawn jsonb := '[]'::jsonb;
  v_rarity text;
  v_roll numeric;
  v_got_above_rekrut boolean := false;
  v_fragments_gained int := 0;
  i int;
begin
  for i in 1..5 loop
    v_roll := random();
    v_rarity := case
      when v_roll < 0.003 then 'god_tier'
      when v_roll < 0.015 then 'yonko'
      when v_roll < 0.050 then 'supernova'
      when v_roll < 0.120 then 'rookie'
      when v_roll < 0.270 then 'kopfgeldjaeger'
      when v_roll < 0.550 then 'pirat'
      else 'rekrut'
    end;

    if i = 5 and not v_got_above_rekrut and v_rarity = 'rekrut' then
      v_rarity := 'pirat';
    end if;
    if v_rarity <> 'rekrut' then
      v_got_above_rekrut := true;
    end if;

    select * into v_card from public.tcg_cards where rarity = v_rarity order by random() limit 1;
    if v_card.id is null then
      select * into v_card from public.tcg_cards where rarity = 'rekrut' order by random() limit 1;
    end if;
    if v_card.id is null then
      continue;
    end if;

    if exists (select 1 from public.tcg_user_cards where user_id = p_user and card_id = v_card.id and quantity > 0) then
      v_fragments_gained := v_fragments_gained + public.tcg_fragment_value(v_card.rarity);
    else
      insert into public.tcg_user_cards (user_id, card_id, quantity, first_obtained_at)
        values (p_user, v_card.id, 1, now())
        on conflict (user_id, card_id) do update
          set quantity = 1, first_obtained_at = coalesce(public.tcg_user_cards.first_obtained_at, now());
    end if;

    v_drawn := v_drawn || jsonb_build_object(
      'card_id', v_card.id,
      'character_name', v_card.character_name,
      'version_label', v_card.version_label,
      'rarity', v_card.rarity,
      'image_url', v_card.image_url,
      'duplicate', exists (select 1 from public.tcg_user_cards where user_id = p_user and card_id = v_card.id and quantity > 1)
    );
  end loop;

  if v_fragments_gained > 0 then
    update public.profiles set tcg_fragments = tcg_fragments + v_fragments_gained where id = p_user;
  end if;

  return jsonb_build_object('cards', v_drawn, 'fragments_gained', v_fragments_gained);
end;
$$;

-- Daily free pack: admins now claim/block exactly like everyone else
-- (Boss, 2026-10-17 — no more bypass). Admins still skip the
-- "mode not yet enabled" gate so they can keep testing before launch.
create or replace function public.tcg_open_daily_pack()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_enabled boolean;
  v_claim_date date := (now() at time zone 'Europe/Berlin')::date;
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

  insert into public.tcg_pack_claims (user_id, claim_date)
    values (v_user, v_claim_date)
    on conflict (user_id, claim_date) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  v_draw := public.tcg_draw_pack_cards(v_user);

  -- Small, fixed XP per pack (Q18) — only for the free daily pack, not
  -- for purchased packs, so Berry can't be laundered into XP.
  perform public._clamp_and_award_xp(v_user, 15);

  return jsonb_build_object('ok', true, 'cards', v_draw->'cards', 'fragments_gained', v_draw->'fragments_gained');
end;
$$;

-- Buyable pack (Boss, 2026-10-17: "im Shop für 200 Berries ein Paket zu
-- fünf Karten kaufen"). Same odds/pity as the free pack, no daily-claim
-- interaction, no XP. Still gated by tcg_settings.enabled/is_admin like
-- the free pack — can't be used to bypass the "mode not live yet" state.
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

  return jsonb_build_object('ok', true, 'cards', v_draw->'cards', 'fragments_gained', v_draw->'fragments_gained');
end;
$$;

-- No more admin exception on this read either — now mirrors the real
-- per-user claim state for everyone, admins included.
create or replace function public.tcg_pack_claimed_today()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.tcg_pack_claims
    where user_id = auth.uid()
      and claim_date = (now() at time zone 'Europe/Berlin')::date
  );
$$;

-- Fragmente <-> Berry now 1:1 instead of 10:1 (Boss, 2026-10-17).
create or replace function public.tcg_exchange_fragments(p_amount int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rate constant int := 1; -- 1 Fragment = 1 Berry
  v_rows int;
begin
  if v_user is null or p_amount is null or p_amount <= 0 or p_amount % v_rate <> 0 then
    return false;
  end if;

  update public.profiles
    set tcg_fragments = tcg_fragments - p_amount,
        berries = berries + (p_amount / v_rate)
    where id = v_user and tcg_fragments >= p_amount;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
