DROP FUNCTION IF EXISTS public.record_game_result(text,text,text,text,integer,integer,integer);

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
    PERFORM public.grant_points(uid, 6, 'daily', _game_id || ':' || current_date::text);
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

REVOKE ALL ON FUNCTION public.record_game_result(text,text,text,text,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_game_result(text,text,text,text,integer,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_attempt(_attempt_id uuid, _player_key text, _player_name text, _score integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE row public.challenge_attempts; ident text; clean_name text; uid uuid := auth.uid();
BEGIN
  ident := COALESCE(uid::text, _player_key);
  clean_name := NULLIF(btrim(COALESCE(_player_name, '')), '');
  IF clean_name IS NULL THEN clean_name := 'Guest'; END IF;
  clean_name := left(clean_name, 20);

  SELECT * INTO row FROM public.challenge_attempts WHERE id = _attempt_id FOR UPDATE;
  IF row.id IS NULL OR row.player_key <> ident THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  IF row.status = 'completed' THEN
    RETURN jsonb_build_object('state', 'completed', 'duplicate', true, 'score', row.score);
  END IF;

  IF row.status = 'expired' OR row.expires_at < now() THEN
    UPDATE public.challenge_attempts SET status = 'expired' WHERE id = row.id;
    RETURN jsonb_build_object('state', 'expired');
  END IF;

  UPDATE public.challenge_attempts
    SET status = 'completed', score = COALESCE(_score, 0), completed_at = now()
    WHERE id = row.id;

  BEGIN
    IF row.scope = 'daily' THEN
      INSERT INTO public.daily_entries (game_id, day, player_key, player_name, score)
      VALUES (row.game_id, current_date, row.player_key, clean_name, COALESCE(_score, 0));
    ELSE
      INSERT INTO public.score_challenge_entries (challenge_id, player_key, player_name, score)
      VALUES (row.ref_key::uuid, row.player_key, clean_name, COALESCE(_score, 0));
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  IF row.scope = 'daily' AND uid IS NOT NULL THEN
    PERFORM public.grant_points(uid, 6, 'daily', row.game_id || ':' || current_date::text);
  END IF;

  RETURN jsonb_build_object('state', 'completed', 'duplicate', false, 'score', COALESCE(_score, 0));
END; $function$;

CREATE OR REPLACE FUNCTION public.finish_attempt_scored(_attempt_id uuid, _player_key text, _player_name text, _score integer, _correct integer, _time_ms integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE row public.challenge_attempts; clean_name text; uid uuid := auth.uid();
BEGIN
  clean_name := NULLIF(btrim(COALESCE(_player_name, '')), '');
  IF clean_name IS NULL THEN clean_name := 'Guest'; END IF;
  clean_name := left(clean_name, 20);

  SELECT * INTO row FROM public.challenge_attempts WHERE id = _attempt_id FOR UPDATE;
  IF row.id IS NULL OR row.player_key <> _player_key THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  IF row.status = 'completed' THEN
    RETURN jsonb_build_object('state', 'completed', 'duplicate', true, 'score', row.score,
      'correct', row.correct_count, 'time_ms', row.time_ms);
  END IF;

  IF row.status = 'expired' OR row.expires_at < now() THEN
    UPDATE public.challenge_attempts SET status = 'expired' WHERE id = row.id;
    RETURN jsonb_build_object('state', 'expired');
  END IF;

  UPDATE public.challenge_attempts
    SET status = 'completed',
        score = GREATEST(COALESCE(_score, 0), 0),
        correct_count = GREATEST(COALESCE(_correct, 0), 0),
        time_ms = GREATEST(COALESCE(_time_ms, 0), 0),
        verified = true,
        completed_at = now()
    WHERE id = row.id;

  BEGIN
    IF row.scope = 'daily' THEN
      INSERT INTO public.daily_entries (game_id, day, player_key, player_name, score)
      VALUES (row.game_id, current_date, row.player_key, clean_name, GREATEST(COALESCE(_score, 0), 0));
    ELSE
      INSERT INTO public.score_challenge_entries (challenge_id, player_key, player_name, score)
      VALUES (row.ref_key::uuid, row.player_key, clean_name, GREATEST(COALESCE(_score, 0), 0));
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  IF row.scope = 'daily' AND uid IS NOT NULL AND uid::text = row.player_key THEN
    PERFORM public.grant_points(uid, 6, 'daily', row.game_id || ':' || current_date::text);
  END IF;

  RETURN jsonb_build_object('state', 'completed', 'duplicate', false,
    'score', GREATEST(COALESCE(_score, 0), 0), 'correct', COALESCE(_correct, 0), 'time_ms', COALESCE(_time_ms, 0));
END; $function$;