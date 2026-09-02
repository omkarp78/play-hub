INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active) VALUES
  ('gridrecall', 'Grid Recall', 'Memorise the highlighted cells, then tap them back.', 'Easy', 'indigo', 80, true),
  ('movingcount', 'Moving Count', 'Track the red blocks while the grid moves, then count them.', 'Easy', 'cyan', 90, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, difficulty = EXCLUDED.difficulty, accent = EXCLUDED.accent, sort_order = EXCLUDED.sort_order, active = true;

UPDATE public.games SET active = false WHERE id = 'memoryblitz';