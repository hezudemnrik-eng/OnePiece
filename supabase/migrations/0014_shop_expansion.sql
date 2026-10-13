-- Expands the Berry shop beyond frames/colors (migration 0012) with three
-- new categories, per the redesign's gamification pass: unlockable avatar
-- characters (Q72), cosmetic duel-arena skins (Q117), and cosmetic profile
-- titles (Q176). shop_items/shop_purchases already had an open-ended
-- `category` column, so only the equip step needed new branches.

alter table public.profiles
  add column if not exists equipped_title text,
  add column if not exists equipped_arena text;

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
  elsif v_category = 'avatar' then
    -- Unlike frame/color, the item's own id IS the character id (see the
    -- seed data below), so it slots straight into the existing
    -- avatar_character_id column that AuthGate/ProfileBoard already read.
    update public.profiles set avatar_character_id = p_item_id where id = v_user;
  elsif v_category = 'title' then
    update public.profiles set equipped_title = p_item_id where id = v_user;
  elsif v_category = 'arena' then
    update public.profiles set equipped_arena = p_item_id where id = v_user;
  else
    return false; -- unknown category, nothing to equip it into yet
  end if;

  return true;
end;
$$;

-- Starter catalog for the 3 new categories. Avatar item ids are real
-- character ids from data/characters.json (distinct from the 12 free
-- AVATAR_CHOICES in src/lib/avatarChoices.ts) so equip_shop_item's
-- 'avatar' branch above can write them straight into avatar_character_id.
-- Arena class names are applied once the Duell redesign (later phase)
-- actually renders a themed arena background — stored now so the shop
-- and the purchase/equip flow already work end to end.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('law', 'avatar', 'Trafalgar Law', 400, 15, ''),
  ('mihawk', 'avatar', 'Dracule Mihawk', 400, 15, ''),
  ('katakuri', 'avatar', 'Charlotte Katakuri', 500, 20, ''),
  ('yamato', 'avatar', 'Yamato', 500, 20, ''),
  ('doflamingo', 'avatar', 'Donquixote Doflamingo', 600, 25, ''),
  ('arena_marineford', 'arena', 'Arena: Marineford', 250, 10, 'bg-gradient-to-b from-sky-500/15 to-transparent'),
  ('arena_wano', 'arena', 'Arena: Wano', 250, 10, 'bg-gradient-to-b from-rose-500/15 to-transparent'),
  ('arena_fishman_island', 'arena', 'Arena: Fischmenscheninsel', 250, 10, 'bg-gradient-to-b from-teal-500/15 to-transparent'),
  ('title_feared', 'title', 'Gefürchtet in 4 Meeren', 300, 15, 'italic'),
  ('title_legend', 'title', 'Legende der neuen Welt', 500, 25, 'italic font-semibold'),
  ('title_rookie', 'title', 'Vielversprechender Rookie', 150, 5, 'italic')
on conflict (id) do nothing;
