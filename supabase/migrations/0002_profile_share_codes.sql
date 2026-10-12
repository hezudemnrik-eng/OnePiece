-- Lets a friend find your public tier lists without exposing your raw
-- auth.uid(): a short, human-shareable code on the profile instead.
alter table public.profiles
  add column if not exists share_code text unique;

-- profiles are already readable by everyone (0001_init.sql), which is what
-- lets a friend resolve a share_code to a profile id client-side.
