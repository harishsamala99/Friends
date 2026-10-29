CREATE TABLE public.fixture_player_ratings (
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating numeric(3, 1) NOT NULL CHECK (rating BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_id, player_id)
);

ALTER TABLE public.fixture_player_ratings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixture_player_ratings TO anon, authenticated;
CREATE POLICY "public manage fixture player ratings"
  ON public.fixture_player_ratings FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
