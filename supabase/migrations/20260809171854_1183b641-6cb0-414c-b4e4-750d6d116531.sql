DROP POLICY IF EXISTS "entries insert" ON public.score_challenge_entries;
CREATE POLICY "entries insert own" ON public.score_challenge_entries
FOR INSERT TO anon, authenticated
WITH CHECK (
  ((auth.uid() IS NOT NULL) AND (player_key = (auth.uid())::text))
  OR ((auth.uid() IS NULL) AND (player_key LIKE 'guest-%'))
);

DROP POLICY IF EXISTS "challenges insert" ON public.score_challenges;
CREATE POLICY "challenges insert by creator" ON public.score_challenges
FOR INSERT TO anon, authenticated
WITH CHECK (
  ((auth.uid() IS NOT NULL) AND (creator_key = (auth.uid())::text))
  OR ((auth.uid() IS NULL) AND (creator_key LIKE 'guest-%'))
);

REVOKE UPDATE, DELETE ON public.score_challenge_entries FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.score_challenges FROM anon, authenticated;