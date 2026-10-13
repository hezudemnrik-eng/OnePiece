-- Per-invite, single-use registration codes, replacing the one shared
-- "strawhat" code from 0006_auth_gate.sql: only an admin account (the
-- profiles.is_admin flag already introduced in 0006) can mint a code, and
-- each one can be redeemed by exactly one signup.

create table if not exists public.invite_codes (
  code text primary key,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

alter table public.invite_codes enable row level security;

-- Only an admin can mint codes, and only ever under their own account.
create policy "admins create invite codes"
  on public.invite_codes for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admins can see the codes they've created (and whether/when each was used).
create policy "admins view their own invite codes"
  on public.invite_codes for select
  using (created_by = auth.uid());

-- No client-facing update/delete policy: redemption happens server-side
-- (via the service-role key in /api/auth/register, which bypasses RLS) —
-- the person signing up isn't the code's creator and isn't an admin, so
-- they have no business marking codes used directly from the client.
