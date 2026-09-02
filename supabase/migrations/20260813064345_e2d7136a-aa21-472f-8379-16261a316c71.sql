CREATE TABLE public.daily_bonus_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  player_key text NOT NULL,
  source text NOT NULL DEFAULT 'rewarded_ad',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.daily_bonus_attempts TO authenticated;
GRANT SELECT, INSERT ON public.daily_bonus_attempts TO anon;
GRANT ALL ON public.daily_bonus_attempts TO service_role;

ALTER TABLE public.daily_bonus_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bonus attempts are public" ON public.daily_bonus_attempts
FOR SELECT USING (true);

CREATE POLICY "Players insert their own bonus attempts" ON public.daily_bonus_attempts
FOR INSERT WITH CHECK (
  source = 'rewarded_ad' AND (
    (auth.uid() IS NOT NULL AND player_key = auth.uid()::text)
    OR (auth.uid() IS NULL AND player_key LIKE 'guest-%' AND length(player_key) BETWEEN 10 AND 60)
  )
);

CREATE UNIQUE INDEX daily_bonus_attempts_unique_idx
  ON public.daily_bonus_attempts (game_id, day, player_key);

CREATE OR REPLACE FUNCTION public.guard_daily_bonus_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE used int;
BEGIN
  SELECT count(*) INTO used FROM public.daily_bonus_attempts
  WHERE game_id = NEW.game_id AND day = NEW.day AND player_key = NEW.player_key;
  IF used >= 1 THEN
    RAISE EXCEPTION 'bonus attempt already granted';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER daily_bonus_attempts_guard
BEFORE INSERT ON public.daily_bonus_attempts
FOR EACH ROW EXECUTE FUNCTION public.guard_daily_bonus_attempt();

CREATE OR REPLACE FUNCTION public.guard_daily_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE used int; limit_n int; bonus int;
BEGIN
  limit_n := CASE WHEN NEW.game_id = 'bullseye' THEN 2 ELSE 1 END;
  SELECT count(*) INTO used FROM public.daily_entries
  WHERE game_id = NEW.game_id AND day = NEW.day AND player_key = NEW.player_key;
  SELECT count(*) INTO bonus FROM public.daily_bonus_attempts
  WHERE game_id = NEW.game_id AND day = NEW.day AND player_key = NEW.player_key;
  IF used >= limit_n + bonus THEN
    RAISE EXCEPTION 'daily attempts exhausted';
  END IF;
  RETURN NEW;
END; $$;