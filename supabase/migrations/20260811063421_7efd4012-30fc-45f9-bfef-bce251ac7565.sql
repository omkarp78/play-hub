CREATE OR REPLACE FUNCTION public.guard_daily_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE used int; limit_n int;
BEGIN
  limit_n := CASE WHEN NEW.game_id = 'bullseye' THEN 2 ELSE 1 END;
  SELECT count(*) INTO used FROM public.daily_entries
  WHERE game_id = NEW.game_id AND day = NEW.day AND player_key = NEW.player_key;
  IF used >= limit_n THEN
    RAISE EXCEPTION 'daily attempts exhausted';
  END IF;
  RETURN NEW;
END; $function$;