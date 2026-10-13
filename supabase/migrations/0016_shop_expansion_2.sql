-- Boss asked for "more than 30 further things to buy" in the shop (now its
-- own page, see the Shop redesign commit). Reuses the 5 existing
-- categories from migrations 0012/0014 (frame/color/avatar/title/arena) —
-- no new category needs its own equip_shop_item branch or profiles column,
-- it's just a bigger catalog. 31 new rows total.

-- 7 new avatar characters (ids are real character ids from
-- data/characters.json, same convention as migration 0014's 5).
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('kaido', 'avatar', 'Kaido', 700, 30, ''),
  ('blackbeard', 'avatar', 'Marshall D. Teach', 700, 30, ''),
  ('rayleigh', 'avatar', 'Silvers Rayleigh', 550, 25, ''),
  ('garp', 'avatar', 'Monkey D. Garp', 550, 25, ''),
  ('akainu', 'avatar', 'Sakazuki (Akainu)', 600, 28, ''),
  ('marco', 'avatar', 'Marco', 450, 20, ''),
  ('crocodile', 'avatar', 'Sir Crocodile', 350, 15, '')
on conflict (id) do nothing;

-- 6 new cosmetic frames.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('frame_whitebeard', 'frame', 'Weißbart-Rahmen', 350, 12, 'ring-2 ring-sky-600'),
  ('frame_four_emperors', 'frame', 'Vier-Kaiser-Rahmen', 700, 28, 'ring-2 ring-rose-600 ring-offset-2 ring-offset-[var(--background)] op-s-tier-glow'),
  ('frame_cipher_pol', 'frame', 'Cipher-Pol-Rahmen', 300, 10, 'ring-2 ring-slate-700'),
  ('frame_impel_down', 'frame', 'Impel-Down-Rahmen', 250, 8, 'ring-2 ring-zinc-500'),
  ('frame_grand_fleet', 'frame', 'Groß-Flotten-Rahmen', 300, 12, 'ring-2 ring-orange-500'),
  ('frame_revolutionary', 'frame', 'Revolutionsarmee-Rahmen', 300, 12, 'ring-2 ring-emerald-600')
on conflict (id) do nothing;

-- 6 new name colors.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('color_whitebeard', 'color', 'Weißbart-Gold', 150, 1, 'text-amber-500'),
  ('color_bigmom', 'color', 'Big-Mom-Pink', 150, 1, 'text-pink-500'),
  ('color_kaido', 'color', 'Kaido-Indigo', 150, 1, 'text-indigo-600'),
  ('color_cipher_pol', 'color', 'Cipher-Pol-Schwarz', 150, 1, 'text-slate-700 dark:text-slate-300'),
  ('color_sunny', 'color', 'Sunny-Strohgelb', 100, 1, 'text-yellow-500'),
  ('color_impel_down', 'color', 'Impel-Down-Grau', 100, 1, 'text-zinc-500')
on conflict (id) do nothing;

-- 6 new cosmetic profile titles.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('title_supernova', 'title', 'Supernova der schlimmen Generation', 350, 15, 'italic'),
  ('title_admiral_terror', 'title', 'Schrecken der Admiräle', 500, 25, 'italic font-semibold'),
  ('title_yonko_hunter', 'title', 'Yonko-Jäger', 450, 22, 'italic'),
  ('title_mysterious', 'title', 'Geheimnisvoller Wanderer', 200, 8, 'italic'),
  ('title_swordmaster', 'title', 'Meister des Schwertkampfes', 300, 12, 'italic'),
  ('title_sniper_king', 'title', 'König der Scharfschützen', 250, 10, 'italic')
on conflict (id) do nothing;

-- 6 new cosmetic duel-arena backgrounds.
insert into public.shop_items (id, category, label, price, min_level, class_name) values
  ('arena_dressrosa', 'arena', 'Arena: Dressrosa', 250, 10, 'bg-gradient-to-b from-fuchsia-500/15 to-transparent'),
  ('arena_whole_cake', 'arena', 'Arena: Whole Cake Island', 250, 10, 'bg-gradient-to-b from-pink-400/15 to-transparent'),
  ('arena_zou', 'arena', 'Arena: Zou', 250, 10, 'bg-gradient-to-b from-lime-500/15 to-transparent'),
  ('arena_alabasta', 'arena', 'Arena: Alabasta', 250, 10, 'bg-gradient-to-b from-amber-500/15 to-transparent'),
  ('arena_skypiea', 'arena', 'Arena: Skypiea', 250, 10, 'bg-gradient-to-b from-cyan-400/15 to-transparent'),
  ('arena_enies_lobby', 'arena', 'Arena: Enies Lobby', 250, 10, 'bg-gradient-to-b from-stone-500/15 to-transparent')
on conflict (id) do nothing;
