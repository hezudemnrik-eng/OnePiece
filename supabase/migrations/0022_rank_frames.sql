-- Rank frames (Bronze/Silber/Gold/…) move from decorating the round avatar
-- to decorating the square profile-hero card instead (Boss, 2026-10-14), so
-- they need their own equip slot, independent of the avatar frame bought in
-- the shop (profiles.equipped_frame, unchanged).
alter table public.profiles
  add column if not exists equipped_rank_frame text;

-- Carry over anyone who already had a rank frame equipped in the old
-- (shared) slot, renamed to match the expanded tier list in
-- src/lib/levels.ts (same level thresholds, new names/ids).
update public.profiles
set equipped_rank_frame = case equipped_frame
      when 'bronze' then 'eisen'
      when 'silver' then 'silber'
      when 'gold' then 'platin'
      when 'legendary' then 'legendaer'
    end,
    equipped_frame = null
where equipped_frame in ('bronze', 'silver', 'gold', 'legendary');
