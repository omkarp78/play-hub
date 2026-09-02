INSERT INTO public.games (id, name, description, difficulty, accent, sort_order, active)
VALUES ('battlexo', 'Battle XO', 'Three pieces each. Place them, then slide them. Power cards, best-of series and almost zero draws.', 'Medium', 'indigo', 0, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, difficulty = EXCLUDED.difficulty, accent = EXCLUDED.accent, sort_order = EXCLUDED.sort_order, active = true;

UPDATE public.games SET active = false WHERE id = 'tictactoe';

INSERT INTO public.achievements (id, game_id, name, description, icon) VALUES
  ('bxo_first_win', 'battlexo', 'First Victory', 'Win your first Battle XO match.', 'trophy'),
  ('bxo_10_wins', 'battlexo', '10 Wins', 'Win 10 Battle XO matches.', 'medal'),
  ('bxo_50_wins', 'battlexo', '50 Wins', 'Win 50 Battle XO matches.', 'award'),
  ('bxo_100_wins', 'battlexo', '100 Wins', 'Win 100 Battle XO matches.', 'crown'),
  ('bxo_streak_5', 'battlexo', 'Win Streak 5', 'Win 5 Battle XO matches in a row.', 'flame'),
  ('bxo_strategist', 'battlexo', 'Master Strategist', 'Beat the Impossible bot.', 'brain'),
  ('bxo_power_master', 'battlexo', 'Power Card Master', 'Win a match after using your power card.', 'zap'),
  ('bxo_speed_winner', 'battlexo', 'Speed Winner', 'Win a round in under 60 seconds.', 'timer')
ON CONFLICT (id) DO UPDATE SET game_id = EXCLUDED.game_id, name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon;