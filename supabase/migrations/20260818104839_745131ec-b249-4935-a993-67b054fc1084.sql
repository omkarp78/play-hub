-- Server-authoritative challenge attempt sessions
CREATE TABLE public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('daily','challenge')),
  ref_key text NOT NULL,
  game_id text NOT NULL,
  player_key text NOT NULL,
  attempt_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','expired')),
  score integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.challenge_attempts TO service_role;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
-- No direct client policies: every read/write goes through the SECURITY DEFINER routines below.

CREATE UNIQUE INDEX challenge_attempts_one_active
  ON public.challenge_attempts (scope, ref_key, player_key)
  WHERE status = 'in_progress';
CREATE INDEX challenge_attempts_lookup
  ON public.challenge_attempts (scope, ref_key, player_key);

-- How long a single attempt may stay open (game duration + grace)
CREATE OR REPLACE FUNCTION public.attempt_window(_game_id text)
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _game_id
    WHEN 'numberrush' THEN interval '50 seconds'
    WHEN 'reflexrush' THEN interval '50 seconds'
    WHEN 'numberrushspeed' THEN interval '300 seconds'
    ELSE interval '420 seconds'
  END
$$;

CREATE OR REPLACE FUNCTION public.attempt_state_json(_row public.challenge_attempts, _used int, _max int, _best int)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'state', CASE WHEN _row.id IS NULL THEN (CASE WHEN _used >= _max THEN 'exhausted' ELSE 'available' END)
                  ELSE _row.status END,
    'attempt_id', _row.id,
    'attempt_no', _row.attempt_no,
    'started_at', _row.started_at,
    'expires_at', _row.expires_at,
    'score', _row.score,
    'server_now', now(),
    'attempts_used', _used,
    'max_attempts', _max,
    'best_score', _best
  )
$$;

-- Internal: resolve identity, ref key, usage counters
CREATE OR REPLACE FUNCTION public.resolve_attempt_context(
  _scope text, _game_id text, _player_key text, _challenge_id uuid,
  OUT ref_key text, OUT player_key text, OUT used int, OUT max_attempts int, OUT best int
)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE bonus int := 0; today date := current_date;
BEGIN
  player_key := COALESCE(auth.uid()::text, _player_key);
  IF player_key IS NULL OR length(player_key) < 3 THEN
    RAISE EXCEPTION 'invalid player';
  END IF;

  IF _scope = 'daily' THEN
    ref_key := _game_id || ':' || today::text;
    SELECT count(*) INTO bonus FROM public.daily_bonus_attempts
      WHERE game_id = _game_id AND day = today AND daily_bonus_attempts.player_key = resolve_attempt_context.player_key;
    max_attempts := (CASE WHEN _game_id = 'bullseye' THEN 2 ELSE 1 END) + bonus;
    SELECT COALESCE(max(score), 0) INTO best FROM public.daily_entries
      WHERE game_id = _game_id AND day = today AND daily_entries.player_key = resolve_attempt_context.player_key;
  ELSE
    IF _challenge_id IS NULL THEN RAISE EXCEPTION 'challenge required'; END IF;
    ref_key := _challenge_id::text;
    max_attempts := 1;
    SELECT COALESCE(max(score), 0) INTO best FROM public.score_challenge_entries
      WHERE challenge_id = _challenge_id AND score_challenge_entries.player_key = resolve_attempt_context.player_key;
  END IF;

  SELECT count(*) INTO used FROM public.challenge_attempts a
    WHERE a.scope = _scope AND a.ref_key = resolve_attempt_context.ref_key
      AND a.player_key = resolve_attempt_context.player_key;
END; $$;

-- Read-only status: never creates an attempt
CREATE OR REPLACE FUNCTION public.attempt_status(
  _scope text, _game_id text, _player_key text, _challenge_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ctx record; row public.challenge_attempts;
BEGIN
  SELECT * INTO ctx FROM public.resolve_attempt_context(_scope, _game_id, _player_key, _challenge_id);
  SELECT * INTO row FROM public.challenge_attempts a
    WHERE a.scope = _scope AND a.ref_key = ctx.ref_key AND a.player_key = ctx.player_key
    ORDER BY (a.status = 'in_progress') DESC, a.started_at DESC LIMIT 1;
  IF row.id IS NOT NULL AND row.status = 'in_progress' AND row.expires_at < now() THEN
    row.status := 'expired';
  END IF;
  RETURN public.attempt_state_json(row, ctx.used, ctx.max_attempts, ctx.best);
END; $$;

-- Start or resume: atomic, one active attempt per player
CREATE OR REPLACE FUNCTION public.start_attempt(
  _scope text, _game_id text, _player_key text, _challenge_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ctx record; row public.challenge_attempts; exp timestamptz;
BEGIN
  SELECT * INTO ctx FROM public.resolve_attempt_context(_scope, _game_id, _player_key, _challenge_id);
  PERFORM pg_advisory_xact_lock(hashtext(_scope || ctx.ref_key || ctx.player_key));

  IF _scope = 'challenge' THEN
    SELECT expires_at INTO exp FROM public.score_challenges WHERE id = _challenge_id;
    IF exp IS NULL OR exp < now() THEN RAISE EXCEPTION 'challenge expired'; END IF;
  END IF;

  SELECT * INTO row FROM public.challenge_attempts a
    WHERE a.scope = _scope AND a.ref_key = ctx.ref_key AND a.player_key = ctx.player_key
      AND a.status = 'in_progress' FOR UPDATE;

  IF row.id IS NOT NULL THEN
    IF row.expires_at < now() THEN
      UPDATE public.challenge_attempts SET status = 'expired' WHERE id = row.id RETURNING * INTO row;
      RETURN public.attempt_state_json(row, ctx.used, ctx.max_attempts, ctx.best);
    END IF;
    RETURN public.attempt_state_json(row, ctx.used, ctx.max_attempts, ctx.best) || jsonb_build_object('resumed', true);
  END IF;

  -- recount inside the lock
  SELECT count(*) INTO ctx.used FROM public.challenge_attempts a
    WHERE a.scope = _scope AND a.ref_key = ctx.ref_key AND a.player_key = ctx.player_key;
  IF ctx.used >= ctx.max_attempts THEN
    SELECT * INTO row FROM public.challenge_attempts a
      WHERE a.scope = _scope AND a.ref_key = ctx.ref_key AND a.player_key = ctx.player_key
      ORDER BY a.started_at DESC LIMIT 1;
    RETURN public.attempt_state_json(row, ctx.used, ctx.max_attempts, ctx.best)
           || jsonb_build_object('state', 'exhausted');
  END IF;

  INSERT INTO public.challenge_attempts (scope, ref_key, game_id, player_key, attempt_no, expires_at)
  VALUES (_scope, ctx.ref_key, _game_id, ctx.player_key, ctx.used + 1, now() + public.attempt_window(_game_id))
  RETURNING * INTO row;

  RETURN public.attempt_state_json(row, ctx.used + 1, ctx.max_attempts, ctx.best);
END; $$;

-- Idempotent completion: records the score exactly once
CREATE OR REPLACE FUNCTION public.finish_attempt(
  _attempt_id uuid, _player_key text, _player_name text, _score int
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.challenge_attempts; ident text; clean_name text;
BEGIN
  ident := COALESCE(auth.uid()::text, _player_key);
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
    -- score row already exists or limit guard fired: attempt still counts as completed
    NULL;
  END;

  RETURN jsonb_build_object('state', 'completed', 'duplicate', false, 'score', COALESCE(_score, 0));
END; $$;

REVOKE ALL ON FUNCTION public.attempt_window(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attempt_state_json(public.challenge_attempts, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_attempt_context(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attempt_status(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_attempt(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_attempt(uuid, text, text, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.attempt_status(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_attempt(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_attempt(uuid, text, text, int) TO anon, authenticated;