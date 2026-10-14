-- Lets a player invite a friend to a Live-Draft lobby straight from the
-- app's friend list, instead of only sharing the invite code outside the
-- app. Insert is gated to actual accepted friendships (mirrors the
-- friendships RLS pattern from migration 0013); the recipient reads their
-- own incoming invites and dismisses them (accepted or declined) by
-- deleting the row.

create table if not exists public.draft_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

alter table public.draft_invites enable row level security;

create policy "friends send draft invites as themselves"
  on public.draft_invites for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = to_user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = to_user_id))
    )
  );

create policy "participants read their own draft invites"
  on public.draft_invites for select
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "participants remove their own draft invites"
  on public.draft_invites for delete
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_invites'
  ) then
    alter publication supabase_realtime add table public.draft_invites;
  end if;
end $$;
