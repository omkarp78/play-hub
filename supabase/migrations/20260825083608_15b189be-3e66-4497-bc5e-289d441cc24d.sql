-- 1. Server-authoritative result recorder
CREATE OR REPLACE FUNCTION public.record_game_result(
  _game_id text,
  _mode text,
  _outcome text,
  _opponent_name text DEFAULT NULL,
  _score integer DEFAULT 0,
  _duration_seconds integer DEFAULT 0,
  _mistakes integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); delta int; prof public.profiles;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _outcome NOT IN ('win','loss','draw') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id) THEN
    RAISE EXCEPTION 'unknown game';
  END IF;

  delta := CASE
    WHEN _mode IN ('bot','casual','local','practice') THEN 0
    WHEN _outcome = 'win' THEN 18
    WHEN _outcome = 'loss' THEN -14
    ELSE 3 END;

  INSERT INTO public.game_results (
    user_id, game_id, mode, result, opponent_name, rating_delta,
    score, duration_seconds, mistakes)
  VALUES (uid, _game_id, left(coalesce(_mode,'solo'),20), _outcome,
    left(nullif(btrim(coalesce(_opponent_name,'')),''), 40), delta,
    GREATEST(COALESCE(_score,0),0), GREATEST(COALESCE(_duration_seconds,0),0),
    GREATEST(COALESCE(_mistakes,0),0));

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
END; $$;

REVOKE ALL ON FUNCTION public.record_game_result(text,text,text,text,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_game_result(text,text,text,text,integer,integer,integer) TO authenticated;

-- 2. Remove client write access to results and leaderboards
DROP POLICY IF EXISTS "results insert own" ON public.game_results;
DROP POLICY IF EXISTS "leaderboards own upsert" ON public.leaderboards;
DROP POLICY IF EXISTS "leaderboards own update" ON public.leaderboards;
REVOKE INSERT, UPDATE, DELETE ON public.game_results FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboards FROM authenticated, anon;
GRANT ALL ON public.game_results TO service_role;
GRANT ALL ON public.leaderboards TO service_role;

-- 3. Profiles: allow only non-competitive columns to be edited by the owner
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (username, display_name, avatar_url, country, favorite_game, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;