INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('rush24', '24 Rush', 'Use all four numbers exactly once to make 24. Ten rounds, best time wins.', 'Medium', 'emerald', 10, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = true;