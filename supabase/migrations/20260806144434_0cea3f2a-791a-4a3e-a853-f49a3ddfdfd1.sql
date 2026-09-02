INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('rps', 'Rock Paper Scissors', 'Simultaneous duels with abilities, best-of series and dramatic reveals.', 'Casual', 'cyan', 30, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, accent = EXCLUDED.accent, active = true;

INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('rps_first_win', 'rps', 'First Victory', 'Win your first Rock Paper Scissors match.', 'trophy'),
  ('rps_10_wins', 'rps', '10 Wins', 'Win 10 Rock Paper Scissors matches.', 'medal'),
  ('rps_50_wins', 'rps', '50 Wins', 'Win 50 Rock Paper Scissors matches.', 'award'),
  ('rps_100_wins', 'rps', '100 Wins', 'Win 100 Rock Paper Scissors matches.', 'crown'),
  ('rps_perfect', 'rps', 'Perfect Match', 'Win a match without losing a single round.', 'sparkles'),
  ('rps_streak', 'rps', 'Winning Streak', 'Win 5 matches in a row.', 'flame')
ON CONFLICT (id) DO NOTHING;