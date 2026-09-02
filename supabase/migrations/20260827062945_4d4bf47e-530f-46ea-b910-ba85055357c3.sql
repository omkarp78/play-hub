CREATE TABLE IF NOT EXISTS public.solo_targets (
  game_id text PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  target_score integer NOT NULL,
  points integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.solo_targets TO anon, authenticated;
GRANT ALL ON public.solo_targets TO service_role;

ALTER TABLE public.solo_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solo targets readable" ON public.solo_targets;
CREATE POLICY "solo targets readable" ON public.solo_targets
  FOR SELECT TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS solo_targets_updated_at ON public.solo_targets;
CREATE TRIGGER solo_targets_updated_at BEFORE UPDATE ON public.solo_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.solo_targets (game_id, target_score, points) VALUES
  ('numberrush', 220, 3),
  ('gridrecall', 400, 3),
  ('movingcount', 380, 3),
  ('reflexrush', 1400, 3)
ON CONFLICT (game_id) DO UPDATE
  SET target_score = EXCLUDED.target_score, points = EXCLUDED.points, updated_at = now();

CREATE OR REPLACE FUNCTION public.record_game_result(_game_id text, _mode text, _outcome text, _opponent_name text DEFAULT NULL::text, _score integer DEFAULT 0, _duration_seconds integer DEFAULT 0, _mistakes integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); delta int; prof public.profiles; mode text;
        tgt public.solo_targets; solo_points int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _outcome NOT IN ('win','loss','draw') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id) THEN
    RAISE EXCEPTION 'unknown game';
  END IF;

  mode := left(coalesce(_mode,'solo'),20);

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

  IF mode = 'online' THEN
    PERFORM public.grant_points(uid, delta, 'ranked',
      _game_id || ':' || extract(epoch from clock_timestamp())::bigint::text);
  ELSIF mode = 'daily' THEN
    PERFORM public.grant_points(uid, 10, 'daily', _game_id || ':' || current_date::text);
  ELSIF mode = 'solo' THEN
    SELECT * INTO tgt FROM public.solo_targets WHERE game_id = _game_id;
    IF tgt.game_id IS NOT NULL AND COALESCE(_score,0) >= tgt.target_score THEN
      solo_points := GREATEST(tgt.points, 0);
      PERFORM public.grant_points(uid, solo_points, 'solo_target',
        _game_id || ':' || current_date::text);
    END IF;
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

  RETURN jsonb_build_object('rating_delta', delta, 'solo_points', solo_points);
END; $function$;