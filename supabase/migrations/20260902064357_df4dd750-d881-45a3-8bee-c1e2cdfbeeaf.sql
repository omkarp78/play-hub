CREATE OR REPLACE FUNCTION public.weekly_points_board(p_limit integer DEFAULT 50, p_ids uuid[] DEFAULT NULL::uuid[], p_week date DEFAULT week_start())
 RETURNS TABLE(player_key uuid, name text, avatar text, value integer, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.user_id,
         COALESCE(p.username, p.display_name, 'player'),
         p.avatar_url,
         GREATEST(SUM(e.points), 0)::int,
         e.user_id = auth.uid()
  FROM public.point_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.week_start = COALESCE(p_week, public.week_start())
    AND p.username IS NOT NULL
    AND (p_ids IS NULL OR e.user_id = ANY (p_ids))
  GROUP BY e.user_id, p.username, p.display_name, p.avatar_url
  HAVING GREATEST(SUM(e.points), 0) > 0
  ORDER BY 4 DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 50);
$function$;