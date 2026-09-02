-- helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.week_start(_ts timestamptz DEFAULT now())
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (date_trunc('week', (_ts AT TIME ZONE 'utc')))::date
$$;

CREATE TABLE IF NOT EXISTS public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL DEFAULT public.week_start(),
  points integer NOT NULL,
  kind text NOT NULL,
  ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS point_events_week_idx ON public.point_events (week_start, user_id);

GRANT SELECT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own points readable" ON public.point_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- points are only granted by trusted routines ---------------------------
CREATE OR REPLACE FUNCTION public.grant_points(_user_id uuid, _points integer, _kind text, _ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _points IS NULL OR _points = 0 THEN RETURN; END IF;
  INSERT INTO public.point_events (user_id, week_start, points, kind, ref)
  VALUES (_user_id, public.week_start(), _points, _kind, _ref)
  ON CONFLICT (user_id, kind, ref) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.grant_points(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

-- record_game_result: only online ranked + daily challenges score --------
CREATE OR REPLACE FUNCTION public.record_game_result(_game_id text, _mode text, _outcome text, _opponent_name text DEFAULT NULL::text, _score integer DEFAULT 0, _duration_seconds integer DEFAULT 0, _mistakes integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); delta int; prof public.profiles; mode text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _outcome NOT IN ('win','loss','draw') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id) THEN
    RAISE EXCEPTION 'unknown game';
  END IF;

  mode := left(coalesce(_mode,'solo'),20);

  -- only online ranked matches move rating
  delta := CASE
    WHEN mode <> 'online' THEN 0
    WHEN _outcome = 'win' THEN 18
    WHEN _outcome = 'loss' THEN -14
    ELSE 3 END;

  INSERT INTO public.game_results (
    user_id, game_id, mode, result, opponent_name, rating_delta,
    score, duration_seconds, mistakes)
  VALUES (uid, _game_id, mode, _outcome,
    left(nullif(btrim(coalesce(_opponent_name,'')),''), 40), delta,
    GREATEST(COALESCE(_score,0),0), GREATEST(COALESCE(_duration_seconds,0),0),
    GREATEST(COALESCE(_mistakes,0),0));

  -- weekly points: online ranked results and one daily challenge per game per day
  IF mode = 'online' THEN
    PERFORM public.grant_points(uid, delta, 'ranked',
      _game_id || ':' || extract(epoch from clock_timestamp())::bigint::text);
  ELSIF mode = 'daily' THEN
    PERFORM public.grant_points(uid, 10, 'daily', _game_id || ':' || current_date::text);
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF prof.id IS NOT NULL THEN
    UPDATE public.profiles SET
      rating = GREATEST(100, prof.rating + delta),
      wins = prof.wins + (CASE WHEN _outcome = 'win' THEN 1 ELSE 0 END),
      losses = prof.losses + (CASE WHEN _outcome = 'loss' THEN 1 ELSE 0 END),
      draws = prof.draws + (CASE WHEN _outcome = 'draw' THEN 1 ELSE 0 END),
      favorite_game = COALESCE(prof.favorite_game, _game_id)
    WHERE id = uid;
  END IF;

  INSERT INTO public.leaderboards (game_id, user_id, period, rating, wins, losses, draws)
  VALUES (_game_id, uid, 'global', GREATEST(100, 1200 + delta),
    CASE WHEN _outcome = 'win' THEN 1 ELSE 0 END,
    CASE WHEN _outcome = 'loss' THEN 1 ELSE 0 END,
    CASE WHEN _outcome = 'draw' THEN 1 ELSE 0 END)
  ON CONFLICT (game_id, user_id, period) DO UPDATE SET
    rating = GREATEST(100, public.leaderboards.rating + delta),
    wins = public.leaderboards.wins + (CASE WHEN _outcome = 'win' THEN 1 ELSE 0 END),
    losses = public.leaderboards.losses + (CASE WHEN _outcome = 'loss' THEN 1 ELSE 0 END),
    draws = public.leaderboards.draws + (CASE WHEN _outcome = 'draw' THEN 1 ELSE 0 END),
    updated_at = now();

  RETURN jsonb_build_object('rating_delta', delta);
END; $function$;

-- weekly boards ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_points_board(p_limit integer DEFAULT 50, p_ids uuid[] DEFAULT NULL, p_week date DEFAULT public.week_start())
RETURNS TABLE(player_key uuid, name text, avatar text, value integer, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.user_id,
         COALESCE(p.username, p.display_name, 'player'),
         p.avatar_url,
         GREATEST(SUM(e.points), 0)::int,
         e.user_id = auth.uid()
  FROM public.point_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.week_start = p_week
    AND p.username IS NOT NULL
    AND (p_ids IS NULL OR e.user_id = ANY (p_ids))
  GROUP BY e.user_id, p.username, p.display_name, p.avatar_url
  HAVING GREATEST(SUM(e.points), 0) > 0
  ORDER BY 4 DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 50);
$$;

CREATE OR REPLACE FUNCTION public.my_weekly_points(p_week date DEFAULT public.week_start())
RETURNS TABLE(points integer, rank integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH totals AS (
    SELECT e.user_id, GREATEST(SUM(e.points), 0)::int AS pts
    FROM public.point_events e
    WHERE e.week_start = p_week
    GROUP BY e.user_id
  )
  SELECT t.pts,
         (SELECT count(*) + 1 FROM totals o WHERE o.pts > t.pts)::int
  FROM totals t
  WHERE t.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.weekly_points_board(integer, uuid[], date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_weekly_points(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_points_board(integer, uuid[], date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_weekly_points(date) TO authenticated, service_role;

-- weekly prize payout ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_weekly_winners(_week date DEFAULT (public.week_start() - 7))
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rows integer := 0;
BEGIN
  WITH totals AS (
    SELECT e.user_id, GREATEST(SUM(e.points), 0)::int AS pts, MIN(e.created_at) AS first_at
    FROM public.point_events e
    WHERE e.week_start = _week
    GROUP BY e.user_id
    HAVING GREATEST(SUM(e.points), 0) > 0
  ), ranked AS (
    SELECT user_id, pts, row_number() OVER (ORDER BY pts DESC, first_at ASC) AS pos
    FROM totals
  ), prizes AS (
    SELECT user_id, pos, (ARRAY[200,150,100])[pos] AS coins FROM ranked WHERE pos <= 3
  ), ins AS (
    INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
    SELECT user_id, 'weekly_prize', coins, _week + 7,
           'Weekly leaderboard #' || pos || ' (week of ' || _week || ')'
    FROM prizes
    ON CONFLICT (user_id, kind, day) DO NOTHING
    RETURNING user_id, amount
  ), up AS (
    INSERT INTO public.user_rewards (user_id, coins)
    SELECT user_id, amount FROM ins
    ON CONFLICT (user_id) DO UPDATE
      SET coins = public.user_rewards.coins + EXCLUDED.coins, updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO _rows FROM up;
  RETURN _rows;
END; $$;
REVOKE ALL ON FUNCTION public.award_weekly_winners(date) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('weekly-points-payout') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-points-payout');
SELECT cron.schedule('weekly-points-payout', '10 0 * * 1',
  $cron$SELECT public.award_weekly_winners();$cron$);