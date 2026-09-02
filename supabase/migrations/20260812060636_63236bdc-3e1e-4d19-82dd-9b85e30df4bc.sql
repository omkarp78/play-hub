INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('numberrushspeed', 'Number Rush Speed Run', 'Solve 11 questions as fast as you can.', 'medium', 'primary', 55, false)
ON CONFLICT (id) DO NOTHING;