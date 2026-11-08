DROP TRIGGER IF EXISTS tournaments_reset_data_after_creation ON public.tournaments;

DROP FUNCTION IF EXISTS public.reset_tournament_data_after_creation();
