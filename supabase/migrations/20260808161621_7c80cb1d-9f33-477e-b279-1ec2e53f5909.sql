INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('numberrush', 'Number Rush', 'Fast mental-math sprint: solve as many questions as you can before the timer runs out.', 'Easy', 'violet', 50, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('numberrush_first_win', 'numberrush', 'Quick Thinker', 'Win your first Number Rush match', 'trophy'),
  ('numberrush_500', 'numberrush', 'Mental Athlete', 'Score 500 or more in a single Number Rush game', 'zap'),
  ('numberrush_daily', 'numberrush', 'Daily Brain', 'Play a Number Rush daily challenge', 'calendar')
ON CONFLICT (id) DO NOTHING;