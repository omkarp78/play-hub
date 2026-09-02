DROP POLICY IF EXISTS "friends insert" ON public.friends;

CREATE POLICY "friends insert own accepted" ON public.friends
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND ((fr.sender_id = auth.uid() AND fr.receiver_id = friends.friend_id)
        OR (fr.receiver_id = auth.uid() AND fr.sender_id = friends.friend_id))
  )
);

CREATE OR REPLACE FUNCTION public.accept_friend_request(_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE req public.friend_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO req FROM public.friend_requests
   WHERE id = _request_id AND receiver_id = auth.uid() AND status = 'pending'
   FOR UPDATE;

  IF req.id IS NULL THEN RETURN false; END IF;

  UPDATE public.friend_requests SET status = 'accepted' WHERE id = req.id;

  INSERT INTO public.friends (user_id, friend_id)
  VALUES (req.receiver_id, req.sender_id), (req.sender_id, req.receiver_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles p
     SET friends_count = (SELECT count(*) FROM public.friends f WHERE f.user_id = p.id)
   WHERE p.id IN (req.sender_id, req.receiver_id);

  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;