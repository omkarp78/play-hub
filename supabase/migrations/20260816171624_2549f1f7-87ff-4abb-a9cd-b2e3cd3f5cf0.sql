
CREATE TABLE public.user_rewards (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  reward_streak integer NOT NULL DEFAULT 0,
  reward_day integer NOT NULL DEFAULT 0,
  last_reward_date date,
  challenge_streak integer NOT NULL DEFAULT 0,
  last_challenge_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_rewards TO authenticated;
GRANT ALL ON public.user_rewards TO service_role;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rewards read" ON public.user_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount integer NOT NULL,
  day date NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, day)
);

GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_rewards_updated BEFORE UPDATE ON public.user_rewards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.rewards_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_rewards;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_rewards (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.user_rewards WHERE user_id = auth.uid();
  RETURN jsonb_build_object(
    'today', (current_date)::text,
    'coins', r.coins,
    'rewardStreak', r.reward_streak,
    'rewardDay', r.reward_day,
    'lastRewardDate', r.last_reward_date::text,
    'challengeStreak', r.challenge_streak,
    'lastChallengeDate', r.last_challenge_date::text
  );
END; $$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_rewards; nd int; amt int;
  rewards int[] := ARRAY[10,15,20,25,30,40,50];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_rewards (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.user_rewards WHERE user_id = auth.uid() FOR UPDATE;
  IF r.last_reward_date = current_date THEN RETURN public.rewards_state(); END IF;
  IF r.last_reward_date = current_date - 1 THEN nd := (r.reward_day % 7) + 1; ELSE nd := 1; END IF;
  amt := rewards[nd];
  INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
  VALUES (auth.uid(), 'CLAIM_DAILY_REWARD', amt, current_date, 'Daily Reward — Day ' || nd)
  ON CONFLICT (user_id, kind, day) DO NOTHING;
  IF NOT FOUND THEN RETURN public.rewards_state(); END IF;
  UPDATE public.user_rewards SET
    coins = coins + amt,
    reward_day = nd,
    reward_streak = CASE WHEN nd = 1 AND r.last_reward_date IS DISTINCT FROM current_date - 1 THEN 1 ELSE r.reward_streak + 1 END,
    last_reward_date = current_date
  WHERE user_id = auth.uid();
  RETURN public.rewards_state();
END; $$;

CREATE OR REPLACE FUNCTION public.recover_daily_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_rewards; md int; cost int;
  costs int[] := ARRAY[10,15,25,30,40,50,60];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.user_rewards WHERE user_id = auth.uid() FOR UPDATE;
  IF r IS NULL OR r.last_reward_date IS DISTINCT FROM current_date - 2 THEN
    RAISE EXCEPTION 'nothing to recover';
  END IF;
  md := (r.reward_day % 7) + 1;
  cost := costs[md];
  IF r.coins < cost THEN RAISE EXCEPTION 'not enough coins'; END IF;
  INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
  VALUES (auth.uid(), 'RECOVER_DAILY_STREAK', -cost, current_date - 1, 'Streak Recovery — Day ' || md)
  ON CONFLICT (user_id, kind, day) DO NOTHING;
  IF NOT FOUND THEN RETURN public.rewards_state(); END IF;
  UPDATE public.user_rewards SET
    coins = coins - cost,
    reward_day = md,
    reward_streak = r.reward_streak + 1,
    last_reward_date = current_date - 1
  WHERE user_id = auth.uid();
  RETURN public.rewards_state();
END; $$;

CREATE OR REPLACE FUNCTION public.claim_challenge_day()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_rewards; ns int; amt int;
  rewards int[] := ARRAY[5,10,15,20,25,30,50];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_rewards (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.user_rewards WHERE user_id = auth.uid() FOR UPDATE;
  IF r.last_challenge_date = current_date THEN RETURN public.rewards_state(); END IF;
  IF r.last_challenge_date = current_date - 1 THEN ns := r.challenge_streak + 1; ELSE ns := 1; END IF;
  amt := rewards[LEAST(((ns - 1) % 7) + 1, 7)];
  INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
  VALUES (auth.uid(), 'DAILY_CHALLENGE_REWARD', amt, current_date, 'Daily Challenge — Day ' || ns)
  ON CONFLICT (user_id, kind, day) DO NOTHING;
  IF NOT FOUND THEN RETURN public.rewards_state(); END IF;
  UPDATE public.user_rewards SET
    coins = coins + amt, challenge_streak = ns, last_challenge_date = current_date
  WHERE user_id = auth.uid();
  RETURN public.rewards_state();
END; $$;

CREATE OR REPLACE FUNCTION public.recover_challenge_streak()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_rewards; cost int := 20;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.user_rewards WHERE user_id = auth.uid() FOR UPDATE;
  IF r IS NULL OR r.last_challenge_date IS DISTINCT FROM current_date - 2 THEN
    RAISE EXCEPTION 'nothing to recover';
  END IF;
  IF r.coins < cost THEN RAISE EXCEPTION 'not enough coins'; END IF;
  INSERT INTO public.coin_transactions (user_id, kind, amount, day, note)
  VALUES (auth.uid(), 'RECOVER_CHALLENGE_STREAK', -cost, current_date - 1, 'Challenge Streak Recovery')
  ON CONFLICT (user_id, kind, day) DO NOTHING;
  IF NOT FOUND THEN RETURN public.rewards_state(); END IF;
  UPDATE public.user_rewards SET
    coins = coins - cost,
    challenge_streak = r.challenge_streak + 1,
    last_challenge_date = current_date - 1
  WHERE user_id = auth.uid();
  RETURN public.rewards_state();
END; $$;

REVOKE EXECUTE ON FUNCTION public.rewards_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recover_daily_reward() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_challenge_day() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recover_challenge_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewards_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_daily_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_challenge_day() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_challenge_streak() TO authenticated;
