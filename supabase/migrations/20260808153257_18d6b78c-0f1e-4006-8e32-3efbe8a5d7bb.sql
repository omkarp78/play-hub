CREATE TABLE public.score_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  game_id text NOT NULL DEFAULT 'bullseye',
  seed bigint NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  creator_key text NOT NULL,
  creator_name text NOT NULL,
  creator_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT, INSERT ON public.score_challenges TO anon, authenticated;
GRANT ALL ON public.score_challenges TO service_role;
ALTER TABLE public.score_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.score_challenges FOR SELECT USING (true);
CREATE POLICY "challenges insert" ON public.score_challenges FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.score_challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.score_challenges(id) ON DELETE CASCADE,
  player_key text NOT NULL,
  player_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, player_key)
);

CREATE INDEX score_challenge_entries_board ON public.score_challenge_entries (challenge_id, score DESC);

GRANT SELECT, INSERT, UPDATE ON public.score_challenge_entries TO anon, authenticated;
GRANT ALL ON public.score_challenge_entries TO service_role;
ALTER TABLE public.score_challenge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries readable" ON public.score_challenge_entries FOR SELECT USING (true);
CREATE POLICY "entries insert" ON public.score_challenge_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "entries update" ON public.score_challenge_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.guard_challenge_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE exp timestamptz;
BEGIN
  SELECT expires_at INTO exp FROM public.score_challenges WHERE id = NEW.challenge_id;
  IF exp IS NULL OR exp < now() THEN
    RAISE EXCEPTION 'challenge expired';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.score < OLD.score THEN NEW.score = OLD.score; END IF;
    NEW.attempts = OLD.attempts + 1;
    NEW.player_key = OLD.player_key;
    NEW.challenge_id = OLD.challenge_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER score_challenge_entries_guard
BEFORE INSERT OR UPDATE ON public.score_challenge_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_entry();

ALTER PUBLICATION supabase_realtime ADD TABLE public.score_challenge_entries;