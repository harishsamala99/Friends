ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS tournament_id uuid;

CREATE INDEX IF NOT EXISTS fixtures_tournament_id_idx
  ON public.fixtures (tournament_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixtures TO anon;

DROP POLICY IF EXISTS "public manage fixtures" ON public.fixtures;

CREATE POLICY "public manage fixtures"
  ON public.fixtures
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);