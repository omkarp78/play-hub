
-- 1. profiles.email removal (unused by app; email comes from auth session)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,'player'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 2. legacy sudoku tables (game removed from the app) hold answer keys; drop them
DROP TABLE IF EXISTS public.sudoku_challenge_entries CASCADE;
DROP TABLE IF EXISTS public.sudoku_challenges CASCADE;

-- 3. keep SECURITY DEFINER execute rights minimal
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_guest_username(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_username(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;
