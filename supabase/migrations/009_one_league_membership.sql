-- Players may leave a league so they can belong to only one at a time.

create policy "Users can leave leagues"
  on public.league_members for delete to authenticated
  using (user_id = auth.uid());
