INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('bullseye', 'Bullseye Rush', 'Two taps, six darts — lock your aim and land closest to the bullseye.', 'Medium', 'emerald', 4, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = true;

INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('bulls_first_win', 'bullseye', 'On Target', 'Win your first Bullseye Rush match', 'trophy'),
  ('bulls_10_wins', 'bullseye', 'Sharp Shooter', 'Win 10 Bullseye Rush matches', 'trophy'),
  ('bulls_bullseye', 'bullseye', 'Dead Centre', 'Score 100 or more points in a single match', 'target'),
  ('bulls_daily', 'bullseye', 'Daily Darter', 'Play a Daily Challenge attempt', 'calendar')
ON CONFLICT (id) DO NOTHING;