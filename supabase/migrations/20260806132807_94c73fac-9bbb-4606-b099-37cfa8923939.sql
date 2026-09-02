
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;
