-- 1. profiles: hide email from public/authenticated readers
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, country, rating, wins, losses, draws, friends_count, favorite_game, created_at, updated_at) ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2. friends: participants only, authenticated
DROP POLICY IF EXISTS "friends readable" ON public.friends;
CREATE POLICY "friends readable by participants" ON public.friends
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
REVOKE SELECT ON public.friends FROM anon;

-- 3. guest_sessions: no public writes
DROP POLICY IF EXISTS "guests insert" ON public.guest_sessions;
DROP POLICY IF EXISTS "guests update" ON public.guest_sessions;
DROP POLICY IF EXISTS "guests readable" ON public.guest_sessions;
REVOKE ALL ON public.guest_sessions FROM anon, authenticated;
GRANT ALL ON public.guest_sessions TO service_role;

-- 4. matches: no direct client inserts
DROP POLICY IF EXISTS "matches insert" ON public.matches;
REVOKE INSERT ON public.matches FROM authenticated, anon;

-- 5. notifications: only self or known relationship
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert scoped" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friends f
      WHERE (f.user_id = auth.uid() AND f.friend_id = notifications.user_id)
         OR (f.friend_id = auth.uid() AND f.user_id = notifications.user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests r
      WHERE (r.sender_id = auth.uid() AND r.receiver_id = notifications.user_id)
         OR (r.receiver_id = auth.uid() AND r.sender_id = notifications.user_id)
    )
  );

-- 6. game_rooms: writes scoped to participants (guests identified by guest- prefix)
DROP POLICY IF EXISTS "rooms insert" ON public.game_rooms;
DROP POLICY IF EXISTS "rooms update" ON public.game_rooms;
CREATE POLICY "rooms insert by host" ON public.game_rooms
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND host_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND host_id LIKE 'guest-%')
  );
CREATE POLICY "rooms update by participants" ON public.game_rooms
  FOR UPDATE TO anon, authenticated
  USING (
    created_at > now() - interval '1 day'
    AND (
      (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text))
      OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id IS NULL OR guest_id LIKE 'guest-%'))
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text))
    OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id LIKE 'guest-%'))
  );

-- 7. sudoku_challenges: only creator can modify
DROP POLICY IF EXISTS "challenges insert" ON public.sudoku_challenges;
DROP POLICY IF EXISTS "challenges update" ON public.sudoku_challenges;
CREATE POLICY "challenges insert by creator" ON public.sudoku_challenges
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND creator_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND creator_id LIKE 'guest-%')
  );
CREATE POLICY "challenges update by creator" ON public.sudoku_challenges
  FOR UPDATE TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND creator_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND creator_id LIKE 'guest-%')
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND creator_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND creator_id LIKE 'guest-%')
  );

-- 8. sudoku_challenge_entries: only own entry
DROP POLICY IF EXISTS "entries insert" ON public.sudoku_challenge_entries;
DROP POLICY IF EXISTS "entries update" ON public.sudoku_challenge_entries;
CREATE POLICY "entries insert own" ON public.sudoku_challenge_entries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND player_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND player_id LIKE 'guest-%')
  );
CREATE POLICY "entries update own" ON public.sudoku_challenge_entries
  FOR UPDATE TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND player_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND player_id LIKE 'guest-%')
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND player_id = auth.uid()::text)
    OR (auth.uid() IS NULL AND player_id LIKE 'guest-%')
  );

-- unique index needed for the entries upsert to stay scoped
CREATE UNIQUE INDEX IF NOT EXISTS sudoku_challenge_entries_challenge_player_key
  ON public.sudoku_challenge_entries (challenge_id, player_id);

-- 9. SECURITY DEFINER exposure
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(_username));
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;