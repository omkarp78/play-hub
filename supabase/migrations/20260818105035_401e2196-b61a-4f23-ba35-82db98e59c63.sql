CREATE OR REPLACE FUNCTION public.resolve_attempt_context(
  _scope text, _game_id text, _player_key text, _challenge_id uuid,
  OUT ref_key text, OUT player_key text, OUT used int, OUT max_attempts int, OUT best int
)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE bonus int := 0; today date := current_date; entries int := 0; started int := 0;
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
    SELECT count(*), COALESCE(max(score), 0) INTO entries, best FROM public.daily_entries
      WHERE game_id = _game_id AND day = today AND daily_entries.player_key = resolve_attempt_context.player_key;
  ELSE
    IF _challenge_id IS NULL THEN RAISE EXCEPTION 'challenge required'; END IF;
    ref_key := _challenge_id::text;
    max_attempts := 1;
    SELECT count(*), COALESCE(max(score), 0) INTO entries, best FROM public.score_challenge_entries
      WHERE challenge_id = _challenge_id AND score_challenge_entries.player_key = resolve_attempt_context.player_key;
  END IF;

  SELECT count(*) INTO started FROM public.challenge_attempts a
    WHERE a.scope = _scope AND a.ref_key = resolve_attempt_context.ref_key
      AND a.player_key = resolve_attempt_context.player_key;

  used := GREATEST(started, entries);
END; $$;

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

  -- recount inside the advisory lock
  SELECT * INTO ctx FROM public.resolve_attempt_context(_scope, _game_id, _player_key, _challenge_id);
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

REVOKE ALL ON FUNCTION public.resolve_attempt_context(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_attempt(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_attempt(text, text, text, uuid) TO anon, authenticated;