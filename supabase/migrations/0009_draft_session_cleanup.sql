-- Open lobbies are now surfaced in the Übersicht's "Offene Lobbys" list
-- (added this session), which means an abandoned lobby no one ever starts
-- or finishes lingers there forever — there was no delete policy at all,
-- so nobody (not even the host) could clear one out. Lets the host remove
-- their own lobby; the app also now only queries lobbies updated recently
-- (see fetchRelevantLiveDrafts), so old abandoned ones age out of the list
-- even without being deleted.
create policy "host can delete their own draft session"
  on public.draft_sessions for delete
  using (auth.uid() = host_id);
