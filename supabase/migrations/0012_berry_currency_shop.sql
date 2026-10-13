-- New account-wide "Berry" currency (same name/format as the Fusions-Pirat
-- bounty, but a separate balance) earned from leveling up and unlocking
-- achievements, spendable in a general, extensible cosmetics shop. Starts
-- everyone at 0 — no retroactive backfill, same policy as migration 0010.

alter table public.profiles
  add column if not exists berries int not null default 0,
  add column if not exists equipped_color text;

-- Mirrors xpForLevel()/levelFromXp() in src/lib/levels.ts — kept in sync by
-- hand since the level-up Berry bonus below needs to know levels server-side.
create or replace function public.xp_for_level(level int)
returns int
language sql
immutable
as $$
  select case when level <= 1 then 0 else 35 * level * (level - 1) end;
$$;

create or replace function public.level_from_xp(xp int)
returns int
language plpgsql
immutable
as $$
declare
  v_level int := 1;
begin
  -- Capped at 1000 purely as a sanity bound — real xp never gets close.
  while public.xp_for_level(v_level + 1) <= xp and v_level < 1000 loop
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- Tunable reward sizes (see also BERRY_PER_LEVEL / ACHIEVEMENT_BERRY_BONUS
-- in src/lib/levels.ts, which just mirror these for display purposes).
create or replace function public.berry_per_level()
returns int
language sql
immutable
as $$
  select 50;
$$;

create or replace function public.achievement_berry_bonus()
returns int
language sql
immutable
as $$
  select 100;
$$;

-- Replaces the 0011 version to add the level-up Berry bonus; same
-- drop-first requirement as that migration since the signature is
-- unchanged but we're being explicit about intent to redefine it.
drop function if exists public._clamp_and_award_xp(uuid, int);

create or replace function public._clamp_and_award_xp(p_user uuid, p_wanted int)
returns int
language plpgsql
as $$
declare
  v_today date := current_date;
  v_old_xp int;
  v_xp_today int;
  v_xp_today_date date;
  v_awarded int;
  v_old_level int;
  v_new_level int;
  v_berries_gained int;
begin
  select xp, xp_today, xp_today_date into v_old_xp, v_xp_today, v_xp_today_date
    from public.profiles where id = p_user;

  if v_xp_today_date is distinct from v_today then
    v_xp_today := 0;
  end if;

  v_awarded := greatest(0, least(p_wanted, public.daily_xp_cap() - v_xp_today));

  v_old_level := public.level_from_xp(v_old_xp);
  v_new_level := public.level_from_xp(v_old_xp + v_awarded);
  v_berries_gained := greatest(0, v_new_level - v_old_level) * public.berry_per_level();

  update public.profiles
    set xp = v_old_xp + v_awarded,
        xp_today = v_xp_today + v_awarded,
        xp_today_date = v_today,
        berries = berries + v_berries_gained
    where id = p_user;

  return v_awarded;
end;
$$;

-- Replaces the plain client-side insert (migration 0010) so the Berry
-- bonus is awarded atomically with the unlock instead of via a separate,
-- unprotected client increment call.
create or replace function public.unlock_achievement(p_achievement_id text)
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

  insert into public.achievements (user_id, achievement_id)
    values (v_user, p_achievement_id)
    on conflict (user_id, achievement_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false; -- already unlocked
  end if;

  update public.profiles set berries = berries + public.achievement_berry_bonus() where id = v_user;
  return true;
end;
$$;

-- Extensible shop catalog: category is open-ended (frame/color today,
-- background/sound-pack etc. later) so new rows cover new categories
-- without a schema change. class_name is applied client-side as-is.
create table if not exists public.shop_items (
  id text primary key,
  category text not null,
  label text not null,
  price int not null,
  min_level int not null default 1,
  class_name text not null
);

alter table public.shop_items enable row level security;

create policy "shop items are readable by everyone signed in"
  on public.shop_items for select
  using (auth.role() = 'authenticated');

-- One row per item a user has bought — ownership, not equip state (a
-- user can own several frames but only equip one at a time via
-- profiles.equipped_frame / equipped_color).
create table if not exists public.shop_purchases (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.shop_purchases enable row level security;

create policy "users read their own purchases"
  on public.shop_purchases for select
  using (auth.uid() = user_id);

create policy "users record their own purchases"
  on public.shop_purchases for insert
  with check (auth.uid() = user_id);

-- Atomically checks level/funds/not-already-owned, deducts Berry, and
-- records ownership. Returns true on success (including "already owned,
-- nothing to charge"), false if locked or unaffordable.
create or replace function public.purchase_shop_item(p_item_id text)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_price int;
  v_min_level int;
  v_already boolean;
  v_xp int;
  v_berries int;
  v_level int;
  v_rows int;
begin
  if v_user is null then
    return false;
  end if;

  select price, min_level into v_price, v_min_level from public.shop_items where id = p_item_id;
  if v_price is null then
    return false; -- no such item
  end if;

  select exists(select 1 from public.shop_purchases where user_id = v_user and item_id = p_item_id) into v_already;
  if v_already then
    return true;
  end if;

  select xp, berries into v_xp, v_berries from public.profiles where id = v_user;
  v_level := public.level_from_xp(v_xp);
  if v_level < v_min_level or v_berries < v_price then
    return false;
  end if;

  update public.profiles set berries = berries - v_price where id = v_user and berries >= v_price;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false; -- lost a race with another spend since the check above
  end if;

  insert into public.shop_purchases (user_id, item_id) values (v_user, p_item_id);
  return true;
end;
$$;

-- Equips an owned shop item into the right profile slot based on its
-- category. Unequipping (back to a free level-frame or no color) goes
-- through plain profile updates instead (see setEquippedFrame /
-- setEquippedColor) since that never needs an ownership check.
create or replace function public.equip_shop_item(p_item_id text)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_category text;
  v_owned boolean;
begin
  if v_user is null then
    return false;
  end if;

  select category into v_category from public.shop_items where id = p_item_id;
  if v_category is null then
    return false;
  end if;

  select exists(select 1 from public.shop_purchases where user_id = v_user and item_id = p_item_id) into v_owned;
  if not v_owned then
    return false;
  end if;

  if v_category = 'frame' then
    update public.profiles set equipped_frame = p_item_id where id = v_user;
  elsif v_category = 'color' then
    update public.profiles set equipped_color = p_item_id where id = v_user;
  else
    return false; -- unknown category, nothing to equip it into yet
  end if;

  return true;
end;
$$;

-- Starter catalog: a few faction-flavored frames and name colors. Prices
-- are a first guess, easy to retune later with a plain update statement.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('frame_strawhat', 'frame', 'Strohhut-Rahmen', 150, 1, 'ring-2 ring-red-500'),
  ('frame_marine', 'frame', 'Marine-Rahmen', 150, 1, 'ring-2 ring-blue-600'),
  ('frame_shichibukai', 'frame', 'Warlord-Rahmen', 300, 10, 'ring-2 ring-purple-500'),
  ('frame_yonko', 'frame', 'Yonko-Rahmen', 600, 20, 'ring-2 ring-red-700 ring-offset-2 ring-offset-[var(--background)] op-s-tier-glow'),
  ('color_strawhat', 'color', 'Strohhut-Rot', 100, 1, 'text-red-500'),
  ('color_marine', 'color', 'Marine-Blau', 100, 1, 'text-blue-600'),
  ('color_revolutionary', 'color', 'Revolutionsarmee-Grün', 100, 1, 'text-emerald-600'),
  ('color_warlord', 'color', 'Warlord-Violett', 200, 10, 'text-purple-500')
on conflict (id) do nothing;
