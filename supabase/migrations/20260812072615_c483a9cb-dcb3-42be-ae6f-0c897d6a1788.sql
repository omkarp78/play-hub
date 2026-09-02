DROP POLICY IF EXISTS "Guest names are public" ON public.guest_usernames;
REVOKE ALL ON public.guest_usernames FROM anon, authenticated;
GRANT ALL ON public.guest_usernames TO service_role;

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(_username)))
     AND NOT EXISTS (SELECT 1 FROM public.guest_usernames WHERE lower(username) = lower(trim(_username)));
$$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.change_username(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_guest_username(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_username(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.guest_sessions FROM anon, authenticated;
GRANT ALL ON public.guest_sessions TO service_role;