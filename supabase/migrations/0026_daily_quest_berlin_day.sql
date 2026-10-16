-- Fix: the "Tagesquest wird nicht aktualisiert" bug (Boss, 2026-10-16).
--
-- claim_daily_quest() (migration 0020) stamped claim_date using
-- current_date, i.e. the Postgres server's UTC day. The client
-- (src/lib/dailyChallenge.ts) now computes "today" as the Europe/Berlin
-- calendar day. The two have to agree on what day it is, or right after
-- Berlin midnight the quest/claim state looks stuck on yesterday for 1-2
-- hours (depending on DST) — exactly what Boss saw.

create or replace function public.claim_daily_quest(p_quest_id text)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_rows int;
  v_claim_date date := (now() at time zone 'Europe/Berlin')::date;
begin
  if v_user is null then
    return false;
  end if;

  insert into public.daily_quest_claims (user_id, claim_date, quest_id)
    values (v_user, v_claim_date, p_quest_id)
    on conflict (user_id, claim_date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false; -- already claimed today
  end if;

  perform public._clamp_and_award_xp(v_user, public.daily_quest_xp_bonus());
  update public.profiles set berries = berries + public.daily_quest_berry_bonus() where id = v_user;
  return true;
end;
$$;
