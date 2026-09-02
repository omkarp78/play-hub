CREATE TABLE IF NOT EXISTS public.guest_usernames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL UNIQUE,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guest_usernames TO anon, authenticated;
GRANT ALL ON public.guest_usernames TO service_role;

ALTER TABLE public.guest_usernames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guest names are public" ON public.guest_usernames FOR SELECT USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS guest_usernames_lower_idx ON public.guest_usernames (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(_username)))
     AND NOT EXISTS (SELECT 1 FROM public.guest_usernames WHERE lower(username) = lower(trim(_username)));
$$;

CREATE OR REPLACE FUNCTION public.claim_guest_username(_guest_id text, _username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE clean text;
BEGIN
  clean := trim(_username);
  IF clean !~ '^[A-Za-z0-9_]{3,16}$' THEN
    RAISE EXCEPTION 'invalid username';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(clean)) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_usernames WHERE lower(username) = lower(clean) AND guest_id <> _guest_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.guest_usernames (guest_id, username)
  VALUES (_guest_id, clean)
  ON CONFLICT (guest_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.change_username(_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE clean text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  clean := trim(_username);
  IF clean !~ '^[A-Za-z0-9_]{3,16}$' THEN
    RAISE EXCEPTION 'invalid username';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(clean) AND id <> auth.uid()) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_usernames WHERE lower(username) = lower(clean)) THEN
    RETURN false;
  END IF;
  UPDATE public.profiles SET username = clean, display_name = clean, updated_at = now() WHERE id = auth.uid();
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_guest_username(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;