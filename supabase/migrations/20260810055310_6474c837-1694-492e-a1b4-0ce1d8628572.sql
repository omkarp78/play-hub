CREATE TABLE public.daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  player_key text NOT NULL,
  player_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.daily_entries TO authenticated;
GRANT SELECT, INSERT ON public.daily_entries TO anon;
GRANT ALL ON public.daily_entries TO service_role;

ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily entries are public" ON public.daily_entries
FOR SELECT USING (true);

CREATE POLICY "Players insert their own daily entries" ON public.daily_entries
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND player_key = auth.uid()::text)
  OR (auth.uid() IS NULL AND player_key LIKE 'guest-%' AND length(player_key) BETWEEN 10 AND 60)
);

CREATE INDEX daily_entries_board_idx ON public.daily_entries (game_id, day, score DESC);
CREATE INDEX daily_entries_player_idx ON public.daily_entries (game_id, day, player_key);

CREATE OR REPLACE FUNCTION public.guard_daily_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE used int;
BEGIN
  SELECT count(*) INTO used FROM public.daily_entries
  WHERE game_id = NEW.game_id AND day = NEW.day AND player_key = NEW.player_key;
  IF used >= 3 THEN
    RAISE EXCEPTION 'daily attempts exhausted';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER daily_entries_guard
BEFORE INSERT ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_daily_entry();