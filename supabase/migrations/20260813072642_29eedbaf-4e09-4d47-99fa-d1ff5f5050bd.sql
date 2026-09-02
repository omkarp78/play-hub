CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX room_messages_room_created_idx ON public.room_messages (room_id, created_at);

GRANT SELECT, INSERT ON public.room_messages TO authenticated;
GRANT SELECT, INSERT ON public.room_messages TO anon;
GRANT ALL ON public.room_messages TO service_role;

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read match chat"
ON public.room_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_rooms r
    WHERE r.id = room_messages.room_id
      AND (
        (auth.uid() IS NOT NULL AND (r.host_id = auth.uid()::text OR r.guest_id = auth.uid()::text))
        OR (auth.uid() IS NULL AND (r.host_id LIKE 'guest-%' OR r.guest_id LIKE 'guest-%'))
      )
  )
);

CREATE POLICY "Participants can send match chat"
ON public.room_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_rooms r
    WHERE r.id = room_messages.room_id
      AND (r.host_id = room_messages.sender_id OR r.guest_id = room_messages.sender_id)
      AND (
        (auth.uid() IS NOT NULL AND room_messages.sender_id = auth.uid()::text)
        OR (auth.uid() IS NULL AND room_messages.sender_id LIKE 'guest-%')
      )
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;