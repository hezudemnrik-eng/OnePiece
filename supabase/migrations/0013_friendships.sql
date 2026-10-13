-- Real friend graph (request -> accept/decline), replacing the "everyone
-- recently online" stand-in that fetchOnlineFriends() used until now.
-- Friend requests are made by looking up a profile's existing share_code
-- (see migration 0002) rather than inventing a second code system.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- One relationship per pair regardless of who sent the request first.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

create policy "participants read their own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "users send friend requests as themselves"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- The addressee accepts/declines; a requester can also update their own
-- still-pending request (e.g. to withdraw it by setting it declined).
create policy "participants respond to their friendships"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "participants remove their own friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
