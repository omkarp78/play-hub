-- 1) Clients may no longer write game state / outcome columns directly.
revoke update on public.game_rooms from anon, authenticated;
grant update (guest_id, guest_name, status) on public.game_rooms to anon, authenticated;
grant all on public.game_rooms to service_role;

drop policy if exists "rooms update by active participants" on public.game_rooms;

-- Only remaining direct update: joining an open room as the guest.
create policy "rooms join open room"
on public.game_rooms
for update
to anon, authenticated
using (
  guest_id is null
  and status = 'waiting'
  and created_at > now() - interval '06:00:00'
)
with check (
  status = 'playing'
  and guest_id is not null
  and (
    (auth.uid() is not null and guest_id = (auth.uid())::text)
    or (auth.uid() is null and guest_id like 'guest-%')
  )
);

-- 2) Shared caller check.
create or replace function public.room_caller_ok(p_room public.game_rooms, p_player_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_player_id is not null
     and (
       case when auth.uid() is not null
            then p_player_id = (auth.uid())::text
            else p_player_id like 'guest-%'
       end
     )
     and (p_room.host_id = p_player_id or p_room.guest_id = p_player_id);
$$;

revoke all on function public.room_caller_ok(public.game_rooms, text) from public;
grant execute on function public.room_caller_ok(public.game_rooms, text) to anon, authenticated, service_role;

-- 3) Validated state write (compare-and-swap, no self-declared wins).
create or replace function public.room_patch_state(
  p_room_id uuid,
  p_player_id text,
  p_state jsonb,
  p_expected_v integer default 0,
  p_status text default null,
  p_winner text default null,
  p_set_winner boolean default false
)
returns setof public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  cur_v integer;
  opp text;
begin
  select * into r from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if not public.room_caller_ok(r, p_player_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if r.created_at <= now() - interval '06:00:00' then
    raise exception 'room expired' using errcode = '42501';
  end if;
  if r.status in ('finished','abandoned','cancelled','expired') then
    raise exception 'match already ended' using errcode = '42501';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'invalid state' using errcode = '22023';
  end if;

  cur_v := coalesce((r.state->>'_v')::int, 0);
  if coalesce(p_expected_v, 0) > 0 and cur_v <> p_expected_v then
    return; -- stale write, caller resyncs and retries
  end if;

  if p_status is not null and p_status not in ('waiting','ready','playing','finished') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  opp := case when r.host_id = p_player_id then r.guest_id else r.host_id end;
  if p_set_winner and p_winner is not null
     and p_winner <> 'draw'
     and p_winner is distinct from opp then
    -- a player may concede or record a draw, never award themselves the win
    raise exception 'winner cannot be self-declared' using errcode = '42501';
  end if;

  return query
  update public.game_rooms
     set state = jsonb_set(p_state, '{_v}', to_jsonb(cur_v + 1), true),
         status = coalesce(p_status, status),
         winner = case when p_set_winner then p_winner else winner end,
         updated_at = now()
   where id = p_room_id
  returning *;
end;
$$;

revoke all on function public.room_patch_state(uuid, text, jsonb, integer, text, text, boolean) from public;
grant execute on function public.room_patch_state(uuid, text, jsonb, integer, text, text, boolean) to anon, authenticated, service_role;

-- 4) Forfeit: only after the room has actually been idle (real disconnect).
create or replace function public.room_claim_forfeit(p_room_id uuid, p_player_id text)
returns setof public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare r public.game_rooms;
begin
  select * into r from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if not public.room_caller_ok(r, p_player_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if r.status in ('finished','abandoned','cancelled','expired') then
    return query select * from public.game_rooms where id = p_room_id;
    return;
  end if;
  if coalesce(r.updated_at, r.created_at) > now() - interval '15 seconds' then
    raise exception 'opponent is still active' using errcode = '42501';
  end if;

  return query
  update public.game_rooms
     set status = 'finished', winner = p_player_id, updated_at = now()
   where id = p_room_id
  returning *;
end;
$$;

revoke all on function public.room_claim_forfeit(uuid, text) from public;
grant execute on function public.room_claim_forfeit(uuid, text) to anon, authenticated, service_role;

-- 5) Leaving hands the win to the opponent, never to the leaver.
create or replace function public.room_leave(p_room_id uuid, p_player_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.game_rooms; opp text;
begin
  select * into r from public.game_rooms where id = p_room_id for update;
  if not found then return; end if;
  if not public.room_caller_ok(r, p_player_id) then return; end if;
  if r.status in ('finished','abandoned','cancelled','expired') then return; end if;
  opp := case when r.host_id = p_player_id then r.guest_id else r.host_id end;
  update public.game_rooms
     set status = 'abandoned',
         winner = coalesce(winner, opp),
         updated_at = now()
   where id = p_room_id;
end;
$$;

revoke all on function public.room_leave(uuid, text) from public;
grant execute on function public.room_leave(uuid, text) to anon, authenticated, service_role;

-- 6) Expiring a stale, never-joined room.
create or replace function public.room_expire(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.game_rooms
     set status = 'expired', updated_at = now()
   where id = p_room_id
     and status = 'waiting'
     and guest_id is null
     and created_at < now() - interval '30 minutes';
end;
$$;

revoke all on function public.room_expire(uuid) from public;
grant execute on function public.room_expire(uuid) to anon, authenticated, service_role;