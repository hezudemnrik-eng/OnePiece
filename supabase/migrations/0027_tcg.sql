-- TCG mode (Boss, 2026-10-16): collectible character cards across 6
-- rarity tiers up to "God Tier", one free daily pack of 5 cards.
-- Admin-only for now (reuses profiles.is_admin, migration 0016) while the
-- mode is being tested — both the RPC below and the client gate check it,
-- so it can't be opened by curling the RPC directly either.
--
-- Card catalog lives in the DB (same pattern as shop_items, migration
-- 0012) rather than in code, so new characters/versions/rarities can be
-- added later with a plain insert instead of a deploy. Seeded below with a
-- first batch of 32 cards using existing character portraits as
-- placeholder artwork — real per-version artwork (Chatti) replaces
-- image_url later via update statements, no schema change needed.

create table if not exists public.tcg_cards (
  id text primary key,
  character_id text not null,
  character_name text not null,
  crew text,
  version_label text not null,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'god_tier')),
  image_url text,
  flavor_text text,
  sort_order int not null default 0
);

alter table public.tcg_cards enable row level security;

create policy "tcg cards are readable by everyone signed in"
  on public.tcg_cards for select
  using (auth.role() = 'authenticated');

-- One row per (user, card) owned — quantity tracks duplicates instead of
-- inserting a row per copy, same shape as mode_upgrade_levels.
create table if not exists public.tcg_user_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.tcg_cards (id) on delete cascade,
  quantity int not null default 0,
  first_obtained_at timestamptz,
  primary key (user_id, card_id)
);

alter table public.tcg_user_cards enable row level security;

create policy "users read their own tcg cards"
  on public.tcg_user_cards for select
  using (auth.uid() = user_id);

-- No insert/update policy: ownership rows are only ever written by
-- tcg_open_daily_pack() below (security definer, bypasses RLS), so a
-- client can't grant itself cards directly.

-- One row per (user, day) a pack was opened — the daily limit, same
-- Europe/Berlin-day convention as daily_quest_claims (migration
-- 0020/0026, fixed there after a midnight-rollover bug).
create table if not exists public.tcg_pack_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_date date not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.tcg_pack_claims enable row level security;

create policy "users read their own tcg pack claims"
  on public.tcg_pack_claims for select
  using (auth.uid() = user_id);

-- Rarity weights for the 5-card daily pack. Placeholder numbers pending
-- Boss's answers in the TCG questionnaire (drop-rate question) — easy to
-- retune later with CREATE OR REPLACE, no migration needed for the
-- numbers themselves.
--   common 50%, uncommon 27%, rare 15%, epic 6%, legendary 1.6%, god_tier 0.4%
--
-- Admin-gated (checks profiles.is_admin) in addition to the client-side
-- gate, since this is SECURITY DEFINER and reachable directly via
-- supabase.rpc() by anyone signed in otherwise.
create or replace function public.tcg_open_daily_pack()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_claim_date date := (now() at time zone 'Europe/Berlin')::date;
  v_rows int;
  v_card public.tcg_cards%rowtype;
  v_drawn jsonb := '[]'::jsonb;
  v_rarity text;
  v_roll numeric;
  i int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select is_admin into v_is_admin from public.profiles where id = v_user;
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  insert into public.tcg_pack_claims (user_id, claim_date)
    values (v_user, v_claim_date)
    on conflict (user_id, claim_date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  for i in 1..5 loop
    v_roll := random();
    v_rarity := case
      when v_roll < 0.004 then 'god_tier'
      when v_roll < 0.020 then 'legendary'
      when v_roll < 0.080 then 'epic'
      when v_roll < 0.230 then 'rare'
      when v_roll < 0.500 then 'uncommon'
      else 'common'
    end;

    select * into v_card from public.tcg_cards where rarity = v_rarity order by random() limit 1;
    if v_card.id is null then
      -- That rarity has no cards seeded yet — fall back to Common rather
      -- than drawing nothing for this slot.
      select * into v_card from public.tcg_cards where rarity = 'common' order by random() limit 1;
    end if;
    if v_card.id is null then
      continue; -- catalog is empty; nothing to draw
    end if;

    insert into public.tcg_user_cards (user_id, card_id, quantity, first_obtained_at)
      values (v_user, v_card.id, 1, now())
      on conflict (user_id, card_id) do update
        set quantity = public.tcg_user_cards.quantity + 1;

    v_drawn := v_drawn || jsonb_build_object(
      'card_id', v_card.id,
      'character_name', v_card.character_name,
      'version_label', v_card.version_label,
      'rarity', v_card.rarity,
      'image_url', v_card.image_url
    );
  end loop;

  return jsonb_build_object('ok', true, 'cards', v_drawn);
end;
$$;

-- Whether the signed-in admin has already opened today's pack (Europe/Berlin day).
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

-- First batch: Strohhutbande + a few iconic antagonists, 2-4 versions
-- each. All versions of a character share its existing portrait as a
-- placeholder (same image repeated) until Chatti delivers one image per
-- version. Character/version list will grow once Boss has answered the
-- questionnaire on which characters/versions to prioritize.
insert into public.tcg_cards (id, character_id, character_name, crew, version_label, rarity, image_url, sort_order) values
  ('luffy-east-blue', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Post_Timeskip_Infobox.png', 1),
  ('luffy-gear2', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 2', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Post_Timeskip_Infobox.png', 2),
  ('luffy-gear4', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 4', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Post_Timeskip_Infobox.png', 3),
  ('luffy-gear5', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 5', 'god_tier', 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Post_Timeskip_Infobox.png', 4),

  ('zoro-east-blue', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/5/52/Roronoa_Zoro_Anime_Post_Timeskip_Infobox.png', 5),
  ('zoro-wano', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'Wano (Enma)', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/5/52/Roronoa_Zoro_Anime_Post_Timeskip_Infobox.png', 6),
  ('zoro-king-of-hell', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'König der Hölle', 'legendary', 'https://static.wikia.nocookie.net/onepiece/images/5/52/Roronoa_Zoro_Anime_Post_Timeskip_Infobox.png', 7),

  ('sanji-east-blue', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/b/b6/Sanji_Anime_Post_Timeskip_Infobox.png', 8),
  ('sanji-diable-jambe', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'Diable Jambe', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/b/b6/Sanji_Anime_Post_Timeskip_Infobox.png', 9),
  ('sanji-ifrit-jambe', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'Ifrit Jambe (Raid Suit)', 'epic', 'https://static.wikia.nocookie.net/onepiece/images/b/b6/Sanji_Anime_Post_Timeskip_Infobox.png', 10),

  ('nami-east-blue', 'nami', 'Nami', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/6/68/Nami_Anime_Post_Timeskip_Infobox.png', 11),
  ('nami-zeus', 'nami', 'Nami', 'Strohhutbande', 'Zeus-Partnerin', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/6/68/Nami_Anime_Post_Timeskip_Infobox.png', 12),

  ('usopp-east-blue', 'usopp', 'Usopp', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/3/35/Usopp_Anime_Post_Timeskip_Infobox.png', 13),
  ('usopp-sogeking', 'usopp', 'Usopp', 'Strohhutbande', 'Sogeking', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/3/35/Usopp_Anime_Post_Timeskip_Infobox.png', 14),

  ('chopper-east-blue', 'chopper', 'Tony Tony Chopper', 'Strohhutbande', 'East Blue', 'common', 'https://static.wikia.nocookie.net/onepiece/images/a/af/Tony_Tony_Chopper_Anime_Post_Timeskip_Infobox.png', 15),
  ('chopper-monster-point', 'chopper', 'Tony Tony Chopper', 'Strohhutbande', 'Monster Point', 'epic', 'https://static.wikia.nocookie.net/onepiece/images/a/af/Tony_Tony_Chopper_Anime_Post_Timeskip_Infobox.png', 16),

  ('robin-east-blue', 'robin', 'Nico Robin', 'Strohhutbande', 'Debüt', 'common', 'https://static.wikia.nocookie.net/onepiece/images/b/bc/Nico_Robin_Anime_Post_Timeskip_Infobox.png', 17),
  ('robin-demon-child', 'robin', 'Nico Robin', 'Strohhutbande', 'Demon Child (Blüten-Riese)', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/b/bc/Nico_Robin_Anime_Post_Timeskip_Infobox.png', 18),

  ('franky-water7', 'franky', 'Franky', 'Strohhutbande', 'Water 7', 'common', 'https://static.wikia.nocookie.net/onepiece/images/8/8c/Franky_Anime_Post_Timeskip_Infobox.png', 19),
  ('franky-general-franky', 'franky', 'Franky', 'Strohhutbande', 'General Franky', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/8/8c/Franky_Anime_Post_Timeskip_Infobox.png', 20),

  ('brook-debut', 'brook', 'Brook', 'Strohhutbande', 'Debüt', 'common', 'https://static.wikia.nocookie.net/onepiece/images/4/41/Brook_Anime_Post_Timeskip_Infobox.png', 21),
  ('brook-soul-king', 'brook', 'Brook', 'Strohhutbande', 'Soul King Solo', 'uncommon', 'https://static.wikia.nocookie.net/onepiece/images/4/41/Brook_Anime_Post_Timeskip_Infobox.png', 22),

  ('jinbe-debut', 'jinbe', 'Jinbe', 'Strohhutbande', 'Debüt', 'common', 'https://static.wikia.nocookie.net/onepiece/images/8/81/Jinbe_Anime_Infobox.png', 23),
  ('jinbe-sun-pirates', 'jinbe', 'Jinbe', 'Strohhutbande', 'Kapitän der Sonnenpiraten', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/8/81/Jinbe_Anime_Infobox.png', 24),

  ('shanks-akagami', 'shanks', 'Shanks', 'Rotharrbande', 'Rotbart-Pirat', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/6/66/Shanks_Anime_Infobox.png', 25),
  ('shanks-yonko', 'shanks', 'Shanks', 'Rotharrbande', 'Vierkaiser', 'legendary', 'https://static.wikia.nocookie.net/onepiece/images/6/66/Shanks_Anime_Infobox.png', 26),

  ('whitebeard-vor-marineford', 'whitebeard', 'Edward Newgate (Whitebeard)', 'Weißbart-Piraten', 'Vor Marineford', 'epic', 'https://static.wikia.nocookie.net/onepiece/images/b/b7/Edward_Newgate_Anime_Infobox.png', 27),
  ('whitebeard-marineford', 'whitebeard', 'Edward Newgate (Whitebeard)', 'Weißbart-Piraten', 'Marineford (Prime)', 'god_tier', 'https://static.wikia.nocookie.net/onepiece/images/b/b7/Edward_Newgate_Anime_Infobox.png', 28),

  ('kaido-mensch', 'kaido', 'Kaido', 'Bestienpiraten', 'Menschenform', 'epic', 'https://static.wikia.nocookie.net/onepiece/images/2/2d/Kaidou_Anime_Infobox.png', 29),
  ('kaido-drache', 'kaido', 'Kaido', 'Bestienpiraten', 'Drachenform', 'legendary', 'https://static.wikia.nocookie.net/onepiece/images/2/2d/Kaidou_Anime_Infobox.png', 30),

  ('katakuri-standard', 'katakuri', 'Charlotte Katakuri', 'Big-Mom-Piraten', 'Standard', 'rare', 'https://static.wikia.nocookie.net/onepiece/images/2/2e/Charlotte_Katakuri_Anime_Infobox.png', 31),
  ('katakuri-awakened', 'katakuri', 'Charlotte Katakuri', 'Big-Mom-Piraten', 'Erwachte Kraft', 'epic', 'https://static.wikia.nocookie.net/onepiece/images/2/2e/Charlotte_Katakuri_Anime_Infobox.png', 32)
on conflict (id) do nothing;
