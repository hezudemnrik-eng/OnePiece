-- Turns the live quiz from "everyone plays the same questions at their own
-- pace" into a strict round-robin (Q123=B): one question is "live" for
-- everyone at a time, and only the participant whose turn it is can answer
-- it while the rest watch. Turn order follows join order (joined_at).

alter table public.quiz_participants
  add column if not exists joined_at timestamptz not null default now();

alter table public.quiz_sessions
  add column if not exists current_index int not null default 0;

-- Any current participant can advance the shared pointer — the small
-- friend-group trust model already used elsewhere (match_results,
-- draft_sessions) rather than a stricter per-column lockdown.
create policy "participants advance their quiz session"
  on public.quiz_sessions for update
  using (exists (select 1 from public.quiz_participants where session_id = id and user_id = auth.uid()))
  with check (exists (select 1 from public.quiz_participants where session_id = id and user_id = auth.uid()));

-- Compare-and-swap so two near-simultaneous calls (e.g. a slow poll racing
-- the active player's own advance) can't double-advance the turn pointer.
create or replace function public.advance_quiz_turn(p_session_id uuid, p_expected_index int)
returns boolean
language plpgsql
as $$
declare
  v_rows int;
begin
  update public.quiz_sessions
    set current_index = p_expected_index + 1
    where id = p_session_id and current_index = p_expected_index;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
