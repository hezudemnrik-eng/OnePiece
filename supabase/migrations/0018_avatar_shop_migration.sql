-- Boss asked to move most of the free signup-avatar roster into the Berry
-- shop so leveling/spending actually unlocks more of them, keeping only a
-- small free starter set (see the matching change to
-- src/lib/avatarChoices.ts: AVATAR_CHOICE_IDS now only has luffy/zoro/
-- nami/usopp/chopper). The other 7 — sanji, robin, franky, brook, jinbe,
-- shanks, ace — become regular 'avatar'-category shop items, priced low
-- since they used to be free rather than as postgame unlocks like
-- migration 0014's law/mihawk/katakuri/yamato/doflamingo.

insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('sanji', 'avatar', 'Vinsmoke Sanji', 150, 1, ''),
  ('robin', 'avatar', 'Nico Robin', 120, 1, ''),
  ('franky', 'avatar', 'Franky', 120, 1, ''),
  ('brook', 'avatar', 'Brook', 100, 1, ''),
  ('jinbe', 'avatar', 'Jinbe', 150, 1, ''),
  ('shanks', 'avatar', 'Shanks', 250, 5, ''),
  ('ace', 'avatar', 'Portgas D. Ace', 200, 5, '')
on conflict (id) do nothing;

-- Grandfather clause: nobody loses the avatar they already have equipped.
-- Anyone whose avatar_character_id is one of these 7 gets it recorded as
-- already-owned, so switching away and back later doesn't ask them to
-- re-buy what used to be free.
insert into public.shop_purchases (user_id, item_id)
select id, avatar_character_id
from public.profiles
where avatar_character_id in ('sanji', 'robin', 'franky', 'brook', 'jinbe', 'shanks', 'ace')
on conflict (user_id, item_id) do nothing;
