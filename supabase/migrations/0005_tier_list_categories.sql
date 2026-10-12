-- Tier lists can now rank things other than characters (arcs, islands,
-- crews, ...). Existing rows default to 'characters' so nothing breaks.

alter table public.tier_lists
  add column if not exists category text not null default 'characters';

drop index if exists tier_lists_owner_name_key;
create unique index if not exists tier_lists_owner_name_category_key
  on public.tier_lists (owner_id, name, category);
