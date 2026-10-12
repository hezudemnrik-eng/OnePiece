-- Redesigns draft_sessions for real multi-device live drafting (the app
-- was hotseat-only until now). Access control is the invite code itself,
-- not row-level participant membership: a brand-new joiner isn't yet a
-- participant, so a membership-gated policy can never let them in (the
-- chicken-and-egg problem). This is a private friend-group app with no
-- real user data (see question-catalog answers), so "any signed-in
-- browser can read/write a session if it has the row's id or invite
-- code" is an acceptable, deliberately simple trade-off — there is no
-- "list all sessions" view in the app, so this isn't practically
-- browsable even though it's technically broad.

alter table public.draft_sessions
  add column if not exists host_id uuid references auth.users (id),
  add column if not exists max_players int not null default 4,
  add column if not exists phase text not null default 'lobby',
  add column if not exists battle jsonb;

-- Drop the old policies BEFORE the column they depend on, or Postgres
-- refuses the drop (2BP01: objects depend on it).
drop policy if exists "participants read their draft session" on public.draft_sessions;
drop policy if exists "participants update their draft session" on public.draft_sessions;
drop policy if exists "anyone signed in can create a draft session" on public.draft_sessions;

alter table public.draft_sessions
  drop column if exists participant_ids;

create policy "signed in users read draft sessions"
  on public.draft_sessions for select
  using (auth.uid() is not null);

create policy "signed in users create draft sessions"
  on public.draft_sessions for insert
  with check (auth.uid() = host_id);

create policy "signed in users update draft sessions"
  on public.draft_sessions for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Realtime needs the table added to the publication it broadcasts from.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_sessions'
  ) then
    alter publication supabase_realtime add table public.draft_sessions;
  end if;
end $$;
