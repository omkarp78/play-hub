
-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  email text,
  country text DEFAULT 'WW',
  rating integer NOT NULL DEFAULT 1200,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  friends_count integer NOT NULL DEFAULT 0,
  favorite_game text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_username_idx ON public.profiles (username);
CREATE INDEX profiles_rating_idx ON public.profiles (rating DESC);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,'player'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.username_available(_username text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(_username));
$$;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- ============ games ============
CREATE TABLE public.games (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  difficulty text NOT NULL DEFAULT 'Casual',
  accent text NOT NULL DEFAULT 'indigo',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games readable" ON public.games FOR SELECT USING (true);
INSERT INTO public.games (id, name, description, difficulty, accent, sort_order) VALUES
  ('tictactoe', 'Tic Tac Toe', 'The timeless XOX duel. Beat the bot, climb the ladder or challenge a friend in realtime.', 'Easy', 'indigo', 1),
  ('sudoku', 'Sudoku Challenge', 'Race a friend through the exact same grid. Fastest time with fewest mistakes wins.', 'Medium', 'violet', 2);

-- ============ matches & results ============
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'bot',
  status text NOT NULL DEFAULT 'finished',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon;
GRANT SELECT, INSERT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches readable" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches insert" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'bot',
  result text NOT NULL,
  opponent_name text,
  rating_delta integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  mistakes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_results_user_idx ON public.game_results (user_id, created_at DESC);
CREATE INDEX game_results_game_idx ON public.game_results (game_id, created_at DESC);
GRANT SELECT ON public.game_results TO anon;
GRANT SELECT, INSERT ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results readable" ON public.game_results FOR SELECT USING (true);
CREATE POLICY "results insert own" ON public.game_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ leaderboards ============
CREATE TABLE public.leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT 'global',
  rating integer NOT NULL DEFAULT 1200,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id, period)
);
CREATE INDEX leaderboards_rank_idx ON public.leaderboards (game_id, period, rating DESC);
GRANT SELECT ON public.leaderboards TO anon;
GRANT SELECT, INSERT, UPDATE ON public.leaderboards TO authenticated;
GRANT ALL ON public.leaderboards TO service_role;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboards readable" ON public.leaderboards FOR SELECT USING (true);
CREATE POLICY "leaderboards own upsert" ON public.leaderboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leaderboards own update" ON public.leaderboards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ friends ============
CREATE TABLE public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);
CREATE INDEX friends_user_idx ON public.friends (user_id);
GRANT SELECT, INSERT, DELETE ON public.friends TO authenticated;
GRANT SELECT ON public.friends TO anon;
GRANT ALL ON public.friends TO service_role;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friends readable" ON public.friends FOR SELECT USING (true);
CREATE POLICY "friends insert" ON public.friends FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friends delete" ON public.friends FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);
CREATE INDEX friend_requests_receiver_idx ON public.friend_requests (receiver_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests visible to participants" ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "requests insert own" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "requests update participants" ON public.friend_requests FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id) WITH CHECK (true);
CREATE POLICY "requests delete participants" ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications own delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ achievements ============
CREATE TABLE public.achievements (
  id text PRIMARY KEY,
  game_id text REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy'
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable" ON public.achievements FOR SELECT USING (true);
INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('first_win', NULL, 'First Blood', 'Win your very first match.', 'trophy'),
  ('win_streak_3', NULL, 'Hat Trick', 'Win three matches in a row.', 'flame'),
  ('ttt_bot_impossible', 'tictactoe', 'Machine Breaker', 'Draw or beat the Impossible bot.', 'cpu'),
  ('ttt_10_wins', 'tictactoe', 'XOX Veteran', 'Win 10 Tic Tac Toe matches.', 'swords'),
  ('sudoku_clean', 'sudoku', 'Flawless', 'Finish a Sudoku with zero mistakes.', 'sparkles'),
  ('sudoku_speed', 'sudoku', 'Speed Solver', 'Finish a Sudoku in under 5 minutes.', 'timer');

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO anon;
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user achievements readable" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "user achievements insert own" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ game rooms (realtime) ============
CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'friend',
  status text NOT NULL DEFAULT 'waiting',
  host_id text NOT NULL,
  host_name text NOT NULL,
  guest_id text,
  guest_name text,
  winner text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_rooms_status_idx ON public.game_rooms (game_id, mode, status, created_at);
GRANT SELECT, INSERT, UPDATE ON public.game_rooms TO anon, authenticated;
GRANT ALL ON public.game_rooms TO service_role;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "rooms insert" ON public.game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms update" ON public.game_rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE TRIGGER game_rooms_updated BEFORE UPDATE ON public.game_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ sudoku challenges ============
CREATE TABLE public.sudoku_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  creator_id text NOT NULL,
  creator_name text NOT NULL,
  difficulty text NOT NULL DEFAULT 'easy',
  timer_seconds integer NOT NULL DEFAULT 600,
  puzzle text NOT NULL,
  solution text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sudoku_challenges_code_idx ON public.sudoku_challenges (code);
GRANT SELECT, INSERT, UPDATE ON public.sudoku_challenges TO anon, authenticated;
GRANT ALL ON public.sudoku_challenges TO service_role;
ALTER TABLE public.sudoku_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.sudoku_challenges FOR SELECT USING (true);
CREATE POLICY "challenges insert" ON public.sudoku_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "challenges update" ON public.sudoku_challenges FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.sudoku_challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.sudoku_challenges(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  status text NOT NULL DEFAULT 'playing',
  time_seconds integer NOT NULL DEFAULT 0,
  mistakes integer NOT NULL DEFAULT 0,
  accuracy integer NOT NULL DEFAULT 100,
  filled integer NOT NULL DEFAULT 0,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, player_id)
);
CREATE INDEX sudoku_entries_challenge_idx ON public.sudoku_challenge_entries (challenge_id);
GRANT SELECT, INSERT, UPDATE ON public.sudoku_challenge_entries TO anon, authenticated;
GRANT ALL ON public.sudoku_challenge_entries TO service_role;
ALTER TABLE public.sudoku_challenge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries readable" ON public.sudoku_challenge_entries FOR SELECT USING (true);
CREATE POLICY "entries insert" ON public.sudoku_challenge_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "entries update" ON public.sudoku_challenge_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE TRIGGER sudoku_entries_updated BEFORE UPDATE ON public.sudoku_challenge_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ guest sessions ============
CREATE TABLE public.guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL UNIQUE,
  name text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.guest_sessions TO anon, authenticated;
GRANT ALL ON public.guest_sessions TO service_role;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests readable" ON public.guest_sessions FOR SELECT USING (true);
CREATE POLICY "guests insert" ON public.guest_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "guests update" ON public.guest_sessions FOR UPDATE USING (true) WITH CHECK (true);

-- ============ realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sudoku_challenge_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
