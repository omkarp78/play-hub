-- 1. profiles: remove email from client-readable columns (column-level grants)
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, country, rating, wins, losses, draws, friends_count, favorite_game, created_at, updated_at)
  ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2. sudoku_challenges: hide the solution column from clients
REVOKE SELECT ON public.sudoku_challenges FROM anon, authenticated;
GRANT SELECT (id, code, creator_id, creator_name, difficulty, timer_seconds, puzzle, status, created_at)
  ON public.sudoku_challenges TO anon, authenticated;
GRANT ALL ON public.sudoku_challenges TO service_role;

-- 3. SECURITY DEFINER functions: revoke blanket EXECUTE, grant only what the app needs
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_username(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_guest_username(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_username(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;