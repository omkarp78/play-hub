
-- 1. Lock down raw reads --------------------------------------------------
DROP POLICY IF EXISTS "results readable" ON public.game_results;
CREATE POLICY "results own readable" ON public.game_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "leaderboards readable" ON public.leaderboards;
CREATE POLICY "leaderboards own readable" ON public.leaderboards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Public display data through trusted routines -------------------------
CREATE OR REPLACE FUNCTION public.game_solo_top(p_game_id text, p_limit int DEFAULT 20)
RETURNS TABLE (player_key text, name text, score int, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(g.user_id::text),
         COALESCE(p.username, p.display_name, 'player'),
         MAX(g.score)::int,
         g.user_id = auth.uid()
  FROM public.game_results g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  WHERE g.game_id = p_game_id AND g.mode = 'solo'
  GROUP BY g.user_id, p.username, p.display_name
  ORDER BY 3 DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 50);
$$;

CREATE OR REPLACE FUNCTION public.game_ranked_board(
  p_game_id text, p_limit int DEFAULT 50, p_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  player_key text, name text, avatar text, rating int,
  wins int, losses int, draws int, is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(l.user_id::text),
         COALESCE(p.username, p.display_name, 'player'),
         p.avatar_url,
         l.rating::int, l.wins::int, l.losses::int, l.draws::int,
         l.user_id = auth.uid()
  FROM public.leaderboards l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  WHERE l.game_id = p_game_id
    AND l.period = 'global'
    AND (p_ids IS NULL OR l.user_id = ANY (p_ids))
  ORDER BY l.rating DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 50);
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_profiles(
  p_game_id text DEFAULT NULL, p_days int DEFAULT NULL, p_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, username text, avatar_url text, rating int,
  wins int, losses int, country text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.avatar_url, p.rating::int, p.wins::int, p.losses::int, p.country
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND (p_ids IS NULL OR p.id = ANY (p_ids))
    AND (
      p_days IS NULL
      OR EXISTS (
        SELECT 1 FROM public.game_results g
        WHERE g.user_id = p.id
          AND g.created_at >= now() - make_interval(days => p_days)
          AND (p_game_id IS NULL OR g.game_id = p_game_id)
      )
    )
    AND (
      p_days IS NOT NULL OR p_game_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leaderboards l
        WHERE l.user_id = p.id AND l.game_id = p_game_id AND l.period = 'global'
      )
    )
  ORDER BY p.rating DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.profile_recent_results(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, game_id text, mode text, result text,
  opponent_name text, rating_delta int, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.game_id, g.mode, g.result, g.opponent_name, g.rating_delta::int, g.created_at
  FROM public.game_results g
  WHERE g.user_id = p_user_id
  ORDER BY g.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 50);
$$;

REVOKE ALL ON FUNCTION public.game_solo_top(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.game_ranked_board(text, int, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_profiles(text, int, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_recent_results(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.game_solo_top(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_ranked_board(text, int, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_profiles(text, int, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_recent_results(uuid, int) TO anon, authenticated;

-- 3. Game room write hardening --------------------------------------------
DROP POLICY IF EXISTS "rooms update by participants" ON public.game_rooms;
CREATE POLICY "rooms update by active participants" ON public.game_rooms
  FOR UPDATE TO anon, authenticated
  USING (
    created_at > now() - interval '6 hours'
    AND status IN ('waiting', 'active', 'playing', 'ready')
    AND (
      (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text OR guest_id IS NULL))
      OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id LIKE 'guest-%' OR guest_id IS NULL))
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND (host_id = auth.uid()::text OR guest_id = auth.uid()::text))
    OR (auth.uid() IS NULL AND (host_id LIKE 'guest-%' OR guest_id LIKE 'guest-%'))
  );

CREATE OR REPLACE FUNCTION public.game_rooms_freeze_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  NEW.code := OLD.code;
  NEW.game_id := OLD.game_id;
  NEW.host_id := OLD.host_id;
  NEW.created_at := OLD.created_at;
  IF OLD.guest_id IS NOT NULL AND NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    NEW.guest_id := OLD.guest_id;
    NEW.guest_name := OLD.guest_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_rooms_freeze_identity ON public.game_rooms;
CREATE TRIGGER game_rooms_freeze_identity
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_freeze_identity();
