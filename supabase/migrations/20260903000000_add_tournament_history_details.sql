ALTER TABLE public.tournaments
  ADD COLUMN tournament_name text;

COMMENT ON COLUMN public.tournaments.tournament_name IS 'User-defined tournament name shown in tournament history';