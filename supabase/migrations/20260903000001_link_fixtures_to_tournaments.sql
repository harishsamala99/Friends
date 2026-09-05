ALTER TABLE public.fixtures
  ADD COLUMN tournament_id uuid;

CREATE INDEX fixtures_tournament_id_idx ON public.fixtures (tournament_id);