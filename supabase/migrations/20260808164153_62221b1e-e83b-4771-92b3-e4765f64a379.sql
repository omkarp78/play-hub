DROP POLICY IF EXISTS "entries update" ON public.score_challenge_entries;

CREATE OR REPLACE FUNCTION public.guard_challenge_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE exp timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'challenge already played';
  END IF;
  SELECT expires_at INTO exp FROM public.score_challenges WHERE id = NEW.challenge_id;
  IF exp IS NULL OR exp < now() THEN
    RAISE EXCEPTION 'challenge expired';
  END IF;
  NEW.attempts = 1;
  NEW.updated_at = now();
  RETURN NEW;
END; $function$;