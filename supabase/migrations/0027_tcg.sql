-- TCG mode (Boss, 2026-10-16/17): collectible character cards across 7
-- rarity tiers up to "God Tier", one free daily pack of 5 cards.
-- Admin-only while being tested; admins can flip a global switch to open
-- it to everyone once ready (Boss, 2026-10-17). Rewritten in place (not
-- yet run/merged) after Boss answered the 100-question brief — see the
-- questionnaire answers for the full rationale on each choice below.
--
-- Card catalog lives in the DB (same pattern as shop_items, migration
-- 0012) rather than in code, so new characters/versions/rarities can be
-- added later with a plain insert instead of a deploy, and the version
-- strings below can keep growing without ever disturbing a row already
-- owned (Q95).

-- 7 rarity tiers, Piraten-themed (Boss: "Rookie, Supernova, Yonko, God
-- Tier"), reusing the same escalation vocabulary as the account rank
-- titles in src/lib/levels.ts for thematic consistency.
create table if not exists public.tcg_cards (
  id text primary key,
  character_id text not null,
  character_name text not null,
  crew text,
  version_label text not null,
  rarity text not null check (rarity in ('rekrut', 'pirat', 'kopfgeldjaeger', 'rookie', 'supernova', 'yonko', 'god_tier')),
  -- Null for now on purpose (Q29/Q92): placeholder art is a simple
  -- rarity-colored icon drawn client-side, not a borrowed character
  -- photo. Chatti's real per-version artwork fills this in later via a
  -- plain update, no schema change needed.
  image_url text,
  flavor_text text,
  sort_order int not null default 0
);

alter table public.tcg_cards enable row level security;

drop policy if exists "tcg cards are readable by everyone signed in" on public.tcg_cards;
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

drop policy if exists "users read their own tcg cards" on public.tcg_user_cards;
create policy "users read their own tcg cards"
  on public.tcg_user_cards for select
  using (auth.uid() = user_id);

-- No insert/update policy: ownership rows are only ever written by
-- tcg_open_daily_pack() / tcg_reset_my_collection() below (both
-- SECURITY DEFINER, bypass RLS), so a client can't grant itself cards
-- directly.

-- One row per (user, day) a pack was opened — the daily limit, same
-- Europe/Berlin-day convention as daily_quest_claims (migration
-- 0020/0026, fixed there after a midnight-rollover bug). Admins bypass
-- the limit entirely while testing (Q75) — see tcg_open_daily_pack.
create table if not exists public.tcg_pack_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_date date not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.tcg_pack_claims enable row level security;

drop policy if exists "users read their own tcg pack claims" on public.tcg_pack_claims;
create policy "users read their own tcg pack claims"
  on public.tcg_pack_claims for select
  using (auth.uid() = user_id);

-- Duplicate copies convert into "Fragmente" instead of silently stacking
-- quantity (Q60, marked "sehr wichtig, muss von Anfang an da sein") —
-- rarer duplicates are worth more (Q67) and fragments exchange for Berry
-- (Q61, see tcg_exchange_fragments below).
alter table public.profiles
  add column if not exists tcg_fragments int not null default 0;

-- Single-row global switch an admin flips to open the mode to everyone
-- once it's ready (Boss, 2026-10-17: "ich will als Admin den TCG Modus
-- für alle freischalten können"). Readable by everyone signed in so the
-- client can show the "Bald verfügbar" teaser (Q73) to non-admins while
-- it's off; only tcg_set_global_enabled() (admin-checked) can flip it.
create table if not exists public.tcg_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  constraint tcg_settings_singleton check (id = 1)
);

insert into public.tcg_settings (id, enabled) values (1, false)
on conflict (id) do nothing;

alter table public.tcg_settings enable row level security;

drop policy if exists "tcg settings are readable by everyone signed in" on public.tcg_settings;
create policy "tcg settings are readable by everyone signed in"
  on public.tcg_settings for select
  using (auth.role() = 'authenticated');

create or replace function public.tcg_set_global_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if not coalesce(v_is_admin, false) then
    return false;
  end if;
  update public.tcg_settings set enabled = p_enabled where id = 1;
  return true;
end;
$$;

-- Fragment value of a duplicate pull, by rarity (Q67).
create or replace function public.tcg_fragment_value(p_rarity text)
returns int
language sql
immutable
as $$
  select case p_rarity
    when 'rekrut' then 2
    when 'pirat' then 4
    when 'kopfgeldjaeger' then 8
    when 'rookie' then 15
    when 'supernova' then 30
    when 'yonko' then 75
    when 'god_tier' then 200
    else 0
  end;
$$;

-- Converts Fragmente into Berry at a fixed rate (Q61). p_amount must be a
-- positive multiple of the rate or it's rejected outright rather than
-- silently rounding down and losing fragments.
create or replace function public.tcg_exchange_fragments(p_amount int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rate constant int := 10; -- 10 Fragmente = 1 Berry
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

-- Rarity weights for the 5-card daily pack (common up front, God Tier
-- under 0.5% as Boss asked). Pity (Q15): a pack can't come back
-- completely empty-handed — if all 5 rolls land on the lowest tier, the
-- last slot is re-rolled among "pirat" cards instead.
-- rekrut 45%, pirat 28%, kopfgeldjaeger 15%, rookie 7%, supernova 3.5%, yonko 1.2%, god_tier 0.3%
--
-- Admin-gated (checks profiles.is_admin) in addition to the client-side
-- gate while tcg_settings.enabled is false, since this is SECURITY
-- DEFINER and reachable directly via supabase.rpc() otherwise. Once an
-- admin flips tcg_settings.enabled on, every signed-in user may call it.
-- Admins also bypass the once-a-day limit outright (Q75) so testing
-- doesn't need the reset RPC below every time.
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
  v_card public.tcg_cards%rowtype;
  v_drawn jsonb := '[]'::jsonb;
  v_rarity text;
  v_roll numeric;
  v_got_above_rekrut boolean := false;
  v_fragments_gained int := 0;
  i int;
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

  if v_is_admin then
    -- Admins bypass the daily limit entirely while testing (Q75) — still
    -- log the open for the record, just never blocked by it.
    insert into public.tcg_pack_claims (user_id, claim_date, opened_at)
      values (v_user, v_claim_date, now())
      on conflict (user_id, claim_date) do update set opened_at = now();
  else
    insert into public.tcg_pack_claims (user_id, claim_date)
      values (v_user, v_claim_date)
      on conflict (user_id, claim_date) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      return jsonb_build_object('ok', false, 'error', 'already_claimed');
    end if;
  end if;

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

    -- Pity (Q15): the last slot can't let the whole pack be Rekrut-only.
    if i = 5 and not v_got_above_rekrut and v_rarity = 'rekrut' then
      v_rarity := 'pirat';
    end if;
    if v_rarity <> 'rekrut' then
      v_got_above_rekrut := true;
    end if;

    select * into v_card from public.tcg_cards where rarity = v_rarity order by random() limit 1;
    if v_card.id is null then
      -- That rarity has no cards seeded yet — fall back to Rekrut rather
      -- than drawing nothing for this slot.
      select * into v_card from public.tcg_cards where rarity = 'rekrut' order by random() limit 1;
    end if;
    if v_card.id is null then
      continue; -- catalog is empty; nothing to draw
    end if;

    if exists (select 1 from public.tcg_user_cards where user_id = v_user and card_id = v_card.id and quantity > 0) then
      -- Already owned: convert the duplicate into Fragmente (Q60/Q67)
      -- instead of stacking quantity.
      v_fragments_gained := v_fragments_gained + public.tcg_fragment_value(v_card.rarity);
    else
      insert into public.tcg_user_cards (user_id, card_id, quantity, first_obtained_at)
        values (v_user, v_card.id, 1, now())
        on conflict (user_id, card_id) do update
          set quantity = 1, first_obtained_at = coalesce(public.tcg_user_cards.first_obtained_at, now());
    end if;

    v_drawn := v_drawn || jsonb_build_object(
      'card_id', v_card.id,
      'character_name', v_card.character_name,
      'version_label', v_card.version_label,
      'rarity', v_card.rarity,
      'image_url', v_card.image_url,
      'duplicate', exists (select 1 from public.tcg_user_cards where user_id = v_user and card_id = v_card.id and quantity > 1)
    );
  end loop;

  if v_fragments_gained > 0 then
    update public.profiles set tcg_fragments = tcg_fragments + v_fragments_gained where id = v_user;
  end if;

  -- Small, fixed XP per pack (Q18) — mirrors the daily-quest-style flat
  -- bonus, not scaled by what was pulled.
  perform public._clamp_and_award_xp(v_user, 15);

  return jsonb_build_object('ok', true, 'cards', v_drawn, 'fragments_gained', v_fragments_gained);
end;
$$;

-- Whether the signed-in admin has already opened today's pack (Europe/Berlin day). Always false for admins (no limit).
create or replace function public.tcg_pack_claimed_today()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.tcg_pack_claims
    where user_id = auth.uid()
      and claim_date = (now() at time zone 'Europe/Berlin')::date
  ) and not coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Admin-only "reset my collection to try things again" (Boss,
-- 2026-10-17). Wipes the caller's own cards, fragments and today's claim
-- — never another user's, and never usable by a non-admin.
create or replace function public.tcg_reset_my_collection()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if not coalesce(v_is_admin, false) then
    return false;
  end if;

  delete from public.tcg_user_cards where user_id = v_user;
  delete from public.tcg_pack_claims where user_id = v_user;
  update public.profiles set tcg_fragments = 0 where id = v_user;
  return true;
end;
$$;

-- First batch: Strohhutbande + a few iconic antagonists, 2-4 versions
-- each, spread across all 7 tiers. Character/version list will grow a
-- lot from here (Boss wants 50+ characters eventually) once the
-- priority order and per-version artwork are locked in — adding more is
-- just another insert, never touches rows already owned (Q95).
insert into public.tcg_cards (id, character_id, character_name, crew, version_label, rarity, flavor_text, sort_order) values
  ('luffy-east-blue', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'East Blue', 'rekrut', 'Ich werde der König der Piraten!', 1),
  ('luffy-gear2', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 2', 'pirat', 'Schneller als jeder Schlag.', 2),
  ('luffy-gear4', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 4', 'kopfgeldjaeger', 'Boundman — zäh wie Gummi, hart wie Stahl.', 3),
  ('luffy-gear5', 'luffy', 'Monkey D. Luffy', 'Strohhutbande', 'Gear 5', 'god_tier', 'Der befreite Krieger — Nika ist erwacht.', 4),

  ('zoro-east-blue', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'East Blue', 'rekrut', 'Ich werde der größte Schwertkämpfer der Welt.', 5),
  ('zoro-wano', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'Wano (Enma)', 'rookie', 'Drei Klingen, ein Wille.', 6),
  ('zoro-king-of-hell', 'zoro', 'Roronoa Zoro', 'Strohhutbande', 'König der Hölle', 'yonko', 'Conquerors Haki entfesselt — die Hölle persönlich.', 7),

  ('sanji-east-blue', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'East Blue', 'rekrut', 'All Blue wartet auf mich.', 8),
  ('sanji-diable-jambe', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'Diable Jambe', 'pirat', 'Heißer Fußtritt, kalter Kopf.', 9),
  ('sanji-ifrit-jambe', 'sanji', 'Vinsmoke Sanji', 'Strohhutbande', 'Ifrit Jambe (Raid Suit)', 'supernova', 'Germa-Technologie trifft Koch-Stolz.', 10),

  ('nami-east-blue', 'nami', 'Nami', 'Strohhutbande', 'East Blue', 'rekrut', 'Eine Karte der ganzen Welt.', 11),
  ('nami-zeus', 'nami', 'Nami', 'Strohhutbande', 'Zeus-Partnerin', 'pirat', 'Ein Wolkengott als Haustier.', 12),

  ('usopp-east-blue', 'usopp', 'Usopp', 'Strohhutbande', 'East Blue', 'rekrut', 'Der tapfere Krieger der See... irgendwann.', 13),
  ('usopp-sogeking', 'usopp', 'Usopp', 'Strohhutbande', 'Sogeking', 'pirat', 'Treffsicher wie nie zuvor.', 14),

  ('chopper-east-blue', 'chopper', 'Tony Tony Chopper', 'Strohhutbande', 'East Blue', 'rekrut', 'Ein Rentier-Arzt mit großem Herz.', 15),
  ('chopper-monster-point', 'chopper', 'Tony Tony Chopper', 'Strohhutbande', 'Monster Point', 'supernova', 'Die stärkste, unkontrollierbarste Form.', 16),

  ('robin-east-blue', 'robin', 'Nico Robin', 'Strohhutbande', 'Debüt', 'rekrut', 'Ich will leben.', 17),
  ('robin-demon-child', 'robin', 'Nico Robin', 'Strohhutbande', 'Demon Child (Blüten-Riese)', 'kopfgeldjaeger', 'Tausend Hände, eine Entscheidung.', 18),

  ('franky-water7', 'franky', 'Franky', 'Strohhutbande', 'Water 7', 'rekrut', 'SUPER!', 19),
  ('franky-general-franky', 'franky', 'Franky', 'Strohhutbande', 'General Franky', 'pirat', 'Cola-betrieben und unaufhaltsam.', 20),

  ('brook-debut', 'brook', 'Brook', 'Strohhutbande', 'Debüt', 'rekrut', 'Yohohoho! Ich bin schon tot, wisst ihr?', 21),
  ('brook-soul-king', 'brook', 'Brook', 'Strohhutbande', 'Soul King Solo', 'pirat', 'Musik, die die Seele berührt.', 22),

  ('jinbe-debut', 'jinbe', 'Jinbe', 'Strohhutbande', 'Debüt', 'rekrut', 'Ein Fischmensch mit Ehre.', 23),
  ('jinbe-sun-pirates', 'jinbe', 'Jinbe', 'Strohhutbande', 'Kapitän der Sonnenpiraten', 'kopfgeldjaeger', 'Karatehieb, der Wellen teilt.', 24),

  ('shanks-akagami', 'shanks', 'Shanks', 'Rotharrbande', 'Rotbart-Pirat', 'kopfgeldjaeger', 'Ein Arm reicht, um zu beschützen.', 25),
  ('shanks-yonko', 'shanks', 'Shanks', 'Rotharrbande', 'Vierkaiser', 'yonko', 'Einer der vier mächtigsten Piraten der Welt.', 26),

  ('whitebeard-vor-marineford', 'whitebeard', 'Edward Newgate (Whitebeard)', 'Weißbart-Piraten', 'Vor Marineford', 'supernova', 'Der Mann, der Ruffy am nächsten kam.', 27),
  ('whitebeard-marineford', 'whitebeard', 'Edward Newgate (Whitebeard)', 'Weißbart-Piraten', 'Marineford (Prime)', 'god_tier', 'Gura Gura no Mi — der Ozean selbst bebt.', 28),

  ('kaido-mensch', 'kaido', 'Kaido', 'Bestienpiraten', 'Menschenform', 'supernova', 'Der stärkste Mann der Welt.', 29),
  ('kaido-drache', 'kaido', 'Kaido', 'Bestienpiraten', 'Drachenform', 'yonko', 'Ein Azure Dragon über Onigashima.', 30),

  ('katakuri-standard', 'katakuri', 'Charlotte Katakuri', 'Big-Mom-Piraten', 'Standard', 'kopfgeldjaeger', 'Mochi, das die Zukunft sieht.', 31),
  ('katakuri-awakened', 'katakuri', 'Charlotte Katakuri', 'Big-Mom-Piraten', 'Erwachte Kraft', 'supernova', 'Die Insel selbst wird zu Mochi.', 32)
on conflict (id) do nothing;
