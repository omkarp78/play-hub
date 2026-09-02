create or replace function public.rewards_board(p_metric text default 'coins', p_limit int default 50, p_ids uuid[] default null)
returns table (player_key uuid, name text, avatar text, value int, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id,
         coalesce(p.username, p.display_name, 'player') as name,
         p.avatar_url,
         case when p_metric = 'streak' then r.challenge_streak else r.coins end,
         r.user_id = auth.uid()
  from public.user_rewards r
  join public.profiles p on p.id = r.user_id
  where p.username is not null
    and (p_ids is null or r.user_id = any(p_ids))
    and (case when p_metric = 'streak' then r.challenge_streak else r.coins end) > 0
  order by 4 desc
  limit least(coalesce(p_limit, 50), 50);
$$;

revoke execute on function public.rewards_board(text, int, uuid[]) from public;
grant execute on function public.rewards_board(text, int, uuid[]) to anon, authenticated;