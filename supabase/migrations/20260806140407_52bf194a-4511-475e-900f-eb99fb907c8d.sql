DROP POLICY IF EXISTS "rooms update by participants" ON public.game_rooms;
CREATE POLICY "rooms update by participants" ON public.game_rooms
  FOR UPDATE TO anon, authenticated
  USING (
    created_at > now() - interval '1 day'
    AND (
      guest_id IS NULL
      OR (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text))
      OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id LIKE 'guest-%'))
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text))
    OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id LIKE 'guest-%'))
  );