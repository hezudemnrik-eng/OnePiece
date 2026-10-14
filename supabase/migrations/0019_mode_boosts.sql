-- Gameplay "boost" shop category (Boss: "Man soll im Shop sich Verbesserung
-- für die Modi holen können") — reuses the existing extensible shop_items /
-- shop_purchases tables from migration 0012, same buy-once-own-forever
-- pattern as the cosmetics, just a new category checked client-side for a
-- gameplay effect instead of an equip slot.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('boost_extra_reroll', 'boost', 'Extra-Würfelversuch', 400, 5, '')
on conflict (id) do nothing;
