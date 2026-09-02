-- Public read helper: who earned the daily leaderboard topper bonus, and for how many games.
CREATE OR REPLACE FUNCTION public.topper_badges(p_ids uuid[] DEFAULT NULL::uuid[], p_day date DEFAULT ((now() AT TIME ZONE 'utc')::date))
RETURNS TABLE(user_id uuid, games integer, amount integer, note text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.user_id,
         GREATEST(t.amount / 20, 1)::int AS games,
         t.amount::int,
         t.note
  FROM public.coin_transactions t
  WHERE t.kind = 'topper'
    AND t.day = p_day
    AND (p_ids IS NULL OR t.user_id = ANY (p_ids))
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.topper_badges(uuid[], date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topper_badges(uuid[], date) TO anon, authenticated, service_role;

-- Public read helper: a player's coin history (rewards, challenge streaks, topper bonuses).
CREATE OR REPLACE FUNCTION public.public_coin_history(p_user_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, kind text, amount integer, day date, note text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.kind, t.amount::int, t.day, t.note, t.created_at
  FROM public.coin_transactions t
  JOIN public.profiles p ON p.id = t.user_id
  WHERE t.user_id = p_user_id
    AND p.username IS NOT NULL
  ORDER BY t.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 30), 50);
$$;

REVOKE ALL ON FUNCTION public.public_coin_history(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_coin_history(uuid, integer) TO anon, authenticated, service_role;

-- Public read helper: a player's coin/streak totals for their profile header.
CREATE OR REPLACE FUNCTION public.public_rewards_summary(p_user_id uuid)
RETURNS TABLE(coins integer, challenge_streak integer, reward_streak integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.coins::int, r.challenge_streak::int, r.reward_streak::int
  FROM public.user_rewards r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.user_id = p_user_id AND p.username IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.public_rewards_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_rewards_summary(uuid) TO anon, authenticated, service_role;