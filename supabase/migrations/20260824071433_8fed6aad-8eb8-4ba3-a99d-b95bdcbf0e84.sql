CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.award_leaderboard_toppers(_day date DEFAULT (now() at time zone 'utc')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows integer := 0;
BEGIN
  WITH toppers AS (
    SELECT DISTINCT ON (l.game_id) l.game_id, l.user_id, g.name
    FROM public.leaderboards l
    JOIN public.games g ON g.id = l.game_id AND g.active
    WHERE (l.wins + l.losses + l.draws) > 0
    ORDER BY l.game_id, l.rating DESC, l.wins DESC, l.updated_at ASC
  ), per_user AS (
    SELECT user_id, count(*)::int AS games, string_agg(name, ', ' ORDER BY name) AS names
    FROM toppers GROUP BY user_id
  ), ins AS (
    INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
    SELECT user_id, 'topper', 20 * games, _day, 'Leaderboard #1: ' || names
    FROM per_user
    ON CONFLICT (user_id, kind, day) DO NOTHING
    RETURNING user_id, amount
  ), up AS (
    INSERT INTO public.user_rewards (user_id, coins)
    SELECT user_id, amount FROM ins
    ON CONFLICT (user_id) DO UPDATE
      SET coins = public.user_rewards.coins + EXCLUDED.coins,
          updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO _rows FROM up;

  RETURN _rows;
END;
$$;

REVOKE ALL ON FUNCTION public.award_leaderboard_toppers(date) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('award-leaderboard-toppers')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'award-leaderboard-toppers');

SELECT cron.schedule(
  'award-leaderboard-toppers',
  '10 0 * * *',
  $$SELECT public.award_leaderboard_toppers();$$
);