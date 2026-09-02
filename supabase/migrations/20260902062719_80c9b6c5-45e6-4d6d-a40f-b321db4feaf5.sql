DROP FUNCTION IF EXISTS public.profile_recent_results(uuid, integer);

CREATE OR REPLACE FUNCTION public.profile_recent_results(p_user_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, game_id text, mode text, result text, opponent_name text, rating_delta integer, points integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT g.id, g.game_id, g.mode, g.result, g.opponent_name, g.rating_delta::int,
         CASE
           WHEN g.mode = 'online' THEN g.rating_delta::int
           WHEN g.mode = 'daily' THEN COALESCE((
             SELECT e.points FROM public.point_events e
             WHERE e.user_id = g.user_id AND e.kind = 'daily'
               AND e.ref = g.game_id || ':' || ((g.created_at AT TIME ZONE 'utc')::date)::text
             LIMIT 1), 0)
           WHEN g.mode = 'solo' THEN COALESCE((
             SELECT e.points FROM public.point_events e
             WHERE e.user_id = g.user_id AND e.kind = 'solo_target'
               AND e.ref = g.game_id || ':' || ((g.created_at AT TIME ZONE 'utc')::date)::text
             LIMIT 1), 0)
           ELSE 0
         END::int AS points,
         g.created_at
  FROM public.game_results g
  WHERE g.user_id = p_user_id
  ORDER BY g.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 50);
$function$;

REVOKE ALL ON FUNCTION public.profile_recent_results(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_recent_results(uuid, integer) TO anon, authenticated;