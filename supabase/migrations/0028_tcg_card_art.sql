-- Real Chatti character artwork for all 32 TCG cards (replaces the
-- placeholder rarity-icon fallback in CardFace). Safe to re-run: plain
-- UPDATEs by id, never touches tcg_user_cards ownership rows.

update public.tcg_cards set image_url = '/images/tcg/cards/luffy-east-blue.webp' where id = 'luffy-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/luffy-gear2.webp' where id = 'luffy-gear2';
update public.tcg_cards set image_url = '/images/tcg/cards/luffy-gear4.webp' where id = 'luffy-gear4';
update public.tcg_cards set image_url = '/images/tcg/cards/luffy-gear5.webp' where id = 'luffy-gear5';

update public.tcg_cards set image_url = '/images/tcg/cards/zoro-east-blue.webp' where id = 'zoro-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/zoro-wano.webp' where id = 'zoro-wano';
update public.tcg_cards set image_url = '/images/tcg/cards/zoro-king-of-hell.webp' where id = 'zoro-king-of-hell';

update public.tcg_cards set image_url = '/images/tcg/cards/sanji-east-blue.webp' where id = 'sanji-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/sanji-diable-jambe.webp' where id = 'sanji-diable-jambe';
update public.tcg_cards set image_url = '/images/tcg/cards/sanji-ifrit-jambe.webp' where id = 'sanji-ifrit-jambe';

update public.tcg_cards set image_url = '/images/tcg/cards/nami-east-blue.webp' where id = 'nami-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/nami-zeus.webp' where id = 'nami-zeus';

update public.tcg_cards set image_url = '/images/tcg/cards/usopp-east-blue.webp' where id = 'usopp-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/usopp-sogeking.webp' where id = 'usopp-sogeking';

update public.tcg_cards set image_url = '/images/tcg/cards/chopper-east-blue.webp' where id = 'chopper-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/chopper-monster-point.webp' where id = 'chopper-monster-point';

update public.tcg_cards set image_url = '/images/tcg/cards/robin-east-blue.webp' where id = 'robin-east-blue';
update public.tcg_cards set image_url = '/images/tcg/cards/robin-demon-child.webp' where id = 'robin-demon-child';

update public.tcg_cards set image_url = '/images/tcg/cards/franky-water7.webp' where id = 'franky-water7';
update public.tcg_cards set image_url = '/images/tcg/cards/franky-general-franky.webp' where id = 'franky-general-franky';

update public.tcg_cards set image_url = '/images/tcg/cards/brook-debut.webp' where id = 'brook-debut';
update public.tcg_cards set image_url = '/images/tcg/cards/brook-soul-king.webp' where id = 'brook-soul-king';

update public.tcg_cards set image_url = '/images/tcg/cards/jinbe-debut.webp' where id = 'jinbe-debut';
update public.tcg_cards set image_url = '/images/tcg/cards/jinbe-sun-pirates.webp' where id = 'jinbe-sun-pirates';

update public.tcg_cards set image_url = '/images/tcg/cards/shanks-akagami.webp' where id = 'shanks-akagami';
update public.tcg_cards set image_url = '/images/tcg/cards/shanks-yonko.webp' where id = 'shanks-yonko';

update public.tcg_cards set image_url = '/images/tcg/cards/whitebeard-vor-marineford.webp' where id = 'whitebeard-vor-marineford';
update public.tcg_cards set image_url = '/images/tcg/cards/whitebeard-marineford.webp' where id = 'whitebeard-marineford';

update public.tcg_cards set image_url = '/images/tcg/cards/kaido-mensch.webp' where id = 'kaido-mensch';
update public.tcg_cards set image_url = '/images/tcg/cards/kaido-drache.webp' where id = 'kaido-drache';

update public.tcg_cards set image_url = '/images/tcg/cards/katakuri-standard.webp' where id = 'katakuri-standard';
update public.tcg_cards set image_url = '/images/tcg/cards/katakuri-awakened.webp' where id = 'katakuri-awakened';
