-- 1. Attempt result columns
ALTER TABLE public.challenge_attempts
  ADD COLUMN IF NOT EXISTS correct_count integer,
  ADD COLUMN IF NOT EXISTS time_ms integer,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- 2. Raw gameplay actions (server-only)
CREATE TABLE IF NOT EXISTS public.attempt_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.challenge_attempts(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, action_key)
);

CREATE INDEX IF NOT EXISTS attempt_actions_attempt_idx ON public.attempt_actions (attempt_id, seq);

GRANT ALL ON public.attempt_actions TO service_role;
ALTER TABLE public.attempt_actions ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the server (service role) may read or write actions.

-- 3. Verified completion routine — service role only
CREATE OR REPLACE FUNCTION public.finish_attempt_scored(
  _attempt_id uuid,
  _player_key text,
  _player_name text,
  _score integer,
  _correct integer,
  _time_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE row public.challenge_attempts; clean_name text;
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
    NULL; -- score row already exists / limit guard fired: attempt still completed
  END;

  RETURN jsonb_build_object('state', 'completed', 'duplicate', false,
    'score', GREATEST(COALESCE(_score, 0), 0), 'correct', COALESCE(_correct, 0), 'time_ms', COALESCE(_time_ms, 0));
END; $function$;

REVOKE ALL ON FUNCTION public.finish_attempt_scored(uuid, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_attempt_scored(uuid, text, text, integer, integer, integer) TO service_role;

-- 4. Clients may no longer submit scores directly
REVOKE ALL ON FUNCTION public.finish_attempt(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_attempt(uuid, text, text, integer) TO service_role;

DROP POLICY IF EXISTS "Players insert their own daily entries" ON public.daily_entries;
DROP POLICY IF EXISTS "entries insert own" ON public.score_challenge_entries;
DROP POLICY IF EXISTS "challenges insert by creator" ON public.score_challenges;

REVOKE INSERT, UPDATE, DELETE ON public.daily_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.score_challenge_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.score_challenges FROM anon, authenticated;

GRANT ALL ON public.daily_entries TO service_role;
GRANT ALL ON public.score_challenge_entries TO service_role;
GRANT ALL ON public.score_challenges TO service_role;