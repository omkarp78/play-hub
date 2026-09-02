UPDATE public.games SET active = false WHERE id = 'sudoku';

INSERT INTO public.games (id, name, description, difficulty, accent, active, sort_order)
VALUES ('handcricket', 'Hand Cricket', 'Throw 1-6 at the same time. Match the number and the batter is out. Bat, bowl and chase.', 'Easy', 'violet', true, 20)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = true;

INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('cricket_win', 'handcricket', 'Match Winner', 'Win your first Hand Cricket match.', 'trophy'),
  ('cricket_bighitter', 'handcricket', 'Big Hitter', 'Score 30 or more runs in a single innings.', 'flame')
ON CONFLICT (id) DO NOTHING;